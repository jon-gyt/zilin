# Jeux et Tao : spécification

Référence jouable : `maquettes/zilin-jeu.html` (démos des mécaniques) et `maquettes/zilin-maquette.html` (session, cercle, chemin).

## Contrat commun d'un jeu

- Entrée : la liste des caractères acquis (stabilité FSRS au-dessus du seuil), les décompositions, les mots CC-CEDICT dont tous les caractères sont acquis.
- Sortie : des événements de révision (`{caractère, correct, tries, seconds}`) notés par `srs.grade`, comme une question de révision. Un jeu ne contourne jamais l'algorithme.
- Durée : 1 à 3 minutes. Un jeu se termine par un constat (« 5 caractères revus, 1 mot deviné »), pas par un score.
- Hôte : un écran unique `game/<id>` avec Tao dans la posture « joue », retour vers la session ou Ma forêt.

## Les dix jeux

1. Assembler contre la montre. Sens donné, briques en vrac (les vraies plus deux leurres visuellement proches), 8 secondes, ordre d'écriture exigé. Exemples : « maman » → 女 + 马 parmi 马 口 女 子 ; « habiter » → 亻 + 主 parmi 王 主 亻 丶. Erreur = montré, retour dans 10 minutes.
2. La chaîne. Départ sur une brique acquise, quatre propositions dont une seule contient le dernier caractère. 人 → 大 → 天 → 吞. La longueur, limitée par l'acquis, est un constat, pas un score. Les `parts` de l'export étant plates, une manche enchaîne plusieurs chaînes (口 → 可 → 哥 → 歌, puis 女 → 如…).
3. Le dictionnaire éclair. Mot de deux caractères acquis, jamais appris comme mot. Quatre sens dont un juste. 火车 (train), 电脑 (ordinateur), 手机 (téléphone), 水果 (fruits), 大人 (adulte), 好看 (joli). Compteur « mots devinés » distinct.
4. La coquille. Message de 6 à 12 caractères avec un intrus tiré des paires à ne pas confondre. 我今夫很好 (夫 pour 天). Messages rédigés dans `data/sources/coquilles/` (`coquilles.json`), intrus acquis. Paires : 己 已 巳, 未 末, 天 夫, 日 曰, 人 入, 土 士, 王 玉 主.
5. Le message WeChat. Un message reçu, trois réponses dont une tient. 你好吗？→ 我很好，你呢？ Arbre de 3 à 10 échanges par famille.
6. Les jumeaux. Flash de 700 ms, deux caractères proches, quinze paires par minute.
7. Les lettres de Que. Une lettre par semaine, 40 à 120 caractères, uniquement acquis, question finale à un mot. Feuilleton : Que voyage de 西安 à 喀什.
8. Les saisons. Décor selon le calendrier chinois : Nouvel An 年, fête des Lanternes 灯, Qingming 雨, fête des bateaux-dragons 粽 (le dragon au décor seulement), Qixi 桥, mi-automne 月, double neuf 菊, solstice d'hiver 冬. Un caractère bonus et une anecdote par fête, dans `data/sources/fetes/textes.tsv`. Entre les fêtes, les vingt-quatre termes solaires (`data/sources/saisons/textes.tsv`) : une ambiance légère, et un caractère à lire par terme (露, 霜, 雪, 雷…). Le décor de l'app est en place ; celui du cercle de Ma forêt reste à faire.
9. Les devinettes de lanternes (灯谜). Une devinette = une décomposition déguisée. « Une bouche mord la queue du bœuf » : 告. « Un homme sous un arbre » : 休. « Le soleil et la lune ensemble » : 明. « Dix bouches » : 古. « Une femme et un enfant » : 好. Base de 100, une par matin, portée par Tao ; la lanterne s'allume pour la journée.
10. La cuisine de Tao. Recette en chinois, ingrédients sur l'étal, erreurs plausibles. 蛋炒饭 = 鸡蛋 + 米饭 + 油 ; 牛肉面 = 牛肉 + 面 + 汤 ; piège 牛奶 (lait) pour 牛肉 (bœuf). Dix plats de cantine, un par famille alimentaire (米 面 肉 菜 汤).

## Tao

Postures par activité : leçon (bulle avec le caractère, répète à l'audio), révision (mange ; grimace sur erreur ; bond sur série), lecture (lit par-dessus l'épaule, suit la ligne), tracé (pinceau, trace un trait derrière), jeu (lanterne, bol, tête penchée), chemin (marche), anecdote (assise).

État : `croissance` (somme pondérée des activités, paliers 100 / 300 / 1 000), `humeur` (variété sur 7 jours, jours de repos neutres), `journal` (liste des activités du jour), `collection` (objets gagnés). Règles : jamais malade, jamais morte, jamais de reproche ; absence = pot et attente ; retour = redressement en 2 s. Ennui : trois activités identiques d'affilée → proposition d'un jeu différent.

Stades : graine, pousse (deux feuilles), jeune pêcher, pêcher en fleur (rose #E7A2B4), pêches.
