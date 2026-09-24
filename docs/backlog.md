# Backlog Wenlu

Format BMAD : épics puis stories. Priorité dans l'ordre. Une story se termine par un test qui passe et une capture qui ressemble à la maquette.

## Épic 0 · Fondations
- 0.1 Dépôt, conteneur LXD, `uv` et `npm` opérationnels, CI lint et tests.
- 0.2 Tokens de la charte dans `tokens.css`, mode sombre, grain de papier.
- 0.3 Rendu d'un caractère depuis les données de traits, animation pinceau (`glyph.ts`).
- 0.4 Vérification des licences (Make Me a Hanzi, Hanzi Writer, CC-CEDICT, polices anciennes). Décision écrite dans `docs/sources-licences.md`.

## Épic 1 · Données
- 1.1 Ingestion Make Me a Hanzi et CC-CEDICT, listes seuil 255 et HSK 1 (2026).
- 1.2 Réconciliation des décompositions avec GF 0014-2009 ; rapport des écarts.
- 1.3 Graphe de dépendances, détection de cycles, ordre d'apprentissage par parcours (Lire, HSK).
- 1.4 Génération FR et EN des fiches (origine en trois phrases, deux mots, une phrase), étiquette attesté / mnémotechnique. Relecture du seuil 255.
- 1.5 Audio pré-généré (voix neuronale), un fichier par caractère et par mot.
- 1.6 Export JSON versionné par famille, schéma dans `data/schema.md`.
- 1.7 Contes par niveau : un même conte ou une même histoire chinoise réécrit à chaque seuil (255, 405, 505, 805, 1555) avec les seuls caractères du seuil, généré par lots avec Claude dans le pipeline puis relu ; source du conte tracée, glose par caractère, une version par seuil dans le JSON exporté.

## Épic 2 · Session
- 2.1 État de session (six pas, reprise au pas exact, rattrapage).
- 2.2 Le menu : la carte du jour, le chemin à six coups de pinceau, un bouton, quatre cases (Réviser, Jouer, Lire, Ma forêt). Il remplace l'écran Aujourd'hui et la barre d'onglets.
- 2.3 Pas 1 Ouvrir : anecdote du jour, estampe.
- 2.4 Pas 3 Apprendre : brique, composé, tracé optionnel (Hanzi Writer).
- 2.5 Pas 4 Utiliser : mots, phrase, texte de trois lignes avec glose.
- 2.6 Pas 5 Fixer et pas 6 Clore : vérification, graine plantée.
- 2.7 Première session : 人, 大, 天, lire 天天, puis objectif et rythme. On arrive sur le menu, la journée faite.
- 2.8 Le parcours : logo, anecdote, menu ; les pas enchaînés sans repasser par le menu, « Quitter » au pas exact ; une seule fin (Clore) ; la session de plus (quatre pas, une brique, jamais une seconde graine) ; le rattrapage annoncé un bloc à la fois.

## Épic 2c · Contes
- 2c.1 Mode Lire : bibliothèque de contes, version choisie d'après l'acquis (le seuil le plus haut dont tous les caractères sont acquis), lecture avec glose au toucher, audio.
- 2c.2 Le même conte remonte d'un niveau quand l'acquis le permet ; l'app signale qu'une version plus riche est ouverte. Trois contes gratuits au seuil 255, bibliothèque complète en payant.

## Épic 3 · Révision
- 3.1 FSRS (ts-fsrs), rétention cible, planification.
- 3.2 Sept types de questions, leurres par ressemblance de composants.
- 3.3 Notation automatique (juste rapide, juste lent, juste après erreur, montré).
- 3.4 Écran de série : chemin en perspective, Miao avance, Que et les cadeaux. Fondu dans Clore par la story 2.8 : la graine, la semaine et le cadeau de Que y sont, sans second écran de fin.

## Épic 4 · Ma forêt
- 4.1 Cercle des familles, zoom et déplacement, ouverture d'un arbre par famille.
- 4.2 Arbre d'une famille, fiche courte, lancement de la prochaine leçon.
- 4.3 Tao qui grandit (paliers 100, 300, 1 000), postures par activité, humeur par variété, journal du soir, collection visible.
- 4.4 Chercher : la loupe du menu ouvre la recherche d'un caractère de l'export, par son dessin, son pinyin (avec ou sans accents ni tons) ou le sens d'une fiche relue ; au plus vingt résultats, dessinés depuis les traits, avec la famille et le statut (lu, en cours, pas encore) ; toucher un résultat le dit et ouvre sa famille dans l'arbre.

## Épic 4b · Jeux
- 4b.1 Moteur de mini-jeux : un contrat commun (entrée : caractères acquis ; sortie : événements de révision notés), écran hôte, retour vers la session.
- 4b.2 Assembler contre la montre et les jumeaux (données : décompositions, paires à ne pas confondre).
- 4b.3 La chaîne (parcours du graphe sur l'acquis) et la coquille.
- 4b.4 Le dictionnaire éclair (mots CC-CEDICT dont les deux caractères sont acquis) et le compteur « mots devinés ».
- 4b.5 Les devinettes de lanternes : base de 100 devinettes rédigées, une par jour, portée par Tao.
- 4b.6 La cuisine de Tao : dix recettes, ingrédients, erreurs plausibles (牛奶 pour 牛肉).
- 4b.7 Le message WeChat : arbres de dialogue par famille.
- 4b.8 Les lettres de Que : douze lettres pour le seuil 255, générées puis relues.
- 4b.9 Les saisons : calendrier chinois, décor du cercle, caractère bonus par fête.

## Épic 5 · PWA et site
- 5.1 Manifest, service worker, hors ligne, écran d'accueil iOS.
- 5.2 Site public : une page par caractère, FR et EN, indexable.

## Épic 6 · iOS
- 6.1 Shell Capacitor, build CI sur runner macOS, TestFlight.
- 6.2 Achats StoreKit 2 (à vie, mensuel), Small Business Program.
- 6.3 iCloud (CloudKit), haptique, widget caractère du jour.
- 6.4 Fiche App Store, captures, candidature au featuring.

## État au 21 septembre 2026

Relevé sur le dépôt après une revue du pipeline. Les numéros ci-dessus ne bougent pas.

### Livrées

- Épic 0 : 0.1, 0.2, 0.3, 0.4 (décision écrite dans `docs/sources-licences.md`).
- Épic 1 : 1.1, 1.2, 1.3, 1.6. La chaîne complète tourne — `uv run wenlu tout` enchaîne
  fetch, ingest, build, export et check, et deux passages écrivent les mêmes octets.
  8 148 caractères sur 9 574 réconciliés ; 241 du seuil 255 sur 255, 280 du HSK 1 sur 300 ;
  238 familles exportées en 1,33 Mio.
- Épic 2 : 2.1 à 2.8 (2.2 et 2.8 revues le 24 septembre : le menu et le parcours du prototype validé). Épic 3 : 3.1 à 3.4. Épic 4 : 4.1 à 4.4 (4.4, Chercher, le 24 septembre : la recherche en français ne trouvera rien tant qu'aucune fiche n'est relue).
- Épic 4b : 4b.1 et 4b.2. Épic 5 : 5.1.

### Livrées à moitié : le code attend une clé d'API

Les trois chaînes sont écrites, testées sans réseau, et refusent de partir sans clé
(code de sortie 2). Aucun contenu n'a donc encore été produit.

- **1.4, fiches** : génération, validation et relecture en place ; 0 fiche écrite,
  0 relue. Les 485 caractères s'exportent au statut `sans_fiche`, avec leur
  décomposition et leurs tracés, sans texte. `ANTHROPIC_API_KEY`.
- **1.7, contes** : catalogue versionné, génération par lots en place ; 0 version
  écrite. `ANTHROPIC_API_KEY`. Bloque 2c.1 et 2c.2.
- **1.5, audio** : périmètre, manifeste et export en place ; 0 fichier sur les
  731 textes du périmètre. Clé du fournisseur, **et** décision de licence ci-dessous.

### En attente d'une décision

- **Licence de l'audio** : le critère est le droit de redistribuer les fichiers
  générés dans une app payante, sans redevance par écoute. Les conditions d'Azure
  Speech n'ont pas pu être lues (proxy). Tant que la ligne n'est pas vérifiée sur une
  source primaire, aucun fichier synthétisé n'entre dans un artefact distribué.
- **Licence des décompositions** : la chaîne IDS descendue vient de `dictionary.txt`
  (Make Me a Hanzi, LGPL 3.0+), que §2.2 écarte de l'embarqué. Chaque fiche exportée
  nomme la source de sa décomposition (`sources`) pour que la décision se tranche
  caractère par caractère ; `LICENCES.md` la pose noir sur blanc. Non tranchée.
- **Images des anecdotes (2.3)** : l'écran Ouvrir affiche une estampe. Aucune source
  d'images sous licence compatible avec un usage commercial n'est retenue ; les images
  de sites tiers sont exclues (brief §11).
- **Formes anciennes** : aucune police oraculaire sous licence ouverte vérifiée,
  couverture sigillaire insuffisante (§7). Reporté.
- **Listes Eduscol et référentiel HSK 3.0** : conditions de réutilisation non
  consultées (§6).

### Non commencées

2c.1, 2c.2, 4b.3 à 4b.9, 5.2, et toute la phase 6 — hors le workflow CI macOS et la
configuration Capacitor, déjà versionnés.
