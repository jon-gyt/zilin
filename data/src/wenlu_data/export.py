"""Export JSON versionné par famille (story 1.6).

`wenlu export --version 0.1.0` écrit `app/public/data/0.1.0/`, les seuls fichiers
que l'app lira. Rien n'est calculé ici : l'export assemble ce que `wenlu build` a
produit (`decompositions.json`, `graphe.json`, `parcours-*.json`), les graphies,
le pinyin d'Unihan, les fiches, les contes et les lettres de Que relus.

Périmètre de la version 0.1.0 : les caractères du seuil 255 et du HSK 1, plus
toutes leurs briques (prérequis transitifs). Pas tout le dictionnaire : une
famille n'est exportée qu'avec ses membres du périmètre. Les caractères que les
fêtes dessinent (l'anecdote, le 福 du vœu, `data/sources/fetes/textes.tsv`) y
entrent aussi, avec leurs briques : l'app les trace depuis leurs traits. De même pour
le caractère à lire de chaque terme solaire (`data/sources/saisons/textes.tsv`), et pour
les titres des rangs du personnage (`data/sources/heros/rangs.tsv`), que l'app dessine.

Séparation des licences (`docs/sources-licences.md` §8) — trois régimes, trois
familles de fichiers, jamais mêlés :

- `traits/<racine>.json` : tracés et médianes de `graphics.txt`, sous Arphic
  Public License. `ARPHICPL.TXT` est copié inaltéré à côté (§2.1, APL §1) et
  `traits/MODIFICATIONS.md` dit comment et quand ces fichiers ont été dérivés
  (APL §2 a). Chaque fichier porte la même mention dans son en-tête. Les
  composants que `graphics.txt` ne dessine pas y entrent découpés dans un hôte
  (`decoupes.py`) : `MODIFICATIONS.md` décrit chaque découpe, et l'en-tête des
  fichiers qui en portent la nomme.
- `familles/<racine>.json` : décomposition canonique GF 0014-2009 et textes des
  fiches relues, propriétaires. Aucun tracé n'y entre.
- `paires.json`, `contes/<id>.json`, `fetes.json`, `saisons.json`, `devinettes.json`,
  `eclair.json`, `coquilles.json`, `cuisine.json`, `lettres.json`, `wechat.json`, `heros.json` :
  propriétaires, source citée. `lettres.json` ne porte que les lettres de Que relues (`lettres.py`).
- `apercu/` : les textes encore à relire (voir plus bas), propriétaires eux aussi.

Ce qui n'entre jamais dans l'export :

- les définitions anglaises, d'où qu'elles viennent — `kDefinition` d'Unihan ou
  CC-CEDICT (§4.2) : rien ne les lit ici, et un test relit l'export pour s'en
  assurer ;
- `dictionary.txt` et ce qui en dérive comme texte (§2.2). Sa chaîne IDS sert à
  la réconciliation et la décomposition exportée nomme sa source
  (`sources: ["makemeahanzi"]`, `["cjk-decomp"]`, ou `["surcharge"]` pour une
  correction versionnée de `data/sources/surcharges/ids.tsv`) : la question de licence
  reste ouverte et l'export la pose noir sur blanc dans `LICENCES.md`, pour
  qu'elle se tranche caractère par caractère ;
- une fiche, un conte ou une lettre de Que qui n'est pas au statut `relu` (brief §17),
  hors de `apercu/`. Un caractère sans fiche relue s'exporte quand même — l'app a besoin de
  sa décomposition et de ses traits — avec les champs de texte vides et
  `statut: "sans_fiche"`.

L'aperçu (`apercu/`) : décision du propriétaire, les fiches et les versions de contes
encore au statut `a_relire` s'exportent à part, pour qu'il les essaie dans l'app avant
de les valider. L'app ne les charge que si le mode relecture des Réglages est
allumé, et chacun y porte la mention « à relire ».
`apercu/index.json` les recense (familles et contes), `apercu/familles/<racine>.json`
porte les textes des fiches d'une famille, `apercu/contes/<id>.json` les versions d'un
conte, `apercu/lettres.json` les lettres de Que à relire ; chaque entrée est marquée
`statut: "a_relire"`. `index.json` y renvoie par son
champ `apercu`, absent quand il n'y a rien à relire. Un texte relu n'y entre jamais,
un texte rejeté non plus : `wenlu check` le vérifie.

Le pinyin vient d'Unihan (`kMandarin`, Unicode License), jamais de
`dictionary.txt` ni de CC-CEDICT, sauf là où `data/sources/surcharges/pinyin.tsv`
le corrige : sa première lecture est alors la lecture exportée.

Déterminisme : deux exports du même contenu écrivent les mêmes octets. Les
fichiers sont triés, les dictionnaires écrits dans un ordre fixe, et la date est
celle du dernier changement de contenu, fichier par fichier — un fichier dont le
contenu n'a pas bougé garde sa date, même quand l'empreinte de l'index change. `index.json` porte l'empreinte du build dont il est
tiré ; `wenlu check` la recalcule pour dire si l'export est à jour. Cette
empreinte couvre aussi le code qui écrit l'export — `FORMAT_EXPORT` et ce
fichier lui-même : corriger l'exporteur rend l'export périmé.
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from pydantic import ValidationError

from . import contes as contes_mod
from . import decoupes as decoupes_mod
from . import coquilles as coquilles_mod
from . import cuisine as cuisine_mod
from . import devinettes as devinettes_mod
from . import eclair as eclair_mod
from . import fetes as fetes_mod
from . import fiches as fiches_mod
from . import heros as heros_mod
from . import lettres as lettres_mod
from . import saisons as saisons_mod
from . import surcharges as surcharges_mod
from . import unihan as unihan_mod
from . import wechat as wechat_mod
from .gf0014 import Controle
from .graphe import BRIQUE, DECOUPEE, MUETTE, PARCOURS
from .models import Brique, Famille, Fiche, Mot
from .outils import empreinte_fichier
from .paths import BUILD, CONTES, DATA, EXPORT, GF0014, INGEST, INTERFACE

#: Version par défaut de l'export.
VERSION = "0.1.0"

#: Version du format écrit par ce module. À incrémenter à chaque changement de
#: ce que l'export produit à entrées égales (clé ajoutée, ordre, règle de
#: sélection) : elle entre dans l'empreinte, et l'export versionné devient périmé.
FORMAT_EXPORT = 7

#: Le code de l'exporteur, lui aussi dans l'empreinte : un changement de ce
#: fichier où l'on aurait oublié `FORMAT_EXPORT` rend quand même l'export périmé.
EXPORTEUR = Path(__file__).resolve()

#: Listes cibles de la version 0.1.0 : le périmètre en découle.
LISTES_CIBLES: tuple[str, ...] = ("seuil-255", "hsk-1")

#: Niveau porté par un caractère de chaque liste, dans `Fiche.niveaux`.
NIVEAUX: dict[str, tuple[str, int]] = {"seuil-255": ("seuil", 255), "hsk-1": ("hsk", 1)}

PERIMETRE = (
    "seuil 255 et HSK 1 : les caractères des deux listes et leurs briques ;"
    " les caractères dessinés des fêtes, des termes solaires et des rangs du personnage,"
    " et leurs briques"
)

#: Sources versionnées de l'export, hors `data/work/`.
PAIRES = DATA / "sources" / "paires" / "paires.tsv"
LICENCES_SOURCE = DATA / "sources" / "licences"
ARPHIC = "ARPHICPL.TXT"
UNICODE_NOTICE = "UNICODE-LICENSE.txt"

#: Substitués à l'écriture : la date ne fait pas varier le contenu comparé.
JETON_DATE = "@date@"
JETON_JOUR = "@jour@"

LICENCE_TRAITS = "Arphic Public License"
SOURCE_TRAITS = "Make Me a Hanzi — graphics.txt"
URL_TRAITS = "https://github.com/skishore/makemeahanzi"
MODIF_TRAITS = (
    f"{JETON_JOUR} : conversion de format (JSON par famille, un objet"
    " {s: tracés, m: médianes} par caractère) et sous-ensemble de caractères"
    " (seuil 255, HSK 1 et leurs briques). Les tracés et les médianes eux-mêmes"
    " ne sont pas modifiés."
)

LICENCE_PROPRIETAIRE = "propriétaire"
SOURCE_FAMILLES = (
    "décomposition GF 0014-2009 réconciliée par le pipeline wenlu ;"
    " pinyin d'Unihan (kMandarin) ; textes rédigés pour l'app"
)
URL_PIPELINE = "https://github.com/jon-gyt/zilin"


class ExportImpossible(FileNotFoundError):
    """Le résultat de `wenlu build` manque : rien à exporter."""


class FamilleInvalide(ValueError):
    """Une famille assemblée ne passe pas la validation pydantic."""


# ------------------------------------------------------------------------ empreinte


def fichiers_sources(
    *,
    build: Path,
    ingest: Path,
    fiches: Path | None = None,
    contes: Path | None = None,
) -> list[tuple[str, Path]]:
    """Les fichiers dont l'export est tiré, dans un ordre fixe.

    Seuls ceux que l'export lit vraiment : `mots.json` (CC-CEDICT) et
    `unihan-definitions.json` n'en sont pas, et n'ont donc pas à rendre un
    export périmé quand la source change. `export.py` en est : le code qui
    écrit l'export fait partie de ce dont il est tiré.
    """
    lus: list[tuple[str, Path]] = [
        ("exporteur", EXPORTEUR),
        ("exporteur-devinettes", Path(devinettes_mod.__file__).resolve()),
        ("exporteur-eclair", Path(eclair_mod.__file__).resolve()),
        ("exporteur-coquilles", Path(coquilles_mod.__file__).resolve()),
        ("exporteur-cuisine", Path(cuisine_mod.__file__).resolve()),
        ("exporteur-lettres", Path(lettres_mod.__file__).resolve()),
        ("exporteur-wechat", Path(wechat_mod.__file__).resolve()),
        ("exporteur-heros", Path(heros_mod.__file__).resolve()),
        ("decompositions", build / "decompositions.json"),
        ("graphe", build / "graphe.json"),
        *[(f"parcours-{nom}", build / f"parcours-{nom}.json") for nom in sorted(PARCOURS)],
        ("listes", ingest / "listes.json"),
        ("graphies", ingest / "graphies.json"),
        ("unihan", ingest / "unihan.json"),
        ("composants", GF0014 / "composants.tsv"),
        ("surcharges-ids", surcharges_mod.IDS),
        ("surcharges-equivalences", surcharges_mod.EQUIVALENCES),
        ("surcharges-pinyin", surcharges_mod.PINYIN),
        ("surcharges-decoupes", surcharges_mod.DECOUPES),
        ("decoupes", build / decoupes_mod.FICHIER),
        ("paires", PAIRES),
        ("fetes-calendrier", fetes_mod.CALENDRIER),
        ("fetes-textes", fetes_mod.TEXTES),
        ("fetes-animaux", fetes_mod.ANIMAUX),
        ("saisons-termes", saisons_mod.TERMES),
        ("saisons-textes", saisons_mod.TEXTES),
        ("contes-catalogue", CONTES / "catalogue.tsv"),
        ("contes-chapitres", CONTES / "chapitres.tsv"),
        ("devinettes", devinettes_mod.DEVINETTES),
        ("devinettes-briques", devinettes_mod.BRIQUES),
        ("eclair", eclair_mod.MOTS),
        ("coquilles", coquilles_mod.COQUILLES),
        ("cuisine-recettes", cuisine_mod.RECETTES),
        ("cuisine-etapes", cuisine_mod.ETAPES),
        ("cuisine-ingredients", cuisine_mod.INGREDIENTS),
        ("cuisine-etal", cuisine_mod.ETAL),
        ("cuisine-tao", cuisine_mod.TAO),
        ("lettres-feuilleton", lettres_mod.FEUILLETON),
        ("wechat-ami", wechat_mod.AMI),
        ("wechat-dialogues", wechat_mod.DIALOGUES),
        ("wechat-echanges", wechat_mod.ECHANGES),
        ("heros-rangs", heros_mod.RANGS),
        ("heros-betes", heros_mod.BETES),
        ("heros-tao", heros_mod.TAO),
        ("interface", INTERFACE),
        ("arphicpl", LICENCES_SOURCE / ARPHIC),
        ("unicode", LICENCES_SOURCE / UNICODE_NOTICE),
    ]
    for chemin in fiches_mod.fiches_ecrites(fiches):
        lus.append((f"fiche:{chemin.stem}", chemin))
    for chemin in contes_mod.versions_ecrites(contes):
        lus.append((f"conte:{chemin.parent.name}/{chemin.stem}", chemin))
    for chemin in lettres_mod.lettres_ecrites():
        lus.append((f"lettre:{chemin.stem}", chemin))
    return lus


def empreinte_build(fichiers: Sequence[tuple[str, Path]]) -> str:
    """Empreinte du build : `format N`, une ligne `nom sha256` par fichier lu, puis sha256.

    `N` est `FORMAT_EXPORT`. Un fichier absent compte pour `—` : son absence
    fait partie de l'état.
    """
    lignes = [f"format {FORMAT_EXPORT}"] + [
        f"{nom} {empreinte_fichier(chemin) if chemin.exists() else '—'}"
        for nom, chemin in fichiers
    ]
    return "sha256:" + hashlib.sha256("\n".join(lignes).encode("utf-8")).hexdigest()


# ------------------------------------------------------------------------ périmètre


@dataclass(frozen=True)
class Noeud:
    """Un nœud du graphe, relu de `graphe.json`."""

    c: str
    genre: str
    prerequis: tuple[str, ...]
    racine: str
    reconcilie: bool


@dataclass(frozen=True)
class Perimetre:
    """Ce que la version exporte : des caractères, groupés par famille."""

    caracteres: tuple[str, ...]
    familles: tuple[tuple[str, tuple[str, ...]], ...]

    @property
    def racines(self) -> tuple[str, ...]:
        return tuple(r for r, _ in self.familles)


def prerequis_transitifs(noeuds: Mapping[str, Noeud], c: str) -> set[str]:
    """Toutes les briques dont `c` dépend, directement ou non."""
    vus: set[str] = set()
    pile = list(noeuds[c].prerequis)
    while pile:
        x = pile.pop()
        if x in vus:
            continue
        vus.add(x)
        if x in noeuds:
            pile.extend(noeuds[x].prerequis)
    return vus


def perimetre(noeuds: Mapping[str, Noeud], cibles: Iterable[str]) -> Perimetre:
    """Les caractères des listes cibles et leurs briques, groupés par racine."""
    retenus: set[str] = set()
    for c in cibles:
        if c not in noeuds:
            continue
        retenus.add(c)
        retenus |= {p for p in prerequis_transitifs(noeuds, c) if p in noeuds}
    par_racine: dict[str, list[str]] = {}
    for c in sorted(retenus):
        par_racine.setdefault(noeuds[c].racine, []).append(c)
    familles = tuple(
        (racine, tuple(membres)) for racine, membres in sorted(par_racine.items())
    )
    return Perimetre(caracteres=tuple(sorted(retenus)), familles=familles)


# --------------------------------------------------------------------------- lecture


def _lire(chemin: Path) -> object:
    if not chemin.exists():
        raise ExportImpossible(f"{chemin} absent : lancer `wenlu build`")
    return json.loads(chemin.read_text(encoding="utf-8"))


def charger_noeuds(build: Path) -> dict[str, Noeud]:
    """Les nœuds de `graphe.json`, par caractère."""
    document = _lire(build / "graphe.json")
    assert isinstance(document, dict)
    return {
        str(n["c"]): Noeud(
            c=str(n["c"]),
            genre=str(n["genre"]),
            prerequis=tuple(str(p) for p in n.get("prerequis") or ()),
            racine=str(n["racine"]),
            reconcilie=bool(n.get("reconcilie")),
        )
        for n in document["noeuds"]
    }


def charger_decompositions(build: Path) -> dict[str, dict[str, object]]:
    """Les décompositions canoniques, par caractère : composants et sources d'IDS."""
    document = _lire(build / "decompositions.json")
    assert isinstance(document, dict)
    return {str(e["c"]): e for e in document["caracteres"]}


def charger_parcours(build: Path) -> dict[str, dict[str, object]]:
    """Les parcours écrits par `wenlu build`, par nom."""
    trouves: dict[str, dict[str, object]] = {}
    for nom in sorted(PARCOURS):
        chemin = build / f"parcours-{nom}.json"
        if chemin.exists():
            document = json.loads(chemin.read_text(encoding="utf-8"))
            trouves[nom] = document
    return trouves


def charger_listes(ingest: Path) -> dict[str, list[str]]:
    document = _lire(ingest / "listes.json")
    assert isinstance(document, dict)
    return {str(nom): [str(c) for c in liste] for nom, liste in document.items()}


def charger_pinyin(
    ingest: Path,
    caracteres: Iterable[str],
    surcharges: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, str]:
    """Pinyin d'Unihan (`kMandarin`) pour les caractères demandés, et eux seuls.

    Une surcharge de `data/sources/surcharges/pinyin.tsv` passe devant : sa
    première lecture est la lecture principale (地 dì, et non la particule de).
    """
    document = _lire(ingest / "unihan.json")
    assert isinstance(document, dict)
    surcharges = surcharges_mod.charger_pinyin() if surcharges is None else surcharges
    voulus = set(caracteres)
    lus = {
        str(e["c"]): str(e.get("pinyin") or "")
        for e in document["caracteres"]
        if str(e["c"]) in voulus and e.get("pinyin")
    }
    for c, lectures in surcharges.items():
        if c in voulus and lectures:
            lus[c] = lectures[0]
    return lus


def charger_lectures(
    ingest: Path,
    caracteres: Iterable[str],
    surcharges: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, list[str]] | None:
    """Toutes les lectures valides des caractères demandés, par caractère.

    Les lectures d'une surcharge d'abord, puis celles d'Unihan : `kMandarin`, puis
    `kTGHZ2013` et `kXHC1983` (`lectures_dico`), qui disent toutes celles d'un
    polyphone (好 hǎo hào). La fiche les exporte derrière sa lecture principale : une
    question de ton ne propose jamais comme leurre une lecture valide du caractère.

    `None` quand l'ingestion ne porte pas encore les dictionnaires (un `unihan.json`
    d'avant `lectures_dico`) : on ne saurait pas dire toutes les lectures, les fiches
    n'en exportent aucune et l'app ne pose pas la question de ton.
    """
    document = _lire(ingest / "unihan.json")
    assert isinstance(document, dict)
    if not set(unihan_mod.DICTIONNAIRES) <= set(document.get("champs") or ()):
        return None
    surcharges = surcharges_mod.charger_pinyin() if surcharges is None else surcharges
    voulus = set(caracteres)
    lues: dict[str, list[str]] = {}
    for c, lectures in surcharges.items():
        if c in voulus:
            lues[c] = [str(x) for x in lectures]
    for e in document["caracteres"]:
        c = str(e["c"])
        if c not in voulus:
            continue
        brutes = [*(e.get("lectures") or ()), *(e.get("lectures_dico") or ())]
        for x in brutes:
            lue = unicodedata.normalize("NFC", str(x))
            if lue and lue not in lues.setdefault(c, []):
                lues[c].append(lue)
    return lues


def charger_graphies(
    ingest: Path, caracteres: Iterable[str], decoupes: Mapping[str, Mapping[str, object]] | None = None
) -> dict[str, dict[str, object]]:
    """Tracés et médianes de `graphics.txt` pour les caractères demandés.

    `decoupes` : les traits des composants découpés dans un hôte (`decoupes.traits`),
    pour ceux que `graphics.txt` ne dessine pas.
    """
    document = _lire(ingest / "graphies.json")
    assert isinstance(document, list)
    voulus = set(caracteres)
    graphies: dict[str, dict[str, object]] = {
        str(e["c"]): {"s": e["strokes"], "m": e["medians"]}
        for e in document
        if str(e["c"]) in voulus
    }
    for c, d in sorted((decoupes or {}).items()):
        if c in voulus and c not in graphies:
            graphies[c] = {"s": d["s"], "m": d["m"]}
    return graphies


def charger_fiches_relues(dossier: Path | None = None) -> dict[str, fiches_mod.Fiche]:
    """Les fiches au statut `relu`, par caractère. Les autres n'existent pas ici."""
    relues: dict[str, fiches_mod.Fiche] = {}
    for chemin in fiches_mod.fiches_ecrites(dossier):
        fiche = fiches_mod.lire_fiche(chemin)
        if fiche.statut == fiches_mod.RELU:
            relues[fiche.c] = fiche
    return relues


def charger_contes_relus(dossier: Path | None = None) -> dict[str, list[contes_mod.Version]]:
    """Les versions de contes au statut `relu`, par identifiant de conte."""
    relus: dict[str, list[contes_mod.Version]] = {}
    for chemin in contes_mod.versions_ecrites(dossier):
        version = contes_mod.lire_version(chemin)
        if version.statut == contes_mod.RELU:
            relus.setdefault(version.conte, []).append(version)
    for versions in relus.values():
        versions.sort(key=lambda v: v.seuil)
    return relus


def charger_fiches_a_relire(dossier: Path | None = None) -> dict[str, fiches_mod.Fiche]:
    """Les fiches au statut `a_relire`, par caractère : la matière de l'aperçu.

    Ni les fiches relues (l'export principal les porte), ni les rejetées.
    """
    trouvees: dict[str, fiches_mod.Fiche] = {}
    for chemin in fiches_mod.fiches_ecrites(dossier):
        fiche = fiches_mod.lire_fiche(chemin)
        if fiche.statut == fiches_mod.A_RELIRE:
            trouvees[fiche.c] = fiche
    return trouvees


def charger_contes_a_relire(dossier: Path | None = None) -> dict[str, list[contes_mod.Version]]:
    """Les versions de contes au statut `a_relire`, par identifiant de conte."""
    trouves: dict[str, list[contes_mod.Version]] = {}
    for chemin in contes_mod.versions_ecrites(dossier):
        version = contes_mod.lire_version(chemin)
        if version.statut == contes_mod.A_RELIRE:
            trouves.setdefault(version.conte, []).append(version)
    for versions in trouves.values():
        versions.sort(key=lambda v: v.seuil)
    return trouves


def parse_paires(lignes: Iterable[str]) -> list[list[str]]:
    """Lit les paires à ne pas confondre : `#` en commentaire, un groupe par ligne."""
    groupes: list[list[str]] = []
    for ligne in lignes:
        net = ligne.split("#", 1)[0].strip()
        if not net:
            continue
        groupe = [c for c in net.split() if c]
        if len(groupe) >= 2:
            groupes.append(groupe)
    return groupes


def charger_paires(chemin: Path | None = None) -> list[list[str]]:
    chemin = chemin or PAIRES
    if not chemin.exists():
        return []
    return parse_paires(chemin.read_text(encoding="utf-8").splitlines())


# ------------------------------------------------------------------------- documents


def _jours_par_caractere(parcours: Mapping[str, Mapping[str, object]]) -> dict[str, tuple[str, int, str | None]]:
    """Pour chaque caractère posé : son parcours de référence, son jour, la brique du jour.

    Les parcours sont parcourus dans l'ordre des noms (`hsk` puis `lire`) et la
    dernière écriture l'emporte : pour un caractère posé par les deux, c'est
    `lire` qui fait référence — le parcours des seuils français, celui que le
    reste du pipeline prend par défaut.
    """
    poses: dict[str, tuple[str, int, str | None]] = {}
    for nom in sorted(parcours):
        document = parcours[nom]
        for jour in document.get("jours") or ():  # type: ignore[union-attr]
            brique = jour.get("brique")
            for c in ([brique] if brique else []) + list(jour.get("composes") or ()):
                poses[str(c)] = (nom, int(jour["jour"]), str(brique) if brique else None)
    return poses


def _mot(m: fiches_mod.Mot) -> Mot:
    return Mot(hanzi=m.hanzi, pinyin=m.pinyin, fr=m.fr, en=m.en)


def fiche_exportee(
    c: str,
    *,
    noeuds: Mapping[str, Noeud],
    decompositions: Mapping[str, Mapping[str, object]],
    pinyin: Mapping[str, str],
    listes: Mapping[str, Sequence[str]],
    poses: Mapping[str, tuple[str, int, str | None]],
    relues: Mapping[str, fiches_mod.Fiche],
    lectures: Mapping[str, Sequence[str]] | None = None,
) -> Fiche:
    """Assemble la fiche d'un caractère. Sans fiche relue, les textes restent vides.

    `parts` est la décomposition canonique GF 0014-2009 (ordre d'écriture),
    `sources` nomme d'où vient l'IDS descendu, `nouveau` marque l'élément ajouté :
    le composant posé le même jour que le caractère dans son parcours — c'est lui,
    et lui seul, que l'app met en cinabre.
    """
    decomposition = decompositions.get(c, {})
    composants = [str(x) for x in (decomposition.get("composants") or [])]
    parts = [] if composants in ([], [c]) else composants
    sources = [str(s) for s in (decomposition.get("sources") or [])]

    _, _, brique_du_jour = poses.get(c, ("", 0, None))
    nouveau = [i for i, p in enumerate(parts) if p == brique_du_jour] if brique_du_jour else []

    niveaux = {
        NIVEAUX[nom][0]: NIVEAUX[nom][1]
        for nom in LISTES_CIBLES
        if nom in NIVEAUX and c in set(listes.get(nom) or ())
    }

    def toutes(principale: str) -> list[str]:
        """La lecture principale en tête, puis les autres ; rien sans elle ni sans elles."""
        if not principale or lectures is None:
            return []
        autres = [x for x in lectures.get(c, ()) if x != principale]
        return [principale, *autres]

    relue = relues.get(c)
    if relue is None:
        return Fiche(
            c=c,
            pinyin=pinyin.get(c, ""),
            lectures=toutes(pinyin.get(c, "")),
            fr="",
            en="",
            parts=parts,
            nouveau=nouveau,
            sources=sources,
            role=None,
            roles={},
            origine_fr="",
            origine_en="",
            etiquette=None,
            niveaux=niveaux,
            statut="sans_fiche",
        )
    roles = {k: v for k, v in sorted(relue.roles.items()) if v in ("son", "sens", "forme")}
    ajoute = parts[nouveau[0]] if nouveau else None
    principale = pinyin.get(c, "") or (relue.pinyin[0] if relue.pinyin else "")
    return Fiche(
        c=c,
        pinyin=principale,
        lectures=toutes(principale),
        fr="",
        en="",
        parts=parts,
        nouveau=nouveau,
        sources=sources,
        role=roles.get(ajoute) if ajoute else None,  # type: ignore[arg-type]
        roles=roles,  # type: ignore[arg-type]
        origine_fr=relue.origine_fr,
        origine_en=relue.origine_en,
        etiquette=relue.etiquette,  # type: ignore[arg-type]
        memo_fr=relue.memo_fr,
        memo_en=relue.memo_en,
        mots=[_mot(m) for m in relue.mots],
        phrase=Mot(
            hanzi=relue.phrase.zh,
            pinyin=relue.phrase.pinyin,
            fr=relue.phrase.fr,
            en=relue.phrase.en,
        ),
        niveaux=niveaux,
        statut="relu",
    )


def famille_exportee(racine: str, fiches: Sequence[Fiche], version: str) -> Famille:
    """Une famille validée : sa racine en `Brique`, ses fiches dans l'ordre."""
    tete = next((f for f in fiches if f.c == racine), None)
    brique = Brique(
        c=racine,
        pinyin=tete.pinyin if tete else "",
        fr="",
        en="",
        origine=tete.origine_fr if tete else "",
        etiquette=tete.etiquette if tete else None,
    )
    try:
        return Famille.model_validate(
            {"racine": brique, "fiches": list(fiches), "version": version}
        )
    except ValidationError as erreur:
        raise FamilleInvalide(f"famille {racine} invalide : {erreur}") from erreur


def document_famille(famille: Famille) -> dict[str, object]:
    """Le JSON écrit dans `familles/<racine>.json` : en-tête de licence puis la famille."""
    return {
        "version": famille.version,
        "license": LICENCE_PROPRIETAIRE,
        "source": SOURCE_FAMILLES,
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        "norme": "GF 0014-2009",
        **famille.model_dump(),
    }


def document_traits(
    racine: str,
    caracteres: Sequence[str],
    graphies: Mapping[str, Mapping[str, object]],
    version: str,
    decoupes: Iterable[str] = (),
) -> dict[str, object]:
    """Le JSON écrit dans `traits/<racine>.json`.

    Fichier sous Arphic Public License, séparé de tout le reste : il ne porte que
    des tracés, leur en-tête de licence et la mention de modification exigée par
    l'APL §2 a). Un caractère par clé, `{s: tracés, m: médianes}` comme
    `strokes-demo.json`. Un composant découpé dans un hôte (`decoupes`) est nommé
    dans la mention : ses tracés, eux, sont modifiés.
    """
    decoupes = set(decoupes)
    decoupes_ici = [c for c in caracteres if c in decoupes and c in graphies]
    modifie = MODIF_TRAITS
    if decoupes_ici:
        modifie += (
            f" Sauf {' '.join(decoupes_ici)} : traits découpés dans un caractère hôte et"
            " recadrés, voir MODIFICATIONS.md."
        )
    return {
        "version": version,
        "license": LICENCE_TRAITS,
        "license_file": ARPHIC,
        "source": SOURCE_TRAITS,
        "source_url": URL_TRAITS,
        "modified": modifie,
        "traits": {c: graphies[c] for c in caracteres if c in graphies},
    }


def document_paires(paires: Sequence[Sequence[str]], version: str) -> dict[str, object]:
    """Le JSON écrit dans `paires.json` : les caractères à ne pas confondre."""
    return {
        "version": version,
        "license": LICENCE_PROPRIETAIRE,
        "source": "data/sources/paires/paires.tsv (docs/jeux.md)",
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        "paires": [list(groupe) for groupe in paires],
    }


#: La source de `fetes.json`, telle que son en-tête la cite.
SOURCE_FETES = (
    "data/sources/fetes/ : dates du calendrier luni-solaire chinois calculées par"
    " lunar_python (MIT) ; textes rédigés pour l'app"
)


#: La source de `saisons.json`, telle que son en-tête la cite.
SOURCE_SAISONS = (
    "data/sources/saisons/ : termes solaires calculés par lunar_python (MIT), à"
    " l'heure de Pékin ; textes rédigés pour l'app"
)


def document_saisons(
    version: str, noeuds: Mapping[str, Noeud], pinyin: Mapping[str, str] | None = None
) -> dict[str, object]:
    """Le JSON écrit dans `saisons.json` : les vingt-quatre termes solaires.

    Le contenu vient de `saisons.document` ; ici, l'en-tête de licence et les racines
    des caractères à lire, pour que l'app trouve leurs traits sans relire toutes les
    familles.
    """
    return saisons_mod.document(
        version,
        {c: n.racine for c, n in noeuds.items()},
        dict(pinyin or {}),
        {
            "license": LICENCE_PROPRIETAIRE,
            "source": SOURCE_SAISONS,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def caracteres_interface(chemin: Path | None = None) -> list[str]:
    """Les caractères que l'interface dessine (`data/sources/interface/caracteres.txt`).

    Un par ligne, `#` commente. Absent, la liste est vide : l'export reste possible.
    """
    chemin = chemin or INTERFACE
    if not chemin.exists():
        return []
    vus: list[str] = []
    for brute in chemin.read_text(encoding="utf-8").splitlines():
        ligne = brute.strip()
        if ligne and not ligne.startswith("#"):
            vus += [c for c in ligne if not c.isspace() and c not in vus]
    return vus


def caracteres_heros() -> list[str]:
    """Les caractères des titres de rang du personnage (`data/sources/heros/rangs.tsv`).

    L'app les dessine depuis leurs traits, sur l'écran du personnage et au 放榜 : ils
    entrent dans le périmètre avec leurs briques, comme ceux des fêtes.
    """
    return heros_mod.caracteres_dessines(heros_mod.charger())


def document_fetes(
    version: str, noeuds: Mapping[str, Noeud], pinyin: Mapping[str, str] | None = None
) -> dict[str, object]:
    """Le JSON écrit dans `fetes.json` : le calendrier, les textes de chaque fête.

    `calendrier` donne chaque fête d'une année, sa fenêtre et l'animal de l'année
    lunaire ; `fetes`, le vœu, les phrases de Tao et l'anecdote, dont le caractère
    bonus (`c`), son pinyin d'Unihan (`pinyin`, vide s'il n'en a pas) et son sens
    rédigé pour l'app (`sens`) ; `racines`, la
    famille de chaque caractère dessiné, pour que l'app trouve ses traits sans
    relire toutes les familles. Les jetons `{animal}` et `{quand}` restent tels
    quels : l'app les remplit au jour de la fête.
    """
    pinyin = pinyin or {}
    entrees = fetes_mod.charger_calendrier()
    animaux = fetes_mod.charger_animaux()
    textes = fetes_mod.charger_textes()
    par_fete = fetes_mod.textes_par_fete(textes)

    def un(fete: str, cle: str) -> str:
        return (par_fete.get(fete, {}).get(cle) or [""])[0]

    def animal(annee: int) -> dict[str, str]:
        a = animaux.get(fetes_mod.rang_animal(annee))
        return {"c": a.hanzi, "pinyin": a.pinyin, "fr": a.fr} if a else {"c": "", "pinyin": "", "fr": ""}

    return {
        "version": version,
        "license": LICENCE_PROPRIETAIRE,
        "source": SOURCE_FETES,
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        "calendrier": [
            {
                "fete": e.fete,
                "date": e.date,
                "avant": e.avant,
                "apres": e.apres,
                "annee": e.annee,
                "animal": animal(e.annee),
            }
            for e in sorted(entrees, key=lambda e: (e.date, e.fete))
        ],
        "fetes": {
            fete: {
                "nom": un(fete, "nom"),
                "nom_zh": un(fete, "nom_zh"),
                "voeu": {
                    "zh": un(fete, "voeu_zh"),
                    "pinyin": un(fete, "voeu_pinyin"),
                    "fr": un(fete, "voeu_fr"),
                },
                "caractere_voeu": un(fete, "caractere_voeu") or None,
                "tao": list(par_fete.get(fete, {}).get("tao") or []),
                "anecdote": {
                    "rubrique": un(fete, "anecdote_rubrique"),
                    "c": un(fete, "anecdote_c"),
                    "pinyin": pinyin.get(un(fete, "anecdote_c"), ""),
                    "sens": un(fete, "anecdote_sens"),
                    "titre": un(fete, "anecdote_titre"),
                    "texte": un(fete, "anecdote_texte"),
                },
            }
            for fete in sorted(par_fete)
        },
        "racines": {
            c: noeuds[c].racine for c in fetes_mod.caracteres_dessines(textes) if c in noeuds
        },
    }


def document_devinettes(
    version: str,
    per: Perimetre,
    noeuds: Mapping[str, Noeud],
    decompositions: Mapping[str, Mapping[str, object]],
    listes: Mapping[str, Sequence[str]],
    pinyin: Mapping[str, str],
    graphies: Mapping[str, object],
    paires: Sequence[Sequence[str]],
) -> dict[str, object]:
    """Le JSON écrit dans `devinettes.json` (story 4b.5), voir `devinettes.py`.

    Les leurres se choisissent parmi les caractères des listes cibles dont l'export
    porte les traits ; les réponses, les briques et les leurres restent dans le
    périmètre, si bien que les devinettes n'y font entrer aucun caractère.
    """
    dessinables = [c for c in per.caracteres if c in graphies]
    cibles = {c for nom in LISTES_CIBLES for c in listes.get(nom, ())}
    return devinettes_mod.document(
        version,
        caracteres=dessinables,
        candidats=[c for c in dessinables if c in cibles],
        decompositions={
            c: [str(x) for x in (d.get("composants") or [])]  # type: ignore[union-attr]
            for c, d in decompositions.items()
        },
        pinyin=pinyin,
        racines={c: noeuds[c].racine for c in dessinables},
        paires=paires,
        structures={c: str(d.get("structure") or "") for c, d in decompositions.items()},
        en_tete={
            "version": version,
            "license": LICENCE_PROPRIETAIRE,
            "source": devinettes_mod.SOURCE_EXPORT,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def catalogue_des_contes() -> list[dict[str, object]]:
    """Ce que le catalogue prévoit, pour la bibliothèque de l'app : chaque récit, ses vrais
    titres, ses niveaux prévus et son nombre de chapitres. Aucun texte : ni résumé, ni
    version ; une version n'entre dans l'export (`contes/<id>.json`) qu'une fois relue.
    """
    if not (CONTES / "catalogue.tsv").exists():
        return []
    return [
        {
            "id": c.id,
            "titre_zh": c.titre_zh,
            "titre_pinyin": c.titre_pinyin,
            "titre_fr": c.titre_fr,
            "titre_en": c.titre_en,
            "niveaux": list(c.niveaux),
            "chapitres": c.chapitres,
        }
        for c in contes_mod.charger_catalogue(CONTES / "catalogue.tsv")
    ]


def titre_original(conte: str) -> dict[str, str]:
    """Le vrai titre d'un récit (愚公移山) et son pinyin, lus dans le catalogue des contes.

    Vide pour un conte hors catalogue : l'app retombe alors sur le titre traduit.
    """
    if not (CONTES / "catalogue.tsv").exists():
        return {"titre_zh": "", "titre_pinyin": ""}
    for c in contes_mod.charger_catalogue(CONTES / "catalogue.tsv"):
        if c.id == conte:
            return {"titre_zh": c.titre_zh, "titre_pinyin": c.titre_pinyin}
    return {"titre_zh": "", "titre_pinyin": ""}


def document_eclair(
    version: str, per: Perimetre, noeuds: Mapping[str, Noeud], graphies: Mapping[str, object]
) -> dict[str, object]:
    """Le JSON écrit dans `eclair.json` (story 4b.4), voir `eclair.py`.

    Un mot n'est exporté que si ses deux caractères sont dessinables : les mots
    n'ajoutent aucun caractère au périmètre.
    """
    dessinables = [c for c in per.caracteres if c in graphies]
    return eclair_mod.document(
        version,
        caracteres=dessinables,
        racines={c: noeuds[c].racine for c in dessinables},
        en_tete={
            "version": version,
            "license": LICENCE_PROPRIETAIRE,
            "source": eclair_mod.SOURCE_EXPORT,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def document_coquilles(
    version: str,
    per: Perimetre,
    noeuds: Mapping[str, Noeud],
    graphies: Mapping[str, object],
    paires: Sequence[Sequence[str]],
) -> dict[str, object]:
    """Le JSON écrit dans `coquilles.json` (story 4b.3), voir `coquilles.py`.

    Les messages s'écrivent avec le seuil 255 et les intrus viennent des groupes de
    `paires.json`, déjà réduits au périmètre : la coquille n'y fait entrer aucun caractère.
    """
    dessinables = [c for c in per.caracteres if c in graphies]
    return coquilles_mod.document(
        version,
        caracteres=dessinables,
        paires=paires,
        racines={c: noeuds[c].racine for c in dessinables},
        en_tete={
            "version": version,
            "license": LICENCE_PROPRIETAIRE,
            "source": coquilles_mod.SOURCE_EXPORT,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def document_cuisine(
    version: str,
    per: Perimetre,
    noeuds: Mapping[str, Noeud],
    parcours: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    """Le JSON écrit dans `cuisine.json` (story 4b.6), voir `cuisine.py`.

    La cuisine ne fait entrer aucun caractère dans le périmètre : ses textes s'écrivent
    avec ce que les parcours posent, et `wenlu check` le vérifie.
    """
    return cuisine_mod.document(
        version,
        parcours=parcours,
        racines={c: noeuds[c].racine for c in per.caracteres},
        en_tete={
            "version": version,
            "license": LICENCE_PROPRIETAIRE,
            "source": cuisine_mod.SOURCE_EXPORT,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def document_heros(version: str, per: Perimetre, noeuds: Mapping[str, Noeud]) -> dict[str, object]:
    """Le JSON écrit dans `heros.json` (story 4.5), voir `heros.py`.

    Les titres des rangs entrent dans le périmètre (`assembler`) : l'app les dessine depuis
    leurs traits, et `racines` dit où les trouver.
    """
    return heros_mod.document(
        version,
        racines={c: noeuds[c].racine for c in per.caracteres},
        en_tete={
            "version": version,
            "license": LICENCE_PROPRIETAIRE,
            "source": heros_mod.SOURCE_EXPORT,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def en_tete_lettres(version: str) -> dict[str, object]:
    """L'en-tête de `lettres.json` et de `apercu/lettres.json` (story 4b.8), voir `lettres.py`."""
    return {
        "version": version,
        "license": LICENCE_PROPRIETAIRE,
        "source": lettres_mod.SOURCE_EXPORT,
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
    }

def document_wechat(
    version: str,
    per: Perimetre,
    noeuds: Mapping[str, Noeud],
    parcours: Mapping[str, Mapping[str, object]],
    ingest: Path,
) -> dict[str, object]:
    """Le JSON écrit dans `wechat.json` (story 4b.7), voir `wechat.py`.

    Le message WeChat ne fait entrer aucun caractère dans le périmètre : ses dialogues
    s'écrivent avec ce que les parcours posent, et `wenlu check` le vérifie. Le pinyin
    par caractère s'aligne sur les lectures d'Unihan et des surcharges.
    """
    return wechat_mod.document(
        version,
        parcours=parcours,
        racines={c: noeuds[c].racine for c in per.caracteres},
        lues=wechat_mod.lectures_export(ingest),
        en_tete={
            "version": version,
            "license": LICENCE_PROPRIETAIRE,
            "source": wechat_mod.SOURCE_EXPORT,
            "source_url": URL_PIPELINE,
            "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        },
    )


def document_conte(
    conte: str, versions: Sequence[contes_mod.Version], version_export: str
) -> dict[str, object]:
    """Le JSON écrit dans `contes/<id>.json` : un récit, une version par seuil.

    Une fable porte ses `phrases` ; un récit long ses `chapitres`, chacun avec son titre
    chinois, son pinyin, ses titres français et anglais et ses phrases.
    """
    tete = versions[0]
    origine = f"récit traditionnel, {tete.ouvrage}" if tete.ouvrage else "récit traditionnel"
    return {
        "version": version_export,
        "license": LICENCE_PROPRIETAIRE,
        "source": f"{origine} (domaine public) ; texte réécrit pour l'app",
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        "conte": conte,
        **titre_original(conte),
        "titre_fr": tete.titre_fr,
        "titre_en": tete.titre_en,
        "versions": {
            str(v.seuil): {
                "titre": v.titre,
                "titre_pinyin": v.titre_pinyin,
                **v.texte_en_json(),
                "glose": {zh: v.glose[zh].en_json() for zh in sorted(v.glose)},
            }
            for v in sorted(versions, key=lambda v: v.seuil)
        },
    }


# ---------------------------------------------------------------------------- aperçu


#: Le dossier de l'aperçu dans une version exportée.
APERCU = "apercu"

#: Le statut que porte chaque entrée de l'aperçu, et elle seule.
STATUT_APERCU = "a_relire"

#: Ce que l'en-tête de chaque fichier de l'aperçu dit de lui.
AVERTISSEMENT_APERCU = (
    "Textes encore à relire : ni relus, ni validés. L'app ne les charge que si"
    " le mode relecture des Réglages est allumé,"
    " et chacun y porte la mention « à relire »."
)

#: Les champs de texte d'une fiche que l'aperçu porte : ceux d'une fiche relue.
CHAMPS_FICHE_APERCU: tuple[str, ...] = (
    "role",
    "roles",
    "origine_fr",
    "origine_en",
    "etiquette",
    "memo_fr",
    "memo_en",
    "mots",
    "phrase",
)


def _en_tete_apercu(version: str, source: str) -> dict[str, object]:
    return {
        "version": version,
        "license": LICENCE_PROPRIETAIRE,
        "source": source,
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        "statut": STATUT_APERCU,
        "avertissement": AVERTISSEMENT_APERCU,
    }


def fiche_apercu(
    c: str,
    a_relire: fiches_mod.Fiche,
    *,
    noeuds: Mapping[str, Noeud],
    decompositions: Mapping[str, Mapping[str, object]],
    pinyin: Mapping[str, str],
    listes: Mapping[str, Sequence[str]],
    poses: Mapping[str, tuple[str, int, str | None]],
) -> dict[str, object]:
    """Les textes d'une fiche à relire, assemblés comme ceux d'une fiche relue.

    Même assemblage que l'export principal (`fiche_exportee`) — le rôle de l'élément
    ajouté se lit sur la même décomposition — mais seuls les champs de texte sortent :
    la décomposition, le pinyin et les niveaux restent ceux de `familles/`.
    """
    assemblee = fiche_exportee(
        c,
        noeuds=noeuds,
        decompositions=decompositions,
        pinyin=pinyin,
        listes=listes,
        poses=poses,
        relues={c: a_relire},
    ).model_dump()
    return {"c": c, "statut": STATUT_APERCU, **{k: assemblee[k] for k in CHAMPS_FICHE_APERCU}}


def document_apercu_famille(
    racine: str, fiches: Sequence[Mapping[str, object]], version: str
) -> dict[str, object]:
    """Le JSON écrit dans `apercu/familles/<racine>.json` : les fiches à relire d'une famille."""
    return {
        **_en_tete_apercu(version, "fiches à relire du pipeline wenlu (`data/sources/fiches/`)"),
        "racine": racine,
        "fiches": [dict(f) for f in fiches],
    }


def document_apercu_conte(
    conte: str, versions: Sequence[contes_mod.Version], version_export: str
) -> dict[str, object]:
    """Le JSON écrit dans `apercu/contes/<id>.json` : les versions à relire d'un conte.

    Le format de `contes/<id>.json`, plus le statut, en tête et sur chaque version.
    """
    document = document_conte(conte, versions, version_export)
    for lue in document["versions"].values():  # type: ignore[union-attr]
        lue["statut"] = STATUT_APERCU  # type: ignore[index]
    return {
        **_en_tete_apercu(version_export, str(document["source"])),
        **{k: v for k, v in document.items() if k not in ENTETE_LICENCE and k != "version"},
    }


def document_apercu_index(
    version: str,
    familles: Sequence[tuple[str, str, Sequence[str]]],
    contes: Mapping[str, Sequence[contes_mod.Version]],
    lettres: int = 0,
) -> dict[str, object]:
    """Le JSON écrit dans `apercu/index.json` : ce que l'aperçu porte, et où.

    `familles` : la racine, le fichier et les caractères qui y ont une fiche à relire,
    pour que l'app ne demande que les fichiers qui existent. `lettres` : le nombre de
    lettres de Que à relire ; `apercu/lettres.json` n'est recensé que s'il y en a.
    """
    en_plus: dict[str, object] = {"lettres": f"{APERCU}/lettres.json"} if lettres else {}
    return {
        **_en_tete_apercu(version, "fiches et contes à relire du pipeline wenlu"),
        "compte": {
            "fiches": sum(len(cs) for _, _, cs in familles),
            "contes": len(contes),
            "versions": sum(len(v) for v in contes.values()),
            **({"lettres": lettres} if lettres else {}),
        },
        "familles": [
            {"racine": racine, "fichier": fichier, "caracteres": list(cs)}
            for racine, fichier, cs in familles
        ],
        "contes": [
            {
                "id": conte,
                "titre_fr": versions[0].titre_fr,
                "titre_en": versions[0].titre_en,
                "seuils": [v.seuil for v in versions],
                "fichier": f"{APERCU}/contes/{conte}.json",
                "statut": STATUT_APERCU,
            }
            for conte, versions in sorted(contes.items())
        ],
        **en_plus,
    }


def assembler_apercu(
    version: str,
    *,
    per: Perimetre,
    noeuds: Mapping[str, Noeud],
    decompositions: Mapping[str, Mapping[str, object]],
    pinyin: Mapping[str, str],
    listes: Mapping[str, Sequence[str]],
    poses: Mapping[str, tuple[str, int, str | None]],
    fiches: Path | None = None,
    contes: Path | None = None,
) -> dict[str, str]:
    """Les fichiers de `apercu/`, datés d'un jeton. Vide quand il n'y a rien à relire.

    Une fiche à relire d'un caractère hors du périmètre n'a pas de famille où se
    ranger : elle attend que le périmètre l'atteigne.
    """
    a_relire = charger_fiches_a_relire(fiches)
    versions = charger_contes_a_relire(contes)
    textes: dict[str, str] = {}
    familles: list[tuple[str, str, list[str]]] = []
    for racine, membres in per.familles:
        entrees = [
            fiche_apercu(
                c,
                a_relire[c],
                noeuds=noeuds,
                decompositions=decompositions,
                pinyin=pinyin,
                listes=listes,
                poses=poses,
            )
            for c in membres
            if c in a_relire
        ]
        if not entrees:
            continue
        nom = f"{APERCU}/familles/{nom_fichier(racine)}.json"
        textes[nom] = _json(document_apercu_famille(racine, entrees, version))
        familles.append((racine, nom, [str(e["c"]) for e in entrees]))
    for conte, lues in sorted(versions.items()):
        textes[f"{APERCU}/contes/{conte}.json"] = _json(document_apercu_conte(conte, lues, version))
    # Les lettres de Que à relire (story 4b.8) : un seul fichier, `lettres.py` l'assemble.
    lettres = lettres_mod.lettres(statut=lettres_mod.A_RELIRE)
    if lettres:
        textes[f"{APERCU}/lettres.json"] = _json(
            lettres_mod.document(lettres, en_tete=en_tete_lettres(version), statut=STATUT_APERCU)
        )
    if textes:
        textes[f"{APERCU}/index.json"] = _json(
            document_apercu_index(version, familles, versions, lettres=len(lettres))
        )
    return textes


def document_index(
    *,
    version: str,
    empreinte: str,
    per: Perimetre,
    noeuds: Mapping[str, Noeud],
    listes: Mapping[str, Sequence[str]],
    parcours: Mapping[str, Mapping[str, object]],
    relues: Mapping[str, fiches_mod.Fiche],
    contes: Mapping[str, Sequence[contes_mod.Version]],
    fichiers: Mapping[str, str],
    apercu: bool = False,
) -> dict[str, object]:
    """Le JSON écrit dans `index.json` : la porte d'entrée de l'app.

    `date` est le seul champ qui change à contenu égal — et encore : l'export la
    relit de la version précédente tant que rien d'autre n'a bougé. `apercu`, le
    fichier qui recense les textes à relire, n'y figure que s'il y en a.
    """
    familles = []
    for racine, membres in per.familles:
        relus = sum(1 for c in membres if c in relues)
        familles.append(
            {
                "racine": racine,
                "fichier": fichiers[racine],
                "traits": fichiers[racine].replace("familles/", "traits/"),
                "n": len(membres),
                "avancement_possible": round(relus / len(membres), 3) if membres else 0.0,
            }
        )
    document: dict[str, object] = {
        "version": version,
        "date": JETON_DATE,
        "empreinte": empreinte,
        "license": LICENCE_PROPRIETAIRE,
        "source": SOURCE_FAMILLES,
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `wenlu export`",
        "norme": "GF 0014-2009",
        "perimetre": PERIMETRE,
        "licences": "LICENCES.md",
        "compte": {
            "familles": len(per.familles),
            "caracteres": len(per.caracteres),
            "briques": sum(1 for c in per.caracteres if noeuds[c].genre == BRIQUE),
            "muettes": sum(1 for c in per.caracteres if noeuds[c].genre == MUETTE),
            "decoupees": sum(1 for c in per.caracteres if noeuds[c].genre == DECOUPEE),
            "fiches_relues": sum(1 for c in per.caracteres if c in relues),
            "contes": len(contes),
        },
        "listes": {nom: list(listes.get(nom) or ()) for nom in LISTES_CIBLES},
        "parcours": {
            nom: {
                "liste": str(document.get("liste", "")),
                "regle": str(document.get("regle", "")),
                "jours": [
                    {
                        "jour": int(j["jour"]),
                        "brique": j["brique"],
                        "composes": list(j["composes"]),
                        "non_reconcilie": bool(j["non_reconcilie"]),
                    }
                    for j in document.get("jours") or ()  # type: ignore[union-attr]
                ],
            }
            for nom, document in sorted(parcours.items())
        },
        "familles": familles,
        "contes": [
            {
                "id": conte,
                **titre_original(conte),
                "titre_fr": versions[0].titre_fr,
                "titre_en": versions[0].titre_en,
                "seuils": [v.seuil for v in versions],
                "fichier": f"contes/{conte}.json",
            }
            for conte, versions in sorted(contes.items())
        ],
        # Ce que le catalogue prévoit : la bibliothèque montre chaque récit et ses niveaux,
        # écrits ou pas encore (story 1.7, 2c.2).
        "catalogue": catalogue_des_contes(),
        "paires": "paires.json",
        "fetes": "fetes.json",
        "saisons": "saisons.json",
        "devinettes": "devinettes.json",
        "eclair": "eclair.json",
        "coquilles": "coquilles.json",
        "cuisine": "cuisine.json",
        "lettres": "lettres.json",
        "wechat": "wechat.json",
        "heros": "heros.json",
    }
    if apercu:
        document["apercu"] = f"{APERCU}/index.json"
    return document


# -------------------------------------------------------------------------- licences


#: Une ligne du tableau de `LICENCES.md` : ce que l'export embarque, et à quel titre.
TABLEAU_LICENCES: tuple[tuple[str, str, str, str, str], ...] = (
    (
        SOURCE_TRAITS,
        "tracés et médianes (`traits/`)",
        LICENCE_TRAITS,
        "Copyright (C) 1999 Arphic Technology Co., Ltd.",
        f"`{ARPHIC}` (racine de l'export et `traits/`)",
    ),
    (
        "Unihan (Unicode Character Database)",
        "pinyin (`kMandarin`) des fiches",
        "Unicode License",
        "Copyright © 1991-2009 Unicode, Inc.",
        f"`{UNICODE_NOTICE}`",
    ),
    (
        "Make Me a Hanzi — dictionary.txt",
        "chaîne IDS réconciliée avec GF 0014-2009 (`parts`, `sources: [\"makemeahanzi\"]`)",
        "LGPL 3.0 ou ultérieure",
        "Copyright (C) 2016 Shaunak Kishore",
        "https://www.gnu.org/licenses/lgpl-3.0.html — question ouverte, voir ci-dessous",
    ),
    (
        "cjk-decomp",
        "chaîne IDS de repli (`sources: [\"cjk-decomp\"]`)",
        "MIT (au choix parmi six licences)",
        "Copyright (c) Gavin Grover",
        "https://github.com/amake/cjk-decomp",
    ),
    (
        "CC-CEDICT (MDBG)",
        "mots candidats (hanzi et pinyin) des fiches relues ; mots du dictionnaire éclair"
        " (le mot seul, `eclair.json`)",
        "CC BY-SA 4.0",
        "CC-CEDICT, publié par MDBG, CC BY-SA 4.0 — fichier modifié",
        "https://creativecommons.org/licenses/by-sa/4.0/",
    ),
    (
        "Norme GF 0014-2009",
        "les 514 composants : règle de décomposition",
        "texte normatif, non reproduit",
        "《现代常用字部件及部件名称规范》",
        "—",
    ),
    (
        "Seuils sinographiques (Éducation nationale) et référentiel HSK 3.0",
        "listes cibles (`listes`, `parcours`)",
        "publications officielles, listes de faits",
        "Eduscol ; Chinese Testing International",
        "—",
    ),
    (
        "Calendrier luni-solaire chinois",
        "dates des fêtes (`fetes.json`) et des termes solaires (`saisons.json`),"
        " calculées par lunar_python",
        "faits de calendrier ; bibliothèque MIT, non embarquée",
        "lunar_python, Copyright (c) 6tail",
        "https://github.com/6tail/lunar-python",
    ),
    (
        "Surcharges du pipeline wenlu (`data/sources/surcharges/`)",
        "pinyin et IDS corrigés, chacun avec sa raison (`sources: [\"surcharge\"]`)",
        LICENCE_PROPRIETAIRE,
        "corrections relues des sources ci-dessus",
        "—",
    ),
    (
        "Fiches, contes, paires, fêtes, saisons, devinettes, dictionnaire éclair, coquilles, cuisine,"
        " lettres de Que, message WeChat, personnage (pipeline wenlu)",
        "`familles/`, `contes/`, `paires.json`, `fetes.json`, `saisons.json`, `devinettes.json`,"
        " `eclair.json`, `coquilles.json`, `cuisine.json`, `lettres.json`, `wechat.json`,"
        " `heros.json`, et `apercu/` pour les textes encore à relire",
        LICENCE_PROPRIETAIRE,
        "textes rédigés pour l'app, relus",
        "—",
    ),
)


def licences_md(version: str) -> str:
    """`LICENCES.md` : chaque source, sa licence, l'attribution, où lire le texte."""
    lignes = [
        f"# Licences des données exportées (version {version})",
        "",
        "Écrit par `wenlu export`. Fait foi pour ce que l'app embarque ;",
        "`docs/sources-licences.md` fait foi pour la décision d'ensemble.",
        "",
        "| Source | Usage dans l'export | Licence | Attribution | Texte de la licence |",
        "|---|---|---|---|---|",
    ]
    for source, usage, licence, attribution, texte in TABLEAU_LICENCES:
        lignes.append(f"| {source} | {usage} | {licence} | {attribution} | {texte} |")
    lignes += [
        "",
        "## Séparation des fichiers",
        "",
        "Les trois régimes ne se mélangent jamais dans un même fichier"
        " (`docs/sources-licences.md` §2.1 et §8) :",
        "",
        f"- `traits/` : tracés sous {LICENCE_TRAITS}, avec `{ARPHIC}` inaltéré à côté"
        " et `traits/MODIFICATIONS.md` qui dit comment et quand ils ont été dérivés.",
        "- `familles/`, `contes/`, `paires.json`, `fetes.json`, `saisons.json`, `devinettes.json`,"
        " `eclair.json`, `coquilles.json`, `cuisine.json`, `lettres.json`, `wechat.json`, `heros.json`,"
        " `apercu/` :"
        " décomposition canonique et"
        " textes rédigés pour l'app, propriétaires.",
        f"- `{UNICODE_NOTICE}` : notice de permission Unicode, qui couvre le pinyin.",
        "",
        "## Ce que l'export ne contient pas",
        "",
        "- Aucune définition anglaise : ni `kDefinition` d'Unihan, ni CC-CEDICT"
        " (`docs/sources-licences.md` §4.2). Les mots exportés ne portent que le"
        " hanzi, le pinyin et les traductions rédigées pour l'app.",
        "- Aucun texte de `dictionary.txt` : ni définition, ni étymologie anglaise"
        " (§2.2).",
        "- Aucune fiche, aucun conte ni aucune lettre non relus hors de `apercu/` (brief §17). Ce dossier"
        " porte les textes encore à relire, chacun marqué `statut: \"a_relire\"`, que"
        " l'app ne charge que sur demande (Réglages, mode relecture)."
        " Un texte rejeté n'est nulle part.",
        "",
        "## Question ouverte",
        "",
        "La décomposition exportée descend la chaîne IDS de Make Me a Hanzi"
        " (`dictionary.txt`, LGPL 3.0+) jusqu'aux composants de GF 0014-2009."
        " `docs/sources-licences.md` §2.2 écarte `dictionary.txt` de l'embarqué."
        " La liste de composants qui en résulte est une donnée factuelle normalisée"
        " par une autre source, mais le point n'est pas tranché : chaque fiche nomme"
        " la source de sa décomposition (`sources`) pour que la décision reste"
        " possible fichier par fichier.",
        "",
        "## Obligations hors app",
        "",
        "- Publier les fichiers de `traits/` sur le site public, avec"
        f" `{ARPHIC}` et la note de modification (APL §2 b).",
        "- Reprendre ce tableau sur l'écran « Licences » des Réglages et sur le site.",
        "",
    ]
    return "\n".join(lignes)


def _nombre(x: float) -> str:
    """Un nombre à la française, sans zéro inutile : 1,3194 ; −30,5 ; 0."""
    texte = f"{x:.4f}".rstrip("0").rstrip(".")
    return texte.replace("-", "−").replace(".", ",")


def section_decoupes(decoupes: Sequence[Mapping[str, object]]) -> list[str]:
    """La part de `MODIFICATIONS.md` qui décrit chaque composant découpé."""
    if not decoupes:
        return []
    lignes = [
        "## Composants découpés dans un caractère hôte",
        "",
        f"{len(decoupes)} composants de la norme GF 0014-2009 n'ont pas de tracé propre"
        " dans `graphics.txt`. Leurs tracés et leurs médianes sont ceux d'un caractère"
        " hôte qui les contient, réduits aux seuls traits désignés, dans l'ordre"
        " d'écriture de l'hôte ; aucun trait n'est dessiné ni retouché. Seule"
        " transformation : un recadrage dans la boîte de 1024, l'homothétie"
        " x' = e·x + dx, y' = e·y + dy appliquée à chaque coordonnée des tracés et des"
        " médianes, puis arrondie à l'entier. Elle porte la boîte englobante des traits"
        f" retenus au centre ({_nombre(decoupes_mod.CENTRE_BOITE[0])} ;"
        f" {_nombre(decoupes_mod.CENTRE_BOITE[1])}), son plus grand côté à"
        f" {_nombre(decoupes_mod.CIBLE)} unités, sans agrandir plus de"
        f" {_nombre(decoupes_mod.ECHELLE_MAX)} fois. Table versionnée :"
        " `data/sources/surcharges/decoupes.tsv` du dépôt.",
        "",
        "| Composant | Hôte | Traits de l'hôte retenus (à partir de 0) | e | dx | dy |",
        "|---|---|---|---|---|---|",
    ]
    for d in decoupes:
        indices = ", ".join(str(i) for i in d["indices"])  # type: ignore[attr-defined]
        e, dx, dy = (float(d[k]) for k in ("echelle", "dx", "dy"))  # type: ignore[arg-type]
        lignes.append(
            f"| {d['c']} | {d['hote']} | {indices} (sur {d['traits_hote']}) |"
            f" {_nombre(e)} | {_nombre(dx)} | {_nombre(dy)} |"
        )
    return lignes + [""]


def modifications_md(
    version: str, caracteres: int, decoupes: Sequence[Mapping[str, object]] = ()
) -> str:
    """`traits/MODIFICATIONS.md` : la mention exigée par l'APL §2 a), en tête du dossier.

    `decoupes` : les découpes des composants exportés (`decoupes.charger`).
    """
    retouche = (
        "- Les tracés et les médianes ne sont pas retouchés : ni arrondi, ni"
        " simplification, ni renommage."
        if not decoupes
        else "- Les tracés et les médianes ne sont pas retouchés — ni arrondi, ni"
        " simplification, ni renommage —, hors les composants découpés décrits"
        " ci-dessous."
    )
    return "\n".join(
        [
            "# Tracés dérivés de Make Me a Hanzi",
            "",
            f"Version de l'export : {version}. Dérivés le {JETON_JOUR}.",
            "",
            f"Source : {SOURCE_TRAITS}, {URL_TRAITS}",
            f"Licence : {LICENCE_TRAITS}, texte intégral et inaltéré dans `{ARPHIC}`.",
            "",
            "## Modifications apportées",
            "",
            "- Conversion de format : les lignes JSON de `graphics.txt` deviennent un"
            " fichier par famille, `{\"<caractère>\": {\"s\": [tracés], \"m\": [médianes]}}`.",
            f"- Sous-ensemble : {caracteres} caractères seulement — le seuil 255, le"
            " HSK 1, les caractères dessinés des fêtes et des termes solaires, et leurs"
            " briques.",
            retouche,
            "",
            *section_decoupes(decoupes),
            "Chaque fichier de ce dossier porte la même mention dans son en-tête"
            " (`license`, `source`, `source_url`, `modified`), comme l'exige l'APL §2 a).",
            "",
        ]
    )


# -------------------------------------------------------------------------- écriture


def nom_fichier(racine: str) -> str:
    """Nom de fichier d'une famille : la racine, ou ses points de code si elle gêne.

    Un composant de la norme sans point de code s'écrit en IDS, sur plusieurs
    caractères : il prend alors un nom en `U+XXXX`, plus lisible dans une URL
    qu'une suite d'opérateurs.
    """
    interdits = set('<>:"/\\|?*') | {chr(i) for i in range(32)}
    if len(racine) == 1 and racine not in interdits:
        return racine
    return "-".join(f"U+{ord(c):04X}" for c in racine)


def _json(contenu: object) -> str:
    return json.dumps(contenu, ensure_ascii=False, indent=1) + "\n"


def _json_compact(contenu: object) -> str:
    """Les traits sont des milliers de nombres : indentés, ils pèsent dix fois plus."""
    return json.dumps(contenu, ensure_ascii=False, separators=(",", ":")) + "\n"


@dataclass
class Rapport:
    """Ce qu'un export a écrit : de quoi le dire en une ligne et le tester."""

    version: str
    dossier: Path
    date: str
    empreinte: str
    familles: int
    caracteres: int
    briques: int
    fiches_relues: int
    contes: int
    paires: int
    octets: int
    octets_traits: int
    apercu_fiches: int = 0
    apercu_versions: int = 0
    octets_apercu: int = 0
    fichiers: list[str] = field(default_factory=list)
    supprimes: list[str] = field(default_factory=list)

    def en_lignes(self) -> dict[str, object]:
        return {
            "version": self.version,
            "dossier": str(self.dossier),
            "date": self.date,
            "empreinte": self.empreinte,
            "familles": self.familles,
            "caracteres": f"{self.caracteres} dont {self.briques} briques",
            "fiches_relues": self.fiches_relues,
            "contes": self.contes,
            "paires": self.paires,
            "fichiers": len(self.fichiers),
            "taille": f"{self.octets / 1024:.0f} Kio dont {self.octets_traits / 1024:.0f} Kio de traits",
            "apercu": f"{self.apercu_fiches} fiches et {self.apercu_versions} versions de contes à relire,"
            f" {self.octets_apercu / 1024:.0f} Kio",
            "supprimes": len(self.supprimes),
        }


def _maintenant() -> datetime:
    return datetime.now(timezone.utc)


def _dater(textes: Mapping[str, str], moment: datetime) -> dict[str, str]:
    """Remplace les jetons de date : le contenu ne dépend plus de l'heure d'écriture."""
    jour = moment.strftime("%Y-%m-%d")
    instant = moment.strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        chemin: texte.replace(JETON_DATE, instant).replace(JETON_JOUR, jour)
        for chemin, texte in textes.items()
    }


def _dates_ecrites(modele: str, ecrit: str) -> tuple[str, str] | None:
    """Les dates (jour, instant) qu'un fichier déjà écrit porte à la place des jetons.

    `None` si le fichier écrit ne correspond pas au modèle : son contenu a changé.
    """
    motif = re.escape(modele)
    for jeton, nom, forme in (
        (JETON_JOUR, "jour", r"\d{4}-\d{2}-\d{2}"),
        (JETON_DATE, "instant", r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"),
    ):
        echappe = re.escape(jeton)
        if echappe in motif:
            premier = motif.index(echappe)
            motif = (
                motif[:premier]
                + f"(?P<{nom}>{forme})"
                + motif[premier + len(echappe):].replace(echappe, f"(?P={nom})")
            )
    trouve = re.fullmatch(motif, ecrit, flags=re.S)
    if trouve is None:
        return None
    groupes = trouve.groupdict()
    return groupes.get("jour") or "", groupes.get("instant") or ""


def _dater_par_fichier(dossier: Path, textes: Mapping[str, str], moment: datetime) -> dict[str, str]:
    """Date chaque fichier à part : un fichier dont le contenu n'a pas changé garde sa date.

    Seul un fichier réellement modifié prend la date du jour. Ainsi un changement qui ne
    touche que l'empreinte ne réécrit qu'`index.json`, et la note de modification de
    chaque fichier dérivé (licence Arphic §2 a) reste celle de son dernier changement.
    """
    neufs = _dater(textes, moment)
    finaux: dict[str, str] = {}
    for chemin, modele in textes.items():
        fichier = dossier / chemin
        ecrit = fichier.read_text(encoding="utf-8") if fichier.is_file() else None
        dates = _dates_ecrites(modele, ecrit) if ecrit is not None else None
        finaux[chemin] = ecrit if dates is not None else neufs[chemin]
    return finaux


#: Dossiers d'une version qu'une autre commande remplit : `export` les laisse
#: intacts. `wenlu audio exporter` écrit `audio/`, et le purger à chaque export
#: effaçait la voix de tous les caractères.
DOSSIERS_ETRANGERS: tuple[str, ...] = ("audio/",)


def _etranger(relatif: str) -> bool:
    """Vrai si ce chemin appartient à une autre commande que `export`."""
    return relatif.startswith(DOSSIERS_ETRANGERS)


def assembler(
    version: str = VERSION,
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    fiches: Path | None = None,
    contes: Path | None = None,
    paires: Path | None = None,
    licences: Path | None = None,
) -> tuple[dict[str, str], Perimetre, Mapping[str, fiches_mod.Fiche]]:
    """Construit tout l'export en mémoire, daté d'un jeton. Rien n'est écrit ici."""
    build = build or BUILD
    ingest = ingest or INGEST
    licences = licences or LICENCES_SOURCE

    noeuds = charger_noeuds(build)
    decompositions = charger_decompositions(build)
    listes = charger_listes(ingest)
    documents_parcours = charger_parcours(build)
    cibles = [c for nom in LISTES_CIBLES for c in listes.get(nom, ())]
    # Les caractères que les fêtes dessinent (anecdote, 福 du vœu) : leurs traits
    # doivent être exportés, `wenlu check` le vérifie.
    cibles += fetes_mod.caracteres_dessines(fetes_mod.charger_textes())
    # Le caractère à lire de chaque terme solaire : même règle.
    cibles += saisons_mod.caracteres_dessines(saisons_mod.charger_textes())
    # Les caractères de l'interface (la marque, les cases du menu) : même règle.
    cibles += caracteres_interface()
    # Les titres des rangs du personnage, dessinés au 放榜 et sur son écran : même règle.
    cibles += caracteres_heros()
    per = perimetre(noeuds, cibles)
    pinyin = charger_pinyin(ingest, per.caracteres)
    lectures = charger_lectures(ingest, per.caracteres)
    dans_le_perimetre = set(per.caracteres)
    # Les composants découpés dans un hôte : leurs traits rejoignent ceux de la source.
    decoupes =[d for d in decoupes_mod.charger(build) if str(d["c"]) in dans_le_perimetre]
    graphies = charger_graphies(ingest, per.caracteres, decoupes_mod.traits(build))
    decoupes_exportes = [str(d["c"]) for d in decoupes]
    relues = charger_fiches_relues(fiches)
    versions_contes = charger_contes_relus(contes)
    # Un groupe ne sert qu'aux caractères que l'app sait dessiner : on le réduit
    # au périmètre, et il tombe s'il n'y reste pas au moins deux formes à confondre.
    groupes = [
        retenus
        for groupe in charger_paires(paires)
        if len(retenus := [c for c in groupe if c in dans_le_perimetre]) >= 2
    ]
    poses = _jours_par_caractere(documents_parcours)

    textes: dict[str, str] = {}
    fichiers_familles: dict[str, str] = {}
    for racine, membres in per.familles:
        nom = f"familles/{nom_fichier(racine)}.json"
        fichiers_familles[racine] = nom
        liste_fiches = [
            fiche_exportee(
                c,
                noeuds=noeuds,
                decompositions=decompositions,
                pinyin=pinyin,
                listes=listes,
                poses=poses,
                relues=relues,
                lectures=lectures,
            )
            for c in membres
        ]
        famille = famille_exportee(racine, liste_fiches, version)
        textes[nom] = _json(document_famille(famille))
        textes[f"traits/{nom_fichier(racine)}.json"] = _json_compact(
            document_traits(racine, membres, graphies, version, decoupes_exportes)
        )

    for conte, versions in sorted(versions_contes.items()):
        textes[f"contes/{conte}.json"] = _json(document_conte(conte, versions, version))

    textes["paires.json"] = _json(document_paires(groupes, version))
    textes["fetes.json"] = _json(document_fetes(version, noeuds, pinyin))
    textes["saisons.json"] = _json(document_saisons(version, noeuds, pinyin))
    textes["devinettes.json"] = _json(
        document_devinettes(version, per, noeuds, decompositions, listes, pinyin, graphies, groupes)
    )
    apercu = assembler_apercu(
        version,
        per=per,
        noeuds=noeuds,
        decompositions=decompositions,
        pinyin=pinyin,
        listes=listes,
        poses=poses,
        fiches=fiches,
        contes=contes,
    )
    textes.update(apercu)
    textes["eclair.json"] = _json(document_eclair(version, per, noeuds, graphies))
    textes["coquilles.json"] = _json(document_coquilles(version, per, noeuds, graphies, groupes))
    textes["cuisine.json"] = _json(document_cuisine(version, per, noeuds, documents_parcours))
    textes["lettres.json"] = _json(
        lettres_mod.document(lettres_mod.lettres(statut=lettres_mod.RELU), en_tete=en_tete_lettres(version))
    )
    textes["wechat.json"] = _json(document_wechat(version, per, noeuds, documents_parcours, ingest))
    textes["heros.json"] = _json(document_heros(version, per, noeuds))
    textes["LICENCES.md"] = licences_md(version)
    textes["traits/MODIFICATIONS.md"] = modifications_md(version, len(graphies), decoupes)
    for nom in (ARPHIC, UNICODE_NOTICE):
        texte = (licences / nom).read_text(encoding="utf-8")
        textes[nom] = texte
        if nom == ARPHIC:
            textes[f"traits/{nom}"] = texte

    empreinte = empreinte_build(
        fichiers_sources(build=build, ingest=ingest, fiches=fiches, contes=contes)
    )
    textes["index.json"] = _json(
        document_index(
            version=version,
            empreinte=empreinte,
            per=per,
            noeuds=noeuds,
            listes=listes,
            parcours=documents_parcours,
            relues=relues,
            contes=versions_contes,
            fichiers=fichiers_familles,
            apercu=bool(apercu),
        )
    )
    return textes, per, relues


def export(
    version: str = VERSION,
    *,
    destination: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    fiches: Path | None = None,
    contes: Path | None = None,
    paires: Path | None = None,
    licences: Path | None = None,
    moment: datetime | None = None,
) -> Rapport:
    """Écrit `app/public/data/<version>/`. Idempotent : deux passes, mêmes octets.

    Tout ce que l'export n'écrit pas est effacé du dossier de version — sauf les
    dossiers d'une autre commande (`DOSSIERS_ETRANGERS`).
    """
    textes, per, relues = assembler(
        version,
        build=build,
        ingest=ingest,
        fiches=fiches,
        contes=contes,
        paires=paires,
        licences=licences,
    )
    dossier = (destination or EXPORT) / version
    dossier.mkdir(parents=True, exist_ok=True)

    finaux = _dater_par_fichier(dossier, textes, moment or _maintenant())

    supprimes = []
    for fichier in sorted(dossier.rglob("*")):
        if fichier.is_file():
            relatif = str(fichier.relative_to(dossier)).replace("\\", "/")
            if relatif not in finaux and not _etranger(relatif):
                fichier.unlink()
                supprimes.append(relatif)
    # Un dossier vidé part avec ses fichiers : `apercu/` disparaît quand tout est relu.
    for sous in sorted((d for d in dossier.rglob("*") if d.is_dir()), key=lambda d: -len(d.parts)):
        relatif = str(sous.relative_to(dossier)).replace("\\", "/") + "/"
        if not _etranger(relatif) and not any(sous.iterdir()):
            sous.rmdir()
    for relatif, texte in sorted(finaux.items()):
        chemin = dossier / relatif
        chemin.parent.mkdir(parents=True, exist_ok=True)
        if not chemin.exists() or chemin.read_text(encoding="utf-8") != texte:
            chemin.write_text(texte, encoding="utf-8")

    index = json.loads(finaux["index.json"])
    octets = {r: len(t.encode("utf-8")) for r, t in finaux.items()}
    apercu = json.loads(finaux[f"{APERCU}/index.json"]) if f"{APERCU}/index.json" in finaux else None
    return Rapport(
        version=version,
        dossier=dossier,
        date=str(index["date"]),
        empreinte=str(index["empreinte"]),
        familles=len(per.familles),
        caracteres=len(per.caracteres),
        briques=int(index["compte"]["briques"]),
        fiches_relues=sum(1 for c in per.caracteres if c in relues),
        contes=len(index["contes"]),
        paires=len(json.loads(finaux["paires.json"])["paires"]),
        octets=sum(octets.values()),
        octets_traits=sum(v for r, v in octets.items() if r.startswith("traits/")),
        apercu_fiches=int(apercu["compte"]["fiches"]) if apercu else 0,
        apercu_versions=int(apercu["compte"]["versions"]) if apercu else 0,
        octets_apercu=sum(v for r, v in octets.items() if r.startswith(f"{APERCU}/")),
        fichiers=sorted(finaux),
        supprimes=supprimes,
    )


# ----------------------------------------------------------------------------- check


#: En-tête exigé de chaque JSON exporté (`docs/sources-licences.md` §8).
ENTETE_LICENCE: tuple[str, ...] = ("license", "source", "source_url", "modified")

#: Textes que chaque version exportée doit porter, en plus des JSON : l'APL §1
#: veut sa licence inaltérée à côté des tracés, l'APL §2 a) la note de
#: modification, et le pinyin d'Unihan sa notice de permission.
TEXTES_DE_LICENCE: tuple[str, ...] = (
    ARPHIC,
    UNICODE_NOTICE,
    "LICENCES.md",
    f"traits/{ARPHIC}",
    "traits/MODIFICATIONS.md",
)


def fautes_de_licence(relatif: str, document: object) -> list[str]:
    """Ce qui cloche dans un fichier exporté, du point de vue des licences.

    Deux règles, celles du §8 : tout fichier porte son en-tête, et aucun ne mêle
    deux régimes — un tracé sous Arphic Public License ne voisine jamais avec un
    texte propriétaire dans le même fichier.
    """
    if not isinstance(document, dict):
        return ["document hors format"]
    fautes = [f"en-tête sans {cle}" for cle in ENTETE_LICENCE if not document.get(cle)]
    if relatif.startswith("traits/"):
        if document.get("license") != LICENCE_TRAITS:
            fautes.append(f"tracés hors {LICENCE_TRAITS}")
        etrangers = set(document) - set(ENTETE_LICENCE) - {"version", "license_file", "traits"}
        if etrangers:
            fautes.append(f"clés étrangères aux tracés : {' '.join(sorted(etrangers))}")
        return fautes
    if document.get("license") == LICENCE_TRAITS:
        fautes.append(f"{LICENCE_TRAITS} hors de traits/")
    for fiche in document.get("fiches") or ():
        if fiche.get("traits") or fiche.get("medianes"):
            fautes.append(f"tracés dans une fiche propriétaire : {fiche.get('c')}")
    return fautes


def fautes_d_apercu(
    dossier: Path,
    index: Mapping[str, object],
    statuts_fiches: Mapping[str, str],
    statuts_contes: Mapping[tuple[str, int], str],
) -> tuple[list[str], int, int]:
    """Ce qui cloche dans l'aperçu d'une version : (fautes, fiches, versions de contes).

    L'aperçu ne porte que des textes à relire : chaque entrée est marquée `a_relire`, sa
    source l'est encore, et l'export principal ne la porte pas relue. Un texte relu (ou
    rejeté) n'y figure jamais. Tout fichier de `apercu/` est recensé par son index, et
    tout fichier recensé existe.
    """
    nom = dossier.name
    racine_apercu = dossier / APERCU
    entree = index.get("apercu")
    presents = (
        {str(f.relative_to(dossier)).replace("\\", "/") for f in racine_apercu.rglob("*") if f.is_file()}
        if racine_apercu.exists()
        else set()
    )
    if not entree:
        return ([f"{nom}/{r} : hors de l'index" for r in sorted(presents)], 0, 0)
    chemin_index = dossier / str(entree)
    if not chemin_index.is_file():
        return ([f"{nom}/{entree} : absent, l'index y renvoie"], 0, 0)
    apercu = json.loads(chemin_index.read_text(encoding="utf-8"))
    fautes: list[str] = []
    if apercu.get("statut") != STATUT_APERCU:
        fautes.append(f"{nom}/{entree} : statut {apercu.get('statut')!r}")
    recenses = {str(entree)}
    # Les lettres de Que à relire : leur contenu est contrôlé par `lettres.controles`.
    if apercu.get("lettres"):
        recenses.add(str(apercu["lettres"]))

    relues_principal: set[str] = set()
    for famille in index.get("familles") or ():  # type: ignore[union-attr]
        chemin = dossier / str(famille["fichier"])
        if chemin.is_file():
            document = json.loads(chemin.read_text(encoding="utf-8"))
            relues_principal |= {f["c"] for f in document.get("fiches") or () if f.get("statut") == "relu"}
    seuils_principal = {
        (str(c["id"]), int(s)) for c in index.get("contes") or () for s in c.get("seuils") or ()  # type: ignore[union-attr]
    }

    fiches = 0
    for famille in apercu.get("familles") or ():
        relatif = str(famille.get("fichier"))
        recenses.add(relatif)
        chemin = dossier / relatif
        if not chemin.is_file():
            fautes.append(f"{nom}/{relatif} : absent, l'aperçu y renvoie")
            continue
        document = json.loads(chemin.read_text(encoding="utf-8"))
        if document.get("statut") != STATUT_APERCU:
            fautes.append(f"{nom}/{relatif} : statut {document.get('statut')!r}")
        vus = [str(f.get("c")) for f in document.get("fiches") or ()]
        if sorted(vus) != sorted(str(c) for c in famille.get("caracteres") or ()):
            fautes.append(f"{nom}/{relatif} : caractères différents de ceux que l'index recense")
        for f in document.get("fiches") or ():
            fiches += 1
            c = str(f.get("c"))
            if f.get("statut") != STATUT_APERCU:
                fautes.append(f"{nom}/{relatif} : {c} au statut {f.get('statut')!r}")
            if statuts_fiches.get(c) != fiches_mod.A_RELIRE:
                fautes.append(f"{nom}/{relatif} : {c} n'est plus à relire ({statuts_fiches.get(c, 'sans fiche')})")
            if c in relues_principal:
                fautes.append(f"{nom}/{relatif} : {c} est relu dans l'export principal")

    versions = 0
    for conte in apercu.get("contes") or ():
        relatif = str(conte.get("fichier"))
        recenses.add(relatif)
        chemin = dossier / relatif
        if not chemin.is_file():
            fautes.append(f"{nom}/{relatif} : absent, l'aperçu y renvoie")
            continue
        document = json.loads(chemin.read_text(encoding="utf-8"))
        ident = str(document.get("conte"))
        if document.get("statut") != STATUT_APERCU or conte.get("statut") != STATUT_APERCU:
            fautes.append(f"{nom}/{relatif} : statut {document.get('statut')!r}")
        for seuil, lue in sorted((document.get("versions") or {}).items()):
            versions += 1
            cle = (ident, int(seuil))
            if lue.get("statut") != STATUT_APERCU:
                fautes.append(f"{nom}/{relatif} : version {seuil} au statut {lue.get('statut')!r}")
            if statuts_contes.get(cle) != contes_mod.A_RELIRE:
                fautes.append(
                    f"{nom}/{relatif} : version {seuil} n'est plus à relire ({statuts_contes.get(cle, 'absente')})"
                )
            if cle in seuils_principal:
                fautes.append(f"{nom}/{relatif} : version {seuil} est relue dans l'export principal")

    fautes += [f"{nom}/{r} : hors de l'index de l'aperçu" for r in sorted(presents - recenses)]
    return fautes, fiches, versions


def versions_exportees(destination: Path | None = None) -> list[Path]:
    """Les dossiers d'export qui portent un `index.json`, `demo/` exclu."""
    destination = destination or EXPORT
    if not destination.exists():
        return []
    return sorted(
        d for d in destination.iterdir() if d.is_dir() and (d / "index.json").exists()
    )


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    fiches: Path | None = None,
    contes: Path | None = None,
) -> list[Controle]:
    """Contrôles de l'export, pour `wenlu check`.

    « export à jour » compare l'empreinte de `index.json` à celle du build
    présent : un export périmé livrerait à l'app un contenu que le pipeline a
    déjà corrigé — bloquant. Un export absent n'est pas une faute : il est
    signalé. « séparation des licences » vérifie l'en-tête de chaque fichier et
    qu'aucun ne mêle deux régimes (`docs/sources-licences.md` §8) — bloquant.
    « familles sans fiche relue » compte ce qui reste à relire avant que l'app
    puisse enseigner ces familles : signalé, jamais bloquant. « caractères sans
    traits » liste ce que l'app ne saurait dessiner : signalé. « textes de licence »
    vérifie que les fichiers que l'APL et la notice Unicode exigent à côté des
    données sont bien là : leur absence est une faute de licence, donc bloquante.
    « aperçu » vérifie que `apercu/` ne porte que des textes encore à relire, jamais
    un texte relu ou rejeté (`fautes_d_apercu`) — bloquant.
    """
    dossiers = versions_exportees(destination)
    if not dossiers:
        return [
            Controle("export : à jour", True, "aucun export écrit : lancer `wenlu export`")
        ]

    attendue = empreinte_build(
        fichiers_sources(
            build=build or BUILD, ingest=ingest or INGEST, fiches=fiches, contes=contes
        )
    )
    perimes: list[str] = []
    sans_fiche: list[str] = []
    melanges: list[str] = []
    absents: list[str] = []
    fautes_apercu: list[str] = []
    apercu_fiches = 0
    apercu_versions = 0
    sans_traits: list[str] = []
    sans_lectures: list[str] = []
    total_familles = 0
    total_fichiers = 0
    statuts_fiches = {
        fiche.c: fiche.statut for fiche in map(fiches_mod.lire_fiche, fiches_mod.fiches_ecrites(fiches))
    }
    statuts_contes = {
        (v.conte, v.seuil): v.statut
        for v in map(contes_mod.lire_version, contes_mod.versions_ecrites(contes))
    }
    for dossier in dossiers:
        sans_traits += [f"{dossier.name}:{c}" for c in caracteres_sans_traits(dossier)]
        sans_lectures += [f"{dossier.name}:{c}" for c in caracteres_sans_lectures(dossier)]
        absents += [
            f"{dossier.name}/{relatif}"
            for relatif in TEXTES_DE_LICENCE
            if not (dossier / relatif).exists()
        ]
        index = json.loads((dossier / "index.json").read_text(encoding="utf-8"))
        if str(index.get("empreinte")) != attendue:
            perimes.append(dossier.name)
        fautes, n_fiches, n_versions = fautes_d_apercu(dossier, index, statuts_fiches, statuts_contes)
        fautes_apercu += fautes
        apercu_fiches += n_fiches
        apercu_versions += n_versions
        familles = index.get("familles") or []
        total_familles += len(familles)
        sans_fiche += [
            f"{dossier.name}:{f['racine']}" for f in familles if not f.get("avancement_possible")
        ]
        for chemin in sorted(dossier.rglob("*.json")):
            if _etranger(str(chemin.relative_to(dossier)).replace("\\", "/")):
                continue  # `audio/manifeste.json` a son propre régime, voir audio.py
            total_fichiers += 1
            melanges += [
                f"{dossier.name}/{chemin.relative_to(dossier)} : {faute}"
                for faute in fautes_de_licence(
                    str(chemin.relative_to(dossier)).replace("\\", "/"),
                    json.loads(chemin.read_text(encoding="utf-8")),
                )
            ]

    return [
        Controle(
            "export : à jour",
            not perimes,
            f"{len(dossiers)} version(s) contrôlée(s) ; empreinte du build {attendue}"
            if not perimes
            else f"périmé, à réexporter : {', '.join(perimes)}",
            bloquant=True,
        ),
        Controle(
            "export : séparation des licences",
            not melanges,
            f"{total_fichiers} fichiers : en-tête de licence présent, aucun mélange de régimes"
            if not melanges
            else f"{len(melanges)} écarts — " + " ; ".join(melanges[:5]),
            bloquant=True,
        ),
        Controle(
            "export : textes de licence",
            not absents,
            f"les {len(TEXTES_DE_LICENCE)} textes de licence sont à côté des données"
            if not absents
            else f"{len(absents)} absents : {', '.join(absents)}",
            bloquant=True,
        ),
        Controle(
            "export : aperçu",
            not fautes_apercu,
            f"{apercu_fiches} fiches et {apercu_versions} versions de contes, toutes à relire,"
            " aucune relue"
            if not fautes_apercu
            else f"{len(fautes_apercu)} écarts — " + " ; ".join(fautes_apercu[:5]),
            bloquant=True,
        ),
        Controle(
            "export : familles sans fiche relue",
            not sans_fiche,
            f"{len(sans_fiche)} familles sur {total_familles} n'ont aucune fiche relue"
            + (f" — {' '.join(sans_fiche[:8])}…" if sans_fiche else "")
            if sans_fiche
            else f"les {total_familles} familles exportées portent au moins une fiche relue",
        ),
        Controle(
            "export : caractères sans traits",
            not sans_traits,
            f"{len(sans_traits)} caractères exportés que l'app ne sait pas dessiner : {' '.join(sans_traits)}"
            if sans_traits
            else "tout caractère exporté a ses traits",
        ),
        Controle(
            "export : lectures",
            not sans_lectures,
            f"{len(sans_lectures)} caractères au pinyin exporté sans leurs lectures, pas de question"
            f" de ton pour eux : relancer `wenlu ingest` (lectures des dictionnaires d'Unihan)"
            f" puis `wenlu export` — {' '.join(sans_lectures[:8])}"
            if sans_lectures
            else "chaque caractère au pinyin exporté dit toutes ses lectures, la principale en tête",
        ),
    ]


def caracteres_sans_lectures(dossier: Path) -> list[str]:
    """Les caractères d'une version exportée qui ont un pinyin mais pas leurs lectures.

    Sans elles, l'app ne sait pas quelles syllabes sont d'autres lectures valides et ne
    pose pas la question de ton : ce n'est pas une faute, c'est signalé.
    """
    manquent: set[str] = set()
    for chemin in sorted((dossier / "familles").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        for f in document.get("fiches") or ():
            if f.get("pinyin") and not f.get("lectures"):
                manquent.add(str(f["c"]))
    return sorted(manquent)


def caracteres_sans_traits(dossier: Path) -> list[str]:
    """Les caractères d'une version exportée dont aucun fichier de `traits/` ne porte les tracés.

    L'app ne les dessinerait qu'avec une police, et le site ne leur fait pas de page.
    """
    fiches: set[str] = set()
    for chemin in sorted((dossier / "familles").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        fiches |= {str(f["c"]) for f in document.get("fiches") or ()}
    dessines: set[str] = set()
    for chemin in sorted((dossier / "traits").glob("*.json")):
        dessines |= set(json.loads(chemin.read_text(encoding="utf-8")).get("traits") or {})
    return sorted(fiches - dessines)
