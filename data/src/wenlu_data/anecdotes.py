"""Les anecdotes du jour (brief §6, pas 1 « Ouvrir ») : source, export, contrôles.

Une anecdote est un fait court, culturel ou historique, accroché à un caractère : le
福 qu'on colle à l'envers, 四 qui sonne comme 死, le 星期 de la semaine. Une source
versionnée, `data/sources/anecdotes/anecdotes.tsv`, rédigée pour l'app ; `wenlu export`
en tire `anecdotes.json`, que l'app lit (`app/src/lib/anecdotes.ts` choisit celle du
jour, de préférence sur un caractère que l'apprenant vient de rencontrer).

Les anecdotes des fêtes et des termes solaires n'en sont pas : elles viennent de
`fetes/textes.tsv` et de `saisons/textes.tsv`.

Les contrôles tiennent la discipline du brief : un caractère par anecdote, jamais deux
fois le même ; trois à cinq phrases ; pas d'emoji ; pas de dragon (CLAUDE.md : il
n'apparaît qu'au Nouvel An et à 端午) ; et dès qu'un texte parle de l'origine d'un
caractère ou d'un mot, l'étiquette `atteste` ou `mnemotechnique` (brief §2).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import BUILD, DATA, EXPORT

DOSSIER = DATA / "sources" / "anecdotes"
ANECDOTES = DOSSIER / "anecdotes.tsv"

#: Le fichier écrit dans chaque version exportée.
FICHIER = "anecdotes.json"

COLONNES = ("c", "titre", "texte", "appui", "etiquette", "statut", "source")

#: La nature de ce qui fonde le texte, voir l'en-tête de la source.
APPUIS = ("langue", "coutume", "histoire", "litterature", "legende", "ecriture")
ETIQUETTES = ("atteste", "mnemotechnique")
STATUTS = ("relu", "a_relire")

#: Ce que chaque texte doit dire de sa provenance.
REDIGE = "rédigé pour l'app"

#: Le nombre d'anecdotes ordinaires visé : deux mois sans redite, au moins.
OBJECTIF = 60

#: Les bornes de la forme : un titre d'une ligne, un texte de trois à cinq phrases.
TITRE_MIN, TITRE_MAX = 8, 80
TEXTE_MIN, TEXTE_MAX = 150, 480
PHRASES_MIN, PHRASES_MAX = 3, 5

#: Les jours du parcours Lire que l'on veut couvrir d'abord.
JOURS_PRIORITAIRES = 90

SOURCE_EXPORT = "data/sources/anecdotes/ : anecdotes du jour rédigées pour l'app"

#: Une fin de phrase : un point final, sauf celui d'une citation qui continue (« … ? »).
_FIN = re.compile(r"[.!?…](?!\s*»)(?=\s|$)")

#: Le texte parle de l'origine d'un caractère ou d'un mot : il lui faut une étiquette.
_ETYMOLOGIE = re.compile(
    r"\bvien(?:t|nent) d|\bvenu d|à l'origine|pictogramme|\bdessinai(?:t|ent)\b|\bdessin d|"
    r"représent|formes? ancienne|os oraculaires|étymolog|shuowen|说文|écriture traditionnelle|"
    r"simplification|\bclé de\b|composé de|se compose|pour son son|le mot date",
    re.IGNORECASE,
)

#: Une légende se dit comme telle.
_LEGENDE = re.compile(r"légende|raconte|aurait|attribue|histoire populaire|dit-on", re.IGNORECASE)

#: Le dragon, qui n'apparaît qu'au Nouvel An et à 端午.
_DRAGON = re.compile(r"龙|龍|dragon", re.IGNORECASE)

#: Les emoji et leurs liants.
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍⭐⭕]")


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Anecdote:
    """Une anecdote telle que la source la donne, avec sa ligne pour les contrôles."""

    c: str
    titre: str
    texte: str
    appui: str
    etiquette: str
    statut: str
    source: str
    numero: int = 0


def charger(chemin: Path | None = None) -> list[Anecdote]:
    """Les anecdotes de `anecdotes.tsv`, dans l'ordre du fichier."""
    lignes, _ = lire_tsv(chemin or ANECDOTES)
    return [
        Anecdote(
            **{k: l.cellules.get(k, "") for k in COLONNES},  # type: ignore[arg-type]
            numero=l.numero,
        )
        for l in lignes
    ]


def phrases(texte: str) -> int:
    """Le nombre de phrases d'un texte : ses points finaux, citations comprises."""
    return len(_FIN.findall(texte.strip()))


# ---------------------------------------------------------------------------- export


def document(
    *,
    racines: Mapping[str, str],
    en_tete: Mapping[str, object] | None = None,
    source: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `anecdotes.json`.

    `racines` donne la famille de chaque caractère exporté : l'app y lit les traits du
    caractère de l'anecdote sans relire toutes les familles. Une anecdote dont le
    caractère n'est pas dans le périmètre exporté ne s'écrit pas (l'app ne saurait pas
    le dessiner) ; `wenlu check` le dit.
    """
    sorties: list[dict[str, object]] = []
    for a in charger(source):
        racine = racines.get(a.c)
        if not racine:
            continue
        entree: dict[str, object] = {"c": a.c, "titre": a.titre, "texte": a.texte, "appui": a.appui}
        if a.etiquette:
            entree["etiquette"] = a.etiquette
        entree["statut"] = a.statut
        entree["racine"] = racine
        sorties.append(entree)
    return {**(en_tete or {}), "anecdotes": sorties}


# ------------------------------------------------------------------------- contrôles


def fautes_sources(anecdotes: Sequence[Anecdote]) -> list[str]:
    """Champs, valeurs permises, doublons, provenance."""
    fautes: list[str] = []
    vus: set[str] = set()
    for a in anecdotes:
        ou = f"anecdotes.tsv:{a.numero}"
        if len(a.c) != 1:
            fautes.append(f"{ou} : un seul caractère par anecdote ({a.c!r})")
        if a.c in vus:
            fautes.append(f"{ou} : {a.c} a déjà une anecdote")
        vus.add(a.c)
        for champ, valeur in (("titre", a.titre), ("texte", a.texte), ("source", a.source)):
            if not valeur:
                fautes.append(f"{ou} : {a.c} sans {champ}")
        if a.appui not in APPUIS:
            fautes.append(f"{ou} : {a.c} appui inconnu {a.appui!r}")
        if a.etiquette and a.etiquette not in ETIQUETTES:
            fautes.append(f"{ou} : {a.c} étiquette inconnue {a.etiquette!r}")
        if a.statut not in STATUTS:
            fautes.append(f"{ou} : {a.c} statut inconnu {a.statut!r}")
        if a.source and REDIGE not in a.source:
            fautes.append(f"{ou} : {a.c} source sans « {REDIGE} »")
    return fautes


def fautes_forme(anecdotes: Sequence[Anecdote]) -> list[str]:
    """Longueurs, nombre de phrases, et le caractère présent dans ce qu'on lit."""
    fautes: list[str] = []
    for a in anecdotes:
        ou = f"{a.c} (ligne {a.numero})"
        if not TITRE_MIN <= len(a.titre) <= TITRE_MAX:
            fautes.append(f"{ou} : titre de {len(a.titre)} signes ({TITRE_MIN} à {TITRE_MAX})")
        if not TEXTE_MIN <= len(a.texte) <= TEXTE_MAX:
            fautes.append(f"{ou} : texte de {len(a.texte)} signes ({TEXTE_MIN} à {TEXTE_MAX})")
        n = phrases(a.texte)
        if not PHRASES_MIN <= n <= PHRASES_MAX:
            fautes.append(f"{ou} : {n} phrases ({PHRASES_MIN} à {PHRASES_MAX})")
        if a.c and a.c not in a.titre + a.texte:
            fautes.append(f"{ou} : le caractère n'apparaît ni dans le titre ni dans le texte")
    return fautes


def fautes_charte(anecdotes: Sequence[Anecdote]) -> list[str]:
    """Pas d'emoji ; pas de dragon hors des fêtes qui le portent."""
    fautes: list[str] = []
    for a in anecdotes:
        lu = f"{a.c} {a.titre} {a.texte}"
        if _EMOJI.search(lu):
            fautes.append(f"{a.c} : emoji")
        if _DRAGON.search(lu):
            fautes.append(f"{a.c} : dragon hors du Nouvel An et de 端午")
    return fautes


def fautes_etymologie(anecdotes: Sequence[Anecdote]) -> list[str]:
    """L'origine d'un caractère ou d'un mot porte son étiquette ; une légende se dit."""
    fautes: list[str] = []
    for a in anecdotes:
        trouve = _ETYMOLOGIE.search(a.texte)
        if trouve and not a.etiquette:
            fautes.append(f"{a.c} : parle d'origine (« {trouve.group(0)} ») sans étiquette attesté ou mnémotechnique")
        if a.appui == "ecriture" and not a.etiquette:
            fautes.append(f"{a.c} : histoire d'un caractère sans étiquette")
        if a.appui == "legende" and not _LEGENDE.search(a.texte):
            fautes.append(f"{a.c} : légende qui ne se dit pas comme telle")
    return fautes


def fautes_export(
    anecdotes: Sequence[Anecdote], exporte: Mapping[str, object], presents: set[str]
) -> list[str]:
    """L'export dit ce que dit la source, et chaque caractère se dessine."""
    fautes: list[str] = []
    sorties = {str(x.get("c")): x for x in exporte.get("anecdotes") or []}  # type: ignore[union-attr]
    for a in anecdotes:
        x = sorties.get(a.c)
        if x is None:
            fautes.append(f"{a.c} : non exportée (hors du périmètre ?)")
            continue
        if (x.get("titre"), x.get("texte"), x.get("etiquette", "")) != (a.titre, a.texte, a.etiquette):
            fautes.append(f"{a.c} : l'export diffère de la source, lancer `wenlu export`")
        if not x.get("racine"):
            fautes.append(f"{a.c} : sans racine")
        if a.c not in presents:
            fautes.append(f"{a.c} : sans traits exportés")
    for c in sorted(set(sorties) - {a.c for a in anecdotes}):
        fautes.append(f"{c} : exportée sans source")
    return fautes


def jours_lire(build: Path) -> dict[str, int]:
    """Le jour du parcours Lire où chaque caractère se rencontre (brique ou composé)."""
    chemin = build / "parcours-lire.json"
    if not chemin.exists():
        return {}
    jours: dict[str, int] = {}
    for j in json.loads(chemin.read_text(encoding="utf-8")).get("jours") or ():
        for c in [j.get("brique"), *(j.get("composes") or ())]:
            if c and c not in jours:
                jours[str(c)] = int(j["jour"])
    return jours


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    source: Path | None = None,
) -> list[Controle]:
    """Contrôles des anecdotes, pour `wenlu check`.

    « sources », « forme », « charte », « étymologie » et « export » sont bloquants.
    « parcours » dit combien d'anecdotes parlent d'un caractère du parcours Lire, et
    de ses 90 premiers jours : signalé, jamais bloquant.
    """
    from .export import versions_exportees
    from .fetes import traits_exportes

    lues = charger(source)
    _, forme = lire_tsv(source or ANECDOTES)
    f_src = forme + fautes_sources(lues)
    f_forme = fautes_forme(lues)
    f_charte = fautes_charte(lues)
    f_etym = fautes_etymologie(lues)

    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for dossier in dossiers:
        chemin = dossier / FICHIER
        if not chemin.exists():
            f_exp.append(f"{dossier.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        exporte = json.loads(chemin.read_text(encoding="utf-8"))
        f_exp += [f"{dossier.name}:{f}" for f in fautes_export(lues, exporte, traits_exportes(dossier))]

    jours = jours_lire(build or BUILD)
    sur_le_chemin = [a.c for a in lues if a.c in jours]
    tot = [a.c for a in lues if jours.get(a.c, JOURS_PRIORITAIRES + 1) <= JOURS_PRIORITAIRES]
    hors = [a.c for a in lues if a.c not in jours]

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    relues = sum(1 for a in lues if a.statut == "relu")
    return [
        Controle(
            "anecdotes : sources",
            not f_src,
            detail(f_src, f"{len(lues)} anecdotes (objectif : {OBJECTIF}), {relues} relues, un caractère chacune, sourcées"),
            bloquant=True,
        ),
        Controle(
            "anecdotes : forme",
            not f_forme,
            detail(
                f_forme,
                f"titres de {TITRE_MIN} à {TITRE_MAX} signes, textes de {TEXTE_MIN} à {TEXTE_MAX},"
                f" {PHRASES_MIN} à {PHRASES_MAX} phrases, le caractère cité",
            ),
            bloquant=True,
        ),
        Controle("anecdotes : charte", not f_charte, detail(f_charte, "ni emoji ni dragon"), bloquant=True),
        Controle(
            "anecdotes : étymologie",
            not f_etym,
            detail(f_etym, "toute origine étiquetée attesté ou mnémotechnique, toute légende dite comme telle"),
            bloquant=True,
        ),
        Controle(
            "anecdotes : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} conforme à la source, chaque caractère dans les traits exportés")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle(
            "anecdotes : parcours",
            len(lues) >= OBJECTIF,
            f"{len(sur_le_chemin)} sur le parcours Lire, dont {len(tot)} dans ses {JOURS_PRIORITAIRES} premiers jours ;"
            f" hors parcours : {' '.join(hors) or 'aucune'}"
            if jours
            else "parcours Lire absent : lancer `wenlu build`",
        ),
    ]
