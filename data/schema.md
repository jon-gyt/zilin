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
  caracteres: [{c, composants[], structure, reconcilie, inconnus[], cycle[]}]}`.
  `composants` est la liste ordonnée des feuilles atteintes en descendant l'IDS de Make
  Me a Hanzi jusqu'aux composants de la norme, dans l'ordre des opérandes IDS, qui est
  l'ordre d'écriture. Un composant de la norme est une feuille : on n'y descend plus.
  `structure` est l'IDS réduit à ces feuilles. `inconnus` liste les feuilles absentes de
  la norme — elles figurent quand même dans `composants` — et `cycle` le chemin de
  descente qui boucle. `reconcilie` vaut vrai quand les deux sont vides.
- `ecarts.md` : décompte des caractères réconciliés, composants inconnus classés par
  fréquence avec leur point de code, cycles, et état des listes prioritaires
  (seuil 255, HSK 1).

`uv run zilin check` relit `decompositions.json` : le contrôle « composants inconnus »
signale sans bloquer (la norme ne couvre que 3 500 caractères), le contrôle « cycles »
est bloquant.

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
