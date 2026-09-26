/**
 * Les chemins du site public (story 5.2), partagés par le générateur et par la
 * configuration du service worker de l'app (`vite.config.ts`).
 *
 * Le site vit dans le même artefact GitHub Pages que l'app, sous la même base
 * (`/zilin/`, liée au nom du dépôt, jamais écrite en dur ici : elle vient de
 * `BASE_PATH`). L'app garde la racine ; le site prend des sous-dossiers qu'elle
 * n'utilise pas. Le service worker de l'app, dont la portée est la base entière, doit
 * les laisser au réseau : sans cela, sa route de navigation servirait `index.html`
 * de l'app à la place de la page d'un caractère.
 */

export type Langue = 'fr' | 'en';
export const LANGUES: readonly Langue[] = ['fr', 'en'];

/** Les sections du site, par langue. L'anglais vit sous `en/`. */
export const SECTIONS = {
  fr: { caractere: 'c', familles: 'familles', licences: 'licences', confidentialite: 'confidentialite' },
  en: { caractere: 'c', familles: 'families', licences: 'licenses', confidentialite: 'privacy' }
} as const satisfies Record<Langue, Record<string, string>>;

/** Le dossier des fichiers communs du site (la feuille de styles). */
export const DOSSIER_COMMUN = 'site';

/** Les dossiers de premier niveau que le site écrit dans `dist/`. */
export const DOSSIERS_DU_SITE: readonly string[] = [
  SECTIONS.fr.caractere,
  SECTIONS.fr.familles,
  SECTIONS.fr.licences,
  SECTIONS.fr.confidentialite,
  'en',
  DOSSIER_COMMUN
];

/** Les fichiers de premier niveau que le site écrit dans `dist/`. */
export const FICHIERS_DU_SITE: readonly string[] = ['sitemap.xml', 'robots.txt'];

/** Normalise une base : commence et finit par `/`. */
export function normaliserBase(base: string | undefined): string {
  let b = (base ?? '/').trim() || '/';
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  return b;
}

function echapperRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Les navigations que le service worker de l'app ne doit pas servir depuis son
 * `index.html` : toutes les pages du site. Workbox compare ce motif au chemin de l'URL
 * (encodé, mais nos préfixes sont en ASCII).
 */
export function motifPagesDuSite(base: string | undefined): RegExp {
  const dossiers = DOSSIERS_DU_SITE.map(echapperRegExp).join('|');
  return new RegExp(`^${echapperRegExp(normaliserBase(base))}(?:${dossiers})/`);
}

/** Ce que Workbox ne doit jamais précacher : le site n'alourdit pas la PWA. */
export const GLOB_HORS_PRECACHE: readonly string[] = [
  ...DOSSIERS_DU_SITE.map((d) => `${d}/**`),
  ...FICHIERS_DU_SITE
];

/** Le chemin (sous la base) d'une page du site, toujours terminé par `/`. */
export function cheminPage(langue: Langue, section: keyof (typeof SECTIONS)['fr'], c?: string): string {
  const prefixe = langue === 'en' ? 'en/' : '';
  const suite = c === undefined ? '' : `${encodeURIComponent(c)}/`;
  return `${prefixe}${SECTIONS[langue][section]}/${suite}`;
}

/** Le fichier écrit dans `dist/` pour une page : le chemin décodé, puis `index.html`. */
export function fichierPage(chemin: string): string {
  return `${decodeURIComponent(chemin)}index.html`;
}
