/**
 * L'estampe d'une anecdote : un dessin SVG monochrome servi avec l'app.
 *
 * Le SVG est posé en ligne dans la page, et non dans une balise `<img>` :
 * une image ne reçoit pas le `currentColor` de la page, donc l'encre ne
 * suivrait pas le mode sombre. En ligne, le trait suit `--ink` sans filtre.
 * Le fichier est un asset de l'app (aucune requête réseau extérieure) et
 * seul un `.svg` du dossier des estampes est accepté.
 */

/** Dossier des données de démonstration, servi avec l'app. */
export const DOSSIER_ESTAMPES = 'data/demo/';

/** `estampes/福.svg` et rien d'autre : pas de sous-dossier, pas de remontée. */
const CHEMIN = /^estampes\/[^/\\]+\.svg$/;

/** L'URL de l'estampe dans les assets de l'app, ou `null` si le chemin sort du dossier. */
export function estampeUrl(estampe: string): string | null {
  if (!CHEMIN.test(estampe)) return null;
  return `${import.meta.env.BASE_URL}${DOSSIER_ESTAMPES}${estampe}`;
}

/** Un SVG d'estampe : pas de script, pas de style, aucun renvoi hors de l'app. */
export function estampeSaine(svg: string): boolean {
  const t = svg.trim();
  if (!t.startsWith('<svg') || !t.endsWith('</svg>')) return false;
  if (/<\s*(script|style|foreignObject|iframe|image|use|a)\b/i.test(t)) return false;
  if (/\son\w+\s*=/i.test(t)) return false;
  if (/\b(href|src|srcset)\s*=/i.test(t)) return false;
  if (/url\s*\(/i.test(t)) return false;
  return true;
}

/** Lit l'estampe servie avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadEstampe(estampe: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const url = estampeUrl(estampe);
  if (!url) throw new Error(`Estampe hors du dossier des estampes : ${estampe}`);
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`Estampe introuvable : ${estampe} (${r.status})`);
  const svg = await r.text();
  if (!estampeSaine(svg)) throw new Error(`Estampe refusée : ${estampe}`);
  return svg;
}
