"""Le dictionnaire de la loupe Chercher : export des 3 000 caractères et des 11 092 mots du HSK 3.0.

Stories D.2 (format) et D.3 (traits) du dictionnaire. `wenlu export` appelle `documents()` et
écrit, dans le dossier de version :

- `dico/index.json` : l'index unique, que l'app charge à l'ouverture de Chercher (et que le
  service worker précache). Une ligne par entrée, en tableau : de quoi chercher par
  caractère, par pinyin et par la glose française relue, et savoir dans quel lot lire la
  fiche. Rien d'autre.
- `dico/caracteres/<lot>.json` et `dico/mots/<lot>.json` : les entrées, par lots, chargés
  à la demande : pinyin, niveau, catégorie, décomposition GF 0014-2009 quand elle est
  réconciliée, mots qui contiennent le caractère, place du caractère sur le chemin. Et deux
  emplacements vides, `sens` et `exemples`, qu'une autre story remplira (`data/schema.md`).
- `traits/dico-<lot>.json` : les tracés des 3 000 caractères, puis des composants de leurs
  décompositions hors de la liste, au format de `traits/<racine>.json` (en-tête de l'Arphic
  Public License, clé `traits`), que `strokes.ts` lit déjà. Un lot de traits de caractères
  porte les mêmes caractères que le lot de fiches du même numéro.

Les lots suivent l'ordre du pinyin (la lecture principale numérotée, puis le point de
code) : une recherche par syllabe (`hao`) tombe dans un ou deux lots. La liste des
caractères vient de `data/sources/listes/hsk-*.txt`, celle des mots de `hsk-mots.tsv`
(`mots_hsk.py`) ; rien ne vient de CC-CEDICT.

Régimes de licence (`docs/sources-licences.md` §8) : `dico/` est propriétaire, source
citée (la liste HSK sous MIT, texte dans `MIT-hsk30.txt` ; le pinyin d'Unihan ; les
décompositions de cjk-decomp) ; `traits/dico-*.json` est sous Arphic Public License, et
ne porte que des tracés.

Seuls les sens au statut `relu` s'exportent et se cherchent (décision du propriétaire du
29 septembre 2026) : `sens_exporte` écarte tout le reste, et la glose de l'index vient du
seul sens relu.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from . import mots_hsk
from .gf0014 import Controle
from .mots_hsk import Mot, numeroter

#: Les caractères d'un lot de fiches (et du lot de traits du même numéro) : ~130 Kio de
#: traits bruts, ~50 Kio transférés.
TAILLE_LOT_CARACTERES = 50
#: Les mots d'un lot : ~30 Kio bruts.
TAILLE_LOT_MOTS = 200

DOSSIER = "dico"
INDEX = f"{DOSSIER}/index.json"
MODELE_CARACTERES = f"{DOSSIER}/caracteres/{{lot}}.json"
MODELE_MOTS = f"{DOSSIER}/mots/{{lot}}.json"
MODELE_TRAITS = "traits/dico-{lot}.json"

#: Le niveau d'une entrée dans l'index : 1 à 6, et 7 pour « 7-9 ».
NIVEAUX: dict[str, int] = {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7-9": 7}
LISTES_HSK: dict[str, int] = {f"hsk-{n}": v for n, v in NIVEAUX.items()}

#: La glose de la liste des résultats : 40 caractères au plus (comme le sens des fiches).
GLOSE_MAX = 40
RELU = "relu"

COLONNES_CARACTERES: tuple[str, ...] = ("c", "lectures", "niveau", "lot", "glose")
COLONNES_MOTS: tuple[str, ...] = ("id", "formes", "lectures", "niveau", "lot", "glose")

SOURCE_DICO = (
    "liste HSK 3.0 (GF 0025-2021) : caractères data/sources/listes/hsk-*.txt, mots"
    " data/sources/listes/hsk-mots.tsv (ivankra/hsk30, MIT) ; pinyin des caractères d'Unihan ;"
    " décomposition GF 0014-2009 réconciliée par le pipeline wenlu ; sens et exemples rédigés"
    " pour l'app et relus"
)


class DicoInvalide(ValueError):
    """Une entrée du dictionnaire ne peut pas s'exporter telle quelle."""


# ------------------------------------------------------------------------ les sens


def sens_exporte(sens: Mapping[str, object] | None) -> dict[str, object] | None:
    """Le sens d'une entrée tel qu'il s'exporte : relu, ou rien.

    Forme (`data/schema.md`, « Le dictionnaire ») : `{statut, glose, acceptions:
    [{categorie, fr}]}`. Un sens qui n'est pas `relu` ne s'exporte pas ; un sens relu dont
    la glose dépasse `GLOSE_MAX` ou manque est refusé.
    """
    if not sens or sens.get("statut") != RELU:
        return None
    glose = str(sens.get("glose") or "").strip()
    if not glose or len(glose) > GLOSE_MAX:
        raise DicoInvalide(f"glose relue vide ou de plus de {GLOSE_MAX} caractères : {glose!r}")
    acceptions = [
        {"categorie": str(a.get("categorie") or ""), "fr": str(a.get("fr") or "")}
        | ({"pinyin": str(a["pinyin"])} if a.get("pinyin") else {})
        for a in sens.get("acceptions") or ()  # type: ignore[union-attr]
        if isinstance(a, Mapping) and a.get("fr")
    ]
    return {"statut": RELU, "glose": glose, "acceptions": acceptions}


def exemples_exportes(exemples: Iterable[Mapping[str, object]] | None) -> list[dict[str, object]]:
    """Les phrases d'exemple relues d'une entrée : `{zh, pinyin, fr, statut}`, rien d'autre."""
    return [
        {"zh": str(e["zh"]), "pinyin": str(e.get("pinyin") or ""), "fr": str(e.get("fr") or ""), "statut": RELU}
        for e in exemples or ()
        if e.get("statut") == RELU and e.get("zh")
    ]


# ----------------------------------------------------------------------- les entrées


@dataclass(frozen=True)
class Caractere:
    c: str
    niveau: int
    pinyin: str
    lectures: tuple[str, ...]

    @property
    def numerotees(self) -> tuple[str, ...]:
        vues: list[str] = []
        for x in (self.pinyin, *self.lectures):
            n = numeroter(x) if x else ""
            if n and n not in vues:
                vues.append(n)
        return tuple(vues)


def caracteres_de_la_liste(
    listes: Mapping[str, Sequence[str]],
    pinyin: Mapping[str, str],
    lectures: Mapping[str, Sequence[str]] | None,
) -> list[Caractere]:
    """Les 3 000 caractères, chacun à son niveau, avec sa lecture principale en tête."""
    out: list[Caractere] = []
    for nom, niveau in LISTES_HSK.items():
        for c in listes.get(nom) or ():
            principale = pinyin.get(c, "")
            autres = [x for x in (lectures or {}).get(c, ()) if x != principale]
            out.append(Caractere(c=c, niveau=niveau, pinyin=principale, lectures=(principale, *autres) if principale else tuple(autres)))
    return out


def _cle_caractere(c: Caractere) -> tuple[str, int]:
    return (c.numerotees[0] if c.numerotees else "~", ord(c.c[0]))


def _cle_mot(m: Mot) -> tuple[str, str]:
    return (" ".join(m.forme.syllabes), m.id)


def lotir(elements: Sequence[object], taille: int) -> dict[int, list[object]]:
    return {i // taille: list(elements[i : i + taille]) for i in range(0, len(elements), taille)}


def _lectures_du_mot(m: Mot) -> list[str]:
    vues: list[str] = []
    for f in m.formes:
        for s in (f.syllabes, f.pleines):
            x = " ".join(s)
            if x and x not in vues:
                vues.append(x)
    return vues


def _formes_du_mot(m: Mot) -> list[str]:
    vues: list[str] = []
    for f in m.formes:
        if f.hanzi not in vues:
            vues.append(f.hanzi)
    return vues


def mots_par_caractere(mots: Sequence[Mot]) -> dict[str, list[str]]:
    """Pour chaque sinogramme, les mots qui le contiennent (une graphie au moins), niveau puis ordre de la norme."""
    par: dict[str, list[str]] = {}
    for m in sorted(mots, key=lambda x: (NIVEAUX[x.niveau], x.id)):
        vus = {c for f in m.formes for c in f.hanzi}
        for c in sorted(vus):
            par.setdefault(c, []).append(m.id)
    return par


def jours_du_chemin(parcours: Mapping[str, Mapping[str, object]]) -> dict[str, dict[str, int]]:
    """Pour chaque caractère posé, son jour sur chaque parcours : `{"好": {"lire": 14, "hsk": 20}}`."""
    jours: dict[str, dict[str, int]] = {}
    for nom in sorted(parcours):
        for jour in parcours[nom].get("jours") or ():  # type: ignore[union-attr]
            brique = jour.get("brique")
            for c in ([brique] if brique else []) + list(jour.get("composes") or ()):
                jours.setdefault(str(c), {}).setdefault(nom, int(jour["jour"]))
    return jours


def entree_caractere(
    c: Caractere,
    *,
    decompositions: Mapping[str, Mapping[str, object]],
    reconcilies: set[str],
    mots: Mapping[str, Sequence[str]],
    jours: Mapping[str, Mapping[str, int]],
    sens: Mapping[str, object] | None,
    exemples: Sequence[Mapping[str, object]] | None,
) -> dict[str, object]:
    decomposition: dict[str, object] | None = None
    if c.c in reconcilies and c.c in decompositions:
        d = decompositions[c.c]
        composants = [str(x) for x in (d.get("composants") or [])]
        decomposition = {
            "norme": "GF 0014-2009",
            "parts": [] if composants in ([], [c.c]) else composants,
            "sources": [str(s) for s in (d.get("sources") or [])],
        }
    return {
        "c": c.c,
        "pinyin": c.pinyin,
        "lectures": list(c.lectures),
        "niveau": c.niveau,
        "decomposition": decomposition,
        "mots": list(mots.get(c.c, ())),
        "chemin": dict(sorted(jours.get(c.c, {}).items())),
        "sens": sens_exporte(sens),  # type: ignore[arg-type]
        "exemples": exemples_exportes(exemples),
    }


def _forme(f: mots_hsk.Forme) -> dict[str, object]:
    return {"hanzi": f.hanzi, "pinyin": f.pinyin, "syllabes": list(f.syllabes)}


def entree_mot(
    m: Mot, *, sens: Mapping[str, object] | None, exemples: Sequence[Mapping[str, object]] | None
) -> dict[str, object]:
    entree: dict[str, object] = {
        "id": m.id,
        "hanzi": m.forme.hanzi,
        "pinyin": m.forme.pinyin,
        "syllabes": list(m.forme.syllabes),
        "niveau": NIVEAUX[m.niveau],
        "categories": list(m.categorie),
        "officiel": m.officiel,
    }
    if m.forme.pleines:
        entree["pleines"] = list(m.forme.pleines)
    if m.variantes:
        entree["variantes"] = [_forme(v) for v in m.variantes]
    if m.exemple:
        entree["emploi"] = _forme(m.exemple)
    entree["sens"] = sens_exporte(sens)
    entree["exemples"] = exemples_exportes(exemples)
    return entree


# ------------------------------------------------------------------------ documents


def _compact(contenu: object) -> str:
    """Tout le dictionnaire s'écrit compact : quatorze mille lignes indentées pèseraient le double."""
    return json.dumps(contenu, ensure_ascii=False, separators=(",", ":")) + "\n"


def en_tete(version: str, modified: str, source_url: str) -> dict[str, object]:
    return {
        "version": version,
        "license": "propriétaire",
        "license_files": [mots_hsk.TEXTE_LICENCE, "UNICODE-LICENSE.txt", "MIT-cjk-decomp.txt"],
        "source": SOURCE_DICO,
        "source_url": source_url,
        "modified": modified,
    }


def documents(
    version: str,
    *,
    listes: Mapping[str, Sequence[str]],
    mots: Sequence[Mot],
    pinyin: Mapping[str, str],
    lectures: Mapping[str, Sequence[str]] | None,
    decompositions: Mapping[str, Mapping[str, object]],
    reconcilies: set[str],
    parcours: Mapping[str, Mapping[str, object]],
    graphies: Mapping[str, Mapping[str, object]],
    traits_en_tete: Mapping[str, object],
    modified: str,
    source_url: str,
    sens: Mapping[str, Mapping[str, object]] | None = None,
    exemples: Mapping[str, Sequence[Mapping[str, object]]] | None = None,
    decoupes: Iterable[str] = (),
) -> dict[str, str]:
    """Les fichiers du dictionnaire, par chemin relatif au dossier de version.

    `sens` et `exemples` : par identifiant d'entrée (le caractère, ou l'`id` du mot) ; vides
    tant que la story des sens ne les écrit pas. `traits_en_tete` : l'en-tête APL des
    fichiers de traits, sans la clé `traits`.
    """
    sens = sens or {}
    exemples = exemples or {}
    decoupes = set(decoupes)

    def traits(table: Mapping[str, object]) -> str:
        """Un lot de traits : l'en-tête APL, nommant les composants découpés qu'il porte."""
        tete_traits = dict(traits_en_tete)
        ici = [c for c in table if c in decoupes]
        if ici:
            tete_traits["modified"] = (
                f"{tete_traits['modified']} Sauf {' '.join(ici)} : traits découpés dans un"
                " caractère hôte et recadrés, voir MODIFICATIONS.md."
            )
        return _compact({**tete_traits, "traits": table})

    caracteres = sorted(caracteres_de_la_liste(listes, pinyin, lectures), key=_cle_caractere)
    dans_la_liste = {c.c for c in caracteres}
    par_caractere = mots_par_caractere(mots)
    jours = jours_du_chemin(parcours)
    tete = en_tete(version, modified, source_url)
    textes: dict[str, str] = {}

    lots_c = lotir(caracteres, TAILLE_LOT_CARACTERES)
    lot_de_c: dict[str, int] = {}
    for n, lot in lots_c.items():
        entrees = {}
        for c in lot:
            assert isinstance(c, Caractere)
            lot_de_c[c.c] = n
            entrees[c.c] = entree_caractere(
                c,
                decompositions=decompositions,
                reconcilies=reconcilies,
                mots=par_caractere,
                jours=jours,
                sens=sens.get(c.c),
                exemples=exemples.get(c.c),
            )
        textes[MODELE_CARACTERES.format(lot=n)] = _compact({**tete, "lot": n, "entrees": entrees})
        textes[MODELE_TRAITS.format(lot=n)] = traits(
            {c.c: graphies[c.c] for c in lot if isinstance(c, Caractere) and c.c in graphies}
        )

    # Les composants des décompositions hors de la liste : la fiche les dessine aussi.
    hors = sorted(
        {
            str(p)
            for c in caracteres
            if c.c in reconcilies
            for p in (decompositions.get(c.c, {}).get("composants") or [])
            if str(p) not in dans_la_liste and str(p) in graphies
        },
        key=lambda x: [ord(y) for y in x],
    )
    premier = len(lots_c)
    traits_hors: dict[str, int] = {}
    for k, lot in lotir(hors, TAILLE_LOT_CARACTERES).items():
        n = premier + k
        for p in lot:
            traits_hors[str(p)] = n
        textes[MODELE_TRAITS.format(lot=n)] = traits({str(p): graphies[str(p)] for p in lot})

    ordonnes = sorted(mots, key=_cle_mot)
    lots_m = lotir(ordonnes, TAILLE_LOT_MOTS)
    lot_de_m: dict[str, int] = {}
    for n, lot in lots_m.items():
        entrees = {}
        for m in lot:
            assert isinstance(m, Mot)
            lot_de_m[m.id] = n
            entrees[m.id] = entree_mot(m, sens=sens.get(m.id), exemples=exemples.get(m.id))
        textes[MODELE_MOTS.format(lot=n)] = _compact({**tete, "lot": n, "entrees": entrees})

    def glose(ident: str) -> str:
        s = sens_exporte(sens.get(ident))
        return str(s["glose"]) if s else ""

    index = {
        **tete,
        "liste": "HSK 3.0 (GF 0025-2021), niveaux 1 à 9",
        "compte": {
            "caracteres": len(caracteres),
            "mots": len(mots),
            "sens_relus": sum(1 for x in [*(c.c for c in caracteres), *(m.id for m in mots)] if glose(x)),
            "lots_caracteres": len(lots_c),
            "lots_mots": len(lots_m),
            "lots_traits": len(lots_c) + len(set(traits_hors.values())),
        },
        "niveaux": {"7": "7-9"},
        "fichiers": {"caracteres": MODELE_CARACTERES, "mots": MODELE_MOTS, "traits": MODELE_TRAITS},
        "colonnes": {"caracteres": list(COLONNES_CARACTERES), "mots": list(COLONNES_MOTS)},
        "caracteres": [
            [c.c, "|".join(c.numerotees), c.niveau, lot_de_c[c.c], glose(c.c)]
            for c in caracteres
        ],
        "mots": [
            [m.id, "|".join(_formes_du_mot(m)), "|".join(_lectures_du_mot(m)), NIVEAUX[m.niveau], lot_de_m[m.id], glose(m.id)]
            for m in ordonnes
        ],
        "traits_hors_liste": traits_hors,
    }
    textes[INDEX] = _compact(index)
    return textes


# ------------------------------------------------------------------------ contrôles


def fautes(dossier: Path, *, caracteres_attendus: int, mots_attendus: int) -> tuple[list[str], list[str], list[str], dict[str, int]]:
    """(entrées et lots, traits, sens) : ce qui cloche dans le dictionnaire d'une version."""
    index = json.loads((dossier / INDEX).read_text(encoding="utf-8"))
    lots: list[str] = []
    traits: list[str] = []
    sens: list[str] = []
    rows_c = index.get("caracteres") or []
    rows_m = index.get("mots") or []
    if len(rows_c) != caracteres_attendus:
        lots.append(f"{len(rows_c)} caractères au lieu de {caracteres_attendus}")
    if len(rows_m) != mots_attendus:
        lots.append(f"{len(rows_m)} mots au lieu de {mots_attendus}")
    fichiers = index.get("fichiers") or {}
    attendus: set[str] = {INDEX}
    cache: dict[str, dict[str, object]] = {}

    def lire(relatif: str) -> dict[str, object] | None:
        if relatif not in cache:
            chemin = dossier / relatif
            cache[relatif] = json.loads(chemin.read_text(encoding="utf-8")) if chemin.is_file() else {}
        return cache[relatif] or None

    for genre, rows in (("caracteres", rows_c), ("mots", rows_m)):
        for row in rows:
            ident, lot, g = row[0], row[-2], row[-1]
            relatif = str(fichiers.get(genre, "")).format(lot=lot)
            attendus.add(relatif)
            doc = lire(relatif)
            entree = ((doc or {}).get("entrees") or {}).get(ident)  # type: ignore[union-attr]
            if entree is None:
                lots.append(f"{ident} absent de {relatif}")
                continue
            s = entree.get("sens")
            if s is not None and (s.get("statut") != RELU or not s.get("glose") or len(str(s.get("glose"))) > GLOSE_MAX):
                sens.append(f"{ident} : sens {s.get('statut')!r}")
            if g != (s.get("glose") if s and s.get("statut") == RELU else ""):
                sens.append(f"{ident} : glose de l'index {g!r} sans sens relu identique")
            if any(e.get("statut") != RELU for e in entree.get("exemples") or ()):
                sens.append(f"{ident} : exemple non relu")
            if genre == "caracteres":
                t = str(fichiers.get("traits", "")).format(lot=lot)
                attendus.add(t)
                if ident not in ((lire(t) or {}).get("traits") or {}):  # type: ignore[operator]
                    traits.append(ident)
    for p, lot in (index.get("traits_hors_liste") or {}).items():
        t = str(fichiers.get("traits", "")).format(lot=lot)
        attendus.add(t)
        if p not in ((lire(t) or {}).get("traits") or {}):  # type: ignore[operator]
            traits.append(p)
    presents = {str(f.relative_to(dossier)) for f in (dossier / DOSSIER).rglob("*.json")}
    presents |= {str(f.relative_to(dossier)) for f in (dossier / "traits").glob("dico-*.json")}
    lots += [f"{r} : hors de l'index" for r in sorted(presents - attendus)]
    lots += [f"{r} : absent, l'index y renvoie" for r in sorted(attendus - presents)]
    compte = {"caracteres": len(rows_c), "mots": len(rows_m), "sens": sum(1 for r in [*rows_c, *rows_m] if r[-1])}
    return lots, traits, sens, compte


def controles(destination: Path | None = None, *, listes: Path | None = None) -> list[Controle]:
    """Contrôles du dictionnaire exporté, pour `wenlu check`."""
    from .export import versions_exportees
    from .ingest import charger_listes

    dossiers = [d for d in versions_exportees(destination) if (d / INDEX).exists()]
    if not dossiers:
        return [Controle("dico : entrées", True, "aucun dictionnaire exporté : lancer `wenlu export`")]
    attendus_c = sum(len(v) for k, v in charger_listes(listes).items() if k in LISTES_HSK)
    attendus_m = len(mots_hsk.charger())
    f_lots: list[str] = []
    f_traits: list[str] = []
    f_sens: list[str] = []
    comptes: list[dict[str, int]] = []
    for dossier in dossiers:
        lots, traits, sens, compte = fautes(dossier, caracteres_attendus=attendus_c, mots_attendus=attendus_m)
        f_lots += [f"{dossier.name}: {x}" for x in lots]
        f_traits += [f"{dossier.name}:{x}" for x in traits]
        f_sens += [f"{dossier.name}: {x}" for x in sens]
        comptes.append(compte)
    c = comptes[-1]
    return [
        Controle(
            "dico : entrées",
            not f_lots,
            f"{c['caracteres']} caractères et {c['mots']} mots, chacun dans son lot, aucun fichier hors de l'index"
            if not f_lots
            else f"{len(f_lots)} écarts — " + " ; ".join(f_lots[:5]),
            bloquant=True,
        ),
        Controle(
            "dico : traits",
            not f_traits,
            "chaque caractère du dictionnaire et chaque composant de ses décompositions a ses traits dans son lot"
            if not f_traits
            else f"{len(f_traits)} sans traits : {' '.join(f_traits[:20])}",
            bloquant=True,
        ),
        Controle(
            "dico : sens relus seulement",
            not f_sens,
            f"{c['sens']} gloses relues dans l'index ; aucun sens ni exemple non relu"
            if not f_sens
            else f"{len(f_sens)} écarts — " + " ; ".join(f_sens[:5]),
            bloquant=True,
        ),
    ]
