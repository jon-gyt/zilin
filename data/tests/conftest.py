"""Fixtures communes : les tests d'export restent hermétiques."""
from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _sans_caracteres_d_interface(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Les exports de test ne tirent pas les caractères de l'interface du vrai dépôt.

    `data/sources/interface/caracteres.txt` ajoute la marque et les cases du menu au
    périmètre ; un build factice n'a pas à les recevoir. Un test qui veut le vrai
    fichier le passe explicitement (`caracteres_interface(paths.INTERFACE)`).
    """
    monkeypatch.setattr("wenlu_data.export.INTERFACE", tmp_path / "sans-interface.txt")
