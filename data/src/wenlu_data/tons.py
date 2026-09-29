"""Les poids du classifieur des tons de « Dis-le » (story 9.1, brief §10, « L'oral par IA »).

L'app reconnaît le ton d'un caractère prononcé sur l'appareil, sans réseau : un suivi de
hauteur (YIN) et un petit ensemble de perceptrons (`app/src/lib/tons/`). Ses poids sont
une donnée, versionnée dans `data/sources/tons/` avec leur provenance :

- `modele.json` : les poids, tels que `entrainer.py` les a écrits (31 Ko, 3 225 paramètres) ;
- `PROVENANCE.md` : les sources et leurs empreintes, la licence, l'attribution exigée,
  la méthode d'entraînement et les mesures ;
- `preparer.py`, `entrainer.py` : la recette, avec `app/scripts/tons/extraire.ts`, qui
  calcule les caractéristiques avec le code même de l'app. Elle ne tourne pas en CI :
  l'audio brut (deux voix du jeu 5961 de data.gov.tw, 18 Mo) se télécharge à la main.

Les poids dérivent de données sous Open Government Data License 1.0 (Taïwan), compatible
CC BY 4.0, qui exige l'attribution (§3.2, faute de quoi la licence est nulle *ab initio*) :
`tons.json` la porte, `LICENCES.md` aussi, et l'export copie le texte de la licence
(`data/sources/licences/OGDL-Taiwan-1.0.txt`).

`wenlu export` écrit `tons.json`, que l'index nomme par sa clé `tons`. `wenlu check`
vérifie la taille, la forme, la licence et l'attribution, à la source et dans l'export.
"""
from __future__ import annotations

import json
from pathlib import Path

from .gf0014 import Controle
from .outils import empreinte_fichier
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "tons"
MODELE = DOSSIER / "modele.json"
PROVENANCE = DOSSIER / "PROVENANCE.md"
#: Le texte de la licence, avec les autres textes de licence versionnés.
LICENCE_TEXTE = DATA / "sources" / "licences" / "OGDL-Taiwan-1.0.txt"
OGDL = "OGDL-Taiwan-1.0.txt"
#: La décision d'ensemble sur les sources, qui doit nommer celle des tons.
SOURCES_LICENCES = DATA.parent / "docs" / "sources-licences.md"

#: Le fichier exporté, que l'index nomme par sa clé `tons`.
FICHIER = "tons.json"

#: Plafond de taille des poids (backlog 9.1 : « moins de 1 Mo »).
TAILLE_MAX = 1024 * 1024

#: Ce que le modèle doit être pour que l'app le lise (`classifieur.verifierModele`).
FORMAT = "wenlu-tons-mlp"
ENTREES = 34
CLASSES = [1, 2, 3, 4, 5]

LICENCE_DONNEES = "Open Government Data License 1.0 (OGDL-Taiwan-1.0), compatible CC BY 4.0"
URL_LICENCE = "https://data.gov.tw/license"
URL_JEU = "https://data.gov.tw/dataset/5961"

#: L'attribution exigée par l'OGDL 1.0 (§3.2 et son annexe) : le jeu, puis les deux phrases
#: de l'annexe, en chinois et en anglais, et l'adresse de la licence.
ATTRIBUTION = (
    f"Syllabes du mandarin, deux voix, jeu de données 5961 de data.gov.tw ({URL_JEU})."
    " 此開放資料依政府資料開放授權條款 (Open Government Data License) 進行公眾釋出，"
    "使用者於遵守本條款各項規定之前提下，得利用之。"
    " The Open Data is made available to the public under the Open Government Data License,"
    " User can make use of it when complying to the condition and obligation of its terms."
    f" Open Government Data License : {URL_LICENCE}"
)

#: Ce que l'attribution doit contenir, quoi qu'on en retouche.
ATTRIBUTION_EXIGEE = ("5961", "Open Government Data License", URL_LICENCE)

LICENCE_EXPORT = "propriétaire (poids Wenlu) ; données d'entraînement sous " + LICENCE_DONNEES
SOURCE_EXPORT = (
    "data/sources/tons/ : poids du classifieur des tons de « Dis-le », entraînés sur deux voix"
    " du jeu 5961 de data.gov.tw (OGDL 1.0) et des contours paramétriques ; provenance dans"
    " PROVENANCE.md"
)


def sources() -> list[tuple[str, Path]]:
    """Les fichiers dont `tons.json` est tiré, pour l'empreinte de l'export."""
    return [("tons-modele", MODELE), ("tons-licence", LICENCE_TEXTE)]


def charger(chemin: Path | None = None) -> dict[str, object]:
    """Les poids, relus tels quels."""
    return json.loads((chemin or MODELE).read_text(encoding="utf-8"))


def document(en_tete: dict[str, object], chemin: Path | None = None) -> dict[str, object]:
    """Le JSON écrit dans `tons.json` : l'en-tête, l'attribution, puis les poids tels quels."""
    return {**en_tete, "attribution": ATTRIBUTION, "license_file": OGDL, **charger(chemin)}


# ------------------------------------------------------------------------- contrôles


def fautes_modele(m: object) -> list[str]:
    """La forme que l'app exige : format, entrées, classes, couches cohérentes, température."""
    if not isinstance(m, dict):
        return ["poids hors format"]
    fautes: list[str] = []
    if m.get("format") != FORMAT:
        fautes.append(f"format {m.get('format')!r}, attendu {FORMAT}")
    if m.get("entrees") != ENTREES:
        fautes.append(f"{m.get('entrees')} entrées, attendu {ENTREES}")
    if m.get("classes") != CLASSES:
        fautes.append(f"classes {m.get('classes')}, attendu {CLASSES}")
    t = m.get("temperature")
    if not isinstance(t, (int, float)) or t <= 0:
        fautes.append("température absente")
    membres = m.get("membres")
    if not isinstance(membres, list) or not membres:
        return fautes + ["aucun membre"]
    for k, mb in enumerate(membres):
        norm = mb.get("normalisation", {}) if isinstance(mb, dict) else {}
        if len(norm.get("moyenne") or ()) != ENTREES or len(norm.get("ecart") or ()) != ENTREES:
            fautes.append(f"membre {k} : normalisation mal formée")
        n = ENTREES
        for c in (mb.get("couches") or ()) if isinstance(mb, dict) else ():
            poids, biais = c.get("poids") or [], c.get("biais") or []
            if len(poids) != len(biais) or any(len(ligne) != n for ligne in poids):
                fautes.append(f"membre {k} : couche mal formée")
                break
            n = len(biais)
        if n != len(CLASSES):
            fautes.append(f"membre {k} : sortie de {n}, attendu {len(CLASSES)}")
    return fautes


def parametres(m: dict[str, object]) -> int:
    """Le nombre de paramètres appris."""
    return sum(
        sum(len(ligne) for ligne in c["poids"]) + len(c["biais"])
        for mb in m["membres"]  # type: ignore[union-attr]
        for c in mb["couches"]
    )


def fautes_licence(m: dict[str, object]) -> list[str]:
    """Les poids disent leur licence : chaque donnée d'entraînement sous OGDL 1.0, attribuée."""
    licence = m.get("licence")
    if not isinstance(licence, dict):
        return ["bloc licence absent"]
    donnees = [d for d in licence.get("donnees") or () if isinstance(d, dict)]
    if not donnees:
        return ["aucune donnée d'entraînement déclarée"]
    fautes: list[str] = []
    for d in donnees:
        if d.get("usage") != "entraînement":
            continue
        if "OGDL" not in str(d.get("licence", "")):
            fautes.append(f"{d.get('nom')} : licence hors OGDL 1.0")
        if "Open Government Data License" not in str(d.get("attribution", "")):
            fautes.append(f"{d.get('nom')} : sans attribution")
    return fautes


def fautes_provenance(texte: str) -> list[str]:
    """La provenance dit la source, la licence, l'attribution et l'empreinte des poids."""
    fautes: list[str] = []
    empreinte = empreinte_fichier(MODELE) if MODELE.exists() else ""
    if empreinte and empreinte.removeprefix("sha256:") not in texte:
        fautes.append("PROVENANCE.md ne porte pas l'empreinte de modele.json")
    if LICENCE_TEXTE.exists() and empreinte_fichier(LICENCE_TEXTE).removeprefix("sha256:") not in texte:
        fautes.append(f"PROVENANCE.md ne porte pas l'empreinte de {OGDL}")
    for exige in (*ATTRIBUTION_EXIGEE, "OGDL", "entrainer.py"):
        if exige not in texte:
            fautes.append(f"PROVENANCE.md ne dit pas {exige!r}")
    return fautes


def fautes_export(sortie: object, index: dict[str, object], texte_licences: str, dossier: Path) -> list[str]:
    """`tons.json` porte les poids de la source, l'attribution, et reste sous le plafond."""
    fautes: list[str] = []
    if not isinstance(sortie, dict):
        return ["tons.json hors format"]
    source = charger()
    for cle, valeur in source.items():
        if sortie.get(cle) != valeur:
            fautes.append(f"{cle} n'est pas celui de la source")
    attribution = str(sortie.get("attribution", ""))
    for exige in ATTRIBUTION_EXIGEE:
        if exige not in attribution:
            fautes.append(f"attribution sans {exige!r}")
    if index.get("tons") != FICHIER:
        fautes.append(f"index.json ne nomme pas {FICHIER}")
    if "OGDL" not in texte_licences or URL_LICENCE not in texte_licences:
        fautes.append("LICENCES.md ne dit pas la licence des tons")
    if not (dossier / OGDL).exists():
        fautes.append(f"{OGDL} absent de l'export")
    taille = (dossier / FICHIER).stat().st_size
    if taille >= TAILLE_MAX:
        fautes.append(f"{taille} octets, plafond {TAILLE_MAX}")
    return fautes


def controles(destination: Path | None = None) -> list[Controle]:
    """Contrôles des poids des tons, pour `wenlu check`. Tous bloquants.

    « source » : `modele.json` a la forme que l'app lit, pèse moins de 1 Mo, déclare ses
    données d'entraînement sous OGDL 1.0 avec leur attribution ; `PROVENANCE.md` dit la
    source, la licence, l'attribution et l'empreinte des poids ; le texte de la licence est
    versionné ; `docs/sources-licences.md` nomme la source. « export » : `tons.json` porte
    les mêmes poids, l'attribution, reste sous le plafond, et l'index le nomme ; le texte de
    la licence et `LICENCES.md` l'accompagnent.
    """
    from .export import versions_exportees

    f_src: list[str] = []
    n = 0
    if not MODELE.exists():
        f_src.append("modele.json absent")
    else:
        taille = MODELE.stat().st_size
        if taille >= TAILLE_MAX:
            f_src.append(f"modele.json : {taille} octets, plafond {TAILLE_MAX}")
        m = charger()
        f_src += [f"modele.json : {f}" for f in fautes_modele(m)]
        if not f_src:
            n = parametres(m)
        f_src += [f"modele.json : {f}" for f in fautes_licence(m)]
    if not PROVENANCE.exists():
        f_src.append("PROVENANCE.md absent")
    else:
        f_src += fautes_provenance(PROVENANCE.read_text(encoding="utf-8"))
    if not LICENCE_TEXTE.exists():
        f_src.append(f"{OGDL} absent de data/sources/licences/")
    if not SOURCES_LICENCES.exists() or "OGDL" not in SOURCES_LICENCES.read_text(encoding="utf-8"):
        f_src.append("docs/sources-licences.md ne nomme pas la source des tons (OGDL 1.0)")

    dossiers = versions_exportees(destination or EXPORT)
    f_exp: list[str] = []
    for d in dossiers:
        fichier = d / FICHIER
        if not fichier.exists():
            f_exp.append(f"{d.name} : {FICHIER} absent, lancer `wenlu export`")
            continue
        index = json.loads((d / "index.json").read_text(encoding="utf-8"))
        licences = (d / "LICENCES.md").read_text(encoding="utf-8") if (d / "LICENCES.md").exists() else ""
        sortie = json.loads(fichier.read_text(encoding="utf-8"))
        f_exp += [f"{d.name} : {f}" for f in fautes_export(sortie, index, licences, d)]

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    taille_ko = MODELE.stat().st_size / 1024 if MODELE.exists() else 0
    return [
        Controle(
            "tons : poids",
            not f_src,
            detail(f_src, f"{taille_ko:.0f} Ko, {n} paramètres, OGDL 1.0 attribuée, provenance et empreintes"),
            bloquant=True,
        ),
        Controle(
            "tons : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} porte les poids, l'attribution et reste sous 1 Mo")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
