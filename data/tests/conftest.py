"""Fixtures communes : les tests d'export restent hermétiques."""
from __future__ import annotations

from pathlib import Path

import pytest

from wenlu_data import surcharges

#: Les surcharges versionnées du dépôt, pour les tests qui les lisent exprès.
SURCHARGES_REELLES = {
    "PINYIN": surcharges.PINYIN,
    "IDS": surcharges.IDS,
    "EQUIVALENCES": surcharges.EQUIVALENCES,
    "DECOUPES": surcharges.DECOUPES,
    "MOTS_EXCLUS": surcharges.MOTS_EXCLUS,
    "PHONETIQUES": surcharges.PHONETIQUES,
}


@pytest.fixture(autouse=True)
def _sans_caracteres_d_interface(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Les exports de test ne tirent pas les caractères de l'interface du vrai dépôt.

    `data/sources/interface/caracteres.txt` ajoute la marque et les cases du menu au
    périmètre ; un build factice n'a pas à les recevoir. Un test qui veut le vrai
    fichier le passe explicitement (`caracteres_interface(paths.INTERFACE)`).
    """
    monkeypatch.setattr("wenlu_data.export.INTERFACE", tmp_path / "sans-interface.txt")


@pytest.fixture(autouse=True)
def _sans_surcharges(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Les builds et corpus de test ne tirent pas les surcharges du vrai dépôt.

    Pinyin, IDS, équivalences et mots exclus de `data/sources/` corrigent les vraies
    sources ; un corpus factice n'a pas à les recevoir. Un test qui les veut les
    lit par `SURCHARGES_REELLES`, ou remet le chemin avec `monkeypatch`.
    """
    for nom in SURCHARGES_REELLES:
        monkeypatch.setattr(surcharges, nom, tmp_path / f"sans-surcharge-{nom.lower()}.tsv")


@pytest.fixture(autouse=True)
def _sans_lettres(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Les exports de test ne tirent pas les lettres de Que du vrai dépôt.

    `data/sources/lettres-versions/` porte les douze lettres, qui rempliraient l'aperçu
    de chaque export factice. Un test qui veut les vraies lettres passe le dossier
    explicitement (`lettres.VERSIONS_REELLES`).
    """
    from wenlu_data import lettres

    monkeypatch.setattr(lettres, "VERSIONS", tmp_path / "sans-lettres")
