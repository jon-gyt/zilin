/**
 * Ce que fait Tao à chaque verdict d'un jeu (brief §9 : « une carte, une bouchée ;
 * erreur, grimace ; série juste, bond »).
 *
 * Une bonne réponse : une bouchée. Une erreur : une grimace brève, rien de plus, ni
 * larme ni reproche. Trois bonnes réponses d'affilée : un bond. La série ne se montre
 * jamais en nombre : aucun compteur, aucun combo, aucun point. Elle ne se lit qu'à la
 * posture de Tao, et une erreur la remet à zéro sans rien dire.
 *
 * Module pur : aucune horloge, aucun stockage. L'écran porte la série d'un verdict au
 * suivant et la remet à zéro à chaque manche.
 */

/** Une réaction de Tao : une bouchée, une grimace, un bond. */
export type Reaction = 'bouchee' | 'grimace' | 'bond';

/** Trois bonnes réponses d'affilée : Tao bondit. */
export const SERIE_BOND = 3;

/** La grimace est brève : le visage revient au calme après ce délai. */
export const GRIMACE_MS = 1400;

/** Le bond dure le temps d'un saut, puis Tao se pose. */
export const BOND_MS = 900;

/** La réaction à un verdict, et la série qui suit. `serie` : les bonnes réponses d'affilée avant celle-ci. */
export function reagir(serie: number, correct: boolean): { reaction: Reaction; serie: number } {
  if (!correct) return { reaction: 'grimace', serie: 0 };
  const n = Math.max(0, Math.floor(serie)) + 1;
  return { reaction: n % SERIE_BOND === 0 ? 'bond' : 'bouchee', serie: n };
}
