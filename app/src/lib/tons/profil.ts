/**
 * Le profil de tons d'un mot de deux syllabes, reconnu d'un bloc (story 9.1, décision du
 * propriétaire du 4 octobre 2026, « Revoir la méthode des mots » ; mesures dans
 * `data/sources/tons/PROVENANCE.md`).
 *
 * Les syllabes d'un mot ne sont pas des caractères isolés : le ton 3 final est craqué ou à
 * peine descendu, le neutre est bref et sa hauteur dépend du ton qui précède, la frontière
 * déborde d'une syllabe sur l'autre. Au lieu de classer chaque syllabe seule, le modèle des
 * mots lit le mot entier (les deux syllabes que `segmenter` découpe, leurs formes, leurs
 * hauteurs face à la voix et l'une face à l'autre, leurs durées) et donne la probabilité de
 * chacun des 19 profils qu'une voix peut faire : 4 × 4 tons pleins, ou le neutre en seconde
 * syllabe, sans 3-3 (deux tons 3 de suite se disent 2-3 ; 不 et 一 sont étiquetés par le ton
 * qu'on dit).
 *
 * Le modèle est une donnée (`Modele` de `classifieur.ts`, mêmes perceptrons) ; le modèle des
 * caractères (`tons.json`) reste tel quel, et la notation des caractères isolés ne change pas.
 * Module pur.
 */
import { demiTons } from './pitch';
import type { Contour, Membre, Ton, Verdict } from './classifieur';

/** Les profils de tons d'un mot, dans l'ordre de la sortie du modèle. */
export const PROFILS: readonly (readonly [Ton, Ton])[] = (() => {
  const out: [Ton, Ton][] = [];
  for (const a of [1, 2, 3, 4] as Ton[]) for (const b of [1, 2, 3, 4, 5] as Ton[]) if (!(a === 3 && b === 3)) out.push([a, b]);
  return out;
})();

/** Le rang d'un profil dans `PROFILS`, -1 s'il n'en est pas un (un neutre en tête, 3-3). */
export function rangProfil(tons: readonly number[]): number {
  return tons.length !== 2 ? -1 : PROFILS.findIndex(([a, b]) => a === tons[0] && b === tons[1]);
}

/** Points de la forme de chaque syllabe : la moyenne de deux points voisins des 30 du contour (`N_POINTS`). */
export const POINTS_SYLLABE = 15;
/** Les entrées : par syllabe, sa forme, sa hauteur face à la voix, sa durée, son voisement ; puis la voix connue ou non, et l'écart de hauteur entre les deux. */
export const N_ENTREES_MOT = 2 * (POINTS_SYLLABE + 3) + 2;
/** Durée de référence d'une syllabe de mot. */
export const DUREE_SYLLABE_MOT = 0.2;

/**
 * Le vecteur d'entrée d'un mot. `ref` : la moyenne (Hz) de la voix de l'apprenant
 * (`voix.ts`) ; sans elle, les hauteurs face à la voix valent 0 et l'indicateur le dit, mais
 * l'écart entre les deux syllabes reste lisible.
 */
export function entreesMot(contours: readonly Contour[], ref?: number): number[] {
  if (contours.length !== 2) throw new Error('Un mot de deux syllabes');
  const aRef = ref !== undefined && ref > 0;
  const x: number[] = [];
  for (const c of contours) {
    for (let i = 0; i < POINTS_SYLLABE; i++) x.push((c.points[2 * i] + c.points[2 * i + 1]) / 2);
    x.push(aRef ? demiTons(c.moyenne, ref) : 0);
    x.push(Math.log2(Math.max(c.duree, 0.02) / DUREE_SYLLABE_MOT));
    x.push(c.voisement);
  }
  x.push(aRef ? 1 : 0);
  x.push(demiTons(contours[1].moyenne, contours[0].moyenne));
  return x;
}

/** Le modèle des mots : des perceptrons comme ceux des caractères, une sortie par profil. */
export interface ModeleMots {
  format: 'wenlu-tons-mots';
  version: string;
  /** Les profils de la sortie, `[ton 1, ton 2]`, dans l'ordre de `PROFILS`. */
  profils: number[][];
  entrees: number;
  membres: Membre[];
  temperature: number;
  /**
   * L'exposant du modèle des mots quand il est mêlé au modèle des caractères (`probabilitesMot`) :
   * 0, les caractères seuls ; 1, à parts égales. Réglé sur le développement, écrit par l'entraînement.
   */
  melange?: number;
  /** Les seuils du jugement, réglés avec le mélange (`SEUILS_PROFIL` sinon). */
  seuils?: Partial<typeof SEUILS_PROFIL>;
  licence?: unknown;
  entrainement?: unknown;
}

/** Refuse un modèle mal formé : sans lui, la question de mot ne se pose pas. */
export function verifierModeleMots(m: ModeleMots): void {
  if (m.format !== 'wenlu-tons-mots') throw new Error('Format de modèle des mots inconnu');
  if (m.entrees !== N_ENTREES_MOT) throw new Error(`Le modèle des mots attend ${m.entrees} entrées, pas ${N_ENTREES_MOT}`);
  if (m.profils?.length !== PROFILS.length || m.profils.some((p, i) => p[0] !== PROFILS[i][0] || p[1] !== PROFILS[i][1])) {
    throw new Error('Profils inattendus');
  }
  if (!m.membres?.length) throw new Error('Modèle sans membre');
  for (const mb of m.membres) {
    if (mb.normalisation.moyenne.length !== m.entrees || mb.normalisation.ecart.length !== m.entrees) throw new Error('Normalisation mal formée');
    let n = m.entrees;
    for (const c of mb.couches) {
      if (c.poids.length !== c.biais.length || c.poids.some((l) => l.length !== n)) throw new Error('Couche mal formée');
      n = c.biais.length;
    }
    if (n !== PROFILS.length) throw new Error('Sortie et profils ne concordent pas');
  }
}

/** Relit un modèle des mots : le modèle, ou `null`. */
export function lireModeleMots(brut: unknown): ModeleMots | null {
  try {
    const m = brut as ModeleMots;
    verifierModeleMots(m);
    return m;
  } catch {
    return null;
  }
}

function membre(mb: Membre, x: readonly number[], t: number): number[] {
  const { moyenne, ecart } = mb.normalisation;
  let h = x.map((v, i) => (v - moyenne[i]) / ecart[i]);
  mb.couches.forEach((c, k) => {
    const der = k === mb.couches.length - 1;
    h = c.biais.map((b, o) => {
      let s = b;
      for (let i = 0; i < h.length; i++) s += c.poids[o][i] * h[i];
      return der ? s : Math.max(0, s);
    });
  });
  const mx = Math.max(...h);
  const e = h.map((v) => Math.exp((v - mx) / t));
  const z = e.reduce((s, v) => s + v, 0);
  return e.map((v) => v / z);
}

/** Les probabilités des profils, dans l'ordre de `PROFILS` : moyenne des membres. */
export function probabilitesProfils(m: ModeleMots, x: readonly number[]): number[] {
  const s = PROFILS.map(() => 0);
  for (const mb of m.membres) membre(mb, x, m.temperature || 1).forEach((p, i) => (s[i] += p));
  return s.map((v) => v / m.membres.length);
}

/**
 * Les probabilités des profils d'un mot : le modèle des mots, mêlé au modèle des caractères
 * quand on lui donne les probabilités des deux syllabes (`syllabes`, tons 1 à 5 de chacune,
 * `classifieur.probabilitesSyllabe` avec les réglages des mots) : la probabilité d'un profil
 * est proportionnelle à (modèle des mots)^`melange` × p(ton 1) × p(ton 2).
 */
export function probabilitesMot(m: ModeleMots, x: readonly number[], syllabes: readonly (readonly number[])[] | null = null): number[] {
  const pw = probabilitesProfils(m, x);
  if (syllabes === null || syllabes.length !== 2) return pw;
  const a = m.melange ?? 1;
  const q = PROFILS.map(([t1, t2], i) => Math.pow(pw[i], a) * syllabes[0][t1 - 1] * syllabes[1][t2 - 1]);
  const z = q.reduce((s, v) => s + v, 0);
  return z > 0 ? q.map((v) => v / z) : pw;
}

/** Les seuils d'un modèle : les siens, sinon `SEUILS_PROFIL`. */
export function seuilsDe(m: ModeleMots): typeof SEUILS_PROFIL {
  return { ...SEUILS_PROFIL, ...(m.seuils ?? {}) };
}

/** La probabilité de chaque ton (1 à 5) de la syllabe `k`, somme des profils qui le portent. */
export function marginale(probas: readonly number[], k: 0 | 1): number[] {
  const out = [0, 0, 0, 0, 0];
  PROFILS.forEach((p, i) => (out[p[k] - 1] += probas[i]));
  return out;
}

/**
 * Les seuils du jugement d'un mot, réglés sur la moitié « dev » des mots de Yue Tan : le
 * profil attendu est reconnu (« conforme ») dès que sa probabilité atteint `juste`, même si un
 * autre le talonne ; un autre profil n'est affirmé que s'il est sûr à `autre` et l'attendu sous
 * `attenduMax` ; une syllabe voisée à moins de `voisementMin` n'est pas analysée. Sinon on
 * redemande. La mesure du « reconnu à tort » (un autre profil annoncé) borne `juste`.
 */
export const SEUILS_PROFIL = { juste: 0.4, autre: 0.98, attenduMax: 0.01, voisementMin: 0.5 };

/** Le verdict d'un mot, et celui de chaque syllabe pour les phrases (`dire.ts`, `messageDireMot`). */
export interface VerdictMot {
  etat: 'juste' | 'autre' | 'redemander';
  /** Le profil entendu, `null` quand on redemande. */
  entendu: readonly [Ton, Ton] | null;
  confiance: number;
  probabilites: number[];
  syllabes: Verdict[];
}

export function jugerMot(attendus: readonly Ton[], probas: readonly number[], s = SEUILS_PROFIL): VerdictMot {
  const iA = rangProfil(attendus);
  let iM = 0;
  for (let i = 1; i < probas.length; i++) if (probas[i] > probas[iM]) iM = i;
  const pA = iA >= 0 ? probas[iA] : 0;
  const lisible = probas.length === PROFILS.length && probas.every(Number.isFinite);
  const etat = !lisible ? 'redemander' : iA >= 0 && pA >= s.juste ? 'juste' : iM !== iA && probas[iM] >= s.autre && pA <= s.attenduMax ? 'autre' : 'redemander';
  const entendu = etat === 'redemander' ? null : etat === 'juste' ? PROFILS[iA] : PROFILS[iM];
  const syllabes = attendus.map((a, k): Verdict => {
    const p = marginale(probas, k as 0 | 1);
    const h = entendu?.[k] ?? null;
    const e = etat === 'redemander' ? 'redemander' : h === a ? 'juste' : 'autre';
    return { etat: e, attendu: a, entendu: e === 'redemander' ? null : h, confiance: p[a - 1], probabilites: p };
  });
  return { etat, entendu, confiance: pA, probabilites: [...probas], syllabes };
}
