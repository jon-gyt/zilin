"""Fiches FR et EN (story 1.4).

Une fiche explique un caractère du parcours par ses composants : une origine en
exactement trois phrases en français et en anglais, l'étiquette `atteste` ou
`mnemotechnique`, le rôle de chaque composant (son, sens, forme), deux mots et une
phrase. Aucun texte de fiche n'entre dans le dépôt sans passer par le pipeline : il
sort de la génération ou de l'import d'un brouillon, puis d'une relecture humaine.

Chaîne : `contexte()` assemble les faits (décomposition canonique GF 0014-2009 et
nom normalisé de chaque composant, pinyin, rôles probables, mots candidats,
caractères acquis à ce jour), `invite()` en fait l'invite (système + utilisateur),
Claude répond en JSON structuré, `valider()` refuse ce qui sort du cadre, et la
génération relance en signalant nommément ce qui a été refusé, au plus `ESSAIS_MAX`
fois. Chaque fiche écrite porte sa traçabilité (caractère, modèle, API, date,
empreinte de l'invite, essais) et le statut « à relire » : la relecture humaine est
obligatoire sur le seuil 255 avant export (brief §17).

Licences (`docs/sources-licences.md`) :

- §4.2 : les définitions anglaises de CC-CEDICT n'entrent jamais dans une invite de
  génération FR. Des mots candidats, ce module ne lit que le mot et son pinyin ; les
  traductions FR et EN sont rédigées par le modèle, en ses propres mots.
- §2.2 : `dictionary.txt` est une source de contrôle hors distribution. Son type
  d'étymologie et ses champs `phonetic` et `semantic` sont des données factuelles,
  utilisables pour le rôle son / sens. Son `hint` anglais est une information, pas un
  texte à reprendre : il est donné au modèle nommément marqué comme indice à
  vérifier, à ne ni traduire ni recopier.

Deux chemins d'appel à l'API, même invite :

- unitaire : `wenlu fiches generer --c 住`, réponse immédiate, relance automatique ;
- par lots : `wenlu fiches generer --parcours lire --jusqua 40` soumet les caractères
  en une fois à l'API Message Batches (moitié prix, résultat sous 24 h), puis
  `wenlu fiches recuperer` récupère, valide, écrit, et resoumet ce qui a été rejeté.

Sans API : un rédacteur (un agent Claude Code dans sa session, sans clé ni réseau)
lit `wenlu fiches contexte 住` — les mêmes faits que l'invite —, écrit un brouillon
dans `data/sources/fiches-brouillons/<c>.json`, et `wenlu fiches importer` le fait
passer par le même `valider()`. La traçabilité le dit : `api` vaut
« session Claude Code (sans API) », `modele` « rédaction manuelle », l'empreinte est
celle du brouillon.

Sortie : `data/sources/fiches/<c>.json`, versionné (format dans `data/schema.md`) ;
journal des lots, état de travail hors dépôt, dans `data/work/fiches/lots/<lot>.json`.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Callable, Collection, Iterable, Mapping, Optional, Sequence

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
from .gf0014 import Controle, TableGF0014, charger_table
from .ingest import charger_liste, est_sinogramme
from .paths import BUILD, DATA, FICHES_WORK, INGEST, LISTES, RACINE, WORK
from .surcharges import charger_mots_exclus, charger_pinyin


#: Au plus trois appels pour une même fiche.
ESSAIS_MAX = 3

#: L'origine tient en exactement trois phrases (brief §6 : « explications en trois phrases »).
PHRASES_ORIGINE = 3

#: Deux mots par fiche (brief §7 : « le mot avant le caractère seul »).
MOTS_PAR_FICHE = 2

#: Au-delà, l'invite devient un annuaire : on garde les premiers mots candidats.
MAX_CANDIDATS = 40

#: Le sens d'un caractère, `sens_fr` et `sens_en` : une glose courte, lue sous le pinyin
#: (carte du jour, fiches, menus) et posée en question (« sens d'un caractère »).
SENS_MAX = 40

#: Ce qui ne termine jamais une glose : c'est une étiquette, pas une phrase.
POINTS_FINAUX_SENS = ".。"

#: Journal des lots soumis à l'API : état de travail, hors dépôt, à côté des autres.
LOTS_WORK = WORK / "fiches" / "lots"

#: Seuil sur lequel la relecture humaine est obligatoire avant export (brief §17).
SEUIL_RELECTURE = 255

PARCOURS = ("lire", "hsk")

ROLES = ("son", "sens", "forme")
ETIQUETTES = ("atteste", "mnemotechnique")

A_RELIRE = "a_relire"
REJETE = "rejete"
RELU = "relu"
STATUTS = (A_RELIRE, REJETE, RELU)

#: Ponctuation admise dans la phrase : celle que le woff2 chinois embarque.
PONCTUATION = set(PONCTUATION_CHINOISE) | set(" \n　")

#: Fins de phrase comptées dans l'origine.
FINS_DE_PHRASE = ".!?…。！？"


class ParcoursInconnu(ValueError):
    """Parcours hors des parcours du brief."""


class CorpusAbsent(FileNotFoundError):
    """Le résultat de `wenlu build` manque : rien à assembler."""


class CaractereHorsParcours(KeyError):
    """Le caractère demandé n'est pas posé par le parcours."""


# --------------------------------------------------------------------------- contexte


@dataclass(frozen=True)
class Element:
    """Un composant canonique GF 0014-2009 dans le contexte d'une fiche.

    `nom` est le nom normalisé de la norme (部件名称), vide hors table.
    `role_probable` vaut `son` ou `sens` quand l'étymologie de Make Me a Hanzi
    désigne ce composant comme `phonetic` ou `semantic` : c'est une donnée de
    source, soumise au modèle pour vérification, jamais un verdict.
    """

    forme: str
    nom: str = ""
    role_probable: str | None = None


@dataclass(frozen=True)
class MotCandidat:
    """Un mot de deux caractères et son pinyin. Rien d'autre n'est repris de CC-CEDICT."""

    hanzi: str
    pinyin: str


@dataclass(frozen=True)
class Contexte:
    """Les faits d'un caractère, tels qu'ils entrent dans l'invite."""

    c: str
    parcours: str
    jour: int
    pinyin: tuple[str, ...]
    structure: str
    reconcilie: bool
    genre: str
    famille: str
    elements: tuple[Element, ...]
    type_etymologie: str | None
    indice_en: str | None
    acquis: tuple[str, ...]
    candidats: tuple[MotCandidat, ...]

    @property
    def formes(self) -> tuple[str, ...]:
        return tuple(e.forme for e in self.elements)


def _pinyin_de_nom_propre(pinyin: str) -> bool:
    """Vrai si le pinyin CC-CEDICT est capitalisé : nom propre, patronyme, toponyme.

    Le test porte sur le pinyin, pas sur la définition anglaise : c'est la
    convention de notation de la source, et elle reste hors des invites FR.
    """
    return any(syllabe[:1].isupper() for syllabe in pinyin.split())


class Corpus:
    """Ce que `wenlu build` et `wenlu ingest` donnent à lire pour une fiche.

    Injectable : les tests en construisent un en mémoire, sans fichier ni réseau.
    """

    def __init__(
        self,
        parcours: str,
        jours: Sequence[Mapping[str, object]],
        decompositions: Mapping[str, Mapping[str, object]],
        noeuds: Mapping[str, Mapping[str, object]],
        caracteres: Mapping[str, Mapping[str, object]],
        mots: Sequence[MotCandidat],
        table: TableGF0014,
        *,
        max_candidats: int = MAX_CANDIDATS,
        exclus: Collection[str] = (),
        depart: Sequence[str] = (),
    ) -> None:
        if parcours not in PARCOURS:
            raise ParcoursInconnu(f"parcours {parcours!r} inconnu : {', '.join(PARCOURS)}")
        self.parcours = parcours
        self.decompositions = decompositions
        self.noeuds = noeuds
        self.caracteres = caracteres
        self.table = table
        self.max_candidats = max_candidats

        self._jour: dict[str, int] = {}
        self._acquis: dict[str, tuple[str, ...]] = {}
        self.ordre: tuple[str, ...] = ()
        vus: list[str] = []
        for entree in jours:
            numero = int(entree.get("jour", len(self._jour) + 1))
            brique = entree.get("brique")
            du_jour = ([str(brique)] if brique else []) + [str(x) for x in (entree.get("composes") or [])]
            vus.extend(du_jour)
            instantane = tuple(vus)
            for c in du_jour:
                self._jour.setdefault(c, numero)
                self._acquis.setdefault(c, instantane)
        self.ordre = tuple(vus)
        # La première session pose le départ d'un coup (graphe.DEPART) : la fiche de
        # chacun de ses caractères se lit après elle, avec tout le départ acquis.
        self.depart = tuple(c for c in depart if c in self._acquis)
        if self.depart:
            fin = max((self._acquis[c] for c in self.depart), key=len)
            for c in self.depart:
                self._acquis[c] = fin

        self.exclus = frozenset(exclus)
        self._mots: list[MotCandidat] = [
            m
            for m in mots
            if len(m.hanzi) == 2
            and not _pinyin_de_nom_propre(m.pinyin)
            and m.hanzi not in self.exclus
        ]

    def __contains__(self, c: object) -> bool:
        return c in self._jour

    def jour(self, c: str) -> int:
        try:
            return self._jour[c]
        except KeyError as erreur:
            raise CaractereHorsParcours(
                f"{c} n'est pas posé par le parcours {self.parcours}"
            ) from erreur

    def acquis(self, c: str) -> tuple[str, ...]:
        """Caractères acquis le jour où `c` est posé, `c` compris.

        Pour un caractère du départ, ceux de toute la première session, qui les
        pose ensemble.
        """
        self.jour(c)
        return self._acquis[c]

    def candidats(self, c: str) -> tuple[MotCandidat, ...]:
        """Mots de deux caractères contenant `c`, entièrement lisibles ce jour-là.

        Un mot n'est candidat que si ses deux caractères sont déjà vus : la fiche
        ne fait jamais lire ce qui n'a pas été posé. Les mots de
        `data/sources/mots-exclus.tsv` (argot, mahjong, mots rares, fragments de
        locution) ne le sont jamais.
        """
        lisibles = set(self.acquis(c))
        retenus: dict[str, MotCandidat] = {}
        for mot in self._mots:
            if c not in mot.hanzi or not set(mot.hanzi) <= lisibles:
                continue
            retenus.setdefault(mot.hanzi, mot)
            if len(retenus) >= self.max_candidats:
                break
        return tuple(retenus.values())

    def elements(self, c: str) -> tuple[Element, ...]:
        """Composants canoniques de `c`, nommés, avec leur rôle probable s'il est connu."""
        decomposition = self.decompositions.get(c) or {}
        formes = [str(f) for f in (decomposition.get("composants") or ())]
        etymologie = (self.caracteres.get(c) or {}).get("etymologie") or {}
        phonetique = etymologie.get("phonetic") if isinstance(etymologie, dict) else None
        semantique = etymologie.get("semantic") if isinstance(etymologie, dict) else None
        elements: list[Element] = []
        for forme in dict.fromkeys(formes):
            role = "son" if forme == phonetique else "sens" if forme == semantique else None
            nom = self.table[forme].nom if forme in self.table else ""
            elements.append(Element(forme=forme, nom=nom, role_probable=role))
        return tuple(elements)

    def contexte(self, c: str) -> Contexte:
        """Assemble le contexte factuel d'une fiche."""
        jour = self.jour(c)
        decomposition = self.decompositions.get(c) or {}
        noeud = self.noeuds.get(c) or {}
        caractere = self.caracteres.get(c) or {}
        etymologie = caractere.get("etymologie") or {}
        if not isinstance(etymologie, dict):
            etymologie = {}
        indice = etymologie.get("hint")
        return Contexte(
            c=c,
            parcours=self.parcours,
            jour=jour,
            pinyin=tuple(str(p) for p in (caractere.get("pinyin") or ())),
            structure=str(decomposition.get("structure") or c),
            reconcilie=bool(decomposition.get("reconcilie", False)),
            genre=str(noeud.get("genre") or ""),
            famille=str(noeud.get("racine") or c),
            elements=self.elements(c),
            type_etymologie=str(etymologie.get("type")) if etymologie.get("type") else None,
            indice_en=str(indice) if indice else None,
            acquis=self.acquis(c),
            candidats=self.candidats(c),
        )


def _lire_json(chemin: Path) -> object:
    if not chemin.exists():
        raise CorpusAbsent(f"{chemin} absent : lancer `uv run wenlu fetch`, `ingest` puis `build`.")
    return json.loads(chemin.read_text(encoding="utf-8"))


def charger_mots(chemin: Path) -> list[MotCandidat]:
    """Lit `mots.json` en ne retenant que le mot et son pinyin (licence §4.2)."""
    brut = _lire_json(chemin)
    if not isinstance(brut, list):
        raise CorpusAbsent(f"{chemin} : format inattendu")
    return [MotCandidat(hanzi=str(m["simplifie"]), pinyin=str(m["pinyin"])) for m in brut]


def charger_corpus(
    parcours: str = "lire",
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    table: TableGF0014 | None = None,
) -> Corpus:
    """Charge le corpus depuis `data/work/build/` et `data/work/ingest/`.

    Deux surcharges versionnées s'y appliquent : le pinyin de
    `data/sources/surcharges/pinyin.tsv` remplace celui de Make Me a Hanzi, et les
    mots de `data/sources/mots-exclus.tsv` ne sont jamais candidats.
    """
    if parcours not in PARCOURS:
        raise ParcoursInconnu(f"parcours {parcours!r} inconnu : {', '.join(PARCOURS)}")
    build = build or BUILD
    ingest = ingest or INGEST
    chemin_parcours = _lire_json(build / f"parcours-{parcours}.json")
    decompositions = _lire_json(build / "decompositions.json")
    graphe = _lire_json(build / "graphe.json")
    caracteres = _lire_json(ingest / "caracteres.json")
    assert isinstance(chemin_parcours, dict) and isinstance(decompositions, dict)
    assert isinstance(graphe, dict) and isinstance(caracteres, list)
    lectures = charger_pinyin()
    return Corpus(
        parcours=parcours,
        jours=chemin_parcours["jours"],
        decompositions={str(d["c"]): d for d in decompositions["caracteres"]},
        noeuds={str(n["c"]): n for n in graphe["noeuds"]},
        caracteres={
            str(c["c"]): ({**c, "pinyin": list(lectures[str(c["c"])])} if str(c["c"]) in lectures else c)
            for c in caracteres
        },
        mots=charger_mots(ingest / "mots.json"),
        table=table or charger_table(),
        exclus=charger_mots_exclus(),
        depart=[str(c) for c in (chemin_parcours.get("depart") or [])],
    )


# --------------------------------------------------------------------------- invite

#: Schéma de sortie imposé au modèle (structured outputs, `output_config.format`).
SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "origine_fr": {"type": "string"},
        "origine_en": {"type": "string"},
        "etiquette": {"type": "string", "enum": list(ETIQUETTES)},
        "memo_fr": {"type": ["string", "null"]},
        "memo_en": {"type": ["string", "null"]},
        "roles": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "c": {"type": "string"},
                    "role": {"type": "string", "enum": list(ROLES)},
                },
                "required": ["c", "role"],
                "additionalProperties": False,
            },
        },
        "mots": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "hanzi": {"type": "string"},
                    "pinyin": {"type": "string"},
                    "fr": {"type": "string"},
                    "en": {"type": "string"},
                },
                "required": ["hanzi", "pinyin", "fr", "en"],
                "additionalProperties": False,
            },
        },
        "phrase": {
            "type": "object",
            "properties": {
                "zh": {"type": "string"},
                "pinyin": {"type": "string"},
                "fr": {"type": "string"},
                "en": {"type": "string"},
            },
            "required": ["zh", "pinyin", "fr", "en"],
            "additionalProperties": False,
        },
    },
    "required": ["origine_fr", "origine_en", "etiquette", "memo_fr", "memo_en", "roles", "mots", "phrase"],
    "additionalProperties": False,
}

MARQUE_INDICE = (
    "Indice d'étymologie en anglais (Make Me a Hanzi, source de contrôle) : "
    "piste à vérifier, à ne ni traduire ni recopier"
)

SYSTEME = f"""Tu rédiges les fiches d'une application qui apprend à lire le chinois par \
les familles de caractères. Une fiche explique un caractère par ses composants, pour un \
lecteur francophone et un lecteur anglophone.

Règles absolues, dans cet ordre :

1. L'origine fait EXACTEMENT {PHRASES_ORIGINE} phrases en français (origine_fr) et \
{PHRASES_ORIGINE} phrases en anglais (origine_en) : {PHRASES_ORIGINE} points finaux, pas un de \
plus, pas un de moins. Les deux versions disent la même chose ; l'anglaise est rédigée \
pour un anglophone, ce n'est pas un mot à mot.
2. L'étiquette dit ce que vaut cette origine. `atteste` seulement si l'origine est \
établie par les sources classiques : le 說文解字 (Shuowen jiezi) ou la paléographie \
(os oraculaires, bronzes, petit sceau). `mnemotechnique` dans tous les autres cas : une \
image qui aide à retenir, que les sources n'attestent pas. Jamais l'un pour l'autre ; \
dans le doute, `mnemotechnique`.
3. Sous l'étiquette `mnemotechnique`, l'origine ne prétend jamais dire ce que le \
caractère a voulu dire autrefois : elle décrit ce que l'on voit dans le caractère tel \
qu'il s'écrit aujourd'hui.
4. memo_fr et memo_en sont facultatifs : une phrase courte pour retenir, quand elle \
ajoute quelque chose à l'origine. Sinon, laisse-les vides.
5. Le rôle de chaque composant fourni, et de lui seul : `son` s'il aide à prononcer \
le caractère aujourd'hui, c'est-à-dire si la phonétique qu'il écrit se lit en mandarin \
moderne sur la même syllabe, ton mis à part (妈 mā ← 马 mǎ) ; `sens` s'il donne le \
sens ; `forme` s'il ne fait ni l'un ni l'autre — il n'est là que pour le trait, ou \
son rôle est perdu. Une phonétique seulement historique, qui ne sonne plus pareil \
(说 shuō ← 兑 duì), est `forme` : l'origine peut dire qu'elle donnait autrefois le son.
6. Les deux mots sont pris dans la liste des mots candidats, écrits exactement comme \
elle les donne. Un candidat rare, d'argot ou douteux ne se prend pas : mieux vaut un \
mot de moins, ou aucun. Tu en donnes le pinyin avec les tons, puis une traduction que tu \
rédiges toi-même, en français et en anglais. Aucune définition d'une autre source \
n'est recopiée ni traduite.
7. La phrase n'emploie QUE les caractères acquis fournis. Aucun autre, même courant, \
même évident. Seule ponctuation autorisée : {PONCTUATION_CHINOISE}. Pinyin avec les \
tons, traduction en français et en anglais.
8. Les indices d'étymologie en anglais qui te sont donnés sont des pistes à vérifier, \
pas des textes à reprendre : tu ne les traduis pas et tu ne les recopies pas.
9. Des constats, pas des félicitations. Pas d'emoji, pas de dragon, pas de formule \
d'encouragement.

Tu réponds par le seul objet JSON demandé, sans commentaire."""


def invite(contexte: Contexte, *, refus: Sequence[str] = ()) -> Invite:
    """Construit l'invite d'une fiche, éventuellement après un refus.

    `refus` porte les motifs de rejet de l'essai précédent, nommément, pour la relance.
    """
    lignes = [
        f"Caractère : {contexte.c}",
        f"Pinyin : {', '.join(contexte.pinyin) if contexte.pinyin else 'inconnu'}",
        f"Parcours {contexte.parcours}, jour {contexte.jour}. Famille : {contexte.famille}.",
        "",
        f"Décomposition canonique GF 0014-2009 : {contexte.structure}"
        + ("" if contexte.reconcilie else " (décomposition non réconciliée, à traiter avec prudence)"),
        "Composants, dans l'ordre d'écriture :",
    ]
    for element in contexte.elements:
        nom = f" « {element.nom} »" if element.nom else " (hors table de la norme)"
        role = (
            f" — rôle probable : {element.role_probable} (donnée de Make Me a Hanzi, à vérifier)"
            if element.role_probable
            else ""
        )
        lignes.append(f"- {element.forme}{nom}{role}")
    if contexte.type_etymologie:
        lignes.append(
            f"Type d'étymologie relevé par Make Me a Hanzi : {contexte.type_etymologie} "
            "(donnée de source, à vérifier)."
        )
    if contexte.indice_en:
        lignes.append(f"{MARQUE_INDICE} : « {contexte.indice_en} »")
    lignes += [
        "",
        f"Mots candidats ({len(contexte.candidats)}) — le mot et son pinyin, rien d'autre. "
        f"Choisis-en au plus {min(MOTS_PAR_FICHE, len(contexte.candidats))} :",
    ]
    lignes += [f"- {m.hanzi} ({m.pinyin})" for m in contexte.candidats] or ["- aucun"]
    lignes += [
        "",
        f"Les {len(contexte.acquis)} caractères acquis ce jour-là, seuls autorisés dans la phrase :",
        "".join(contexte.acquis),
    ]
    if refus:
        lignes += [
            "",
            "L'essai précédent a été refusé :",
            *(f"- {motif}" for motif in refus),
            "Reprends la fiche en corrigeant cela, sans rien changer d'autre à la consigne.",
        ]
    return Invite(systeme=SYSTEME, utilisateur="\n".join(lignes))


# --------------------------------------------------------------------------- fiche


@dataclass(frozen=True)
class Mot:
    hanzi: str
    pinyin: str
    fr: str
    en: str


@dataclass(frozen=True)
class Phrase:
    zh: str
    pinyin: str
    fr: str
    en: str


@dataclass(frozen=True)
class Generation:
    """Traçabilité d'une fiche : d'où elle vient et comment."""

    modele: str
    api: str
    date: str
    empreinte_invite: str
    essais: int
    refus: list[str] = field(default_factory=list)


@dataclass
class Fiche:
    """Une fiche générée, avant relecture."""

    c: str
    parcours: str
    jour: int
    pinyin: tuple[str, ...]
    composants: tuple[str, ...]
    structure: str
    origine_fr: str
    origine_en: str
    etiquette: str
    roles: dict[str, str]
    mots: list[Mot]
    phrase: Phrase
    generation: Generation
    memo_fr: str | None = None
    memo_en: str | None = None
    #: Le sens, glose courte (`SENS_MAX`). Vide tant qu'il n'est pas écrit : une fiche
    #: relue sans sens est une faute de `wenlu check`, pas une fiche illisible.
    sens_fr: str = ""
    sens_en: str = ""
    statut: str = A_RELIRE

    def en_json(self) -> dict[str, object]:
        return {
            "c": self.c,
            "parcours": self.parcours,
            "jour": self.jour,
            "pinyin": list(self.pinyin),
            "sens_fr": self.sens_fr,
            "sens_en": self.sens_en,
            "composants": list(self.composants),
            "structure": self.structure,
            "origine_fr": self.origine_fr,
            "origine_en": self.origine_en,
            "etiquette": self.etiquette,
            "memo_fr": self.memo_fr,
            "memo_en": self.memo_en,
            "roles": self.roles,
            "mots": [{"hanzi": m.hanzi, "pinyin": m.pinyin, "fr": m.fr, "en": m.en} for m in self.mots],
            "phrase": {
                "zh": self.phrase.zh,
                "pinyin": self.phrase.pinyin,
                "fr": self.phrase.fr,
                "en": self.phrase.en,
            },
            "generation": {
                "modele": self.generation.modele,
                "api": self.generation.api,
                "date": self.generation.date,
                "empreinte_invite": self.generation.empreinte_invite,
                "essais": self.generation.essais,
                "refus": self.generation.refus,
            },
            "statut": self.statut,
        }


def _texte_ou_none(valeur: object) -> str | None:
    if valeur is None:
        return None
    if not isinstance(valeur, str):
        raise ReponseInvalide("champ facultatif hors schéma")
    return valeur.strip() or None


def _sens(valeur: object) -> str:
    """Un sens lu d'un JSON : absent ou nul, il est vide. Un non-texte est hors schéma."""
    if valeur is None:
        return ""
    if not isinstance(valeur, str):
        raise ReponseInvalide("sens hors schéma : attendu un texte")
    return valeur.strip()


def lire_reponse(
    texte: str,
    *,
    contexte: Contexte,
    generation: Generation,
    statut: str = A_RELIRE,
) -> Fiche:
    """Lit la réponse JSON du modèle et en fait une `Fiche`."""
    try:
        brut = json.loads(_sans_cloture(texte))
    except json.JSONDecodeError as erreur:
        raise ReponseInvalide(f"{contexte.c} : réponse non JSON") from erreur
    if not isinstance(brut, dict):
        raise ReponseInvalide(f"{contexte.c} : réponse hors schéma")
    for cle in ("origine_fr", "origine_en", "etiquette"):
        if not isinstance(brut.get(cle), str):
            raise ReponseInvalide(f"{contexte.c} : {cle} manquant")
    roles_bruts = brut.get("roles")
    mots_bruts = brut.get("mots")
    phrase_brute = brut.get("phrase")
    if not isinstance(roles_bruts, list) or not isinstance(mots_bruts, list):
        raise ReponseInvalide(f"{contexte.c} : roles ou mots hors schéma")
    if not isinstance(phrase_brute, dict) or not all(
        isinstance(phrase_brute.get(k), str) for k in ("zh", "pinyin", "fr", "en")
    ):
        raise ReponseInvalide(f"{contexte.c} : phrase hors schéma")
    roles: dict[str, str] = {}
    for element in roles_bruts:
        if not isinstance(element, dict) or not all(isinstance(element.get(k), str) for k in ("c", "role")):
            raise ReponseInvalide(f"{contexte.c} : rôle hors schéma")
        roles[element["c"]] = element["role"]
    mots: list[Mot] = []
    for element in mots_bruts:
        if not isinstance(element, dict) or not all(
            isinstance(element.get(k), str) for k in ("hanzi", "pinyin", "fr", "en")
        ):
            raise ReponseInvalide(f"{contexte.c} : mot hors schéma")
        mots.append(Mot(hanzi=element["hanzi"], pinyin=element["pinyin"], fr=element["fr"], en=element["en"]))
    return Fiche(
        c=contexte.c,
        parcours=contexte.parcours,
        jour=contexte.jour,
        pinyin=contexte.pinyin,
        composants=contexte.formes,
        structure=contexte.structure,
        origine_fr=brut["origine_fr"].strip(),
        origine_en=brut["origine_en"].strip(),
        etiquette=brut["etiquette"],
        memo_fr=_texte_ou_none(brut.get("memo_fr")),
        memo_en=_texte_ou_none(brut.get("memo_en")),
        sens_fr=_sens(brut.get("sens_fr")),
        sens_en=_sens(brut.get("sens_en")),
        roles=roles,
        mots=mots,
        phrase=Phrase(
            zh=phrase_brute["zh"],
            pinyin=phrase_brute["pinyin"],
            fr=phrase_brute["fr"],
            en=phrase_brute["en"],
        ),
        generation=generation,
        statut=statut,
    )


def fiche_depuis_json(document: Mapping[str, object]) -> Fiche:
    """Relit une fiche écrite dans `data/sources/fiches/`."""
    generation = document.get("generation") or {}
    phrase = document.get("phrase") or {}
    if not isinstance(generation, dict) or not isinstance(phrase, dict):
        raise ReponseInvalide("fiche illisible : generation ou phrase hors format")
    mots = document.get("mots")
    roles = document.get("roles")
    if not isinstance(mots, list) or not isinstance(roles, dict):
        raise ReponseInvalide("fiche illisible : mots ou roles hors format")
    return Fiche(
        c=str(document.get("c", "")),
        parcours=str(document.get("parcours", "")),
        jour=int(document.get("jour", 0)),
        pinyin=tuple(str(p) for p in (document.get("pinyin") or ())),
        composants=tuple(str(x) for x in (document.get("composants") or ())),
        structure=str(document.get("structure", "")),
        origine_fr=str(document.get("origine_fr", "")),
        origine_en=str(document.get("origine_en", "")),
        etiquette=str(document.get("etiquette", "")),
        memo_fr=_texte_ou_none(document.get("memo_fr")),
        memo_en=_texte_ou_none(document.get("memo_en")),
        sens_fr=_sens(document.get("sens_fr")),
        sens_en=_sens(document.get("sens_en")),
        roles={str(c): str(r) for c, r in roles.items()},
        mots=[Mot(hanzi=m["hanzi"], pinyin=m["pinyin"], fr=m["fr"], en=m["en"]) for m in mots],
        phrase=Phrase(
            zh=str(phrase.get("zh", "")),
            pinyin=str(phrase.get("pinyin", "")),
            fr=str(phrase.get("fr", "")),
            en=str(phrase.get("en", "")),
        ),
        generation=Generation(
            modele=str(generation.get("modele", "")),
            api=str(generation.get("api", "")),
            date=str(generation.get("date", "")),
            empreinte_invite=str(generation.get("empreinte_invite", "")),
            essais=int(generation.get("essais", 0)),
            refus=list(generation.get("refus") or []),
        ),
        statut=str(document.get("statut", A_RELIRE)),
    )


# --------------------------------------------------------------------------- validation


def compter_phrases(texte: str) -> int:
    """Nombre de phrases d'un texte : une par point final, plus la queue non ponctuée.

    Les suites de signes (« ?! », « … ») comptent pour une fin. Un texte qui ne se
    termine pas par un point final compte une phrase de plus : la dernière est
    inachevée, et c'est justement ce qu'il faut refuser.
    """
    net = texte.strip()
    if not net:
        return 0
    phrases = 0
    precedent_final = False
    for c in net:
        final = c in FINS_DE_PHRASE
        if final and not precedent_final:
            phrases += 1
        precedent_final = final
    if not precedent_final:
        phrases += 1
    return phrases


def caracteres_hors_acquis(texte: str, acquis: Iterable[str]) -> list[str]:
    """Caractères du texte absents de l'acquis, sans doublon, dans l'ordre d'apparition."""
    permis = set(acquis) | PONCTUATION
    vus: set[str] = set()
    intrus: list[str] = []
    for c in texte:
        if c in permis or c in vus:
            continue
        vus.add(c)
        intrus.append(c)
    return intrus


def fautes_de_sens(fiche: Fiche) -> list[str]:
    """Ce qui ne va pas dans un sens écrit : trop long, ou fini par un point.

    Un sens vide n'est pas une faute ici (voir `sens_absents`) : un brouillon peut ne
    pas l'avoir encore ; une fiche relue, non (`controles`).
    """
    fautes: list[str] = []
    for nom, texte in (("sens_fr", fiche.sens_fr), ("sens_en", fiche.sens_en)):
        if not texte:
            continue
        if len(texte) > SENS_MAX:
            fautes.append(f"{nom} fait {len(texte)} caractères, {SENS_MAX} au plus")
        if texte[-1] in POINTS_FINAUX_SENS:
            fautes.append(f"{nom} finit par un point")
    return fautes


def sens_absents(fiche: Fiche) -> list[str]:
    """Les champs de sens encore vides, nommés : `["sens_fr", "sens_en"]` au pire."""
    return [nom for nom, texte in (("sens_fr", fiche.sens_fr), ("sens_en", fiche.sens_en)) if not texte]


@dataclass(frozen=True)
class Rapport:
    """Résultat d'une validation. `refus` non vide vaut rejet."""

    refus: list[str] = field(default_factory=list)
    intrus: list[str] = field(default_factory=list)
    mots_hors_candidats: list[str] = field(default_factory=list)
    ecarts: list[str] = field(default_factory=list)

    @property
    def conforme(self) -> bool:
        return not self.refus


def valider(fiche: Fiche, contexte: Contexte) -> Rapport:
    """Contrôle strict : trois phrases, étiquette, sens court, mots candidats, phrase sans intrus.

    Les autres défauts (sens absent, rôle manquant, traduction vide, moins de deux mots) sont
    des écarts signalés à la relecture, pas des rejets. Une fiche peut prendre
    moins de mots qu'il n'y a de candidats : un mot rare ou douteux ne s'impose
    jamais faute de mieux ; le manque se voit à la relecture.
    """
    refus: list[str] = []
    ecarts: list[str] = []

    for nom, texte in (("origine_fr", fiche.origine_fr), ("origine_en", fiche.origine_en)):
        compte = compter_phrases(texte)
        if compte != PHRASES_ORIGINE:
            refus.append(f"{nom} fait {compte} phrase(s) au lieu de {PHRASES_ORIGINE}")

    if fiche.etiquette not in ETIQUETTES:
        refus.append(f"étiquette {fiche.etiquette!r} : attendu {' ou '.join(ETIQUETTES)}")

    refus.extend(fautes_de_sens(fiche))
    absents = sens_absents(fiche)
    if absents:
        ecarts.append(f"sens absent : {', '.join(absents)}")

    candidats = {m.hanzi for m in contexte.candidats}
    hors = [m.hanzi for m in fiche.mots if m.hanzi not in candidats]
    if hors:
        refus.append(f"mots hors des candidats : {' '.join(hors)}")
    if len(fiche.mots) > MOTS_PAR_FICHE:
        refus.append(f"{len(fiche.mots)} mots au lieu de {MOTS_PAR_FICHE} au plus")
    if len(contexte.candidats) < MOTS_PAR_FICHE:
        ecarts.append(
            f"{len(contexte.candidats)} mot candidat lisible au jour {contexte.jour} "
            f"au lieu de {MOTS_PAR_FICHE}"
        )
    elif len(fiche.mots) < MOTS_PAR_FICHE:
        ecarts.append(
            f"{len(fiche.mots)} mot(s) au lieu de {MOTS_PAR_FICHE}, pour "
            f"{len(contexte.candidats)} candidats lisibles au jour {contexte.jour}"
        )
    if len({m.hanzi for m in fiche.mots}) != len(fiche.mots):
        refus.append("deux fois le même mot")

    intrus = caracteres_hors_acquis(fiche.phrase.zh, contexte.acquis)
    if intrus:
        refus.append(f"phrase hors de l'acquis : {' '.join(intrus)}")
    if not any(est_sinogramme(c) for c in fiche.phrase.zh):
        refus.append("phrase vide")

    manquants = [f for f in contexte.formes if f not in fiche.roles]
    if manquants:
        ecarts.append(f"rôle absent pour {' '.join(manquants)}")
    superflus = [f for f in fiche.roles if f not in set(contexte.formes)]
    if superflus:
        ecarts.append(f"rôle sur des composants hors décomposition : {' '.join(superflus)}")
    inconnus = sorted({r for r in fiche.roles.values() if r not in ROLES})
    if inconnus:
        ecarts.append(f"rôles inconnus : {' '.join(inconnus)}")
    if contexte.c not in fiche.phrase.zh:
        ecarts.append("la phrase n'emploie pas le caractère du jour")
    vides = [
        nom
        for nom, valeur in (("phrase.fr", fiche.phrase.fr), ("phrase.en", fiche.phrase.en))
        if not valeur.strip()
    ]
    vides += [f"mot {m.hanzi}" for m in fiche.mots if not m.fr.strip() or not m.en.strip()]
    if vides:
        ecarts.append(f"traduction vide : {', '.join(vides)}")

    return Rapport(refus=refus, intrus=intrus, mots_hors_candidats=hors, ecarts=ecarts)


# --------------------------------------------------------------------------- client


class ClientAnthropic(claude.ClientAnthropic):
    """Messages API pour l'unitaire, Message Batches pour les lots. Même invite.

    Le client commun de `claude.py`, avec le schéma de réponse des fiches.
    """

    SCHEMA = SCHEMA


def client_anthropic(modele: str = MODELE, max_tokens: int = MAX_TOKENS) -> ClientClaude:
    """Client réel (SDK `anthropic`). Refuse de partir sans clé d'API."""
    return claude.client_anthropic(ClientAnthropic, modele, max_tokens)


# --------------------------------------------------------------------------- écriture


def chemin_fiche(c: str, dossier: Path | None = None) -> Path:
    return (dossier or FICHES_WORK) / f"{c}.json"


def ecrire_fiche(fiche: Fiche, dossier: Path | None = None) -> Path:
    chemin = chemin_fiche(fiche.c, dossier)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(fiche.en_json(), ensure_ascii=False, indent=1), encoding="utf-8")
    return chemin


def lire_fiche(chemin: Path) -> Fiche:
    return fiche_depuis_json(json.loads(chemin.read_text(encoding="utf-8")))


def fiches_ecrites(dossier: Path | None = None) -> list[Path]:
    """Toutes les fiches écrites, dans l'ordre des noms de fichier."""
    dossier = dossier or FICHES_WORK
    if not dossier.exists():
        return []
    return sorted(f for f in dossier.glob("*.json"))


def relire(c: str, statut: str, dossier: Path | None = None) -> Fiche:
    """Marque la relecture humaine d'une fiche. Le pipeline n'y touche pas."""
    if statut not in STATUTS:
        raise ValueError(f"statut {statut!r} inconnu : {', '.join(STATUTS)}")
    chemin = chemin_fiche(c, dossier)
    if not chemin.exists():
        raise FileNotFoundError(f"aucune fiche pour {c} ({chemin})")
    fiche = lire_fiche(chemin)
    absents = sens_absents(fiche)
    if statut == RELU and absents:
        raise ValueError(f"{c} : {', '.join(absents)} vide, à écrire avant de marquer la fiche relue")
    fiche.statut = statut
    ecrire_fiche(fiche, dossier)
    return fiche


# --------------------------------------------------------------------------- génération


def generer_fiche(
    contexte: Contexte,
    client: ClientClaude,
    *,
    essais_max: int = ESSAIS_MAX,
    horloge: Callable[[], str] = _maintenant,
) -> tuple[Fiche, Rapport]:
    """Génère une fiche en relançant sur les refus, au plus `essais_max` fois."""
    signales: list[str] = []
    fiche: Fiche | None = None
    rapport = Rapport()
    for essai in range(1, essais_max + 1):
        demande = invite(contexte, refus=signales)
        fiche = lire_reponse(
            client.generer(demande),
            contexte=contexte,
            generation=Generation(
                modele=client.modele,
                api=API_UNITAIRE,
                date=horloge(),
                empreinte_invite=demande.empreinte,
                essais=essai,
            ),
        )
        rapport = valider(fiche, contexte)
        fiche.generation = replace(fiche.generation, refus=rapport.refus)
        fiche.statut = A_RELIRE if rapport.conforme else REJETE
        if rapport.conforme:
            return fiche, rapport
        signales = rapport.refus
    assert fiche is not None  # essais_max >= 1
    return fiche, rapport


# --------------------------------------------------------------------------- lots


def dossier_lots(dossier: Path | None = None) -> Path:
    """Le journal des lots : `data/work/fiches/lots/`, ou `<dossier>/lots` s'il est donné.

    Les fiches sont versionnées, le journal ne l'est pas : c'est l'état d'un passage,
    que la CI garde en cache d'un passage à l'autre.
    """
    return dossier / "lots" if dossier is not None else LOTS_WORK


def custom_id(parcours: str, c: str, essai: int) -> str:
    return f"{parcours}-{c}-{essai}"


def soumettre_lot(
    contextes: Sequence[Contexte],
    client: ClientClaude,
    *,
    essais: dict[str, int] | None = None,
    refus: dict[str, list[str]] | None = None,
    dossier: Path | None = None,
    horloge: Callable[[], str] = _maintenant,
) -> dict[str, object]:
    """Soumet toutes les fiches demandées en une fois et journalise le lot."""
    essais = essais or {}
    refus = refus or {}
    if not contextes:
        raise CaractereHorsParcours("aucun caractère à soumettre")
    requetes: list[RequeteLot] = []
    journal: list[dict[str, object]] = []
    for contexte in contextes:
        essai = essais.get(contexte.c, 1)
        demande = invite(contexte, refus=refus.get(contexte.c, []))
        identifiant = custom_id(contexte.parcours, contexte.c, essai)
        requetes.append(RequeteLot(custom_id=identifiant, invite=demande))
        journal.append(
            {
                "custom_id": identifiant,
                "c": contexte.c,
                "essai": essai,
                "empreinte_invite": demande.empreinte,
            }
        )
    identifiant_lot = client.soumettre(requetes)
    lot: dict[str, object] = {
        "lot": identifiant_lot,
        "parcours": contextes[0].parcours,
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
    corpus: Corpus,
    *,
    dossier: Path | None = None,
    relancer: bool = True,
    horloge: Callable[[], str] = _maintenant,
) -> list[str]:
    """Récupère un lot terminé : valide, écrit, et resoumet ce qui a été rejeté.

    Retourne le journal des lignes à afficher.
    """
    lot = json.loads(fichier.read_text(encoding="utf-8"))
    identifiant = str(lot["lot"])
    statut = client.statut_lot(identifiant)
    if statut != "ended":
        return [f"{identifiant} : {statut}, rien à récupérer."]

    par_id = {str(r["custom_id"]): r for r in lot["requetes"]}
    journal: list[str] = []
    a_relancer: list[Contexte] = []
    essais_suivants: dict[str, int] = {}
    refus_signales: dict[str, list[str]] = {}
    for resultat in client.resultats(identifiant):
        requete = par_id.get(resultat.custom_id)
        if requete is None:
            journal.append(f"{resultat.custom_id} : inconnu dans le lot, ignoré.")
            continue
        c = str(requete["c"])
        essai = int(requete["essai"])
        if resultat.erreur or resultat.texte is None:
            journal.append(f"{c} : échec du lot ({resultat.erreur}).")
            continue
        contexte = corpus.contexte(c)
        fiche = lire_reponse(
            resultat.texte,
            contexte=contexte,
            generation=Generation(
                modele=str(lot["modele"]),
                api=API_LOTS,
                date=horloge(),
                empreinte_invite=str(requete["empreinte_invite"]),
                essais=essai,
            ),
        )
        rapport = valider(fiche, contexte)
        fiche.generation = replace(fiche.generation, refus=rapport.refus)
        fiche.statut = A_RELIRE if rapport.conforme else REJETE
        ecrire_fiche(fiche, dossier)
        if rapport.conforme:
            journal.append(
                f"{c} : à relire"
                + (f" ; écarts : {' ; '.join(rapport.ecarts)}" if rapport.ecarts else ".")
            )
        else:
            journal.append(f"{c} : rejeté — {' ; '.join(rapport.refus)}")
            if essai < ESSAIS_MAX:
                a_relancer.append(contexte)
                essais_suivants[c] = essai + 1
                refus_signales[c] = rapport.refus

    claude.marquer_recupere(fichier, lot, horloge())

    if relancer and a_relancer:
        suivant = soumettre_lot(
            a_relancer,
            client,
            essais=essais_suivants,
            refus=refus_signales,
            dossier=dossier,
            horloge=horloge,
        )
        journal.append(f"relance de {len(a_relancer)} fiche(s) : lot {suivant['lot']}.")
    return journal


# --------------------------------------------------------------------------- rédaction sans API
#
# Une fiche peut aussi être rédigée à la main — par un agent Claude Code dans sa
# session, sans clé ni réseau — dans un brouillon versionné. `importer_brouillon()`
# la fait passer par le même contexte (`Corpus.contexte`) et le même `valider()` que
# les fiches générées, puis l'écrit au statut `a_relire` ou `rejete`, avec une
# traçabilité qui dit ce qu'elle est : une rédaction manuelle, pas un appel d'API.

#: Brouillons rédigés à la main, versionnés : un fichier `<c>.json` par caractère.
BROUILLONS = DATA / "sources" / "fiches-brouillons"

#: Traçabilité d'une fiche rédigée dans une session Claude Code, sans appel d'API.
API_SESSION = "session Claude Code (sans API)"
MODELE_MANUEL = "rédaction manuelle"

#: Fiches à relire, rassemblées pour une page de relecture. Hors dépôt.
RELECTURE = WORK / "relecture.json"

CHAMPS_OBLIGATOIRES = ("c", "origine_fr", "origine_en", "etiquette", "roles", "mots", "phrase")
CHAMPS_FACULTATIFS = ("memo_fr", "memo_en")
#: Le sens : un texte, facultatif dans un brouillon (vide s'il manque), exigé d'une
#: fiche relue (`relire`, `controles`).
CHAMPS_SENS = ("sens_fr", "sens_en")

#: Ce que le rédacteur écrit, accentué ou non, et le code que la fiche garde.
ETIQUETTES_REDIGEES = {
    "attesté": "atteste",
    "atteste": "atteste",
    "mnémotechnique": "mnemotechnique",
    "mnemotechnique": "mnemotechnique",
}

#: Les deux décisions de la relecture humaine.
DECISIONS = (RELU, REJETE)


class BrouillonInvalide(ValueError):
    """Le brouillon ne se lit pas comme une fiche : rien n'est écrit."""

    def __init__(self, c: str, problemes: Sequence[str]) -> None:
        self.c = c
        self.problemes = list(problemes)
        super().__init__(f"{c} : " + " ; ".join(self.problemes))


class RelectureInvalide(ValueError):
    """Le fichier de relecture ne s'applique pas : rien n'est changé."""

    def __init__(self, problemes: Sequence[str]) -> None:
        self.problemes = list(problemes)
        super().__init__(" ; ".join(self.problemes))


def _aujourdhui() -> str:
    return _maintenant()[:10]


@dataclass(frozen=True)
class Brouillon:
    """Une fiche rédigée à la main, telle que son rédacteur l'a écrite."""

    c: str
    empreinte: str
    origine_fr: str
    origine_en: str
    etiquette: str
    roles: dict[str, str]
    mots: list[Mot]
    phrase: Phrase
    memo_fr: str | None = None
    memo_en: str | None = None
    sens_fr: str = ""
    sens_en: str = ""


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


def brouillon_depuis_json(document: object, *, empreinte: str, nom: str | None = None) -> Brouillon:
    """Lit un brouillon déjà décodé. Relève tous les problèmes de format d'un coup.

    Le format seul est vérifié ici ; le fond (trois phrases, mots candidats, phrase
    dans l'acquis) l'est par `valider()`, comme pour une fiche générée.
    """
    c = nom or "?"
    if not isinstance(document, dict):
        raise BrouillonInvalide(c, ["attendu un objet JSON"])
    c = str(document.get("c") or c)
    problemes: list[str] = []
    manquants = [k for k in CHAMPS_OBLIGATOIRES if k not in document]
    if manquants:
        problemes.append(f"champ manquant : {', '.join(manquants)}")
    inconnus = [k for k in document if k not in CHAMPS_OBLIGATOIRES + CHAMPS_FACULTATIFS + CHAMPS_SENS]
    if inconnus:
        problemes.append(f"champ inconnu : {', '.join(inconnus)}")
    if nom is not None and "c" in document and document["c"] != nom:
        problemes.append(f"c vaut {document['c']!r} dans un fichier nommé {nom}.json")
    for cle in ("c", "origine_fr", "origine_en", "etiquette"):
        if cle in document and not isinstance(document[cle], str):
            problemes.append(f"{cle} : attendu un texte")
    for cle in CHAMPS_FACULTATIFS:
        if document.get(cle) is not None and not isinstance(document[cle], str):
            problemes.append(f"{cle} : attendu un texte ou null")
    for cle in CHAMPS_SENS:
        if cle in document and not isinstance(document[cle], str):
            problemes.append(f"{cle} : attendu un texte")

    roles: dict[str, str] = {}
    if "roles" in document:
        brut = document["roles"]
        if not isinstance(brut, dict) or not all(isinstance(r, str) for r in brut.values()):
            problemes.append('roles : attendu un objet {"composant": "son" | "sens" | "forme"}')
        else:
            roles = {str(k): str(v).strip() for k, v in brut.items()}

    mots: list[Mot] = []
    if "mots" in document:
        brut = document["mots"]
        if not isinstance(brut, list):
            problemes.append("mots : attendu une liste de deux objets {hanzi, pinyin, fr, en}")
        else:
            for rang, element in enumerate(brut, start=1):
                lu = _textes(element, ("hanzi", "pinyin", "fr", "en"), f"mot {rang}", problemes)
                if lu is not None:
                    mots.append(Mot(**lu))

    phrase: Phrase | None = None
    if "phrase" in document:
        lu = _textes(document["phrase"], ("zh", "pinyin", "fr", "en"), "phrase", problemes)
        if lu is not None:
            phrase = Phrase(**lu)

    if problemes or phrase is None:
        raise BrouillonInvalide(c, problemes or ["phrase illisible"])
    etiquette = str(document["etiquette"]).strip()
    return Brouillon(
        c=c,
        empreinte=empreinte,
        origine_fr=str(document["origine_fr"]).strip(),
        origine_en=str(document["origine_en"]).strip(),
        # Une étiquette inconnue passe telle quelle : `valider()` la refuse, nommément.
        etiquette=ETIQUETTES_REDIGEES.get(etiquette.lower(), etiquette),
        roles=roles,
        mots=mots,
        phrase=phrase,
        memo_fr=_texte_ou_none(document.get("memo_fr")),
        memo_en=_texte_ou_none(document.get("memo_en")),
        sens_fr=str(document.get("sens_fr") or "").strip(),
        sens_en=str(document.get("sens_en") or "").strip(),
    )


def lire_brouillon(chemin: Path) -> Brouillon:
    """Lit `data/sources/fiches-brouillons/<c>.json`."""
    octets = chemin.read_bytes()
    try:
        document = json.loads(octets.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as erreur:
        raise BrouillonInvalide(chemin.stem, [f"JSON illisible : {erreur}"]) from erreur
    return brouillon_depuis_json(document, empreinte=empreinte_brouillon(octets), nom=chemin.stem)


def brouillons_ecrits(dossier: Path | None = None) -> list[Path]:
    """Tous les brouillons, dans l'ordre des noms de fichier."""
    dossier = dossier or BROUILLONS
    if not dossier.exists():
        return []
    return sorted(dossier.glob("*.json"))


def fiche_depuis_brouillon(
    brouillon: Brouillon,
    contexte: Contexte,
    *,
    essais: int = 1,
    horloge: Callable[[], str] = _aujourdhui,
) -> Fiche:
    """La fiche d'un brouillon : le texte du rédacteur, les faits du contexte."""
    return Fiche(
        c=contexte.c,
        parcours=contexte.parcours,
        jour=contexte.jour,
        pinyin=contexte.pinyin,
        composants=contexte.formes,
        structure=contexte.structure,
        origine_fr=brouillon.origine_fr,
        origine_en=brouillon.origine_en,
        etiquette=brouillon.etiquette,
        memo_fr=brouillon.memo_fr,
        memo_en=brouillon.memo_en,
        sens_fr=brouillon.sens_fr,
        sens_en=brouillon.sens_en,
        roles=dict(brouillon.roles),
        mots=list(brouillon.mots),
        phrase=brouillon.phrase,
        generation=Generation(
            modele=MODELE_MANUEL,
            api=API_SESSION,
            date=horloge(),
            empreinte_invite=brouillon.empreinte,
            essais=essais,
        ),
    )


@dataclass(frozen=True)
class Import:
    """Ce qu'a donné l'import d'un brouillon."""

    fiche: Fiche
    rapport: Rapport
    chemin: Path
    #: Même brouillon, même verdict : la fiche écrite est gardée telle quelle,
    #: statut de relecture compris.
    inchange: bool = False
    #: Statut de la fiche remplacée, s'il y en avait une.
    remplace: str | None = None
    #: Même brouillon, mais le contexte a bougé (jour, pinyin, décomposition) :
    #: les faits de la fiche sont mis à jour, son texte et sa traçabilité restent.
    contexte_change: bool = False


def _faits(fiche: Fiche) -> tuple[object, ...]:
    """Ce que la fiche tient du contexte, et non du rédacteur."""
    return (fiche.parcours, fiche.jour, tuple(fiche.pinyin), tuple(fiche.composants), fiche.structure)


def importer_brouillon(
    brouillon: Brouillon,
    corpus: Corpus,
    *,
    dossier: Path | None = None,
    horloge: Callable[[], str] = _aujourdhui,
) -> Import:
    """Contexte, fiche, `valider()`, écriture : les contrôles des fiches générées.

    Un brouillon inchangé ne réécrit rien : une fiche relue le reste. Un brouillon
    modifié repart au statut `a_relire`, sa relecture est à refaire.

    Un brouillon inchangé dont le contexte a bougé — le parcours l'a déplacé, une
    surcharge a corrigé son pinyin ou sa décomposition — met à jour les faits de la
    fiche (parcours, jour, pinyin, composants, structure) sans toucher à son texte
    ni à sa traçabilité. Le jour seul ne défait pas une relecture ; un pinyin ou une
    décomposition changés, si : ce que la relecture a validé n'est plus le même.
    """
    contexte = corpus.contexte(brouillon.c)
    chemin = chemin_fiche(brouillon.c, dossier)
    precedente = lire_fiche(chemin) if chemin.exists() else None
    manuelle = precedente is not None and precedente.generation.api == API_SESSION
    fiche = fiche_depuis_brouillon(
        brouillon,
        contexte,
        essais=precedente.generation.essais + 1 if manuelle and precedente else 1,
        horloge=horloge,
    )
    rapport = valider(fiche, contexte)
    if (
        manuelle
        and precedente is not None
        and precedente.generation.empreinte_invite == brouillon.empreinte
        and precedente.generation.refus == rapport.refus
    ):
        if _faits(precedente) == _faits(fiche):
            return Import(fiche=precedente, rapport=rapport, chemin=chemin, inchange=True)
        seul_le_jour = _faits(precedente)[2:] == _faits(fiche)[2:]
        a_jour = replace(
            precedente,
            parcours=fiche.parcours,
            jour=fiche.jour,
            pinyin=fiche.pinyin,
            composants=fiche.composants,
            structure=fiche.structure,
            statut=precedente.statut
            if seul_le_jour or precedente.statut != RELU
            else A_RELIRE,
        )
        ecrire_fiche(a_jour, dossier)
        return Import(
            fiche=a_jour,
            rapport=rapport,
            chemin=chemin,
            inchange=True,
            contexte_change=True,
        )
    fiche.generation = replace(fiche.generation, refus=rapport.refus)
    fiche.statut = A_RELIRE if rapport.conforme else REJETE
    ecrire_fiche(fiche, dossier)
    return Import(
        fiche=fiche,
        rapport=rapport,
        chemin=chemin,
        remplace=precedente.statut if precedente is not None else None,
    )


CONTRAINTES = f"""Contraintes, vérifiées par `wenlu fiches importer` comme pour une fiche générée.
Rejet :
- origine_fr et origine_en : exactement {PHRASES_ORIGINE} phrases chacune (fins de phrase \
comptées : {' '.join(FINS_DE_PHRASE)}) ; l'anglaise est rédigée pour un anglophone, pas \
traduite mot à mot.
- etiquette : « attesté » seulement si le Shuowen jiezi ou la paléographie (os oraculaires, \
bronzes, petit sceau) établissent l'origine ; « mnémotechnique » dans tous les autres cas, \
et dans le doute. Sous « mnémotechnique », décrire ce que l'on voit dans la forme actuelle, \
jamais prétendre dire ce que le caractère a voulu dire autrefois.
- mots : au plus {MOTS_PAR_FICHE}, pris dans les mots candidats, écrits à l'identique, \
sans doublon ; pinyin avec les tons du dictionnaire (sans sandhi : yī, bù), d'un seul \
tenant, ton neutre comme CC-CEDICT ; traductions fr et en rédigées soi-même, jamais \
reprises d'un dictionnaire.
- phrase.zh : les seuls caractères acquis ce jour-là, et la ponctuation \
{PONCTUATION_CHINOISE} ; ni chiffre ni lettre.
Écarts, signalés à la relecture :
- moins de {MOTS_PAR_FICHE} mots : un candidat rare, d'argot ou douteux ne se prend pas \
faute de mieux ;
- un rôle ({', '.join(ROLES)}) pour chaque composant de la décomposition, et pour eux seuls ;
- la phrase emploie le caractère du jour ;
- traductions fr et en non vides.
memo_fr et memo_en sont facultatifs (null) : une phrase courte, quand elle ajoute à \
l'origine. Des constats, pas des félicitations ; ni emoji ni dragon."""


def squelette(contexte: Contexte) -> dict[str, object]:
    """Un brouillon vide pour ce caractère : les rôles pré-remplis du rôle probable."""
    vide_mot = {"hanzi": "", "pinyin": "", "fr": "", "en": ""}
    return {
        "c": contexte.c,
        "origine_fr": "",
        "origine_en": "",
        "etiquette": "",
        "memo_fr": None,
        "memo_en": None,
        "roles": {e.forme: e.role_probable or "" for e in contexte.elements},
        "mots": [dict(vide_mot) for _ in range(min(MOTS_PAR_FICHE, len(contexte.candidats)))],
        "phrase": {"zh": "", "pinyin": "", "fr": "", "en": ""},
    }


def decrire_contexte(contexte: Contexte, *, brouillons: Path | None = None) -> list[str]:
    """Ce qu'un rédacteur doit savoir d'un caractère, en lignes à afficher.

    Les mêmes faits que l'invite des fiches générées. Des mots candidats, le mot et
    son pinyin seulement : aucune définition de CC-CEDICT (`docs/sources-licences.md` §4.2).
    """
    lignes = [
        f"== {contexte.c} ({', '.join(contexte.pinyin) or 'pinyin inconnu'}) — parcours "
        f"{contexte.parcours}, jour {contexte.jour}, famille {contexte.famille} ==",
        f"Décomposition GF 0014-2009 : {contexte.structure}"
        + ("" if contexte.reconcilie else " (non réconciliée, à traiter avec prudence)"),
        "Composants, dans l'ordre d'écriture :",
    ]
    for element in contexte.elements:
        nom = f" « {element.nom} »" if element.nom else " (hors table de la norme)"
        role = (
            f" — rôle probable : {element.role_probable} (Make Me a Hanzi, à vérifier)"
            if element.role_probable
            else ""
        )
        lignes.append(f"- {element.forme}{nom}{role}")
    if contexte.type_etymologie:
        lignes.append(
            f"Type d'étymologie relevé par Make Me a Hanzi : {contexte.type_etymologie} (à vérifier)."
        )
    if contexte.indice_en:
        lignes.append(f"{MARQUE_INDICE} : « {contexte.indice_en} »")
    lignes += [
        "",
        f"Caractères acquis au jour {contexte.jour} ({len(contexte.acquis)}), "
        "seuls autorisés dans les mots et la phrase :",
        "".join(contexte.acquis),
        "",
        f"Mots candidats ({len(contexte.candidats)}), déjà lisibles ce jour-là — "
        f"en choisir au plus {min(MOTS_PAR_FICHE, len(contexte.candidats))} :",
    ]
    lignes += [f"- {m.hanzi} ({m.pinyin})" for m in contexte.candidats] or ["- aucun"]
    chemin = (brouillons or BROUILLONS) / f"{contexte.c}.json"
    lignes += [
        "",
        f"Brouillon à écrire : {_relatif(chemin)}",
        json.dumps(squelette(contexte), ensure_ascii=False, indent=1),
    ]
    return lignes


def a_rediger(
    seuil: int,
    corpus: Corpus,
    *,
    lot: int = 1,
    sur: int = 1,
    dossier: Path | None = None,
    listes: Path | None = None,
) -> list[str]:
    """Caractères du seuil sans fiche conforme, dans l'ordre du parcours, lot `lot` sur `sur`.

    Les lots découpent le seuil entier, pas ce qui reste : un caractère garde son lot
    quand les autres avancent, et des rédacteurs en parallèle ne se marchent pas dessus.
    Une fiche manque, est rejetée (aux contrôles ou à la relecture), ou ne passe plus
    `valider()` : le caractère est à rédiger.
    """
    if sur < 1 or not 1 <= lot <= sur:
        raise ValueError(f"lot {lot} sur {sur} : attendu 1 ≤ lot ≤ sur")
    liste = charger_liste((listes or LISTES) / f"seuil-{seuil}.txt")
    rang = {c: i for i, c in enumerate(corpus.ordre)}
    ordonnee = sorted(liste, key=lambda c: (rang.get(c, len(rang)), liste.index(c)))
    taille, reste = divmod(len(ordonnee), sur)
    debut = (lot - 1) * taille + min(lot - 1, reste)
    part = ordonnee[debut : debut + taille + (1 if lot - 1 < reste else 0)]
    return [c for c in part if not _fiche_conforme(c, corpus, dossier)]


def _fiche_conforme(c: str, corpus: Corpus, dossier: Path | None) -> bool:
    chemin = chemin_fiche(c, dossier)
    if not chemin.exists() or c not in corpus:
        return False
    fiche = lire_fiche(chemin)
    return fiche.statut != REJETE and valider(fiche, corpus.contexte(c)).conforme


def exporter_relecture(
    *,
    corpus: Corpus | None = None,
    dossier: Path | None = None,
    sortie: Path | None = None,
    horloge: Callable[[], str] = _maintenant,
) -> tuple[Path, int]:
    """Rassemble les fiches `a_relire` en un seul JSON, pour une page de relecture."""
    a_relire = sorted(
        (f for f in map(lire_fiche, fiches_ecrites(dossier)) if f.statut == A_RELIRE),
        key=lambda f: (f.jour, f.c),
    )
    entrees: list[dict[str, object]] = []
    for fiche in a_relire:
        entree = fiche.en_json()
        if corpus is not None and fiche.c in corpus:
            entree["ecarts"] = valider(fiche, corpus.contexte(fiche.c)).ecarts
        entrees.append(entree)
    document = {
        "date": horloge(),
        "source": _relatif(dossier or FICHES_WORK),
        "decisions": list(DECISIONS),
        "retour": '{"<caractère>": "relu" | "rejete", …}, appliqué par '
        "`wenlu fiches appliquer-relecture <fichier>`",
        "fiches": entrees,
    }
    sortie = sortie or RELECTURE
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")
    return sortie, len(entrees)


def appliquer_relecture(decisions: object, dossier: Path | None = None) -> list[Fiche]:
    """Applique `{c: "relu" | "rejete"}` par `relire()`. Tout ou rien.

    Une valeur `null` est une fiche pas encore décidée : elle est laissée telle quelle.
    Une fiche rejetée aux contrôles ne peut pas être relue : il faut corriger son
    brouillon et le réimporter.
    """
    if not isinstance(decisions, dict):
        raise RelectureInvalide(['attendu un objet JSON {"<caractère>": "relu" | "rejete"}'])
    problemes: list[str] = []
    retenues: list[tuple[str, str]] = []
    for c, statut in decisions.items():
        if statut is None:
            continue
        if statut not in DECISIONS:
            problemes.append(f"{c} : décision {statut!r}, attendu {' ou '.join(DECISIONS)}")
            continue
        chemin = chemin_fiche(str(c), dossier)
        if not chemin.exists():
            problemes.append(f"{c} : aucune fiche ({_relatif(chemin)})")
            continue
        fiche = lire_fiche(chemin)
        if statut == RELU and fiche.generation.refus:
            problemes.append(
                f"{c} : rejetée aux contrôles ({' ; '.join(fiche.generation.refus)}), "
                "à corriger avant relecture"
            )
            continue
        absents = sens_absents(fiche)
        if statut == RELU and absents:
            problemes.append(f"{c} : {', '.join(absents)} vide, à écrire avant relecture")
            continue
        retenues.append((str(c), str(statut)))
    if problemes:
        raise RelectureInvalide(problemes)
    return [relire(c, statut, dossier) for c, statut in retenues]


def _relatif(chemin: Path) -> str:
    try:
        return str(chemin.relative_to(RACINE))
    except ValueError:
        return str(chemin)


# --------------------------------------------------------------------------- check


def controles(
    dossier: Path | None = None,
    corpus: Corpus | None = None,
    listes: Path | None = None,
) -> list[Controle]:
    """Contrôles des fiches, appelés par `wenlu check`.

    « fiches invalides » est bloquant : une fiche hors cadre ne s'exporte pas.
    « relecture du seuil 255 » est signalé : la relecture est humaine (brief §17).
    « sens » est bloquant : une fiche relue porte son sens, en français et en anglais,
    et un sens écrit tient en `SENS_MAX` caractères, sans point final.
    """
    fichiers = fiches_ecrites(dossier)
    if not fichiers:
        return [Controle("fiches : validation", True, "aucune fiche générée")]

    if corpus is None:
        try:
            corpus = charger_corpus()
        except (CorpusAbsent, ParcoursInconnu):
            corpus = None

    fautifs: list[str] = []
    non_revalidees = 0
    fiches: list[Fiche] = []
    for chemin in fichiers:
        fiche = lire_fiche(chemin)
        fiches.append(fiche)
        if corpus is None or fiche.c not in corpus:
            non_revalidees += 1
            continue
        rapport = valider(fiche, corpus.contexte(fiche.c))
        if not rapport.conforme:
            fautifs.append(f"{fiche.c} : {' ; '.join(rapport.refus)}")

    sens = controle_sens(fiches)

    detail = f"{len(fichiers)} fiches contrôlées"
    if fautifs:
        detail = f"{len(fautifs)} fiches invalides — " + " ; ".join(fautifs[:5])
    elif non_revalidees:
        detail += f" ; {non_revalidees} hors parcours ou sans corpus, non revalidées"

    # Sans la liste du seuil, il n'y a rien à comparer : le dire, plutôt que de
    # rendre un contrôle vert sur un ensemble vide.
    chemin_seuil = (listes or LISTES) / f"seuil-{SEUIL_RELECTURE}.txt"
    try:
        seuil = set(charger_liste(chemin_seuil))
    except (OSError, ValueError) as erreur:  # absente, ou `ListeInvalide`
        return [
            Controle("fiches : validation", not fautifs, detail, bloquant=True),
            Controle(
                f"fiches : relecture du seuil {SEUIL_RELECTURE}",
                False,
                f"liste du seuil illisible ({chemin_seuil}) : relecture non contrôlée — {erreur}",
            ),
            sens,
        ]
    du_seuil = [f for f in fiches if f.c in seuil]
    a_relire = [f.c for f in du_seuil if f.statut != RELU]
    sans_fiche = len(seuil) - len(du_seuil)
    detail_relecture = (
        f"{len(a_relire)} fiches sur {len(du_seuil)} du seuil {SEUIL_RELECTURE} restent à relire"
        f" avant export ; {sans_fiche} caractères du seuil sans fiche"
    )

    return [
        Controle("fiches : validation", not fautifs, detail, bloquant=True),
        Controle(
            f"fiches : relecture du seuil {SEUIL_RELECTURE}",
            not a_relire and not sans_fiche,
            detail_relecture,
        ),
        sens,
    ]


def controle_sens(fiches: Sequence[Fiche]) -> Controle:
    """« fiches : sens », bloquant : une fiche relue a son sens, et un sens écrit est court.

    Relu sans les fiches du corpus : le sens ne dépend pas du contexte d'un caractère.
    """
    sans_sens = [f"{f.c} ({', '.join(sens_absents(f))})" for f in fiches if f.statut == RELU and sens_absents(f)]
    fautes = [f"{f.c} : {' ; '.join(fautes_de_sens(f))}" for f in fiches if fautes_de_sens(f)]
    if not sans_sens and not fautes:
        return Controle("fiches : sens", True, f"{len(fiches)} fiches, chaque fiche relue a son sens", bloquant=True)
    parties: list[str] = []
    if sans_sens:
        parties.append(f"{len(sans_sens)} fiches relues sans sens — " + " ; ".join(sans_sens[:5]))
    if fautes:
        parties.append(f"{len(fautes)} sens hors format — " + " ; ".join(fautes[:5]))
    return Controle("fiches : sens", False, " ; ".join(parties), bloquant=True)


# --------------------------------------------------------------------------- cli

app = typer.Typer(
    help="Fiches FR et EN : génération par lots ou rédaction sans API, validation, relecture."
)


def _client(modele: str) -> ClientClaude:
    return claude.client_ou_sortie(lambda: client_anthropic(modele))


def _corpus(parcours: str) -> Corpus:
    try:
        return charger_corpus(parcours)
    except (CorpusAbsent, ParcoursInconnu) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


@app.command("generer")
def commande_generer(
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
    c: Optional[str] = typer.Option(None, "--c", help="Un seul caractère, en mode unitaire."),
    jusqua: Optional[int] = typer.Option(
        None, "--jusqua", help="N premiers caractères du parcours (défaut : tous)."
    ),
    modele: str = typer.Option(MODELE, "--modele", help="Modèle Claude."),
) -> None:
    """Génère les fiches d'un parcours : par lots, ou une seule fiche en unitaire."""
    corpus = _corpus(parcours)
    if c is not None:
        try:
            contexte = corpus.contexte(c)
        except CaractereHorsParcours as erreur:
            typer.echo(str(erreur), err=True)
            raise typer.Exit(code=1) from erreur
        client = _client(modele)
        fiche, rapport = generer_fiche(contexte, client)
        chemin = ecrire_fiche(fiche)
        typer.echo(f"{c} : {fiche.statut}, {fiche.generation.essais} essai(s) → {chemin}")
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
        if not rapport.conforme:
            typer.echo(f"Refusée : {' ; '.join(rapport.refus)}", err=True)
            raise typer.Exit(code=1)
        return

    caracteres = corpus.ordre[: jusqua] if jusqua else corpus.ordre
    client = _client(modele)
    lot = soumettre_lot([corpus.contexte(x) for x in caracteres], client)
    typer.echo(f"Lot {lot['lot']} soumis : {len(caracteres)} fiches du parcours {parcours}.")
    typer.echo("Récupération : `wenlu fiches recuperer` (les lots aboutissent sous 24 h).")


@app.command("recuperer")
def commande_recuperer(
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
    modele: str = typer.Option(MODELE, "--modele", help="Modèle Claude."),
    relancer: bool = typer.Option(True, "--relancer/--sans-relance", help="Resoumettre les rejets."),
) -> None:
    """Récupère les lots soumis, valide, écrit les fiches et relance les rejets."""
    fichiers = lots_en_cours()
    if not fichiers:
        typer.echo("Aucun lot en cours.")
        return
    corpus = _corpus(parcours)
    client = _client(modele)
    for fichier in fichiers:
        for ligne in recuperer_lot(fichier, client, corpus, relancer=relancer):
            typer.echo(ligne)
    typer.echo(f"Fiches dans {FICHES_WORK}.")


@app.command("valider")
def commande_valider(
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
) -> None:
    """Revalide les fiches déjà écrites contre le contexte de leur caractère."""
    fichiers = fiches_ecrites()
    if not fichiers:
        typer.echo("Aucune fiche à valider.")
        return
    corpus = _corpus(parcours)
    invalides = 0
    for chemin in fichiers:
        fiche = lire_fiche(chemin)
        if fiche.c not in corpus:
            typer.echo(f"hors  {fiche.c} [{fiche.statut}] : hors du parcours {parcours}")
            continue
        rapport = valider(fiche, corpus.contexte(fiche.c))
        typer.echo(f"{'ok   ' if rapport.conforme else 'rejet'} {fiche.c} [{fiche.statut}]")
        if not rapport.conforme:
            invalides += 1
            for motif in rapport.refus:
                typer.echo(f"  refus : {motif}")
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
    if invalides:
        typer.echo(f"{invalides} fiches invalides.", err=True)
        raise typer.Exit(code=1)


@app.command("relire")
def commande_relire(
    c: str = typer.Option(..., "--c", help="Le caractère de la fiche relue."),
    statut: str = typer.Option(RELU, "--statut", help=f"{', '.join(STATUTS)}."),
) -> None:
    """Marque la relecture humaine d'une fiche : `--statut relu` la rend exportable."""
    try:
        fiche = relire(c, statut)
    except (ValueError, FileNotFoundError) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    typer.echo(f"{fiche.c} : statut {fiche.statut}.")


# --------------------------------------------------------------------------- cli : rédaction sans API


@app.command("importer")
def commande_importer(
    caracteres: Optional[list[str]] = typer.Argument(
        None, help="Les caractères à importer (défaut : tous les brouillons)."
    ),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
) -> None:
    """Importe les brouillons rédigés sans API : mêmes contrôles que les fiches générées."""
    chemins = brouillons_ecrits()
    absents: list[str] = []
    if caracteres:
        voulus = {c for arg in caracteres for c in arg}
        chemins = [p for p in chemins if p.stem in voulus]
        absents = sorted(voulus - {p.stem for p in chemins})
        for c in absents:
            typer.echo(f"erreur {c} : aucun brouillon {_relatif(BROUILLONS / f'{c}.json')}")
    if not chemins:
        typer.echo(f"Aucun brouillon à importer dans {_relatif(BROUILLONS)}.")
        if absents:
            raise typer.Exit(code=1)
        return
    corpus = _corpus(parcours)
    rejetes = 0
    erreurs = len(absents)
    conformes = 0
    for chemin in chemins:
        try:
            resultat = importer_brouillon(lire_brouillon(chemin), corpus)
        except BrouillonInvalide as erreur:
            erreurs += 1
            typer.echo(f"erreur {erreur.c} : brouillon illisible, rien n'est écrit")
            for probleme in erreur.problemes:
                typer.echo(f"  format : {probleme}")
            continue
        except CaractereHorsParcours as erreur:
            erreurs += 1
            typer.echo(f"erreur {chemin.stem} : {erreur.args[0]}, rien n'est écrit")
            continue
        fiche, rapport = resultat.fiche, resultat.rapport
        if resultat.contexte_change:
            etat = f"contexte mis à jour, statut {fiche.statut}"
        elif resultat.inchange:
            etat = f"inchangée, statut {fiche.statut}"
        elif rapport.conforme:
            etat = "à relire"
        else:
            etat = "rejetée"
        remplace = f", remplace une fiche {resultat.remplace}" if resultat.remplace else ""
        typer.echo(
            f"{'ok   ' if rapport.conforme else 'rejet'} {fiche.c} : {etat}, "
            f"jour {fiche.jour} → {_relatif(resultat.chemin)}{remplace}"
        )
        for motif in rapport.refus:
            typer.echo(f"  refus : {motif}")
        if rapport.intrus:
            typer.echo(
                f"  acquis au jour {fiche.jour} : {''.join(corpus.acquis(fiche.c))} "
                f"(voir `wenlu fiches contexte {fiche.c}`)"
            )
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
        if rapport.conforme:
            conformes += 1
        else:
            rejetes += 1
    typer.echo(f"{conformes} conformes, {rejetes} rejetées, {erreurs} en erreur.")
    if rejetes or erreurs:
        typer.echo("Corriger les brouillons signalés, puis relancer l'import.", err=True)
        raise typer.Exit(code=1)


@app.command("contexte")
def commande_contexte(
    caracteres: list[str] = typer.Argument(..., help="Un ou plusieurs caractères : 人 大 天, ou 人大天."),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
) -> None:
    """Ce qu'un rédacteur doit savoir d'un caractère avant d'écrire son brouillon."""
    corpus = _corpus(parcours)
    voulus: list[str] = []
    for arg in caracteres:
        voulus.extend([arg] if arg in corpus or len(arg) == 1 else list(arg))
    typer.echo(CONTRAINTES)
    hors = 0
    for c in dict.fromkeys(voulus):
        typer.echo("")
        try:
            contexte = corpus.contexte(c)
        except CaractereHorsParcours as erreur:
            hors += 1
            typer.echo(f"== {c} == {erreur.args[0]}")
            continue
        for ligne in decrire_contexte(contexte):
            typer.echo(ligne)
    if hors:
        raise typer.Exit(code=1)


@app.command("a-rediger")
def commande_a_rediger(
    seuil: int = typer.Option(SEUIL_RELECTURE, "--seuil", help="Liste `seuil-<N>.txt`."),
    lot: int = typer.Option(1, "--lot", help="Numéro du lot, de 1 à --sur."),
    sur: int = typer.Option(1, "--sur", help="Nombre de lots entre lesquels découper le seuil."),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
) -> None:
    """Liste les caractères du seuil sans fiche conforme, dans l'ordre du parcours."""
    corpus = _corpus(parcours)
    try:
        restants = a_rediger(seuil, corpus, lot=lot, sur=sur)
    except (OSError, ValueError) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    lot_dit = f", lot {lot} sur {sur}" if sur > 1 else ""
    typer.echo(f"Seuil {seuil}, parcours {parcours}{lot_dit} : {len(restants)} caractères à rédiger.")
    if restants:
        typer.echo(" ".join(restants))


@app.command("exporter-relecture")
def commande_exporter_relecture(
    sortie: Optional[Path] = typer.Option(
        None, "--sortie", help="Fichier JSON écrit (défaut : data/work/relecture.json)."
    ),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk, pour les écarts."),
) -> None:
    """Rassemble les fiches à relire en un seul JSON, pour une page de relecture."""
    try:
        corpus: Corpus | None = charger_corpus(parcours)
    except (CorpusAbsent, ParcoursInconnu):
        corpus = None
    chemin, nombre = exporter_relecture(corpus=corpus, sortie=sortie)
    typer.echo(f"{nombre} fiches à relire → {_relatif(chemin)}.")


@app.command("appliquer-relecture")
def commande_appliquer_relecture(
    fichier: Path = typer.Argument(..., help='JSON {"<caractère>": "relu" | "rejete", …}.'),
) -> None:
    """Applique les décisions d'une relecture humaine : `relire` sur chaque fiche."""
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
    for fiche in relues:
        typer.echo(f"{fiche.c} : statut {fiche.statut}.")
    typer.echo(f"{len(relues)} décisions appliquées.")
