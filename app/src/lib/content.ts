/**
 * Chargement du contenu servi avec l'app (JSON versionné de `app/public/data/`).
 * Aucune donnée de contenu n'est écrite dans le code : ce module ne fait que lire.
 * Aucune requête réseau hors des assets de l'app.
 */

/** Une anecdote du jour : un caractère, un titre, quelques phrases, une estampe. */
export type Anecdote = { c: string; titre: string; texte: string; estampe?: string };

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

/* ---------- les familles de caractères ---------- */

/** Le rôle d'un élément dans le caractère : il donne le son, le sens, ou la forme. */
export type Role = 'son' | 'sens' | 'forme';

/** Origine attestée ou moyen mnémotechnique : jamais l'un pour l'autre. */
export type Etiquette = 'atteste' | 'mnemotechnique';

/** Ce que l'étiquette dit à l'écran. */
export const ETIQUETTES: Record<Etiquette, string> = {
  atteste: 'attesté',
  mnemotechnique: 'mnémotechnique'
};

/** Un mot ou une phrase : le chinois, le pinyin, la traduction. */
export type Mot = { hanzi: string; pinyin: string; fr: string; en: string; audio?: string | null };

/** Un composant de la norme GF 0014-2009, racine d'une famille. */
export type Brique = {
  c: string;
  pinyin: string;
  fr: string;
  en: string;
  origine: string;
  etiquette: Etiquette;
};

/** La fiche d'un caractère : décomposition canonique, origine étiquetée, mots. */
export type Fiche = {
  c: string;
  pinyin: string;
  fr: string;
  en: string;
  /** Décomposition canonique GF 0014-2009, dans l'ordre d'écriture. */
  parts: string[];
  /** Index, dans `parts`, des éléments ajoutés : les seuls à porter le cinabre. */
  nouveau: number[];
  role: Role;
  origine_fr: string;
  origine_en: string;
  etiquette: Etiquette;
  memo_fr?: string | null;
  memo_en?: string | null;
  mots: Mot[];
  phrase?: Mot | null;
  niveaux: Record<string, number>;
  traits: string[];
  medianes: number[][][];
  audio?: string | null;
};

/** Une famille : une brique et les caractères qu'elle engendre. Format `Famille` de `data/`. */
export type Famille = { version: string; source: string; racine: Brique; fiches: Fiche[] };

export const FICHIER_FAMILLE_DEMO = 'data/demo/familles/主.json';

/** Lit une famille servie avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadFamille(
  file = FICHIER_FAMILLE_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Famille> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Famille introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Famille>;
  if (!brut.racine || !Array.isArray(brut.fiches)) throw new Error(`Famille illisible : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    racine: brut.racine,
    fiches: brut.fiches
  };
}

const familles = new Map<string, Promise<Famille>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function familleOnce(file = FICHIER_FAMILLE_DEMO): Promise<Famille> {
  let p = familles.get(file);
  if (!p) {
    p = loadFamille(file).catch((e) => {
      familles.delete(file);
      throw e;
    });
    familles.set(file, p);
  }
  return p;
}

/** La fiche d'un caractère dans une famille, `null` si la famille ne la porte pas. */
export function fiche(f: Famille, c: string): Fiche | null {
  return f.fiches.find((x) => x.c === c) ?? null;
}

/** La fiche d'un composé : le premier caractère qui n'est pas la racine. */
export function compose(f: Famille): Fiche | null {
  return f.fiches.find((x) => x.c !== f.racine.c) ?? null;
}
