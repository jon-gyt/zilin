"""Les trois lignes du pas Utiliser : un court texte par jour du chemin, avec l'acquis.

Brief §6, pas 4 : « deux mots, une phrase, trois lignes à lire avec uniquement l'acquis.
Le caractère du jour en rouge. » Les deux mots et la phrase viennent de la fiche du jour ;
les trois lignes, de ce module. Chaque jour du chemin, sur chacun des deux parcours, a son
texte : trois lignes, écrites avec les seuls caractères que ce parcours a posés ce jour-là
(brique et composés des jours 1 à `jour`), et qui emploient au moins un des caractères
nouveaux du jour, que l'app met en cinabre.

Les jours 1 à 3 n'en ont pas : ils forment la première session (人, 大, 天, puis lire
天天, brief §6), qui a son propre mot à lire ; la session complète commence au jour 4.

Sources, versionnées (`data/sources/trois-lignes/`) :

- `glossaire.tsv` : la glose partagée, `zh`, `pinyin`, `fr`, `en`, par caractère ou par
  mot ; le lecteur découpe chaque ligne par l'entrée la plus longue, comme les contes ;
- `lire.json`, `hsk.json` : un fichier par parcours, `generation` (la traçabilité),
  `relecture` (la décision qui fait foi), puis `textes`, un par jour :
  `{jour, statut, lignes: [{zh, pinyin, fr, en}] × 3, glose?: [{zh, pinyin, fr, en}]}`.
  `glose`, facultative, précise une entrée pour ce texte seul (une autre lecture d'un
  polyphone, un mot propre au texte) et passe devant le glossaire.

Rédaction : à la main, dans une session Claude Code, sans API ni clé (`generation`,
`modele` « rédaction manuelle », `api` « session Claude Code (sans API) »). `wenlu
trois-lignes contexte <parcours> <jour>` donne l'acquis du jour et ses caractères
nouveaux. Relecture : le statut `relu` d'un texte vient d'une décision du propriétaire,
citée dans `relecture` en tête du fichier ; un texte `a_relire` n'est pas exporté.

Contrôles (`wenlu check`), bloquants : « périmètre » (aucun caractère hors de l'acquis du
jour, au moins un caractère nouveau du jour), « pinyin » (une syllabe par sinogramme, tons
du dictionnaire sans sandhi, chacune une lecture du caractère), « glose » (chaque
sinogramme couvert tel que le lecteur découpe, au pinyin des lignes, fr et en), « forme »
(trois lignes traduites, longueur), « couverture » (chaque jour de `PREMIER_JOUR` à
`COUVERTURE`, sur les deux parcours) et « export ». Signalés : la relecture, et les jours
du chemin au-delà qui n'ont pas encore de texte.

Licences : rien n'est tiré de CC-CEDICT ni de Make Me a Hanzi comme texte ; lignes,
traductions et glose sont rédigées pour l'app. Les lectures (Unihan, Make Me a Hanzi,
surcharges) ne servent qu'au contrôle du pinyin.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import typer

from .contes import (
    A_RELIRE,
    API_SESSION,
    MODELE_MANUEL,
    RELU,
    STATUTS,
    Glose,
    Phrase,
    _syllabes,
    caracteres_hors_liste,
    segmenter,
)
from .fetes import lire_tsv
from .gf0014 import Controle
from .ingest import est_sinogramme
from .lettres import acquis_au_jour, charger_parcours, poses_par_jour
from .paths import BUILD, DATA

DOSSIER = DATA / "sources" / "trois-lignes"
GLOSSAIRE = DOSSIER / "glossaire.tsv"

#: Les deux parcours du chemin, chacun avec ses textes.
PARCOURS: tuple[str, ...] = ("lire", "hsk")
#: Le premier jour qui a un pas Utiliser : les jours 1 à 3 sont la première session.
PREMIER_JOUR = 4
#: Jusqu'où chaque parcours doit être couvert, jour par jour (bloquant).
COUVERTURE = 120
#: Trois lignes, ni plus ni moins (brief §6).
LIGNES = 3
#: Longueur du texte, en sinogrammes, ponctuation non comprise : au moins une par ligne,
#: et pas plus que ce qui se lit en cinquante secondes (brief §9, « le texte 50 s »).
LONGUEUR_MIN = 6
LONGUEUR_MAX = 48

#: Le fichier écrit par `wenlu export`, lu par l'app à chemin fixe.
FICHIER = "trois-lignes.json"

COLONNES_GLOSSAIRE = ("zh", "pinyin", "fr", "en")
CHAMPS_TEXTE = ("jour", "statut", "lignes", "glose")
CHAMPS_LIGNE = ("zh", "pinyin", "fr", "en")

SOURCE_EXPORT = (
    "trois lignes par jour du chemin, rédigées pour l'app, sans API, dans le pipeline wenlu"
    " (`data/sources/trois-lignes/`)"
)


class TextesInvalides(ValueError):
    """Un fichier de textes ou le glossaire ne se lit pas : rien n'est exporté."""


# --------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Texte:
    """Les trois lignes d'un jour du chemin, sur un parcours."""

    parcours: str
    jour: int
    lignes: tuple[Phrase, ...]
    statut: str = RELU
    glose: Mapping[str, Glose] = field(default_factory=dict)

    @property
    def zh(self) -> str:
        return "".join(l.zh for l in self.lignes)

    def sinogrammes(self) -> list[str]:
        return [c for c in self.zh if est_sinogramme(c)]


@dataclass(frozen=True)
class Fichier:
    """Un fichier de textes : un parcours, sa traçabilité, sa relecture, ses textes."""

    parcours: str
    generation: Mapping[str, object]
    relecture: Mapping[str, object]
    textes: tuple[Texte, ...]


def chemin_textes(parcours: str, dossier: Path | None = None) -> Path:
    return (dossier or DOSSIER) / f"{parcours}.json"


def charger_glossaire(chemin: Path | None = None) -> dict[str, Glose]:
    """Le glossaire partagé. Refuse une entrée vide, doublée ou hors sinogrammes."""
    lignes, fautes = lire_tsv(chemin or GLOSSAIRE)
    glossaire: dict[str, Glose] = {}
    for ligne in lignes:
        c = ligne.cellules
        if tuple(c) != COLONNES_GLOSSAIRE:
            fautes.append(f"ligne {ligne.numero} : colonnes attendues {COLONNES_GLOSSAIRE}")
            continue
        if not all(c.values()):
            fautes.append(f"ligne {ligne.numero} : colonne vide")
            continue
        if not all(est_sinogramme(x) for x in c["zh"]):
            fautes.append(f"ligne {ligne.numero} : {c['zh']} n'est pas fait de sinogrammes")
            continue
        if c["zh"] in glossaire:
            fautes.append(f"ligne {ligne.numero} : {c['zh']} déjà glosé")
            continue
        glossaire[c["zh"]] = Glose(fr=c["fr"], pinyin=c["pinyin"], en=c["en"])
    if fautes:
        raise TextesInvalides(" ; ".join(fautes))
    return glossaire


def _objet(valeur: object, cles: Sequence[str], nom: str, fautes: list[str]) -> dict[str, str] | None:
    if not isinstance(valeur, dict):
        fautes.append(f"{nom} : attendu un objet {{{', '.join(cles)}}}")
        return None
    manquantes = [k for k in cles if not isinstance(valeur.get(k), str) or not str(valeur[k]).strip()]
    inconnues = [k for k in valeur if k not in cles]
    if manquantes:
        fautes.append(f"{nom} : {', '.join(manquantes)} manquant ou vide")
    if inconnues:
        fautes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
    if manquantes or inconnues:
        return None
    return {k: str(valeur[k]).strip() for k in cles}


def fichier_depuis_json(document: object, parcours: str) -> Fichier:
    """Lit un fichier de textes déjà décodé. Relève tous les problèmes de format d'un coup."""
    if not isinstance(document, dict):
        raise TextesInvalides(f"{parcours} : attendu un objet JSON")
    fautes: list[str] = []
    if document.get("parcours") != parcours:
        fautes.append(f"{parcours} : parcours {document.get('parcours')!r} dans le fichier")
    generation = document.get("generation")
    relecture = document.get("relecture")
    if not isinstance(generation, dict):
        fautes.append(f"{parcours} : generation absente")
        generation = {}
    if not isinstance(relecture, dict):
        fautes.append(f"{parcours} : relecture absente")
        relecture = {}
    brut = document.get("textes")
    textes: list[Texte] = []
    if not isinstance(brut, list):
        fautes.append(f"{parcours} : textes, attendu une liste")
        brut = []
    for rang, t in enumerate(brut, start=1):
        nom = f"{parcours} texte {rang}"
        if not isinstance(t, dict):
            fautes.append(f"{nom} : attendu un objet")
            continue
        inconnues = [k for k in t if k not in CHAMPS_TEXTE]
        if inconnues:
            fautes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
        jour = t.get("jour")
        if isinstance(jour, bool) or not isinstance(jour, int) or jour < 1:
            fautes.append(f"{nom} : jour, attendu un nombre")
            continue
        nom = f"{parcours} jour {jour}"
        statut = t.get("statut")
        if statut not in STATUTS:
            fautes.append(f"{nom} : statut {statut!r}")
        lignes: list[Phrase] = []
        for k, l in enumerate(t.get("lignes") or [], start=1):
            lu = _objet(l, CHAMPS_LIGNE, f"{nom} ligne {k}", fautes)
            if lu is not None:
                lignes.append(Phrase(**lu))
        glose: dict[str, Glose] = {}
        for k, g in enumerate(t.get("glose") or [], start=1):
            lu = _objet(g, CHAMPS_LIGNE, f"{nom} glose {k}", fautes)
            if lu is None:
                continue
            if lu["zh"] in glose:
                fautes.append(f"{nom} glose {k} : {lu['zh']} déjà glosé")
                continue
            glose[lu["zh"]] = Glose(fr=lu["fr"], pinyin=lu["pinyin"], en=lu["en"])
        textes.append(Texte(parcours, jour, tuple(lignes), str(statut), glose))
    jours = [t.jour for t in textes]
    doubles = sorted({j for j in jours if jours.count(j) > 1})
    if doubles:
        fautes.append(f"{parcours} : jours en double {doubles}")
    if fautes:
        raise TextesInvalides(" ; ".join(fautes))
    return Fichier(parcours, generation, relecture, tuple(sorted(textes, key=lambda t: t.jour)))


def charger_textes(parcours: str, dossier: Path | None = None) -> Fichier:
    """`data/sources/trois-lignes/<parcours>.json`. Un fichier absent n'a aucun texte."""
    chemin = chemin_textes(parcours, dossier)
    if not chemin.exists():
        return Fichier(parcours, {}, {}, ())
    try:
        document = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise TextesInvalides(f"{chemin.name} : JSON illisible, {erreur}") from erreur
    return fichier_depuis_json(document, parcours)


# --------------------------------------------------------------------------- l'acquis


def nouveaux_du_jour(jour: int, parcours: Mapping[str, object]) -> list[str]:
    """Les caractères que le parcours pose ce jour-là : la brique, puis les composés."""
    return [c for j, c in poses_par_jour(parcours) if j == jour]


# --------------------------------------------------------------------------- la glose


def entrees(texte: Texte, glossaire: Mapping[str, Glose]) -> dict[str, Glose]:
    """Le glossaire, précisé par la glose propre au texte, qui passe devant."""
    return {**glossaire, **texte.glose}


def glose_du_texte(texte: Texte, glossaire: Mapping[str, Glose]) -> dict[str, Glose]:
    """Les seules entrées que le lecteur touchera dans ce texte, triées."""
    toutes = entrees(texte, glossaire)
    vues: set[str] = set()
    for ligne in texte.lignes:
        vues |= {e for _, e in segmenter(ligne.zh, toutes) if e}
    return {zh: toutes[zh] for zh in sorted(vues)}


# --------------------------------------------------------------------------- écarts


def ecarts_perimetre(texte: Texte, parcours: Mapping[str, object]) -> list[str]:
    """Aucun caractère hors de l'acquis du jour ; au moins un caractère nouveau du jour."""
    ecarts: list[str] = []
    intrus = caracteres_hors_liste(texte.zh, acquis_au_jour(texte.jour, parcours))
    if intrus:
        ecarts.append(f"hors de l'acquis du jour {texte.jour} : {' '.join(intrus)}")
    nouveaux = nouveaux_du_jour(texte.jour, parcours)
    if nouveaux and not any(c in texte.zh for c in nouveaux):
        ecarts.append(f"aucun caractère nouveau du jour ({''.join(nouveaux)})")
    if not nouveaux:
        ecarts.append(f"le parcours ne pose rien au jour {texte.jour}")
    return ecarts


def lectures_admises(ingest: Path | None = None) -> dict[str, tuple[str, ...]] | None:
    """Les lectures qu'un texte peut donner à un caractère : celles de `cuisine.lectures`
    (Make Me a Hanzi, `kMandarin`, surcharges) et celles des dictionnaires d'Unihan
    (`kTGHZ2013`, `kXHC1983`), qui disent toutes celles d'un polyphone : 便宜 pián yi,
    音乐 yīn yuè. `None` sans `wenlu ingest`.
    """
    from .cuisine import lectures as de_la_cuisine
    from .paths import INGEST

    table = de_la_cuisine(ingest)
    if table is None:
        return None
    chemin = (ingest or INGEST) / "unihan.json"
    if not chemin.exists():
        return table
    etendue = {c: set(v) for c, v in table.items()}
    for e in json.loads(chemin.read_text(encoding="utf-8"))["caracteres"]:
        dico = [str(x) for x in e.get("lectures_dico") or ()]
        if dico:
            etendue.setdefault(str(e["c"]), set()).update(dico)
    return {c: tuple(sorted(v)) for c, v in etendue.items()}


def ecarts_pinyin(texte: Texte, lectures: Mapping[str, Sequence[str]] | None = None) -> list[str]:
    """Une syllabe par sinogramme, tons du dictionnaire sans sandhi, chacune une lecture."""
    from .pinyin import aligner

    ecarts: list[str] = []
    for i, l in enumerate(texte.lignes, start=1):
        _syllabes(l.zh, l.pinyin, f"de la ligne {i}", ecarts)
        if lectures is not None and aligner(l.zh, l.pinyin, lectures) is None:
            ecarts.append(f"ligne {i} : « {l.zh} » ne se lit pas « {l.pinyin} »")
    return ecarts


def ecarts_glose(texte: Texte, glossaire: Mapping[str, Glose]) -> list[str]:
    """Chaque sinogramme couvert tel que le lecteur découpe, au pinyin de sa ligne."""
    ecarts: list[str] = []
    toutes = entrees(texte, glossaire)
    for i, l in enumerate(texte.lignes, start=1):
        syllabes = l.pinyin.split()
        rang = {k: n for n, k in enumerate(k for k, c in enumerate(l.zh) if est_sinogramme(c))}
        alignee = len(syllabes) == len(rang)
        for position, entree in segmenter(l.zh, toutes):
            if not entree:
                ecarts.append(f"ligne {i} : glose absente pour {l.zh[position]}")
                continue
            attendu = toutes[entree].pinyin.split()
            if len(attendu) != len(entree):
                ecarts.append(f"glose {entree} : pinyin sans une syllabe par caractère")
                continue
            if not alignee:
                continue
            lu = syllabes[rang[position] : rang[position] + len(entree)]
            if attendu != lu:
                ecarts.append(f"ligne {i} : {entree} glosé « {' '.join(attendu)} », lu « {' '.join(lu)} »")
    inutiles = [zh for zh in texte.glose if zh not in glose_du_texte(texte, glossaire)]
    if inutiles:
        ecarts.append(f"glose propre au texte jamais touchée : {' '.join(inutiles)}")
    return ecarts


def ecarts_forme(texte: Texte) -> list[str]:
    """Trois lignes, chacune traduite ; une longueur qui se lit en cinquante secondes."""
    ecarts: list[str] = []
    if len(texte.lignes) != LIGNES:
        ecarts.append(f"{len(texte.lignes)} lignes pour {LIGNES}")
    vides = [str(i) for i, l in enumerate(texte.lignes, start=1) if not any(est_sinogramme(c) for c in l.zh)]
    if vides:
        ecarts.append(f"lignes sans caractère : {', '.join(vides)}")
    n = len(texte.sinogrammes())
    if not LONGUEUR_MIN <= n <= LONGUEUR_MAX:
        ecarts.append(f"longueur {n} hors de {LONGUEUR_MIN}–{LONGUEUR_MAX} sinogrammes")
    return ecarts


def ecarts(
    texte: Texte,
    parcours: Mapping[str, object],
    glossaire: Mapping[str, Glose],
    lectures: Mapping[str, Sequence[str]] | None = None,
) -> list[str]:
    """Tous les écarts d'un texte, dans l'ordre des contrôles."""
    return (
        ecarts_perimetre(texte, parcours)
        + ecarts_pinyin(texte, lectures)
        + ecarts_glose(texte, glossaire)
        + ecarts_forme(texte)
    )


def ecarts_glossaire(glossaire: Mapping[str, Glose], lectures: Mapping[str, Sequence[str]] | None) -> list[str]:
    """Chaque entrée du glossaire : une syllabe par caractère, chacune une lecture."""
    from .pinyin import aligner

    out: list[str] = []
    for zh, g in glossaire.items():
        if len(g.pinyin.split()) != len(zh):
            out.append(f"glossaire {zh} : pinyin « {g.pinyin} » sans une syllabe par caractère")
        elif lectures is not None and aligner(zh, g.pinyin, lectures) is None:
            out.append(f"glossaire {zh} : ne se lit pas « {g.pinyin} »")
    return out


def couverture(textes: Iterable[Texte], jusqua: int = COUVERTURE) -> list[int]:
    """Les jours de `PREMIER_JOUR` à `jusqua` qui n'ont pas de texte."""
    ecrits = {t.jour for t in textes}
    return [j for j in range(PREMIER_JOUR, jusqua + 1) if j not in ecrits]


# --------------------------------------------------------------------------- export


def texte_exporte(texte: Texte, parcours: Mapping[str, object], glossaire: Mapping[str, Glose]) -> dict[str, object]:
    """Un texte tel que l'app le lit : le jour, ses caractères nouveaux, les lignes, la glose."""
    return {
        "jour": texte.jour,
        "nouveaux": [c for c in nouveaux_du_jour(texte.jour, parcours) if c in texte.zh],
        "lignes": [{"zh": l.zh, "pinyin": l.pinyin, "fr": l.fr, "en": l.en} for l in texte.lignes],
        "glose": {zh: g.en_json() for zh, g in glose_du_texte(texte, glossaire).items()},
    }


def document(
    *,
    en_tete: Mapping[str, object],
    parcours: Mapping[str, Mapping[str, object]],
    dossier: Path | None = None,
    glossaire: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `trois-lignes.json` : les textes relus, par parcours et par jour."""
    lexique = charger_glossaire(glossaire)
    par_parcours: dict[str, list[dict[str, object]]] = {}
    for nom in PARCOURS:
        documents = parcours.get(nom) or {}
        par_parcours[nom] = [
            texte_exporte(t, documents, lexique) for t in charger_textes(nom, dossier).textes if t.statut == RELU
        ]
    return {**en_tete, "premier_jour": PREMIER_JOUR, "parcours": par_parcours}


def sources() -> list[tuple[str, Path]]:
    """Les fichiers lus par l'export, pour son empreinte."""
    return [("trois-lignes-glossaire", GLOSSAIRE)] + [
        (f"trois-lignes-{nom}", chemin_textes(nom)) for nom in PARCOURS
    ]


# --------------------------------------------------------------------------- contrôles


def controles(
    *,
    dossier: Path | None = None,
    glossaire: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    destination: Path | None = None,
    jusqua: int = COUVERTURE,
) -> list[Controle]:
    """Contrôles des trois lignes, pour `wenlu check`. Bloquants, sauf la relecture et la suite."""
    from . import export as export_mod
    charger_lectures = lectures_admises

    build = build or BUILD

    def detail(fautes: Sequence[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    f_src: list[str] = []
    try:
        lexique = charger_glossaire(glossaire)
    except (TextesInvalides, OSError) as erreur:
        lexique = {}
        f_src.append(str(erreur))
    fichiers: dict[str, Fichier] = {}
    for nom in PARCOURS:
        try:
            fichiers[nom] = charger_textes(nom, dossier)
        except TextesInvalides as erreur:
            f_src.append(str(erreur))
            fichiers[nom] = Fichier(nom, {}, {}, ())
    for nom, f in fichiers.items():
        if f.textes and (f.generation.get("api") != API_SESSION or f.generation.get("modele") != MODELE_MANUEL):
            f_src.append(f"{nom} : generation, attendu « {MODELE_MANUEL} », « {API_SESSION} »")
        if any(t.statut == RELU for t in f.textes) and not f.relecture.get("decision"):
            f_src.append(f"{nom} : des textes relus sans la décision qui les relit")

    lectures = charger_lectures(ingest)
    f_glossaire = ecarts_glossaire(lexique, lectures)
    f_per: list[str] = []
    f_pin: list[str] = []
    f_glo: list[str] = []
    f_for: list[str] = []
    f_cou: list[str] = []
    suite: list[str] = []
    construits = True
    for nom, f in fichiers.items():
        chemin = build / f"parcours-{nom}.json"
        if not chemin.exists():
            construits = False
            continue
        parcours = charger_parcours(nom, build)
        for t in f.textes:
            f_per += [f"{nom} jour {t.jour} : {e}" for e in ecarts_perimetre(t, parcours)]
            f_pin += [f"{nom} jour {t.jour} : {e}" for e in ecarts_pinyin(t, lectures)]
            f_glo += [f"{nom} jour {t.jour} : {e}" for e in ecarts_glose(t, lexique)]
            f_for += [f"{nom} jour {t.jour} : {e}" for e in ecarts_forme(t)]
        manquants = couverture(f.textes, jusqua)
        if manquants:
            f_cou.append(f"{nom} : jours sans texte {manquants}")
        dernier = max((int(j["jour"]) for j in parcours.get("jours") or ()), default=0)  # type: ignore[union-attr]
        au_dela = [j for j in range(jusqua + 1, dernier + 1) if j not in {t.jour for t in f.textes}]
        suite.append(f"{nom} : {dernier - len(au_dela) - PREMIER_JOUR + 1} jours écrits sur {dernier - PREMIER_JOUR + 1}")
    f_glo = f_glossaire + f_glo

    relus = {nom: sorted(t.jour for t in f.textes if t.statut == RELU) for nom, f in fichiers.items()}
    a_relire = sum(1 for f in fichiers.values() for t in f.textes if t.statut == A_RELIRE)
    f_exp: list[str] = []
    dossiers = export_mod.versions_exportees(destination or export_mod.EXPORT)
    for d in dossiers:
        chemin = d / FICHIER
        if not chemin.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        exporte = json.loads(chemin.read_text(encoding="utf-8")).get("parcours") or {}
        for nom in PARCOURS:
            vus = sorted(int(x.get("jour", 0)) for x in exporte.get(nom) or ())
            if vus != relus[nom]:
                f_exp.append(f"{d.name}/{FICHIER} : {nom}, jours exportés et relus différents")

    return [
        Controle("trois lignes : sources", not f_src, detail(f_src, "glossaire et textes lisibles, traçables"), bloquant=True),
        Controle(
            "trois lignes : périmètre",
            not f_per,
            detail(f_per, "chaque texte n'emploie que l'acquis de son jour, et un caractère nouveau du jour")
            if construits
            else "aucun parcours construit : lancer `wenlu build`",
            bloquant=True,
        ),
        Controle(
            "trois lignes : pinyin",
            not f_pin,
            detail(
                f_pin,
                "une syllabe par sinogramme, tons du dictionnaire, chacune une lecture du caractère"
                if lectures is not None
                else "une syllabe par sinogramme, tons du dictionnaire (lectures absentes : `wenlu ingest`)",
            ),
            bloquant=True,
        ),
        Controle(
            "trois lignes : glose",
            not f_glo,
            detail(f_glo, "chaque sinogramme glosé, au pinyin des lignes, en français et en anglais"),
            bloquant=True,
        ),
        Controle(
            "trois lignes : forme",
            not f_for,
            detail(f_for, f"trois lignes traduites, {LONGUEUR_MIN} à {LONGUEUR_MAX} sinogrammes"),
            bloquant=True,
        ),
        Controle(
            "trois lignes : couverture",
            not f_cou,
            detail(f_cou, f"chaque jour de {PREMIER_JOUR} à {jusqua}, sur les deux parcours"),
            bloquant=True,
        ),
        Controle(
            "trois lignes : export",
            not f_exp,
            detail(f_exp, f"{sum(len(v) for v in relus.values())} textes relus exportés")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle("trois lignes : relecture", not a_relire, f"{a_relire} textes restent à relire avant export"),
        Controle("trois lignes : suite du chemin", True, " ; ".join(suite) or "aucun parcours construit"),
    ]


# --------------------------------------------------------------------------- brouillons

#: Les brouillons, un fichier par parcours et par jour : `<parcours>/<jour>.json`. Plusieurs
#: rédacteurs écrivent en parallèle sans toucher au même fichier ; `importer` les verse dans
#: `<parcours>.json` et le glossaire, un seul à la fois.
BROUILLONS = DATA / "sources" / "trois-lignes-brouillons"
CHAMPS_BROUILLON = ("parcours", "jour", "lignes", "glose", "glossaire")


def chemin_brouillon(parcours: str, jour: int, dossier: Path | None = None) -> Path:
    """`data/sources/trois-lignes-brouillons/<parcours>/<jour>.json`, le jour sur quatre chiffres."""
    return (dossier or BROUILLONS) / parcours / f"{jour:04d}.json"


@dataclass(frozen=True)
class Brouillon:
    """Un texte à verser : ses trois lignes, sa glose propre, et ce qu'il ajoute au glossaire."""

    texte: Texte
    glossaire: Mapping[str, Glose]


def lire_brouillon(chemin: Path) -> Brouillon:
    """Un brouillon, `{parcours, jour, lignes, glose?, glossaire?}` ; refuse ce qui ne se lit pas.

    `glose` : les entrées propres au texte (une autre lecture d'un polyphone, un mot du texte
    seul), qui passent devant le glossaire. `glossaire` : les entrées nouvelles que le texte
    apporte au glossaire partagé (un caractère nouveau du jour, un mot qu'il forme).
    """
    try:
        brut = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise TextesInvalides(f"{chemin.name} : JSON illisible, {erreur}") from erreur
    if not isinstance(brut, dict):
        raise TextesInvalides(f"{chemin.name} : attendu un objet")
    inconnues = [k for k in brut if k not in CHAMPS_BROUILLON]
    if inconnues:
        raise TextesInvalides(f"{chemin.name} : clé inconnue {', '.join(inconnues)}")
    parcours = str(brut.get("parcours", ""))
    if parcours not in PARCOURS:
        raise TextesInvalides(f"{chemin.name} : parcours {parcours!r}")
    document = {
        "parcours": parcours,
        "generation": {},
        "relecture": {},
        "textes": [
            {
                "jour": brut.get("jour"),
                "statut": A_RELIRE,
                "lignes": brut.get("lignes") or [],
                "glose": brut.get("glose") or [],
            }
        ],
    }
    texte = fichier_depuis_json(document, parcours).textes[0]
    fautes: list[str] = []
    ajouts: dict[str, Glose] = {}
    for k, g in enumerate(brut.get("glossaire") or [], start=1):
        lu = _objet(g, CHAMPS_LIGNE, f"{chemin.name} glossaire {k}", fautes)
        if lu is None:
            continue
        if not all(est_sinogramme(c) for c in lu["zh"]):
            fautes.append(f"{chemin.name} glossaire {k} : {lu['zh']} n'est pas fait de sinogrammes")
            continue
        ajouts[lu["zh"]] = Glose(fr=lu["fr"], pinyin=lu["pinyin"], en=lu["en"])
    if fautes:
        raise TextesInvalides(" ; ".join(fautes))
    return Brouillon(texte=texte, glossaire=ajouts)


@dataclass
class Import:
    """Ce qu'un import a versé : les jours importés, les refus et leurs raisons, le glossaire ajouté."""

    importes: list[int] = field(default_factory=list)
    refuses: dict[int, list[str]] = field(default_factory=dict)
    glossaire: list[str] = field(default_factory=list)


def texte_en_json(t: Texte) -> dict[str, object]:
    """Un texte tel que `<parcours>.json` le garde."""
    out: dict[str, object] = {
        "jour": t.jour,
        "statut": t.statut,
        "lignes": [{"zh": l.zh, "pinyin": l.pinyin, "fr": l.fr, "en": l.en} for l in t.lignes],
    }
    if t.glose:
        out["glose"] = [{"zh": zh, **g.en_json()} for zh, g in t.glose.items()]
    return out


def importer(
    parcours: str,
    *,
    dossier: Path | None = None,
    brouillons: Path | None = None,
    glossaire: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    jours: Sequence[int] = (),
    essai: bool = False,
) -> Import:
    """Verse les brouillons d'un parcours dans `<parcours>.json`, au statut `a_relire`.

    Chaque brouillon passe les contrôles de `wenlu check` (périmètre, pinyin, glose, forme)
    avec le glossaire, ses propres ajouts compris ; un refus nomme ses écarts et ne verse
    rien. Une entrée que le brouillon ajoute au glossaire et que le glossaire porte déjà,
    à l'identique, est simplement retrouvée ; autrement, c'est un conflit : l'entrée passe
    dans la `glose` propre du texte, à la main. Un texte relu n'est jamais remplacé ; un texte
    à relire l'est par un brouillon du même jour. Les statuts restent ceux du fichier : la
    relecture est une décision à part. `essai` contrôle sans rien écrire : un rédacteur
    vérifie ses brouillons avant de les rendre.
    """
    charger_lectures = lectures_admises

    doc = charger_parcours(parcours, build)
    chemin_glossaire = glossaire or GLOSSAIRE
    lexique = charger_glossaire(chemin_glossaire)
    lectures = charger_lectures(ingest)
    fichier = charger_textes(parcours, dossier)
    textes = {t.jour: t for t in fichier.textes}
    resultat = Import()
    ajoutes: dict[str, Glose] = {}
    for chemin in sorted(((brouillons or BROUILLONS) / parcours).glob("*.json")):
        try:
            b = lire_brouillon(chemin)
        except TextesInvalides as erreur:
            resultat.refuses[int(chemin.stem) if chemin.stem.isdigit() else 0] = [str(erreur)]
            continue
        t = b.texte
        if jours and t.jour not in jours:
            continue
        if t.parcours != parcours or chemin.stem != f"{t.jour:04d}":
            resultat.refuses[t.jour] = [f"{chemin.name} : le fichier doit s'appeler {t.jour:04d}.json dans {parcours}/"]
            continue
        deja = textes.get(t.jour)
        if deja is not None and deja.statut == RELU:
            resultat.refuses[t.jour] = [f"jour {t.jour} : un texte relu ne se remplace pas"]
            continue
        connu = {**lexique, **ajoutes}
        conflits = [zh for zh, g in b.glossaire.items() if zh in connu and connu[zh] != g]
        if conflits:
            resultat.refuses[t.jour] = [
                f"glossaire : {' '.join(conflits)} déjà glosé autrement, à mettre dans la glose propre du texte"
            ]
            continue
        nouveaux = {zh: g for zh, g in b.glossaire.items() if zh not in connu}
        fautes = ecarts(t, doc, {**connu, **nouveaux}, lectures) + ecarts_glossaire(nouveaux, lectures)
        if fautes:
            resultat.refuses[t.jour] = fautes
            continue
        ajoutes.update(nouveaux)
        textes[t.jour] = t
        resultat.importes.append(t.jour)
    if resultat.importes and not essai:
        generation = dict(fichier.generation) or {"modele": MODELE_MANUEL, "api": API_SESSION}
        generation.setdefault("modele", MODELE_MANUEL)
        generation.setdefault("api", API_SESSION)
        document = {
            "parcours": parcours,
            "generation": generation,
            "relecture": dict(fichier.relecture),
            "textes": [texte_en_json(textes[j]) for j in sorted(textes)],
        }
        chemin_textes(parcours, dossier).write_text(
            json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
    if ajoutes and not essai:
        lignes = "".join(f"{zh}\t{g.pinyin}\t{g.fr}\t{g.en}\n" for zh, g in ajoutes.items())
        texte_glossaire = chemin_glossaire.read_text(encoding="utf-8")
        if not texte_glossaire.endswith("\n"):
            texte_glossaire += "\n"
        chemin_glossaire.write_text(texte_glossaire + lignes, encoding="utf-8")
    resultat.glossaire = list(ajoutes)
    return resultat


def a_rediger(
    parcours: str,
    *,
    de: int,
    a: int,
    lot: int = 1,
    sur: int = 1,
    dossier: Path | None = None,
    brouillons: Path | None = None,
    build: Path | None = None,
) -> list[int]:
    """Les jours du lot `lot` sur `sur`, de `de` à `a`, qui n'ont ni texte ni brouillon.

    Les jours sans texte à écrire (première session, fermeture, rien de posé) n'en sont pas.
    Les lots sont des tranches contiguës et stables : `sur` rédacteurs se partagent la plage
    sans jamais écrire le même jour, et leurs brouillons ne se touchent pas.
    """
    doc = charger_parcours(parcours, build)
    ecrits = {t.jour for t in charger_textes(parcours, dossier).textes}
    ecrits |= {
        int(p.stem) for p in ((brouillons or BROUILLONS) / parcours).glob("*.json") if p.stem.isdigit()
    }
    avec = {j for j, _ in poses_par_jour(doc)}
    plage = [j for j in range(max(de, PREMIER_JOUR), a + 1) if j in avec]
    taille = -(-len(plage) // max(1, sur))
    tranche = plage[(lot - 1) * taille : lot * taille]
    return [j for j in tranche if j not in ecrits]


# --------------------------------------------------------------------------- cli

app = typer.Typer(help="Les trois lignes du pas Utiliser : contexte de rédaction, brouillons, aperçu.")


@app.command("a-rediger")
def commande_a_rediger(
    parcours: str = typer.Argument(..., help="lire ou hsk"),
    de: int = typer.Option(..., help="Premier jour du chemin de la plage."),
    a: int = typer.Option(..., help="Dernier jour du chemin de la plage."),
    lot: int = typer.Option(1, help="Numéro du lot, de 1 à --sur."),
    sur: int = typer.Option(1, help="Nombre de rédacteurs qui se partagent la plage."),
) -> None:
    """Les jours d'un lot qui n'ont ni texte ni brouillon : un rédacteur par lot, sans conflit."""
    jours = a_rediger(parcours, de=de, a=a, lot=lot, sur=sur)
    typer.echo(" ".join(str(j) for j in jours) or "aucun")


@app.command("importer")
def commande_importer(
    parcours: str = typer.Argument(..., help="lire ou hsk"),
    jour: list[int] = typer.Option([], help="Jours à verser ; tous les brouillons par défaut."),
    essai: bool = typer.Option(False, help="Contrôler les brouillons sans rien écrire."),
) -> None:
    """Verse les brouillons (`trois-lignes-brouillons/<parcours>/<jour>.json`), au statut à relire."""
    resultat = importer(parcours, jours=jour, essai=essai)
    verbe = "prêts" if essai else "importés"
    typer.echo(f"{verbe} : {len(resultat.importes)} ({' '.join(map(str, resultat.importes)) or '—'})")
    if resultat.glossaire:
        typer.echo(f"glossaire : {len(resultat.glossaire)} entrées ajoutées ({' '.join(resultat.glossaire)})")
    for j, fautes in sorted(resultat.refuses.items()):
        typer.echo(f"refusé, jour {j} : {' ; '.join(fautes)}")
    if resultat.refuses:
        raise typer.Exit(code=1)


@app.command("contexte")
def commande_contexte(
    parcours: str = typer.Argument(..., help="lire ou hsk"),
    jours: list[int] = typer.Argument(..., help="Jours du chemin."),
) -> None:
    """L'acquis du jour, ses caractères nouveaux, et le texte déjà écrit s'il y en a un."""
    try:
        doc = charger_parcours(parcours)
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu build` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    ecrits = {t.jour: t for t in charger_textes(parcours).textes}
    lexique = charger_glossaire()
    from .paths import INGEST

    fichier_listes = INGEST / "listes.json"
    des_listes = (
        {c for cs in json.loads(fichier_listes.read_text(encoding="utf-8")).values() for c in cs}
        if fichier_listes.exists()
        else None
    )
    for jour in jours:
        typer.echo(f"== {parcours}, jour {jour} ==")
        typer.echo(f"Nouveaux : {''.join(nouveaux_du_jour(jour, doc)) or '—'}")
        acquis = acquis_au_jour(jour, doc)
        typer.echo(f"Acquis : {''.join(acquis)}")
        # Les caractères des listes, pas les composants (氵, 讠), qu'aucun texte n'écrit seuls.
        sans = [c for c in acquis if c not in lexique and (des_listes is None or c in des_listes)]
        typer.echo(f"Caractères sans glose au glossaire : {''.join(sans) or '—'}")
        if jour in ecrits:
            for l in ecrits[jour].lignes:
                typer.echo(f"  {l.zh}\t{l.pinyin}\t{l.fr}")


@app.command("apercu")
def commande_apercu(parcours: str = typer.Argument("lire", help="lire ou hsk")) -> None:
    """Chaque texte écrit, ligne par ligne, avec sa traduction, pour relire."""
    for t in charger_textes(parcours).textes:
        typer.echo(f"── jour {t.jour} ({t.statut})")
        for l in t.lignes:
            typer.echo(f"{l.zh}\t{l.pinyin}\t{l.fr}")
