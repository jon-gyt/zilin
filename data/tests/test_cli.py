"""Cohérence de la ligne de commande : ordre des étapes, aides, codes de sortie.

Aucun réseau, aucune clé d'API : les étapes de `wenlu tout` sont remplacées par
des témoins, et les commandes de données pointent sur des dossiers vides.
"""
from __future__ import annotations

from pathlib import Path

import pytest
import typer
from typer.testing import CliRunner

from wenlu_data import cli as cli_mod
from wenlu_data import decoupes as decoupes_mod
from wenlu_data import gf0014 as gf0014_mod
from wenlu_data import graphe as graphe_mod
from wenlu_data import ingest as ingest_mod
from wenlu_data.cli import ETAPES, app


def test_tout_enchaine_les_etapes_dans_l_ordre_des_dependances(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """fetch, puis ingest, puis build, puis export, puis check. Jamais fonts."""
    appels: list[str] = []
    for nom in ETAPES:
        monkeypatch.setattr(cli_mod, nom, lambda *a, _n=nom, **k: appels.append(_n))
    monkeypatch.setattr(cli_mod, "_fonts", lambda *a, **k: appels.append("fonts"))

    resultat = CliRunner().invoke(app, ["tout"])
    assert resultat.exit_code == 0, resultat.output
    assert appels == list(ETAPES) == ["fetch", "ingest", "build", "export", "check"]


def test_tout_s_arrete_a_la_premiere_erreur(monkeypatch: pytest.MonkeyPatch) -> None:
    """Une étape en échec arrête la chaîne : rien ne tourne derrière elle."""
    appels: list[str] = []
    for nom in ETAPES:
        monkeypatch.setattr(cli_mod, nom, lambda *a, _n=nom, **k: appels.append(_n))

    def echoue() -> None:
        appels.append("build")
        raise typer.Exit(code=1)

    monkeypatch.setattr(cli_mod, "build", echoue)
    resultat = CliRunner().invoke(app, ["tout"])
    assert resultat.exit_code == 1
    assert appels == ["fetch", "ingest", "build"], "ni export ni check après l'échec"


def test_ingest_sans_sources_sort_en_1_et_nomme_l_etape_a_lancer(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ingest_mod, "SOURCES", tmp_path / "vide")
    monkeypatch.setattr(ingest_mod, "INGEST", tmp_path / "ingest")
    resultat = CliRunner().invoke(app, ["ingest"])
    assert resultat.exit_code == 1
    assert "wenlu fetch" in resultat.output
    assert list((tmp_path / "ingest").glob("*")) == [], "rien n'est écrit à moitié"


def test_build_sans_ingest_sort_en_1_et_nomme_l_etape_a_lancer(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Les découpes passent les premières : sans ce détour, elles écriraient un
    # `decoupes.json` vide dans le vrai `data/work/build/`.
    monkeypatch.setattr(decoupes_mod, "INGEST", tmp_path / "vide")
    monkeypatch.setattr(decoupes_mod, "BUILD", tmp_path / "build")
    monkeypatch.setattr(gf0014_mod, "INGEST", tmp_path / "vide")
    monkeypatch.setattr(gf0014_mod, "BUILD", tmp_path / "build")
    monkeypatch.setattr(graphe_mod, "INGEST", tmp_path / "vide")
    monkeypatch.setattr(graphe_mod, "BUILD", tmp_path / "build")
    resultat = CliRunner().invoke(app, ["build"])
    assert resultat.exit_code == 1
    assert "wenlu ingest" in resultat.output


def test_chaque_commande_porte_une_aide_en_francais() -> None:
    """Une aide vide, ou en anglais, laisserait `wenlu --help` incompréhensible."""
    sortie = CliRunner().invoke(app, ["--help"]).output
    for nom in (*ETAPES, "fonts", "audio", "contes", "fiches"):
        assert nom in sortie
    for commande in app.registered_commands:
        aide = (commande.help or (commande.callback.__doc__ or "")).strip()
        assert aide, f"{commande.name} sans aide"
        assert aide[0].isupper(), f"{commande.name} : aide qui ne commence pas par une phrase"


def test_le_docstring_du_module_dit_l_ordre_et_les_codes_de_sortie() -> None:
    """Le module est la référence de l'ordre des étapes : il doit les nommer toutes."""
    doc = cli_mod.__doc__ or ""
    for nom in ETAPES:
        assert f"`{nom}`" in doc
    assert "0 tout va bien" in doc and "1 erreur de données" in doc and "2 clé d'API absente" in doc
