/**
 * Les droits sans compte (épic 7, story 7.1 ; brief §8 « Paliers », §10, §13) : Wenlu
 * complet ou non, le rythme de la journée, et la prochaine brique gratuite.
 *
 * Décisions du propriétaire du 26 septembre 2026 :
 * - Wenlu complet vient d'un achat (StoreKit, story 6.2 : ici un simple drapeau), d'un jour
 *   ou d'une semaine offerts par un palier de la série, ou du palier de 365 jours. Sur le
 *   web, jamais : ni achat, ni cadeau (les paliers y donnent le sceau et le cadeau de Que) ;
 * - les trente premiers jours du chemin se font au rythme complet, sessions de plus
 *   comprises : une leçon est un jour du chemin, quelle que soit la session qui la pose ;
 * - ensuite, le rythme gratuit : deux briques par semaine, du lundi au dimanche, trois jours
 *   au moins entre deux. Une brique qu'on n'a pas prise ne s'accumule pas ;
 * - la révision de tout l'acquis reste toujours ouverte, et rien d'acquis ne se perd : ce
 *   module ne ferme rien, il ne dit que quand une brique nouvelle peut entrer.
 *
 * Module pur : aucune fonction ne lit l'horloge. La journée (AAAA-MM-JJ) et le jour du
 * chemin (le `jour` de la leçon que la session posera, `session.jourParcours`) sont
 * toujours passés en argument. « Dans N j » se compte en jours du calendrier, ceux que fixe
 * la règle, jamais estimés.
 */

/* ---------- les règles ---------- */

/** Les trente premiers jours du chemin, au rythme complet. */
export const JOURS_COMPLETS = 30;

/** Au rythme gratuit, deux briques nouvelles par semaine, du lundi au dimanche. */
export const BRIQUES_PAR_SEMAINE = 2;

/** Au rythme gratuit, trois jours du calendrier au moins d'une brique à la suivante (lundi, jeudi). */
export const JOURS_ENTRE_BRIQUES = 3;

/** Un jour offert, une semaine offerte : sept jours du calendrier. */
export const JOURS_SEMAINE = 7;

/* ---------- l'état gardé dans la progression ---------- */

/** Ce qu'offre un palier : la journée suivante, une semaine, ou Wenlu complet pour toujours. */
export type DureeCadeau = 'jour' | 'semaine' | 'toujours';

/**
 * Un cadeau de palier, remis par Que (story 7.4) : le palier de la série (7, 30, 100, 365),
 * ce qu'il offre, la journée où il a été reçu, et la journée où il commence. `debut` nul :
 * la semaine attend le premier jour du rythme gratuit (brief §8 : reçue dans les trente
 * premiers jours du chemin, elle commence au premier jour du rythme gratuit).
 */
export type Cadeau = { palier: number; duree: DureeCadeau; recu: string; debut: string | null };

/**
 * Ce que la progression garde des droits, export et import compris :
 * - `cadeaux` : les cadeaux des paliers, avec leurs dates ;
 * - `gratuitDepuis` : le premier jour du calendrier où la leçon à poser dépasse les trente
 *   premiers jours du chemin, le « premier jour du rythme gratuit » du brief (§8), d'où part
 *   une semaine offerte en attente ;
 * - `briques` : les jours des briques gratuites, prises au rythme gratuit, triés ;
 * - `annonce` : le jour où Clore a dit que le rythme gratuit commence, une seule fois.
 */
export type EtatDroits = {
  cadeaux: Cadeau[];
  gratuitDepuis: string | null;
  briques: string[];
  annonce: string | null;
};

export function droitsVides(): EtatDroits {
  return { cadeaux: [], gratuitDepuis: null, briques: [], annonce: null };
}

/**
 * Ce que l'appareil dit, que la progression ne garde pas : le web (la PWA), et l'achat de
 * Wenlu complet (StoreKit le lira sur l'appareil, story 6.2 ; jamais sur le web).
 */
export type Acces = { web: boolean; achat: boolean };

/** Le web, sans achat : le seul périmètre gratuit (brief §13). */
export const ACCES_WEB: Acces = { web: true, achat: false };

/* ---------- les dates ---------- */

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MS_JOUR = 86_400_000;

function horodatage(jour: string): number {
  return Date.parse(`${jour}T00:00:00Z`);
}

/** Une journée civile décalée de `n` jours, AAAA-MM-JJ. */
export function decaler(jour: string, n: number): string {
  return new Date(horodatage(jour) + n * MS_JOUR).toISOString().slice(0, 10);
}

/** Les jours du calendrier de `a` à `b`. */
export function ecartJours(a: string, b: string): number {
  return Math.round((horodatage(b) - horodatage(a)) / MS_JOUR);
}

/** Le lundi de la semaine d'une journée : la semaine va du lundi au dimanche. */
export function lundiDe(jour: string): string {
  return decaler(jour, -((new Date(horodatage(jour)).getUTCDay() + 6) % 7));
}

/* ---------- Wenlu complet ---------- */

/** Le premier jour d'un cadeau : le sien, ou, pour une semaine en attente, le premier jour gratuit. */
export function debutCadeau(c: Cadeau, e: EtatDroits): string | null {
  if (c.debut !== null) return c.debut;
  return c.duree === 'semaine' ? e.gratuitDepuis : c.recu;
}

/** Le cadeau couvre-t-il cette journée ? Un jour, sept jours, ou toujours à partir de son début. */
export function cadeauCouvre(c: Cadeau, e: EtatDroits, jour: string): boolean {
  const debut = debutCadeau(c, e);
  if (debut === null) return false;
  const k = ecartJours(debut, jour);
  if (k < 0) return false;
  if (c.duree === 'toujours') return true;
  return k < (c.duree === 'jour' ? 1 : JOURS_SEMAINE);
}

/**
 * Wenlu complet ce jour-là : par achat, ou par un cadeau de palier qui couvre la journée.
 * Sur le web, jamais : ni achat, ni cadeau.
 */
export function wenluComplet(e: EtatDroits, acces: Acces, jour: string): boolean {
  if (acces.web) return false;
  return acces.achat || e.cadeaux.some((c) => cadeauCouvre(c, e, jour));
}

/* ---------- le rythme ---------- */

/**
 * Le rythme d'une journée : `complet` avec Wenlu complet ; `trente` tant que la leçon à
 * poser est dans les trente premiers jours du chemin ; `gratuit` ensuite. Les deux premiers
 * posent une brique chaque jour, et permettent la session de plus.
 */
export type Rythme = 'complet' | 'trente' | 'gratuit';

/** La leçon de ce jour du chemin est-elle dans les trente premiers ? */
export function dansLesTrente(jourChemin: number): boolean {
  return jourChemin <= JOURS_COMPLETS;
}

export function rythme(e: EtatDroits, acces: Acces, jour: string, jourChemin: number): Rythme {
  if (wenluComplet(e, acces, jour)) return 'complet';
  return dansLesTrente(jourChemin) ? 'trente' : 'gratuit';
}

/**
 * Au rythme gratuit, une brique peut-elle entrer ce jour-là, vu les briques gratuites déjà
 * prises ? Moins de deux dans sa semaine (du lundi au dimanche), et trois jours au moins
 * depuis la précédente. Rien ne s'accumule : une semaine ne voit que ses propres briques.
 */
export function briqueGratuiteLibre(briques: readonly string[], jour: string): boolean {
  const debut = lundiDe(jour);
  const fin = decaler(debut, JOURS_SEMAINE);
  const semaine = briques.filter((b) => b >= debut && b < fin && b !== jour);
  if (semaine.length >= BRIQUES_PAR_SEMAINE) return false;
  return briques.every((b) => b === jour || Math.abs(ecartJours(b, jour)) >= JOURS_ENTRE_BRIQUES);
}

/**
 * La journée pose-t-elle une brique nouvelle ? Au rythme complet et dans les trente premiers
 * jours du chemin, toujours ; au rythme gratuit, si la brique du jour est déjà prise, ou si
 * la règle en laisse entrer une.
 */
export function briqueDuJour(e: EtatDroits, acces: Acces, jour: string, jourChemin: number): boolean {
  if (rythme(e, acces, jour, jourChemin) !== 'gratuit') return true;
  return e.briques.includes(jour) || briqueGratuiteLibre(e.briques, jour);
}

/**
 * La session de plus : avec Wenlu complet, ou tant que la leçon suivante est dans les
 * trente premiers jours du chemin. `jourChemin` est la leçon qu'elle poserait : une session
 * de plus consomme un jour du chemin comme une autre.
 */
export function sessionDePlus(e: EtatDroits, acces: Acces, jour: string, jourChemin: number): boolean {
  return rythme(e, acces, jour, jourChemin) !== 'gratuit';
}

/** La prochaine brique : sa journée, et l'écart en jours du calendrier (1 : demain). */
export type Prochaine = { jour: string; dans: number };

/** Au-delà, rien ne se cherche : la règle en laisse toujours entrer une en une semaine. */
const HORIZON = 2 * JOURS_SEMAINE;

/**
 * Le jour de la prochaine brique, après `jour` : le premier où la règle en laisse entrer
 * une, calculé, jamais estimé. La brique du jour compte comme prise si la journée en pose
 * une (la session du jour la prendra) : on regarde au-delà. `jourChemin` est la leçon que
 * la prochaine session posera. `null` si rien ne se trouve.
 */
export function prochaineBrique(
  e: EtatDroits,
  acces: Acces,
  jour: string,
  jourChemin: number
): Prochaine | null {
  const prises =
    rythme(e, acces, jour, jourChemin) === 'gratuit' &&
    !e.briques.includes(jour) &&
    briqueGratuiteLibre(e.briques, jour)
      ? [...e.briques, jour]
      : e.briques;
  const avec = { ...e, briques: prises };
  for (let k = 1; k <= HORIZON; k++) {
    const d = decaler(jour, k);
    if (briqueDuJour(avec, acces, d, jourChemin)) return { jour: d, dans: k };
  }
  return null;
}

/* ---------- ce que la progression note ---------- */

/**
 * Note le premier jour du rythme gratuit : la première journée où la leçon à poser dépasse
 * les trente premiers jours du chemin. Une fois noté, il ne bouge plus.
 */
export function noterBascule(e: EtatDroits, jourChemin: number, jour: string): EtatDroits {
  if (e.gratuitDepuis !== null || dansLesTrente(jourChemin)) return e;
  return { ...e, gratuitDepuis: jour };
}

/** Note la brique gratuite prise ce jour-là. Une fois par journée. */
export function noterBriqueGratuite(e: EtatDroits, jour: string): EtatDroits {
  if (e.briques.includes(jour)) return e;
  return { ...e, briques: [...e.briques, jour].sort() };
}

/**
 * Clore dit-il, ce jour-là, que le rythme gratuit commence ? Le premier jour où la journée
 * est au rythme gratuit, et ce jour-là seulement, toute la journée.
 */
export function annonceDuRythme(e: EtatDroits, rythmeDuJour: Rythme, jour: string): boolean {
  return rythmeDuJour === 'gratuit' && (e.annonce === null || e.annonce === jour);
}

/** Clore l'a dit : il ne le redira plus un autre jour. */
export function noterAnnonce(e: EtatDroits, jour: string): EtatDroits {
  return e.annonce === null ? { ...e, annonce: jour } : e;
}

/**
 * Range un cadeau de palier (story 7.4 le remettra). Un palier ne s'offre qu'une fois : un
 * cadeau déjà reçu garde sa date.
 */
export function recevoirCadeau(e: EtatDroits, c: Cadeau): EtatDroits {
  if (e.cadeaux.some((x) => x.palier === c.palier)) return e;
  return { ...e, cadeaux: [...e.cadeaux, c] };
}

/* ---------- export et import ---------- */

function journeeOuNull(v: unknown): string | null {
  return typeof v === 'string' && FORMAT_JOUR.test(v) ? v : null;
}

function lireCadeau(v: unknown): Cadeau | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const palier = o.palier;
  const recu = journeeOuNull(o.recu);
  if (typeof palier !== 'number' || !Number.isInteger(palier) || palier < 1 || recu === null) return null;
  if (o.duree !== 'jour' && o.duree !== 'semaine' && o.duree !== 'toujours') return null;
  return { palier, duree: o.duree, recu, debut: journeeOuNull(o.debut) };
}

/**
 * Relit les droits d'un export. Absents (une progression d'avant les droits) : rien de
 * reçu, rien de noté ; le premier jour du rythme gratuit se notera à la prochaine journée
 * ouverte. Une entrée aberrante est écartée.
 */
export function lireDroits(v: unknown): EtatDroits {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return droitsVides();
  const o = v as Record<string, unknown>;
  const cadeaux: Cadeau[] = [];
  for (const x of Array.isArray(o.cadeaux) ? o.cadeaux : []) {
    const c = lireCadeau(x);
    if (c !== null && !cadeaux.some((k) => k.palier === c.palier)) cadeaux.push(c);
  }
  const briques = Array.isArray(o.briques)
    ? [...new Set(o.briques.filter((b): b is string => journeeOuNull(b) !== null))].sort()
    : [];
  return {
    cadeaux,
    gratuitDepuis: journeeOuNull(o.gratuitDepuis),
    briques,
    annonce: journeeOuNull(o.annonce)
  };
}
