"""Les fêtes : calendrier luni-solaire, textes, export et contrôles. Aucun réseau.

Les dates de référence sont celles que le prototype et le calendrier officiel
donnent : 中秋 2026-09-25 et 2027-09-15, 春节 2026-02-17 et 2027-02-06.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import fetes as fetes_mod
from wenlu_data.fetes import (
    ANNEES,
    REGLES,
    calculer,
    charger_animaux,
    charger_calendrier,
    charger_textes,
    controles,
    date_de,
    fautes_calendrier,
    fautes_textes,
    rang_animal,
    tsv_calendrier,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée


# ---------------------------------------------------------------------------- dates


@pytest.mark.parametrize(
    ("fete", "annee", "attendue"),
    [
        ("zhongqiu", 2026, "2026-09-25"),
        ("chunjie", 2027, "2027-02-06"),
        ("chunjie", 2026, "2026-02-17"),
        ("zhongqiu", 2027, "2027-09-15"),
    ],
)
def test_les_dates_connues_sortent_du_calendrier_lunaire(fete: str, annee: int, attendue: str) -> None:
    assert date_de(REGLES[fete], annee).isoformat() == attendue


def test_les_fenetres_vont_du_reveillon_a_yuanxiao_et_de_moins_trois_a_plus_un() -> None:
    assert (REGLES["chunjie"].avant, REGLES["chunjie"].apres) == (1, 14)
    assert (REGLES["zhongqiu"].avant, REGLES["zhongqiu"].apres) == (3, 1)


def test_l_animal_depend_de_l_annee_lunaire() -> None:
    animaux = charger_animaux()
    assert animaux[rang_animal(2027)].hanzi == "羊"
    assert animaux[rang_animal(2027)].fr == "de la Chèvre"
    assert animaux[rang_animal(2026)].hanzi == "马"
    assert [e.animal for e in calculer(2026, 2027) if e.fete == "chunjie"] == ["马", "羊"]


def test_le_calendrier_versionne_est_celui_que_la_commande_ecrit() -> None:
    """`calendrier.tsv` n'est jamais édité à la main : le recalcul redonne les mêmes octets."""
    texte = tsv_calendrier(calculer(*ANNEES))
    assert fetes_mod.CALENDRIER.read_text(encoding="utf-8") == texte


def test_le_calendrier_couvre_2026_a_2035_sans_faute() -> None:
    entrees = charger_calendrier()
    assert {e.annee for e in entrees} >= set(range(2026, 2036))
    assert fautes_calendrier(entrees, charger_animaux()) == []


def test_une_date_retouchee_a_la_main_est_une_faute() -> None:
    entrees = charger_calendrier()
    fausse = [
        fetes_mod.Entree(**{**e.__dict__, "date": "2026-09-26"}) if e.date == "2026-09-25" else e
        for e in entrees
    ]
    fautes = fautes_calendrier(fausse, charger_animaux())
    assert any("2026-09-26" in f and "2026-09-25" in f for f in fautes)


def test_une_date_illisible_une_annee_absente_un_mauvais_animal_sont_des_fautes() -> None:
    entrees = [e for e in charger_calendrier() if e.annee != 2030]
    entrees[0] = fetes_mod.Entree(**{**entrees[0].__dict__, "date": "2026-02-30"})
    entrees[1] = fetes_mod.Entree(**{**entrees[1].__dict__, "animal": "龙"})
    fautes = " | ".join(fautes_calendrier(entrees, charger_animaux(), recalculer=False))
    assert "date illisible" in fautes
    assert "années absentes 2030" in fautes
    assert "animal 龙" in fautes


# ---------------------------------------------------------------------------- textes


def test_les_textes_versionnes_sont_complets_et_sources() -> None:
    textes = charger_textes()
    assert fautes_textes(textes, REGLES) == []
    assert all(t.source == "rédigé pour l'app" for t in textes)
    assert fetes_mod.caracteres_dessines(textes) == ["年", "月", "福"]


def test_un_texte_vide_ou_un_jeton_inconnu_est_une_faute() -> None:
    textes = [t for t in charger_textes() if not (t.fete == "zhongqiu" and t.cle == "anecdote_titre")]
    textes.append(fetes_mod.Texte("chunjie", "tao", "", "rédigé pour l'app", 99))
    textes.append(fetes_mod.Texte("chunjie", "tao", "Le {lapin} saute.", "rédigé pour l'app", 100))
    fautes = " | ".join(fautes_textes(textes, REGLES))
    assert "zhongqiu : sans anecdote_titre" in fautes
    assert "chunjie tao vide" in fautes
    assert "jeton inconnu {lapin}" in fautes


# ---------------------------------------------------------------------------- export


def test_l_export_ecrit_fetes_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.1.0")
    document = lire(rapport.dossier, "fetes.json")
    assert export_mod.fautes_de_licence("fetes.json", document) == []
    assert "rédigés pour l'app" in str(document["source"])
    assert lire(rapport.dossier, "index.json")["fetes"] == "fetes.json"
    chunjie = document["fetes"]["chunjie"]  # type: ignore[index]
    assert chunjie["voeu"] == {"zh": "新年快乐", "pinyin": "xīnnián kuàilè", "fr": "Bonne année {animal}"}
    assert chunjie["caractere_voeu"] == "福"
    assert chunjie["anecdote"]["c"] == "年"
    assert document["fetes"]["zhongqiu"]["caractere_voeu"] is None  # type: ignore[index]
    annee_2027 = next(
        e for e in document["calendrier"] if e["fete"] == "chunjie" and e["annee"] == 2027  # type: ignore[union-attr]
    )
    assert annee_2027["date"] == "2027-02-06"
    assert annee_2027["animal"] == {"c": "羊", "pinyin": "yáng", "fr": "de la Chèvre"}


def test_un_caractere_dessine_entre_dans_le_perimetre_avec_ses_briques(atelier: Path) -> None:  # noqa: F811
    """月 est dans le build miniature : il est exporté, et `racines` dit où lire ses traits."""
    rapport = export_mod.export("0.1.0")
    assert lire(rapport.dossier, "fetes.json")["racines"] == {"月": "月"}
    assert "月" in lire(rapport.dossier, "traits/月.json")["traits"]  # type: ignore[operator]


def test_changer_un_texte_de_fete_rend_l_export_perime(atelier: Path, tmp_path: Path, monkeypatch) -> None:  # noqa: F811
    copie = tmp_path / "textes.tsv"
    shutil.copy(fetes_mod.TEXTES, copie)
    monkeypatch.setattr(fetes_mod, "TEXTES", copie)
    export_mod.export("0.1.0")
    a_jour = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert a_jour["export : à jour"].ok
    copie.write_text(copie.read_text(encoding="utf-8").replace("Miam.", "Miam !"), encoding="utf-8")
    perime = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert not perime["export : à jour"].ok


# ---------------------------------------------------------------------------- check


def test_le_controle_voit_un_caractere_dessine_sans_traits(atelier: Path) -> None:  # noqa: F811
    """Le build miniature n'a ni 年 ni 福 : l'export ne peut pas les dessiner, c'est bloquant."""
    export_mod.export("0.1.0")
    resultats = {c.nom: c for c in controles(export_mod.EXPORT)}
    assert resultats["fêtes : calendrier"].ok
    assert resultats["fêtes : textes"].ok
    dessines = resultats["fêtes : caractères dessinés"]
    assert not dessines.ok and dessines.bloquant
    assert "0.1.0:年" in dessines.detail and "0.1.0:福" in dessines.detail
    assert "月" not in dessines.detail


def test_sans_export_le_controle_des_caracteres_ne_bloque_pas(tmp_path: Path) -> None:
    resultats = {c.nom: c for c in controles(tmp_path / "vide")}
    assert resultats["fêtes : caractères dessinés"].ok


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "fetes.json").exists(), reason="export versionné absent")
def test_l_export_versionne_dessine_les_caracteres_des_fetes() -> None:
    document = json.loads((VERSIONNE / "fetes.json").read_text(encoding="utf-8"))
    assert document["racines"] == {"年": "年", "月": "月", "福": "礻"}
    assert all(c.ok for c in controles())
