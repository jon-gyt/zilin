# Charte Wenlu, tokens

Un seul thème : le papier clair. Ni mode sombre, ni réglage de thème ; les fêtes repeignent l'app quelques jours par an (voir « Thèmes de fête »), et les vingt-quatre termes solaires teintent à peine le papier le reste de l'année (voir « Ambiances des termes solaires »).

Couleurs : papier #F4EEE2, carte #FBF7EE, encre #1F1B18, encre 2 #4A443E, brume #8B857C, trait #D9D1C2, filet #CFC6B5 (`--rule`), grille #C9BBA3 (`--grille`, pointillés du 米字格), indigo #2B4C7E (action, progression, briques de son), indigo doux #DCE3EF, cinabre #C8371F (élément ajouté, position, logo), cinabre doux #F6DED6, ocre #8C5A2B (briques de sens), ocre doux #EFE3D3, jade #5E8A6A (acquis), jade doux #DDE8DE.

Bouton principal : `--act` #2B4C7E (l'indigo) et `--act-ink` #F4EEE2. `.btn` les lit ; une fête les change.

Cases du menu : `--tile-bg` (`var(--card)`), `--tile-fg` (`var(--indigo)`, le caractère de la case), `--tile-ink` (`var(--ink)`, le titre), `--tile-ink2` (`var(--ink2)`, la ligne d'état), `--tile-bd` (`transparent`, la bordure). Les quatre pigments de la peinture chinoise, un par case, pour l'écran qui les veut : 石青 azurite `--t1` #1E5A8A sur #DCE7F1, 藤黄 gomme-gutte `--t2` #9A6300 sur #F5E5BE, 桃红 rouge de pêcher `--t3` #A8506B sur #F6E0E6, 石绿 malachite `--t4` #1F7A5A sur #D5EADF (`--tN-bg`).

Grain du papier : `--grain` (bruit fractal en SVG, jamais un dégradé) à l'opacité `--grain-o` (.05).

Typographie : Manrope 700 (titres, nom, chiffres), Manrope 500 (voix du guide), Source Sans 3 400 et 600 (interface, 17 px, interligne 1,45), Noto Serif SC 500 (mots et phrases). Grands caractères : rendu depuis les traits, style 楷, animation pinceau.

Logo : 文 tracé depuis les données de traits de l'export (jamais une police), le point 丶 (trait 0) en cinabre, le reste à l'encre (`app/src/lib/Marque.svelte`). Icône App Store : la même marque, encre sur papier (`app/scripts/icons.mjs`).

Mascottes : Tao 桃 (graine de pêcher, grandit, adopte la posture de l'activité en cours, réagit aux réponses, s'ennuie de la répétition, ne culpabilise jamais), Que 雀 (moineau, remet les cadeaux de la série). Fleurs de Tao : rose #E7A2B4, seul rose autorisé.

Principes : un écran une action ; coins 12 px ; aucune ombre, aucun dégradé, aucun emoji, aucune illustration réaliste ; pas de doré ni de dragon.

## Thèmes de fête

`App.svelte` pose `data-fete` sur `<html>` quand la journée tombe dans la fenêtre d'une fête de `fetes.json` ; les blocs `[data-fete="…"]` de `tokens.css`, un par fête, repeignent l'app. `fetes.poserFete` pose aussi le `--paper` de la fête sur la meta `theme-color`, et rend la valeur d'origine après. Le même attribut sur un élément ne repeint que lui : `Embleme` et `Voeu` le portent, et gardent leurs couleurs même hors d'une page en fête.

春节, le Nouvel An lunaire (du réveillon −1 au 14e jour, +13) : papier #F7ECDD, carte #FCF4E8, trait #E5D6C0, filet #D9C6AA, grille #D4BE9C ; rouge de fête `--fete` #9E1F2A et son encre #FBEBD8, abricot `--apricot` #E3A33B (aplat), prunier #F2B8C6 et #FBE3E8 ; cases `--tile-bg` #A3222B, caractère #FBEBD8, titre #FFF4E6, ligne #F4CDAE ; bouton `--act` #2A1D1A, encre #FBEBD8 ; pigments 松 pin #2F6B4F, rouge #9E1F2A, prunier #B0456A, bambou #5E7A2E.

中秋, la mi-automne (−3 à +1), toujours de nuit : papier #141B2E, carte #1D2640, encre #F1E9D6, encre 2 #C9C3B4, brume #8F97AD, trait #2E3856, filet #3A4566, grille #46527A ; indigo #A9BEE6, cinabre #EC6B4B (éclairci pour la nuit ; sur la lune, le caractère garde le cinabre #C8371F et l'encre de nuit `--nuit` #18203A), ocre #C89A6A, jade #8FC0A0 ; lune `--moon` #F3E3B5 et son ombre #DCC792, osmanthe `--gui` #E9B949, collines #1A2238 et #202A45, lanternes célestes #F6C36A ; cases `--tile-bg` #1B2440 bordées de #34405F, caractère #F3E3B5 ; bouton `--act` #F3E3B5 (la lune), encre #141B2E ; gabarit du tracé `--guide` #46527A ; grain clair.

元宵, la fête des Lanternes (son jour) : papier #F8EBD7, carte #FDF4E7 ; rouge de fête `--fete` #9E1F2A pour les lanternes, abricot #E3A33B, papier des devinettes `--mi` #F6DFA4 et son encre #7A4A2E ; cases #F5DDB9, caractère #9E1F2A ; bouton #2A1D1A.

清明 (−1 à +1) : papier #EDF1EA, carte #F7F9F4 ; saule #7FA36A et #58804D, pluie #8FA7AB, cerf-volant #1E5A8A et sa queue #A8506B ; disque de l'emblème #DFEADB ; cases #DFEADF, caractère #3F6B4E ; bouton #2F4F3E.

端午, la fête des bateaux (−2 à +1) : papier #F2EFE2, carte #FAF8EF ; eau #3E7C8C et #A9CBCF, roseau #4F7F3F et #9DBF7A, ficelle #C9A46A, armoise #6F8F5E, bateau #8C5A2B et sa bande #1E5A8A ; disque #E2ECD6 ; cases #2F5E46, caractère #F6F2E2 ; bouton #1F2A22.

七夕 (−2 au soir même), toujours de nuit : papier #1B1B35, carte #252547, encre #EFE9F5, cinabre éclairci #EC6B4B ; Voie lactée #262650 et #302F5E, étoiles #F4E9C8, pies #0E0E24 et leur blanc #DCD6EC ; disque de l'emblème #E8E2F3, sa Voie lactée #D6CDEA, le caractère à l'encre #1B1B35 et au vrai cinabre ; cases #242449 bordées de #3A3969 ; bouton #E6DDF5 ; gabarit du tracé #4B4978.

重阳, le double neuf (−1 à +1) : papier #F5EEDF, carte #FCF7EC ; chrysanthème #E39A34, #F2CB78 et son cœur #9A5A17 (aplats, jamais un doré), montagne #A9A993 et #C9C8B2, oies #6B6558 ; cases #F3E2BD, caractère #8A5A12 ; bouton #3B3326.

冬至, le solstice d'hiver (−1 à +1) : papier #ECF0F4, carte #F8FAFC ; neige #FFFFFF et #C3CFDB, bol #2E4A6B, collines #F7F9FB et #DDE4EB ; disque #DCE5EE ; cases #DCE5EE, caractère #2E4A6B ; bouton #24364F.

Le rouge de fête #9E1F2A ne sert qu'au décor du Nouvel An et de 元宵 : la rosace, les lanternes, les cases et le 福. Il ne remplace jamais le cinabre, qui marque l'élément ajouté et la position. Décision du propriétaire, en attente de l'amendement de CLAUDE.md.

## Ambiances des termes solaires

Les jours sans fête, `App.svelte` pose `data-saison` sur `<html>` d'après le terme solaire qui court (`saisons.json`, un terme tous les quinze jours environ). Les vingt-quatre termes sont regroupés en huit ambiances de trois termes consécutifs ; chacune a son bloc `[data-saison="…"]` dans `tokens.css`. Un jour de fête, `fetes.poserFete` retire l'attribut : la fête a priorité, et 清明 comme 冬至, qui sont aussi des termes, gardent leur thème de fête. La meta `theme-color` prend le `--paper` de l'ambiance.

Plus légères que les fêtes, et une seule palette papier : seuls le papier, la carte et la grille du 米字格 changent, à peine teintés ; l'encre, les cases, le bouton et le cinabre restent ceux de tous les jours. Ni nuit, ni rouge, ni doré. Les autres variables (`--s-…`) ne colorent que le petit décor.

| Ambiance | Termes | Papier | Carte | Grille | Décor |
|---|---|---|---|---|---|
| `pecher` | 立春, 雨水, 惊蛰 | #F6EEE6 | #FCF7F2 | #D3BFAE | pétales de pêcher #EFC1CD et #F8DDE4 |
| `pluie` | 春分, 清明, 谷雨 | #EFF1EA | #F8F9F4 | #C1CBBE | pluie fine #8FA7AB, rare et pâle |
| `duvet` | 立夏, 小满, 芒种 | #F3F1E3 | #FBFAF1 | #CDC7A8 | duvet des saules #FFFFFF, fils #B9B39A |
| `lucioles` | 夏至, 小暑, 大暑 | #F0F1E2 | #F9FAF0 | #C6C9A6 | lucioles #A9BC3C, herbe #C5D0A4 |
| `rosee` | 立秋, 处暑, 白露 | #F1F0E8 | #FAF9F4 | #C9C6B3 | brins d'herbe #A9B68F, rosée #9DB9C6 |
| `feuilles` | 秋分, 寒露, 霜降 | #F5EDE1 | #FCF7EE | #D4C3A4 | feuilles #C98B4A, #D9A95E, #A9763F |
| `neige` | 立冬, 小雪, 大雪 | #EEF1F3 | #F9FAFB | #BFC9D2 | flocons #FFFFFF et #C3CFDB |
| `prunier` | 冬至, 小寒, 大寒 | #F2EFEC | #FAF8F6 | #CBC3BC | branche #5B4A42, fleurs #F3D3DA, cœur #B97480, flocons |

Le décor d'ambiance vit dans `FeteDecor.svelte`, dans le même calque que celui des fêtes (derrière tout, jamais cliquable, coupé par `prefers-reduced-motion`) : moins d'éléments, plus petits et plus pâles. Le caractère, le nom et la ligne de chaque terme lui restent propres : l'en-tête du menu montre, sous la marque, le caractère du terme dessiné depuis ses traits, son nom et sa traduction (« 半 秋分 · l'équinoxe d'automne ») ; un jour de fête, c'est le vœu.

Composants : `FeteDecor.svelte` (le calque derrière tout, `pointer-events: none`, coupé par `prefers-reduced-motion`), `Embleme.svelte` (la rosace, la lanterne, la lune… qui porte le caractère du jour), `Voeu.svelte` (le vœu de l'en-tête, prononcé au toucher, avec son dessin). Tao porte un flocon au Nouvel An, un bol de 汤圆 à 元宵, un brin de saule à 清明, un 粽子 à 端午, une étoile à 七夕, un gâteau de lune à la mi-automne, un chrysanthème à 重阳, un 饺子 à 冬至.

## Polices

Auto-hébergées en woff2 dans `app/public/fonts/`, versionnées avec l'app. Aucune requête réseau à l'exécution : pas de Google Fonts. Les `@font-face` sont en tête de `app/src/lib/tokens.css`, en `font-display: swap`, avec des URL `/fonts/…` que Vite réécrit selon `BASE_PATH` (`/zilin/fonts/…` en production). `vite-plugin-pwa` précache les cinq fichiers. `app/index.html` précharge les deux plus critiques au premier rendu : `source-sans-3-400.woff2` (tout le texte d'interface) et `manrope-700.woff2` (titres et logotype).

| Fichier | Famille CSS | Graisse | Usage | Sous-ensemble |
|---|---|---|---|---|
| `manrope-500.woff2` | Manrope | 500 | voix du guide | latin étendu |
| `manrope-700.woff2` | Manrope | 700 | titres, nom, chiffres | latin étendu |
| `source-sans-3-400.woff2` | Source Sans 3 | 400 | interface | latin étendu |
| `source-sans-3-600.woff2` | Source Sans 3 | 600 | interface, libellés | latin étendu |
| `noto-serif-sc-500.woff2` | Noto Serif SC | 500 | mots et phrases chinois | caractères utilisés |

Sous-ensemble latin étendu : Latin-1 imprimable et Latin Extended-A, guillemets français, apostrophes et guillemets courbes, tirets, espaces fines et insécables, points de suspension, symboles courants.

Sous-ensemble chinois : les clés de `app/public/strokes-demo.json`, tous les caractères des listes `data/sources/listes/*.txt`, la ponctuation `。，、；：？！「」『』（）《》—…·` et les chiffres. La liste exacte est écrite dans `app/public/fonts/noto-serif-sc.subset.txt` à chaque régénération, pour que le fichier soit rejouable. Aujourd'hui 585 caractères, 94 Ko.

Les grands caractères restent rendus depuis les données de traits (style 楷) : aucune police n'est utilisée pour eux.

Sources, toutes sous SIL Open Font License 1.1, avec leur texte de licence copié tel quel à côté des woff2 (`OFL-Manrope.txt`, `OFL-SourceSans3.txt`, `OFL-NotoSerifSC.txt`) :

- Manrope, fonte variable `ofl/manrope/Manrope[wght].ttf` du dépôt `google/fonts`, © 2018 The Manrope Project Authors.
- Source Sans 3, archive OTF 3.052R publiée par `adobe-fonts/source-sans`, © 2010-2024 Adobe, nom de fonte réservé « Source ».
- Noto Serif SC, fonte variable `ofl/notoserifsc/NotoSerifSC[wght].ttf` du dépôt `google/fonts`, © 2012 Google Inc.

Pour régénérer :

```bash
cd data && uv run wenlu fonts        # --force pour retélécharger les sources
```

La commande écrit les fichiers d'origine dans `data/work/fonts/` (ignoré par git) avec leurs SHA-256 et un journal de provenance, puis sous-ensemble et convertit avec fonttools. Le résultat est reproductible octet pour octet : relancer la commande sans changer les listes ne modifie pas le dépôt.
