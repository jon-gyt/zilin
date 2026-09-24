"""Les vingt-quatre termes solaires (二十四节气) : leurs dates, leurs textes, leurs contrôles.

Deux sources versionnées dans `data/sources/saisons/`, lues par `wenlu export` qui en
tire `saisons.json` :

- `termes.tsv` : une ligne par terme, du 冬至 de 2025 (qui couvre les premiers jours
  de 2026) au dernier terme de 2035, avec le jour de son début et celui du terme
  suivant, à l'heure de Pékin. Écrit par `wenlu saisons calendrier`, qui calcule les
  termes avec `lunar_python` (MIT, hors ligne) ; jamais à la main.
- `textes.tsv` : pour chaque terme, son nom, sa traduction, son ambiance, la ligne qui
  dit ce qui se passe dans la nature, les phrases de Tao et le caractère à lire,
  rédigés pour l'app, avec leur source.

Un terme court de son jour de début jusqu'à la veille du suivant. Les fêtes gardent la
priorité (`fetes.py`) : l'app ne montre le terme que les jours sans fête. L'app ne
calcule aucune date et n'écrit aucun texte de terme : elle lit `saisons.json`.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable, Sequence

import typer

from .fetes import lire_tsv, traits_exportes, version_lunar
from .gf0014 import Controle
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "saisons"
TERMES = DOSSIER / "termes.tsv"
TEXTES = DOSSIER / "textes.tsv"


@dataclass(frozen=True)
class Terme:
    """Un terme solaire : son identifiant (le pinyin sans ton) et son nom."""

    id: str
    nom: str


#: Les vingt-quatre termes, dans l'ordre de l'année solaire chinoise, de 立春 à 大寒.
ORDRE: tuple[Terme, ...] = tuple(
    Terme(i, n)
    for i, n in (
        ("lichun", "立春"),
        ("yushui", "雨水"),
        ("jingzhe", "惊蛰"),
        ("chunfen", "春分"),
        ("qingming", "清明"),
        ("guyu", "谷雨"),
        ("lixia", "立夏"),
        ("xiaoman", "小满"),
        ("mangzhong", "芒种"),
        ("xiazhi", "夏至"),
        ("xiaoshu", "小暑"),
        ("dashu", "大暑"),
        ("liqiu", "立秋"),
        ("chushu", "处暑"),
        ("bailu", "白露"),
        ("qiufen", "秋分"),
        ("hanlu", "寒露"),
        ("shuangjiang", "霜降"),
        ("lidong", "立冬"),
        ("xiaoxue", "小雪"),
        ("daxue", "大雪"),
        ("dongzhi", "冬至"),
        ("xiaohan", "小寒"),
        ("dahan", "大寒"),
    )
)
PAR_NOM: dict[str, Terme] = {t.nom: t for t in ORDRE}
PAR_ID: dict[str, Terme] = {t.id: t for t in ORDRE}

#: Les ambiances : huit saisons de trois termes, chacune avec sa palette légère
#: (`[data-saison]` dans `tokens.css`) et son décor (`FeteDecor.svelte`). Le texte de
#: chaque terme dit la sienne ; l'app refuse une ambiance qu'elle ne connaît pas.
AMBIANCES: tuple[str, ...] = (
    "pecher",
    "pluie",
    "duvet",
    "lucioles",
    "rosee",
    "feuilles",
    "neige",
    "prunier",
)

#: Chaque jour de ces années grégoriennes doit avoir son terme.
ANNEES: tuple[int, int] = (2026, 2035)

#: Clés obligatoires de chaque terme, dans `textes.tsv`. `tao` se répète (une ou deux).
CLES_REQUISES: tuple[str, ...] = ("nom_zh", "pinyin", "fr", "ambiance", "ligne", "tao", "c", "sens")
#: Clés de la ligne `commun`, partagées par tous les termes.
CLES_COMMUNES: tuple[str, ...] = ("rubrique", "explication")
COMMUN = "commun"
TAO_MAX = 2

COLONNES_TERMES = ("terme", "nom", "debut", "heure", "fin", "source")


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Entree:
    """Un terme d'une année : son jour de début, l'heure exacte à Pékin, le jour du suivant."""

    terme: str
    nom: str
    debut: str
    heure: str
    fin: str
    source: str


def charger_termes(chemin: Path | None = None) -> list[Entree]:
    """Les entrées de `termes.tsv`, dans l'ordre du fichier. Une ligne illisible est sautée."""
    lignes, _ = lire_tsv(chemin or TERMES)
    entrees = []
    for ligne in lignes:
        c = ligne.cellules
        try:
            entrees.append(Entree(*(c[k] for k in COLONNES_TERMES)))
        except KeyError:
            continue
    return entrees


@dataclass(frozen=True)
class Texte:
    terme: str
    cle: str
    valeur: str
    source: str
    numero: int


def charger_textes(chemin: Path | None = None) -> list[Texte]:
    """Les lignes de `textes.tsv`, dans l'ordre du fichier : l'ordre des phrases de Tao compte."""
    lignes, _ = lire_tsv(chemin or TEXTES)
    return [
        Texte(
            terme=l.cellules.get("terme", ""),
            cle=l.cellules.get("cle", ""),
            valeur=l.cellules.get("valeur", ""),
            source=l.cellules.get("source", ""),
            numero=l.numero,
        )
        for l in lignes
    ]


def textes_par_terme(textes: Iterable[Texte]) -> dict[str, dict[str, list[str]]]:
    """`{terme: {clé: [valeurs]}}`, dans l'ordre du fichier."""
    out: dict[str, dict[str, list[str]]] = {}
    for t in textes:
        out.setdefault(t.terme, {}).setdefault(t.cle, []).append(t.valeur)
    return out


def caracteres_dessines(textes: Iterable[Texte]) -> list[str]:
    """Les caractères à lire des termes, que l'app dessine depuis leurs traits, triés."""
    return sorted({t.valeur for t in textes if t.cle == "c" and t.terme != COMMUN and t.valeur})


# ---------------------------------------------------------------------------- calcul


def _prochain(depuis: date) -> tuple[str, datetime]:
    """Le premier terme qui commence le jour `depuis` ou après, à l'heure de Pékin."""
    from lunar_python import Solar

    terme = Solar.fromYmd(depuis.year, depuis.month, depuis.day).getLunar().getNextJieQi()
    s = terme.getSolar()
    return str(terme.getName()), datetime(
        s.getYear(), s.getMonth(), s.getDay(), s.getHour(), s.getMinute(), s.getSecond()
    )


def calculer(de: int = ANNEES[0], a: int = ANNEES[1]) -> list[Entree]:
    """Les termes qui couvrent chaque jour des années `de` à `a`, dans l'ordre.

    La liste part du dernier terme commencé avant le 1er janvier de `de` (冬至) et va
    jusqu'au dernier terme commencé en `a` ; chaque entrée porte le jour de début du
    terme suivant (`fin`), où elle s'arrête. `lunar_python` donne l'instant du terme à
    l'heure de Pékin (UTC+8), comme le calendrier chinois le compte.
    """
    source = f"lunar_python {version_lunar()}, Lunar.getNextJieQi()"
    instants: list[tuple[str, datetime]] = []
    jour = date(de - 1, 12, 1)
    while True:
        nom, instant = _prochain(jour)
        instants.append((nom, instant))
        if instant.year > a:
            break
        jour = instant.date() + timedelta(days=1)
    # le premier terme retenu est le dernier commencé avant le 1er janvier de `de`
    premier = max(i for i, (_, t) in enumerate(instants) if t.date() <= date(de, 1, 1))
    entrees = []
    for (nom, instant), (_, suivant) in zip(instants[premier:], instants[premier + 1:]):
        entrees.append(
            Entree(
                terme=PAR_NOM[nom].id,
                nom=nom,
                debut=instant.date().isoformat(),
                heure=instant.strftime("%H:%M:%S"),
                fin=suivant.date().isoformat(),
                source=source,
            )
        )
    return entrees


def debut_de(nom: str, annee: int) -> date:
    """Le jour où commence le terme `nom` dans l'année grégorienne `annee`, à Pékin."""
    for e in calculer(annee, annee):
        if e.nom == nom and e.debut.startswith(str(annee)):
            return date.fromisoformat(e.debut)
    raise ValueError(f"terme {nom} introuvable en {annee}")  # pragma: no cover


def tsv_termes(entrees: Sequence[Entree]) -> str:
    """Le texte de `termes.tsv`, en-tête commenté compris."""
    lignes = [
        "# Les vingt-quatre termes solaires (二十四节气) : une ligne par terme.",
        "#",
        "# Écrit par `uv run wenlu saisons calendrier` : ne pas éditer à la main.",
        "# Source : instants des termes calculés hors ligne par la bibliothèque",
        f"# lunar_python {version_lunar()} (MIT, https://github.com/6tail/lunar-python), à l'heure",
        "# de Pékin (UTC+8), comme le calendrier chinois les compte. Contrôlés par les tests",
        "# contre des dates connues : 秋分 2026-09-23, 冬至 2026-12-22, 立春 2027-02-04.",
        "#",
        "# `debut` : le jour où le terme commence ; `heure` : l'instant exact, à Pékin ;",
        "# `fin` : le jour où commence le terme suivant. Un terme court de `debut` à la veille",
        "# de `fin`. La première ligne est le 冬至 de 2025, qui couvre les premiers jours de",
        "# 2026 : chaque jour de 2026 à 2035 a son terme.",
        "#",
        "\t".join(COLONNES_TERMES),
    ]
    for e in entrees:
        lignes.append("\t".join([e.terme, e.nom, e.debut, e.heure, e.fin, e.source]))
    return "\n".join(lignes) + "\n"


# -------------------------------------------------------------------------- contrôles


def fautes_termes(
    entrees: Sequence[Entree], *, annees: tuple[int, int] = ANNEES, recalculer: bool = True
) -> list[str]:
    """Ce qui cloche dans le calendrier des termes : dates, ordre, continuité, couverture.

    `recalculer` refait tout le calendrier avec `lunar_python` : une date retouchée à la
    main, ou une bibliothèque mise à jour qui changerait d'avis, se voit ici.
    """
    fautes: list[str] = []
    jours: list[tuple[date, date, Entree]] = []
    for e in entrees:
        nom = f"{e.nom} {e.debut}"
        terme = PAR_ID.get(e.terme)
        if terme is None or terme.nom != e.nom:
            fautes.append(f"{nom} : terme inconnu {e.terme!r}")
            continue
        try:
            debut, fin = date.fromisoformat(e.debut), date.fromisoformat(e.fin)
        except ValueError:
            fautes.append(f"{nom} : date illisible")
            continue
        if not 13 <= (fin - debut).days <= 17:
            fautes.append(f"{nom} : dure {(fin - debut).days} jours")
        if not e.source:
            fautes.append(f"{nom} : source vide")
        jours.append((debut, fin, e))
    for (_, fin, a), (debut, _, b) in zip(jours, jours[1:]):
        if fin != debut:
            fautes.append(f"{a.nom} {a.debut} finit le {fin}, {b.nom} commence le {debut}")
        attendu = ORDRE[(ORDRE.index(PAR_ID[a.terme]) + 1) % len(ORDRE)]
        if b.terme != attendu.id:
            fautes.append(f"{b.nom} {b.debut} : {attendu.nom} attendu après {a.nom}")
    if jours:
        if jours[0][0] > date(annees[0], 1, 1):
            fautes.append(f"le 1er janvier {annees[0]} n'a pas de terme")
        if jours[-1][1] <= date(annees[1], 12, 31):
            fautes.append(f"le 31 décembre {annees[1]} n'a pas de terme")
    else:
        fautes.append("aucun terme")
    if recalculer and not fautes:
        calcul = {(e.nom, e.debut) for e in calculer(*annees)}
        for e in entrees:
            if (e.nom, e.debut) not in calcul:
                fautes.append(f"{e.nom} {e.debut} : lunar_python donne une autre date")
    return fautes


def fautes_textes(textes: Sequence[Texte]) -> list[str]:
    """Ce qui manque ou cloche dans les textes des termes.

    Chaque terme a toutes ses clés, une seule fois (sauf `tao`, une ou deux phrases),
    aucune vide, une source ; son nom est celui du calendrier ; son ambiance est connue ;
    son caractère à lire est un seul caractère, propre à ce terme ; sa ligne tient en
    une phrase. Ni dragon ni 龙 : 惊蛰, c'est le tonnerre et les insectes.
    """
    fautes: list[str] = []
    connues = set(CLES_REQUISES)
    for t in textes:
        ou = f"textes.tsv:{t.numero}"
        if t.terme == COMMUN:
            if t.cle not in CLES_COMMUNES:
                fautes.append(f"{ou} : clé commune inconnue {t.cle!r}")
        elif t.terme not in PAR_ID:
            fautes.append(f"{ou} : terme inconnu {t.terme!r}")
        elif t.cle not in connues:
            fautes.append(f"{ou} : clé inconnue {t.cle!r}")
        if not t.valeur:
            fautes.append(f"{ou} : {t.terme} {t.cle} vide")
        if not t.source:
            fautes.append(f"{ou} : source vide")
        if "dragon" in t.valeur.lower() or "龙" in t.valeur:
            fautes.append(f"{ou} : pas de dragon")
    par_terme = textes_par_terme(textes)
    for cle in CLES_COMMUNES:
        if not any(par_terme.get(COMMUN, {}).get(cle, [])):
            fautes.append(f"commun : sans {cle}")
    vus: dict[str, str] = {}
    for terme in ORDRE:
        cles = par_terme.get(terme.id, {})
        manquantes = [c for c in CLES_REQUISES if not any(cles.get(c, []))]
        if manquantes:
            fautes.append(f"{terme.id} : sans {' '.join(manquantes)}")
            continue
        for cle, valeurs in cles.items():
            if cle != "tao" and len(valeurs) > 1:
                fautes.append(f"{terme.id} : {cle} en double")
        if len(cles["tao"]) > TAO_MAX:
            fautes.append(f"{terme.id} : {len(cles['tao'])} phrases de Tao, {TAO_MAX} au plus")
        if cles["nom_zh"][0] != terme.nom:
            fautes.append(f"{terme.id} : nom {cles['nom_zh'][0]}, attendu {terme.nom}")
        if cles["ambiance"][0] not in AMBIANCES:
            fautes.append(f"{terme.id} : ambiance inconnue {cles['ambiance'][0]!r}")
        c = cles["c"][0]
        if len(c) != 1:
            fautes.append(f"{terme.id} : c doit être un seul caractère")
        elif c in vus:
            fautes.append(f"{terme.id} : {c} est déjà le caractère de {vus[c]}")
        else:
            vus[c] = terme.id
        ligne = cles["ligne"][0]
        if not ligne.endswith(".") or ". " in ligne[:-1]:
            fautes.append(f"{terme.id} : la ligne doit tenir en une phrase")
    ambiances = {v for t in ORDRE for v in par_terme.get(t.id, {}).get("ambiance", [])}
    for a in AMBIANCES:
        if a not in ambiances:
            fautes.append(f"ambiance {a} sans terme")
    return fautes


def controles(
    destination: Path | None = None,
    *,
    termes: Path | None = None,
    textes: Path | None = None,
) -> list[Controle]:
    """Contrôles des termes solaires, pour `wenlu check`. Les trois sont bloquants.

    « calendrier » : dates lisibles, conformes à `lunar_python`, dans l'ordre des 24
    termes, sans trou ni chevauchement, chaque jour de 2026 à 2035 couvert. « textes » :
    chaque terme a toutes ses clés, sourcées et non vides, une ambiance connue, un
    caractère à lire qui lui est propre. « caractères dessinés » : le caractère de chaque
    terme se dessine depuis ses traits, qui doivent donc être dans l'export.
    """
    from .export import versions_exportees

    entrees = charger_termes(termes)
    _, forme = lire_tsv(termes or TERMES)
    lus = charger_textes(textes)
    _, forme_textes = lire_tsv(textes or TEXTES)

    f_cal = forme + fautes_termes(entrees)
    f_txt = forme_textes + fautes_textes(lus)

    dessines = caracteres_dessines(lus)
    absents: list[str] = []
    dossiers = versions_exportees(destination or EXPORT)
    for dossier in dossiers:
        presents = traits_exportes(dossier)
        absents += [f"{dossier.name}:{c}" for c in dessines if c not in presents]

    return [
        Controle(
            "saisons : calendrier",
            not f_cal,
            f"{len(entrees)} termes du {entrees[0].debut} au {entrees[-1].fin}, conformes à lunar_python"
            if not f_cal
            else f"{len(f_cal)} écarts — " + " ; ".join(f_cal[:5]),
            bloquant=True,
        ),
        Controle(
            "saisons : textes",
            not f_txt,
            f"{len(ORDRE)} termes en {len(AMBIANCES)} ambiances, {len(lus)} textes non vides et sourcés"
            if not f_txt
            else f"{len(f_txt)} écarts — " + " ; ".join(f_txt[:5]),
            bloquant=True,
        ),
        Controle(
            "saisons : caractères dessinés",
            not absents,
            (
                f"{len(dessines)} caractères dans les traits de {len(dossiers)} version(s) exportée(s)"
                if dossiers
                else "aucun export écrit : lancer `wenlu export`"
            )
            if not absents
            else f"sans traits exportés : {' '.join(absents)}",
            bloquant=True,
        ),
    ]


# -------------------------------------------------------------------------- export


def document(version: str, racines: dict[str, str], pinyin: dict[str, str], entete: dict[str, str]) -> dict[str, object]:
    """Le contenu de `saisons.json`, sans l'en-tête de licence que `export.py` pose.

    `calendrier` donne chaque terme, son jour de début et le jour du suivant ; `termes`,
    ses textes et son caractère à lire (`c`, son pinyin d'Unihan, son sens rédigé pour
    l'app) ; `rubrique` et `explication` présentent un terme le jour où il commence ; `ambiances`, la liste des ambiances connues ; `racines`, la famille de
    chaque caractère dessiné, pour trouver ses traits sans relire toutes les familles.
    """
    textes = charger_textes()
    par_terme = textes_par_terme(textes)

    def un(terme: str, cle: str) -> str:
        return (par_terme.get(terme, {}).get(cle) or [""])[0]

    return {
        "version": version,
        **entete,
        "rubrique": un(COMMUN, "rubrique"),
        "explication": un(COMMUN, "explication"),
        "ambiances": list(AMBIANCES),
        "calendrier": [
            {"terme": e.terme, "debut": e.debut, "fin": e.fin} for e in charger_termes()
        ],
        "termes": {
            t.id: {
                "nom_zh": un(t.id, "nom_zh"),
                "pinyin": un(t.id, "pinyin"),
                "fr": un(t.id, "fr"),
                "ambiance": un(t.id, "ambiance"),
                "ligne": un(t.id, "ligne"),
                "tao": list(par_terme.get(t.id, {}).get("tao") or []),
                "caractere": {
                    "c": un(t.id, "c"),
                    "pinyin": pinyin.get(un(t.id, "c"), ""),
                    "sens": un(t.id, "sens"),
                },
            }
            for t in ORDRE
            if t.id in par_terme
        },
        "racines": {c: racines[c] for c in caracteres_dessines(textes) if c in racines},
    }


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="Les vingt-quatre termes solaires : calendrier et textes.")


@app.command("calendrier")
def commande_calendrier(
    de: int = typer.Option(ANNEES[0], help="Première année grégorienne couverte."),
    a: int = typer.Option(ANNEES[1], help="Dernière année grégorienne couverte."),
) -> None:
    """Calcule les termes solaires et réécrit data/sources/saisons/termes.tsv."""
    entrees = calculer(de, a)
    texte = tsv_termes(entrees)
    ancien = TERMES.read_text(encoding="utf-8") if TERMES.exists() else None
    if ancien != texte:
        TERMES.parent.mkdir(parents=True, exist_ok=True)
        TERMES.write_text(texte, encoding="utf-8")
    typer.echo(
        f"{len(entrees)} termes du {entrees[0].debut} au {entrees[-1].fin} dans {TERMES}"
        f"{'' if ancien != texte else ' (inchangé)'}."
    )
