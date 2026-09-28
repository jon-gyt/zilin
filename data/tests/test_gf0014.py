"""Décomposition canonique GF 0014-2009 : un test par règle. Aucun accès réseau.

La table des 514 composants n'est pas sollicitée ici : chaque test donne sa
propre petite table en dur, pour que la règle testée soit lisible.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data.gf0014 import (
    COLONNES,
    SOURCE_CJK_DECOMP,
    SOURCE_MMAH,
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
    noter,
    parse_table,
    rapport_ecarts,
    reconcilier,
)

# Décompositions de cjk-decomp, telles qu'elles sortent de l'ingestion : un caractère
# qui est un composant de la table n'en a pas besoin.
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


def _ingest(dossier: Path, ids: dict[str, str] | None = None, listes: dict[str, list[str]] | None = None) -> Path:
    """Un `wenlu ingest` factice : l'univers (`graphies.json`) et les IDS de cjk-decomp."""
    ids = IDS if ids is None else ids
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "graphies.json").write_text(
        json.dumps([{"c": c, "strokes": [], "medians": []} for c in ids], ensure_ascii=False),
        encoding="utf-8",
    )
    (dossier / "ids-secondaires.json").write_text(
        json.dumps(
            {"source": SOURCE_CJK_DECOMP, "ids": {c: d for c, d in ids.items() if d != "？"}},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (dossier / "listes.json").write_text(
        json.dumps(listes if listes is not None else {"hsk-1": ["好", "照"]}, ensure_ascii=False),
        encoding="utf-8",
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
    build(ingest=_ingest(tmp_path / "ingest", ids, {}), sortie=tmp_path / "build", table=table("丙"))

    resultats = {c.nom: c for c in controles(sortie=tmp_path / "build")}
    assert not resultats["cycles"].ok
    assert resultats["cycles"].bloquant
    assert not resultats["composants inconnus"].ok
    assert not resultats["composants inconnus"].bloquant


def test_check_exige_un_build(tmp_path: Path) -> None:
    (controle,) = controles(sortie=tmp_path / "vide")
    assert not controle.ok and controle.bloquant


def test_check_classe_les_inconnus_ex_aequo_par_forme(tmp_path: Path) -> None:
    """À nombre de caractères égal, la forme départage : le détail est reproductible."""
    ids = {"甲": "⿰丁乙", "丙": "⿰乙丁"}
    build(ingest=_ingest(tmp_path / "ingest", ids, {}), sortie=tmp_path / "build", table=table("女"))
    resultats = {c.nom: c for c in controles(sortie=tmp_path / "build")}
    assert "丁 (2), 乙 (2)" in resultats["composants inconnus"].detail


def test_rapport_classe_les_inconnus_par_frequence() -> None:
    """Le rapport liste les composants inconnus du plus fréquent au moins fréquent."""
    gf = table("女", "日", "刀", "口")
    decompositions = reconcilier(list(IDS), gf, {c: d for c, d in IDS.items() if d != "？"})
    texte = rapport_ecarts(decompositions, gf, {"hsk-1": ["好"]})
    frequences = [
        ligne for ligne in texte.splitlines() if ligne.startswith("| `") and "U+" in ligne
    ]
    nombres = [int(ligne.split("|")[2]) for ligne in frequences]
    assert nombres == sorted(nombres, reverse=True)
    assert "### hsk-1" in texte


# ------------------------------------------------------ chaîne : surcharges, cjk-decomp

# cjk-decomp décrit 甲 et 丙 ; une surcharge versionnée corrige 好.
IDS_CJK = {"甲": "⿰乙丙", "丙": "⿱丁戊", "好": "⿱子女"}


def test_la_source_des_decompositions_est_cjk_decomp() -> None:
    """Règle de licence (§10) : la décomposition descend cjk-decomp, jamais Make Me a Hanzi."""
    (d,) = reconcilier(["甲"], table("乙", "丁", "戊"), IDS_CJK)
    assert d.composants == ("乙", "丁", "戊")
    assert d.reconcilie
    assert d.sources == (SOURCE_CJK_DECOMP,)


def test_la_surcharge_passe_devant_cjk_decomp() -> None:
    """Une décomposition rédigée pour Wenlu l'emporte, et se nomme."""
    (d,) = reconcilier(["好"], table("女", "子"), IDS_CJK, {"好": "⿰女子"})
    assert d.structure == "⿰女子"
    assert d.sources == ("surcharge",)


def test_combiner_ids_dit_la_source_de_chaque_ids() -> None:
    """La fusion garde trace de la source retenue pour chaque caractère."""
    ids, sources = combiner_ids(IDS_CJK, {"好": "⿰女子"})
    assert ids["好"] == "⿰女子" and sources["好"] == "surcharge"
    assert sources["甲"] == SOURCE_CJK_DECOMP
    assert SOURCE_MMAH not in sources.values()


def test_notation_de_cjk_decomp_ramenee_a_la_norme() -> None:
    """⺹ n'est qu'une notation de 耂 : la descente s'arrête sur le composant de la norme."""
    ids = noter({"考": "⿱⺹丂"}, {"⺹": "耂"})
    (d,) = reconcilier(["考"], table("耂", "丂"), ids)
    assert d.composants == ("耂", "丂") and d.reconcilie
    assert d.sources == (SOURCE_CJK_DECOMP,)


def test_build_ne_lit_pas_dictionary_txt(tmp_path: Path) -> None:
    """build tire l'univers de `graphies.json` et les IDS de cjk-decomp ; `caracteres.json`
    (Make Me a Hanzi) peut porter n'importe quoi, rien n'en sort."""
    ingest = _ingest(tmp_path / "ingest", {"甲": "⿰乙丙", "乙": "？", "丙": "？"}, {"hsk-1": ["甲"]})
    (ingest / "caracteres.json").write_text(
        json.dumps([{"c": "甲", "decomposition": "⿱丙乙"}], ensure_ascii=False), encoding="utf-8"
    )
    rapport = build(ingest=ingest, sortie=tmp_path / "build", table=table("乙", "丙"))
    assert rapport["ids_cjk_decomp"] == 1
    assert rapport["reconcilies_via_cjk_decomp"] == 1
    assert rapport["decompositions_makemeahanzi"] == 0
    assert rapport["hsk-1_non_reconcilies"] == 0

    document = json.loads((tmp_path / "build" / "decompositions.json").read_text(encoding="utf-8"))
    par_caractere = {c["c"]: c for c in document["caracteres"]}
    assert par_caractere["甲"]["structure"] == "⿰乙丙"
    assert par_caractere["甲"]["sources"] == [SOURCE_CJK_DECOMP]
    assert SOURCE_CJK_DECOMP in document["source_ids"]
    ecarts = (tmp_path / "build" / "ecarts.md").read_text(encoding="utf-8")
    assert "Réconciliés par cjk-decomp seul : 甲" in ecarts


def test_build_sans_cjk_decomp(tmp_path: Path) -> None:
    """Sans `ids-secondaires.json`, rien ne se décompose que par les surcharges."""
    ingest = _ingest(tmp_path / "ingest")
    (ingest / "ids-secondaires.json").unlink()
    rapport = build(ingest=ingest, sortie=tmp_path / "build", table=table("女", "子"))
    assert rapport["ids_cjk_decomp"] == "source absente (ids-secondaires.json)"
    assert rapport["reconcilies_via_cjk_decomp"] == 0
