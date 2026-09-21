/**
 * Chargement du contenu servi avec l'app (JSON versionné de `app/public/data/`).
 * Aucune donnée de contenu n'est écrite dans le code : ce module ne fait que lire.
 * Aucune requête réseau hors des assets de l'app.
 */

/** Une anecdote du jour : un caractère, un titre, quelques phrases. */
export type Anecdote = { c: string; titre: string; texte: string };

/** Un fichier d'anecdotes, versionné, avec la source du texte (traçabilité). */
export type Anecdotes = { version: string; source: string; anecdotes: Anecdote[] };

export const FICHIER_ANECDOTES = 'data/demo/anecdotes.json';

/** Lit un fichier d'anecdotes servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadAnecdotes(
  file = FICHIER_ANECDOTES,
  fetchFn: typeof fetch = fetch
): Promise<Anecdotes> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Anecdotes introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Anecdotes>;
  if (!Array.isArray(brut.anecdotes)) throw new Error(`Anecdotes illisibles : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    anecdotes: brut.anecdotes
  };
}

const cache = new Map<string, Promise<Anecdotes>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function anecdotesOnce(file = FICHIER_ANECDOTES): Promise<Anecdotes> {
  let p = cache.get(file);
  if (!p) {
    p = loadAnecdotes(file).catch((e) => {
      cache.delete(file);
      throw e;
    });
    cache.set(file, p);
  }
  return p;
}

/** Journées civiles écoulées depuis le 1er janvier 1970, d'après une date AAAA-MM-JJ. */
export function jourDepuisEpoque(dateISO: string): number {
  return Math.floor(Date.parse(`${dateISO}T00:00:00Z`) / 86400000);
}

/**
 * L'anecdote du jour : une seule par journée, la même toute la journée,
 * et la liste est parcourue en entier avant de se répéter.
 */
export function anecdoteDuJour(liste: Anecdote[], dateISO: string): Anecdote | null {
  if (liste.length === 0) return null;
  const j = jourDepuisEpoque(dateISO);
  if (!Number.isFinite(j)) return null;
  return liste[((j % liste.length) + liste.length) % liste.length];
}
