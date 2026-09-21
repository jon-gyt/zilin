"""Décomposition canonique GF 0014-2009 : un test par règle. Aucun accès réseau.

La table des 514 composants n'est pas sollicitée ici : chaque test donne sa
propre petite table en dur, pour que la règle testée soit lisible.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from zilin_data.gf0014 import (
    COLONNES,
    SOURCE_MMAH,
    SOURCE_SECONDAIRE,
    Composant,
    IdsInvalide,
    TableGF0014,
    TableInvalide,
    analyser_ids,
    build,
    charger_table,
    combiner_ids,
    controles,
    decomposer,
    parse_table,
    rapport_ecarts,
    reconcilier,
)

# Décompositions de Make Me a Hanzi, telles qu'elles sortent de l'ingestion.
IDS = {
    "好": "⿰女子",
    "女": "？",
    "子": "？",
    "住": "⿰亻主",
    "亻": "？",
    "主": "⿱丶王",
    "丶": "？",
    "王": "？",
    "照": "⿱昭灬",
    "昭": "⿰日召",
    "召": "⿱刀口",
    "日": "？",
    "刀": "？",
    "口": "？",
    "灬": "？",
}


def table(*formes: str) -> TableGF0014:
    """Petite table de composants : une forme par groupe, dans l'ordre donné."""
    return TableGF0014(
        [
            Composant(
                sequence=i,
                groupe=i,
                forme=f,
                type_forme="unicode",
                nom=f,
                nom_simple=f,
                principal=f,
                caractere_plein=True,
            )
            for i, f in enumerate(formes, start=1)
        ]
    )


def test_decomposition_simple() -> None:
    """好 se décompose en 女 puis 子, deux composants de la table."""
    d = decomposer("好", table("女", "子"), IDS)
    assert d.composants == ("女", "子")
    assert d.structure == "⿰女子"
    assert d.reconcilie


def test_composant_de_la_table_est_une_feuille() -> None:
    """住 s'arrête sur 主 quand 主 est dans la table : on ne descend pas plus bas."""
    d = decomposer("住", table("亻", "主"), IDS)
    assert d.composants == ("亻", "主")
    assert d.reconcilie


def test_decomposition_recursive() -> None:
    """Sans 主 dans la table, 住 descend jusqu'à 丶 et 王."""
    d = decomposer("住", table("亻", "丶", "王"), IDS)
    assert d.composants == ("亻", "丶", "王")
    assert d.structure == "⿰亻⿱丶王"
    assert d.reconcilie


def test_ordre_d_ecriture_preserve() -> None:
    """L'ordre des composants suit l'ordre des opérandes IDS, soit l'ordre d'écriture."""
    d = decomposer("照", table("日", "刀", "口", "灬"), IDS)
    assert d.composants == ("日", "刀", "口", "灬")
    assert d.structure == "⿱⿰日⿱刀口灬"


def test_feuille_inconnue_signalee() -> None:
    """Une feuille absente de la table est un écart, et reste dans la décomposition."""
    d = decomposer("好", table("女"), IDS)
    assert d.inconnus == ("子",)
    assert d.composants == ("女", "子")
    assert not d.reconcilie


def test_caractere_sans_ids_est_un_ecart() -> None:
    """Un caractère que la source ne décompose pas (？) et absent de la table est un écart."""
    d = decomposer("女", table("子"), IDS)
    assert d.inconnus == ("女",)
    assert not d.reconcilie


def test_caractere_de_la_table_se_decompose_en_lui_meme() -> None:
    """Un composant de la norme est sa propre décomposition canonique."""
    d = decomposer("女", table("女"), IDS)
    assert d.composants == ("女",)
    assert d.structure == "女"
    assert d.reconcilie


def test_cycle_detecte() -> None:
    """Une décomposition qui boucle est signalée, sans récursion infinie."""
    ids = {"甲": "⿰乙丙", "乙": "⿱甲丁", "丙": "？", "丁": "？"}
    d = decomposer("甲", table("丙", "丁"), ids)
    assert d.cycle == ("甲", "乙", "甲")
    assert not d.reconcilie


def test_ids_illisible_est_un_ecart() -> None:
    """Un IDS tronqué ne fait pas planter : le caractère est mis en écart."""
    d = decomposer("好", table("女", "子"), {"好": "⿰女"})
    assert d.inconnus == ("好",)
    assert not d.reconcilie


def test_analyser_ids_refuse_une_chaine_mal_formee() -> None:
    assert analyser_ids("⿰女子") == ("⿰", ("女", "子"))
    with pytest.raises(IdsInvalide):
        analyser_ids("⿰女")
    with pytest.raises(IdsInvalide):
        analyser_ids("⿰女子子")


# ----------------------------------------------------------------------- la table


def test_table_livree_complete() -> None:
    """La table versionnée porte les 514 composants et 441 groupes de la norme."""
    gf = charger_table()
    assert len(gf) == 514
    assert gf.groupes == 441
    assert [c.sequence for c in gf] == list(range(1, 515))


def test_variantes_de_forme() -> None:
    """丷 est une variante de forme de 八 : même groupe, principal 八."""
    gf = charger_table()
    assert gf["丷"].principal == "八"
    assert gf["丷"].variante
    assert not gf["八"].variante
    assert gf["八"].groupe == gf["丷"].groupe


def test_composants_sans_point_de_code() -> None:
    """Les composants que Unicode ne code pas sont décrits en IDS, jamais appariés."""
    gf = charger_table()
    sans_code = [c for c in gf if c.type_forme == "ids"]
    assert len(sans_code) == 30
    assert all(c.forme not in gf.par_forme for c in sans_code)


def test_homographes_conserves() -> None:
    """Quatre points de code portent deux composants distincts de la norme."""
    gf = charger_table()
    assert set(gf.homographes) == {"⺈", "丁", "丷", "𧘇"}


def test_parse_table_refuse_des_colonnes_inattendues() -> None:
    with pytest.raises(TableInvalide):
        parse_table(["a\tb\tc"])
    with pytest.raises(TableInvalide):
        parse_table(["# rien que des commentaires"])
    entete = "\t".join(COLONNES)
    with pytest.raises(TableInvalide):
        parse_table([entete, "1\t1\t女\tautre\t女\t女\t女\t1"])


# ------------------------------------------------------------------- build, check


def _ingest(dossier: Path) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "caracteres.json").write_text(
        json.dumps([{"c": c, "decomposition": d} for c, d in IDS.items()], ensure_ascii=False),
        encoding="utf-8",
    )
    (dossier / "listes.json").write_text(
        json.dumps({"hsk-1": ["好", "照"]}, ensure_ascii=False), encoding="utf-8"
    )
    return dossier


def test_build_ecrit_les_deux_fichiers(tmp_path: Path) -> None:
    """build produit decompositions.json et ecarts.md, et compte les réconciliés."""
    gf = table("女", "子", "亻", "主", "日", "刀", "口", "灬", "丶", "王")
    rapport = build(ingest=_ingest(tmp_path / "ingest"), sortie=tmp_path / "build", table=gf)

    document = json.loads((tmp_path / "build" / "decompositions.json").read_text(encoding="utf-8"))
    par_caractere = {c["c"]: c for c in document["caracteres"]}
    assert par_caractere["好"]["composants"] == ["女", "子"]
    assert par_caractere["照"]["structure"] == "⿱⿰日⿱刀口灬"
    assert rapport["caracteres"] == len(IDS)
    assert rapport["hsk-1_non_reconcilies"] == 0

    ecarts = (tmp_path / "build" / "ecarts.md").read_text(encoding="utf-8")
    assert "# Écarts de réconciliation avec GF 0014-2009" in ecarts


def test_check_signale_les_cycles(tmp_path: Path) -> None:
    """Le contrôle « cycles » est bloquant, celui des composants inconnus ne l'est pas."""
    ids = {"甲": "⿰乙丙", "乙": "⿱甲丁", "丙": "？", "丁": "？"}
    ingest = tmp_path / "ingest"
    ingest.mkdir(parents=True)
    (ingest / "caracteres.json").write_text(
        json.dumps([{"c": c, "decomposition": d} for c, d in ids.items()], ensure_ascii=False),
        encoding="utf-8",
    )
    build(ingest=ingest, sortie=tmp_path / "build", table=table("丙"))

    resultats = {c.nom: c for c in controles(sortie=tmp_path / "build")}
    assert not resultats["cycles"].ok
    assert resultats["cycles"].bloquant
    assert not resultats["composants inconnus"].ok
    assert not resultats["composants inconnus"].bloquant


def test_check_exige_un_build(tmp_path: Path) -> None:
    (controle,) = controles(sortie=tmp_path / "vide")
    assert not controle.ok and controle.bloquant


def test_rapport_classe_les_inconnus_par_frequence() -> None:
    """Le rapport liste les composants inconnus du plus fréquent au moins fréquent."""
    gf = table("女", "日", "刀", "口")
    decompositions = reconcilier(
        [{"c": c, "decomposition": d} for c, d in IDS.items()], gf
    )
    texte = rapport_ecarts(decompositions, gf, {"hsk-1": ["好"]})
    frequences = [
        ligne for ligne in texte.splitlines() if ligne.startswith("| `") and "U+" in ligne
    ]
    nombres = [int(ligne.split("|")[2]) for ligne in frequences]
    assert nombres == sorted(nombres, reverse=True)
    assert "### hsk-1" in texte


# ------------------------------------------------------------------ IDS secondaire

# Make Me a Hanzi ne décompose pas 甲 : son IDS porte le `？`. La source
# secondaire (cjk-decomp converti en IDS) prend le relais, et seulement là.
IDS_MMAH = {"甲": "⿰乙？", "乙": "？", "丁": "？", "戊": "？", "好": "⿰女子", "女": "？", "子": "？"}
IDS_SECONDAIRE = {"甲": "⿰乙丙", "丙": "⿱丁戊", "好": "⿱子女"}


def _decomposition(c: str, gf: TableGF0014, secondaires: dict[str, str]):
    (d,) = [
        d
        for d in reconcilier([{"c": c, "decomposition": IDS_MMAH[c]}], gf, secondaires)
        if d.c == c
    ]
    return d


def test_ids_secondaire_quand_make_me_a_hanzi_donne_un_point_d_interrogation() -> None:
    """Un IDS qui porte `？` est remplacé par celui de la source secondaire."""
    d = _decomposition("甲", table("乙", "丙"), IDS_SECONDAIRE)
    assert d.composants == ("乙", "丙")
    assert d.reconcilie
    assert d.sources == (SOURCE_SECONDAIRE,)


def test_ids_secondaire_ignore_quand_make_me_a_hanzi_decompose() -> None:
    """Tant que Make Me a Hanzi décompose, sa décomposition prime."""
    d = _decomposition("好", table("女", "子"), IDS_SECONDAIRE)
    assert d.structure == "⿰女子"
    assert d.sources == (SOURCE_MMAH,)


def test_ids_secondaire_pour_un_caractere_ignore_de_make_me_a_hanzi() -> None:
    """La descente ouvre aussi les composants que Make Me a Hanzi ne connaît pas."""
    d = _decomposition("甲", table("乙", "丁", "戊"), IDS_SECONDAIRE)
    assert d.composants == ("乙", "丁", "戊")
    assert d.sources == (SOURCE_SECONDAIRE,)


def test_combiner_ids_dit_la_source_de_chaque_ids() -> None:
    """La fusion garde trace de la source retenue pour chaque caractère."""
    ids, sources = combiner_ids(IDS_MMAH, IDS_SECONDAIRE)
    assert ids["甲"] == "⿰乙丙"
    assert sources["甲"] == SOURCE_SECONDAIRE
    assert ids["好"] == "⿰女子"
    assert sources["好"] == SOURCE_MMAH
    assert sources["丙"] == SOURCE_SECONDAIRE


def test_build_lit_les_ids_secondaires(tmp_path: Path) -> None:
    """build charge `ids-secondaires.json` et compte ce qu'il réconcilie en plus."""
    ingest = tmp_path / "ingest"
    ingest.mkdir(parents=True)
    (ingest / "caracteres.json").write_text(
        json.dumps(
            [{"c": c, "decomposition": d} for c, d in IDS_MMAH.items()], ensure_ascii=False
        ),
        encoding="utf-8",
    )
    (ingest / "listes.json").write_text(
        json.dumps({"hsk-1": ["甲"]}, ensure_ascii=False), encoding="utf-8"
    )
    (ingest / "ids-secondaires.json").write_text(
        json.dumps({"source": SOURCE_SECONDAIRE, "ids": IDS_SECONDAIRE}, ensure_ascii=False),
        encoding="utf-8",
    )
    rapport = build(
        ingest=ingest, sortie=tmp_path / "build", table=table("乙", "丙", "女", "子")
    )
    assert rapport["ids_secondaires"] == len(IDS_SECONDAIRE)
    assert rapport["reconcilies_via_secondaire"] == 1
    assert rapport["hsk-1_non_reconcilies"] == 0

    document = json.loads((tmp_path / "build" / "decompositions.json").read_text(encoding="utf-8"))
    par_caractere = {c["c"]: c for c in document["caracteres"]}
    assert par_caractere["甲"]["sources"] == [SOURCE_SECONDAIRE]
    assert SOURCE_SECONDAIRE in document["source_ids_secondaire"]

    ecarts = (tmp_path / "build" / "ecarts.md").read_text(encoding="utf-8")
    assert SOURCE_SECONDAIRE in ecarts
    assert "Réconciliés grâce à l'IDS secondaire, à relire : 甲" in ecarts


def test_build_sans_ids_secondaires(tmp_path: Path) -> None:
    """Sans `ids-secondaires.json`, la réconciliation reste celle de Make Me a Hanzi."""
    rapport = build(
        ingest=_ingest(tmp_path / "ingest"), sortie=tmp_path / "build", table=table("女", "子")
    )
    assert rapport["ids_secondaires"] == "source absente (ids-secondaires.json)"
    assert rapport["reconcilies_via_secondaire"] == 0
