"""Les poids du classifieur des tons de « Dis-le » (story 9.1, brief §10, « L'oral par IA »).

L'app reconnaît le ton d'un caractère prononcé sur l'appareil, sans réseau : un suivi de
hauteur (YIN) et un petit ensemble de perceptrons (`app/src/lib/tons/`). Ses poids sont
une donnée, versionnée dans `data/sources/tons/` avec leur provenance :

- `modele.json` : les poids, tels que `entrainer.py` les a écrits ;
- `PROVENANCE.md` : les sources et leurs empreintes, la licence, l'attribution exigée,
  la méthode d'entraînement et les mesures ;
- `preparer.py`, `entrainer.py`, `voix_cc.py` : la recette, avec `app/scripts/tons/`, qui
  calcule les caractéristiques avec le code même de l'app. Elle ne tourne pas en CI.

Les poids dérivent de données dont chacune exige une attribution :

- les voix de Taïwan, sous Open Government Data License 1.0, compatible CC BY 4.0 (§3.2 :
  faute d'attribution, la licence est nulle *ab initio*) ;
- depuis la décision du propriétaire du 3 octobre 2026 (« Voix CC BY-SA »), des voix humaines
  du continent sous CC BY-SA (ou CC BY, CC0), recensées une à une dans `VOIX_CC`. Un modèle qui
  en dérive est une œuvre adaptée : il passe sous **CC BY-SA 4.0** (la §3 b de la 4.0 ; la §4 b
  de la 3.0 permet de placer l'adaptation d'une œuvre 3.0 sous « a later version of this
  License »), et `tons.json` porte la licence, son lien, et l'attribution de chaque source.

`wenlu export` écrit `tons.json`, que l'index nomme par sa clé `tons`, avec les textes des
licences à côté. `wenlu check` vérifie la taille, la forme, la licence et l'attribution, à la
source et dans l'export, et refuse un modèle qui dérive d'une source dont l'attribution n'est
pas exportée.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .gf0014 import Controle
from .outils import empreinte_fichier
from .paths import DATA, EXPORT

DOSSIER = DATA / "sources" / "tons"
MODELE = DOSSIER / "modele.json"
PROVENANCE = DOSSIER / "PROVENANCE.md"
LICENCES = DATA / "sources" / "licences"
#: Le texte de la licence des voix de Taïwan, avec les autres textes de licence versionnés.
LICENCE_TEXTE = LICENCES / "OGDL-Taiwan-1.0.txt"
OGDL = "OGDL-Taiwan-1.0.txt"
#: Le texte de la licence des poids dérivés de voix CC BY-SA (spdx/license-list-data).
CC_BY_SA = "CC-BY-SA-4.0.txt"
CC_BY_SA_TEXTE = LICENCES / CC_BY_SA
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
#: de l'annexe, en chinois et en anglais, et l'adresse de la licence. Gardée telle quelle.
ATTRIBUTION = (
    "數位發展部 (ministère du Numérique de Taïwan), 2015 : CNS11643中文標準交換碼全字庫 (全字庫),"
    f" fichiers sonores (全字庫聲音檔), jeu de données 5961 de data.gov.tw ({URL_JEU})."
    " 此開放資料依政府資料開放授權條款 (Open Government Data License) 進行公眾釋出，"
    "使用者於遵守本條款各項規定之前提下，得利用之。"
    " The Open Data is made available to the public under the Open Government Data License,"
    " User can make use of it when complying to the condition and obligation of its terms."
    f" Open Government Data License : {URL_LICENCE}"
)

#: Ce que l'attribution doit contenir, quoi qu'on en retouche.
ATTRIBUTION_EXIGEE = ("5961", "Open Government Data License", URL_LICENCE)

# ------------------------------------------------------------------- licences des voix CC

#: La licence des poids qui dérivent d'une voix sous CC BY-SA.
LICENCE_POIDS_CC = "CC BY-SA 4.0"
URL_CC_BY_SA_4 = "https://creativecommons.org/licenses/by-sa/4.0/"

#: Les licences acceptées pour une voix, et l'adresse de leur texte. Rien d'autre : NC (pas
#: d'usage commercial), ND (pas d'œuvre adaptée), GFDL seule, inconnue.
URL_LICENCES_CC = {
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 3.0 US": "https://creativecommons.org/licenses/by-sa/3.0/us/",
    "CC BY-SA 2.5": "https://creativecommons.org/licenses/by-sa/2.5/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
    "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
}

#: Ce qui a été fait de chaque voix, que la CC BY-SA demande d'indiquer (« modifié »).
MODIFICATION = (
    "modifié : courbes de hauteur calculées par Wenlu sur chaque enregistrement, dont ont été appris"
    " les poids ; aucun son n'est distribué"
)

#: Les voix humaines dont les poids peuvent dériver, par leur clé (`voix_cc.py`, `entrainer.py`),
#: avec ce que leur licence exige d'attribuer : l'auteur, le titre, le lien, la licence et sa
#: version (lues dans `licences-lues/`, `PROVENANCE.md`). Relu à la main : un modèle qui nomme
#: une source d'entraînement absente d'ici est refusé, faute d'attribution exportée.
VOIX_CC: dict[str, dict[str, str]] = {
    # readme de la collection (packs.shtooka.net, par l'Internet Archive) : « Copyright (c) 2009
    # Yue Tan », « Creative Commons Attribution Share Alike 3.0 United States » ; sa §4 b permet
    # de placer l'œuvre adaptée sous une version ultérieure (la 4.0).
    "cc-yue-tan": {
        "auteur": "Yue Tan",
        "titre": "Collection audio libre de mots chinois (mandarins) enregistrée par l'université de Caen"
                 " (Shtooka, cmn-caen-tan), © 2009 Yue Tan",
        "lien": "http://packs.shtooka.net/cmn-caen-tan/",
        "licence": "CC BY-SA 3.0 US",
    },
    # Lingua Libre : la licence lue sur la page Commons de chaque fichier (modèle de licence et
    # `extmetadata`), toutes les mêmes pour un locuteur.
    "cc-ll-Q812770": {
        "auteur": "Fake estate",
        "titre": "enregistrements cmn de Lingua Libre (Wikimedia Commons, « LL-Q9192 (cmn)-Fake estate-… »)",
        "lien": "https://lingualibre.org/wiki/Q812770",
        "licence": "CC BY-SA 4.0",
    },
    "cc-ll-Q1332695": {
        "auteur": "Jouketou",
        "titre": "enregistrements cmn de Lingua Libre (Wikimedia Commons, « LL-Q9192 (cmn)-Jouketou-… »)",
        "lien": "https://lingualibre.org/wiki/Q1332695",
        "licence": "CC BY-SA 4.0",
    },
    "cc-ll-Q301531": {
        "auteur": "Luilui6666",
        "titre": "enregistrements cmn de Lingua Libre (Wikimedia Commons, « LL-Q9192 (cmn)-Luilui6666-… »)",
        "lien": "https://lingualibre.org/wiki/Q301531",
        "licence": "CC BY-SA 4.0",
    },
    # CC0 : aucune attribution exigée, donnée tout de même.
    "cc-ll-Q1431140": {
        "auteur": "CanonNi",
        "titre": "enregistrements cmn de Lingua Libre (Wikimedia Commons, « LL-Q9192 (cmn)-CanonNi-… »)",
        "lien": "https://lingualibre.org/wiki/Q1431140",
        "licence": "CC0 1.0",
    },
}


def licence_refusee(licence: str | None) -> str | None:
    """Pourquoi une licence de voix ne permet pas d'en dériver les poids, ou `None` : chaque
    licence d'une liste (« CC BY-SA 4.0 ; CC BY 4.0 ») doit être CC BY-SA, CC BY ou CC0, de
    version connue, jamais NC ni ND."""
    if not licence:
        return "licence absente"
    for part in (p.strip() for p in str(licence).split(";")):
        if re.search(r"\b(NC|ND)\b", part):
            return f"{part} : NC ou ND, pas d'usage commercial ou pas d'œuvre adaptée"
        if part not in URL_LICENCES_CC:
            return f"{part} : licence inconnue ou version non précisée"
    return None


def texte_attribution(v: dict[str, str]) -> str:
    """L'attribution d'une voix CC : auteur, titre, lien, licence et version avec son adresse,
    et ce qui a été modifié (CC BY-SA 4.0 §3 a 1 ; 3.0 §4 c)."""
    licences = " ; ".join(f"{p.strip()} ({URL_LICENCES_CC[p.strip()]})" for p in v["licence"].split(";"))
    return f"{v['auteur']}, « {v['titre']} », {v['lien']}, {licences} — {MODIFICATION}."


def donnees_entrainement(m: dict[str, object]) -> list[dict[str, object]]:
    licence = m.get("licence")
    if not isinstance(licence, dict):
        return []
    return [d for d in licence.get("donnees") or () if isinstance(d, dict) and d.get("usage") == "entraînement"]


def est_ogdl(d: dict[str, object]) -> bool:
    return "OGDL" in str(d.get("licence", "")) and not d.get("cle")


def voix_du_modele(m: dict[str, object]) -> list[str]:
    """Les clés des voix CC dont le modèle dérive."""
    return [str(d.get("cle")) for d in donnees_entrainement(m) if not est_ogdl(d)]


def sous_cc_by_sa(m: dict[str, object]) -> bool:
    """Le modèle dérive-t-il d'une voix sous CC BY-SA (il est alors sous CC BY-SA 4.0) ?"""
    return any("BY-SA" in VOIX_CC.get(k, {}).get("licence", "BY-SA") for k in voix_du_modele(m))


def attributions(m: dict[str, object]) -> list[str]:
    """L'attribution de chaque source dont les poids dérivent : l'OGDL telle quelle, puis
    chaque voix CC, dans l'ordre du modèle."""
    out = []
    for d in donnees_entrainement(m):
        if est_ogdl(d):
            out.append(ATTRIBUTION)
        elif str(d.get("cle")) in VOIX_CC:
            out.append(texte_attribution(VOIX_CC[str(d["cle"])]))
    return out


def licence_export(m: dict[str, object]) -> str:
    if sous_cc_by_sa(m):
        return (f"{LICENCE_POIDS_CC} ({URL_CC_BY_SA_4}) : poids appris sur des voix sous {LICENCE_DONNEES}"
                " et sous CC BY-SA, attribuées une à une ; le code de l'app reste propriétaire")
    return "propriétaire (poids Wenlu) ; données d'entraînement sous " + LICENCE_DONNEES


def source_export(m: dict[str, object]) -> str:
    voix = [VOIX_CC[k]["auteur"] for k in voix_du_modele(m) if k in VOIX_CC]
    plus = f", et sur les voix de {', '.join(voix)} (CC)" if voix else ""
    return (
        "data/sources/tons/ : poids du classifieur des tons de « Dis-le », entraînés sur deux voix"
        f" du jeu 5961 de data.gov.tw (OGDL 1.0){plus} et des contours paramétriques ; provenance dans"
        " PROVENANCE.md"
    )


def fichiers_licence(m: dict[str, object]) -> list[str]:
    """Les textes de licence qui accompagnent `tons.json` dans l'export."""
    return [OGDL, CC_BY_SA] if sous_cc_by_sa(m) else [OGDL]


# Compatibilité : la licence et la source des poids versionnés.
def _modele_ou_vide() -> dict[str, object]:
    return charger() if MODELE.exists() else {}


def sources() -> list[tuple[str, Path]]:
    """Les fichiers dont `tons.json` est tiré, pour l'empreinte de l'export."""
    return [("tons-modele", MODELE), ("tons-licence", LICENCE_TEXTE), ("tons-licence-cc", CC_BY_SA_TEXTE)]


def charger(chemin: Path | None = None) -> dict[str, object]:
    """Les poids, relus tels quels."""
    return json.loads((chemin or MODELE).read_text(encoding="utf-8"))


def document(en_tete: dict[str, object], chemin: Path | None = None) -> dict[str, object]:
    """Le JSON écrit dans `tons.json` : l'en-tête, la licence, l'attribution de chaque source,
    puis les poids tels quels."""
    m = charger(chemin)
    doc: dict[str, object] = {
        **en_tete,
        "license": licence_export(m),
        "source": source_export(m),
        "attribution": " ".join(attributions(m)),
        "attributions": attributions(m),
        "license_file": fichiers_licence(m)[-1],
        "license_files": fichiers_licence(m),
    }
    if sous_cc_by_sa(m):
        doc["license_url"] = URL_CC_BY_SA_4
    return {**doc, **m}


def lignes_licences(m: dict[str, object] | None = None) -> list[tuple[str, str, str, str, str]]:
    """Les lignes de `LICENCES.md` des voix CC dont les poids dérivent (après celle de Taïwan)."""
    m = _modele_ou_vide() if m is None else m
    out = []
    for k in voix_du_modele(m):
        v = VOIX_CC.get(k)
        if not v:
            continue
        out.append((
            f"Voix de {v['auteur']} : {v['titre']}",
            f"entraînement des poids du classifieur des tons de « Dis-le » (`{FICHIER}`, sous"
            f" {LICENCE_POIDS_CC}) ; aucun son n'est embarqué",
            v["licence"],
            texte_attribution(v),
            f"`{CC_BY_SA}` ; " + ", ".join(URL_LICENCES_CC[p.strip()] for p in v["licence"].split(";")),
        ))
    return out


def ligne_separation(m: dict[str, object] | None = None) -> list[str]:
    """La puce de `LICENCES.md` qui dit sous quel régime `tons.json` est publié."""
    m = _modele_ou_vide() if m is None else m
    if sous_cc_by_sa(m):
        return [
            f"- `{FICHIER}` : les poids du classifieur des tons, sous {LICENCE_POIDS_CC} ({URL_CC_BY_SA_4}),"
            f" œuvre adaptée de voix sous CC BY-SA et de données sous {LICENCE_DONNEES} ; le fichier porte"
            f" sa licence et l'attribution de chaque source (`attributions`), `{CC_BY_SA}` et `{OGDL}` les"
            " textes des licences. Le code de l'app reste propriétaire.",
        ]
    return [
        f"- `{FICHIER}` : les poids du classifieur des tons, propriétaires, dérivés de"
        f" données sous {LICENCE_DONNEES} ; ils portent l'attribution exigée, et"
        f" `{OGDL}` le texte de la licence.",
    ]


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


def fautes_licence(m: dict[str, object], voix: dict[str, dict[str, str]] | None = None) -> list[str]:
    """Les poids disent leur licence : chaque donnée d'entraînement est l'OGDL 1.0 attribuée, ou
    une voix de `VOIX_CC` (attribution exportée), sous une licence qui permet d'en dériver des
    poids (jamais NC ni ND), déclarée comme `VOIX_CC` la déclare ; dès qu'une voix est sous
    CC BY-SA, les poids se déclarent sous CC BY-SA 4.0."""
    voix = VOIX_CC if voix is None else voix
    licence = m.get("licence")
    if not isinstance(licence, dict):
        return ["bloc licence absent"]
    donnees = [d for d in licence.get("donnees") or () if isinstance(d, dict)]
    if not donnees:
        return ["aucune donnée d'entraînement déclarée"]
    fautes: list[str] = []
    by_sa = False
    for d in donnees:
        if d.get("usage") != "entraînement":
            continue
        if not d.get("cle"):
            if "OGDL" not in str(d.get("licence", "")):
                fautes.append(f"{d.get('nom')} : licence hors OGDL 1.0, et aucune voix CC nommée")
            if "Open Government Data License" not in str(d.get("attribution", "")):
                fautes.append(f"{d.get('nom')} : sans attribution")
            continue
        cle = str(d["cle"])
        refus = licence_refusee(str(d.get("licence") or "") + (f" {d['version']}" if d.get("version") else ""))
        if refus:
            fautes.append(f"{cle} : {refus}")
        v = voix.get(cle)
        if v is None:
            fautes.append(f"{cle} : source sans attribution exportée (absente de tons.VOIX_CC)")
            continue
        declaree = str(d.get("licence") or "") + (f" {d['version']}" if d.get("version") else "")
        if declaree != v["licence"]:
            fautes.append(f"{cle} : licence {declaree!r} dans le modèle, {v['licence']!r} attribuée")
        manque = [c for c in ("auteur", "titre", "lien", "licence") if not v.get(c)]
        if manque:
            fautes.append(f"{cle} : attribution sans {', '.join(manque)}")
        by_sa = by_sa or "BY-SA" in v["licence"]
    if by_sa and licence.get("poids") != LICENCE_POIDS_CC:
        fautes.append(f"poids dérivés de voix CC BY-SA, déclarés {licence.get('poids')!r} au lieu de {LICENCE_POIDS_CC}")
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
    m = _modele_ou_vide()
    if sous_cc_by_sa(m):
        if CC_BY_SA_TEXTE.exists() and empreinte_fichier(CC_BY_SA_TEXTE) not in texte:
            fautes.append(f"PROVENANCE.md ne porte pas l'empreinte de {CC_BY_SA}")
        for k in voix_du_modele(m):
            v = VOIX_CC.get(k, {})
            if v.get("auteur") and v["auteur"] not in texte:
                fautes.append(f"PROVENANCE.md ne nomme pas {v['auteur']}")
    return fautes


def fautes_export(sortie: object, index: dict[str, object], texte_licences: str, dossier: Path) -> list[str]:
    """`tons.json` porte les poids de la source, sa licence, l'attribution de chaque source dont
    ils dérivent, reste sous le plafond ; `LICENCES.md` et les textes de licence l'accompagnent."""
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
    exportees = [str(a) for a in sortie.get("attributions") or ()]
    for k in voix_du_modele(source):
        v = VOIX_CC.get(k)
        if v is None:
            fautes.append(f"{k} : source sans attribution exportée")
            continue
        if texte_attribution(v) not in exportees:
            fautes.append(f"tons.json n'attribue pas {v['auteur']}")
        if v["auteur"] not in texte_licences:
            fautes.append(f"LICENCES.md n'attribue pas {v['auteur']}")
    if sous_cc_by_sa(source):
        if LICENCE_POIDS_CC not in str(sortie.get("license", "")) or sortie.get("license_url") != URL_CC_BY_SA_4:
            fautes.append(f"tons.json ne se dit pas sous {LICENCE_POIDS_CC} avec le lien de son texte")
        if not (dossier / CC_BY_SA).exists():
            fautes.append(f"{CC_BY_SA} absent de l'export")
        if URL_CC_BY_SA_4 not in texte_licences:
            fautes.append(f"LICENCES.md ne dit pas la licence {LICENCE_POIDS_CC} des tons")
    if index.get("tons") != FICHIER:
        fautes.append(f"index.json ne nomme pas {FICHIER}")
    if "OGDL" not in texte_licences or URL_LICENCE not in texte_licences:
        fautes.append("LICENCES.md ne dit pas la licence des tons")
    if not (dossier / OGDL).exists():
        fautes.append(f"{OGDL} absent de l'export")
    taille = (dossier / FICHIER).stat().st_size if (dossier / FICHIER).exists() else 0
    if taille >= TAILLE_MAX:
        fautes.append(f"{taille} octets, plafond {TAILLE_MAX}")
    return fautes


def controles(destination: Path | None = None) -> list[Controle]:
    """Contrôles des poids des tons, pour `wenlu check`. Tous bloquants.

    « source » : `modele.json` a la forme que l'app lit, pèse moins de 1 Mo, déclare chaque
    donnée d'entraînement (l'OGDL 1.0 attribuée, ou une voix CC de `VOIX_CC`, jamais NC ni ND),
    et se déclare sous CC BY-SA 4.0 s'il dérive d'une voix CC BY-SA ; `PROVENANCE.md` dit les
    sources, la licence, l'attribution et l'empreinte des poids ; les textes des licences sont
    versionnés ; `docs/sources-licences.md` nomme la source. « export » : `tons.json` porte les
    mêmes poids, la licence et l'attribution de chaque source, reste sous le plafond, et l'index
    le nomme ; les textes des licences et `LICENCES.md` l'accompagnent.
    """
    from .export import versions_exportees

    f_src: list[str] = []
    n = 0
    m: dict[str, object] = {}
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
    if sous_cc_by_sa(m) and not CC_BY_SA_TEXTE.exists():
        f_src.append(f"{CC_BY_SA} absent de data/sources/licences/")
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
    regime = f"{LICENCE_POIDS_CC}, {1 + len(voix_du_modele(m))} sources attribuées" if sous_cc_by_sa(m) else "OGDL 1.0 attribuée"
    return [
        Controle(
            "tons : poids",
            not f_src,
            detail(f_src, f"{taille_ko:.0f} Ko, {n} paramètres, {regime}, provenance et empreintes"),
            bloquant=True,
        ),
        Controle(
            "tons : export",
            not f_exp,
            detail(f_exp, f"{FICHIER} porte les poids, la licence, l'attribution de chaque source et reste sous 1 Mo")
            if dossiers
            else "aucun export écrit : lancer `wenlu export`",
            bloquant=True,
        ),
    ]
