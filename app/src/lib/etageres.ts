/**
 * Les étagères de Lire : chaque conte est un livre cousu 线装书, rangé sur l'une de trois
 * étagères (décision du propriétaire du 26 septembre 2026 : l'ancienne liste était « trop
 * classique »). Module pur, comme `lecture.ts` : il range ce que `bibliotheque` a déjà
 * décidé, sans rien lire d'autre que ses arguments, et sans rien estimer.
 *
 * - « À lire maintenant » : les contes que l'acquis ouvre (et, en mode relecture, ceux que
 *   ce mode ouvre, marqués) ;
 * - « Bientôt » : les contes écrits, pas encore ouverts, dont tous les caractères qui
 *   manquent à la première version sont sur le chemin de l'apprenant (le parcours de
 *   l'export) : le jour du chemin où entre le dernier se calcule, et le livre dit
 *   « s'ouvre dans N j » (N jours du chemin, qui n'avance qu'avec les sessions) ; un
 *   caractère déjà passé mais pas encore acquis ne se date pas, et le livre ne dit rien ;
 * - « Plus loin » : les autres, écrits hors du chemin ou pas encore écrits.
 *
 * C'est l'ordre du brief (§7) : les ouverts d'abord, puis les écrits fermés, puis ceux à
 * venir, chaque étagère dans l'ordre de la bibliothèque. Rien n'est estimé : sans jour
 * calculable, rien ne s'annonce ; sous un livre fermé, on compte ce qu'il reste à lire.
 *
 * La couverture : un pigment de la peinture (`--t1` à `--t4`), fixé par le rang du conte
 * au catalogue, pour qu'un livre garde sa couleur en changeant d'étagère ; le motif vient
 * du catalogue (`motif`), un nom du jeu fermé `MOTIFS` que `Motif.svelte` dessine.
 */
import type { CatalogueConte, Conte, IndexJour } from './content';
import { ETATS_NIVEAU, manquants, type EntreeConte, type EtatNiveau } from './lecture';
import { comparerNiveaux, estHsk, libelleNiveau, nomNiveau, type Niveau } from './niveaux';

/* ---------- les motifs ---------- */

/** Les motifs que l'app sait dessiner : le même jeu que `contes.MOTIFS` du pipeline. */
export const MOTIFS = [
  'montagne',
  'pousse',
  'roues',
  'puits',
  'souche',
  'serpent',
  'tigre',
  'cheval',
  'elephant',
  'rouleau',
  'enclos',
  'lance',
  'singe'
] as const;

export type Motif = (typeof MOTIFS)[number];

/** Le motif du catalogue, s'il est du jeu ; sinon aucun, et la couverture reste nue. */
export function lireMotif(v: string | undefined): Motif | null {
  return (MOTIFS as readonly string[]).includes(v ?? '') ? (v as Motif) : null;
}

/* ---------- les couvertures ---------- */

/** Les pigments de la peinture chinoise, tels que `tokens.css` les nomme. */
export type Pigment = 't1' | 't2' | 't3' | 't4';

/** L'ordre des pigments sur l'étagère : azurite, malachite, rouge de pêcher, gomme-gutte. */
export const PIGMENTS: readonly Pigment[] = ['t1', 't4', 't3', 't2'];

/** Un niveau sous le livre, en petit sceau : son état, et s'il a déjà été lu. */
export type Sceau = { seuil: Niveau; etat: EtatNiveau; lu: boolean };

/** Un conte en livre cousu. */
export type Livre = {
  entree: EntreeConte;
  pigment: Pigment;
  motif: Motif | null;
  /** 1 pour une fable ; plus pour un récit long, que la couverture annonce (« 4 CHAP. »). */
  chapitres: number;
  sceaux: Sceau[];
  /** « Bientôt » : dans combien de jours du chemin il s'ouvre ; `null` quand on ne sait pas. */
  dans: number | null;
};

/* ---------- le chemin ---------- */

/**
 * Le jour du chemin où chaque caractère entre, en brique ou en composé. Un jour non
 * réconcilié est sauté par la session (`content.jourDuParcours`) : ses caractères n'y
 * entrent pas.
 */
export function joursDuChemin(jours: readonly IndexJour[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const j of jours) {
    if (j.non_reconcilie) continue;
    for (const c of [j.brique, ...j.composes]) if (c !== null && !out.has(c)) out.set(c, j.jour);
  }
  return out;
}

/**
 * Le jour du chemin où s'ouvre la première version d'un conte fermé : celui où entre le
 * dernier des caractères qui lui manquent. `null` si l'un d'eux n'est pas sur le chemin,
 * ou s'il n'en manque aucun (le fichier manque : on ne sait pas).
 */
export function jourDOuverture(manque: readonly string[], chemin: ReadonlyMap<string, number>): number | null {
  if (manque.length === 0) return null;
  let dernier = 0;
  for (const c of manque) {
    const j = chemin.get(c);
    if (j === undefined) return null;
    dernier = Math.max(dernier, j);
  }
  return dernier;
}

/**
 * Pour chaque conte écrit et fermé, le jour du chemin où il s'ouvre, ou `null`. La version
 * attendue est la première, celle que la bibliothèque annonce (`lecture.entreeConte`).
 */
export function ouvertures(
  entrees: readonly EntreeConte[],
  contes: ReadonlyMap<string, Conte>,
  acquis: ReadonlySet<string>,
  chemin: ReadonlyMap<string, number>
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const e of entrees) {
    if (e.version !== null || !e.ecrit) continue;
    const premiere = contes.get(e.id)?.versions[0];
    out[e.id] = premiere ? jourDOuverture(manquants(premiere, acquis), chemin) : null;
  }
  return out;
}

/* ---------- les étagères ---------- */

export type EtagereId = 'maintenant' | 'bientot' | 'loin';

export const NOMS_ETAGERES: Record<EtagereId, string> = {
  maintenant: 'À lire maintenant',
  bientot: 'Bientôt',
  loin: 'Plus loin'
};

export type Etagere = { id: EtagereId; nom: string; livres: Livre[] };

/**
 * L'étagère d'un conte : ouvert ; écrit, fermé, et sur le chemin (`ouverture`, le jour du
 * chemin où il s'ouvre, n'est pas nul) ; ou plus loin.
 */
export function etagereDe(e: EntreeConte, ouverture: number | null = null): EtagereId {
  if (e.version !== null) return 'maintenant';
  return e.ecrit && ouverture !== null ? 'bientot' : 'loin';
}

/** Le chemin de l'apprenant : le jour où s'ouvre chaque conte fermé, et le dernier jour fait. */
export type Route = { ouvertures: Readonly<Record<string, number | null>>; fait: number };

/**
 * Les trois étagères, toujours dans le même ordre, chacune dans l'ordre de la
 * bibliothèque. `contesLus` dit, conte par conte, les niveaux déjà lus : leur sceau passe
 * au jade. `route` range sur « Bientôt » les contes que le chemin ouvre, et dit dans
 * combien de jours ; sans elle, rien n'y va. Une étagère peut être vide ; l'écran décide de
 * la montrer ou non.
 */
export function etageres(
  entrees: readonly EntreeConte[],
  catalogue: readonly CatalogueConte[] = [],
  contesLus: Readonly<Record<string, readonly Niveau[]>> = {},
  route: Route = { ouvertures: {}, fait: 0 }
): Etagere[] {
  const ouverture = (e: EntreeConte): number | null => route.ouvertures[e.id] ?? null;
  const prevus = new Map(catalogue.map((c) => [c.id, c]));
  const ordre = [...new Set([...catalogue.map((c) => c.id), ...entrees.map((e) => e.id)])];
  const livre = (e: EntreeConte): Livre => {
    const prevu = prevus.get(e.id);
    const lus = contesLus[e.id] ?? [];
    return {
      entree: e,
      pigment: PIGMENTS[Math.max(0, ordre.indexOf(e.id)) % PIGMENTS.length],
      motif: lireMotif(prevu?.motif),
      chapitres: Math.max(prevu?.chapitres ?? 1, e.version?.chapitres?.length ?? 1),
      sceaux: e.niveaux.map((n) => ({ seuil: n.seuil, etat: n.etat, lu: lus.includes(n.seuil) })),
      dans: dansCombien(ouverture(e), route.fait)
    };
  };
  const ids: EtagereId[] = ['maintenant', 'bientot', 'loin'];
  return ids.map((id) => ({
    id,
    nom: NOMS_ETAGERES[id],
    livres: entrees.filter((e) => etagereDe(e, ouverture(e)) === id).map(livre)
  }));
}

/**
 * Dans combien de jours du chemin s'ouvre un conte, le dernier jour fait étant `fait` :
 * `null` sans jour, ou quand ce jour est passé (ses caractères sont vus, pas encore acquis).
 */
export function dansCombien(ouverture: number | null, fait: number): number | null {
  return ouverture !== null && ouverture > fait ? ouverture - fait : null;
}

/** « s'ouvre dans 6 j » sous un livre de « Bientôt » ; rien sans jour. */
export function ligneOuverture(dans: number | null): string {
  return dans === null ? '' : `s'ouvre dans ${dans} j`;
}

/** Les livres d'une étagère en rangées de `n`, chacune sur sa planche. */
export function rangees<T>(xs: readonly T[], n: number): T[][] {
  const k = Math.max(1, Math.floor(n));
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += k) out.push(xs.slice(i, i + k));
  return out;
}

/** Combien de livres tiennent côte à côte sur `largeur` pixels ; trois tant qu'on ne sait pas. */
export function livresParRangee(largeur: number, livre = 100, ecart = 12): number {
  if (!(largeur > 0)) return 3;
  return Math.max(1, Math.floor((largeur + ecart) / (livre + ecart)));
}

/**
 * L'étendue des niveaux d'une étagère, du plus bas niveau prévu au plus haut : « HSK 3 à
 * 7-9 », « 255 à HSK 5 », « HSK 4 ». Vide sans niveau.
 */
export function etendue(livres: readonly Livre[]): string {
  const ns = livres.flatMap((l) => l.sceaux.map((s) => s.seuil));
  if (ns.length === 0) return '';
  const tries = [...new Set(ns)].sort(comparerNiveaux);
  const bas = tries[0];
  const haut = tries[tries.length - 1];
  if (bas === haut) return libelleNiveau(bas);
  const fin = estHsk(bas) && estHsk(haut) ? haut.slice(3) : libelleNiveau(haut);
  return `${libelleNiveau(bas)} à ${fin}`;
}

/** « seuil 255 écrit et ouvert, déjà lu, HSK 5 pas encore écrit » : les sceaux, pour un lecteur d'écran. */
export function niveauxLus(l: Pick<Livre, 'sceaux'>): string {
  return (
    'Niveaux : ' +
    l.sceaux.map((s) => `${nomNiveau(s.seuil)} ${ETATS_NIVEAU[s.etat]}${s.lu ? ', déjà lu' : ''}`).join(', ')
  );
}

/** « encore 12 caractères » sous un livre fermé ; rien quand on ne sait pas le compter. */
export function resteALire(e: Pick<EntreeConte, 'reste'>): string {
  if (e.reste <= 0) return '';
  return e.reste === 1 ? 'encore un caractère' : `encore ${e.reste} caractères`;
}
