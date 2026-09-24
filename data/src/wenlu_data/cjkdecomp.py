"""Source d'IDS de repli : cjk-decomp, converti en séquences IDS.

Unihan ne porte aucun champ `kIDS` (vérifié sur Unicode 17.0.0). Les tables IDS
les plus complètes — CHISE et `cjkvi-ids` — sont sous GPL, donc écartées. Reste
`cjk-decomp` (Gavin Grover, fork `amake/cjk-decomp`), distribué au choix sous
six licences dont la MIT : c'est celle que le projet retient.

Format : une ligne `clé:type(constituants)`, la clé étant un caractère ou un
nombre à cinq chiffres désignant une décomposition intermédiaire non codée dans
Unicode. Ces intermédiaires sont développés ici jusqu'à n'avoir que des
caractères, pour rendre une chaîne IDS lisible par `gf0014.analyser_ids`.

Conversion : le jeu de codes de cjk-decomp est plus fin que les douze opérateurs
IDS. Les codes de disposition connus sont traduits fidèlement ; les autres
(`w…` enchâssé, `lock`) le sont par ⿻, qui note un recouvrement sans plus de
précision. Une entrée dont le code ne décrit pas une composition — `c` composant
simple, `m…` variante d'un seul caractère, `refh`/`rot` reflet ou rotation — ne
rend aucun IDS : mieux vaut pas de décomposition qu'une fausse.

Conséquence assumée : les composants (les feuilles) sont fiables, la structure
l'est moins. Les caractères dont l'IDS vient d'ici sont marqués dans
`decompositions.json` (`sources`) et comptés dans `ecarts.md`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

SOURCE = "cjk-decomp"
URL = "https://raw.githubusercontent.com/amake/cjk-decomp/master/cjk-decomp.txt"
LICENCE = "MIT (au choix parmi six licences)"

# `的:a(白,勺)`, `10001:ra(㇑)`, `我:a/m(手,戈)` : le suffixe `/t`, `/m`, `/s` ou
# `/o` ne dit que la façon dont les traits se touchent, il n'entre pas dans l'IDS.
LIGNE = re.compile(r"^(?P<cle>[^:]+):(?P<type>[a-z0-9]+)(?:/[a-z])?\((?P<constituants>.*)\)$")

# Codes de disposition à deux constituants et leur opérateur IDS.
DISPOSITIONS: dict[str, str] = {
    "s": "⿴",  # entoure complètement
    "st": "⿵",  # entoure par le haut
    "sb": "⿶",  # entoure par le bas
    "sl": "⿷",  # entoure par la gauche
    "stl": "⿸",  # entoure en haut à gauche
    "str": "⿹",  # entoure en haut à droite
    "sbl": "⿺",  # entoure en bas à gauche
}

# Codes de répétition à un constituant, développés en IDS.
REPETITIONS: dict[str, str] = {
    "ra": "⿰{0}{0}",
    "rd": "⿱{0}{0}",
    "rrefl": "⿰{0}{0}",
    "rrefr": "⿰{0}{0}",
    "r3a": "⿲{0}{0}{0}",
    "r3d": "⿳{0}{0}{0}",
    "r3tr": "⿱{0}⿰{0}{0}",
    "r4sq": "⿱⿰{0}{0}⿰{0}{0}",
}

RECOUVREMENT = "⿻"


@dataclass(frozen=True)
class Entree:
    """Une ligne de cjk-decomp : un code de disposition et ses constituants."""

    type: str
    constituants: tuple[str, ...]


def parse_ligne(ligne: str) -> tuple[str, Entree] | None:
    """Lit une ligne. None pour une ligne vide ou illisible."""
    ligne = ligne.strip()
    if not ligne:
        return None
    trouve = LIGNE.match(ligne)
    if not trouve:
        return None
    constituants = tuple(c for c in trouve["constituants"].split(",") if c)
    return trouve["cle"], Entree(type=trouve["type"], constituants=constituants)


def lire(lignes: Iterable[str]) -> dict[str, Entree]:
    """Indexe le fichier : clé (caractère ou intermédiaire) -> entrée."""
    entrees: dict[str, Entree] = {}
    for ligne in lignes:
        lue = parse_ligne(ligne)
        if lue is not None:
            entrees[lue[0]] = lue[1]
    return entrees


def charger(chemin: Path) -> dict[str, Entree]:
    return lire(chemin.read_text(encoding="utf-8").splitlines())


def en_ids(cle: str, entrees: Mapping[str, Entree], chemin: tuple[str, ...] = ()) -> str | None:
    """Développe une entrée en chaîne IDS. None si elle n'est pas convertible.

    Un constituant intermédiaire est développé à son tour ; un cycle, un code
    inconnu ou un intermédiaire non convertible font échouer toute l'entrée.
    """
    if cle in chemin:
        return None
    entree = entrees.get(cle)
    if entree is None:
        return cle if len(cle) == 1 else None
    rendus: list[str] = []
    for constituant in entree.constituants:
        if len(constituant) == 1:
            rendus.append(constituant)
            continue
        sous = en_ids(constituant, entrees, chemin + (cle,))
        if sous is None:
            return None
        rendus.append(sous)

    type_, n = entree.type, len(rendus)
    if type_ in ("a", "d") and n >= 2:
        double, triple = ("⿰", "⿲") if type_ == "a" else ("⿱", "⿳")
        if n == 3:
            return triple + "".join(rendus)
        empile = rendus[0]
        for rendu in rendus[1:]:
            empile = double + empile + rendu
        return empile
    if type_ in DISPOSITIONS and n == 2:
        return DISPOSITIONS[type_] + rendus[0] + rendus[1]
    if (type_.startswith("w") or type_ == "lock") and n == 2:
        return RECOUVREMENT + rendus[0] + rendus[1]
    if type_ in REPETITIONS and n == 1:
        return REPETITIONS[type_].format(rendus[0])
    # `m…` n'est une équivalence qu'entre intermédiaires : un caractère codé
    # n'est pas « décomposé » en un seul autre caractère.
    if type_.startswith("m") and n == 1 and chemin:
        return rendus[0]
    return None


def ids_par_caractere(entrees: Mapping[str, Entree]) -> dict[str, str]:
    """IDS de chaque entrée dont la clé est un caractère unique et convertible."""
    resultat: dict[str, str] = {}
    for cle in entrees:
        if len(cle) != 1:
            continue
        ids = en_ids(cle, entrees)
        if ids and ids != cle:
            resultat[cle] = ids
    return resultat


def document(ids: Mapping[str, str]) -> dict[str, object]:
    """Contenu de `ids-secondaires.json` (voir `data/schema.md`)."""
    return {
        "source": SOURCE,
        "licence": LICENCE,
        "url": URL,
        "usage": "IDS de repli quand Make Me a Hanzi donne ？ ou rien",
        "ids": dict(sorted(ids.items())),
    }
