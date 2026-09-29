"""Ligne de commande du pipeline de contenu Wenlu.

Ordre et dépendances — chaque étape lit ce que la précédente a écrit :

    fetch  →  ingest  →  build  →  export  →  check
                                    ↘  fonts

- `fetch` : télécharge les sources dans `data/work/sources/`. Ne dépend de rien.
- `ingest` : normalise ces sources et les listes de niveaux dans `data/work/ingest/`.
  Exige `fetch`.
- `build` : découpe dans un hôte les composants que `graphics.txt` ne dessine pas,
  réconcilie les décompositions avec GF 0014-2009, construit le graphe et les
  parcours dans `data/work/build/`, dans l'ordre figé de `data/sources/parcours/`.
  Exige `ingest`.
- `export` : assemble `app/public/data/<version>/`, les seuls fichiers que l'app lira.
  Exige `build`.
- `fonts` : produit les woff2 de `app/public/fonts/`. À lancer après `export`, qui
  seul dit quels caractères l'app écrit ; il lit aussi les listes versionnées et
  `app/public/strokes-demo.json`.
- `check` : contrôles qualité sur tout ce qui précède. Ne réécrit rien.
- `licences` : recette de la licence des décompositions exportées, caractère par
  caractère (`docs/licences-decompositions.md`) : aucune ne descend `dictionary.txt`.
  Après `export`. Hors de `tout`, comme `fonts` ; `check` en refait le contrôle bloquant.
- `tout` : enchaîne fetch, ingest, build, export, check et s'arrête à la première erreur.

`listes mots` écrit la liste des mots du HSK 3.0 (`data/sources/listes/hsk-mots.tsv`)
depuis les sources que `fetch` télécharge ; comme `parcours figer`, il se lance à la main
et son diff se relit.

`parcours figer` écrit l'ordre figé de chaque parcours (`data/sources/parcours/`), que
`build` lit et valide au lieu de le recalculer : il se lance à la main, et son diff se
relit avant d'être versionné.

`audio`, `contes` et `fiches` sont des familles de commandes à part : elles demandent
une clé d'API et se lancent à la main, jamais dans `tout`. `fetes calendrier` et
`saisons calendrier` aussi se lancent à la main : ils recalculent les dates des fêtes
(`data/sources/fetes/`) et des vingt-quatre termes solaires (`data/sources/saisons/`),
des sources versionnées que `export` lit. `devinettes apercu` et `devinettes a-rediger`
servent à relire et à compléter la base des devinettes, qu'`export` lit aussi ;
`eclair apercu` montre les mots du dictionnaire éclair et leurs leurres.
`coquilles apercu` relit les messages de la coquille.
`cuisine apercu` à relire les recettes de la cuisine de Tao.
`lettres` rédige sans API, importe et relit les lettres de Que (contexte, importer,
exporter-relecture, appliquer-relecture, apercu), qu'`export` lit une fois relues.
`wechat apercu` relit les dialogues du message WeChat.
`trois-lignes` donne le contexte de rédaction des trois lignes du pas Utiliser (l'acquis
et les caractères nouveaux d'un jour du chemin) et les relit (apercu).
`examens` donne le contexte de rédaction des séries d'un examen 科举 ou d'un 月课 (le jour
du palier, l'acquis, le tronçon) et les relit (apercu).

Toutes les commandes sont idempotentes : deux passages écrivent les mêmes octets.
Seul `data/work/sources/PROVENANCE.md` s'allonge, d'un bloc daté par passage.

Codes de sortie, les mêmes partout : 0 tout va bien, 1 erreur de données (source
absente, contrôle bloquant en échec, caractère hors parcours), 2 clé d'API absente.
"""
from __future__ import annotations

import typer

from .audio import app as _audio
from .contes import app as _contes
from .coquilles import app as _coquilles
from .cuisine import app as _cuisine
from .devinettes import app as _devinettes
from .eclair import app as _eclair
from .examens import app as _examens
from .export import VERSION
from .fetes import app as _fetes
from .fiches import app as _fiches
from .fonts import commande as _fonts
from .lettres import app as _lettres
from .paths import BUILD, INGEST, SOURCES
from .saisons import app as _saisons
from .trois_lignes import app as _trois_lignes
from .wechat import app as _wechat

app = typer.Typer(help="Pipeline de contenu Wenlu")


@app.command()
def fetch(force: bool = typer.Option(False, help="Retélécharger même si le fichier est présent.")) -> None:
    """Télécharge les sources (Make Me a Hanzi, CC-CEDICT, Unihan, cjk-decomp, listes HSK 3.0 des mots) dans data/work/sources/."""
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
    """Découpe les composants sans tracé, réconcilie les décompositions, construit le graphe et les parcours dans data/work/build/. Exige `ingest`."""
    from .decoupes import DecoupeInvalide, build as _decoupes
    from .gf0014 import build as _build
    from .graphe import build as _graphe

    from .graphe import OrdreInvalide

    try:
        # Les découpes d'abord : la réconciliation fait une brique de chaque composant découpé.
        rapport = {**_decoupes(), **_build()}
        suite = _graphe()
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu ingest` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    except (DecoupeInvalide, OrdreInvalide) as erreur:
        typer.echo(str(erreur), err=True)
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
    """Exporte l'index, les familles, les traits, les contes, l'aperçu des textes à relire et les licences dans app/public/data/<version>/. Exige `build`."""
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


_parcours = typer.Typer(help="Ordre figé des parcours (data/sources/parcours/).")


@_parcours.command("figer")
def parcours_figer(
    recalculer: bool = typer.Option(
        False, help="Écrire l'ordre que le calcul propose aujourd'hui au lieu de celui du build."
    ),
    nom: list[str] = typer.Option([], help="Parcours à figer (lire, hsk) ; tous par défaut."),
) -> None:
    """Écrit data/sources/parcours/ordre-<nom>.tsv. Exige `build`. Relire le diff avant de versionner."""
    from .graphe import figer

    try:
        ecrits = figer(recalculer=recalculer, noms=nom or None)
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu build` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    for cle, chemin in ecrits.items():
        typer.echo(f"{cle} : {chemin}")
    typer.echo("Relire le diff, puis relancer `wenlu build` : il lira ces ordres.")


app.add_typer(_parcours, name="parcours")


_listes = typer.Typer(help="Listes de référence versionnées (data/sources/listes/).")


@_listes.command("mots")
def listes_mots() -> None:
    """Écrit data/sources/listes/hsk-mots.tsv depuis ivankra/hsk30 (MIT), contrôlée contre elkmovie/hsk30. Exige `fetch` et `ingest`. Relire le diff avant de versionner."""
    from .mots_hsk import ListeInvalide, generer

    try:
        rapport = generer()
    except (OSError, ListeInvalide) as erreur:
        typer.echo(f"{erreur} — lancer `wenlu fetch` puis `wenlu ingest` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    for cle, valeur in rapport.items():
        typer.echo(f"{cle} : {valeur}")


app.add_typer(_listes, name="listes")


# Après `export` : c'est lui qui dit quels caractères l'app écrit.
app.command(name="fonts")(_fonts)


@app.command()
def licences() -> None:
    """Recette de la licence des décompositions exportées (docs/licences-decompositions.md). Exige `export`."""
    from .licences import InventaireImpossible, licences as _licences

    try:
        rapport = _licences()
    except InventaireImpossible as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    for cle, valeur in rapport.items():
        typer.echo(f"{cle} : {valeur}")


@app.command()
def check() -> None:
    """Contrôles : composants inconnus, cycles, graphe, listes, liste des mots HSK 3.0, briques muettes, découpes, contes hors liste, fiches invalides, rôle son loin de la lecture moderne, textes sans audio, export à jour, aperçu des textes à relire, fêtes, termes solaires, devinettes, dictionnaire éclair, coquilles, cuisine, lettres de Que, message WeChat, personnage, phrases de Tao à Jouer, lignes du rythme gratuit, calendrier d'ouverture, anecdotes du jour, trois lignes du pas Utiliser, examens 科举, fuites de réponse, image du chemin (ni graine, ni forêt, ni borne, ni stèle), licence des décompositions."""
    from .anecdotes import controles as controles_anecdotes
    from .audio import controles as controles_audio
    from .contes import controles as controles_contes
    from .decoupes import controles as controles_decoupes
    from .coquilles import controles as controles_coquilles
    from .cuisine import controles as controles_cuisine
    from .devinettes import controles as controles_devinettes
    from .eclair import controles as controles_eclair
    from .examens import controles as controles_examens
    from .export import controles as controles_export
    from .fetes import controles as controles_fetes
    from .fiches import controles as controles_fiches
    from .fuites import controles as controles_fuites
    from .gf0014 import controles
    from .heros import controles as controles_heros
    from .jouer import controles as controles_jouer
    from .ecrans import controles as controles_ecrans
    from .graphe import controles as controles_graphe
    from .lettres import controles as controles_lettres
    from .licences import controles as controles_licences
    from .mots_hsk import controles as controles_mots_hsk
    from .phonetiques import controles as controles_phonetiques
    from .rythme import controles as controles_rythme
    from .rappels import controles as controles_rappels
    from .ouvertures import controles as controles_ouvertures
    from .saisons import controles as controles_saisons
    from .tons import controles as controles_tons
    from .trois_lignes import controles as controles_trois_lignes
    from .vocabulaire import controles as controles_vocabulaire
    from .wechat import controles as controles_wechat

    bloquants = []
    for controle in [
        *controles(),
        *controles_graphe(),
        *controles_mots_hsk(),
        *controles_decoupes(),
        *controles_contes(),
        *controles_fiches(),
        *controles_phonetiques(),
        *controles_audio(),
        *controles_export(),
        *controles_licences(),
        *controles_fetes(),
        *controles_saisons(),
        *controles_devinettes(),
        *controles_eclair(),
        *controles_coquilles(),
        *controles_cuisine(),
        *controles_lettres(),
        *controles_wechat(),
        *controles_heros(),
        *controles_jouer(),
        *controles_rythme(),
        *controles_rappels(),
        *controles_ouvertures(),
        *controles_ecrans(),
        *controles_anecdotes(),
        *controles_trois_lignes(),
        *controles_examens(),
        *controles_tons(),
        *controles_fuites(),
        *controles_vocabulaire(),
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
app.add_typer(_coquilles, name="coquilles")
app.add_typer(_cuisine, name="cuisine")
app.add_typer(_devinettes, name="devinettes")
app.add_typer(_eclair, name="eclair")
app.add_typer(_examens, name="examens")
app.add_typer(_fetes, name="fetes")
app.add_typer(_fiches, name="fiches")
app.add_typer(_lettres, name="lettres")
app.add_typer(_saisons, name="saisons")
app.add_typer(_trois_lignes, name="trois-lignes")
app.add_typer(_wechat, name="wechat")


if __name__ == "__main__":
    app()
