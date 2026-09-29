"""Le rappel quotidien et la garde de la progression : textes, sources, contrôles, export.

Un test par règle. Aucun réseau. Les règles : chaque texte une fois, sourcé ; ses seuls
jetons ; ni emoji, ni dragon ; un rappel ne culpabilise jamais (ni reproche, ni série
menacée, ni « tu nous manques », ni achat, ni exclamation) ; `rappels.json` dit ce que dit
la source, et l'index le nomme ; changer un texte rend l'export périmé.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import rappels as rappels_mod
from wenlu_data.rappels import CLES, charger, controles, document, fautes_export, fautes_sources, menaces

from test_export import atelier, lire  # noqa: F401 — fixture partagée


def avec(cle: str, fr: str) -> rappels_mod.Rappels:
    """La source versionnée, un texte remplacé."""
    r = charger()
    return replace(r, textes=tuple(replace(t, fr=fr) if t.cle == cle else t for t in r.textes))


def test_la_source_versionnee_est_propre() -> None:
    r = charger()
    assert fautes_sources(r) == []
    assert tuple(t.cle for t in r.textes) == CLES


def test_la_source_est_tracee_redigee_pour_l_app() -> None:
    assert {t.source for t in charger().textes} == {"rédigé pour l'app"}
    assert "rédigé pour l'app" in rappels_mod.TEXTES.read_text(encoding="utf-8")


def test_chaque_texte_est_exige_une_fois() -> None:
    r = charger()
    sans = replace(r, textes=tuple(t for t in r.textes if t.cle != "accueil"))
    assert any("0 lignes pour accueil" in f for f in fautes_sources(sans))
    double = replace(r, textes=(*r.textes, r.textes[0]))
    assert any("2 lignes pour notif_brique_titre" in f for f in fautes_sources(double))
    inconnue = replace(r, textes=(*r.textes, replace(r.textes[0], cle="relance")))
    assert any("clé inconnue 'relance'" in f for f in fautes_sources(inconnue))
    assert any("texte incomplet (reglage)" in f for f in fautes_sources(avec("reglage", "")))


def test_chaque_texte_porte_ses_seuls_jetons() -> None:
    assert any("attendu {c} {sens}" in f for f in fautes_sources(avec("notif_brique", "{c}, la brique.")))
    assert any("attendu {date}" in f for f in fautes_sources(avec("export_date", "Dernier export : hier")))
    assert any("attendu aucun" in f for f in fautes_sources(avec("accueil", "Ajoute {app}.")))


def test_ni_emoji_ni_dragon() -> None:
    assert any("emoji" in f for f in fautes_sources(avec("question", "À quelle heure veux-tu lire ? 🔔")))
    assert any("dragon" in f for f in fautes_sources(avec("reglage_detail", "Le dragon du jour.")))


@pytest.mark.parametrize(
    "texte",
    [
        "Ta série de 12 jours t'attend.",
        "Ne perds pas ta progression.",
        "Tu nous manques.",
        "Tao s'ennuie de toi, tu lui manques.",
        "Tu n'as pas lu aujourd'hui.",
        "Trois jours sans lire.",
        "Dernière chance avant minuit.",
        "Wenlu complet à moins 30 %.",
        "Lis vite ta brique !",
    ],
)
def test_un_rappel_ne_culpabilise_jamais(texte: str) -> None:
    assert menaces(texte) != []
    assert any("ne culpabilise jamais" in f for f in fautes_sources(avec("question_guide", texte)))


def test_les_textes_donnent_quelque_chose_a_lire() -> None:
    for t in charger().textes:
        assert menaces(t.fr) == [], t.cle
    assert menaces("子 · enfant, la brique de ta prochaine session.") == []


# ----------------------------------------------------------------------------- export


def test_le_document_dit_les_textes_par_cle() -> None:
    doc = document(en_tete={"version": "0.9.0"})
    assert doc["version"] == "0.9.0"
    assert list(doc["textes"]) == list(CLES)  # type: ignore[arg-type]
    assert doc["textes"]["export_jamais"] == "Dernier export : jamais"  # type: ignore[index]


def test_l_export_se_controle_contre_la_source() -> None:
    r = charger()
    doc = document()
    assert fautes_export(doc, r) == []
    mauvais = json.loads(json.dumps(doc))
    del mauvais["textes"]["accueil"]
    mauvais["textes"]["question"] = "Autre chose."
    mauvais["textes"]["relance"] = "…"
    fautes = fautes_export(mauvais, r)
    assert "accueil absent" in fautes
    assert "question n'est pas le texte des sources" in fautes
    assert "clé inconnue 'relance'" in fautes
    assert fautes_export({}, r) == ["rappels.json sans textes"]


def test_l_export_ecrit_rappels_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "rappels.json" in rapport.fichiers
    doc = lire(rapport.dossier, "rappels.json")
    assert export_mod.fautes_de_licence("rappels.json", doc) == []
    assert doc["source"] == rappels_mod.SOURCE_EXPORT
    assert lire(rapport.dossier, "index.json")["rappels"] == "rappels.json"
    assert [c.nom for c in controles(rapport.dossier.parent) if not c.ok] == []


def test_un_export_sans_rappels_json_est_signale(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    (rapport.dossier / "rappels.json").unlink()
    export = next(c for c in controles(rapport.dossier.parent) if c.nom == "rappels : export")
    assert not export.ok and "rappels.json absent" in export.detail


def test_changer_un_texte_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "textes.tsv"
    copie.write_text(rappels_mod.TEXTES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(rappels_mod, "TEXTES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "rappels.json").exists(), reason="rappels.json pas encore exporté")
def test_l_export_versionne_passe_les_controles_des_rappels() -> None:
    assert [c.nom for c in controles() if not c.ok] == []
