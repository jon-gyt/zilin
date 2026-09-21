"""zilin fetch | build | check | export

Chaque commande est idempotente et écrit dans data/work/. L'export final va dans app/public/data/.
"""
from __future__ import annotations
import json
from pathlib import Path
import typer

app = typer.Typer(help="Pipeline de contenu Zilin")
WORK = Path(__file__).resolve().parents[2] / "work"
OUT = Path(__file__).resolve().parents[3] / "app" / "public" / "data"


@app.command()
def fetch() -> None:
    """Télécharge les sources (Make Me a Hanzi, hanzi-writer-data, CC-CEDICT, listes) dans data/work/sources/."""
    WORK.joinpath("sources").mkdir(parents=True, exist_ok=True)
    typer.echo("À implémenter : téléchargement et empreinte SHA-256 de chaque source (story 1.1).")


@app.command()
def build(parcours: str = "lire") -> None:
    """Construit le graphe de dépendances et l'ordre d'apprentissage (story 1.2, 1.3)."""
    typer.echo(f"À implémenter : graphe pour le parcours {parcours}.")


@app.command()
def check() -> None:
    """Contrôles : composants inconnus, cycles, doublons, fiches sans étiquette, longueur des origines (3 phrases)."""
    typer.echo("À implémenter : rapport dans data/work/check.md.")


@app.command()
def export(version: str = "0.1.0") -> None:
    """Exporte un JSON par famille dans app/public/data/<version>/."""
    dest = OUT / version
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "index.json").write_text(json.dumps({"version": version, "familles": []}, ensure_ascii=False, indent=1))
    typer.echo(f"Export vide écrit dans {dest}.")


if __name__ == "__main__":
    app()
