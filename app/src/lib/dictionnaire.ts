/**
 * Le dictionnaire de la loupe Chercher : les 3 000 caractères et les 11 092 mots du HSK 3.0
 * (GF 0025-2021), cherchés par caractère, par pinyin avec ou sans tons, ou en français sur
 * les seules gloses relues.
 *
 * Le contenu vient tout entier de l'export (`data/<version>/dico/`, `data/schema.md`,
 * « Le dictionnaire ») : l'index unique, chargé à l'ouverture de Chercher, puis les lots
 * d'entrées et de traits, à la demande. Ce module ne contient aucune donnée.
 *
 * Deux parties :
 *
 * 1. la recherche, pure : elle ne lit ni le réseau, ni l'horloge, ni le DOM
 *    (`lireIndexDico`, `lireSaisie`, `chercherDico`) ;
 * 2. le chargement paresseux (`ChargeurDico`), qui ne lit que les fichiers de l'app, par
 *    une fonction `fetch` injectée : l'index une fois, chaque lot une fois, jamais un lot
 *    au moment de chercher.
 *
 * Le classement (étude du 29 septembre 2026, SOURCES §7), dans cet ordre :
 *
 * 1. l'entrée qui s'écrit comme la saisie (好, 你好) ;
 * 2. le mot qui commence par la saisie (好 → 好看), puis celui qui la contient (爱好) ;
 * 3. pour une saisie de plusieurs sinogrammes, chacun d'eux, dans l'ordre tapé ;
 * 4. le pinyin exact, tons facultatifs (`hao`, `hǎo`, `hao3`, `ni hao`, `nǐhǎo`) ;
 * 5. le pinyin dont la dernière syllabe commence par ce qui est tapé (`nih` → nǐhǎo) ;
 * 6. le français, sur la glose relue.
 *
 * À rang égal : le caractère avant le mot, le niveau HSK croissant, le mot le plus court,
 * puis l'ordre de l'index (celui du pinyin).
 */
import type { StrokeData } from './glyph';
import { lireTraits } from './strokes';

/* ---------- l'index ---------- */

export type Genre = 'caractere' | 'mot';

/** Une syllabe numérotée : sa base (`hao`, `nv` pour nǚ, `r` pour l'érhua) et son ton, 1 à 5. */
export type Syllabe = { base: string; ton: number };

/** Une entrée cherchable, telle que l'index la décrit. */
export type EntreeDico = {
  genre: Genre;
  /** Le caractère, ou l'identifiant du mot (`L1-0002`). */
  id: string;
  /** Les graphies, la principale en tête. Un caractère n'en a qu'une : lui-même. */
  formes: string[];
  /** Les lectures, la principale en tête : une suite de syllabes chacune. */
  lectures: Syllabe[][];
  /** 1 à 6, et 7 pour « 7-9 ». */
  niveau: number;
  /** Le lot où lire l'entrée (et, pour un caractère, ses traits). */
  lot: number;
  /** La glose française relue ; vide tant que le sens n'est pas relu. */
  glose: string;
  /** Sa place dans l'index : départage deux résultats égaux. */
  ordre: number;
};

export type FichiersDico = { caracteres: string; mots: string; traits: string };

export type IndexDico = {
  version: string;
  fichiers: FichiersDico;
  entrees: EntreeDico[];
  /** Le lot de traits des composants hors de la liste (亻, 氵…). */
  traitsHorsListe: Record<string, number>;
  /** Les syllabes que l'index connaît, sans ton : la table du découpage de la saisie. */
  syllabes: Set<string>;
};

/** `hao3` → `{hao, 3}` ; `ba5`, `ba0` et `ba` → ton neutre. */
export function lireSyllabe(s: string): Syllabe {
  const m = /^([a-z]+)([0-5])?$/.exec(s.trim().toLowerCase());
  if (!m) return { base: s.trim().toLowerCase(), ton: 5 };
  const ton = m[2] === undefined || m[2] === '0' ? 5 : Number(m[2]);
  return { base: m[1], ton };
}

/** `ni3 hao3|ni3 hao5` → deux lectures de deux syllabes. */
export function lireLectures(s: string): Syllabe[][] {
  return s
    .split('|')
    .map((l) => l.split(/\s+/).filter((x) => x !== '').map(lireSyllabe))
    .filter((l) => l.length > 0);
}

/** Les syllabes écrites avec u pour ü (nu, lue), que l'on tape souvent. */
function sansTrema(base: string): string {
  return base.replace(/^([nl])v/, '$1u');
}

function colonne(noms: unknown, nom: string, defaut: number): number {
  if (!Array.isArray(noms)) return defaut;
  const i = noms.indexOf(nom);
  return i >= 0 ? i : defaut;
}

/**
 * Relit `dico/index.json`. Les colonnes se lisent par leur nom (`colonnes`), pas par leur
 * rang : un export qui en ajoute une ne casse pas la lecture.
 */
export function lireIndexDico(brut: unknown): IndexDico {
  const o = (brut ?? {}) as Record<string, unknown>;
  const fichiers = (o.fichiers ?? {}) as Partial<FichiersDico>;
  const cols = (o.colonnes ?? {}) as Record<string, unknown>;
  const entrees: EntreeDico[] = [];
  const lire = (genre: Genre, lignes: unknown, noms: unknown) => {
    if (!Array.isArray(lignes)) return;
    const estMot = genre === 'mot';
    const iId = colonne(noms, estMot ? 'id' : 'c', 0);
    const iFormes = estMot ? colonne(noms, 'formes', 1) : -1;
    const iLect = colonne(noms, 'lectures', estMot ? 2 : 1);
    const iNiv = colonne(noms, 'niveau', estMot ? 3 : 2);
    const iLot = colonne(noms, 'lot', estMot ? 4 : 3);
    const iGlose = colonne(noms, 'glose', estMot ? 5 : 4);
    for (const l of lignes) {
      if (!Array.isArray(l) || typeof l[iId] !== 'string') continue;
      const id = l[iId] as string;
      const formes = estMot ? String(l[iFormes] ?? '').split('|').filter((x) => x !== '') : [id];
      entrees.push({
        genre,
        id,
        formes,
        lectures: lireLectures(String(l[iLect] ?? '')),
        niveau: Number(l[iNiv]) || 0,
        lot: Number(l[iLot]) || 0,
        glose: typeof l[iGlose] === 'string' ? (l[iGlose] as string).trim() : '',
        ordre: entrees.length
      });
    }
  };
  lire('caractere', o.caracteres, cols.caracteres);
  lire('mot', o.mots, cols.mots);
  const syllabes = new Set<string>();
  for (const e of entrees) {
    for (const l of e.lectures) {
      for (const s of l) {
        syllabes.add(s.base);
        syllabes.add(sansTrema(s.base));
      }
    }
  }
  const hors = (o.traits_hors_liste ?? {}) as Record<string, unknown>;
  return {
    version: typeof o.version === 'string' ? o.version : '',
    fichiers: {
      caracteres: fichiers.caracteres ?? 'dico/caracteres/{lot}.json',
      mots: fichiers.mots ?? 'dico/mots/{lot}.json',
      traits: fichiers.traits ?? 'traits/dico-{lot}.json'
    },
    entrees,
    traitsHorsListe: Object.fromEntries(
      Object.entries(hors).filter(([, v]) => Number.isInteger(v)) as [string, number][]
    ),
    syllabes
  };
}

/* ---------- la saisie ---------- */

/** Une syllabe tapée : sa base, son ton s'il est dit, et si elle peut n'être qu'un début. */
export type SyllabeTapee = { base: string; ton: number | null; prefixe: boolean };

export type Saisie = {
  /** Les sinogrammes tapés, dans l'ordre (vide pour une saisie en lettres). */
  hanzi: string;
  /** Tous les découpages en syllabes de la saisie (vide si elle ne se lit pas en pinyin). */
  decoupages: SyllabeTapee[][];
  /** La saisie à plat, pour le français. */
  mot: string;
};

/** Au plus autant de découpages : `xian` en a trois, une phrase entière des dizaines. */
export const MAX_DECOUPAGES = 32;

const TONS: Record<string, number> = { '\u0304': 1, '\u0301': 2, '\u030C': 3, '\u0300': 4 };

/** Le français sans accents ni majuscules, pour comparer un mot à une glose. */
export function plat(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const HAN = /\p{Script=Han}/u;

/** Les sinogrammes d'une saisie, dans l'ordre, doublons compris. */
export function sinogrammes(s: string): string {
  return Array.from(s.normalize('NFC'))
    .filter((c) => HAN.test(c) || c === '〇')
    .join('');
}

type Lettre = { l: string; ton: number | null };
type Morceau = { lettres: Lettre[]; ton: number | null };

/**
 * Les morceaux d'une saisie en lettres : séparés par une espace, une apostrophe, un tiret ou
 * un chiffre de ton (`ni3hao` : `ni` au ton 3, puis `hao`). Le ü s'écrit aussi `v` ou `u:`.
 * Un diacritique donne son ton à la lettre qui le porte.
 */
function morceaux(s: string): Morceau[] | null {
  const d = s.normalize('NFD').toLowerCase().replace(/u:/g, 'v');
  const out: Morceau[] = [];
  let courant: Lettre[] = [];
  const fermer = (ton: number | null) => {
    if (courant.length > 0) out.push({ lettres: courant, ton });
    courant = [];
  };
  for (const c of Array.from(d)) {
    if (c >= 'a' && c <= 'z') {
      courant.push({ l: c, ton: null });
    } else if (c in TONS) {
      if (courant.length === 0) return null;
      courant[courant.length - 1].ton = TONS[c];
    } else if (c === '\u0308') {
      /* le tréma de ü : u + ¨ devient v */
      if (courant.length === 0 || courant[courant.length - 1].l !== 'u') return null;
      courant[courant.length - 1].l = 'v';
    } else if (/[0-5]/.test(c)) {
      if (courant.length === 0) return null;
      fermer(c === '0' ? 5 : Number(c));
    } else if (/[\s'’\-·]/.test(c)) {
      fermer(null);
    } else {
      return null;
    }
  }
  fermer(null);
  return out;
}

/** Les syllabes qu'une base tapée peut commencer : `ha` → hao, han, hang… */
function commence(base: string, table: Set<string>): boolean {
  for (const s of table) if (s.startsWith(base)) return true;
  return false;
}

/**
 * Tous les découpages d'un morceau par la table des syllabes, par programmation dynamique :
 * `xian` → xian, xi'an. `dernier` : la dernière syllabe peut n'être qu'un début.
 */
function decouperMorceau(m: Morceau, table: Set<string>, dernier: boolean): SyllabeTapee[][] {
  const lettres = m.lettres;
  const n = lettres.length;
  const memo = new Map<number, SyllabeTapee[][]>();
  const depuis = (i: number): SyllabeTapee[][] => {
    const deja = memo.get(i);
    if (deja) return deja;
    const res: SyllabeTapee[][] = [];
    for (let j = n; j > i && res.length < MAX_DECOUPAGES; j--) {
      const base = lettres
        .slice(i, j)
        .map((x) => x.l)
        .join('');
      const fin = j === n;
      const entiere = table.has(base);
      const debut = fin && dernier && m.ton === null && !entiere && commence(base, table);
      if (!entiere && !debut) continue;
      const tons = lettres.slice(i, j).filter((x) => x.ton !== null);
      let ton = tons.length > 0 ? tons[tons.length - 1].ton : null;
      if (fin && m.ton !== null) ton = m.ton;
      const syl: SyllabeTapee = { base, ton, prefixe: fin && dernier && m.ton === null };
      if (fin) res.push([syl]);
      else for (const suite of depuis(j)) res.push([syl, ...suite]);
    }
    memo.set(i, res.slice(0, MAX_DECOUPAGES));
    return memo.get(i) as SyllabeTapee[][];
  };
  return depuis(0);
}

/** Lit une saisie : ses sinogrammes, ses découpages en pinyin, sa forme à plat. */
export function lireSaisie(q: string, table: Set<string>): Saisie {
  const s = q.normalize('NFC').trim();
  const hanzi = sinogrammes(s);
  const mot = plat(s);
  if (s === '' || hanzi !== '') return { hanzi, decoupages: [], mot: hanzi !== '' ? '' : mot };
  const ms = morceaux(s);
  let decoupages: SyllabeTapee[][] = [[]];
  if (ms === null || ms.length === 0) return { hanzi, decoupages: [], mot };
  for (let k = 0; k < ms.length; k++) {
    const d = decouperMorceau(ms[k], table, k === ms.length - 1);
    if (d.length === 0) return { hanzi, decoupages: [], mot };
    const suite: SyllabeTapee[][] = [];
    for (const a of decoupages) for (const b of d) if (suite.length < MAX_DECOUPAGES) suite.push([...a, ...b]);
    decoupages = suite;
  }
  return { hanzi, decoupages, mot };
}

/* ---------- chercher ---------- */

export const RANG = {
  exact: 0,
  debut: 1,
  contient: 2,
  caractere: 3,
  pinyin: 4,
  prefixe: 5,
  francais: 6
} as const;
export type Rang = (typeof RANG)[keyof typeof RANG];

export type ResultatDico = EntreeDico & { rang: Rang; cle: number };
export type RechercheDico = { resultats: ResultatDico[]; total: number };

/** Une liste qui se lit en quelques coups de pouce. */
export const MAX_RESULTATS_DICO = 50;

function memeBase(tapee: string, lue: string, prefixe: boolean): 'exact' | 'debut' | null {
  for (const b of new Set([lue, sansTrema(lue)])) {
    if (b === tapee) return 'exact';
    if (prefixe && b.startsWith(tapee)) return 'debut';
  }
  return null;
}

/** Comment une lecture répond à un découpage : exactement, par son début, ou pas. */
export function accord(lecture: readonly Syllabe[], tapees: readonly SyllabeTapee[]): 'exact' | 'debut' | null {
  if (lecture.length !== tapees.length || lecture.length === 0) return null;
  let debut = false;
  for (let i = 0; i < lecture.length; i++) {
    const t = tapees[i];
    const m = memeBase(t.base, lecture[i].base, t.prefixe);
    if (m === null) return null;
    if (t.ton !== null && t.ton !== lecture[i].ton) return null;
    if (m === 'debut') debut = true;
  }
  return debut ? 'debut' : 'exact';
}

/** Un rang, et la clé qui départage d'abord deux résultats de ce rang. */
export type Classement = { rang: Rang; cle: number };

function rangHanzi(e: EntreeDico, hanzi: string): Classement | null {
  if (e.formes.some((f) => f === hanzi)) return { rang: RANG.exact, cle: 0 };
  if (e.genre === 'mot' && e.formes.some((f) => f.startsWith(hanzi))) return { rang: RANG.debut, cle: 0 };
  if (e.genre === 'mot' && e.formes.some((f) => f.includes(hanzi))) return { rang: RANG.contient, cle: 0 };
  const tapes = Array.from(hanzi);
  /* Plusieurs sinogrammes tapés ou collés : chacun répond, dans l'ordre de la saisie. */
  if (e.genre === 'caractere' && tapes.length > 1 && tapes.includes(e.id)) {
    return { rang: RANG.caractere, cle: tapes.indexOf(e.id) };
  }
  return null;
}

/**
 * La lecture principale d'abord : `xian` trouve 先 xiān avant 见, dont xiàn n'est qu'une
 * lecture seconde (clé 1). Un mot répond de même par sa lecture retenue avant sa lecture
 * pleine ou ses variantes.
 */
function rangPinyin(e: EntreeDico, decoupages: readonly SyllabeTapee[][]): Classement | null {
  let meilleur: Classement | null = null;
  e.lectures.forEach((l, i) => {
    const cle = i === 0 ? 0 : 1;
    for (const d of decoupages) {
      const a = accord(l, d);
      const c: Classement | null =
        a === 'exact' ? { rang: RANG.pinyin, cle } : a === 'debut' ? { rang: RANG.prefixe, cle } : null;
      if (c && (meilleur === null || c.rang < meilleur.rang || (c.rang === meilleur.rang && c.cle < meilleur.cle))) {
        meilleur = c;
      }
    }
  });
  return meilleur;
}

function rangFrancais(e: EntreeDico, mot: string): Classement | null {
  if (e.glose === '' || mot.length < 2) return null;
  const g = plat(e.glose);
  const jetons = g.split(/[^a-z0-9]+/).filter((x) => x !== '');
  /* Le mot entier d'abord (« an » : 年 avant 安静 « ancien »), puis le début d'un mot. */
  if (jetons.includes(mot)) return { rang: RANG.francais, cle: 0 };
  if (jetons.some((x) => x.startsWith(mot)) || (mot.includes(' ') && g.includes(mot))) {
    return { rang: RANG.francais, cle: 1 };
  }
  return null;
}

/** Le rang d'une entrée pour une saisie ; `null` : elle ne répond pas. */
export function rangDe(e: EntreeDico, s: Saisie): Classement | null {
  if (s.hanzi !== '') return rangHanzi(e, s.hanzi);
  return rangPinyin(e, s.decoupages) ?? rangFrancais(e, s.mot);
}

/** Le plus court d'abord : la graphie principale, en sinogrammes. */
function longueur(e: EntreeDico): number {
  return Array.from(e.formes[0] ?? '').length;
}

/**
 * L'ordre des résultats : le rang, sa clé (l'ordre de la saisie, le mot français entier),
 * puis le caractère avant le mot, le niveau croissant, le mot le plus court, l'index.
 */
export function comparer(a: ResultatDico, b: ResultatDico): number {
  return (
    a.rang - b.rang ||
    a.cle - b.cle ||
    (a.genre === b.genre ? 0 : a.genre === 'caractere' ? -1 : 1) ||
    a.niveau - b.niveau ||
    longueur(a) - longueur(b) ||
    a.ordre - b.ordre
  );
}

/** Cherche une saisie dans l'index. Ne charge rien : tout est dans l'index. */
export function chercherDico(q: string, index: IndexDico, max: number = MAX_RESULTATS_DICO): RechercheDico {
  const s = lireSaisie(q, index.syllabes);
  if (s.hanzi === '' && s.decoupages.length === 0 && s.mot.length < 2) return { resultats: [], total: 0 };
  const trouves: ResultatDico[] = [];
  for (const e of index.entrees) {
    const r = rangDe(e, s);
    if (r !== null) trouves.push({ ...e, ...r });
  }
  trouves.sort(comparer);
  return { resultats: trouves.slice(0, max), total: trouves.length };
}

/* ---------- les entrées des lots ---------- */

/** Une acception ; `pinyin` quand elle se lit autrement que la lecture principale (好 hào). */
export type Acception = { categorie: string; fr: string; pinyin?: string };
export type Sens = { statut: 'relu'; glose: string; acceptions: Acception[] };
export type Exemple = { zh: string; pinyin: string; fr: string };
export type Decomposition = { norme: string; parts: string[]; sources: string[] };

export type EntreeCaractere = {
  genre: 'caractere';
  c: string;
  pinyin: string;
  lectures: string[];
  niveau: number;
  /** La décomposition GF 0014-2009, `null` tant qu'elle n'est pas réconciliée. */
  decomposition: Decomposition | null;
  /** Les identifiants des mots qui le contiennent. */
  mots: string[];
  /** Le jour du chemin où il est posé, par parcours (`lire`, `hsk`). */
  chemin: Record<string, number>;
  sens: Sens | null;
  exemples: Exemple[];
};

export type FormeMot = { hanzi: string; pinyin: string; syllabes: string[] };

export type EntreeMot = {
  genre: 'mot';
  id: string;
  hanzi: string;
  pinyin: string;
  syllabes: string[];
  niveau: number;
  categories: string[];
  officiel: string;
  pleines: string[];
  variantes: FormeMot[];
  emploi: FormeMot | null;
  sens: Sens | null;
  exemples: Exemple[];
};

export const GLOSE_MAX = 40;

const chaine = (v: unknown): string => (typeof v === 'string' ? v : '');
const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Le sens qui se montre : relu, avec une glose de 40 caractères au plus. Tout autre sens,
 * même glissé dans un lot, n'est ni montré ni cherché.
 */
export function sensAffichable(v: unknown): Sens | null {
  const o = v as Record<string, unknown> | null;
  if (o === null || typeof o !== 'object' || o.statut !== 'relu') return null;
  const glose = chaine(o.glose).trim();
  if (glose === '' || glose.length > GLOSE_MAX) return null;
  const acceptions = Array.isArray(o.acceptions)
    ? o.acceptions
        .map((a) => a as Record<string, unknown>)
        .filter((a) => a !== null && typeof a === 'object' && chaine(a.fr) !== '')
        .map((a) => (chaine(a.pinyin) ? { categorie: chaine(a.categorie), fr: chaine(a.fr), pinyin: chaine(a.pinyin) } : { categorie: chaine(a.categorie), fr: chaine(a.fr) }))
    : [];
  return { statut: 'relu', glose, acceptions };
}

/**
 * Ce qu'un mot d'un seul caractère veut dire : il n'a pas de sens à lui (story 10.8), ses
 * emplois sont les acceptions du caractère de même catégorie et de même lecture. Une
 * acception sans lecture propre se lit à la lecture principale du caractère.
 */
export function acceptionsDEmploi(sens: { acceptions: Acception[] } | null, mot: Pick<EntreeMot, 'categories' | 'pinyin'>, principal: string): Acception[] {
  if (sens === null) return [];
  return sens.acceptions.filter(
    (a) => mot.categories.includes(a.categorie) && (a.pinyin ?? principal) === mot.pinyin
  );
}

/** Les phrases d'exemple relues, et elles seules. */
export function exemplesAffichables(v: unknown): Exemple[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => x as Record<string, unknown>)
    .filter((x) => x !== null && typeof x === 'object' && x.statut === 'relu' && chaine(x.zh) !== '')
    .map((x) => ({ zh: chaine(x.zh), pinyin: chaine(x.pinyin), fr: chaine(x.fr) }));
}

function forme(v: unknown): FormeMot | null {
  const o = v as Record<string, unknown> | null;
  if (o === null || typeof o !== 'object' || chaine(o.hanzi) === '') return null;
  return { hanzi: chaine(o.hanzi), pinyin: chaine(o.pinyin), syllabes: chaines(o.syllabes) };
}

export function lireEntreeCaractere(v: unknown): EntreeCaractere | null {
  const o = v as Record<string, unknown> | null;
  if (o === null || typeof o !== 'object' || chaine(o.c) === '') return null;
  const d = o.decomposition as Record<string, unknown> | null | undefined;
  const chemin: Record<string, number> = {};
  for (const [k, x] of Object.entries((o.chemin ?? {}) as Record<string, unknown>)) {
    if (Number.isInteger(x)) chemin[k] = x as number;
  }
  return {
    genre: 'caractere',
    c: chaine(o.c),
    pinyin: chaine(o.pinyin),
    lectures: chaines(o.lectures),
    niveau: Number(o.niveau) || 0,
    decomposition:
      d && typeof d === 'object' ? { norme: chaine(d.norme), parts: chaines(d.parts), sources: chaines(d.sources) } : null,
    mots: chaines(o.mots),
    chemin,
    sens: sensAffichable(o.sens),
    exemples: exemplesAffichables(o.exemples)
  };
}

export function lireEntreeMot(v: unknown): EntreeMot | null {
  const o = v as Record<string, unknown> | null;
  if (o === null || typeof o !== 'object' || chaine(o.id) === '') return null;
  return {
    genre: 'mot',
    id: chaine(o.id),
    hanzi: chaine(o.hanzi),
    pinyin: chaine(o.pinyin),
    syllabes: chaines(o.syllabes),
    niveau: Number(o.niveau) || 0,
    categories: chaines(o.categories),
    officiel: chaine(o.officiel),
    pleines: chaines(o.pleines),
    variantes: (Array.isArray(o.variantes) ? o.variantes : []).map(forme).filter((x): x is FormeMot => x !== null),
    emploi: forme(o.emploi),
    sens: sensAffichable(o.sens),
    exemples: exemplesAffichables(o.exemples)
  };
}

/* ---------- le chargement paresseux ---------- */

/** Le chemin d'un lot : `dico/caracteres/{lot}.json` → `dico/caracteres/7.json`. */
export function cheminLot(modele: string, lot: number): string {
  return modele.replace('{lot}', String(lot));
}

/**
 * L'URL d'un lot, marquée de l'empreinte de l'export : le service worker garde les lots
 * lus (`CacheFirst`, `vite.config.ts`) sous leur URL entière, si bien qu'un nouvel export,
 * qui change l'empreinte, ne sert jamais un lot d'hier avec l'index d'aujourd'hui. L'index,
 * lui, est précaché sous son URL nue.
 */
export function urlDeLot(dossier: string, relatif: string, revision: string): string {
  return revision === '' ? `${dossier}${relatif}` : `${dossier}${relatif}?v=${encodeURIComponent(revision)}`;
}

/**
 * Le chargeur d'un dictionnaire exporté. `dossier` est l'URL du dossier de version, servi
 * avec l'app (`${BASE_URL}data/0.1.0/`), `index` le chemin de l'index dans ce dossier,
 * `revision` l'empreinte de l'export (`index.json`), qui marque l'URL des lots.
 * Chaque fichier n'est demandé qu'une fois ; un échec n'est pas retenu, la demande suivante
 * réessaie.
 */
export class ChargeurDico {
  private fichiers = new Map<string, Promise<unknown>>();
  private indexLu: Promise<IndexDico> | null = null;

  constructor(
    private readonly dossier: string,
    private readonly index: string = 'dico/index.json',
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
    private readonly revision: string = ''
  ) {}

  /** Un fichier du dossier de version, une seule requête pour toute la vie du chargeur. */
  private lire(relatif: string): Promise<unknown> {
    let p = this.fichiers.get(relatif);
    if (!p) {
      const url = relatif === this.index ? `${this.dossier}${relatif}` : urlDeLot(this.dossier, relatif, this.revision);
      p = this.fetchFn(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Dictionnaire introuvable : ${relatif} (${r.status})`);
          return r.json() as Promise<unknown>;
        })
        .catch((e) => {
          this.fichiers.delete(relatif);
          throw e;
        });
      this.fichiers.set(relatif, p);
    }
    return p;
  }

  /** Les chemins déjà demandés : ce qu'un écran a coûté. */
  demandes(): string[] {
    return [...this.fichiers.keys()];
  }

  /** L'index, chargé une fois : de quoi chercher. */
  chargerIndex(): Promise<IndexDico> {
    if (!this.indexLu) {
      this.indexLu = this.lire(this.index)
        .then(lireIndexDico)
        .catch((e) => {
          this.indexLu = null;
          throw e;
        });
    }
    return this.indexLu;
  }

  /** Cherche : l'index seul, aucun lot. */
  async chercher(q: string, max: number = MAX_RESULTATS_DICO): Promise<RechercheDico> {
    return chercherDico(q, await this.chargerIndex(), max);
  }

  private async entreeBrute(genre: Genre, id: string, lot: number): Promise<unknown> {
    const i = await this.chargerIndex();
    const modele = genre === 'caractere' ? i.fichiers.caracteres : i.fichiers.mots;
    const doc = (await this.lire(cheminLot(modele, lot))) as { entrees?: Record<string, unknown> };
    return doc?.entrees?.[id] ?? null;
  }

  /** L'entrée d'un caractère, son lot chargé à la demande ; `null` hors du dictionnaire. */
  async caractere(c: string): Promise<EntreeCaractere | null> {
    const i = await this.chargerIndex();
    const e = i.entrees.find((x) => x.genre === 'caractere' && x.id === c);
    return e ? lireEntreeCaractere(await this.entreeBrute('caractere', c, e.lot)) : null;
  }

  /** L'entrée d'un mot, par son identifiant ; `null` s'il n'y est pas. */
  async mot(id: string): Promise<EntreeMot | null> {
    const i = await this.chargerIndex();
    const e = i.entrees.find((x) => x.genre === 'mot' && x.id === id);
    return e ? lireEntreeMot(await this.entreeBrute('mot', id, e.lot)) : null;
  }

  /** L'entrée d'un résultat de recherche. */
  entree(r: Pick<EntreeDico, 'genre' | 'id'>): Promise<EntreeCaractere | EntreeMot | null> {
    return r.genre === 'caractere' ? this.caractere(r.id) : this.mot(r.id);
  }

  /** Le lot de traits d'un caractère ou d'un composant ; `null` s'il n'en a pas. */
  async lotDeTraits(c: string): Promise<number | null> {
    const i = await this.chargerIndex();
    const e = i.entrees.find((x) => x.genre === 'caractere' && x.id === c);
    if (e) return e.lot;
    return c in i.traitsHorsListe ? i.traitsHorsListe[c] : null;
  }

  /** Les tracés d'un caractère (style 楷), pris dans son lot ; `null` s'il n'y est pas. */
  async traits(c: string): Promise<StrokeData | null> {
    const lot = await this.lotDeTraits(c);
    if (lot === null) return null;
    const i = await this.chargerIndex();
    const set = lireTraits(await this.lire(cheminLot(i.fichiers.traits, lot)));
    return set[c] ?? null;
  }
}
