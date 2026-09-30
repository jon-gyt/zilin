"""Le calendrier d'ouverture, « l'aventure » (brief §6) : les portes, sources, export, contrôles.

Demande du propriétaire du 29 septembre 2026 : « Je veux aussi qu'au début, on ne voie pas
tout ce qui est accessible, mais que ça se débloque au fur et à mesure de l'aventure. » Au
premier jour, le menu n'a que la carte du jour, le chemin et le bouton de session ; chaque
autre porte (une case du menu, un jeu, les contes, la route devant…) s'ouvre à un moment de
l'aventure, compté en jours du chemin ou en caractères lus, et Tao l'annonce d'une phrase au
retour au menu.

Une source versionnée, rédigée pour l'app et à relire, `data/sources/ouvertures/portes.tsv`,
lue par `wenlu export`, qui en tire `ouvertures.json`. L'app n'écrit ni seuil ni phrase :
elle lit ce fichier (`app/src/lib/ouvertures.ts`) et décide seulement quand montrer.

`wenlu check` refuse une porte inconnue ou absente, une unité autre que `jour` ou `lus`, un
seuil qui s'ouvrirait pendant la première session, un parent inconnu ou placé après, une
porte silencieuse qui ne viendrait pas avec son parent ; une annonce qui ne nomme pas sa
porte, parle d'achat, presse, reproche, porte un emoji ou un dragon. Deux contrôles lisent
le contenu : Lire est ouvert quand arrive la première lettre de Que, et les contes s'ouvrent
le jour de la première fable du chemin.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .anecdotes import _EMOJI
from .fetes import lire_tsv
from .gf0014 import Controle
from .jouer import INTERDITS, reproches
from .paths import DATA, EXPORT
from .rythme import agitations

DOSSIER = DATA / "sources" / "ouvertures"
PORTES_TSV = DOSSIER / "portes.tsv"

#: Le fichier exporté, que l'index nomme par sa clé `ouvertures`.
FICHIER = "ouvertures.json"

#: Les deux unités de l'aventure : la dernière leçon du chemin apprise, les caractères lus.
UNITES = ("jour", "lus")

#: Les portes que l'app connaît, chacune avec ce que son annonce doit nommer (le caractère
#: de la case ou du jeu, ou le mot de l'écran). L'app tient la même liste
#: (`ouvertures.PORTES`) ; un test de l'app relit l'export pour s'en assurer.
PORTES: dict[str, str] = {
    "xing": "杏",
    "reviser": "温",
    "personnage": "personnage",
    "foret": "路",
    "lire": "读",
    "jouer": "玩",
    "jeu-assembler": "拼",
    "jeu-chaine": "链",
    "route": "前路",
    "jeu-devinette": "谜",
    "trophees": "trophées",
    "jeu-jumeaux": "双",
    "jeu-eclair": "典",
    "contes": "故事",
    "jeu-wechat": "信",
    "revisions": "révisions",
    "retention": "",
    "jeu-coquille": "错",
    "monde": "lire le monde",
    "jeu-cuisine": "菜",
}

#: La rencontre du maître Xing 杏 (décision du propriétaire du 29 septembre 2026) : Tao le
#: rencontre à la porte du premier examen, au palier de caractères lus qui ouvre le 县试.
#: Sa porte vient en tête du calendrier : le jour où l'examen s'ouvre, elle s'annonce avant
#: toute autre, pour que l'examinateur soit là.
RENCONTRE = "xing"

#: La première session pose les jours 1 à 3 du chemin (人, 大, 天) : aucune porte ne s'ouvre
#: avant le lendemain, le premier menu reste simple.
JOUR_PREMIERE = 3

#: Une porte vide : `-` dans la source, `null` dans l'export.
VIDE = "-"

SOURCE_EXPORT = (
    "data/sources/ouvertures/portes.tsv : le calendrier d'ouverture des portes et les annonces"
    " de Tao, rédigés pour l'app (à relire)"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Porte:
    porte: str
    unite: str
    seuil: str
    parent: str
    annonce: str
    source: str
    numero: int = 0

    @property
    def nombre(self) -> int | None:
        """Le seuil en entier, `None` s'il n'en est pas un."""
        return int(self.seuil) if re.fullmatch(r"[0-9]+", self.seuil) else None

    @property
    def silencieuse(self) -> bool:
        return self.annonce == VIDE


@dataclass(frozen=True)
class Calendrier:
    """Les portes, dans l'ordre de la source, et les fautes de forme du fichier."""

    portes: tuple[Porte, ...]
    forme: tuple[str, ...] = field(default=())


def charger(chemin: Path | None = None) -> Calendrier:
    """Les portes de `data/sources/ouvertures/portes.tsv`, dans l'ordre du fichier."""
    lignes, forme = lire_tsv(chemin or PORTES_TSV)
    return Calendrier(
        portes=tuple(
            Porte(
                porte=l.cellules.get("porte", ""),
                unite=l.cellules.get("unite", ""),
                seuil=l.cellules.get("seuil", ""),
                parent=l.cellules.get("parent", ""),
                annonce=l.cellules.get("annonce", ""),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in lignes
        ),
        forme=tuple(forme),
    )


# ---------------------------------------------------------------------------- export


def portes_json(c: Calendrier) -> list[dict[str, object]]:
    """Les portes telles que l'export les écrit : `null` pour un parent vide, `""` pour le silence."""
    return [
        {
            "id": p.porte,
            "unite": p.unite,
            "seuil": p.nombre,
            "parent": None if p.parent == VIDE else p.parent,
            "annonce": "" if p.silencieuse else p.annonce,
        }
        for p in c.portes
    ]


def document(en_tete: dict[str, object] | None = None, chemin: Path | None = None) -> dict[str, object]:
    """Le JSON écrit dans `ouvertures.json` : l'en-tête, puis les portes dans l'ordre."""
    return {**(en_tete or {}), "portes": portes_json(charger(chemin))}


# ------------------------------------------------------------------------- contrôles


def fautes_sources(c: Calendrier) -> list[str]:
    """Chaque porte une fois, dans ses unités, après la première session, sous son parent ;
    une annonce calme qui la nomme, ou le silence avec son parent."""
    fautes = list(c.forme)
    ids = [p.porte for p in c.portes]
    for porte in PORTES:
        if ids.count(porte) != 1:
            fautes.append(f"portes.tsv : {ids.count(porte)} lignes pour {porte}, attendu une")
    vues: dict[str, Porte] = {}
    for p in c.portes:
        ou = f"portes.tsv:{p.numero}"
        if p.porte not in PORTES:
            fautes.append(f"{ou} : porte inconnue {p.porte!r}")
            continue
        if not all((p.unite, p.seuil, p.parent, p.annonce, p.source)):
            fautes.append(f"{ou} : ligne incomplète ({p.porte})")
            continue
        if p.unite not in UNITES:
            fautes.append(f"{ou} : {p.porte} compte en {p.unite!r}, attendu jour ou lus")
        n = p.nombre
        if n is None or n < 1:
            fautes.append(f"{ou} : {p.porte} a le seuil {p.seuil!r}, attendu un entier positif")
        elif p.unite == "jour" and n <= JOUR_PREMIERE:
            fautes.append(f"{ou} : {p.porte} s'ouvrirait pendant la première session (jour {n})")
        if p.parent != VIDE:
            parent = vues.get(p.parent)
            if parent is None:
                fautes.append(f"{ou} : {p.porte} a pour parent {p.parent!r}, inconnu ou placé après")
            elif parent.unite == p.unite and n is not None and (parent.nombre or 0) > n:
                fautes.append(f"{ou} : {p.porte} s'ouvrirait avant {p.parent}, qui la contient")
            elif p.silencieuse and (parent.unite != p.unite or parent.nombre != n):
                fautes.append(f"{ou} : {p.porte} est silencieuse, elle vient avec {p.parent}, au même seuil")
        elif p.silencieuse:
            fautes.append(f"{ou} : {p.porte} n'a pas de parent, Tao doit l'annoncer")
        if not p.silencieuse:
            marque = PORTES[p.porte]
            if marque and marque not in p.annonce:
                fautes.append(f"{ou} : l'annonce de {p.porte} ne nomme pas sa porte ({marque})")
            if _EMOJI.search(p.annonce):
                fautes.append(f"{ou} : l'annonce de {p.porte} porte un emoji")
            if INTERDITS.search(p.annonce):
                fautes.append(f"{ou} : pas de dragon hors du décor des fêtes")
            for raison in agitations(p.annonce):
                fautes.append(f"{ou} : l'aventure, pas l'argent ni l'urgence : {p.porte} porte {raison}")
            for raison in reproches(p.annonce):
                fautes.append(f"{ou} : Tao ne culpabilise jamais, {p.porte} porte {raison}")
        vues[p.porte] = p
    return fautes


def fautes_contenu(
    c: Calendrier, *, premiere_lettre: int, premiere_fable: int | None, premier_examen: int | None = None
) -> list[str]:
    """Une porte se montre quand elle sert : Lire à la première lettre de Que au plus tard,
    les contes le jour même de la première fable du chemin, et la rencontre du maître Xing au
    palier du premier examen, en tête du calendrier."""
    fautes: list[str] = []
    par_id = {p.porte: p for p in c.portes}
    xing = par_id.get(RENCONTRE)
    if xing is not None:
        if premier_examen is not None and not (xing.unite == "lus" and xing.nombre == premier_examen):
            fautes.append(
                f"Xing se rencontre à la porte du premier examen : {premier_examen} caractères lus, en lus"
            )
        if c.portes and c.portes[0].porte != RENCONTRE:
            fautes.append("la rencontre de Xing vient en tête du calendrier, avant toute autre porte")
    lire = par_id.get("lire")
    if lire is not None and not (lire.unite == "jour" and (lire.nombre or 0) <= premiere_lettre):
        fautes.append(f"Lire doit être ouvert au jour {premiere_lettre}, celui de la première lettre de Que")
    contes = par_id.get("contes")
    if contes is not None and premiere_fable is not None:
        if not (contes.unite == "jour" and contes.nombre == premiere_fable):
            fautes.append(f"les contes s'ouvrent au jour {premiere_fable}, celui de la première fable du chemin")
    return fautes


def fautes_export(sortie: dict[str, object], c: Calendrier) -> list[str]:
    """L'export dit les portes des sources, dans leur ordre, ni plus ni moins."""
    portes = sortie.get("portes")
    if not isinstance(portes, list):
        return ["ouvertures.json sans portes"]
    attendu = portes_json(c)
    if portes == attendu:
        return []
    ids = [x.get("id") if isinstance(x, dict) else None for x in portes]
    fautes = [f"{p['id']} absente" for p in attendu if p["id"] not in ids]  # type: ignore[index]
    fautes += [f"porte inconnue {i!r}" for i in ids if i not in PORTES]
    return fautes or ["les portes ne sont pas celles des sources"]


def premier_examen() -> int | None:
    """Le palier du premier examen de la liste (`examens.tsv`), le 县试 : 50 caractères lus."""
    from .examens import charger_liste

    examens = charger_liste()[0]
    return min((e.palier for e in examens), default=None)


def premiere_fable() -> int | None:
    """Le jour de la première fable du chemin, au catalogue des contes (`jour26`)."""
    from .contes import charger_catalogue, est_chemin, jour_du_niveau

    jours = [jour_du_niveau(n) for conte in charger_catalogue() for n in conte.niveaux if est_chemin(n)]
    return min(jours) if jours else None


def controles(destination: Path | None = None, *, chemin: Path | None = None) -> list[Controle]:
    """Contrôles du calendrier d'ouverture, pour `wenlu check`. Tous bloquants.

    « sources » : chaque porte une fois, en jours ou en lus, après la première session, sous
    son parent ; une annonce qui la nomme, calme, sans achat ni emoji ni dragon.
    « contenu » : Lire à la première lettre de Que, les contes à la première fable, la
    rencontre de Xing au palier du premier examen, en tête.
    « export » : `ouvertures.json` dit les portes des sources, et `index.json` le nomme.
    """
    from .export import versions_exportees
    from .lettres import jour_de_lettre

    c = charger(chemin)
    f_src = fautes_sources(c)
    f_contenu = fautes_contenu(
        c, premiere_lettre=jour_de_lettre(1), premiere_fable=premiere_fable(), premier_examen=premier_examen()
    )
    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for d in dossiers:
        fichier = d / FICHIER
        if not fichier.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        sortie = json.loads(fichier.read_text(encoding="utf-8"))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sortie, c)]
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        if index.get("ouvertures") != FICHIER:
            f_exp.append(f"{d.name} : index.json ne nomme pas {FICHIER}")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    return [
        Controle(
            "ouvertures : sources",
            not f_src,
            detail(f_src, f"{len(c.portes)} portes, en jours du chemin ou en lus, annonces calmes"),
            bloquant=True,
        ),
        Controle(
            "ouvertures : contenu",
            not f_contenu,
            detail(f_contenu, "Lire à la première lettre de Que, les contes à la première fable, Xing au 县试"),
            bloquant=True,
        ),
        Controle(
            "ouvertures : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} dit les portes des sources")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
