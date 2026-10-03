"""Étiquette les phrases lues de FLEURS (mandarin du continent) syllabe par syllabe.

Recette de `data/sources/tons/modele.json` (voir `PROVENANCE.md`), étape du continent, avant
l'alignement (`aligner.py`). Ne tourne pas en CI : l'audio de FLEURS `cmn_hans_cn` se
télécharge à la main (2,5 Go) et s'extrait dans `data/work/tons/donnees/brut/fleurs/`. Puis :

    cd data && uv run python sources/tons/fleurs.py

FLEURS (Google, CC BY 4.0) : des phrases lues par des locuteurs natifs du continent, avec
leur transcription en caractères simplifiés. Les locuteurs de `train` ne sont pas ceux de
`dev` et `test` (carte du jeu) : `train` sert à l'entraînement, `dev` et `test` sont tenus à
part (la mesure).

Le pinyin de chaque caractère dans son contexte vient du dépôt seulement, jamais d'une
définition de CC-CEDICT :

- les mots de la liste HSK 3.0 (`hsk-mots.tsv`, syllabes numérotées, neutre compris), par
  le plus long appariement, de gauche à droite et de droite à gauche ; là où les deux
  découpes divergent, aucun mot n'est retenu ; un mot écrit de deux façons dans la liste n'a
  d'étiquette qu'aux syllabes où elles concordent ;
- hors d'un mot, la lecture du caractère : ses entrées d'un seul caractère dans la liste HSK
  et sa lecture courante du dépôt (la surcharge de `pinyin.tsv`, sinon `kMandarin` d'Unihan) ;
  si elles n'ont pas toutes le même ton plein, pas d'étiquette (数 : shǔ dans la liste, shù
  dans Unihan) ; une lecture neutre hors d'un mot n'est retenue que pour les particules
  (`PARTICULES`).

Le ton étiqueté est celui que la voix fait (la réalisation attendue), pas celui du
dictionnaire :

- deux tons 3 de suite dans un mot : le premier au ton 2 (2-2-3 pour trois) ; entre deux
  mots, sans ponctuation, le sandhi dépend du débit : le premier n'a pas d'étiquette ;
- un ton 3 devant un neutre du même mot qui vient d'un ton 3 (姐姐, 想想) : pas d'étiquette ;
- 不 devant un ton 4 (même neutralisé, 不是) : ton 2, sinon ton 4 ;
- 一 devant un ton 4 : ton 2 ; devant un ton 1, 2 ou 3 : ton 4 ; ordinal (第一), dans un
  nombre ou en fin de groupe : ton 1 ; devant 月 ou 号, ou une syllabe sans étiquette : pas
  d'étiquette ;
- le ton neutre d'un mot de la liste : 5.

Sortie : `data/work/tons/donnees/fleurs-syllabes.json`, une entrée par enregistrement : la
partie (`train`, `dev`, `test`), la phrase, le genre, le texte, et pour chaque syllabe
prononcée son caractère, son pinyin numéroté (ou `null`), son ton de surface (ou `null`), le
type de son attaque (`forte` : p t k c ch q s sh x f h, `faible` : b d g z zh j, `voisee` :
m n l r, `zero` : y w ou une voyelle, `?` si les lectures divergent), ce qui la précède
(`ponct`, `mot` ou `dans` un mot) et son groupe (entre deux ponctuations). Les phrases qui
portent autre chose que des sinogrammes et de la ponctuation (chiffres, lettres latines)
sont écartées : on ne connaît pas leurs syllabes.
"""
from __future__ import annotations

import json
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parents[2] / "work" / "tons"
BRUT = ICI / "donnees" / "brut" / "fleurs" / "cmn_hans_cn"
SORTIE = ICI / "donnees" / "fleurs-syllabes.json"

#: La ponctuation où la voix peut s'arrêter ; les autres signes (guillemets, 《》, ·) ne
#: coupent rien et sont sautés.
PAUSES = set("，。、；：？！,.;:?!（）()…—")
SAUTES = set("“”‘’\"'《》〈〉「」『』·・ 　-")
CHIFFRES = set("零〇一二三四五六七八九十百千万亿两")
#: Les particules dont la lecture neutre vaut hors d'un mot (的 de, 们 men…).
PARTICULES = set("的吗呢吧们么啊呀嘛")
FORTES = ("ch", "sh", "p", "t", "k", "c", "q", "x", "s", "f", "h")
FAIBLES = ("zh", "b", "d", "g", "z", "j")
VOISEES = ("m", "n", "l", "r")
MARQUES = {"āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4}


def sinogramme(c: str) -> bool:
    return "㐀" <= c <= "鿿" or "\U00020000" <= c <= "\U0002ffff"


def numerotee(lecture: str) -> str:
    """`zhǒng` → `zhong3`, `de` → `de5`, `nǚ` → `nv3`."""
    s = unicodedata.normalize("NFC", lecture.lower())
    ton, nue = 5, []
    for ch in s:
        for k, t in MARQUES.items():
            if ch in k:
                ton, ch = t, "aeiouü"[k.index(ch)]
        nue.append(ch)
    return "".join(nue).replace("ü", "v") + str(ton)


def ton(s: str) -> int:
    return int(s[-1])


def attaque(syl: str) -> str:
    """Le type de l'attaque d'une syllabe numérotée."""
    if syl.startswith(FAIBLES):
        return "faible"
    if syl.startswith(FORTES):
        return "forte"
    if syl.startswith(VOISEES):
        return "voisee"
    return "zero"


def ton_plein(lectures: set[str]) -> int | None:
    """Le ton plein d'un caractère quand toutes ses lectures pleines l'ont."""
    tons = {ton(x) for x in lectures if x[-1] != "5"}
    return tons.pop() if len(tons) == 1 else None


class Lexique:
    """Les mots de la liste HSK et les lectures des caractères, tels que le dépôt les tient."""

    def __init__(self) -> None:
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
        from wenlu_data import mots_hsk

        #: mot -> ses graphies : (syllabes retenues, syllabes au ton plein)
        self.mots: dict[str, list[tuple[tuple[str, ...], tuple[str, ...]]]] = {}
        self.seuls: dict[str, set[str]] = {}
        for m in mots_hsk.charger():
            for f in m.formes:
                syl = tuple(f.syllabes)
                pleines = tuple(f.pleines) if len(f.pleines) == len(syl) else syl
                if len(f.hanzi) == 1 and len(syl) == 1:
                    self.seuls.setdefault(f.hanzi, set()).add(syl[0])
                elif len(f.hanzi) > 1 and len(syl) == len(f.hanzi):
                    self.mots.setdefault(f.hanzi, []).append((syl, pleines))
        #: toutes les lectures connues (surcharges, Unihan et ses dictionnaires) : le ton plein
        #: d'un neutre, le type d'attaque
        self.depot = {c: {numerotee(x) for x in v} for c, v in mots_hsk.lectures_du_pipeline().items()}
        #: la lecture courante : la surcharge, sinon `kMandarin`
        from wenlu_data import surcharges
        from wenlu_data.paths import INGEST

        self.courantes = {c: {numerotee(x) for x in v} for c, v in surcharges.charger_pinyin().items()}
        for e in json.loads((INGEST / "unihan.json").read_text(encoding="utf-8"))["caracteres"]:
            if e["c"] not in self.courantes and e.get("lectures"):
                self.courantes[e["c"]] = {numerotee(x) for x in e["lectures"]}
        self.long = max(len(w) for w in self.mots)

    def lectures(self, c: str) -> set[str]:
        """Les lectures d'un caractère hors d'un mot : la liste HSK d'abord, sinon le dépôt.
        Les formes de sandhi que le dictionnaire écrit pour 一 et 不 (yí, yì, bú) sont des
        réalisations, pas des lectures."""
        if c == "一":
            return {"yi1"}
        if c == "不":
            return {"bu4"}
        return set(self.seuls.get(c, ())) | set(self.courantes.get(c, ()))

    def decouper(self, texte: str) -> list[tuple[int, int]]:
        """Les mots de plusieurs caractères retenus : ceux que les deux appariements trouvent."""
        def avant() -> set[tuple[int, int]]:
            out, i = set(), 0
            while i < len(texte):
                for k in range(min(self.long, len(texte) - i), 1, -1):
                    if texte[i:i + k] in self.mots:
                        out.add((i, i + k))
                        i += k
                        break
                else:
                    i += 1
            return out

        def arriere() -> set[tuple[int, int]]:
            out, j = set(), len(texte)
            while j > 0:
                for k in range(min(self.long, j), 1, -1):
                    if texte[j - k:j] in self.mots:
                        out.add((j - k, j))
                        j -= k
                        break
                else:
                    j -= 1
            return out

        return sorted(avant() & arriere())


def lire_groupe(texte: str, lex: Lexique) -> list[dict] | None:
    """Les syllabes d'un groupe (entre deux ponctuations), tons du dictionnaire. `None` si
    un 儿 hors d'un mot laisse le nombre de syllabes incertain."""
    pos: list[dict] = [{} for _ in texte]
    for a, b in lex.decouper(texte):
        graphies = lex.mots[texte[a:b]]
        for i in range(a, b):
            vus = {s[i - a] for s, _ in graphies}
            pleins = {p[i - a] for _, p in graphies}
            py = vus.pop() if len(vus) == 1 else None
            plein = pleins.pop() if len(pleins) == 1 else None
            pos[i] = dict(py=py, ton=ton(py) if py else None,
                          plein=ton(plein) if plein and plein[-1] != "5" else ton_plein(lex.depot.get(texte[i], set())),
                          attaque=attaque(py) if py else "?", mot=(a, b))
    for i, c in enumerate(texte):
        if pos[i]:
            continue
        if c == "儿" and i > 0:
            return None
        ls = lex.lectures(c)
        neutres = {x for x in ls if x[-1] == "5"}
        choix = neutres if c in PARTICULES and neutres else ls
        tons = {ton(x) for x in choix}
        py = sorted(choix)[0] if len(choix) == 1 else None
        types = {attaque(x) for x in (choix or ls)}
        plein = 0 if c in PARTICULES else ton_plein(lex.depot.get(c, set()))
        pos[i] = dict(py=py, ton=tons.pop() if len(tons) == 1 else None, plein=plein,
                      attaque=types.pop() if len(types) == 1 else "?", mot=(i, i + 1))
    syl = []
    for i, c in enumerate(texte):
        if pos[i]["py"] == "r5":
            continue  # érhua : pas de syllabe
        syl.append(dict(c=c, **pos[i], avant="mot" if pos[i]["mot"][0] == i else "dans"))
    if syl:
        syl[0]["avant"] = "ponct"
    return syl


def surface(syl: list[dict]) -> None:
    """Les tons que la voix fait dans un groupe : 一, 不, puis les tons 3 de suite."""
    n = len(syl)
    dico = [s["ton"] for s in syl]

    def suivant(k: int) -> int | None:
        s = syl[k + 1]
        return s["plein"] if s["ton"] == 5 else s["ton"]

    for k, s in enumerate(syl):
        prec = syl[k - 1]["c"] if k > 0 else ""
        nxt = syl[k + 1]["c"] if k + 1 < n else ""
        if s["c"] == "不":
            ts = suivant(k) if k + 1 < n else 1
            s["ton"] = None if ts is None else (2 if ts == 4 else 4)
        elif s["c"] == "一":
            if k + 1 == n or prec == "第" or prec in CHIFFRES or nxt in CHIFFRES:
                s["ton"] = 1
            elif nxt in "月号":
                s["ton"] = None
            else:
                ts = suivant(k)
                s["ton"] = None if ts is None else (2 if ts == 4 else 4)
    for k in range(n - 1):
        s, nx = syl[k], syl[k + 1]
        if dico[k] != 3 or s["c"] in "一不":
            continue
        if dico[k + 1] == 3 and s["mot"] == nx["mot"]:
            s["ton"] = 2
        elif dico[k + 1] in (3, None) and s["mot"] != nx["mot"]:
            s["ton"] = None
        elif dico[k + 1] == 5 and nx["plein"] in (3, None) and s["mot"] == nx["mot"]:
            s["ton"] = None


def groupes_de(texte: str) -> list[str] | None:
    """La phrase coupée à sa ponctuation ; `None` si elle porte autre chose."""
    gs, cur = [], []
    for c in unicodedata.normalize("NFC", texte):
        if sinogramme(c):
            cur.append(c)
        elif c in PAUSES:
            if cur:
                gs.append("".join(cur))
            cur = []
        elif c in SAUTES:
            continue
        else:
            return None
    if cur:
        gs.append("".join(cur))
    return gs or None


def etiqueter(texte: str, lex: Lexique) -> list[dict] | str:
    """Les syllabes d'une phrase, ou la raison de l'écarter."""
    gs = groupes_de(texte)
    if gs is None:
        return "chiffres ou lettres"
    out = []
    for g, t in enumerate(gs):
        syl = lire_groupe(t, lex)
        if syl is None:
            return "儿 hors d'un mot"
        surface(syl)
        for s in syl:
            s.pop("mot")
            s["g"] = g
        out.extend(syl)
    return out


def main() -> None:
    lex = Lexique()
    sortie, rejets = [], Counter()
    for partie in ("train", "dev", "test"):
        for ligne in (BRUT / f"{partie}.tsv").read_text(encoding="utf-8").splitlines():
            champs = ligne.split("\t")
            phrase, fichier, brut, genre = champs[0], champs[1], champs[2], champs[6]
            syl = etiqueter(brut, lex)
            if isinstance(syl, str):
                rejets[syl] += 1
                continue
            sortie.append(dict(id=f"fleurs/{partie}/{fichier[:-4]}", partie=partie, phrase=phrase, genre=genre,
                               fichier=str((BRUT / "audio" / partie / fichier).relative_to(ICI)),
                               texte=brut, syllabes=syl))
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False))
    n = Counter(p["partie"] for p in sortie)
    syl = [s for p in sortie for s in p["syllabes"]]
    print(f"{len(sortie)} phrases ({dict(n)}), écartées : {dict(rejets)}")
    print(f"{len(syl)} syllabes, étiquetées : {sum(s['ton'] is not None for s in syl)}")
    print("tons :", sorted(Counter(s["ton"] for s in syl).items(), key=str))
    print("attaques :", sorted(Counter(s["attaque"] for s in syl).items()))


if __name__ == "__main__":
    main()
