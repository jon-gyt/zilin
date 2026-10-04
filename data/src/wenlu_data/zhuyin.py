"""Le pinyin écrit comme le G2P de Kokoro v1.1 l'écrit : zhuyin et chiffre du ton.

Kokoro (`hexgrad/Kokoro-82M-v1.1-zh`) lit des phonèmes ; son G2P chinois
(`misaki.zh_frontend`, `ZH_MAP`, misaki 0.9.4) écrit une syllabe comme une initiale en zhuyin,
une finale « stricte » de pypinyin (sans y ni w, ü noté v, le i de zi et de zhi noté ii et iii),
puis le ton en chiffre (5 : neutre). Les syllabes d'un mot sont accolées, les mots séparés par
`/`. Passer ces phonèmes à `KPipeline.generate_from_tokens`, plutôt que des caractères, ôte à
Kokoro le choix de la lecture et du sandhi : il dit le ton qu'on lui donne.

Mêmes tables que la recette des tons (`data/sources/tons/voix_kokoro.py`), qui tourne aussi
hors du paquet ; `tests/test_porteurs.py` vérifie que les deux écrivent les mêmes phonèmes.
"""
from __future__ import annotations

import unicodedata

INITIALES = {
    "b": "ㄅ", "p": "ㄆ", "m": "ㄇ", "f": "ㄈ", "d": "ㄉ", "t": "ㄊ", "n": "ㄋ", "l": "ㄌ",
    "g": "ㄍ", "k": "ㄎ", "h": "ㄏ", "j": "ㄐ", "q": "ㄑ", "x": "ㄒ", "zh": "ㄓ", "ch": "ㄔ",
    "sh": "ㄕ", "r": "ㄖ", "z": "ㄗ", "c": "ㄘ", "s": "ㄙ",
}
FINALES = {
    "a": "ㄚ", "o": "ㄛ", "e": "ㄜ", "ie": "ㄝ", "ai": "ㄞ", "ei": "ㄟ", "ao": "ㄠ", "ou": "ㄡ",
    "an": "ㄢ", "en": "ㄣ", "ang": "ㄤ", "eng": "ㄥ", "er": "ㄦ", "i": "ㄧ", "u": "ㄨ", "v": "ㄩ",
    "ii": "ㄭ", "iii": "十", "ve": "月", "ia": "压", "ian": "言", "iang": "阳", "iao": "要",
    "in": "阴", "ing": "应", "iong": "用", "iou": "又", "ong": "中", "ua": "穵", "uai": "外",
    "uan": "万", "uang": "王", "uei": "为", "uen": "文", "ueng": "瓮", "uo": "我", "van": "元",
    "vn": "云",
}
#: Les syllabes sans initiale écrites avec y ou w, et leur finale stricte.
SANS_INITIALE = {
    "yi": "i", "ya": "ia", "yao": "iao", "ye": "ie", "you": "iou", "yan": "ian", "yin": "in",
    "yang": "iang", "ying": "ing", "yong": "iong", "yo": "o", "yu": "v", "yue": "ve", "yuan": "van",
    "yun": "vn", "wu": "u", "wa": "ua", "wo": "uo", "wai": "uai", "wei": "uei", "wan": "uan",
    "wen": "uen", "wang": "uang", "weng": "ueng",
}

#: Les voyelles accentuées et leur ton.
MARQUES = {"āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4}


class PinyinIllisible(ValueError):
    """Une syllabe que le G2P de Kokoro ne saurait pas écrire (m, n, ng, ê…)."""


def numerotee(lecture: str) -> str:
    """`zhǒng` → `zhong3`, `de` → `de5`, `nǚ` → `nv3` : une syllabe, ton en chiffre."""
    s = unicodedata.normalize("NFC", lecture.strip().lower())
    ton, nue = 5, []
    for ch in s:
        for k, t in MARQUES.items():
            if ch in k:
                ton, ch = t, "aeiouü"[k.index(ch)]
        nue.append(ch)
    return "".join(nue).replace("ü", "v") + str(ton)


def decouper(syllabe: str) -> tuple[str, str, int]:
    """`zhong1` → (`zh`, `ong`, 1) ; `yue4` → (``, `ve`, 4) ; `lv3` → (`l`, `v`, 3)."""
    s = syllabe.lower().replace("ü", "v").replace("u:", "v")
    if not s or not s[-1].isdigit() or not 1 <= int(s[-1]) <= 5:
        raise PinyinIllisible(f"{syllabe!r} : ton absent")
    ton, s = int(s[-1]), s[:-1]
    if s in SANS_INITIALE:
        return "", SANS_INITIALE[s], ton
    initiale = next((i for i in ("zh", "ch", "sh") if s.startswith(i)), s[:1])
    if initiale not in INITIALES:
        if s in FINALES:  # a, e, er, ou, an…
            return "", s, ton
        raise PinyinIllisible(f"{syllabe!r} : initiale inconnue")
    finale = s[len(initiale):]
    if initiale in ("j", "q", "x") and finale.startswith("u"):
        finale = "v" + finale[1:]
    finale = {"iu": "iou", "ui": "uei", "un": "uen"}.get(finale, finale)
    if finale == "i" and initiale in ("z", "c", "s"):
        finale = "ii"
    elif finale == "i" and initiale in ("zh", "ch", "sh", "r"):
        finale = "iii"
    if finale not in FINALES:
        raise PinyinIllisible(f"{syllabe!r} : finale {finale!r} inconnue")
    return initiale, finale, ton


def phonemes(syllabe: str) -> str:
    """Les phonèmes Kokoro v1.1 d'une syllabe numérotée : `shi4` → `ㄕ十4`."""
    initiale, finale, ton = decouper(syllabe)
    return INITIALES.get(initiale, "") + FINALES[finale] + str(ton)


def phonemes_mot(syllabes: list[str] | tuple[str, ...]) -> str:
    """Les syllabes d'un mot accolées, comme le G2P écrit un mot (`我们` → `我3ㄇㄣ5`)."""
    return "".join(phonemes(s) for s in syllabes)
