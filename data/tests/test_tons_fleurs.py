"""L'étiquetage des phrases de FLEURS (`data/sources/tons/fleurs.py`), recette des poids des
tons : le ton que la voix fait dans son contexte, une règle par test. Un petit lexique tient
lieu de la liste HSK et des lectures du dépôt."""
from __future__ import annotations

import importlib.util
from pathlib import Path

_CHEMIN = Path(__file__).resolve().parents[1] / "sources" / "tons" / "fleurs.py"
_SPEC = importlib.util.spec_from_file_location("fleurs_recette", _CHEMIN)
assert _SPEC and _SPEC.loader
fleurs = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(fleurs)


def lexique(mots: dict[str, tuple[str, ...]], lectures: dict[str, set[str]], seuls: dict[str, set[str]] | None = None):
    """Un lexique sans fichier : des mots (syllabes numérotées) et des lectures courantes."""
    lex = object.__new__(fleurs.Lexique)
    lex.mots = {w: [(s, s)] for w, s in mots.items()}
    lex.seuls = seuls or {}
    lex.courantes = lectures
    lex.depot = lectures
    lex.long = max([len(w) for w in mots] or [2])
    return lex


def tons(texte: str, lex) -> list[int | None]:
    syl = fleurs.etiqueter(texte, lex)
    assert not isinstance(syl, str)
    return [s["ton"] for s in syl]


LECTURES = {
    "你": {"ni3"}, "好": {"hao3"}, "我": {"wo3"}, "想": {"xiang3"}, "很": {"hen3"}, "大": {"da4"},
    "不": {"bu4"}, "是": {"shi4"}, "去": {"qu4"}, "来": {"lai2"}, "一": {"yi1"}, "个": {"ge4"},
    "天": {"tian1"}, "年": {"nian2"}, "起": {"qi3"}, "第": {"di4"}, "月": {"yue4"}, "的": {"de5", "di2", "di4"},
    "姐": {"jie3"}, "过": {"guo4", "guo5"}, "数": {"shu3", "shu4"}, "那": {"na4"}, "儿": {"er2", "r5"},
    "书": {"shu1"}, "人": {"ren2"}, "们": {"men5"}, "水": {"shui3"},
}


def test_la_ponctuation_coupe_les_groupes_et_les_guillemets_ne_coupent_rien() -> None:
    assert fleurs.groupes_de("你好，“我”来。") == ["你好", "我来"]


def test_une_phrase_qui_porte_des_chiffres_ou_des_lettres_est_ecartee() -> None:
    assert fleurs.groupes_de("我有2本书") is None
    assert fleurs.groupes_de("我是Tom") is None


def test_deux_tons_3_dans_un_mot_le_premier_se_dit_au_ton_2() -> None:
    lex = lexique({"你好": ("ni3", "hao3")}, LECTURES)
    assert tons("你好", lex) == [2, 3]


def test_deux_tons_3_entre_deux_mots_le_premier_n_a_pas_d_etiquette() -> None:
    lex = lexique({}, LECTURES)
    assert tons("很好", lex) == [None, 3]


def test_un_ton_3_devant_un_neutre_venu_d_un_ton_3_n_a_pas_d_etiquette() -> None:
    lex = lexique({"姐姐": ("jie3", "jie5")}, LECTURES)
    assert tons("姐姐", lex) == [None, 5]


def test_un_ton_3_devant_une_particule_reste_au_ton_3() -> None:
    lex = lexique({}, LECTURES)
    assert tons("我的", lex) == [3, 5]


def test_bu_devant_un_ton_4_se_dit_au_ton_2_sinon_au_ton_4() -> None:
    lex = lexique({}, LECTURES)
    assert tons("不是", lex) == [2, 4]
    assert tons("不来", lex) == [4, 2]


def test_bu_devant_un_neutre_suit_le_ton_plein_du_neutre() -> None:
    lex = lexique({"不过": ("bu4", "guo5")}, LECTURES)
    lex.mots["不过"] = [(("bu4", "guo5"), ("bu4", "guo4"))]
    assert tons("不过", lex)[0] == 2


def test_yi_suit_le_ton_qui_le_suit() -> None:
    lex = lexique({}, LECTURES)
    assert tons("一个", lex)[0] == 2
    assert tons("一天", lex)[0] == 4
    assert tons("一年", lex)[0] == 4
    assert tons("一起", lex)[0] == 4


def test_yi_ordinal_en_fin_de_groupe_ou_dans_un_nombre_reste_au_ton_1() -> None:
    lex = lexique({}, LECTURES)
    assert tons("第一", lex)[1] == 1
    assert tons("来一", lex)[1] == 1


def test_yi_devant_le_mois_n_a_pas_d_etiquette() -> None:
    lex = lexique({}, LECTURES)
    assert tons("一月", lex)[0] is None


def test_un_caractere_aux_lectures_de_tons_differents_n_a_pas_d_etiquette_hors_d_un_mot() -> None:
    lex = lexique({}, LECTURES)
    assert tons("数", lex) == [None]


def test_la_liste_hsk_et_la_lecture_courante_doivent_s_accorder() -> None:
    lex = lexique({}, {"数": {"shu4"}}, seuls={"数": {"shu3"}})
    assert tons("数", lex) == [None]


def test_une_particule_hors_d_un_mot_est_au_ton_neutre() -> None:
    lex = lexique({}, LECTURES)
    assert tons("书的", lex)[1] == 5


def test_un_neutre_hors_d_un_mot_n_est_retenu_que_pour_une_particule() -> None:
    lex = lexique({}, LECTURES)
    assert tons("过", lex) == [None]


def test_le_r_de_l_erhua_n_est_pas_une_syllabe() -> None:
    lex = lexique({"那儿": ("na4", "r5")}, LECTURES)
    syl = fleurs.etiqueter("那儿", lex)
    assert [s["c"] for s in syl] == ["那"]


def test_un_er_hors_d_un_mot_ecarte_la_phrase() -> None:
    lex = lexique({}, LECTURES)
    assert fleurs.etiqueter("那儿", lex) == "儿 hors d'un mot"


def test_l_attaque_dit_si_la_consonne_coupe_la_voix() -> None:
    assert [fleurs.attaque(s) for s in ("shi4", "zhong1", "ba1", "pa4", "ma1", "yi1", "an1")] == [
        "forte", "faible", "faible", "forte", "voisee", "zero", "zero",
    ]


def test_la_premiere_syllabe_d_un_groupe_suit_une_ponctuation() -> None:
    lex = lexique({"你好": ("ni3", "hao3")}, LECTURES)
    syl = fleurs.etiqueter("你好，我来", lex)
    assert [s["avant"] for s in syl] == ["ponct", "dans", "ponct", "mot"]
    assert [s["g"] for s in syl] == [0, 0, 1, 1]
