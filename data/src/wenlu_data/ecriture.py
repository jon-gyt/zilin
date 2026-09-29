"""Gabarits de l'écriture au doigt (dictionnaire, Wenlu complet).

L'app reconnaît un caractère tracé au doigt en l'appariant, trait à trait, aux médianes
de Make Me a Hanzi (`graphics.txt`, Arphic Public License) : `app/src/lib/ecriture/`.
Ce module écrit ce qu'elle lit, un seul fichier chargé à l'ouverture du pavé :
`ecriture/gabarits.json`, les 3 000 caractères du HSK 3.0 (GF 0025-2021, niveaux 1 à 9,
`data/sources/listes/hsk-*.txt`).

Un gabarit, c'est la médiane de chaque trait, rééchantillonnée à `POINTS` points également
espacés le long du trait, dans le repère de l'écran (y vers le bas), la boîte du caractère
entier ramenée à `[0, NIVEAUX - 1]` sans changer ses proportions, et chaque coordonnée
arrondie à l'un des `NIVEAUX` crans. Un cran s'écrit en un signe de l'alphabet base64 des
URL (`ALPHABET`) : 16 signes par trait, rien d'autre. Les nombres de traits s'écrivent de
même, un signe par caractère. Environ 450 Ko pour 28 000 traits, sans décompression à
écrire dans l'app.

Ces gabarits dérivent des médianes : ils sont modifiés au sens de l'APL §2 a).
`ecriture/MODIFICATIONS.md` dit comment et quand, l'en-tête du fichier le répète, et
`ecriture/ARPHICPL.TXT` est copié inaltéré à côté (APL §1). Le dossier ne porte que des
données sous APL : aucun texte propriétaire n'y entre (`fautes`).

Le module est à part d'`export.py` : `export` l'appelle (`fichiers`), l'index nomme le
fichier (clé `ecriture`), `check` lance `controles`.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from .gf0014 import Controle
from .paths import EXPORT, INGEST

#: Le dossier de l'export qui porte les gabarits, et le fichier que l'index nomme.
DOSSIER = "ecriture/"
FICHIER = f"{DOSSIER}gabarits.json"
MODIFICATIONS = f"{DOSSIER}MODIFICATIONS.md"

#: Points par trait, également espacés le long de la médiane (extrémités comprises).
POINTS = 8
#: Crans par coordonnée : un signe base64 chacun.
NIVEAUX = 64
#: L'alphabet base64 des URL (RFC 4648 §5) : le signe de rang k dit le cran k.
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

#: Les listes du HSK 3.0, dans l'ordre des niveaux : leur ordre est celui du fichier.
LISTES_HSK: tuple[str, ...] = ("hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9")
#: Les caractères attendus : 300 par niveau de 1 à 6, 1 200 pour 7 à 9.
ATTENDUS = 3000

#: Le budget du fichier : « environ 450 Ko » (étude du dictionnaire, §6 et §8).
BUDGET_OCTETS = 480_000

#: Le repère des médianes de Make Me a Hanzi : 1024 unités, y vers le haut, ligne de base 900.
HAUT = 900

LICENCE = "Arphic Public License"
ARPHIC = "ARPHICPL.TXT"
SOURCE = "Make Me a Hanzi — graphics.txt (médianes)"
URL = "https://github.com/skishore/makemeahanzi"

#: Les clés qu'un fichier de `ecriture/` peut porter : l'en-tête de licence et les gabarits.
CLES = frozenset(
    {"version", "license", "license_file", "source", "source_url", "modified",
     "format", "listes", "caracteres", "traits", "gabarits"}
)


def modifie(jour: str) -> str:
    """La mention de modification de l'en-tête (APL §2 a)."""
    return (
        f"{jour} : médianes rééchantillonnées à {POINTS} points par trait, y retourné vers le bas,"
        f" boîte du caractère ramenée à {NIVEAUX} crans (proportions gardées), coordonnées"
        " arrondies et écrites en base64 ; tracés (contours) omis ; sous-ensemble des 3 000"
        " caractères du HSK 3.0. Voir MODIFICATIONS.md."
    )


# ------------------------------------------------------------------------ géométrie


Point = tuple[float, float]


def reechantillonner(points: Sequence[Sequence[float]], n: int = POINTS) -> list[Point]:
    """`n` points également espacés le long de la ligne brisée, extrémités comprises.

    Un trait réduit à un point (ou de longueur nulle) rend `n` fois ce point.
    """
    pts = [(float(p[0]), float(p[1])) for p in points]
    if not pts:
        raise ValueError("trait vide")
    cumul = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cumul.append(cumul[-1] + math.hypot(x1 - x0, y1 - y0))
    total = cumul[-1]
    if total == 0:
        return [pts[0]] * n
    sortie: list[Point] = []
    j = 0
    for i in range(n):
        t = total * i / (n - 1)
        while j < len(pts) - 2 and cumul[j + 1] < t:
            j += 1
        seg = cumul[j + 1] - cumul[j]
        a = 0.0 if seg == 0 else min(1.0, max(0.0, (t - cumul[j]) / seg))
        (x0, y0), (x1, y1) = pts[j], pts[j + 1]
        sortie.append((x0 + a * (x1 - x0), y0 + a * (y1 - y0)))
    return sortie


def cran(v: float) -> int:
    """Une coordonnée de `[-0,5, 0,5]` en cran de `[0, NIVEAUX - 1]`, arrondi au plus proche."""
    return min(NIVEAUX - 1, max(0, math.floor((v + 0.5) * (NIVEAUX - 1) + 0.5)))


def gabarit(medianes: Sequence[Sequence[Sequence[float]]]) -> list[list[tuple[int, int]]]:
    """Le gabarit d'un caractère : ses traits, chacun en `POINTS` crans (x, y).

    Même normalisation que l'app pour un tracé : boîte des points rééchantillonnés,
    centrée, divisée par son plus grand côté.
    """
    traits = [reechantillonner([(p[0], HAUT - p[1]) for p in m]) for m in medianes]
    xs = [x for t in traits for x, _ in t]
    ys = [y for t in traits for _, y in t]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    cote = max(max(xs) - min(xs), max(ys) - min(ys)) or 1.0
    return [[(cran((x - cx) / cote), cran((y - cy) / cote)) for x, y in t] for t in traits]


# ------------------------------------------------------------------------ fichier


def caracteres_hsk(listes: Mapping[str, Sequence[str]]) -> list[str]:
    """Les caractères du HSK 3.0, niveau par niveau, sans doublon."""
    vus: list[str] = []
    for nom in LISTES_HSK:
        for c in listes.get(nom, ()):
            if c not in vus:
                vus.append(c)
    return vus


def encoder(caracteres: Sequence[str], medianes: Mapping[str, Sequence]) -> tuple[str, str]:
    """Les nombres de traits et les gabarits, en deux chaînes base64."""
    traits: list[str] = []
    gabarits: list[str] = []
    for c in caracteres:
        g = gabarit(medianes[c])
        if len(g) >= NIVEAUX:
            raise ValueError(f"{c} : {len(g)} traits, au-delà de {NIVEAUX - 1}")
        traits.append(ALPHABET[len(g)])
        gabarits.extend(ALPHABET[x] + ALPHABET[y] for t in g for x, y in t)
    return "".join(traits), "".join(gabarits)


def decoder(document: Mapping[str, object]) -> dict[str, list[list[tuple[int, int]]]]:
    """L'inverse d'`encoder`, pour les contrôles : caractère → traits → crans."""
    rang = {s: k for k, s in enumerate(ALPHABET)}
    caracteres = list(str(document["caracteres"]))
    traits = str(document["traits"])
    gabarits = str(document["gabarits"])
    if len(traits) != len(caracteres):
        raise ValueError("autant de nombres de traits que de caractères attendus")
    sortie: dict[str, list[list[tuple[int, int]]]] = {}
    k = 0
    for c, n in zip(caracteres, traits):
        g = []
        for _ in range(rang[n]):
            t = [(rang[gabarits[k + 2 * i]], rang[gabarits[k + 2 * i + 1]]) for i in range(POINTS)]
            k += 2 * POINTS
            g.append(t)
        sortie[c] = g
    if k != len(gabarits):
        raise ValueError("longueur des gabarits incohérente")
    return sortie


def document(
    version: str,
    listes: Mapping[str, Sequence[str]],
    medianes: Mapping[str, Sequence],
    jour: str,
) -> dict[str, object]:
    """Le JSON de `ecriture/gabarits.json` : en-tête APL, format, puis les gabarits."""
    caracteres = caracteres_hsk(listes)
    manquants = [c for c in caracteres if c not in medianes]
    if manquants:
        raise ValueError(f"caractères du HSK sans médianes : {''.join(manquants[:20])}")
    traits, gabarits = encoder(caracteres, medianes)
    return {
        "version": version,
        "license": LICENCE,
        "license_file": ARPHIC,
        "source": SOURCE,
        "source_url": URL,
        "modified": modifie(jour),
        "format": {
            "points": POINTS,
            "niveaux": NIVEAUX,
            "alphabet": ALPHABET,
            "repere": "x vers la droite, y vers le bas ; boîte du caractère centrée, plus grand côté"
            f" sur {NIVEAUX - 1} crans",
        },
        "listes": [[nom, len(listes.get(nom, ()))] for nom in LISTES_HSK],
        "caracteres": "".join(caracteres),
        "traits": traits,
        "gabarits": gabarits,
    }


def modifications_md(version: str, n: int, jour: str) -> str:
    """`ecriture/MODIFICATIONS.md` : la mention exigée par l'APL §2 a)."""
    return "\n".join(
        [
            "# Gabarits d'écriture dérivés de Make Me a Hanzi",
            "",
            f"Version de l'export : {version}. Dérivés le {jour}.",
            "",
            f"Source : {SOURCE}, {URL}",
            f"Licence : {LICENCE}, texte intégral et inaltéré dans `{ARPHIC}`.",
            "",
            "## Modifications apportées",
            "",
            f"- Sous-ensemble : {n} caractères, ceux du HSK 3.0 (GF 0025-2021, niveaux 1 à 9).",
            "- Seules les médianes sont reprises ; les tracés (contours) sont omis.",
            "- L'axe vertical est retourné : y croît vers le bas, comme sur un écran.",
            f"- Chaque médiane est rééchantillonnée à {POINTS} points également espacés le long"
            " du trait, extrémités comprises.",
            "- La boîte des points du caractère est centrée et divisée par son plus grand côté,"
            f" puis chaque coordonnée est arrondie au plus proche de {NIVEAUX} crans et écrite"
            " en un signe de l'alphabet base64 des URL (RFC 4648 §5).",
            "",
            "Le fichier porte la même mention dans son en-tête (`license`, `source`,"
            " `source_url`, `modified`), comme l'exige l'APL §2 a). Il sert à reconnaître un"
            " caractère tracé au doigt ; aucun caractère n'est dessiné depuis ces gabarits.",
            "",
        ]
    )


def charger_medianes(ingest: Path, caracteres: Iterable[str]) -> dict[str, list]:
    """Les médianes de `graphics.txt` (normalisé par `ingest`) des caractères demandés."""
    voulus = set(caracteres)
    graphies = json.loads((ingest / "graphies.json").read_text(encoding="utf-8"))
    return {str(e["c"]): e["medians"] for e in graphies if str(e["c"]) in voulus}


def charger_listes(ingest: Path) -> dict[str, list[str]]:
    document_ = json.loads((ingest / "listes.json").read_text(encoding="utf-8"))
    return {str(nom): [str(c) for c in liste] for nom, liste in document_.items()}


def _json_compact(contenu: object) -> str:
    return json.dumps(contenu, ensure_ascii=False, separators=(",", ":")) + "\n"


def fichiers(version: str, *, ingest: Path, licences: Path, jour: str) -> dict[str, str]:
    """Ce que `export` écrit dans `ecriture/` : gabarits, note de modification, licence."""
    listes = charger_listes(ingest)
    caracteres = caracteres_hsk(listes)
    medianes = charger_medianes(ingest, caracteres)
    return {
        FICHIER: _json_compact(document(version, listes, medianes, jour)),
        MODIFICATIONS: modifications_md(version, len(caracteres), jour),
        f"{DOSSIER}{ARPHIC}": (licences / ARPHIC).read_text(encoding="utf-8"),
    }


def sources() -> list[tuple[str, Path]]:
    """Ce qui, en plus des listes et des graphies déjà suivies, rend l'export périmé."""
    return [("exporteur-ecriture", Path(__file__).resolve())]


# ------------------------------------------------------------------------ check


def fautes(document_: object, entete: Sequence[str]) -> list[str]:
    """Ce qui cloche, du point de vue des licences, dans un JSON de `ecriture/`."""
    if not isinstance(document_, dict):
        return ["document hors format"]
    sortie = [f"en-tête sans {cle}" for cle in entete if not document_.get(cle)]
    if document_.get("license") != LICENCE:
        sortie.append(f"gabarits hors {LICENCE}")
    etrangeres = set(document_) - CLES
    if etrangeres:
        sortie.append(f"clés étrangères aux gabarits : {' '.join(sorted(etrangeres))}")
    return sortie


def controles(destination: Path | None = None, ingest: Path | None = None) -> list[Controle]:
    """Contrôles de `wenlu check` sur les gabarits exportés.

    - « gabarits » (bloquant) : chaque version exportée nomme le fichier dans son index, le
      porte avec `ARPHICPL.TXT` et `MODIFICATIONS.md` à côté, et il se relit ;
    - « couverture » (bloquant) : exactement les 3 000 caractères du HSK 3.0, dans l'ordre des
      niveaux, chacun avec autant de traits que ses médianes dans `graphics.txt` ;
    - « taille » (bloquant) : sous `BUDGET_OCTETS` ;
    - « crans » (signalé) : aucun trait réduit à un point, aucun caractère sans étendue.
    """
    destination = destination or EXPORT
    ingest = ingest or INGEST
    versions = sorted(
        d for d in destination.iterdir() if d.is_dir() and (d / "index.json").exists()
    ) if destination.exists() else []
    if not versions:
        return [Controle("écriture : gabarits", True, "aucun export écrit : lancer `wenlu export`")]

    listes = charger_listes(ingest)
    attendus = caracteres_hsk(listes)
    medianes = charger_medianes(ingest, attendus)

    absents: list[str] = []
    ecarts: list[str] = []
    tailles: list[str] = []
    trop_gros: list[str] = []
    points: list[str] = []
    total = 0
    for dossier in versions:
        index = json.loads((dossier / "index.json").read_text(encoding="utf-8"))
        if index.get("ecriture") != FICHIER:
            absents.append(f"{dossier.name}/index.json : clé `ecriture` absente ou fausse")
        for relatif in (FICHIER, MODIFICATIONS, f"{DOSSIER}{ARPHIC}"):
            if not (dossier / relatif).exists():
                absents.append(f"{dossier.name}/{relatif}")
        chemin = dossier / FICHIER
        if not chemin.exists():
            continue
        octets = chemin.stat().st_size
        tailles.append(f"{dossier.name} : {octets / 1000:.0f} Ko")
        if octets > BUDGET_OCTETS:
            trop_gros.append(f"{dossier.name} : {octets} octets")
        brut = json.loads(chemin.read_text(encoding="utf-8"))
        try:
            lus = decoder(brut)
        except (KeyError, ValueError) as erreur:
            absents.append(f"{dossier.name}/{FICHIER} illisible : {erreur}")
            continue
        if list(lus) != attendus:
            manquent = [c for c in attendus if c not in lus]
            en_trop = [c for c in lus if c not in set(attendus)]
            ecarts.append(
                f"{dossier.name} : {len(lus)} caractères pour {len(attendus)} attendus"
                f" (manquent {''.join(manquent[:10]) or '—'}, en trop {''.join(en_trop[:10]) or '—'},"
                " ou ordre différent)"
            )
        for c, g in lus.items():
            total += len(g)
            if c in medianes and len(g) != len(medianes[c]):
                ecarts.append(f"{dossier.name}:{c} {len(g)} traits pour {len(medianes[c])} médianes")
            etendue = {p for t in g for p in t}
            if len(etendue) == 1:
                points.append(f"{dossier.name}:{c}")
        if brut.get("listes") != [[nom, len(listes.get(nom, ()))] for nom in LISTES_HSK]:
            ecarts.append(f"{dossier.name} : comptes par niveau différents des listes")

    return [
        Controle(
            "écriture : gabarits",
            not absents,
            f"{len(versions)} version(s) : {FICHIER} nommé par l'index, {ARPHIC} et"
            " MODIFICATIONS.md à côté, relu sans faute"
            if not absents
            else f"{len(absents)} écarts — " + " ; ".join(absents[:5]),
            bloquant=True,
        ),
        Controle(
            "écriture : couverture",
            not ecarts,
            f"les {len(attendus)} caractères du HSK 3.0, {total} traits, chacun comme ses médianes"
            if not ecarts
            else f"{len(ecarts)} écarts — " + " ; ".join(ecarts[:5]),
            bloquant=True,
        ),
        Controle(
            "écriture : taille",
            not trop_gros,
            f"{', '.join(tailles)} (budget {BUDGET_OCTETS // 1000} Ko)"
            if not trop_gros
            else f"au-delà du budget de {BUDGET_OCTETS} octets : {', '.join(trop_gros)}",
            bloquant=True,
        ),
        Controle(
            "écriture : étendue",
            not points,
            "chaque caractère a une étendue : aucun gabarit réduit à un point"
            if not points
            else f"{len(points)} gabarits réduits à un point : {' '.join(points[:10])}",
        ),
    ]
