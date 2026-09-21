"""Chemins du pipeline. `work/` est ignoré par git, `sources/listes/` est versionné."""
from __future__ import annotations

from pathlib import Path

DATA = Path(__file__).resolve().parents[2]
RACINE = DATA.parent

WORK = DATA / "work"
SOURCES = WORK / "sources"
INGEST = WORK / "ingest"
FONTES = WORK / "fonts"
BUILD = WORK / "build"
CONTES_WORK = WORK / "contes"

LISTES = DATA / "sources" / "listes"
CONTES = DATA / "sources" / "contes"
GF0014 = DATA / "sources" / "gf0014-2009"
EXPORT = RACINE / "app" / "public" / "data"
FONTES_APP = RACINE / "app" / "public" / "fonts"
TRAITS_APP = RACINE / "app" / "public" / "strokes-demo.json"
