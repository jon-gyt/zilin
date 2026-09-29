"""Les examens 科举 (épic 8, stories 8.1 et 8.2) : sources, contrôles, export.

Brief §8, « Les examens 科举 » : trente-sept examens, chacun à un palier de caractères
lus (au seuil de stabilité de Ma forêt, le compte du trophée Lire), passés dans un seul
ordre. Six examens à titre, ceux des Qing (县试 à 殿试), et trente et un 月课, « la leçon du
mois », qui n'en donnent aucun. Puis quatre nominations, sans examen, à un palier de
caractères lus (翰林, 探花, 榜眼, 状元).

Ce qu'on y lit : surtout des mises en situation jamais vues (une enseigne, un menu, un
billet, un court message, une note, une lettre), écrites avec les seuls caractères que le
chemin a posés au jour du palier, et quelques questions de revue de l'acquis, des types du
§7 sauf le tracé. Chaque examen a deux séries pour chacun des deux chemins, Lire et HSK :
la reprise prend l'autre. Un 月课 lit d'abord le tronçon, les caractères entrés depuis
l'examen précédent : chacune de ses questions en porte au moins un.

Sources, versionnées (`data/sources/examens/`) :

- `examens.tsv` : la liste des trente-sept examens, dans l'ordre (identifiant, sorte, nom,
  pinyin, ce qu'il était, palier, titre accordé, nombre de questions) ;
- `nominations.tsv` : les quatre rangs sans examen et leur palier de caractères lus ;
- `textes.tsv` : les phrases de Tao et toutes les lignes de l'écran de l'examen (8.3),
  avec leurs jetons ;
- `bang.tsv` : les noms inventés du 放榜 de chaque examen à titre, sur chaque chemin,
  écrits avec l'acquis du palier (maquette validée le 29 septembre 2026) ;
- `glossaire.tsv` : la glose partagée des séries, par caractère ou par mot, comme les trois
  lignes du pas Utiliser ; le lecteur découpe chaque texte par l'entrée la plus longue ;
- `<parcours>/<examen>.json` : les deux séries d'un examen sur un chemin, `generation`
  (la traçabilité), `relecture` (la décision qui fait foi), puis `series`.

Une série : `serie` (A ou B), `statut`, `supports` (les mises en situation : `id`,
`genre`, `contexte` {fr, en}, le surtitre qui se lit au-dessus de la question, avant la
réponse : il dit le genre du support, « Un message », « Un billet », jamais son contenu,
`lignes` [{zh, pinyin, fr, en}], `glose` facultative) et
`questions`. Une question a son `type`, sa `consigne` {fr, en}, ses `choix`, sa `reponse`
et `porte`, les caractères qui portent sa réponse (ils sont notés en révision). Les types :

- mises en situation, sur un `support` : `comprendre` (le sens de la mise en situation,
  quatre choix {fr, en}), `reperer` (toucher sur le support le mot qui dit…, quatre
  segments du support), `vrai_faux` (une `affirmation` {zh, pinyin, fr, en}, `reponse`
  vrai ou faux), `replique` (la bonne réponse à un message, quatre choix {zh, pinyin, fr,
  en}) ;
- revue de l'acquis, sur un `objet` {zh, pinyin, fr, en} : `sens` (le sens d'un caractère ou
  d'un mot, quatre choix {fr, en}), `caractere` (le caractère d'un sens, quatre caractères),
  `trou` (le caractère qui manque dans un mot, au rang `trou`), `ton` (la syllabe au bon
  ton, quatre tons de la même syllabe).

Rédaction : à la main, dans une session Claude Code, sans API ni clé (`generation`,
`modele` « rédaction manuelle », `api` « session Claude Code (sans API) »). `wenlu examens
contexte <parcours> <examen>` donne le jour du palier, l'acquis et le tronçon. Relecture :
le statut `relu` d'une série vient d'une décision du propriétaire, citée dans `relecture` ;
une série `a_relire` n'est pas exportée.

Contrôles (`wenlu check`), bloquants : « liste » (trente-sept examens dans l'ordre des
paliers, les six à titre à leurs paliers, les 月课 sur leur grille, jamais plus de 55
caractères d'un examen au suivant, les titres et les nominations dans l'ordre des rangs
du personnage, dix questions à titre et cinq au 月课, décision du propriétaire du 29
septembre 2026, « 10 et 5 », reçu à quatre sur cinq), « sources » (traçabilité, relecture,
format, textes de l'écran), « périmètre » (aucun caractère hors de l'acquis du jour du
palier sur ce chemin ; au 月课, chaque question porte un caractère du tronçon), « pinyin »,
« glose », « questions » (nombre, revue, types, choix, réponses, caractères portés),
« séries » (A et B, sans texte commun), « fuites » (rien de ce qui se lit avant de
répondre ne donne la réponse : le surtitre ne dit que le genre, ni lui ni la consigne ne
portent les mots de la bonne réponse, la consigne ne contient pas le caractère, le mot ou
la syllabe cherchés, ni la traduction d'une affirmation ; signalement du propriétaire du 29
septembre 2026), « couverture » (chaque examen jusqu'au palier
`COUVERTURE`, sur les deux chemins), « 放榜 » (les noms de la liste, dans l'acquis du
palier), « périmètre des traits » (le nom de chaque
examen se dessine depuis ses traits) et « export ». Signalés : la relecture, la forme des
choix (une bonne réponse bien plus longue que ses leurres, ou seule à aligner plusieurs
sens), et les examens au-delà qui n'ont pas encore de séries.

Licences : rien n'est tiré de CC-CEDICT ni de Make Me a Hanzi comme texte ; mises en
situation, traductions et glose sont rédigées pour l'app. Les lectures (Unihan, Make Me a
Hanzi, surcharges) ne servent qu'au contrôle du pinyin.
"""
from __future__ import annotations

import json
import re
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

DOSSIER = DATA / "sources" / "examens"
LISTE = DOSSIER / "examens.tsv"
NOMINATIONS = DOSSIER / "nominations.tsv"
TEXTES = DOSSIER / "textes.tsv"
BANG = DOSSIER / "bang.tsv"
GLOSSAIRE = DOSSIER / "glossaire.tsv"

#: Le fichier écrit par `wenlu export`, nommé par l'index.
FICHIER = "examens.json"

#: Les deux chemins, chacun avec ses séries.
PARCOURS: tuple[str, ...] = ("lire", "hsk")
#: Deux séries par examen et par chemin : la reprise prend l'autre.
SERIES: tuple[str, ...] = ("A", "B")

#: Les deux sortes d'examens.
TITRE = "titre"
YUEKE = "yueke"
SORTES: tuple[str, ...] = (TITRE, YUEKE)

#: Trente-sept examens : six à titre, trente et un 月课 (brief §8).
NOMBRE_EXAMENS = 37
NOMBRE_YUEKE = 31
#: Les six examens à titre, leur nom et leur palier (brief §8, décisions du 26 septembre 2026).
EXAMENS_A_TITRE: tuple[tuple[str, int], ...] = (
    ("县试", 50),
    ("府试", 100),
    ("院试", 200),
    ("乡试", 255),
    ("会试", 505),
    ("殿试", 805),
)
#: La grille des 月课 : 75 et 150, puis 255 + 50 n jusqu'à 1 755, sauf là où tombe un
#: examen à titre (505, 805), puis 1 800, le HSK 6.
GRILLE_YUEKE: tuple[int, ...] = (
    75,
    150,
    *(p for p in range(305, 1756, 50) if p not in dict(EXAMENS_A_TITRE).values()),
    1800,
)
#: D'un examen au suivant, jamais plus d'une cinquantaine de caractères (200 → 255 : 55).
ECART_MAX = 55
#: Le bout de la série, le HSK 6 (« Oui, 1 800 », 28 septembre 2026).
FIN = 1800

#: Les questions d'un examen : dix à titre, cinq au 月课 (décision du propriétaire du 29
#: septembre 2026, « 10 et 5 » ; le brief disait quinze et dix).
QUESTIONS: dict[str, int] = {TITRE: 10, YUEKE: 5}
#: Dont les questions de revue de l'acquis : trois à titre, une ou deux au 月课.
REVUE: dict[str, tuple[int, int]] = {TITRE: (3, 3), YUEKE: (1, 2)}
#: Reçu : quatre réponses sur cinq justes du premier essai (huit sur dix, quatre sur cinq).
REUSSITE: tuple[int, int] = (4, 5)

#: Les types de question : mises en situation, puis revue de l'acquis (§7, sans le tracé).
TYPES_SITUATION: tuple[str, ...] = ("comprendre", "reperer", "vrai_faux", "replique")
TYPES_REVUE: tuple[str, ...] = ("sens", "caractere", "trou", "ton")
TYPES: tuple[str, ...] = TYPES_SITUATION + TYPES_REVUE
#: Au moins trois types de mises en situation par série : « plusieurs types ».
TYPES_SITUATION_MIN = 3
#: Quatre choix, sauf au vrai ou faux.
CHOIX = 4
#: À partir de tant de questions à choix, la bonne réponse ne tombe pas toujours au même
#: rang (le ton, lui, range ses syllabes dans l'ordre des tons).
PLACES_MIN = 4

#: Ce que l'app sait dessiner à plat (8.3) : le genre de chaque support.
GENRES: tuple[str, ...] = (
    "enseigne",
    "pancarte",
    "menu",
    "etal",
    "billet",
    "message",
    "note",
    "lettre",
    "calendrier",
    "affiche",
)
#: Une réplique répond à ce qu'on vous écrit.
GENRES_REPLIQUE: tuple[str, ...] = ("message", "lettre", "note")

#: Jusqu'où les séries doivent être écrites, en palier, sur les deux chemins (bloquant) :
#: le 县试 et le 月课 de 75, le premier lot du backlog (8.1), puis le 府试 et le 月课 de 150.
COUVERTURE = 150

#: Les phrases de l'écran et de Tao, et les seuls jetons que chacune peut porter : le menu
#: et Clore, puis l'écran de l'examen (8.3), l'annonce, la question, le résultat, le 放榜.
JETONS_TEXTES: dict[str, frozenset[str]] = {
    "ouvert": frozenset({"examen", "lus"}),
    "ouvert_yueke": frozenset({"lus"}),
    "bouton": frozenset({"examen"}),
    "bouton_yueke": frozenset(),
    "menu_ouvert": frozenset({"examen", "palier"}),
    "menu_pause": frozenset(),
    "menu_repasser": frozenset({"examen"}),
    "attente": frozenset(),
    "tao_menu": frozenset({"examen"}),
    "tao_menu_attente": frozenset(),
    "tao_menu_recu": frozenset({"examen"}),
    "menu": frozenset(),
    "tao_avant": frozenset(),
    "donne_titre": frozenset({"sens", "titre"}),
    "donne_avec": frozenset({"palier", "sens", "suivant", "titre"}),
    "donne_yueke": frozenset(),
    "troncon": frozenset({"examen", "n"}),
    "troncon_plus": frozenset({"n"}),
    "regle_questions": frozenset({"questions", "supports"}),
    "regle_questions_yueke": frozenset({"questions"}),
    "regle_reussite": frozenset({"questions", "reussite"}),
    "regle_chrono": frozenset(),
    "regle_reprise": frozenset(),
    "regle_yueke": frozenset(),
    "genre_enseigne": frozenset(),
    "genre_pancarte": frozenset(),
    "genre_menu": frozenset(),
    "genre_etal": frozenset(),
    "genre_billet": frozenset(),
    "genre_message": frozenset(),
    "genre_note": frozenset(),
    "genre_lettre": frozenset(),
    "genre_calendrier": frozenset(),
    "genre_affiche": frozenset(),
    "commencer": frozenset(),
    "commencer_yueke": frozenset(),
    "reprendre": frozenset({"n"}),
    "quitter": frozenset(),
    "question_n": frozenset({"n", "questions"}),
    "kicker_revue": frozenset(),
    "vrai": frozenset(),
    "faux": frozenset(),
    "ta_reponse": frozenset(),
    "tao_attente": frozenset(),
    "juste": frozenset(),
    "rattrapee": frozenset(),
    "rattrapee_suite": frozenset(),
    "pas_celle": frozenset(),
    "encore": frozenset(),
    "vf_vrai": frozenset({"fr"}),
    "vf_faux": frozenset({"fr"}),
    "ko_replique": frozenset({"fr"}),
    "ko_ton": frozenset({"syllabe"}),
    "continuer": frozenset(),
    "voir_resultat": frozenset(),
    "resultat": frozenset(),
    "constat": frozenset({"justes", "questions"}),
    "recu": frozenset({"examen"}),
    "pas_encore": frozenset(),
    "tao_recu": frozenset(),
    "tao_recu_yueke": frozenset(),
    "tao_pas_encore": frozenset(),
    "a_revoir": frozenset({"ou"}),
    "a_revoir_un": frozenset({"ou"}),
    "rien_a_revoir": frozenset(),
    "points": frozenset({"justes", "points"}),
    "points_rattrapes": frozenset({"justes", "points", "rattrapees"}),
    "points_rattrape_un": frozenset({"justes", "points"}),
    "info_yueke": frozenset(),
    "voir_liste": frozenset(),
    "suite_titre": frozenset({"examen", "palier", "sens", "titre"}),
    "suite_yueke": frozenset({"examen", "palier", "titre"}),
    "retour_menu": frozenset(),
    "fangbang_kicker": frozenset(),
    "fangbang_retour": frozenset(),
    "sur_la_liste": frozenset({"nom"}),
    "ciblees": frozenset(),
    "croise_sur": frozenset({"ou"}),
    "ou_revue": frozenset(),
    "etat_a_revoir": frozenset(),
    "info_pause": frozenset(),
    "rien_perdu": frozenset(),
    "plaques_haoshe": frozenset(),
    "plaque_academie": frozenset(),
    "bang_entete": frozenset(),
}

#: Ce qu'aucun texte d'examen ne nomme : le dragon reste au décor de deux fêtes.
INTERDITS = re.compile(r"dragon|龙|龍", re.IGNORECASE)

COLONNES_LISTE = ("id", "sorte", "hz", "pinyin", "fr", "en", "palier", "titre", "questions", "source")
COLONNES_NOMINATIONS = ("rang", "palier", "source")
COLONNES_TEXTES = ("cle", "fr", "source")
COLONNES_BANG = ("parcours", "examen", "noms", "source")
#: Les noms d'un 放榜 : de quatre à huit, de deux ou trois caractères.
NOMS_BANG: tuple[int, int] = (4, 8)
LONGUEUR_NOM: tuple[int, int] = (2, 3)
COLONNES_GLOSSAIRE = ("zh", "pinyin", "fr", "en")
CHAMPS_FICHIER = ("examen", "parcours", "generation", "relecture", "series")
CHAMPS_SERIE = ("serie", "statut", "supports", "questions")
CHAMPS_SUPPORT = ("id", "genre", "contexte", "lignes", "glose")
CHAMPS_QUESTION = ("type", "support", "consigne", "objet", "trou", "affirmation", "choix", "reponse", "porte")
CHAMPS_PHRASE = ("zh", "pinyin", "fr", "en")
CHAMPS_SENS = ("fr", "en")

SOURCE_EXPORT = (
    "examens 科举 et 月课 : liste, mises en situation et questions rédigées pour l'app, sans API,"
    " dans le pipeline wenlu (`data/sources/examens/`)"
)


class ExamensInvalides(ValueError):
    """Une source des examens ne se lit pas : rien n'est exporté."""


def reussite(questions: int) -> int:
    """Les réponses justes du premier essai qu'il faut : quatre sur cinq, arrondi au-dessus."""
    justes, sur = REUSSITE
    return -(-questions * justes // sur)


# --------------------------------------------------------------------------- la liste


@dataclass(frozen=True)
class Examen:
    """Un examen de la liste : à titre ou 月课, son palier de caractères lus."""

    id: str
    sorte: str
    hz: str
    pinyin: str
    fr: str
    en: str
    palier: int
    titre: str
    questions: int
    source: str = ""
    numero: int = 0


@dataclass(frozen=True)
class Nomination:
    """Un rang sans examen, accordé à un palier de caractères lus."""

    rang: str
    palier: int
    source: str = ""
    numero: int = 0


def _entier(v: str) -> int | None:
    return int(v) if v.isdigit() else None


def charger_liste(chemin: Path | None = None) -> tuple[list[Examen], list[str]]:
    """`examens.tsv`, dans l'ordre du fichier, et les fautes de forme."""
    lignes, fautes = lire_tsv(chemin or LISTE)
    examens: list[Examen] = []
    for l in lignes:
        c = l.cellules
        if tuple(c) != COLONNES_LISTE:
            fautes.append(f"examens.tsv:{l.numero} : colonnes attendues {COLONNES_LISTE}")
            continue
        palier, questions = _entier(c["palier"]), _entier(c["questions"])
        if palier is None or questions is None:
            fautes.append(f"examens.tsv:{l.numero} : palier et questions, attendus des nombres")
            continue
        titre = "" if c["titre"] in ("", "—", "-") else c["titre"]
        examens.append(
            Examen(c["id"], c["sorte"], c["hz"], c["pinyin"], c["fr"], c["en"], palier, titre, questions, c["source"], l.numero)
        )
    return examens, fautes


def charger_nominations(chemin: Path | None = None) -> tuple[list[Nomination], list[str]]:
    """`nominations.tsv`, dans l'ordre du fichier, et les fautes de forme."""
    lignes, fautes = lire_tsv(chemin or NOMINATIONS)
    out: list[Nomination] = []
    for l in lignes:
        c = l.cellules
        if tuple(c) != COLONNES_NOMINATIONS:
            fautes.append(f"nominations.tsv:{l.numero} : colonnes attendues {COLONNES_NOMINATIONS}")
            continue
        palier = _entier(c["palier"])
        if palier is None:
            fautes.append(f"nominations.tsv:{l.numero} : palier, attendu un nombre")
            continue
        out.append(Nomination(c["rang"], palier, c["source"], l.numero))
    return out, fautes


def charger_textes(chemin: Path | None = None) -> tuple[dict[str, str], list[str]]:
    """`textes.tsv` : les phrases par clé, et les fautes de forme."""
    lignes, fautes = lire_tsv(chemin or TEXTES)
    out: dict[str, str] = {}
    for l in lignes:
        c = l.cellules
        if tuple(c) != COLONNES_TEXTES:
            fautes.append(f"textes.tsv:{l.numero} : colonnes attendues {COLONNES_TEXTES}")
            continue
        if c["cle"] in out:
            fautes.append(f"textes.tsv:{l.numero} : {c['cle']} en double")
            continue
        out[c["cle"]] = c["fr"]
    return out, fautes


def charger_bang(chemin: Path | None = None) -> tuple[dict[tuple[str, str], list[str]], list[str]]:
    """`bang.tsv` : les noms du 放榜 par (parcours, examen), et les fautes de forme.

    Absent : aucune liste (la couverture le dira).
    """
    c_ = chemin or BANG
    if not c_.exists():
        return {}, []
    lignes, fautes = lire_tsv(c_)
    out: dict[tuple[str, str], list[str]] = {}
    for l in lignes:
        c = l.cellules
        if tuple(c) != COLONNES_BANG:
            fautes.append(f"bang.tsv:{l.numero} : colonnes attendues {COLONNES_BANG}")
            continue
        cle = (c["parcours"], c["examen"])
        if cle in out:
            fautes.append(f"bang.tsv:{l.numero} : {c['parcours']}/{c['examen']} en double")
            continue
        if not c["source"].strip():
            fautes.append(f"bang.tsv:{l.numero} : source vide")
        out[cle] = c["noms"].split()
    return out, fautes


def fautes_bang(
    noms: Mapping[tuple[str, str], Sequence[str]],
    examens: Sequence[Examen],
    parcours: Mapping[str, Mapping[str, object]],
    jusqua: int = 0,
) -> list[str]:
    """Les listes du 放榜 : un examen à titre, quatre à huit noms, dans l'acquis du palier.

    `parcours` : les chemins construits ; `jusqua` : le palier jusqu'où chaque examen à titre
    du chemin doit avoir sa liste.
    """
    fautes: list[str] = []
    par_id = {e.id: e for e in examens}
    bas, haut = NOMS_BANG
    court, long_ = LONGUEUR_NOM
    for (nom, ex), liste in noms.items():
        ou = f"bang.tsv {nom}/{ex}"
        e = par_id.get(ex)
        if nom not in PARCOURS or e is None or e.sorte != TITRE:
            fautes.append(f"{ou} : attendu un chemin et un examen à titre")
            continue
        if not bas <= len(liste) <= haut:
            fautes.append(f"{ou} : {len(liste)} noms, attendu {bas} à {haut}")
        if len(set(liste)) != len(liste):
            fautes.append(f"{ou} : nom en double")
        for n in liste:
            if not court <= len(n) <= long_ or not all(est_sinogramme(c) for c in n):
                fautes.append(f"{ou} : {n}, attendu {court} ou {long_} sinogrammes")
            if INTERDITS.search(n):
                fautes.append(f"{ou} : pas de dragon")
        doc = parcours.get(nom)
        if doc is not None:
            autorises = acquis_du_palier(e.palier, doc)
            intrus = caracteres_hors_liste("".join(liste), autorises)
            if intrus:
                fautes.append(f"{ou} : hors de l'acquis du palier : {' '.join(intrus)}")
    for nom, doc in parcours.items():
        for e in examens:
            if e.sorte == TITRE and e.palier <= jusqua and jour_du_palier(e.palier, doc) is not None:
                if (nom, e.id) not in noms:
                    fautes.append(f"{nom} : {e.hz} sans liste du 放榜")
    return fautes


def fautes_liste(
    examens: Sequence[Examen],
    nominations: Sequence[Nomination],
    rangs: Sequence[str] | None = None,
) -> list[str]:
    """La liste suit le brief : trente-sept examens, leurs paliers, leurs titres, leurs questions.

    `rangs` : les titres des rangs du personnage, dans l'ordre (`data/sources/heros/`) ;
    les titres des examens puis les nominations doivent les suivre dans cet ordre.
    """
    fautes: list[str] = []
    if len(examens) != NOMBRE_EXAMENS:
        fautes.append(f"{len(examens)} examens pour {NOMBRE_EXAMENS}")
    ids = [e.id for e in examens]
    doubles = sorted({i for i in ids if ids.count(i) > 1})
    if doubles:
        fautes.append(f"identifiants en double : {', '.join(doubles)}")
    for e in examens:
        ou = f"examens.tsv:{e.numero} ({e.id})"
        if not re.fullmatch(r"[a-z]+(-[0-9]+)?", e.id):
            fautes.append(f"{ou} : identifiant hors forme")
        if e.sorte not in SORTES:
            fautes.append(f"{ou} : sorte {e.sorte!r}, attendu {' ou '.join(SORTES)}")
            continue
        if e.questions != QUESTIONS[e.sorte]:
            fautes.append(f"{ou} : {e.questions} questions, attendu {QUESTIONS[e.sorte]}")
        if not all(x.strip() for x in (e.hz, e.pinyin, e.fr, e.en, e.source)):
            fautes.append(f"{ou} : colonne vide")
        if e.sorte == YUEKE and (e.hz != "月课" or e.titre):
            fautes.append(f"{ou} : un 月课 s'appelle 月课 et ne donne aucun titre")
        if INTERDITS.search(" ".join((e.hz, e.fr, e.en))):
            fautes.append(f"{ou} : pas de dragon")
    paliers = [e.palier for e in examens]
    if paliers != sorted(set(paliers)):
        fautes.append("paliers non strictement croissants")
    ecarts = [b - a for a, b in zip([0, *paliers], paliers)]
    trop = [f"{a}→{b}" for a, b, d in zip([0, *paliers], paliers, ecarts) if d > ECART_MAX]
    if trop:
        fautes.append(f"écart de plus de {ECART_MAX} caractères : {', '.join(trop)}")
    if paliers and paliers[-1] != FIN:
        fautes.append(f"la série finit à {paliers[-1]}, attendu {FIN}")
    a_titre = [(e.hz, e.palier) for e in examens if e.sorte == TITRE]
    if a_titre != list(EXAMENS_A_TITRE):
        fautes.append(f"examens à titre {a_titre}, attendu {list(EXAMENS_A_TITRE)}")
    yueke = tuple(e.palier for e in examens if e.sorte == YUEKE)
    if yueke != GRILLE_YUEKE:
        fautes.append("les 月课 ne sont pas sur leur grille (75, 150, 255 + 50 n, 1 800)")
    if len(yueke) != NOMBRE_YUEKE:
        fautes.append(f"{len(yueke)} 月课 pour {NOMBRE_YUEKE}")
    # Les titres, puis les nominations, dans l'ordre des rangs du personnage.
    titres = [e.titre for e in examens if e.titre]
    ordre = titres + [n.rang for n in nominations]
    if rangs is not None:
        inconnus = [t for t in ordre if t not in rangs]
        if inconnus:
            fautes.append(f"titres hors des rangs du personnage : {' '.join(inconnus)}")
        elif [rangs.index(t) for t in ordre] != sorted(rangs.index(t) for t in ordre):
            fautes.append("titres et nominations hors de l'ordre des rangs")
        elif ordre and ordre != list(rangs[rangs.index(ordre[0]) :]):
            fautes.append("un rang après le premier titre n'a ni examen ni nomination")
    doubles_t = sorted({t for t in ordre if ordre.count(t) > 1})
    if doubles_t:
        fautes.append(f"rang accordé deux fois : {' '.join(doubles_t)}")
    np = [n.palier for n in nominations]
    if np != sorted(set(np)):
        fautes.append("paliers des nominations non strictement croissants")
    dernier_titre = max((e.palier for e in examens if e.titre), default=0)
    if np and np[0] <= dernier_titre:
        fautes.append("une nomination tombe avant le dernier examen à titre")
    return fautes


def fautes_textes(textes: Mapping[str, str]) -> list[str]:
    """Chaque phrase attendue, sans jeton inconnu, sans dragon."""
    fautes: list[str] = []
    for cle, jetons in JETONS_TEXTES.items():
        if not textes.get(cle, "").strip():
            fautes.append(f"textes.tsv : {cle} absent ou vide")
            continue
        inconnus = set(re.findall(r"\{([a-z_]+)\}", textes[cle])) - jetons
        if inconnus:
            fautes.append(f"textes.tsv : {cle}, jeton inconnu {', '.join(sorted(inconnus))}")
    for cle in textes:
        if cle not in JETONS_TEXTES:
            fautes.append(f"textes.tsv : clé inconnue {cle}")
        if INTERDITS.search(textes[cle]):
            fautes.append(f"textes.tsv : {cle}, pas de dragon")
        if textes[cle].count("**") % 2:
            fautes.append(f"textes.tsv : {cle}, gras ** sans sa fin")
        if CHRONO.search(textes[cle]):
            fautes.append(f"textes.tsv : {cle}, ni durée ni compte à rebours")
    return fautes


#: Ce qu'aucune ligne de l'examen ne compte : une durée, un compte à rebours. « Pas de
#: chronomètre » le dit sans en montrer un.
CHRONO = re.compile(r"\b(secondes?|minutes?|dans \{|il te reste|reste \d)", re.IGNORECASE)


def caracteres_dessines(examens: Iterable[Examen]) -> list[str]:
    """Les caractères des noms d'examen, que l'app dessine depuis leurs traits, triés."""
    return sorted({c for e in examens for c in e.hz if est_sinogramme(c)})


#: Les écritures des scènes de l'examen, dessinées depuis leurs traits : les plaques des
#: cellules du 号舍, celle du 书院, l'en-tête du 放榜.
TEXTES_DESSINES: tuple[str, ...] = ("plaques_haoshe", "plaque_academie", "bang_entete")


def caracteres_des_scenes(textes: Mapping[str, str]) -> list[str]:
    """Les caractères des écritures des scènes (`TEXTES_DESSINES`), triés."""
    return sorted({c for k in TEXTES_DESSINES for c in textes.get(k, "") if est_sinogramme(c)})


# --------------------------------------------------------------------------- les séries


@dataclass(frozen=True)
class Support:
    """Une mise en situation : une enseigne, un billet, un message…"""

    id: str
    genre: str
    contexte: tuple[str, str]
    lignes: tuple[Phrase, ...]
    glose: Mapping[str, Glose] = field(default_factory=dict)

    @property
    def zh(self) -> str:
        return "".join(l.zh for l in self.lignes)


@dataclass(frozen=True)
class Question:
    """Une question d'une série. `choix` : des {fr, en}, des {zh, pinyin, fr, en} ou des chaînes."""

    rang: int
    type: str
    consigne: tuple[str, str]
    choix: tuple[object, ...]
    reponse: int | bool
    porte: tuple[str, ...]
    support: str = ""
    objet: Phrase | None = None
    trou: int | None = None
    affirmation: Phrase | None = None

    @property
    def revue(self) -> bool:
        return self.type in TYPES_REVUE


@dataclass(frozen=True)
class Serie:
    """Une série d'un examen sur un chemin."""

    examen: str
    parcours: str
    serie: str
    statut: str
    supports: tuple[Support, ...]
    questions: tuple[Question, ...]

    def support(self, id: str) -> Support | None:
        return next((s for s in self.supports if s.id == id), None)

    def phrases(self, objets: bool = True) -> list[tuple[str, Phrase, Mapping[str, Glose]]]:
        """Chaque texte chinois de la série, avec l'endroit et la glose propre à son support.

        `objets=False` laisse de côté l'objet des questions de revue : il porte déjà son
        pinyin et son sens, et le lecteur ne le découpe pas.
        """
        out: list[tuple[str, Phrase, Mapping[str, Glose]]] = []
        for s in self.supports:
            out += [(f"support {s.id} ligne {i}", l, s.glose) for i, l in enumerate(s.lignes, start=1)]
        for q in self.questions:
            glose = (self.support(q.support).glose if self.support(q.support) else {}) if q.support else {}
            if q.affirmation is not None:
                out.append((f"question {q.rang} affirmation", q.affirmation, glose))
            if q.objet is not None and objets:
                out.append((f"question {q.rang} objet", q.objet, {}))
            if q.type == "replique":
                out += [
                    (f"question {q.rang} choix {k}", c, glose)
                    for k, c in enumerate(q.choix, start=1)
                    if isinstance(c, Phrase)
                ]
        return out

    def textes_zh(self) -> list[str]:
        """Tout ce que la série montre en chinois, choix compris."""
        out = [p.zh for _, p, _ in self.phrases()]
        for q in self.questions:
            if q.type in ("caractere", "trou", "reperer"):
                out += [str(c) for c in q.choix]
        return out


@dataclass(frozen=True)
class Fichier:
    """Les séries d'un examen sur un chemin, leur traçabilité, leur relecture."""

    examen: str
    parcours: str
    generation: Mapping[str, object]
    relecture: Mapping[str, object]
    series: tuple[Serie, ...]


def chemin_series(parcours: str, examen: str, dossier: Path | None = None) -> Path:
    return (dossier or DOSSIER) / parcours / f"{examen}.json"


def charger_glossaire(chemin: Path | None = None) -> dict[str, Glose]:
    """Le glossaire partagé. Refuse une entrée vide, doublée ou hors sinogrammes."""
    lignes, fautes = lire_tsv(chemin or GLOSSAIRE)
    glossaire: dict[str, Glose] = {}
    for ligne in lignes:
        c = ligne.cellules
        if tuple(c) != COLONNES_GLOSSAIRE:
            fautes.append(f"glossaire.tsv:{ligne.numero} : colonnes attendues {COLONNES_GLOSSAIRE}")
            continue
        if not all(c.values()):
            fautes.append(f"glossaire.tsv:{ligne.numero} : colonne vide")
            continue
        if not all(est_sinogramme(x) for x in c["zh"]):
            fautes.append(f"glossaire.tsv:{ligne.numero} : {c['zh']} n'est pas fait de sinogrammes")
            continue
        if c["zh"] in glossaire:
            fautes.append(f"glossaire.tsv:{ligne.numero} : {c['zh']} déjà glosé")
            continue
        glossaire[c["zh"]] = Glose(fr=c["fr"], pinyin=c["pinyin"], en=c["en"])
    if fautes:
        raise ExamensInvalides(" ; ".join(fautes))
    return glossaire


def _objet(valeur: object, cles: Sequence[str], nom: str, fautes: list[str], facultatives: Sequence[str] = ()) -> dict[str, object] | None:
    """Un objet JSON aux clés attendues, chaînes non vides ; relève chaque écart."""
    if not isinstance(valeur, dict):
        fautes.append(f"{nom} : attendu un objet {{{', '.join(cles)}}}")
        return None
    manquantes = [k for k in cles if not isinstance(valeur.get(k), str) or not str(valeur[k]).strip()]
    inconnues = [k for k in valeur if k not in cles and k not in facultatives]
    if manquantes:
        fautes.append(f"{nom} : {', '.join(manquantes)} manquant ou vide")
    if inconnues:
        fautes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
    if manquantes or inconnues:
        return None
    return dict(valeur)


def _phrase(valeur: object, nom: str, fautes: list[str]) -> Phrase | None:
    lu = _objet(valeur, CHAMPS_PHRASE, nom, fautes)
    return None if lu is None else Phrase(**{k: str(lu[k]).strip() for k in CHAMPS_PHRASE})


def _sens(valeur: object, nom: str, fautes: list[str]) -> tuple[str, str] | None:
    lu = _objet(valeur, CHAMPS_SENS, nom, fautes)
    return None if lu is None else (str(lu["fr"]).strip(), str(lu["en"]).strip())


def _gloses(brut: object, nom: str, fautes: list[str]) -> dict[str, Glose]:
    glose: dict[str, Glose] = {}
    for k, g in enumerate(brut or [], start=1):  # type: ignore[union-attr]
        p = _phrase(g, f"{nom} glose {k}", fautes)
        if p is None:
            continue
        if p.zh in glose:
            fautes.append(f"{nom} glose {k} : {p.zh} déjà glosé")
            continue
        glose[p.zh] = Glose(fr=p.fr, pinyin=p.pinyin, en=p.en)
    return glose


def _support(brut: object, nom: str, fautes: list[str]) -> Support | None:
    if not isinstance(brut, dict):
        fautes.append(f"{nom} : attendu un objet")
        return None
    inconnues = [k for k in brut if k not in CHAMPS_SUPPORT]
    if inconnues:
        fautes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
    id_ = brut.get("id")
    if not isinstance(id_, str) or not id_.strip():
        fautes.append(f"{nom} : id manquant")
        return None
    nom = f"{nom} ({id_})"
    genre = brut.get("genre")
    if genre not in GENRES:
        fautes.append(f"{nom} : genre {genre!r}, attendu l'un de {', '.join(GENRES)}")
    contexte = _sens(brut.get("contexte"), f"{nom} contexte", fautes)
    lignes = [_phrase(l, f"{nom} ligne {i}", fautes) for i, l in enumerate(brut.get("lignes") or [], start=1)]
    if not lignes:
        fautes.append(f"{nom} : aucune ligne")
    glose = _gloses(brut.get("glose"), nom, fautes)
    if contexte is None or any(l is None for l in lignes):
        return None
    return Support(id_, str(genre), contexte, tuple(l for l in lignes if l is not None), glose)


def _question(brut: object, rang: int, nom: str, fautes: list[str]) -> Question | None:
    if not isinstance(brut, dict):
        fautes.append(f"{nom} : attendu un objet")
        return None
    inconnues = [k for k in brut if k not in CHAMPS_QUESTION]
    if inconnues:
        fautes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
    type_ = brut.get("type")
    if type_ not in TYPES:
        fautes.append(f"{nom} : type {type_!r}, attendu l'un de {', '.join(TYPES)}")
        return None
    consigne = _sens(brut.get("consigne"), f"{nom} consigne", fautes)
    support = brut.get("support") or ""
    if type_ in TYPES_SITUATION and not support:
        fautes.append(f"{nom} : une mise en situation porte sur un support")
    if type_ in TYPES_REVUE and support:
        fautes.append(f"{nom} : une question de revue ne porte sur aucun support")
    objet = _phrase(brut["objet"], f"{nom} objet", fautes) if "objet" in brut else None
    if type_ in TYPES_REVUE and objet is None and "objet" not in brut:
        fautes.append(f"{nom} : une question de revue porte sur un objet {{zh, pinyin, fr, en}}")
    affirmation = _phrase(brut["affirmation"], f"{nom} affirmation", fautes) if "affirmation" in brut else None
    if type_ == "vrai_faux" and affirmation is None and "affirmation" not in brut:
        fautes.append(f"{nom} : un vrai ou faux porte une affirmation")
    trou = brut.get("trou")
    if type_ == "trou" and (isinstance(trou, bool) or not isinstance(trou, int) or trou < 0):
        fautes.append(f"{nom} : trou, attendu le rang du caractère caché")
        trou = None
    choix: list[object] = []
    brut_choix = brut.get("choix") or []
    if not isinstance(brut_choix, list):
        fautes.append(f"{nom} : choix, attendu une liste")
        brut_choix = []
    for k, c in enumerate(brut_choix, start=1):
        ou = f"{nom} choix {k}"
        if type_ in ("comprendre", "sens"):
            s = _sens(c, ou, fautes)
            if s is not None:
                choix.append(s)
        elif type_ == "replique":
            p = _phrase(c, ou, fautes)
            if p is not None:
                choix.append(p)
        elif isinstance(c, str) and c.strip():
            choix.append(c.strip())
        else:
            fautes.append(f"{ou} : attendu une chaîne")
    reponse = brut.get("reponse")
    if type_ == "vrai_faux":
        if not isinstance(reponse, bool):
            fautes.append(f"{nom} : reponse, attendu vrai ou faux")
            reponse = False
        if brut_choix:
            fautes.append(f"{nom} : un vrai ou faux n'a pas de choix")
    elif isinstance(reponse, bool) or not isinstance(reponse, int):
        fautes.append(f"{nom} : reponse, attendu le rang du bon choix")
        reponse = -1
    porte = brut.get("porte")
    if not isinstance(porte, list) or not all(isinstance(c, str) for c in porte):
        fautes.append(f"{nom} : porte, attendu une liste de caractères")
        porte = []
    if consigne is None:
        return None
    return Question(
        rang=rang,
        type=str(type_),
        consigne=consigne,
        choix=tuple(choix),
        reponse=reponse,  # type: ignore[arg-type]
        porte=tuple(porte),
        support=str(support),
        objet=objet,
        trou=trou if isinstance(trou, int) and not isinstance(trou, bool) else None,
        affirmation=affirmation,
    )


def fichier_depuis_json(document: object, parcours: str, examen: str) -> Fichier:
    """Lit un fichier de séries déjà décodé. Relève tous les problèmes de format d'un coup."""
    nom = f"{parcours}/{examen}"
    if not isinstance(document, dict):
        raise ExamensInvalides(f"{nom} : attendu un objet JSON")
    fautes: list[str] = []
    inconnues = [k for k in document if k not in CHAMPS_FICHIER]
    if inconnues:
        fautes.append(f"{nom} : clé inconnue {', '.join(inconnues)}")
    if document.get("parcours") != parcours:
        fautes.append(f"{nom} : parcours {document.get('parcours')!r} dans le fichier")
    if document.get("examen") != examen:
        fautes.append(f"{nom} : examen {document.get('examen')!r} dans le fichier")
    generation = document.get("generation")
    relecture = document.get("relecture")
    if not isinstance(generation, dict):
        fautes.append(f"{nom} : generation absente")
        generation = {}
    if not isinstance(relecture, dict):
        fautes.append(f"{nom} : relecture absente")
        relecture = {}
    series: list[Serie] = []
    brut = document.get("series")
    if not isinstance(brut, list):
        fautes.append(f"{nom} : series, attendu une liste")
        brut = []
    for k, s in enumerate(brut, start=1):
        ou = f"{nom} série {k}"
        if not isinstance(s, dict):
            fautes.append(f"{ou} : attendu un objet")
            continue
        inconnues = [c for c in s if c not in CHAMPS_SERIE]
        if inconnues:
            fautes.append(f"{ou} : clé inconnue {', '.join(inconnues)}")
        lettre = s.get("serie")
        if lettre not in SERIES:
            fautes.append(f"{ou} : serie {lettre!r}, attendu A ou B")
            continue
        ou = f"{nom} série {lettre}"
        statut = s.get("statut")
        if statut not in STATUTS:
            fautes.append(f"{ou} : statut {statut!r}")
        supports = [_support(x, f"{ou} support {i}", fautes) for i, x in enumerate(s.get("supports") or [], start=1)]
        questions = [
            _question(x, i, f"{ou} question {i}", fautes) for i, x in enumerate(s.get("questions") or [], start=1)
        ]
        series.append(
            Serie(
                examen,
                parcours,
                str(lettre),
                str(statut),
                tuple(x for x in supports if x is not None),
                tuple(x for x in questions if x is not None),
            )
        )
    lettres = [s.serie for s in series]
    doubles = sorted({x for x in lettres if lettres.count(x) > 1})
    if doubles:
        fautes.append(f"{nom} : séries en double {doubles}")
    if fautes:
        raise ExamensInvalides(" ; ".join(fautes))
    return Fichier(examen, parcours, generation, relecture, tuple(sorted(series, key=lambda s: s.serie)))


def charger_series(parcours: str, examen: str, dossier: Path | None = None) -> Fichier | None:
    """`data/sources/examens/<parcours>/<examen>.json`. Absent : `None`, rien d'écrit."""
    chemin = chemin_series(parcours, examen, dossier)
    if not chemin.exists():
        return None
    try:
        document = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ExamensInvalides(f"{parcours}/{chemin.name} : JSON illisible, {erreur}") from erreur
    return fichier_depuis_json(document, parcours, examen)


def fichiers_ecrits(dossier: Path | None = None) -> list[Path]:
    """Tous les fichiers de séries versionnés, dans un ordre fixe (pour l'empreinte)."""
    d = dossier or DOSSIER
    return sorted(p for nom in PARCOURS for p in (d / nom).glob("*.json"))


# --------------------------------------------------------------------------- l'acquis


def jour_du_palier(palier: int, parcours: Mapping[str, object]) -> int | None:
    """Le jour du chemin où entre le Ne caractère (brief §8) ; `None` au-delà du chemin."""
    poses = poses_par_jour(parcours)
    return poses[palier - 1][0] if 0 < palier <= len(poses) else None


def acquis_du_palier(palier: int, parcours: Mapping[str, object]) -> list[str]:
    """Ce que le chemin a posé au jour du palier : tout le jour où entre le Ne caractère."""
    jour = jour_du_palier(palier, parcours)
    return [] if jour is None else acquis_au_jour(jour, parcours)


def troncon(examen: Examen, examens: Sequence[Examen], parcours: Mapping[str, object]) -> list[str]:
    """Les caractères entrés depuis l'examen précédent, jusqu'au jour du palier compris."""
    avant = [e for e in examens if e.palier < examen.palier]
    deja = set(acquis_du_palier(avant[-1].palier, parcours)) if avant else set()
    return [c for c in acquis_du_palier(examen.palier, parcours) if c not in deja]


# --------------------------------------------------------------------------- la glose


def entrees(glossaire: Mapping[str, Glose], propre: Mapping[str, Glose]) -> dict[str, Glose]:
    """Le glossaire, précisé par la glose propre au support, qui passe devant."""
    return {**glossaire, **propre}


def segments(zh: str, toutes: Mapping[str, Glose]) -> list[str]:
    """Les mots d'un texte tels que le lecteur les découpe (un sinogramme sans glose, seul)."""
    return [e or zh[i] for i, e in segmenter(zh, toutes)]


def glose_de_la_serie(serie: Serie, glossaire: Mapping[str, Glose]) -> dict[str, Glose]:
    """Les seules entrées que le lecteur touchera dans la série, triées."""
    vues: dict[str, Glose] = {}
    for _, p, propre in serie.phrases(objets=False):
        toutes = entrees(glossaire, propre)
        for _, e in segmenter(p.zh, toutes):
            if e:
                vues[e] = toutes[e]
    return {zh: vues[zh] for zh in sorted(vues)}


# --------------------------------------------------------------------------- écarts


def _texte_de_question(q: Question, serie: Serie) -> str:
    """Tout le chinois d'une question : son support, son affirmation, son objet, ses choix."""
    morceaux: list[str] = []
    s = serie.support(q.support) if q.support else None
    if s is not None:
        morceaux.append(s.zh)
    for p in (q.affirmation, q.objet):
        if p is not None:
            morceaux.append(p.zh)
    for c in q.choix:
        if isinstance(c, Phrase):
            morceaux.append(c.zh)
        elif isinstance(c, str) and q.type != "ton":
            morceaux.append(c)
    return "".join(morceaux)


def caracteres_de_question(q: Question, serie: Serie) -> list[str]:
    """Les sinogrammes qu'une question montre, sans doublon, dans l'ordre."""
    return list(dict.fromkeys(c for c in _texte_de_question(q, serie) if est_sinogramme(c)))


def ecarts_perimetre(serie: Serie, autorises: Sequence[str], troncon_: Sequence[str] | None = None) -> list[str]:
    """Aucun caractère hors de l'acquis du palier ; au 月课, chaque question porte le tronçon."""
    ecarts: list[str] = []
    intrus = caracteres_hors_liste("".join(serie.textes_zh()), autorises)
    if intrus:
        ecarts.append(f"hors de l'acquis du palier : {' '.join(intrus)}")
    if troncon_ is not None:
        t = set(troncon_)
        sans = [str(q.rang) for q in serie.questions if not t & set(q.porte)]
        if sans:
            ecarts.append(f"questions sans caractère du tronçon parmi ceux qu'elles portent : {', '.join(sans)}")
    return ecarts


def ecarts_pinyin(serie: Serie, lectures: Mapping[str, Sequence[str]] | None = None) -> list[str]:
    """Une syllabe par sinogramme, tons du dictionnaire sans sandhi, chacune une lecture."""
    from .pinyin import aligner

    ecarts: list[str] = []
    for ou, p, _ in serie.phrases():
        _syllabes(p.zh, p.pinyin, f"de {ou}", ecarts)
        if lectures is not None and aligner(p.zh, p.pinyin, lectures) is None:
            ecarts.append(f"{ou} : « {p.zh} » ne se lit pas « {p.pinyin} »")
    return ecarts


def ecarts_glose(serie: Serie, glossaire: Mapping[str, Glose]) -> list[str]:
    """Chaque sinogramme couvert tel que le lecteur découpe, au pinyin de son texte."""
    ecarts: list[str] = []
    for ou, p, propre in serie.phrases(objets=False):
        toutes = entrees(glossaire, propre)
        syllabes = p.pinyin.split()
        rang = {k: n for n, k in enumerate(k for k, c in enumerate(p.zh) if est_sinogramme(c))}
        alignee = len(syllabes) == len(rang)
        for position, entree in segmenter(p.zh, toutes):
            if not entree:
                ecarts.append(f"{ou} : glose absente pour {p.zh[position]}")
                continue
            attendu = toutes[entree].pinyin.split()
            if len(attendu) != len(entree):
                ecarts.append(f"glose {entree} : pinyin sans une syllabe par caractère")
                continue
            if not alignee:
                continue
            lu = syllabes[rang[position] : rang[position] + len(entree)]
            if attendu != lu:
                ecarts.append(f"{ou} : {entree} glosé « {' '.join(attendu)} », lu « {' '.join(lu)} »")
    touchees = glose_de_la_serie(serie, glossaire)
    for s in serie.supports:
        inutiles = [zh for zh in s.glose if zh not in touchees or touchees[zh] != s.glose[zh]]
        if inutiles:
            ecarts.append(f"support {s.id} : glose propre jamais touchée : {' '.join(inutiles)}")
    return ecarts


def ecarts_questions(
    serie: Serie,
    examen: Examen,
    lectures: Mapping[str, Sequence[str]] | None = None,
    glossaire: Mapping[str, Glose] | None = None,
) -> list[str]:
    """Le nombre, la revue, les types, les choix, la réponse, les caractères portés."""
    from .pinyin import sans_ton

    ecarts: list[str] = []
    qs = serie.questions
    if len(qs) != examen.questions:
        ecarts.append(f"{len(qs)} questions pour {examen.questions}")
    bas, haut = REVUE.get(examen.sorte, (0, 0))
    revue = sum(1 for q in qs if q.revue)
    if not bas <= revue <= haut:
        ecarts.append(f"{revue} questions de revue, attendu {bas}" + (f" à {haut}" if haut != bas else ""))
    types = {q.type for q in qs if not q.revue}
    if len(types) < TYPES_SITUATION_MIN:
        ecarts.append(f"{len(types)} types de mise en situation, au moins {TYPES_SITUATION_MIN}")
    ids = [s.id for s in serie.supports]
    if len(set(ids)) != len(ids):
        ecarts.append("supports au même id")
    utilises = {q.support for q in qs}
    oisifs = [i for i in ids if i not in utilises]
    if oisifs:
        ecarts.append(f"supports sans question : {', '.join(oisifs)}")
    for q in qs:
        ou = f"question {q.rang} ({q.type})"
        s = serie.support(q.support) if q.support else None
        if q.support and s is None:
            ecarts.append(f"{ou} : support {q.support} inconnu")
        if q.type == "replique" and s is not None and s.genre not in GENRES_REPLIQUE:
            ecarts.append(f"{ou} : une réplique répond à un {' ou '.join(GENRES_REPLIQUE)}")
        if INTERDITS.search(" ".join((*q.consigne, *(str(c) for c in q.choix)))):
            ecarts.append(f"{ou} : pas de dragon")
        # Les choix : quatre, distincts, la réponse parmi eux.
        if q.type != "vrai_faux":
            cles = [c.zh if isinstance(c, Phrase) else c for c in q.choix]
            if len(q.choix) != CHOIX:
                ecarts.append(f"{ou} : {len(q.choix)} choix pour {CHOIX}")
            if len(set(map(str, cles))) != len(cles):
                ecarts.append(f"{ou} : choix en double")
            if not (isinstance(q.reponse, int) and 0 <= q.reponse < len(q.choix)):
                ecarts.append(f"{ou} : la réponse n'est pas un des choix")
                continue
        bonne = q.choix[q.reponse] if q.type != "vrai_faux" else None  # type: ignore[index]
        if q.type == "reperer" and s is not None and glossaire is not None:
            mots: set[str] = set()
            for l in s.lignes:
                mots |= set(segments(l.zh, entrees(glossaire, s.glose)))
            hors = [str(c) for c in q.choix if c not in mots]
            if hors:
                ecarts.append(f"{ou} : choix qui ne sont pas des mots du support : {' '.join(hors)}")
        if q.type in ("caractere", "trou"):
            longueurs = {len(str(c)) for c in q.choix}
            if len(longueurs) != 1:
                ecarts.append(f"{ou} : des choix de longueurs différentes")
        if q.type == "caractere" and q.objet is not None and bonne != q.objet.zh:
            ecarts.append(f"{ou} : la bonne réponse n'est pas l'objet {q.objet.zh}")
        if q.type == "trou" and q.objet is not None:
            if q.trou is None or q.trou >= len(q.objet.zh) or q.objet.zh[q.trou] != bonne:
                ecarts.append(f"{ou} : le bon choix n'est pas le caractère caché de {q.objet.zh}")
            elif any(q.objet.zh[: q.trou] + str(c) + q.objet.zh[q.trou + 1 :] == q.objet.zh for c in q.choix if c != bonne):
                ecarts.append(f"{ou} : un leurre refait le mot")
        if q.type == "ton" and q.objet is not None:
            syllabes = [str(c) for c in q.choix]
            if len(q.objet.zh) != 1:
                ecarts.append(f"{ou} : le ton se demande sur un seul caractère")
            if len({sans_ton(x) for x in syllabes}) != 1:
                ecarts.append(f"{ou} : les choix ne sont pas la même syllabe à des tons différents")
            if bonne != q.objet.pinyin:
                ecarts.append(f"{ou} : la bonne réponse n'est pas le pinyin de l'objet")
            if lectures is not None:
                lues = set(lectures.get(q.objet.zh, ()))
                if not lues:
                    ecarts.append(f"{ou} : lectures de {q.objet.zh} inconnues, la question ne se pose pas")
                elif bonne not in lues:
                    ecarts.append(f"{ou} : {bonne} n'est pas une lecture de {q.objet.zh}")
                autres = [x for x in syllabes if x != bonne and x in lues]
                if autres:
                    ecarts.append(f"{ou} : un leurre est une autre lecture de {q.objet.zh} : {' '.join(autres)}")
        # Les caractères portés : des sinogrammes que la question montre.
        if not q.porte:
            ecarts.append(f"{ou} : aucun caractère ne porte la réponse")
        montres = set(caracteres_de_question(q, serie))
        absents = [c for c in q.porte if not est_sinogramme(c) or c not in montres]
        if absents:
            ecarts.append(f"{ou} : caractères portés absents de la question : {' '.join(absents)}")
        if len(set(q.porte)) != len(q.porte):
            ecarts.append(f"{ou} : caractère porté en double")
    vf = [q.reponse for q in qs if q.type == "vrai_faux"]
    if len(vf) >= 2 and len(set(vf)) == 1:
        ecarts.append("les vrai ou faux ont tous la même réponse")
    places = [q.reponse for q in qs if q.type not in ("vrai_faux", "ton")]
    if len(places) >= PLACES_MIN and len(set(places)) == 1:
        ecarts.append("la bonne réponse est toujours à la même place")
    return ecarts


def ecarts_deux_series(a: Serie, b: Serie) -> list[str]:
    """La reprise prend l'autre série : aucun texte commun, aucune question de revue commune."""
    ecarts: list[str] = []
    textes_a = {p.zh for _, p, _ in a.phrases()}
    communs = sorted(t for t in {p.zh for _, p, _ in b.phrases()} if t in textes_a)
    if communs:
        ecarts.append(f"textes communs aux séries A et B : {' / '.join(communs[:3])}")
    revue_a = {(q.type, q.objet.zh) for q in a.questions if q.revue and q.objet is not None}
    revue_b = {(q.type, q.objet.zh) for q in b.questions if q.revue and q.objet is not None}
    if revue_a & revue_b:
        ecarts.append(f"questions de revue communes : {' '.join(sorted(z for _, z in revue_a & revue_b))}")
    return ecarts


# --------------------------------------------------------------------------- fuites


#: Les mots qui ne disent rien de la réponse : articles, pronoms, mots de question.
#: Seuls comptent ceux de plus de trois lettres, sans accents ni casse (`mots_significatifs`).
MOTS_VIDES: frozenset[str] = frozenset(
    """
    dans pour avec sans sous chez vers entre depuis pendant avant apres cette celui celle ceux
    celles leur leurs elle elles nous vous votre notre quel quelle quels quelles quoi quand
    comment pourquoi combien sont etre avoir fait font tout tous toute toutes tres plus moins
    aussi mais donc comme meme autre autres encore rien ceci cela dont etait sera peut veut dire
    touche the this that with from what when where which your
    """.split()
)
#: Au-delà de tant de fois la longueur du plus long leurre, et de tant de lettres de plus, la
#: bonne réponse se reconnaît à sa forme (signalé, pas bloquant : c'est un indice, pas une preuve).
FORME_RAPPORT = 1.5
FORME_ECART = 8


def mots_significatifs(texte: str) -> set[str]:
    """Les mots de plus de trois lettres et les nombres d'un texte français, hors mots vides.

    Sans accents ni casse, au singulier (un « s » ou un « x » final ôté au-delà de quatre
    lettres) : « Les yuans » et « 20 yuan » partagent « yuan ».
    """
    import unicodedata

    plat = unicodedata.normalize("NFD", texte.lower().replace("œ", "oe").replace("æ", "ae"))
    plat = "".join(c for c in plat if not unicodedata.combining(c))
    out: set[str] = set()
    for m in re.findall(r"[a-z]+|\d+", plat):
        if m.isdigit():
            out.add(m)
            continue
        if len(m) <= 3 or m in MOTS_VIDES:
            continue
        out.add(m[:-1] if len(m) > 4 and m[-1] in "sx" else m)
    return out


def _sens_du_choix(c: object) -> str:
    """Le français d'un choix : un sens, une réplique ; rien pour un caractère ou un mot."""
    if isinstance(c, Phrase):
        return c.fr
    if isinstance(c, tuple):
        return str(c[0])
    return ""


def _discriminants(bonne: str, autres: Sequence[str]) -> set[str]:
    """Les mots de la bonne réponse, sauf ceux que tous les leurres portent aussi."""
    mots = mots_significatifs(bonne)
    if autres:
        mots -= set.intersection(*(mots_significatifs(a) for a in autres))
    return mots


def ecarts_fuites(serie: Serie, glossaire: Mapping[str, Glose] | None = None) -> list[str]:
    """Rien de ce qui se lit avant de répondre ne donne la réponse (signalement du propriétaire,
    29 septembre 2026, « tu donnes les réponses dans les intitulés »).

    - Le surtitre (`contexte`) dit le genre du support, pas son contenu : aucun mot
      significatif de la traduction de ses lignes.
    - La réponse d'une question à choix en français (`comprendre`, `sens`, `replique`) ne se
      lit ni dans le surtitre ni dans la consigne : aucun de ses mots significatifs que les
      leurres n'ont pas aussi.
    - Au repérage, le sens du mot cherché (sa glose) ne se lit pas dans le surtitre.
    - Le caractère ou le mot cherché (`caractere`, `trou`, `reperer`), la syllabe cherchée
      (`ton`), n'est pas dans la consigne.
    - La consigne d'un vrai ou faux ne traduit pas l'affirmation.
    """
    ecarts: list[str] = []
    for s in serie.supports:
        communs = mots_significatifs(s.contexte[0]) & mots_significatifs(" ".join(l.fr for l in s.lignes))
        if communs:
            ecarts.append(
                f"support {s.id} : le surtitre « {s.contexte[0]} » dit le contenu ({', '.join(sorted(communs))}),"
                " il ne doit dire que le genre"
            )
    for q in serie.questions:
        ou = f"question {q.rang} ({q.type})"
        s = serie.support(q.support) if q.support else None
        surtitre = s.contexte[0] if s is not None else ""
        consigne = " ".join(q.consigne)
        choix_valide = q.type != "vrai_faux" and isinstance(q.reponse, int) and 0 <= q.reponse < len(q.choix)
        bonne = q.choix[q.reponse] if choix_valide else None  # type: ignore[index]
        autres = [c for k, c in enumerate(q.choix) if k != q.reponse]
        if bonne is not None and q.type in ("comprendre", "sens", "replique"):
            mots = _discriminants(_sens_du_choix(bonne), [_sens_du_choix(c) for c in autres])
            for nom, texte in (("le surtitre", surtitre), ("la consigne", q.consigne[0])):
                vus = sorted(mots & mots_significatifs(texte))
                if vus:
                    ecarts.append(f"{ou} : {nom} donne la réponse « {_sens_du_choix(bonne)} » ({', '.join(vus)})")
        if bonne is not None and q.type == "reperer" and s is not None and glossaire is not None:
            toutes = entrees(glossaire, s.glose)
            g = toutes.get(str(bonne))
            if g is not None:
                mots = _discriminants(g.fr, [toutes[str(c)].fr for c in autres if str(c) in toutes])
                vus = sorted(mots & mots_significatifs(surtitre))
                if vus:
                    ecarts.append(f"{ou} : le surtitre donne le mot cherché {bonne} « {g.fr} » ({', '.join(vus)})")
        if bonne is not None and q.type in ("caractere", "trou", "reperer", "ton") and str(bonne) in consigne:
            ecarts.append(f"{ou} : la consigne contient la réponse {bonne}")
        if q.type == "vrai_faux" and q.affirmation is not None:
            vus = sorted(mots_significatifs(q.affirmation.fr) & mots_significatifs(q.consigne[0]))
            if vus:
                ecarts.append(f"{ou} : la consigne traduit l'affirmation ({', '.join(vus)})")
    return ecarts


def signaux_forme(serie: Serie) -> list[str]:
    """La bonne réponse ne se reconnaît pas à sa forme : bien plus longue que tous ses leurres,
    ou seule à aligner plusieurs sens (« vache, bœuf » parmi « cheval », « main »).

    Signalé, pas bloquant : c'est un indice qu'un relecteur tranche.
    """
    out: list[str] = []
    for q in serie.questions:
        if q.type not in ("comprendre", "sens", "replique") or not isinstance(q.reponse, int):
            continue
        if not 0 <= q.reponse < len(q.choix):
            continue
        cle = (lambda c: c.zh) if q.type == "replique" else _sens_du_choix
        texte = cle(q.choix[q.reponse])
        autres = [cle(c) for k, c in enumerate(q.choix) if k != q.reponse]
        ou = f"question {q.rang} ({q.type}) : la bonne réponse, « {texte} »,"
        longueur = max((len(a) for a in autres), default=0)
        if autres and len(texte) > FORME_RAPPORT * longueur and len(texte) - longueur >= FORME_ECART:
            out.append(f"{ou} est bien plus longue que ses leurres ({len(texte)} signes pour {longueur} au plus)")
        elif q.type != "replique" and re.search(r"[,;]", texte) and not any(re.search(r"[,;]", a) for a in autres):
            out.append(f"{ou} est seule à aligner plusieurs sens")
    return out


def ecarts_glossaire(glossaire: Mapping[str, Glose], lectures: Mapping[str, Sequence[str]] | None) -> list[str]:
    """Chaque entrée du glossaire : une syllabe par caractère, chacune une lecture."""
    from .pinyin import aligner

    out: list[str] = []
    for zh, g in glossaire.items():
        if len(g.pinyin.split()) != len(zh):
            out.append(f"glossaire {zh} : pinyin « {g.pinyin} » sans une syllabe par caractère")
        elif lectures is not None and aligner(zh, g.pinyin, lectures) is None:
            out.append(f"glossaire {zh} : ne se lit pas « {g.pinyin} »")
        if INTERDITS.search(f"{g.fr} {g.en}"):
            out.append(f"glossaire {zh} : pas de dragon")
    return out


# --------------------------------------------------------------------------- export


def _choix_json(c: object) -> object:
    if isinstance(c, Phrase):
        return {"zh": c.zh, "pinyin": c.pinyin, "fr": c.fr, "en": c.en}
    if isinstance(c, tuple):
        return {"fr": c[0], "en": c[1]}
    return c


def _phrase_json(p: Phrase) -> dict[str, str]:
    return {"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr, "en": p.en}


def question_exportee(q: Question, serie: Serie) -> dict[str, object]:
    """Une question telle que l'app la pose, avec les caractères qu'elle montre (`caracteres`)."""
    out: dict[str, object] = {"type": q.type}
    if q.support:
        out["support"] = q.support
    out["consigne"] = {"fr": q.consigne[0], "en": q.consigne[1]}
    if q.objet is not None:
        out["objet"] = _phrase_json(q.objet)
    if q.trou is not None:
        out["trou"] = q.trou
    if q.affirmation is not None:
        out["affirmation"] = _phrase_json(q.affirmation)
    if q.type != "vrai_faux":
        out["choix"] = [_choix_json(c) for c in q.choix]
    out["reponse"] = q.reponse
    out["porte"] = list(q.porte)
    out["caracteres"] = caracteres_de_question(q, serie)
    return out


def serie_exportee(serie: Serie, glossaire: Mapping[str, Glose]) -> dict[str, object]:
    """Une série relue : ses supports, ses questions, la glose de tout ce qu'elle montre."""
    return {
        "supports": [
            {
                "id": s.id,
                "genre": s.genre,
                "contexte": {"fr": s.contexte[0], "en": s.contexte[1]},
                "lignes": [_phrase_json(l) for l in s.lignes],
            }
            for s in serie.supports
        ],
        "questions": [question_exportee(q, serie) for q in serie.questions],
        "glose": {zh: g.en_json() for zh, g in glose_de_la_serie(serie, glossaire).items()},
    }


def document(
    *,
    en_tete: Mapping[str, object],
    parcours: Mapping[str, Mapping[str, object]],
    racines: Mapping[str, str],
    dossier: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `examens.json` : la liste, les nominations, les séries relues."""
    d = dossier or DOSSIER
    examens, _ = charger_liste(d / LISTE.name)
    nominations, _ = charger_nominations(d / NOMINATIONS.name)
    textes, _ = charger_textes(d / TEXTES.name)
    bang, _ = charger_bang(d / BANG.name)
    lexique = charger_glossaire(d / GLOSSAIRE.name)
    par_parcours: dict[str, list[dict[str, object]]] = {}
    for nom in PARCOURS:
        doc = parcours.get(nom) or {}
        lignes: list[dict[str, object]] = []
        for e in examens:
            jour = jour_du_palier(e.palier, doc)
            if jour is None:
                continue
            fichier = charger_series(nom, e.id, d)
            series = {
                s.serie: serie_exportee(s, lexique)
                for s in (fichier.series if fichier else ())
                if s.statut == RELU
            }
            lignes.append(
                {
                    "examen": e.id,
                    "jour": jour,
                    "troncon": troncon(e, examens, doc),
                    "series": series,
                    "noms": bang.get((nom, e.id), []) if e.sorte == TITRE else [],
                }
            )
        par_parcours[nom] = lignes
    dessines = sorted({*caracteres_dessines(examens), *caracteres_des_scenes(textes)})
    return {
        **en_tete,
        "reussite": {"justes": REUSSITE[0], "sur": REUSSITE[1]},
        "examens": [
            {
                "id": e.id,
                "sorte": e.sorte,
                "hz": e.hz,
                "pinyin": e.pinyin,
                "fr": e.fr,
                "en": e.en,
                "palier": e.palier,
                "titre": e.titre or None,
                "questions": e.questions,
                "reussite": reussite(e.questions),
            }
            for e in examens
        ],
        "nominations": [{"rang": n.rang, "palier": n.palier} for n in nominations],
        "textes": dict(sorted(textes.items())),
        "parcours": par_parcours,
        "racines": {c: racines[c] for c in dessines if c in racines},
    }


def sources() -> list[tuple[str, Path]]:
    """Les fichiers lus par l'export, pour son empreinte."""
    return [
        ("examens-liste", LISTE),
        ("examens-nominations", NOMINATIONS),
        ("examens-textes", TEXTES),
        ("examens-bang", BANG),
        ("examens-glossaire", GLOSSAIRE),
    ] + [(f"examens:{p.parent.name}/{p.stem}", p) for p in fichiers_ecrits()]


# --------------------------------------------------------------------------- contrôles


def controles(
    *,
    dossier: Path | None = None,
    build: Path | None = None,
    ingest: Path | None = None,
    destination: Path | None = None,
    rangs: Sequence[str] | None = None,
    jusqua: int = COUVERTURE,
) -> list[Controle]:
    """Contrôles des examens, pour `wenlu check`. Bloquants, sauf la relecture et la suite."""
    from . import export as export_mod
    from .cuisine import lectures as charger_lectures
    from .fetes import traits_exportes

    d = dossier or DOSSIER
    build = build or BUILD
    if rangs is None:
        from . import heros as heros_mod

        rangs = [r.hz for r in heros_mod.charger().rangs]

    def detail(fautes: Sequence[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    examens, f_liste = charger_liste(d / LISTE.name)
    nominations, f_nom = charger_nominations(d / NOMINATIONS.name)
    f_liste = f_liste + f_nom + fautes_liste(examens, nominations, rangs)
    textes, f_txt = charger_textes(d / TEXTES.name)

    f_src: list[str] = f_txt + fautes_textes(textes)
    noms_bang, f_bang = charger_bang(d / BANG.name)
    chemins_construits: dict[str, Mapping[str, object]] = {}
    try:
        lexique = charger_glossaire(d / GLOSSAIRE.name)
    except (ExamensInvalides, OSError) as erreur:
        lexique = {}
        f_src.append(str(erreur))
    fichiers: dict[tuple[str, str], Fichier] = {}
    connus = {e.id for e in examens}
    for nom in PARCOURS:
        for chemin in sorted((d / nom).glob("*.json")):
            if chemin.stem not in connus:
                f_src.append(f"{nom}/{chemin.name} : examen inconnu")
                continue
            try:
                f = charger_series(nom, chemin.stem, d)
            except ExamensInvalides as erreur:
                f_src.append(str(erreur))
                continue
            if f is not None:
                fichiers[(nom, chemin.stem)] = f
    for (nom, ex), f in fichiers.items():
        if f.generation.get("api") != API_SESSION or f.generation.get("modele") != MODELE_MANUEL:
            f_src.append(f"{nom}/{ex} : generation, attendu « {MODELE_MANUEL} », « {API_SESSION} »")
        if any(s.statut == RELU for s in f.series) and not f.relecture.get("decision"):
            f_src.append(f"{nom}/{ex} : des séries relues sans la décision qui les relit")

    lectures = charger_lectures(ingest)
    par_id = {e.id: e for e in examens}
    f_per: list[str] = []
    f_pin: list[str] = ecarts_glossaire(lexique, lectures)
    f_glo: list[str] = []
    f_que: list[str] = []
    f_ser: list[str] = []
    f_fui: list[str] = []
    forme: list[str] = []
    f_cou: list[str] = []
    suite: list[str] = []
    construits = True
    for nom in PARCOURS:
        if not (build / f"parcours-{nom}.json").exists():
            construits = False
            continue
        doc = charger_parcours(nom, build)
        chemins_construits[nom] = doc
        sur_le_chemin = [e for e in examens if jour_du_palier(e.palier, doc) is not None]
        for e in sur_le_chemin:
            f = fichiers.get((nom, e.id))
            lettres = [s.serie for s in f.series] if f else []
            if e.palier <= jusqua and lettres != list(SERIES):
                f_cou.append(f"{nom} : {e.hz} {e.palier}, séries {''.join(lettres) or 'aucune'} pour AB")
        ecrits = sum(1 for e in sur_le_chemin if (nom, e.id) in fichiers)
        suite.append(f"{nom} : {ecrits} examens écrits sur {len(sur_le_chemin)} du chemin")
        for (p, ex), f in fichiers.items():
            if p != nom:
                continue
            e = par_id[ex]
            autorises = acquis_du_palier(e.palier, doc)
            if not autorises:
                f_per.append(f"{nom}/{ex} : le palier {e.palier} est au-delà du chemin")
                continue
            t = troncon(e, examens, doc) if e.sorte == YUEKE else None
            for s in f.series:
                ou = f"{nom}/{ex} {s.serie}"
                f_per += [f"{ou} : {x}" for x in ecarts_perimetre(s, autorises, t)]
                f_pin += [f"{ou} : {x}" for x in ecarts_pinyin(s, lectures)]
                f_glo += [f"{ou} : {x}" for x in ecarts_glose(s, lexique)]
                f_que += [f"{ou} : {x}" for x in ecarts_questions(s, e, lectures, lexique)]
                f_fui += [f"{ou} : {x}" for x in ecarts_fuites(s, lexique)]
                forme += [f"{ou} : {x}" for x in signaux_forme(s)]
            par_lettre = {s.serie: s for s in f.series}
            if set(par_lettre) == set(SERIES):
                f_ser += [f"{nom}/{ex} : {x}" for x in ecarts_deux_series(par_lettre["A"], par_lettre["B"])]
            elif e.palier <= jusqua:
                pass  # la couverture le dit déjà
            else:
                f_ser.append(f"{nom}/{ex} : séries {''.join(par_lettre)} pour AB")
    f_bang += fautes_bang(noms_bang, examens, chemins_construits, jusqua)

    relues = {
        (nom, ex): sorted(s.serie for s in f.series if s.statut == RELU) for (nom, ex), f in fichiers.items()
    }
    a_relire = sum(1 for f in fichiers.values() for s in f.series if s.statut == A_RELIRE)
    dessines = sorted({*caracteres_dessines(examens), *caracteres_des_scenes(textes)})
    f_trt: list[str] = []
    f_exp: list[str] = []
    dossiers = export_mod.versions_exportees(destination or export_mod.EXPORT)
    for v in dossiers:
        presents = traits_exportes(v)
        f_trt += [f"{v.name}:{c} sans traits" for c in dessines if c not in presents]
        chemin = v / FICHIER
        if not chemin.exists():
            f_exp.append(f"{v.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        sortie = json.loads(chemin.read_text(encoding="utf-8"))
        if [(x.get("id"), x.get("palier")) for x in sortie.get("examens") or ()] != [(e.id, e.palier) for e in examens]:
            f_exp.append(f"{v.name}/{FICHIER} : la liste exportée n'est pas celle des sources")
        if any(x.get("reussite") != reussite(int(x.get("questions", 0))) for x in sortie.get("examens") or ()):
            f_exp.append(f"{v.name}/{FICHIER} : règle de réussite hors de quatre sur cinq")
        for nom in PARCOURS:
            for ligne in (sortie.get("parcours") or {}).get(nom) or ():
                vues = sorted((ligne.get("series") or {}).keys())
                if vues != relues.get((nom, str(ligne.get("examen"))), []):
                    f_exp.append(f"{v.name}/{FICHIER} : {nom}/{ligne.get('examen')}, séries exportées et relues différentes")
                e_ = par_id.get(str(ligne.get("examen")))
                attendus = noms_bang.get((nom, e_.id), []) if e_ is not None and e_.sorte == TITRE else []
                if list(ligne.get("noms") or []) != attendus:
                    f_exp.append(f"{v.name}/{FICHIER} : {nom}/{ligne.get('examen')}, noms du 放榜 hors des sources")
        if (sortie.get("textes") or {}) != dict(sorted(textes.items())):
            f_exp.append(f"{v.name}/{FICHIER} : les textes exportés ne sont pas ceux des sources")
        index = json.loads((v / "index.json").read_text(encoding="utf-8"))
        if index.get("examens") != FICHIER:
            f_exp.append(f"{v.name} : index.json ne nomme pas {FICHIER}")

    sans_export = "aucun export écrit : lancer `wenlu export`"
    regle = ", ".join(f"{reussite(n)} sur {n}" for n in sorted(set(QUESTIONS.values())))
    return [
        Controle(
            "examens : liste",
            not f_liste,
            detail(
                f_liste,
                f"{len(examens)} examens de {examens[0].palier if examens else 0} à {FIN} caractères lus,"
                f" {len(nominations)} nominations ; reçu à {regle}",
            ),
            bloquant=True,
        ),
        Controle("examens : sources", not f_src, detail(f_src, "textes, glossaire et séries lisibles, traçables"), bloquant=True),
        Controle(
            "examens : périmètre",
            not f_per,
            detail(f_per, "chaque série n'emploie que l'acquis du palier sur son chemin ; au 月课, le tronçon")
            if construits
            else "aucun parcours construit : lancer `wenlu build`",
            bloquant=True,
        ),
        Controle(
            "examens : pinyin",
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
            "examens : glose",
            not f_glo,
            detail(f_glo, "chaque sinogramme glosé, au pinyin des textes, en français et en anglais"),
            bloquant=True,
        ),
        Controle(
            "examens : questions",
            not f_que,
            detail(f_que, "nombre, revue, types, quatre choix, réponse, caractères portés"),
            bloquant=True,
        ),
        Controle("examens : séries", not f_ser, detail(f_ser, "séries A et B sans texte commun"), bloquant=True),
        Controle(
            "examens : fuites",
            not f_fui,
            detail(
                f_fui,
                "le surtitre dit le genre, jamais le contenu ; ni le surtitre ni la consigne ne donnent la réponse",
            ),
            bloquant=True,
        ),
        Controle(
            "examens : forme des choix",
            not forme,
            detail(forme, "aucune bonne réponse ne se reconnaît à sa forme parmi ses leurres"),
        ),
        Controle(
            "examens : 放榜",
            not f_bang,
            detail(
                f_bang,
                f"{len(noms_bang)} listes de noms inventés, chacune dans l'acquis de son palier, jusqu'à {jusqua} caractères lus",
            ),
            bloquant=True,
        ),
        Controle(
            "examens : couverture",
            not f_cou,
            detail(f_cou, f"chaque examen jusqu'à {jusqua} caractères lus, séries A et B, sur les deux chemins"),
            bloquant=True,
        ),
        Controle(
            "examens : périmètre des traits",
            not f_trt,
            detail(f_trt, f"{len(dessines)} caractères des noms d'examen, tous dans les traits exportés")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
        Controle(
            "examens : export",
            not f_exp,
            detail(f_exp, f"{sum(len(v) for v in relues.values())} séries relues exportées") if dossiers else sans_export,
            bloquant=True,
        ),
        Controle("examens : relecture", not a_relire, f"{a_relire} séries restent à relire avant export"),
        Controle("examens : suite du chemin", True, " ; ".join(suite) or "aucun parcours construit"),
    ]


# --------------------------------------------------------------------------- cli

app = typer.Typer(help="Les examens 科举 et les 月课 : contexte de rédaction, aperçu.")


def _examen(identifiant: str) -> tuple[Examen, list[Examen]]:
    examens, _ = charger_liste()
    for e in examens:
        if e.id == identifiant:
            return e, examens
    typer.echo(f"examen inconnu : {identifiant} ({', '.join(e.id for e in examens[:4])}…)", err=True)
    raise typer.Exit(code=1)


@app.command("contexte")
def commande_contexte(
    parcours: str = typer.Argument(..., help="lire ou hsk"),
    examen: str = typer.Argument(..., help="Identifiant de l'examen (xianshi, yueke-75…)."),
) -> None:
    """Le jour du palier, l'acquis permis, le tronçon, et les séries déjà écrites."""
    e, examens = _examen(examen)
    try:
        doc = charger_parcours(parcours)
    except OSError as erreur:
        typer.echo(f"{erreur} — lancer `wenlu build` d'abord.", err=True)
        raise typer.Exit(code=1) from erreur
    jour = jour_du_palier(e.palier, doc)
    typer.echo(f"== {parcours}, {e.hz} ({e.id}), palier {e.palier}, {e.questions} questions, reçu à {reussite(e.questions)}")
    if jour is None:
        typer.echo("Au-delà du chemin : rien à écrire sur ce parcours.")
        return
    bas, haut = REVUE[e.sorte]
    typer.echo(f"Jour du palier : {jour} ; revue : {bas} à {haut} questions")
    typer.echo(f"Tronçon : {''.join(troncon(e, examens, doc))}")
    typer.echo(f"Acquis : {''.join(acquis_du_palier(e.palier, doc))}")
    f = charger_series(parcours, e.id)
    for s in f.series if f else ():
        typer.echo(f"Série {s.serie} ({s.statut}) : {len(s.questions)} questions, {len(s.supports)} supports")


@app.command("apercu")
def commande_apercu(
    parcours: str = typer.Argument("lire", help="lire ou hsk"),
    examen: str = typer.Argument("", help="Identifiant de l'examen ; tous par défaut."),
) -> None:
    """Chaque série écrite, support par support, question par question, pour relire."""
    examens, _ = charger_liste()
    for e in examens:
        if examen and e.id != examen:
            continue
        f = charger_series(parcours, e.id)
        for s in f.series if f else ():
            typer.echo(f"══ {e.hz} {e.palier} · {parcours} · série {s.serie} ({s.statut})")
            for sup in s.supports:
                typer.echo(f"── [{sup.id}] {sup.genre} : {sup.contexte[0]}")
                for l in sup.lignes:
                    typer.echo(f"   {l.zh}\t{l.pinyin}\t{l.fr}")
            for q in s.questions:
                tete = f"{q.rang:>2}. {q.type}" + (f" [{q.support}]" if q.support else "")
                typer.echo(f"{tete} {q.consigne[0]}")
                if q.objet is not None:
                    typer.echo(f"      objet : {q.objet.zh} {q.objet.pinyin} « {q.objet.fr} »")
                if q.affirmation is not None:
                    typer.echo(f"      {q.affirmation.zh} « {q.affirmation.fr} » → {'vrai' if q.reponse else 'faux'}")
                for k, c in enumerate(q.choix):
                    marque = "✓" if k == q.reponse else " "
                    texte = f"{c.zh} « {c.fr} »" if isinstance(c, Phrase) else (c[0] if isinstance(c, tuple) else c)
                    typer.echo(f"      {marque} {texte}")
                typer.echo(f"      porte : {''.join(q.porte)}")
