/**
 * Chargement des données de traits (style 楷) depuis les assets JSON de l'app.
 * Aucune autre requête réseau.
 *
 * Deux fichiers, une seule forme lue : `traits/<racine>.json` de l'export versionné,
 * qui porte son en-tête de licence (Arphic Public License) et range les tracés sous la
 * clé `traits` — c'est la source des 472 caractères de l'export ; et
 * `strokes-demo.json`, la table nue de la maquette, qui reste le repli pour les 89
 * caractères servis hors export (anecdotes, textes de démonstration).
 */
import type { StrokeData } from './glyph';

export type StrokeSet = Record<string, StrokeData>;

/** Le repli : les traits de la maquette, à la racine publique. */
export const FICHIER_TRAITS_DEMO = 'strokes-demo.json';

/** Un tracé complet : une suite de chemins, et autant de médianes. */
function estTrace(v: unknown): v is StrokeData {
  const d = v as StrokeData | null;
  return d !== null && typeof d === 'object' && Array.isArray(d.s) && Array.isArray(d.m);
}

/**
 * Les tracés d'un fichier, quelle que soit sa forme : la clé `traits` de l'export, ou
 * la table nue de `strokes-demo.json`. Rien d'autre n'est lu — l'en-tête de licence
 * reste dans le fichier, il ne se recopie pas dans l'app.
 */
export function lireTraits(brut: unknown): StrokeSet {
  const o = brut as { traits?: unknown } | null;
  if (o === null || typeof o !== 'object') return {};
  const table = (o.traits !== undefined ? o.traits : o) as Record<string, unknown>;
  const out: StrokeSet = {};
  for (const [c, d] of Object.entries(table)) if (estTrace(d)) out[c] = d;
  return out;
}

/** Lit un fichier de traits servi avec l'app (par défaut `strokes-demo.json`). */
export async function loadStrokes(
  file = FICHIER_TRAITS_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<StrokeSet> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Traits introuvables : ${file} (${r.status})`);
  return lireTraits(await r.json());
}

const cache = new Map<string, Promise<StrokeSet>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function strokesOnce(file = FICHIER_TRAITS_DEMO): Promise<StrokeSet> {
  let p = cache.get(file);
  if (!p) {
    p = loadStrokes(file).catch((e) => {
      cache.delete(file);
      throw e;
    });
    cache.set(file, p);
  }
  return p;
}
