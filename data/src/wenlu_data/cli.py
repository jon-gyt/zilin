"""Ligne de commande du pipeline de contenu Wenlu.

Ordre et dépendances — chaque étape lit ce que la précédente a écrit :

    fetch  →  ingest  →  build  →  export  →  check
                                    ↘  fonts

- `fetch` : télécharge les sources dans `data/work/sources/`. Ne dépend de rien.
- `ingest` : normalise ces sources et les listes de niveaux dans `data/work/ingest/`.
  Exige `fetch`.
- `build` : réconcilie les décompositions avec GF 0014-2009, construit le graphe et
  les parcours dans `data/work/build/`. Exige `ingest`.
- `export` : assemble `app/public/data/<version>/`, les seuls fichiers que l'app lira.
  Exige `build`.
- `fonts` : produit les woff2 de `app/public/fonts/`. À lancer après `export`, qui
  seul dit quels caractères l'app écrit ; il lit aussi les listes versionnées et
  `app/public/strokes-demo.json`.
- `check` : contrôles qualité sur tout ce qui précède. Ne réécrit rien.
- `tout` : enchaîne fetch, ingest, build, export, check et s'arrête à la première erreur.

`audio`, `contes` et `fiches` sont des familles de commandes à part : elles demandent
une clé d'API et se lancent à la main, jamais dans `tout`. `fetes calendrier` et
`saisons calendrier` aussi se lancent à la main : ils recalculent les dates des fêtes
(`data/sources/fetes/`) et des vingt-quatre termes solaires (`data/sources/saisons/`),
des sources versionnées que `export` lit. `devinettes apercu` et `devinettes a-rediger`
servent à relire et à compléter la base des devinettes, qu'`export` lit aussi.

Toutes les commandes sont idempotentes : deux passages écrivent les mêmes octets.
Seul `data/work/sources/PROVENANCE.md` s'allonge, d'un bloc daté par passage.

Codes de sortie, les mêmes partout : 0 tout va bien, 1 erreur de données (source
absente, contrôle bloquant en échec, caractère hors parcours), 2 clé d'API absente.
"""
from __future__ import annotations

import typer

from .audio import app as _audio
from .contes import app as _contes
from .devinettes import app as _devinettes
from .export import VERSION
from .fetes import app as _fetes
from .fiches import app as _fiches
from .fonts import commande as _fonts
from .paths import BUILD, INGEST, SOURCES
from .saisons import app as _saisons

app = typer.Typer(help="Pipeline de contenu Wenlu")


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
    """Normalise les sources et les listes de niveaux dans data/work/ingest/. Exige `fetch`."""
    from .ingest import ingest as _ingest

    try:
        rapport = _ingest()
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu fetch` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    for cle, valeur in rapport.items():
        typer.echo(f"{cle} : {valeur}")
    typer.echo(f"JSON normalisé dans {INGEST}.")


@app.command()
def build() -> None:
    """Réconcilie les décompositions, construit le graphe et les parcours dans data/work/build/. Exige `ingest`."""
    from .gf0014 import build as _build
    from .graphe import build as _graphe

    try:
        rapport = _build()
        suite = _graphe()
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu ingest` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    # Deux rapports, deux boucles : `cycles` figure dans les deux et une fusion
    # en perdrait un.
    for cle, valeur in rapport.items():
        typer.echo(f"{cle} : {valeur}")
    for cle, valeur in suite.items():
        typer.echo(f"{cle} : {valeur}")
    typer.echo(f"Décompositions, écarts, graphe et parcours dans {BUILD}.")



@app.command()
def export(version: str = typer.Option(VERSION, help="Version exportée, en dossier.")) -> None:
    """Exporte l'index, les familles, les traits, les contes et les licences dans app/public/data/<version>/. Exige `build`."""
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


# Après `export` : c'est lui qui dit quels caractères l'app écrit.
app.command(name="fonts")(_fonts)


@app.command()
def check() -> None:
    """Contrôles : composants inconnus, cycles, graphe, listes, briques muettes, contes hors liste, fiches invalides, rôle son loin de la lecture moderne, textes sans audio, export à jour, fêtes, termes solaires, devinettes."""
    from .audio import controles as controles_audio
    from .contes import controles as controles_contes
    from .devinettes import controles as controles_devinettes
    from .export import controles as controles_export
    from .fetes import controles as controles_fetes
    from .fiches import controles as controles_fiches
    from .gf0014 import controles
    from .graphe import controles as controles_graphe
    from .phonetiques import controles as controles_phonetiques
    from .saisons import controles as controles_saisons

    bloquants = []
    for controle in [
        *controles(),
        *controles_graphe(),
        *controles_contes(),
        *controles_fiches(),
        *controles_phonetiques(),
        *controles_audio(),
        *controles_export(),
        *controles_fetes(),
        *controles_saisons(),
        *controles_devinettes(),
    ]:
        typer.echo(f"{'ok   ' if controle.ok else 'écart'} {controle.nom} : {controle.detail}")
        if not controle.ok and controle.bloquant:
            bloquants.append(controle.nom)
    typer.echo(f"Rapport d'écarts : {BUILD / 'ecarts.md'}.")
    if bloquants:
        typer.echo(f"Contrôles bloquants en échec : {', '.join(bloquants)}", err=True)
        raise typer.Exit(code=1)


#: Les étapes de `wenlu tout`, dans l'ordre de leurs dépendances. `fonts` n'en est
#: pas : il télécharge trois familles de polices et pèse une minute de calcul, pour
#: un résultat qui ne bouge que si le périmètre exporté change.
ETAPES = ("fetch", "ingest", "build", "export", "check")


@app.command()
def tout(
    version: str = typer.Option(VERSION, help="Version exportée, en dossier."),
    force: bool = typer.Option(False, help="Retélécharger les sources déjà présentes."),
) -> None:
    """Enchaîne fetch, ingest, build, export et check. S'arrête à la première erreur.

    Idempotent, comme chacune des étapes : un second passage ne retélécharge rien
    et réécrit les mêmes octets. `fonts` n'en fait pas partie.
    """
    etapes = {
        "fetch": lambda: fetch(force=force),
        "ingest": ingest,
        "build": build,
        "export": lambda: export(version),
        "check": check,
    }
    for nom in ETAPES:
        typer.echo(f"── wenlu {nom}")
        etapes[nom]()
    typer.echo(f"── {len(ETAPES)} étapes menées à bien.")


app.add_typer(_audio, name="audio")
app.add_typer(_contes, name="contes")
app.add_typer(_devinettes, name="devinettes")
app.add_typer(_fetes, name="fetes")
app.add_typer(_fiches, name="fiches")
app.add_typer(_saisons, name="saisons")


if __name__ == "__main__":
    app()
