"""Bilan d'un passage du workflow `donnees`, en Markdown sur la sortie standard.

Lancé depuis `data/` par `uv run python ../.github/scripts/donnees_resume.py`, après
les étapes du pipeline. Ne réécrit rien : il lit l'export audio, le manifeste de
travail, les fiches et les contes de `data/work/`, et compte. Variables lues :
`ETAPE`, `VERSION`, `PARCOURS`, `SEUIL`. Un chiffre illisible s'écrit « — », jamais
une erreur : ce bilan sert au diagnostic, y compris d'un passage qui a échoué.
"""
from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

from wenlu_data.audio import MANIFESTE_EXPORT, dossier_export, perimetre
from wenlu_data.fiches import dossier_lots
from wenlu_data.paths import AUDIO_WORK, CONTES_WORK, FICHES_WORK


def _json(chemin: Path) -> dict:
    try:
        document = json.loads(chemin.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return document if isinstance(document, dict) else {}


def _kio(octets: int) -> str:
    return f"{octets / 1024:,.0f} Kio".replace(",", " ")


def bilan_audio(version: str, parcours: str, seuil: int) -> list[str]:
    dossier = dossier_export(version)
    exporte = _json(dossier / MANIFESTE_EXPORT)
    chemins = exporte.get("chemins") or {}
    mp3 = sorted(dossier.glob("*.mp3"))
    taille = sum(f.stat().st_size for f in mp3)
    travail = _json(AUDIO_WORK / "audio.json").get("entrees") or []
    voix = sorted({e.get("voix", "") for e in travail if e.get("texte") in chemins}) or ["—"]
    try:
        cibles = [t.texte for t in perimetre(parcours, seuil)]
    except Exception as erreur:  # périmètre illisible : on le dit
        cibles, motif = [], str(erreur)
    else:
        motif = ""
    sans = [t for t in cibles if t not in chemins]
    lignes = [
        "### Audio",
        "",
        "| | |",
        "|---|---|",
        f"| Fichiers audio exportés (manifeste) | {len(chemins)} |",
        f"| Fichiers mp3 dans `app/public/data/{version}/audio/` | {len(mp3)} |",
        f"| Taille totale | {_kio(taille)} |",
        f"| Plus gros fichier | {_kio(max((f.stat().st_size for f in mp3), default=0))} |",
        f"| Textes du périmètre ({parcours}, seuil {seuil}) | {len(cibles) if cibles else '—'} |",
        f"| Textes restés sans audio | {len(sans) if cibles else '—'} |",
        f"| Voix utilisée | {', '.join(voix)} |",
        f"| Source déclarée | {exporte.get('source', '—')} |",
        "",
    ]
    if motif:
        lignes += [f"Périmètre illisible : {motif}", ""]
    if sans:
        lignes += [f"Sans audio : {' '.join(sans[:40])}{' …' if len(sans) > 40 else ''}", ""]
    return lignes


def bilan_textes(nom: str, dossier: Path, lots_dossier: Path | None = None) -> list[str]:
    statuts = Counter(
        _json(f).get("statut", "?")
        for f in sorted(dossier.rglob("*.json"))
        if "lots" not in f.relative_to(dossier).parts
    )
    lots = [_json(f) for f in sorted((lots_dossier or dossier / "lots").glob("*.json"))]
    en_cours = [str(lot.get("lot")) for lot in lots if lot.get("statut") == "en_cours"]
    lignes = [f"### {nom.capitalize()}", ""]
    if not statuts and not lots:
        return lignes + ["Aucun lot ni aucun texte.", ""]
    detail = ", ".join(f"{n} {s}" for s, n in sorted(statuts.items())) or "aucun"
    lignes += [
        f"- Textes écrits : {sum(statuts.values())} ({detail}).",
        f"- Lots journalisés : {len(lots)}, dont {len(en_cours)} en cours"
        + (f" : {', '.join(en_cours)}." if en_cours else "."),
        "- Relecture humaine obligatoire avant export : les textes sont dans l'artefact du run.",
        "",
    ]
    return lignes


def main() -> None:
    etape = os.environ.get("ETAPE", "audio")
    version = os.environ.get("VERSION", "")
    parcours = os.environ.get("PARCOURS", "lire")
    seuil = int(os.environ.get("SEUIL", "255") or 255)
    lignes: list[str] = []
    if etape in ("audio", "tout") and version:
        lignes += bilan_audio(version, parcours, seuil)
    if etape in ("fiches", "recuperer", "tout"):
        # Les fiches sont versionnées (data/sources/fiches), le journal des lots reste dans data/work.
        lignes += bilan_textes("fiches", FICHES_WORK, dossier_lots())
    if etape in ("contes", "recuperer", "tout"):
        lignes += bilan_textes("contes", CONTES_WORK)
    print("\n".join(lignes))


if __name__ == "__main__":
    main()
