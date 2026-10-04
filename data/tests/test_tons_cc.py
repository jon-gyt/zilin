"""Les voix humaines sous licence CC du classifieur des tons (`data/sources/tons/voix_cc.py`,
`wenlu_data/tons.py`, décision du propriétaire du 3 octobre 2026 « Voix CC BY-SA ») : la licence
lue fichier par fichier, les étiquettes, l'attribution exportée. Une règle par test, sans réseau.
Un petit lexique tient lieu de la liste HSK et des lectures du dépôt."""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import sys
from pathlib import Path

import pytest

from wenlu_data import tons

_ICI = Path(__file__).resolve().parents[1] / "sources" / "tons"
sys.path.insert(0, str(_ICI))


def _charger(nom: str):
    spec = importlib.util.spec_from_file_location(f"{nom}_recette_cc", _ICI / f"{nom}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cc = _charger("voix_cc")
kokoro = _charger("voix_kokoro")
fleurs = _charger("fleurs")


def lexique(mots: dict[str, tuple[str, ...]], lectures: dict[str, set[str]]):
    lex = object.__new__(fleurs.Lexique)
    lex.mots = {w: [(s, s)] for w, s in mots.items()}
    lex.seuls = {}
    lex.courantes = lectures
    lex.depot = lectures
    lex.long = max([len(w) for w in mots] or [2])
    return lex


LEX = lexique(
    {"水果": ("shui3", "guo3"), "不是": ("bu4", "shi4"), "一样": ("yi1", "yang4"), "知道": ("zhi1", "dao5")},
    {"水": {"shui3"}, "果": {"guo3"}, "不": {"bu4"}, "是": {"shi4"}, "一": {"yi1"}, "样": {"yang4"},
     "知": {"zhi1"}, "道": {"dao4"}, "好": {"hao3", "hao4"}, "马": {"ma3"}},
)


def etiquette(texte: str):
    return cc.etiqueter(texte, LEX, fleurs, kokoro)


# ------------------------------------------------------------------------------- licences


def test_une_licence_nc_ou_nd_est_refusee() -> None:
    for nom in ("CC BY-NC-SA 4.0", "CC BY-NC 3.0", "CC BY-ND 4.0", "CC BY-NC-ND 2.0"):
        assert cc.licence_acceptee(nom) is None
        assert tons.licence_refusee(nom)


def test_une_licence_inconnue_ou_sans_version_est_refusee() -> None:
    for nom in (None, "", "GFDL", "Public domain", "CC BY-SA", "Copyrighted"):
        assert cc.licence_acceptee(nom) is None
    assert tons.licence_refusee("CC BY-SA")
    assert tons.licence_refusee(None)


def test_cc_by_sa_cc_by_et_cc0_sont_acceptees_avec_leur_version() -> None:
    assert cc.licence_acceptee("CC BY-SA 4.0") == ("CC BY-SA", "4.0")
    assert cc.licence_acceptee("CC BY 3.0") == ("CC BY", "3.0")
    assert cc.licence_acceptee("CC0") == ("CC0", "1.0")
    assert tons.licence_refusee("CC BY-SA 3.0 ; CC BY 4.0") is None


PAGE = """== {{int:filedesc}} ==
{{Lingua Libre record
 | speaker       = Foo
 | speakerId     = Q42
 | author        = [[User:Foo|]]
 | languageId    = Q9192
 | transcription = 水果
}}

== {{int:license-header}} ==
{{self|cc-by-sa-4.0}}"""


def test_la_licence_doit_etre_ecrite_sur_la_page_du_fichier() -> None:
    assert cc.accord_page("CC BY-SA 4.0", PAGE)
    assert not cc.accord_page("CC BY 4.0", PAGE)
    assert not cc.accord_page("CC BY-SA 4.0", PAGE.replace("cc-by-sa-4.0", "cc-by-nc-sa-4.0"))


def test_un_fichier_de_licence_nc_est_ecarte_du_choix() -> None:
    f = {"licence": {"LicenseShortName": "CC BY-NC-SA 4.0"}, "texte": PAGE.replace("cc-by-sa", "cc-by-nc-sa"),
         "sha1": "a" * 40, "url": "https://upload.wikimedia.org/x.wav"}
    assert "licence" in cc.raison_ecart(f)
    assert cc.raison_ecart({**f, "licence": {"LicenseShortName": "CC BY-SA 4.0"}, "texte": PAGE}) is None


def test_le_modele_lingua_libre_donne_le_locuteur_et_le_texte() -> None:
    m = cc.modele_ll(PAGE)
    assert (m["speakerId"], m["transcription"], m["author"]) == ("Q42", "水果", "[[User:Foo|]]")


def test_l_empreinte_d_un_fichier_est_verifiee() -> None:
    octets = b"RIFF...."
    blob = hashlib.sha1(b"blob %d\0" % len(octets) + octets).hexdigest()
    assert cc.empreinte_ok(octets, f"git-blob:{blob}")
    assert cc.empreinte_ok(octets, f"sha1:{hashlib.sha1(octets).hexdigest()}")
    assert not cc.empreinte_ok(octets + b"x", f"git-blob:{blob}")
    assert not cc.empreinte_ok(octets, "md5:0")


# ------------------------------------------------------------------------------ étiquettes


def test_un_caractere_a_une_seule_lecture_pleine_est_etiquete_a_son_ton() -> None:
    assert etiquette("马") == {"genre": "c", "syl": ["ma3"], "tons": [3]}


def test_un_caractere_a_plusieurs_lectures_pleines_n_est_pas_etiquete() -> None:
    assert etiquette("好") is None


def test_un_mot_porte_le_ton_que_la_voix_fait() -> None:
    assert etiquette("水果")["tons"] == [2, 3]  # 3-3 lu 2-3
    assert etiquette("不是")["tons"] == [2, 4]  # 不 devant un ton 4
    assert etiquette("一样")["tons"] == [2, 4]  # 一 devant un ton 4
    assert etiquette("知道")["tons"] == [1, 5]  # le neutre de la liste


def test_un_texte_hors_liste_ou_autre_qu_un_sinogramme_n_est_pas_etiquete() -> None:
    assert etiquette("马路") is None
    assert etiquette("ma3") is None
    assert etiquette("水果店") is None


def test_les_syllabes_de_chen_wang_viennent_du_nom_du_fichier() -> None:
    arbre = [("64k/syllabs/cmn-ma3.mp3", "b" * 40), ("64k/syllabs/cmn-ma5.mp3", "c" * 40),
             ("64k/hsk/cmn-水果.mp3", "d" * 40), ("64k/hsk/cmn-一_也_.mp3", "e" * 40)]
    voix = {v["voix"]: v for v in cc.choisir_audio_cmn(arbre, LEX, fleurs, kokoro)}
    assert [(e["syl"], e["tons"]) for e in voix["cc-chen-wang"]["entrees"]] == [(["ma3"], [3])]
    assert [(e["texte"], e["tons"]) for e in voix["cc-yue-tan"]["entrees"]] == [("水果", [2, 3])]
    assert voix["cc-yue-tan"]["entrees"][0]["empreinte"] == "git-blob:" + "d" * 40


# ------------------------------------------------------------------------- entraînement


def _doc(role: str = "entrainement", version: str | None = "3.0 US") -> dict:
    x = [0.0] * 34
    return {"voix": "cc-test", "role": role, "source": {"licence": "CC BY-SA", "version": version}, "lignes": [
        {"id": "cc-test/水果", "g": "m", "k": 0, "n": 2, "t": 2, "ok": True, "x": x, "rc": 1.5, "ro": 2.0, "probleme": None},
        {"id": "cc-test/水果", "g": "m", "k": 1, "n": 2, "t": 3, "ok": True, "x": x, "rc": 0.5, "ro": 1.0, "probleme": "sature"},
        {"id": "cc-test/马", "g": "c", "n": 1, "ok": False},
    ]}


def test_une_syllabe_manquee_ou_a_redemander_n_entre_pas_a_l_entrainement() -> None:
    lignes = cc.lignes_cc(_doc())
    assert [(r["id"], r["pos"]) for r in lignes] == [("cc-test/水果", 0)]
    assert lignes[0]["x_calibree"][30:32] == [1.5, 1.0] and lignes[0]["x_sans"][30:32] == [0.0, 0.0]


def test_une_voix_de_test_n_entre_jamais_a_l_entrainement() -> None:
    with pytest.raises(ValueError):
        cc.lignes_cc(_doc(role="test"))


def test_une_voix_dont_la_licence_ne_dit_pas_sa_version_n_entre_pas_a_l_entrainement() -> None:
    with pytest.raises(ValueError, match="sans version"):
        cc.lignes_cc(_doc(version=None))
    assert cc.AUDIO_CMN_VOIX["cc-chen-wang"]["role"] == "test"


# ---------------------------------------------------------------------- attribution exportée

VOIX = {"cc-test": {"auteur": "Test Auteur", "titre": "Syllabes", "lien": "https://exemple.org/", "licence": "CC BY-SA 3.0"}}


def _modele_cc(licence: str = "CC BY-SA", version: str = "3.0", poids: str = "CC BY-SA 4.0") -> dict:
    m = copy.deepcopy(tons.charger())
    m["licence"]["poids"] = poids
    m["licence"]["donnees"].append({"cle": "cc-test", "nom": "Test Auteur", "licence": licence, "version": version,
                                    "usage": "entraînement"})
    return m


def test_un_modele_derive_d_une_voix_sans_attribution_exportee_est_refuse() -> None:
    fautes = tons.fautes_licence(_modele_cc(), voix={})
    assert any("sans attribution exportée" in f for f in fautes)
    assert tons.fautes_licence(_modele_cc(), voix=VOIX) == []


def test_un_modele_derive_d_une_voix_nc_est_refuse() -> None:
    fautes = tons.fautes_licence(_modele_cc(licence="CC BY-NC-SA"), voix=VOIX)
    assert any("NC ou ND" in f for f in fautes)


def test_des_poids_derives_de_cc_by_sa_se_declarent_sous_cc_by_sa_4() -> None:
    fautes = tons.fautes_licence(_modele_cc(poids="propriétaire"), voix=VOIX)
    assert any("CC BY-SA 4.0" in f for f in fautes)


def test_l_attribution_d_une_voix_dit_auteur_titre_lien_licence_et_modification() -> None:
    texte = tons.texte_attribution(VOIX["cc-test"])
    for exige in ("Test Auteur", "Syllabes", "https://exemple.org/", "CC BY-SA 3.0",
                  "https://creativecommons.org/licenses/by-sa/3.0/", "modifié"):
        assert exige in texte


def test_l_attribution_exportee_garde_l_ogdl_puis_chaque_voix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tons, "VOIX_CC", VOIX)
    m = _modele_cc()
    attributions = tons.attributions(m)
    assert attributions[0] == tons.ATTRIBUTION
    assert attributions[1] == tons.texte_attribution(VOIX["cc-test"])
    assert tons.sous_cc_by_sa(m)
    assert tons.fichiers_licence(m) == [tons.OGDL, tons.CC_BY_SA]
    assert tons.LICENCE_POIDS_CC in tons.licence_export(m)


def test_le_texte_de_la_cc_by_sa_4_est_versionne() -> None:
    texte = tons.CC_BY_SA_TEXTE.read_text(encoding="utf-8")
    assert texte.startswith("Creative Commons Attribution-ShareAlike 4.0 International")
