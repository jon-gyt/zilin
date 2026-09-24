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

Licence (`docs/sources-licences.md`, lignes « Audio ») : le critère posé est le droit
de redistribuer les fichiers générés, embarqués dans une app payante, sans redevance
par écoute. Deux fournisseurs réels, et le défaut a changé.

`FournisseurLocal` (Kokoro) est le défaut : un modèle ouvert de 82 millions de
paramètres, exécuté dans le pipeline. Rien n'est appelé, rien n'est facturé, et nous
ne redistribuons ni le code ni les poids — seulement des fichiers produits chez nous.
L'Apache 2.0 a été lue en entier sur le dépôt de l'auteur le 21 septembre 2026, donc
`verifie=True`. La question de la redistribution disparaît au lieu d'être tranchée.

`FournisseurAzure` reste en second, inchangé : aucune page de conditions n'a pu être
lue depuis cet environnement (le proxy de sortie bloque `learn.microsoft.com`), sa
`Licence` est donc « à vérifier », `verifie=False`, et `zilin audio generer
--fournisseur azure` le dit à chaque passage. Tant que cette ligne n'est pas vérifiée
sur une source primaire, aucun fichier synthétisé par Azure n'entre dans un artefact
distribué.

Format retenu, quel que soit le fournisseur : MP3 mono 24 kHz à 48 kbit/s. Azure le
rend directement ; le fournisseur local rend des échantillons à 24 kHz — la fréquence
native de Kokoro, sans rééchantillonnage — que `EncodeurFfmpeg` met au même format.
Sans ffmpeg, le repli est un WAV PCM 16 bits documenté, dix fois plus lourd, bon pour
écouter un lot mais pas pour l'embarqué. Le débit tient la cible de taille — 6 Ko
par seconde de parole, donc moins de 15 Ko pour un caractère (0,6 à 1 s) comme pour un
mot de deux caractères. Opus descendrait encore de moitié, mais la lecture d'un Ogg
Opus par un `HTMLAudioElement` n'est acquise sur iOS que depuis Safari 17.5 ; le MP3
est lu partout, et c'est l'iPhone qui est visé en premier (brief §12).

Aucun fournisseur simulé n'est accessible depuis la ligne de commande : le simulateur
sert aux tests, et lui seul. Ce qui sort du pipeline est une voix réelle ou rien.
"""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import wave
from array import array
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


class PaquetAbsent(RuntimeError):
    """Le paquet du fournisseur local n'est pas installé : rien n'est écrit.

    Le pendant de `CleAbsente` pour la voix locale. Le pipeline reste utilisable sans
    le groupe optionnel `audio` de `pyproject.toml` ; seule la génération s'arrête,
    avant le premier octet écrit.
    """


class FournisseurInconnu(ValueError):
    """Nom de fournisseur hors de ceux qu'expose la ligne de commande."""


class SyntheseImpossible(RuntimeError):
    """Le fournisseur n'a pas rendu d'audio pour ce texte."""


class ManifesteInvalide(ValueError):
    """Manifeste audio illisible ou hors schéma."""


class VoixInconnue(ValueError):
    """La voix demandée n'est pas dans le dépôt de poids : rien n'est synthétisé."""


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


# --------------------------------------------------------------- fournisseur local (Kokoro)

#: Nom du fournisseur local dans le manifeste. C'est le modèle, pas le service.
NOM_LOCAL = "kokoro"

#: Paquet PyPI à installer : groupe optionnel `audio` de `data/pyproject.toml`.
PAQUET_LOCAL = "kokoro"

#: Dépôt des poids. La version 1.1-zh est celle qui porte les voix mandarin ; le dépôt
#: de base `hexgrad/Kokoro-82M` n'en a pas. `KPipeline` s'en sert aussi pour choisir la
#: génération du G2P chinois (`misaki.zh.ZHG2P(version='1.1')`).
MODELE_LOCAL = "hexgrad/Kokoro-82M-v1.1-zh"

#: Code de langue Kokoro du mandarin (`KPipeline(lang_code=...)`), vu dans `pipeline.py`.
LANGUE_LOCALE = "z"

#: Voix par défaut : une voix féminine mandarin de Kokoro v1.1-zh. Jamais vérifiée
#: depuis cet environnement (`huggingface.co` bloqué) : `zilin audio voix` liste celles
#: du dépôt, et `zilin audio generer` refuse une voix qui n'y est pas.
VOIX_LOCALE_DEFAUT = "zf_001"

#: Dossier des voix dans le dépôt de poids : un fichier `<voix>.pt` par voix.
DOSSIER_VOIX = "voices/"

#: Fréquence rendue par Kokoro, qui est aussi celle que vise le pipeline. Aucun
#: rééchantillonnage n'est nécessaire : c'est l'une des raisons du choix.
ECHANTILLONNAGE = 24_000
CANAUX = 1
DEBIT_KBIT = 48

#: Encodeur MP3 : ffmpeg, appelé en sous-processus. Voir `EncodeurFfmpeg`.
FFMPEG = "ffmpeg"

#: Format du repli quand ffmpeg n'est pas là. Voir `EncodeurWav`.
FORMAT_REPLI = "wav"

#: Licence du fournisseur local. Lue le 21 septembre 2026 sur le dépôt de l'auteur,
#: seule source primaire accessible depuis cet environnement (`huggingface.co` est
#: bloqué par le proxy de sortie) :
#:
#: - `https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE` : Apache License
#:   2.0, texte intégral et inchangé (11 357 octets, aucune clause ajoutée).
#: - `https://raw.githubusercontent.com/hexgrad/kokoro/main/README.md` : « With
#:   Apache-licensed weights, Kokoro can be deployed anywhere from production
#:   environments to personal projects. » — les poids aussi, dit l'auteur.
#:
#: Ce qui décide, et que `docs/sources-licences.md` pose comme critère : nous ne
#: redistribuons ni le code ni les poids, seulement des fichiers audio produits chez
#: nous. L'Apache 2.0 n'encadre pas la sortie d'un modèle ; il n'y a ni redevance par
#: écoute, ni compteur, ni service à appeler. C'est exactement ce que le montage
#: cherchait : plus de question de redistribution du tout.
LICENCE_KOKORO = Licence(
    fournisseur="Kokoro (hexgrad), modèle ouvert exécuté dans le pipeline",
    usage_commercial="autorisé sans condition : Apache License 2.0 §2, texte intégral lu sur le dépôt",
    redistribution=(
        "sans objet pour nos fichiers : le modèle tourne chez nous et n'est pas "
        "redistribué ; l'Apache 2.0 n'encadre pas la sortie du modèle. Code et poids "
        "Apache 2.0 : LICENSE et README du dépôt, et carte du modèle "
        "hexgrad/Kokoro-82M-v1.1-zh (`license: apache-2.0`) lue par le workflow donnees "
        "le 2026-09-24"
    ),
    attribution="aucune obligation sur la sortie ; le modèle est cité sur l'écran « Licences » pour la traçabilité",
    redevance_par_ecoute="aucune : pas de service appelé, pas de facturation à l'usage",
    url="https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE",
    date_lecture="2026-09-21",
    verifie=True,
)


class Moteur(Protocol):
    """Ce qui transforme un texte en échantillons. Injectable : les tests en donnent un.

    Séparer le moteur du fournisseur permet de contrôler tout le reste — format,
    manifeste, idempotence, licence — sans modèle ni poids téléchargés.
    """

    echantillonnage: int

    def echantillons(self, texte: str, voix: str) -> Sequence[float]:
        """Rend la parole en flottants dans [-1, 1], à `echantillonnage` hertz."""


class MoteurKokoro:
    """Kokoro, chargé paresseusement : l'import est dans `pipeline()`, pas ailleurs.

    Importer `kokoro` tire `torch` et `transformers`, quelques secondes et beaucoup de
    mémoire. Le pipeline doit rester utilisable sans le groupe optionnel `audio` — et
    `zilin check`, qui touche au module `audio`, ne doit rien charger du tout. D'où
    l'import à l'intérieur de la méthode, et une instance de `KPipeline` gardée pour
    tous les textes du lot : les poids ne sont lus qu'une fois.
    """

    echantillonnage = ECHANTILLONNAGE

    def __init__(self, *, modele: str = MODELE_LOCAL, langue: str = LANGUE_LOCALE) -> None:
        self.modele = modele
        self.langue = langue
        self._pipeline: object | None = None

    def pipeline(self) -> object:
        """Le `KPipeline`, construit au premier texte. Lève `PaquetAbsent` s'il manque."""
        if self._pipeline is None:
            try:
                from kokoro import KPipeline
            except ImportError as erreur:  # paquet absent, ou une de ses dépendances
                raise PaquetAbsent(message_paquet_absent()) from erreur
            self._pipeline = KPipeline(lang_code=self.langue, repo_id=self.modele)
        return self._pipeline

    def echantillons(self, texte: str, voix: str) -> Sequence[float]:
        morceaux = [
            morceau
            for _, _, morceau in self.pipeline()(texte, voice=voix)  # type: ignore[operator]
            if morceau is not None
        ]
        valeurs: list[float] = []
        for morceau in morceaux:
            # Kokoro rend un tenseur torch ; `tolist` évite d'importer torch ici.
            valeurs.extend(morceau.tolist() if hasattr(morceau, "tolist") else list(morceau))
        if not valeurs:
            raise SyntheseImpossible(f"aucun échantillon rendu pour {texte!r}")
        return valeurs

    def voix_disponibles(self) -> list[str]:
        """Les voix du dépôt de poids : ses fichiers `voices/<voix>.pt`.

        Le hub d'abord ; hors ligne, ce que le cache local en a déjà. Vide si ni l'un
        ni l'autre ne répond. `huggingface_hub` vient avec `kokoro` : importé ici.
        """
        try:
            from huggingface_hub import list_repo_files
        except ImportError as erreur:
            raise PaquetAbsent(message_paquet_absent()) from erreur
        try:
            fichiers = list(list_repo_files(self.modele))
        except Exception:  # réseau coupé, hub hors ligne : le cache local
            fichiers = _fichiers_en_cache(self.modele)
        return voix_du_depot(fichiers)


def voix_du_depot(fichiers: Iterable[str]) -> list[str]:
    """Les noms de voix d'une liste de fichiers du dépôt, triés, sans doublon."""
    return sorted(
        {Path(f).stem for f in fichiers if f.startswith(DOSSIER_VOIX) and f.endswith(".pt")}
    )


def _fichiers_en_cache(modele: str) -> list[str]:
    """Les fichiers de voix du dépôt déjà téléchargés dans le cache Hugging Face."""
    try:
        from huggingface_hub.constants import HF_HUB_CACHE
    except ImportError:
        return []
    racine = Path(HF_HUB_CACHE) / f"models--{modele.replace('/', '--')}" / "snapshots"
    return [f"{DOSSIER_VOIX}{chemin.name}" for chemin in racine.glob(f"*/{DOSSIER_VOIX}*.pt")]


def verifier_voix(voix: str, disponibles: Sequence[str]) -> None:
    """Lève `VoixInconnue` si `voix` n'est pas parmi `disponibles`, en les citant."""
    if voix not in disponibles:
        raise VoixInconnue(
            f"voix « {voix} » absente du modèle {MODELE_LOCAL} ; voix disponibles : "
            f"{', '.join(disponibles)}. Choisissez-en une avec `--voix`."
        )


def message_paquet_absent() -> str:
    """Le message que lit l'utilisateur quand le paquet local n'est pas installé."""
    return (
        f"paquet « {PAQUET_LOCAL} » absent : la voix locale n'est pas installée. "
        "Installez le groupe optionnel depuis data/ : `uv sync --extra audio`. "
        "Aucun appel n'est fait et aucun fichier n'est écrit."
    )


def _pcm16(echantillons: Sequence[float]) -> bytes:
    """Les flottants en PCM 16 bits petit-boutiste, écrêtés à [-1, 1].

    L'écrêtage est explicite : un modèle peut dépasser 1,0 sur une attaque, et un
    débordement silencieux s'entendrait comme un claquement.
    """
    gabarit = array(
        "h", (max(-32768, min(32767, int(round(v * 32767.0)))) for v in echantillons)
    )
    if sys.byteorder == "big":
        gabarit.byteswap()
    return gabarit.tobytes()


class Encodeur(Protocol):
    """Ce qui met les échantillons au format des fichiers du pipeline."""

    format: str

    def encoder(self, echantillons: Sequence[float], echantillonnage: int) -> bytes:
        """Rend le fichier complet, en-tête compris."""


class EncodeurFfmpeg:
    """MP3 mono 24 kHz 48 kbit/s, par ffmpeg en sous-processus, tout en mémoire.

    Pourquoi ffmpeg et pas un paquet Python : c'est le seul moyen d'obtenir exactement
    le format déjà retenu pour Azure (`SORTIE_AZURE`), donc des fichiers comparables
    quel que soit le fournisseur. `soundfile` sait écrire du MP3 depuis libsndfile 1.1,
    mais ne règle qu'un « compression level » sans correspondance stable en kbit/s, et
    ajouterait une roue binaire à l'installation de base. ffmpeg n'est pas une
    dépendance Python : il est utilisé s'il est là, et son absence est un repli, pas
    une erreur (voir `encodeur_defaut`).
    """

    format = FORMAT

    def __init__(self, binaire: str = FFMPEG, *, debit: int = DEBIT_KBIT, timeout: float = 60.0) -> None:
        self.binaire = binaire
        self.debit = debit
        self.timeout = timeout

    def commande(self, echantillonnage: int) -> list[str]:
        return [
            self.binaire,
            "-hide_banner",
            "-loglevel", "error",
            "-f", "s16le",
            "-ar", str(echantillonnage),
            "-ac", str(CANAUX),
            "-i", "pipe:0",
            "-ar", str(ECHANTILLONNAGE),
            "-ac", str(CANAUX),
            "-b:a", f"{self.debit}k",
            "-f", "mp3",
            "pipe:1",
        ]

    def encoder(self, echantillons: Sequence[float], echantillonnage: int) -> bytes:
        resultat = subprocess.run(  # noqa: S603 — binaire résolu par shutil.which
            self.commande(echantillonnage),
            input=_pcm16(echantillons),
            capture_output=True,
            timeout=self.timeout,
        )
        if resultat.returncode != 0 or not resultat.stdout:
            motif = resultat.stderr.decode("utf-8", "replace").strip() or "sortie vide"
            raise SyntheseImpossible(f"{self.binaire} : {motif}")
        return resultat.stdout


class EncodeurWav:
    """Repli documenté : WAV PCM 16 bits mono 24 kHz, par le module `wave` standard.

    Sans ffmpeg, on ne fabrique pas de MP3 — et on ne fait pas semblant. Le WAV est
    lisible partout, y compris par un `HTMLAudioElement` sur iOS, mais il pèse environ
    dix fois le MP3 visé (48 Ko par seconde contre 6). Il tient donc pour écouter un
    lot et vérifier une voix ; le format embarqué reste le MP3, et `zilin audio
    exporter` recopie ce que le manifeste porte. Le format entre dans le nom de
    fichier et dans `a_jour()` : repasser avec ffmpeg installé refait les fichiers en
    MP3 sans écraser les WAV.
    """

    format = FORMAT_REPLI

    def encoder(self, echantillons: Sequence[float], echantillonnage: int) -> bytes:
        tampon = io.BytesIO()
        with wave.open(tampon, "wb") as sortie:
            sortie.setnchannels(CANAUX)
            sortie.setsampwidth(2)
            sortie.setframerate(echantillonnage)
            sortie.writeframes(_pcm16(echantillons))
        return tampon.getvalue()


def encodeur_defaut(binaire: str = FFMPEG) -> Encodeur:
    """ffmpeg s'il est sur le chemin, WAV sinon. Jamais d'échec à la construction."""
    chemin = shutil.which(binaire)
    return EncodeurFfmpeg(chemin) if chemin else EncodeurWav()


class FournisseurLocal:
    """Kokoro, exécuté dans le pipeline : aucun service, aucune clé, aucun réseau.

    Pourquoi celui-ci plutôt que MeloTTS ou CosyVoice 2 (comparaison du 21 septembre
    2026, licences lues sur les dépôts) : les trois sont permissifs — Kokoro et
    CosyVoice en Apache 2.0, MeloTTS en MIT — mais Kokoro est le seul à cumuler une
    installation par `uv` sans compilation ni binaire système (paquet `kokoro` sur
    PyPI, dépendances `misaki[zh]` toutes en Python pur : jieba, pypinyin, cn2an,
    ordered-set, pypinyin-dict), 82 millions de paramètres qui tiennent sur un CPU, et
    une sortie déjà à 24 kHz, la fréquence que vise le pipeline. MeloTTS n'a pas de
    version publiée sur PyPI dans son dépôt officiel — l'installation passe par un
    clone et `pip install -e .` —, épingle `transformers==4.27.4` et `librosa==0.9.1`,
    demande `mecab-python3` (extension C) puis un `python -m unidic download`.
    CosyVoice demande conda, des sous-modules git et `sox` système, pour un modèle de
    0,5 milliard de paramètres. Voir `docs/sources-licences.md` §9.

    Chargement paresseux : rien n'est importé à la construction. Le moteur n'est bâti
    qu'au premier texte, et un moteur injecté remplace Kokoro entièrement — c'est ce
    que font les tests, qui n'ont ni le paquet ni les poids.
    """

    nom = NOM_LOCAL

    def __init__(
        self,
        voix: str = VOIX_LOCALE_DEFAUT,
        *,
        modele: str = MODELE_LOCAL,
        moteur: Moteur | None = None,
        encodeur: Encodeur | None = None,
    ) -> None:
        self.voix = voix
        self.modele = modele
        self.licence = LICENCE_KOKORO
        self.encodeur = encodeur if encodeur is not None else encodeur_defaut()
        self.format = self.encodeur.format
        self._moteur = moteur

    @property
    def moteur(self) -> Moteur:
        """Le moteur, bâti au premier appel. Aucun import tant qu'on ne synthétise pas."""
        if self._moteur is None:
            self._moteur = MoteurKokoro(modele=self.modele)
        return self._moteur

    def voix_disponibles(self) -> list[str] | None:
        """Les voix du modèle, ou `None` si le moteur ne sait pas les lister."""
        lister = getattr(self.moteur, "voix_disponibles", None)
        return None if lister is None else list(lister())

    def synthetiser(self, texte: str, voix: str) -> bytes:
        echantillons = self.moteur.echantillons(texte, voix)
        if not len(echantillons):
            raise SyntheseImpossible(f"aucun échantillon rendu pour {texte!r}")
        audio = self.encodeur.encoder(echantillons, self.moteur.echantillonnage)
        if not audio:
            raise SyntheseImpossible(f"encodage vide pour {texte!r}")
        return audio


def paquet_local_present() -> bool:
    """Le paquet est-il installé ? Cherché sans l'importer : torch reste au repos."""
    return importlib.util.find_spec(PAQUET_LOCAL) is not None


def fournisseur_local(voix: str | None = None) -> Fournisseur:
    """Fournisseur local. Refuse de partir sans le paquet, sans rien écrire."""
    if not paquet_local_present():
        raise PaquetAbsent(message_paquet_absent())
    return FournisseurLocal(voix or VOIX_LOCALE_DEFAUT)


# --------------------------------------------------------------------------- choix

LOCAL = "local"
AZURE = "azure"

#: Ce que la ligne de commande accepte. `FournisseurSimule` n'y est pas, et n'y sera
#: pas : ce qui sort du pipeline est une voix réelle ou rien.
FOURNISSEURS = (LOCAL, AZURE)


def licence_de(nom: str) -> Licence:
    """La licence déclarée d'un fournisseur, sans le construire."""
    if nom == LOCAL:
        return LICENCE_KOKORO
    if nom == AZURE:
        return LICENCE_AZURE
    raise FournisseurInconnu(f"fournisseur {nom!r} inconnu : {', '.join(FOURNISSEURS)}")


def fabriquer(nom: str = LOCAL, voix: str | None = None) -> Fournisseur:
    """Le fournisseur demandé. Seul point d'entrée de la CLI vers une voix."""
    if nom == LOCAL:
        return fournisseur_local(voix)
    if nom == AZURE:
        return fournisseur_azure(voix or VOIX_DEFAUT)
    raise FournisseurInconnu(f"fournisseur {nom!r} inconnu : {', '.join(FOURNISSEURS)}")


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


def _fournisseur(nom: str, voix: str | None) -> Fournisseur:
    """Le fournisseur demandé, ou un refus propre avant la première écriture.

    Code 2 quand il manque de quoi parler — le paquet local ou la clé Azure —, code 1
    quand le nom demandé n'existe pas. Dans les trois cas, rien n'est écrit.
    """
    try:
        return fabriquer(nom, voix)
    except (PaquetAbsent, CleAbsente) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=2) from erreur
    except FournisseurInconnu as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


def _voix_du_modele(fournisseur: Fournisseur) -> list[str] | None:
    """Les voix que le fournisseur sait lister ; `None` s'il ne sait pas, ou si rien ne répond."""
    lister = getattr(fournisseur, "voix_disponibles", None)
    if lister is None:
        return None
    try:
        disponibles = lister()
    except PaquetAbsent as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=2) from erreur
    except Exception as erreur:  # le hub et le cache se taisent : on le dit
        typer.echo(f"Voix du modèle illisibles ({erreur}).", err=True)
        return None
    return list(disponibles) if disponibles else None


def _perimetre(parcours: str, seuil: int) -> list[TexteAudio]:
    try:
        return perimetre(parcours, seuil)
    except ParcoursInconnu as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur


@app.command("generer")
def commande_generer(
    fournisseur_nom: str = typer.Option(
        LOCAL, "--fournisseur", help="local (Kokoro, hors ligne) ou azure (service, clé requise)."
    ),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
    seuil: int = typer.Option(SEUIL_DEFAUT, "--seuil", help="Seuil de la liste cible du parcours lire."),
    voix: str = typer.Option(None, "--voix", help="Voix du fournisseur. Par défaut, la sienne."),
) -> None:
    """Synthétise un fichier par caractère et par mot du périmètre. Idempotent."""
    fournisseur = _fournisseur(fournisseur_nom, voix)
    disponibles = _voix_du_modele(fournisseur)
    if disponibles is not None:
        try:
            verifier_voix(fournisseur.voix, disponibles)
        except VoixInconnue as erreur:
            typer.echo(str(erreur), err=True)
            raise typer.Exit(code=1) from erreur
    elif hasattr(fournisseur, "voix_disponibles"):
        typer.echo(
            f"Liste des voix inaccessible : la voix {fournisseur.voix} n'est pas vérifiée.",
            err=True,
        )
    if not fournisseur.licence.verifie:
        typer.echo(
            f"Licence {fournisseur.licence.fournisseur} : {A_VERIFIER} "
            "(usage commercial, redistribution, redevance par écoute). "
            "Aucun fichier ne part dans un artefact distribué avant vérification "
            "— voir docs/sources-licences.md.",
            err=True,
        )
    if fournisseur.format != FORMAT:
        typer.echo(
            f"ffmpeg introuvable : repli en {fournisseur.format.upper()} au lieu de "
            f"{FORMAT.upper()} {DEBIT}. Les fichiers sont environ dix fois plus lourds "
            "et ne sont pas ceux qu'on embarque — installez ffmpeg et repassez.",
            err=True,
        )
    cibles = _perimetre(parcours, seuil)
    if not cibles:
        typer.echo("Périmètre vide : ni fiche relue, ni liste. Rien à synthétiser.")
        return
    typer.echo(
        f"Fournisseur {fournisseur.nom}, voix {fournisseur.voix}, format {fournisseur.format}."
    )
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


@app.command("voix")
def commande_voix() -> None:
    """Liste les voix du modèle local (Kokoro v1.1-zh), la voix par défaut marquée."""
    disponibles = _voix_du_modele(_fournisseur(LOCAL, None))
    if disponibles is None:
        typer.echo(
            f"Aucune voix trouvée pour {MODELE_LOCAL} : ni le hub ni le cache local ne répondent.",
            err=True,
        )
        raise typer.Exit(code=1)
    for nom in disponibles:
        typer.echo(f"{nom}{'  (défaut)' if nom == VOIX_LOCALE_DEFAUT else ''}")
    typer.echo(f"{len(disponibles)} voix dans {MODELE_LOCAL}.")
    if VOIX_LOCALE_DEFAUT not in disponibles:
        typer.echo(f"La voix par défaut {VOIX_LOCALE_DEFAUT} n'en fait pas partie.", err=True)
        raise typer.Exit(code=1)


@app.command("exporter")
def commande_exporter(
    version: str = typer.Option("0.1.0", "--version", help="Version de l'export."),
    fournisseur_nom: str = typer.Option(
        LOCAL, "--fournisseur", help="Fournisseur dont la licence accompagne l'export."
    ),
    parcours: str = typer.Option("lire", "--parcours", help="lire ou hsk."),
    seuil: int = typer.Option(SEUIL_DEFAUT, "--seuil", help="Seuil de la liste cible du parcours lire."),
) -> None:
    """Copie l'audio du périmètre dans app/public/data/<version>/audio/."""
    cibles = _perimetre(parcours, seuil)
    try:
        licence = licence_de(fournisseur_nom)
    except FournisseurInconnu as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    rapport = exporter(version, cibles, licence)
    manquants = rapport["manquants"]
    assert isinstance(manquants, list)
    typer.echo(f"{rapport['copies']} fichiers copiés, {len(manquants)} textes sans audio.")
    typer.echo(f"Manifeste : {rapport['manifeste']}.")
