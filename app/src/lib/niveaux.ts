/**
 * Les niveaux des contes (story 1.7, épic 2c). Module pur.
 *
 * Un niveau est un seuil sinographique (« 255 ») ou un niveau du HSK 3.0, GF 0025-2021
 * (« hsk1 » à « hsk6 », puis « hsk7-9 », que la norme ne départage pas). L'export écrit un
 * seuil en nombre (255) et un niveau HSK en chaîne (« hsk3 ») ; l'app les tient tous en
 * chaîne, et une progression d'avant les niveaux HSK, qui notait des nombres, se relit.
 *
 * Les niveaux se rangent par leur nombre de caractères, cumul compris : un niveau HSK se
 * lit en cumul (HSK 3, les 900 caractères des niveaux 1 à 3), si bien que 255 < HSK 1
 * (300) < HSK 2 (600) … < HSK 7-9 (3 000). Ce rang ne sert qu'à ordonner : rien n'est
 * estimé, une version s'ouvre par ses caractères, pas par son niveau.
 */

/** Un niveau de conte : « 255 », « hsk3 », « hsk7-9 ». */
export type Niveau = string;

const HSK = /^hsk([1-6]|7-9)$/;
const SEUIL = /^[1-9][0-9]*$/;

/** Les caractères de chaque niveau HSK, cumul compris. */
const CUMULS_HSK: Readonly<Record<string, number>> = {
  hsk1: 300,
  hsk2: 600,
  hsk3: 900,
  hsk4: 1200,
  hsk5: 1500,
  hsk6: 1800,
  'hsk7-9': 3000
};

/** Relit un niveau de l'export ou de la progression : 255, « 255 », « hsk3 ». `null` sinon. */
export function lireNiveau(v: unknown): Niveau | null {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? String(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return SEUIL.test(s) || HSK.test(s) ? s : null;
}

/** Relit une liste de niveaux : les valides, sans doublon, du plus petit au plus grand. */
export function lireNiveaux(v: unknown): Niveau[] {
  if (!Array.isArray(v)) return [];
  return trierNiveaux(v.map(lireNiveau).filter((n): n is Niveau => n !== null));
}

/** Un niveau HSK. */
export function estHsk(n: Niveau): boolean {
  return HSK.test(n);
}

/** Le nombre de caractères du niveau, cumul compris : 255 pour le seuil 255, 900 pour HSK 3. */
export function rangNiveau(n: Niveau): number {
  if (SEUIL.test(n)) return Number(n);
  return CUMULS_HSK[n] ?? Number.MAX_SAFE_INTEGER;
}

/** Pour trier : du plus petit niveau au plus grand. */
export function comparerNiveaux(a: Niveau, b: Niveau): number {
  return rangNiveau(a) - rangNiveau(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Sans doublon, du plus petit au plus grand. */
export function trierNiveaux(ns: readonly Niveau[]): Niveau[] {
  return [...new Set(ns)].sort(comparerNiveaux);
}

/** Le plus grand de deux niveaux. */
export function plusHaut(a: Niveau, b: Niveau): Niveau {
  return comparerNiveaux(a, b) >= 0 ? a : b;
}

/** Ce que porte le sceau d'un niveau : « 255 », « HSK 3 », « HSK 7-9 ». */
export function libelleNiveau(n: Niveau): string {
  return estHsk(n) ? `HSK ${n.slice(3)}` : n;
}

/** Le niveau dans une phrase : « seuil 255 », « HSK 3 ». */
export function nomNiveau(n: Niveau): string {
  return estHsk(n) ? libelleNiveau(n) : `seuil ${n}`;
}

/** « au seuil 255 », « au niveau HSK 3 ». */
export function auNiveau(n: Niveau): string {
  return estHsk(n) ? `au niveau ${libelleNiveau(n)}` : `au seuil ${n}`;
}

/** « du seuil 255 », « du niveau HSK 3 ». */
export function duNiveau(n: Niveau): string {
  return estHsk(n) ? `du niveau ${libelleNiveau(n)}` : `du seuil ${n}`;
}
