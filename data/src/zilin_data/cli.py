"""zilin fetch | build | check | export

Chaque commande est idempotente et écrit dans data/work/. L'export final va dans app/public/data/.
"""
from __future__ import annotations

import json

import typer

from .paths import EXPORT, SOURCES

app = typer.Typer(help="Pipeline de contenu Zilin")


@app.command()
def fetch(force: bool = typer.Option(False, help="Retélécharger même si le fichier est présent.")) -> None:
    """Télécharge les sources (Make Me a Hanzi, CC-CEDICT) dans data/work/sources/."""
    from .fetch import fetch as _fetch

    etat = _fetch(force=force)
    for fichier, action in etat.items():
        typer.echo(f"{action} : {fichier}")
    typer.echo(f"Empreintes et journal dans {SOURCES}.")
    echecs = [f for f, action in etat.items() if action.startswith("échec")]
    if echecs:
        typer.echo(f"Sources non récupérées : {', '.join(echecs)}", err=True)
        raise typer.Exit(code=1)


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
    dest = EXPORT / version
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "index.json").write_text(json.dumps({"version": version, "familles": []}, ensure_ascii=False, indent=1))
    typer.echo(f"Export vide écrit dans {dest}.")


if __name__ == "__main__":
    app()
