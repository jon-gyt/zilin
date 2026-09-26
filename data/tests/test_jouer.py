"""L'écran Jouer : les phrases de Tao, sources, contrôles, export.

Un test par règle. Aucun réseau. Les règles : les quatre phrases de la bulle, une fois
chacune, sourcées, sans jeton ; ni emoji, ni dragon ; Tao ne culpabilise jamais (brief
§9) ; `jouer.json` dit ce que dit la source, et l'index le nomme.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import jouer as jouer_mod
from wenlu_data.jouer import CLES_TAO, charger, controles, document, fautes_export, fautes_sources, reproches

from test_export import atelier, lire  # noqa: F401 — fixture partagée


def avec(cle: str, fr: str) -> jouer_mod.Jouer:
    """La source versionnée, une phrase remplacée."""
    j = charger()
    return replace(j, tao=tuple(replace(t, fr=fr) if t.cle == cle else t for t in j.tao))


def test_la_source_versionnee_est_propre() -> None:
    j = charger()
    assert fautes_sources(j) == []
    assert tuple(t.cle for t in j.tao) == CLES_TAO


def test_les_phrases_sont_celles_que_l_app_disait() -> None:
    """Reprises telles quelles de `jeux.ts` : le comportement de l'écran ne bouge pas."""
    assert {t.cle: t.fr for t in charger().tao} == {
        "invite": "On joue à celui-ci ?",
        "changer": "Et si on changeait un peu ? Celui-ci.",
        "devinette": "On commence par la devinette ?",
        "attendre": "Il n'y a pas encore assez de caractères acquis pour jouer."
        " Reviens après quelques révisions.",
    }


def test_la_source_est_tracee_redigee_pour_l_app() -> None:
    assert {t.source for t in charger().tao} == {"rédigé pour l'app"}
    assert "rédigé pour l'app" in jouer_mod.TAO.read_text(encoding="utf-8").split("\n", 3)[2]


def test_chaque_phrase_est_exigee_une_fois() -> None:
    j = charger()
    sans = replace(j, tao=tuple(t for t in j.tao if t.cle != "attendre"))
    assert any("0 lignes pour attendre" in f for f in fautes_sources(sans))
    double = replace(j, tao=(*j.tao, j.tao[0]))
    assert any("2 lignes pour invite" in f for f in fautes_sources(double))
    inconnue = replace(j, tao=(*j.tao, replace(j.tao[0], cle="gronder")))
    assert any("clé inconnue 'gronder'" in f for f in fautes_sources(inconnue))
    vide = avec("invite", "")
    assert any("phrase incomplète (invite)" in f for f in fautes_sources(vide))


def test_aucune_phrase_ne_porte_de_jeton() -> None:
    assert any("porte un jeton" in f for f in fautes_sources(avec("invite", "On joue à {jeu} ?")))


def test_ni_emoji_ni_dragon() -> None:
    assert any("emoji" in f for f in fautes_sources(avec("invite", "On joue à celui-ci ? 🎲")))
    assert any("dragon" in f for f in fautes_sources(avec("changer", "Et si on jouait au dragon ?")))


@pytest.mark.parametrize(
    "phrase",
    [
        "Tu n'as pas joué aujourd'hui.",
        "Tu ne joues jamais avec moi.",
        "Dommage, on aurait pu jouer.",
        "Je suis déçue.",
        "Toujours pas de jeu ?",
        "Enfin te revoilà !",
        "Tu as oublié la devinette.",
        "Ça fait longtemps qu'on n'a pas joué.",
        "Trois jours sans jouer.",
        "Tu dois réviser d'abord.",
    ],
)
def test_tao_ne_culpabilise_jamais(phrase: str) -> None:
    assert reproches(phrase) != []
    assert any("Tao ne culpabilise jamais" in f for f in fautes_sources(avec("attendre", phrase)))


def test_une_invitation_n_est_pas_un_reproche() -> None:
    for t in charger().tao:
        assert reproches(t.fr) == [], t.cle
    assert reproches("Encore une brique ? Miam.") == []
    assert reproches("On y va doucement ?") == []


# ----------------------------------------------------------------------------- export


def test_le_document_dit_les_phrases_par_cle() -> None:
    doc = document(en_tete={"version": "0.9.0"})
    assert doc["version"] == "0.9.0"
    assert list(doc["tao"]) == list(CLES_TAO)  # type: ignore[arg-type]
    assert doc["tao"]["invite"] == "On joue à celui-ci ?"  # type: ignore[index]


def test_l_export_se_controle_contre_la_source() -> None:
    j = charger()
    doc = document()
    assert fautes_export(doc, j) == []
    mauvais = json.loads(json.dumps(doc))
    del mauvais["tao"]["devinette"]
    mauvais["tao"]["invite"] = "Autre chose."
    mauvais["tao"]["bouder"] = "…"
    fautes = fautes_export(mauvais, j)
    assert "devinette absente" in fautes
    assert "invite n'est pas la phrase des sources" in fautes
    assert "clé inconnue 'bouder'" in fautes
    assert fautes_export({}, j) == ["jouer.json sans phrases de Tao"]


def test_l_export_ecrit_jouer_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "jouer.json" in rapport.fichiers
    doc = lire(rapport.dossier, "jouer.json")
    assert export_mod.fautes_de_licence("jouer.json", doc) == []
    assert doc["source"] == jouer_mod.SOURCE_EXPORT
    assert lire(rapport.dossier, "index.json")["jouer"] == "jouer.json"
    assert [c.nom for c in controles(rapport.dossier.parent) if not c.ok] == []


def test_un_export_sans_jouer_json_est_signale(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    (rapport.dossier / "jouer.json").unlink()
    export = next(c for c in controles(rapport.dossier.parent) if c.nom == "jouer : export")
    assert not export.ok and "jouer.json absent" in export.detail


def test_changer_une_phrase_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "tao.tsv"
    copie.write_text(jouer_mod.TAO.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(jouer_mod, "TAO", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "jouer.json").exists(), reason="jouer.json pas encore exporté")
def test_l_export_versionne_passe_les_controles_de_jouer() -> None:
    assert [c.nom for c in controles() if not c.ok] == []
