"""Décomposition canonique selon GF 0014-2009 《现代常用字部件及部件名称规范》.

La norme découpe les caractères usuels en 514 composants répartis en 441 groupes,
un groupe réunissant un composant principal et ses variantes de forme (部件变体).
La table est versionnée dans `data/sources/gf0014-2009/composants.tsv`, dont
l'en-tête documente les sources, leurs empreintes et les écarts relevés.

Réconciliation : Make Me a Hanzi fournit une chaîne IDS par caractère, qui n'est
pas canonique. On la descend récursivement ; dès qu'une feuille appartient à la
table, on s'y arrête — un composant de la norme est une feuille. L'ordre des
opérandes IDS, qui est l'ordre d'écriture, est conservé.

Un caractère est en écart quand sa décomposition atteint une feuille absente de
la table (composant inconnu), quand son IDS est vide ou illisible, ou quand la
descente boucle (cycle).

Make Me a Hanzi note `？` l'élément qu'il ne décompose pas : ces caractères ne
peuvent pas être réconciliés. Une source d'IDS secondaire sous licence permissive
(cjk-decomp, voir `cjkdecomp.py`) prend alors le relais, et seulement alors. Le
caractère garde la trace des sources d'IDS consultées (`sources`).
"""
from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Mapping, Sequence

from .cjkdecomp import SOURCE as SOURCE_SECONDAIRE
from .outils import ecrire_json
from .paths import BUILD, GF0014, INGEST

# Opérateurs de description idéographique (Unicode 2FF0..2FFB) et leur arité.
OPERATEURS_IDS: dict[str, int] = {
    "⿰": 2, "⿱": 2, "⿲": 3, "⿳": 3, "⿴": 2, "⿵": 2,
    "⿶": 2, "⿷": 2, "⿸": 2, "⿹": 2, "⿺": 2, "⿻": 2,
}

# Make Me a Hanzi note d'un point d'interrogation pleine chasse un caractère
# qu'il ne décompose pas.
INCONNU = "？"

SOURCE_MMAH = "makemeahanzi"

COLONNES = (
    "sequence", "groupe", "forme", "type_forme", "nom",
    "nom_simple", "principal", "caractere_plein",
)


class TableInvalide(ValueError):
    """Table GF 0014-2009 illisible ou incohérente."""


class IdsInvalide(ValueError):
    """Chaîne IDS mal formée."""


# --------------------------------------------------------------------------- table


@dataclass(frozen=True)
class Composant:
    """Une ligne de la table des 514 composants."""

    sequence: int
    groupe: int
    forme: str
    type_forme: str  # "unicode" ou "ids"
    nom: str
    nom_simple: str
    principal: str
    caractere_plein: bool

    @property
    def variante(self) -> bool:
        """Vrai si le composant est une variante de forme (部件变体) d'un principal."""
        return self.forme != self.principal


class TableGF0014:
    """Les composants de la norme, indexés par forme.

    Seuls les composants ayant un point de code Unicode sont appariables avec une
    décomposition IDS ; les autres restent dans `composants` pour la complétude.

    Quatre points de code portent deux composants distincts de la norme (⺈, 丁,
    丷, 𧘇) : `par_forme` associe donc une forme à toutes ses lignes, et
    `__getitem__` rend la première, celle du plus petit numéro d'ordre.
    """

    def __init__(self, composants: Sequence[Composant]) -> None:
        self.composants: tuple[Composant, ...] = tuple(composants)
        self.par_forme: dict[str, tuple[Composant, ...]] = {}
        for c in self.composants:
            if c.type_forme != "unicode":
                continue
            self.par_forme[c.forme] = self.par_forme.get(c.forme, ()) + (c,)

    def __contains__(self, forme: object) -> bool:
        return forme in self.par_forme

    def __len__(self) -> int:
        return len(self.composants)

    def __iter__(self) -> Iterator[Composant]:
        return iter(self.composants)

    def __getitem__(self, forme: str) -> Composant:
        return self.par_forme[forme][0]

    @property
    def groupes(self) -> int:
        """Nombre de groupes de la norme (441 pour la table complète)."""
        return len({c.groupe for c in self.composants})

    @property
    def homographes(self) -> dict[str, tuple[Composant, ...]]:
        """Points de code portant plus d'un composant de la norme."""
        return {f: cs for f, cs in self.par_forme.items() if len(cs) > 1}

    def principal(self, forme: str) -> str:
        """Forme du composant principal du groupe de `forme`, ou `forme` si inconnue."""
        composants = self.par_forme.get(forme)
        return composants[0].principal if composants else forme


def parse_table(lignes: Iterable[str]) -> list[Composant]:
    """Lit la table au format TSV. Les lignes `#` sont des commentaires."""
    composants: list[Composant] = []
    entete: list[str] | None = None
    for brute in lignes:
        ligne = brute.rstrip("\n")
        if not ligne.strip() or ligne.startswith("#"):
            continue
        champs = ligne.split("\t")
        if entete is None:
            entete = champs
            if tuple(entete) != COLONNES:
                raise TableInvalide(f"colonnes inattendues : {entete}")
            continue
        if len(champs) != len(COLONNES):
            raise TableInvalide(f"{len(champs)} champs au lieu de {len(COLONNES)} : {ligne!r}")
        valeurs = dict(zip(COLONNES, champs))
        if valeurs["type_forme"] not in ("unicode", "ids"):
            raise TableInvalide(f"type_forme inconnu : {valeurs['type_forme']!r}")
        composants.append(
            Composant(
                sequence=int(valeurs["sequence"]),
                groupe=int(valeurs["groupe"]),
                forme=valeurs["forme"],
                type_forme=valeurs["type_forme"],
                nom=valeurs["nom"],
                nom_simple=valeurs["nom_simple"],
                principal=valeurs["principal"],
                caractere_plein=valeurs["caractere_plein"] == "1",
            )
        )
    if entete is None:
        raise TableInvalide("table vide : ligne d'en-tête absente")
    return composants


def charger_table(chemin: Path | None = None) -> TableGF0014:
    """Charge `data/sources/gf0014-2009/composants.tsv`."""
    chemin = chemin or (GF0014 / "composants.tsv")
    return TableGF0014(parse_table(chemin.read_text(encoding="utf-8").splitlines()))


# ----------------------------------------------------------------------------- IDS

# Un nœud est soit une feuille (str), soit un couple (opérateur, enfants).
Noeud = str | tuple[str, tuple["Noeud", ...]]


def _lire_ids(ids: str, i: int) -> tuple[Noeud, int]:
    if i >= len(ids):
        raise IdsInvalide(f"IDS tronqué : {ids!r}")
    tete = ids[i]
    arite = OPERATEURS_IDS.get(tete)
    if arite is None:
        return tete, i + 1
    enfants: list[Noeud] = []
    i += 1
    for _ in range(arite):
        enfant, i = _lire_ids(ids, i)
        enfants.append(enfant)
    return (tete, tuple(enfants)), i


def analyser_ids(ids: str) -> Noeud:
    """Lit une chaîne IDS préfixée. Retourne une feuille (str) ou (opérateur, enfants)."""
    if not ids:
        raise IdsInvalide("IDS vide")
    noeud, i = _lire_ids(ids, 0)
    if i != len(ids):
        raise IdsInvalide(f"IDS avec un reste : {ids!r}")
    return noeud


# ------------------------------------------------------------------- décomposition


@dataclass(frozen=True)
class Decomposition:
    """Décomposition canonique d'un caractère.

    `composants` est la liste ordonnée des feuilles atteintes, dans l'ordre
    d'écriture. Une feuille hors table y figure quand même : `inconnus` la
    signale. `structure` est l'IDS réduit à ces feuilles. `sources` nomme les
    sources d'IDS descendues, dans l'ordre de leur première consultation.
    """

    c: str
    composants: tuple[str, ...]
    structure: str
    inconnus: tuple[str, ...] = ()
    cycle: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()  # sources d'IDS réellement consultées

    @property
    def reconcilie(self) -> bool:
        """Vrai si toutes les feuilles sont des composants de la norme."""
        return not self.inconnus and not self.cycle


def decomposer(
    c: str,
    table: TableGF0014,
    ids_par_caractere: Mapping[str, str],
    sources_ids: Mapping[str, str] | None = None,
) -> Decomposition:
    """Décompose `c` jusqu'aux composants GF 0014-2009, dans l'ordre d'écriture.

    `sources_ids` dit de quelle source vient l'IDS de chaque caractère ; les
    sources descendues sont reportées dans `Decomposition.sources`.
    """
    composants: list[str] = []
    inconnus: list[str] = []
    cycle: list[str] = []
    sources: dict[str, None] = {}

    def feuille(x: str, chemin: tuple[str, ...]) -> str:
        if x in table:
            composants.append(x)
            return x
        if x in chemin:
            if not cycle:
                cycle.extend(chemin[chemin.index(x):] + (x,))
            composants.append(x)
            return x
        brut = ids_par_caractere.get(x, "")
        if not brut or brut == INCONNU or brut == x:
            inconnus.append(x)
            composants.append(x)
            return x
        try:
            noeud = analyser_ids(brut)
        except IdsInvalide:
            inconnus.append(x)
            composants.append(x)
            return x
        if sources_ids is not None:
            sources[sources_ids.get(x, SOURCE_MMAH)] = None
        return descendre(noeud, chemin + (x,))

    def descendre(noeud: Noeud, chemin: tuple[str, ...]) -> str:
        if isinstance(noeud, str):
            return feuille(noeud, chemin)
        operateur, enfants = noeud  # type: ignore[misc]
        return operateur + "".join(descendre(e, chemin) for e in enfants)

    if c in table:
        return Decomposition(c=c, composants=(c,), structure=c)
    structure = feuille(c, ())
    return Decomposition(
        c=c,
        composants=tuple(composants),
        structure=structure,
        inconnus=tuple(dict.fromkeys(inconnus)),
        cycle=tuple(cycle),
        sources=tuple(sources),
    )


def index_ids(caracteres: Iterable[Mapping[str, object]]) -> dict[str, str]:
    """Indexe `caracteres.json` : caractère -> chaîne IDS de Make Me a Hanzi."""
    return {str(c["c"]): str(c.get("decomposition") or "") for c in caracteres}


def a_remplacer(ids: str, c: str) -> bool:
    """Vrai si l'IDS de Make Me a Hanzi ne dit rien d'exploitable sur `c`.

    Trois cas : IDS vide, IDS qui se réduit au caractère lui-même, et IDS qui
    porte le `？` de Make Me a Hanzi — fût-ce sur un seul opérande, car la
    descente s'y arrête et le caractère reste en écart.
    """
    return not ids or ids == c or INCONNU in ids


def combiner_ids(
    principaux: Mapping[str, str],
    secondaires: Mapping[str, str] | None = None,
) -> tuple[dict[str, str], dict[str, str]]:
    """Fusionne les deux sources d'IDS. Rend (IDS retenus, source de chaque IDS).

    La source secondaire ne sert que là où Make Me a Hanzi ne donne rien
    d'exploitable, et pour les caractères qu'il ignore — ceux que la descente
    rencontre sans pouvoir les ouvrir.
    """
    ids = dict(principaux)
    sources = {c: SOURCE_MMAH for c in principaux}
    for c, secondaire in (secondaires or {}).items():
        if c not in ids or a_remplacer(ids[c], c):
            ids[c] = secondaire
            sources[c] = SOURCE_SECONDAIRE
    return ids, sources


def reconcilier(
    caracteres: Iterable[Mapping[str, object]],
    table: TableGF0014,
    ids_secondaires: Mapping[str, str] | None = None,
) -> list[Decomposition]:
    """Décompose tous les caractères ingérés, dans l'ordre de la source."""
    principaux = index_ids(caracteres)
    ids, sources = combiner_ids(principaux, ids_secondaires)
    return [decomposer(c, table, ids, sources) for c in principaux]


# ------------------------------------------------------------------------- rapport


PRIORITAIRES = ("seuil-255", "hsk-1")


def nom_unicode(forme: str) -> str:
    """Nom Unicode du point de code, ou `—` s'il n'en a pas."""
    try:
        return unicodedata.name(forme)
    except (TypeError, ValueError):
        return "—"


def forme_de_radical(forme: str) -> bool:
    """Vrai si `forme` est un point de code des blocs de radicaux, non un idéogramme.

    Make Me a Hanzi écrit parfois un radical (⺼, ⺮) là où la norme donne
    l'idéogramme correspondant ou l'une de ses variantes de forme. Ces feuilles
    sont des écarts de notation, pas des composants absents de la norme.
    """
    return nom_unicode(forme).startswith(("CJK RADICAL", "KANGXI RADICAL"))


def forme_de_trait(forme: str) -> bool:
    """Vrai si `forme` est un point de code du bloc des traits (㇐, ㇑), non un idéogramme.

    L'IDS secondaire descend parfois jusqu'au trait isolé là où la norme donne
    l'idéogramme correspondant (一, 丨, 丶) : écart de notation, pas de contenu.
    """
    return nom_unicode(forme).startswith("CJK STROKE")


def _frequence_inconnus(decompositions: Sequence[Decomposition]) -> list[tuple[str, int]]:
    compte: dict[str, int] = {}
    for d in decompositions:
        for x in d.inconnus:
            compte[x] = compte.get(x, 0) + 1
    return sorted(compte.items(), key=lambda kv: (-kv[1], kv[0]))


def rapport_ecarts(
    decompositions: Sequence[Decomposition],
    table: TableGF0014,
    listes: Mapping[str, Sequence[str]],
) -> str:
    """Rapport Markdown : réconciliés, composants inconnus, listes prioritaires."""
    total = len(decompositions)
    par_caractere = {d.c: d for d in decompositions}
    ok = [d for d in decompositions if d.reconcilie]
    cycles = [d for d in decompositions if d.cycle]
    inconnus = _frequence_inconnus(decompositions)
    secondaire = [d for d in decompositions if SOURCE_SECONDAIRE in d.sources]

    part = f"{100 * len(ok) / total:.1f} %" if total else "—"
    lignes = [
        "# Écarts de réconciliation avec GF 0014-2009",
        "",
        "Produit par `uv run wenlu build`. Source des IDS : `dictionary.txt`",
        f"(Make Me a Hanzi), non canonique, avec `{SOURCE_SECONDAIRE}` en repli là où elle",
        f"donne `{INCONNU}` ou rien. Table : `data/sources/gf0014-2009/composants.tsv`.",
        "",
        "## Décompte",
        "",
        "| Mesure | Valeur |",
        "|---|---|",
        f"| Composants de la norme chargés | {len(table)} sur 514, {table.groupes} groupes |",
        f"| Caractères ingérés | {total} |",
        f"| Caractères réconciliés | {len(ok)} ({part}) |",
        f"| Caractères en écart | {total - len(ok)} |",
        f"| Composants inconnus distincts | {len(inconnus)} |",
        f"| Caractères avec cycle | {len(cycles)} |",
        f"| Caractères descendus avec l'IDS secondaire | {len(secondaire)}"
        f" ({sum(1 for d in secondaire if d.reconcilie)} réconciliés) |",
        "",
        "## Composants inconnus, par fréquence",
        "",
    ]
    if inconnus:
        lignes += ["| Composant | Caractères touchés | Point de code | Nom Unicode |", "|---|---|---|---|"]
        for forme, n in inconnus:
            point = f"U+{ord(forme):04X}" if len(forme) == 1 else "—"
            lignes.append(f"| `{forme}` | {n} | {point} | {nom_unicode(forme)} |")
    else:
        lignes.append("Aucun.")
    lignes.append("")

    radicaux = [f for f, _ in inconnus if forme_de_radical(f)]
    seuls_radicaux = [
        d for d in decompositions
        if d.inconnus and not d.cycle and all(forme_de_radical(x) for x in d.inconnus)
    ]
    traits = [f for f, _ in inconnus if forme_de_trait(f)]
    seuls_traits = [
        d for d in decompositions
        if d.inconnus and not d.cycle and all(forme_de_trait(x) for x in d.inconnus)
    ]
    inconnu_mmah = sum(1 for d in decompositions if INCONNU in d.inconnus)
    lignes += [
        "## Lecture",
        "",
        f"- `{INCONNU}` est la marque de Make Me a Hanzi pour un élément qu'il ne décompose"
        f" pas : {inconnu_mmah} caractères restent dessus. Aucune table ne peut les"
        " réconcilier : c'est le rôle de la source d'IDS secondaire, qui ne sert que là.",
        f"- {len(secondaire)} caractères ont été descendus avec un IDS de"
        f" `{SOURCE_SECONDAIRE}` (licence permissive), dont"
        f" {sum(1 for d in secondaire if d.reconcilie)} réconciliés. Les feuilles en"
        " sortent fiables, la structure moins : les codes de disposition de cette source"
        " sont plus fins que les douze opérateurs IDS. À relire avant publication.",
        f"- {len(radicaux)} composants inconnus sont des points de code des blocs de"
        f" radicaux ({' '.join(radicaux)}) là où la norme donne l'idéogramme ou l'une de"
        f" ses variantes : écart de notation, pas de contenu. Les normaliser réconcilierait"
        f" {len(seuls_radicaux)} caractères de plus.",
        f"- {len(traits)} composants inconnus sont des points de code de traits"
        f" ({' '.join(traits)}), apportés par l'IDS secondaire là où la norme donne"
        f" l'idéogramme (一, 丨, 丶) : même écart de notation. Les normaliser réconcilierait"
        f" {len(seuls_traits)} caractères de plus.",
        "- Les autres composants inconnus sont des idéogrammes absents de la norme, qui ne"
        " couvre que les 3 500 caractères usuels de l'écriture simplifiée : attendu sur le"
        " reste du dictionnaire.",
        "- 30 des 514 composants n'ont pas de point de code Unicode et ne peuvent donc"
        " jamais être appariés à une feuille IDS. Le composant 北字旁 (⿰二丨) en fait"
        " partie, d'où l'écart sur 北.",
        "",
    ]

    lignes += ["## Cycles", ""]
    if cycles:
        lignes += ["| Caractère | Chemin |", "|---|---|"]
        lignes += [f"| {d.c} | {' → '.join(d.cycle)} |" for d in cycles]
    else:
        lignes.append("Aucun.")
    lignes.append("")

    lignes += ["## Listes prioritaires", ""]
    for nom in PRIORITAIRES:
        caracteres = list(listes.get(nom, []))
        lignes.append(f"### {nom}")
        lignes.append("")
        if not caracteres:
            lignes += ["Liste vide : rien à contrôler.", ""]
            continue
        absents = [c for c in caracteres if c not in par_caractere]
        manques = [par_caractere[c] for c in caracteres if c in par_caractere and not par_caractere[c].reconcilie]
        lignes.append(
            f"{len(caracteres) - len(absents) - len(manques)} réconciliés sur {len(caracteres)}"
            f" ({len(absents)} absents de la source, {len(manques)} en écart)."
        )
        lignes.append("")
        repris = [
            c
            for c in caracteres
            if c in par_caractere
            and par_caractere[c].reconcilie
            and SOURCE_SECONDAIRE in par_caractere[c].sources
        ]
        if repris:
            lignes += [
                f"Réconciliés grâce à l'IDS secondaire, à relire : {' '.join(repris)}",
                "",
            ]
        if manques:
            lignes += ["| Caractère | Composants | Inconnus | Cycle |", "|---|---|---|---|"]
            for d in manques:
                lignes.append(
                    f"| {d.c} | {' '.join(d.composants)} | {' '.join(d.inconnus)} | {' → '.join(d.cycle)} |"
                )
            lignes.append("")
        if absents:
            lignes += [f"Absents de `caracteres.json` : {' '.join(absents)}", ""]
    return "\n".join(lignes).rstrip() + "\n"


# --------------------------------------------------------------------------- build


IDS_SECONDAIRES = "ids-secondaires.json"


def charger_ids_secondaires(ingest: Path) -> dict[str, str]:
    """Charge `ids-secondaires.json` s'il existe, sinon rend un dictionnaire vide."""
    fichier = ingest / IDS_SECONDAIRES
    if not fichier.exists():
        return {}
    document = json.loads(fichier.read_text(encoding="utf-8"))
    return {str(c): str(ids) for c, ids in document.get("ids", {}).items()}


def document_decompositions(
    decompositions: Sequence[Decomposition],
    table: TableGF0014,
) -> dict[str, object]:
    """Contenu de `decompositions.json` (voir data/schema.md)."""
    return {
        "norme": "GF 0014-2009",
        "table": {
            "fichier": "data/sources/gf0014-2009/composants.tsv",
            "composants": len(table),
            "groupes": table.groupes,
        },
        "source_ids": "Make Me a Hanzi, dictionary.txt (non canonique)",
        "source_ids_secondaire": (
            f"{SOURCE_SECONDAIRE} (IDS de repli quand Make Me a Hanzi donne ？ ou rien)"
        ),
        "caracteres": [
            {
                "c": d.c,
                "composants": list(d.composants),
                "structure": d.structure,
                "reconcilie": d.reconcilie,
                "inconnus": list(d.inconnus),
                "cycle": list(d.cycle),
                "sources": list(d.sources),
            }
            for d in decompositions
        ],
    }


def build(
    ingest: Path | None = None,
    sortie: Path | None = None,
    table: TableGF0014 | None = None,
) -> dict[str, object]:
    """Réconcilie toutes les décompositions et écrit decompositions.json et ecarts.md."""
    ingest = ingest or INGEST
    sortie = sortie or BUILD
    table = table or charger_table()

    caracteres = json.loads((ingest / "caracteres.json").read_text(encoding="utf-8"))
    fichier_listes = ingest / "listes.json"
    listes = json.loads(fichier_listes.read_text(encoding="utf-8")) if fichier_listes.exists() else {}
    secondaires = charger_ids_secondaires(ingest)

    decompositions = reconcilier(caracteres, table, secondaires)
    sortie.mkdir(parents=True, exist_ok=True)
    ecrire_json(sortie / "decompositions.json", document_decompositions(decompositions, table))
    (sortie / "ecarts.md").write_text(rapport_ecarts(decompositions, table, listes), encoding="utf-8")

    ok = sum(1 for d in decompositions if d.reconcilie)
    rapport: dict[str, object] = {
        "composants": f"{len(table)} sur 514",
        "groupes": table.groupes,
        "caracteres": len(decompositions),
        "reconcilies": ok,
        "en_ecart": len(decompositions) - ok,
        "composants_inconnus": len(_frequence_inconnus(decompositions)),
        "cycles": sum(1 for d in decompositions if d.cycle),
        "ids_secondaires": len(secondaires) or f"source absente ({IDS_SECONDAIRES})",
        "reconcilies_via_secondaire": sum(
            1 for d in decompositions if d.reconcilie and SOURCE_SECONDAIRE in d.sources
        ),
    }
    for nom in PRIORITAIRES:
        attendus = listes.get(nom, [])
        connus = {d.c: d for d in decompositions}
        rapport[f"{nom}_non_reconcilies"] = sum(
            1 for c in attendus if c not in connus or not connus[c].reconcilie
        )
    return rapport


# --------------------------------------------------------------------------- check


@dataclass(frozen=True)
class Controle:
    """Résultat d'un contrôle qualité. `bloquant` fait échouer `wenlu check`."""

    nom: str
    ok: bool
    detail: str
    bloquant: bool = False


def controles(sortie: Path | None = None) -> list[Controle]:
    """Contrôles « composants inconnus » et « cycles » sur le résultat de build.

    Un cycle est un défaut de données, donc bloquant. Un composant inconnu est
    attendu hors des 3 500 caractères de la norme : signalé, non bloquant.
    """
    sortie = sortie or BUILD
    fichier = sortie / "decompositions.json"
    if not fichier.exists():
        return [Controle("décompositions", False, f"{fichier} absent : lancer `wenlu build`", True)]

    document = json.loads(fichier.read_text(encoding="utf-8"))
    caracteres = document["caracteres"]
    compte: dict[str, int] = {}
    for c in caracteres:
        for x in c["inconnus"]:
            compte[x] = compte.get(x, 0) + 1
    cycles = [c for c in caracteres if c["cycle"]]
    en_ecart = [c for c in caracteres if not c["reconcilie"]]
    # Même tri que `_frequence_inconnus` : la forme départage les ex æquo, sinon
    # deux passages sur les mêmes données n'affichent pas la même liste.
    pires = ", ".join(
        f"{forme} ({n})" for forme, n in sorted(compte.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
    )
    return [
        Controle(
            "composants inconnus",
            not compte,
            f"{len(compte)} composants hors norme sur {len(en_ecart)} caractères"
            + (f" ; les plus fréquents : {pires}" if pires else ""),
        ),
        Controle(
            "cycles",
            not cycles,
            f"{len(cycles)} caractères dont la décomposition boucle"
            + (f" : {' '.join(c['c'] for c in cycles[:10])}" if cycles else ""),
            bloquant=True,
        ),
    ]
