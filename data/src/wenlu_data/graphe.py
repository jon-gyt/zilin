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

Familles : la racine d'un caractère est sa première brique dans l'ordre
d'écriture — critère volontairement simple et déterministe, en attendant les
rôles son / sens de la story 1.4, qui donneront la brique de sens. À défaut de
brique, la première feuille du dictionnaire, puis la première feuille tout
court, puis le caractère lui-même. Une famille est une racine et tout ce
qu'elle engendre.

Parcours : « lire » suit le seuil 255 (puis, plus tard, les seuils suivants),
« hsk » suit le HSK 1. Le même graphe sert aux deux ; seule la liste cible
change. L'ordre respecte le tri topologique — une brique avant tout ce qui la
contient — et, parmi les candidats prêts, donne la priorité aux caractères de la
liste cible, puis à la fréquence.

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

Départ : le parcours « lire » commence par ce que la première session enseigne
(brief §6, story 2.7) — 人, 大, 天, un jour chacun, sans composé. La première
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
from .paths import BUILD, INGEST

BRIQUE = "brique"
CARACTERE = "caractere"
MUETTE = "muette"

# Une session de 10 minutes : une brique nouvelle, puis un ou deux composés.
COMPOSES_PAR_JOUR = 2

# Parcours livrés en version 1 : nom du parcours -> nom de la liste cible.
PARCOURS: dict[str, str] = {"lire": "seuil-255", "hsk": "hsk-1"}

#: Ce que la première session enseigne, dans l'ordre (brief §6, story 2.7), et donc
#: le début imposé du parcours : un jour par caractère, sans composé. La famille de
#: départ de l'app (`app/public/data/demo/familles/人.json`) montre les mêmes, et un
#: test Vitest le vérifie contre l'export.
DEPART: dict[str, tuple[str, ...]] = {"lire": ("人", "大", "天")}

CRITERE_RACINE = "première brique dans l'ordre d'écriture"
CRITERE_FREQUENCE = (
    "nombre de caractères qui dépendent du candidat"
    " (Make Me a Hanzi ne fournit pas de rang de fréquence)"
)

_LOIN = 10**9


class CycleDetecte(ValueError):
    """Le graphe de dépendances boucle : aucun ordre d'apprentissage n'existe."""


class ParcoursBloque(ValueError):
    """Plus aucun candidat prêt alors que la liste cible n'est pas couverte."""


class DepartImpossible(ValueError):
    """Un caractère du départ imposé n'est pas à apprendre, ou pas encore lisible."""


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
        """Vrai si le nœud porte une fiche (tout sauf une feuille muette)."""
        return self.genre != MUETTE


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


def construire(caracteres: Iterable[Mapping[str, object]]) -> Graphe:
    """Construit le graphe depuis les entrées de `decompositions.json`.

    Une entrée dont les composants se réduisent au caractère lui-même est soit
    une brique de la norme (réconciliée), soit un caractère que la source ne
    décompose pas (non réconcilié) : dans les deux cas, une feuille.
    """
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
            noeuds[prerequis] = Noeud(c=prerequis, genre=MUETTE)
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
class Parcours:
    """L'ordre d'apprentissage d'une liste cible, jour par jour."""

    nom: str
    liste: str
    jours: tuple[Jour, ...]
    briques: tuple[str, ...] = ()
    muettes: tuple[str, ...] = ()
    non_reconcilies: tuple[str, ...] = ()
    absents: tuple[str, ...] = ()
    cible: tuple[str, ...] = ()
    depart: tuple[str, ...] = ()

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


def parcours(
    graphe: Graphe,
    cible: Sequence[str],
    *,
    nom: str = "lire",
    liste: str = "seuil-255",
    rangs: Mapping[str, int] | None = None,
    composes_par_jour: int = COMPOSES_PAR_JOUR,
    depart: Sequence[str] = (),
) -> Parcours:
    """Ordre d'apprentissage de `cible` : une brique nouvelle par jour.

    Les briques muettes sont acquises d'entrée, faute de fiche à poser. Les
    caractères absents du graphe ou non réconciliés ferment le parcours.

    `depart` impose les premiers jours : un caractère par jour, dans l'ordre donné,
    sans composé — c'est ce que la première session enseigne, rien de plus. Une
    brique y reste seule de son jour ; un caractère composé n'y entre que si ses
    briques sont déjà posées. Sinon, `DepartImpossible`.
    """
    rangs = rangs or {}
    positions = {c: i for i, c in enumerate(cible)}
    absents = tuple(c for c in cible if c not in graphe)
    non_reconcilies = tuple(c for c in cible if c in graphe and not graphe[c].reconcilie)
    cibles_ok = [c for c in cible if c in graphe and graphe[c].reconcilie]

    besoin: dict[str, int] = {}
    muettes: set[str] = set()
    a_apprendre: set[str] = set(cibles_ok)
    for c in cibles_ok:
        for p in graphe.prerequis_transitifs(c):
            besoin[p] = besoin.get(p, 0) + 1
            if graphe[p].genre == MUETTE:
                muettes.add(p)
            else:
                a_apprendre.add(p)

    acquis: set[str] = set(muettes)
    restant = set(cibles_ok)
    jours: list[Jour] = []
    briques: list[str] = []

    def pret(c: str) -> bool:
        return all(p in acquis for p in graphe[c].prerequis)

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

    for c in depart:
        if c not in a_apprendre or c in acquis:
            raise DepartImpossible(f"{nom} : {c} n'est pas à apprendre dans {liste}, ou deux fois")
        if not pret(c):
            manque = " ".join(p for p in graphe[c].prerequis if p not in acquis)
            raise DepartImpossible(f"{nom} : {c} n'est pas lisible au départ (il manque {manque})")
        poser(c)
        if graphe[c].genre == BRIQUE:
            briques.append(c)
            jours.append(Jour(jour=len(jours) + 1, brique=c))
        else:
            jours.append(Jour(jour=len(jours) + 1, brique=None, composes=(c,)))

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
                f"{nom} : {len(restant)} caractères jamais prêts"
                f" ({' '.join(sorted(restant)[:10])})"
            )
        jours.append(Jour(jour=len(jours) + 1, brique=brique, composes=tuple(composes)))

    reste = absents + non_reconcilies
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
        liste=liste,
        jours=tuple(jours),
        briques=tuple(briques),
        muettes=tuple(sorted(muettes)),
        non_reconcilies=tuple(non_reconcilies),
        absents=absents,
        cible=tuple(cible),
        depart=tuple(depart),
    )


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


def document_parcours(p: Parcours) -> dict[str, object]:
    """Contenu de `parcours-<nom>.json` (voir data/schema.md)."""
    return {
        "parcours": p.nom,
        "liste": p.liste,
        "regle": "une seule brique nouvelle par session de 10 minutes",
        "critere_frequence": CRITERE_FREQUENCE,
        "depart": list(p.depart),
        "cible": list(p.cible),
        "compte": {
            "cibles": p.cibles,
            "jours": len(p.jours),
            "jours_reconcilies": p.jours_reconcilies,
            "briques": len(p.briques),
            "muettes": len(p.muettes),
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


def build(
    sortie: Path | None = None,
    ingest: Path | None = None,
    depart: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, object]:
    """Écrit `graphe.json` et un `parcours-<nom>.json` par parcours.

    `depart` vaut par défaut `DEPART` : le parcours « lire » commence par la
    première session.
    """
    sortie = sortie or BUILD
    ingest = ingest or INGEST
    depart = DEPART if depart is None else depart

    document = json.loads((sortie / "decompositions.json").read_text(encoding="utf-8"))
    graphe = construire(document["caracteres"])
    boucles = cycles(graphe)
    ecrire_json(sortie / "graphe.json", document_graphe(graphe, boucles))

    fichier_listes = ingest / "listes.json"
    listes = json.loads(fichier_listes.read_text(encoding="utf-8")) if fichier_listes.exists() else {}
    fichier_caracteres = ingest / "caracteres.json"
    rangs = (
        rangs_frequence(json.loads(fichier_caracteres.read_text(encoding="utf-8")))
        if fichier_caracteres.exists()
        else {}
    )

    familles = graphe.familles()
    rapport: dict[str, object] = {
        "noeuds": len(graphe),
        "aretes": len(graphe.aretes),
        "briques": len(graphe.par_genre(BRIQUE)),
        "muettes": len(graphe.par_genre(MUETTE)),
        "familles": f"{len(familles)} dont {sum(1 for f in familles if f.n)} non vides",
        "plus_grande_famille": f"{familles[0].racine} ({familles[0].n})" if familles else "—",
        "cycles": len(boucles),
        "frequence": "rang ingéré" if rangs else "nombre de dépendants",
    }
    ecrits: list[Parcours] = []
    for nom, liste in PARCOURS.items():
        cible = listes.get(liste)
        if not cible:
            rapport[f"parcours_{nom}"] = f"liste {liste} absente : parcours non écrit"
            continue
        p = parcours(graphe, cible, nom=nom, liste=liste, rangs=rangs, depart=depart.get(nom, ()))
        ecrits.append(p)
        ecrire_json(sortie / f"parcours-{nom}.json", document_parcours(p))
        rapport[f"parcours_{nom}"] = (
            f"{len(p.jours)} jours pour {p.cibles} caractères"
            f" ({len(p.briques)} briques, {len(p.non_reconcilies)} non réconciliés,"
            f" {len(p.muettes)} briques muettes)"
        )
    ajouter_muettes_aux_ecarts(sortie / "ecarts.md", rapport_muettes(graphe, ecrits))
    return rapport


# ----------------------------------------------------------------------------- check


def controles(sortie: Path | None = None) -> list[Controle]:
    """Contrôles du graphe et des parcours, pour `wenlu check`.

    Un cycle rend l'ordre d'apprentissage impossible : bloquant. Un caractère de
    liste absent de son parcours serait un caractère jamais enseigné : bloquant.
    Une brique muette est une feuille sans fiche : signalée, non bloquante.
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
    muettes: list[str] = []
    for nom in PARCOURS:
        chemin = sortie / f"parcours-{nom}.json"
        if not chemin.exists():
            resultats.append(
                Controle(f"parcours {nom}", False, f"{chemin} absent : lancer `wenlu build`", True)
            )
            continue
        p = json.loads(chemin.read_text(encoding="utf-8"))
        vus = {c for j in p["jours"] for c in ([j["brique"]] if j["brique"] else []) + j["composes"]}
        absents = [c for c in p["cible"] if c not in vus]
        manquants += [f"{nom} : {' '.join(absents)}"] if absents else []
        muettes += [f"{nom} : {' '.join(p['briques_muettes'])}"] if p["briques_muettes"] else []

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
            "; ".join(muettes) if muettes else "aucune : toute brique de liste porte une fiche",
        )
    )
    return resultats
