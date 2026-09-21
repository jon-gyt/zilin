from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field

Role = Literal["son", "sens", "forme"]
Etiquette = Literal["atteste", "mnemotechnique"]
#: `relu` : la fiche a passé la relecture humaine et porte ses textes.
#: `sans_fiche` : le caractère s'exporte pour sa décomposition et ses traits,
#: sans aucun texte — il n'y a pas encore de fiche relue pour lui (brief §17).
Statut = Literal["relu", "sans_fiche"]
#: D'où vient la chaîne IDS descendue pour la décomposition (traçabilité de licence).
SourceIds = Literal["makemeahanzi", "cjk-decomp"]


class Brique(BaseModel):
    """Composant selon GF 0014-2009 (514 composants)."""
    c: str
    pinyin: str
    fr: str
    en: str
    origine: str = ""
    etiquette: Etiquette | None = None


class Mot(BaseModel):
    hanzi: str
    pinyin: str
    fr: str
    en: str
    audio: str | None = None


class Fiche(BaseModel):
    c: str
    pinyin: str
    fr: str
    en: str
    parts: list[str] = Field(description="décomposition canonique, ordre d'écriture")
    nouveau: list[int] = Field(default_factory=list, description="index des éléments ajoutés par rapport à la brique parente")
    sources: list[SourceIds] = Field(default_factory=list, description="sources d'IDS descendues pour la décomposition")
    role: Role | None = Field(default=None, description="rôle de l'élément ajouté ; nul tant qu'aucune fiche n'est relue")
    roles: dict[str, Role] = Field(default_factory=dict, description="rôle de chaque brique de la décomposition")
    origine_fr: str
    origine_en: str
    etiquette: Etiquette | None = Field(default=None, description="nulle sans origine : jamais d'étiquette sans texte")
    memo_fr: str | None = None
    memo_en: str | None = None
    mots: list[Mot] = Field(default_factory=list)
    phrase: Mot | None = None
    niveaux: dict[str, int] = Field(default_factory=dict, description="ex. {'seuil': 255, 'hsk': 1}")
    traits: list[str] = Field(default_factory=list, description="vide dans l'export : les tracés sont dans traits/ (Arphic Public License)")
    medianes: list[list[list[float]]] = Field(default_factory=list, description="vide dans l'export, comme traits")
    audio: str | None = None
    statut: Statut = "sans_fiche"


class Famille(BaseModel):
    racine: Brique
    fiches: list[Fiche]
    version: str
