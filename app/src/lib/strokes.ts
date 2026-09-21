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
