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
    "shtooka-cmn-caen-tan-readme-https.txt": "https://packs.shtooka.net/cmn-caen-tan/readme.txt",
    # packs.shtooka.net ne répondait pas le 3 octobre 2026 : la copie de l'Internet Archive
    "shtooka-cmn-caen-tan-readme-archive.txt": "https://web.archive.org/web/2024id_/http://packs.shtooka.net/cmn-caen-tan/readme.txt",
    "shtooka-cmn-caen-tan-index-archive.html": "https://web.archive.org/web/2024id_/http://packs.shtooka.net/cmn-caen-tan/",
    "shtooka-packs-archive.html": "https://web.archive.org/web/2024id_/http://packs.shtooka.net/",
    "shtooka-accueil.html": "https://shtooka.net/",
    "audio-cmn-README.md": f"https://raw.githubusercontent.com/hugolpz/audio-cmn/{AUDIO_CMN_COMMIT}/README.md",
}

#: Les champs de licence que Commons tire des modèles de la page (`extmetadata`).
CHAMPS = ("LicenseShortName", "License", "LicenseUrl", "UsageTerms", "Copyrighted", "AttributionRequired",
          "Restrictions", "Artist", "Credit", "DateTimeOriginal")


# ------------------------------------------------------------------------------- réseau


def http(url: str, data: dict | None = None, essais: int = 5, delai: float = 60) -> tuple[int, bytes]:
    """GET (ou POST si `data`), avec l'agent et quelques reprises sur 429, 5xx et `maxlag`."""
    corps = urllib.parse.urlencode(data).encode() if data is not None else None
    for k in range(essais):
        req = urllib.request.Request(url, data=corps, headers={"User-Agent": AGENT})
        try:
            with urllib.request.urlopen(req, timeout=delai) as r:
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
        code, octets = http(base, params, essais=3)
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
        code, octets = http(url, essais=2, delai=30)
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
    # puis les libellés des propriétés et des éléments qu'elles citent. Lingua Libre peut refuser
    # le runner : l'échec est écrit, l'inventaire continue.
    ids = sorted({m.get("speakerId", "") for m in (modele_ll(f["texte"]) for f in tous)} - {""},
                 key=lambda q: int(q[1:]) if q[1:].isdigit() else 0)
    ids = [q for q in ids if re.fullmatch(r"Q\d+", q)]
    loc: dict[str, dict] = {}
    print(f"Lingua Libre : {len(ids)} locuteurs", flush=True)
    try:
        loc = entites(ids)
        refs = sorted(references(loc) - set(loc))
        libelles = entites(refs) if refs else {}
        doc = {"locuteurs": loc, "references": {k: {"labels": v.get("labels", {})} for k, v in libelles.items()}}
        ecrire("lingualibre-locuteurs.json", json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=True).encode(),
               f"{LINGUALIBRE}?action=wbgetentities ({len(ids)} locuteurs)", 200, sommes)
    except RuntimeError as e:
        sommes.append(f"échec {LINGUALIBRE} wbgetentities : {str(e)[:120]}")
        print(sommes[-1], flush=True)
        # d'autres portes du même serveur : la page de données d'une entité, en GET
        echecs = 0
        for q in ids:
            url = f"https://lingualibre.org/wiki/Special:EntityData/{q}.json"
            code, octets = http(url, essais=1, delai=20)
            if code == 200:
                ecrire(f"lingualibre-{q}.json", octets, url, code, sommes)
                loc[q] = json.loads(octets).get("entities", {}).get(q, {})
                continue
            sommes.append(f"{code} {url}")
            print(sommes[-1], flush=True)
            echecs += 1
            if echecs >= 3 and not loc:
                sommes.append("Lingua Libre refuse le runner : fiches des locuteurs non lues")
                print(sommes[-1], flush=True)
                break

    # Les pages des locuteurs sur Commons : leurs boîtes Babel (« zh-N » : langue maternelle) et
    # ce qu'ils disent d'eux-mêmes, quand Lingua Libre ne répond pas.
    noms = sorted({re.sub(r"\[\[User:([^|\]]+).*", r"\1", modele_ll(f["texte"]).get("speaker", "")) for f in tous} - {""})
    auteurs = sorted({re.sub(r"\[\[User:([^|\]]+).*", r"\1", modele_ll(f["texte"]).get("author", "")) for f in tous} - {""})
    pages_u: dict[str, object] = {}
    for i in range(0, len(auteurs), 50):
        try:
            d = api(COMMONS, action="query", titles="|".join(f"User:{a}" for a in auteurs[i:i + 50]),
                    prop="revisions", rvprop="content|ids|timestamp", rvslots="main")
            for pg in d.get("query", {}).get("pages", []):
                rev = (pg.get("revisions") or [{}])[0]
                pages_u[pg["title"]] = rev.get("slots", {}).get("main", {}).get("content")
        except RuntimeError as e:
            sommes.append(f"échec pages utilisateur : {str(e)[:120]}")
    ecrire("commons-locuteurs.json", json.dumps({"locuteurs": noms, "auteurs": auteurs, "pages": pages_u},
                                                 ensure_ascii=False, indent=1, sort_keys=True).encode(),
           f"{COMMONS}?titles=User:… ({len(auteurs)} auteurs)", 200, sommes)

    # Chen Wang a-t-il une page sur Commons qui dise la version de sa licence ?
    for nom, q in (("commons-recherche-chen-wang.json", '"Chen Wang" pronunciation'),
                   ("commons-recherche-audio-cmn.json", '"audio-cmn"'),
                   ("commons-recherche-shtooka-cmn.json", 'shtooka "cmn"'),
                   ("commons-recherche-yue-tan.json", '"Yue Tan"')):
        try:
            d = api(COMMONS, action="query", list="search", srsearch=q, srnamespace="6", srlimit="50")
            ecrire(nom, json.dumps(d, ensure_ascii=False, indent=1).encode(), f"{COMMONS}?list=search&srsearch={q}", 200, sommes)
        except RuntimeError as e:
            sommes.append(f"échec recherche {q} : {str(e)[:120]}")

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

#: Les voix d'audio-cmn : le dossier, la voix, la source à attribuer. La licence de chacune est
#: celle que la page lue déclare (`licences-lues/`, `PROVENANCE.md`).
AUDIO_CMN_VOIX = {
    "cc-chen-wang": {
        "nom": "Chen Wang",
        "dossier": "64k/syllabs",
        "titre": "audio-cmn, syllabes du mandarin (syllabs v0.2)",
        "lien": AUDIO_CMN,
        "licence": "CC BY-SA",
        "version": None,
        "page_licence": "audio-cmn-README.md",
    },
    "cc-yue-tan": {
        "nom": "Yue Tan",
        "dossier": "64k/hsk",
        "titre": "Shtooka, cmn-caen-tan (mots de la liste HSK), par audio-cmn",
        "lien": "http://packs.shtooka.net/cmn-caen-tan/",
        "licence": "CC BY-SA",
        "version": None,
        "page_licence": "shtooka-cmn-caen-tan-readme.txt",
    },
}

#: Les locuteurs de Lingua Libre retenus, par leur élément sur Lingua Libre, avec la raison
#: (fiche lue dans `licences-lues/lingualibre-locuteurs.json`). Un locuteur absent est écarté.
LOCUTEURS_LL: dict[str, str] = {}

SYL = re.compile(r"cmn-_?([a-zü]+)([1-4])\.mp3")
HANZI = re.compile(r"[㐀-鿿]{1,2}")


def _lexique():
    sys.path.insert(0, str(ICI))
    import fleurs  # noqa: E402  (mêmes règles d'étiquetage)
    import voix_kokoro  # noqa: E402

    return fleurs, voix_kokoro, fleurs.Lexique()


def etiqueter(texte: str, lex, fleurs, vk) -> dict | None:
    """Un caractère à une seule lecture pleine, ou un mot HSK de deux syllabes au ton que la voix
    fait (`voix_kokoro.etiqueter_mot`, règles de `fleurs.py`) ; sinon `None`. Jamais CC-CEDICT."""
    if not HANZI.fullmatch(texte):
        return None
    if len(texte) == 1:
        lecture = vk.lecture_unique(texte, lex)
        return {"genre": "c", "syl": [lecture], "tons": [int(lecture[-1])]} if lecture else None
    syl = vk.etiqueter_mot(texte, lex, fleurs)
    if not syl or syl[0][-1] == "5":
        return None
    return {"genre": "m", "syl": syl, "tons": [int(s[-1]) for s in syl]}


def arbre_audio_cmn(chemin: Path) -> list[tuple[str, str]]:
    """(chemin, empreinte de blob git) des fichiers d'audio-cmn, d'après
    `git -c core.quotepath=off ls-tree -r <commit> 64k/syllabs 64k/hsk`."""
    out = []
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        meta, _, nom = ligne.partition("\t")
        out.append((unicodedata.normalize("NFC", nom), meta.split()[2]))
    return out


def choisir_audio_cmn(arbre: list[tuple[str, str]], lex, fleurs, vk) -> list[dict]:
    voix = []
    for cle, v in AUDIO_CMN_VOIX.items():
        entrees = []
        for nom, blob in arbre:
            if not nom.startswith(v["dossier"] + "/"):
                continue
            base = nom.rsplit("/", 1)[1]
            if cle == "cc-chen-wang":
                m = SYL.fullmatch(base)  # les *5 sont des copies du ton 1 (README)
                if not m:
                    continue
                e = {"genre": "c", "texte": m.group(1) + m.group(2), "syl": [m.group(1).replace("ü", "v") + m.group(2)],
                     "tons": [int(m.group(2))]}
            else:
                h = base.removeprefix("cmn-").removesuffix(".mp3")
                e = etiqueter(h, lex, fleurs, vk)
                if e is None:
                    continue
                e["texte"] = h
            entrees.append({"id": f"{cle}/{e['texte']}", **e, "chemin": nom, "empreinte": f"git-blob:{blob}"})
        voix.append({"voix": cle, **{k: v[k] for k in ("nom", "titre", "lien", "licence", "version", "page_licence")},
                     "source": f"{AUDIO_CMN}@{AUDIO_CMN_COMMIT[:7]}", "role": "entrainement",
                     "base": f"https://raw.githubusercontent.com/hugolpz/audio-cmn/{AUDIO_CMN_COMMIT}/",
                     "entrees": sorted(entrees, key=lambda x: x["id"])})
    return voix


def inventaire_lu() -> list[dict]:
    chemin = LUES / "commons-lingualibre-cmn.jsonl"
    if not chemin.exists():
        return []
    return [json.loads(x) for x in chemin.read_text(encoding="utf-8").splitlines() if x.strip()]


def raison_ecart(f: dict) -> str | None:
    """Pourquoi un fichier de Lingua Libre est écarté, ou `None` s'il est retenu (licence)."""
    nom = f.get("licence", {}).get("LicenseShortName")
    if licence_acceptee(nom) is None:
        return f"licence {nom!r} (ni CC BY-SA, ni CC BY, ni CC0)"
    if not accord_page(nom, f.get("texte")):
        return f"licence {nom!r} absente du texte de la page"
    if not f.get("sha1") or not f.get("url"):
        return "fichier sans empreinte"
    return None


def choisir_lingualibre(tous: list[dict], lex, fleurs, vk) -> tuple[list[dict], Counter]:
    ecarts: Counter = Counter()
    par: dict[str, list[dict]] = defaultdict(list)
    infos: dict[str, dict] = {}
    for f in tous:
        m = modele_ll(f.get("texte"))
        q = m.get("speakerId", "")
        if q not in LOCUTEURS_LL:
            ecarts["locuteur non retenu"] += 1
            continue
        r = raison_ecart(f)
        if r:
            ecarts[r.split(" (")[0]] += 1
            continue
        texte = unicodedata.normalize("NFC", m.get("transcription", "")).strip().strip("。.!！?？")
        e = etiqueter(texte, lex, fleurs, vk)
        if e is None:
            ecarts["texte sans étiquette sûre"] += 1
            continue
        famille, version = licence_acceptee(f["licence"]["LicenseShortName"])
        cle = f"cc-ll-{q}"
        infos[cle] = {"nom": m.get("speaker", q), "q": q}
        par[cle].append({"id": f"{cle}/{texte}", "texte": texte, **e, "url": f["url"], "page": f["page"],
                         "empreinte": f"sha1:{f['sha1']}", "licence": f"{famille} {version}",
                         "auteur": m.get("speaker", q), "titre": f["titre"]})
    voix = []
    for cle, entrees in sorted(par.items()):
        vus, uniques = set(), []
        for e in sorted(entrees, key=lambda x: x["titre"]):
            if e["id"] not in vus:  # un même texte enregistré deux fois : le premier
                vus.add(e["id"])
                uniques.append(e)
        licences = sorted({e["licence"] for e in uniques})
        voix.append({"voix": cle, "nom": infos[cle]["nom"], "titre": "Lingua Libre, enregistrements cmn",
                     "lien": f"https://lingualibre.org/wiki/{infos[cle]['q']}", "licence": " ; ".join(licences),
                     "version": None, "page_licence": "commons-lingualibre-cmn.jsonl",
                     "raison": LOCUTEURS_LL[infos[cle]["q"]], "source": "Wikimedia Commons (Lingua Libre)",
                     "role": "entrainement", "entrees": uniques})
    return voix, ecarts


def choisir(arbre: Path) -> None:
    fleurs, vk, lex = _lexique()
    voix = choisir_audio_cmn(arbre_audio_cmn(arbre), lex, fleurs, vk)
    ll, ecarts = choisir_lingualibre(inventaire_lu(), lex, fleurs, vk)
    voix += ll
    doc = {
        "format": "wenlu-tons-voix-cc",
        "regles": ("licence CC BY-SA, CC BY ou CC0 lue fichier par fichier (NC, ND, inconnue : écartés) ; "
                   "pinyin de la liste HSK et des lectures du dépôt, jamais de CC-CEDICT ; ton que la voix fait"),
        "inventaire": hashlib.sha256((LUES / "commons-lingualibre-cmn.jsonl").read_bytes()).hexdigest()
        if (LUES / "commons-lingualibre-cmn.jsonl").exists() else None,
        "ecarts_lingualibre": dict(ecarts.most_common()),
        "voix": voix,
    }
    CHOIX.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    for v in voix:
        c = Counter(e["genre"] for e in v["entrees"])
        print(f"{v['voix']} ({v['nom']}, {v['licence']}) : {c['c']} caractères, {c['m']} mots")
    print("Lingua Libre, écartés :", dict(ecarts.most_common()))


# ---------------------------------------------------------------------------- téléchargement


def empreinte_ok(octets: bytes, empreinte: str) -> bool:
    algo, _, attendu = empreinte.partition(":")
    if algo == "git-blob":
        return hashlib.sha1(b"blob %d\0" % len(octets) + octets).hexdigest() == attendu
    if algo == "sha1":
        return hashlib.sha1(octets).hexdigest() == attendu
    return False


def decoder(octets: bytes, dst: Path) -> bool:
    """WAV PCM 16 bits mono 16 kHz, par ffmpeg (le paquet du runner)."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                       input=octets, capture_output=True)
    if r.returncode != 0 or not r.stdout:
        return False
    with wave.open(str(dst), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(r.stdout)
    return True


def telecharger() -> None:
    """Chaque fichier retenu : téléchargé, vérifié par son empreinte, sa licence relue dans
    l'inventaire de ce passage (Lingua Libre), décodé ; le corpus de chaque voix pour `voix.ts`."""
    doc = json.loads(CHOIX.read_text(encoding="utf-8"))
    frais = {f["titre"]: f for f in inventaire_lu()}
    empreinte_choix = hashlib.sha256(CHOIX.read_bytes()).hexdigest()
    for v in doc["voix"]:
        dossier = TRAVAIL / v["voix"]
        (dossier / "wav").mkdir(parents=True, exist_ok=True)
        bilan: Counter = Counter()

        def un(k_e: tuple[int, dict]) -> dict | None:
            k, e = k_e
            if "titre" in e:  # Lingua Libre : la licence de ce passage doit être la même
                f = frais.get(e["titre"])
                if f is None or raison_ecart(f) or f.get("sha1") != e["empreinte"].removeprefix("sha1:"):
                    bilan["licence ou empreinte changée depuis le choix"] += 1
                    return None
            code, octets = http(e.get("url") or v["base"] + urllib.parse.quote(e["chemin"]))
            if code != 200 or not empreinte_ok(octets, e["empreinte"]):
                bilan[f"téléchargement {code} ou empreinte fausse"] += 1
                return None
            fichier = f"wav/{k:05d}.wav"
            if not decoder(octets, dossier / fichier):
                bilan["décodage"] += 1
                return None
            bilan["ok"] += 1
            return {**{c: e[c] for c in ("id", "genre", "texte", "syl", "tons")}, "fichier": fichier}

        with ThreadPoolExecutor(4 if v["voix"].startswith("cc-ll-") else 8) as ex:
            entrees = [x for x in ex.map(un, enumerate(v["entrees"])) if x]
        (dossier / "corpus.json").write_text(json.dumps({
            "voix": v["voix"], "modele": v["titre"], "revision": v["source"], "textes": f"sha256:{empreinte_choix}",
            "role": v["role"], "source": {c: v.get(c) for c in ("nom", "titre", "lien", "licence", "version")},
            "entrees": entrees,
        }, ensure_ascii=False), encoding="utf-8")
        print(f"{v['voix']} : {dict(bilan)}", flush=True)


def locuteurs() -> None:
    doc = json.loads(CHOIX.read_text(encoding="utf-8"))
    print(" ".join(v["voix"] for v in doc["voix"] if (TRAVAIL / v["voix"] / "corpus.json").exists()))


# ------------------------------------------------------------------------- entraînement

#: Les entrées du modèle : 30 points de contour, puis registre, indicateur, durée, voisement.
N_POINTS = 30


def lignes_cc(doc: dict, sans_probleme: bool = True) -> list[dict]:
    """Les syllabes d'une voix (`app/scripts/tons/voix.ts`) en lignes de `caracteristiques.json`,
    pour `entrainer.py --voix-cc` : `x` sans voix, puis le registre calibré (`rc`) et celui de la
    voix entière (`ro`). Une syllabe que la découpe a manquée, ou que l'app aurait redemandée
    (trop courte, saturée), n'entre pas."""
    if doc.get("role") != "entrainement":
        raise ValueError(f"{doc['voix']} : voix de test, jamais à l'entraînement")
    out = []
    for ligne in doc["lignes"]:
        if not ligne["ok"] or (sans_probleme and ligne.get("probleme")):
            continue
        x = list(ligne["x"])
        out.append({
            "id": ligne["id"], "source": "cc", "locuteur": doc["voix"], "role": "entrainement",
            "ton": ligne["t"], "pos": ligne["k"], "nsyl": ligne["n"], "genre": ligne["g"], "ok": True,
            "x_sans": x,
            "x_calibree": x[:N_POINTS] + [ligne["rc"], 1.0] + x[N_POINTS + 2:],
            "x_oracle": x[:N_POINTS] + [ligne["ro"], 1.0] + x[N_POINTS + 2:],
        })
    return out


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    sous = ap.add_subparsers(dest="commande", required=True)
    sous.add_parser("inventaire")
    c = sous.add_parser("choisir")
    c.add_argument("--arbre", required=True, help="`git -c core.quotepath=off ls-tree -r` d'audio-cmn au commit lu")
    sous.add_parser("telecharger")
    sous.add_parser("locuteurs")
    a = ap.parse_args()
    if a.commande == "inventaire":
        inventaire()
    elif a.commande == "choisir":
        choisir(Path(a.arbre))
    elif a.commande == "telecharger":
        telecharger()
    else:
        locuteurs()


if __name__ == "__main__":
    main()
