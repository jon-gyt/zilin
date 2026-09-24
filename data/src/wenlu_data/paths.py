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
AUDIO_WORK = WORK / "audio"

LISTES = DATA / "sources" / "listes"
#: Les fiches sont versionnées, hors de `work/` ; le nom est historique.
FICHES_WORK = DATA / "sources" / "fiches"
#: Les versions de contes sont versionnées, hors de `work/` ; le nom est historique.
#: Le journal des lots d'API, lui, reste dans `work/contes/lots/`.
CONTES_WORK = DATA / "sources" / "contes-versions"
INTERFACE = DATA / "sources" / "interface" / "caracteres.txt"
CONTES = DATA / "sources" / "contes"
GF0014 = DATA / "sources" / "gf0014-2009"
EXPORT = RACINE / "app" / "public" / "data"
FONTES_APP = RACINE / "app" / "public" / "fonts"
TRAITS_APP = RACINE / "app" / "public" / "strokes-demo.json"
