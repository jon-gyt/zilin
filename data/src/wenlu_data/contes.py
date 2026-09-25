"""Contes par niveau (story 1.7).

Un même récit traditionnel est réécrit à plusieurs niveaux avec les seuls caractères
du niveau : le seuil sinographique 255 (les trois contes gratuits), puis les niveaux du
HSK 3.0 (GF 0025-2021), de `hsk1` à `hsk6` et `hsk7-9`, chacun lu en cumul (`hsk3` :
les caractères des niveaux 1 à 3). Les seuils 405 à 1555 restent connus du code, mais
leurs listes ne sont pas versionnées : les contes suivent le HSK (décision du
propriétaire). Le catalogue des récits est versionné dans
`data/sources/contes/catalogue.tsv` ; il ne porte que le titre, l'ouvrage d'origine
et un résumé d'intrigue en une phrase. Aucun texte de conte n'entre dans le dépôt
sans passer par le pipeline : il sort de la génération par l'API ou de l'import d'un
brouillon rédigé sans API, avec les mêmes contrôles, puis d'une relecture humaine.

Le catalogue dit aussi, pour chaque récit, ses niveaux prévus (deux pour un récit
simple, trois pour un récit riche ; critère en tête du catalogue) et son nombre de
chapitres : 1 pour une fable, plus pour un récit long, lu chapitre par chapitre, dont
`chapitres.tsv` décrit chaque chapitre. Un niveau prévu non écrit, faute de liste ou de
rédacteur, est un écart que `wenlu check` signale, jamais un blocage.

Chaîne : `invite()` construit l'invite (système + utilisateur), Claude répond en JSON
structuré, `valider()` refuse toute version qui sort de la liste du seuil, et la
génération relance avec les intrus signalés, au plus `ESSAIS_MAX` fois. Chaque version
écrite porte sa traçabilité (conte, seuil, modèle, date, empreinte de l'invite, nombre
d'essais) et le statut « à relire » : la relecture humaine est obligatoire avant export.

Une version donne, phrase par phrase, le chinois, le pinyin (une syllabe par
sinogramme), la traduction française et anglaise, et une glose par caractère ou par
mot (pinyin, sens court en français et en anglais) que le lecteur de l'app affiche au
toucher : à chaque position, l'entrée la plus longue qui commence là.

Licences : l'invite ne reçoit jamais de définition anglaise de CC-CEDICT (voir
`docs/sources-licences.md` §4.2). Ce module ne lit ni `mots.json` ni les définitions
de Make Me a Hanzi ; traductions et glose sont rédigées par Claude, ou par le
rédacteur d'un brouillon, en ses propres mots.

Deux chemins d'appel à l'API, même invite :

- unitaire : `wenlu contes generer --seuil 255 --conte shou-zhu-dai-tu`, réponse
  immédiate, relance automatique sur intrus ;
- par lots : `wenlu contes generer --seuil 255` soumet tous les contes du seuil en une
  fois à l'API Message Batches (moitié prix, résultat sous 24 h), puis
  `wenlu contes recuperer` récupère, valide, écrit, et resoumet ce qui a été rejeté.

Sans API : un rédacteur (un agent Claude Code dans sa session, sans clé ni réseau)
lit `wenlu contes contexte yu-gong-yi-shan --seuil 255` — la liste exacte du seuil,
le résumé du catalogue, les contraintes —, écrit un brouillon dans
`data/sources/contes-brouillons/<id>/<seuil>.json`, et `wenlu contes importer` le fait
passer par le même `valider()`. La traçabilité le dit : `api` vaut
« session Claude Code (sans API) », `modele` « rédaction manuelle », l'empreinte est
celle du brouillon.

Sortie : `data/sources/contes-versions/<seuil>/<id>.json`, versionné (format dans
`data/schema.md`) ; journal des lots, état de travail hors dépôt, dans
`data/work/contes/lots/<lot>.json`.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Callable, Iterable, Mapping, Optional, Sequence

import typer

from . import claude
from .claude import (  # noqa: F401 — réexportés : les noms restent importables d'ici
    API_LOTS,
    API_UNITAIRE,
    MAX_TOKENS,
    MODELE,
    CleAbsente,
    ClientClaude,
    Invite,
    ReponseInvalide,
    RequeteLot,
    ResultatLot,
)
from .claude import maintenant as _maintenant
from .claude import sans_cloture as _sans_cloture
from .fonts import PONCTUATION_CHINOISE
from .gf0014 import Controle
from .ingest import charger_liste, est_sinogramme
from .paths import CONTES, CONTES_WORK, DATA, LISTES, RACINE, WORK


#: Seuils sinographiques de l'Éducation nationale.
SEUILS: tuple[int, ...] = (255, 405, 505, 805, 1555)

#: Niveaux du HSK 3.0 (GF 0025-2021) : 1 à 6, puis 7-9, que la norme ne départage pas.
#: Chacun se lit en cumul : `hsk3` autorise les caractères des niveaux 1, 2 et 3.
HSK: tuple[str, ...] = ("hsk1", "hsk2", "hsk3", "hsk4", "hsk5", "hsk6", "hsk7-9")

#: Un niveau de conte : un seuil, nombre (255), ou un niveau HSK, chaîne ("hsk3"). C'est
#: aussi sa forme dans les JSON (`"seuil": 255`, `"seuil": "hsk3"`) et son nom dans les
#: chemins (`255/`, `hsk3.json`).
Niveau = int | str

#: Les caractères de chaque niveau HSK, cumul compris : 300 nouveaux par niveau de 1 à 6,
#: 1 200 pour 7-9. C'est aussi ce qui range les niveaux d'un cadre à l'autre (255 < hsk1).
CUMULS_HSK: dict[str, int] = {
    "hsk1": 300,
    "hsk2": 600,
    "hsk3": 900,
    "hsk4": 1200,
    "hsk5": 1500,
    "hsk6": 1800,
    "hsk7-9": 3000,
}

#: Longueur visée du texte chinois, en sinogrammes, ponctuation non comprise. Un niveau
#: HSK vise celle du seuil de taille voisine : HSK 1 (300 caractères) celle de 255, HSK 2
#: (600) celle de 505, HSK 3 (900) celle de 805, HSK 5 (1 500) et au-delà celle de 1555 ;
#: HSK 4 entre les deux.
LONGUEURS: dict[Niveau, tuple[int, int]] = {
    255: (60, 120),
    405: (100, 180),
    505: (150, 260),
    805: (220, 380),
    1555: (320, 560),
    "hsk1": (60, 120),
    "hsk2": (150, 260),
    "hsk3": (220, 380),
    "hsk4": (270, 470),
    "hsk5": (320, 560),
    "hsk6": (320, 560),
    "hsk7-9": (320, 560),
}

#: Au plus trois appels pour un même conte à un même seuil.
ESSAIS_MAX = 3

#: Le journal des lots d'API : l'état d'un passage, hors dépôt.
LOTS_WORK = WORK / "contes" / "lots"

A_RELIRE = "a_relire"
REJETE = "rejete"
RELU = "relu"
STATUTS = (A_RELIRE, REJETE, RELU)

COLONNES = (
    "id",
    "titre_zh",
    "titre_pinyin",
    "titre_fr",
    "titre_en",
    "ouvrage",
    "niveaux",
    "chapitres",
    "resume_fr",
)

#: Les colonnes de `chapitres.tsv` : un chapitre prévu d'un récit long.
COLONNES_CHAPITRES = ("conte", "n", "titre_fr", "titre_en", "resume_fr")

#: Un récit simple s'écrit à deux niveaux, un récit riche à trois (critère dans le catalogue).
NIVEAUX_PAR_CONTE = (2, 3)


class CatalogueInvalide(ValueError):
    """Catalogue des contes illisible ou incohérent."""


class SeuilInconnu(ValueError):
    """Niveau hors des seuils sinographiques et des niveaux HSK."""


class SeuilSansListe(FileNotFoundError):
    """Le niveau existe mais sa liste de caractères n'est pas encore versionnée."""


# --------------------------------------------------------------------------- niveaux


def lire_niveau(valeur: object) -> Niveau:
    """`255`, `"255"` → 255 ; `"hsk3"`, `"HSK3"` → "hsk3". Refuse tout autre niveau."""
    if isinstance(valeur, bool):
        raise SeuilInconnu(f"niveau {valeur!r} inconnu")
    if isinstance(valeur, str):
        texte = valeur.strip().lower()
        valeur = int(texte) if texte.isdigit() else texte
    if valeur in SEUILS or valeur in HSK:
        return valeur  # type: ignore[return-value]
    raise SeuilInconnu(
        f"niveau {valeur!r} inconnu : les seuils {', '.join(str(s) for s in SEUILS)}, "
        f"ou les niveaux HSK {', '.join(HSK)}"
    )


def niveau_brut(valeur: object) -> Niveau:
    """Un niveau tel qu'un fichier l'écrit, sans le juger : un nombre reste un nombre
    (`"255"` → 255), une chaîne passe en minuscules. Pour relire ce que le pipeline a écrit."""
    if isinstance(valeur, bool):
        return 0
    if isinstance(valeur, int):
        return valeur
    texte = str(valeur).strip().lower()
    return int(texte) if texte.isdigit() else texte


def est_hsk(niveau: Niveau) -> bool:
    return niveau in HSK


def rang(niveau: Niveau) -> int:
    """Le nombre de caractères du niveau, cumul compris : 255 pour le seuil 255, 900 pour
    `hsk3`. Il range les niveaux d'un cadre à l'autre. Un niveau inconnu passe en dernier."""
    if isinstance(niveau, int):
        return niveau
    return CUMULS_HSK.get(niveau, 10**6)


def libelle(niveau: Niveau) -> str:
    """« seuil 255 », « HSK 3 », « HSK 7-9 » : un niveau dans une phrase."""
    if isinstance(niveau, str) and niveau.startswith("hsk"):
        return f"HSK {niveau[3:]}"
    return f"seuil {niveau}"


def au_niveau(niveau: Niveau) -> str:
    """« au seuil 255 », « au niveau HSK 3 »."""
    return f"au niveau {libelle(niveau)}" if est_hsk(niveau) else f"au {libelle(niveau)}"


#: Le dernier palier de l'échelle des contes : HSK 7-9.
DERNIER_PALIER = len(HSK)


def palier(niveau: Niveau) -> int:
    """La place d'un niveau sur l'échelle des contes, de 1 (HSK 1) à 7 (HSK 7-9). Le seuil
    255 se place au palier de HSK 1 : 255 caractères contre 300, tous dans HSK 1 à 3."""
    if niveau == 255:
        return 1
    if isinstance(niveau, str) and niveau in HSK:
        return HSK.index(niveau) + 1
    raise SeuilInconnu(f"niveau {niveau!r} hors de l'échelle des contes (255, {', '.join(HSK)})")


def niveaux_attendus(plus_bas: Niveau, nombre: int) -> tuple[Niveau, ...]:
    """Les niveaux d'un conte selon le critère du catalogue : le plus bas, puis chaque fois
    deux paliers plus haut, sans dépasser HSK 7-9 ; quand le haut de l'échelle manque de
    place, les paliers restants au-dessus du plus bas comblent, s'il y en a. `nombre` : 2
    pour un récit simple, 3 pour un récit riche.

    `hsk2` simple → hsk2, hsk4 ; riche → hsk2, hsk4, hsk6. `hsk5` riche → hsk5, hsk6,
    hsk7-9. `hsk7-9` → hsk7-9 seul. 255 riche → 255, hsk3, hsk5.
    """
    depart = palier(plus_bas)
    paliers = sorted({min(depart + 2 * k, DERNIER_PALIER) for k in range(nombre)})
    for p in range(depart + 1, DERNIER_PALIER + 1):
        if len(paliers) >= nombre:
            break
        if p not in paliers:
            paliers = sorted([*paliers, p])
    return (plus_bas, *(HSK[p - 1] for p in paliers[1:]))


# --------------------------------------------------------------------------- catalogue


@dataclass(frozen=True)
class ChapitrePrevu:
    """Un chapitre prévu d'un récit long (`chapitres.tsv`) : son rang, ses titres, son résumé."""

    n: int
    titre_fr: str
    titre_en: str
    resume_fr: str


@dataclass(frozen=True)
class Conte:
    """Une ligne du catalogue : un récit traditionnel, sa source et ce qui en est prévu."""

    id: str
    titre_zh: str
    titre_fr: str
    ouvrage: str
    resume_fr: str
    titre_en: str = ""
    #: Le pinyin du vrai titre, une syllabe par caractère, aux tons du dictionnaire.
    titre_pinyin: str = ""
    #: Les niveaux où le récit sera écrit, croissants (255, "hsk3"…). Vide : non dit (fixtures).
    niveaux: tuple[Niveau, ...] = ()
    #: 1 pour une fable, lue d'une traite ; plus pour un récit long, lu chapitre par chapitre.
    chapitres: int = 1
    #: Les chapitres prévus d'un récit long, de 1 à `chapitres`. Vide pour une fable.
    plan: tuple[ChapitrePrevu, ...] = ()

    @property
    def long(self) -> bool:
        """Un récit long se lit chapitre par chapitre."""
        return self.chapitres > 1


def _lignes_tsv(lignes: Iterable[str], colonnes: tuple[str, ...], nom: str) -> list[tuple[int, tuple[str, ...]]]:
    """Les lignes utiles d'un TSV (`#` en commentaire), en-tête vérifié, cellules non vides."""
    entete: tuple[str, ...] | None = None
    lues: list[tuple[int, tuple[str, ...]]] = []
    for numero, brute in enumerate(lignes, start=1):
        ligne = brute.rstrip("\n")
        if not ligne.strip() or ligne.lstrip().startswith("#"):
            continue
        cellules = tuple(cellule.strip() for cellule in ligne.split("\t"))
        if entete is None:
            if cellules != colonnes:
                raise CatalogueInvalide(f"{nom}, ligne {numero} : en-tête attendu {colonnes}, lu {cellules}")
            entete = cellules
            continue
        if len(cellules) != len(colonnes):
            raise CatalogueInvalide(f"{nom}, ligne {numero} : {len(cellules)} colonnes pour {len(colonnes)}")
        if not all(cellules):
            raise CatalogueInvalide(f"{nom}, ligne {numero} : colonne vide")
        lues.append((numero, cellules))
    if entete is None:
        raise CatalogueInvalide(f"{nom} sans en-tête")
    return lues


def parse_niveaux(texte: str) -> tuple[Niveau, ...]:
    """`255,hsk3,hsk5` → (255, "hsk3", "hsk5") : des niveaux connus (seuils ou niveaux
    HSK), strictement croissants par leur nombre de caractères, deux (récit simple) ou
    trois (récit riche). Un seul, au dernier palier (`hsk7-9`) : l'échelle s'arrête là."""
    morceaux = [m.strip() for m in texte.split(",")]
    if not all(re.fullmatch(r"[0-9]+|[a-zA-Z0-9-]+", m) for m in morceaux):
        raise CatalogueInvalide(f"niveaux {texte!r} : des niveaux séparés par des virgules, 255,hsk3")
    niveaux: list[Niveau] = []
    inconnus: list[str] = []
    for morceau in morceaux:
        try:
            niveaux.append(lire_niveau(morceau))
        except SeuilInconnu:
            inconnus.append(morceau)
    if inconnus:
        raise CatalogueInvalide(
            f"niveaux {texte!r} : {', '.join(inconnus)} hors des seuils {SEUILS} et des niveaux {HSK}"
        )
    if [rang(n) for n in niveaux] != sorted({rang(n) for n in niveaux}):
        raise CatalogueInvalide(f"niveaux {texte!r} : strictement croissants, sans doublon")
    if niveaux == [HSK[-1]]:
        return tuple(niveaux)
    if len(niveaux) not in NIVEAUX_PAR_CONTE:
        raise CatalogueInvalide(
            f"niveaux {texte!r} : deux niveaux pour un récit simple, trois pour un récit riche "
            f"(un seul, {HSK[-1]}, quand le récit commence au dernier palier)"
        )
    return tuple(niveaux)


def parse_chapitres(lignes: Iterable[str]) -> dict[str, tuple[ChapitrePrevu, ...]]:
    """Lit `chapitres.tsv` : les chapitres prévus, par conte, dans l'ordre de leur rang."""
    par_conte: dict[str, list[ChapitrePrevu]] = {}
    for numero, cellules in _lignes_tsv(lignes, COLONNES_CHAPITRES, "chapitres"):
        valeurs = dict(zip(COLONNES_CHAPITRES, cellules))
        if not valeurs["n"].isdigit() or int(valeurs["n"]) < 1:
            raise CatalogueInvalide(f"chapitres, ligne {numero} : rang {valeurs['n']!r}, attendu 1, 2…")
        liste = par_conte.setdefault(valeurs["conte"], [])
        n = int(valeurs["n"])
        if n != len(liste) + 1:
            raise CatalogueInvalide(
                f"chapitres, ligne {numero} : {valeurs['conte']} chapitre {n}, attendu {len(liste) + 1}"
            )
        liste.append(ChapitrePrevu(n, valeurs["titre_fr"], valeurs["titre_en"], valeurs["resume_fr"]))
    return {conte: tuple(liste) for conte, liste in par_conte.items()}


def parse_catalogue(
    lignes: Iterable[str], chapitres: Mapping[str, Sequence[ChapitrePrevu]] | None = None
) -> list[Conte]:
    """Lit le catalogue TSV : `#` en commentaire, première ligne utile en en-tête.

    `chapitres` : les chapitres prévus des récits longs (`parse_chapitres`). Un récit long
    en a autant que sa colonne `chapitres`, une fable aucun.
    """
    chapitres = chapitres or {}
    contes: list[Conte] = []
    vus: set[str] = set()
    for numero, cellules in _lignes_tsv(lignes, COLONNES, "catalogue"):
        valeurs = dict(zip(COLONNES, cellules))
        if valeurs["id"] in vus:
            raise CatalogueInvalide(f"ligne {numero} : doublon d'identifiant {valeurs['id']!r}")
        vus.add(valeurs["id"])
        try:
            niveaux = parse_niveaux(valeurs.pop("niveaux"))
        except CatalogueInvalide as erreur:
            raise CatalogueInvalide(f"ligne {numero} : {erreur}") from erreur
        nombre = valeurs.pop("chapitres")
        if not nombre.isdigit() or int(nombre) < 1:
            raise CatalogueInvalide(f"ligne {numero} : chapitres {nombre!r}, attendu 1 pour une fable, plus pour un récit long")
        plan = tuple(chapitres.get(valeurs["id"], ()))
        if int(nombre) > 1 and len(plan) != int(nombre):
            raise CatalogueInvalide(
                f"ligne {numero} : {valeurs['id']} prévoit {nombre} chapitres, chapitres.tsv en décrit {len(plan)}"
            )
        if int(nombre) == 1 and plan:
            raise CatalogueInvalide(f"ligne {numero} : {valeurs['id']} est une fable, chapitres.tsv lui en donne")
        conte = Conte(**valeurs, niveaux=niveaux, chapitres=int(nombre), plan=plan)
        if len(conte.titre_pinyin.split()) != len(conte.titre_zh):
            raise CatalogueInvalide(f"ligne {numero} : une syllabe de pinyin par caractère du titre")
        contes.append(conte)
    orphelins = sorted(set(chapitres) - vus)
    if orphelins:
        raise CatalogueInvalide(f"chapitres.tsv : conte hors catalogue {', '.join(orphelins)}")
    return contes


def charger_catalogue(chemin: Path | None = None) -> list[Conte]:
    """Charge `data/sources/contes/catalogue.tsv`, et `chapitres.tsv` à côté s'il existe."""
    chemin = chemin or CONTES / "catalogue.tsv"
    fichier_chapitres = chemin.parent / "chapitres.tsv"
    chapitres = (
        parse_chapitres(fichier_chapitres.read_text(encoding="utf-8").splitlines())
        if fichier_chapitres.exists()
        else {}
    )
    return parse_catalogue(chemin.read_text(encoding="utf-8").splitlines(), chapitres)


def contes_du_seuil(catalogue: Iterable[Conte], seuil: Niveau) -> list[Conte]:
    """Les contes que la génération par l'API écrit à un seuil : ceux qui l'ont prévu, et
    seulement les fables. Un récit long se rédige par brouillon, chapitre par chapitre."""
    return [c for c in catalogue if not c.long and (not c.niveaux or seuil in c.niveaux)]


def conte_par_id(identifiant: str, catalogue: Sequence[Conte] | None = None) -> Conte:
    """Retrouve un conte par son identifiant."""
    for conte in catalogue if catalogue is not None else charger_catalogue():
        if conte.id == identifiant:
            return conte
    raise CatalogueInvalide(f"conte inconnu : {identifiant!r}")


# --------------------------------------------------------------------------- listes


def fichier_seuil(seuil: Niveau, dossier: Path | None = None) -> Path:
    """Le fichier propre à un niveau : `seuil-255.txt`, `hsk-3.txt` (les seuls caractères
    nouveaux du niveau 3), `hsk-7-9.txt`."""
    if isinstance(seuil, str) and seuil.startswith("hsk"):
        return (dossier or LISTES) / f"hsk-{seuil[3:]}.txt"
    return (dossier or LISTES) / f"seuil-{seuil}.txt"


def fichiers_du_niveau(seuil: Niveau, dossier: Path | None = None) -> list[Path]:
    """Les fichiers qu'un niveau lit : le sien pour un seuil ; pour un niveau HSK, ceux des
    niveaux 1 à lui, dans l'ordre (le cumul : `hsk3` lit hsk-1, hsk-2 et hsk-3)."""
    if isinstance(seuil, str) and seuil in HSK:
        return [fichier_seuil(n, dossier) for n in HSK[: HSK.index(seuil) + 1]]
    return [fichier_seuil(seuil, dossier)]


def liste_presente(seuil: Niveau, dossier: Path | None = None) -> bool:
    """Toutes les listes que le niveau lit sont versionnées."""
    return all(f.exists() for f in fichiers_du_niveau(seuil, dossier))


def charger_seuil(seuil: Niveau, dossier: Path | None = None) -> list[str]:
    """Caractères autorisés à un niveau. Refuse proprement un niveau sans liste.

    Un seuil lit sa liste ; un niveau HSK lit en cumul les listes des niveaux 1 à lui,
    dans l'ordre (`hsk3` : 900 caractères). Les listes des seuils 405 à 1555 ne sont pas
    versionnées : le code n'en connaît que le nom de fichier.
    """
    seuil = lire_niveau(seuil)
    absents = [f for f in fichiers_du_niveau(seuil, dossier) if not f.exists()]
    if absents:
        raise SeuilSansListe(
            f"{libelle(seuil)} : liste absente ({', '.join(str(f) for f in absents)}). "
            "Versionner la liste avant d'écrire les contes de ce niveau."
        )
    return [c for f in fichiers_du_niveau(seuil, dossier) for c in charger_liste(f)]


# --------------------------------------------------------------------------- invite

_PHRASE = {
    "type": "object",
    "properties": {
        "zh": {"type": "string"},
        "pinyin": {"type": "string"},
        "fr": {"type": "string"},
        "en": {"type": "string"},
    },
    "required": ["zh", "pinyin", "fr", "en"],
    "additionalProperties": False,
}

#: Schéma de sortie imposé au modèle (structured outputs, `output_config.format`).
SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "titre": {"type": "string"},
        "titre_pinyin": {"type": "string"},
        "phrases": {"type": "array", "items": _PHRASE},
        "glose": {"type": "array", "items": _PHRASE},
    },
    "required": ["titre", "titre_pinyin", "phrases", "glose"],
    "additionalProperties": False,
}

REGLE_PINYIN = (
    "une syllabe par caractère chinois, dans l'ordre, séparées par une espace, en "
    "minuscules, tons marqués, sans ponctuation ; les tons du dictionnaire, sans sandhi "
    "(一 yī, 不 bù), le ton neutre sans marque (儿子 ér zi)"
)

SYSTEME = f"""Tu réécris des récits traditionnels chinois pour des francophones qui apprennent \
à lire le chinois. Tu écris en chinois simplifié moderne, simple et clair.

Règles absolues, dans cet ordre :

1. Le titre et le texte chinois n'emploient QUE les caractères de la liste fournie. \
Aucun autre caractère, même courant, même évident, même dans un nom propre. Si un mot \
te manque, dis la chose autrement avec les caractères disponibles.
2. Seule ponctuation autorisée : {PONCTUATION_CHINOISE}
3. Tu racontes l'intrigue donnée, sans en changer la morale et sans inventer un autre \
récit. Tu ne cites ni ne recopies aucune phrase de l'ouvrage d'origine : tu réécris \
librement, en chinois moderne.
4. Le pinyin est donné pour le titre et pour chaque phrase : {REGLE_PINYIN}.
5. La traduction de chaque phrase est en français (fr) et en anglais (en), rédigée par \
toi pour un lecteur de chaque langue.
6. La glose couvre chaque caractère du titre et du texte, par caractère ou par mot : \
pour chaque entrée (zh), son pinyin tel qu'il est dans le texte, et un sens court en \
français (fr) et en anglais (en), un à trois mots, rédigé par toi, dans le sens qu'il a \
ici. Jamais de liste de sens, jamais de définition reprise d'un dictionnaire.
7. Des phrases courtes, de huit à vingt caractères, et un récit qui se tient du début \
à la fin.

Tu réponds par le seul objet JSON demandé, sans commentaire."""


def invite(
    conte: Conte,
    seuil: Niveau,
    autorises: Sequence[str],
    *,
    intrus: Sequence[str] = (),
) -> Invite:
    """Construit l'invite d'un conte à un niveau, éventuellement après un refus.

    `intrus` porte les caractères hors liste de l'essai précédent : ils sont
    signalés nommément pour la relance.
    """
    minimum, maximum = LONGUEURS.get(seuil, (60, 120))
    lignes = [
        f"Récit : {conte.titre_zh} — « {conte.titre_fr} ».",
        f"Ouvrage d'origine : {conte.ouvrage} (cité pour la traçabilité ; n'en recopie rien).",
        f"Intrigue à raconter : {conte.resume_fr}",
        "",
        (
            f"Niveau : {libelle(seuil)}, {rang(seuil)} caractères (les niveaux HSK cumulés)."
            if est_hsk(seuil)
            else f"Seuil : {seuil} caractères."
        ),
        f"Longueur visée : {minimum} à {maximum} caractères chinois, ponctuation non comprise.",
        "",
        f"Les {len(autorises)} seuls caractères autorisés :",
        "".join(autorises),
    ]
    if intrus:
        lignes += [
            "",
            "L'essai précédent a été refusé : les caractères suivants ne sont pas dans "
            f"la liste : {' '.join(intrus)}.",
            "Réécris le récit sans eux, en disant la chose autrement.",
        ]
    return Invite(systeme=SYSTEME, utilisateur="\n".join(lignes))


# --------------------------------------------------------------------------- version


@dataclass(frozen=True)
class Phrase:
    zh: str
    pinyin: str
    fr: str
    en: str = ""


@dataclass(frozen=True)
class Glose:
    """Ce que le lecteur affiche au toucher d'un caractère ou d'un mot."""

    fr: str
    pinyin: str = ""
    en: str = ""

    def en_json(self) -> dict[str, str]:
        return {"pinyin": self.pinyin, "fr": self.fr, "en": self.en}


@dataclass(frozen=True)
class Generation:
    """Traçabilité d'une version : d'où elle vient et comment."""

    modele: str
    api: str
    date: str
    empreinte_invite: str
    essais: int
    intrus: list[str] = field(default_factory=list)


def _glose(valeur: object) -> Glose:
    """Une entrée de glose : un objet {pinyin, fr, en}, ou le seul sens français."""
    if isinstance(valeur, Glose):
        return valeur
    if isinstance(valeur, Mapping):
        return Glose(
            fr=str(valeur.get("fr", "")),
            pinyin=str(valeur.get("pinyin", "")),
            en=str(valeur.get("en", "")),
        )
    return Glose(fr=str(valeur))


def phrase_en_json(p: Phrase) -> dict[str, str]:
    return {"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr, "en": p.en}


@dataclass(frozen=True)
class Chapitre:
    """Un chapitre d'une version : son titre chinois (vide pour une fable) et ses phrases.

    Une fable est une version d'un seul chapitre sans titre ; un récit long en a plusieurs,
    titrés, et se lit chapitre par chapitre. `titre_fr` et `titre_en` viennent du
    catalogue (`chapitres.tsv`), comme ceux du récit.
    """

    phrases: list[Phrase]
    titre: str = ""
    titre_pinyin: str = ""
    titre_fr: str = ""
    titre_en: str = ""

    def en_json(self) -> dict[str, object]:
        return {
            "titre": self.titre,
            "titre_pinyin": self.titre_pinyin,
            "titre_fr": self.titre_fr,
            "titre_en": self.titre_en,
            "phrases": [phrase_en_json(p) for p in self.phrases],
        }


def _phrase(p: Mapping[str, object]) -> Phrase:
    return Phrase(zh=str(p["zh"]), pinyin=str(p["pinyin"]), fr=str(p["fr"]), en=str(p.get("en", "")))


def chapitre_depuis_json(document: Mapping[str, object]) -> Chapitre:
    """Relit un chapitre écrit par `Chapitre.en_json`."""
    phrases = document.get("phrases")
    if not isinstance(phrases, list):
        raise ReponseInvalide("chapitre illisible : phrases hors format")
    return Chapitre(
        phrases=[_phrase(p) for p in phrases],
        titre=str(document.get("titre", "")),
        titre_pinyin=str(document.get("titre_pinyin", "")),
        titre_fr=str(document.get("titre_fr", "")),
        titre_en=str(document.get("titre_en", "")),
    )


@dataclass
class Version:
    """Une version d'un conte à un niveau.

    `chapitres` porte le texte ; `phrases` en est la suite, chapitre après chapitre. Une
    fable se construit par ses seules `phrases` (un chapitre sans titre), un récit long par
    ses `chapitres`. `seuil` est le niveau : un seuil (255) ou un niveau HSK ("hsk3") ; le
    nom du champ est historique.
    """

    conte: str
    seuil: Niveau
    titre: str
    titre_fr: str
    ouvrage: str
    resume_fr: str
    phrases: list[Phrase]
    glose: dict[str, Glose]
    generation: Generation
    statut: str = A_RELIRE
    titre_pinyin: str = ""
    titre_en: str = ""
    chapitres: list[Chapitre] = field(default_factory=list)

    def __post_init__(self) -> None:
        # Une glose écrite avant le pinyin et l'anglais ne portait que le français.
        self.glose = {str(zh): _glose(valeur) for zh, valeur in self.glose.items()}
        if self.chapitres:
            self.phrases = [p for c in self.chapitres for p in c.phrases]
        else:
            self.chapitres = [Chapitre(phrases=list(self.phrases))]

    @property
    def courte(self) -> bool:
        """Une fable : un seul chapitre, sans titre. Elle s'écrit et s'exporte par `phrases`."""
        return len(self.chapitres) == 1 and not self.chapitres[0].titre

    @property
    def texte(self) -> str:
        """Le chinois soumis au contrôle : titre, titres des chapitres et phrases."""
        return self.titre + "".join(c.titre + "".join(p.zh for p in c.phrases) for c in self.chapitres)

    @property
    def cle(self) -> str:
        """`<seuil>/<conte>` : le nom d'une version dans la relecture."""
        return f"{self.seuil}/{self.conte}"

    def texte_en_json(self) -> dict[str, object]:
        """Le texte, tel que l'écrivent la version et l'export : `phrases` pour une fable,
        `chapitres` pour un récit long."""
        if self.courte:
            return {"phrases": [phrase_en_json(p) for p in self.phrases]}
        return {"chapitres": [c.en_json() for c in self.chapitres]}

    def en_json(self) -> dict[str, object]:
        return {
            "conte": self.conte,
            "seuil": self.seuil,
            "titre": self.titre,
            "titre_pinyin": self.titre_pinyin,
            "titre_fr": self.titre_fr,
            "titre_en": self.titre_en,
            "source": {"ouvrage": self.ouvrage, "resume_fr": self.resume_fr},
            **self.texte_en_json(),
            "glose": {zh: g.en_json() for zh, g in self.glose.items()},
            "generation": {
                "modele": self.generation.modele,
                "api": self.generation.api,
                "date": self.generation.date,
                "empreinte_invite": self.generation.empreinte_invite,
                "essais": self.generation.essais,
                "intrus": self.generation.intrus,
            },
            "statut": self.statut,
        }


def lire_reponse(
    texte: str,
    *,
    conte: Conte,
    seuil: Niveau,
    generation: Generation,
    statut: str = A_RELIRE,
) -> Version:
    """Lit la réponse JSON du modèle et en fait une `Version`."""
    try:
        brut = json.loads(_sans_cloture(texte))
    except json.JSONDecodeError as erreur:
        raise ReponseInvalide(f"{conte.id} ({seuil}) : réponse non JSON") from erreur
    if not isinstance(brut, dict):
        raise ReponseInvalide(f"{conte.id} ({seuil}) : réponse hors schéma")
    titre = brut.get("titre")
    phrases_brutes = brut.get("phrases")
    glose_brute = brut.get("glose")
    if not isinstance(titre, str) or not isinstance(phrases_brutes, list) or not isinstance(glose_brute, list):
        raise ReponseInvalide(f"{conte.id} ({seuil}) : titre, phrases ou glose manquants")
    phrases: list[Phrase] = []
    for element in phrases_brutes:
        if not isinstance(element, dict) or not all(isinstance(element.get(k), str) for k in ("zh", "pinyin", "fr")):
            raise ReponseInvalide(f"{conte.id} ({seuil}) : phrase hors schéma")
        phrases.append(
            Phrase(zh=element["zh"], pinyin=element["pinyin"], fr=element["fr"], en=str(element.get("en", "")))
        )
    glose: dict[str, Glose] = {}
    for element in glose_brute:
        cle = element.get("zh", element.get("c")) if isinstance(element, dict) else None
        if not isinstance(cle, str) or not isinstance(element.get("fr"), str):
            raise ReponseInvalide(f"{conte.id} ({seuil}) : glose hors schéma")
        glose[cle] = _glose(element)
    return Version(
        conte=conte.id,
        seuil=seuil,
        titre=titre,
        titre_fr=conte.titre_fr,
        ouvrage=conte.ouvrage,
        resume_fr=conte.resume_fr,
        phrases=phrases,
        glose=glose,
        generation=generation,
        statut=statut,
        titre_pinyin=str(brut.get("titre_pinyin", "")),
        titre_en=conte.titre_en,
    )


def version_depuis_json(document: dict[str, object]) -> Version:
    """Relit une version écrite dans `data/sources/contes-versions/`."""
    source = document.get("source") or {}
    generation = document.get("generation") or {}
    if not isinstance(source, dict) or not isinstance(generation, dict):
        raise ReponseInvalide("version illisible : source ou generation hors format")
    chapitres = document.get("chapitres")
    phrases = document.get("phrases", [] if isinstance(chapitres, list) else None)
    glose = document.get("glose")
    if not isinstance(phrases, list) or not isinstance(glose, dict):
        raise ReponseInvalide("version illisible : phrases ou glose hors format")
    if chapitres is not None and not isinstance(chapitres, list):
        raise ReponseInvalide("version illisible : chapitres hors format")
    return Version(
        conte=str(document.get("conte", "")),
        seuil=niveau_brut(document.get("seuil", 0)),
        titre=str(document.get("titre", "")),
        titre_pinyin=str(document.get("titre_pinyin", "")),
        titre_fr=str(document.get("titre_fr", "")),
        titre_en=str(document.get("titre_en", "")),
        ouvrage=str(source.get("ouvrage", "")),
        resume_fr=str(source.get("resume_fr", "")),
        phrases=[_phrase(p) for p in phrases],
        chapitres=[chapitre_depuis_json(c) for c in chapitres or ()],
        glose={str(zh): _glose(valeur) for zh, valeur in glose.items()},
        generation=Generation(
            modele=str(generation.get("modele", "")),
            api=str(generation.get("api", "")),
            date=str(generation.get("date", "")),
            empreinte_invite=str(generation.get("empreinte_invite", "")),
            essais=int(generation.get("essais", 0)),
            intrus=list(generation.get("intrus") or []),
        ),
        statut=str(document.get("statut", A_RELIRE)),
    )


# --------------------------------------------------------------------------- validation


#: Ponctuation admise dans un conte : celle que le woff2 chinois embarque.
PONCTUATION = set(PONCTUATION_CHINOISE) | set(" \n　")

#: Une syllabe de pinyin telle qu'on l'écrit ici : minuscules, tons marqués.
SYLLABE = re.compile(r"[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]+")

#: Tons du dictionnaire, sans sandhi : 一 et 不 ne changent pas de ton devant un autre.
TONS_FIXES: dict[str, tuple[str, ...]] = {"一": ("yī", "yi"), "不": ("bù", "bu")}


def caracteres_hors_liste(texte: str, autorises: Iterable[str]) -> list[str]:
    """Caractères du texte absents de la liste, sans doublon, dans l'ordre d'apparition."""
    permis = set(autorises) | PONCTUATION
    vus: set[str] = set()
    intrus: list[str] = []
    for c in texte:
        if c in permis or c in vus:
            continue
        vus.add(c)
        intrus.append(c)
    return intrus


def segmenter(texte: str, entrees: Iterable[str]) -> list[tuple[int, str]]:
    """Découpe un texte comme le lecteur le fera : à chaque position, l'entrée de glose
    la plus longue qui commence là. Rend `(position, entrée)` ; un sinogramme qu'aucune
    entrée ne couvre est rendu seul, avec une entrée vide.
    """
    par_longueur = sorted({e for e in entrees if e}, key=len, reverse=True)
    segments: list[tuple[int, str]] = []
    i = 0
    while i < len(texte):
        if not est_sinogramme(texte[i]):
            i += 1
            continue
        trouvee = next((e for e in par_longueur if texte.startswith(e, i)), "")
        segments.append((i, trouvee))
        i += len(trouvee) or 1
    return segments


def _syllabes(texte: str, pinyin: str, nom: str, ecarts: list[str]) -> list[str] | None:
    """Les syllabes d'un pinyin, alignées sur les sinogrammes du texte. `None` si elles ne
    s'alignent pas, et l'écart est noté."""
    syllabes = pinyin.split()
    sinogrammes = [c for c in texte if est_sinogramme(c)]
    hors_forme = [s for s in syllabes if not SYLLABE.fullmatch(s)]
    if hors_forme:
        ecarts.append(
            f"pinyin {nom} hors forme (minuscules accentuées, sans ponctuation) : {' '.join(hors_forme)}"
        )
    if len(syllabes) != len(sinogrammes):
        ecarts.append(f"pinyin {nom} : {len(syllabes)} syllabes pour {len(sinogrammes)} caractères")
        return None
    sandhi = [
        f"{c} {s}" for c, s in zip(sinogrammes, syllabes) if c in TONS_FIXES and s not in TONS_FIXES[c]
    ]
    if sandhi:
        ecarts.append(f"pinyin {nom} : ton modifié (sandhi), le ton du dictionnaire est attendu : {', '.join(sandhi)}")
    return syllabes


@dataclass(frozen=True)
class Rapport:
    """Résultat d'une validation. `intrus` non vide vaut rejet."""

    intrus: list[str]
    ecarts: list[str] = field(default_factory=list)

    @property
    def conforme(self) -> bool:
        return not self.intrus


def longueur(phrases: Iterable[Phrase]) -> int:
    """Le nombre de sinogrammes des phrases, ponctuation non comprise."""
    return sum(1 for p in phrases for c in p.zh if est_sinogramme(c))


def ecarts_au_catalogue(version: Version, conte: Conte) -> list[str]:
    """Ce qu'une version dit autrement que le catalogue : un niveau que le récit n'a pas
    prévu, un nombre de chapitres qui n'est pas celui prévu. Des écarts, jamais des rejets."""
    ecarts: list[str] = []
    if conte.niveaux and version.seuil not in conte.niveaux:
        prevus = ", ".join(str(n) for n in conte.niveaux)
        ecarts.append(f"niveau {version.seuil} non prévu au catalogue (niveaux prévus : {prevus})")
    ecrits = 1 if version.courte else len(version.chapitres)
    if ecrits != conte.chapitres:
        ecarts.append(f"{ecrits} chapitre(s) pour {conte.chapitres} prévu(s) au catalogue")
    return ecarts


def valider(version: Version, autorises: Sequence[str], conte: Conte | None = None) -> Rapport:
    """Contrôle strict : tout caractère hors liste est un rejet.

    Les autres défauts (glose incomplète ou incohérente, pinyin qui ne s'aligne pas,
    traduction absente, longueur hors cible, chapitre sans titre ou sans phrase, seuil ou
    nombre de chapitres autres que ceux du catalogue quand `conte` est donné) sont des
    écarts signalés à la relecture, pas des rejets. Un récit long vise la longueur du
    seuil à chaque chapitre.
    """
    intrus = caracteres_hors_liste(version.texte, autorises)
    ecarts: list[str] = []
    if not version.phrases:
        ecarts.append("aucune phrase")
    minimum, maximum = LONGUEURS.get(version.seuil, (0, 10**6))
    if version.courte:
        total = longueur(version.phrases)
        if not minimum <= total <= maximum:
            ecarts.append(f"longueur {total} hors de la cible {minimum}–{maximum}")
    else:
        for k, chapitre in enumerate(version.chapitres, start=1):
            if not chapitre.phrases:
                ecarts.append(f"chapitre {k} sans phrase")
                continue
            n = longueur(chapitre.phrases)
            if not minimum <= n <= maximum:
                ecarts.append(f"chapitre {k} : longueur {n} hors de la cible {minimum}–{maximum}")
        sans_titre = [str(k) for k, c in enumerate(version.chapitres, start=1) if not c.titre.strip()]
        if sans_titre:
            ecarts.append(f"chapitres sans titre chinois : {', '.join(sans_titre)}")
        sans_traduction = [
            str(k)
            for k, c in enumerate(version.chapitres, start=1)
            if not c.titre_fr.strip() or not c.titre_en.strip()
        ]
        if sans_traduction:
            ecarts.append(
                f"chapitres sans titre français ou anglais (chapitres.tsv) : {', '.join(sans_traduction)}"
            )
    if conte is not None:
        ecarts += ecarts_au_catalogue(version, conte)
    vides = [i for i, p in enumerate(version.phrases, start=1) if not p.zh.strip() or not p.fr.strip()]
    if vides:
        ecarts.append(f"phrases vides : {', '.join(str(i) for i in vides)}")
    sans_anglais = [i for i, p in enumerate(version.phrases, start=1) if p.zh.strip() and not p.en.strip()]
    if sans_anglais:
        ecarts.append(f"traduction anglaise absente : phrases {', '.join(str(i) for i in sans_anglais)}")

    # Pinyin : une syllabe par sinogramme, pour le titre, chaque titre de chapitre et
    # chaque phrase (numérotée d'un bout à l'autre de la version).
    textes = [("du titre", version.titre, version.titre_pinyin)]
    rang = 0
    for k, chapitre in enumerate(version.chapitres, start=1):
        if not version.courte:
            textes.append((f"du titre du chapitre {k}", chapitre.titre, chapitre.titre_pinyin))
        for p in chapitre.phrases:
            rang += 1
            textes.append((f"de la phrase {rang}", p.zh, p.pinyin))
    alignes = [(nom, texte, _syllabes(texte, pinyin, nom, ecarts)) for nom, texte, pinyin in textes]

    # Glose : chaque sinogramme couvert, telle que le lecteur la découpera.
    non_sinogrammes = [zh for zh in version.glose if not zh or not all(est_sinogramme(c) for c in zh)]
    if non_sinogrammes:
        ecarts.append(f"glose sur autre chose que des sinogrammes : {' '.join(repr(z) for z in non_sinogrammes)}")
    absents: dict[str, None] = {}
    discordances: dict[str, str] = {}
    for nom, texte, syllabes in alignes:
        rang = {i: n for n, i in enumerate(i for i, c in enumerate(texte) if est_sinogramme(c))}
        for position, entree in segmenter(texte, version.glose):
            if not entree:
                absents[texte[position]] = None
                continue
            attendu = version.glose[entree].pinyin
            if syllabes is None or not attendu or entree in discordances:
                continue
            debut = rang[position]
            lu = " ".join(syllabes[debut : debut + len(entree)])
            if attendu.split() != lu.split():
                discordances[entree] = f"glose {entree} « {attendu} », {lu!r} dans le pinyin {nom}"
    if absents:
        ecarts.append(f"glose absente pour {' '.join(absents)}")
    hors_texte = [zh for zh in version.glose if zh and zh not in version.texte]
    if hors_texte:
        ecarts.append(f"glose hors du texte : {' '.join(hors_texte)}")
    ecarts += discordances.values()
    for manque, attribut in (("pinyin", "pinyin"), ("sens français", "fr"), ("sens anglais", "en")):
        sans = [zh for zh, g in version.glose.items() if not getattr(g, attribut).strip()]
        if sans:
            ecarts.append(f"glose sans {manque} : {' '.join(sans)}")
    mal_comptees = [
        zh for zh, g in version.glose.items() if g.pinyin.strip() and len(g.pinyin.split()) != len(zh)
    ]
    if mal_comptees:
        ecarts.append(f"glose : pinyin sans une syllabe par caractère pour {' '.join(mal_comptees)}")
    return Rapport(intrus=intrus, ecarts=ecarts)


# --------------------------------------------------------------------------- client


class ClientAnthropic(claude.ClientAnthropic):
    """Messages API pour l'unitaire, Message Batches pour les lots. Même invite.

    Le client commun de `claude.py`, avec le schéma de réponse des contes.
    """

    SCHEMA = SCHEMA


def client_anthropic(modele: str = MODELE, max_tokens: int = MAX_TOKENS) -> ClientClaude:
    """Client réel (SDK `anthropic`). Refuse de partir sans clé d'API."""
    return claude.client_anthropic(ClientAnthropic, modele, max_tokens)


# --------------------------------------------------------------------------- écriture


def chemin_version(seuil: Niveau, conte_id: str, dossier: Path | None = None) -> Path:
    """`255/<id>.json`, `hsk3/<id>.json` : un dossier par niveau."""
    return (dossier or CONTES_WORK) / str(seuil) / f"{conte_id}.json"


def ecrire_version(version: Version, dossier: Path | None = None) -> Path:
    chemin = chemin_version(version.seuil, version.conte, dossier)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(version.en_json(), ensure_ascii=False, indent=1), encoding="utf-8")
    return chemin


def lire_version(chemin: Path) -> Version:
    return version_depuis_json(json.loads(chemin.read_text(encoding="utf-8")))


def versions_ecrites(dossier: Path | None = None) -> list[Path]:
    """Toutes les versions écrites, dossier de niveau par dossier de niveau (`255`, `hsk3`),
    du plus petit au plus grand."""
    dossier = dossier or CONTES_WORK
    if not dossier.exists():
        return []
    seuils = sorted(
        (d for d in dossier.iterdir() if d.is_dir() and (d.name.isdigit() or d.name in HSK)),
        key=lambda d: (rang(niveau_brut(d.name)), d.name),
    )
    return [f for d in seuils for f in sorted(d.glob("*.json"))]


def relire(conte_id: str, seuil: Niveau, statut: str, dossier: Path | None = None) -> Version:
    """Marque la relecture humaine d'une version. Le pipeline n'y touche pas."""
    if statut not in STATUTS:
        raise ValueError(f"statut {statut!r} inconnu : {', '.join(STATUTS)}")
    chemin = chemin_version(seuil, conte_id, dossier)
    if not chemin.exists():
        raise FileNotFoundError(f"aucune version de {conte_id} {au_niveau(seuil)} ({chemin})")
    version = lire_version(chemin)
    version.statut = statut
    ecrire_version(version, dossier)
    return version


# --------------------------------------------------------------------------- génération


def generer_version(
    conte: Conte,
    seuil: Niveau,
    autorises: Sequence[str],
    client: ClientClaude,
    *,
    essais_max: int = ESSAIS_MAX,
    horloge: Callable[[], str] = _maintenant,
) -> tuple[Version, Rapport]:
    """Génère une version en relançant sur les intrus, au plus `essais_max` fois."""
    signales: list[str] = []
    version: Version | None = None
    rapport = Rapport(intrus=[])
    for essai in range(1, essais_max + 1):
        demande = invite(conte, seuil, autorises, intrus=signales)
        version = lire_reponse(
            client.generer(demande),
            conte=conte,
            seuil=seuil,
            generation=Generation(
                modele=client.modele,
                api=API_UNITAIRE,
                date=horloge(),
                empreinte_invite=demande.empreinte,
                essais=essai,
            ),
        )
        rapport = valider(version, autorises, conte)
        version.generation = replace(version.generation, intrus=rapport.intrus)
        version.statut = A_RELIRE if rapport.conforme else REJETE
        if rapport.conforme:
            return version, rapport
        signales = rapport.intrus
    assert version is not None  # essais_max >= 1
    return version, rapport


# --------------------------------------------------------------------------- lots


def dossier_lots(dossier: Path | None = None) -> Path:
    """Le journal des lots : `data/work/contes/lots/`, ou `<dossier>/lots` s'il est donné.

    Les versions sont versionnées, le journal ne l'est pas : c'est l'état d'un passage,
    que la CI garde en cache d'un passage à l'autre.
    """
    return dossier / "lots" if dossier is not None else LOTS_WORK


def custom_id(seuil: Niveau, conte_id: str, essai: int) -> str:
    return f"{seuil}-{conte_id}-{essai}"


def soumettre_lot(
    contes: Sequence[Conte],
    seuil: Niveau,
    autorises: Sequence[str],
    client: ClientClaude,
    *,
    essais: dict[str, int] | None = None,
    intrus: dict[str, list[str]] | None = None,
    dossier: Path | None = None,
    horloge: Callable[[], str] = _maintenant,
) -> dict[str, object]:
    """Soumet tous les contes d'un seuil en une fois et journalise le lot."""
    essais = essais or {}
    intrus = intrus or {}
    requetes: list[RequeteLot] = []
    journal: list[dict[str, object]] = []
    for conte in contes:
        essai = essais.get(conte.id, 1)
        demande = invite(conte, seuil, autorises, intrus=intrus.get(conte.id, []))
        identifiant = custom_id(seuil, conte.id, essai)
        requetes.append(RequeteLot(custom_id=identifiant, invite=demande))
        journal.append(
            {
                "custom_id": identifiant,
                "conte": conte.id,
                "essai": essai,
                "empreinte_invite": demande.empreinte,
            }
        )
    if not requetes:
        raise CatalogueInvalide("aucun conte à soumettre")
    identifiant_lot = client.soumettre(requetes)
    lot: dict[str, object] = {
        "lot": identifiant_lot,
        "seuil": seuil,
        "modele": client.modele,
        "api": API_LOTS,
        "soumis": horloge(),
        "statut": claude.EN_COURS,
        "requetes": journal,
    }
    claude.ecrire_lot(dossier_lots(dossier), lot)
    return lot


def lots_en_cours(dossier: Path | None = None) -> list[Path]:
    return claude.lots_en_cours(dossier_lots(dossier))


def recuperer_lot(
    fichier: Path,
    client: ClientClaude,
    *,
    catalogue: Sequence[Conte] | None = None,
    autorises: Sequence[str] | None = None,
    dossier: Path | None = None,
    listes: Path | None = None,
    relancer: bool = True,
    horloge: Callable[[], str] = _maintenant,
) -> list[str]:
    """Récupère un lot terminé : valide, écrit, et resoumet ce qui a été rejeté.

    Retourne le journal des lignes à afficher.
    """
    lot = json.loads(fichier.read_text(encoding="utf-8"))
    identifiant = str(lot["lot"])
    seuil = niveau_brut(lot["seuil"])
    statut = client.statut_lot(identifiant)
    if statut != "ended":
        return [f"{identifiant} : {statut}, rien à récupérer."]

    catalogue = list(catalogue) if catalogue is not None else charger_catalogue()
    autorises = list(autorises) if autorises is not None else charger_seuil(seuil, listes)
    par_id = {str(r["custom_id"]): r for r in lot["requetes"]}

    journal: list[str] = []
    a_relancer: list[Conte] = []
    essais_suivants: dict[str, int] = {}
    intrus_signales: dict[str, list[str]] = {}
    for resultat in client.resultats(identifiant):
        requete = par_id.get(resultat.custom_id)
        if requete is None:
            journal.append(f"{resultat.custom_id} : inconnu dans le lot, ignoré.")
            continue
        conte = conte_par_id(str(requete["conte"]), catalogue)
        essai = int(requete["essai"])
        if resultat.erreur or resultat.texte is None:
            journal.append(f"{conte.id} ({seuil}) : échec du lot ({resultat.erreur}).")
            continue
        version = lire_reponse(
            resultat.texte,
            conte=conte,
            seuil=seuil,
            generation=Generation(
                modele=str(lot["modele"]),
                api=API_LOTS,
                date=horloge(),
                empreinte_invite=str(requete["empreinte_invite"]),
                essais=essai,
            ),
        )
        rapport = valider(version, autorises, conte)
        version.generation = replace(version.generation, intrus=rapport.intrus)
        version.statut = A_RELIRE if rapport.conforme else REJETE
        ecrire_version(version, dossier)
        if rapport.conforme:
            journal.append(f"{conte.id} ({seuil}) : à relire" + (f" ; écarts : {' ; '.join(rapport.ecarts)}" if rapport.ecarts else "."))
        else:
            journal.append(f"{conte.id} ({seuil}) : rejeté, hors liste : {' '.join(rapport.intrus)}")
            if essai < ESSAIS_MAX:
                a_relancer.append(conte)
                essais_suivants[conte.id] = essai + 1
                intrus_signales[conte.id] = rapport.intrus

    claude.marquer_recupere(fichier, lot, horloge())

    if relancer and a_relancer:
        suivant = soumettre_lot(
            a_relancer,
            seuil,
            autorises,
            client,
            essais=essais_suivants,
            intrus=intrus_signales,
            dossier=dossier,
            horloge=horloge,
        )
        journal.append(f"relance de {len(a_relancer)} conte(s) : lot {suivant['lot']}.")
    return journal


# --------------------------------------------------------------------------- rédaction sans API
#
# Un conte peut aussi être rédigé à la main — par un agent Claude Code dans sa
# session, sans clé ni réseau — dans un brouillon versionné. `importer_brouillon()`
# le fait passer par le même `valider()` que les versions générées, puis l'écrit au
# statut `a_relire` ou `rejete`, avec une traçabilité qui dit ce qu'il est : une
# rédaction manuelle, pas un appel d'API.

#: Brouillons rédigés à la main, versionnés : `<id>/<seuil>.json`.
BROUILLONS = DATA / "sources" / "contes-brouillons"

#: Traçabilité d'une version rédigée dans une session Claude Code, sans appel d'API.
API_SESSION = "session Claude Code (sans API)"
MODELE_MANUEL = "rédaction manuelle"

#: Versions à relire, rassemblées pour une page de relecture. Hors dépôt.
RELECTURE = WORK / "relecture-contes.json"

CHAMPS_BROUILLON = ("conte", "seuil", "ouvrage", "titre", "phrases", "glose")

#: Un récit long remplace `phrases` par `chapitres` : l'un ou l'autre, jamais les deux.
CHAMPS_TEXTE = ("phrases", "chapitres")

#: Les deux décisions de la relecture humaine.
DECISIONS = (RELU, REJETE)


class BrouillonInvalide(ValueError):
    """Le brouillon ne se lit pas comme une version : rien n'est écrit."""

    def __init__(self, nom: str, problemes: Sequence[str]) -> None:
        self.nom = nom
        self.problemes = list(problemes)
        super().__init__(f"{nom} : " + " ; ".join(self.problemes))


class RelectureInvalide(ValueError):
    """Le fichier de relecture ne s'applique pas : rien n'est changé."""

    def __init__(self, problemes: Sequence[str]) -> None:
        self.problemes = list(problemes)
        super().__init__(" ; ".join(self.problemes))


def _aujourdhui() -> str:
    return _maintenant()[:10]


@dataclass(frozen=True)
class Brouillon:
    """Une version rédigée à la main, telle que son rédacteur l'a écrite."""

    conte: str
    seuil: Niveau
    empreinte: str
    #: L'ouvrage d'origine, tel que le catalogue le cite ; `None` : on ne le cite pas.
    ouvrage: str | None
    titre: str
    titre_pinyin: str
    phrases: list[Phrase]
    glose: dict[str, Glose]
    #: Les chapitres d'un récit long, titres chinois compris ; vide pour une fable.
    chapitres: list[Chapitre] = field(default_factory=list)

    @property
    def nom(self) -> str:
        return f"{self.conte}/{self.seuil}"


def empreinte_brouillon(octets: bytes) -> str:
    """Empreinte des octets du brouillon : `sha256sum` la retrouve."""
    return "sha256:" + hashlib.sha256(octets).hexdigest()


def _textes(valeur: object, cles: Sequence[str], nom: str, problemes: list[str]) -> dict[str, str] | None:
    """Un objet aux clés `cles`, toutes des chaînes. `None`, et le problème noté, sinon."""
    if not isinstance(valeur, dict):
        problemes.append(f"{nom} : attendu un objet {{{', '.join(cles)}}}")
        return None
    manquantes = [k for k in cles if not isinstance(valeur.get(k), str)]
    inconnues = [k for k in valeur if k not in cles]
    if manquantes:
        problemes.append(f"{nom} : {', '.join(manquantes)} manquant ou non textuel")
    if inconnues:
        problemes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
    if manquantes or inconnues:
        return None
    return {k: str(valeur[k]).strip() for k in cles}


def brouillon_depuis_json(
    document: object,
    *,
    empreinte: str,
    conte: str | None = None,
    seuil: Niveau | None = None,
) -> Brouillon:
    """Lit un brouillon déjà décodé. Relève tous les problèmes de format d'un coup.

    `conte` et `seuil` sont ceux du chemin (`<id>/<seuil>.json`) : le brouillon doit
    dire les mêmes. Le format seul est vérifié ici ; le fond (caractères du seuil,
    longueur, glose, pinyin) l'est par `valider()`, comme pour une version générée.
    """
    nom = f"{conte or '?'}/{seuil or '?'}"
    if not isinstance(document, dict):
        raise BrouillonInvalide(nom, ["attendu un objet JSON"])
    problemes: list[str] = []
    texte = [k for k in CHAMPS_TEXTE if k in document]
    manquants = [k for k in CHAMPS_BROUILLON if k not in document and k != "phrases"]
    if not texte:
        manquants.append("phrases (ou chapitres pour un récit long)")
    if manquants:
        problemes.append(f"champ manquant : {', '.join(manquants)}")
    if len(texte) > 1:
        problemes.append("phrases et chapitres : l'un ou l'autre, chapitres pour un récit long")
    inconnus = [k for k in document if k not in CHAMPS_BROUILLON + CHAMPS_TEXTE]
    if inconnus:
        problemes.append(f"champ inconnu : {', '.join(inconnus)}")
    if "conte" in document and not isinstance(document["conte"], str):
        problemes.append("conte : attendu un identifiant du catalogue")
    elif conte is not None and "conte" in document and document["conte"] != conte:
        problemes.append(f"conte vaut {document['conte']!r} dans le dossier {conte}/")
    if "seuil" in document:
        try:
            lu = lire_niveau(document["seuil"])
        except SeuilInconnu:
            problemes.append('seuil : attendu un seuil (255) ou un niveau HSK ("hsk3")')
        else:
            if seuil is not None and lu != seuil:
                problemes.append(f"seuil vaut {document['seuil']!r} dans un fichier nommé {seuil}.json")
    if document.get("ouvrage") is not None and not isinstance(document["ouvrage"], str):
        problemes.append("ouvrage : attendu un texte, ou null si l'on ne cite pas l'ouvrage")

    titre = _textes(document.get("titre"), ("zh", "pinyin"), "titre", problemes) if "titre" in document else None

    phrases: list[Phrase] = []
    if "phrases" in document:
        phrases = _phrases_brouillon(document["phrases"], "", problemes)

    chapitres: list[Chapitre] = []
    if "chapitres" in document:
        brut = document["chapitres"]
        if not isinstance(brut, list) or not brut:
            problemes.append("chapitres : attendu une liste non vide d'objets {titre, phrases}")
        else:
            for k, element in enumerate(brut, start=1):
                nom_chapitre = f"chapitre {k}"
                if not isinstance(element, dict):
                    problemes.append(f"{nom_chapitre} : attendu un objet {{titre, phrases}}")
                    continue
                inconnues = [c for c in element if c not in ("titre", "phrases")]
                if inconnues:
                    problemes.append(f"{nom_chapitre} : clé inconnue {', '.join(inconnues)}")
                titre_chapitre = _textes(element.get("titre"), ("zh", "pinyin"), f"{nom_chapitre}, titre", problemes)
                lues = _phrases_brouillon(element.get("phrases"), f"{nom_chapitre}, ", problemes)
                if titre_chapitre is not None:
                    chapitres.append(
                        Chapitre(phrases=lues, titre=titre_chapitre["zh"], titre_pinyin=titre_chapitre["pinyin"])
                    )

    glose: dict[str, Glose] = {}
    if "glose" in document:
        brut = document["glose"]
        if not isinstance(brut, list):
            problemes.append("glose : attendu une liste d'objets {zh, pinyin, fr, en}")
        else:
            for rang, element in enumerate(brut, start=1):
                lu = _textes(element, ("zh", "pinyin", "fr", "en"), f"glose {rang}", problemes)
                if lu is None:
                    continue
                if lu["zh"] in glose:
                    problemes.append(f"glose {rang} : {lu['zh']} déjà glosé")
                    continue
                glose[lu["zh"]] = Glose(fr=lu["fr"], pinyin=lu["pinyin"], en=lu["en"])

    if problemes or titre is None:
        raise BrouillonInvalide(nom, problemes or ["titre illisible"])
    ouvrage = document["ouvrage"]
    return Brouillon(
        conte=str(document["conte"]),
        seuil=lire_niveau(document["seuil"]),
        empreinte=empreinte,
        ouvrage=str(ouvrage).strip() if ouvrage is not None else None,
        titre=titre["zh"],
        titre_pinyin=titre["pinyin"],
        phrases=phrases,
        glose=glose,
        chapitres=chapitres,
    )


def _phrases_brouillon(brut: object, prefixe: str, problemes: list[str]) -> list[Phrase]:
    """Les phrases d'un brouillon ou d'un de ses chapitres : une liste non vide de
    `{zh, pinyin, fr, en}`. Chaque problème est noté, préfixé du chapitre s'il y en a un."""
    if not isinstance(brut, list) or not brut:
        problemes.append(f"{prefixe}phrases : attendu une liste non vide d'objets {{zh, pinyin, fr, en}}")
        return []
    phrases: list[Phrase] = []
    for rang, element in enumerate(brut, start=1):
        lu = _textes(element, ("zh", "pinyin", "fr", "en"), f"{prefixe}phrase {rang}", problemes)
        if lu is not None:
            phrases.append(Phrase(**lu))
    return phrases


def chemin_brouillon(conte_id: str, seuil: Niveau, dossier: Path | None = None) -> Path:
    return (dossier or BROUILLONS) / conte_id / f"{seuil}.json"


def lire_brouillon(chemin: Path) -> Brouillon:
    """Lit `data/sources/contes-brouillons/<id>/<niveau>.json` (`255.json`, `hsk3.json`)."""
    conte = chemin.parent.name
    nom = f"{conte}/{chemin.stem}"
    try:
        seuil = lire_niveau(chemin.stem)
    except SeuilInconnu as erreur:
        raise BrouillonInvalide(
            nom, [f"{chemin.name} : le fichier porte le nom de son niveau, 255.json ou hsk3.json"]
        ) from erreur
    octets = chemin.read_bytes()
    try:
        document = json.loads(octets.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as erreur:
        raise BrouillonInvalide(nom, [f"JSON illisible : {erreur}"]) from erreur
    return brouillon_depuis_json(document, empreinte=empreinte_brouillon(octets), conte=conte, seuil=seuil)


def brouillons_ecrits(dossier: Path | None = None) -> list[Path]:
    """Tous les brouillons, conte par conte, seuil par seuil."""
    dossier = dossier or BROUILLONS
    if not dossier.exists():
        return []
    return sorted(
        dossier.glob("*/*.json"),
        key=lambda p: (p.parent.name, rang(niveau_brut(p.stem)), p.stem),
    )


def version_depuis_brouillon(
    brouillon: Brouillon,
    conte: Conte,
    *,
    essais: int = 1,
    horloge: Callable[[], str] | None = None,
) -> Version:
    """La version d'un brouillon : le texte du rédacteur, le récit du catalogue.

    L'ouvrage d'origine n'est cité que si le rédacteur le cite, et à l'identique du
    catalogue : une source inexacte ne passe pas.
    """
    if brouillon.ouvrage is not None and brouillon.ouvrage != conte.ouvrage:
        raise BrouillonInvalide(
            brouillon.nom,
            [
                f"ouvrage {brouillon.ouvrage!r} : le catalogue cite {conte.ouvrage!r} ; "
                "corriger l'un ou l'autre, ou null pour ne pas citer"
            ],
        )
    return Version(
        conte=conte.id,
        seuil=brouillon.seuil,
        titre=brouillon.titre,
        titre_pinyin=brouillon.titre_pinyin,
        titre_fr=conte.titre_fr,
        titre_en=conte.titre_en,
        ouvrage=brouillon.ouvrage or "",
        resume_fr=conte.resume_fr,
        phrases=list(brouillon.phrases),
        # Les titres français et anglais des chapitres viennent du catalogue, comme
        # ceux du récit : un chapitre que le catalogue ne prévoit pas n'en a pas.
        chapitres=[
            replace(
                chapitre,
                titre_fr=conte.plan[k].titre_fr if k < len(conte.plan) else "",
                titre_en=conte.plan[k].titre_en if k < len(conte.plan) else "",
            )
            for k, chapitre in enumerate(brouillon.chapitres)
        ],
        glose=dict(brouillon.glose),
        generation=Generation(
            modele=MODELE_MANUEL,
            api=API_SESSION,
            date=(horloge or _aujourdhui)(),  # lue à l'appel : un test la remplace
            empreinte_invite=brouillon.empreinte,
            essais=essais,
        ),
    )


@dataclass(frozen=True)
class Import:
    """Ce qu'a donné l'import d'un brouillon."""

    version: Version
    rapport: Rapport
    chemin: Path
    #: Même brouillon, même verdict : la version écrite est gardée telle quelle,
    #: statut de relecture compris.
    inchange: bool = False
    #: Statut de la version remplacée, s'il y en avait une.
    remplace: str | None = None


def importer_brouillon(
    brouillon: Brouillon,
    conte: Conte,
    autorises: Sequence[str],
    *,
    dossier: Path | None = None,
    horloge: Callable[[], str] | None = None,
) -> Import:
    """Version, `valider()`, écriture : les contrôles des versions générées.

    Un brouillon inchangé ne réécrit rien : une version relue le reste. Un brouillon
    modifié repart au statut `a_relire`, sa relecture est à refaire.
    """
    chemin = chemin_version(brouillon.seuil, conte.id, dossier)
    precedente = lire_version(chemin) if chemin.exists() else None
    manuelle = precedente is not None and precedente.generation.api == API_SESSION
    version = version_depuis_brouillon(
        brouillon,
        conte,
        essais=precedente.generation.essais + 1 if manuelle and precedente else 1,
        horloge=horloge,
    )
    rapport = valider(version, autorises, conte)
    if (
        manuelle
        and precedente is not None
        and precedente.generation.empreinte_invite == brouillon.empreinte
        and precedente.generation.intrus == rapport.intrus
    ):
        return Import(version=precedente, rapport=rapport, chemin=chemin, inchange=True)
    version.generation = replace(version.generation, intrus=rapport.intrus)
    version.statut = A_RELIRE if rapport.conforme else REJETE
    ecrire_version(version, dossier)
    return Import(
        version=version,
        rapport=rapport,
        chemin=chemin,
        remplace=precedente.statut if precedente is not None else None,
    )


def contraintes(seuil: Niveau) -> str:
    """Ce que `wenlu contes importer` vérifie, comme pour une version générée."""
    minimum, maximum = LONGUEURS.get(seuil, (0, 0))
    return f"""Contraintes, vérifiées par `wenlu contes importer` comme pour un conte généré.
Rejet :
- titre.zh, chaque phrases[].zh et, pour un récit long, chaque titre de chapitre : les \
seuls caractères de la liste du niveau (pour un niveau HSK, celles des niveaux 1 à lui), \
et la ponctuation {PONCTUATION_CHINOISE} (citations entre 「」) ; ni chiffre, ni lettre, \
aucun autre caractère, même dans un nom propre.
Écarts, signalés à la relecture :
- longueur : {minimum} à {maximum} sinogrammes pour le {libelle(seuil)}, phrases seules, \
ponctuation non comprise ; pour un récit long, à chaque chapitre ;
- récit long : autant de chapitres que le catalogue en prévoit, chacun titré et non vide ;
- niveau : l'un des niveaux que le catalogue prévoit pour le récit ;
- pinyin du titre, de chaque titre de chapitre et de chaque phrase : {REGLE_PINYIN} ;
- fr et en de chaque phrase non vides, rédigés pour un lecteur de chaque langue ;
- glose : une liste d'entrées {{zh, pinyin, fr, en}}, par caractère ou par mot, qui couvre \
chaque sinogramme du titre et du texte tel que le lecteur les découpe (à chaque \
position, l'entrée la plus longue qui commence là) ; pas d'entrée absente du texte ; \
le pinyin d'une entrée est celui des phrases, syllabe pour syllabe ; fr et en en un à \
trois mots, dans le sens qu'a l'entrée ici, rédigés soi-même, jamais repris d'un \
dictionnaire.
Format (sinon rien n'est écrit) :
- conte et seuil (le niveau : 255, ou "hsk3") : ceux du chemin <id>/<niveau>.json \
(255.json, hsk3.json) ; aucune autre clé que \
{', '.join(CHAMPS_BROUILLON)} ;
- récit long : chapitres [{{titre: {{zh, pinyin}}, phrases: [...]}}] à la place de phrases ;
- ouvrage : l'ouvrage du catalogue, à l'identique, ou null pour ne pas le citer ; \
jamais une source inexacte.
Le récit suit l'intrigue du catalogue, sans en changer la morale, sans recopier \
l'ouvrage d'origine ; des phrases courtes, un chinois simple et naturel ; des constats, \
ni emoji ni dragon, sauf dans 叶公好龙 dont le dragon est le sujet."""


def squelette(conte: Conte, seuil: Niveau) -> dict[str, object]:
    """Un brouillon vide pour ce conte à ce seuil : des phrases pour une fable, un
    chapitre par chapitre prévu pour un récit long."""
    vide = {"zh": "", "pinyin": "", "fr": "", "en": ""}
    texte: dict[str, object] = (
        {
            "chapitres": [
                {"titre": {"zh": "", "pinyin": ""}, "phrases": [dict(vide)]}
                for _ in range(conte.chapitres)
            ]
        }
        if conte.long
        else {"phrases": [dict(vide)]}
    )
    return {
        "conte": conte.id,
        "seuil": seuil,
        "ouvrage": conte.ouvrage,
        "titre": {"zh": "", "pinyin": ""},
        **texte,
        "glose": [dict(vide)],
    }


def decrire_contexte(
    conte: Conte,
    seuil: Niveau,
    autorises: Sequence[str],
    *,
    brouillons: Path | None = None,
) -> list[str]:
    """Ce qu'un rédacteur doit savoir d'un conte à un niveau, en lignes à afficher.

    Les mêmes faits que l'invite des versions générées : le récit, sa source, la
    longueur visée et la liste exacte des caractères du niveau (en cumul pour le HSK).
    """
    minimum, maximum = LONGUEURS.get(seuil, (0, 0))
    hors = caracteres_hors_liste(conte.titre_zh, autorises)
    chemin = chemin_brouillon(conte.id, seuil, brouillons)
    lignes = [
        f"== {conte.id} — {conte.titre_zh}, {libelle(seuil)} ==",
        f"Titre : « {conte.titre_fr} » / “{conte.titre_en}”",
        f"Ouvrage d'origine : {conte.ouvrage} (à citer tel quel, ou null ; n'en rien recopier)",
        f"Intrigue : {conte.resume_fr}",
        "Niveaux prévus : "
        + (", ".join(str(n) for n in conte.niveaux) or "non dits")
        + (
            ""
            if not conte.niveaux or seuil in conte.niveaux
            else f" ; le niveau {seuil} n'en est pas (écart signalé à l'import)"
        ),
        f"Longueur visée : {minimum} à {maximum} sinogrammes"
        + (" par chapitre" if conte.long else "")
        + ", ponctuation non comprise.",
        "Titre traditionnel : "
        + (f"{' '.join(hors)} hors du niveau, à dire autrement." if hors else "entièrement dans le niveau."),
    ]
    if conte.long:
        lignes.append(
            f"Récit long, {conte.chapitres} chapitres, chacun titré en chinois avec les caractères du niveau :"
        )
        lignes += [f"  {c.n}. « {c.titre_fr} » / “{c.titre_en}” : {c.resume_fr}" for c in conte.plan]
    lignes += [
        "",
        f"Les {len(autorises)} seuls caractères autorisés {au_niveau(seuil)} :",
        "".join(autorises),
        "",
        f"Brouillon à écrire : {_relatif(chemin)}" + (" (existe déjà)" if chemin.exists() else ""),
        json.dumps(squelette(conte, seuil), ensure_ascii=False, indent=1),
    ]
    return lignes


def exporter_relecture(
    *,
    dossier: Path | None = None,
    listes: Path | None = None,
    sortie: Path | None = None,
    horloge: Callable[[], str] = _maintenant,
) -> tuple[Path, int]:
    """Rassemble les versions `a_relire` en un seul JSON, pour une page de relecture."""
    a_relire = sorted(
        (v for v in map(lire_version, versions_ecrites(dossier)) if v.statut == A_RELIRE),
        key=lambda v: (rang(v.seuil), v.conte),
    )
    listes_par_seuil: dict[Niveau, list[str] | None] = {}
    entrees: list[dict[str, object]] = []
    par_id = _catalogue_par_id()
    for version in a_relire:
        if version.seuil not in listes_par_seuil:
            try:
                listes_par_seuil[version.seuil] = charger_seuil(version.seuil, listes)
            except (SeuilInconnu, SeuilSansListe):
                listes_par_seuil[version.seuil] = None
        entree: dict[str, object] = {"cle": version.cle, **version.en_json()}
        autorises = listes_par_seuil[version.seuil]
        if autorises is not None:
            entree["ecarts"] = valider(version, autorises, par_id.get(version.conte)).ecarts
        entrees.append(entree)
    document = {
        "date": horloge(),
        "source": _relatif(dossier or CONTES_WORK),
        "decisions": list(DECISIONS),
        "retour": '{"<niveau>/<conte>": "relu" | "rejete", …}, appliqué par '
        "`wenlu contes appliquer-relecture <fichier>`",
        "contes": entrees,
    }
    sortie = sortie or RELECTURE
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")
    return sortie, len(entrees)


def _cle_version(cle: str) -> tuple[Niveau, str] | None:
    """`255/yu-gong-yi-shan` → (255, "yu-gong-yi-shan") ; `hsk3/mei-hou-wang` → ("hsk3", …)."""
    seuil, _, conte = cle.partition("/")
    if not conte:
        return None
    try:
        return lire_niveau(seuil), conte
    except SeuilInconnu:
        return None


def appliquer_relecture(decisions: object, dossier: Path | None = None) -> list[Version]:
    """Applique `{"<seuil>/<conte>": "relu" | "rejete"}` par `relire()`. Tout ou rien.

    Une valeur `null` est une version pas encore décidée : elle est laissée telle quelle.
    Une version rejetée aux contrôles ne peut pas être relue : il faut corriger son
    brouillon et le réimporter.
    """
    if not isinstance(decisions, dict):
        raise RelectureInvalide(['attendu un objet JSON {"<seuil>/<conte>": "relu" | "rejete"}'])
    problemes: list[str] = []
    retenues: list[tuple[str, Niveau, str]] = []
    for cle, statut in decisions.items():
        if statut is None:
            continue
        lue = _cle_version(str(cle))
        if lue is None:
            problemes.append(f"{cle} : clé attendue <niveau>/<conte>, par exemple 255/yu-gong-yi-shan ou hsk3/mei-hou-wang")
            continue
        if statut not in DECISIONS:
            problemes.append(f"{cle} : décision {statut!r}, attendu {' ou '.join(DECISIONS)}")
            continue
        seuil, conte = lue
        chemin = chemin_version(seuil, conte, dossier)
        if not chemin.exists():
            problemes.append(f"{cle} : aucune version ({_relatif(chemin)})")
            continue
        version = lire_version(chemin)
        if statut == RELU and version.generation.intrus:
            problemes.append(
                f"{cle} : rejetée aux contrôles (hors liste : {' '.join(version.generation.intrus)}), "
                "à corriger avant relecture"
            )
            continue
        retenues.append((conte, seuil, str(statut)))
    if problemes:
        raise RelectureInvalide(problemes)
    return [relire(conte, seuil, statut, dossier) for conte, seuil, statut in retenues]


def _catalogue_par_id() -> dict[str, Conte]:
    """Le catalogue par identifiant, pour confronter une version à ce qu'il prévoit."""
    return {c.id: c for c in charger_catalogue()}


def _relatif(chemin: Path) -> str:
    try:
        return str(chemin.relative_to(RACINE))
    except ValueError:
        return str(chemin)


# --------------------------------------------------------------------------- check


#: Ce que devient un niveau prévu au catalogue.
ECRIT = "ecrit"
#: Sa liste est versionnée, mais aucune version n'est encore écrite.
A_ECRIRE = "a_ecrire"
#: Sa liste n'est pas encore versionnée : il l'attend pour s'écrire.
SANS_LISTE = "sans_liste"


@dataclass(frozen=True)
class NiveauPrevu:
    """Un niveau prévu d'un conte, et où il en est. `statut` : celui de la version écrite."""

    conte: str
    seuil: Niveau
    etat: str
    statut: str | None = None


def etat_des_niveaux(
    catalogue: Sequence[Conte], versions: Iterable[Version], listes: Path | None = None
) -> list[NiveauPrevu]:
    """Chaque niveau prévu de chaque conte, dans l'ordre du catalogue : écrit, à écrire
    (liste présente) ou sans liste. Un niveau prévu non écrit est un écart, jamais un
    blocage : on ne l'écrit pas sans sa liste, et on ne reconstitue pas une liste. Un
    niveau HSK n'est à écrire que si les listes de tous les niveaux qu'il cumule sont là."""
    ecrites = {(v.conte, v.seuil): v.statut for v in versions}
    listes_presentes = {s: liste_presente(s, listes) for s in (*SEUILS, *HSK)}
    niveaux: list[NiveauPrevu] = []
    for conte in catalogue:
        for seuil in conte.niveaux:
            if (conte.id, seuil) in ecrites:
                niveaux.append(NiveauPrevu(conte.id, seuil, ECRIT, ecrites[(conte.id, seuil)]))
            elif listes_presentes.get(seuil):
                niveaux.append(NiveauPrevu(conte.id, seuil, A_ECRIRE))
            else:
                niveaux.append(NiveauPrevu(conte.id, seuil, SANS_LISTE))
    return niveaux


def controle_niveaux(
    catalogue: Sequence[Conte], versions: Sequence[Version], listes: Path | None = None
) -> Controle:
    """« contes : niveaux prévus » : ce qui reste à écrire, et ce qui s'écarte du catalogue
    (seuil non prévu, nombre de chapitres, conte hors catalogue). Jamais bloquant."""
    niveaux = etat_des_niveaux(catalogue, versions, listes)
    ecrits = [n for n in niveaux if n.etat == ECRIT]
    a_ecrire = [n for n in niveaux if n.etat == A_ECRIRE]
    sans_liste = [n for n in niveaux if n.etat == SANS_LISTE]
    par_id = {c.id: c for c in catalogue}
    hors_plan: list[str] = []
    for version in versions:
        conte = par_id.get(version.conte)
        if conte is None:
            hors_plan.append(f"{version.cle} : conte hors catalogue")
            continue
        hors_plan += [f"{version.cle} : {e}" for e in ecarts_au_catalogue(version, conte)]
    longs = sum(1 for c in catalogue if c.long)
    detail = (
        f"{len(niveaux)} niveaux prévus pour {len(catalogue)} contes, dont {longs} longs : "
        f"{len(ecrits)} écrits, {len(a_ecrire)} à écrire, {len(sans_liste)} attendent leur liste"
    )
    if sans_liste:
        seuils = sorted({n.seuil for n in sans_liste}, key=rang)
        detail += f" ({', '.join(str(s) for s in seuils)})"
    if a_ecrire:
        detail += " ; à écrire : " + ", ".join(f"{n.seuil}/{n.conte}" for n in a_ecrire[:5])
    if hors_plan:
        detail += " ; hors du catalogue : " + " ; ".join(hors_plan[:5])
    return Controle(
        "contes : niveaux prévus",
        not a_ecrire and not sans_liste and not hors_plan,
        detail,
        bloquant=False,
    )


def controles(
    dossier: Path | None = None, listes: Path | None = None, catalogue: Path | None = None
) -> list[Controle]:
    """Contrôles des contes, appelés par `wenlu check`.

    « caractères hors liste » est bloquant : un conte d'un seuil ne peut pas
    contenir un caractère que l'apprenant n'a pas encore vu. « catalogue » l'est
    aussi : un catalogue illisible ne dit plus ce qui est prévu. « niveaux prévus »
    signale ce qui reste à écrire, sans jamais bloquer.
    """
    try:
        lu = charger_catalogue(catalogue)
        controle_catalogue = Controle(
            "contes : catalogue",
            True,
            f"{len(lu)} contes, dont {sum(1 for c in lu if c.long)} longs "
            f"({sum(c.chapitres for c in lu if c.long)} chapitres prévus)",
            bloquant=True,
        )
    except (CatalogueInvalide, OSError) as erreur:
        lu = None
        controle_catalogue = Controle("contes : catalogue", False, str(erreur), bloquant=True)

    fichiers = versions_ecrites(dossier)
    versions = [lire_version(chemin) for chemin in fichiers]
    suite = [controle_catalogue]
    if lu is not None:
        suite.append(controle_niveaux(lu, versions, listes))
    if not fichiers:
        return [Controle("contes : caractères hors liste", True, "aucune version générée"), *suite]

    fautifs: list[str] = []
    sans_liste: set[Niveau] = set()
    a_relire = 0
    cache: dict[Niveau, list[str] | None] = {}
    for version in versions:
        if version.statut != RELU:
            a_relire += 1
        if version.seuil not in cache:
            try:
                cache[version.seuil] = charger_seuil(version.seuil, listes)
            except (SeuilInconnu, SeuilSansListe):
                cache[version.seuil] = None
        autorises = cache[version.seuil]
        if autorises is None:
            sans_liste.add(version.seuil)
            continue
        intrus = caracteres_hors_liste(version.texte, autorises)
        if intrus:
            fautifs.append(f"{version.conte} ({version.seuil}) : {' '.join(intrus)}")

    detail = f"{len(fichiers)} versions contrôlées"
    if fautifs:
        detail = f"{len(fautifs)} versions hors liste — " + " ; ".join(fautifs[:5])
    elif sans_liste:
        detail += f" ; niveaux sans liste, non contrôlés : {', '.join(str(s) for s in sorted(sans_liste, key=rang))}"
    return [
        Controle("contes : caractères hors liste", not fautifs, detail, bloquant=True),
        Controle(
            "contes : relecture",
            a_relire == 0,
            f"{a_relire} versions sur {len(fichiers)} restent à relire avant export",
        ),
        *suite,
    ]


# --------------------------------------------------------------------------- cli

app = typer.Typer(
    help="Contes par niveau : génération par lots ou rédaction sans API, validation, relecture."
)


def _client(modele: str) -> ClientClaude:
    return claude.client_ou_sortie(lambda: client_anthropic(modele))


#: L'aide des options `--niveau` (alias `--seuil`).
AIDE_NIVEAU = "Le niveau : 255, ou un niveau HSK, hsk1 à hsk6 et hsk7-9 (405 à 1555 sans liste)."


def _niveau(texte: str) -> Niveau:
    """Le niveau d'une option de la ligne de commande ; sort en erreur s'il est inconnu."""
    try:
        return lire_niveau(texte)
    except SeuilInconnu as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


def _autorises(seuil: Niveau) -> list[str]:
    try:
        return charger_seuil(seuil)
    except (SeuilInconnu, SeuilSansListe) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


@app.command("generer")
def commande_generer(
    niveau: str = typer.Option(..., "--niveau", "--seuil", help=AIDE_NIVEAU),
    conte: Optional[str] = typer.Option(None, "--conte", help="Un seul conte, en mode unitaire."),
    modele: str = typer.Option(MODELE, "--modele", help="Modèle Claude."),
) -> None:
    """Génère les contes d'un niveau : par lots, ou un seul conte en unitaire."""
    seuil = _niveau(niveau)
    autorises = _autorises(seuil)
    catalogue = charger_catalogue()
    client = _client(modele)

    if conte is not None:
        choisi = conte_par_id(conte, catalogue)
        if choisi.long:
            typer.echo(
                f"{choisi.id} est un récit long ({choisi.chapitres} chapitres) : il se rédige par "
                f"brouillon, chapitre par chapitre (`wenlu contes contexte {choisi.id} --niveau {seuil}`).",
                err=True,
            )
            raise typer.Exit(code=1)
        version, rapport = generer_version(choisi, seuil, autorises, client)
        chemin = ecrire_version(version)
        typer.echo(f"{choisi.id} ({seuil}) : {version.statut}, {version.generation.essais} essai(s) → {chemin}")
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
        if not rapport.conforme:
            typer.echo(f"Caractères hors liste : {' '.join(rapport.intrus)}", err=True)
            raise typer.Exit(code=1)
        return

    a_generer = contes_du_seuil(catalogue, seuil)
    if not a_generer:
        typer.echo(f"Aucune fable ne prévoit le niveau {seuil} au catalogue.")
        return
    lot = soumettre_lot(a_generer, seuil, autorises, client)
    typer.echo(f"Lot {lot['lot']} soumis : {len(a_generer)} contes {au_niveau(seuil)}.")
    typer.echo("Récupération : `wenlu contes recuperer` (les lots aboutissent sous 24 h).")


@app.command("recuperer")
def commande_recuperer(
    modele: str = typer.Option(MODELE, "--modele", help="Modèle Claude."),
    relancer: bool = typer.Option(True, "--relancer/--sans-relance", help="Resoumettre les rejets."),
) -> None:
    """Récupère les lots soumis, valide, écrit les versions et relance les rejets."""
    fichiers = lots_en_cours()
    if not fichiers:
        typer.echo("Aucun lot en cours.")
        return
    client = _client(modele)
    for fichier in fichiers:
        for ligne in recuperer_lot(fichier, client, relancer=relancer):
            typer.echo(ligne)
    typer.echo(f"Versions dans {_relatif(CONTES_WORK)}.")


@app.command("valider")
def commande_valider(
    niveau: Optional[str] = typer.Option(None, "--niveau", "--seuil", help="Ne valider qu'un niveau."),
) -> None:
    """Revalide les versions déjà écrites contre la liste de leur niveau."""
    seuil = None if niveau is None else _niveau(niveau)
    fichiers = [f for f in versions_ecrites() if seuil is None or f.parent.name == str(seuil)]
    if not fichiers:
        typer.echo("Aucune version à valider.")
        return
    hors_liste = 0
    par_id = _catalogue_par_id()
    for chemin in fichiers:
        version = lire_version(chemin)
        rapport = valider(version, _autorises(version.seuil), par_id.get(version.conte))
        etat = "ok   " if rapport.conforme else "rejet"
        typer.echo(f"{etat} {version.conte} ({version.seuil}) [{version.statut}]")
        if not rapport.conforme:
            hors_liste += 1
            typer.echo(f"  hors liste : {' '.join(rapport.intrus)}")
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
    if hors_liste:
        typer.echo(f"{hors_liste} versions hors liste.", err=True)
        raise typer.Exit(code=1)


@app.command("relire")
def commande_relire(
    conte: str = typer.Option(..., "--conte", help="L'identifiant du conte relu."),
    niveau: str = typer.Option(..., "--niveau", "--seuil", help="Le niveau de la version relue."),
    statut: str = typer.Option(RELU, "--statut", help=f"{', '.join(STATUTS)}."),
) -> None:
    """Marque la relecture humaine d'une version : `--statut relu` la rend exportable."""
    try:
        version = relire(conte, _niveau(niveau), statut)
    except (ValueError, FileNotFoundError) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    typer.echo(f"{version.cle} : statut {version.statut}.")


#: Comment `wenlu contes plan` dit l'état d'un niveau.
ETATS_LISIBLES = {ECRIT: "écrit", A_ECRIRE: "à écrire", SANS_LISTE: "attend sa liste"}


@app.command("plan")
def commande_plan() -> None:
    """Les niveaux prévus de chaque conte, et où ils en sont : écrit, à écrire, sans liste."""
    catalogue = charger_catalogue()
    versions = [lire_version(chemin) for chemin in versions_ecrites()]
    par_conte: dict[str, list[NiveauPrevu]] = {}
    for niveau in etat_des_niveaux(catalogue, versions):
        par_conte.setdefault(niveau.conte, []).append(niveau)
    for conte in catalogue:
        etats = " · ".join(
            f"{n.seuil} {ETATS_LISIBLES[n.etat]}" + (f" ({n.statut})" if n.statut else "")
            for n in par_conte.get(conte.id, [])
        )
        long = f", {conte.chapitres} chapitres" if conte.long else ""
        typer.echo(f"{conte.titre_zh} {conte.id}{long} : {etats}")


# --------------------------------------------------------------------------- cli : rédaction sans API


@app.command("contexte")
def commande_contexte(
    contes: list[str] = typer.Argument(..., help="Un ou plusieurs identifiants du catalogue."),
    niveau: str = typer.Option("255", "--niveau", "--seuil", help=AIDE_NIVEAU),
) -> None:
    """Ce qu'un rédacteur doit savoir d'un conte avant d'écrire son brouillon."""
    seuil = _niveau(niveau)
    autorises = _autorises(seuil)
    catalogue = charger_catalogue()
    typer.echo(contraintes(seuil))
    inconnus = 0
    for identifiant in dict.fromkeys(contes):
        typer.echo("")
        try:
            conte = conte_par_id(identifiant, catalogue)
        except CatalogueInvalide as erreur:
            inconnus += 1
            typer.echo(f"== {identifiant} == {erreur}")
            continue
        for ligne in decrire_contexte(conte, seuil, autorises):
            typer.echo(ligne)
    if inconnus:
        raise typer.Exit(code=1)


@app.command("importer")
def commande_importer(
    contes: Optional[list[str]] = typer.Argument(
        None, help="Les contes à importer, par identifiant (défaut : tous les brouillons)."
    ),
    niveau: Optional[str] = typer.Option(
        None, "--niveau", "--seuil", help="Ne prendre que les brouillons de ce niveau."
    ),
) -> None:
    """Importe les brouillons rédigés sans API : mêmes contrôles que les contes générés."""
    seuil = None if niveau is None else _niveau(niveau)
    chemins = brouillons_ecrits()
    absents: list[str] = []
    if contes:
        voulus = set(contes)
        chemins = [p for p in chemins if p.parent.name in voulus]
        absents = sorted(voulus - {p.parent.name for p in chemins})
    if seuil is not None:
        chemins = [p for p in chemins if p.stem == str(seuil)]
    for identifiant in absents:
        typer.echo(f"erreur {identifiant} : aucun brouillon dans {_relatif(BROUILLONS / identifiant)}")
    if not chemins:
        typer.echo(f"Aucun brouillon à importer dans {_relatif(BROUILLONS)}.")
        if absents:
            raise typer.Exit(code=1)
        return
    catalogue = charger_catalogue()
    listes: dict[Niveau, list[str]] = {}
    rejetes = 0
    erreurs = len(absents)
    conformes = 0
    for chemin in chemins:
        try:
            brouillon = lire_brouillon(chemin)
            conte = conte_par_id(brouillon.conte, catalogue)
            if brouillon.seuil not in listes:
                listes[brouillon.seuil] = charger_seuil(brouillon.seuil)
            resultat = importer_brouillon(brouillon, conte, listes[brouillon.seuil])
        except BrouillonInvalide as erreur:
            erreurs += 1
            typer.echo(f"erreur {erreur.nom} : brouillon illisible, rien n'est écrit")
            for probleme in erreur.problemes:
                typer.echo(f"  format : {probleme}")
            continue
        except (CatalogueInvalide, SeuilInconnu, SeuilSansListe) as erreur:
            erreurs += 1
            typer.echo(f"erreur {chemin.parent.name}/{chemin.stem} : {erreur}, rien n'est écrit")
            continue
        version, rapport = resultat.version, resultat.rapport
        if resultat.inchange:
            etat = f"inchangée, statut {version.statut}"
        elif rapport.conforme:
            etat = "à relire"
        else:
            etat = "rejetée"
        remplace = f", remplace une version {resultat.remplace}" if resultat.remplace else ""
        longueur = sum(1 for p in version.phrases for c in p.zh if est_sinogramme(c))
        typer.echo(
            f"{'ok   ' if rapport.conforme else 'rejet'} {version.cle} : {etat}, "
            f"{longueur} sinogrammes → {_relatif(resultat.chemin)}{remplace}"
        )
        if rapport.intrus:
            typer.echo(f"  hors du niveau {version.seuil} : {' '.join(rapport.intrus)}")
            typer.echo(f"  (liste : `wenlu contes contexte {version.conte} --niveau {version.seuil}`)")
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
        if rapport.conforme:
            conformes += 1
        else:
            rejetes += 1
    typer.echo(f"{conformes} conformes, {rejetes} rejetés, {erreurs} en erreur.")
    if rejetes or erreurs:
        typer.echo("Corriger les brouillons signalés, puis relancer l'import.", err=True)
        raise typer.Exit(code=1)


@app.command("exporter-relecture")
def commande_exporter_relecture(
    sortie: Optional[Path] = typer.Option(
        None, "--sortie", help="Fichier JSON écrit (défaut : data/work/relecture-contes.json)."
    ),
) -> None:
    """Rassemble les versions à relire en un seul JSON, pour une page de relecture."""
    chemin, nombre = exporter_relecture(sortie=sortie)
    typer.echo(f"{nombre} versions à relire → {_relatif(chemin)}.")


@app.command("appliquer-relecture")
def commande_appliquer_relecture(
    fichier: Path = typer.Argument(..., help='JSON {"<seuil>/<conte>": "relu" | "rejete", …}.'),
) -> None:
    """Applique les décisions d'une relecture humaine : `relire` sur chaque version."""
    try:
        decisions = json.loads(fichier.read_text(encoding="utf-8"))
        relues = appliquer_relecture(decisions)
    except (OSError, json.JSONDecodeError) as erreur:
        typer.echo(f"{fichier} illisible : {erreur}", err=True)
        raise typer.Exit(code=1) from erreur
    except RelectureInvalide as erreur:
        typer.echo("Rien n'est appliqué :", err=True)
        for probleme in erreur.problemes:
            typer.echo(f"  {probleme}", err=True)
        raise typer.Exit(code=1) from erreur
    for version in relues:
        typer.echo(f"{version.cle} : statut {version.statut}.")
    typer.echo(f"{len(relues)} décisions appliquées.")
