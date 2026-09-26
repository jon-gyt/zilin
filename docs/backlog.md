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
- 1.7 Contes par niveau : un même conte ou une même histoire chinoise réécrit à chaque niveau (le seuil 255, puis les niveaux HSK 1 à 7-9, lus en cumul) avec les seuls caractères du niveau, généré par lots avec Claude dans le pipeline, ou rédigé sans API et importé avec les mêmes contrôles, puis relu ; source du conte tracée, glose par caractère ou par mot, traductions FR et EN, une version par niveau dans le JSON exporté.

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
- 2c.1 Mode Lire : bibliothèque de contes, version choisie d'après l'acquis (le niveau le plus haut dont tous les caractères sont acquis), lecture avec glose au toucher, audio.
- 2c.2 Le même conte remonte d'un niveau quand l'acquis le permet ; l'app signale qu'une version plus riche est ouverte. Trois contes gratuits au seuil 255, bibliothèque complète en payant.
- 2c.3 Lire en étagères : « Aujourd'hui » (l'anecdote en fiche, la lettre de Que en enveloppe), puis les contes en livres cousus sur trois étagères, « À lire maintenant », « Bientôt » (sur le chemin, « s'ouvre dans N j »), « Plus loin ». Motif de couverture au catalogue.

## Épic 3 · Révision
- 3.1 FSRS (ts-fsrs), rétention cible, planification.
- 3.2 Huit types de questions, leurres par ressemblance de composants (et de son, à l'oreille) : l'oreille par la voix de l'appareil et le ton s'ajoutent aux sept de départ.
- 3.3 Notation automatique (juste rapide, juste lent, juste après erreur, montré).
- 3.4 Écran de série : chemin en perspective, Miao avance, Que et les cadeaux. Fondu dans Clore par la story 2.8 : la graine, la semaine et le cadeau de Que y sont, sans second écran de fin.

## Épic 4 · Ma forêt
- 4.1 Cercle des familles, zoom et déplacement, ouverture d'un arbre par famille.
- 4.2 Arbre d'une famille, fiche courte, lancement de la prochaine leçon.
- 4.3 Tao qui grandit (paliers 100, 300, 1 000), postures par activité, humeur par variété, journal du soir, collection visible.
- 4.4 Chercher : la loupe du menu ouvre la recherche d'un caractère de l'export, par son dessin, son pinyin (avec ou sans accents ni tons) ou le sens d'une fiche relue ; au plus vingt résultats, dessinés depuis les traits, avec la famille et le statut (lu, en cours, pas encore) ; toucher un résultat le dit et ouvre sa famille dans l'arbre.
- 4.5 Le personnage (mode héros, décision du propriétaire, maquette validée `wenlu-heros.html`) : trois bêtes non genrées (玉兔, 熊猫, 醒狮) et un nom, choisis à la fin de la première session, changés dans Réglages sans rien perdre ; douze rangs du bébé à l'adulte (启蒙 à 状元, paliers 0 à 1 000) ; quatre arts (读 写 听 说), un point par bonne réponse notée, dérivé des événements de révision, des tracés achevés et des jeux ; le personnage grandit à chaque point, change de silhouette et de tenue, gagne une aura ; écran « Mon personnage » ouvert par le portrait de l'en-tête du menu ; 放榜 au retour au menu quand un rang est franchi. Textes par le pipeline (`data/sources/heros/`, `heros.json`), dessins dans l'app.

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
- Épic 2 : 2.1 à 2.8 (2.2 et 2.8 revues le 24 septembre : le menu et le parcours du prototype validé). Épic 3 : 3.1 à 3.4. Épic 4 : 4.1 à 4.5 (4.4, Chercher, le 24 septembre : la recherche en français ne trouvera rien tant qu'aucune fiche n'est relue ; 4.5, le personnage, le 25 septembre).
- Épic 4b : 4b.1 à 4b.9 (textes des jeux à relire). Épic 5 : 5.1, et 5.2 (24 septembre).
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
  constat ; Tao joue la tête penchée, sans lanterne. Branché au pas Utiliser le 25
  septembre (voir « Les jeux du pas Utiliser » ci-dessous).
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
- 4b.7, le message WeChat (24 septembre), **textes à relire** : 53 dialogues rédigés pour
  l'app, sans API, dans `data/sources/wechat/` (`ami.tsv`, `dialogues.tsv`, `echanges.tsv`),
  traçabilité « rédigé pour l'app ». Un ami toujours le même, 大明, sans photo ni emoji ;
  chaque dialogue a de deux à quatre échanges, rattaché à une famille par son caractère
  clé et à un jour de chaque parcours (celui où tous ses caractères sont posés : Lire dès
  le jour 21, HSK dès le jour 25, puis jusqu'aux jours 189 et 219). Chaque échange : un
  message de l'ami, une bonne réplique, deux ou trois mauvaises écrites à la main, chacune
  `hors-sujet` ou `contresens` (今天 pour 明天, 茶 pour 菜, 马 pour 妈). L'exemple du brief,
  你好吗？→ 我很好，你呢？, y est. Pinyin écrit dans la source, contrôlé contre Unihan et
  les surcharges, et découpé par caractère à l'export (`syllabes`). `wechat.json`, nommé
  par l'index et dans l'empreinte ; cinq contrôles bloquants (sources, pinyin, périmètre,
  parcours, export) ; `wenlu wechat apercu` pour relire. Dans l'app : case « Le message
  WeChat » de Jouer (`WeChat.svelte`, `wechat.ts`) ; un dialogue ne s'ouvre que lorsque
  tous ses caractères sont acquis, mauvaises répliques comprises, le plus récent du
  parcours d'abord. Conversation en bulles (l'ami à gauche, la réplique choisie à droite),
  toucher un caractère montre son pinyin, la traduction paraît une fois l'échange répondu ;
  Tao lit par-dessus l'épaule. Une mauvaise réplique est écartée sans aucun événement noté
  (décision pour les jeux de sens) ; une bonne du premier coup note ses caractères par
  `grade`, une fois par dialogue ; trouvée après une erreur, elle ne note rien
  (`NOTER_APRES_ERREUR`, à trancher par le propriétaire). Pas encore d'achat : les 53
  dialogues sont ouverts. Branché au pas Utiliser le 25 septembre (ci-dessous). Reste :
  relire les textes.
- Les jeux du pas Utiliser (25 septembre), 4b.4 et 4b.7 : le pas garde ses vues (mots et
  phrase, puis texte) et prend, certains jours, une vue de plus après le texte, « éclair »
  ou « message » (`UseView`). Règle déterministe (`utiliser.ts`, brief §9 « Les jeux du
  pas Utiliser ») : au plus un jeu par journée, choisi à l'entrée du pas et gardé (la
  session de plus n'en pose pas un second) ; le message WeChat du 8e jour, puis un jour sur
  trois, sur un dialogue que l'acquis réel ouvre, pas encore lu au pas, le plus récent du
  parcours d'abord ; sinon l'éclair les jours pairs, un mot, un tour ; jamais plus long que
  le budget (mots 30 s, texte 50 s, un mot 20 s, un échange 20 s dans les 1, 2 ou 4
  minutes du pas : rien à 5 minutes, un dialogue de deux échanges au plus à 10). La
  progression garde `useJeu` (journée, jeu, mot ou dialogue, échange en cours, répliques
  écartées, sens choisi) et `messagesLus`, export et import JSON compris : « Quitter »
  reprend au même écran, et une réponse ne se note jamais deux fois. Notation inchangée :
  bonne réponse par `grade`, erreur non notée ; l'éclair range le mot deviné dans le
  compteur, qui se lit sous la correction. Le fil et les répliques du message sont
  partagés avec l'écran du jeu (`FilWechat.svelte`, `RepliquesWechat.svelte`). Vérifié à
  393 × 660. Reste : le budget de 5 minutes ne pose jamais de jeu, les mots et le texte y
  prennent déjà la minute du pas.
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

- 4.5, le personnage (25 septembre), **textes à relire** : décision du propriétaire, maquette
  validée `wenlu-heros.html`, brief §8 « Le personnage ». Pipeline : `data/sources/heros/`
  (`rangs.tsv`, `betes.tsv`, `tao.tsv`), rédigé pour l'app, sans API ; `heros.json`, nommé
  par l'index et dans l'empreinte ; quatre contrôles bloquants (sources : douze rangs, seuils
  strictement croissants depuis 0, âges dans l'ordre, trois bêtes, trois idées de nom, huit
  phrases de Tao sans jeton inconnu, aucun dragon ; pinyin ; périmètre ; export). Les titres
  des rangs se dessinent depuis leurs traits : quatorze caractères de plus dans le périmètre
  (527, donc quatorze pages de plus sur le site), et la police reprend les noms des bêtes.
  Dans l'app : `heros.ts` (arts, rangs, taille, bulle de Tao, 放榜), `Heros.svelte` (le
  dessin porté de la maquette : trois bêtes, douze silhouettes et tenues, taille continue,
  aura), `ChoixHeros.svelte`, `Personnage.svelte`, `Fangbang.svelte`. Le choix est le dernier
  écran de la première session ; une progression d'avant lui le fait à la première ouverture
  de « Mon personnage ». L'accès : le portrait du personnage, première des trois icônes de
  l'en-tête du menu (aucune ligne de plus, le menu tient à 393 × 660, fêtes comprises) ;
  Réglages change la bête ou le nom sans rien perdre. Le 放榜 passe au retour au menu, jamais
  au milieu d'un pas, une fois par rang. Les points : un par bonne réponse notée
  (`noterRevision`), dans l'art de sa question (读 : sens, caractère, assemblage, trou, et
  tous les jeux, et « quel élément donne le son ? » ; 写 : tracé, et chaque tracé achevé au pas
  Apprendre ; 听 : oreille ; 说 : ton), jamais pour le temps ni la vitesse. Ils sont comptés
  dans la progression (`arts`), un compteur de plus : l'historique des cartes est borné à
  vingt lignes et ne dit pas le type de question, un calcul pur ferait rapetisser le
  personnage ; une progression d'avant lui recalcule les siens depuis cet historique et les
  tracés achevés. La progression garde aussi `heros: {bete, nom, rang}`, le rang étant le
  dernier annoncé, pour qu'un 放榜 ne se montre jamais deux fois. Restent : relire les
  textes, les écrire en anglais ; un jeu qui note plusieurs caractères pour une réponse (la coquille et son intrus, une
  réplique WeChat) donne un point par caractère noté, à trancher.

- 3.2, l'oreille par la voix de l'appareil et la question de ton (25 septembre) : décision du
  propriétaire, validée sur la maquette du mode héros (« 听 le reconnaître au son », « 说
  trouver son ton »). L'oreille se pose quand la fiche a un fichier ou que l'appareil a une
  voix mandarin (`voixPretes` attend l'annonce des voix, une seconde au plus, avant de tirer
  la série) ; « Écouter » dit le caractère à l'ouverture et se rejoue ; leurres par la forme
  ou le son, jamais un homophone ; pinyin des choix tu jusqu'à la correction. Le ton :
  caractère et syllabe sans ton, les quatre tons en ligne dans leur ordre, le neutre si la
  lecture l'a ; l'export écrit désormais `lectures` sur chaque fiche (principale en tête, puis
  surcharge, `kMandarin`, `kTGHZ2013`, `kXHC1983` d'Unihan, que `wenlu ingest` garde dans
  `lectures_dico`), et aucune lecture valide n'est un leurre (好 : hào jamais proposé) ;
  « Écouter » après la réponse. Notation par `grade`, points : ton en 说, oreille en 听,
  « quel élément donne le son ? » en 读. Un `data/work/` ingéré avant ce changement doit relancer `wenlu ingest` : sans les
  lectures des dictionnaires, l'export n'écrit aucune `lectures`, l'app ne pose pas le ton,
  et `wenlu check` le signale (« export : lectures »).

- 3.2, l'oreille par le manifeste audio (25 septembre) : un caractère qui a un fichier dans
  `data/0.1.0/audio/manifeste.json` (Kokoro, 731 textes du parcours Lire, seuil 255) se pose
  à l'oreille même sans voix mandarin sur l'appareil. Licence vérifiée avant de brancher :
  en-tête du manifeste `verifie: true`, usage commercial autorisé, aucune redevance ; ligne
  Kokoro tranchée dans `docs/sources-licences.md` (carte du modèle lue le 24 septembre) ;
  les fichiers sont déjà servis avec l'app et joués par « Écouter ». Échauffer attend le
  manifeste avant de tirer la série, comme la voix (`Corpus.manifeste`, `fichierAudio`).
  Hors ligne : le service worker précache le manifeste et les 731 mp3 à l'installation
  (`globPatterns` avec `mp3`, 7,2 Mio de précache au total), rien n'est mis en cache à la
  demande ; une app installée les joue sans réseau. Si le fichier ne se charge pas (service
  worker pas encore installé, cache purgé par le système, et pas de réseau), `play()` rejette
  et la voix de l'appareil prend le relais ; sans elle, la question passe sans être notée, le
  message le dit, et « Écouter » reste là pour réessayer (`audio.prononcer` : `fichier`,
  `telephone`, `bloque`, `muet` ; un refus du navigateur faute de geste, `bloque`, ne passe
  pas la question). Reste : vérifier sur iPhone que Safari lit un mp3 servi par le précache
  (Safari demande les médias par plages, `Range`, et le précache répond en entier) ; à
  défaut, la voix de l'appareil prend le relais, et `workbox-range-requests` serait la
  suite. L'en-tête du manifeste exporté dit encore la carte du modèle « non lue » : le texte
  de `data/src/zilin_data/audio.py` est à jour depuis, un réexport de l'audio le corrigera.

- 2c.3, Lire en étagères (26 septembre) : décision du propriétaire sur la maquette « Lire 读
  et Jouer 玩, autrement qu'en liste » (l'ancien écran, « menu en ligne, trop classique »).
  Deux parties sous un filet d'encre, « Aujourd'hui 今天 » et « Les contes 故事 » ; toutes les
  fiches au fond de la carte, filet fin ; la couleur dans les seules images (couvertures,
  motifs, planche, timbre), l'indigo pour l'action. Les étagères se rangent dans
  `etageres.ts` : « Bientôt » prend les contes écrits dont tous les caractères qui manquent
  sont sur le chemin, et dit dans combien de jours du chemin entre le dernier ; sans jour
  calculable, rien. Le motif est une colonne du catalogue (`motif`, treize noms,
  `contes.MOTIFS`), exportée (format 12) et contrôlée par `wenlu check` (« contes :
  motifs ») ; l'app dessine chaque nom (`Motif.svelte`) et ne connaît aucun conte. Reste :
  les lettres précédentes, en petites enveloppes numérotées, n'ont pas encore été vues par
  le propriétaire.

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
- **1.5, audio** : périmètre, manifeste et export en place. Plus de clé attendue pour
  le fournisseur par défaut : Kokoro tourne dans le pipeline (workflow `donnees`), 731
  fichiers sur les 731 textes du périmètre Lire (seuil 255), voix `zf_001`. Azure reste
  en second, derrière sa clé et sa licence (ci-dessous).

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
- Niveaux et contes longs (25 septembre), décision du propriétaire : le catalogue dit,
  pour chaque conte, ses niveaux prévus (`niveaux`, deux pour un récit simple, trois pour
  un récit riche, critère en tête du catalogue) et ses `chapitres`. Onze fables : 愚公移山
  255, 805, 1555 ; 拔苗助长 et 南辕北辙 255, 505 ; 塞翁失马 et 盲人摸象 405, 805, 1555 ;
  守株待兔, 画蛇添足, 狐假虎威, 叶公好龙, 亡羊补牢 405, 805 ; 井底之蛙 505, 1555. Deux récits
  longs de quatre chapitres, titres et résumé par chapitre dans `chapitres.tsv`, sans texte
  chinois : 木兰从军 (《乐府诗集·木兰诗》, 405, 805, 1555) et 美猴王 (《西游记》, chapitres 1 à
  7, sans le roi-dragon, 505, 805, 1555). Une version porte ses `chapitres` (titre chinois,
  pinyin, titres fr et en, phrases), une fable garde ses `phrases` : les trois contes relus
  se relisent et s'exportent octet pour octet. Validation (longueur par chapitre, chapitre
  titré, seuil et nombre de chapitres du catalogue : écarts), brouillons (`chapitres` à la
  place de `phrases`), contexte, export, aperçu et police suivent ; `index.json` porte le
  `catalogue` (titres, niveaux, chapitres, sans texte). `wenlu check` : « contes :
  catalogue » bloquant, « contes : niveaux prévus » jamais bloquant (aujourd'hui 3 écrits,
  28 attendent leur liste) ; `wenlu contes plan` dit l'état de chaque niveau. L'API ne
  génère que les fables du seuil ; un récit long se rédige par brouillon. Dans l'app : Lire
  montre chaque conte du catalogue et ses niveaux en sceaux (écrit et ouvert, écrit mais
  fermé, pas encore écrit) ; le lecteur lit un récit long chapitre par chapitre (sommaire,
  chapitre suivant, reprise notée dans `Progress.chapitres`, export et import compris) ; le
  conte n'entre dans `contesLus` qu'une fois tous ses chapitres lus.
- Niveaux HSK (25 septembre), décision du propriétaire : les seuils 405 à 1555 restant
  introuvables d'ici, les contes suivent le HSK 3.0 (GF 0025-2021). Listes versionnées
  comme `hsk-1.txt` : `data/sources/listes/hsk-2.txt` à `hsk-6.txt` (300 caractères
  chacun) et `hsk-7-9.txt` (1 200), les seuls caractères nouveaux du niveau, deux
  transcriptions concordantes caractère par caractère et dans le même ordre à tous les
  niveaux (elkmovie/hsk30, OCR Pleco du PDF officiel, et ivankra/hsk30, toutes deux
  sous MIT ; sha256 et reste à vérifier contre le PDF en tête de chaque fichier). La
  police reste bornée aux listes que l'export sert (seuil 255, HSK 1). Un niveau de conte
  est `255` ou `hsk1` … `hsk7-9`, lu en cumul (`hsk3` : 900 caractères), rangé par son
  nombre de caractères ; catalogue, validation, brouillons (`<id>/hsk3.json`), versions
  (`hsk3/<id>.json`), `wenlu contes contexte|plan|importer|relire --niveau hsk3`
  (`--seuil` en alias), export (`"seuils": [255, "hsk3"]`, format 9) et app suivent ; les
  trois contes relus gardent leur version 255 octet pour octet. Le catalogue gagne `cles`,
  les caractères clés de chaque conte, relevés un à un dans les listes : le plus bas niveau
  est le premier palier HSK qui les a, puis deux paliers en deux (critère en tête du
  catalogue, `contes.niveaux_attendus`), contrôle non bloquant « contes : critère des
  niveaux ». Plan : 愚公移山 255, HSK 3, HSK 5 (山 老) ; 拔苗助长 255, HSK 3 (菜 长) ;
  南辕北辙 255, HSK 3 (南 北 车) ; 叶公好龙 HSK 3, HSK 5 (龙) ; 亡羊补牢 HSK 4, HSK 6
  (羊 圈 补) ; 塞翁失马 HSK 4, HSK 6, HSK 7-9 (马 腿 断 兵) ; 盲人摸象 HSK 4, HSK 6,
  HSK 7-9 (象 摸) ; 木兰从军 HSK 4, HSK 6, HSK 7-9 (马 女 兵) ; 守株待兔 HSK 5, HSK 7-9
  (兔) ; 画蛇添足 HSK 5, HSK 7-9 (蛇 画 足) ; 狐假虎威 HSK 5, HSK 7-9 (虎 ; 狐 n'est
  dans aucune liste) ; 美猴王 HSK 5, HSK 6, HSK 7-9 (猴 石 变) ; 井底之蛙 HSK 7-9 seul
  (蛙 龟 井). Dans Lire, les sceaux disent « 255 » ou « HSK 3 » ; une progression qui
  notait les seuils en nombre se relit.
- Mots expliqués (25 septembre), décision du propriétaire : « Quand c'est un personnage
  clé comme loup, tu peux expliquer le mot aussi. » Une version peut nommer hors de son
  niveau un personnage ou un objet clé du récit, déclaré au catalogue dans `cles`, après
  une barre oblique (`羊圈补/狼`, `龙/叶`, `菜长/苗`, `虎/狐狸`, hors du critère des
  niveaux), et l'explique dans `expliques` (hanzi, pinyin, sens fr et en, explication fr
  et en) ; trois caractères hors du niveau au plus pour une fable, trois nouveaux au plus
  par chapitre d'un récit long. Un caractère non déclaré ou de trop : rejet ; tout autre
  caractère hors du niveau reste rejeté. Brouillons (champ facultatif), validation,
  contexte, export (`expliques` avec `caracteres`, `racines` du conte, format 10 ; leurs
  caractères entrent dans le périmètre, traits et police) et `wenlu check` (« contes :
  mots expliqués ») suivent ; les versions sans `expliques` se relisent octet pour octet.
  Dans l'app, le lecteur montre la carte « Mots du conte » en tête du chapitre où chaque
  mot paraît (dessiné depuis ses traits, pinyin, sens, explication) ; dans le texte, un
  trait discret, et la glose dit « mot du conte » ; un mot expliqué ne ferme pas un conte.
  Premier lot repris, à relire : 亡羊补牢 HSK 4 et HSK 6 (狼 ; 洞 et 丢 restent contournés
  à HSK 4), 拔苗助长 HSK 3 (苗 ; 拔, un geste, reste 往上拉), 叶公好龙 HSK 3 (叶公).
- Reprise faite (26 septembre) : les fables et les récits longs nomment leurs personnages et
  objets clés en mots expliqués (狐狸, 塞翁, 盲人 et 鼻子, 树桩 ; 木兰 et 织布机 ; 孙悟空, 齐天大圣,
  玉皇大帝, 蟠桃, 筋斗云, 须菩提, 神仙, 弼马温, 猢狲) ; convention du pinyin de 上 et des
  compléments écrite dans la consigne et `data/schema.md`. Les 30 versions prévues sont
  écrites : 3 relues (255), 27 à relire.
- Fables plus bas (26 septembre), décisions du propriétaire : l'animal par son vrai
  caractère dès les petits niveaux, défini dans le vocabulaire du conte. Un niveau de plus,
  sous le plan de base, quand l'animal est expliqué (au plus trois caractères hors du
  niveau) ; l'animal passe après la barre de `cles`, et « contes : critère des niveaux » y
  lit des mots expliqués, pas des caractères clés. Écrits, à relire : 守株待兔 HSK 3 (兔,
  树桩), 画蛇添足 HSK 3 (蛇), 狐假虎威 HSK 3 (虎, 狐狸), 亡羊补牢 HSK 3 (羊圈, 狼), 井底之蛙
  HSK 4 (井, 青蛙, 海龟). Plan : 守株待兔, 画蛇添足, 狐假虎威 HSK 3, 5, 7-9 ; 亡羊补牢 HSK 3,
  4, 6 ; 井底之蛙 HSK 4, 7-9. La carte des mots expliqués s'appelle « Vocabulaire du
  conte ». 一 entre un verbe et sa répétition se lit au ton neutre, comme le note le
  现代汉语词典 (看一看 kàn yi kàn) : consigne, schéma, écart signalé, et quatre versions
  reprises (美猴王 HSK 5, 木兰从军 HSK 4, 亡羊补牢 HSK 4 et HSK 6) ; les trois versions
  relues n'en ont pas.
- Mots de position (26 septembre), décision du propriétaire (« Je te laisse décider » ;
  retenue : la lecture du 现代汉语词典, celle de l'oral courant) : ton neutre sur la
  seconde syllabe pour 后面 hòu mian, 前面, 里面, 外面, 上面, 下面, 后边, 前边, 里边,
  外边, 上边, 下边, 这里 zhè li, 那里, 哪里, et les mots d'orientation 东边 dōng bian, 南边,
  西边, 北边, 左边, 右边 ; ton plein pour 旁边 páng biān, 那边 nà biān,
  这边 zhè biān. Liste `pinyin.MOTS_DE_POSITION` : consigne des contes et des lettres,
  schéma, écart à la validation, contrôle bloquant « contes : mots de position », et les
  contrôles de pinyin de WeChat et de l'éclair ; les mots de fiche la suivent plutôt que
  CC-CEDICT. Sources harmonisées (contes, fiches, WeChat, éclair) ; 下面 de la cuisine
  (« mettre les nouilles ») n'est pas un mot de position. Export 0.1.0 refait (南辕北辙
  relu au seuil 255 : 哪里 nǎ li, 北边 běi bian). 外头 wàitou reste tel.
- Reste : relire les 32 versions HSK ; vérifier les listes HSK contre le PDF officiel
  (lecture OCR, ordre, caractères à écrire). 美猴王 garde 猴 au niveau 5 : c'est un récit
  long, hors de cette décision.

### En attente d'une décision

- **Licence de l'audio** : le critère est le droit de redistribuer les fichiers
  générés dans une app payante, sans redevance par écoute. Kokoro, fournisseur par
  défaut, est tranché (`docs/sources-licences.md`, Apache 2.0 lue, carte du modèle lue le
  24 septembre) : ses fichiers sont embarqués. Reste en attente Azure Speech, dont les
  conditions n'ont pas pu être lues (proxy) : tant que sa ligne n'est pas vérifiée sur une
  source primaire, aucun fichier synthétisé par lui n'entre dans un artefact distribué.
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
  consultées (§6). Les deux transcriptions HSK utilisées sont sous MIT (LICENSE de
  elkmovie/hsk30 et d'ivankra/hsk30, lus le 25 septembre) ; le référentiel lui-même,
  œuvre du ministère chinois de l'Éducation, reste à trancher (le README d'ivankra/hsk30
  le dit peut-être du domaine public, selon le droit chinois).

### Non commencées

2c.1, 2c.2, et toute la phase 6 — hors le workflow CI macOS et la
configuration Capacitor, déjà versionnés.
