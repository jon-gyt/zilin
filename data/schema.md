# Schéma d'export

`uv run wenlu export --version 0.1.0` écrit `app/public/data/0.1.0/`, les seuls
fichiers que l'app lira. Cette section décrit ce qui est réellement écrit
(story 1.6) ; les sections suivantes décrivent les formats intermédiaires de
`data/work/`, qui restent hors dépôt, et les fiches de `data/sources/fiches/` et les
contes de `data/sources/contes-versions/`, versionnés.

Règle : l'app ne lit que ces fichiers. Aucune donnée de contenu dans le code.

## Périmètre d'une version

Les caractères que posent les deux chemins — le seuil 255 et le HSK 1 (le chemin
gratuit), puis le HSK 2 à 7-9 (Wenlu complet, décision du 30 septembre 2026) — et
**leurs briques** (prérequis transitifs de la décomposition canonique). Les jeux
(devinettes, éclair, coquilles), les paires et les traits des familles, précachés, restent
au chemin gratuit (`LISTES_CIBLES`, `per_gratuit` d'`export.assembler`) ; les traits
des familles portent en plus ce que les lots du dictionnaire ne dessinent pas, et le
reste de la suite se dessine depuis `traits/dico-<n>.json`, chargés à la demande
(`content.traitsDe`). Export du 30 septembre 2026 : 476 familles, 3 190 caractères.
Une famille n'est exportée qu'avec ses membres du périmètre ; la famille 口 en a
18 ici, contre 525 dans le graphe complet. Les caractères que les fêtes
dessinent depuis leurs traits (`data/sources/fetes/textes.tsv` : le caractère
bonus de chaque anecdote et le 福 du vœu) y entrent aussi, avec leurs briques,
comme le caractère à lire de chaque terme solaire (`data/sources/saisons/textes.tsv`)
et les titres des douze rangs du personnage (`data/sources/heros/rangs.tsv`), dessinés
sur son écran et au 放榜, et les caractères des mots expliqués des contes (狼, 苗, 叶公, 弈秋, 虱子…),
que le lecteur dessine avant le texte.
Version 0.1.0 : 248 familles, 532 caractères (234 briques, 13 feuilles découpées,
aucune muette), 2,5 Mio. Tout caractère exporté a ses traits.

## Arborescence

```
app/public/data/0.1.0/
  index.json                 la porte d'entrée
  LICENCES.md                chaque source, sa licence, son attribution
  ARPHICPL.TXT               texte de l'Arphic Public License, inaltéré
  UNICODE-LICENSE.txt        notice de permission Unicode (pinyin)
  MIT-cjk-decomp.txt         notice et texte de la MIT de cjk-decomp (décompositions)
  paires.json                les caractères à ne pas confondre
  fetes.json                 le calendrier des fêtes et leurs textes
  saisons.json               les vingt-quatre termes solaires et leurs textes
  devinettes.json            les devinettes de lanternes (灯谜)
  eclair.json                le dictionnaire éclair : des mots à deviner
  coquilles.json             les messages de la coquille
  cuisine.json               la cuisine de Tao : dix recettes, l'étal, Tao qui goûte
  lettres.json               les lettres de Que relues (aucune aujourd'hui)
  wechat.json                le message WeChat : les dialogues avec l'ami
  heros.json                 le personnage : douze rangs, trois bêtes, les phrases de Tao
  jouer.json                 l'écran Jouer : les phrases de la bulle de Tao
  rythme.json                le rythme gratuit : les lignes du menu, de la route et de Clore
  rappels.json               le rappel quotidien (iOS) et la garde de la progression
  ouvertures.json            l'aventure : le calendrier d'ouverture des portes, les annonces de Tao
  ecrans.json                les textes de « Lire le monde », des révisions, du personnage, de la route, de « Dis-le », de Mon chemin, du dictionnaire et du maître Xing
  anecdotes.json             les anecdotes du jour, une par caractère
  trois-lignes.json          les trois lignes du pas Utiliser, un texte par jour du chemin
  examens.json               les examens 科举 et les 月课 : la liste, les séries relues
  tons.json                  les poids du classifieur des tons de « Dis-le », avec leur attribution
  OGDL-Taiwan-1.0.txt        le texte de la licence des données dont ces poids dérivent
  CC-BY-SA-4.0.txt           le texte de la CC BY-SA 4.0 (mots de CC-CEDICT ; poids des tons dérivés de voix CC BY-SA)
  familles/<racine>.json     une famille : `Famille` de models.py
  traits/<racine>.json       les tracés de la famille, sous APL, et rien d'autre
  traits/ARPHICPL.TXT        la même licence, à côté des fichiers qu'elle couvre
  traits/MODIFICATIONS.md    comment et quand les tracés ont été dérivés
  ecriture/gabarits.json     les gabarits de l'écriture au doigt (3 000 caractères du HSK), sous APL
  ecriture/ARPHICPL.TXT      la même licence, à côté des gabarits
  ecriture/MODIFICATIONS.md  comment et quand les gabarits ont été dérivés des médianes
  contes/<id>.json           un conte relu, une version par niveau (trois au seuil 255)
  MIT-hsk30.txt              notice et texte de la MIT d'ivankra/hsk30 (liste des mots)
  dico/index.json            le dictionnaire : l'index unique de Chercher, précaché
  dico/caracteres/<n>.json   les entrées de caractère, par lots, chargées à la demande
  dico/mots/<n>.json         les entrées de mot, par lots, chargées à la demande
  traits/dico-<n>.json       les tracés des 3 000 caractères et de leurs composants, sous APL
```

Trois régimes de licence, trois familles de fichiers, jamais mêlés
(`docs/sources-licences.md` §8). Chaque JSON porte en tête `version`, `license`,
`source`, `source_url`, `modified`.

## `index.json`

```json
{
 "version": "0.1.0",
 "date": "2026-09-21T21:48:14Z",
 "empreinte": "sha256:…",
 "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "norme": "GF 0014-2009",
 "perimetre": "seuil 255 et HSK 1 : les caractères des deux listes et leurs briques",
 "licences": "LICENCES.md",
 "compte": {"familles": 238, "caracteres": 485, "briques": 222, "muettes": 0, "decoupees": 13,
            "fiches_relues": 0, "contes": 0},
 "listes": {"seuil-255": ["…"], "hsk-1": ["…"]},
 "parcours": {"lire": {"liste": "seuil-255", "regle": "…", "gratuit": 189,
                       "etapes": [{"liste": "seuil-255", "fin": 189}, {"liste": "hsk-1", "fin": 230}],
                       "jours": [{"jour": 1, "brique": "人", "composes": [],
                                  "non_reconcilie": false}]},
              "hsk": {"…": "…"}},
 "familles": [{"racine": "亻", "fichier": "familles/亻.json",
               "traits": "traits/亻.json", "n": 14, "avancement_possible": 0.0}],
 "contes": [{"id": "…", "titre_fr": "…", "titre_en": "…", "seuils": [255],
             "fichier": "contes/….json"}],
 "catalogue": [{"id": "…", "titre_zh": "…", "titre_pinyin": "…", "titre_fr": "…",
                "titre_en": "…", "niveaux": [255, "hsk3"], "chapitres": 1,
                "motif": "montagne"}],
 "paires": "paires.json",
 "heros": "heros.json",
 "jouer": "jouer.json",
 "rythme": "rythme.json",
 "rappels": "rappels.json",
 "ecrans": "ecrans.json",
 "ouvertures": "ouvertures.json",
 "tons": "tons.json",
 "dictionnaire": "dico/index.json",
 "ecriture": "ecriture/gabarits.json"
}
```

- `date` est le seul champ qui change à contenu égal — et encore : l'export relit
  la date de la version précédente tant que rien d'autre n'a bougé, si bien que
  deux passes écrivent les mêmes octets.
- `empreinte` est celle du build dont l'export est tiré : `sha256` de la liste
  `nom sha256` des fichiers lus (`decompositions.json`, `graphe.json`,
  `parcours-*.json`, `listes.json`, `graphies.json`, `unihan.json`,
  `composants.tsv`, les paires, les textes de licence, chaque fiche et chaque
  conte écrits). `wenlu check` la recalcule pour dire si l'export est périmé.
  `mots.json` (CC-CEDICT) n'en est pas : l'export ne le lit pas.
- L'empreinte couvre aussi le code qui écrit l'export : sa première ligne est
  `format N`, où `N` est `FORMAT_EXPORT` d'`export.py`, et `export.py` lui-même
  y entre comme un fichier lu (`exporteur`). Règle : **incrémenter
  `FORMAT_EXPORT` à chaque changement de ce que l'export écrit à entrées égales**
  (clé ajoutée ou renommée, ordre, règle de sélection). Toucher `export.py`
  suffit déjà à rendre l'export périmé, même sans changement de format — un
  commentaire aussi : on réexporte. Comme l'empreinte change, `date` avance, et
  avec elle le jour du champ `modified` de chaque fichier.
- `parcours` reprend les jours de `parcours-<nom>.json` : une brique nouvelle par
  session de 10 minutes, puis un ou deux composés ; `gratuit`, le dernier jour du chemin
  gratuit (au-delà, les leçons sont de Wenlu complet, `app/src/lib/droits.ts`), et
  `etapes`, `[{liste, fin}]`, le dernier jour de chaque liste.
- `avancement_possible` est la part des caractères de la famille qui portent une
  fiche relue — le plafond de ce que l'app peut enseigner, pas la progression de
  l'apprenant, qui vient d'IndexedDB.
- Le nom de fichier d'une famille est sa racine ; un composant de la norme sans
  point de code (écrit en IDS, sur plusieurs caractères) prend un nom en
  `U+XXXX-U+XXXX`.

## `familles/<racine>.json`

`Famille` de `models.py`, validé par pydantic avant écriture, précédé de
l'en-tête de licence : `{version, license, source, source_url, modified, norme,
racine, fiches}`.

`racine` est une `Brique` : `{c, pinyin, fr, en, origine, etiquette}`, repris de la
fiche de la racine (`fr`, `en` : son sens). `fiches` porte une `Fiche` par caractère
de la famille, triée par caractère :

- `c`, `pinyin` — le pinyin vient d'Unihan (`kMandarin`), jamais de
  `dictionary.txt` ni de CC-CEDICT (`docs/sources-licences.md` §2.2 et §4.2), sauf
  là où `data/sources/surcharges/pinyin.tsv` le corrige : sa première lecture, la
  principale, est alors celle de l'export (地 dì et non la particule de).
- `lectures` : toutes les lectures valides du caractère, la principale (`pinyin`)
  en tête, puis celles de la surcharge, de `kMandarin`, de `kTGHZ2013` et de
  `kXHC1983` (Unihan), sans doublon : 好 `["hǎo", "hào"]`, 得 `["dé", "de", "děi"]`.
  Vide quand le caractère n'a pas de pinyin. La question de ton de l'app n'accepte
  que la principale et ne propose jamais les autres comme leurres.
- `parts` : la décomposition canonique GF 0014-2009, dans l'ordre d'écriture ;
  vide pour une brique, qui est une feuille de la norme.
- `sources` : d'où vient la chaîne IDS descendue pour cette décomposition,
  `cjk-decomp` (MIT) ou `surcharge` (une décomposition versionnée de
  `data/sources/surcharges/ids.tsv`, rédigée pour Wenlu d'après GF 0014-2009), ou les
  deux. Vide pour une brique. `makemeahanzi` n'est plus une valeur permise depuis le
  28 septembre 2026 (`docs/sources-licences.md` §10) : le modèle `Fiche` la refuse et
  « licences : décompositions » bloque `wenlu check`.
- `nouveau` : les index, dans `parts`, de l'élément ajouté — le composant posé le
  même jour que le caractère dans son parcours de référence (`lire`, sinon
  `hsk`). C'est le seul élément que l'app met en cinabre.
- `role` : le rôle de cet élément ajouté ; `roles` : le rôle de chaque brique de
  la décomposition (`son`, `sens`, `forme`). Nuls sans fiche relue.
- `origine_fr`, `origine_en`, `etiquette`, `memo_fr`, `memo_en`, `mots`,
  `phrase` : repris d'une fiche **relue** de `data/sources/fiches/`. Sans fiche
  relue, les textes sont vides, `etiquette` et `role` nuls — jamais d'étiquette
  sans origine — et `statut` vaut `sans_fiche` au lieu de `relu`.
- `niveaux` : `{"seuil": 255}` ou `{"hsk": 1}`, selon les listes qui portent le
  caractère.
- `fr`, `en` : le sens, `sens_fr` et `sens_en` d'une fiche relue (voir « Le sens ») ;
  vides sans elle. Aucune définition anglaise n'entre dans l'export, ni
  `kDefinition` d'Unihan, ni CC-CEDICT. Depuis le format 11 (`FORMAT_EXPORT`).
- `traits`, `medianes` : **toujours vides ici**. Les tracés sont sous Arphic
  Public License et vivent dans `traits/`, jamais dans un fichier propriétaire.
- `audio` : `null` en attendant la story 1.5.

## `traits/<racine>.json`

```json
{"version": "0.1.0", "license": "Arphic Public License",
 "license_file": "ARPHICPL.TXT", "source": "Make Me a Hanzi — graphics.txt",
 "source_url": "https://github.com/skishore/makemeahanzi",
 "modified": "2026-09-21 : conversion de format … et sous-ensemble de caractères …",
 "traits": {"人": {"s": ["M 475 485 …"], "m": [[[483, 736], …]]}}}
```

`s` les tracés, `m` les médianes, comme `strokes-demo.json`. Le fichier ne porte
rien d'autre : c'est la séparation physique exigée par l'APL §2 et par
`docs/sources-licences.md` §8. `modified` est la mention exigée par l'APL §2 a),
reprise en toutes lettres dans `traits/MODIFICATIONS.md`. Les tracés et les
médianes ne sont ni arrondis ni simplifiés, sauf ceux des composants découpés dans
un caractère hôte (`data/sources/surcharges/decoupes.tsv`) : les traits désignés de
l'hôte, recadrés par une homothétie arrondie à l'entier. `modified` nomme ces
composants dans les fichiers qui en portent, et `MODIFICATIONS.md` décrit chaque
découpe (hôte, indices des traits, échelle et décalage). Écriture compacte (sans
indentation) : indentés, ces milliers de nombres pèseraient dix fois plus.

## Le dictionnaire : `dico/` et `traits/dico-<n>.json` (stories D.2 et D.3)

La loupe Chercher devient un dictionnaire du HSK 3.0 (décisions du propriétaire du
29 septembre 2026, `maquettes/dictionnaire.html`) : les 3 000 caractères de
`data/sources/listes/hsk-*.txt` et les 11 092 mots de `hsk-mots.tsv`, en consultation
libre. `dictionnaire.py` les écrit ; `index.json` y renvoie par sa clé `dictionnaire`,
absente quand il n'y a rien à écrire. Rien ne vient de CC-CEDICT.

Trois sortes de fichiers, tous écrits compacts (sans indentation) :

- **l'index**, `dico/index.json`, le seul chargé à l'ouverture de Chercher et le seul
  précaché (≈ 520 Kio bruts, ≈ 150 Kio en gzip) ;
- **les lots d'entrées**, `dico/caracteres/<n>.json` (60 lots de 50 caractères) et
  `dico/mots/<n>.json` (56 lots de 200 mots), chargés à l'ouverture d'une fiche et mis en
  cache au fil de la lecture ;
- **les lots de traits**, `traits/dico-<n>.json` (64 lots), chargés quand un caractère se
  dessine : le lot `n` de traits porte exactement les caractères du lot `n` de fiches
  (lots 0 à 59), puis viennent les composants hors liste (lots 60 et suivants).

Les lots suivent l'ordre du pinyin : la lecture principale numérotée (`hao2` avant `hao3`),
puis le point de code pour les caractères, les syllabes puis l'`id` pour les mots. Une
recherche par syllabe (`hao`) tombe donc dans un ou deux lots de caractères.

### `dico/index.json`

```json
{"version": "0.1.0", "license": "propriétaire",
 "license_files": ["MIT-hsk30.txt", "UNICODE-LICENSE.txt", "MIT-cjk-decomp.txt"],
 "source": "liste HSK 3.0 (GF 0025-2021) : …", "source_url": "…", "modified": "…",
 "liste": "HSK 3.0 (GF 0025-2021), niveaux 1 à 9",
 "compte": {"caracteres": 3000, "mots": 11092, "sens_relus": 0, "origines_relues": 0,
            "lots_caracteres": 60, "lots_mots": 56, "lots_traits": 64},
 "niveaux": {"7": "7-9"},
 "fichiers": {"caracteres": "dico/caracteres/{lot}.json", "mots": "dico/mots/{lot}.json",
              "traits": "traits/dico-{lot}.json"},
 "colonnes": {"caracteres": ["c", "lectures", "niveau", "lot", "glose"],
              "mots": ["id", "formes", "lectures", "niveau", "lot", "glose"]},
 "caracteres": [["好", "hao3|hao4", 1, 15, ""]],
 "mots": [["L1-0474", "知道", "zhi1 dao5|zhi1 dao4", 1, 52, ""],
          ["L1-0004", "爸爸|爸", "ba4 ba5|ba4", 1, 1, ""]],
 "traits_hors_liste": {"亻": 60}}
```

Une ligne par entrée, en tableau, dans l'ordre de `colonnes` (un objet par ligne pèserait
le double) :

- `c` ou `id` : l'identifiant de l'entrée, le caractère lui-même ou l'`id` du mot
  (`L1-0002`), la clé de son lot ;
- `formes` (mots) : les graphies, séparées par `|`, la principale en tête ;
- `lectures` : les lectures numérotées, séparées par `|` ; dans une lecture de mot, une
  syllabe par sinogramme, séparées par une espace. Un caractère donne toutes ses lectures
  (la principale d'abord : 好 `hao3|hao4`) ; un mot, sa lecture retenue, puis sa lecture
  pleine (`·`, mots de position) et celles de ses variantes. `v` pour ü, `5` pour le ton
  neutre, `r5` pour le 儿 de l'érhua ;
- `niveau` : 1 à 6, et 7 pour « 7-9 » (`niveaux`) ;
- `lot` : le numéro du lot où lire l'entrée (`fichiers`), et, pour un caractère, ses traits ;
- `glose` : la glose française **relue** de l'entrée, 40 caractères au plus, celle de la
  liste des résultats et de la recherche par le français ; `""` tant que le sens n'est pas
  relu, et pour un mot d'un seul caractère (son sens est celui du caractère). Aujourd'hui
  seules les gloses reprises des fiches relues sont remplies.

`traits_hors_liste` : le lot de traits de chaque composant d'une décomposition réconciliée
qui n'est pas un des 3 000 (亻, 氵, 亠…), pour dessiner les briques d'une fiche.

### `dico/caracteres/<n>.json`

`{version, license, license_files, source, source_url, modified, lot, entrees}`, où
`entrees` associe chaque caractère du lot à son entrée :

```json
{"c": "好", "pinyin": "hǎo", "lectures": ["hǎo", "hào"], "niveau": 1,
 "decomposition": {"norme": "GF 0014-2009", "parts": ["女", "子"], "sources": ["cjk-decomp"]},
 "mots": ["L1-0002", "L1-0138", "…"],
 "chemin": {"hsk": 14, "lire": 13},
 "sens": null, "exemples": [], "origine": null}
```

- `pinyin`, `lectures` : comme les fiches des familles (Unihan et surcharges, la
  principale en tête).
- `decomposition` : la décomposition canonique GF 0014-2009 et ses sources, comme `parts`
  et `sources` d'une fiche ; `parts` vide pour une brique de la norme. **`null` quand elle
  n'est pas réconciliée** (16 caractères sur 3 000 depuis la story 10.9 : 兴, 检, 敢…, `decompositions-corrigees.md`) : l'app ne montre pas
  une décomposition que le pipeline n'a pas validée.
- `mots` : les `id` des mots dont une graphie contient le caractère, par niveau puis dans
  l'ordre de la norme (一 en a plus de deux cents).
- `chemin` : le jour du chemin où le caractère est posé, par parcours (`lire`, `hsk`) ;
  vide pour un caractère qu'aucun parcours ne pose encore. Le statut de l'apprenant (lu,
  dans N jours) se calcule dans l'app, sur sa progression.
- `sens`, `exemples` : les emplacements prévus, vides (ci-dessous).
- `origine` (story 10.11) : l'origine de la fiche **relue** du caractère (fiche de chemin ou
  fiche d'origine, `data/sources/fiches/`), `{"statut": "relu", "etiquette": "atteste" |
  "mnemotechnique", "fr": "…", "en": "…", "roles": {"女": "sens", "子": "sens"}}` ; `null`
  sans fiche relue, et l'app dit « origine à venir », jamais inventée. Jamais d'étiquette
  sans texte. `roles` n'est rempli que si la fiche décompose comme `decomposition.parts`, un
  rôle par brique ; `{}` sinon (et pour un caractère non réconcilié). « dico : sens relus
  seulement » refuse une origine qui n'est pas relue ou sans étiquette ; `compte.origines_relues`
  de l'index les compte.

### `dico/mots/<n>.json`

Même en-tête, `entrees` par `id` :

```json
{"id": "L1-0474", "hanzi": "知道", "pinyin": "zhīdao", "syllabes": ["zhi1", "dao5"],
 "niveau": 1, "categories": ["V"], "officiel": "知道", "pleines": ["zhi1", "dao4"],
 "sens": null, "exemples": []}
```

`hanzi`, `pinyin`, `syllabes`, `categories` (les codes de `categorie`, section « Liste des
mots HSK 3.0 »), `officiel` viennent de `hsk-mots.tsv`. Clés présentes seulement quand elles
servent : `pleines` (la lecture au ton plein), `variantes` (`[{hanzi, pinyin, syllabes}]`,
爸 pour 爸爸), `emploi` (l'emploi que la norme cite, 第二 pour 第).

### Les emplacements `sens` et `exemples` (stories 10.6 et 10.7)

Le pipeline rédige (`dico_sens.py`, ci-dessous), la relecture humaine passe chaque texte à
`relu`, et **seuls les textes `relu` s'exportent** (`dictionnaire.sens_exporte`,
`exemples_exportes`) : un sens `a_relire` ou `rejete` reste hors de l'export, comme une
fiche. Formes exportées :

```json
"sens": {"statut": "relu", "glose": "bon ; bien",
         "acceptions": [{"categorie": "Adj", "fr": "bon, bien, satisfaisant"},
                        {"categorie": "V", "fr": "aimer, avoir le goût de", "pinyin": "hào"}]},
"exemples": [{"zh": "这本书很好看。", "pinyin": "Zhè běn shū hěn hǎokàn.",
              "fr": "Ce livre est très bien.", "statut": "relu"}]
```

- `glose` : 40 caractères au plus, sans point final ni sinogramme ; c'est elle, et elle
  seule, qui passe dans la colonne `glose` de l'index. Une glose relue plus longue ou vide
  fait échouer l'export.
- `acceptions` : une à trois, chacune avec la catégorie (codes de la liste) et son texte ;
  `pinyin`, seulement pour un caractère, quand l'acception se lit autrement que la lecture
  principale (好 hào, 长 cháng, 还 huán). Vide pour une glose reprise d'une fiche relue :
  aucune acception n'a été relue avec elle.
- `exemples` : une ou deux phrases écrites par le pipeline avec les seuls caractères du HSK
  (pas de Tatoeba, décision du 29 septembre 2026), leur pinyin écrit par mot, leur
  traduction.

**Un mot d'un seul caractère** (好 adjectif, 号 nom, 们 suffixe : 408 entrées aux HSK 1 et
2) n'a pas de sens à lui : son entrée de `dico/mots/` garde `sens: null` et `exemples: []`,
et sa glose d'index reste vide. Ses sens et ses phrases sont ceux du caractère, dans
`dico/caracteres/`, dont les acceptions portent la catégorie de chaque emploi de la liste
(et sa lecture quand elle diffère). Tranché par la story 10.6, en accord avec 10.8 (le mot
d'un seul caractère se range sous la fiche du caractère, jamais en ligne à part) : l'app
lit le sens de « Comme mot » dans les acceptions du caractère de même catégorie.

`documents()` prend `sens` et `exemples` par identifiant d'entrée (le caractère ou l'`id`
du mot) ; `export.assembler_dictionnaire` les lit dans les lots rédigés
(`dico_sens.pour_export`), tous statuts, et `documents()` n'en garde que les relus.

#### Les lots rédigés : `data/sources/dico/<niveau>/<lot>.json`

Le circuit des fiches et des lettres, sans API (`wenlu dico`) :

1. `wenlu dico plan` range les entrées de chaque niveau en lots de 50 : chaque caractère de
   `hsk-<n>.txt` devant le premier mot du niveau qui le contient, puis les mots de plusieurs
   caractères dans l'ordre de la liste, les caractères restants à la fin. Un niveau ne
   dépend d'aucun autre : ses lots, ses brouillons et ses fichiers lui sont propres, et deux
   rédacteurs peuvent écrire deux niveaux en même temps.
2. `wenlu dico contexte <niveau> <lot>` donne les faits de chaque entrée : sinogrammes,
   pinyin retenu et officiel, catégories, niveau, lectures du caractère (Unihan et
   surcharges), mots d'un seul caractère qu'il porte, sens déjà écrits des caractères d'un
   mot, voisins de la liste, glose relue d'une fiche ; et les caractères des niveaux 1 à n.
   Jamais la colonne `CEDICT` d'ivankra, `mots.json` ni `unihan-definitions.json`
   (`kDefinition` n'est pas autorisé tant que le propriétaire n'a pas tranché).
3. Le rédacteur écrit `data/sources/dico-brouillons/<niveau>/<lot>.json` :
   `{"entrees": {"<id>": {"glose", "acceptions": [[cat, fr], [cat, fr, pinyin]],
   "exemples": [[zh, pinyin, fr]]}}}`, ou `{"reprise": true, "exemples": […]}` pour reprendre
   telle quelle la glose relue d'une fiche (le sens du caractère, ou celui d'un mot de fiche
   au même pinyin).
4. `wenlu dico importer` valide tout le lot (`valider()`), refuse tout s'il y a une faute, et
   écrit le lot : chaque entrée (`id`, `genre`, `hanzi`, `pinyin`, `categories`, `mots` : les
   mots d'un seul caractère qu'elle porte), son `sens` et ses `exemples`, chacun avec son
   `statut`, et le bloc `generation` des fiches (`modele` « rédaction manuelle », `api`
   « session Claude Code (sans API) », `date`, `empreinte_invite` : l'empreinte du
   brouillon, `contexte` : la commande qui donne les faits). Une glose reprise garde
   `statut: relu` et dit sa `provenance` (`reprise` : le fichier de la fiche, `champ`). Un
   brouillon inchangé ne réécrit rien ; un texte modifié repart `a_relire`.
5. `wenlu dico apercu --niveau 1 --niveau 2 --sortie <page>.html` écrit la page de relecture :
   un HTML autonome (données incluses, `<title>` puis `<style>`, sans `html`, `head` ni
   `body`), lot par lot ; le propriétaire marque « Bon », corrige (glose, acceptions,
   phrases) ou renvoie « À refaire » avec une note, et copie ses retours en JSON :
   `{"format": "wenlu-dico-relecture", "decisions": {"<id>": {"decision": "bon" | "corrige" |
   "a_refaire", "sens": {…}, "exemples": […], "note": "…"}}}`.
6. `wenlu dico appliquer-relecture <fichier>` les réintègre, tout ou rien : « bon » passe à
   `relu` ce qui était à relire ; « corrige » remplace les textes, les repasse par
   `valider()`, les passe à `relu` et garde le texte d'avant (`relecture.avant`), une phrase
   ôtée sans remplaçante allant dans `retirees` (elle ne revient pas du brouillon) ;
   « a_refaire » passe à `rejete`. Chaque texte relu porte `relecture` : `date`, `decision`,
   `par`, `note`. Réimporter le brouillon d'origine ne défait pas une correction.
7. `wenlu dico approuver --niveau <n> --decision "<citée>"` passe à `relu`, **sur décision du
   propriétaire et sans relecture ligne à ligne**, ce qui reste à relire aux niveaux donnés,
   après un dernier passage par `valider()`, tout ou rien. La trace le dit : `relecture` =
   `{date, par: "décision du propriétaire", mode: "sans relecture ligne à ligne", decision}`,
   pour qu'une vraie relecture puisse rattraper ces textes plus tard (chercher `mode`).
   HSK 1 et 2 approuvés ainsi le 30 septembre 2026 (« Considère que relecture faite », puis
   « Oui, affiche-les »). « dico sens : lots » refuse un texte `relu` qui ne dit pas qui l'a
   relu (fiche d'où la glose est reprise, page de relecture ou décision).

Contrôles (`wenlu check`), bloquants sauf les deux derniers : « dico sens : lots » (entrées
du plan, `generation` complète, statuts, glose reprise égale à celle de la fiche), « sans
sinogramme » (gloses, acceptions, traductions), « longueurs » (glose de 40 caractères, 1 à 3
acceptions, 2 phrases au plus, de 20 sinogrammes au plus, la phrase contient l'entrée),
« catégories » (celles de la liste pour un mot classé ; lecture d'une acception connue du
caractère), « phrases : caractères HSK » (les 3 000 et la ponctuation chinoise de la police),
« phrases : pinyin » (lu caractère par caractère dans les lectures du dépôt, le mot au pinyin
de la liste, ton neutre et écriture par mot compris, mots de position, majuscule et
ponctuation finale), « phrases : fuites » (la traduction ne redit ni la glose ni une
acception ; la phrase n'est pas le mot seul), « sens : export » (l'export porte exactement les
textes relus des lots), « sans CC-CEDICT » (le référentiel ne lit ni CC-CEDICT ni
`unihan-definitions.json`, aucun lot ne le cite ; aucune glose anglaise n'est rédigée, donc
le garde-fou de comparaison aux définitions anglaises de CC-CEDICT, `recouvrement_cedict`,
n'a rien à comparer : une clé `en` dans un lot est une faute tant qu'il n'est pas branché) ;
signalés : « phrases : niveau » (une phrase au-dessus du niveau de son entrée) et « phrases :
autres mots » (un autre mot de la liste lu à d'autres tons dans une phrase, par un découpage
au plus long, donc approximatif).

### `traits/dico-<n>.json`

Exactement le format de `traits/<racine>.json` (en-tête de l'Arphic Public License,
`license_file`, `modified`, clé `traits`), que `strokes.ts` lit déjà : `{c: {s, m}}`. Les
tracés sont copiés tels quels de `graphics.txt`, sauf les composants découpés dans un hôte
(nommés dans `modified` et décrits dans `traits/MODIFICATIONS.md`). Les quelque 600 caractères
des familles figurent aussi dans `traits/<racine>.json` : le dictionnaire ne dépend pas du
graphe des familles pour dessiner. Dans l'app, `content.traitsDe` cherche d'abord la famille,
puis le lot du dictionnaire, puis `strokes-demo.json`.

Les fichiers sont nommés `dico-<n>.json` à plat dans `traits/`, et non dans un
sous-dossier : le site public publie chaque fichier de `traits/` (APL §2 b) et les
contrôles de licence lisent ce dossier sans descendre.

### Budget, mesuré sur l'export 0.1.0 du 29 septembre 2026

| Fichiers | Nombre | Brut | gzip | Hors ligne |
|---|---|---|---|---|
| `dico/index.json` | 1 | 519 Kio | 147 Kio | précaché |
| `dico/caracteres/` | 60 | 850 Kio | 172 Kio | à la demande |
| `dico/mots/` | 56 | 1 855 Kio | 314 Kio | à la demande |
| `traits/dico-*.json` | 64 | 7 942 Kio | 3 344 Kio | à la demande |
| `MIT-hsk30.txt` | 1 | 1 Kio | 1 Kio | précaché |
| **Total** | 182 | **11 167 Kio** | **3 977 Kio** | |

Hors ligne (story D.12, `app/vite.config.ts`) : le service worker précache l'index et laisse
les lots au cache d'exécution (`CacheFirst`, cache `wenlu-dictionnaire`), remplis à la
première lecture ; l'URL d'un lot porte l'empreinte de l'export (`?v=`), si bien qu'un
nouvel export ne sert jamais un lot d'hier. Mesuré par `npm run build` : le précache passe
de 1 343 entrées et 10 214 Kio (main du 29 septembre) à 1 345 entrées et 11 060 Kio,
**+846 Kio** : l'index (519 Kio, 147 Kio transférés), la police Noto Serif SC agrandie aux
3 000 caractères que les listes de mots écrivent (`wenlu fonts`, 297 → 615 Kio, +311 Kio),
le code (+10 Kio, +3 Kio transférés). Environ 465 Kio de plus à la première installation.
Un lot jamais ouvert n'est pas là hors ligne : la totalité des lots pèse 3,8 Mio transférés
(à proposer un jour dans Réglages, « Garder le dictionnaire hors ligne »). Dans le shell
iOS, tout est dans le paquet : +11,2 Mio bruts.

Contrôles (`wenlu check`), bloquants : « dico : entrées » (autant de lignes que de
caractères des listes et de mots de `hsk-mots.tsv`, chaque entrée dans son lot, aucun
fichier hors de l'index), « dico : traits » (chaque caractère et chaque composant hors
liste a ses traits dans son lot), « dico : sens relus seulement » (aucun sens ni exemple
qui ne soit `relu`, glose de 40 caractères au plus, glose de l'index égale à celle du sens
relu, vide sinon).

## `paires.json`

`{version, license, source, source_url, modified, paires: [["天", "夫"], …]}`.
Les caractères à ne pas confondre, versionnés dans
`data/sources/paires/paires.tsv` (source : `docs/jeux.md`). Un groupe est réduit
au périmètre de la version et tombe s'il n'y reste pas deux formes : l'app ne
montre que ce qu'elle sait dessiner.

## `fetes.json`

Tiré de `data/sources/fetes/` : `calendrier.tsv` (écrit par `wenlu fetes
calendrier`, dates du calendrier luni-solaire calculées par `lunar_python`),
`textes.tsv` (rédigés pour l'app) et `animaux.tsv` (les douze animaux).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "calendrier": [{"fete": "chunjie", "date": "2027-02-06", "avant": 1, "apres": 13, "annee": 2027,
                 "animal": {"c": "羊", "pinyin": "yáng", "fr": "de la Chèvre"}}],
 "fetes": {"chunjie": {"nom": "Nouvel An lunaire", "nom_zh": "春节",
                       "voeu": {"zh": "新年快乐", "pinyin": "xīnnián kuàilè", "fr": "Bonne année {animal}"},
                       "caractere_voeu": "福", "tao": ["…"],
                       "anecdote": {"rubrique": "…", "c": "年", "pinyin": "nián", "sens": "l'année",
                                    "titre": "…", "texte": "…"}}},
 "racines": {"年": "年", "月": "月", "福": "礻", "灯": "火", "…": "…"}}
```

- Huit fêtes : `chunjie` 春节, `yuanxiao` 元宵, `qingming` 清明, `duanwu` 端午,
  `qixi` 七夕, `zhongqiu` 中秋, `chongyang` 重阳, `dongzhi` 冬至. Six tombent à un
  jour du calendrier lunaire ; 清明 et 冬至 suivent leur terme solaire (节气), au
  jour de Pékin.
- Une fête est active du jour `date − avant` au jour `date + apres` inclus.
  春节 : du réveillon 除夕 (−1) au 14e jour (+13) ; 元宵 : son jour seul ;
  清明 −1 à +1 ; 端午 −2 à +1 ; 七夕 −2 à 0 ; 中秋 −3 à +1 ; 重阳 −1 à +1 ;
  冬至 −1 à +1. Les fenêtres ne se chevauchent jamais.
- `anecdote.c` est le caractère bonus de la fête, dessiné depuis ses traits dans
  l'anecdote ; `pinyin` vient d'Unihan, `sens` est rédigé pour l'app.
- `{animal}` et `{quand}` sont des jetons que l'app remplit au jour de la fête :
  l'animal de l'entrée du calendrier (« de la Chèvre 羊 ») et le délai jusqu'au soir
  de la fête (« Demain soir »).
- `racines` donne la famille de chaque caractère dessiné : l'app lit ses traits
  dans `traits/<racine>.json` sans relire toutes les familles.

## `saisons.json`

Tiré de `data/sources/saisons/` : `termes.tsv` (écrit par `wenlu saisons
calendrier`, instants des termes calculés par `lunar_python`, à l'heure de Pékin)
et `textes.tsv` (rédigés pour l'app).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "rubrique": "Aujourd'hui commence un terme solaire", "explication": "L'année chinoise compte…",
 "ambiances": ["pecher", "pluie", "duvet", "lucioles", "rosee", "feuilles", "neige", "prunier"],
 "calendrier": [{"terme": "qiufen", "debut": "2026-09-23", "fin": "2026-10-08"}],
 "termes": {"qiufen": {"nom_zh": "秋分", "pinyin": "qiūfēn", "fr": "l'équinoxe d'automne",
                       "ambiance": "feuilles", "ligne": "Le jour et la nuit…", "tao": ["…"],
                       "caractere": {"c": "半", "pinyin": "bàn", "sens": "la moitié"}}},
 "racines": {"半": "半", "露": "雨", "…": "…"}}
```

- Vingt-quatre termes, de `lichun` 立春 à `dahan` 大寒 ; l'identifiant est le pinyin
  sans ton. Un terme court de `debut` inclus à `fin` exclu, `fin` étant le début du
  suivant : chaque jour de 2026 à 2035 a son terme, et un seul.
- Les fêtes gardent la priorité : un jour de fête, l'app montre la fête, pas le terme.
- `ambiance` : l'une des huit ambiances de saison, trois termes consécutifs chacune ;
  l'app en tire une palette légère (`[data-saison]` de `tokens.css`) et un décor.
- `caractere.c` est le caractère à lire du terme, propre à chacun, dessiné depuis
  ses traits ; `pinyin` vient d'Unihan, `sens` est rédigé pour l'app.
- `rubrique` et `explication` présentent le terme dans l'anecdote du jour où il
  commence.
## `devinettes.json`

Tiré de `data/sources/devinettes/` (story 4b.5) : `devinettes.tsv`, une devinette
par caractère réponse, rédigée pour l'app, et `briques.tsv`, le nom de chaque brique
citée. Une devinette cache une décomposition : l'énoncé décrit les briques de la
décomposition GF 0014-2009 exportée et leur disposition.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "devinettes": [{"id": "明", "c": "明", "pinyin": "míng", "sens": "clair, lumineux",
                 "enonce": "Le soleil et la lune, côte à côte", "zh": "一月一日非今天",
                 "disposition": "cote", "briques": ["日", "月"], "leurres": ["昨", "期", "晚"]}],
 "noms": {"日": "le soleil", "月": "la lune", "…": "…"},
 "racines": {"明": "日", "昨": "日", "期": "月", "…": "…"}}
```

- `id` est la réponse : une seule devinette par caractère. La progression range les
  devinettes résolues par `id` (`Progress.devinettes`).
- `enonce` s'écrit sans guillemets extérieurs, que l'app pose. `zh`, l'énoncé chinois
  traditionnel (字谜), n'est donné que s'il est exact et connu ; sinon `null`.
- `disposition` : `cote` (⿰ ⿲), `superpose` (⿱ ⿳), `dedans` (⿴ ⿵ ⿶ ⿷),
  `enveloppe` (⿸ ⿹ ⿺) ou `mele` (⿻), l'opérateur de premier niveau de la structure.
- `briques` : exactement les `parts` exportées de la réponse, dans l'ordre d'écriture.
- `leurres` : trois caractères des listes cibles, choisis à l'export par ressemblance
  de composants (la mesure de `questions.ts`), une brique citée après l'autre ; jamais
  la réponse, jamais une brique citée, jamais un caractère qui porte toutes les briques.
- `noms` : le nom de chaque brique citée, montré par la correction.
- `racines` : la famille de chaque caractère dessiné (réponse, briques, leurres).
  Aucun n'est hors du périmètre : les devinettes n'y font entrer aucun caractère.

## `eclair.json`

Tiré de `data/sources/eclair/mots.tsv` (story 4b.4) : des mots de deux caractères
des listes cibles, dont le sens se devine depuis les deux caractères. La liste des
mots est relevée parmi les entrées de CC-CEDICT, dont seul le mot est repris ; le
sens, en français et en anglais, est rédigé pour l'app ; le pinyin, écrit dans la
source, se lit dans les lectures d'Unihan ou des surcharges.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "mots": [{"id": "电脑", "mot": "电脑", "pinyin": "diànnǎo", "fr": "ordinateur", "en": "computer",
           "leurres": ["大脑", "电视", "远视"]}],
 "racines": {"电": "电", "脑": "月", "…": "…"}}
```

- `id` est le mot. La progression range les mots devinés par `id`
  (`Progress.motsDevines`), chacun une fois : c'est le compteur « mots devinés ».
- `leurres` : trois autres mots du même fichier, dont l'app montre le sens `fr` ;
  choisis à l'export, les voisins d'abord (un caractère partagé, au même rang puis à
  l'autre), jamais un mot de même étiquette `proches` dans la source, jamais un sens
  identique.
- `racines` : la famille de chaque caractère des mots, pour trouver ses traits. Un mot
  dont un caractère ne se dessine pas n'est pas exporté : l'éclair ne fait entrer aucun
  caractère dans le périmètre.
- L'app ne propose un mot que si ses deux caractères sont acquis (stabilité FSRS au
  seuil) et qu'il n'est pas un mot de la fiche d'un caractère déjà appris.

## `coquilles.json`

Tiré de `data/sources/coquilles/coquilles.tsv` (story 4b.3) : des messages courts,
rédigés pour l'app avec les seuls caractères du seuil 255, à relire par le
propriétaire. La coquille en montre un où un caractère a pris la place d'un autre de
son groupe à ne pas confondre (夫 pour 天).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "coquilles": [{"id": "今天天气很好", "message": "今天天气很好。", "pieges": ["天"],
                "fr": "Il fait beau aujourd'hui.", "en": "The weather is nice today."}],
 "racines": {"今": "人", "天": "大", "夫": "大", "…": "…"}}
```

- `id` : les caractères du message, sans la ponctuation. `message` garde la ponctuation.
- `pieges` : les caractères du message que l'app peut remplacer. Chacun appartient à
  un groupe de `paires.json` et y garde un autre membre absent du message ; l'export
  ne garde que les pièges dont un tel intrus se dessine. L'intrus n'est pas écrit :
  l'app le prend dans `paires.json`, parmi les caractères acquis.
- `fr`, `en` : la traduction, que la correction montre.
- `racines` : la famille de chaque caractère dessiné, message et intrus possibles.
  Aucun n'est hors du périmètre.

## `cuisine.json`

Tiré de `data/sources/cuisine/` (story 4b.6), rédigé pour l'app et à relire :
`recettes.tsv`, `etapes.tsv`, `ingredients.tsv`, `etal.tsv`, `tao.tsv`. Dix plats de
cantine ; Tao lit la recette, on prend les ingrédients sur l'étal, Tao goûte.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "recettes": [{"id": "niuroumian", "zh": "牛肉面", "pinyin": "niúròumiàn",
               "fr": "les nouilles au bœuf", "en": "beef noodles", "gratuit": false,
               "etapes": [{"zh": "牛肉下水，小火两个小时。", "pinyin": "…", "fr": "…", "en": "…"}],
               "ingredients": [{"zh": "牛肉", "pinyin": "niúròu", "fr": "du bœuf", "en": "beef",
                                "leurres": ["牛奶", "鸡肉", "鸡蛋"], "notes": ["肉"]}],
               "caracteres": ["牛", "肉", "面", "下", "水", "…"],
               "jours": {"hsk": 198, "lire": null}}],
 "etal": {"牛奶": {"pinyin": "niúnǎi", "fr": "du lait", "en": "milk"}, "…": "…"},
 "tao": {"lit": {"zh": "我来看看！", "…": "…"}, "bon": {"…": "…"}, "grimace": {"…": "…"}},
 "racines": {"牛": "牛", "…": "…"}}
```

- `gratuit` : les trois premiers plats, l'offre gratuite (brief §10). Aucun achat
  n'existe encore : l'app ouvre les dix.
- `ingredients` : une question chacun. `fr`, `en` : ce que Tao demande. `leurres` :
  deux ou trois mots de l'étal, écrits à la main, jamais la réponse ni un autre
  ingrédient de la recette. `notes` : les caractères que la question note, ceux de la
  réponse que le premier leurre n'a pas.
- `caracteres` : le nom, les étapes et les ingrédients ; la recette ne se propose que
  lorsque tous sont acquis. Les leurres n'en sont pas.
- `jours` : par parcours, le jour où tous ces caractères sont posés ; `null` si le
  parcours n'y mène pas.
- `etal` : le sens de chaque mot de l'étal, que la correction montre.
- `racines` : la famille de chaque caractère écrit. Aucun n'est hors du périmètre.

## `lettres.json`

Les lettres de Que (story 4b.8), tirées de `data/sources/lettres-versions/<nn>.json`
et rédigées sans API (voir « Lettres de Que » plus bas). Seules les lettres au statut
`relu` y entrent ; celles à relire vont dans `apercu/lettres.json`, même format, avec
`statut: "a_relire"` en tête et sur chaque lettre, recensé par `apercu/index.json`
(`"lettres": "apercu/lettres.json"`, `compte.lettres`).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "parcours": "lire", "semaine": 7,
 "lettres": [{"n": 1, "jour": 7, "parcours": "lire",
              "titre_fr": "Le premier matin", "titre_en": "The first morning",
              "phrases": [{"zh": "早！", "pinyin": "zǎo", "fr": "…", "en": "…"}],
              "glose": {"早": {"pinyin": "zǎo", "fr": "tôt ; bonjour", "en": "early; good morning"}}}]}
```

- `n` : le rang dans le feuilleton, 1 à 12 ; `jour` : 7n, le jour du parcours `lire`
  dont la lettre n'emploie que l'acquis.
- `phrases` : une syllabe de pinyin par sinogramme, séparées par une espace, tons du
  dictionnaire sans sandhi ; la dernière est une question.
- `glose` : par caractère ou par mot ; le lecteur découpe chaque phrase par l'entrée
  la plus longue, comme pour les contes.
- L'app décide quand une lettre arrive (`app/src/lib/lettres.ts`) : une par semaine au
  plus, la semaine commençant le dimanche, quand tous ses caractères ont une carte.

## `wechat.json`

Tiré de `data/sources/wechat/` (story 4b.7), rédigé pour l'app et à relire :
`ami.tsv`, `dialogues.tsv`, `echanges.tsv`. Un ami écrit un court message ; on choisit
la bonne réplique parmi trois ou quatre, toutes écrites avec l'acquis.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "ami": {"zh": "大明", "pinyin": "Dàmíng", "fr": "ton ami de Pékin", "en": "your friend from Beijing"},
 "dialogues": [{"id": "nihaoma", "cle": "吗", "famille": "口", "fr": "Ça va ?", "en": "How are you?",
                "echanges": [{"ami": {"zh": "你好吗？", "pinyin": "Nǐ hǎo ma?", "fr": "…", "en": "…",
                                      "syllabes": ["nǐ", "hǎo", "ma"]},
                              "repliques": [{"zh": "我很好，你呢？", "…": "…", "juste": true},
                                            {"zh": "再见！", "…": "…", "juste": false, "erreur": "contresens"}],
                              "notes": ["我", "很", "好", "你", "呢"]}],
                "fin": null,
                "caracteres": ["你", "好", "吗", "…"],
                "jours": {"hsk": 159, "lire": 144}}],
 "racines": {"你": "亻", "…": "…"}}
```

- `cle` : le caractère clé, écrit dans le dialogue ; `famille` est sa racine.
- `echanges` : de deux à quatre. `repliques` : la bonne d'abord (`juste`), puis deux ou
  trois mauvaises, chacune `hors-sujet` ou `contresens` ; l'app les mélange. `notes` :
  les caractères que la bonne réplique note, sauf ceux qu'une réplique précédente du
  dialogue a déjà notés. Une mauvaise réplique ne note rien.
- `syllabes` : le pinyin de chaque sinogramme du texte, dans l'ordre, aligné sur Unihan
  et les surcharges ; l'app le montre au toucher d'un caractère.
- `fin` : le mot de la fin de l'ami, sans réplique, ou `null`.
- `caracteres` : tout le dialogue, mauvaises répliques comprises ; il ne se propose que
  lorsque tous sont acquis. `jours` : par parcours, le jour où tous sont posés.
- `racines` : la famille de chaque caractère écrit. Aucun n'est hors du périmètre.

## `heros.json`

Tiré de `data/sources/heros/` (story 4.5, brief §8 « Le personnage »), rédigé pour l'app
d'après la maquette validée et à relire : `rangs.tsv`, `betes.tsv`, `tao.tsv`.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "rangs": [{"hz": "启蒙", "pinyin": "qǐméng", "fr": "lever le voile",
            "role": "les tout premiers caractères", "age": "bébé", "seuil": 0,
            "examens": [], "palier": null},
           {"hz": "童生", "…": "…", "seuil": 50, "examens": ["xianshi", "fushi"], "palier": null},
           {"hz": "翰林", "…": "…", "seuil": 360, "examens": [], "palier": 1000}],
 "betes": [{"id": "tu", "hz": "玉兔", "pinyin": "yùtù", "fr": "le lapin de jade",
            "dit": "Oreilles dressées, rien ne lui échappe.", "noms": ["Yuè", "月月", "Pompon"]}],
 "tao": {"accueil": "…", "choisi": "{bete}, {bete_fr} ! {dit}", "depart": "On y va ?",
         "essayer": "Et si on essayait {art}, {art_fr} ? Je t'aide.",
         "presque": "Plus que {reste} points pour {rang} !", "presque_un": "…",
         "examen": "Les points de {rang} y sont. Reste le {examen} : …", "palier": "…",
         "sommet": "{nom}, premier du concours. …", "fangbang": "Ton nom est sur la liste, {nom} : …"},
 "racines": {"启": "口", "…": "…"}}
```

- `rangs` : douze, dans l'ordre, le premier à 0 point, des seuils strictement croissants
  (0 à 1 000). `fr` est la traduction mot à mot, sans guillemets ; `age` l'étape de vie
  (bébé, tout-petit, enfant, grand enfant, ado, jeune, adulte), dont l'app tire la
  silhouette, qui suit les seuls points. « Points ET examen » (décision du propriétaire du
  26 septembre 2026) : `examens` nomme les examens à titre qu'un rang demande réussis, par
  leur identifiant dans `examens.json` (le 童生 : le 县试 et le 府试), et `palier` les
  caractères lus d'une nomination (翰林 1 000, 探花 1 200, 榜眼 1 555, 状元 1 800), `null`
  sinon ; un rang ne s'accorde qu'avec ses points et ce qu'il demande, dans l'ordre, et la
  tenue suit le rang accordé. Un 月课 n'est dans aucun rang. Les titres se dessinent depuis
  leurs traits : leurs caractères sont dans le périmètre, et `racines` dit leur famille.
- `betes` : `tu`, `xiongmao`, `shi`, les trois que l'app dessine, avec trois idées de nom.
- `tao` : dix phrases ; l'app remplit les jetons entre accolades. Les points ne sont pas
  du contenu : l'app les compte dans la progression (`heros.ts`).

## `jouer.json`

Tiré de `data/sources/jouer/tao.tsv` (brief §9 « L'écran Jouer »), rédigé pour l'app et à
relire : ce que Tao dit en tendant son jeu. L'app choisit la phrase (`jeux.bulleDeTao`).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "tao": {"invite": "On joue à celui-ci ?", "changer": "Et si on changeait un peu ? Celui-ci.",
         "devinette": "On commence par la devinette ?", "attendre": "Il n'y a pas encore assez…",
         "lu": "Tout est lu. Chercher le sens, c'est déjà lire."}}
```

- `tao` : cinq phrases, sans jeton. `invite` : Tao tend un jeu ; `changer` : elle le tend
  en s'ennuyant (trois fois la même activité) ; `devinette` : aucun jeu à tendre, la
  devinette du jour attend ; `attendre` : ni jeu ni devinette, ce qui manque ; `lu` : le
  constat d'une manche où rien n'a été noté (le message WeChat mené après des erreurs,
  l'éclair manqué), ce qui a été lu plutôt que « rien de revu ». Sans `jouer.json` (un
  export plus ancien), la bulle se tait.

## `rythme.json`

Tiré de `data/sources/interface/rythme.tsv` (épic 7, stories 7.2 et 7.5 ; brief §6, §8, §10),
rédigé pour l'app et à relire : les lignes du rythme gratuit. Après les trente premiers
jours du chemin, sans Wenlu complet, deux briques nouvelles par semaine ; les autres jours,
la session revoit une brique acquise. L'app (`rythme.ts`) remplit les jetons ; les jours
viennent de `droits.ts`, calculés, jamais estimés.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "textes": {"menu_demain": "Demain", "menu_dans": "Dans {n} j",
            "route_pierre": "prochaine brique dans {n} j", "route_fin": "fin du chemin gratuit",
            "clore_rythme": "Dès aujourd'hui, deux briques nouvelles par semaine ; …", "…": "…"}}
```

- `textes` : dix-sept lignes, chacune avec ses seuls jetons, {n} des jours du calendrier,
  {c} un caractère. Le menu (`menu_demain`, `menu_dans`, `menu_revue`, `menu_revue_faite`,
  `menu_brique_revue`, `menu_reviser`), Tao sur le chemin (`tao_revoir`), le pas Apprendre
  (`apprendre_revue`), Clore (`clore_revue`, `clore_rythme`), la route devant
  (`route_pierre_demain`, `route_pierre`, `route_carte_demain`, `route_carte`, `route_fin`,
  `route_suite_lire`, `route_suite_hsk`). Sans `rythme.json` (un export plus ancien), ces
  lignes se taisent.
## `rappels.json`

Tiré de `data/sources/rappels/textes.tsv` (brief §8, « Notification »), rédigé pour l'app et
à relire : les textes du rappel quotidien de l'app iOS et de la garde de la progression.
L'app les lit (`app/src/lib/rappels.ts`) ; le corps d'une notification est d'ordinaire le
début de l'anecdote du jour, tiré de `anecdotes.json`, et n'est pas ici.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "textes": {"notif_brique_titre": "La prochaine brique",
            "notif_brique": "{c} · {sens}, la brique de ta prochaine session.",
            "question": "À quelle heure veux-tu lire ?", "…": "…",
            "export_date": "Dernier export : {date}", "export_jamais": "Dernier export : jamais"}}
```

- `textes` : dix-huit textes, chacun une fois. `notif_brique_titre`, `notif_brique` : la
  notification d'un jour dont l'anecdote est déjà lue ou annoncée, la brique de la
  prochaine session (`{c}`, `{sens}`) ; `question`, `question_guide`, `question_accord`,
  `matin`, `midi`, `soir`, `accepter`, `refuser` : la question de l'heure à la première
  session ; `reglage`, `reglage_detail`, `reglage_heure`, `reglage_refuse` : Réglages ;
  `accueil`, `accueil_comment` : sur le web iOS hors écran d'accueil ; `export_date`
  (`{date}`), `export_jamais` : la date du dernier export. Sans `rappels.json` (un export
  plus ancien), l'app ne programme aucun rappel et tait ces lignes.
## `ecrans.json`

Tiré de `data/sources/ecrans/lire-le-monde.tsv` et `revisions.tsv` (rapport comparatif du
28 septembre 2026, §2.5 et §2.6), `personnage.tsv` et `route.tsv` (stories 8.5 et 8.6),
`dire.tsv` (story 9.1) et `chemin.tsv` (décisions du propriétaire du 29 septembre 2026,
maquette validée `maquettes/chemin.html`), rédigé pour l'app et à relire : les textes
d'interface de « Lire le monde », le second onglet de Chercher, du tableau des révisions de
Mon chemin, les lignes des
examens sur « Mon personnage » (« Reste le 院试 », « Reçu au 院试 · encore 12 points ») et
sur « La route devant » (« 县试 · 50 caractères », « examen ouvert »), et la question
« Dis-le » avec son réglage « Dire les tons » : la consigne, le bouton du micro, le nom et
l'allure de chaque ton, le ton reconnu, un autre ton et le conseil de chaque couple
(`conseil-<attendu>-<entendu>`), les redemandes, l'essai des Réglages ; et l'image du chemin :
Mon chemin 路, la pierre posée (« Pierre posée, une seule par jour », « 儿 rejoint ton
chemin. »), les pavillons de la semaine, les auberges des familles, les rendez-vous ; et
`xing.tsv` (décision du propriétaire du 29 septembre 2026) : la rencontre du maître Xing 杏 à
la porte du 县试 (son accueil, son nom, 杏 dessiné depuis ses traits, ses rôles) et sa ligne
de tête au pas Apprendre, selon l'étiquette de la fiche (`brique-atteste`, `brique-mnemo`,
`brique-sans`, et de même `compose-*`), qui ne présente jamais l'une pour l'autre ; et
`dictionnaire.tsv` (story 10.8, maquette `maquettes/dictionnaire.html`) : le premier onglet
de Chercher, la loupe, les recherches récentes, le caractère du jour, les résultats et leur
statut de Mon chemin, la fiche d'un caractère (l'ordre des traits, les briques, « origine à
venir »), celle d'un mot, la place de l'écriture au doigt et les catégories de la liste
HSK 3.0 ; il ne rédige jamais d'origine, qui vient de la fiche relue avec son étiquette ; et
`ecrire.tsv` (maquette `maquettes/dictionnaire.html`, écran 5) : le pavé « Écrire au doigt »,
ses boutons « Annuler le trait » et « Effacer », le compte des traits et des candidats
(`app/src/lib/PaveEcriture.svelte`) ; le titre, le champ et la ligne « Wenlu complet » sont
ceux du dictionnaire.
L'app remplit les jetons entre accolades (`app/src/lib/ecrans.ts`).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "lire-le-monde": {"compte": "Tu lis {lus} caractères sur {total}.", "dans": "dans {n} j", "…": "…"},
 "revisions": {"titre": "Tes révisions", "jours": "dim. lun. mar. mer. jeu. ven. sam.", "…": "…"},
 "personnage": {"reste": "Reste le {examen}", "recu": "Reçu au {examen} · encore {n} points", "…": "…"},
 "route": {"examen": "{examen} · {n} caractères", "ouvert": "examen ouvert", "…": "…"},
 "dire": {"juste": "{nom} : ta voix {allure}. C'est bien lui.", "conseil-2-3": "Monte tout de suite, sans descendre d'abord.", "…": "…"},
 "chemin": {"menu-faite": "Pierre posée, une seule par jour", "clore-titre": "{c} rejoint ton chemin.", "…": "…"},
 "dictionnaire": {"pas-appris": "Pas encore appris", "dans": "dans {n} j", "…": "…"},
 "xing": {"caractere": "杏", "accueil": "Bienvenue au 县试. Je suis Xing. …", "brique-mnemo": "… un moyen mnémotechnique, pas son histoire.", "…": "…"},
 "ecrire": {"annuler": "Annuler le trait", "compte": "{n} traits · {c} candidats", "…": "…"}}
```

- Un objet par écran, les textes par clé, dans l'ordre de `ecrans.ECRANS`, qui déclare
  chaque clé et ses jetons. `revisions/jours` nomme les sept jours, du dimanche au samedi,
  séparés d'une espace. Sans `ecrans.json` (un export plus ancien), les textes sont vides.

## `tons.json`

Tiré de `data/sources/tons/modele.json` (story 9.1, provenance dans
`data/sources/tons/PROVENANCE.md`) : les poids du classifieur des tons de « Dis-le », tels
que l'entraînement les a écrits, compacts. En tête, l'en-tête de licence, l'attribution de
chaque source dont les poids dérivent et les fichiers des textes de licence ; puis les poids.
Tant que les poids ne dérivent que des voix de Taïwan, la licence est celle d'aujourd'hui
(propriétaire, données sous OGDL 1.0) ; s'ils dérivent d'une voix sous CC BY-SA (`tons.py`,
`VOIX_CC`), ils sont sous CC BY-SA 4.0 : `license` le dit, `license_url` donne l'adresse de son
texte, `license_files` nomme `OGDL-Taiwan-1.0.txt` et `CC-BY-SA-4.0.txt`, et `attributions`
porte l'attribution de chaque source, l'OGDL en tête (`attribution` les met bout à bout).

```json
{"version": "0.1.0-2026-09-29", "license": "propriétaire (poids Wenlu) ; données d'entraînement sous Open Government Data License 1.0 …",
 "source": "…", "source_url": "…", "modified": "…",
 "attribution": "數位發展部 … jeu de données 5961 de data.gov.tw … https://data.gov.tw/license",
 "attributions": ["數位發展部 … https://data.gov.tw/license"],
 "license_file": "OGDL-Taiwan-1.0.txt", "license_files": ["OGDL-Taiwan-1.0.txt"],
 "format": "wenlu-tons-mlp", "classes": [1, 2, 3, 4, 5], "entrees": 34,
 "membres": [{"normalisation": {"moyenne": […], "ecart": […]}, "couches": [{"poids": [[…]], "biais": […]}, …]}, …],
 "temperature": 1.2, "poidsRegles": 4, "licence": {…}, "entrainement": {…}}
```

- `version` est celle des poids (`0.1.0-<jour de l'entraînement>`), pas celle de l'export.
- `membres` : cinq perceptrons 34-16-5 (ReLU), dont l'app moyenne les probabilités après une
  température ; `poidsRegles` pèse la base à règles dans la décision hybride
  (`app/src/lib/tons/classifieur.ts`). Les 34 entrées : 30 points de contour en demi-tons,
  le registre face à la voix de l'apprenant et son indicateur, la durée, le voisement.
- Sans `tons.json` (un export plus ancien), ou des poids mal formés, « Dis-le » ne se pose pas.

## `ecriture/gabarits.json`

Écrit par `ecriture.py`, nommé par l'index (clé `ecriture`) : les gabarits de l'écriture au
doigt du dictionnaire (Wenlu complet), un seul fichier que l'app lit à la première ouverture
du pavé, dans son Web Worker (`app/src/lib/ecriture/`). Ils dérivent des médianes de
`graphics.txt` : sous Arphic Public License, dans leur propre dossier, avec
`ecriture/ARPHICPL.TXT` et `ecriture/MODIFICATIONS.md` à côté. Aucun texte propriétaire n'y
entre ; la police ne lit pas ce dossier (`fonts.py`).

```json
{"version": "0.1.0", "license": "Arphic Public License", "license_file": "ARPHICPL.TXT",
 "source": "Make Me a Hanzi — graphics.txt (médianes)", "source_url": "https://github.com/skishore/makemeahanzi",
 "modified": "2026-09-29 : médianes rééchantillonnées à 8 points par trait, … Voir MODIFICATIONS.md.",
 "format": {"points": 8, "niveaux": 64, "alphabet": "ABC…-_", "repere": "…"},
 "listes": [["hsk-1", 300], ["hsk-2", 300], …, ["hsk-7-9", 1200]],
 "caracteres": "爱八爸…", "traits": "KCI…", "gabarits": "oBkA…"}
```

- `caracteres` : les 3 000 caractères du HSK 3.0, niveau par niveau (l'ordre de `listes`).
- `traits` : un signe par caractère, le rang dans `alphabet` de son nombre de traits.
- `gabarits` : pour chaque caractère, chaque trait dans l'ordre d'écriture, `points` points
  également espacés le long de la médiane, x puis y, un signe chacun (64 crans). Repère de
  l'écran (y vers le bas), boîte du caractère centrée, plus grand côté sur 63 crans,
  proportions gardées.
- 28 364 traits, 467 Ko (326 Ko en gzip). Hors précache de la PWA (le pavé ne s'ouvre pas sur
  le web) ; mis en cache à la première lecture (`vite.config.ts`).

## `ouvertures.json`

Tiré de `data/sources/ouvertures/portes.tsv` (brief §6, « Les portes qui s'ouvrent » ; demande
du propriétaire du 29 septembre 2026), rédigé pour l'app et à relire : le calendrier
d'ouverture des portes, « l'aventure ». L'app le lit (`app/src/lib/ouvertures.ts`) et ne
décide que du moment de montrer.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "portes": [{"id": "reviser", "unite": "jour", "seuil": 4, "parent": null,
             "annonce": "Une nouvelle porte : Réviser 温."},
            {"id": "jeu-chaine", "unite": "lus", "seuil": 6, "parent": "jouer", "annonce": ""}]}
```

- `portes` : vingt portes, dans l'ordre où elles s'annoncent quand plusieurs tombent le
  même jour. `id` : `xing` (la rencontre du maître Xing 杏, en tête, au palier du premier
  examen, en `lus`), `reviser`, `jouer`, `lire`, `foret` (les cases du menu), `personnage`
  (le portrait de l'en-tête), `route` (« Devant › » et la route devant, le haut de Mon
  chemin), `trophees`, `revisions` (les entrées de Mon chemin), `retention` (le réglage des révisions), `contes`
  (les étagères de Lire), `monde` (l'onglet « Un texte » de Chercher), et un `jeu-<id>` par
  jeu de l'écran Jouer. `unite` : `jour`, la dernière leçon du parcours apprise (la première
  session pose les jours 1 à 3), ou `lus`, les caractères lus de Mon chemin ; jamais une date
  ni un achat. `seuil` : un entier. `parent` : la porte qui la contient, montrée avant
  elle, ou `null`. `annonce` : la phrase de Tao au retour au menu ; vide, la porte vient en
  silence avec son parent, au même seuil. Réglages, Chercher un caractère et la session ne
  sont pas des portes. Sans `ouvertures.json` (un export plus ancien), l'app n'a pas de
  calendrier et montre tout.

## `anecdotes.json`

Tiré de `data/sources/anecdotes/anecdotes.tsv` : les anecdotes ordinaires du pas Ouvrir,
rédigées pour l'app (les douze de la maquette validée, sauf celle du dragon, puis les
autres, à relire). Celles des fêtes et des termes solaires sont dans `fetes.json` et
`saisons.json`. L'index ne le nomme pas : l'app le lit à chemin fixe.

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "anecdotes": [{"c": "只", "titre": "Un oiseau dans la main.", "texte": "…",
                "appui": "ecriture", "etiquette": "atteste", "statut": "a_relire", "racine": "口"}]}
```

- `c` : un caractère par anecdote, jamais deux fois le même, dans le périmètre exporté
  (sinon l'anecdote ne s'écrit pas) ; `racine` dit sa famille, où lire ses traits.
- `appui` : ce qui fonde le texte (`langue`, `coutume`, `histoire`, `litterature`,
  `legende`, `ecriture`) ; `etiquette` (`atteste`, `mnemotechnique`), présente quand le
  texte parle de l'origine d'un caractère ou d'un mot, que l'écran Ouvrir affiche.
- L'ordre est celui de la source. L'app choisit celle du jour (`app/src/lib/anecdotes.ts`) :
  d'abord un caractère rencontré ces derniers jours sur le parcours, sans redite en
  trente jours, et la même toute la journée.

## `trois-lignes.json`

Les trois lignes du pas Utiliser (brief §6, pas 4), tirées de `data/sources/trois-lignes/`
par `trois_lignes.py`. L'app lit ce fichier à chemin fixe. Un texte par jour du chemin et
par parcours, à partir du jour 4 (les jours 1 à 3 sont la première session, qui lit 天天).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "premier_jour": 4,
 "parcours": {"lire": [{"jour": 40, "nouveaux": ["六"],
                        "lignes": [{"zh": "今天是六月六日。", "pinyin": "jīn tiān shì liù yuè liù rì",
                                    "fr": "Aujourd'hui, c'est le 6 juin.", "en": "Today is June 6th."}],
                        "glose": {"今天": {"pinyin": "jīn tiān", "fr": "aujourd'hui", "en": "today"}}}],
              "hsk": ["…"]}}
```

- `lignes` : trois, chacune avec son pinyin (une syllabe par sinogramme, tons du
  dictionnaire sans sandhi, ton neutre sans marque) et ses traductions ; l'app cache la
  traduction jusqu'au toucher.
- `nouveaux` : les caractères que le parcours pose ce jour-là (brique, puis composés) et
  que le texte emploie : ce sont eux, et eux seuls, que l'app met en cinabre. Jamais vide.
- `glose` : les seules entrées que le lecteur touchera, par caractère ou par mot ; il
  découpe chaque ligne par l'entrée la plus longue, comme les contes.
- Seuls les textes relus y entrent.

Sources, versionnées : `glossaire.tsv` (`zh`, `pinyin`, `fr`, `en`), la glose partagée ;
`lire.json` et `hsk.json`, un fichier par parcours : `generation` (`modele` « rédaction
manuelle », `api` « session Claude Code (sans API) », `date`), `relecture` (la décision du
propriétaire qui les relit : « Considère que les relectures c'est bon », approbation
permanente), puis `textes`, `{jour, statut, lignes, glose?}` ; `glose`, facultative,
précise une entrée pour ce texte seul (好学 hǎo xué, « facile à apprendre ») et passe
devant le glossaire. `uv run wenlu trois-lignes contexte <parcours> <jour>…` donne l'acquis
et les caractères nouveaux d'un jour, et les caractères de l'acquis que le glossaire ne glose
pas encore ; `uv run wenlu trois-lignes apercu <parcours>` relit.

Rédaction en parallèle (30 septembre 2026, pour la suite du chemin) : un brouillon par
parcours et par jour, `data/sources/trois-lignes-brouillons/<parcours>/<jour sur 4
chiffres>.json`, `{parcours, jour, lignes: [{zh, pinyin, fr, en}] × 3, glose?, glossaire?}`.
`glose` : les entrées propres au texte ; `glossaire` : les entrées nouvelles qu'il apporte au
glossaire partagé. `uv run wenlu trois-lignes a-rediger <parcours> --de N --a M --lot k --sur
n` partage une plage de jours en `n` tranches contiguës et stables, sans les jours déjà écrits
ni ceux qui ont un brouillon : chaque rédacteur prend son lot, et aucun fichier n'est écrit
par deux. `uv run wenlu trois-lignes importer <parcours>` (un seul à la fois) verse chaque
brouillon qui passe les contrôles bloquants dans `<parcours>.json`, au statut `a_relire`, et
ajoute son `glossaire` à `glossaire.tsv` ; une entrée déjà glosée autrement est un conflit
(elle va dans la `glose` du texte) ; un texte relu n'est jamais remplacé.

Contrôles (`wenlu check`), bloquants : « sources » (lisibles, traçables, la décision de
relecture citée), « périmètre » (les seuls caractères posés par le parcours du jour 1 au
jour du texte, et au moins un caractère nouveau du jour), « pinyin » (chaque syllabe une
lecture du caractère selon Unihan, Make Me a Hanzi et les surcharges), « glose » (chaque
sinogramme couvert, au pinyin des lignes ; le glossaire lui-même), « forme » (trois lignes,
6 à 48 sinogrammes), « couverture » (chaque jour de 4 à 120, sur les deux parcours),
« export » (`trois-lignes.json` porte exactement les textes relus). Signalés : la
relecture, et les jours du chemin au-delà du 120e qui n'ont pas encore de texte.

## `examens.json`

Les examens 科举 et les 月课 (brief §8, épic 8), tirés de `data/sources/examens/` par
`examens.py`. `index.json` le nomme (`"examens": "examens.json"`).

```json
{"version": "0.1.0", "license": "propriétaire", "source": "…", "source_url": "…", "modified": "…",
 "reussite": {"justes": 4, "sur": 5},
 "examens": [{"id": "xianshi", "sorte": "titre", "hz": "县试", "pinyin": "xiànshì",
              "fr": "l'examen du district, devant le magistrat", "en": "…",
              "palier": 50, "titre": null, "questions": 15, "reussite": 12}, "…"],
 "nominations": [{"rang": "翰林", "palier": 1000}, "…"],
 "textes": {"attente": "L'examen se repasse quand les caractères manqués sont revus.", "…": "…"},
 "parcours": {"lire": [{"examen": "xianshi", "jour": 25, "troncon": ["人", "…"],
                        "series": {"A": {"supports": ["…"], "questions": ["…"], "glose": {"…": "…"}},
                                   "B": "…"},
                        "noms": ["王大明", "…"], "pinyin": true}],
              "hsk": ["…"]},
 "racines": {"县": "且", "…": "…"}}
```

- `examens` : les trente-sept, dans l'ordre des paliers de caractères lus (au seuil de
  stabilité de Mon chemin, le compte du trophée Lire) ; `sorte` `titre` (les six du 科举) ou
  `yueke` (月课, `titre` nul) ; `questions` 15 ou 10, `reussite` 12 ou 8 (quatre sur cinq).
- `nominations` : les quatre rangs sans examen, au palier de caractères lus.
- `textes` : les lignes de l'écran et les phrases de Tao, avec leurs jetons (`{examen}`,
  `{lus}`, `{justes}`, `{questions}`, `{reussite}`).
- `parcours` : pour chaque chemin, chaque examen dont le palier est sur le chemin, avec
  le `jour` du chemin où entre le Ne caractère, le `troncon` (les caractères entrés depuis
  l'examen précédent) et ses séries relues, A et B (la reprise prend l'autre). Une série :
  `supports` (`id`, `genre` : enseigne, pancarte, menu, etal, billet, message, note,
  lettre, calendrier, affiche ; `contexte` {fr, en} ; `lignes` [{zh, pinyin, fr, en}]),
  `questions` et `glose` (tout ce que la série montre, découpé par l'entrée la plus
  longue). Une question : `type`, `support` ou `objet`, `consigne` {fr, en}, `choix`,
  `reponse` (le rang du bon choix ; vrai ou faux au `vrai_faux`, avec son `affirmation`),
  `porte` (les caractères qui portent la réponse, notés en révision) et `caracteres` (tout
  ce qu'elle montre : l'app ne garde qu'une question dont chacun a une carte). Types :
  `comprendre`, `reperer`, `vrai_faux`, `replique` (mises en situation) ; `sens`,
  `caractere`, `trou` (au rang `trou`), `ton` (revue de l'acquis). `noms` : les noms
  inventés du 放榜 (examen à titre). `pinyin` : vrai aux examens de la première étape du
  chemin, dont les textes portent leur pinyin sous chaque caractère (décision du
  propriétaire du 29 septembre 2026, « jusqu'à HSK 1 » : sur le chemin Lire jusqu'au 乡试,
  le seuil 255 ; sur le chemin HSK jusqu'au 月课 de 405, la fin du HSK 1), faux après. Le
  pinyin se montre sous les supports, l'affirmation d'un vrai ou faux et les répliques à
  choisir, jamais sous l'objet ni les choix d'une question de revue.
- `racines` : la famille de chaque caractère des noms, que l'app dessine depuis ses traits.

Sources, versionnées : `examens.tsv` (la liste, et `pinyin_sous`, les chemins où l'examen
porte le pinyin sous les caractères), `nominations.tsv`, `textes.tsv`,
`glossaire.tsv` (`zh`, `pinyin`, `fr`, `en`), et `<parcours>/<examen>.json` :
`generation` (`modele` « rédaction manuelle », `api` « session Claude Code (sans API) »),
`relecture` (la décision du propriétaire), puis `series`, `{serie, statut, supports,
questions}`. `uv run wenlu examens contexte <parcours> <examen>` donne le jour du palier,
l'acquis et le tronçon ; `uv run wenlu examens apercu <parcours> [examen]` relit.

Contrôles (`wenlu check`), bloquants : « liste » (trente-sept examens, les six à titre à
50, 100, 200, 255, 505, 805, les 月课 sur leur grille, jamais plus de 55 caractères d'un
examen au suivant, fin à 1 800 ; titres et nominations dans l'ordre des rangs ; 15 et 10
questions, reçu à quatre sur cinq), « sources », « périmètre » (les seuls caractères posés
au jour du palier sur ce chemin ; au 月课, chaque question porte un caractère du
tronçon), « pinyin », « glose », « questions » (nombre, quatre ou cinq de revue à titre,
trois au 月课, au moins trois types de mise en situation, quatre choix distincts, la
réponse parmi eux et pas toujours à la même place, les mots à repérer pris sur le
support, le ton sans autre lecture du caractère, les caractères portés montrés par la
question), « séries » (A et B sans texte commun), « fuites » (ni le surtitre, ni la
consigne, ni, à un examen qui le porte, le pinyin sous les caractères ne donnent la
réponse), « pinyin sous les caractères » (sur chaque chemin, tous les examens de la
première étape et aucun après, sans trou), « couverture » (chaque examen jusqu'à 75
caractères lus, sur les deux chemins), « périmètre des traits », « export ». Signalés : la
relecture, et les examens du chemin qui n'ont pas encore de séries.

## `LICENCES.md`

Écrit par l'export. Un tableau `source | usage | licence | attribution | texte de
la licence` pour chaque source embarquée (dont cjk-decomp, sous la MIT retenue, avec
sa notice dans `MIT-cjk-decomp.txt`), la séparation des fichiers, ce que l'export ne
contient pas (rien de `dictionary.txt`), l'origine des décompositions, et les
obligations hors app (publier les tracés dérivés sous APL). Il fait foi pour
ce que l'app embarque ; `docs/sources-licences.md` fait foi pour la décision.

## Contrôles (`uv run wenlu check`)

- « mots HSK : comptes » — bloquant : 11 092 entrées, et le compte de chaque niveau
  (500, 772, 973, 1 000, 1 071, 1 140, 5 636), identifiants uniques.
- « mots HSK : sans CC-CEDICT » — bloquant : ni la colonne `CEDICT` ni `Variants` ne sont
  lues ni écrites, et aucune clé d'entrée CC-CEDICT (`[ai4 hao4]`) n'est dans la liste.
- « mots HSK : caractères » — bloquant : chaque sinogramme d'une graphie ou d'un exemple
  est dans la liste des 3 000 caractères (`hsk-*.txt`) ; 2 971 le sont, 29 caractères de la
  liste ne figurent dans aucun mot.
- « mots HSK : concordance avec l'OCR » — bloquant quand `hsk30-wordlist.txt` est
  téléchargé : la colonne `officiel`, niveau par niveau et dans l'ordre, est l'OCR
  d'elkmovie. Signalé sans la source.
- « mots HSK : source » — signalé : l'empreinte de `hsk30.csv` téléchargé est celle que
  cite l'en-tête ; sinon relancer `wenlu listes mots` et relire le diff.
- « mots HSK : pinyin » — bloquant : une syllabe numérotée par sinogramme, égale au pinyin
  retenu ; les mots de position suivent `MOTS_DE_POSITION` ; une entrée à `·` a une
  syllabe au ton neutre.
- « mots HSK : lectures » — signalé : chaque syllabe est une lecture connue du caractère.
- « fiches : sens » — bloquant : chaque fiche relue porte `sens_fr` et `sens_en`, et
  tout sens écrit tient en 40 caractères au plus, sans point final (voir « Le sens »).
- « fiches : rôle son » — signalé : un rôle `son` dont la phonétique ne se lit pas
  sur la syllabe du caractère, au ton près (voir « Le rôle son »).
- « export : à jour » — bloquant : l'empreinte de `index.json` doit valoir celle
  du build présent. Un export absent n'est pas une faute.
- « export : séparation des licences » — bloquant : chaque JSON porte son
  en-tête, `traits/` ne porte que des tracés, aucune fiche ne porte de tracé.
- « export : familles sans fiche relue » — signalé : ce qui reste à relire avant
  que l'app puisse enseigner ces familles.
- « export : caractères sans traits » — signalé : ce que l'app ne saurait dessiner
  (et à quoi le site ne fait pas de page).
- « licences : décompositions » — bloquant : aucune décomposition de la dernière
  version exportée ne nomme `makemeahanzi` (`dictionary.txt`, LGPL), et chacune nomme
  ses sources, `cjk-decomp` ou `surcharge` seulement (`docs/sources-licences.md` §10).
  Relit l'export versionné seulement.
- « découpes : table » — bloquant : chaque ligne de `decoupes.tsv` nomme un composant
  de la norme sans tracé propre, un hôte présent dans `graphics.txt` dont la
  décomposition canonique le contient, et des indices de traits valides.
- « découpes : traits » — bloquant : chaque composant découpé a ses traits dans
  `decoupes.json`, n'est plus muet dans le graphe, et ses traits sont dans chaque
  version exportée qui le porte.
- « fêtes : calendrier » — bloquant : dates lisibles et égales au calcul du
  calendrier lunaire, fenêtres positives, animal de l'année, 2026 à 2035 couverts
  pour chaque fête, aucun chevauchement.
- « fêtes : textes » — bloquant : chaque fête a toutes ses clés, aucune vide,
  des jetons connus, une source.
- « fêtes : caractères dessinés » — bloquant : le caractère bonus de chaque
  anecdote et le 福 du vœu ont
  leurs traits dans chaque version exportée.
- « devinettes : sources », « décomposition », « leurres », « traits », « parcours »
  — bloquants : une devinette par réponse, énoncé, sens et source présents, chaque
  brique citée nommée ; les briques citées sont les `parts` exportées et la
  disposition celle de la structure IDS ; trois leurres distincts, jamais la réponse
  ni une seconde réponse ; tout ce qui se dessine a ses traits ; la réponse et ses
  briques sont posées par un parcours, sans quoi la devinette ne viendrait jamais.
- « éclair : sources », « pinyin », « périmètre », « leurres », « parcours »,
  « CC-CEDICT » — bloquants : deux caractères distincts, sens fr et en et source
  présents, aucun mot ni sens en double, aucun mot de `mots-exclus.tsv` ; le pinyin
  se lit dans Unihan et les surcharges ; les deux caractères sont dans les listes
  cibles et dans les traits exportés, chaque mot est exporté ; trois leurres
  distincts, jamais un proche ; chaque caractère est posé par un parcours ; chaque mot
  est une entrée de CC-CEDICT, pas un nom propre. « éclair : mots de fiche » —
  signalé : un mot qu'une fiche fait déjà lire ne sera proposé qu'avant elle.
- « coquilles : sources », « export », « parcours » — bloquants : de 40 à 60
  messages de 6 à 12 caractères, tous du seuil 255, traduits, sourcés, sans doublon,
  chaque piège dans son message et dans un groupe de `paires.tsv`, avec un intrus
  absent du message ; chaque message exporté, ne piégeant qu'avec un groupe de
  `paires.json`, tout dessinable ; chaque caractère et un intrus par message posés par
  un parcours.
- « cuisine : sources », « pinyin », « périmètre », « parcours », « export » —
  bloquants : dix recettes, trois gratuites en tête, chaque ingrédient écrit dans une
  étape et sur l'étal, des leurres distincts qui ne sont ni la réponse, ni un autre
  ingrédient, ni du même sens, au moins un caractère noté ; chaque texte se lit dans
  son pinyin ; chaque caractère écrit a ses traits et est posé par un parcours, et les
  plats gratuits se cuisinent dans chaque parcours ; `cuisine.json` dit toutes les
  recettes et leurs caractères à acquérir.
- « wechat : sources », « pinyin », « périmètre », « parcours », « export » —
  bloquants : un ami, de 40 à 60 dialogues sourcés, une clé écrite dans chacun, de deux
  à quatre échanges, une bonne réplique et deux ou trois mauvaises par échange, chacune
  avec son erreur, jamais deux répliques pareilles ; chaque texte se lit dans son
  pinyin ; chaque caractère a ses traits et est posé par un parcours, chaque dialogue est
  possible dans l'un d'eux, et chaque parcours en ouvre un avant le jour 30 ;
  `wechat.json` dit tous les dialogues, leurs caractères, des notes prises dans la bonne
  réplique, et une syllabe par caractère.
- « héros : sources », « pinyin », « périmètre », « export » — bloquants : douze rangs,
  le premier à 0 point, des seuils strictement croissants, des âges qui ne reviennent
  jamais en arrière, du bébé à l'adulte ; trois bêtes (`tu`, `xiongmao`, `shi`) et trois
  idées de nom distinctes chacune ; chaque examen à titre de `examens.tsv` une fois, dans
  l'ordre, sous le rang qu'il accorde, et chaque nomination de `nominations.tsv` à son
  palier ; un examen ou un palier par rang, jamais les deux, et tous les rangs après le
  premier qui en demande un ; les dix phrases de Tao, sans jeton inconnu ; aucun
  dragon ; chaque titre et chaque nom de bête se lit dans son pinyin ; chaque caractère
  des titres a ses traits dans l'export ; `heros.json` dit les rangs, leurs examens et
  leurs paliers, les bêtes et les phrases des sources, et `index.json` le nomme.
- « jouer : sources », « export » — bloquants : les quatre phrases de Tao, une fois
  chacune, sourcées, sans jeton, ni emoji ni dragon, et jamais un reproche (ni « tu n'as
  pas… », ni regret, ni impatience, ni compte de jours ou d'absence : brief §9) ;
  `jouer.json` dit les phrases de la source, et `index.json` le nomme.
- « rythme : sources », « export » — bloquants : les dix-sept lignes du rythme gratuit,
  une fois chacune, sourcées, avec leurs seuls jetons ; ni achat ni Wenlu complet, ni
  urgence ni compte à rebours, ni estimation, ni emoji ni dragon ; Tao ne culpabilise
  jamais (brief §10) ; `rythme.json` dit les lignes de la source, et `index.json` le nomme.
- « rappels : sources », « export » — bloquants : les dix-huit textes, une fois chacun,
  sourcés, avec leurs seuls jetons, ni emoji ni dragon, et jamais un reproche, une série
  menacée, un manque (« tu nous manques »), une perte, un achat, une urgence ou une
  exclamation ; `rappels.json` dit les textes de la source, et `index.json` le nomme.
- « écrans : sources », « export » — bloquants : chaque texte de « Lire le monde » et du
  tableau des révisions, une fois, sourcé, avec exactement les jetons que l'app remplit ;
  ni emoji, ni dragon, ni temps passé, ni classement, ni percentile ; sept jours de la
  semaine ; à « Dis-le », au dictionnaire et chez Xing, aucun reproche (ni faux, ni erreur, ni raté, ni
  mauvais, ni échec, ni dommage, ni non, ni nul) ; chez Xing, une ligne `-atteste` dit
  l'attestation, une `-mnemo` le moyen mnémotechnique, une `-sans` ni l'un ni l'autre ; `ecrans.json` dit les textes des sources, et
  `index.json` le nomme.
- « tons : poids », « export » — bloquants : `modele.json` a la forme que l'app lit (format,
  34 entrées, cinq classes, couches cohérentes, température), pèse moins de 1 Mo, déclare
  ses données d'entraînement sous OGDL 1.0 avec leur attribution ; `PROVENANCE.md` porte
  l'empreinte des poids et du texte de la licence, la source, la licence, l'attribution et la
  recette ; `docs/sources-licences.md` nomme la source ; `tons.json` porte les mêmes poids et
  l'attribution, reste sous 1 Mo, `index.json` le nomme, `LICENCES.md` dit la licence et
  `OGDL-Taiwan-1.0.txt` est à côté.
- « écriture : gabarits », « couverture », « taille » — bloquants : chaque version exportée
  nomme `ecriture/gabarits.json` dans son index et le porte avec `ARPHICPL.TXT` et
  `MODIFICATIONS.md` à côté ; il se relit, porte exactement les 3 000 caractères du HSK 3.0
  dans l'ordre des niveaux, chacun avec autant de traits que ses médianes, et pèse moins de
  480 Ko. « écriture : étendue » (signalé) : aucun gabarit réduit à un point. La séparation
  des licences refuse dans `ecriture/` un fichier sans en-tête APL ou avec une clé étrangère.
- « image du chemin » — bloquant : aucun texte affiché que le pipeline écrit (textes
  d'écran, rythme, annonces des portes, examens, phrases de Tao, bêtes, rappels) ne dit
  graine, forêt, arbre, borne ni stèle (décisions du propriétaire du 29 septembre 2026) ;
  « l'arbre des caractères », la décomposition, passe ; le contenu et le rang 翰林 ne sont
  pas relus (`vocabulaire.py`).
- « ouvertures : sources », « contenu », « export » — bloquants : chaque porte une fois,
  comptée en `jour` ou en `lus`, jamais pendant la première session (jour 3 au plus) ; un
  parent connu, placé avant, et qui ne s'ouvre pas après elle ; une porte silencieuse au
  même seuil que son parent ; une annonce qui nomme sa porte, sans achat ni déblocage,
  urgence, estimation, reproche, emoji ni dragon ; Lire ouvert au jour de la première lettre
  de Que, les contes au jour de la première fable du chemin, la rencontre de Xing au palier
  du premier examen, en tête du calendrier ; `ouvertures.json` dit les
  portes de la source, et `index.json` le nomme.
- « anecdotes : sources », « forme », « charte », « étymologie », « export » —
  bloquants : un seul caractère par anecdote, jamais deux fois, titre, texte et source
  présents (« rédigé pour l'app »), appui, étiquette et statut connus ; un titre de 8 à
  80 signes, un texte de 150 à 480 signes et de trois à cinq phrases, le caractère cité ;
  ni emoji ni dragon ; un texte qui parle de l'origine d'un caractère ou d'un mot porte
  l'étiquette attesté ou mnémotechnique, une légende se dit comme telle ;
  `anecdotes.json` dit la source, chaque caractère avec ses traits. « anecdotes :
  parcours » — signalé : combien parlent d'un caractère du parcours Lire, et de ses
  90 premiers jours ; au moins 60 anecdotes.

## Licence des décompositions (`wenlu licences`)

Après `export`, hors de `tout`. La recette de la décision du 28 septembre 2026
(`docs/sources-licences.md` §10) : elle ne change rien à l'export, et écrit :

- `data/work/build/licences.json` : `{fichiers: [[nom, sha256]], caracteres: [{c, genre,
  motifs[], parts[], sources[], structure, regime, conforme, surcharge, chaine,
  sans_ligne}]}`. `chaine` est la décomposition redescendue avec la chaîne du build
  (surcharges > cjk-decomp), `sans_ligne` la même sans la ligne d'`ids.tsv` du caractère
  (nulle sans ligne) : `{verdict, composants[], structure, meme_tete}`, `verdict` parmi
  `identique`, `equivalent` (même composant de la norme, autre point de code),
  `variante` (même groupe de la norme), `ordre`, `different`, `non_reconcilie`,
  `absent`. `conforme` : la chaîne redonne les `parts` exportés et la structure du build.
- `docs/licences-decompositions.md`, versionné : décompte par source, recette, lignes de
  surcharge superflues, ce que le projet doit encore à Make Me a Hanzi (embarqué ou non),
  puis caractère par caractère. Deux passages écrivent les mêmes octets.

## Liste des mots HSK 3.0 (story D.1)

`data/sources/listes/hsk-mots.tsv`, versionné, écrit par `uv run wenlu listes mots`
(`mots_hsk.py`) depuis deux fichiers que `wenlu fetch` télécharge dans `data/work/sources/` :
`hsk30.csv` d'`ivankra/hsk30` (MIT, la source) et `hsk30-wordlist.txt`, le `wordlist.txt`
d'`elkmovie/hsk30` (MIT, l'OCR de Pleco du PDF officiel, le contrôle). Le PDF de
GF 0025-2021 reste illisible d'ici (`moe.gov.cn` bloqué) : même montage que les listes de
caractères `hsk-*.txt`. L'en-tête du fichier dit les sources, leurs SHA-256, leurs licences
(texte dans `data/sources/licences/MIT-hsk30.txt`, exporté) et la date du relevé ; la
commande garde cette date tant que l'empreinte de `hsk30.csv` ne change pas, et deux
passages écrivent les mêmes octets.

11 092 entrées, les seuls mots nouveaux de chaque niveau, lus en cumul comme les
caractères : HSK 1 500, HSK 2 772, HSK 3 973, HSK 4 1 000, HSK 5 1 071, HSK 6 1 140,
HSK 7-9 5 636. Une ligne par entrée, dans l'ordre de la norme :

| Colonne | Contenu |
|---|---|
| `id` | l'identifiant d'ivankra, `L<niveau>-<rang>` (`L1-0002`) : le niveau et le rang dans la table du niveau |
| `forme` | la graphie principale, en sinogrammes seuls |
| `pinyin` | le pinyin retenu, sans sandhi, en diacritiques (`àihào`, `bù kèqì`, `Běijīng`) |
| `syllabes` | une syllabe numérotée par sinogramme (`ai4 hao4`) ; `v` pour ü, `5` pour le ton neutre, `r5` pour le 儿 de l'érhua |
| `syllabes_pleines` | la lecture au ton plein quand `pinyin` neutralise une syllabe (règles ci-dessous) ; vide sinon |
| `niveau` | `1` à `6`, ou `7-9` |
| `categorie` | la ou les catégories du site officiel, séparées par `/` : `N` nom, `V` verbe, `Adj` adjectif, `Adv` adverbe, `M` classificateur, `Num` numéral, `Pron` pronom, `Prep` préposition, `Conj` conjonction, `Aux` particule, `Intj` interjection, `Prefix`, `Suffix`, `Phonetic` onomatopée ; vide pour 1 359 entrées que le site ne classe pas |
| `variantes` | les autres graphies, `forme:pinyin:syllabes`, séparées par `;` (`爸:bà:ba4`, `有一些:yǒuyīxiē:you3 yi1 xie1`, `谁:shuí:shui2`) |
| `exemple` | l'emploi que la norme cite pour un affixe ou un mot-outil, même format (`第` → `第二:dì-èr:di4 er4`) |
| `officiel` | l'entrée telle que la norme l'imprime (`白（形）`, `称¹（动）`, `…极了`, `爸爸｜爸`) |
| `pinyin_officiel` | le pinyin du site officiel tel quel, avec `∥`, `·` et le sandhi |

Lecture des graphies (`mots_hsk.deplier`) : `爸爸|爸` fait deux graphies ; `第（第二）`, dont
la parenthèse contient le mot, est le mot 第 cité dans l'emploi 第二 (22 entrées) ; `有（一）些`,
`好（不）容易`, `茅台（酒）` ont un élément facultatif, la forme courte d'abord ; `…极了`,
`…分之…` perdent leurs points de suspension (le mot est 极了, `officiel` les garde) ; `称¹`,
`面²` leur numéro d'homographe ; `谁 shéi/shuí` et `熟 shú/shóu` font deux graphies de mêmes
sinogrammes. `〇`, hors des blocs de sinogrammes unifiés, se lit `líng`.

Ce qui n'est jamais lu : la colonne `CEDICT` d'ivankra (la clé d'une entrée CC-CEDICT)
et la colonne `Variants`, dont le JSON la recopie. Le lecteur (`lire_ivankra`) ne garde
que `ID`, `Simplified`, `Pinyin`, `POS`, `Level`, `WebPinyin` et `OCR`. Aucun sens :
la liste dit la forme, le pinyin, le niveau et la catégorie.

### Le pinyin des mots, tranché

Base : la colonne `Pinyin` d'ivankra, le pinyin du site officiel nettoyé **sans sandhi**
(一 yī, 不 bù), la convention du dépôt (`pinyin.py`). Le pinyin du site (`WebPinyin`)
écrit le sandhi (`yíxià`, `bú kèqì`) et deux notations que la base perd :

- `∥` sépare un verbe séparable (`bāng∥máng`) : sans effet sur la lecture, ignoré.
- `·` précède une syllabe au **ton neutre facultatif**, la notation du 现代汉语词典 : le
  ton est neutre d'ordinaire et peut se dire plein (知道 zhī·dào, 学生 xué·shēng,
  出来 chū∥·lái). **Règle retenue : la syllabe pointée s'écrit au ton neutre** (zhīdao,
  xuésheng, chūlai), la lecture de l'oral courant, comme le dépôt le faisait déjà pour les
  mots de fiche d'après CC-CEDICT et comme le propriétaire l'a décidé pour les mots de
  position le 26 septembre 2026. La lecture au ton plein n'est pas fausse : elle reste
  dans `syllabes_pleines` et la recherche l'accepte (`zhi1dao4` trouve 知道). 138 entrées
  portent `·` ; pour 可不是 (kěbú·shi), la syllabe est déjà neutre dans la base.

**Les neuf conflits avec les mots de position.** `pinyin.MOTS_DE_POSITION` (décision du
propriétaire du 26 septembre 2026, « Je te laisse décider » : la lecture du 现代汉语词典)
écrit au ton neutre la seconde syllabe de 21 mots de position (后面 hòumian, 这里 zhèli…) et
garde le ton plein de 旁边, 那边, 这边. Neuf entrées de la liste disent autrement dans la
colonne `Pinyin` :

| Mot | `Pinyin` | `WebPinyin` | Retenu | Par |
|---|---|---|---|---|
| 哪里 | nǎlǐ | nǎ·lǐ | nǎli | la règle `·` (et la décision) |
| 那里 | nàlǐ | nà·lǐ | nàli | la règle `·` (et la décision) |
| 这里 | zhèlǐ | zhè·lǐ | zhèli | la règle `·` (et la décision) |
| 外面 | wàimiàn | wài·miàn | wàimian | la règle `·` (et la décision) |
| 后面 | hòumiàn | hòumiàn | hòumian | la décision du 26 septembre |
| 里面 | lǐmiàn | lǐmiàn | lǐmian | la décision du 26 septembre |
| 前面 | qiánmiàn | qiánmiàn | qiánmian | la décision du 26 septembre |
| 上面 | shàngmiàn | shàngmiàn | shàngmian | la décision du 26 septembre |
| 下面 | xiàmiàn | xiàmiàn | xiàmian | la décision du 26 septembre |

**La décision du 26 septembre l'emporte**, pour trois raisons : c'est une décision écrite du
propriétaire, que les contes, les lettres, WeChat et l'éclair suivent déjà
(`ecarts_de_position`) ; le dictionnaire ne doit pas dire un autre pinyin que le reste de
l'app pour le même mot ; et le 现代汉语词典, la référence que la norme suit elle-même pour
`·`, écrit 后面 hòu·mian. Les douze autres mots de position de la liste (北边 běibian…,
旁边 pángbiān) concordent déjà. La lecture pleine de la liste reste dans `syllabes_pleines` :
`hou4 mian4` trouve 后面.

Chaque syllabe se lit dans les lectures de son caractère (surcharges, puis `kMandarin`,
`kTGHZ2013` et `kXHC1983` d'Unihan), au ton plein ou neutre : c'est ce qui découpe le pinyin
en syllabes (`mots_hsk.decouper`), sans deviner. Les 11 092 entrées se lisent toutes ainsi, y
compris 闺女 guīnü (女 au ton neutre).

## Format intermédiaire (story 1.1)

`uv run wenlu fetch` écrit les sources brutes dans `data/work/sources/`, avec `SHA256SUMS` et `PROVENANCE.md` (URL, date, taille, empreinte, licence). `uv run wenlu ingest` les normalise dans `data/work/ingest/`, hors dépôt :

- `caracteres.json` : `[{c, radical, pinyin[], definition_en, etymologie}]` depuis `dictionary.txt` (LGPL), pour le contexte des fiches et les contrôles, jamais pour l'export. Sa chaîne IDS n'est plus ingérée depuis le 28 septembre 2026 : la décomposition ne peut plus en dériver (`docs/sources-licences.md` §10). `etymologie` est la couche étymologique EN, `{type, hint, phonetic, semantic}`, `type` parmi `pictographic`, `ideographic`, `pictophonetic` ; elle reste distincte de la décomposition.
- `graphies.json` : `[{c, strokes[], medians[]}]` depuis `graphics.txt`, autant de médianes que de traits.
- `mots.json` : `[{traditionnel, simplifie, pinyin, definitions_en[]}]` depuis CC-CEDICT.
- `listes.json` : `{ "<nom de liste>": [caractères] }`, chargé depuis `data/sources/listes/*.txt` (un sinogramme par ligne, `#` en commentaire, ni doublon ni non-sinogramme).
- `unihan.json` : `{source, licence, url, version, date, fichiers[], champs[], frequence,
  caracteres: [{c, code, pinyin, lectures[], lectures_dico[], traits, frequence}]}` depuis
  `Unihan.zip` (UCD, Unicode License). `pinyin` est la première lecture de `kMandarin`, la
  plus courante en zh-CN selon UAX #38 ; `lectures` les garde toutes. `lectures_dico` réunit
  les lectures de `kTGHZ2013` (通用规范汉字字典) puis de `kXHC1983` (现代汉语词典), qui
  nomment toutes celles d'un polyphone (好 hǎo hào) là où `kMandarin` n'en donne qu'une. `traits` vient de
  `kTotalStrokes`, `frequence` de `kFrequency` — absent d'Unihan 17.0.0 et 18.0.0, où il
  vaut donc `null` ; il existait encore en 12.0.0. `fichiers` reprend l'en-tête officiel
  de chaque `Unihan_*.txt` lu (nom, date, version), qui vaut preuve de provenance.
- `unihan-definitions.json` : `{…, definitions: [{c, definition_en}]}` depuis
  `kDefinition`. Fichier séparé parce que ces gloses sont anglaises : comme celles de
  CC-CEDICT, elles ne doivent jamais alimenter la génération des fiches FR.
- `ids-secondaires.json` : `{source, licence, url, usage, ids: {caractère: IDS}}` depuis
  `cjk-decomp.txt` (MIT), converti en IDS par `cjkdecomp.py`. La source de la
  décomposition, surcharges devant ; le nom du fichier date du temps où elle n'était que
  le repli de Make Me a Hanzi.
- `rapport.json` : décomptes du passage et caractères des listes absents du dictionnaire.

## Table GF 0014-2009 (story 1.2)

`data/sources/gf0014-2009/composants.tsv`, versionné. Les 514 composants de la norme,
en TSV, `#` en commentaire. L'en-tête du fichier documente les sources, leurs URL, leurs
empreintes SHA-256 et les écarts relevés entre elles. Colonnes : `sequence` (1 à 514),
`groupe` (1 à 441 ; un groupe réunit un composant principal et ses variantes de forme
部件变体), `forme`, `type_forme` (`unicode` ou `ids` pour les 30 composants sans point de
code), `nom` (部件名称 sans pinyin), `nom_simple`, `principal` (forme du principal du
groupe), `caractere_plein` (1 si 成字部件).

Quatre points de code portent deux composants distincts de la norme : ⺈, 丁, 丷, 𧘇.

## Réconciliation (story 1.2)

`uv run wenlu build` écrit dans `data/work/build/`, hors dépôt :

- `decompositions.json` : `{norme, table: {fichier, composants, groupes}, univers,
  source_ids, source_ids_surcharge,
  caracteres: [{c, composants[], structure, reconcilie, inconnus[], cycle[], sources[]}]}`.
  L'univers est celui de `graphies.json` (les 9 574 caractères de `graphics.txt`).
  `composants` est la liste ordonnée des feuilles atteintes en descendant l'IDS —
  celui d'`ids.tsv` s'il existe, sinon celui de cjk-decomp, formes de notation ramenées
  à la norme par `notation-candidats.tsv` (⺹ → 耂) — jusqu'aux composants de la norme,
  dans l'ordre des opérandes IDS, qui est l'ordre d'écriture. Un composant de la norme est une feuille : on n'y descend plus.
  `structure` est l'IDS réduit à ces feuilles. `inconnus` liste les feuilles absentes de
  la norme — elles figurent quand même dans `composants` — et `cycle` le chemin de
  descente qui boucle. `reconcilie` vaut vrai quand les deux sont vides. `sources` nomme
  les sources d'IDS descendues (`cjk-decomp`, `surcharge`) ; `dictionary.txt` n'est pas
  lu. Chaque caractère exporté a été relu contre la norme à la migration : ce que
  cjk-decomp ne rendait pas s'est écrit dans `ids.tsv`.
- `ecarts.md` : décompte des caractères réconciliés, composants inconnus classés par
  fréquence avec leur point de code, cycles, apport de cjk-decomp, et état des
  listes prioritaires (seuil 255, HSK 1).

### Le ton neutre, le pinyin des mots et les étages, dans tout le contenu

Décisions du propriétaire du 1er octobre 2026, après la contre-relecture (« Celle du
现代汉语词典 », « La liste HSK 3.0 », « Américain : second floor »). Elles valent pour tout
texte rédigé : mots et phrases des fiches, trois lignes et leur glossaire, examens et leur
glossaire, lettres, contes, WeChat, phrases du dictionnaire.

- **Ton neutre : la notation du 现代汉语词典.** Une syllabe qu'il pointe (`·`) s'écrit au
  ton neutre, comme la règle `·` ci-dessus. En particulier :
  - 过 particule d'aspect (去过, 吃过) : `guo` ; 过 verbe ou complément de résultat
    (过来, 走过去) garde `guò` quand le dictionnaire ne le pointe pas ;
  - 上 et 里 localisateurs après un nom (桌上, 家里, 心里) : `shang`, `li` ; les mots de
    position restent tranchés comme ci-dessous ;
  - compléments directionnels après un verbe : 来 et 去 au ton neutre (出来 chū lai,
    回去 huí qu, 起来 qǐ lai) ; dans un complément composé, ses deux syllabes
    (拿出来 ná chu lai, 站起来 zhàn qi lai, 走进去 zǒu jin qu) ;
  - les particules (了, 着, 的, 地, 得, 吗, 呢, 吧, 啊), les suffixes (子, 头 de 木头,
    们) et les redoublements (看看, 尝尝, 妈妈) au ton neutre, comme aujourd'hui.
- **Pinyin d'un mot de la liste HSK 3.0 : celui de la liste** (colonne `Pinyin`
  d'ivankra, avec la règle `·`) prime sur CC-CEDICT quand ils diffèrent (口袋 kǒudai,
  出血 chūxiě) ; CC-CEDICT ne sert que pour un mot hors de la liste.
- **Les étages en anglais suivent l'usage américain**, qui compte comme le chinois :
  一楼 « first floor », 二楼 « second floor » ; le français garde « rez-de-chaussée »,
  « premier étage ».

### Surcharges des sources, versionnées

Les fichiers téléchargés ne se corrigent jamais sur place. Une erreur relevée se
corrige dans `data/sources/surcharges/`, une ligne et une raison par correction
(`surcharges.py`) :

- `ids.tsv` (`c`, `ids`, `raison`) : l'IDS passe devant cjk-decomp, et la décomposition
  qui le descend porte la source `surcharge`. Chaque ligne est rédigée pour Wenlu, jamais
  recopiée d'une source ; celles de la migration du 28 septembre 2026 le disent
  (« rédigé pour Wenlu d'après GF 0014-2009 »). Les dix-huit qui reprenaient d'abord un
  écart à la norme pour ne rien changer à l'app ont été corrigées le 28 septembre 2026
  (`decompositions-corrigees.md`). Une surcharge n'entre
  que si la table de la norme la justifie : un composant propre (那字旁 pour 那,
  学字头 pour 学), un point de code de notation ramené à celui de la norme (㇔ → 丶,
  ⺼ → 月), ou une source qui se trompe de composant (壴, 在). Les 30 composants sans
  point de code s'y écrivent entre accolades : `⿰{⿰𠄌丶}人`.
- `equivalences.tsv` (`forme`, `composant`, `raison`) : un point de code de la source
  qui porte des tracés est apparié au composant que la norme écrit autrement, sans
  être renommé (⺮ pour 𥫗, 竹头) : la feuille reste dessinable.
- `notation-candidats.tsv` (`forme`, `composant`, `raison`) : une forme de notation de
  cjk-decomp, absente de la table, ramenée au composant de la norme avant la descente
  (⺹ → 耂, 㐅 → 乂) ; la décomposition garde la source `cjk-decomp`. Une forme de la
  table ne s'y renomme jamais (卄 n'est pas 艹 : cela se corrige dans `ids.tsv`).
- `pinyin.tsv` (`c`, `lectures`, `raison`) : les lectures remplacent celles de Make Me
  a Hanzi (contexte des fiches) et d'Unihan (export). La première est la principale.
  Une forme de composant sans lecture dans Unihan y prend celle du caractère plein
  (⺮ zhú, comme 竹) : l'export n'a plus de pinyin de repli tiré de `dictionary.txt`.
- `decoupes.tsv` (`composant`, `hôte`, `indices`, `recadrage`, `raison`) : un composant
  de la norme que `graphics.txt` ne dessine pas prend les traits désignés d'un caractère
  hôte qui le contient (以 pour 以字旁, 左 pour 𠂇, 学 pour 𭕄…), comptés à partir de 0
  dans l'ordre d'écriture (`0,1`, `3-6`). `recadrage` vaut `centre` (homothétie qui
  porte la boîte des traits retenus au centre de la boîte de 1024, plus grand côté à
  760, jamais agrandie plus de deux fois) ou `aucun`. `wenlu build` en écrit
  `decoupes.json` : `{source, source_traits, licence_traits, recadrage, decoupes[]}`,
  chaque découpe `{c, hote, indices[], traits_hote, recadrage, echelle, dx, dy,
  raison, strokes[], medians[]}` ; `wenlu export` en tire les traits (`decoupes.py`).
- `decompositions-corrigees.md` : ce qui a été vérifié contre la table, corrigé le
  28 septembre 2026 (ancienne et nouvelle décomposition, jours changés) ou laissé tel
  quel, avec la raison.

`uv run wenlu check` relit `decompositions.json` : le contrôle « composants inconnus »
signale sans bloquer (la norme ne couvre que 3 500 caractères), le contrôle « cycles »
est bloquant.

## Graphe et parcours (story 1.3)

`uv run wenlu build` écrit ensuite, toujours dans `data/work/build/` :

### `graphe.json`

`{norme, source, critere_racine, compte, noeuds[], aretes[], familles[], cycles[]}`.

- `compte` : `{noeuds, aretes, familles, familles_non_vides, briques, caracteres,
  muettes, decoupees, cycles}`.
- `noeuds` : `[{c, genre, prerequis[], dependants, racine, reconcilie}]`. `genre` vaut
  `brique` (composant GF 0014-2009 présent au dictionnaire, il porte une fiche et se
  pose en une session), `caractere` (caractère du dictionnaire qui n'est pas un
  composant de la norme), `decoupee` (feuille sans fiche mais dessinée : composant de
  la norme absent du dictionnaire, découpé dans un hôte par `decoupes.tsv`) ou `muette`
  (feuille sans fiche ni traits : composant sans point de code ni découpe, ou forme
  absente du dictionnaire, à commencer par `？`, la marque de Make Me a Hanzi pour un
  élément qu'il ne décompose pas). `prerequis` est la liste ordonnée et sans
  doublon des composants canoniques, dans l'ordre d'écriture ; une brique et une feuille
  muette n'en ont pas, puisque la norme découpe en un seul niveau. `dependants` est le
  nombre de caractères qui contiennent le nœud — c'est la mesure de fréquence du
  parcours. `racine` est la famille d'appartenance.
- `aretes` : `[[prerequis, dependant]]`, une arête par dépendance distincte ; un
  composant répété (森) ne compte qu'une fois, et un nœud n'est jamais son propre
  prérequis.
- `familles` : `[{racine, genre, n, membres[]}]`, triées par taille décroissante.
  `membres` exclut la racine, `n` vaut `len(membres)`. Critère de racine : la première
  brique dans l'ordre d'écriture, en remontant de proche en proche jusqu'à une feuille —
  simple et déterministe, en attendant les rôles son / sens de la story 1.4. Les
  familles partitionnent le graphe : chaque nœud appartient à une et une seule.
- `cycles` : chemins qui bouclent. Doit être vide.

### `parcours-lire.json`, `parcours-hsk.json`

`{parcours, liste, regle, ordre, critere_frequence, depart[], cible[], gratuit, etapes[], compte,
jours[], briques[], briques_muettes[], briques_decoupees[], non_reconcilies[], absents[]}`.

- `ordre` : d'où viennent les jours — `figé : data/sources/parcours/ordre-<nom>.tsv`
  (le cas du dépôt depuis le 28 septembre 2026) ou `calculé (aucun ordre figé)`.

- `parcours` vaut `lire` (le seuil 255, puis le HSK 3.0 du HSK 1 au HSK 7-9) ou `hsk`
  (le HSK 1, puis le HSK 2 au HSK 7-9). Même graphe, seules les listes changent.
  Décision du propriétaire du 30 septembre 2026 : les deux chemins suivent le HSK 3.0
  (GF 0025-2021) jusqu'au bout ; les seuils 405 à 1555 du brief sont introuvables.
- `etapes` : `[{liste, fin, cible[]}]`, les listes du parcours dans l'ordre (`ETAPES` de
  `graphe.py`), chacune avec le dernier jour du chemin qui en pose un caractère. Une étape
  n'apporte que ce que le chemin n'a pas encore posé, et se termine, ses jours de
  fermeture compris, avant que la suivante commence. La première est le chemin gratuit
  (brief §10), les suivantes sont de Wenlu complet.
- `gratuit` : la fin de la première étape, le dernier jour du chemin gratuit (189 sur le
  chemin Lire, 219 sur le chemin HSK).
- `cible` : la liste du chemin gratuit, la première étape, dans l'ordre du référentiel
  (le rang du dernier de ses caractères borne le pinyin des examens,
  `examens.fin_premiere_etape`) ; toutes les listes sont dans `etapes`.
- `compte` : `{cibles, jours, jours_reconcilies, briques, muettes, decoupees,
  non_reconcilies, absents}`.
- `jours` : `[{jour, brique, composes[], non_reconcilie}]`. Un jour est une session de
  10 minutes : au plus une brique nouvelle, puis un ou deux composés qui deviennent
  lisibles avec elle. `brique` est nul les jours de consolidation, quand il ne reste que
  des composés à poser. Les jours `non_reconcilie` ferment chacun leur étape.
- `depart` : ce que la première session enseigne (brief §6, story 2.7), `人 大 天`
  pour `lire` comme pour `hsk` (`DEPART` de `graphe.py`) : la première session est
  la même quel que soit le parcours choisi ensuite. Ces caractères ouvrent le
  parcours, un jour chacun, dans cet ordre et sans composé : la première session les
  pose d'un coup, et la session complète reprend au jour qui suit (`jourApresDepart`
  de `app/src/lib/premiere.ts`). La règle d'une brique nouvelle par jour tient ; seul
  l'ordre de priorité cède.
- Ordre figé : les jours se lisent dans `data/sources/parcours/ordre-<nom>.tsv`,
  versionné, et ne se recalculent plus. `wenlu build` valide le fichier contre le graphe
  — départ imposé, une brique nouvelle au plus par jour, chaque composé après toutes ses
  briques, toutes les listes couvertes, rien qui ne soit plus à apprendre, les étapes
  dans l'ordre (l'étape d'un jour ne redescend jamais ; un composant qu'une liste plus
  tôt demande est de son étape), les non réconciliés et absents de chaque étape à sa
  fin — et s'arrête sur `OrdreInvalide` s'il ne tient plus : un
  changement de source ou de décomposition ne déplace jamais un jour en silence. Le
  fichier : un en-tête `jour brique composes statut`, puis une ligne par jour, séparée
  par des tabulations ; `-` pour une case vide, `ferme` pour les jours de fermeture.
  `uv run wenlu parcours figer` le réécrit depuis le build (`--recalculer` : depuis le
  calcul ci-dessous) ; son diff se relit avant d'être versionné. Premier gel : l'ordre
  de la version 0.1.0, jour pour jour, au moment où la décomposition a quitté
  `dictionary.txt` (`docs/sources-licences.md` §10). `uv run wenlu parcours prolonger`
  (30 septembre 2026) garde ces jours, fermeture comprise, à l'identique et calcule la
  suite, étape par étape ; l'en-tête du fichier dit alors les étapes, leurs règles, leur
  source et le dernier jour de chacune, et une ligne `# — HSK 2 —` marque le début de
  chaque étape dans la liste des jours. `--nom lire --jusqua N` garde en plus les jours
  prolongés jusqu'au jour N et recalcule le reste : c'est ainsi qu'une réconciliation de
  décompositions se pose sans bouger les jours déjà rédigés. Prolongement du 30 septembre
  2026, repris après la réconciliation de 44 décompositions (jours gardés : 338 sur le
  chemin Lire, 220 sur le chemin HSK) : Lire, 1 463 jours (seuil 255 jusqu'au jour 189,
  HSK 1 au 230, HSK 2 au 340, HSK 3 au 468, HSK 4 au 606, HSK 5 au 746, HSK 6 au 890,
  HSK 7-9 au 1 462) ; HSK, 1 470 jours (HSK 1 jusqu'au jour 219, HSK 2 au 343, HSK 3 au
  475, HSK 4 au 613, HSK 5 au 753, HSK 6 au 897, HSK 7-9 au 1 469). Chaque étape se ferme
  par ses propres non réconciliés (16 en tout, sur neuf jours de fermeture).
- Calcul, qui ne sert plus qu'à proposer un ordre ou une suite : étape par étape, tri topologique — une brique avant tout ce qui la contient. Parmi les
  candidats prêts, priorité aux caractères de la liste de l'étape, puis à ce qui devient
  lisible le jour même, puis à la fréquence, puis à l'ordre de la liste. Make Me a Hanzi
  ne fournit aucun rang de fréquence : le repli documenté (`critere_frequence`) est le
  nombre de caractères qui dépendent du candidat. Si l'ingestion vient à produire un
  rang sous la clé `frequence`, il prend le pas sans autre changement.
- `briques_muettes` : les feuilles sans fiche employées par des caractères de la liste.
  Acquises d'entrée, elles ne prennent jamais de jour ; `wenlu check` les signale.
- `briques_decoupees` : les feuilles découpées employées par des caractères de la
  liste. Dessinées, elles ne sont plus signalées ; elles restent acquises d'entrée,
  pour que le parcours — et l'acquis dont dépendent les phrases des fiches — ne
  bouge pas.
- `non_reconcilies` et `absents` : caractères des listes dont la décomposition n'est pas
  réconciliée (60 sur les 3 000 du HSK 3.0, dont 兴 au seuil 255 et au HSK 1 ; voir
  `data/sources/surcharges/decompositions-corrigees.md`) ou qui manquent au
  dictionnaire.
  Ils ferment leur étape, marqués `non_reconcilie` : jamais oubliés ; la session les saute.

`uv run wenlu check` ajoute quatre contrôles : « cycles du graphe » (bloquant),
« parcours figés » (bloquant : chaque parcours a son ordre versionné et le build le suit),
« caractères de liste absents du parcours » (bloquant) et « briques muettes » (signalé).

## Fiches FR et EN (story 1.4)

Une fiche explique un caractère du parcours par ses composants : origine en exactement
trois phrases FR et EN, étiquette `atteste` ou `mnemotechnique`, rôle de chaque
composant, deux mots et une phrase. Aucun texte de fiche n'entre dans le dépôt sans
passer par le pipeline : il sort de la génération par l'API ou de l'import d'un
brouillon rédigé sans API, avec les mêmes contrôles, puis d'une relecture humaine.

### Contexte soumis au modèle

Assemblé par `fiches.Corpus` depuis `decompositions.json`, `graphe.json`,
`parcours-<nom>.json`, `caracteres.json` et `mots.json` :

- le caractère, son pinyin (`caracteres.json`, corrigé par
  `data/sources/surcharges/pinyin.tsv`), sa famille et son genre (`graphe.json`) ;
- sa décomposition canonique GF 0014-2009 (`decompositions.json`), avec le nom normalisé
  (部件名称) de chaque composant, pris dans `composants.tsv` ;
- le rôle probable d'un composant quand l'étymologie de Make Me a Hanzi le désigne comme
  `phonetic` (son) ou `semantic` (sens). C'est une donnée factuelle, donnée au modèle
  pour vérification, jamais un verdict ;
- son `type` d'étymologie et son `hint` anglais, ce dernier nommément marqué comme
  indice à vérifier, à ne ni traduire ni recopier (`docs/sources-licences.md` §2.2) ;
- les mots candidats : mots de deux caractères de CC-CEDICT contenant le caractère et
  dont tous les caractères sont déjà vus au jour du parcours, avec leur pinyin et rien
  d'autre. Les entrées au pinyin capitalisé (noms propres) sont écartées, et celles de
  `data/sources/mots-exclus.tsv` (`mot`, `raison` : argot, termes de mahjong, mots rares
  ou spécialisés, fragments de locution). La définition anglaise n'est jamais lue ni
  transmise (`docs/sources-licences.md` §4.2) ;
- les caractères acquis à ce jour, caractère du jour compris : les seuls autorisés dans
  la phrase. Pour un caractère du départ, ceux de toute la première session, qui les
  pose ensemble : 人, 大 et 天 ont chacun les trois.

La réponse est contrainte par `output_config.format` (JSON structuré). La validation
refuse une fiche dont l'origine FR ou EN ne fait pas exactement trois phrases (points
finaux comptés), dont l'étiquette sort des deux valeurs, dont le sens (`sens_fr` ou
`sens_en`) passe 40 caractères ou finit par un point, dont un mot n'est pas dans les
candidats, qui porte plus de deux mots, ou dont la phrase emploie un caractère hors de
l'acquis — les intrus sont listés exactement. La relance signale les motifs de refus,
au plus trois essais. Sens absent, rôle manquant, traduction vide, phrase sans le
caractère du jour et moins de deux mots sont des écarts signalés à la relecture, pas des rejets : une
fiche peut prendre moins de mots qu'il n'y a de candidats, pour qu'un mot rare,
d'argot ou douteux ne s'impose jamais faute de mieux.

### Fiche écrite, versionnée

`uv run wenlu fiches generer [--parcours lire] [--jusqua N] [--c 住]` puis
`uv run wenlu fiches recuperer` écrivent `data/sources/fiches/<c>.json`, versionné :
le texte d'une fiche est un contenu, sa relecture se lit dans l'historique git.
`uv run wenlu fiches importer` y écrit aussi, depuis un brouillon rédigé sans API
(voir « Brouillons de fiches ») :

```json
{
 "c": "住",
 "parcours": "lire",
 "jour": 160,
 "pinyin": ["zhù"],
 "sens_fr": "habiter, vivre",
 "sens_en": "to live, to stay",
 "composants": ["亻", "主"],
 "structure": "⿰亻主",
 "origine_fr": "…",
 "origine_en": "…",
 "etiquette": "atteste",
 "memo_fr": null,
 "memo_en": null,
 "roles": {"亻": "sens", "主": "son"},
 "mots": [{"hanzi": "住口", "pinyin": "zhù kǒu", "fr": "…", "en": "…"}],
 "phrase": {"zh": "…", "pinyin": "…", "fr": "…", "en": "…"},
 "generation": {
  "modele": "claude-opus-5",
  "api": "messages.batches",
  "date": "2026-09-21T10:00:00Z",
  "empreinte_invite": "sha256:…",
  "essais": 2,
  "refus": []
 },
 "statut": "a_relire"
}
```

`sens_fr` et `sens_en` suivent `pinyin` : voir « Le sens » ci-dessous.
`roles` donne, par composant de la décomposition canonique, `son`, `sens` ou `forme`
(voir « Le rôle son » ci-dessous : `son` veut dire « aide à prononcer aujourd'hui »).
`etiquette` vaut `atteste` seulement si l'origine est établie par le Shuowen ou la
paléographie, `mnemotechnique` sinon — jamais l'un pour l'autre. `memo_fr` et `memo_en`
sont facultatifs. `generation` est la traçabilité : d'où vient la fiche et comment.
`statut` vaut `a_relire` à la sortie du pipeline, `rejete` s'il reste un motif de refus
après trois essais, `relu` une fois la relecture humaine faite
(`uv run wenlu fiches relire --c 住 --statut relu`). Seules les fiches relues sont
exportables : la relecture est obligatoire sur le seuil 255 (brief §17).

Le journal des lots, lui, reste hors dépôt, dans `data/work/fiches/lots/<lot>.json` :
c'est l'état d'un passage, pas un contenu. Il porte l'identifiant du lot, le
parcours, le modèle, la date de soumission, le statut, et une entrée par requête (`custom_id`,
caractère, numéro d'essai, empreinte de l'invite).

`uv run wenlu check` relit ces fichiers s'ils existent : le contrôle
« fiches : validation » est bloquant, le contrôle « fiches : relecture du seuil 255 »
compte ce qui reste à relire et les caractères du seuil sans fiche — il signale, il ne
bloque pas. Le contrôle « fiches : sens » est bloquant : une fiche relue sans sens, ou
un sens hors format, où qu'il soit. `uv run wenlu fiches valider` refait le même contrôle à la demande. Le
contrôle « fiches : rôle son » signale, sans bloquer, un rôle `son` loin de la lecture
moderne (ci-dessous).

### Le sens

`sens_fr` et `sens_en` disent ce que veut dire le caractère, en une glose courte que
l'app lit sous le pinyin (carte du jour, Apprendre, fiches, Chercher) et pose en
question (« sens d'un caractère », « caractère à partir du sens »).

- Le ou les sens principaux, séparés par « , » : `habiter, vivre`, `to live, to stay`.
- En minuscules, sauf nom propre ; sans point final ; 40 caractères au plus
  (`fiches.SENS_MAX`).
- Un composant qui n'est pas un caractère autonome (⺀, 亻, 氵, 扌, 讠…) se glose par
  son nom de composant : `homme (clé)`, `person (radical)`.
- Rédigés, jamais repris d'un dictionnaire (ni `kDefinition` d'Unihan ni CC-CEDICT).

Le chargeur est tolérant : une fiche sans ces clés se lit avec un sens vide, et un
brouillon peut ne pas les avoir encore (écart « sens absent », pas un rejet). Une
fiche **relue**, elle, les porte : `relire` et `appliquer-relecture` refusent de
marquer relue une fiche sans sens, et « fiches : sens » bloque `wenlu check` sur une
fiche relue sans sens. Un sens trop long ou fini par un point est refusé par
`valider()` (donc à la génération et à l'import) et par « fiches : sens ».

### Le rôle son

Décision du propriétaire : un composant n'est étiqueté `son` que s'il aide à prononcer
le caractère **aujourd'hui**, en mandarin moderne. L'app pose la question « quel
élément donne le son ? » et la note seule : la réponse doit s'entendre.

- Critère : la phonétique se lit sur la **même syllabe** que le caractère, initiale et
  finale identiques, **le ton libre**. 妈 mā ← 马 mǎ, 请 qǐng ← 青 qīng, 们 men ← 门
  mén, 近 jìn ← 斤 jīn sont `son`.
- Une phonétique seulement historique, qui ne sonne plus pareil, passe en `forme` :
  说 shuō ← 兑 duì, 谁 shéi ← 隹 zhuī, 给 gěi ← 合 hé. De même une phonétique qui ne
  fait plus que rimer (很 hěn ← 艮 gèn, 问 wèn ← 门 mén, 钱 qián ← 戋 jiān) ou ne garde
  que l'initiale (打 dǎ ← 丁 dīng) : proche n'est pas pareil. Si le composant porte
  aussi le sens, il passe en `sens` (姓 ← 生, naître).
- Lectures comparées : la lecture **principale** du caractère (première de
  `kMandarin`, ou de `surcharges/pinyin.tsv` qui la corrige : 呢 se lit ne, sa
  lecture ní de 呢子 ne compte pas) contre **l'une quelconque** des lectures de la
  phonétique (长 zhǎng ou cháng).
- La phonétique est le caractère qu'écrivent les composants `son`, pris ensemble :
  la norme découpe souvent la phonétique (青 en 龶 et 月, 曷 en 日, 勹, 人 et 𠃊), et
  chacun de ses composants porte alors `son`. Le contrôle la retrouve par la
  phonétique de Make Me a Hanzi, par le composant seul, ou par le caractère dont la
  décomposition canonique est exactement ces composants et dont la structure se lit
  dans celle du caractère. Quand la forme moderne l'a trop réduite pour cela, une
  ligne de `data/sources/surcharges/phonetiques.tsv` (`c`, `phonetique`, `raison`)
  la nomme : 又 réduit à 𠂇 dans 有, 辛 découpé en 立, 一 et 小 dans 新.
- L'histoire reste dans l'origine : `origine_fr` et `origine_en` peuvent dire que le
  composant « donnait autrefois le son », jamais qu'il le donne quand son rôle est
  `forme`.

Le contrôle « fiches : rôle son » (`phonetiques.py`) applique ce critère à chaque
fiche, avec les lectures d'Unihan déjà ingérées (`unihan.json`) : il nomme le
caractère, sa lecture, la phonétique et ses lectures, ou dit qu'il n'a pas trouvé la
phonétique. C'est un avertissement de relecture, jamais un rejet.

### Brouillons de fiches, versionnés (rédaction sans API)

Une fiche peut être rédigée sans clé d'API, par un agent Claude Code dans sa session
ou par une personne, dans un brouillon : `data/sources/fiches-brouillons/<c>.json`,
versionné, un fichier par caractère, nommé d'après lui.

```json
{
 "c": "天",
 "sens_fr": "ciel, jour",
 "sens_en": "sky, day",
 "origine_fr": "Trois phrases. Pas une de plus. Pas une de moins.",
 "origine_en": "Three sentences. No more. No fewer.",
 "etiquette": "attesté",
 "memo_fr": null,
 "memo_en": null,
 "roles": {"天": "sens"},
 "mots": [
  {"hanzi": "天天", "pinyin": "tiāntiān", "fr": "tous les jours", "en": "every day"},
  {"hanzi": "明天", "pinyin": "míngtiān", "fr": "demain", "en": "tomorrow"}
 ],
 "phrase": {"zh": "她天天见朋友。", "pinyin": "Tā tiāntiān jiàn péngyou.",
            "fr": "Elle voit ses amis tous les jours.", "en": "She sees her friends every day."}
}
```

- Obligatoires : `c`, `origine_fr`, `origine_en`, `etiquette`, `roles`, et, pour un
  caractère qu'un chemin pose, `mots` et `phrase`, qui vont ensemble (tous deux ou aucun ;
  voir « Fiche d'origine » ci-dessous). Facultatifs : `memo_fr`, `memo_en` (texte ou `null`), `sens_fr`,
  `sens_en` (texte ; vides s'ils manquent, mais exigés avant la relecture, voir
  « Le sens »). Toute autre clé est refusée : une faute de frappe ne passe pas en
  silence.
- `etiquette` s'écrit `attesté` ou `mnémotechnique` (avec ou sans accents) ; la fiche
  garde le code `atteste` ou `mnemotechnique`.
- `roles` est un objet `{composant: "son" | "sens" | "forme"}`, un rôle par composant
  (`son` seulement sur la syllabe du caractère, voir « Le rôle son »)
  de la décomposition canonique.
- `mots` : au plus deux objets `{hanzi, pinyin, fr, en}`, pris dans les mots
  candidats ; moins, voire aucun, quand les candidats sont rares ou douteux ;
  `phrase` : un objet `{zh, pinyin, fr, en}`. Les traductions sont rédigées, jamais
  reprises d'un dictionnaire.
- Pinyin des mots et de la phrase : les tons du dictionnaire, sans sandhi (`yī`,
  `bù`, même devant un quatrième ton) ; un mot d'un seul tenant (`bùhǎo`, `nǚ'ér`) ; le
  ton neutre d'un mot comme CC-CEDICT (`dōngxi`, `péngyou`, `duōshao`, `rènshi`), sauf
  les mots de position, qui suivent la règle des contes ci-dessous (`hòumian`, `zhèli`,
  `pángbiān`, `nàbiān`, `pinyin.MOTS_DE_POSITION`). `tests/test_pinyin.py` relit
  chaque brouillon contre les lectures du caractère (`pinyin.py`) et le pinyin CC-CEDICT
  du mot.
- Le reste de la fiche (`parcours`, `jour`, `pinyin`, `composants`, `structure`) ne
  s'écrit pas : l'import le prend dans le contexte du caractère.

Trois commandes pour rédiger :

- `uv run wenlu fiches a-rediger [--seuil 255] [--lot N --sur M]` liste, dans
  l'ordre du parcours, les caractères du seuil sans fiche conforme (fiche absente,
  rejetée aux contrôles ou à la relecture, ou qui ne passe plus `valider()`). Les
  lots découpent le seuil entier en M parts contiguës, puis retirent ce qui est fait :
  un caractère garde son lot quand les autres avancent.
- `uv run wenlu fiches contexte 人 大 天` affiche, par caractère, ce que l'invite des
  fiches générées donne au modèle : pinyin, décomposition GF 0014-2009 et composants
  nommés, rôle probable, jour du parcours, **caractères acquis ce jour-là** (seuls
  autorisés dans les mots et la phrase), mots candidats déjà filtrés sur l'acquis
  (le mot et son pinyin, sans définition : `docs/sources-licences.md` §4.2), les
  contraintes de `valider()` et un squelette de brouillon.
- `uv run wenlu fiches importer [--parcours lire] [人 大 …]` lit les brouillons (tous,
  ou ceux nommés), calcule le contexte par `Corpus.contexte(c)`, construit la
  `Fiche`, lance `valider()` et l'écrit dans `data/sources/fiches/<c>.json` au statut
  `a_relire` si elle est conforme, `rejete` sinon. Les refus, les intrus et les écarts
  s'affichent par caractère ; on corrige le brouillon et on relance. Un brouillon
  illisible (JSON, champ manquant ou inconnu, `c` qui ne nomme pas son fichier)
  n'écrit rien. Code de sortie 1 dès qu'un brouillon est rejeté ou illisible.

Traçabilité, dans `generation` : `api` vaut `session Claude Code (sans API)`,
`modele` vaut `rédaction manuelle`, `empreinte_invite` est le `sha256` des octets du
brouillon (`sha256sum` la retrouve), `date` le jour de l'import (`AAAA-MM-JJ`),
`essais` le nombre de versions du brouillon importées, `refus` les motifs de rejet.
Réimporter un brouillon inchangé ne réécrit rien — une fiche relue le reste ; un
brouillon modifié remet la fiche au statut `a_relire`. Un brouillon inchangé dont le
contexte a bougé (le parcours l'a déplacé, une surcharge a corrigé son pinyin ou sa
décomposition) met à jour `parcours`, `jour`, `pinyin`, `composants` et `structure`,
sans toucher au texte ni à `generation` ; l'import le dit (« contexte mis à jour »).
Le jour seul ne défait pas une relecture ; un pinyin ou une décomposition changés
remettent une fiche relue à `a_relire`.

### Fiche d'origine : un caractère du dictionnaire hors chemin (story 10.11)

Le dictionnaire montre l'origine relue de chacun des 3 000 caractères du HSK, qu'un chemin
le pose ou non. Un caractère qu'aucun chemin ne pose encore n'a pas de jour, donc ni acquis
ni mots candidats : sa fiche est une **fiche d'origine**, dans le même circuit, au même
format, avec la même traçabilité et le même `valider()`.

- Le brouillon, `data/sources/fiches-brouillons/<c>.json`, n'a ni `mots` ni `phrase` :
  `c`, `sens_fr`, `sens_en`, `origine_fr`, `origine_en`, `etiquette`, `memo_fr`,
  `memo_en`, `roles`.
- La fiche écrite garde toutes les clés d'une fiche : `"parcours": ""`, `"jour": 0`,
  `"mots": []`, une `phrase` aux quatre champs vides. Elle ne dépend d'aucun jour.
- `valider()` : les mêmes refus pour l'origine (trois phrases FR et EN), l'étiquette et le
  sens, les mêmes écarts pour les rôles. Hors chemin, des mots ou une phrase sont refusés
  (aucun jour ne dit ce qui est lisible). Sur un chemin, une fiche d'origine n'est pas
  refusée : « fiche d'origine : mots et phrase à écrire pour le jour N du parcours P » est
  un écart, et `a-rediger` redemande le caractère.
- Le jour où un chemin pose le caractère, réimporter le brouillon inchangé met à jour
  `parcours` et `jour` sans défaire la relecture ; le rédacteur y ajoute ensuite les mots et
  la phrase, contre l'acquis de ce jour-là (`wenlu fiches contexte`), et la fiche repart à
  relire.
- Les commandes trouvent seules le contexte (`--parcours auto`, le défaut) : le parcours de
  la fiche déjà écrite s'il pose le caractère, sinon `lire`, sinon `hsk`, sinon hors chemin
  si le caractère est dans une liste `hsk-*.txt` (`fiches.Corpora`). `--parcours lire` ou
  `hsk` en impose un.
- Export : une fiche relue, de chemin ou d'origine, donne l'`origine` de l'entrée du
  dictionnaire (ci-dessous) ; dans une famille, une fiche d'origine s'exporte avec
  `mots: []` et `phrase: null`.

Rédiger par niveau HSK, un fichier par caractère, plusieurs rédacteurs en parallèle :

- `uv run wenlu fiches a-rediger --niveau 3 --lot 2 --sur 8` liste les caractères du lot 2
  sur 8 de `hsk-3.txt` (`1` à `6`, `7-9`) sans fiche conforme. Les lots suivent l'ordre de
  la liste, jamais celui des chemins : ils ne bougent pas quand un chemin s'allonge, et deux
  copies du dépôt tombent sur les mêmes lots ;
- `uv run wenlu fiches contexte 敢 派` donne, pour chaque caractère, sa décomposition, le
  type d'étymologie et l'indice de Make Me a Hanzi, la glose relue du dictionnaire, et le
  squelette du brouillon (sans mots ni phrase hors chemin ; avec l'acquis et les mots
  candidats sur un chemin) ;
- `uv run wenlu fiches importer --niveau 3 --lot 2 --sur 8` n'importe que les brouillons
  présents de ce lot : chaque rédacteur n'écrit et n'importe que ses fichiers.

### Relecture

La relecture reste humaine (brief §17). `uv run wenlu fiches relire --c 住 --statut relu`
marque une fiche ; pour une page de relecture :

- `uv run wenlu fiches exporter-relecture [--sortie …]` écrit `data/work/relecture.json`,
  hors dépôt : `{date, source, decisions, retour, fiches}`, où `fiches` porte chaque
  fiche `a_relire` (format ci-dessus) triée par jour, avec ses `ecarts` ;
- `uv run wenlu fiches appliquer-relecture <fichier>` lit
  `{"人": "relu", "大": "rejete", "天": null}` et applique `relire` à chaque fiche.
  `null` laisse une fiche en attente. Tout ou rien : une décision inconnue, une fiche
  absente, une fiche rejetée aux contrôles ou une fiche sans sens marquée `relu`, et
  rien n'est appliqué.

### Ce que l'app lira (export, story 1.6)

L'export d'une famille reprend d'une fiche **relue** `sens_fr` et `sens_en` (écrits
`fr` et `en`), `origine_fr`, `origine_en`, `etiquette`, `memo_fr`, `memo_en`, `mots`,
`phrase` et `roles`, et remplit le reste de
`Fiche` (`models.py`) depuis le build : `parts` et `sources` de
`decompositions.json`, `nouveau` du parcours, `pinyin` d'Unihan, `niveaux` des listes,
`audio` de la story 1.5. `generation` n'est pas exporté : il reste côté pipeline. Le
`statut` exporté ne dit plus que deux choses : `relu`, ou `sans_fiche` quand aucune
fiche relue ne porte ce caractère — il s'exporte alors pour sa décomposition et ses
traits, textes vides. Les tracés, eux, ne sont jamais dans le fichier d'une famille :
ils sont sous Arphic Public License, dans `traits/` (voir « Schéma d'export »).

## Audio pré-généré (story 1.5)

Un fichier par caractère et par mot, synthétisé une fois dans le pipeline puis embarqué
avec l'app (brief §11 : « voix neuronale pré-générée et embarquée pour tous les
caractères et mots. Aucune dépendance à la voix du téléphone »). L'app ne synthétise
jamais ; elle lit un fichier servi avec elle, et se tait sur ce qui n'en a pas.

Format : MP3 mono 24 kHz à 48 kbit/s, soit environ 6 Ko par seconde de parole — moins de
15 Ko pour un caractère comme pour un mot de deux caractères. Opus descendrait de moitié,
mais la lecture d'un Ogg Opus par un `HTMLAudioElement` n'est acquise sur iOS que depuis
Safari 17.5, et c'est l'iPhone qui est visé en premier.

Le fournisseur local rend des échantillons, pas un fichier : c'est `EncodeurFfmpeg` qui
les met au format ci-dessus (`ffmpeg -f s16le -ar 24000 -ac 1 … -b:a 48k -f mp3`), en
mémoire, sans fichier intermédiaire. ffmpeg n'est pas une dépendance Python : il est
utilisé s'il est sur le chemin. Sans lui, le repli documenté est un WAV PCM 16 bits mono
24 kHz écrit par le module `wave` de la bibliothèque standard — lisible partout, mais
environ dix fois plus lourd, donc bon pour écouter un lot, pas pour l'embarqué. Le format
entre dans le nom de fichier et dans le manifeste : repasser une fois ffmpeg installé
refait les fichiers en MP3 sans écraser les WAV, et la commande prévient du repli.

### Périmètre

`perimetre()` prend les fiches **relues** du parcours (leur caractère et leurs deux mots)
et, à défaut, la liste cible (`seuil-255` pour `lire`, `hsk-1` pour `hsk`) plus, quand
`wenlu build` a tourné, au plus deux mots candidats par caractère, tous caractères de la
liste. Une fiche non relue n'entre pas : son texte peut encore changer.

### Fichiers et manifeste, hors dépôt

`uv run wenlu audio generer [--fournisseur local|azure] [--parcours lire] [--seuil 255]
[--voix …]` écrit `data/work/audio/<empreinte>.mp3` et le manifeste
`data/work/audio/audio.json` :

```json
{
 "version": 1,
 "genere": "2026-09-21T10:00:00Z",
 "format": "mp3",
 "debit": "mono 24 kHz, 48 kbit/s",
 "entrees": [
  {
   "texte": "住", "genre": "caractere", "fichier": "2f6a1c0b9d4e8a37.mp3",
   "fournisseur": "kokoro", "voix": "zf_001", "format": "mp3",
   "date": "2026-09-21T10:00:00Z", "empreinte": "sha256:…", "octets": 7412
  }
 ]
}
```

Le nom de fichier est l'empreinte SHA-256 de `fournisseur\nvoix\nformat\ntexte`, tronquée
à 16 hexadécimaux : deux passages donnent le même nom, et un changement de voix donne un
fichier neuf sans écraser l'ancien. La commande est idempotente — un texte déjà synthétisé
avec le même fournisseur, la même voix et le même format, dont le fichier est toujours là,
n'est pas redemandé. `genre` vaut `caractere` ou `mot`.

Le fournisseur est une interface (`audio.Fournisseur` : `synthetiser(texte, voix) -> bytes`,
plus `nom`, `voix`, `format` et une `Licence`). Trois implémentations, dont deux seulement
sont accessibles depuis la ligne de commande (`--fournisseur local|azure`) :

| `--fournisseur` | Implémentation | Ce qu'il faut | Licence |
|---|---|---|---|
| `local` (défaut) | `FournisseurLocal` — Kokoro, 82 M paramètres, exécuté dans le pipeline | le groupe optionnel `audio` (`uv sync --extra audio`) | Apache 2.0, **vérifiée** le 21 septembre 2026 |
| `azure` | `FournisseurAzure` — REST, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | une clé | **à vérifier**, conditions non lues |
| — | `FournisseurSimule` — octets déterministes, pour les tests | rien | sans objet |

`FournisseurSimule` n'est pas atteignable depuis la CLI, et ne le sera pas : ce qui sort du
pipeline est une voix réelle ou rien. Un nom hors de `local`/`azure` sort en code 1.

Le fournisseur local charge paresseusement : `import kokoro` est à l'intérieur de
`MoteurKokoro.pipeline()`, appelé au premier texte. Le pipeline reste donc utilisable — et
`wenlu check` reste instantané — sans le groupe optionnel installé, qui tire torch et
transformers. Sans le paquet, `generer` sort en code 2 avec la commande à lancer, et
n'écrit rien. Le moteur est injectable (`FournisseurLocal(moteur=…)`), ce dont les tests se
servent : ils contrôlent format, manifeste et licence sans poids ni réseau. La voix par
défaut est `zf_001` (Kokoro v1.1-zh, `hexgrad/Kokoro-82M-v1.1-zh`), `--voix` la change.
`uv run wenlu audio voix` liste les voix du dépôt de poids (ses fichiers `voices/*.pt`, lus
sur le hub, ou dans le cache local hors ligne) ; `generer` refuse en code 1, sans rien
écrire, une voix qui n'y est pas, et cite les voix disponibles.

Sans clé, `--fournisseur azure` refuse de partir, sort en code 2 et n'écrit rien. La
`Licence` porte ce que le fournisseur déclare sur l'usage commercial, la redistribution,
l'attribution et la redevance par écoute, avec l'URL lue et la date ; `verifie` ne passe à
vrai que sur lecture d'une source primaire. C'est le cas pour la voix locale et pas pour
Azure, dont la commande rappelle le doute à chaque passage (voir `docs/sources-licences.md`).

`uv run wenlu check` ajoute le contrôle « audio : textes sans audio » : il compte les
textes du périmètre qui n'ont pas de fichier. Signalé, jamais bloquant — l'audio arrive
après le texte, et l'app se tait sur ce qui n'a pas de voix.

### Ce que l'app lira (export)

`uv run wenlu audio exporter [--version 0.1.0] [--fournisseur local|azure]
[--parcours lire] [--seuil 255]` copie les fichiers du périmètre dans
`app/public/data/<version>/audio/` et écrit à côté `manifeste.json` :

```json
{
 "version": "0.1.0",
 "license": "audio synthétisé — droits du fournisseur (Kokoro (hexgrad), modèle ouvert exécuté dans le pipeline)",
 "source": "Kokoro (hexgrad), modèle ouvert exécuté dans le pipeline, voix zf_001",
 "source_url": "https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE",
 "modified": "2026-09-21",
 "fournisseur": "Kokoro (hexgrad), modèle ouvert exécuté dans le pipeline",
 "format": "mp3",
 "debit": "mono 24 kHz, 48 kbit/s",
 "licence": {"usage_commercial": "autorisé sans condition : Apache License 2.0 §2…", "verifie": true, "…": "…"},
 "chemins": {"住": "data/0.1.0/audio/2f6a1c0b9d4e8a37.mp3"}
}
```

`--fournisseur` ne choisit ici que la licence jointe à l'export ; les fichiers copiés sont
ceux que le manifeste de travail porte.

`chemins` est le contrat : un chemin relatif à `app/public/`, tel quel, que
`app/src/lib/audio.ts` préfixe de `import.meta.env.BASE_URL` pour jouer le fichier.
Seul le périmètre est copié : l'app n'embarque pas les essais.

Contrat pour l'export des fiches (story 1.6) : il lit ce manifeste —
`audio.chemins_exportes(version)` rend le dictionnaire — et remplit `Fiche.audio` avec
`chemins[c]` et `Mot.audio` avec `chemins[mot.hanzi]`. Un texte absent du manifeste vaut
`null` : le bouton « Écouter » reste visible et inactif, et le toucher du caractère ne dit
rien.

## Contes par niveau (story 1.7)

Un même récit traditionnel est réécrit à plusieurs niveaux avec les seuls caractères du
niveau. L'utilisateur relit la même histoire, plus riche, quand son acquis grandit
(épic 2c). Un niveau est un seuil sinographique, nombre (`255`, le seul versionné, celui
des trois contes gratuits), ou un niveau du HSK 3.0 (GF 0025-2021), chaîne : `hsk1` à
`hsk6`, puis `hsk7-9`, que la norme ne départage pas. Un niveau HSK se lit **en cumul** :
`hsk3` autorise les 900 caractères de `hsk-1.txt`, `hsk-2.txt` et `hsk-3.txt`
(`data/sources/listes/`, chacun ne portant que les caractères nouveaux de son niveau).
Les niveaux se rangent par leur nombre de caractères, cumul compris (`contes.rang`) :
255 < `hsk1` (300) < `hsk2` (600) < … < `hsk6` (1 800) < `hsk7-9` (3 000). Les seuils 405
à 1555 restent connus du code, sans liste versionnée : les contes suivent le HSK
(décision du propriétaire).

Un niveau peut aussi être un **jour du chemin**, chaîne : `jour25` (de `jour1` à
`jour254`), l'acquis des jours 1 à 25 du parcours Lire, soit les caractères dont la fiche
(`data/sources/fiches/*.json`, voisines des listes) porte un `jour` de 1 à 25
(`contes.jours_du_chemin`). Décision du propriétaire du 26 septembre 2026 : le premier
conte ne s'ouvrait qu'au jour 166 du chemin ; deux ou trois fables très courtes s'ouvrent
entre les jours 30 et 60, et l'une avant le jour 28 (l'offre gratuite peut s'arrêter au
jour 30). Cumulatif comme un niveau HSK, un jour du chemin se range sous le seuil 255,
que le parcours Lire mène à son terme, et entre eux par leur jour (`contes.rang` :
`jour25` vaut 25, ce n'est pas un nombre de caractères). Son `N` est le jour où entre le
dernier caractère du texte, titre compris, mots expliqués mis à part (`jour_d_ouverture`) :
la fable s'ouvre ce jour-là sur le parcours Lire. Sur le parcours HSK, qui range les
caractères autrement, elle s'ouvre comme toute version, quand ses caractères sont acquis ;
son jour s'y calcule sur ce chemin-là, ou pas du tout quand l'un de ses caractères n'y est
pas (古, 念, 只, 每 et 如 ne sont pas sur le parcours HSK : ses trois fables y restent
« Plus loin »). Aucun texte de conte n'entre dans le dépôt sans passer par
le pipeline : il sort de la génération par l'API ou de l'import d'un brouillon rédigé
sans API, avec les mêmes contrôles, puis d'une relecture humaine.

### Catalogue, versionné

`data/sources/contes/catalogue.tsv` : `#` en commentaire, onze colonnes séparées par une
tabulation — `id`, `titre_zh`, `titre_pinyin`, `titre_fr`, `titre_en`, `ouvrage`,
`niveaux`, `cles`, `chapitres`, `motif`, `resume_fr`. Treize récits tirés d'ouvrages classiques du domaine
public : onze fables et deux récits longs. `titre_zh` et `titre_pinyin` sont le vrai
titre du récit (une syllabe par caractère), `titre_fr` et `titre_en` ses noms dans
l'app, `ouvrage` trace l'origine du récit, `resume_fr` résume l'intrigue en une phrase.
Aucun texte de ces ouvrages n'est recopié, et aucune version chinoise n'est écrite dans
le catalogue.

- `niveaux` : les niveaux où le récit sera écrit, croissants, séparés par des virgules :
  deux pour un récit simple (`255,hsk3`, `hsk4,hsk6`), trois pour un récit riche
  (`hsk4,hsk6,hsk7-9`), un de plus quand l'animal est expliqué (`hsk3,hsk5,hsk7-9` pour
  守株待兔, simple). Les contes suivent le HSK ; les trois contes relus gardent 255 pour
  premier niveau. Une fable du chemin n'a qu'un niveau, son jour (`jour25`), jamais mêlé
  au plan HSK : une première lecture, de 30 à 60 sinogrammes (`LONGUEUR_CHEMIN`). Le critère est écrit en tête du catalogue : sur l'échelle 255 (au
  palier de HSK 1), `hsk1` … `hsk6`, `hsk7-9`, le plan de base commence au premier niveau
  HSK dont le cumul a tous les caractères clés du récit (255 pour les trois contes
  relus) ; les suivants montent de deux paliers en deux, ramenés à `hsk7-9` au haut de
  l'échelle, où les paliers restants comblent (`contes.niveaux_attendus` : `hsk5` riche
  donne `hsk5, hsk6, hsk7-9`) ; un récit qui commence à `hsk7-9` n'a que ce niveau.
  Un niveau de plus quand l'animal est expliqué (décision du propriétaire du 26 septembre
  2026 : l'animal par son vrai caractère dès les petits niveaux) : une fable dont l'animal
  place haut le plan de base prend, en dessous, un niveau où elle nomme l'animal en mot
  expliqué, trois caractères hors du niveau au plus en tout ; c'est le plus bas où le récit
  reste naturel, un choix de rédaction, et le plan de base commence alors au premier
  palier qui a les caractères clés et l'animal (井底之蛙 : `hsk3,hsk7-9`, 蛙 龟 井 expliqués
  à `hsk3`). Un niveau prévu dont la liste n'est pas versionnée (405 à 1555) attend sa
  liste ; rien n'en est écrit, et rien ne la reconstitue.
- `cles` : les caractères clés du récit, accolés (`马腿断兵`) : ses animaux et les objets
  de son intrigue, sans lesquels il perd son sujet ; le reste, noms propres compris, se
  dit autrement. L'en-tête du catalogue les relève conte par conte, avec leur niveau HSK.
  Après une barre oblique, les mots que le récit peut nommer hors de son niveau et
  explique, personnages, objets ou animal (`羊补/圈狼`, `龙/叶`, `菜长/苗`, `/虎狐狸`) : ce
  sont des mots expliqués, pas des caractères clés du niveau ; l'animal qui y passe donne
  au récit son niveau de plus (ci-dessus), et rien ne reste avant la barre quand tout
  s'explique (`/兔桩`). Un mot expliqué ne passe que si ses caractères hors du niveau sont
  déclarés ici, avant ou après la barre (`Conte.declares`).
- `chapitres` : 1 pour une fable, lue d'une traite ; plus pour un récit long, lu
  chapitre par chapitre. Les chapitres d'un récit long sont décrits dans
  `data/sources/contes/chapitres.tsv` (`conte`, `n`, `titre_fr`, `titre_en`,
  `resume_fr`), de 1 au nombre prévu, sans trou : leurs titres français et anglais, que
  le sommaire du lecteur montre, et le résumé qui cadre la réécriture. Une fable n'y a
  aucune ligne.
- `motif` : le petit dessin de la couverture du conte dans Lire, où chaque conte est un
  livre cousu sur une étagère (décision du propriétaire du 26 septembre 2026). Un nom du
  jeu fermé `contes.MOTIFS` (`montagne`, `pousse`, `roues`, `puits`, `souche`, `serpent`,
  `tigre`, `cheval`, `elephant`, `rouleau`, `enclos`, `lance`, `singe`, `goban`, `arc`,
  `hache`), que l'app sait
  dessiner ; exporté dans `catalogue` depuis le format 12. Le contrôle bloquant
  « contes : motifs » de `wenlu check` refuse tout autre nom.

Un catalogue illisible (en-tête, colonne vide, doublon, niveaux mal dits, `cles` qui ne sont pas des sinogrammes, chapitres qui
ne correspondent pas) arrête le chargement ; `wenlu check` le dit par le contrôle
bloquant « contes : catalogue ». `uv run wenlu contes plan` montre, conte par conte,
l'état de chaque niveau prévu : écrit (et son statut), à écrire (liste présente), ou en
attente de sa liste.

### Version écrite, versionnée

`uv run wenlu contes generer --niveau <n> [--conte <id>]` (`--seuil` en est l'alias ;
`255`, `hsk3`…) puis `uv run wenlu contes recuperer` écrivent
`data/sources/contes-versions/<niveau>/<id>.json` (`255/`, `hsk3/`), versionné : le
texte d'un conte est un contenu, sa relecture se lit dans l'historique git.
`uv run wenlu contes importer` y écrit aussi, depuis un brouillon rédigé sans API (voir
« Brouillons de contes ») :

```json
{
 "conte": "nan-yuan-bei-zhe",
 "seuil": 255,
 "titre": "要去南方的人",
 "titre_pinyin": "yào qù nán fāng de rén",
 "titre_fr": "Rouler vers le nord pour aller au sud",
 "titre_en": "Heading North to Go South",
 "source": {"ouvrage": "《战国策·魏策四》", "resume_fr": "…"},
 "phrases": [
  {"zh": "有人问他：「你去哪里？」", "pinyin": "yǒu rén wèn tā nǐ qù nǎ lǐ",
   "fr": "Quelqu'un lui demanda : « Où vas-tu ? »", "en": "Someone asked him, \"Where are you going?\""}
 ],
 "glose": {
  "有人": {"pinyin": "yǒu rén", "fr": "quelqu'un", "en": "someone"},
  "哪里": {"pinyin": "nǎ lǐ", "fr": "où", "en": "where"}
 },
 "generation": {
  "modele": "rédaction manuelle",
  "api": "session Claude Code (sans API)",
  "date": "2026-09-24",
  "empreinte_invite": "sha256:…",
  "essais": 1,
  "intrus": []
 },
 "statut": "a_relire"
}
```

- `seuil` : le niveau de la version, `255` (nombre) ou `"hsk3"` (chaîne) ; le nom du
  champ est historique, et les versions du seuil 255 se relisent octet pour octet.
- `titre` et `phrases[].zh` : le chinois, phrase par phrase — l'unité d'affichage,
  d'audio et de traduction.
- Un récit long remplace `phrases` par `chapitres` : `[{titre, titre_pinyin, titre_fr,
  titre_en, phrases}]`, un objet par chapitre, dans l'ordre. `titre` est le titre chinois
  du chapitre, écrit avec les caractères du seuil, `titre_pinyin` son pinyin (même
  règle), `titre_fr` et `titre_en` viennent de `chapitres.tsv`, `phrases` a le format
  ci-dessus. Une fable est une version d'un seul chapitre sans titre : elle garde
  `phrases`, si bien qu'une version écrite avant les chapitres se relit et se réécrit
  octet pour octet. `titre_fr` et `titre_en` viennent du catalogue : ce sont
  les noms du récit, pas la traduction du titre chinois de la version.
- `titre_pinyin` et `phrases[].pinyin` : **une syllabe par sinogramme**, dans l'ordre,
  séparées par une espace, en minuscules, tons marqués, sans ponctuation. Tons du
  dictionnaire, sans sandhi (一 reste `yī`, 不 reste `bù`) ; ton neutre sans marque,
  comme CC-CEDICT le note (儿子 `ér zi`, 一个 `yī ge`). 一 entre un verbe et sa répétition
  (V一V) est au ton neutre, `yi`, comme le note le 现代汉语词典 (décision du propriétaire
  du 26 septembre 2026, « la lecture correcte ou la plus utilisée ») : 看一看 `kàn yi kàn`,
  摸一摸 `mō yi mō`, 补一补 `bǔ yi bǔ` ; ailleurs 一 garde `yī`, redoublé compris (一个一个
  `yī ge yī ge`). 上 après un nom suit la même règle que le ton neutre :
  le ton de CC-CEDICT pour un mot du dictionnaire (地上 `dì shang`, 身上 `shēn shang`, 路上
  `lù shang`, mais 马上 `mǎ shàng`, 天上 `tiān shàng`), le ton plein ailleurs
  (山上 `shān shàng`, 树桩上 `shù zhuāng shàng`). Les compléments gardent le ton plein,
  comme dans les contes relus au seuil 255 (回来 `huí lái`, 起来 `qǐ lái`, 说不出
  `shuō bù chū`), et 过 après un verbe aussi (见过 `jiàn guò`). Les mots de position
  prennent le ton neutre sur leur seconde syllabe, comme le note le 现代汉语词典 (décision
  du propriétaire du 26 septembre 2026, « Je te laisse décider » ; retenue : la lecture de
  l'oral courant) : 后面 `hòu mian`, 前面 `qián mian`, 里面 `lǐ mian`, 外面 `wài mian`,
  上面 `shàng mian`, 下面 `xià mian`, 后边 `hòu bian`, 前边 `qián bian`, 里边 `lǐ bian`,
  外边 `wài bian`, 上边 `shàng bian`, 下边 `xià bian`, 这里 `zhè li`, 那里 `nà li`,
  哪里 `nǎ li`, et de même les mots d'orientation (décision du même jour) : 东边
  `dōng bian`, 南边 `nán bian`, 西边 `xī bian`, 北边 `běi bian`, 左边 `zuǒ bian`, 右边
  `yòu bian` ; dans 这里面, 那里面, le mot est 里面 (`nà lǐ mian`). 旁边 `páng biān`,
  那边 `nà biān`, 这边 `zhè biān` gardent le ton plein ; la décision ne touche aucun
  autre mot (外头 `wài tou`, 下面条 « mettre les nouilles » `xià miàn tiáo`). La liste
  est `pinyin.MOTS_DE_POSITION` ; elle vaut aussi pour les lettres, les fiches, WeChat et
  l'éclair (d'un seul tenant : `hòumian`, `nǎli`). La k-ième syllabe est celle
  du k-ième sinogramme : le lecteur les aligne sans autre calcul.
- `phrases[].fr` et `phrases[].en` : traductions rédigées pour un lecteur de chaque
  langue.
- `glose` : un objet `{entrée: {pinyin, fr, en}}` où l'entrée est un caractère ou un
  mot du texte. Le lecteur découpe le titre et chaque phrase comme `contes.segmenter()`
  : à chaque position, l'entrée la plus longue qui commence là ; la ponctuation est
  sautée. Le sens est court (un à trois mots), dans le sens qu'a l'entrée ici, rédigé
  pour l'app — jamais une définition traduite d'une source anglaise
  (`docs/sources-licences.md` §4.2). Une version écrite avant ce format, dont la glose
  ne portait que le français (`{"山": "montagne"}`), se relit avec `pinyin` et `en`
  vides.
- `expliques` (facultatif, absent le plus souvent) : les mots expliqués, décision du
  propriétaire du 25 septembre 2026 (« Quand c'est un personnage clé comme loup, tu peux
  expliquer le mot aussi »). Un mot hors du niveau qui nomme un personnage ou un objet
  clé du récit, plutôt qu'un détour qui le trahit : `[{zh, pinyin, fr, en,
  explication_fr, explication_en}]`, par exemple `{"zh": "狼", "pinyin": "láng", "fr":
  "loup", "en": "wolf", "explication_fr": "Le loup vient la nuit…", "explication_en":
  "The wolf comes at night…"}`. `zh` est un caractère ou un mot du texte (叶公), glosé
  comme les autres ; `pinyin` une syllabe par caractère ; l'explication, une phrase ou
  deux sur ce qu'est ce personnage ou cet objet dans le récit. Une version sans mot
  expliqué n'a pas la clé, et se relit et se réécrit octet pour octet.
- `source.ouvrage` vaut `""` quand le rédacteur ne cite pas l'ouvrage.
- `generation` est la traçabilité : d'où vient la version et comment. Pour une version
  générée, `modele` est le modèle Claude, `api` vaut `messages` ou `messages.batches`,
  `empreinte_invite` est celle de l'invite, `date` est horodatée. Pour un brouillon
  importé, voir plus bas.
- `statut` vaut `a_relire` à la sortie du pipeline, `rejete` s'il reste des caractères
  hors liste (après trois essais pour une version générée), `relu` une fois la
  relecture humaine faite. Seules les versions relues sont exportables.

Validation (`contes.valider()`, la même pour les deux chemins). **Rejet** : un caractère
du titre ou du texte hors de la liste du niveau (`data/sources/listes/seuil-<n>.txt` pour
un seuil ; pour un niveau HSK, le cumul de `hsk-1.txt` à `hsk-<n>.txt` ; pour un jour du
chemin, l'acquis des jours 1 à N lu dans les fiches), ponctuation
`。，、；：？！「」『』（）《》—…·` exceptée ; les intrus sont listés exactement.
Un titre de chapitre est contrôlé comme le titre. Seule exception, les caractères hors du
niveau des mots expliqués (`contes.expliques_admis`), s'ils sont déclarés au catalogue
(`cles`, avant ou après la barre oblique) et s'ils ne sont pas trop nombreux : trois au
plus pour une fable ; pour un récit long, trois nouveaux au plus par chapitre, un mot
expliqué le restant dans les chapitres suivants (`contes.nouveaux_par_chapitre`, le titre
de la version comptant au premier). Un caractère non déclaré, ou un de trop, et la
version est **rejetée** (refus nommé, et le caractère reste un intrus) ; un caractère du
catalogue que la version n'explique pas reste un intrus.
**Écarts**, signalés à la relecture sans rejeter : longueur hors cible (`LONGUEURS` :
255 et `hsk1` 60 à 120 sinogrammes, `hsk2` 150 à 260, `hsk3` 220 à 380, `hsk4` 270 à
470, `hsk5` à `hsk7-9` 320 à 560, un jour du chemin 30 à 60, phrases seules ; pour un
récit long, à chaque
chapitre), chapitre sans phrase, sans titre chinois, ou sans titre français ou anglais
au catalogue, niveau que
le catalogue ne prévoit pas pour le récit, nombre de chapitres autre que celui prévu,
phrase vide, traduction anglaise absente, pinyin qui ne
compte pas une syllabe par sinogramme ou hors forme, ton de 一 ou 不 modifié (sandhi),
一 d'un verbe redoublé qui n'est pas au ton neutre (`contes.redoublements_en_yi` : 看一看,
pas 一个一个), mot de position à un autre ton que celui de `pinyin.MOTS_DE_POSITION`
(aussi contrôlé, bloquant, par « contes : mots de position » de `wenlu check`),
sinogramme qu'aucune entrée de glose ne couvre dans le découpage du lecteur, entrée de
glose absente du texte, pinyin d'une entrée différent de celui de la phrase où on la
touche, entrée sans pinyin, sans `fr` ou sans `en` ; mot expliqué absent du texte, déjà
dans le niveau, en double, au pinyin sans une syllabe par caractère ou autre que celui de
la glose, ou sans `fr`, `en`, `explication_fr` ou `explication_en`.

Le journal des lots d'API, lui, reste hors dépôt, dans `data/work/contes/lots/<lot>.json`
: c'est l'état d'un passage, pas un contenu. Il porte l'identifiant du lot, le niveau, le
modèle, la date de soumission, le statut, et une entrée par requête (`custom_id`, conte,
numéro d'essai, empreinte de l'invite).

`uv run wenlu check` relit les versions : le contrôle « contes : caractères hors liste »
est bloquant, le contrôle « contes : relecture » compte ce qui reste à relire, le
contrôle « contes : catalogue » (bloquant) relit le catalogue et ses chapitres, et le
contrôle « contes : niveaux prévus » compte, pour chaque niveau prévu, s'il est écrit, à
écrire (liste présente, aucune version) ou en attente de sa liste, et relève les
versions qui s'écartent du catalogue (niveau non prévu, nombre de chapitres, conte hors
catalogue). Il est en écart tant qu'un niveau reste à écrire, et **jamais bloquant** :
un niveau prévu non écrit ne retient ni l'export ni l'app. Le contrôle « contes :
critère des niveaux », jamais bloquant lui non plus, relit le critère sur les vraies
listes : chaque caractère clé (avant la barre) est dans chaque niveau prévu, le niveau
HSK juste au-dessous du plus bas ne les a pas tous, et les niveaux montent de deux paliers
en deux (`contes.ecarts_au_critere`). Les mots d'après la barre y comptent comme mots
expliqués : quand le plus bas niveau en explique que le niveau suivant a déjà (l'animal),
le plan se lit comme ce niveau ajouté puis un plan de base qui commence au suivant, ces
mots comptés alors parmi les caractères clés, et le niveau ajouté d'une fable en explique
trois caractères au plus. Le contrôle « contes : mots expliqués », jamais
bloquant, relève les versions qui nomment un personnage ou un objet clé hors de leur
niveau, et signale un caractère de mot expliqué dont l'export n'a pas les traits (le
lecteur l'écrit alors en police) ; un mot non déclaré ou de trop tombe, lui, dans
« caractères hors liste ».

Pour une fable du chemin, « contes : critère des niveaux » lit un autre critère
(`contes.ecarts_du_chemin`, `ecarts_de_jour`) : un seul niveau, un jour du chemin ; ses
caractères clés (avant la barre) dans l'acquis de ce jour ; trois caractères au plus à
expliquer ; et chaque version s'ouvre au jour de son niveau, ni plus tôt ni plus tard.

`uv run wenlu contes generer` ne soumet, à un niveau, que les fables qui le prévoient
(`contes_du_seuil`) ; un récit long ne part pas à l'API : il se rédige par brouillon,
chapitre par chapitre.
`uv run wenlu contes valider` refait toute la validation à la demande, écarts compris.

### Brouillons de contes, versionnés (rédaction sans API)

Une version peut être rédigée sans clé d'API, par un agent Claude Code dans sa session
ou par une personne, dans un brouillon : `data/sources/contes-brouillons/<id>/<niveau>.json`,
versionné, un dossier par conte, un fichier par niveau (`255.json`, `hsk3.json`,
`jour25.json`) ; `seuil` y vaut `255`, `"hsk3"` ou `"jour25"`.

```json
{
 "conte": "nan-yuan-bei-zhe",
 "seuil": 255,
 "ouvrage": "《战国策·魏策四》",
 "titre": {"zh": "要去南方的人", "pinyin": "yào qù nán fāng de rén"},
 "phrases": [
  {"zh": "有人问他：「你去哪里？」", "pinyin": "yǒu rén wèn tā nǐ qù nǎ lǐ",
   "fr": "Quelqu'un lui demanda : « Où vas-tu ? »", "en": "Someone asked him, \"Where are you going?\""}
 ],
 "glose": [
  {"zh": "有人", "pinyin": "yǒu rén", "fr": "quelqu'un", "en": "someone"},
  {"zh": "哪里", "pinyin": "nǎ lǐ", "fr": "où", "en": "where"}
 ]
}
```

- Toutes les clés sont obligatoires, aucune autre n'est admise : une faute de frappe
  ne passe pas en silence. `conte` et `seuil` redisent le chemin.
- `ouvrage` : l'ouvrage du catalogue, à l'identique, ou `null` pour ne pas le citer.
  Une source qui diffère du catalogue est refusée : on corrige l'un ou l'autre.
- `titre` : `{zh, pinyin}` ; `phrases` : une liste non vide de `{zh, pinyin, fr, en}` ;
  un récit long écrit à la place `chapitres` : une liste non vide de `{titre: {zh,
  pinyin}, phrases: [...]}`, un objet par chapitre prévu (l'un ou l'autre, jamais les
  deux ; une autre clé dans un chapitre est refusée) ;
  `glose` : une liste de `{zh, pinyin, fr, en}`, dans l'ordre d'apparition, sans
  doublon. Même règle de pinyin et de glose que ci-dessus.
- `expliques`, seule clé facultative : les mots expliqués, au format de la version
  (`[{zh, pinyin, fr, en, explication_fr, explication_en}]`, sans doublon), à omettre
  quand le récit n'en a pas besoin. Un brouillon écrit avant ce champ reste valide.
- Le reste de la version (`titre_fr`, `titre_en`, `source.resume_fr`, et les titres
  français et anglais des chapitres) ne s'écrit pas : l'import le prend dans le
  catalogue.

Commandes :

- `uv run wenlu contes contexte <id> [<id> …] --niveau 255` (ou `--niveau hsk3`) affiche les contraintes de
  `valider()`, puis, par conte : titres, ouvrage, intrigue du catalogue, niveaux prévus
  (et si le niveau demandé n'en est pas), longueur visée (par chapitre pour un récit
  long), les chapitres prévus avec leurs titres et leurs résumés,
  les caractères du titre traditionnel hors du niveau, **la liste exacte des caractères
  autorisés**, le chemin du brouillon et un squelette.
- `uv run wenlu contes importer [<id> …] [--niveau 255]` lit les brouillons (tous, ou
  ceux des contes nommés), construit la version, lance `valider()` et l'écrit dans
  `data/sources/contes-versions/<niveau>/<id>.json` au statut `a_relire` si elle est
  conforme, `rejete` sinon. Les intrus et les écarts s'affichent par version ; on
  corrige le brouillon et on relance. Un brouillon illisible (JSON, clé manquante ou
  inconnue, `conte` ou `seuil` qui ne redit pas le chemin, conte hors catalogue,
  ouvrage inexact) n'écrit rien. Code de sortie 1 dès qu'un brouillon est rejeté ou
  illisible.

Traçabilité, dans `generation` : `api` vaut `session Claude Code (sans API)`, `modele`
vaut `rédaction manuelle`, `empreinte_invite` est le `sha256` des octets du brouillon
(`sha256sum` la retrouve), `date` le jour de l'import (`AAAA-MM-JJ`), `essais` le nombre
de versions du brouillon importées, `intrus` les caractères hors liste. Réimporter un
brouillon inchangé ne réécrit rien — une version relue le reste ; un brouillon modifié
remet la version au statut `a_relire`.

### Relecture

La relecture reste humaine (brief §7). `uv run wenlu contes relire --conte <id> --niveau 255
--statut relu` marque une version ; pour une page de relecture :

- `uv run wenlu contes exporter-relecture [--sortie …]` écrit
  `data/work/relecture-contes.json`, hors dépôt : `{date, source, decisions, retour,
  contes}`, où `contes` porte chaque version `a_relire` (format ci-dessus), avec sa
  `cle` (`255/yu-gong-yi-shan`, `hsk3/mei-hou-wang`) et ses `ecarts`, triée par niveau puis par conte ;
- `uv run wenlu contes appliquer-relecture <fichier>` lit
  `{"255/yu-gong-yi-shan": "relu", "255/ba-miao-zhu-zhang": "rejete", "255/nan-yuan-bei-zhe": null}`
  et applique `relire` à chaque version. `null` laisse une version en attente. Tout ou
  rien : une clé mal formée, une décision inconnue, une version absente ou une version
  rejetée aux contrôles marquée `relu`, et rien n'est appliqué.

### Ce que l'app lira (export, story 1.6)

`app/public/data/<version>/contes/<id>.json` réunit les versions **relues** d'un même
conte, une par niveau, sous la clé du niveau (`"255"`, `"hsk3"`), du plus petit au plus grand :

```json
{
 "version": "0.1.0",
 "license": "propriétaire",
 "source": "récit traditionnel, 《战国策·魏策四》 (domaine public) ; texte réécrit pour l'app",
 "source_url": "https://github.com/jon-gyt/zilin",
 "modified": "2026-09-24 : assemblé par `wenlu export`",
 "conte": "nan-yuan-bei-zhe",
 "titre_fr": "Rouler vers le nord pour aller au sud",
 "titre_en": "Heading North to Go South",
 "versions": {
  "255": {
   "titre": "要去南方的人",
   "titre_pinyin": "yào qù nán fāng de rén",
   "phrases": [
    {"zh": "有人问他：「你去哪里？」", "pinyin": "yǒu rén wèn tā nǐ qù nǎ lǐ",
     "fr": "Quelqu'un lui demanda : « Où vas-tu ? »", "en": "Someone asked him, \"Where are you going?\""}
   ],
   "glose": {
    "哪里": {"pinyin": "nǎ lǐ", "fr": "où", "en": "where"},
    "有人": {"pinyin": "yǒu rén", "fr": "quelqu'un", "en": "someone"}
   }
  }
 }
}
```

`source` ne cite l'ouvrage que si la version le cite (`"récit traditionnel (domaine
public) ; …"` sinon). Dans l'export, les entrées de `glose` sont triées ; l'ordre ne
porte aucun sens, le découpage se fait par la plus longue entrée.

Un récit long y porte `chapitres` à la place de `phrases`, au format de la version :
`[{titre, titre_pinyin, titre_fr, titre_en, phrases}]`. L'aperçu (`apercu/contes/<id>.json`)
suit le même format.

Une version qui a des mots expliqués porte `expliques` : `[{zh, pinyin, fr, en,
explication_fr, explication_en, caracteres}]`, où `caracteres` dit ceux de ses
caractères qui sont hors du niveau (`"叶"` pour `叶公` à `hsk3`, lus dans les listes) :
l'app ne les compte pas dans l'acquis qui ouvre le conte et souligne les unités qui les
portent. Le conte porte alors `racines` (`{"叶": "口", "公": "八"}`), la famille de chaque
caractère de ses mots expliqués : tous entrent dans le périmètre avec leurs briques
(`export.caracteres_expliques_des_contes`, versions relues et à relire), comme ceux des
fêtes, si bien que l'app les dessine depuis `traits/` et que la police les a. Une version
sans mot expliqué n'a pas la clé, un conte sans mot expliqué pas `racines` (format 10).
Le lecteur montre la carte « Vocabulaire du conte », le complément de vocabulaire du
niveau, en tête du chapitre où chaque mot paraît pour la première fois (en tête d'une
fable), et sa glose au toucher dit « mot du conte ».

`app/public/data/<version>/index.json` gagne `contes: [{id, titre_fr, titre_en,
seuils: [255, "hsk3", …], fichier}]` (un seuil en nombre, un niveau HSK ou un jour du chemin en chaîne), les contes relus, et `catalogue: [{id, titre_zh,
titre_pinyin, titre_fr, titre_en, niveaux, chapitres}]`, tout ce que le catalogue
prévoit, écrit ou pas : la bibliothèque montre chaque récit avec ses niveaux (écrit et
ouvert, écrit mais fermé, pas encore écrit) sans rien inventer. Ni résumé ni texte n'y
figurent. L'app choisit la version du niveau le plus haut (par son nombre de caractères) dont tous
les caractères sont acquis, et signale quand une version plus riche s'ouvre (épic 2c).
Au toucher d'un caractère, le lecteur retrouve l'entrée de glose qui le couvre par le
découpage ci-dessus et l'affiche avec son pinyin ; le pinyin de la phrase s'aligne
syllabe par sinogramme. `generation` et `statut` ne sont pas exportés : ils restent
côté pipeline.

## Lettres de Que (story 4b.8)

Douze lettres, une par semaine, écrites par Que 雀 à l'apprenant ; la lettre n n'emploie
que les caractères que le parcours `lire` a posés au jour 7n. Même circuit que les
contes rédigés sans API (`data/src/wenlu_data/lettres.py`).

- Le fil, `data/sources/lettres/feuilleton.tsv`, versionné : `n`, `titre_fr`,
  `titre_en`, `resume_fr` (ce qui s'y passe, pour la relecture).
- Brouillon, `data/sources/lettres-brouillons/<nn>.json` : `{"lettre": 1, "phrases":
  [{zh, pinyin, fr, en}], "glose": [{zh, pinyin, fr, en}]}`, aucune autre clé.
  `uv run wenlu lettres contexte <n>` donne l'acquis du jour 7n, les caractères nouveaux
  de la semaine, les lettres d'avant, les contraintes et un squelette.
- `uv run wenlu lettres importer [<n>…]` valide et écrit
  `data/sources/lettres-versions/<nn>.json` : le brouillon, le titre et le résumé du fil,
  `parcours`, `jour`, `generation` (`api` « session Claude Code (sans API) », `modele`
  « rédaction manuelle », `empreinte_invite` le `sha256` du brouillon, `date`, `essais`,
  `intrus`) et `statut` : `a_relire`, ou `rejete` si un caractère sort de l'acquis du
  jour. Un brouillon inchangé ne réécrit rien ; modifié, la lettre repart à relire.
- Relecture : `uv run wenlu lettres exporter-relecture` écrit
  `data/work/relecture-lettres.json` (hors dépôt, chaque lettre avec ses `ecarts`),
  `uv run wenlu lettres appliquer-relecture <fichier>` applique `{"1": "relu", "2":
  "rejete", "3": null}`, tout ou rien ; une lettre rejetée aux contrôles ne se relit pas.
  `uv run wenlu lettres apercu` affiche les lettres, phrase par phrase.
- Contrôles (`wenlu check`), bloquants : « lettres : feuilleton » (douze lettres, dans
  le fil, chaque brouillon importé tel qu'il est écrit), « acquis du jour », « pinyin »
  (une syllabe par sinogramme, tons du dictionnaire sans sandhi, chacune une lecture
  du caractère), « glose » (chaque sinogramme couvert, pinyin syllabe pour syllabe, fr
  et en), « forme » (40 à 120 sinogrammes, traductions, question finale), « export »
  (`lettres.json` porte exactement les relues, `apercu/lettres.json` exactement les
  lettres à relire). Signalés : « relecture » et « parcours HSK », le jour du parcours
  HSK où chaque lettre devient lisible, ou les caractères qu'il ne pose jamais.
