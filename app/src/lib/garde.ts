/**
 * Ne jamais perdre sa progression (rapport comparatif du 28 septembre 2026, §2.3). La
 * progression ne vit que sur l'appareil, sans compte ni serveur ; trois gestes la gardent :
 *
 * - sur le web, demander au navigateur un stockage persistant (`navigator.storage.persist()`)
 *   au premier enregistrement : Safari efface le stockage d'un site peu ouvert, pas celui
 *   d'un stockage persistant ni d'une app de l'écran d'accueil ;
 * - sur le web iOS, hors écran d'accueil, une ligne discrète dans Réglages, sans fenêtre
 *   modale ni relance : « Ajoute Wenlu à l'écran d'accueil pour garder ta progression » ;
 * - dans Réglages, la date du dernier export, ou « jamais ».
 *
 * Module pur : le stockage, le navigateur et les dates arrivent en argument. Les textes
 * viennent du pipeline (`rappels.json`, `rappels.ts`).
 */
import { remplir, type TextesRappels } from './rappels';
import type { Progress } from './session';
import { leJour } from './trouves';

/* ---------- le stockage persistant ---------- */

/** Ce que `navigator.storage` offre, quand il l'offre. */
export type Stockage = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

/**
 * Demande un stockage persistant, sur le web seulement : dans l'app iOS, le stockage de la
 * WebView appartient à l'app. Déjà persistant, rien n'est redemandé. Rend vrai si le
 * stockage l'est ; faux sans l'API, sur refus ou sur erreur, sans rien dire.
 */
export async function demanderPersistance(stockage: Stockage | undefined, natif: boolean): Promise<boolean> {
  if (natif || !stockage || typeof stockage.persist !== 'function') return false;
  try {
    if (typeof stockage.persisted === 'function' && (await stockage.persisted())) return true;
    return await stockage.persist();
  } catch {
    return false;
  }
}

/* ---------- l'écran d'accueil, sur le web iOS ---------- */

/** Ce qu'on lit du navigateur pour savoir où l'app tourne. */
export type Navigateur = {
  userAgent: string;
  maxTouchPoints?: number;
  /** `navigator.standalone` de Safari : vrai quand l'app est ouverte depuis l'écran d'accueil. */
  standalone?: boolean;
};

/** Un iPhone, un iPod ou un iPad (qui se dit Macintosh, mais tactile, depuis iPadOS 13). */
export function estIos(n: Navigateur): boolean {
  return /iPhone|iPad|iPod/.test(n.userAgent) || (/Macintosh/.test(n.userAgent) && (n.maxTouchPoints ?? 0) > 1);
}

/**
 * La ligne « Ajoute Wenlu à l'écran d'accueil » : sur le web iOS seulement, hors de
 * l'écran d'accueil (`standalone`, ou `display-mode: standalone`), jamais dans l'app.
 */
export function inviterEcranAccueil(n: Navigateur, afficheSeule: boolean, natif: boolean): boolean {
  return !natif && estIos(n) && n.standalone !== true && !afficheSeule;
}

/* ---------- le dernier export ---------- */

/** Relit la date du dernier export d'une progression ; absente ou illisible, jamais. */
export function lireDernierExport(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Note le jour de l'export dans la progression, qui l'emporte avec elle. */
export function noterExport(p: Progress, jour: string): Progress {
  return { ...p, dernierExport: jour };
}

/** « 12 septembre », et l'année quand ce n'est pas celle d'aujourd'hui. */
export function dateCourte(jour: string, aujourdhui: string): string {
  const long = leJour(jour).replace(/^le /, '');
  return jour.slice(0, 4) === aujourdhui.slice(0, 4) ? long.replace(/ \d{4}$/, '') : long;
}

/** « Dernier export : 12 septembre », ou « Dernier export : jamais ». Vide sans textes. */
export function ligneDernierExport(dernier: string | null, aujourdhui: string, textes: TextesRappels): string {
  if (dernier === null) return textes.export_jamais;
  const date = dateCourte(dernier, aujourdhui);
  return date === '' || textes.export_date === '' ? textes.export_jamais : remplir(textes.export_date, { date });
}
