# Décompositions relevées contre la norme

Relevés du 24 et du 28 septembre 2026, chaque point vérifié contre la table de la norme
(`data/sources/gf0014-2009/composants.tsv`) et, pour les exemples (例字), sur le
fac-similé. Ce qui se corrige par la norme est dans `ids.tsv`, `equivalences.tsv` et
`decoupes.tsv` ; ce fichier dit ce qui a été corrigé le 28 septembre 2026, et ce qui
reste tel quel, avec la raison.

## Corrigées le 28 septembre 2026

Décision du propriétaire, le 28 septembre 2026 : « Corrige, oui ». Les dix-huit lignes
d'`ids.tsv` (vingt caractères) qui reprenaient la décomposition affichée depuis la
0.1.0, héritée de Make Me a Hanzi, en disant son écart à la norme (« écart relevé »),
donnent désormais la lecture de la table (section 3b d'`ids.tsv`). Chaque lecture est
comptée trait par trait contre `graphics.txt`, et appuyée, sauf pour 桌, 常 et 夏 (où
seule la forme est en cause), par la colonne des exemples de la norme.

| Caractère | Affiché (0.1.0) | Corrigé (norme) | Traits | Dans la norme |
|---|---|---|---|---|
| 候 | 亻 ⺈ 厂 矢 (11) | 亻 丨 𠃍 一 矢 | 2+1+1+1+5 = 10 | 𠃍 横折 (141), exemple 侯 |
| 场 | 土 勿 (7) | 土 𠃓 | 3+3 = 6 | 𠃓 杨字边 (429), exemple 场 |
| 夜 | 亠 亻 夕 (7) | 亠 亻 夜下角 ⿴夂丶 | 2+2+4 = 8 | 夜下角 (393), exemples 夜 液 |
| 帝 | 立 巾 (8) | 帝字头 ⿳亠丷冖 巾 | 6+3 = 9 | 帝字头 (74), exemples 帝 旁 |
| 旁, 榜 | 立 方 (9) | 帝字头 方 | 6+4 = 10 | le même |
| 桌 | ⺊ 日 十 木 (12) | ⺊ 日 木 | 2+4+4 = 10 | le 十 de 卓 se fond dans 木 |
| 第 | ⺮ 弟 (13) | ⺮ 𢎨 | 6+5 = 11 | 𢎨 弟省 (76), seul exemple 第 |
| 真 | 直 几 (10) | 十 具 | 2+8 = 10 | 具 (195), exemple 真 |
| 同 | 凡 口 (6) | 冂 一 口 | 2+1+3 = 6 | 冂 同字框 (364), exemple 同 ; 凡 porte un 丶 que 同 n'a pas |
| 常 | ⺌ 冂 口 巾 | ⺌ 冖 口 巾 | 3+2+3+3 = 11 | sous ⺌, 冖 (366), comme dans 劳 |
| 走, 起 | 土 止 | 土 龰 | 3+4 = 7 | 龰 足字底 (490), exemple 走 |
| 错 | 钅 廿 日 | 钅 龷 日 | 5+4+4 = 13 | 龷 昔字头 (394), exemple 昔 |
| 告 | 牛 口 | 𠂒 口 | 4+3 = 7 | 𠂒 告字头 (259), exemple 告 |
| 前 | 丷 一 月 刂 | 䒑 月 刂 | 3+4+2 = 9 | 䒑 前字头 (277), exemple 前 |
| 师 | 刂 一 巾 | リ 一 巾 | 2+1+3 = 6 | リ 师字旁 (507), exemples 帅 狮 |
| 夏 | 一 自 夂 | 丆 目 夂 | 2+5+3 = 10 | 丆 夏字头 (398), exemple 夏 |
| 举 | ⺍ 一 八 扌 | ⺍ 一 八 𰀁 | 3+1+2+3 = 9 | 𰀁 举字底 (191), exemple 举 ; ⺍ reste (plus bas) |
| 画 | 一 凵 田 | 一 田 凵 | 1+5+2 = 8 | ordre d'écriture : 田 avant 凵 (竖折, 竖), vérifié sur `graphics.txt` ; exemples 画 sous 田 (363) et 凵 (148) |

Disposition : 画 s'écrit `⿱一⿻田凵`, pour garder l'ordre d'écriture (凵 enveloppe 田
par le bas mais se trace après lui) ; 夏 et 桌 gardent trois étages (`⿳`), l'opérateur
de tête que lisent les devinettes et les leurres.

Ce que la correction a entraîné :

- **Découpes** (`decoupes.tsv`) : les neuf composants sans tracé que les lectures
  nomment prennent leurs traits dans le caractère même, `centre` : 帝字头 (帝 0-5),
  𢎨 (第 6-10), 𠃍 (候 3), 龷 (错 5-8), 夜下角 (夜 4-7), 丆 (夏 0-1), 𠃓 (场 3-5),
  𰀁 (举 6-8), リ (师 0-1). Comme les autres découpées, ils sont acquis d'entrée : aucun
  jour n'a à les poser.
- **Fiches** (lire) : 候, 同, 常, 走, 前 et 师 ont un nouveau texte d'origine et de
  nouveaux rôles ; 画 ne change que de composants et de structure. Étiquettes gardées,
  toutes `attesté` : l'histoire (os oraculaires, bronzes, Shuowen) ne dépend pas du
  découpage, seule la phrase qui nomme les composants d'aujourd'hui a changé. 候 nomme
  sa phonétique 矦 (hóu), écrite 丨 𠃍 一 矢, rôle `son` pour les quatre ;
  `phonetiques.tsv` la déclare, faute de décomposition de 矦 ou de 侯 qui la retrouve.
  La fiche de 冂, qui passe du jour 181 au jour 154, prend une phrase lisible ce jour-là
  (你和我不同。). Relues sous l'accord permanent du propriétaire (« Considère que les
  relectures c'est bon »).
- **Familles** (première brique dans l'ordre d'écriture ; les découpées n'en sont pas) :
  帝 passe de 立 à 巾, 旁 de 立 à 方, 真 de 直 à 十, 同 de 凡 à 冂, 告 de 牛 à 口, 前 de 丷
  à 月, 师 de 刂 à 一, 夏 de 一 à 目. Les familles 凡, 勿, 廿 et 直 disparaissent de
  l'export.
- **Devinettes** : 画 cite 一 田 凵. Celles de 告 (« 一口咬掉牛尾巴 »), 走 et 旁 sont
  retirées : elles citeraient 𠂒, 龰 et 帝字头, découpés, sans carte, que l'app ne
  compte jamais comme acquis ; elles reviendront si l'app apprend à les compter.
- **Parcours** : voir ci-dessous.

### Jours changés

Les ordres figés n'ont bougé que là où une brique n'avait plus rien à faire, ou où une
brique manquait ; aucun jour n'est ajouté ni retiré, aucun composé ne change de jour.
Trois briques quittent les parcours (凡, 勿, 廿 ; 直 au HSK), une y entre (具, HSK), une
avance (冂, du jour 181 au jour 154 de « lire »).

| Parcours | Jour | Avant | Après | Pourquoi |
|---|---|---|---|---|
| lire | 154 | 凡 : 同 | 冂 : 同 | 同 s'écrit sur 冂, qui n'était posé qu'au jour 181 ; 凡 ne sert plus à aucun caractère du seuil |
| lire | 181 | 冂 : 商 | — : 商 | 冂 est déjà posé au jour 154 ; jour sans brique nouvelle |
| hsk | 167 | 勿 : 场 | — : 场 | 场 s'écrit 土 𠃓 ; 勿 ne sert plus au HSK 1 |
| hsk | 171 | 凡 : 同 | — : 同 | 冂 est posé au jour 145 ; 凡 ne sert plus |
| hsk | 191 | 直 : 真 | 具 : 真 | 真 s'écrit 十 具 ; 直 ne sert plus |
| hsk | 214 | 廿 : 错 | — : 错 | 错 s'écrit 钅 龷 日 ; 廿 ne sert plus |

Les textes écrits pour un jour (mots et phrases des fiches, lettres, WeChat, périmètres
des contes, fables `jourN`) restent dans l'acquis : `wenlu check` le vérifie. Seule la
phrase de 冂 a dû changer. La fiche de 凡 reste versionnée, hors parcours.

## À reprendre : 学字头 (𭕄) compte trois traits

Relevé le 28 septembre 2026, en vérifiant 举. Le fac-similé dessine 学字头 (413) en
trois traits, 丶 丶 丿, sans 冖, et le cite dans 学, 应, 敛 et 检, qui n'ont pas de 冖 ;
Unihan donne 3 traits à 𭕄 (U+2D544, `kTotalStrokes`). Or `ids.tsv` écrit 学 = 𭕄 子 et
觉 = 𭕄 见, et `decoupes.tsv` découpe 𭕄 dans les cinq premiers traits de 学, 冖 compris.
La lecture de la norme serait 学 = 𭕄 冖 子, 觉 = 𭕄 冖 见, 𭕄 découpé dans 学 0-2 ; 兴
(𭕄 一 八) et 举 (𭕄 一 八 𰀁) se réconcilieraient du même coup. Mais 冖, posé aujourd'hui
au jour 132 (lire) et 149 (HSK), devrait l'être avant le jour 13 (学), et 兴 quitterait
les jours de fermeture : tous les jours de 13 à la fin se décaleraient, avec l'acquis des
textes. Décision de contenu, laissée au propriétaire ; en attendant, 兴 et 举 gardent ⺍.

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
| 候 | 矦 | 亻 丨 𠃍 一 矢 (corrigée le 28 septembre 2026, voir plus haut) |

Les rôles de ces sous-composants suivent la convention des lots (tous « son » quand
la phonétique est découpée) ; la convention elle-même attend la décision du
propriétaire.

## Non réconciliés : 兴 et 举

- **兴** : ⺍ + 一 + 八, comme en 0.1.0. ⺍ n'est pas un point de code de la table ; sa
  forme est celle du 学字头 (413, 𭕄), à reprendre d'abord dans 学 et 觉 (plus haut).
  兴 reste non réconcilié et ferme le parcours, dans les deux listes.
- **举** : ⺍ + 一 + 八 + 𰀁, hors des parcours ; même raison.

## Les 60 non réconciliés des 3 000 (story 10.9, 30 septembre 2026)

Sur les 60 caractères du dictionnaire dont la décomposition n'était pas réconciliée, 44
le sont par la section 6 d'`ids.tsv` : 23 lignes, dont dix sur un caractère intermédiaire
que cjk-decomp traverse (尧 pour 烧 绕 晓 浇 挠 翘 饶, 兵 pour 宾 滨 缤, 侯 pour 猴 喉, 亏
pour 污 夸 垮 挎 鳄, 唐 pour 糖 塘, 畏 pour 喂, 段 pour 锻, 率 pour 摔, 岛 pour 捣, 函 pour
涵). Chaque lecture est comptée trait par trait contre `graphics.txt` ; douze composants
sans tracé propre se découpent dans leur hôte (`decoupes.tsv`, tableau plus bas).

Deux lectures sont à vérifier sur le fac-similé avant relecture :

- **所** : 户 + 斤. La table n'a que 户 ; dans 所, le premier trait est un 撇, écrit avant
  le 竖撇 (`graphics.txt`), là où 户 commence par un 点. La brique dessinée est 户.
- **派** : 氵 + 𠂆 (反字框) + 𧘇 (衣省). Le côté droit, 𠂢, n'est pas dans la table ; ses
  six traits se lisent 撇 et 竖撇 (le haut de 反), puis 撇, 竖提, 撇, 捺 (le bas de 表).

Restent 16 non réconciliés, sans décomposition dans le dictionnaire :

- **Les treize au 学字头** : 兴, 举, 检, 脸, 应, 险, 验, 签, 捡, 剑, 誉, 俭, 敛. Leur ⺍
  est le 学字头 de la norme (413, 𭕄, trois traits, 丶 丶 丿 ; le fac-similé cite 学, 应,
  敛 et 检). Tant que `decoupes.tsv` découpe 𭕄 dans les cinq premiers traits de 学, 冖
  compris (section « À reprendre » plus haut), une surcharge qui les nommerait les
  dessinerait avec un 冖 qu'ils n'ont pas. Une fois 学 et 觉 repris (décision du
  propriétaire), les lectures sont prêtes, 佥 s'écrivant 人 一 𭕄 一 :

  | Caractère | IDS proposé | Traits |
  |---|---|---|
  | 兴 | `⿳𭕄一八` | 3 + 1 + 2 = 6 |
  | 举 | `⿱⿳𭕄一八𰀁` | 3 + 1 + 2 + 3 = 9 |
  | 誉 | à travers 兴 (`⿱兴言`, cjk-decomp) | 6 + 7 = 13 |
  | 应 | `⿸广⿱𭕄一` | 3 + 3 + 1 = 7 |
  | 检, 脸, 险, 验, 签, 捡, 剑, 俭, 敛 | 佥 `⿱⿱人一⿱𭕄一`, que cjk-decomp traverse | 佥 : 2 + 1 + 3 + 1 = 7 |

  兴 est au HSK 1 et ferme les deux parcours : le réconcilier change leur fin.
- **敢** : 横撇 (㇇) sur 耳 (90), puis 攵 (95) ; le 横撇 seul n'est pas un composant de la
  table (乛, 140, est le 横钩). La lecture de la norme n'est pas sûre d'ici.
- **展** et **丧** : 尸 + 卄 + 一 et 丧字头 (304, ⿻土丷) se lisent, mais leur bas, 竖提,
  撇, 捺, a trois traits, là où 𧘇 (衣省) en a quatre (表, 袁, 衰) : la brique dessinée
  aurait un trait de trop. À trancher sur le fac-similé (colonne des exemples de 226 et
  441).

## Corrigé par une notation, à vérifier sur la forme

- **蛋** (HSK 1) : cjk-decomp écrit 疋 en ㇖ + 龰 ; la notation ㇖ → 乛 le réconcilie en
  乛 龰 虫. Le premier trait de 疋 est-il bien le 横钩 de la norme ? À contrôler sur le
  fac-similé.
- **能** : la notation ⺼ → 月 donne 厶 月 匕 匕, conforme au nom « 月/肉月 » du composant
  471 ; l'ordre des feuilles (厶 avant 月) suit l'IDS de Make Me a Hanzi.

## Composants sans tracé propre

Make Me a Hanzi ne dessine pas ces composants de la norme ; chacun prend ses traits
dans un caractère hôte (`decoupes.tsv`), et reste acquis d'entrée, sans fiche.

| Composant | Nom | Hôte |
|---|---|---|
| ⿰𠄌丶 | 以字旁 | 以 |
| ⿰丿丨 | 乔字底 | 介 |
| 䒑 | 前字头 | 喜 |
| 𠂒 | 告字头 | 先 |
| 𠃊 | 竖折 | 喝 |
| 𭃂 | 那字旁 | 那 |
| 𭕄 | 学字头 | 学 (à reprendre, plus haut) |
| 龰, 龴, 𠀎, 𠂇, 𠂉, 𡗗 | — | 足, 令, 寒, 左, 乞, 春 |
| ⿳亠丷冖, 𢎨, 𠃍, 龷, ⿴夂丶, 丆, 𠃓, 𰀁, リ | — | 帝, 第, 候, 错, 夜, 夏, 场, 举, 师 (28 septembre 2026) |
| ⿷⿻𠂆一二, 𠂆, ⿳𠂉卌一, ⿱⿻十日⿰一丶, 鸟省, ⿻口一, ⿰冫⿱丿丶, 𧘇, 𰀠, 𰀂, 𭠍, 㐄 | — | 段, 派, 舞, 惠, 岛, 衰, 率, 表, 畏, 虐, 尧, 降 (30 septembre 2026) |

Pour 竹头, la forme de la source, ⺮, porte des tracés : `equivalences.tsv` la garde
et lui donne le nom de la norme, plutôt que de la renommer en 𥫗, qui n'en a pas.
