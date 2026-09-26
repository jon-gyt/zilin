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

  Les fenêtres ne se chevauchent jamais. Ce jour-là, l'anecdote est celle de la fête, et elle fait découvrir son caractère bonus (年, 灯, 雨, 粽, 桥, 月, 菊, 冬), dessiné depuis ses traits dans l'emblème, avec son pinyin et son sens. La couleur du papier de la fête passe sur `theme-color`, pour que la barre d'état suive. Le décor passe derrière tout, ne se touche pas, et disparaît si l'on réduit les animations. Le dragon n'apparaît qu'à ces deux fêtes, et dans leur seul décor, en aplats de papier découpé aux pigments de la fête : au Nouvel An, un dragon de danse cramoisi et abricot, tête, anneaux et queue portés sur des perches, ondule en suivant sa perle sous les cases ; à 端午, les bateaux ont une tête de dragon à la proue, sa queue à la poupe, des rameurs en traits d'encre et un batteur à l'avant. Ni dans l'emblème, ni dans le vœu, ni dans les textes, ni chez Tao. Le calendrier va jusqu'en 2035 : 2036 est une année du Dragon, dont l'animal ne se dessine jamais.
- Termes solaires : entre les fêtes, l'app suit les vingt-quatre termes solaires 二十四节气, un tous les quinze jours environ, de 立春 à 大寒, que le pipeline calcule à l'heure de Pékin (`data/sources/saisons/`). Chaque terme a son nom et sa traduction (白露, « la rosée blanche »), une ligne sur ce qui se passe dans la nature, une ou deux phrases de Tao et un caractère à lire, pris dans son nom ou lié à lui (露, 霜, 雪, 雷…), propre à chaque terme et dessiné depuis ses traits. Les termes se regroupent en huit ambiances de trois : les fleurs de pêcher (立春 à 惊蛰), la pluie fine (春分 à 谷雨), le duvet des saules (立夏 à 芒种), les lucioles (夏至 à 大暑), la rosée (立秋 à 白露), les feuilles (秋分 à 霜降), la neige (立冬 à 大雪), le prunier en fleur (冬至 à 大寒). Chacune teinte à peine le papier, qui reste le seul thème, et pose un petit décor animé, plus discret que celui des fêtes, coupé si l'on réduit les animations ; `theme-color` suit. L'en-tête du menu porte le terme en une ligne sous la marque (« 半 秋分 · l'équinoxe d'automne »), Tao commence par sa phrase de terme, et le jour où un terme commence, l'anecdote est la sienne : son caractère, son nom, ce qui se passe dans la nature. Les fêtes gardent la priorité : 中秋 recouvre 秋分, 清明 et 冬至, qui sont aussi des termes, gardent leur thème de fête ; ces jours-là, ni ambiance, ni ligne de terme, ni anecdote de terme. Pas de dragon aux termes : 惊蛰, c'est le tonnerre et le réveil des insectes.
- Pigments de fête : le rouge de fête #9E1F2A, cramoisi, distinct du cinabre, ne sert qu'au décor du Nouvel An et de la fête des Lanternes (rosace, lanternes, cases, 福) ; les six autres fêtes s'en passent, et le cinabre garde son rôle. L'abricot #E3A33B est un aplat, jamais un doré. Décision du propriétaire, inscrite dans CLAUDE.md.
- Typographie : Manrope (titres, voix du guide), Source Sans 3 (interface), Noto Serif SC (mots et phrases). Les grands caractères ne sont pas une police : ils sont dessinés trait par trait à partir des données de tracé, style 楷, et s'écrivent au pinceau à l'apparition.
- Mascotte : Tao 桃, une graine de pêcher qui grandit (graine, pousse, jeune pêcher, pêcher en fleur à 300 caractères, pêches à 1 000). Compagne de toutes les activités, voir section 9. Ami : Que 雀, le moineau, qui remet les cadeaux de la série, et se pose sur le pont de pies à 七夕.
- Principes : un écran, une action ; le rouge est un sceau, pas une alerte ; pas de doré, pas de dragon hors du Nouvel An et de 端午 (seule exception : le texte du conte 叶公好龙, sans dessin), pas d'emoji, pas d'illustration réaliste.

## 6. Structure de l'app

Une maison, une ligne, des détours. Le menu est la maison : tout en part, tout y revient. La session est la ligne : ses pas s'enchaînent sans repasser par le menu. Réviser, Jouer, Lire, Ma forêt, Chercher et Réglages sont les détours, et aucun ne dérègle la session. Il n'y a pas de barre d'onglets.

Ouverture : le logo s'écrit (1,6 s), puis l'anecdote du jour, qui compte comme le pas 1, Ouvrir, puis le menu. Au tout premier lancement, la première session passe avant tout : 人, 大, 天, puis lire 天天. Quatre minutes, un mot lu. Deux questions ensuite (objectif, rythme), puis le choix du personnage (§8, « Le personnage »). On arrive alors sur le menu, la journée faite : la première graine est plantée, la session complète commence le lendemain.

### Le menu

Il tient sur un écran de téléphone, sans défiler.

- En-tête : la marque, puis le portrait du personnage, Chercher (une loupe) et Réglages, par trois icônes. Le portrait est la tête du personnage à son rang, dans la case d'une icône ; il ouvre « Mon personnage ». Pendant une fête, le vœu prend la place de la marque ; les icônes restent.
- La carte du jour : le caractère dans son 米字格, dessiné depuis les traits, la brique nouvelle en cinabre ; son pinyin, qui se fait entendre ; son sens et sa décomposition (亻 + 主). Toucher le caractère le réécrit au pinceau et le prononce.
- Le chemin : six coups de pinceau, un par pas (faits en jade, en cours à l'encre, à venir en filet). Tao marche sur le pas en cours et dit une phrase qui dépend de l'état de la journée ; la toucher la fait sauter et changer de phrase. Dessous, « Pas 2 sur 6 · Échauffer » et la durée.
- Un seul bouton plein : « Commencer la session », « Reprendre au pas 3 ». La journée faite, il devient « Une session de plus · une brique », en contour.
- Quatre cases identiques : Réviser 温, Jouer 玩, Lire 读, Ma forêt 林. Avant la session, Réviser dit « Dans la session » et ouvre le pas Échauffer, pour que la pile ne se vide jamais en douce ; après, elle ouvre une révision en plus. Jouer est la seule porte des jeux. Lire ouvre les contes, et en tête l'anecdote du jour, à relire. Ma forêt garde les familles, la série et les récompenses, deux niveaux au plus.
- Chaque écran ouvert depuis le menu a un seul retour, qui y ramène.
- Quand un rang du personnage est franchi, l'écran 放榜 passe au retour au menu, avant lui, jamais au milieu d'un pas.

États du menu : nouvelle journée ; session entamée (reprise au pas exact, sauvegarde à chaque tap) ; journée faite (« Graine plantée, une seule par jour ») ; session de plus en cours ; retour après absence (mode rattrapage : révisions seules par blocs de cinq minutes, annoncés un à la fois, « Bloc 1 · 14 cartes », Tao en pot, aucun nouveau caractère tant que la pile n'est pas redescendue, message neutre, jamais de compteur de jours perdus).

### La session, six pas dans le même ordre

1. Ouvrir : l'anecdote du jour, culturelle, accrochée à un caractère (20 s, sautable). Elle se lit à l'ouverture. Elle se relit ensuite autant qu'on veut, depuis Lire ou en touchant la ligne de fête ou de terme de l'en-tête du menu, et ramène là d'où l'on vient ; la relire ne compte rien de plus.
2. Échauffer : les révisions dues, en questions (2 à 4 min).
3. Apprendre : une brique, puis un ou deux composés. Une seule brique nouvelle par session de 10 minutes.
4. Utiliser : deux mots, une phrase, trois lignes à lire avec uniquement l'acquis. Le caractère du jour en rouge. Certains jours, un jeu suit le texte : le dictionnaire éclair ou le message WeChat, jamais les deux (§9, « Les jeux du pas Utiliser »).
5. Fixer : une vérification sur ce qui vient d'être vu.
6. Clore : le constat en une ligne, la graine plantée (animation), la semaine et la série, le rendez-vous de demain. C'est la seule fin : on revient ensuite au menu.

Les pas s'enchaînent sans repasser par le menu. Chaque pas porte en tête la même barre de six coups de pinceau, et « Quitter », qui sauvegarde et ramène au menu ; le menu propose alors de reprendre au pas exact.

Budget choisi par l'utilisateur : 5, 10 ou 20 minutes.

### Travailler plus : la session de plus

La journée faite, « Une session de plus » ajoute une brique : quatre pas, Apprendre (la brique suivante du parcours), Utiliser, Fixer, Clore. Pas d'anecdote ; Échauffer passe devant seulement s'il reste des cartes dues. Jamais une seconde graine : la série compte les jours, pas les sessions, et le menu garde le compte (« Graine plantée · 2 sessions de plus »). Pas de limite par jour. Jamais en rattrapage : aucune brique nouvelle n'entre tant que la pile n'est pas redescendue. Rien ne remet la journée à zéro avant le lendemain.

Fluidité : un tap par écran, bouton principal unique en bas, avance automatique après une bonne réponse (1,3 s, tap pour aller plus vite), audio au toucher du caractère, pas de menu ni de fenêtre modale en session, « Quitter » sauvegarde sans question. Explications en trois phrases ; la suite dans la fiche, d'un tap.

## 7. Pédagogie

- Curriculum : graphe de dépendances généré à partir des décompositions GF 0014-2009, ordonné par fréquence et par niveau. Deux parcours à l'objectif choisi : « Lire » suit les seuils français (255 d'abord), « Passer le HSK » suit le référentiel 2026. Même arbre.
- Révision par questions, huit types : sens d'un caractère, caractère à partir du sens, assemblage de briques, trou dans un mot, reconnaissance à l'oreille, ton, « quel élément donne le son ? », tracé au doigt. Leurres choisis par ressemblance de composants.
  - À l'oreille : un bouton « Écouter » dit le caractère, par son fichier audio ou, à défaut, par la voix mandarin de l'appareil (sans réseau) ; il se rejoue autant qu'on veut. On choisit parmi quatre caractères acquis, les leurres ressemblant par la forme ou par le son (même syllabe, autre ton : 妈 pour 马), jamais un homophone (une lecture en commun). Sans fichier ni voix mandarin, la question ne se pose pas : jamais d'écran muet. Le pinyin des choix n'apparaît qu'à la correction.
  - Le ton : on voit le caractère, dessiné depuis ses traits, et son pinyin sans ton (« hao ») ; on choisit la syllabe parmi les quatre tons, dans leur ordre (hāo háo hǎo hào), et le ton neutre si la lecture l'a (吗 ma). La lecture vient de l'export (Unihan et surcharges), jamais de l'app. Pour un polyphone, seule la lecture principale est acceptée, et aucune autre lecture valide du caractère n'est proposée en leurre (好 : hào n'est pas proposé) ; faute de connaître toutes les lectures d'un caractère, la question ne se pose pas. Après la réponse, « Écouter » dit le caractère si une voix existe.
- Notation automatique, sans auto-évaluation : juste du premier coup en moins de six secondes, 12 jours ; juste mais lent, 4 jours ; juste après une erreur, 1 jour ; faux deux fois, la réponse est montrée, retour dans 10 minutes. Algorithme FSRS, rétention cible réglable.
- Correction toujours explicative, par les briques. Pas de félicitations, des constats.
- Tracé : proposé une fois par brique de base à la première rencontre, désactivable. Jamais demandé pour les composés. Par niveau, aligné sur « actifs / passifs » côté France et sur la liste d'écriture du HSK côté international.
- Paires à ne pas confondre injectées quand deux caractères proches sont acquis (己/已, 未/末, 天/夫, 日/曰, 人/入, 土/士).
- Le mot avant le caractère seul : chaque fiche porte deux mots et une phrase ; lecture de textes générés avec les seuls caractères acquis dès une vingtaine.
- Contes : des contes et histoires chinoises réécrits à chaque niveau avec les seuls caractères du niveau. Le même conte existe en plusieurs versions ; l'utilisateur relit la même histoire, plus riche, à mesure que son acquis grandit. Les versions sont générées par lots ou rédigées dans le pipeline puis relues, jamais dans l'app.
  - Niveaux : les contes suivent le HSK 3.0 (GF 0025-2021), la référence internationale, plutôt que les seuils 405 à 1555, introuvables (décision du propriétaire du 25 septembre 2026) : HSK 1 à 6 puis 7-9, chacun lu en cumul (HSK 3, les 900 caractères des niveaux 1 à 3). Les trois contes relus au seuil 255 gardent leur version 255, valide et publiée, et prennent leurs niveaux suivants en HSK ; le seuil 255 se place au palier de HSK 1 (tous ses caractères sont dans HSK 1 à 3). Chaque conte est prévu à deux ou trois niveaux selon la richesse du récit d'origine. Le plus bas est le premier niveau HSK dont le cumul a ses caractères clés, animaux et objets de l'intrigue (兔 : HSK 5 ; 龙 : HSK 3 ; 蛙 : HSK 7-9) ; le reste, noms propres compris, se dit autrement, ou, pour un personnage ou un objet clé, en mot expliqué (ci-dessous). Un récit simple, un épisode et une chute, en a deux : le plus bas, puis deux paliers plus haut (255 et HSK 3, HSK 4 et HSK 6). Un récit riche, plusieurs épisodes ou retournements, en a trois, de deux paliers en deux, où il se dit en entier (255, HSK 3, HSK 5 ; HSK 4, HSK 6, HSK 7-9). L'échelle s'arrête à HSK 7-9 : un récit qui commence haut y a moins de place. Le catalogue le dit conte par conte, caractères clés compris (`data/sources/contes/catalogue.tsv`), et `wenlu check` vérifie le critère sur les listes, sans jamais bloquer.
  - Mots expliqués (décision du propriétaire du 25 septembre 2026 : « Quand c'est un personnage clé comme loup, tu peux expliquer le mot aussi ») : une version peut nommer hors de son niveau un personnage ou un objet clé du récit, plutôt qu'un détour qui le trahit (狼 dans 亡羊补牢, 苗 dans 拔苗助长, 叶公 dans 叶公好龙). Chacun est déclaré au catalogue, et une version en a trois au plus (trois nouveaux au plus par chapitre d'un récit long) ; tout autre caractère hors du niveau reste refusé. Le lecteur les montre avant le texte, sur une carte « Vocabulaire du conte », le complément de vocabulaire du niveau, en tête du chapitre où ils paraissent : chacun dessiné depuis ses traits, son pinyin, son sens et une courte explication. Dans le texte, un trait fin et discret les souligne, sans cinabre, et leur glose au toucher dit « mot du conte ». Ils ne comptent pas dans « seulement ton acquis » : un mot expliqué n'empêche pas un conte de s'ouvrir.
  - Dans Lire, chaque conte du catalogue a sa ligne, et sous son titre ses niveaux en petits sceaux, comme ceux des trophées, marqués « 255 » ou « HSK 3 » : plein, écrit et ouvert par l'acquis ; au trait, écrit mais pas encore ouvert ; en pointillés, pas encore écrit. Rien n'est estimé : ce que l'export n'a pas n'est pas écrit. Les contes ouverts d'abord, puis les écrits fermés, puis ceux à venir.
  - Contes longs : un récit long (deux prévus, 木兰从军 d'après 《木兰诗》 et 美猴王 d'après les sept premiers chapitres du 《西游记》, à HSK 4 ou HSK 5 et plus) se lit chapitre par chapitre, chaque chapitre titré, de la longueur d'une fable du même niveau. Le lecteur montre un chapitre à la fois, un sommaire replié, « Chapitre suivant », et reprend au chapitre où l'on s'était arrêté (noté dans la progression, export et import compris). Le conte n'est lu, et son trophée gagné, qu'une fois tous ses chapitres lus : un chapitre non lu ne compte pas. Une fable se lit d'une traite, comme avant.

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
| Contes | chaque conte lu, relu à chaque niveau | le niveau (« 255 », « HSK 3 ») |
| Objets de Tao | pinceau (dix briques tracées en entier, le dernier trait posé : un tracé seulement proposé ne compte pas), lanterne (dix devinettes), bol (la première recette) | pictogramme au trait |
| Trouvés en chemin | huit caractères trouvés dans l'anecdote d'une fête ou du premier jour d'un terme solaire, chacun une fois ; ils n'entrent pas en révision | 节 |
| Série | 7, 30, 100, 365 jours, les cadeaux remis par Que 雀 | « 7 j » |

Un trophée est un sceau carré 印 : obtenu, gravé en clair sur l'encre avec un double filet ; à venir, en pointillés avec sa progression (« 62 / 100 »). Le toucher montre son détail dans la carte du résumé, sans fenêtre modale, et la date où il a été obtenu. Un trophée obtenu le reste : la progression garde chaque trophée obtenu avec sa date (noté à la clôture de la session et à l'ouverture du tableau), même quand l'historique des cartes, borné, ne le montre plus.

Ce qu'aucun écran n'alimente encore reste verrouillé, jamais estimé. La progression compte déjà les devinettes résolues (chacune une fois) et les contes lus (une fois par conte et par niveau), et le tableau les lit ; la devinette du jour remplit la lanterne, la cuisine de Tao le bol (le premier plat réussi, chaque ingrédient trouvé), et le lecteur de contes note chaque version lue, un récit long une fois tous ses chapitres lus. Pour les pièges, la révision garde le leurre pris quand un choix est faux : une lecture compte « sans confusion » tant qu'aucun caractère de la paire n'a été pris pour l'autre, même rattrapé au second essai, quelle que soit sa vitesse. Une erreur venue d'un autre leurre ne casse pas la série ; une erreur dont le leurre n'est pas connu (révision d'avant ce suivi, tracé, jeu qui ne le dit pas) la casse, par prudence ; la devinette du jour dit les leurres pris.

### Le personnage

Au premier lancement, après l'objectif et le rythme, on choisit son personnage parmi trois bêtes, non genrées, pour que chacun s'y reconnaisse : 玉兔 le lapin de jade (la légende de la lune), 熊猫 le panda, 醒狮 le lion dansé (la danse du Nouvel An). On lui donne un nom : trois idées par bête, ou un nom libre, en lettres ou en caractères. Tao ne se choisit pas : elle reste celle qui aide, à côté du personnage, avec sa bulle. Une progression commencée avant le personnage le choisit la première fois qu'elle ouvre son écran. Réglages change la bête ou le nom sans rien perdre : les points et le rang restent (choix par défaut du lead).

Douze rangs, du bébé à l'adulte : l'éveil, l'enfance, puis les grades des examens impériaux jusqu'au trio du palais. Chaque titre est traduit mot à mot.

| Rang | Pinyin | Mot à mot | Rôle | Âge | Points |
|---|---|---|---|---|---|
| 启蒙 | qǐméng | lever le voile | les tout premiers caractères | bébé | 0 |
| 蒙童 | méngtóng | l'enfant qu'on éveille | les premières leçons | tout-petit | 10 |
| 学童 | xuétóng | l'enfant qui étudie | l'école du village, 私塾 | enfant | 25 |
| 童生 | tóngshēng | l'enfant lettré | en route pour le premier examen | grand enfant | 50 |
| 秀才 | xiùcai | talent éclos | reçu à l'examen du district | ado | 80 |
| 举人 | jǔrén | la personne recommandée | reçu à l'examen de la province | ado | 120 |
| 贡士 | gòngshì | le lettré offert au trône | reçu au concours de la capitale | jeune | 180 |
| 进士 | jìnshì | le lettré qui s'avance | reçu à l'examen du palais | jeune | 260 |
| 翰林 | hànlín | la forêt des pinceaux | membre de l'Académie impériale | adulte | 360 |
| 探花 | tànhuā | cueillir les fleurs | troisième à l'examen du palais | adulte | 500 |
| 榜眼 | bǎngyǎn | l'œil du tableau | deuxième à l'examen du palais | adulte | 700 |
| 状元 | zhuàngyuan | tête de liste | en tête de l'examen du palais | adulte | 1 000 |

Les paliers sont rapprochés au début, pour que le bébé grandisse vite, puis espacés ; 1 000 est aussi le palier des pêches de Tao.

- Les points : quatre arts, 读 la lecture, 写 l'écriture, 听 l'écoute, 说 les tons. Un point par bonne réponse notée automatiquement par l'app (`srs.ts`), juste du premier coup ou rattrapée, quelle que soit sa vitesse. Lecture : reconnaître ou lire un caractère ou un mot (sens, caractère, assemblage, trou dans un mot, « quel élément donne le son ? », qui se lit sur la forme, et tous les jeux) ; écriture : un tracé achevé, au pas Apprendre ou en question ; écoute : la question à l'oreille, le caractère reconnu au son ; les tons : la question de ton, trouver le ton de sa lecture. Jamais de point pour le temps passé ; une erreur ne coûte rien ; pas de vies, pas de classement, pas de coffre. Le compte ne décroît jamais, et une progression importée d'avant le personnage recalcule le sien depuis ce qu'elle garde (les réponses justes de l'historique des cartes, les tracés achevés).
- La croissance : le personnage grandit à chaque point, sa taille glisse d'un rang au suivant ; il change de silhouette à chaque étape de vie et de tenue à chaque rang : 肚兜 et 长命锁 du bébé, 虎头鞋 du tout-petit, deux chignons 总角 et le sac à livres de l'écolier, la bande 襕 et le bonnet du 秀才, l'éventail du 贡士, la ceinture de jade et le bonnet à ailes du 进士, les nuages du 翰林, le 补子 du 探花, les vagues du 榜眼, le grand nœud de soie du 状元. Une aura l'entoure : des anneaux au pinceau, à plat, un tous les deux rangs, et les caractères déjà lus qui tournent autour.
- La charte : ni ombre, ni dégradé, ni doré, pas de cinabre sur le personnage (il reste au chemin), pas de dragon. L'abricot est un aplat. Le personnage garde ses couleurs les jours de fête. Les animations (l'aura qui tourne, Tao qui flotte) s'arrêtent si l'on réduit les animations.
- « Mon personnage » : le rang en haut à droite, dessiné depuis ses traits avec son pinyin ; la scène ; Tao et sa bulle ; le nom et trois lignes (le mot à mot et le rôle, la bête, l'âge et le rang) ; la barre vers le rang suivant ; les quatre arts. La bulle de Tao dépend des seuls points : l'art le moins fourni, les derniers points avant un rang, le sommet. Jamais l'horloge, jamais un reproche.
- 放榜, « on affiche la liste » : quand un rang est franchi, le rang dessiné depuis ses traits, son pinyin, une ligne (« Ton nom est sur la liste… »), un bouton. Au retour au menu, jamais au milieu d'un pas ; une fois par rang.
- Le personnage s'ajoute aux trophées, il ne les remplace pas : les trophées disent ce qui a été lu, le personnage combien de réponses justes.
- Les textes (rangs, bêtes, phrases de Tao) viennent du pipeline, `data/sources/heros/` et `heros.json` ; les dessins sont du code de l'app, comme Tao.

## 9. Tao et les jeux

### Tao, la compagne

Tao suit toutes les activités et adopte la posture de l'utilisateur : bulle avec le caractère en leçon, mange pendant la révision (une carte, une bouchée ; erreur, grimace ; série juste, bond), lit par-dessus l'épaule en lecture, tient un pinceau au tracé, porte la lanterne aux devinettes, goûte en cuisine, marche sur le chemin de la série, écoute l'anecdote assise.

- Le personnage : Tao ne se choisit pas, elle aide celui qu'on a choisi (§8). Sur son écran, elle se tient à côté de lui avec sa bulle.
- Croissance : additionne toutes les activités. Paliers 100, 300 (fleurs), 1 000 (pêches).
- Humeur : vient de la variété, adoucie par les jours de repos. Trois fois la même activité d'affilée, elle s'ennuie et propose un jeu ; une semaine sans lecture, elle apporte un texte. C'est elle qui pousse vers les jeux, pas une notification.
- Journal : chaque soir, une ligne (« Aujourd'hui j'ai appris 住, mangé 14 cartes, résolu une devinette, cuisiné un 蛋炒饭 »). Le dimanche, la semaine en image partageable.
- Collection : ce que les jeux rapportent se voit sur elle (lanterne des devinettes, bol des recettes, sceau de famille sur le pot, et, les jours de fête, l'accessoire de la fête : flocon au Nouvel An, gâteau de lune à la mi-automne…). Rien ne s'achète.
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

### Les jeux du pas Utiliser

Le pas Utiliser garde ses vues (les mots et la phrase, puis les trois lignes). Certains jours, un jeu s'y ajoute après le texte. La règle est déterministe : elle ne lit que le rang de la journée (celui que le menu annonce, « 8e jour »), le budget et l'acquis réel, jamais l'horloge.

- Au plus un jeu par journée. Il est choisi à l'entrée du pas et gardé : la session de plus n'en pose pas un second.
- Le message WeChat à partir du 8e jour, un jour sur trois (8e, 11e, 14e…) : un dialogue court dont tous les caractères sont acquis, pas encore lu au pas Utiliser, le plus récent du parcours d'abord.
- Sinon le dictionnaire éclair, un jour sur deux (les jours pairs) : un mot jamais appris dont les deux caractères sont acquis, un seul tour ; le compteur « mots devinés » se lit sous la correction.
- Jamais plus long que le budget : le pas dure ce que le chemin annonce (1, 2 ou 4 minutes) ; les mots et la phrase comptent 30 s, le texte 50 s, un mot de l'éclair 20 s, un échange du message 20 s. À 5 minutes, aucun jeu ; à 10, l'éclair ou un dialogue de deux échanges ; à 20, tous les dialogues.
- Sans acquis suffisant (aucun mot, aucun dialogue ouvert), le pas reste tel quel.
- Notation des jeux : une bonne réponse notée par `grade`, une erreur ne note rien ; au message, une réplique trouvée après une erreur ne note rien non plus. Aucun chronomètre, aucun point au temps.
- « Quitter » sauvegarde le mot, le dialogue, l'échange en cours et les répliques écartées : on reprend au même écran.
- Tao joue la tête penchée à l'éclair, lit par-dessus l'épaule au message.

## 10. Périmètre de la version 1

### Gratuit

- Seuil 255 et HSK 1 (2026) complets : décomposition, origines, révision en questions, audio, tracé, anecdotes, série, forêt.
- Consultation en lecture seule de l'arbre complet.
- Trois contes au seuil 255.
- Tao complète, le personnage et ses douze rangs ; jeux gratuits : assembler, la chaîne, les jumeaux, la coquille, le dictionnaire éclair, une devinette par jour, la cuisine (trois plats).

### Payant (achat à vie ou abonnement mensuel)

- Seuils 405 à 1555 et HSK 2 à 6.
- Dictionnaire complet : 9 000 caractères décomposés et expliqués.
- Formes anciennes à côté de chaque brique.
- Textes de lecture générés avec les seuls caractères acquis.
- Bibliothèque complète de contes, à tous les niveaux.
- Exercices « paires à ne pas confondre ».
- Synchronisation iCloud.
- Jeux complets : les lettres de Que, le message WeChat, toutes les devinettes, dix plats, les saisons avec caractères bonus.

### Hors périmètre V1

- Grammaire, oral en production. Les tons se reconnaissent (la question de ton, décision du propriétaire), ils ne se prononcent pas.
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
