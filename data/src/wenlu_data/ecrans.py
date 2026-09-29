"""Les textes d'interface de huit écrans : « Lire le monde », les révisions, le personnage, la route, « Dis-le », Mon chemin, le dictionnaire, le maître Xing.

« Lire le monde » (Chercher) et le tableau des révisions : rapport comparatif du 28
septembre 2026, §2.5 et §2.6. « Mon personnage » et « La route devant » : les lignes des
examens 科举 (stories 8.5 et 8.6, brief §8, « Le personnage » et « La route devant »),
« Reste le 院试 », « Reçu au 院试 · encore 12 points », « examen ouvert ». « Dis-le » : la question
où l'on prononce un caractère acquis et son réglage « Dire les tons » (story 9.1, brief §10,
« L'oral par IA »), dont les phrases ne font jamais de reproche. « Mon chemin 路 » : l'image
du chemin, la pierre posée, les pavillons, les auberges et les rendez-vous (décisions du
propriétaire du 29 septembre 2026, maquette validée `maquettes/chemin.html`). Le maître Xing 杏 :
sa rencontre à la porte du 县试 et ses lignes du pas Apprendre, qui distinguent toujours
l'origine attestée du moyen mnémotechnique (décision du propriétaire du 29 septembre 2026).
Le dictionnaire 字典, premier onglet de Chercher (story 10.8, maquette
`maquettes/dictionnaire.html`) : la loupe, les résultats, les fiches ; il ne rédige jamais
d'origine, qui vient de la fiche relue avec son étiquette.
Chaque écran a sa source
versionnée, rédigée pour l'app et à relire, dans `data/sources/ecrans/<écran>.tsv` ;
`wenlu export` en tire `ecrans.json`, que l'index nomme par sa clé `ecrans`.

L'app ne rédige rien : elle lit `ecrans.json` (`app/src/lib/ecrans.ts`) et remplit les
jetons entre accolades. Chaque clé est déclarée ici avec ses jetons, et `wenlu check`
refuse une clé absente, doublée ou inconnue, un jeton de trop ou de moins, un emoji, un
dragon, et ce que la charte écarte de ces écrans : le temps passé, le classement, le
percentile (CLAUDE.md : « pas de points au temps passé, pas de classements »).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .anecdotes import _EMOJI
from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "ecrans"

#: Le fichier exporté, que l'index nomme par sa clé `ecrans`.
FICHIER = "ecrans.json"

#: Les écrans, leurs clés dans l'ordre de la source, et les jetons de chacune.
ECRANS: dict[str, dict[str, tuple[str, ...]]] = {
    "lire-le-monde": {
        "onglets": (),
        "onglet-caractere": (),
        "onglet-texte": (),
        "champ": (),
        "invite": (),
        "aide-iphone": (),
        "chargement": (),
        "compte": ("lus", "total"),
        "compte-un": ("lus", "total"),
        "sans-chinois": (),
        "legende": (),
        "dans": ("n",),
        "demain": (),
        "mots": (),
        "ouvrir": ("nom",),
        "effacer": (),
    },
    "revisions": {
        "entree": (),
        "entree-ligne": ("demain", "semaine"),
        "entree-vide": (),
        "retour": (),
        "titre": (),
        "venir-titre": (),
        "venir-ligne": ("n",),
        "venir-une": (),
        "venir-rien": (),
        "aujourdhui": (),
        "jours": (),
        "barre": ("jour", "n"),
        "barre-une": ("jour",),
        "retention-titre": (),
        "retention": ("jours", "mesure", "n", "cible"),
        "retention-peu": ("jours", "min"),
        "retention-mesure": ("mesure",),
        "retention-cible": ("cible",),
        "retention-reglage": (),
        "resistent-titre": (),
        "resistent-aide": ("jours",),
        "resistent-ligne": ("n",),
        "resistent-une": (),
        "resistent-rien": ("jours",),
    },
    "personnage": {
        "reste": ("examen",),
        "recu": ("examen", "n"),
        "recu-un": ("examen",),
        "palier": ("rang", "palier", "lus"),
        "ouvert": (),
        "bang": (),
        "bang-date": ("date",),
    },
    "route": {
        "examen": ("examen", "n"),
        "ouvert": (),
        "apres": (),
        "lus": ("lus", "n"),
    },
    "dire": {
        "label": (),
        "enonce": (),
        "appuie": (),
        "ecoute": (),
        "redire": (),
        "confidentialite": (),
        "nom-1": (),
        "nom-2": (),
        "nom-3": (),
        "nom-4": (),
        "nom-5": (),
        "allure-1": (),
        "allure-2": (),
        "allure-3": (),
        "allure-4": (),
        "allure-5": (),
        "juste": ("nom", "allure"),
        "autre": ("attendu", "allure", "entendu"),
        "conseil-1-2": (),
        "conseil-1-3": (),
        "conseil-1-4": (),
        "conseil-1-5": (),
        "conseil-2-1": (),
        "conseil-2-3": (),
        "conseil-2-4": (),
        "conseil-2-5": (),
        "conseil-3-1": (),
        "conseil-3-2": (),
        "conseil-3-4": (),
        "conseil-3-5": (),
        "conseil-4-1": (),
        "conseil-4-2": (),
        "conseil-4-3": (),
        "conseil-4-5": (),
        "redemander": (),
        "silence": (),
        "court": (),
        "sature": (),
        "passer": (),
        "resume": (),
        "etat-juste": (),
        "etat-autre": (),
        "etat-redemander": (),
        "legende-voix": (),
        "legende-modele": ("nom",),
        "prochaine": ("delai",),
        "ecouter": (),
        "suivant": (),
        "terminer": (),
        "essai": (),
        "retour": (),
        "reglage": (),
        "reglage-aide": (),
        "essayer": (),
        "essayer-aide": (),
        "refuse": (),
        "absent": (),
        "indisponible": (),
        "reecouter": (),
        "reecouter-aide": (),
        "voix": (),
        "voix-aide": (),
        "voix-appareil": (),
        "voix-enregistree": (),
        "voix-appareil-nom": ("nom",),
        "voix-sans-appareil": (),
        "voix-comment": (),
        "voix-etapes": (),
    },
    "chemin": {
        "case": (),
        "menu-faite": (),
        "menu-faite-plus": ("n",),
        "menu-faite-plus-une": (),
        "devant": (),
        "devant-voix": (),
        "tao-faite": (),
        "tao-clore": ("n",),
        "clore-titre": ("c",),
        "clore-deja": (),
        "clore-dessin": (),
        "semaine-voix": (),
        "serie-semaine": ("n",),
        "serie-semaine-une": (),
        "serie-semaine-pleine": ("n",),
        "cadeau-an": (),
        "titre": (),
        "aide": (),
        "lus": ("n",),
        "lus-un": (),
        "familles": ("n",),
        "familles-une": (),
        "jour": ("n",),
        "scene-voix": (),
        "devant-titre": (),
        "derriere-titre": (),
        "premier-jour": (),
        "sceau-jour": ("n",),
        "auberge-voix": ("nom",),
        "plus-voix": ("c", "n"),
        "plus-voix-un": ("c",),
        "repli": ("de", "a"),
        "repli-voix": ("de", "a"),
        "legende-lu": (),
        "legende-encours": (),
        "legende-avenir": (),
        "legende-jour": (),
        "rdv-prochain": (),
        "rdv-ce-jour": (),
        "semaine-titre": (),
        "semaine-aucune": (),
        "semaine-une": (),
        "semaine-n": ("n",),
        "semaine-pleine": (),
        "semaine-note": (),
        "liste": (),
        "retour": (),
        "retour-jeu": (),
        "famille-auberge": ("n",),
        "famille-voix": ("c",),
        "famille-sceau": ("lus", "n"),
        "famille-sceau-pose": (),
        "famille-par": ("c",),
        "famille-plus-voix": ("n",),
        "fiche-lu": (),
        "fiche-encours": (),
        "fiche-avenir": (),
        "fiche-pose": ("n",),
        "trophee-famille": (),
        "trophee-serie": (),
    },
    "dictionnaire": {
        "surtitre": ("caracteres", "mots"),
        "menu": (),
        "champ": (),
        "invite": (),
        "effacer-saisie": (),
        "ecrire": (),
        "aide": (),
        "chargement": (),
        "indisponible": (),
        "recentes": (),
        "recentes-effacer": (),
        "recentes-effacer-voix": (),
        "recentes-vide": (),
        "jour-titre": (),
        "jour-terme": ("nom", "fr"),
        "resultats": ("caracteres", "mots"),
        "caracteres": ("n",),
        "caracteres-un": ("n",),
        "mots": ("n",),
        "mots-un": ("n",),
        "premiers": ("n", "total"),
        "rien": ("q",),
        "titre-caracteres": (),
        "titre-mots": (),
        "tons": (),
        "tous": (),
        "ton": ("n",),
        "hsk": ("n",),
        "hors-hsk": (),
        "lu": (),
        "lue": (),
        "encours": (),
        "dans": ("n",),
        "hors": (),
        "statut-lu": (),
        "statut-encours": (),
        "statut-chemin": ("n",),
        "statut-chemin-un": (),
        "statut-jour": ("n",),
        "statut-hors": (),
        "retour": (),
        "lecture": (),
        "pause": (),
        "suivant": (),
        "revoir": (),
        "lire-voix": (),
        "pause-voix": (),
        "traits": ("n",),
        "trait": ("k", "n"),
        "ecouter": ("t",),
        "aussi": ("pinyin",),
        "sens-relecture": (),
        "pas-appris": (),
        "pas-appris-hsk": ("c", "n"),
        "pas-appris-hors-hsk": ("c",),
        "pas-appris-briques": ("lus", "n"),
        "briques": (),
        "norme": (),
        "role-sens": (),
        "role-son": (),
        "role-forme": (),
        "roles-a-venir": (),
        "decomposition-relecture": (),
        "brique-norme": (),
        "famille": (),
        "origine": (),
        "origine-a-venir": ("c",),
        "origine-source": (),
        "maitre": (),
        "comme-mot": (),
        "mots-titre": (),
        "mots-tous": ("n",),
        "exemples": (),
        "fin-lu": ("c",),
        "fin": ("c",),
        "mot-caracteres": (),
        "mot-toucher": (),
        "mot-ouvrir": ("c", "pinyin"),
        "mot-long": ("n",),
        "mot-lu": ("w",),
        "proches": (),
        "fin-mot": (),
        "ecrire-titre": (),
        "ecrire-kicker": (),
        "ecrire-saisie": (),
        "complet-titre": (),
        "complet-texte": (),
        "cat-N": (),
        "cat-V": (),
        "cat-Adj": (),
        "cat-Adv": (),
        "cat-M": (),
        "cat-Num": (),
        "cat-Pron": (),
        "cat-Prep": (),
        "cat-Conj": (),
        "cat-Aux": (),
        "cat-Intj": (),
        "cat-Prefix": (),
        "cat-Suffix": (),
        "cat-Phonetic": (),
    },
    "xing": {
        "kicker": (),
        "caractere": (),
        "nom": (),
        "pinyin": (),
        "sens": (),
        "presentation": (),
        "accueil": (),
        "roles": (),
        "bouton": (),
        "voix": (),
        "brique-atteste": (),
        "brique-mnemo": (),
        "brique-sans": (),
        "compose-atteste": (),
        "compose-mnemo": (),
        "compose-sans": (),
    },
}

#: Les sept jours de la semaine, du dimanche au samedi (`Date.getDay`), dans `revisions/jours`.
JOURS_SEMAINE = 7

#: Ce que ces écrans ne disent jamais : le temps passé, le classement, le percentile.
INTERDITS: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(motif, re.IGNORECASE), raison)
    for motif, raison in (
        (r"dragon|龙|龍", "un dragon, hors du décor des fêtes"),
        (r"\bminutes?\b|\bheures?\b|\bsecondes?\b|temps pass[ée]|chrono", "le temps passé"),
        (r"classement|class[ée]e?s?\b|percentile|\bmieux que\b|\bles autres\b|meilleur", "un classement"),
    )
)

#: Ce que « Dis-le » ne dit jamais : un reproche (étude du 29 septembre 2026, §5 ; CLAUDE.md :
#: Tao ne culpabilise jamais). Un conseil dit quoi faire, pas ce qui est manqué.
REPROCHES = re.compile(
    r"\b(?:faux|fausses?|erreurs?|rat[ée]e?s?|mauvaise?s?|échecs?|dommage|non|nulle?s?)\b", re.IGNORECASE
)

#: Les écrans dont les textes passent aussi le contrôle des reproches : « Dis-le », le
#: dictionnaire, que Xing tient après la rencontre, et le maître Xing, qui ne gronde jamais.
SANS_REPROCHE = ("dire", "dictionnaire", "xing")

#: Xing distingue toujours l'origine attestée du moyen mnémotechnique, sans jamais présenter
#: l'un pour l'autre (CLAUDE.md) : chaque ligne dit l'étiquette de sa fiche, et elle seule.
ATTESTE = re.compile(r"attest", re.IGNORECASE)
MNEMO = re.compile(r"mnémotechnique", re.IGNORECASE)


def fautes_etiquettes(cle: str, texte: str) -> list[str]:
    """Une ligne `-atteste` dit l'attestation, une `-mnemo` le moyen mnémotechnique, une
    `-sans` ni l'un ni l'autre ; jamais l'une pour l'autre."""
    fautes: list[str] = []
    dit_atteste, dit_mnemo = bool(ATTESTE.search(texte)), bool(MNEMO.search(texte))
    if cle.endswith("-atteste") and (not dit_atteste or dit_mnemo):
        fautes.append(f"{cle} doit dire l'origine attestée, et elle seule")
    elif cle.endswith("-mnemo") and (not dit_mnemo or dit_atteste):
        fautes.append(f"{cle} doit dire le moyen mnémotechnique, jamais une attestation")
    elif cle.endswith("-sans") and (dit_atteste or dit_mnemo):
        fautes.append(f"{cle} ne dit ni attesté ni mnémotechnique : la fiche n'a pas d'origine relue")
    return fautes

JETON = re.compile(r"\{([^{}]*)\}")

SOURCE_EXPORT = (
    "data/sources/ecrans/ : textes d'interface de « Lire le monde », du tableau des"
    " révisions, de « Mon personnage », de la route devant, de « Dis-le », de « Mon chemin »,"
    " du dictionnaire et du maître Xing,"
    " rédigés pour l'app (à relire)"
)


def chemin(ecran: str) -> Path:
    """La source d'un écran."""
    return DOSSIER / f"{ecran}.tsv"


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Texte:
    cle: str
    fr: str
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Ecrans:
    """Les textes de chaque écran, et les fautes de forme des fichiers."""

    textes: dict[str, tuple[Texte, ...]]
    forme: tuple[str, ...] = field(default=())


def charger(dossier: Path | None = None) -> Ecrans:
    """Les textes de `data/sources/ecrans/`, écran par écran, dans l'ordre des fichiers."""
    textes: dict[str, tuple[Texte, ...]] = {}
    forme: list[str] = []
    for ecran in ECRANS:
        fichier = (dossier or DOSSIER) / f"{ecran}.tsv"
        if not fichier.exists():
            forme.append(f"{fichier.name} absent")
            textes[ecran] = ()
            continue
        lignes, fautes = lire_tsv(fichier)
        forme += fautes
        textes[ecran] = tuple(
            Texte(
                cle=l.cellules.get("cle", ""),
                fr=l.cellules.get("fr", ""),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in lignes
        )
    return Ecrans(textes=textes, forme=tuple(forme))


def sources() -> list[tuple[str, Path]]:
    """Les fichiers dont `ecrans.json` est tiré, pour l'empreinte de l'export."""
    return [(f"ecrans-{ecran}", chemin(ecran)) for ecran in ECRANS]


# ---------------------------------------------------------------------------- export


def document(en_tete: dict[str, object] | None = None, dossier: Path | None = None) -> dict[str, object]:
    """Le JSON écrit dans `ecrans.json` : l'en-tête, puis un objet par écran, les textes par clé."""
    e = charger(dossier)
    return {**(en_tete or {}), **{ecran: {t.cle: t.fr for t in e.textes[ecran]} for ecran in ECRANS}}


# ------------------------------------------------------------------------- contrôles


def jetons(texte: str) -> list[str]:
    """Les jetons d'un texte, dans l'ordre, sans doublon."""
    return list(dict.fromkeys(JETON.findall(texte)))


def interdits(texte: str) -> list[str]:
    """Ce que le texte dit de ce que ces écrans écartent : les raisons, sans doublon."""
    return [raison for motif, raison in INTERDITS if motif.search(texte)]


def fautes_sources(e: Ecrans) -> list[str]:
    """Chaque clé une fois, sourcée, avec ses jetons ; ni emoji, ni dragon, ni temps, ni classement."""
    fautes = list(e.forme)
    for ecran, attendues in ECRANS.items():
        textes = e.textes.get(ecran, ())
        cles = [t.cle for t in textes]
        for cle in attendues:
            if cles.count(cle) != 1:
                fautes.append(f"{ecran}.tsv : {cles.count(cle)} lignes pour {cle}, attendu une")
        for t in textes:
            ou = f"{ecran}.tsv:{t.numero}"
            if t.cle not in attendues:
                fautes.append(f"{ou} : clé inconnue {t.cle!r}")
                continue
            if not t.fr or not t.source:
                fautes.append(f"{ou} : texte incomplet ({t.cle})")
            if sorted(jetons(t.fr)) != sorted(attendues[t.cle]) or len(JETON.findall(t.fr)) != len(
                attendues[t.cle]
            ):
                voulus = ", ".join(attendues[t.cle]) or "aucun"
                fautes.append(f"{ou} : {t.cle} porte {jetons(t.fr) or 'aucun jeton'}, attendu {voulus}")
            if _EMOJI.search(t.fr):
                fautes.append(f"{ou} : {t.cle} porte un emoji")
            for raison in interdits(t.fr):
                fautes.append(f"{ou} : {t.cle} porte {raison}")
            reproche = REPROCHES.search(t.fr) if ecran in SANS_REPROCHE else None
            if reproche:
                fautes.append(f"{ou} : {t.cle} fait un reproche ({reproche.group(0)})")
            if ecran in ("xing", "dictionnaire"):
                fautes += [f"{ou} : {f}" for f in fautes_etiquettes(t.cle, t.fr)]
        jours = next((t.fr for t in textes if t.cle == "jours"), None)
        if jours is not None and len(jours.split()) != JOURS_SEMAINE:
            fautes.append(f"{ecran}.tsv : jours porte {len(jours.split())} noms, attendu {JOURS_SEMAINE}")
    return fautes


def fautes_export(sortie: dict[str, object], e: Ecrans) -> list[str]:
    """L'export dit les textes des sources, ni plus ni moins."""
    fautes: list[str] = []
    for ecran, attendues in ECRANS.items():
        bloc = sortie.get(ecran)
        if not isinstance(bloc, dict):
            fautes.append(f"{ecran} absent")
            continue
        voulu = {t.cle: t.fr for t in e.textes.get(ecran, ())}
        fautes += [f"{ecran}/{cle} absent" for cle in attendues if cle not in bloc]
        fautes += [
            f"{ecran}/{cle} n'est pas le texte des sources"
            for cle in attendues
            if cle in bloc and bloc[cle] != voulu.get(cle)
        ]
        fautes += [f"{ecran} : clé inconnue {cle!r}" for cle in sorted(set(bloc) - set(attendues))]
    return fautes


def controles(destination: Path | None = None, *, dossier: Path | None = None) -> list[Controle]:
    """Contrôles des textes d'écran, pour `wenlu check`. Tous bloquants.

    « sources » : chaque clé une fois, sourcée, avec exactement ses jetons, sans emoji, ni
    dragon, ni temps passé, ni classement ; à « Dis-le », aucun reproche. « export » : `ecrans.json` dit les textes des
    sources, et `index.json` le nomme.
    """
    from .export import versions_exportees

    e = charger(dossier)
    f_src = fautes_sources(e)
    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for d in dossiers:
        fichier = d / FICHIER
        if not fichier.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        sortie = json.loads(fichier.read_text(encoding="utf-8"))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sortie, e)]
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        if index.get("ecrans") != FICHIER:
            f_exp.append(f"{d.name} : index.json ne nomme pas {FICHIER}")

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    n = sum(len(t) for t in e.textes.values())
    return [
        Controle(
            "écrans : sources",
            not f_src,
            detail(
                f_src,
                f"{n} textes pour {len(ECRANS)} écrans, jetons attendus, ni temps passé ni classement,"
                " aucun reproche à « Dis-le » ni chez Xing, attesté et mnémotechnique distingués",
            ),
            bloquant=True,
        ),
        Controle(
            "écrans : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} dit les textes des sources")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
