/** Notation automatique des questions. Pas d'auto-évaluation. */
import { Rating } from 'ts-fsrs';

export type Outcome = { correct: boolean; tries: number; seconds: number };

/** juste du premier coup en < 6 s : Facile ; juste : Bien ; juste après erreur : Dur ; faux deux fois : Oublié. */
export function grade(o: Outcome): Rating {
  if (!o.correct) return Rating.Again;
  if (o.tries > 0) return Rating.Hard;
  return o.seconds < 6 ? Rating.Easy : Rating.Good;
}

/** Un caractère entre en révision quand toutes ses briques sont stables. */
export function unlockable(stabilities: number[], seuil = 7): boolean {
  return stabilities.length > 0 && stabilities.every((s) => s >= seuil);
}
