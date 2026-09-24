"""Ingestion des sources brutes vers des structures normalisées.

Trois entrées :

- `dictionary.txt` (Make Me a Hanzi) : une ligne JSON par caractère, décomposition IDS,
  radical, pinyin, définition EN et, quand elle existe, une étymologie EN.
- `graphics.txt` (Make Me a Hanzi) : une ligne JSON par caractère, traits SVG et médianes.
- `cedict_1_0_ts_utf-8_mdbg.txt.gz` (CC-CEDICT) : une ligne par mot. Le fichier est
  lu compressé ou non : le miroir de repli sert le fichier officiel non compressé
  sous le même nom, et c'est la signature gzip qui tranche.
- `Unihan.zip` (UCD, Unicode License) : pinyin, traits et, si la version le porte
  encore, fréquence. Voir `unihan.py` ; les définitions anglaises partent dans un
  fichier séparé, comme les gloses de CC-CEDICT.
- `cjk-decomp.txt` (MIT) : décompositions converties en IDS, source de repli
  quand Make Me a Hanzi note `？`. Voir `cjkdecomp.py`.

L'étymologie de Make Me a Hanzi alimente la couche étymologique. Elle ne fait pas
autorité sur la décomposition canonique GF 0014-2009, réconciliée en story 1.2 :
`decomposition` est donc conservée telle quelle, à part, sous son nom de source.

Sortie : data/work/ingest/*.json (voir data/schema.md).
"""
from __future__ import annotations

import gzip
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Iterator, TextIO, cast

from . import cjkdecomp, unihan
from .outils import ecrire_json
from .paths import INGEST, LISTES, SOURCES

# Blocs Unicode des sinogrammes (idéogrammes unifiés et compatibilité).
BLOCS_SINOGRAMMES: tuple[tuple[int, int], ...] = (
    (0x3400, 0x4DBF),  # extension A
    (0x4E00, 0x9FFF),  # idéogrammes unifiés
    (0xF900, 0xFAFF),  # compatibilité
    (0x20000, 0x2A6DF),  # extension B
    (0x2A700, 0x2EBEF),  # extensions C à F
)

TYPES_ETYMOLOGIE = ("pictographic", "ideographic", "pictophonetic")

LIGNE_CEDICT = re.compile(r"^(?P<trad>\S+)\s+(?P<simp>\S+)\s+\[(?P<pinyin>[^\]]*)\]\s+/(?P<defs>.*)/\s*$")


class SourceInvalide(ValueError):
    """Ligne de source illisible."""


class ListeInvalide(ValueError):
    """Liste de niveau invalide : doublon, ligne vide de sens ou non-sinogramme."""


def est_sinogramme(c: str) -> bool:
    """Vrai si `c` est un caractère unique appartenant à un bloc de sinogrammes."""
    if len(c) != 1:
        return False
    p = ord(c)
    return any(debut <= p <= fin for debut, fin in BLOCS_SINOGRAMMES)


# --------------------------------------------------------------------------- sources


@dataclass(frozen=True)
class Etymologie:
    """Couche étymologique EN de Make Me a Hanzi, distincte de la décomposition canonique."""

    type: str
    hint: str | None = None
    phonetic: str | None = None
    semantic: str | None = None


@dataclass(frozen=True)
class CaractereSource:
    """Un caractère tel que fourni par `dictionary.txt`."""

    c: str
    decomposition: str
    radical: str
    pinyin: list[str] = field(default_factory=list)
    definition_en: str | None = None
    etymologie: Etymologie | None = None


@dataclass(frozen=True)
class GraphieSource:
    """Traits et médianes d'un caractère, tels que fournis par `graphics.txt`."""

    c: str
    strokes: list[str]
    medians: list[list[list[float]]]


@dataclass(frozen=True)
class MotSource:
    """Une entrée CC-CEDICT."""

    traditionnel: str
    simplifie: str
    pinyin: str
    definitions_en: list[str]


def parse_ligne_dictionnaire(ligne: str) -> CaractereSource:
    """Lit une ligne JSON de `dictionary.txt`."""
    try:
        brut = json.loads(ligne)
    except json.JSONDecodeError as erreur:  # pragma: no cover - message seulement
        raise SourceInvalide(f"ligne dictionary.txt illisible : {ligne[:60]!r}") from erreur
    if not brut.get("character"):
        raise SourceInvalide(f"ligne dictionary.txt sans caractère : {ligne[:60]!r}")
    etymologie = None
    if isinstance(brut.get("etymology"), dict):
        e = brut["etymology"]
        type_ = e.get("type", "")
        if type_ not in TYPES_ETYMOLOGIE:
            raise SourceInvalide(f"type d'étymologie inconnu : {type_!r}")
        etymologie = Etymologie(
            type=type_,
            hint=e.get("hint"),
            phonetic=e.get("phonetic"),
            semantic=e.get("semantic"),
        )
    return CaractereSource(
        c=brut["character"],
        decomposition=brut.get("decomposition", ""),
        radical=brut.get("radical", ""),
        pinyin=list(brut.get("pinyin") or []),
        definition_en=brut.get("definition"),
        etymologie=etymologie,
    )


def parse_ligne_graphies(ligne: str) -> GraphieSource:
    """Lit une ligne JSON de `graphics.txt`."""
    try:
        brut = json.loads(ligne)
    except json.JSONDecodeError as erreur:  # pragma: no cover - message seulement
        raise SourceInvalide(f"ligne graphics.txt illisible : {ligne[:60]!r}") from erreur
    if not brut.get("character"):
        raise SourceInvalide(f"ligne graphics.txt sans caractère : {ligne[:60]!r}")
    strokes = brut.get("strokes") or []
    medians = brut.get("medians") or []
    if len(strokes) != len(medians):
        raise SourceInvalide(f"{brut['character']} : {len(strokes)} traits pour {len(medians)} médianes")
    return GraphieSource(c=brut["character"], strokes=list(strokes), medians=list(medians))


def parse_ligne_cedict(ligne: str) -> MotSource | None:
    """Lit une ligne CC-CEDICT. Retourne None pour un commentaire ou une ligne vide."""
    ligne = ligne.rstrip("\n")
    if not ligne.strip() or ligne.startswith("#"):
        return None
    trouve = LIGNE_CEDICT.match(ligne)
    if not trouve:
        raise SourceInvalide(f"ligne CC-CEDICT illisible : {ligne[:60]!r}")
    definitions = [d for d in trouve["defs"].split("/") if d]
    return MotSource(
        traditionnel=trouve["trad"],
        simplifie=trouve["simp"],
        pinyin=trouve["pinyin"],
        definitions_en=definitions,
    )


def lire_dictionnaire(chemin: Path) -> Iterator[CaractereSource]:
    with chemin.open(encoding="utf-8") as f:
        for ligne in f:
            if ligne.strip():
                yield parse_ligne_dictionnaire(ligne)


def lire_graphies(chemin: Path) -> Iterator[GraphieSource]:
    with chemin.open(encoding="utf-8") as f:
        for ligne in f:
            if ligne.strip():
                yield parse_ligne_graphies(ligne)


def est_gzip(chemin: Path) -> bool:
    """Vrai si le fichier porte la signature gzip (1f 8b), quel que soit son nom."""
    with chemin.open("rb") as f:
        return f.read(2) == b"\x1f\x8b"


def ouvrir_texte(chemin: Path) -> TextIO:
    """Ouvre un fichier en texte UTF-8, en le décompressant s'il est gzip.

    Le nom local de CC-CEDICT se termine par `.gz`, mais le miroir de repli sert
    le fichier officiel non compressé : c'est le contenu qui décide, pas le nom.
    """
    if est_gzip(chemin):
        return cast(TextIO, gzip.open(chemin, "rt", encoding="utf-8"))
    return chemin.open("rt", encoding="utf-8")


def lire_cedict(chemin: Path) -> Iterator[MotSource]:
    with ouvrir_texte(chemin) as f:
        for ligne in f:
            mot = parse_ligne_cedict(ligne)
            if mot is not None:
                yield mot


# --------------------------------------------------------------------------- listes


def parse_liste(lignes: Iterable[str], *, nom: str = "liste") -> list[str]:
    """Lit une liste de niveau : un sinogramme par ligne, `#` en commentaire.

    Refuse les doublons et tout ce qui n'est pas un sinogramme unique.
    """
    caracteres: list[str] = []
    vus: set[str] = set()
    for numero, brute in enumerate(lignes, start=1):
        ligne = brute.split("#", 1)[0].strip()
        if not ligne:
            continue
        if not est_sinogramme(ligne):
            raise ListeInvalide(f"{nom}, ligne {numero} : {ligne!r} n'est pas un sinogramme unique")
        if ligne in vus:
            raise ListeInvalide(f"{nom}, ligne {numero} : doublon {ligne!r}")
        vus.add(ligne)
        caracteres.append(ligne)
    return caracteres


def charger_liste(chemin: Path) -> list[str]:
    """Charge une liste de niveau depuis un fichier, dans l'ordre du fichier."""
    return parse_liste(chemin.read_text(encoding="utf-8").splitlines(), nom=chemin.name)


def charger_listes(dossier: Path | None = None) -> dict[str, list[str]]:
    """Charge toutes les listes de data/sources/listes/ (`seuil-255`, `hsk-1`, …)."""
    dossier = dossier or LISTES
    return {f.stem: charger_liste(f) for f in sorted(dossier.glob("*.txt"))}


# --------------------------------------------------------------------------- ingestion


CEDICT = "cedict_1_0_ts_utf-8_mdbg.txt.gz"
CJKDECOMP = "cjk-decomp.txt"
# Unihan est servi en archive ; un dossier de fichiers extraits fait aussi l'affaire.
DOSSIER_UNIHAN = "unihan"


def source_unihan(sources: Path) -> Path | None:
    """Archive `Unihan.zip` si elle est là, sinon le dossier extrait, sinon None."""
    for candidat in (sources / unihan.ARCHIVE, sources / DOSSIER_UNIHAN):
        if candidat.exists():
            return candidat
    return None


def ingest(
    sources: Path | None = None,
    sortie: Path | None = None,
    listes: Path | None = None,
) -> dict[str, object]:
    """Normalise les sources et les listes dans `sortie`. Retourne un décompte.

    `dictionary.txt` et `graphics.txt` sont obligatoires. CC-CEDICT, Unihan et
    cjk-decomp sont facultatifs : s'ils manquent, leur JSON n'est pas écrit et le
    rapport le signale.
    """
    sources = sources or SOURCES
    sortie = sortie or INGEST
    sortie.mkdir(parents=True, exist_ok=True)

    caracteres = [asdict(c) for c in lire_dictionnaire(sources / "dictionary.txt")]
    ecrire_json(sortie / "caracteres.json", caracteres)

    graphies = [asdict(g) for g in lire_graphies(sources / "graphics.txt")]
    ecrire_json(sortie / "graphies.json", graphies)

    fichier_cedict = sources / CEDICT
    if fichier_cedict.exists():
        mots = [asdict(m) for m in lire_cedict(fichier_cedict)]
        ecrire_json(sortie / "mots.json", mots)
        nombre_mots: object = len(mots)
    else:
        nombre_mots = f"source absente ({CEDICT})"

    origine = source_unihan(sources)
    if origine is not None:
        donnees = unihan.collecter(origine)
        ecrire_json(
            sortie / "unihan.json",
            unihan.document(donnees, url=unihan.URL_OFFICIELLE, licence=unihan.LICENCE),
        )
        ecrire_json(
            sortie / "unihan-definitions.json",
            unihan.document_definitions(
                donnees, url=unihan.URL_OFFICIELLE, licence=unihan.LICENCE
            ),
        )
        resume_unihan: object = f"{len(donnees.caracteres)} caractères (Unicode {donnees.version})"
        frequence_unihan: object = (
            f"{unihan.FREQUENCE} présent"
            if donnees.avec_frequence
            else f"{unihan.FREQUENCE} absent de cette version"
        )
        definitions_unihan: object = len(donnees.definitions)
    else:
        resume_unihan = f"source absente ({unihan.ARCHIVE})"
        frequence_unihan = "—"
        definitions_unihan = "—"

    fichier_cjkdecomp = sources / CJKDECOMP
    if fichier_cjkdecomp.exists():
        ids_secondaires = cjkdecomp.ids_par_caractere(cjkdecomp.charger(fichier_cjkdecomp))
        ecrire_json(sortie / "ids-secondaires.json", cjkdecomp.document(ids_secondaires))
        resume_ids: object = len(ids_secondaires)
    else:
        resume_ids = f"source absente ({CJKDECOMP})"

    niveaux = charger_listes(listes)
    ecrire_json(sortie / "listes.json", niveaux)

    connus = {c["c"] for c in caracteres}
    rapport: dict[str, object] = {
        "caracteres": len(caracteres),
        "caracteres_avec_etymologie": sum(1 for c in caracteres if c["etymologie"]),
        "graphies": len(graphies),
        "mots": nombre_mots,
        "unihan": resume_unihan,
        "unihan_frequence": frequence_unihan,
        "unihan_definitions": definitions_unihan,
        "ids_secondaires": resume_ids,
        **{f"liste_{nom}": len(v) for nom, v in niveaux.items()},
        **{
            f"liste_{nom}_absents_du_dictionnaire": sum(1 for c in v if c not in connus)
            for nom, v in niveaux.items()
        },
    }
    ecrire_json(sortie / "rapport.json", rapport)
    return rapport
