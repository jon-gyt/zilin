"""Polices auto-hébergées : sources dans data/work/fonts/, woff2 dans app/public/fonts/.

La règle produit interdit toute requête réseau à l'exécution : pas de Google Fonts,
les trois familles de la charte sont servies avec les assets de l'app.

`uv run zilin fonts` télécharge les fichiers d'origine (idempotent, SHA-256 et journal
de provenance écrits par les fonctions de `fetch.py`), puis produit avec fonttools :

- Manrope 500 et 700, Source Sans 3 400 et 600, en sous-ensemble latin étendu ;
- Noto Serif SC 500, réduit aux seuls caractères que l'app affiche.

Toutes les sources sont sous SIL Open Font License 1.1 ; le texte de licence de chaque
famille est copié tel quel à côté des woff2.
"""
from __future__ import annotations

import json
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from .fetch import Source, ecrire_sommes, journaliser, telecharger
from .paths import FONTES, FONTES_APP, LISTES, TRAITS_APP

GF = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
ADOBE = "https://github.com/adobe-fonts/source-sans/releases/download/3.052R/"
ADOBE_LICENCE = "https://raw.githubusercontent.com/adobe-fonts/source-sans/release/LICENSE.md"

OFL = "SIL Open Font License 1.1"

#: Fichiers à télécharger dans data/work/fonts/.
POLICES_DISTANTES: tuple[Source, ...] = (
    Source(
        nom="Manrope (variable)",
        fichier="Manrope[wght].ttf",
        url=GF + "manrope/Manrope%5Bwght%5D.ttf",
        licence=OFL,
    ),
    Source(
        nom="Manrope — licence",
        fichier="OFL-Manrope.txt",
        url=GF + "manrope/OFL.txt",
        licence=OFL,
    ),
    Source(
        nom="Source Sans 3 (archive OTF 3.052R)",
        fichier="OTF-source-sans-3.052R.zip",
        url=ADOBE + "OTF-source-sans-3.052R.zip",
        licence=OFL,
    ),
    Source(
        nom="Source Sans 3 — licence",
        fichier="OFL-SourceSans3.txt",
        url=ADOBE_LICENCE,
        licence=OFL,
    ),
    Source(
        nom="Noto Serif SC (variable)",
        fichier="NotoSerifSC[wght].ttf",
        url=GF + "notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
        licence=OFL,
    ),
    Source(
        nom="Noto Serif SC — licence",
        fichier="OFL-NotoSerifSC.txt",
        url=GF + "notoserifsc/OFL.txt",
        licence=OFL,
    ),
)

#: Textes de licence copiés tels quels à côté des woff2 (obligation OFL 1.1).
LICENCES = ("OFL-Manrope.txt", "OFL-SourceSans3.txt", "OFL-NotoSerifSC.txt")


@dataclass(frozen=True)
class Fonte:
    """Un woff2 à produire."""

    sortie: str
    source: str
    graisse: int
    jeu: str
    membre: str | None = None  # chemin dans l'archive, si la source est un zip
    variable: bool = False


FONTES_A_PRODUIRE: tuple[Fonte, ...] = (
    Fonte(sortie="manrope-500.woff2", source="Manrope[wght].ttf", graisse=500, jeu="latin", variable=True),
    Fonte(sortie="manrope-700.woff2", source="Manrope[wght].ttf", graisse=700, jeu="latin", variable=True),
    Fonte(
        sortie="source-sans-3-400.woff2",
        source="OTF-source-sans-3.052R.zip",
        membre="OTF/SourceSans3-Regular.otf",
        graisse=400,
        jeu="latin",
    ),
    Fonte(
        sortie="source-sans-3-600.woff2",
        source="OTF-source-sans-3.052R.zip",
        membre="OTF/SourceSans3-Semibold.otf",
        graisse=600,
        jeu="latin",
    ),
    Fonte(
        sortie="noto-serif-sc-500.woff2",
        source="NotoSerifSC[wght].ttf",
        graisse=500,
        jeu="chinois",
        variable=True,
    ),
)

#: Liste rejouable des caractères retenus pour le chinois.
SOUS_ENSEMBLE = "noto-serif-sc.subset.txt"

# --- Sous-ensemble latin -----------------------------------------------------

#: Ponctuation et symboles hors Latin-1 et Latin Extended-A dont l'app a besoin.
LATIN_EN_PLUS = (
    "‐‑–—"  # tirets : trait d'union, insécable, demi-cadratin, cadratin
    "‘’‚“”„"  # apostrophes et guillemets courbes
    "‹›"  # chevrons simples
    "…"  # points de suspension
    "    "  # espaces : chiffre, fine, ultrafine, fine insécable
    "•‰⁄№™"  # puce, pour mille, barre de fraction, numéro, marque
    "−←→↑↓✓"  # moins, flèches, coche
)


def sous_ensemble_latin() -> str:
    """Latin-1 imprimable + Latin Extended-A + la ponctuation typographique française.

    Les guillemets français « » et l'espace insécable sont dans Latin-1 ; les apostrophes
    typographiques, tirets, points de suspension et espaces fines viennent de `LATIN_EN_PLUS`.
    """
    points = set(range(0x20, 0x7F))  # ASCII imprimable
    points |= set(range(0xA0, 0x100))  # Latin-1 : accents, « », insécable
    points |= set(range(0x100, 0x180))  # Latin Extended-A : œ, ō, ł…
    points |= {ord(c) for c in LATIN_EN_PLUS}
    return "".join(chr(p) for p in sorted(points))


# --- Sous-ensemble chinois ---------------------------------------------------

#: Ponctuation chinoise courante, telle que la charte éditoriale la demande.
PONCTUATION_CHINOISE = "。，、；：？！「」『』（）《》—…·"

CHIFFRES = "0123456789"


def caracteres_de_liste(texte: str) -> set[str]:
    """Caractères d'une liste `data/sources/listes/*.txt` : un par ligne, `#` commente."""
    trouves: set[str] = set()
    for brute in texte.splitlines():
        ligne = brute.strip()
        if not ligne or ligne.startswith("#"):
            continue
        trouves.update(c for c in ligne if not c.isspace())
    return trouves


def sous_ensemble_chinois(cles_traits: Iterable[str], listes: Iterable[str]) -> str:
    """Caractères à embarquer dans Noto Serif SC, dédoublonnés et triés par point de code.

    `cles_traits` : les clés du JSON de tracés (caractères et composants affichés par l'app).
    `listes` : le texte brut de chaque liste de niveau.
    La ponctuation chinoise courante et les chiffres sont toujours ajoutés.
    """
    caracteres: set[str] = set()
    for cle in cles_traits:
        caracteres.update(c for c in cle if not c.isspace())
    for texte in listes:
        caracteres |= caracteres_de_liste(texte)
    caracteres |= set(PONCTUATION_CHINOISE)
    caracteres |= set(CHIFFRES)
    return "".join(sorted(caracteres))


def caracteres_de_lapp(traits: Path | None = None, listes: Path | None = None) -> str:
    """Le sous-ensemble chinois, lu depuis les fichiers du dépôt."""
    traits = traits or TRAITS_APP
    listes = listes or LISTES
    cles = json.loads(traits.read_text(encoding="utf-8")).keys() if traits.exists() else []
    textes = [f.read_text(encoding="utf-8") for f in sorted(listes.glob("*.txt"))]
    return sous_ensemble_chinois(cles, textes)


def ecrire_sous_ensemble(chemin: Path, caracteres: str) -> Path:
    """Écrit la liste des caractères retenus, pour que le woff2 soit rejouable."""
    chemin.write_text(
        "# Caractères embarqués dans noto-serif-sc-500.woff2, écrit par `uv run zilin fonts`.\n"
        "# Origine : clés de app/public/strokes-demo.json, listes data/sources/listes/*.txt,\n"
        "# ponctuation chinoise courante et chiffres.\n"
        f"{caracteres}\n",
        encoding="utf-8",
    )
    return chemin


# --- Production des woff2 ----------------------------------------------------


def _ouvrir(fonte: Fonte, dossier: Path):
    """Charge la fonte source, depuis un fichier ou depuis un membre d'archive.

    `recalcTimestamp=False` garde la date de `head` d'origine : sans cela, deux passages
    produiraient deux woff2 différents et le dépôt bougerait à chaque régénération.
    """
    from fontTools.ttLib import TTFont

    chemin = dossier / fonte.source
    if fonte.membre:
        with zipfile.ZipFile(chemin) as archive:
            return TTFont(BytesIO(archive.read(fonte.membre)), recalcTimestamp=False)
    return TTFont(chemin, recalcTimestamp=False)


def produire(fonte: Fonte, caracteres: str, dossier: Path, dest: Path) -> int:
    """Sous-ensemble `fonte` sur `caracteres`, fige l'axe wght, écrit le woff2. Rend sa taille."""
    from fontTools import subset
    from fontTools.varLib.instancer import instantiateVariableFont

    police = _ouvrir(fonte, dossier)
    options = subset.Options()
    options.flavor = "woff2"
    options.desubroutinize = False
    options.layout_features = ["*"]
    options.name_IDs = ["*"]  # garde la notice de licence embarquée (nameID 13 et 14)
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables += ["DSIG"]
    subsetteur = subset.Subsetter(options=options)
    subsetteur.populate(text=caracteres)
    subsetteur.subset(police)
    if fonte.variable:
        # après le sous-ensemble : instancier les 25 Mo de gvar de Noto serait inutile
        instantiateVariableFont(police, {"wght": fonte.graisse}, updateFontNames=True, inplace=True)
    police["OS/2"].usWeightClass = fonte.graisse
    police.flavor = "woff2"
    dest.parent.mkdir(parents=True, exist_ok=True)
    police.save(dest)
    police.close()
    return dest.stat().st_size


def commande(force: bool = False) -> None:
    """Télécharge les polices de la charte et écrit les woff2 dans app/public/fonts/."""
    import typer

    etat = fonts(force=force)
    for fichier, action in etat.items():
        typer.echo(f"{action} : {fichier}")
    typer.echo(f"Sources et empreintes dans {FONTES}, woff2 dans {FONTES_APP}.")
    echecs = [f for f, action in etat.items() if action.startswith("échec")]
    if echecs:
        typer.echo(f"Polices non récupérées : {', '.join(echecs)}", err=True)
        raise typer.Exit(code=1)


def fonts(*, force: bool = False, dossier: Path | None = None, sortie: Path | None = None) -> dict[str, str]:
    """Télécharge les sources puis écrit les woff2 et les licences. Rend {fichier: état}."""
    dossier = dossier or FONTES
    sortie = sortie or FONTES_APP
    dossier.mkdir(parents=True, exist_ok=True)
    etat = {s.fichier: telecharger(s, dossier / s.fichier, force=force) for s in POLICES_DISTANTES}
    ecrire_sommes(dossier, POLICES_DISTANTES)
    journaliser(dossier, POLICES_DISTANTES, etat)
    if any(action.startswith("échec") for action in etat.values()):
        return etat

    sortie.mkdir(parents=True, exist_ok=True)
    for licence in LICENCES:
        (sortie / licence).write_text((dossier / licence).read_text(encoding="utf-8"), encoding="utf-8")

    chinois = caracteres_de_lapp()
    ecrire_sous_ensemble(sortie / SOUS_ENSEMBLE, chinois)
    latin = sous_ensemble_latin()
    for fonte in FONTES_A_PRODUIRE:
        octets = produire(fonte, latin if fonte.jeu == "latin" else chinois, dossier, sortie / fonte.sortie)
        etat[fonte.sortie] = f"écrit, {octets} octets"
    return etat
