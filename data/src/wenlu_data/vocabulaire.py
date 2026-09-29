"""L'image du chemin : les textes d'interface ne disent ni graine, ni forêt, ni arbre, ni borne, ni stèle.

Décisions du propriétaire du 29 septembre 2026 : « Je n'aime pas le terme "Ma forêt"… un
peu ringard » ; l'écran devient « Mon chemin 路 », et toute l'image change (plus de graine,
d'arbre ni de forêt). « Borne et stèle font un peu cimetière… pierre tombale » : plus
aucune borne ni stèle nulle part. Maquette validée : `maquettes/chemin.html`.

Ce contrôle relit les textes que l'app affiche et que le pipeline écrit : les textes
d'écran, les lignes du rythme, les annonces des portes, les textes des examens, les
phrases de Tao, les bêtes du personnage, les rappels. Il ne relit pas le contenu : les
contes, les fiches, les devinettes, les anecdotes et les termes solaires où 木, 树 ou 林
sont ce qu'on apprend à lire, ni le mot à mot du rang 翰林, « la forêt des pinceaux », qui
est le nom d'un rang. « L'arbre des caractères », la décomposition, reste un terme
d'usage (décision du 29 septembre 2026) : il passe.
"""
from __future__ import annotations

import re
from pathlib import Path

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import DATA

SOURCES = DATA / "sources"

#: Les mots de l'ancienne image, au singulier et au pluriel, quelle que soit la casse.
MOTS = re.compile(r"(?<![\w-])(graines?|forêts?|arbres?|bornes?|stèles?)(?![\w-])", re.IGNORECASE)

#: L'arbre de la décomposition, terme d'usage, reste permis.
DECOMPOSITION = re.compile(r"arbres? (?:de (?:la )?décomposition|des caractères)", re.IGNORECASE)

#: Les textes affichés que le pipeline écrit : un motif de fichiers, et les colonnes lues.
TEXTES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("ecrans/*.tsv", ("fr",)),
    ("interface/rythme.tsv", ("fr",)),
    ("ouvertures/portes.tsv", ("annonce",)),
    ("examens/textes.tsv", ("fr",)),
    ("examens/examens.tsv", ("fr",)),
    ("heros/tao.tsv", ("fr",)),
    ("heros/betes.tsv", ("fr", "dit")),
    ("jouer/tao.tsv", ("fr",)),
    ("rappels/textes.tsv", ("fr",)),
)


def mots_interdits(texte: str) -> list[str]:
    """Les mots de l'ancienne image que dit le texte, dans l'ordre, sans doublon."""
    permis = DECOMPOSITION.sub("", texte)
    return list(dict.fromkeys(m.group(1).lower() for m in MOTS.finditer(permis)))


def fichiers(dossier: Path | None = None) -> list[tuple[Path, tuple[str, ...]]]:
    """Les sources relues, chacune avec ses colonnes de texte affiché."""
    racine = dossier or SOURCES
    out: list[tuple[Path, tuple[str, ...]]] = []
    for motif, colonnes in TEXTES:
        out += [(f, colonnes) for f in sorted(racine.glob(motif))]
    return out


def fautes(dossier: Path | None = None) -> list[str]:
    """Chaque texte affiché qui dit graine, forêt, arbre, borne ou stèle, avec sa ligne."""
    racine = dossier or SOURCES
    out: list[str] = []
    for f, colonnes in fichiers(dossier):
        lignes, forme = lire_tsv(f)
        out += forme
        ou = f.relative_to(racine).as_posix()
        for l in lignes:
            for colonne in colonnes:
                mots = mots_interdits(l.cellules.get(colonne, ""))
                if mots:
                    out.append(f"{ou}:{l.numero} : {colonne} dit {', '.join(mots)}")
    return out


def controles(dossier: Path | None = None) -> list[Controle]:
    """Pour `wenlu check`, bloquant : l'image du chemin, jamais celle de la forêt ni des stèles."""
    f = fautes(dossier)
    n = len(fichiers(dossier))
    detail = (
        f"{n} sources de textes affichés, ni graine, ni forêt, ni arbre, ni borne, ni stèle"
        if not f
        else f"{len(f)} écarts — " + " ; ".join(f[:5])
    )
    return [Controle("image du chemin", not f, detail, bloquant=True)]
