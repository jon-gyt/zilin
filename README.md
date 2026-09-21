# Zilin 字林

Apprendre à lire le chinois par l'arbre des caractères. PWA d'abord, App Store ensuite via Capacitor, sans Mac.

## Structure

- `docs/` : product brief, backlog, charte, procédures (iOS sans Mac, sources et licences).
- `data/` : pipeline Python (uv). Ingestion des sources, graphe de dépendances, génération des fiches FR et EN, export JSON versionné.
- `app/` : PWA TypeScript, Vite, Svelte. Consomme le JSON exporté par `data/`.
- `maquettes/` : maquettes HTML validées (Zilin et Cilin). Référence visuelle et fonctionnelle, pas du code de production.
- `.github/workflows/` : build iOS sur runner macOS, envoi TestFlight.
- `scripts/` : outillage (certificat de signature sous Linux).

## Démarrer

Conteneur de dev (LXD) : `new-lxd.sh zilin` puis VS Code Remote-SSH.

```bash
# données
cd data && uv sync && uv run zilin --help

# app
cd app && npm install && npm run dev
```

## Le pipeline de données

Sept commandes, une par étape, chacune lisant ce que la précédente a écrit. Tout
ce qui est intermédiaire va dans `data/work/`, hors dépôt ; seuls l'export
(`app/public/data/<version>/`) et les polices (`app/public/fonts/`) sont versionnés.

```
fetch  →  ingest  →  build  →  export  →  check
                       ↘  fonts
```

| Commande | Ce qu'elle fait | Dépend de | Écrit dans |
|---|---|---|---|
| `zilin fetch` | télécharge Make Me a Hanzi, CC-CEDICT, Unihan, cjk-decomp, avec empreintes et journal de provenance | — | `data/work/sources/` |
| `zilin ingest` | normalise ces sources et les listes de niveaux | `fetch` | `data/work/ingest/` |
| `zilin build` | réconcilie les décompositions avec GF 0014-2009, construit le graphe, les familles et les parcours, écrit `ecarts.md` | `ingest` | `data/work/build/` |
| `zilin fonts` | sous-ensemble et woff2 des trois familles de la charte | listes versionnées | `app/public/fonts/` |
| `zilin export` | assemble les seuls fichiers que l'app lira, séparés par régime de licence | `build` | `app/public/data/<version>/` |
| `zilin check` | contrôles qualité sur tout ce qui précède, sans rien réécrire | `build`, `export` | — |
| `zilin tout` | enchaîne fetch, ingest, build, export, check et s'arrête à la première erreur | — | tout ce qui précède |

```bash
cd data && uv run zilin tout      # la chaîne complète
cd data && uv run zilin check     # les seuls contrôles
```

`audio`, `contes` et `fiches` sont à part : elles appellent une API, demandent une
clé et se lancent à la main, jamais dans `zilin tout`.

Toutes les commandes sont idempotentes : deux passages écrivent les mêmes octets,
et le résultat ne dépend pas du grain de hachage du processus. Seul
`data/work/sources/PROVENANCE.md` s'allonge, d'un bloc daté par passage.

Codes de sortie, les mêmes partout : **0** tout va bien, **1** erreur de données
(source absente, contrôle bloquant en échec, caractère hors parcours), **2** clé
d'API absente.

## Développer sans machine locale

- Claude Code sur le web (claude.ai/code) clone ce dépôt dans une VM Anthropic, travaille sur une branche et ouvre une PR ; se pilote depuis le navigateur ou l'app mobile Claude. Prérequis : installer l'app GitHub « Claude » sur le dépôt.
- À chaque fusion sur `main`, le workflow `pages.yml` publie l'app sur GitHub Pages : testable sur l'iPhone sans rien installer. Activer Pages (Settings, Pages, Source : GitHub Actions).
- Le conteneur LXD reste optionnel, pour le pipeline de données et le débogage local.

## Hors ligne et écran d'accueil

L'app s'installe : sur iPhone, Safari, Partager, « Sur l'écran d'accueil ». Elle s'ouvre alors en plein écran sous le nom Zilin, icône encre sur papier.

Le service worker (`vite-plugin-pwa`, `registerType: 'autoUpdate'`) précache la page, le JS, le CSS, les polices, les icônes, le manifest et le JSON servi avec l'app : après un premier chargement, tout répond sans réseau. Une nouvelle version s'installe en arrière-plan et s'applique au lancement suivant ou au retour du second plan, jamais au milieu d'une session, sans fenêtre à fermer.

Les icônes de `app/public/icons/` sont engendrées depuis la marque, pas dessinées à la main :

```bash
cd app && npm run icons   # mode d'emploi en tête de app/scripts/icons.mjs
```

Le script rastérise le SVG avec un Chromium de Playwright, qui reste un outil de fabrication : il n'est pas une dépendance de l'app et se donne par `NODE_PATH`.

## Règles

Voir `CLAUDE.md`. Le brief produit fait foi : `docs/product-brief.md`.
