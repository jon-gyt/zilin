"""L'écran Jouer (brief §9 « L'écran Jouer ») : les phrases de Tao, sources, export, contrôles.

Tao, dans sa posture de jeu, tend un jeu dans une bulle : elle invite, ou, quand elle
s'ennuie, propose de changer ; sans jeu à tendre, elle montre la devinette qui attend,
ou dit ce qui manque. Une source versionnée, rédigée pour l'app et à relire,
`data/sources/jouer/tao.tsv`, lue par `wenlu export`, qui en tire `jouer.json`.

L'app ne rédige rien : elle lit `jouer.json` (`app/src/lib/jouer.ts`) et choisit la
phrase (`jeux.bulleDeTao`). Tao ne culpabilise jamais (brief §9) : `wenlu check` refuse
une phrase qui reproche, qui compte les jours, qui porte un emoji ou un dragon.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .anecdotes import _EMOJI
from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "jouer"
TAO = DOSSIER / "tao.tsv"

#: Le fichier exporté, que l'index nomme par sa clé `jouer`.
FICHIER = "jouer.json"

#: Les phrases de la bulle, dans l'ordre de la source : Tao tend un jeu (`invite`), le
#: tend en s'ennuyant (`changer`), montre la devinette (`devinette`), ou attend l'acquis
#: (`attendre`). Aucune ne porte de jeton.
CLES_TAO = ("invite", "changer", "devinette", "attendre")

#: Ce qu'une phrase de Tao ne dit jamais (brief §9) : un reproche, un regret, un compte de
#: jours ou d'absence. Chaque motif a sa raison, que `wenlu check` affiche.
REPROCHES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(motif, re.IGNORECASE), raison)
    for motif, raison in (
        (r"\btu n'as (?:pas|jamais|rien)\b|\btu ne \w+ (?:pas|jamais|plus)\b", "« tu n'as pas… »"),
        (r"\btu aurais d[uû]\b|\bil fallait\b|\btu dois\b|\bil faut que tu\b", "une injonction"),
        (r"dommage|d[ée]çue?\b|d[ée]cevant|hélas|tant pis", "un regret"),
        (r"\brat[ée]e?s?\b|\bnulle?s?\b|\bfautes?\b|\bparesse", "un jugement"),
        (r"\btoujours pas\b|\bencore rien\b|\benfin\b|pas assez jou", "une impatience"),
        (r"oubli|abandonn|manqu[ée]", "un oubli, un manque reproché"),
        (r"\bdepuis\b|\bhier\b|\bjours? sans\b|ça fait (?:longtemps|\d)|où étais", "un compte du temps"),
    )
)

#: Le dragon reste au décor de deux fêtes (CLAUDE.md).
INTERDITS = re.compile(r"dragon|龙|龍", re.IGNORECASE)

SOURCE_EXPORT = (
    "data/sources/jouer/tao.tsv : phrases de Tao sur l'écran Jouer, rédigées pour l'app (à relire)"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Phrase:
    cle: str
    fr: str
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Jouer:
    """Les phrases de Tao, et les fautes de forme du fichier."""

    tao: tuple[Phrase, ...]
    forme: tuple[str, ...] = field(default=())


def charger(chemin: Path | None = None) -> Jouer:
    """Les phrases de `data/sources/jouer/tao.tsv`, dans l'ordre du fichier."""
    lignes, forme = lire_tsv(chemin or TAO)
    return Jouer(
        tao=tuple(
            Phrase(
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
    """Le JSON écrit dans `jouer.json` : l'en-tête, puis `tao`, les phrases par clé."""
    jouer = charger(chemin)
    return {**(en_tete or {}), "tao": {t.cle: t.fr for t in jouer.tao}}


# ------------------------------------------------------------------------- contrôles


def reproches(texte: str) -> list[str]:
    """Ce qu'une phrase reproche, ou compte du temps passé : les raisons, sans doublon."""
    return [raison for motif, raison in REPROCHES if motif.search(texte)]


def fautes_sources(jouer: Jouer) -> list[str]:
    """Les quatre phrases, une fois chacune, sans jeton ; ni reproche, ni emoji, ni dragon."""
    fautes = list(jouer.forme)
    cles = [t.cle for t in jouer.tao]
    for cle in CLES_TAO:
        if cles.count(cle) != 1:
            fautes.append(f"tao.tsv : {cles.count(cle)} lignes pour {cle}, attendu une")
    for t in jouer.tao:
        ou = f"tao.tsv:{t.numero}"
        if t.cle not in CLES_TAO:
            fautes.append(f"{ou} : clé inconnue {t.cle!r}")
            continue
        if not t.fr or not t.source:
            fautes.append(f"{ou} : phrase incomplète ({t.cle})")
        if "{" in t.fr or "}" in t.fr:
            fautes.append(f"{ou} : {t.cle} porte un jeton, l'app n'en remplit aucun")
        if _EMOJI.search(t.fr):
            fautes.append(f"{ou} : {t.cle} porte un emoji")
        if INTERDITS.search(t.fr):
            fautes.append(f"{ou} : pas de dragon hors du décor des fêtes")
        for raison in reproches(t.fr):
            fautes.append(f"{ou} : Tao ne culpabilise jamais, {t.cle} porte {raison}")
    return fautes


def fautes_export(sortie: dict[str, object], jouer: Jouer) -> list[str]:
    """L'export dit les phrases des sources, ni plus ni moins."""
    tao = sortie.get("tao")
    if not isinstance(tao, dict):
        return ["jouer.json sans phrases de Tao"]
    attendu = {t.cle: t.fr for t in jouer.tao}
    fautes = [f"{cle} absente" for cle in CLES_TAO if cle not in tao]
    fautes += [f"{cle} n'est pas la phrase des sources" for cle in CLES_TAO if cle in tao and tao[cle] != attendu.get(cle)]
    fautes += [f"clé inconnue {cle!r}" for cle in sorted(set(tao) - set(CLES_TAO))]
    return fautes


def controles(destination: Path | None = None, *, chemin: Path | None = None) -> list[Controle]:
    """Contrôles de l'écran Jouer, pour `wenlu check`. Tous bloquants.

    « sources » : les quatre phrases de Tao, une fois chacune, sourcées, sans jeton, sans
    emoji, sans dragon, et jamais un reproche (brief §9). « export » : `jouer.json` dit les
    phrases des sources, et `index.json` le nomme.
    """
    from .export import versions_exportees

    jouer = charger(chemin)
    f_src = fautes_sources(jouer)
    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for d in dossiers:
        fichier = d / FICHIER
        if not fichier.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        sortie = json.loads(fichier.read_text(encoding="utf-8"))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sortie, jouer)]
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        if index.get("jouer") != FICHIER:
            f_exp.append(f"{d.name} : index.json ne nomme pas {FICHIER}")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    return [
        Controle(
            "jouer : sources",
            not f_src,
            detail(f_src, f"{len(jouer.tao)} phrases de Tao, ni reproche, ni emoji, ni dragon"),
            bloquant=True,
        ),
        Controle(
            "jouer : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} dit les phrases des sources")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
