# Charte Zilin, tokens

Couleurs (clair) : papier #F4EEE2, carte #FBF7EE, encre #1F1B18, encre 2 #4A443E, brume #8B857C, trait #D9D1C2, indigo #2B4C7E (action, progression, briques de son), indigo doux #DCE3EF, cinabre #C8371F (élément ajouté, position, logo), cinabre doux #F6DED6, ocre #8C5A2B (briques de sens), ocre doux #EFE3D3, jade #5E8A6A (acquis), jade doux #DDE8DE.

Couleurs (sombre) : papier #1A1714, carte #241F1B, encre #EDE6D8, encre 2 #C9C1B3, brume #8E877D, trait #3A332C, indigo #8FA9D6, cinabre #E0553A, ocre #C89A6A, jade #8FB79A.

Typographie : Manrope 700 (titres, nom, chiffres), Manrope 500 (voix du guide), Source Sans 3 400 et 600 (interface, 17 px, interligne 1,45), Noto Serif SC 500 (mots et phrases). Grands caractères : rendu depuis les traits, style 楷, animation pinceau.

Logo : un Z tracé en un trait, point cinabre au-dessus (le point de 之). Icône App Store : mark encre sur papier.

Mascottes : Tao 桃 (graine de pêcher, grandit, adopte la posture de l'activité en cours, réagit aux réponses, s'ennuie de la répétition, ne culpabilise jamais), Que 雀 (moineau, remet les cadeaux de la série). Fleurs de Tao : rose #E7A2B4, seul rose autorisé.

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

## Estampes

Chaque anecdote du pas Ouvrir porte une petite image, l'estampe, au-dessus du caractère au pinceau. Fichiers dans `app/public/data/demo/estampes/`, un par caractère d'anecdote (`estampes/<caractère>.svg`), référencés par le champ `estampe` de `anecdotes.json`.

Règles du dessin :

- SVG vectoriel, monochrome, en traits d'encre : `currentColor`, `stroke-width="6"` déclarée une seule fois sur la racine, bouts et jointures arrondis. Épaisseur constante : aucun enfant ne redéfinit l'épaisseur, et aucune transformation d'échelle (une rotation est permise, elle garde le trait).
- Format carré, `viewBox="0 0 240 240"`, marge d'au moins 8 unités. Le motif doit rester lisible à 120 px.
- Un seul motif clair par anecdote : l'objet ou le geste que raconte le texte.
- Aucune couleur écrite en dur. À côté de l'encre, au plus un aplat très pâle en `var(--ocre-soft)` ou `var(--jade-soft)`, jamais autre chose.
- Jamais de cinabre, de doré, de dégradé, d'ombre, de visage réaliste, de dragon, d'emoji.
- Pas de police : aucun `<text>`. Quand l'anecdote parle d'un caractère collé (福 sur la porte, 囍 des mariages), le caractère est dessiné trait par trait.
- Pas de script, pas de `<style>`, aucun renvoi hors de l'app (`href`, `url()`). Moins de 4 Ko.

Mode sombre : le SVG est posé **en ligne** dans la page (`fetch` de l'asset puis `{@html}`, après contrôle que le chemin est bien `estampes/<fichier>.svg` et que le contenu ne porte ni script ni renvoi extérieur, voir `app/src/lib/estampe.ts`). Une balise `<img>` ne reçoit pas le `currentColor` de la page : il aurait fallu un filtre d'inversion, qui fausse aussi l'aplat pâle. En ligne, l'encre suit `--ink` et l'aplat suit son token : rien à inverser. Les `.svg` sont précachés par le service worker (`globPatterns` de `vite.config.ts`).

| Caractère | Motif |
|---|---|
| 福 | le caractère collé à l'envers, en losange, sur une porte à deux battants |
| 四 | un immeuble dont il manque un étage |
| 钟 | une horloge nouée d'un ruban de cadeau |
| 红 | l'enveloppe du Nouvel An et son médaillon |
| 姓 | le livre cousu des cent vieux noms |
| 茶 | la tasse servie et deux doigts pliés qui tapotent la table |
| 龙 | le nuage, la pluie, l'eau où vit le dragon (aucun dragon dessiné) |
| 面 | le masque d'opéra tenu par ses cordons |
| 筷 | les baguettes couchées sur leur porte-baguettes, à côté du bol |
| 岁 | le calendrier, un jour entouré |
| 春 | le train du retour |
| 喜 | 囍 collé sur le papier des mariages |
