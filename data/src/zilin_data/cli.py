"""zilin fetch | fonts | ingest | build | check | export

Chaque commande est idempotente et écrit dans data/work/. L'export final va dans app/public/data/.
"""
from __future__ import annotations

import json

import typer

from .contes import app as _contes
from .fonts import commande as _fonts
from .paths import BUILD, EXPORT, INGEST, SOURCES

app = typer.Typer(help="Pipeline de contenu Zilin")
app.command(name="fonts")(_fonts)
app.add_typer(_contes, name="contes")


@app.command()
def fetch(force: bool = typer.Option(False, help="Retélécharger même si le fichier est présent.")) -> None:
    """Télécharge les sources (Make Me a Hanzi, CC-CEDICT, Unihan, cjk-decomp) dans data/work/sources/."""
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
def ingest() -> None:
    """Normalise les sources et les listes de niveaux dans data/work/ingest/."""
    from .ingest import ingest as _ingest

    rapport = _ingest()
    for cle, valeur in rapport.items():
        typer.echo(f"{cle} : {valeur}")
    typer.echo(f"JSON normalisé dans {INGEST}.")


@app.command()
def build() -> None:
    """Réconcilie les décompositions, construit le graphe et les parcours dans data/work/build/."""
    from .gf0014 import build as _build
    from .graphe import build as _graphe

    rapport = _build()
    for cle, valeur in rapport.items():
        typer.echo(f"{cle} : {valeur}")
    for cle, valeur in _graphe().items():
        typer.echo(f"{cle} : {valeur}")
    typer.echo(f"Décompositions, écarts, graphe et parcours dans {BUILD}.")


@app.command()
def check() -> None:
    """Contrôles : composants inconnus, cycles, graphe, couverture des listes, briques muettes, contes hors liste."""
    from .contes import controles as controles_contes
    from .gf0014 import controles
    from .graphe import controles as controles_graphe

    bloquants = []
    for controle in [*controles(), *controles_graphe(), *controles_contes()]:
        typer.echo(f"{'ok   ' if controle.ok else 'écart'} {controle.nom} : {controle.detail}")
        if not controle.ok and controle.bloquant:
            bloquants.append(controle.nom)
    typer.echo(f"Rapport d'écarts : {BUILD / 'ecarts.md'}.")
    if bloquants:
        typer.echo(f"Contrôles bloquants en échec : {', '.join(bloquants)}", err=True)
        raise typer.Exit(code=1)


@app.command()
def export(version: str = "0.1.0") -> None:
    """Exporte un JSON par famille dans app/public/data/<version>/."""
    dest = EXPORT / version
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "index.json").write_text(json.dumps({"version": version, "familles": []}, ensure_ascii=False, indent=1))
    typer.echo(f"Export vide écrit dans {dest}.")


if __name__ == "__main__":
    app()
