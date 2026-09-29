"""Les fuites de réponse : rien de ce qui s'affiche avant la réponse ne la souffle.

Retour du propriétaire du 29 septembre 2026 : des intitulés donnaient la réponse. Une
fuite, c'est un texte montré avant qu'on réponde (une consigne, un énoncé, un titre, une
bulle de Tao) qui dit la réponse, ou un choix qui se désigne par sa seule forme. Les
écrans de l'app se contrôlent dans ses tests (Vitest) ; ici, les textes du pipeline qui
les alimentent, sur l'export, pour `wenlu check`. Tous bloquants.

- « fiches » : le sens d'une fiche ne cite pas son propre caractère. Il est l'énoncé des
  questions « caractère » et « tracé » (« Lequel se lit shén et veut dire « quoi (dans
  什么) » ? »), et la cible de l'assemblage.
- « devinettes » : l'énoncé d'une devinette ne cite ni la réponse, ni son pinyin, ni son
  sens (« Une femme, elle aussi » pour 她, « elle »). La devinette déguise les briques :
  qui lit le sens de la réponse n'a plus rien à deviner.
- « éclair » : les quatre sens d'un mot, tels que l'app les montre, sans parenthèses
  (`questions.sensDuChoix`), restent distincts, et aucun ne cite un caractère.
- « WeChat » : le titre d'un dialogue, montré avant et pendant la conversation, ne donne
  pas la bonne réplique d'un échange (« Retour après-demain » quand l'ami demande « Tu
  rentres demain ? » et qu'une réplique dit « demain », l'autre « après-demain »).
- « cuisine » : ce que Tao demande (« Il me faut de la viande ») ne cite aucun caractère.
- « Tao » : les phrases de sa bulle sur l'écran Jouer ne citent aucun caractère.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from .gf0014 import Controle
from .paths import EXPORT

#: Un sinogramme, clés et composants compris (⺈, 龶, 𠂇).
HAN = re.compile(r"[⺀-⿟㐀-䶿一-鿿豈-﫿\U00020000-\U0003134f]")

#: Un mot français : des lettres, et les traits d'union qui les lient (« après-demain »).
MOT = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*")

#: Les mots qui ne disent rien de la réponse : articles, pronoms, liaisons, oui et non.
MOTS_VIDES = frozenset(
    """
    a à au aux avec c ça ce ces cet cette d de des du en et est il ils j je l la le les
    lui m ma me mes moi n ne on ou où pas pour qu que qui s sa se ses si son sur t ta te
    tes toi ton tu un une y oui non bon bien très plus d'accord accord alors mais
    """.split()
)


def texte_normal(texte: str) -> str:
    """En minuscules, en NFC : « À demain » et « à demain » se comparent."""
    return unicodedata.normalize("NFC", texte).lower()


def mots(texte: str) -> list[str]:
    """Les mots d'un texte français, en minuscules ; l'élision tombe (« l'eau » : « l », « eau »)."""
    return MOT.findall(texte_normal(texte).replace("’", "'"))


def singulier(mot: str) -> str:
    """Le mot sans sa marque de pluriel : « heures » et « heure » se comparent."""
    return mot[:-1] if len(mot) > 3 and mot[-1] in "sx" else mot


def pleins(texte: str) -> set[str]:
    """Les mots qui portent un sens, au singulier : ni article, ni pronom, ni liaison."""
    return {singulier(m) for m in mots(texte) if m not in MOTS_VIDES and len(m) > 1}


def sans_parentheses(texte: str) -> str:
    """Le texte sans ce qui est entre parenthèses, comme l'app montre un choix de sens."""
    profondeur = 0
    sortie = []
    for x in texte:
        if x == "(":
            profondeur += 1
        elif x == ")":
            profondeur = max(0, profondeur - 1)
        elif profondeur == 0:
            sortie.append(x)
    net = re.sub(r"\s+([,;])", r"\1", "".join(sortie))
    net = re.sub(r"\s{2,}", " ", net).strip().rstrip(",;").strip()
    return net or texte.strip()


#: Les articles, qui tombent quand on compare un sens à un énoncé : « la terre », « terre ».
ARTICLES = frozenset("d de des du l la le les un une".split())


def segments_du_sens(sens: str) -> list[tuple[str, ...]]:
    """Chaque sens d'une glose, sans article : « la terre, le sol » donne (terre), (sol).

    Un pronom reste : il est le sens de 他 (« il, lui ») et de 她 (« elle »).
    """
    sortie: list[tuple[str, ...]] = []
    for morceau in re.split(r"[,;]", sans_parentheses(sens)):
        suite = tuple(m for m in mots(morceau) if m not in ARTICLES)
        if suite and suite not in sortie:
            sortie.append(suite)
    return sortie


def contient_suite(texte: str, suite: Sequence[str]) -> bool:
    """`texte` porte les mots de `suite`, d'affilée, articles mis à part."""
    tous = [m for m in mots(texte) if m not in ARTICLES]
    n = len(suite)
    return n > 0 and any(tuple(tous[i : i + n]) == tuple(suite) for i in range(len(tous) - n + 1))


def sans_tons(pinyin: str) -> str:
    """Le pinyin sans ses marques de ton : « míng » donne « ming »."""
    d = unicodedata.normalize("NFD", pinyin)
    return unicodedata.normalize("NFC", "".join(x for x in d if x not in "̄́̌̀"))


# --------------------------------------------------------------------------- fiches


def fautes_fiches(fiches: Iterable[Mapping[str, object]]) -> list[str]:
    """Le sens d'une fiche ne cite pas son propre caractère."""
    fautes: list[str] = []
    for f in fiches:
        c = str(f.get("c") or "")
        fr = str(f.get("fr") or "")
        if c and c in fr:
            fautes.append(f"{c} : son sens le cite ({fr})")
    return fautes


# ------------------------------------------------------------------------ devinettes


def fautes_devinettes(devinettes: Iterable[Mapping[str, object]]) -> list[str]:
    """L'énoncé ne cite ni la réponse, ni son pinyin, ni son sens."""
    fautes: list[str] = []
    for d in devinettes:
        c = str(d.get("c") or "")
        enonce = str(d.get("enonce") or "")
        zh = str(d.get("zh") or "")
        if c and (c in enonce or c in zh):
            fautes.append(f"{c} : l'énoncé cite la réponse")
        py = sans_tons(str(d.get("pinyin") or "")).lower()
        if len(py) > 1 and py not in MOTS_VIDES and py in mots(sans_tons(enonce)):
            fautes.append(f"{c} : l'énoncé cite son pinyin ({py})")
        for suite in segments_du_sens(str(d.get("sens") or "")):
            if contient_suite(enonce, suite):
                fautes.append(f"{c} : l'énoncé « {enonce} » dit son sens, « {' '.join(suite)} »")
    return fautes


# ---------------------------------------------------------------------------- éclair


def fautes_eclair(mots_eclair: Sequence[Mapping[str, object]]) -> list[str]:
    """Les quatre sens montrés, sans parenthèses, restent distincts, et aucun ne cite un caractère."""
    sens = {str(m.get("id") or m.get("mot") or ""): str(m.get("fr") or "") for m in mots_eclair}
    fautes: list[str] = []
    for m in mots_eclair:
        mot = str(m.get("mot") or "")
        choix = [str(m.get("fr") or "")] + [sens.get(str(x), "") for x in m.get("leurres") or []]  # type: ignore[union-attr]
        montres = [sans_parentheses(x) for x in choix if x]
        if len(set(montres)) != len(montres):
            fautes.append(f"{mot} : deux sens se confondent sans leurs parenthèses ({' | '.join(montres)})")
        for x in montres:
            if HAN.search(x):
                fautes.append(f"{mot} : le sens « {x} » cite un caractère")
    return fautes


# ---------------------------------------------------------------------------- WeChat


def fautes_wechat(dialogues: Iterable[Mapping[str, object]]) -> list[str]:
    """Le titre d'un dialogue ne donne pas la bonne réplique d'un échange.

    Un mot du titre fuit quand il est dans la traduction de la bonne réplique, absent
    d'une mauvaise (il les départage), et que rien de ce qui a déjà été lu ne le dit : ni
    les messages de l'ami jusqu'à celui de l'échange, ni les bonnes répliques d'avant.
    """
    fautes: list[str] = []
    for d in dialogues:
        titre = pleins(str(d.get("fr") or ""))
        lu: set[str] = set()
        for k, e in enumerate(d.get("echanges") or []):  # type: ignore[union-attr]
            ami = e.get("ami") or {}
            lu |= pleins(str(ami.get("fr") or ""))
            repliques = e.get("repliques") or []
            justes = [r for r in repliques if r.get("juste")]
            if not justes:
                continue
            juste = pleins(str(justes[0].get("fr") or ""))
            for r in repliques:
                if r.get("juste"):
                    continue
                fuite = sorted((titre & juste) - pleins(str(r.get("fr") or "")) - lu)
                if fuite:
                    fautes.append(
                        f"{d.get('id')} : le titre « {d.get('fr')} » donne la réplique de"
                        f" l'échange {k + 1} ({', '.join(fuite)})"
                    )
                    break
            lu |= juste
    return fautes


# ------------------------------------------------------------------ cuisine et Tao


def fautes_cuisine(recettes: Iterable[Mapping[str, object]]) -> list[str]:
    """Ce que Tao demande à l'étal ne cite aucun caractère."""
    fautes: list[str] = []
    for r in recettes:
        for i in r.get("ingredients") or []:  # type: ignore[union-attr]
            fr = str(i.get("fr") or "")
            if HAN.search(fr):
                fautes.append(f"{r.get('id')} : « Il me faut {fr} » cite un caractère")
    return fautes


def fautes_tao(phrases: Mapping[str, object]) -> list[str]:
    """La bulle de Tao sur l'écran Jouer ne cite aucun caractère."""
    return [f"{cle} : la bulle de Tao cite un caractère" for cle, fr in phrases.items() if HAN.search(str(fr))]


# ------------------------------------------------------------------------- contrôles


def _fiches(dossier: Path) -> list[dict[str, object]]:
    fiches: list[dict[str, object]] = []
    for chemin in sorted((dossier / "familles").glob("*.json")):
        fiches += json.loads(chemin.read_text(encoding="utf-8")).get("fiches") or []
    return fiches


def _lire(dossier: Path, nom: str) -> dict[str, object] | None:
    chemin = dossier / nom
    return json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else None


def controles(destination: Path | None = None) -> list[Controle]:
    """Contrôles des fuites de réponse, sur chaque export versionné. Tous bloquants."""
    from .export import versions_exportees

    dossiers = versions_exportees(destination or EXPORT)
    fautes: dict[str, list[str]] = {
        "fiches": [],
        "devinettes": [],
        "éclair": [],
        "WeChat": [],
        "cuisine": [],
        "Tao": [],
    }
    for d in dossiers:
        v = d.name
        fautes["fiches"] += [f"{v}:{f}" for f in fautes_fiches(_fiches(d))]
        if (doc := _lire(d, "devinettes.json")) is not None:
            fautes["devinettes"] += [f"{v}:{f}" for f in fautes_devinettes(doc.get("devinettes") or [])]  # type: ignore[arg-type]
        if (doc := _lire(d, "eclair.json")) is not None:
            fautes["éclair"] += [f"{v}:{f}" for f in fautes_eclair(doc.get("mots") or [])]  # type: ignore[arg-type]
        if (doc := _lire(d, "wechat.json")) is not None:
            fautes["WeChat"] += [f"{v}:{f}" for f in fautes_wechat(doc.get("dialogues") or [])]  # type: ignore[arg-type]
        if (doc := _lire(d, "cuisine.json")) is not None:
            fautes["cuisine"] += [f"{v}:{f}" for f in fautes_cuisine(doc.get("recettes") or [])]  # type: ignore[arg-type]
        if (doc := _lire(d, "jouer.json")) is not None:
            fautes["Tao"] += [f"{v}:{f}" for f in fautes_tao(doc.get("tao") or {})]  # type: ignore[arg-type]

    ok = {
        "fiches": "aucun sens ne cite son propre caractère",
        "devinettes": "aucun énoncé ne cite la réponse, son pinyin ou son sens",
        "éclair": "quatre sens distincts sans parenthèses, sans caractère",
        "WeChat": "aucun titre ne donne une réplique",
        "cuisine": "ce que Tao demande ne cite aucun caractère",
        "Tao": "la bulle de Tao ne cite aucun caractère",
    }

    def detail(liste: list[str], bien: str) -> str:
        if not dossiers:
            return "aucun export écrit : lancer `wenlu export`"
        return bien if not liste else f"{len(liste)} fuites — " + " ; ".join(liste[:5])

    return [
        Controle(f"fuites : {nom}", not liste, detail(liste, ok[nom]), bloquant=True)
        for nom, liste in fautes.items()
    ]
