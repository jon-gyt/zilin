/**
 * Tao mange pendant la révision (brief §9, `docs/jeux.md`) : les écrans qui posent des
 * questions, Échauffer et Fixer, lui passent chaque verdict. La règle est dans
 * `tao.reagir` ; ici, seulement le temps de voir le geste, et le compteur de coups qui
 * relance l'animation quand deux gestes identiques se suivent. La série n'est jamais
 * affichée : elle se voit au bond.
 */
import { DUREE_REACTION_MS, reagir, type Reaction } from './tao';

export class TaoMange {
  /** Le geste en cours, `null` entre deux réponses : elle revient à sa posture. */
  reaction: Reaction | null = $state(null);
  /** Un coup par verdict : l'écran s'en sert de clé pour rejouer le geste. */
  coup = $state(0);
  #serie = 0;
  #minuteur: ReturnType<typeof setTimeout> | null = null;

  verdict(juste: boolean): void {
    const r = reagir(this.#serie, juste);
    this.#serie = r.serie;
    this.reaction = r.reaction;
    this.coup += 1;
    this.arreter();
    this.#minuteur = setTimeout(() => {
      this.reaction = null;
      this.#minuteur = null;
    }, DUREE_REACTION_MS);
  }

  /** L'écran s'en va : plus de geste en attente. */
  arreter(): void {
    if (this.#minuteur !== null) clearTimeout(this.#minuteur);
    this.#minuteur = null;
  }
}
