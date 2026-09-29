# Provenance des poids du classifieur des tons

Les poids de `modele.json` servent à la question « Dis-le » (story 9.1, brief §10,
« L'oral par IA ») : l'app reconnaît sur l'appareil le ton d'un caractère prononcé
(`app/src/lib/tons/`). Ils ont été appris le 29 septembre 2026, pendant l'étude de
faisabilité de la story, puis versés ici tels quels.

## Les poids

| Fichier | SHA-256 | Taille |
|---|---|---|
| `modele.json` | `eda572fdffacd3540c356b683e6a20167dc7e6c26fcc233c58697187181cf157` | 31,4 Ko, 3 225 paramètres |

Format `wenlu-tons-mlp`, version `0.1.0-2026-09-29` : cinq perceptrons de 34 entrées,
16 neurones cachés (ReLU) et 5 sorties (tons 1 à 4, neutre), moyenne de leurs
probabilités, température 1,2 ; la base à règles de l'app pèse 4 dans la décision
hybride (`poidsRegles`). Les poids sont propriétaires (Wenlu) ; ils dérivent des données
ci-dessous. `wenlu check` compare l'empreinte de ce tableau à celle du fichier :
réentraîner demande de la mettre à jour.

## Les sources

### Entraînement : syllabes du mandarin, jeu 5961 de data.gov.tw

- Contenu : 1 467 syllabes par voix, deux voix natives de Taïwan (une femme, un homme),
  toutes les syllabes du mandarin à tous leurs tons, neutre compris.
- Jeu d'origine : <https://data.gov.tw/dataset/5961>, plateforme des données ouvertes du
  gouvernement de Taïwan. La page est illisible depuis l'environnement de développement :
  le fournisseur exact et l'année sont à relever depuis un réseau ouvert (comme la carte de
  Kokoro l'a été par le workflow `donnees`) avant tout usage commercial.
- Récupéré par la réédition `Punpuf/shenzhen-mandarin-audio`, commit
  `a3617b73489a152f3a307ad3ef9fc67d1b8e1ed3` (22 juillet 2026), dossiers
  `syllables_voice1_opus_48k` et `syllables_voice2_opus_48k` (Opus 48 kbit/s, mono,
  24 kHz). La réédition ne fait que réencoder et renommer (le ton 1 marqué `1`, `ch5`
  corrigé en `q5`) ; la source à citer est data.gov.tw.

| Dossier | Fichiers | Arbre git | SHA-256 du manifeste |
|---|---|---|---|
| `syllables_voice1_opus_48k` | 1 467 | `5cefac5eb195494105073f0707b5d3cd3cc342ee` | `2a8d0ca3ec8326f4036fa8387cb70634e98161ad381535f38245e4aaac45ee94` |
| `syllables_voice2_opus_48k` | 1 467 | `c7a2395889be409d37b5ec19c9aeca93346363f5` | `aae4a95f13a95cf40e969bf81cab21dee76a80a24f04a1bf93d60cfd90885e1a` |

Le manifeste d'un dossier : `sha256sum` de chaque fichier, dans l'ordre des noms, puis le
SHA-256 de cette liste (`ls | sort | xargs sha256sum | sha256sum`).

- Licence : **Open Government Data License, version 1.0** (OGDL-Taiwan-1.0), compatible
  CC BY 4.0 (§4.2). Texte intégral, en chinois et en anglais, lu dans
  `spdx/license-list-data` : `data/sources/licences/OGDL-Taiwan-1.0.txt`, SHA-256
  `6fb1f786e1d278b6240b4816ba791d48fc84223e35da8a9263e42836bc154e94`. §2.1 : licence
  mondiale, gratuite, irrévocable, pour tout usage, produits et services dérivés compris.
  §3.2 : l'attribution est obligatoire, faute de quoi la licence est nulle *ab initio*.
- Attribution, d'après l'annexe de la licence (écrite par `wenlu export` dans `tons.json`
  et dans `LICENCES.md`, que la page des licences du site reprend) :

  > Syllabes du mandarin, deux voix, jeu de données 5961 de data.gov.tw
  > (https://data.gov.tw/dataset/5961). 此開放資料依政府資料開放授權條款 (Open Government
  > Data License) 進行公眾釋出，使用者於遵守本條款各項規定之前提下，得利用之。 The Open Data
  > is made available to the public under the Open Government Data License, User can make
  > use of it when complying to the condition and obligation of its terms. Open Government
  > Data License : https://data.gov.tw/license

  Le premier alinéa de l'annexe (le fournisseur, l'année, le nom exact du jeu et sa
  version) se complète quand la page du jeu aura été lue.
- Aucun son n'est embarqué : seuls les poids appris en dérivent.

### Contours paramétriques

15 000 contours tirés des descriptions phonétiques des tons (échelle de Chao : 55, 35,
214 ou 21, 51, neutre bref ; formes moyennes de Xu 1997), générés par `entrainer.py`
(`synthese`) directement dans l'espace des caractéristiques. Un a priori phonétique, sans
aucune donnée tierce.

### Développement et test, jamais l'entraînement

- `hugolpz/audio-cmn`, voix de Chen Wang (1 707 syllabes, CC BY-SA, version non précisée) :
  développement (taille du modèle, seuils, température).
- `hugolpz/audio-cmn`, voix de Yue Tan (Shtooka `cmn-caen-tan`, CC BY-SA) : test seulement.
- Les fichiers Kokoro de l'app (voix `zf_001`, Apache 2.0, `docs/sources-licences.md`) :
  test seulement.

Aucun poids n'en dérive, et aucun de ces fichiers n'est embarqué par ce biais.

## La méthode

1. `preparer.py` : décode chaque source en WAV 16 bits mono 16 kHz dans
   `data/work/tons/donnees/wav/` et écrit `corpus.json` (source, locuteur, texte, tons de
   surface, rôle). SHA-256 du corpus de l'étude :
   `162cda8e3a241f899880b503eb40990b1260b9428e9985239497060b076c4811`.
2. `app/scripts/tons/extraire.ts` : calcule les caractéristiques de chaque syllabe avec
   le code même de l'app (`pitch.ts`, `classifieur.ts`) : 30 points de contour en
   demi-tons, registre, indicateur de registre, durée, voisement ; trois conditions par
   syllabe (voix inconnue, voix calibrée sur cinq syllabes, voix entière). SHA-256 de
   `caracteristiques.json` : `9ad52ef894b84f8634c08809534d4655f0a84af5b06884fa4e0307ed5e2a4713`.
3. `entrainer.py` : validation croisée par locuteur (une voix de Taïwan contre l'autre),
   puis cinq membres entraînés sur les deux voix augmentées (excursion ×0,6 à ×1,5, bords
   rognés, bruit, durée ±30 %) et les contours paramétriques (scikit-learn,
   `MLPClassifier`, arrêt précoce) ; température choisie sur le développement.

Recette complète, hors CI (l'audio brut se télécharge à la main) :

```bash
mkdir -p data/work/tons/donnees/brut
# les deux dossiers d'Opus de Punpuf/shenzhen-mandarin-audio@a3617b7 dans brut/,
# et l'audio de hugolpz/audio-cmn dans brut/acmn/ pour le développement et le test
uv run --with pypinyin --with imageio-ffmpeg python data/sources/tons/preparer.py
cd app && npx vite-node scripts/tons/extraire.ts ../data/work/tons && cd ..
uv run --with numpy --with scikit-learn python data/sources/tons/entrainer.py
```

numpy, scikit-learn (BSD), pypinyin (MIT) et imageio-ffmpeg ne servent qu'à la recette :
ce ne sont pas des dépendances du pipeline, et rien d'eux n'est embarqué.

## Les mesures (étude du 29 septembre 2026)

Sur des voix natives absentes de l'entraînement, voix calibrée sur cinq syllabes :

| Jeu | Ton reconnu (décision hybride) | « reconnu » quand le ton est juste | autre ton affirmé à tort | on redemande |
|---|---|---|---|---|
| Chen Wang, syllabes isolées (développement) | 90,6 % | 87,4 % | 1,0 % | 11,6 % |
| Yue Tan, caractères isolés (test) | 88,5 % | 85,4 % | 2,4 % | 12,2 % |

Aucune voix d'apprenant n'a été mesurée ; les mots de deux syllabes ne sont reconnus qu'à
74 %. D'où les règles de l'app : caractères isolés seulement, jamais de note sur un échec,
au mieux « Bien » sur un ton reconnu.

## Retouche du suivi : la fin de la syllabe (29 septembre 2026)

Retour du propriétaire après l'essai sur iPhone : « Des fois, sur certains tons, le ton
détecté semble monter d'un coup à la fin. » Quand la voix s'éteint (souffle, voix
craquée, énergie qui chute), YIN prend un harmonique, un formant ou du bruit pour la
hauteur. `segmenter` nettoie désormais chaque syllabe (`pitch.ts`, `nettoyer`,
`FIN_DEFAUT`) : la fin est coupée tant que ses trames sont à plus de 15 dB sous le pic de
la syllabe ou d'apériodicité supérieure à 0,3 (30 % de la syllabe au plus) ; un aller et
retour de plus de 7 demi-tons est ramené à l'octave de ses voisines ; un saut final de plus
de 7 demi-tons vers l'aigu, sans retour, est écarté ; puis une médiane de trois points.
Les seuils sont posés a priori et vérifiés sur le développement (Chen Wang) ; **les poids
n'ont pas été réentraînés**.

Mesure avec le code de l'app, voix de test retéléchargées (`hugolpz/audio-cmn`), voix
calibrée comme dans l'étude. « Saut final » : une montée de plus de 5 demi-tons en 30 ms au
plus sur le dernier quart de la syllabe.

| Jeu | Ton en tête, avant → après | « reconnu » | autre ton affirmé à tort | Sauts finaux |
|---|---|---|---|---|
| Chen Wang (1 688, développement) | 90,6 → 91,4 % | 87,4 → 88,1 % | 1,0 → 0,5 % | 81 → 28 |
| Yue Tan, caractères (1 094, test) | 88,5 → 91,3 % | 85,1 → 88,6 % | 2,4 → 1,2 % | 28 → 1 |
| Kokoro `zf_001` (248) | 40,3 → 41,1 % | 34,3 → 35,5 % | 8,9 → 8,5 % | 0 → 0 |
| Syllabes synthétiques à friture vocale (60) | 61,7 → 68,3 % | 56,7 → 66,7 % | 18,3 → 15,0 % | 12 → 0 |

Les sauts restants de Chen Wang sont des fins de ton 2 qui montent de 5 à 7 demi-tons en
20 ou 30 ms, sous le seuil d'un saut d'octave. `pitch.test.ts` couvre une fin qui
s'éteint, une fin qui perd sa périodicité, un saut d'octave final, un aller et retour
d'octave, une montée rapide de ton 2 gardée, et une friture vocale.
