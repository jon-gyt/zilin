/**
 * La demande de note, au bon moment, dans l'app iOS seulement (rapport comparatif du
 * 28 septembre 2026, §2.4 ; indicateur du brief §15, « 4,7 avec 100 avis à trois mois »).
 *
 * Apple recommande de demander après un accomplissement, et limite l'affichage à trois fois
 * par an ; la fenêtre est celle du système, qui décide seule de se montrer. Tao n'en parle
 * pas, aucune fausse question (« Tu aimes Wenlu ? ») ne trie les contents.
 *
 * Module pur : la journée, le lieu et le moment arrivent en argument. Les règles, une par
 * test :
 *
 * - au retour au menu, après un moment de fierté : un 放榜, un premier conte lu, un palier
 *   de la série (7, 30, 100, 365 jours) ;
 * - jamais en session ;
 * - jamais dans les sept premiers jours, comptés depuis la première graine ;
 * - au plus une fois tous les cent vingt jours.
 */
import { jourDepuisEpoque } from './content';
import { etatSerie } from './serie';
import type { Progress } from './session';

/** Les jours, depuis la première graine, avant la première demande. */
export const JOURS_AVANT_AVIS = 7;

/** Les jours au moins entre deux demandes. */
export const JOURS_ENTRE_AVIS = 120;

/** Les moments de fierté après lesquels, de retour au menu, la demande peut venir. */
export type Moment = 'fangbang' | 'conte' | 'palier';

/** Où l'on est quand le moment est passé : au menu, ou encore dans une session. */
export type Lieu = 'menu' | 'session';

function ecart(de: string, a: string): number {
  return jourDepuisEpoque(a) - jourDepuisEpoque(de);
}

/**
 * La demande peut-elle venir maintenant ? Au menu, après un moment de fierté, sept jours
 * au moins après la première graine, cent vingt au moins après la demande précédente.
 */
export function peutDemanderAvis(
  p: Pick<Progress, 'joursTravailles' | 'avisDemande'>,
  jour: string,
  lieu: Lieu,
  moment: Moment | null
): boolean {
  if (lieu !== 'menu' || moment === null) return false;
  const premier = [...p.joursTravailles].sort()[0];
  if (premier === undefined || !(ecart(premier, jour) >= JOURS_AVANT_AVIS)) return false;
  return p.avisDemande === null || ecart(p.avisDemande, jour) >= JOURS_ENTRE_AVIS;
}

/** Note la demande : la suivante attend cent vingt jours. */
export function noterAvisDemande(p: Progress, jour: string): Progress {
  return { ...p, avisDemande: jour };
}

/** Relit la journée de la dernière demande ; absente ou illisible, aucune. */
export function lireAvisDemande(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** La session close vient de planter la graine d'un palier de la série : Que remet son cadeau. */
export function momentDeClore(avant: Progress, apres: Progress, jour: string): Moment | null {
  const plantee = !avant.joursTravailles.includes(jour) && apres.joursTravailles.includes(jour);
  return plantee && etatSerie(apres.joursTravailles, jour).palier !== null ? 'palier' : null;
}

/** Le premier conte lu, tous niveaux confondus. */
export function momentDeConte(avant: Progress, apres: Progress): Moment | null {
  const lus = (q: Progress): number => Object.values(q.contesLus).reduce((n, l) => n + l.length, 0);
  return lus(avant) === 0 && lus(apres) > 0 ? 'conte' : null;
}
