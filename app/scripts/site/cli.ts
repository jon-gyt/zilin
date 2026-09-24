/// <reference types="node" />
/**
 * `npm run site` : écrit le site public dans `dist/`, à côté de l'app déjà construite.
 *
 *   BASE_PATH=/zilin/ npm run build
 *   BASE_PATH=/zilin/ SITE_ORIGIN=https://jon-gyt.github.io npm run site
 *
 * `BASE_PATH` est la même base que celle du build de l'app ; `SITE_ORIGIN` l'origine
 * des URL absolues (canonique, `hreflang`, plan du site). Le site se génère **après**
 * `vite build`, qui vide `dist/` : le service worker de l'app, écrit par ce build, ne
 * connaît donc pas les pages du site et ne les précache pas. Le script le vérifie.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION_DONNEES } from '../../src/lib/content';
import { DOSSIERS_DU_SITE, FICHIERS_DU_SITE } from './chemins';
import { genererSite, lireExport } from './generer';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(app, process.argv[2] ?? 'dist');
const version = process.env.SITE_VERSION ?? VERSION_DONNEES;
const base = process.env.BASE_PATH ?? '/';
const origine = process.env.SITE_ORIGIN ?? 'https://jon-gyt.github.io';

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`site : ${dist}/index.html absent. Construire l'app d'abord (npm run build).`);
  process.exit(1);
}

const ex = lireExport(join(app, 'public/data', version));
const fichiers = genererSite(ex, { base, origine, tokensCss: readFileSync(join(app, 'src/lib/tokens.css'), 'utf8') });

let octets = 0;
for (const f of fichiers) {
  const cible = join(dist, f.chemin);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, f.contenu);
  octets += Buffer.byteLength(f.contenu);
}

// Le service worker de l'app ne doit rien précacher du site.
const sw = join(dist, 'sw.js');
if (existsSync(sw)) {
  const code = readFileSync(sw, 'utf8');
  const fuite = [...DOSSIERS_DU_SITE.map((d) => `url:"${d}/`), ...FICHIERS_DU_SITE.map((f) => `url:"${f}"`)].filter((m) =>
    code.includes(m)
  );
  if (fuite.length) {
    console.error(`site : le service worker précache des pages du site (${fuite.join(', ')}).`);
    process.exit(1);
  }
}

const pages = fichiers.filter((f) => f.chemin.endsWith('.html')).length;
console.log(`site : ${pages} pages, ${(octets / 1024 / 1024).toFixed(2)} Mio, données ${version}, base ${base}, dans ${dist}`);
