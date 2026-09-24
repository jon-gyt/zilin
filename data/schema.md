# Schéma d'export

`uv run wenlu export --version 0.1.0` écrit `app/public/data/0.1.0/`, les seuls
fichiers que l'app lira. Cette section décrit ce qui est réellement écrit
(story 1.6) ; les sections suivantes décrivent les formats intermédiaires de
`data/work/`, qui restent hors dépôt.

Règle : l'app ne lit que ces fichiers. Aucune donnée de contenu dans le code.

## Périmètre d'une version

Les caractères des listes cibles — `seuil-255` et `hsk-1` — et **leurs briques**
(prérequis transitifs de la décomposition canonique), pas tout le dictionnaire.
Une famille n'est exportée qu'avec ses membres du périmètre ; la famille 口 en a
17 ici, contre 525 dans le graphe complet. Les caractères que les fêtes
dessinent depuis leurs traits (`data/sources/fetes/textes.tsv` : l'anecdote et le
福 du vœu) y entrent aussi, avec leurs briques. Version 0.1.0 : 238 familles,
486 caractères (222 briques, 13 feuilles muettes), 1,34 Mio.

## Arborescence

```
app/public/data/0.1.0/
  index.json                 la porte d'entrée
  LICENCES.md                chaque source, sa licence, son attribution
  ARPHICPL.TXT               texte de l'Arphic Public License, inaltéré
  UNICODE-LICENSE.txt        notice de permission Unicode (pinyin)
  paires.json                les caractères à ne pas confondre
  fetes.json                 le calendrier des fêtes et leurs textes
  familles/<racine>.json     une famille : `Famille` de models.py
  traits/<racine>.json       les tracés de la famille, sous APL, et rien d'autre
  traits/ARPHICPL.TXT        la même licence, à côté des fichiers qu'elle couvre
  traits/MODIFICATIONS.md    comment et quand les tracés ont été dérivés
  contes/<id>.json           un conte, une version par seuil (aucun aujourd'hui)
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
 "compte": {"familles": 238, "caracteres": 485, "briques": 222, "muettes": 13,
            "fiches_relues": 0, "contes": 0},
 "listes": {"seuil-255": ["…"], "hsk-1": ["…"]},
 "parcours": {"lire": {"liste": "seuil-255", "regle": "…",
                       "jours": [{"jour": 1, "brique": "月", "composes": ["朋", "有"],
                                  "non_reconcilie": false}]},
              "hsk": {"…": "…"}},
 "familles": [{"racine": "亻", "fichier": "familles/亻.json",
               "traits": "traits/亻.json", "n": 14, "avancement_possible": 0.0}],
 "contes": [{"id": "…", "titre_fr": "…", "seuils": [255], "fichier": "contes/….json"}],
 "paires": "paires.json"
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
  session de 10 minutes, puis un ou deux composés.
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

`racine` est une `Brique` : `{c, pinyin, fr, en, origine, etiquette}`. `fiches`
porte une `Fiche` par caractère de la famille, triée par caractère :

- `c`, `pinyin` — le pinyin vient d'Unihan (`kMandarin`), jamais de
  `dictionary.txt` ni de CC-CEDICT (`docs/sources-licences.md` §2.2 et §4.2).
- `parts` : la décomposition canonique GF 0014-2009, dans l'ordre d'écriture ;
  vide pour une brique, qui est une feuille de la norme.
- `sources` : d'où vient la chaîne IDS descendue pour cette décomposition,
  `makemeahanzi` ou `cjk-decomp`. Nommée par caractère pour que la question de
  licence de `dictionary.txt` (LGPL, §2.2) reste tranchable fichier par fichier.
- `nouveau` : les index, dans `parts`, de l'élément ajouté — le composant posé le
  même jour que le caractère dans son parcours de référence (`lire`, sinon
  `hsk`). C'est le seul élément que l'app met en cinabre.
- `role` : le rôle de cet élément ajouté ; `roles` : le rôle de chaque brique de
  la décomposition (`son`, `sens`, `forme`). Nuls sans fiche relue.
- `origine_fr`, `origine_en`, `etiquette`, `memo_fr`, `memo_en`, `mots`,
  `phrase` : repris d'une fiche **relue** de `data/work/fiches/`. Sans fiche
  relue, les textes sont vides, `etiquette` et `role` nuls — jamais d'étiquette
  sans origine — et `statut` vaut `sans_fiche` au lieu de `relu`.
- `niveaux` : `{"seuil": 255}` ou `{"hsk": 1}`, selon les listes qui portent le
  caractère.
- `fr`, `en` : vides tant qu'ils ne viennent pas d'une fiche relue. Aucune
  définition anglaise n'entre dans l'export, ni `kDefinition` d'Unihan, ni
  CC-CEDICT.
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
médianes ne sont ni arrondis ni simplifiés. Écriture compacte (sans indentation) :
indentés, ces milliers de nombres pèseraient dix fois plus.

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
 "calendrier": [{"fete": "chunjie", "date": "2027-02-06", "avant": 1, "apres": 14, "annee": 2027,
                 "animal": {"c": "羊", "pinyin": "yáng", "fr": "de la Chèvre"}}],
 "fetes": {"chunjie": {"nom": "Nouvel An lunaire", "nom_zh": "春节",
                       "voeu": {"zh": "新年快乐", "pinyin": "xīnnián kuàilè", "fr": "Bonne année {animal}"},
                       "caractere_voeu": "福", "tao": ["…"],
                       "anecdote": {"rubrique": "…", "c": "年", "titre": "…", "texte": "…"}}},
 "racines": {"年": "年", "月": "月", "福": "礻"}}
```

- Une fête est active du jour `date − avant` au jour `date + apres` inclus.
  春节 : du réveillon 除夕 (−1) à la fête des Lanternes 元宵 (+14) ; 中秋 : −3 à +1.
- `{animal}` et `{quand}` sont des jetons que l'app remplit au jour de la fête :
  l'animal de l'entrée du calendrier (« de la Chèvre 羊 ») et le délai jusqu'au soir
  de la fête (« Demain soir »).
- `racines` donne la famille de chaque caractère dessiné : l'app lit ses traits
  dans `traits/<racine>.json` sans relire toutes les familles.

## `LICENCES.md`

Écrit par l'export. Un tableau `source | usage | licence | attribution | texte de
la licence` pour chaque source embarquée, la séparation des fichiers, ce que
l'export ne contient pas, la question de licence ouverte sur `dictionary.txt`, et
les obligations hors app (publier les tracés dérivés sous APL). Il fait foi pour
ce que l'app embarque ; `docs/sources-licences.md` fait foi pour la décision.

## Contrôles (`uv run wenlu check`)

- « export : à jour » — bloquant : l'empreinte de `index.json` doit valoir celle
  du build présent. Un export absent n'est pas une faute.
- « export : séparation des licences » — bloquant : chaque JSON porte son
  en-tête, `traits/` ne porte que des tracés, aucune fiche ne porte de tracé.
- « export : familles sans fiche relue » — signalé : ce qui reste à relire avant
  que l'app puisse enseigner ces familles.
- « fêtes : calendrier » — bloquant : dates lisibles et égales au calcul du
  calendrier lunaire, fenêtres positives, animal de l'année, 2026 à 2035 couverts
  pour chaque fête, aucun chevauchement.
- « fêtes : textes » — bloquant : chaque fête a toutes ses clés, aucune vide,
  des jetons connus, une source.
- « fêtes : caractères dessinés » — bloquant : l'anecdote et le 福 du vœu ont
  leurs traits dans chaque version exportée.

## Format intermédiaire (story 1.1)

`uv run wenlu fetch` écrit les sources brutes dans `data/work/sources/`, avec `SHA256SUMS` et `PROVENANCE.md` (URL, date, taille, empreinte, licence). `uv run wenlu ingest` les normalise dans `data/work/ingest/`, hors dépôt :

- `caracteres.json` : `[{c, decomposition, radical, pinyin[], definition_en, etymologie}]` depuis `dictionary.txt`. `decomposition` est la chaîne IDS de Make Me a Hanzi, telle quelle : elle n'est pas canonique tant que la story 1.2 ne l'a pas réconciliée avec GF 0014-2009. `etymologie` est la couche étymologique EN, `{type, hint, phonetic, semantic}`, `type` parmi `pictographic`, `ideographic`, `pictophonetic` ; elle reste distincte de la décomposition.
- `graphies.json` : `[{c, strokes[], medians[]}]` depuis `graphics.txt`, autant de médianes que de traits.
- `mots.json` : `[{traditionnel, simplifie, pinyin, definitions_en[]}]` depuis CC-CEDICT.
- `listes.json` : `{ "<nom de liste>": [caractères] }`, chargé depuis `data/sources/listes/*.txt` (un sinogramme par ligne, `#` en commentaire, ni doublon ni non-sinogramme).
- `unihan.json` : `{source, licence, url, version, date, fichiers[], champs[], frequence,
  caracteres: [{c, code, pinyin, lectures[], traits, frequence}]}` depuis `Unihan.zip`
  (UCD, Unicode License). `pinyin` est la première lecture de `kMandarin`, la plus
  courante en zh-CN selon UAX #38 ; `lectures` les garde toutes. `traits` vient de
  `kTotalStrokes`, `frequence` de `kFrequency` — absent d'Unihan 17.0.0 et 18.0.0, où il
  vaut donc `null` ; il existait encore en 12.0.0. `fichiers` reprend l'en-tête officiel
  de chaque `Unihan_*.txt` lu (nom, date, version), qui vaut preuve de provenance.
- `unihan-definitions.json` : `{…, definitions: [{c, definition_en}]}` depuis
  `kDefinition`. Fichier séparé parce que ces gloses sont anglaises : comme celles de
  CC-CEDICT, elles ne doivent jamais alimenter la génération des fiches FR.
- `ids-secondaires.json` : `{source, licence, url, usage, ids: {caractère: IDS}}` depuis
  `cjk-decomp.txt` (MIT), converti en IDS par `cjkdecomp.py`. Source de repli, utilisée
  seulement là où Make Me a Hanzi donne `？` ou rien.
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

- `decompositions.json` : `{norme, table: {fichier, composants, groupes}, source_ids,
  source_ids_secondaire,
  caracteres: [{c, composants[], structure, reconcilie, inconnus[], cycle[], sources[]}]}`.
  `composants` est la liste ordonnée des feuilles atteintes en descendant l'IDS de Make
  Me a Hanzi jusqu'aux composants de la norme, dans l'ordre des opérandes IDS, qui est
  l'ordre d'écriture. Un composant de la norme est une feuille : on n'y descend plus.
  `structure` est l'IDS réduit à ces feuilles. `inconnus` liste les feuilles absentes de
  la norme — elles figurent quand même dans `composants` — et `cycle` le chemin de
  descente qui boucle. `reconcilie` vaut vrai quand les deux sont vides. `sources` nomme
  les sources d'IDS descendues (`makemeahanzi`, `cjk-decomp`) : un caractère marqué
  `cjk-decomp` est à relire, ses feuilles étant plus sûres que sa structure.
- `ecarts.md` : décompte des caractères réconciliés, composants inconnus classés par
  fréquence avec leur point de code, cycles, apport de l'IDS secondaire, et état des
  listes prioritaires (seuil 255, HSK 1) avec les caractères que l'IDS secondaire a
  réconciliés, à relire.

`uv run wenlu check` relit `decompositions.json` : le contrôle « composants inconnus »
signale sans bloquer (la norme ne couvre que 3 500 caractères), le contrôle « cycles »
est bloquant.

## Graphe et parcours (story 1.3)

`uv run wenlu build` écrit ensuite, toujours dans `data/work/build/` :

### `graphe.json`

`{norme, source, critere_racine, compte, noeuds[], aretes[], familles[], cycles[]}`.

- `compte` : `{noeuds, aretes, familles, familles_non_vides, briques, caracteres,
  muettes, cycles}`.
- `noeuds` : `[{c, genre, prerequis[], dependants, racine, reconcilie}]`. `genre` vaut
  `brique` (composant GF 0014-2009 présent au dictionnaire, il porte une fiche et se
  pose en une session), `caractere` (caractère du dictionnaire qui n'est pas un
  composant de la norme) ou `muette` (feuille sans fiche : composant sans point de code,
  ou forme absente du dictionnaire, à commencer par `？`, la marque de Make Me a Hanzi
  pour un élément qu'il ne décompose pas). `prerequis` est la liste ordonnée et sans
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

`{parcours, liste, regle, critere_frequence, cible[], compte, jours[], briques[],
briques_muettes[], non_reconcilies[], absents[]}`.

- `parcours` vaut `lire` (liste cible `seuil-255`, puis les seuils suivants) ou `hsk`
  (liste cible `hsk-1`). Même graphe, seule la liste change.
- `cible` : la liste cible dans l'ordre du référentiel ; le fichier se contrôle seul.
- `compte` : `{cibles, jours, jours_reconcilies, briques, muettes, non_reconcilies,
  absents}`.
- `jours` : `[{jour, brique, composes[], non_reconcilie}]`. Un jour est une session de
  10 minutes : au plus une brique nouvelle, puis un ou deux composés qui deviennent
  lisibles avec elle. `brique` est nul les jours de consolidation, quand il ne reste que
  des composés à poser. Les jours `non_reconcilie` ferment le parcours.
- Ordre : tri topologique — une brique avant tout ce qui la contient. Parmi les
  candidats prêts, priorité aux caractères de la liste cible, puis à ce qui devient
  lisible le jour même, puis à la fréquence, puis à l'ordre de la liste. Make Me a Hanzi
  ne fournit aucun rang de fréquence : le repli documenté (`critere_frequence`) est le
  nombre de caractères qui dépendent du candidat. Si l'ingestion vient à produire un
  rang sous la clé `frequence`, il prend le pas sans autre changement.
- `briques_muettes` : les feuilles sans fiche employées par des caractères de la liste.
  Acquises d'entrée, elles ne prennent jamais de jour ; `wenlu check` les signale.
- `non_reconcilies` et `absents` : caractères de la liste dont la décomposition n'est pas
  réconciliée (22 pour le seuil 255, 31 pour le HSK 1) ou qui manquent au dictionnaire.
  Ils ferment le parcours, marqués `non_reconcilie` : jamais oubliés.

`uv run wenlu check` ajoute trois contrôles : « cycles du graphe » (bloquant),
« caractères de liste absents du parcours » (bloquant) et « briques muettes » (signalé).

## Fiches FR et EN (story 1.4)

Une fiche explique un caractère du parcours par ses composants : origine en exactement
trois phrases FR et EN, étiquette `atteste` ou `mnemotechnique`, rôle de chaque
composant, deux mots et une phrase. Aucun texte de fiche n'est écrit à la main : il
sort du pipeline, puis d'une relecture humaine.

### Contexte soumis au modèle

Assemblé par `fiches.Corpus` depuis `decompositions.json`, `graphe.json`,
`parcours-<nom>.json`, `caracteres.json` et `mots.json` :

- le caractère, son pinyin (`caracteres.json`), sa famille et son genre (`graphe.json`) ;
- sa décomposition canonique GF 0014-2009 (`decompositions.json`), avec le nom normalisé
  (部件名称) de chaque composant, pris dans `composants.tsv` ;
- le rôle probable d'un composant quand l'étymologie de Make Me a Hanzi le désigne comme
  `phonetic` (son) ou `semantic` (sens). C'est une donnée factuelle, donnée au modèle
  pour vérification, jamais un verdict ;
- son `type` d'étymologie et son `hint` anglais, ce dernier nommément marqué comme
  indice à vérifier, à ne ni traduire ni recopier (`docs/sources-licences.md` §2.2) ;
- les mots candidats : mots de deux caractères de CC-CEDICT contenant le caractère et
  dont tous les caractères sont déjà vus au jour du parcours, avec leur pinyin et rien
  d'autre. Les entrées au pinyin capitalisé (noms propres) sont écartées. La définition
  anglaise n'est jamais lue ni transmise (`docs/sources-licences.md` §4.2) ;
- les caractères acquis à ce jour, caractère du jour compris : les seuls autorisés dans
  la phrase.

La réponse est contrainte par `output_config.format` (JSON structuré). La validation
refuse une fiche dont l'origine FR ou EN ne fait pas exactement trois phrases (points
finaux comptés), dont l'étiquette sort des deux valeurs, dont un mot n'est pas dans les
candidats, ou dont la phrase emploie un caractère hors de l'acquis — les intrus sont
listés exactement. La relance signale les motifs de refus, au plus trois essais. Rôle
manquant, traduction vide, phrase sans le caractère du jour et manque de mots candidats
sont des écarts signalés à la relecture, pas des rejets.

### Fiche générée, hors dépôt

`uv run wenlu fiches generer [--parcours lire] [--jusqua N] [--c 住]` puis
`uv run wenlu fiches recuperer` écrivent `data/work/fiches/<c>.json` :

```json
{
 "c": "住",
 "parcours": "lire",
 "jour": 160,
 "pinyin": ["zhù"],
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

`roles` donne, par composant de la décomposition canonique, `son`, `sens` ou `forme`.
`etiquette` vaut `atteste` seulement si l'origine est établie par le Shuowen ou la
paléographie, `mnemotechnique` sinon — jamais l'un pour l'autre. `memo_fr` et `memo_en`
sont facultatifs. `generation` est la traçabilité : d'où vient la fiche et comment.
`statut` vaut `a_relire` à la sortie du pipeline, `rejete` s'il reste un motif de refus
après trois essais, `relu` une fois la relecture humaine faite
(`uv run wenlu fiches relire --c 住 --statut relu`). Seules les fiches relues sont
exportables : la relecture est obligatoire sur le seuil 255 (brief §17).

Le journal des lots est dans `data/work/fiches/lots/<lot>.json` : identifiant du lot,
parcours, modèle, date de soumission, statut, et une entrée par requête (`custom_id`,
caractère, numéro d'essai, empreinte de l'invite).

`uv run wenlu check` relit ces fichiers s'ils existent : le contrôle
« fiches : validation » est bloquant, le contrôle « fiches : relecture du seuil 255 »
compte ce qui reste à relire et les caractères du seuil sans fiche — il signale, il ne
bloque pas. `uv run wenlu fiches valider` refait le même contrôle à la demande.

### Ce que l'app lira (export, story 1.6)

L'export d'une famille reprend d'une fiche **relue** `origine_fr`, `origine_en`,
`etiquette`, `memo_fr`, `memo_en`, `mots`, `phrase` et `roles`, et remplit le reste de
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

Un même récit traditionnel est réécrit à chaque seuil (255, 405, 505, 805, 1555) avec
les seuls caractères du seuil. L'utilisateur relit la même histoire, plus riche, quand
son acquis grandit (épic 2c).

### Catalogue, versionné

`data/sources/contes/catalogue.tsv` : `#` en commentaire, cinq colonnes séparées par une
tabulation — `id`, `titre_zh`, `titre_fr`, `ouvrage`, `resume_fr`. Dix récits tirés
d'ouvrages classiques du domaine public. `ouvrage` trace l'origine du récit, `resume_fr`
résume l'intrigue en une phrase. Aucun texte de ces ouvrages n'est recopié, et aucun
conte n'est écrit à la main : les versions chinoises sortent du pipeline.

### Version générée, hors dépôt

`uv run wenlu contes generer --seuil <n> [--conte <id>]` puis `uv run wenlu contes
recuperer` écrivent `data/work/contes/<seuil>/<id>.json` :

```json
{
 "conte": "shou-zhu-dai-tu",
 "seuil": 255,
 "titre": "…",
 "titre_fr": "Guetter la souche en attendant le lièvre",
 "source": {"ouvrage": "《韩非子·五蠹》", "resume_fr": "…"},
 "phrases": [{"zh": "…", "pinyin": "…", "fr": "…"}],
 "glose": {"<caractère>": "<sens court en français>"},
 "generation": {
  "modele": "claude-opus-5",
  "api": "messages.batches",
  "date": "2026-09-21T10:00:00Z",
  "empreinte_invite": "sha256:…",
  "essais": 2,
  "intrus": []
 },
 "statut": "a_relire"
}
```

`phrases` porte le texte phrase par phrase : c'est l'unité d'affichage, d'audio et de
traduction. `glose` couvre chaque caractère distinct du titre et du texte, avec le sens
qu'il a ici, en français — jamais une définition traduite d'une source anglaise
(`docs/sources-licences.md` §4.2). `generation` est la traçabilité : d'où vient la
version et comment. `statut` vaut `a_relire` à la sortie du pipeline, `rejete` s'il
reste des caractères hors liste après trois essais, `relu` une fois la relecture
humaine faite. Seules les versions relues sont exportables.

Le journal des lots est dans `data/work/contes/lots/<lot>.json` : identifiant du lot,
seuil, modèle, date de soumission, statut, et une entrée par requête (`custom_id`,
conte, numéro d'essai, empreinte de l'invite).

`uv run wenlu check` relit ces fichiers s'ils existent : le contrôle « contes :
caractères hors liste » est bloquant, le contrôle « contes : relecture » compte ce qui
reste à relire. `uv run wenlu contes valider` refait le même contrôle à la demande.

### Ce que l'app lira (export, story 1.6)

`app/public/data/<version>/contes/<id>.json` réunit les versions d'un même conte, une
par seuil :

```json
{
 "version": "0.1.0",
 "license": "propriétaire",
 "source": "récit traditionnel, 《韩非子·五蠹》 (domaine public) ; texte réécrit pour l'app",
 "source_url": "https://github.com/jon-gyt/zilin",
 "modified": "2026-09-21 : assemblé par `wenlu export`",
 "conte": "shou-zhu-dai-tu",
 "titre_fr": "Guetter la souche en attendant le lièvre",
 "versions": {
  "255": {"titre": "…", "phrases": [{"zh": "…", "pinyin": "…", "fr": "…"}], "glose": {"…": "…"}}
 }
}
```

`app/public/data/<version>/index.json` gagne `contes: [{id, titre_fr, seuils: [255, …],
fichier}]`. L'app choisit la version du seuil le plus haut dont tous les caractères sont
acquis, et signale quand une version plus riche s'ouvre (épic 2c). La glose est ce qui
s'affiche au toucher d'un caractère pendant la lecture. `generation` et `statut` ne sont
pas exportés : ils restent côté pipeline.
