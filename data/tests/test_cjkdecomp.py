"""Conversion de cjk-decomp en IDS : un test par règle. Aucun accès réseau.

Les extraits sont des lignes réelles de `cjk-decomp.txt`.
"""
from __future__ import annotations

from zilin_data.cjkdecomp import Entree, document, en_ids, ids_par_caractere, lire, parse_ligne

EXTRAIT = """的:a(白,勺)
照:d(昭,灬)
国:s(囗,玉)
间:st(门,日)
我:a/m(手,戈)
中:lock(口,㇑)
品:r3tr(口)
爱:d(37333,友)
37333:d(⺤,冖)
能:a(䏍,65438)
65438:rd(匕)
一:c()
"""


def entrees() -> dict[str, Entree]:
    return lire(EXTRAIT.splitlines())


def test_ligne_lue() -> None:
    """`的:a(白,勺)` : une clé, un code de disposition, deux constituants."""
    cle, entree = parse_ligne("的:a(白,勺)")
    assert cle == "的"
    assert entree == Entree(type="a", constituants=("白", "勺"))


def test_dispositions_converties_en_ids() -> None:
    """Les codes de disposition connus deviennent l'opérateur IDS correspondant."""
    e = entrees()
    assert en_ids("的", e) == "⿰白勺"
    assert en_ids("照", e) == "⿱昭灬"
    assert en_ids("国", e) == "⿴囗玉"
    assert en_ids("间", e) == "⿵门日"


def test_suffixe_de_contact_ignore() -> None:
    """`a/m` note la façon dont les traits se touchent : l'IDS n'en garde rien."""
    assert en_ids("我", entrees()) == "⿰手戈"


def test_enchassement_note_par_recouvrement() -> None:
    """`lock` n'a pas d'équivalent IDS exact : ⿻ le note sans plus de précision."""
    assert en_ids("中", entrees()) == "⿻口㇑"


def test_repetition_developpee() -> None:
    """`r3tr` répète le composant en triangle : 品 devient ⿱口⿰口口."""
    assert en_ids("品", entrees()) == "⿱口⿰口口"


def test_intermediaire_developpe() -> None:
    """Un intermédiaire à cinq chiffres est développé jusqu'aux caractères."""
    e = entrees()
    assert en_ids("爱", e) == "⿱⿱⺤冖友"
    assert en_ids("能", e) == "⿰䏍⿱匕匕"


def test_composant_simple_sans_ids() -> None:
    """`c` ne décrit aucune composition : mieux vaut pas d'IDS qu'un faux."""
    assert en_ids("一", entrees()) is None
    assert "一" not in ids_par_caractere(entrees())


def test_code_inconnu_sans_ids() -> None:
    """Un code de disposition non traduit ne rend aucun IDS."""
    assert en_ids("甲", {"甲": Entree(type="refh", constituants=("乙",))}) is None


def test_cycle_entre_intermediaires_sans_ids() -> None:
    """Deux intermédiaires qui se renvoient l'un à l'autre ne rendent aucun IDS.

    Un caractère constituant, lui, reste une feuille de l'IDS : c'est la
    descente de `gf0014` qui détectera un éventuel cycle entre caractères.
    """
    boucle = {
        "甲": Entree(type="a", constituants=("乙", "11111")),
        "11111": Entree(type="a", constituants=("22222", "丙")),
        "22222": Entree(type="d", constituants=("11111", "丁")),
    }
    assert en_ids("甲", boucle) is None


def test_index_par_caractere() -> None:
    """Seules les clés d'un caractère unique et convertible entrent dans l'index."""
    index = ids_par_caractere(entrees())
    assert index["的"] == "⿰白勺"
    assert "37333" not in index
    assert document(index)["licence"].startswith("MIT")
