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
