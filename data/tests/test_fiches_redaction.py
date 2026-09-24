"""Fiches rédigées sans API : emplacements, brouillons, import, relecture.

Aucun accès réseau, aucune clé d'API. Le corpus est celui, minuscule, de
`test_fiches.py` ; les textes des brouillons de test sont des suites de mots sans
contenu.
"""
from __future__ import annotations

from pathlib import Path

from wenlu_data import fiches, paths


# --------------------------------------------------------------------------- emplacements


def test_les_fiches_sont_versionnees_le_journal_des_lots_non() -> None:
    """Les fiches vivent dans `data/sources/fiches/`, le journal des lots dans `data/work/`."""
    assert paths.FICHES_WORK == paths.DATA / "sources" / "fiches"
    assert fiches.dossier_lots() == paths.WORK / "fiches" / "lots"
    assert fiches.dossier_lots(Path("ailleurs")) == Path("ailleurs") / "lots"
