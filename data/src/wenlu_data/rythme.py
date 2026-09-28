"""Le rythme gratuit (épic 7, stories 7.2 et 7.5 ; brief §6, §8, §10) : les lignes, sources, export, contrôles.

Après les trente premiers jours du chemin, sans Wenlu complet, deux briques nouvelles par
semaine ; les autres jours, la session revoit une brique acquise. Ces lignes le disent : la
prochaine brique au menu (« Dans 3 j : 子 enfant ») et sur la route devant, la journée sans
brique nouvelle, la ligne de Clore le jour où le rythme gratuit commence. Une source
versionnée, rédigée pour l'app et à relire, `data/sources/interface/rythme.tsv`, lue par
`wenlu export`, qui en tire `rythme.json`.

L'app ne rédige rien : elle lit `rythme.json` (`app/src/lib/rythme.ts`) et remplit les
jetons. La limite se dit calmement (brief §10) : `wenlu check` refuse une ligne qui parle
d'achat ou de Wenlu complet, qui presse ou compte à rebours, qui estime, qui porte un emoji
ou un dragon ; et, pour les phrases de Tao, un reproche (`jouer.reproches`).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .anecdotes import _EMOJI
from .fetes import lire_tsv
from .gf0014 import Controle
from .jouer import INTERDITS, reproches
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "interface"
TEXTES = DOSSIER / "rythme.tsv"

#: Le fichier exporté, que l'index nomme par sa clé `rythme`.
FICHIER = "rythme.json"

#: Les lignes, dans l'ordre de la source, et les jetons que l'app remplit pour chacune :
#: {n} des jours du calendrier, {c} un caractère.
JETONS: dict[str, frozenset[str]] = {
    "menu_demain": frozenset(),
    "menu_dans": frozenset({"n"}),
    "menu_revue": frozenset(),
    "menu_revue_faite": frozenset(),
    "menu_brique_revue": frozenset(),
    "menu_reviser": frozenset(),
    "tao_revoir": frozenset({"c"}),
    "apprendre_revue": frozenset(),
    "clore_revue": frozenset({"c"}),
    "clore_rythme": frozenset(),
    "route_pierre_demain": frozenset(),
    "route_pierre": frozenset({"n"}),
    "route_carte_demain": frozenset(),
    "route_carte": frozenset({"n"}),
    "route_fin": frozenset(),
    "route_suite_lire": frozenset(),
    "route_suite_hsk": frozenset(),
}
CLES = tuple(JETONS)

#: Ce que Tao dit elle-même : jamais un reproche (brief §9).
CLES_TAO = ("tao_revoir", "apprendre_revue")

#: Ce qu'aucune ligne ne dit (brief §10 : « ni compte à rebours, ni relance » ; « Tao ne
#: parle jamais d'achat » ; les jours se calculent, « jamais estimés »). Chaque motif a sa
#: raison, que `wenlu check` affiche.
CALME: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(motif, re.IGNORECASE), raison)
    for motif, raison in (
        (r"achat|achet|payant|pay[ée]|payer|prix|€|abonnement|premium|d[ée]bloqu|wenlu complet", "un achat"),
        (r"compte à rebours|plus que\b|il (?:ne )?reste|seulement|vite|d[ée]p[êe]che|expire|dernier jour|!", "une urgence"),
        (r"environ|à peu près|~|≈|estim|bientôt", "une estimation"),
    )
)

_JETON = re.compile(r"\{([^{}]*)\}")

SOURCE_EXPORT = (
    "data/sources/interface/rythme.tsv : lignes du rythme gratuit (menu, route, Clore,"
    " journée sans brique), rédigées pour l'app (à relire)"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Ligne:
    cle: str
    fr: str
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Rythme:
    """Les lignes, et les fautes de forme du fichier."""

    lignes: tuple[Ligne, ...]
    forme: tuple[str, ...] = field(default=())


def charger(chemin: Path | None = None) -> Rythme:
    """Les lignes de `data/sources/interface/rythme.tsv`, dans l'ordre du fichier."""
    lignes, forme = lire_tsv(chemin or TEXTES)
    return Rythme(
        lignes=tuple(
            Ligne(
                cle=l.cellules.get("cle", ""),
                fr=l.cellules.get("fr", ""),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in lignes
        ),
        forme=tuple(forme),
    )


# ---------------------------------------------------------------------------- export


def document(en_tete: dict[str, object] | None = None, chemin: Path | None = None) -> dict[str, object]:
    """Le JSON écrit dans `rythme.json` : l'en-tête, puis `textes`, les lignes par clé."""
    r = charger(chemin)
    return {**(en_tete or {}), "textes": {l.cle: l.fr for l in r.lignes}}


# ------------------------------------------------------------------------- contrôles


def agitations(texte: str) -> list[str]:
    """Ce qu'une ligne dit de trop : un achat, une urgence, une estimation. Sans doublon."""
    return [raison for motif, raison in CALME if motif.search(texte)]


def fautes_sources(r: Rythme) -> list[str]:
    """Chaque ligne une fois, sourcée, avec ses seuls jetons ; calme, sans emoji ni dragon."""
    fautes = list(r.forme)
    cles = [l.cle for l in r.lignes]
    for cle in CLES:
        if cles.count(cle) != 1:
            fautes.append(f"rythme.tsv : {cles.count(cle)} lignes pour {cle}, attendu une")
    for l in r.lignes:
        ou = f"rythme.tsv:{l.numero}"
        if l.cle not in JETONS:
            fautes.append(f"{ou} : clé inconnue {l.cle!r}")
            continue
        if not l.fr or not l.source:
            fautes.append(f"{ou} : ligne incomplète ({l.cle})")
            continue
        jetons = set(_JETON.findall(l.fr))
        for j in sorted(jetons - JETONS[l.cle]):
            fautes.append(f"{ou} : {l.cle} porte le jeton inconnu {{{j}}}")
        for j in sorted(JETONS[l.cle] - jetons):
            fautes.append(f"{ou} : {l.cle} ne porte pas {{{j}}}")
        if _EMOJI.search(l.fr):
            fautes.append(f"{ou} : {l.cle} porte un emoji")
        if INTERDITS.search(l.fr):
            fautes.append(f"{ou} : pas de dragon hors du décor des fêtes")
        for raison in agitations(l.fr):
            fautes.append(f"{ou} : la limite se dit calmement, {l.cle} porte {raison}")
        if l.cle in CLES_TAO:
            for raison in reproches(l.fr):
                fautes.append(f"{ou} : Tao ne culpabilise jamais, {l.cle} porte {raison}")
    return fautes


def fautes_export(sortie: dict[str, object], r: Rythme) -> list[str]:
    """L'export dit les lignes des sources, ni plus ni moins."""
    textes = sortie.get("textes")
    if not isinstance(textes, dict):
        return ["rythme.json sans lignes"]
    attendu = {l.cle: l.fr for l in r.lignes}
    fautes = [f"{cle} absente" for cle in CLES if cle not in textes]
    fautes += [
        f"{cle} n'est pas la ligne des sources" for cle in CLES if cle in textes and textes[cle] != attendu.get(cle)
    ]
    fautes += [f"clé inconnue {cle!r}" for cle in sorted(set(textes) - set(CLES))]
    return fautes


def controles(destination: Path | None = None, *, chemin: Path | None = None) -> list[Controle]:
    """Contrôles du rythme gratuit, pour `wenlu check`. Tous bloquants.

    « sources » : les dix-sept lignes, une fois chacune, sourcées, avec leurs seuls jetons ;
    ni achat, ni urgence, ni estimation, ni emoji, ni dragon ; Tao ne reproche rien.
    « export » : `rythme.json` dit les lignes des sources, et `index.json` le nomme.
    """
    from .export import versions_exportees

    r = charger(chemin)
    f_src = fautes_sources(r)
    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for d in dossiers:
        fichier = d / FICHIER
        if not fichier.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        sortie = json.loads(fichier.read_text(encoding="utf-8"))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sortie, r)]
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        if index.get("rythme") != FICHIER:
            f_exp.append(f"{d.name} : index.json ne nomme pas {FICHIER}")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    return [
        Controle(
            "rythme : sources",
            not f_src,
            detail(f_src, f"{len(r.lignes)} lignes, calmes, sans achat ni compte à rebours"),
            bloquant=True,
        ),
        Controle(
            "rythme : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} dit les lignes des sources")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
