"""Les niveaux du chemin : des fables de première lecture au jour N du parcours Lire
(décision du propriétaire du 26 septembre 2026 : le premier conte s'ouvrait au jour 166,
trop tard). Un test par règle. Les textes des fixtures sont des suites de caractères sans
récit ; les fables du dépôt sortent du pipeline.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import contes
from wenlu_data.contes import (
    CatalogueInvalide,
    SeuilInconnu,
    SeuilSansListe,
    charger_seuil,
    parse_catalogue,
    valider,
)

from test_contes import CONTE, generation_de_test, ligne_catalogue, reponse

JOURS = {"人": 1, "大": 2, "天": 3, "山": 3, "水": 4, "日": 5, "月": 5}


def ecrire_fiches(listes: Path, jours: dict[str, int], parcours: str = "lire") -> Path:
    """Des fiches factices, voisines des listes : `{c, parcours, jour}` suffit au niveau."""
    fiches = listes.parent / "fiches"
    fiches.mkdir(parents=True, exist_ok=True)
    for c, jour in jours.items():
        (fiches / f"{c}.json").write_text(
            json.dumps({"c": c, "parcours": parcours, "jour": jour}, ensure_ascii=False), encoding="utf-8"
        )
    return fiches


def version_du_chemin(texte: str, seuil: str, expliques: tuple[str, ...] = ()) -> contes.Version:
    version = contes.lire_reponse(reponse("山", [texte]), conte=CONTE, seuil=seuil, generation=generation_de_test())
    mots = [
        contes.MotExplique(m, " ".join("pīn" for _ in m), "sens", "sense", "Une explication.", "An explanation.")
        for m in expliques
    ]
    return replace(version, expliques=mots)


def test_un_jour_du_chemin_est_un_niveau() -> None:
    """`jour25` se lit comme un niveau, se range sous le seuil 255, et entre eux par leur
    jour ; ni jour 0, ni jour au-delà de 254."""
    assert contes.lire_niveau("jour25") == "jour25" and contes.lire_niveau(" JOUR60 ") == "jour60"
    for faux in ("jour0", "jour255", "jour", "jour1x", "j25"):
        with pytest.raises(SeuilInconnu):
            contes.lire_niveau(faux)
    assert sorted(["hsk1", 255, "jour60", "jour25"], key=contes.rang) == ["jour25", "jour60", 255, "hsk1"]
    assert contes.libelle("jour25") == "jour 25 du chemin Lire"
    assert contes.au_niveau("jour25") == "au jour 25 du chemin Lire"
    assert contes.longueur_visee("jour25") == contes.LONGUEUR_CHEMIN == (30, 60)


def test_un_jour_du_chemin_autorise_l_acquis_des_jours_1_a_n(tmp_path: Path) -> None:
    """Cumulatif, comme un niveau HSK : `jour3` autorise ce que les fiches font entrer aux
    jours 1 à 3 du parcours Lire, dans l'ordre du chemin ; rien d'un autre parcours."""
    listes = tmp_path / "listes"
    ecrire_fiches(listes, JOURS)
    ecrire_fiches(listes, {"鸟": 1}, parcours="hsk")
    assert charger_seuil("jour3", listes) == ["人", "大", "天", "山"]
    assert charger_seuil("jour5", listes) == ["人", "大", "天", "山", "水", "日", "月"]
    assert contes.liste_presente("jour3", listes)
    with pytest.raises(SeuilSansListe):
        charger_seuil("jour3", tmp_path / "vide" / "listes")


def test_une_fable_du_chemin_n_a_que_son_jour() -> None:
    """Une première lecture, très courte : un seul niveau, jamais mêlé au plan HSK."""
    (conte,) = parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(niveaux="jour25", cles="/鸟")])
    assert conte.niveaux == ("jour25",)
    with pytest.raises(CatalogueInvalide, match="seul"):
        parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(niveaux="jour25,hsk3")])


def test_une_version_du_chemin_ne_prend_que_l_acquis_de_son_jour(tmp_path: Path) -> None:
    """Un caractère du jour 4 dans une version au jour 3 est un intrus ; un personnage ou
    un objet clé déclaré passe en mot expliqué, trois caractères au plus."""
    listes = tmp_path / "listes"
    ecrire_fiches(listes, JOURS)
    autorises = charger_seuil("jour3", listes)
    assert valider(version_du_chemin("人大天。", "jour3"), autorises).conforme
    assert valider(version_du_chemin("人大水。", "jour3"), autorises).intrus == ["水"]
    conte = replace(CONTE, niveaux=("jour3",), expliquables="鸟鱼虫龟")
    assert valider(version_du_chemin("人鸟。", "jour3", ("鸟",)), autorises, conte).conforme
    trop = valider(version_du_chemin("鸟鱼虫龟。", "jour3", ("鸟", "鱼", "虫", "龟")), autorises, conte)
    assert not trop.conforme and any("3 au plus" in r for r in trop.refus)


def test_une_version_du_chemin_s_ouvre_au_jour_de_son_niveau(tmp_path: Path) -> None:
    """Le jour du niveau est celui où entre le dernier caractère du texte, titre compris,
    mots expliqués mis à part : plus tôt, le niveau la ferait attendre pour rien."""
    listes = tmp_path / "listes"
    ecrire_fiches(listes, JOURS)
    jours = contes.jours_du_chemin(listes)
    assert contes.jour_d_ouverture("山水。人鸟", jours, "鸟") == 4
    assert contes.jour_d_ouverture("山鸟", jours) is None
    assert contes.ecarts_de_jour(version_du_chemin("人水。", "jour4"), jours) == []
    assert contes.ecarts_de_jour(version_du_chemin("人大。", "jour4"), jours) == [
        "jour4/conte-de-test : lisible dès le jour 3 du chemin Lire, niveau jour4"
    ]


def test_le_critere_d_une_fable_du_chemin() -> None:
    """Ses caractères clés sont dans l'acquis de son jour, et ce qu'elle explique tient en
    trois caractères."""
    listes = {"jour3": {"人", "大", "天", "山"}}
    bon = replace(CONTE, niveaux=("jour3",), cles="山", expliquables="鸟")
    assert contes.ecarts_du_chemin(bon, listes.get) == []
    mauvais = replace(CONTE, niveaux=("jour3",), cles="水", expliquables="鸟鱼虫龟")
    ecarts = contes.ecarts_du_chemin(mauvais, listes.get)
    assert any("水 hors du jour 3" in e for e in ecarts)
    assert any("4 caractères à expliquer" in e for e in ecarts)

