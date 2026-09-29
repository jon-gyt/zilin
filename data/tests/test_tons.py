"""Les poids du classifieur des tons de « Dis-le » (story 9.1) : source, provenance, export.

Un test par règle. Aucun réseau. Les règles : les poids ont la forme que l'app lit et
pèsent moins de 1 Mo ; ils déclarent leurs données d'entraînement sous OGDL 1.0, avec
l'attribution ; la provenance dit la source, la licence, l'attribution et l'empreinte des
poids ; l'export porte les mêmes poids, l'attribution et le texte de la licence, et l'index
les nomme ; les textes de « Dis-le » ne font jamais de reproche.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

from wenlu_data import tons
from wenlu_data.outils import empreinte_fichier
from wenlu_data.paths import EXPORT


def test_les_poids_versionnes_ont_la_forme_que_l_app_lit() -> None:
    m = tons.charger()
    assert tons.fautes_modele(m) == []
    assert tons.parametres(m) == 3225


def test_les_poids_pesent_moins_d_un_mo() -> None:
    assert tons.MODELE.stat().st_size < tons.TAILLE_MAX


def test_une_couche_mal_formee_est_refusee() -> None:
    m = copy.deepcopy(tons.charger())
    m["membres"][0]["couches"][0]["poids"][0].pop()
    assert any("couche mal formée" in f for f in tons.fautes_modele(m))
    assert any("entrées" in f for f in tons.fautes_modele({**tons.charger(), "entrees": 12}))


def test_les_donnees_d_entrainement_sont_sous_ogdl_et_attribuees() -> None:
    m = tons.charger()
    assert tons.fautes_licence(m) == []
    sans = copy.deepcopy(m)
    sans["licence"]["donnees"][0]["attribution"] = ""
    assert any("sans attribution" in f for f in tons.fautes_licence(sans))
    autre = copy.deepcopy(m)
    autre["licence"]["donnees"][0]["licence"] = "CC BY-NC"
    assert any("hors OGDL" in f for f in tons.fautes_licence(autre))


def test_la_provenance_porte_l_empreinte_des_poids_et_l_attribution() -> None:
    texte = tons.PROVENANCE.read_text(encoding="utf-8")
    assert tons.fautes_provenance(texte) == []
    assert empreinte_fichier(tons.MODELE) in texte
    assert any("empreinte de modele.json" in f for f in tons.fautes_provenance(texte.replace(empreinte_fichier(tons.MODELE), "")))
    assert any("data.gov.tw/license" in f for f in tons.fautes_provenance(texte.replace(tons.URL_LICENCE, "")))


def test_l_attribution_suit_l_annexe_de_la_licence() -> None:
    for exige in tons.ATTRIBUTION_EXIGEE:
        assert exige in tons.ATTRIBUTION
    assert "此開放資料依政府資料開放授權條款" in tons.ATTRIBUTION


def test_le_texte_de_la_licence_est_versionne() -> None:
    assert "Open Government Data License, version 1.0" in tons.LICENCE_TEXTE.read_text(encoding="utf-8")


def test_l_export_porte_les_poids_l_attribution_et_la_licence() -> None:
    d = EXPORT / "0.1.0"
    sortie = json.loads((d / tons.FICHIER).read_text(encoding="utf-8"))
    index = json.loads((d / "index.json").read_text(encoding="utf-8"))
    licences = (d / "LICENCES.md").read_text(encoding="utf-8")
    assert tons.fautes_export(sortie, index, licences, d) == []
    assert index["tons"] == tons.FICHIER
    assert sortie["membres"] == tons.charger()["membres"]


def test_un_export_sans_attribution_ou_sans_index_est_refuse(tmp_path: Path) -> None:
    d = EXPORT / "0.1.0"
    sortie = json.loads((d / tons.FICHIER).read_text(encoding="utf-8"))
    index = json.loads((d / "index.json").read_text(encoding="utf-8"))
    licences = (d / "LICENCES.md").read_text(encoding="utf-8")
    fautes = tons.fautes_export({**sortie, "attribution": ""}, {**index, "tons": ""}, "", d)
    assert any("attribution sans" in f for f in fautes)
    assert any("index.json ne nomme pas" in f for f in fautes)
    assert any("LICENCES.md" in f for f in fautes)
    (tmp_path / tons.FICHIER).write_text("{}", encoding="utf-8")
    assert any("absent de l'export" in f for f in tons.fautes_export(sortie, index, licences, tmp_path))


def test_les_controles_passent_sur_le_depot() -> None:
    assert all(c.ok for c in tons.controles())

