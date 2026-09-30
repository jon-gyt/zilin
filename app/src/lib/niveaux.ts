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
 *
 * Un jour du chemin (« jour25 », décision du propriétaire du 26 septembre 2026) est le
 * niveau d'une fable de première lecture : l'acquis des jours 1 à 25 du parcours Lire. Il
 * se range sous le seuil 255, que ce parcours mène à son terme, et entre eux par leur
 * jour ; son rang n'est pas un nombre de caractères. Sur un autre parcours, la fable
 * s'ouvre comme toute version, quand ses caractères sont acquis.
 */

/** Un niveau de conte : « 255 », « hsk3 », « hsk7-9 ». */
export type Niveau = string;

const HSK = /^hsk([1-6]|7-9)$/;
const SEUIL = /^[1-9][0-9]*$/;
const CHEMIN = /^jour([1-9][0-9]{0,2})$/;

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
  return SEUIL.test(s) || HSK.test(s) || CHEMIN.test(s) ? s : null;
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

/** Un jour du chemin Lire : « jour25 ». */
export function estChemin(n: Niveau): boolean {
  return CHEMIN.test(n);
}

/**
 * Les niveaux du chemin renommés, ancien nom → nouveau. Décision du propriétaire du
 * 30 septembre 2026 (« Réconcilier les 13 ») : 冖 s'insère au jour 13 du chemin Lire, les
 * jours 13 à 131 glissent d'un jour, et les trois fables du chemin avec eux. Une progression
 * d'avant nomme l'ancien niveau (contes lus, récits en cours, trophées) : elle se relit sous
 * le nouveau (`session.fromJSON`), et rien de lu ne se perd. Le catalogue des contes ne
 * reprend jamais un ancien nom.
 */
const NIVEAUX_RENOMMES: ReadonlyMap<string, Niveau> = new Map([
  ['jour25', 'jour26'],
  ['jour44', 'jour45'],
  ['jour60', 'jour61']
]);

/** Le nom actuel d'un niveau qu'une progression d'avant a noté : « jour25 » → « jour26 ». */
export function niveauRenomme(n: Niveau): Niveau {
  return NIVEAUX_RENOMMES.get(n) ?? n;
}

/**
 * L'identifiant actuel d'un trophée de conte qu'une progression d'avant a noté :
 * « conte-xue-yi-jour25 » → « conte-xue-yi-jour26 » (`trophees.tropheesContes`). Tout
 * autre identifiant reste tel quel.
 */
export function tropheeRenomme(id: string): string {
  if (!id.startsWith('conte-')) return id;
  const tiret = id.lastIndexOf('-');
  const niveau = id.slice(tiret + 1);
  const nouveau = niveauRenomme(niveau);
  return nouveau === niveau ? id : `${id.slice(0, tiret + 1)}${nouveau}`;
}

/** Le jour d'un niveau du chemin (« jour25 » → 25), `null` pour un autre niveau. */
export function jourDuNiveau(n: Niveau): number | null {
  const m = CHEMIN.exec(n);
  return m ? Number(m[1]) : null;
}

/**
 * Le nombre de caractères du niveau, cumul compris : 255 pour le seuil 255, 900 pour HSK 3.
 * Un jour du chemin se range par son jour, sous le seuil 255.
 */
export function rangNiveau(n: Niveau): number {
  if (SEUIL.test(n)) return Number(n);
  const jour = jourDuNiveau(n);
  if (jour !== null) return jour;
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

/** Ce que porte le sceau d'un niveau : « 255 », « HSK 3 », « HSK 7-9 », « Jour 25 ». */
export function libelleNiveau(n: Niveau): string {
  const jour = jourDuNiveau(n);
  if (jour !== null) return `Jour ${jour}`;
  return estHsk(n) ? `HSK ${n.slice(3)}` : n;
}

/** Le niveau dans une phrase : « seuil 255 », « HSK 3 », « jour 25 du chemin ». */
export function nomNiveau(n: Niveau): string {
  const jour = jourDuNiveau(n);
  if (jour !== null) return `jour ${jour} du chemin`;
  return estHsk(n) ? libelleNiveau(n) : `seuil ${n}`;
}

/** « au seuil 255 », « au niveau HSK 3 », « au jour 25 du chemin ». */
export function auNiveau(n: Niveau): string {
  if (estChemin(n)) return `au ${nomNiveau(n)}`;
  return estHsk(n) ? `au niveau ${libelleNiveau(n)}` : `au seuil ${n}`;
}

/** « du seuil 255 », « du niveau HSK 3 », « du jour 25 du chemin ». */
export function duNiveau(n: Niveau): string {
  if (estChemin(n)) return `du ${nomNiveau(n)}`;
  return estHsk(n) ? `du niveau ${libelleNiveau(n)}` : `du seuil ${n}`;
}
