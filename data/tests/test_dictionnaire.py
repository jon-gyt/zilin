"""Le dictionnaire exporté (stories D.2 et D.3) : un test par règle."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data import dictionnaire as dico
from wenlu_data.mots_hsk import Forme, Mot

LISTES = {"hsk-1": ["好", "女", "子"], "hsk-7-9": ["豪"]}
PINYIN = {"好": "hǎo", "女": "nǚ", "子": "zǐ", "豪": "háo"}
LECTURES = {"好": ["hǎo", "hào"], "女": ["nǚ"], "子": ["zǐ"], "豪": ["háo"]}
DECOMPOSITIONS = {
    "好": {"composants": ["女", "子"], "sources": ["cjk-decomp"]},
    "女": {"composants": ["女"], "sources": []},
    "子": {"composants": ["子"], "sources": []},
    "豪": {"composants": ["亠", "口", "冖", "豕"], "sources": ["cjk-decomp"]},
}
GRAPHIES = {c: {"s": [f"M {i}"], "m": [[[i, i]]]} for i, c in enumerate("好女子豪亠口冖豕")}
PARCOURS = {
    "lire": {"jours": [{"jour": 3, "brique": "女", "composes": []}, {"jour": 9, "brique": "子", "composes": ["好"]}]},
    "hsk": {"jours": [{"jour": 5, "brique": "子", "composes": ["好"]}]},
}
MOTS = [
    Mot("L1-0002", Forme("好看", "hǎokàn", ("hao3", "kan4")), "1", ("Adj",), officiel="好看"),
    Mot("L1-0003", Forme("女儿", "nǚ'ér", ("nv3", "er2")), "1", ("N",), officiel="女儿"),
    Mot("L3-0001", Forme("爱好", "àihào", ("ai4", "hao4")), "3", ("V", "N"), officiel="爱好"),
    Mot(
        "L1-0400",
        Forme("知道", "zhīdao", ("zhi1", "dao5"), ("zhi1", "dao4")),
        "1",
        ("V",),
        variantes=(Forme("知", "zhī", ("zhi1",)),),
        officiel="知道",
    ),
]
EN_TETE_TRAITS = {
    "version": "t",
    "license": "Arphic Public License",
    "license_file": "ARPHICPL.TXT",
    "source": "Make Me a Hanzi — graphics.txt",
    "source_url": "https://github.com/skishore/makemeahanzi",
    "modified": "@jour@ : lots",
}


def _documents(**autres: object) -> dict[str, str]:
    options: dict[str, object] = dict(
        listes=LISTES,
        mots=MOTS,
        pinyin=PINYIN,
        lectures=LECTURES,
        decompositions=DECOMPOSITIONS,
        reconcilies={"好", "女", "子"},
        parcours=PARCOURS,
        graphies=GRAPHIES,
        traits_en_tete=EN_TETE_TRAITS,
        modified="@jour@ : assemblé",
        source_url="https://example.org",
    )
    options.update(autres)
    return dico.documents("t", **options)  # type: ignore[arg-type]


def _index(textes: dict[str, str]) -> dict[str, object]:
    return json.loads(textes[dico.INDEX])


def _entree(textes: dict[str, str], genre: str, ident: str) -> dict[str, object]:
    index = _index(textes)
    rows = {r[0]: r for r in index[genre]}  # type: ignore[index]
    modele = index["fichiers"][genre]  # type: ignore[index]
    return json.loads(textes[modele.format(lot=rows[ident][-2])])["entrees"][ident]


def test_l_index_a_une_ligne_par_caractere_et_par_mot() -> None:
    index = _index(_documents())
    assert [r[0] for r in index["caracteres"]] == ["豪", "好", "女", "子"]  # ordre du pinyin : hao2, hao3, nv3, zi3
    assert len(index["mots"]) == 4
    assert index["colonnes"] == {"caracteres": list(dico.COLONNES_CARACTERES), "mots": list(dico.COLONNES_MOTS)}


def test_l_index_dit_toutes_les_lectures_numerotees_la_principale_en_tete() -> None:
    rows = {r[0]: r for r in _index(_documents())["caracteres"]}
    assert rows["好"][1] == "hao3|hao4"
    assert rows["女"][1] == "nv3"


def test_un_mot_cherche_aussi_ses_variantes_et_sa_lecture_pleine() -> None:
    rows = {r[0]: r for r in _index(_documents())["mots"]}
    assert rows["L1-0400"][1:3] == ["知道|知", "zhi1 dao5|zhi1 dao4|zhi1"]


def test_le_niveau_7_9_s_ecrit_7() -> None:
    rows = {r[0]: r for r in _index(_documents())["caracteres"]}
    assert rows["豪"][2] == 7 and rows["好"][2] == 1


def test_la_decomposition_n_est_donnee_que_reconciliee() -> None:
    textes = _documents()
    assert _entree(textes, "caracteres", "好")["decomposition"] == {
        "norme": "GF 0014-2009",
        "parts": ["女", "子"],
        "sources": ["cjk-decomp"],
    }
    assert _entree(textes, "caracteres", "女")["decomposition"]["parts"] == []  # une brique
    assert _entree(textes, "caracteres", "豪")["decomposition"] is None  # non réconciliée


def test_les_mots_qui_contiennent_le_caractere_par_niveau() -> None:
    assert _entree(_documents(), "caracteres", "好")["mots"] == ["L1-0002", "L3-0001"]


def test_la_place_sur_le_chemin_de_chaque_parcours() -> None:
    textes = _documents()
    assert _entree(textes, "caracteres", "好")["chemin"] == {"hsk": 5, "lire": 9}
    assert _entree(textes, "caracteres", "豪")["chemin"] == {}


def test_les_emplacements_des_sens_et_des_exemples_sont_vides() -> None:
    textes = _documents()
    for genre, ident in (("caracteres", "好"), ("mots", "L1-0002")):
        e = _entree(textes, genre, ident)
        assert e["sens"] is None and e["exemples"] == []
    assert all(r[-1] == "" for r in _index(textes)["caracteres"])


def test_un_sens_non_relu_ne_s_exporte_ni_ne_se_cherche() -> None:
    sens = {
        "好": {"statut": "a_relire", "glose": "bon", "acceptions": [{"categorie": "Adj", "fr": "bon"}]},
        "L1-0002": {"statut": "relu", "glose": "joli, beau à voir", "acceptions": [{"categorie": "Adj", "fr": "joli"}]},
    }
    exemples = {"L1-0002": [{"zh": "很好看", "fr": "très joli", "statut": "a_relire"}]}
    textes = _documents(sens=sens, exemples=exemples)
    assert _entree(textes, "caracteres", "好")["sens"] is None
    assert {r[0]: r[-1] for r in _index(textes)["caracteres"]}["好"] == ""
    assert _entree(textes, "mots", "L1-0002")["sens"]["glose"] == "joli, beau à voir"
    assert {r[0]: r[-1] for r in _index(textes)["mots"]}["L1-0002"] == "joli, beau à voir"
    assert _entree(textes, "mots", "L1-0002")["exemples"] == []


def test_une_glose_relue_de_plus_de_40_caracteres_est_refusee() -> None:
    with pytest.raises(dico.DicoInvalide):
        _documents(sens={"好": {"statut": "relu", "glose": "x" * 41}})


def test_les_traits_d_un_lot_sont_ceux_des_caracteres_du_meme_lot() -> None:
    textes = _documents()
    index = _index(textes)
    for c, _, _, lot, _ in index["caracteres"]:
        traits = json.loads(textes[dico.MODELE_TRAITS.format(lot=lot)])
        assert c in traits["traits"]
        assert set(traits) == set(EN_TETE_TRAITS) | {"traits"}  # rien que des tracés et leur licence


def test_les_composants_hors_liste_ont_leurs_traits_a_part() -> None:
    textes = _documents(reconcilies={"好", "女", "子", "豪"})
    hors = _index(textes)["traits_hors_liste"]
    assert set(hors) == {"亠", "口", "冖", "豕"}
    lot = json.loads(textes[dico.MODELE_TRAITS.format(lot=hors["口"])])
    assert "口" in lot["traits"]


def test_un_composant_decoupe_est_nomme_dans_la_mention_de_modification() -> None:
    textes = _documents(reconcilies={"好", "女", "子", "豪"}, decoupes={"亠"})
    hors = _index(textes)["traits_hors_liste"]
    assert "Sauf 亠" in json.loads(textes[dico.MODELE_TRAITS.format(lot=hors["亠"])])["modified"]


def test_deux_passes_ecrivent_les_memes_octets() -> None:
    assert _documents() == _documents()


def test_les_controles_relisent_l_export(tmp_path: Path) -> None:
    textes = _documents()
    for relatif, texte in textes.items():
        (tmp_path / relatif).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / relatif).write_text(texte, encoding="utf-8")
    lots, traits, sens, compte = dico.fautes(tmp_path, caracteres_attendus=4, mots_attendus=4)
    assert (lots, traits, sens) == ([], [], [])
    assert compte["caracteres"] == 4
    # Un sens non relu glissé à la main dans un lot est une faute.
    index = _index(textes)
    lot = {r[0]: r for r in index["caracteres"]}["好"][-2]
    chemin = tmp_path / dico.MODELE_CARACTERES.format(lot=lot)
    doc = json.loads(chemin.read_text(encoding="utf-8"))
    doc["entrees"]["好"]["sens"] = {"statut": "a_relire", "glose": "bon"}
    chemin.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "dico" / "mots" / "99.json").write_text("{}", encoding="utf-8")
    lots, _, sens, _ = dico.fautes(tmp_path, caracteres_attendus=4, mots_attendus=4)
    assert any("好" in x for x in sens)
    assert any("99.json" in x for x in lots)


# --------------------------------------------------------------------------- l'origine (10.11)


def _fiche(statut: str = "relu", **autres: object) -> dict[str, object]:
    fiche: dict[str, object] = {
        "statut": statut,
        "etiquette": "atteste",
        "origine_fr": "Une. Deux. Trois.",
        "origine_en": "One. Two. Three.",
        "roles": {"女": "sens", "子": "sens"},
        "composants": ["女", "子"],
    }
    fiche.update(autres)
    return fiche


def test_l_origine_d_une_fiche_relue_arrive_dans_l_entree_etiquetee() -> None:
    e = _entree(_documents(origines={"好": _fiche()}), "caracteres", "好")
    assert e["origine"] == {
        "statut": "relu",
        "etiquette": "atteste",
        "fr": "Une. Deux. Trois.",
        "en": "One. Two. Three.",
        "roles": {"女": "sens", "子": "sens"},
    }
    assert _index(_documents(origines={"好": _fiche()}))["compte"]["origines_relues"] == 1


def test_sans_fiche_relue_l_origine_est_a_venir() -> None:
    """Une fiche à relire, sans texte ou sans étiquette ne donne rien : jamais une origine inventée."""
    for fiche in (_fiche("a_relire"), _fiche(origine_fr=""), _fiche(etiquette=None), _fiche(etiquette="peut-etre")):
        assert _entree(_documents(origines={"好": fiche}), "caracteres", "好")["origine"] is None
    assert _entree(_documents(), "caracteres", "好")["origine"] is None


def test_les_roles_ne_passent_que_sur_la_decomposition_du_dictionnaire() -> None:
    """Une fiche qui décompose autrement, ou un caractère non réconcilié : l'origine, sans rôles."""
    autre = _fiche(composants=["女", "了", "一"], roles={"女": "sens", "了": "forme", "一": "forme"})
    assert _entree(_documents(origines={"好": autre}), "caracteres", "好")["origine"]["roles"] == {}
    incomplete = _fiche(roles={"女": "sens"})
    assert _entree(_documents(origines={"好": incomplete}), "caracteres", "好")["origine"]["roles"] == {}
    non_reconcilie = _fiche(composants=["亠", "口", "冖", "豕"])
    assert _entree(_documents(origines={"豪": non_reconcilie}), "caracteres", "豪")["origine"]["roles"] == {}


def test_les_controles_refusent_une_origine_non_relue(tmp_path: Path) -> None:
    textes = _documents(origines={"好": _fiche()})
    for relatif, texte in textes.items():
        (tmp_path / relatif).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / relatif).write_text(texte, encoding="utf-8")
    _, _, sens, compte = dico.fautes(tmp_path, caracteres_attendus=4, mots_attendus=4)
    assert sens == [] and compte["origines"] == 1
    lot = {r[0]: r for r in _index(textes)["caracteres"]}["好"][-2]
    chemin = tmp_path / dico.MODELE_CARACTERES.format(lot=lot)
    doc = json.loads(chemin.read_text(encoding="utf-8"))
    doc["entrees"]["好"]["origine"] = {"statut": "a_relire", "etiquette": "atteste", "fr": "x", "en": "x", "roles": {}}
    doc["entrees"]["女"]["origine"] = {"statut": "relu", "etiquette": None, "fr": "x", "en": "x", "roles": {}}
    chemin.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    _, _, sens, _ = dico.fautes(tmp_path, caracteres_attendus=4, mots_attendus=4)
    assert any(x.startswith("好 : origine") for x in sens) and any(x.startswith("女 : origine") for x in sens)
