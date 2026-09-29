# Textes de licence, versionnés

Ces fichiers sont copiés **tels quels** depuis leur source et recopiés à
l'identique dans chaque export (`wenlu export`). Ils ne se modifient pas :
l'Arphic Public License (§1) et la notice Unicode (condition a) l'interdisent, et
la MIT veut sa notice « included in all copies or substantial portions ».

Ils sont versionnés ici, et non téléchargés par `wenlu fetch`, pour que l'export
reste possible hors ligne et que toute modification se voie dans un diff.

| Fichier | Source | Relevé le | SHA-256 |
|---|---|---|---|
| `ARPHICPL.TXT` | `https://raw.githubusercontent.com/skishore/makemeahanzi/master/APL/english/ARPHICPL.TXT` | 2026-09-21 | `3a5e90c0957524a89e48203febcd4492ca4393678abaa7e5b4d70f3ff32b386d` |
| `UNICODE-LICENSE.txt` | en-tête de `https://raw.githubusercontent.com/skishore/makemeahanzi/master/LGPL` (35 premières lignes : la notice de copyright et de permission Unicode, sans le texte LGPL qui la suit) | 2026-09-21 | `3ebdd8814b4ef5e1ce35e747a235dfc66200944e30ea1b1ee4affbd8a24c8226` |
| `MIT-cjk-decomp.txt` | texte MIT de SPDX (`https://raw.githubusercontent.com/spdx/license-list-data/main/text/MIT.txt`, SHA-256 `b05785f9…`), la ligne de copyright remplie d'après le README de `amake/cjk-decomp` (« originally compiled by Gavin Grover », sans année) | 2026-09-28 | `d370370fea014228fedaf1bed95d3d6baa7edd33f356c479dce140ad895bdba5` |
| `MIT-hsk30.txt` | `https://raw.githubusercontent.com/ivankra/hsk30/master/LICENSE`, tel quel | 2026-09-29 | `9cd70c000ea23c899e71b2cbe7c28e18c60937f6e74d1b344d2923f6bddae44a` |
| `OGDL-Taiwan-1.0.txt` | `https://raw.githubusercontent.com/spdx/license-list-data/main/text/OGDL-Taiwan-1.0.txt` (texte chinois, puis anglais), relevé pendant l'étude des tons | 2026-09-29 | `6fb1f786e1d278b6240b4816ba791d48fc84223e35da8a9263e42836bc154e94` |

`ARPHICPL.TXT` couvre les tracés de `graphics.txt` (`docs/sources-licences.md`
§2.1). `UNICODE-LICENSE.txt` couvre le pinyin d'Unihan (§5) ; c'est la notice
telle que Make Me a Hanzi la reproduit, `unicode.org` restant bloqué depuis cet
environnement.

`MIT-cjk-decomp.txt` couvre les décompositions (`parts`) qui descendent cjk-decomp,
distribué au choix sous six licences, dont la MIT que le projet retient (§5.1, §10).

`MIT-hsk30.txt` couvre la liste des mots du HSK 3.0 (`data/sources/listes/hsk-mots.tsv`),
tirée d'`ivankra/hsk30` (formes, pinyin, niveaux, catégories), et ce que l'export en reprend
(`dico/`). Sa notice de copyright nomme aussi Shawky et Pleco Inc., dont les données
d'origine (`elkmovie/hsk30`, même licence) servent au contrôle.

`OGDL-Taiwan-1.0.txt` couvre les données d'entraînement des poids du classifieur des tons
(`tons.json`, §11) : l'Open Government Data License 1.0 de Taïwan, qui exige l'attribution
(`data/sources/tons/PROVENANCE.md`).

Le texte de la LGPL 3.0 n'est pas versionné : ni `dictionary.txt` ni rien qui en
dérive n'est embarqué (§2.2, §10).
