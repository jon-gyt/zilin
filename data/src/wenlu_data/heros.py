"""Le personnage (story 4.5, brief §8 « Le personnage ») : sources, export, contrôles.

On choisit une bête, on lui donne un nom, et elle monte douze rangs, du bébé 启蒙 à
l'adulte 状元, au fil des bonnes réponses. Trois sources versionnées dans
`data/sources/heros/`, rédigées pour l'app et à relire, lues par `wenlu export`, qui en
tire `heros.json` :

- `rangs.tsv` : les douze rangs, leur titre (hanzi, pinyin), leur traduction mot à mot,
  leur rôle historique, l'âge du personnage et le seuil de points ;
- `betes.tsv` : les trois bêtes, ce que Tao en dit, trois idées de nom ;
- `tao.tsv` : les phrases de la bulle de Tao et de l'écran 放榜, avec leurs jetons.

L'app ne rédige rien : elle lit `heros.json`. Les dessins (la bête, sa tenue, son aura)
sont du code de l'app, comme Tao ; les points se calculent dans l'app, depuis la
progression. Le titre de chaque rang est dessiné depuis ses traits (CLAUDE.md : les
grands caractères ne viennent jamais d'une police) : ses caractères entrent dans le
périmètre de l'export avec leurs briques, comme ceux des fêtes.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Sequence

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "heros"
RANGS = DOSSIER / "rangs.tsv"
BETES = DOSSIER / "betes.tsv"
TAO = DOSSIER / "tao.tsv"

#: Douze rangs, du bébé à l'adulte (décision du propriétaire).
NOMBRE_RANGS = 12

#: Les étapes de vie, dans l'ordre : l'âge d'un rang ne revient jamais en arrière.
AGES = ("bébé", "tout-petit", "enfant", "grand enfant", "ado", "jeune", "adulte")

#: Les trois bêtes que l'app sait dessiner, dans l'ordre du choix.
BETES_ATTENDUES = ("tu", "xiongmao", "shi")

#: Trois idées de nom par bête, de seize signes au plus (le champ du nom en prend seize).
IDEES = 3
NOM_MAX = 16

#: Les phrases de Tao et les seuls jetons que chacune peut porter.
JETONS_TAO: dict[str, frozenset[str]] = {
    "accueil": frozenset(),
    "choisi": frozenset({"bete", "bete_fr", "dit"}),
    "depart": frozenset(),
    "essayer": frozenset({"art", "art_fr"}),
    "presque": frozenset({"reste", "rang"}),
    "presque_un": frozenset({"rang"}),
    "sommet": frozenset({"nom"}),
    "fangbang": frozenset({"nom", "rang", "rang_fr", "role"}),
}

#: Ce qu'aucun texte du personnage ne nomme : le dragon reste au décor de deux fêtes.
INTERDITS = re.compile(r"dragon|龙|龍", re.IGNORECASE)

SOURCE_EXPORT = (
    "data/sources/heros/ : rangs, bêtes et phrases de Tao rédigés pour l'app (à relire),"
    " d'après la maquette validée par le propriétaire"
)


def hanzi(texte: str) -> list[str]:
    """Les sinogrammes d'un texte, dans l'ordre, sans la ponctuation."""
    return [c for c in texte if "㐀" <= c <= "鿿" or "\U00020000" <= c <= "\U0002ffff"]


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Rang:
    hz: str
    pinyin: str
    fr: str
    role: str
    age: str
    seuil: str
    source: str
    numero: int = 0

    def points(self) -> int | None:
        """Le seuil, en points ; `None` s'il n'est pas un entier positif ou nul."""
        return int(self.seuil) if self.seuil.isdigit() else None


@dataclass(frozen=True)
class Bete:
    id: str
    hz: str
    pinyin: str
    fr: str
    dit: str
    noms: tuple[str, ...]
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Phrase:
    cle: str
    fr: str
    source: str
    numero: int = 0

    def jetons(self) -> set[str]:
        return set(re.findall(r"\{([a-z_]+)\}", self.fr))


@dataclass(frozen=True)
class Heros:
    """Les trois sources, et les fautes de forme des fichiers."""

    rangs: tuple[Rang, ...]
    betes: tuple[Bete, ...]
    tao: tuple[Phrase, ...]
    forme: tuple[str, ...] = field(default=())


def charger(dossier: Path | None = None) -> Heros:
    """Les trois sources de `data/sources/heros/`, dans l'ordre des fichiers."""
    d = dossier or DOSSIER
    l_ran, f_ran = lire_tsv(d / RANGS.name)
    l_bet, f_bet = lire_tsv(d / BETES.name)
    l_tao, f_tao = lire_tsv(d / TAO.name)
    return Heros(
        rangs=tuple(
            Rang(
                hz=l.cellules.get("hz", ""),
                pinyin=l.cellules.get("pinyin", ""),
                fr=l.cellules.get("fr", ""),
                role=l.cellules.get("role", ""),
                age=l.cellules.get("age", ""),
                seuil=l.cellules.get("seuil", ""),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in l_ran
        ),
        betes=tuple(
            Bete(
                id=l.cellules.get("id", ""),
                hz=l.cellules.get("hz", ""),
                pinyin=l.cellules.get("pinyin", ""),
                fr=l.cellules.get("fr", ""),
                dit=l.cellules.get("dit", ""),
                noms=tuple(l.cellules.get("noms", "").split()),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in l_bet
        ),
        tao=tuple(
            Phrase(
                cle=l.cellules.get("cle", ""),
                fr=l.cellules.get("fr", ""),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in l_tao
        ),
        forme=tuple(f_ran + f_bet + f_tao),
    )


def caracteres_dessines(heros: Heros) -> list[str]:
    """Les caractères des titres de rang, que l'app dessine depuis leurs traits, triés."""
    return sorted({c for r in heros.rangs for c in hanzi(r.hz)})


def textes_chinois(heros: Heros) -> list[tuple[str, str, str]]:
    """Chaque texte chinois qui a un pinyin : l'endroit, le texte, son pinyin."""
    out = [(f"rangs.tsv:{r.numero}", r.hz, r.pinyin) for r in heros.rangs]
    out += [(f"betes.tsv:{b.numero}", b.hz, b.pinyin) for b in heros.betes]
    return out


# ---------------------------------------------------------------------------- export


def document(
    version: str,
    *,
    racines: Mapping[str, str],
    en_tete: Mapping[str, object] | None = None,
    dossier: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `heros.json`.

    `rangs` dans l'ordre, chacun avec son seuil en points ; `betes` dans l'ordre du choix,
    avec leurs trois idées de nom ; `tao` les phrases par clé, jetons compris ;
    `racines` la famille de chaque caractère des titres, pour que l'app trouve ses traits.
    """
    heros = charger(dossier)
    return {
        **(en_tete or {}),
        "rangs": [
            {
                "hz": r.hz,
                "pinyin": r.pinyin,
                "fr": r.fr,
                "role": r.role,
                "age": r.age,
                "seuil": r.points() if r.points() is not None else 0,
            }
            for r in heros.rangs
        ],
        "betes": [
            {"id": b.id, "hz": b.hz, "pinyin": b.pinyin, "fr": b.fr, "dit": b.dit, "noms": list(b.noms)}
            for b in heros.betes
        ],
        "tao": {t.cle: t.fr for t in heros.tao},
        "racines": {c: racines[c] for c in caracteres_dessines(heros) if c in racines},
    }


# ------------------------------------------------------------------------- contrôles


def fautes_sources(heros: Heros) -> list[str]:
    """Ce qui cloche dans les sources : douze rangs, seuils, âges, trois bêtes, phrases."""
    fautes = list(heros.forme)

    if len(heros.rangs) != NOMBRE_RANGS:
        fautes.append(f"rangs.tsv : {len(heros.rangs)} rangs, il en faut {NOMBRE_RANGS}")
    precedent: int | None = None
    age_avant = -1
    vus: set[str] = set()
    for i, r in enumerate(heros.rangs):
        ou = f"rangs.tsv:{r.numero}"
        for champ, valeur in (
            ("hz", r.hz),
            ("pinyin", r.pinyin),
            ("fr", r.fr),
            ("role", r.role),
            ("source", r.source),
        ):
            if not valeur:
                fautes.append(f"{ou} : rang sans {champ}")
        if r.hz in vus:
            fautes.append(f"{ou} : {r.hz} en double")
        vus.add(r.hz)
        if r.hz and len(hanzi(r.hz)) != len(r.hz):
            fautes.append(f"{ou} : le titre {r.hz!r} n'est pas fait que de caractères")
        seuil = r.points()
        if seuil is None:
            fautes.append(f"{ou} : seuil {r.seuil!r}, attendu un entier")
        elif i == 0 and seuil != 0:
            fautes.append(f"{ou} : le premier rang commence à {seuil}, attendu 0")
        elif precedent is not None and seuil <= precedent:
            fautes.append(f"{ou} : seuil {seuil} après {precedent}, les seuils croissent")
        if seuil is not None:
            precedent = seuil
        if r.age not in AGES:
            fautes.append(f"{ou} : âge {r.age!r}, attendu l'un de {', '.join(AGES)}")
        else:
            k = AGES.index(r.age)
            if k < age_avant:
                fautes.append(f"{ou} : {r.age} après {AGES[age_avant]}, l'âge ne revient pas en arrière")
            age_avant = max(age_avant, k)
    if heros.rangs and heros.rangs[0].age != AGES[0]:
        fautes.append(f"rangs.tsv : le premier rang est {heros.rangs[0].age!r}, attendu {AGES[0]}")
    if heros.rangs and heros.rangs[-1].age != AGES[-1]:
        fautes.append(f"rangs.tsv : le dernier rang est {heros.rangs[-1].age!r}, attendu {AGES[-1]}")

    ids = [b.id for b in heros.betes]
    if tuple(ids) != BETES_ATTENDUES:
        fautes.append(f"betes.tsv : {' '.join(ids) or 'aucune'}, attendu {' '.join(BETES_ATTENDUES)}")
    for b in heros.betes:
        ou = f"betes.tsv:{b.numero}"
        for champ, valeur in (
            ("hz", b.hz),
            ("pinyin", b.pinyin),
            ("fr", b.fr),
            ("dit", b.dit),
            ("source", b.source),
        ):
            if not valeur:
                fautes.append(f"{ou} : {b.id} sans {champ}")
        if len(b.noms) != IDEES:
            fautes.append(f"{ou} : {b.id} a {len(b.noms)} idées de nom, il en faut {IDEES}")
        if len(set(b.noms)) != len(b.noms):
            fautes.append(f"{ou} : {b.id} a deux fois la même idée de nom")
        for nom in b.noms:
            if len(nom) > NOM_MAX:
                fautes.append(f"{ou} : le nom {nom!r} dépasse {NOM_MAX} signes")

    cles = [t.cle for t in heros.tao]
    for cle in JETONS_TAO:
        if cles.count(cle) != 1:
            fautes.append(f"tao.tsv : {cles.count(cle)} lignes pour {cle}, attendu une")
    for t in heros.tao:
        ou = f"tao.tsv:{t.numero}"
        if t.cle not in JETONS_TAO:
            fautes.append(f"{ou} : clé inconnue {t.cle!r}")
            continue
        if not t.fr or not t.source:
            fautes.append(f"{ou} : phrase incomplète ({t.cle})")
        inconnus = t.jetons() - JETONS_TAO[t.cle]
        if inconnus:
            fautes.append(f"{ou} : {t.cle} porte un jeton inconnu : {' '.join(sorted(inconnus))}")

    for ou, texte in (
        *((f"rangs.tsv:{r.numero}", f"{r.hz} {r.fr} {r.role}") for r in heros.rangs),
        *((f"betes.tsv:{b.numero}", f"{b.hz} {b.fr} {b.dit} {' '.join(b.noms)}") for b in heros.betes),
        *((f"tao.tsv:{t.numero}", t.fr) for t in heros.tao),
    ):
        if INTERDITS.search(texte):
            fautes.append(f"{ou} : pas de dragon hors du décor des fêtes")
    return fautes


def fautes_pinyin(heros: Heros, lues: Mapping[str, Sequence[str]]) -> list[str]:
    """Chaque titre et chaque nom de bête se lit, caractère par caractère, dans son pinyin."""
    from .pinyin import aligner

    return [
        f"{ou} : « {zh} » ne se lit pas « {pinyin} »"
        for ou, zh, pinyin in textes_chinois(heros)
        if zh and aligner(zh, pinyin, lues) is None
    ]


def fautes_export(sortie: Mapping[str, object], heros: Heros) -> list[str]:
    """L'export dit ce que les sources disent : les rangs et leurs seuils, les bêtes, Tao."""
    fautes: list[str] = []
    rangs = [r for r in sortie.get("rangs") or () if isinstance(r, dict)]  # type: ignore[union-attr]
    attendus = [(r.hz, r.points()) for r in heros.rangs]
    if [(r.get("hz"), r.get("seuil")) for r in rangs] != attendus:
        fautes.append("les rangs exportés ne sont pas ceux des sources")
    seuils = [r.get("seuil") for r in rangs]
    if any(not isinstance(s, int) for s in seuils) or seuils != sorted(set(seuils)):  # type: ignore[type-var]
        fautes.append("seuils exportés non croissants")
    betes = [b for b in sortie.get("betes") or () if isinstance(b, dict)]  # type: ignore[union-attr]
    if [b.get("id") for b in betes] != [b.id for b in heros.betes]:
        fautes.append("les bêtes exportées ne sont pas celles des sources")
    if any(len(b.get("noms") or ()) != IDEES for b in betes):
        fautes.append(f"une bête exportée n'a pas {IDEES} idées de nom")
    tao = sortie.get("tao")
    if not isinstance(tao, dict) or set(tao) != set(JETONS_TAO):
        fautes.append("les phrases de Tao exportées sont incomplètes")
    racines = sortie.get("racines")
    manquantes = [
        c for c in caracteres_dessines(heros) if not isinstance(racines, dict) or c not in racines
    ]
    if manquantes:
        fautes.append(f"sans racine : {''.join(manquantes)}")
    return fautes


def controles(
    destination: Path | None = None,
    *,
    ingest: Path | None = None,
    dossier: Path | None = None,
) -> list[Controle]:
    """Contrôles du personnage, pour `wenlu check`. Tous bloquants.

    « sources » : douze rangs, le premier à 0 point, des seuils strictement croissants,
    des âges dans l'ordre des étapes de vie ; trois bêtes (`tu`, `xiongmao`, `shi`) et
    trois idées de nom chacune ; les huit phrases de Tao, sans jeton inconnu ; aucun
    dragon. « pinyin » : chaque titre et chaque nom de bête se lit dans son pinyin.
    « périmètre » : chaque caractère des titres a ses traits dans l'export (l'app les
    dessine). « export » : `heros.json` dit les rangs, les bêtes et les phrases des sources.
    """
    from .cuisine import lectures
    from .export import versions_exportees
    from .fetes import traits_exportes

    heros = charger(dossier)
    f_src = fautes_sources(heros)
    lues = lectures(ingest)
    f_pin = fautes_pinyin(heros, lues) if lues is not None else []
    dessines = caracteres_dessines(heros)

    dossiers = versions_exportees(destination or EXPORT)
    f_per: list[str] = []
    f_exp: list[str] = []
    for d in dossiers:
        presents = traits_exportes(d)
        f_per += [f"{d.name}:{c} sans traits" for c in dessines if c not in presents]
        chemin = d / "heros.json"
        if not chemin.exists():
            f_exp.append(f"{d.name} : heros.json absent, lancer `wenlu export`")
            continue
        sortie = json.loads(chemin.read_text(encoding="utf-8"))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sortie, heros)]
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        if index.get("heros") != "heros.json":
            f_exp.append(f"{d.name} : index.json ne nomme pas heros.json")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    sans_export = "aucun export écrit : lancer `wenlu export`"
    seuils = " ".join(r.seuil for r in heros.rangs)
    return [
        Controle(
            "héros : sources",
            not f_src,
            detail(
                f_src,
                f"{len(heros.rangs)} rangs (seuils {seuils}), {len(heros.betes)} bêtes,"
                f" {len(heros.tao)} phrases de Tao",
            ),
            bloquant=True,
        ),
        Controle(
            "héros : pinyin",
            not f_pin,
            detail(f_pin, "chaque titre de rang et chaque nom de bête se lit dans son pinyin")
            if lues is not None
            else "lectures absentes : lancer `wenlu ingest`",
            bloquant=True,
        ),
        Controle(
            "héros : périmètre",
            not f_per,
            detail(f_per, f"{len(dessines)} caractères des titres, tous dans les traits exportés")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
        Controle(
            "héros : export",
            not f_exp,
            detail(f_exp, "heros.json dit les rangs, les bêtes et les phrases des sources")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
    ]

