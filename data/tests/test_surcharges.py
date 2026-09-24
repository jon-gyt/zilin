"""Surcharges versionnées des sources : un test par règle. Aucun accès réseau.

Les sources téléchargées ne se corrigent jamais sur place : pinyin, IDS,
équivalences de notation et mots exclus se corrigent dans `data/sources/`, une
ligne et une raison par correction. Les tests de règle donnent leurs propres
lignes ; ceux du dépôt relisent les vrais fichiers (`SURCHARGES_REELLES`).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from conftest import SURCHARGES_REELLES
from wenlu_data import export, surcharges
from wenlu_data.gf0014 import (
    SOURCE_MMAH,
    SOURCE_SECONDAIRE,
    TableInvalide,
    analyser_ids,
    charger_table,
    combiner_ids,
    reconcilier,
)
from wenlu_data.surcharges import (
    SOURCE_SURCHARGE,
    SurchargeInvalide,
    parse_equivalences,
    parse_ids,
    parse_mots_exclus,
    parse_pinyin,
)


def reelles(nom: str) -> Path:
    return SURCHARGES_REELLES[nom]


# --------------------------------------------------------------------------- formats


def test_pinyin_la_premiere_lecture_est_la_principale() -> None:
    table = parse_pinyin(["# commentaire", "地\tdì de\tla particule n'est pas la lecture du caractère"])
    assert table == {"地": ("dì", "de")}


@pytest.mark.parametrize(
    "ligne",
    [
        "地\tdì de",  # pas de raison
        "地\tdi4 de\traison",  # chiffres, pas de diacritiques
        "地\tdì dì\traison",  # lecture répétée
        "地面\tdì\traison",  # pas un caractère
    ],
)
def test_pinyin_mal_forme_refuse(ligne: str) -> None:
    with pytest.raises(SurchargeInvalide):
        parse_pinyin([ligne])


def test_ids_verifie_par_l_analyseur_et_accepte_les_accolades() -> None:
    table = parse_ids(["以\t⿰{⿰𠄌丶}人\tcomposant de la norme sans point de code"])
    assert table == {"以": "⿰{⿰𠄌丶}人"}
    assert analyser_ids("⿰{⿰𠄌丶}人") == ("⿰", ("⿰𠄌丶", "人"))
    with pytest.raises(SurchargeInvalide):
        parse_ids(["以\t⿰？\tIDS tronqué"])
    with pytest.raises(SurchargeInvalide):
        parse_ids(["以\t以\tse décompose en lui-même"])


def test_une_ligne_par_caractere() -> None:
    with pytest.raises(SurchargeInvalide):
        parse_ids(["在\t⿸𠂇⿰丨土\tune", "在\t⿸才土\tdeux"])
    with pytest.raises(SurchargeInvalide):
        parse_mots_exclus(["吧女\targot", "吧女\tencore"])


def test_equivalence_entre_deux_caracteres() -> None:
    assert parse_equivalences(["⺮\t𥫗\tradical 竹 en tête"]) == {"⺮": "𥫗"}
    with pytest.raises(SurchargeInvalide):
        parse_equivalences(["⺮\t⺮\tle même"])


def test_fichier_absent_vaut_table_vide(tmp_path: Path) -> None:
    assert surcharges.charger_pinyin(tmp_path / "absent.tsv") == {}
    assert surcharges.charger_ids(tmp_path / "absent.tsv") == {}
    assert surcharges.charger_mots_exclus(tmp_path / "absent.tsv") == {}


# --------------------------------------------------------------------------- réconciliation


def test_surcharge_passe_devant_les_deux_sources() -> None:
    ids, sources = combiner_ids({"在": "⿸才土", "乞": "⿱？乙"}, {"乞": "⿱𠂉㇠"}, {"在": "⿸𠂇⿰丨土"})
    assert ids["在"] == "⿸𠂇⿰丨土" and sources["在"] == SOURCE_SURCHARGE
    assert sources["乞"] == SOURCE_SECONDAIRE
    ids, sources = combiner_ids({"在": "⿸才土"}, {}, {})
    assert sources["在"] == SOURCE_MMAH


def _decomposer(caracteres: dict[str, str], secondaires: dict[str, str] | None = None) -> dict[str, object]:
    """Réconcilie avec la vraie table, les vraies surcharges et les IDS donnés."""
    table = charger_table(equivalences=surcharges.charger_equivalences(reelles("EQUIVALENCES")))
    ids = surcharges.charger_ids(reelles("IDS"))
    entrees = [{"c": c, "decomposition": d} for c, d in caracteres.items()]
    return {d.c: d for d in reconcilier(entrees, table, secondaires, ids)}


def test_xi_retrouve_shi_sous_le_tambour() -> None:
    d = _decomposer({"喜": "⿱壴口", "壴": "⿱土口"})["喜"]
    assert d.composants == ("士", "口", "䒑", "口") and d.reconcilie
    assert SOURCE_SURCHARGE in d.sources


def test_neng_lit_yue_et_non_deux_traits_hors_sens() -> None:
    d = _decomposer({"能": "⿰⿱厶⺼⿱匕匕", "⺼": "？"}, {"⺼": "⿵⺆亠"})["能"]
    assert d.composants == ("厶", "月", "匕", "匕") and d.reconcilie


def test_yi_prend_le_composant_sans_point_de_code() -> None:
    d = _decomposer({"以": "⿰？人"})["以"]
    assert d.composants == ("⿰𠄌丶", "人") and d.reconcilie


def test_zai_suit_la_forme_et_non_la_phonetique() -> None:
    d = _decomposer({"在": "⿸才土"})["在"]
    assert d.composants == ("𠂇", "丨", "土") and d.reconcilie


@pytest.mark.parametrize(
    ("c", "mmah", "attendu"),
    [
        ("那", "⿰⿹？？阝", ("𭃂", "阝")),
        ("是", "⿱日疋", ("日", "一", "龰")),
        ("学", "⿱⿱⺍冖子", ("𭕄", "子")),
        ("觉", "⿳⺍冖见", ("𭕄", "见")),
    ],
)
def test_composants_propres_de_la_norme(c: str, mmah: str, attendu: tuple[str, ...]) -> None:
    d = _decomposer({c: mmah})[c]
    assert d.composants == attendu and d.reconcilie


def test_trait_du_bloc_des_traits_ramene_a_la_norme() -> None:
    """令 : cjk-decomp écrit le point ㇔ ; la norme le donne en 丶."""
    d = _decomposer({"冷": "⿰冫令", "令": "⿱人？"}, {"令": "⿱亽龴", "亽": "⿱人㇔"})["冷"]
    assert d.composants == ("冫", "人", "丶", "龴") and d.reconcilie


def test_equivalence_garde_la_forme_de_la_source() -> None:
    """⺮ porte les tracés de Make Me a Hanzi : il reste ⺮, avec le nom de 𥫗."""
    d = _decomposer({"笔": "⿱⺮毛"})["笔"]
    assert d.composants == ("⺮", "毛") and d.reconcilie
    table = charger_table(equivalences={"⺮": "𥫗"})
    assert table["⺮"].nom == "竹头"
    assert table.principal("⺮") == table.principal("𥫗")
    with pytest.raises(TableInvalide):
        charger_table(equivalences={"⺮": "⺮⺮"})


def test_les_composants_decomposes_restent_ceux_de_la_norme() -> None:
    """Les phonétiques 音, 吾, 董, 另, 元, 亲 ne sont pas parmi les 514 : elles restent éclatées."""
    table = charger_table()
    for forme in "音吾董另元乞曷令冄是亲壴":
        assert forme not in table
    d = _decomposer({"意": "⿱音心", "音": "⿱立日"})["意"]
    assert d.composants == ("立", "日", "心")


# --------------------------------------------------------------------------- pinyin exporté


def test_export_prend_la_lecture_principale_de_la_surcharge(tmp_path: Path) -> None:
    (tmp_path / "unihan.json").write_text(
        json.dumps({"caracteres": [{"c": "地", "pinyin": "de"}, {"c": "人", "pinyin": "rén"}]}),
        encoding="utf-8",
    )
    lus = export.charger_pinyin(tmp_path, ["地", "人"], {"地": ("dì", "de"), "吧": ("ba",)})
    assert lus == {"地": "dì", "人": "rén"}


# --------------------------------------------------------------------------- fichiers du dépôt


def test_les_surcharges_du_depot_se_lisent() -> None:
    pinyin = surcharges.charger_pinyin(reelles("PINYIN"))
    attendus = {
        "地": ("dì", "de"),
        "吧": ("ba",),
        "呢": ("ne", "ní"),
        "谁": ("shéi", "shuí"),
        "觉": ("jué", "jiào"),
        "兴": ("xīng", "xìng"),
        "那": ("nà",),
    }
    for c, lectures in attendus.items():
        assert pinyin[c] == lectures
    ids = surcharges.charger_ids(reelles("IDS"))
    table = charger_table(equivalences=surcharges.charger_equivalences(reelles("EQUIVALENCES")))
    # Chaque cible nommée par une surcharge est un composant de la norme.
    for c, texte in ids.items():
        feuilles = [f for f in _feuilles(analyser_ids(texte))]
        assert all(f in table or f in ids for f in feuilles), (c, texte)


def _feuilles(noeud: object) -> list[str]:
    if isinstance(noeud, str):
        return [noeud]
    _, enfants = noeud  # type: ignore[misc]
    return [f for e in enfants for f in _feuilles(e)]
