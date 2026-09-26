"""Les lettres de Que (story 4b.8) : un feuilleton hebdomadaire écrit avec l'acquis.

Que 雀, le moineau ami de Tao, écrit à l'apprenant une lettre par semaine, douze en tout.
La lettre n n'emploie que les caractères que le parcours Lire a posés au jour 7n : la
lettre 1 se lit avec les quatorze caractères de la première semaine, la lettre 12 avec
les 109 du jour 84. Chaque lettre est courte (40 à 120 sinogrammes), suit le voyage de
Que et finit par une question à laquelle on répond d'un mot.

Le circuit est celui des contes (`contes.py`), sans API :

- le fil, `data/sources/lettres/feuilleton.tsv` : une ligne par lettre, son titre
  français et anglais et ce qui s'y passe ;
- un rédacteur (un agent Claude Code dans sa session, sans clé ni réseau) lit
  `wenlu lettres contexte <n>` — les caractères du jour 7n, les lettres d'avant, les
  contraintes —, écrit `data/sources/lettres-brouillons/<nn>.json` : `lettre`,
  `phrases` `[{zh, pinyin, fr, en}]`, `glose` `[{zh, pinyin, fr, en}]` ;
- `wenlu lettres importer` le valide et écrit `data/sources/lettres-versions/<nn>.json`,
  au statut `a_relire` (ou `rejete` si un caractère sort de l'acquis du jour), avec la
  traçabilité des contes : `api` « session Claude Code (sans API) », `modele`
  « rédaction manuelle », l'empreinte du brouillon. Un brouillon inchangé ne réécrit
  rien : une lettre relue le reste ; un brouillon modifié repart à relire ;
- la relecture humaine : `wenlu lettres exporter-relecture` rassemble les lettres à
  relire dans `data/work/relecture-lettres.json`, `wenlu lettres appliquer-relecture`
  applique `{"<n>": "relu" | "rejete"}` ;
- `wenlu export` n'écrit dans `lettres.json` que les lettres relues ; celles à relire
  vont dans `apercu/lettres.json`, que l'app ne lit qu'en mode relecture.

Validation (`valider`) : un caractère hors de l'acquis du jour 7n est un rejet. Le reste
est vérifié par `wenlu check`, bloquant : le pinyin (une syllabe par sinogramme, tons du
dictionnaire sans sandhi, chaque syllabe une lecture du caractère selon Unihan, Make Me a
Hanzi et les surcharges), la glose (chaque sinogramme couvert tel que le lecteur découpe,
pinyin syllabe pour syllabe, sens français et anglais), la forme (longueur, traductions,
question finale) et l'export.

Le parcours HSK n'a pas ses lettres : écrire douze lettres de plus, sur un acquis qui ne
recoupe celui de Lire qu'en partie, doublerait la relecture. Dans l'app, une lettre
n'arrive que lorsque tous ses caractères ont une carte, si bien qu'un apprenant du
parcours HSK la reçoit quand il les a ; `wenlu check` dit à quel jour du parcours HSK
chaque lettre devient lisible.

Licences : rien n'est tiré de CC-CEDICT ni de Make Me a Hanzi comme texte ; traductions
et glose sont rédigées pour l'app. Les lectures (Unihan, Make Me a Hanzi, surcharges) ne
servent qu'au contrôle du pinyin.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable, Iterable, Mapping, Sequence

import typer

from .claude import maintenant as _maintenant
from .contes import (
    A_RELIRE,
    API_SESSION,
    DECISIONS,
    MODELE_MANUEL,
    REJETE,
    RELU,
    STATUTS,
    Generation,
    Glose,
    Phrase,
    Rapport,
    _syllabes,
    _textes,
    caracteres_hors_liste,
    empreinte_brouillon,
    segmenter,
)
from .fetes import lire_tsv
from .fonts import PONCTUATION_CHINOISE
from .gf0014 import Controle
from .ingest import est_sinogramme
from .paths import BUILD, DATA, RACINE, WORK

DOSSIER = DATA / "sources" / "lettres"
FEUILLETON = DOSSIER / "feuilleton.tsv"
BROUILLONS = DATA / "sources" / "lettres-brouillons"
VERSIONS = DATA / "sources" / "lettres-versions"
#: Le dossier versionné, que les tests hermétiques gardent quand ils redirigent `VERSIONS`.
VERSIONS_REELLES = VERSIONS
RELECTURE = WORK / "relecture-lettres.json"

#: Le parcours dont les lettres suivent l'acquis.
PARCOURS = "lire"
#: Une lettre par semaine : la lettre n suit l'acquis du jour `SEMAINE * n`.
SEMAINE = 7
#: Douze lettres pour le seuil 255 (backlog 4b.8).
NOMBRE = 12
#: Longueur d'une lettre, en sinogrammes, ponctuation non comprise (`docs/jeux.md`).
LONGUEUR_MIN = 40
LONGUEUR_MAX = 120
#: La dernière phrase est une question, à laquelle on répond d'un mot.
QUESTION = "？"

COLONNES = ("n", "titre_fr", "titre_en", "resume_fr")
CHAMPS_BROUILLON = ("lettre", "phrases", "glose")

SOURCE_EXPORT = (
    "lettres de Que rédigées pour l'app, sans API, dans le pipeline wenlu"
    " (`data/sources/lettres-versions/`)"
)


class FeuilletonInvalide(ValueError):
    """Le fil du feuilleton est illisible ou incohérent."""


class BrouillonInvalide(ValueError):
    """Le brouillon ne se lit pas comme une lettre : rien n'est écrit."""

    def __init__(self, nom: str, problemes: Sequence[str]) -> None:
        self.nom = nom
        self.problemes = list(problemes)
        super().__init__(f"{nom} : " + " ; ".join(self.problemes))


class RelectureInvalide(ValueError):
    """Le fichier de relecture ne s'applique pas : rien n'est changé."""

    def __init__(self, problemes: Sequence[str]) -> None:
        self.problemes = list(problemes)
        super().__init__(" ; ".join(self.problemes))


# --------------------------------------------------------------------------- le fil


@dataclass(frozen=True)
class Episode:
    """Une ligne du feuilleton : le numéro de la lettre, son titre, ce qui s'y passe."""

    n: int
    titre_fr: str
    titre_en: str
    resume_fr: str

    @property
    def jour(self) -> int:
        return jour_de_lettre(self.n)


def jour_de_lettre(n: int) -> int:
    """Le jour du parcours dont la lettre n suit l'acquis : 7, 14… 84."""
    return SEMAINE * n


def nom_de_lettre(n: int) -> str:
    """`01` … `12` : le nom de fichier d'une lettre, et sa clé de relecture."""
    return f"{n:02d}"


def charger_feuilleton(chemin: Path | None = None) -> list[Episode]:
    """Les lettres du fil, dans l'ordre. Refuse un fil troué, en double ou mal formé."""
    lignes, fautes = lire_tsv(chemin or FEUILLETON)
    if fautes:
        raise FeuilletonInvalide(" ; ".join(fautes))
    episodes: list[Episode] = []
    for ligne in lignes:
        cellules = ligne.cellules
        if tuple(cellules) != COLONNES:
            raise FeuilletonInvalide(f"ligne {ligne.numero} : colonnes attendues {COLONNES}")
        if not all(cellules.values()):
            raise FeuilletonInvalide(f"ligne {ligne.numero} : colonne vide")
        if not cellules["n"].isdigit():
            raise FeuilletonInvalide(f"ligne {ligne.numero} : n doit être un nombre")
        episodes.append(
            Episode(
                n=int(cellules["n"]),
                titre_fr=cellules["titre_fr"],
                titre_en=cellules["titre_en"],
                resume_fr=cellules["resume_fr"],
            )
        )
    attendus = list(range(1, len(episodes) + 1))
    if [e.n for e in episodes] != attendus:
        raise FeuilletonInvalide(f"les lettres se suivent de 1 à {len(episodes)}, sans trou ni doublon")
    return episodes


def episode(n: int, feuilleton: Sequence[Episode] | None = None) -> Episode:
    for e in feuilleton if feuilleton is not None else charger_feuilleton():
        if e.n == n:
            return e
    raise FeuilletonInvalide(f"lettre {n} absente du feuilleton")


# --------------------------------------------------------------------------- l'acquis


def charger_parcours(nom: str = PARCOURS, build: Path | None = None) -> dict[str, object]:
    """`data/work/build/parcours-<nom>.json`, tel que `wenlu build` l'écrit."""
    chemin = (build or BUILD) / f"parcours-{nom}.json"
    return json.loads(chemin.read_text(encoding="utf-8"))


def poses_par_jour(parcours: Mapping[str, object]) -> list[tuple[int, str]]:
    """Les caractères qu'un parcours pose, avec leur jour, dans l'ordre : brique puis composés."""
    out: list[tuple[int, str]] = []
    vus: set[str] = set()
    for jour in parcours.get("jours") or ():  # type: ignore[union-attr]
        for c in ([jour["brique"]] if jour.get("brique") else []) + list(jour.get("composes") or ()):
            if c and c not in vus:
                vus.add(str(c))
                out.append((int(jour["jour"]), str(c)))
    return out


def acquis_au_jour(jour: int, parcours: Mapping[str, object]) -> list[str]:
    """Les caractères posés par le parcours du jour 1 au jour `jour` compris, dans l'ordre."""
    return [c for j, c in poses_par_jour(parcours) if j <= jour]


def jour_de_lecture(caracteres: Iterable[str], parcours: Mapping[str, object]) -> int | None:
    """Le premier jour où tous ces caractères sont posés ; `None` si l'un ne l'est jamais."""
    jours = {c: j for j, c in poses_par_jour(parcours)}
    lus = [jours.get(c) for c in caracteres]
    if any(j is None for j in lus):
        return None
    return max((j for j in lus if j is not None), default=1)


# --------------------------------------------------------------------------- la lettre


@dataclass
class Lettre:
    """Une lettre du feuilleton, telle que l'import l'écrit."""

    n: int
    titre_fr: str
    titre_en: str
    resume_fr: str
    phrases: list[Phrase]
    glose: dict[str, Glose]
    generation: Generation
    statut: str = A_RELIRE
    parcours: str = PARCOURS

    @property
    def jour(self) -> int:
        return jour_de_lettre(self.n)

    @property
    def texte(self) -> str:
        return "".join(p.zh for p in self.phrases)

    @property
    def cle(self) -> str:
        return nom_de_lettre(self.n)

    def sinogrammes(self) -> list[str]:
        return [c for c in self.texte if est_sinogramme(c)]

    def en_json(self) -> dict[str, object]:
        return {
            "lettre": self.n,
            "parcours": self.parcours,
            "jour": self.jour,
            "titre_fr": self.titre_fr,
            "titre_en": self.titre_en,
            "resume_fr": self.resume_fr,
            "phrases": [{"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr, "en": p.en} for p in self.phrases],
            "glose": {zh: g.en_json() for zh, g in self.glose.items()},
            "generation": {
                "modele": self.generation.modele,
                "api": self.generation.api,
                "date": self.generation.date,
                "empreinte_invite": self.generation.empreinte_invite,
                "essais": self.generation.essais,
                "intrus": self.generation.intrus,
            },
            "statut": self.statut,
        }


def lettre_depuis_json(document: Mapping[str, object]) -> Lettre:
    """Relit une lettre écrite dans `data/sources/lettres-versions/`."""
    generation = document.get("generation") or {}
    phrases = document.get("phrases")
    glose = document.get("glose")
    if not isinstance(generation, dict) or not isinstance(phrases, list) or not isinstance(glose, dict):
        raise ValueError("lettre illisible : phrases, glose ou generation hors format")
    return Lettre(
        n=int(document.get("lettre", 0)),  # type: ignore[arg-type]
        titre_fr=str(document.get("titre_fr", "")),
        titre_en=str(document.get("titre_en", "")),
        resume_fr=str(document.get("resume_fr", "")),
        phrases=[Phrase(zh=p["zh"], pinyin=p["pinyin"], fr=p["fr"], en=str(p.get("en", ""))) for p in phrases],
        glose={
            str(zh): Glose(fr=str(g.get("fr", "")), pinyin=str(g.get("pinyin", "")), en=str(g.get("en", "")))
            for zh, g in glose.items()
        },
        generation=Generation(
            modele=str(generation.get("modele", "")),
            api=str(generation.get("api", "")),
            date=str(generation.get("date", "")),
            empreinte_invite=str(generation.get("empreinte_invite", "")),
            essais=int(generation.get("essais", 0)),
            intrus=list(generation.get("intrus") or []),
        ),
        statut=str(document.get("statut", A_RELIRE)),
        parcours=str(document.get("parcours", PARCOURS)),
    )


def chemin_lettre(n: int, dossier: Path | None = None) -> Path:
    return (dossier or VERSIONS) / f"{nom_de_lettre(n)}.json"


def ecrire_lettre(lettre: Lettre, dossier: Path | None = None) -> Path:
    chemin = chemin_lettre(lettre.n, dossier)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(lettre.en_json(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return chemin


def lire_lettre(chemin: Path) -> Lettre:
    return lettre_depuis_json(json.loads(chemin.read_text(encoding="utf-8")))


def lettres_ecrites(dossier: Path | None = None) -> list[Path]:
    """Les lettres écrites, dans l'ordre du feuilleton."""
    dossier = dossier or VERSIONS
    if not dossier.exists():
        return []
    return sorted(p for p in dossier.glob("*.json") if p.stem.isdigit())


def lettres(dossier: Path | None = None, statut: str | None = None) -> list[Lettre]:
    """Les lettres écrites, au statut donné s'il l'est."""
    lues = [lire_lettre(p) for p in lettres_ecrites(dossier)]
    return [l for l in lues if statut is None or l.statut == statut]


# --------------------------------------------------------------------------- validation


def ecarts_pinyin(lettre: Lettre, lectures: Mapping[str, Sequence[str]] | None = None) -> list[str]:
    """Une syllabe par sinogramme, tons du dictionnaire sans sandhi, et, si les lectures
    sont connues, chaque syllabe une lecture de son caractère (au ton plein ou neutre)."""
    from .pinyin import aligner

    ecarts: list[str] = []
    for i, p in enumerate(lettre.phrases, start=1):
        _syllabes(p.zh, p.pinyin, f"de la phrase {i}", ecarts)
        if lectures is not None and p.zh and aligner(p.zh, p.pinyin, lectures) is None:
            ecarts.append(f"phrase {i} : « {p.zh} » ne se lit pas « {p.pinyin} »")
    return ecarts


def ecarts_glose(lettre: Lettre) -> list[str]:
    """La glose couvre chaque sinogramme tel que le lecteur le découpe, au pinyin des phrases,
    avec un sens français et anglais ; aucune entrée hors du texte."""
    ecarts: list[str] = []
    non_sinogrammes = [zh for zh in lettre.glose if not zh or not all(est_sinogramme(c) for c in zh)]
    if non_sinogrammes:
        ecarts.append(f"glose sur autre chose que des sinogrammes : {' '.join(repr(z) for z in non_sinogrammes)}")
    absents: dict[str, None] = {}
    discordances: dict[str, str] = {}
    for i, p in enumerate(lettre.phrases, start=1):
        syllabes = p.pinyin.split()
        rang = {k: n for n, k in enumerate(k for k, c in enumerate(p.zh) if est_sinogramme(c))}
        alignee = len(syllabes) == len(rang)
        for position, entree in segmenter(p.zh, lettre.glose):
            if not entree:
                absents[p.zh[position]] = None
                continue
            attendu = lettre.glose[entree].pinyin
            if not alignee or not attendu or entree in discordances:
                continue
            debut = rang[position]
            lu = syllabes[debut : debut + len(entree)]
            if attendu.split() != lu:
                discordances[entree] = f"glose {entree} « {attendu} », « {' '.join(lu)} » dans la phrase {i}"
    if absents:
        ecarts.append(f"glose absente pour {' '.join(absents)}")
    hors_texte = [zh for zh in lettre.glose if zh and zh not in lettre.texte]
    if hors_texte:
        ecarts.append(f"glose hors du texte : {' '.join(hors_texte)}")
    ecarts += discordances.values()
    for manque, attribut in (("pinyin", "pinyin"), ("sens français", "fr"), ("sens anglais", "en")):
        sans = [zh for zh, g in lettre.glose.items() if not getattr(g, attribut).strip()]
        if sans:
            ecarts.append(f"glose sans {manque} : {' '.join(sans)}")
    mal_comptees = [zh for zh, g in lettre.glose.items() if g.pinyin.strip() and len(g.pinyin.split()) != len(zh)]
    if mal_comptees:
        ecarts.append(f"glose : pinyin sans une syllabe par caractère pour {' '.join(mal_comptees)}")
    return ecarts


def ecarts_forme(lettre: Lettre) -> list[str]:
    """Longueur, phrases traduites en français et en anglais, question finale."""
    ecarts: list[str] = []
    if not lettre.phrases:
        return ["aucune phrase"]
    longueur = len(lettre.sinogrammes())
    if not LONGUEUR_MIN <= longueur <= LONGUEUR_MAX:
        ecarts.append(f"longueur {longueur} hors de {LONGUEUR_MIN}–{LONGUEUR_MAX} sinogrammes")
    for nom, attribut in (("chinois", "zh"), ("français", "fr"), ("anglais", "en")):
        vides = [str(i) for i, p in enumerate(lettre.phrases, start=1) if not getattr(p, attribut).strip()]
        if vides:
            ecarts.append(f"{nom} absent : phrases {', '.join(vides)}")
    derniere = lettre.phrases[-1]
    if not derniere.zh.rstrip().endswith(QUESTION):
        ecarts.append("la lettre ne finit pas par une question (？)")
    if not derniere.fr.rstrip().endswith("?") or not derniere.en.rstrip().endswith("?"):
        ecarts.append("la question finale n'est pas traduite en question")
    return ecarts


def valider(
    lettre: Lettre,
    autorises: Iterable[str],
    lectures: Mapping[str, Sequence[str]] | None = None,
) -> Rapport:
    """Un caractère hors de l'acquis du jour est un rejet ; le reste, des écarts."""
    return Rapport(
        intrus=caracteres_hors_liste(lettre.texte, autorises),
        ecarts=ecarts_forme(lettre) + ecarts_pinyin(lettre, lectures) + ecarts_glose(lettre),
    )


# --------------------------------------------------------------------------- brouillons


@dataclass(frozen=True)
class Brouillon:
    """Une lettre rédigée à la main, telle que son rédacteur l'a écrite."""

    n: int
    empreinte: str
    phrases: list[Phrase]
    glose: dict[str, Glose]

    @property
    def nom(self) -> str:
        return nom_de_lettre(self.n)


def brouillon_depuis_json(document: object, *, empreinte: str, n: int | None = None) -> Brouillon:
    """Lit un brouillon déjà décodé. Relève tous les problèmes de format d'un coup."""
    nom = nom_de_lettre(n) if n is not None else "?"
    if not isinstance(document, dict):
        raise BrouillonInvalide(nom, ["attendu un objet JSON"])
    problemes: list[str] = []
    manquants = [k for k in CHAMPS_BROUILLON if k not in document]
    if manquants:
        problemes.append(f"champ manquant : {', '.join(manquants)}")
    inconnus = [k for k in document if k not in CHAMPS_BROUILLON]
    if inconnus:
        problemes.append(f"champ inconnu : {', '.join(inconnus)}")
    lettre = document.get("lettre")
    if "lettre" in document and (isinstance(lettre, bool) or not isinstance(lettre, int)):
        problemes.append("lettre : attendu un nombre, 1 à 12")
    elif n is not None and "lettre" in document and lettre != n:
        problemes.append(f"lettre vaut {lettre!r} dans un fichier nommé {nom}.json")

    phrases: list[Phrase] = []
    if "phrases" in document:
        brut = document["phrases"]
        if not isinstance(brut, list) or not brut:
            problemes.append("phrases : attendu une liste non vide d'objets {zh, pinyin, fr, en}")
        else:
            for rang, element in enumerate(brut, start=1):
                lu = _textes(element, ("zh", "pinyin", "fr", "en"), f"phrase {rang}", problemes)
                if lu is not None:
                    phrases.append(Phrase(**lu))
    glose: dict[str, Glose] = {}
    if "glose" in document:
        brut = document["glose"]
        if not isinstance(brut, list):
            problemes.append("glose : attendu une liste d'objets {zh, pinyin, fr, en}")
        else:
            for rang, element in enumerate(brut, start=1):
                lu = _textes(element, ("zh", "pinyin", "fr", "en"), f"glose {rang}", problemes)
                if lu is None:
                    continue
                if lu["zh"] in glose:
                    problemes.append(f"glose {rang} : {lu['zh']} déjà glosé")
                    continue
                glose[lu["zh"]] = Glose(fr=lu["fr"], pinyin=lu["pinyin"], en=lu["en"])
    if problemes:
        raise BrouillonInvalide(nom, problemes)
    return Brouillon(n=int(lettre), empreinte=empreinte, phrases=phrases, glose=glose)  # type: ignore[arg-type]


def chemin_brouillon(n: int, dossier: Path | None = None) -> Path:
    return (dossier or BROUILLONS) / f"{nom_de_lettre(n)}.json"


def lire_brouillon(chemin: Path) -> Brouillon:
    """Lit `data/sources/lettres-brouillons/<nn>.json`."""
    if not chemin.stem.isdigit():
        raise BrouillonInvalide(chemin.stem, [f"{chemin.name} : le fichier porte le numéro de la lettre, 01.json"])
    octets = chemin.read_bytes()
    try:
        document = json.loads(octets.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as erreur:
        raise BrouillonInvalide(chemin.stem, [f"JSON illisible : {erreur}"]) from erreur
    return brouillon_depuis_json(document, empreinte=empreinte_brouillon(octets), n=int(chemin.stem))


def brouillons_ecrits(dossier: Path | None = None) -> list[Path]:
    dossier = dossier or BROUILLONS
    if not dossier.exists():
        return []
    return sorted(p for p in dossier.glob("*.json"))


def _aujourdhui() -> str:
    return _maintenant()[:10]


@dataclass(frozen=True)
class Import:
    """Ce qu'a donné l'import d'un brouillon."""

    lettre: Lettre
    rapport: Rapport
    chemin: Path
    inchange: bool = False
    remplace: str | None = None


def importer_brouillon(
    brouillon: Brouillon,
    ep: Episode,
    autorises: Iterable[str],
    *,
    lectures: Mapping[str, Sequence[str]] | None = None,
    dossier: Path | None = None,
    horloge: Callable[[], str] = _aujourdhui,
) -> Import:
    """Lettre, `valider()`, écriture. Un brouillon inchangé ne réécrit rien."""
    chemin = chemin_lettre(brouillon.n, dossier)
    precedente = lire_lettre(chemin) if chemin.exists() else None
    lettre = Lettre(
        n=brouillon.n,
        titre_fr=ep.titre_fr,
        titre_en=ep.titre_en,
        resume_fr=ep.resume_fr,
        phrases=list(brouillon.phrases),
        glose=dict(brouillon.glose),
        generation=Generation(
            modele=MODELE_MANUEL,
            api=API_SESSION,
            date=horloge(),
            empreinte_invite=brouillon.empreinte,
            essais=precedente.generation.essais + 1 if precedente is not None else 1,
        ),
    )
    rapport = valider(lettre, autorises, lectures)
    if (
        precedente is not None
        and precedente.generation.empreinte_invite == brouillon.empreinte
        and precedente.generation.intrus == rapport.intrus
        and (precedente.titre_fr, precedente.titre_en, precedente.resume_fr)
        == (ep.titre_fr, ep.titre_en, ep.resume_fr)
    ):
        return Import(lettre=precedente, rapport=rapport, chemin=chemin, inchange=True)
    lettre.generation = replace(lettre.generation, intrus=rapport.intrus)
    lettre.statut = A_RELIRE if rapport.conforme else REJETE
    ecrire_lettre(lettre, dossier)
    return Import(
        lettre=lettre,
        rapport=rapport,
        chemin=chemin,
        remplace=precedente.statut if precedente is not None else None,
    )


# --------------------------------------------------------------------------- contexte


def contraintes() -> str:
    """Ce que `wenlu lettres importer` et `wenlu check` vérifient."""
    return f"""Contraintes.
Rejet, à l'import :
- chaque phrases[].zh : les seuls caractères posés par le parcours {PARCOURS} au jour 7n, \
et la ponctuation {PONCTUATION_CHINOISE} (paroles entre 「」) ; ni chiffre, ni lettre, \
aucun autre caractère, même dans un nom propre.
Écarts, bloquants dans `wenlu check` :
- longueur : {LONGUEUR_MIN} à {LONGUEUR_MAX} sinogrammes, ponctuation non comprise ;
- la dernière phrase est une question (？), à laquelle on répond d'un mot ; fr et en \
la traduisent en question ;
- pinyin de chaque phrase : une syllabe par sinogramme, séparées par une espace, en \
minuscules, tons du dictionnaire sans sandhi (一 yī, 不 bù), le ton neutre sans marque \
(朋友 péng you), les mots de position au ton neutre (后面 hòu mian, 这里 zhè li) sauf \
旁边 páng biān, 那边 nà biān, 这边 zhè biān ; chaque syllabe est une lecture du caractère ;
- fr et en de chaque phrase, rédigés pour un lecteur de chaque langue ;
- glose : une liste d'entrées {{zh, pinyin, fr, en}}, par caractère ou par mot, qui couvre \
chaque sinogramme tel que le lecteur découpe (à chaque position, l'entrée la plus longue \
qui commence là) ; pas d'entrée absente du texte ; le pinyin d'une entrée est celui des \
phrases ; fr et en en un à trois mots, dans le sens qu'a l'entrée ici.
Ton : Que écrit à un ami, raconte son voyage, pose une question ; naturel, chaleureux, \
jamais culpabilisant (ni reproche, ni « tu n'as pas… », ni compte de jours) ; ni emoji ni \
dragon. Aucune autre clé que {', '.join(CHAMPS_BROUILLON)}."""


def squelette(n: int) -> dict[str, object]:
    vide = {"zh": "", "pinyin": "", "fr": "", "en": ""}
    return {"lettre": n, "phrases": [dict(vide)], "glose": [dict(vide)]}


def decrire_contexte(
    ep: Episode,
    autorises: Sequence[str],
    *,
    nouveaux: Sequence[str] = (),
    precedentes: Sequence[Lettre] = (),
    brouillons: Path | None = None,
) -> list[str]:
    """Ce qu'un rédacteur doit savoir d'une lettre, en lignes à afficher."""
    chemin = chemin_brouillon(ep.n, brouillons)
    lignes = [
        f"== Lettre {ep.n} — « {ep.titre_fr} » / “{ep.titre_en}”, jour {ep.jour} du parcours {PARCOURS} ==",
        f"Ce qui s'y passe : {ep.resume_fr}",
        f"Longueur : {LONGUEUR_MIN} à {LONGUEUR_MAX} sinogrammes, ponctuation non comprise ; "
        "la dernière phrase est une question.",
        "",
        f"Les {len(autorises)} seuls caractères autorisés (acquis au jour {ep.jour}) :",
        "".join(autorises),
        f"Nouveaux cette semaine, à employer si possible : {''.join(nouveaux) or '—'}",
        "",
        "Les lettres d'avant :",
        *([f"  {l.n}. {l.texte}" for l in precedentes] or ["  (aucune)"]),
        "",
        contraintes(),
        "",
        f"Brouillon à écrire : {_relatif(chemin)}" + (" (existe déjà)" if chemin.exists() else ""),
        json.dumps(squelette(ep.n), ensure_ascii=False, indent=1),
    ]
    return lignes


# --------------------------------------------------------------------------- relecture


def exporter_relecture(
    *,
    dossier: Path | None = None,
    sortie: Path | None = None,
    horloge: Callable[[], str] = _maintenant,
) -> tuple[Path, int]:
    """Rassemble les lettres `a_relire` en un seul JSON, pour une page de relecture."""
    a_relire = lettres(dossier, A_RELIRE)
    document = {
        "date": horloge(),
        "source": _relatif(dossier or VERSIONS),
        "decisions": list(DECISIONS),
        "retour": '{"<n>": "relu" | "rejete", …}, appliqué par `wenlu lettres appliquer-relecture <fichier>`',
        "lettres": [
            {"cle": l.cle, **l.en_json(), "ecarts": ecarts_forme(l) + ecarts_pinyin(l) + ecarts_glose(l)}
            for l in a_relire
        ],
    }
    sortie = sortie or RELECTURE
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")
    return sortie, len(a_relire)


def appliquer_relecture(decisions: object, dossier: Path | None = None) -> list[Lettre]:
    """Applique `{"<n>": "relu" | "rejete"}`. Tout ou rien ; `null` : pas encore décidé.

    Une lettre rejetée aux contrôles (hors de l'acquis du jour) ne peut pas être relue :
    il faut corriger son brouillon et le réimporter.
    """
    if not isinstance(decisions, dict):
        raise RelectureInvalide(['attendu un objet JSON {"<n>": "relu" | "rejete"}'])
    problemes: list[str] = []
    retenues: list[tuple[Lettre, str]] = []
    for cle, statut in decisions.items():
        if statut is None:
            continue
        if not str(cle).isdigit():
            problemes.append(f"{cle} : clé attendue, le numéro de la lettre (1, 01…)")
            continue
        if statut not in DECISIONS:
            problemes.append(f"{cle} : décision {statut!r}, attendu {' ou '.join(DECISIONS)}")
            continue
        chemin = chemin_lettre(int(str(cle)), dossier)
        if not chemin.exists():
            problemes.append(f"{cle} : aucune lettre ({_relatif(chemin)})")
            continue
        lettre = lire_lettre(chemin)
        if statut == RELU and lettre.generation.intrus:
            problemes.append(
                f"{cle} : rejetée aux contrôles (hors de l'acquis : {' '.join(lettre.generation.intrus)}),"
                " à corriger avant relecture"
            )
            continue
        retenues.append((lettre, str(statut)))
    if problemes:
        raise RelectureInvalide(problemes)
    for lettre, statut in retenues:
        lettre.statut = statut
        ecrire_lettre(lettre, dossier)
    return [l for l, _ in retenues]


def _relatif(chemin: Path) -> str:
    try:
        return str(chemin.relative_to(RACINE))
    except ValueError:
        return str(chemin)


# --------------------------------------------------------------------------- export


def lettre_exportee(lettre: Lettre) -> dict[str, object]:
    """Une lettre telle que l'app la lit : texte, pinyin, traductions, glose triée."""
    return {
        "n": lettre.n,
        "jour": lettre.jour,
        "parcours": lettre.parcours,
        "titre_fr": lettre.titre_fr,
        "titre_en": lettre.titre_en,
        "phrases": [{"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr, "en": p.en} for p in lettre.phrases],
        "glose": {zh: lettre.glose[zh].en_json() for zh in sorted(lettre.glose)},
    }


def document(
    lues: Sequence[Lettre],
    *,
    en_tete: Mapping[str, object],
    statut: str | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `lettres.json` (relues) ou `apercu/lettres.json` (`statut` à relire).

    `semaine` rappelle la règle de l'app : une lettre au plus par semaine.
    """
    sorties = []
    for l in sorted(lues, key=lambda l: l.n):
        sortie = lettre_exportee(l)
        if statut is not None:
            sortie["statut"] = statut
        sorties.append(sortie)
    return {
        **en_tete,
        **({"statut": statut} if statut is not None else {}),
        "parcours": PARCOURS,
        "semaine": SEMAINE,
        "lettres": sorties,
    }


# --------------------------------------------------------------------------- contrôles


def controles(
    *,
    dossier: Path | None = None,
    brouillons: Path | None = None,
    feuilleton: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    destination: Path | None = None,
) -> list[Controle]:
    """Contrôles des lettres, pour `wenlu check`. Bloquants, sauf la relecture et le HSK.

    « acquis du jour » : aucune lettre n'emploie un caractère que le parcours Lire n'a pas
    posé au jour 7n. « feuilleton » : douze lettres, chacune dans le fil, chaque brouillon
    importé tel qu'il est écrit. « pinyin », « glose », « forme » : voir `valider`.
    « export » : `lettres.json` porte exactement les lettres relues, `apercu/lettres.json`
    exactement celles à relire, marquées. « relecture » compte ce qui reste à relire.
    « parcours HSK » dit à quel jour du parcours HSK chaque lettre devient lisible.
    """
    from . import export as export_mod
    from .cuisine import lectures as charger_lectures

    build = build or BUILD
    ecrites = lettres(dossier)

    def detail(fautes: Sequence[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    # Le fil et les brouillons.
    f_fil: list[str] = []
    try:
        fil = charger_feuilleton(feuilleton)
    except (FeuilletonInvalide, OSError) as erreur:
        fil = []
        f_fil.append(str(erreur))
    if fil and len(fil) != NOMBRE:
        f_fil.append(f"{len(fil)} lettres au feuilleton, pour {NOMBRE}")
    numeros = {e.n: e for e in fil}
    for l in ecrites:
        e = numeros.get(l.n)
        if e is None:
            f_fil.append(f"lettre {l.n} hors du feuilleton")
        elif (l.titre_fr, l.titre_en, l.resume_fr) != (e.titre_fr, e.titre_en, e.resume_fr):
            f_fil.append(f"lettre {l.n} : titre ou résumé différent du feuilleton, réimporter")
    par_numero = {l.n: l for l in ecrites}
    for chemin in brouillons_ecrits(brouillons):
        try:
            b = lire_brouillon(chemin)
        except BrouillonInvalide as erreur:
            f_fil.append(str(erreur))
            continue
        l = par_numero.get(b.n)
        if l is None or l.generation.empreinte_invite != b.empreinte:
            f_fil.append(f"brouillon {b.nom} pas importé tel qu'il est : `wenlu lettres importer`")
    manquantes = [str(e.n) for e in fil if e.n not in par_numero]
    if manquantes:
        f_fil.append(f"lettres pas encore écrites : {', '.join(manquantes)}")

    # L'acquis du jour.
    f_acq: list[str] = []
    parcours = None
    hsk = None
    if (build / f"parcours-{PARCOURS}.json").exists():
        parcours = charger_parcours(PARCOURS, build)
        for l in ecrites:
            intrus = caracteres_hors_liste(l.texte, acquis_au_jour(l.jour, parcours))
            if intrus:
                f_acq.append(f"lettre {l.n} (jour {l.jour}) : {' '.join(intrus)}")
    if (build / "parcours-hsk.json").exists():
        hsk = charger_parcours("hsk", build)

    lectures = charger_lectures(ingest)
    f_pin = [f"lettre {l.n} : {e}" for l in ecrites for e in ecarts_pinyin(l, lectures)]
    f_glo = [f"lettre {l.n} : {e}" for l in ecrites for e in ecarts_glose(l)]
    f_for = [f"lettre {l.n} : {e}" for l in ecrites for e in ecarts_forme(l)]
    rejetees = [str(l.n) for l in ecrites if l.statut == REJETE]
    if rejetees:
        f_for.append(f"lettres rejetées, à corriger : {', '.join(rejetees)}")
    inconnus = [f"lettre {l.n} : statut {l.statut!r}" for l in ecrites if l.statut not in STATUTS]
    f_for += inconnus

    # L'export.
    relues = {l.n for l in ecrites if l.statut == RELU}
    a_relire = {l.n for l in ecrites if l.statut == A_RELIRE}
    f_exp: list[str] = []
    dossiers = export_mod.versions_exportees(destination or export_mod.EXPORT)
    for d in dossiers:
        chemin = d / "lettres.json"
        if not chemin.exists():
            f_exp.append(f"{d.name} : lettres.json absent, lancer `wenlu export`")
            continue
        exportees = json.loads(chemin.read_text(encoding="utf-8")).get("lettres") or []
        vus = {int(x.get("n", 0)) for x in exportees}
        if vus != relues:
            f_exp.append(f"{d.name}/lettres.json : lettres {sorted(vus)}, relues {sorted(relues)}")
        if any("statut" in x for x in exportees):
            f_exp.append(f"{d.name}/lettres.json : une lettre y porte un statut")
        apercu = d / "apercu" / "lettres.json"
        if apercu.exists():
            doc = json.loads(apercu.read_text(encoding="utf-8"))
            sorties = doc.get("lettres") or []
            vus = {int(x.get("n", 0)) for x in sorties}
            if vus != a_relire:
                f_exp.append(f"{d.name}/apercu/lettres.json : lettres {sorted(vus)}, à relire {sorted(a_relire)}")
            if doc.get("statut") != A_RELIRE or any(x.get("statut") != A_RELIRE for x in sorties):
                f_exp.append(f"{d.name}/apercu/lettres.json : une lettre n'y est pas marquée à relire")
        elif a_relire:
            f_exp.append(f"{d.name} : apercu/lettres.json absent, {len(a_relire)} lettres à relire")

    # Le parcours HSK : à titre d'information.
    jours_hsk: list[str] = []
    if hsk is not None:
        poses_hsk = {c for _, c in poses_par_jour(hsk)}
        for l in ecrites:
            j = jour_de_lecture(dict.fromkeys(l.sinogrammes()), hsk)
            jamais = "".join(dict.fromkeys(c for c in l.sinogrammes() if c not in poses_hsk))
            jours_hsk.append(f"{l.n}→{j}" if j is not None else f"{l.n}→jamais ({jamais})")

    return [
        Controle(
            "lettres : feuilleton",
            not f_fil,
            detail(f_fil, f"{len(ecrites)} lettres sur {NOMBRE}, chacune dans le fil, brouillons importés"),
            bloquant=True,
        ),
        Controle(
            "lettres : acquis du jour",
            not f_acq,
            detail(f_acq, f"chaque lettre n'emploie que l'acquis du parcours {PARCOURS} au jour 7n")
            if parcours is not None
            else "aucun parcours construit : lancer `wenlu build`",
            bloquant=True,
        ),
        Controle(
            "lettres : pinyin",
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
            "lettres : glose",
            not f_glo,
            detail(f_glo, "chaque sinogramme glosé, au pinyin des phrases, en français et en anglais"),
            bloquant=True,
        ),
        Controle(
            "lettres : forme",
            not f_for,
            detail(
                f_for,
                f"{LONGUEUR_MIN} à {LONGUEUR_MAX} sinogrammes, traduites, une question pour finir",
            ),
            bloquant=True,
        ),
        Controle(
            "lettres : export",
            not f_exp,
            detail(f_exp, f"{len(relues)} lettres relues exportées, {len(a_relire)} dans l'aperçu")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
        Controle(
            "lettres : relecture",
            not a_relire,
            f"{len(a_relire)} lettres sur {len(ecrites)} restent à relire avant export",
        ),
        Controle(
            "lettres : parcours HSK",
            True,
            "au parcours HSK, lettre→jour où elle devient lisible : " + " ".join(jours_hsk)
            if jours_hsk
            else "aucun parcours HSK construit",
        ),
    ]


# --------------------------------------------------------------------------- cli

app = typer.Typer(help="Les lettres de Que : rédaction sans API, import, relecture, aperçu.")


def _parcours_ou_sortie() -> dict[str, object]:
    try:
        return charger_parcours(PARCOURS)
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu build` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur


@app.command("contexte")
def commande_contexte(n: list[int] = typer.Argument(..., help="Numéro de la lettre, 1 à 12.")) -> None:
    """Affiche l'acquis du jour 7n, les lettres d'avant, les contraintes et le squelette du brouillon."""
    parcours = _parcours_ou_sortie()
    fil = charger_feuilleton()
    ecrites = lettres()
    for numero in n:
        ep = episode(numero, fil)
        autorises = acquis_au_jour(ep.jour, parcours)
        avant = set(acquis_au_jour(ep.jour - SEMAINE, parcours))
        for ligne in decrire_contexte(
            ep,
            autorises,
            nouveaux=[c for c in autorises if c not in avant],
            precedentes=[l for l in ecrites if l.n < ep.n],
        ):
            typer.echo(ligne)


@app.command("importer")
def commande_importer(
    n: list[int] = typer.Argument(None, help="Numéros des lettres ; toutes les lettres par défaut."),
) -> None:
    """Valide les brouillons et écrit les lettres, à relire ou rejetées. Exige `build`."""
    from .cuisine import lectures as charger_lectures

    parcours = _parcours_ou_sortie()
    fil = charger_feuilleton()
    lectures = charger_lectures()
    chemins = [chemin_brouillon(x) for x in n] if n else brouillons_ecrits()
    rejets = 0
    for chemin in chemins:
        try:
            b = lire_brouillon(chemin)
            ep = episode(b.n, fil)
        except (BrouillonInvalide, FeuilletonInvalide, OSError) as erreur:
            typer.echo(f"refus : {erreur}", err=True)
            rejets += 1
            continue
        resultat = importer_brouillon(b, ep, acquis_au_jour(ep.jour, parcours), lectures=lectures)
        etat = "inchangée" if resultat.inchange else resultat.lettre.statut
        typer.echo(f"lettre {b.nom} : {etat}, {len(resultat.lettre.sinogrammes())} sinogrammes")
        if resultat.rapport.intrus:
            rejets += 1
            typer.echo(f"  hors de l'acquis du jour {ep.jour} : {' '.join(resultat.rapport.intrus)}")
        for ecart in resultat.rapport.ecarts:
            typer.echo(f"  écart : {ecart}")
    if rejets:
        raise typer.Exit(code=1)


@app.command("exporter-relecture")
def commande_exporter_relecture() -> None:
    """Rassemble les lettres à relire dans data/work/relecture-lettres.json."""
    chemin, nombre = exporter_relecture()
    typer.echo(f"{nombre} lettres à relire dans {chemin}.")


@app.command("appliquer-relecture")
def commande_appliquer_relecture(fichier: Path = typer.Argument(..., help='JSON {"<n>": "relu" | "rejete"}.')) -> None:
    """Applique la relecture humaine : relu ou rejeté, lettre par lettre."""
    try:
        appliquees = appliquer_relecture(json.loads(fichier.read_text(encoding="utf-8")))
    except (RelectureInvalide, OSError, json.JSONDecodeError) as erreur:
        typer.echo(str(erreur), err=True)
        raise typer.Exit(code=1) from erreur
    for l in appliquees:
        typer.echo(f"lettre {l.cle} : {l.statut}")


@app.command("apercu")
def commande_apercu() -> None:
    """Affiche chaque lettre écrite : son statut, son texte, sa traduction, pour relire."""
    for l in lettres():
        typer.echo(f"── {l.n}. {l.titre_fr} (jour {l.jour}, {l.statut}, {len(l.sinogrammes())} sinogrammes)")
        for p in l.phrases:
            typer.echo(f"{p.zh}\t{p.pinyin}\t{p.fr}")
    typer.echo(f"{len(lettres())} lettres.")
