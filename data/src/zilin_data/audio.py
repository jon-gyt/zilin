"""Audio pré-généré (story 1.5).

Un fichier par caractère et par mot, synthétisé une fois dans le pipeline puis
embarqué avec l'app. Le brief §11 est explicite : « voix neuronale pré-générée et
embarquée pour tous les caractères et mots. Aucune dépendance à la voix du
téléphone ». L'app ne synthétise jamais rien ; elle lit un fichier servi avec elle.

Chaîne : `perimetre()` dit quels textes doivent parler (les fiches relues, ou à
défaut les listes et leurs mots candidats), `generer()` demande au fournisseur les
textes qui manquent seulement, écrit `data/work/audio/<empreinte>.mp3` et tient le
manifeste `data/work/audio/audio.json`, `exporter()` copie le périmètre dans
`app/public/data/<version>/audio/` avec son manifeste. `controles()` signale les
textes du périmètre qui n'ont pas de voix.

Licence (`docs/sources-licences.md`, ligne « Audio ») : le critère posé est le droit
de redistribuer les fichiers générés, embarqués dans une app payante, sans redevance
par écoute. Aucune page de conditions n'a pu être lue depuis cet environnement (le
proxy de sortie bloque `aws.amazon.com`, `learn.microsoft.com`, `elevenlabs.io`,
`openai.com` et `docs.cloud.google.com`) : la `Licence` du fournisseur réel est donc
remplie « à vérifier », `verifie=False`, et `zilin audio generer` le dit à chaque
passage. Tant que cette ligne n'est pas vérifiée sur une source primaire, aucun
fichier synthétisé n'entre dans un artefact distribué.

Format retenu : MP3 mono 24 kHz à 48 kbit/s. Le débit tient la cible de taille — 6 Ko
par seconde de parole, donc moins de 15 Ko pour un caractère (0,6 à 1 s) comme pour un
mot de deux caractères. Opus descendrait encore de moitié, mais la lecture d'un Ogg
Opus par un `HTMLAudioElement` n'est acquise sur iOS que depuis Safari 17.5 ; le MP3
est lu partout, et c'est l'iPhone qui est visé en premier (brief §12).

Aucun fournisseur simulé n'est accessible depuis la ligne de commande : le simulateur
sert aux tests, et lui seul. Ce qui sort du pipeline est une voix réelle ou rien.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable, Mapping, Protocol, Sequence
from xml.sax.saxutils import escape

import typer

from .gf0014 import Controle
from .ingest import charger_liste
from .paths import AUDIO_WORK, EXPORT, LISTES

#: Format des fichiers et débit visé. Voir le module : MP3 mono 24 kHz, 48 kbit/s.
FORMAT = "mp3"
DEBIT = "mono 24 kHz, 48 kbit/s"

#: Taille visée par texte. Au-delà, le débit ou la découpe sont à revoir.
TAILLE_VISEE = 15_000

#: Voix neuronale par défaut : mandarin standard de Chine continentale.
VOIX_DEFAUT = "zh-CN-XiaoxiaoNeural"

#: Longueur de l'empreinte qui nomme un fichier. 16 hexadécimaux : 64 bits.
LONGUEUR_NOM = 16

#: Nom du manifeste, côté pipeline et côté export.
MANIFESTE = "audio.json"
MANIFESTE_EXPORT = "manifeste.json"

#: Parcours du brief §7, et liste cible de chacun.
PARCOURS = ("lire", "hsk")
SEUIL_DEFAUT = 255

#: Au plus deux mots par caractère quand le périmètre vient des listes : c'est le
#: nombre de mots que porte une fiche (brief §7, « le mot avant le caractère seul »).
MOTS_PAR_CARACTERE = 2

CARACTERE = "caractere"
MOT = "mot"

#: Origine d'un texte du périmètre : les fiches relues, ou les listes à défaut.
DES_FICHES = "fiches"
DES_LISTES = "listes"

A_VERIFIER = "à vérifier"


class ParcoursInconnu(ValueError):
    """Parcours hors des parcours du brief."""


class CleAbsente(RuntimeError):
    """Aucune clé de fournisseur : rien n'est synthétisé, rien n'est écrit."""


class SyntheseImpossible(RuntimeError):
    """Le fournisseur n'a pas rendu d'audio pour ce texte."""


class ManifesteInvalide(ValueError):
    """Manifeste audio illisible ou hors schéma."""


# --------------------------------------------------------------------------- licence


@dataclass(frozen=True)
class Licence:
    """Ce que le fournisseur déclare sur l'usage de l'audio qu'il produit.

    Les quatre champs de fond sont recopiés des conditions du fournisseur, pas
    résumés de mémoire : `usage_commercial`, `redistribution` (le point qui décide,
    voir `docs/sources-licences.md`), `attribution` et `redevance_par_ecoute`.
    `url` et `date_lecture` tracent la page lue. `verifie` ne passe à vrai que
    lorsqu'une source primaire a été lue et citée dans `docs/sources-licences.md`.
    """

    fournisseur: str
    usage_commercial: str = A_VERIFIER
    redistribution: str = A_VERIFIER
    attribution: str = A_VERIFIER
    redevance_par_ecoute: str = A_VERIFIER
    url: str = ""
    date_lecture: str = ""
    verifie: bool = False

    def en_json(self) -> dict[str, object]:
        return {
            "fournisseur": self.fournisseur,
            "usage_commercial": self.usage_commercial,
            "redistribution": self.redistribution,
            "attribution": self.attribution,
            "redevance_par_ecoute": self.redevance_par_ecoute,
            "url": self.url,
            "date_lecture": self.date_lecture,
            "verifie": self.verifie,
        }


# --------------------------------------------------------------------------- fournisseurs


class Fournisseur(Protocol):
    """Ce que le pipeline attend d'un fournisseur de synthèse. Injectable."""

    nom: str
    voix: str
    format: str
    licence: Licence

    def synthetiser(self, texte: str, voix: str) -> bytes:
        """Rend l'audio du texte, dans le format déclaré. Aucune écriture disque."""


class FournisseurSimule:
    """Fournisseur des tests : aucun réseau, des octets déterministes, pas d'audio.

    Ce qu'il rend n'est pas de la parole et ne prétend pas l'être : c'est une suite
    d'octets dérivée du texte, qui permet de contrôler l'idempotence, le manifeste et
    les empreintes sans clé ni fichier réel. Il n'est jamais accessible depuis la CLI.
    """

    def __init__(
        self,
        voix: str = VOIX_DEFAUT,
        *,
        nom: str = "simule",
        format: str = FORMAT,
        octets_par_signe: int = 256,
    ) -> None:
        self.nom = nom
        self.voix = voix
        self.format = format
        self.octets_par_signe = octets_par_signe
        self.licence = Licence(
            fournisseur=nom,
            usage_commercial="sans objet : aucun audio réel",
            redistribution="sans objet : aucun audio réel",
            attribution="sans objet",
            redevance_par_ecoute="sans objet",
        )
        #: Journal des appels : les tests y lisent l'idempotence.
        self.appels: list[tuple[str, str]] = []

    def synthetiser(self, texte: str, voix: str) -> bytes:
        self.appels.append((texte, voix))
        graine = hashlib.sha256(f"{self.nom}\n{voix}\n{texte}".encode("utf-8")).digest()
        n = max(1, len(texte)) * self.octets_par_signe
        return (graine * (n // len(graine) + 1))[:n]


#: Variables d'environnement du fournisseur réel. Aucune clé n'est lue ailleurs.
CLE_ENV = "AZURE_SPEECH_KEY"
REGION_ENV = "AZURE_SPEECH_REGION"
REGION_DEFAUT = "westeurope"

#: Point de terminaison REST de la synthèse Azure Speech, par région.
POINT_DE_TERMINAISON = "https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"

#: Nom du format MP3 demandé à Azure (en-tête `X-Microsoft-OutputFormat`).
SORTIE_AZURE = "audio-24khz-48kbitrate-mono-mp3"

#: Langue des voix retenues : mandarin standard, Chine continentale.
LANGUE = "zh-CN"

#: Licence Azure Speech, telle qu'elle est connue à ce jour : rien n'a pu être lu.
#: Le tableau de `docs/sources-licences.md` porte la même mention « à vérifier ».
LICENCE_AZURE = Licence(
    fournisseur="Azure AI Speech (Microsoft)",
    usage_commercial=A_VERIFIER,
    redistribution=A_VERIFIER,
    attribution=A_VERIFIER,
    redevance_par_ecoute=A_VERIFIER,
    url="https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech",
    date_lecture="",
    verifie=False,
)


class FournisseurAzure:
    """Azure AI Speech, synthèse REST, une requête par texte.

    Pourquoi celui-ci : la facturation porte sur les caractères synthétisés, une fois,
    et non sur les écoutes — c'est le critère posé dans `docs/sources-licences.md` ; la
    couverture du mandarin neuronal est la plus large du lot ; l'API est une simple
    requête HTTP avec une clé, sans SDK à ajouter (`httpx` est déjà une dépendance).
    Le droit de redistribuer les fichiers générés dans une app payante reste à
    vérifier sur les conditions du fournisseur : voir `LICENCE_AZURE`.

    Refus propre sans clé : la construction lève `CleAbsente`, avant tout appel et
    avant toute écriture.
    """

    nom = "azure-speech"

    def __init__(
        self,
        voix: str = VOIX_DEFAUT,
        *,
        region: str | None = None,
        cle: str | None = None,
        sortie: str = SORTIE_AZURE,
        client: object | None = None,
        timeout: float = 30.0,
    ) -> None:
        cle = cle or os.environ.get(CLE_ENV) or ""
        if not cle:
            raise CleAbsente(
                f"{CLE_ENV} absent : aucun appel n'est fait et aucun fichier n'est écrit."
            )
        self.voix = voix
        self.format = FORMAT
        self.licence = LICENCE_AZURE
        self.region = region or os.environ.get(REGION_ENV) or REGION_DEFAUT
        self.sortie = sortie
        self.url = POINT_DE_TERMINAISON.format(region=self.region)
        self._cle = cle
        self._timeout = timeout
        self._client = client

    def ssml(self, texte: str, voix: str) -> str:
        """Le texte en SSML, échappé : un caractère chinois n'est jamais du balisage."""
        return (
            f'<speak version="1.0" xml:lang="{LANGUE}">'
            f'<voice name="{escape(voix)}">{escape(texte)}</voice>'
            "</speak>"
        )

    def _http(self) -> object:
        if self._client is None:
            import httpx

            self._client = httpx.Client(timeout=self._timeout)
        return self._client

    def synthetiser(self, texte: str, voix: str) -> bytes:
        reponse = self._http().post(  # type: ignore[attr-defined]
            self.url,
            headers={
                "Ocp-Apim-Subscription-Key": self._cle,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": self.sortie,
                "User-Agent": "zilin-data",
            },
            content=self.ssml(texte, voix).encode("utf-8"),
        )
        reponse.raise_for_status()
        audio = bytes(reponse.content)
        if not audio:
            raise SyntheseImpossible(f"réponse vide pour {texte!r}")
        return audio


def fournisseur_azure(voix: str = VOIX_DEFAUT) -> Fournisseur:
    """Fournisseur réel. Refuse de partir sans clé, sans rien écrire."""
    return FournisseurAzure(voix)


# --------------------------------------------------------------------------- périmètre


@dataclass(frozen=True)
class TexteAudio:
    """Un texte qui doit parler : un caractère ou un mot, et d'où il vient."""

    texte: str
    genre: str = CARACTERE
    origine: str = DES_LISTES


def _sans_doublon(textes: Iterable[TexteAudio]) -> list[TexteAudio]:
    """Garde le premier de chaque texte, dans l'ordre d'arrivée."""
    vus: dict[str, TexteAudio] = {}
    for t in textes:
        vus.setdefault(t.texte, t)
    return list(vus.values())


def liste_cible(parcours: str, seuil: int = SEUIL_DEFAUT) -> str:
    """Nom de la liste du parcours : `seuil-255` pour lire, `hsk-1` pour le HSK."""
    if parcours not in PARCOURS:
        raise ParcoursInconnu(f"parcours {parcours!r} inconnu : {', '.join(PARCOURS)}")
    return f"seuil-{seuil}" if parcours == "lire" else "hsk-1"


def perimetre_fiches(
    parcours: str = "lire", *, dossier: Path | None = None
) -> list[TexteAudio]:
    """Caractères et mots des fiches relues du parcours. Vide s'il n'y en a pas.

    Une fiche non relue n'entre pas : son texte peut encore changer, et on ne
    synthétise pas deux fois ce qui n'est pas arrêté.
    """
    from .fiches import RELU, fiches_ecrites, lire_fiche

    textes: list[TexteAudio] = []
    for chemin in fiches_ecrites(dossier):
        fiche = lire_fiche(chemin)
        if fiche.statut != RELU or fiche.parcours != parcours:
            continue
        textes.append(TexteAudio(fiche.c, CARACTERE, DES_FICHES))
        textes.extend(TexteAudio(m.hanzi, MOT, DES_FICHES) for m in fiche.mots)
    return _sans_doublon(textes)


def perimetre_listes(
    parcours: str = "lire",
    seuil: int = SEUIL_DEFAUT,
    *,
    listes: Path | None = None,
    corpus: object | None = None,
    chercher_corpus: bool = True,
) -> list[TexteAudio]:
    """Caractères de la liste cible, puis leurs mots candidats quand on en a.

    Les mots viennent du corpus des fiches (`fiches.Corpus`), qui ne lit de CC-CEDICT
    que le mot et son pinyin (`docs/sources-licences.md` §4.2). Sans corpus construit,
    le périmètre se limite aux caractères : c'est le cas tant que `zilin build` n'a
    pas tourné.
    """
    cible = liste_cible(parcours, seuil)
    chemin = (listes or LISTES) / f"{cible}.txt"
    if not chemin.exists():
        return []
    caracteres = charger_liste(chemin)
    textes = [TexteAudio(c, CARACTERE, DES_LISTES) for c in caracteres]
    if corpus is None and chercher_corpus:
        corpus = _corpus_si_construit(parcours)
    if corpus is not None:
        connus = set(caracteres)
        for c in caracteres:
            if c not in corpus:  # type: ignore[operator]
                continue
            retenus = 0
            for mot in corpus.candidats(c):  # type: ignore[attr-defined]
                if not set(mot.hanzi) <= connus:
                    continue
                textes.append(TexteAudio(mot.hanzi, MOT, DES_LISTES))
                retenus += 1
                if retenus >= MOTS_PAR_CARACTERE:
                    break
    return _sans_doublon(textes)


def _corpus_si_construit(parcours: str) -> object | None:
    """Le corpus des fiches s'il est là, `None` sinon. Ne fait jamais échouer l'audio."""
    from .fiches import CorpusAbsent, charger_corpus

    try:
        return charger_corpus(parcours)
    except (CorpusAbsent, FileNotFoundError, KeyError, ValueError):
        return None


def perimetre(
    parcours: str = "lire",
    seuil: int = SEUIL_DEFAUT,
    *,
    fiches_dossier: Path | None = None,
    listes: Path | None = None,
    corpus: object | None = None,
    chercher_corpus: bool = True,
) -> list[TexteAudio]:
    """Le périmètre audio : les fiches relues, ou les listes à défaut."""
    if parcours not in PARCOURS:
        raise ParcoursInconnu(f"parcours {parcours!r} inconnu : {', '.join(PARCOURS)}")
    des_fiches = perimetre_fiches(parcours, dossier=fiches_dossier)
    if des_fiches:
        return des_fiches
    return perimetre_listes(
        parcours, seuil, listes=listes, corpus=corpus, chercher_corpus=chercher_corpus
    )


# --------------------------------------------------------------------------- manifeste


def empreinte(octets: bytes) -> str:
    """SHA-256 du fichier audio, préfixé comme ailleurs dans le pipeline."""
    return "sha256:" + hashlib.sha256(octets).hexdigest()


def nom_fichier(texte: str, voix: str, fournisseur: str, format: str = FORMAT) -> str:
    """Nom du fichier d'un texte : `<16 hexadécimaux>.<format>`.

    L'empreinte porte sur ce qui change l'audio — le fournisseur, la voix, le format
    et le texte — et jamais sur la date : deux passages donnent le même nom, et un
    changement de voix donne un fichier neuf sans écraser l'ancien.
    """
    cle = "\n".join((fournisseur, voix, format, texte)).encode("utf-8")
    return f"{hashlib.sha256(cle).hexdigest()[:LONGUEUR_NOM]}.{format}"


@dataclass(frozen=True)
class Entree:
    """Une ligne du manifeste : un texte, son fichier, et de quoi le refaire."""

    texte: str
    genre: str
    fichier: str
    fournisseur: str
    voix: str
    format: str
    date: str
    empreinte: str
    octets: int

    def en_json(self) -> dict[str, object]:
        return {
            "texte": self.texte,
            "genre": self.genre,
            "fichier": self.fichier,
            "fournisseur": self.fournisseur,
            "voix": self.voix,
            "format": self.format,
            "date": self.date,
            "empreinte": self.empreinte,
            "octets": self.octets,
        }


@dataclass
class Manifeste:
    """`data/work/audio/audio.json` : ce qui a déjà une voix, et laquelle."""

    entrees: dict[str, Entree] = field(default_factory=dict)
    version: int = 1
    genere: str = ""

    def __contains__(self, texte: object) -> bool:
        return texte in self.entrees

    def chemins(self) -> dict[str, str]:
        """Texte → nom de fichier, dans l'ordre des textes."""
        return {t: e.fichier for t, e in sorted(self.entrees.items())}

    def en_json(self) -> dict[str, object]:
        return {
            "version": self.version,
            "genere": self.genere,
            "format": FORMAT,
            "debit": DEBIT,
            "entrees": [e.en_json() for _, e in sorted(self.entrees.items())],
        }


def _maintenant() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def chemin_manifeste(dossier: Path | None = None) -> Path:
    return (dossier or AUDIO_WORK) / MANIFESTE


def entree_depuis_json(document: Mapping[str, object]) -> Entree:
    try:
        return Entree(
            texte=str(document["texte"]),
            genre=str(document.get("genre") or CARACTERE),
            fichier=str(document["fichier"]),
            fournisseur=str(document.get("fournisseur") or ""),
            voix=str(document.get("voix") or ""),
            format=str(document.get("format") or FORMAT),
            date=str(document.get("date") or ""),
            empreinte=str(document.get("empreinte") or ""),
            octets=int(document.get("octets") or 0),
        )
    except KeyError as erreur:
        raise ManifesteInvalide(f"entrée sans {erreur}") from erreur


def lire_manifeste(dossier: Path | None = None) -> Manifeste:
    """Lit le manifeste, ou en rend un vide s'il n'existe pas encore."""
    chemin = chemin_manifeste(dossier)
    if not chemin.exists():
        return Manifeste()
    document = json.loads(chemin.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or not isinstance(document.get("entrees"), list):
        raise ManifesteInvalide(f"{chemin} : format inattendu")
    entrees = [entree_depuis_json(e) for e in document["entrees"]]
    return Manifeste(
        entrees={e.texte: e for e in entrees},
        version=int(document.get("version") or 1),
        genere=str(document.get("genere") or ""),
    )


def ecrire_manifeste(manifeste: Manifeste, dossier: Path | None = None) -> Path:
    chemin = chemin_manifeste(dossier)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(
        json.dumps(manifeste.en_json(), ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return chemin


# --------------------------------------------------------------------------- génération


@dataclass(frozen=True)
class Rapport:
    """Ce qu'un passage de génération a fait."""

    crees: list[str] = field(default_factory=list)
    deja: list[str] = field(default_factory=list)
    echecs: list[tuple[str, str]] = field(default_factory=list)
    trop_gros: list[str] = field(default_factory=list)

    @property
    def complet(self) -> bool:
        return not self.echecs


def a_jour(entree: Entree | None, fournisseur: Fournisseur, dossier: Path) -> bool:
    """Vrai si ce texte a déjà sa voix : même fournisseur, même voix, fichier présent."""
    if entree is None:
        return False
    if (entree.fournisseur, entree.voix, entree.format) != (
        fournisseur.nom,
        fournisseur.voix,
        fournisseur.format,
    ):
        return False
    return (dossier / entree.fichier).exists()


def generer(
    textes: Sequence[TexteAudio],
    fournisseur: Fournisseur,
    *,
    dossier: Path | None = None,
) -> Rapport:
    """Synthétise ce qui manque, et lui seul. Idempotent : deux passages, un appel.

    Un texte déjà synthétisé avec le même fournisseur, la même voix et le même format,
    dont le fichier est toujours là, n'est pas redemandé. Un échec sur un texte n'arrête
    pas les autres : il est rapporté, et le manifeste garde ce qui a abouti.
    """
    dossier = dossier or AUDIO_WORK
    manifeste = lire_manifeste(dossier)
    rapport = Rapport()
    for cible in textes:
        entree = manifeste.entrees.get(cible.texte)
        if a_jour(entree, fournisseur, dossier):
            rapport.deja.append(cible.texte)
            continue
        try:
            audio = fournisseur.synthetiser(cible.texte, fournisseur.voix)
        except Exception as erreur:  # le fournisseur décide de ses propres erreurs
            rapport.echecs.append((cible.texte, str(erreur)))
            continue
        fichier = nom_fichier(cible.texte, fournisseur.voix, fournisseur.nom, fournisseur.format)
        dossier.mkdir(parents=True, exist_ok=True)
        (dossier / fichier).write_bytes(audio)
        manifeste.entrees[cible.texte] = Entree(
            texte=cible.texte,
            genre=cible.genre,
            fichier=fichier,
            fournisseur=fournisseur.nom,
            voix=fournisseur.voix,
            format=fournisseur.format,
            date=_maintenant(),
            empreinte=empreinte(audio),
            octets=len(audio),
        )
        rapport.crees.append(cible.texte)
        if len(audio) > TAILLE_VISEE:
            rapport.trop_gros.append(cible.texte)
    manifeste.genere = _maintenant()
    ecrire_manifeste(manifeste, dossier)
    return rapport


# --------------------------------------------------------------------------- export


def dossier_export(version: str, export: Path | None = None) -> Path:
    return (export or EXPORT) / version / "audio"


def chemin_app(version: str, fichier: str) -> str:
    """Chemin tel que l'app le lit : relatif à `app/public/`, comme les autres JSON."""
    return f"data/{version}/audio/{fichier}"


def manifeste_exporte(
    version: str,
    entrees: Sequence[Entree],
    licence: Licence,
    *,
    date: str | None = None,
) -> dict[str, object]:
    """Le manifeste que l'app lit, et que l'export des fiches (story 1.6) relit.

    En-tête `license`, `source`, `source_url`, `modified` : exigé de tout export par
    `docs/sources-licences.md` §8.
    """
    return {
        "version": version,
        "license": f"audio synthétisé — droits du fournisseur ({licence.fournisseur})",
        "source": f"{licence.fournisseur}, voix {', '.join(sorted({e.voix for e in entrees})) or '—'}",
        "source_url": licence.url,
        "modified": (date or _maintenant())[:10],
        "fournisseur": licence.fournisseur,
        "format": FORMAT,
        "debit": DEBIT,
        "licence": licence.en_json(),
        "chemins": {e.texte: chemin_app(version, e.fichier) for e in sorted(entrees, key=lambda e: e.texte)},
    }


def exporter(
    version: str,
    textes: Sequence[TexteAudio],
    licence: Licence,
    *,
    dossier: Path | None = None,
    export: Path | None = None,
) -> dict[str, object]:
    """Copie l'audio du périmètre dans l'app et écrit son manifeste.

    Ne copie que ce qui est dans le périmètre : l'app n'embarque pas les essais.
    Les textes du périmètre sans audio sont simplement absents du manifeste ; c'est
    `controles()` qui les signale, et l'app se tait sur eux.
    """
    dossier = dossier or AUDIO_WORK
    manifeste = lire_manifeste(dossier)
    dest = dossier_export(version, export)
    dest.mkdir(parents=True, exist_ok=True)

    retenues: list[Entree] = []
    manquants: list[str] = []
    for cible in textes:
        entree = manifeste.entrees.get(cible.texte)
        if entree is None or not (dossier / entree.fichier).exists():
            manquants.append(cible.texte)
            continue
        shutil.copyfile(dossier / entree.fichier, dest / entree.fichier)
        retenues.append(entree)

    document = manifeste_exporte(version, retenues, licence)
    (dest / MANIFESTE_EXPORT).write_text(
        json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return {
        "copies": len(retenues),
        "manquants": manquants,
        "manifeste": str(dest / MANIFESTE_EXPORT),
    }


def chemins_exportes(version: str, export: Path | None = None) -> dict[str, str]:
    """Texte → chemin dans l'app, lu du manifeste exporté. Contrat de la story 1.6.

    L'export des fiches s'en sert pour remplir `Fiche.audio` (le caractère) et
    `Mot.audio` (le mot) ; un texte absent vaut `null`, et l'app se tait.
    """
    chemin = dossier_export(version, export) / MANIFESTE_EXPORT
    if not chemin.exists():
        return {}
    document = json.loads(chemin.read_text(encoding="utf-8"))
    chemins = document.get("chemins") if isinstance(document, dict) else None
    if not isinstance(chemins, dict):
        raise ManifesteInvalide(f"{chemin} : format inattendu")
    return {str(k): str(v) for k, v in chemins.items()}


# --------------------------------------------------------------------------- check


def controles(
    parcours: str = "lire",
    seuil: int = SEUIL_DEFAUT,
    *,
    dossier: Path | None = None,
    textes: Sequence[TexteAudio] | None = None,
    fiches_dossier: Path | None = None,
    listes: Path | None = None,
) -> list[Controle]:
    """Contrôle « audio : textes sans audio », appelé par `zilin check`.

    Signalé, non bloquant : l'audio se fabrique par lots et coûte une clé, il arrive
    après le texte. Ce qui n'a pas de voix ne casse rien — l'app se tait dessus.
    """
    cibles = list(
        textes
        if textes is not None
        else perimetre(parcours, seuil, fiches_dossier=fiches_dossier, listes=listes)
    )
    if not cibles:
        return [Controle("audio : textes sans audio", True, "aucun périmètre à contrôler")]
    manifeste = lire_manifeste(dossier)
    racine = dossier or AUDIO_WORK
    sans: list[str] = []
    for cible in cibles:
        entree = manifeste.entrees.get(cible.texte)
        if entree is None or not (racine / entree.fichier).exists():
            sans.append(cible.texte)
    detail = f"{len(cibles) - len(sans)} textes sur {len(cibles)} ont une voix"
    if sans:
        detail += f" ; sans audio : {' '.join(sans[:10])}" + (" …" if len(sans) > 10 else "")
    return [Controle("audio : textes sans audio", not sans, detail)]


# --------------------------------------------------------------------------- cli

app = typer.Typer(help="Audio pré-généré : génération par fournisseur, export dans l'app.")


def _fournisseur(voix: str) -> Fournisseur:
    try:
        return fournisseur_azure(voix)
    except CleAbsente as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=2) from erreur


def _perimetre(parcours: str, seuil: int) -> list[TexteAudio]:
    try:
        return perimetre(parcours, seuil)
    except ParcoursInconnu as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


@app.command("generer")
def commande_generer(
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
    seuil: int = typer.Option(SEUIL_DEFAUT, "--seuil", help="Seuil de la liste cible du parcours lire."),
    voix: str = typer.Option(VOIX_DEFAUT, "--voix", help="Voix neuronale du fournisseur."),
) -> None:
    """Synthétise un fichier par caractère et par mot du périmètre. Idempotent."""
    fournisseur = _fournisseur(voix)
    if not fournisseur.licence.verifie:
        typer.echo(
            f"Licence {fournisseur.licence.fournisseur} : {A_VERIFIER} "
            "(usage commercial, redistribution, redevance par écoute). "
            "Aucun fichier ne part dans un artefact distribué avant vérification "
            "— voir docs/sources-licences.md.",
            err=True,
        )
    cibles = _perimetre(parcours, seuil)
    if not cibles:
        typer.echo("Périmètre vide : ni fiche relue, ni liste. Rien à synthétiser.")
        return
    rapport = generer(cibles, fournisseur)
    typer.echo(
        f"{len(rapport.crees)} créés, {len(rapport.deja)} déjà présents, "
        f"{len(rapport.echecs)} en échec, sur {len(cibles)} textes du périmètre."
    )
    for texte in rapport.trop_gros:
        typer.echo(f"  taille : {texte} dépasse {TAILLE_VISEE} octets", err=True)
    typer.echo(f"Fichiers et manifeste dans {AUDIO_WORK}.")
    if rapport.echecs:
        for texte, motif in rapport.echecs[:10]:
            typer.echo(f"  échec : {texte} — {motif}", err=True)
        raise typer.Exit(code=1)


@app.command("exporter")
def commande_exporter(
    version: str = typer.Option("0.1.0", "--version", help="Version de l'export."),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
    seuil: int = typer.Option(SEUIL_DEFAUT, "--seuil", help="Seuil de la liste cible du parcours lire."),
) -> None:
    """Copie l'audio du périmètre dans app/public/data/<version>/audio/."""
    cibles = _perimetre(parcours, seuil)
    rapport = exporter(version, cibles, LICENCE_AZURE)
    manquants = rapport["manquants"]
    assert isinstance(manquants, list)
    typer.echo(f"{rapport['copies']} fichiers copiés, {len(manquants)} textes sans audio.")
    typer.echo(f"Manifeste : {rapport['manifeste']}.")
