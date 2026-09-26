/**
 * 前路 « La route devant » : le bout de chemin proche, et rien de plus. Retour du
 * propriétaire du 26 septembre 2026 : « il manque une visibilité sur ce qui va être appris
 * au fur et à mesure », mais « pas besoin de tout voir, juste le détail de l'étape et une
 * vue partielle proche des prochaines étapes ». La carte entière du parcours est écartée.
 *
 * Module pur, comme `etageres.ts` : il ne lit ni l'horloge, ni un stockage, ni le contenu.
 * Les jours sont des jours du chemin, ceux du parcours de l'export que la session enseigne
 * un à un (`session.jourLecon`, `jourRencontre`), jamais des dates : une journée sautée ne
 * compte pas, rien ne s'estime. Ce qui ne se calcule pas ne s'affiche pas.
 *
 * - les pierres : deux derrière (lues), celle du jour (la position, seul cinabre de
 *   l'écran), six devant ; moins au début et à la fin du parcours ;
 * - les bornes : les deux prochaines, et jamais plus. Un seuil du trophée Lire (le jour du
 *   chemin où entre le Ne caractère) ou l'ouverture d'un conte (`etageres.ouvertures`, le
 *   jour où entre le dernier caractère qui lui manque) ;
 * - la carte de détail : l'étape choisie, demain par défaut.
 */
import type { IndexJour } from './content';
import { allDone, jourParcours, type Progress } from './session';
import { etatMenu } from './parcours';

/* ---------- les étapes ---------- */

/** Une étape du chemin : un jour que la session enseigne, sa brique et ce qu'elle ouvre. */
export type Etape = { jour: number; brique: string; ouvre: string[] };

/**
 * Les étapes du chemin, dans l'ordre. Un jour non réconcilié, ou vide, est sauté par la
 * session (`content.jourDuParcours`) : il n'est pas une étape, et ne compte jamais. Un jour
 * sans brique nouvelle prend son premier composé pour pierre.
 */
export function etapesDuChemin(jours: readonly IndexJour[]): Etape[] {
  const out: Etape[] = [];
  for (const j of jours) {
    if (j.non_reconcilie) continue;
    const cs = j.brique === null ? j.composes : [j.brique, ...j.composes];
    const [brique, ...ouvre] = cs;
    if (brique === undefined) continue;
    out.push({ jour: j.jour, brique, ouvre });
  }
  return out;
}

/* ---------- la position ---------- */

/**
 * Où en est l'apprenant, en jour du chemin : `jour`, l'étape du jour ; `faite`, sa leçon
 * est apprise ; `sur`, la suite est sûre (en rattrapage, aucune brique nouvelle n'entre
 * tant que la pile n'est pas redescendue : la suivante n'est pas « demain »).
 *
 * - la leçon apprise aujourd'hui (`jourAppris`), la session de plus comprise ;
 * - la journée faite sans leçon notée (le jour de la première session), ou le rattrapage :
 *   la dernière étape rencontrée ;
 * - sinon, celle que la session va poser.
 */
export type Position = { jour: number; faite: boolean; sur: boolean };

export function positionDuJour(p: Progress): Position {
  if (p.premiere) return { jour: 1, faite: false, sur: true };
  if (p.jourAppris !== undefined) return { jour: p.jourAppris, faite: true, sur: !p.catchup };
  if (p.catchup) return { jour: jourParcours(p) - 1, faite: true, sur: false };
  if (p.enPlus === null && allDone(p)) return { jour: jourParcours(p) - 1, faite: true, sur: true };
  return { jour: jourParcours(p), faite: false, sur: true };
}

/**
 * Le rang de l'étape du jour dans `etapes`, et si le parcours est au bout. Leçon faite :
 * la dernière étape jusqu'à ce jour ; à faire : la première à partir de ce jour (la
 * session saute les jours non réconciliés). Au-delà de la dernière étape, le parcours est
 * fini : la position reste sur la dernière pierre, lue.
 */
export function rangDuJour(
  etapes: readonly Etape[],
  pos: Position
): { i: number; lue: boolean; fin: boolean } {
  const dernier = etapes.length - 1;
  if (dernier < 0) return { i: -1, lue: false, fin: true };
  if (pos.faite) {
    let i = -1;
    etapes.forEach((e, k) => {
      if (e.jour <= pos.jour) i = k;
    });
    /* Rien encore d'appris : la première pierre, à faire. */
    return i < 0 ? { i: 0, lue: false, fin: false } : { i, lue: true, fin: i === dernier };
  }
  const i = etapes.findIndex((e) => e.jour >= pos.jour);
  /* Plus aucune étape à poser : le parcours est fini, la dernière pierre est lue. */
  return i < 0 ? { i: dernier, lue: true, fin: true } : { i, lue: false, fin: i === dernier };
}

/* ---------- les pierres ---------- */

/** Deux pierres derrière, six devant. */
export const DERRIERE = 2;
export const DEVANT = 6;

/** Une pierre : lue (jade), celle du jour (la position), à venir (au trait). */
export type EtatPierre = 'lue' | 'jour' | 'avenir';

/**
 * Une pierre de la route. `ecart` compte les étapes depuis celle du jour (−2 à 6) : c'est
 * le nombre de jours du chemin, pas de jours du calendrier.
 */
export type Pierre = Etape & { etat: EtatPierre; ecart: number };

export type Route = {
  /** De la plus ancienne à la plus lointaine. */
  pierres: Pierre[];
  position: Position;
  /** L'étape du jour, `null` sans parcours. */
  jour: Etape | null;
  /** La leçon du jour est apprise (ou le parcours fini) : la pierre du jour est lue. */
  faite: boolean;
  /** Le parcours est au bout : la pierre du jour est la dernière, aucune devant. */
  fin: boolean;
  /** La dernière pierre montrée est la dernière du parcours : la route s'y arrête. */
  bout: boolean;
  /** Le rang de l'étape du jour dans les étapes, `-1` sans parcours. */
  rang: number;
};

export function route(etapes: readonly Etape[], pos: Position): Route {
  const { i, lue: faite, fin } = rangDuJour(etapes, pos);
  if (i < 0) return { pierres: [], position: pos, jour: null, faite: false, fin: true, bout: true, rang: -1 };
  const debut = Math.max(0, i - DERRIERE);
  const bout = Math.min(etapes.length, i + DEVANT + 1);
  const pierres = etapes.slice(debut, bout).map((e, k): Pierre => {
    const ecart = debut + k - i;
    return { ...e, ecart, etat: ecart < 0 ? 'lue' : ecart === 0 ? 'jour' : 'avenir' };
  });
  return { pierres, position: pos, jour: etapes[i], faite, fin, bout: bout === etapes.length, rang: i };
}

/**
 * L'étape choisie par défaut : demain, la pierre qui suit celle du jour ; au bout du
 * parcours, celle du jour.
 */
export function choixParDefaut(r: Route): number | null {
  const demain = r.pierres.find((x) => x.ecart === 1);
  return demain?.jour ?? r.jour?.jour ?? null;
}

/* ---------- les bornes ---------- */

/** Au loin, dans la brume : les deux prochaines bornes, jamais plus. */
export const BORNES_MAX = 2;

/** Une borne : un seuil du trophée Lire, ou un conte qui s'ouvre. */
export type Borne =
  | { genre: 'lire'; jour: number; ecart: number; seuil: number; titre: string; ligne: string }
  | {
      genre: 'conte';
      jour: number;
      ecart: number;
      id: string;
      titre: string;
      ligne: string;
      motif: string | null;
    };

/** Un seuil du trophée Lire, et s'il est déjà obtenu. */
export type SeuilLire = { n: number; obtenu: boolean };

/** Un conte fermé, et le jour du chemin où il s'ouvre (`etageres.ouvertures`), ou `null`. */
export type ConteAVenir = { id: string; titre: string; jour: number | null; motif?: string | null };

/**
 * Le jour du chemin où le Ne caractère entre : l'étape où le compte des caractères
 * rencontrés, briques et composés, chacun une fois, atteint `n`. `null` si le chemin n'en
 * porte pas autant.
 */
export function jourDuSeuil(etapes: readonly Etape[], n: number): number | null {
  const vus = new Set<string>();
  for (const e of etapes) {
    for (const c of [e.brique, ...e.ouvre]) vus.add(c);
    if (vus.size >= n) return e.jour;
  }
  return null;
}

/**
 * Toutes les bornes encore devant, dans l'ordre du chemin : un seuil Lire pas encore
 * obtenu dont le caractère entre après la dernière étape faite ; un conte fermé qui
 * s'ouvre après elle. Un seuil dont les caractères sont déjà rencontrés mais pas encore
 * lus, ou un conte dont le jour ne se calcule pas, ne s'annonce pas : on ne l'estime pas.
 * `ecart` compte les étapes depuis celle du jour.
 */
export function bornesDevant(
  etapes: readonly Etape[],
  r: Route,
  seuils: readonly SeuilLire[],
  contes: readonly ConteAVenir[]
): Borne[] {
  if (r.rang < 0) return [];
  const rangDe = new Map(etapes.map((e, k) => [e.jour, k]));
  /* La dernière étape faite : celle du jour si sa leçon est apprise, sinon la veille. */
  const fait = r.faite ? r.rang : r.rang - 1;
  const devant = (jour: number | null): number | null => {
    if (jour === null) return null;
    const k = rangDe.get(jour);
    return k === undefined || k <= fait ? null : k - r.rang;
  };
  const out: Borne[] = [];
  for (const s of seuils) {
    if (s.obtenu) continue;
    const jour = jourDuSeuil(etapes, s.n);
    const ecart = devant(jour);
    if (jour === null || ecart === null) continue;
    out.push({
      genre: 'lire',
      jour,
      ecart,
      seuil: s.n,
      titre: `${s.n} caractères`,
      ligne: s.n === 255 ? 'le premier seuil' : 'trophée Lire'
    });
  }
  for (const c of contes) {
    const ecart = devant(c.jour);
    if (c.jour === null || ecart === null) continue;
    out.push({
      genre: 'conte',
      jour: c.jour,
      ecart,
      id: c.id,
      titre: c.titre,
      ligne: "un conte s'ouvre",
      motif: c.motif ?? null
    });
  }
  /* L'ordre du chemin ; le même jour, le trophée avant le conte. */
  return out.sort((a, b) => a.ecart - b.ecart || (a.genre === b.genre ? 0 : a.genre === 'lire' ? -1 : 1));
}

/** Les deux prochaines bornes, rien au-delà. */
export function prochainesBornes(bornes: readonly Borne[], max = BORNES_MAX): Borne[] {
  return bornes.slice(0, Math.max(0, max));
}

/* ---------- les mots ---------- */

/**
 * Quand, vu de l'étape du jour : « aujourd'hui », « demain », « dans 3 jours » (jours du
 * chemin), « déjà lu » derrière. En rattrapage, la suite n'est pas sûre : « l'étape
 * suivante », « dans 3 étapes ».
 */
export function quand(ecart: number, sur = true): string {
  if (ecart < 0) return 'déjà lu';
  if (ecart === 0) return "aujourd'hui";
  if (!sur) return ecart === 1 ? "l'étape suivante" : `dans ${ecart} étapes`;
  return ecart === 1 ? 'demain' : `dans ${ecart} jours`;
}

/** « dans 13 j » sous une stèle, en jours du chemin (en étapes en rattrapage). */
export function dansCourt(ecart: number, sur = true): string {
  if (ecart === 0) return "aujourd'hui";
  if (!sur) return ecart === 1 ? "l'étape suivante" : `dans ${ecart} étapes`;
  return ecart === 1 ? 'demain' : `dans ${ecart} j`;
}

/** Ce que l'étape fait des caractères qu'elle porte : déjà ouverts, aujourd'hui, à venir. */
export function verbeOuvre(ecart: number): string {
  return ecart < 0 ? 'a ouvert' : ecart === 0 ? "ouvre aujourd'hui" : 'ouvrira';
}

/** « N caractères lus · M / 300 du HSK 1 » : l'en-tête, sans liste HSK s'il n'y en a pas. */
export function ligneLus(lus: number, hsk1: { lus: number; total: number } | null): string {
  const t = `${lus} caractère${lus > 1 ? 's' : ''} lu${lus > 1 ? 's' : ''}`;
  return hsk1 === null || hsk1.total === 0 ? t : `${t} · ${hsk1.lus} / ${hsk1.total} du HSK 1`;
}

/**
 * La borne dans la carte de détail : celle de l'étape choisie (« Borne ce jour-là »), et,
 * quand l'étape est demain, la prochaine (« Prochaine borne : …, dans 13 jours »).
 */
export function ligneBorne(
  ecart: number,
  bornes: readonly Borne[],
  sur = true
): { tete: string; titre: string; suite: string } | null {
  const ce = bornes.find((b) => b.ecart === ecart);
  if (ce) return { tete: 'Borne ce jour-là :', titre: ce.titre, suite: `${ce.ligne}.` };
  if (ecart !== 1) return null;
  const suivante = bornes.find((b) => b.ecart > 0);
  if (!suivante) return null;
  return { tete: 'Prochaine borne :', titre: suivante.titre, suite: `${quand(suivante.ecart, sur)}.` };
}

/** Le premier sens d'une fiche : « enfant » pour « enfant, fils, suffixe de nom ». */
export function premierSens(fr: string): string {
  return (fr.split(/[,;，；]/)[0] ?? '').trim();
}

/* ---------- le menu ---------- */

/**
 * La ligne « Demain : 子 enfant » de la carte du jour : seulement la journée faite (ni
 * avant la session, ni pendant, ni en rattrapage, ni avant la première session). Rend le
 * jour du chemin à lire : la session suivante le pose, sauts compris (`content.lecon`).
 */
export function jourDeDemain(p: Progress): number | null {
  return etatMenu(p) === 'faite' ? jourParcours(p) : null;
}
