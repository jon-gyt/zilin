"""Contrôle du pinyin des mots et des phrases de fiche.

Conventions (harmonisation des fiches du seuil 255) :

- tons du dictionnaire, sans sandhi : 一 s'écrit `yī` et 不 `bù` partout, même
  quand l'oral dit `yí ge` ou `bú yòng` ;
- un mot de deux syllabes s'écrit d'un seul tenant (`bùhǎo`, `nǚ'ér`) ;
- le ton neutre d'un mot est celui de CC-CEDICT (`dōngxi`, `péngyou`, `duōshao`,
  `rènshi`) : le pinyin d'un mot de fiche est celui d'une entrée CC-CEDICT du mot,
  mis en diacritiques ;
- sauf les mots de position, qui suivent le 现代汉语词典 (décision du propriétaire du
  26 septembre 2026) : ton neutre sur la seconde syllabe pour 后面, 前面, 里面, 外面,
  上面, 下面, 后边, 前边, 里边, 外边, 上边, 下边, 这里, 那里, 哪里 (`hòumian`,
  `zhèli`), ton plein pour 旁边, 那边, 这边 (`pángbiān`, `nàbiān`), quoi que dise
  CC-CEDICT (`MOTS_DE_POSITION`, contrôlé par `ecarts_de_position` dans les contes, les
  lettres, WeChat et l'éclair).

Pour la phrase, chaque caractère doit se lire par l'une de ses lectures (la
surcharge de `data/sources/surcharges/pinyin.tsv`, sinon Make Me a Hanzi), au ton
plein ou au ton neutre ; 儿 se lit aussi `r` (érhua). Rien n'est tiré ici des
définitions de CC-CEDICT : seul le pinyin d'un mot est comparé
(docs/sources-licences.md §4.2).
"""
from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from typing import Iterable, Mapping, Sequence

#: Voyelles portant le ton, par ton (1 à 4).
_TONS = {
    "a": "āáǎà",
    "e": "ēéěè",
    "i": "īíǐì",
    "o": "ōóǒò",
    "u": "ūúǔù",
    "ü": "ǖǘǚǜ",
}
_SANS_TON = {marque: v for v, marques in _TONS.items() for marque in marques}

#: Ce qui n'est pas une lettre de pinyin : ponctuation, espaces, apostrophes, tirets.
_SEPARATEURS = re.compile(r"[^a-zü" + "".join(_SANS_TON) + r"]")

#: Les mots de position et leur pinyin, décision du propriétaire du 26 septembre 2026
#: (« Je te laisse décider » ; retenue : la lecture du 现代汉语词典, celle de l'oral
#: courant). Ton neutre sur la seconde syllabe pour les quinze premiers ; 旁边, 那边 et
#: 这边 gardent le ton plein. La décision ne touche aucun autre mot.
MOTS_DE_POSITION: dict[str, tuple[str, str]] = {
    "后面": ("hòu", "mian"),
    "前面": ("qián", "mian"),
    "里面": ("lǐ", "mian"),
    "外面": ("wài", "mian"),
    "上面": ("shàng", "mian"),
    "下面": ("xià", "mian"),
    "后边": ("hòu", "bian"),
    "前边": ("qián", "bian"),
    "里边": ("lǐ", "bian"),
    "外边": ("wài", "bian"),
    "上边": ("shàng", "bian"),
    "下边": ("xià", "bian"),
    "这里": ("zhè", "li"),
    "那里": ("nà", "li"),
    "哪里": ("nǎ", "li"),
    "旁边": ("páng", "biān"),
    "那边": ("nà", "biān"),
    "这边": ("zhè", "biān"),
}

#: 面 suivi de l'un d'eux n'est pas la fin d'un mot de position : 下面条, « mettre les
#: nouilles », 上面包 ; le contrôle ne le lit pas.
_SUITES_DE_MIAN = frozenset("条包粉")


def sans_ton(syllabe: str) -> str:
    """`zhōng` → `zhong` : la syllabe au ton neutre."""
    return "".join(_SANS_TON.get(c, c) for c in unicodedata.normalize("NFC", syllabe))


def normaliser(texte: str) -> str:
    """Minuscules, NFC, sans espace, apostrophe ni ponctuation : ce qui se compare."""
    return _SEPARATEURS.sub("", unicodedata.normalize("NFC", texte).lower())


def _marquer(syllabe: str, ton: int) -> str:
    """Pose le ton `ton` (1 à 4) sur la bonne voyelle ; 5 ou 0 : ton neutre."""
    if ton not in (1, 2, 3, 4):
        return syllabe
    for voyelle in ("a", "e"):
        if voyelle in syllabe:
            return syllabe.replace(voyelle, _TONS[voyelle][ton - 1], 1)
    if "ou" in syllabe:
        return syllabe.replace("o", _TONS["o"][ton - 1], 1)
    for i in range(len(syllabe) - 1, -1, -1):
        if syllabe[i] in _TONS:
            return syllabe[:i] + _TONS[syllabe[i]][ton - 1] + syllabe[i + 1 :]
    return syllabe


def depuis_chiffres(pinyin: str) -> str:
    """Pinyin numéroté de CC-CEDICT (`peng2 you5`, `nu:3 er2`) → `péngyou`, `nǚ'ér`.

    Les syllabes sont jointes d'un seul tenant, avec l'apostrophe devant une
    syllabe qui commence par a, o ou e.
    """
    sortie: list[str] = []
    for brute in pinyin.lower().split():
        brute = brute.replace("u:", "ü").replace("v", "ü")
        trouve = re.fullmatch(r"([a-zü]+)([0-5]?)", brute)
        if not trouve:
            sortie.append(brute)
            continue
        syllabe, ton = trouve.group(1), int(trouve.group(2) or 5)
        marquee = _marquer(syllabe, ton)
        if sortie and syllabe[0] in "aoe":
            marquee = "'" + marquee
        sortie.append(marquee)
    return "".join(sortie)


def lectures_admises(c: str, lectures: Sequence[str]) -> tuple[str, ...]:
    """Les formes d'un caractère dans un pinyin : ses lectures, au ton plein ou neutre."""
    formes = {unicodedata.normalize("NFC", r) for r in lectures} | {sans_ton(r) for r in lectures}
    if c == "儿":
        formes.add("r")
    # Les plus longues d'abord : `zhuang` avant `zhu`.
    return tuple(sorted(formes, key=lambda f: (-len(f), f)))


def aligner(zh: str, pinyin: str, lectures: Mapping[str, Sequence[str]]) -> list[str] | None:
    """Lit `pinyin` caractère par caractère de `zh`. `None` si un caractère n'y est pas lu.

    Les signes qui ne sont pas des sinogrammes (ponctuation) sont sautés. Un
    caractère sans lecture connue refuse l'alignement : on ne devine pas.
    """
    signes = [c for c in zh if "㐀" <= c <= "鿿" or "\U00020000" <= c <= "\U0002ffff"]
    cible = normaliser(pinyin)

    @lru_cache(maxsize=None)
    def depuis(i: int, j: int) -> tuple[str, ...] | None:
        if i == len(signes):
            return () if j == len(cible) else None
        for forme in lectures_admises(signes[i], tuple(lectures.get(signes[i], ()))):
            if cible.startswith(forme, j):
                suite = depuis(i + 1, j + len(forme))
                if suite is not None:
                    return (forme,) + suite
        return None

    resultat = depuis(0, 0)
    return list(resultat) if resultat is not None else None


def mots_de_position(zh: str) -> list[tuple[int, str]]:
    """Les mots de position de `zh` : `(rang du premier sinogramme, mot)`, le rang compté
    parmi les sinogrammes seuls, comme les syllabes d'un pinyin. Dans 这里面, 那里面,
    哪里面 (et 里边), le mot est 里面 : 那 里面, « là-dedans ». 下面条 n'en a pas."""
    rangs = {i: n for n, i in enumerate(i for i, c in enumerate(zh) if _est_sinogramme(c))}
    trouves: list[tuple[int, str]] = []
    i = 0
    while i < len(zh) - 1:
        mot = zh[i : i + 2]
        if mot in ("这里", "那里", "哪里") and zh[i + 2 : i + 3] in ("面", "边"):
            i += 1
            continue
        if mot in MOTS_DE_POSITION and not (mot[1] == "面" and zh[i + 2 : i + 3] in _SUITES_DE_MIAN):
            trouves.append((rangs[i], mot))
            i += 2
            continue
        i += 1
    return trouves


def ecarts_de_position(zh: str, syllabes: Sequence[str]) -> list[str]:
    """Les mots de position de `zh` dont la seconde syllabe n'a pas le ton de
    `MOTS_DE_POSITION`. `syllabes` : une par sinogramme de `zh`, dans l'ordre (le pinyin
    espacé d'un conte, ou ce que rend `aligner`). Une syllabe d'une autre lecture n'est
    pas relevée : ce n'est pas le mot."""
    ecarts: list[str] = []
    for rang, mot in mots_de_position(zh):
        lues = [unicodedata.normalize("NFC", s).lower() for s in syllabes[rang : rang + 2]]
        attendu = MOTS_DE_POSITION[mot]
        if len(lues) != 2 or sans_ton(lues[1]) != sans_ton(attendu[1]):
            continue
        if lues[1] != attendu[1]:
            ecarts.append(f"{mot} {' '.join(lues)}, attendu {' '.join(attendu)}")
    return ecarts


def _est_sinogramme(c: str) -> bool:
    return "㐀" <= c <= "鿿" or "\U00020000" <= c <= "\U0002ffff"


def ecarts_mot(
    hanzi: str,
    pinyin: str,
    entrees: Iterable[str],
) -> list[str]:
    """Écarts d'un mot de fiche : espace, ou pinyin qui n'est celui d'aucune entrée CC-CEDICT.
    Un mot de position suit `MOTS_DE_POSITION`, pas CC-CEDICT."""
    ecarts: list[str] = []
    if " " in pinyin.strip():
        ecarts.append(f"{hanzi} : « {pinyin} » en deux morceaux, attendu d'un seul tenant")
    if hanzi in MOTS_DE_POSITION:
        attendu = "".join(MOTS_DE_POSITION[hanzi])
        if unicodedata.normalize("NFC", pinyin.replace(" ", "")) != attendu:
            ecarts.append(f"{hanzi} : « {pinyin} », attendu {attendu} (mot de position)")
        return ecarts
    attendus = sorted({depuis_chiffres(e) for e in entrees})
    if attendus and unicodedata.normalize("NFC", pinyin.replace(" ", "")) not in attendus:
        ecarts.append(f"{hanzi} : « {pinyin} », attendu {' ou '.join(attendus)} (CC-CEDICT)")
    return ecarts
