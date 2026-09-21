# Schéma d'export

`app/public/data/<version>/index.json` : `{ version, parcours: {lire: [...], hsk: [...]}, familles: [{racine, fichier, n}] }`.

`app/public/data/<version>/familles/<racine>.json` : `Famille` (voir `models.py`). Une fiche par caractère, décomposition canonique GF 0014-2009, origine en trois phrases FR et EN, étiquette `atteste` ou `mnemotechnique`, deux mots et une phrase, traits et médianes (rendu et tracé), chemin audio.

Règle : l'app ne lit que ces fichiers. Aucune donnée de contenu dans le code.

## Format intermédiaire (story 1.1)

`uv run zilin fetch` écrit les sources brutes dans `data/work/sources/`, avec `SHA256SUMS` et `PROVENANCE.md` (URL, date, taille, empreinte, licence). `uv run zilin ingest` les normalise dans `data/work/ingest/`, hors dépôt :

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

`uv run zilin build` écrit dans `data/work/build/`, hors dépôt :

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

`uv run zilin check` relit `decompositions.json` : le contrôle « composants inconnus »
signale sans bloquer (la norme ne couvre que 3 500 caractères), le contrôle « cycles »
est bloquant.

## Graphe et parcours (story 1.3)

`uv run zilin build` écrit ensuite, toujours dans `data/work/build/` :

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
  Acquises d'entrée, elles ne prennent jamais de jour ; `zilin check` les signale.
- `non_reconcilies` et `absents` : caractères de la liste dont la décomposition n'est pas
  réconciliée (22 pour le seuil 255, 31 pour le HSK 1) ou qui manquent au dictionnaire.
  Ils ferment le parcours, marqués `non_reconcilie` : jamais oubliés.

`uv run zilin check` ajoute trois contrôles : « cycles du graphe » (bloquant),
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

`uv run zilin fiches generer [--parcours lire] [--jusqua N] [--c 住]` puis
`uv run zilin fiches recuperer` écrivent `data/work/fiches/<c>.json` :

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
(`uv run zilin fiches relire --c 住 --statut relu`). Seules les fiches relues sont
exportables : la relecture est obligatoire sur le seuil 255 (brief §17).

Le journal des lots est dans `data/work/fiches/lots/<lot>.json` : identifiant du lot,
parcours, modèle, date de soumission, statut, et une entrée par requête (`custom_id`,
caractère, numéro d'essai, empreinte de l'invite).

`uv run zilin check` relit ces fichiers s'ils existent : le contrôle
« fiches : validation » est bloquant, le contrôle « fiches : relecture du seuil 255 »
compte ce qui reste à relire et les caractères du seuil sans fiche — il signale, il ne
bloque pas. `uv run zilin fiches valider` refait le même contrôle à la demande.

### Ce que l'app lira (export, story 1.6)

L'export d'une famille reprend d'une fiche générée `origine_fr`, `origine_en`,
`etiquette`, `memo_fr`, `memo_en`, `mots` et `phrase`, et remplit le reste de `Fiche`
(`models.py`) depuis le graphe et les graphies : `parts` vient de `composants`,
`nouveau` du graphe, `role` et les rôles par brique de `roles`, `traits` et `medianes`
de `graphies.json`, `audio` de la story 1.5. `generation` et `statut` ne sont pas
exportés : ils restent côté pipeline. Une fiche dont le `statut` n'est pas `relu`
n'entre pas dans l'export du seuil 255.

## Audio pré-généré (story 1.5)

Un fichier par caractère et par mot, synthétisé une fois dans le pipeline puis embarqué
avec l'app (brief §11 : « voix neuronale pré-générée et embarquée pour tous les
caractères et mots. Aucune dépendance à la voix du téléphone »). L'app ne synthétise
jamais ; elle lit un fichier servi avec elle, et se tait sur ce qui n'en a pas.

Format : MP3 mono 24 kHz à 48 kbit/s, soit environ 6 Ko par seconde de parole — moins de
15 Ko pour un caractère comme pour un mot de deux caractères. Opus descendrait de moitié,
mais la lecture d'un Ogg Opus par un `HTMLAudioElement` n'est acquise sur iOS que depuis
Safari 17.5, et c'est l'iPhone qui est visé en premier.

### Périmètre

`perimetre()` prend les fiches **relues** du parcours (leur caractère et leurs deux mots)
et, à défaut, la liste cible (`seuil-255` pour `lire`, `hsk-1` pour `hsk`) plus, quand
`zilin build` a tourné, au plus deux mots candidats par caractère, tous caractères de la
liste. Une fiche non relue n'entre pas : son texte peut encore changer.

### Fichiers et manifeste, hors dépôt

`uv run zilin audio generer [--parcours lire] [--seuil 255] [--voix …]` écrit
`data/work/audio/<empreinte>.mp3` et le manifeste `data/work/audio/audio.json` :

```json
{
 "version": 1,
 "genere": "2026-09-21T10:00:00Z",
 "format": "mp3",
 "debit": "mono 24 kHz, 48 kbit/s",
 "entrees": [
  {
   "texte": "住", "genre": "caractere", "fichier": "2f6a1c0b9d4e8a37.mp3",
   "fournisseur": "azure-speech", "voix": "zh-CN-XiaoxiaoNeural", "format": "mp3",
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
plus `nom`, `voix`, `format` et une `Licence`). Deux implémentations : `FournisseurSimule`
pour les tests (aucun réseau, octets déterministes, jamais accessible depuis la CLI) et
`FournisseurAzure` (REST, clé dans `AZURE_SPEECH_KEY`, région dans `AZURE_SPEECH_REGION`).
Sans clé, la commande refuse de partir, sort en code 2 et n'écrit rien. La `Licence` porte
ce que le fournisseur déclare sur l'usage commercial, la redistribution, l'attribution et
la redevance par écoute ; elle est aujourd'hui « à vérifier » sur les quatre points, et la
commande le rappelle à chaque passage (voir `docs/sources-licences.md`).

`uv run zilin check` ajoute le contrôle « audio : textes sans audio » : il compte les
textes du périmètre qui n'ont pas de fichier. Signalé, jamais bloquant — l'audio arrive
après le texte, et l'app se tait sur ce qui n'a pas de voix.

### Ce que l'app lira (export)

`uv run zilin audio exporter [--version 0.1.0] [--parcours lire] [--seuil 255]` copie les
fichiers du périmètre dans `app/public/data/<version>/audio/` et écrit à côté
`manifeste.json` :

```json
{
 "version": "0.1.0",
 "license": "audio synthétisé — droits du fournisseur (Azure AI Speech (Microsoft))",
 "source": "Azure AI Speech (Microsoft), voix zh-CN-XiaoxiaoNeural",
 "source_url": "https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech",
 "modified": "2026-09-21",
 "fournisseur": "Azure AI Speech (Microsoft)",
 "format": "mp3",
 "debit": "mono 24 kHz, 48 kbit/s",
 "licence": {"usage_commercial": "à vérifier", "redistribution": "à vérifier", "…": "…"},
 "chemins": {"住": "data/0.1.0/audio/2f6a1c0b9d4e8a37.mp3"}
}
```

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

`uv run zilin contes generer --seuil <n> [--conte <id>]` puis `uv run zilin contes
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

`uv run zilin check` relit ces fichiers s'ils existent : le contrôle « contes :
caractères hors liste » est bloquant, le contrôle « contes : relecture » compte ce qui
reste à relire. `uv run zilin contes valider` refait le même contrôle à la demande.

### Ce que l'app lira (export, story 1.6)

`app/public/data/<version>/contes/<id>.json` réunit les versions d'un même conte, une
par seuil :

```json
{
 "version": "0.1.0",
 "license": "propriétaire",
 "source": "récit traditionnel, 《韩非子·五蠹》 (domaine public) ; texte réécrit pour l'app",
 "modified": "2026-09-21",
 "conte": "shou-zhu-dai-tu",
 "titre_fr": "Guetter la souche en attendant le lièvre",
 "versions": {
  "255": {"titre": "…", "phrases": [{"zh": "…", "pinyin": "…", "fr": "…", "audio": "…"}], "glose": {"…": "…"}}
 }
}
```

`app/public/data/<version>/index.json` gagne `contes: [{id, titre_fr, seuils: [255, …],
fichier}]`. L'app choisit la version du seuil le plus haut dont tous les caractères sont
acquis, et signale quand une version plus riche s'ouvre (épic 2c). La glose est ce qui
s'affiche au toucher d'un caractère pendant la lecture. `generation` et `statut` ne sont
pas exportés : ils restent côté pipeline.
