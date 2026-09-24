"""Découpes de composants dans un caractère hôte : un test par règle. Aucun réseau.

Un composant de la norme que `graphics.txt` ne dessine pas prend les traits désignés
d'un hôte qui le contient, et rien d'autre ; le recadrage est une homothétie écrite
noir sur blanc. Les tests de règle donnent leurs propres lignes et leurs propres
tracés ; ceux du dépôt relisent le vrai `decoupes.tsv` (`SURCHARGES_REELLES`).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from conftest import SURCHARGES_REELLES
from wenlu_data import decoupes, export
from wenlu_data.decoupes import (
    AUCUN,
    CENTRE,
    CENTRE_BOITE,
    CIBLE,
    ECHELLE_MAX,
    Decoupe,
    DecoupeInvalide,
    boite,
    coordonnees,
    decouper,
    erreurs,
    lire_indices,
    parse_decoupes,
)
from wenlu_data.gf0014 import charger_table
from wenlu_data.graphe import DECOUPEE, MUETTE, construire, parcours
from wenlu_data.surcharges import SurchargeInvalide


def trait(x0: int, y0: int, x1: int, y1: int) -> str:
    """Un trait rectangulaire, écrit comme dans `graphics.txt`."""
    return f"M {x0} {y0} L {x1} {y0} Q {x1} {y1} {x1} {y1} L {x0} {y1} Z"


#: Un hôte de trois traits : un petit carré en haut à gauche, deux barres ailleurs.
HOTE = {
    "c": "左",
    "strokes": [trait(100, 700, 300, 800), trait(400, 100, 900, 200), trait(500, 300, 600, 600)],
    "medians": [[[100, 750], [300, 750]], [[400, 150], [900, 150]], [[550, 300], [550, 600]]],
}
GRAPHIES = {"左": HOTE, "木": {"c": "木", "strokes": [trait(0, 0, 10, 10)], "medians": [[[0, 0], [10, 10]]]}}


# --------------------------------------------------------------------------- table


def test_une_ligne_nomme_composant_hote_indices_recadrage_raison() -> None:
    [d] = parse_decoupes(["# commentaire", "𠂇\t左\t0,1\tcentre\t左字框 (514)"])
    assert d == Decoupe("𠂇", "左", (0, 1), CENTRE, "左字框 (514)", 2)


@pytest.mark.parametrize(
    ("texte", "attendu"),
    [("0,1", (0, 1)), ("3-6", (3, 4, 5, 6)), ("0-2,5", (0, 1, 2, 5)), ("11", (11,))],
)
def test_indices_en_liste_ou_en_plage(texte: str, attendu: tuple[int, ...]) -> None:
    assert lire_indices(texte) == attendu


@pytest.mark.parametrize(
    "ligne",
    [
        "𠂇\t左\t0,1\tcentre",  # pas de raison
        "𠂇\t左右\t0,1\tcentre\traison",  # hôte de deux caractères
        "𠂇\t左\t1,0\tcentre\traison",  # hors de l'ordre d'écriture
        "𠂇\t左\t0,0\tcentre\traison",  # trait répété
        "𠂇\t左\t0,a\tcentre\traison",  # indice illisible
        "𠂇\t左\t0,1\tagrandi\traison",  # recadrage inconnu
    ],
)
def test_ligne_mal_formee_refusee(ligne: str) -> None:
    with pytest.raises(SurchargeInvalide):
        parse_decoupes([ligne])


def test_un_composant_une_seule_ligne() -> None:
    with pytest.raises(SurchargeInvalide):
        parse_decoupes(["𠂇\t左\t0,1\tcentre\tr", "𠂇\t右\t0,1\tcentre\tr"])


# -------------------------------------------------------------------------- découpe


def test_la_decoupe_garde_les_seuls_traits_designes_dans_l_ordre_de_l_hote() -> None:
    d = decouper(Decoupe("𠂇", "左", (0, 2), AUCUN, "r"), GRAPHIES)
    assert d["strokes"] == [HOTE["strokes"][0], HOTE["strokes"][2]]
    assert d["medians"] == [HOTE["medians"][0], HOTE["medians"][2]]
    assert (d["hote"], d["indices"], d["traits_hote"]) == ("左", [0, 2], 3)


def test_recadrage_centre_porte_le_plus_grand_cote_a_la_cible_au_centre_de_la_boite() -> None:
    d = decouper(Decoupe("𠂇", "左", (1, 2), CENTRE, "r"), GRAPHIES)
    xmin, ymin, xmax, ymax = boite(d["strokes"])  # type: ignore[arg-type]
    assert max(xmax - xmin, ymax - ymin) == pytest.approx(CIBLE, abs=1)
    assert ((xmin + xmax) / 2, (ymin + ymax) / 2) == pytest.approx(CENTRE_BOITE, abs=1)
    # Les médianes suivent la même homothétie que les tracés.
    e, dx, dy = d["echelle"], d["dx"], d["dy"]
    assert d["medians"][0][0] == [round(e * 400 + dx), round(e * 150 + dy)]  # type: ignore[index, operator]


def test_un_petit_trait_n_est_jamais_agrandi_plus_de_deux_fois() -> None:
    d = decouper(Decoupe("𠂇", "左", (0,), CENTRE, "r"), GRAPHIES)
    assert d["echelle"] == ECHELLE_MAX


def test_recadrage_aucun_laisse_les_traits_a_leur_place() -> None:
    d = decouper(Decoupe("𠂇", "左", (0,), AUCUN, "r"), GRAPHIES)
    assert (d["echelle"], d["dx"], d["dy"]) == (1.0, 0.0, 0.0)
    assert coordonnees(d["strokes"][0]) == coordonnees(HOTE["strokes"][0])  # type: ignore[index]


def test_indice_hors_de_l_hote_refuse() -> None:
    with pytest.raises(DecoupeInvalide, match="3 traits"):
        decouper(Decoupe("𠂇", "左", (0, 3), CENTRE, "r"), GRAPHIES)


def test_hote_sans_traces_refuse() -> None:
    with pytest.raises(DecoupeInvalide, match="右"):
        decouper(Decoupe("𠂇", "右", (0,), CENTRE, "r"), GRAPHIES)


def test_trace_en_coordonnees_relatives_refuse() -> None:
    graphies = {"左": {"strokes": ["m 1 2 l 3 4 z"], "medians": [[[1, 2]]]}}
    with pytest.raises(DecoupeInvalide):
        decouper(Decoupe("𠂇", "左", (0,), CENTRE, "r"), graphies)


def test_rien_d_invente_le_composant_est_de_la_norme_sans_trace_propre_et_dans_l_hote() -> None:
    table = charger_table()
    decompositions = {"左": {"composants": ["𠂇", "工"]}, "木": {"composants": ["木"]}}
    assert erreurs(
        [Decoupe("𠂇", "左", (0, 1), CENTRE, "r")],
        table=table, graphies=GRAPHIES, decompositions=decompositions,
    ) == []
    fautes = erreurs(
        [
            Decoupe("猫", "左", (0,), CENTRE, "hors norme"),
            Decoupe("木", "左", (0,), CENTRE, "déjà dessiné"),
            Decoupe("𠂉", "左", (0,), CENTRE, "absent de la décomposition de l'hôte"),
        ],
        table=table, graphies=GRAPHIES, decompositions=decompositions,
    )
    assert any("猫 n'est pas un composant" in f for f in fautes)
    assert any("木 a déjà ses tracés" in f for f in fautes)
    assert any("la décomposition de 左 ne le contient pas" in f for f in fautes)


# --------------------------------------------------------------------------- graphe


def test_un_composant_decoupe_n_est_plus_muet_mais_reste_acquis_d_entree() -> None:
    """Dessiné, il n'est plus muet ; le parcours, lui, ne bouge pas."""
    caracteres = [
        {"c": "工", "composants": ["工"], "reconcilie": True},
        {"c": "月", "composants": ["月"], "reconcilie": True},
        {"c": "左", "composants": ["𠂇", "工"], "reconcilie": True},
        {"c": "有", "composants": ["𠂇", "月"], "reconcilie": True},
    ]
    avant = parcours(construire(caracteres), ["左", "有"])
    g = construire(caracteres, decoupees=["𠂇"])
    assert g["𠂇"].genre == DECOUPEE and not g["𠂇"].fiche
    assert construire(caracteres)["𠂇"].genre == MUETTE
    apres = parcours(g, ["左", "有"])
    assert apres.muettes == () and apres.decoupees == ("𠂇",)
    assert apres.jours == avant.jours
    assert g.racine("有") == "月", "une découpée ne devient pas racine de famille"


# --------------------------------------------------------------------------- export


def test_l_export_prend_les_traits_decoupes_et_decrit_chaque_decoupe(tmp_path: Path) -> None:
    (tmp_path / "graphies.json").write_text(json.dumps([GRAPHIES["木"]]), encoding="utf-8")
    trace = decouper(Decoupe("𠂇", "左", (0, 1), CENTRE, "r"), GRAPHIES)
    graphies = export.charger_graphies(
        tmp_path, ["木", "𠂇"], {"𠂇": {"s": trace["strokes"], "m": trace["medians"]}}
    )
    assert graphies["𠂇"]["s"] == trace["strokes"]

    note = export.modifications_md("0.1.0", 2, [trace])
    assert "## Composants découpés dans un caractère hôte" in note
    assert "| 𠂇 | 左 | 0, 1 (sur 3) |" in note
    assert "x' = e·x + dx" in note

    document = export.document_traits("𠂇", ["𠂇"], graphies, "0.1.0", ["𠂇"])
    assert "Sauf 𠂇 : traits découpés" in str(document["modified"])
    assert "Sauf" not in str(export.document_traits("木", ["木"], graphies, "0.1.0", ["𠂇"])["modified"])


def test_le_build_ecrit_decoupes_json(tmp_path: Path) -> None:
    ingest = tmp_path / "ingest"
    ingest.mkdir()
    (ingest / "graphies.json").write_text(json.dumps(list(GRAPHIES.values())), encoding="utf-8")
    rapport = decoupes.build(
        ingest=ingest, sortie=tmp_path, decoupes=[Decoupe("𠂇", "左", (0, 1), CENTRE, "r")]
    )
    assert rapport["decoupes"] == "1 composants découpés dans un hôte"
    assert decoupes.composants_decoupes(tmp_path) == ["𠂇"]
    assert list(decoupes.traits(tmp_path)) == ["𠂇"]

    with pytest.raises(DecoupeInvalide):
        decoupes.build(ingest=ingest, sortie=tmp_path, decoupes=[Decoupe("𠂇", "左", (7,), CENTRE, "r")])


# ------------------------------------------------------------------------ le dépôt


def test_la_table_du_depot_se_lit_et_ne_nomme_que_des_composants_de_la_norme() -> None:
    lues = decoupes.charger_decoupes(SURCHARGES_REELLES["DECOUPES"])
    assert lues, "decoupes.tsv est versionné"
    table = charger_table()
    assert [d.composant for d in lues if d.composant not in table] == []
