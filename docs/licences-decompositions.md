# Licence des décompositions, caractère par caractère

Produit par `uv run wenlu licences` (`data/src/wenlu_data/licences.py`) ; ne pas modifier à la main. La décision et son raisonnement sont dans `docs/sources-licences.md` §10 ; ce fichier en est la pièce justificative.

Version exportée relue : `0.1.0`. Chaque candidat redescend la décomposition GF 0014-2009 à la place de Make Me a Hanzi, les surcharges versionnées (`data/sources/surcharges/ids.tsv`) passant devant, et la compare aux `parts` exportés.

## Sources lues

| Candidat | Licence | Embarquable | Fichiers (SHA-256) | Note |
|---|---|---|---|---|
| Unihan kIDS (Unicode License) | Unicode License v3 | oui | `Unihan.zip` `f7a48b2b545acfaa…` | Unihan 17.0.0 : 0 valeurs `kIDS` |
| cjk-decomp (déjà la source de repli) | MIT (au choix parmi six licences) | oui | `ids-secondaires.json` `44db1c3a99b43924…` | 73899 IDS |
| BabelStone IDS (IDS.TXT, Andrew West) | aucun droit revendiqué : usage personnel ou commercial libre, sans autorisation ni attribution (en-tête du fichier, § 2) | oui | `babelstone-IDS.TXT` `cc2a0a97e6a51ed6…` | 97649 IDS |
| cjkvi-ids (ids.txt) | GPL v2 (README) ; ids.txt « suit les termes » de CHISE | non | `cjkvi-ids.txt` `bfc70a8c09f9f561…` | 88937 IDS |
| CHISE IDS (IDS-UCS-Basic, IDS-UCS-Ext-A) | GPL v2 ou ultérieure (README.md, section License) | non | `chise-IDS-UCS-Basic.txt` `296f2ad81911e92b…`<br>`chise-IDS-UCS-Ext-A.txt` `d58c5b21054d1ba0…` | 27596 IDS |

## Décompte

- 582 caractères exportés, dont 259 composants de la norme (briques et feuilles découpées : `parts` vide, rien à décomposer, GF 0014-2009 seule) et 323 caractères décomposés.
- Parmi ces derniers, 304 descendent au moins un IDS de `dictionary.txt` (LGPL) ; 19 n'en descendent aucun (cjk-decomp ou surcharge seulement).

Couverture de chaque candidat sur les caractères décomposés, surcharges devant et formes de notation ramenées à la norme (`data/sources/surcharges/notation-candidats.tsv`), sauf mention. « Conservées » : identiques, ou identiques à la notation près (≡ : même composant de la norme, ⺮ pour 𥫗) — `parts` ne bouge pas. « Même tête » : parmi elles, l'opérateur de tête de la structure, que lisent les devinettes, est inchangé.

| Candidat | Conservées | Même tête | Variante du groupe | Autre ordre | Différentes | Non réconciliées | Absentes |
|---|---|---|---|---|---|---|---|
| GF 0014-2009 et nos surcharges seules | 7 (2.2 %) | 7 | 0 | 0 | 0 | 0 | 316 |
| Unihan kIDS (Unicode License) | 0 | — | — | — | — | — | 323 (0 IDS dans la source) |
| cjk-decomp (déjà la source de repli) | 272 (84.2 %) | 268 | 9 | 4 | 33 | 3 | 2 |
| BabelStone IDS (IDS.TXT, Andrew West) | 249 (77.1 %) | 242 | 13 | 2 | 35 | 18 | 6 |
| chaîne proposée : surcharges > cjk-decomp > BabelStone | 273 (84.5 %) | 269 | 9 | 4 | 33 | 4 | 0 |
| autre ordre : surcharges > BabelStone > cjk-decomp | 267 (82.7 %) | 260 | 13 | 2 | 39 | 2 | 0 |
| chaîne proposée, sans la table de notation | 269 (83.3 %) | 265 | 9 | 4 | 33 | 8 | 0 |
| cjkvi-ids (ids.txt) | 266 (82.4 %) | 262 | 16 | 3 | 26 | 12 | 0 |
| CHISE IDS (IDS-UCS-Basic, IDS-UCS-Ext-A) | 228 (70.6 %) | 223 | 17 | 1 | 19 | 58 | 0 |

Sur les 304 caractères qui dépendent aujourd'hui de Make Me a Hanzi, la chaîne proposée conserve 254 décompositions ; 9 prennent une autre variante du même groupe, 4 un autre ordre, 33 d'autres composants, et 4 ne se réconcilient pas.

Parmi ces 50 écarts, BabelStone seul rend déjà la décomposition exportée pour 20 (做刚商坐弼懂放教条满爷狼画网苗菊菜菩蒙行) : une source permissive l'appuie, la surcharge n'a qu'à la retenir.

Décisions proposées :

- rien à remplacer : 259
- remplacer, identique : 254
- relire : surcharge ou accepter : 33
- inchangée (hors LGPL) : 19
- relire : autre variante du même groupe : 9
- relire : ordre : 4
- surcharge à écrire : 4

## Parcours rejoués

La réconciliation, le graphe et les deux parcours rejoués sur les 9 574 caractères du build (ceux de `graphics.txt`), avec la chaîne dite à la place de Make Me a Hanzi (`data/work/build/licences-simulation/`). « Relecture confirmée » : les caractères que la chaîne ne conserve pas reçoivent, pour la mesure seulement, une surcharge égale à leur structure exportée. « Rangs figés » : l'ordre de fréquence reprend le nombre de dépendants du build d'aujourd'hui au lieu de le recompter.

| Scénario | Surcharges ajoutées | Décompositions changées (sur 9 574) | Parcours | Jours | Premier jour qui diffère | Caractères qui changent de jour |
|---|---|---|---|---|---|---|
| chaîne actuelle rejouée (témoin) | 0 | 0 | hsk | 220 → 220 | aucun | 0 |
| chaîne actuelle rejouée (témoin) | 0 | 0 | lire | 190 → 190 | aucun | 0 |
| chaîne proposée, rangs recomptés | 0 | 2130 | hsk | 220 → 215 | 4 | 359 |
| chaîne proposée, rangs recomptés | 0 | 2130 | lire | 190 → 189 | 7 | 252 |
| chaîne proposée, relecture confirmée, rangs recomptés | 50 | 1913 | hsk | 220 → 220 | 26 | 222 |
| chaîne proposée, relecture confirmée, rangs recomptés | 50 | 1913 | lire | 190 → 190 | 16 | 154 |
| chaîne proposée, relecture confirmée, rangs figés | 50 | 1913 | hsk | 220 → 220 | aucun | 0 |
| chaîne proposée, relecture confirmée, rangs figés | 50 | 1913 | lire | 190 → 190 | aucun | 0 |

## Champs de la décomposition, et d'où ils viennent

| Champ exporté | Composant de la norme (GF 0014-2009) | Source d'IDS (`sources`) |
|---|---|---|
| `parts` d'une brique ou d'une feuille découpée | vide : le caractère est un composant de la table | aucune |
| `parts` d'un caractère décomposé | chaque feuille est un composant de la table, où la descente s'arrête | le découpage jusqu'à ces feuilles et leur ordre |
| `sources` | — | le nom des sources descendues, par le pipeline |
| `nouveau`, `role` | l'index d'un composant de `parts` | hérite de `parts` |
| famille (`racine`, `familles/<racine>.json`) | la première brique de `parts` | hérite de `parts` |
| `index.json` : `parcours` (jours, briques) | prérequis = `parts` | hérite de `parts`, et de l'ordre de fréquence compté sur les 9 574 décompositions |
| `devinettes.json` (leurres, disposition) | les briques citées sont les `parts` | l'opérateur de tête de `structure`, non exporté |
| `pinyin`, `lectures` | — | aucune : Unihan et `pinyin.tsv` |

## Autres emprunts à Make Me a Hanzi

| Quoi | Source | Licence | Embarqué | Détail |
|---|---|---|---|---|
| pinyin de repli d'une fiche relue (hors Unihan et `pinyin.tsv`) | dictionary.txt (`pinyin`), par le contexte de la fiche | fait, non protégeable | oui | 1 caractères : ⺮ zhú |
| tracés et médianes (`traits/`) | graphics.txt | Arphic Public License | oui | 582 caractères dans 259 fichiers, dont 13 composants découpés dans un hôte (glyphes modifiés, `MODIFICATIONS.md`) |
| tracés de repli (`app/public/strokes-demo.json`) | graphics.txt | Arphic Public License | oui | 89 caractères, table nue **sans en-tête de licence** (APL §2 a) |
| marque et icônes (`app/public/icons/`) | graphics.txt (文) | Arphic Public License | oui | tracés de 文 recopiés par `app/scripts/icons.mjs`, mention en commentaire du SVG |
| opérateur de tête de `structure` (dispositions des devinettes) | dictionary.txt | LGPL 3.0+ | non | 304 caractères exportés à structure descendue de Make Me a Hanzi ; `devinettes.json` n'en garde que le choix des leurres et le contrôle de disposition |
| genre `brique` (composant présent au dictionnaire) | dictionary.txt (liste des caractères) | fait, non protégeable | non | 245 briques exportées ; seule la présence du caractère est lue |
| ordre des parcours (nombre de dépendants) | dictionary.txt (via les décompositions des 9 574 caractères) | fait dérivé, compté | non | un décompte, pas une reprise ; change avec la source d'IDS |
| contexte des fiches : rôle probable, type et indice d'étymologie | dictionary.txt (`etymology`) | LGPL 3.0+ | non | 472 caractères exportés en ont un ; donnés au rédacteur comme indices à vérifier, jamais recopiés ; seuls les rôles relus entrent dans l'export |
| contrôle du pinyin de la cuisine | dictionary.txt (`pinyin`) | LGPL 3.0+ | non | contrôle seulement ; le pinyin exporté vient d'Unihan et des surcharges |

## Composants de la norme (rien à décomposer)

259 caractères : leur `parts` est vide, la table GF 0014-2009 seule les définit. Seuls leurs tracés viennent de Make Me a Hanzi (`graphics.txt`, APL).

⺀ ⺈ ⺊ ⺌ ⺍ ⺮ ⿰丿丨 ⿰𠄌丶 㔾 㠯 䒑 一 丁 丂 七 三 上 下 丌 不 与 且 丙 东 两 丨 丩 个 丬 中 丰 丶 丷 丸 为 主 丿 乂 乃 么 乍 乙 乛 九 也 习 书 了 争 事 二 云 五 井 亠 亡 亥 京 人 亻 今 儿 兆 免 八 六 其 冂 再 冖 冫 几 凡 凵 出 刀 刂 力 办 勹 勺 勿 匕 匚 十 午 半 南 卜 卩 厂 厶 去 又 叚 口 后 囗 四 土 垂 士 夂 夕 大 天 太 夫 夬 夭 头 女 子 宀 寸 小 少 尤 尸 山 工 己 巳 巴 巾 干 年 广 廿 开 弋 弓 弟 彐 彡 彳 心 忄 戈 戋 我 户 手 扌 才 攵 文 斗 斤 斥 方 日 曰 曲 月 木 未 本 来 果 欠 止 正 殳 母 毛 气 水 氵 求 火 灬 爫 父 牙 牛 犬 犭 玉 王 瓜 生 用 田 申 电 疒 白 百 皿 目 直 矢 示 礻 禾 穴 立 米 糸 纟 罒 羊 老 耂 耳 肉 自 至 舌 艮 艹 虍 虫 衣 西 覀 见 言 讠 谷 豕 贝 身 车 辶 酉 釆 里 重 钅 长 门 阝 隹 雨 非 面 页 风 飞 饣 首 马 高 鸟 龟 龰 龴 龶 龹 𠀎 𠂇 𠂉 𠂒 𠃊 𡗗 𭃂 𭕄

## Caractères décomposés

Lecture : `=` identique aux `parts` exportés ; `≡` mêmes composants de la norme, autre point de code ; `variante :` même groupe de la norme à chaque place ; `ordre :` mêmes composants, autre ordre ; `≠` composants différents ; `écart :` feuille hors norme ; `absent` : la source ne décrit pas le caractère. Les colonnes des sources seules portent les surcharges et la table de notation, comme la chaîne.

Unihan `kIDS` n'a pas de colonne : aucune version publiée ne porte ce champ.

| Caractère | Motif | `parts` exportés | Source actuelle | cjk-decomp | BabelStone | Chaîne proposée | Décision proposée |
|---|---|---|---|---|---|---|---|
| 举 | rang | ⺍ 一 八 扌 | makemeahanzi | écart : ⺍ 一 八 二 丨 | ≠ 𭕄 一 八 𰀁 | écart : ⺍ 一 八 二 丨 | surcharge à écrire |
| 买 | seuil-255, hsk-1 | 乛 头 | makemeahanzi | = | = | = | remplacer, identique |
| 些 | seuil-255, hsk-1 | 止 匕 二 | makemeahanzi | = | = | = | remplacer, identique |
| 亲 | seuil-255 | 立 一 小 | makemeahanzi | ≠ 立 十 小 | ≠ 立 木 | ≠ 立 十 小 | relire : surcharge ou accepter |
| 什 | seuil-255, hsk-1 | 亻 十 | makemeahanzi | = | = | = | remplacer, identique |
| 介 | hsk-1 | 人 ⿰丿丨 | surcharge | = | = | = | inchangée (hors LGPL) |
| 从 | seuil-255, hsk-1 | 人 人 | makemeahanzi | = | = | = | remplacer, identique |
| 他 | seuil-255, hsk-1 | 亻 也 | makemeahanzi | = | = | = | remplacer, identique |
| 仙 | conte | 亻 山 | makemeahanzi | = | = | = | remplacer, identique |
| 以 | seuil-255 | ⿰𠄌丶 人 | surcharge | = | = | = | inchangée (hors LGPL) |
| 们 | seuil-255, hsk-1 | 亻 门 | makemeahanzi | = | = | = | remplacer, identique |
| 休 | hsk-1 | 亻 木 | makemeahanzi | = | = | = | remplacer, identique |
| 会 | seuil-255, hsk-1 | 人 云 | makemeahanzi | = | écart : ？ 一 厶 | = | remplacer, identique |
| 住 | seuil-255, hsk-1 | 亻 主 | makemeahanzi | = | = | = | remplacer, identique |
| 体 | hsk-1 | 亻 本 | makemeahanzi | = | = | = | remplacer, identique |
| 作 | seuil-255, hsk-1 | 亻 乍 | makemeahanzi | = | = | = | remplacer, identique |
| 你 | seuil-255, hsk-1 | 亻 ⺈ 小 | makemeahanzi | = | ≠ 亻 丿 乛 小 | = | remplacer, identique |
| 信 | seuil-255 | 亻 言 | makemeahanzi | = | = | = | remplacer, identique |
| 候 | seuil-255, hsk-1 | 亻 ⺈ 厂 矢 | makemeahanzi | absent | écart : 亻 丨 ？ 矢 | écart : 亻 丨 ？ 矢 | surcharge à écrire |
| 假 | hsk-1 | 亻 叚 | makemeahanzi | = | = | = | remplacer, identique |
| 做 | hsk-1 | 亻 十 口 攵 | makemeahanzi | ≠ 亻 十 口 𠂉 乂 | = | ≠ 亻 十 口 𠂉 乂 | relire : surcharge ou accepter |
| 元 | hsk-1, rang | 二 儿 | makemeahanzi | = | ≠ 一 兀 | = | remplacer, identique |
| 先 | seuil-255, hsk-1 | 𠂒 儿 | cjk-decomp, surcharge | = | = | = | inchangée (hors LGPL) |
| 兔 | conte | 免 丶 | makemeahanzi | = | ≠ ⺈ 口 丿 乚 丶 | = | remplacer, identique |
| 公 | conte | 八 厶 | makemeahanzi | = | = | = | remplacer, identique |
| 兰 | conte | 丷 三 | makemeahanzi | = | = | = | remplacer, identique |
| 关 | seuil-255, hsk-1 | 丷 天 | makemeahanzi | = | absent | = | remplacer, identique |
| 兴 | seuil-255, hsk-1 | ⺍ 一 八 | makemeahanzi | écart : ⺍ 一 八 | ≠ 𭕄 一 八 | écart : ⺍ 一 八 | surcharge à écrire |
| 典 | interface | 曲 八 | makemeahanzi | = | ≠ 冂 一 一 丨 丨 八 | = | remplacer, identique |
| 写 | seuil-255, hsk-1, interface | 冖 与 | makemeahanzi | = | écart : 冖 ？ 一 | = | remplacer, identique |
| 冬 | seuil-255, fête, terme | 夂 ⺀ | makemeahanzi | = | = | = | remplacer, identique |
| 冰 | terme | 冫 水 | makemeahanzi | = | = | = | remplacer, identique |
| 冷 | seuil-255, hsk-1, terme | 冫 人 丶 龴 | makemeahanzi, cjk-decomp, surcharge | = | écart : 冫 令 | = | remplacer, identique |
| 净 | hsk-1 | 冫 争 | makemeahanzi | = | = | = | remplacer, identique |
| 准 | hsk-1 | 冫 隹 | makemeahanzi | = | = | = | remplacer, identique |
| 凉 | terme | 冫 京 | makemeahanzi | = | = | = | remplacer, identique |
| 分 | seuil-255, hsk-1, terme | 八 刀 | makemeahanzi | = | = | = | remplacer, identique |
| 刚 | seuil-255 | 冂 乂 刂 | makemeahanzi | ≠ ⺆ 乂 刂 | = | ≠ ⺆ 乂 刂 | relire : surcharge ou accepter |
| 别 | seuil-255, hsk-1 | 口 力 刂 | makemeahanzi | = | = | = | remplacer, identique |
| 到 | seuil-255, hsk-1 | 至 刂 | makemeahanzi | = | = | = | remplacer, identique |
| 前 | seuil-255, hsk-1 | 丷 一 月 刂 | makemeahanzi | ≠ 䒑 月 刂 | ≠ 䒑 ⺝ 刂 | ≠ 䒑 月 刂 | relire : surcharge ou accepter |
| 动 | hsk-1 | 云 力 | makemeahanzi | = | = | = | remplacer, identique |
| 包 | hsk-1 | 勹 巳 | makemeahanzi | = | = | = | remplacer, identique |
| 北 | seuil-255, hsk-1 | 匕 匕 | cjk-decomp | = | écart : ？ 匕 | = | inchangée (hors LGPL) |
| 医 | hsk-1 | 匚 矢 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 卖 | seuil-255 | 十 乛 头 | makemeahanzi | = | = | = | remplacer, identique |
| 友 | seuil-255, hsk-1 | 𠂇 又 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 双 | interface | 又 又 | makemeahanzi | = | = | = | remplacer, identique |
| 古 | seuil-255 | 十 口 | makemeahanzi | = | = | = | remplacer, identique |
| 只 | seuil-255 | 口 八 | makemeahanzi | = | = | = | remplacer, identique |
| 叫 | seuil-255, hsk-1 | 口 丩 | makemeahanzi | = | = | = | remplacer, identique |
| 可 | seuil-255 | 丁 口 | makemeahanzi | = | = | = | remplacer, identique |
| 右 | hsk-1 | 𠂇 口 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 叶 | conte | 口 十 | makemeahanzi | = | = | = | remplacer, identique |
| 号 | hsk-1 | 口 丂 | makemeahanzi | = | = | = | remplacer, identique |
| 吃 | seuil-255, hsk-1 | 口 𠂉 乙 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 同 | seuil-255, hsk-1 | 凡 口 | makemeahanzi | ≠ ⺆ 一 口 | ≠ 冂 一 口 | ≠ ⺆ 一 口 | relire : surcharge ou accepter |
| 名 | seuil-255, hsk-1 | 夕 口 | makemeahanzi | = | = | = | remplacer, identique |
| 吗 | seuil-255, hsk-1 | 口 马 | makemeahanzi | = | = | = | remplacer, identique |
| 吧 | seuil-255, hsk-1 | 口 巴 | makemeahanzi | = | = | = | remplacer, identique |
| 听 | seuil-255, hsk-1, interface | 口 斤 | makemeahanzi | = | = | = | remplacer, identique |
| 启 | rang | 户 口 | makemeahanzi | = | = | = | remplacer, identique |
| 告 | hsk-1 | 牛 口 | makemeahanzi | variante : 𠂒 口 | variante : 𠂒 口 | variante : 𠂒 口 | relire : autre variante du même groupe |
| 呢 | seuil-255, hsk-1 | 口 尸 匕 | makemeahanzi | = | = | = | remplacer, identique |
| 和 | seuil-255, hsk-1 | 禾 口 | makemeahanzi | = | = | = | remplacer, identique |
| 哥 | seuil-255, hsk-1 | 丁 口 丁 口 | makemeahanzi | = | = | = | remplacer, identique |
| 哪 | seuil-255, hsk-1 | 口 𭃂 阝 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 唱 | hsk-1 | 口 日 曰 | makemeahanzi | variante : 口 日 日 | variante : 口 日 日 | variante : 口 日 日 | relire : autre variante du même groupe |
| 商 | seuil-255, hsk-1 | 亠 丷 冂 八 口 | makemeahanzi | ≠ 亠 丷 ⺆ 八 口 | = | ≠ 亠 丷 ⺆ 八 口 | relire : surcharge ou accepter |
| 喜 | seuil-255, hsk-1 | 士 口 䒑 口 | makemeahanzi, surcharge | = | ≠ 士 口 艹 口 | = | remplacer, identique |
| 喝 | seuil-255, hsk-1 | 口 日 勹 人 𠃊 | makemeahanzi, cjk-decomp, surcharge | = | ordre : 口 日 勹 𠃊 人 | = | remplacer, identique |
| 回 | seuil-255, hsk-1 | 囗 口 | makemeahanzi | absent | = | = | remplacer, identique |
| 因 | seuil-255 | 囗 大 | makemeahanzi | = | = | = | remplacer, identique |
| 国 | seuil-255, hsk-1 | 囗 玉 | makemeahanzi | = | = | = | remplacer, identique |
| 图 | seuil-255, hsk-1 | 囗 夂 ⺀ | makemeahanzi | = | = | = | remplacer, identique |
| 圈 | conte | 囗 龹 㔾 | makemeahanzi | = | = | = | remplacer, identique |
| 圣 | conte | 又 土 | makemeahanzi | = | = | = | remplacer, identique |
| 在 | seuil-255, hsk-1 | 𠂇 丨 土 | surcharge | = | = | = | inchangée (hors LGPL) |
| 地 | seuil-255, hsk-1 | 土 也 | makemeahanzi | = | = | = | remplacer, identique |
| 场 | hsk-1 | 土 勿 | makemeahanzi | ≠ 土 𠃓 | ≠ 土 𠃓 | ≠ 土 𠃓 | relire : surcharge ou accepter |
| 坏 | hsk-1 | 土 不 | makemeahanzi | = | = | = | remplacer, identique |
| 坐 | seuil-255, hsk-1 | 人 人 土 | makemeahanzi | ordre : 土 人 人 | = | ordre : 土 人 人 | relire : ordre |
| 块 | seuil-255, hsk-1 | 土 夬 | makemeahanzi | = | = | = | remplacer, identique |
| 城 | seuil-255 | 土 丁 戈 | makemeahanzi | ≠ 土 万 戈 | ≠ 土 戊 𠃌 | ≠ 土 万 戈 | relire : surcharge ou accepter |
| 塞 | conte | 宀 𠀎 八 土 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 备 | hsk-1 | 夂 田 | makemeahanzi | = | = | = | remplacer, identique |
| 夏 | terme | 一 自 夂 | makemeahanzi | = | = | = | remplacer, identique |
| 外 | seuil-255, hsk-1 | 夕 卜 | makemeahanzi | = | = | = | remplacer, identique |
| 多 | seuil-255, hsk-1 | 夕 夕 | makemeahanzi | = | = | = | remplacer, identique |
| 夜 | terme | 亠 亻 夕 | makemeahanzi | ≠ 亠 亻 夂 丶 | ≠ 亠 亻 夂 丶 | ≠ 亠 亻 夂 丶 | relire : surcharge ou accepter |
| 奶 | hsk-1 | 女 乃 | makemeahanzi | = | = | = | remplacer, identique |
| 她 | seuil-255, hsk-1 | 女 也 | makemeahanzi | = | = | = | remplacer, identique |
| 好 | seuil-255, hsk-1 | 女 子 | makemeahanzi | = | = | = | remplacer, identique |
| 如 | seuil-255 | 女 口 | makemeahanzi | = | = | = | remplacer, identique |
| 妈 | seuil-255, hsk-1 | 女 马 | makemeahanzi | = | = | = | remplacer, identique |
| 妹 | hsk-1 | 女 未 | makemeahanzi | = | = | = | remplacer, identique |
| 姐 | hsk-1 | 女 且 | makemeahanzi | = | = | = | remplacer, identique |
| 姓 | seuil-255 | 女 生 | makemeahanzi | = | = | = | remplacer, identique |
| 字 | seuil-255, hsk-1 | 宀 子 | makemeahanzi | = | = | = | remplacer, identique |
| 孙 | conte | 子 小 | makemeahanzi | = | = | = | remplacer, identique |
| 学 | seuil-255, hsk-1, rang | 𭕄 子 | surcharge | = | = | = | inchangée (hors LGPL) |
| 孩 | seuil-255, hsk-1 | 子 亥 | makemeahanzi | = | = | = | remplacer, identique |
| 它 | seuil-255 | 宀 匕 | makemeahanzi | = | = | = | remplacer, identique |
| 完 | seuil-255 | 宀 二 儿 | makemeahanzi | = | ≠ 宀 一 兀 | = | remplacer, identique |
| 客 | hsk-1 | 宀 夂 口 | makemeahanzi | = | = | = | remplacer, identique |
| 家 | seuil-255, hsk-1 | 宀 豕 | makemeahanzi | = | = | = | remplacer, identique |
| 寒 | terme | 宀 𠀎 八 ⺀ | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 对 | seuil-255, hsk-1 | 又 寸 | makemeahanzi | = | = | = | remplacer, identique |
| 就 | seuil-255, hsk-1 | 京 尤 | makemeahanzi | = | = | = | remplacer, identique |
| 岁 | seuil-255, hsk-1 | 山 夕 | makemeahanzi | = | = | = | remplacer, identique |
| 左 | hsk-1 | 𠂇 工 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 差 | hsk-1 | 羊 工 | makemeahanzi | = | variante : 𦍌 工 | = | remplacer, identique |
| 布 | conte | 𠂇 巾 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 师 | seuil-255, hsk-1 | 刂 一 巾 | makemeahanzi | ≠ 丨 丨 一 巾 | écart : ？ 一 巾 | ≠ 丨 丨 一 巾 | relire : surcharge ou accepter |
| 帝 | conte | 立 巾 | makemeahanzi | ≠ 亠 丷 冖 巾 | écart : ？ 巾 | ≠ 亠 丷 冖 巾 | relire : surcharge ou accepter |
| 帮 | hsk-1 | 丰 阝 巾 | makemeahanzi | = | = | = | remplacer, identique |
| 常 | seuil-255, hsk-1 | ⺌ 冂 口 巾 | makemeahanzi | ≠ ⺌ 冖 口 巾 | ≠ ⺌ 冖 口 巾 | ≠ ⺌ 冖 口 巾 | relire : surcharge ou accepter |
| 床 | hsk-1 | 广 木 | makemeahanzi | = | = | = | remplacer, identique |
| 店 | seuil-255, hsk-1 | 广 ⺊ 口 | makemeahanzi | = | = | = | remplacer, identique |
| 张 | seuil-255 | 弓 长 | makemeahanzi | = | = | = | remplacer, identique |
| 弼 | conte | 弓 百 弓 | makemeahanzi | ordre : 弓 弓 百 | = | ordre : 弓 弓 百 | relire : ordre |
| 影 | seuil-255, hsk-1 | 日 京 彡 | makemeahanzi | = | = | = | remplacer, identique |
| 很 | seuil-255, hsk-1 | 彳 艮 | makemeahanzi | = | = | = | remplacer, identique |
| 得 | seuil-255, hsk-1 | 彳 日 一 寸 | makemeahanzi | = | = | = | remplacer, identique |
| 忘 | hsk-1 | 亡 心 | makemeahanzi | = | = | = | remplacer, identique |
| 忙 | seuil-255, hsk-1 | 忄 亡 | makemeahanzi | = | = | = | remplacer, identique |
| 快 | seuil-255, hsk-1 | 忄 夬 | makemeahanzi | = | = | = | remplacer, identique |
| 念 | seuil-255 | 今 心 | makemeahanzi | = | = | = | remplacer, identique |
| 怎 | seuil-255, hsk-1 | 乍 心 | makemeahanzi | = | = | = | remplacer, identique |
| 思 | seuil-255 | 田 心 | makemeahanzi | = | = | = | remplacer, identique |
| 息 | hsk-1 | 自 心 | makemeahanzi | = | = | = | remplacer, identique |
| 悟 | conte | 忄 五 口 | makemeahanzi | = | = | = | remplacer, identique |
| 您 | seuil-255, hsk-1 | 亻 ⺈ 小 心 | makemeahanzi | = | ≠ 亻 丿 乛 小 心 | = | remplacer, identique |
| 想 | seuil-255, hsk-1 | 木 目 心 | makemeahanzi | = | = | = | remplacer, identique |
| 意 | seuil-255 | 立 日 心 | makemeahanzi | = | = | = | remplacer, identique |
| 慢 | hsk-1 | 忄 日 罒 又 | makemeahanzi | = | = | = | remplacer, identique |
| 懂 | seuil-255 | 忄 艹 重 | makemeahanzi | ≠ 忄 卄 重 | = | ≠ 忄 卄 重 | relire : surcharge ou accepter |
| 房 | seuil-255, hsk-1 | 户 方 | makemeahanzi | = | = | = | remplacer, identique |
| 打 | seuil-255, hsk-1 | 扌 丁 | makemeahanzi | = | = | = | remplacer, identique |
| 找 | hsk-1 | 扌 戈 | makemeahanzi | = | = | = | remplacer, identique |
| 拼 | interface | 扌 丷 开 | makemeahanzi | = | = | = | remplacer, identique |
| 拿 | hsk-1 | 人 一 口 手 | makemeahanzi | = | écart : ？ 口 手 | = | remplacer, identique |
| 探 | rang | 扌 冖 八 木 | cjk-decomp, makemeahanzi | = | écart : 扌 ？ 木 | = | remplacer, identique |
| 提 | conte | 扌 日 一 龰 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 放 | hsk-1 | 方 攵 | makemeahanzi | ≠ 方 𠂉 乂 | = | ≠ 方 𠂉 乂 | relire : surcharge ou accepter |
| 教 | hsk-1 | 耂 子 攵 | makemeahanzi | ≠ 耂 子 𠂉 乂 | = | ≠ 耂 子 𠂉 乂 | relire : surcharge ou accepter |
| 新 | seuil-255, hsk-1 | 立 一 小 斤 | makemeahanzi | ≠ 立 十 小 斤 | ≠ 立 木 斤 | ≠ 立 十 小 斤 | relire : surcharge ou accepter |
| 旁 | hsk-1 | 立 方 | makemeahanzi | ≠ 亠 丷 冖 方 | écart : ？ 方 | ≠ 亠 丷 冖 方 | relire : surcharge ou accepter |
| 早 | seuil-255, hsk-1 | 日 十 | makemeahanzi | = | = | = | remplacer, identique |
| 时 | seuil-255, hsk-1 | 日 寸 | makemeahanzi | = | = | = | remplacer, identique |
| 明 | seuil-255, hsk-1, terme | 日 月 | makemeahanzi | = | = | = | remplacer, identique |
| 星 | seuil-255, hsk-1 | 日 生 | makemeahanzi | = | = | = | remplacer, identique |
| 春 | terme | 𡗗 日 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 昨 | seuil-255, hsk-1 | 日 乍 | makemeahanzi | = | = | = | remplacer, identique |
| 是 | seuil-255, hsk-1 | 日 一 龰 | surcharge | = | = | = | inchangée (hors LGPL) |
| 晚 | seuil-255, hsk-1 | 日 免 | makemeahanzi | = | = | = | remplacer, identique |
| 暑 | terme | 日 耂 日 | makemeahanzi | = | = | = | remplacer, identique |
| 最 | hsk-1 | 日 耳 又 | makemeahanzi | = | ≠ 冃 耳 又 | = | remplacer, identique |
| 有 | seuil-255, hsk-1 | 𠂇 月 | cjk-decomp | = | absent | = | inchangée (hors LGPL) |
| 朋 | seuil-255, hsk-1 | 月 月 | makemeahanzi | = | = | = | remplacer, identique |
| 服 | hsk-1 | 月 卩 又 | makemeahanzi | = | = | = | remplacer, identique |
| 期 | seuil-255, hsk-1 | 其 月 | makemeahanzi | = | = | = | remplacer, identique |
| 机 | seuil-255, hsk-1, conte | 木 几 | makemeahanzi | = | = | = | remplacer, identique |
| 李 | seuil-255 | 木 子 | makemeahanzi | = | = | = | remplacer, identique |
| 条 | hsk-1 | 夂 木 | makemeahanzi | ≠ 夂 十 小 | = | ≠ 夂 十 小 | relire : surcharge ou accepter |
| 杯 | seuil-255, hsk-1 | 木 不 | makemeahanzi | = | = | = | remplacer, identique |
| 林 | interface, rang | 木 木 | makemeahanzi | = | = | = | remplacer, identique |
| 树 | hsk-1, conte | 木 又 寸 | makemeahanzi | = | = | = | remplacer, identique |
| 校 | hsk-1 | 木 六 乂 | makemeahanzi | = | ≠ 木 亠 父 | = | remplacer, identique |
| 样 | seuil-255, hsk-1 | 木 羊 | makemeahanzi | = | = | = | remplacer, identique |
| 桃 | conte | 木 兆 | makemeahanzi | = | = | = | remplacer, identique |
| 桌 | hsk-1 | ⺊ 日 十 木 | makemeahanzi | ≠ ⺊ 日 木 | ≠ ⺊ 日 木 | ≠ ⺊ 日 木 | relire : surcharge ou accepter |
| 桥 | fête | 木 夭 丨 丨 | makemeahanzi, cjk-decomp, surcharge | = | ≠ 木 夭 丿 丨 | = | remplacer, identique |
| 桩 | conte | 木 广 土 | makemeahanzi | = | = | = | remplacer, identique |
| 梅 | terme | 木 𠂉 母 | makemeahanzi, cjk-decomp | = | = | = | remplacer, identique |
| 楼 | hsk-1 | 木 米 女 | makemeahanzi | = | = | = | remplacer, identique |
| 榜 | rang | 木 立 方 | makemeahanzi | ≠ 木 亠 丷 冖 方 | écart : 木 ？ 方 | ≠ 木 亠 丷 冖 方 | relire : surcharge ou accepter |
| 次 | hsk-1 | 冫 欠 | makemeahanzi | = | = | = | remplacer, identique |
| 欢 | seuil-255, hsk-1 | 又 欠 | makemeahanzi | = | = | = | remplacer, identique |
| 歌 | hsk-1 | 丁 口 丁 口 欠 | makemeahanzi | = | = | = | remplacer, identique |
| 每 | seuil-255 | 𠂉 母 | cjk-decomp | = | = | = | inchangée (hors LGPL) |
| 比 | seuil-255, hsk-1 | 匕 匕 | makemeahanzi | = | ≠ 乚 一 匕 | = | remplacer, identique |
| 汉 | seuil-255, hsk-1 | 氵 又 | makemeahanzi | = | = | = | remplacer, identique |
| 汽 | seuil-255, hsk-1 | 氵 气 | makemeahanzi | = | = | = | remplacer, identique |
| 没 | seuil-255, hsk-1 | 氵 殳 | makemeahanzi | = | = | = | remplacer, identique |
| 法 | seuil-255 | 氵 去 | makemeahanzi | = | = | = | remplacer, identique |
| 洗 | hsk-1 | 氵 𠂒 儿 | makemeahanzi, cjk-decomp, surcharge | = | = | = | remplacer, identique |
| 活 | seuil-255 | 氵 舌 | makemeahanzi | = | = | = | remplacer, identique |
| 海 | seuil-255, conte | 氵 𠂉 母 | makemeahanzi, cjk-decomp | = | = | = | remplacer, identique |
| 温 | interface, conte | 氵 日 皿 | makemeahanzi | = | = | = | remplacer, identique |
| 渴 | hsk-1 | 氵 日 勹 人 𠃊 | makemeahanzi, cjk-decomp, surcharge | = | ordre : 氵 日 勹 𠃊 人 | = | remplacer, identique |
| 满 | terme | 氵 艹 两 | makemeahanzi | ≠ 氵 卄 两 | = | ≠ 氵 卄 两 | relire : surcharge ou accepter |
| 灯 | fête | 火 丁 | makemeahanzi | = | = | = | remplacer, identique |
| 点 | seuil-255, hsk-1 | ⺊ 口 灬 | makemeahanzi | = | = | = | remplacer, identique |
| 热 | hsk-1, terme | 扌 丸 灬 | makemeahanzi | = | = | = | remplacer, identique |
| 爱 | seuil-255, hsk-1 | 爫 冖 𠂇 又 | makemeahanzi, cjk-decomp | = | = | = | remplacer, identique |
| 爷 | hsk-1 | 父 卩 | makemeahanzi | ≠ 父 𠃌 丨 | = | ≠ 父 𠃌 丨 | relire : surcharge ou accepter |
| 爸 | seuil-255, hsk-1 | 父 巴 | makemeahanzi | = | = | = | remplacer, identique |
| 状 | rang | 丬 犬 | makemeahanzi | = | = | = | remplacer, identique |
| 狐 | conte | 犭 瓜 | makemeahanzi | = | = | = | remplacer, identique |
| 狲 | conte | 犭 子 小 | makemeahanzi | = | = | = | remplacer, identique |
| 狸 | conte | 犭 里 | makemeahanzi | = | = | = | remplacer, identique |
| 狼 | conte | 犭 丶 艮 | makemeahanzi | ordre : 犭 艮 丶 | = | ordre : 犭 艮 丶 | relire : ordre |
| 猢 | conte | 犭 十 口 月 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 玩 | seuil-255, hsk-1, interface | 王 二 儿 | makemeahanzi | = | ≠ 𤣩 一 兀 | = | remplacer, identique |
| 现 | seuil-255, hsk-1 | 王 见 | makemeahanzi | = | ≠ 𤣩 见 | = | remplacer, identique |
| 班 | hsk-1 | 王 刂 王 | makemeahanzi | ≠ 王 王 丿 丶 | ≠ 𤣩 丶 丿 王 | ≠ 王 王 丿 丶 | relire : surcharge ou accepter |
| 球 | hsk-1 | 王 求 | makemeahanzi | = | ≠ 𤣩 求 | = | remplacer, identique |
| 男 | seuil-255, hsk-1 | 田 力 | makemeahanzi | = | = | = | remplacer, identique |
| 画 | seuil-255 | 一 凵 田 | makemeahanzi | ordre : 一 田 凵 | = | ordre : 一 田 凵 | relire : ordre |
| 病 | seuil-255, hsk-1 | 疒 丙 | makemeahanzi | = | = | = | remplacer, identique |
| 的 | seuil-255, hsk-1 | 白 勺 | makemeahanzi | = | = | = | remplacer, identique |
| 皇 | conte | 白 王 | makemeahanzi | = | = | = | remplacer, identique |
| 盲 | conte | 亡 目 | makemeahanzi | = | = | = | remplacer, identique |
| 看 | seuil-255, hsk-1 | 手 目 | makemeahanzi | = | = | = | remplacer, identique |
| 真 | hsk-1 | 直 几 | makemeahanzi | ≠ 十 具 | ≠ 十 目 一 八 | ≠ 十 具 | relire : surcharge ou accepter |
| 眼 | rang | 目 艮 | makemeahanzi | = | = | = | remplacer, identique |
| 着 | hsk-1 | 羊 目 | makemeahanzi | = | variante : 𦍌 目 | = | remplacer, identique |
| 睡 | hsk-1 | 目 垂 | makemeahanzi | = | = | = | remplacer, identique |
| 知 | seuil-255, hsk-1 | 矢 口 | makemeahanzi | = | = | = | remplacer, identique |
| 神 | conte | 礻 申 | makemeahanzi | = | = | = | remplacer, identique |
| 票 | seuil-255, hsk-1 | 覀 示 | makemeahanzi | = | = | = | remplacer, identique |
| 福 | fête | 礻 一 口 田 | makemeahanzi | = | = | = | remplacer, identique |
| 秀 | rang | 禾 乃 | makemeahanzi | = | = | = | remplacer, identique |
| 秋 | terme | 禾 火 | makemeahanzi | = | = | = | remplacer, identique |
| 空 | conte | 穴 工 | makemeahanzi | = | absent | = | remplacer, identique |
| 穿 | hsk-1 | 穴 牙 | makemeahanzi | = | = | = | remplacer, identique |
| 站 | hsk-1 | 立 ⺊ 口 | makemeahanzi | = | = | = | remplacer, identique |
| 童 | rang | 立 里 | makemeahanzi | = | = | = | remplacer, identique |
| 笑 | hsk-1 | ⺮ 夭 | makemeahanzi | = | ≡ 𥫗 夭 | = | remplacer, identique |
| 笔 | seuil-255 | ⺮ 毛 | makemeahanzi | = | ≡ 𥫗 毛 | = | remplacer, identique |
| 第 | hsk-1 | ⺮ 弟 | makemeahanzi | variante : ⺮ 𢎨 | variante : 𥫗 𢎨 | variante : ⺮ 𢎨 | relire : autre variante du même groupe |
| 等 | hsk-1 | ⺮ 土 寸 | makemeahanzi | = | ≡ 𥫗 土 寸 | = | remplacer, identique |
| 筋 | conte | ⺮ 月 力 | makemeahanzi, surcharge | = | ≡ 𥫗 月 力 | = | remplacer, identique |
| 答 | hsk-1 | ⺮ 人 一 口 | makemeahanzi | = | écart : 𥫗 ？ 口 | = | remplacer, identique |
| 筷 | seuil-255 | ⺮ 忄 夬 | makemeahanzi | = | ≡ 𥫗 忄 夬 | = | remplacer, identique |
| 粽 | fête | 米 宀 示 | makemeahanzi | = | = | = | remplacer, identique |
| 系 | hsk-1 | 丿 糸 | makemeahanzi | = | = | = | remplacer, identique |
| 累 | seuil-255, hsk-1 | 田 糸 | makemeahanzi | = | = | = | remplacer, identique |
| 红 | seuil-255 | 纟 工 | makemeahanzi | = | = | = | remplacer, identique |
| 织 | conte | 纟 口 八 | makemeahanzi | = | = | = | remplacer, identique |
| 绍 | hsk-1 | 纟 刀 口 | makemeahanzi | = | = | = | remplacer, identique |
| 给 | seuil-255, hsk-1 | 纟 人 一 口 | makemeahanzi | = | écart : 纟 ？ 口 | = | remplacer, identique |
| 网 | hsk-1 | 冂 乂 乂 | makemeahanzi | ≠ ⺆ 乂 乂 | = | ≠ ⺆ 乂 乂 | relire : surcharge ou accepter |
| 美 | seuil-255 | 羊 大 | makemeahanzi | = | variante : 𦍌 大 | = | remplacer, identique |
| 翁 | conte | 八 厶 习 习 | makemeahanzi | = | écart : 八 厶 羽 | = | remplacer, identique |
| 翰 | rang | 十 日 十 人 习 习 | makemeahanzi | = | écart : 十 日 十 人 羽 | = | remplacer, identique |
| 考 | hsk-1 | 耂 丂 | makemeahanzi | = | = | = | remplacer, identique |
| 能 | seuil-255, hsk-1 | 厶 月 匕 匕 | makemeahanzi, surcharge | = | variante : 厶 ⺝ 匕 匕 | = | remplacer, identique |
| 脑 | hsk-1 | 月 亠 凵 乂 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 花 | seuil-255, hsk-1, rang | 艹 亻 匕 | makemeahanzi | ≠ 卄 亻 匕 | ≠ 艹 亻 乚 丿 | ≠ 卄 亻 匕 | relire : surcharge ou accepter |
| 苗 | conte | 艹 田 | makemeahanzi | ≠ 卄 田 | = | ≠ 卄 田 | relire : surcharge ou accepter |
| 茶 | seuil-255, hsk-1 | 艹 人 木 | makemeahanzi | ≠ 卄 人 十 小 | écart : 艹 人 一 亅 八 | ≠ 卄 人 十 小 | relire : surcharge ou accepter |
| 菊 | fête | 艹 勹 米 | makemeahanzi | ≠ 卄 勹 米 | = | ≠ 卄 勹 米 | relire : surcharge ou accepter |
| 菜 | seuil-255, hsk-1 | 艹 爫 木 | makemeahanzi | ≠ 卄 爫 木 | = | ≠ 卄 爫 木 | relire : surcharge ou accepter |
| 菩 | conte | 艹 立 口 | makemeahanzi | ≠ 卄 立 口 | = | ≠ 卄 立 口 | relire : surcharge ou accepter |
| 蒙 | rang | 艹 冖 一 豕 | makemeahanzi | ≠ 卄 冖 二 𧰨 | = | ≠ 卄 冖 二 𧰨 | relire : surcharge ou accepter |
| 虎 | conte | 虍 几 | makemeahanzi | = | ≠ 虍 儿 | = | remplacer, identique |
| 蛇 | conte | 虫 宀 匕 | makemeahanzi | = | = | = | remplacer, identique |
| 蛋 | hsk-1 | 乛 龰 虫 | makemeahanzi, cjk-decomp, surcharge | = | = | = | remplacer, identique |
| 蛙 | conte | 虫 土 土 | makemeahanzi | = | = | = | remplacer, identique |
| 蟠 | conte | 虫 釆 田 | makemeahanzi, cjk-decomp | = | = | = | remplacer, identique |
| 行 | hsk-1 | 彳 一 丁 | makemeahanzi | écart : 彳 二 ㇚ | = | écart : 彳 二 ㇚ | surcharge à écrire |
| 要 | seuil-255, hsk-1 | 覀 女 | makemeahanzi | = | = | = | remplacer, identique |
| 视 | hsk-1 | 礻 见 | makemeahanzi | = | = | = | remplacer, identique |
| 觉 | seuil-255, hsk-1 | 𭕄 见 | surcharge | = | = | = | inchangée (hors LGPL) |
| 认 | seuil-255, hsk-1 | 讠 人 | makemeahanzi | = | = | = | remplacer, identique |
| 让 | seuil-255 | 讠 上 | makemeahanzi | = | = | = | remplacer, identique |
| 记 | hsk-1 | 讠 己 | makemeahanzi | = | = | = | remplacer, identique |
| 许 | seuil-255 | 讠 午 | makemeahanzi | = | = | = | remplacer, identique |
| 识 | seuil-255, hsk-1 | 讠 口 八 | makemeahanzi | = | = | = | remplacer, identique |
| 诉 | hsk-1 | 讠 斥 | makemeahanzi | = | = | = | remplacer, identique |
| 试 | hsk-1 | 讠 弋 工 | makemeahanzi | = | = | = | remplacer, identique |
| 话 | seuil-255, hsk-1 | 讠 舌 | makemeahanzi | = | = | = | remplacer, identique |
| 语 | seuil-255, hsk-1 | 讠 五 口 | makemeahanzi | = | = | = | remplacer, identique |
| 说 | seuil-255, hsk-1, interface | 讠 丷 口 儿 | makemeahanzi | = | = | = | remplacer, identique |
| 请 | seuil-255, hsk-1 | 讠 龶 月 | makemeahanzi | = | écart : 讠 青 | = | remplacer, identique |
| 读 | hsk-1, interface | 讠 十 乛 头 | makemeahanzi | = | = | = | remplacer, identique |
| 课 | seuil-255, hsk-1 | 讠 果 | makemeahanzi | = | = | = | remplacer, identique |
| 谁 | seuil-255, hsk-1 | 讠 隹 | makemeahanzi | = | = | = | remplacer, identique |
| 谜 | interface | 讠 辶 米 | makemeahanzi | = | = | = | remplacer, identique |
| 谢 | seuil-255, hsk-1 | 讠 身 寸 | makemeahanzi | = | = | = | remplacer, identique |
| 贡 | rang | 工 贝 | makemeahanzi | = | = | = | remplacer, identique |
| 贵 | seuil-255, hsk-1 | 中 一 贝 | makemeahanzi | = | = | = | remplacer, identique |
| 走 | seuil-255, hsk-1 | 土 止 | makemeahanzi | variante : 土 龰 | variante : 土 龰 | variante : 土 龰 | relire : autre variante du même groupe |
| 起 | hsk-1 | 土 止 己 | makemeahanzi | variante : 土 龰 己 | variante : 土 龰 己 | variante : 土 龰 己 | relire : autre variante du même groupe |
| 跑 | hsk-1 | 口 龰 勹 巳 | makemeahanzi, cjk-decomp | variante : 口 止 勹 巳 | variante : 口 止 勹 巳 | variante : 口 止 勹 巳 | relire : autre variante du même groupe |
| 跟 | seuil-255, hsk-1 | 口 龰 艮 | makemeahanzi, cjk-decomp | variante : 口 止 艮 | variante : 口 止 艮 | variante : 口 止 艮 | relire : autre variante du même groupe |
| 路 | hsk-1 | 口 龰 夂 口 | makemeahanzi, cjk-decomp | variante : 口 止 夂 口 | variante : 口 止 夂 口 | variante : 口 止 夂 口 | relire : autre variante du même groupe |
| 边 | seuil-255, hsk-1 | 辶 力 | makemeahanzi | = | = | = | remplacer, identique |
| 过 | seuil-255, hsk-1 | 辶 寸 | makemeahanzi | = | = | = | remplacer, identique |
| 近 | seuil-255 | 辶 斤 | makemeahanzi | = | = | = | remplacer, identique |
| 还 | seuil-255, hsk-1 | 辶 不 | makemeahanzi | = | = | = | remplacer, identique |
| 这 | seuil-255, hsk-1 | 辶 文 | makemeahanzi | = | = | = | remplacer, identique |
| 进 | seuil-255, hsk-1, rang | 辶 井 | makemeahanzi | = | = | = | remplacer, identique |
| 远 | seuil-255, hsk-1 | 辶 二 儿 | makemeahanzi | = | ≠ 辶 一 兀 | = | remplacer, identique |
| 送 | hsk-1 | 辶 丷 天 | makemeahanzi | = | absent | = | remplacer, identique |
| 道 | seuil-255, hsk-1 | 辶 首 | makemeahanzi | = | = | = | remplacer, identique |
| 那 | seuil-255, hsk-1 | 𭃂 阝 | surcharge | = | = | = | inchangée (hors LGPL) |
| 都 | seuil-255, hsk-1 | 耂 日 阝 | makemeahanzi | = | = | = | remplacer, identique |
| 酒 | seuil-255 | 氵 酉 | makemeahanzi | = | = | = | remplacer, identique |
| 钱 | seuil-255, hsk-1 | 钅 戋 | makemeahanzi | = | = | = | remplacer, identique |
| 链 | interface | 钅 辶 车 | makemeahanzi | = | = | = | remplacer, identique |
| 错 | hsk-1 | 钅 廿 日 | makemeahanzi | ≠ 钅 龷 日 | ≠ 钅 龷 日 | ≠ 钅 龷 日 | relire : surcharge ou accepter |
| 问 | seuil-255, hsk-1 | 门 口 | makemeahanzi | = | = | = | remplacer, identique |
| 间 | seuil-255, hsk-1 | 门 日 | makemeahanzi | = | = | = | remplacer, identique |
| 院 | hsk-1 | 阝 宀 二 儿 | makemeahanzi | = | ≠ 阝 宀 一 兀 | = | remplacer, identique |
| 难 | seuil-255, hsk-1 | 又 隹 | makemeahanzi | = | = | = | remplacer, identique |
| 雪 | terme | 雨 彐 | makemeahanzi | = | ≠ 雨 𫜹 | = | remplacer, identique |
| 零 | hsk-1 | 雨 人 丶 龴 | makemeahanzi, cjk-decomp, surcharge | = | écart : 雨 令 | = | remplacer, identique |
| 雷 | terme | 雨 田 | makemeahanzi | = | = | = | remplacer, identique |
| 霜 | terme | 雨 木 目 | makemeahanzi | = | = | = | remplacer, identique |
| 露 | terme | 雨 口 龰 夂 口 | makemeahanzi, cjk-decomp | variante : 雨 口 止 夂 口 | variante : 雨 口 止 夂 口 | variante : 雨 口 止 夂 口 | relire : autre variante du même groupe |
| 青 | conte | 龶 月 | makemeahanzi | = | absent | = | remplacer, identique |
| 须 | conte | 彡 页 | makemeahanzi | = | = | = | remplacer, identique |
| 题 | seuil-255 | 日 一 龰 页 | makemeahanzi, surcharge | = | = | = | remplacer, identique |
| 饭 | seuil-255, hsk-1 | 饣 厂 又 | makemeahanzi | = | ≠ 饣 𠂆 又 | = | remplacer, identique |
| 饿 | hsk-1 | 饣 我 | makemeahanzi | = | = | = | remplacer, identique |
| 馆 | seuil-255, hsk-1 | 饣 宀 㠯 | makemeahanzi | = | = | = | remplacer, identique |
| 鸡 | hsk-1 | 又 鸟 | makemeahanzi | = | = | = | remplacer, identique |
| 麦 | terme | 龶 夂 | makemeahanzi | = | = | = | remplacer, identique |
| 鼻 | conte | 自 田 丌 | makemeahanzi | = | absent | = | remplacer, identique |
| 齐 | conte | 文 丨 丨 | cjk-decomp, surcharge | = | ≠ 文 丿 丨 | = | inchangée (hors LGPL) |
