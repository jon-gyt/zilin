"""Le client Claude commun aux fiches (story 1.4) et aux contes (story 1.7).

Les deux chaînes appellent Claude de la même façon : une invite (système +
utilisateur), une réponse JSON contrainte par un schéma (`output_config`), deux
chemins d'appel qui envoient le même corps de requête — Messages API pour
l'unitaire, Message Batches pour les lots — et un journal de lot par fichier.
Ce qui les distingue reste dans leur module : le schéma de réponse, l'invite,
la validation et le dossier de travail.

`fiches` et `contes` réexportent tout ce qui est public ici : `fiches.Invite`,
`contes.ClientAnthropic`, `fiches.lots_en_cours`… restent importables d'où ils
l'étaient.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, ClassVar, Iterator, Protocol, Sequence

import typer

#: Modèle et API retenus : Claude Opus 5, Messages API et Message Batches.
MODELE = "claude-opus-5"
API_UNITAIRE = "messages"
API_LOTS = "messages.batches"

MAX_TOKENS = 8000

#: Statut d'un lot soumis et pas encore récupéré.
EN_COURS = "en_cours"
RECUPERE = "recupere"


class CleAbsente(RuntimeError):
    """Aucune clé d'API : rien n'est généré, rien n'est écrit."""


class ReponseInvalide(ValueError):
    """Réponse du modèle illisible ou hors schéma."""


# --------------------------------------------------------------------------- invite


@dataclass(frozen=True)
class Invite:
    """Invite complète, et son empreinte, portée par chaque texte généré."""

    systeme: str
    utilisateur: str

    @property
    def empreinte(self) -> str:
        brut = f"{self.systeme}\n\n{self.utilisateur}".encode("utf-8")
        return "sha256:" + hashlib.sha256(brut).hexdigest()


def maintenant() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sans_cloture(texte: str) -> str:
    """Retire une éventuelle clôture ```json autour de la réponse."""
    net = texte.strip()
    if net.startswith("```"):
        net = net.split("\n", 1)[-1]
        net = net.rsplit("```", 1)[0]
    return net.strip()


# --------------------------------------------------------------------------- client


@dataclass(frozen=True)
class RequeteLot:
    """Une entrée d'un lot : son `custom_id` et son invite."""

    custom_id: str
    invite: Invite


@dataclass(frozen=True)
class ResultatLot:
    """Un résultat de lot, réussi ou non."""

    custom_id: str
    texte: str | None = None
    erreur: str | None = None


class ClientClaude(Protocol):
    """Ce que le pipeline attend d'un client. Injectable : les tests en simulent un."""

    modele: str

    def generer(self, invite: Invite) -> str:
        """Un appel unitaire. Retourne le texte JSON de la réponse."""

    def soumettre(self, requetes: Sequence[RequeteLot]) -> str:
        """Soumet un lot. Retourne son identifiant."""

    def statut_lot(self, lot: str) -> str:
        """`processing_status` du lot (`in_progress`, `ended`, …)."""

    def resultats(self, lot: str) -> Iterator[ResultatLot]:
        """Résultats d'un lot terminé, dans un ordre quelconque."""


class ClientAnthropic:
    """Messages API pour l'unitaire, Message Batches pour les lots. Même invite.

    Chaque chaîne en dérive une classe qui porte son `SCHEMA` de réponse.
    """

    SCHEMA: ClassVar[dict[str, object]]

    def __init__(self, client: object, *, modele: str = MODELE, max_tokens: int = MAX_TOKENS) -> None:
        self._client = client
        self.modele = modele
        self.max_tokens = max_tokens

    def parametres(self, invite: Invite) -> dict[str, object]:
        """Corps de requête commun aux deux chemins d'appel."""
        return {
            "model": self.modele,
            "max_tokens": self.max_tokens,
            "system": invite.systeme,
            "messages": [{"role": "user", "content": invite.utilisateur}],
            "output_config": {"format": {"type": "json_schema", "schema": self.SCHEMA}},
        }

    @staticmethod
    def _texte(message: object) -> str:
        blocs = getattr(message, "content", [])
        return next((b.text for b in blocs if getattr(b, "type", "") == "text"), "")

    def generer(self, invite: Invite) -> str:
        reponse = self._client.messages.create(**self.parametres(invite))  # type: ignore[attr-defined]
        if getattr(reponse, "stop_reason", None) == "refusal":
            raise ReponseInvalide("réponse refusée par le modèle (stop_reason: refusal)")
        return self._texte(reponse)

    def soumettre(self, requetes: Sequence[RequeteLot]) -> str:
        from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
        from anthropic.types.messages.batch_create_params import Request

        lot = self._client.messages.batches.create(  # type: ignore[attr-defined]
            requests=[
                Request(
                    custom_id=r.custom_id,
                    params=MessageCreateParamsNonStreaming(**self.parametres(r.invite)),  # type: ignore[typeddict-item]
                )
                for r in requetes
            ]
        )
        return str(lot.id)

    def statut_lot(self, lot: str) -> str:
        return str(self._client.messages.batches.retrieve(lot).processing_status)  # type: ignore[attr-defined]

    def resultats(self, lot: str) -> Iterator[ResultatLot]:
        for resultat in self._client.messages.batches.results(lot):  # type: ignore[attr-defined]
            if resultat.result.type == "succeeded":
                yield ResultatLot(resultat.custom_id, texte=self._texte(resultat.result.message))
            else:
                yield ResultatLot(resultat.custom_id, erreur=str(resultat.result.type))


def client_anthropic(
    classe: type[ClientAnthropic], modele: str = MODELE, max_tokens: int = MAX_TOKENS
) -> ClientAnthropic:
    """Client réel (SDK `anthropic`) de la classe donnée. Refuse de partir sans clé d'API."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise CleAbsente(
            "ANTHROPIC_API_KEY absent : aucun appel n'est fait et aucun fichier n'est écrit."
        )
    import anthropic

    return classe(anthropic.Anthropic(), modele=modele, max_tokens=max_tokens)


def client_ou_sortie(fabrique: Callable[[], ClientClaude]) -> ClientClaude:
    """Pour la CLI : le client, ou une sortie en code 2 qui dit pourquoi."""
    try:
        return fabrique()
    except CleAbsente as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=2) from erreur


# --------------------------------------------------------------------------- lots


def ecrire_lot(dossier_lots: Path, lot: dict[str, object]) -> Path:
    """Journalise un lot dans `<dossier_lots>/<lot>.json`."""
    fichier = dossier_lots / f"{lot['lot']}.json"
    fichier.parent.mkdir(parents=True, exist_ok=True)
    fichier.write_text(json.dumps(lot, ensure_ascii=False, indent=1), encoding="utf-8")
    return fichier


def marquer_recupere(fichier: Path, lot: dict[str, object], date: str) -> None:
    """Réécrit le journal d'un lot récupéré, daté."""
    lot["statut"] = RECUPERE
    lot["recupere"] = date
    fichier.write_text(json.dumps(lot, ensure_ascii=False, indent=1), encoding="utf-8")


def lots_en_cours(dossier_lots: Path) -> list[Path]:
    """Les journaux de lots encore `en_cours`, dans l'ordre des noms de fichier."""
    if not dossier_lots.exists():
        return []
    return [
        f
        for f in sorted(dossier_lots.glob("*.json"))
        if json.loads(f.read_text(encoding="utf-8")).get("statut") == EN_COURS
    ]
