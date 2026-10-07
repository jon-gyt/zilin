# Provenance des poids du classifieur des tons

Les poids de `modele.json` servent à la question « Dis-le » (story 9.1, brief §10,
« L'oral par IA ») : l'app reconnaît sur l'appareil le ton d'un caractère prononcé
(`app/src/lib/tons/`). Ils ont été appris le 29 septembre 2026, pendant l'étude de
faisabilité de la story, puis versés ici tels quels.

## Les poids

| Fichier | SHA-256 | Taille |
|---|---|---|
| `modele.json` | `eda572fdffacd3540c356b683e6a20167dc7e6c26fcc233c58697187181cf157` | 31,4 Ko, 3 225 paramètres |
| `modele-mots.json` (depuis le 7 octobre 2026, voir « L'adoption du modèle des mots ») | `1ebfc4fb195d40e67dae777188c3a43b58e175b4c990de84c0e9385d904c3f07` | 50,2 Ko, 5 625 paramètres |

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

  > 數位發展部 (ministère du Numérique de Taïwan), 2015 : CNS11643中文標準交換碼全字庫
  > (全字庫), fichiers sonores (全字庫聲音檔), jeu de données 5961 de data.gov.tw
  > (https://data.gov.tw/dataset/5961). 此開放資料依政府資料開放授權條款 (Open Government
  > Data License) 進行公眾釋出，使用者於遵守本條款各項規定之前提下，得利用之。 The Open Data
  > is made available to the public under the Open Government Data License, User can make
  > use of it when complying to the condition and obligation of its terms. Open Government
  > Data License : https://data.gov.tw/license

  Le premier alinéa de l'annexe (le fournisseur, l'année, le nom exact du jeu) vient de la
  fiche du jeu, lue le 1er octobre 2026 par l'étape `tons` du workflow `donnees`
  (`https://data.gov.tw/api/v2/rest/dataset/5961`, SHA-256
  `1a9c8b497707cf744fbeebe814e4e4165e058006c6aefb2274c5878a541866ac`) : titre
  « CNS11643中文標準交換碼全字庫(簡稱全字庫) », fournisseur 數位發展部, publié le
  2015-01-31, modifié le 2026-08-10 ; la ressource « 全字庫聲音檔 » (`Voice.zip`) est celle
  des syllabes ; licence au choix « 政府資料開放授權條款-第一版 » (retenue) ou OFL 1.1
  (pour les polices).
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

## Les mots de deux syllabes (30 septembre 2026)

La question « Dis-le » peut demander un mot de deux caractères acquis, pris dans les mots de
la fiche de la carte (`app/src/lib/tons/dire.ts`, `cibleDeMot`) : la voix est coupée en deux
syllabes, le ton de chacune reconnu, et l'app attend les tons que la voix fait, sandhi
appliqué (deux tons 3 de suite : le premier au ton 2 ; 不 devant un ton 4 : au ton 2) ; la
seconde syllabe peut être au ton neutre. **Les poids n'ont pas été réentraînés** : le
modèle des syllabes isolées sert tel quel, avec des réglages propres aux mots.

- **La découpe** (`pitch.ts`, `segmenter`, `creux`, `TROU_LIE`) : sans trou entre les deux
  syllabes, la coupe se fait au creux d'énergie le plus marqué entre deux crêtes ; devant une
  syllabe qui commence par une voix (m, n, l, r, y, w, une voyelle), un trou de moins de
  0,15 s n'est pas la frontière (c'est le creux craqué d'un ton 3).
- **Les réglages** (`classifieur.ts`, `REGLAGES_MOTS`) : une syllabe de mot est lue comme si
  elle durait 0,35 / 0,2 fois plus ; la référence de la voix est abaissée de 1 demi-ton pour
  la première syllabe et de 4 pour la seconde (la voix descend au fil du mot) ; le ton
  neutre n'est jamais entendu en tête, et sa probabilité est multipliée par 0,5 en seconde
  syllabe ; pour affirmer un autre ton sur un mot, l'app doit en être sûre à 0,98 (au lieu
  de 0,9), le ton attendu sous 1 % (au lieu de 5 %).

### Le jeu de mesure, jamais l'entraînement

Les mots de Yue Tan (`hugolpz/audio-cmn`, Shtooka `cmn-caen-tan`, **CC BY-SA**), par la
réédition `Punpuf/shenzhen-mandarin-audio`, commit
`a3617b73489a152f3a307ad3ef9fc67d1b8e1ed3`, dossier `words_opus_48k` (6 726 fichiers, arbre
git `546ce3301020eac980f13c29b5d92b91cfe1afbf`, manifeste
`17e28c660b1f6b53f3dddc2c3e28a791b733b1cbf99cfd4f794a2ebf367d93e0`). Retenus : les 6 070
mots de deux syllabes dont le nom de fichier donne le pinyin et qui ne commencent ni par
yi ni par bu (leur sandhi demande le caractère, que le nom ne donne pas), ni par un ton
neutre ; tons de surface : 3-3 lu 2-3 (186 mots). Deux moitiés par le hachage FNV-1a du
nom : « dev » (3 009 mots, réglages) et « test » (3 061, tenue à part). La voix est
calibrée comme dans l'app, sur 5 à 30 de ses caractères isolés tirés au hasard. Aucun poids
n'en dérive, rien n'en est distribué.

### La mesure, code de l'app, moitié test (3 061 mots)

| | avant (code du 29 septembre) | après |
|---|---|---|
| ton de chaque syllabe en tête | 75,2 % | 85,4 % |
| les deux tons en tête | 58,6 % | 73,7 % |
| **mot reconnu** (« Bien ») | 47,5 % | **67,5 %** |
| autre ton affirmé à tort | 7,6 % | 2,1 % |
| on redemande | 44,9 % | 30,4 % |
| reconnu à tort (un autre ton attendu sur une syllabe) | 2,3 % | 1,7 % |

Par ton, en tête, avant → après : première syllabe, ton 1 85,4 → 96,0, ton 2 76,0 → 83,1,
ton 3 (ou 2 de sandhi) 76,3 → 85,2, ton 4 85,3 → 94,7 ; seconde syllabe, ton 1 94,7 → 97,5,
ton 2 83,9 → 82,4, ton 3 46,7 → 43,0, ton 4 59,4 → 93,1, neutre 68,3 → 33,2. La moitié dev :
74,3 → 84,7 % des syllabes, 46,4 → 65,1 % des mots reconnus. Les caractères isolés ne
bougent pas (Chen Wang 88,3 %, Yue Tan 88,2 % reconnus, avant comme après). Le ton 3 en fin
de mot, souvent craqué ou à peine descendu, et le neutre restent les faiblesses.

Essai écarté : un second modèle appris sur des pseudo-mots faits de deux syllabes de
Taïwan mises bout à bout (même recette, `MLPClassifier`) ne reconnaît que 66,1 % des
syllabes du test (ton 3 en tête : 19 %).

### Le seuil, et la question éteinte

La question de mot ne se pose que si la mesure passe ces seuils (`dire.ts`,
`SEUILS_MOTS_DIRE`, `MESURE_MOTS_DIRE`, `MOTS_DIRE`) : un mot dit juste reconnu au moins
80 fois sur 100 (les caractères : 88 %), un autre ton affirmé à tort au plus 3 fois sur
100, un mot reconnu alors qu'on attend un autre ton au plus 3 fois sur 100. Mesuré le
30 septembre : 67,5 %, 2,1 %, 1,7 %. **La question de mot reste éteinte** ; le code, les
textes (`data/sources/ecrans/dire.tsv`) et les tests sont prêts, une meilleure mesure
l'allume. Les mots de la voix Kokoro de l'app (139) ne sont reconnus qu'à 10 % : ses
tons en contexte sont peu marqués.

## Les voix du continent : FLEURS (3 octobre 2026)

Accord du propriétaire du 3 octobre 2026 (« Oui stp ») : réentraîner le classifieur sur des
voix du mandarin du continent, en mêlant Taïwan et continent, et ne remplacer `modele.json`
que si la mesure s'améliore sans dégrader les caractères isolés. **Résultat : `modele.json`
n'est pas remplacé, `MOTS_DIRE` reste éteint.** Aucun poids versionné ne dérive de FLEURS ;
rien de FLEURS n'est embarqué ni exporté.

### La source

- FLEURS (Google ; Conneau et al., 2022, « FLEURS: Few-shot Learning Evaluation of Universal
  Representations of Speech », arXiv:2205.12446), langue `cmn_hans_cn` : des phrases de
  FLoRes lues par des locuteurs natifs du continent, transcrites en caractères simplifiés.
- Licence : **CC BY 4.0** (étiquette `license:cc-by-4.0` et « All datasets are licensed under
  the Creative Commons license (CC-BY) » de la carte du jeu, lue le 1er octobre 2026 par
  l'étape `tons` du workflow `donnees`, `huggingface.co/datasets/google/fleurs/raw/main/README.md`
  gardée sur la branche `donnees/tons`, `data/sources/tons/licences-lues/fleurs-carte.md`,
  SHA-256 `688f79f2a5c731af3796e9f683eb02f9b3f09d040decd8c5625d0f37098e71c6`). Usage
  commercial et poids dérivés permis, avec attribution. Si des poids en dérivaient un jour,
  l'attribution à exporter (`tons.py`, `LICENCES.md`) serait : « FLEURS (Google), Conneau et
  al. 2022, arXiv:2205.12446, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ » ;
  `entrainer.py --fleurs` l'écrit déjà dans le bloc de licence du modèle, et `wenlu check`
  refuse un tel modèle tant que `tons.py` ne l'exporte pas.
- La carte dit aussi : « Speakers of the train sets are different than speakers from the
  dev/test sets ». FLEURS ne donne pas d'identifiant de locuteur : `train` sert à
  l'entraînement, `dev` et `test` sont tenus à part.
- L'archive : `https://storage.googleapis.com/xtreme_translations/FLEURS102/cmn_hans_cn.tar.gz`,
  2 522 990 658 octets, SHA-256
  `0b412f291a8790db9226a1d4b69f811d5ace99cffae2a3df994a15af335190f3` (vérifiée le 3 octobre,
  puis effacée après extraction). WAV mono 16 kHz en flottants 32 bits. Transcriptions :
  `train.tsv` (3 246 lignes) `89c4a48ffaf2811bf64a4c38a65ccf436e4e46feaf1ba762ba137fc324532200`,
  `dev.tsv` (409) `6b4efd804b543048feb278db06f3b58b5ea171cdd4ba072e328ad630ca25384b`,
  `test.tsv` (945) `5734461648f816181d7dab5fc79204b18c4b9bc2cd5138225b25c72d18385d21`.

### Les syllabes préparées

1. **Le pinyin en contexte** (`fleurs.py`, testé par `data/tests/test_tons_fleurs.py`) : les
   mots de la liste HSK 3.0 du dépôt (`hsk-mots.tsv`) par le plus long appariement dans les
   deux sens, sinon la lecture du caractère quand la liste HSK et sa lecture courante
   (`pinyin.tsv`, sinon `kMandarin` d'Unihan) s'accordent sur un ton ; jamais CC-CEDICT. Le
   ton étiqueté est la réalisation attendue : 3-3 → 2-3 dans un mot (2-2-3 pour trois), rien
   entre deux mots ; 不 et 一 selon le ton qui suit (一 ordinal ou dans un nombre : 1) ; le
   neutre des mots de la liste et des particules (的, 们, 吗…). Les 4 600 phrases donnent
   3 061 phrases lisibles (1 537 portent des chiffres ou des lettres latines, 2 un 儿 hors d'un
   mot), 102 706 syllabes, dont 97 115 étiquetées (94,6 %). Limite : l'appariement peut
   prendre pour un mot deux caractères qui n'en font pas un (都会 dūhuì dans 一切都会好的,
   que les deux sens de lecture trouvent) ; ce bruit d'étiquette n'est pas mesuré.
   `fleurs-syllabes.json`, SHA-256
   `637e32cb483b8357c666723d6bc738688454e765db5024ab482f9d295b00d6fb`.
2. **Les trames** (`app/scripts/tons/trames.ts`) : le suivi de hauteur de l'app, réglé plus
   souple pour l'alignement (`SOUPLE` : apériodicité sous 0,5, plancher à 35 dB sous le pic).
   Avec les réglages de l'app, une phrase sur deux n'avait pas 57 % de sa parole voisée
   (72 % avec ces réglages : bruit de fond, micro d'ordinateur, voix soufflée), et les îlots
   ne suivaient plus les syllabes.
3. **L'alignement** (`aligner.py`, écrit ici, sans modèle acoustique ni outil tiers) : une
   programmation dynamique apparie les trous entre îlots voisés aux frontières des syllabes,
   en sachant le type de chaque attaque (p t k c ch q s sh x f h, et b d g z zh j coupent la
   voix ; m n l r, y w et les voyelles presque jamais) et les ponctuations ; une syllabe est
   sûre quand elle occupe seule un îlot, bornée par deux consonnes sourdes ou des pauses,
   d'une durée plausible, et que l'appariement tient sous sept variantes des coûts et du
   débit. 20 921 syllabes sûres (20,4 %), dont 20 047 étiquetées :

   | Partie | Phrases | Femmes / hommes | Syllabes | Ton 1 | Ton 2 | Ton 3 | Ton 4 | Neutre | Paires formant un mot HSK |
   |---|---|---|---|---|---|---|---|---|---|
   | `train` (entraînement) | 2 000 (985 textes) | 1 131 / 869 | 15 724 | 3 891 | 3 289 | 1 759 | 6 077 | 708 | 3 004 |
   | `dev` (tenu à part) | 246 | 86 / 160 | 1 159 | 293 | 268 | 161 | 375 | 62 | 192 |
   | `test` (tenu à part) | 579 | 175 / 404 | 3 164 | 761 | 725 | 358 | 1 190 | 130 | 480 |

   `corpus.json` (le corpus de l'étude, SHA-256 `162cda8e…4811`, et les entrées FLEURS) :
   `6534350ac6a1b25fda45f49f5bc4f24e8a2615d776ea2156d01d043f43f22c63`.
4. **Les caractéristiques** (`extraire.ts`, `extrait.ts`) : chaque syllabe sûre est un extrait
   de la phrase (l'îlot et la moitié des trous qui l'entourent), traité comme l'enregistrement
   d'un caractère, avec les réglages de l'app ; la voix de la phrase est la médiane de ses
   îlots. 19 609 syllabes ont une hauteur (15 460 de `train`). `caracteristiques.json` :
   `9663b2dc43a4533d766491d201970b55547173278c90a915241a1256f720328b`.

Contrôles de l'alignement : devant une syllabe sûre, le trou d'une consonne non aspirée dure
60 ms en médiane, celui d'une fricative ou d'une aspirée 100 ms ; décalé d'une syllabe, l'écart
disparaît (80 à 90 ms partout). Un perceptron appris sur les seules syllabes sûres de `train`
reconnaît 51 % de celles de `dev` et `test` (cinq tons ; ton 3 : 6 %). La voix y est brève :
0,11 s en médiane (0,35 s pour un caractère isolé), aussi brève qu'un ton neutre de Taïwan.
Deux essais écartés : les îlots du suivi de l'app tel quel (46 %, trous sans écart selon la
consonne) ; un compteur de noyaux d'énergie (à la manière de de Jong et Wempe, 2009), qui ne
comptait juste que 80 % des mots de deux syllabes de Yue Tan.

### Les mesures

Code de l'app (`app/scripts/tons/mesurer.ts`, protocole du 30 septembre, qu'il retrouve à
l'identique avec les poids versionnés), voix calibrée sur 5 à 30 syllabes. « En tête » : le ton
de plus forte probabilité ; « reconnu » : le verdict « juste » de l'app. Les syllabes de FLEURS
sont jugées seules, comme un caractère ; ses paires, comme un mot. Trois entraînements :
les poids versionnés ; Taïwan seul, réentraîné avec le même code (le témoin) ; Taïwan et
FLEURS `train` (la meilleure lecture : durée telle quelle, seulement avec la voix connue, sans
les neutres de FLEURS), avec trois graines.

| Jeu (voix jamais vue) | Poids versionnés | Taïwan seul | Taïwan + FLEURS (3 graines) |
|---|---|---|---|
| Chen Wang, syllabes (dév.), reconnu | 88,3 % | 86,1 % | 89,0 / 87,9 / 84,3 % |
| Chen Wang, ton 3 en tête | 91,2 % | 90,8 % | 89,1 / 85,1 / 79,9 % |
| Yue Tan, caractères (test), en tête | 90,6 % | 89,1 % | 92,3 / 91,4 / 89,3 % |
| Yue Tan, caractères, reconnu | 88,2 % | 84,9 % | 88,2 / 87,8 / 84,6 % |
| **Yue Tan, ton 3 en tête** | **92,4 %** | 88,2 % | **74,9 / 73,5 / 58,3 %** |
| Yue Tan, tons 1, 2, 4 en tête | 99,6, 79,4, 90,0 % | 99,6, 79,8, 87,9 % | 100, 94,7 à 97,4, 91,8 à 95,1 % |
| Yue Tan, mots (moitié test), reconnus | 67,5 % | 63,4 % | 68,0 / 68,6 / 69,0 % |
| — autre ton affirmé à tort | 2,1 % | 2,0 % | 3,6 / 3,4 / 2,7 % |
| — reconnu à tort | 1,7 % | 1,6 % | 1,5 / 1,4 / 1,2 % |
| — ton 3 final, neutre final, en tête | 43,0 %, 33,2 % | 49,4 %, 23,6 % | 41,4 à 46,2 %, 0 à 1 % |
| FLEURS `test`, syllabes, en tête | 16,3 % | 17,7 % | 45,6 / 45,2 / 45,0 % |
| — par ton (1, 2, 3, 4, neutre) | 5,5, 3,7, 5,9, 28,5, 66,9 % | 11,0, 2,9, 11,2, 28,4, 59,2 % | 57,8, 31,0, 25,7, 57,6, 0,8 % (graine 0) |
| FLEURS `test`, paires (mots), reconnues | 8,1 % | 8,1 % | 8,8 / 9,0 / 8,8 % |
| Kokoro, mots, autre ton affirmé à tort | 17,3 % | 10,1 % | 54,7 % (graine 0) |

Les autres lectures essayées (`entrainer.py --fleurs`, développement) ne font pas mieux :
durée de mot (× 0,35 / 0,2), durée rapportée au débit de la phrase, durée d'une syllabe de
Taïwan du même ton, 30 ou 50 % des phrases, le ton 3 de FLEURS en fin de groupe seulement ou
pas du tout. Le ton 3 des caractères de Yue Tan y tombe entre 56 et 85 %, sauf avec la durée
de Taïwan (87 à 91 %), qui perd alors le ton 1 de Chen Wang (85 % en tête au lieu de 96) et
les caractères reconnus (Chen Wang 80,6 à 86,0 %).

**Lecture.** Les syllabes de phrase enseignent bien la parole enchaînée (FLEURS : 16 → 45 %)
et les tons 2 et 4 des caractères ; mais leur ton 3 est un 21 bref, et leurs tons pleins durent
ce que dure un neutre : le modèle perd le ton 3 de citation (214) des caractères isolés,
précisément la faiblesse visée, et le neutre en fin de mot ; il affirme plus souvent un autre
ton à tort sur un mot (au-dessus du seuil de 3 %). La règle n'est pas remplie : **`modele.json`
reste celui du 29 septembre** (empreinte inchangée). Les mots restent sous le seuil (69,2 % au
mieux contre 80 %) : **`MOTS_DIRE` reste éteint.** Il faudrait, pour le continent, des
syllabes et des mots lus isolément (THCHS-30 et AISHELL-1 sont aussi des phrases).

### La recette du continent

```bash
# l'archive de FLEURS, vérifiée, extraite dans data/work/tons/donnees/brut/fleurs/
cd data && uv run python sources/tons/fleurs.py && cd ..
cd app && for k in 0 1 2 3; do npx vite-node scripts/tons/trames.ts ../data/work/tons $k 4 & done; wait; cd ..
uv run --with numpy python data/sources/tons/aligner.py
cd app && npx vite-node scripts/tons/extraire.ts ../data/work/tons && cd ..
uv run --with numpy --with scikit-learn python data/sources/tons/entrainer.py --sortie essai.json \
  --fleurs brut --fleurs-avec-voix --fleurs-sans-neutre
cd app && npx vite-node scripts/tons/mesurer.ts ../data/work/tons ../essai.json essai
```

`mesurer.ts` lit les trames des voix de mesure dans `data/work/tons/donnees/mesure/`
(`car.json`, `trames-car.json`, `mots-yt.json`, `trames-ytm.json`, du 30 septembre).

## Les voix synthétiques du continent : Kokoro (3 octobre 2026)

Après l'échec de FLEURS (des phrases, dont le ton 3 est un 21 bref), l'essai des syllabes et des
mots dits isolément par des voix du continent, synthétiques : Kokoro, déjà dans le pipeline.
**Résultat : `modele.json` n'est pas remplacé, `MOTS_DIRE` reste éteint.** Aucun poids versionné
ni exporté ne dérive de Kokoro ; aucun son n'est versionné.

### La source et la licence

- Modèle `hexgrad/Kokoro-82M-v1.1-zh`, **Apache 2.0** (code et poids ; carte du modèle
  `license: apache-2.0`, lue par le workflow `donnees` le 24 septembre 2026,
  `docs/sources-licences.md`), commit des poids servi par le cache Hugging Face du workflow :
  `01e7505bd6a7a2ac4975463114c3a7650a9f7218`.
- Les sorties sont produites chez nous, dans le workflow `donnees` (étape `tons-voix`). L'Apache
  2.0 régit le code et les poids, pas ce qu'ils produisent ; nous ne redistribuons ni l'un ni
  l'autre. Si des poids en dérivaient, ce serait au même titre que les contours paramétriques :
  une synthèse faite par nous (`entrainer.py --kokoro` l'écrit dans `licence.synthese_voix`),
  sans attribution exigée ; l'attribution exportée resterait celle de l'OGDL.

### La méthode

1. **Ce que Kokoro dit** (`voix_kokoro.py textes`, `kokoro-textes.json`, SHA-256
   `f4635fd427d02614e28db0422d28519a3dc42b6c57ff1de7bd16a9490fc3f2c7`) : 2 887 caractères des
   listes HSK 3.0 à une seule lecture pleine (la liste des mots HSK et la lecture courante du
   dépôt, `fleurs.Lexique.lectures`), aux quatre tons de citation (713, 671, 513, 990) ; 8 287
   mots HSK de deux syllabes, étiquetés par les règles de `fleurs.py` (`lire_groupe`, `surface`) :
   3-3 lu 2-3, 不 et 一 selon le ton qui suit, neutre de la liste ; écartés : un mot dont une
   syllabe reste sans étiquette (姐姐), un mot qui commence par un neutre. Jamais CC-CEDICT.
2. **En phonèmes, jamais en caractères** : Kokoro reçoit le pinyin étiqueté écrit comme le G2P
   de Kokoro v1.1 l'écrit (`misaki.zh_frontend`, zhuyin et chiffre du ton, syllabes d'un mot
   accolées), par `KPipeline.generate_from_tokens` : il ne choisit ni la lecture ni le sandhi.
   Contrôle : sur les 2 887 caractères et 8 287 mots, les phonèmes de `voix_kokoro.py` sont ceux
   de misaki 0.9.4 chaque fois que sa lecture est la nôtre (2 879 et 8 269 ; les autres sont des
   polyphones qu'il lit autrement, 了 le, 地 de…, et que nous imposons).
3. **Les voix** : 24 voix d'entraînement, 12 femmes et 12 hommes pris à pas réguliers parmi les
   100 voix chinoises du modèle (`zf_002`, `zf_006`, `zf_018`, `zf_023`, `zf_028`, `zf_039`,
   `zf_044`, `zf_049`, `zf_070`, `zf_076`, `zf_085`, `zf_093` ; `zm_009`, `zm_013`, `zm_020`,
   `zm_031`, `zm_037`, `zm_052`, `zm_056`, `zm_062`, `zm_066`, `zm_081`, `zm_095`, `zm_100`), et
   `zf_001`, la voix de l'app, pour le **test seulement** (`entrainer.py` la refuse). Chaque voix
   dit 400 caractères (100 par ton) et 400 mots (paires de tons équilibrées), tirés selon son
   nom ; vitesse tirée parmi 0,8, 0,9, 1, 1,1, 1,2, texte suivi ou non d'un point.
4. **Les caractéristiques** (`app/scripts/tons/voix.ts`, code de l'app) : `analyserTrames` tel
   que l'app l'appelle (frontière liée d'un mot, réglages des mots), sans voix, avec la voix
   calibrée sur cinq caractères et avec la voix entière. Workflow `donnees`, run 37156478268
   (synthèse, cinq lots en parallèle, 3 à 6 minutes par voix) et run 37160130665 (branche), commit
   `9c329fc` de `donnees/tons-voix`, dossier `data/sources/tons/voix-kokoro/` (25 fichiers, 12 Mo
   de JSON compact, aucun son ; manifeste `SHA256SUMS`, SHA-256
   `effc29f72482ca1c8f9c86701a8f3d5bb2d76789c71a3b394d2d5f528337a6c5`). Les 24 voix d'entraînement :
   9 495 syllabes de caractères et 19 028 syllabes de mots (191 énoncés sans découpe juste,
   surtout des voix d'hommes graves) ; `zf_001` : 400 caractères (`kz1`) et 400 mots (`kz2`).

### Ce que Kokoro dit vraiment

Le ton étiqueté est celui des phonèmes, mais Kokoro le réalise mal. Sur un caractère isolé, il
dit presque la même courbe quel que soit le ton : une montée brève puis une chute (contour moyen
du ton 1 : +0,6 → +1,2 → −2,0 demi-tons ; ton 2 : +0,6 → −0,5 ; ton 3 : +1,2 → −2,2 ; ton 4 :
+1,7 → −4,2), au même registre pour les quatre tons (écart à la voix : −0,1 à +0,2 demi-ton,
contre −4,7 à +5,0 chez les voix de Taïwan). Le ton 3 de citation (214) n'y est jamais. Un
perceptron appris sur 16 voix Kokoro et mesuré sur 8 autres ne reconnaît que 56,5 % de leurs
caractères (ton 3 : 37 %), 76 % des premières syllabes de mot et 49 % des secondes (ton 3 :
12 %) ; sur `zf_001`, 49, 59 et 34 %. Le neutre n'est pas plus bref qu'un ton plein (0,42 s).
Le modèle versionné lit 29 % des caractères Kokoro en tête (ton 2 : 5,5 %), comme les fichiers
de l'app (`kk1`, 35 %) : ce n'est pas le classifieur, c'est la voix.

### Les mesures

Code de l'app (`mesurer.ts`, protocole du 30 septembre ; il lit aussi `kz1`, `kz2` depuis
`donnees/mesure/zf_001-mesure.json`), voix calibrée sur 5 à 30 syllabes. « Taïwan » : le modèle
versionné (graine 0 : `entrainer.py` en redonne exactement les poids sur le corpus de l'étude) et le
même avec les graines 1 et 2. Kokoro : `entrainer.py --kokoro`, part des syllabes Kokoro tirées.

| Jeu (voix jamais vue) | Taïwan, graines 0 / 1 / 2 | + Kokoro 10 %, caractères (3 graines) | + Kokoro 3 %, caractères et mots (3 graines) |
|---|---|---|---|
| Chen Wang, syllabes (dév.), reconnu | **88,3** / 87,7 / 87,9 % | 85,2 / 85,8 / 85,8 % | 84,4 / 85,0 / 85,4 % |
| Yue Tan, caractères (test), en tête | 90,6 / 91,2 / 90,8 % | 92,0 / 91,4 / 91,9 % | 91,0 / 91,2 / 90,4 % |
| Yue Tan, caractères, reconnu | **88,2** / 88,9 / 87,9 % | 88,8 / 88,6 / 89,1 % | 88,0 / 88,5 / 87,8 % |
| **Yue Tan, ton 3 en tête** | **92,4** / 92,4 / 92,4 % | 90,5 / 91,5 / 90,5 % | 90,5 / 90,5 / 90,0 % |
| Yue Tan, mots (moitié test), reconnus | **67,5** / 67,4 / 66,8 % | 66,3 / 67,3 / 66,9 % | 66,4 / 66,1 / 66,1 % |
| — autre ton affirmé à tort | 2,1 / 2,4 / 2,1 % | 2,1 / 2,3 / 2,2 % | 1,7 / 1,5 / 1,7 % |
| — reconnu à tort | 1,7 / 1,6 / 1,7 % | 1,3 / 1,4 / 1,3 % | 1,5 / 1,5 / 1,3 % |
| `zf_001` en phonèmes, caractères (`kz1`), en tête | 33,5 / 35,0 / 33,5 % | 39,2 / 39,2 / 40,5 % | 29,5 / 32,2 / 29,5 % |
| — reconnus | 24,0 / 24,2 / 23,2 % | 25,5 / 28,0 / 29,8 % | 20,8 / 22,0 / 20,0 % |
| `zf_001` en phonèmes, mots (`kz2`), reconnus | 16,5 / 16,5 / 16,2 % | 15,5 / 16,8 / 15,8 % | 16,8 / 15,8 / 16,5 % |
| `zf_001`, fichiers de l'app (`kk1`), en tête | 35,1 / 37,5 / 38,3 % | 43,5 / 44,8 / 46,0 % | 28,2 / 31,5 / 29,8 % |

Les autres lectures (graine 0) font moins bien : Kokoro 10 % caractères et mots (Chen Wang 83,6 %,
ton 3 de Yue Tan 91,5 %, mots 64,1 %), Kokoro entier (75,8 %, 91,0 %, 60,6 %), mots seuls 25 %
(79,1 %, 90,5 %, 64,2 %), mots seuls 10 % avec la voix connue (81,5 %, 90,5 %, 63,7 %). (`kk1`
bouge un peu d'une mesure à l'autre depuis que `kz1` partage sa voix : la référence de `zf_001`
mêle les deux.)

**Lecture.** La règle d'adoption, la même que pour FLEURS, n'est remplie par aucune variante :
le ton 3 des caractères de Yue Tan régresse toujours (92,4 → 90,0 à 91,5 %), les caractères
reconnus de Chen Wang aussi (88,3 → 75,8 à 85,8 %), et les mots ne progressent pas (67,5 →
60,6 à 67,3 %). Seuls les caractères reconnus de Yue Tan gagnent un peu (jusqu'à 89,1 %), et le
neutre de Kokoro n'apprend rien. **`modele.json` reste celui du 29 septembre** (empreinte
inchangée), **`MOTS_DIRE` reste éteint** (67,5 % contre 80 %). Kokoro ne dit pas les tons d'un
caractère isolé ; ce qu'il manque reste des voix humaines du continent, syllabes et mots isolés,
sous une licence sans partage à l'identique.

### La recette des voix synthétiques

```bash
cd data && uv run python sources/tons/voix_kokoro.py textes   # après wenlu tout ; kokoro-textes.json
# workflow donnees, etapes: tons-voix (lots: 5) ; artefacts: <run> pour ne refaire que la branche
git fetch origin donnees/tons-voix
mkdir -p data/work/tons/voix-kokoro
git archive origin/donnees/tons-voix data/sources/tons/voix-kokoro | tar -x -C data/work/tons/voix-kokoro --strip-components=4
cp data/work/tons/voix-kokoro/zf_001-mesure.json data/work/tons/donnees/mesure/
uv run --project data --with numpy --with scikit-learn python data/sources/tons/entrainer.py --sortie essai.json \
  --kokoro data/work/tons/voix-kokoro --part-kokoro 0.1 --genres-kokoro c
cd app && npx vite-node scripts/tons/mesurer.ts ../data/work/tons ../essai.json essai
```

## Les voix humaines sous CC BY-SA (3 et 4 octobre 2026)

Décision du propriétaire du 3 octobre 2026 (« Voix CC BY-SA ») : entraîner le classifieur sur de
vraies voix humaines du continent, sous CC BY-SA (ou CC BY, CC0), qui disent des caractères et des
mots isolés ; en contrepartie, les poids passent sous CC BY-SA 4.0 avec l'attribution de chaque
source, le code de l'app restant propriétaire. Règle d'adoption : sur les voix tenues à part, le
ton 3 des caractères de Yue Tan ne régresse pas (92,4 %), les caractères reconnus ne baissent pas,
et l'autre ton affirmé à tort sur les mots reste au plus à 3 %. **Résultat : la règle n'est pas
remplie, `modele.json` n'est pas remplacé (empreinte inchangée), `MOTS_DIRE` reste éteint.** Aucun
poids versionné ni exporté ne dérive de ces voix ; `tons.json` reste sous le régime de l'OGDL. Tout
est prêt pour qu'un modèle qui en dériverait soit attribué et contrôlé (`tons.py`, `VOIX_CC`).

### Les sources, la licence lue fichier par fichier

Le poste de développement n'atteint ni Commons, ni Lingua Libre, ni Shtooka : l'étape `tons-cc`
du workflow `donnees` (`voix_cc.py inventaire`) lit les pages et les garde, avec leur SHA-256, sur
la branche `donnees/tons-cc` (`data/sources/tons/licences-lues/`, `SHA256SUMS-tons-cc.txt`) ; runs
37163862432 (inventaire, Chen Wang et Yue Tan) et 37164449685 (inventaire, voix de Lingua Libre),
commit `59e5ac9` de la branche.

| Voix | Source | Licence lue (version) | Page lue (SHA-256) | Retenu | Rôle |
|---|---|---|---|---|---|
| Yue Tan | Shtooka `cmn-caen-tan`, « Collection audio libre de mots chinois (mandarins) enregistrée par l'université de Caen », MP3 de `hugolpz/audio-cmn@ff9ed3d` (`64k/hsk/`) | **CC BY-SA 3.0 United States**, « Copyright (c) 2009 Yue Tan » | `readme.txt` de la collection par l'Internet Archive (`web.archive.org/web/2024id_/http://packs.shtooka.net/cmn-caen-tan/readme.txt`, `11584998…f95b` ; packs.shtooka.net ne répond plus) | 1 634 caractères, 5 121 mots | entraînement (pli CW et modèle final) ; mesure (pli YT) |
| Chen Wang | `hugolpz/audio-cmn@ff9ed3d`, `64k/syllabs/` (syllabes v0.2) | « CC-by-sa », **version non précisée** | `README.md` d'audio-cmn (`dc2d9244…4200`), seule page qui la dise, écrite par le dépositaire ; aucune page sur Commons (recherche gardée) | 1 688 syllabes | **mesure seulement** (licence douteuse) |
| Fake estate (Lingua Libre `Q812770`) | Commons, `LL-Q9192 (cmn)-Fake estate-…` | **CC BY-SA 4.0** (modèle `{{cc-by-sa-4.0}}` et `extmetadata`, chaque fichier) | `commons-lingualibre-cmn.jsonl` (`a629f198…80bc`) ; fiche Lingua Libre par l'Internet Archive : mandarin langue maternelle, teochew (`ee5d2881…f15e`) | 98 caractères, 973 mots | entraînement |
| CanonNi (`Q1431140`) | idem | **CC0 1.0** (`{{cc-zero}}`) | idem ; fiche : mandarin langue maternelle, résidence Q8686 (Shanghai) (`02f88c6f…bb8a96`) | 109 caractères, 573 mots | entraînement |
| Jouketou (`Q1332695`) | idem | **CC BY-SA 4.0** | idem ; fiche non lue (Lingua Libre refuse le runner, l'Internet Archive n'a pas répondu) | 166 caractères, 268 mots | entraînement |
| Luilui6666 (`Q301531`) | idem | **CC BY-SA 4.0** (et CC0) | idem ; page Commons : boîtes `zh-N` et `yue-N` (`commons-locuteurs.json`, `b3cb8b05…3951`) | 119 caractères, 189 mots | entraînement |

- **Lingua Libre** : 4 126 fichiers `cmn` (catégories « Lingua Libre pronunciation-cmn » et
  « -zho »), toutes leurs licences lues : CC BY-SA 4.0, CC0, CC BY 4.0 ; aucun NC ni ND. Lingua
  Libre refuse le runner (`api.php` : 403 ; `Special:EntityData` : 426) : les fiches des locuteurs
  n'ont été lues que par l'Internet Archive, pour deux d'entre eux. Écartés : 779 fichiers de
  locuteurs non retenus (apprenants déclarés : Assassas77 `zh-2`, Yug `zh-3` ; lecteurs de Taïwan :
  Levi Highway, Shangkuanlc, Cookai1205, graphies traditionnelles, élément « mandarin de Taïwan »,
  `{{User Taiwan}}` ; voix de moins de 30 fichiers ; fichiers sans locuteur nommé), 852 textes sans
  étiquette sûre (plus de deux caractères, chiffres, lettres, caractère à plusieurs lectures, mot
  hors de la liste HSK). « Du continent » n'est attesté que pour CanonNi (Shanghai) ; Fake estate
  (teochew), Jouketou et Luilui6666 lisent en caractères simplifiés, sans résidence lue.
- **Shtooka** : le catalogue archivé (`packs.shtooka.net`) n'a pas d'autre collection `cmn` que
  celle de Yue Tan ; les fichiers `Zh-*.ogg` de Commons sont la même voix.
- **`hugolpz/audio-cmn`** n'a que ces deux voix (README, tableau « Voices »).
- **Version de la CC BY-SA** : la 3.0 United States (§4 b) permet de placer une œuvre adaptée sous
  « a later version of this License with the same License Elements » : la 4.0 International ; une
  CC BY-SA 4.0 (§3 b) et une CC0 aussi. Les poids qui dériveraient de ces voix seraient donc sous
  **CC BY-SA 4.0**, texte dans `data/sources/licences/CC-BY-SA-4.0.txt`
  (`spdx/license-list-data@31ba1a5`, SHA-256
  `cde7883b9050a1104f4ac19a1572aafd6e5d7323b68351aaf51fbf4beba54966`), copié dans l'export.
- **Chen Wang** : « CC-by-sa » sans version ; aucune autre page ne la précise. Une attribution
  CC exige le nom ou l'adresse de la licence : la voix reste à la mesure, jamais à l'entraînement
  (`voix_cc.py`, rôle `test` ; `lignes_cc` refuse une licence sans version ; `tons.VOIX_CC` ne
  la recense pas). À lever par une question au dépositaire (Hugo Lopez, INALCO) ou à Chen Wang.

### Les étiquettes et les caractéristiques

- **Le choix** (`voix_cc.py choisir`, sur le poste) : `data/sources/tons/voix-cc.json`, SHA-256
  `5168bf6ea2bbb74c194c99f9bcc703d4eba2feadd7814ced25e84657d148e01b` : chaque fichier retenu, son
  empreinte (blob git d'audio-cmn, sha1 de Commons), sa licence, son étiquette. Le pinyin vient
  de la liste HSK et des lectures du dépôt (`fleurs.Lexique`), jamais de CC-CEDICT : un caractère
  n'est gardé que s'il n'a qu'une lecture pleine (`voix_kokoro.lecture_unique`) ; un mot de deux
  caractères de la liste HSK porte le ton que la voix fait (`voix_kokoro.etiqueter_mot`, règles de
  `fleurs.py` : 3-3 lu 2-3, 不 et 一 selon le ton qui suit, neutre de la liste) ; un mot qui
  commence par un neutre est écarté. Chen Wang : la syllabe du nom de fichier (ce qu'elle a lu).
- **L'audio** (`voix_cc.py telecharger`, workflow) : chaque fichier vérifié par son empreinte, sa
  licence relue dans l'inventaire du même passage, décodé en WAV mono 16 kHz, jamais versionné.
  Tout a été téléchargé : 6 755 énoncés de Yue Tan, 1 688 de Chen Wang, 2 494 des quatre voix de
  Lingua Libre.
- **Les caractéristiques** (`app/scripts/tons/voix.ts --modele`, code de l'app, comme pour Kokoro) :
  `voix-cc/<voix>.json` sur `donnees/tons-cc` (manifeste `SHA256SUMS`, SHA-256
  `2352748c4d47425f834d8c2d3ee6a22390dcf880eecc4d2471722d7bbf447e54`), avec le verdict des poids
  versionnés pour chaque énoncé. Syllabes gardées (ni manquées, ni à redemander) : Yue Tan 10 917,
  Fake estate 1 451, Jouketou 545, CanonNi 501, Luilui6666 425.
- Les voix de Lingua Libre sont des voix d'hommes graves (90 à 110 Hz, sauf Luilui6666, 221 Hz),
  enregistrées vite : beaucoup de syllabes trop brèves (« court ») ; les poids versionnés n'y
  reconnaissent en tête que 53 à 80 % des caractères (Yue Tan : 90 %).

### La validation croisée par locuteur

`entrainer.py --voix-cc <dossier> --sans-voix <voix>` : la voix mesurée n'est jamais entraînée.
Pli **YT** : Taïwan et les quatre voix de Lingua Libre, mesuré sur Yue Tan (caractères, mots de la
moitié test) et sur Chen Wang. Pli **CW** : Taïwan, Yue Tan et Lingua Libre (la configuration d'un
modèle final), mesuré sur Chen Wang (les chiffres de Yue Tan y sont ceux d'une voix entraînée, sans
valeur). Code de l'app (`mesurer.ts`, protocole du 30 septembre), voix calibrée sur 5 à 30
syllabes ; graines 0, 1, 2 ; « actuel » : Taïwan seul, le modèle versionné en graine 0. La
température est choisie sur Chen Wang (0,7 au pli YT, 0,6 au pli CW).

| Jeu tenu à part (graines 0 / 1 / 2) | Actuel (Taïwan) | Pli YT, voix CC entières | Pli YT, caractères CC seuls | Pli CW, voix CC entières | Pli CW, caractères CC seuls |
|---|---|---|---|---|---|
| **Yue Tan, ton 3 en tête** | **92,4 / 92,4 / 92,4** | **89,6 / 90,5 / 88,6** | **93,4 / 90,5 / 91,5** | — | — |
| Yue Tan, caractères en tête | 90,6 / 91,2 / 90,8 | 93,7 / 94,3 / 93,5 | 93,0 / 92,9 / 91,5 | — | — |
| Yue Tan, caractères reconnus | 88,2 / 88,9 / 87,9 | 90,6 / 91,0 / 90,4 | 89,6 / 89,5 / 89,3 | — | — |
| Yue Tan, mots (test) reconnus | 67,5 / 67,4 / 66,8 | 68,6 / 68,5 / 68,5 | 67,0 / 67,1 / 67,2 | — | — |
| — autre ton affirmé à tort | 2,1 / 2,4 / 2,1 | 2,7 / 2,7 / 2,8 | 2,4 / **3,1** / 2,3 | — | — |
| — reconnu à tort | 1,7 / 1,6 / 1,7 | 1,1 / 1,2 / 1,3 | 1,7 / 1,7 / 1,7 | — | — |
| — ton 3 final, neutre final, en tête | 43,0 / 33,2 % (g0) | 38,4 / 18,8 % (g0) | 43,5 / 23,1 % (g0) | — | — |
| Chen Wang, reconnus | 88,3 / 87,7 / 87,9 | 89,2 / 89,1 / 88,4 | 91,2 / 89,7 / 90,0 | 88,7 / 88,2 / 88,7 | 91,5 / 91,6 / 91,4 |
| Chen Wang, ton 3 en tête | 91,2 / 91,9 / 91,7 | 92,9 / 91,5 / 92,2 | 93,4 / 91,7 / 91,9 | 93,1 / 94,1 / 92,9 | 93,6 / 93,8 / 93,6 |
| Chen Wang, autre ton affirmé à tort | 0,4 / 0,3 / 0,4 | 0,7 / 0,9 / 0,7 | 0,6 / 0,4 / 0,6 | 0,7 / 0,6 / 0,6 | 0,6 / 0,3 / 0,5 |

**Lecture.** Les voix humaines du continent font mieux que FLEURS et Kokoro : sur les deux voix
tenues à part, les caractères reconnus montent (Yue Tan 88,4 → 89,5 à 90,6 % en moyenne, Chen Wang
88,0 → 88,5 à 91,5 %), les mots de Yue Tan un peu (67,2 → 68,5 %). Mais la règle n'est remplie
par aucune variante : le ton 3 des caractères de Yue Tan, tenue à part, régresse (92,4 → 89,6 % en
moyenne avec les voix entières ; 91,8 % avec les seuls caractères, dont une graine à 90,5 %), et
l'autre ton affirmé à tort sur les mots passe 3 % sur une graine (3,1 %). Les quatre voix de Lingua
Libre pèsent peu (2 900 syllabes, voix graves, syllabes brèves, ton 3 souvent mal réalisé : les
poids versionnés n'en reconnaissent que 0 à 59 % en tête) ; Yue Tan, la seule grande voix sous
licence vérifiée, ne peut pas être à la fois entraînée et la mesure du ton 3. **`modele.json`
reste celui du 29 septembre ; `MOTS_DIRE` reste éteint** (68,6 % au mieux contre 80 %). Seules ces
deux variantes ont été essayées, posées avant de lire la mesure (la seconde d'après la leçon de
FLEURS : un ton 3 dans un mot n'est pas le 214 de citation) ; aucune n'a été retenue sur la mesure.

Pour aller plus loin : d'autres voix du continent qui lisent des caractères isolés, sous licence
lue (lever la licence de Chen Wang ; d'autres locuteurs natifs sur Lingua Libre, dont les fiches
soient lisibles) ; une troisième voix tenue à part pour pouvoir entraîner Yue Tan et mesurer le
ton 3 ailleurs.

### La recette des voix CC

```bash
# workflow donnees, etapes: tons-cc (inventaire, puis audio et caractéristiques si voix-cc.json)
git fetch origin donnees/tons-cc
git archive -o cc.tar origin/donnees/tons-cc data/sources/tons/licences-lues data/sources/tons/voix-cc
mkdir -p data/work/tons/cc-branche && tar -xf cc.tar -C data/work/tons/cc-branche
# le choix, sur le poste (après wenlu tout) : l'arbre d'audio-cmn au commit lu
git clone --filter=blob:none --no-checkout https://github.com/hugolpz/audio-cmn acmn
git -C acmn -c core.quotepath=off ls-tree -r ff9ed3d0c631195bd2c06f39450f3264c7124040 64k/syllabs 64k/hsk > arbre.txt
cd data && uv run python sources/tons/voix_cc.py choisir --arbre ../arbre.txt \
  --lues work/tons/cc-branche/data/sources/tons/licences-lues && cd ..
# la validation croisée (pli YT ; pli CW : --sans-voix cc-chen-wang), graines 0, 1, 2
cp -r data/work/tons/cc-branche/data/sources/tons/voix-cc data/work/tons/voix-cc
uv run --project data --with numpy --with scikit-learn python data/sources/tons/entrainer.py --sans-validation \
  --graine 0 --sortie essai.json --voix-cc data/work/tons/voix-cc --sans-voix cc-yue-tan [--genres-cc c]
cd app && npx vite-node scripts/tons/mesurer.ts ../data/work/tons ../essai.json essai
```

Un modèle appris ainsi déclare chaque voix dans son bloc de licence (`cle`, licence, version) et se
dit sous CC BY-SA 4.0 ; `wenlu check` le refuse si une voix n'est pas recensée dans
`tons.VOIX_CC` (attribution exportée), si sa licence est NC, ND ou sans version, ou si les poids ne
se disent pas sous CC BY-SA 4.0 ; `wenlu export` écrirait alors dans `tons.json` la licence, son
lien, `CC-BY-SA-4.0.txt` à côté, et l'attribution de chaque source (`attributions`), l'OGDL en tête.

## Le profil de tons du mot entier (4 au 7 octobre 2026)

Décision du propriétaire du 4 octobre 2026 (« Revoir la méthode des mots ») : quelles que soient
les voix ajoutées, les mots plafonnaient à 68-69 % parce que chaque syllabe d'un mot était jugée
comme un caractère isolé. Reconnaître plutôt le **profil de tons du mot entier** (19 profils :
4 × 4 tons pleins, et le neutre en seconde syllabe ; 3-3 étiqueté 2-3 ; 不 et 一 étiquetés par le
ton dit), avec deux variantes : **libre**, sans aucune source CC BY-SA, adoptable tout de suite ;
**CC BY-SA**, dont les poids iraient dans un fichier à part, en attendant l'avis juridique sur le
DRM de l'App Store. Règle d'adoption : mots tenus à part reconnus à 80 % au moins, autre ton
affirmé à tort à 3 % au plus, caractères isolés inchangés. **Résultat : aucune variante ne
remplit la règle (77,6 % et 79,0 % des mots de Yue Tan tenue à part). Rien ne change dans le
produit : `modele.json` (empreinte inchangée) et sa notation restent tels quels, aucun modèle des
mots n'est versionné ni exporté, `MOTS_DIRE` reste éteint, aucun fichier sous CC BY-SA n'est
préparé.** La méthode est dans le code de l'app, testée, non branchée. Le même jour, la décision
du propriétaire « Brancher à 77,6 % » a adopté la variante libre au seuil de 77 % : voir
« L'adoption du modèle des mots », plus bas.

### La méthode

- **Les entrées du mot** (`app/src/lib/tons/profil.ts`, `entreesMot`, 38 nombres) : les deux
  syllabes que `segmenter` découpe (frontière liée comprise, comme l'app), chacune avec sa forme
  (15 points, la moyenne de deux des 30 points du contour), sa hauteur face à la voix calibrée
  comme dans l'app (0 si la voix n'est pas encore connue), sa durée et son voisement ; puis la
  voix connue ou non, et la hauteur de la seconde syllabe face à la première (lisible même sans
  voix).
- **Le modèle des mots** : trois perceptrons (38-32-19, ReLU, softmax), moyenne de leurs
  probabilités, 5 625 paramètres, 50 Ko de JSON (format `wenlu-tons-mots`), exécuté en
  TypeScript (`probabilitesProfils`).
- **Le mélange** (`probabilitesMot`) : la probabilité d'un profil est proportionnelle à
  (modèle des mots)^0,5 × p(ton de la syllabe 1) × p(ton de la syllabe 2), ces deux dernières
  données par le modèle des caractères tel quel (`probabilitesSyllabe`, réglages des mots du
  30 septembre). Seul, un modèle des mots ne lit que 42 à 57 % des profils de la moitié dev selon
  ses sources : il corrige le modèle des caractères, il ne le remplace pas.
- **Le jugement** (`jugerMot`, « conforme ou autre profil, lequel ») : le profil attendu est
  reconnu dès que sa probabilité atteint 0,4, même talonné ; un autre profil n'est affirmé que
  sûr à 0,98, l'attendu sous 1 % ; on redemande sinon. Une syllabe brève n'est plus une raison de
  redemander (le neutre est bref) : seulement une découpe manquée, une syllabe sans voix ou
  voisée à moins de 50 %, un son saturé. Le verdict de chaque syllabe en découle, pour les
  phrases de `messageDireMot` (seule la syllabe qui diffère est nommée).
- **Dans l'app** : `analyserTrames` et `analyser` prennent le modèle des mots en dernier
  paramètre (`modeleMots`), absent par défaut ; `jugerContours` juge des syllabes déjà
  découpées (la mesure s'en sert). Un caractère isolé est toujours jugé par le seul modèle des
  caractères ; sans modèle des mots, un mot l'est syllabe par syllabe, comme le 30 septembre.
  `Dire.svelte` ne le passe pas : rien ne change à l'écran. `profil.test.ts` couvre une règle
  par test.

### Les données, et la contrainte de licence

`app/scripts/tons/mots.ts` écrit les entrées de chaque mot avec le code de l'app
(`data/work/tons/mots/entrees-mots.json`, SHA-256
`7d50826c05d9b58c490836bc68910721c48f0380bef449d73d9bcc9f97eed018`), dans trois conditions (sans
voix, voix calibrée sur cinq caractères, voix entière), et les probabilités des syllabes selon le
modèle des caractères :

- les voix dont `voix.ts` a gardé les syllabes (`voix-kokoro/`, manifeste `effc29f7…c6f5`,
  branche `donnees/tons-voix` ; `voix-cc/`, manifeste `2352748c…7e54`, branche `donnees/tons-cc`) :
  le contour de chaque syllabe est rebâti tel que l'app le voit (`rebatir.ts` : la forme `x`, la
  hauteur `rc` ou `ro` moins la déclinaison des réglages des mots, la durée, le voisement) ;
  rebâtis ainsi, les mots de Lingua Libre retrouvent exactement les verdicts que `voix.ts` avait
  notés avec les poids versionnés ;
- les pseudo-mots des deux voix de Taïwan (OGDL 1.0) : deux syllabes isolées de la même voix,
  trames bout à bout, comprimées au débit d'un mot, le ton 3 coupé après son creux (en tête
  trois fois sur quatre, en fin une fois sur deux), le neutre bref posé à la hauteur que lui
  donne le ton qui précède, puis `segmenter` (8 000 par voix ; trames `trames-tw.json` du
  30 septembre) ;
- la moitié dev des mots de Yue Tan, pour les réglages ; la moitié test n'est lue que par
  `mesurer.ts`.

| Source | Licence | Mots | Variante libre | Variante CC BY-SA |
|---|---|---|---|---|
| Kokoro, 24 voix (`zf_001` tenue à part) | sorties produites chez nous (Apache 2.0 pour le modèle) | 9 514 | oui | oui |
| CanonNi (Lingua Libre) | CC0 1.0 | 557 | oui (× 5) | oui (× 5) |
| Pseudo-mots de Taïwan | OGDL 1.0 | 16 000 | permis, écartés par le développement | idem |
| Yue Tan (Shtooka, HSK d'audio-cmn) | CC BY-SA 3.0 US | 5 093 | **refusé** | oui (× 5), sauf au pli YT |
| Fake estate, Jouketou, Luilui6666 | CC BY-SA 4.0 | 972, 267, 187 | **refusé** | oui (× 5) |

`data/sources/tons/entrainer_mots.py` refuse toute source CC BY-SA dans la variante libre
(`sources_libres`, et une garde qui lève une erreur si l'une s'y glisse), toute licence NC, ND ou
sans version dans la variante CC BY-SA (`tons.licence_refusee`), la voix de l'app, une voix
tenue à part, un mot saturé. Son bloc de licence déclare chaque voix par sa clé de
`tons.VOIX_CC` : un modèle CC BY-SA s'y dit sous CC BY-SA 4.0, et `tons.fautes_licence` et
`tons.attributions` le relisent comme `modele.json` (`data/tests/test_tons_mots.py`).

### Le développement (moitié dev des mots de Yue Tan, 3 009 mots)

Tout a été choisi là, avant la moindre mesure du test : les sources, le poids des voix humaines,
la taille, le mélange, les seuils, la règle des syllabes brèves. Ce que le développement a montré :

- le modèle des mots seul ne transfère pas d'une voix à l'autre : 42 % des profils en tête appris
  sur les pseudo-mots de Taïwan, 45 % sur Kokoro, 52 % sur les deux ; empilé sur les probabilités
  des syllabes, 52 à 57 % ;
- les pseudo-mots de Taïwan nuisent : aucun réglage ne tient les contraintes (autre ton à tort
  ≤ 2 %, reconnu à tort ≤ 2,5 % sur la moitié dev) quand le modèle des mots n'apprend qu'eux ;
  écartés de la variante libre ;
- le produit des deux syllabes, jugé sur le profil (seuil 0,35 sans exiger la tête), reconnaît
  déjà 72,2 % des mots (65,1 % syllabe par syllabe) ;
- le mélange avec un modèle des mots appris sur Kokoro et CanonNi : 76,1 à 77,3 % ; sur Kokoro
  et les quatre voix de Lingua Libre (variante CC BY-SA, pli YT) : 78,7 à 79,6 % ; les voix
  humaines, même peu nombreuses et graves, comptent le plus.

Avec le code de l'app (`mesurer.ts`, `SANS_TEST=1`), voix calibrée sur 5 à 30 caractères : libre
76,1 / 77,1 / 76,1 % reconnus, 1,9 à 2,0 % d'autre ton à tort, 2,7 à 2,8 % reconnus à tort ;
CC BY-SA sans Yue Tan 77,6 / 77,6 / 77,8 %, 1,7 à 1,9 %, 2,6 %.

### La mesure : validation croisée par locuteur, trois graines

Protocole fixé avant le test : variante libre (Kokoro et CanonNi) mesurée sur la moitié test de
Yue Tan et sur les trois voix de Lingua Libre qu'elle n'a jamais vues, et sans CanonNi sur
CanonNi ; variante CC BY-SA sans Yue Tan sur Yue Tan, et sans chaque voix de Lingua Libre sur
cette voix (Yue Tan entraînée alors). Graines 0, 1, 2. La règle se lit sur Yue Tan, voix de
référence de `MESURE_MOTS_DIRE` (chaque graine : reconnus ≥ 80 %, autre ton à tort ≤ 3 %,
reconnus à tort ≤ 3 %) ; sur chaque voix de Lingua Libre, ni moins de mots reconnus ni plus
d'autres tons affirmés à tort que la méthode actuelle. « Actuel » : les poids versionnés,
syllabe par syllabe (protocole du 30 septembre, retrouvé à l'identique : 67,5 %, 2,1 %, 1,7 %).

| Voix tenue à part (mots) | | Actuel | Libre (graines 0 / 1 / 2) | CC BY-SA (graines 0 / 1 / 2) |
|---|---|---|---|---|
| **Yue Tan, moitié test (3 061)** | **reconnus** | 67,5 | **77,6 / 77,8 / 77,4** | **78,9 / 79,1 / 79,1** |
| | autre ton à tort | 2,1 | 1,9 / 2,1 / 1,9 | 1,9 / 1,8 / 1,9 |
| | reconnus à tort | 1,7 | 2,5 / 2,4 / 2,6 | 2,3 / 2,3 / 2,4 |
| | profil en tête | 73,7 | 76,4 / 76,5 / 76,0 | 77,6 / 77,6 / 77,4 |
| Fake estate (973) | reconnus | 23,1 | 37,1 / 37,4 / 37,2 | 38,5 / 39,7 / 38,8 |
| | autre ton à tort | 8,4 | 4,2 / 4,1 / 4,3 | 5,2 / 5,0 / 5,3 |
| | reconnus à tort | 3,3 | 6,0 / 5,7 / 5,4 | 5,5 / 5,2 / 5,7 |
| Jouketou (267) | reconnus | 37,5 | 51,3 / 51,7 / 51,7 | 54,3 / 55,4 / 53,6 |
| | autre ton à tort | 5,6 | 4,9 / 5,2 / 5,2 | 6,4 / 6,7 / 6,0 |
| | reconnus à tort | 3,7 | 6,7 / 6,4 / 6,0 | 5,6 / 6,0 / 6,4 |
| Luilui6666 (189) | reconnus | 40,2 | 48,1 / 47,1 / 48,1 | 50,3 / 50,3 / 50,3 |
| | autre ton à tort | 9,5 | 8,5 / 9,5 / 8,5 | 8,5 / 9,0 / 7,9 |
| | reconnus à tort | 3,2 | 7,4 / 7,9 / 7,4 | 5,3 / 5,8 / 5,3 |
| CanonNi (573) | reconnus | 14,0 | 34,0 / 34,6 / 34,6 (sans CanonNi) | 34,0 / 35,3 / 35,1 |
| | autre ton à tort | 3,7 | 9,6 / 9,4 / 8,7 | 9,2 / 10,5 / 9,6 |
| | reconnus à tort | 1,4 | 5,6 / 5,8 / 5,8 | 5,6 / 6,3 / 5,6 |
| Caractères : Chen Wang (1 688), Yue Tan (1 094) | reconnus | 88,3, 88,2 | 88,3, 88,2 | 88,3, 88,2 |

Sur Yue Tan, en tête par place et par ton (graine 0, actuel → libre → CC BY-SA) : première
syllabe ton 2 83,1 → 87,8 → 87,6 %, ton 3 (ou 2 de sandhi) 85,2 → 92,9 → 91,9 % ; seconde
syllabe ton 3 43,0 → 43,2 → 44,9 %, neutre 33,2 → 28,8 → 32,2 %.

**Lecture.** Juger le mot sur son profil gagne dix points sur Yue Tan tenue à part (67,5 →
77,6 % sans aucune source CC BY-SA, 79,0 % avec), sans affirmer plus souvent un autre ton : le
plus gros du gain vient du jugement « conforme » (la probabilité du profil attendu, au lieu de
deux syllabes sûres chacune) et des syllabes brèves qu'on ne redemande plus (moitié dev : 65,1 →
72,2 %) ; le modèle des mots en ajoute quatre à six. Mais **la règle n'est remplie par aucune variante** : 77,6 % et 79,0 %
contre 80 % ; sur les voix de Lingua Libre, plus de mots reconnus partout, mais les reconnus à
tort montent (1,4–3,7 → 5,2–7,9 %), et sur CanonNi l'autre ton affirmé à tort aussi (3,7 →
8,7–10,5 %). Le ton 3 et le neutre en fin de mot restent la faiblesse (43–45 % et 29–32 % en
tête) : aucune source d'entraînement libre ne les dit comme une voix humaine du continent
(Kokoro les réalise mal, les pseudo-mots de Taïwan les déforment). Selon la décision : **rien ne
change dans le produit, `MOTS_DIRE` reste éteint, aucun fichier `tons-mots.json` n'est écrit,
sous aucune licence.** Ce qui manque : des mots de deux syllabes dits par des voix humaines du
continent sous une licence sans partage à l'identique (ou l'avis juridique sur la CC BY-SA, qui
ne suffirait d'ailleurs pas ici : 79,0 %).

### La recette du profil des mots

```bash
# les branches donnees/tons-cc et donnees/tons-voix (recettes ci-dessus), et les trames de mesure
# du 30 septembre dans data/work/tons/donnees/mesure/ (car.json, trames-car.json, mots-yt.json,
# trames-ytm.json, tw.json, trames-tw.json, zf_001-mesure.json)
mkdir -p data/work/tons/voix-cc data/work/tons/voix-kokoro
git archive origin/donnees/tons-cc data/sources/tons/voix-cc | tar -x -C data/work/tons/voix-cc --strip-components=4
git archive origin/donnees/tons-voix data/sources/tons/voix-kokoro | tar -x -C data/work/tons/voix-kokoro --strip-components=4
cd app && npx vite-node scripts/tons/mots.ts ../data/work/tons 8000 1 && cd ..
uv run --project data --with numpy --with scikit-learn python data/sources/tons/entrainer_mots.py \
  --variante libre --graine 0 --sortie mots-libre-g0.json            # pli CanonNi : --sans-voix cc-ll-Q1431140
uv run --project data --with numpy --with scikit-learn python data/sources/tons/entrainer_mots.py \
  --variante cc --sans-voix cc-yue-tan --graine 0 --sortie mots-cc-g0.json   # ou --sans-voix cc-ll-…
cd app && SANS_TEST=1 npx vite-node scripts/tons/mesurer.ts ../data/work/tons - dev ../mots-libre-g0.json   # réglages
npx vite-node scripts/tons/mesurer.ts ../data/work/tons - test ../mots-libre-g0.json                         # mesure
```

`mesurer.ts` mesure aussi les mots des voix de Lingua Libre (`ll-<voix>`), rebâtis de `voix-cc/`
et jugés par `jugerContours`, avec ou sans modèle des mots.

## L'adoption du modèle des mots (7 octobre 2026)

Décision du propriétaire du 7 octobre 2026 (« Brancher à 77,6 % ») : allumer la question de mot
de « Dis-le » avec la **variante libre** du modèle des mots (Kokoro et CanonNi, **sans aucune
source CC BY-SA**), et abaisser le seuil d'adoption des mots de 80 % à **77 %** de mots reconnus ;
l'autre ton affirmé à tort reste à 3 % au plus, le reconnu à tort aussi. Le propriétaire a été
prévenu du risque : sur les voix de Lingua Libre, un mot dit à un autre ton est reconnu à tort
dans 5 à 8 % des cas (tableau ci-dessus). **Résultat : `modele-mots.json` est versionné, exporté
dans `tons-mots.json`, branché dans l'app, et `MOTS_DIRE` est allumé.** `modele.json` ne change
pas (empreinte `eda572fd…f157`), ni la notation des caractères isolés.

### Le modèle final

- Recette et réglages de la section précédente, sans rien retoucher : `entrainer_mots.py
  --variante libre --graine 0` (graine 0, comme pour `modele.json`), sur
  `mots/entrees-mots.json` rebâti le 7 octobre par `mots.ts ../data/work/tons 8000 1` depuis les
  branches `donnees/tons-voix` (manifeste `effc29f7…c6f5`) et `donnees/tons-cc` (manifeste
  `2352748c…7e54`) et les trames de mesure du 30 septembre : SHA-256
  `7d50826c05d9b58c490836bc68910721c48f0380bef449d73d9bcc9f97eed018`, le même que pendant l'essai.
- `data/sources/tons/modele-mots.json` : SHA-256
  `1ebfc4fb195d40e67dae777188c3a43b58e175b4c990de84c0e9385d904c3f07`, 51 430 octets, 5 625
  paramètres, format `wenlu-tons-mots`, version `0.1.0-2026-10-07` ; 10 071 mots de 25 voix
  (24 voix Kokoro, `zf_001` exclue ; CanonNi, 557 mots, `voix-cc/cc-ll-Q1431140.json` SHA-256
  `269b21b7f3452efb9c0e91dea97f12c6219b2b37051a11ce762ddedecd968555`).
- Reproductible : deux entraînements à la suite redonnent ce fichier octet pour octet ; le modèle
  d'essai de l'après-midi resté dans le bloc-notes (`cc --sans-voix cc-ll-Q1332695 --graine 0`,
  SHA-256 `a19e16d0…e798`) est lui aussi redonné à l'identique. Le modèle libre de graine 0 de
  l'essai n'avait pas été gardé : sa mesure, elle, est retrouvée chiffre pour chiffre (ci-dessous).

### La licence et l'attribution

- Les poids restent **propriétaires** (Wenlu). Ils dérivent de mots dits par Kokoro
  (`hexgrad/Kokoro-82M-v1.1-zh`, Apache 2.0 sur le code et les poids du modèle ; les sorties sont
  produites par nous, dans le workflow `donnees`, et ni le code ni les poids de Kokoro ne sont
  redistribués) et de la voix de CanonNi (Lingua Libre, **CC0 1.0**, `{{cc-zero}}` lu fichier par
  fichier). Aucune attribution n'est exigée ; elle est donnée par courtoisie, pour les deux.
- `wenlu export` écrit `tons-mots.json` à part (clé `tonsMots` de l'index) : la licence,
  `attributions` (Kokoro, puis CanonNi), puis les poids tels quels ; `LICENCES.md` en porte les
  deux lignes. `tons.json` est inchangé.
- `wenlu check` (`tons.controles_mots`) refuse le modèle des mots s'il n'a pas la forme que l'app
  lit, s'il n'est pas la variante libre, si une source y est sous CC BY-SA (déclarée ou recensée
  ainsi dans `tons.VOIX_CC`), si une voix apprise n'est pas déclarée, si `zf_001` y est, si
  `PROVENANCE.md` ne porte pas son empreinte, ou si l'export n'en porte pas les poids, la licence
  et l'attribution (`data/tests/test_tons_mots.py`).

### La mesure de contrôle (code de l'app, `mesurer.ts`, protocole du 30 septembre)

`npx vite-node scripts/tons/mesurer.ts ../data/work/tons - final-libre-g0 <modele-mots.json>`,
voix calibrée sur 5 à 30 syllabes ; « actuel » : la méthode syllabe par syllabe, remesurée le même
jour.

| Voix (mots) | | Actuel | Modèle final (libre, graine 0) |
|---|---|---|---|
| **Yue Tan, moitié test (3 061), tenue à part** | **reconnus** | 67,5 % | **77,6 %** |
| | autre ton affirmé à tort | 2,1 % | **1,9 %** |
| | reconnus à tort | 1,7 % | 2,5 % |
| | profil en tête | 73,7 % | 76,4 % |
| Yue Tan, moitié dev (3 009) | reconnus | 65,1 % | 76,3 % |
| Fake estate (973), tenue à part | reconnus, autre à tort, reconnus à tort | 23,1 ; 8,4 ; 3,3 % | 37,1 ; 4,2 ; 6,0 % |
| Jouketou (267), tenue à part | idem | 37,5 ; 5,6 ; 3,7 % | 51,3 ; 4,9 ; 6,7 % |
| Luilui6666 (189), tenue à part | idem | 40,2 ; 9,5 ; 3,2 % | 48,1 ; 8,5 ; 7,4 % |
| CanonNi (573), **apprise** | idem | 14,0 ; 3,7 ; 1,4 % | 36,6 ; 8,4 ; 5,6 % (tenue à part, graine 0 : 34,0 ; 9,6 ; 5,6 %) |
| Kokoro `zf_001` en phonèmes (`kz2`, 400) | idem | 16,5 ; 12,0 ; 2,5 % | 22,8 ; 2,0 ; 4,5 % |
| Caractères : Chen Wang (1 688), Yue Tan (1 094) | reconnus | 88,3 %, 88,2 % | 88,3 %, 88,2 % (mêmes verdicts) |

Les seuils de la décision sont passés sur Yue Tan, voix de référence : 77,6 % ≥ 77 %, 1,9 % ≤ 3 %,
2,5 % ≤ 3 % ; ce sont exactement les chiffres de la graine 0 de l'essai (77,6 ; 1,9 ; 2,5). Les
caractères isolés (`cw`, `yt1`, `kk1`, `kz1`) ne bougent d'aucun chiffre : un caractère est
toujours jugé par le seul `modele.json`.

**Risque connu**, accepté par la décision : sur les voix de Lingua Libre (hommes graves,
syllabes brèves), un mot dit à un autre ton est reconnu à tort dans 5,6 à 7,4 % des cas (contre
1,4 à 3,7 % syllabe par syllabe), et sur CanonNi et Luilui6666 un autre ton est affirmé à tort
8 à 10 % du temps. Le ton 3 et le neutre en fin de mot restent la faiblesse (43,2 % et 28,8 % en
tête sur Yue Tan). L'app n'en note jamais rien de faux : un « autre ton » ne note rien et
redemande, et « Bien » reste le mieux qu'un mot reconnu puisse valoir.

### Dans l'app

- `app/src/lib/tons/modele.ts` (`modeleMotsOnce`) lit `tons-mots.json` que l'index nomme ;
  `Dire.svelte` le passe à `analyser`, qui juge un mot sur son profil (`profil.ts`) ; un caractère
  isolé est toujours jugé par le seul modèle des caractères, avec ou sans lui.
- `dire.ts` : `SEUILS_MOTS_DIRE` passe à 77 % de mots reconnus (décision du 7 octobre 2026),
  `MESURE_MOTS_DIRE` porte la mesure du modèle final (77,6 ; 1,9 ; 2,5 %), et `MOTS_DIRE`
  s'allume ; la séance ne demande un mot que si le modèle des mots est là (`motsPossibles`).
