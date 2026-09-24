"""Les messages de « La coquille » (story 4b.3) : sources, export, contrôles.

La coquille pose un court message écrit avec l'acquis, où un caractère a pris la place
d'un autre de son groupe à ne pas confondre : 今夫天气很好 (夫 pour 天). Il faut des
phrases, et l'app n'en rédige aucune : elles viennent de `data/sources/coquilles/`,
rédigées pour l'app, courtes, écrites avec les seuls caractères du seuil 255.

Chaque message nomme les caractères qu'on peut y piéger (`pieges`). L'intrus, lui, ne
s'écrit pas : c'est un autre membre du groupe de `paires.json`, que l'app choisit
parmi les caractères acquis et absents du message. L'export ne garde que les messages
dont tous les caractères se dessinent et dont au moins un piège a un intrus possible.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import typer

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import BUILD, DATA, EXPORT, LISTES

DOSSIER = DATA / "sources" / "coquilles"
COQUILLES = DOSSIER / "coquilles.tsv"

COLONNES = ("message", "pieges", "fr", "en", "source")

#: Un message de six à douze caractères chinois, comme dans l'app (`jeux.ts`).
MESSAGE_MIN = 6
MESSAGE_MAX = 12

#: De quoi jouer quatre manches sans revoir les mêmes messages, sans noyer la relecture.
OBJECTIF_MIN = 40
OBJECTIF_MAX = 60

#: Les messages s'écrivent avec les caractères de cette liste, et d'eux seuls.
LISTE = "seuil-255"

SOURCE_EXPORT = (
    "data/sources/coquilles/coquilles.tsv : messages rédigés pour l'app, à relire par le"
    " propriétaire ; intrus tirés des groupes de paires.json"
)

#: Les caractères chinois d'un texte : les idéogrammes unifiés et leurs extensions.
HAN = re.compile(r"[㐀-䶿一-鿿豈-﫿\U00020000-\U0003134f]")


def signes(texte: str) -> list[str]:
    """Les caractères chinois d'un message, sans la ponctuation."""
    return HAN.findall(texte)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Coquille:
    """Un message tel que la source le donne, avec sa ligne pour les contrôles."""

    message: str
    pieges: tuple[str, ...]
    fr: str
    en: str
    source: str
    numero: int = 0

    @property
    def id(self) -> str:
        """L'identifiant d'un message : ses caractères, sans la ponctuation."""
        return "".join(signes(self.message))


def charger(chemin: Path | None = None) -> list[Coquille]:
    """Les messages de `coquilles.tsv`, dans l'ordre du fichier."""
    lignes, _ = lire_tsv(chemin or COQUILLES)
    return [
        Coquille(
            message=l.cellules.get("message", ""),
            pieges=tuple(l.cellules.get("pieges", "").split()),
            fr=l.cellules.get("fr", ""),
            en=l.cellules.get("en", ""),
            source=l.cellules.get("source", ""),
            numero=l.numero,
        )
        for l in lignes
    ]


def charger_liste(nom: str = LISTE, dossier: Path | None = None) -> list[str]:
    """Une liste versionnée de `data/sources/listes/`, un caractère par ligne."""
    chemin = (dossier or LISTES) / f"{nom}.txt"
    return [
        l.strip()
        for l in chemin.read_text(encoding="utf-8").splitlines()
        if l.strip() and not l.lstrip().startswith("#")
    ]


def intrus(piege: str, message: Sequence[str], paires: Sequence[Sequence[str]]) -> list[str]:
    """Les intrus possibles d'un piège : les autres membres de ses groupes, absents du message."""
    out: list[str] = []
    for groupe in paires:
        if piege not in groupe:
            continue
        for x in groupe:
            if x != piege and x not in message and x not in out:
                out.append(x)
    return out


# ---------------------------------------------------------------------------- export


def document(
    version: str,
    *,
    caracteres: Iterable[str],
    paires: Sequence[Sequence[str]],
    racines: Mapping[str, str],
    en_tete: Mapping[str, object] | None = None,
    source: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `coquilles.json`.

    `caracteres` : ce que l'export dessine. Un message sort s'il se dessine en entier et
    si au moins un de ses pièges a un intrus dessinable dans `paires` (les groupes déjà
    réduits au périmètre) ; seuls ces pièges-là sont exportés. `racines` donne la famille
    de chaque caractère dessiné, message et intrus, pour que l'app trouve ses traits.
    """
    dessinables = set(caracteres)
    sorties: list[dict[str, object]] = []
    dessines: set[str] = set()
    for q in charger(source):
        s = signes(q.message)
        if not s or not all(c in dessinables for c in s):
            continue
        pieges = [
            p
            for p in dict.fromkeys(q.pieges)
            if p in s and any(x in dessinables for x in intrus(p, s, paires))
        ]
        if not pieges:
            continue
        dessines |= set(s)
        for p in pieges:
            dessines |= {x for x in intrus(p, s, paires) if x in dessinables}
        sorties.append({"id": q.id, "message": q.message, "pieges": pieges, "fr": q.fr, "en": q.en})
    return {
        **(en_tete or {}),
        "coquilles": sorties,
        "racines": {x: racines[x] for x in sorted(dessines) if x in racines},
    }


# ------------------------------------------------------------------------- contrôles


def fautes_sources(
    coquilles: Sequence[Coquille],
    liste: Iterable[str],
    paires: Sequence[Sequence[str]],
) -> list[str]:
    """Longueur, caractères hors liste, pièges hors paires ou sans intrus, champs vides, doublons."""
    permis = set(liste)
    fautes: list[str] = []
    vus: set[str] = set()
    for q in coquilles:
        ou = f"coquilles.tsv:{q.numero}"
        s = signes(q.message)
        if not MESSAGE_MIN <= len(s) <= MESSAGE_MAX:
            fautes.append(f"{ou} : {len(s)} caractères, pour {MESSAGE_MIN} à {MESSAGE_MAX}")
        hors = "".join(dict.fromkeys(c for c in s if c not in permis))
        if hors:
            fautes.append(f"{ou} : {hors} hors du {LISTE}")
        if q.id in vus:
            fautes.append(f"{ou} : message en double")
        vus.add(q.id)
        for champ, valeur in (("fr", q.fr), ("en", q.en), ("source", q.source)):
            if not valeur:
                fautes.append(f"{ou} : sans {champ}")
        if not q.pieges:
            fautes.append(f"{ou} : aucun piège")
        for p in q.pieges:
            if p not in s:
                fautes.append(f"{ou} : le piège {p} n'est pas dans le message")
            elif not any(p in g for g in paires):
                fautes.append(f"{ou} : le piège {p} n'a pas de groupe dans paires.tsv")
            elif not intrus(p, s, paires):
                fautes.append(f"{ou} : le piège {p} n'a aucun intrus absent du message")
    return fautes


def fautes_export(
    sorties: Sequence[Mapping[str, object]],
    paires: Sequence[Sequence[str]],
    traits: set[str],
) -> list[str]:
    """Chaque piège exporté a un intrus de son groupe de `paires.json` ; tout se dessine."""
    fautes: list[str] = []
    for q in sorties:
        s = signes(str(q.get("message", "")))
        pieges = [str(p) for p in q.get("pieges") or ()]  # type: ignore[union-attr]
        if not pieges:
            fautes.append(f"{q.get('id')} : aucun piège exporté")
        for c in s:
            if c not in traits:
                fautes.append(f"{q.get('id')} : {c} sans traits")
        for p in pieges:
            possibles = [x for x in intrus(p, s, paires) if x in traits]
            if p not in s:
                fautes.append(f"{q.get('id')} : le piège {p} n'est pas dans le message")
            elif not possibles:
                fautes.append(f"{q.get('id')} : le piège {p} sans intrus dans paires.json")
    return fautes


def _enseignes(build: Path) -> set[str]:
    """Les caractères qu'un parcours pose : les seuls qui auront une carte un jour."""
    vus: set[str] = set()
    for chemin in sorted(build.glob("parcours-*.json")):
        for jour in json.loads(chemin.read_text(encoding="utf-8")).get("jours") or ():
            if jour.get("brique"):
                vus.add(str(jour["brique"]))
            vus |= {str(c) for c in jour.get("composes") or ()}
    return vus


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    source: Path | None = None,
    listes: Path | None = None,
    paires: Path | None = None,
) -> list[Controle]:
    """Contrôles de la coquille, pour `wenlu check`. Tous bloquants.

    « sources » : de 40 à 60 messages, de 6 à 12 caractères chacun, tous du seuil 255,
    traduits et sourcés, sans doublon ; chaque piège est dans son message, appartient à
    un groupe de `paires.tsv` et garde un intrus absent du message. « export » : chaque
    message écrit sort, et ne piège qu'avec un groupe de `paires.json` ; message et
    intrus se dessinent. « parcours » : chaque caractère d'un message, et au moins un
    intrus par message, est posé par un parcours, sans quoi le message ne se jouerait
    jamais.
    """
    from .export import charger_paires, versions_exportees
    from .fetes import traits_exportes

    build = build or BUILD
    lues = charger(source)
    _, forme = lire_tsv(source or COQUILLES)
    groupes_source = charger_paires(paires)
    f_src = forme + fautes_sources(lues, charger_liste(dossier=listes), groupes_source)
    if not OBJECTIF_MIN <= len(lues) <= OBJECTIF_MAX:
        f_src.append(f"{len(lues)} messages, pour {OBJECTIF_MIN} à {OBJECTIF_MAX}")

    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    exportes = 0
    for dossier in dossiers:
        chemin = dossier / "coquilles.json"
        if not chemin.exists():
            f_exp.append(f"{dossier.name} : coquilles.json absent, lancer `wenlu export`")
            continue
        sorties = json.loads(chemin.read_text(encoding="utf-8")).get("coquilles") or []
        exportes = max(exportes, len(sorties))
        groupes = json.loads((dossier / "paires.json").read_text(encoding="utf-8")).get("paires") or []
        f_exp += [f"{dossier.name}:{f}" for f in fautes_export(sorties, groupes, traits_exportes(dossier))]
        manquants = [q.id for q in lues if q.id not in {str(s.get("id")) for s in sorties}]
        if manquants:
            f_exp.append(f"{dossier.name} : non exportés {' '.join(manquants[:5])}")

    enseignes = _enseignes(build)
    f_par: list[str] = []
    if enseignes:
        for q in lues:
            s = signes(q.message)
            hors = "".join(dict.fromkeys(c for c in s if c not in enseignes))
            if hors:
                f_par.append(f"{q.id} : {hors} hors parcours")
            possibles = [x for p in q.pieges for x in intrus(p, s, groupes_source)]
            if possibles and not any(x in enseignes for x in possibles):
                f_par.append(f"{q.id} : aucun intrus posé par un parcours ({' '.join(possibles)})")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    return [
        Controle(
            "coquilles : sources",
            not f_src,
            detail(
                f_src,
                f"{len(lues)} messages rédigés pour l'app (à relire), du {LISTE},"
                " chaque piège dans un groupe de paires",
            ),
            bloquant=True,
        ),
        Controle(
            "coquilles : export",
            not f_exp,
            detail(f_exp, f"{exportes} messages exportés, intrus de paires.json, tout se dessine")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle(
            "coquilles : parcours",
            not f_par,
            detail(f_par, "chaque caractère et un intrus par message sont posés par un parcours")
            if enseignes
            else "aucun parcours construit : lancer `wenlu build`",
            bloquant=True,
        ),
    ]


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="Les messages de la coquille : relecture.")


@app.command("apercu")
def commande_apercu(version: str = typer.Option("0.1.0", help="Version exportée à relire.")) -> None:
    """Affiche chaque message exporté, ses pièges et leurs intrus, sa traduction. Exige `export`."""
    dossier = EXPORT / version
    chemin = dossier / "coquilles.json"
    if not chemin.exists():
        typer.echo(f"{chemin} absent : lancer `wenlu export`.", err=True)
        raise typer.Exit(code=1)
    document_export = json.loads(chemin.read_text(encoding="utf-8"))
    groupes = json.loads((dossier / "paires.json").read_text(encoding="utf-8")).get("paires") or []
    for q in document_export["coquilles"]:
        s = signes(q["message"])
        pieges = " ".join(f"{p}→{'/'.join(intrus(p, s, groupes))}" for p in q["pieges"])
        typer.echo(f"{q['message']}\t{pieges}\t{q['fr']}")
    typer.echo(f"{len(document_export['coquilles'])} messages.")
