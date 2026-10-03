"""Fait dire à Kokoro des caractères isolés et des mots HSK de deux syllabes, pour le classifieur
des tons de « Dis-le » (voir `PROVENANCE.md`, « Les voix synthétiques du continent »).

Les voix de Taïwan apprennent au modèle les tons de citation ; les phrases de FLEURS lui ont
fait perdre le ton 3 de citation (un 21 bref dans une phrase). Il faut des voix du continent
qui disent des syllabes et des mots isolés : Kokoro (`hexgrad/Kokoro-82M-v1.1-zh`, Apache 2.0,
déjà dans le pipeline, `wenlu_data/audio.py`) en a une centaine. Ses sorties sont produites
chez nous ; nous ne redistribuons ni son code ni ses poids, et aucun son n'est versionné.

Trois temps :

1. `textes` (sur le poste, une fois) : ce que Kokoro dira, versionné dans `kokoro-textes.json`.
   Le pinyin vient du dépôt seulement, jamais de CC-CEDICT : les caractères des listes HSK 3.0
   (`hsk-*.txt`) qui n'ont qu'une lecture pleine (la liste des mots HSK et la lecture courante
   du dépôt, `fleurs.Lexique.lectures`) ; les mots de deux caractères de la liste HSK
   (`hsk-mots.tsv`), étiquetés par les règles de `fleurs.py` (`lire_groupe`, `surface`) : 3-3
   lu 2-3, 不 et 一 selon le ton qui suit, le neutre de la liste ; un mot dont une syllabe reste
   sans étiquette (姐姐) est écarté.
2. `generer` (dans le workflow `donnees`, étape `tons-voix`, le seul endroit qui atteint
   Hugging Face) : chaque texte est passé à Kokoro **en phonèmes**, jamais en caractères
   (`KPipeline.generate_from_tokens`) : Kokoro ne choisit ni la lecture ni le sandhi, il dit
   le ton étiqueté. Les phonèmes sont ceux que le G2P de Kokoro v1.1 (`misaki.zh_frontend`)
   écrirait pour ce pinyin : l'initiale et la finale en zhuyin (`ZH_MAP`), le ton en chiffre
   (5 : neutre), les syllabes d'un mot accolées. Une vitesse et une fin (rien, ou un point)
   tirées pour chaque texte. WAV dans `data/work/tons/voix/`, jamais versionnés.
3. `app/scripts/tons/voix.ts` : les caractéristiques, avec le code même de l'app, dans
   `data/sources/tons/voix-kokoro/<voix>.json` (branche `donnees/tons-voix`).

`zf_001`, la voix de l'app, n'entre jamais à l'entraînement : elle sert de test.

    cd data && uv run python sources/tons/kokoro.py textes          # le poste, après `wenlu tout`
    cd data && uv run python sources/tons/kokoro.py plan --groupes 6 # la matrice du workflow
    cd data && uv run python sources/tons/kokoro.py generer --voix zf_002,zm_009
"""
from __future__ import annotations

import hashlib
import json
import random
import sys
import wave
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parent
DATA = ICI.parents[1]
TEXTES = ICI / "kokoro-textes.json"
TRAVAIL = DATA / "work" / "tons" / "voix"

MODELE = "hexgrad/Kokoro-82M-v1.1-zh"
#: La voix de l'app (`audio.VOIX_LOCALE_DEFAUT`) : le test, jamais l'entraînement.
VOIX_TEST = "zf_001"
#: Les voix d'entraînement : 12 femmes et 12 hommes, pris à pas réguliers dans les 54 voix
#: féminines (hors `zf_001`) et les 45 masculines que `wenlu audio voix` listait le
#: 1er octobre 2026 (run 36828057670 du workflow `donnees`).
VOIX_ENTRAINEMENT = (
    "zf_002", "zf_006", "zf_018", "zf_023", "zf_028", "zf_039",
    "zf_044", "zf_049", "zf_070", "zf_076", "zf_085", "zf_093",
    "zm_009", "zm_013", "zm_020", "zm_031", "zm_037", "zm_052",
    "zm_056", "zm_062", "zm_066", "zm_081", "zm_095", "zm_100",
)
VOIX_DEFAUT = (VOIX_TEST, *VOIX_ENTRAINEMENT)

#: Ce que chaque voix dit : tant de caractères par ton (1 à 4), tant de mots de deux syllabes.
CARACTERES_PAR_TON = 100
MOTS_PAR_VOIX = 400
#: Les vitesses de Kokoro (`speed`) et les fins de texte, tirées pour chaque texte.
VITESSES = (0.8, 0.9, 1.0, 1.1, 1.2)
FINS = ("", ".")

LISTES_CARACTERES = ("hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9")

# ----------------------------------------------------------------------------- phonèmes
#
# Les symboles du G2P de Kokoro v1.1 (`misaki/zh_frontend.py`, `ZH_MAP`, misaki 0.9.4) : une
# initiale, une finale « stricte » de pypinyin (sans y ni w, ü noté v, i de zi et de zhi notés
# ii et iii), puis le ton en chiffre.

INITIALES = {
    "b": "ㄅ", "p": "ㄆ", "m": "ㄇ", "f": "ㄈ", "d": "ㄉ", "t": "ㄊ", "n": "ㄋ", "l": "ㄌ",
    "g": "ㄍ", "k": "ㄎ", "h": "ㄏ", "j": "ㄐ", "q": "ㄑ", "x": "ㄒ", "zh": "ㄓ", "ch": "ㄔ",
    "sh": "ㄕ", "r": "ㄖ", "z": "ㄗ", "c": "ㄘ", "s": "ㄙ",
}
FINALES = {
    "a": "ㄚ", "o": "ㄛ", "e": "ㄜ", "ie": "ㄝ", "ai": "ㄞ", "ei": "ㄟ", "ao": "ㄠ", "ou": "ㄡ",
    "an": "ㄢ", "en": "ㄣ", "ang": "ㄤ", "eng": "ㄥ", "er": "ㄦ", "i": "ㄧ", "u": "ㄨ", "v": "ㄩ",
    "ii": "ㄭ", "iii": "十", "ve": "月", "ia": "压", "ian": "言", "iang": "阳", "iao": "要",
    "in": "阴", "ing": "应", "iong": "用", "iou": "又", "ong": "中", "ua": "穵", "uai": "外",
    "uan": "万", "uang": "王", "uei": "为", "uen": "文", "ueng": "瓮", "uo": "我", "van": "元",
    "vn": "云",
}
#: Les syllabes sans initiale écrites avec y ou w, et leur finale stricte.
SANS_INITIALE = {
    "yi": "i", "ya": "ia", "yao": "iao", "ye": "ie", "you": "iou", "yan": "ian", "yin": "in",
    "yang": "iang", "ying": "ing", "yong": "iong", "yo": "o", "yu": "v", "yue": "ve", "yuan": "van",
    "yun": "vn", "wu": "u", "wa": "ua", "wo": "uo", "wai": "uai", "wei": "uei", "wan": "uan",
    "wen": "uen", "wang": "uang", "weng": "ueng",
}


class PinyinIllisible(ValueError):
    """Une syllabe que le G2P de Kokoro ne saurait pas écrire (m, n, ng, ê…)."""


def decouper(syllabe: str) -> tuple[str, str, int]:
    """`zhong1` → (`zh`, `ong`, 1) ; `yue4` → (``, `ve`, 4) ; `lv3` → (`l`, `v`, 3)."""
    s = syllabe.lower().replace("ü", "v").replace("u:", "v")
    if not s or not s[-1].isdigit() or not 1 <= int(s[-1]) <= 5:
        raise PinyinIllisible(f"{syllabe!r} : ton absent")
    ton, s = int(s[-1]), s[:-1]
    if s in SANS_INITIALE:
        return "", SANS_INITIALE[s], ton
    initiale = next((i for i in ("zh", "ch", "sh") if s.startswith(i)), s[:1])
    if initiale not in INITIALES:
        if s in FINALES:  # a, e, er, ou, an…
            return "", s, ton
        raise PinyinIllisible(f"{syllabe!r} : initiale inconnue")
    finale = s[len(initiale):]
    if initiale in ("j", "q", "x") and finale.startswith("u"):
        finale = "v" + finale[1:]
    finale = {"iu": "iou", "ui": "uei", "un": "uen"}.get(finale, finale)
    if finale == "i" and initiale in ("z", "c", "s"):
        finale = "ii"
    elif finale == "i" and initiale in ("zh", "ch", "sh", "r"):
        finale = "iii"
    if finale not in FINALES:
        raise PinyinIllisible(f"{syllabe!r} : finale {finale!r} inconnue")
    return initiale, finale, ton


def phonemes(syllabe: str) -> str:
    """Les phonèmes Kokoro v1.1 d'une syllabe numérotée : `shi4` → `ㄕ十4`."""
    initiale, finale, ton = decouper(syllabe)
    return INITIALES.get(initiale, "") + FINALES[finale] + str(ton)


def phonemes_mot(syllabes: list[str] | tuple[str, ...]) -> str:
    """Les syllabes d'un mot accolées, comme le G2P écrit un mot (`我们` → `我3ㄇㄣ5`)."""
    return "".join(phonemes(s) for s in syllabes)


def avec_ton(syllabe: str, ton: int) -> str:
    """La syllabe numérotée au ton donné : `bu4`, 2 → `bu2`."""
    return syllabe[:-1] + str(ton)


# ------------------------------------------------------------------------------- textes


def _fleurs():
    sys.path.insert(0, str(ICI))
    import fleurs  # noqa: E402  (la recette voisine, mêmes règles d'étiquetage)

    return fleurs


def lecture_unique(c: str, lex) -> str | None:
    """La seule lecture pleine d'un caractère hors d'un mot, ou `None` s'il en a plusieurs."""
    pleines = {x for x in lex.lectures(c) if x[-1] in "1234"}
    if len(pleines) != 1:
        return None
    lecture = pleines.pop()
    try:
        decouper(lecture)
    except PinyinIllisible:
        return None
    return lecture


def etiqueter_mot(mot: str, lex, fleurs) -> list[str] | None:
    """Les syllabes d'un mot de la liste HSK au ton que la voix fait, ou `None` si une syllabe
    reste sans étiquette (les règles de `fleurs.surface`, le mot dit seul)."""
    if lex.decouper(mot) != [(0, len(mot))]:
        return None
    syl = fleurs.lire_groupe(mot, lex)
    if syl is None or len(syl) != len(mot):
        return None
    fleurs.surface(syl)
    if any(s["py"] is None or s["ton"] is None for s in syl):
        return None
    out = [avec_ton(s["py"], s["ton"]) for s in syl]
    try:
        phonemes_mot(out)
    except PinyinIllisible:
        return None
    return out


def construire(lex, caracteres: list[str], fleurs) -> dict:
    """Les textes : chaque caractère à lecture unique, chaque mot HSK de deux syllabes étiqueté."""
    vus: set[str] = set()
    car = []
    for c in caracteres:
        if c in vus:
            continue
        vus.add(c)
        lecture = lecture_unique(c, lex)
        if lecture:
            car.append({"texte": c, "syl": [lecture], "tons": [int(lecture[-1])], "ps": phonemes(lecture)})
    mots = []
    for w in sorted(lex.mots):
        if len(w) != 2:
            continue
        syl = etiqueter_mot(w, lex, fleurs)
        if syl and syl[0][-1] != "5":
            mots.append({"texte": w, "syl": syl, "tons": [int(s[-1]) for s in syl], "ps": phonemes_mot(syl)})
    return {"modele": MODELE, "caracteres": car, "mots": mots}


def textes() -> None:
    fleurs = _fleurs()
    from wenlu_data.coquilles import charger_liste

    lex = fleurs.Lexique()
    caracteres = [c for nom in LISTES_CARACTERES for c in charger_liste(nom)]
    doc = construire(lex, caracteres, fleurs)
    TEXTES.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(doc['caracteres'])} caractères, {len(doc['mots'])} mots ; {TEXTES.name}")
    print("tons des caractères :", sorted(Counter(t["tons"][0] for t in doc["caracteres"]).items()))
    print("tons des mots :", sorted(Counter(tuple(t["tons"]) for t in doc["mots"]).items()))


# --------------------------------------------------------------------------------- plan


def graine(voix: str) -> int:
    return int(hashlib.sha256(voix.encode()).hexdigest()[:12], 16)


def plan(doc: dict, voix: str) -> list[dict]:
    """Ce qu'une voix dit : `CARACTERES_PAR_TON` caractères de chaque ton, `MOTS_PAR_VOIX` mots
    tirés en équilibrant les paires de tons ; une vitesse et une fin pour chacun. Le tirage ne
    dépend que du nom de la voix : relancer une voix redonne les mêmes textes."""
    rng = random.Random(graine(voix))
    out = []
    for ton in (1, 2, 3, 4):
        pris = [t for t in doc["caracteres"] if t["tons"][0] == ton]
        out += [dict(t, genre="c") for t in rng.sample(pris, min(CARACTERES_PAR_TON, len(pris)))]
    paires: dict[tuple[int, ...], list[dict]] = {}
    for t in doc["mots"]:
        paires.setdefault(tuple(t["tons"]), []).append(t)
    cles = sorted(paires)
    for v in paires.values():
        rng.shuffle(v)
    mots, k = [], 0
    while len(mots) < MOTS_PAR_VOIX and any(paires.values()):
        v = paires[cles[k % len(cles)]]
        if v:
            mots.append(dict(v.pop(), genre="m"))
        k += 1
    out += mots
    for i, t in enumerate(out):
        t["id"] = f"{voix}/{t['genre']}/{t['texte']}"
        t["vitesse"] = rng.choice(VITESSES)
        t["fin"] = rng.choice(FINS)
    return out


def groupes(voix: tuple[str, ...], n: int) -> list[list[str]]:
    """Les voix réparties en `n` lots (la matrice du workflow), la voix de test dans le premier."""
    lots: list[list[str]] = [[] for _ in range(max(1, min(n, len(voix))))]
    for i, v in enumerate(voix):
        lots[i % len(lots)].append(v)
    return lots


# ------------------------------------------------------------------------------ synthèse


def ecrire_wav(chemin: Path, echantillons, sr: int) -> None:
    from array import array

    pcm = array("h", (max(-32768, min(32767, int(round(float(v) * 32767.0)))) for v in echantillons))
    if sys.byteorder == "big":
        pcm.byteswap()
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def revision_en_cache() -> str | None:
    """Le commit du dépôt de poids que le cache Hugging Face a servi."""
    try:
        from huggingface_hub.constants import HF_HUB_CACHE
    except ImportError:
        return None
    racine = Path(HF_HUB_CACHE) / f"models--{MODELE.replace('/', '--')}" / "refs" / "main"
    return racine.read_text().strip() if racine.exists() else None


def generer(voix: list[str], sortie: Path = TRAVAIL) -> None:
    from kokoro import KPipeline

    doc = json.loads(TEXTES.read_text(encoding="utf-8"))
    empreinte = hashlib.sha256(TEXTES.read_bytes()).hexdigest()
    pipeline = KPipeline(lang_code="z", repo_id=MODELE)
    sr = 24_000
    for v in voix:
        dossier = sortie / v
        (dossier / "wav").mkdir(parents=True, exist_ok=True)
        entrees, echecs = [], 0
        for k, t in enumerate(plan(doc, v)):
            ps = t["ps"] + t["fin"]
            morceaux = [r.audio for r in pipeline.generate_from_tokens(ps, voice=v, speed=t["vitesse"])
                        if r.audio is not None]
            x = [s for m in morceaux for s in m.tolist()]
            if not x:
                echecs += 1
                continue
            fichier = f"wav/{k:04d}.wav"
            ecrire_wav(dossier / fichier, x, sr)
            entrees.append({k2: t[k2] for k2 in ("id", "genre", "texte", "syl", "tons", "vitesse", "fin")}
                           | {"ps": ps, "fichier": fichier, "voix": v})
            if k % 100 == 0:
                print(f"{v} : {k}", flush=True)
        (dossier / "corpus.json").write_text(json.dumps({
            "voix": v, "modele": MODELE, "revision": revision_en_cache(), "textes": f"sha256:{empreinte}",
            "role": "test" if v == VOIX_TEST else "entrainement", "entrees": entrees,
        }, ensure_ascii=False), encoding="utf-8")
        print(f"{v} : {len(entrees)} textes dits, {echecs} sans audio", flush=True)


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    sous = ap.add_subparsers(dest="commande", required=True)
    sous.add_parser("textes")
    p = sous.add_parser("plan")
    p.add_argument("--voix", default="")
    p.add_argument("--groupes", type=int, default=5)
    g = sous.add_parser("generer")
    g.add_argument("--voix", required=True)
    g.add_argument("--sortie", default=str(TRAVAIL))
    a = ap.parse_args()
    if a.commande == "textes":
        textes()
    elif a.commande == "plan":
        voix = tuple(x for x in a.voix.replace(" ", "").split(",") if x) or VOIX_DEFAUT
        print(json.dumps([",".join(lot) for lot in groupes(voix, a.groupes)]))
    else:
        generer([x for x in a.voix.split(",") if x], Path(a.sortie))


if __name__ == "__main__":
    main()
