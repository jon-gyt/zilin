/**
 * La moyenne de la voix de l'apprenant (story 9.1, « Dis-le »).
 *
 * Le registre d'une syllabe (haute, basse) ne se lit que face à la voix de celui qui parle :
 * un ton 3 bas chez une voix aiguë peut être plus haut qu'un ton 1 chez une voix grave.
 * L'app apprend cette voix sans rien demander : la moyenne (Hz) de chaque syllabe analysée
 * est gardée dans la progression (`Progress.voix`), et la référence est la médiane, en log,
 * des trente dernières. Avant cinq syllabes, il n'y a pas de référence : le modèle juge la
 * seule forme de la courbe, et il a été entraîné à s'en passer.
 *
 * C'est tout ce qui reste d'un enregistrement : des nombres, jamais le son. Ils sortent avec
 * l'export JSON de la progression et rentrent avec l'import. Module pur.
 */

/** Il faut cinq syllabes pour connaître la voix. */
export const MIN_VOIX = 5;

/** Au plus trente moyennes gardées : la voix d'aujourd'hui, pas celle d'il y a un an. */
export const FENETRE_VOIX = 30;

/** Une moyenne hors de ces bornes n'est pas une voix : le suivi cherche entre 60 et 600 Hz. */
export const VOIX_MIN_HZ = 50;
export const VOIX_MAX_HZ = 700;

function plausible(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= VOIX_MIN_HZ && v <= VOIX_MAX_HZ;
}

/**
 * La référence de la voix, en Hz : la médiane (en log) des `fenetre` dernières moyennes.
 * `undefined` tant qu'il y en a moins de `min`.
 */
export function refLocuteur(moyennes: readonly number[], min = MIN_VOIX, fenetre = FENETRE_VOIX): number | undefined {
  const v = moyennes.filter(plausible);
  if (v.length < min) return undefined;
  const l = v.slice(-fenetre).map((m) => Math.log2(m)).sort((a, b) => a - b);
  const k = l.length >> 1;
  return Math.pow(2, l.length % 2 ? l[k] : (l[k - 1] + l[k]) / 2);
}

/** Ajoute la moyenne d'une syllabe analysée, au dixième de hertz ; les trente dernières restent. */
export function ajouterMoyenne(moyennes: readonly number[], hz: number): number[] {
  if (!plausible(hz)) return [...moyennes];
  return [...moyennes, Math.round(hz * 10) / 10].slice(-FENETRE_VOIX);
}

/** Relit la voix d'un export : des nombres plausibles, les trente derniers. Absente : aucune. */
export function lireVoix(brut: unknown): number[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(plausible).slice(-FENETRE_VOIX);
}
