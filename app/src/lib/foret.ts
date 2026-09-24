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
import type { Famille, Foret, Index, Noeud } from './content';
import type { Progress } from './session';
import { SEUIL_DEBLOCAGE, stability, type ReviewCard } from './srs';

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

/**
 * Deux niveaux, et deux seulement : les briques autour du 字, puis les caractères qui
 * les contiennent. Ce qu'une famille garde au-delà (le lointain à venir, la génération
 * suivante) tient dans un seul badge « +N », qui ouvre son arbre.
 *
 * Les briques se posent sur le premier anneau ; quand deux voisines se toucheraient,
 * la seconde recule sur le deuxième, en quinconce. Les caractères se posent au-delà,
 * rang par rang, en quinconce eux aussi.
 */
export const R_BRIQUES = [106, 154] as const;
export const RANGS = [172, 215, 258, 301] as const;

/** Les anneaux dessinés : celui des briques, celui des caractères. */
export const ANNEAUX = [R_BRIQUES[0], RANGS[0]] as const;

/** Le jeu laissé entre deux secteurs, en radians. */
export const ECART = 0.012;

/** Rayon du centre, et rayon d'un caractère (le badge a la même taille). */
export const R_CENTRE = 38;
export const R_MEMBRE = 18;

/** La racine d'une famille : son rayon suit la taille de la famille. */
export const R_RACINE_MIN = 21;
export const R_RACINE_MAX = 26;

/**
 * Le jeu minimal entre deux disques, en unités du dessin (environ 3 px sur un écran de
 * 393 px) : aucun nœud n'en touche un autre, jamais.
 */
export const MARGE = 6;

/** Le plus petit secteur, en radians : une brique y tient, en quinconce avec ses voisines. */
export const SECTEUR_MIN = 0.3;

/**
 * Ce que le cercle nomme : au plus huit caractères par famille, cinquante-six en tout,
 * briques comprises. Le reste se compte dans le badge.
 */
export const MEMBRES_NOMMES = 8;
export const NOMMES_MAX = 56;

/** Le proche à venir : ce que les sept prochains jours du parcours vont poser. */
export const JOURS_PROCHES = 7;

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

/** Le badge d'une famille : ce qu'elle compte de plus que ce que le cercle nomme. */
export type BadgePose = { famille: number; n: number; x: number; y: number; r: number };

/** Un lien ; celui qui mène au badge se pointille : il mène à ce qui attend. */
export type LienPose = { d: string; acquis: boolean; badge?: boolean };

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
  badges: BadgePose[];
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
  const grand = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} A ${r1} ${r1} 0 ${grand} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r0} ${r0} 0 ${grand} 0 ${p0.x} ${p0.y} Z`;
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

type Disque = { x: number; y: number; r: number };

/** Un disque est libre quand il garde la marge avec chacun des disques déjà posés. */
function libre(p: Disque, poses: readonly Disque[]): boolean {
  return poses.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= p.r + q.r + MARGE);
}

/**
 * Le pas angulaire d'un rang : deux voisins y sont à une corde de 2r + marge. Un
 * dixième d'unité de plus absorbe l'arrondi des positions au centième.
 */
function pas(rayon: number): number {
  return 2 * Math.asin((2 * R_MEMBRE + MARGE + 0.1) / (2 * rayon));
}

/** Tous les caractères d'une famille, racine comprise, toutes générations confondues. */
function taille(n: Noeud): number {
  return 1 + n.membres.reduce((s, k) => s + taille(k), 0);
}

/**
 * Ce que le cercle nomme d'une famille : l'en-cours d'abord, puis le proche à venir,
 * puis l'acquis. Le lointain à venir ne se nomme pas : il se compte.
 */
function classe(k: Noeud, proches: ReadonlySet<string>): number {
  const e = etat(k.avancement);
  if (e === 'encours') return 0;
  if (e === 'avenir') return proches.has(k.c) ? 1 : -1;
  return 2;
}

/**
 * Les caractères nommés de chaque famille, sous un budget commun : on prend le premier
 * de chaque famille, puis le deuxième, et ainsi de suite, pour qu'une grande famille ne
 * prenne pas toute la place. Chaque liste revient dans l'ordre de la famille.
 */
function nommes(familles: readonly Noeud[], proches: ReadonlySet<string>): Noeud[][] {
  const listes = familles.map((f) =>
    f.membres
      .map((k, i) => ({ k, i, c: classe(k, proches) }))
      .filter((x) => x.c >= 0)
      .sort((a, b) => a.c - b.c || a.i - b.i)
      .slice(0, MEMBRES_NOMMES)
  );
  const pris = familles.map(() => [] as { k: Noeud; i: number }[]);
  let reste = NOMMES_MAX - familles.length;
  for (let r = 0; r < MEMBRES_NOMMES && reste > 0; r++) {
    for (let i = 0; i < listes.length && reste > 0; i++) {
      const x = listes[i][r];
      if (x === undefined) continue;
      pris[i].push(x);
      reste--;
    }
  }
  return pris.map((p) => p.sort((a, b) => a.i - b.i).map((x) => x.k));
}

/**
 * Les angles des secteurs : chaque famille a au moins `SECTEUR_MIN`, le reste du tour se
 * partage selon ce qu'elle pose (ses caractères nommés, et son badge).
 */
function angles(poids: readonly number[]): number[] {
  const n = poids.length;
  if (n === 0) return [];
  const min = Math.min(SECTEUR_MIN, (2 * Math.PI) / n);
  const total = poids.reduce((s, w) => s + w, 0);
  const libreTour = 2 * Math.PI - n * min;
  return poids.map((w) => min + (total > 0 ? (libreTour * w) / total : libreTour / n));
}

type Place = { rang: number; a: number; x: number; y: number };

/**
 * Les places d'un rang dans un secteur, sur l'une des deux trames du quinconce : la
 * trame paire passe par le milieu du secteur, l'impaire s'en écarte d'un demi-pas. On
 * garde un demi-pas de chaque bord : deux secteurs voisins ne se touchent pas.
 */
function trame(rang: number, a0: number, a1: number, impaire: boolean): Place[] {
  const R = RANGS[rang];
  const d = pas(R);
  const am = (a0 + a1) / 2;
  const demi = (a1 - a0 - d) / 2 + 1e-9;
  const out: Place[] = [];
  if (demi < 0) {
    if (!impaire) out.push({ rang, a: am, ...pt(R, am) });
    return out;
  }
  const t = Math.ceil(demi / d) + 1;
  for (let j = -t; j <= t; j++) {
    const o = (j + (impaire ? 0.5 : 0)) * d;
    if (Math.abs(o) <= demi) out.push({ rang, a: am + o, ...pt(R, am + o) });
  }
  /* Du milieu vers les bords : les premières places prises encadrent la racine. */
  return out.sort((p, q) => Math.abs(p.a - am) - Math.abs(q.a - am) || p.a - q.a);
}

/**
 * Les places de `m` nœuds dans un secteur : on remplit les rangs de l'intérieur vers
 * l'extérieur, et sur chaque rang on choisit la trame qui centre le groupe (impaire pour
 * un nombre pair). Chaque place est vérifiée contre tout ce qui est déjà posé.
 */
function placesDuSecteur(m: number, a0: number, a1: number, poses: Disque[]): Place[] {
  const prises: Place[] = [];
  for (let rang = 0; rang < RANGS.length && prises.length < m; rang++) {
    const ok = (p: Place) => libre({ x: p.x, y: p.y, r: R_MEMBRE }, poses);
    const paire = trame(rang, a0, a1, false).filter(ok);
    const impaire = trame(rang, a0, a1, true).filter(ok);
    const voulu = Math.min(m - prises.length, Math.max(paire.length, impaire.length));
    if (voulu === 0) continue;
    const pref = voulu % 2 === 0 ? impaire : paire;
    const autre = pref === impaire ? paire : impaire;
    const choisie = pref.length >= voulu ? pref : autre;
    for (const p of choisie.slice(0, voulu)) {
      prises.push(p);
      poses.push({ x: p.x, y: p.y, r: R_MEMBRE });
    }
  }
  return prises;
}

/** Les options du cercle : le proche à venir, que le parcours nomme. */
export type ForetDuCercle = Foret & {
  /** Les caractères que les `JOURS_PROCHES` prochains jours du parcours vont poser. */
  proches?: readonly string[];
};

/**
 * Pose le cercle : un secteur par famille, à la mesure de ce qu'elle pose ; sa brique
 * sur le premier anneau (ou le deuxième, en quinconce) ; les caractères nommés au-delà ;
 * un badge « +N » pour le reste.
 *
 * Aucun disque n'en touche un autre : chaque place est vérifiée contre tout ce qui est
 * déjà posé, avec `MARGE` de jeu. Fonction pure et déterministe : mêmes données, même
 * dessin, au centième près.
 */
export function placerCercle(f: ForetDuCercle): Cercle {
  const familles = f.familles;
  const proches = new Set(f.proches ?? []);
  const tailles = familles.map((x) => x.membres.length);
  const max = tailles.length > 0 ? Math.max(...tailles) : 0;
  const min = tailles.length > 0 ? Math.min(...tailles) : 0;
  /*
   * Une seule famille porte le cinabre : la famille du moment, celle de la brique du
   * jour, quand la forêt la nomme ; à défaut, la première en cours dans l'ordre du cercle.
   */
  const duMoment = f.moment === undefined ? -1 : familles.findIndex((x) => x.c === f.moment);
  const enCours =
    duMoment >= 0 ? duMoment : familles.findIndex((x) => etat(x.avancement) === 'encours');

  const choisis = nommes(familles, proches);
  const caches = familles.map((fam, i) => taille(fam) - 1 - choisis[i].length);
  const parts = angles(choisis.map((c, i) => c.length + (caches[i] > 0 ? 1 : 0)));

  const secteurs: SecteurPose[] = [];
  const liens: LienPose[] = [];
  const noeuds: NoeudPose[] = [];
  const badges: BadgePose[] = [];
  const centre = { x: CX, y: CY };
  const poses: Disque[] = [{ x: CX, y: CY, r: R_CENTRE }];

  /* Les bornes des secteurs, depuis midi, dans le sens des aiguilles. */
  const bornes: [number, number][] = [];
  let debut = -Math.PI / 2;
  for (const part of parts) {
    bornes.push([debut + ECART, debut + part - ECART]);
    debut += part;
  }

  /* Les briques d'abord : chacune sur le premier anneau, ou sur le deuxième si besoin. */
  const racines = familles.map((fam, i) => {
    const [a0, a1] = bornes[i];
    const a = (a0 + a1) / 2;
    const r = rayonRacine(fam.membres.length, max, min);
    let p = { ...pt(R_BRIQUES[0], a), r };
    for (const R of R_BRIQUES) {
      p = { ...pt(R, a), r };
      if (libre(p, poses)) break;
    }
    poses.push(p);
    return p;
  });

  familles.forEach((fam, i) => {
    const [a0, a1] = bornes[i];
    const etatFam = etat(fam.avancement);
    const ouverte = fam.avancement > 0;
    const p = racines[i];
    secteurs.push({ famille: i, c: fam.c, d: arc(46, 316, a0, a1), etat: etatFam });
    liens.push(lien(centre, p, ouverte));

    /* Les caractères nommés, puis le badge : ils prennent les places dans l'ordre de lecture. */
    let montres = choisis[i];
    const voulu = montres.length + (caches[i] > 0 ? 1 : 0);
    const places = placesDuSecteur(voulu, a0, a1, poses).sort((u, v) => u.rang - v.rang || u.a - v.a);
    if (places.length < voulu) montres = montres.slice(0, Math.max(0, places.length - 1));
    const reste = taille(fam) - 1 - montres.length;

    montres.forEach((k, j) => {
      const kp = places[j];
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
    });
    const bp = places[montres.length];
    if (reste > 0 && bp !== undefined) {
      liens.push({ ...lien(p, bp, false), badge: true });
      badges.push({ famille: i, n: reste, x: bp.x, y: bp.y, r: R_MEMBRE });
    }

    noeuds.push({
      c: fam.c,
      x: p.x,
      y: p.y,
      r: p.r,
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
    noeuds,
    badges
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

/**
 * Combien de membres tiennent sur un rang, et de combien les rangs se succèdent.
 * Les familles de l'export vont jusqu'à dix-sept membres (口) : au-delà d'un rang,
 * les caractères se chevaucheraient, alors on passe à la ligne.
 */
export const ARBRE_PAR_RANG = 9;
export const ARBRE_RANG_H = 78;
export const ARBRE_Y1 = 190;

/** Pose l'arbre d'une famille : la racine en haut, ses générations en dessous. */
export function placerArbre(fam: Noeud): Arbre {
  const n = fam.membres.length;
  const rangs = Math.max(1, Math.ceil(n / ARBRE_PAR_RANG));
  const parRang = Math.ceil(n / rangs);
  const ecart = Math.min(88, parRang > 0 ? 440 / parRang : 88);
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
  let basse = ARBRE_Y1;
  fam.membres.forEach((k, j) => {
    const rang = Math.floor(j / parRang);
    /* Le dernier rang peut être plus court : il reste centré comme les autres. */
    const dansLeRang = Math.min(parRang, n - rang * parRang);
    const place = j - rang * parRang;
    const x = d2(260 + (place - (dansLeRang - 1) / 2) * ecart);
    const y = ARBRE_Y1 + rang * ARBRE_RANG_H;
    basse = Math.max(basse, y);
    liens.push(courbe(260, 60 + ARBRE_R0, x, y - ARBRE_R1, k.avancement > 0));
    noeuds.push({
      c: k.c,
      x,
      y,
      r: ARBRE_R1,
      etat: etat(k.avancement),
      generation: 1,
      verrouille: !ouverte && k.avancement <= 0
    });
    k.membres.forEach((g) => {
      const gy = y + 120;
      basse = Math.max(basse, gy);
      liens.push(courbe(x, y + ARBRE_R1, x, gy - ARBRE_R2, g.avancement >= 1));
      noeuds.push({
        c: g.c,
        x,
        y: gy,
        r: ARBRE_R2,
        etat: etat(g.avancement),
        generation: 2,
        verrouille: g.avancement <= 0
      });
    });
  });
  return {
    largeur: ARBRE_L,
    hauteur: Math.max(ARBRE_H, basse + ARBRE_R1 + 30),
    liens,
    noeuds
  };
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
 * Les journées travaillées de la progression : les graines plantées à la clôture
 * (`joursTravailles` de `session.ts`), qui sont la seule mémoire de la série. Ma forêt
 * et l'écran de série montrent ainsi les mêmes graines, aux mêmes journées.
 *
 * Une progression d'avant ce champ n'en a pas : on la relit alors de ce que Tao a vu
 * et de la dernière journée de session. Sans doublon, triées.
 */
export function joursTravailles(p: Progress): string[] {
  if (p.joursTravailles.length > 0) return [...new Set(p.joursTravailles)].sort();
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

/* ---------- le cercle, construit depuis l'index et les cartes ---------- */

/**
 * L'avancement ne se lit nulle part ailleurs que dans les cartes : acquis quand la
 * stabilité FSRS passe le seuil de déblocage de `srs.ts`, en cours dès qu'une carte
 * existe, à venir tant qu'il n'y en a pas. `avancement_possible` de l'index dit
 * seulement ce que le pipeline permet d'enseigner : ce n'est pas une progression.
 */
export const AVANCEMENT_ENCOURS = 0.5;

/** L'avancement d'un caractère, d'après les cartes de la progression. */
export function avancement(
  c: string,
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): number {
  const carte = cartes.find((x) => x.id === c);
  if (carte === undefined) return 0;
  return stability(carte) >= seuil ? 1 : AVANCEMENT_ENCOURS;
}

/**
 * Une famille de l'export en nœud du cercle : la racine, puis ses membres. L'export
 * range une famille à plat (une racine, ses caractères) : la deuxième génération du
 * cercle reste donc vide tant que le pipeline n'écrit pas la filiation.
 */
export function noeudDeFamille(
  f: Famille,
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): Noeud {
  const membres = f.fiches
    .filter((x) => x.c !== f.racine.c)
    .map((x) => ({
      c: x.c,
      pinyin: x.pinyin,
      fr: x.fr,
      avancement: avancement(x.c, cartes, seuil),
      membres: []
    }));
  return {
    c: f.racine.c,
    pinyin: f.racine.pinyin,
    fr: f.racine.fr,
    avancement: avancement(f.racine.c, cartes, seuil),
    membres
  };
}

/* ---------- les deux nombres de Ma forêt, lus sur la progression ---------- */

/** Les caractères d'une famille de l'export : la racine, puis chaque fiche. */
export function caracteresDe(f: Famille): string[] {
  return [f.racine.c, ...f.fiches.map((x) => x.c)];
}

/**
 * « Lus » : les caractères de l'export dont la carte est acquise, c'est-à-dire dont la
 * stabilité FSRS passe le seuil de déblocage de `srs.ts`. Chacun compte une fois, même
 * s'il paraissait dans deux familles.
 */
export function caracteresLus(
  familles: readonly Famille[],
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): number {
  const acquises = new Set(cartes.filter((k) => stability(k) >= seuil).map((k) => k.id));
  const lus = new Set<string>();
  for (const f of familles) for (const c of caracteresDe(f)) if (acquises.has(c)) lus.add(c);
  return lus.size;
}

/** « Familles ouvertes » : les familles de l'export dont au moins un caractère a une carte. */
export function famillesOuvertes(
  familles: readonly Famille[],
  cartes: readonly ReviewCard[]
): number {
  const avecCarte = new Set(cartes.map((k) => k.id));
  return familles.filter((f) => caracteresDe(f).some((c) => avecCarte.has(c))).length;
}

/**
 * La règle du cercle, et elle seule : avec 238 familles, on n'en pose sur le cercle que
 * celles qui parlent aujourd'hui.
 *
 * 1. les familles **ouvertes** : au moins un de leurs caractères porte une carte ;
 * 2. les familles **prochaines** : celles que les `FENETRE_JOURS` prochains jours du
 *    parcours touchent, brique et composés compris ;
 * 3. la famille du moment, toujours.
 *
 * Le tout est ramené à `FAMILLES_CERCLE` familles, pour que chaque brique garde sa
 * place sur l'anneau d'un iPhone : celles que le parcours touche au plus près du jour
 * courant, et les `FAMILLES_FOURNIES` ouvertes qui portent le plus de cartes (ce que la
 * forêt a fait pousser, même loin derrière). Puis tri par l'ordre du parcours. Les
 * autres restent atteignables par la recherche, sous le cercle.
 */
export const FENETRE_JOURS = JOURS_PROCHES;
export const FAMILLES_CERCLE = 16;
export const FAMILLES_FOURNIES = 4;

/** Le caractère au centre du cercle : 字, la deuxième moitié du nom de l'app. */
export const CENTRE = '字';

/** Ce qu'il faut pour poser le cercle : l'index, les familles lues, et les cartes. */
export type SourcesForet = {
  index: Index;
  familles: readonly Famille[];
  cartes: readonly ReviewCard[];
  /** Le parcours lu dans l'index (`lire` ou `hsk`). */
  nom: string;
  /** Le jour courant du parcours. */
  jour: number;
  seuil?: number;
  fenetre?: number;
  max?: number;
  /** La famille du moment : elle est toujours sur le cercle. */
  moment?: string | null;
};

/** La racine de chaque caractère, d'après les familles lues. */
export function racinesDesCaracteres(familles: readonly Famille[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of familles) {
    out.set(f.racine.c, f.racine.c);
    for (const x of f.fiches) out.set(x.c, f.racine.c);
  }
  return out;
}

/** Le premier jour du parcours où chaque famille est touchée. */
export function joursDesFamilles(
  index: Index,
  nom: string,
  racines: Map<string, string>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const j of index.parcours[nom]?.jours ?? []) {
    const cs = j.brique === null ? j.composes : [j.brique, ...j.composes];
    for (const c of cs) {
      const r = racines.get(c) ?? c;
      if (!out.has(r)) out.set(r, j.jour);
    }
  }
  return out;
}

/** Les racines posées sur le cercle, dans l'ordre du parcours. */
export function famillesDuCercle(s: SourcesForet): string[] {
  const fenetre = s.fenetre ?? FENETRE_JOURS;
  const max = s.max ?? FAMILLES_CERCLE;
  const racines = racinesDesCaracteres(s.familles);
  const premier = joursDesFamilles(s.index, s.nom, racines);
  const retenues = new Set<string>();
  /* L'écart au jour courant : le jour du parcours qui touche la famille au plus près. */
  const ecart = new Map<string, number>();

  /* Ouvertes : une carte quelque part dans la famille. */
  for (const carte of s.cartes) {
    const r = racines.get(carte.id);
    if (r !== undefined) retenues.add(r);
  }
  for (const j of s.index.parcours[s.nom]?.jours ?? []) {
    const cs = j.brique === null ? j.composes : [j.brique, ...j.composes];
    for (const c of cs) {
      const r = racines.get(c);
      if (r === undefined) continue;
      ecart.set(r, Math.min(ecart.get(r) ?? Number.MAX_SAFE_INTEGER, Math.abs(j.jour - s.jour)));
      /* Prochaines : ce que les jours à venir vont poser. */
      if (j.jour >= s.jour && j.jour < s.jour + fenetre) retenues.add(r);
    }
  }
  /* La famille du moment passe devant tout le reste. */
  const moment = s.moment ?? null;
  if (moment !== null && racines.has(moment)) {
    retenues.add(moment);
    ecart.set(moment, -1);
  }
  const loin = Number.MAX_SAFE_INTEGER;
  const parEcart = [...retenues].sort(
    (a, b) => (ecart.get(a) ?? loin) - (ecart.get(b) ?? loin) || (a < b ? -1 : 1)
  );
  /* Les familles les plus fournies en cartes : ce que la forêt a fait pousser. */
  const cartesParFamille = new Map<string, number>();
  for (const carte of s.cartes) {
    const r = racines.get(carte.id);
    if (r !== undefined) cartesParFamille.set(r, (cartesParFamille.get(r) ?? 0) + 1);
  }
  const fournies = [...cartesParFamille.keys()].sort(
    (a, b) =>
      (cartesParFamille.get(b) ?? 0) - (cartesParFamille.get(a) ?? 0) ||
      (premier.get(a) ?? loin) - (premier.get(b) ?? loin) ||
      (a < b ? -1 : 1)
  );
  const n = Math.max(0, max);
  const garde = new Set(parEcart.slice(0, Math.max(0, n - FAMILLES_FOURNIES)));
  for (const r of [...fournies, ...parEcart]) {
    if (garde.size >= n) break;
    garde.add(r);
  }
  return [...garde].sort(
    (a, b) => (premier.get(a) ?? loin) - (premier.get(b) ?? loin) || (a < b ? -1 : 1)
  );
}

/**
 * Le proche à venir : les caractères que les `jours` prochains jours du parcours vont
 * poser, aujourd'hui compris. Le cercle les nomme ; le lointain, il le compte.
 */
export function prochesDuParcours(
  index: Index,
  nom: string,
  jour: number,
  jours: number = JOURS_PROCHES
): string[] {
  const out = new Set<string>();
  for (const j of index.parcours[nom]?.jours ?? []) {
    if (j.jour < jour || j.jour >= jour + jours) continue;
    for (const c of j.brique === null ? j.composes : [j.brique, ...j.composes]) out.add(c);
  }
  return [...out];
}

/**
 * Le cercle des familles : les familles retenues, leur avancement lu sur les cartes, et
 * la famille du moment — celle de la brique du jour, la seule à porter le cinabre.
 */
export function construireForet(
  s: SourcesForet,
  moment: string | null = null
): ForetDuCercle & { proches: string[] } {
  const retenues = famillesDuCercle({ ...s, moment: s.moment ?? moment });
  const parRacine = new Map(s.familles.map((f) => [f.racine.c, f]));
  const familles = retenues
    .map((r) => parRacine.get(r))
    .filter((f): f is Famille => f !== undefined)
    .map((f) => noeudDeFamille(f, s.cartes, s.seuil));
  return {
    version: s.index.version,
    source: `index.json (${s.index.norme})`,
    norme: s.index.norme,
    centre: CENTRE,
    familles,
    moment: moment ?? undefined,
    proches: prochesDuParcours(s.index, s.nom, s.jour)
  };
}
