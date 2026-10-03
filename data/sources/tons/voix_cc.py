"""Les voix humaines du continent sous CC BY-SA, CC BY ou CC0, pour le classifieur des tons de
« Dis-le » (décision du propriétaire du 3 octobre 2026, « Voix CC BY-SA » ; `PROVENANCE.md`,
« Les voix humaines sous CC BY-SA »).

Les voix de Taïwan (OGDL) apprennent au modèle les tons de citation, mais leur ton 3 n'est pas
celui du continent ; les phrases de FLEURS et les voix de Kokoro n'ont pas aidé. Il faut des voix
humaines du continent qui disent des caractères et des mots isolés : Chen Wang et Yue Tan
(`hugolpz/audio-cmn`, CC BY-SA), et les enregistrements `cmn` de Lingua Libre (Wikimedia
Commons), chacun sous sa licence. En contrepartie, les poids passent sous CC BY-SA 4.0, avec
l'attribution de chaque source (`wenlu_data/tons.py`).

Trois temps, aucun son versionné :

1. `inventaire` (workflow `donnees`, étape `tons-cc` : le poste de développement n'atteint ni
   Commons ni Lingua Libre ni Shtooka) : la licence de chaque fichier `cmn` de Lingua Libre telle
   que Commons la déclare (`extmetadata` et texte de la page), les fiches des locuteurs sur Lingua
   Libre (langues, niveau, résidence), le `readme.txt` de Shtooka (`cmn-caen-tan`, Yue Tan) et le
   README de `hugolpz/audio-cmn`. Tout est gardé dans `licences-lues/` avec son SHA-256.
2. `choisir` (le poste, après `wenlu tout`) : écarte tout fichier dont la licence n'est pas
   CC BY-SA, CC BY ou CC0 (NC, ND, GFDL seule, inconnue), les locuteurs qui ne sont pas natifs
   ou pas du continent, et tout texte sans étiquette sûre. Le pinyin vient de la liste HSK et des
   lectures du dépôt (`fleurs.Lexique`), jamais de CC-CEDICT ; le ton étiqueté est celui que la
   voix fait (`voix_kokoro.etiqueter_mot`, règles de `fleurs.py` : 3-3, 不, 一, neutre). Écrit
   `voix-cc.json`, versionné.
3. `telecharger` (workflow, même étape) : l'audio de chaque fichier retenu, vérifié par son
   empreinte, décodé en WAV mono 16 kHz dans `data/work/tons/cc/`, jamais versionné ; puis
   `app/scripts/tons/voix.ts` en calcule les caractéristiques avec le code de l'app
   (`data/sources/tons/voix-cc/`, branche `donnees/tons-cc`).

    python3 data/sources/tons/voix_cc.py inventaire           # workflow donnees, étape tons-cc
    cd data && uv run python sources/tons/voix_cc.py choisir  # le poste, après la branche
    python3 data/sources/tons/voix_cc.py telecharger          # workflow, avec voix-cc.json
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import wave
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ICI = Path(__file__).resolve().parent
DATA = ICI.parents[1]
LUES = ICI / "licences-lues"
CHOIX = ICI / "voix-cc.json"
TRAVAIL = DATA / "work" / "tons" / "cc"
SORTIE = ICI / "voix-cc"

#: Les règles de Wikimedia demandent un agent qui dise qui appelle et pourquoi.
AGENT = "WenluDonnees/1.0 (https://github.com/jon-gyt/zilin ; workflow donnees, etape tons-cc)"
COMMONS = "https://commons.wikimedia.org/w/api.php"
LINGUALIBRE = "https://lingualibre.org/api.php"
#: Les catégories de Lingua Libre sur Commons : une par langue (code ISO 639-3).
PREFIXE_LL = "Lingua Libre pronunciation-"
LANGUES_LL = ("cmn", "zho")

#: `hugolpz/audio-cmn` au commit lu (30 mars 2021) : Chen Wang (syllabes) et Yue Tan (HSK).
AUDIO_CMN = "https://github.com/hugolpz/audio-cmn"
AUDIO_CMN_COMMIT = "ff9ed3d0c631195bd2c06f39450f3264c7124040"
SHTOOKA_README = "http://packs.shtooka.net/cmn-caen-tan/readme.txt"

#: Les pages lues en plus des métadonnées de Commons : la licence de Yue Tan (Shtooka), le
#: catalogue de Shtooka (d'autres voix `cmn` ?), le README d'audio-cmn (Chen Wang).
PAGES = {
    "shtooka-cmn-caen-tan-readme.txt": SHTOOKA_README,
    "shtooka-cmn-caen-tan-index.html": "http://packs.shtooka.net/cmn-caen-tan/",
    "shtooka-packs.html": "http://packs.shtooka.net/",
    "shtooka-telecharger.html": "http://shtooka.net/download.php",
    "audio-cmn-README.md": f"https://raw.githubusercontent.com/hugolpz/audio-cmn/{AUDIO_CMN_COMMIT}/README.md",
}

#: Les champs de licence que Commons tire des modèles de la page (`extmetadata`).
CHAMPS = ("LicenseShortName", "License", "LicenseUrl", "UsageTerms", "Copyrighted", "AttributionRequired",
          "Restrictions", "Artist", "Credit", "DateTimeOriginal")


# ------------------------------------------------------------------------------- réseau


def http(url: str, data: dict | None = None, essais: int = 5) -> tuple[int, bytes]:
    """GET (ou POST si `data`), avec l'agent et quelques reprises sur 429, 5xx et `maxlag`."""
    corps = urllib.parse.urlencode(data).encode() if data is not None else None
    for k in range(essais):
        req = urllib.request.Request(url, data=corps, headers={"User-Agent": AGENT})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and k < essais - 1:
                time.sleep(float(e.headers.get("Retry-After") or 5 * (k + 1)))
                continue
            return e.code, e.read() if e.fp else b""
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if k < essais - 1:
                time.sleep(5 * (k + 1))
                continue
            return 0, str(e).encode()
    return 0, b""


def api(base: str, **params) -> dict:
    """Un appel à l'API MediaWiki (POST, JSON, `formatversion=2`), repris si le serveur est en retard."""
    params = {"format": "json", "formatversion": "2", "maxlag": "5", **params}
    for k in range(6):
        code, octets = http(base, params)
        try:
            doc = json.loads(octets)
        except ValueError:
            raise RuntimeError(f"{base} {code} : {octets[:200]!r}") from None
        if doc.get("error", {}).get("code") == "maxlag":
            time.sleep(5 * (k + 1))
            continue
        return doc
    raise RuntimeError(f"{base} : maxlag persistant")


# ---------------------------------------------------------------------------- inventaire


def categories() -> list[str]:
    """Les catégories de Lingua Libre des langues chinoises qui existent sur Commons."""
    out = []
    for prefixe in ("Lingua Libre pronunciation-c", "Lingua Libre pronunciation-z"):
        doc = api(COMMONS, action="query", list="allcategories", acprefix=prefixe, aclimit="500")
        out += [c["category"] for c in doc.get("query", {}).get("allcategories", [])]
    return sorted(c for c in out if c.removeprefix(PREFIXE_LL).split("-")[0] in LANGUES_LL)


def membres(categorie: str) -> list[str]:
    """Les fichiers d'une catégorie (et de ses sous-catégories, un niveau)."""
    titres, sous, suite = [], [], {}
    while True:
        doc = api(COMMONS, action="query", list="categorymembers", cmtitle=f"Category:{categorie}",
                  cmtype="file|subcat", cmlimit="500", **suite)
        for m in doc.get("query", {}).get("categorymembers", []):
            (titres if m["ns"] == 6 else sous).append(m["title"])
        if "continue" not in doc:
            break
        suite = {k: v for k, v in doc["continue"].items() if k != "continue"}
    for s in sous:
        titres += membres(s.removeprefix("Category:"))
    return sorted(set(titres))


def fiches(titres: list[str]) -> list[dict]:
    """Pour chaque fichier : adresse, empreinte, taille, et sa licence lue deux fois : les champs
    que Commons tire des modèles de la page (`extmetadata`) et le texte même de la page."""
    out = []
    for i in range(0, len(titres), 50):
        lot = titres[i:i + 50]
        doc = api(COMMONS, action="query", titles="|".join(lot), prop="imageinfo|revisions",
                  iiprop="url|sha1|size|mime|timestamp|user|extmetadata",
                  iiextmetadatafilter="|".join(CHAMPS), rvprop="content|ids|timestamp", rvslots="main")
        for p in doc.get("query", {}).get("pages", []):
            ii = (p.get("imageinfo") or [{}])[0]
            rev = (p.get("revisions") or [{}])[0]
            meta = {k: v.get("value") for k, v in (ii.get("extmetadata") or {}).items()}
            out.append({
                "titre": p["title"], "pageid": p.get("pageid"), "url": ii.get("url"), "page": ii.get("descriptionurl"),
                "sha1": ii.get("sha1"), "octets": ii.get("size"), "mime": ii.get("mime"),
                "televerse": ii.get("timestamp"), "par": ii.get("user"), "licence": meta,
                "revision": rev.get("revid"), "texte": rev.get("slots", {}).get("main", {}).get("content"),
            })
        if i % 1000 == 0:
            print(f"  {i + len(lot)}/{len(titres)}", flush=True)
    return out


def modele_ll(texte: str | None) -> dict[str, str]:
    """Les paramètres du modèle {{Lingua Libre record}} d'une page (`speaker`, `speakerId`,
    `languageId`, `transcription`…), tels que RecordWizard les écrit."""
    m = re.search(r"\{\{\s*Lingua Libre record(.*?)\}\}", texte or "", re.S | re.I)
    if not m:
        return {}
    return {k: v.strip() for k, v in re.findall(r"(?:^|\n)\s*\|\s*(\w+)\s*=([^\n]*)", m.group(1))}


def entites(ids: list[str]) -> dict[str, dict]:
    """Les entités de Lingua Libre (Wikibase), par lots de 50."""
    out: dict[str, dict] = {}
    for i in range(0, len(ids), 50):
        doc = api(LINGUALIBRE, action="wbgetentities", ids="|".join(ids[i:i + 50]), props="labels|claims",
                  languages="fr|en|zh")
        out.update(doc.get("entities", {}))
    return out


def references(entites_: dict[str, dict]) -> set[str]:
    """Les propriétés et les éléments que citent les déclarations (et leurs qualificatifs)."""
    vus: set[str] = set()

    def valeur(snak: dict) -> None:
        vus.add(snak.get("property", ""))
        v = (snak.get("datavalue") or {}).get("value")
        if isinstance(v, dict) and v.get("id"):
            vus.add(v["id"])

    for e in entites_.values():
        for p, decl in (e.get("claims") or {}).items():
            vus.add(p)
            for d in decl:
                valeur(d.get("mainsnak", {}))
                for qs in (d.get("qualifiers") or {}).values():
                    for q in qs:
                        valeur(q)
    return {x for x in vus if re.fullmatch(r"[PQ]\d+", x)}


def ecrire(nom: str, octets: bytes, source: str, code: int, sommes: list[str]) -> None:
    (LUES / nom).write_bytes(octets)
    sommes.append(f"{code} {source} -> {nom} {hashlib.sha256(octets).hexdigest() if octets else '-'}")
    print(sommes[-1], flush=True)


def inventaire() -> None:
    LUES.mkdir(parents=True, exist_ok=True)
    sommes: list[str] = []
    for nom, url in PAGES.items():
        code, octets = http(url)
        ecrire(nom, octets, url, code, sommes)

    cats = categories()
    ecrire("commons-categories.json", json.dumps(cats, ensure_ascii=False, indent=1).encode(),
           f"{COMMONS}?list=allcategories&acprefix={PREFIXE_LL}", 200, sommes)
    tous: list[dict] = []
    for c in cats:
        titres = membres(c)
        print(f"{c} : {len(titres)} fichiers", flush=True)
        for f in fiches(titres):
            f["categorie"] = c
            tous.append(f)
    lignes = "".join(json.dumps(f, ensure_ascii=False, sort_keys=True) + "\n" for f in sorted(tous, key=lambda f: f["titre"]))
    ecrire("commons-lingualibre-cmn.jsonl", lignes.encode(), f"{COMMONS}?prop=imageinfo|revisions ({len(tous)} fichiers)", 200, sommes)

    # Les locuteurs : la fiche Lingua Libre de chacun (langues parlées et niveau, résidence),
    # puis les libellés des propriétés et des éléments qu'elles citent.
    ids = sorted({m.get("speakerId", "") for m in (modele_ll(f["texte"]) for f in tous)} - {""},
                 key=lambda q: int(q[1:]) if q[1:].isdigit() else 0)
    ids = [q for q in ids if re.fullmatch(r"Q\d+", q)]
    loc = entites(ids)
    refs = sorted(references(loc) - set(loc))
    libelles = entites(refs) if refs else {}
    doc = {"locuteurs": loc, "references": {k: {"labels": v.get("labels", {})} for k, v in libelles.items()}}
    ecrire("lingualibre-locuteurs.json", json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=True).encode(),
           f"{LINGUALIBRE}?action=wbgetentities ({len(ids)} locuteurs)", 200, sommes)

    # Chen Wang a-t-il une page sur Commons qui dise la version de sa licence ?
    for nom, q in (("commons-recherche-chen-wang.json", '"Chen Wang" pronunciation'),
                   ("commons-recherche-audio-cmn.json", '"audio-cmn"'),
                   ("commons-recherche-shtooka-cmn.json", 'shtooka "cmn"')):
        d = api(COMMONS, action="query", list="search", srsearch=q, srnamespace="6", srlimit="50")
        ecrire(nom, json.dumps(d, ensure_ascii=False, indent=1).encode(), f"{COMMONS}?list=search&srsearch={q}", 200, sommes)

    (LUES / "SHA256SUMS-tons-cc.txt").write_text("\n".join(sommes) + "\n", encoding="utf-8")
    resume(tous, loc)


def resume(tous: list[dict], loc: dict[str, dict]) -> None:
    """Le bilan de l'inventaire : fichiers par licence, par locuteur."""
    par_licence = Counter(str(f["licence"].get("LicenseShortName")) for f in tous)
    par_loc: dict[str, Counter] = defaultdict(Counter)
    for f in tous:
        m = modele_ll(f["texte"])
        par_loc[f"{m.get('speaker', '?')} ({m.get('speakerId', '?')})"][str(f["licence"].get("LicenseShortName"))] += 1
    print("\n### Lingua Libre, fichiers par licence\n")
    for k, n in par_licence.most_common():
        print(f"- {k} : {n}")
    print(f"\n### Locuteurs ({len(par_loc)}, fiches lues : {len(loc)})\n")
    for k, c in sorted(par_loc.items(), key=lambda kv: -sum(kv[1].values())):
        print(f"- {k} : {sum(c.values())} ({', '.join(f'{a} {b}' for a, b in c.most_common())})")


# ------------------------------------------------------------------------------- licences

#: Ce qu'une licence doit être pour qu'un fichier serve à l'entraînement : CC BY-SA, CC BY ou
#: CC0, de version connue. Tout le reste est écarté : NC (pas d'usage commercial), ND (pas
#: d'œuvre adaptée), GFDL seule, domaine public non déclaré CC0, licence absente ou inconnue.
LICENCE_CC = re.compile(r"^CC (BY-SA|BY) (\d\.\d)(?: ([A-Za-z-]+))?$|^CC0( 1\.0)?$")
EXCLUES = ("NC", "ND")


def licence_acceptee(nom: str | None) -> tuple[str, str] | None:
    """`CC BY-SA 4.0` → (`CC BY-SA`, `4.0`) ; `CC0` → (`CC0`, `1.0`) ; NC, ND ou inconnue → `None`."""
    if not nom:
        return None
    s = " ".join(str(nom).replace("CC-BY", "CC BY").split())
    if any(re.search(rf"\b{x}\b", s) for x in EXCLUES):
        return None
    m = LICENCE_CC.match(s)
    if not m:
        return None
    if m.group(1):
        return "CC " + m.group(1).upper(), m.group(2) + (f" {m.group(3)}" if m.group(3) else "")
    return "CC0", "1.0"


def licences_page(texte: str | None) -> list[str]:
    """Les modèles de licence écrits sur la page ({{cc-by-sa-4.0}}, {{self|cc-by-4.0}}…)."""
    out = []
    for m in re.finditer(r"\{\{\s*(?:self\s*\|)?\s*([^{}]*?)\s*\}\}", texte or "", re.I):
        for part in m.group(1).split("|"):
            p = part.strip().lower()
            if p.startswith(("cc-", "cc0", "gfdl", "pd-")):
                out.append(p)
    return out


def accord_page(nom: str | None, texte: str | None) -> bool:
    """La licence de `extmetadata` est bien un modèle de la page (pas une déduction de Commons)."""
    lu = licence_acceptee(nom)
    if lu is None:
        return False
    famille, version = lu
    attendu = {"CC BY-SA": "cc-by-sa-", "CC BY": "cc-by-", "CC0": "cc-zero"}[famille]
    modeles = licences_page(texte)
    if famille == "CC0":
        return any(m in ("cc-zero", "cc0") or m.startswith("cc-zero") for m in modeles)
    v = version.split()[0]
    return any(m.startswith(attendu + v) for m in modeles)


# --------------------------------------------------------------------------------- choix


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    sous = ap.add_subparsers(dest="commande", required=True)
    sous.add_parser("inventaire")
    a = ap.parse_args()
    if a.commande == "inventaire":
        inventaire()


if __name__ == "__main__":
    main()
