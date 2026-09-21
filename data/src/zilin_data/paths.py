"""Chemins du pipeline. `work/` est ignoré par git, `sources/listes/` est versionné."""
from __future__ import annotations

from pathlib import Path

DATA = Path(__file__).resolve().parents[2]
RACINE = DATA.parent

WORK = DATA / "work"
SOURCES = WORK / "sources"
INGEST = WORK / "ingest"

LISTES = DATA / "sources" / "listes"
EXPORT = RACINE / "app" / "public" / "data"
