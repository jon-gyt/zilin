# Sources et licences

Décision de la story 0.4. Vérification faite le 21 septembre 2026 sur les sources primaires.
Ce document fait foi pour le pipeline `data/` et pour l'écran « Licences » de l'app.

Hypothèse de distribution : PWA gratuite sur le web, app iOS payante (achat à vie et abonnement), donc usage commercial et distribution par l'App Store.

## 1. Synthèse

| Source | Usage | Licence vérifiée | Décision |
|---|---|---|---|
| Make Me a Hanzi — `graphics.txt` | traits, médianes | Arphic Public License | utilisable avec obligations |
| Make Me a Hanzi — `dictionary.txt` | décompositions, pinyin, définitions EN, étymologie EN | LGPL 3.0 ou ultérieure (+ notice Unicode) | utilisable avec obligations ; à écarter de l'embarqué, remplacé par Unihan |
| `hanzi-writer-data` | traits et médianes (JSON) | Arphic Public License | utilisable avec obligations ; redondant avec `graphics.txt` |
| Hanzi Writer (bibliothèque) | animation et quiz de tracé | MIT | utilisable avec obligations |
| CC-CEDICT | mots, pinyin | CC BY-SA 4.0 | utilisable avec obligations |
| Unihan / UCD | pinyin, traits (pas de décomposition : `kIDS` n'existe pas) | Unicode License | utilisable avec obligations ; source à privilégier |
| cjk-decomp | décompositions converties en IDS, source de repli | MIT (au choix parmi six licences) | utilisable avec obligations |
| Norme GF 0014-2009 | 514 composants | texte normatif, non vérifié en ligne | utilisable pour la logique ; ne pas reproduire le document |
| Listes Eduscol | parcours Lire | publication officielle, page non consultable | utilisable comme liste de caractères ; pas de reprise de texte |
| Référentiel HSK 3.0 | parcours HSK | publication officielle, page non consultable | idem ; ne pas rediffuser le PDF |
| LxgwSeal (小篆) | formes sigillaires | SIL OFL 1.1 | utilisable avec obligations ; couverture insuffisante aujourd'hui |
| Kaiyuan Small Seal (小篆) | formes sigillaires | SIL OFL 1.1 annoncée | à surveiller ; police non encore publiée |
| Polices 甲骨文 | formes oraculaires | aucune licence ouverte vérifiée | à écarter en l'état |
| Audio — Kokoro (hexgrad) | voix neuronale pré-générée, modèle exécuté dans le pipeline | Apache 2.0, code et poids — `LICENSE` et `README.md` du dépôt lus le 21 septembre 2026, carte du modèle (`license: apache-2.0`) lue le 24 septembre 2026 | **fournisseur par défaut** ; rien n'est redistribué hors de nos propres fichiers, aucune redevance par écoute |
| Audio — Azure AI Speech (Microsoft) | voix neuronale pré-générée | **à vérifier** : conditions non lues, `learn.microsoft.com` bloqué par le proxy de sortie (21 septembre 2026) | second fournisseur, hors défaut ; aucun fichier synthétisé par lui n'entre dans un artefact distribué avant lecture des conditions |

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

À écarter : `cjkvi/cjkvi-ids` (consulté le 21 septembre 2026), distribué sous GPL v2, donc incompatible avec un export propriétaire.

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

Ce qui détruirait ce raisonnement : traduire une glose anglaise de CC-CEDICT, même reformulée, ou faire traduire ces gloses par un modèle. Le pipeline doit donc ne jamais exposer la colonne de définition anglaise de CC-CEDICT aux invites de génération FR. Ce contrôle est à ajouter à `uv run zilin check`.

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

Décision : **utilisable avec obligations** (reproduire la notice de copyright et le texte MIT sur l'écran « Licences »). Usage limité : le pipeline convertit ces décompositions en IDS et ne s'en sert que là où Make Me a Hanzi note `？` ou ne dit rien. Les codes de disposition de cette source étant plus fins que les douze opérateurs IDS, les composants obtenus sont fiables mais la structure est approchée : les caractères concernés sont marqués dans `decompositions.json` et listés dans `ecarts.md` pour relecture.

À écarter, confirmé : les tables IDS de CHISE et de `cjkvi/cjkvi-ids`, sous GPL.

## 6. Normes et listes officielles

Aucune de ces trois sources n'a pu être vérifiée en ligne : `eduscol.education.fr` est bloqué par le proxy de sortie, et aucun texte de licence n'a été consulté pour GF 0014-2009 ni pour le référentiel HSK 3.0. Les décisions ci-dessous reposent sur la nature des documents, pas sur une lecture de leurs conditions de réutilisation.

| Source | Décision | Raisonnement |
|---|---|---|
| GF 0014-2009 | utilisable pour la logique | La liste des 514 composants et leur découpage sont des données factuelles normatives. On s'en sert comme règle de décomposition. On ne reproduit ni le texte du document, ni sa mise en page, ni ses commentaires. |
| Listes Eduscol | utilisable comme liste | Un seuil de caractères est une liste de faits. On reprend les caractères et leur rang, pas les textes d'accompagnement du programme. |
| Référentiel HSK 3.0 | utilisable comme liste | Idem. Le PDF n'est ni rediffusé ni extrait page par page dans l'app. Seule la table caractère/niveau entre dans le pipeline. |

Dans les trois cas, l'attribution est faite sur l'écran « Licences » par courtoisie et pour la traçabilité, même si elle n'est pas exigée.

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
- Texte de CC BY-SA 4.0, ou son URI si le texte complet est jugé trop lourd ; la section 3 a) 2) l'autorise.
- Notice de permission Unicode.
- `OFL.txt` de chaque police ancienne retenue, avec ses notices de copyright.
- Textes LGPL 3.0 et GPL 3.0 seulement si `dictionary.txt` finit malgré tout par être embarqué ; la décision actuelle est de ne pas l'embarquer.

Pipeline `data/` :

- Chaque JSON exporté porte un en-tête `license`, `source`, `source_url`, `modified` indiquant comment et quand le fichier a été dérivé. Exigé par l'APL §2 a).
- Séparation physique : traits sous APL, mots sous CC BY-SA 4.0, fiches FR et EN propriétaires, dans des fichiers distincts. Ne jamais fusionner ces trois familles dans un même fichier.
- `uv run zilin check` échoue si un export n'a pas d'en-tête de licence, ou si un fichier mélange deux régimes.
- `uv run zilin build` n'expose jamais la colonne de définition anglaise de CC-CEDICT aux invites de génération FR. Contrôle à ajouter et à tester.
- `dictionary.txt` reste hors des artefacts distribués.

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
- `kIDS` : tranché le 21 septembre 2026 — la propriété n'existe ni dans Unihan 17.0.0 ni dans 18.0.0 ; les décompositions de repli viennent de cjk-decomp (§5.1). `kSEAL_MCJK` reste à confirmer, `unicode.org` étant toujours bloqué depuis cet environnement.
- Conditions de réutilisation exactes des listes Eduscol et du référentiel HSK 3.0 : pages non consultées. À vérifier avant la story 1.1.
- Statut juridique du texte de GF 0014-2009 pour un éditeur non chinois : non vérifié.
- Aucune police oraculaire sous licence ouverte vérifiée. Décision reportée.
- Couverture sigillaire insuffisante aujourd'hui. Choix à refaire quand Kaiyuan sera publiée.
- Audio : tranché le 21 septembre 2026 en changeant de terrain. Plutôt que de faire vérifier les conditions d'un service, le pipeline exécute un modèle ouvert en local — **Kokoro** (`hexgrad/kokoro`), dont l'Apache 2.0 a été lue en entier sur `raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE` et dont le `README.md` du même dépôt annonce des poids sous la même licence ; nous ne redistribuons ni le code ni les poids, seulement des fichiers audio produits chez nous, sur lesquels l'Apache 2.0 ne dit rien, sans service appelé donc sans redevance par écoute. Retenu contre MeloTTS (MIT, mais aucune version publiée sur PyPI dans le dépôt officiel, `transformers==4.27.4` épinglé, `mecab-python3` à compiler et un `unidic download`) et CosyVoice 2 (Apache 2.0, mais conda, sous-modules git, `sox` système et 0,5 milliard de paramètres) : Kokoro seul s'installe par `uv` sans compilation, tient sur un CPU avec ses 82 millions de paramètres, et rend déjà du 24 kHz, la fréquence visée. La carte du modèle `hexgrad/Kokoro-82M-v1.1-zh` sur Hugging Face, illisible depuis l'environnement de développement, a été lue par le workflow `donnees` le 24 septembre 2026 : elle déclare `license: apache-2.0` (run 36026523964, fichier `carte-modele.md` de l'artefact). La réserve est levée ; les 731 premiers fichiers du seuil 255 ont été produits avec la voix `zf_001`. Azure AI Speech reste disponible en second (`--fournisseur azure`), avec sa ligne « à vérifier » inchangée et l'avertissement à chaque passage.
- Entité juridique porteuse du compte développeur, qui sera le titulaire des obligations d'attribution.
