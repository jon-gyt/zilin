"""Le rôle son : une phonétique qui aide à prononcer aujourd'hui. Un test par règle.

Règle du propriétaire : un composant n'est `son` que si la phonétique qu'il écrit se
lit, en mandarin moderne, sur la même syllabe que le caractère, le ton libre. Les
tests de règle donnent leurs propres données ; le dernier relit les vraies fiches
avec les lectures d'Unihan ingérées, s'il y en a.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from conftest import SURCHARGES_REELLES
from wenlu_data import phonetiques, surcharges
from wenlu_data.fiches import fiches_ecrites, lire_fiche
from wenlu_data.paths import BUILD, INGEST
from wenlu_data.phonetiques import ecarts_son, meme_syllabe, phonetiques as trouver, syllabe
from wenlu_data.surcharges import SurchargeInvalide, parse_phonetiques

LECTURES = {
    "妈": ("mā",),
    "马": ("mǎ",),
    "请": ("qǐng",),
    "青": ("qīng",),
    "说": ("shuō",),
    "兑": ("duì",),
    "有": ("yǒu",),
    "又": ("yòu",),
    "𠂇": ("zuǒ",),
    "很": ("hěn",),
    "艮": ("gěn", "gèn"),
    "呢": ("ne", "ní"),
    "尼": ("ní",),
    "张": ("zhāng",),
    "长": ("zhǎng", "cháng"),
}

DECOMPOSITIONS = {
    "请": {"composants": ["讠", "龶", "月"], "structure": "⿰讠⿱龶月"},
    "青": {"composants": ["龶", "月"], "structure": "⿱龶月"},
    "说": {"composants": ["讠", "丷", "口", "儿"], "structure": "⿰讠⿱丷⿱口儿"},
    "兑": {"composants": ["丷", "口", "儿"], "structure": "⿱丷⿱口儿"},
    "呢": {"composants": ["口", "尸", "匕"], "structure": "⿰口⿸尸匕"},
    "尼": {"composants": ["尸", "匕"], "structure": "⿸尸匕"},
    "有": {"composants": ["𠂇", "月"], "structure": "⿸𠂇月"},
}


# ------------------------------------------------------------------------- le critère


def test_meme_syllabe_le_ton_libre() -> None:
    """妈 mā ← 马 mǎ, 请 qǐng ← 青 qīng, 们 men ← 门 mén : même syllabe, ton libre."""
    assert syllabe("Qǐng") == "qing"
    assert meme_syllabe("mā", ["mǎ"])
    assert meme_syllabe("qǐng", ["qīng"])
    assert meme_syllabe("men", ["mén"])


def test_une_lecture_historique_ne_donne_pas_le_son() -> None:
    """说 ← 兑 duì, 谁 ← 隹 zhuī, 给 ← 合 hé : la lecture moderne s'est écartée."""
    assert not meme_syllabe("shuō", ["duì"])
    assert not meme_syllabe("shéi", ["zhuī"])
    assert not meme_syllabe("gěi", ["hé"])


def test_proche_n_est_pas_pareil() -> None:
    """Rimer (很 ← 艮) ou garder l'initiale (打 ← 丁) ne suffit pas."""
    assert not meme_syllabe("hěn", ["gèn"])
    assert not meme_syllabe("dǎ", ["dīng"])
    assert not meme_syllabe("wèn", ["mén"])


def test_la_lecture_principale_du_caractere_contre_toute_lecture_de_la_phonetique() -> None:
    """呢 se lit ne : sa lecture ní ne compte pas. 长 compte pour zhǎng comme pour cháng."""
    ecarts, _ = ecarts_son(
        [("呢", {"口": "sens", "尸": "son", "匕": "son"}, "⿰口⿸尸匕"),
         ("张", {"弓": "sens", "长": "son"}, "⿰弓长")],
        LECTURES,
        DECOMPOSITIONS,
    )
    assert [e.c for e in ecarts] == ["呢"]


# -------------------------------------------------------------- retrouver la phonétique


def test_la_phonetique_decoupee_par_la_norme_se_retrouve_par_sa_structure() -> None:
    """龶 et 月, tous deux `son` dans 请, écrivent 青 : ⿱龶月 se lit dans ⿰讠⿱龶月."""
    assert trouver("请", ["龶", "月"], "⿰讠⿱龶月", DECOMPOSITIONS) == ("青",)


def test_la_phonetique_de_make_me_a_hanzi_passe_devant() -> None:
    assert trouver("说", ["丷", "口", "儿"], "⿰讠⿱丷⿱口儿", DECOMPOSITIONS, phonetique_mmah="兑")[0] == "兑"
    # Une phonétique qui n'est pas ces composants n'est pas retenue.
    assert "月" not in trouver("有", ["𠂇"], "⿸𠂇月", DECOMPOSITIONS, phonetique_mmah="月")


def test_un_composant_seul_est_sa_propre_phonetique() -> None:
    assert trouver("妈", ["马"], "⿰女马", DECOMPOSITIONS) == ("马",)


def test_la_surcharge_nomme_la_phonetique_reduite() -> None:
    """有 : la main 又 yòu, réduite à 𠂇 zuǒ. Sans la surcharge, l'écart est signalé."""
    fiche = [("有", {"𠂇": "son", "月": "sens"}, "⿸𠂇月")]
    ecarts, _ = ecarts_son(fiche, LECTURES, DECOMPOSITIONS)
    assert [str(e) for e in ecarts] == ["有 yǒu ← 𠂇 zuǒ (𠂇)"]
    ecarts, _ = ecarts_son(fiche, LECTURES, DECOMPOSITIONS, surcharges={"有": "又"})
    assert ecarts == []


def test_une_phonetique_introuvable_est_signalee() -> None:
    ecarts, comptees = ecarts_son([("请", {"讠": "son", "月": "son"}, "⿰讠⿱龶月")], LECTURES, DECOMPOSITIONS)
    assert comptees == 1
    assert str(ecarts[0]) == "请 qǐng : phonétique de 讠月 introuvable"


def test_sans_role_son_rien_a_controler() -> None:
    ecarts, comptees = ecarts_son([("说", {"讠": "sens", "丷": "forme"}, "⿰讠⿱丷⿱口儿")], LECTURES, DECOMPOSITIONS)
    assert (ecarts, comptees) == ([], 0)


# ---------------------------------------------------------------------- la surcharge


def test_phonetiques_tsv_un_caractere_chacun() -> None:
    assert parse_phonetiques(["有\t又\tla main réduite"]) == {"有": "又"}
    with pytest.raises(SurchargeInvalide):
        parse_phonetiques(["有\t有\tlui-même"])
    with pytest.raises(SurchargeInvalide):
        parse_phonetiques(["有\t又\tun", "有\t又\tdeux"])
    with pytest.raises(SurchargeInvalide):
        parse_phonetiques(["有\t又"])


def test_phonetiques_du_depot() -> None:
    table = surcharges.charger_phonetiques(SURCHARGES_REELLES["PHONETIQUES"])
    assert table["有"] == "又"
    assert table["新"] == "辛"


# ------------------------------------------------------------------- le contrôle, réel


def test_controle_non_bloquant(tmp_path: Path) -> None:
    """Le contrôle signale ; il ne bloque jamais `wenlu check`."""
    (tmp_path / "fiches").mkdir()
    for controle in phonetiques.controles(dossier=tmp_path / "fiches"):
        assert not controle.bloquant


def test_les_fiches_du_depot_suivent_la_regle() -> None:
    """Chaque rôle `son` des fiches versionnées se lit sur la syllabe de sa phonétique."""
    if not (INGEST / "unihan.json").exists() or not (BUILD / "decompositions.json").exists():
        pytest.skip("pas d'ingestion ni de build : lancer `uv run wenlu tout`")
    lectures = {
        str(e["c"]): tuple(e.get("lectures") or ())
        for e in json.loads((INGEST / "unihan.json").read_text(encoding="utf-8"))["caracteres"]
    }
    lectures.update(surcharges.charger_pinyin(SURCHARGES_REELLES["PINYIN"]))
    decompositions = {
        str(d["c"]): d
        for d in json.loads((BUILD / "decompositions.json").read_text(encoding="utf-8"))["caracteres"]
    }
    fiches = [lire_fiche(f) for f in fiches_ecrites()]
    ecarts, comptees = ecarts_son(
        ((f.c, f.roles, f.structure) for f in fiches),
        lectures,
        decompositions,
        phonetiques_mmah=phonetiques.charger_phonetiques_mmah(),
        surcharges=surcharges.charger_phonetiques(SURCHARGES_REELLES["PHONETIQUES"]),
    )
    assert comptees > 0
    assert [str(e) for e in ecarts] == []
