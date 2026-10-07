"""Entraîne le modèle des mots de « Dis-le » : le profil de tons d'un mot de deux syllabes,
reconnu d'un bloc (décision du propriétaire du 4 octobre 2026, « Revoir la méthode des mots » ;
`PROVENANCE.md`, « Le profil de tons du mot entier »).

Ne tourne pas en CI ; numpy et scikit-learn (BSD) ne servent qu'à la recette :

    uv run --project data --with numpy --with scikit-learn python data/sources/tons/entrainer_mots.py \\
        --variante libre --graine 0 --sortie essai-mots.json [--sans-voix cc-ll-Q1431140]

Entrée : `data/work/tons/mots/entrees-mots.json`, écrit par `app/scripts/tons/mots.ts` avec le
code même de l'app (`profil.ts`, `entreesMot`) ; rien n'est recalculé ici. Les voix de
`voix-cc/` (branche `donnees/tons-cc`) donnent leur source au bloc de licence.

Deux variantes, posées avant toute mesure du test :

- `libre` : sans aucune source sous CC BY-SA. Les mots dits par Kokoro (sorties produites chez
  nous ; Apache 2.0 pour le modèle, rien sur les sorties) et la seule voix humaine du
  continent sous CC0 (CanonNi, Lingua Libre) ; les pseudo-mots des voix de Taïwan (OGDL 1.0)
  sur demande (`--avec-pseudo`), écartés par le développement. Une source CC BY-SA y est
  refusée (`sources_libres`), quoi qu'on demande ;
- `cc` : la même chose, plus les voix sous CC BY-SA (Yue Tan, Fake estate, Jouketou,
  Luilui6666). Ses poids sont une œuvre adaptée : sous CC BY-SA 4.0, chaque voix déclarée dans
  le bloc de licence avec sa clé (`tons.VOIX_CC`, l'attribution exportée).

`--sans-voix` : les voix tenues à part (validation croisée par locuteur). La voix de l'app
(`zf_001`) et les mots de Yue Tan de `donnees/mesure/` (moitiés dev et test) ne sont jamais à
l'entraînement.

Le modèle : trois perceptrons (38 entrées, 32 neurones cachés, 19 profils), moyenne de leurs
probabilités. L'app le mêle au modèle des caractères (`profil.ts`, `probabilitesMot`) :
probabilité d'un profil ∝ (modèle des mots)^`MELANGE` × (produit des probabilités des deux
syllabes). Tout ce qui suit a été choisi sur la moitié dev des mots de Yue Tan, avant la
mesure du test : les sources, le poids des voix humaines, la taille, le mélange, les seuils.
"""
from __future__ import annotations

import hashlib
import json
import sys
import warnings
from datetime import date
from pathlib import Path

ICI = Path(__file__).resolve().parents[2] / "work" / "tons"
ENTREES = ICI / "mots" / "entrees-mots.json"
VOIX_CC_DOSSIER = ICI / "voix-cc"
#: Les profils de `profil.ts` (`PROFILS`), dans le même ordre : 4 × 5 sans 3-3.
PROFILS = [[a, b] for a in (1, 2, 3, 4) for b in (1, 2, 3, 4, 5) if not (a == 3 and b == 3)]
N_ENTREES = 38
#: La voix de l'app : le test, jamais l'entraînement.
VOIX_TEST = ("zf_001",)
CACHEES = 32
ALPHA = 1e-2
MEMBRES = 3
#: Une voix humaine pèse cinq fois un mot de Kokoro (tirage des membres).
POIDS_HUMAIN = 5.0
#: L'exposant du modèle des mots dans le mélange avec le modèle des caractères.
MELANGE = 0.5
#: Le jugement (`profil.ts`, `jugerMot`) : le profil attendu est reconnu à 0,4 ; un autre
#: profil affirmé à 0,98, l'attendu sous 1 % ; une syllabe voisée à moins de 50 % : on redemande.
SEUILS = {"juste": 0.4, "autre": 0.98, "attenduMax": 0.01, "voisementMin": 0.5}


def est_by_sa(licence: str) -> bool:
    return "BY-SA" in licence.upper()


def sources_libres(mots: list[dict], avec_pseudo: bool = False) -> list[dict]:
    """Les mots que la variante libre peut apprendre : Kokoro, une voix humaine sous CC0, et sur
    demande les pseudo-mots de Taïwan ; jamais une source sous CC BY-SA, ni une voix dont la
    licence n'est pas connue."""
    out = []
    for m in mots:
        lic = str(m.get("licence") or "")
        if m["source"] == "taiwan" and lic.startswith("OGDL") and avec_pseudo:
            out.append(m)
        elif m["source"] == "kokoro" and lic == "synthese":
            out.append(m)
        elif m["source"] == "cc" and lic.startswith("CC0 "):
            out.append(m)
    if any(est_by_sa(str(m.get("licence") or "")) for m in out):
        raise ValueError("variante libre : une source CC BY-SA s'est glissée dans l'entraînement")
    return out


def sources_cc(mots: list[dict], avec_pseudo: bool = False) -> list[dict]:
    """La variante CC BY-SA : les sources libres et les voix humaines sous CC BY-SA, CC BY ou CC0,
    de licence connue, version comprise."""
    from wenlu_data.tons import licence_refusee

    autres = [m for m in mots if m["source"] == "cc" and not str(m.get("licence") or "").startswith("CC0 ")]
    for m in autres:
        refus = licence_refusee(m.get("licence"))
        if refus:
            raise ValueError(f"{m['voix']} : {refus}")
    return sources_libres(mots, avec_pseudo) + autres


def selection(mots: list[dict], variante: str, sans: tuple[str, ...] = (), avec_pseudo: bool = False) -> list[dict]:
    """Les mots d'entraînement d'une variante : jamais la voix de l'app, ni une voix tenue à part,
    ni un mot saturé ou sans deux syllabes."""
    pool = [m for m in mots if m.get("jeu") == "entrainement" and m["voix"] not in VOIX_TEST]
    pool = sources_libres(pool, avec_pseudo) if variante == "libre" else sources_cc(pool, avec_pseudo)
    return [
        m for m in pool
        if m["voix"] not in sans and m.get("probleme") != "sature"
        and all(v is not None for c in ("sans", "cal", "ora") for v in m[c])
    ]


def profil(tons) -> int:
    """Le rang du profil que la voix fait (3-3 se dit 2-3), -1 s'il n'en est pas un."""
    t = [int(x) for x in tons]
    if t == [3, 3]:
        t = [2, 3]
    return PROFILS.index(t) if t in PROFILS else -1


def bloc_licence(sel: list[dict], variante: str, sans: tuple[str, ...], dossier_cc: Path) -> dict:
    """Ce dont les poids dérivent, comme `tons.fautes_licence` le relit : chaque voix humaine par
    sa clé, sa licence et sa version ; les sorties de Kokoro déclarées comme synthèse."""
    donnees = []
    if any(m["source"] == "taiwan" for m in sel):
        donnees.append({
            "nom": "Syllabes du mandarin, deux voix (jeu 5961, data.gov.tw), en pseudo-mots",
            "licence": "Open Government Data License 1.0 (OGDL-Taiwan-1.0), compatible CC BY 4.0",
            "attribution": "此開放資料依政府資料開放授權條款 (Open Government Data License) 進行公眾釋出 — https://data.gov.tw/license",
            "usage": "entraînement",
        })
    by_sa = False
    for cle in sorted({m["voix"] for m in sel if m["source"] == "cc"}):
        f = dossier_cc / f"{cle}.json"
        doc = json.loads(f.read_text()) if f.exists() else {}
        src = doc.get("source") or {}
        lic = next(m["licence"] for m in sel if m["voix"] == cle)
        donnees.append({
            "cle": cle, "nom": src.get("nom"), "titre": src.get("titre"), "lien": src.get("lien"),
            "licence": lic, "usage": "entraînement",
            "mots": sum(1 for m in sel if m["voix"] == cle),
            "caracteristiques": f"voix-cc/{cle}.json sha256:{hashlib.sha256(f.read_bytes()).hexdigest()}" if f.exists() else None,
        })
        by_sa = by_sa or est_by_sa(lic)
    hors = ["zf_001 (la voix de l'app) : test", "mots de Yue Tan (hugolpz/audio-cmn) : moitié dev (réglages) et moitié test (mesure)"]
    if sans:
        hors.append(f"voix tenues à part (mesure) : {', '.join(sans)}")
    return {
        "poids": "CC BY-SA 4.0" if by_sa else "propriétaire (Wenlu), dérivés de données sous licence ouverte compatible usage commercial",
        "variante": variante,
        "donnees": donnees,
        "synthese_voix": (
            "mots dits par Kokoro (hexgrad/Kokoro-82M-v1.1-zh, Apache 2.0) dans le workflow donnees (étape "
            "tons-voix) : sorties produites par Wenlu ; ni le code ni les poids de Kokoro ne sont redistribués"
        ) if any(m["source"] == "kokoro" for m in sel) else None,
        "hors_entrainement": hors,
    }


def main() -> None:
    import argparse

    import numpy as np
    from sklearn.exceptions import ConvergenceWarning
    from sklearn.neural_network import MLPClassifier

    warnings.filterwarnings("ignore", category=ConvergenceWarning)
    ap = argparse.ArgumentParser()
    ap.add_argument("--variante", choices=["libre", "cc"], required=True)
    ap.add_argument("--sans-voix", default="", help="voix tenues à part (liste à virgules : cc-yue-tan…)")
    ap.add_argument("--graine", type=int, default=0)
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--avec-pseudo", action="store_true", help="les pseudo-mots de Taïwan (écartés par le développement)")
    ap.add_argument("--entrees", default=str(ENTREES))
    ap.add_argument("--voix-cc", default=str(VOIX_CC_DOSSIER))
    a = ap.parse_args()

    mots = json.loads(Path(a.entrees).read_text())
    sans = tuple(x for x in a.sans_voix.split(",") if x)
    sel = selection(mots, a.variante, sans, a.avec_pseudo)
    rng = np.random.default_rng(1000 + a.graine)
    X, y, w = [], [], []
    for m in sel:
        k = profil(m["tons"])
        if k < 0:
            continue
        for cond in ("sans", "cal", "ora"):
            X.append(m[cond])
            y.append(k)
            w.append(POIDS_HUMAIN if m["source"] == "cc" else 1.0)
    X, y = np.array(X, dtype=float), np.array(y)
    voix = sorted({m["voix"] for m in sel})
    print(f"{a.variante} : {len(sel)} mots, {len(voix)} voix, {len(X)} exemples", file=sys.stderr)

    mu, sd = X.mean(0), X.std(0) + 1e-6
    Xn = (X - mu) / sd
    p = np.array(w) / np.sum(w)
    membres = []
    for i in range(MEMBRES):
        clf = MLPClassifier(hidden_layer_sizes=(CACHEES,), alpha=ALPHA, max_iter=300, early_stopping=True,
                            validation_fraction=0.1, n_iter_no_change=12, random_state=100 * a.graine + i)
        idx = rng.choice(len(X), size=len(X), replace=True, p=p)
        clf.fit(Xn[idx], y[idx])
        if len(clf.classes_) != len(PROFILS):
            raise SystemExit("un profil manque à l'entraînement")
        membres.append({
            "normalisation": {"moyenne": [round(float(v), 5) for v in mu], "ecart": [round(float(v), 5) for v in sd]},
            "couches": [
                {"poids": [[round(float(v), 5) for v in ligne] for ligne in W.T], "biais": [round(float(v), 5) for v in b]}
                for W, b in zip(clf.coefs_, clf.intercepts_)
            ],
        })
    n_params = sum(len(l) for mb in membres for c in mb["couches"] for l in c["poids"]) + sum(
        len(c["biais"]) for mb in membres for c in mb["couches"])
    modele = {
        "format": "wenlu-tons-mots",
        "version": f"0.1.0-{date.today().isoformat()}",
        "profils": PROFILS,
        "entrees": N_ENTREES,
        "membres": membres,
        "temperature": 1.0,
        "melange": MELANGE,
        "seuils": SEUILS,
        "licence": bloc_licence(sel, a.variante, sans, Path(a.voix_cc)),
        "entrainement": {
            "script": "data/sources/tons/entrainer_mots.py",
            "variante": a.variante, "graine": a.graine, "sans_voix": list(sans), "avec_pseudo": a.avec_pseudo,
            "architecture": f"{MEMBRES} x ({N_ENTREES}-{CACHEES}-{len(PROFILS)}, ReLU, softmax), moyenne des probabilités",
            "alpha": ALPHA, "poids_humain": POIDS_HUMAIN, "parametres": int(n_params),
            "mots": len(sel), "voix": voix,
            "entrees": f"mots/entrees-mots.json sha256:{hashlib.sha256(Path(a.entrees).read_bytes()).hexdigest()}",
        },
    }
    out = Path(a.sortie)
    out.write_text(json.dumps(modele, ensure_ascii=False, separators=(",", ":")))
    print(f"{out} : {out.stat().st_size / 1024:.1f} Ko, {n_params} paramètres", file=sys.stderr)


if __name__ == "__main__":
    main()
