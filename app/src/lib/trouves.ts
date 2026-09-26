/**
 * Les caractères trouvés en chemin : ceux que l'anecdote d'une fête ou d'un terme solaire
 * fait découvrir (年, 灯, 月 aux fêtes ; 露, 霜, 雪 aux termes), et le décor du cercle de Ma
 * forêt, le jour d'une fête ou d'un terme.
 *
 * Module pur, comme `foret.ts` : aucune fonction ne lit l'horloge, n'écrit dans un stockage
 * ni ne touche au DOM. La journée est passée en argument, les textes viennent de
 * `fetes.json` et de `saisons.json`.
 *
 * Un caractère trouvé n'est pas une brique du parcours : il n'a pas de carte FSRS et
 * n'entre jamais en révision. La progression le garde une fois, avec la journée où il a
 * été trouvé et la fête ou le terme qui l'a apporté ; Ma forêt en fait une petite
 * collection, et le tableau des trophées les compte.
 */
import type { FeteId, Fetes, Saisons } from './content';
import { FETES } from './content';
import { pistes as pistesFete } from './fetes';
import type { Progress } from './session';
import {
  anecdoteDeFete,
  annonceLeTerme,
  pistes as pistesTerme,
  type AnecdoteDeLaJournee,
  type Journee,
  type Theme
} from './saisons';

/* ---------- la rencontre du jour ---------- */

/** Ce que l'anecdote du jour fait découvrir : un caractère, et qui l'apporte. */
export type Rencontre = { c: string; fete: FeteId } | { c: string; terme: string };

/** Un caractère trouvé, gardé dans la progression : une entrée par caractère. */
export type Trouve = {
  c: string;
  /** La journée où il a été trouvé (AAAA-MM-JJ). */
  jour: string;
  /** La fête dont l'anecdote l'a apporté… */
  fete?: FeteId;
  /** … ou le terme solaire, par son identifiant (`bailu`). */
  terme?: string;
};

/**
 * Le caractère que l'anecdote du jour fait découvrir. Un jour de fête, celui de la fête,
 * le jour où son anecdote se montre (`anecdoteDeFete` : une fois par occurrence, d'après
 * `fetesVues`) ; le jour où un terme commence, celui du terme, sauf un jour de fête ; les
 * autres jours, aucun.
 */
export function rencontreDuJour(
  j: Journee,
  fetesVues: Readonly<Record<string, string>>,
  jour: string
): Rencontre | null {
  if (j.fete) {
    if (!anecdoteDeFete(j.fete, fetesVues, jour) || j.fete.anecdote.c === '') return null;
    return { c: j.fete.anecdote.c, fete: j.fete.id };
  }
  if (j.terme && annonceLeTerme(j.fete, j.terme) && j.terme.caractere.c !== '') {
    return { c: j.terme.caractere.c, terme: j.terme.id };
  }
  return null;
}

/** Le caractère qu'une anecdote montrée fait découvrir : celui de sa fête ou de son terme. */
export function rencontreDe(r: AnecdoteDeLaJournee): Rencontre | null {
  if (r.a.c === '') return null;
  if (r.fete) return { c: r.a.c, fete: r.fete.id };
  if (r.terme) return { c: r.a.c, terme: r.terme.id };
  return null;
}

/**
 * Note un caractère trouvé. Chaque caractère compte une fois : trouvé de nouveau — le
 * lendemain d'une fête de quinze jours, ou 冬 au solstice après 立冬 —, il garde sa
 * première journée et sa première source. Rien de nouveau : l'état est rendu tel quel.
 */
export function noterTrouve(p: Progress, r: Rencontre | null, jour: string): Progress {
  if (r === null || r.c === '' || !FORMAT_JOUR.test(jour)) return p;
  if (p.trouves.some((t) => t.c === r.c)) return p;
  const t: Trouve = 'fete' in r ? { c: r.c, jour, fete: r.fete } : { c: r.c, jour, terme: r.terme };
  return { ...p, trouves: [...p.trouves, t] };
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function estFete(v: unknown): v is FeteId {
  return typeof v === 'string' && (FETES as readonly string[]).includes(v);
}

/**
 * Relit les caractères trouvés d'un export. Une entrée sans caractère, sans journée
 * lisible ou sans source est écartée ; un caractère en double garde sa première entrée.
 * Absents d'un export plus ancien : aucun.
 */
export function lireTrouves(v: unknown): Trouve[] {
  if (!Array.isArray(v)) return [];
  const out: Trouve[] = [];
  for (const x of v) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    if (typeof o.c !== 'string' || o.c === '' || out.some((t) => t.c === o.c)) continue;
    if (typeof o.jour !== 'string' || !FORMAT_JOUR.test(o.jour)) continue;
    if (estFete(o.fete)) out.push({ c: o.c, jour: o.jour, fete: o.fete });
    else if (typeof o.terme === 'string' && o.terme !== '') {
      out.push({ c: o.c, jour: o.jour, terme: o.terme });
    }
  }
  return out;
}

/* ---------- la collection de Ma forêt ---------- */

/** Un caractère trouvé, tel que Ma forêt le montre. */
export type Piece = {
  c: string;
  pinyin: string;
  sens: string;
  jour: string;
  /** Le nom de la fête ou du terme : « Fête de la mi-automne », « la rosée blanche ». */
  nom: string;
  /** Son nom chinois : 中秋节, 白露. */
  nomZh: string;
  source: 'fete' | 'terme';
  /** La famille du caractère, pour lire ses traits sans relire tout l'export. */
  pistes: string[];
};

/**
 * La collection « trouvés en chemin », dans l'ordre où ils ont été trouvés. Seuls les
 * caractères dont la fête ou le terme est encore dans le contenu y paraissent : on ne
 * montre jamais un nom inventé. Vide tant que rien n'a été trouvé, et alors Ma forêt ne
 * montre pas la collection.
 */
export function collection(
  trouves: readonly Trouve[],
  fetes: Fetes | null,
  saisons: Saisons | null
): Piece[] {
  const out: Piece[] = [];
  for (const t of trouves) {
    if (t.fete !== undefined) {
      const f = fetes?.fetes[t.fete];
      if (!f || !fetes) continue;
      out.push({
        c: t.c,
        pinyin: f.anecdote.c === t.c ? (f.anecdote.pinyin ?? '') : '',
        sens: f.anecdote.c === t.c ? (f.anecdote.sens ?? '') : '',
        jour: t.jour,
        nom: f.nom,
        nomZh: f.nom_zh,
        source: 'fete',
        pistes: pistesFete(fetes, t.c)
      });
    } else if (t.terme !== undefined) {
      const x = saisons?.termes[t.terme];
      if (!x || !saisons) continue;
      out.push({
        c: t.c,
        pinyin: x.caractere.c === t.c ? x.caractere.pinyin : '',
        sens: x.caractere.c === t.c ? x.caractere.sens : '',
        jour: t.jour,
        nom: x.fr,
        nomZh: x.nom_zh,
        source: 'terme',
        pistes: pistesTerme(saisons, t.c)
      });
    }
  }
  return out;
}

/** Ma forêt ne montre la collection qu'une fois un caractère trouvé. */
export function montrerCollection(pieces: readonly Piece[]): boolean {
  return pieces.length > 0;
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre'
];

/** « le 25 septembre 2026 ». Vide pour une date illisible. */
export function leJour(jour: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  const mois = m ? MOIS[Number(m[2]) - 1] : undefined;
  if (!m || mois === undefined) return '';
  const j = Number(m[3]);
  return `le ${j === 1 ? '1er' : j} ${mois} ${m[1]}`;
}

/**
 * Ce que Ma forêt dit d'un caractère touché, en une ligne : d'où il vient et quand.
 * « Fête de la mi-automne 中秋节, le 25 septembre 2026 » ; « 白露, la rosée blanche, le
 * 7 septembre 2026 ».
 */
export function ligneTrouve(x: Piece): string {
  const quand = leJour(x.jour);
  const ou = x.source === 'fete' ? `${x.nom} ${x.nomZh}` : `${x.nomZh}, ${x.nom}`;
  return quand === '' ? ou : `${ou}, ${quand}`;
}

/* ---------- le décor du cercle ---------- */

/**
 * Le décor du cercle de Ma forêt : la fête s'il y en a une, sinon l'ambiance du terme,
 * sinon aucun. Même règle que le thème de l'app (`saisons.theme`) : la fête a priorité.
 */
export type DecorCercle = { fete: FeteId; saison?: undefined } | { fete?: undefined; saison: string };

export function decorDuCercle(t: Theme): DecorCercle | null {
  if (t.fete) return { fete: t.fete };
  if (t.saison) return { saison: t.saison };
  return null;
}
