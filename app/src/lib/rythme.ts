/**
 * Les lignes du rythme gratuit (épic 7, stories 7.2 et 7.5), telles que le pipeline les
 * exporte dans `rythme.json` (`data/sources/interface/rythme.tsv`, `data/schema.md`) : la
 * prochaine brique au menu et sur la route, la journée sans brique nouvelle, la ligne de
 * Clore le jour où le rythme gratuit commence.
 *
 * L'app ne rédige aucune ligne : elle lit celles-ci et remplit les jetons. Les jours
 * viennent de `droits.ts`, calculés, jamais estimés. Un export qui ne porte pas
 * `rythme.json` rend des lignes vides : l'écran se tait plutôt que de dire un texte écrit
 * dans le code. Seul `rythmeOnce` lit le réseau local, les assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';
import { remplir } from './heros';

export const CLES_RYTHME = [
  'menu_demain',
  'menu_dans',
  'menu_revue',
  'menu_revue_faite',
  'menu_brique_revue',
  'menu_reviser',
  'tao_revoir',
  'apprendre_revue',
  'clore_revue',
  'clore_rythme',
  'route_pierre_demain',
  'route_pierre',
  'route_carte_demain',
  'route_carte',
  'route_fin',
  'route_suite_lire',
  'route_suite_hsk'
] as const;

export type CleRythme = (typeof CLES_RYTHME)[number];

/** Une ligne par clé ; vide quand l'export ne la porte pas. */
export type TextesRythme = Record<CleRythme, string>;

/** Aucune ligne : ce que rend un export sans `rythme.json`. */
export const SANS_RYTHME: TextesRythme = Object.fromEntries(CLES_RYTHME.map((c) => [c, ''])) as TextesRythme;

/** Lit `rythme.json`. Une ligne absente ou mal formée reste vide : rien n'est inventé ici. */
export function lireRythme(brut: unknown): TextesRythme {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const t = (typeof o.textes === 'object' && o.textes !== null ? o.textes : {}) as Record<string, unknown>;
  const out = { ...SANS_RYTHME };
  for (const cle of CLES_RYTHME) out[cle] = typeof t[cle] === 'string' ? t[cle] : '';
  return out;
}

/** Une ligne, jetons remplis ({n} des jours du calendrier, {c} un caractère). */
export function ligne(t: TextesRythme, cle: CleRythme, valeurs: Readonly<Record<string, string | number>> = {}): string {
  return remplir(t[cle], valeurs);
}

/** « Demain », « Dans 3 j » : le début de la ligne du menu, en jours du calendrier. */
export function quandMenu(t: TextesRythme, dans: number): string {
  return dans <= 1 ? ligne(t, 'menu_demain') : ligne(t, 'menu_dans', { n: dans });
}

/** Sur la pierre suivante de la route : « prochaine brique dans 3 j ». */
export function quandPierre(t: TextesRythme, dans: number): string {
  return dans <= 1 ? ligne(t, 'route_pierre_demain') : ligne(t, 'route_pierre', { n: dans });
}

/** Dans la carte de l'étape suivante : « Prochaine brique dans 3 jours ». */
export function quandCarte(t: TextesRythme, dans: number): string {
  return dans <= 1 ? ligne(t, 'route_carte_demain') : ligne(t, 'route_carte', { n: dans });
}

/** La suite du chemin au bout du chemin gratuit, selon le parcours : le HSK 2, ou le seuil 405. */
export function suiteDuChemin(t: TextesRythme, parcours: string | null): string {
  return parcours === 'hsk' ? t.route_suite_hsk : t.route_suite_lire;
}

/** Le fichier des lignes d'une version, tel que l'index le nomme. */
export function fichierRythme(i: Index): string {
  return !i.rythme ? '' : `${dossierVersion(i.version)}/${i.rythme}`;
}

/** Lit et valide `rythme.json`. `fetchFn` est injecté dans les tests. */
export async function loadRythme(file: string, fetchFn: typeof fetch = fetch): Promise<TextesRythme> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Lignes du rythme introuvables : ${file} (${r.status})`);
  return lireRythme(await r.json());
}

const lesLignes = new Map<string, Promise<TextesRythme>>();

/** Les lignes de la version courante, lues une fois pour toute la durée de vie de l'app. */
export function rythmeOnce(version = VERSION_DONNEES): Promise<TextesRythme> {
  let p = lesLignes.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierRythme(i);
        return file === '' ? SANS_RYTHME : loadRythme(file);
      })
      .catch((e) => {
        lesLignes.delete(version);
        throw e;
      });
    lesLignes.set(version, p);
  }
  return p;
}
