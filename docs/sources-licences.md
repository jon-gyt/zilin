# Sources et licences

Décision de la story 0.4. Vérification faite le 21 septembre 2026 sur les sources primaires ; licence des décompositions instruite et tranchée le 26 septembre 2026, migration faite le 28 (§10) ; données d'entraînement du classifieur des tons ajoutées le 29 septembre 2026 (§11) ; voix humaines sous CC BY-SA instruites les 3 et 4 octobre 2026 (§11, « Voix CC BY-SA ») ; profil de tons des mots essayé du 4 au 7 octobre 2026, en variante libre et en variante CC BY-SA (§11).
Ce document fait foi pour le pipeline `data/` et pour l'écran « Licences » de l'app.

Hypothèse de distribution : PWA gratuite sur le web, app iOS payante (achat à vie et abonnement), donc usage commercial et distribution par l'App Store.

## 1. Synthèse

| Source | Usage | Licence vérifiée | Décision |
|---|---|---|---|
| Make Me a Hanzi — `graphics.txt` | traits, médianes | Arphic Public License | utilisable avec obligations |
| Make Me a Hanzi — `dictionary.txt` | contexte des fiches (étymologie EN, indice à vérifier), contrôles de pinyin ; plus aucune décomposition | LGPL 3.0 ou ultérieure (+ notice Unicode) | hors de l'embarqué : rien de l'export n'en dérive depuis le 28 septembre 2026 (§10), contrôle bloquant |
| `hanzi-writer-data` | traits et médianes (JSON) | Arphic Public License | utilisable avec obligations ; redondant avec `graphics.txt` |
| Hanzi Writer (bibliothèque) | animation et quiz de tracé | MIT | utilisable avec obligations |
| CC-CEDICT | mots, pinyin | CC BY-SA 4.0 | utilisable avec obligations |
| Unihan / UCD | pinyin, traits (pas de décomposition : `kIDS` n'existe ni en 17.0.0 ni en 18.0.0, revérifié le 26 septembre 2026) | Unicode License v3 | utilisable avec obligations ; source à privilégier |
| cjk-decomp | décompositions converties en IDS, source de la décomposition exportée derrière nos surcharges (§10) | MIT (retenue parmi six licences) | utilisable avec obligations : notice et texte MIT dans l'export (`MIT-cjk-decomp.txt`) |
| BabelStone IDS (`IDS.TXT`, Andrew West) | décompositions IDS, mesuré au §10 | aucun droit revendiqué, usage commercial sans attribution (en-tête du fichier, lu sur deux miroirs le 26 septembre 2026) | **écarté** (décision du 26 septembre 2026) : données en partie dérivées de Kawabata Taichi (lignée CHISE, GPL), pour un seul caractère de plus que cjk-decomp |
| `cjkvi/cjkvi-ids`, CHISE IDS | décompositions IDS | GPL v2 ; GPL v2 ou ultérieure (README lus le 26 septembre 2026) | à écarter ; mesurés pour information seulement |
| Norme GF 0014-2009 | 514 composants | texte normatif, non vérifié en ligne | utilisable pour la logique ; ne pas reproduire le document |
| Listes Eduscol | parcours Lire | publication officielle, page non consultable | utilisable comme liste de caractères ; pas de reprise de texte |
| Référentiel HSK 3.0 | parcours HSK | publication officielle, page non consultable | idem ; ne pas rediffuser le PDF |
| Liste des mots HSK 3.0 : `ivankra/hsk30` (`hsk30.csv`), contrôlée contre `elkmovie/hsk30` (`wordlist.txt`) | mots du dictionnaire : graphie, pinyin, niveau, catégorie (`data/sources/listes/hsk-mots.tsv`, `dico/`) ; la colonne `CEDICT` n'est jamais lue | MIT, `LICENSE` des deux dépôts lus le 29 septembre 2026 (Copyright (c) 2023 Ivan Krasilnikov, (c) 2021 Shawky, (c) 2021 Pleco Inc.) | **utilisable avec obligations** : notice et texte MIT dans l'export (`MIT-hsk30.txt`) ; la table reprend une norme d'État (§6) |
| `lunar_python` (6tail) | dates des fêtes (春节, 元宵, 清明, 端午, 七夕, 中秋, 重阳, 冬至) calculées dans le pipeline | MIT, `LICENSE` du paquet 1.4.8 | utilisable ; bibliothèque du pipeline seulement, jamais embarquée : l'app ne reçoit que des dates, qui sont des faits de calendrier |
| LxgwSeal (小篆) | formes sigillaires | SIL OFL 1.1 | utilisable avec obligations ; couverture insuffisante aujourd'hui |
| Kaiyuan Small Seal (小篆) | formes sigillaires | SIL OFL 1.1 annoncée | à surveiller ; police non encore publiée |
| Polices 甲骨文 | formes oraculaires | aucune licence ouverte vérifiée | à écarter en l'état |
| Audio — Kokoro (hexgrad) | voix neuronale pré-générée, modèle exécuté dans le pipeline | Apache 2.0, code et poids — `LICENSE` et `README.md` du dépôt lus le 21 septembre 2026, carte du modèle (`license: apache-2.0`) lue le 24 septembre 2026 | **fournisseur par défaut** ; rien n'est redistribué hors de nos propres fichiers, aucune redevance par écoute |
| Audio — Azure AI Speech (Microsoft) | voix neuronale pré-générée | **à vérifier** : conditions non lues, `learn.microsoft.com` bloqué par le proxy de sortie (21 septembre 2026) | second fournisseur, hors défaut ; aucun fichier synthétisé par lui n'entre dans un artefact distribué avant lecture des conditions |
| Tons, entraînement — syllabes du mandarin, jeu 5961 de data.gov.tw (deux voix de Taïwan), par la réédition `Punpuf/shenzhen-mandarin-audio@a3617b7` | entraînement des poids du classifieur des tons de « Dis-le » (`tons.json`) ; aucun son embarqué | Open Government Data License 1.0 (OGDL-Taiwan-1.0), compatible CC BY 4.0 — texte intégral lu dans `spdx/license-list-data` le 29 septembre 2026 ; fiche du jeu lue le 1er octobre 2026 (數位發展部, 全字庫, 2015) | **utilisable avec obligations** : attribution complète dans `tons.json`, `LICENCES.md` et la page des licences, texte de la licence dans l'export (§11) |
| Tons, développement et test — `hugolpz/audio-cmn`, voix de Chen Wang | choix des seuils, mesure de la précision | « CC-by-sa » du README d'audio-cmn, **version non précisée** (relu le 4 octobre 2026 ; aucune autre page) | **licence douteuse : jamais entraîné, jamais distribué**, mesure seulement (§11) |
| Tons, voix CC — Yue Tan (Shtooka `cmn-caen-tan`, MP3 d'`audio-cmn`) | mesure ; entraînement possible (validation croisée du 4 octobre) | **CC BY-SA 3.0 United States**, « Copyright (c) 2009 Yue Tan » (readme de la collection, lu par l'Internet Archive le 4 octobre 2026) | utilisable avec obligations (attribution, poids dérivés sous CC BY-SA 4.0) ; **aucun poids versionné n'en dérive** (§11) |
| Tons, voix CC — Lingua Libre, enregistrements `cmn` de Fake estate, Jouketou, Luilui6666 (CC BY-SA 4.0) et CanonNi (CC0) | entraînement possible (validation croisée du 4 octobre) | licence lue fichier par fichier sur Commons (modèle de la page et `extmetadata`) le 4 octobre 2026 ; NC, ND et inconnues écartées | utilisable avec obligations (attribution par locuteur) ; **aucun poids versionné n'en dérive** (§11) |

Règle inchangée : aucune reprise de Wiktionary ni de sites d'étymologie tiers. Les textes d'origine sont rédigés pour l'app.

## 2. Make Me a Hanzi

URL consultées le 21 septembre 2026 :

- `https://github.com/skishore/makemeahanzi`
- `https://raw.githubusercontent.com/skishore/makemeahanzi/master/COPYING`
- `https://raw.githubusercontent.com/skishore/makemeahanzi/master/LGPL`
- `https://raw.githubusercontent.com/skishore/makemeahanzi/master/APL/english/ARPHICPL.TXT`

Le dépôt sépare explicitement deux licences. Le fichier `COPYING` dit :

> « You can redistribute and/or modify dictionary.txt under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the license, or (at your option) any later version. »

> « You can redistribute and/or modify graphics.txt under the terms of the Arphic Public License as published by Arphic Technology Co., Ltd. »

Le fichier `LGPL` contient d'abord la notice Unicode (données Unihan, licence permissive avec conservation de la notice et mention des modifications), puis le texte de la LGPL 3.0 du 29 juin 2007. Le texte de l'Arphic Public License est dans `APL/english/ARPHICPL.TXT`.

### 2.1 `graphics.txt` — tracés sous Arphic Public License

Décision : **utilisable avec obligations**.

L'APL définit « Font » comme les polices Arphic d'origine « and the derivatives of those fonts created through any modification including modifying glyph, reordering glyph, converting format, changing font name, or adding/deleting some characters in/from glyph table ». Un export JSON de traits est une conversion de format, et un sous-ensemble de 1 555 caractères est une suppression de caractères de la table. Nos fichiers de traits sont donc « the Font » au sens de l'APL, et nous les distribuons en tant que tels.

Obligations exactes :

- §1 : conserver le fichier `ARPHICPL.TXT` inaltéré dans toutes les copies, y compris dans le bundle de l'app.
- §2 a) : insérer dans chaque fichier modifié une mention visible disant comment et quand il a été modifié.
- §2 b) : rendre nos modifications librement disponibles en entier à tout tiers sous l'APL, par exemple « by offering access to copy the modifications from a designated place ». Concrètement : publier les fichiers de traits dérivés sur le site ou dans un dépôt public.
- §2 c) : ne concerne que les polices qui lisent des commandes en interactif ; sans objet ici.
- §5 : « You may not impose any further restrictions on the recipients' exercise of the rights granted herein. »

Ce que l'APL n'impose pas : l'ouverture du reste de l'app. Le §2 précise que les sections identifiables non dérivées de la Font et raisonnablement séparables ne tombent pas sous la licence, et que la simple agrégation sur un même support n'y fait pas entrer l'autre œuvre. Nos fiches, notre code et nos audios restent propriétaires, à condition que les données de traits restent dans des fichiers distincts et identifiables.

Compatibilité App Store. Le point sensible est le §5 combiné aux conditions d'usage d'Apple, qui limitent l'usage aux appareils possédés ou contrôlés par l'acheteur et interdisent la redistribution. C'est le mécanisme qui a fait retirer VLC de l'App Store en 2011 sous GPL. L'APL n'a pas de clause DRM explicite comme la GPL v3, mais le §5 pose la même question. Atténuation retenue : publier hors de l'app, sur le site public, la totalité des fichiers de traits dérivés sous APL avec `ARPHICPL.TXT`. Tout destinataire obtient ainsi une copie non encombrée et peut exercer ses droits sans passer par le binaire iOS. Ce montage est celui pratiqué par les applications qui embarquent des données APL ou LGPL ; il réduit le risque sans l'annuler. Validation par un conseil avant la soumission App Store (voir §9).

### 2.2 `dictionary.txt` — données sous LGPL 3.0+

Décision : **utilisable avec obligations, mais à écarter de l'embarqué**.

Ce que la LGPL impose concrètement à un fichier de données, et non à du code :

- La LGPL est écrite pour une bibliothèque liée à une application. Appliquée à un JSON embarqué, son §4 « Combined Works » demande une mention visible que la Library est utilisée, une copie de la GPL et de la LGPL jointes à l'app, la mention de copyright à l'exécution si l'app affiche des mentions de copyright, et surtout le §4 d) : soit fournir la source minimale correspondante dans une forme permettant à l'utilisateur de recombiner l'application avec une version modifiée, soit utiliser un mécanisme de bibliothèque partagée.
- Le §4 d) 1) est inapplicable à un binaire iOS signé. Le §4 d) 0) est satisfaisable en gardant les données dans un fichier d'actif séparé et remplaçable, et en publiant ce fichier. Mais la démonstration reste fragile.
- Les obligations ne se déclenchent qu'à la distribution. Utiliser `dictionary.txt` dans le pipeline `data/` sans le distribuer, ni distribuer d'œuvre qui en dérive, n'entraîne aucune obligation.

Décision opérationnelle : ne pas embarquer `dictionary.txt` ni un export qui en dérive. Le conserver comme source de contrôle hors distribution, pour vérifier la réconciliation avec GF 0014-2009 et repérer les écarts. Cette position évite d'avoir à trancher une question juridique inédite.

Alternative retenue : Unihan et l'UCD, sous Unicode License, qui est permissive et sans partage à l'identique. Elle fournit le pinyin (`kMandarin`, `kHanyuPinyin`) et le nombre de traits, mais aucune décomposition : `kIDS` n'existe pas (vérifié sur Unihan 17.0.0, voir §5). Les décompositions de repli viennent de cjk-decomp (§5.1). Les définitions anglaises et l'étymologie anglaise de `dictionary.txt` ne nous servent pas : le brief impose des textes rédigés pour l'app.

À écarter : `cjkvi/cjkvi-ids` (consulté le 21 septembre 2026, relu le 26), distribué sous GPL v2, donc incompatible avec un export propriétaire.

La décomposition exportée, elle, a descendu la chaîne IDS de `dictionary.txt` jusqu'au 28 septembre 2026 (304 caractères de la version 0.1.0). Elle descend depuis nos surcharges et cjk-decomp : décision et migration au §10. `dictionary.txt` reste téléchargé pour le seul usage que ce paragraphe permet, hors distribution : le contexte des fiches (étymologie donnée au rédacteur comme indice) et des contrôles de pinyin ; son IDS n'est plus même ingéré.

## 3. Hanzi Writer et hanzi-writer-data

URL consultées le 21 septembre 2026 :

- `https://raw.githubusercontent.com/chanind/hanzi-writer/master/LICENSE`
- `https://raw.githubusercontent.com/chanind/hanzi-writer/master/README.md`
- `https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/README.md`

La bibliothèque est sous licence MIT, copyright 2014 David Chanin. Décision : **utilisable avec obligations**. Obligation unique : reproduire la notice de copyright et le texte de la licence dans l'app.

Les données sont sous une licence distincte. Le README de `hanzi-writer-data` dit :

> « This data comes from the Make Me A Hanzi project […] You can redistribute and/or modify this data under the terms of the Arphic Public License as published by Arphic Technology Co., Ltd. »

Décision : **utilisable avec obligations**, les mêmes qu'au §2.1. Comme ces données sont exactement celles de `graphics.txt`, on ne retient qu'une seule chaîne d'approvisionnement : `graphics.txt` en amont du pipeline, pour maîtriser le sous-ensemble et le format. `hanzi-writer-data` n'est pas une dépendance d'exécution ; le chargement automatique depuis le CDN jsDelivr est à désactiver, la règle « aucune requête réseau à l'exécution » l'interdit de toute façon.

## 4. CC-CEDICT

URL consultées le 21 septembre 2026 :

- `https://raw.githubusercontent.com/qundao/backup-cc-cedict/main/cedict.txt` (miroir du fichier publié par MDBG ; l'en-tête est celui de l'éditeur)
- `https://raw.githubusercontent.com/spdx/license-list-data/main/text/CC-BY-SA-4.0.txt` (texte intégral de la licence, miroir SPDX)

`www.mdbg.net`, `cc-cedict.org`, `creativecommons.org` et `spdx.org` sont bloqués par le proxy de sortie de cet environnement. La page CC-CEDICT de MDBG n'a donc pas pu être lue directement. L'en-tête du fichier distribué porte les mentions suivantes, qui font foi :

```
# License:
# Creative Commons Attribution-ShareAlike 4.0 International License
# https://creativecommons.org/licenses/by-sa/4.0/
#! license=https://creativecommons.org/licenses/by-sa/4.0/
#! entries=125073
#! date=2026-09-19T09:05:23Z
```

Décision : **utilisable avec obligations**.

### 4.1 Les mots et le pinyin repris sont-ils une œuvre dérivée

Il faut distinguer deux niveaux, et la licence le fait elle-même.

Les entrées prises une à une. Un mot chinois et sa transcription pinyin sont des faits. Pris isolément, ils ne sont pas protégés. La section 4 b) de CC BY-SA 4.0 confirme la distinction pour les bases de données : si l'on reprend tout ou une part substantielle du contenu, « the database in which You have Sui Generis Database Rights (but not its individual contents) is Adapted Material, including for purposes of Section 3(b) ». Les contenus individuels ne sont pas eux-mêmes de l'Adapted Material.

Notre export. Extraire les mots et le pinyin des 1 555 caractères du parcours représente une part substantielle du contenu. Notre base de mots est donc de l'Adapted Material au sens de la section 4 b), et la section 3 b) s'applique à elle : licence CC BY-SA 4.0 ou compatible, texte ou URI de la licence joint, et interdiction d'imposer des conditions supplémentaires. La section 4 c) impose en outre les conditions d'attribution de la section 3 a).

Conséquence : le fichier JSON de mots exporté par le pipeline est publié sous CC BY-SA 4.0. Il est isolé des autres exports.

### 4.2 Les fiches FR sont-elles contaminées

Non, à condition de tenir la règle du brief : ne pas dériver les définitions FR des définitions EN de CC-CEDICT.

Raisonnement. Le partage à l'identique ne se propage qu'à ce qui est dérivé du matériel licencié. Une fiche FR rédigée pour l'app, dont l'origine, l'anecdote et les exemples ne sont pas traduits ni réécrits à partir d'une entrée CC-CEDICT, est une œuvre indépendante. La section 3 b) ne s'y applique pas. La cohabitation dans le même bundle relève de l'agrégation, pas de l'adaptation.

Ce qui détruirait ce raisonnement : traduire une glose anglaise de CC-CEDICT, même reformulée, ou faire traduire ces gloses par un modèle. Le pipeline doit donc ne jamais exposer la colonne de définition anglaise de CC-CEDICT aux invites de génération FR. Ce contrôle est à ajouter à `uv run wenlu check`.

Ce qui reste couvert : la liste des mots, le pinyin et leur organisation. On les traite comme un fichier à part, sous CC BY-SA 4.0.

### 4.3 App Store et mesures techniques

Les sections 2 a) 5) C) et 3 b) 3) interdisent d'appliquer des mesures techniques de protection qui restreindraient l'exercice des droits sur le matériel licencié et sur l'Adapted Material. Le chiffrement appliqué par l'App Store au binaire pose la même question qu'au §2.1. Même atténuation : publier hors de l'app, sur le site public, le fichier de mots dérivé sous CC BY-SA 4.0, avec l'attribution requise.

### 4.4 Si cette position n'est pas tenable

Alternative : n'utiliser CC-CEDICT que comme source de vérification hors distribution, et construire la liste de mots à partir des listes officielles (Eduscol, HSK) avec le pinyin d'Unihan `kMandarin`, sous Unicode License. Coût : travail de sélection et de segmentation plus lourd, pas d'obligation de partage à l'identique.

## 5. Unihan et UCD

Licence Unicode, telle que reproduite dans le fichier `LGPL` de Make Me a Hanzi (consulté le 21 septembre 2026) : usage sans restriction, y compris commercial, à trois conditions — conserver la notice de copyright et la notice de permission avec toutes les copies, les faire figurer dans la documentation associée, et indiquer clairement dans chaque fichier modifié que les données ont été modifiées.

Décision : **utilisable avec obligations**. C'est la source la moins contraignante du lot. Elle devient la source de référence pour le pinyin et le nombre de traits.

Vérification faite le 21 septembre 2026 sur Unihan 17.0.0 (archive `Unihan.zip` du 24 juillet 2025, en-tête « Unicode Version 17.0.0 », obtenue par un miroir GitHub, `unicode.org` restant bloqué) : **aucun champ `kIDS`**. Les en-têtes des huit fichiers de l'archive annoncent leurs champs ; `Unihan_IRGSources.txt` s'arrête à `kRSUnicode` et `kTotalStrokes`, et aucun autre fichier ne porte de décomposition. Même constat sur les huit fichiers d'Unihan 18.0.0 (31 juillet 2026), et `PropertyAliases-17.0.0.txt` ne déclare aucune propriété de décomposition côté Han. `kFrequency` a disparu des deux versions — il existait encore en 12.0.0 : Unihan ne fournit plus de fréquence, et le pipeline ne la lit que si une version la rétablit.

### 5.1 cjk-decomp — décompositions de repli

`https://github.com/amake/cjk-decomp`, consulté le 21 septembre 2026 (fork du projet de Gavin Grover, l'original CodePlex ayant fermé). Le README annonce une distribution **au choix sous six licences** — Apache 2.0, LGPL 3.0, CC BY-SA 3.0, MIT, ODC-By 1.0, EPL — et le dépôt porte le texte de l'Apache 2.0. Le projet retient la **MIT** : permissive, sans partage à l'identique, compatible avec un export propriétaire.

Décision : **utilisable avec obligations** (reproduire la notice de copyright et le texte MIT : `data/sources/licences/MIT-cjk-decomp.txt`, copié dans chaque export, et la ligne de `LICENCES.md`, que l'écran « Licences » et le site reprennent). Le README ne donne ni année ni autre titulaire que « originally compiled by Gavin Grover » : c'est la notice reproduite. Usage, depuis le 28 septembre 2026 : la source de la décomposition canonique, derrière nos surcharges (§10). Le pipeline convertit ces décompositions en IDS ; les codes de disposition de cette source étant plus fins que les douze opérateurs IDS, les composants obtenus sont fiables mais la structure est approchée : chaque caractère exporté a été relu contre la norme, et ce que cjk-decomp ne rendait pas s'est écrit dans `data/sources/surcharges/ids.tsv`.

À écarter, confirmé : les tables IDS de CHISE et de `cjkvi/cjkvi-ids`, sous GPL.

## 6. Normes et listes officielles

Aucune de ces trois sources n'a pu être vérifiée en ligne : `eduscol.education.fr` est bloqué par le proxy de sortie, et aucun texte de licence n'a été consulté pour GF 0014-2009 ni pour le référentiel HSK 3.0. Les décisions ci-dessous reposent sur la nature des documents, pas sur une lecture de leurs conditions de réutilisation.

| Source | Décision | Raisonnement |
|---|---|---|
| GF 0014-2009 | utilisable pour la logique | La liste des 514 composants et leur découpage sont des données factuelles normatives. On s'en sert comme règle de décomposition. On ne reproduit ni le texte du document, ni sa mise en page, ni ses commentaires. |
| Listes Eduscol | utilisable comme liste | Un seuil de caractères est une liste de faits. On reprend les caractères et leur rang, pas les textes d'accompagnement du programme. |
| Référentiel HSK 3.0 | utilisable comme liste | Idem. Le PDF n'est ni rediffusé ni extrait page par page dans l'app. Seules les tables caractère/niveau et, depuis le 29 septembre 2026 (dictionnaire), mot/niveau/pinyin/catégorie entrent dans le pipeline, par deux transcriptions sous MIT. |

Dans les trois cas, l'attribution est faite sur l'écran « Licences » par courtoisie et pour la traçabilité, même si elle n'est pas exigée.

### 6.1 Calendrier des fêtes — `lunar_python`

Les dates des huit fêtes (春节, 元宵, 端午, 七夕, 中秋, 重阳 au calendrier luni-solaire chinois ; 清明 et 冬至 à leur terme solaire) sont calculées hors ligne avec `lunar_python` 1.4.8 (`https://github.com/6tail/lunar-python`, MIT, sans dépendance), dans `uv run wenlu fetes calendrier`, qui écrit `data/sources/fetes/calendrier.tsv` ; les tests vérifient le calcul contre des dates connues (春节 2026-02-17 et 2027-02-06, 中秋 2026-09-25 et 2027-09-15, 元宵 2026-03-03, 清明 2026-04-05, 端午 2026-06-19, 七夕 2026-08-19, 重阳 2026-10-18, 冬至 2026-12-22…) et relisent chaque date dans la table des fêtes de la bibliothèque, et `wenlu check` refait le calcul à chaque passage.

Décision : **utilisable**. La bibliothèque ne sort pas du pipeline ; `fetes.json` ne porte que des dates, qui ne sont pas protégeables. Les textes des fêtes (vœu, phrases de Tao, anecdote) sont rédigés pour l'app, dans `data/sources/fetes/textes.tsv`, colonne `source`.

Les vingt-quatre termes solaires (二十四节气) suivent la même règle : `uv run wenlu saisons calendrier` calcule leurs instants avec la même bibliothèque, à l'heure de Pékin, et écrit `data/sources/saisons/termes.tsv` ; les tests les vérifient contre des dates connues (秋分 2026-09-23, 冬至 2026-12-22, 立春 2027-02-04…) et relisent chaque jour de début dans la bibliothèque. `saisons.json` ne porte que des dates et des textes rédigés pour l'app (`data/sources/saisons/textes.tsv`) : les faits de nature viennent de l'almanach commun des soixante-douze pentades 七十二候.

## 7. Polices anciennes

### 7.1 Sigillaire (小篆)

`https://github.com/lxgw/LxgwSeal`, consulté le 21 septembre 2026. Le README indique une licence SIL Open Font License 1.1, avec le fichier `OFL.txt`. Réserve de nom : les dérivés ne peuvent pas reprendre « 霞鹜 » sans autorisation écrite. Couverture annoncée : 75 caractères du bloc Small Seal d'Unicode 18.0, environ 300 visés.

`https://github.com/frankslin/kaiyuan-small-seal-font`, consulté le 21 septembre 2026. Le README annonce SIL OFL 1.1 pour la fonte, des glyphes tracés sur des éditions du 說文解字 tombées dans le domaine public, et une couverture du bloc Seal d'Unicode 18.0 (U+3D000..U+3FC3F, 11 328 positions). Le projet précise que la police n'est pas encore publiée et que 10 927 positions sur 11 090 sont calées.

Décision : **utilisable avec obligations** dès qu'une police OFL couvre notre corpus. L'OFL 1.1 autorise l'embarquement dans un logiciel vendu. Obligations : joindre `OFL.txt`, conserver les notices de copyright, ne pas vendre la police seule, ne pas réutiliser un Reserved Font Name pour une version modifiée.

État aujourd'hui : LxgwSeal ne couvre pas assez de caractères, Kaiyuan n'est pas publiée. La forme sigillaire n'est donc pas livrable pour le seuil 255 en l'état. Repli : n'afficher la forme ancienne que pour les caractères couverts, et masquer la section sinon. La correspondance caractère moderne vers position sigillaire passerait par la propriété Unihan `kSEAL_MCJK`, sous Unicode License ; non vérifiée sur `unicode.org`, bloqué depuis cet environnement.

### 7.2 Oracle (甲骨文)

Aucune police oraculaire sous licence ouverte n'a pu être vérifiée. Le dépôt `https://github.com/shikunpneg/Oracle-Bone-Script-IME`, consulté le 21 septembre 2026, embarque la police 方正甲骨文 (`FZJIAGW.ttf`) sous une autorisation d'usage commercial gratuit publiée par Founder, ce qui est un contrat d'éditeur et non une licence ouverte ; ses poids de modèle s'appuient par ailleurs sur des données HUST-OBC en CC BY-NC-ND 4.0, non commerciales. La police « Oracular », annoncée sous OFL par des sources secondaires, n'a pas pu être consultée : son site est bloqué par le proxy de sortie.

Décision : **à écarter en l'état**. Aucune forme oraculaire n'entre dans l'app tant qu'une licence n'a pas été lue sur une source primaire. Alternatives à explorer : lire l'autorisation Founder et vérifier si elle couvre l'embarquement dans une app payante ; ou utiliser des images de glyphes oraculaires en CC0 sur Wikimedia Commons, source par source, avec le relevé des URL.

## 8. Obligations à implémenter

Écran et interface :

- Écran « Licences » dans Réglages, accessible hors ligne, listant chaque source, son usage, sa licence, son URL, et donnant accès au texte complet de la licence.
- Entrée « Licences et sources » sur le site public, avec le même contenu et les liens de téléchargement des données publiées.

Fichiers de licence à embarquer, tels quels :

- `ARPHICPL.TXT`, inaltéré, copié depuis `APL/english/` de Make Me a Hanzi.
- `LICENSE` MIT de Hanzi Writer, avec la notice « Copyright (c) 2014 David Chanin ».
- Texte de CC BY-SA 4.0 (`CC-BY-SA-4.0.txt`, pris dans `spdx/license-list-data`, versionné dans `data/sources/licences/` et copié dans l'export depuis le 4 octobre 2026) : celui des mots de CC-CEDICT, et des poids des tons s'ils dérivent un jour de voix sous CC BY-SA (§11).
- Notice de permission Unicode.
- `OFL.txt` de chaque police ancienne retenue, avec ses notices de copyright.
- Notice de copyright et texte de la MIT de cjk-decomp (`MIT-cjk-decomp.txt`).
- Texte de l'Open Government Data License 1.0 (`OGDL-Taiwan-1.0.txt`), avec l'attribution du jeu 5961 dans `tons.json` et `LICENCES.md` (§11).
- Aucun texte LGPL ni GPL : ni `dictionary.txt` ni rien qui en dérive n'est embarqué (§10).

Pipeline `data/` :

- Chaque JSON exporté porte un en-tête `license`, `source`, `source_url`, `modified` indiquant comment et quand le fichier a été dérivé. Exigé par l'APL §2 a).
- Composants découpés : un composant de GF 0014-2009 que `graphics.txt` ne dessine pas prend les traits désignés d'un caractère hôte (`data/sources/surcharges/decoupes.tsv`), recadrés par une homothétie arrondie à l'entier. C'est une modification de glyphe au sens de l'APL, toujours sous l'APL : `traits/MODIFICATIONS.md` décrit chaque découpe (hôte, indices, échelle, décalage) et le `modified` des fichiers qui en portent les nomme. Aucun trait n'est dessiné.
- Séparation physique : traits sous APL, mots sous CC BY-SA 4.0, fiches FR et EN propriétaires, dans des fichiers distincts. Ne jamais fusionner ces trois familles dans un même fichier.
- `uv run wenlu check` échoue si un export n'a pas d'en-tête de licence, ou si un fichier mélange deux régimes.
- `uv run wenlu build` n'expose jamais la colonne de définition anglaise de CC-CEDICT aux invites de génération FR. Contrôle à ajouter et à tester.
- `dictionary.txt` reste hors des artefacts distribués, et rien de ce qu'ils portent n'en dérive : la décomposition descend nos surcharges et cjk-decomp (§10). « licences : décompositions » de `uv run wenlu check` bloque dès qu'une décomposition exportée nomme `makemeahanzi` ; `uv run wenlu licences` en écrit la recette (`docs/licences-decompositions.md`).
- Les tracés de repli de l'app (`app/public/strokes-demo.json`, 89 caractères de `graphics.txt`) portent le même en-tête APL que `traits/` ; `wenlu check` le vérifie.

Marque :

- La marque est 文 tracé depuis Make Me a Hanzi. Dans l'app, elle se lit dans `traits/` de l'export, sous son en-tête APL. `app/scripts/icons.mjs` recopie ces tracés, mis à l'échelle, dans `favicon.svg` ; le fichier porte la mention de source, de licence et de modification en commentaire (APL §2 a)). Les PNG en sont des rendus. Question à poser au conseil avec le §9 : une icône App Store tirée d'une glyphe APL laisse-t-elle la marque libre de dépôt ?

Publication hors app :

- Dépôt ou répertoire public contenant les fichiers de traits dérivés sous APL, avec `ARPHICPL.TXT` et la note de modification.
- Même chose pour le fichier de mots dérivé de CC-CEDICT, sous CC BY-SA 4.0, avec l'attribution « CC-CEDICT, publié par MDBG, CC BY-SA 4.0 », le lien vers la source et l'indication que le fichier a été modifié.
- Lien vers ces fichiers depuis l'écran « Licences ».

App Store :

- Mention d'attribution dans la fiche : CC-CEDICT (MDBG), Arphic Technology, Hanzi Writer, polices OFL.
- Champ de copyright de la fiche : titulaire des droits sur les fiches et le code, sans revendiquer les données tierces.
- Vérifier avant soumission que la publication hors app des données APL et CC BY-SA est en ligne.

## 9. Questions restant ouvertes

- L'atténuation retenue pour l'App Store — publier hors de l'app les données APL et CC BY-SA — n'a pas été validée par un conseil. Le texte des conditions d'usage d'Apple n'a pas pu être lu : `www.apple.com` est bloqué par le proxy de sortie. À faire relire avant la phase 4.
- La clause APL §5 « no further restrictions » et la clause CC BY-SA 3 b) 3) sur les mesures techniques n'ont pas de jurisprudence connue appliquée à l'App Store pour des données. Risque résiduel assumé, à réévaluer.
- `tons.json` sous CC BY-SA 4.0 (décision « Voix CC BY-SA » du 3 octobre 2026, applicable dès que des poids dérivent d'une voix sous CC BY-SA ; ce n'est pas encore le cas, §11) : le binaire iOS chiffré par l'App Store est-il une mesure technique au sens des §2 a) 5) B) et §3 b) 3) de la 4.0 ? Même atténuation que pour les mots (§4.3) : le fichier publié en entier, avec sa licence et ses attributions, sur la page « Licences et sources » du site (le lien y est), hors de l'app. **Point ouvert**, à faire relire par le conseil avec le §4.3 avant d'embarquer des poids sous CC BY-SA dans l'app iOS.
- `kIDS` : tranché le 21 septembre 2026 et revérifié le 26 — la propriété n'existe ni dans Unihan 17.0.0 ni dans 18.0.0 (archives lues en entier) ; les décompositions de repli viennent de cjk-decomp (§5.1). `kSEAL_MCJK` reste à confirmer, `unicode.org` étant toujours bloqué depuis cet environnement.
- Conditions de réutilisation exactes des listes Eduscol et du référentiel HSK 3.0 : pages non consultées. À vérifier avant la story 1.1.
- Statut juridique du texte de GF 0014-2009 pour un éditeur non chinois : non vérifié.
- Aucune police oraculaire sous licence ouverte vérifiée. Décision reportée.
- Couverture sigillaire insuffisante aujourd'hui. Choix à refaire quand Kaiyuan sera publiée.
- Audio : tranché le 21 septembre 2026 en changeant de terrain. Plutôt que de faire vérifier les conditions d'un service, le pipeline exécute un modèle ouvert en local — **Kokoro** (`hexgrad/kokoro`), dont l'Apache 2.0 a été lue en entier sur `raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE` et dont le `README.md` du même dépôt annonce des poids sous la même licence ; nous ne redistribuons ni le code ni les poids, seulement des fichiers audio produits chez nous, sur lesquels l'Apache 2.0 ne dit rien, sans service appelé donc sans redevance par écoute. Retenu contre MeloTTS (MIT, mais aucune version publiée sur PyPI dans le dépôt officiel, `transformers==4.27.4` épinglé, `mecab-python3` à compiler et un `unidic download`) et CosyVoice 2 (Apache 2.0, mais conda, sous-modules git, `sox` système et 0,5 milliard de paramètres) : Kokoro seul s'installe par `uv` sans compilation, tient sur un CPU avec ses 82 millions de paramètres, et rend déjà du 24 kHz, la fréquence visée. La carte du modèle `hexgrad/Kokoro-82M-v1.1-zh` sur Hugging Face, illisible depuis l'environnement de développement, a été lue par le workflow `donnees` le 24 septembre 2026 : elle déclare `license: apache-2.0` (run 36026523964, fichier `carte-modele.md` de l'artefact). La réserve est levée ; les 731 premiers fichiers du seuil 255 ont été produits avec la voix `zf_001`. Azure AI Speech reste disponible en second (`--fournisseur azure`), avec sa ligne « à vérifier » inchangée et l'avertissement à chaque passage.
- Audio, justesse des tons des caractères : **vérifiée le 3 octobre 2026, défaut confirmé, non corrigé** (décision du propriétaire « vérifier puis corriger »). Mesure avec le code de l'app (`app/scripts/tons/audio.ts` : `suivreHauteur`, `analyserTrames`, `tons.json`, voix calibrée sur les caractères du lot) : sur les 248 caractères de l'app à ton plein, le ton visé n'est en tête que pour **39,5 %** (ton 1 : 37 %, ton 2 : 2 %, ton 3 : 5 %, ton 4 : 92 %) et le ton 3 ne fait un creux que pour 1,6 % ; mêmes chiffres pour les mêmes caractères redits aujourd'hui par Kokoro de la même façon. Les mots sont touchés aussi : sur 201 mots de l'app étiquetés, 43 % des syllabes en tête et 12,9 % des mots reconnus, contre 67,5 % pour les mots de Yue Tan (§11). Correctif essayé (`wenlu_data/porteurs.py`, étape `audio-porteurs` du workflow `donnees`, runs 37163362245 et 37164250596, branche `donnees/audio-porteurs`) : chaque caractère dit en phonèmes (zhuyin et ton, sans G2P ni sandhi) dans quinze porteurs — seul, « X. », « X! », « X，X。 » (la première ou la seconde), « X，X，X。 », « 我说X。 », « 我说X这个字。 », « 这个字读X。 », « 这个字读X，X。 », et à vitesse 0,8 —, coupé par la durée des phonèmes rendue par Kokoro, prolongée dans la pause jusqu'au silence, avec un fondu. Aucun porteur ne remplit le critère (85 % en tête, chaque ton à 70 %, ton 3 en creux pour la moitié, coupes nettes à 90 %, 30 points de mieux que l'actuel) : le meilleur, « 这个字读X。 », met 56 % des tons en tête (ton 1 : 85 %, ton 2 : 58 %, ton 3 : 67 %, ton 4 : 24 %) et coupe dans la voix du porteur ; ceux qui gagnent un ton en perdent un autre, et deux passages d'un même porteur ne donnent pas les mêmes tons. Kokoro ne réalise pas le ton qu'on lui écrit. **Aucun fichier de l'app n'est remplacé** ; `SHA256SUMS`, désormais écrit par `wenlu audio exporter`, donne l'empreinte des 731 fichiers embarqués. Reste à trouver une voix qui dise les tons : des enregistrements humains sous une licence qui permette de les embarquer, ou un autre modèle, à mesurer de la même façon (`wenlu audio porteurs`, `wenlu audio choisir`). La régénération est prête : `etapes: audio-porteurs` avec `porteur` refait les seuls caractères embarqués sous les mêmes noms, les mots repris tels quels (`wenlu audio reprendre`).
- Entité juridique porteuse du compte développeur, qui sera le titulaire des obligations d'attribution.
- Licence des décompositions : **tranchée** le 26 septembre 2026, migrée le 28 (§10.6). Reste, avec le conseil du §9 : l'argument « des décompositions sont des faits » n'est plus nécessaire à notre position, mais les écarts à la norme repris de la 0.1.0 (§10.6) sont à corriger avec les fiches.
- `app/public/strokes-demo.json` : corrigé le 28 septembre 2026, il porte l'en-tête APL (§10.6).

## 10. Licence des décompositions — dossier de décision (26 septembre 2026)

Question : la décomposition exportée (`parts` de chaque fiche) descendait la chaîne IDS de `dictionary.txt` (Make Me a Hanzi, LGPL 3.0+), que le §2.2 écarte de l'embarqué. L'app sera vendue sur l'App Store. **Tranchée le 26 septembre 2026, migrée le 28 : voir §10.6.** Les §10.1 à §10.5 sont le dossier de décision tel qu'il a été présenté, gardé pour l'historique ; leurs chiffres sont ceux de la version 0.1.0 avant la migration, et l'outil de mesure qu'ils citent (candidats, `--telecharger`, simulations) a été retiré de `wenlu licences` une fois la décision appliquée.

Recette, caractère par caractère : `docs/licences-decompositions.md`, écrit par `uv run wenlu licences` (`data/src/wenlu_data/licences.py`, testé par `data/tests/test_licences.py`) ; deux passages écrivent les mêmes octets. `uv run wenlu check` bloque dès qu'une décomposition exportée nomme `makemeahanzi` ou une source hors de nos surcharges et de cjk-decomp (« licences : décompositions »).

### 10.1 Inventaire de la version 0.1.0

582 caractères exportés (listes seuil 255 et HSK 1, fêtes, termes solaires, rangs du personnage, interface, mots expliqués des contes, et toutes leurs briques) :

| Groupe | Caractères | `parts` vient de |
|---|---|---|
| composants de la norme (briques, feuilles découpées) | 259 | GF 0014-2009 seule : `parts` vide, rien n'est descendu |
| décomposés à travers au moins un IDS de `dictionary.txt` | 304 | LGPL : feuilles de GF 0014-2009, découpage et ordre de Make Me a Hanzi (`sources` contient `makemeahanzi`) |
| décomposés sans Make Me a Hanzi | 19 | cjk-decomp (MIT) et nos surcharges (`ids.tsv`) seulement |

Champ par champ : chaque feuille de `parts` est un composant de la table GF 0014-2009, où la descente s'arrête ; le découpage jusqu'à ces feuilles et leur ordre viennent de la source d'IDS nommée par `sources`. En héritent `nouveau` et `role` (des index dans `parts`), la famille (`racine`, la première brique), les jours des parcours d'`index.json` (les prérequis) et `devinettes.json` (les briques citées ; l'opérateur de tête de `structure`, non exporté, choisit les leurres et contrôle la disposition). Le pinyin et les lectures n'en dépendent pas (Unihan et `pinyin.tsv`). L'ordre des parcours dépend en plus du nombre de dépendants de chaque brique, compté sur les 9 574 décompositions du build.

Autres emprunts à Make Me a Hanzi relevés par l'inventaire :

- Tracés (`graphics.txt`, Arphic Public License), embarqués : les 582 caractères de `traits/`, dont 13 composants découpés dans un hôte ; la marque et les icônes (文). L'usage commercial est couvert par le §2.1 : l'APL définit « Freely Available » comme une liberté « not price. If you wish, you can charge for this service », et n'interdit pas de vendre l'œuvre qui agrège la police ; restent les obligations du §2.1 (texte inaltéré, mention de modification, publication des tracés dérivés) et la question App Store du §9.
- **Écart relevé** : `app/public/strokes-demo.json`, 89 caractères tirés de `graphics.txt`, est embarqué en table nue, sans en-tête de licence ni mention de modification (APL §2 a)), et n'était nommé nulle part ici. À corriger : lui donner l'en-tête des fichiers de `traits/` (`lireTraits` lit déjà la clé `traits`) ou le retirer au profit de l'export ; le publier avec les autres tracés (§2 b)).
- `dictionary.txt` hors de `parts`, non embarqué : le contexte des fiches (rôle probable, type et indice d'étymologie, 472 caractères exportés en ont un), donné au rédacteur comme indice à vérifier, jamais recopié ; le contrôle du pinyin de la cuisine ; la liste des 9 574 caractères (qui est aussi celle de `graphics.txt`). Un seul fait en sort dans l'export : le pinyin de repli de la fiche relue de ⺮ (zhú), qu'Unihan ne donne pas.

### 10.2 Candidats, licence lue sur la source primaire

| Candidat | Licence, telle que lue | Où, quand | Embarquable | `parts` conservés (sur 323 décomposés) |
|---|---|---|---|---|
| Unihan `kIDS` | Unicode License v3 (texte lu dans `LICENSE` de `unicode-org/unihan-database`) | archive Unihan 17.0.0 entière (miroir, 24 juillet 2025) et les huit fichiers d'Unihan 18.0.0 (miroir `elixir-unicode`, 31 juillet 2026), 26 septembre 2026 | oui | **0** : aucune valeur `kIDS` |
| GF 0014-2009 et nos surcharges seules | données factuelles de la norme (§6) ; `ids.tsv` rédigé pour le projet | — | oui | 7 (les 259 composants n'en demandent pas) |
| cjk-decomp | au choix entre six licences dont la MIT (README), texte Apache 2.0 dans `LICENSE` | `amake/cjk-decomp`, 26 septembre 2026 | oui (déjà embarqué comme repli) | 272 (84,2 %) |
| BabelStone IDS | « anyone is free to make use of the IDS data provided in this file for personal or commercial purposes without asking permission or providing attribution. I furthermore waive any copyright claims to the presentation format » (en-tête de `IDS.TXT`, § 2) | `babelstone.co.uk` bloqué par le proxy ; lu sur deux miroirs GitHub indépendants (`mandel59/babelstone-ids`, `qundao/backup-babelstone-ids`), identiques octet pour octet (SHA-256 `cc2a0a97…`), version Unicode 16.0 du 27 juin 2025, 26 septembre 2026 | oui, sous réserve ci-dessous | 249 (77,1 %) |
| cjkvi-ids | « 'ids.txt' is derived from CHISE project. License follows their terms […] All other data are distributed under GPLv2 » (README) | `cjkvi/cjkvi-ids`, 26 septembre 2026 | **non** | 266 (82,4 %), pour information |
| CHISE IDS | « GNU General Public License […] either version 2, or (at your option) any later version » (README.md, section License) | `chise/ids`, 26 septembre 2026 | **non** | 228 (70,6 %), pour information |

« Conservés » : les composants obtenus sont ceux de l'export, au point de code près ou à la notation près (⺮ et 𥫗 sont le même composant 502) — `parts` ne bouge pas. Les surcharges passent devant chaque candidat, comme dans `wenlu build` ; six formes de notation hors de la table (⺹, 㐅, 龵, 夊, 𠆢, ⺶) sont ramenées au composant de la norme par `data/sources/surcharges/notation-candidats.tsv`.

Sur `kIDS` : l'hypothèse d'un champ ajouté en Unicode 15.1 ne se vérifie pas. UAX #38 n'a pas pu être lu (`unicode.org` et `unicode-org.github.io` bloqués) ; le README de `unicode-org/unihan-database`, qui liste les propriétés provisoires en chantier, ne le nomme pas ; une recherche ne trouve qu'une annonce de 2023 (Ken Lunde, `medium.com`, bloqué) visant une propriété provisoire pour la 17.0, qui n'y est pas. `wenlu licences` le cherche dans toute l'archive à chaque passage : si une version l'ajoute, la mesure se fera seule.

Réserve sur BabelStone : l'en-tête dit le fichier « based on IDS data provided by Kawabata Taichi », dont la lignée est celle de cjkvi-ids et de CHISE (GPL), puis corrigé en très grand nombre par Andrew West. Son argument — des IDS sont des faits, non protégeables — est posé en droit américain. Le même argument vaudrait pour `dictionary.txt` : c'est une question de conseil, à joindre à celle du §9, pas une raison de préférer la LGPL. Andrew West est mort en juillet 2025 ; le fichier n'évoluera plus que par ses miroirs.

### 10.3 Recommandation

Source par champ :

| Champ | Aujourd'hui | Proposé | Licence |
|---|---|---|---|
| `parts` d'un composant de la norme | GF 0014-2009 | inchangé | faits de la norme |
| `parts` et `structure` d'un caractère décomposé | surcharges > Make Me a Hanzi > cjk-decomp | surcharges > **cjk-decomp** > **BabelStone**, formes de notation ramenées à la norme | nôtre ; MIT ; aucun droit revendiqué |
| univers des caractères du graphe (9 574) | `dictionary.txt` | `graphics.txt` : les mêmes, dans le même ordre | APL, déjà respectée ; une liste de caractères est un fait |
| ordre de fréquence des parcours | nombre de dépendants, recompté | **figé** : le nombre de dépendants du build d'aujourd'hui, versionné | nôtre (des décomptes) |
| `sources` | `makemeahanzi`, `cjk-decomp`, `surcharge` | `cjk-decomp`, `babelstone`, `surcharge` | — |
| pinyin, lectures | Unihan, `pinyin.tsv` | inchangé ; le repli de ⺮ passe dans `pinyin.tsv` | Unicode ; nôtre |
| contexte des fiches (rôle probable, étymologie) | `dictionary.txt`, hors distribution | inchangé, hors distribution (§2.2), ou abandonné | LGPL, sans obligation tant que rien n'est distribué |

cjk-decomp passe devant BabelStone parce que la mesure le dit : 273 décompositions conservées sur 323 et 269 opérateurs de tête inchangés, contre 267 et 260 dans l'autre ordre ; il est déjà dans la chaîne, sous une licence déjà affichée. BabelStone comble ce qu'il ne décrit pas (plus aucun caractère absent).

Ce que la chaîne proposée change, sur les 304 caractères LGPL : 254 conservés ; 50 à relire contre la norme — 33 aux composants différents (亲 做 刚 前 同 商 场 城 夜 师 帝 常 懂 放 教 新 旁 条 桌 榜 满 爷 班 真 网 花 苗 茶 菊 菜 菩 蒙 错), 9 qui nomment une autre variante du même groupe (告 唱 第 走 起 跑 跟 路 露), 4 dans un autre ordre (坐 弼 狼 画), 4 non réconciliés (举 候 兴 行) ; et 4 conservés dont l'opérateur de tête change (包 可 夏 着), à revoir pour les devinettes. Les écarts vont dans les deux sens — la chaîne pose 走 et 起 sur 龰 (足字底), comme l'export le fait déjà pour 跑, mais 跑, 跟 et 路 sur 止 — : la relecture tranche au cas par cas, une ligne d'`ids.tsv` et sa raison par caractère. Pour 20 des 50 (做 刚 商 坐 弼 懂 放 教 条 满 爷 狼 画 网 苗 菊 菜 菩 蒙 行), BabelStone rend déjà la décomposition exportée — cjk-decomp y écrit souvent 卄 (贲字腰) pour 艹 (草字头) ou ⺆ (周字框) pour 冂 (同字框) — : la surcharge n'a qu'à retenir le repli.

Rejoués de bout en bout (`wenlu licences`, section « Parcours rejoués ») :

- le témoin — la chaîne d'aujourd'hui rejouée — redonne le build à l'identique (0 décomposition changée, parcours identiques) : la simulation ne mesure que la source ;
- la chaîne proposée seule change 2 130 décompositions sur 9 574 et déplace les parcours dès le jour 7 (lire) et 4 (HSK) ;
- avec les 50 relectures confirmées mais les rangs recomptés, les parcours bougent encore dès le jour 16 et 26 : les décomptes de dépendants changent sur le reste du dictionnaire ;
- avec les 50 relectures confirmées **et** les rangs figés, les deux parcours sont identiques jour pour jour, et toutes les `parts` exportées aussi.

Figer les rangs est donc la condition pour que rien ne bouge côté app : les phrases des fiches, les lettres de Que et les dialogues WeChat sont écrits avec l'acquis du jour.

### 10.4 Plan de migration, s'il est retenu

1. Relire les 50 caractères et les 4 opérateurs de tête contre la table de la norme ; écrire pour chacun une ligne d'`ids.tsv` avec sa raison, ou accepter la nouvelle décomposition (alors relire la fiche, la devinette et les jours qui en dépendent). Relancer `wenlu licences` jusqu'à « remplacer, identique » partout.
2. Figer les rangs : un fichier versionné (`data/sources/parcours/rangs.tsv`, caractère et nombre de dépendants), écrit une fois depuis le build d'aujourd'hui et lu par le crochet `rangs_frequence` de `graphe.py`, qui existe déjà.
3. Pipeline : `fetch` ajoute BabelStone (URL officielle, puis les deux miroirs, en-tête exigé) ; `ingest` en écrit un IDS par caractère ; `gf0014.combiner_ids` prend cjk-decomp en principal et BabelStone en repli, après la table de notation ; l'univers vient de `graphies.json` ; `SourceIds` (`models.py`) remplace `makemeahanzi` par `babelstone` ; `FORMAT_EXPORT` augmente ; `LICENCES.md` de l'export perd la ligne `dictionary.txt` et sa « question ouverte », gagne la ligne BabelStone ; même chose sur l'écran Licences et le site. `dictionary.txt` reste téléchargé comme source de contrôle (§2.2), ou sort de `fetch` si le contexte des fiches s'en passe.
4. Tests : le contrôle « licences : décompositions » devient bloquant ; `wenlu licences` sert de recette (tout conservé, parcours identiques au témoin) ; un test d'export vérifie que la réexportation ne change dans `familles/*.json` que la valeur de `sources` ; les tests de `gf0014`, `graphe` et `export` s'adaptent au nouveau nom de source.
5. Effort estimé : une journée de relecture (50 + 4 caractères, contre la norme), une journée de pipeline et de tests, un réexport. Aucune fiche à réécrire si la relecture confirme les décompositions actuelles.

Autres voies, écartées ici mais ouvertes au propriétaire : garder `dictionary.txt` et remplir la LGPL (fichier d'actif séparé et remplaçable, textes LGPL et GPL joints, publication) — démonstration fragile sur iOS (§2.2) ; ou faire trancher par un conseil que la liste des composants, normalisée par GF 0014-2009, n'est pas protégeable — la même question que pour BabelStone.

### 10.5 Tableau de décision

| # | Décision à prendre | Proposition | Mesure qui l'appuie | Décision du propriétaire |
|---|---|---|---|---|
| 1 | Sortir la chaîne IDS de `dictionary.txt` de l'export | oui | 304 décompositions sur 323 en dépendent | oui (26 septembre) |
| 2 | Source principale des décompositions | cjk-decomp (MIT) | 272 conservées seul, 273 en chaîne | oui : cjk-decomp, MIT |
| 3 | Source de repli | BabelStone (aucun droit revendiqué), sous la réserve du §10.2 | comble les 2 absents de cjk-decomp | **aucune** : BabelStone écarté, un seul caractère de plus (回) et une lignée CHISE (GPL) ; nos surcharges à la place |
| 4 | Unihan `kIDS` | sans objet | champ absent de 17.0.0 et 18.0.0 | — |
| 5 | cjkvi-ids, CHISE | écartés | GPL v2, GPL v2+ | — |
| 6 | Relire les écarts | 50 caractères et 4 opérateurs de tête, une surcharge et sa raison chacun | `docs/licences-decompositions.md` | oui : 52 lignes rédigées pour Wenlu, plus 2 phonétiques (冈, 董) |
| 7 | Figer l'ordre de fréquence des parcours | oui | seule condition de parcours identiques | oui : l'ordre des jours lui-même, figé (§10.6) |
| 8 | `strokes-demo.json` sans en-tête APL | lui donner l'en-tête et le publier, ou le retirer | 89 caractères | en-tête APL ajouté ; fichier gardé, l'app le lit en repli |
| 9 | Faire relire par un conseil | oui, avec le §9 : APL et App Store, faits non protégeables (BabelStone, et `dictionary.txt` s'il reste) | — | reste à faire, avec le §9 |

### 10.6 Décision et migration (26 et 28 septembre 2026)

Décision du propriétaire, le 26 septembre 2026 : « Pour les licences, fais au mieux en trouvant une solution. » L'app sera vendue : aucune donnée de décomposition dérivée d'une source LGPL ou GPL n'est embarquée. Migration faite le 28 septembre 2026.

Ce qui a été retenu :

- **Chaîne de la décomposition** : nos surcharges (`data/sources/surcharges/ids.tsv`), puis cjk-decomp sous la **MIT**, choisie parmi ses six licences ; ses formes de notation hors de la table sont ramenées à la norme (`notation-candidats.tsv`, lu désormais par `wenlu build`). Obligation de la MIT : la notice de copyright (« Gavin Grover », seul titulaire que nomme le README, sans année) et le texte de la licence, dans `MIT-cjk-decomp.txt`, copié dans chaque export et nommé par `LICENCES.md`.
- **BabelStone écarté** : il n'ajoutait qu'un caractère à cjk-decomp (回), et ses données descendent en partie de celles de Kawabata Taichi, lignée de CHISE et de cjkvi-ids (GPL). cjkvi-ids et CHISE restent écartés. Le code de mesure des candidats a été retiré.
- **Nos surcharges pour le reste** : 52 lignes nouvelles (section 3 d'`ids.tsv`), une par caractère exporté que cjk-decomp ne rendait pas à l'identique — composants, ordre ou disposition, que lisent les devinettes (包 可 夏 着) et les fiches — ou ne décrivait pas (回, 候). Chaque ligne est rédigée pour Wenlu, cite les composants de la norme par leur numéro d'ordre, dit ce que cjk-decomp écrivait, et porte la mention « rédigé pour Wenlu d'après GF 0014-2009 ». Une décomposition comme fait — quels composants de la norme, dans quelle disposition — n'est pas protégeable ; le fichier, lui, est notre travail et non une copie de lignes de `dictionary.txt`. Deux lignes de plus (section 4) donnent leur décomposition aux phonétiques 冈 et 董, par lesquelles cjk-decomp écrit 刚 et 懂, et `phonetiques.tsv` nomme 成 pour 城 : le contrôle du rôle son les retrouve.
- **Écarts à la norme repris, puis corrigés** : à la migration, où la décomposition affichée depuis la 0.1.0 s'écartait de la norme, la ligne la reprenait quand même, pour que rien ne bouge côté app, et nommait l'écart. Dix-huit lignes, vingt caractères : 候 场 夜 帝 旁 (et 榜) 桌 第 真 同 常 走 (et 起) 错 告 前 师 夏 举 画, dont neuf erreurs de fait (compte de traits, forme) héritées de Make Me a Hanzi. Décision du propriétaire, le 28 septembre 2026 : « Corrige, oui ». Corrigées le jour même (ci-dessous) ; le relevé, caractère par caractère, est `data/sources/surcharges/decompositions-corrigees.md`.
- **Ordre des parcours figé** : plutôt que les rangs de fréquence (§10.4), l'ordre des jours lui-même est versionné (`data/sources/parcours/ordre-lire.tsv`, `ordre-hsk.tsv`), écrit depuis la 0.1.0 avant la migration. `wenlu build` le lit, le valide contre le graphe (départ imposé, une brique par jour, chaque composé après ses briques, liste couverte, rien qui ne soit plus à apprendre) et s'arrête s'il ne tient plus ; `wenlu parcours figer` le réécrit, et son diff se relit. Tout changement de jour devient explicite. Le 30 septembre 2026, `wenlu parcours prolonger` a prolongé les deux ordres jusqu'au bout du HSK 7-9 (décision du propriétaire : les deux chemins suivent le HSK 3.0, GF 0025-2021, listes de `data/sources/listes/hsk-*.txt`), sans bouger un seul des jours figés ; la suite suit les mêmes décompositions (cjk-decomp et nos surcharges) et les mêmes règles de calcul, et l'en-tête de chaque fichier dit ses étapes et leur source.
- **Plus rien de `dictionary.txt` dans l'export** : `wenlu build` tire l'univers des caractères de `graphics.txt` (les mêmes 9 574, dans le même ordre) et ne lit plus `dictionary.txt` ; `wenlu ingest` n'en garde plus la décomposition ; le modèle `Fiche` refuse la source `makemeahanzi` ; le contrôle « licences : décompositions » devient bloquant. Le pinyin de ⺮, seul fait qui venait encore du contexte des fiches, vient de `pinyin.tsv` (zhú, comme 竹 dans Unihan). `dictionary.txt` reste téléchargé pour ce que le §2.2 permet hors distribution : l'étymologie donnée au rédacteur comme indice, et des contrôles de pinyin.
- **Tracés de repli** : `app/public/strokes-demo.json` garde ses 89 caractères (l'app en lit quatre hors export : 安 尔 故 森) et prend l'en-tête APL de `traits/`, tracés sous la clé `traits` ; `wenlu check` le vérifie.

Vérification, sur la version 0.1.0 réexportée :

- Décompositions exportées : 323 (plus 259 composants de la norme, sans décomposition). Sources : cjk-decomp seul 231, nos surcharges seules 59, les deux 33 ; `dictionary.txt` **0**. La recette (`docs/licences-decompositions.md`) redescend chacune avec la chaîne et retrouve les `parts` exportés et la structure du build pour les 323.
- Export comparé fichier par fichier, JSON par JSON, à celui d'avant : seules changent la valeur de `sources` (304 fiches), `LICENCES.md`, et l'arrivée de `MIT-cjk-decomp.txt` (en plus de la date et de l'empreinte d'`index.json`). `parts`, `nouveau`, `role`, `roles`, les familles, le pinyin, les deux parcours jour pour jour, `devinettes.json` (dispositions et leurres), les lettres, WeChat, l'éclair, la cuisine, les coquilles, les contes et leurs périmètres sont identiques.
- Hors de l'export, 2 030 décompositions sur les 9 574 du graphe changent (caractères rares que cjk-decomp découpe autrement) : sans effet sur l'app, puisque l'ordre des jours est figé et que chaque caractère exporté est porté par cjk-decomp ou par une surcharge relue.

Correction des dix-huit écarts (28 septembre 2026) :

- **Décompositions** : chaque ligne donne la lecture de la table, comptée trait par trait contre `graphics.txt` et appuyée par les exemples (例字) du fac-similé ; elle garde « rédigé pour Wenlu d'après GF 0014-2009 » et dit ce qu'affichait la 0.1.0. Neuf composants sans tracé (帝字头, 𢎨, 𠃍, 龷, 夜下角, 丆, 𠃓, 𰀁, リ) se découpent dans leur caractère (`decoupes.tsv`) et restent acquis d'entrée. 举 reste non réconcilié (⺍), comme 兴.
- **Fiches** : 候, 同, 常, 走, 前, 师 et 画 reprennent composants, rôles et, sauf 画, la phrase d'origine qui les nomme ; étiquettes inchangées (`attesté`), l'histoire ne dépendant pas du découpage. 候 déclare sa phonétique 矦 dans `phonetiques.tsv`. La fiche de 冂 change de phrase. Relues sous l'accord permanent du propriétaire.
- **Parcours** : six jours changent de brique, aucun composé de jour (lire 154 et 181 ; HSK 167, 171, 191 et 214) ; refigés par `wenlu parcours figer`. Les devinettes de 告, 走 et 旁, qui citeraient un composant découpé, sans carte, sont retirées ; celle de 画 suit l'ordre d'écriture.
- **Export** : 330 décompositions ; cjk-decomp seul 233, nos surcharges seules 60, les deux 37 ; `dictionary.txt` 0. Familles déplacées : 帝, 旁, 真, 同, 告, 前, 师, 夏 ; familles 凡, 勿, 廿, 直 retirées.
- **Relevé en passant** : le 学字头 de la norme (413, 𭕄) compte trois traits, sans 冖 ; la découpe de 𭕄 dans 学, et avec elle 学, 觉, 兴 et 举, sont à reprendre, ce qui déplacerait les jours dès le jour 13 : décision laissée au propriétaire (`decompositions-corrigees.md`).

## 11. Les poids du classifieur des tons (29 septembre 2026)

La question « Dis-le » (story 9.1) reconnaît le ton d'un caractère prononcé, sur l'appareil, sans réseau : un suivi de hauteur (YIN, code de l'app) et un petit ensemble de perceptrons, 31 Ko de poids (`data/sources/tons/modele.json`, exportés dans `tons.json`). Provenance complète, empreintes et méthode : `data/sources/tons/PROVENANCE.md`.

- **Entraînement** : les deux voix du jeu 5961 de data.gov.tw (1 467 syllabes chacune), sous Open Government Data License 1.0. Le texte intégral (`data/sources/licences/OGDL-Taiwan-1.0.txt`) a été lu : licence mondiale, gratuite, irrévocable, pour tout usage, produits et services dérivés compris (§2.1) ; l'attribution est obligatoire, faute de quoi la licence est nulle *ab initio* (§3.2) ; compatible CC BY 4.0 (§4.2). Les poids en dérivent : ils sont à nous, sous l'obligation d'attribuer. Aucun son n'est embarqué.
- **Attribution** : `wenlu export` l'écrit dans `tons.json` (champ `attribution`) et dans `LICENCES.md`, que la page « Licences et sources » du site reprend ; le texte de la licence est copié dans l'export. `wenlu check` (« tons : poids », « tons : export ») bloque si la licence, l'attribution, la provenance ou l'empreinte des poids manquent, ou si les poids dépassent 1 Mo.
- **Contours paramétriques** : tirés des descriptions phonétiques des tons (Chao, Xu 1997), générés par le script d'entraînement, sans donnée tierce.
- **Développement et test** : `hugolpz/audio-cmn` (CC BY-SA) et les fichiers Kokoro de l'app servent à régler les seuils et à mesurer ; aucun poids n'en dérive, rien n'en est distribué. Le partage à l'identique de la CC BY-SA ne s'applique donc pas.
- **Écartés** : Tone Perfect (MSU), non commercial ; `zispace/hanyu-pinyin-audio`, sans licence. Common Voice (CC0), AISHELL-1 et THCHS-30 (Apache 2.0, licences non lues) restent des pistes pour réentraîner sur des voix du continent, depuis le workflow `donnees` : leurs sites sont bloqués ici.
- **Fiche du jeu 5961, lue le 1er octobre 2026** (étape `tons` du workflow `donnees`, pages gardées avec leur empreinte sur la branche `donnees/tons`) : « CNS11643中文標準交換碼全字庫(簡稱全字庫) », fourni par le 數位發展部, publié le 2015-01-31 ; la ressource « 全字庫聲音檔 » (`Voice.zip`) est celle des syllabes ; licence au choix « 政府資料開放授權條款-第一版 » (l'OGDL 1.0, retenue) ou OFL 1.1. L'attribution complète en découle (`tons.py`, `PROVENANCE.md`).
- **Voix du continent, licences lues le 1er octobre 2026** (même étape, mêmes pages gardées) : FLEURS, Google, **CC BY 4.0** (étiquette `license:cc-by-4.0` de la fiche du jeu sur Hugging Face) ; THCHS-30, CSLT de l'université Tsinghua, **Apache 2.0** (page OpenSLR 18) ; AISHELL-1, Beijing Shell Shell Technology, **Apache 2.0** (page OpenSLR 33). Les trois permettent l'usage commercial et des poids dérivés, avec attribution (et, pour Apache 2.0, la notice). Rien n'en est encore dérivé : ce sont des phrases lues, il faut d'abord un alignement syllabe par syllabe.
- **Voix du continent, essai du 30 septembre 2026** : pour réentraîner sur le mandarin standard (le ton 3 plongeant), aucune source n'a pu être lue ici. huggingface.co (la carte de FLEURS, Google), arxiv.org (l'article de FLEURS), openslr.org (THCHS-30, AISHELL-1), commons.wikimedia.org et lingualibre.org (enregistrements de caractères isolés), mozillafoundation.org (Common Voice) et data.gov.tw sont refusés par le proxy de l'environnement (403). Seul l'audio de FLEURS `cmn_hans_cn` s'atteint (`storage.googleapis.com/xtreme_translations/FLEURS102/cmn_hans_cn.tar.gz`, 2 522 990 658 octets, SHA-256 `0b412f291a8790db9226a1d4b69f811d5ace99cffae2a3df994a15af335190f3`), sans fichier de licence dans l'archive ni dans le seau, et le code de TFDS qui le décrit ne donne que la licence de son propre code (Apache 2.0). La licence de FLEURS n'est donc pas lue : rien n'en est dérivé. L'étape `tons` du workflow `donnees` lit ces pages depuis un runner GitHub et les garde dans l'artefact, avec leur empreinte. Les mots de Yue Tan (`hugolpz/audio-cmn`, CC BY-SA) servent à mesurer la question de mot, jamais à entraîner (`data/sources/tons/PROVENANCE.md`, « Les mots de deux syllabes »).
- **FLEURS, essai du 3 octobre 2026** (accord du propriétaire du même jour) : l'audio `cmn_hans_cn` (même archive, même empreinte), sous CC BY 4.0 (carte lue le 1er octobre), a été étiqueté syllabe par syllabe avec les lectures du dépôt et la liste HSK, sans CC-CEDICT (`fleurs.py`), aligné par un programme écrit ici, sans outil ni modèle tiers (`aligner.py`), puis mêlé aux voix de Taïwan pour réentraîner. Les phrases de `dev` et `test`, dont les locuteurs ne sont pas ceux de `train`, n'ont servi qu'à mesurer. Le modèle mêlé reconnaît mieux la parole enchaînée du continent, mais perd le ton 3 des caractères isolés (Yue Tan : 92 % → 58 à 75 %) : `modele.json` n'est pas remplacé, **aucun poids versionné ni exporté ne dérive de FLEURS**, et l'attribution exportée reste celle de l'OGDL. Si des poids en dérivaient, l'attribution CC BY 4.0 de FLEURS (Google, Conneau et al. 2022, arXiv:2205.12446) serait à exporter avec elle (`tons.py`, `LICENCES.md`) ; `entrainer.py --fleurs` l'écrit déjà dans les poids, et `wenlu check` les refuse tant qu'elle n'est pas exportée. Méthode et mesures : `data/sources/tons/PROVENANCE.md`, « Les voix du continent ».
- **Kokoro, voix synthétiques du continent, essai du 3 octobre 2026** : Kokoro (`hexgrad/Kokoro-82M-v1.1-zh`, Apache 2.0, déjà fournisseur de l'audio de l'app) a dit, dans le workflow `donnees` (étape `tons-voix`), 400 caractères isolés et 400 mots HSK de deux syllabes avec chacune de 24 voix chinoises, plus `zf_001` (la voix de l'app) pour le test seulement ; le texte lui est passé en phonèmes tirés de la liste HSK et des lectures du dépôt, jamais de CC-CEDICT (`data/sources/tons/voix_kokoro.py`). Licence : l'Apache 2.0 régit le code et les poids de Kokoro, que nous ne redistribuons pas ; elle ne dit rien des sorties, produites chez nous, comme les fichiers audio de l'app (§9). Seules les caractéristiques calculées par le code de l'app sont gardées (branche `donnees/tons-voix`), aucun son. Si des poids en dérivaient, ce serait une synthèse faite par nous, sans attribution exigée, à côté des contours paramétriques. Mais Kokoro ne réalise pas les tons d'un caractère isolé (une même courbe descendante pour les quatre tons, au même registre) : mêlées aux voix de Taïwan, ses voix font régresser le ton 3 des caractères de Yue Tan (92,4 → 90,0 à 91,5 %) et Chen Wang (88,3 → 75,8 à 85,8 %) sans faire progresser les mots. `modele.json` n'est pas remplacé : **aucun poids versionné ni exporté ne dérive de Kokoro**, l'attribution exportée reste celle de l'OGDL. Méthode et mesures : `data/sources/tons/PROVENANCE.md`, « Les voix synthétiques du continent ».
- **Voix humaines sous CC BY-SA, décision du propriétaire du 3 octobre 2026 (« Voix CC BY-SA »), instruite les 3 et 4 octobre** : entraîner sur de vraies voix humaines du continent sous CC BY-SA, CC BY ou CC0, qui disent des caractères et des mots isolés ; en contrepartie, les poids passent sous **CC BY-SA 4.0**, avec l'attribution de chaque source, le code de l'app restant propriétaire. Licences lues fichier par fichier, depuis le workflow `donnees` (étape `tons-cc` ; le poste n'atteint ni Commons, ni Lingua Libre, ni Shtooka), pages gardées avec leur empreinte sur la branche `donnees/tons-cc` (`licences-lues/`) : Yue Tan, **CC BY-SA 3.0 United States** (readme de la collection Shtooka, par l'Internet Archive, packs.shtooka.net ne répondant plus) ; quatre locuteurs de Lingua Libre, **CC BY-SA 4.0** (Fake estate, Jouketou, Luilui6666) et **CC0 1.0** (CanonNi), sur 4 126 fichiers `cmn` lus (aucun NC ni ND ; apprenants déclarés et lecteurs de Taïwan écartés ; les fiches Lingua Libre des locuteurs, que le serveur refuse au runner, lues pour deux d'entre eux par l'Internet Archive). Chen Wang : « CC-by-sa » sans version, licence douteuse, mesure seulement. Relicence : la CC BY-SA 3.0 (§4 b) permet de placer l'œuvre adaptée sous une version ultérieure aux mêmes éléments, la 4.0 ; la 4.0 (§3 b) et la CC0 aussi. Étiquettes de la liste HSK et des lectures du dépôt, jamais de CC-CEDICT. Validation croisée par locuteur (code de l'app, trois graines) : les caractères reconnus montent sur les deux voix tenues à part, mais le ton 3 des caractères de Yue Tan, tenue à part, régresse (92,4 → 89,6 % ; 91,8 % avec les seuls caractères) : la règle d'adoption n'est pas remplie, **`modele.json` n'est pas remplacé, aucun poids versionné ni exporté ne dérive de ces voix, `tons.json` reste sous le régime de l'OGDL, `MOTS_DIRE` reste éteint**. Le reste est en place pour un modèle qui en dériverait : `tons.py` recense les voix et leur attribution (`VOIX_CC`), `wenlu check` refuse une source sans attribution exportée, NC, ND ou sans version, et des poids qui ne se disent pas sous CC BY-SA 4.0 ; `wenlu export` écrirait la licence, son lien, `CC-BY-SA-4.0.txt` et l'attribution de chaque source ; la page des licences publie `tons.json` et le texte de la licence. Point ouvert : le DRM de l'App Store (§9). Méthode et mesures : `data/sources/tons/PROVENANCE.md`, « Les voix humaines sous CC BY-SA ».
- **Le profil de tons des mots, décision du propriétaire du 4 octobre 2026 (« Revoir la méthode des mots »), essayé du 4 au 7 octobre** : un petit modèle des mots (le profil de tons du mot entier, 50 Ko de poids, `entrainer_mots.py`), mêlé au modèle des caractères inchangé. Deux variantes, à cause du point ouvert sur la CC BY-SA et le DRM de l'App Store (§9) : **libre**, entraînée sans aucune source CC BY-SA (mots dits par Kokoro, sorties produites chez nous ; CanonNi, Lingua Libre, **CC0 1.0** ; les pseudo-mots des voix de Taïwan, OGDL 1.0, permis mais écartés par le développement), adoptable tout de suite si elle passait la règle ; **CC BY-SA**, avec Yue Tan (CC BY-SA 3.0 US) et Fake estate, Jouketou, Luilui6666 (CC BY-SA 4.0), dont les poids seraient allés dans un fichier à part (`tons-mots.json`) sous CC BY-SA 4.0 avec l'attribution de chaque voix (`tons.VOIX_CC`), `tons.json` restant sous le régime de l'OGDL. Le script refuse toute source CC BY-SA dans la variante libre, et toute licence NC, ND ou sans version dans l'autre ; son bloc de licence est relu par les contrôles de `tons.py` (`data/tests/test_tons_mots.py`). Mesure en validation croisée par locuteur, trois graines : 77,6 % (libre) et 79,0 % (CC BY-SA) des mots de Yue Tan tenue à part, sous les 80 % de la règle. **Aucune variante n'est adoptée : aucun poids des mots n'est versionné ni exporté, aucun fichier sous CC BY-SA n'est préparé, `MOTS_DIRE` reste éteint ; l'attribution exportée reste celle de l'OGDL.** L'avis juridique attendu ne changerait rien à ce jour (la variante CC BY-SA ne passe pas non plus). Méthode et mesures : `data/sources/tons/PROVENANCE.md`, « Le profil de tons du mot entier ».
