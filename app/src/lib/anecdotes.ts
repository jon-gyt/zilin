/**
 * L'anecdote ordinaire du jour : laquelle, parmi celles du pipeline (`anecdotes.json`).
 *
 * Module pur : aucune fonction ne lit l'horloge, n'écrit dans un stockage ni ne charge le
 * contenu. La journée, la liste, les caractères rencontrés et le registre des anecdotes
 * déjà montrées (`Progress.anecdotesVues`) arrivent en argument.
 *
 * Trois règles, dans l'ordre :
 *
 * 1. la même toute la journée : celle que l'écran Ouvrir a montrée aujourd'hui revient
 *    telle quelle, depuis Lire ou l'en-tête du menu ;
 * 2. d'abord un caractère que l'apprenant vient de rencontrer : la brique du jour, puis
 *    ses composés, puis ceux des jours d'avant (`recents`) ;
 * 3. sinon, un tour de la liste qui avance d'un cran par jour, en gardant pour leur jour
 *    les caractères que le parcours pose dans le mois qui vient (`prochains`).
 *
 * Et jamais une anecdote déjà montrée dans les trente derniers jours, tant qu'il en reste
 * une autre. Retour du propriétaire du 26 septembre 2026 : douze anecdotes en boucle, et la
 * même plusieurs jours de suite.
 */
import { jourDepuisEpoque, nomParcours, type Anecdote, type Index } from './content';

/** Aucune anecdote ne revient avant ce nombre de jours. */
export const SANS_REDITE = 30;

/** Les jours d'avant la leçon du jour dont les caractères comptent encore comme récents. */
export const JOURS_RECENTS = 3;

/**
 * Les caractères que l'apprenant vient de rencontrer, du plus récent au plus ancien : la
 * brique du jour `jour` du parcours, ses composés, puis ceux des `JOURS_RECENTS` jours
 * d'avant. Un jour non réconcilié n'enseigne rien : il est sauté. `jour` vient de
 * `session.jourRencontre` ; `0` (avant la première session) n'en donne aucun.
 */
export function recents(i: Index, parcours: string | null, jour: number): string[] {
  const p = i.parcours[nomParcours(i, parcours)];
  if (!p || jour < 1) return [];
  const out: string[] = [];
  const jours = p.jours
    .filter((j) => j.jour <= jour && j.jour >= jour - JOURS_RECENTS && !j.non_reconcilie)
    .sort((a, b) => b.jour - a.jour);
  for (const j of jours) {
    for (const c of [j.brique, ...j.composes]) if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Les caractères que le parcours pose dans les `SANS_REDITE` jours après `jour` : leur
 * anecdote attend leur jour, plutôt que de passer au tour de la liste et de ne plus
 * pouvoir revenir quand on les rencontre.
 */
export function prochains(i: Index, parcours: string | null, jour: number): string[] {
  const p = i.parcours[nomParcours(i, parcours)];
  if (!p) return [];
  return p.jours
    .filter((j) => j.jour > jour && j.jour <= jour + SANS_REDITE && !j.non_reconcilie)
    .flatMap((j) => [j.brique, ...j.composes])
    .filter((c): c is string => typeof c === 'string' && c !== '');
}

/** Les caractères récents et à venir autour du jour `jour` du parcours, pour `saisons.suiviDe`. */
export function autourDuJour(
  i: Index,
  parcours: string | null,
  jour: number
): { recents: string[]; prochains: string[] } {
  return { recents: recents(i, parcours, jour), prochains: prochains(i, parcours, jour) };
}

/** Jours de `vue` à `jour` ; `NaN` pour une date illisible. */
function ecart(vue: string, jour: string): number {
  return jourDepuisEpoque(jour) - jourDepuisEpoque(vue);
}

/**
 * L'anecdote ordinaire de la journée `jour` (AAAA-MM-JJ). `vues` : pour chaque caractère,
 * la dernière journée où son anecdote a été montrée. `null` sur une liste vide ou une
 * date illisible.
 */
export function choisirAnecdote(
  liste: readonly Anecdote[],
  jour: string,
  recentsDuJour: readonly string[],
  vues: Readonly<Record<string, string>>,
  aVenir: readonly string[] = []
): Anecdote | null {
  const j = jourDepuisEpoque(jour);
  if (liste.length === 0 || !Number.isFinite(j)) return null;

  /* 1. Déjà montrée aujourd'hui : c'est elle, toute la journée. */
  const montree = liste.find((a) => vues[a.c] === jour);
  if (montree) return montree;

  const redite = (a: Anecdote): boolean => {
    const v = vues[a.c];
    if (v === undefined) return false;
    const e = ecart(v, jour);
    return Number.isFinite(e) && Math.abs(e) < SANS_REDITE;
  };

  /* 2. Un caractère rencontré ces derniers jours, le plus récent d'abord. */
  for (const c of recentsDuJour) {
    const a = liste.find((x) => x.c === c);
    if (a && !redite(a)) return a;
  }

  /* 3. Le tour de la liste, d'un cran par jour, en sautant les redites ; les caractères
   *    à venir d'abord gardés pour leur jour, puis pris s'il ne reste qu'eux. */
  const n = liste.length;
  const depart = ((j % n) + n) % n;
  for (const garder of [true, false]) {
    for (let k = 0; k < n; k++) {
      const a = liste[(depart + k) % n];
      if (!redite(a) && !(garder && aVenir.includes(a.c))) return a;
    }
  }

  /* Toutes montrées dans le mois (liste courte) : celle qui l'a été le plus tôt. */
  let meilleure = liste[depart];
  for (const a of liste) {
    if (ecart(vues[a.c] ?? '', jour) > ecart(vues[meilleure.c] ?? '', jour)) meilleure = a;
  }
  return meilleure;
}
