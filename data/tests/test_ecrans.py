"""Les textes d'écran : « Lire le monde » et le tableau des révisions, sources, contrôles, export.

Un test par règle. Aucun réseau. Les règles : chaque clé une fois, sourcée, avec
exactement ses jetons ; ni emoji, ni dragon ; rien au temps passé, ni classement, ni
percentile (CLAUDE.md) ; les sept jours de la semaine ; `ecrans.json` dit ce que disent
les sources, et l'index le nomme.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import ecrans as ecrans_mod
from wenlu_data import export as export_mod
from wenlu_data.ecrans import ECRANS, charger, controles, document, fautes_export, fautes_sources, interdits

from test_export import atelier, lire  # noqa: F401 — fixture partagée


def avec(ecran: str, cle: str, fr: str) -> ecrans_mod.Ecrans:
    """Les sources versionnées, un texte remplacé."""
    e = charger()
    textes = dict(e.textes)
    textes[ecran] = tuple(replace(t, fr=fr) if t.cle == cle else t for t in e.textes[ecran])
    return replace(e, textes=textes)


def test_les_sources_versionnees_sont_propres() -> None:
    e = charger()
    assert fautes_sources(e) == []
    for ecran, cles in ECRANS.items():
        assert tuple(t.cle for t in e.textes[ecran]) == tuple(cles), ecran


def test_les_sources_sont_tracees_redigees_pour_l_app() -> None:
    e = charger()
    for ecran in ECRANS:
        assert {t.source for t in e.textes[ecran]} == {"rédigé pour l'app"}
        assert "rédigé pour l'app" in ecrans_mod.chemin(ecran).read_text(encoding="utf-8")


def test_le_constat_dit_ce_qu_on_lit() -> None:
    """« Tu lis 9 caractères sur 14 » : le rapport, §2.5."""
    lm = {t.cle: t.fr for t in charger().textes["lire-le-monde"]}
    assert lm["compte"].format(lus=9, total=14) == "Tu lis 9 caractères sur 14."
    assert lm["compte-un"].format(lus=1, total=3) == "Tu lis 1 caractère sur 3."


def test_le_personnage_et_la_route_disent_les_examens_comme_le_brief() -> None:
    """« Points ET examen » (8.5) et la borne de la route (8.6), brief §8, mot pour mot."""
    perso = {t.cle: t.fr for t in charger().textes["personnage"]}
    assert perso["reste"].format(examen="院试") == "Reste le 院试"
    assert perso["recu"].format(examen="院试", n=12) == "Reçu au 院试 · encore 12 points"
    assert perso["ouvert"] == "examen ouvert"
    route = {t.cle: t.fr for t in charger().textes["route"]}
    assert route["examen"].format(examen="县试", n=50) == "县试 · 50 caractères"
    assert route["ouvert"] == "examen ouvert"


def test_la_photo_passe_par_le_texte_en_direct_sans_reseau() -> None:
    aide = {t.cle: t.fr for t in charger().textes["lire-le-monde"]}["aide-iphone"]
    assert "Texte en direct" in aide


def test_chaque_cle_est_exigee_une_fois() -> None:
    e = charger()
    sans = replace(e, textes={**e.textes, "revisions": e.textes["revisions"][1:]})
    assert any("0 lignes pour entree" in f for f in fautes_sources(sans))
    double = replace(e, textes={**e.textes, "revisions": (*e.textes["revisions"], e.textes["revisions"][0])})
    assert any("2 lignes pour entree" in f for f in fautes_sources(double))
    inconnue = replace(
        e, textes={**e.textes, "revisions": (*e.textes["revisions"], replace(e.textes["revisions"][0], cle="podium"))}
    )
    assert any("clé inconnue 'podium'" in f for f in fautes_sources(inconnue))
    assert any("texte incomplet (titre)" in f for f in fautes_sources(avec("revisions", "titre", "")))


def test_chaque_texte_porte_exactement_ses_jetons() -> None:
    assert any("attendu lus, total" in f for f in fautes_sources(avec("lire-le-monde", "compte", "Tu lis {lus}.")))
    assert any("attendu aucun" in f for f in fautes_sources(avec("lire-le-monde", "mots", "Les {n} mots")))
    assert any("attendu n" in f for f in fautes_sources(avec("lire-le-monde", "dans", "dans {n} j {n}")))


def test_ni_emoji_ni_dragon() -> None:
    assert any("emoji" in f for f in fautes_sources(avec("revisions", "titre", "Tes révisions 🎯")))
    assert any("dragon" in f for f in fautes_sources(avec("lire-le-monde", "invite", "Colle 龙 ici.")))


@pytest.mark.parametrize(
    "texte",
    [
        "Tu as révisé 12 minutes cette semaine.",
        "Une heure de lecture.",
        "Temps passé : 3 h.",
        "Ton classement : 4e.",
        "Tu fais mieux que 80 % des apprenants.",
        "Tu es dans le 90e percentile.",
    ],
)
def test_rien_au_temps_passe_ni_classement(texte: str) -> None:
    assert interdits(texte) != []
    assert any("porte" in f for f in fautes_sources(avec("revisions", "entree-vide", texte)))


def test_les_sept_jours_de_la_semaine() -> None:
    assert any("jours porte 6 noms" in f for f in fautes_sources(avec("revisions", "jours", "dim. lun. mar. mer. jeu. ven.")))


def test_les_textes_versionnes_ne_disent_ni_temps_ni_classement() -> None:
    for ecran, textes in charger().textes.items():
        for t in textes:
            assert interdits(t.fr) == [], (ecran, t.cle)


# ----------------------------------------------------------------------------- export


def test_le_document_dit_les_textes_par_ecran_et_par_cle() -> None:
    doc = document(en_tete={"version": "0.9.0"})
    assert doc["version"] == "0.9.0"
    for ecran, cles in ECRANS.items():
        assert list(doc[ecran]) == list(cles)  # type: ignore[arg-type]
    assert doc["revisions"]["titre"] == "Tes révisions"  # type: ignore[index]


def test_l_export_se_controle_contre_les_sources() -> None:
    e = charger()
    doc = document()
    assert fautes_export(doc, e) == []
    mauvais = json.loads(json.dumps(doc))
    del mauvais["revisions"]["titre"]
    mauvais["lire-le-monde"]["compte"] = "Autre chose."
    mauvais["lire-le-monde"]["podium"] = "…"
    fautes = fautes_export(mauvais, e)
    assert "revisions/titre absent" in fautes
    assert "lire-le-monde/compte n'est pas le texte des sources" in fautes
    assert "lire-le-monde : clé inconnue 'podium'" in fautes
    assert "revisions absent" in fautes_export({}, e)


def test_l_export_ecrit_ecrans_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "ecrans.json" in rapport.fichiers
    doc = lire(rapport.dossier, "ecrans.json")
    assert export_mod.fautes_de_licence("ecrans.json", doc) == []
    assert doc["source"] == ecrans_mod.SOURCE_EXPORT
    assert lire(rapport.dossier, "index.json")["ecrans"] == "ecrans.json"
    assert [c.nom for c in controles(rapport.dossier.parent) if not c.ok] == []


def test_un_export_sans_ecrans_json_est_signale(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    (rapport.dossier / "ecrans.json").unlink()
    export = next(c for c in controles(rapport.dossier.parent) if c.nom == "écrans : export")
    assert not export.ok and "ecrans.json absent" in export.detail


def test_changer_un_texte_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    for ecran in ECRANS:
        (tmp_path / f"{ecran}.tsv").write_text(ecrans_mod.chemin(ecran).read_text(encoding="utf-8"), encoding="utf-8")
    copie = tmp_path / "revisions.tsv"
    copie.write_text(copie.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(ecrans_mod, "DOSSIER", tmp_path)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok
