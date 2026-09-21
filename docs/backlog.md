# Backlog Zilin

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

## Épic 2 · Session
- 2.1 État de session (six pas, reprise au pas exact, rattrapage).
- 2.2 Écran Aujourd'hui : le chemin, un bouton.
- 2.3 Pas 1 Ouvrir : anecdote du jour, estampe.
- 2.4 Pas 3 Apprendre : brique, composé, tracé optionnel (Hanzi Writer).
- 2.5 Pas 4 Utiliser : mots, phrase, texte de trois lignes avec glose.
- 2.6 Pas 5 Fixer et pas 6 Clore : vérification, graine plantée.
- 2.7 Première session : 人, 大, 天, lire 天天, puis objectif et rythme.

## Épic 3 · Révision
- 3.1 FSRS (ts-fsrs), rétention cible, planification.
- 3.2 Sept types de questions, leurres par ressemblance de composants.
- 3.3 Notation automatique (juste rapide, juste lent, juste après erreur, montré).
- 3.4 Écran de série : chemin en perspective, Miao avance, Que et les cadeaux.

## Épic 4 · Ma forêt
- 4.1 Cercle des familles, zoom et déplacement, ouverture d'un arbre par famille.
- 4.2 Arbre d'une famille, fiche courte, lancement de la prochaine leçon.
- 4.3 Miao qui grandit (paliers 100, 300, 1 000).

## Épic 5 · PWA et site
- 5.1 Manifest, service worker, hors ligne, écran d'accueil iOS.
- 5.2 Site public : une page par caractère, FR et EN, indexable.

## Épic 6 · iOS
- 6.1 Shell Capacitor, build CI sur runner macOS, TestFlight.
- 6.2 Achats StoreKit 2 (à vie, mensuel), Small Business Program.
- 6.3 iCloud (CloudKit), haptique, widget caractère du jour.
- 6.4 Fiche App Store, captures, candidature au featuring.
