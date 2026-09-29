/**
 * Xing 杏, le maître (décision du propriétaire du 29 septembre 2026). Tao reste la compagne de
 * route : le chemin, les jeux, la cuisine, la révision, WeChat. Xing est « le sachant » : il
 * fait passer les examens, explique d'où vient un caractère au pas Apprendre et dans les
 * fiches, raconte l'anecdote du jour et les contes, et tient Chercher. Son nom vient de
 * l'autel des abricotiers 杏坛, où Confucius enseignait.
 *
 * Tao le rencontre à la porte du premier examen, le 县试 : c'est une porte de l'aventure
 * (`ouvertures.ts`, `xing` dans `portes.tsv`), annoncée au retour au menu. Avant la rencontre,
 * Tao garde tous ces rôles, sans changement. La rencontre se lit sur l'état des portes que la
 * progression garde déjà (`Progress.ouvertures`, export et import compris) : aucun champ de
 * plus. Une progression d'avant l'aventure, qui ouvre en silence ce qu'elle a atteint, le
 * rencontre en silence au premier retour au menu.
 *
 * Il ne gronde jamais : un examen pas encore reçu, « on se revoit au prochain ». Ses humeurs
 * sont deux, le calme et le contentement, et ne lisent jamais l'horloge. Module pur, comme
 * `tao.ts` : ni horloge, ni stockage, ni contenu ; ses phrases viennent du pipeline
 * (`ecrans.json`, `xing` ; `examens.json`, `xing_*`).
 */
import type { Etiquette } from './content';
import type { Calendrier, EtatOuvertures } from './ouvertures';
import type { Posture } from './tao';

/** La porte de la rencontre, au calendrier de l'aventure. */
export const PORTE_XING = 'xing' as const;

/** Ce que le maître fait, une fois rencontré. Avant, Tao le fait. */
export type Role = 'examen' | 'etymologie' | 'conte' | 'anecdote' | 'dictionnaire';

export const ROLES: readonly Role[] = ['examen', 'etymologie', 'conte', 'anecdote', 'dictionnaire'];

/** Qui tient un rôle : la compagne, ou le maître. */
export type Guide = 'tao' | 'xing';

/**
 * Une posture par rôle, et le salut de la rencontre :
 * - `examine`, à l'examen, derrière sa petite table, les lamelles 竹简 déroulées ;
 * - `explique`, au pas Apprendre et dans les fiches, une bulle pour le caractère ;
 * - `raconte`, à l'anecdote et aux contes, assis, le rouleau ouvert ;
 * - `consulte`, à Chercher, le livre ouvert ;
 * - `salue`, à la rencontre, les mains jointes 作揖.
 */
export type PostureXing = 'examine' | 'explique' | 'raconte' | 'consulte' | 'salue';

/** Deux humeurs, jamais négatives : le calme, et le contentement, un petit bond. */
export type HumeurXing = 'calme' | 'content';

export const HUMEURS: readonly HumeurXing[] = ['calme', 'content'];

/** La posture du maître pour chaque rôle. */
export const POSTURES: Readonly<Record<Role, PostureXing>> = {
  examen: 'examine',
  etymologie: 'explique',
  conte: 'raconte',
  anecdote: 'raconte',
  dictionnaire: 'consulte'
};

/** À la rencontre, il salue les mains jointes 作揖. */
export const POSTURE_RENCONTRE: PostureXing = 'salue';

/**
 * La posture de Tao pour ces rôles tant qu'elle les tient, telle qu'avant Xing : à l'examen,
 * elle attend à la porte (la robe et le panier se passent à part) ; la bulle du caractère en
 * leçon ; par-dessus l'épaule aux contes et à Chercher ; assise à l'anecdote.
 */
export const POSTURES_TAO: Readonly<Record<Role, Posture>> = {
  examen: 'chemin',
  etymologie: 'lecon',
  conte: 'lecture',
  anecdote: 'anecdote',
  dictionnaire: 'lecture'
};

/**
 * Tao a-t-elle rencontré Xing ? Oui quand la porte de la rencontre a été montrée : annoncée au
 * retour au menu, ou ouverte en silence pour une progression d'avant l'aventure. Sans
 * calendrier lu, sans état suivi (le temps du premier retour au menu), ou avec un export dont
 * le calendrier n'a pas la rencontre, non : Tao garde ses rôles, et Xing n'apparaît jamais
 * sans avoir été présenté.
 */
export function rencontre(etat: EtatOuvertures | null, cal: Calendrier | null): boolean {
  if (etat === null || cal === null) return false;
  if (!cal.some((porte) => porte.id === PORTE_XING)) return false;
  return etat.montrees.includes(PORTE_XING);
}

/** Qui tient ce rôle : le maître une fois rencontré, Tao avant. Tous les rôles passent ensemble. */
export function guide(_role: Role, rencontre: boolean): Guide {
  return rencontre ? 'xing' : 'tao';
}

/** Ce qui vient de se passer sous les yeux du maître. */
export type Moment = 'question' | 'juste' | 'rattrapee' | 'pas-celle' | 'recu' | 'pas-encore' | 'rencontre' | 'recit';

/**
 * L'humeur du maître : content d'une réponse trouvée, rattrapée comprise, d'un examen reçu et
 * de la rencontre ; calme sinon, et calme encore quand ce n'est pas la bonne réponse ou pas
 * encore reçu : il ne gronde jamais, et il n'y a pas d'humeur fâchée à montrer. Rien ici ne
 * lit l'horloge.
 */
export function humeurXing(m: Moment): HumeurXing {
  return m === 'juste' || m === 'rattrapee' || m === 'recu' || m === 'rencontre' ? 'content' : 'calme';
}

/**
 * La ligne de tête du pas Apprendre, selon l'étiquette de la fiche : attestée, mnémotechnique,
 * ou sans origine relue. Xing dit l'étiquette de la fiche, jamais l'autre (`ecrans.json`,
 * `xing`, clés `brique-*` et `compose-*`, contrôlées par `wenlu check`).
 */
export function cleExplication(
  vue: 'brique' | 'compose',
  etiquette: Etiquette | null | undefined,
  origine: string
): `${'brique' | 'compose'}-${'atteste' | 'mnemo' | 'sans'}` {
  const sorte = origine === '' || !etiquette ? 'sans' : etiquette === 'atteste' ? 'atteste' : 'mnemo';
  return `${vue}-${sorte}`;
}
