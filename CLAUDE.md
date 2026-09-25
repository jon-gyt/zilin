# Wenlu, consignes pour Claude Code

Lis `docs/product-brief.md` avant toute tâche. Il fait foi sur le produit. Les maquettes de `maquettes/` font foi sur l'écran et le comportement attendus ; ne pas les modifier, s'en inspirer.

## Ce qu'on construit

Une PWA (TypeScript, Vite, Svelte) pour apprendre à lire le chinois par les familles de caractères. Un pipeline Python (`data/`) produit le contenu. Le shell iOS (Capacitor) arrive en phase 4 et se compile en CI, jamais en local.

## Règles produit non négociables

- La décomposition canonique d'un caractère suit la norme GF 0014-2009 (514 composants). L'étymologie est une couche par-dessus. Chaque fiche étiquette `attesté` ou `mnémotechnique`, jamais l'un pour l'autre.
- Un caractère n'entre en révision que si toutes ses briques ont une stabilité FSRS suffisante.
- Révision par questions, notation automatique (voir `app/src/lib/srs.ts`). Pas d'auto-évaluation.
- Une seule brique nouvelle par session de 10 minutes. Une session = six pas dans le même ordre.
- Le rouge cinabre marque l'élément ajouté et la position sur le chemin, rien d'autre. Pas de doré, pas d'emoji, pas d'ombre, pas de dégradé.
- Les fêtes ont leurs pigments, distincts du cinabre, pour le seul décor de fête (voir brief, section 5). Le dragon n'apparaît qu'au Nouvel An et à la fête des bateaux-dragons 端午, jamais ailleurs, sauf dans le texte du conte 叶公好龙 dont il est le sujet (jamais dessiné).
- Les grands caractères sont rendus depuis les données de traits (style 楷), jamais depuis une police.
- Tao accompagne toutes les activités dans la posture correspondante (voir brief, section 9). Elle ne meurt jamais, ne tombe pas malade, ne culpabilise jamais. Son humeur vient de la variété des activités, jamais de l'horloge.
- Un jeu n'existe que s'il fait lire quelque chose de plus. Pas de points au temps passé, pas de vies, pas de classements, pas de coffres.

## Conventions de code

- TypeScript strict. Svelte 5. Pas de framework CSS : tokens dans `app/src/lib/tokens.css`.
- Toute donnée de contenu vient de `data/` via JSON versionné dans `app/public/data/`. L'app ne contient pas de contenu en dur.
- Progression dans IndexedDB (Dexie). Export et import JSON.
- Aucune requête réseau à l'exécution en dehors des assets de l'app.
- Tests : Vitest pour `srs.ts`, `session.ts`, `graph.ts`. Un test par règle produit.
- Commits en français, impératif, courts. Un sujet par commit.

## Commandes

```bash
cd app && npm run dev          # serveur local
cd app && npm run build        # dist/
cd app && npm test
cd data && uv run wenlu build  # graphe + export
cd data && uv run wenlu check  # contrôles qualité
```

## Ce qu'il ne faut pas faire

- Ne pas commiter `app/ios/` (généré en CI).
- Ne pas ajouter de dépendance sans la justifier dans le message de commit.
- Ne pas générer de texte d'origine sans passer par le pipeline `data/` (traçabilité de la source).
- Ne pas introduire de compte utilisateur ni de backend.
