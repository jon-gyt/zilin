/**
 * Les recherches récentes du dictionnaire (story 10.8, maquette `maquettes/dictionnaire.html`,
 * écran 1) : une saisie terminée, ou une fiche ouverte, la plus récente en tête. Elles restent
 * sur l'appareil, dans la progression (IndexedDB), et partent avec l'export JSON, comme le
 * reste ; « Effacer » les vide. Module pur : ni stockage, ni horloge.
 */

/** Une saisie (`hao`, `bonjour`), la fiche d'un caractère (`好`) ou celle d'un mot (`L1-0140`). */
export type Recente = { genre: 'saisie' | 'caractere' | 'mot'; v: string };

/** Une rangée de puces, qui se lit d'un coup d'œil. */
export const MAX_RECENTES = 8;

/** Une saisie plus longue n'est pas une recherche, c'est un texte : elle n'est pas gardée. */
export const SAISIE_MAX = 40;

const GENRES: readonly Recente['genre'][] = ['saisie', 'caractere', 'mot'];

function propre(r: Recente): Recente | null {
  const v = r.genre === 'saisie' ? r.v.normalize('NFC').trim().replace(/\s+/g, ' ') : r.v.trim();
  if (v === '' || v.length > SAISIE_MAX) return null;
  return { genre: r.genre, v };
}

/**
 * Note une recherche : elle passe en tête, sans doublon (la même saisie, à la casse près, ou
 * la même fiche), et la plus ancienne tombe au-delà de `MAX_RECENTES`.
 */
export function noterRecente(l: readonly Recente[], r: Recente, max: number = MAX_RECENTES): Recente[] {
  const x = propre(r);
  if (x === null) return [...l];
  const meme = (y: Recente) =>
    y.genre === x.genre && (x.genre === 'saisie' ? y.v.toLowerCase() === x.v.toLowerCase() : y.v === x.v);
  return [x, ...l.filter((y) => !meme(y))].slice(0, max);
}

/** Relit les récentes d'une progression importée : ce qui n'en a pas la forme est écarté. */
export function lireRecentes(v: unknown): Recente[] {
  if (!Array.isArray(v)) return [];
  let out: Recente[] = [];
  for (const x of [...v].reverse()) {
    const o = x as Record<string, unknown> | null;
    if (o === null || typeof o !== 'object') continue;
    if (!GENRES.includes(o.genre as Recente['genre']) || typeof o.v !== 'string') continue;
    out = noterRecente(out, { genre: o.genre as Recente['genre'], v: o.v });
  }
  return out;
}
