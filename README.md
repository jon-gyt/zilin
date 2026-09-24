# Wenlu 文路

Apprendre à lire le chinois par l'arbre des caractères. PWA d'abord, App Store ensuite via Capacitor, sans Mac.

Wenlu (wénlù : 文 l'écrit, 路 le chemin) s'appelait Zilin 字林. Gardent l'ancien nom, pour ne rien casser : le dépôt `jon-gyt/zilin` et le chemin GitHub Pages `/zilin/`, la base IndexedDB et la clé du thème (les progressions existantes doivent se relire), le bundle id iOS `com.zilin.app` et son profil de signature, les fichiers de `maquettes/`.

## Structure

- `docs/` : product brief, backlog, charte, procédures (iOS sans Mac, sources et licences).
- `data/` : pipeline Python (uv). Ingestion des sources, graphe de dépendances, génération des fiches FR et EN, export JSON versionné.
- `app/` : PWA TypeScript, Vite, Svelte. Consomme le JSON exporté par `data/`.
- `maquettes/` : maquettes HTML validées (`zilin-maquette.html` pour Wenlu, sous son ancien nom, et `cilin-maquette.html`). Référence visuelle et fonctionnelle, pas du code de production.
- `.github/workflows/` : publication sur GitHub Pages, pipeline de données (`donnees.yml`), build iOS sur runner macOS et envoi TestFlight.
- `scripts/` : outillage (certificat de signature sous Linux).

## Démarrer

Conteneur de dev (LXD) : `new-lxd.sh zilin` puis VS Code Remote-SSH.

```bash
# données
cd data && uv sync && uv run wenlu --help

# app
cd app && npm install && npm run dev
```

## Le pipeline de données

Sept commandes, une par étape, chacune lisant ce que la précédente a écrit. Tout
ce qui est intermédiaire va dans `data/work/`, hors dépôt ; seuls l'export
(`app/public/data/<version>/`), les polices (`app/public/fonts/`) et les fiches
(`data/sources/fiches/`) sont versionnés.

```
fetch  →  ingest  →  build  →  export  →  check
                                 ↘  fonts
```

| Commande | Ce qu'elle fait | Dépend de | Écrit dans |
|---|---|---|---|
| `wenlu fetch` | télécharge Make Me a Hanzi, CC-CEDICT, Unihan, cjk-decomp, avec empreintes et journal de provenance | — | `data/work/sources/` |
| `wenlu ingest` | normalise ces sources et les listes de niveaux | `fetch` | `data/work/ingest/` |
| `wenlu build` | réconcilie les décompositions avec GF 0014-2009, construit le graphe, les familles et les parcours, écrit `ecarts.md` | `ingest` | `data/work/build/` |
| `wenlu fonts` | sous-ensemble et woff2 des trois familles de la charte | `export` (il dit quels caractères l'app écrit) | `app/public/fonts/` |
| `wenlu export` | assemble les seuls fichiers que l'app lira, séparés par régime de licence | `build` | `app/public/data/<version>/` |
| `wenlu check` | contrôles qualité sur tout ce qui précède, sans rien réécrire | `build`, `export` | — |
| `wenlu tout` | enchaîne fetch, ingest, build, export, check et s'arrête à la première erreur | — | tout ce qui précède |

```bash
cd data && uv run wenlu tout      # la chaîne complète
cd data && uv run wenlu check     # les seuls contrôles
```

`wenlu fonts` ne fait pas partie de `wenlu tout` : il télécharge trois familles de
polices et met une minute à produire les woff2. Il se lance à la main, après
`export`, quand le périmètre exporté a changé — sinon Noto Serif SC n'embarque pas
les caractères que « Ma forêt » affiche.

`audio`, `contes` et `fiches` sont à part aussi : elles se lancent à la main, jamais
dans `wenlu tout`. `contes` et `fiches generer` appellent l'API Anthropic et
demandent une clé (les fiches peuvent aussi s'écrire sans, voir plus bas) ; `audio` fait tourner Kokoro en local (`uv sync --extra audio`, poids téléchargés
depuis Hugging Face au premier passage).

Toutes les commandes sont idempotentes : deux passages écrivent les mêmes octets,
et le résultat ne dépend pas du grain de hachage du processus. Seul
`data/work/sources/PROVENANCE.md` s'allonge, d'un bloc daté par passage.

Codes de sortie, les mêmes partout : **0** tout va bien, **1** erreur de données
(source absente, contrôle bloquant en échec, caractère hors parcours), **2** clé
d'API absente.

### Sur GitHub Actions

Le workflow `donnees.yml` fait tourner le pipeline sur un runner GitHub, qui atteint
ce que le poste de développement n'atteint pas (Hugging Face, MDBG, Unicode). Il se
déclenche à la main : onglet Actions, « donnees », Run workflow ; ou

```bash
gh workflow run donnees.yml -f etapes=audio -f parcours=lire -f seuil=255
gh run watch   # puis le résumé du run
```

Chaque passage refait `wenlu tout`, puis l'étape choisie. `audio` synthétise la voix
Kokoro en local (sans clé) et l'exporte dans `app/public/data/<version>/audio/` ;
`wenlu audio voix` liste les voix du modèle, l'entrée `voix` en choisit une autre.
Ce qui change sous `app/public/data/` ou `data/sources/` part en un commit sur la
branche `donnees/<étape>`, repartie de `main` et poussée en force à chaque passage :
le résumé du run donne les chiffres (fichiers, taille, textes sans audio, voix) et le
lien de comparaison pour ouvrir la PR. Les journaux (provenance, `qualite.md`,
`audio.json`, carte du modèle) sont dans l'artefact du run.

`fiches` et `contes` soumettent un lot à l'API Message Batches et s'arrêtent ; un
second déclenchement, `etapes: recuperer`, une fois les lots terminés (moins de
24 h), récupère et valide. Le journal des lots passe d'un run à l'autre par le cache
`travail-*`, et les textes produits sont dans l'artefact. Ces étapes demandent le
secret `ANTHROPIC_API_KEY` (Settings, Secrets and variables, Actions) ; sans lui,
elles sont sautées et le résumé le dit. Une fiche ou un conte généré reste « à
relire » : la relecture humaine est obligatoire avant tout export.

### Rédiger des fiches sans API

Les fiches peuvent aussi être rédigées sans clé d'API, par des agents Claude Code
dans leur session, puis importées avec les mêmes contrôles que les fiches générées.
Il faut le build (`wenlu tout`, ou au moins `fetch`, `ingest`, `build`).

```bash
cd data
uv run wenlu fiches a-rediger --lot 3 --sur 13   # les caractères du lot 3, dans l'ordre du parcours
uv run wenlu fiches contexte 人 大 天             # ce qu'il faut savoir pour chacun, et un squelette
# écrire data/sources/fiches-brouillons/<c>.json (format dans data/schema.md)
uv run wenlu fiches importer 人 大 天             # contexte, valider(), écriture a_relire ou rejete
uv run wenlu fiches exporter-relecture           # data/work/relecture.json, pour la relecture humaine
uv run wenlu fiches appliquer-relecture decisions.json   # {"人": "relu", "大": "rejete"}
```

`contexte` donne le pinyin, la décomposition GF 0014-2009, le jour du parcours, les
caractères acquis ce jour-là (les seuls permis dans les mots et la phrase), les mots
candidats de CC-CEDICT sans leur définition, et les contraintes de `valider()`.
`importer` affiche, par brouillon, les refus (phrases comptées, étiquette, mots hors
candidats, caractères hors de l'acquis) et les écarts : on corrige le brouillon et on
relance, jusqu'à ce qu'il passe. La fiche écrite dans `data/sources/fiches/` le dit :
`generation.api` vaut « session Claude Code (sans API) », `generation.modele`
« rédaction manuelle », et `empreinte_invite` est l'empreinte du brouillon.
L'étiquette `attesté` suppose une origine établie (Shuowen, formes oraculaires) ;
dans le doute, `mnémotechnique`. Les fiches de 人, 大 et 天 servent d'exemples.

Brouillons et fiches sont versionnés ; la relecture reste humaine et seule une fiche
relue s'exporte. Après un import, l'empreinte de l'export change : `wenlu export`.

## Développer sans machine locale

- Claude Code sur le web (claude.ai/code) clone ce dépôt dans une VM Anthropic, travaille sur une branche et ouvre une PR ; se pilote depuis le navigateur ou l'app mobile Claude. Prérequis : installer l'app GitHub « Claude » sur le dépôt.
- À chaque fusion sur `main`, le workflow `pages.yml` publie l'app et le site public sur GitHub Pages : testable sur l'iPhone sans rien installer. Activer Pages (Settings, Pages, Source : GitHub Actions).
- Le conteneur LXD reste optionnel, pour le pipeline de données et le débogage local.

## Hors ligne et écran d'accueil

L'app s'installe : sur iPhone, Safari, Partager, « Sur l'écran d'accueil ». Elle s'ouvre alors en plein écran sous le nom Wenlu, icône encre sur papier.

Le service worker (`vite-plugin-pwa`, `registerType: 'prompt'`) précache la page, le JS, le CSS, les polices, les icônes, le manifest et le JSON servi avec l'app : après un premier chargement, tout répond sans réseau. Une nouvelle version se télécharge en arrière-plan et ne s'applique (avec son rechargement) qu'au passage de l'app au second plan : jamais sous les yeux, ni pendant l'anecdote ni au milieu d'une session, sans fenêtre à fermer.

Les icônes de `app/public/icons/` sont engendrées depuis la marque, pas dessinées à la main :

```bash
cd app && npm run icons   # mode d'emploi en tête de app/scripts/icons.mjs
```

Le script rastérise le SVG avec un Chromium de Playwright, qui reste un outil de fabrication : il n'est pas une dépendance de l'app et se donne par `NODE_PATH`.

## Le site public

Une page par caractère de l'export, en français (`/zilin/c/休/`) et en anglais (`/zilin/en/c/休/`), un index des familles (`/zilin/familles/`, `/zilin/en/families/`) et la page des licences (`/zilin/licences/`, `/zilin/en/licenses/`). Le générateur, `app/scripts/site/`, lit l'export versionné (`app/public/data/<version>/`, la version de `src/lib/content.ts`) et écrit du HTML statique dans `dist/`, à côté de l'app : pas de framework, pas de JavaScript dans les pages.

```bash
cd app && BASE_PATH=/zilin/ npm run build
cd app && BASE_PATH=/zilin/ SITE_ORIGIN=https://jon-gyt.github.io npm run site
```

- L'ordre compte : `vite build` vide `dist/`. Le site vient après, et `pages.yml` fait de même.
- `BASE_PATH` est la base de l'app, liée au nom du dépôt ; `SITE_ORIGIN` l'origine des URL canoniques, des `hreflang` et de `sitemap.xml`.
- Le service worker de l'app ne précache rien du site et laisse ses pages au réseau (`navigateFallbackDenylist`, `globIgnores` dans `vite.config.ts`, tirés de `scripts/site/chemins.ts`). `npm run site` échoue si `sw.js` en précache une.
- Les grands caractères et l'ordre des traits sont dessinés depuis les traits (`src/lib/glyph.ts`). Le sens, l'origine, les mots et la phrase n'apparaissent que pour une fiche relue. Un caractère sans traits dans l'export n'a pas de page.
- Chaque page porte l'attribution de l'Arphic Public License ; la page des licences reprend `LICENCES.md` et publie les fichiers de `traits/` (APL §2 b).
- `robots.txt` n'est lu par les moteurs qu'à la racine du domaine : sous `/zilin/`, le plan du site se déclare dans la Search Console.
- Tests : `scripts/site/site.test.ts`, dans `npm test`.

## Règles

Voir `CLAUDE.md`. Le brief produit fait foi : `docs/product-brief.md`.
