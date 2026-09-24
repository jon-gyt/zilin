"""Contrôle du pinyin des mots et des phrases de fiche.

Conventions (harmonisation des fiches du seuil 255) :

- tons du dictionnaire, sans sandhi : 一 s'écrit `yī` et 不 `bù` partout, même
  quand l'oral dit `yí ge` ou `bú yòng` ;
- un mot de deux syllabes s'écrit d'un seul tenant (`bùhǎo`, `nǚ'ér`) ;
- le ton neutre d'un mot est celui de CC-CEDICT (`dōngxi`, `péngyou`, `duōshao`,
  `rènshi`) : le pinyin d'un mot de fiche est celui d'une entrée CC-CEDICT du mot,
  mis en diacritiques.

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


def ecarts_mot(
    hanzi: str,
    pinyin: str,
    entrees: Iterable[str],
) -> list[str]:
    """Écarts d'un mot de fiche : espace, ou pinyin qui n'est celui d'aucune entrée CC-CEDICT."""
    ecarts: list[str] = []
    if " " in pinyin.strip():
        ecarts.append(f"{hanzi} : « {pinyin} » en deux morceaux, attendu d'un seul tenant")
    attendus = sorted({depuis_chiffres(e) for e in entrees})
    if attendus and unicodedata.normalize("NFC", pinyin.replace(" ", "")) not in attendus:
        ecarts.append(f"{hanzi} : « {pinyin} », attendu {' ou '.join(attendus)} (CC-CEDICT)")
    return ecarts
