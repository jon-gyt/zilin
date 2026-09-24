"""Les devinettes de lanternes (灯谜, story 4b.5) : sources, leurres, export, contrôles.

Une devinette cache une décomposition : « Le soleil et la lune, côte à côte » donne
明 (日 + 月). Deux sources versionnées dans `data/sources/devinettes/`, lues par
`wenlu export`, qui en tire `devinettes.json` :

- `devinettes.tsv` : une devinette par caractère réponse, rédigée pour l'app —
  l'énoncé français, l'énoncé chinois traditionnel quand il en existe un d'exact,
  les briques citées, leur disposition et le sens de la réponse ;
- `briques.tsv` : le nom de chaque brique citée, que la correction montre.

Les trois leurres ne s'écrivent pas à la main : l'export les choisit par
ressemblance de composants, avec la mesure de l'app (`app/src/lib/questions.ts`,
`ressemblance`) — Jaccard sur les composants, un bonus quand le nombre de
composants est le même, un bonus fort pour une paire à ne pas confondre. Jamais un
caractère qui porterait toutes les briques citées : il serait une seconde réponse.

L'app ne rédige aucune devinette : elle lit `devinettes.json` et choisit celle du
jour parmi celles dont la réponse et les briques sont acquises ou en cours.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import typer

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import BUILD, DATA, EXPORT, INGEST

DOSSIER = DATA / "sources" / "devinettes"
DEVINETTES = DOSSIER / "devinettes.tsv"
BRIQUES = DOSSIER / "briques.tsv"

#: Le nombre de leurres d'une devinette : quatre choix à l'écran.
LEURRES = 3

#: L'objectif de la base (backlog 4b.5).
OBJECTIF = 100

#: Les mêmes bonus que `questions.ts` : la ressemblance se mesure pareil des deux côtés.
BONUS_MEME_NOMBRE = 0.25
BONUS_PAIRE = 2.0

COLONNES = ("c", "disposition", "briques", "enonce_fr", "enonce_zh", "sens", "source")
COLONNES_BRIQUES = ("brique", "nom", "source")

#: La disposition de premier niveau, par opérateur de description idéographique.
DISPOSITIONS: dict[str, str] = {
    "⿰": "cote",
    "⿲": "cote",
    "⿱": "superpose",
    "⿳": "superpose",
    "⿴": "dedans",
    "⿵": "dedans",
    "⿶": "dedans",
    "⿷": "dedans",
    "⿸": "enveloppe",
    "⿹": "enveloppe",
    "⿺": "enveloppe",
    "⿻": "mele",
}

SOURCE_EXPORT = (
    "data/sources/devinettes/ : devinettes rédigées pour l'app ; énoncés chinois"
    " traditionnels (字谜, domaine public) ; leurres choisis par ressemblance de composants"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Devinette:
    """Une devinette telle que la source la donne, avec sa ligne pour les contrôles."""

    c: str
    disposition: str
    briques: tuple[str, ...]
    enonce: str
    zh: str
    sens: str
    source: str
    numero: int = 0


def charger(chemin: Path | None = None) -> list[Devinette]:
    """Les devinettes de `devinettes.tsv`, dans l'ordre du fichier."""
    lignes, _ = lire_tsv(chemin or DEVINETTES)
    return [
        Devinette(
            c=l.cellules.get("c", ""),
            disposition=l.cellules.get("disposition", ""),
            briques=tuple(l.cellules.get("briques", "").split()),
            enonce=l.cellules.get("enonce_fr", ""),
            zh=l.cellules.get("enonce_zh", ""),
            sens=l.cellules.get("sens", ""),
            source=l.cellules.get("source", ""),
            numero=l.numero,
        )
        for l in lignes
    ]


def charger_noms(chemin: Path | None = None) -> dict[str, str]:
    """Le nom de chaque brique, `{brique: nom}`."""
    lignes, _ = lire_tsv(chemin or BRIQUES)
    return {
        l.cellules.get("brique", ""): l.cellules.get("nom", "")
        for l in lignes
        if l.cellules.get("brique")
    }


# ---------------------------------------------------------------------------- leurres


def composants(c: str, decompositions: Mapping[str, Sequence[str]]) -> list[str]:
    """Les composants canoniques d'un caractère ; à défaut, le caractère est sa propre brique."""
    d = [x for x in decompositions.get(c) or () if x]
    return d if d else [c]


def ressemblance(
    a: str,
    b: str,
    decompositions: Mapping[str, Sequence[str]],
    paires: Sequence[Sequence[str]] = (),
) -> float:
    """La ressemblance de `questions.ts`, à l'identique : Jaccard, même nombre, même paire."""
    A = set(composants(a, decompositions))
    B = set(composants(b, decompositions))
    union = len(A | B)
    score = len(A & B) / union if union else 0.0
    if len(A) == len(B):
        score += BONUS_MEME_NOMBRE
    if any(a in g and b in g for g in paires):
        score += BONUS_PAIRE
    return score


def porte_tout(x: str, briques: Sequence[str], decompositions: Mapping[str, Sequence[str]]) -> bool:
    """`x` porte toutes les briques citées, en comptant les doublons : ce serait une réponse."""
    reste = Counter(composants(x, decompositions))
    return all(reste[b] >= n for b, n in Counter(briques).items())


def _departage(c: str, x: str) -> str:
    """Départage stable des ex aequo : le même contenu donne toujours les mêmes leurres."""
    return hashlib.sha256(f"{c}/{x}".encode("utf-8")).hexdigest()


def leurres(
    c: str,
    briques: Sequence[str],
    candidats: Iterable[str],
    decompositions: Mapping[str, Sequence[str]],
    paires: Sequence[Sequence[str]] = (),
    n: int = LEURRES,
    structures: Mapping[str, str] | None = None,
) -> list[str]:
    """Les `n` leurres d'une devinette, par ressemblance de composants avec la réponse.

    D'abord, pour chaque brique citée, le candidat le plus ressemblant qui la porte :
    ainsi chaque brique compte, et la devinette ne se résout pas sur une seule. Puis
    les plus ressemblants, dans l'ordre. À ressemblance égale, un caractère de même
    disposition passe devant (`structures`, la structure IDS de chacun) : l'œil doit
    lire les briques, pas la silhouette. Jamais la réponse, jamais une brique citée
    (un morceau seul se voit d'emblée), jamais un caractère qui porte toutes les
    briques citées, jamais deux fois le même.
    """
    structures = structures or {}

    def disposition(x: str) -> str:
        return DISPOSITIONS.get((structures.get(x) or "")[:1], "")

    forme = disposition(c)
    possibles = sorted(
        {
            x
            for x in candidats
            if x != c and x not in briques and not porte_tout(x, briques, decompositions)
        },
        key=lambda x: (
            -ressemblance(x, c, decompositions, paires),
            not (forme and disposition(x) == forme),
            _departage(c, x),
            x,
        ),
    )
    choisis: list[str] = []
    for b in dict.fromkeys(briques):
        for x in possibles:
            if x not in choisis and b in composants(x, decompositions):
                choisis.append(x)
                break
        if len(choisis) >= n:
            break
    for x in possibles:
        if len(choisis) >= n:
            break
        if x not in choisis:
            choisis.append(x)
    return choisis[:n]


# ---------------------------------------------------------------------------- export


def document(
    version: str,
    *,
    caracteres: Iterable[str],
    candidats: Iterable[str],
    decompositions: Mapping[str, Sequence[str]],
    pinyin: Mapping[str, str],
    racines: Mapping[str, str],
    paires: Sequence[Sequence[str]] = (),
    structures: Mapping[str, str] | None = None,
    en_tete: Mapping[str, object] | None = None,
    source: Path | None = None,
    noms: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `devinettes.json`.

    `caracteres` : ce que l'export dessine (le périmètre) ; une devinette dont la
    réponse, une brique ou un leurre en sortirait n'est pas exportée — `wenlu check`
    le dit. `candidats` : les caractères parmi lesquels choisir les leurres, ceux des
    listes cibles. `racines` donne la famille de chaque caractère dessiné, pour que
    l'app trouve ses traits sans relire toutes les familles.
    """
    dessinables = set(caracteres)
    candidats = [x for x in candidats if x in dessinables]
    table = charger_noms(noms)
    sorties: list[dict[str, object]] = []
    for d in charger(source):
        if d.c not in dessinables or not all(b in dessinables for b in d.briques):
            continue
        choisis = leurres(d.c, d.briques, candidats, decompositions, paires, structures=structures)
        if len(choisis) < LEURRES:
            continue
        sorties.append(
            {
                "id": d.c,
                "c": d.c,
                "pinyin": pinyin.get(d.c, ""),
                "sens": d.sens,
                "enonce": d.enonce,
                "zh": d.zh or None,
                "disposition": d.disposition,
                "briques": list(d.briques),
                "leurres": choisis,
            }
        )
    dessines = sorted(
        {x for s in sorties for x in [s["c"], *s["briques"], *s["leurres"]]}  # type: ignore[misc]
    )
    cites = sorted({b for s in sorties for b in s["briques"]})  # type: ignore[union-attr]
    return {
        **(en_tete or {}),
        "devinettes": sorties,
        "noms": {b: table.get(b, "") for b in cites},
        "racines": {x: racines[x] for x in dessines if x in racines},
    }


# ------------------------------------------------------------------------- contrôles


def fautes_sources(devinettes: Sequence[Devinette], noms: Mapping[str, str]) -> list[str]:
    """Ce qui cloche dans les sources : champs vides, doublons, disposition, briques sans nom."""
    fautes: list[str] = []
    vues: set[str] = set()
    for d in devinettes:
        ou = f"devinettes.tsv:{d.numero}"
        if len(d.c) != 1:
            fautes.append(f"{ou} : la réponse doit être un seul caractère ({d.c!r})")
        if d.c in vues:
            fautes.append(f"{ou} : {d.c} a déjà une devinette")
        vues.add(d.c)
        for champ, valeur in (("enonce_fr", d.enonce), ("sens", d.sens), ("source", d.source)):
            if not valeur:
                fautes.append(f"{ou} : {d.c} sans {champ}")
        if d.disposition not in set(DISPOSITIONS.values()):
            fautes.append(f"{ou} : {d.c} disposition inconnue {d.disposition!r}")
        if len(d.briques) < 2:
            fautes.append(f"{ou} : {d.c} cite moins de deux briques")
        for b in d.briques:
            if not noms.get(b):
                fautes.append(f"{ou} : {d.c} cite {b}, sans nom dans briques.tsv")
        if d.enonce.startswith("«") or d.enonce.endswith("»"):
            fautes.append(f"{ou} : {d.c} énoncé entre guillemets (l'app les pose)")
    return fautes


def fautes_decomposition(
    devinettes: Sequence[Devinette],
    parts: Mapping[str, Sequence[str]],
    structures: Mapping[str, str],
) -> list[str]:
    """L'énoncé doit dire la décomposition exportée : mêmes briques, même disposition."""
    fautes: list[str] = []
    for d in devinettes:
        exportees = list(parts.get(d.c) or ())
        if not exportees:
            fautes.append(f"{d.c} : aucune décomposition exportée")
            continue
        if Counter(d.briques) != Counter(exportees):
            fautes.append(f"{d.c} : cite {' '.join(d.briques)}, l'export dit {' '.join(exportees)}")
        structure = structures.get(d.c, "")
        attendue = DISPOSITIONS.get(structure[:1], "")
        if attendue and d.disposition != attendue:
            fautes.append(f"{d.c} : disposition {d.disposition}, la structure {structure} dit {attendue}")
    return fautes


def fautes_leurres(
    sorties: Sequence[Mapping[str, object]], parts: Mapping[str, Sequence[str]]
) -> list[str]:
    """Trois leurres distincts, jamais la réponse, jamais un caractère qui porte toutes les briques."""
    fautes: list[str] = []
    for s in sorties:
        c = str(s.get("c", ""))
        ls = [str(x) for x in s.get("leurres") or ()]  # type: ignore[union-attr]
        briques = [str(x) for x in s.get("briques") or ()]  # type: ignore[union-attr]
        if len(ls) != LEURRES:
            fautes.append(f"{c} : {len(ls)} leurres pour {LEURRES}")
        if len(set(ls)) != len(ls):
            fautes.append(f"{c} : leurres en double")
        if c in ls:
            fautes.append(f"{c} : la réponse est parmi les leurres")
        for x in ls:
            if x in briques:
                fautes.append(f"{c} : le leurre {x} est une brique citée")
        for x in ls:
            if porte_tout(x, briques, parts):
                fautes.append(f"{c} : le leurre {x} porte toutes les briques citées")
    return fautes


def _parts_exportees(dossier: Path) -> dict[str, list[str]]:
    """Les `parts` de chaque fiche exportée, lues dans `familles/`."""
    parts: dict[str, list[str]] = {}
    for chemin in sorted((dossier / "familles").glob("*.json")):
        document_famille = json.loads(chemin.read_text(encoding="utf-8"))
        for fiche in document_famille.get("fiches") or ():
            parts[str(fiche["c"])] = [str(x) for x in fiche.get("parts") or ()]
    return parts


def _enseignes(build: Path) -> set[str]:
    """Les caractères qu'un parcours pose : les seuls qui auront une carte un jour."""
    vus: set[str] = set()
    for chemin in sorted(build.glob("parcours-*.json")):
        for jour in json.loads(chemin.read_text(encoding="utf-8")).get("jours") or ():
            if jour.get("brique"):
                vus.add(str(jour["brique"]))
            vus |= {str(c) for c in jour.get("composes") or ()}
    return vus


def _structures(build: Path) -> dict[str, str]:
    chemin = build / "decompositions.json"
    if not chemin.exists():
        return {}
    document_build = json.loads(chemin.read_text(encoding="utf-8"))
    return {str(e["c"]): str(e.get("structure") or "") for e in document_build["caracteres"]}


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    source: Path | None = None,
    noms: Path | None = None,
) -> list[Controle]:
    """Contrôles des devinettes, pour `wenlu check`. Tous bloquants.

    « sources » : réponse d'un caractère, une devinette par réponse, énoncé, sens et
    source présents, disposition connue, chaque brique citée nommée. « décomposition » :
    les briques citées sont exactement les `parts` exportées de la réponse, et la
    disposition est celle de la structure IDS du build. « leurres » : dans chaque
    export, trois leurres distincts, jamais la réponse, jamais un caractère qui porte
    toutes les briques. « traits » : réponse, briques et leurres sont dessinables.
    « parcours » : la réponse et ses briques sont posées par un parcours, sans quoi
    la devinette ne serait jamais proposée.
    """
    from .export import versions_exportees
    from .fetes import traits_exportes

    build = build or BUILD
    lues = charger(source)
    table = charger_noms(noms)
    _, forme = lire_tsv(source or DEVINETTES)
    _, forme_noms = lire_tsv(noms or BRIQUES)
    f_src = forme + forme_noms + fautes_sources(lues, table)

    dossiers = versions_exportees(destination or EXPORT)
    f_dec: list[str] = []
    f_leu: list[str] = []
    f_tra: list[str] = []
    exportees = 0
    for dossier in dossiers:
        parts = _parts_exportees(dossier)
        f_dec += [f"{dossier.name}:{f}" for f in fautes_decomposition(lues, parts, _structures(build))]
        chemin = dossier / "devinettes.json"
        if not chemin.exists():
            f_leu.append(f"{dossier.name} : devinettes.json absent, lancer `wenlu export`")
            continue
        sorties = json.loads(chemin.read_text(encoding="utf-8")).get("devinettes") or []
        exportees = max(exportees, len(sorties))
        f_leu += [f"{dossier.name}:{f}" for f in fautes_leurres(sorties, parts)]
        manquantes = sorted({d.c for d in lues} - {str(s.get("c")) for s in sorties})
        if manquantes:
            f_leu.append(f"{dossier.name} : non exportées {' '.join(manquantes)}")
        presents = traits_exportes(dossier)
        for s in sorties:
            for x in [s.get("c"), *(s.get("briques") or []), *(s.get("leurres") or [])]:
                if x not in presents:
                    f_tra.append(f"{dossier.name}:{s.get('c')} sans traits pour {x}")

    enseignes = _enseignes(build)
    f_par = [
        f"{d.c} : {' '.join(x for x in [d.c, *d.briques] if x not in enseignes)} hors parcours"
        for d in lues
        if enseignes and any(x not in enseignes for x in [d.c, *d.briques])
    ]

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    return [
        Controle(
            "devinettes : sources",
            not f_src,
            detail(f_src, f"{len(lues)} devinettes (objectif : {OBJECTIF}), sourcées, briques nommées"),
            bloquant=True,
        ),
        Controle(
            "devinettes : décomposition",
            not f_dec,
            detail(f_dec, "chaque énoncé cite les briques exportées, dans leur disposition")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle(
            "devinettes : leurres",
            not f_leu,
            detail(f_leu, f"{exportees} devinettes exportées, trois leurres distincts chacune")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle(
            "devinettes : traits",
            not f_tra,
            detail(f_tra, "réponses, briques et leurres dans les traits exportés"),
            bloquant=True,
        ),
        Controle(
            "devinettes : parcours",
            not f_par,
            detail(f_par, "chaque réponse et chaque brique est posée par un parcours"),
            bloquant=True,
        ),
    ]


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="Les devinettes de lanternes : relecture et rédaction.")


@app.command("apercu")
def commande_apercu(version: str = typer.Option("0.1.0", help="Version exportée à relire.")) -> None:
    """Affiche chaque devinette exportée : réponse, énoncé, briques et leurres. Exige `export`."""
    chemin = EXPORT / version / "devinettes.json"
    if not chemin.exists():
        typer.echo(f"{chemin} absent : lancer `wenlu export`.", err=True)
        raise typer.Exit(code=1)
    document_export = json.loads(chemin.read_text(encoding="utf-8"))
    for s in document_export["devinettes"]:
        typer.echo(
            f"{s['c']}\t{' + '.join(s['briques'])}\t{' '.join(s['leurres'])}\t{s['enonce']}"
            + (f"\t{s['zh']}" if s.get("zh") else "")
        )
    typer.echo(f"{len(document_export['devinettes'])} devinettes.")


@app.command("a-rediger")
def commande_a_rediger(liste: str = typer.Option("seuil-255", help="La liste cible à couvrir.")) -> None:
    """Les caractères de la liste qui n'ont pas de devinette et dont toutes les briques s'apprennent."""
    listes = json.loads((INGEST / "listes.json").read_text(encoding="utf-8"))
    structures = _structures(BUILD)
    document_build = json.loads((BUILD / "decompositions.json").read_text(encoding="utf-8"))
    parts = {str(e["c"]): [str(x) for x in e.get("composants") or ()] for e in document_build["caracteres"]}
    enseignes = _enseignes(BUILD)
    faites = {d.c for d in charger()}
    n = 0
    for c in listes.get(liste) or ():
        p = parts.get(c) or []
        if c in faites or len(p) < 2 or any(b not in enseignes for b in p):
            continue
        n += 1
        typer.echo(f"{c}\t{structures.get(c, '')}\t{' '.join(p)}")
    typer.echo(f"{n} caractères de {liste} sans devinette, toutes briques enseignées.")
