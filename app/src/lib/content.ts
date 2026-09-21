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

/* ---------- les textes de lecture ---------- */

/**
 * Un signe du texte : le caractère, sa glose quand la source en donne une, et le
 * drapeau de l'élément ajouté. Sans glose, le signe ne se touche pas (la ponctuation).
 */
export type Signe = {
  c: string;
  pinyin?: string | null;
  fr?: string | null;
  /** Le caractère du jour : l'élément ajouté, le seul en cinabre dans le texte. */
  nouveau?: boolean;
};

/** Un texte de lecture : trois lignes avec uniquement l'acquis, et sa traduction. */
export type Texte = {
  version: string;
  source: string;
  /** Le caractère du jour, celui autour duquel le texte est écrit. */
  c: string;
  lignes: Signe[][];
  traduction: string;
  audio?: string | null;
};

export const FICHIER_TEXTE_DEMO = 'data/demo/textes/住.json';

/** Lit un texte de lecture servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadTexte(
  file = FICHIER_TEXTE_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Texte> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Texte introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Texte>;
  if (!Array.isArray(brut.lignes) || brut.lignes.length === 0) {
    throw new Error(`Texte illisible : ${file}`);
  }
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    c: typeof brut.c === 'string' ? brut.c : '',
    lignes: brut.lignes,
    traduction: typeof brut.traduction === 'string' ? brut.traduction : '',
    audio: brut.audio ?? null
  };
}

const textes = new Map<string, Promise<Texte>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function texteOnce(file = FICHIER_TEXTE_DEMO): Promise<Texte> {
  let p = textes.get(file);
  if (!p) {
    p = loadTexte(file).catch((e) => {
      textes.delete(file);
      throw e;
    });
    textes.set(file, p);
  }
  return p;
}

/** Un signe se touche s'il porte une glose ; la ponctuation n'en a pas. */
export function glosable(s: Signe): boolean {
  return Boolean(s.fr) || Boolean(s.pinyin);
}

/** La glose au toucher, courte : « zhù, habiter ». `null` quand la source n'en donne pas. */
export function glose(s: Signe): string | null {
  if (!glosable(s)) return null;
  return [s.pinyin, s.fr].filter(Boolean).join(', ');
}

/** Le texte nu, ligne par ligne : ce qui s'écouterait, et ce qui se compare à la source. */
export function lignesNues(t: Texte): string[] {
  return t.lignes.map((l) => l.map((s) => s.c).join(''));
}

/* ---------- les voisins de forme, pour les leurres ---------- */

/**
 * Un voisin de forme : un caractère avec sa décomposition canonique GF 0014-2009.
 * Sert à choisir les leurres d'une question par ressemblance de composants.
 */
export type Voisin = { c: string; pinyin: string; fr: string; parts: string[] };

export type Voisins = { version: string; source: string; norme: string; voisins: Voisin[] };

export const FICHIER_VOISINS_DEMO = 'data/demo/voisins.json';

/** Lit la liste des voisins servie avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadVoisins(
  file = FICHIER_VOISINS_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Voisins> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Voisins introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Voisins>;
  if (!Array.isArray(brut.voisins)) throw new Error(`Voisins illisibles : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    norme: typeof brut.norme === 'string' ? brut.norme : '',
    voisins: brut.voisins
  };
}

const voisins = new Map<string, Promise<Voisins>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function voisinsOnce(file = FICHIER_VOISINS_DEMO): Promise<Voisins> {
  let p = voisins.get(file);
  if (!p) {
    p = loadVoisins(file).catch((e) => {
      voisins.delete(file);
      throw e;
    });
    voisins.set(file, p);
  }
  return p;
}

/* ---------- le cercle des familles (Ma forêt) ---------- */

/**
 * Un nœud du cercle : un caractère, son avancement, et les caractères qu'il engendre.
 * `avancement` va de 0 (à venir) à 1 (acquis) ; entre les deux, c'est en cours.
 */
export type Noeud = {
  c: string;
  pinyin: string;
  fr: string;
  avancement: number;
  membres: Noeud[];
};

/**
 * Le cercle des familles : un caractère au centre, puis une famille par secteur.
 *
 * Format attendu, à terme, depuis `data/` : le pipeline écrit `graphe.json`
 * (`familles: [{racine, genre, n, membres[]}]`, voir `data/schema.md`) et l'export
 * en dérive un fichier de cette forme — un `Noeud` par racine, ses `membres` dans
 * l'ordre du parcours, deux générations au plus, le pinyin et le sens repris de la
 * fiche du caractère. `avancement` viendra alors de la progression (stabilité FSRS
 * des briques) et non du fichier : le champ n'est ici qu'une démonstration, recopiée
 * de la maquette en attendant le parcours.
 */
export type Foret = {
  version: string;
  source: string;
  norme: string;
  /** Le caractère posé au centre du cercle. */
  centre: string;
  familles: Noeud[];
};

export const FICHIER_FORET_DEMO = 'data/demo/foret.json';

/** Lit le cercle des familles servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadForet(
  file = FICHIER_FORET_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Foret> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Forêt introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Foret>;
  if (!Array.isArray(brut.familles)) throw new Error(`Forêt illisible : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    norme: typeof brut.norme === 'string' ? brut.norme : '',
    centre: typeof brut.centre === 'string' ? brut.centre : '',
    familles: brut.familles
  };
}

const forets = new Map<string, Promise<Foret>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function foretOnce(file = FICHIER_FORET_DEMO): Promise<Foret> {
  let p = forets.get(file);
  if (!p) {
    p = loadForet(file).catch((e) => {
      forets.delete(file);
      throw e;
    });
    forets.set(file, p);
  }
  return p;
}

/** Tous les caractères d'un nœud, lui compris, dans l'ordre du cercle. */
export function caracteres(n: Noeud): string[] {
  return [n.c, ...n.membres.flatMap(caracteres)];
}
