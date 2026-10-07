"""Le modèle des mots de « Dis-le » (`data/sources/tons/entrainer_mots.py`, décision du
propriétaire du 4 octobre 2026, « Revoir la méthode des mots ») : l'étiquetage des profils, la
variante libre qui refuse toute source CC BY-SA, l'attribution de chaque voix quand les poids en
dérivent ; puis le modèle adopté le 7 octobre 2026 (« Brancher à 77,6 % ») : versionné, contrôlé,
exporté à part, sans aucune source CC BY-SA. Une règle par test, sans réseau ni scikit-learn."""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path

import pytest

from wenlu_data import tons
from wenlu_data.outils import empreinte_fichier
from wenlu_data.paths import EXPORT

_ICI = Path(__file__).resolve().parents[1] / "sources" / "tons"
sys.path.insert(0, str(_ICI))
_spec = importlib.util.spec_from_file_location("entrainer_mots_recette", _ICI / "entrainer_mots.py")
assert _spec and _spec.loader
mots = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mots)


def mot(voix: str, source: str, licence: str, tons_=(1, 4), jeu="entrainement", probleme=None) -> dict:
    x = [0.0] * mots.N_ENTREES
    return {"voix": voix, "source": source, "licence": licence, "id": f"{voix}/{tons_}", "tons": list(tons_),
            "jeu": jeu, "probleme": probleme, "court": False, "sans": x, "cal": x, "ora": x}


TOUS = [
    mot("tw1", "taiwan", "OGDL-Taiwan-1.0"),
    mot("zf_002", "kokoro", "synthese"),
    mot("zf_001", "kokoro", "synthese"),
    mot("cc-ll-Q1431140", "cc", "CC0 1.0"),
    mot("cc-yue-tan", "cc", "CC BY-SA 3.0 US"),
    mot("cc-ll-Q812770", "cc", "CC BY-SA 4.0"),
    mot("cc-ll-Q1332695", "cc", "CC BY-SA 4.0", probleme="sature"),
]


def test_les_profils_sont_les_19_que_la_voix_fait_sans_3_3_ni_neutre_en_tete():
    assert len(mots.PROFILS) == 19
    assert [3, 3] not in mots.PROFILS
    assert all(a != 5 for a, _ in mots.PROFILS)
    assert [2, 5] in mots.PROFILS and [4, 4] in mots.PROFILS


def test_deux_tons_3_de_suite_sont_etiquetes_2_3_comme_la_voix_les_dit():
    assert mots.profil([3, 3]) == mots.profil([2, 3]) == mots.PROFILS.index([2, 3])


def test_un_neutre_en_tete_n_est_pas_un_profil():
    assert mots.profil([5, 1]) == -1


def test_la_variante_libre_n_apprend_aucune_source_cc_by_sa():
    sel = mots.selection(TOUS, "libre")
    assert sel and not any("BY-SA" in m["licence"] for m in sel)
    assert {m["voix"] for m in sel} == {"zf_002", "cc-ll-Q1431140"}


def test_la_variante_libre_refuse_une_source_cc_by_sa_meme_deguisee():
    deguise = [mot("x", "kokoro", "CC BY-SA 4.0"), mot("y", "taiwan", "CC BY-SA 4.0")]
    assert mots.selection(deguise, "libre", avec_pseudo=True) == []
    with pytest.raises(ValueError):
        mots.selection([mot("z", "cc", "CC0 1.0 ; CC BY-SA 4.0")], "libre")


def test_les_pseudo_mots_de_taiwan_ne_viennent_que_sur_demande():
    assert all(m["source"] != "taiwan" for m in mots.selection(TOUS, "libre"))
    assert any(m["source"] == "taiwan" for m in mots.selection(TOUS, "libre", avec_pseudo=True))


def test_la_voix_de_l_app_une_voix_tenue_a_part_et_un_mot_sature_n_entrent_jamais():
    sel = mots.selection(TOUS, "cc", sans=("cc-yue-tan",))
    voix = {m["voix"] for m in sel}
    assert "zf_001" not in voix and "cc-yue-tan" not in voix and "cc-ll-Q1332695" not in voix
    assert "cc-ll-Q812770" in voix


def test_la_variante_cc_refuse_une_licence_nc_ou_sans_version():
    with pytest.raises(ValueError):
        mots.selection([mot("v", "cc", "CC BY-NC-SA 4.0")], "cc")
    with pytest.raises(ValueError):
        mots.selection([mot("v", "cc", "CC BY-SA")], "cc")


def _modele(sel: list[dict], variante: str) -> dict:
    return {"licence": mots.bloc_licence(sel, variante, (), Path("/nulle/part"))}


def test_le_modele_libre_reste_proprietaire_et_sa_licence_est_valide():
    m = _modele(mots.selection(TOUS, "libre"), "libre")
    assert "BY-SA" not in m["licence"]["poids"]
    assert tons.fautes_licence(m) == []
    assert not tons.sous_cc_by_sa(m)


def test_le_modele_cc_passe_sous_cc_by_sa_4_et_attribue_chaque_voix():
    sel = mots.selection(TOUS, "cc")
    m = _modele(sel, "cc")
    assert m["licence"]["poids"] == tons.LICENCE_POIDS_CC
    assert tons.fautes_licence(m) == []
    assert tons.sous_cc_by_sa(m)
    attribuees = " ".join(tons.attributions(m))
    for cle in {x["voix"] for x in sel if x["source"] == "cc"}:
        assert tons.VOIX_CC[cle]["auteur"] in attribuees


def test_une_voix_cc_sans_attribution_exportee_est_refusee_par_le_controle():
    m = _modele([mot("cc-ll-Q999", "cc", "CC BY-SA 4.0")], "cc")
    assert any("sans attribution exportée" in f for f in tons.fautes_licence(m))


# ------------------------------------------------- le modèle adopté (décision du 7 octobre 2026)


def test_le_modele_des_mots_versionne_a_la_forme_que_l_app_lit():
    m = tons.charger_mots()
    assert tons.fautes_modele_mots(m) == []
    assert tons.parametres(m) == 5625
    assert tons.MODELE_MOTS.stat().st_size < tons.TAILLE_MAX
    assert any("profils" in f for f in tons.fautes_modele_mots({**m, "profils": m["profils"][::-1]}))


def test_le_modele_des_mots_versionne_est_la_variante_libre_sans_cc_by_sa():
    m = tons.charger_mots()
    assert tons.fautes_licence_mots(m) == []
    assert m["licence"]["variante"] == "libre" and m["entrainement"]["variante"] == "libre"
    assert not tons.sous_cc_by_sa(m)
    assert tons.voix_du_modele(m) == ["cc-ll-Q1431140"]
    assert "zf_001" not in m["entrainement"]["voix"]


def test_le_controle_refuse_un_modele_des_mots_qui_derive_d_une_voix_cc_by_sa():
    m = copy.deepcopy(tons.charger_mots())
    m["licence"]["donnees"].append({"cle": "cc-yue-tan", "licence": "CC BY-SA 3.0 US", "usage": "entraînement"})
    assert any("CC BY-SA" in f for f in tons.fautes_licence_mots(m))
    cc = copy.deepcopy(tons.charger_mots())
    cc["licence"]["variante"] = "cc"
    assert any("variante" in f for f in tons.fautes_licence_mots(cc))
    cachee = copy.deepcopy(tons.charger_mots())
    cachee["entrainement"]["voix"].append("cc-ll-Q812770")
    assert any("sans être déclarée" in f for f in tons.fautes_licence_mots(cachee))


def test_la_provenance_porte_l_empreinte_du_modele_des_mots():
    texte = tons.PROVENANCE.read_text(encoding="utf-8")
    empreinte = empreinte_fichier(tons.MODELE_MOTS).removeprefix("sha256:")
    assert empreinte in texte
    assert any("modele-mots.json" in f for f in tons.fautes_provenance(texte.replace(empreinte, "")))


def test_l_attribution_des_mots_nomme_kokoro_et_canonni_et_aucune_voix_cc_by_sa():
    a = tons.attributions_mots(tons.charger_mots())
    assert a[0] == tons.ATTRIBUTION_KOKORO and "Apache 2.0" in a[0]
    assert len(a) == 2 and "CanonNi" in a[1] and "CC0 1.0" in a[1]
    assert not any("BY-SA" in x for x in a)


def test_l_export_porte_le_modele_des_mots_a_part_avec_sa_licence():
    d = EXPORT / "0.1.0"
    sortie = json.loads((d / tons.FICHIER_MOTS).read_text(encoding="utf-8"))
    index = json.loads((d / "index.json").read_text(encoding="utf-8"))
    licences = (d / "LICENCES.md").read_text(encoding="utf-8")
    assert tons.fautes_export_mots(sortie, index, licences, d) == []
    assert index[tons.CLE_INDEX_MOTS] == tons.FICHIER_MOTS
    assert sortie["membres"] == tons.charger_mots()["membres"]
    assert sortie["license"].startswith("propriétaire") and "license_url" not in sortie
    faux = {**sortie, "license": "CC BY-SA 4.0", "attributions": []}
    fautes = tons.fautes_export_mots(faux, {**index, tons.CLE_INDEX_MOTS: ""}, "", d)
    assert any("CC BY-SA" in f for f in fautes)
    assert any("n'attribue pas" in f for f in fautes)
    assert any("index.json" in f for f in fautes)


def test_le_modele_des_caracteres_ne_change_pas():
    empreinte = empreinte_fichier(tons.MODELE).removeprefix("sha256:")
    assert empreinte == "eda572fdffacd3540c356b683e6a20167dc7e6c26fcc233c58697187181cf157"


def test_les_controles_des_mots_passent_sur_le_depot():
    assert all(c.ok for c in tons.controles_mots())
