"""Entraîne le petit classifieur des tons de « Dis-le » et l'écrit en poids JSON.

Recette de `data/sources/tons/modele.json` (voir `PROVENANCE.md`). Ne tourne pas en CI :
elle demande l'audio brut, téléchargé à la main, et deux bibliothèques qui ne sont pas des
dépendances du pipeline (numpy et scikit-learn, BSD), prises le temps d'un passage :

    uv run --with numpy --with scikit-learn python data/sources/tons/entrainer.py

Entrée : `data/work/tons/donnees/caracteristiques.json`, produit par
`app/scripts/tons/extraire.ts` avec le code même de l'app (aucune caractéristique n'est
recalculée ici).

Données d'entraînement : les seules sources dont la licence permet d'en dériver des poids
embarqués dans une app payante (rôle « entrainement » du corpus) : les deux voix du jeu
5961 de data.gov.tw (OGDL 1.0, compatible CC BY 4.0). Les sources CC BY-SA (audio-cmn) et
les fichiers Kokoro de l'app ne servent qu'au développement et au test : aucun poids n'en
dérive.

Voix du continent (essai du 3 octobre 2026, `PROVENANCE.md`) : `--fleurs` mêle aux voix de
Taïwan les syllabes sûres des phrases de FLEURS `train` (Google, CC BY 4.0 ; `fleurs.py`,
`aligner.py`), lues selon `continent`. Aucune lecture n'a gardé à la fois le ton 3 des
caractères isolés (Yue Tan, en tête : 92 % avec les poids versionnés, 56 à 85 % après ; 87 à
91 % avec la durée de Taïwan, qui perd alors le ton 1 et les caractères reconnus de Chen
Wang) et les autres tons : par défaut, `non`, et `modele.json` n'en dérive pas. Un modèle appris avec FLEURS déclare FLEURS dans son
bloc de licence ; `wenlu check` le refuse tant que `tons.py` n'en exporte pas l'attribution.

Voix synthétiques du continent (3 octobre 2026, `PROVENANCE.md`) : `--kokoro <dossier>` mêle
aux voix de Taïwan les caractères isolés et les mots HSK que Kokoro a dits en phonèmes
(`voix_kokoro.py`, workflow `donnees`, étape `tons-voix`), dont `app/scripts/tons/voix.ts` a
calculé les caractéristiques (branche `donnees/tons-voix`, dossier `voix-kokoro/`). Désactivé
par défaut. `zf_001`, la voix de l'app, est refusée : c'est le test. Les sorties de Kokoro
sont produites chez nous (Apache 2.0 pour le modèle, rien sur les sorties) : le bloc de
licence les déclare comme synthèse, à côté des contours paramétriques.

Modèle : un ensemble de cinq petits perceptrons (34-16-5), moyenne de leurs probabilités.
Choisi sur le jeu de développement (Chen Wang, audio-cmn) parmi quelques tailles ; la
température aussi. Le jeu de Yue Tan et les fichiers Kokoro restent le test.

Sortie : `data/sources/tons/modele.json` : membres (normalisation, couches), température,
poids des règles, licence, conditions d'entraînement. Réentraîner change ses octets :
mettre à jour son empreinte dans `PROVENANCE.md` (`wenlu check` la compare).
"""
from __future__ import annotations

import hashlib
import json
import warnings
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.neural_network import MLPClassifier

from voix_kokoro import VOIX_TEST, lignes_kokoro  # la recette voisine (voix synthétiques)

warnings.filterwarnings("ignore", category=ConvergenceWarning)

#: Le dossier de travail de la recette (ignoré par git) : audio, corpus, caractéristiques.
ICI = Path(__file__).resolve().parents[2] / "work" / "tons"
#: Les poids versionnés.
POIDS = Path(__file__).resolve().parent / "modele.json"
N_POINTS = 30
CLASSES = [1, 2, 3, 4, 5]
CACHEES = (16,)
ALPHA = 3e-2
MEMBRES = 5
GRAINE = 7


# --- contours synthétiques ----------------------------------------------------
#
# Des contours tirés de modèles paramétriques des tons, écrits d'après la
# littérature (échelle de Chao : 55, 35, 214 ou 21, 51, neutre court ;
# formes moyennes de Xu 1997 : creux initial du ton 2, montée brève au début du
# ton 4, ton 3 bas avec ou sans remontée finale), avec une forte variabilité
# de locuteur : étendue de 1,2 à 3,5 demi-tons par degré de Chao, instants et
# hauteurs des cibles tirés au hasard, bruit, rognage. Aucune donnée tierce :
# c'est un a priori phonétique, pas un enregistrement.

def _cibles(ton: int, rng) -> tuple[list[float], list[float]]:
    j = lambda s: rng.normal(0, s)
    if ton == 1:
        return [0, 1], [5 + j(0.3), 5 + j(0.3) - abs(j(0.3))]
    if ton == 2:
        tm = float(np.clip(0.3 + j(0.1), 0.1, 0.5))
        return [0, tm, 1], [3 + j(0.5), 2.6 + j(0.4), 5 + j(0.4)]
    if ton == 3:
        tm = float(np.clip(0.5 + j(0.12), 0.3, 0.75))
        if rng.random() < 0.7:  # 214, la citation
            return [0, tm, 1], [2.5 + j(0.4), 1 + j(0.25), 3.6 + j(0.7)]
        return [0, 0.7, 1], [2.4 + j(0.4), 1 + j(0.25), 0.9 + j(0.3)]  # 21, le demi-troisième
    if ton == 4:
        # montée brève ou palier avant la chute (51, souvent 551 en citation)
        tp = float(rng.uniform(0.0, 0.45))
        return [0, tp, 1], [4.6 + j(0.3), 5 + j(0.25), 1.5 + j(0.5)]
    # neutre : court, sa hauteur dépend du ton qui précède
    avant = rng.integers(1, 5)
    debut = {1: 2.8, 2: 3.2, 3: 3.9, 4: 1.8}[int(avant)] + j(0.4)
    return [0, 1], [debut, debut - 0.8 + j(0.4)]


def synthese(n_par_ton: int, rng) -> tuple[np.ndarray, np.ndarray]:
    grille = np.linspace(0, 1, N_POINTS)
    X, y = [], []
    for ton in CLASSES:
        for _ in range(n_par_ton):
            tt, cc = _cibles(ton, rng)
            pas = rng.uniform(1.5, 4.0)  # demi-tons par degré de Chao
            fine = np.linspace(0, 1, 120)
            courbe = np.interp(fine, tt, cc)
            k = np.exp(-0.5 * (np.arange(-12, 13) / 4.0) ** 2)
            courbe = np.convolve(np.pad(courbe, 12, mode="edge"), k / k.sum(), mode="valid")
            a, b = rng.uniform(0, 0.1), rng.uniform(0.9, 1.0)
            pts = np.interp(a + grille * (b - a), fine, courbe)
            # la moyenne d'un locuteur (tous tons mêlés) tombe vers le degré 3,2 de Chao
            st = (pts - 3.2) * pas + rng.normal(0, 0.2, N_POINTS)
            registre = st.mean() + rng.normal(0, 1.0)
            forme = st - st.mean()
            if ton == 5:
                duree = rng.uniform(0.08, 0.22)
            elif ton == 3:
                duree = rng.uniform(0.25, 0.75)
            else:
                duree = rng.uniform(0.18, 0.65)
            vois = rng.uniform(0.85, 1.0)
            for avec in (False, True):
                X.append(np.concatenate([forme, [registre if avec else 0.0, 1.0 if avec else 0.0,
                                                 np.log2(duree / 0.35), vois]]))
                y.append(ton)
    return np.array(X), np.array(y)


def charger():
    rows = json.loads((ICI / "donnees" / "caracteristiques.json").read_text())
    return [r for r in rows if r["ok"]]


#: Les syllabes d'une phrase lue sont brèves (0,11 s de voix en médiane dans FLEURS, contre
#: 0,35 s pour un caractère isolé) : l'app lit une syllabe de mot comme si elle durait
#: 0,35 / 0,2 fois plus (`classifieur.ts`, `REGLAGES_MOTS.duree`).
DUREE_MOT = 0.2
DUREE_REF = 0.35


def continent(rows, mode: str, part: float, rng, places: tuple[str, ...] = ("fin", "debut", "milieu"),
              sans_registre: bool = True, neutres: bool = True,
              places_t3: tuple[str, ...] = ("fin", "debut", "milieu")) -> list:
    """Les syllabes de FLEURS d'entraînement, lues selon `mode` ; les autres lignes telles quelles.

    - `non` : écartées ;
    - `brut` : telles que `extraire.ts` les a calculées (une syllabe seule) ;
    - `mot` : comme l'app lit une syllabe de mot (durée × 0,35 / 0,2) ;
    - `debit` : la durée rapportée à celle des syllabes sûres de la même phrase ;
    - `citation` : la durée d'une syllabe de Taïwan du même ton, tirée au hasard (la phrase
      n'apprend que la forme et le registre, la durée reste celle des caractères isolés).
    `part` : la part des phrases gardées (tirées au hasard) ; `places` : les places dans le
    groupe gardées (`fin`, `debut`, `milieu`), `places_t3` celles du ton 3 ; `sans_registre` :
    faux pour ne garder d'une syllabe de phrase que les conditions où la voix est connue ;
    `neutres` : faux pour écarter ses tons neutres."""
    autres = [r for r in rows if r["source"] != "fleurs"]
    if mode == "non":
        return autres
    durees_tw = {}
    for r in autres:
        if r["role"] == "entrainement":
            durees_tw.setdefault(r["ton"], []).append(r["x_calibree"][N_POINTS + 2])
    fl = [r for r in rows if r["source"] == "fleurs" and r.get("place", "milieu") in places
          and (r["ton"] != 5 or neutres) and (r["ton"] != 3 or r.get("place") in places_t3)]
    phrases = sorted({r["locuteur"] for r in fl})
    gardees = set(rng.choice(phrases, size=int(round(part * len(phrases))), replace=False)) if part < 1 else set(phrases)
    fl = [r for r in fl if r["locuteur"] in gardees]
    med = {}
    for r in fl:
        med.setdefault(r["locuteur"], []).append(r["duree"])
    out = []
    for r in fl:
        r = dict(r)
        d_cit = float(rng.choice(durees_tw[r["ton"]]))
        for k in ("x_sans", "x_calibree", "x_oracle"):
            x = list(r[k])
            if mode == "mot":
                x[N_POINTS + 2] += float(np.log2(DUREE_REF / DUREE_MOT))
            elif mode == "debit":
                x[N_POINTS + 2] = float(np.log2(max(r["duree"], 0.02) / np.median(med[r["locuteur"]])))
            elif mode == "citation":
                x[N_POINTS + 2] = d_cit
            r[k] = x
        if not sans_registre:
            r["x_sans"] = None
        out.append(r)
    return autres + out


def kokoro(rows, dossier: Path | None, part: float, rng, genres: tuple[str, ...] = ("c", "m"),
           sans_probleme: bool = True, avec_voix: bool = False, voix: tuple[str, ...] = ()) -> list:
    """Les voix synthétiques du continent (Kokoro, `voix_kokoro.py`) mêlées aux autres lignes.

    `part` : la part des syllabes Kokoro gardées (tirées au hasard) ; `genres` : `c` les
    caractères isolés, `m` les syllabes de mots ; `sans_probleme` : écarter ce que l'app aurait
    redemandé (trop court, saturé) ; `avec_voix` : seulement les conditions où la voix est
    connue ; `voix` : ne garder que ces voix (vide : toutes)."""
    if dossier is None:
        return rows
    fichiers = sorted(p for p in Path(dossier).glob("z*_*.json") if not p.name.endswith("-mesure.json"))
    k = []
    for p in fichiers:
        doc = json.loads(p.read_text())
        if doc["voix"] == VOIX_TEST or (voix and doc["voix"] not in voix):
            continue
        k += [r for r in lignes_kokoro(doc) if r["genre"] in genres and not (sans_probleme and r["probleme"])]
    if part < 1:
        idx = rng.choice(len(k), size=int(round(part * len(k))), replace=False)
        k = [k[i] for i in sorted(idx)]
    if avec_voix:
        for r in k:
            r["x_sans"] = None
    return rows + k


def augmenter(X: np.ndarray, y: np.ndarray, rng: np.random.Generator, copies: int = 4):
    """Variantes plausibles d'un contour : bruit, excursion plus ou moins marquée
    (un apprenant exagère ou aplatit), attaque ou fin rognée, durée ±30 %."""
    out_X, out_y = [X], [y]
    grille = np.linspace(0, 1, N_POINTS)
    for _ in range(copies):
        Z = X.copy()
        pts = Z[:, :N_POINTS]
        echelle = rng.uniform(0.6, 1.5, size=(len(Z), 1))
        pts = pts * echelle
        # rognage : on garde une fenêtre [a, b] de la syllabe, rééchantillonnée
        a = rng.uniform(0, 0.12, size=len(Z))
        b = rng.uniform(0.88, 1.0, size=len(Z))
        for i in range(len(Z)):
            src = a[i] + grille * (b[i] - a[i])
            pts[i] = np.interp(src, grille, pts[i])
        pts = pts + rng.normal(0, 0.25, size=pts.shape)
        pts = pts - pts.mean(axis=1, keepdims=True)
        Z[:, :N_POINTS] = pts
        Z[:, N_POINTS] = Z[:, N_POINTS] + rng.normal(0, 0.8, size=len(Z)) * Z[:, N_POINTS + 1]
        Z[:, N_POINTS + 2] = Z[:, N_POINTS + 2] + np.log2(rng.uniform(0.7, 1.3, size=len(Z)))
        out_X.append(Z)
        out_y.append(y)
    return np.vstack(out_X), np.concatenate(out_y)


def jeu(rows, locuteurs, rng, augm=True, n_synth=0):
    """Chaque syllabe entre trois fois : sans registre, avec la référence calibrée
    sur cinq syllabes, avec la référence du locuteur entier. Le modèle apprend
    ainsi à se passer du registre tant que l'app ne connaît pas la voix."""
    sel = [r for r in rows if r["locuteur"] in locuteurs]
    paires = [(r[k], r["ton"]) for r in sel for k in ("x_sans", "x_calibree", "x_oracle") if r[k] is not None]
    X = np.array([x for x, _ in paires], dtype=np.float64).reshape(-1, N_POINTS + 4)
    y = np.array([t for _, t in paires])
    if augm and len(X):
        X, y = augmenter(X, y, rng)
    if n_synth:
        Xs, ys = synthese(n_synth, rng)
        X = np.vstack([X, Xs]) if len(X) else Xs
        y = np.concatenate([y, ys]) if len(y) else ys
    # le neutre est rare (49 syllabes par voix) : suréchantillonné
    idx = np.concatenate([np.arange(len(y))] + [np.where(y == 5)[0]] * 4)
    return X[idx], y[idx]


def entrainer(X, y, graine=GRAINE):
    mu = X.mean(axis=0)
    sd = X.std(axis=0) + 1e-6
    sd[N_POINTS + 1] = 1.0  # l'indicateur 0/1 reste lisible
    mu[N_POINTS + 1] = 0.0
    clf = MLPClassifier(hidden_layer_sizes=CACHEES, activation="relu", alpha=ALPHA, max_iter=300,
                        early_stopping=True, validation_fraction=0.1, n_iter_no_change=15,
                        random_state=graine, batch_size=256, learning_rate_init=2e-3)
    clf.fit((X - mu) / sd, y)
    return clf, mu, sd


def logits(clf, mu, sd, X):
    h = (X - mu) / sd
    for k, (W, b) in enumerate(zip(clf.coefs_, clf.intercepts_)):
        h = h @ W + b
        if k < len(clf.coefs_) - 1:
            h = np.maximum(h, 0)
    return h


def softmax(z, T=1.0):
    z = z / T
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def validation_croisee(rows, rng, n_synth=0, humain=True):
    """Par locuteur : on apprend sur une voix (et la synthèse), on mesure sur l'autre."""
    res = {}
    Z_all, y_all = [], []
    for test, train in (("tw1", "tw2"), ("tw2", "tw1")):
        X, y = jeu(rows, {train} if humain else set(), rng, n_synth=n_synth)
        clf, mu, sd = entrainer(X, y)
        sel = [r for r in rows if r["locuteur"] == test]
        for cond in ("x_sans", "x_calibree", "x_oracle"):
            Xt = np.array([r[cond] for r in sel])
            yt = np.array([r["ton"] for r in sel])
            z = logits(clf, mu, sd, Xt)
            pred = np.array(CLASSES)[z.argmax(axis=1)]
            res[f"{train}->{test}/{cond}"] = round(float((pred == yt).mean()), 4)
            if cond == "x_calibree":
                Z_all.append(z)
                y_all.append(yt)
    Z = np.vstack(Z_all)
    Y = np.concatenate(y_all)
    idx = np.array([CLASSES.index(t) for t in Y])
    best_T, best_nll = 1.0, 1e9
    for T in np.linspace(0.5, 4, 36):
        p = softmax(Z, T)
        nll = -np.log(p[np.arange(len(idx)), idx] + 1e-12).mean()
        if nll < best_nll:
            best_T, best_nll = float(T), float(nll)
    res["temperature"] = round(best_T, 3)
    return res, best_T


def probas_ensemble(membres, X, T=1.0):
    return np.mean([softmax(logits(c, mu, sd, X), T) for c, mu, sd in membres], axis=0)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["humain", "synthese", "mixte"], default="mixte")
    ap.add_argument("--n-synth", type=int, default=3000, help="contours synthétiques par ton")
    ap.add_argument("--sortie", default=str(POIDS))
    ap.add_argument("--fleurs", choices=["non", "brut", "mot", "debit", "citation"], default="non",
                    help="les syllabes de FLEURS (continent) et leur lecture (`continent`)")
    ap.add_argument("--part-fleurs", type=float, default=1.0, help="part des phrases de FLEURS gardées")
    ap.add_argument("--places-fleurs", default="fin,debut,milieu", help="places dans le groupe gardées")
    ap.add_argument("--fleurs-avec-voix", action="store_true", help="FLEURS : seulement la voix connue")
    ap.add_argument("--fleurs-sans-neutre", action="store_true", help="FLEURS : sans les tons neutres")
    ap.add_argument("--places-t3", default="fin,debut,milieu", help="FLEURS : places gardées pour le ton 3")
    ap.add_argument("--graine", type=int, default=0, help="décale les graines des membres (variance)")
    ap.add_argument("--kokoro", default=None,
                    help="dossier des voix Kokoro (`voix-kokoro/`, branche donnees/tons-voix) ; absent : aucune")
    ap.add_argument("--part-kokoro", type=float, default=1.0, help="part des syllabes Kokoro gardées")
    ap.add_argument("--genres-kokoro", default="c,m", help="Kokoro : c (caractères isolés), m (syllabes de mots)")
    ap.add_argument("--kokoro-avec-voix", action="store_true", help="Kokoro : seulement la voix connue")
    ap.add_argument("--kokoro-avec-probleme", action="store_true",
                    help="Kokoro : garder ce que l'app aurait redemandé (trop court, saturé)")
    ap.add_argument("--voix-kokoro", default="", help="Kokoro : ces voix seulement (liste à virgules)")
    args = ap.parse_args()
    rows = continent(charger(), args.fleurs, args.part_fleurs, np.random.default_rng(GRAINE),
                     tuple(args.places_fleurs.split(",")), sans_registre=not args.fleurs_avec_voix,
                     neutres=not args.fleurs_sans_neutre,
                     places_t3=tuple(x for x in args.places_t3.split(",") if x))
    rows = kokoro(rows, Path(args.kokoro) if args.kokoro else None, args.part_kokoro,
                  np.random.default_rng(GRAINE + 1), tuple(args.genres_kokoro.split(",")),
                  sans_probleme=not args.kokoro_avec_probleme, avec_voix=args.kokoro_avec_voix,
                  voix=tuple(v for v in args.voix_kokoro.split(",") if v))
    humain = args.mode != "synthese"
    n_synth = args.n_synth if args.mode != "humain" else 0
    train_locs = sorted({r["locuteur"] for r in rows if r["role"] == "entrainement"}) if humain else []
    voix = sorted({r["source"] for r in rows if r["locuteur"] in set(train_locs)})
    print(f"mode {args.mode} ; FLEURS {args.fleurs} ({args.part_fleurs}) ; sources d'entraînement : {voix}, "
          f"{len(train_locs)} locuteurs ou phrases ; synthèse : {n_synth} par ton")
    val, _ = validation_croisee(rows, np.random.default_rng(GRAINE), n_synth=n_synth, humain=humain)
    for k, v in val.items():
        print(f"  {k}: {v}")

    membres = []
    n_ex = 0
    for g in range(MEMBRES):
        rng = np.random.default_rng(100 + g + 1000 * args.graine)
        X, y = jeu(rows, set(train_locs), rng, n_synth=n_synth)
        clf, mu, sd = entrainer(X, y, graine=g + 10 * args.graine)
        membres.append((clf, mu, sd))
        n_ex += len(y)
        print(f"  membre {g} : {clf.n_iter_} itérations")

    # température : sur le jeu de développement (Chen Wang), condition calibrée
    dev = [r for r in rows if r["source"] == "cw"]
    Xd = np.array([r["x_calibree"] for r in dev])
    idx = np.array([CLASSES.index(r["ton"]) for r in dev])
    best_T, best_nll = 1.0, 1e9
    for T in np.linspace(0.5, 4, 36):
        p = probas_ensemble(membres, Xd, T)
        nll = -np.log(p[np.arange(len(idx)), idx] + 1e-12).mean()
        if nll < best_nll:
            best_T, best_nll = float(T), float(nll)
    acc_dev = float((probas_ensemble(membres, Xd, best_T).argmax(1) == idx).mean())
    print(f"  température {best_T:.2f} (NLL {best_nll:.3f}), précision dev {acc_dev:.3f}")

    def export(clf, mu, sd):
        return {
            "normalisation": {"moyenne": np.round(mu, 5).tolist(), "ecart": np.round(sd, 5).tolist()},
            "couches": [{"poids": np.round(W.T, 5).tolist(), "biais": np.round(b, 5).tolist()}
                        for W, b in zip(clf.coefs_, clf.intercepts_)],
        }

    n_params = sum(W.size + b.size for c, _, _ in membres for W, b in zip(c.coefs_, c.intercepts_))
    empreinte = hashlib.sha256((ICI / "donnees" / "caracteristiques.json").read_bytes()).hexdigest()[:16]
    modele = {
        "format": "wenlu-tons-mlp",
        "version": f"0.1.0-{date.today().isoformat()}",
        "classes": CLASSES,
        "entrees": N_POINTS + 4,
        "membres": [export(*m) for m in membres],
        "temperature": round(best_T, 3),
        # a priori des règles (classifieur.ts, `probabilites`) : réglé sur le développement
        # (Chen Wang) parmi 1, 2, 4, 8 ; 4 équilibre précision et « autre ton » affirmé à tort
        "poidsRegles": 4,
        "licence": {
            "poids": "propriétaire (Wenlu), dérivés de données sous licence ouverte compatible usage commercial",
            "donnees": [
                {
                    "nom": "Syllabes du mandarin, deux voix (jeu 5961, data.gov.tw)",
                    "fournisseur": "administration taïwanaise (d'après la réédition ; page du jeu illisible depuis l'environnement)",
                    "licence": "Open Government Data License 1.0 (OGDL-Taiwan-1.0), compatible CC BY 4.0",
                    "attribution": "此開放資料依政府資料開放授權條款 (Open Government Data License) 進行公眾釋出 — https://data.gov.tw/license",
                    "recupere_par": "https://github.com/Punpuf/shenzhen-mandarin-audio (archives de publication, commit a3617b7)",
                    "usage": "entraînement",
                }
            ],
            "synthese": "contours paramétriques générés par entrainer.py (a priori phonétique, sans donnée tierce)",
            "hors_entrainement": [
                "hugolpz/audio-cmn, Chen Wang (CC BY-SA) : développement (choix de la taille, température)",
                "hugolpz/audio-cmn, Yue Tan (CC BY-SA) : test seulement",
                "Kokoro zf_001, fichiers de l'app (Apache 2.0) : test seulement",
            ],
        },
        "entrainement": {
            "script": "data/sources/tons/entrainer.py",
            "mode": args.mode,
            "synthese_par_ton": n_synth,
            "caracteristiques": f"donnees/caracteristiques.json sha256:{empreinte}",
            "exemples": int(n_ex),
            "parametres": int(n_params),
            "architecture": f"{MEMBRES} x ({N_POINTS + 4}-{'-'.join(map(str, CACHEES))}-{len(CLASSES)}, ReLU, softmax), moyenne des probabilités",
            "validation_croisee_par_locuteur": val,
            "precision_dev_cw": round(acc_dev, 4),
        },
    }
    if args.fleurs != "non":
        modele["licence"]["donnees"].append({
            "nom": "FLEURS, mandarin du continent (cmn_hans_cn), partie train",
            "fournisseur": "Google (Conneau et al., 2022, arXiv:2205.12446)",
            "licence": "CC BY 4.0",
            "attribution": "FLEURS (Google), CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/",
            "recupere_par": "https://storage.googleapis.com/xtreme_translations/FLEURS102/cmn_hans_cn.tar.gz",
            "usage": "entraînement",
        })
        modele["entrainement"]["fleurs"] = {
            "lecture": args.fleurs, "part": args.part_fleurs, "places": args.places_fleurs,
            "avec_voix": args.fleurs_avec_voix, "sans_neutre": args.fleurs_sans_neutre, "places_t3": args.places_t3,
        }
    if args.kokoro:
        dossier = Path(args.kokoro)
        sommes = dossier / "SHA256SUMS"
        voix_k = sorted({r["locuteur"].removeprefix("kokoro-") for r in rows if r["source"] == "kokoro"})
        modele["licence"]["synthese_voix"] = (
            "voix synthétiques du continent : sorties de Kokoro (hexgrad/Kokoro-82M-v1.1-zh, Apache 2.0), "
            "produites par Wenlu dans le workflow donnees (étape tons-voix) ; ni le code ni les poids de "
            "Kokoro ne sont redistribués, et la licence Apache 2.0 ne régit pas les sorties ; "
            "zf_001 (la voix de l'app) reste le test"
        )
        modele["entrainement"]["kokoro"] = {
            "voix": voix_k, "part": args.part_kokoro, "genres": args.genres_kokoro,
            "avec_voix": args.kokoro_avec_voix, "avec_probleme": args.kokoro_avec_probleme,
            "syllabes": sum(1 for r in rows if r["source"] == "kokoro"),
            "manifeste": "sha256:" + hashlib.sha256(sommes.read_bytes()).hexdigest() if sommes.exists() else None,
        }
    p = Path(args.sortie)
    p.write_text(json.dumps(modele, ensure_ascii=False, separators=(",", ":")))
    print(f"{p} : {p.stat().st_size / 1024:.1f} Ko, {n_params} paramètres, T={best_T:.2f}")


if __name__ == "__main__":
    main()
