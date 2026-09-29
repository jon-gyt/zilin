"""Le rythme gratuit : les lignes du menu, de la route, de Clore et de la journée sans brique.

Un test par règle. Aucun réseau. Les règles : chaque ligne une fois, sourcée, avec ses
seuls jetons ; la limite se dit calmement (ni achat, ni urgence, ni estimation : brief
§10) ; ni emoji, ni dragon ; Tao ne culpabilise jamais ; `rythme.json` dit ce que dit la
source, et l'index le nomme.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import rythme as rythme_mod
from wenlu_data.rythme import CLES, agitations, charger, controles, document, fautes_export, fautes_sources

from test_export import atelier, lire  # noqa: F401 — fixture partagée


def avec(cle: str, fr: str) -> rythme_mod.Rythme:
    """La source versionnée, une ligne remplacée."""
    r = charger()
    return replace(r, lignes=tuple(replace(l, fr=fr) if l.cle == cle else l for l in r.lignes))


def test_la_source_versionnee_est_propre() -> None:
    r = charger()
    assert fautes_sources(r) == []
    assert tuple(l.cle for l in r.lignes) == CLES


def test_la_source_est_tracee() -> None:
    assert all(l.source.startswith(("rédigé pour l'app", "brief §")) for l in charger().lignes)
    assert "rédigé pour l'app" in rythme_mod.TEXTES.read_text(encoding="utf-8")


def test_les_lignes_du_brief_sont_mot_pour_mot() -> None:
    """Ce que le brief écrit (§6, §8), l'app le dit tel quel."""
    t = {l.cle: l.fr for l in charger().lignes}
    assert t["menu_dans"] == "Dans {n} j"
    assert t["route_pierre"] == "prochaine brique dans {n} j"
    assert t["route_carte"] == "Prochaine brique dans {n} jours"
    assert t["route_fin"] == "fin du chemin gratuit"
    assert t["menu_reviser"] == "Réviser encore"


def test_clore_dit_le_rythme_et_que_l_acquis_reste_ouvert() -> None:
    ligne = {l.cle: l.fr for l in charger().lignes}["clore_rythme"]
    assert "deux briques" in ligne and "par semaine" in ligne
    assert "acquis reste ouvert" in ligne


def test_chaque_ligne_est_exigee_une_fois() -> None:
    r = charger()
    sans = replace(r, lignes=tuple(l for l in r.lignes if l.cle != "route_fin"))
    assert any("0 lignes pour route_fin" in f for f in fautes_sources(sans))
    double = replace(r, lignes=(*r.lignes, r.lignes[0]))
    assert any("2 lignes pour menu_demain" in f for f in fautes_sources(double))
    inconnue = replace(r, lignes=(*r.lignes, replace(r.lignes[0], cle="relancer")))
    assert any("clé inconnue 'relancer'" in f for f in fautes_sources(inconnue))
    assert any("ligne incomplète (route_fin)" in f for f in fautes_sources(avec("route_fin", "")))


def test_chaque_ligne_porte_ses_seuls_jetons() -> None:
    assert any("ne porte pas {n}" in f for f in fautes_sources(avec("menu_dans", "Dans quelques jours")))
    assert any("jeton inconnu {jours}" in f for f in fautes_sources(avec("menu_dans", "Dans {n} j, {jours}")))
    assert any("jeton inconnu {n}" in f for f in fautes_sources(avec("route_fin", "fin dans {n} j")))


@pytest.mark.parametrize(
    "cle, ligne, raison",
    [
        ("route_fin", "Fin du chemin gratuit : achète Wenlu complet.", "un achat"),
        ("clore_rythme", "Passe à Wenlu complet pour garder le rythme.", "un achat"),
        ("route_suite_lire", "La suite, pour 29,99 €.", "un achat"),
        ("menu_dans", "Plus que {n} j !", "une urgence"),
        ("route_pierre", "Il ne reste que {n} j", "une urgence"),
        ("route_carte", "Prochaine brique dans environ {n} jours", "une estimation"),
    ],
)
def test_la_limite_se_dit_calmement(cle: str, ligne: str, raison: str) -> None:
    assert raison in agitations(ligne)
    assert any("la limite se dit calmement" in f for f in fautes_sources(avec(cle, ligne)))


def test_tao_ne_parle_jamais_d_achat_ni_ne_culpabilise() -> None:
    assert any("un achat" in f for f in fautes_sources(avec("tao_revoir", "{c} ? Avec Wenlu complet, plus vite.")))
    assert any(
        "Tao ne culpabilise jamais" in f for f in fautes_sources(avec("tao_revoir", "{c}, tu n'as pas assez révisé."))
    )


def test_ni_emoji_ni_dragon() -> None:
    assert any("emoji" in f for f in fautes_sources(avec("menu_demain", "Demain 🌱")))
    assert any("dragon" in f for f in fautes_sources(avec("clore_revue", "{c}, revu comme un dragon.")))


# ----------------------------------------------------------------------------- export


def test_le_document_dit_les_lignes_par_cle() -> None:
    doc = document(en_tete={"version": "0.9.0"})
    assert doc["version"] == "0.9.0"
    assert list(doc["textes"]) == list(CLES)  # type: ignore[arg-type]
    assert doc["textes"]["route_fin"] == "fin du chemin gratuit"  # type: ignore[index]


def test_l_export_se_controle_contre_la_source() -> None:
    r = charger()
    doc = document()
    assert fautes_export(doc, r) == []
    mauvais = json.loads(json.dumps(doc))
    del mauvais["textes"]["menu_dans"]
    mauvais["textes"]["route_fin"] = "Autre chose."
    mauvais["textes"]["relancer"] = "…"
    fautes = fautes_export(mauvais, r)
    assert "menu_dans absente" in fautes
    assert "route_fin n'est pas la ligne des sources" in fautes
    assert "clé inconnue 'relancer'" in fautes
    assert fautes_export({}, r) == ["rythme.json sans lignes"]


def test_l_export_ecrit_rythme_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "rythme.json" in rapport.fichiers
    doc = lire(rapport.dossier, "rythme.json")
    assert export_mod.fautes_de_licence("rythme.json", doc) == []
    assert doc["source"] == rythme_mod.SOURCE_EXPORT
    assert lire(rapport.dossier, "index.json")["rythme"] == "rythme.json"
    assert [c.nom for c in controles(rapport.dossier.parent) if not c.ok] == []


def test_un_export_sans_rythme_json_est_signale(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    (rapport.dossier / "rythme.json").unlink()
    export = next(c for c in controles(rapport.dossier.parent) if c.nom == "rythme : export")
    assert not export.ok and "rythme.json absent" in export.detail


def test_changer_une_ligne_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "rythme.tsv"
    copie.write_text(rythme_mod.TEXTES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(rythme_mod, "TEXTES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "rythme.json").exists(), reason="rythme.json pas encore exporté")
def test_l_export_versionne_passe_les_controles_du_rythme() -> None:
    assert [c.nom for c in controles() if not c.ok] == []
