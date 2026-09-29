/**
 * La reconnaissance d'un caractère tracé au doigt : appariement élastique trait à trait sur
 * les médianes de Make Me a Hanzi (`gabarits.ts`). Code propriétaire, écrit en salle
 * blanche d'après la littérature générale (appariement de traits, affectation optimale,
 * recalage affine, sens et longueur des traits) et le prototype de l'étude du dictionnaire
 * (§6).
 *
 * 1. Le tracé : chaque trait rééchantillonné à `POINTS` points également espacés le long du
 *    geste, puis la boîte du tracé entier centrée et ramenée à son étendue (`aspect`) — la
 *    même normalisation que les gabarits, donc indifférente à la taille et à la place.
 * 2. Le coup d'œil (`grossier`) : trois points par trait, chaque trait face à son plus proche,
 *    sur tous les caractères au nombre de traits voisin (`ecart`) et sur le début des plus
 *    longs ; les plus proches passent à la suite (`tri`, `triDebut`).
 * 3. L'appariement (`apparier`) : le coût d'un trait tracé face à un trait du gabarit est la
 *    distance moyenne point à point, dans le sens du geste ou à rebours contre une pénalité
 *    (`inverse`) ; l'affectation optimale des traits (algorithme hongrois) rend l'ordre des
 *    traits indifférent à l'appariement, et il ne coûte qu'un peu (`ordre`, la part de paires
 *    inversées). Un trait du gabarit sans trait tracé coûte `manque`, un trait tracé de trop
 *    `enTrop`. Deux traits liés d'un seul geste : un trait tracé peut couvrir deux traits
 *    voisins du gabarit, et deux traits tracés voisins un seul (un 横折 coupé en deux), pour
 *    `lie`.
 * 4. Le recalage (`recaler`) : pour les plus proches (`recales`), la transformation affine
 *    qui porte le tracé sur le gabarit — une main penchée, écrasée, tournée — est appliquée,
 *    tirée vers l'identité (`rigidite`) et payée (`deformation`), puis l'on apparie de nouveau.
 * 5. Le début d'un caractère : tant que le tracé a moins de traits qu'un gabarit, on
 *    l'apparie aussi à ses premiers traits, renormalisés (`debut`) ; les candidats s'affinent
 *    ainsi trait après trait, 女 menant à 好.
 * 6. Le score mêle l'appariement et le coup d'œil (`melange`) ; à score voisin, le niveau du
 *    HSK départage, le plus courant d'abord (`niveau`).
 *
 * Module pur, sans DOM : il tourne dans le Web Worker (`ecriture.worker.ts`) et dans les
 * tests. Réglages et précision : `scripts/ecriture/mesurer.ts`.
 */
import { POINTS, type Gabarits } from './gabarits';

export type Point = readonly [number, number];
/** Un trait tracé : ses points dans l'ordre du geste, en pixels ou en toute unité. */
export type Trace = readonly Point[];

export type Candidat = { c: string; score: number };

export type Reglages = {
  /** Coût ajouté, par point, à un trait tracé à rebours. */
  inverse: number;
  /** Coût d'un trait du gabarit que le tracé n'a pas. */
  manque: number;
  /** Coût d'un trait tracé sans trait du gabarit. */
  enTrop: number;
  /** Coût d'une liaison : deux traits d'un côté pour un de l'autre. */
  lie: number;
  /** Poids de la part de paires de traits tracées dans l'ordre inverse du gabarit. */
  ordre: number;
  /** Coût de chaque niveau du HSK au-delà du premier. */
  niveau: number;
  /** Coût fixe d'un caractère reconnu par ses premiers traits seulement. */
  debut: number;
  /** Écart admis entre le nombre de traits tracés et celui du gabarit, dans les deux sens. */
  ecart: number;
  /**
   * La normalisation : chaque axe est ramené à son étendue, sans descendre sous `aspect` fois
   * l'étendue de l'autre. 1 garde les proportions ; plus bas, un caractère tracé trop large ou
   * trop haut retrouve sa forme, sans qu'un 一 devienne un carré.
   */
  aspect: number;
  /**
   * Le tri grossier : seuls les `tri` caractères les plus proches au premier coup d'œil (trois
   * points par trait, chaque trait à son plus proche) passent à l'appariement complet. 0 : tous.
   */
  tri: number;
  /** Même chose pour les caractères reconnus par leur début. */
  triDebut: number;
  /**
   * Le recalage : après un premier appariement, la transformation affine qui porte au mieux
   * le tracé sur le gabarit (une main penchée, écrasée, tournée) est appliquée, et l'on
   * apparie de nouveau. `rigidite` la tire vers l'identité (0 : aucun recalage) ;
   * `deformation` fait payer son écart à l'identité.
   */
  rigidite: number;
  deformation: number;
  /** Le nombre de candidats, les plus proches après l'appariement, que l'on recale. */
  recales: number;
  /** Au plus, tant de traits restent à un caractère reconnu par son début. */
  reste: number;
  /** Le poids du coup d'œil (`grossier`) dans le score final. */
  melange: number;
};

/** Les réglages mesurés sur le jeu de tracés déformés (`scripts/ecriture/mesurer.ts`). */
export const REGLAGES: Readonly<Reglages> = {
  inverse: 0.04,
  manque: 0.12,
  enTrop: 0.12,
  lie: 0.03,
  ordre: 0.05,
  niveau: 0.002,
  debut: 0.04,
  ecart: 2,
  aspect: 0.6,
  tri: 80,
  triDebut: 60,
  rigidite: 0.05,
  deformation: 0.05,
  recales: 60,
  reste: 99,
  melange: 0.4
};

/** Au plus, ce nombre de traits tracés est lu : au-delà, les derniers sont ignorés. */
export const TRAITS_MAX = 40;

/** Le nombre de candidats rendus par défaut. */
export const CANDIDATS = 10;

const P = POINTS;
const P2 = POINTS * 2;
/** Au plus de traits d'un côté ou de l'autre d'un appariement (un gabarit en a au plus 63). */
const MAX = 64;

/* ---------- géométrie ---------- */

/**
 * Rééchantillonne une ligne brisée, lue dans `src` (x, y alternés, `n` points depuis
 * `debut`), en `POINTS` points également espacés, écrits dans `dst` depuis `ou`.
 */
function reechantillonnerTampon(
  src: ArrayLike<number>,
  debut: number,
  n: number,
  dst: Float32Array,
  ou: number
): void {
  let total = 0;
  for (let k = 1; k < n; k++) {
    const a = debut + 2 * (k - 1);
    total += Math.sqrt((src[a + 2] - src[a]) ** 2 + (src[a + 3] - src[a + 1]) ** 2);
  }
  if (n === 1 || total === 0) {
    for (let i = 0; i < P; i++) {
      dst[ou + 2 * i] = src[debut];
      dst[ou + 2 * i + 1] = src[debut + 1];
    }
    return;
  }
  let j = 0;
  let avant = 0;
  let seg = Math.sqrt((src[debut + 2] - src[debut]) ** 2 + (src[debut + 3] - src[debut + 1]) ** 2);
  for (let i = 0; i < P; i++) {
    const t = (total * i) / (P - 1);
    while (j < n - 2 && avant + seg < t) {
      avant += seg;
      j++;
      const a = debut + 2 * j;
      seg = Math.sqrt((src[a + 2] - src[a]) ** 2 + (src[a + 3] - src[a + 1]) ** 2);
    }
    const a = debut + 2 * j;
    const f = seg === 0 ? 0 : Math.min(1, Math.max(0, (t - avant) / seg));
    dst[ou + 2 * i] = src[a] + f * (src[a + 2] - src[a]);
    dst[ou + 2 * i + 1] = src[a + 1] + f * (src[a + 3] - src[a + 1]);
  }
}

/** Un trait en `POINTS` points également espacés le long du geste. */
export function reechantillonner(trace: Trace): Point[] {
  if (trace.length === 0) throw new Error('trait vide');
  const plat = new Float32Array(trace.length * 2);
  trace.forEach(([x, y], k) => {
    plat[2 * k] = x;
    plat[2 * k + 1] = y;
  });
  const out = new Float32Array(P2);
  reechantillonnerTampon(plat, 0, trace.length, out, 0);
  return Array.from({ length: P }, (_, i) => [out[2 * i], out[2 * i + 1]] as const);
}

/**
 * Centre la boîte des `n` traits rangés dans `buf` depuis `ou` et la ramène à son plus grand
 * côté : les coordonnées tombent dans `[-0,5 ; 0,5]`, les proportions gardées.
 */
function normaliserTampon(buf: Float32Array, ou: number, n: number, aspect: number): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const fin = ou + n * P2;
  for (let k = ou; k < fin; k += 2) {
    const x = buf[k];
    const y = buf[k + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cote = Math.max(x1 - x0, y1 - y0) || 1;
  const ex = Math.max(x1 - x0, aspect * cote);
  const ey = Math.max(y1 - y0, aspect * cote);
  for (let k = ou; k < fin; k += 2) {
    buf[k] = (buf[k] - cx) / ex;
    buf[k + 1] = (buf[k + 1] - cy) / ey;
  }
}

/** Un tracé prêt à apparier : `n` traits de `POINTS` points, normalisés, à plat. */
export type Prepare = { n: number; points: Float32Array };

/**
 * Prépare un tracé : les traits vides sont écartés, les `TRAITS_MAX` premiers gardés, chacun
 * rééchantillonné, le tout normalisé.
 */
export function preparer(traces: readonly Trace[], aspect = REGLAGES.aspect): Prepare {
  const utiles = traces.filter((t) => t.length > 0).slice(0, TRAITS_MAX);
  const points = new Float32Array(utiles.length * P2);
  utiles.forEach((t, k) => {
    const plat = new Float32Array(t.length * 2);
    t.forEach(([x, y], i) => {
      plat[2 * i] = x;
      plat[2 * i + 1] = y;
    });
    reechantillonnerTampon(plat, 0, t.length, points, k * P2);
  });
  if (utiles.length > 0) normaliserTampon(points, 0, utiles.length, aspect);
  return { n: utiles.length, points };
}

/* ---------- coût d'une paire de traits ---------- */

/** La distance moyenne point à point, dans le sens du geste ou à rebours avec pénalité. */
function cout(A: Float32Array, a: number, B: Float32Array, b: number, inverse: number): number {
  let droit = 0;
  let revers = 0;
  for (let i = 0; i < P; i++) {
    const ax = A[a + 2 * i];
    const ay = A[a + 2 * i + 1];
    const dx = ax - B[b + 2 * i];
    const dy = ay - B[b + 2 * i + 1];
    droit += Math.sqrt(dx * dx + dy * dy);
    const r = b + 2 * (P - 1 - i);
    const rx = ax - B[r];
    const ry = ay - B[r + 1];
    revers += Math.sqrt(rx * rx + ry * ry);
  }
  return Math.min(droit, revers + inverse * P) / P;
}

/* ---------- affectation optimale (algorithme hongrois, potentiels) ---------- */

const hu = new Float64Array(MAX + 1);
const hv = new Float64Array(MAX + 1);
const hp = new Int32Array(MAX + 1);
const hway = new Int32Array(MAX + 1);
const hmin = new Float64Array(MAX + 1);
const hused = new Uint8Array(MAX + 1);

/**
 * Affecte chacune des `n` lignes à une colonne distincte parmi `m` (n ≤ m), au coût total
 * minimal. `c` : les coûts, ligne par ligne. Écrit dans `ligneVers` la colonne de chaque ligne.
 */
function hongrois(c: Float64Array, n: number, m: number, ligneVers: Int32Array): void {
  hu.fill(0, 0, n + 1);
  hv.fill(0, 0, m + 1);
  hp.fill(0, 0, m + 1);
  hway.fill(0, 0, m + 1);
  for (let i = 1; i <= n; i++) {
    hp[0] = i;
    let j0 = 0;
    hmin.fill(Infinity, 0, m + 1);
    hused.fill(0, 0, m + 1);
    do {
      hused[j0] = 1;
      const i0 = hp[j0];
      let delta = Infinity;
      let j1 = 0;
      const ligne = (i0 - 1) * m;
      for (let j = 1; j <= m; j++) {
        if (hused[j]) continue;
        const cur = c[ligne + j - 1] - hu[i0] - hv[j];
        if (cur < hmin[j]) {
          hmin[j] = cur;
          hway[j] = j0;
        }
        if (hmin[j] < delta) {
          delta = hmin[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (hused[j]) {
          hu[hp[j]] += delta;
          hv[j] -= delta;
        } else hmin[j] -= delta;
      }
      j0 = j1;
    } while (hp[j0] !== 0);
    do {
      const j1 = hway[j0];
      hp[j0] = hp[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  for (let j = 1; j <= m; j++) if (hp[j] !== 0) ligneVers[hp[j] - 1] = j - 1;
}

/* ---------- appariement d'un tracé et d'un gabarit ---------- */

const matrice = new Float64Array(MAX * MAX);
const versGabarit = new Int32Array(MAX);
const versTrace = new Int32Array(MAX);
const coutPaire = new Float64Array(MAX);
const lieTrace = new Uint8Array(MAX);
const lieGabarit = new Uint8Array(MAX);
const affectation = new Int32Array(MAX);
const fusion = new Float32Array(4 * P);
const fusionne = new Float32Array(P2);

/** Rééchantillonne deux traits mis bout à bout, `premier` puis `second`, dans `fusionne`. */
function lier(A: Float32Array, premier: number, second: number, retourne = false): Float32Array {
  fusion.set(A.subarray(premier, premier + P2), 0);
  if (!retourne) fusion.set(A.subarray(second, second + P2), P2);
  else
    for (let k = 0; k < P; k++) {
      fusion[P2 + 2 * k] = A[second + 2 * (P - 1 - k)];
      fusion[P2 + 2 * k + 1] = A[second + 2 * (P - 1 - k) + 1];
    }
  reechantillonnerTampon(fusion, 0, 2 * P, fusionne, 0);
  return fusionne;
}

/**
 * Le score d'un tracé (`na` traits de `A` depuis le trait `a0`) face à un gabarit (`nb` traits
 * de `B` depuis `b0`) : coût moyen par trait, manques, traits en trop et liaisons compris, plus
 * la part d'ordre inversé. Plus bas, plus proche.
 */
export function apparier(
  A: Float32Array,
  a0: number,
  na: number,
  B: Float32Array,
  b0: number,
  nb: number,
  r: Readonly<Reglages> = REGLAGES
): number {
  if (na === 0 || nb === 0) return Infinity;
  const tracesEnLignes = na <= nb;
  const n = tracesEnLignes ? na : nb;
  const m = tracesEnLignes ? nb : na;
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < nb; j++) {
      const d = cout(A, (a0 + i) * P2, B, (b0 + j) * P2, r.inverse);
      if (tracesEnLignes) matrice[i * m + j] = d;
      else matrice[j * m + i] = d;
    }
  }
  hongrois(matrice, n, m, affectation);
  versGabarit.fill(-1, 0, na);
  versTrace.fill(-1, 0, nb);
  lieTrace.fill(0, 0, na);
  lieGabarit.fill(0, 0, nb);
  let somme = 0;
  for (let l = 0; l < n; l++) {
    const i = tracesEnLignes ? l : affectation[l];
    const j = tracesEnLignes ? affectation[l] : l;
    versGabarit[i] = j;
    versTrace[j] = i;
    const d = matrice[l * m + affectation[l]];
    coutPaire[i] = d;
    somme += d;
  }

  let liaisons = 0;
  /* Un trait du gabarit sans trait tracé : peut-être lié d'un seul geste à son voisin. */
  for (let u = 0; u < nb; u++) {
    if (versTrace[u] !== -1) continue;
    let gain = 0;
    let choisi = -1;
    let nouveau = 0;
    for (const v of [u - 1, u + 1]) {
      if (v < 0 || v >= nb || lieGabarit[v]) continue;
      const i = versTrace[v];
      if (i === -1 || lieTrace[i]) continue;
      /* d'un seul geste, le second trait se prend dans son sens, ou à rebours (口 en boucle) */
      const [p, q] = v < u ? [v, u] : [u, v];
      const d = Math.min(
        cout(A, (a0 + i) * P2, lier(B, (b0 + p) * P2, (b0 + q) * P2), 0, r.inverse),
        cout(A, (a0 + i) * P2, lier(B, (b0 + p) * P2, (b0 + q) * P2, true), 0, r.inverse) + r.inverse
      );
      const g = coutPaire[i] + r.manque - (d + r.lie);
      if (g > gain) {
        gain = g;
        choisi = v;
        nouveau = d;
      }
    }
    if (choisi !== -1) {
      const i = versTrace[choisi];
      somme += nouveau - coutPaire[i];
      coutPaire[i] = nouveau;
      versTrace[u] = i;
      lieGabarit[u] = 1;
      lieGabarit[choisi] = 1;
      lieTrace[i] = 1;
      liaisons++;
    }
  }
  /* Un trait tracé sans trait du gabarit : peut-être la moitié d'un trait coupé en deux. */
  for (let w = 0; w < na; w++) {
    if (versGabarit[w] !== -1) continue;
    let gain = 0;
    let choisi = -1;
    let nouveau = 0;
    for (const x of [w - 1, w + 1]) {
      if (x < 0 || x >= na || lieTrace[x]) continue;
      const j = versGabarit[x];
      if (j === -1 || lieGabarit[j]) continue;
      const lie = x < w ? lier(A, (a0 + x) * P2, (a0 + w) * P2) : lier(A, (a0 + w) * P2, (a0 + x) * P2);
      const d = cout(lie, 0, B, (b0 + j) * P2, r.inverse);
      const g = coutPaire[x] + r.enTrop - (d + r.lie);
      if (g > gain) {
        gain = g;
        choisi = x;
        nouveau = d;
      }
    }
    if (choisi !== -1) {
      somme += nouveau - coutPaire[choisi];
      coutPaire[choisi] = nouveau;
      versGabarit[w] = versGabarit[choisi];
      lieTrace[w] = 1;
      lieTrace[choisi] = 1;
      lieGabarit[versGabarit[choisi]] = 1;
      liaisons++;
    }
  }

  let manques = 0;
  for (let j = 0; j < nb; j++) if (versTrace[j] === -1) manques++;
  let enTrop = 0;
  for (let i = 0; i < na; i++) if (versGabarit[i] === -1) enTrop++;

  /* L'ordre : la part des paires de traits tracées dans l'ordre inverse du gabarit. */
  let paires = 0;
  let inversees = 0;
  for (let i = 0; i < na; i++) {
    const gi = versGabarit[i];
    if (gi === -1) continue;
    for (let k = i + 1; k < na; k++) {
      const gk = versGabarit[k];
      if (gk === -1 || gk === gi) continue;
      paires++;
      if (gk < gi) inversees++;
    }
  }

  const total = somme + r.manque * manques + r.enTrop * enTrop + r.lie * liaisons;
  return total / Math.max(na, nb) + (paires > 0 ? (r.ordre * inversees) / paires : 0);
}

/* ---------- le recalage affine ---------- */

let recale = new Float32Array(TRAITS_MAX * P2);

/**
 * Juste après `apparier` (qui laisse ses paires de traits dans `versGabarit`) : la
 * transformation affine, aux moindres carrés et tirée vers l'identité par `rigidite`, qui
 * porte les points des traits appariés du tracé sur ceux du gabarit. Le tracé transformé est
 * écrit dans `recale` ; rend l'écart de la partie linéaire à l'identité (norme de Frobenius).
 */
function recaler(A: Float32Array, na: number, B: Float32Array, b0: number, r: Readonly<Reglages>): number {
  let sxx = 0,
    sxy = 0,
    syy = 0,
    sx = 0,
    sy = 0,
    nn = 0;
  let sux = 0,
    suy = 0,
    su = 0,
    svx = 0,
    svy = 0,
    sv = 0;
  for (let i = 0; i < na; i++) {
    const j = versGabarit[i];
    if (j === -1 || lieTrace[i]) continue;
    const a = i * P2;
    const b = (b0 + j) * P2;
    let droit = 0;
    let revers = 0;
    for (let k = 0; k < P; k++) {
      const q = b + 2 * (P - 1 - k);
      droit += Math.sqrt((A[a + 2 * k] - B[b + 2 * k]) ** 2 + (A[a + 2 * k + 1] - B[b + 2 * k + 1]) ** 2);
      revers += Math.sqrt((A[a + 2 * k] - B[q]) ** 2 + (A[a + 2 * k + 1] - B[q + 1]) ** 2);
    }
    const aRebours = revers + r.inverse * P < droit;
    for (let k = 0; k < P; k++) {
      const x = A[a + 2 * k];
      const y = A[a + 2 * k + 1];
      const q = aRebours ? b + 2 * (P - 1 - k) : b + 2 * k;
      const u = B[q];
      const v = B[q + 1];
      sxx += x * x;
      sxy += x * y;
      syy += y * y;
      sx += x;
      sy += y;
      nn++;
      sux += u * x;
      suy += u * y;
      su += u;
      svx += v * x;
      svy += v * y;
      sv += v;
    }
  }
  if (recale.length < na * P2) recale = new Float32Array(na * P2);
  if (nn < 2 * P) {
    recale.set(A.subarray(0, na * P2));
    return 0;
  }
  /* Les équations normales, avec λ sur la partie linéaire : u = a x + b y + c, v = d x + e y + f. */
  const l = r.rigidite * nn;
  const m11 = sxx + l,
    m12 = sxy,
    m13 = sx,
    m22 = syy + l,
    m23 = sy,
    m33 = nn;
  const det = m11 * (m22 * m33 - m23 * m23) - m12 * (m12 * m33 - m23 * m13) + m13 * (m12 * m23 - m22 * m13);
  if (Math.abs(det) < 1e-12) {
    recale.set(A.subarray(0, na * P2));
    return 0;
  }
  const resoudre = (r1: number, r2: number, r3: number): [number, number, number] => [
    (r1 * (m22 * m33 - m23 * m23) - m12 * (r2 * m33 - m23 * r3) + m13 * (r2 * m23 - m22 * r3)) / det,
    (m11 * (r2 * m33 - r3 * m23) - r1 * (m12 * m33 - m23 * m13) + m13 * (m12 * r3 - r2 * m13)) / det,
    (m11 * (m22 * r3 - m23 * r2) - m12 * (m12 * r3 - r2 * m13) + r1 * (m12 * m23 - m22 * m13)) / det
  ];
  const [ta, tb, tc] = resoudre(sux + l, suy, su);
  const [td, te, tf] = resoudre(svx, svy + l, sv);
  for (let k = 0; k < na * P2; k += 2) {
    const x = A[k];
    const y = A[k + 1];
    recale[k] = ta * x + tb * y + tc;
    recale[k + 1] = td * x + te * y + tf;
  }
  return Math.sqrt((ta - 1) ** 2 + tb * tb + td * td + (te - 1) ** 2);
}

/** Apparie un tracé entier (depuis son premier trait) à un gabarit. */
function apparierSeul(
  A: Float32Array,
  na: number,
  B: Float32Array,
  b0: number,
  nb: number,
  r: Readonly<Reglages>
): number {
  return apparier(A, 0, na, B, b0, nb, r);
}

/** Apparie, puis, si le recalage est permis, recale et apparie de nouveau ; le meilleur des deux. */
function apparierRecale(
  A: Float32Array,
  na: number,
  B: Float32Array,
  b0: number,
  nb: number,
  r: Readonly<Reglages>
): number {
  const s = apparier(A, 0, na, B, b0, nb, r);
  if (r.rigidite <= 0 || !Number.isFinite(s)) return s;
  const ecart = recaler(A, na, B, b0, r);
  return Math.min(s, apparier(recale, 0, na, B, b0, nb, r) + r.deformation * ecart);
}

/* ---------- le tri grossier ---------- */

const MILIEU = 2 * (P >> 1);
const FIN = 2 * (P - 1);
const plusProche = new Float64Array(MAX);

/** Les trois points (début, milieu, fin) de chaque trait tracé, puis du gabarit en cours. */
const troisTrace = new Float64Array(6 * MAX);
const troisGabarit = new Float64Array(6 * MAX);

/** Relève les trois points de chaque trait tracé, une fois par reconnaissance. */
function releverTrace(A: Float32Array, na: number): void {
  for (let i = 0; i < na; i++) {
    const a = i * P2;
    troisTrace.set([A[a], A[a + 1], A[a + MILIEU], A[a + MILIEU + 1], A[a + FIN], A[a + FIN + 1]], 6 * i);
  }
}

/**
 * Un premier coup d'œil, sans affectation : chaque trait tracé (relevé par `releverTrace`)
 * face à son plus proche du gabarit, et chaque trait du gabarit face à son plus proche tracé,
 * en distances au carré sur trois points (début, milieu, fin ; un trait à rebours paie
 * `inverse`). Rapide, et déjà juste quand le tracé est propre ; l'appariement complet le
 * reprend pour les traits liés, manquants ou en trop. Un trait d'écart coûte comme trois
 * points à la distance `manque`. Le gabarit est lu dans le repère `(B - o) · k` : l'identité
 * pour un caractère entier, la boîte de ses premiers traits pour un début. Au-delà de
 * `limite`, le calcul s'arrête : l'infini.
 */
function grossier(
  na: number,
  B: Float32Array,
  b0: number,
  nb: number,
  r: Readonly<Reglages>,
  limite = Infinity,
  ox = 0,
  oy = 0,
  kx = 1,
  ky = 1
): number {
  const T = troisTrace;
  const G = troisGabarit;
  for (let j = 0; j < nb; j++) {
    const b = (b0 + j) * P2;
    const o = 6 * j;
    G[o] = (B[b] - ox) * kx;
    G[o + 1] = (B[b + 1] - oy) * ky;
    G[o + 2] = (B[b + MILIEU] - ox) * kx;
    G[o + 3] = (B[b + MILIEU + 1] - oy) * ky;
    G[o + 4] = (B[b + FIN] - ox) * kx;
    G[o + 5] = (B[b + FIN + 1] - oy) * ky;
    plusProche[j] = Infinity;
  }
  const rebours = 2 * r.inverse * r.inverse;
  const ecart = (3 * r.manque * r.manque * Math.abs(na - nb)) / Math.max(na, nb);
  /* la somme ne fait que croître : au-delà de ce plafond, le caractère est écarté */
  const plafond = 2 * na * (limite - ecart);
  let sa = 0;
  for (let i = 0; i < na; i++) {
    const t = 6 * i;
    const ax = T[t],
      ay = T[t + 1],
      mx = T[t + 2],
      my = T[t + 3],
      zx = T[t + 4],
      zy = T[t + 5];
    let mi = Infinity;
    for (let j = 0; j < nb; j++) {
      const o = 6 * j;
      const bx = G[o],
        by = G[o + 1],
        fx = G[o + 4],
        fy = G[o + 5];
      const dmx = mx - G[o + 2];
      const dmy = my - G[o + 3];
      const droit =
        (ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (zx - fx) * (zx - fx) + (zy - fy) * (zy - fy);
      const revers =
        (ax - fx) * (ax - fx) + (ay - fy) * (ay - fy) + (zx - bx) * (zx - bx) + (zy - by) * (zy - by);
      const d = dmx * dmx + dmy * dmy + (droit < revers + rebours ? droit : revers + rebours);
      if (d < mi) mi = d;
      if (d < plusProche[j]) plusProche[j] = d;
    }
    sa += mi;
    if (sa > plafond) return Infinity;
  }
  let sb = 0;
  for (let j = 0; j < nb; j++) sb += plusProche[j];
  return (sa / na + sb / nb) / 2 + ecart;
}

/** Les `taille` plus petites valeurs vues : un tas dont la racine est la plus grande. */
class Seuil {
  private tas: Float64Array;
  private n = 0;
  constructor(private taille: number) {
    this.tas = new Float64Array(Math.max(1, taille));
  }
  /** La valeur à battre pour entrer : l'infini tant que le tas n'est pas plein. */
  get borne(): number {
    return this.taille > 0 && this.n === this.taille ? this.tas[0] : Infinity;
  }
  ajouter(v: number): void {
    if (this.taille <= 0) return;
    const t = this.tas;
    if (this.n < this.taille) {
      let i = this.n++;
      t[i] = v;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (t[p] >= t[i]) break;
        [t[p], t[i]] = [t[i], t[p]];
        i = p;
      }
    } else if (v < t[0]) {
      t[0] = v;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < this.n && t[a] > t[m]) m = a;
        if (b < this.n && t[b] > t[m]) m = b;
        if (m === i) break;
        [t[m], t[i]] = [t[i], t[m]];
        i = m;
      }
    }
  }
}

/* ---------- la reconnaissance ---------- */

let debutTampon = new Float32Array(TRAITS_MAX * P2);

/** La boîte de chaque trait des gabarits (x0, y0, x1, y1), une fois par jeu de gabarits. */
const boites = new WeakMap<Gabarits, Float32Array>();

function boitesDe(g: Gabarits): Float32Array {
  let b = boites.get(g);
  if (!b) {
    const n = g.points.length / P2;
    b = new Float32Array(4 * n);
    for (let t = 0; t < n; t++) {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let k = t * P2; k < (t + 1) * P2; k += 2) {
        x0 = Math.min(x0, g.points[k]);
        x1 = Math.max(x1, g.points[k]);
        y0 = Math.min(y0, g.points[k + 1]);
        y1 = Math.max(y1, g.points[k + 1]);
      }
      b.set([x0, y0, x1, y1], 4 * t);
    }
    boites.set(g, b);
  }
  return b;
}

/** Les caractères rangés par nombre de traits, une fois par jeu de gabarits. */
const parTraits = new WeakMap<Gabarits, number[][]>();

function parTraitsDe(g: Gabarits): number[][] {
  let l = parTraits.get(g);
  if (!l) {
    l = [];
    for (let c = 0; c < g.caracteres.length; c++) {
      const k = g.debut[c + 1] - g.debut[c];
      while (l.length <= k) l.push([]);
      l[k].push(c);
    }
    parTraits.set(g, l);
  }
  return l;
}

/** Les gabarits renormalisés comme un tracé, une fois par jeu de gabarits et par `aspect`. */
const normalises = new WeakMap<Gabarits, Map<number, Float32Array>>();

function gabaritsNormalises(g: Gabarits, aspect: number): Float32Array {
  if (aspect === 1) return g.points;
  let parAspect = normalises.get(g);
  if (!parAspect) normalises.set(g, (parAspect = new Map()));
  let pts = parAspect.get(aspect);
  if (!pts) {
    pts = g.points.slice();
    for (let c = 0; c < g.caracteres.length; c++) {
      normaliserTampon(pts, g.debut[c] * P2, g.debut[c + 1] - g.debut[c], aspect);
    }
    parAspect.set(aspect, pts);
  }
  return pts;
}

/**
 * Les meilleurs candidats pour un tracé, du plus proche au moins proche. Un tracé vide n'en
 * a aucun. Chaque caractère est jugé entier (à `ecart` traits près) et, si le tracé a moins
 * de traits que lui, par ses premiers traits.
 */
export function reconnaitre(
  g: Gabarits,
  traces: readonly Trace[],
  max = CANDIDATS,
  r: Readonly<Reglages> = REGLAGES
): Candidat[] {
  return classer(g, preparer(traces, r.aspect), max, r);
}

/** Même chose depuis un tracé déjà préparé. */
export function classer(
  g: Gabarits,
  t: Prepare,
  max = CANDIDATS,
  r: Readonly<Reglages> = REGLAGES
): Candidat[] {
  const n = t.n;
  if (n === 0) return [];
  const N = g.caracteres.length;
  const gp = gabaritsNormalises(g, r.aspect);
  if (debutTampon.length < n * P2) debutTampon = new Float32Array(n * P2);
  const prefixe = (s0: number): Float32Array => {
    debutTampon.set(g.points.subarray(s0 * P2, (s0 + n) * P2), 0);
    normaliserTampon(debutTampon, 0, n, r.aspect);
    return debutTampon;
  };
  const bt = boitesDe(g);
  releverTrace(t.points, n);
  const debutGrossier = 3 * r.debut * r.debut;

  /*
   * 1. le coup d'œil, sur tous les caractères au nombre de traits voisin (`tri` retenus), et
   * sur le début des plus longs (`triDebut` retenus) : deux rangs à part, pour que les débuts,
   * des milliers, ne chassent pas un caractère entier tracé avec deux traits liés.
   */
  const entier = new Float64Array(N).fill(Infinity);
  const debutA = new Float64Array(N).fill(Infinity);
  const seuilEntier = new Seuil(r.tri);
  const seuilDebut = new Seuil(r.triDebut);
  /* les nombres de traits les plus probables d'abord : les seuils se resserrent plus vite */
  const pk = parTraitsDe(g);
  const ordreK = [n];
  for (let e = 1; e < pk.length; e++) ordreK.push(n - e, n + e);
  for (const k of ordreK) {
    if (k < 1 || k >= pk.length) continue;
    const complet = Math.abs(k - n) <= r.ecart;
    const debut = k > n && k - n <= r.reste;
    if (!complet && !debut) continue;
    for (const c of pk[k]) {
      const s0 = g.debut[c];
      if (complet) {
        entier[c] = grossier(n, gp, s0, k, r, seuilEntier.borne);
        if (entier[c] < Infinity) seuilEntier.ajouter(entier[c]);
      }
      if (debut) {
        /* la boîte des n premiers traits, et le repère qui la normalise comme un tracé */
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let u = 4 * s0; u < 4 * (s0 + n); u += 4) {
          if (bt[u] < x0) x0 = bt[u];
          if (bt[u + 1] < y0) y0 = bt[u + 1];
          if (bt[u + 2] > x1) x1 = bt[u + 2];
          if (bt[u + 3] > y1) y1 = bt[u + 3];
        }
        const cote = Math.max(x1 - x0, y1 - y0) || 1;
        const kx = 1 / Math.max(x1 - x0, r.aspect * cote);
        const ky = 1 / Math.max(y1 - y0, r.aspect * cote);
        const limite = seuilDebut.borne - debutGrossier;
        debutA[c] =
          grossier(n, g.points, s0, n, r, limite, (x0 + x1) / 2, (y0 + y1) / 2, kx, ky) + debutGrossier;
        if (debutA[c] < Infinity) seuilDebut.ajouter(debutA[c]);
      }
    }
  }
  const meilleurs = (a: Float64Array, combien: number): number[] => {
    const l: number[] = [];
    for (let c = 0; c < N; c++) if (a[c] < Infinity) l.push(c);
    l.sort((x, y) => a[x] - a[y] || x - y);
    return combien > 0 ? l.slice(0, combien) : l;
  };
  const retenus = [...new Set([...meilleurs(entier, r.tri), ...meilleurs(debutA, r.triDebut)])];
  const apercu = (c: number) => Math.min(entier[c], debutA[c]);

  /* 2. l'appariement complet des retenus, le coup d'œil mêlé au score */
  const scores = new Map<number, number>();
  const complet = (c: number, recaler: boolean): number => {
    const s0 = g.debut[c];
    const k = g.debut[c + 1] - s0;
    const apparie = recaler ? apparierRecale : apparierSeul;
    let s = Infinity;
    if (Math.abs(k - n) <= r.ecart) s = apparie(t.points, n, gp, s0, k, r);
    if (k > n && k - n <= r.reste) {
      const d = apparie(t.points, n, prefixe(s0), 0, n, r) + r.debut;
      if (d < s) s = d;
    }
    return s + r.melange * Math.sqrt(apercu(c) / 3) + r.niveau * (g.niveau[c] - 1);
  };
  for (const c of retenus) scores.set(c, complet(c, false));
  const parScore = (a: number, b: number) => scores.get(a)! - scores.get(b)! || a - b;

  /* 3. le recalage des plus proches */
  if (r.rigidite > 0) {
    const proches = [...scores.keys()].sort(parScore).slice(0, r.recales);
    for (const c of proches) scores.set(c, Math.min(scores.get(c)!, complet(c, true)));
  }
  const ordre = [...scores.keys()].sort(parScore);
  return ordre.slice(0, max).map((c) => ({ c: g.caracteres[c], score: scores.get(c)! }));
}
