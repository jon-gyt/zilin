"""La cuisine de Tao (story 4b.6) : sources, export, contrôles.

Dix plats de cantine chinoise. Tao lit la recette, en chinois ; on choisit les
ingrédients sur l'étal, parmi des erreurs plausibles (牛奶 pour 牛肉, 米 pour 面) ;
Tao goûte. Cinq sources versionnées dans `data/sources/cuisine/`, rédigées pour
l'app et à relire, lues par `wenlu export`, qui en tire `cuisine.json` :

- `recettes.tsv` : le nom de chaque plat (hanzi, pinyin, français, anglais) et
  s'il fait partie de l'offre gratuite (trois plats, brief §10) ;
- `etapes.tsv` : les étapes, des phrases courtes en chinois ;
- `ingredients.tsv` : chaque ingrédient, ce que Tao en demande, et ses leurres,
  écrits à la main ;
- `etal.tsv` : chaque mot qu'on peut prendre sur l'étal, avec son sens ;
- `tao.tsv` : ce que Tao dit quand elle lit, et quand elle goûte.

Règle de lecture : chaque caractère d'un texte est dans le périmètre exporté et
posé par un parcours, sans quoi la recette ne serait jamais jouable. L'app ne
propose une recette que lorsque tous ses caractères (`caracteres` : le nom, les
étapes, les mots des ingrédients) sont acquis ; l'export les liste, et le jour du
parcours où la recette devient possible (`jours`).

Une question note les caractères de la réponse que le premier leurre n'a pas
(牛肉 contre 牛奶 : 肉) : c'est là que l'erreur se lit. L'app ne rédige rien : elle
lit `cuisine.json`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Sequence

import typer

from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import BUILD, DATA, EXPORT, INGEST

DOSSIER = DATA / "sources" / "cuisine"
RECETTES = DOSSIER / "recettes.tsv"
ETAPES = DOSSIER / "etapes.tsv"
INGREDIENTS = DOSSIER / "ingredients.tsv"
ETAL = DOSSIER / "etal.tsv"
TAO = DOSSIER / "tao.tsv"

#: Dix plats (brief §9), dont trois gratuits (brief §10).
OBJECTIF = 10
GRATUITS = 3

#: Deux à trois leurres par ingrédient : trois ou quatre mots sur l'étal.
LEURRES_MIN = 2
LEURRES_MAX = 3

#: Au moins deux étapes à lire et deux ingrédients à choisir par recette.
ETAPES_MIN = 2
INGREDIENTS_MIN = 2

#: Ce que Tao dit : elle lit la recette, le plat est juste, ou elle grimace.
CLES_TAO = ("lit", "bon", "grimace")

SOURCE_EXPORT = (
    "data/sources/cuisine/ : recettes, étapes, étal et phrases de Tao rédigés pour"
    " l'app (à relire) ; leurres écrits à la main"
)


def hanzi(texte: str) -> list[str]:
    """Les sinogrammes d'un texte, dans l'ordre, sans la ponctuation."""
    return [c for c in texte if "㐀" <= c <= "鿿" or "\U00020000" <= c <= "\U0002ffff"]


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Texte:
    """Un texte chinois, son pinyin et ses traductions."""

    zh: str
    pinyin: str
    fr: str
    en: str

    def en_json(self) -> dict[str, str]:
        return {"zh": self.zh, "pinyin": self.pinyin, "fr": self.fr, "en": self.en}


@dataclass(frozen=True)
class Recette:
    id: str
    gratuit: str
    nom: Texte
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Etape:
    recette: str
    texte: Texte
    numero: int = 0


@dataclass(frozen=True)
class Ingredient:
    """Un ingrédient : le mot qui répond, ce que Tao demande, les leurres de l'étal."""

    recette: str
    zh: str
    fr: str
    en: str
    leurres: tuple[str, ...]
    numero: int = 0


@dataclass(frozen=True)
class Mot:
    """Un mot de l'étal, avec son sens."""

    texte: Texte
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Replique:
    cle: str
    texte: Texte
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Cuisine:
    """Les cinq sources, et les fautes de forme des fichiers."""

    recettes: tuple[Recette, ...]
    etapes: tuple[Etape, ...]
    ingredients: tuple[Ingredient, ...]
    etal: tuple[Mot, ...]
    tao: tuple[Replique, ...]
    forme: tuple[str, ...] = field(default=())

    def etapes_de(self, recette: str) -> list[Etape]:
        return [e for e in self.etapes if e.recette == recette]

    def ingredients_de(self, recette: str) -> list[Ingredient]:
        return [i for i in self.ingredients if i.recette == recette]

    def mots(self) -> dict[str, Mot]:
        return {m.texte.zh: m for m in self.etal}


def _texte(cellules: Mapping[str, str], zh: str = "zh", pinyin: str = "pinyin") -> Texte:
    return Texte(
        zh=cellules.get(zh, ""),
        pinyin=cellules.get(pinyin, ""),
        fr=cellules.get("fr", ""),
        en=cellules.get("en", ""),
    )


def charger(dossier: Path | None = None) -> Cuisine:
    """Les cinq sources de `data/sources/cuisine/`, dans l'ordre des fichiers."""
    d = dossier or DOSSIER
    l_rec, f_rec = lire_tsv(d / RECETTES.name)
    l_eta, f_eta = lire_tsv(d / ETAPES.name)
    l_ing, f_ing = lire_tsv(d / INGREDIENTS.name)
    l_eal, f_eal = lire_tsv(d / ETAL.name)
    l_tao, f_tao = lire_tsv(d / TAO.name)
    return Cuisine(
        recettes=tuple(
            Recette(
                id=l.cellules.get("id", ""),
                gratuit=l.cellules.get("gratuit", ""),
                nom=_texte(l.cellules),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in l_rec
        ),
        etapes=tuple(
            Etape(recette=l.cellules.get("recette", ""), texte=_texte(l.cellules), numero=l.numero)
            for l in l_eta
        ),
        ingredients=tuple(
            Ingredient(
                recette=l.cellules.get("recette", ""),
                zh=l.cellules.get("zh", ""),
                fr=l.cellules.get("fr", ""),
                en=l.cellules.get("en", ""),
                leurres=tuple(l.cellules.get("leurres", "").split()),
                numero=l.numero,
            )
            for l in l_ing
        ),
        etal=tuple(
            Mot(texte=_texte(l.cellules), source=l.cellules.get("source", ""), numero=l.numero)
            for l in l_eal
        ),
        tao=tuple(
            Replique(
                cle=l.cellules.get("cle", ""),
                texte=_texte(l.cellules),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in l_tao
        ),
        forme=tuple(f_rec + f_eta + f_ing + f_eal + f_tao),
    )


# ------------------------------------------------------------------ ce qui se note


def notes(ingredient: Ingredient) -> list[str]:
    """Les caractères notés par une question : ceux de la réponse que le premier leurre n'a pas."""
    premier = set(hanzi(ingredient.leurres[0])) if ingredient.leurres else set()
    return list(dict.fromkeys(c for c in hanzi(ingredient.zh) if c not in premier))


def caracteres_de(recette: Recette, cuisine: Cuisine) -> list[str]:
    """Les caractères qu'il faut avoir acquis pour cuisiner : le nom, les étapes, les ingrédients.

    Dans l'ordre de première apparition. Les leurres n'en sont pas : un leurre se lit
    pour l'écarter, il n'a pas à être appris d'abord.
    """
    textes = [recette.nom.zh]
    textes += [e.texte.zh for e in cuisine.etapes_de(recette.id)]
    textes += [i.zh for i in cuisine.ingredients_de(recette.id)]
    return list(dict.fromkeys(c for t in textes for c in hanzi(t)))


def textes_chinois(cuisine: Cuisine) -> list[tuple[str, Texte]]:
    """Tous les textes chinois des sources, avec l'endroit d'où ils viennent."""
    out: list[tuple[str, Texte]] = []
    out += [(f"recettes.tsv:{r.numero}", r.nom) for r in cuisine.recettes]
    out += [(f"etapes.tsv:{e.numero}", e.texte) for e in cuisine.etapes]
    out += [(f"etal.tsv:{m.numero}", m.texte) for m in cuisine.etal]
    out += [(f"tao.tsv:{t.numero}", t.texte) for t in cuisine.tao]
    return out


def caracteres_ecrits(cuisine: Cuisine) -> list[str]:
    """Tous les caractères que la cuisine écrit, triés : le nom, les étapes, l'étal, Tao."""
    return sorted({c for _, t in textes_chinois(cuisine) for c in hanzi(t.zh)})


def jours_par_parcours(parcours: Mapping[str, Mapping[str, object]]) -> dict[str, dict[str, int]]:
    """Pour chaque parcours, le premier jour où il pose chaque caractère."""
    out: dict[str, dict[str, int]] = {}
    for nom in sorted(parcours):
        jours: dict[str, int] = {}
        for jour in parcours[nom].get("jours") or ():  # type: ignore[union-attr]
            brique = jour.get("brique")
            for c in ([brique] if brique else []) + list(jour.get("composes") or ()):
                jours.setdefault(str(c), int(jour["jour"]))
        out[nom] = jours
    return out


def jour_possible(caracteres: Sequence[str], jours: Mapping[str, int]) -> int | None:
    """Le jour du parcours où tous les caractères sont posés ; `None` s'il en manque un."""
    if not caracteres or any(c not in jours for c in caracteres):
        return None
    return max(jours[c] for c in caracteres)


# ---------------------------------------------------------------------------- export


def document(
    version: str,
    *,
    parcours: Mapping[str, Mapping[str, object]],
    racines: Mapping[str, str],
    en_tete: Mapping[str, object] | None = None,
    dossier: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `cuisine.json`.

    Chaque recette porte son nom, ses étapes, ses ingrédients (le mot, ce que Tao
    demande, les leurres, les caractères notés), les caractères à avoir acquis et, par
    parcours, le jour où elle devient possible (`null` si le parcours n'y mène pas).
    `etal` donne le sens de chaque mot de l'étal, que la correction montre ; `racines`
    la famille de chaque caractère écrit, pour que l'app trouve ses traits.
    """
    cuisine = charger(dossier)
    par_parcours = jours_par_parcours(parcours)
    mots = cuisine.mots()
    recettes: list[dict[str, object]] = []
    for r in cuisine.recettes:
        caracteres = caracteres_de(r, cuisine)
        recettes.append(
            {
                "id": r.id,
                **r.nom.en_json(),
                "gratuit": r.gratuit == "oui",
                "etapes": [e.texte.en_json() for e in cuisine.etapes_de(r.id)],
                "ingredients": [
                    {
                        "zh": i.zh,
                        "pinyin": mots[i.zh].texte.pinyin if i.zh in mots else "",
                        "fr": i.fr,
                        "en": i.en,
                        "leurres": list(i.leurres),
                        "notes": notes(i),
                    }
                    for i in cuisine.ingredients_de(r.id)
                ],
                "caracteres": caracteres,
                "jours": {nom: jour_possible(caracteres, j) for nom, j in par_parcours.items()},
            }
        )
    utilises = sorted({i.zh for i in cuisine.ingredients} | {x for i in cuisine.ingredients for x in i.leurres})
    ecrits = caracteres_ecrits(cuisine)
    return {
        **(en_tete or {}),
        "recettes": recettes,
        "etal": {
            zh: {k: v for k, v in mots[zh].texte.en_json().items() if k != "zh"}
            for zh in utilises
            if zh in mots
        },
        "tao": {t.cle: t.texte.en_json() for t in cuisine.tao},
        "racines": {c: racines[c] for c in ecrits if c in racines},
    }


# ------------------------------------------------------------------------- contrôles


def fautes_sources(cuisine: Cuisine) -> list[str]:
    """Ce qui cloche dans les sources : champs, doublons, gratuits, étal, leurres, étapes."""
    fautes = list(cuisine.forme)
    ids = [r.id for r in cuisine.recettes]
    mots = cuisine.mots()
    vus: set[str] = set()
    for r in cuisine.recettes:
        ou = f"recettes.tsv:{r.numero}"
        if not r.id:
            fautes.append(f"{ou} : recette sans id")
        if r.id in vus:
            fautes.append(f"{ou} : {r.id} en double")
        vus.add(r.id)
        for champ, valeur in (
            ("zh", r.nom.zh),
            ("pinyin", r.nom.pinyin),
            ("fr", r.nom.fr),
            ("en", r.nom.en),
            ("source", r.source),
        ):
            if not valeur:
                fautes.append(f"{ou} : {r.id} sans {champ}")
        if r.gratuit not in ("oui", "non"):
            fautes.append(f"{ou} : {r.id} gratuit {r.gratuit!r}, attendu oui ou non")
        etapes = cuisine.etapes_de(r.id)
        ingredients = cuisine.ingredients_de(r.id)
        if len(etapes) < ETAPES_MIN:
            fautes.append(f"{ou} : {r.id} a {len(etapes)} étapes, au moins {ETAPES_MIN}")
        if len(ingredients) < INGREDIENTS_MIN:
            fautes.append(f"{ou} : {r.id} a {len(ingredients)} ingrédients, au moins {INGREDIENTS_MIN}")
        reponses = [i.zh for i in ingredients]
        if len(set(reponses)) != len(reponses):
            fautes.append(f"{ou} : {r.id} demande deux fois le même ingrédient")
        texte = "".join(e.texte.zh for e in etapes)
        for i in ingredients:
            ici = f"ingredients.tsv:{i.numero}"
            if not (i.fr and i.en):
                fautes.append(f"{ici} : {i.zh} sans ce que Tao demande (fr, en)")
            if i.zh not in texte:
                fautes.append(f"{ici} : {i.zh} n'est écrit dans aucune étape de {r.id}")
            if i.zh not in mots:
                fautes.append(f"{ici} : {i.zh} n'est pas sur l'étal")
            if not LEURRES_MIN <= len(i.leurres) <= LEURRES_MAX:
                fautes.append(f"{ici} : {i.zh} a {len(i.leurres)} leurres, de {LEURRES_MIN} à {LEURRES_MAX}")
            if len(set(i.leurres)) != len(i.leurres):
                fautes.append(f"{ici} : {i.zh} a deux fois le même leurre")
            for x in i.leurres:
                if x == i.zh:
                    fautes.append(f"{ici} : le leurre {x} est la bonne réponse")
                elif x in reponses:
                    fautes.append(f"{ici} : le leurre {x} est un autre ingrédient de {r.id}")
                if x not in mots:
                    fautes.append(f"{ici} : le leurre {x} n'est pas sur l'étal")
                elif i.zh in mots and mots[x].texte.fr == mots[i.zh].texte.fr:
                    fautes.append(f"{ici} : le leurre {x} a le même sens que {i.zh}")
            if i.leurres and not notes(i):
                fautes.append(f"{ici} : {i.zh} n'a aucun caractère que {i.leurres[0]} n'ait pas")
    for e in cuisine.etapes:
        if e.recette not in ids:
            fautes.append(f"etapes.tsv:{e.numero} : recette inconnue {e.recette!r}")
        if not all((e.texte.zh, e.texte.pinyin, e.texte.fr, e.texte.en)):
            fautes.append(f"etapes.tsv:{e.numero} : étape incomplète")
    for i in cuisine.ingredients:
        if i.recette not in ids:
            fautes.append(f"ingredients.tsv:{i.numero} : recette inconnue {i.recette!r}")
    vus_etal: set[str] = set()
    for m in cuisine.etal:
        ou = f"etal.tsv:{m.numero}"
        if m.texte.zh in vus_etal:
            fautes.append(f"{ou} : {m.texte.zh} en double")
        vus_etal.add(m.texte.zh)
        if not all((m.texte.zh, m.texte.pinyin, m.texte.fr, m.texte.en, m.source)):
            fautes.append(f"{ou} : mot incomplet {m.texte.zh!r}")
    cles = [t.cle for t in cuisine.tao]
    for cle in CLES_TAO:
        if cles.count(cle) != 1:
            fautes.append(f"tao.tsv : {cles.count(cle)} lignes pour {cle}, attendu une")
    for t in cuisine.tao:
        if t.cle not in CLES_TAO:
            fautes.append(f"tao.tsv:{t.numero} : clé inconnue {t.cle!r}")
        if not all((t.texte.zh, t.texte.pinyin, t.texte.fr, t.texte.en, t.source)):
            fautes.append(f"tao.tsv:{t.numero} : réplique incomplète")
    gratuits = [r.id for r in cuisine.recettes if r.gratuit == "oui"]
    if len(gratuits) != GRATUITS:
        fautes.append(f"{len(gratuits)} plats gratuits, le brief en veut {GRATUITS}")
    elif [r.id for r in cuisine.recettes[:GRATUITS]] != gratuits:
        fautes.append("les plats gratuits ne sont pas les trois premiers")
    return fautes


def lectures(ingest: Path | None = None) -> dict[str, tuple[str, ...]] | None:
    """Les lectures admises de chaque caractère : Make Me a Hanzi, Unihan, puis les surcharges.

    `None` sans `wenlu ingest` (la CI n'en a pas) : on ne devine pas une lecture.
    """
    from .surcharges import charger_pinyin

    ingest = ingest or INGEST
    if not (ingest / "caracteres.json").exists() and not (ingest / "unihan.json").exists():
        return None
    table: dict[str, set[str]] = {}
    chemin = ingest / "caracteres.json"
    if chemin.exists():
        for e in json.loads(chemin.read_text(encoding="utf-8")):
            table.setdefault(str(e["c"]), set()).update(str(x) for x in e.get("pinyin") or ())
    chemin = ingest / "unihan.json"
    if chemin.exists():
        for e in json.loads(chemin.read_text(encoding="utf-8"))["caracteres"]:
            table.setdefault(str(e["c"]), set()).update(str(x) for x in e.get("lectures") or ())
    for c, lues in charger_pinyin().items():
        table.setdefault(c, set()).update(lues)
    return {c: tuple(sorted(v)) for c, v in table.items()}


def fautes_pinyin(cuisine: Cuisine, lues: Mapping[str, Sequence[str]]) -> list[str]:
    """Chaque texte chinois se lit, caractère par caractère, dans son pinyin."""
    from .pinyin import aligner

    return [
        f"{ou} : « {t.zh} » ne se lit pas « {t.pinyin} »"
        for ou, t in textes_chinois(cuisine)
        if t.zh and aligner(t.zh, t.pinyin, lues) is None
    ]


def _parcours(build: Path) -> dict[str, dict[str, object]]:
    return {
        chemin.stem.removeprefix("parcours-"): json.loads(chemin.read_text(encoding="utf-8"))
        for chemin in sorted(build.glob("parcours-*.json"))
    }


def fautes_parcours(cuisine: Cuisine, parcours: Mapping[str, Mapping[str, object]]) -> list[str]:
    """Chaque caractère écrit est posé par un parcours ; un plat gratuit se cuisine dans chacun."""
    par_parcours = jours_par_parcours(parcours)
    if not par_parcours:
        return []
    enseignes = {c for j in par_parcours.values() for c in j}
    fautes = [f"{c} hors parcours" for c in caracteres_ecrits(cuisine) if c not in enseignes]
    for r in cuisine.recettes:
        if r.gratuit != "oui":
            continue
        caracteres = caracteres_de(r, cuisine)
        for nom, jours in sorted(par_parcours.items()):
            manquants = [c for c in caracteres if c not in jours]
            if manquants:
                fautes.append(f"{r.id} (gratuit) : {' '.join(manquants)} hors du parcours {nom}")
    return fautes


def fautes_export(sorties: Sequence[Mapping[str, object]], cuisine: Cuisine) -> list[str]:
    """L'export dit ce que les sources disent : chaque recette, ses caractères, ses leurres."""
    fautes: list[str] = []
    attendues = {r.id: r for r in cuisine.recettes}
    exportees = [str(s.get("id")) for s in sorties]
    manquantes = [x for x in attendues if x not in exportees]
    if manquantes:
        fautes.append(f"non exportées : {' '.join(manquantes)}")
    for s in sorties:
        rid = str(s.get("id"))
        r = attendues.get(rid)
        if r is None:
            fautes.append(f"{rid} : recette inconnue des sources")
            continue
        if list(s.get("caracteres") or ()) != caracteres_de(r, cuisine):  # type: ignore[call-overload]
            fautes.append(f"{rid} : caractères à acquérir incomplets")
        for i in s.get("ingredients") or ():  # type: ignore[union-attr]
            zh = str(i.get("zh"))
            ls = [str(x) for x in i.get("leurres") or ()]
            if zh in ls:
                fautes.append(f"{rid} : le leurre {zh} est la bonne réponse")
            ns = [str(x) for x in i.get("notes") or ()]
            if not ns or any(c not in hanzi(zh) for c in ns):
                fautes.append(f"{rid} : {zh} note {''.join(ns) or 'rien'}")
    return fautes


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    dossier: Path | None = None,
) -> list[Controle]:
    """Contrôles de la cuisine, pour `wenlu check`. Tous bloquants.

    « sources » : dix recettes complètes, trois gratuites en tête, chaque ingrédient
    écrit dans une étape et sur l'étal, deux ou trois leurres distincts, jamais la bonne
    réponse, jamais un autre ingrédient de la recette, jamais du même sens, chacun avec
    au moins un caractère noté ; les phrases de Tao. « pinyin » : chaque texte se lit
    dans son pinyin. « périmètre » : chaque caractère écrit a ses traits dans l'export.
    « parcours » : chaque caractère écrit est posé par un parcours, et les plats
    gratuits se cuisinent dans chaque parcours. « export » : `cuisine.json` dit toutes
    les recettes, avec leurs caractères à acquérir et des leurres distincts de la réponse.
    """
    from .export import versions_exportees
    from .fetes import traits_exportes

    build = build or BUILD
    cuisine = charger(dossier)
    f_src = fautes_sources(cuisine)
    lues = lectures(ingest)
    f_pin = fautes_pinyin(cuisine, lues) if lues is not None else []
    f_par = fautes_parcours(cuisine, _parcours(build))
    ecrits = caracteres_ecrits(cuisine)

    dossiers = versions_exportees(destination or EXPORT)
    f_per: list[str] = []
    f_exp: list[str] = []
    exportees = 0
    for d in dossiers:
        presents = traits_exportes(d)
        f_per += [f"{d.name}:{c} sans traits" for c in ecrits if c not in presents]
        chemin = d / "cuisine.json"
        if not chemin.exists():
            f_exp.append(f"{d.name} : cuisine.json absent, lancer `wenlu export`")
            continue
        sorties = json.loads(chemin.read_text(encoding="utf-8")).get("recettes") or []
        exportees = max(exportees, len(sorties))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sorties, cuisine)]

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    sans_export = "aucun export écrit : lancer `wenlu export`"
    return [
        Controle(
            "cuisine : sources",
            not f_src,
            detail(
                f_src,
                f"{len(cuisine.recettes)} recettes (objectif : {OBJECTIF}), {GRATUITS} gratuites,"
                f" {len(cuisine.ingredients)} ingrédients, {len(cuisine.etal)} mots sur l'étal",
            ),
            bloquant=True,
        ),
        Controle(
            "cuisine : pinyin",
            not f_pin,
            detail(f_pin, "chaque nom, étape, mot de l'étal et phrase de Tao se lit dans son pinyin")
            if lues is not None
            else "lectures absentes : lancer `wenlu ingest`",
            bloquant=True,
        ),
        Controle(
            "cuisine : périmètre",
            not f_per,
            detail(f_per, f"{len(ecrits)} caractères écrits, tous dans les traits exportés")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
        Controle(
            "cuisine : parcours",
            not f_par,
            detail(f_par, "chaque caractère est posé par un parcours ; les plats gratuits se cuisinent dans chacun"),
            bloquant=True,
        ),
        Controle(
            "cuisine : export",
            not f_exp,
            detail(f_exp, f"{exportees} recettes exportées, caractères à acquérir et leurres conformes")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
    ]


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="La cuisine de Tao : relecture des recettes.")


@app.command("apercu")
def commande_apercu(version: str = typer.Option("0.1.0", help="Version exportée à relire.")) -> None:
    """Affiche chaque recette exportée : nom, étapes, ingrédients et leurres. Exige `export`."""
    chemin = EXPORT / version / "cuisine.json"
    if not chemin.exists():
        typer.echo(f"{chemin} absent : lancer `wenlu export`.", err=True)
        raise typer.Exit(code=1)
    document_export = json.loads(chemin.read_text(encoding="utf-8"))
    for r in document_export["recettes"]:
        jours = " ".join(f"{nom} {jour if jour is not None else '—'}" for nom, jour in r["jours"].items())
        typer.echo(f"{r['zh']} {r['pinyin']} · {r['fr']}{' · gratuit' if r['gratuit'] else ''} · {jours}")
        for e in r["etapes"]:
            typer.echo(f"  {e['zh']}\t{e['fr']}")
        for i in r["ingredients"]:
            typer.echo(f"  → {i['zh']} ({i['fr']}) ; leurres {' '.join(i['leurres'])} ; note {''.join(i['notes'])}")
    typer.echo(f"{len(document_export['recettes'])} recettes.")
