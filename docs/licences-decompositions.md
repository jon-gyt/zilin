# Licence des décompositions, caractère par caractère

Produit par `uv run wenlu licences` (`data/src/wenlu_data/licences.py`) ; ne pas modifier à la main. La décision et son historique sont dans `docs/sources-licences.md` §10 ; ce fichier en est la recette.

Version exportée relue : `0.1.0`. Chaîne de la décomposition : nos surcharges (`data/sources/surcharges/ids.tsv`, rédigées pour Wenlu d'après GF 0014-2009), puis cjk-decomp (MIT), formes de notation ramenées à la norme (`notation-candidats.tsv`). Make Me a Hanzi (`dictionary.txt`, LGPL) n'en fait plus partie.

## Sources lues

| Fichier | SHA-256 |
|---|---|
| `ids-secondaires.json (cjk-decomp)` | `d953f60b251e3e8d…` |
| `ids.tsv (surcharges)` | `8985cb87f405e6dd…` |

## Décompte

- 598 caractères exportés, dont 268 composants de la norme (briques et feuilles découpées : `parts` vide, rien à décomposer, GF 0014-2009 seule) et 330 caractères décomposés.
- Source de la décomposition, sur ces derniers :
  - cjk-decomp (MIT) : 233
  - nos surcharges : 60
  - cjk-decomp (MIT) et nos surcharges : 37
- Décompositions qui nomment encore `dictionary.txt` (LGPL) : 0.
- Recette : la chaîne redonne les `parts` exportés et la structure du build pour 330 caractères sur 330.
- Lignes de surcharge qui portent un caractère exporté : 60 ; dont superflues (cjk-decomp rend déjà la même chose) : 前 告 场 常 是 真 第 走 错.

## Autres emprunts à Make Me a Hanzi

| Quoi | Source | Licence | Embarqué | Détail |
|---|---|---|---|---|
| décomposition (`parts`, `sources`) | dictionary.txt (chaîne IDS) | LGPL 3.0+ | non | 0 caractères exportés : plus aucun ; `dictionary.txt` n'est plus lu par `wenlu build`, son IDS n'est plus ingéré |
| pinyin de repli d'une fiche relue (hors Unihan et `pinyin.tsv`) | dictionary.txt (`pinyin`), par le contexte de la fiche | fait, non protégeable | non | 0 caractères |
| tracés et médianes (`traits/`) | graphics.txt | Arphic Public License | oui | 597 caractères dans 268 fichiers, dont 22 composants découpés dans un hôte (glyphes modifiés, `MODIFICATIONS.md`) |
| tracés de repli (`app/public/strokes-demo.json`) | graphics.txt | Arphic Public License | oui | 89 caractères, avec en-tête de licence |
| marque et icônes (`app/public/icons/`) | graphics.txt (文) | Arphic Public License | oui | tracés de 文 recopiés par `app/scripts/icons.mjs`, mention en commentaire du SVG |
| univers du graphe et genre `brique` (composant dessiné) | graphics.txt (liste des caractères) | fait, non protégeable | non | 244 briques exportées ; seule la présence du caractère est lue |
| ordre des parcours | `data/sources/parcours/ordre-*.tsv`, figé le 28 septembre 2026 | nôtre | non | l'ordre de la 0.1.0, alors compté sur les décompositions de `dictionary.txt` (un décompte de dépendants, pas une reprise), désormais versionné et relu |
| contexte des fiches : rôle probable, type et indice d'étymologie | dictionary.txt (`etymology`) | LGPL 3.0+ | non | 478 caractères exportés en ont un ; donnés au rédacteur comme indices à vérifier, jamais recopiés ; seuls les rôles relus entrent dans l'export |
| contrôle du pinyin de la cuisine | dictionary.txt (`pinyin`) | LGPL 3.0+ | non | contrôle seulement ; le pinyin exporté vient d'Unihan et des surcharges |

## Composants de la norme (rien à décomposer)

268 caractères : leur `parts` est vide, la table GF 0014-2009 seule les définit. Seuls leurs tracés viennent de Make Me a Hanzi (`graphics.txt`, APL).

⺀ ⺈ ⺊ ⺌ ⺍ ⺮ ⿰丿丨 ⿰𠄌丶 ⿳亠丷冖 ⿴夂丶 リ ㇠ 㔾 㠯 䒑 一 丁 丂 七 丆 三 上 下 丌 不 与 且 丙 东 两 丨 丩 个 丬 中 丰 丶 丷 丸 为 主 丿 乂 乃 么 乍 乙 乛 九 也 习 书 了 争 事 二 云 五 井 亠 亡 亥 亦 京 人 亻 今 儿 兆 免 八 六 其 具 冂 再 冖 冫 几 凵 出 刀 刂 力 办 勹 勺 匕 匚 十 午 半 南 卜 卩 厂 厶 去 又 叚 口 后 囗 四 土 垂 士 夂 夕 大 天 太 夫 夬 夭 头 女 子 宀 寸 小 少 尤 尸 山 工 己 巳 巴 巾 干 年 广 廾 开 弋 弓 弟 彐 彡 彳 心 忄 戈 戋 我 户 手 扌 才 攵 文 斗 斤 斥 方 日 曰 曲 月 木 未 本 来 果 欠 止 正 殳 母 毛 气 水 氵 求 火 灬 爫 父 牙 牛 犬 犭 玉 王 瓜 生 用 田 申 电 疒 白 百 皿 目 矢 示 礻 禾 穴 立 米 糸 纟 罒 羊 老 耂 耳 肉 自 至 舌 艮 艹 虍 虫 衣 西 覀 见 言 讠 谷 豕 贝 身 车 辶 酉 釆 里 重 钅 长 门 阝 隹 雨 非 面 页 风 飞 饣 首 马 高 鸟 龟 龰 龴 龶 龷 龹 𠀎 𠂇 𠂉 𠂒 𠃊 𠃍 𠃓 𡗗 𢎨 𭃂 𭕄 𰀁

## Caractères décomposés

Lecture : `=` identique aux `parts` exportés ; `≡` mêmes composants de la norme, autre point de code ; `variante :` même groupe de la norme à chaque place ; `ordre :` mêmes composants, autre ordre ; `≠` composants différents ; `écart :` feuille hors norme ; `absent` : la source ne décrit pas le caractère. « Sans sa ligne » : cjk-decomp à la place de la surcharge du caractère (les autres lignes restent) — ce que la ligne corrige ; `·` : pas de ligne.

| Caractère | Motif | `parts` exportés | `sources` | Chaîne | Sans sa ligne |
|---|---|---|---|---|---|
| 举 | rang | ⺍ 一 八 𰀁 | surcharge | = | écart : ⺍ 一 八 二 丨 |
| 买 | seuil-255, hsk-1 | 乛 头 | cjk-decomp, surcharge | = | · |
| 些 | seuil-255, hsk-1 | 止 匕 二 | cjk-decomp | = | · |
| 亲 | seuil-255 | 立 一 小 | surcharge | = | ≠ 立 十 小 |
| 什 | seuil-255, hsk-1 | 亻 十 | cjk-decomp | = | · |
| 介 | hsk-1 | 人 ⿰丿丨 | surcharge | = | ≠ 人 丨 丨 |
| 从 | seuil-255, hsk-1 | 人 人 | cjk-decomp | = | · |
| 他 | seuil-255, hsk-1 | 亻 也 | cjk-decomp | = | · |
| 仙 | conte | 亻 山 | cjk-decomp | = | · |
| 以 | seuil-255 | ⿰𠄌丶 人 | surcharge | = | absent |
| 们 | seuil-255, hsk-1 | 亻 门 | cjk-decomp | = | · |
| 休 | hsk-1 | 亻 木 | cjk-decomp | = | · |
| 会 | seuil-255, hsk-1 | 人 云 | cjk-decomp | = | · |
| 住 | seuil-255, hsk-1 | 亻 主 | cjk-decomp | = | · |
| 体 | hsk-1 | 亻 本 | cjk-decomp | = | · |
| 作 | seuil-255, hsk-1 | 亻 乍 | cjk-decomp | = | · |
| 你 | seuil-255, hsk-1 | 亻 ⺈ 小 | cjk-decomp | = | · |
| 信 | seuil-255 | 亻 言 | cjk-decomp | = | · |
| 候 | seuil-255, hsk-1 | 亻 丨 𠃍 一 矢 | surcharge | = | absent |
| 假 | hsk-1 | 亻 叚 | cjk-decomp | = | · |
| 做 | hsk-1 | 亻 十 口 攵 | surcharge | = | ≠ 亻 十 口 𠂉 乂 |
| 偷 | conte | 亻 人 一 月 刂 | cjk-decomp, surcharge | = | · |
| 元 | hsk-1, rang | 二 儿 | cjk-decomp | = | · |
| 先 | seuil-255, hsk-1 | 𠂒 儿 | cjk-decomp, surcharge | = | · |
| 兔 | conte | 免 丶 | cjk-decomp, surcharge | = | · |
| 公 | conte | 八 厶 | cjk-decomp | = | · |
| 兰 | conte | 丷 三 | cjk-decomp | = | · |
| 关 | seuil-255, hsk-1 | 丷 天 | cjk-decomp | = | · |
| 兴 | seuil-255, hsk-1 | ⺍ 一 八 | surcharge | = | = |
| 典 | interface | 曲 八 | cjk-decomp | = | · |
| 写 | seuil-255, hsk-1, interface | 冖 与 | cjk-decomp | = | · |
| 冬 | seuil-255, fête, terme | 夂 ⺀ | cjk-decomp | = | · |
| 冰 | terme | 冫 水 | cjk-decomp | = | · |
| 冷 | seuil-255, hsk-1, terme | 冫 人 丶 龴 | cjk-decomp, surcharge | = | · |
| 净 | hsk-1 | 冫 争 | cjk-decomp | = | · |
| 准 | hsk-1 | 冫 隹 | cjk-decomp | = | · |
| 凉 | terme | 冫 京 | cjk-decomp | = | · |
| 分 | seuil-255, hsk-1, terme | 八 刀 | cjk-decomp | = | · |
| 刚 | seuil-255 | 冂 乂 刂 | cjk-decomp, surcharge | = | · |
| 别 | seuil-255, hsk-1 | 口 力 刂 | cjk-decomp | = | · |
| 到 | seuil-255, hsk-1 | 至 刂 | cjk-decomp | = | · |
| 前 | seuil-255, hsk-1 | 䒑 月 刂 | surcharge | = | = |
| 动 | hsk-1 | 云 力 | cjk-decomp | = | · |
| 包 | hsk-1 | 勹 巳 | surcharge | = | = |
| 北 | seuil-255, hsk-1 | 匕 匕 | cjk-decomp | = | · |
| 医 | hsk-1 | 匚 矢 | cjk-decomp | = | · |
| 卖 | seuil-255 | 十 乛 头 | cjk-decomp, surcharge | = | · |
| 友 | seuil-255, hsk-1 | 𠂇 又 | cjk-decomp | = | · |
| 双 | interface | 又 又 | cjk-decomp | = | · |
| 古 | seuil-255 | 十 口 | cjk-decomp | = | · |
| 只 | seuil-255 | 口 八 | cjk-decomp | = | · |
| 叫 | seuil-255, hsk-1 | 口 丩 | cjk-decomp | = | · |
| 可 | seuil-255 | 丁 口 | surcharge | = | = |
| 右 | hsk-1 | 𠂇 口 | cjk-decomp | = | · |
| 叶 | conte | 口 十 | cjk-decomp | = | · |
| 号 | hsk-1 | 口 丂 | cjk-decomp | = | · |
| 吃 | seuil-255, hsk-1 | 口 𠂉 乙 | cjk-decomp, surcharge | = | · |
| 同 | seuil-255, hsk-1 | 冂 一 口 | surcharge | = | ≠ ⺆ 一 口 |
| 名 | seuil-255, hsk-1 | 夕 口 | cjk-decomp | = | · |
| 吗 | seuil-255, hsk-1 | 口 马 | cjk-decomp | = | · |
| 吧 | seuil-255, hsk-1 | 口 巴 | cjk-decomp | = | · |
| 听 | seuil-255, hsk-1, interface | 口 斤 | cjk-decomp | = | · |
| 启 | rang | 户 口 | cjk-decomp | = | · |
| 告 | hsk-1 | 𠂒 口 | surcharge | = | = |
| 呢 | seuil-255, hsk-1 | 口 尸 匕 | cjk-decomp | = | · |
| 和 | seuil-255, hsk-1 | 禾 口 | cjk-decomp | = | · |
| 哥 | seuil-255, hsk-1 | 丁 口 丁 口 | cjk-decomp, surcharge | = | · |
| 哪 | seuil-255, hsk-1 | 口 𭃂 阝 | cjk-decomp, surcharge | = | · |
| 唱 | hsk-1 | 口 日 曰 | surcharge | = | variante : 口 日 日 |
| 商 | seuil-255, hsk-1 | 亠 丷 冂 八 口 | surcharge | = | ≠ 亠 丷 ⺆ 八 口 |
| 喜 | seuil-255, hsk-1 | 士 口 䒑 口 | surcharge | = | = |
| 喝 | seuil-255, hsk-1 | 口 日 勹 人 𠃊 | cjk-decomp, surcharge | = | · |
| 回 | seuil-255, hsk-1 | 囗 口 | surcharge | = | absent |
| 因 | seuil-255 | 囗 大 | cjk-decomp | = | · |
| 国 | seuil-255, hsk-1 | 囗 玉 | cjk-decomp | = | · |
| 图 | seuil-255, hsk-1 | 囗 夂 ⺀ | cjk-decomp | = | · |
| 圈 | conte | 囗 龹 㔾 | cjk-decomp | = | · |
| 圣 | conte | 又 土 | cjk-decomp | = | · |
| 在 | seuil-255, hsk-1 | 𠂇 丨 土 | surcharge | = | ≠ 𠂇 亻 土 |
| 地 | seuil-255, hsk-1 | 土 也 | cjk-decomp | = | · |
| 场 | hsk-1 | 土 𠃓 | surcharge | = | = |
| 坏 | hsk-1 | 土 不 | cjk-decomp | = | · |
| 坐 | seuil-255, hsk-1 | 人 人 土 | surcharge | = | ordre : 土 人 人 |
| 块 | seuil-255, hsk-1 | 土 夬 | cjk-decomp | = | · |
| 城 | seuil-255 | 土 丁 戈 | surcharge | = | ≠ 土 万 戈 |
| 塞 | conte | 宀 𠀎 八 土 | cjk-decomp | = | · |
| 备 | hsk-1 | 夂 田 | cjk-decomp | = | · |
| 夏 | terme | 丆 目 夂 | surcharge | = | ≠ 一 自 夂 |
| 外 | seuil-255, hsk-1 | 夕 卜 | cjk-decomp | = | · |
| 多 | seuil-255, hsk-1 | 夕 夕 | cjk-decomp | = | · |
| 夜 | terme | 亠 亻 ⿴夂丶 | surcharge | = | ≠ 亠 亻 夂 丶 |
| 奶 | hsk-1 | 女 乃 | cjk-decomp | = | · |
| 她 | seuil-255, hsk-1 | 女 也 | cjk-decomp | = | · |
| 好 | seuil-255, hsk-1 | 女 子 | cjk-decomp | = | · |
| 如 | seuil-255 | 女 口 | cjk-decomp | = | · |
| 妈 | seuil-255, hsk-1 | 女 马 | cjk-decomp | = | · |
| 妹 | hsk-1 | 女 未 | cjk-decomp | = | · |
| 姐 | hsk-1 | 女 且 | cjk-decomp | = | · |
| 姓 | seuil-255 | 女 生 | cjk-decomp | = | · |
| 字 | seuil-255, hsk-1 | 宀 子 | cjk-decomp | = | · |
| 孙 | conte | 子 小 | cjk-decomp | = | · |
| 学 | seuil-255, hsk-1, rang | 𭕄 子 | surcharge | = | écart : ⺍ 冖 子 |
| 孩 | seuil-255, hsk-1 | 子 亥 | cjk-decomp | = | · |
| 它 | seuil-255 | 宀 匕 | cjk-decomp | = | · |
| 完 | seuil-255 | 宀 二 儿 | cjk-decomp | = | · |
| 客 | hsk-1 | 宀 夂 口 | cjk-decomp | = | · |
| 家 | seuil-255, hsk-1 | 宀 豕 | cjk-decomp | = | · |
| 寒 | terme | 宀 𠀎 八 ⺀ | cjk-decomp | = | · |
| 对 | seuil-255, hsk-1 | 又 寸 | cjk-decomp | = | · |
| 就 | seuil-255, hsk-1 | 京 尤 | cjk-decomp | = | · |
| 岁 | seuil-255, hsk-1 | 山 夕 | cjk-decomp | = | · |
| 左 | hsk-1 | 𠂇 工 | cjk-decomp | = | · |
| 差 | hsk-1 | 羊 工 | cjk-decomp | = | · |
| 布 | conte | 𠂇 巾 | cjk-decomp | = | · |
| 师 | seuil-255, hsk-1 | リ 一 巾 | surcharge | = | ≠ 丨 丨 一 巾 |
| 帝 | conte | ⿳亠丷冖 巾 | surcharge | = | ≠ 亠 丷 冖 巾 |
| 帮 | hsk-1 | 丰 阝 巾 | cjk-decomp | = | · |
| 常 | seuil-255, hsk-1 | ⺌ 冖 口 巾 | surcharge | = | = |
| 床 | hsk-1 | 广 木 | cjk-decomp | = | · |
| 店 | seuil-255, hsk-1 | 广 ⺊ 口 | cjk-decomp | = | · |
| 弈 | conte | 亦 廾 | surcharge | = | ≠ 亦 卄 |
| 张 | seuil-255 | 弓 长 | cjk-decomp | = | · |
| 弼 | conte | 弓 百 弓 | surcharge | = | ordre : 弓 弓 百 |
| 影 | seuil-255, hsk-1 | 日 京 彡 | cjk-decomp | = | · |
| 很 | seuil-255, hsk-1 | 彳 艮 | cjk-decomp | = | · |
| 得 | seuil-255, hsk-1 | 彳 日 一 寸 | cjk-decomp, surcharge | = | · |
| 忘 | hsk-1 | 亡 心 | cjk-decomp | = | · |
| 忙 | seuil-255, hsk-1 | 忄 亡 | cjk-decomp | = | · |
| 快 | seuil-255, hsk-1 | 忄 夬 | cjk-decomp | = | · |
| 念 | seuil-255 | 今 心 | cjk-decomp | = | · |
| 怎 | seuil-255, hsk-1 | 乍 心 | cjk-decomp | = | · |
| 思 | seuil-255 | 田 心 | cjk-decomp | = | · |
| 息 | hsk-1 | 自 心 | cjk-decomp | = | · |
| 悟 | conte | 忄 五 口 | cjk-decomp | = | · |
| 您 | seuil-255, hsk-1 | 亻 ⺈ 小 心 | cjk-decomp | = | · |
| 想 | seuil-255, hsk-1 | 木 目 心 | cjk-decomp | = | · |
| 意 | seuil-255 | 立 日 心 | cjk-decomp | = | · |
| 慢 | hsk-1 | 忄 日 罒 又 | cjk-decomp | = | · |
| 懂 | seuil-255 | 忄 艹 重 | cjk-decomp, surcharge | = | · |
| 房 | seuil-255, hsk-1 | 户 方 | cjk-decomp | = | · |
| 打 | seuil-255, hsk-1 | 扌 丁 | cjk-decomp | = | · |
| 找 | hsk-1 | 扌 戈 | cjk-decomp | = | · |
| 拼 | interface | 扌 丷 开 | cjk-decomp | = | · |
| 拿 | hsk-1 | 人 一 口 手 | cjk-decomp, surcharge | = | · |
| 探 | rang | 扌 冖 八 木 | cjk-decomp | = | · |
| 提 | conte | 扌 日 一 龰 | cjk-decomp, surcharge | = | · |
| 放 | hsk-1 | 方 攵 | surcharge | = | ≠ 方 𠂉 乂 |
| 教 | hsk-1 | 耂 子 攵 | surcharge | = | ≠ 耂 子 𠂉 乂 |
| 斧 | conte | 父 斤 | cjk-decomp | = | · |
| 新 | seuil-255, hsk-1 | 立 一 小 斤 | cjk-decomp, surcharge | = | · |
| 旁 | hsk-1 | ⿳亠丷冖 方 | surcharge | = | ≠ 亠 丷 冖 方 |
| 早 | seuil-255, hsk-1 | 日 十 | cjk-decomp | = | · |
| 时 | seuil-255, hsk-1 | 日 寸 | cjk-decomp | = | · |
| 明 | seuil-255, hsk-1, terme | 日 月 | cjk-decomp | = | · |
| 星 | seuil-255, hsk-1 | 日 生 | cjk-decomp | = | · |
| 春 | terme | 𡗗 日 | cjk-decomp | = | · |
| 昨 | seuil-255, hsk-1 | 日 乍 | cjk-decomp | = | · |
| 是 | seuil-255, hsk-1 | 日 一 龰 | surcharge | = | = |
| 晚 | seuil-255, hsk-1 | 日 免 | cjk-decomp | = | · |
| 暑 | terme | 日 耂 日 | cjk-decomp | = | · |
| 最 | hsk-1 | 日 耳 又 | cjk-decomp | = | · |
| 有 | seuil-255, hsk-1 | 𠂇 月 | cjk-decomp | = | · |
| 朋 | seuil-255, hsk-1 | 月 月 | cjk-decomp | = | · |
| 服 | hsk-1 | 月 卩 又 | cjk-decomp | = | · |
| 期 | seuil-255, hsk-1 | 其 月 | cjk-decomp | = | · |
| 机 | seuil-255, hsk-1, conte | 木 几 | cjk-decomp | = | · |
| 李 | seuil-255 | 木 子 | cjk-decomp | = | · |
| 条 | hsk-1 | 夂 木 | surcharge | = | ≠ 夂 十 小 |
| 杯 | seuil-255, hsk-1 | 木 不 | cjk-decomp | = | · |
| 林 | interface, rang | 木 木 | cjk-decomp | = | · |
| 树 | hsk-1, conte | 木 又 寸 | cjk-decomp | = | · |
| 校 | hsk-1 | 木 六 乂 | cjk-decomp | = | · |
| 样 | seuil-255, hsk-1 | 木 羊 | cjk-decomp | = | · |
| 桃 | conte | 木 兆 | cjk-decomp | = | · |
| 桌 | hsk-1 | ⺊ 日 木 | surcharge | = | = |
| 桥 | fête | 木 夭 丨 丨 | cjk-decomp, surcharge | = | · |
| 桩 | conte | 木 广 土 | cjk-decomp | = | · |
| 梅 | terme | 木 𠂉 母 | cjk-decomp | = | · |
| 楼 | hsk-1 | 木 米 女 | cjk-decomp | = | · |
| 榜 | rang | 木 ⿳亠丷冖 方 | cjk-decomp, surcharge | = | · |
| 次 | hsk-1 | 冫 欠 | cjk-decomp | = | · |
| 欢 | seuil-255, hsk-1 | 又 欠 | cjk-decomp | = | · |
| 歌 | hsk-1 | 丁 口 丁 口 欠 | cjk-decomp, surcharge | = | · |
| 每 | seuil-255 | 𠂉 母 | cjk-decomp | = | · |
| 比 | seuil-255, hsk-1 | 匕 匕 | cjk-decomp | = | · |
| 汉 | seuil-255, hsk-1 | 氵 又 | cjk-decomp | = | · |
| 汽 | seuil-255, hsk-1 | 氵 气 | cjk-decomp | = | · |
| 没 | seuil-255, hsk-1 | 氵 殳 | cjk-decomp | = | · |
| 法 | seuil-255 | 氵 去 | cjk-decomp | = | · |
| 洗 | hsk-1 | 氵 𠂒 儿 | cjk-decomp, surcharge | = | · |
| 活 | seuil-255 | 氵 舌 | cjk-decomp | = | · |
| 海 | seuil-255, conte | 氵 𠂉 母 | cjk-decomp | = | · |
| 温 | interface, conte | 氵 日 皿 | cjk-decomp | = | · |
| 渴 | hsk-1 | 氵 日 勹 人 𠃊 | cjk-decomp, surcharge | = | · |
| 满 | terme | 氵 艹 两 | surcharge | = | ≠ 氵 卄 两 |
| 灯 | fête | 火 丁 | cjk-decomp | = | · |
| 点 | seuil-255, hsk-1 | ⺊ 口 灬 | cjk-decomp | = | · |
| 热 | hsk-1, terme | 扌 丸 灬 | cjk-decomp | = | · |
| 爱 | seuil-255, hsk-1 | 爫 冖 𠂇 又 | cjk-decomp, surcharge | = | · |
| 爷 | hsk-1 | 父 卩 | surcharge | = | ≠ 父 𠃌 丨 |
| 爸 | seuil-255, hsk-1 | 父 巴 | cjk-decomp | = | · |
| 状 | rang | 丬 犬 | cjk-decomp | = | · |
| 狐 | conte | 犭 瓜 | cjk-decomp | = | · |
| 狲 | conte | 犭 子 小 | cjk-decomp | = | · |
| 狸 | conte | 犭 里 | cjk-decomp | = | · |
| 狼 | conte | 犭 丶 艮 | surcharge | = | ordre : 犭 艮 丶 |
| 猢 | conte | 犭 十 口 月 | cjk-decomp | = | · |
| 玩 | seuil-255, hsk-1, interface | 王 二 儿 | cjk-decomp | = | · |
| 现 | seuil-255, hsk-1 | 王 见 | cjk-decomp | = | · |
| 班 | hsk-1 | 王 刂 王 | surcharge | = | ≠ 王 王 丿 丶 |
| 球 | hsk-1 | 王 求 | cjk-decomp | = | · |
| 男 | seuil-255, hsk-1 | 田 力 | cjk-decomp | = | · |
| 画 | seuil-255 | 一 田 凵 | surcharge | = | = |
| 病 | seuil-255, hsk-1 | 疒 丙 | cjk-decomp | = | · |
| 的 | seuil-255, hsk-1 | 白 勺 | cjk-decomp | = | · |
| 皇 | conte | 白 王 | cjk-decomp | = | · |
| 盲 | conte | 亡 目 | cjk-decomp | = | · |
| 看 | seuil-255, hsk-1 | 手 目 | cjk-decomp | = | · |
| 真 | hsk-1 | 十 具 | surcharge | = | = |
| 眼 | rang | 目 艮 | cjk-decomp | = | · |
| 着 | hsk-1 | 羊 目 | surcharge | = | = |
| 睡 | hsk-1 | 目 垂 | cjk-decomp | = | · |
| 知 | seuil-255, hsk-1 | 矢 口 | cjk-decomp | = | · |
| 神 | conte | 礻 申 | cjk-decomp | = | · |
| 票 | seuil-255, hsk-1 | 覀 示 | cjk-decomp | = | · |
| 福 | fête | 礻 一 口 田 | surcharge | = | = |
| 秀 | rang | 禾 乃 | cjk-decomp | = | · |
| 秋 | terme, conte | 禾 火 | cjk-decomp | = | · |
| 空 | conte | 穴 工 | cjk-decomp | = | · |
| 穿 | hsk-1 | 穴 牙 | cjk-decomp | = | · |
| 站 | hsk-1 | 立 ⺊ 口 | cjk-decomp | = | · |
| 童 | rang | 立 里 | cjk-decomp | = | · |
| 笑 | hsk-1 | ⺮ 夭 | cjk-decomp | = | · |
| 笔 | seuil-255 | ⺮ 毛 | cjk-decomp | = | · |
| 第 | hsk-1 | ⺮ 𢎨 | surcharge | = | = |
| 等 | hsk-1 | ⺮ 土 寸 | cjk-decomp | = | · |
| 筋 | conte | ⺮ 月 力 | cjk-decomp | = | · |
| 答 | hsk-1 | ⺮ 人 一 口 | cjk-decomp, surcharge | = | · |
| 筷 | seuil-255 | ⺮ 忄 夬 | cjk-decomp | = | · |
| 箭 | conte | ⺮ 䒑 月 刂 | cjk-decomp, surcharge | = | · |
| 粽 | fête | 米 宀 示 | cjk-decomp | = | · |
| 系 | hsk-1 | 丿 糸 | cjk-decomp, surcharge | = | · |
| 累 | seuil-255, hsk-1 | 田 糸 | cjk-decomp | = | · |
| 红 | seuil-255 | 纟 工 | cjk-decomp | = | · |
| 织 | conte | 纟 口 八 | cjk-decomp | = | · |
| 绍 | hsk-1 | 纟 刀 口 | cjk-decomp | = | · |
| 给 | seuil-255, hsk-1 | 纟 人 一 口 | cjk-decomp, surcharge | = | · |
| 网 | hsk-1 | 冂 乂 乂 | surcharge | = | ≠ ⺆ 乂 乂 |
| 美 | seuil-255 | 羊 大 | cjk-decomp | = | · |
| 翁 | conte | 八 厶 习 习 | cjk-decomp | = | · |
| 翰 | rang | 十 日 十 人 习 习 | surcharge | = | = |
| 考 | hsk-1 | 耂 丂 | cjk-decomp | = | · |
| 能 | seuil-255, hsk-1 | 厶 月 匕 匕 | cjk-decomp | = | · |
| 脑 | hsk-1 | 月 亠 凵 乂 | cjk-decomp | = | · |
| 花 | seuil-255, hsk-1, rang | 艹 亻 匕 | surcharge | = | ≠ 卄 亻 匕 |
| 苗 | conte | 艹 田 | surcharge | = | ≠ 卄 田 |
| 茶 | seuil-255, hsk-1 | 艹 人 木 | surcharge | = | ≠ 卄 人 十 小 |
| 菊 | fête | 艹 勹 米 | surcharge | = | ≠ 卄 勹 米 |
| 菜 | seuil-255, hsk-1 | 艹 爫 木 | surcharge | = | ≠ 卄 爫 木 |
| 菩 | conte | 艹 立 口 | surcharge | = | ≠ 卄 立 口 |
| 蒙 | rang | 艹 冖 一 豕 | surcharge | = | ≠ 卄 冖 二 𧰨 |
| 虎 | conte | 虍 几 | cjk-decomp | = | · |
| 虱 | conte | ㇠ 丿 虫 | cjk-decomp, surcharge | = | · |
| 蛇 | conte | 虫 宀 匕 | cjk-decomp | = | · |
| 蛋 | hsk-1 | 乛 龰 虫 | cjk-decomp, surcharge | = | · |
| 蛙 | conte | 虫 土 土 | cjk-decomp | = | · |
| 蟠 | conte | 虫 釆 田 | cjk-decomp | = | · |
| 行 | hsk-1 | 彳 一 丁 | surcharge | = | écart : 彳 二 ㇚ |
| 要 | seuil-255, hsk-1 | 覀 女 | cjk-decomp | = | · |
| 视 | hsk-1 | 礻 见 | cjk-decomp | = | · |
| 觉 | seuil-255, hsk-1 | 𭕄 见 | surcharge | = | écart : ⺍ 冖 见 |
| 认 | seuil-255, hsk-1 | 讠 人 | cjk-decomp | = | · |
| 让 | seuil-255 | 讠 上 | cjk-decomp | = | · |
| 记 | hsk-1 | 讠 己 | cjk-decomp | = | · |
| 许 | seuil-255 | 讠 午 | cjk-decomp | = | · |
| 识 | seuil-255, hsk-1 | 讠 口 八 | cjk-decomp | = | · |
| 诉 | hsk-1 | 讠 斥 | cjk-decomp | = | · |
| 试 | hsk-1 | 讠 弋 工 | cjk-decomp | = | · |
| 话 | seuil-255, hsk-1 | 讠 舌 | cjk-decomp | = | · |
| 语 | seuil-255, hsk-1 | 讠 五 口 | cjk-decomp | = | · |
| 说 | seuil-255, hsk-1, interface | 讠 丷 口 儿 | cjk-decomp | = | · |
| 请 | seuil-255, hsk-1 | 讠 龶 月 | cjk-decomp | = | · |
| 读 | hsk-1, interface | 讠 十 乛 头 | cjk-decomp, surcharge | = | · |
| 课 | seuil-255, hsk-1 | 讠 果 | cjk-decomp | = | · |
| 谁 | seuil-255, hsk-1 | 讠 隹 | cjk-decomp | = | · |
| 谜 | interface | 讠 辶 米 | cjk-decomp | = | · |
| 谢 | seuil-255, hsk-1 | 讠 身 寸 | cjk-decomp | = | · |
| 贡 | rang | 工 贝 | cjk-decomp | = | · |
| 贵 | seuil-255, hsk-1 | 中 一 贝 | cjk-decomp, surcharge | = | · |
| 走 | seuil-255, hsk-1 | 土 龰 | surcharge | = | = |
| 起 | hsk-1 | 土 龰 己 | cjk-decomp, surcharge | = | · |
| 跑 | hsk-1 | 口 龰 勹 巳 | surcharge | = | variante : 口 止 勹 巳 |
| 跟 | seuil-255, hsk-1 | 口 龰 艮 | surcharge | = | variante : 口 止 艮 |
| 路 | hsk-1 | 口 龰 夂 口 | surcharge | = | variante : 口 止 夂 口 |
| 边 | seuil-255, hsk-1 | 辶 力 | cjk-decomp | = | · |
| 过 | seuil-255, hsk-1 | 辶 寸 | cjk-decomp | = | · |
| 近 | seuil-255 | 辶 斤 | cjk-decomp | = | · |
| 还 | seuil-255, hsk-1 | 辶 不 | cjk-decomp | = | · |
| 这 | seuil-255, hsk-1 | 辶 文 | cjk-decomp | = | · |
| 进 | seuil-255, hsk-1, rang | 辶 井 | cjk-decomp | = | · |
| 远 | seuil-255, hsk-1 | 辶 二 儿 | cjk-decomp | = | · |
| 送 | hsk-1 | 辶 丷 天 | cjk-decomp | = | · |
| 道 | seuil-255, hsk-1 | 辶 首 | cjk-decomp | = | · |
| 那 | seuil-255, hsk-1 | 𭃂 阝 | surcharge | = | ≠ 𠃌 二 丨 阝 |
| 邻 | conte | 人 丶 龴 阝 | cjk-decomp, surcharge | = | · |
| 都 | seuil-255, hsk-1 | 耂 日 阝 | cjk-decomp | = | · |
| 酒 | seuil-255 | 氵 酉 | cjk-decomp | = | · |
| 钱 | seuil-255, hsk-1 | 钅 戋 | cjk-decomp | = | · |
| 链 | interface | 钅 辶 车 | cjk-decomp | = | · |
| 错 | hsk-1 | 钅 龷 日 | surcharge | = | = |
| 问 | seuil-255, hsk-1 | 门 口 | cjk-decomp | = | · |
| 间 | seuil-255, hsk-1 | 门 日 | cjk-decomp | = | · |
| 院 | hsk-1 | 阝 宀 二 儿 | cjk-decomp | = | · |
| 难 | seuil-255, hsk-1 | 又 隹 | cjk-decomp | = | · |
| 雪 | terme | 雨 彐 | cjk-decomp | = | · |
| 零 | hsk-1 | 雨 人 丶 龴 | cjk-decomp, surcharge | = | · |
| 雷 | terme | 雨 田 | cjk-decomp | = | · |
| 霜 | terme | 雨 木 目 | cjk-decomp | = | · |
| 露 | terme | 雨 口 龰 夂 口 | cjk-decomp, surcharge | = | · |
| 青 | conte | 龶 月 | cjk-decomp | = | · |
| 须 | conte | 彡 页 | cjk-decomp | = | · |
| 题 | seuil-255 | 日 一 龰 页 | cjk-decomp, surcharge | = | · |
| 饭 | seuil-255, hsk-1 | 饣 厂 又 | cjk-decomp, surcharge | = | · |
| 饿 | hsk-1 | 饣 我 | cjk-decomp | = | · |
| 馆 | seuil-255, hsk-1 | 饣 宀 㠯 | cjk-decomp | = | · |
| 鸡 | hsk-1 | 又 鸟 | cjk-decomp | = | · |
| 鹅 | conte | 我 鸟 | cjk-decomp | = | · |
| 麦 | terme | 龶 夂 | cjk-decomp | = | · |
| 鼻 | conte | 自 田 丌 | cjk-decomp | = | · |
| 齐 | conte | 文 丨 丨 | cjk-decomp, surcharge | = | · |
