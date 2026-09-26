/**
 * Le retour haptique, dans l'app iOS seulement (brief §12, phase 4).
 *
 * Deux gestes, pas un de plus, dans le ton de l'app :
 * - un léger tap sur une bonne réponse (`bonneReponse`) ;
 * - un signal doux quand la session se clôt (`sessionClose`).
 * Rien sur une erreur : « une erreur ne coûte rien », pas de vibration qui punit.
 *
 * Sur le web, et partout hors de Capacitor, les deux fonctions ne font rien : pas de
 * `navigator.vibrate` en repli. Le réglage « Retour haptique » (`Progress.haptique`)
 * les coupe aussi ; l'app le recopie ici au démarrage et à chaque changement
 * (`reglerHaptique`), comme `reglerApercu` pour le mode relecture.
 *
 * Un retour haptique qui échoue ne dit rien et ne casse rien.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let allume = true;

/** Recopie le réglage de la progression. */
export function reglerHaptique(on: boolean): void {
  allume = on;
}

/** Vrai dans l'app native, où le greffon est installé. Réglages ne montre l'interrupteur qu'alors. */
export function haptiqueDisponible(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics');
}

function jouer(geste: () => Promise<void>): void {
  if (!allume || !haptiqueDisponible()) return;
  try {
    void geste().catch(() => undefined);
  } catch {
    /* le greffon absent ou muet : on continue sans */
  }
}

/** Une bonne réponse : un tap léger. */
export function bonneReponse(): void {
  jouer(() => Haptics.impact({ style: ImpactStyle.Light }));
}

/** La session close : le signal de réussite du système, doux et bref. */
export function sessionClose(): void {
  jouer(() => Haptics.notification({ type: NotificationType.Success }));
}
