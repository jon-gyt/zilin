/**
 * Classifieur des tons d'une syllabe à partir de sa F0, en TypeScript pur (story 9.1,
 * « Dis-le »). Repris du prototype de l'étude de faisabilité du 29 septembre 2026.
 *
 * Trois étages :
 * 1. `caracteristiques` : le contour en demi-tons autour de sa propre moyenne,
 *    rééchantillonné en 30 points, plus le registre (la moyenne de la syllabe face à
 *    celle de l'apprenant, quand elle est connue, `voix.ts`), la durée et le voisement.
 * 2. `regles` (la base) et `predire` (un petit ensemble de perceptrons dont les poids sont
 *    une donnée JSON exportée par le pipeline, `tons.json`), mêlés par `probabilites`.
 * 3. `juger` : l'app sait quel ton est attendu. Elle reconnaît le ton, ou nomme le ton
 *    entendu quand elle en est sûre, ou redemande. Rien n'est noté quand la confiance est
 *    basse.
 *
 * Aucun texte ici : les phrases que l'apprenant lit (l'allure du ton, le conseil) viennent
 * du pipeline (`ecrans.json`, écran `dire`) et `dire.ts` les assemble.
 */

import { demiTons, moyenneLog, segmenter, suivreHauteur, type OptionsHauteur, type Segment, type Trame } from './pitch';

export const N_POINTS = 30;
export const N_ENTREES = N_POINTS + 4;
/** Classes du modèle, dans l'ordre de sa sortie : tons 1 à 4, puis le neutre (5). */
export const CLASSES = [1, 2, 3, 4, 5] as const;
export type Ton = (typeof CLASSES)[number];

/** Durée de référence d'une syllabe isolée, pour la caractéristique de durée. */
const DUREE_REF = 0.35;

export interface Contour {
  /** Points en demi-tons autour de la moyenne de la syllabe. */
  points: number[];
  /** Moyenne géométrique de la syllabe, Hz. */
  moyenne: number;
  duree: number;
  voisement: number;
}

/** Rééchantillonne un segment en `n` points équidistants dans le temps, en demi-tons. */
export function contourDe(seg: Segment, n = N_POINTS): Contour {
  const moyenne = moyenneLog(seg.f0);
  const st = seg.f0.map((f) => demiTons(f, moyenne));
  const points: number[] = [];
  const m = st.length;
  for (let i = 0; i < n; i++) {
    const p = m === 1 ? 0 : (i * (m - 1)) / (n - 1);
    const a = Math.floor(p), f = p - a;
    points.push(a + 1 < m ? st[a] * (1 - f) + st[a + 1] * f : st[a]);
  }
  // recentre après rééchantillonnage
  const moy = points.reduce((s, v) => s + v, 0) / n;
  return { points: points.map((v) => v - moy), moyenne, duree: seg.duree, voisement: seg.voisement };
}

/**
 * Le vecteur d'entrée du modèle. `refLocuteur` est la moyenne (Hz) de la voix de
 * l'apprenant, apprise au fil de ses enregistrements (`voix.ts`) ; sans elle, le registre
 * vaut 0 et l'indicateur le dit au modèle, qui a été entraîné à s'en passer.
 */
export function caracteristiques(c: Contour, refLocuteur?: number): number[] {
  const aRef = refLocuteur !== undefined && refLocuteur > 0;
  return [
    ...c.points,
    aRef ? demiTons(c.moyenne, refLocuteur) : 0,
    aRef ? 1 : 0,
    Math.log2(Math.max(c.duree, 0.02) / DUREE_REF),
    c.voisement,
  ];
}

// --- la base à règles -------------------------------------------------------

export interface Mesures {
  debut: number;
  fin: number;
  min: number;
  max: number;
  posMin: number;
  etendue: number;
  registre: number | null;
}

export function mesures(x: number[]): Mesures {
  const p = x.slice(0, N_POINTS);
  const moy = (a: number, b: number) => p.slice(a, b).reduce((s, v) => s + v, 0) / (b - a);
  // intérieur de la syllabe : on écarte les 10 % des bords (attaque, relâchement)
  const i0 = 3, i1 = N_POINTS - 3;
  let min = Infinity, max = -Infinity, imin = i0;
  for (let i = i0; i < i1; i++) {
    if (p[i] < min) { min = p[i]; imin = i; }
    if (p[i] > max) max = p[i];
  }
  return {
    debut: moy(i0, i0 + 4),
    fin: moy(i1 - 4, i1),
    min,
    max,
    posMin: (imin - i0) / (i1 - 1 - i0),
    etendue: max - min,
    registre: x[N_POINTS + 1] === 1 ? x[N_POINTS] : null,
  };
}

/** Seuils de la base à règles, en demi-tons. Écrits a priori, sans réglage sur les données. */
export const SEUILS_REGLES = {
  plat: 1.5,
  descenteT3: 1.0,
  remonteeT3: 1.0,
  montee: 1.5,
  chute: -1.5,
  registreBas: -2.0,
};

/** La base : des règles sur la pente, le creux et le registre. Tons 1 à 4. */
export function regles(x: number[], s = SEUILS_REGLES): Ton {
  const m = mesures(x);
  const bas = m.registre !== null && m.registre < s.registreBas;
  if (m.etendue < s.plat) return bas ? 3 : 1;
  const pente = m.fin - m.debut;
  if (m.debut - m.min >= s.descenteT3 && m.fin - m.min >= s.remonteeT3 && m.posMin > 0.2 && m.posMin < 0.8) return 3;
  if (pente >= s.montee) return 2;
  if (pente <= s.chute) return bas ? 3 : 4;
  return bas ? 3 : 1;
}

// --- le modèle appris -------------------------------------------------------

export interface Couche {
  /** poids[sortie][entrée] */
  poids: number[][];
  biais: number[];
}

export interface Membre {
  normalisation: { moyenne: number[]; ecart: number[] };
  couches: Couche[];
}

/** Un ensemble de petits perceptrons : on moyenne leurs probabilités. */
export interface Modele {
  format: 'wenlu-tons-mlp';
  version: string;
  classes: number[];
  entrees: number;
  membres: Membre[];
  /** Température de calibration appliquée aux logits avant le softmax. */
  temperature: number;
  /**
   * Poids de la base à règles dans la décision hybride : la probabilité du ton que donnent
   * les règles est multipliée par ce poids, puis tout est renormalisé. 1 : le modèle seul.
   * Réglé sur le jeu de développement, écrit dans les poids par l'entraînement.
   */
  poidsRegles?: number;
  licence?: unknown;
  entrainement?: unknown;
}

/** Refuse un modèle mal formé : mieux vaut ne pas poser la question que juger au hasard. */
export function verifierModele(m: Modele): void {
  if (m.format !== 'wenlu-tons-mlp') throw new Error('Format de modèle inconnu');
  if (m.entrees !== N_ENTREES) throw new Error(`Le modèle attend ${m.entrees} entrées, pas ${N_ENTREES}`);
  if (!m.membres?.length) throw new Error('Modèle sans membre');
  for (const mb of m.membres) {
    if (mb.normalisation.moyenne.length !== m.entrees || mb.normalisation.ecart.length !== m.entrees) throw new Error('Normalisation mal formée');
    let n = m.entrees;
    for (const c of mb.couches) {
      if (c.poids.length !== c.biais.length || c.poids.some((l) => l.length !== n)) throw new Error('Couche mal formée');
      n = c.biais.length;
    }
    if (n !== m.classes.length) throw new Error('Sortie et classes ne concordent pas');
  }
}

/** Probabilités des classes, dans l'ordre de `modele.classes` : moyenne des membres. */
export function predire(modele: Modele, x: number[]): number[] {
  const somme = modele.classes.map(() => 0);
  for (const mb of modele.membres) {
    const p = predireMembre(mb, x, modele.temperature || 1);
    for (let i = 0; i < p.length; i++) somme[i] += p[i];
  }
  return somme.map((v) => v / modele.membres.length);
}

/**
 * La décision de l'app : le modèle, avec la base à règles pour a priori. Les deux se
 * trompent différemment (le modèle, appris sur des voix de Taïwan, rate le ton 3 plongeant
 * du mandarin standard ; les règles ne savent pas douter) : ensemble, ils font mieux que
 * chacun (étude du 29 septembre 2026, 88,5 % des caractères isolés d'une voix jamais vue).
 */
export function probabilites(modele: Modele, x: number[]): number[] {
  const p = predire(modele, x);
  const w = modele.poidsRegles ?? 1;
  if (w === 1) return p;
  const r = regles(x);
  const q = p.map((v, i) => v * (modele.classes[i] === r ? w : 1));
  const z = q.reduce((a, b) => a + b, 0);
  return q.map((v) => v / z);
}

function predireMembre(mb: Membre, x: number[], t: number): number[] {
  const { moyenne, ecart } = mb.normalisation;
  let h = x.map((v, i) => (v - moyenne[i]) / ecart[i]);
  mb.couches.forEach((c, k) => {
    const der = k === mb.couches.length - 1;
    const out = new Array<number>(c.biais.length);
    for (let o = 0; o < c.biais.length; o++) {
      let s = c.biais[o];
      const w = c.poids[o];
      for (let i = 0; i < h.length; i++) s += w[i] * h[i];
      out[o] = der ? s : Math.max(0, s);
    }
    h = out;
  });
  const mx = Math.max(...h);
  const e = h.map((v) => Math.exp((v - mx) / t));
  const z = e.reduce((s, v) => s + v, 0);
  return e.map((v) => v / z);
}

// --- le jugement ------------------------------------------------------------

/** Reconnu, un autre ton dont l'app est sûre, ou on redemande. */
export type Etat = 'juste' | 'autre' | 'redemander';

export interface Verdict {
  etat: Etat;
  attendu: Ton;
  /** Le ton entendu, `null` quand on redemande. */
  entendu: Ton | null;
  /** Probabilité du ton attendu. */
  confiance: number;
  probabilites: number[];
}

/**
 * Seuils retenus sur le jeu de développement (décision hybride) : sur une voix native
 * jamais vue, 1 à 2,4 % de « j'entends un autre ton » quand le ton était juste, 12 % de
 * redemandes. On préfère redemander qu'affirmer à tort.
 */
export const SEUILS_JUGEMENT = {
  /** Au-dessus, et en tête, le ton attendu est reconnu. */
  juste: 0.6,
  /** Pour dire un autre ton, il faut en être sûr… */
  autre: 0.9,
  /** …et que l'attendu soit vraiment improbable. */
  attenduMax: 0.05,
  /** Moins de voix que ça, on redemande sans analyser. */
  dureeMin: 0.08,
  voisementMin: 0.5,
};

export function juger(attendu: Ton, probas: number[], classes: readonly number[] = CLASSES, s = SEUILS_JUGEMENT): Verdict {
  const iA = classes.indexOf(attendu);
  let iM = 0;
  for (let i = 1; i < probas.length; i++) if (probas[i] > probas[iM]) iM = i;
  const entendu = classes[iM] as Ton;
  const pA = iA >= 0 ? probas[iA] : 0;
  if (iM === iA && pA >= s.juste) return { etat: 'juste', attendu, entendu, confiance: pA, probabilites: probas };
  if (iM !== iA && probas[iM] >= s.autre && pA <= s.attenduMax) {
    return { etat: 'autre', attendu, entendu, confiance: pA, probabilites: probas };
  }
  return { etat: 'redemander', attendu, entendu: null, confiance: pA, probabilites: probas };
}

// --- de bout en bout --------------------------------------------------------

/** Ce qui empêche d'analyser : rien entendu, trop court, son saturé. */
export type Probleme = 'silence' | 'court' | 'sature';

export interface AnalyseSyllabe {
  segment: Segment;
  contour: Contour;
  entrees: number[];
  verdict: Verdict;
  /** Le ton de la base à règles, pour comparaison. */
  regle: Ton;
}

export interface Analyse {
  trames: Trame[];
  syllabes: AnalyseSyllabe[];
  /** Renseigné quand on redemande sans analyser. */
  probleme: Probleme | null;
}

/**
 * Analyse un enregistrement mono (16 kHz conseillé) dont on attend les tons `attendus`, un
 * par syllabe. Sans modèle, la base à règles décide seule (probabilité 1 au ton trouvé :
 * elle ne sait pas douter).
 */
export function analyser(
  x: Float32Array,
  sr: number,
  attendus: Ton[],
  modele?: Modele,
  refLocuteur?: number,
  optsHauteur: OptionsHauteur = {},
): Analyse {
  const trames = suivreHauteur(x, { ...optsHauteur, sr });
  let crete = 0;
  for (let i = 0; i < x.length; i++) crete = Math.max(crete, Math.abs(x[i]));
  const segs = segmenter(trames, attendus.length);
  const court = segs.length !== attendus.length || segs.some((s) => s.duree < SEUILS_JUGEMENT.dureeMin || s.voisement < SEUILS_JUGEMENT.voisementMin);
  const probleme: Probleme | null = segs.length === 0 ? 'silence' : court ? 'court' : crete > 0.999 ? 'sature' : null;
  const syllabes = segs.map((segment, k) => {
    const contour = contourDe(segment);
    const entrees = caracteristiques(contour, refLocuteur);
    const regle = regles(entrees);
    const probas = modele ? probabilites(modele, entrees) : CLASSES.map((c) => (c === regle ? 1 : 0));
    const verdict: Verdict = probleme
      ? { etat: 'redemander', attendu: attendus[k], entendu: null, confiance: 0, probabilites: probas }
      : juger(attendus[k], probas, modele?.classes ?? CLASSES);
    return { segment, contour, entrees, verdict, regle };
  });
  return { trames, syllabes, probleme };
}
