"""zilin fetch | fonts | ingest | build | audio | check | export

Chaque commande est idempotente et écrit dans data/work/. L'export final va dans app/public/data/.
"""
from __future__ import annotations

import typer

from .audio import app as _audio
from .contes import app as _contes
from .export import VERSION
from .fiches import app as _fiches
from .fonts import commande as _fonts
from .paths import BUILD, INGEST, SOURCES

app = typer.Typer(help="Pipeline de contenu Zilin")
app.command(name="fonts")(_fonts)
app.add_typer(_audio, name="audio")
app.add_typer(_contes, name="contes")
app.add_typer(_fiches, name="fiches")


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
    """Contrôles : composants inconnus, cycles, graphe, listes, briques muettes, contes hors liste, fiches invalides, textes sans audio, export à jour."""
    from .audio import controles as controles_audio
    from .contes import controles as controles_contes
    from .export import controles as controles_export
    from .fiches import controles as controles_fiches
    from .gf0014 import controles
    from .graphe import controles as controles_graphe

    bloquants = []
    for controle in [
        *controles(),
        *controles_graphe(),
        *controles_contes(),
        *controles_fiches(),
        *controles_audio(),
        *controles_export(),
    ]:
        typer.echo(f"{'ok   ' if controle.ok else 'écart'} {controle.nom} : {controle.detail}")
        if not controle.ok and controle.bloquant:
            bloquants.append(controle.nom)
    typer.echo(f"Rapport d'écarts : {BUILD / 'ecarts.md'}.")
    if bloquants:
        typer.echo(f"Contrôles bloquants en échec : {', '.join(bloquants)}", err=True)
        raise typer.Exit(code=1)


@app.command()
def export(version: str = typer.Option(VERSION, help="Version exportée, en dossier.")) -> None:
    """Exporte l'index, les familles, les traits, les contes et les licences dans app/public/data/<version>/."""
    from .export import ExportImpossible, export as _export

    try:
        rapport = _export(version)
    except ExportImpossible as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    for cle, valeur in rapport.en_lignes().items():
        typer.echo(f"{cle} : {valeur}")
    if rapport.fiches_relues == 0:
        typer.echo("Aucune fiche relue : les fiches exportées sont vides (statut sans_fiche).")
    typer.echo(f"Export écrit dans {rapport.dossier}.")


if __name__ == "__main__":
    app()
