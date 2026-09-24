# Product Brief : Wenlu 文路

Application iPhone (puis web et Android) pour apprendre à lire le chinois par l'arbre des caractères.

## 1. Vision

Les caractères ont des parents. On apprend une brique, puis tout ce qu'elle engendre. Chaque caractère est décomposé jusqu'aux composants de base, avec son origine et le rôle de chaque élément (son, sens, forme). Un caractère se débloque quand ses briques sont acquises.

Synthèse : Wenlu vend la compréhension avant la mémorisation.

## 2. Cadres de référence

L'app suit trois cadres officiels. Ils sont cités dans la fiche App Store.

- France : seuils sinographiques de l'Éducation nationale (255, 405, 505, 805, 1555 caractères), avec la distinction caractères actifs (lire et écrire) et passifs (lire). Méthode des « caractères-premiers » de Bellassen et Audry-Iljic.
- International : référentiel HSK 3.0, programme officiel de novembre 2025 en vigueur au 1er juillet 2026, avec ses deux listes par niveau : caractères à reconnaître, caractères à écrire.
- Chine : norme GF 0014-2009 « Composants des caractères usuels modernes et leurs noms » (514 composants pour 3 500 caractères). La décomposition canonique de chaque caractère suit cette norme. L'étymologie est une couche par-dessus, jamais un remplacement.

Règle éditoriale : dans chaque fiche, l'origine attestée et le moyen mnémotechnique sont distingués et étiquetés.

## 3. Cible

- Adultes apprenant le chinois en autonomie ou en parallèle d'un cours. Débutants jusqu'au HSK 4.
- Public francophone et anglophone dès la version 1. Portugais brésilien en version 2.
- Profil : veut comprendre plutôt que bachoter, a déjà décroché d'une app généraliste.

## 4. Positionnement

| Produit | Modèle | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|---|
| Pleco | gratuit + modules | dictionnaire de référence | pas de parcours |
| Skritter | abonnement | tracé et SRS | pas d'arbre ni d'étymologie |
| HelloChinese, Duolingo | abonnement | cours gamifié | caractères traités comme des images |
| Hanzi Hero, WaniKani | abonnement | progression par composants | anglais seul, étymologie faible |
| Outlier (module Pleco) | achat unique | étymologie rigoureuse | pas d'apprentissage |

Positionnement : l'arbre étymologique qui apprend à lire, conforme aux seuils de l'Éducation nationale et au HSK 2026, en français et en anglais, sans abonnement obligatoire.

## 5. Identité

- Nom : Wenlu 文路 (wénlù), le chemin de l'écrit : 文 l'écrit, 路 le chemin.
- Logo : le caractère 文, dessiné depuis ses données de traits comme tout grand caractère, son premier trait, le point 丶, en cinabre. Il s'écrit trait par trait à l'ouverture, le point d'abord. Logotype Manrope 700.
- Palette : papier de riz #F4EEE2, encre #1F1B18, cinabre #C8371F (logo, élément ajouté, position sur le chemin), indigo #2B4C7E (action, progression, briques de son), ocre #8C5A2B (briques de sens), vert bambou #5E8A6A (acquis). Un seul thème, le papier clair : ni mode sombre, ni réglage de thème.
- Pigments : les quatre cases du menu prennent les pigments de la peinture chinoise, 石青 azurite #1E5A8A, 藤黄 gomme-gutte #9A6300, 桃红 rouge de pêcher #A8506B, 石绿 malachite #1F7A5A, chacun sur son fond pâle.
- Thèmes de fête : l'app se met en fête quelques jours par an, aux dates du calendrier luni-solaire que le pipeline calcule (`data/sources/fetes/`). Le Nouvel An 春节, du réveillon à la fête des Lanternes : papier chaud, fleurs de prunier qui tombent, cases rouges, rosace de papier découpé autour du caractère du jour, vœu 新年快乐 avec un 福 à l'envers et une lanterne, flocon pour Tao. La mi-automne 中秋, de trois jours avant au lendemain, toujours de nuit : bleu 黛, pleine lune qui porte le caractère du jour, lapin de jade, osmanthe, lanternes célestes, gâteau de lune pour Tao. Ce jour-là, l'anecdote est celle de la fête. Le décor passe derrière tout, ne se touche pas, et disparaît si l'on réduit les animations.
- Pigments de fête : le rouge de fête #9E1F2A, cramoisi, distinct du cinabre, ne sert qu'au décor (rosace, lanterne, cases, 福) ; le cinabre garde son rôle. L'abricot #E3A33B est un aplat, jamais un doré. Décision du propriétaire, en attente de l'amendement de CLAUDE.md.
- Typographie : Manrope (titres, voix du guide), Source Sans 3 (interface), Noto Serif SC (mots et phrases). Les grands caractères ne sont pas une police : ils sont dessinés trait par trait à partir des données de tracé, style 楷, et s'écrivent au pinceau à l'apparition.
- Mascotte : Tao 桃, une graine de pêcher qui grandit (graine, pousse, jeune pêcher, pêcher en fleur à 300 caractères, pêches à 1 000). Compagne de toutes les activités, voir section 9. Ami : Que 雀, le moineau, qui remet les cadeaux de la série.
- Principes : un écran, une action ; le rouge est un sceau, pas une alerte ; pas de doré, pas de dragon, pas d'emoji, pas d'illustration réaliste.

## 6. Structure de l'app

Une maison, une ligne, des détours. Le menu est la maison : tout en part, tout y revient. La session est la ligne : ses pas s'enchaînent sans repasser par le menu. Réviser, Jouer, Lire, Ma forêt, Chercher et Réglages sont les détours, et aucun ne dérègle la session. Il n'y a pas de barre d'onglets.

Ouverture : le logo s'écrit (1,6 s), puis l'anecdote du jour, qui compte comme le pas 1, Ouvrir, puis le menu. Au tout premier lancement, la première session passe avant tout : 人, 大, 天, puis lire 天天. Quatre minutes, un mot lu. Deux questions ensuite (objectif, rythme). On arrive alors sur le menu, la journée faite : la première graine est plantée, la session complète commence le lendemain.

### Le menu

Il tient sur un écran de téléphone, sans défiler.

- En-tête : la marque, puis Chercher (une loupe) et Réglages, par deux icônes. Pendant une fête, le vœu prend la place de la marque ; les icônes restent.
- La carte du jour : le caractère dans son 米字格, dessiné depuis les traits, la brique nouvelle en cinabre ; son pinyin, qui se fait entendre ; son sens et sa décomposition (亻 + 主). Toucher le caractère le réécrit au pinceau et le prononce.
- Le chemin : six coups de pinceau, un par pas (faits en jade, en cours à l'encre, à venir en filet). Tao marche sur le pas en cours et dit une phrase qui dépend de l'état de la journée ; la toucher la fait sauter et changer de phrase. Dessous, « Pas 2 sur 6 · Échauffer » et la durée.
- Un seul bouton plein : « Commencer la session », « Reprendre au pas 3 ». La journée faite, il devient « Une session de plus · une brique », en contour.
- Quatre cases identiques : Réviser 温, Jouer 玩, Lire 读, Ma forêt 林. Avant la session, Réviser dit « Dans la session » et ouvre le pas Échauffer, pour que la pile ne se vide jamais en douce ; après, elle ouvre une révision en plus. Jouer est la seule porte des jeux. Lire ouvre les contes. Ma forêt garde les familles, la série et les récompenses, deux niveaux au plus.
- Chaque écran ouvert depuis le menu a un seul retour, qui y ramène.

États du menu : nouvelle journée ; session entamée (reprise au pas exact, sauvegarde à chaque tap) ; journée faite (« Graine plantée, une seule par jour ») ; session de plus en cours ; retour après absence (mode rattrapage : révisions seules par blocs de cinq minutes, annoncés un à la fois, « Bloc 1 · 14 cartes », Tao en pot, aucun nouveau caractère tant que la pile n'est pas redescendue, message neutre, jamais de compteur de jours perdus).

### La session, six pas dans le même ordre

1. Ouvrir : l'anecdote du jour, culturelle, accrochée à un caractère (20 s, sautable). Elle se lit à l'ouverture.
2. Échauffer : les révisions dues, en questions (2 à 4 min).
3. Apprendre : une brique, puis un ou deux composés. Une seule brique nouvelle par session de 10 minutes.
4. Utiliser : deux mots, une phrase, trois lignes à lire avec uniquement l'acquis. Le caractère du jour en rouge.
5. Fixer : une vérification sur ce qui vient d'être vu.
6. Clore : le constat en une ligne, la graine plantée (animation), la semaine et la série, le rendez-vous de demain. C'est la seule fin : on revient ensuite au menu.

Les pas s'enchaînent sans repasser par le menu. Chaque pas porte en tête la même barre de six coups de pinceau, et « Quitter », qui sauvegarde et ramène au menu ; le menu propose alors de reprendre au pas exact.

Budget choisi par l'utilisateur : 5, 10 ou 20 minutes.

### Travailler plus : la session de plus

La journée faite, « Une session de plus » ajoute une brique : quatre pas, Apprendre (la brique suivante du parcours), Utiliser, Fixer, Clore. Pas d'anecdote ; Échauffer passe devant seulement s'il reste des cartes dues. Jamais une seconde graine : la série compte les jours, pas les sessions, et le menu garde le compte (« Graine plantée · 2 sessions de plus »). Pas de limite par jour. Jamais en rattrapage : aucune brique nouvelle n'entre tant que la pile n'est pas redescendue. Rien ne remet la journée à zéro avant le lendemain.

Fluidité : un tap par écran, bouton principal unique en bas, avance automatique après une bonne réponse (1,3 s, tap pour aller plus vite), audio au toucher du caractère, pas de menu ni de fenêtre modale en session, « Quitter » sauvegarde sans question. Explications en trois phrases ; la suite dans la fiche, d'un tap.

## 7. Pédagogie

- Curriculum : graphe de dépendances généré à partir des décompositions GF 0014-2009, ordonné par fréquence et par niveau. Deux parcours à l'objectif choisi : « Lire » suit les seuils français (255 d'abord), « Passer le HSK » suit le référentiel 2026. Même arbre.
- Révision par questions, sept types : sens d'un caractère, caractère à partir du sens, assemblage de briques, trou dans un mot, reconnaissance à l'oreille, « quel élément donne le son ? », tracé au doigt. Leurres choisis par ressemblance de composants.
- Notation automatique, sans auto-évaluation : juste du premier coup en moins de six secondes, 12 jours ; juste mais lent, 4 jours ; juste après une erreur, 1 jour ; faux deux fois, la réponse est montrée, retour dans 10 minutes. Algorithme FSRS, rétention cible réglable.
- Correction toujours explicative, par les briques. Pas de félicitations, des constats.
- Tracé : proposé une fois par brique de base à la première rencontre, désactivable. Jamais demandé pour les composés. Par niveau, aligné sur « actifs / passifs » côté France et sur la liste d'écriture du HSK côté international.
- Paires à ne pas confondre injectées quand deux caractères proches sont acquis (己/已, 未/末, 天/夫, 日/曰, 人/入, 土/士).
- Le mot avant le caractère seul : chaque fiche porte deux mots et une phrase ; lecture de textes générés avec les seuls caractères acquis dès une vingtaine.
- Contes : des contes et histoires chinoises réécrits à chaque seuil avec les seuls caractères du seuil. Le même conte existe en plusieurs versions (255, 405, 505, 805, 1555) ; l'utilisateur relit la même histoire, plus riche, à mesure que son acquis grandit. Les versions sont générées par lots dans le pipeline puis relues, jamais dans l'app.

## 8. Motivation

- Une graine par jour travaillé, sept graines font un arbre. Écran de série animé après chaque révision. Un jour de rattrapage est un jour travaillé : le premier bloc fait plante la graine, une seule par jour.
- Jour de repos : un par semaine complète, deux en réserve au plus, protège la série.
- Paliers : 7 jours, un jour de Wenlu complet ; 30 jours, une semaine ; 100 jours, moins 30 % sur l'achat à vie (code à usage unique) ; 365 jours, Wenlu complet offert. Pas de remise sur l'abonnement mensuel.
- Ma forêt : une colline, un arbre par famille dont la taille suit la progression, un brin d'herbe par caractère, Miao dessus. Le dimanche, récapitulatif de la semaine partageable en image.
- Notification : une par jour, à l'heure choisie, avec le début de l'anecdote.

### Le tableau des trophées

On y entre depuis Ma forêt (« Tes trophées », N sur M et le prochain). Règle : chaque trophée se gagne en lisant, jamais au temps passé. Aucune règle ne lit une durée, un budget ou un temps de réponse. Pas de points, pas de classement, pas de doré. Tout se calcule depuis la progression et le contenu exporté (`app/src/lib/trophees.ts`).

| Famille | Ce qui le donne | Sceau |
|---|---|---|
| Lire | 10, 50, 100, 255 (premier seuil), 505, 1555 caractères lus, au seuil de stabilité de Ma forêt | le nombre |
| Sceaux de famille | une famille d'au moins deux caractères lue en entier ; on montre les familles commencées et quelques suivantes du parcours | la racine |
| Pièges déjoués | une paire de `paires.json` lue dix fois de suite sans confusion, une fois les deux caractères acquis | la paire |
| Contes | chaque conte lu, relu à chaque seuil | le seuil |
| Objets de Tao | pinceau (dix briques tracées), lanterne (dix devinettes), bol (la première recette) | pictogramme au trait |
| Série | 7, 30, 100, 365 jours, les cadeaux remis par Que 雀 | « 7 j » |

Un trophée est un sceau carré 印 : obtenu, gravé en clair sur l'encre avec un double filet ; à venir, en pointillés avec sa progression (« 62 / 100 »). Le toucher montre son détail dans la carte du résumé, sans fenêtre modale.

Ce que la progression ne suit pas encore reste verrouillé, jamais estimé : la lecture des contes, les devinettes et les recettes. Pour les pièges, la progression ne garde pas le leurre choisi : une lecture compte « sans confusion » quand la révision d'un des caractères de la paire n'est pas ratée, quelle que soit sa vitesse.

## 9. Tao et les jeux

### Tao, la compagne

Tao suit toutes les activités et adopte la posture de l'utilisateur : bulle avec le caractère en leçon, mange pendant la révision (une carte, une bouchée ; erreur, grimace ; série juste, bond), lit par-dessus l'épaule en lecture, tient un pinceau au tracé, porte la lanterne aux devinettes, goûte en cuisine, marche sur le chemin de la série, écoute l'anecdote assise.

- Croissance : additionne toutes les activités. Paliers 100, 300 (fleurs), 1 000 (pêches).
- Humeur : vient de la variété, adoucie par les jours de repos. Trois fois la même activité d'affilée, elle s'ennuie et propose un jeu ; une semaine sans lecture, elle apporte un texte. C'est elle qui pousse vers les jeux, pas une notification.
- Journal : chaque soir, une ligne (« Aujourd'hui j'ai appris 住, mangé 14 cartes, résolu une devinette, cuisiné un 蛋炒饭 »). Le dimanche, la semaine en image partageable.
- Collection : ce que les jeux rapportent se voit sur elle (lanterne des devinettes, bol des recettes, sceau de famille sur le pot, flocon au Nouvel An, fleur de prunier au Printemps). Rien ne s'achète.
- Interdits : tomber malade, mourir, pleurer, culpabiliser. Sans l'utilisateur elle se met en pot et attend ; à son retour elle se redresse sans reproche.

### Les jeux retenus

Règle : chaque jeu doit répondre à « qu'est-ce que l'utilisateur sait lire de plus après ? ». Pas de points au temps passé, pas de vies, pas de classements, pas de coffres. Détail et exemples dans `docs/jeux.md`.

| Jeu | Ce qu'il fait lire | Où |
|---|---|---|
| Assembler contre la montre | produire le caractère à partir des briques, 8 s | pas Fixer, révision (1 sur 5) |
| La chaîne | chaque caractère contient le précédent (人 → 大 → 天) | révision, week-end |
| Le dictionnaire éclair | deviner un mot jamais appris (火车, 电脑) | pas Utiliser, compteur « mots devinés » |
| La coquille | trouver le caractère faux dans un message (夫 pour 天) | paires à ne pas confondre |
| Le message WeChat | répondre à un message avec l'acquis | pas Utiliser, dès la 2e semaine |
| Les jumeaux | 己 已 巳 en flash de 700 ms | métro, révision |
| Les lettres de Que | feuilleton hebdomadaire écrit avec l'acquis | dimanche |
| Les saisons | le cercle change avec le calendrier chinois, un caractère bonus par fête | Ma forêt |
| Les devinettes de lanternes | 灯谜 : la décomposition déguisée (« une bouche mord la queue du bœuf » : 告) | chaque matin avec Tao, fête des Lanternes |
| La cuisine de Tao | recette en chinois, ingrédients sur l'étal, dix plats de cantine | nourrir Tao |

## 10. Périmètre de la version 1

### Gratuit

- Seuil 255 et HSK 1 (2026) complets : décomposition, origines, révision en questions, audio, tracé, anecdotes, série, forêt.
- Consultation en lecture seule de l'arbre complet.
- Trois contes au seuil 255.
- Tao complète ; jeux gratuits : assembler, la chaîne, les jumeaux, la coquille, le dictionnaire éclair, une devinette par jour, la cuisine (trois plats).

### Payant (achat à vie ou abonnement mensuel)

- Seuils 405 à 1555 et HSK 2 à 6.
- Dictionnaire complet : 9 000 caractères décomposés et expliqués.
- Formes anciennes à côté de chaque brique.
- Textes de lecture générés avec les seuls caractères acquis.
- Bibliothèque complète de contes, à tous les seuils.
- Exercices « paires à ne pas confondre ».
- Synchronisation iCloud.
- Jeux complets : les lettres de Que, le message WeChat, toutes les devinettes, dix plats, les saisons avec caractères bonus.

### Hors périmètre V1

- Grammaire, oral en production, tons.
- Comptes utilisateurs, social, classements.
- Android (V2, même code web).

## 11. Contenu et données

Sources à valider en licence avant usage commercial :

- Norme GF 0014-2009 (composants et noms), listes Eduscol des seuils, référentiel HSK 2026 (PDF officiel, référentiel des caractères p. 352 à 381 ; vérifier le niveau à partir duquel l'écriture est exigée).
- Make Me a Hanzi : décompositions, traits, étymologie en anglais (données LGPL, tracés sous Arphic Public License).
- Hanzi Writer : animation et quiz de tracé (MIT).
- CC-CEDICT : mots (CC BY-SA 4.0, attribution).
- Formes anciennes : polices sigillaires et oracle en licence ouverte, à identifier. Images de sites tiers exclues.
- Origines et anecdotes : textes rédigés pour l'app, à partir du Shuowen et des sources ci-dessus, générés par lots avec Claude puis relus. Aucune reprise de Wiktionary.
- Audio : voix neuronale pré-générée et embarquée pour tous les caractères et mots, en priorité. La voix du téléphone sert de repli pour un texte qui n'a pas encore de fichier ; l'app ne dépend d'aucun service à l'exécution.

Pipeline (Python, dépôt séparé) : ingestion, réconciliation des décompositions avec la norme GF 0014-2009, construction du graphe, génération FR et EN, contrôle qualité (composants inconnus, cycles, doublons, étiquetage attesté / mnémotechnique), export JSON versionné.

## 12. Architecture

- PWA, TypeScript, Vite, Svelte, Workbox. Données statiques JSON par famille. Progression dans IndexedDB, export et import JSON.
- Grands caractères rendus en SVG depuis les données de tracé ; animation pinceau par ligne médiane.
- Hébergement : GitHub Pages ou Cloudflare Pages, site public inclus, une page par caractère (FR et EN).
- Phase App Store : Capacitor, StoreKit 2, CloudKit, retour haptique, widget « caractère du jour », Apple Pencil sur iPad. Nécessite un Mac ou un Mac cloud pour compiler et soumettre.

## 13. Monétisation

- Web : gratuit, périmètre gratuit et pages publiques. Rôle : acquisition et référencement.
- iOS : achats intégrés. Achat à vie non consommable autour de 29,99 €. Abonnement mensuel autour de 3,99 €. Grilles Apple par pays.
- Small Business Program (15 %). Entité porteuse du compte développeur à trancher.

## 14. Lancement sans budget publicitaire

1. Site public indexable, une page par caractère, FR et EN.
2. Bêta TestFlight de 200 testeurs recrutés dans les communautés d'apprenants et les sections de chinois.
3. Démo web sur Show HN et Product Hunt un mois avant l'App Store.
4. Candidature au featuring Apple six semaines avant, dossier appuyé par le widget, Apple Pencil, les raccourcis.
5. Vingt créateurs de contenu FR et EN équipés d'une licence à vie.
6. Sortie : début février 2027, Nouvel An chinois.

## 15. Indicateurs

- Sessions terminées : plus de 80 %. Une session plus longue que le budget annoncé est un défaut.
- Retour à J7 : plus de 30 %.
- Note App Store 4,7 avec 100 avis à trois mois ; 5 000 téléchargements ; conversion payante 3 à 5 % des actifs à 30 jours.
- Rétention réelle par caractère, taux d'erreur par type de question, temps par pas.

## 16. Feuille de route

| Phase | Contenu | Livrable |
|---|---|---|
| 0 | Licences, nom de domaine, PDF HSK 2026 dépouillé | décisions |
| 1 | Pipeline, seuil 255 et HSK 1 complets FR et EN, audio | JSON versionné |
| 2 | PWA : chemin, session, révision en questions, tracé, cercle, série, Tao | app web utilisable au quotidien |
| 2b | Jeux gratuits et devinette du jour | jouable dans la session |
| 3 | Site public, pages caractères, seuils suivants et HSK 2 à 4 | acquisition |
| 4 | Bêta TestFlight, Capacitor, achats, iCloud, haptique, widget | build App Store |
| 5 | Lancement | App Store |

## 17. Risques

- Licences incompatibles avec un produit payant : à lever en phase 0.
- Qualité des origines générées : relecture obligatoire sur le seuil 255 et le HSK 1 à 3, étiquetage attesté / mnémotechnique systématique.
- Rejet Apple pour « site web encapsulé » : fonctions natives prévues dès la phase 4.
- Marché de niche : le bilingue FR et EN conditionne la taille du marché.
- Solo : le périmètre gratuit doit être irréprochable avant d'ouvrir le payant.

## 18. Questions ouvertes

1. Nom de domaine.
2. Entité porteuse du compte Apple et de l'encaissement.
3. Source des formes anciennes compatible avec un usage commercial.
4. Niveau à partir duquel le HSK 2026 exige l'écriture manuscrite.
5. Niveau de relecture humaine au-delà du HSK 3.
