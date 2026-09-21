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
