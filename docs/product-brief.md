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
- Thèmes de fête : l'app se met en fête quelques jours par an, aux dates que le pipeline calcule sur le calendrier luni-solaire et les termes solaires (`data/sources/fetes/`). Huit fêtes, chacune avec sa palette, son décor, un emblème qui porte le caractère du jour, un vœu dans l'en-tête et un accessoire pour Tao :
  - le Nouvel An 春节, du réveillon au 14e jour : papier chaud, fleurs de prunier qui tombent, la danse du dragon au pied de l'écran, cases rouges, rosace de papier découpé, vœu 新年快乐 avec un 福 à l'envers et une lanterne, flocon pour Tao ;
  - la fête des Lanternes 元宵, le 15e jour : grande lanterne rouge, lanternes pendues avec leurs devinettes 灯谜, bol de 汤圆 pour Tao ;
  - 清明, au terme solaire de début avril, de la veille au lendemain, doux et jamais triste : papier de pluie fine, saule, cerf-volant, brin de saule pour Tao ;
  - la fête des bateaux-dragons 端午, le 5e jour du 5e mois : l'eau, deux bateaux-dragons qui font la course, l'armoise à la porte, 粽子 pour Tao ;
  - 七夕, le 7e soir du 7e mois, de nuit : la Voie lactée en aplat, Véga et Altaïr, le pont de pies où Que 雀 s'est posé, étoile pour Tao ;
  - la mi-automne 中秋, de trois jours avant au lendemain, toujours de nuit : bleu 黛, pleine lune, lapin de jade, osmanthe, lanternes célestes, gâteau de lune pour Tao ;
  - le double neuf 重阳 : chrysanthème qui tourne, montagne, vol d'oies, chrysanthème pour Tao ;
  - le solstice d'hiver 冬至 : neige légère, collines enneigées, bol de 饺子 et de 汤圆, 饺子 pour Tao.

  Les fenêtres ne se chevauchent jamais. L'anecdote de la fête se montre une fois par occurrence, le premier jour de la fenêtre où l'on ouvre l'app, qu'il tombe avant, pendant ou après le jour de la fête : qui manque le jour même trouve quand même son caractère bonus (年, 灯, 雨, 粽, 桥, 月, 菊, 冬), dessiné depuis ses traits dans l'emblème, avec son pinyin et son sens. Elle se relit toute cette journée-là, depuis Lire ou l'en-tête du menu ; les autres jours de la fenêtre ont l'anecdote ordinaire du jour, tandis que le décor, la palette, le vœu et les phrases de Tao restent toute la fenêtre. La progression garde, fête par fête, le jour où son anecdote a été montrée (export et import compris). Retour du propriétaire du 26 septembre 2026 : « Pourquoi l'anecdote n'a pas changé depuis 3 jours !!! » (la mi-automne montrait la même cinq jours de suite, le Nouvel An quinze). La couleur du papier de la fête passe sur `theme-color`, pour que la barre d'état suive. Le décor passe derrière tout, ne se touche pas, et disparaît si l'on réduit les animations. Le dragon n'apparaît qu'à ces deux fêtes, et dans leur seul décor, en aplats de papier découpé aux pigments de la fête : au Nouvel An, un dragon de danse cramoisi et abricot, tête, anneaux et queue portés sur des perches, ondule en suivant sa perle sous les cases ; à 端午, les bateaux ont une tête de dragon à la proue, sa queue à la poupe, des rameurs en traits d'encre et un batteur à l'avant. Ni dans l'emblème, ni dans le vœu, ni dans les textes, ni chez Tao. Le calendrier va jusqu'en 2035 : 2036 est une année du Dragon, dont l'animal ne se dessine jamais.
- Termes solaires : entre les fêtes, l'app suit les vingt-quatre termes solaires 二十四节气, un tous les quinze jours environ, de 立春 à 大寒, que le pipeline calcule à l'heure de Pékin (`data/sources/saisons/`). Chaque terme a son nom et sa traduction (白露, « la rosée blanche »), une ligne sur ce qui se passe dans la nature, une ou deux phrases de Tao et un caractère à lire, pris dans son nom ou lié à lui (露, 霜, 雪, 雷…), propre à chaque terme et dessiné depuis ses traits. Les termes se regroupent en huit ambiances de trois : les fleurs de pêcher (立春 à 惊蛰), la pluie fine (春分 à 谷雨), le duvet des saules (立夏 à 芒种), les lucioles (夏至 à 大暑), la rosée (立秋 à 白露), les feuilles (秋分 à 霜降), la neige (立冬 à 大雪), le prunier en fleur (冬至 à 大寒). Chacune teinte à peine le papier, qui reste le seul thème, et pose un petit décor animé, plus discret que celui des fêtes, coupé si l'on réduit les animations ; `theme-color` suit. L'en-tête du menu porte le terme en une ligne sous la marque (« 半 秋分 · l'équinoxe d'automne »), Tao commence par sa phrase de terme, et le jour où un terme commence, l'anecdote est la sienne : son caractère, son nom, ce qui se passe dans la nature. Les fêtes gardent la priorité : 中秋 recouvre 秋分, 清明 et 冬至, qui sont aussi des termes, gardent leur thème de fête ; ces jours-là, ni ambiance, ni ligne de terme, ni anecdote de terme. Pas de dragon aux termes : 惊蛰, c'est le tonnerre et le réveil des insectes.
- Pigments de fête : le rouge de fête #9E1F2A, cramoisi, distinct du cinabre, ne sert qu'au décor du Nouvel An et de la fête des Lanternes (rosace, lanternes, cases, 福) ; les six autres fêtes s'en passent, et le cinabre garde son rôle. L'abricot #E3A33B est un aplat, jamais un doré. Décision du propriétaire, inscrite dans CLAUDE.md.
- Typographie : Manrope (titres, voix du guide), Source Sans 3 (interface), Noto Serif SC (mots et phrases). Les grands caractères ne sont pas une police : ils sont dessinés trait par trait à partir des données de tracé, style 楷, et s'écrivent au pinceau à l'apparition.
- Mascotte : Tao 桃, un noyau de pêche qui fait la route. Elle ne devient pas un arbre (décision du propriétaire du 29 septembre 2026 : l'arbre et les fruits sur la tête, « plus le thème ») : elle garde sa pousse à deux feuilles et s'équipe pour le chemin (noyau, pousse, le baluchon à 100, le chapeau de paille 斗笠 à 300, la gourde 葫芦 à 1 000). Compagne de route, voir section 9. Ami : Que 雀, le moineau, qui remet les cadeaux de la série, et se pose sur le pont de pies à 七夕. Maître : Xing 杏, un noyau d'abricot à barbe blanche, chignon et lamelles de bambou 竹简, que Tao rencontre à la porte du premier examen (décision du propriétaire du 29 septembre 2026, voir section 9).
- L'image du chemin (décisions du propriétaire du 29 septembre 2026, maquette validée `maquettes/chemin.html`, variante A) : le nom dit l'image, 文路, le chemin de l'écrit. Chaque jour travaillé pose une pierre, à plat sur le chemin ; sept pierres font un pavillon 亭 ; chaque famille ouverte tient son auberge 客栈 au bord du chemin, son fanion 幌子 à sa brique ; sur la route devant, les rendez-vous sont des portes de ville 城门, des lanternes 灯笼 et des étals de livres. Retours du propriétaire : « Je n'aime pas le terme “Ma forêt”… un peu ringard » ; « Borne et stèle font un peu cimetière… pierre tombale ». Plus de graine, d'arbre, de forêt, de borne ni de stèle dans l'app ; « l'arbre des caractères » reste le terme d'usage de la décomposition. `wenlu check` et un test de l'app le vérifient.
- Principes : un écran, une action ; le rouge est un sceau, pas une alerte : une mauvaise réponse se montre à l'ocre, jamais au cinabre (décision du propriétaire du 28 septembre 2026) ; pas de doré, pas de dragon hors du Nouvel An et de 端午 (seule exception : le texte du conte 叶公好龙, sans dessin), pas d'emoji, pas d'illustration réaliste.

## 6. Structure de l'app

Une maison, une ligne, des détours. Le menu est la maison : tout en part, tout y revient. La session est la ligne : ses pas s'enchaînent sans repasser par le menu. Réviser, Jouer, Lire, Mon chemin, Chercher et Réglages sont les détours, et aucun ne dérègle la session. Il n'y a pas de barre d'onglets.

Ouverture : le logo s'écrit (1,6 s), puis l'anecdote du jour, qui compte comme le pas 1, Ouvrir, puis le menu. Au tout premier lancement, la première session passe avant tout : 人, 大, 天, puis lire 天天. Quatre minutes, un mot lu. Deux questions ensuite (objectif, rythme), puis le choix du personnage (§8, « Le personnage »). On arrive alors sur le menu, la journée faite : la première pierre est posée, la session complète commence le lendemain.

### Le menu

Il tient sur un écran de téléphone, sans défiler. Il se remplit au fil de l'aventure (« Les portes qui s'ouvrent », ci-dessous) : le premier jour, la carte du jour, les six pas et le bouton, avec Chercher et Réglages.

- En-tête : la marque, puis le portrait du personnage (dès sa porte, jour 5 du chemin), Chercher (une loupe) et Réglages, par trois icônes. Le portrait est la tête du personnage à son rang, dans la case d'une icône ; il ouvre « Mon personnage ». Pendant une fête, le vœu prend la place de la marque ; les icônes restent.
- La carte du jour : le caractère dans son 米字格, dessiné depuis les traits, la brique nouvelle en cinabre ; son pinyin, qui se fait entendre ; son sens et sa décomposition (亻 + 主). Toucher le caractère le réécrit au pinceau et le prononce.
- Les six pas : six coups de pinceau, un par pas (faits en jade, en cours à l'encre, à venir en filet). Tao marche sur le pas en cours et dit une phrase qui dépend de l'état de la journée ; la toucher la fait sauter et changer de phrase. Dessous, « Pas 2 sur 6 · Échauffer » et la durée.
- La journée faite, une ligne discrète sous les six pas : « Demain : 子 enfant », la brique de la prochaine session dessinée depuis ses traits et son premier sens, et à droite, une fois sa porte ouverte (jour 9 du chemin), « Devant › », qui ouvre Mon chemin sur la route devant 前路, l'étape de demain choisie (§8), et y ramène. Au rythme gratuit (§10), quand la brique suivante n'est pas pour le lendemain : « Dans 3 j : 子 enfant », en jours du calendrier, ceux que fixe la règle, jamais estimés. Ni avant la session, ni pendant, ni en session de plus, ni en rattrapage ; rien au bout du parcours. Retour du propriétaire du 26 septembre 2026 : « il manque une visibilité sur ce qui va être appris au fur et à mesure ». La ligne ne prend que la hauteur de son texte : le menu tient toujours à 393 × 660, fêtes comprises.
- Un seul bouton plein : « Commencer la session », « Reprendre au pas 3 ». La journée faite, il devient « Une session de plus · une brique », en contour, avec Wenlu complet et pendant les trente premiers jours du chemin ; au rythme gratuit, « Réviser encore », en contour : une révision de plus, sans brique. Un examen à passer (§8, « Les examens 科举 »), la journée faite, il devient « Passer l'examen 县试 », ou « Passer le 月课 », plein.
- Quatre cases identiques, chacune à sa porte : Réviser 温, Jouer 玩, Lire 读, Mon chemin 路, toujours dans cet ordre, sur deux colonnes ; un nombre impair de cases pose la dernière en largeur, couchée, pour qu'aucun trou ne reste. Avant la session, Réviser dit « Dans la session » et ouvre le pas Échauffer, pour que la pile ne se vide jamais en douce ; après, elle ouvre une révision en plus. Jouer est la seule porte des jeux (§9, « L'écran Jouer »). Lire ouvre les contes, et en tête l'anecdote du jour, à relire ; avant les contes (jour 25), l'anecdote et les lettres de Que seules. Mon chemin garde la route devant, les familles, la série et les récompenses (§8), deux niveaux au plus.
- Chaque écran ouvert depuis le menu a un seul retour, qui y ramène.
- Quand un titre du personnage est accordé (§8), l'écran 放榜 passe au retour au menu, avant lui, jamais au milieu d'un pas.
- Quand une porte s'ouvre, Tao l'annonce au retour au menu, après le 放榜 s'il y en a un (« Les portes qui s'ouvrent », ci-dessous).

États du menu : nouvelle journée ; session entamée (reprise au pas exact, sauvegarde à chaque tap) ; journée faite (« Pierre posée, une seule par jour ») ; session de plus en cours ; journée sans brique nouvelle au rythme gratuit (la carte du jour montre la brique revue, sans cinabre : rien n'est ajouté) ; examen à passer, puis, s'il n'est pas réussi, pause jusqu'à réussite (§8, « Les examens 科举 ») ; retour après absence (mode rattrapage : révisions seules par blocs de cinq minutes, annoncés un à la fois, « Bloc 1 · 14 cartes », Tao au pavillon 亭, un bol de thé à côté, aucun nouveau caractère tant que la pile n'est pas redescendue, message neutre, jamais de compteur de jours perdus).

### Les portes qui s'ouvrent, l'aventure

Décision du propriétaire du 29 septembre 2026 : « Je veux aussi qu'au début, on ne voie pas tout ce qui est accessible, mais que ça se débloque au fur et à mesure de l'aventure. »

- Toujours là : la session (la carte du jour, les six pas, le bouton), Chercher (le dictionnaire, ci-dessous) et Réglages. La révision de l'acquis passe par la session dès le premier jour, et le rattrapage par le bouton : rien ne bloque la pédagogie.
- Tout le reste est une porte, qui s'ouvre à un moment de l'aventure, compté en jours du chemin (la dernière leçon du parcours apprise ; la première session pose les jours 1 à 3) ou en caractères lus (le compte de Mon chemin), jamais en jours du calendrier. Une porte se montre quand elle sert, jamais avant.
- Une porte ouverte le reste, même si le compte des lus redescend.
- Wenlu complet ouvre le rythme, pas les portes : l'achat ne raccourcit pas l'aventure, qui se mesure en leçons et en caractères lus ; avec lui, on marche seulement plus vite sur le même chemin. La fermeture est celle de l'aventure, jamais de l'argent : aucune annonce ne parle d'achat.
- Le moment : au retour au menu, jamais au milieu d'un pas, après le 放榜 s'il y en a un ; une porte par retour, les suivantes aux retours suivants, dans l'ordre du calendrier. La case (ou le portrait, ou « Devant › ») se pose d'une courte animation, coupée si l'on réduit les animations, cerclée d'indigo le temps de ce retour ; Tao le dit dans sa bulle, à l'indigo, « Une nouvelle porte : Jouer 玩. › », et la toucher mène à la porte. Une porte dans un écran (les contes, un jeu, les trophées…) s'annonce de même, et la bulle mène à son écran. Ni fenêtre modale, ni cinabre, ni ombre, ni doré, ni emoji.
- Une porte silencieuse vient avec celle qui la contient (les deux premiers jeux avec Jouer, le réglage des révisions avec leur tableau).
- Une progression d'avant l'aventure, ou importée sans son suivi, ouvre en silence tout ce qu'elle a atteint : pas de rafale d'annonces ; seules les suivantes s'annoncent, au moment où elles arrivent. La progression garde les portes ouvertes, leur journée et celles qui ont été annoncées, export et import compris.
- Le calendrier et les phrases de Tao viennent du pipeline (`data/sources/ouvertures/portes.tsv`, `ouvertures.json`), contrôlés par `wenlu check` ; tout se décide dans `app/src/lib/ouvertures.ts`.

| Porte | Ce qui s'ouvre | S'ouvre à | Pourquoi |
|---|---|---|---|
| Réviser 温 | la case | jour 4 | la première révision passée, une révision de plus a un sens |
| Mon personnage | le portrait de l'en-tête, et son réglage | jour 5 | ses premiers points |
| Mon chemin 路 | la case | jour 6 | les premières pierres, les premiers lus |
| Lire 读 | la case : l'anecdote du jour et les lettres de Que | jour 7 | la première lettre de Que suit l'acquis du jour 7 |
| Jouer 玩 | la case, avec assembler 拼 et la chaîne 链 | 6 lus | les premiers jeux ont de quoi jouer sans démonstration |
| La route devant 前路 | « Devant › » et le haut de Mon chemin, jusque-là dans la brume | jour 9 | quelques jours de chemin derrière soi |
| La devinette 谜 | la lanterne de Jouer, et la case qui l'annonce | 10 lus | des briques et leurs caractères à deviner |
| Tes trophées | l'entrée de Mon chemin | 10 lus | le premier sceau |
| Les jumeaux 双 | dans Jouer | 15 lus | des caractères proches à opposer |
| Le dictionnaire éclair 典 | dans Jouer | 20 lus | des mots de deux caractères lus |
| Les contes 故事 | les étagères de Lire | jour 25 | 学弈, la première fable du chemin |
| Le message WeChat 信 | dans Jouer | 40 lus | les premiers dialogues lisibles |
| Tes révisions | le tableau de Mon chemin, et le réglage des révisions | jour 40 | un mois de révisions, une rétention qui se mesure |
| La coquille 错 | dans Jouer | 90 lus | 天 et 夫 lus |
| Lire le monde | l'onglet « Un texte » de Chercher | 100 lus | un texte du dehors se lit en partie |
| La cuisine de Tao 菜 | dans Jouer | 150 lus | le premier plat lisible |
| La rencontre du maître Xing 杏 | Xing, à la porte du 县试 : il tient dès lors les examens, l'étymologie, l'anecdote, les contes et Chercher (§9) | 50 lus, le palier du 县试 | l'examinateur est là quand l'examen s'ouvre |

Les examens ne sont pas une porte : chacun s'ouvre de lui-même à son palier de caractères lus (le 县试 à 50), et Clore le dit (§8). La rencontre de Xing en est une (décision du propriétaire du 29 septembre 2026) : au palier du premier examen, en tête du calendrier, pour s'annoncer avant toute autre porte du même retour ; « À la porte du 县试, un maître t'attend : Xing 杏. › » mène à sa rencontre (§9). `wenlu check` vérifie son palier et sa place. La ligne de fête ou de terme de l'en-tête, décor du jour, reste là. Au rythme complet, un jour du chemin par journée après la première : Réviser le 2e jour, le personnage le 3e, Mon chemin le 4e, Lire le 5e, Jouer vers le 6e, la route le 7e, les contes le 23e.

### Chercher, le dictionnaire 字典

Décisions du propriétaire du 29 septembre 2026, maquette `maquettes/dictionnaire.html` : la loupe Chercher devient un dictionnaire. Le titre reste Chercher, derrière la même loupe de l'en-tête, toujours là dès le premier jour ; son premier onglet devient « Dictionnaire », « Lire le monde » reste à côté, à sa porte (100 lus).

- Le périmètre : le HSK 3.0 de 2021 (GF 0025-2021), soit 3 000 caractères et 11 092 mots, en consultation libre, sur le web comme dans l'app. Les niveaux affichés sont ceux de cette liste (HSK 1 à 6, puis 7-9).
- Chercher : par le caractère (tapé, collé, ou tracé au doigt), par le pinyin avec ou sans tons (`hao`, `hǎo`, `hao3`, `ni3hao3`, `ni hao`, la dernière syllabe en début : `zhongg`), ou en français, sur les seules gloses relues. Classement : ce qui s'écrit comme la saisie, les mots qui commencent par elle, ceux qui la contiennent, le pinyin exact, le début du pinyin, le français ; à rang égal, le caractère avant le mot, le niveau HSK croissant, le mot le plus court. Les caractères puis les mots, dans la même liste ; chaque ligne garde le statut de Mon chemin : lu en jade, « dans N j » en indigo (en jours du chemin), hors du chemin en gris. Les recherches récentes restent sur l'appareil, effaçables.
- La fiche d'un caractère : le grand caractère dessiné depuis ses traits, qui rejoue l'ordre des traits ; le pinyin, dit par la voix de l'appareil, sans fichier audio de plus ; le sens relu ; la décomposition GF 0014-2009, quand elle est réconciliée, chaque brique touchable, son rôle à l'ocre ou à l'indigo, sans cinabre (rien n'est ajouté ici) ; l'origine relue, étiquetée attesté ou mnémotechnique, ou « origine à venir » là où elle n'est pas relue (jamais inventée) ; les mots qui le contiennent ; des phrases d'exemple ; sa place sur le chemin. Un caractère hors du chemin se lit en entier, rien n'est verrouillé : le 米字格 en pointillés et « Pas encore appris » le disent, avec ce qui manque dit par les briques.
- La fiche d'un mot : ses caractères écrits au pinceau à l'ouverture, chacun touchable avec son propre statut ; son pinyin, sa catégorie, son sens relu, ses phrases.
- Les textes : les sens français sont rédigés par le pipeline, par lots, et tous relus avant de s'afficher ; seuls les sens relus s'affichent et se cherchent. Les phrases d'exemple sont écrites par le pipeline avec les seuls caractères du HSK, tracées et relues ; pas de Tatoeba. Rien ne vient de CC-CEDICT.
- Rien ne s'ajoute aux révisions depuis le dictionnaire : le chemin décide. Pas de bouton « ajouter aux révisions ».
- L'écriture au doigt : dans Wenlu complet, sous ses deux formes, l'abonnement et l'achat à vie (§10) ; la reconnaissance tourne sur l'appareil, sans réseau. Sans achat, la même place le dit en une ligne, avec un lien : ni cadenas, ni fenêtre, rien de grisé ailleurs, la recherche reste entière.
- Tao lit par-dessus l'épaule avant la rencontre de Xing au 县试 ; Xing, le livre ouvert, accompagne le dictionnaire après et en explique les fiches (§9).
- Hors ligne : l'index du dictionnaire est gardé avec l'app ; une fiche ouverte une fois se relit sans réseau (`data/schema.md`, « Le dictionnaire »).
- Livré le 29 septembre 2026 (docs/backlog.md, épic 10) : la liste des mots, le format d'export (l'index, les lots d'entrées, les emplacements des sens et des exemples), les traits des 3 000 caractères, la recherche (`app/src/lib/dictionnaire.ts`) et le cache hors ligne. Reste : les sens, les phrases, l'écran, l'écriture au doigt.

### La session, six pas dans le même ordre

1. Ouvrir : l'anecdote du jour, culturelle, accrochée à un caractère (20 s, sautable), que raconte Xing une fois rencontré (§9), Tao l'écoutant assise. Elle se lit à l'ouverture. Elle se relit ensuite autant qu'on veut, depuis Lire ou en touchant la ligne de fête ou de terme de l'en-tête du menu, et ramène là d'où l'on vient ; la relire ne compte rien de plus. Une anecdote est un fait court, culturel ou historique, accroché à un seul caractère, de trois à cinq phrases, sans emoji ni dragon, rédigée dans le pipeline (`data/sources/anecdotes/`) ; si elle parle de l'origine d'un caractère ou d'un mot, elle porte l'étiquette attesté ou mnémotechnique. Celle du jour parle de préférence d'un caractère rencontré ces derniers jours (la brique du jour d'abord), sinon la liste tourne ; aucune ne revient avant trente jours, et c'est la même toute la journée (retour du propriétaire du 26 septembre 2026 : douze anecdotes en boucle).
2. Échauffer : les révisions dues, en questions (2 à 4 min).
3. Apprendre : une brique, puis un ou deux composés. Une seule brique nouvelle par session de 10 minutes.
4. Utiliser : deux mots, une phrase, trois lignes à lire avec uniquement l'acquis. Le caractère du jour en rouge. Les deux mots et la phrase viennent de la fiche du jour ; les trois lignes sont propres à chaque jour du chemin, sur chaque parcours, écrites dans le pipeline (`data/sources/trois-lignes/`) avec les seuls caractères posés ce jour-là, et emploient au moins un de ses caractères nouveaux, seuls en cinabre. La traduction reste cachée jusqu'au toucher, ligne par ligne ou en entier ; toucher un caractère donne sa glose et le dit. Un jour sans texte écrit, ou sans brique nouvelle, relit un texte d'un jour passé, tout à l'encre (retour de l'audit du 28 septembre 2026 : le même texte tous les jours, 住 en cinabre quelle que soit la brique). Certains jours, un jeu suit le texte : le dictionnaire éclair ou le message WeChat, jamais les deux (§9, « Les jeux du pas Utiliser »).
5. Fixer : une vérification sur ce qui vient d'être vu.
6. Clore : le constat en une ligne, la pierre du jour posée à plat sur le chemin, cerclée de cinabre (« 儿 rejoint ton chemin. », animation), la semaine et la série, le rendez-vous de demain. C'est la seule fin : on revient ensuite au menu.

Les pas s'enchaînent sans repasser par le menu. Chaque pas porte en tête la même barre de six coups de pinceau, et « Quitter », qui sauvegarde et ramène au menu ; le menu propose alors de reprendre au pas exact.

Budget choisi par l'utilisateur : 5, 10 ou 20 minutes.

Journée sans brique nouvelle : au rythme gratuit, entre deux briques (§10), et tant qu'un examen attend d'être réussi (§8), la session garde ses six pas, dans le même ordre, sur l'acquis. Apprendre revient sur une brique déjà acquise, la plus fragile, ou, après un examen manqué, sur un caractère manqué : sa fiche, un composé qu'elle a ouvert, le tracé s'il est activé. Utiliser lit un texte de l'acquis, Fixer vérifie, Clore pose la pierre comme un autre jour. Aucun caractère n'entre en révision qui n'y était déjà, et la carte du jour n'a pas de cinabre, puisque rien n'est ajouté.

### Travailler plus : la session de plus

La journée faite, « Une session de plus » ajoute une brique : quatre pas, Apprendre (la brique suivante du parcours), Utiliser, Fixer, Clore. Pas d'anecdote ; Échauffer passe devant seulement s'il reste des cartes dues. Jamais une seconde pierre : la série compte les jours, pas les sessions, et le menu garde le compte (« Pierre posée · 2 sessions de plus »). Avec Wenlu complet, pas de limite par jour ; sans achat, seulement pendant les trente premiers jours du chemin (§10), qu'une session de plus consomme comme une autre : chaque leçon est un jour du chemin. Jamais en rattrapage : aucune brique nouvelle n'entre tant que la pile n'est pas redescendue. Jamais non plus quand un examen attend d'être réussi (§8). Rien ne remet la journée à zéro avant le lendemain.

Fluidité : un tap par écran, bouton principal unique en bas, avance automatique après une bonne réponse (1,3 s, tap pour aller plus vite), audio au toucher du caractère, pas de menu ni de fenêtre modale en session, « Quitter » sauvegarde sans question. Explications en trois phrases ; la suite dans la fiche, d'un tap.

## 7. Pédagogie

- Curriculum : graphe de dépendances généré à partir des décompositions GF 0014-2009, ordonné par fréquence et par niveau. Deux parcours à l'objectif choisi : « Lire » suit les seuils français (255 d'abord), « Passer le HSK » suit le référentiel 2026. Même arbre.
- Révision par questions, huit types : sens d'un caractère, caractère à partir du sens, assemblage de briques, trou dans un mot, reconnaissance à l'oreille, ton, « quel élément donne le son ? », tracé au doigt. Leurres choisis par ressemblance de composants.
  - La voix de référence (décision du propriétaire du 29 septembre 2026, « Tu ne peux pas utiliser l'IA de l'iPhone pour générer ? ») : la voix chinoise de l'appareil, par défaut quand il a une voix du mandarin du continent (`zh-CN`). Sur l'iPhone, ce sont les voix d'Apple, « Premium » ou « Améliorée » quand l'apprenant les a téléchargées, compactes sinon : elles marquent les tons, là où les fichiers Kokoro ont des tons isolés peu marqués (étude du 29 septembre 2026), et marchent hors ligne. Dans l'app iOS elles passent par AVSpeechSynthesizer (greffon `@capacitor-community/text-to-speech`), qui les voit toutes ; sur le web, par `speechSynthesis`. L'app prend la voix du continent avant celle de Taïwan, la Premium avant l'Améliorée avant la compacte, jamais le cantonais de Hong Kong ni une voix qui passe par un service (les voix « en ligne » de Chrome ou d'Edge) ; un caractère isolé est dit un peu lentement sur le web (le greffon iOS garde le débit du système). Réglages, « Voix » : « Voix de l'appareil » ou « Voix enregistrée » (les fichiers), et, repliée, la marche à suivre pour télécharger une voix chinoise améliorée (Réglages de l'iPhone → Accessibilité → Contenu énoncé → Voix → Chinois). Chacune est le repli de l'autre ; sans voix chinoise ni fichier, la question à l'oreille ne se pose pas. Un seul son à la fois : chaque « Écouter » fait taire le précédent. Les Apple Foundation Models ne font pas de synthèse vocale (ce sont des modèles de texte) : ils n'y servent pas.
  - À l'oreille : un bouton « Écouter » dit le caractère par la voix de référence (sans réseau) ; il se rejoue autant qu'on veut. On choisit parmi quatre caractères acquis, les leurres ressemblant par la forme ou par le son (même syllabe, autre ton : 妈 pour 马), jamais un homophone (une lecture en commun). Sans fichier ni voix mandarin, la question ne se pose pas : jamais d'écran muet. Le pinyin des choix n'apparaît qu'à la correction.
  - Dis-le (story 9.1, livrée en partie le 29 septembre 2026) : au plus une question par séance d'Échauffer ou de révision en plus, à la place de la question d'une carte acquise de la pile dont la lecture principale est connue et porte l'un des quatre tons. On voit le caractère, dessiné depuis ses traits, et son sens ; ni pinyin accentué ni son avant la réponse. On appuie sur le micro, on dit le caractère, on relâche (un simple toucher écoute jusqu'au silence). L'app montre la courbe de la voix sur la forme canonique du ton attendu (jamais l'audio de l'app, aux tons isolés peu marqués), le ton reconnu, nommé par sa forme, et un conseil qui dit quoi faire, jamais un reproche. Notation automatique : le ton reconnu note la carte « Bien », jamais « Facile » tant que la reconnaissance n'est pas mesurée sur des apprenants, et donne un point 说 ; un autre ton, une confiance basse ou un silence ne notent rien et redemandent, trois fois au plus, puis on passe sans rien noter, la carte restant due. Après chaque prise, pendant les redemandes comme après la réponse, et dans l'essai de Réglages, « Réécouter » rejoue la voix de l'apprenant (retour du propriétaire du 29 septembre 2026) ; après la réponse, « Écouter » dit le caractère à côté, pour comparer. La prise reste en mémoire le temps de la question, une nouvelle la remplace, la question suivante l'oublie : jamais gardée ni envoyée. La prise demande le micro sans annulation d'écho, sans débruitage ni gain automatique, et, dès sa fin, coupe le micro, ferme sa capture et rend la session audio à la lecture (Safari 17 et plus) : sur l'iPhone, la voix qui suivait sortait étouffée, « comme s'il y avait un autre son derrière ». La fin de la syllabe, quand la voix s'éteint, est nettoyée avant de devenir une courbe : elle ne « monte plus d'un coup » (`data/sources/tons/PROVENANCE.md`). Jamais si le micro est refusé ou absent, si le modèle ne se charge pas ou si le réglage « Dire les tons » est éteint : la question ne se pose pas ; un refus à l'appui rend la question ordinaire de la carte et éteint le réglage. Tout se décide dans `app/src/lib/tons/dire.ts`.
  - Le ton : on voit le caractère, dessiné depuis ses traits, et son pinyin sans ton (« hao ») ; on choisit la syllabe parmi les quatre tons, dans leur ordre (hāo háo hǎo hào), et le ton neutre si la lecture l'a (吗 ma). La lecture vient de l'export (Unihan et surcharges), jamais de l'app. Pour un polyphone, seule la lecture principale est acceptée, et aucune autre lecture valide du caractère n'est proposée en leurre (好 : hào n'est pas proposé) ; faute de connaître toutes les lectures d'un caractère, la question ne se pose pas. Après la réponse, « Écouter » dit le caractère si une voix existe.
- Notation automatique, sans auto-évaluation : juste du premier coup en moins de six secondes, 12 jours ; juste mais lent, 4 jours ; juste après une erreur, 1 jour ; faux deux fois, la réponse est montrée, retour dans 10 minutes. Algorithme FSRS, rétention cible réglable.
- Correction toujours explicative, par les briques. Pas de félicitations, des constats.
- Tracé : proposé une fois par brique de base à la première rencontre, désactivable. Jamais demandé pour les composés. Par niveau, aligné sur « actifs / passifs » côté France et sur la liste d'écriture du HSK côté international.
- Paires à ne pas confondre injectées quand deux caractères proches sont acquis (己/已, 未/末, 天/夫, 日/曰, 人/入, 土/士).
- Le mot avant le caractère seul : chaque fiche porte deux mots et une phrase ; lecture de textes générés avec les seuls caractères acquis dès une vingtaine.
- Contes : des contes et histoires chinoises réécrits à chaque niveau avec les seuls caractères du niveau. Le même conte existe en plusieurs versions ; l'utilisateur relit la même histoire, plus riche, à mesure que son acquis grandit. Les versions sont générées par lots ou rédigées dans le pipeline puis relues, jamais dans l'app.
  - Niveaux : les contes suivent le HSK 3.0 (GF 0025-2021), la référence internationale, plutôt que les seuils 405 à 1555, introuvables (décision du propriétaire du 25 septembre 2026) : HSK 1 à 6 puis 7-9, chacun lu en cumul (HSK 3, les 900 caractères des niveaux 1 à 3). Les trois contes relus au seuil 255 gardent leur version 255, valide et publiée, et prennent leurs niveaux suivants en HSK ; le seuil 255 se place au palier de HSK 1 (tous ses caractères sont dans HSK 1 à 3). Chaque conte est prévu à deux ou trois niveaux selon la richesse du récit d'origine. Le plus bas est le premier niveau HSK dont le cumul a ses caractères clés, animaux et objets de l'intrigue (兔 : HSK 5 ; 龙 : HSK 3 ; 蛙 : HSK 7-9) ; le reste, noms propres compris, se dit autrement, ou, pour un personnage ou un objet clé, en mot expliqué (ci-dessous). Un récit simple, un épisode et une chute, en a deux : le plus bas, puis deux paliers plus haut (255 et HSK 3, HSK 4 et HSK 6). Un récit riche, plusieurs épisodes ou retournements, en a trois, de deux paliers en deux, où il se dit en entier (255, HSK 3, HSK 5 ; HSK 4, HSK 6, HSK 7-9). L'échelle s'arrête à HSK 7-9 : un récit qui commence haut y a moins de place. Un niveau de plus quand l'animal est expliqué (décision du propriétaire du 26 septembre 2026 : l'animal par son vrai caractère dès les petits niveaux) : une fable dont l'animal place haut ce plan prend, en dessous, un niveau où elle le nomme en mot expliqué, défini dans le vocabulaire du conte, trois caractères hors du niveau au plus en tout (守株待兔, 画蛇添足, 狐假虎威, 亡羊补牢 et 井底之蛙 à HSK 3). Le catalogue le dit conte par conte, caractères clés compris (`data/sources/contes/catalogue.tsv`), et `wenlu check` vérifie le critère sur les listes, sans jamais bloquer.
  - Fables du chemin (décision du propriétaire du 26 septembre 2026 : le premier conte ne s'ouvrait qu'au jour 166, trop tard pour une première lecture) : trois fables très courtes, de 30 à 60 caractères, chacune à un seul niveau, un jour du chemin Lire, « jour 25 » : l'acquis des jours 1 à 25 du parcours Lire (le `jour` des fiches), en cumul comme un niveau HSK, rangé sous le seuil 255. Le jour du niveau est celui où entre le dernier caractère du texte, mots expliqués mis à part : la fable s'ouvre ce jour-là. 学弈 (《孟子》) au jour 25, avant la fin des trente jours gratuits ; 纪昌学射 (《列子》) au jour 44 ; 疑邻盗斧 (《列子》) au jour 60. Le vrai titre reste ; l'animal, l'objet ou le personnage clé hors de l'acquis passe en mot expliqué, trois caractères au plus (弈秋, 天鹅 ; 弓, 箭, 虱子 ; 斧子, 邻人, 小偷). Sur le parcours HSK, qui range les caractères autrement, une fable du chemin s'ouvre comme toute version, quand ses caractères sont acquis ; son jour s'y calcule sur ce chemin-là, ou ne s'annonce pas (古, 念, 如 n'y sont pas). Son sceau dit « Jour 25 », sa version « du jour 25 du chemin ».
  - Mots expliqués (décision du propriétaire du 25 septembre 2026 : « Quand c'est un personnage clé comme loup, tu peux expliquer le mot aussi ») : une version peut nommer hors de son niveau un personnage ou un objet clé du récit, plutôt qu'un détour qui le trahit (狼 dans 亡羊补牢, 苗 dans 拔苗助长, 叶公 dans 叶公好龙). Chacun est déclaré au catalogue, et une version en a trois au plus (trois nouveaux au plus par chapitre d'un récit long) ; tout autre caractère hors du niveau reste refusé. Le lecteur les montre avant le texte, sur une carte « Vocabulaire du conte », le complément de vocabulaire du niveau, en tête du chapitre où ils paraissent : chacun dessiné depuis ses traits, son pinyin, son sens et une courte explication. Dans le texte, un trait fin et discret les souligne, sans cinabre, et leur glose au toucher dit « mot du conte ». Ils ne comptent pas dans « seulement ton acquis » : un mot expliqué n'empêche pas un conte de s'ouvrir.
  - Lire n'est pas une liste (décision du propriétaire du 26 septembre 2026 : l'ancien écran, « menu en ligne, trop classique ») : deux parties nettes, chacune sous un filet d'encre. « Aujourd'hui 今天 » : l'anecdote du jour en fiche, son caractère dessiné depuis ses traits, puis la lettre de Que en enveloppe où le moineau se pose, « NOUVELLE » à l'indigo la semaine où elle arrive, les précédentes en petites enveloppes numérotées. « Les contes 故事 », avec leur nombre : chaque conte du catalogue est un livre cousu 线装书, rangé sur l'une de trois étagères de bois, chacune avec son nom et son compte au-dessus : « À lire maintenant », ceux que l'acquis ouvre ; « Bientôt », les écrits dont tous les caractères qui manquent sont sur le chemin, avec « s'ouvre dans N j », en jours du chemin, le jour où entre le dernier (rien quand ce jour ne se calcule pas) ; « Plus loin », les autres, qui défilent de côté. La couverture prend un pigment de la peinture, porte des points de couture, le titre en colonne sur une étiquette, un petit motif (le catalogue le nomme, l'app le dessine : montagne, pousse, roues, puits, souche, serpent, tigre, cheval, éléphant, rouleau, enclos, lance, singe, plateau de go, arc, hache ; jamais de dragon, 叶公好龙 a le rouleau peint) et, pour un récit long, son nombre de chapitres ; un livre fermé est pâle, au pointillé. Sous le livre, ses niveaux en petits sceaux marqués « Jour 25 », « 255 » ou « HSK 3 » : plein, écrit et ouvert par l'acquis ; au trait, écrit mais pas encore ouvert ; en pointillés, pas encore écrit ; au jade, déjà lu. Puis le titre français. Les fonds restent neutres, ceux du papier et de la carte, tous pareils, sous un filet fin ; la couleur n'est que dans les images (couvertures, motifs, planche, timbre de l'enveloppe) ; l'indigo marque l'action ; ni cinabre, ni ombre, ni dégradé, ni doré. Rien n'est estimé : ce que l'export n'a pas n'est pas écrit. Les contes ouverts d'abord, puis les écrits fermés, puis ceux à venir ; sur « Bientôt », le plus proche d'abord, une fable du chemin avant les contes du seuil 255.
  - Contes longs : un récit long (deux prévus, 木兰从军 d'après 《木兰诗》 et 美猴王 d'après les sept premiers chapitres du 《西游记》, à HSK 4 ou HSK 5 et plus) se lit chapitre par chapitre, chaque chapitre titré, de la longueur d'une fable du même niveau. Le lecteur montre un chapitre à la fois, un sommaire replié, « Chapitre suivant », et reprend au chapitre où l'on s'était arrêté (noté dans la progression, export et import compris). Le conte n'est lu, et son trophée gagné, qu'une fois tous ses chapitres lus : un chapitre non lu ne compte pas. Une fable se lit d'une traite, comme avant.

## 8. Motivation

- Une pierre posée par jour travaillé, sept pierres font un pavillon 亭 : un jour de repos en réserve. Écran de série animé après chaque révision. Un jour de rattrapage est un jour travaillé : le premier bloc fait pose la pierre, une seule par jour.
- Jour de repos : un par semaine complète, deux en réserve au plus, protège la série.
- Paliers de la série, remis par Que 雀 (décisions du propriétaire du 26 septembre 2026, « Ok pour les 30 pourcents ») :
  - 7 jours : un jour de Wenlu complet, la journée suivante, celle du premier message WeChat (§9). Le rythme est encore complet : ce jour ouvre ce que le rythme ne donne pas (§10, « Payant »).
  - 30 jours : une semaine de Wenlu complet, sept jours du calendrier, pour essayer le rythme payant : une brique chaque jour et les sessions de plus. Elle commence le lendemain du palier ; si l'on est encore dans les trente premiers jours du chemin (une journée de rattrapage n'y avance pas), elle commence au premier jour du rythme gratuit, pour faire essayer ce qu'on n'a pas déjà.
  - À la fin de cette semaine, vers le 37e jour : un code à usage unique, moins 30 % sur l'achat à vie, montré une fois, sans compte à rebours. Il remplace la remise que portait le palier de 100 jours.
  - 100 jours : une deuxième semaine de Wenlu complet, comme à 30 jours ; pas de nouvelle remise.
  - 365 jours : Wenlu complet offert.

  Pas de remise sur l'abonnement mensuel. Qui a déjà Wenlu complet reçoit le sceau et le cadeau de Que, rien de plus. Sur le web, ni achat ni code : les paliers y donnent le sceau et le cadeau de Que.
- Mon chemin 路 (décisions du propriétaire du 29 septembre 2026, « C'était plutôt chemin A », « Tout est ok pour moi » ; maquette validée `maquettes/chemin.html`) : un seul dessin vertical, en papier découpé. En haut, la route devant 前路 (ci-dessous) ; au milieu, la pierre du jour, en cinabre, où se tient Tao, avec son sceau « jour 15 » ; en descendant, le chemin parcouru, un pavé par jour du chemin jusqu'au jour 1, « jour 1 · la première session ». Chaque famille dont un caractère, en plus de sa brique, est commencé tient son auberge 客栈 à la pierre qui l'a ouverte : un toit de malachite, une porte, le fanion 幌子 où sa brique est écrite, et son sentier, pavé de ses caractères, les lus au jade, ceux en cours à l'indigo, « +3 » pour ce qui y attend encore. Une famille lue en entier pose son sceau sur le fanion. Au-delà de cent jours, le chemin parcouru se replie par tranches de trente jours, qui se déplient au toucher. En tête, « 26 caractères lus · 10 familles ouvertes · jour 15 » et la carte de l'étape ; dessous, la légende (lu, en cours, à venir, la pierre du jour), la semaine en sept pierres et son pavillon, les trophées, les révisions, les deux nombres, les trouvés en chemin et la liste des familles. Toucher une auberge ouvre sa famille : son auberge en bas, son sentier qui monte, une bifurcation par génération (« par 是 »), dix caractères puis « +N », la fiche courte (« Lu · posé au jour 5 »). Le cercle des familles et son zoom n'existent plus. Les identifiants de la progression (`foret`, `joursTravailles`) gardent leur nom : aucune migration, export et import compris. Le dimanche, récapitulatif de la semaine partageable en image.
- La route devant 前路 : ce qui va être appris, au fur et à mesure. Retour du propriétaire du 26 septembre 2026 : « il manque une visibilité sur ce qui va être appris au fur et à mesure » ; la carte entière du parcours est écartée (« pas besoin de tout voir, juste le détail de l'étape et une vue partielle proche des prochaines étapes »), et l'écran doit être « plus joli ». Depuis le 29 septembre 2026, elle n'est plus un écran à part : elle est le haut de Mon chemin. On y arrive par la case Mon chemin, ou par « Devant › » sous les six pas du menu, la journée faite, une fois sa porte ouverte (jour 9 du chemin, §6) : Mon chemin s'ouvre sur la route devant, l'étape de demain choisie. Avant cette porte, le haut du chemin est dans la brume, sans carte de l'étape.
  - En tête de Mon chemin : « ‹ Retour », « Mon chemin 路 », puis « 26 caractères lus · 10 familles ouvertes · jour 15 », et la carte de l'étape choisie.
  - La scène, en papier découpé : trois collines en aplats, quelques pins de jade, un soleil pâle, et la route qui monte en lacets vers la montagne. Sur la route, chaque pierre est un pavé posé à plat, vu en légère plongée, qui porte sa brique, dessinée depuis ses traits : celle du jour, cerclée de cinabre, la position, où se tient Tao, dans sa posture du chemin, avec un sceau « jour 12 » ; six devant, au trait ; derrière, le chemin parcouru de Mon chemin. Au premier jour, rien derrière ; près du bout, moins de pierres devant, et la route s'arrête à la dernière (« fin du parcours »). Toucher une pierre la choisit.
  - Au bout, dans la brume (des bandes de papier), les deux prochains rendez-vous, et rien au-delà, chacun au pointillé d'indigo avec « dans 13 j » : un seuil du trophée Lire (10, 50, 100, 255…), au jour du chemin où entre le Ne caractère, sur une lanterne 灯笼 à son nombre ; un examen (« Les examens 科举 » ci-dessous), à son palier compté de la même façon, sur une porte de ville 城门, son nom dessiné depuis ses traits sur le linteau ; ou un conte qui s'ouvre, au jour où entre le dernier caractère qui lui manque (le calcul de l'étagère « Bientôt » de Lire), sur un étal de livres, son motif sur la couverture. Un trophée obtenu, un seuil dont les caractères sont déjà rencontrés sans être lus, un conte dont le jour ne se calcule pas ne s'annoncent pas. L'examen suivant, à titre ou 月课, est toujours l'un des deux : il met les briques en pause, on le voit venir. Si deux autres rendez-vous tombent avant lui, il prend la place du second. Avec un examen tous les cinquante caractères au plus, il est rarement loin. Une pierre qui porte l'un des deux rendez-vous a son petit fanion d'indigo.
  - La carte de l'étape choisie, demain par défaut : la brique dans son 米字格, dessinée depuis ses traits, son pinyin et son sens (la fiche), les caractères qu'elle ouvre avec leur sens, le rendez-vous de ce jour-là s'il y en a un (« Rendez-vous ce jour-là : … ») ; demain, « Prochain rendez-vous : 县试 · 50 caractères, dans 10 jours ».
  - Les jours sont ceux du chemin : les leçons du parcours que la session pose une à une, celles de la carte du jour, jamais des dates. Une journée sautée ne compte pas, un jour que la session saute (non réconcilié) non plus, et rien ne s'estime. Avant la session, la pierre du jour est la leçon à poser ; la journée faite, celle apprise. En rattrapage, où aucune brique n'entre, la suite se dit en étapes (« l'étape suivante »), jamais « demain ».
  - Un seuil du trophée Lire et un examen au même palier (50, 100, 255, 505, 1 555) partagent la porte, la lanterne pendue à son angle, « 县试 · 50 caractères », « 月课 · 1 555 caractères ». Un examen à passer ne se compte plus : la porte du 贡院 s'ouvre sur la route, juste devant la pierre du jour, au trait plein, « examen ouvert », et la toucher mène à l'examen ; les pierres suivantes restent au trait, sans compte, jusqu'à ce qu'il soit réussi.
  - Au rythme gratuit (§10), un jour du chemin n'est plus un jour : les rendez-vous disent « dans N étapes », comme en rattrapage, et l'étagère « Bientôt » de Lire aussi. Seule la pierre suivante porte un compte en jours du calendrier, « prochaine brique dans N j », celui que la règle fixe, jamais estimé ; la carte de l'étape dit « Prochaine brique dans 3 jours ». Au bout du chemin gratuit, la dernière pierre dit « fin du chemin gratuit », et la suite en une ligne (le HSK 2, le seuil 405), sans insistance.
  - Charte : des aplats, ni ombre, ni dégradé, ni doré, ni emoji, ni dragon ; le cinabre ne marque que la position (la pierre du jour, son sceau, son « aujourd'hui »), le jade l'acquis, l'indigo les rendez-vous et le choix. Les couleurs suivent le thème du jour, fêtes et nuits comprises. Rien ne bouge si l'on réduit les animations. Tout se décide dans `app/src/lib/route.ts`, et la scène de Mon chemin dans `app/src/lib/chemin.ts`.
- Notification : une par jour, à l'heure choisie, avec le début de l'anecdote.

### Le tableau des trophées

On y entre depuis Mon chemin (« Tes trophées », N sur M et le prochain), dès sa porte, à 10 caractères lus (§6). Règle : chaque trophée se gagne en lisant, jamais au temps passé. Aucune règle ne lit une durée, un budget ou un temps de réponse. Pas de points, pas de classement, pas de doré. Tout se calcule depuis la progression et le contenu exporté (`app/src/lib/trophees.ts`). Les examens n'y ont pas de sceau (« Les examens 科举 » ci-dessous).

| Famille | Ce qui le donne | Sceau |
|---|---|---|
| Lire | 10, 50, 100, 255 (premier seuil), 505, 1555 caractères lus, au seuil de stabilité de Mon chemin | le nombre |
| Sceaux de famille | une famille d'au moins deux caractères lue en entier ; on montre les familles commencées et quelques suivantes du parcours | la racine |
| Pièges déjoués | une paire de `paires.json` lue dix fois de suite sans confusion, une fois les deux caractères acquis | la paire |
| Contes | chaque conte lu, relu à chaque niveau | le niveau (« 255 », « HSK 3 ») |
| Objets de Tao | pinceau (dix briques tracées en entier, le dernier trait posé : un tracé seulement proposé ne compte pas), lanterne (dix devinettes), bol (la première recette) | pictogramme au trait |
| Trouvés en chemin | huit caractères trouvés dans l'anecdote d'une fête ou du premier jour d'un terme solaire, chacun une fois ; ils n'entrent pas en révision | 节 |
| Série | 7, 30, 100, 365 jours, les cadeaux remis par Que 雀 | « 7 j » |

Un trophée est un sceau carré 印 : obtenu, gravé en clair sur l'encre avec un double filet ; à venir, en pointillés avec sa progression (« 62 / 100 »). Le toucher montre son détail dans la carte du résumé, sans fenêtre modale, et la date où il a été obtenu. Un trophée obtenu le reste : la progression garde chaque trophée obtenu avec sa date (noté à la clôture de la session et à l'ouverture du tableau), même quand l'historique des cartes, borné, ne le montre plus.

Ce qu'aucun écran n'alimente encore reste verrouillé, jamais estimé. La progression compte déjà les devinettes résolues (chacune une fois) et les contes lus (une fois par conte et par niveau), et le tableau les lit ; la devinette du jour remplit la lanterne, la cuisine de Tao le bol (le premier plat réussi, chaque ingrédient trouvé), et le lecteur de contes note chaque version lue, un récit long une fois tous ses chapitres lus. Pour les pièges, la révision garde le leurre pris quand un choix est faux : une lecture compte « sans confusion » tant qu'aucun caractère de la paire n'a été pris pour l'autre, même rattrapé au second essai, quelle que soit sa vitesse. Une erreur venue d'un autre leurre ne casse pas la série ; une erreur dont le leurre n'est pas connu (révision d'avant ce suivi, tracé, jeu qui ne le dit pas) la casse, par prudence ; la devinette du jour dit les leurres pris.

### Le personnage

Au premier lancement, après l'objectif et le rythme, on choisit son personnage parmi trois bêtes, non genrées, pour que chacun s'y reconnaisse : 玉兔 le lapin de jade (la légende de la lune), 熊猫 le panda, 醒狮 le lion dansé (la danse du Nouvel An). On lui donne un nom : trois idées par bête, ou un nom libre, en lettres ou en caractères. Tao ne se choisit pas : elle reste celle qui aide, à côté du personnage, avec sa bulle. Une progression commencée avant le personnage le choisit la première fois qu'elle ouvre son écran. Réglages change la bête ou le nom sans rien perdre : les points et le rang restent (choix par défaut du lead).

Douze rangs, du bébé à l'adulte : l'éveil, l'enfance, puis les grades des examens impériaux jusqu'au trio du palais. Chaque titre est traduit mot à mot. Décision du propriétaire du 26 septembre 2026, « Points ET examen » : les points font toujours grandir le personnage, mais un titre d'examen ne s'accorde qu'une fois l'examen réussi et les points atteints ; les quatre derniers rangs, sans examen, demandent un palier de caractères lus (« Les examens 科举 » ci-dessous).

| Rang | Pinyin | Mot à mot | Rôle | Âge | Points | Et aussi |
|---|---|---|---|---|---|---|
| 启蒙 | qǐméng | lever le voile | les tout premiers caractères | bébé | 0 | — |
| 蒙童 | méngtóng | l'enfant qu'on éveille | les premières leçons | tout-petit | 10 | — |
| 学童 | xuétóng | l'enfant qui étudie | l'école du village, 私塾 | enfant | 25 | — |
| 童生 | tóngshēng | l'enfant lettré | reçu au district et à la préfecture, candidat au 院试 | grand enfant | 50 | 县试 et 府试 |
| 秀才 | xiùcai | talent éclos | reçu à l'examen du commissaire aux études | ado | 80 | 院试 |
| 举人 | jǔrén | la personne recommandée | reçu à l'examen de la province | ado | 120 | 乡试 |
| 贡士 | gòngshì | le lettré offert au trône | reçu au concours de la capitale | jeune | 180 | 会试 |
| 进士 | jìnshì | le lettré qui s'avance | reçu à l'examen du palais | jeune | 260 | 殿试 |
| 翰林 | hànlín | la forêt des pinceaux | membre de l'Académie impériale | adulte | 360 | nommé à 1 000 caractères lus |
| 探花 | tànhuā | cueillir les fleurs | troisième à l'examen du palais | adulte | 500 | 1 200 caractères lus |
| 榜眼 | bǎngyǎn | l'œil du tableau | deuxième à l'examen du palais | adulte | 700 | 1 555 caractères lus |
| 状元 | zhuàngyuan | tête de liste | en tête de l'examen du palais | adulte | 1 000 | 1 800 caractères lus |

Les paliers de points sont rapprochés au début, pour que le bébé grandisse vite, puis espacés ; 1 000 est aussi le palier de la gourde de Tao. Les rangs s'accordent dans l'ordre, sans en sauter un : un titre attend le précédent. Un titre accordé ne se reprend pas : une nomination reste quand le compte des lus, qui suit la stabilité des cartes, redescend sous son palier. Ce que chaque rang demande en plus des points, ses examens à titre ou son palier, est écrit dans `data/sources/heros/rangs.tsv`.

- Les points : quatre arts, 读 la lecture, 写 l'écriture, 听 l'écoute, 说 les tons. Un point par bonne réponse notée automatiquement par l'app (`srs.ts`), juste du premier coup ou rattrapée, quelle que soit sa vitesse. Lecture : reconnaître ou lire un caractère ou un mot (sens, caractère, assemblage, trou dans un mot, « quel élément donne le son ? », qui se lit sur la forme, tous les jeux et les mises en situation des examens) ; écriture : un tracé achevé, au pas Apprendre ou en question ; écoute : la question à l'oreille, le caractère reconnu au son ; les tons : la question de ton, trouver le ton de sa lecture, et « Dis-le », le ton dit et reconnu. Jamais de point pour le temps passé ; une erreur ne coûte rien ; pas de vies, pas de classement, pas de coffre. Le compte ne décroît jamais, et une progression importée d'avant le personnage recalcule le sien depuis ce qu'elle garde (les réponses justes de l'historique des cartes, les tracés achevés).
- La croissance : le personnage grandit à chaque point, sa taille glisse d'un palier de points au suivant ; il change de silhouette à chaque étape de vie, qui suit les seuls points (la colonne Âge), et de tenue à chaque rang, qui suit le titre accordé. Un 学童 qui a les points du 秀才 sans avoir passé le 府试 a la taille et la silhouette d'un ado, et garde la tenue de l'écolier : bien des 童生 avaient des cheveux blancs. Les tenues : 肚兜 et 长命锁 du bébé, 虎头鞋 du tout-petit, deux chignons 总角 et le sac à livres de l'écolier, la bande 襕 et le bonnet du 秀才, l'éventail du 贡士, la ceinture de jade et le bonnet à ailes du 进士, les nuages du 翰林, le 补子 du 探花, les vagues du 榜眼, le grand nœud de soie du 状元. Une aura l'entoure : des anneaux au pinceau, à plat, un tous les deux rangs, et les caractères déjà lus qui tournent autour.
- La charte : ni ombre, ni dégradé, ni doré, pas de cinabre sur le personnage (il reste au chemin), pas de dragon. L'abricot est un aplat. Le personnage garde ses couleurs les jours de fête. Les animations (l'aura qui tourne, Tao qui flotte) s'arrêtent si l'on réduit les animations.
- « Mon personnage » : le rang en haut à droite, dessiné depuis ses traits avec son pinyin ; la scène ; Tao et sa bulle ; le nom et trois lignes (le mot à mot et le rôle, la bête, l'âge et le rang) ; la barre vers le rang suivant ; les quatre arts ; les examens réussis, chacun avec sa date, le 榜 du personnage. La bulle de Tao dépend des seuls points et des examens : l'art le moins fourni, les derniers points avant un rang, l'examen qui reste, le sommet. Jamais l'horloge, jamais un reproche.
- Points atteints, examen pas encore réussi : l'en-tête du menu montre toujours le rang tenu, le dernier titre accordé, à la taille de ses points ; ni pastille, ni compteur, rien qui presse. « Mon personnage » montre la barre pleine et, dessous, « Reste le 院试 », avec sa porte de ville et « dans N j », ou « examen ouvert ». L'examen réussi avant les points, il dit « Reçu au 院试 · encore 12 points ».
- 放榜, « on affiche la liste » : quand un titre est accordé, l'examen réussi quand les points y sont, ou les points atteints quand l'examen l'est déjà (ou le palier de caractères, pour les quatre derniers) : le rang dessiné depuis ses traits, son pinyin, une ligne (« Ton nom est sur la liste… »), un bouton. Au retour au menu, jamais au milieu d'un pas ; une fois par rang.
- Le personnage s'ajoute aux trophées, il ne les remplace pas : les trophées disent ce qui a été lu, le personnage combien de réponses justes et quels examens réussis.
- Une progression d'avant les examens garde les rangs déjà annoncés : les examens en dessous sont notés reçus, à la date de la mise à jour, et le suivant s'ouvre si son palier est déjà atteint.
- Les textes (rangs, bêtes, phrases de Tao) viennent du pipeline, `data/sources/heros/` et `heros.json` ; les dessins sont du code de l'app, comme Tao.

### Les examens 科举

Décisions du propriétaire du 26 septembre 2026 : un examen « aux paliers de caractères », plutôt qu'à un nombre de jours ; en cas d'échec, « Pause jusqu'à réussite » ; pour les titres, « Points ET examen ». Puis, le même jour : « Il faut plus d'examens, sinon ça fait des gaps trop longs après. » Entre les six examens à titre, il y avait 50, 100, 55, 250 et 300 caractères, des mois au rythme complet. Des 月课 comblent ces écarts. Le 28 septembre, le propriétaire approuve le nom (« Oui, 月课 ») et la fin de la série à 1 800 caractères, le HSK 6 (« Oui, 1 800 »).

- La suite : deux sortes d'examens, chacun à un palier de caractères lus (au seuil de stabilité de Mon chemin, le compte du trophée Lire), passés dans un seul ordre. Les six examens des Qing donnent les titres ; entre eux, les 月课 n'en donnent aucun. D'un examen au suivant, jamais plus d'une cinquantaine de caractères.
- Les examens à titre gardent leurs paliers. Quatre sont ceux du trophée Lire (50, 100, 255, 505) ; 200 partage l'écart entre 100 et le premier seuil ; 805 est un seuil de l'Éducation nationale (§2). Les noms du 科举 ne servent qu'à eux.

| Examen | Pinyin | Ce qu'il était | Caractères lus | Titre |
|---|---|---|---|---|
| 县试 | xiànshì | l'examen du district, devant le magistrat | 50 | — |
| 府试 | fǔshì | l'examen de la préfecture | 100 | 童生, avec le 县试 |
| 院试 | yuànshì | l'examen du commissaire aux études de la province | 200 | 秀才 |
| 乡试 | xiāngshì | l'examen de la province, tous les trois ans | 255 | 举人 |
| 会试 | huìshì | le concours de la capitale | 505 | 贡士 |
| 殿试 | diànshì | l'examen du palais, devant l'empereur | 805 | 进士 |

- Les 月课 yuèkè, « la leçon du mois » : sous les Qing, les académies 书院 et les écoles officielles faisaient composer leurs élèves à date fixe, une ou deux fois par mois, les 官课 donnés par le magistrat et les 师课 par le maître de l'académie, pour préparer le 科举. On y était classé, parfois payé d'une petite bourse, le 膏火 ; on n'y gagnait aucun grade. C'est la place des examens intermédiaires : un entraînement régulier, sans titre, sur le chemin des examens à titre. Écartés : le 季考, l'épreuve de saison, dit un trimestre, trois fois l'écart voulu ; le 岁试 et le 科试, épreuves du commissaire aux études, ne concernaient que les 生员, déjà reçus au 院试, tous les trois ans environ, et pouvaient les rétrograder ou leur ôter leur statut : ni l'ordre (les 月课 de 75 et 150 viennent avant le 院试), ni le ton (rien ne se perd) ne conviennent. Comme le 乡试 « tous les trois ans », le nom dit l'institution, pas le calendrier : Wenlu compte des caractères, pas des mois.
- Où tombent les 月课 : à 75 et à 150, qui coupent en deux les longs écarts du début (dans l'export 0.1.0, le 府试 venait 50 jours du chemin après le 县试, le 院试 42 jours après le 府试) ; aucun entre 200 et 255, vingt jours ; puis tous les cinquante caractères depuis le 乡试, à 255 + 50 n. Cette grille passe par tous les seuils de l'Éducation nationale, 405, 505, 805 et 1 555, donc par le 会试 et le 殿试. Elle s'arrête à 1 800, le HSK 6, le bout du programme de la version 1, où le dernier écart est de 45. Trente et un 月课 en tout, trente-sept examens.

| Caractères lus | Examen | Titre | Écart | Au même palier |
|---|---|---|---|---|
| 50 | 县试 | — | 50 | trophée Lire 50 |
| 75 | 月课 | aucun | 25 | |
| 100 | 府试 | 童生 | 25 | trophée Lire 100 |
| 150 | 月课 | aucun | 50 | |
| 200 | 院试 | 秀才 | 50 | |
| 255 | 乡试 | 举人 | 55 | seuil 255, trophée Lire 255 |
| 305, 355 | 月课 | aucun | 50 | |
| 405 | 月课 | aucun | 50 | seuil 405 |
| 455 | 月课 | aucun | 50 | |
| 505 | 会试 | 贡士 | 50 | seuil 505, trophée Lire 505 |
| 555, 605, 655, 705, 755 | 月课 | aucun | 50 | |
| 805 | 殿试 | 进士 | 50 | seuil 805 |
| 855, 905, 955 | 月课 | aucun | 50 | |
| 1 000 | — | 翰林, nomination | | |
| 1 005, 1 055, 1 105, 1 155 | 月课 | aucun | 50 | |
| 1 200 | — | 探花, nomination | | HSK 4 |
| 1 205, 1 255, 1 305, 1 355, 1 405, 1 455, 1 505 | 月课 | aucun | 50 | |
| 1 555 | 月课 | aucun | 50 | 榜眼, nomination ; seuil 1 555, trophée Lire 1 555 |
| 1 605, 1 655, 1 705, 1 755 | 月课 | aucun | 50 | |
| 1 800 | 月课 | aucun | 45 | 状元, nomination ; HSK 6 |

- Les jours : dans l'export 0.1.0, le chemin Lire pose 356 caractères en 189 jours et le chemin HSK 430 en 219 (le dernier jour de chacun, non réconcilié, est sauté), 1,9 par jour du chemin ; les `jour` des fiches de `data/sources/fiches/` disent la même chose. Le Ne caractère entre :

| Palier | 50 | 75 | 100 | 150 | 200 | 255 | 305 | 355 | 405 |
|---|---|---|---|---|---|---|---|---|---|
| Lire, jour du chemin | 25 | 50 | 75 | 100 | 117 | 137 | 161 | 189 | — |
| HSK, jour du chemin | 28 | 53 | 78 | 102 | 118 | 137 | 157 | 180 | 205 |

  D'un examen au suivant, de 16 à 28 jours du chemin : deux semaines et demie à quatre semaines au rythme complet, jamais plus. Au-delà de l'export, cinquante caractères font environ 26 jours à ce rythme. Le compte des lus suit de quelques jours, le temps que les cartes se stabilisent. Le 县试 tombe avant la fin des trente jours gratuits, le premier 月课 après.
- Au rythme gratuit (§10), après les trente premiers jours du chemin, deux briques par semaine : un jour du chemin prend trois jours et demi du calendrier. Les mêmes écarts font de 9 à 14 semaines, un 月课 tous les deux à trois mois, là où le 府试 venait environ cinq mois après le 县试, et le 院试 cinq mois encore après. Pas plus d'examens pour autant : à quatre caractères par semaine, un examen par mois tomberait toutes les huit briques, une quinzaine de caractères : trop peu pour des mises en situation nouvelles, et chaque pause retiendrait des briques déjà rares. Les examens sont les mêmes pour tous : au rythme gratuit, ils viennent plus tard.
- Le chemin gratuit (seuil 255, HSK 1 : 356 et 430 caractères, briques comprises) mène au-delà du 乡试 : huit examens sur le chemin Lire (le 县试 au 乡试, les 月课 de 75, 150, 305 et 355), neuf sur le chemin HSK (et le 月课 de 405). Le 会试, le 殿试 et les 月课 suivants demandent la suite du parcours, avec Wenlu complet.
- Après le 殿试, plus d'examen à titre ; les 月课 continuent. Historiquement, le 殿试 ne recalait personne : il classait les 进士, et ses trois premiers, 状元, 榜眼 et 探花, entraient d'emblée à l'Académie, le 翰林院. Wenlu ne classe personne : un premier n'y a pas de sens, et le trio ne peut pas être un résultat du 殿试. Il ne peut pas non plus rester aux seuls points : les points dépassent d'ordinaire 1 000 bien avant 805 caractères lus, et 翰林, 探花, 榜眼, 状元 tomberaient le jour même du 进士. Les quatre derniers rangs sont donc des nominations, sans examen, chacune à un palier de caractères lus, après la précédente : 翰林 à 1 000 (la gourde de Tao), 探花 à 1 200 (le HSK 4, où s'arrête la cible, §3), 榜眼 à 1 555 (le dernier seuil), 状元 à 1 800 (le HSK 6, le bout du programme de la version 1). Le 翰林 est bien une nomination après le 进士, comme le voulait le propriétaire. Un 月课 ne donne ni ne retient une nomination : à 1 555 et à 1 800, le 月课 et la nomination partagent le palier, et le 放榜 ne lit que le compte des lus ; 翰林 et 探花 tombent cinq caractères avant un 月课 (1 005, 1 205), sans lien entre eux.
- Ce qu'on y lit : un peu de tout l'acquis, et surtout des mises en situation jamais vues : une pancarte, un menu, un billet de train, un court message, une lettre. Chacune est écrite avec les seuls caractères que le chemin a posés au jour du palier, dans le pipeline (`data/sources/examens/`), tracée comme les contes, les lettres et WeChat, et relue ; l'app n'en garde qu'une dont tous les caractères ont une carte, comme un dialogue WeChat. Chaque examen, 月课 compris, a deux séries pour chacun des deux chemins, Lire et HSK : la reprise prend l'autre. Un 月课 lit d'abord le tronçon, les caractères entrés depuis l'examen précédent : chacune de ses questions en porte au moins un. Le support se dessine à plat, aux pigments de la peinture : ni photo, ni ombre ; un grand caractère se dessine depuis ses traits.
- Les questions : pour un examen à titre, dix, cinq à huit minutes ; pour un 月课, cinq, trois ou quatre minutes, puisqu'il revient souvent et ne lit qu'un tronçon. Décision du propriétaire du 29 septembre 2026, « 10 et 5 » (le brief disait quinze et dix). Notées automatiquement, sans auto-évaluation. Plusieurs types : le sens d'une mise en situation (« Où va ce train ? », quatre choix), repérer (toucher sur le billet le mot qui dit l'heure), vrai ou faux sur une phrase du message, la bonne réplique à un message ; pour la revue de l'acquis, trois questions des types du §7 à un examen à titre, une ou deux à un 月课, sauf le tracé : on y lit. Chaque question déclare dans le pipeline les caractères qui portent sa réponse.
- Le pinyin sous les caractères, aux premiers examens. Décision du propriétaire du 29 septembre 2026 : « Il faudrait un mode avec pinyin sous les caractères sur les premiers examens (jusqu'à HSK 1), ensuite plus de pinyin pour les examens. » Aux examens de la première étape du chemin, chaque caractère des textes porte sa syllabe dessous, à la manière d'un ruby, petite, à la brume, jamais au cinabre ; la ponctuation n'en a pas, et un mot ne se coupe pas en fin de ligne. La première étape : sur le chemin Lire, jusqu'au seuil 255, le 乡试 compris (six examens : le 县试, le 府试, le 院试, le 乡试 et les 月课 de 75 et 150) ; sur le chemin HSK, jusqu'à la fin du HSK 1, le rang du dernier caractère de la liste que le chemin pose, briques comprises (428 dans l'export 0.1.0) : les neuf examens du chemin, jusqu'au 月课 de 405. Ensuite, plus de pinyin : sur le chemin Lire, les 月课 de 305 et 355, encore dans le chemin gratuit, n'en ont pas. Les données en décident (`examens.tsv`, colonne `pinyin_sous`, exportée pour chaque chemin), et `wenlu check` vérifie que ce sont tous les examens de la première étape et aucun après, sans trou.
- Jamais le pinyin quand il donnerait la réponse. Il se lit sous les textes des supports, sous l'affirmation d'un vrai ou faux, sous les répliques à choisir, et sous les mots d'un repérage, qui sont ceux du support. Jamais sous l'objet d'une question de ton (il donnerait le ton), ni sous l'objet et les choix d'un trou (le son du mot trahirait le caractère manquant), ni sous les choix d'une question « caractère », ni sous le caractère d'une question de sens : une question de revue n'en montre aucun. Une mise en situation dont le pinyin désignerait seul la bonne réponse est refusée par `wenlu check`, et l'écran s'en tairait : un nom transcrit, « À Zhongshan » sous zhōng shān parmi « À Nankin », « À Pékin », « À Shanghai », se choisirait sans lire ; un leurre au moins se transcrit aussi (« À Nanjing »), et il faut lire le billet pour savoir où va le train. De même, la consigne d'un repérage ne transcrit pas le mot cherché.
- Reçu : quatre réponses sur cinq justes du premier essai (huit sur dix à un examen à titre, quatre sur cinq à un 月课). Une seconde chance par question (maquette validée le 29 septembre 2026) : après une erreur, on peut toucher une autre réponse ; rattrapée, elle donne son point 读 mais ne compte pas pour le « premier coup », et ne note rien de plus en révision ; au vrai ou faux, la réponse se montre, sans second essai. Ni chronomètre, ni vies, ni points au temps ; « Quitter » sauvegarde et reprend à la même question. Chaque bonne réponse donne son point (读), comme un jeu ; une erreur note ses caractères comme faux, et ils reviennent en révision, que l'examen soit réussi ou non. L'examen fait lire quelque chose de plus, des textes jamais vus : il répond à la règle des jeux (CLAUDE.md).
- Quand : le palier atteint, Clore le dit en une ligne, et l'examen s'ouvre ; aucune brique nouvelle n'entre plus avant qu'il soit réussi (§6, « Journée sans brique nouvelle »). Il se passe hors session, la journée faite, depuis le bouton du menu (« Passer l'examen 县试 », « Passer le 月课 ») ou depuis sa porte sur la route devant. Jamais en rattrapage : la pile redescend d'abord. Les examens se passent dans l'ordre ; si le palier du suivant est déjà atteint, il s'ouvre à son tour. Au rythme gratuit, les deux briques de la semaine attendent aussi, et ne s'accumulent pas.
- Pas encore, « Pause jusqu'à réussite » : les caractères manqués reviennent en révision, et les sessions les ciblent (Échauffer les prend d'abord, Apprendre revient sur eux). L'examen se repasse quand chacun a été revu juste à son échéance, d'ordinaire un à trois jours ; d'ici là, le menu dit « L'examen se repasse quand les caractères manqués sont revus », sans compte à rebours, et le bouton de la journée faite reste « Réviser encore ». L'examinateur, Xing (§9), dit « pas encore » et « on se revoit au prochain », jamais un reproche ; avant sa rencontre, Tao le disait. Rien n'est perdu : ni points, ni acquis, ni série.
- Le résultat : un constat, pas des félicitations (« 9 sur 10 du premier coup. Reçu au 县试. », « 4 sur 5 du premier coup. Reçu au 月课. »), les caractères manqués dessinés depuis leurs traits, et les points 读, ceux du premier coup et les rattrapés. Manqué, un constat encore, jamais en ocre (l'ocre reste aux réponses) : « 6 sur 10 du premier coup. Pas encore. », chaque caractère manqué nommé avec l'endroit où on l'a croisé. Si un titre est accordé, le 放榜 du rang passe au retour au menu.
- La liste 放榜 de l'examen (décision du propriétaire du 29 septembre 2026, « Ok maquette d'examen ») : après chaque examen à titre reçu, 县试 compris, la liste affichée au mur : des noms de candidats inventés, écrits avec l'acquis du palier (`data/sources/examens/bang.tsv`), sans numéro ni rang, puisque Wenlu ne classe personne, et le nom du personnage écrit au pinceau en dernier, cerclé de jade ; le personnage et Tao la lisent côte à côte, et Xing la lit à voix haute, ses lamelles à la main ; dessous, l'examen à titre suivant et son titre. Un 月课 n'a pas de liste : on revient au menu. La maquette validée est `maquettes/examen.html`.
- Trophées : pas de sceau pour les examens. Le sceau Lire du même palier dit déjà le compte, le titre dit l'examen ; un troisième signe compterait deux fois la même chose. « Mon personnage » garde les examens à titre réussis avec leur date.
- Ce que donne un 月课 : rien de plus que ce qu'il fait lire : un point 读 par bonne réponse, comme toute question, et ses caractères notés en révision. Ni titre : les titres restent au 科举. Ni sceau : le trophée Lire compte déjà les caractères, et trente et un sceaux de plus rempliraient le tableau de la même chose. Ni bourse : le 膏火 des académies récompensait les mieux classés, et Wenlu ne classe personne ; une récompense qui s'ouvre à la fin d'une épreuve serait un coffre. La progression garde chaque 月课 réussi avec sa date, pour l'ordre et l'export ; le 榜 de « Mon personnage » ne liste que les examens à titre.
- Charte : l'indigo pour la porte et l'action, le jade pour le reçu, ni cinabre, ni doré, ni ombre, ni emoji, ni dragon. Les noms des examens se dessinent depuis leurs traits ; leurs textes, les mises en situation et les phrases de Tao et de Xing (`xing_*`) viennent du pipeline. Tout se décide dans `app/src/lib/examens.ts`.

## 9. Tao, Xing et les jeux

### Tao, la compagne

Tao suit toutes les activités et adopte la posture de l'utilisateur : bulle avec le caractère en leçon, mange pendant la révision (une carte, une bouchée ; erreur, grimace ; série juste, bond), lit par-dessus l'épaule en lecture, tient un pinceau au tracé, porte la lanterne aux devinettes, goûte en cuisine, marche sur le chemin de la série, écoute l'anecdote assise, tient son pinceau d'écolière, sans robe ni col (décision du propriétaire du 29 septembre 2026 : ils l'élargissaient), le panier d'examen 考篮 et attend à la porte pendant l'examen, puis lit la liste 榜 à côté du personnage (maquette validée le 29 septembre 2026) ; au 月课, un livre sous le bras, sans pinceau. Une fois Xing rencontré (ci-dessous), elle reste la compagne de route (le chemin, les jeux, la cuisine, la révision, WeChat, le tracé, les lettres de Que) et passe au maître ce qu'il sait : elle passe l'examen en écolière, pinceau à la main, écoute l'anecdote assise à côté de lui, et lui laisse la leçon, les contes et Chercher.

- Le personnage : Tao ne se choisit pas, elle aide celui qu'on a choisi (§8). Sur son écran, elle se tient à côté de lui avec sa bulle.
- Croissance : additionne toutes les activités. Paliers 100 (le baluchon), 300 (le chapeau de paille), 1 000 (la gourde).
- « Dis-le » : elle écoute, la tête penchée, et ne commente jamais un ton manqué.
- Humeur : vient de la variété, adoucie par les jours de repos. Trois fois la même activité d'affilée, elle s'ennuie et propose un jeu ; une semaine sans lecture, elle apporte un texte. C'est elle qui pousse vers les jeux, pas une notification.
- Journal : chaque soir, une ligne (« Aujourd'hui j'ai appris 住, mangé 14 cartes, résolu une devinette, cuisiné un 蛋炒饭 »). Le dimanche, la semaine en image partageable.
- Collection : ce que les jeux rapportent se voit sur elle (lanterne des devinettes, bol des recettes, sceau de famille sur le fanion de son auberge, et, les jours de fête, l'accessoire de la fête : flocon au Nouvel An, gâteau de lune à la mi-automne…). Rien ne s'achète.
- Interdits : tomber malade, mourir, pleurer, culpabiliser. Au retour après une absence, elle t'attend assise au pavillon 亭, un bol de thé à côté, sans reproche.

### Xing, le maître

Décision du propriétaire du 29 septembre 2026 : Tao reste la compagne de route ; Xing 杏 est le maître, « le sachant ». Son nom vient de l'autel des abricotiers 杏坛, où Confucius enseignait.

- Le dessin (variante H, validée le même jour) : un noyau d'abricot pâle, de la forme ronde du noyau de Tao, un peu plus petit, sans sillon ; un petit chignon d'encre et son épingle ocre, comme les portraits de Confucius ; les yeux plissés de rire, son regard calme ; les sourcils, la moustache et la barbe blancs, cernés d'encre ; de petites lamelles de bambou 竹简 à la main droite, les pieds ocre. Ses couleurs sont fixes (`--x-*`), comme celles du personnage : ni cinabre, ni ombre, ni dégradé, ni doré, ni emoji. À côté de Tao, il a la même taille qu'elle, jamais plus grand ; sans pousse, il paraît un peu plus petit. Tout son dessin tient dans `Xing.svelte`, les accessoires accrochés à quelques points d'ancrage, pour qu'un nouveau dessin s'y substitue.
- La rencontre : Tao le rencontre à la porte du premier examen, le 县试, une porte de l'aventure (§6) annoncée au retour au menu. Sa bulle mène à la scène : la porte de ville du 县试, Xing qui salue les mains jointes 作揖, Tao en écolière, pinceau à la main ; il dit son accueil, puis son nom dessiné depuis ses traits, d'où il vient et ce qu'il fait désormais. Avant la rencontre, Tao garde tous ses rôles, sans changement. La rencontre se lit sur les portes que la progression garde, sans champ de plus (export et import compris) ; une progression d'avant l'aventure le rencontre en silence.
- Ses rôles, chacun dans sa posture : l'examinateur (§8), derrière sa petite table, les lamelles déroulées : il pose les questions, accorde la seconde chance avec bienveillance, dit le résultat et lit le 榜 ; Tao passe l'examen en écolière, pinceau à la main, comme avant. L'étymologie et les briques, au pas Apprendre et dans les fiches, une bulle pour le caractère : sa ligne dit l'étiquette de la fiche, l'origine attestée ou le moyen mnémotechnique, jamais l'un pour l'autre (`wenlu check` le vérifie). L'anecdote du jour et les contes, assis, le rouleau ouvert. Chercher, le livre ouvert : le dictionnaire (§6, « Chercher, le dictionnaire 字典 »), dont il explique les fiches.
- Il ne gronde jamais : un examen pas encore reçu, « on se revoit au prochain ». Deux humeurs : le calme, où il respire doucement, et le contentement, un petit bond (une réponse trouvée, un examen reçu, la rencontre). Rien ne lit l'horloge. Ses animations s'arrêtent si l'on réduit les animations.
- Ses phrases viennent du pipeline (`data/sources/ecrans/xing.tsv`, `data/sources/examens/textes.tsv`, clés `xing_*`) ; tout se décide dans `app/src/lib/xing.ts`.

### Les jeux retenus

Règle : chaque jeu doit répondre à « qu'est-ce que l'utilisateur sait lire de plus après ? ». Pas de points au temps passé, pas de vies, pas de classements, pas de coffres. Détail et exemples dans `docs/jeux.md`.

| Jeu | Ce qu'il fait lire | Où |
|---|---|---|
| Assembler contre la montre | produire le caractère à partir des briques, 8 s ; temps écoulé : la réponse est montrée, rien n'est noté (décision du 26 septembre 2026, « Ne rien noter ») | pas Fixer, révision (1 sur 5) |
| La chaîne | chaque caractère contient le précédent (人 → 大 → 天) ou s'y cache (吞 → 口), en suivant l'arbre de décomposition | révision, week-end |
| Le dictionnaire éclair | deviner un mot jamais appris (火车, 电脑) | pas Utiliser, compteur « mots devinés » |
| La coquille | trouver le caractère faux dans un message (夫 pour 天) | paires à ne pas confondre |
| Le message WeChat | répondre à un message avec l'acquis | pas Utiliser, dès la 2e semaine |
| Les jumeaux | 己 已 巳 en flash de 700 ms | métro, révision |
| Les lettres de Que | feuilleton hebdomadaire écrit avec l'acquis | dimanche |
| Les saisons | le décor change avec le calendrier chinois, un caractère bonus par fête | Mon chemin |
| Les devinettes de lanternes | 灯谜 : la décomposition déguisée (« une bouche mord la queue du bœuf » : 告) | chaque matin avec Tao, fête des Lanternes |
| La cuisine de Tao | recette en chinois, ingrédients sur l'étal, dix plats de cantine | nourrir Tao |

### L'écran Jouer

Décision du propriétaire du 26 septembre 2026 : l'ancien menu en ligne était « trop classique ». L'écran Jouer devient un jeu de cartes illustrées, en deux parties séparées d'un filet d'encre.

- En tête : 玩 dessiné depuis ses traits, « Jouer », « Une à trois minutes », et le retour vers le menu (ou Mon chemin).
- « Aujourd'hui 今天 » : Tao, dans sa posture de jeu, tend un jeu dans une bulle. Ce jeu est un jeu jouable, jamais la devinette ; il part du jour, pas de l'horloge (le même toute la journée), et après trois plats d'affilée ce n'est pas la cuisine. Quand elle s'ennuie, sa bulle propose de changer ; sinon, elle invite. Sa carte prend toute la largeur, cerclée d'indigo, sous « Tao propose ». Dessous, la devinette du jour devient une lanterne 灯谜 : l'énoncé et « 1 min » ; une par jour, et une fois résolue ou montrée la carte le dit (« Résolue aujourd'hui. La suivante demain. »), la lanterne restant allumée si elle a été trouvée.
- « Les autres jeux 游戏 », avec leur nombre : une grille de cartes sur deux colonnes, les jouables d'abord. Seuls y sont les jeux dont la porte est ouverte (§6, « Les portes qui s'ouvrent ») : assembler et la chaîne avec Jouer, les autres à leur seuil de lus. Chaque carte porte un petit dessin plat et le caractère du jeu (菜 la cuisine, 信 le message, 典 le dictionnaire éclair, 拼 assembler, 双 les jumeaux, 链 la chaîne, 错 la coquille), le titre, ce qu'il fait lire, et la durée dans un cartouche indigo, dans le flux du texte. Un jeu pas encore jouable reste en pointillés, en retrait, avec ce qui lui manque ; son bouton est désactivé.
- Fonds neutres : toutes les cartes ont le fond papier de la carte et un filet fin. La couleur n'est que dans les images (dessins, caractères, lanterne), aux pigments de peinture (`--t1` à `--t4`). L'indigo marque l'action (la carte que tend Tao, les durées). Ni cinabre, ni ombre, ni dégradé, ni doré, ni emoji. Les caractères des cartes se dessinent depuis leurs traits ; sans traits dans l'export, la carte garde son seul dessin.

### Les jeux du pas Utiliser

Le pas Utiliser garde ses vues (les mots et la phrase, puis les trois lignes). Certains jours, un jeu s'y ajoute après le texte. La règle est déterministe : elle ne lit que le rang de la journée (celui que le menu annonce, « 8e jour »), le budget et l'acquis réel, jamais l'horloge.

- Au plus un jeu par journée. Il est choisi à l'entrée du pas et gardé : la session de plus n'en pose pas un second.
- Le message WeChat à partir du 8e jour, un jour sur trois (8e, 11e, 14e…) : un dialogue court dont tous les caractères sont acquis, pas encore lu au pas Utiliser, le plus récent du parcours d'abord. Il est de Wenlu complet (§10) : sans achat, ce jour-là prend l'éclair s'il y a un mot à deviner, sinon rien.
- Sinon le dictionnaire éclair, un jour sur deux (les jours pairs) : un mot jamais appris dont les deux caractères sont acquis, un seul tour ; le compteur « mots devinés » se lit sous la correction.
- Jamais plus long que le budget : le pas dure ce que le chemin annonce (1, 2 ou 4 minutes) ; les mots et la phrase comptent 30 s, le texte 50 s, un mot de l'éclair 20 s, un échange du message 20 s. À 5 minutes, aucun jeu ; à 10, l'éclair ou un dialogue de deux échanges ; à 20, tous les dialogues.
- Sans acquis suffisant (aucun mot, aucun dialogue ouvert), le pas reste tel quel.
- Notation des jeux : une bonne réponse notée par `grade`, une erreur ne note rien ; au message, une réplique trouvée après une erreur ne note rien non plus. Aucun chronomètre, aucun point au temps.
- « Quitter » sauvegarde le mot, le dialogue, l'échange en cours et les répliques écartées : on reprend au même écran.
- Tao joue la tête penchée à l'éclair, lit par-dessus l'épaule au message.

## 10. Périmètre de la version 1

Décisions du propriétaire du 26 septembre 2026. Le gratuit et le payant se distinguent par le rythme et par la suite du parcours, jamais par l'acquis : rien de ce qui est appris ne se perd ni ne se ferme. Le propriétaire demandait « en payant on peut avancer autant qu'on veut ? » : oui, dans les règles de la pédagogie, qui ne s'achètent pas. Une seule brique nouvelle par session, et un caractère n'entre en révision que si ses briques sont stables.

### Gratuit

- Les trente premiers jours du chemin au rythme complet, comme aujourd'hui : une brique nouvelle par session, sessions de plus comprises.
- Ensuite, le rythme gratuit : deux briques nouvelles par semaine, du lundi au dimanche (la semaine des lettres de Que), trois jours au moins entre deux. Une brique qu'on n'a pas prise ne s'accumule pas. Les autres jours, la session reste complète, six pas sur l'acquis (§6, « Journée sans brique nouvelle ») : révision en questions, tracé, jeux gratuits.
- Le chemin gratuit : le seuil 255 et le HSK 1 (2026), à ce rythme, avec leur décomposition, leurs origines, l'audio et le tracé. Ils ne sont plus gratuits « complets », comme le disait ce brief jusqu'ici : on les parcourt au rythme gratuit.
- Pour toujours : la révision de tout l'acquis, paires à ne pas confondre comprises (§7) ; la consultation en lecture seule de l'arbre complet ; les anecdotes, celles des fêtes et des termes solaires avec leur caractère ; une devinette par jour ; les jeux gratuits sur l'acquis : assembler, la chaîne, les jumeaux, la coquille, le dictionnaire éclair, la cuisine et ses trois plats ; la série, Mon chemin et sa route devant, les trophées ; Tao complète, le personnage et ses douze rangs ; les examens (§8), jusqu'au bout du chemin gratuit : huit sur le chemin Lire, le 县试, le 府试, le 院试, le 乡试 et quatre 月课, neuf sur le chemin HSK, avec le 月课 de 405.
- Contes : les trois fables du chemin, dont la première, 学弈, s'ouvre au jour 25, avant le trentième ; les trois contes du seuil 255, à ce niveau.
- Les lettres de Que des quatre premières semaines : la lettre n se lit au jour 7n du chemin, et les lettres 1 à 4 (jours 7 à 28) tombent dans les trente jours gratuits.
- Le dictionnaire de Chercher (§6) : les 3 000 caractères et les 11 092 mots du HSK 3.0, en consultation libre, fiches, sens relus et phrases comprises ; seule l'écriture au doigt est de Wenlu complet.
- Le web (PWA) : le seul périmètre gratuit, sans achat, sans compte, sans serveur.

La limite se dit calmement : ni compte à rebours, ni relance, ni fenêtre modale. Tao ne parle jamais d'achat et ne culpabilise jamais. Le jour où le rythme gratuit commence, Clore le dit en une ligne, et que tout l'acquis reste ouvert ; ensuite, la route devant montre « prochaine brique dans N j ». Wenlu complet se présente dans Réglages, et sur ce qui en dépend (un conte, un plat, une lettre) par une ligne et un lien.

### Payant (achat à vie ou abonnement mensuel) : Wenlu complet

- Le rythme complet : une brique chaque jour, et autant de sessions de plus qu'on veut, une brique chacune, dans les règles de la pédagogie.
- Seuils 405 à 1555 et HSK 2 à 6.
- L'écriture au doigt dans Chercher, dans l'abonnement comme dans l'achat à vie : la reconnaissance tourne sur l'appareil, sans coût par usage, à la différence de l'oral dans le nuage.
- Formes anciennes à côté de chaque brique.
- Textes de lecture générés avec les seuls caractères acquis, en dehors de la session (ceux du pas Utiliser restent dans la session gratuite).
- Bibliothèque complète de contes, à tous les niveaux.
- Synchronisation iCloud.
- Jeux complets : les lettres de Que à partir de la cinquième, le message WeChat, toutes les devinettes, dix plats. Dans la session gratuite, le jour du message (§9) prend le dictionnaire éclair s'il y a un mot à deviner, sinon rien.

Décision du propriétaire du 29 septembre 2026 (maquette du dictionnaire) : le palier « Dictionnaire complet : 9 000 caractères décomposés et expliqués » disparaît. La consultation du dictionnaire du HSK 1 à 9 devient libre (§6), et l'écriture au doigt passe dans Wenlu complet, sous ses deux formes, l'abonnement et l'achat à vie.

Deux lignes de l'ancienne liste payante passent au gratuit, parce qu'elles contredisaient ce qui reste gratuit pour toujours : les exercices « paires à ne pas confondre », qui sont de la révision (§7), et les saisons avec leurs caractères bonus, qui viennent des anecdotes.

### L'oral par IA

Décisions du propriétaire du 29 septembre 2026 : « J'aimerais que l'analyse des tons des enregistrements oraux soit faite par IA. On pourrait aussi intégrer un agent conversationnel audio par IA, par niveau », puis « Sur le téléphone en gratuit, sur le cloud avec abonnement », et « 5 € c'est une conversation par jour ». L'oral n'est plus hors périmètre.

- Gratuit, sur l'appareil, sans réseau : l'analyse des tons de la voix de l'apprenant (suivi de hauteur et petit modèle embarqué), sa courbe posée sur celle du modèle, le ton reconnu et un conseil, jamais un reproche ; une conversation simple sur l'appareil là où il le permet. Rien n'est envoyé.
- Abonnement Wenlu complet à 4,99 € par mois : une conversation par jour avec l'agent vocal dans le nuage, à son niveau. Elle ne s'accumule pas (comme les briques du rythme gratuit). Chaque réplique de l'agent est vérifiée contre les caractères acquis avant d'être dite, comme les contes. Elle passe par le relais Wenlu, sans compte.
- Le micro se demande au premier usage, avec un accord distinct pour le nuage. La politique de confidentialité dit les deux régimes : sur l'appareil, rien ne sort ; dans le nuage, la voix passe par le relais pour la conversation et n'est pas gardée.
- Livré le 29 septembre 2026, en partie (story 9.1) : l'analyse des tons sur l'appareil et la question « Dis-le » (§7), gratuite, sur le web comme dans l'app iOS, sans réseau. Suivi de hauteur (YIN) et petit modèle embarqué (31 Ko), appris sur deux voix du jeu 5961 de data.gov.tw (Open Government Data License 1.0, attribuée dans l'app et sur la page des licences) et sur des contours tirés des descriptions phonétiques des tons ; 88,5 % des caractères isolés d'une voix native jamais vue. Le son est jeté après l'analyse ; seule la moyenne de la voix (un nombre par syllabe, les trente dernières) reste dans la progression, pour situer le registre, et sort avec l'export. Réglages : « Dire les tons », allumé par défaut, et « Essayer maintenant », qui pose « Dis-le » sur un caractère acquis au hasard sans rien noter ; ce n'est pas une porte de l'aventure. Dans l'app iOS, la phrase du micro est posée par la CI (`NSMicrophoneUsageDescription`). Reste : l'essai sur iPhone, la précision sur des voix d'apprenants, les mots de deux syllabes, des voix d'entraînement du continent (docs/backlog.md, épic 9).
- À trancher : l'achat à vie (couvre-t-il la conversation dans le nuage, dont chaque minute coûte ?) et un palier au-dessus d'une conversation par jour. Analyse du 29 septembre 2026 : l'achat à vie couvre Wenlu complet et l'IA sur l'appareil, pas le nuage.

### Hors périmètre V1

- Grammaire.
- Comptes utilisateurs, social, classements.
- Android (V2, même code web).

## 11. Contenu et données

Sources à valider en licence avant usage commercial :

- Norme GF 0014-2009 (composants et noms), listes Eduscol des seuils, référentiel HSK 2026 (PDF officiel, référentiel des caractères p. 352 à 381 ; vérifier le niveau à partir duquel l'écriture est exigée).
- Make Me a Hanzi : décompositions, traits, étymologie en anglais (données LGPL, tracés sous Arphic Public License).
- Hanzi Writer : animation et quiz de tracé (MIT).
- Liste des mots du HSK 3.0 (GF 0025-2021) : deux transcriptions sous MIT, `ivankra/hsk30` (forme, niveau, catégorie, pinyin du site officiel) et, en contrôle, l'OCR `elkmovie/hsk30` ; la table seule, jamais le document (`docs/sources-licences.md` §6). Le dictionnaire (§6) n'a pas d'autre source de mots.
- CC-CEDICT : jamais pour un sens, ni dans le dictionnaire (décision du propriétaire du 29 septembre 2026) ; seulement pour ce qui n'est pas un sens, la sélection des mots des fiches et du dictionnaire éclair et leur pinyin (hanzi et pinyin, CC BY-SA 4.0, attribution).
- Formes anciennes : polices sigillaires et oracle en licence ouverte, à identifier. Images de sites tiers exclues.
- Origines et anecdotes : textes rédigés pour l'app, à partir du Shuowen et des sources ci-dessus, générés par lots avec Claude puis relus. Aucune reprise de Wiktionary.
- Audio : la voix chinoise de l'appareil quand il en a une du continent (§7, décision du 29 septembre 2026), et une voix neuronale pré-générée et embarquée pour tous les caractères et mots (Kokoro), qui la remplace sur un appareil sans voix chinoise ou au choix de l'apprenant (« Voix enregistrée »). Le dictionnaire ne dit que par la voix de l'appareil, sans fichier de plus pour ses 11 092 mots (décision du 29 septembre 2026). L'app ne dépend d'aucun service à l'exécution.

Pipeline (Python, dépôt séparé) : ingestion, réconciliation des décompositions avec la norme GF 0014-2009, construction du graphe, génération FR et EN, contrôle qualité (composants inconnus, cycles, doublons, étiquetage attesté / mnémotechnique), export JSON versionné.

## 12. Architecture

- PWA, TypeScript, Vite, Svelte, Workbox. Données statiques JSON par famille. Progression dans IndexedDB, export et import JSON.
- Grands caractères rendus en SVG depuis les données de tracé ; animation pinceau par ligne médiane.
- Hébergement : GitHub Pages ou Cloudflare Pages, site public inclus, une page par caractère (FR et EN).
- Phase App Store : Capacitor, StoreKit 2, CloudKit, retour haptique, widget « caractère du jour », Apple Pencil sur iPad. Nécessite un Mac ou un Mac cloud pour compiler et soumettre.

## 13. Monétisation

- Web : gratuit, le seul périmètre gratuit et les pages publiques ; ni achat, ni compte, ni serveur. Rôle : acquisition et référencement.
- iOS : achats intégrés, Wenlu complet (§10), les mêmes droits par les deux voies. Achat à vie non consommable autour de 29,99 €. Abonnement mensuel à 4,99 €, qui comprend une conversation par jour avec l'agent vocal dans le nuage (§10, « L'oral par IA » ; décision du propriétaire du 29 septembre 2026). Grilles Apple par pays.
- Ce qu'on achète : le rythme et la suite du parcours, jamais l'acquis. Les moments : la fin des trente jours gratuits du chemin, la semaine offerte du palier de 30 jours, puis, vers le 37e jour, le code à usage unique de moins 30 % sur l'achat à vie (§8). Pas de remise sur l'abonnement.
- Sans compte ni serveur : les achats viennent de StoreKit 2, liés à l'identifiant Apple et restaurables ; les cadeaux des paliers viennent de la progression locale. Une progression modifiée à la main peut ouvrir un cadeau de palier : risque accepté, faute de serveur.
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
- Note App Store 4,7 avec 100 avis à trois mois ; 5 000 téléchargements ; conversion payante 3 à 5 % des actifs à 30 jours. Le chiffre tombe désormais au bon moment : le rythme gratuit ralentit au trentième jour du chemin, la semaine offerte suit, puis le code du palier vers le 37e jour ; on le relit à 40 jours. Chiffres d'App Store Connect, jamais de l'app, qui ne collecte rien.
- Rétention réelle par caractère, taux d'erreur par type de question, temps par pas.

## 16. Feuille de route

| Phase | Contenu | Livrable |
|---|---|---|
| 0 | Licences, nom de domaine, PDF HSK 2026 dépouillé | décisions |
| 1 | Pipeline, seuil 255 et HSK 1 complets FR et EN, audio | JSON versionné |
| 2 | PWA : chemin, session, révision en questions, tracé, Mon chemin, série, Tao | app web utilisable au quotidien |
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

1. Nom de domaine, et l'adresse de support dédiée qui en dépend (page de confidentialité, App Store Connect).
2. Entité porteuse du compte Apple et de l'encaissement.
3. Source des formes anciennes compatible avec un usage commercial.
4. Niveau à partir duquel le HSK 2026 exige l'écriture manuscrite.
5. Niveau de relecture humaine au-delà du HSK 3.
