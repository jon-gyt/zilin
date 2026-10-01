"""Pinyin des mots et des phrases de fiche : conventions et contrôle des brouillons.

Conventions : tons du dictionnaire, sans sandhi (`yī`, `bù`) ; mot de deux syllabes
d'un seul tenant (`bùhǎo`) ; pinyin d'un mot de la liste HSK 3.0 celui de la liste
(`kǒudai`, `chūxiě`), CC-CEDICT hors de la liste (`dōngxi`, `péngyou`), avec le ton
neutre du 现代汉语词典 pour un complément directionnel ou un localisateur final
(`shāolai`) ; décisions du propriétaire du 1er octobre 2026 (`data/schema.md`). Le
dernier test relit tous les brouillons du dépôt contre le corpus construit ; sans
`wenlu build`, il est sauté.
"""
from __future__ import annotations

import json
import re
import unicodedata
from typing import Iterable, Sequence

import pytest

from conftest import SURCHARGES_REELLES
from wenlu_data import mots_hsk, pinyin, surcharges
from wenlu_data.fiches import BROUILLONS, CorpusAbsent, brouillons_ecrits, charger_corpus, lire_brouillon
from wenlu_data.paths import INGEST

#: Compléments directionnels composés : après un verbe, leurs deux syllabes au ton neutre
#: (拿出来 ná chu lai) ; 过来 et 过去 gardent guò (走过去 zǒu guòqu).
COMPOSES = ("起来", "出来", "进来", "回来", "上来", "下来", "开来", "出去", "进去", "回去", "上去", "下去")

#: Mots de fiche que la liste HSK 3.0 porte dans un autre sens, d'une autre lecture : la
#: lecture de la fiche reste celle de CC-CEDICT. 一晃 « en un éclair » se lit yīhuǎng ; le
#: 一晃 de la liste (L7-4885, verbe) est yīhuàng, « secouer une fois ».
AUTRE_SENS_QUE_LA_LISTE = frozenset({"一晃"})


def _neutre(syllabe: str) -> str:
    return re.sub(r"[0-5]$", "", syllabe) + "5"


def lectures_du_xiandai(hanzi: str, entree: str) -> list[str]:
    """Une entrée numérotée de CC-CEDICT, et ses lectures au ton neutre du 现代汉语词典 :
    来, 去, 过, 上 ou 里 final (捎来 shāolai, 去过, 桌上), et les deux syllabes d'un
    complément composé final (拿出来 náchulai)."""
    syllabes = entree.split()
    lectures = [entree]
    if len(syllabes) != len(hanzi) or len(hanzi) < 2:
        return lectures
    if hanzi[-1] in "来去过上里":
        lectures.append(" ".join([*syllabes[:-1], _neutre(syllabes[-1])]))
    if len(hanzi) >= 3 and hanzi[-2:] in COMPOSES:
        lectures.append(" ".join([*syllabes[:-2], *map(_neutre, syllabes[-2:])]))
    return lectures


def _cle(texte: str) -> str:
    return unicodedata.normalize("NFC", texte).replace(" ", "").replace("'", "").lower()


def ecarts_mot_de_fiche(hanzi: str, lu: str, entrees: Iterable[str], liste: Sequence[str]) -> list[str]:
    """`pinyin.ecarts_mot`, la liste HSK 3.0 en premier : un mot de la liste (`liste`, ses
    pinyin retenus, règle `·` comprise) s'écrit comme elle ; hors de la liste, comme
    CC-CEDICT ou au ton neutre du 现代汉语词典 (`lectures_du_xiandai`). Les mots de
    position suivent toujours `MOTS_DE_POSITION`."""
    if hanzi in pinyin.MOTS_DE_POSITION or not liste or hanzi in AUTRE_SENS_QUE_LA_LISTE:
        return pinyin.ecarts_mot(hanzi, lu, [v for e in entrees for v in lectures_du_xiandai(hanzi, e)])
    ecarts = pinyin.ecarts_mot(hanzi, lu, [])
    if _cle(lu) not in {_cle(p) for p in liste}:
        ecarts.append(f"{hanzi} : « {lu} », attendu {' ou '.join(sorted(set(liste)))} (liste HSK 3.0)")
    return ecarts


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


def test_mot_de_la_liste_hsk_suit_la_liste_pas_cc_cedict() -> None:
    """Décision du propriétaire du 1er octobre 2026 : la liste HSK 3.0 prime (口袋 kǒudai,
    出血 chūxiě) ; ses mots écrits en deux morceaux (家里 jiā li) s'écrivent d'un tenant."""
    assert ecarts_mot_de_fiche("口袋", "kǒudai", ["kou3 dai4"], ["kǒudai"]) == []
    assert ecarts_mot_de_fiche("口袋", "kǒudài", ["kou3 dai4"], ["kǒudai"]) == [
        "口袋 : « kǒudài », attendu kǒudai (liste HSK 3.0)"
    ]
    assert ecarts_mot_de_fiche("出血", "chūxiě", ["chu1 xue4"], ["chūxiě"]) == []
    assert ecarts_mot_de_fiche("家里", "jiāli", ["jia1 li3"], ["jiā li"]) == []
    assert ecarts_mot_de_fiche("家里", "jiā li", ["jia1 li3"], ["jiā li"])[0].endswith("attendu d'un seul tenant")
    # Deux entrées de la liste, deux sens : l'une ou l'autre.
    assert ecarts_mot_de_fiche("过去", "guòqù", ["guo4 qu4"], ["guòqu", "guòqù"]) == []
    # Hors de la liste : CC-CEDICT ; un mot de position suit toujours la décision.
    assert ecarts_mot_de_fiche("丈人", "zhàngrén", ["zhang4 ren2"], []) == []
    assert ecarts_mot_de_fiche("这里", "zhèli", ["zhe4 li3"], ["zhèli"]) == []


def test_hors_liste_le_ton_neutre_du_xiandai_est_admis() -> None:
    """Complément directionnel ou localisateur final au ton neutre : 捎来 shāolai, 拿出来
    náchulai ; la lecture pleine de CC-CEDICT reste admise (掠过 lüèguò, 世上 shìshàng)."""
    assert ecarts_mot_de_fiche("捎来", "shāolai", ["shao1 lai2"], []) == []
    assert ecarts_mot_de_fiche("捎来", "shāolái", ["shao1 lai2"], []) == []
    assert ecarts_mot_de_fiche("拿出来", "náchulai", ["na2 chu1 lai2"], []) == []
    assert ecarts_mot_de_fiche("掠过", "lüèguò", ["lu:e4 guo4"], []) == []
    assert ecarts_mot_de_fiche("丈人", "zhàngren", ["zhang4 ren2"], []) != []


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
    liste: dict[str, list[str]] = {}
    for mot in mots_hsk.charger(mots_hsk.LISTE_REELLE):
        for forme in mot.formes:
            liste.setdefault(forme.hanzi, []).append(forme.pinyin)

    fautes: list[str] = []
    for chemin in brouillons_ecrits(BROUILLONS):
        b = lire_brouillon(chemin)
        for m in b.mots:
            fautes += ecarts_mot_de_fiche(m.hanzi, m.pinyin, entrees.get(m.hanzi, []), liste.get(m.hanzi, []))
            if pinyin.aligner(m.hanzi, m.pinyin, lectures) is None:
                fautes.append(f"{b.c} : mot {m.hanzi} « {m.pinyin} »")
            if m.hanzi in corpus.exclus:
                fautes.append(f"{b.c} : mot exclu {m.hanzi}")
        # Une fiche d'origine, hors chemin, n'a pas de phrase.
        if b.phrase.zh and pinyin.aligner(b.phrase.zh, b.phrase.pinyin, lectures) is None:
            fautes.append(f"{b.c} : phrase « {b.phrase.zh} » lue « {b.phrase.pinyin} »")
    assert fautes == []


def test_le_corpus_des_fiches_ajoute_les_lectures_des_dictionnaires_d_unihan() -> None:
    """kXHC1983 dit toutes les lectures d'un polyphone : elles s'ajoutent, la principale reste en tête."""
    try:
        corpus = charger_corpus()
    except CorpusAbsent:
        pytest.skip("pas de build : lancer `uv run wenlu build`")
    assert corpus.caracteres["调"]["pinyin"][0] == "diào" and "tiáo" in corpus.caracteres["调"]["pinyin"]
    assert "shè" in corpus.caracteres["舍"]["pinyin"]


def test_les_textes_admettent_les_lectures_des_dictionnaires_d_unihan() -> None:
    """Examens, lettres, cuisine : 便宜 et 夺冠 se lisent (便 pián, 冠 guàn, kXHC1983)."""
    from wenlu_data.cuisine import lectures

    lues = lectures()
    if lues is None:
        pytest.skip("pas d'ingestion : lancer `uv run wenlu ingest`")
    assert "pián" in lues["便"] and "guàn" in lues["冠"] and "dāi" in lues["待"]
