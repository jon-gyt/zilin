"""Téléchargement : empreintes, journal et idempotence. Aucun accès réseau."""
from __future__ import annotations

from pathlib import Path

from zilin_data.fetch import (
    PRESENT,
    SOURCES_DISTANTES,
    Source,
    ecrire_sommes,
    empreinte,
    journaliser,
    telecharger,
)


def test_empreinte(tmp_path: Path) -> None:
    """SHA-256 du contenu, en hexadécimal."""
    f = tmp_path / "a.txt"
    f.write_bytes(b"zilin")
    assert empreinte(f) == "dcbbe1af4fe6cfde59a47e4bacebf132afa3ce3250fc40a3e7089ffef2bc197c"


def test_telecharger_est_idempotent(tmp_path: Path) -> None:
    """Un fichier déjà présent n'est pas retéléchargé (donc aucun appel réseau)."""
    source = Source(nom="essai", fichier="a.txt", url="https://exemple.invalide/a.txt", licence="—")
    dest = tmp_path / "a.txt"
    dest.write_text("déjà là", encoding="utf-8")
    assert telecharger(source, dest) == PRESENT
    assert dest.read_text(encoding="utf-8") == "déjà là"


def test_sommes_au_format_sha256sum(tmp_path: Path) -> None:
    """SHA256SUMS : empreinte, deux espaces, nom de fichier."""
    source = Source(nom="essai", fichier="a.txt", url="https://exemple.invalide/a.txt", licence="—")
    (tmp_path / "a.txt").write_bytes(b"zilin")
    ligne = ecrire_sommes(tmp_path, (source,)).read_text(encoding="utf-8").strip()
    somme, nom = ligne.split("  ")
    assert nom == "a.txt"
    assert somme == empreinte(tmp_path / "a.txt")


def test_journal_de_provenance(tmp_path: Path) -> None:
    """PROVENANCE.md garde l'URL, la taille, l'empreinte et l'action de chaque source."""
    source = Source(nom="essai", fichier="a.txt", url="https://exemple.invalide/a.txt", licence="CC BY-SA 4.0")
    (tmp_path / "a.txt").write_bytes(b"zilin")
    journaliser(tmp_path, (source,), {"a.txt": "téléchargé"})
    journaliser(tmp_path, (source,), {"a.txt": PRESENT})
    texte = (tmp_path / "PROVENANCE.md").read_text(encoding="utf-8")
    assert "https://exemple.invalide/a.txt" in texte
    assert "CC BY-SA 4.0" in texte
    assert "téléchargé" in texte and PRESENT in texte
    assert texte.count("| `a.txt` |") == 2


def test_sources_declarees() -> None:
    """Les trois sources de la story 1.1 sont déclarées, avec leur licence."""
    fichiers = {s.fichier for s in SOURCES_DISTANTES}
    assert fichiers == {"dictionary.txt", "graphics.txt", "cedict_1_0_ts_utf-8_mdbg.txt.gz"}
    assert all(s.url.startswith("https://") and s.licence for s in SOURCES_DISTANTES)
