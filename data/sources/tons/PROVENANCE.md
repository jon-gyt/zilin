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
