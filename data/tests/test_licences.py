"""Licence des décompositions (`wenlu licences`) : un test par règle. Aucun accès réseau.

Les extraits de BabelStone, cjkvi-ids et CHISE sont des lignes réelles de leurs fichiers ;
chaque test donne sa petite table de la norme en dur.
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from wenlu_data import licences as L
from wenlu_data.gf0014 import (
    INCONNU,
    Composant,
    TableGF0014,
    document_decompositions,
    reconcilier,
)
from wenlu_data.surcharges import SurchargeInvalide


def composant(sequence: int, forme: str, groupe: int | None = None, principal: str | None = None) -> Composant:
    return Composant(
        sequence=sequence,
        groupe=groupe or sequence,
        forme=forme,
        type_forme="unicode",
        nom=forme,
        nom_simple=forme,
        principal=principal or forme,
        caractere_plein=True,
    )


def table(*formes: str, equivalences: dict[str, str] | None = None) -> TableGF0014:
    """Une forme par groupe, dans l'ordre donné."""
    return TableGF0014([composant(i, f) for i, f in enumerate(formes, 1)], equivalences)


# ----------------------------------------------------------------------- lecture


BABELSTONE = """﻿# Ideographic Description Sequences (IDS) for CJK Unified Ideographs
# Maintained by: Andrew West (魏安) <babelstone@gmail.com>
U+4E01\t丁\t^⿱一亅$(GHTJKPV)
U+4E03\t七\t^〾⿻一乚$(GHJKPV)\t^〾⿻一㇄$(T)
U+5C1A\t尚\t^⿱⺌冋$(GJKV)\t^⿱⺌⿵冂口$(T)
U+8FB9\t边\t^⿺辶力$(GHKV)
U+5341\t卍\t^⿻㇯十一$(G)
U+865F\t號\t^⿰号{13}$(G)
"""


def test_babelstone_lu_variante_continentale() -> None:
    """La variante marquée G est retenue, sans ^ ni $, et la ligne de commentaire saute."""
    ids = L.lire_babelstone(BABELSTONE.splitlines())
    assert ids["丁"] == "⿱一亅"
    assert ids["尚"] == "⿱⺌冋"
    assert ids["边"] == "⿺辶力"
    assert "#" not in "".join(ids)


def test_babelstone_marque_de_variante_ignoree() -> None:
    """〾 ne dit qu'une différence mineure de dessin : il tombe."""
    assert L.lire_babelstone(BABELSTONE.splitlines())["七"] == "⿻一乚"


def test_composant_non_code_devient_inconnu() -> None:
    """`{13}` (BabelStone), `&CDP-…;` et ① (cjkvi) ne sont pas des caractères : ？."""
    assert L.lire_babelstone(BABELSTONE.splitlines())["號"] == "⿰号" + INCONNU
    assert L.normaliser("⿹&CDP-8BBF;一") == "⿹" + INCONNU + "一"
    assert L.normaliser("⿱①口") == "⿱" + INCONNU + "口"


def test_operateur_unicode_15_1_rend_l_ids_illisible() -> None:
    """㇯ et ⿾ ne sont pas lus par la descente : tout l'IDS vaut ？ plutôt qu'une fausse feuille."""
    assert L.lire_babelstone(BABELSTONE.splitlines())["卍"] == INCONNU
    assert L.normaliser("⿰⿾臣臣") == INCONNU


CJKVI = """# Copyright (c) 2014-2017 CJKVI Database
;; -*- coding: utf-8-mcs-er -*-
U+4E0E\t与\t⿹&CDP-8BBF;一
U+4E1E\t丞\t⿱⿵了？一[GTV]\t⿱⿵了？一[J]
U+4E28\t丨\t丨
U+5DF1\t己\t己
U+8303\t范\t⿱艹氾[GJK]\t⿱艹⿰氵㔾[T]
"""


def test_ids_tabule_lu_variante_continentale() -> None:
    """cjkvi-ids et CHISE : colonnes tabulées, sources entre crochets, `#` et `;` commentent."""
    ids = L.lire_ids_tabule(CJKVI.splitlines())
    assert ids["范"] == "⿱艹氾"
    assert ids["与"] == "⿹" + INCONNU + "一"
    assert ids["己"] == "己"
    assert len(ids) == 5


def _archive(chemin: Path, lignes: list[str]) -> Path:
    with zipfile.ZipFile(chemin, "w") as z:
        z.writestr("Unihan_IRGSources.txt", "\n".join(lignes) + "\n")
    return chemin


def test_unihan_sans_kids_ne_decrit_rien(tmp_path: Path) -> None:
    """Unihan 17.0.0 et 18.0.0 n'ont pas de `kIDS` : rien n'est lu, la version l'est."""
    archive = _archive(
        tmp_path / "Unihan.zip",
        ["# Unihan_IRGSources.txt", "# Unicode Version 18.0.0", "U+4E01\tkTotalStrokes\t2"],
    )
    assert L.lire_kids(archive) == ({}, "18.0.0")


def test_unihan_kids_lu_s_il_existe(tmp_path: Path) -> None:
    """Si une version ajoute `kIDS`, la mesure le lit sans autre changement."""
    archive = _archive(tmp_path / "Unihan.zip", ["U+597D\tkIDS\t⿰女子"])
    assert L.lire_kids(archive)[0] == {"好": "⿰女子"}


def test_notation_ramene_une_forme_hors_table(tmp_path: Path) -> None:
    """⺹ n'est pas dans la norme : il devient 耂 avant la descente."""
    t = table("耂", "子")
    fichier = tmp_path / "notation.tsv"
    fichier.write_text("# commentaire\n⺹\t耂\tradical OLD\n", encoding="utf-8")
    notation = L.charger_notation(t, fichier)
    assert L.noter({"孝": "⿸⺹子"}, notation) == {"孝": "⿸耂子"}


@pytest.mark.parametrize("ligne", ["艹\t耂\tforme de la table", "⺹\t老\tcible hors table"])
def test_notation_ne_renomme_jamais_un_composant(tmp_path: Path, ligne: str) -> None:
    """Une forme de la table est un composant (卄 n'est pas 艹) ; une cible hors table ne mène à rien."""
    fichier = tmp_path / "notation.tsv"
    fichier.write_text(ligne + "\n", encoding="utf-8")
    with pytest.raises(SurchargeInvalide):
        L.charger_notation(table("耂", "艹"), fichier)


def test_notation_versionnee_valide() -> None:
    """Le fichier du dépôt se lit contre la vraie table."""
    from wenlu_data.gf0014 import charger_table

    t = charger_table()
    notation = L.charger_notation(t)
    assert notation and all(f not in t and c in t for f, c in notation.items())


# ------------------------------------------------------------------------ mesure


def test_identique() -> None:
    assert L.mesurer("好", ("女", "子"), table("女", "子"), {"好": "⿰女子"}, {}).verdict == L.IDENTIQUE


def test_equivalent_a_la_notation_pres() -> None:
    """⺮ (Make Me a Hanzi) et 𥫗 (candidat) sont le même composant 502 de la norme."""
    t = table("𥫗", "毛", equivalences={"⺮": "𥫗"})
    m = L.mesurer("笔", ("⺮", "毛"), t, {"笔": "⿱𥫗毛"}, {})
    assert m.verdict == L.EQUIVALENT
    assert L.EQUIVALENT in L.CONSERVES


def test_variante_du_meme_groupe() -> None:
    """王 et 𤣩 du même groupe : la place est la même, la variante non — à relire."""
    t = TableGF0014([composant(1, "王", 1), composant(2, "𤣩", 1, "王"), composant(3, "见")])
    m = L.mesurer("现", ("王", "见"), t, {"现": "⿰𤣩见"}, {})
    assert m.verdict == L.VARIANTE
    assert L.VARIANTE not in L.CONSERVES


def test_ordre_different() -> None:
    m = L.mesurer("坐", ("人", "人", "土"), table("人", "土"), {"坐": "⿻土⿰人人"}, {})
    assert m.verdict == L.ORDRE_DIFFERENT


def test_different() -> None:
    m = L.mesurer("亲", ("立", "一", "小"), table("立", "一", "小", "木"), {"亲": "⿱立木"}, {})
    assert m.verdict == L.DIFFERENT
    assert m.composants == ("立", "木")


def test_non_reconcilie() -> None:
    m = L.mesurer("会", ("人", "云"), table("人", "云", "一"), {"会": "⿱？⿱一厶"}, {})
    assert m.verdict == L.NON_RECONCILIE


def test_absent() -> None:
    assert L.mesurer("好", ("女", "子"), table("女", "子"), {}, {}).verdict == L.ABSENT


def test_surcharge_passe_devant_le_candidat() -> None:
    """Une surcharge versionnée est notre donnée : elle l'emporte, comme dans `wenlu build`."""
    m = L.mesurer("好", ("女", "子"), table("女", "子"), {"好": "⿰子女"}, {"好": "⿰女子"})
    assert m.verdict == L.IDENTIQUE


def test_meme_tete_compare_l_operateur_de_tete() -> None:
    """Les devinettes lisent l'opérateur de tête : il est comparé à la structure exportée."""
    t = table("女", "子")
    assert L.mesurer("好", ("女", "子"), t, {"好": "⿰女子"}, {}, "⿰女子").meme_tete
    assert not L.mesurer("好", ("女", "子"), t, {"好": "⿻女子"}, {}, "⿰女子").meme_tete


def test_enchainer_premier_d_abord_second_en_repli() -> None:
    """Le second ne sert que là où le premier ne dit rien d'exploitable."""
    ids = L.enchainer({"好": "⿰女子", "会": "⿱？云", "明": "明"}, {"会": "⿱人云", "明": "⿰日月", "林": "⿰木木"})
    assert ids == {"好": "⿰女子", "会": "⿱人云", "明": "⿰日月", "林": "⿰木木"}


def test_source_vide_n_est_pas_mesuree() -> None:
    """Unihan sans `kIDS` ne compte pas les seules surcharges : `propres` le fait."""
    candidats = {
        L.UNIHAN_KIDS: L.SourceLue({}, (("Unihan.zip", "x"),)),
        L.CJK_DECOMP: L.SourceLue({"好": "⿰女子"}, (("ids-secondaires.json", "y"),)),
    }
    jeux = L.jeux_mesures(candidats, {})
    assert L.UNIHAN_KIDS not in jeux
    assert jeux[L.PROPRES] == {}
    assert L.PROPOSEE not in jeux  # BabelStone absent : pas de chaîne


def test_chaine_proposee_cjk_decomp_devant_babelstone() -> None:
    candidats = {
        L.CJK_DECOMP: L.SourceLue({"好": "⿰女子", "会": "？"}, (("a", "1"),)),
        L.BABELSTONE: L.SourceLue({"好": "⿰子女", "会": "⿱人云"}, (("b", "2"),)),
    }
    jeux = L.jeux_mesures(candidats, {})
    assert jeux[L.PROPOSEE] == {"好": "⿰女子", "会": "⿱人云"}
    assert jeux[L.ALTERNATIVE] == {"好": "⿰子女", "会": "⿱人云"}


# ------------------------------------------------------------------- inventaire


def _ligne(c: str, parts: tuple[str, ...], sources: tuple[str, ...], verdict: str | None = None) -> L.Ligne:
    mesures = {L.PROPOSEE: L.Mesure(verdict)} if verdict else {}
    return L.Ligne(c, "caractere", parts, sources, c, (), mesures)


def test_decision_par_caractere() -> None:
    """Rien pour une brique ; rien pour une décomposition déjà hors LGPL ; sinon le verdict."""
    assert L.decision(_ligne("口", (), ())) == "rien à remplacer"
    assert L.decision(_ligne("介", ("人", "八"), ("surcharge",))) == "inchangée (hors LGPL)"
    assert L.decision(_ligne("好", ("女", "子"), ("makemeahanzi",), L.IDENTIQUE)) == "remplacer, identique"
    assert L.decision(_ligne("会", ("人", "云"), ("makemeahanzi",), L.ABSENT)) == "surcharge à écrire"


def test_regime_de_licence() -> None:
    assert _ligne("口", (), ()).regime == "GF 0014-2009 seule"
    assert _ligne("好", ("女", "子"), ("makemeahanzi", "surcharge")).regime == "LGPL (Make Me a Hanzi)"
    assert _ligne("北", ("匕", "匕"), ("cjk-decomp",)).regime.startswith("permissive")


def _export(dossier: Path, fiches: list[dict[str, object]]) -> Path:
    version = dossier / "0.1.0"
    (version / "familles").mkdir(parents=True)
    (version / "familles" / "女.json").write_text(
        json.dumps({"racine": {"c": "女"}, "fiches": fiches}, ensure_ascii=False), encoding="utf-8"
    )
    return version


def test_export_lu_fiche_par_fiche(tmp_path: Path) -> None:
    version = _export(
        tmp_path,
        [{"c": "女", "parts": [], "sources": []}, {"c": "好", "parts": ["女", "子"], "sources": ["makemeahanzi"]}],
    )
    exportes = L.lire_export(version)
    assert exportes["好"].parts == ("女", "子") and exportes["好"].racine == "女"
    assert exportes["女"].parts == ()
    assert L.derniere_version(tmp_path) == version


def test_controle_signale_les_decompositions_lgpl(tmp_path: Path) -> None:
    """Signalé, jamais bloquant : la décision revient au propriétaire."""
    _export(tmp_path, [{"c": "好", "parts": ["女", "子"], "sources": ["makemeahanzi"]}])
    (controle,) = L.controles(tmp_path)
    assert not controle.ok and not controle.bloquant
    assert "1 décompositions sur 1" in controle.detail


def test_controle_passe_sans_make_me_a_hanzi(tmp_path: Path) -> None:
    _export(tmp_path, [{"c": "好", "parts": ["女", "子"], "sources": ["cjk-decomp"]}])
    assert L.controles(tmp_path)[0].ok
    assert L.controles(tmp_path / "rien")[0].ok


def test_rendu_deterministe() -> None:
    """Deux rendus des mêmes entrées écrivent les mêmes octets, sans date d'horloge."""
    lignes = [
        _ligne("口", (), ()),
        L.Ligne("好", "caractere", ("女", "子"), ("makemeahanzi",), "⿰女子", ("seuil-255",),
                {L.PROPOSEE: L.Mesure(L.IDENTIQUE, ("女", "子"), "⿰女子", True)}),
    ]
    candidats = {L.CJK_DECOMP: L.SourceLue({"好": "⿰女子"}, (("ids-secondaires.json", "0" * 64),))}
    un = L.rendre(lignes, candidats, [], "0.1.0")
    assert un == L.rendre(lignes, candidats, [], "0.1.0")
    assert "| 好 | seuil-255 | 女 子 | makemeahanzi |" in un
    assert "remplacer, identique : 1" in un


# -------------------------------------------------------------------- simulation


def test_comparer_parcours() -> None:
    a = {"jours": [{"jour": 1, "brique": "女", "composes": []}, {"jour": 2, "brique": "子", "composes": ["好"]}]}
    b = {"jours": [{"jour": 1, "brique": "女", "composes": []}, {"jour": 2, "brique": "子", "composes": []},
                   {"jour": 3, "brique": None, "composes": ["好"]}]}
    assert L.comparer_parcours("lire", a, a).identique
    impact = L.comparer_parcours("lire", a, b)
    assert impact.premier_ecart == 2
    assert impact.deplaces == ("好",)


def _build(tmp_path: Path, t: TableGF0014, ids: dict[str, str], monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    from wenlu_data import graphe

    monkeypatch.setattr(graphe, "DEPART", {nom: () for nom in graphe.PARCOURS})
    build, ingest = tmp_path / "build", tmp_path / "ingest"
    build.mkdir()
    ingest.mkdir()
    univers = ["女", "子", "日", "月", "好", "明"]
    (ingest / "graphies.json").write_text(
        json.dumps([{"c": c, "strokes": [], "medians": []} for c in univers], ensure_ascii=False),
        encoding="utf-8",
    )
    (ingest / "listes.json").write_text(
        json.dumps({"seuil-255": ["好", "明"], "hsk-1": ["明"]}, ensure_ascii=False), encoding="utf-8"
    )
    caracteres = [{"c": c, "decomposition": ids.get(c, "")} for c in univers]
    decompositions = reconcilier(caracteres, t)
    (build / "decompositions.json").write_text(
        json.dumps(document_decompositions(decompositions, t), ensure_ascii=False), encoding="utf-8"
    )
    graphe.build(sortie=build, ingest=ingest, depart={nom: () for nom in graphe.PARCOURS})
    return build, ingest


def test_simulation_temoin_redonne_le_build(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Rejouée avec la chaîne du build, la simulation ne change rien : elle ne mesure que la source."""
    t = table("女", "子", "日", "月")
    ids = {"好": "⿰女子", "明": "⿰日月"}
    build, ingest = _build(tmp_path, t, ids, monkeypatch)
    changees, impacts = L.simuler(ids, t, {}, build=build, ingest=ingest, sortie=tmp_path / "sim")
    assert changees == 0
    assert impacts and all(i.identique for i in impacts)


def test_simulation_compte_les_decompositions_changees(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    t = table("女", "子", "日", "月")
    build, ingest = _build(tmp_path, t, {"好": "⿰女子", "明": "⿰日月"}, monkeypatch)
    changees, _ = L.simuler(
        {"好": "⿰女子", "明": "⿰月日"}, t, {}, build=build, ingest=ingest, sortie=tmp_path / "sim"
    )
    assert changees == 1


def test_simulation_rangs_figes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """À rangs figés, l'ordre de fréquence du build d'aujourd'hui est repris tel quel."""
    t = table("女", "子", "日", "月")
    ids = {"好": "⿰女子", "明": "⿰日月"}
    build, ingest = _build(tmp_path, t, ids, monkeypatch)
    _, impacts = L.simuler(ids, t, {}, build=build, ingest=ingest, sortie=tmp_path / "sim", figer_rangs=True)
    assert all(i.identique for i in impacts)


def test_surcharges_de_relecture_pour_la_mesure_seulement() -> None:
    """Seuls les caractères que la chaîne ne conserve pas reçoivent leur structure exportée."""
    lignes = [
        L.Ligne("好", "caractere", ("女", "子"), ("makemeahanzi",), "⿰女子", (), {L.PROPOSEE: L.Mesure(L.IDENTIQUE)}),
        L.Ligne("亲", "caractere", ("立", "一", "小"), ("makemeahanzi",), "⿱立⿻一小", (),
                {L.PROPOSEE: L.Mesure(L.DIFFERENT)}),
    ]
    assert L.surcharges_de_relecture(lignes) == {"亲": "⿱立⿻一小"}
