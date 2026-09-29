"""Prépare le corpus du classifieur des tons de « Dis-le » (story 9.1).

Recette de `data/sources/tons/modele.json`, première étape (voir `PROVENANCE.md`). Ne tourne
pas en CI. L'audio brut se télécharge à la main dans `data/work/tons/donnees/brut/` ; puis :

    uv run --with pypinyin --with imageio-ffmpeg python data/sources/tons/preparer.py

Décode chaque source en WAV PCM 16 bits mono 16 kHz (la fréquence du micro visée
dans l'app) et écrit `donnees/corpus.json` : un enregistrement par fichier, avec
sa source, son locuteur, le texte, les syllabes et leur ton *de surface* (après
sandhi), et le rôle de la source (entraînement ou test).

Sources et rôle (licences : voir `PROVENANCE.md`) :

- tw1, tw2 : syllabes isolées, deux voix natives (femme, homme), jeu 5961 de
  data.gov.tw (fournisseur à confirmer sur la page du jeu), Open Government Data License
  1.0, compatible CC BY 4.0. Récupérées par les archives de publication du dépôt
  GitHub Punpuf/shenzhen-mandarin-audio. Rôle : entraînement.
- cw : syllabes isolées de Chen Wang, hugolpz/audio-cmn, CC BY-SA. Rôle : test
  seulement (aucun poids n'en dérive).
- yt1, yt2 : caractères et mots de deux caractères de Yue Tan (Shtooka
  cmn-caen-tan, via hugolpz/audio-cmn), CC BY-SA. Rôle : test seulement.
- kk1, kk2 : les fichiers Kokoro de l'app (voix zf_001), caractères et mots,
  Apache 2.0 (déjà tranché dans docs/sources-licences.md). Rôle : test, et
  référence des courbes.

Étiquettes : nom de fichier pour tw et cw ; pinyin de l'app pour kk ; pypinyin
(MIT) pour yt, en ne gardant pour les caractères que ceux à lecture unique.
"""
from __future__ import annotations

import json
import random
import re
import subprocess
import sys
import unicodedata
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import imageio_ffmpeg
from pypinyin import Style, lazy_pinyin, pinyin

#: Le dossier de travail de la recette (ignoré par git).
ICI = Path(__file__).resolve().parents[2] / "work" / "tons"
BRUT = ICI / "donnees" / "brut"
WAV = ICI / "donnees" / "wav"
APP = Path(__file__).resolve().parents[3] / "app" / "public"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 16000


def decoder(src: Path, dst: Path) -> bool:
    if dst.exists():
        return True
    dst.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True,
    )
    if r.returncode != 0 or not r.stdout:
        return False
    with wave.open(str(dst), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(r.stdout)
    return True


# --- tons de surface --------------------------------------------------------

MARQUES = {
    "āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4,
}


def tons_marques(p: str) -> list[int]:
    """Tons portés par les voyelles accentuées d'un pinyin, dans l'ordre."""
    out = []
    for ch in p:
        for k, t in MARQUES.items():
            if ch in k:
                out.append(t)
    return out


def sandhi(hanzi: str, tons: list[int]) -> list[int]:
    """Tons de surface d'un mot : 3-3 → 2-3, 不 et 一 devant un ton 4 (ou autre)."""
    t = list(tons)
    for i in range(len(t) - 1):
        c, n = hanzi[i], t[i + 1]
        if c == "不" and n == 4:
            t[i] = 2
        elif c == "一" and t[i] == 1 and n in (1, 2, 3):
            t[i] = 4
        elif c == "一" and t[i] == 1 and n == 4:
            t[i] = 2
    # 3-3 → 2-3, de droite à gauche pour les suites (rare en deux syllabes)
    for i in range(len(t) - 2, -1, -1):
        if t[i] == 3 and t[i + 1] == 3:
            t[i] = 2
    return t


def tons_pypinyin(hanzi: str) -> list[int] | None:
    syl = lazy_pinyin(hanzi, style=Style.TONE3, neutral_tone_with_five=True)
    if len(syl) != len(hanzi):
        return None
    out = []
    for s in syl:
        m = re.search(r"([1-5])$", s)
        if not m:
            return None
        out.append(int(m.group(1)))
    return out


def lecture_unique(c: str) -> int | None:
    lec = pinyin(c, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True)[0]
    tons = {int(s[-1]) for s in lec if s[-1].isdigit()}
    return tons.pop() if len(tons) == 1 else None


# --- sources ----------------------------------------------------------------

def taiwan(corpus: list, taches: list) -> None:
    for voix, loc in (("1", "tw1"), ("2", "tw2")):
        d = BRUT / f"syllables_voice{voix}_opus_48k"
        for f in sorted(d.glob("*.opus")):
            m = re.fullmatch(r"([a-zü]+)([1-5])", f.stem)
            if not m:
                continue
            dst = WAV / loc / f"{f.stem}.wav"
            taches.append((f, dst))
            corpus.append(dict(id=f"{loc}/{f.stem}", source=loc, locuteur=loc, role="entrainement",
                               fichier=str(dst.relative_to(ICI)), texte=m.group(1) + m.group(2),
                               tons=[int(m.group(2))]))


def chen_wang(corpus: list, taches: list) -> None:
    for f in sorted((BRUT / "acmn" / "64k" / "syllabs").glob("*.mp3")):
        m = re.fullmatch(r"cmn-_?([a-zü]+)([1-4])", f.stem)  # les *5 restants sont des copies du ton 1 (README)
        if not m:
            continue
        dst = WAV / "cw" / f"{f.stem[4:]}.wav"
        taches.append((f, dst))
        corpus.append(dict(id=f"cw/{f.stem[4:]}", source="cw", locuteur="cw", role="test",
                           fichier=str(dst.relative_to(ICI)), texte=m.group(1) + m.group(2),
                           tons=[int(m.group(2))]))


def yue_tan(corpus: list, taches: list) -> None:
    d = BRUT / "acmn" / "64k" / "hsk"
    for f in sorted(d.glob("*.mp3")):
        h = unicodedata.normalize("NFC", f.stem[4:])
        if not re.fullmatch(r"[一-鿿]{1,2}", h):
            continue
        if len(h) == 1:
            t = lecture_unique(h)
            if t is None or t == 5:
                continue
            tons, src = [t], "yt1"
        else:
            t = tons_pypinyin(h)
            if t is None:
                continue
            tons, src = sandhi(h, t), "yt2"
        dst = WAV / src / f"{h}.wav"
        taches.append((f, dst))
        corpus.append(dict(id=f"{src}/{h}", source=src, locuteur="yt", role="test",
                           fichier=str(dst.relative_to(ICI)), texte=h, tons=tons))


def _parcourir(x, lect: dict) -> None:
    if isinstance(x, dict):
        h = x.get("hanzi") or x.get("c") or x.get("mot")
        p = x.get("pinyin")
        if isinstance(h, str) and isinstance(p, str) and p and re.fullmatch(r"[\u4e00-\u9fff]{1,2}", h):
            lect.setdefault(h, p)
        for v in x.values():
            _parcourir(v, lect)
    elif isinstance(x, list):
        for v in x:
            _parcourir(v, lect)


def _sans_marques(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower().replace("ü", "v"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("u\u0308", "v")


def tons_app(hanzi: str, p: str) -> list[int] | None:
    """Tons d'un mot d'après le pinyin de l'app (le neutre y est noté sans marque)."""
    syl = lazy_pinyin(hanzi, style=Style.NORMAL, v_to_u=False)
    brut = unicodedata.normalize("NFC", p.replace(" ", "").replace("'", "").lower())
    plat = _sans_marques(brut)
    tons, i = [], 0
    for s in syl:
        s = s.replace("ü", "v")
        if not plat.startswith(s, i):
            return None
        seg = brut[i:i + len(s)]
        m = tons_marques(seg)
        tons.append(m[0] if len(m) == 1 else 5)
        i += len(s)
    return tons if i == len(plat) else None


def kokoro(corpus: list, taches: list) -> None:
    ver = APP / "data" / "0.1.0"
    chemins = json.loads((ver / "audio" / "manifeste.json").read_text())["chemins"]
    lect: dict[str, str] = {}
    for f in sorted(ver.rglob("*.json")):
        if "audio" in f.parts or "traits" in f.parts:
            continue
        _parcourir(json.loads(f.read_text()), lect)
    rejets = []
    for texte, chemin in sorted(chemins.items()):
        p = lect.get(texte)
        if p is None or len(texte) > 2:
            rejets.append(texte)
            continue
        if len(texte) == 1:
            marques = tons_marques(p)
            if len(marques) != 1:
                rejets.append(texte)
                continue
            tons, src = marques, "kk1"
        else:
            t = tons_app(texte, p)
            if t is None:
                rejets.append(texte)
                continue
            # 一 et 不 : pypinyin applique déjà leur sandhi dans son dictionnaire de mots
            pp = tons_pypinyin(texte) or t
            t = [pp[i] if texte[i] in "一不" and pp[i] in (2, 4) else t[i] for i in range(2)]
            tons, src = sandhi(texte, t), "kk2"
        dst = WAV / src / f"{Path(chemin).stem}.wav"
        taches.append((APP / chemin, dst))
        corpus.append(dict(id=f"{src}/{texte}", source=src, locuteur="kokoro-zf_001", role="test",
                           fichier=str(dst.relative_to(ICI)), texte=texte, tons=tons,
                           pinyin=p, audio_app=chemin))
    print(f"kokoro : {len(rejets)} textes écartés (pinyin absent ou illisible) : {rejets[:12]}", file=sys.stderr)


def main() -> None:
    corpus: list = []
    taches: list = []
    taiwan(corpus, taches)
    chen_wang(corpus, taches)
    yue_tan(corpus, taches)
    kokoro(corpus, taches)
    with ThreadPoolExecutor(8) as ex:
        ok = list(ex.map(lambda t: decoder(*t), taches))
    corpus = [c for c, o in zip(corpus, ok) if o]
    (ICI / "donnees" / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, indent=0))
    from collections import Counter
    par = Counter((c["source"], tuple(c["tons"]) if len(c["tons"]) == 1 else "mot") for c in corpus)
    for k in sorted(par, key=str):
        print(k, par[k])
    print("échecs de décodage :", ok.count(False))


if __name__ == "__main__":
    random.seed(0)
    main()
