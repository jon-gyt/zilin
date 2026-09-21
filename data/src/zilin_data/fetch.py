"""Téléchargement des sources brutes dans data/work/sources/.

Idempotent : un fichier déjà présent n'est pas retéléchargé (sauf `force=True`).
Chaque passage réécrit data/work/sources/SHA256SUMS et complète
data/work/sources/PROVENANCE.md (URL, date, taille, empreinte).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx

from .paths import SOURCES

MMAH = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/"


@dataclass(frozen=True)
class Source:
    nom: str
    fichier: str
    url: str
    licence: str


SOURCES_DISTANTES: tuple[Source, ...] = (
    Source(
        nom="Make Me a Hanzi — dictionnaire",
        fichier="dictionary.txt",
        url=MMAH + "dictionary.txt",
        licence="LGPL 3.0 (données)",
    ),
    Source(
        nom="Make Me a Hanzi — graphies",
        fichier="graphics.txt",
        url=MMAH + "graphics.txt",
        licence="Arphic Public License (tracés)",
    ),
    Source(
        nom="CC-CEDICT",
        fichier="cedict_1_0_ts_utf-8_mdbg.txt.gz",
        url="https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
        licence="CC BY-SA 4.0",
    ),
)


def empreinte(chemin: Path) -> str:
    """SHA-256 du fichier, en hexadécimal."""
    h = hashlib.sha256()
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


PRESENT = "déjà présent"
TELECHARGE = "téléchargé"


def telecharger(source: Source, dest: Path, *, force: bool = False) -> str:
    """Écrit `source` dans `dest`. Retourne l'état (`PRESENT`, `TELECHARGE` ou `échec : …`)."""
    if dest.exists() and not force:
        return PRESENT
    dest.parent.mkdir(parents=True, exist_ok=True)
    partiel = dest.with_suffix(dest.suffix + ".partiel")
    try:
        with httpx.stream("GET", source.url, follow_redirects=True, timeout=120.0) as reponse:
            reponse.raise_for_status()
            with partiel.open("wb") as f:
                for bloc in reponse.iter_bytes(1 << 16):
                    f.write(bloc)
    except httpx.HTTPError as erreur:
        partiel.unlink(missing_ok=True)
        return f"échec : {type(erreur).__name__} {erreur}"
    partiel.replace(dest)
    return TELECHARGE


def ecrire_sommes(dossier: Path, sources: tuple[Source, ...]) -> Path:
    """Écrit SHA256SUMS au format `sha256sum` (empreinte, deux espaces, nom)."""
    lignes = [
        f"{empreinte(dossier / s.fichier)}  {s.fichier}"
        for s in sources
        if (dossier / s.fichier).exists()
    ]
    chemin = dossier / "SHA256SUMS"
    chemin.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return chemin


def journaliser(dossier: Path, sources: tuple[Source, ...], etat: dict[str, str]) -> Path:
    """Ajoute au PROVENANCE.md un bloc daté décrivant l'état des sources."""
    chemin = dossier / "PROVENANCE.md"
    if not chemin.exists():
        entete = (
            "# Provenance des sources\n\n"
            "Journal produit par `uv run zilin fetch`. Un bloc par passage.\n"
        )
        chemin.write_text(entete, encoding="utf-8")
    date = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    lignes = [f"\n## {date}\n", "| Fichier | URL | Octets | SHA-256 | Licence | Action |", "|---|---|---|---|---|---|"]
    for s in sources:
        f = dossier / s.fichier
        octets = f.stat().st_size if f.exists() else 0
        somme = empreinte(f) if f.exists() else "—"
        action = etat.get(s.fichier, "inconnu")
        lignes.append(
            f"| `{s.fichier}` | {s.url} | {octets} | `{somme}` | {s.licence} | {action} |"
        )
    with chemin.open("a", encoding="utf-8") as sortie:
        sortie.write("\n".join(lignes) + "\n")
    return chemin


def fetch(*, force: bool = False, dossier: Path | None = None) -> dict[str, str]:
    """Télécharge toutes les sources. Retourne {fichier: état}."""
    dossier = dossier or SOURCES
    dossier.mkdir(parents=True, exist_ok=True)
    etat = {s.fichier: telecharger(s, dossier / s.fichier, force=force) for s in SOURCES_DISTANTES}
    ecrire_sommes(dossier, SOURCES_DISTANTES)
    journaliser(dossier, SOURCES_DISTANTES, etat)
    return etat
