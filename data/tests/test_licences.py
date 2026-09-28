"""Licence des décompositions (`wenlu licences`, contrôle de `wenlu check`) : un test par règle.

Aucun accès réseau ; chaque test donne sa petite table de la norme en dur.
"""
from __future__ import annotations

import json
from pathlib import Path

from wenlu_data import licences as L
from wenlu_data.gf0014 import Composant, TableGF0014


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


# ------------------------------------------------------------------------ mesure


def test_identique() -> None:
    assert L.mesurer("好", ("女", "子"), table("女", "子"), {"好": "⿰女子"}, {}).verdict == L.IDENTIQUE


def test_equivalent_a_la_notation_pres() -> None:
    """⺮ et 𥫗 sont le même composant 502 de la norme."""
    t = table("𥫗", "毛", equivalences={"⺮": "𥫗"})
    m = L.mesurer("笔", ("⺮", "毛"), t, {"笔": "⿱𥫗毛"}, {})
    assert m.verdict == L.EQUIVALENT
    assert L.EQUIVALENT in L.CONSERVES


def test_variante_du_meme_groupe() -> None:
    """王 et 𤣩 du même groupe : la place est la même, la variante non."""
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


def test_non_reconcilie_mais_identique_a_l_export() -> None:
    """兴 reste non réconcilié (⺍ hors norme) : la chaîne le rend tel que l'export le montre."""
    m = L.mesurer("兴", ("⺍", "一", "八"), table("一", "八"), {}, {"兴": "⿳⺍一八"})
    assert m.verdict == L.IDENTIQUE


def test_absent() -> None:
    assert L.mesurer("好", ("女", "子"), table("女", "子"), {}, {}).verdict == L.ABSENT


def test_surcharge_passe_devant_cjk_decomp() -> None:
    """Une surcharge versionnée est notre donnée : elle l'emporte, comme dans `wenlu build`."""
    m = L.mesurer("好", ("女", "子"), table("女", "子"), {"好": "⿰子女"}, {"好": "⿰女子"})
    assert m.verdict == L.IDENTIQUE


def test_meme_tete_compare_l_operateur_de_tete() -> None:
    """Les devinettes lisent l'opérateur de tête : il est comparé à la structure du build."""
    t = table("女", "子")
    assert L.mesurer("好", ("女", "子"), t, {"好": "⿰女子"}, {}, "⿰女子").meme_tete
    assert not L.mesurer("好", ("女", "子"), t, {"好": "⿻女子"}, {}, "⿰女子").meme_tete


# ------------------------------------------------------------------- inventaire


def _exporte(c: str, parts: tuple[str, ...], sources: tuple[str, ...]) -> L.Exporte:
    return L.Exporte(c, parts[0] if parts else c, parts, sources)


def test_inventaire_recette_et_ligne_superflue() -> None:
    """La chaîne redonne l'export ; sans sa ligne, on voit ce que la surcharge corrige."""
    t = table("女", "子", "立", "一", "小", "十")
    exportes = {
        "好": _exporte("好", ("女", "子"), ("cjk-decomp",)),
        "亲": _exporte("亲", ("立", "一", "小"), ("surcharge",)),
        "妇": _exporte("妇", ("女", "子"), ("surcharge",)),
        "女": _exporte("女", (), ()),
    }
    decompositions = {"好": {"structure": "⿰女子"}, "亲": {"structure": "⿱立⿻一小"}, "妇": {"structure": "⿰女子"}}
    cjk = {"好": "⿰女子", "亲": "⿱立⿱十小", "妇": "⿰女子"}
    surcharges = {"亲": "⿱立⿻一小", "妇": "⿰女子"}
    lignes = {l.c: l for l in L.inventorier(exportes, decompositions, {}, {}, t, cjk, surcharges)}
    assert all(l.conforme for l in lignes.values())
    assert lignes["好"].sans_ligne is None
    assert lignes["亲"].sans_ligne is not None and lignes["亲"].sans_ligne.verdict == L.DIFFERENT
    assert not L.superflue(lignes["亲"])
    assert L.superflue(lignes["妇"]), "cjk-decomp rend déjà la même chose : ligne superflue"
    assert lignes["女"].brique and lignes["女"].chaine is None


def test_regime_de_licence() -> None:
    assert L.Ligne("口", "brique", (), (), "口", ()).regime == "GF 0014-2009 seule"
    assert L.Ligne("好", "caractere", ("女", "子"), ("makemeahanzi",), "", ()).regime == "LGPL (Make Me a Hanzi)"
    assert L.Ligne("北", "caractere", ("匕", "匕"), ("cjk-decomp",), "", ()).regime == "cjk-decomp (MIT)"
    assert L.Ligne("介", "caractere", ("人",), ("surcharge",), "", ()).regime == "nos surcharges"


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
        [{"c": "女", "parts": [], "sources": []}, {"c": "好", "parts": ["女", "子"], "sources": ["cjk-decomp"]}],
    )
    exportes = L.lire_export(version)
    assert exportes["好"].parts == ("女", "子") and exportes["好"].racine == "女"
    assert exportes["女"].parts == ()
    assert L.derniere_version(tmp_path) == version


# ------------------------------------------------------------------------ contrôle


def test_controle_bloque_une_decomposition_de_make_me_a_hanzi(tmp_path: Path) -> None:
    """Règle de licence (§10) : aucune décomposition exportée ne descend `dictionary.txt`."""
    _export(tmp_path, [{"c": "好", "parts": ["女", "子"], "sources": ["makemeahanzi", "cjk-decomp"]}])
    (controle,) = L.controles(tmp_path)
    assert not controle.ok and controle.bloquant
    assert "1 de dictionary.txt" in controle.detail


def test_controle_bloque_une_source_absente_ou_inconnue(tmp_path: Path) -> None:
    """Une décomposition sans source, ou d'une source non permise, ne passe pas non plus."""
    _export(
        tmp_path,
        [
            {"c": "好", "parts": ["女", "子"], "sources": []},
            {"c": "妈", "parts": ["女", "马"], "sources": ["babelstone"]},
        ],
    )
    (controle,) = L.controles(tmp_path)
    assert not controle.ok and controle.bloquant
    assert "source absente ou inconnue : 好妈" in controle.detail


def test_controle_passe_sans_make_me_a_hanzi(tmp_path: Path) -> None:
    _export(
        tmp_path,
        [
            {"c": "好", "parts": ["女", "子"], "sources": ["cjk-decomp"]},
            {"c": "介", "parts": ["人", "⿰丿丨"], "sources": ["surcharge"]},
            {"c": "女", "parts": [], "sources": []},
        ],
    )
    (controle,) = L.controles(tmp_path)
    assert controle.ok and controle.bloquant
    assert "2 décompositions, 0 de dictionary.txt" in controle.detail
    assert L.controles(tmp_path / "rien")[0].ok


def test_l_export_du_depot_ne_doit_rien_a_dictionary_txt() -> None:
    """L'export versionné passe le contrôle : 0 décomposition de Make Me a Hanzi."""
    if L.derniere_version() is None:
        return
    (controle,) = L.controles()
    assert controle.ok, controle.detail


def test_rendu_deterministe() -> None:
    """Deux rendus des mêmes entrées écrivent les mêmes octets, sans date d'horloge."""
    identique = L.Mesure(L.IDENTIQUE, ("女", "子"), "⿰女子", True)
    lignes = [
        L.Ligne("口", "brique", (), (), "口", ()),
        L.Ligne("好", "caractere", ("女", "子"), ("cjk-decomp",), "⿰女子", ("seuil-255",), identique),
    ]
    fichiers = [("ids-secondaires.json (cjk-decomp)", "0" * 64)]
    un = L.rendre(lignes, fichiers, [], "0.1.0")
    assert un == L.rendre(lignes, fichiers, [], "0.1.0")
    assert "Décompositions qui nomment encore `dictionary.txt` (LGPL) : 0." in un
    assert "cjk-decomp (MIT) : 1" in un
