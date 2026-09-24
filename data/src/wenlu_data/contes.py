"""Contes par niveau (story 1.7).

Un même récit traditionnel est réécrit à chaque seuil (255, 405, 505, 805, 1555)
avec les seuls caractères du seuil. Le catalogue des récits est versionné dans
`data/sources/contes/catalogue.tsv` ; il ne porte que le titre, l'ouvrage d'origine
et un résumé d'intrigue en une phrase. Aucun texte de conte n'est écrit à la main
dans le dépôt : les versions viennent du pipeline, puis d'une relecture humaine.

Chaîne : `invite()` construit l'invite (système + utilisateur), Claude répond en JSON
structuré, `valider()` refuse toute version qui sort de la liste du seuil, et la
génération relance avec les intrus signalés, au plus `ESSAIS_MAX` fois. Chaque version
écrite porte sa traçabilité (conte, seuil, modèle, date, empreinte de l'invite, nombre
d'essais) et le statut « à relire » : la relecture humaine est obligatoire avant export.

Licences : l'invite ne reçoit jamais de définition anglaise de CC-CEDICT (voir
`docs/sources-licences.md` §4.2). Ce module ne lit ni `mots.json` ni les définitions
de Make Me a Hanzi ; la glose est demandée à Claude en français, en ses propres mots.

Deux chemins d'appel, même invite :

- unitaire : `wenlu contes generer --seuil 255 --conte shou-zhu-dai-tu`, réponse
  immédiate, relance automatique sur intrus ;
- par lots : `wenlu contes generer --seuil 255` soumet tous les contes du seuil en une
  fois à l'API Message Batches (moitié prix, résultat sous 24 h), puis
  `wenlu contes recuperer` récupère, valide, écrit, et resoumet ce qui a été rejeté.

Sortie : `data/work/contes/<seuil>/<id>.json` (format dans `data/schema.md`),
journal des lots dans `data/work/contes/lots/<lot>.json`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Callable, Iterable, Optional, Sequence

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
from .paths import CONTES, CONTES_WORK, LISTES


#: Seuils sinographiques de l'Éducation nationale.
SEUILS: tuple[int, ...] = (255, 405, 505, 805, 1555)

#: Longueur visée du texte chinois, en sinogrammes, ponctuation non comprise.
LONGUEURS: dict[int, tuple[int, int]] = {
    255: (60, 120),
    405: (100, 180),
    505: (150, 260),
    805: (220, 380),
    1555: (320, 560),
}

#: Au plus trois appels pour un même conte à un même seuil.
ESSAIS_MAX = 3

A_RELIRE = "a_relire"
REJETE = "rejete"
RELU = "relu"

COLONNES = ("id", "titre_zh", "titre_fr", "ouvrage", "resume_fr")


class CatalogueInvalide(ValueError):
    """Catalogue des contes illisible ou incohérent."""


class SeuilInconnu(ValueError):
    """Seuil hors des seuils sinographiques."""


class SeuilSansListe(FileNotFoundError):
    """Le seuil existe mais sa liste de caractères n'est pas encore versionnée."""


# --------------------------------------------------------------------------- catalogue


@dataclass(frozen=True)
class Conte:
    """Une ligne du catalogue : un récit traditionnel et sa source."""

    id: str
    titre_zh: str
    titre_fr: str
    ouvrage: str
    resume_fr: str


def parse_catalogue(lignes: Iterable[str]) -> list[Conte]:
    """Lit le catalogue TSV : `#` en commentaire, première ligne utile en en-tête."""
    contes: list[Conte] = []
    entete: tuple[str, ...] | None = None
    vus: set[str] = set()
    for numero, brute in enumerate(lignes, start=1):
        ligne = brute.rstrip("\n")
        if not ligne.strip() or ligne.lstrip().startswith("#"):
            continue
        cellules = tuple(cellule.strip() for cellule in ligne.split("\t"))
        if entete is None:
            if cellules != COLONNES:
                raise CatalogueInvalide(f"ligne {numero} : en-tête attendu {COLONNES}, lu {cellules}")
            entete = cellules
            continue
        if len(cellules) != len(COLONNES):
            raise CatalogueInvalide(f"ligne {numero} : {len(cellules)} colonnes pour {len(COLONNES)}")
        if not all(cellules):
            raise CatalogueInvalide(f"ligne {numero} : colonne vide")
        if cellules[0] in vus:
            raise CatalogueInvalide(f"ligne {numero} : doublon d'identifiant {cellules[0]!r}")
        vus.add(cellules[0])
        contes.append(Conte(*cellules))
    if entete is None:
        raise CatalogueInvalide("catalogue sans en-tête")
    return contes


def charger_catalogue(chemin: Path | None = None) -> list[Conte]:
    """Charge `data/sources/contes/catalogue.tsv`."""
    chemin = chemin or CONTES / "catalogue.tsv"
    return parse_catalogue(chemin.read_text(encoding="utf-8").splitlines())


def conte_par_id(identifiant: str, catalogue: Sequence[Conte] | None = None) -> Conte:
    """Retrouve un conte par son identifiant."""
    for conte in catalogue if catalogue is not None else charger_catalogue():
        if conte.id == identifiant:
            return conte
    raise CatalogueInvalide(f"conte inconnu : {identifiant!r}")


# --------------------------------------------------------------------------- listes


def fichier_seuil(seuil: int, dossier: Path | None = None) -> Path:
    return (dossier or LISTES) / f"seuil-{seuil}.txt"


def charger_seuil(seuil: int, dossier: Path | None = None) -> list[str]:
    """Caractères autorisés à un seuil. Refuse proprement un seuil sans liste.

    Les listes des seuils 405 à 1555 ne sont pas encore versionnées : le code
    n'en connaît que le nom de fichier et accepte n'importe quelle liste.
    """
    if seuil not in SEUILS:
        raise SeuilInconnu(f"seuil {seuil} inconnu : {', '.join(str(s) for s in SEUILS)}")
    chemin = fichier_seuil(seuil, dossier)
    if not chemin.exists():
        raise SeuilSansListe(
            f"seuil {seuil} : liste absente ({chemin}). "
            "Versionner la liste avant de générer les contes de ce seuil."
        )
    return charger_liste(chemin)


# --------------------------------------------------------------------------- invite

#: Schéma de sortie imposé au modèle (structured outputs, `output_config.format`).
SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "titre": {"type": "string"},
        "phrases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "zh": {"type": "string"},
                    "pinyin": {"type": "string"},
                    "fr": {"type": "string"},
                },
                "required": ["zh", "pinyin", "fr"],
                "additionalProperties": False,
            },
        },
        "glose": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"c": {"type": "string"}, "fr": {"type": "string"}},
                "required": ["c", "fr"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["titre", "phrases", "glose"],
    "additionalProperties": False,
}

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
4. Le pinyin est donné avec les tons, syllabe par syllabe, pour chaque phrase.
5. La traduction de chaque phrase est en français.
6. La glose donne, pour chaque caractère distinct du titre et du texte, un sens court \
en français (un à trois mots), rédigé par toi, dans le sens qu'il a ici. Jamais \
d'anglais, jamais de liste de sens.
7. Des phrases courtes, de huit à vingt caractères, et un récit qui se tient du début \
à la fin.

Tu réponds par le seul objet JSON demandé, sans commentaire."""


def invite(
    conte: Conte,
    seuil: int,
    autorises: Sequence[str],
    *,
    intrus: Sequence[str] = (),
) -> Invite:
    """Construit l'invite d'un conte à un seuil, éventuellement après un refus.

    `intrus` porte les caractères hors liste de l'essai précédent : ils sont
    signalés nommément pour la relance.
    """
    minimum, maximum = LONGUEURS.get(seuil, (60, 120))
    lignes = [
        f"Récit : {conte.titre_zh} — « {conte.titre_fr} ».",
        f"Ouvrage d'origine : {conte.ouvrage} (cité pour la traçabilité ; n'en recopie rien).",
        f"Intrigue à raconter : {conte.resume_fr}",
        "",
        f"Seuil : {seuil} caractères.",
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


@dataclass(frozen=True)
class Generation:
    """Traçabilité d'une version : d'où elle vient et comment."""

    modele: str
    api: str
    date: str
    empreinte_invite: str
    essais: int
    intrus: list[str] = field(default_factory=list)


@dataclass
class Version:
    """Une version d'un conte à un seuil."""

    conte: str
    seuil: int
    titre: str
    titre_fr: str
    ouvrage: str
    resume_fr: str
    phrases: list[Phrase]
    glose: dict[str, str]
    generation: Generation
    statut: str = A_RELIRE

    @property
    def texte(self) -> str:
        """Le chinois soumis au contrôle : titre et phrases."""
        return self.titre + "".join(p.zh for p in self.phrases)

    def en_json(self) -> dict[str, object]:
        return {
            "conte": self.conte,
            "seuil": self.seuil,
            "titre": self.titre,
            "titre_fr": self.titre_fr,
            "source": {"ouvrage": self.ouvrage, "resume_fr": self.resume_fr},
            "phrases": [{"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr} for p in self.phrases],
            "glose": self.glose,
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
    seuil: int,
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
        phrases.append(Phrase(zh=element["zh"], pinyin=element["pinyin"], fr=element["fr"]))
    glose: dict[str, str] = {}
    for element in glose_brute:
        if not isinstance(element, dict) or not all(isinstance(element.get(k), str) for k in ("c", "fr")):
            raise ReponseInvalide(f"{conte.id} ({seuil}) : glose hors schéma")
        glose[element["c"]] = element["fr"]
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
    )


def version_depuis_json(document: dict[str, object]) -> Version:
    """Relit une version écrite dans `data/work/contes/`."""
    source = document.get("source") or {}
    generation = document.get("generation") or {}
    if not isinstance(source, dict) or not isinstance(generation, dict):
        raise ReponseInvalide("version illisible : source ou generation hors format")
    phrases = document.get("phrases")
    glose = document.get("glose")
    if not isinstance(phrases, list) or not isinstance(glose, dict):
        raise ReponseInvalide("version illisible : phrases ou glose hors format")
    return Version(
        conte=str(document.get("conte", "")),
        seuil=int(document.get("seuil", 0)),
        titre=str(document.get("titre", "")),
        titre_fr=str(document.get("titre_fr", "")),
        ouvrage=str(source.get("ouvrage", "")),
        resume_fr=str(source.get("resume_fr", "")),
        phrases=[Phrase(zh=p["zh"], pinyin=p["pinyin"], fr=p["fr"]) for p in phrases],
        glose={str(c): str(sens) for c, sens in glose.items()},
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


@dataclass(frozen=True)
class Rapport:
    """Résultat d'une validation. `intrus` non vide vaut rejet."""

    intrus: list[str]
    ecarts: list[str] = field(default_factory=list)

    @property
    def conforme(self) -> bool:
        return not self.intrus


def valider(version: Version, autorises: Sequence[str]) -> Rapport:
    """Contrôle strict : tout caractère hors liste est un rejet.

    Les autres défauts (glose incomplète, longueur hors cible) sont des écarts
    signalés à la relecture, pas des rejets.
    """
    intrus = caracteres_hors_liste(version.texte, autorises)
    ecarts: list[str] = []
    if not version.phrases:
        ecarts.append("aucune phrase")
    distincts = [c for c in dict.fromkeys(version.texte) if est_sinogramme(c)]
    manquants = [c for c in distincts if c not in version.glose]
    if manquants:
        ecarts.append(f"glose absente pour {' '.join(manquants)}")
    superflus = [c for c in version.glose if c not in set(distincts)]
    if superflus:
        ecarts.append(f"glose sur des caractères hors du texte : {' '.join(superflus)}")
    longueur = sum(1 for p in version.phrases for c in p.zh if est_sinogramme(c))
    minimum, maximum = LONGUEURS.get(version.seuil, (0, 10**6))
    if not minimum <= longueur <= maximum:
        ecarts.append(f"longueur {longueur} hors de la cible {minimum}–{maximum}")
    vides = [i for i, p in enumerate(version.phrases, start=1) if not p.zh.strip() or not p.fr.strip()]
    if vides:
        ecarts.append(f"phrases vides : {', '.join(str(i) for i in vides)}")
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


def chemin_version(seuil: int, conte_id: str, dossier: Path | None = None) -> Path:
    return (dossier or CONTES_WORK) / str(seuil) / f"{conte_id}.json"


def ecrire_version(version: Version, dossier: Path | None = None) -> Path:
    chemin = chemin_version(version.seuil, version.conte, dossier)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(version.en_json(), ensure_ascii=False, indent=1), encoding="utf-8")
    return chemin


def lire_version(chemin: Path) -> Version:
    return version_depuis_json(json.loads(chemin.read_text(encoding="utf-8")))


def versions_ecrites(dossier: Path | None = None) -> list[Path]:
    """Toutes les versions écrites, dossier de seuil par dossier de seuil."""
    dossier = dossier or CONTES_WORK
    if not dossier.exists():
        return []
    seuils = sorted((d for d in dossier.iterdir() if d.is_dir() and d.name.isdigit()), key=lambda d: int(d.name))
    return [f for d in seuils for f in sorted(d.glob("*.json"))]


# --------------------------------------------------------------------------- génération


def generer_version(
    conte: Conte,
    seuil: int,
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
        rapport = valider(version, autorises)
        version.generation = replace(version.generation, intrus=rapport.intrus)
        version.statut = A_RELIRE if rapport.conforme else REJETE
        if rapport.conforme:
            return version, rapport
        signales = rapport.intrus
    assert version is not None  # essais_max >= 1
    return version, rapport


# --------------------------------------------------------------------------- lots


def dossier_lots(dossier: Path | None = None) -> Path:
    return (dossier or CONTES_WORK) / "lots"


def custom_id(seuil: int, conte_id: str, essai: int) -> str:
    return f"{seuil}-{conte_id}-{essai}"


def soumettre_lot(
    contes: Sequence[Conte],
    seuil: int,
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
    seuil = int(lot["seuil"])
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
        rapport = valider(version, autorises)
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


# --------------------------------------------------------------------------- check


def controles(dossier: Path | None = None, listes: Path | None = None) -> list[Controle]:
    """Contrôles des contes, appelés par `wenlu check`.

    « caractères hors liste » est bloquant : un conte d'un seuil ne peut pas
    contenir un caractère que l'apprenant n'a pas encore vu.
    """
    fichiers = versions_ecrites(dossier)
    if not fichiers:
        return [Controle("contes : caractères hors liste", True, "aucune version générée")]

    fautifs: list[str] = []
    sans_liste: set[int] = set()
    a_relire = 0
    cache: dict[int, list[str] | None] = {}
    for chemin in fichiers:
        version = lire_version(chemin)
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
        detail += f" ; seuils sans liste, non contrôlés : {', '.join(str(s) for s in sorted(sans_liste))}"
    return [
        Controle("contes : caractères hors liste", not fautifs, detail, bloquant=True),
        Controle(
            "contes : relecture",
            a_relire == 0,
            f"{a_relire} versions sur {len(fichiers)} restent à relire avant export",
        ),
    ]


# --------------------------------------------------------------------------- cli

app = typer.Typer(help="Contes par niveau : génération par lots, récupération, validation.")


def _client(modele: str) -> ClientClaude:
    return claude.client_ou_sortie(lambda: client_anthropic(modele))


def _autorises(seuil: int) -> list[str]:
    try:
        return charger_seuil(seuil)
    except (SeuilInconnu, SeuilSansListe) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


@app.command("generer")
def commande_generer(
    seuil: int = typer.Option(..., "--seuil", help="255, 405, 505, 805 ou 1555."),
    conte: Optional[str] = typer.Option(None, "--conte", help="Un seul conte, en mode unitaire."),
    modele: str = typer.Option(MODELE, "--modele", help="Modèle Claude."),
) -> None:
    """Génère les contes d'un seuil : par lots, ou un seul conte en unitaire."""
    autorises = _autorises(seuil)
    catalogue = charger_catalogue()
    client = _client(modele)

    if conte is not None:
        choisi = conte_par_id(conte, catalogue)
        version, rapport = generer_version(choisi, seuil, autorises, client)
        chemin = ecrire_version(version)
        typer.echo(f"{choisi.id} ({seuil}) : {version.statut}, {version.generation.essais} essai(s) → {chemin}")
        for ecart in rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
        if not rapport.conforme:
            typer.echo(f"Caractères hors liste : {' '.join(rapport.intrus)}", err=True)
            raise typer.Exit(code=1)
        return

    lot = soumettre_lot(catalogue, seuil, autorises, client)
    typer.echo(f"Lot {lot['lot']} soumis : {len(catalogue)} contes au seuil {seuil}.")
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
    typer.echo(f"Versions dans {CONTES_WORK}.")


@app.command("valider")
def commande_valider(
    seuil: Optional[int] = typer.Option(None, "--seuil", help="Ne valider qu'un seuil."),
) -> None:
    """Revalide les versions déjà écrites contre la liste de leur seuil."""
    fichiers = [f for f in versions_ecrites() if seuil is None or f.parent.name == str(seuil)]
    if not fichiers:
        typer.echo("Aucune version à valider.")
        return
    hors_liste = 0
    for chemin in fichiers:
        version = lire_version(chemin)
        rapport = valider(version, _autorises(version.seuil))
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
