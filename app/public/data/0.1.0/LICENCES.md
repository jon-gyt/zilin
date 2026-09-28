# Licences des données exportées (version 0.1.0)

Écrit par `wenlu export`. Fait foi pour ce que l'app embarque ;
`docs/sources-licences.md` fait foi pour la décision d'ensemble.

| Source | Usage dans l'export | Licence | Attribution | Texte de la licence |
|---|---|---|---|---|
| Make Me a Hanzi — graphics.txt | tracés et médianes (`traits/`) | Arphic Public License | Copyright (C) 1999 Arphic Technology Co., Ltd. | `ARPHICPL.TXT` (racine de l'export et `traits/`) |
| Unihan (Unicode Character Database) | pinyin (`kMandarin`) des fiches | Unicode License | Copyright © 1991-2009 Unicode, Inc. | `UNICODE-LICENSE.txt` |
| cjk-decomp (CJK Decomposition Data) | chaîne IDS réconciliée avec GF 0014-2009 (`parts`, `sources: ["cjk-decomp"]`) | MIT (retenue parmi les six licences proposées) | Copyright (c) Gavin Grover (CJK Decomposition Data) — https://github.com/amake/cjk-decomp | `MIT-cjk-decomp.txt` |
| CC-CEDICT (MDBG) | mots candidats (hanzi et pinyin) des fiches relues ; mots du dictionnaire éclair (le mot seul, `eclair.json`) | CC BY-SA 4.0 | CC-CEDICT, publié par MDBG, CC BY-SA 4.0 — fichier modifié | https://creativecommons.org/licenses/by-sa/4.0/ |
| Norme GF 0014-2009 | les 514 composants : règle de décomposition | texte normatif, non reproduit | 《现代常用字部件及部件名称规范》 | — |
| Seuils sinographiques (Éducation nationale) et référentiel HSK 3.0 | listes cibles (`listes`, `parcours`) | publications officielles, listes de faits | Eduscol ; Chinese Testing International | — |
| Calendrier luni-solaire chinois | dates des fêtes (`fetes.json`) et des termes solaires (`saisons.json`), calculées par lunar_python | faits de calendrier ; bibliothèque MIT, non embarquée | lunar_python, Copyright (c) 6tail | https://github.com/6tail/lunar-python |
| Surcharges du pipeline wenlu (`data/sources/surcharges/`) | pinyin corrigés et décompositions rédigées pour Wenlu d'après GF 0014-2009, chacune avec sa raison (`sources: ["surcharge"]`) | propriétaire | travail propre du projet, relu | — |
| Fiches, contes, paires, fêtes, saisons, devinettes, dictionnaire éclair, coquilles, cuisine, lettres de Que, message WeChat, personnage, phrases de Tao à Jouer (pipeline wenlu) | `familles/`, `contes/`, `paires.json`, `fetes.json`, `saisons.json`, `devinettes.json`, `eclair.json`, `coquilles.json`, `cuisine.json`, `lettres.json`, `wechat.json`, `heros.json`, `jouer.json`, et `apercu/` pour les textes encore à relire | propriétaire | textes rédigés pour l'app, relus | — |

## Séparation des fichiers

Les trois régimes ne se mélangent jamais dans un même fichier (`docs/sources-licences.md` §2.1 et §8) :

- `traits/` : tracés sous Arphic Public License, avec `ARPHICPL.TXT` inaltéré à côté et `traits/MODIFICATIONS.md` qui dit comment et quand ils ont été dérivés.
- `familles/`, `contes/`, `paires.json`, `fetes.json`, `saisons.json`, `devinettes.json`, `eclair.json`, `coquilles.json`, `cuisine.json`, `lettres.json`, `wechat.json`, `heros.json`, `jouer.json`, `apercu/` : décomposition canonique et textes rédigés pour l'app, propriétaires.
- `UNICODE-LICENSE.txt` : notice de permission Unicode, qui couvre le pinyin.
- `MIT-cjk-decomp.txt` : notice de copyright et texte de la MIT, qui couvrent les décompositions descendues de cjk-decomp.

## Ce que l'export ne contient pas

- Aucune définition anglaise : ni `kDefinition` d'Unihan, ni CC-CEDICT (`docs/sources-licences.md` §4.2). Les mots exportés ne portent que le hanzi, le pinyin et les traductions rédigées pour l'app.
- Rien de `dictionary.txt` (Make Me a Hanzi, LGPL 3.0+) : ni définition, ni étymologie anglaise, ni décomposition (§2.2, §10). Seuls les tracés de Make Me a Hanzi (`graphics.txt`) sont embarqués, sous l'Arphic Public License.
- Aucune fiche, aucun conte ni aucune lettre non relus hors de `apercu/` (brief §17). Ce dossier porte les textes encore à relire, chacun marqué `statut: "a_relire"`, que l'app ne charge que sur demande (Réglages, mode relecture). Un texte rejeté n'est nulle part.

## Décompositions

Chaque décomposition (`parts`) descend nos surcharges, rédigées pour Wenlu d'après la table de GF 0014-2009, puis cjk-decomp (MIT), jusqu'aux composants de la norme ; chaque fiche nomme la source de la sienne (`sources`). Aucune ne descend plus `dictionary.txt` (décision du 26 septembre 2026, appliquée le 28, `docs/sources-licences.md` §10).

## Obligations hors app

- Publier les fichiers de `traits/` sur le site public, avec `ARPHICPL.TXT` et la note de modification (APL §2 b).
- Reprendre ce tableau sur l'écran « Licences » des Réglages et sur le site.
