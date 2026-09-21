"""Ingestion d'Unihan (Unicode Character Database), sous Unicode License.

Unihan est la source permissive du projet, préférée à `dictionary.txt` (LGPL,
écarté de l'embarqué) pour :

- `kMandarin` : le pinyin. Une entrée peut porter plusieurs lectures séparées
  par une espace ; UAX #38 donne la première comme la plus courante en zh-CN.
  On retient la première comme `pinyin` et on conserve les autres.
- `kTotalStrokes` : le nombre de traits.
- `kFrequency` : palier de fréquence, **absent d'Unihan 17.0.0 et 18.0.0** ; il
  était encore publié en 12.0.0. Le parseur le lit quand la version servie le
  porte ; sinon `frequence` vaut None et `rangs_frequence` rend `{}`.

`kDefinition` est en anglais. Comme les gloses de CC-CEDICT, elle ne doit jamais
alimenter la génération des fiches FR : elle est écrite dans un fichier séparé
(voir `data/schema.md` et `docs/sources-licences.md` §4.2).

Unihan ne décompose pas les caractères : aucun champ `kIDS` n'existe en
Unicode 17.0.0. La source d'IDS de repli est `cjkdecomp.py`.

Entrée : `Unihan.zip` tel que publié par Unicode, ou un dossier contenant les
fichiers `Unihan_*.txt` extraits. Chaque fichier lu doit porter son en-tête
officiel (`# Unihan_….txt`, `# Date: …`, `# Unicode Version …`).
"""
from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Sequence

# En-tête officiel : nom du fichier, date de publication, version d'Unicode.
# La ligne de version s'écrit « # Unicode Version 17.0.0 » depuis Unicode 16.0
# et « # Unicode version: 12.0.0 » avant.
ENTETE_NOM = re.compile(r"^#\s*(?P<nom>Unihan_[A-Za-z]+\.txt)\s*$")
ENTETE_DATE = re.compile(r"^#\s*Date:\s*(?P<date>.+?)\s*$")
ENTETE_VERSION = re.compile(r"^#\s*Unicode [Vv]ersion:?\s*(?P<version>[0-9][0-9.]*)\s*$")

LIGNE = re.compile(r"^(?P<code>U\+[0-9A-F]{4,6})\t(?P<champ>k[A-Za-z0-9_]+)\t(?P<valeur>.*)$")

PINYIN = "kMandarin"
TRAITS = "kTotalStrokes"
FREQUENCE = "kFrequency"
DEFINITION = "kDefinition"
CHAMPS = (PINYIN, TRAITS, FREQUENCE, DEFINITION)

# Les trois fichiers d'Unihan qui portent ces champs. Les autres sont ignorés.
FICHIERS = ("Unihan_Readings.txt", "Unihan_IRGSources.txt", "Unihan_DictionaryLikeData.txt")

ARCHIVE = "Unihan.zip"
LICENCE = "Unicode License"
# Archive officielle d'Unicode ; le miroir sert la même archive quand
# `unicode.org` est injoignable (voir `fetch.py`).
URL_OFFICIELLE = "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip"
URL_MIROIR = (
    "https://media.githubusercontent.com/media/"
    "Sweta7373732006/chinese_evaluation2/main/data/unihan/Unihan.zip"
)
# Ligne d'en-tête cherchée au téléchargement, dans le membre témoin.
ENTETE = "# Unicode Version"
# Membre témoin : son en-tête sert à valider l'archive au téléchargement.
MEMBRE_TEMOIN = "Unihan_Readings.txt"


class UnihanInvalide(ValueError):
    """Fichier Unihan sans en-tête officiel, illisible, ou de versions mêlées."""


@dataclass(frozen=True)
class EnteteUnihan:
    """En-tête officiel d'un fichier `Unihan_*.txt`."""

    fichier: str
    date: str
    version: str


@dataclass(frozen=True)
class CaractereUnihan:
    """Un caractère tel que décrit par Unihan, définition mise à part."""

    c: str
    code: str
    pinyin: str | None = None
    lectures: tuple[str, ...] = ()
    traits: int | None = None
    frequence: int | None = None


def caractere(code: str) -> str:
    """`U+4E2D` -> `中`."""
    return chr(int(code[2:], 16))


def lire_entete(lignes: Iterable[str]) -> EnteteUnihan:
    """Lit l'en-tête officiel. Lève `UnihanInvalide` s'il manque le nom ou la version."""
    nom = date = version = None
    for ligne in lignes:
        if not ligne.startswith("#"):
            break
        if nom is None and (trouve := ENTETE_NOM.match(ligne)):
            nom = trouve["nom"]
        elif date is None and (trouve := ENTETE_DATE.match(ligne)):
            date = trouve["date"]
        elif version is None and (trouve := ENTETE_VERSION.match(ligne)):
            version = trouve["version"]
    if nom is None or version is None:
        raise UnihanInvalide(
            "en-tête Unihan officiel absent (nom du fichier et « Unicode Version » attendus)"
        )
    return EnteteUnihan(fichier=nom, date=date or "", version=version)


def parse_ligne(ligne: str) -> tuple[str, str, str] | None:
    """Lit une ligne `U+XXXX<tab>kChamp<tab>valeur`. None pour un commentaire."""
    ligne = ligne.rstrip("\n")
    if not ligne.strip() or ligne.startswith("#"):
        return None
    trouve = LIGNE.match(ligne)
    if not trouve:
        raise UnihanInvalide(f"ligne Unihan illisible : {ligne[:60]!r}")
    return trouve["code"], trouve["champ"], trouve["valeur"]


def lire_fichier(lignes: Iterable[str]) -> tuple[EnteteUnihan, dict[str, dict[str, str]]]:
    """Lit un fichier Unihan : en-tête vérifié, champs retenus indexés par point de code."""
    lignes = list(lignes)
    entete = lire_entete(lignes)
    valeurs: dict[str, dict[str, str]] = {}
    for ligne in lignes:
        lue = parse_ligne(ligne)
        if lue is None:
            continue
        code, champ, valeur = lue
        if champ in CHAMPS:
            valeurs.setdefault(code, {})[champ] = valeur
    return entete, valeurs


def _membres(source: Path) -> Iterator[tuple[str, list[str]]]:
    """Rend (nom, lignes) pour chaque fichier retenu, depuis l'archive ou le dossier."""
    if source.is_dir():
        for nom in FICHIERS:
            fichier = source / nom
            if fichier.exists():
                yield nom, fichier.read_text(encoding="utf-8").splitlines()
        return
    with zipfile.ZipFile(source) as archive:
        presents = set(archive.namelist())
        for nom in FICHIERS:
            if nom in presents:
                yield nom, archive.read(nom).decode("utf-8").splitlines()


def ouvrir_membre(source: Path, nom: str) -> list[str]:
    """Lignes d'un membre de l'archive (ou d'un fichier du dossier)."""
    if source.is_dir():
        return (source / nom).read_text(encoding="utf-8").splitlines()
    with zipfile.ZipFile(source) as archive:
        return archive.read(nom).decode("utf-8").splitlines()


@dataclass(frozen=True)
class Unihan:
    """Unihan ingéré : provenance, caractères, définitions anglaises à part."""

    version: str
    date: str
    fichiers: tuple[EnteteUnihan, ...]
    caracteres: tuple[CaractereUnihan, ...]
    definitions: tuple[tuple[str, str], ...]

    @property
    def avec_frequence(self) -> bool:
        """Vrai si la version servie porte encore `kFrequency`."""
        return any(c.frequence is not None for c in self.caracteres)


def _entier(valeur: str) -> int | None:
    """Premier entier d'une valeur Unihan, ou None."""
    for morceau in valeur.split():
        if morceau.isdigit():
            return int(morceau)
    return None


def collecter(source: Path) -> Unihan:
    """Lit `Unihan.zip` (ou un dossier extrait) et rend les champs retenus.

    Lève `UnihanInvalide` si un fichier n'a pas son en-tête officiel ou si les
    fichiers lus ne sont pas de la même version d'Unicode.
    """
    entetes: list[EnteteUnihan] = []
    valeurs: dict[str, dict[str, str]] = {}
    for nom, lignes in _membres(source):
        entete, lues = lire_fichier(lignes)
        if entete.fichier != nom:
            raise UnihanInvalide(f"{nom} porte l'en-tête de {entete.fichier}")
        entetes.append(entete)
        for code, champs in lues.items():
            valeurs.setdefault(code, {}).update(champs)
    if not entetes:
        raise UnihanInvalide(f"aucun fichier Unihan dans {source}")
    versions = {e.version for e in entetes}
    if len(versions) > 1:
        raise UnihanInvalide(f"versions Unihan mêlées : {', '.join(sorted(versions))}")

    caracteres: list[CaractereUnihan] = []
    definitions: list[tuple[str, str]] = []
    for code in sorted(valeurs):
        champs = valeurs[code]
        c = caractere(code)
        if DEFINITION in champs:
            definitions.append((c, champs[DEFINITION]))
        lectures = tuple(champs.get(PINYIN, "").split())
        traits = _entier(champs.get(TRAITS, ""))
        frequence = _entier(champs.get(FREQUENCE, ""))
        if not lectures and traits is None and frequence is None:
            continue
        caracteres.append(
            CaractereUnihan(
                c=c,
                code=code,
                pinyin=lectures[0] if lectures else None,
                lectures=lectures,
                traits=traits,
                frequence=frequence,
            )
        )
    return Unihan(
        version=entetes[0].version,
        date=entetes[0].date,
        fichiers=tuple(entetes),
        caracteres=tuple(caracteres),
        definitions=tuple(definitions),
    )


def rangs_frequence(caracteres: Sequence[CaractereUnihan]) -> dict[str, int]:
    """Rang de fréquence par caractère, 1 pour le plus fréquent.

    `kFrequency` classe en cinq paliers, 1 étant le plus fréquent : le rang qui
    en découle est grossier, et les caractères d'un même palier sont départagés
    par leur point de code. Rend `{}` quand la version servie ne porte plus le
    champ, pour que le graphe retombe sur son ordre par défaut.
    """
    avec = [c for c in caracteres if c.frequence is not None]
    ordonnes = sorted(avec, key=lambda c: (c.frequence, c.code))
    return {c.c: rang for rang, c in enumerate(ordonnes, start=1)}


def document(unihan: Unihan, *, url: str, licence: str) -> dict[str, object]:
    """Contenu de `unihan.json` (voir `data/schema.md`)."""
    return {
        "source": "Unihan (Unicode Character Database)",
        "licence": licence,
        "url": url,
        "version": unihan.version,
        "date": unihan.date,
        "fichiers": [
            {"fichier": e.fichier, "date": e.date, "version": e.version} for e in unihan.fichiers
        ],
        "champs": [PINYIN, TRAITS, FREQUENCE],
        "frequence": FREQUENCE if unihan.avec_frequence else f"{FREQUENCE} absent de cette version",
        "caracteres": [
            {
                "c": c.c,
                "code": c.code,
                "pinyin": c.pinyin,
                "lectures": list(c.lectures),
                "traits": c.traits,
                "frequence": c.frequence,
            }
            for c in unihan.caracteres
        ],
    }


def document_definitions(unihan: Unihan, *, url: str, licence: str) -> dict[str, object]:
    """Contenu de `unihan-definitions.json` : anglais, jamais exposé aux invites FR."""
    return {
        "source": "Unihan (Unicode Character Database)",
        "licence": licence,
        "url": url,
        "version": unihan.version,
        "champs": [DEFINITION],
        "regime": "anglais seul ; ne jamais alimenter la génération des fiches FR",
        "definitions": [{"c": c, "definition_en": d} for c, d in unihan.definitions],
    }
