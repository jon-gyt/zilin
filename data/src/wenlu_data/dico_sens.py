"""Les sens français et les phrases d'exemple du dictionnaire (stories 10.6 et 10.7).

Décisions du propriétaire du 29 septembre 2026 : les sens sont rédigés par le pipeline et
**tous relus avant de s'afficher** ; les phrases d'exemple sont écrites par le pipeline
avec les seuls caractères du HSK, tracées et relues (pas de Tatoeba) ; rien ne vient de
CC-CEDICT ; `kDefinition` d'Unihan n'est pas lu tant que le propriétaire n'a pas tranché.

Le circuit est celui des fiches et des lettres, sans API :

- le plan : `wenlu dico plan` range, niveau par niveau, les entrées à rédiger en lots de
  `TAILLE_LOT` : chaque caractère de la liste du niveau (`hsk-<n>.txt`), placé devant le
  premier mot du niveau qui le contient, puis chaque mot de plusieurs caractères. **Un mot
  d'un seul caractère** (好 adjectif, 号 nom, 们 suffixe) n'a pas d'entrée à lui : ses sens
  et ses phrases se rangent sous le caractère, qui porte alors ses catégories (question
  10.8 du backlog, tranchée ici) ;
- le contexte : `wenlu dico contexte <niveau> <lot>` donne au rédacteur (un agent Claude
  Code dans sa session, sans clé ni réseau) les faits de chaque entrée : sinogrammes,
  pinyin retenu et officiel, catégories de la liste, niveau, lectures du caractère, mots
  d'un seul caractère qu'il porte, sens déjà écrits des caractères du mot, mots voisins
  de la liste, glose relue d'une fiche quand il y en a une ; et les caractères permis dans
  les phrases (ceux du HSK, du niveau de l'entrée d'abord). Jamais la colonne `CEDICT`
  d'ivankra, jamais `mots.json`, jamais `unihan-definitions.json` ;
- le brouillon : le rédacteur écrit `data/sources/dico-brouillons/<niveau>/<lot>.json`
  (`squelette`) ; `wenlu dico importer` le passe par `valider()` et écrit, s'il est
  entièrement valide, `data/sources/dico/<niveau>/<lot>.json`, avec le bloc `generation`
  des fiches (`api` « session Claude Code (sans API) », `modele` « rédaction manuelle »,
  empreinte du brouillon) et le statut `a_relire` de chaque sens et de chaque phrase. Un
  brouillon inchangé ne réécrit rien : un texte relu le reste ; un texte modifié repart à
  relire ;
- la réutilisation : une glose déjà relue d'une fiche (`data/sources/fiches/`, le sens du
  caractère ou celui d'un mot de fiche au même pinyin) se reprend telle quelle quand elle
  convient (`"reprise": true` dans le brouillon) : elle garde son statut `relu` et dit sa
  provenance ; elle n'a pas d'acception, puisqu'aucune n'a été relue ;
- la relecture : `wenlu dico apercu` écrit une page HTML autonome où le propriétaire
  marque chaque entrée « bon », la corrige ou la renvoie, et copie ses retours en JSON ;
  `wenlu dico appliquer-relecture <fichier>` les réintègre : statut `relu`, corrections
  appliquées et tracées (`relecture` : date, décision, texte d'avant, note) ;
- l'export : `wenlu export` ne passe au dictionnaire que les sens et les phrases `relu`
  (`dictionnaire.sens_exporte`, `exemples_exportes`).

Validation, bloquante à l'import et dans `wenlu check` : glose de `GLOSE_MAX` caractères
au plus, sans sinogramme ni point final ; une à trois acceptions, chacune avec une
catégorie de la liste (toutes les catégories pour un caractère, ou pour un mot que la
liste ne classe pas) ; une ou deux phrases par mot (zéro à deux pour un caractère qui
n'est pas un mot à lui seul), courtes, qui contiennent l'entrée, écrites avec les seuls
caractères du HSK et la ponctuation chinoise de la police ; leur pinyin, écrit par mot,
se lit caractère par caractère dans les lectures du dépôt (Unihan et surcharges), et le
mot lui-même y garde le pinyin de la liste, ton neutre compris ; la traduction ne sert
pas de glose au mot (règle des fuites).
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Mapping, Sequence

import typer

from . import mots_hsk
from .claude import maintenant as _maintenant
from .fonts import PONCTUATION_CHINOISE
from .gf0014 import Controle
from .ingest import est_sinogramme
from .mots_hsk import Mot, numeroter
from .paths import DATA, EXPORT, FICHES_WORK, INGEST, LISTES, RACINE, WORK
from .pinyin import MOTS_DE_POSITION, aligner, ecarts_de_position, normaliser

DOSSIER = DATA / "sources" / "dico"
#: Le dossier versionné, que les tests hermétiques gardent quand ils redirigent `DOSSIER`.
DOSSIER_REEL = DOSSIER
BROUILLONS = DATA / "sources" / "dico-brouillons"
BROUILLONS_REELS = BROUILLONS

#: Entrées par lot : de quoi relire un lot en un quart d'heure.
TAILLE_LOT = 50

#: La glose de la liste des résultats (`dictionnaire.GLOSE_MAX`).
GLOSE_MAX = 40
ACCEPTIONS_MIN = 1
ACCEPTIONS_MAX = 3
#: Une acception tient sur une ligne de la fiche.
ACCEPTION_MAX = 80
EXEMPLES_MAX = 2
#: Une phrase courte : au plus vingt sinogrammes.
PHRASE_MAX = 20
TRADUCTION_MAX = 140

#: Les catégories de la liste (`hsk-mots.tsv`, colonne `categorie`).
CATEGORIES: dict[str, str] = {
    "N": "nom",
    "V": "verbe",
    "Adj": "adjectif",
    "Adv": "adverbe",
    "M": "classificateur",
    "Num": "numéral",
    "Pron": "pronom",
    "Prep": "préposition",
    "Conj": "conjonction",
    "Aux": "particule",
    "Intj": "interjection",
    "Prefix": "préfixe",
    "Suffix": "suffixe",
    "Phonetic": "onomatopée",
}

A_RELIRE = "a_relire"
RELU = "relu"
REJETE = "rejete"
STATUTS = (A_RELIRE, RELU, REJETE)

API_SESSION = "session Claude Code (sans API)"
MODELE_MANUEL = "rédaction manuelle"

#: Les trois décisions de la page de relecture.
BON = "bon"
CORRIGE = "corrige"
A_REFAIRE = "a_refaire"
DECISIONS = (BON, CORRIGE, A_REFAIRE)
FORMAT_RELECTURE = "wenlu-dico-relecture"

#: Ponctuation d'une phrase : celle que le woff2 chinois embarque.
PONCTUATION = set(PONCTUATION_CHINOISE)
FINS_ZH = {"。": ".", "？": "?", "！": "!"}

#: Un sinogramme, clés et composants compris (même motif que `fuites.HAN`).
HAN = re.compile(r"[⺀-⿟㐀-䶿一-鿿豈-﫿\U00020000-\U0003134f]")

#: Les fichiers que le référentiel ne lit jamais : CC-CEDICT, brut (`fetch`) ou ingéré
#: (`mots.json`), et les définitions anglaises d'Unihan (`kDefinition`). Garde-fou structurel,
#: testé et contrôlé par `wenlu check` sur la liste des fichiers lus (`Referentiel.lus`).
FICHIERS_INTERDITS = ("cedict_1_0_ts_utf-8_mdbg.txt.gz", "mots.json", "unihan-definitions.json")

NIVEAUX = mots_hsk.NIVEAUX

#: Ce que dit chaque lot de sa source : des faits, et une rédaction pour l'app.
SOURCE_LOT = (
    "rédigé pour l'app dans le pipeline wenlu, sans API ; faits lus : liste HSK 3.0 (forme,"
    " pinyin, niveau, catégorie), lectures d'Unihan et des surcharges, gloses relues des fiches"
)


class DicoSensInvalide(ValueError):
    """Un brouillon, un lot ou une relecture ne s'applique pas : rien n'est écrit."""

    def __init__(self, problemes: Sequence[str]) -> None:
        self.problemes = list(problemes)
        super().__init__(" ; ".join(self.problemes[:20]) + (" ; …" if len(self.problemes) > 20 else ""))


def _aujourdhui() -> str:
    return _maintenant()[:10]


def _relatif(chemin: Path) -> str:
    try:
        return str(chemin.relative_to(RACINE))
    except ValueError:
        return str(chemin)


# --------------------------------------------------------------------- le référentiel


@dataclass(frozen=True)
class Place:
    """Une entrée à rédiger : un caractère de la liste, ou un mot de plusieurs caractères."""

    id: str
    genre: str  # "caractere" ou "mot"
    hanzi: str
    pinyin: str
    niveau: str
    #: Les catégories permises aux acceptions ; vide : toutes.
    categories: tuple[str, ...]
    #: Les graphies qu'une phrase peut employer, avec leur pinyin retenu (celui de la liste).
    formes: tuple[tuple[str, str], ...]
    #: Un caractère : ses lectures, la principale d'abord.
    lectures: tuple[str, ...] = ()
    #: Un caractère : les mots d'un seul caractère de la liste qu'il porte (`id`).
    simples: tuple[str, ...] = ()

    @property
    def est_mot(self) -> bool:
        """Vrai pour un mot, et pour un caractère qui est aussi un mot de la liste."""
        return self.genre == "mot" or bool(self.simples)

    @property
    def exemples_min(self) -> int:
        return 1 if self.est_mot else 0


@dataclass
class Referentiel:
    """Ce que le plan, le contexte et la validation lisent : la liste, les lectures, les fiches relues."""

    mots: list[Mot]
    caracteres: dict[str, str]  # caractère → niveau (« 1 » … « 7-9 »)
    pinyin: dict[str, str]
    lectures: dict[str, list[str]]
    #: Gloses relues des fiches : par caractère, et par (mot, pinyin).
    fiches_caracteres: dict[str, tuple[str, str]] = field(default_factory=dict)
    fiches_mots: dict[tuple[str, str], tuple[str, str]] = field(default_factory=dict)
    #: Les fichiers lus pour le construire : le garde-fou CC-CEDICT les contrôle.
    lus: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.par_id = {m.id: m for m in self.mots}
        self.simples: dict[str, list[Mot]] = {}
        self.contenant: dict[str, list[Mot]] = {}
        for m in self.mots:
            if len(m.forme.hanzi) == 1:
                self.simples.setdefault(m.forme.hanzi, []).append(m)
            for c in dict.fromkeys(ch for f in m.formes for ch in f.hanzi):
                self.contenant.setdefault(c, []).append(m)
        self.formes_multiples: dict[str, list[mots_hsk.Forme]] = {}
        for m in self.mots:
            for f in (*m.formes, *([m.exemple] if m.exemple else [])):
                if len(f.hanzi) >= 2:
                    self.formes_multiples.setdefault(f.hanzi, []).append(f)

    def niveau_max(self, texte: str) -> str | None:
        """Le niveau le plus haut des sinogrammes de `texte` ; `None` si l'un est hors du HSK."""
        rangs = []
        for c in texte:
            if est_sinogramme(c):
                if c not in self.caracteres:
                    return None
                rangs.append(NIVEAUX.index(self.caracteres[c]))
        return NIVEAUX[max(rangs)] if rangs else NIVEAUX[0]


def charger_fiches_relues(dossier: Path | None = None) -> tuple[dict[str, tuple[str, str]], dict[tuple[str, str], tuple[str, str]]]:
    """Les gloses relues des fiches : `{c: (glose, fichier)}` et `{(mot, pinyin): (glose, fichier)}`.

    Seuls le sens du caractère (`sens_fr`) et le sens de ses mots (`mots[].fr`) d'une fiche
    au statut `relu`. Rien d'autre n'est lu.
    """
    dossier = dossier or FICHES_WORK
    caracteres: dict[str, tuple[str, str]] = {}
    mots: dict[tuple[str, str], tuple[str, str]] = {}
    for chemin in sorted(dossier.glob("*.json")):
        d = json.loads(chemin.read_text(encoding="utf-8"))
        if d.get("statut") != RELU:
            continue
        nom = _relatif(chemin)
        if d.get("sens_fr"):
            caracteres[str(d["c"])] = (str(d["sens_fr"]).strip(), nom)
        for m in d.get("mots") or ():
            if m.get("fr"):
                cle = (str(m["hanzi"]), unicodedata.normalize("NFC", str(m.get("pinyin") or "")).lower().replace(" ", ""))
                mots.setdefault(cle, (str(m["fr"]).strip(), nom))
    return caracteres, mots


def charger_referentiel(
    *,
    ingest: Path | None = None,
    listes: Path | None = None,
    liste_mots: Path | None = None,
    fiches: Path | None = None,
) -> Referentiel:
    from .export import charger_lectures, charger_pinyin
    from .ingest import charger_listes

    ingest = ingest or INGEST
    niveaux: dict[str, str] = {}
    for nom, cs in charger_listes(listes or LISTES).items():
        if nom.startswith("hsk-"):
            for c in cs:
                niveaux.setdefault(c, nom[4:])
    pinyin = charger_pinyin(ingest, niveaux)
    lectures = charger_lectures(ingest, niveaux) or {}
    tout = mots_hsk.lectures_du_pipeline(ingest)
    for c in niveaux:
        vues = list(lectures.get(c) or [])
        for x in [pinyin.get(c, ""), *tout.get(c, [])]:
            if x and x not in vues:
                vues.append(x)
        lectures[c] = vues
    fc, fm = charger_fiches_relues(fiches)
    from . import surcharges as surcharges_mod

    return Referentiel(
        mots=mots_hsk.charger(liste_mots),
        caracteres=niveaux,
        pinyin=pinyin,
        lectures=lectures,
        fiches_caracteres=fc,
        fiches_mots=fm,
        lus=[
            str(liste_mots or mots_hsk.LISTE),
            str(listes or LISTES),
            str(ingest / "unihan.json"),
            str(surcharges_mod.PINYIN),
            str(fiches or FICHES_WORK),
        ],
    )


def _place_caractere(c: str, ref: Referentiel) -> Place:
    simples = ref.simples.get(c, [])
    categories: tuple[str, ...] = ()  # un caractère peut avoir d'autres emplois que ses mots
    formes = [(c, ref.pinyin.get(c, ""))]
    for m in simples:
        if m.exemple and len(m.exemple.hanzi) > 1:
            formes.append((m.exemple.hanzi, m.exemple.pinyin))
    return Place(
        id=c,
        genre="caractere",
        hanzi=c,
        pinyin=ref.pinyin.get(c, ""),
        niveau=ref.caracteres[c],
        categories=categories,
        formes=tuple(formes),
        lectures=tuple(ref.lectures.get(c, ())),
        simples=tuple(m.id for m in simples),
    )


def _place_mot(m: Mot) -> Place:
    formes = [(f.hanzi, f.pinyin) for f in m.formes]
    if m.exemple:
        formes.append((m.exemple.hanzi, m.exemple.pinyin))
    return Place(
        id=m.id,
        genre="mot",
        hanzi=m.forme.hanzi,
        pinyin=m.forme.pinyin,
        niveau=m.niveau,
        categories=tuple(m.categorie),
        formes=tuple(formes),
    )


def plan(niveau: str, ref: Referentiel) -> list[Place]:
    """Les entrées d'un niveau, dans l'ordre de rédaction.

    Chaque caractère du niveau vient devant le premier mot du niveau qui le contient ; les
    mots de plusieurs caractères suivent l'ordre de la liste ; les caractères du niveau
    qu'aucun mot du niveau ne contient viennent à la fin. Un mot d'un seul caractère n'a
    pas d'entrée : il se range sous son caractère.
    """
    if niveau not in NIVEAUX:
        raise DicoSensInvalide([f"niveau inconnu {niveau!r}, attendu {' '.join(NIVEAUX)}"])
    du_niveau = [c for c, n in ref.caracteres.items() if n == niveau]
    places: list[Place] = []
    poses: set[str] = set()
    for m in ref.mots:
        if m.niveau != niveau:
            continue
        for c in m.forme.hanzi:
            if c in ref.caracteres and ref.caracteres[c] == niveau and c not in poses:
                poses.add(c)
                places.append(_place_caractere(c, ref))
        if len(m.forme.hanzi) > 1:
            places.append(_place_mot(m))
    for c in du_niveau:
        if c not in poses:
            poses.add(c)
            places.append(_place_caractere(c, ref))
    return places


def nom_de_lot(k: int) -> str:
    return f"{k + 1:02d}"


def lots(niveau: str, ref: Referentiel) -> dict[str, list[Place]]:
    places = plan(niveau, ref)
    return {nom_de_lot(i // TAILLE_LOT): places[i : i + TAILLE_LOT] for i in range(0, len(places), TAILLE_LOT)}


def places_par_id(ref: Referentiel, niveaux: Iterable[str] = NIVEAUX) -> dict[str, tuple[str, str, Place]]:
    """`{id: (niveau, lot, place)}` pour les niveaux demandés."""
    out: dict[str, tuple[str, str, Place]] = {}
    for n in niveaux:
        for lot, places in lots(n, ref).items():
            for p in places:
                out[p.id] = (n, lot, p)
    return out


# --------------------------------------------------------------------------- textes


@dataclass(frozen=True)
class Acception:
    categorie: str
    fr: str
    #: La lecture de cette acception quand ce n'est pas la lecture principale (好 hào).
    pinyin: str = ""

    def en_json(self) -> dict[str, str]:
        d = {"categorie": self.categorie, "fr": self.fr}
        if self.pinyin:
            d["pinyin"] = self.pinyin
        return d


@dataclass(frozen=True)
class Exemple:
    zh: str
    pinyin: str
    fr: str

    def en_json(self) -> dict[str, str]:
        return {"zh": self.zh, "pinyin": self.pinyin, "fr": self.fr}


def _nfc(x: object) -> str:
    return unicodedata.normalize("NFC", str(x or "")).strip()


def acception_depuis(valeur: object, nom: str, problemes: list[str]) -> Acception | None:
    """Une acception d'un brouillon (`[catégorie, fr]` ou `[catégorie, fr, pinyin]`) ou d'un lot."""
    if isinstance(valeur, Mapping):
        return Acception(_nfc(valeur.get("categorie")), _nfc(valeur.get("fr")), _nfc(valeur.get("pinyin")))
    if isinstance(valeur, (list, tuple)) and len(valeur) in (2, 3) and all(isinstance(x, str) for x in valeur):
        return Acception(_nfc(valeur[0]), _nfc(valeur[1]), _nfc(valeur[2]) if len(valeur) == 3 else "")
    problemes.append(f"{nom} : acception hors schéma {valeur!r}")
    return None


def exemple_depuis(valeur: object, nom: str, problemes: list[str]) -> Exemple | None:
    if isinstance(valeur, Mapping):
        return Exemple(_nfc(valeur.get("zh")), _nfc(valeur.get("pinyin")), _nfc(valeur.get("fr")))
    if isinstance(valeur, (list, tuple)) and len(valeur) == 3 and all(isinstance(x, str) for x in valeur):
        return Exemple(_nfc(valeur[0]), _nfc(valeur[1]), _nfc(valeur[2]))
    problemes.append(f"{nom} : phrase hors schéma {valeur!r}")
    return None


# ------------------------------------------------------------------------ validation


def _sans_ponctuation(zh: str) -> str:
    return "".join(c for c in zh if est_sinogramme(c))


def _normal_fr(texte: str) -> str:
    t = unicodedata.normalize("NFC", texte).lower().replace("’", "'")
    t = re.sub(r"\([^)]*\)", " ", t)
    t = re.sub(r"[^\w' -]+", " ", t)
    return " ".join(t.split())


def ecarts_glose(glose: str) -> list[str]:
    ecarts: list[str] = []
    if not glose:
        return ["glose vide"]
    if len(glose) > GLOSE_MAX:
        ecarts.append(f"glose de {len(glose)} caractères (au plus {GLOSE_MAX}) : « {glose} »")
    if HAN.search(glose):
        ecarts.append(f"sinogramme dans la glose « {glose} »")
    if glose[-1] in ".。":
        ecarts.append(f"point final dans la glose « {glose} »")
    return ecarts


def ecarts_acceptions(acceptions: Sequence[Acception], place: Place, *, reprise: bool) -> list[str]:
    ecarts: list[str] = []
    if reprise:
        if acceptions:
            ecarts.append("une glose reprise d'une fiche n'a pas d'acception (aucune n'a été relue)")
        return ecarts
    if not ACCEPTIONS_MIN <= len(acceptions) <= ACCEPTIONS_MAX:
        ecarts.append(f"{len(acceptions)} acceptions (de {ACCEPTIONS_MIN} à {ACCEPTIONS_MAX})")
    permises = place.categories or tuple(CATEGORIES)
    for a in acceptions:
        if a.categorie not in permises:
            ecarts.append(f"catégorie {a.categorie!r} hors de la liste ({'/'.join(permises)})")
        if not a.fr:
            ecarts.append("acception vide")
        elif len(a.fr) > ACCEPTION_MAX:
            ecarts.append(f"acception de {len(a.fr)} caractères (au plus {ACCEPTION_MAX}) : « {a.fr} »")
        if HAN.search(a.fr):
            ecarts.append(f"sinogramme dans l'acception « {a.fr} »")
        if a.fr.endswith((".", "。")):
            ecarts.append(f"point final dans l'acception « {a.fr} »")
        if a.pinyin:
            if place.genre != "caractere":
                ecarts.append(f"lecture « {a.pinyin} » sur l'acception d'un mot : seul un caractère en a")
            elif a.pinyin not in place.lectures:
                ecarts.append(f"lecture « {a.pinyin} » inconnue de {place.hanzi} ({' '.join(place.lectures)})")
    return ecarts


def _occurrences(zh: str, hanzi: str) -> list[int]:
    """Les rangs (parmi les seuls sinogrammes) où `hanzi` commence dans `zh`."""
    signes = _sans_ponctuation(zh)
    return [i for i in range(len(signes) - len(hanzi) + 1) if signes[i : i + len(hanzi)] == hanzi]


def _pinyin_du_rang(pinyin: str, formes: Sequence[str], debut: int, fin: int) -> str:
    """Le texte du pinyin qui lit les sinogrammes `[debut, fin)`, espaces comprises."""
    lettres, positions = mots_hsk._lettres(unicodedata.normalize("NFC", pinyin))
    a = sum(len(f) for f in formes[:debut])
    b = sum(len(f) for f in formes[:fin])
    if a >= len(positions) or b == 0:
        return ""
    return unicodedata.normalize("NFC", pinyin)[positions[a] : positions[b - 1] + 1]


def _comparable(pinyin: str) -> str:
    return unicodedata.normalize("NFC", pinyin).lower().replace("'", "").replace("-", " ").strip()


def ecarts_phrase(e: Exemple, place: Place, ref: Referentiel) -> list[str]:
    """Écarts bloquants d'une phrase d'exemple : forme, caractères du HSK, pinyin."""
    ecarts: list[str] = []
    if not e.zh or not e.pinyin or not e.fr:
        return [f"phrase incomplète {e.zh!r}"]
    etrangers = sorted({c for c in e.zh if not est_sinogramme(c) and c not in PONCTUATION})
    if etrangers:
        ecarts.append(f"« {e.zh} » : signes hors des sinogrammes et de la ponctuation chinoise : {' '.join(etrangers)}")
    signes = _sans_ponctuation(e.zh)
    if len(signes) > PHRASE_MAX:
        ecarts.append(f"« {e.zh} » : {len(signes)} sinogrammes (au plus {PHRASE_MAX})")
    if e.zh[-1] not in FINS_ZH:
        ecarts.append(f"« {e.zh} » ne finit pas par 。？ ou ！")
    hors = sorted({c for c in signes if c not in ref.caracteres})
    if hors:
        ecarts.append(f"« {e.zh} » : hors du HSK {' '.join(hors)}")
    presentes = [(h, p) for h, p in place.formes if h in signes]
    if not presentes:
        ecarts.append(f"« {e.zh} » ne contient pas {place.hanzi}")
    # Le pinyin : lu dans les lectures, le mot au pinyin de la liste, écrit par mot.
    lectures = {c: ref.lectures.get(c, []) for c in set(signes)}
    formes = aligner(e.zh, e.pinyin, lectures)
    if formes is None:
        ecarts.append(f"« {e.zh} » ne se lit pas « {e.pinyin} » (lectures d'Unihan et des surcharges)")
    else:
        for h, p in presentes:
            if len(h) < 2 or not p:
                continue
            for debut in _occurrences(e.zh, h):
                lu = _pinyin_du_rang(e.pinyin, formes, debut, debut + len(h))
                if _comparable(lu) != _comparable(p):
                    ecarts.append(f"« {e.zh} » : {h} écrit « {lu} », la liste dit « {p} »")
        ecarts += [f"« {e.zh} » : {x}" for x in ecarts_de_position(e.zh, formes)]
    if e.pinyin[:1] != e.pinyin[:1].upper():
        ecarts.append(f"« {e.pinyin} » : pas de majuscule initiale")
    if e.zh[-1:] in FINS_ZH and not e.pinyin.rstrip().endswith(FINS_ZH[e.zh[-1]]):
        ecarts.append(f"« {e.pinyin} » ne finit pas comme « {e.zh} » ({FINS_ZH[e.zh[-1]]})")
    if len(e.fr) > TRADUCTION_MAX:
        ecarts.append(f"traduction de {len(e.fr)} caractères (au plus {TRADUCTION_MAX})")
    if HAN.search(e.fr) or HAN.search(e.pinyin):
        ecarts.append(f"sinogramme dans la traduction ou le pinyin de « {e.zh} »")
    if not e.fr.rstrip().endswith((".", "?", "!", "…", "»")):
        ecarts.append(f"traduction sans ponctuation finale : « {e.fr} »")
    return ecarts


def ecarts_fuite(e: Exemple, place: Place, glose: str, acceptions: Sequence[Acception]) -> list[str]:
    """La phrase ne se réduit pas au mot, et sa traduction ne sert pas de glose au mot."""
    ecarts: list[str] = []
    signes = _sans_ponctuation(e.zh)
    if signes in {h for h, _ in place.formes}:
        ecarts.append(f"« {e.zh} » n'est que le mot : ce n'est pas une phrase")
    fr = _normal_fr(e.fr)
    morceaux = {_normal_fr(x) for x in re.split(r"[;,]", glose) if x.strip()} | {_normal_fr(glose)}
    morceaux |= {_normal_fr(a.fr) for a in acceptions}
    morceaux |= {_normal_fr(x) for a in acceptions for x in re.split(r"[;,]", a.fr) if x.strip()}
    if fr in morceaux:
        ecarts.append(f"la traduction « {e.fr} » redit la glose du mot")
    return ecarts


def ecarts_exemples(exemples: Sequence[Exemple], place: Place, ref: Referentiel, glose: str, acceptions: Sequence[Acception], *, redaction: bool) -> list[str]:
    ecarts: list[str] = []
    minimum = place.exemples_min if redaction else 0
    if not minimum <= len(exemples) <= EXEMPLES_MAX:
        ecarts.append(f"{len(exemples)} phrases (de {minimum} à {EXEMPLES_MAX})")
    if len({e.zh for e in exemples}) != len(exemples):
        ecarts.append("deux phrases identiques")
    for e in exemples:
        ecarts += ecarts_phrase(e, place, ref)
        ecarts += ecarts_fuite(e, place, glose, acceptions)
    return ecarts


def glose_reprise(place: Place, ref: Referentiel) -> tuple[str, str] | None:
    """La glose relue d'une fiche que l'entrée peut reprendre, et son fichier."""
    if place.genre == "caractere":
        return ref.fiches_caracteres.get(place.hanzi)
    for h, p in place.formes:
        trouve = ref.fiches_mots.get((h, unicodedata.normalize("NFC", p).lower().replace(" ", "")))
        if trouve:
            return trouve
    return None


@dataclass
class Redaction:
    """Ce que le rédacteur a écrit pour une entrée."""

    id: str
    glose: str
    acceptions: list[Acception]
    exemples: list[Exemple]
    reprise: bool = False


def valider(r: Redaction, place: Place, ref: Referentiel, *, redaction: bool = True) -> list[str]:
    """Tout ce qui empêche l'entrée d'entrer dans un lot. Vide : elle est valide."""
    ecarts: list[str] = []
    if r.reprise:
        trouve = glose_reprise(place, ref)
        if trouve is None:
            ecarts.append("reprise demandée, mais aucune fiche relue ne donne de glose")
        elif r.glose and r.glose != trouve[0]:
            ecarts.append(f"reprise : la glose relue est « {trouve[0]} », pas « {r.glose} »")
    ecarts += ecarts_glose(r.glose)
    ecarts += ecarts_acceptions(r.acceptions, place, reprise=r.reprise)
    ecarts += ecarts_exemples(r.exemples, place, ref, r.glose, r.acceptions, redaction=redaction)
    return [f"{place.id} {place.hanzi} : {x}" for x in ecarts]


# ------------------------------------------------------------------- les brouillons


def chemin_brouillon(niveau: str, lot: str, dossier: Path | None = None) -> Path:
    return (dossier or BROUILLONS) / niveau / f"{lot}.json"


def chemin_lot(niveau: str, lot: str, dossier: Path | None = None) -> Path:
    return (dossier or DOSSIER) / niveau / f"{lot}.json"


def empreinte(octets: bytes) -> str:
    return "sha256:" + hashlib.sha256(octets).hexdigest()


def lire_brouillon(chemin: Path, ref: Referentiel, places: Sequence[Place]) -> tuple[list[Redaction], str]:
    """Les rédactions d'un brouillon, dans l'ordre du lot, et son empreinte. Tout ou rien."""
    octets = chemin.read_bytes()
    try:
        document = json.loads(octets)
    except json.JSONDecodeError as erreur:
        raise DicoSensInvalide([f"{_relatif(chemin)} : JSON illisible ({erreur})"]) from erreur
    problemes: list[str] = []
    entrees = document.get("entrees") if isinstance(document, Mapping) else None
    if not isinstance(entrees, Mapping):
        raise DicoSensInvalide([f"{_relatif(chemin)} : clé `entrees` absente"])
    attendus = [p.id for p in places]
    manquent = [i for i in attendus if i not in entrees]
    de_trop = [i for i in entrees if i not in attendus]
    if manquent:
        problemes.append(f"entrées absentes : {' '.join(manquent)}")
    if de_trop:
        problemes.append(f"entrées hors du lot : {' '.join(de_trop)}")
    par_id = {p.id: p for p in places}
    redactions: list[Redaction] = []
    for ident in attendus:
        brute = entrees.get(ident)
        if brute is None:
            continue
        if not isinstance(brute, Mapping):
            problemes.append(f"{ident} : objet attendu")
            continue
        inconnues = set(brute) - {"glose", "acceptions", "exemples", "reprise"}
        if inconnues:
            problemes.append(f"{ident} : clés inconnues {' '.join(sorted(inconnues))}")
        place = par_id[ident]
        reprise = bool(brute.get("reprise"))
        glose = _nfc(brute.get("glose"))
        if reprise and not glose:
            trouve = glose_reprise(place, ref)
            glose = trouve[0] if trouve else ""
        acceptions = [a for a in (acception_depuis(x, ident, problemes) for x in brute.get("acceptions") or ()) if a]
        exemples = [e for e in (exemple_depuis(x, ident, problemes) for x in brute.get("exemples") or ()) if e]
        r = Redaction(ident, glose, acceptions, exemples, reprise)
        problemes += valider(r, place, ref)
        redactions.append(r)
    if problemes:
        raise DicoSensInvalide([f"{_relatif(chemin)} : {p}" for p in problemes])
    return redactions, empreinte(octets)


def squelette(places: Sequence[Place], niveau: str, lot: str) -> dict[str, object]:
    return {
        "niveau": niveau,
        "lot": lot,
        "entrees": {p.id: {"glose": "", "acceptions": [], "exemples": []} for p in places},
    }


# ------------------------------------------------------------------------- les lots


def _texte_sens(sens: Mapping[str, object] | None) -> dict[str, object] | None:
    if not sens:
        return None
    return {
        "glose": sens.get("glose"),
        "acceptions": [dict(a) for a in sens.get("acceptions") or ()],  # type: ignore[union-attr]
    }


def _texte_exemple(e: Mapping[str, object]) -> dict[str, object]:
    return {"zh": e.get("zh"), "pinyin": e.get("pinyin"), "fr": e.get("fr")}


def _garde(nouveau: dict[str, object], anciens: Sequence[Mapping[str, object]], texte: Callable[[Mapping[str, object]], object]) -> dict[str, object]:
    """L'ancien texte s'il est inchangé (ou si le brouillon est celui d'avant sa correction), sinon le nouveau."""
    cible = texte(nouveau)
    for a in anciens:
        if texte(a) == cible:
            return dict(a)
        avant = (a.get("relecture") or {}).get("avant")  # type: ignore[union-attr]
        if avant is not None and avant == cible:
            return dict(a)
    return nouveau


def entree_de_lot(r: Redaction, place: Place, ref: Referentiel, ancienne: Mapping[str, object] | None) -> dict[str, object]:
    if r.reprise:
        trouve = glose_reprise(place, ref)
        assert trouve is not None
        sens: dict[str, object] = {
            "glose": r.glose,
            "acceptions": [],
            "statut": RELU,
            "provenance": {"reprise": trouve[1], "champ": "sens_fr" if place.genre == "caractere" else "mots[].fr"},
        }
    else:
        sens = {"glose": r.glose, "acceptions": [a.en_json() for a in r.acceptions], "statut": A_RELIRE}
    anciens_sens = [ancienne["sens"]] if ancienne and ancienne.get("sens") else []
    sens = _garde(sens, anciens_sens, _texte_sens)  # type: ignore[arg-type]
    anciens_ex = list((ancienne or {}).get("exemples") or ())  # type: ignore[arg-type]
    # Une phrase que la relecture a retirée ne revient pas du brouillon.
    retirees = [dict(x) for x in (ancienne or {}).get("retirees") or ()]  # type: ignore[union-attr]
    ecartees = [_texte_exemple(x) for x in retirees]
    exemples = [
        _garde({**e.en_json(), "statut": A_RELIRE}, anciens_ex, _texte_exemple)
        for e in r.exemples
        if e.en_json() not in ecartees
    ]
    entree: dict[str, object] = {
        "id": place.id,
        "genre": place.genre,
        "hanzi": place.hanzi,
        "pinyin": place.pinyin,
    }
    if place.categories:
        entree["categories"] = list(place.categories)
    if place.simples:
        entree["mots"] = list(place.simples)
    entree["sens"] = sens
    entree["exemples"] = exemples
    if retirees:
        entree["retirees"] = retirees
    return entree


def lire_lot(chemin: Path) -> dict[str, object]:
    return json.loads(chemin.read_text(encoding="utf-8"))


def ecrire_json(chemin: Path, document: object) -> bool:
    """Écrit si le contenu change. Vrai si le fichier a été écrit."""
    texte = json.dumps(document, ensure_ascii=False, indent=1) + "\n"
    if chemin.exists() and chemin.read_text(encoding="utf-8") == texte:
        return False
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(texte, encoding="utf-8")
    return True


def lots_ecrits(dossier: Path | None = None) -> list[Path]:
    dossier = dossier or DOSSIER
    if not dossier.is_dir():
        return []
    return sorted(dossier.glob("*/*.json"), key=lambda p: (NIVEAUX.index(p.parent.name) if p.parent.name in NIVEAUX else 99, p.name))


def importer(
    niveau: str,
    lot: str,
    ref: Referentiel,
    *,
    brouillons: Path | None = None,
    dossier: Path | None = None,
    horloge: Callable[[], str] = _aujourdhui,
) -> tuple[Path, bool]:
    """Valide le brouillon d'un lot et écrit le lot. (chemin, écrit ?). Tout ou rien."""
    places = lots(niveau, ref).get(lot)
    if places is None:
        raise DicoSensInvalide([f"HSK {niveau} n'a pas de lot {lot}"])
    source = chemin_brouillon(niveau, lot, brouillons)
    if not source.exists():
        raise DicoSensInvalide([f"{_relatif(source)} absent"])
    redactions, emp = lire_brouillon(source, ref, places)
    cible = chemin_lot(niveau, lot, dossier)
    ancien = lire_lot(cible) if cible.exists() else {}
    anciennes = {str(e["id"]): e for e in ancien.get("entrees") or ()}  # type: ignore[union-attr]
    par_id = {p.id: p for p in places}
    entrees = [entree_de_lot(r, par_id[r.id], ref, anciennes.get(r.id)) for r in redactions]
    # Rien de changé : le lot garde sa traçabilité d'origine, et ses octets.
    generation = ancien.get("generation") if ancien.get("entrees") == entrees else None
    if generation is None:
        generation = {
            "modele": MODELE_MANUEL,
            "api": API_SESSION,
            "date": horloge(),
            "empreinte_invite": emp,
            "contexte": f"wenlu dico contexte {niveau} {lot}",
            "essais": 1,
            "refus": [],
        }
    document = {
        "niveau": niveau,
        "lot": lot,
        "source": SOURCE_LOT,
        "brouillon": _relatif(source),
        "generation": generation,
        "entrees": entrees,
    }
    return cible, ecrire_json(cible, document)


# ------------------------------------------------------------------------- contexte


def _gloses_ecrites(dossier: Path | None = None) -> dict[str, tuple[str, str]]:
    """`{id: (glose, statut)}` des lots déjà écrits."""
    out: dict[str, tuple[str, str]] = {}
    for chemin in lots_ecrits(dossier):
        for e in lire_lot(chemin).get("entrees") or ():  # type: ignore[union-attr]
            s = e.get("sens") or {}
            if s.get("glose"):
                out[str(e["id"])] = (str(s["glose"]), str(s.get("statut")))
    return out


def decrire_contexte(niveau: str, lot: str, ref: Referentiel, *, dossier: Path | None = None) -> list[str]:
    """Les faits que le rédacteur lit pour un lot : ceux de l'invite, sans API."""
    places = lots(niveau, ref).get(lot)
    if places is None:
        raise DicoSensInvalide([f"HSK {niveau} n'a pas de lot {lot}"])
    ecrites = _gloses_ecrites(dossier)
    rang = NIVEAUX.index(niveau)
    permis = [c for c, n in ref.caracteres.items() if NIVEAUX.index(n) <= rang]
    lignes = [
        f"# Dictionnaire, HSK {niveau}, lot {lot} : {len(places)} entrées",
        f"Brouillon à écrire : {_relatif(chemin_brouillon(niveau, lot))}",
        "",
        CONTRAINTES,
        "",
        f"Caractères des niveaux 1 à {niveau} ({len(permis)}), à préférer dans les phrases : {''.join(permis)}",
        "",
    ]

    def glose_de(c: str) -> str:
        if c in ecrites:
            g, s = ecrites[c]
            return f"{g}{'' if s == RELU else ' (à relire)'}"
        if c in ref.fiches_caracteres:
            return f"{ref.fiches_caracteres[c][0]} (fiche relue)"
        return "—"

    for p in places:
        if p.genre == "caractere":
            lignes.append(f"## {p.id} — caractère {p.hanzi} {p.pinyin}, HSK {p.niveau}")
            lignes.append(f"lectures : {' '.join(p.lectures) or '—'}")
            simples = [ref.par_id[i] for i in p.simples]
            if simples:
                lignes.append(
                    "mot à lui seul : "
                    + " ; ".join(
                        f"{m.id} {m.officiel} {m.forme.pinyin} [{'/'.join(m.categorie) or 'sans catégorie'}] HSK {m.niveau}"
                        + (f", emploi {m.exemple.hanzi} {m.exemple.pinyin}" if m.exemple else "")
                        for m in simples
                    )
                )
            else:
                lignes.append("mot à lui seul : non (pas d'entrée d'un seul caractère dans la liste)")
            voisins = [m for m in ref.contenant.get(p.hanzi, []) if len(m.forme.hanzi) > 1][:10]
        else:
            m = ref.par_id[p.id]
            lignes.append(f"## {p.id} — mot {p.hanzi} {p.pinyin}, HSK {p.niveau} [{'/'.join(p.categories) or 'sans catégorie : au choix'}]")
            lignes.append(f"officiel : {m.officiel} {m.pinyin_officiel}")
            if m.variantes:
                lignes.append("variantes : " + " ; ".join(f"{v.hanzi} {v.pinyin}" for v in m.variantes))
            lignes.append("caractères : " + " ; ".join(f"{c} {glose_de(c)}" for c in dict.fromkeys(p.hanzi)))
            voisins = [
                x for c in dict.fromkeys(p.hanzi) for x in ref.contenant.get(c, []) if x.id != p.id and len(x.forme.hanzi) > 1
            ]
            voisins = list(dict.fromkeys(voisins))[:8]
        if voisins:
            lignes.append(
                "voisins : "
                + " ; ".join(f"{v.forme.hanzi} {v.forme.pinyin} (HSK {v.niveau}{', ' + ecrites[v.id][0] if v.id in ecrites else ''})" for v in voisins)
            )
        reprise = glose_reprise(p, ref)
        if reprise:
            lignes.append(f"glose relue à reprendre si elle convient (\"reprise\": true) : « {reprise[0]} » ({reprise[1]})")
        lignes.append("")
    return lignes


CONTRAINTES = f"""Contraintes, vérifiées par `wenlu dico importer` :
- `glose` : le sens de la liste des résultats, français naturel, {GLOSE_MAX} caractères au plus,
  sans sinogramme ni point final ; les sens séparés par « ; », les synonymes par « , ».
- `acceptions` : 1 à {ACCEPTIONS_MAX}, `[catégorie, texte]`, ou `[catégorie, texte, pinyin]` pour une
  autre lecture du caractère (好 hào) ; catégorie parmi celles de la liste pour un mot qui en a,
  parmi {' '.join(CATEGORIES)} sinon. Un caractère qui est aussi un mot de la liste range ici les
  sens de ce mot : ses acceptions couvrent ses catégories.
- `"reprise": true` : reprendre telle quelle la glose relue d'une fiche (alors ni `glose` ni
  `acceptions`) ; seulement si elle convient à l'entrée.
- `exemples` : 1 ou 2 phrases pour un mot (0 à 2 pour un caractère qui n'est pas un mot à lui seul),
  `[zh, pinyin, fr]` ; courtes ({PHRASE_MAX} sinogrammes au plus), naturelles, qui contiennent l'entrée,
  avec les seuls caractères du HSK (ceux du niveau de l'entrée ou d'avant, si possible) et la
  ponctuation 。，？！、：; le pinyin écrit par mot, majuscule initiale, tons de la liste pour le mot
  (ton neutre compris), sans sandhi (一 yī, 不 bù) ; la traduction ne redit pas la glose."""


# ------------------------------------------------------------------------ relecture


def lots_de(niveaux: Iterable[str], dossier: Path | None = None) -> list[dict[str, object]]:
    voulus = set(niveaux)
    return [lire_lot(c) for c in lots_ecrits(dossier) if c.parent.name in voulus]


def a_relire(lot: Mapping[str, object]) -> int:
    n = 0
    for e in lot.get("entrees") or ():  # type: ignore[union-attr]
        if (e.get("sens") or {}).get("statut") == A_RELIRE:
            n += 1
        n += sum(1 for x in e.get("exemples") or () if x.get("statut") == A_RELIRE)
    return n


def appliquer_relecture(
    document: object,
    ref: Referentiel,
    *,
    dossier: Path | None = None,
    horloge: Callable[[], str] = _aujourdhui,
) -> dict[str, int]:
    """Réintègre les retours de la page de relecture. Tout ou rien.

    `{"format": "wenlu-dico-relecture", "decisions": {"<id>": {"decision": "bon" | "corrige" |
    "a_refaire", "sens": {glose, acceptions}, "exemples": [{zh, pinyin, fr}], "note": "…"}}}`.

    - `bon` : ce qui était à relire dans l'entrée passe à `relu` ;
    - `corrige` : le sens et les phrases envoyés remplacent ceux de l'entrée, passent par
      `valider()`, et deviennent `relu` ; chaque texte changé garde le texte d'avant ;
    - `a_refaire` : ce qui était à relire passe à `rejete`, avec la note : ni exporté, ni
      montré, à réécrire dans le brouillon.
    """
    if not isinstance(document, Mapping) or document.get("format") != FORMAT_RELECTURE:
        raise DicoSensInvalide([f"attendu un objet JSON {{\"format\": \"{FORMAT_RELECTURE}\", \"decisions\": …}}"])
    decisions = document.get("decisions")
    if not isinstance(decisions, Mapping):
        raise DicoSensInvalide(["clé `decisions` absente"])
    date = horloge()
    fichiers: dict[Path, dict[str, object]] = {}
    ou: dict[str, tuple[Path, int]] = {}
    for chemin in lots_ecrits(dossier):
        doc = lire_lot(chemin)
        fichiers[chemin] = doc
        for i, e in enumerate(doc.get("entrees") or ()):  # type: ignore[arg-type]
            ou[str(e["id"])] = (chemin, i)
    places = {p.id: p for _, _, p in places_par_id(ref).values()}
    problemes: list[str] = []
    compte = {BON: 0, CORRIGE: 0, A_REFAIRE: 0}
    for ident, d in decisions.items():
        if d is None:
            continue
        if not isinstance(d, Mapping) or d.get("decision") not in DECISIONS:
            problemes.append(f"{ident} : décision attendue parmi {' '.join(DECISIONS)}")
            continue
        if ident not in ou or ident not in places:
            problemes.append(f"{ident} : aucune entrée rédigée")
            continue
        chemin, i = ou[ident]
        entree = fichiers[chemin]["entrees"][i]  # type: ignore[index]
        note = _nfc(d.get("note"))
        decision = str(d["decision"])
        trace: dict[str, object] = {"date": date, "decision": decision, "par": "relecture humaine, page wenlu dico apercu"}
        if note:
            trace["note"] = note
        if decision == BON:
            s = entree.get("sens") or {}
            if s.get("statut") == A_RELIRE:
                s["statut"] = RELU
                s["relecture"] = trace
            for x in entree.get("exemples") or ():
                if x.get("statut") == A_RELIRE:
                    x["statut"] = RELU
                    x["relecture"] = trace
        elif decision == A_REFAIRE:
            s = entree.get("sens") or {}
            if s.get("statut") == A_RELIRE:
                s["statut"] = REJETE
                s["relecture"] = trace
            for x in entree.get("exemples") or ():
                if x.get("statut") == A_RELIRE:
                    x["statut"] = REJETE
                    x["relecture"] = trace
        else:
            loc: list[str] = []
            sens_d = d.get("sens") if isinstance(d.get("sens"), Mapping) else None
            ancien_sens = entree.get("sens") or {}
            glose = _nfc(sens_d.get("glose")) if sens_d else str(ancien_sens.get("glose") or "")
            acceptions = (
                [a for a in (acception_depuis(x, ident, loc) for x in sens_d.get("acceptions") or ()) if a]
                if sens_d
                else [a for a in (acception_depuis(x, ident, loc) for x in ancien_sens.get("acceptions") or ()) if a]
            )
            ex_d = d.get("exemples")
            exemples = (
                [e for e in (exemple_depuis(x, ident, loc) for x in ex_d) if e]
                if isinstance(ex_d, list)
                else [e for e in (exemple_depuis(x, ident, loc) for x in entree.get("exemples") or ()) if e]
            )
            reprise = bool((ancien_sens.get("provenance") or {}).get("reprise")) and not acceptions and glose == ancien_sens.get("glose")
            loc += valider(Redaction(ident, glose, acceptions, exemples, reprise), places[ident], ref, redaction=False)
            if loc:
                problemes += loc
                continue
            nouveau_sens = {"glose": glose, "acceptions": [a.en_json() for a in acceptions]}
            if nouveau_sens == _texte_sens(ancien_sens):
                if ancien_sens.get("statut") != RELU:
                    ancien_sens["statut"] = RELU
                    ancien_sens["relecture"] = {**trace, "decision": BON}
            else:
                entree["sens"] = {
                    **nouveau_sens,
                    "statut": RELU,
                    "relecture": {**trace, "avant": _texte_sens(ancien_sens)},
                }
            anciens = list(entree.get("exemples") or ())
            gardes = [_texte_exemple(a) for a in anciens if _texte_exemple(a) in [e.en_json() for e in exemples]]
            # Les phrases d'avant qui ne restent pas : chacune devient l'`avant` d'une phrase
            # corrigée, dans l'ordre ; celles qui restent sans remplaçante sont tracées à part.
            partantes = [_texte_exemple(a) for a in anciens if _texte_exemple(a) not in gardes]
            nouveaux: list[dict[str, object]] = []
            for e in exemples:
                texte = e.en_json()
                meme = next((a for a in anciens if _texte_exemple(a) == texte), None)
                if meme is not None:
                    if meme.get("statut") != RELU:
                        meme = {**meme, "statut": RELU, "relecture": {**trace, "decision": BON}}
                    nouveaux.append(dict(meme))
                else:
                    avant = partantes.pop(0) if partantes else None
                    nouveaux.append({**texte, "statut": RELU, "relecture": {**trace, "avant": avant}})
            if partantes:
                entree.setdefault("retirees", []).extend({**r, "relecture": trace} for r in partantes)  # type: ignore[union-attr]
            entree["exemples"] = nouveaux
        compte[decision] += 1
    if problemes:
        raise DicoSensInvalide(problemes)
    for chemin, doc in fichiers.items():
        ecrire_json(chemin, doc)
    return compte


# --------------------------------------------------------------------------- export


def pour_export(dossier: Path | None = None) -> tuple[dict[str, dict[str, object]], dict[str, list[dict[str, object]]]]:
    """(sens, exemples) par identifiant d'entrée, tous statuts : `dictionnaire` ne garde que `relu`."""
    sens: dict[str, dict[str, object]] = {}
    exemples: dict[str, list[dict[str, object]]] = {}
    for chemin in lots_ecrits(dossier):
        for e in lire_lot(chemin).get("entrees") or ():  # type: ignore[union-attr]
            ident = str(e["id"])
            if e.get("sens"):
                sens[ident] = dict(e["sens"])
            if e.get("exemples"):
                exemples[ident] = [dict(x) for x in e["exemples"]]
    return sens, exemples


# ------------------------------------------------------------------------- contrôles


@dataclass
class Bilan:
    """Ce que `wenlu check` relève dans les lots écrits, règle par règle."""

    sinogrammes: list[str] = field(default_factory=list)
    longueurs: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    hors_hsk: list[str] = field(default_factory=list)
    pinyin: list[str] = field(default_factory=list)
    fuites: list[str] = field(default_factory=list)
    statuts: list[str] = field(default_factory=list)
    lots: list[str] = field(default_factory=list)
    #: Signalés, non bloquants.
    au_dessus: list[str] = field(default_factory=list)
    autres_mots: list[str] = field(default_factory=list)
    comptes: dict[str, dict[str, int]] = field(default_factory=dict)


def _ranger(ecart: str, bilan: Bilan) -> None:
    if "sinogramme dans" in ecart:
        bilan.sinogrammes.append(ecart)
    elif "hors du HSK" in ecart or "signes hors" in ecart:
        bilan.hors_hsk.append(ecart)
    elif "catégorie" in ecart or "lecture «" in ecart:
        bilan.categories.append(ecart)
    elif "redit la glose" in ecart or "n'est que le mot" in ecart:
        bilan.fuites.append(ecart)
    elif "ne se lit pas" in ecart or "la liste dit" in ecart or "attendu" in ecart or "majuscule" in ecart or "ne finit pas comme" in ecart:
        bilan.pinyin.append(ecart)
    else:
        bilan.longueurs.append(ecart)


def _meme_lecture(lu: Sequence[str], liste: Sequence[str]) -> bool:
    """Les syllabes de la liste, ou les mêmes où la phrase neutralise un ton (不 dans 难不难)."""
    if len(lu) != len(liste):
        return False
    return all(a == b or (a[:-1] == b[:-1] and a.endswith("5")) for a, b in zip(lu, liste))


def ecarts_autres_mots(e: Exemple, place: Place, ref: Referentiel) -> list[str]:
    """Les mots de la liste (deux caractères et plus) lus dans la phrase à d'autres tons que
    ceux de la liste (ton neutre compris). Découpage au plus long, donc approximatif (的话 dans
    说的话) : signalé, jamais bloquant ; l'écriture par mot n'est contrôlée que pour l'entrée."""
    signes = _sans_ponctuation(e.zh)
    formes = aligner(e.zh, e.pinyin, {c: ref.lectures.get(c, []) for c in set(signes)})
    if formes is None:
        return []
    ecarts: list[str] = []
    i = 0
    while i < len(signes):
        pris = 1
        for n in range(min(4, len(signes) - i), 1, -1):
            candidates = ref.formes_multiples.get(signes[i : i + n])
            if candidates:
                texte = _pinyin_du_rang(e.pinyin, formes, i, i + n)
                lu = tuple(numeroter(f) for f in formes[i : i + n])
                if signes[i : i + n] not in {h for h, _ in place.formes} and not any(
                    _meme_lecture(lu, f.syllabes) or _meme_lecture(lu, f.pleines) for f in candidates
                ):
                    ecarts.append(f"« {e.zh} » : {signes[i:i+n]} écrit « {texte} », la liste dit « {candidates[0].pinyin} »")
                pris = n
                break
        i += pris
    return ecarts


def avertissements(niveau: str, lot: str, ref: Referentiel, dossier: Path | None = None) -> list[str]:
    """Ce qui est signalé sans bloquer dans un lot écrit : phrases au-dessus du niveau, autres mots."""
    chemin = chemin_lot(niveau, lot, dossier)
    if not chemin.exists():
        return []
    places = {p.id: p for p in lots(niveau, ref).get(lot, [])}
    out: list[str] = []
    for e in lire_lot(chemin).get("entrees") or ():  # type: ignore[union-attr]
        place = places.get(str(e["id"]))
        if place is None:
            continue
        for x in e.get("exemples") or ():
            ex = Exemple(str(x["zh"]), str(x["pinyin"]), str(x["fr"]))
            n = ref.niveau_max(ex.zh)
            if n is not None and NIVEAUX.index(n) > NIVEAUX.index(place.niveau):
                out.append(f"{place.id} « {ex.zh} » au niveau HSK {n}")
            out += ecarts_autres_mots(ex, place, ref)
    return out


def bilan(ref: Referentiel, dossier: Path | None = None) -> Bilan:
    b = Bilan()
    connues = places_par_id(ref)
    for chemin in lots_ecrits(dossier):
        doc = lire_lot(chemin)
        niveau = chemin.parent.name
        compte = b.comptes.setdefault(niveau, {"lots": 0, "entrees": 0, "sens": 0, "sens_relus": 0, "reprises": 0, "exemples": 0, "exemples_relus": 0, "rejetes": 0})
        compte["lots"] += 1
        attendues = [p.id for p in lots(niveau, ref).get(chemin.stem, [])] if niveau in NIVEAUX else []
        ids = [str(e.get("id")) for e in doc.get("entrees") or ()]  # type: ignore[union-attr]
        if ids != attendues:
            b.lots.append(f"{_relatif(chemin)} : entrées différentes du plan")
        gen = doc.get("generation") or {}
        if not all(gen.get(k) for k in ("modele", "api", "date", "empreinte_invite")):
            b.lots.append(f"{_relatif(chemin)} : traçabilité (`generation`) incomplète")
        for e in doc.get("entrees") or ():  # type: ignore[union-attr]
            ident = str(e.get("id"))
            if ident not in connues:
                b.lots.append(f"{ident} : hors du plan")
                continue
            place = connues[ident][2]
            compte["entrees"] += 1
            s = e.get("sens") or {}
            prob: list[str] = []
            acceptions = [a for a in (acception_depuis(x, ident, prob) for x in s.get("acceptions") or ()) if a]
            exemples_bruts = list(e.get("exemples") or ())
            exemples = [x for x in (exemple_depuis(y, ident, prob) for y in exemples_bruts) if x]
            reprise = bool((s.get("provenance") or {}).get("reprise"))
            for x in [s, *exemples_bruts]:
                if x and x.get("statut") not in STATUTS:
                    b.statuts.append(f"{ident} : statut {x.get('statut')!r}")
            if s:
                compte["sens"] += 1
                compte["sens_relus"] += s.get("statut") == RELU
                compte["reprises"] += reprise
                compte["rejetes"] += s.get("statut") == REJETE
                if reprise and s.get("statut") == RELU:
                    trouve = glose_reprise(place, ref)
                    if trouve is None or trouve[0] != s.get("glose"):
                        b.statuts.append(f"{ident} : glose reprise « {s.get('glose')} » sans fiche relue identique")
            compte["exemples"] += len(exemples_bruts)
            compte["exemples_relus"] += sum(1 for x in exemples_bruts if x.get("statut") == RELU)
            r = Redaction(ident, str(s.get("glose") or ""), acceptions, exemples, reprise)
            for ecart in [*prob, *valider(r, place, ref, redaction=False)]:
                _ranger(ecart, b)
            for x in exemples:
                n = ref.niveau_max(x.zh)
                if n is not None and NIVEAUX.index(n) > NIVEAUX.index(place.niveau):
                    b.au_dessus.append(f"{ident} « {x.zh} » (HSK {n})")
                b.autres_mots += ecarts_autres_mots(x, place, ref)
    return b


def fautes_d_export(dossier_export: Path, sens: Mapping[str, Mapping[str, object]], exemples: Mapping[str, Sequence[Mapping[str, object]]]) -> list[str]:
    """Ce que l'export dit relu et que les sources ne disent pas relu, et l'inverse."""
    from . import dictionnaire

    index_chemin = dossier_export / dictionnaire.INDEX
    if not index_chemin.exists():
        return []
    index = json.loads(index_chemin.read_text(encoding="utf-8"))
    fichiers = index.get("fichiers") or {}
    fautes: list[str] = []
    cache: dict[str, dict[str, object]] = {}
    for genre in ("caracteres", "mots"):
        for row in index.get(genre) or ():
            ident, lot = str(row[0]), row[-2]
            relatif = str(fichiers.get(genre, "")).format(lot=lot)
            if relatif not in cache:
                cache[relatif] = json.loads((dossier_export / relatif).read_text(encoding="utf-8"))
            entree = (cache[relatif].get("entrees") or {}).get(ident) or {}  # type: ignore[union-attr]
            attendu = dictionnaire.sens_exporte(sens.get(ident))
            if entree.get("sens") != attendu:
                fautes.append(f"{ident} : sens exporté {entree.get('sens')!r}, attendu {attendu!r}")
            attendus = dictionnaire.exemples_exportes(exemples.get(ident))
            if (entree.get("exemples") or []) != attendus:
                fautes.append(f"{ident} : phrases exportées différentes des phrases relues")
    return fautes


def fautes_cedict(ref: Referentiel, racines: Iterable[Path]) -> list[str]:
    """Garde-fou structurel : rien de CC-CEDICT n'entre dans la rédaction.

    - le référentiel (le contexte du rédacteur et la validation) ne lit aucun des
      `FICHIERS_INTERDITS`, ni la colonne `CEDICT` d'ivankra ;
    - aucun lot ni brouillon ne cite CC-CEDICT ;
    - aucune glose anglaise n'est rédigée : le contrôle de SOURCES §2.3 point 5 (comparer
      chaque glose anglaise aux définitions de CC-CEDICT, `recouvrement_cedict`) n'a rien à
      comparer. Une clé `en` dans un lot est une faute tant qu'il n'est pas branché.
    """
    fautes = [f"le référentiel lit {Path(x).name}" for x in ref.lus if Path(x).name in FICHIERS_INTERDITS]
    if any(c in mots_hsk.COLONNES_INTERDITES for c in mots_hsk.COLONNES_LUES):
        fautes.append("la colonne CEDICT d'ivankra est lue")
    for racine in racines:
        if not racine.is_dir():
            continue
        for chemin in sorted(racine.rglob("*.json")):
            texte = chemin.read_text(encoding="utf-8")
            if re.search(r"cc-?cedict|cedict_1_0|mdbg", texte, re.IGNORECASE):
                fautes.append(f"{_relatif(chemin)} cite CC-CEDICT")
            if re.search(r'"en"\s*:', texte):
                fautes.append(f"{_relatif(chemin)} porte une glose anglaise sans garde-fou CC-CEDICT")
    return fautes


def _mots_anglais(texte: str) -> set[str]:
    vides = {"a", "an", "the", "to", "of", "and", "or", "in", "on", "for", "sb", "sth", "one's", "be"}
    return {m for m in re.findall(r"[a-z']+", texte.lower()) if m not in vides}


def recouvrement_cedict(en: str, definitions: Iterable[str], seuil: float = 0.8) -> bool:
    """Vrai si une glose anglaise recouvre presque entièrement une définition CC-CEDICT du même mot.

    Pour le jour où une glose anglaise serait rédigée (SOURCES §2.3, point 5) : égalité après
    normalisation, ou au moins `seuil` des mots pleins de la glose dans une définition.
    """
    mots = _mots_anglais(en)
    definitions = list(definitions)
    if not mots or not definitions:
        return False
    # Chaque définition seule, puis toutes ensemble : une entrée CC-CEDICT en aligne plusieurs.
    for autres in [*(_mots_anglais(x) for x in definitions), set().union(*(_mots_anglais(x) for x in definitions))]:
        if autres and (mots == autres or len(mots & autres) / len(mots) >= seuil):
            return True
    return False


def controles(
    dossier: Path | None = None,
    *,
    ref: Referentiel | None = None,
    destination: Path | None = None,
    brouillons: Path | None = None,
) -> list[Controle]:
    """Contrôles des sens et des phrases du dictionnaire, pour `wenlu check`. Bloquants, sauf deux."""
    dossier = dossier or DOSSIER
    if not lots_ecrits(dossier):
        return [Controle("dico sens : lots", True, "aucun lot rédigé (`wenlu dico plan`)")]
    try:
        ref = ref or charger_referentiel()
    except OSError as erreur:
        return [Controle("dico sens : lots", False, f"{erreur} — lancer `wenlu ingest`", bloquant=True)]
    b = bilan(ref, dossier)
    sens, exemples = pour_export(dossier)
    from .export import versions_exportees

    export: list[str] = []
    for v in versions_exportees(destination):
        export += [f"{v.name}: {x}" for x in fautes_d_export(v, sens, exemples)]
    cedict = fautes_cedict(ref, [dossier, brouillons or BROUILLONS])

    def c(nom: str, fautes: Sequence[str], ok: str, bloquant: bool = True) -> Controle:
        return Controle(nom, not fautes, ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5]), bloquant=bloquant)

    resume = " ; ".join(
        f"HSK {n} : {x['lots']} lots, {x['entrees']} entrées, {x['sens']} sens ({x['sens_relus']} relus, dont {x['reprises']} repris des fiches), "
        f"{x['exemples']} phrases ({x['exemples_relus']} relues), {x['rejetes']} renvoyés"
        for n, x in sorted(b.comptes.items(), key=lambda kv: NIVEAUX.index(kv[0]) if kv[0] in NIVEAUX else 99)
    )
    return [
        c("dico sens : lots", b.lots + b.statuts, resume),
        c("dico sens : sans sinogramme", b.sinogrammes, "aucun sinogramme dans les gloses, les acceptions ni les traductions"),
        c("dico sens : longueurs", b.longueurs, f"gloses de {GLOSE_MAX} caractères au plus, 1 à {ACCEPTIONS_MAX} acceptions, {EXEMPLES_MAX} phrases au plus, de {PHRASE_MAX} sinogrammes au plus"),
        c("dico sens : catégories", b.categories, "chaque acception porte une catégorie de la liste et, s'il le faut, une lecture du caractère"),
        c("dico phrases : caractères HSK", b.hors_hsk, "les phrases n'emploient que les caractères du HSK et la ponctuation chinoise"),
        c("dico phrases : pinyin", b.pinyin, "chaque phrase se lit dans les lectures du dépôt, le mot au pinyin de la liste"),
        c("dico phrases : fuites", b.fuites, "aucune traduction ne redit la glose, aucune phrase ne se réduit au mot"),
        c("dico sens : export", export, "l'export porte exactement les sens et les phrases relus, rien d'autre"),
        c("dico sens : sans CC-CEDICT", cedict, "ni le module ni les lots ne lisent ou ne citent CC-CEDICT ; aucune glose anglaise, le contrôle reste structurel"),
        c("dico phrases : niveau", b.au_dessus, "chaque phrase au niveau de son entrée ou en dessous", bloquant=False),
        c("dico phrases : autres mots", b.autres_mots, "les autres mots de la liste gardent leur pinyin dans les phrases", bloquant=False),
    ]


# ------------------------------------------------------------------------ commandes

app = typer.Typer(help="Sens français et phrases d'exemple du dictionnaire (stories 10.6 et 10.7), sans API.")


def _ref_ou_sortie() -> Referentiel:
    try:
        return charger_referentiel()
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu ingest` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur


@app.command("plan")
def commande_plan(niveau: list[str] = typer.Option(["1", "2"], help="Niveaux HSK (1 … 6, 7-9).")) -> None:
    """Les lots de chaque niveau : nombre d'entrées, caractères et mots, état de rédaction."""
    ref = _ref_ou_sortie()
    for n in niveau:
        for lot, places in lots(n, ref).items():
            ecrit = chemin_lot(n, lot)
            etat = "écrit" if ecrit.exists() else ("brouillon" if chemin_brouillon(n, lot).exists() else "à rédiger")
            car = sum(1 for p in places if p.genre == "caractere")
            typer.echo(f"HSK {n} lot {lot} : {len(places)} entrées ({car} caractères, {len(places) - car} mots) — {etat} — {places[0].hanzi}…{places[-1].hanzi}")


@app.command("contexte")
def commande_contexte(niveau: str = typer.Argument(...), lot: str = typer.Argument(...), squelette_json: bool = typer.Option(False, "--squelette", help="Écrire aussi le squelette du brouillon s'il n'existe pas.")) -> None:
    """Les faits d'un lot, pour le rédacteur (sans API) : ceux de l'invite."""
    ref = _ref_ou_sortie()
    try:
        for ligne in decrire_contexte(niveau, lot, ref):
            typer.echo(ligne)
    except DicoSensInvalide as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    if squelette_json:
        chemin = chemin_brouillon(niveau, lot)
        if not chemin.exists():
            ecrire_json(chemin, squelette(lots(niveau, ref)[lot], niveau, lot))
            typer.echo(f"Squelette écrit : {_relatif(chemin)}")


@app.command("importer")
def commande_importer(niveau: list[str] = typer.Option(["1", "2"], help="Niveaux dont importer les brouillons.")) -> None:
    """Valide chaque brouillon et écrit son lot dans data/sources/dico/ (statut a_relire)."""
    ref = _ref_ou_sortie()
    echecs = 0
    for n in niveau:
        for lot in lots(n, ref):
            if not chemin_brouillon(n, lot).exists():
                continue
            try:
                chemin, ecrit = importer(n, lot, ref)
            except DicoSensInvalide as erreur:
                echecs += 1
                typer.echo(f"HSK {n} lot {lot} refusé :", err=True)
                for p in erreur.problemes:
                    typer.echo(f"  {p}", err=True)
                continue
            typer.echo(f"HSK {n} lot {lot} : {'écrit' if ecrit else 'inchangé'} ({_relatif(chemin)})")
            for x in avertissements(n, lot, ref):
                typer.echo(f"  signalé : {x}")
    if echecs:
        raise typer.Exit(code=1)


@app.command("apercu")
def commande_apercu(
    niveau: list[str] = typer.Option(["1", "2"], help="Niveaux à relire."),
    sortie: Path = typer.Option(WORK / "dico" / "relecture.html", help="La page HTML à écrire."),
) -> None:
    """Écrit la page de relecture autonome (HTML) des lots rédigés."""
    from .dico_page import page

    ref = _ref_ou_sortie()
    texte = page(lots_de(niveau), ref, date=_aujourdhui())
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(texte, encoding="utf-8")
    n = sum(a_relire(x) for x in lots_de(niveau))
    typer.echo(f"{sortie} : {len(texte.encode('utf-8')) // 1024} Kio, {n} textes à relire.")


@app.command("appliquer-relecture")
def commande_appliquer_relecture(fichier: Path = typer.Argument(..., help="Le JSON copié depuis la page de relecture.")) -> None:
    """Réintègre les retours du propriétaire : relu, corrigé (tracé), ou à refaire."""
    ref = _ref_ou_sortie()
    try:
        compte = appliquer_relecture(json.loads(fichier.read_text(encoding="utf-8")), ref)
    except (DicoSensInvalide, json.JSONDecodeError) as erreur:
        typer.echo(f"Relecture refusée, rien n'est changé : {erreur}", err=True)
        raise typer.Exit(code=1) from erreur
    typer.echo(f"{compte[BON]} bons, {compte[CORRIGE]} corrigés, {compte[A_REFAIRE]} à refaire. Relancer `wenlu export`.")
