"""Licence des décompositions : inventaire par caractère et sources de remplacement.

`uv run wenlu licences` répond à la question laissée ouverte par
`docs/sources-licences.md` §2.2 : la décomposition exportée descend la chaîne IDS de
Make Me a Hanzi (`dictionary.txt`, LGPL 3.0+), que la décision écarte de l'embarqué.
La commande ne change rien à ce qui est exporté. Elle relit :

- l'export versionné (`app/public/data/<version>/familles/*.json`), qui dit pour chaque
  caractère ses `parts` et la source de l'IDS descendu (`sources`) ;
- `decompositions.json` et `graphe.json` de `wenlu build`, pour la structure et le genre ;
- les sources candidates, téléchargées à part dans `data/work/sources/candidats/`
  (`--telecharger`, idempotent, empreintes et journal comme `wenlu fetch`) ;
- `Unihan.zip`, déjà téléchargé par `wenlu fetch`, pour y chercher un champ `kIDS`.

Pour chaque caractère exporté, elle redescend la décomposition GF 0014-2009 avec chaque
candidat à la place de Make Me a Hanzi — les surcharges versionnées
(`data/sources/surcharges/ids.tsv`, rédigées pour le projet) passant toujours devant,
comme dans `wenlu build` — et compare les composants obtenus aux `parts` exportés :
identiques, identiques à la notation près, autre variante du même groupe de la norme,
mêmes composants dans un autre ordre, différents, non réconciliés, ou absents. Les
formes de notation des candidats hors de la table (⺹, 㐅…) sont d'abord ramenées au
composant de la norme (`data/sources/surcharges/notation-candidats.tsv`).

Elle rejoue enfin la réconciliation, le graphe et les parcours de bout en bout avec la
chaîne proposée (`simuler`), à côté du vrai build : un témoin (la chaîne d'aujourd'hui
rejouée) doit redonner le build à l'identique, et les autres scénarios disent à partir
de quel jour chaque parcours changerait.

Sorties : `data/work/build/licences.json` (tout, par caractère) et, versionné,
`docs/licences-decompositions.md` : le fichier de décision, caractère par caractère.
Deux passages sur les mêmes entrées écrivent les mêmes octets (aucune date d'horloge ;
les sources sont identifiées par leur empreinte).

Candidats, licence lue sur la source primaire (voir `docs/sources-licences.md` §10) :

- BabelStone IDS (`IDS.TXT`, Andrew West) : l'en-tête du fichier renonce à tout droit
  et autorise l'usage commercial sans attribution. `babelstone.co.uk` étant bloqué par le
  proxy de sortie, le fichier vient de deux miroirs GitHub indépendants, identiques octet
  pour octet ; l'en-tête `Maintained by: Andrew West` est exigé.
- cjk-decomp : déjà la source de repli du pipeline (MIT au choix).
- Unihan `kIDS` : cherché dans toute l'archive ; absent d'Unihan 17.0.0 et 18.0.0.
- cjkvi-ids et CHISE IDS : GPL v2 (ou ultérieure pour CHISE). Mesurés pour information,
  jamais candidats à l'embarqué.
"""
from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from . import cjkdecomp, unihan
from .fetch import Source, Resultat, ecrire_sommes, journaliser, telecharger
from .gf0014 import (
    INCONNU,
    OPERATEURS_IDS,
    SOURCE_MMAH,
    Controle,
    TableGF0014,
    charger_ids_secondaires,
    charger_table,
    decomposer,
)
from .graphe import BRIQUE, DECOUPEE
from .outils import ecrire_json, empreinte_fichier
from .paths import BUILD, DATA, EXPORT, INGEST, SOURCES
from .surcharges import SURCHARGES, SurchargeInvalide, charger_ids, parse_equivalences

#: Où `--telecharger` range les sources candidates, à part de celles de `wenlu fetch`.
CANDIDATS = SOURCES / "candidats"

#: Le fichier de décision, versionné.
DOCUMENT = DATA.parent / "docs" / "licences-decompositions.md"

BABELSTONE = "babelstone"
CJKVI = "cjkvi-ids"
CHISE = "chise-ids"
UNIHAN_KIDS = "unihan-kids"
CJK_DECOMP = cjkdecomp.SOURCE
#: La chaîne sans Make Me a Hanzi : surcharges, puis cjk-decomp, puis BabelStone.
PROPOSEE = "proposee"
#: L'autre ordre, mesuré pour justifier le choix : surcharges, BabelStone, cjk-decomp.
ALTERNATIVE = "alternative"
#: La chaîne proposée sans la table de notation, pour en montrer l'effet.
PROPOSEE_BRUTE = "proposee-brute"
#: Nos seules données : la table de la norme et les surcharges versionnées, sans source d'IDS.
PROPRES = "propres"

#: Formes de notation des candidats ramenées à la norme, versionnées.
NOTATION = SURCHARGES / "notation-candidats.tsv"

#: Le champ Unihan qui porterait un IDS, s'il existait (UAX #38 ne le définit pas).
CHAMP_KIDS = "kIDS"

#: Opérateurs d'Unicode 15.1 (⿼ ⿽ ⿾ ⿿ ㇯) que `gf0014.analyser_ids` ne lit pas :
#: un IDS qui en porte un n'est pas descendu, il vaut `？`.
OPERATEURS_NOUVEAUX = frozenset("⿼⿽⿾⿿㇯")

#: Marque de variante mineure (BabelStone), sans effet sur la décomposition.
MARQUE_VARIANTE = "〾"

#: Composant non codé : `{12}` (BabelStone), `&CDP-8BBF;` (CHISE, cjkvi), ① à ⑳ (cjkvi).
NON_CODE = re.compile(r"\{\d+\}|&[^;]+;|[①-⑳]")

ENTETE_BABELSTONE = "# Maintained by: Andrew West"

GITHUB_RAW = "https://raw.githubusercontent.com/"


@dataclass(frozen=True)
class Candidat:
    """Une source d'IDS candidate et sa licence, telle que lue sur la source primaire."""

    cle: str
    nom: str
    licence: str
    embarquable: bool
    sources: tuple[Source, ...] = ()


CANDIDATS_DISTANTS: tuple[Candidat, ...] = (
    Candidat(
        cle=BABELSTONE,
        nom="BabelStone IDS (IDS.TXT, Andrew West)",
        licence=(
            "aucun droit revendiqué : usage personnel ou commercial libre, sans"
            " autorisation ni attribution (en-tête du fichier, § 2)"
        ),
        embarquable=True,
        sources=(
            Source(
                nom="BabelStone IDS",
                fichier="babelstone-IDS.TXT",
                url="https://www.babelstone.co.uk/CJK/IDS.TXT",
                licence="aucun droit revendiqué (en-tête, § 2)",
                replis=(
                    GITHUB_RAW + "mandel59/babelstone-ids/main/IDS.TXT",
                    GITHUB_RAW + "qundao/backup-babelstone-ids/main/IDS.TXT",
                ),
                entete_attendue=ENTETE_BABELSTONE,
            ),
        ),
    ),
    Candidat(
        cle=CJKVI,
        nom="cjkvi-ids (ids.txt)",
        licence="GPL v2 (README) ; ids.txt « suit les termes » de CHISE",
        embarquable=False,
        sources=(
            Source(
                nom="cjkvi-ids",
                fichier="cjkvi-ids.txt",
                url=GITHUB_RAW + "cjkvi/cjkvi-ids/master/ids.txt",
                licence="GPL v2",
            ),
        ),
    ),
    Candidat(
        cle=CHISE,
        nom="CHISE IDS (IDS-UCS-Basic, IDS-UCS-Ext-A)",
        licence="GPL v2 ou ultérieure (README.md, section License)",
        embarquable=False,
        sources=(
            Source(
                nom="CHISE IDS — URO",
                fichier="chise-IDS-UCS-Basic.txt",
                url=GITHUB_RAW + "chise/ids/main/IDS-UCS-Basic.txt",
                licence="GPL v2+",
            ),
            Source(
                nom="CHISE IDS — Ext. A",
                fichier="chise-IDS-UCS-Ext-A.txt",
                url=GITHUB_RAW + "chise/ids/main/IDS-UCS-Ext-A.txt",
                licence="GPL v2+",
            ),
        ),
    ),
)

#: Libellés des candidats locaux, qui ne se téléchargent pas ici.
NOMS: dict[str, str] = {
    **{c.cle: c.nom for c in CANDIDATS_DISTANTS},
    CJK_DECOMP: "cjk-decomp (déjà la source de repli)",
    UNIHAN_KIDS: "Unihan kIDS (Unicode License)",
    PROPRES: "GF 0014-2009 et nos surcharges seules",
    PROPOSEE: "chaîne proposée : surcharges > cjk-decomp > BabelStone",
    ALTERNATIVE: "autre ordre : surcharges > BabelStone > cjk-decomp",
    PROPOSEE_BRUTE: "chaîne proposée, sans la table de notation",
}

#: L'ordre des colonnes et des décomptes.
ORDRE = (
    PROPRES,
    UNIHAN_KIDS,
    CJK_DECOMP,
    BABELSTONE,
    PROPOSEE,
    ALTERNATIVE,
    PROPOSEE_BRUTE,
    CJKVI,
    CHISE,
)
#: Les jeux composés, qui ne sont pas des sources.
CHAINES = (PROPRES, PROPOSEE, ALTERNATIVE, PROPOSEE_BRUTE)

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


# --------------------------------------------------------------------------- lecture


def normaliser(ids: str) -> str:
    """Ramène un IDS candidat à ce que `gf0014.analyser_ids` sait descendre.

    La marque de variante mineure tombe ; un composant non codé devient `？` ; un
    opérateur d'Unicode 15.1 rend tout l'IDS illisible (`？`) plutôt que faux.
    """
    ids = ids.replace(MARQUE_VARIANTE, "").strip()
    if any(o in OPERATEURS_NOUVEAUX for o in ids):
        return INCONNU
    return NON_CODE.sub(INCONNU, ids)


def charger_notation(table: TableGF0014, chemin: Path | None = None) -> dict[str, str]:
    """`notation-candidats.tsv` : forme hors table → composant de la norme.

    Une forme de la table est un composant de la norme et ne se renomme jamais ; une
    cible hors table ne mènerait nulle part. Les deux refusent le fichier.
    """
    chemin = chemin or NOTATION
    lignes = chemin.read_text(encoding="utf-8").splitlines() if chemin.exists() else []
    notation = parse_equivalences(lignes, chemin.name)
    for forme, composant in notation.items():
        if forme in table or composant not in table:
            raise SurchargeInvalide(
                f"{chemin.name} : {forme} → {composant} : {forme} doit être hors table, {composant} dedans"
            )
    return notation


def noter(ids: Mapping[str, str], notation: Mapping[str, str]) -> dict[str, str]:
    """Remplace dans chaque IDS les formes de notation par le composant de la norme."""
    if not notation:
        return dict(ids)
    return {c: "".join(notation.get(x, x) for x in v) for c, v in ids.items()}


def _choisir(variantes: Sequence[tuple[str, str]]) -> str | None:
    """La variante de la Chine continentale (G) si elle est marquée, sinon la première."""
    if not variantes:
        return None
    for ids, sources in variantes:
        if "G" in sources:
            return ids
    return variantes[0][0]


VARIANTE_BABELSTONE = re.compile(r"^\^(?P<ids>.*)\$(?:\((?P<sources>[A-Z]*)\))?$")
VARIANTE_TABULEE = re.compile(r"^(?P<ids>[^\[]+)(?:\[(?P<sources>[A-Z]*)\])?$")


def lire_babelstone(lignes: Iterable[str]) -> dict[str, str]:
    """`IDS.TXT` : `U+4E01<tab>丁<tab>^⿱一亅$(GHTJKPV)[<tab>^…$(T)]`."""
    ids: dict[str, str] = {}
    for brute in lignes:
        ligne = brute.lstrip("﻿").rstrip("\r\n")
        if not ligne or ligne.startswith("#"):
            continue
        champs = ligne.split("\t")
        if len(champs) < 3 or not champs[0].startswith("U+"):
            continue
        variantes = [
            (t["ids"], t["sources"] or "")
            for v in champs[2:]
            if (t := VARIANTE_BABELSTONE.match(v.strip()))
        ]
        choisi = _choisir(variantes)
        if choisi:
            ids[champs[1]] = normaliser(choisi)
    return ids


def lire_ids_tabule(lignes: Iterable[str]) -> dict[str, str]:
    """cjkvi-ids et CHISE : `U+4E0E<tab>与<tab>⿹&CDP-8BBF;一[<tab>…[GTJ]]`, `;` commente."""
    ids: dict[str, str] = {}
    for brute in lignes:
        ligne = brute.rstrip("\r\n")
        if not ligne or ligne.startswith(("#", ";")):
            continue
        champs = ligne.split("\t")
        if len(champs) < 3 or not champs[0].startswith("U+"):
            continue
        variantes = [
            (t["ids"], t["sources"] or "")
            for v in champs[2:]
            if (t := VARIANTE_TABULEE.match(v.strip()))
        ]
        choisi = _choisir(variantes)
        if choisi:
            ids[champs[1]] = normaliser(choisi)
    return ids


def lire_kids(archive: Path) -> tuple[dict[str, str], str]:
    """Les valeurs `kIDS` de toute l'archive Unihan, et la version lue dans ses en-têtes.

    Aucune version publiée à ce jour n'en porte : le dictionnaire est vide, et le
    décompte le dit. Si une version à venir l'ajoute, la mesure se fera d'elle-même.
    """
    ids: dict[str, str] = {}
    version = ""
    with zipfile.ZipFile(archive) as z:
        for nom in sorted(z.namelist()):
            for ligne in z.read(nom).decode("utf-8").splitlines():
                if not version and (m := unihan.ENTETE_VERSION.match(ligne)):
                    version = m["version"]
                lue = unihan.parse_ligne(ligne)
                if lue and lue[1] == CHAMP_KIDS:
                    ids[unihan.caractere(lue[0])] = normaliser(lue[2].split()[0])
    return ids, version


def telecharger_candidats(dossier: Path | None = None, *, force: bool = False) -> dict[str, str]:
    """Télécharge les sources candidates. Rend {fichier: état}."""
    dossier = dossier or CANDIDATS
    dossier.mkdir(parents=True, exist_ok=True)
    sources = tuple(s for c in CANDIDATS_DISTANTS for s in c.sources)
    resultats: dict[str, Resultat | str] = {
        s.fichier: telecharger(s, dossier / s.fichier, force=force) for s in sources
    }
    ecrire_sommes(dossier, sources)
    journaliser(dossier, sources, resultats)
    return {f: r.etat if isinstance(r, Resultat) else r for f, r in resultats.items()}


@dataclass(frozen=True)
class SourceLue:
    """Un candidat chargé : ses IDS, et l'empreinte des fichiers lus (vide s'il manque)."""

    ids: Mapping[str, str]
    fichiers: tuple[tuple[str, str], ...] = ()
    note: str = ""

    @property
    def presente(self) -> bool:
        return bool(self.fichiers)


def charger_candidats(
    dossier: Path | None = None, ingest: Path | None = None, sources: Path | None = None
) -> dict[str, SourceLue]:
    """Les IDS de chaque candidat disponible localement. Un fichier absent n'est pas une faute."""
    dossier = dossier or CANDIDATS
    ingest = ingest or INGEST
    sources = sources or SOURCES
    lus: dict[str, SourceLue] = {}
    for candidat in CANDIDATS_DISTANTS:
        chemins = [dossier / s.fichier for s in candidat.sources]
        if not all(c.exists() for c in chemins):
            lus[candidat.cle] = SourceLue({}, note="non téléchargé (`wenlu licences --telecharger`)")
            continue
        lecteur = lire_babelstone if candidat.cle == BABELSTONE else lire_ids_tabule
        ids: dict[str, str] = {}
        for chemin in chemins:
            ids.update(lecteur(chemin.read_text(encoding="utf-8-sig").splitlines()))
        lus[candidat.cle] = SourceLue(
            ids, tuple((c.name, empreinte_fichier(c)) for c in chemins)
        )
    secondaires = ingest / "ids-secondaires.json"
    if secondaires.exists():
        lus[CJK_DECOMP] = SourceLue(
            charger_ids_secondaires(ingest), (("ids-secondaires.json", empreinte_fichier(secondaires)),)
        )
    else:
        lus[CJK_DECOMP] = SourceLue({}, note="`ids-secondaires.json` absent (`wenlu ingest`)")
    archive = sources / unihan.ARCHIVE
    if archive.exists():
        kids, version = lire_kids(archive)
        lus[UNIHAN_KIDS] = SourceLue(
            kids,
            ((unihan.ARCHIVE, empreinte_fichier(archive)),),
            note=f"Unihan {version or '?'} : {len(kids)} valeurs `{CHAMP_KIDS}`",
        )
    else:
        lus[UNIHAN_KIDS] = SourceLue({}, note=f"{unihan.ARCHIVE} absent (`wenlu fetch`)")
    return lus


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
    """Ce qu'un candidat rend pour un caractère.

    `meme_tete` : l'opérateur de tête de la structure est celui de l'export — c'est lui
    que les devinettes lisent (la disposition des briques).
    """

    verdict: str
    composants: tuple[str, ...] = ()
    structure: str = ""
    meme_tete: bool = False


@dataclass(frozen=True)
class Ligne:
    """Un caractère exporté : sa décomposition actuelle, sa licence, et chaque candidat."""

    c: str
    genre: str
    parts: tuple[str, ...]
    sources: tuple[str, ...]
    structure: str
    motifs: tuple[str, ...]
    mesures: Mapping[str, Mesure] = field(default_factory=dict)

    @property
    def brique(self) -> bool:
        """Une brique (ou une feuille découpée) est un composant de la norme : rien à descendre."""
        return not self.parts

    @property
    def lgpl(self) -> bool:
        """Vrai si la décomposition exportée descend au moins un IDS de `dictionary.txt`."""
        return SOURCE_MMAH in self.sources

    @property
    def regime(self) -> str:
        """La licence dont relève `parts`, en clair."""
        if self.brique:
            return "GF 0014-2009 seule"
        if self.lgpl:
            return "LGPL (Make Me a Hanzi)"
        return "permissive ou propre (" + ", ".join(self.sources) + ")"


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

    if not d.reconcilie:
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


def _utile(ids: str, c: str) -> bool:
    """Un IDS qui dit quelque chose : ni vide, ni le caractère lui-même, ni `？`."""
    return bool(ids) and ids != c and INCONNU not in ids


def enchainer(premier: Mapping[str, str], second: Mapping[str, str]) -> dict[str, str]:
    """`premier` partout où il dit quelque chose d'exploitable, `second` ailleurs.

    Même règle que `gf0014.combiner_ids` entre Make Me a Hanzi et cjk-decomp.
    """
    ids = dict(second)
    for c, v in premier.items():
        if _utile(v, c) or c not in ids:
            ids[c] = v
    return ids


def jeux_mesures(
    candidats: Mapping[str, SourceLue], notation: Mapping[str, str]
) -> dict[str, dict[str, str]]:
    """Les jeux d'IDS mesurés : chaque source présente, puis les chaînes sans Make Me a Hanzi."""
    # Une source présente mais vide (Unihan sans `kIDS`) ne décrit rien : la mesurer ne
    # compterait que les surcharges, que `PROPRES` compte déjà.
    jeux = {
        cle: noter(lue.ids, notation) for cle, lue in candidats.items() if lue.presente and lue.ids
    }
    jeux[PROPRES] = {}
    if CJK_DECOMP in jeux and BABELSTONE in jeux:
        jeux[PROPOSEE] = enchainer(jeux[CJK_DECOMP], jeux[BABELSTONE])
        jeux[ALTERNATIVE] = enchainer(jeux[BABELSTONE], jeux[CJK_DECOMP])
        jeux[PROPOSEE_BRUTE] = enchainer(candidats[CJK_DECOMP].ids, candidats[BABELSTONE].ids)
    return jeux


def inventorier(
    exportes: Mapping[str, Exporte],
    decompositions: Mapping[str, Mapping[str, object]],
    genres: Mapping[str, str],
    motifs: Mapping[str, Sequence[str]],
    table: TableGF0014,
    candidats: Mapping[str, SourceLue],
    surcharges: Mapping[str, str],
    notation: Mapping[str, str] | None = None,
) -> list[Ligne]:
    """Une ligne par caractère exporté, triée par caractère."""
    jeux = jeux_mesures(candidats, notation or {})
    lignes: list[Ligne] = []
    for c in sorted(exportes):
        e = exportes[c]
        structure = str((decompositions.get(c) or {}).get("structure") or c)
        mesures = (
            {}
            if not e.parts
            else {
                cle: mesurer(c, e.parts, table, ids, surcharges, structure)
                for cle, ids in jeux.items()
            }
        )
        lignes.append(
            Ligne(
                c=c,
                genre=genres.get(c, ""),
                parts=e.parts,
                sources=e.sources,
                structure=structure,
                motifs=tuple(motifs.get(c) or ()),
                mesures=mesures,
            )
        )
    return lignes


def decompte(lignes: Sequence[Ligne], cle: str) -> dict[str, int]:
    """Verdicts d'un candidat sur les caractères décomposés (les briques n'en ont pas)."""
    compte = dict.fromkeys(VERDICTS, 0)
    for ligne in lignes:
        if ligne.brique or cle not in ligne.mesures:
            continue
        compte[ligne.mesures[cle].verdict] += 1
    return compte


def decision(ligne: Ligne) -> str:
    """La décision proposée pour un caractère — la décision revient au propriétaire."""
    if ligne.brique:
        return "rien à remplacer"
    if not ligne.lgpl:
        return "inchangée (hors LGPL)"
    mesure = ligne.mesures.get(PROPOSEE)
    if mesure is None:
        return "à mesurer"
    return DECISIONS[mesure.verdict]


#: Ce que chaque verdict de la chaîne proposée demande, pour un caractère aujourd'hui LGPL.
DECISIONS: dict[str, str] = {
    IDENTIQUE: "remplacer, identique",
    EQUIVALENT: "remplacer, identique à la notation près",
    VARIANTE: "relire : autre variante du même groupe",
    ORDRE_DIFFERENT: "relire : ordre",
    DIFFERENT: "relire : surcharge ou accepter",
    NON_RECONCILIE: "surcharge à écrire",
    ABSENT: "surcharge à écrire",
}


def memes_tetes(lignes: Sequence[Ligne], cle: str) -> tuple[int, int]:
    """(même opérateur de tête, total) parmi les décompositions conservées par `cle`."""
    gardees = [
        l.mesures[cle]
        for l in lignes
        if not l.brique and cle in l.mesures and l.mesures[cle].verdict in CONSERVES
    ]
    return sum(1 for m in gardees if m.meme_tete), len(gardees)


# -------------------------------------------------------------------- simulation


#: Où la simulation rejoue la réconciliation et les parcours, à part du vrai build.
SIMULATION = BUILD / "licences-simulation"


@dataclass(frozen=True)
class Impact:
    """Ce qu'une chaîne d'IDS changerait à un parcours, rejoué de bout en bout."""

    parcours: str
    jours: int
    jours_simules: int
    premier_ecart: int | None
    deplaces: tuple[str, ...]

    @property
    def identique(self) -> bool:
        return self.premier_ecart is None


def jours_par_caractere(document: Mapping[str, object]) -> dict[str, int]:
    """Le jour où chaque caractère d'un parcours est posé, brique ou composé."""
    jours: dict[str, int] = {}
    for jour in document["jours"]:  # type: ignore[index, union-attr]
        n = int(jour["jour"])
        if jour.get("brique"):
            jours.setdefault(str(jour["brique"]), n)
        for c in jour.get("composes") or ():
            jours.setdefault(str(c), n)
    return jours


def comparer_parcours(nom: str, actuel: Mapping[str, object], simule: Mapping[str, object]) -> Impact:
    """Premier jour qui diffère, et les caractères qui changent de jour."""
    a, s = list(actuel["jours"]), list(simule["jours"])  # type: ignore[call-overload]
    premier = next(
        (int(x["jour"]) for x, y in zip(a, s) if x != y),
        None if len(a) == len(s) else min(len(a), len(s)) + 1,
    )
    ja, js = jours_par_caractere(actuel), jours_par_caractere(simule)
    deplaces = tuple(sorted(c for c in set(ja) | set(js) if ja.get(c) != js.get(c)))
    return Impact(nom, len(a), len(s), premier, deplaces)


def simuler(
    ids: Mapping[str, str],
    table: TableGF0014,
    surcharges: Mapping[str, str],
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    sortie: Path | None = None,
    figer_rangs: bool = False,
) -> tuple[int, list[Impact]]:
    """Rejoue réconciliation, graphe et parcours avec `ids` à la place de Make Me a Hanzi.

    L'univers reste celui du build : les 9 574 caractères de `graphics.txt`, qui sont
    ceux de `dictionary.txt`, dans le même ordre — seul change l'IDS. Rend le nombre de
    décompositions qui changent sur tout l'univers, et l'impact sur chaque parcours.

    `figer_rangs` : l'ordre de fréquence n'est plus recompté sur les nouvelles
    décompositions, il reprend le nombre de dépendants du build d'aujourd'hui. C'est la
    mesure de ce qu'une migration à rangs figés changerait.
    """
    import shutil

    from . import graphe as graphe_mod
    from .decoupes import composants_decoupes
    from .gf0014 import document_decompositions

    build = build or BUILD
    ingest = ingest or INGEST
    sortie = sortie or SIMULATION
    univers = [str(g["c"]) for g in json.loads((ingest / "graphies.json").read_text(encoding="utf-8"))]
    # Comme `gf0014.reconcilier` : la descente lit aussi les IDS des caractères hors de
    # l'univers (un composant intermédiaire rare), surcharges devant.
    fusion = {**ids, **surcharges}
    decompositions = [decomposer(c, table, fusion, {}) for c in univers]
    sortie.mkdir(parents=True, exist_ok=True)
    document = document_decompositions(decompositions, table)
    ecrire_json(sortie / "decompositions.json", document)
    if (build / "decoupes.json").exists():
        shutil.copyfile(build / "decoupes.json", sortie / "decoupes.json")
    decoupees = composants_decoupes(sortie) if (sortie / "decoupes.json").exists() else []
    graphe = graphe_mod.construire(document["caracteres"], decoupees)  # type: ignore[arg-type]

    rangs: dict[str, int] = {}
    if figer_rangs:
        # Le rang de fréquence du build d'aujourd'hui, figé : le nombre de dépendants de
        # chaque nœud, que `graphe._cle_priorite` lit comme un rang (plus petit, plus tôt).
        actuel = json.loads((build / "graphe.json").read_text(encoding="utf-8"))
        rangs = {str(n["c"]): -int(n["dependants"]) for n in actuel["noeuds"]}
    listes = json.loads((ingest / "listes.json").read_text(encoding="utf-8"))

    actuelles = {
        str(d["c"]): list(d["composants"])
        for d in json.loads((build / "decompositions.json").read_text(encoding="utf-8"))["caracteres"]
    }
    changees = sum(1 for d in decompositions if list(d.composants) != actuelles.get(d.c))
    impacts = []
    for nom, liste in sorted(graphe_mod.PARCOURS.items()):
        actuel = build / f"parcours-{nom}.json"
        if not actuel.exists() or not listes.get(liste):
            continue
        p = graphe_mod.parcours(
            graphe,
            listes[liste],
            nom=nom,
            liste=liste,
            rangs=rangs,
            depart=graphe_mod.DEPART.get(nom, ()),
        )
        simule = graphe_mod.document_parcours(p)
        ecrire_json(sortie / f"parcours-{nom}.json", simule)
        impacts.append(
            comparer_parcours(nom, json.loads(actuel.read_text(encoding="utf-8")), simule)
        )
    return changees, impacts


@dataclass(frozen=True)
class Scenario:
    """Une chaîne rejouée de bout en bout, et ce qu'elle change."""

    nom: str
    surcharges_ajoutees: int
    rangs_figes: bool
    decompositions_changees: int
    impacts: tuple[Impact, ...]


def surcharges_de_relecture(lignes: Sequence[Ligne]) -> dict[str, str]:
    """Pour la simulation seulement : la structure exportée des caractères que la chaîne
    proposée ne conserve pas, comme si la relecture les confirmait tous.

    Elle mesure la cible d'une migration à l'identique ; elle n'écrit aucune surcharge.
    Chaque ligne réelle de `ids.tsv` se relit contre la norme et porte sa raison.
    """
    return {
        l.c: l.structure
        for l in lignes
        if not l.brique
        and PROPOSEE in l.mesures
        and l.mesures[PROPOSEE].verdict not in CONSERVES
    }


def scenarios(
    lignes: Sequence[Ligne],
    candidats: Mapping[str, SourceLue],
    table: TableGF0014,
    surcharges: Mapping[str, str],
    notation: Mapping[str, str],
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    sortie: Path | None = None,
) -> list[Scenario]:
    """Quatre passages : le témoin, la chaîne brute, la relecture seule, la migration visée."""
    sortie = sortie or SIMULATION
    jeux = jeux_mesures(candidats, notation)
    if PROPOSEE not in jeux:
        return []
    relecture = surcharges_de_relecture(lignes)
    plan = (
        ("chaîne actuelle rejouée (témoin)", chaine_actuelle(ingest), {}, False),
        ("chaîne proposée, rangs recomptés", jeux[PROPOSEE], {}, False),
        ("chaîne proposée, relecture confirmée, rangs recomptés", jeux[PROPOSEE], relecture, False),
        ("chaîne proposée, relecture confirmée, rangs figés", jeux[PROPOSEE], relecture, True),
    )
    resultats = []
    for i, (nom, ids, ajout, figer) in enumerate(plan):
        n, impacts = simuler(
            ids,
            table,
            {**surcharges, **ajout},
            build=build,
            ingest=ingest,
            sortie=sortie / str(i),
            figer_rangs=figer,
        )
        resultats.append(Scenario(nom, len(ajout), figer, n, tuple(impacts)))
    return resultats


def chaine_actuelle(ingest: Path | None = None) -> dict[str, str]:
    """La chaîne du build d'aujourd'hui : Make Me a Hanzi, cjk-decomp en repli.

    Rejouée par `simuler`, elle doit redonner le build à l'identique : c'est le témoin
    qui dit que la simulation mesure la source, et rien d'autre.
    """
    from .gf0014 import combiner_ids, index_ids

    ingest = ingest or INGEST
    caracteres = json.loads((ingest / "caracteres.json").read_text(encoding="utf-8"))
    ids, _ = combiner_ids(index_ids(caracteres), charger_ids_secondaires(ingest))
    return ids


# --------------------------------------------------------------- autres emprunts


@dataclass(frozen=True)
class Emprunt:
    """Un autre usage de Make Me a Hanzi dans ce que l'app embarque ou dans son pipeline."""

    quoi: str
    source: str
    licence: str
    embarque: bool
    detail: str


def emprunts_mmah(
    version: Path,
    decompositions: Mapping[str, Mapping[str, object]],
    exportes: Mapping[str, Exporte],
    genres: Mapping[str, str],
    ingest: Path | None = None,
    racine_app: Path | None = None,
) -> list[Emprunt]:
    """Tout ce qui vient de Make Me a Hanzi, hors la chaîne IDS des `parts`."""
    ingest = ingest or INGEST
    racine_app = racine_app or (DATA.parent / "app")
    traits = sorted((version / "traits").glob("*.json"))
    n_traits = 0
    decoupes: set[str] = set()
    for chemin in traits:
        document = json.loads(chemin.read_text(encoding="utf-8"))
        n_traits += len(document.get("traits") or {})
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
    briques_mmah = sum(1 for c, g in genres.items() if c in exportes and g == BRIQUE)
    structures = sum(
        1 for c, e in exportes.items() if e.parts and SOURCE_MMAH in e.sources
    )
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
    return [
        Emprunt(
            "pinyin de repli d'une fiche relue (hors Unihan et `pinyin.tsv`)",
            "dictionary.txt (`pinyin`), par le contexte de la fiche",
            "fait, non protégeable",
            True,
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
            f"{n_demo} caractères, table nue "
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
            "opérateur de tête de `structure` (dispositions des devinettes)",
            "dictionary.txt",
            "LGPL 3.0+",
            False,
            f"{structures} caractères exportés à structure descendue de Make Me a Hanzi ;"
            " `devinettes.json` n'en garde que le choix des leurres et le contrôle de disposition",
        ),
        Emprunt(
            "genre `brique` (composant présent au dictionnaire)",
            "dictionary.txt (liste des caractères)",
            "fait, non protégeable",
            False,
            f"{briques_mmah} briques exportées ; seule la présence du caractère est lue",
        ),
        Emprunt(
            "ordre des parcours (nombre de dépendants)",
            "dictionary.txt (via les décompositions des 9 574 caractères)",
            "fait dérivé, compté",
            False,
            "un décompte, pas une reprise ; change avec la source d'IDS",
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


def _cellule(ligne: Ligne, cle: str) -> str:
    mesure = ligne.mesures.get(cle)
    if mesure is None:
        return "·"
    if mesure.verdict == IDENTIQUE:
        return "="
    if mesure.verdict == ABSENT:
        return "absent"
    composants = " ".join(mesure.composants)
    prefixe = {
        EQUIVALENT: "≡",
        VARIANTE: "variante :",
        ORDRE_DIFFERENT: "ordre :",
        NON_RECONCILIE: "écart :",
    }.get(mesure.verdict, "≠")
    return f"{prefixe} {composants}"


def _pct(n: int, total: int) -> str:
    return f"{100 * n / total:.1f} %" if total else "—"


def rendre(
    lignes: Sequence[Ligne],
    candidats: Mapping[str, SourceLue],
    emprunts: Sequence[Emprunt],
    version: str,
    simulations: Sequence[Scenario] = (),
) -> str:
    """Le fichier de décision, en Markdown : synthèse, puis caractère par caractère."""
    decomposes = [l for l in lignes if not l.brique]
    lgpl = [l for l in decomposes if l.lgpl]
    briques = [l for l in lignes if l.brique]
    sortie = [
        "# Licence des décompositions, caractère par caractère",
        "",
        "Produit par `uv run wenlu licences` (`data/src/wenlu_data/licences.py`) ; ne pas"
        " modifier à la main. La décision et son raisonnement sont dans"
        " `docs/sources-licences.md` §10 ; ce fichier en est la pièce justificative.",
        "",
        f"Version exportée relue : `{version}`. Chaque candidat redescend la décomposition"
        " GF 0014-2009 à la place de Make Me a Hanzi, les surcharges versionnées"
        " (`data/sources/surcharges/ids.tsv`) passant devant, et la compare aux `parts`"
        " exportés.",
        "",
        "## Sources lues",
        "",
        "| Candidat | Licence | Embarquable | Fichiers (SHA-256) | Note |",
        "|---|---|---|---|---|",
    ]
    licences = {c.cle: (c.licence, c.embarquable) for c in CANDIDATS_DISTANTS}
    licences[CJK_DECOMP] = (cjkdecomp.LICENCE, True)
    licences[UNIHAN_KIDS] = ("Unicode License v3", True)
    for cle in ORDRE:
        if cle in CHAINES:
            continue
        lue = candidats.get(cle, SourceLue({}, note="non chargé"))
        licence, embarquable = licences[cle]
        fichiers = "<br>".join(f"`{n}` `{h[:16]}…`" for n, h in lue.fichiers) or "—"
        sortie.append(
            f"| {NOMS[cle]} | {licence} | {'oui' if embarquable else 'non'} | {fichiers}"
            f" | {lue.note or f'{len(lue.ids)} IDS'} |"
        )
    sortie += [
        "",
        "## Décompte",
        "",
        f"- {len(lignes)} caractères exportés, dont {len(briques)} composants de la norme"
        " (briques et feuilles découpées : `parts` vide, rien à décomposer, GF 0014-2009"
        f" seule) et {len(decomposes)} caractères décomposés.",
        f"- Parmi ces derniers, {len(lgpl)} descendent au moins un IDS de `dictionary.txt`"
        f" (LGPL) ; {len(decomposes) - len(lgpl)} n'en descendent aucun (cjk-decomp ou"
        " surcharge seulement).",
        "",
        "Couverture de chaque candidat sur les caractères décomposés, surcharges devant et"
        " formes de notation ramenées à la norme (`data/sources/surcharges/"
        "notation-candidats.tsv`), sauf mention. « Conservées » : identiques, ou identiques"
        " à la notation près (≡ : même composant de la norme, ⺮ pour 𥫗) — `parts` ne"
        " bouge pas. « Même tête » : parmi elles, l'opérateur de tête de la structure,"
        " que lisent les devinettes, est inchangé.",
        "",
        "| Candidat | Conservées | Même tête | Variante du groupe | Autre ordre | Différentes"
        " | Non réconciliées | Absentes |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for cle in ORDRE:
        if not any(cle in l.mesures for l in decomposes):
            n = len(candidats.get(cle, SourceLue({})).ids)
            sortie.append(
                f"| {NOMS[cle]} | 0 | — | — | — | — | — | {len(decomposes)}"
                f" ({n} IDS dans la source) |"
            )
            continue
        compte = decompte(lignes, cle)
        gardees = compte[IDENTIQUE] + compte[EQUIVALENT]
        tete, _ = memes_tetes(lignes, cle)
        sortie.append(
            f"| {NOMS[cle]} | {gardees} ({_pct(gardees, len(decomposes))}) | {tete}"
            f" | {compte[VARIANTE]} | {compte[ORDRE_DIFFERENT]} | {compte[DIFFERENT]}"
            f" | {compte[NON_RECONCILIE]} | {compte[ABSENT]} |"
        )
    if lgpl and any(PROPOSEE in l.mesures for l in lgpl):
        compte = decompte(lgpl, PROPOSEE)
        sortie += [
            "",
            f"Sur les {len(lgpl)} caractères qui dépendent aujourd'hui de Make Me a Hanzi, la"
            f" chaîne proposée conserve {compte[IDENTIQUE] + compte[EQUIVALENT]}"
            f" décompositions ; {compte[VARIANTE]} prennent une autre variante du même groupe,"
            f" {compte[ORDRE_DIFFERENT]} un autre ordre, {compte[DIFFERENT]} d'autres"
            f" composants, et {compte[NON_RECONCILIE] + compte[ABSENT]} ne se réconcilient pas.",
        ]
        ecarts = [
            l for l in lgpl if PROPOSEE in l.mesures and l.mesures[PROPOSEE].verdict not in CONSERVES
        ]
        repris = [
            l.c
            for l in ecarts
            if BABELSTONE in l.mesures and l.mesures[BABELSTONE].verdict in CONSERVES
        ]
        if ecarts:
            sortie += [
                "",
                f"Parmi ces {len(ecarts)} écarts, BabelStone seul rend déjà la décomposition"
                f" exportée pour {len(repris)} ({''.join(repris) or '—'}) : une source"
                " permissive l'appuie, la surcharge n'a qu'à la retenir.",
            ]
    decisions: dict[str, int] = {}
    for l in lignes:
        decisions[decision(l)] = decisions.get(decision(l), 0) + 1
    sortie += ["", "Décisions proposées :", ""]
    sortie += [f"- {d} : {n}" for d, n in sorted(decisions.items(), key=lambda kv: (-kv[1], kv[0]))]
    if simulations:
        sortie += [
            "",
            "## Parcours rejoués",
            "",
            "La réconciliation, le graphe et les deux parcours rejoués sur les 9 574 caractères"
            " du build (ceux de `graphics.txt`), avec la chaîne dite à la place de Make Me a"
            " Hanzi (`data/work/build/licences-simulation/`). « Relecture confirmée » : les"
            " caractères que la chaîne ne conserve pas reçoivent, pour la mesure seulement, une"
            " surcharge égale à leur structure exportée. « Rangs figés » : l'ordre de fréquence"
            " reprend le nombre de dépendants du build d'aujourd'hui au lieu de le recompter.",
            "",
            "| Scénario | Surcharges ajoutées | Décompositions changées (sur 9 574)"
            " | Parcours | Jours | Premier jour qui diffère | Caractères qui changent de jour |",
            "|---|---|---|---|---|---|---|",
        ]
        for s in simulations:
            for i in s.impacts:
                sortie.append(
                    f"| {s.nom} | {s.surcharges_ajoutees} | {s.decompositions_changees}"
                    f" | {i.parcours} | {i.jours} → {i.jours_simules}"
                    f" | {i.premier_ecart if i.premier_ecart is not None else 'aucun'}"
                    f" | {len(i.deplaces)} |"
                )
    sortie += [
        "",
        "## Champs de la décomposition, et d'où ils viennent",
        "",
        "| Champ exporté | Composant de la norme (GF 0014-2009) | Source d'IDS (`sources`) |",
        "|---|---|---|",
        "| `parts` d'une brique ou d'une feuille découpée | vide : le caractère est un composant"
        " de la table | aucune |",
        "| `parts` d'un caractère décomposé | chaque feuille est un composant de la table,"
        " où la descente s'arrête | le découpage jusqu'à ces feuilles et leur ordre |",
        "| `sources` | — | le nom des sources descendues, par le pipeline |",
        "| `nouveau`, `role` | l'index d'un composant de `parts` | hérite de `parts` |",
        "| famille (`racine`, `familles/<racine>.json`) | la première brique de `parts` | hérite"
        " de `parts` |",
        "| `index.json` : `parcours` (jours, briques) | prérequis = `parts` | hérite de `parts`,"
        " et de l'ordre de fréquence compté sur les 9 574 décompositions |",
        "| `devinettes.json` (leurres, disposition) | les briques citées sont les `parts` |"
        " l'opérateur de tête de `structure`, non exporté |",
        "| `pinyin`, `lectures` | — | aucune : Unihan et `pinyin.tsv` |",
    ]
    sortie += [
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
        " feuille hors norme ; `absent` : la source ne décrit pas le caractère. Les colonnes"
        " des sources seules portent les surcharges et la table de notation, comme la chaîne.",
        "",
        "Unihan `kIDS` n'a pas de colonne : aucune version publiée ne porte ce champ.",
        "",
        "| Caractère | Motif | `parts` exportés | Source actuelle | cjk-decomp"
        " | BabelStone | Chaîne proposée | Décision proposée |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for l in decomposes:
        motif = ", ".join(l.motifs) or "brique d'un autre"
        sortie.append(
            f"| {l.c} | {motif} | {' '.join(l.parts)} | {', '.join(l.sources)}"
            f" | {_cellule(l, CJK_DECOMP)} | {_cellule(l, BABELSTONE)}"
            f" | {_cellule(l, PROPOSEE)} | {decision(l)} |"
        )
    return "\n".join(sortie).rstrip() + "\n"


def document_json(lignes: Sequence[Ligne], candidats: Mapping[str, SourceLue]) -> dict[str, object]:
    """Contenu de `licences.json`."""
    return {
        "sources": {
            cle: {"fichiers": [list(f) for f in lue.fichiers], "ids": len(lue.ids), "note": lue.note}
            for cle, lue in sorted(candidats.items())
        },
        "caracteres": [
            {
                "c": l.c,
                "genre": l.genre,
                "motifs": list(l.motifs),
                "parts": list(l.parts),
                "sources": list(l.sources),
                "structure": l.structure,
                "regime": l.regime,
                "decision": decision(l),
                "candidats": {
                    cle: {
                        "verdict": m.verdict,
                        "composants": list(m.composants),
                        "structure": m.structure,
                        "meme_tete": m.meme_tete,
                    }
                    for cle, m in sorted(l.mesures.items())
                },
            }
            for l in lignes
        ],
    }


# --------------------------------------------------------------------------- build


class InventaireImpossible(RuntimeError):
    """Il manque l'export ou le build."""


def licences(
    *,
    version: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    candidats: Path | None = None,
    sources: Path | None = None,
    document: Path | None = None,
    simuler_parcours: bool = True,
) -> dict[str, object]:
    """Écrit `licences.json` et le fichier de décision. Rend un rapport court."""
    build = build or BUILD
    ingest = ingest or INGEST
    document = document or DOCUMENT
    version = version or derniere_version()
    if version is None or not (version / "familles").exists():
        raise InventaireImpossible("aucune version exportée : lancer `wenlu export`")
    for requis in (build / "decompositions.json", build / "graphe.json", ingest / "listes.json"):
        if not requis.exists():
            raise InventaireImpossible(f"{requis} absent : lancer `wenlu build`")

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
    lus = charger_candidats(candidats, ingest, sources)
    table = charger_table()
    surcharges = charger_ids()
    notation = charger_notation(table)
    lignes = inventorier(
        exportes, decompositions, genres, motifs_export(listes), table, lus, surcharges, notation
    )
    emprunts = emprunts_mmah(version, decompositions, exportes, genres, ingest)
    simulations = (
        scenarios(lignes, lus, table, surcharges, notation, build=build, ingest=ingest)
        if simuler_parcours and (ingest / "caracteres.json").exists()
        else []
    )
    ecrire_json(build / "licences.json", document_json(lignes, lus))
    document.parent.mkdir(parents=True, exist_ok=True)
    document.write_text(
        rendre(lignes, lus, emprunts, version.name, simulations), encoding="utf-8"
    )

    decomposes = [l for l in lignes if not l.brique]
    rapport: dict[str, object] = {
        "caracteres": len(lignes),
        "briques": len(lignes) - len(decomposes),
        "decomposes": len(decomposes),
        "lgpl": sum(1 for l in decomposes if l.lgpl),
    }
    for cle in ORDRE:
        if any(cle in l.mesures for l in decomposes):
            compte = decompte(lignes, cle)
            tete, gardees = memes_tetes(lignes, cle)
            rapport[cle] = (
                f"{gardees} conservées (dont {tete} même tête), {compte[VARIANTE]} variantes,"
                f" {compte[ORDRE_DIFFERENT]} autre ordre, {compte[DIFFERENT]} différentes,"
                f" {compte[NON_RECONCILIE]} non réconciliées, {compte[ABSENT]} absentes"
            )
        else:
            rapport[cle] = lus.get(cle, SourceLue({})).note or "absent"
    for s in simulations:
        rapport[s.nom] = f"{s.decompositions_changees} décompositions changées ; " + " ; ".join(
            f"{i.parcours} : premier écart {i.premier_ecart or 'aucun'}, {len(i.deplaces)} déplacés"
            for i in s.impacts
        )
    rapport["document"] = str(document)
    return rapport


# --------------------------------------------------------------------------- check


NOM_CONTROLE = "licences : décompositions"


def controles(export: Path | None = None) -> list[Controle]:
    """Signalé, jamais bloquant tant que la décision n'est pas prise (§10).

    Relit l'export versionné — la CI l'a, sans `wenlu ingest` — et compte les
    décompositions qui descendent encore un IDS de `dictionary.txt` (LGPL).
    """
    version = derniere_version(export)
    if version is None:
        return [Controle(NOM_CONTROLE, True, "aucune version exportée")]
    exportes = lire_export(version)
    decomposes = [e for e in exportes.values() if e.parts]
    lgpl = sorted(e.c for e in decomposes if SOURCE_MMAH in e.sources)
    detail = (
        f"{version.name} : {len(lgpl)} décompositions sur {len(decomposes)} descendent un IDS"
        " de Make Me a Hanzi (LGPL), décision ouverte (docs/sources-licences.md §10)"
    )
    if lgpl:
        detail += " : " + "".join(lgpl[:20]) + ("…" if len(lgpl) > 20 else "")
    return [Controle(NOM_CONTROLE, not lgpl, detail)]
