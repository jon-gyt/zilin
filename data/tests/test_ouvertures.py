"""Le calendrier d'ouverture, « l'aventure » : les portes, leurs seuils et les annonces de Tao.

Un test par règle. Aucun réseau. Les règles : chaque porte une fois, comptée en jours du
chemin ou en caractères lus, jamais pendant la première session ; une porte vient après
celle qui la contient ; une porte silencieuse vient avec son parent ; une annonce nomme sa
porte, sans achat, urgence, reproche, emoji ni dragon ; Lire est ouvert à la première lettre
de Que, les contes à la première fable ; `ouvertures.json` dit ce que dit la source.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import ouvertures as ouvertures_mod
from wenlu_data.ouvertures import (
    PORTES,
    charger,
    controles,
    document,
    fautes_contenu,
    fautes_export,
    fautes_sources,
    premiere_fable,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée


def avec(porte: str, **champs: str) -> ouvertures_mod.Calendrier:
    """La source versionnée, une porte modifiée."""
    c = charger()
    return replace(c, portes=tuple(replace(p, **champs) if p.porte == porte else p for p in c.portes))


def test_la_source_versionnee_est_propre() -> None:
    c = charger()
    assert fautes_sources(c) == []
    assert sorted(p.porte for p in c.portes) == sorted(PORTES)


def test_la_source_est_tracee() -> None:
    assert all(p.source.startswith("rédigé pour l'app") for p in charger().portes)
    assert "29 septembre 2026" in ouvertures_mod.PORTES_TSV.read_text(encoding="utf-8")


def test_chaque_porte_est_exigee_une_fois() -> None:
    c = charger()
    sans = replace(c, portes=tuple(p for p in c.portes if p.porte != "jouer"))
    assert any("0 lignes pour jouer" in f for f in fautes_sources(sans))
    double = replace(c, portes=(*c.portes, c.portes[0]))
    assert any("2 lignes pour reviser" in f for f in fautes_sources(double))
    inconnue = replace(c, portes=(*c.portes, replace(c.portes[0], porte="boutique")))
    assert any("porte inconnue 'boutique'" in f for f in fautes_sources(inconnue))


def test_toujours_visibles_hors_du_calendrier() -> None:
    """Réglages et Chercher un caractère ne sont pas des portes : ils sont toujours là."""
    assert "reglages" not in PORTES and "chercher" not in PORTES


def test_une_porte_se_compte_en_jours_du_chemin_ou_en_lus() -> None:
    assert any("attendu jour ou lus" in f for f in fautes_sources(avec("foret", unite="date")))
    assert any("attendu jour ou lus" in f for f in fautes_sources(avec("foret", unite="achat")))
    assert any("entier positif" in f for f in fautes_sources(avec("foret", seuil="bientôt")))


def test_le_premier_jour_reste_simple() -> None:
    """La première session pose les jours 1 à 3 : aucune porte ne s'y ouvre."""
    assert any("pendant la première session" in f for f in fautes_sources(avec("reviser", seuil="3")))
    assert fautes_sources(avec("reviser", seuil="4")) == []


def test_une_porte_vient_apres_celle_qui_la_contient() -> None:
    assert any("avant lire" in f for f in fautes_sources(avec("contes", seuil="5")))
    assert any("inconnu ou placé après" in f for f in fautes_sources(avec("contes", parent="monde")))


def test_une_porte_silencieuse_vient_avec_son_parent() -> None:
    assert any("même seuil" in f for f in fautes_sources(avec("jeu-chaine", seuil="8")))
    assert any("Tao doit l'annoncer" in f for f in fautes_sources(avec("route", annonce="-")))


def test_l_annonce_nomme_sa_porte() -> None:
    assert any("ne nomme pas sa porte (玩)" in f for f in fautes_sources(avec("jouer", annonce="Une nouvelle porte.")))


@pytest.mark.parametrize(
    "annonce, raison",
    [
        ("Une nouvelle porte : Jouer 玩, avec Wenlu complet.", "un achat"),
        ("Jouer 玩 est débloqué.", "un achat"),
        ("Vite, une nouvelle porte : Jouer 玩 !", "une urgence"),
        ("Jouer 玩, tu n'as pas encore joué.", "Tao ne culpabilise jamais"),
        ("Une nouvelle porte : Jouer 玩 🎮", "emoji"),
        ("Une nouvelle porte : Jouer 玩, comme un dragon.", "dragon"),
    ],
)
def test_l_aventure_pas_l_argent(annonce: str, raison: str) -> None:
    assert any(raison in f for f in fautes_sources(avec("jouer", annonce=annonce)))


def test_lire_s_ouvre_a_la_premiere_lettre_et_les_contes_a_la_premiere_fable() -> None:
    c = charger()
    assert premiere_fable() == 25
    assert fautes_contenu(c, premiere_lettre=7, premiere_fable=25) == []
    assert any("première lettre" in f for f in fautes_contenu(avec("lire", seuil="9"), premiere_lettre=7, premiere_fable=25))
    assert any("première fable" in f for f in fautes_contenu(avec("contes", seuil="30"), premiere_lettre=7, premiere_fable=25))


# ----------------------------------------------------------------------------- export


def test_le_document_dit_les_portes_dans_l_ordre() -> None:
    doc = document(en_tete={"version": "0.9.0"})
    assert doc["version"] == "0.9.0"
    portes = doc["portes"]
    assert [p["id"] for p in portes] == [p.porte for p in charger().portes]  # type: ignore[index, union-attr]
    jouer = next(p for p in portes if p["id"] == "jouer")  # type: ignore[index, union-attr]
    assert jouer == {"id": "jouer", "unite": "lus", "seuil": 6, "parent": None, "annonce": "Une nouvelle porte : Jouer 玩."}
    chaine = next(p for p in portes if p["id"] == "jeu-chaine")  # type: ignore[index, union-attr]
    assert chaine["parent"] == "jouer" and chaine["annonce"] == ""


def test_l_export_se_controle_contre_la_source() -> None:
    c = charger()
    doc = document()
    assert fautes_export(doc, c) == []
    mauvais = json.loads(json.dumps(doc))
    mauvais["portes"] = [p for p in mauvais["portes"] if p["id"] != "route"]
    assert "route absente" in fautes_export(mauvais, c)
    assert fautes_export({}, c) == ["ouvertures.json sans portes"]


def test_l_export_ecrit_ouvertures_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "ouvertures.json" in rapport.fichiers
    doc = lire(rapport.dossier, "ouvertures.json")
    assert export_mod.fautes_de_licence("ouvertures.json", doc) == []
    assert doc["source"] == ouvertures_mod.SOURCE_EXPORT
    assert lire(rapport.dossier, "index.json")["ouvertures"] == "ouvertures.json"
    assert [c.nom for c in controles(rapport.dossier.parent) if not c.ok] == []


def test_un_export_sans_ouvertures_json_est_signale(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    (rapport.dossier / "ouvertures.json").unlink()
    export = next(c for c in controles(rapport.dossier.parent) if c.nom == "ouvertures : export")
    assert not export.ok and "ouvertures.json absent" in export.detail


def test_changer_une_porte_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "portes.tsv"
    copie.write_text(ouvertures_mod.PORTES_TSV.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(ouvertures_mod, "PORTES_TSV", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "ouvertures.json").exists(), reason="ouvertures.json pas encore exporté")
def test_l_export_versionne_passe_les_controles_des_ouvertures() -> None:
    assert [c.nom for c in controles() if not c.ok] == []
