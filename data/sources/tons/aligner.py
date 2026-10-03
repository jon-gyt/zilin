"""Aligne les phrases de FLEURS syllabe par syllabe et garde les syllabes sûres.

Recette de `data/sources/tons/modele.json` (voir `PROVENANCE.md`), étape du continent, entre
l'étiquetage (`fleurs.py`) et les caractéristiques (`app/scripts/tons/extraire.ts`) :

    cd app && npx vite-node scripts/tons/trames.ts ../data/work/tons && cd ..
    uv run --with numpy python data/sources/tons/aligner.py

Un alignement simple, écrit ici, sans modèle acoustique : on connaît le nombre de syllabes de
la phrase et le type de l'attaque de chacune (`fleurs.py`) ; le suivi de hauteur de l'app
(`pitch.ts`, `suivreHauteur`, trames de 10 ms, réglé plus souple pour des phrases lues au
micro d'un ordinateur : `trames.ts`, `SOUPLE`) dit où la voix vibre et avec quelle énergie.

1. Les îlots : les plages voisées de la phrase (un trou d'une trame est comblé ; un îlot de
   moins de 40 ms, ou très faible au bord de la phrase, est écarté).
2. Une programmation dynamique apparie les trous entre îlots aux frontières entre syllabes,
   dans l'ordre. Une consonne sourde (p t k c ch q s sh x f h, et b d g z zh j, sourdes en
   mandarin) coupe la voix : sa frontière doit tomber dans un trou ; m, n, l, r, y, w et une
   voyelle ne la coupent presque jamais : leur frontière peut rester dans un îlot. Une pause
   longue tombe à une ponctuation, au pis entre deux mots. La durée de chaque part suit le
   débit de la phrase. Un trou de plus ou de moins coûte, selon sa durée.
3. Une syllabe est **sûre** quand elle occupe seule un îlot entier, que les deux frontières
   qui la bornent sont des consonnes sourdes ou des pauses (ou le bord de la phrase), que sa
   durée voisée est plausible (60 à 600 ms, et entre 0,4 et 2,5 fois le débit), et que cet
   appariement ne change pas quand on fait varier les coûts et le débit (sept variantes).
   Seules les syllabes sûres et étiquetées (`ton` connu) sont gardées.

Sortie : les entrées FLEURS de `corpus.json` (source `fleurs`, rôle `entrainement` pour
`train`, `test` pour `dev` et `test` : leurs locuteurs ne sont pas ceux de `train`), chacune
avec ses syllabes sûres : leur ton, leur caractère, leur place dans le groupe et leur plage
`[a, b)` en trames : l'îlot et la moitié des trous qui l'entourent (`plages`), dont
`extraire.ts` traite l'extrait comme l'enregistrement d'un caractère, avec les réglages de
l'app ; la hauteur moyenne de chaque îlot (`moyennes`, la voix de la phrase) ; et, pour la
mesure, les paires de syllabes sûres et voisines qui forment un mot de deux caractères de la
liste HSK (`mots`). Le corpus existant (Taïwan, audio-cmn, Kokoro) est gardé tel quel.

Contrôles de l'alignement (3 octobre 2026, `PROVENANCE.md`) : devant une syllabe sûre, le trou
d'une consonne non aspirée (b d g z zh j) dure 60 ms en médiane, celui d'une fricative ou
d'une aspirée 100 ms ; décalé d'une syllabe, ces écarts disparaissent (80 à 90 ms partout).
Un perceptron appris sur les seules syllabes sûres de `train` reconnaît 51 % de celles de
`dev` et `test` (cinq tons), le ton 3 à peine (6 %) : la parole enchaînée dit peu du ton de
chaque syllabe, même bien bornée.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parents[2] / "work" / "tons"
DONNEES = ICI / "donnees"

#: Frontière d'une attaque restée dans un îlot : ce qu'elle coûte.
COUT_DANS_ILOT = {"forte": 4.0, "faible": 2.0, "zero": 0.6, "voisee": 0.4, "?": 1.5}
#: Frontière d'une attaque appariée à un trou : ce qu'elle coûte.
COUT_TROU = {"forte": 0.0, "faible": 0.0, "zero": 0.8, "voisee": 1.5, "?": 0.6}
#: Une pause (au moins 15 trames de trou) : à une ponctuation, entre deux mots, dans un mot.
PAUSE = 15
COUT_PAUSE = {"ponct": 0.0, "mot": 1.5, "dans": 5.0}
SURES = ("forte", "faible")


def ilots(tr: np.ndarray) -> list[tuple[int, int]]:
    """Les plages voisées [a, b) d'une phrase, nettoyées."""
    v = tr[:, 4] > 0.5
    # comble les trous d'une trame
    for i in range(1, len(v) - 1):
        if not v[i] and v[i - 1] and v[i + 1]:
            v[i] = True
    out, i = [], 0
    while i < len(v):
        if not v[i]:
            i += 1
            continue
        j = i
        while j < len(v) and v[j]:
            j += 1
        out.append((i, j))
        i = j
    rms = tr[:, 3]
    pic = rms.max() if len(rms) else 1.0
    garde = []
    for k, (a, b) in enumerate(out):
        if b - a < 4:
            continue
        fort = 20 * math.log10(max(rms[a:b].max(), 1e-9) / pic)
        if (k == 0 or k == len(out) - 1) and (fort < -25 or b - a < 6):
            continue
        garde.append((a, b))
    return garde


def aligner(syl: list[dict], ils: list[tuple[int, int]], debit: float, p: dict) -> list[tuple[int, int, int, int]] | None:
    """Programmation dynamique : rend les parts (îlot début, îlot fin, syllabe début,
    syllabe fin) de l'alignement le moins coûteux, ou `None`."""
    n, m = len(syl), len(ils)
    if m == 0 or n == 0:
        return None
    types = [s["attaque"] for s in syl]
    avant = [s["avant"] for s in syl]
    trou = [ils[i][0] - ils[i - 1][1] for i in range(1, m)]  # trou avant l'îlot i (i ≥ 1)
    INF = float("inf")
    cout = np.full((m + 1, n + 1), INF)
    prec: dict[tuple[int, int], tuple[int, int]] = {}
    cout[0, 0] = 0.0
    bande = max(8, int(0.25 * n))
    for i0 in range(m):
        for j0 in range(n):
            c0 = cout[i0, j0]
            if c0 == INF:
                continue
            for di in range(1, 4):
                i1 = i0 + di
                if i1 > m:
                    break
                d = (ils[i1 - 1][1] - ils[i0][0]) * 0.01
                internes = sum(_cout_trou_parasite(trou[i - 1]) for i in range(i0 + 1, i1))
                for dj in range(1, 5):
                    j1 = j0 + dj
                    if j1 > n:
                        break
                    if abs(j1 / n - i1 / m) * n > bande:
                        continue
                    c = c0 + internes
                    c += p["w_duree"] * math.log(d / (dj * debit * p["debit"])) ** 2
                    for j in range(j0 + 1, j1):
                        c += COUT_DANS_ILOT[types[j]] * p["w_type"] + (3.0 if avant[j] == "ponct" else 0.0)
                    if i1 < m and j1 < n:
                        g = trou[i1 - 1]
                        c += COUT_TROU[types[j1]] * p["w_type"]
                        if g >= PAUSE:
                            c += COUT_PAUSE[avant[j1]]
                        if types[j1] == "forte" and g < 3:
                            c += 0.5
                    elif (i1 == m) != (j1 == n):
                        continue
                    if c < cout[i1, j1]:
                        cout[i1, j1] = c
                        prec[(i1, j1)] = (i0, j0)
    if cout[m, n] == INF:
        return None
    parts, k = [], (m, n)
    while k != (0, 0):
        i0, j0 = prec[k]
        parts.append((i0, k[0], j0, k[1]))
        k = (i0, j0)
    return parts[::-1]


def _cout_trou_parasite(g: int) -> float:
    """Un trou à l'intérieur d'une syllabe (une voix craquée, un ton 3 qui s'éteint)."""
    return 0.4 if g <= 3 else 1.0 + 0.1 * g


VARIANTES = [
    dict(debit=1.0, w_duree=4.0, w_type=1.0),
    dict(debit=0.8, w_duree=4.0, w_type=1.0),
    dict(debit=1.25, w_duree=4.0, w_type=1.0),
    dict(debit=1.0, w_duree=2.0, w_type=1.0),
    dict(debit=1.0, w_duree=8.0, w_type=1.0),
    dict(debit=1.0, w_duree=4.0, w_type=0.5),
    dict(debit=1.0, w_duree=4.0, w_type=2.0),
]


def sures(entree: dict, tr: np.ndarray) -> tuple[list[dict], dict]:
    """Les syllabes sûres d'une phrase, et quelques comptes."""
    syl = entree["syllabes"]
    ils = ilots(tr)
    stats = dict(syllabes=len(syl), ilots=len(ils))
    if not ils:
        return [], stats
    # la voix de la phrase : la moyenne (géométrique) de chaque îlot
    stats["moyennes"] = [round(float(2 ** np.mean(np.log2(f[f > 0]))), 2)
                         for f in (tr[a:b, 1] for a, b in ils) if (f > 0).any()]
    debit = sum(b - a for a, b in ils) * 0.01 / len(syl)
    stats["debit"] = debit
    choix: list[dict[int, tuple[int, int]]] = []
    for p in VARIANTES:
        parts = aligner(syl, ils, debit, p)
        if parts is None:
            return [], stats
        un = {j0: (i0, i1) for i0, i1, j0, j1 in parts if i1 - i0 == 1 and j1 - j0 == 1}
        choix.append(un)
    stables = set(choix[0])
    for c in choix[1:]:
        stables &= {j for j in c if c[j] == choix[0].get(j)}
    out = []
    m, n = len(ils), len(syl)
    for j in sorted(stables):
        i0, _ = choix[0][j]
        a, b = ils[i0]
        d = (b - a) * 0.01
        if not (0.06 <= d <= 0.6 and 0.4 * debit <= d <= 2.5 * debit):
            continue
        g_av = ils[i0][0] - ils[i0 - 1][1] if i0 > 0 else PAUSE
        g_ap = ils[i0 + 1][0] - ils[i0][1] if i0 + 1 < m else PAUSE
        ok_av = j == 0 or syl[j]["attaque"] in SURES or g_av >= PAUSE
        ok_ap = j == n - 1 or syl[j + 1]["attaque"] in SURES or g_ap >= PAUSE
        if not (ok_av and ok_ap):
            continue
        # la plage donnée à `segmenter` : l'îlot, et la moitié des trous qui l'entourent
        pa = a - min(g_av // 2, 10)
        pb = b + min(g_ap // 2, 10)
        out.append(dict(j=j, a=int(pa), b=int(pb), ilot=[int(a), int(b)]))
    stats["sures"] = len(out)
    return out, stats


def place(syl: list[dict], j: int) -> str:
    """`fin` : la dernière syllabe d'un groupe ; `debut` : la première ; `milieu` sinon."""
    if j + 1 == len(syl) or syl[j + 1]["avant"] == "ponct":
        return "fin"
    return "debut" if syl[j]["avant"] == "ponct" else "milieu"


def _traiter(args: tuple[dict, list]) -> tuple[str, list[dict], dict]:
    e, tr = args
    s, st = sures(e, np.asarray(tr, dtype=np.float64))
    return e["id"], s, st


def charger_trames() -> dict[str, list]:
    trames: dict[str, list] = {}
    for f in sorted(DONNEES.glob("fleurs-trames-*.json")):
        for k, v in json.loads(f.read_text()).items():
            trames[k if k.startswith("fleurs/") else f"fleurs/{k}"] = v["tr"]
    return trames


def main() -> None:
    entrees = json.loads((DONNEES / "fleurs-syllabes.json").read_text())
    trames = charger_trames()
    taches = [(e, trames[e["id"]]) for e in entrees if e["id"] in trames]
    print(f"{len(taches)} phrases avec trames sur {len(entrees)}", file=sys.stderr)
    with ProcessPoolExecutor() as ex:
        res = list(ex.map(_traiter, taches, chunksize=16))
    par_id = {e["id"]: e for e in entrees}
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from fleurs import Lexique

    mots_hsk = {w for w in Lexique().mots if len(w) == 2}
    corpus_fleurs, compte = [], Counter()
    for id_, s, st in res:
        e = par_id[id_]
        syl = e["syllabes"]
        compte["syllabes"] += st["syllabes"]
        compte["sures"] += len(s)
        gardees = [x for x in s if syl[x["j"]]["ton"] is not None]
        compte["gardees"] += len(gardees)
        if not gardees:
            continue
        par_j = {x["j"]: x for x in gardees}
        mots = []
        for x in gardees:
            y = par_j.get(x["j"] + 1)
            if y and syl[x["j"]]["c"] + syl[y["j"]]["c"] in mots_hsk and syl[y["j"]]["avant"] == "dans":
                mots.append(dict(texte=syl[x["j"]]["c"] + syl[y["j"]]["c"], a=x["a"], b=y["b"],
                                 tons=[syl[x["j"]]["ton"], syl[y["j"]]["ton"]],
                                 syl=[syl[x["j"]]["py"], syl[y["j"]]["py"]]))
        corpus_fleurs.append(dict(
            id=id_, source="fleurs", locuteur=id_, role="entrainement" if e["partie"] == "train" else "test",
            partie=e["partie"], genre=e["genre"], fichier=e["fichier"], texte=e["texte"],
            tons=[syl[x["j"]]["ton"] for x in gardees],
            syllabes=[syl[x["j"]]["c"] for x in gardees],
            places=[place(syl, x["j"]) for x in gardees],
            plages=[[x["a"], x["b"]] for x in gardees],
            moyennes=st.get("moyennes", []),
            mots=mots,
        ))
    chemin = DONNEES / "corpus.json"
    corpus = [c for c in json.loads(chemin.read_text()) if c["source"] != "fleurs"] if chemin.exists() else []
    chemin.write_text(json.dumps(corpus + corpus_fleurs, ensure_ascii=False, indent=0))
    tons = Counter((c["partie"], t) for c in corpus_fleurs for t in c["tons"])
    print(f"syllabes : {compte['syllabes']}, sûres : {compte['sures']}, sûres et étiquetées : {compte['gardees']}")
    for partie in ("train", "dev", "test"):
        print(partie, {t: tons[(partie, t)] for t in (1, 2, 3, 4, 5)},
              "phrases :", sum(c["partie"] == partie for c in corpus_fleurs),
              "mots :", sum(len(c["mots"]) for c in corpus_fleurs if c["partie"] == partie))


if __name__ == "__main__":
    main()
