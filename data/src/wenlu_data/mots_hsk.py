"""La liste des mots du HSK 3.0 (GF 0025-2021), versionnée dans `data/sources/listes/`.

Story D.1 du dictionnaire. Même montage que les listes de caractères (`hsk-*.txt`) :
le texte officiel est un PDF scanné, sans couche texte, que l'environnement de
développement ne peut pas lire (`moe.gov.cn` bloqué) ; la liste vient de deux
transcriptions sous MIT, l'une en source, l'autre en contrôle :

- `ivankra/hsk30`, `hsk30.csv` : 11 092 entrées, niveau, catégorie grammaticale
  (`POS`, celle du site officiel chinesetest.cn), pinyin nettoyé sans sandhi
  (`Pinyin`) et pinyin du site officiel (`WebPinyin`) ;
- `elkmovie/hsk30`, `wordlist.txt` : l'OCR de Pleco du PDF, niveau par niveau, contre
  lequel `wenlu check` relit la forme officielle de chaque entrée.

`wenlu listes mots` lit les deux fichiers téléchargés par `wenlu fetch` et écrit
`data/sources/listes/hsk-mots.tsv`, avec son en-tête de traçabilité (sources, SHA-256,
licences, date de relevé). Seul ce fichier versionné entre dans l'export.

La colonne `CEDICT` d'ivankra (la clé d'une entrée CC-CEDICT) n'est jamais lue, ni la
colonne `Variants`, qui la recopie dans son JSON : le lecteur ne prend que les colonnes
de `COLONNES_LUES`, et un test le vérifie. Aucun sens n'entre ici : la liste dit la
forme, le pinyin, le niveau et la catégorie, rien d'autre.

Le pinyin retenu (colonne `pinyin`) est celui de la colonne `Pinyin` d'ivankra, sans
sandhi (一 yī, 不 bù, la convention du dépôt), avec deux règles, tranchées ici et
justifiées dans `data/schema.md` (« Liste des mots HSK 3.0 ») :

1. `·` : le site officiel note d'un point médian la syllabe dont le ton est neutre
   d'ordinaire mais peut se dire plein (知道 zhī·dào, la notation du 现代汉语词典). Cette
   syllabe s'écrit au ton neutre (zhīdao), et sa lecture pleine reste cherchable
   (`syllabes_pleines`).
2. Les mots de position suivent la décision du propriétaire du 26 septembre 2026
   (`pinyin.MOTS_DE_POSITION`) : 后面 hòumian, 这里 zhèli, 旁边 pángbiān, quoi que dise la
   liste. Neuf entrées diffèrent du pinyin nettoyé d'ivankra : 哪里, 那里, 这里 (qui portent
   `·`, la règle 1 suffit) et 后面, 里面, 前面, 上面, 外面, 下面.

Chaque syllabe se lit dans les lectures du caractère (Unihan et surcharges), au ton plein
ou neutre : `syllabes` les donne numérotées (`ai4 hao4`), la forme que lit la recherche.
"""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from .gf0014 import Controle
from .ingest import est_sinogramme
from .outils import empreinte_fichier
from .paths import INGEST, LISTES, SOURCES
from .pinyin import MOTS_DE_POSITION, lectures_admises, sans_ton

URL_IVANKRA = "https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30.csv"
URL_ELKMOVIE = "https://raw.githubusercontent.com/elkmovie/hsk30/master/wordlist.txt"
DEPOT_IVANKRA = "https://github.com/ivankra/hsk30"
DEPOT_ELKMOVIE = "https://github.com/elkmovie/hsk30"
FICHIER_IVANKRA = "hsk30.csv"
FICHIER_ELKMOVIE = "hsk30-wordlist.txt"
LICENCE_IVANKRA = "MIT (données) — Copyright (c) 2023 Ivan Krasilnikov, (c) 2021 Shawky, (c) 2021 Pleco Inc."
LICENCE_ELKMOVIE = "MIT — Copyright (c) 2021 Pleco Inc."
#: Le début de la ligne d'en-tête du CSV : un fichier qui ne la porte pas est refusé.
ENTETE_IVANKRA = "ID,Simplified,Traditional,Pinyin,POS,Level"
ENTETE_ELKMOVIE = "# HSK 3.0 word list"
#: Le texte de la MIT d'ivankra/hsk30, versionné dans `data/sources/licences/` et exporté.
TEXTE_LICENCE = "MIT-hsk30.txt"

#: La liste versionnée, la seule que lit l'export.
LISTE = LISTES / "hsk-mots.tsv"

#: Les seules colonnes d'ivankra que le pipeline lit. Jamais `CEDICT`, jamais `Variants`.
COLONNES_LUES: tuple[str, ...] = ("ID", "Simplified", "Pinyin", "POS", "Level", "WebPinyin", "OCR")
COLONNES_INTERDITES: tuple[str, ...] = ("CEDICT", "Variants")

#: Les niveaux de la norme, dans l'ordre, et le nombre de mots nouveaux de chacun
#: (GF 0025-2021, comptes concordants des deux transcriptions, SOURCES du 29 septembre).
NIVEAUX: tuple[str, ...] = ("1", "2", "3", "4", "5", "6", "7-9")
COMPTES: dict[str, int] = {"1": 500, "2": 772, "3": 973, "4": 1000, "5": 1071, "6": 1140, "7-9": 5636}
TOTAL = sum(COMPTES.values())

#: Les sections de l'OCR d'elkmovie, par niveau (« 七一九 » est le « 七—九 » de la norme lu par l'OCR).
SECTIONS_ELKMOVIE: dict[str, str] = {
    "一级词汇表": "1",
    "二级词汇表": "2",
    "三级词汇表": "3",
    "四级词汇表": "4",
    "五级词汇表": "5",
    "六级词汇表": "6",
    "七一九级词汇表": "7-9",
}

#: Les colonnes de `hsk-mots.tsv`, dans l'ordre.
COLONNES: tuple[str, ...] = (
    "id",
    "forme",
    "pinyin",
    "syllabes",
    "syllabes_pleines",
    "niveau",
    "categorie",
    "variantes",
    "exemple",
    "officiel",
    "pinyin_officiel",
)

#: 〇 n'est pas dans un bloc de sinogrammes unifiés : sa lecture est celle de 零.
LECTURES_HORS_BLOC: dict[str, tuple[str, ...]] = {"〇": ("líng",)}

_LETTRES = set("abcdefghijklmnopqrstuvwxyzü") | set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ")
_TONS = {
    **{c: 1 for c in "āēīōūǖ"},
    **{c: 2 for c in "áéíóúǘ"},
    **{c: 3 for c in "ǎěǐǒǔǚ"},
    **{c: 4 for c in "àèìòùǜ"},
}


class ListeInvalide(ValueError):
    """Une source ou la liste versionnée ne se lit pas."""


# ---------------------------------------------------------------------- les formes


@dataclass(frozen=True)
class Forme:
    """Une graphie d'une entrée : ses sinogrammes, son pinyin retenu, ses syllabes numérotées.

    `pleines` : les syllabes au ton plein quand le pinyin retenu en neutralise une (`·`,
    mot de position) ; vide sinon.
    """

    hanzi: str
    pinyin: str
    syllabes: tuple[str, ...]
    pleines: tuple[str, ...] = ()


@dataclass(frozen=True)
class Mot:
    """Une entrée de la liste : une forme principale, ses variantes, son exemple de forme.

    `exemple` : pour une entrée qui cite un emploi (第（第二）, 们（朋友们）), cet emploi ;
    le mot, lui, est 第. `officiel` et `pinyin_officiel` recopient l'entrée telle que la
    norme et le site officiel l'écrivent (白（形）, zhī·dào, bú kèqì).
    """

    id: str
    forme: Forme
    niveau: str
    categorie: tuple[str, ...]
    variantes: tuple[Forme, ...] = ()
    exemple: Forme | None = None
    officiel: str = ""
    pinyin_officiel: str = ""

    @property
    def formes(self) -> tuple[Forme, ...]:
        return (self.forme, *self.variantes)


# ------------------------------------------------------------------- lire ivankra


def lire_ivankra(texte: str) -> list[dict[str, str]]:
    """Les lignes de `hsk30.csv`, réduites aux colonnes de `COLONNES_LUES`.

    Les autres colonnes ne sont jamais copiées : ni `CEDICT`, ni `Variants`.
    """
    lecteur = csv.reader(io.StringIO(texte))
    try:
        entete = next(lecteur)
    except StopIteration as erreur:
        raise ListeInvalide("hsk30.csv vide") from erreur
    manquent = [c for c in COLONNES_LUES if c not in entete]
    if manquent:
        raise ListeInvalide(f"hsk30.csv : colonnes absentes {' '.join(manquent)}")
    rangs = {c: entete.index(c) for c in COLONNES_LUES}
    lignes: list[dict[str, str]] = []
    for brute in lecteur:
        if not brute:
            continue
        lignes.append({c: brute[i].strip() if i < len(brute) else "" for c, i in rangs.items()})
    return lignes


def lire_elkmovie(texte: str) -> dict[str, list[str]]:
    """L'OCR d'elkmovie, par niveau : les entrées telles qu'imprimées (白（形）, 爸爸｜爸)."""
    niveaux: dict[str, list[str]] = {}
    courant: str | None = None
    for brute in texte.splitlines():
        ligne = brute.strip()
        if not ligne or ligne.startswith("#"):
            continue
        if ligne in SECTIONS_ELKMOVIE:
            courant = SECTIONS_ELKMOVIE[ligne]
            niveaux.setdefault(courant, [])
            continue
        if courant is None:
            continue
        numero, _, entree = ligne.partition(" ")
        niveaux[courant].append(entree.strip() if numero.isdigit() else ligne)
    return niveaux


# ----------------------------------------------------------------- le pinyin, lu


def _lettres(texte: str) -> tuple[str, list[int]]:
    """Les lettres de pinyin d'un texte, en minuscules, et leur position dans le texte."""
    lettres: list[str] = []
    positions: list[int] = []
    for i, c in enumerate(texte):
        bas = c.lower()
        if bas in _LETTRES:
            lettres.append(bas)
            positions.append(i)
    return "".join(lettres), positions


def _signes(hanzi: str) -> list[str]:
    return [c for c in hanzi if est_sinogramme(c) or c in LECTURES_HORS_BLOC]


def numeroter(syllabe: str) -> str:
    """`hǎo` → `hao3`, `ba` → `ba5`, `nǚ` → `nv3`, `r` (érhua) → `r5`."""
    ton = next((_TONS[c] for c in syllabe if c in _TONS), 5)
    base = sans_ton(syllabe).replace("ü", "v")
    return f"{base}{ton}"


def decouper(
    hanzi: str, pinyin: str, lectures: Mapping[str, Sequence[str]]
) -> list[tuple[int, int]] | None:
    """Les bornes `(début, fin)` de la syllabe de chaque sinogramme dans les lettres du pinyin.

    Chaque syllabe doit être l'une des lectures du caractère, au ton plein ou neutre
    (`pinyin.lectures_admises`). `None` si le pinyin ne se lit pas ainsi : on ne devine pas.
    """
    signes = _signes(hanzi)
    cible, _ = _lettres(unicodedata.normalize("NFC", pinyin))
    memo: dict[tuple[int, int], tuple[tuple[int, int], ...] | None] = {}

    def depuis(i: int, j: int) -> tuple[tuple[int, int], ...] | None:
        if (i, j) in memo:
            return memo[(i, j)]
        if i == len(signes):
            resultat: tuple[tuple[int, int], ...] | None = () if j == len(cible) else None
        else:
            c = signes[i]
            connues = tuple(lectures.get(c, ())) or LECTURES_HORS_BLOC.get(c, ())
            resultat = None
            for forme in lectures_admises(c, tuple(x.lower() for x in connues)):
                if cible.startswith(forme, j):
                    suite = depuis(i + 1, j + len(forme))
                    if suite is not None:
                        resultat = ((j, j + len(forme)),) + suite
                        break
        memo[(i, j)] = resultat
        return resultat

    trouve = depuis(0, 0)
    return list(trouve) if trouve is not None else None


def syllabes_de(pinyin: str, bornes: Sequence[tuple[int, int]]) -> tuple[str, ...]:
    lettres, _ = _lettres(unicodedata.normalize("NFC", pinyin))
    return tuple(numeroter(lettres[a:b]) for a, b in bornes)


def points_medians(web: str) -> tuple[str, list[int]]:
    """Les lettres du pinyin officiel sans ton, et la position (dans ces lettres) de chaque `·`."""
    lettres: list[str] = []
    points: list[int] = []
    for c in unicodedata.normalize("NFC", web):
        if c == "·":
            points.append(len(lettres))
        elif c.lower() in _LETTRES:
            lettres.append(c.lower())
    return sans_ton("".join(lettres)), points


def neutraliser(pinyin: str, debut: int, fin: int) -> str:
    """Le pinyin où la syllabe `[debut, fin)` (en lettres) perd son ton."""
    texte = unicodedata.normalize("NFC", pinyin)
    _, positions = _lettres(texte)
    a, b = positions[debut], positions[fin - 1] + 1
    return texte[:a] + sans_ton(texte[a:b]) + texte[b:]


@dataclass
class Rapport:
    """Ce que la construction a tranché et ce qu'elle n'a pas su lire."""

    points: list[str] = field(default_factory=list)
    position: list[str] = field(default_factory=list)
    illisibles: list[str] = field(default_factory=list)


def forme_retenue(
    hanzi: str,
    pinyin: str,
    web: str,
    lectures: Mapping[str, Sequence[str]],
    rapport: Rapport,
) -> Forme:
    """Le pinyin retenu d'une graphie : `Pinyin` d'ivankra, `·` neutralisé, mots de position."""
    pinyin = unicodedata.normalize("NFC", pinyin)
    bornes = decouper(hanzi, pinyin, lectures)
    if bornes is None:
        rapport.illisibles.append(f"{hanzi} {pinyin}")
        return Forme(hanzi=hanzi, pinyin=pinyin, syllabes=())
    pleines = syllabes_de(pinyin, bornes)
    retenu = pinyin
    lettres_web, points = points_medians(web)
    if points:
        lettres, _ = _lettres(pinyin)
        departs = {a: (a, b) for a, b in bornes}
        if lettres_web == sans_ton(lettres) and all(p in departs for p in points):
            for p in points:
                retenu = neutraliser(retenu, *departs[p])
            rapport.points.append(f"{hanzi} {web} → {retenu}")
        else:
            rapport.illisibles.append(f"{hanzi} : `·` de « {web} » hors syllabe")
    if hanzi in MOTS_DE_POSITION:
        attendu = "".join(MOTS_DE_POSITION[hanzi])
        if pinyin != attendu:
            rapport.position.append(f"{hanzi} {pinyin} ({web}) → {attendu}")
        retenu = attendu
        bornes = decouper(hanzi, retenu, lectures) or bornes
    syllabes = syllabes_de(retenu, bornes)
    return Forme(
        hanzi=hanzi,
        pinyin=retenu,
        syllabes=syllabes,
        pleines=pleines if pleines != syllabes else (),
    )


# ------------------------------------------------------------------- les entrées


_PARENTHESES = re.compile(r"(.*?)（(.+)）(.*)")
_PARENTHESES_PY = re.compile(r"(.*?)\s*\((.+)\)\s*(.*)")


def deplier(hanzi: str, pinyin: str) -> tuple[list[tuple[str, str]], tuple[str, str] | None]:
    """Les graphies d'une entrée, la principale en tête, et son exemple de forme s'il y en a.

    - `爸爸|爸` : deux graphies ;
    - `第（第二）` : le mot 第, cité dans l'emploi 第二 (l'exemple contient le mot) ;
    - `有（一）些`, `茅台（酒）` : un élément facultatif, la forme courte d'abord ;
    - `…极了`, `称1` : les points de suspension et le numéro d'homographe tombent ;
    - `谁 shéi/shuí` : deux lectures, deux graphies de mêmes sinogrammes, la première en tête.
    """
    formes = hanzi.split("|")
    lectures = pinyin.split("|")
    if len(formes) != len(lectures):
        raise ListeInvalide(f"{hanzi} : {len(formes)} graphies pour {len(lectures)} pinyin")
    graphies: list[tuple[str, str]] = []
    exemple: tuple[str, str] | None = None
    for h, p in zip(formes, lectures):
        h = re.sub(r"[0-9¹²³]+", "", h.replace("…", "")).strip()
        p = p.replace("…", "").strip()
        m = _PARENTHESES.fullmatch(h)
        if m is None:
            graphies.append((h, p))
            continue
        mp = _PARENTHESES_PY.fullmatch(p)
        if mp is None:
            raise ListeInvalide(f"{hanzi} : parenthèse sans pendant dans « {pinyin} »")
        a, b, c = m.groups()
        pa, pb, pc = (x.strip() for x in mp.groups())
        if not c and a and a in b:
            graphies.append((a, pa))
            exemple = (b, pb)
        else:
            graphies.append((a + c, pa + pc))
            graphies.append((a + b + c, pa + pb + pc))
    graphies = [(h, x.strip()) for h, p in graphies for x in p.split("/")]
    return graphies, exemple


def construire(
    lignes: Iterable[Mapping[str, str]], lectures: Mapping[str, Sequence[str]]
) -> tuple[list[Mot], Rapport]:
    """Les entrées de la liste, dans l'ordre d'ivankra (niveau, puis ordre de la norme)."""
    rapport = Rapport()
    mots: list[Mot] = []
    for ligne in lignes:
        graphies, exemple = deplier(ligne["Simplified"], ligne["Pinyin"])
        webs, _ = deplier(ligne["Simplified"], ligne["WebPinyin"])
        formes = [
            forme_retenue(h, p, web, lectures, rapport)
            for (h, p), (_, web) in zip(graphies, webs)
        ]
        ex = forme_retenue(exemple[0], exemple[1], exemple[1], lectures, rapport) if exemple else None
        mots.append(
            Mot(
                id=ligne["ID"],
                forme=formes[0],
                niveau=ligne["Level"],
                categorie=tuple(x for x in ligne["POS"].split("/") if x),
                variantes=tuple(formes[1:]),
                exemple=ex,
                officiel=ligne["OCR"],
                pinyin_officiel=ligne["WebPinyin"],
            )
        )
    return mots, rapport


# ---------------------------------------------------------------- la liste versionnée


def _forme_tsv(f: Forme) -> str:
    return f"{f.hanzi}:{f.pinyin}:{' '.join(f.syllabes)}"


def _lire_forme(texte: str) -> Forme:
    hanzi, pinyin, syllabes = texte.split(":")
    return Forme(hanzi=hanzi, pinyin=pinyin, syllabes=tuple(syllabes.split()))


def ligne_tsv(m: Mot) -> str:
    valeurs = [
        m.id,
        m.forme.hanzi,
        m.forme.pinyin,
        " ".join(m.forme.syllabes),
        " ".join(m.forme.pleines),
        m.niveau,
        "/".join(m.categorie),
        ";".join(_forme_tsv(v) for v in m.variantes),
        _forme_tsv(m.exemple) if m.exemple else "",
        m.officiel,
        m.pinyin_officiel,
    ]
    if any("\t" in v or "\n" in v for v in valeurs):
        raise ListeInvalide(f"{m.id} : tabulation ou saut de ligne dans une valeur")
    return "\t".join(valeurs)


def en_tete(
    *,
    empreinte_ivankra: str,
    empreinte_elkmovie: str | None,
    releve: str,
    rapport: Rapport,
) -> list[str]:
    """L'en-tête de traçabilité, sur le modèle des listes de caractères."""
    comptes = ", ".join(f"HSK {n} : {COMPTES[n]}" for n in NIVEAUX)
    lignes = [
        "HSK 3.0 — 词汇表 (mots de niveaux 1 à 7-9)",
        "",
        "Référentiel : 《国际中文教育中文水平等级标准》 GF 0025-2021, ministère de",
        "  l'Éducation de la RPC et Commission nationale de la langue, applicable au",
        f"  1er juillet 2026. {TOTAL} entrées, les seuls mots nouveaux de chaque niveau :",
        f"  {comptes}.",
        "Source officielle : http://www.moe.gov.cn/jyb_sjzl/ziliao/A19/202111/W020211118507389477190.pdf",
        "  (PDF scanné, sans couche texte ; domaine inaccessible depuis l'environnement",
        "  de développement)",
        "",
        f"Transcriptions utilisées, relevées le {releve} :",
        f"  1. {URL_IVANKRA}",
        "     (source : ID, Simplified, Pinyin, POS, Level, WebPinyin, OCR ; les colonnes",
        "     CEDICT et Variants ne sont jamais lues)",
        f"     licence {LICENCE_IVANKRA}",
        f"     texte de la licence : data/sources/licences/{TEXTE_LICENCE}",
        f"     sha256 {empreinte_ivankra}",
        f"  2. {URL_ELKMOVIE}",
        "     (contrôle : l'OCR de Pleco du PDF officiel, relu entrée par entrée contre la",
        "     colonne `officiel` par `wenlu check`)",
        f"     licence {LICENCE_ELKMOVIE}",
        f"     sha256 {empreinte_elkmovie or '— (absent au relevé)'}",
        "Le README d'ivankra/hsk30 note que ses données dérivent d'elkmovie/hsk30 et du site",
        "  officiel chinesetest.cn (shawkynasr/HSK-official-Query-System) ; le référentiel,",
        "  œuvre du gouvernement de la RPC, relève peut-être du domaine public. On reprend",
        "  la table (mot, niveau, pinyin, catégorie), jamais le document.",
        "",
        "Écrit par `uv run wenlu listes mots` ; ne pas modifier à la main.",
        "",
        "Colonnes :",
        "  id               l'identifiant d'ivankra : L<niveau>-<rang dans la table du niveau>",
        "  forme            la graphie principale, en sinogrammes seuls (…, ¹, （） ôtés)",
        "  pinyin           le pinyin retenu, sans sandhi (一 yī, 不 bù)",
        "  syllabes         le même, une syllabe numérotée par sinogramme (ai4 hao4 ; ü : v ;",
        "                   5 : ton neutre ; r5 : le 儿 de l'érhua)",
        "  syllabes_pleines les syllabes au ton plein quand `pinyin` en neutralise une, sinon vide",
        "  niveau           1 à 6, ou 7-9",
        "  categorie        catégorie(s) grammaticale(s) du site officiel, séparées par / :",
        "                   N nom, V verbe, Adj adjectif, Adv adverbe, M classificateur,",
        "                   Num numéral, Pron pronom, Prep préposition, Conj conjonction,",
        "                   Aux particule, Intj interjection, Prefix préfixe, Suffix suffixe,",
        "                   Phonetic onomatopée ; vide quand le site n'en donne pas",
        "  variantes        les autres graphies, `forme:pinyin:syllabes` séparées par ;",
        "  exemple          l'emploi que la norme cite (第（第二） → 第二), même format",
        "  officiel         l'entrée telle que la norme l'imprime (白（形）, 称¹（动）)",
        "  pinyin_officiel  le pinyin du site officiel, tel quel (∥, ·, sandhi)",
        "",
        "Règles de pinyin (data/schema.md, « Liste des mots HSK 3.0 ») :",
        "  · : la syllabe au ton neutre facultatif du site officiel s'écrit au ton neutre",
        f"      ({len(rapport.points)} entrées) ; sa lecture pleine reste dans syllabes_pleines.",
        "  mots de position : la décision du propriétaire du 26 septembre 2026",
        f"      (pinyin.MOTS_DE_POSITION) l'emporte ; {len(rapport.position)} entrées diffèrent de",
        "      la colonne Pinyin : " + " ".join(p.split(" ")[0] for p in rapport.position) + ".",
        "",
        "Ordre : celui de la norme, niveau par niveau.",
    ]
    return ["# " + x if x else "#" for x in lignes]


def ecrire(mots: Sequence[Mot], entete: Sequence[str], chemin: Path | None = None) -> Path:
    chemin = chemin or LISTE
    corps = ["\t".join(COLONNES), *(ligne_tsv(m) for m in mots)]
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text("\n".join([*entete, *corps]) + "\n", encoding="utf-8")
    return chemin


def parse(texte: str) -> list[Mot]:
    """Relit `hsk-mots.tsv`. Refuse une ligne d'en-tête différente de `COLONNES`."""
    lignes = [x for x in texte.splitlines() if x and not x.startswith("#")]
    if not lignes:
        raise ListeInvalide("hsk-mots.tsv vide")
    if tuple(lignes[0].split("\t")) != COLONNES:
        raise ListeInvalide(f"hsk-mots.tsv : colonnes {lignes[0]!r}, attendu {' '.join(COLONNES)}")
    mots: list[Mot] = []
    for brute in lignes[1:]:
        v = dict(zip(COLONNES, brute.split("\t")))
        if len(v) != len(COLONNES):
            raise ListeInvalide(f"hsk-mots.tsv : ligne incomplète {brute!r}")
        mots.append(
            Mot(
                id=v["id"],
                forme=Forme(
                    hanzi=v["forme"],
                    pinyin=v["pinyin"],
                    syllabes=tuple(v["syllabes"].split()),
                    pleines=tuple(v["syllabes_pleines"].split()),
                ),
                niveau=v["niveau"],
                categorie=tuple(x for x in v["categorie"].split("/") if x),
                variantes=tuple(_lire_forme(x) for x in v["variantes"].split(";") if x),
                exemple=_lire_forme(v["exemple"]) if v["exemple"] else None,
                officiel=v["officiel"],
                pinyin_officiel=v["pinyin_officiel"],
            )
        )
    return mots


def charger(chemin: Path | None = None) -> list[Mot]:
    """La liste versionnée ; vide si le fichier n'existe pas."""
    chemin = chemin or LISTE
    if not chemin.exists():
        return []
    return parse(chemin.read_text(encoding="utf-8"))


def date_de_releve(chemin: Path, empreinte: str) -> str | None:
    """La date de relevé de la liste déjà écrite, si elle vient de la même source."""
    if not chemin.exists():
        return None
    texte = chemin.read_text(encoding="utf-8")
    if f"sha256 {empreinte}" not in texte:
        return None
    m = re.search(r"relevées le (\d{4}-\d{2}-\d{2})", texte)
    return m.group(1) if m else None


def lectures_du_pipeline(ingest: Path | None = None) -> dict[str, list[str]]:
    """Les lectures de chaque caractère : les surcharges d'abord, puis Unihan (tous champs)."""
    import json

    from . import surcharges as surcharges_mod

    document = json.loads(((ingest or INGEST) / "unihan.json").read_text(encoding="utf-8"))
    lues: dict[str, list[str]] = {c: list(x) for c, x in surcharges_mod.charger_pinyin().items()}
    for e in document["caracteres"]:
        c = str(e["c"])
        brutes = [e.get("pinyin") or "", *(e.get("lectures") or ()), *(e.get("lectures_dico") or ())]
        for x in brutes:
            lue = unicodedata.normalize("NFC", str(x))
            if lue and lue not in lues.setdefault(c, []):
                lues[c].append(lue)
    return lues


def generer(
    *,
    sources: Path | None = None,
    ingest: Path | None = None,
    sortie: Path | None = None,
    moment: datetime | None = None,
) -> dict[str, object]:
    """`wenlu listes mots` : écrit `hsk-mots.tsv` depuis les sources téléchargées."""
    sources = sources or SOURCES
    sortie = sortie or LISTE
    csv_ivankra = sources / FICHIER_IVANKRA
    ocr = sources / FICHIER_ELKMOVIE
    if not csv_ivankra.exists():
        raise FileNotFoundError(f"{csv_ivankra} absent")
    lignes = lire_ivankra(csv_ivankra.read_text(encoding="utf-8"))
    mots, rapport = construire(lignes, lectures_du_pipeline(ingest))
    empreinte = empreinte_fichier(csv_ivankra)
    releve = date_de_releve(sortie, empreinte) or (moment or datetime.now(UTC)).strftime("%Y-%m-%d")
    entete = en_tete(
        empreinte_ivankra=empreinte,
        empreinte_elkmovie=empreinte_fichier(ocr) if ocr.exists() else None,
        releve=releve,
        rapport=rapport,
    )
    ecrire(mots, entete, sortie)
    return {
        "entrees": len(mots),
        "points_neutralises": len(rapport.points),
        "mots_de_position": len(rapport.position),
        "illisibles": len(rapport.illisibles),
        "liste": str(sortie),
    }


# ------------------------------------------------------------------------ contrôles


def sinogrammes(m: Mot) -> set[str]:
    """Les sinogrammes d'une entrée : ceux de ses graphies et de son exemple."""
    textes = [f.hanzi for f in m.formes] + ([m.exemple.hanzi] if m.exemple else [])
    return {c for t in textes for c in t if est_sinogramme(c)}


def ecarts_de_comptes(mots: Sequence[Mot]) -> list[str]:
    vus: dict[str, int] = {}
    for m in mots:
        vus[m.niveau] = vus.get(m.niveau, 0) + 1
    ecarts = [f"HSK {n} : {vus.get(n, 0)} au lieu de {COMPTES[n]}" for n in NIVEAUX if vus.get(n, 0) != COMPTES[n]]
    ecarts += [f"niveau inconnu {n!r}" for n in vus if n not in COMPTES]
    ids = [m.id for m in mots]
    if len(set(ids)) != len(ids):
        ecarts.append("identifiants en double")
    return ecarts


def ecarts_de_concordance(mots: Sequence[Mot], ocr: Mapping[str, Sequence[str]]) -> list[str]:
    """Chaque entrée, niveau par niveau, doit être celle de l'OCR d'elkmovie, dans le même ordre."""
    ecarts: list[str] = []
    for n in NIVEAUX:
        nos = [m.officiel for m in mots if m.niveau == n]
        leurs = list(ocr.get(n, ()))
        if len(nos) != len(leurs):
            ecarts.append(f"HSK {n} : {len(nos)} entrées, {len(leurs)} dans l'OCR")
        for i, (a, b) in enumerate(zip(nos, leurs)):
            if a != b:
                ecarts.append(f"HSK {n} n° {i + 1} : {a} ≠ {b}")
    return ecarts


def ecarts_de_pinyin(mots: Sequence[Mot], lectures: Mapping[str, Sequence[str]] | None) -> tuple[list[str], list[str]]:
    """(fautes, illisibles). Fautes : une syllabe par sinogramme, mots de position, `·`.

    Illisibles (signalés) : une syllabe qui n'est aucune lecture connue du caractère.
    """
    fautes: list[str] = []
    illisibles: list[str] = []
    for m in mots:
        formes = [*m.formes, *([m.exemple] if m.exemple else [])]
        for f in formes:
            if len(f.syllabes) != len(_signes(f.hanzi)):
                fautes.append(f"{m.id} {f.hanzi} : {len(f.syllabes)} syllabes")
                continue
            if f.hanzi in MOTS_DE_POSITION and f.pinyin != "".join(MOTS_DE_POSITION[f.hanzi]):
                fautes.append(f"{m.id} {f.hanzi} : {f.pinyin}, mot de position")
            if lectures is not None:
                bornes = decouper(f.hanzi, f.pinyin, lectures)
                if bornes is None:
                    illisibles.append(f"{f.hanzi} {f.pinyin}")
                elif syllabes_de(f.pinyin, bornes) != f.syllabes:
                    fautes.append(f"{m.id} {f.hanzi} : syllabes {' '.join(f.syllabes)} ≠ {f.pinyin}")
        if "·" in m.pinyin_officiel and not any(x.endswith("5") for x in m.forme.syllabes):
            fautes.append(f"{m.id} {m.forme.hanzi} : `·` sans syllabe au ton neutre")
    return fautes, sorted(set(illisibles))


def controles(
    chemin: Path | None = None,
    *,
    listes: Path | None = None,
    sources: Path | None = None,
    ingest: Path | None = None,
) -> list[Controle]:
    """Contrôles de la liste des mots, pour `wenlu check`."""
    from .ingest import charger_listes

    chemin = chemin or LISTE
    if not chemin.exists():
        return [Controle("mots HSK : liste", False, f"{chemin} absent : lancer `wenlu listes mots`", bloquant=True)]
    texte = chemin.read_text(encoding="utf-8")
    try:
        mots = parse(texte)
    except ListeInvalide as erreur:
        return [Controle("mots HSK : liste", False, str(erreur), bloquant=True)]

    comptes = ecarts_de_comptes(mots)
    entete = next((x for x in texte.splitlines() if not x.startswith("#")), "")
    interdites = [c for c in COLONNES_INTERDITES if c in entete.split("\t") or c in COLONNES_LUES]
    cles = [m.id for m in mots if any(re.search(r"\[[a-z:]+[1-5]( [a-z:]+[1-5])*\]", v) for v in (m.officiel, m.pinyin_officiel))]

    tous = {c for nom, liste in charger_listes(listes).items() if nom.startswith("hsk-") for c in liste}
    hors = sorted({c for m in mots for c in sinogrammes(m)} - tous)
    utilises = {c for m in mots for c in sinogrammes(m)}

    sources = sources or SOURCES
    ocr = sources / FICHIER_ELKMOVIE
    concordance: Controle
    if ocr.exists():
        ecarts = ecarts_de_concordance(mots, lire_elkmovie(ocr.read_text(encoding="utf-8")))
        concordance = Controle(
            "mots HSK : concordance avec l'OCR",
            not ecarts,
            f"les {len(mots)} entrées sont celles de l'OCR d'elkmovie/hsk30, niveau par niveau et dans l'ordre"
            if not ecarts
            else f"{len(ecarts)} écarts — " + " ; ".join(ecarts[:5]),
            bloquant=True,
        )
    else:
        concordance = Controle(
            "mots HSK : concordance avec l'OCR", True, f"{ocr.name} absent : lancer `wenlu fetch` pour relire"
        )
    source = sources / FICHIER_IVANKRA
    trace = (
        Controle(
            "mots HSK : source",
            f"sha256 {empreinte_fichier(source)}" in texte,
            "la liste cite l'empreinte du hsk30.csv téléchargé"
            if f"sha256 {empreinte_fichier(source)}" in texte
            else "hsk30.csv a changé depuis le relevé : relancer `wenlu listes mots` et relire le diff",
        )
        if source.exists()
        else Controle("mots HSK : source", True, "hsk30.csv absent : la liste versionnée fait foi")
    )

    unihan = (ingest or INGEST) / "unihan.json"
    lectures = lectures_du_pipeline(ingest) if unihan.exists() else None
    fautes, illisibles = ecarts_de_pinyin(mots, lectures)
    neutres = sum(1 for m in mots if m.forme.pleines)

    return [
        Controle(
            "mots HSK : comptes",
            not comptes,
            f"{len(mots)} entrées : " + ", ".join(f"HSK {n} {COMPTES[n]}" for n in NIVEAUX)
            if not comptes
            else " ; ".join(comptes),
            bloquant=True,
        ),
        Controle(
            "mots HSK : sans CC-CEDICT",
            not interdites and not cles,
            "ni colonne CEDICT ni Variants lues, aucune clé CC-CEDICT dans la liste"
            if not interdites and not cles
            else f"colonnes {' '.join(interdites)} ; clés dans {' '.join(cles[:5])}",
            bloquant=True,
        ),
        Controle(
            "mots HSK : caractères",
            not hors,
            f"les {len(utilises)} sinogrammes des mots sont tous dans la liste des 3 000"
            if not hors
            else f"{len(hors)} hors des 3 000 : {' '.join(hors[:20])}",
            bloquant=True,
        ),
        concordance,
        trace,
        Controle(
            "mots HSK : pinyin",
            not fautes,
            f"une syllabe numérotée par sinogramme, mots de position et `·` tranchés ({neutres} entrées"
            " gardent leur lecture pleine)"
            if not fautes
            else f"{len(fautes)} fautes — " + " ; ".join(fautes[:5]),
            bloquant=True,
        ),
        Controle(
            "mots HSK : lectures",
            not illisibles,
            "chaque syllabe est une lecture connue de son caractère (Unihan, surcharges)"
            if not illisibles
            else f"{len(illisibles)} graphies dont une syllabe n'est aucune lecture connue : {' ; '.join(illisibles[:8])}",
        ),
    ]
