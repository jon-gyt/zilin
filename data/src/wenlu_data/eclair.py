"""Le dictionnaire éclair (story 4b.4) : des mots jamais appris, à deviner.

Un mot de deux caractères acquis, jamais appris comme mot de fiche, dont le sens se
devine depuis ses deux caractères : 火 le feu + 车 le véhicule, le train. Une source
versionnée dans `data/sources/eclair/`, lue par `wenlu export`, qui en tire
`eclair.json` :

- `mots.tsv` : un mot par ligne, son pinyin, son sens en français et en anglais,
  rédigés pour l'app, et une étiquette de proximité facultative.

Séparation des licences (`docs/sources-licences.md` §4.2) : la liste des mots a été
relevée parmi les entrées de CC-CEDICT, dont on ne reprend que le mot lui-même.
Aucune définition de CC-CEDICT n'est lue ici ; le sens est rédigé pour l'app. Le
pinyin est écrit dans la source et `wenlu check` vérifie qu'il se lit syllabe par
syllabe dans les lectures d'Unihan (`kMandarin`) ou des surcharges, au ton plein ou
neutre — jamais celui de CC-CEDICT.

Les trois leurres ne s'écrivent pas à la main : ce sont les sens d'autres mots de la
base, choisis à l'export. D'abord les voisins, qui partagent un caractère avec le mot
(au même rang, puis à l'autre), parce qu'ils sont plausibles : pour 火车, 火山 et
电车 plutôt qu'un sens au hasard. Jamais un mot de même étiquette de proximité
(`proches`) : deux sens trop voisins donneraient deux bonnes réponses.

L'app ne rédige aucun sens : elle lit `eclair.json` et ne propose qu'un mot dont les
deux caractères sont acquis et qui n'est pas un mot de fiche déjà appris.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import typer

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import BUILD, DATA, EXPORT, INGEST

DOSSIER = DATA / "sources" / "eclair"
MOTS = DOSSIER / "mots.tsv"

#: Quatre sens à l'écran : le bon et trois leurres.
LEURRES = 3

#: La taille visée de la base (story 4b.4).
OBJECTIF = (150, 250)

COLONNES = ("mot", "pinyin", "fr", "en", "proches", "source")

SOURCE_EXPORT = (
    "data/sources/eclair/ : mots de deux caractères relevés parmi les entrées de CC-CEDICT"
    " (le mot seul) ; sens français et anglais rédigés pour l'app ; pinyin lu dans Unihan"
    " et les surcharges ; leurres choisis parmi les sens des autres mots"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class MotEclair:
    """Un mot tel que la source le donne, avec sa ligne pour les contrôles."""

    mot: str
    pinyin: str
    fr: str
    en: str
    proches: str = ""
    source: str = ""
    numero: int = 0


def charger(chemin: Path | None = None) -> list[MotEclair]:
    """Les mots de `mots.tsv`, dans l'ordre du fichier."""
    lignes, _ = lire_tsv(chemin or MOTS)
    return [
        MotEclair(
            mot=l.cellules.get("mot", ""),
            pinyin=l.cellules.get("pinyin", ""),
            fr=l.cellules.get("fr", ""),
            en=l.cellules.get("en", ""),
            proches=l.cellules.get("proches", ""),
            source=l.cellules.get("source", ""),
            numero=l.numero,
        )
        for l in lignes
    ]


# ---------------------------------------------------------------------------- leurres


def voisinage(a: str, b: str) -> int:
    """2 : un caractère partagé au même rang (火车, 火山) ; 1 : à l'autre rang ; 0 : aucun."""
    if any(x == y for x, y in zip(a, b)):
        return 2
    return 1 if set(a) & set(b) else 0


def _departage(mot: str, autre: str) -> str:
    """Départage stable des ex aequo : le même contenu donne toujours les mêmes leurres."""
    return hashlib.sha256(f"eclair/{mot}/{autre}".encode("utf-8")).hexdigest()


def compatibles(m: MotEclair, autre: MotEclair) -> bool:
    """`autre` peut servir de leurre à `m` : un autre mot, un autre sens, pas un proche."""
    return (
        autre.mot != m.mot
        and autre.fr != m.fr
        and autre.en != m.en
        and not (m.proches and m.proches == autre.proches)
    )


def leurres(m: MotEclair, mots: Iterable[MotEclair], n: int = LEURRES) -> list[str]:
    """Les `n` leurres de `m`, par mot : les voisins d'abord, puis les autres, dans un ordre fixe."""
    possibles = sorted(
        (x for x in mots if compatibles(m, x)),
        key=lambda x: (-voisinage(m.mot, x.mot), _departage(m.mot, x.mot), x.mot),
    )
    choisis: list[str] = []
    sens: set[str] = set()
    for x in possibles:
        if x.fr in sens or x.mot in choisis:
            continue
        choisis.append(x.mot)
        sens.add(x.fr)
        if len(choisis) >= n:
            break
    return choisis


# ---------------------------------------------------------------------------- export


def document(
    version: str,
    *,
    caracteres: Iterable[str],
    racines: Mapping[str, str],
    en_tete: Mapping[str, object] | None = None,
    source: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `eclair.json`.

    `caracteres` : ce que l'export dessine ; un mot dont un caractère en sortirait
    n'est pas exporté, et `wenlu check` le dit. Les leurres ne se choisissent que
    parmi les mots exportés : l'app trouve le sens de chacun dans le même fichier.
    `racines` donne la famille de chaque caractère, pour trouver ses traits.
    """
    dessinables = set(caracteres)
    retenus = [m for m in charger(source) if len(m.mot) == 2 and set(m.mot) <= dessinables]
    sorties = [
        {
            "id": m.mot,
            "mot": m.mot,
            "pinyin": m.pinyin,
            "fr": m.fr,
            "en": m.en,
            "leurres": leurres(m, retenus),
        }
        for m in retenus
    ]
    dessines = sorted({c for m in retenus for c in m.mot})
    return {
        **(en_tete or {}),
        "mots": sorties,
        "racines": {c: racines[c] for c in dessines if c in racines},
    }


# ------------------------------------------------------------------------- contrôles


def _exclus() -> set[str]:
    from .surcharges import charger_mots_exclus

    return set(charger_mots_exclus())


def fautes_sources(mots: Sequence[MotEclair], exclus: Iterable[str] = ()) -> list[str]:
    """Ce qui cloche dans la source : forme, champs vides, doublons, mot exclu."""
    fautes: list[str] = []
    interdits = set(exclus)
    vus: set[str] = set()
    sens_fr: dict[str, str] = {}
    sens_en: dict[str, str] = {}
    for m in mots:
        ou = f"mots.tsv:{m.numero}"
        if len(m.mot) != 2 or m.mot[0] == m.mot[1]:
            fautes.append(f"{ou} : {m.mot!r} n'est pas un mot de deux caractères distincts")
        if m.mot in vus:
            fautes.append(f"{ou} : {m.mot} en double")
        vus.add(m.mot)
        for champ, valeur in (("pinyin", m.pinyin), ("fr", m.fr), ("en", m.en), ("source", m.source)):
            if not valeur:
                fautes.append(f"{ou} : {m.mot} sans {champ}")
        if " " in m.pinyin.strip():
            fautes.append(f"{ou} : {m.mot} « {m.pinyin} » en deux morceaux, attendu d'un seul tenant")
        if m.mot in interdits:
            fautes.append(f"{ou} : {m.mot} est dans mots-exclus.tsv")
        if m.fr and m.fr in sens_fr:
            fautes.append(f"{ou} : {m.mot} a le sens de {sens_fr[m.fr]} ({m.fr})")
        if m.en and m.en in sens_en:
            fautes.append(f"{ou} : {m.mot} a le sens anglais de {sens_en[m.en]} ({m.en})")
        sens_fr.setdefault(m.fr, m.mot)
        sens_en.setdefault(m.en, m.mot)
    return fautes


def fautes_pinyin(mots: Sequence[MotEclair], lectures: Mapping[str, Sequence[str]]) -> list[str]:
    """Le pinyin de chaque mot se lit dans les lectures des deux caractères, au ton plein ou
    neutre ; un mot de position a le ton de la décision du 26 septembre 2026
    (`pinyin.MOTS_DE_POSITION`)."""
    from .pinyin import aligner, ecarts_de_position

    fautes: list[str] = []
    for m in mots:
        syllabes = aligner(m.mot, m.pinyin, lectures)
        if syllabes is None:
            fautes.append(
                f"{m.mot} : « {m.pinyin} » ne se lit pas dans "
                f"{' / '.join(lectures.get(c) and ' '.join(lectures[c]) or '—' for c in m.mot)}"
            )
        fautes += [f"{m.mot} : « {m.pinyin} », {e}" for e in ecarts_de_position(m.mot, syllabes or [])]
    return fautes


def fautes_leurres(sorties: Sequence[Mapping[str, object]], mots: Sequence[MotEclair]) -> list[str]:
    """Trois leurres distincts, chacun un mot exporté, jamais le mot, jamais un proche ni un même sens."""
    fautes: list[str] = []
    par_mot = {m.mot: m for m in mots}
    exportes = {str(s.get("mot")) for s in sorties}
    for s in sorties:
        mot = str(s.get("mot", ""))
        ls = [str(x) for x in s.get("leurres") or ()]  # type: ignore[union-attr]
        if len(ls) != LEURRES:
            fautes.append(f"{mot} : {len(ls)} leurres pour {LEURRES}")
        if len(set(ls)) != len(ls):
            fautes.append(f"{mot} : leurres en double")
        if mot in ls:
            fautes.append(f"{mot} : le mot est parmi ses leurres")
        m = par_mot.get(mot)
        for x in ls:
            if x not in exportes:
                fautes.append(f"{mot} : le leurre {x} n'est pas un mot exporté")
            autre = par_mot.get(x)
            if m is not None and autre is not None and not compatibles(m, autre):
                fautes.append(f"{mot} : le leurre {x} a un sens trop proche")
    return fautes


def _lectures(ingest: Path, caracteres: Iterable[str]) -> dict[str, list[str]]:
    """Les lectures d'Unihan, surcharges d'abord, pour les caractères demandés."""
    from .surcharges import charger_pinyin

    voulus = set(caracteres)
    chemin = ingest / "unihan.json"
    lus: dict[str, list[str]] = {}
    if chemin.exists():
        for e in json.loads(chemin.read_text(encoding="utf-8"))["caracteres"]:
            if e["c"] in voulus:
                lus[str(e["c"])] = [str(x) for x in (e.get("lectures") or [e.get("pinyin") or ""]) if x]
    for c, lectures in charger_pinyin().items():
        if c in voulus:
            lus[c] = list(dict.fromkeys([*lectures, *lus.get(c, [])]))
    return lus


def _cedict(ingest: Path) -> dict[str, list[str]] | None:
    """Les entrées de CC-CEDICT, par mot : le pinyin seul, jamais la définition."""
    chemin = ingest / "mots.json"
    if not chemin.exists():
        return None
    entrees: dict[str, list[str]] = {}
    for e in json.loads(chemin.read_text(encoding="utf-8")):
        entrees.setdefault(str(e["simplifie"]), []).append(str(e["pinyin"]))
    return entrees


def _mots_de_fiche() -> dict[str, str]:
    """Les mots des fiches versionnées, quel que soit leur statut : `{mot: caractère}`."""
    from . import fiches as fiches_mod

    mots: dict[str, str] = {}
    for chemin in fiches_mod.fiches_ecrites():
        fiche = json.loads(chemin.read_text(encoding="utf-8"))
        for m in fiche.get("mots") or ():
            mots.setdefault(str(m.get("hanzi", "")), str(fiche.get("c", "")))
    return mots


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    source: Path | None = None,
) -> list[Controle]:
    """Contrôles du dictionnaire éclair, pour `wenlu check`.

    Bloquants : « sources » (deux caractères distincts, champs remplis, pas de doublon
    de mot ni de sens, aucun mot de `mots-exclus.tsv`) ; « pinyin » (lu dans Unihan et
    les surcharges) ; « périmètre » (les deux caractères sont dans les listes cibles et
    dans les traits exportés, chaque mot est exporté) ; « leurres » ; « parcours »
    (chaque caractère est posé par un parcours, sans quoi le mot ne serait jamais
    proposé) ; « CC-CEDICT » (chaque mot est une entrée, pas un nom propre).
    Signalé, jamais bloquant : « mots de fiche », les mots qu'une fiche fait déjà lire,
    que l'app ne proposera plus une fois la fiche apprise.
    """
    from .devinettes import _enseignes
    from .export import LISTES_CIBLES, versions_exportees
    from .fetes import traits_exportes

    build = build or BUILD
    ingest = ingest or INGEST
    lus = charger(source)
    _, forme = lire_tsv(source or MOTS)
    f_src = forme + fautes_sources(lus, _exclus())

    caracteres = {c for m in lus for c in m.mot}
    lectures = _lectures(ingest, caracteres)
    f_pin = fautes_pinyin(lus, lectures) if (ingest / "unihan.json").exists() else []

    f_per: list[str] = []
    listes_json = ingest / "listes.json"
    if listes_json.exists():
        listes = json.loads(listes_json.read_text(encoding="utf-8"))
        cibles = {c for nom in LISTES_CIBLES for c in listes.get(nom) or ()}
        f_per += [f"{m.mot} : {' '.join(c for c in m.mot if c not in cibles)} hors des listes cibles" for m in lus if not set(m.mot) <= cibles]

    dossiers = versions_exportees(destination or EXPORT)
    f_leu: list[str] = []
    exportes = 0
    for dossier in dossiers:
        chemin = dossier / "eclair.json"
        if not chemin.exists():
            f_per.append(f"{dossier.name} : eclair.json absent, lancer `wenlu export`")
            continue
        sorties = json.loads(chemin.read_text(encoding="utf-8")).get("mots") or []
        exportes = max(exportes, len(sorties))
        f_leu += [f"{dossier.name}:{f}" for f in fautes_leurres(sorties, lus)]
        manquants = sorted({m.mot for m in lus} - {str(s.get("mot")) for s in sorties})
        if manquants:
            f_per.append(f"{dossier.name} : non exportés {' '.join(manquants)}")
        presents = traits_exportes(dossier)
        f_per += [
            f"{dossier.name}:{s.get('mot')} sans traits pour {c}"
            for s in sorties
            for c in str(s.get("mot", ""))
            if c not in presents
        ]

    enseignes = _enseignes(build)
    f_par = [
        f"{m.mot} : {' '.join(c for c in m.mot if c not in enseignes)} hors parcours"
        for m in lus
        if enseignes and not set(m.mot) <= enseignes
    ]

    cedict = _cedict(ingest)
    f_ced: list[str] = []
    if cedict is not None:
        for m in lus:
            entrees = cedict.get(m.mot)
            if not entrees:
                f_ced.append(f"{m.mot} : absent de CC-CEDICT")
            elif all(any(s[:1].isupper() for s in p.split()) for p in entrees):
                f_ced.append(f"{m.mot} : nom propre dans CC-CEDICT")

    de_fiche = _mots_de_fiche()
    partages = [f"{m.mot} ({de_fiche[m.mot]})" for m in lus if m.mot in de_fiche]

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    bas, haut = OBJECTIF
    return [
        Controle(
            "éclair : sources",
            not f_src,
            detail(f_src, f"{len(lus)} mots (objectif : {bas} à {haut}), sens fr et en rédigés, sourcés, sans doublon"),
            bloquant=True,
        ),
        Controle(
            "éclair : pinyin",
            not f_pin,
            detail(f_pin, "chaque pinyin se lit dans Unihan et les surcharges")
            if (ingest / "unihan.json").exists()
            else "unihan.json absent : lancer `wenlu ingest`",
            bloquant=True,
        ),
        Controle(
            "éclair : périmètre",
            not f_per,
            detail(f_per, f"{exportes} mots exportés, deux caractères des listes cibles, dans les traits")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle(
            "éclair : leurres",
            not f_leu,
            detail(f_leu, "trois leurres distincts par mot, jamais un sens proche"),
            bloquant=True,
        ),
        Controle(
            "éclair : parcours",
            not f_par,
            detail(f_par, "chaque caractère est posé par un parcours"),
            bloquant=True,
        ),
        Controle(
            "éclair : CC-CEDICT",
            not f_ced,
            detail(f_ced, "chaque mot est une entrée de CC-CEDICT (le mot seul)")
            if cedict is not None
            else "mots.json absent : lancer `wenlu ingest`",
            bloquant=True,
        ),
        Controle(
            "éclair : mots de fiche",
            not partages,
            "aucun mot n'est déjà un mot de fiche"
            if not partages
            else f"{len(partages)} mots aussi lus dans une fiche, proposés seulement avant elle : "
            + " ".join(partages[:8]),
        ),
    ]


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="Le dictionnaire éclair : relecture des mots et de leurs leurres.")


@app.command("apercu")
def commande_apercu(version: str = typer.Option("0.1.0", help="Version exportée à relire.")) -> None:
    """Affiche chaque mot exporté, son sens et le sens de ses leurres. Exige `export`."""
    chemin = EXPORT / version / "eclair.json"
    if not chemin.exists():
        typer.echo(f"{chemin} absent : lancer `wenlu export`.", err=True)
        raise typer.Exit(code=1)
    document_export = json.loads(chemin.read_text(encoding="utf-8"))
    sens = {m["mot"]: m["fr"] for m in document_export["mots"]}
    for m in document_export["mots"]:
        typer.echo(
            f"{m['mot']}\t{m['pinyin']}\t{m['fr']}\t"
            + " | ".join(f"{x} {sens.get(x, '?')}" for x in m["leurres"])
        )
    typer.echo(f"{len(document_export['mots'])} mots.")
