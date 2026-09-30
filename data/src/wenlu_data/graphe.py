"""Graphe de dépendances, familles et ordre d'apprentissage par parcours.

Le graphe se lit dans `data/work/build/decompositions.json` (story 1.2), seule
source de la décomposition canonique. Un caractère dépend de ses composants
canoniques GF 0014-2009, et d'eux seuls : la norme découpe en un seul niveau,
le graphe est donc plat — une arête va d'un composant vers le caractère qui le
contient, et un composant de la norme est une feuille.

Trois genres de nœuds :

- `brique` : composant de la norme qui est aussi un caractère du dictionnaire.
  Il porte une fiche et se pose en une session. Dans `decompositions.json` il se
  reconnaît à sa décomposition réduite à lui-même (`composants == [c]`,
  `reconcilie`), puisque la réconciliation s'arrête sur un composant de la norme.
- `caractere` : caractère du dictionnaire qui n'est pas un composant de la norme.
  Il porte une fiche et se lit quand toutes ses briques sont acquises.
- `muette` : feuille sans fiche — composant sans point de code (les 30 de la
  norme, qui ne peuvent jamais être appariés à une feuille IDS) ou forme absente
  du dictionnaire, à commencer par `？`, la marque de Make Me a Hanzi pour un
  élément qu'il ne décompose pas. Une brique muette n'a rien à apprendre : elle
  est acquise d'entrée et signalée par `wenlu check`.
- `decoupee` : feuille sans fiche, comme une muette, mais dessinée — composant de
  la norme que `graphics.txt` ne dessine pas et que `data/sources/surcharges/
  decoupes.tsv` découpe dans un caractère hôte (`decoupes.py`). L'app en a les
  traits. Pour le parcours, elle reste acquise d'entrée : la poser comme une
  brique décalerait tous les jours, et avec eux l'acquis dont les phrases des
  fiches écrites dépendent. Elle n'est plus signalée comme muette.

Familles : la racine d'un caractère est sa première brique dans l'ordre
d'écriture — critère volontairement simple et déterministe, en attendant les
rôles son / sens de la story 1.4, qui donneront la brique de sens. À défaut de
brique, la première feuille du dictionnaire, puis la première feuille tout
court, puis le caractère lui-même. Une famille est une racine et tout ce
qu'elle engendre.

Parcours : « lire » suit le seuil 255, « hsk » le HSK 1 ; puis, sur les deux, le
HSK 3.0 niveau par niveau (HSK 2, 3, 4, 5, 6, 7-9), à partir de ce que le chemin n'a
pas encore posé (décision du propriétaire du 30 septembre 2026 : les seuils 405 à
1555 sont introuvables, les contes suivent déjà le HSK 3.0). Chaque liste est une
étape (`ETAPES`) : le chemin la termine avant de passer à la suivante, et la
première est le chemin gratuit (brief §10) ; les autres sont de Wenlu complet. Le
même graphe sert aux deux parcours ; seules les listes changent. L'ordre respecte
le tri topologique — une brique avant tout ce qui la contient — et, parmi les
candidats prêts, donne la priorité aux caractères de la liste de l'étape, puis à ce
qui devient lisible le jour même, puis à la fréquence.

Prolonger : `wenlu parcours prolonger` garde, jour pour jour, les jours déjà figés
d'un ordre, fermeture comprise, et calcule la suite, étape par étape, avec les mêmes
règles. Chaque étape se ferme par ses propres non réconciliés et absents : le 兴 du
seuil 255 garde son jour 190, celui du HSK 1 son jour 220.

Fréquence : Make Me a Hanzi ne fournit aucun rang de fréquence (`dictionary.txt`
n'a que `character`, `definition`, `pinyin`, `decomposition`, `radical`,
`etymology`, `matches`). Le repli documenté est donc le nombre de caractères du
dictionnaire qui dépendent du candidat : une brique très employée passe avant
une brique rare. `rangs_frequence` lit quand même un rang si l'ingestion vient
à en produire un, et il prend alors le pas.

Contrainte produit : une seule brique nouvelle par session de 10 minutes. Le
parcours est donc une suite de jours ; un jour est une brique nouvelle puis un
ou deux composés qui deviennent lisibles avec elle. Un jour sans brique
disponible est un jour de consolidation (`brique` nul). Les caractères de la
liste dont la décomposition n'est pas réconciliée ferment le parcours, marqués
`non_reconcilie` : ils ne sont jamais oubliés.

Ordre figé : depuis le 28 septembre 2026, l'ordre de chaque parcours n'est plus
recalculé à chaque build. Il est lu, jour par jour, dans un fichier versionné
(`data/sources/parcours/ordre-<nom>.tsv`), que `wenlu build` valide contre le graphe
— chaque brique posée une fois, chaque composé posé après toutes ses briques, toute la
liste cible couverte — et refuse s'il ne tient plus. Le calcul ci-dessous ne sert plus
qu'à proposer un ordre (`wenlu parcours figer`), que l'on relit puis versionne : un
changement de source ou de décomposition ne déplace plus aucun jour en silence, et les
textes écrits avec l'acquis du jour (phrases des fiches, lettres, WeChat, contes)
restent justes. Voir `docs/sources-licences.md` §10.

Départ : chaque parcours, « lire » comme « hsk », commence par ce que la première
session enseigne (brief §6, story 2.7) — 人, 大, 天, un jour chacun, sans composé. La première
session couvre ces trois jours d'un coup, et la session complète du lendemain
reprend au jour 4 (`app/src/lib/premiere.ts`). C'est la seule entorse à l'ordre
de priorité ; la règle d'une brique nouvelle par jour, elle, tient.

Rapport : `gf0014.build` écrit `ecarts.md` (réconciliation, IDS secondaire,
listes prioritaires) ; ce module y ajoute ensuite la section « Briques muettes »,
la seule qui demande le graphe.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Mapping, Sequence

from .gf0014 import Controle
from .outils import ecrire_json
from .paths import BUILD, DATA, INGEST

BRIQUE = "brique"
CARACTERE = "caractere"
MUETTE = "muette"
DECOUPEE = "decoupee"
#: Les feuilles sans fiche, acquises d'entrée par le parcours.
SANS_FICHE: tuple[str, ...] = (MUETTE, DECOUPEE)

# Une session de 10 minutes : une brique nouvelle, puis un ou deux composés.
COMPOSES_PAR_JOUR = 2

#: Les niveaux du HSK 3.0 (GF 0025-2021), dans l'ordre. Chaque fichier ne porte que les
#: caractères nouveaux de son niveau : le niveau se lit en cumul.
LISTES_HSK: tuple[str, ...] = ("hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9")

#: Les étapes de chaque parcours : ses listes, dans l'ordre où le chemin les pose. Une
#: étape se termine avant que la suivante commence ; une liste n'y apporte que ce que le
#: chemin n'a pas encore posé. La première est le chemin gratuit (brief §10 : le seuil 255
#: sur le chemin Lire, le HSK 1 sur le chemin HSK) ; la suite est de Wenlu complet.
#: Décision du propriétaire du 30 septembre 2026 : les deux chemins suivent le HSK 3.0
#: jusqu'au bout du HSK 7-9, le chemin Lire après son seuil 255.
ETAPES: dict[str, tuple[str, ...]] = {"lire": ("seuil-255", *LISTES_HSK), "hsk": LISTES_HSK}

#: La liste du chemin gratuit de chaque parcours, la première de ses étapes.
PARCOURS: dict[str, str] = {nom: listes[0] for nom, listes in ETAPES.items()}

#: Ce que la première session enseigne, dans l'ordre (brief §6, story 2.7), et donc
#: le début imposé de chaque parcours : un jour par caractère, sans composé. La
#: première session est la même quel que soit le parcours choisi ensuite, « Lire » ou
#: « Passer le HSK » (décision du propriétaire). La famille de départ de l'app
#: (`app/public/data/demo/familles/人.json`) montre les mêmes, et un test Vitest le
#: vérifie contre l'export, pour chaque parcours.
PREMIERE_SESSION: tuple[str, ...] = ("人", "大", "天")
DEPART: dict[str, tuple[str, ...]] = {nom: PREMIERE_SESSION for nom in PARCOURS}

CRITERE_RACINE = "première brique dans l'ordre d'écriture"
CRITERE_FREQUENCE = (
    "nombre de caractères qui dépendent du candidat"
    " (Make Me a Hanzi ne fournit pas de rang de fréquence)"
)

_LOIN = 10**9

#: Les ordres figés des parcours, versionnés : `ordre-<nom>.tsv`, un jour par ligne.
ORDRES = DATA / "sources" / "parcours"
#: Le même dossier, que les tests retrouvent quand `ORDRES` est détourné.
ORDRES_REELS = ORDRES

#: Ce que dit `parcours-<nom>.json` de l'origine de son ordre.
ORDRE_FIGE = "figé : data/sources/parcours/ordre-{nom}.tsv"
ORDRE_CALCULE = "calculé (aucun ordre figé)"

#: Une case vide d'un fichier d'ordre : pas de brique ce jour-là, ou pas de composé.
VIDE = "-"
#: La marque des jours qui ferment le parcours (caractères non réconciliés ou absents).
FERME = "ferme"


class CycleDetecte(ValueError):
    """Le graphe de dépendances boucle : aucun ordre d'apprentissage n'existe."""


class ParcoursBloque(ValueError):
    """Plus aucun candidat prêt alors que la liste cible n'est pas couverte."""


class DepartImpossible(ValueError):
    """Un caractère du départ imposé n'est pas à apprendre, ou pas encore lisible."""


class OrdreInvalide(ValueError):
    """Un ordre figé ne tient plus contre le graphe : à relire, puis à refiger."""


# ---------------------------------------------------------------------------- graphe


@dataclass(frozen=True)
class Noeud:
    """Un nœud du graphe : un caractère, une brique ou une feuille muette.

    `prerequis` est la liste ordonnée, sans doublon, des composants canoniques,
    dans l'ordre d'écriture. Une brique et une feuille muette n'ont pas de
    prérequis. `reconcilie` reprend le verdict de la story 1.2 ; une feuille
    muette n'a rien à réconcilier et vaut vrai.
    """

    c: str
    genre: str
    prerequis: tuple[str, ...] = ()
    reconcilie: bool = True

    @property
    def fiche(self) -> bool:
        """Vrai si le nœud porte une fiche (tout sauf une feuille muette ou découpée)."""
        return self.genre not in SANS_FICHE


@dataclass(frozen=True)
class Famille:
    """Une racine et tout ce qu'elle engendre. `membres` exclut la racine."""

    racine: str
    genre: str
    membres: tuple[str, ...]

    @property
    def n(self) -> int:
        return len(self.membres)


class Graphe:
    """Nœuds, arêtes et familles. Une arête va du prérequis vers le dépendant."""

    def __init__(self, noeuds: Mapping[str, Noeud]) -> None:
        self.noeuds: dict[str, Noeud] = dict(noeuds)
        aretes: list[tuple[str, str]] = []
        dependants: dict[str, list[str]] = {c: [] for c in self.noeuds}
        for n in self.noeuds.values():
            for p in n.prerequis:
                aretes.append((p, n.c))
                dependants.setdefault(p, []).append(n.c)
        self.aretes: tuple[tuple[str, str], ...] = tuple(aretes)
        self.dependants: dict[str, tuple[str, ...]] = {
            c: tuple(v) for c, v in dependants.items()
        }

    def __contains__(self, c: object) -> bool:
        return c in self.noeuds

    def __len__(self) -> int:
        return len(self.noeuds)

    def __getitem__(self, c: str) -> Noeud:
        return self.noeuds[c]

    def genre(self, c: str) -> str:
        return self.noeuds[c].genre

    def par_genre(self, genre: str) -> tuple[str, ...]:
        return tuple(c for c, n in self.noeuds.items() if n.genre == genre)

    def prerequis_transitifs(self, c: str) -> set[str]:
        """Toutes les briques et feuilles dont `c` dépend, directement ou non."""
        vus: set[str] = set()
        pile = list(self.noeuds[c].prerequis)
        while pile:
            x = pile.pop()
            if x in vus:
                continue
            vus.add(x)
            pile.extend(p for p in self.noeuds.get(x, Noeud(x, MUETTE)).prerequis)
        return vus

    def _premier_composant(self, c: str) -> str:
        """Première brique de `c` dans l'ordre d'écriture, ou `c` s'il est une feuille."""
        noeud = self.noeuds[c]
        if noeud.genre == BRIQUE or not noeud.prerequis:
            return c
        for p in noeud.prerequis:
            if self.noeuds[p].genre == BRIQUE:
                return p
        for p in noeud.prerequis:
            if self.noeuds[p].fiche:
                return p
        return noeud.prerequis[0]

    def racine(self, c: str) -> str:
        """Racine de famille de `c` : sa première brique dans l'ordre d'écriture.

        À défaut de brique, la première feuille qui porte une fiche, puis la
        première feuille. La remontée se poursuit de proche en proche jusqu'à
        une feuille, pour que les familles partitionnent le graphe. Critère
        volontairement simple et déterministe, en attendant les rôles son / sens
        de la story 1.4, qui donneront la brique de sens.
        """
        vus = {c}
        courant = c
        while True:
            suivant = self._premier_composant(courant)
            if suivant == courant or suivant in vus:
                return suivant
            vus.add(suivant)
            courant = suivant

    def familles(self) -> list[Famille]:
        """Une famille par racine, triée par taille décroissante puis par forme."""
        membres: dict[str, list[str]] = {}
        for c in self.noeuds:
            racine = self.racine(c)
            if racine == c:
                membres.setdefault(c, [])
                continue
            membres.setdefault(racine, []).append(c)
        familles = [
            Famille(racine=r, genre=self.noeuds[r].genre, membres=tuple(sorted(m)))
            for r, m in membres.items()
        ]
        return sorted(familles, key=lambda f: (-f.n, f.racine))


def construire(
    caracteres: Iterable[Mapping[str, object]], decoupees: Iterable[str] = ()
) -> Graphe:
    """Construit le graphe depuis les entrées de `decompositions.json`.

    Une entrée dont les composants se réduisent au caractère lui-même est soit
    une brique de la norme (réconciliée), soit un caractère que la source ne
    décompose pas (non réconcilié) : dans les deux cas, une feuille. Un
    prérequis sans entrée est une feuille muette, ou découpée s'il est dans
    `decoupees` (les composants dont `decoupes.json` porte les traits).
    """
    decoupees = set(decoupees)
    noeuds: dict[str, Noeud] = {}
    for entree in caracteres:
        c = str(entree["c"])
        composants = [str(x) for x in (entree.get("composants") or [])]
        reconcilie = bool(entree.get("reconcilie"))
        if composants in ([], [c]):
            genre = BRIQUE if reconcilie and composants == [c] else CARACTERE
            noeuds[c] = Noeud(c=c, genre=genre, reconcilie=reconcilie)
            continue
        prerequis = tuple(dict.fromkeys(x for x in composants if x != c))
        noeuds[c] = Noeud(c=c, genre=CARACTERE, prerequis=prerequis, reconcilie=reconcilie)

    # Trié : l'itération d'un ensemble de chaînes dépend du grain de hachage, et
    # les feuilles muettes sortiraient dans un ordre différent à chaque passage —
    # donc un `graphe.json` différent à contenu égal.
    for prerequis in sorted({p for n in list(noeuds.values()) for p in n.prerequis}):
        if prerequis not in noeuds:
            genre = DECOUPEE if prerequis in decoupees else MUETTE
            noeuds[prerequis] = Noeud(c=prerequis, genre=genre)
    return Graphe(noeuds)


# ----------------------------------------------------------------------------- tri


def cycles(graphe: Graphe) -> list[tuple[str, ...]]:
    """Cycles du graphe, chacun donné comme le chemin qui revient sur lui-même.

    Doit être vide : la décomposition canonique est un arbre fini. Un cycle est
    un défaut de données, bloquant pour `wenlu check`.
    """
    BLANC, GRIS, NOIR = 0, 1, 2
    couleur: dict[str, int] = {c: BLANC for c in graphe.noeuds}
    trouves: list[tuple[str, ...]] = []
    vus: set[tuple[str, ...]] = set()

    for depart in graphe.noeuds:
        if couleur[depart] != BLANC:
            continue
        chemin: list[str] = []
        pile: list[tuple[str, Iterable[str]]] = [(depart, iter(graphe.dependants.get(depart, ())))]
        couleur[depart] = GRIS
        chemin.append(depart)
        while pile:
            noeud, suivants = pile[-1]
            avance = next(suivants, None)
            if avance is None:
                couleur[noeud] = NOIR
                chemin.pop()
                pile.pop()
                continue
            if couleur.get(avance, BLANC) == GRIS:
                boucle = tuple(chemin[chemin.index(avance):] + [avance])
                signature = tuple(sorted(set(boucle)))
                if signature not in vus:
                    vus.add(signature)
                    trouves.append(boucle)
                continue
            if couleur.get(avance, BLANC) == NOIR:
                continue
            couleur[avance] = GRIS
            chemin.append(avance)
            pile.append((avance, iter(graphe.dependants.get(avance, ()))))
    return trouves


def ordre_topologique(
    graphe: Graphe,
    cle: Callable[[str], object] | None = None,
) -> list[str]:
    """Tri topologique : un prérequis sort toujours avant ce qui le contient.

    `cle` départage les candidats prêts ; par défaut la forme du caractère, pour
    que l'ordre soit reproductible. Lève `CycleDetecte` si le graphe boucle.
    """
    cle = cle or (lambda c: c)
    entrants = {c: len(n.prerequis) for c, n in graphe.noeuds.items()}
    prets = [c for c, n in entrants.items() if n == 0]
    sortie: list[str] = []
    while prets:
        prets.sort(key=cle)  # type: ignore[arg-type]
        c = prets.pop(0)
        sortie.append(c)
        for d in graphe.dependants.get(c, ()):
            entrants[d] -= 1
            if entrants[d] == 0:
                prets.append(d)
    if len(sortie) != len(graphe.noeuds):
        restants = sorted(c for c in graphe.noeuds if c not in set(sortie))
        raise CycleDetecte(f"{len(restants)} nœuds jamais prêts : {' '.join(restants[:10])}")
    return sortie


# ------------------------------------------------------------------------- parcours


@dataclass(frozen=True)
class Jour:
    """Une session : une brique nouvelle au plus, puis un ou deux composés."""

    jour: int
    brique: str | None
    composes: tuple[str, ...] = ()
    non_reconcilie: bool = False

    @property
    def caracteres(self) -> tuple[str, ...]:
        return ((self.brique,) if self.brique else ()) + self.composes


@dataclass(frozen=True)
class Etape:
    """Une étape d'un parcours : une liste, et le dernier jour du chemin qui en pose un caractère.

    `fin` vaut 0 tant que le chemin n'en a rien posé ; une étape que les précédentes ont
    déjà couverte garde la fin de la précédente.
    """

    liste: str
    cible: tuple[str, ...]
    fin: int


@dataclass(frozen=True)
class Parcours:
    """L'ordre d'apprentissage des listes d'un parcours, jour par jour.

    `liste` est la première liste, celle du chemin gratuit ; `cible`, toutes les listes des
    étapes, dans l'ordre, sans doublon ; `etapes`, la fin de chacune.
    """

    nom: str
    liste: str
    jours: tuple[Jour, ...]
    briques: tuple[str, ...] = ()
    muettes: tuple[str, ...] = ()
    decoupees: tuple[str, ...] = ()
    non_reconcilies: tuple[str, ...] = ()
    absents: tuple[str, ...] = ()
    cible: tuple[str, ...] = ()
    depart: tuple[str, ...] = ()
    etapes: tuple[Etape, ...] = ()

    @property
    def gratuit(self) -> int:
        """Le dernier jour du chemin gratuit : la fin de la première étape (0 sans étape)."""
        return self.etapes[0].fin if self.etapes else 0

    @property
    def cibles(self) -> int:
        return len(self.cible)

    @property
    def caracteres(self) -> tuple[str, ...]:
        return tuple(c for j in self.jours for c in j.caracteres)

    @property
    def jours_reconcilies(self) -> int:
        return sum(1 for j in self.jours if not j.non_reconcilie)


def rangs_frequence(caracteres: Iterable[Mapping[str, object]]) -> dict[str, int]:
    """Rang de fréquence par caractère, s'il existe dans les données ingérées.

    Make Me a Hanzi n'en fournit pas : le dictionnaire rendu est alors vide et le
    parcours se rabat sur le nombre de dépendants. Si une source de fréquence est
    ajoutée à l'ingestion sous la clé `frequence` (1 = le plus fréquent), elle
    prend le pas sans autre changement.
    """
    rangs: dict[str, int] = {}
    for entree in caracteres:
        rang = entree.get("frequence")
        if isinstance(rang, int):
            rangs[str(entree["c"])] = rang
    return rangs


def _cle_priorite(
    graphe: Graphe,
    positions: Mapping[str, int],
    rangs: Mapping[str, int],
    debloque: Mapping[str, int] | None = None,
) -> Callable[[str], tuple[int, int, int, int, str]]:
    """Priorité : liste cible, puis ce qui devient lisible le jour même, puis fréquence.

    `debloque` compte, pour chaque candidat, les caractères de la liste encore à
    voir qui n'attendent plus que lui : c'est ce qui garantit qu'un jour porte
    une brique *et* ses composés, comme le veut la session de 10 minutes.

    La fréquence est le rang ingéré quand il existe (petit = fréquent), sinon le
    nombre de caractères qui dépendent du candidat, pris en négatif pour que le
    plus employé passe en premier. L'ordre de la liste puis la forme ferment le
    tri : l'ordre est total, donc reproductible.
    """
    debloque = debloque or {}

    def cle(c: str) -> tuple[int, int, int, int, str]:
        frequence = rangs.get(c, _LOIN) if rangs else -len(graphe.dependants.get(c, ()))
        return (
            0 if c in positions else 1,
            -debloque.get(c, 0),
            frequence,
            positions.get(c, _LOIN),
            c,
        )

    return cle


def cible_des_etapes(etapes: Sequence[tuple[str, Sequence[str]]]) -> tuple[str, ...]:
    """Toutes les listes des étapes, dans l'ordre, sans doublon : la cible du parcours."""
    return tuple(dict.fromkeys(c for _, cs in etapes for c in cs))


def fermetures_des_etapes(
    graphe: Graphe, etapes: Sequence[tuple[str, Sequence[str]]]
) -> list[tuple[str, ...]]:
    """Ce qui ferme chaque étape : ses caractères absents du graphe, puis ses non réconciliés,
    dans l'ordre de sa liste. Un caractère n'appartient qu'à la première liste qui le porte."""
    vus: set[str] = set()
    out: list[tuple[str, ...]] = []
    for _, cs in etapes:
        propres = [c for c in dict.fromkeys(cs) if c not in vus]
        vus.update(propres)
        absents = [c for c in propres if c not in graphe]
        non_reconcilies = [c for c in propres if c in graphe and not graphe[c].reconcilie]
        out.append(tuple(absents + non_reconcilies))
    return out


def fins_des_etapes(
    etapes: Sequence[tuple[str, Sequence[str]]], jours: Sequence[Jour]
) -> tuple[Etape, ...]:
    """La fin de chaque étape : le dernier jour qui pose un caractère de sa liste.

    Les jours de fermeture n'y comptent pas : ils ne s'enseignent pas. Une étape dont le
    chemin n'a rien posé de plus garde la fin de la précédente : les fins ne reculent pas.
    """
    jour_de: dict[str, int] = {}
    for j in jours:
        if j.non_reconcilie:
            continue
        for c in j.caracteres:
            jour_de.setdefault(c, j.jour)
    out: list[Etape] = []
    fin = 0
    for liste, cs in etapes:
        fin = max([fin, *(jour_de[c] for c in cs if c in jour_de)])
        out.append(Etape(liste=liste, cible=tuple(cs), fin=fin))
    return tuple(out)


def parcours(
    graphe: Graphe,
    cible: Sequence[str],
    *,
    nom: str = "lire",
    liste: str = "seuil-255",
    rangs: Mapping[str, int] | None = None,
    composes_par_jour: int = COMPOSES_PAR_JOUR,
    depart: Sequence[str] = (),
    etapes: Sequence[tuple[str, Sequence[str]]] | None = None,
    prefixe: Sequence[Jour] = (),
) -> Parcours:
    """Ordre d'apprentissage de `cible` : une brique nouvelle par jour.

    Les briques muettes et découpées sont acquises d'entrée, faute de fiche à poser. Les
    caractères absents du graphe ou non réconciliés ferment le parcours.

    `etapes` : les listes du parcours, dans l'ordre, `(nom, caractères)` ; par défaut une
    seule, `(liste, cible)`. Chaque étape se termine avant que la suivante commence : ses
    caractères pas encore posés, et leurs briques, avec les règles de toujours ; la
    priorité suit l'ordre de sa liste. La cible du parcours est alors toutes les listes.

    `prefixe` : des jours déjà figés, gardés tels quels, jours de fermeture compris ; le
    calcul reprend après eux. C'est ainsi qu'un ordre figé se prolonge sans qu'aucun de ses
    jours ne bouge (`prolonger`). Chaque étape se ferme par ses propres non réconciliés et
    absents (`fermetures_des_etapes`), avant la suivante.

    `depart` impose les premiers jours, quand il n'y a pas de préfixe : un caractère par
    jour, dans l'ordre donné, sans composé — c'est ce que la première session enseigne,
    rien de plus. Une brique y reste seule de son jour ; un caractère composé n'y entre
    que si ses briques sont déjà posées. Sinon, `DepartImpossible`.
    """
    rangs = rangs or {}
    etapes = [(liste, tuple(cible))] if etapes is None else [(l, tuple(cs)) for l, cs in etapes]
    cible = cible_des_etapes(etapes)
    absents = tuple(c for c in cible if c not in graphe)
    non_reconcilies = tuple(c for c in cible if c in graphe and not graphe[c].reconcilie)
    cibles_ok = [c for c in cible if c in graphe and graphe[c].reconcilie]

    muettes: set[str] = set()
    decoupees: set[str] = set()
    a_apprendre_tout: set[str] = set(cibles_ok)
    for c in cibles_ok:
        for p in graphe.prerequis_transitifs(c):
            if graphe[p].genre == MUETTE:
                muettes.add(p)
            elif graphe[p].genre == DECOUPEE:
                decoupees.add(p)
            else:
                a_apprendre_tout.add(p)

    acquis: set[str] = muettes | decoupees
    jours: list[Jour] = []
    briques: list[str] = []

    fermes: set[str] = set()
    for j in prefixe:
        jours.append(
            Jour(jour=len(jours) + 1, brique=j.brique, composes=tuple(j.composes), non_reconcilie=j.non_reconcilie)
        )
        if j.non_reconcilie:
            fermes.update(j.composes)
            continue
        acquis.update(j.caracteres)
        if j.brique:
            briques.append(j.brique)

    def pret(c: str) -> bool:
        return all(p in acquis for p in graphe[c].prerequis)

    if not jours:
        for c in depart:
            if c not in a_apprendre_tout or c in acquis:
                raise DepartImpossible(f"{nom} : {c} n'est pas à apprendre dans {liste}, ou deux fois")
            if not pret(c):
                manque = " ".join(p for p in graphe[c].prerequis if p not in acquis)
                raise DepartImpossible(f"{nom} : {c} n'est pas lisible au départ (il manque {manque})")
            acquis.add(c)
            if graphe[c].genre == BRIQUE:
                briques.append(c)
                jours.append(Jour(jour=len(jours) + 1, brique=c))
            else:
                jours.append(Jour(jour=len(jours) + 1, brique=None, composes=(c,)))

    reconcilies = set(cibles_ok)
    fermes_de = fermetures_des_etapes(graphe, etapes)
    for k_etape, (nom_liste, cs) in enumerate(etapes):
        positions = {c: i for i, c in enumerate(cs)}
        restant = {c for c in cs if c in reconcilies and c not in acquis}
        besoin: dict[str, int] = {}
        a_apprendre: set[str] = set(restant)
        for c in restant:
            for p in graphe.prerequis_transitifs(c):
                besoin[p] = besoin.get(p, 0) + 1
                if p not in acquis and graphe[p].genre not in SANS_FICHE:
                    a_apprendre.add(p)

        def debloque() -> dict[str, int]:
            """Pour chaque candidat, les cibles restantes qui n'attendent plus que lui."""
            compte: dict[str, int] = {}
            for c in restant:
                manquants = [p for p in graphe[c].prerequis if p not in acquis]
                if len(manquants) == 1:
                    compte[manquants[0]] = compte.get(manquants[0], 0) + 1
            return compte

        def poser(c: str) -> None:
            acquis.add(c)
            if c in restant:
                restant.discard(c)
                for p in graphe.prerequis_transitifs(c):
                    besoin[p] = besoin.get(p, 1) - 1

        while restant:
            cle = _cle_priorite(graphe, positions, rangs, debloque())
            candidates = [
                c
                for c in a_apprendre - acquis
                if graphe[c].genre == BRIQUE and pret(c) and (c in restant or besoin.get(c, 0) > 0)
            ]
            brique = min(candidates, key=cle) if candidates else None
            if brique is not None:
                poser(brique)
                briques.append(brique)
            composes: list[str] = []
            while len(composes) < composes_par_jour:
                prets = [
                    c
                    for c in a_apprendre - acquis
                    if graphe[c].genre != BRIQUE and pret(c) and (c in restant or besoin.get(c, 0) > 0)
                ]
                if not prets:
                    break
                suivant = min(prets, key=_cle_priorite(graphe, positions, rangs, debloque()))
                poser(suivant)
                composes.append(suivant)
            if brique is None and not composes:
                raise ParcoursBloque(
                    f"{nom} : {len(restant)} caractères de {nom_liste} jamais prêts"
                    f" ({' '.join(sorted(restant)[:10])})"
                )
            jours.append(Jour(jour=len(jours) + 1, brique=brique, composes=tuple(composes)))

        # Les caractères de l'étape non réconciliés ou absents la ferment.
        reste = [c for c in fermes_de[k_etape] if c not in fermes]
        fermes.update(reste)
        for debut in range(0, len(reste), composes_par_jour):
            jours.append(
                Jour(
                    jour=len(jours) + 1,
                    brique=None,
                    composes=tuple(reste[debut : debut + composes_par_jour]),
                    non_reconcilie=True,
                )
            )

    return Parcours(
        nom=nom,
        liste=etapes[0][0] if etapes else liste,
        jours=tuple(jours),
        briques=tuple(briques),
        muettes=tuple(sorted(muettes)),
        decoupees=tuple(sorted(decoupees)),
        non_reconcilies=tuple(non_reconcilies),
        absents=absents,
        cible=tuple(cible),
        depart=tuple(depart),
        etapes=fins_des_etapes(etapes, jours),
    )


# ----------------------------------------------------------------------- ordre figé


def chemin_ordre(nom: str, dossier: Path | None = None) -> Path:
    """Le fichier d'ordre figé d'un parcours."""
    return (dossier or ORDRES) / f"ordre-{nom}.tsv"


#: Le nom d'une liste tel que l'en-tête d'un ordre le dit.
NOMS_DE_LISTE: dict[str, str] = {
    "seuil-255": "seuil 255",
    **{nom: nom.replace("hsk-", "HSK ") for nom in LISTES_HSK},
}


def ecrire_ordre(p: Parcours) -> str:
    """Le fichier d'ordre figé d'un parcours : un jour par ligne, en TSV.

    Avec plusieurs étapes, l'en-tête les dit, avec leurs règles et leur source, et une
    ligne de commentaire marque le début de chacune dans la liste des jours.
    """
    listes = [e.liste for e in p.etapes] or [p.liste]
    lignes = [
        f"# Ordre figé du parcours « {p.nom} » (listes {', '.join(listes)}), un jour par ligne.",
        "#",
        "# Écrit par `uv run wenlu parcours figer` (ou prolongé par `uv run wenlu parcours",
        "# prolonger`), relu, puis versionné : `wenlu build` le lit au lieu de recalculer",
        "# l'ordre, et le refuse s'il ne tient plus contre le graphe (brique posée deux fois,",
        "# composé posé avant ses briques, caractère de la liste oublié, caractère qui n'est",
        "# plus à apprendre, étape commencée avant la fin de la précédente). Un jour qui bouge",
        "# est donc toujours une décision explicite, visible dans l'historique de ce fichier.",
        "# Voir `data/src/wenlu_data/graphe.py` et `docs/sources-licences.md` §10.",
        "#",
    ]
    if len(listes) > 1:
        lignes += [
            "# Étapes, dans l'ordre (graphe.ETAPES) : chaque liste n'apporte que ce que le chemin",
            "# n'a pas encore posé, et se termine avant la suivante. La première est le chemin",
            "# gratuit (brief §10) ; la suite est de Wenlu complet. Décision du propriétaire du",
            "# 30 septembre 2026 : après le seuil 255 ou le HSK 1, les deux chemins suivent le",
            "# HSK 3.0 (GF 0025-2021, data/sources/listes/hsk-*.txt) jusqu'au bout du HSK 7-9 ;",
            "# les seuils 405 à 1555 sont introuvables.",
            "# Règles de la suite, celles du calcul (`graphe.parcours`) : une brique nouvelle au",
            "# plus par jour, puis un ou deux composés qu'elle rend lisibles ; un composé",
            "# seulement quand toutes ses briques GF 0014-2009 sont posées ; parmi les",
            "# candidats, les caractères de la liste de l'étape d'abord, puis ce qui devient",
            "# lisible le jour même, puis le nombre de caractères qui dépendent du candidat",
            "# (aucun rang de fréquence n'est ingéré), puis l'ordre de la liste. Les caractères",
            "# non réconciliés ou absents de chaque liste ferment son étape ; la session les saute.",
        ]
        for e in p.etapes:
            lignes.append(f"#   {NOMS_DE_LISTE.get(e.liste, e.liste)} : jusqu'au jour {e.fin}")
        lignes.append("#")
    lignes += [
        "# Colonnes, séparées par une tabulation : jour ; brique nouvelle (`-` : aucune) ;",
        f"# composés, séparés par une espace (`-` : aucun) ; `{FERME}` pour les jours qui",
        "# ferment le parcours (caractères non réconciliés ou absents), `-` sinon.",
        "jour\tbrique\tcomposes\tstatut",
    ]
    # Avec plusieurs étapes, une ligne de commentaire marque le début de chacune (le premier
    # jour ordinaire après la fin de la précédente) et chaque bloc de jours de fermeture.
    marquer = len(listes) > 1
    k = 0
    precedent_ferme = False
    for j in p.jours:
        if marquer and j.non_reconcilie and not precedent_ferme:
            lignes.append("# — fermeture : non réconciliés et absents de l'étape —")
        if marquer and not j.non_reconcilie:
            suivante = k
            while suivante + 1 < len(p.etapes) and j.jour > p.etapes[suivante].fin:
                suivante += 1
            if suivante != k or j.jour == 1:
                k = suivante
                lignes.append(f"# — {NOMS_DE_LISTE.get(p.etapes[k].liste, p.etapes[k].liste)} —")
        precedent_ferme = j.non_reconcilie
        lignes.append(
            "\t".join(
                (
                    str(j.jour),
                    j.brique or VIDE,
                    " ".join(j.composes) or VIDE,
                    FERME if j.non_reconcilie else VIDE,
                )
            )
        )
    return "\n".join(lignes) + "\n"


def lire_ordre(lignes: Iterable[str], nom: str = "ordre.tsv") -> list[Jour]:
    """Les jours d'un fichier d'ordre figé. Une ligne mal formée lève `OrdreInvalide`."""
    jours: list[Jour] = []
    entete = False
    for numero, brute in enumerate(lignes, start=1):
        ligne = brute.rstrip("\n")
        if not ligne.strip() or ligne.startswith("#"):
            continue
        champs = ligne.split("\t")
        if not entete:
            if champs != ["jour", "brique", "composes", "statut"]:
                raise OrdreInvalide(f"{nom}, ligne {numero} : en-tête inattendu ({ligne!r})")
            entete = True
            continue
        if len(champs) != 4 or not champs[0].isdigit() or champs[3] not in (VIDE, FERME):
            raise OrdreInvalide(f"{nom}, ligne {numero} : quatre colonnes attendues ({ligne!r})")
        brique = None if champs[1] == VIDE else champs[1]
        composes = () if champs[2] == VIDE else tuple(champs[2].split(" "))
        jours.append(
            Jour(jour=int(champs[0]), brique=brique, composes=composes, non_reconcilie=champs[3] == FERME)
        )
    return jours


def charger_ordre(nom: str, dossier: Path | None = None) -> list[Jour] | None:
    """L'ordre figé d'un parcours, ou None s'il n'y en a pas."""
    chemin = chemin_ordre(nom, dossier)
    if not chemin.exists():
        return None
    return lire_ordre(chemin.read_text(encoding="utf-8").splitlines(), chemin.name)


def parcours_fige(
    graphe: Graphe,
    cible: Sequence[str],
    jours: Sequence[Jour],
    *,
    nom: str = "lire",
    liste: str = "seuil-255",
    depart: Sequence[str] = (),
    etapes: Sequence[tuple[str, Sequence[str]]] | None = None,
) -> Parcours:
    """Le parcours d'un ordre figé, validé contre le graphe.

    Mêmes règles que le calcul (`parcours`) : le départ imposé d'abord, une brique
    nouvelle au plus par jour, un composé seulement quand toutes ses briques sont
    posées (les feuilles muettes et découpées sont acquises d'entrée), toute la liste
    cible couverte, et les caractères non réconciliés ou absents en fin de parcours.
    En plus : rien n'y est posé qui ne soit à apprendre pour la liste, pour qu'une
    décomposition changée se voie, et les étapes se suivent : aucun caractère d'une
    liste n'est posé avant la fin de l'étape précédente, sauf comme brique d'une liste
    plus tôt. Au moindre écart, `OrdreInvalide` les nomme tous.

    `etapes` : les listes du parcours, dans l'ordre ; par défaut une seule, `(liste, cible)`.
    """
    etapes = [(liste, tuple(cible))] if etapes is None else [(l, tuple(cs)) for l, cs in etapes]
    cible = cible_des_etapes(etapes)
    fautes: list[str] = []
    absents = tuple(c for c in cible if c not in graphe)
    non_reconcilies = tuple(c for c in cible if c in graphe and not graphe[c].reconcilie)
    cibles_ok = [c for c in cible if c in graphe and graphe[c].reconcilie]

    a_apprendre: set[str] = set(cibles_ok)
    muettes: set[str] = set()
    decoupees: set[str] = set()
    for c in cibles_ok:
        for p in graphe.prerequis_transitifs(c):
            genre = graphe[p].genre if p in graphe else MUETTE
            if genre == MUETTE:
                muettes.add(p)
            elif genre == DECOUPEE:
                decoupees.add(p)
            else:
                a_apprendre.add(p)

    attendus = list(range(1, len(jours) + 1))
    if [j.jour for j in jours] != attendus:
        fautes.append("les jours ne se suivent pas à partir de 1")
    acquis: set[str] = set(muettes | decoupees)
    poses: set[str] = set()
    briques: list[str] = []
    fermeture: list[str] = []
    for i, j in enumerate(jours):
        if j.non_reconcilie:
            if j.brique:
                fautes.append(f"jour {j.jour} : un jour de fermeture ne pose pas de brique")
            fermeture.extend(j.composes)
            continue
        if not j.brique and not j.composes:
            fautes.append(f"jour {j.jour} : ni brique ni composé")
        if i < len(depart):
            if j.caracteres != (depart[i],):
                fautes.append(f"jour {j.jour} : le départ impose {depart[i]} seul")
        for c in j.caracteres:
            if c in poses:
                fautes.append(f"jour {j.jour} : {c} déjà posé")
                continue
            poses.add(c)
            if c not in graphe:
                fautes.append(f"jour {j.jour} : {c} absent du graphe")
                continue
            if c not in a_apprendre:
                fautes.append(f"jour {j.jour} : {c} n'est plus à apprendre pour {liste}")
            if c == j.brique:
                if graphe[c].genre != BRIQUE:
                    fautes.append(f"jour {j.jour} : {c} n'est pas une brique ({graphe[c].genre})")
                briques.append(c)
            else:
                if graphe[c].genre == BRIQUE:
                    fautes.append(f"jour {j.jour} : {c} est une brique, posée comme composé")
                manque = [p for p in graphe[c].prerequis if p not in acquis]
                if manque:
                    fautes.append(f"jour {j.jour} : {c} posé avant {' '.join(manque)}")
            acquis.add(c)
    oublies = [c for c in cibles_ok if c not in poses]
    if oublies:
        fautes.append(f"caractères de la liste jamais posés : {' '.join(oublies)}")
    manquants = sorted(a_apprendre - poses)
    if manquants and not oublies:
        fautes.append(f"à apprendre mais jamais posés : {' '.join(manquants)}")
    attendue = [c for fermes in fermetures_des_etapes(graphe, etapes) for c in fermes]
    if fermeture != attendue:
        fautes.append(
            "les jours de fermeture doivent porter, étape par étape et dans l'ordre de sa liste,"
            f" les absents puis les non réconciliés : {' '.join(attendue) or 'aucun'}"
            f" (lu : {' '.join(fermeture) or 'aucun'})"
        )
    fins = fins_des_etapes(etapes, jours)
    fautes += fautes_d_etapes(graphe, fins, jours, cibles_ok)
    if fautes:
        raise OrdreInvalide(
            f"{nom} : l'ordre figé ({chemin_ordre(nom).name}) ne tient plus contre le graphe —"
            f" {' ; '.join(fautes[:12])}{' …' if len(fautes) > 12 else ''}."
            " Relire, puis `uv run wenlu parcours figer` si le changement est voulu."
        )
    return Parcours(
        nom=nom,
        liste=liste,
        jours=tuple(jours),
        briques=tuple(briques),
        muettes=tuple(sorted(muettes)),
        decoupees=tuple(sorted(decoupees)),
        non_reconcilies=non_reconcilies,
        absents=absents,
        cible=tuple(cible),
        depart=tuple(depart),
        etapes=fins,
    )


def fautes_d_etapes(
    graphe: Graphe, fins: Sequence[Etape], jours: Sequence[Jour], cibles_ok: Iterable[str]
) -> list[str]:
    """Les étapes se suivent, et chacune se ferme avant la suivante.

    L'étape d'un caractère posé est la première dont la liste le porte, ou, plus tôt,
    la première qui le demande comme composant (青 du HSK 2 posé pour 请 du HSK 1 est de
    l'étape du HSK 1) ; celle d'un jour, la plus haute de ses caractères ; celle d'un jour
    de fermeture, celle de ses caractères. D'un jour au suivant, l'étape ne redescend
    jamais, et aucun jour ordinaire d'une étape ne suit un de ses jours de fermeture.
    """
    reconcilies = set(cibles_ok)
    etape_de: dict[str, int] = {}
    for k, e in enumerate(fins):
        for c in e.cible:
            etape_de.setdefault(c, k)
    cumul: set[str] = set()
    for k, e in enumerate(fins):
        for c in e.cible:
            if c in reconcilies:
                cumul |= graphe.prerequis_transitifs(c)
        for c in cumul:
            if etape_de.get(c, k + 1) > k:
                etape_de[c] = k
    fautes: list[str] = []
    courante = 0
    fermee = -1
    for j in jours:
        etapes_du_jour = [etape_de[c] for c in j.caracteres if c in etape_de]
        if not etapes_du_jour:
            continue
        k = max(etapes_du_jour)
        nom_etape = fins[k].liste
        if k < courante:
            fautes.append(f"jour {j.jour} : {nom_etape} revient après {fins[courante].liste}")
        if not j.non_reconcilie and k <= fermee:
            fautes.append(f"jour {j.jour} : {nom_etape} continue après ses jours de fermeture")
        if j.non_reconcilie:
            fermee = max(fermee, k)
        courante = max(courante, k)
    return fautes


# --------------------------------------------------------------------------- écriture


def document_graphe(graphe: Graphe, boucles: Sequence[tuple[str, ...]]) -> dict[str, object]:
    """Contenu de `graphe.json` (voir data/schema.md)."""
    familles = graphe.familles()
    return {
        "norme": "GF 0014-2009",
        "source": "data/work/build/decompositions.json",
        "critere_racine": CRITERE_RACINE,
        "compte": {
            "noeuds": len(graphe),
            "aretes": len(graphe.aretes),
            "familles": len(familles),
            "familles_non_vides": sum(1 for f in familles if f.n),
            "briques": len(graphe.par_genre(BRIQUE)),
            "caracteres": len(graphe.par_genre(CARACTERE)),
            "muettes": len(graphe.par_genre(MUETTE)),
            "decoupees": len(graphe.par_genre(DECOUPEE)),
            "cycles": len(boucles),
        },
        "noeuds": [
            {
                "c": n.c,
                "genre": n.genre,
                "prerequis": list(n.prerequis),
                "dependants": len(graphe.dependants.get(n.c, ())),
                "racine": graphe.racine(n.c),
                "reconcilie": n.reconcilie,
            }
            for n in graphe.noeuds.values()
        ],
        "aretes": [[de, vers] for de, vers in graphe.aretes],
        "familles": [
            {"racine": f.racine, "genre": f.genre, "n": f.n, "membres": list(f.membres)}
            for f in familles
        ],
        "cycles": [list(b) for b in boucles],
    }


def document_parcours(p: Parcours, ordre: str = ORDRE_CALCULE) -> dict[str, object]:
    """Contenu de `parcours-<nom>.json` (voir data/schema.md)."""
    return {
        "parcours": p.nom,
        "liste": p.liste,
        "regle": "une seule brique nouvelle par session de 10 minutes",
        "ordre": ordre,
        "critere_frequence": CRITERE_FREQUENCE,
        "depart": list(p.depart),
        # `cible` : la liste du chemin gratuit, la première étape (le rang du dernier de ses
        # caractères borne le pinyin des examens, `examens.fin_premiere_etape`) ; toutes les
        # listes sont dans `etapes`, chacune avec le dernier jour du chemin qui en pose un
        # caractère ; `gratuit` est la fin de la première, le bout du chemin gratuit.
        "cible": list(p.etapes[0].cible) if p.etapes else list(p.cible),
        "gratuit": p.gratuit,
        "etapes": [{"liste": e.liste, "fin": e.fin, "cible": list(e.cible)} for e in p.etapes],
        "compte": {
            "cibles": p.cibles,
            "jours": len(p.jours),
            "jours_reconcilies": p.jours_reconcilies,
            "briques": len(p.briques),
            "muettes": len(p.muettes),
            "decoupees": len(p.decoupees),
            "non_reconcilies": len(p.non_reconcilies),
            "absents": len(p.absents),
        },
        "jours": [
            {
                "jour": j.jour,
                "brique": j.brique,
                "composes": list(j.composes),
                "non_reconcilie": j.non_reconcilie,
            }
            for j in p.jours
        ],
        "briques": list(p.briques),
        "briques_muettes": list(p.muettes),
        "briques_decoupees": list(p.decoupees),
        "non_reconcilies": list(p.non_reconcilies),
        "absents": list(p.absents),
    }


#: Titre de la section que ce module tient dans `ecarts.md`, écrit par `gf0014`.
SECTION_MUETTES = "## Briques muettes"


def rapport_muettes(graphe: Graphe, parcours: Sequence[Parcours]) -> str:
    """Section « Briques muettes » d'`ecarts.md` : les feuilles sans fiche à poser.

    Une brique muette est acquise d'entrée : le parcours ne peut rien en
    enseigner. Ce qui compte pour la relecture, c'est quels caractères de liste
    en dépendent — ce sont eux dont la décomposition est incomplète à l'écran.
    """
    lignes = [
        SECTION_MUETTES,
        "",
        "Feuilles sans fiche : composant de la norme sans point de code, ou forme"
        " absente du dictionnaire. Acquises d'entrée, faute d'avoir quoi que ce soit"
        " à poser. Voir le docstring de `graphe.py`.",
        "",
        f"Le graphe en compte {len(graphe.par_genre(MUETTE))} sur {len(graphe)} nœuds.",
        "",
    ]
    for p in parcours:
        lignes += [f"### {p.nom} ({p.liste})", ""]
        if not p.muettes:
            lignes += ["Aucune : toute brique de ce parcours porte une fiche.", ""]
            continue
        lignes += ["| Brique muette | Point de code | Caractères de la liste qui en dépendent |", "|---|---|---|"]
        cibles = set(p.cible)
        for muette in p.muettes:
            point = f"U+{ord(muette):04X}" if len(muette) == 1 else "—"
            dependants = sorted(
                c for c in cibles if c in graphe and muette in graphe.prerequis_transitifs(c)
            )
            lignes.append(f"| `{muette}` | {point} | {' '.join(dependants) or '—'} |")
        lignes.append("")
    decoupees = sorted({c for p in parcours for c in p.decoupees})
    if decoupees:
        lignes += [
            "### Découpées",
            "",
            "Sans fiche non plus, mais dessinées : leurs traits sont découpés dans un"
            " caractère hôte (`data/sources/surcharges/decoupes.tsv`). Acquises d'entrée"
            f" comme les muettes : {' '.join(f'`{c}`' for c in decoupees)}.",
            "",
        ]
    return "\n".join(lignes).rstrip() + "\n"


def ajouter_muettes_aux_ecarts(chemin: Path, section: str) -> Path:
    """Pose (ou remplace) la section des briques muettes à la fin d'`ecarts.md`.

    Remplacer plutôt qu'ajouter : deux passages de `wenlu build` doivent laisser
    le même fichier, même si `gf0014.build` n'a pas réécrit le rapport entre-temps.
    """
    ancien = chemin.read_text(encoding="utf-8") if chemin.exists() else ""
    tete = ancien.split(SECTION_MUETTES, 1)[0].rstrip()
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text((f"{tete}\n\n{section}" if tete else section), encoding="utf-8")
    return chemin


def etapes_du_parcours(nom: str, listes: Mapping[str, Sequence[str]]) -> list[tuple[str, tuple[str, ...]]]:
    """Les étapes d'un parcours, `(liste, caractères)`, telles que l'ingestion porte les listes.

    Une liste absente de l'ingestion est sautée ; sans la première, le parcours n'a pas
    d'étape : il n'est pas écrit.
    """
    noms = ETAPES.get(nom, (PARCOURS.get(nom, ""),))
    if not noms or not listes.get(noms[0]):
        return []
    return [(liste, tuple(listes[liste])) for liste in noms if listes.get(liste)]


def _charger(
    sortie: Path, ingest: Path
) -> tuple[Graphe, dict[str, list[str]], dict[str, int]]:
    """Le graphe du build, les listes et les rangs de fréquence de l'ingestion."""
    from .decoupes import composants_decoupes

    document = json.loads((sortie / "decompositions.json").read_text(encoding="utf-8"))
    graphe = construire(document["caracteres"], composants_decoupes(sortie))
    fichier_listes = ingest / "listes.json"
    listes = json.loads(fichier_listes.read_text(encoding="utf-8")) if fichier_listes.exists() else {}
    fichier_caracteres = ingest / "caracteres.json"
    rangs = (
        rangs_frequence(json.loads(fichier_caracteres.read_text(encoding="utf-8")))
        if fichier_caracteres.exists()
        else {}
    )
    return graphe, listes, rangs


def calculer(
    sortie: Path | None = None,
    ingest: Path | None = None,
    depart: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, Parcours]:
    """L'ordre que le calcul proposerait aujourd'hui, pour chaque parcours, sans rien écrire.

    Lit `decompositions.json` et `decoupes.json` de `sortie`, comme `build`.
    """
    sortie = sortie or BUILD
    ingest = ingest or INGEST
    depart = DEPART if depart is None else depart
    graphe, listes, rangs = _charger(sortie, ingest)
    out: dict[str, Parcours] = {}
    for nom, liste in PARCOURS.items():
        etapes = etapes_du_parcours(nom, listes)
        if etapes:
            out[nom] = parcours(
                graphe, (), nom=nom, liste=liste, rangs=rangs, depart=depart.get(nom, ()), etapes=etapes
            )
    return out


def prolonger(
    sortie: Path | None = None,
    ingest: Path | None = None,
    dossier: Path | None = None,
    *,
    noms: Sequence[str] | None = None,
    depart: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, Parcours]:
    """Prolonge chaque ordre figé jusqu'au bout de ses étapes, et l'écrit ; rend les parcours.

    Les jours déjà figés restent tels quels, jour pour jour (les phrases des fiches, les
    trois lignes, les lettres et les examens écrits avec l'acquis d'un jour restent justes),
    jours de fermeture compris. La suite se calcule étape par étape,
    avec les règles de `parcours`. Sans ordre figé, tout se calcule depuis le départ. Le
    résultat est validé comme au build (`parcours_fige`) avant d'être écrit.
    """
    sortie = sortie or BUILD
    ingest = ingest or INGEST
    dossier = dossier or ORDRES
    depart = DEPART if depart is None else depart
    graphe, listes, rangs = _charger(sortie, ingest)
    dossier.mkdir(parents=True, exist_ok=True)
    ecrits: dict[str, Parcours] = {}
    for nom, liste in PARCOURS.items():
        if noms and nom not in noms:
            continue
        etapes = etapes_du_parcours(nom, listes)
        if not etapes:
            continue
        fige = charger_ordre(nom, dossier) or []
        calcule = parcours(
            graphe, (), nom=nom, liste=liste, rangs=rangs, depart=depart.get(nom, ()), etapes=etapes, prefixe=fige
        )
        p = parcours_fige(
            graphe, (), calcule.jours, nom=nom, liste=liste, depart=depart.get(nom, ()), etapes=etapes
        )
        chemin_ordre(nom, dossier).write_text(ecrire_ordre(p), encoding="utf-8")
        ecrits[nom] = p
    return ecrits


def parcours_du_document(nom: str, document: Mapping[str, object]) -> Parcours:
    """Le parcours que porte `parcours-<nom>.json` : ses jours et ses étapes."""
    return Parcours(
        nom=nom,
        liste=str(document.get("liste") or PARCOURS.get(nom, "")),
        jours=jours_du_document(document),
        etapes=tuple(
            Etape(liste=str(e["liste"]), cible=tuple(e.get("cible") or ()), fin=int(e["fin"]))
            for e in document.get("etapes") or ()  # type: ignore[union-attr]
        ),
    )


def figer(
    sortie: Path | None = None,
    ingest: Path | None = None,
    dossier: Path | None = None,
    *,
    recalculer: bool = False,
    noms: Sequence[str] | None = None,
) -> dict[str, str]:
    """Écrit `ordre-<nom>.tsv` pour chaque parcours ; rend {nom: chemin écrit}.

    Par défaut, fige l'ordre que porte déjà `parcours-<nom>.json` du build : c'est ainsi
    que le premier gel a repris, jour pour jour, l'ordre que l'apprenant voyait.
    `recalculer` écrit à la place l'ordre que le calcul propose aujourd'hui (`calculer`) :
    un changement voulu, à relire dans le diff du fichier avant de le versionner.
    """
    sortie = sortie or BUILD
    dossier = dossier or ORDRES
    dossier.mkdir(parents=True, exist_ok=True)
    calcules = calculer(sortie, ingest) if recalculer else {}
    ecrits: dict[str, str] = {}
    for nom in PARCOURS:
        if noms and nom not in noms:
            continue
        if recalculer:
            if nom not in calcules:
                continue
            p = calcules[nom]
        else:
            chemin = sortie / f"parcours-{nom}.json"
            if not chemin.exists():
                continue
            p = parcours_du_document(nom, json.loads(chemin.read_text(encoding="utf-8")))
        cible = chemin_ordre(nom, dossier)
        cible.write_text(ecrire_ordre(p), encoding="utf-8")
        ecrits[nom] = str(cible)
    return ecrits


def jours_du_document(document: Mapping[str, object]) -> tuple[Jour, ...]:
    """Les jours de `parcours-<nom>.json`."""
    return tuple(
        Jour(
            jour=int(j["jour"]),
            brique=j["brique"],
            composes=tuple(j["composes"]),
            non_reconcilie=bool(j["non_reconcilie"]),
        )
        for j in document["jours"]  # type: ignore[union-attr]
    )


def build(
    sortie: Path | None = None,
    ingest: Path | None = None,
    depart: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, object]:
    """Écrit `graphe.json` et un `parcours-<nom>.json` par parcours.

    `depart` vaut par défaut `DEPART` : chaque parcours commence par la
    première session. Les composants découpés sont ceux de `decoupes.json`, que
    `decoupes.build` a écrit dans `sortie`.

    L'ordre d'un parcours est lu dans son fichier figé (`ORDRES`) s'il existe, et
    validé contre le graphe (`OrdreInvalide` sinon) ; il n'est calculé qu'à défaut.
    Ses listes sont ses étapes (`ETAPES`), celles que l'ingestion porte.
    """
    sortie = sortie or BUILD
    ingest = ingest or INGEST
    depart = DEPART if depart is None else depart

    graphe, listes, rangs = _charger(sortie, ingest)
    boucles = cycles(graphe)
    ecrire_json(sortie / "graphe.json", document_graphe(graphe, boucles))

    familles = graphe.familles()
    rapport: dict[str, object] = {
        "noeuds": len(graphe),
        "aretes": len(graphe.aretes),
        "briques": len(graphe.par_genre(BRIQUE)),
        "muettes": len(graphe.par_genre(MUETTE)),
        "decoupees": len(graphe.par_genre(DECOUPEE)),
        "familles": f"{len(familles)} dont {sum(1 for f in familles if f.n)} non vides",
        "plus_grande_famille": f"{familles[0].racine} ({familles[0].n})" if familles else "—",
        "cycles": len(boucles),
        "frequence": "rang ingéré" if rangs else "nombre de dépendants",
    }
    ecrits: list[Parcours] = []
    for nom, liste in PARCOURS.items():
        etapes = etapes_du_parcours(nom, listes)
        if not etapes:
            rapport[f"parcours_{nom}"] = f"liste {liste} absente : parcours non écrit"
            continue
        fige = charger_ordre(nom)
        if fige is None:
            p = parcours(
                graphe, (), nom=nom, liste=liste, rangs=rangs, depart=depart.get(nom, ()), etapes=etapes
            )
            ordre = ORDRE_CALCULE
        else:
            p = parcours_fige(graphe, (), fige, nom=nom, liste=liste, depart=depart.get(nom, ()), etapes=etapes)
            ordre = ORDRE_FIGE.format(nom=nom)
        ecrits.append(p)
        ecrire_json(sortie / f"parcours-{nom}.json", document_parcours(p, ordre))
        rapport[f"parcours_{nom}"] = (
            f"{len(p.jours)} jours pour {p.cibles} caractères, ordre {ordre}"
            f" ({len(p.briques)} briques, {len(p.non_reconcilies)} non réconciliés,"
            f" {len(p.muettes)} briques muettes, {len(p.decoupees)} découpées ;"
            f" étapes : {', '.join(f'{e.liste} au jour {e.fin}' for e in p.etapes)})"
        )
    ajouter_muettes_aux_ecarts(sortie / "ecarts.md", rapport_muettes(graphe, ecrits))
    return rapport


# ----------------------------------------------------------------------------- check


def controles(sortie: Path | None = None) -> list[Controle]:
    """Contrôles du graphe et des parcours, pour `wenlu check`.

    Un cycle rend l'ordre d'apprentissage impossible : bloquant. Un caractère de
    liste absent de son parcours serait un caractère jamais enseigné : bloquant.
    Une brique muette est une feuille sans fiche ni traits : signalée, non
    bloquante. Une brique découpée a ses traits : elle n'est pas muette.
    """
    sortie = sortie or BUILD
    fichier = sortie / "graphe.json"
    if not fichier.exists():
        return [Controle("graphe", False, f"{fichier} absent : lancer `wenlu build`", True)]

    document = json.loads(fichier.read_text(encoding="utf-8"))
    boucles = document.get("cycles") or []
    resultats = [
        Controle(
            "cycles du graphe",
            not boucles,
            f"{len(boucles)} cycles"
            + (f" : {' ; '.join(' → '.join(b) for b in boucles[:3])}" if boucles else ""),
            bloquant=True,
        )
    ]

    manquants: list[str] = []
    non_figes: list[str] = []
    muettes: list[str] = []
    decoupees: set[str] = set()
    for nom in PARCOURS:
        chemin = sortie / f"parcours-{nom}.json"
        if not chemin.exists():
            resultats.append(
                Controle(f"parcours {nom}", False, f"{chemin} absent : lancer `wenlu build`", True)
            )
            continue
        p = json.loads(chemin.read_text(encoding="utf-8"))
        fige = charger_ordre(nom)
        if fige is None:
            non_figes.append(f"{nom} : aucun ordre figé ({chemin_ordre(nom).name})")
        elif list(jours_du_document(p)) != fige:
            non_figes.append(f"{nom} : le build ne suit pas l'ordre figé, relancer `wenlu build`")
        vus = {c for j in p["jours"] for c in ([j["brique"]] if j["brique"] else []) + j["composes"]}
        cibles = [c for e in p.get("etapes") or () for c in e.get("cible") or ()] or p["cible"]
        absents = [c for c in dict.fromkeys(cibles) if c not in vus]
        manquants += [f"{nom} : {' '.join(absents)}"] if absents else []
        muettes += [f"{nom} : {' '.join(p['briques_muettes'])}"] if p["briques_muettes"] else []
        decoupees.update(p.get("briques_decoupees") or ())

    resultats.append(
        Controle(
            "parcours figés",
            not non_figes,
            "; ".join(non_figes)
            if non_figes
            else "chaque parcours suit son ordre versionné (data/sources/parcours/)",
            bloquant=True,
        )
    )
    resultats.append(
        Controle(
            "caractères de liste absents du parcours",
            not manquants,
            "; ".join(manquants) if manquants else "aucun : toute liste cible est couverte",
            bloquant=True,
        )
    )
    resultats.append(
        Controle(
            "briques muettes",
            not muettes,
            ("; ".join(muettes) if muettes else "aucune : toute brique de liste se dessine")
            + (
                f" ; découpées dans un hôte, acquises d'entrée : {' '.join(sorted(decoupees))}"
                if decoupees
                else ""
            ),
        )
    )
    return resultats
