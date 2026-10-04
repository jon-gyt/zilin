"""Porteurs : faire dire un caractère à Kokoro là où il réalise le ton de citation, puis le couper.

Décision du propriétaire du 3 octobre 2026, « vérifier puis corriger ». L'essai des voix
synthétiques (`data/sources/tons/PROVENANCE.md`, « Les voix synthétiques du continent ») a
montré que Kokoro, sur un caractère dit seul, fait presque la même courbe aux quatre tons
(une montée brève puis une chute, sans écart de registre, sans 214) ; le classifieur de l'app
ne retrouvait en tête que 35 à 40 % des tons des fichiers de caractères de l'app.

Le correctif : Kokoro dit le caractère dans un **porteur** (le caractère dit deux fois avec une
pause, une phrase porteuse « 我说X。 », une vitesse ralentie, un point d'exclamation…), en
phonèmes explicites (`zhuyin.py`) pour qu'il ne choisisse ni la lecture ni le sandhi, puis on
**coupe** le caractère :

- par la durée des phonèmes que Kokoro renvoie (`pred_dur` : une trame vaut 600 échantillons à
  24 kHz ; un jeton par symbole connu du vocabulaire, encadré de deux jetons de bord), en
  prenant un peu de la pause qui précède et de celle qui suit, jamais du porteur ;
- à défaut de durées, par les silences, pour un porteur dont la cible est entourée de pauses ;
- avec un fondu court aux deux bords (pas de clic), puis la fin de `audio.finir`.

Le porteur retenu l'est à la mesure, avec le code même de l'app (`app/scripts/tons/audio.ts`) :
`choisir_porteur` applique `CRITERE`. L'essai tourne dans le workflow `donnees` (étape
`audio-porteurs`), seul endroit qui atteint Hugging Face.
"""
from __future__ import annotations

import json
import math
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Protocol, Sequence

from .zhuyin import PinyinIllisible, numerotee, phonemes_mot

#: Fréquence de Kokoro, et nombre d'échantillons par trame de durée (`pred_dur`).
ECHANTILLONNAGE = 24_000
ECHANTILLONS_PAR_DUREE = 600

#: Les symboles qui ne sont pas de la parole : la ponctuation et l'espace. `/` (frontière de
#: mot) n'en est pas : deux mots s'enchaînent sans pause.
PAUSES = frozenset(",.!?;: ")

#: Ce qu'on prend de la pause qui précède la cible (l'attaque d'une consonne peut commencer un
#: peu avant la frontière prédite) et de celle qui suit (la queue de la voix), en secondes.
MARGE_AVANT = 0.04
MARGE_APRES = 0.12
#: Fondus aux bords de la coupe, et silence posé avant la cible, en secondes.
FONDU_DEBUT = 0.005
FONDU_FIN = 0.015
SILENCE_DEBUT = 0.1

#: Mesure des bords : l'énergie des 10 premières et dernières millisecondes de la coupe, en dB
#: sous la trame la plus forte. Au-dessus de `BORD_NET_DB`, la coupe tombe dans la voix : une
#: consonne coupée ou un souffle du porteur.
TRAME_BORD = 0.01
BORD_NET_DB = -30.0

#: Coupe aux silences : sous ce niveau (dB sous la trame la plus forte), une trame est muette ;
#: une pause plus courte que `PAUSE_MIN` ne sépare pas deux répétitions.
SILENCE_DB = -35.0
PAUSE_MIN = 0.08


class DecoupeImpossible(RuntimeError):
    """La cible ne se retrouve pas dans le rendu : rien n'est écrit pour ce texte."""


@dataclass(frozen=True)
class Porteur:
    """Le contexte où Kokoro dit la cible, et laquelle de ses répétitions on garde.

    `avant` et `apres` : des mots, chacun ses syllabes numérotées séparées d'une espace
    (`"zhe4 ge5"`), dits avant et après la cible. `fois` : la cible dite tant de fois,
    séparée d'une virgule ; `garde` : la répétition gardée (0 : la première). `fin` : la
    ponctuation finale. `vitesse` : le `speed` de Kokoro.
    """

    nom: str
    description: str
    avant: tuple[str, ...] = ()
    fois: int = 1
    garde: int = 0
    apres: tuple[str, ...] = ()
    fin: str = "."
    vitesse: float = 1.0

    def __post_init__(self) -> None:
        if not 0 <= self.garde < self.fois:
            raise ValueError(f"porteur {self.nom} : répétition gardée {self.garde} hors de 0..{self.fois - 1}")

    @property
    def entoure_de_pauses(self) -> bool:
        """Vrai si la cible n'a que des pauses autour d'elle : la coupe aux silences tient."""
        return not self.avant and not self.apres

    def phonemes(self, syllabes: Sequence[str]) -> tuple[str, int, int]:
        """Les phonèmes du porteur pour la cible, et la place `[debut, fin)` de la cible gardée."""
        cible = phonemes_mot(list(syllabes))
        ps = "".join(phonemes_mot(m.split()) + "/" for m in self.avant)
        debut = fin = 0
        for k in range(self.fois):
            if k:
                ps += ", "
            if k == self.garde:
                debut, fin = len(ps), len(ps) + len(cible)
            ps += cible
        ps += "".join("/" + phonemes_mot(m.split()) for m in self.apres)
        return ps + self.fin, debut, fin


_JE_DIS = ("wo3", "shuo1")
_CE_CARACTERE = ("zhe4 ge5", "zi4", "du2")

#: Les porteurs essayés (étape `audio-porteurs`). « seul » est le rendu en phonèmes sans
#: porteur : il dit ce que le correctif apporte en plus des phonèmes.
PORTEURS: dict[str, Porteur] = {
    p.nom: p
    for p in (
        Porteur("seul", "X, sans ponctuation", fin=""),
        Porteur("point", "X."),
        Porteur("exclamation", "X!"),
        Porteur("double", "X, X. — la seconde", fois=2, garde=1),
        Porteur("double-premier", "X, X. — la première", fois=2, garde=0),
        Porteur("triple", "X, X, X. — celle du milieu", fois=3, garde=1),
        Porteur("je-dis", "我说X。", avant=_JE_DIS),
        Porteur("je-dis-milieu", "我说X这个字。", avant=_JE_DIS, apres=("zhe4 ge5", "zi4")),
        Porteur("ce-caractere", "这个字读X。", avant=_CE_CARACTERE),
        Porteur("ce-caractere-double", "这个字读X，X。 — la seconde", avant=_CE_CARACTERE, fois=2, garde=1),
        Porteur("seul-lent", "X, vitesse 0,8", fin="", vitesse=0.8),
        Porteur("point-lent", "X., vitesse 0,8", vitesse=0.8),
        Porteur("exclamation-lent", "X!, vitesse 0,8", fin="!", vitesse=0.8),
        Porteur("double-lent", "X, X. — la seconde, vitesse 0,8", fois=2, garde=1, vitesse=0.8),
        Porteur("je-dis-lent", "我说X。, vitesse 0,8", avant=_JE_DIS, vitesse=0.8),
    )
}


# ------------------------------------------------------------------------------- rendu


@dataclass
class Rendu:
    """Ce que Kokoro rend pour une chaîne de phonèmes : les échantillons, et si possible la
    durée de chaque jeton (`pred_dur`) et le vocabulaire qui dit quels symboles sont des jetons."""

    echantillons: list[float]
    durees: list[int] | None = None
    vocab: frozenset[str] | None = None


class MoteurPhonemes(Protocol):
    echantillonnage: int

    def rendu_phonemes(self, ps: str, voix: str, vitesse: float = 1.0) -> Rendu:
        """Les phonèmes dits par la voix, sans G2P."""


@dataclass
class Coupe:
    """La cible coupée : ses échantillons montés (silence, fondus), et de quoi juger la coupe."""

    echantillons: list[float]
    debut: int
    fin: int
    methode: str
    bords_db: tuple[float, float]
    ps: str = ""
    infos: dict[str, object] = field(default_factory=dict)

    @property
    def nette(self) -> bool:
        return max(self.bords_db) <= BORD_NET_DB


def bornes(ps: str, durees: Sequence[int], vocab: frozenset[str] | None = None) -> list[tuple[int, int] | None]:
    """Pour chaque symbole de `ps`, sa place `[debut, fin)` en échantillons dans le rendu, ou
    `None` s'il n'est pas un jeton (absent du vocabulaire, Kokoro l'a ignoré).

    `durees` compte un jeton de bord avant et après les symboles (`KModel.forward`).
    """
    jetons = [c for c in ps if vocab is None or c in vocab]
    if len(durees) != len(jetons) + 2:
        raise DecoupeImpossible(f"{len(durees)} durées pour {len(jetons)} jetons et deux bords")
    pos = int(durees[0]) * ECHANTILLONS_PAR_DUREE
    k = 1
    out: list[tuple[int, int] | None] = []
    for c in ps:
        if vocab is not None and c not in vocab:
            out.append(None)
            continue
        d = int(durees[k]) * ECHANTILLONS_PAR_DUREE
        out.append((pos, pos + d))
        pos += d
        k += 1
    return out


def plage_par_durees(
    ps: str, debut: int, fin: int, durees: Sequence[int], n: int, vocab: frozenset[str] | None = None,
    sr: int = ECHANTILLONNAGE, x: Sequence[float] | None = None,
) -> tuple[int, int]:
    """La plage de la cible `ps[debut:fin]` dans un rendu de `n` échantillons.

    Les bornes prédites, élargies de `MARGE_AVANT` dans la pause qui précède (ou le bord du
    rendu) et de `MARGE_APRES` dans celle qui suit, jamais au-delà de la pause : un mot du
    porteur collé à la cible (« 我说X ») n'est jamais pris. Avec le signal `x`, l'élargissement
    va plus loin dans la pause tant que le signal y sonne encore : l'essai du 3 octobre 2026 a
    montré que Kokoro commence souvent la voix plus tôt que la frontière prédite.
    """
    places = bornes(ps, durees, vocab)
    cible = [p for p in places[debut:fin] if p is not None]
    if not cible:
        raise DecoupeImpossible("aucun jeton de la cible")
    a0, b0 = cible[0][0], cible[-1][1]
    a, b = a0, b0
    seuil = (max(_trames_db(x, sr)) + SILENCE_DB) if x is not None and len(x) else None
    # avant : le bord du rendu, ou une pause
    i = debut - 1
    limite_a: int | None = None
    if i < 0:
        limite_a = 0
    elif ps[i] in PAUSES:
        while i >= 0 and ps[i] in PAUSES:
            i -= 1
        precede = next((places[j] for j in range(i + 1, debut) if places[j] is not None), None)
        limite_a = precede[0] if precede else (0 if i < 0 else a0)
    if limite_a is not None:
        a = a0 - int(MARGE_AVANT * sr)
        if seuil is not None and x is not None:
            a = min(a, reculer(x, a0, limite_a, seuil, sr))
        a = max(limite_a, a)
    # après : le bord du rendu, ou une pause
    j = fin
    limite_b: int | None = None
    if j >= len(ps):
        limite_b = n
    elif ps[j] in PAUSES:
        while j < len(ps) and ps[j] in PAUSES:
            j += 1
        suit = [places[k] for k in range(fin, j) if places[k] is not None]
        limite_b = n if j >= len(ps) else (suit[-1][1] if suit else b0)
    if limite_b is not None:
        b = b0 + int(MARGE_APRES * sr)
        if seuil is not None and x is not None:
            b = max(b, avancer(x, b0, limite_b, seuil, sr))
        b = min(limite_b, b)
    return max(0, min(a, n)), max(0, min(b, n))


def _niveau(x: Sequence[float], i: int, j: int) -> float:
    t = x[max(0, i) : max(0, j)]
    e = math.sqrt(sum(v * v for v in t) / max(1, len(t)))
    return 20 * math.log10(max(e, 1e-9))


def reculer(x: Sequence[float], a: int, limite: int, seuil: float, sr: int = ECHANTILLONNAGE) -> int:
    """Depuis `a`, recule par trames de 10 ms jusqu'à la première trame sous `seuil` (dB),
    sans passer `limite` : le début d'un silence avant la voix, ou `limite`."""
    h = max(1, int(TRAME_BORD * sr))
    k = a
    while k - h >= limite:
        if _niveau(x, k - h, k) <= seuil:
            return k - h
        k -= h
    return limite


def avancer(x: Sequence[float], b: int, limite: int, seuil: float, sr: int = ECHANTILLONNAGE) -> int:
    """Le pendant de `reculer` après la voix : la fin de la première trame sous `seuil`."""
    h = max(1, int(TRAME_BORD * sr))
    k = b
    while k + h <= limite:
        if _niveau(x, k, k + h) <= seuil:
            return k + h
        k += h
    return limite


def _trames_db(x: Sequence[float], sr: int, pas: float = TRAME_BORD) -> list[float]:
    h = max(1, int(pas * sr))
    out = []
    for i in range(0, max(1, len(x) - h + 1), h):
        t = x[i : i + h]
        e = math.sqrt(sum(v * v for v in t) / max(1, len(t)))
        out.append(20 * math.log10(max(e, 1e-9)))
    return out


def plage_par_silences(x: Sequence[float], fois: int, garde: int, sr: int = ECHANTILLONNAGE) -> tuple[int, int]:
    """La plage de la répétition `garde` quand le rendu n'a pas de durées : les îlots de parole
    séparés par des pauses d'au moins `PAUSE_MIN`. Il en faut exactement `fois`."""
    db = _trames_db(x, sr)
    if not db:
        raise DecoupeImpossible("rendu vide")
    seuil = max(db) + SILENCE_DB
    h = max(1, int(TRAME_BORD * sr))
    ilots: list[list[int]] = []
    for k, v in enumerate(db):
        if v < seuil:
            continue
        if ilots and k - ilots[-1][1] <= int(PAUSE_MIN / TRAME_BORD):
            ilots[-1][1] = k
        else:
            ilots.append([k, k])
    if len(ilots) != fois:
        raise DecoupeImpossible(f"{len(ilots)} îlots de parole pour {fois} répétitions")
    a0, b0 = ilots[garde]
    a, b = a0 * h, (b0 + 1) * h
    gauche = (ilots[garde - 1][1] + 1) * h if garde > 0 else 0
    droite = ilots[garde + 1][0] * h if garde + 1 < len(ilots) else len(x)
    return max(gauche, a - int(MARGE_AVANT * sr)), min(droite, b + int(MARGE_APRES * sr))


def bords_db(x: Sequence[float], sr: int = ECHANTILLONNAGE) -> tuple[float, float]:
    """L'énergie des 10 premières et dernières ms, en dB sous la trame la plus forte."""
    db = _trames_db(x, sr)
    if not db:
        return (0.0, 0.0)
    pic = max(db)
    return (round(db[0] - pic, 1), round(db[-1] - pic, 1))


def monter(x: Sequence[float], sr: int = ECHANTILLONNAGE) -> list[float]:
    """La coupe prête à finir : fondu d'entrée et de sortie, silence devant."""
    y = [float(v) for v in x]
    n_in = min(len(y), max(1, int(FONDU_DEBUT * sr)))
    for i in range(n_in):
        y[i] *= (i + 1) / (n_in + 1)
    n_out = min(len(y), max(1, int(FONDU_FIN * sr)))
    for i in range(n_out):
        y[len(y) - n_out + i] *= 1 - (i + 1) / n_out
    return [0.0] * int(SILENCE_DEBUT * sr) + y


def couper(rendu: Rendu, porteur: Porteur, ps: str, debut: int, fin: int, sr: int = ECHANTILLONNAGE) -> Coupe:
    """La cible coupée du rendu : par les durées s'il y en a, sinon par les silences."""
    x = rendu.echantillons
    if rendu.durees is not None:
        a, b = plage_par_durees(ps, debut, fin, rendu.durees, len(x), rendu.vocab, sr, x)
        methode = "durees"
    elif porteur.entoure_de_pauses:
        a, b = plage_par_silences(x, porteur.fois, porteur.garde, sr)
        methode = "silences"
    else:
        raise DecoupeImpossible(f"porteur {porteur.nom} : sans durées, la cible collée au porteur ne se coupe pas")
    if b - a < int(0.05 * sr):
        raise DecoupeImpossible(f"coupe de {b - a} échantillons")
    brut = x[a:b]
    return Coupe(monter(brut, sr), a, b, methode, bords_db(brut, sr), ps)


def rendre(moteur: MoteurPhonemes, syllabes: Sequence[str], porteur: Porteur, voix: str) -> Coupe:
    """Kokoro dit la cible dans le porteur, et on la coupe."""
    ps, debut, fin = porteur.phonemes(syllabes)
    rendu = moteur.rendu_phonemes(ps, voix, porteur.vitesse)
    if not rendu.echantillons:
        raise DecoupeImpossible(f"aucun échantillon pour {ps!r}")
    return couper(rendu, porteur, ps, debut, fin, moteur.echantillonnage)


# ------------------------------------------------------------------------------ lectures


def lectures_exportees(dossier_version: Path) -> dict[str, list[str]]:
    """La lecture que l'app montre pour chaque caractère : le pinyin de sa fiche exportée
    (`familles/*.json`, Unihan `kMandarin` et les surcharges du dépôt), numérotée. Un caractère
    dont la lecture n'est pas une syllabe que Kokoro sait écrire n'y est pas."""
    lectures: dict[str, list[str]] = {}
    for chemin in sorted((dossier_version / "familles").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        for fiche in document.get("fiches") or ():
            c, pinyin = str(fiche.get("c") or ""), str(fiche.get("pinyin") or "")
            if len(c) != 1 or not pinyin or c in lectures:
                continue
            syllabe = numerotee(pinyin)
            try:
                phonemes_mot([syllabe])
            except PinyinIllisible:
                continue
            lectures[c] = [syllabe]
    return lectures


# ------------------------------------------------------------------------------ critère

#: Le critère de remplacement (décision du 3 octobre 2026), mesuré avec le code de l'app sur
#: tous les caractères de l'essai : le ton visé en tête d'une large majorité, aucun ton laissé
#: pour compte, un vrai creux au ton 3, une découpe juste, des coupes nettes (ni consonne
#: coupée, ni souffle du porteur), et nettement mieux que les fichiers actuels.
CRITERE = {
    "en_tete": 85.0,
    "ton_min": 70.0,
    "creux_t3": 50.0,
    "decoupe": 95.0,
    "coupes_nettes": 90.0,
    "gain": 30.0,
}

#: Le groupe des fichiers actuels de l'app dans l'essai, et celui du rendu par le texte.
REFERENCE = "app"


def raisons(groupe: Mapping[str, object], nettes: float | None, reference: float | None, critere: Mapping[str, float] = CRITERE) -> list[str]:
    """Ce qui manque à un groupe mesuré (`audio.ts`) pour remplir le critère ; vide s'il le remplit."""
    out: list[str] = []
    en_tete = float(groupe.get("en_tete") or 0)  # type: ignore[arg-type]
    if en_tete < critere["en_tete"]:
        out.append(f"en tête {en_tete:.1f} % < {critere['en_tete']:.0f}")
    par_ton = groupe.get("par_ton") or {}
    assert isinstance(par_ton, Mapping)
    for t in ("1", "2", "3", "4"):
        p = par_ton.get(t) or {}
        v = float(p.get("en_tete") or 0)
        if v < critere["ton_min"]:
            out.append(f"ton {t} {v:.1f} % < {critere['ton_min']:.0f}")
    creux = float((par_ton.get("3") or {}).get("creux") or 0)
    if creux < critere["creux_t3"]:
        out.append(f"ton 3 en creux {creux:.1f} % < {critere['creux_t3']:.0f}")
    decoupe = float(groupe.get("decoupe_juste") or 0)  # type: ignore[arg-type]
    if decoupe < critere["decoupe"]:
        out.append(f"découpe juste {decoupe:.1f} % < {critere['decoupe']:.0f}")
    if nettes is not None and nettes < critere["coupes_nettes"]:
        out.append(f"coupes nettes {nettes:.1f} % < {critere['coupes_nettes']:.0f}")
    if reference is not None and en_tete < reference + critere["gain"]:
        out.append(f"gain {en_tete - reference:+.1f} points < {critere['gain']:.0f}")
    return out


def choisir_porteur(
    groupes: Mapping[str, Mapping[str, object]],
    nettes: Mapping[str, float],
    reference: str = REFERENCE,
    critere: Mapping[str, float] = CRITERE,
) -> tuple[str | None, dict[str, list[str]]]:
    """Le meilleur porteur qui remplit le critère, ou `None` ; et pour chacun ce qui lui manque.

    Seuls les porteurs connus (`PORTEURS`) concourent. Entre ceux qui passent : le plus de tons
    en tête, puis le plus de ton 3 en creux, puis le plus de coupes nettes.
    """
    ref = groupes.get(reference)
    ref_en_tete = float(ref.get("en_tete") or 0) if ref else None  # type: ignore[arg-type]
    bilan = {
        nom: raisons(g, nettes.get(nom), ref_en_tete, critere)
        for nom, g in groupes.items()
        if nom in PORTEURS
    }
    passent = [nom for nom, r in bilan.items() if not r]
    if not passent:
        return None, bilan

    def cle(nom: str) -> tuple[float, float, float]:
        g = groupes[nom]
        par_ton = g.get("par_ton") or {}
        assert isinstance(par_ton, Mapping)
        return (
            float(g.get("en_tete") or 0),  # type: ignore[arg-type]
            float((par_ton.get("3") or {}).get("creux") or 0),
            float(nettes.get(nom, 0.0)),
        )

    return max(passent, key=cle), bilan


def part_nette(entrees: Sequence[Mapping[str, object]]) -> dict[str, float]:
    """La part des coupes nettes de chaque groupe d'une liste d'essai (`bords` de chaque entrée)."""
    total: dict[str, list[int]] = {}
    for e in entrees:
        bords = e.get("bords")
        if not isinstance(bords, (list, tuple)):
            continue
        t = total.setdefault(str(e["groupe"]), [0, 0])
        t[1] += 1
        if max(float(v) for v in bords) <= BORD_NET_DB:
            t[0] += 1
    return {g: round(100 * a / b, 1) for g, (a, b) in total.items() if b}


# --------------------------------------------------------------------------------- essai


def decoder_mp3(chemin: Path, ffmpeg: str, sr: int = ECHANTILLONNAGE) -> list[float]:
    """Un MP3 de l'app en flottants mono à `sr` hertz, par ffmpeg."""
    r = subprocess.run(  # noqa: S603 — binaire résolu par shutil.which
        [ffmpeg, "-v", "error", "-i", str(chemin), "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    )
    from array import array

    pcm = array("h")
    pcm.frombytes(r.stdout)
    return [v / 32768 for v in pcm]


def _tons(syllabes: Sequence[str]) -> list[int]:
    return [int(s[-1]) for s in syllabes]


def essai(
    sortie: Path,
    textes: Mapping[str, Sequence[str]],
    porteurs: Sequence[Porteur],
    moteur: object,
    voix: str,
    *,
    etiquette: str = "0",
    app: Mapping[str, Path] | None = None,
    ffmpeg: str | None = None,
    ecoute: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, object]:
    """L'essai des porteurs : chaque caractère de `textes` (texte → syllabes numérotées) dit dans
    chaque porteur et coupé, en WAV 24 kHz sous `sortie/wav/<porteur>/`, et la liste à mesurer
    (`sortie/liste-<etiquette>.json`, lue par `app/scripts/tons/audio.ts`).

    `app` : les fichiers actuels de l'app (texte → MP3), décodés par ffmpeg dans le groupe
    `REFERENCE`, mesurés de la même façon. `ecoute` : quelques caractères (texte → syllabes)
    dits par le texte comme aujourd'hui (`actuel`) et dans chaque porteur, en MP3 sous
    `sortie/ecoute/<groupe>/`, pour l'oreille du propriétaire. Un caractère au ton neutre n'est
    pas mesuré : le critère porte sur les quatre tons.
    """
    from . import audio as audio_mod

    wav = audio_mod.EncodeurWav()
    sr = ECHANTILLONNAGE
    entrees: list[dict[str, object]] = []
    echecs: list[str] = []
    mesures = {t: s for t, s in textes.items() if 5 not in _tons(s)}

    def ecrire(groupe: str, k: int, x: Sequence[float]) -> str:
        fichier = f"wav/{groupe}/{k:04d}.wav"
        (sortie / fichier).parent.mkdir(parents=True, exist_ok=True)
        (sortie / fichier).write_bytes(wav.encoder(x, sr))
        return fichier

    if app and ffmpeg:
        for k, (texte, syl) in enumerate(sorted(mesures.items())):
            if texte not in app:
                continue
            x = decoder_mp3(app[texte], ffmpeg, sr)
            entrees.append({"id": f"{REFERENCE}/{texte}", "groupe": REFERENCE, "texte": texte, "tons": _tons(syl),
                            "syl": [s[:-1] for s in syl], "fichier": ecrire(REFERENCE, k, x)})
    for porteur in porteurs:
        for k, (texte, syl) in enumerate(sorted(mesures.items())):
            try:
                coupe = rendre(moteur, syl, porteur, voix)  # type: ignore[arg-type]
            except Exception as erreur:  # noqa: BLE001 — un échec n'arrête pas l'essai, il est compté
                echecs.append(f"{porteur.nom}/{texte} : {erreur}")
                continue
            x = audio_mod.finir(coupe.echantillons, sr)
            entrees.append({"id": f"{porteur.nom}/{texte}", "groupe": porteur.nom, "texte": texte, "tons": _tons(syl),
                            "syl": [s[:-1] for s in syl], "fichier": ecrire(porteur.nom, k, x), "ps": coupe.ps,
                            "methode": coupe.methode, "bords": list(coupe.bords_db),
                            "coupe": [coupe.debut, coupe.fin]})
        print(f"{porteur.nom} : {sum(1 for e in entrees if e['groupe'] == porteur.nom)} caractères", flush=True)

    if ecoute:
        mp3: object = audio_mod.EncodeurFfmpeg(ffmpeg) if ffmpeg else wav
        for texte, syl in ecoute.items():
            nom = f"{''.join(syl)}-{texte}.{mp3.format}"  # type: ignore[attr-defined]
            groupes: list[tuple[str, Sequence[float]]] = []
            try:
                groupes.append(("actuel", audio_mod.finir(moteur.echantillons(texte, voix), sr)))  # type: ignore[attr-defined]
            except Exception as erreur:  # noqa: BLE001
                echecs.append(f"ecoute actuel/{texte} : {erreur}")
            for porteur in porteurs:
                try:
                    groupes.append((porteur.nom, audio_mod.finir(rendre(moteur, syl, porteur, voix).echantillons, sr)))  # type: ignore[arg-type]
                except Exception as erreur:  # noqa: BLE001
                    echecs.append(f"ecoute {porteur.nom}/{texte} : {erreur}")
            for groupe, x in groupes:
                cible = sortie / "ecoute" / groupe / nom
                cible.parent.mkdir(parents=True, exist_ok=True)
                cible.write_bytes(mp3.encoder(x, sr))  # type: ignore[attr-defined]
            if app and texte in app:
                cible = sortie / "ecoute" / REFERENCE / f"{''.join(syl)}-{texte}.mp3"
                cible.parent.mkdir(parents=True, exist_ok=True)
                cible.write_bytes(Path(app[texte]).read_bytes())

    document = {"etiquette": etiquette, "voix": voix, "porteurs": [p.nom for p in porteurs],
                "echecs": echecs, "entrees": entrees}
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / f"liste-{etiquette}.json").write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return {"entrees": len(entrees), "echecs": echecs}


def bilan(dossier: Path, critere: Mapping[str, float] = CRITERE) -> dict[str, object]:
    """Rassemble les mesures d'un essai (`mesure-*.json` de `audio.ts`, `liste-*.json`) et
    applique le critère. Écrit `choix.json` et `bilan.md` dans `dossier`."""
    groupes: dict[str, Mapping[str, object]] = {}
    for chemin in sorted(dossier.glob("mesure-*.json")):
        groupes.update(json.loads(chemin.read_text(encoding="utf-8"))["groupes"])
    entrees: list[Mapping[str, object]] = []
    echecs: list[str] = []
    for chemin in sorted(dossier.glob("liste-*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        entrees.extend(document["entrees"])
        echecs.extend(document.get("echecs") or ())
    nettes = part_nette(entrees)
    choix, manques = choisir_porteur(groupes, nettes, critere=critere)

    def ton(g: Mapping[str, object], t: str, champ: str = "en_tete") -> str:
        par_ton = g.get("par_ton") or {}
        assert isinstance(par_ton, Mapping)
        p = par_ton.get(t)
        return f"{p[champ]}" if p else "—"

    lignes = [
        "| groupe | énoncés | découpe juste | en tête | reconnu | ton 1 | ton 2 | ton 3 | ton 4 | ton 3 en creux | coupes nettes | critère |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    ordre = sorted(groupes, key=lambda n: (n != REFERENCE, -float(groupes[n].get("en_tete") or 0)))  # type: ignore[arg-type]
    for nom in ordre:
        g = groupes[nom]
        if nom == REFERENCE:
            verdict = "fichiers actuels"
        elif nom == choix:
            verdict = "**retenu**"
        else:
            verdict = "; ".join(manques.get(nom, [])) or "rempli"
        lignes.append(
            f"| {nom} | {g.get('enonces')} | {g.get('decoupe_juste')} | {g.get('en_tete')} | {g.get('reconnu')} | "
            f"{ton(g, '1')} | {ton(g, '2')} | {ton(g, '3')} | {ton(g, '4')} | {ton(g, '3', 'creux')} | "
            f"{nettes.get(nom, '—')} | {verdict} |"
        )
    conclusion = f"Porteur retenu : **{choix}**." if choix else "Aucun porteur ne remplit le critère : rien n'est remplacé."
    md = (
        "\n".join(lignes)
        + f"\n\n{conclusion}\n\nCritère : {json.dumps(dict(critere), ensure_ascii=False)}. "
        + f"Échecs de synthèse ou de découpe : {len(echecs)}.\n"
    )
    resultat: dict[str, object] = {
        "choix": choix, "critere": dict(critere), "manques": manques, "nettes": nettes,
        "groupes": groupes, "echecs": echecs,
    }
    (dossier / "choix.json").write_text(json.dumps(resultat, ensure_ascii=False, indent=1), encoding="utf-8")
    (dossier / "bilan.md").write_text(md, encoding="utf-8")
    return resultat


def lots(n: int, porteur: str = "") -> list[str]:
    """La matrice du workflow : les porteurs en `n` lots (à virgules) pour l'essai, ou un seul
    lot `regenerer` quand un porteur est nommé. Sans dépendance : tourne avant `uv sync`."""
    if porteur:
        if porteur not in PORTEURS:
            raise ValueError(f"porteur inconnu : {porteur} ; connus : {', '.join(PORTEURS)}")
        return ["regenerer"]
    n = max(1, min(n, len(PORTEURS)))
    groupes: list[list[str]] = [[] for _ in range(n)]
    for i, nom in enumerate(PORTEURS):
        groupes[i % n].append(nom)
    return [",".join(g) for g in groupes]


if __name__ == "__main__":  # python3 -m wenlu_data.porteurs <lots> [porteur]
    import sys

    print(json.dumps(lots(int(sys.argv[1]) if len(sys.argv) > 1 else 5, sys.argv[2].strip() if len(sys.argv) > 2 else "")))
