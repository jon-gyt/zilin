/** Chargement des données de traits (style 楷) depuis les assets JSON de l'app. Aucune autre requête réseau. */
import type { StrokeData } from './glyph';

export type StrokeSet = Record<string, StrokeData>;

/** Lit un fichier de traits servi avec l'app (par défaut `strokes-demo.json` à la racine publique). */
export async function loadStrokes(
  file = 'strokes-demo.json',
  fetchFn: typeof fetch = fetch
): Promise<StrokeSet> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Traits introuvables : ${file} (${r.status})`);
  return (await r.json()) as StrokeSet;
}

const cache = new Map<string, Promise<StrokeSet>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function strokesOnce(file = 'strokes-demo.json'): Promise<StrokeSet> {
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
