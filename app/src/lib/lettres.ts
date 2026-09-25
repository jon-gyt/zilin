/**
 * Les lettres de Que (story 4b.8) : un feuilleton hebdomadaire écrit avec l'acquis.
 *
 * Que 雀, le moineau ami de Tao, écrit une lettre par semaine, douze en tout. Le pipeline
 * (`wenlu lettres`) les rédige avec les seuls caractères que le parcours Lire a posés au
 * jour 7n ; l'export n'en porte que les lettres relues (`lettres.json`), l'aperçu celles
 * à relire (`apercu/lettres.json`). Ce module lit ces fichiers et décide, sans horloge ni
 * stockage, quand une lettre arrive.
 *
 * La règle d'arrivée, simple et documentée :
 * - la semaine commence le dimanche ;
 * - la lettre suivante du feuilleton, et elle seule, arrive le dimanche ; si l'on n'a pas
 *   fait de session ce dimanche-là, elle arrive à la première session de la semaine qui
 *   suit (du lundi au samedi) — ni plus tôt, ni un autre jour de la semaine ;
 * - pourvu que tous ses caractères aient déjà une carte : posés par le parcours, qu'on
 *   suive Lire ou HSK. Sinon elle attend la semaine suivante ;
 * - une lettre au plus par semaine, sans rattrapage : elles ne s'empilent jamais, et
 *   aucune ne se perd. Une lettre non lue reste dans Lire, sans compteur.
 *
 * Seules les lettres relues arrivent. En mode relecture (Réglages), toutes les lettres,
 * relues ou à relire, s'ouvrent dans Lire, marquées ; ce que ce mode ouvre ne compte pas
 * comme lu. Une lettre lue le note dans la progression (`Progress.lettres`), pas de point.
 */
import {
  STATUT_A_RELIRE,
  apercuActif,
  contenu,
  dossierVersion,
  VERSION_DONNEES,
  type PhraseConte,
  type VersionConte
} from './content';
import { estHan } from './lecture';
import type { Progress } from './session';

/* ---------- le contenu ---------- */

/** Une lettre du feuilleton, telle que l'export la donne. */
export type Lettre = {
  /** Son rang dans le feuilleton, de 1 à 12. */
  n: number;
  /** Le jour du parcours Lire dont elle suit l'acquis : 7n. */
  jour: number;
  titre_fr: string;
  titre_en: string;
  phrases: PhraseConte[];
  /** La glose au toucher : l'entrée (caractère ou mot) et son sens en français. */
  glose: Record<string, string>;
  /** `a_relire` pour une lettre de l'aperçu, qui porte alors la mention « à relire ». */
  statut?: typeof STATUT_A_RELIRE;
};

function chaine(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Relit `lettres.json` ou `apercu/lettres.json`. Une lettre sans numéro ni phrase est écartée. */
export function lireLettres(brut: unknown): Lettre[] {
  if (brut === null || typeof brut !== 'object') return [];
  const liste = (brut as Record<string, unknown>).lettres;
  if (!Array.isArray(liste)) return [];
  const out: Lettre[] = [];
  for (const x of liste) {
    if (x === null || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const n = typeof o.n === 'number' && Number.isInteger(o.n) && o.n > 0 ? o.n : 0;
    if (n === 0 || out.some((l) => l.n === n)) continue;
    const phrases: PhraseConte[] = [];
    for (const ph of Array.isArray(o.phrases) ? o.phrases : []) {
      if (ph === null || typeof ph !== 'object') continue;
      const p = ph as Record<string, unknown>;
      if (chaine(p.zh) !== '') phrases.push({ zh: chaine(p.zh), pinyin: chaine(p.pinyin), fr: chaine(p.fr) });
    }
    if (phrases.length === 0) continue;
    const glose: Record<string, string> = {};
    if (o.glose !== null && typeof o.glose === 'object') {
      for (const [k, g] of Object.entries(o.glose as Record<string, unknown>)) {
        const fr =
          typeof g === 'string'
            ? g
            : g !== null && typeof g === 'object'
              ? chaine((g as Record<string, unknown>).fr)
              : '';
        if (k !== '' && fr !== '') glose[k] = fr;
      }
    }
    const lettre: Lettre = {
      n,
      jour: typeof o.jour === 'number' ? o.jour : 7 * n,
      titre_fr: chaine(o.titre_fr),
      titre_en: chaine(o.titre_en),
      phrases,
      glose
    };
    if (o.statut === STATUT_A_RELIRE) lettre.statut = STATUT_A_RELIRE;
    out.push(lettre);
  }
  return out.sort((a, b) => a.n - b.n);
}

/**
 * Les lettres de l'export et, en mode relecture, celles de l'aperçu, réunies : une lettre
 * relue passe devant la lettre à relire du même rang.
 */
export function fusionnerLettres(relues: readonly Lettre[], apercu: readonly Lettre[]): Lettre[] {
  const out = [...relues];
  for (const l of apercu) {
    if (!out.some((x) => x.n === l.n)) out.push({ ...l, statut: STATUT_A_RELIRE });
  }
  return out.sort((a, b) => a.n - b.n);
}

async function lireFichier(file: string, fetchFn: typeof fetch): Promise<Lettre[]> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Lettres introuvables : ${file} (${r.status})`);
  return lireLettres(await r.json());
}

/** Les lettres relues de l'export, lues une fois. Un export sans lettres en donne zéro. */
export async function lettresRelues(
  version = VERSION_DONNEES,
  fetchFn: typeof fetch = fetch
): Promise<Lettre[]> {
  const i = await contenu(version);
  if (i.lettres === '') return [];
  return lireFichier(`${dossierVersion(version)}/${i.lettres}`, fetchFn);
}

/**
 * Ce que Lire montre : les lettres relues, et, l'aperçu allumé, celles à relire. Éteint,
 * aucun fichier de l'aperçu n'est demandé.
 */
export async function lettresExport(
  version = VERSION_DONNEES,
  fetchFn: typeof fetch = fetch
): Promise<Lettre[]> {
  const relues = await lettresRelues(version, fetchFn).catch(() => []);
  if (!apercuActif()) return relues;
  const i = await contenu(version);
  if (i.apercu === '') return relues;
  const r = await fetchFn(`${import.meta.env.BASE_URL}${dossierVersion(version)}/${i.apercu}`).catch(() => null);
  if (!r || !r.ok) return relues;
  const index = (await r.json()) as Record<string, unknown>;
  if (typeof index.lettres !== 'string' || index.lettres === '') return relues;
  const apercu = await lireFichier(`${dossierVersion(version)}/${index.lettres}`, fetchFn).catch(() => []);
  return fusionnerLettres(relues, apercu);
}

/** Les caractères distincts d'une lettre, dans l'ordre d'apparition. */
export function caracteresDeLettre(l: Lettre): string[] {
  const vus = new Set<string>();
  for (const p of l.phrases) for (const c of Array.from(p.zh)) if (estHan(c)) vus.add(c);
  return [...vus];
}

/** La lettre telle que le lecteur des contes la lit : pas de titre chinois, pas de seuil. */
export function versionDeLettre(l: Lettre): VersionConte {
  const v: VersionConte = { seuil: '', titre: '', phrases: l.phrases, glose: l.glose };
  if (l.statut === STATUT_A_RELIRE) v.statut = STATUT_A_RELIRE;
  return v;
}

/* ---------- la progression ---------- */

/** Une lettre arrivée : sa journée d'arrivée, et celle où elle a été lue. */
export type LettreNotee = { n: number; arrivee: string; lue: string | null };

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Relit les lettres notées d'un export de progression. Absentes : aucune. */
export function lireLettresNotees(v: unknown): LettreNotee[] {
  if (!Array.isArray(v)) return [];
  const out: LettreNotee[] = [];
  for (const x of v) {
    if (x === null || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.n !== 'number' || !Number.isInteger(o.n) || o.n <= 0) continue;
    if (typeof o.arrivee !== 'string' || !FORMAT_JOUR.test(o.arrivee)) continue;
    if (out.some((l) => l.n === o.n)) continue;
    const lue = typeof o.lue === 'string' && FORMAT_JOUR.test(o.lue) ? o.lue : null;
    out.push({ n: o.n, arrivee: o.arrivee, lue });
  }
  return out.sort((a, b) => a.n - b.n);
}

/** Le dimanche qui ouvre la semaine d'une journée (AAAA-MM-JJ) : elle-même si c'est un dimanche. */
export function dimancheDe(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/**
 * La lettre qui arrive ce jour-là, ou `null`. Voir la règle en tête du module : la suivante
 * du feuilleton, relue, une semaine après la précédente au moins, le dimanche ou à la
 * première session de la semaine, tous ses caractères posés.
 */
export function lettreQuiArrive(
  lettres: readonly Lettre[],
  notees: readonly LettreNotee[],
  poses: ReadonlySet<string>,
  jour: string,
  joursTravailles: readonly string[]
): Lettre | null {
  const suivante = notees.length + 1;
  const l = lettres.find((x) => x.n === suivante && x.statut !== STATUT_A_RELIRE);
  if (!l) return null;
  const dimanche = dimancheDe(jour);
  const derniere = notees[notees.length - 1];
  if (derniere && dimancheDe(derniere.arrivee) >= dimanche) return null;
  const premiereSession = jour === dimanche || !joursTravailles.some((j) => j >= dimanche && j < jour);
  if (!premiereSession) return null;
  return caracteresDeLettre(l).every((c) => poses.has(c)) ? l : null;
}

/** Note l'arrivée de la lettre du jour, s'il y en a une. Rend `p` tel quel sinon. */
export function ouvrirLettreDuJour(p: Progress, lettres: readonly Lettre[], jour: string): Progress {
  const poses = new Set(p.cartes.map((k) => k.id));
  const l = lettreQuiArrive(lettres, p.lettres, poses, jour, p.joursTravailles);
  if (l === null) return p;
  return { ...p, lettres: [...p.lettres, { n: l.n, arrivee: jour, lue: null }] };
}

/** Note une lettre arrivée comme lue, une fois. Une lettre pas encore arrivée ne se note pas. */
export function noterLettreLue(p: Progress, n: number, jour: string): Progress {
  const l = p.lettres.find((x) => x.n === n);
  if (!l || l.lue !== null) return p;
  return { ...p, lettres: p.lettres.map((x) => (x.n === n ? { ...x, lue: jour } : x)) };
}

/** La lettre à annoncer au menu : arrivée cette semaine, pas encore lue. */
export function lettreAnnoncee(notees: readonly LettreNotee[], jour: string): LettreNotee | null {
  const dimanche = dimancheDe(jour);
  return notees.find((l) => l.lue === null && dimancheDe(l.arrivee) === dimanche) ?? null;
}

/** La ligne de la case Lire du menu, le jour où une lettre attend. */
export const ANNONCE_LETTRE = 'Une lettre de Que';

/* ---------- la section de Lire ---------- */

/** Une lettre dans la section « Lettres de Que » de Lire. */
export type EntreeLettre = {
  lettre: Lettre;
  /** Arrivée cette semaine et pas encore lue : elle porte « nouvelle ». */
  nouvelle: boolean;
  lue: boolean;
  /** Mode relecture : la lettre n'est pas encore arrivée, elle s'ouvre quand même. */
  horsArrivee: boolean;
  /** Ni arrivée, ni relue : la lire ne la note pas. */
  sansCompte: boolean;
};

/** La mention d'une lettre que seul le mode relecture ouvre. */
export const MENTION_PAS_ARRIVEE = 'pas encore arrivée';

/**
 * Les lettres de la section, dans l'ordre du feuilleton : celles arrivées ; en mode
 * relecture, toutes, marquées.
 */
export function entreesLettres(
  lettres: readonly Lettre[],
  notees: readonly LettreNotee[],
  jour: string,
  relecture = false
): EntreeLettre[] {
  const annoncee = lettreAnnoncee(notees, jour);
  const out: EntreeLettre[] = [];
  for (const l of lettres) {
    const notee = notees.find((x) => x.n === l.n) ?? null;
    const arrivee = notee !== null && l.statut !== STATUT_A_RELIRE;
    if (!arrivee && !relecture) continue;
    out.push({
      lettre: l,
      nouvelle: arrivee && annoncee?.n === l.n,
      lue: notee?.lue != null,
      horsArrivee: !arrivee,
      sansCompte: !arrivee
    });
  }
  return out;
}

/** La ligne de la section tant qu'aucune lettre n'est arrivée. */
export const LIGNE_AVANT_LETTRE =
  'Que écrit le dimanche, avec les caractères que tu sais lire. Sa première lettre arrive après ta première semaine.';
