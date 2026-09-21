/**
 * Ma forêt : la disposition du cercle des familles, celle de l'arbre d'une famille,
 * et la semaine des graines.
 *
 * Tout ce module est pur : aucune fonction ne lit l'horloge, n'écrit dans un stockage
 * ni ne touche au DOM. La journée courante est toujours passée en argument (AAAA-MM-JJ)
 * et la disposition ne dépend que des données : deux appels donnent le même dessin.
 *
 * Port de `renderForest` et `renderTree` de `maquettes/zilin-maquette.html`.
 */
import type { Foret, Noeud } from './content';
import type { Progress } from './session';

/* ---------- les états ---------- */

/** Trois états, et trois seulement : acquis, en cours, à venir. */
export type Etat = 'acquis' | 'encours' | 'avenir';

/** L'état d'un nœud se lit sur son avancement, rien d'autre. */
export function etat(avancement: number): Etat {
  if (avancement >= 1) return 'acquis';
  return avancement > 0 ? 'encours' : 'avenir';
}

/* ---------- la géométrie du cercle ---------- */

/** Le carré du dessin, et son centre. Repris tel quel de la maquette. */
export const TAILLE = 640;
export const CX = 320;
export const CY = 320;

/** Les trois anneaux : les briques, les composés, la deuxième génération. */
export const ANNEAUX = [104, 196, 262] as const;

/** Le jeu laissé entre deux secteurs, en radians. */
export const ECART = 0.012;

/** Rayon du centre, et rayons des nœuds par génération. */
export const R_CENTRE = 38;
export const R_MEMBRE = 17;
export const R_PETIT = 14;

/** La racine d'une famille : son rayon suit la taille de la famille. */
export const R_RACINE_MIN = 20;
export const R_RACINE_MAX = 28;

export type Generation = 0 | 1 | 2;

/** Un nœud posé : sa place, sa taille, son état. */
export type NoeudPose = {
  c: string;
  x: number;
  y: number;
  r: number;
  etat: Etat;
  /** L'index de la famille dans le cercle : c'est ce qu'un tap renvoie. */
  famille: number;
  generation: Generation;
  /**
   * Le cinabre ne marque que la famille en cours, et rien d'autre : la racine de la
   * seule famille commencée. Un composé en cours porte l'indigo de la progression.
   */
  cinabre: boolean;
  /** Une famille pas encore ouverte : le trait se pointille. */
  verrouille: boolean;
};

export type LienPose = { d: string; acquis: boolean };

/** Le secteur d'une famille : la part de cercle qui lui revient. */
export type SecteurPose = { famille: number; c: string; d: string; etat: Etat };

export type Cercle = {
  taille: number;
  cx: number;
  cy: number;
  anneaux: readonly number[];
  centre: string;
  rCentre: number;
  secteurs: SecteurPose[];
  liens: LienPose[];
  noeuds: NoeudPose[];
};

/** Deux décimales suffisent : le dessin reste identique d'un appel à l'autre. */
function d2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pt(rad: number, a: number): { x: number; y: number } {
  return { x: d2(CX + rad * Math.cos(a)), y: d2(CY + rad * Math.sin(a)) };
}

/** Le secteur d'une famille, entre deux rayons et deux angles. */
function arc(r0: number, r1: number, a0: number, a1: number): string {
  const p0 = pt(r0, a0);
  const p1 = pt(r1, a0);
  const p2 = pt(r1, a1);
  const p3 = pt(r0, a1);
  return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r0} ${r0} 0 0 0 ${p0.x} ${p0.y} Z`;
}

/** Un lien : une courbe qui rentre légèrement vers le centre. */
function lien(a: { x: number; y: number }, b: { x: number; y: number }, acquis: boolean): LienPose {
  const qx = d2((a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * 0.18);
  const qy = d2((a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * 0.18);
  return { d: `M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x} ${b.y}`, acquis };
}

/** Le rayon d'une racine : la plus petite famille au minimum, la plus grande au maximum. */
export function rayonRacine(membres: number, max: number, min: number): number {
  if (max <= min) return R_RACINE_MIN;
  const t = (membres - min) / (max - min);
  return d2(R_RACINE_MIN + (R_RACINE_MAX - R_RACINE_MIN) * t);
}

/**
 * Pose le cercle : un secteur par famille, la racine sur le premier anneau, ses
 * composés sur le deuxième, la génération suivante sur le troisième.
 *
 * Fonction pure et déterministe : mêmes données, même dessin, au centième près.
 */
export function placerCercle(f: Foret): Cercle {
  const familles = f.familles;
  const n = familles.length;
  const secteur = n > 0 ? (2 * Math.PI) / n : 0;
  const tailles = familles.map((x) => x.membres.length);
  const max = tailles.length > 0 ? Math.max(...tailles) : 0;
  const min = tailles.length > 0 ? Math.min(...tailles) : 0;
  /* Une seule famille porte le cinabre : la première en cours dans l'ordre du cercle. */
  const enCours = familles.findIndex((x) => etat(x.avancement) === 'encours');

  const secteurs: SecteurPose[] = [];
  const liens: LienPose[] = [];
  const noeuds: NoeudPose[] = [];
  const centre = { x: CX, y: CY };

  familles.forEach((fam, i) => {
    const a0 = -Math.PI / 2 + i * secteur + ECART;
    const a1 = a0 + secteur - 2 * ECART;
    const a = (a0 + a1) / 2;
    const etatFam = etat(fam.avancement);
    const ouverte = fam.avancement > 0;
    secteurs.push({ famille: i, c: fam.c, d: arc(46, ANNEAUX[2] + 18, a0, a1), etat: etatFam });

    const p = pt(ANNEAUX[0], a);
    liens.push(lien(centre, p, ouverte));

    const m = fam.membres.length;
    fam.membres.forEach((k, j) => {
      const ka = m > 0 ? a0 + ((a1 - a0) * (j + 0.5)) / m : a;
      const kp = pt(ANNEAUX[1], ka);
      liens.push(lien(p, kp, k.avancement > 0));
      noeuds.push({
        c: k.c,
        x: kp.x,
        y: kp.y,
        r: R_MEMBRE,
        etat: etat(k.avancement),
        famille: i,
        generation: 1,
        cinabre: false,
        verrouille: !ouverte && k.avancement <= 0
      });
      k.membres.forEach((g) => {
        const gp = pt(ANNEAUX[2], ka);
        liens.push(lien(kp, gp, g.avancement >= 1));
        noeuds.push({
          c: g.c,
          x: gp.x,
          y: gp.y,
          r: R_PETIT,
          etat: etat(g.avancement),
          famille: i,
          generation: 2,
          cinabre: false,
          verrouille: g.avancement <= 0
        });
      });
    });

    noeuds.push({
      c: fam.c,
      x: p.x,
      y: p.y,
      r: rayonRacine(m, max, min),
      etat: etatFam,
      famille: i,
      generation: 0,
      cinabre: i === enCours,
      verrouille: !ouverte
    });
  });

  return {
    taille: TAILLE,
    cx: CX,
    cy: CY,
    anneaux: ANNEAUX,
    centre: f.centre,
    rCentre: R_CENTRE,
    secteurs,
    liens,
    noeuds
  };
}

/* ---------- l'arbre d'une famille ---------- */

export const ARBRE_L = 520;
export const ARBRE_H = 380;
export const ARBRE_R0 = 30;
export const ARBRE_R1 = 22;
export const ARBRE_R2 = 17;

export type NoeudArbre = {
  c: string;
  x: number;
  y: number;
  r: number;
  etat: Etat;
  generation: Generation;
  verrouille: boolean;
};

export type Arbre = {
  largeur: number;
  hauteur: number;
  liens: LienPose[];
  noeuds: NoeudArbre[];
};

/** Une courbe verticale, de la racine vers ses enfants. */
function courbe(x1: number, y1: number, x2: number, y2: number, acquis: boolean): LienPose {
  const m = (y1 + y2) / 2;
  return { d: `M ${d2(x1)} ${y1} C ${d2(x1)} ${m} ${d2(x2)} ${m} ${d2(x2)} ${y2}`, acquis };
}

/** Pose l'arbre d'une famille : la racine en haut, ses générations en dessous. */
export function placerArbre(fam: Noeud): Arbre {
  const n = fam.membres.length;
  const ecart = Math.min(88, n > 0 ? 440 / n : 88);
  const ouverte = fam.avancement > 0;
  const liens: LienPose[] = [];
  const noeuds: NoeudArbre[] = [
    {
      c: fam.c,
      x: 260,
      y: 60,
      r: ARBRE_R0,
      etat: etat(fam.avancement),
      generation: 0,
      verrouille: !ouverte
    }
  ];
  fam.membres.forEach((k, j) => {
    const x = d2(260 + (j - (n - 1) / 2) * ecart);
    liens.push(courbe(260, 60 + ARBRE_R0, x, 190 - ARBRE_R1, k.avancement > 0));
    noeuds.push({
      c: k.c,
      x,
      y: 190,
      r: ARBRE_R1,
      etat: etat(k.avancement),
      generation: 1,
      verrouille: !ouverte && k.avancement <= 0
    });
    k.membres.forEach((g) => {
      liens.push(courbe(x, 190 + ARBRE_R1, x, 310 - ARBRE_R2, g.avancement >= 1));
      noeuds.push({
        c: g.c,
        x,
        y: 310,
        r: ARBRE_R2,
        etat: etat(g.avancement),
        generation: 2,
        verrouille: g.avancement <= 0
      });
    });
  });
  return { largeur: ARBRE_L, hauteur: ARBRE_H, liens, noeuds };
}

/** La famille d'index `i`, `null` si le cercle ne la porte pas. */
export function famille(f: Foret, i: number): Noeud | null {
  return f.familles[i] ?? null;
}

/** Un nœud de la forêt par son caractère, racines et membres confondus. */
export function noeud(fam: Noeud, c: string): Noeud | null {
  if (fam.c === c) return fam;
  for (const k of fam.membres) {
    const trouve = noeud(k, c);
    if (trouve) return trouve;
  }
  return null;
}

/** Ce qu'une famille compte d'acquis : le numérateur de « 4 / 8 » sur l'arbre. */
export function acquis(fam: Noeud): number {
  return fam.membres.filter((k) => etat(k.avancement) === 'acquis').length;
}

/* ---------- la semaine des graines ---------- */

/** Une graine par jour travaillé, sept graines font un arbre. */
export const JOURS_SEMAINE = 7;

/** Les initiales des sept jours, du lundi au dimanche, comme sur la maquette. */
export const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

function epoque(dateISO: string): number {
  return Math.floor(Date.parse(`${dateISO}T00:00:00Z`) / 86400000);
}

/** Décale une date d'un nombre de journées civiles. */
export function decale(dateISO: string, n: number): string {
  return new Date(Date.parse(`${dateISO}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** Le jour de la semaine, 0 pour lundi. Le 1er janvier 1970 était un jeudi. */
export function jourSemaine(dateISO: string): number {
  return (((epoque(dateISO) + 3) % 7) + 7) % 7;
}

/** Le lundi de la semaine d'une date. */
export function lundi(dateISO: string): string {
  return decale(dateISO, -jourSemaine(dateISO));
}

/**
 * Les journées travaillées que la progression garde : les journées où Tao a vu
 * quelque chose, plus la dernière journée de session. Sans doublon, triées.
 */
export function joursTravailles(p: Progress): string[] {
  const jours = new Set(p.tao.activites.map((a) => a.jour));
  if (p.lastWorked) jours.add(p.lastWorked);
  return [...jours].sort();
}

/** Une case de la semaine : sa journée, son initiale, sa graine. */
export type Case = { jour: string; lettre: string; graine: boolean; aujourdhui: boolean };

/**
 * La semaine en cours, du lundi au dimanche. Une graine par journée travaillée.
 * Jamais de compteur de jours perdus : une journée sans graine ne dit rien de plus.
 */
export function semaine(p: Progress, aujourdhui: string): Case[] {
  const debut = lundi(aujourdhui);
  const travailles = new Set(joursTravailles(p));
  return LETTRES.map((lettre, i) => {
    const jour = decale(debut, i);
    return { jour, lettre, graine: travailles.has(jour), aujourdhui: jour === aujourdhui };
  });
}

/** Le compteur : les graines plantées cette semaine. */
export function graines(p: Progress, aujourdhui: string): number {
  return semaine(p, aujourdhui).filter((c) => c.graine).length;
}

/** Ce que la semaine dit, en une ligne. Un constat, jamais un reproche. */
export function ligneSemaine(n: number): string {
  if (n === 0) return `Aucune graine cette semaine. Sept graines font un arbre.`;
  if (n >= JOURS_SEMAINE) return `Sept graines : la semaine fait un arbre.`;
  return n === 1 ? `Une graine cette semaine.` : `${n} graines cette semaine.`;
}
