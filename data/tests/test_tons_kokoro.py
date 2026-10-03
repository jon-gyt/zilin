"""Ce que Kokoro dit pour le classifieur des tons (`data/sources/tons/kokoro.py`) : les phonèmes
passés à Kokoro et le ton étiqueté, une règle par test. Un petit lexique tient lieu de la liste
HSK et des lectures du dépôt. Les phonèmes attendus ont été relevés sur le G2P de Kokoro v1.1
(`misaki.zh_frontend.ZHFrontend`, misaki 0.9.4) le 3 octobre 2026."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

_ICI = Path(__file__).resolve().parents[1] / "sources" / "tons"
sys.path.insert(0, str(_ICI))


def _charger(nom: str):
    spec = importlib.util.spec_from_file_location(f"{nom}_recette", _ICI / f"{nom}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


kokoro = _charger("kokoro")
fleurs = _charger("fleurs")


def lexique(mots: dict[str, tuple[str, ...]], lectures: dict[str, set[str]], seuls: dict[str, set[str]] | None = None):
    lex = object.__new__(fleurs.Lexique)
    lex.mots = {w: [(s, s)] for w, s in mots.items()}
    lex.seuls = seuls or {}
    lex.courantes = lectures
    lex.depot = lectures
    lex.long = max([len(w) for w in mots] or [2])
    return lex


LECTURES = {
    "水": {"shui3"}, "果": {"guo3"}, "不": {"bu4"}, "是": {"shi4"}, "一": {"yi1"}, "样": {"yang4"},
    "起": {"qi3"}, "天": {"tian1"}, "姐": {"jie3"}, "知": {"zhi1"}, "道": {"dao4"}, "的": {"de5", "di2", "di4"},
    "高": {"gao1"}, "子": {"zi3"}, "桌": {"zhuo1"},
}
MOTS = {
    "水果": ("shui3", "guo3"), "不是": ("bu4", "shi4"), "一样": ("yi1", "yang4"), "一起": ("yi1", "qi3"),
    "姐姐": ("jie3", "jie5"), "知道": ("zhi1", "dao5"), "子的": ("zi5", "de5"), "桌子": ("zhuo1", "zi5"),
}
LEX = lexique(MOTS, LECTURES)


def mot(w: str) -> list[str] | None:
    return kokoro.etiqueter_mot(w, LEX, fleurs)


def test_les_phonemes_sont_ceux_du_g2p_de_kokoro_v1_1() -> None:
    releves = {
        "gao1": "ㄍㄠ1", "shi4": "ㄕ十4", "zi1": "ㄗㄭ1", "ri4": "ㄖ十4", "nv3": "ㄋㄩ3", "lv4": "ㄌㄩ4",
        "yue4": "月4", "yuan2": "元2", "yun2": "云2", "yong4": "用4", "wen4": "文4", "weng1": "瓮1",
        "yu2": "ㄩ2", "qu4": "ㄑㄩ4", "jiong3": "ㄐ用3", "liu4": "ㄌ又4", "dui4": "ㄉ为4", "lun4": "ㄌ文4",
        "er4": "ㄦ4", "an1": "ㄢ1", "wo3": "我3", "bo1": "ㄅㄛ1", "lve4": "ㄌ月4", "zuo4": "ㄗ我4",
        "xue2": "ㄒ月2", "you4": "又4", "wang2": "王2",
    }
    for syllabe, ps in releves.items():
        assert kokoro.phonemes(syllabe) == ps, syllabe


def test_les_syllabes_d_un_mot_sont_accolees_le_neutre_note_5() -> None:
    assert kokoro.phonemes_mot(["wo3", "men5"]) == "我3ㄇㄣ5"
    assert kokoro.phonemes_mot(["xue2", "xi2"]) == "ㄒ月2ㄒㄧ2"


def test_une_syllabe_que_le_g2p_ne_sait_pas_ecrire_est_refusee() -> None:
    for syllabe in ("n2", "m2", "hm5", "ng2", "gao"):
        with pytest.raises(kokoro.PinyinIllisible):
            kokoro.phonemes(syllabe)


def test_deux_tons_3_dans_un_mot_se_disent_et_s_etiquettent_2_3() -> None:
    assert mot("水果") == ["shui2", "guo3"]
    assert kokoro.phonemes_mot(mot("水果")) == "ㄕ为2ㄍ我3"


def test_bu_devant_un_ton_4_se_dit_et_s_etiquette_au_ton_2() -> None:
    assert mot("不是") == ["bu2", "shi4"]


def test_yi_devant_un_ton_4_au_ton_2_devant_un_autre_au_ton_4() -> None:
    assert mot("一样") == ["yi2", "yang4"]
    assert mot("一起") == ["yi4", "qi3"]


def test_le_neutre_de_la_liste_reste_neutre() -> None:
    assert mot("知道") == ["zhi1", "dao5"]
    assert mot("桌子") == ["zhuo1", "zi5"]


def test_un_mot_dont_une_syllabe_reste_sans_etiquette_est_ecarte() -> None:
    assert mot("姐姐") is None  # un ton 3 devant le neutre d'un ton 3


def test_un_mot_qui_commence_par_un_neutre_n_est_pas_dit() -> None:
    doc = kokoro.construire(LEX, [], fleurs)
    assert all(t["tons"][0] != 5 for t in doc["mots"])
    assert "子的" not in {t["texte"] for t in doc["mots"]}


def test_un_caractere_a_plusieurs_lectures_pleines_n_est_pas_dit() -> None:
    assert kokoro.lecture_unique("的", LEX) is None
    assert kokoro.lecture_unique("高", LEX) == "gao1"
    doc = kokoro.construire(LEX, ["高", "的", "高"], fleurs)
    assert [t["texte"] for t in doc["caracteres"]] == ["高"]
    assert doc["caracteres"][0]["ps"] == "ㄍㄠ1"


def test_la_voix_de_l_app_n_entre_jamais_a_l_entrainement() -> None:
    assert kokoro.VOIX_TEST == "zf_001"
    assert kokoro.VOIX_TEST not in kokoro.VOIX_ENTRAINEMENT
    assert kokoro.VOIX_DEFAUT[0] == kokoro.VOIX_TEST
    assert len(kokoro.VOIX_ENTRAINEMENT) >= 20
    assert {v[:2] for v in kokoro.VOIX_ENTRAINEMENT} == {"zf", "zm"}


def test_le_plan_d_une_voix_est_fixe_et_equilibre_les_tons() -> None:
    doc = json.loads(kokoro.TEXTES.read_text(encoding="utf-8"))
    a, b = kokoro.plan(doc, "zf_002"), kokoro.plan(doc, "zf_002")
    assert a == b
    assert kokoro.plan(doc, "zm_009") != a
    car = [t for t in a if t["genre"] == "c"]
    assert sorted({t["tons"][0] for t in car}) == [1, 2, 3, 4]
    assert all(sum(t["tons"][0] == ton for t in car) == kokoro.CARACTERES_PAR_TON for ton in (1, 2, 3, 4))
    assert sum(t["genre"] == "m" for t in a) == kokoro.MOTS_PAR_VOIX
    assert all(t["vitesse"] in kokoro.VITESSES and t["fin"] in kokoro.FINS for t in a)


def test_les_textes_versionnes_disent_le_ton_etiquete() -> None:
    doc = json.loads(kokoro.TEXTES.read_text(encoding="utf-8"))
    for t in doc["caracteres"] + doc["mots"]:
        assert t["tons"] == [int(s[-1]) for s in t["syl"]]
        assert t["ps"] == kokoro.phonemes_mot(t["syl"])
    assert all(t["tons"] != [3, 3] for t in doc["mots"])
    assert all(t["tons"][0] in (1, 2, 3, 4) for t in doc["caracteres"])


def test_les_lots_du_workflow_gardent_chaque_voix_une_fois() -> None:
    lots = kokoro.groupes(kokoro.VOIX_DEFAUT, 5)
    assert len(lots) == 5
    assert sorted(v for lot in lots for v in lot) == sorted(kokoro.VOIX_DEFAUT)
    assert kokoro.VOIX_TEST in lots[0]
