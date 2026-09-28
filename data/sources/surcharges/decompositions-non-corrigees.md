# Décompositions vérifiées et laissées telles quelles

Relevé du 2026-09-24, à la suite des notes des rédacteurs des fiches du seuil 255.
Chaque point a été vérifié contre la table de la norme
(`data/sources/gf0014-2009/composants.tsv`). Ce qui se corrigeait par la norme est
dans `ids.tsv` et `equivalences.tsv` ; voici le reste, et pourquoi.

## Phonétiques éclatées : la norme ne les compte pas

Aucune de ces formes n'est parmi les 514 composants. La décomposition canonique
descend donc jusqu'aux composants de la norme, et c'est l'étymologie, la couche
par-dessus, qui nomme la phonétique dans le texte de la fiche.

| Caractère | Phonétique | Décomposition canonique |
|---|---|---|
| 意 | 音 | 立 日 心 |
| 语 | 吾 | 讠 五 口 |
| 懂 | 董 | 忄 艹 重 |
| 别 | 另 | 口 力 刂 |
| 远, 完, 玩 | 元 | 辶 / 宀 / 王, puis 二 儿 |
| 新 | 亲 | 立 一 小 斤 |
| 吃 | 乞 | 口 𠂉 乙 (corrigée : ㇠ hors norme) |
| 喝 | 曷 | 口 日 勹 人 𠃊 (corrigée : ㇗ ramené à 𠃊) |
| 冷 | 令 | 冫 人 丶 龴 (corrigée : ㇔ ramené à 丶) |
| 那, 哪 | 冄 | 𭃂 阝 (corrigée : 那字旁, composant propre de la norme) |
| 题 | 是 | 日 一 龰 页 (corrigée : 疋 hors norme) |

Les rôles de ces sous-composants suivent la convention des lots (tous « son » quand
la phonétique est découpée) ; la convention elle-même attend la décision du
propriétaire.

## Non corrigé, faute de composant dans la norme

- **兴** : Make Me a Hanzi donne ⺍ + 一 + 八. ⺍ n'est pas dans la table ; la norme
  n'a que 𭕄 (学字头), qui porte en plus 冖, et ⺌ (尚字头), dont le trait central
  est vertical. Aucune lecture de la table ne justifie une surcharge : 兴 reste non
  réconcilié et ferme le parcours, dans les deux listes.

## Corrigé par une notation, à vérifier sur la forme

- **蛋** (HSK 1) : cjk-decomp écrit 疋 en ㇖ + 龰 ; la notation ㇖ → 乛 le réconcilie en
  乛 龰 虫. Le premier trait de 疋 est-il bien le 横钩 de la norme ? À contrôler sur le
  fac-similé.
- **能** : la notation ⺼ → 月 donne 厶 月 匕 匕, conforme au nom « 月/肉月 » du composant
  471 ; l'ordre des feuilles (厶 avant 月) suit l'IDS de Make Me a Hanzi.

## Composants sans tracé

Ces composants de la norme sont désormais dans le périmètre exporté, mais Make Me a
Hanzi ne les dessine pas : ils restent des feuilles muettes, acquises d'entrée, sans
tracé ni fiche (`wenlu check`, « briques muettes »).

| Composant | Nom | Caractères du périmètre |
|---|---|---|
| ⿰𠄌丶 | 以字旁 | 以 |
| ⿰丿丨 | 乔字底 | 介 |
| 䒑 | 前字头 | 喜 |
| 𠂒 | 告字头 | 先, 洗 |
| 𠃊 | 竖折 | 喝, 渴 |
| 𭃂 | 那字旁 | 那, 哪 |
| 𭕄 | 学字头 | 学, 觉 |
| 龰, 龴, 𠂇, 𠂉 | — | déjà muettes avant ces corrections |

Pour 竹头, la forme de la source, ⺮, porte des tracés : `equivalences.tsv` la garde
et lui donne le nom de la norme, plutôt que de la renommer en 𥫗, qui n'en a pas.

## Écarts à la norme repris tels quels (relevé du 28 septembre 2026)

Quand la décomposition a quitté `dictionary.txt` (`docs/sources-licences.md` §10),
chaque caractère exporté que cjk-decomp ne rendait pas à l'identique a reçu une ligne
d'`ids.tsv`, rédigée pour Wenlu et relue contre la table de la norme. Pour que rien ne
bouge côté app (fiches relues, familles, devinettes, parcours figés), ces lignes
reprennent la décomposition affichée depuis la version 0.1.0, même là où la relecture
l'a trouvée en écart avec la norme. Chaque écart est dit dans la raison de sa ligne
(« écart relevé ») ; le corriger demande de reprendre la fiche du caractère (rôles,
origine, mémo) et, pour une brique qui entre ou sort, de refiger les parcours.

| Caractère | Affiché (0.1.0) | Lecture de la norme | Pourquoi |
|---|---|---|---|
| 候 | 亻 ⺈ 厂 矢 | 亻 丨 𠃍 一 矢 ? | 10 traits pour 11 ; le 丨 qui suit 亻 manque ; à vérifier sur le fac-similé |
| 场 | 土 勿 | 土 𠃓 | 𠃓 (429, 杨字边) ; 勿 a un trait de trop |
| 夜 | 亠 亻 夕 | 亠 亻 ⿴夂丶 | 夜下角 (393), sans point de code ; 夕 a un trait de moins |
| 帝 | 立 巾 | ⿳亠丷冖 巾 | 帝字头 (74), sans point de code ; 立 + 巾 : 8 traits pour 9 |
| 旁, 榜 | 立 方 | ⿳亠丷冖 方 | le même 帝字头 ; 9 traits pour 10 |
| 桌 | ⺊ 日 十 木 | ⺊ 日 木 | le 十 de 卓 se fond dans 木 ; 12 traits pour 10 |
| 第 | ⺮ 弟 | ⺮ 𢎨 | 𢎨 (76, 弟省) |
| 真 | 直 几 | 十 具 | le bas de 真 est 一 + 八, pas le 乚 de 直 |
| 同 | 凡 口 | 冂 一 口 | 同字框 (364) ; 凡 porte un 丶 |
| 常 | ⺌ 冂 口 巾 | ⺌ 冖 口 巾 | sous ⺌, 冖 (丶 puis 横钩) |
| 走, 起 | 土 止 | 土 龰 | le bas de 走 est 足字底 (490), comme dans 跑 |
| 错 | 钅 廿 日 | 钅 龷 日 | 龷 (394, 昔字头) |
| 告 | 牛 口 | 𠂒 口 | 告字头 (259), sans tracé |
| 前 | 丷 一 月 刂 | 䒑 月 刂 | 前字头 (277), sans tracé |
| 师 | 刂 一 巾 | リ 一 巾 | 师字旁 (507) |
| 夏 | 一 自 夂 | 丆 目 夂 ? | 夏字头 (398) ; le compte de traits tient dans les deux lectures |
| 举 | ⺍ 一 八 扌 | … 𰀁 | 举字底 (191) ; 举 reste non réconcilié (⺍) |
| 画 | 一 凵 田 | 一 田 凵 ? | ordre des traits : 田 avant de fermer 凵, à vérifier |

Les neuf premières lignes sont des erreurs de fait (compte de traits, forme) et non de
simples choix de notation : ce sont celles de Make Me a Hanzi, qu'il vaut mieux ne pas
garder à terme dans une décomposition qui se veut la nôtre. La correction se décide avec
les fiches, caractère par caractère.

