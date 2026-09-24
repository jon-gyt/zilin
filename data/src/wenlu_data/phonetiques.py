"""Le rôle `son` d'une fiche : une phonétique qui aide à prononcer aujourd'hui.

Convention (décision du propriétaire, `data/schema.md`, « Le rôle son ») : un
composant n'est étiqueté `son` que s'il aide à prononcer le caractère **en mandarin
moderne**. Critère retenu : la phonétique se lit sur la **même syllabe** que le
caractère, initiale et finale identiques, le ton libre (妈 mā ← 马 mǎ, 请 qǐng ← 青
qīng, 们 men ← 门 mén). Une phonétique seulement historique, qui ne sonne plus pareil
(说 shuō ← 兑 duì, 谁 shéi ← 隹 zhuī, 给 gěi ← 合 hé), et une phonétique qui ne
fait que rimer (很 hěn ← 艮 gèn) ou ne garder que l'initiale (打 dǎ ← 丁 dīng)
passent en `forme` ; l'histoire reste dans le texte d'origine. Le critère est strict
parce que l'app pose la question « quel élément donne le son ? » et la note seule :
la réponse doit s'entendre.

Lectures comparées :

- du caractère, sa lecture **principale** : la première de `kMandarin` (Unihan), ou
  celle de `data/sources/surcharges/pinyin.tsv` qui la corrige (呢 ne, et non ní) ;
- de la phonétique, **l'une quelconque** de ses lectures, mêmes sources (长 zhǎng ou
  cháng).

La phonétique est le caractère que les composants de rôle `son` écrivent, retrouvé
dans cet ordre :

1. une ligne de `data/sources/surcharges/phonetiques.tsv` (又 réduit à 𠂇 dans 有) ;
2. le composant phonétique de Make Me a Hanzi, s'il est ces composants (seul, ou
   décomposé en eux : 青 en 龶 et 月) ;
3. un composant de rôle `son` seul est sa propre phonétique ;
4. un caractère dont la décomposition canonique est exactement ces composants et
   dont la structure se lit dans celle du caractère (⿱龶月 dans ⿰讠⿱龶月 : 青).

Le contrôle est un avertissement de relecture, jamais un rejet : il nomme la fiche,
la phonétique et les deux lectures, ou dit qu'il n'a pas trouvé la phonétique.
"""
from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from .gf0014 import Controle
from .paths import BUILD, INGEST
from .pinyin import sans_ton
from . import surcharges as surcharges_mod

SON = "son"


def syllabe(lecture: str) -> str:
    """`Qǐng` → `qing` : la syllabe sans ton, en minuscules, ce qui se compare."""
    return sans_ton(unicodedata.normalize("NFC", lecture.strip().lower()))


def meme_syllabe(lecture: str, lectures: Iterable[str]) -> bool:
    """Vrai si l'une des `lectures` est la syllabe de `lecture`, au ton près."""
    cible = syllabe(lecture)
    return any(syllabe(x) == cible for x in lectures)


@dataclass(frozen=True)
class Ecart:
    """Un rôle `son` que la lecture moderne ne soutient pas, ou que rien n'explique."""

    c: str
    composants: tuple[str, ...]
    lecture: str
    phonetiques: tuple[tuple[str, tuple[str, ...]], ...]

    def __str__(self) -> str:
        sons = "".join(self.composants)
        if not self.phonetiques:
            return f"{self.c} {self.lecture} : phonétique de {sons} introuvable"
        lues = " ou ".join(
            f"{p} {'/'.join(lectures) or 'sans lecture'}" for p, lectures in self.phonetiques
        )
        return f"{self.c} {self.lecture} ← {lues} ({sons})"


def phonetiques(
    c: str,
    sons: Sequence[str],
    structure: str,
    decompositions: Mapping[str, Mapping[str, object]],
    *,
    phonetique_mmah: str | None = None,
    surcharge: str | None = None,
) -> tuple[str, ...]:
    """Les caractères que les composants `sons` de `c` écrivent, du plus sûr au moins sûr."""
    if surcharge:
        return (surcharge,)
    voulus = set(sons)
    if not voulus:
        return ()

    def composants(x: str) -> set[str]:
        return {str(k) for k in (decompositions.get(x) or {}).get("composants") or ()}

    trouves: list[str] = []
    if phonetique_mmah and (voulus == {phonetique_mmah} or composants(phonetique_mmah) == voulus):
        trouves.append(phonetique_mmah)
    if len(voulus) == 1:
        trouves.append(next(iter(voulus)))
    else:
        for x in sorted(decompositions):
            if x == c or composants(x) != voulus:
                continue
            sous = str((decompositions[x] or {}).get("structure") or "")
            if len(sous) > 1 and sous in structure:
                trouves.append(x)
    return tuple(dict.fromkeys(trouves))


def ecarts_son(
    fiches: Iterable[tuple[str, Mapping[str, str], str]],
    lectures: Mapping[str, Sequence[str]],
    decompositions: Mapping[str, Mapping[str, object]],
    *,
    phonetiques_mmah: Mapping[str, str] | None = None,
    surcharges: Mapping[str, str] | None = None,
) -> tuple[list[Ecart], int]:
    """Les rôles `son` dont la phonétique ne se lit pas sur la syllabe du caractère.

    `fiches` donne, par fiche, le caractère, ses rôles et sa structure. Rend les écarts
    et le nombre de fiches qui portent un rôle `son`.
    """
    phonetiques_mmah = phonetiques_mmah or {}
    surcharges = surcharges or {}
    ecarts: list[Ecart] = []
    comptees = 0
    for c, roles, structure in fiches:
        sons = tuple(k for k, v in roles.items() if v == SON)
        if not sons:
            continue
        comptees += 1
        lecture = next(iter(lectures.get(c) or ()), "")
        candidats = phonetiques(
            c,
            sons,
            structure,
            decompositions,
            phonetique_mmah=phonetiques_mmah.get(c),
            surcharge=surcharges.get(c),
        )
        lues = tuple((p, tuple(lectures.get(p) or ())) for p in candidats)
        if lecture and any(meme_syllabe(lecture, l) for _, l in lues):
            continue
        ecarts.append(Ecart(c=c, composants=sons, lecture=lecture or "?", phonetiques=lues))
    return ecarts, comptees


# ------------------------------------------------------------------------ chargement


def charger_lectures(ingest: Path | None = None) -> dict[str, tuple[str, ...]]:
    """Lectures d'Unihan (`kMandarin`), la principale d'abord, corrigées par `pinyin.tsv`."""
    document = json.loads(((ingest or INGEST) / "unihan.json").read_text(encoding="utf-8"))
    lectures: dict[str, tuple[str, ...]] = {
        str(e["c"]): tuple(str(x) for x in (e.get("lectures") or ()))
        for e in document["caracteres"]
        if e.get("lectures")
    }
    lectures.update(surcharges_mod.charger_pinyin())
    return lectures


def charger_phonetiques_mmah(ingest: Path | None = None) -> dict[str, str]:
    """Le composant phonétique que Make Me a Hanzi donne à chaque caractère, s'il en donne un."""
    document = json.loads(((ingest or INGEST) / "caracteres.json").read_text(encoding="utf-8"))
    table: dict[str, str] = {}
    for e in document:
        etymologie = e.get("etymologie")
        if isinstance(etymologie, dict) and etymologie.get("phonetic"):
            table[str(e["c"])] = str(etymologie["phonetic"])
    return table


# ----------------------------------------------------------------------------- check

NOM = "fiches : rôle son"


def controles(
    dossier: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
) -> list[Controle]:
    """« fiches : rôle son », signalé sans bloquer : la relecture tranche."""
    from .fiches import fiches_ecrites, lire_fiche

    fichiers = fiches_ecrites(dossier)
    if not fichiers:
        return [Controle(NOM, True, "aucune fiche écrite")]
    try:
        lectures = charger_lectures(ingest)
        mmah = charger_phonetiques_mmah(ingest)
        document = json.loads(((build or BUILD) / "decompositions.json").read_text(encoding="utf-8"))
    except FileNotFoundError as erreur:
        return [Controle(NOM, False, f"{erreur.filename} absent : rôle son non contrôlé")]
    decompositions = {str(d["c"]): d for d in document["caracteres"]}
    fiches = [lire_fiche(f) for f in fichiers]
    ecarts, comptees = ecarts_son(
        ((f.c, f.roles, f.structure) for f in fiches),
        lectures,
        decompositions,
        phonetiques_mmah=mmah,
        surcharges=surcharges_mod.charger_phonetiques(),
    )
    if not ecarts:
        return [
            Controle(
                NOM,
                True,
                f"{comptees} fiches à rôle son, toutes sur la syllabe de leur phonétique (ton libre)",
            )
        ]
    return [
        Controle(
            NOM,
            False,
            f"{len(ecarts)} rôles son sur {comptees} loin de la lecture moderne, à relire"
            f" (critère : même syllabe, ton libre) — " + " ; ".join(str(e) for e in ecarts),
        )
    ]
