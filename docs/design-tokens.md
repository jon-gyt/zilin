# Charte Zilin, tokens

Couleurs (clair) : papier #F4EEE2, carte #FBF7EE, encre #1F1B18, encre 2 #4A443E, brume #8B857C, trait #D9D1C2, indigo #2B4C7E (action, progression, briques de son), indigo doux #DCE3EF, cinabre #C8371F (élément ajouté, position, logo), cinabre doux #F6DED6, ocre #8C5A2B (briques de sens), ocre doux #EFE3D3, jade #5E8A6A (acquis), jade doux #DDE8DE.

Couleurs (sombre) : papier #1A1714, carte #241F1B, encre #EDE6D8, encre 2 #C9C1B3, brume #8E877D, trait #3A332C, indigo #8FA9D6, cinabre #E0553A, ocre #C89A6A, jade #8FB79A.

Typographie : Manrope 700 (titres, nom, chiffres), Manrope 500 (voix du guide), Source Sans 3 400 et 600 (interface, 17 px, interligne 1,45), Noto Serif SC 500 (mots et phrases). Grands caractères : rendu depuis les traits, style 楷, animation pinceau.

Logo : un Z tracé en un trait, point cinabre au-dessus (le point de 之). Icône App Store : mark encre sur papier.

Mascottes : Miao 苗 (pousse, quatre humeurs, réagit aux réponses), Que 雀 (moineau, remet les cadeaux).

Principes : un écran une action ; coins 12 px ; aucune ombre, aucun dégradé, aucun emoji, aucune illustration réaliste ; pas de doré ni de dragon.

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

Sous-ensemble chinois : les clés de `app/public/strokes-demo.json`, tous les caractères des listes `data/sources/listes/*.txt`, la ponctuation `。，、；：？！「」『』（）《》—…·` et les chiffres. La liste exacte est écrite dans `app/public/fonts/noto-serif-sc.subset.txt` à chaque régénération, pour que le fichier soit rejouable. Aujourd'hui 347 caractères, 61 Ko.

Les grands caractères restent rendus depuis les données de traits (style 楷) : aucune police n'est utilisée pour eux.

Sources, toutes sous SIL Open Font License 1.1, avec leur texte de licence copié tel quel à côté des woff2 (`OFL-Manrope.txt`, `OFL-SourceSans3.txt`, `OFL-NotoSerifSC.txt`) :

- Manrope, fonte variable `ofl/manrope/Manrope[wght].ttf` du dépôt `google/fonts`, © 2018 The Manrope Project Authors.
- Source Sans 3, archive OTF 3.052R publiée par `adobe-fonts/source-sans`, © 2010-2024 Adobe, nom de fonte réservé « Source ».
- Noto Serif SC, fonte variable `ofl/notoserifsc/NotoSerifSC[wght].ttf` du dépôt `google/fonts`, © 2012 Google Inc.

Pour régénérer :

```bash
cd data && uv run zilin fonts        # --force pour retélécharger les sources
```

La commande écrit les fichiers d'origine dans `data/work/fonts/` (ignoré par git) avec leurs SHA-256 et un journal de provenance, puis sous-ensemble et convertit avec fonttools. Le résultat est reproductible octet pour octet : relancer la commande sans changer les listes ne modifie pas le dépôt.
