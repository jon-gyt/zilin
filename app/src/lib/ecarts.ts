/**
 * Ce que les traits d'un caractère disent de plus qu'un autre, lu dans les données de
 * tracé (les médianes de chaque trait, dans la boîte 1024 × 1024 de l'export).
 *
 * À la correction des jumeaux : le ou les traits qui distinguent deux caractères proches
 * (le point de 主 sur 王, le point de 玉 sous 王, le trait du haut de 士 plus long que
 * celui de 土). Deux caractères du même compte de traits se comparent trait à trait, dans
 * la même boîte ; quand l'un en a plus, on cherche l'autre dans ses traits, dans l'ordre
 * d'écriture, et ce qui reste est ce qu'il a de plus. (La chaîne, devenue une chaîne de
 * mots le 30 septembre 2026, ne peint plus le caractère contenu.)
 *
 * L'écran peint ces traits en indigo : ce n'est ni l'élément ajouté ni la position sur le
 * chemin, le cinabre n'y a pas sa place. Module pur, sans horloge ni stockage. Quand les
 * traits ne permettent pas de conclure, il ne rend rien : mieux vaut ne rien surligner
 * que surligner faux.
 */
import type { StrokeData } from './glyph';

type Point = readonly [number, number];

/** Chaque médiane est ramenée à ce nombre de points, régulièrement espacés. */
const POINTS = 8;

/** Sous cet écart moyen (unités de la boîte 1024), deux traits sont le même trait. */
export const SEUIL_MEME_TRAIT = 55;

function longueur(m: readonly Point[]): number {
  let l = 0;
  for (let k = 1; k < m.length; k++) l += Math.hypot(m[k][0] - m[k - 1][0], m[k][1] - m[k - 1][1]);
  return l;
}

/** Une médiane ramenée à `POINTS` points le long de son tracé. */
export function reechantillonner(m: readonly (readonly number[])[]): Point[] {
  const pts: Point[] = m.filter((p) => p.length >= 2).map((p) => [p[0], p[1]] as const);
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: POINTS }, () => pts[0]);
  const total = longueur(pts);
  if (total === 0) return Array.from({ length: POINTS }, () => pts[0]);
  const out: Point[] = [];
  let k = 1;
  let avant = 0;
  for (let n = 0; n < POINTS; n++) {
    const cible = (total * n) / (POINTS - 1);
    while (k < pts.length - 1 && avant + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) < cible) {
      avant += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      k += 1;
    }
    const seg = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const t = seg === 0 ? 0 : Math.min(1, Math.max(0, (cible - avant) / seg));
    out.push([pts[k - 1][0] + t * (pts[k][0] - pts[k - 1][0]), pts[k - 1][1] + t * (pts[k][1] - pts[k - 1][1])]);
  }
  return out;
}

/** L'écart moyen entre deux traits rééchantillonnés, point à point. */
function ecart(a: readonly Point[], b: readonly Point[]): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  let s = 0;
  for (let k = 0; k < POINTS; k++) s += Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1]);
  return s / POINTS;
}

function traits(d: StrokeData): Point[][] {
  return d.m.map(reechantillonner);
}

/**
 * Le meilleur appariement, dans l'ordre d'écriture, des `k` traits de `petit` avec `k`
 * des traits de `grand` (k ≤ n) : la somme des écarts la plus faible. Rend, pour chaque
 * trait de `petit`, l'indice du trait de `grand` qui lui répond.
 */
function apparier(grand: readonly Point[][], petit: readonly Point[][]): number[] {
  const n = grand.length;
  const k = petit.length;
  const INF = Number.POSITIVE_INFINITY;
  /* cout[i][j] : le meilleur coût pour placer les j premiers traits de `petit` dans les i premiers de `grand`. */
  const cout: number[][] = Array.from({ length: n + 1 }, () => Array<number>(k + 1).fill(INF));
  for (let i = 0; i <= n; i++) cout[i][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= Math.min(i, k); j++) {
      const sauter = cout[i - 1][j];
      const prendre = cout[i - 1][j - 1] + ecart(grand[i - 1], petit[j - 1]);
      cout[i][j] = Math.min(sauter, prendre);
    }
  }
  const out: number[] = Array<number>(k).fill(-1);
  let i = n;
  let j = k;
  while (j > 0 && i > 0) {
    if (cout[i][j] === cout[i - 1][j] && i - 1 >= j) i -= 1;
    else {
      out[j - 1] = i - 1;
      i -= 1;
      j -= 1;
    }
  }
  return out;
}

/**
 * Les traits de `a` qui le distinguent de `b`, son jumeau : les indices dans `a`, dans
 * l'ordre d'écriture. Vide quand `a` n'a rien de plus que `b` (王 contre 主 : c'est 主
 * qui porte le point), ou quand les traits ne permettent pas de conclure.
 *
 * Même compte de traits : les traits de même rang qui s'écartent nettement (au-delà de
 * `SEUIL_MEME_TRAIT`, et au moins à la moitié du plus grand écart). Un trait de plus ou
 * davantage : les traits de `a` qui ne répondent à aucun trait de `b`.
 */
export function traitsQuiDistinguent(a: StrokeData, b: StrokeData): number[] {
  const ta = traits(a);
  const tb = traits(b);
  if (ta.length === 0 || tb.length === 0) return [];
  if (ta.length < tb.length) return [];
  if (ta.length > tb.length) {
    const pris = new Set(apparier(ta, tb));
    return ta.map((_, i) => i).filter((i) => !pris.has(i));
  }
  const ecarts = ta.map((t, i) => ecart(t, tb[i]));
  const max = Math.max(...ecarts);
  if (max < SEUIL_MEME_TRAIT) return [];
  return ecarts.flatMap((e, i) => (e >= SEUIL_MEME_TRAIT && e >= max / 2 ? [i] : []));
}
