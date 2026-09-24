"""Export JSON versionné par famille (story 1.6).

`zilin export --version 0.1.0` écrit `app/public/data/0.1.0/`, les seuls fichiers
que l'app lira. Rien n'est calculé ici : l'export assemble ce que `zilin build` a
produit (`decompositions.json`, `graphe.json`, `parcours-*.json`), les graphies,
le pinyin d'Unihan, les fiches et les contes relus.

Périmètre de la version 0.1.0 : les caractères du seuil 255 et du HSK 1, plus
toutes leurs briques (prérequis transitifs). Pas tout le dictionnaire : une
famille n'est exportée qu'avec ses membres du périmètre.

Séparation des licences (`docs/sources-licences.md` §8) — trois régimes, trois
familles de fichiers, jamais mêlés :

- `traits/<racine>.json` : tracés et médianes de `graphics.txt`, sous Arphic
  Public License. `ARPHICPL.TXT` est copié inaltéré à côté (§2.1, APL §1) et
  `traits/MODIFICATIONS.md` dit comment et quand ces fichiers ont été dérivés
  (APL §2 a). Chaque fichier porte la même mention dans son en-tête.
- `familles/<racine>.json` : décomposition canonique GF 0014-2009 et textes des
  fiches relues, propriétaires. Aucun tracé n'y entre.
- `paires.json`, `contes/<id>.json` : propriétaires, source citée.

Ce qui n'entre jamais dans l'export :

- les définitions anglaises, d'où qu'elles viennent — `kDefinition` d'Unihan ou
  CC-CEDICT (§4.2) : rien ne les lit ici, et un test relit l'export pour s'en
  assurer ;
- `dictionary.txt` et ce qui en dérive comme texte (§2.2). Sa chaîne IDS sert à
  la réconciliation et la décomposition exportée nomme sa source
  (`sources: ["makemeahanzi"]` ou `["cjk-decomp"]`) : la question de licence
  reste ouverte et l'export la pose noir sur blanc dans `LICENCES.md`, pour
  qu'elle se tranche caractère par caractère ;
- une fiche ou un conte qui n'est pas au statut `relu` (brief §17). Un caractère
  sans fiche relue s'exporte quand même — l'app a besoin de sa décomposition et
  de ses traits — avec les champs de texte vides et `statut: "sans_fiche"`.

Le pinyin vient d'Unihan (`kMandarin`, Unicode License), jamais de
`dictionary.txt` ni de CC-CEDICT.

Déterminisme : deux exports du même contenu écrivent les mêmes octets. Les
fichiers sont triés, les dictionnaires écrits dans un ordre fixe, et la date est
celle du dernier changement de contenu — elle est relue de l'export précédent
tant que rien n'a bougé. `index.json` porte l'empreinte du build dont il est
tiré ; `zilin check` la recalcule pour dire si l'export est à jour. Cette
empreinte couvre aussi le code qui écrit l'export — `FORMAT_EXPORT` et ce
fichier lui-même : corriger l'exporteur rend l'export périmé.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from pydantic import ValidationError

from . import contes as contes_mod
from . import fiches as fiches_mod
from .gf0014 import Controle
from .graphe import BRIQUE, MUETTE, PARCOURS
from .models import Brique, Famille, Fiche, Mot
from .outils import empreinte_fichier
from .paths import BUILD, DATA, EXPORT, GF0014, INGEST

#: Version par défaut de l'export.
VERSION = "0.1.0"

#: Version du format écrit par ce module. À incrémenter à chaque changement de
#: ce que l'export produit à entrées égales (clé ajoutée, ordre, règle de
#: sélection) : elle entre dans l'empreinte, et l'export versionné devient périmé.
FORMAT_EXPORT = 1

#: Le code de l'exporteur, lui aussi dans l'empreinte : un changement de ce
#: fichier où l'on aurait oublié `FORMAT_EXPORT` rend quand même l'export périmé.
EXPORTEUR = Path(__file__).resolve()

#: Listes cibles de la version 0.1.0 : le périmètre en découle.
LISTES_CIBLES: tuple[str, ...] = ("seuil-255", "hsk-1")

#: Niveau porté par un caractère de chaque liste, dans `Fiche.niveaux`.
NIVEAUX: dict[str, tuple[str, int]] = {"seuil-255": ("seuil", 255), "hsk-1": ("hsk", 1)}

PERIMETRE = "seuil 255 et HSK 1 : les caractères des deux listes et leurs briques"

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
    "décomposition GF 0014-2009 réconciliée par le pipeline zilin ;"
    " pinyin d'Unihan (kMandarin) ; textes rédigés pour l'app"
)
URL_PIPELINE = "https://github.com/jon-gyt/zilin"


class ExportImpossible(FileNotFoundError):
    """Le résultat de `zilin build` manque : rien à exporter."""


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
        ("decompositions", build / "decompositions.json"),
        ("graphe", build / "graphe.json"),
        *[(f"parcours-{nom}", build / f"parcours-{nom}.json") for nom in sorted(PARCOURS)],
        ("listes", ingest / "listes.json"),
        ("graphies", ingest / "graphies.json"),
        ("unihan", ingest / "unihan.json"),
        ("composants", GF0014 / "composants.tsv"),
        ("paires", PAIRES),
        ("arphicpl", LICENCES_SOURCE / ARPHIC),
        ("unicode", LICENCES_SOURCE / UNICODE_NOTICE),
    ]
    for chemin in fiches_mod.fiches_ecrites(fiches):
        lus.append((f"fiche:{chemin.stem}", chemin))
    for chemin in contes_mod.versions_ecrites(contes):
        lus.append((f"conte:{chemin.parent.name}/{chemin.stem}", chemin))
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
        raise ExportImpossible(f"{chemin} absent : lancer `zilin build`")
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
    """Les parcours écrits par `zilin build`, par nom."""
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


def charger_pinyin(ingest: Path, caracteres: Iterable[str]) -> dict[str, str]:
    """Pinyin d'Unihan (`kMandarin`) pour les caractères demandés, et eux seuls."""
    document = _lire(ingest / "unihan.json")
    assert isinstance(document, dict)
    voulus = set(caracteres)
    return {
        str(e["c"]): str(e.get("pinyin") or "")
        for e in document["caracteres"]
        if str(e["c"]) in voulus and e.get("pinyin")
    }


def charger_graphies(ingest: Path, caracteres: Iterable[str]) -> dict[str, dict[str, object]]:
    """Tracés et médianes de `graphics.txt` pour les caractères demandés."""
    document = _lire(ingest / "graphies.json")
    assert isinstance(document, list)
    voulus = set(caracteres)
    return {
        str(e["c"]): {"s": e["strokes"], "m": e["medians"]}
        for e in document
        if str(e["c"]) in voulus
    }


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

    relue = relues.get(c)
    if relue is None:
        return Fiche(
            c=c,
            pinyin=pinyin.get(c, ""),
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
    return Fiche(
        c=c,
        pinyin=pinyin.get(c, "") or (relue.pinyin[0] if relue.pinyin else ""),
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
        "modified": f"{JETON_JOUR} : assemblé par `zilin export`",
        "norme": "GF 0014-2009",
        **famille.model_dump(),
    }


def document_traits(
    racine: str, caracteres: Sequence[str], graphies: Mapping[str, Mapping[str, object]], version: str
) -> dict[str, object]:
    """Le JSON écrit dans `traits/<racine>.json`.

    Fichier sous Arphic Public License, séparé de tout le reste : il ne porte que
    des tracés, leur en-tête de licence et la mention de modification exigée par
    l'APL §2 a). Un caractère par clé, `{s: tracés, m: médianes}` comme
    `strokes-demo.json`.
    """
    return {
        "version": version,
        "license": LICENCE_TRAITS,
        "license_file": ARPHIC,
        "source": SOURCE_TRAITS,
        "source_url": URL_TRAITS,
        "modified": MODIF_TRAITS,
        "traits": {c: graphies[c] for c in caracteres if c in graphies},
    }


def document_paires(paires: Sequence[Sequence[str]], version: str) -> dict[str, object]:
    """Le JSON écrit dans `paires.json` : les caractères à ne pas confondre."""
    return {
        "version": version,
        "license": LICENCE_PROPRIETAIRE,
        "source": "data/sources/paires/paires.tsv (docs/jeux.md)",
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `zilin export`",
        "paires": [list(groupe) for groupe in paires],
    }


def document_conte(
    conte: str, versions: Sequence[contes_mod.Version], version_export: str
) -> dict[str, object]:
    """Le JSON écrit dans `contes/<id>.json` : un récit, une version par seuil."""
    tete = versions[0]
    return {
        "version": version_export,
        "license": LICENCE_PROPRIETAIRE,
        "source": f"récit traditionnel, {tete.ouvrage} (domaine public) ; texte réécrit pour l'app",
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `zilin export`",
        "conte": conte,
        "titre_fr": tete.titre_fr,
        "versions": {
            str(v.seuil): {
                "titre": v.titre,
                "phrases": [{"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr} for p in v.phrases],
                "glose": {c: v.glose[c] for c in sorted(v.glose)},
            }
            for v in versions
        },
    }


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
) -> dict[str, object]:
    """Le JSON écrit dans `index.json` : la porte d'entrée de l'app.

    `date` est le seul champ qui change à contenu égal — et encore : l'export la
    relit de la version précédente tant que rien d'autre n'a bougé.
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
    return {
        "version": version,
        "date": JETON_DATE,
        "empreinte": empreinte,
        "license": LICENCE_PROPRIETAIRE,
        "source": SOURCE_FAMILLES,
        "source_url": URL_PIPELINE,
        "modified": f"{JETON_JOUR} : assemblé par `zilin export`",
        "norme": "GF 0014-2009",
        "perimetre": PERIMETRE,
        "licences": "LICENCES.md",
        "compte": {
            "familles": len(per.familles),
            "caracteres": len(per.caracteres),
            "briques": sum(1 for c in per.caracteres if noeuds[c].genre == BRIQUE),
            "muettes": sum(1 for c in per.caracteres if noeuds[c].genre == MUETTE),
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
                "titre_fr": versions[0].titre_fr,
                "seuils": [v.seuil for v in versions],
                "fichier": f"contes/{conte}.json",
            }
            for conte, versions in sorted(contes.items())
        ],
        "paires": "paires.json",
    }


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
        "mots candidats (hanzi et pinyin) des fiches relues",
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
        "Fiches, contes, paires (pipeline zilin)",
        "`familles/`, `contes/`, `paires.json`",
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
        "Écrit par `zilin export`. Fait foi pour ce que l'app embarque ;",
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
        "- `familles/`, `contes/`, `paires.json` : décomposition canonique et textes"
        " rédigés pour l'app, propriétaires.",
        f"- `{UNICODE_NOTICE}` : notice de permission Unicode, qui couvre le pinyin.",
        "",
        "## Ce que l'export ne contient pas",
        "",
        "- Aucune définition anglaise : ni `kDefinition` d'Unihan, ni CC-CEDICT"
        " (`docs/sources-licences.md` §4.2). Les mots exportés ne portent que le"
        " hanzi, le pinyin et les traductions rédigées pour l'app.",
        "- Aucun texte de `dictionary.txt` : ni définition, ni étymologie anglaise"
        " (§2.2).",
        "- Aucune fiche ni aucun conte non relu (brief §17).",
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


def modifications_md(version: str, caracteres: int) -> str:
    """`traits/MODIFICATIONS.md` : la mention exigée par l'APL §2 a), en tête du dossier."""
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
            " HSK 1 et leurs briques.",
            "- Les tracés et les médianes ne sont pas retouchés : ni arrondi, ni"
            " simplification, ni renommage.",
            "",
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


def _date_precedente(dossier: Path) -> datetime | None:
    """La date de l'export déjà écrit, s'il y en a un de lisible."""
    index = dossier / "index.json"
    if not index.exists():
        return None
    try:
        date = json.loads(index.read_text(encoding="utf-8")).get("date")
        return datetime.strptime(str(date), "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


#: Dossiers d'une version qu'une autre commande remplit : `export` les laisse
#: intacts. `zilin audio exporter` écrit `audio/`, et le purger à chaque export
#: effaçait la voix de tous les caractères.
DOSSIERS_ETRANGERS: tuple[str, ...] = ("audio/",)


def _etranger(relatif: str) -> bool:
    """Vrai si ce chemin appartient à une autre commande que `export`."""
    return relatif.startswith(DOSSIERS_ETRANGERS)


def _identique(dossier: Path, textes: Mapping[str, str]) -> bool:
    """Vrai si le dossier porte exactement ces fichiers, au même contenu.

    Ce qui appartient à une autre commande (`audio/`) ne compte pas : l'export
    n'en est pas l'auteur et n'a pas à se croire périmé parce qu'il a bougé.
    """
    presents = {
        str(f.relative_to(dossier)).replace("\\", "/")
        for f in dossier.rglob("*")
        if f.is_file() and not _etranger(str(f.relative_to(dossier)).replace("\\", "/"))
    }
    if presents != set(textes):
        return False
    return all(
        (dossier / chemin).read_text(encoding="utf-8") == texte
        for chemin, texte in textes.items()
    )


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
    per = perimetre(noeuds, cibles)
    pinyin = charger_pinyin(ingest, per.caracteres)
    graphies = charger_graphies(ingest, per.caracteres)
    relues = charger_fiches_relues(fiches)
    versions_contes = charger_contes_relus(contes)
    # Un groupe ne sert qu'aux caractères que l'app sait dessiner : on le réduit
    # au périmètre, et il tombe s'il n'y reste pas au moins deux formes à confondre.
    dans_le_perimetre = set(per.caracteres)
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
            )
            for c in membres
        ]
        famille = famille_exportee(racine, liste_fiches, version)
        textes[nom] = _json(document_famille(famille))
        textes[f"traits/{nom_fichier(racine)}.json"] = _json_compact(
            document_traits(racine, membres, graphies, version)
        )

    for conte, versions in sorted(versions_contes.items()):
        textes[f"contes/{conte}.json"] = _json(document_conte(conte, versions, version))

    textes["paires.json"] = _json(document_paires(groupes, version))
    textes["LICENCES.md"] = licences_md(version)
    textes["traits/MODIFICATIONS.md"] = modifications_md(version, len(graphies))
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

    precedente = _date_precedente(dossier)
    date = precedente if precedente and _identique(dossier, _dater(textes, precedente)) else None
    finaux = _dater(textes, date or moment or _maintenant())

    supprimes = []
    for fichier in sorted(dossier.rglob("*")):
        if fichier.is_file():
            relatif = str(fichier.relative_to(dossier)).replace("\\", "/")
            if relatif not in finaux and not _etranger(relatif):
                fichier.unlink()
                supprimes.append(relatif)
    for relatif, texte in sorted(finaux.items()):
        chemin = dossier / relatif
        chemin.parent.mkdir(parents=True, exist_ok=True)
        if not chemin.exists() or chemin.read_text(encoding="utf-8") != texte:
            chemin.write_text(texte, encoding="utf-8")

    index = json.loads(finaux["index.json"])
    octets = {r: len(t.encode("utf-8")) for r, t in finaux.items()}
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
    """Contrôles de l'export, pour `zilin check`.

    « export à jour » compare l'empreinte de `index.json` à celle du build
    présent : un export périmé livrerait à l'app un contenu que le pipeline a
    déjà corrigé — bloquant. Un export absent n'est pas une faute : il est
    signalé. « séparation des licences » vérifie l'en-tête de chaque fichier et
    qu'aucun ne mêle deux régimes (`docs/sources-licences.md` §8) — bloquant.
    « familles sans fiche relue » compte ce qui reste à relire avant que l'app
    puisse enseigner ces familles : signalé, jamais bloquant. « textes de licence »
    vérifie que les fichiers que l'APL et la notice Unicode exigent à côté des
    données sont bien là : leur absence est une faute de licence, donc bloquante.
    """
    dossiers = versions_exportees(destination)
    if not dossiers:
        return [
            Controle("export : à jour", True, "aucun export écrit : lancer `zilin export`")
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
    total_familles = 0
    total_fichiers = 0
    for dossier in dossiers:
        absents += [
            f"{dossier.name}/{relatif}"
            for relatif in TEXTES_DE_LICENCE
            if not (dossier / relatif).exists()
        ]
        index = json.loads((dossier / "index.json").read_text(encoding="utf-8"))
        if str(index.get("empreinte")) != attendue:
            perimes.append(dossier.name)
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
            "export : familles sans fiche relue",
            not sans_fiche,
            f"{len(sans_fiche)} familles sur {total_familles} n'ont aucune fiche relue"
            + (f" — {' '.join(sans_fiche[:8])}…" if sans_fiche else "")
            if sans_fiche
            else f"les {total_familles} familles exportées portent au moins une fiche relue",
        ),
    ]
