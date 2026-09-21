from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field

Role = Literal["son", "sens", "forme"]
Etiquette = Literal["atteste", "mnemotechnique"]


class Brique(BaseModel):
    """Composant selon GF 0014-2009 (514 composants)."""
    c: str
    pinyin: str
    fr: str
    en: str
    origine: str = ""
    etiquette: Etiquette = "atteste"


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
    role: Role
    origine_fr: str
    origine_en: str
    etiquette: Etiquette
    memo_fr: str | None = None
    memo_en: str | None = None
    mots: list[Mot] = Field(default_factory=list)
    phrase: Mot | None = None
    niveaux: dict[str, int] = Field(default_factory=dict, description="ex. {'seuil': 255, 'hsk': 1}")
    traits: list[str] = Field(default_factory=list)
    medianes: list[list[list[float]]] = Field(default_factory=list)
    audio: str | None = None


class Famille(BaseModel):
    racine: Brique
    fiches: list[Fiche]
    version: str
