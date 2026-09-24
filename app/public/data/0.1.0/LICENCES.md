# Licences des données exportées (version 0.1.0)

Écrit par `wenlu export`. Fait foi pour ce que l'app embarque ;
`docs/sources-licences.md` fait foi pour la décision d'ensemble.

| Source | Usage dans l'export | Licence | Attribution | Texte de la licence |
|---|---|---|---|---|
| Make Me a Hanzi — graphics.txt | tracés et médianes (`traits/`) | Arphic Public License | Copyright (C) 1999 Arphic Technology Co., Ltd. | `ARPHICPL.TXT` (racine de l'export et `traits/`) |
| Unihan (Unicode Character Database) | pinyin (`kMandarin`) des fiches | Unicode License | Copyright © 1991-2009 Unicode, Inc. | `UNICODE-LICENSE.txt` |
| Make Me a Hanzi — dictionary.txt | chaîne IDS réconciliée avec GF 0014-2009 (`parts`, `sources: ["makemeahanzi"]`) | LGPL 3.0 ou ultérieure | Copyright (C) 2016 Shaunak Kishore | https://www.gnu.org/licenses/lgpl-3.0.html — question ouverte, voir ci-dessous |
| cjk-decomp | chaîne IDS de repli (`sources: ["cjk-decomp"]`) | MIT (au choix parmi six licences) | Copyright (c) Gavin Grover | https://github.com/amake/cjk-decomp |
| CC-CEDICT (MDBG) | mots candidats (hanzi et pinyin) des fiches relues | CC BY-SA 4.0 | CC-CEDICT, publié par MDBG, CC BY-SA 4.0 — fichier modifié | https://creativecommons.org/licenses/by-sa/4.0/ |
| Norme GF 0014-2009 | les 514 composants : règle de décomposition | texte normatif, non reproduit | 《现代常用字部件及部件名称规范》 | — |
| Seuils sinographiques (Éducation nationale) et référentiel HSK 3.0 | listes cibles (`listes`, `parcours`) | publications officielles, listes de faits | Eduscol ; Chinese Testing International | — |
| Calendrier luni-solaire chinois | dates des fêtes (`fetes.json`) et des termes solaires (`saisons.json`), calculées par lunar_python | faits de calendrier ; bibliothèque MIT, non embarquée | lunar_python, Copyright (c) 6tail | https://github.com/6tail/lunar-python |
| Fiches, contes, paires, fêtes, saisons (pipeline wenlu) | `familles/`, `contes/`, `paires.json`, `fetes.json`, `saisons.json` | propriétaire | textes rédigés pour l'app, relus | — |

## Séparation des fichiers

Les trois régimes ne se mélangent jamais dans un même fichier (`docs/sources-licences.md` §2.1 et §8) :

- `traits/` : tracés sous Arphic Public License, avec `ARPHICPL.TXT` inaltéré à côté et `traits/MODIFICATIONS.md` qui dit comment et quand ils ont été dérivés.
- `familles/`, `contes/`, `paires.json`, `fetes.json`, `saisons.json` : décomposition canonique et textes rédigés pour l'app, propriétaires.
- `UNICODE-LICENSE.txt` : notice de permission Unicode, qui couvre le pinyin.

## Ce que l'export ne contient pas

- Aucune définition anglaise : ni `kDefinition` d'Unihan, ni CC-CEDICT (`docs/sources-licences.md` §4.2). Les mots exportés ne portent que le hanzi, le pinyin et les traductions rédigées pour l'app.
- Aucun texte de `dictionary.txt` : ni définition, ni étymologie anglaise (§2.2).
- Aucune fiche ni aucun conte non relu (brief §17).

## Question ouverte

La décomposition exportée descend la chaîne IDS de Make Me a Hanzi (`dictionary.txt`, LGPL 3.0+) jusqu'aux composants de GF 0014-2009. `docs/sources-licences.md` §2.2 écarte `dictionary.txt` de l'embarqué. La liste de composants qui en résulte est une donnée factuelle normalisée par une autre source, mais le point n'est pas tranché : chaque fiche nomme la source de sa décomposition (`sources`) pour que la décision reste possible fichier par fichier.

## Obligations hors app

- Publier les fichiers de `traits/` sur le site public, avec `ARPHICPL.TXT` et la note de modification (APL §2 b).
- Reprendre ce tableau sur l'écran « Licences » des Réglages et sur le site.
