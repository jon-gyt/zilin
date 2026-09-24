"""Les fêtes du calendrier chinois : leurs dates, leurs textes, leurs contrôles.

Trois sources versionnées dans `data/sources/fetes/`, lues par `wenlu export`
qui en tire `fetes.json` :

- `calendrier.tsv` : une ligne par fête et par année, la date grégorienne et la
  fenêtre pendant laquelle l'app se met en fête. Écrit par `wenlu fetes
  calendrier`, qui calcule les dates du calendrier luni-solaire chinois avec
  `lunar_python` (MIT, hors ligne) ; jamais à la main.
- `textes.tsv` : le vœu, les phrases de Tao et l'anecdote de chaque fête,
  rédigés pour l'app, avec leur source.
- `animaux.tsv` : les douze animaux de l'année lunaire, pour le vœu du Nouvel An.

L'app ne calcule aucune date et n'écrit aucun texte de fête : elle lit
`fetes.json` et choisit la fête dont la fenêtre couvre la journée.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, timedelta
from importlib import metadata
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import typer

from .gf0014 import Controle
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "fetes"
CALENDRIER = DOSSIER / "calendrier.tsv"
TEXTES = DOSSIER / "textes.tsv"
ANIMAUX = DOSSIER / "animaux.tsv"


@dataclass(frozen=True)
class Regle:
    """Où tombe une fête dans l'année, et combien de jours l'app la fête.

    Deux sortes de fêtes. La plupart tombent à un jour du calendrier lunaire :
    `mois` et `jour` sont alors lunaires. Deux suivent un terme solaire (节气),
    à date presque fixe du calendrier grégorien : `terme` le nomme (清明, 冬至),
    `mois` dit le mois grégorien où le chercher à partir du 1er, et `jour` vaut 0.
    """

    id: str
    mois: int
    jour: int
    #: Jours de fête avant la date, et après.
    avant: int
    apres: int
    description: str
    #: Le terme solaire, pour une fête qui en suit un ; vide sinon.
    terme: str = ""


#: Les fêtes que l'app connaît, dans l'ordre de l'année. Les fenêtres ne se
#: chevauchent jamais (`fautes_calendrier` le vérifie).
#:
#: - 春节 : du réveillon 除夕 (veille du 1er jour du 1er mois) au 14e jour, −1 à +13 ;
#: - 元宵 : la fête des Lanternes, le 15e jour du 1er mois, son jour seulement ;
#: - 清明 : le terme solaire de début avril, de la veille au lendemain ;
#: - 端午 : le 5e jour du 5e mois, de deux jours avant au lendemain ;
#: - 七夕 : le 7e soir du 7e mois, de deux jours avant au soir même ;
#: - 中秋 : le 15e jour du 8e mois, de trois jours avant au lendemain ;
#: - 重阳 : le 9e jour du 9e mois, de la veille au lendemain ;
#: - 冬至 : le terme solaire de fin décembre, de la veille au lendemain.
REGLES: dict[str, Regle] = {
    "chunjie": Regle("chunjie", 1, 1, 1, 13, "1er jour du 1er mois lunaire, du réveillon au 14e jour"),
    "yuanxiao": Regle("yuanxiao", 1, 15, 0, 0, "15e jour du 1er mois lunaire, fête des Lanternes"),
    "qingming": Regle("qingming", 4, 0, 1, 1, "terme solaire 清明, début avril", terme="清明"),
    "duanwu": Regle("duanwu", 5, 5, 2, 1, "5e jour du 5e mois lunaire"),
    "qixi": Regle("qixi", 7, 7, 2, 0, "7e jour du 7e mois lunaire"),
    "zhongqiu": Regle("zhongqiu", 8, 15, 3, 1, "15e jour du 8e mois lunaire"),
    "chongyang": Regle("chongyang", 9, 9, 1, 1, "9e jour du 9e mois lunaire"),
    "dongzhi": Regle("dongzhi", 12, 0, 1, 1, "terme solaire 冬至, fin décembre", terme="冬至"),
}

#: Les années que le calendrier doit couvrir au moins.
ANNEES: tuple[int, int] = (2026, 2035)

#: Clés obligatoires de chaque fête, dans `textes.tsv`. `tao` se répète.
CLES_REQUISES: tuple[str, ...] = (
    "nom",
    "nom_zh",
    "voeu_zh",
    "voeu_pinyin",
    "voeu_fr",
    "tao",
    "anecdote_rubrique",
    "anecdote_c",
    "anecdote_sens",
    "anecdote_titre",
    "anecdote_texte",
)
CLES_FACULTATIVES: tuple[str, ...] = ("caractere_voeu",)

#: Jetons que l'app remplit au jour de la fête.
JETONS: frozenset[str] = frozenset({"animal", "quand"})
MOTIF_JETON = re.compile(r"\{([^{}]*)\}")

COLONNES_CALENDRIER = ("fete", "date", "avant", "apres", "annee_lunaire", "animal", "source")


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Ligne:
    """Une ligne de TSV, avec son numéro pour le dire dans un contrôle."""

    numero: int
    cellules: dict[str, str]


def lire_tsv(chemin: Path) -> tuple[list[Ligne], list[str]]:
    """Un TSV à en-tête : `#` en commentaire, la première ligne restante nomme les colonnes.

    Rend les lignes et les fautes de forme (nombre de cellules).
    """
    lignes: list[Ligne] = []
    fautes: list[str] = []
    entete: list[str] | None = None
    for numero, brute in enumerate(chemin.read_text(encoding="utf-8").splitlines(), start=1):
        if not brute.strip() or brute.lstrip().startswith("#"):
            continue
        cellules = [c.strip() for c in brute.split("\t")]
        if entete is None:
            entete = cellules
            continue
        if len(cellules) != len(entete):
            fautes.append(f"{chemin.name}:{numero} : {len(cellules)} cellules pour {len(entete)} colonnes")
            continue
        lignes.append(Ligne(numero, dict(zip(entete, cellules))))
    return lignes, fautes


@dataclass(frozen=True)
class Entree:
    """Une fête d'une année : sa date grégorienne, sa fenêtre, l'animal de l'année."""

    fete: str
    date: str
    avant: int
    apres: int
    annee: int
    animal: str
    source: str


@dataclass(frozen=True)
class Animal:
    rang: int
    hanzi: str
    pinyin: str
    fr: str


def charger_calendrier(chemin: Path | None = None) -> list[Entree]:
    """Les entrées du calendrier, dans l'ordre du fichier. Une ligne illisible est sautée."""
    lignes, _ = lire_tsv(chemin or CALENDRIER)
    entrees = []
    for ligne in lignes:
        c = ligne.cellules
        try:
            entrees.append(
                Entree(
                    fete=c["fete"],
                    date=c["date"],
                    avant=int(c["avant"]),
                    apres=int(c["apres"]),
                    annee=int(c["annee_lunaire"]),
                    animal=c["animal"],
                    source=c["source"],
                )
            )
        except (KeyError, ValueError):
            continue
    return entrees


def charger_animaux(chemin: Path | None = None) -> dict[int, Animal]:
    """Les douze animaux, par rang."""
    lignes, _ = lire_tsv(chemin or ANIMAUX)
    animaux: dict[int, Animal] = {}
    for ligne in lignes:
        c = ligne.cellules
        try:
            rang = int(c["rang"])
        except (KeyError, ValueError):
            continue
        animaux[rang] = Animal(rang, c.get("hanzi", ""), c.get("pinyin", ""), c.get("fr", ""))
    return animaux


def rang_animal(annee: int) -> int:
    """Le rang de l'animal d'une année lunaire : 2026 → 6 (Cheval), 2027 → 7 (Chèvre)."""
    return (annee - 4) % 12


@dataclass(frozen=True)
class Texte:
    fete: str
    cle: str
    valeur: str
    source: str
    numero: int


def charger_textes(chemin: Path | None = None) -> list[Texte]:
    """Les lignes de `textes.tsv`, dans l'ordre du fichier : l'ordre des phrases de Tao compte."""
    lignes, _ = lire_tsv(chemin or TEXTES)
    return [
        Texte(
            fete=l.cellules.get("fete", ""),
            cle=l.cellules.get("cle", ""),
            valeur=l.cellules.get("valeur", ""),
            source=l.cellules.get("source", ""),
            numero=l.numero,
        )
        for l in lignes
    ]


def textes_par_fete(textes: Iterable[Texte]) -> dict[str, dict[str, list[str]]]:
    """`{fête: {clé: [valeurs]}}`, dans l'ordre du fichier."""
    out: dict[str, dict[str, list[str]]] = {}
    for t in textes:
        out.setdefault(t.fete, {}).setdefault(t.cle, []).append(t.valeur)
    return out


def caracteres_dessines(textes: Iterable[Texte]) -> list[str]:
    """Les caractères que l'app dessine depuis leurs traits pour les fêtes, triés."""
    return sorted(
        {t.valeur for t in textes if t.cle in ("anecdote_c", "caractere_voeu") and t.valeur}
    )


# ---------------------------------------------------------------------------- calcul


def version_lunar() -> str:
    try:
        return metadata.version("lunar_python")
    except metadata.PackageNotFoundError:  # pragma: no cover - dépendance déclarée
        return "?"


def date_de(regle: Regle, annee: int) -> date:
    """La date grégorienne d'une fête pour une année lunaire, par `lunar_python`.

    Un terme solaire se cherche à partir du 1er du mois grégorien de la règle : le
    premier terme de ce nom qui suit, au jour de Pékin (UTC+8), comme le calendrier
    chinois le compte. 清明 et 冬至 tombent dans l'année lunaire de même numéro.
    """
    from lunar_python import Lunar, Solar

    if regle.terme:
        lunaire = Solar.fromYmd(annee, regle.mois, 1).getLunar()
        for _ in range(24):
            terme = lunaire.getNextJieQi()
            solaire = terme.getSolar()
            if terme.getName() == regle.terme:
                return date(solaire.getYear(), solaire.getMonth(), solaire.getDay())
            lunaire = solaire.next(1).getLunar()
        raise ValueError(f"terme solaire {regle.terme} introuvable en {annee}")  # pragma: no cover
    solaire = Lunar.fromYmd(annee, regle.mois, regle.jour).getSolar()
    return date(solaire.getYear(), solaire.getMonth(), solaire.getDay())


def appel_de(regle: Regle, annee: int) -> str:
    """L'appel à `lunar_python` qui donne la date, tel que la colonne `source` le cite."""
    if regle.terme:
        return f"Solar.fromYmd({annee}, {regle.mois}, 1).getLunar().getNextJieQi() → {regle.terme}"
    return f"Lunar.fromYmd({annee}, {regle.mois}, {regle.jour})"


def animal_de(annee: int) -> str:
    """L'animal de l'année lunaire, tel que `lunar_python` le nomme (马, 羊…)."""
    from lunar_python import Lunar

    return str(Lunar.fromYmd(annee, 1, 1).getYearShengXiao())


def calculer(de: int, a: int) -> list[Entree]:
    """Les fêtes des années lunaires `de` à `a` incluses, triées par date."""
    source = f"lunar_python {version_lunar()}"
    entrees = [
        Entree(
            fete=regle.id,
            date=date_de(regle, annee).isoformat(),
            avant=regle.avant,
            apres=regle.apres,
            annee=annee,
            animal=animal_de(annee),
            source=f"{source}, {appel_de(regle, annee)}",
        )
        for annee in range(de, a + 1)
        for regle in REGLES.values()
    ]
    return sorted(entrees, key=lambda e: e.date)


def tsv_calendrier(entrees: Sequence[Entree]) -> str:
    """Le texte de `calendrier.tsv`, en-tête commenté compris."""
    lignes = [
        "# Calendrier des fêtes : une ligne par fête et par année lunaire.",
        "#",
        "# Écrit par `uv run wenlu fetes calendrier` : ne pas éditer à la main.",
        "# Source : calendrier luni-solaire chinois (农历), dates calculées hors ligne",
        f"# par la bibliothèque lunar_python {version_lunar()} (MIT,"
        " https://github.com/6tail/lunar-python).",
        "# Contrôlées par les tests contre des dates connues, dont pour 2026 : 春节 02-17,",
        "# 元宵 03-03, 清明 04-05, 端午 06-19, 七夕 08-19, 中秋 09-25, 重阳 10-18, 冬至 12-22.",
        "# 清明 et 冬至 sont des termes solaires (节气), comptés au jour de Pékin (UTC+8).",
        "#",
        "# `avant` et `apres` : jours de fête avant et après la date. 春节 va du réveillon",
        "# 除夕 (−1) au 14e jour (+13) et 元宵 prend le 15e (0, 0) ; 清明 −1 à +1 ;",
        "# 端午 −2 à +1 ; 七夕 −2 à 0 ; 中秋 −3 à +1 ; 重阳 −1 à +1 ; 冬至 −1 à +1.",
        "# `annee_lunaire` : l'année lunaire qui porte la fête ; `animal`, son animal",
        "# (voir `animaux.tsv`, rang = (année − 4) mod 12).",
        "#",
        "\t".join(COLONNES_CALENDRIER),
    ]
    for e in entrees:
        lignes.append(
            "\t".join([e.fete, e.date, str(e.avant), str(e.apres), str(e.annee), e.animal, e.source])
        )
    return "\n".join(lignes) + "\n"


# -------------------------------------------------------------------------- contrôles


def fautes_calendrier(
    entrees: Sequence[Entree],
    animaux: Mapping[int, Animal],
    *,
    annees: tuple[int, int] = ANNEES,
    recalculer: bool = True,
) -> list[str]:
    """Ce qui cloche dans le calendrier : dates, fenêtres, animaux, couverture, chevauchements.

    `recalculer` refait chaque date avec `lunar_python` : une date retouchée à la
    main, ou une bibliothèque mise à jour qui changerait d'avis, se voit ici.
    """
    fautes: list[str] = []
    vues: dict[str, set[int]] = {f: set() for f in REGLES}
    fenetres: list[tuple[date, date, str]] = []
    for e in entrees:
        nom = f"{e.fete} {e.date}"
        regle = REGLES.get(e.fete)
        if regle is None:
            fautes.append(f"{nom} : fête inconnue")
            continue
        try:
            jour = date.fromisoformat(e.date)
        except ValueError:
            fautes.append(f"{nom} : date illisible")
            continue
        if e.avant < 0 or e.apres < 0:
            fautes.append(f"{nom} : fenêtre négative")
        if recalculer and date_de(regle, e.annee) != jour:
            fautes.append(f"{nom} : le calendrier lunaire donne {date_de(regle, e.annee)}")
        animal = animaux.get(rang_animal(e.annee))
        if animal is None or animal.hanzi != e.animal:
            fautes.append(f"{nom} : animal {e.animal}, attendu {animal.hanzi if animal else '?'}")
        if not e.source:
            fautes.append(f"{nom} : source vide")
        vues[e.fete].add(e.annee)
        fenetres.append((jour - timedelta(days=e.avant), jour + timedelta(days=e.apres), nom))
    for fete, annees_vues in vues.items():
        manquantes = [a for a in range(annees[0], annees[1] + 1) if a not in annees_vues]
        if manquantes:
            fautes.append(f"{fete} : années absentes {' '.join(map(str, manquantes))}")
    fenetres.sort()
    for (_, fin, a), (debut, _, b) in zip(fenetres, fenetres[1:]):
        if debut <= fin:
            fautes.append(f"{a} et {b} se chevauchent")
    if len(animaux) != 12 or sorted(animaux) != list(range(12)):
        fautes.append("animaux.tsv : il faut les douze rangs, de 0 à 11")
    return fautes


def fautes_textes(textes: Sequence[Texte], fetes: Iterable[str]) -> list[str]:
    """Ce qui manque ou cloche dans les textes : clés requises, vides, jetons, source."""
    fautes: list[str] = []
    connues = set(CLES_REQUISES) | set(CLES_FACULTATIVES)
    for t in textes:
        ou = f"textes.tsv:{t.numero}"
        if t.fete not in REGLES:
            fautes.append(f"{ou} : fête inconnue {t.fete!r}")
        if t.cle not in connues:
            fautes.append(f"{ou} : clé inconnue {t.cle!r}")
        if not t.valeur:
            fautes.append(f"{ou} : {t.fete} {t.cle} vide")
        if not t.source:
            fautes.append(f"{ou} : source vide")
        for jeton in MOTIF_JETON.findall(t.valeur):
            if jeton not in JETONS:
                fautes.append(f"{ou} : jeton inconnu {{{jeton}}}")
        if t.cle in ("anecdote_c", "caractere_voeu") and len(t.valeur) != 1:
            fautes.append(f"{ou} : {t.cle} doit être un seul caractère")
    par_fete = textes_par_fete(textes)
    for fete in sorted(set(fetes)):
        cles = par_fete.get(fete, {})
        manquantes = [c for c in CLES_REQUISES if not any(cles.get(c, []))]
        if manquantes:
            fautes.append(f"{fete} : sans {' '.join(manquantes)}")
        for cle, valeurs in cles.items():
            if cle != "tao" and len(valeurs) > 1:
                fautes.append(f"{fete} : {cle} en double")
    return fautes


def traits_exportes(dossier: Path) -> set[str]:
    """Les caractères dont une version exportée porte les traits."""
    presents: set[str] = set()
    for chemin in sorted((dossier / "traits").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        presents |= set(document.get("traits") or {})
    return presents


def controles(
    destination: Path | None = None,
    *,
    calendrier: Path | None = None,
    textes: Path | None = None,
    animaux: Path | None = None,
) -> list[Controle]:
    """Contrôles des fêtes, pour `wenlu check`. Les trois sont bloquants.

    « calendrier » : dates lisibles et conformes au calendrier lunaire, fenêtres,
    animal de l'année, années 2026 à 2035 couvertes, aucun chevauchement.
    « textes » : chaque fête du calendrier a toutes ses clés, aucune vide, des
    jetons connus et une source. « caractères dessinés » : l'anecdote et le 福 du
    vœu se dessinent depuis leurs traits, qui doivent donc être dans l'export.
    """
    from .export import versions_exportees

    entrees = charger_calendrier(calendrier)
    _, fautes_forme = lire_tsv(calendrier or CALENDRIER)
    lus = charger_textes(textes)
    _, fautes_forme_textes = lire_tsv(textes or TEXTES)
    table = charger_animaux(animaux)

    f_cal = fautes_forme + fautes_calendrier(entrees, table)
    f_txt = fautes_forme_textes + fautes_textes(lus, {e.fete for e in entrees} | set(REGLES))

    dessines = caracteres_dessines(lus)
    absents: list[str] = []
    dossiers = versions_exportees(destination or EXPORT)
    for dossier in dossiers:
        presents = traits_exportes(dossier)
        absents += [f"{dossier.name}:{c}" for c in dessines if c not in presents]

    annees = sorted({e.annee for e in entrees})
    return [
        Controle(
            "fêtes : calendrier",
            not f_cal,
            f"{len(entrees)} fêtes de {annees[0]} à {annees[-1]}, dates conformes au calendrier lunaire"
            if not f_cal and annees
            else f"{len(f_cal)} écarts — " + " ; ".join(f_cal[:5]),
            bloquant=True,
        ),
        Controle(
            "fêtes : textes",
            not f_txt,
            f"{len(REGLES)} fêtes, {len(lus)} textes non vides et sourcés"
            if not f_txt
            else f"{len(f_txt)} écarts — " + " ; ".join(f_txt[:5]),
            bloquant=True,
        ),
        Controle(
            "fêtes : caractères dessinés",
            not absents,
            (
                f"{' '.join(dessines)} dans les traits de {len(dossiers)} version(s) exportée(s)"
                if dossiers
                else "aucun export écrit : lancer `wenlu export`"
            )
            if not absents
            else f"sans traits exportés : {' '.join(absents)}",
            bloquant=True,
        ),
    ]


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="Les fêtes : calendrier luni-solaire et textes.")


@app.command("calendrier")
def commande_calendrier(
    de: int = typer.Option(ANNEES[0], help="Première année lunaire."),
    a: int = typer.Option(ANNEES[1], help="Dernière année lunaire."),
) -> None:
    """Calcule les dates des fêtes et réécrit data/sources/fetes/calendrier.tsv."""
    entrees = calculer(de, a)
    texte = tsv_calendrier(entrees)
    ancien = CALENDRIER.read_text(encoding="utf-8") if CALENDRIER.exists() else None
    if ancien != texte:
        CALENDRIER.parent.mkdir(parents=True, exist_ok=True)
        CALENDRIER.write_text(texte, encoding="utf-8")
    for e in entrees:
        typer.echo(f"{e.fete}\t{e.date}\t{e.animal}")
    typer.echo(f"{len(entrees)} fêtes dans {CALENDRIER}{'' if ancien != texte else ' (inchangé)'}.")
