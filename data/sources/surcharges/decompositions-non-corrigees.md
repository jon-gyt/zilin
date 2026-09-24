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
