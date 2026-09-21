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

## Développer sans machine locale

- Claude Code sur le web (claude.ai/code) clone ce dépôt dans une VM Anthropic, travaille sur une branche et ouvre une PR ; se pilote depuis le navigateur ou l'app mobile Claude. Prérequis : installer l'app GitHub « Claude » sur le dépôt.
- À chaque fusion sur `main`, le workflow `pages.yml` publie l'app sur GitHub Pages : testable sur l'iPhone sans rien installer. Activer Pages (Settings, Pages, Source : GitHub Actions).
- Le conteneur LXD reste optionnel, pour le pipeline de données et le débogage local.

## Règles

Voir `CLAUDE.md`. Le brief produit fait foi : `docs/product-brief.md`.
