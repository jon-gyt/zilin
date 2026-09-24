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
- 1.7 Contes par niveau : un même conte ou une même histoire chinoise réécrit à chaque seuil (255, 405, 505, 805, 1555) avec les seuls caractères du seuil, généré par lots avec Claude dans le pipeline, ou rédigé sans API et importé avec les mêmes contrôles, puis relu ; source du conte tracée, glose par caractère ou par mot, traductions FR et EN, une version par seuil dans le JSON exporté.

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
- 4b.9 Les saisons : calendrier chinois, décor du cercle, caractère bonus par fête. Huit fêtes (春节, 元宵, 清明, 端午, 七夕, 中秋, 重阳, 冬至), dates 2026 à 2035 par `lunar_python`, termes solaires compris ; palette, décor, emblème, vœu, accessoire de Tao et anecdote pour chacune ; un caractère bonus par fête, exporté avec ses traits. Entre les fêtes, les vingt-quatre termes solaires 二十四节气 : dates 2026 à 2035 par `lunar_python` à l'heure de Pékin, textes rédigés (nom, traduction, ligne de nature, phrases de Tao, un caractère à lire par terme, exporté avec ses traits), huit ambiances légères de trois termes (palette `[data-saison]`, petit décor), le terme dans l'en-tête du menu, l'anecdote du jour où il commence ; les fêtes gardent la priorité.

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
- Épic 4b : 4b.1 à 4b.6, 4b.8 et 4b.9 (textes des jeux à relire). Épic 5 : 5.1, et 5.2 (24 septembre).
- 5.2, le site public : `app/scripts/site/` génère du HTML statique depuis l'export
  versionné, dans l'artefact Pages de l'app, après `vite build`. 480 caractères dessinables
  sur 493, une page chacun en français (`/zilin/c/<c>/`) et en anglais
  (`/zilin/en/c/<c>/`), plus l'index des familles et la page des licences : 964 pages,
  15 Mio bruts, 2 Mio compressés. Le caractère au pinceau et l'ordre des traits depuis les
  traits, le pinyin, la décomposition GF 0014-2009 liée page à page, la famille, les
  caractères qui le contiennent ; sens, origine, mots et phrase seulement d'une fiche
  relue (aucune aujourd'hui). Titre, description, canonique, `hreflang`, `DefinedTerm`,
  `sitemap.xml`. Attribution APL sur chaque page ; les fichiers de `traits/` publiés depuis
  la page des licences (APL §2 b). Le service worker ne précache pas le site et ne sert
  plus `index.html` de l'app à ses adresses. Reste : un lien profond de l'app vers un
  caractère (le bouton ouvre l'accueil), la déclaration du plan du site dans la Search
  Console (`robots.txt` sous `/zilin/` n'est pas lu). Les composants sans traits (龰,
  𠂇, ⿰𠄌丶…) ont leur page depuis le 24 septembre : leurs traits sont découpés dans un
  caractère hôte (`data/sources/surcharges/decoupes.tsv`), et ce que Noto Serif SC n'a
  pas (𠂒, 𠃊, 𭃂…) s'écrit en traits, dans l'app comme sur le site. 513 caractères
  exportés, 513 pages.
- 4b.5, les devinettes de lanternes (24 septembre) : 141 devinettes rédigées pour l'app
  dans `data/sources/devinettes/` (120 du seuil 255, 21 du HSK 1), dont six avec leur 字谜
  traditionnel ; leurres choisis à l'export par ressemblance de composants ;
  `devinettes.json` et cinq contrôles bloquants. Une devinette par jour, portée par Tao,
  parmi celles dont la réponse et les briques ont une carte ; résolue, elle remplit la
  lanterne des trophées.
- 4b.4, le dictionnaire éclair (24 septembre) : 222 mots de deux caractères du seuil 255
  et du HSK 1, fréquents et transparents (电脑, 手机, 大水, 医院…), relevés parmi les
  entrées de CC-CEDICT (le mot seul) et hors des mots de fiche ; sens français et anglais
  rédigés pour l'app dans `data/sources/eclair/mots.tsv`, **à relire par le
  propriétaire** (sens et leurres : `wenlu eclair apercu`). Pinyin écrit dans la source
  et contrôlé contre Unihan et les surcharges ; trois leurres par mot, les sens de mots
  voisins, choisis à l'export (jamais un mot de même étiquette `proches`) ;
  `eclair.json` et six contrôles bloquants. Le jeu ne propose qu'un mot dont les deux
  caractères sont acquis et qu'aucune fiche apprise n'a fait lire ; quatre sens, une
  réponse, les deux caractères notés par `grade` ; la correction réécrit le mot au
  pinceau, caractère par caractère. Le compteur « mots devinés » (`Progress.motsDevines`,
  un mot une fois, export et import JSON compris) se lit sur l'écran Jouer et au
  constat ; Tao joue la tête penchée, sans lanterne. Reste : le brancher au pas Utiliser
  (brief §9), qui demanderait une vue de plus dans `UseView` et la reprise au pas exact
  de `session.ts` ; laissé pour ne pas toucher la session.
- 4b.3, la chaîne et la coquille (24 septembre). La chaîne suit les `parts` de l'export,
  sur l'acquis et les seuls caractères exportés ; les décompositions canoniques étant
  plates (人, 大, 天 sont des composants de la norme), une manche enchaîne plusieurs
  chaînes sans caractère commun, jusqu'à douze maillons. La coquille lit
  `coquilles.json` : 58 messages de 6 à 12 caractères du seuil 255, rédigés pour l'app
  dans `data/sources/coquilles/` avec leurs pièges (天, 夫, 日, 王) et leur traduction,
  trois contrôles bloquants ; l'intrus vient d'un groupe de `paires.json` et doit être
  acquis, si bien que le jeu s'ouvre avec 夫 (jour 54 du parcours Lire). Chaque choix
  est noté par `grade` et dit le leurre pris, que les pièges déjoués lisent ; Tao lit la
  coquille par-dessus l'épaule. **Les 58 messages sont à relire par le propriétaire**
  (`wenlu coquilles apercu`).
- 4b.6, la cuisine de Tao (24 septembre), **textes à relire** : dix recettes rédigées pour
  l'app, sans API, dans `data/sources/cuisine/` (recettes, étapes, ingrédients, étal, phrases
  de Tao), traçabilité « rédigé pour l'app ». Dix plats de cantine écrits avec les seuls
  caractères que les parcours posent : 大肉面, 米饭, 菜饭 (les trois gratuits, `gratuit` dans
  les données, cuisinables dans les deux parcours dès les jours 83, 153 et 153 de Lire), puis
  冷面, 面条, 包子, 牛肉面, 鸡蛋面, 牛肉饭, 蛋包饭 (HSK). 蛋炒饭, 番茄炒蛋 et 饺子 sont hors de
  portée (炒, 番, 茄, 饺). Chaque ingrédient a deux ou trois leurres écrits à la main (牛奶
  pour 牛肉, 米酒 pour 米, 茶 pour 菜) ; la question note les caractères que le premier
  leurre n'a pas (肉). `cuisine.json`, nommé par l'index et dans l'empreinte ; cinq contrôles
  bloquants (sources, pinyin, périmètre, parcours, export) ; `wenlu cuisine apercu` pour
  relire. Dans l'app : case « La cuisine de Tao » de Jouer, un plat ne s'ouvre que lorsque
  tous ses caractères sont acquis ; Tao lit la recette, on prend les ingrédients sur l'étal
  (deux essais, notés par `grade`), Tao goûte (posture `goute`) : contente, ou une grimace
  qui propose d'en refaire un. Le premier plat réussi donne le bol des trophées. Pas encore
  d'achat : les dix plats sont ouverts. Reste : relire les textes.
- 4b.9, les saisons (24 septembre) : les huit fêtes du calendrier chinois sont en place, du
  pipeline (`data/sources/fetes/`, dates vérifiées contre la table des fêtes de
  `lunar_python`) au décor de l'app (menu à 393 × 660, anecdote, `theme-color`). Chaque
  anecdote fait découvrir un caractère bonus (灯, 雨, 粽, 桥, 菊, 冬…). Les vingt-quatre
  termes solaires suivent entre les fêtes (`data/sources/saisons/`, `saisons.json`, dates
  vérifiées contre `lunar_python` dans les deux sens) : huit ambiances légères de trois
  termes, le terme sous la marque du menu (« 半 秋分 · l'équinoxe d'automne »), la phrase
  de Tao, l'anecdote du jour où il commence, `theme-color` ; un caractère à lire par terme
  (露, 霜, 雪, 雷…), exporté avec ses traits. Le cercle de Ma forêt prend un petit décor
  dessiné pour chaque fête et chaque ambiance (`CercleDecor.svelte`), dans les coins libres,
  derrière le cercle, coupé si l'on réduit les animations. Le caractère de l'anecdote d'une
  fête ou du premier jour d'un terme est noté dans la progression, une fois, avec sa
  journée et sa source (`trouves`, export et import compris) ; il n'entre pas en révision.
  Ma forêt les montre sous la colline, « Trouvés en chemin », dessinés depuis leurs traits ;
  touché, le caractère se dit et montre sa fête ou son terme. Le tableau des trophées en
  compte huit (sceau 节), une case que le tableau du brief (§8) ne liste pas encore. Reste
  une relecture des textes des termes par le propriétaire.

- 4b.8, les lettres de Que (24 septembre), **à relire par le propriétaire** : douze lettres
  rédigées sans API par une session Claude Code, dans le circuit des contes — fil
  `data/sources/lettres/feuilleton.tsv`, brouillons `lettres-brouillons/`, `wenlu lettres
  contexte | importer | exporter-relecture | appliquer-relecture | apercu`, versions
  `lettres-versions/` au statut `a_relire`, traçabilité « session Claude Code (sans API) ».
  La lettre n n'emploie que les caractères posés par le parcours Lire au jour 7n (rejet
  sinon), 42 à 62 sinogrammes, glose par mot (pinyin, fr, en), traduction par phrase,
  question finale à un mot ; huit contrôles dans `wenlu check`. `lettres.json` ne porte que
  les relues (aucune aujourd'hui), `apercu/lettres.json` les autres, visibles en mode
  relecture. Dans l'app : une lettre par semaine, le dimanche ou à la première session de la
  semaine, quand tous ses caractères ont une carte (`lettres.ts`) ; section « Lettres de
  Que » de Lire, lecteur des contes signé de Que (posture avec sa lettre), case Lire du menu
  « Une lettre de Que » la semaine de l'arrivée ; lue, notée dans la progression. Reste :
  relire les douze lettres ; des lettres pour le parcours HSK (只, 姓, 每, 如, 念, 古, 长
  n'y sont pas posés : dix lettres sur douze ne s'y ouvrent jamais).

### Livrées à moitié : le code attend une clé d'API

Les trois chaînes sont écrites, testées sans réseau, et refusent de partir sans clé
(code de sortie 2). Aucun contenu n'a donc été produit par l'API.

- **1.4, fiches** : génération, validation et relecture en place ; sans clé, la
  rédaction passe par des brouillons (ci-dessous). 3 fiches écrites, 0 relue. Les
  caractères sans fiche relue s'exportent au statut `sans_fiche`, avec leur
  décomposition et leurs tracés, sans texte.
- **1.7, contes** : catalogue versionné, génération par lots en place ; sans clé, la
  rédaction passe par des brouillons (ci-dessous). 3 versions écrites au seuil 255, 0
  relue : 2c.1 et 2c.2 attendent la relecture pour avoir un conte exporté.
- **1.5, audio** : périmètre, manifeste et export en place ; 0 fichier sur les
  731 textes du périmètre. Clé du fournisseur, **et** décision de licence ci-dessous.

### Rédiger des fiches sans API (1.4)

L'API n'est pas payée : les fiches du seuil 255 sont rédigées par des agents Claude
Code dans leur session, sans clé ni réseau, et importées avec les mêmes contrôles que
les fiches générées. La chaîne API reste en place et utilisable.

- Brouillon versionné, `data/sources/fiches-brouillons/<c>.json` : `c`, `origine_fr`,
  `origine_en`, `etiquette`, `roles`, `mots`, `phrase`, et `memo_fr`, `memo_en`
  facultatifs (format dans `data/schema.md`).
- `wenlu fiches a-rediger --lot N --sur M` partage le seuil entre rédacteurs, en lots
  stables ; `wenlu fiches contexte <c>` donne l'acquis du jour, les mots candidats et
  les contraintes ; `wenlu fiches importer` valide et écrit dans `data/sources/fiches/`,
  `a_relire` ou `rejete`, avec la traçabilité « session Claude Code (sans API) »,
  « rédaction manuelle » et l'empreinte du brouillon.
- Relecture humaine inchangée : `wenlu fiches exporter-relecture` rassemble les fiches à
  relire dans `data/work/relecture.json`, `wenlu fiches appliquer-relecture` applique
  `{c: "relu" | "rejete"}`.
- Fait : 人, 大 et 天, à relire. Reste : 252 caractères du seuil, puis les 95 briques du
  parcours Lire hors liste (亻, 氵, 木…), que l'export embarque aussi. 24 caractères du
  seuil n'ont pas deux mots candidats lisibles à leur jour : leur fiche en portera moins,
  écart signalé à la relecture.
- Lots conseillés : `--sur 13`, une vingtaine de caractères par agent.

### Rédiger des contes sans API (1.7)

Même démarche que les fiches : les contes sont rédigés par des agents Claude Code dans
leur session, sans clé, et importés avec la validation des contes générés. La chaîne API
reste en place, et demande désormais le même format : pinyin du titre, traduction
anglaise, glose par mot.

- Brouillon versionné, `data/sources/contes-brouillons/<id>/<seuil>.json` : `conte`,
  `seuil`, `ouvrage` (celui du catalogue, ou `null`), `titre` `{zh, pinyin}`, `phrases`
  `[{zh, pinyin, fr, en}]`, `glose` `[{zh, pinyin, fr, en}]` par caractère ou par mot
  (format dans `data/schema.md`).
- `wenlu contes contexte <id> --seuil 255` donne la liste exacte du seuil, l'intrigue du
  catalogue et les contraintes ; `wenlu contes importer` valide (caractères hors seuil :
  rejet ; longueur, pinyin, glose, traductions : écarts) et écrit dans
  `data/sources/contes-versions/<seuil>/<id>.json`, `a_relire` ou `rejete`, avec la
  traçabilité « session Claude Code (sans API) », « rédaction manuelle » et l'empreinte
  du brouillon. Le journal des lots d'API reste dans `data/work/contes/lots/`.
- Relecture humaine : `wenlu contes exporter-relecture` rassemble les versions à relire
  dans `data/work/relecture-contes.json`, `wenlu contes appliquer-relecture` applique
  `{"<seuil>/<id>": "relu" | "rejete"}`.
- Fait, à relire : les trois contes gratuits du seuil 255 (brief §10), 愚公移山,
  拔苗助长 et 南辕北辙, de 117 à 119 sinogrammes, 0 rejet, 0 écart. 南辕北辙 a rejoint
  le catalogue pour l'occasion : les récits animaliers (守株待兔, 塞翁失马, 画蛇添足…)
  ne s'écrivent pas avec les 255 caractères, qui n'ont ni 兔, ni 马, ni 蛇.
- Pour le lecteur (2c.1) : l'export d'un conte relu porte `titre_en`, `titre_pinyin`,
  une syllabe de pinyin par sinogramme, `fr` et `en` par phrase, et la glose
  `{entrée: {pinyin, fr, en}}` que le lecteur découpe par la plus longue entrée.
- Reste : relire les trois contes, puis les versions des seuils suivants quand leurs
  listes seront versionnées.

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

2c.1, 2c.2, 4b.7, et toute la phase 6 — hors le workflow CI macOS et la
configuration Capacitor, déjà versionnés.
