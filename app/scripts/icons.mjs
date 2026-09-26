/**
 * Icônes de l'app, engendrées depuis la marque Wenlu.
 *
 * La marque : le caractère 文, encre sur papier, son premier trait (le point 丶) en
 * cinabre. Comme tout grand caractère de l'app, il est dessiné depuis les données de
 * traits (style 楷), jamais depuis une police : le script lit les tracés de 文 dans
 * l'export versionné que l'app sert (`public/data/<version>/traits/`, version lue dans
 * `src/lib/content.ts`), les mêmes que `src/lib/Marque.svelte` affiche.
 *
 * Ces tracés viennent de Make Me a Hanzi (`graphics.txt`), sous Arphic Public License :
 * le favicon, qui les recopie en vectoriel, le dit dans un commentaire et renvoie au
 * texte de la licence, `ARPHICPL.TXT`, servi à côté des traits.
 *
 * Ce script écrit dans `public/icons/` :
 *   icon-192.png         192, carré plein papier, marque centrée
 *   icon-512.png         512, idem
 *   maskable-512.png     512, `purpose: maskable` : la marque tient dans le disque
 *                        de sûreté (80 % du côté), quel que soit le masque d'Android
 *   apple-touch-icon.png 180, sans transparence, coins carrés (iOS arrondit lui-même)
 *   favicon.svg          la même marque en vectoriel, encre sur papier, mode sombre géré
 *
 * Et dans `ios-template/`, hors du site et du précache :
 *   AppIcon-1024.png     1024, l'icône de l'app iOS et de l'App Store, sans transparence,
 *                        coins carrés ; `ios-template/patch.rb` la pose dans le projet
 *                        Xcode que la CI engendre (docs/ios-sans-mac.md)
 *
 * Rejouable : `npm run icons` réécrit les six fichiers à l'identique, tant que les
 * traits de 文 ne changent pas dans l'export.
 *
 * Les PNG sont des captures d'un Chromium sans tête : la seule façon de rastériser
 * un SVG ici sans ajouter de dépendance au paquet de l'app. Chromium sert aussi à
 * mesurer l'encombrement réel de 文 (`getBBox`), pour le centrer. Playwright n'est donc
 * pas une dépendance de `package.json` : le script le cherche dans `NODE_PATH` et dans
 * les `node_modules` alentour, et s'arrête avec un mode d'emploi s'il ne le trouve pas.
 *
 *   NODE_PATH=/chemin/vers/node_modules \
 *   PW_CHROMIUM=/opt/pw-browsers/chromium \
 *   npm run icons
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ICI = dirname(fileURLToPath(import.meta.url));
const APP = resolve(ICI, '..');
const SORTIE = resolve(APP, 'public', 'icons');
const SORTIE_IOS = resolve(APP, 'ios-template');

/** Les couleurs de la charte (`docs/design-tokens.md`, `src/lib/tokens.css`). */
const PAPIER = '#F4EEE2';
const ENCRE = '#1F1B18';
const CINABRE = '#C8371F';
const PAPIER_SOMBRE = '#1A1714';
const ENCRE_SOMBRE = '#EDE6D8';
const CINABRE_SOMBRE = '#E0553A';

/** La marque et son trait cinabre : les mêmes que `src/lib/Marque.svelte`. */
const MARQUE = '文';
const TRAITS_CINABRE = [0];

/** Le repère des données de traits : un carré de 1024, y vers le haut, retourné ici. */
const COTE_TRAITS = 1024;
const RETOURNE = 'scale(1,-1) translate(0,-900)';

/** Quatre décimales suffisent et gardent le fichier stable d'une exécution à l'autre. */
function arrondi(n) {
  return Number(n.toFixed(4));
}

/** La version de données que l'app lit, telle que `src/lib/content.ts` la fixe. */
async function versionDonnees() {
  const source = await readFile(join(APP, 'src', 'lib', 'content.ts'), 'utf8');
  const m = source.match(/export const VERSION_DONNEES = '([^']+)'/);
  if (!m) throw new Error('VERSION_DONNEES introuvable dans src/lib/content.ts');
  return m[1];
}

/**
 * Les tracés de 文 dans l'export : le fichier de sa famille d'abord (文 est une racine),
 * sinon tous les fichiers de traits de l'index, jusqu'à le trouver.
 */
async function tracesDeLaMarque() {
  const version = await versionDonnees();
  const dossier = join(APP, 'public', 'data', version);
  const index = JSON.parse(await readFile(join(dossier, 'index.json'), 'utf8'));
  const familles = [...index.familles].sort((a, b) => (b.racine === MARQUE) - (a.racine === MARQUE));
  for (const f of familles) {
    const fichier = JSON.parse(await readFile(join(dossier, f.traits), 'utf8'));
    const d = fichier.traits?.[MARQUE];
    if (d && Array.isArray(d.s)) return { version, s: d.s };
  }
  throw new Error(`${MARQUE} absent des traits de l'export ${version} : lancer \`uv run wenlu export\`.`);
}

/** Les chemins des traits, le cinabre sur le point. `classe(i)` rend l'attribut du trait i. */
function chemins(s, classe) {
  return s.map((d, i) => `<path d="${d}"${classe(i)}/>`).join('');
}

/**
 * La marque, calée au centre d'un carré de `taille` : son plus grand côté y occupe
 * `part`. `boite` est l'encombrement réel des tracés, mesuré par Chromium, dans le
 * repère retourné (y vers le bas).
 */
function marque(s, boite, taille, part, classe) {
  const k = (taille * part) / Math.max(boite.w, boite.h);
  const dx = taille / 2 - (boite.x + boite.w / 2) * k;
  const dy = taille / 2 - (boite.y + boite.h / 2) * k;
  return `<g transform="translate(${arrondi(dx)} ${arrondi(dy)}) scale(${arrondi(k)})"><g transform="${RETOURNE}">${chemins(s, classe)}</g></g>`;
}

/** Remplissage en clair, pour les PNG : encre, et cinabre sur le point. */
function couleurs(i) {
  return ` fill="${TRAITS_CINABRE.includes(i) ? CINABRE : ENCRE}"`;
}

/** Un carré plein papier, la marque au centre. Aucune transparence, aucun coin arrondi. */
function icone(s, boite, taille, part) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" fill="${PAPIER}"/>
  ${marque(s, boite, taille, part, couleurs)}
</svg>`;
}

/**
 * Le favicon : la même marque, en vectoriel, qui suit le thème du navigateur.
 * Les onglets sombres reprennent l'encre claire de `tokens.css`.
 */
function favicon(s, boite, version) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <!-- ${MARQUE} : tracés de Make Me a Hanzi (graphics.txt, https://github.com/skishore/makemeahanzi),
       Arphic Public License, texte intégral servi par l'app en data/${version}/ARPHICPL.TXT.
       Modifications : mise à l'échelle et centrage par app/scripts/icons.mjs. -->
  <style>
    .p{fill:${PAPIER}}.e{fill:${ENCRE}}.d{fill:${CINABRE}}
    @media (prefers-color-scheme:dark){.p{fill:${PAPIER_SOMBRE}}.e{fill:${ENCRE_SOMBRE}}.d{fill:${CINABRE_SOMBRE}}}
  </style>
  <rect class="p" width="200" height="200"/>
  ${marque(s, boite, 200, 0.72, (i) => ` class="${TRAITS_CINABRE.includes(i) ? 'd' : 'e'}"`)}
</svg>
`;
}

/**
 * Les quatre PNG. `part` est le plus grand côté de la marque rapporté au côté de l'icône.
 *
 * Pour `maskable`, Android peut rogner jusqu'au disque inscrit de 80 % du côté : à
 * 0,45, même un carré plein de ce côté tiendrait dans un disque de 64 % du côté, donc
 * à l'intérieur de la zone de sûreté avec de la marge, quel que soit le masque. Les
 * autres icônes n'ont pas cette contrainte et respirent davantage.
 */
const FICHIERS = [
  { nom: 'icon-192.png', taille: 192, part: 0.62 },
  { nom: 'icon-512.png', taille: 512, part: 0.62 },
  { nom: 'maskable-512.png', taille: 512, part: 0.45 },
  { nom: 'apple-touch-icon.png', taille: 180, part: 0.56 },
  /* iOS arrondit l'icône lui-même : même respiration que `apple-touch-icon`. */
  { nom: 'AppIcon-1024.png', taille: 1024, part: 0.56, dossier: SORTIE_IOS }
];

/** Playwright n'est pas une dépendance de l'app : on le cherche là où il se trouve. */
function playwright() {
  const pistes = [
    ...(process.env.NODE_PATH ?? '').split(':').filter(Boolean),
    resolve(ICI, '..', 'node_modules')
  ];
  for (const nom of ['playwright', 'playwright-core']) {
    try {
      return require(nom);
    } catch {
      /* pas dans les chemins habituels */
    }
    for (const dir of pistes) {
      try {
        return require(join(dir, nom));
      } catch {
        /* pas là non plus */
      }
    }
  }
  throw new Error(
    "Playwright est introuvable. C'est un outil de fabrication, pas une dépendance de l'app :\n" +
      '  NODE_PATH=/chemin/vers/node_modules PW_CHROMIUM=/chemin/vers/chromium npm run icons'
  );
}

/**
 * L'encombrement réel des tracés, mesuré par Chromium dans le repère retourné : les
 * points de contrôle des courbes débordent du dessin, seul `getBBox` dit le vrai.
 */
async function mesurer(navigateur, s) {
  const page = await navigateur.newPage();
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COTE_TRAITS} ${COTE_TRAITS}"><g id="m">${chemins(s, () => '')}</g></svg>`,
    { waitUntil: 'load' }
  );
  const b = await page.evaluate(() => {
    const r = document.getElementById('m').getBBox();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.close();
  /* `RETOURNE` envoie y sur 900 - y : le haut du dessin est 900 - (y + h). */
  return { x: arrondi(b.x), y: arrondi(900 - (b.y + b.h)), w: arrondi(b.w), h: arrondi(b.h) };
}

async function main() {
  const { version, s } = await tracesDeLaMarque();
  const { chromium } = playwright();
  const bin = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
  const navigateur = await chromium.launch({
    executablePath: existsSync(bin) ? bin : undefined,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-lcd-text']
  });

  await mkdir(SORTIE, { recursive: true });
  const boite = await mesurer(navigateur, s);
  const faits = [`${MARQUE} (export ${version}) : ${boite.w} × ${boite.h} en ${boite.x},${boite.y}`];

  for (const { nom, taille, part, dossier = SORTIE } of FICHIERS) {
    const page = await navigateur.newPage({
      viewport: { width: taille, height: taille },
      deviceScaleFactor: 1
    });
    await page.setContent(
      `<!doctype html><meta charset="utf-8">
       <style>html,body{margin:0;padding:0;overflow:hidden;background:${PAPIER}}svg{display:block}</style>
       ${icone(s, boite, taille, part)}`,
      { waitUntil: 'load' }
    );
    const png = await page.screenshot({ type: 'png', omitBackground: false });
    await writeFile(join(dossier, nom), png);
    await page.close();
    faits.push(`${nom} ${taille}×${taille} ${png.length} o`);
  }

  await navigateur.close();

  await writeFile(join(SORTIE, 'favicon.svg'), favicon(s, boite, version), 'utf8');
  faits.push('favicon.svg');

  for (const f of faits) console.log(f);
}

await main();
