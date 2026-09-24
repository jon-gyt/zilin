"""Découpes : les traits d'un composant de la norme pris dans un caractère hôte.

Make Me a Hanzi (`graphics.txt`, Arphic Public License) ne dessine pas tous les
composants de GF 0014-2009 : 𠂇, 龰, 𭕄, les composants sans point de code comme
`⿰𠄌丶`… Sans traits, l'app ne les montre pas, et le graphe en faisait des briques
muettes, acquises d'entrée faute de rien à poser.

Décision du propriétaire : les découper. `data/sources/surcharges/decoupes.tsv`
donne, pour chaque composant, un caractère hôte qui le contient et les indices de
ses traits dans l'hôte. Le composant prend ces traits-là — tracés et médianes de
la source, dans l'ordre d'écriture de l'hôte — et rien d'autre : aucun trait n'est
dessiné. Seule transformation permise, le recadrage (`centre`) : une homothétie
x' = e·x + dx, y' = e·y + dy qui porte la boîte englobante des traits retenus au
centre de la boîte de Make Me a Hanzi, coordonnées arrondies à l'entier. Elle est
écrite dans `decoupes.json`, puis décrite découpe par découpe dans
`traits/MODIFICATIONS.md` de l'export, comme l'APL §2 a) l'exige.

`wenlu build` écrit `data/work/build/decoupes.json` avant le graphe, qui fait de
chaque composant découpé une feuille `decoupee` et non plus muette (voir
`graphe.py` : elle reste acquise d'entrée, le parcours ne bouge pas) ; `wenlu
export` en tire les traits des composants du périmètre ; `wenlu check` revérifie la
table (`controles`).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from . import surcharges as surcharges_mod
from .outils import ecrire_json
from .paths import BUILD, EXPORT, INGEST

#: Le fichier écrit par `wenlu build`, à côté de `decompositions.json`.
FICHIER = "decoupes.json"

#: Les recadrages permis. `aucun` : les traits restent à leur place dans l'hôte.
#: `centre` : voir `transformation`.
AUCUN = "aucun"
CENTRE = "centre"
RECADRAGES: tuple[str, ...] = (AUCUN, CENTRE)

#: Le centre de la boîte de Make Me a Hanzi : x de 0 à 1024, y de -124 à 900.
CENTRE_BOITE: tuple[float, float] = (512.0, 388.0)
#: Le plus grand côté d'un composant recadré, en unités de la boîte : l'ordre de
#: grandeur des composants que Make Me a Hanzi dessine seuls (口 634, 士 794, 亻 787).
CIBLE = 760.0
#: Un trait isolé ne devient pas un pavé : on n'agrandit jamais plus de deux fois.
ECHELLE_MAX = 2.0

#: Un jeton d'un tracé SVG de `graphics.txt` : une commande ou un nombre.
_JETON = re.compile(r"[A-Za-z]|-?\d+(?:\.\d+)?")
#: Les commandes de `graphics.txt`, toutes en coordonnées absolues.
_COMMANDES = frozenset("MLQCZ")


class DecoupeInvalide(ValueError):
    """Une découpe ne se fait pas : hôte absent, indice hors de l'hôte, tracé illisible."""


@dataclass(frozen=True)
class Decoupe:
    """Une ligne de `decoupes.tsv`. `indices` comptent les traits de l'hôte à partir de 0."""

    composant: str
    hote: str
    indices: tuple[int, ...]
    recadrage: str
    raison: str
    ligne: int = 0


# ------------------------------------------------------------------------- lecture


def lire_indices(texte: str) -> tuple[int, ...]:
    """`0,1` ou `3-6` (bornes comprises), ou un mélange : `0-2,5`. Croissants, sans doublon."""
    indices: list[int] = []
    for morceau in texte.split(","):
        morceau = morceau.strip()
        if re.fullmatch(r"\d+", morceau):
            indices.append(int(morceau))
            continue
        plage = re.fullmatch(r"(\d+)-(\d+)", morceau)
        if plage is None or int(plage[1]) > int(plage[2]):
            raise ValueError(f"indices illisibles : {texte!r}")
        indices += range(int(plage[1]), int(plage[2]) + 1)
    if not indices or any(b <= a for a, b in zip(indices, indices[1:])):
        raise ValueError(f"indices vides, répétés ou hors de l'ordre d'écriture : {texte!r}")
    return tuple(indices)


def parse_decoupes(texte: Iterable[str], nom: str = "decoupes.tsv") -> list[Decoupe]:
    """Les découpes d'un TSV à cinq colonnes, raison comprise. Un composant, une ligne."""
    decoupes: list[Decoupe] = []
    vus: set[str] = set()
    for ligne in surcharges_mod._lignes(texte, 5, nom):
        composant, hote, indices, recadrage, raison = ligne.colonnes
        ou = f"{nom}, ligne {ligne.numero}"
        if len(hote) != 1 or hote == composant:
            raise surcharges_mod.SurchargeInvalide(f"{ou} : l'hôte {hote!r} doit être un autre caractère")
        if composant in vus:
            raise surcharges_mod.SurchargeInvalide(f"{ou} : {composant} a déjà une ligne")
        if recadrage not in RECADRAGES:
            raise surcharges_mod.SurchargeInvalide(
                f"{ou} : recadrage {recadrage!r} inconnu ({', '.join(RECADRAGES)})"
            )
        try:
            lus = lire_indices(indices)
        except ValueError as erreur:
            raise surcharges_mod.SurchargeInvalide(f"{ou} : {erreur}") from erreur
        vus.add(composant)
        decoupes.append(Decoupe(composant, hote, lus, recadrage, raison, ligne.numero))
    return decoupes


def charger_decoupes(chemin: Path | None = None) -> list[Decoupe]:
    """`data/sources/surcharges/decoupes.tsv`. Absent, la table est vide."""
    chemin = chemin or surcharges_mod.DECOUPES
    return parse_decoupes(surcharges_mod._lire(chemin), chemin.name)


# -------------------------------------------------------------------- géométrie


@dataclass(frozen=True)
class Transformation:
    """x' = echelle·x + dx, y' = echelle·y + dy, puis arrondi à l'entier.

    L'échelle est arrondie au dix-millième et le décalage au dixième avant d'être
    appliqués : ce qui est écrit dans `MODIFICATIONS.md` est exactement ce qui a
    été fait.
    """

    echelle: float = 1.0
    dx: float = 0.0
    dy: float = 0.0

    def point(self, x: float, y: float) -> tuple[int, int]:
        return round(self.echelle * x + self.dx), round(self.echelle * y + self.dy)

    @property
    def identite(self) -> bool:
        return self.echelle == 1.0 and self.dx == 0.0 and self.dy == 0.0


def _jetons(trace: str) -> list[str]:
    jetons = _JETON.findall(trace)
    lettres = {j for j in jetons if j.isalpha()}
    if not lettres <= _COMMANDES:
        raise DecoupeInvalide(f"commande de tracé inattendue ({' '.join(sorted(lettres - _COMMANDES))})")
    return jetons


def coordonnees(trace: str) -> list[tuple[float, float]]:
    """Les points d'un tracé (extrémités et points de contrôle), dans l'ordre."""
    nombres = [float(j) for j in _jetons(trace) if not j.isalpha()]
    if len(nombres) % 2:
        raise DecoupeInvalide(f"tracé à nombre impair de coordonnées : {trace[:40]}…")
    return list(zip(nombres[0::2], nombres[1::2]))


def boite(traces: Sequence[str]) -> tuple[float, float, float, float]:
    """Boîte englobante (xmin, ymin, xmax, ymax) des points des tracés.

    Les points de contrôle des courbes en font partie : la boîte est un peu large,
    jamais trop étroite.
    """
    points = [p for t in traces for p in coordonnees(t)]
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    return min(xs), min(ys), max(xs), max(ys)


def transformation(recadrage: str, traces: Sequence[str]) -> Transformation:
    """Le recadrage d'une découpe : l'identité, ou le centrage à l'échelle de `CIBLE`."""
    if recadrage == AUCUN:
        return Transformation()
    xmin, ymin, xmax, ymax = boite(traces)
    cote = max(xmax - xmin, ymax - ymin, 1.0)
    echelle = round(min(CIBLE / cote, ECHELLE_MAX), 4)
    cx, cy = (xmin + xmax) / 2, (ymin + ymax) / 2
    return Transformation(
        echelle=echelle,
        dx=round(CENTRE_BOITE[0] - echelle * cx, 1),
        dy=round(CENTRE_BOITE[1] - echelle * cy, 1),
    )


def transformer_trace(trace: str, t: Transformation) -> str:
    """Le tracé, chaque couple de coordonnées passé par `t`. La forme d'écriture est gardée."""
    sortie: list[str] = []
    attente: float | None = None
    for jeton in _jetons(trace):
        if jeton.isalpha():
            if attente is not None:
                raise DecoupeInvalide(f"coordonnée orpheline dans {trace[:40]}…")
            sortie.append(jeton)
        elif attente is None:
            attente = float(jeton)
        else:
            x, y = t.point(attente, float(jeton))
            sortie += [str(x), str(y)]
            attente = None
    if attente is not None:
        raise DecoupeInvalide(f"coordonnée orpheline dans {trace[:40]}…")
    return " ".join(sortie)


# ------------------------------------------------------------------------- découpe


def decouper(d: Decoupe, graphies: Mapping[str, Mapping[str, object]]) -> dict[str, object]:
    """Les traits du composant, pris dans l'hôte, et la trace de ce qui a été fait.

    `graphies` : les entrées de `graphies.json` par caractère (`strokes`, `medians`).
    """
    hote = graphies.get(d.hote)
    if hote is None:
        raise DecoupeInvalide(f"{d.composant} : l'hôte {d.hote} n'a pas de tracés dans graphics.txt")
    traces = list(hote["strokes"])  # type: ignore[call-overload]
    medianes = list(hote["medians"])  # type: ignore[call-overload]
    hors = [i for i in d.indices if i >= len(traces)]
    if hors:
        raise DecoupeInvalide(
            f"{d.composant} : {d.hote} n'a que {len(traces)} traits (indices {', '.join(map(str, hors))})"
        )
    retenus = [str(traces[i]) for i in d.indices]
    t = transformation(d.recadrage, retenus)
    return {
        "c": d.composant,
        "hote": d.hote,
        "indices": list(d.indices),
        "traits_hote": len(traces),
        "recadrage": d.recadrage,
        "echelle": t.echelle,
        "dx": t.dx,
        "dy": t.dy,
        "raison": d.raison,
        "strokes": [transformer_trace(s, t) for s in retenus],
        "medians": [[list(t.point(x, y)) for x, y in medianes[i]] for i in d.indices],
    }


def erreurs(
    decoupes: Sequence[Decoupe],
    *,
    table: object,
    graphies: Mapping[str, Mapping[str, object]],
    decompositions: Mapping[str, Mapping[str, object]] | None = None,
) -> list[str]:
    """Ce qui ne va pas dans la table des découpes ; vide si tout est juste.

    Le composant est dans la norme (`table`, une `TableGF0014`) et n'a pas de tracé
    propre ; l'hôte a des tracés et assez de traits ; et, si `decompositions` est
    donné, la décomposition canonique de l'hôte contient le composant.
    """
    fautes: list[str] = []
    for d in decoupes:
        if d.composant not in table:  # type: ignore[operator]
            fautes.append(f"{d.composant} n'est pas un composant de GF 0014-2009")
        if d.composant in graphies:
            fautes.append(f"{d.composant} a déjà ses tracés dans graphics.txt : rien à découper")
        try:
            decouper(d, graphies)
        except DecoupeInvalide as erreur:
            fautes.append(str(erreur))
        if decompositions is not None:
            composants = (decompositions.get(d.hote) or {}).get("composants") or []
            if d.composant not in composants:  # type: ignore[operator]
                fautes.append(f"{d.composant} : la décomposition de {d.hote} ne le contient pas")
    return fautes


# --------------------------------------------------------------------------- build


def document_decoupes(traces: Sequence[Mapping[str, object]]) -> dict[str, object]:
    """Contenu de `decoupes.json` (voir data/schema.md)."""
    return {
        "source": "data/sources/surcharges/decoupes.tsv",
        "source_traits": "Make Me a Hanzi — graphics.txt",
        "licence_traits": "Arphic Public License",
        "recadrage": {
            "centre": list(CENTRE_BOITE),
            "cible": CIBLE,
            "echelle_max": ECHELLE_MAX,
            "formule": "x' = echelle·x + dx, y' = echelle·y + dy, arrondis à l'entier",
        },
        "decoupes": list(traces),
    }


def _graphies(ingest: Path) -> dict[str, Mapping[str, object]]:
    document = json.loads((ingest / "graphies.json").read_text(encoding="utf-8"))
    return {str(e["c"]): e for e in document}


def build(
    ingest: Path | None = None,
    sortie: Path | None = None,
    table: object | None = None,
    decoupes: Sequence[Decoupe] | None = None,
) -> dict[str, object]:
    """Écrit `decoupes.json`. Une découpe impossible lève `DecoupeInvalide`.

    La table GF 0014-2009 est chargée par défaut ; la décomposition de l'hôte, elle,
    n'existe pas encore — `wenlu check` la vérifie après coup.
    """
    from .gf0014 import charger_table

    ingest = ingest or INGEST
    sortie = sortie or BUILD
    table = table if table is not None else charger_table()
    decoupes = charger_decoupes() if decoupes is None else decoupes
    graphies = _graphies(ingest)
    fautes = erreurs(decoupes, table=table, graphies=graphies)
    if fautes:
        raise DecoupeInvalide("découpes impossibles : " + " ; ".join(fautes))
    traces = [decouper(d, graphies) for d in decoupes]
    ecrire_json(sortie / FICHIER, document_decoupes(traces))
    return {"decoupes": f"{len(traces)} composants découpés dans un hôte" if traces else 0}


# -------------------------------------------------------------------------- lecture


def charger(build: Path | None = None) -> list[dict[str, object]]:
    """Les découpes écrites par `wenlu build`, dans l'ordre de la table. Rien si absent."""
    fichier = (build or BUILD) / FICHIER
    if not fichier.exists():
        return []
    return list(json.loads(fichier.read_text(encoding="utf-8")).get("decoupes") or [])


def composants_decoupes(build: Path | None = None) -> list[str]:
    """Les composants découpés, dans l'ordre de la table."""
    return [str(d["c"]) for d in charger(build)]


def traits(build: Path | None = None) -> dict[str, dict[str, object]]:
    """Les traits des composants découpés, sous la forme de l'export : `{s, m}`."""
    return {str(d["c"]): {"s": d["strokes"], "m": d["medians"]} for d in charger(build)}


# ---------------------------------------------------------------------------- check


def controles(
    build: Path | None = None, ingest: Path | None = None, export: Path | None = None
) -> list[object]:
    """Contrôles des découpes, pour `wenlu check`. Tous bloquants.

    « table » : chaque ligne se relit contre la norme, les tracés de la source et la
    décomposition de l'hôte. « traits » : chaque composant découpé a ses traits dans
    `decoupes.json`, n'est plus muet dans le graphe, et chaque version exportée qui le
    porte porte aussi ses traits.
    """
    from .gf0014 import Controle, charger_table
    from .graphe import MUETTE

    build = build or BUILD
    ingest = ingest or INGEST
    export = export or EXPORT
    try:
        decoupes = charger_decoupes()
    except surcharges_mod.SurchargeInvalide as erreur:
        return [Controle("découpes : table", False, str(erreur), True)]
    fichiers = [build / "decompositions.json", build / "graphe.json", ingest / "graphies.json"]
    absents = [str(f) for f in fichiers if not f.exists()]
    if absents:
        return [Controle("découpes", False, f"{', '.join(absents)} absent : lancer `wenlu build`", True)]

    decompositions = {
        str(e["c"]): e
        for e in json.loads(fichiers[0].read_text(encoding="utf-8"))["caracteres"]
    }
    fautes = erreurs(
        decoupes, table=charger_table(), graphies=_graphies(ingest), decompositions=decompositions
    )
    resultats = [
        Controle(
            "découpes : table",
            not fautes,
            "; ".join(fautes)
            if fautes
            else f"{len(decoupes)} composants, indices valides, hôte dans la source et le contenant",
            bloquant=True,
        )
    ]

    noeuds = {
        str(n["c"]): n for n in json.loads(fichiers[1].read_text(encoding="utf-8"))["noeuds"]
    }
    ecrits = traits(build)
    muets: list[str] = []
    for d in decoupes:
        if d.composant not in ecrits:
            muets.append(f"{d.composant} sans traits dans {FICHIER}")
        genre = (noeuds.get(d.composant) or {}).get("genre")
        if genre == MUETTE:
            muets.append(f"{d.composant} reste muet dans le graphe")
    for index in sorted(export.glob("*/index.json")):
        dossier = index.parent
        dessines = _traits_exportes(dossier)
        for c in _caracteres_exportes(dossier):
            if c in ecrits and c not in dessines:
                muets.append(f"{dossier.name}:{c} exporté sans ses traits")
    resultats.append(
        Controle(
            "découpes : traits",
            not muets,
            "; ".join(muets)
            if muets
            else f"{' '.join(d.composant for d in decoupes)} : plus muets dans le graphe, traits exportés",
            bloquant=True,
        )
    )
    return resultats


def _traits_exportes(dossier: Path) -> set[str]:
    presents: set[str] = set()
    for chemin in sorted((dossier / "traits").glob("*.json")):
        presents |= set(json.loads(chemin.read_text(encoding="utf-8")).get("traits") or {})
    return presents


def _caracteres_exportes(dossier: Path) -> set[str]:
    trouves: set[str] = set()
    for chemin in sorted((dossier / "familles").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        trouves |= {str(f["c"]) for f in document.get("fiches") or []}
    return trouves
