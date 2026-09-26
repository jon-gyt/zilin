"""Pinyin des mots et des phrases de fiche : conventions et contrôle des brouillons.

Conventions : tons du dictionnaire, sans sandhi (`yī`, `bù`) ; mot de deux syllabes
d'un seul tenant (`bùhǎo`) ; ton neutre d'un mot comme CC-CEDICT (`dōngxi`,
`péngyou`, `duōshao`, `rènshi`). Le dernier test relit tous les brouillons du
dépôt contre le corpus construit ; sans `wenlu build`, il est sauté.
"""
from __future__ import annotations

import json

import pytest

from conftest import SURCHARGES_REELLES
from wenlu_data import pinyin, surcharges
from wenlu_data.fiches import BROUILLONS, CorpusAbsent, brouillons_ecrits, charger_corpus, lire_brouillon
from wenlu_data.paths import INGEST


@pytest.mark.parametrize(
    ("numerote", "attendu"),
    [
        ("peng2 you5", "péngyou"),
        ("dong1 xi5", "dōngxi"),
        ("duo1 shao5", "duōshao"),
        ("ren4 shi5", "rènshi"),
        ("nu:3 er2", "nǚ'ér"),
        ("na3 r5", "nǎr"),
        ("yi1 ge5", "yīge"),
        ("xue2 sheng5", "xuésheng"),
        ("gui4 zhong4", "guìzhòng"),
    ],
)
def test_pinyin_numerote_en_diacritiques(numerote: str, attendu: str) -> None:
    assert pinyin.depuis_chiffres(numerote) == attendu


def test_mot_dun_seul_tenant_et_ton_neutre_de_cc_cedict() -> None:
    assert pinyin.ecarts_mot("朋友", "péngyou", ["peng2 you5"]) == []
    assert pinyin.ecarts_mot("不好", "bù hǎo", ["bu4 hao3"])[0].startswith("不好 : « bù hǎo » en deux morceaux")
    assert pinyin.ecarts_mot("东西", "dōngxī", ["dong1 xi5", "dong1 xi1"]) == []
    assert "attendu dōngxi" in pinyin.ecarts_mot("东西", "dōngxī", ["dong1 xi5"])[0]


def test_sans_sandhi_yi_et_bu_gardent_le_ton_du_dictionnaire() -> None:
    lectures = {"一": ["yī"], "个": ["gè"], "不": ["bù"], "用": ["yòng"], "人": ["rén"]}
    assert pinyin.aligner("一个人", "yī ge rén", lectures) == ["yī", "ge", "rén"]
    assert pinyin.aligner("一个人", "yí ge rén", lectures) is None
    assert pinyin.aligner("不用", "búyòng", lectures) is None
    assert pinyin.aligner("不用。", "Bùyòng.", lectures) == ["bù", "yòng"]


def test_erhua_et_ponctuation() -> None:
    lectures = {"哪": ["nǎ"], "儿": ["ér"], "女": ["nǚ"]}
    assert pinyin.aligner("哪儿？", "Nǎr?", lectures) == ["nǎ", "r"]
    assert pinyin.aligner("女儿", "nǚ'ér", lectures) == ["nǚ", "ér"]


def test_mots_de_position_au_ton_neutre_sauf_trois() -> None:
    """Décision du propriétaire du 26 septembre 2026, le 现代汉语词典 : 后面 hòu mian, 这里
    zhè li, mais 旁边 páng biān, 那边 nà biān. Dans 那里面, le mot est 里面."""
    assert pinyin.ecarts_de_position("走在后面。", "zǒu zài hòu mian".split()) == []
    assert pinyin.ecarts_de_position("走在后面。", "zǒu zài hòu miàn".split()) == [
        "后面 hòu miàn, attendu hòu mian"
    ]
    assert pinyin.ecarts_de_position("桥那边", "qiáo nà bian".split()) == ["那边 nà bian, attendu nà biān"]
    assert pinyin.ecarts_de_position("旁边，这里", "páng biān zhè li".split()) == []
    assert pinyin.mots_de_position("那里面有水") == [(1, "里面")]
    assert pinyin.ecarts_de_position("那里面", "nà lǐ mian".split()) == []
    assert pinyin.ecarts_de_position("那里面", "nà lǐ miàn".split()) == ["里面 lǐ miàn, attendu lǐ mian"]
    # Les mots d'orientation aussi, décision du même jour : 东边 dōng bian ; 东北边 aussi.
    assert pinyin.ecarts_de_position("在东边", "zài dōng biān".split()) == ["东边 dōng biān, attendu dōng bian"]
    assert pinyin.ecarts_de_position("东北边，左边", "dōng běi bian zuǒ bian".split()) == []
    # 下面条 : mettre les nouilles, pas un mot de position.
    assert pinyin.mots_de_position("下面条") == []
    # Ce que rend `aligner`, en minuscules, se contrôle de même.
    lectures = {"你": ["nǐ"], "在": ["zài"], "哪": ["nǎ"], "里": ["lǐ"]}
    assert pinyin.ecarts_de_position("你在哪里？", pinyin.aligner("你在哪里？", "Nǐ zài nǎlǐ?", lectures) or []) == [
        "哪里 nǎ lǐ, attendu nǎ li"
    ]
    assert pinyin.ecarts_de_position("你在哪里？", pinyin.aligner("你在哪里？", "Nǐ zài nǎli?", lectures) or []) == []


def test_mot_de_position_de_fiche_suit_la_decision_pas_cc_cedict() -> None:
    assert pinyin.ecarts_mot("这里", "zhèli", ["zhe4 li3"]) == []
    assert pinyin.ecarts_mot("这里", "zhèlǐ", ["zhe4 li3"]) == ["这里 : « zhèlǐ », attendu zhèli (mot de position)"]
    assert pinyin.ecarts_mot("那边", "nàbiān", ["na4 bian5"]) == []
    assert pinyin.ecarts_mot("后面", "hòumian", ["hou4 mian4"]) == []


def test_caractere_sans_lecture_connue_ne_s_aligne_pas() -> None:
    assert pinyin.aligner("龍", "lóng", {}) is None


def test_les_brouillons_du_depot_suivent_les_conventions(monkeypatch: pytest.MonkeyPatch) -> None:
    """Chaque mot et chaque phrase des brouillons se lit par les lectures du caractère."""
    for nom, chemin in SURCHARGES_REELLES.items():
        monkeypatch.setattr(surcharges, nom, chemin)
    try:
        corpus = charger_corpus()
    except CorpusAbsent:
        pytest.skip("pas de build : lancer `uv run wenlu build`")
    entrees: dict[str, list[str]] = {}
    for m in json.loads((INGEST / "mots.json").read_text(encoding="utf-8")):
        entrees.setdefault(m["simplifie"], []).append(m["pinyin"])
    lectures = {c: list(v.get("pinyin") or []) for c, v in corpus.caracteres.items()}

    fautes: list[str] = []
    for chemin in brouillons_ecrits(BROUILLONS):
        b = lire_brouillon(chemin)
        for m in b.mots:
            fautes += pinyin.ecarts_mot(m.hanzi, m.pinyin, entrees.get(m.hanzi, []))
            if pinyin.aligner(m.hanzi, m.pinyin, lectures) is None:
                fautes.append(f"{b.c} : mot {m.hanzi} « {m.pinyin} »")
            if m.hanzi in corpus.exclus:
                fautes.append(f"{b.c} : mot exclu {m.hanzi}")
        if pinyin.aligner(b.phrase.zh, b.phrase.pinyin, lectures) is None:
            fautes.append(f"{b.c} : phrase « {b.phrase.zh} » lue « {b.phrase.pinyin} »")
    assert fautes == []
