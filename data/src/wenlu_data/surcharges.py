"""Surcharges versionnées des sources téléchargées : pinyin, IDS, mots exclus.

Les sources brutes (`data/work/sources/`) ne se corrigent jamais sur place : elles
sont retéléchargées, et leur empreinte fait foi. Une erreur relevée dans une source
se corrige ici, par une ligne versionnée qui dit ce qu'elle change et pourquoi.
Trois fichiers, tous en TSV, `#` en commentaire, une raison obligatoire par ligne :

- `data/sources/surcharges/pinyin.tsv` : `c`, `lectures`, `raison`. Les lectures
  remplacent celles de Make Me a Hanzi (`caracteres.json`, contexte des fiches) et
  celle d'Unihan (`kMandarin`, pinyin exporté). La première est la lecture
  principale, celle que l'app affiche ; les suivantes, séparées par une espace, sont
  les autres lectures que les mots de la fiche emploient.
- `data/sources/surcharges/ids.tsv` : `c`, `ids`, `raison`. L'IDS remplace celui de
  Make Me a Hanzi et de cjk-decomp avant la réconciliation avec GF 0014-2009 ; la
  décomposition qui en sort porte la source `surcharge`. Un composant de la norme
  écrit en IDS (les 30 sans point de code) s'écrit entre accolades :
  `⿰{⿰𠄌丶}人`. Une ligne peut aussi ramener un point de code de notation (bloc
  des traits, bloc des radicaux) à la forme que la norme donne au même composant :
  `㇔ → 丶`, `⺮ → 𥫗`.
- `data/sources/surcharges/equivalences.tsv` : `forme`, `composant`, `raison`. Un
  point de code de notation que la source emploie, et qui porte ses tracés, est le
  composant que la norme écrit autrement : ⺮ est 𥫗 (竹头). La feuille garde la
  forme de la source et prend le nom de la norme ; rien n'est renommé.
- `data/sources/mots-exclus.tsv` : `mot`, `raison`. Mots de CC-CEDICT qui ne sont
  jamais proposés comme candidats d'une fiche : argot, termes de mahjong, mots
  rares ou spécialisés, fragments de locution.

Un fichier absent vaut une table vide ; un fichier mal formé lève
`SurchargeInvalide`, qui nomme la ligne fautive : une faute de frappe ne passe pas
en silence.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .paths import DATA

SURCHARGES = DATA / "sources" / "surcharges"
PINYIN = SURCHARGES / "pinyin.tsv"
IDS = SURCHARGES / "ids.tsv"
EQUIVALENCES = SURCHARGES / "equivalences.tsv"
MOTS_EXCLUS = DATA / "sources" / "mots-exclus.tsv"

#: La source d'IDS que porte une décomposition tirée de `ids.tsv`.
SOURCE_SURCHARGE = "surcharge"

#: Une syllabe de pinyin : lettres latines minuscules, tons en diacritiques, ü.
SYLLABE = re.compile(r"^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$")


class SurchargeInvalide(ValueError):
    """Une ligne de surcharge ne se lit pas : rien n'est appliqué."""


@dataclass(frozen=True)
class Ligne:
    numero: int
    colonnes: tuple[str, ...]


def _lignes(texte: Iterable[str], colonnes: int, nom: str) -> list[Ligne]:
    """Les lignes utiles d'un TSV : `colonnes` champs non vides, la raison comprise."""
    lues: list[Ligne] = []
    for numero, brute in enumerate(texte, start=1):
        ligne = brute.rstrip("\n")
        if not ligne.strip() or ligne.lstrip().startswith("#"):
            continue
        champs = tuple(c.strip() for c in ligne.split("\t"))
        if len(champs) != colonnes or not all(champs):
            raise SurchargeInvalide(
                f"{nom}, ligne {numero} : {colonnes} colonnes non vides attendues, "
                f"séparées par une tabulation ({ligne!r})"
            )
        lues.append(Ligne(numero, champs))
    return lues


def _lire(chemin: Path) -> list[str]:
    return chemin.read_text(encoding="utf-8").splitlines() if chemin.exists() else []


def lecture_valide(lecture: str) -> bool:
    """Vrai pour une syllabe de pinyin en minuscules, ton en diacritique ou neutre."""
    return bool(SYLLABE.match(unicodedata.normalize("NFC", lecture)))


def parse_pinyin(texte: Iterable[str], nom: str = "pinyin.tsv") -> dict[str, tuple[str, ...]]:
    """`c` → lectures, la principale d'abord. Un caractère n'a qu'une ligne."""
    table: dict[str, tuple[str, ...]] = {}
    for ligne in _lignes(texte, 3, nom):
        c, lectures, _raison = ligne.colonnes
        if len(c) != 1:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {c!r} n'est pas un caractère")
        if c in table:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {c} a déjà une ligne")
        liste = tuple(unicodedata.normalize("NFC", x) for x in lectures.split())
        fautives = [x for x in liste if not lecture_valide(x)]
        if fautives or len(set(liste)) != len(liste):
            raise SurchargeInvalide(
                f"{nom}, ligne {ligne.numero} : lectures illisibles ou répétées pour {c} ({lectures})"
            )
        table[c] = liste
    return table


def parse_ids(texte: Iterable[str], nom: str = "ids.tsv") -> dict[str, str]:
    """`c` → IDS. L'IDS est vérifié par l'analyseur de la réconciliation."""
    from .gf0014 import IdsInvalide, analyser_ids

    table: dict[str, str] = {}
    for ligne in _lignes(texte, 3, nom):
        c, ids, _raison = ligne.colonnes
        if len(c) != 1:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {c!r} n'est pas un caractère")
        if c in table:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {c} a déjà une ligne")
        if ids == c:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {c} se décompose en lui-même")
        try:
            analyser_ids(ids)
        except IdsInvalide as erreur:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {erreur}") from erreur
        table[c] = ids
    return table


def parse_equivalences(texte: Iterable[str], nom: str = "equivalences.tsv") -> dict[str, str]:
    """`forme` de la source → `composant` de la norme, un caractère chacun."""
    table: dict[str, str] = {}
    for ligne in _lignes(texte, 3, nom):
        forme, composant, _raison = ligne.colonnes
        if len(forme) != 1 or len(composant) != 1 or forme == composant:
            raise SurchargeInvalide(
                f"{nom}, ligne {ligne.numero} : deux caractères distincts attendus ({forme}, {composant})"
            )
        if forme in table:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {forme} a déjà une ligne")
        table[forme] = composant
    return table


def parse_mots_exclus(texte: Iterable[str], nom: str = "mots-exclus.tsv") -> dict[str, str]:
    """`mot` → raison de l'exclusion."""
    table: dict[str, str] = {}
    for ligne in _lignes(texte, 2, nom):
        mot, raison = ligne.colonnes
        if mot in table:
            raise SurchargeInvalide(f"{nom}, ligne {ligne.numero} : {mot} a déjà une ligne")
        table[mot] = raison
    return table


def charger_pinyin(chemin: Path | None = None) -> dict[str, tuple[str, ...]]:
    chemin = chemin or PINYIN
    return parse_pinyin(_lire(chemin), chemin.name)


def charger_ids(chemin: Path | None = None) -> dict[str, str]:
    chemin = chemin or IDS
    return parse_ids(_lire(chemin), chemin.name)


def charger_equivalences(chemin: Path | None = None) -> dict[str, str]:
    chemin = chemin or EQUIVALENCES
    return parse_equivalences(_lire(chemin), chemin.name)


def charger_mots_exclus(chemin: Path | None = None) -> dict[str, str]:
    chemin = chemin or MOTS_EXCLUS
    return parse_mots_exclus(_lire(chemin), chemin.name)
