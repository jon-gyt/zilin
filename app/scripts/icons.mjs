/**
 * Icônes de l'app, engendrées depuis la marque Zilin.
 *
 * La marque : un Z tracé en un trait, encre sur papier, surmonté du point cinabre
 * (le point de 之). Le tracé est celui de la ligne de marque de `src/lib/Today.svelte`
 * et de `src/lib/Open.svelte` : `M50 84h100L50 160h100`, trait 18 dans un carré de 200,
 * bouts et coins ronds, point plein cinabre en 100,42 de rayon 13.
 *
 * Ce script écrit dans `public/icons/` :
 *   icon-192.png         192, carré plein papier, marque centrée
 *   icon-512.png         512, idem
 *   maskable-512.png     512, `purpose: maskable` : la marque tient dans le disque
 *                        de sûreté (80 % du côté), quel que soit le masque d'Android
 *   apple-touch-icon.png 180, sans transparence, coins carrés (iOS arrondit lui-même)
 *   favicon.svg          la même marque en vectoriel, encre sur papier, mode sombre géré
 *
 * Rejouable : `npm run icons` réécrit les cinq fichiers à l'identique.
 *
 * Les PNG sont des captures d'un Chromium sans tête : la seule façon de rastériser
 * un SVG ici sans ajouter de dépendance au paquet de l'app. Playwright n'est donc pas
 * une dépendance de `package.json` : le script le cherche dans `NODE_PATH` et dans les
 * `node_modules` alentour, et s'arrête avec un mode d'emploi s'il ne le trouve pas.
 *
 *   NODE_PATH=/chemin/vers/node_modules \
 *   PW_CHROMIUM=/opt/pw-browsers/chromium \
 *   npm run icons
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(ICI, '..', 'public', 'icons');

/** Les couleurs de la charte (`docs/design-tokens.md`, `src/lib/tokens.css`). */
const PAPIER = '#F4EEE2';
const ENCRE = '#1F1B18';
const CINABRE = '#C8371F';
const PAPIER_SOMBRE = '#1A1714';
const ENCRE_SOMBRE = '#EDE6D8';
const CINABRE_SOMBRE = '#E0553A';

/**
 * La marque dans un carré de 200. Son encombrement réel, trait compris :
 * en x de 41 à 159 (le Z va de 50 à 150, plus la moitié du trait de 18),
 * en y de 29 à 169 (du haut du point au bas du Z). Soit 118 sur 140,
 * centré en 100,99 — ce n'est pas le centre du carré, d'où le calage ci-dessous.
 */
const MARQUE = { cx: 100, cy: 99, h: 140 };

/** Quatre décimales suffisent et gardent le fichier stable d'une exécution à l'autre. */
function arrondi(n) {
  return Number(n.toFixed(4));
}

/** La marque, calée au centre d'un carré de `taille`, occupant `part` de sa hauteur. */
function marque(taille, part, { encre = ENCRE, cinabre = CINABRE } = {}) {
  const k = (taille * part) / MARQUE.h;
  const dx = taille / 2 - MARQUE.cx * k;
  const dy = taille / 2 - MARQUE.cy * k;
  return `<g transform="translate(${arrondi(dx)} ${arrondi(dy)}) scale(${arrondi(k)})">
    <path d="M50 84h100L50 160h100" fill="none" stroke="${encre}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="100" cy="42" r="13" fill="${cinabre}"/>
  </g>`;
}

/** Un carré plein papier, la marque au centre. Aucune transparence, aucun coin arrondi. */
function icone(taille, part) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" fill="${PAPIER}"/>
  ${marque(taille, part)}
</svg>`;
}

/**
 * Le favicon : la même marque, en vectoriel, qui suit le thème du navigateur.
 * Les onglets sombres reprennent l'encre claire de `tokens.css`.
 */
function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <style>
    .p{fill:${PAPIER}}.z{stroke:${ENCRE}}.d{fill:${CINABRE}}
    @media (prefers-color-scheme:dark){.p{fill:${PAPIER_SOMBRE}}.z{stroke:${ENCRE_SOMBRE}}.d{fill:${CINABRE_SOMBRE}}}
  </style>
  <rect class="p" width="200" height="200"/>
  <path class="z" d="M50 84h100L50 160h100" fill="none" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <circle class="d" cx="100" cy="42" r="13"/>
</svg>
`;
}

/**
 * Les quatre PNG. `part` est la hauteur de la marque rapportée au côté de l'icône.
 *
 * Pour `maskable`, Android peut rogner jusqu'au disque inscrit de 80 % du côté : à
 * 0,45 la marque (118 × 140 avant mise à l'échelle) tient dans un disque de 60 % du
 * côté, donc à l'intérieur de la zone de sûreté avec de la marge, quel que soit le
 * masque. Les autres icônes n'ont pas cette contrainte et respirent davantage.
 */
const FICHIERS = [
  { nom: 'icon-192.png', taille: 192, part: 0.62 },
  { nom: 'icon-512.png', taille: 512, part: 0.62 },
  { nom: 'maskable-512.png', taille: 512, part: 0.45 },
  { nom: 'apple-touch-icon.png', taille: 180, part: 0.56 }
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

async function main() {
  const { chromium } = playwright();
  const bin = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
  const navigateur = await chromium.launch({
    executablePath: existsSync(bin) ? bin : undefined,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-lcd-text']
  });

  await mkdir(SORTIE, { recursive: true });
  const faits = [];

  for (const { nom, taille, part } of FICHIERS) {
    const page = await navigateur.newPage({
      viewport: { width: taille, height: taille },
      deviceScaleFactor: 1
    });
    await page.setContent(
      `<!doctype html><meta charset="utf-8">
       <style>html,body{margin:0;padding:0;overflow:hidden;background:${PAPIER}}svg{display:block}</style>
       ${icone(taille, part)}`,
      { waitUntil: 'load' }
    );
    const png = await page.screenshot({ type: 'png', omitBackground: false });
    await writeFile(join(SORTIE, nom), png);
    await page.close();
    faits.push(`${nom} ${taille}×${taille} ${png.length} o`);
  }

  await navigateur.close();

  await writeFile(join(SORTIE, 'favicon.svg'), favicon(), 'utf8');
  faits.push('favicon.svg');

  for (const f of faits) console.log(f);
}

await main();
