"""Le rappel quotidien et la garde de la progression : textes, sources, export, contrôles.

Brief §8 : « Notification : une par jour, à l'heure choisie, avec le début de
l'anecdote ». Dans l'app iOS, une notification locale par jour, à l'heure choisie à la
première session (ou dans Réglages) ; sur le web, rien. Le corps est le début de
l'anecdote du jour, que l'app tire de `anecdotes.json` ; quand l'anecdote est déjà lue ou
déjà annoncée, la brique de la prochaine session (« 子 · enfant »). Ce module porte les
seuls textes que l'app ne trouve pas ailleurs : la notification de la brique, la question
de l'heure, la ligne de Réglages, et deux lignes pour garder sa progression (l'écran
d'accueil sur le web iOS, la date du dernier export).

Une source versionnée, rédigée pour l'app et à relire, `data/sources/rappels/textes.tsv`,
lue par `wenlu export`, qui en tire `rappels.json`. L'app ne rédige rien : elle lit
`rappels.json` (`app/src/lib/rappels.ts`).

Le ton : le rappel donne quelque chose à lire, jamais un reproche. `wenlu check` refuse un
texte qui reproche ou compte les jours (les motifs de `jouer.py`), qui menace une série,
dit un manque, parle d'achat, s'exclame, porte un emoji ou un dragon.
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

DOSSIER = DATA / "sources" / "rappels"
TEXTES = DOSSIER / "textes.tsv"

#: Le fichier exporté, que l'index nomme par sa clé `rappels`.
FICHIER = "rappels.json"

#: Les textes, dans l'ordre de la source, et les jetons que chacun porte, tous exigés.
JETONS: dict[str, frozenset[str]] = {
    "notif_brique_titre": frozenset(),
    "notif_brique": frozenset({"c", "sens"}),
    "question": frozenset(),
    "question_guide": frozenset(),
    "question_accord": frozenset(),
    "matin": frozenset(),
    "midi": frozenset(),
    "soir": frozenset(),
    "accepter": frozenset(),
    "refuser": frozenset(),
    "reglage": frozenset(),
    "reglage_detail": frozenset(),
    "reglage_heure": frozenset(),
    "reglage_refuse": frozenset(),
    "accueil": frozenset(),
    "accueil_comment": frozenset(),
    "export_date": frozenset({"date"}),
    "export_jamais": frozenset(),
}
CLES = tuple(JETONS)

#: Ce qu'un rappel ne dit jamais, en plus des reproches de Tao (`jouer.REPROCHES`) : le
#: rapport comparatif du 28 septembre 2026 écarte les notifications culpabilisantes.
MENACES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(motif, re.IGNORECASE), raison)
    for motif, raison in (
        (r"s[ée]rie", "une série menacée"),
        (r"\bmanqu|\bnous manques?\b|\bperd", "un manque, une perte"),
        (r"\bach[ae]t|\bprix\b|€|\bpromo|\bremise|wenlu complet|\bgratuit|\bpayant|\babonn", "un achat"),
        (r"!", "une exclamation"),
        (r"\bvite\b|d[ée]p[êe]che|trop tard|\bdernière chance\b|\burgent", "une urgence"),
    )
)

JETON = re.compile(r"\{([^{}]*)\}")

SOURCE_EXPORT = (
    "data/sources/rappels/textes.tsv : textes du rappel quotidien et de la garde de la"
    " progression, rédigés pour l'app (à relire)"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Texte:
    cle: str
    fr: str
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Rappels:
    """Les textes, et les fautes de forme du fichier."""

    textes: tuple[Texte, ...]
    forme: tuple[str, ...] = field(default=())


def charger(chemin: Path | None = None) -> Rappels:
    """Les textes de `data/sources/rappels/textes.tsv`, dans l'ordre du fichier."""
    lignes, forme = lire_tsv(chemin or TEXTES)
    return Rappels(
        textes=tuple(
            Texte(
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
    """Le JSON écrit dans `rappels.json` : l'en-tête, puis `textes`, par clé."""
    rappels = charger(chemin)
    return {**(en_tete or {}), "textes": {t.cle: t.fr for t in rappels.textes}}


# ------------------------------------------------------------------------- contrôles


def menaces(texte: str) -> list[str]:
    """Ce qu'un texte reproche, menace ou vend : les raisons, sans doublon."""
    return [*reproches(texte), *(raison for motif, raison in MENACES if motif.search(texte))]


def fautes_sources(rappels: Rappels) -> list[str]:
    """Chaque texte une fois, sourcé, avec ses seuls jetons ; ni reproche, ni emoji, ni dragon."""
    fautes = list(rappels.forme)
    cles = [t.cle for t in rappels.textes]
    for cle in CLES:
        if cles.count(cle) != 1:
            fautes.append(f"textes.tsv : {cles.count(cle)} lignes pour {cle}, attendu une")
    for t in rappels.textes:
        ou = f"textes.tsv:{t.numero}"
        if t.cle not in JETONS:
            fautes.append(f"{ou} : clé inconnue {t.cle!r}")
            continue
        if not t.fr or not t.source:
            fautes.append(f"{ou} : texte incomplet ({t.cle})")
            continue
        jetons = set(JETON.findall(t.fr))
        if jetons != JETONS[t.cle]:
            attendus = " ".join(f"{{{j}}}" for j in sorted(JETONS[t.cle])) or "aucun"
            fautes.append(f"{ou} : {t.cle} porte {' '.join(f'{{{j}}}' for j in sorted(jetons)) or 'aucun jeton'}, attendu {attendus}")
        if _EMOJI.search(t.fr):
            fautes.append(f"{ou} : {t.cle} porte un emoji")
        if INTERDITS.search(t.fr):
            fautes.append(f"{ou} : pas de dragon hors du décor des fêtes")
        for raison in menaces(t.fr):
            fautes.append(f"{ou} : un rappel ne culpabilise jamais, {t.cle} porte {raison}")
    return fautes


def fautes_export(sortie: dict[str, object], rappels: Rappels) -> list[str]:
    """L'export dit les textes des sources, ni plus ni moins."""
    textes = sortie.get("textes")
    if not isinstance(textes, dict):
        return [f"{FICHIER} sans textes"]
    attendu = {t.cle: t.fr for t in rappels.textes}
    fautes = [f"{cle} absent" for cle in CLES if cle not in textes]
    fautes += [f"{cle} n'est pas le texte des sources" for cle in CLES if cle in textes and textes[cle] != attendu.get(cle)]
    fautes += [f"clé inconnue {cle!r}" for cle in sorted(set(textes) - set(CLES))]
    return fautes


def controles(destination: Path | None = None, *, chemin: Path | None = None) -> list[Controle]:
    """Contrôles des rappels, pour `wenlu check`. Tous bloquants.

    « sources » : chaque texte une fois, sourcé, avec ses seuls jetons, sans emoji, sans
    dragon, et jamais un reproche, une série menacée, un manque ou un achat. « export » :
    `rappels.json` dit les textes des sources, et `index.json` le nomme.
    """
    from .export import versions_exportees

    rappels = charger(chemin)
    f_src = fautes_sources(rappels)
    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for d in dossiers:
        fichier = d / FICHIER
        if not fichier.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        sortie = json.loads(fichier.read_text(encoding="utf-8"))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sortie, rappels)]
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        if index.get("rappels") != FICHIER:
            f_exp.append(f"{d.name} : index.json ne nomme pas {FICHIER}")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    return [
        Controle(
            "rappels : sources",
            not f_src,
            detail(f_src, f"{len(rappels.textes)} textes, ni reproche, ni série, ni achat, ni emoji, ni dragon"),
            bloquant=True,
        ),
        Controle(
            "rappels : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} dit les textes des sources")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
