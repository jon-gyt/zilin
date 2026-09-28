"""Licence des décompositions : ce que l'export embarque, caractère par caractère.

Décision du 28 septembre 2026 (`docs/sources-licences.md` §10) : la décomposition
exportée (`parts` de chaque fiche) ne descend plus Make Me a Hanzi (`dictionary.txt`,
LGPL 3.0+). Elle descend nos surcharges (`data/sources/surcharges/ids.tsv`, rédigées
pour Wenlu d'après la table de GF 0014-2009), puis cjk-decomp (MIT). BabelStone,
cjkvi-ids et CHISE sont écartés (lignée CHISE, GPL).

`uv run wenlu licences` en fait la recette. Elle relit :

- l'export versionné (`app/public/data/<version>/familles/*.json`), qui dit pour chaque
  caractère ses `parts` et les sources d'IDS descendues (`sources`) ;
- `decompositions.json` et `graphe.json` de `wenlu build`, pour la structure et le genre ;
- les IDS de cjk-decomp (`ids-secondaires.json` de `wenlu ingest`), les surcharges et la
  table de notation (`notation-candidats.tsv`).

Pour chaque caractère exporté, elle redescend la décomposition avec la chaîne retenue —
surcharges devant cjk-decomp, comme `wenlu build` — et la compare aux `parts` exportés :
tout doit être identique. Elle la redescend aussi sans la ligne de surcharge du
caractère, pour dire ce que chaque ligne porte (une ligne dont cjk-decomp rend déjà la
même décomposition est superflue). Elle dresse enfin la liste de ce que le projet doit
encore à Make Me a Hanzi, embarqué (les tracés, sous APL) ou non (contrôles).

Sorties : `data/work/build/licences.json` (tout, par caractère) et, versionné,
`docs/licences-decompositions.md`. Deux passages sur les mêmes entrées écrivent les
mêmes octets (aucune date d'horloge ; les sources sont identifiées par leur empreinte).

`controles` (dans `wenlu check`) est bloquant : aucune décomposition exportée ne doit
nommer `makemeahanzi`, ni une source hors de cjk-decomp et des surcharges.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from . import cjkdecomp
from .gf0014 import (
    OPERATEURS_IDS,
    SOURCE_MMAH,
    Controle,
    TableGF0014,
    charger_ids_secondaires,
    charger_notation,
    charger_table,
    decomposer,
    noter,
)
from .graphe import BRIQUE, DECOUPEE
from .outils import ecrire_json, empreinte_fichier
from .paths import BUILD, DATA, EXPORT, INGEST
from .surcharges import IDS, SOURCE_SURCHARGE, charger_ids

#: Le fichier de recette, versionné.
DOCUMENT = DATA.parent / "docs" / "licences-decompositions.md"

CJK_DECOMP = cjkdecomp.SOURCE
#: Les seules sources d'IDS qu'une décomposition exportée peut nommer.
SOURCES_PERMISES = (SOURCE_SURCHARGE, CJK_DECOMP)

#: Mêmes points de code, même ordre : la décomposition exportée ne bouge pas.
IDENTIQUE = "identique"
#: Mêmes composants de la norme, un point de code de notation en plus ou en moins (⺮, 𥫗).
EQUIVALENT = "equivalent"
#: Même groupe de la norme à chaque place, une autre variante de forme (王 et 𤣩 斜玉).
VARIANTE = "variante"
ORDRE_DIFFERENT = "ordre"
DIFFERENT = "different"
NON_RECONCILIE = "non_reconcilie"
ABSENT = "absent"
VERDICTS = (IDENTIQUE, EQUIVALENT, VARIANTE, ORDRE_DIFFERENT, DIFFERENT, NON_RECONCILIE, ABSENT)
#: Les verdicts qui laissent `parts` tel quel à l'export.
CONSERVES = (IDENTIQUE, EQUIVALENT)


# ----------------------------------------------------------------------- inventaire


@dataclass(frozen=True)
class Exporte:
    """Un caractère de l'export : ce que dit sa fiche."""

    c: str
    racine: str
    parts: tuple[str, ...]
    sources: tuple[str, ...]


def lire_export(dossier: Path) -> dict[str, Exporte]:
    """Les fiches de `familles/*.json` d'une version exportée, par caractère."""
    exportes: dict[str, Exporte] = {}
    for chemin in sorted((dossier / "familles").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        racine = str(document["racine"]["c"])
        for f in document["fiches"]:
            exportes[str(f["c"])] = Exporte(
                c=str(f["c"]),
                racine=racine,
                parts=tuple(str(p) for p in f.get("parts") or ()),
                sources=tuple(str(s) for s in f.get("sources") or ()),
            )
    return exportes


def derniere_version(export: Path | None = None) -> Path | None:
    """Le dossier de la version exportée la plus récente (tri des numéros), ou None."""
    export = export or EXPORT
    versions = [
        d for d in export.iterdir() if d.is_dir() and re.fullmatch(r"\d+\.\d+\.\d+", d.name)
    ] if export.exists() else []
    if not versions:
        return None
    return max(versions, key=lambda d: tuple(int(x) for x in d.name.split(".")))


@dataclass(frozen=True)
class Mesure:
    """Ce qu'une chaîne d'IDS rend pour un caractère.

    `meme_tete` : l'opérateur de tête de la structure est celui du build — c'est lui que
    les devinettes lisent (la disposition des briques).
    """

    verdict: str
    composants: tuple[str, ...] = ()
    structure: str = ""
    meme_tete: bool = False


def _tete(structure: str) -> str:
    return structure[:1] if structure[:1] in OPERATEURS_IDS else ""


def mesurer(
    c: str,
    parts: Sequence[str],
    table: TableGF0014,
    ids: Mapping[str, str],
    surcharges: Mapping[str, str],
    structure: str = "",
) -> Mesure:
    """Descend `c` avec `ids` (surcharges devant) et compare à `parts`.

    La comparaison se fait à trois niveaux : le point de code, le composant de la
    norme (numéro d'ordre, équivalences comprises), le groupe de la norme.
    """
    if c not in ids and c not in surcharges:
        return Mesure(ABSENT)
    d = decomposer(c, table, {**ids, **surcharges})
    composants = d.composants
    tete = bool(structure) and _tete(d.structure) == _tete(structure)

    def mesure(verdict: str) -> Mesure:
        return Mesure(verdict, composants, d.structure, tete)

    if not d.reconcilie and tuple(parts) != composants:
        return mesure(NON_RECONCILIE)
    attendus = tuple(parts)
    if composants == attendus:
        return mesure(IDENTIQUE)
    if all(x in table for x in attendus) and len(composants) == len(attendus):
        if [table[x].sequence for x in composants] == [table[x].sequence for x in attendus]:
            return mesure(EQUIVALENT)
        if [table[x].groupe for x in composants] == [table[x].groupe for x in attendus]:
            return mesure(VARIANTE)
    if sorted(composants) == sorted(attendus):
        return mesure(ORDRE_DIFFERENT)
    return mesure(DIFFERENT)


@dataclass(frozen=True)
class Ligne:
    """Un caractère exporté : sa décomposition, sa licence, et la recette.

    `chaine` : la chaîne retenue (surcharges > cjk-decomp) ; `sans_ligne` : la même sans
    la ligne de surcharge du caractère, nulle quand il n'en a pas.
    """

    c: str
    genre: str
    parts: tuple[str, ...]
    sources: tuple[str, ...]
    structure: str
    motifs: tuple[str, ...]
    chaine: Mesure | None = None
    sans_ligne: Mesure | None = None
    surcharge: str = ""

    @property
    def brique(self) -> bool:
        """Une brique (ou une feuille découpée) est un composant de la norme : rien à descendre."""
        return not self.parts

    @property
    def lgpl(self) -> bool:
        """Vrai si la décomposition exportée nomme encore Make Me a Hanzi (LGPL)."""
        return SOURCE_MMAH in self.sources

    @property
    def regime(self) -> str:
        """La licence dont relève `parts`, en clair."""
        if self.brique:
            return "GF 0014-2009 seule"
        if self.lgpl:
            return "LGPL (Make Me a Hanzi)"
        if set(self.sources) == {SOURCE_SURCHARGE}:
            return "nos surcharges"
        if set(self.sources) == {CJK_DECOMP}:
            return "cjk-decomp (MIT)"
        return "cjk-decomp (MIT) et nos surcharges"

    @property
    def conforme(self) -> bool:
        """La chaîne retenue redonne les `parts` exportés, et la structure du build."""
        return self.brique or (
            self.chaine is not None
            and self.chaine.verdict == IDENTIQUE
            and self.chaine.structure == self.structure
        )


def inventorier(
    exportes: Mapping[str, Exporte],
    decompositions: Mapping[str, Mapping[str, object]],
    genres: Mapping[str, str],
    motifs: Mapping[str, Sequence[str]],
    table: TableGF0014,
    cjk: Mapping[str, str],
    surcharges: Mapping[str, str],
) -> list[Ligne]:
    """Une ligne par caractère exporté, triée par caractère. `cjk` : IDS déjà notés."""
    lignes: list[Ligne] = []
    for c in sorted(exportes):
        e = exportes[c]
        structure = str((decompositions.get(c) or {}).get("structure") or c)
        chaine = sans_ligne = None
        if e.parts:
            chaine = mesurer(c, e.parts, table, cjk, surcharges, structure)
            if c in surcharges:
                autres = {k: v for k, v in surcharges.items() if k != c}
                sans_ligne = mesurer(c, e.parts, table, cjk, autres, structure)
        lignes.append(
            Ligne(
                c=c,
                genre=genres.get(c, ""),
                parts=e.parts,
                sources=e.sources,
                structure=structure,
                motifs=tuple(motifs.get(c) or ()),
                chaine=chaine,
                sans_ligne=sans_ligne,
                surcharge=surcharges.get(c, ""),
            )
        )
    return lignes


def superflue(ligne: Ligne) -> bool:
    """Une ligne de surcharge dont cjk-decomp rend déjà la même décomposition et structure."""
    m = ligne.sans_ligne
    return m is not None and m.verdict == IDENTIQUE and m.structure == ligne.structure


# --------------------------------------------------------------- autres emprunts


@dataclass(frozen=True)
class Emprunt:
    """Un usage de Make Me a Hanzi dans ce que l'app embarque ou dans son pipeline."""

    quoi: str
    source: str
    licence: str
    embarque: bool
    detail: str


def emprunts_mmah(
    version: Path,
    exportes: Mapping[str, Exporte],
    genres: Mapping[str, str],
    ingest: Path | None = None,
    racine_app: Path | None = None,
) -> list[Emprunt]:
    """Tout ce que le projet tient encore de Make Me a Hanzi."""
    ingest = ingest or INGEST
    racine_app = racine_app or (DATA.parent / "app")
    traits = sorted((version / "traits").glob("*.json"))
    n_traits = 0
    for chemin in traits:
        document = json.loads(chemin.read_text(encoding="utf-8"))
        n_traits += len(document.get("traits") or {})
    decoupes: set[str] = set()
    modifications = version / "traits" / "MODIFICATIONS.md"
    if modifications.exists():
        texte = modifications.read_text(encoding="utf-8")
        decoupes = {c for c in exportes if genres.get(c) == DECOUPEE and c in texte}
    demo = racine_app / "public" / "strokes-demo.json"
    n_demo, entete_demo = 0, False
    if demo.exists():
        brut = json.loads(demo.read_text(encoding="utf-8"))
        entete_demo = isinstance(brut, dict) and "license" in brut
        table = brut.get("traits", brut) if isinstance(brut, dict) else {}
        n_demo = sum(1 for v in table.values() if isinstance(v, dict) and "s" in v)
    briques = sum(1 for c, g in genres.items() if c in exportes and g == BRIQUE)
    indices = 0
    fichier = ingest / "caracteres.json"
    if fichier.exists():
        for entree in json.loads(fichier.read_text(encoding="utf-8")):
            etym = entree.get("etymologie") or {}
            if str(entree.get("c")) in exportes and isinstance(etym, dict) and (
                etym.get("phonetic") or etym.get("semantic") or etym.get("hint")
            ):
                indices += 1
    # Le pinyin exporté vient d'Unihan ou de `pinyin.tsv` ; sans eux, de la fiche relue,
    # dont le contexte donnait celui de Make Me a Hanzi.
    replis: list[str] = []
    fichier_unihan = ingest / "unihan.json"
    if fichier_unihan.exists():
        from .surcharges import charger_pinyin

        lus = {
            str(e["c"])
            for e in json.loads(fichier_unihan.read_text(encoding="utf-8"))["caracteres"]
            if e.get("pinyin")
        } | set(charger_pinyin())
        for chemin in sorted((version / "familles").glob("*.json")):
            for f in json.loads(chemin.read_text(encoding="utf-8"))["fiches"]:
                if f.get("pinyin") and str(f["c"]) not in lus:
                    replis.append(f"{f['c']} {f['pinyin']}")
    lgpl = sorted(c for c, e in exportes.items() if e.parts and SOURCE_MMAH in e.sources)
    return [
        Emprunt(
            "décomposition (`parts`, `sources`)",
            "dictionary.txt (chaîne IDS)",
            "LGPL 3.0+",
            bool(lgpl),
            f"{len(lgpl)} caractères exportés" + (f" : {''.join(lgpl)}" if lgpl else " : plus aucun")
            + " ; `dictionary.txt` n'est plus lu par `wenlu build`, son IDS n'est plus ingéré",
        ),
        Emprunt(
            "pinyin de repli d'une fiche relue (hors Unihan et `pinyin.tsv`)",
            "dictionary.txt (`pinyin`), par le contexte de la fiche",
            "fait, non protégeable",
            bool(replis),
            f"{len(replis)} caractères" + (f" : {', '.join(sorted(replis))}" if replis else ""),
        ),
        Emprunt(
            "tracés et médianes (`traits/`)",
            "graphics.txt",
            "Arphic Public License",
            True,
            f"{n_traits} caractères dans {len(traits)} fichiers, dont {len(decoupes)} composants"
            " découpés dans un hôte (glyphes modifiés, `MODIFICATIONS.md`)",
        ),
        Emprunt(
            "tracés de repli (`app/public/strokes-demo.json`)",
            "graphics.txt",
            "Arphic Public License",
            True,
            f"{n_demo} caractères, "
            + ("avec en-tête de licence" if entete_demo else "**sans en-tête de licence** (APL §2 a)"),
        ),
        Emprunt(
            "marque et icônes (`app/public/icons/`)",
            "graphics.txt (文)",
            "Arphic Public License",
            True,
            "tracés de 文 recopiés par `app/scripts/icons.mjs`, mention en commentaire du SVG",
        ),
        Emprunt(
            "univers du graphe et genre `brique` (composant dessiné)",
            "graphics.txt (liste des caractères)",
            "fait, non protégeable",
            False,
            f"{briques} briques exportées ; seule la présence du caractère est lue",
        ),
        Emprunt(
            "ordre des parcours",
            "`data/sources/parcours/ordre-*.tsv`, figé le 28 septembre 2026",
            "nôtre",
            False,
            "l'ordre de la 0.1.0, alors compté sur les décompositions de `dictionary.txt`"
            " (un décompte de dépendants, pas une reprise), désormais versionné et relu",
        ),
        Emprunt(
            "contexte des fiches : rôle probable, type et indice d'étymologie",
            "dictionary.txt (`etymology`)",
            "LGPL 3.0+",
            False,
            f"{indices} caractères exportés en ont un ; donnés au rédacteur comme indices à"
            " vérifier, jamais recopiés ; seuls les rôles relus entrent dans l'export",
        ),
        Emprunt(
            "contrôle du pinyin de la cuisine",
            "dictionary.txt (`pinyin`)",
            "LGPL 3.0+",
            False,
            "contrôle seulement ; le pinyin exporté vient d'Unihan et des surcharges",
        ),
    ]


# -------------------------------------------------------------------------- motifs


def motifs_export(listes: Mapping[str, Sequence[str]]) -> dict[str, list[str]]:
    """Pourquoi chaque caractère entre dans l'export (hors briques des précédents)."""
    from . import export as export_mod
    from . import fetes as fetes_mod
    from . import saisons as saisons_mod

    motifs: dict[str, list[str]] = {}

    def ajouter(caracteres: Iterable[str], motif: str) -> None:
        for c in caracteres:
            if motif not in motifs.setdefault(c, []):
                motifs[c].append(motif)

    for nom in export_mod.LISTES_CIBLES:
        ajouter(listes.get(nom, ()), nom)
    ajouter(fetes_mod.caracteres_dessines(fetes_mod.charger_textes()), "fête")
    ajouter(saisons_mod.caracteres_dessines(saisons_mod.charger_textes()), "terme")
    ajouter(export_mod.caracteres_interface(), "interface")
    ajouter(export_mod.caracteres_heros(), "rang")
    ajouter(export_mod.caracteres_expliques_des_contes(), "conte")
    return motifs


# --------------------------------------------------------------------------- rendu


def _cellule(mesure: Mesure | None) -> str:
    if mesure is None:
        return "·"
    if mesure.verdict == IDENTIQUE:
        return "="
    if mesure.verdict == ABSENT:
        return "absent"
    prefixe = {
        EQUIVALENT: "≡",
        VARIANTE: "variante :",
        ORDRE_DIFFERENT: "ordre :",
        NON_RECONCILIE: "écart :",
    }.get(mesure.verdict, "≠")
    return f"{prefixe} {' '.join(mesure.composants)}"


def rendre(
    lignes: Sequence[Ligne],
    fichiers: Sequence[tuple[str, str]],
    emprunts: Sequence[Emprunt],
    version: str,
) -> str:
    """Le fichier de recette, en Markdown : décompte, puis caractère par caractère."""
    decomposes = [l for l in lignes if not l.brique]
    briques = [l for l in lignes if l.brique]
    regimes: dict[str, int] = {}
    for l in decomposes:
        regimes[l.regime] = regimes.get(l.regime, 0) + 1
    non_conformes = [l.c for l in decomposes if not l.conforme]
    portees = [l for l in decomposes if l.surcharge]
    superflues = [l.c for l in portees if superflue(l)]
    sortie = [
        "# Licence des décompositions, caractère par caractère",
        "",
        "Produit par `uv run wenlu licences` (`data/src/wenlu_data/licences.py`) ; ne pas"
        " modifier à la main. La décision et son historique sont dans"
        " `docs/sources-licences.md` §10 ; ce fichier en est la recette.",
        "",
        f"Version exportée relue : `{version}`. Chaîne de la décomposition : nos surcharges"
        " (`data/sources/surcharges/ids.tsv`, rédigées pour Wenlu d'après GF 0014-2009),"
        " puis cjk-decomp (MIT), formes de notation ramenées à la norme"
        " (`notation-candidats.tsv`). Make Me a Hanzi (`dictionary.txt`, LGPL) n'en fait"
        " plus partie.",
        "",
        "## Sources lues",
        "",
        "| Fichier | SHA-256 |",
        "|---|---|",
        *[f"| `{n}` | `{h[:16]}…` |" for n, h in fichiers],
        "",
        "## Décompte",
        "",
        f"- {len(lignes)} caractères exportés, dont {len(briques)} composants de la norme"
        " (briques et feuilles découpées : `parts` vide, rien à décomposer, GF 0014-2009"
        f" seule) et {len(decomposes)} caractères décomposés.",
        "- Source de la décomposition, sur ces derniers :",
        *[f"  - {r} : {n}" for r, n in sorted(regimes.items(), key=lambda kv: (-kv[1], kv[0]))],
        f"- Décompositions qui nomment encore `dictionary.txt` (LGPL) :"
        f" {sum(1 for l in decomposes if l.lgpl)}.",
        f"- Recette : la chaîne redonne les `parts` exportés et la structure du build pour"
        f" {len(decomposes) - len(non_conformes)} caractères sur {len(decomposes)}"
        + (f" ; écarts : {' '.join(non_conformes)}." if non_conformes else "."),
        f"- Lignes de surcharge qui portent un caractère exporté : {len(portees)}"
        + (f" ; dont superflues (cjk-decomp rend déjà la même chose) : {' '.join(superflues)}."
           if superflues else " ; aucune superflue."),
        "",
        "## Autres emprunts à Make Me a Hanzi",
        "",
        "| Quoi | Source | Licence | Embarqué | Détail |",
        "|---|---|---|---|---|",
    ]
    for e in emprunts:
        sortie.append(
            f"| {e.quoi} | {e.source} | {e.licence} | {'oui' if e.embarque else 'non'} | {e.detail} |"
        )
    sortie += [
        "",
        "## Composants de la norme (rien à décomposer)",
        "",
        f"{len(briques)} caractères : leur `parts` est vide, la table GF 0014-2009 seule les"
        " définit. Seuls leurs tracés viennent de Make Me a Hanzi (`graphics.txt`, APL).",
        "",
        " ".join(l.c for l in briques),
        "",
        "## Caractères décomposés",
        "",
        "Lecture : `=` identique aux `parts` exportés ; `≡` mêmes composants de la norme,"
        " autre point de code ; `variante :` même groupe de la norme à chaque place ;"
        " `ordre :` mêmes composants, autre ordre ; `≠` composants différents ; `écart :`"
        " feuille hors norme ; `absent` : la source ne décrit pas le caractère. « Sans sa"
        " ligne » : cjk-decomp à la place de la surcharge du caractère (les autres lignes"
        " restent) — ce que la ligne corrige ; `·` : pas de ligne.",
        "",
        "| Caractère | Motif | `parts` exportés | `sources` | Chaîne | Sans sa ligne |",
        "|---|---|---|---|---|---|",
    ]
    for l in decomposes:
        motif = ", ".join(l.motifs) or "brique d'un autre"
        sortie.append(
            f"| {l.c} | {motif} | {' '.join(l.parts)} | {', '.join(l.sources)}"
            f" | {_cellule(l.chaine)} | {_cellule(l.sans_ligne)} |"
        )
    return "\n".join(sortie).rstrip() + "\n"


def document_json(lignes: Sequence[Ligne], fichiers: Sequence[tuple[str, str]]) -> dict[str, object]:
    """Contenu de `licences.json`."""

    def mesure(m: Mesure | None) -> dict[str, object] | None:
        if m is None:
            return None
        return {
            "verdict": m.verdict,
            "composants": list(m.composants),
            "structure": m.structure,
            "meme_tete": m.meme_tete,
        }

    return {
        "fichiers": [list(f) for f in fichiers],
        "caracteres": [
            {
                "c": l.c,
                "genre": l.genre,
                "motifs": list(l.motifs),
                "parts": list(l.parts),
                "sources": list(l.sources),
                "structure": l.structure,
                "regime": l.regime,
                "conforme": l.conforme,
                "surcharge": l.surcharge,
                "chaine": mesure(l.chaine),
                "sans_ligne": mesure(l.sans_ligne),
            }
            for l in lignes
        ],
    }


# --------------------------------------------------------------------------- build


class InventaireImpossible(RuntimeError):
    """Il manque l'export, le build ou l'ingestion."""


def licences(
    *,
    version: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    document: Path | None = None,
) -> dict[str, object]:
    """Écrit `licences.json` et le fichier de recette. Rend un rapport court."""
    build = build or BUILD
    ingest = ingest or INGEST
    document = document or DOCUMENT
    version = version or derniere_version()
    if version is None or not (version / "familles").exists():
        raise InventaireImpossible("aucune version exportée : lancer `wenlu export`")
    for requis in (build / "decompositions.json", build / "graphe.json"):
        if not requis.exists():
            raise InventaireImpossible(f"{requis} absent : lancer `wenlu build`")
    for requis in (ingest / "listes.json", ingest / "ids-secondaires.json"):
        if not requis.exists():
            raise InventaireImpossible(f"{requis} absent : lancer `wenlu ingest`")

    exportes = lire_export(version)
    decompositions = {
        str(d["c"]): d
        for d in json.loads((build / "decompositions.json").read_text(encoding="utf-8"))["caracteres"]
    }
    genres = {
        str(n["c"]): str(n["genre"])
        for n in json.loads((build / "graphe.json").read_text(encoding="utf-8"))["noeuds"]
    }
    listes = json.loads((ingest / "listes.json").read_text(encoding="utf-8"))
    table = charger_table()
    cjk = noter(charger_ids_secondaires(ingest), charger_notation(table))
    surcharges = charger_ids()
    fichiers = [
        ("ids-secondaires.json (cjk-decomp)", empreinte_fichier(ingest / "ids-secondaires.json")),
        ("ids.tsv (surcharges)", empreinte_fichier(IDS) if IDS.exists() else "-" * 16),
    ]
    lignes = inventorier(exportes, decompositions, genres, motifs_export(listes), table, cjk, surcharges)
    emprunts = emprunts_mmah(version, exportes, genres, ingest)
    ecrire_json(build / "licences.json", document_json(lignes, fichiers))
    document.parent.mkdir(parents=True, exist_ok=True)
    document.write_text(rendre(lignes, fichiers, emprunts, version.name), encoding="utf-8")

    decomposes = [l for l in lignes if not l.brique]
    regimes: dict[str, int] = {}
    for l in decomposes:
        regimes[l.regime] = regimes.get(l.regime, 0) + 1
    return {
        "caracteres": len(lignes),
        "briques": len(lignes) - len(decomposes),
        "decomposes": len(decomposes),
        **{f"source : {r}": n for r, n in sorted(regimes.items())},
        "lgpl": sum(1 for l in decomposes if l.lgpl),
        "conformes": sum(1 for l in decomposes if l.conforme),
        "surcharges_superflues": " ".join(l.c for l in decomposes if superflue(l)) or "aucune",
        "document": str(document),
    }


# --------------------------------------------------------------------------- check


NOM_CONTROLE = "licences : décompositions"


def controles(export: Path | None = None) -> list[Controle]:
    """Bloquant : aucune décomposition exportée ne descend `dictionary.txt` (LGPL).

    Relit l'export versionné — la CI l'a, sans `wenlu ingest`. Chaque caractère décomposé
    doit nommer ses sources, et seulement cjk-decomp ou nos surcharges.
    """
    version = derniere_version(export)
    if version is None:
        return [Controle(NOM_CONTROLE, True, "aucune version exportée")]
    exportes = lire_export(version)
    decomposes = [e for e in exportes.values() if e.parts]
    lgpl = sorted(e.c for e in decomposes if SOURCE_MMAH in e.sources)
    hors = sorted(
        e.c for e in decomposes if not e.sources or not set(e.sources) <= set(SOURCES_PERMISES)
    )
    compte = {
        s: sum(1 for e in decomposes if s in e.sources) for s in SOURCES_PERMISES
    }
    detail = (
        f"{version.name} : {len(decomposes)} décompositions, {len(lgpl)} de dictionary.txt (LGPL) ;"
        f" {compte[CJK_DECOMP]} descendent cjk-decomp (MIT), {compte[SOURCE_SURCHARGE]} nos surcharges"
    )
    if lgpl:
        detail += " ; LGPL : " + "".join(lgpl[:20]) + ("…" if len(lgpl) > 20 else "")
    if hors:
        detail += " ; source absente ou inconnue : " + "".join(hors[:20]) + ("…" if len(hors) > 20 else "")
    return [Controle(NOM_CONTROLE, not lgpl and not hors, detail, bloquant=True)]
