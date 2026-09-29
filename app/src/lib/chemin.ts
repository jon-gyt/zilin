/**
 * Mon chemin 路 : la disposition de la scène, le chemin parcouru et ses auberges, et le
 * sentier d'une famille. Décisions du propriétaire du 29 septembre 2026 : « Ma forêt »
 * devient « Mon chemin », et toute l'image change (« C'était plutôt chemin A », « Tout est
 * ok pour moi ») ; maquette validée `maquettes/chemin.html`, variante A.
 *
 * Un seul dessin vertical. En haut, la route devant 前路 (`route.ts` : les pierres, les
 * rendez-vous, l'examen à passer) ; au milieu, la pierre du jour, en cinabre, et Tao ; en
 * descendant, le chemin parcouru, un pavé par jour du chemin jusqu'au jour 1. Chaque
 * famille ouverte tient son auberge 客栈 à la pierre du jour qui l'a ouverte : un toit, une
 * porte, le fanion 幌子 où sa racine est écrite, et son sentier, pavé de ses caractères, les
 * lus au jade, ceux en cours à l'indigo, « +N » pour ce qui y attend encore. Au-delà de cent
 * jours, le chemin parcouru se replie par tranches de trente jours.
 *
 * Module pur, comme `route.ts` et `foret.ts` : ni horloge, ni stockage, ni DOM. Les jours
 * sont des jours du chemin (les étapes que la session pose une à une), jamais des dates.
 * Les identifiants de la progression (`foret`, `joursTravailles`) ne changent pas : aucune
 * migration.
 */
import type { Famille, Noeud } from './content';
import { etat, noeudDeFamille, racinesDesCaracteres } from './foret';
import type { Etape, Route } from './route';
import { SEUIL_DEBLOCAGE, type ReviewCard } from './srs';

/* ---------- la géométrie de la scène ---------- */

/** La largeur du dessin, celle de la maquette : 361 unités pour un écran de 393 px. */
export const LARGEUR = 361;

/** La pierre du jour : au milieu, sous la route devant. */
export const X_JOUR = 180;
export const Y_JOUR = 348;
export const R_JOUR = 18;

/** Un pavé par jour parcouru, tous les 64 unités, en descendant. */
export const PAS_DERRIERE = 64;
export const R_DERRIERE = 15;

/** Sous le dernier pavé : de quoi écrire « jour 1 · la première session ». */
export const MARGE_BAS = 56;

/**
 * Les six pierres de la route devant, de la plus proche (demain) à la plus lointaine : la
 * route monte en lacets et rétrécit dans la brume. Les places de la maquette.
 */
export const DEVANT: readonly { x: number; y: number; r: number }[] = [
  { x: 140, y: 292, r: 14 },
  { x: 118, y: 244, r: 13 },
  { x: 160, y: 200, r: 12 },
  { x: 214, y: 158, r: 11 },
  { x: 236, y: 116, r: 10 },
  { x: 196, y: 76, r: 9 }
];

/** Où la route devant se perd, dans la brume, au-delà de la dernière pierre. */
export const BRUME = { x: 186, y: 44 };

/**
 * Les deux rendez-vous au loin, dans la brume : à gauche en haut, à droite plus bas. La
 * porte de ville d'un examen, la lanterne d'un seuil, l'étal de livres d'un conte.
 */
export const RENDEZ_VOUS: readonly { x: number; y: number }[] = [
  { x: 72, y: 34 },
  { x: 314, y: 140 }
];

/** L'examen à passer : sa porte s'ouvre sur la route, juste devant la pierre du jour. */
export const PORTE_OUVERTE = { x: 254, y: 262 };

/* ---------- le chemin parcouru, replié au-delà de cent jours ---------- */

/** Au-delà de cent jours parcourus, le chemin se replie… */
export const REPLI_DES = 100;
/** … par tranches de trente jours, les plus anciennes d'abord. */
export const TRANCHE = 30;

/**
 * Les tranches repliées, en rangs dans le chemin parcouru (0 : le jour 1), de la plus
 * ancienne à la plus récente. Jamais plus de cent pavés dépliés : chaque tranche compte
 * trente jours, et la plus récente partie du chemin reste ouverte.
 */
export function tranchesRepliees(n: number): { de: number; a: number }[] {
  if (n <= REPLI_DES) return [];
  const k = Math.ceil((n - REPLI_DES) / TRANCHE);
  return Array.from({ length: k }, (_, i) => ({ de: i * TRANCHE, a: i * TRANCHE + TRANCHE - 1 }));
}

/* ---------- les auberges des familles ---------- */

/** L'état d'un caractère sur le chemin : lu (jade), en cours (indigo), à venir (pointillé). */
export type EtatPave = 'lu' | 'encours' | 'avenir';

export function etatPave(a: number): EtatPave {
  const e = etat(a);
  return e === 'acquis' ? 'lu' : e;
}

/** Un caractère du sentier d'une auberge. */
export type Membre = { c: string; etat: EtatPave };

/**
 * L'auberge d'une famille ouverte : sa racine sur le fanion, ses caractères commencés sur
 * le sentier (en cours d'abord, puis les lus), et combien d'autres y attendent. Le sceau
 * de la famille se pose sur le fanion quand elle est lue en entier (deux caractères au
 * moins, comme le trophée).
 */
export type Auberge = {
  racine: string;
  pinyin: string;
  fr: string;
  /** Le jour du chemin qui l'a ouverte : sa pierre. */
  jour: number;
  membres: Membre[];
  /** Les caractères de la famille, racine comprise, et ceux qu'on lit. */
  total: number;
  lus: number;
  sceau: boolean;
};

/**
 * Les auberges du chemin, par jour du chemin : chaque famille dont un caractère, en plus de
 * sa brique, est commencé (maquette : « à la pierre d'une brique qui a des caractères lus
 * s'ouvre une auberge »), posée à la première étape qui la touche, brique ou composé. Une famille qu'aucune étape ne touche n'a pas
 * d'auberge : la liste des familles la garde.
 */
export function aubergesDuChemin(
  etapes: readonly Etape[],
  familles: readonly Famille[],
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): Map<number, Auberge[]> {
  const racines = racinesDesCaracteres(familles);
  const parRacine = new Map(familles.map((f) => [f.racine.c, f]));
  const avecCarte = new Set(cartes.map((k) => k.id));
  const vues = new Set<string>();
  const out = new Map<number, Auberge[]>();
  for (const e of etapes) {
    for (const c of [e.brique, ...e.ouvre]) {
      const r = racines.get(c);
      if (r === undefined || vues.has(r)) continue;
      vues.add(r);
      const f = parRacine.get(r);
      /* une auberge s'ouvre quand un caractère de la famille, en plus de sa brique, est commencé */
      if (f === undefined || !f.fiches.some((x) => x.c !== r && avecCarte.has(x.c))) continue;
      const a = auberge(f, e.jour, cartes, seuil);
      out.set(e.jour, [...(out.get(e.jour) ?? []), a]);
    }
  }
  return out;
}

/** L'auberge d'une famille : son sentier, ses comptes, son sceau. */
export function auberge(f: Famille, jour: number, cartes: readonly ReviewCard[], seuil: number = SEUIL_DEBLOCAGE): Auberge {
  const n = noeudDeFamille(f, cartes, seuil);
  const membres = n.membres.map((k) => ({ c: k.c, etat: etatPave(k.avancement) }));
  const commences = [
    ...membres.filter((m) => m.etat === 'encours'),
    ...membres.filter((m) => m.etat === 'lu')
  ];
  const lus = [n, ...n.membres].filter((k) => etat(k.avancement) === 'acquis').length;
  const total = 1 + n.membres.length;
  return {
    racine: n.c,
    pinyin: n.pinyin,
    fr: n.fr,
    jour,
    membres: commences,
    total,
    lus,
    sceau: total >= 2 && lus === total
  };
}

/* ---------- la scène ---------- */

/** Une pierre posée dans la scène : sa place et son rayon. */
export type Place = { x: number; y: number; r: number };

/** Un jour parcouru : sa pierre, et les auberges qui s'y ouvrent. */
export type PaveDerriere = { genre: 'pave'; etape: Etape; place: Place; auberges: Auberge[] };

/** Une tranche repliée : trente jours en une rangée, qui se déplie au toucher. */
export type Repli = { genre: 'repli'; rang: number; de: number; a: number; place: Place; auberges: number };

/** Le sentier d'une auberge dans la scène : où elle se tient, ses pavés, et son « +N ». */
export type SentierPose = {
  x: number;
  y: number;
  membres: (Membre & { x: number; y: number })[];
  plus: { n: number; x: number; y: number } | null;
  /** Le tracé du sentier, de la pierre du jour à son dernier pavé. */
  d: string;
};

export type Scene = {
  largeur: number;
  hauteur: number;
  /** Les pierres devant, par écart (1 : demain). */
  devant: Map<number, Place>;
  jour: Place;
  derriere: (PaveDerriere | Repli)[];
  /** La route devant, de la brume à la pierre du jour ; le chemin parcouru, de là au jour 1. */
  routeDevant: string;
  routeDerriere: string;
};

/** Deux décimales : le même dessin à chaque appel. */
function d1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Une courbe douce par des points (Catmull-Rom en Bézier), comme dans la maquette. */
export function lisse(pts: readonly { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  let d = `M${d1(pts[0].x)} ${d1(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${d1(c1.x)} ${d1(c1.y)} ${d1(c2.x)} ${d1(c2.y)} ${d1(p2.x)} ${d1(p2.y)}`;
  }
  return d;
}

/** La place du `k`e pavé sous la pierre du jour : le chemin serpente doucement. */
export function placeDerriere(k: number): Place {
  return { x: Math.round(100 + 22 * Math.sin(k * 0.95 + 0.6)), y: Y_JOUR + k * PAS_DERRIERE + 20, r: R_DERRIERE };
}

/**
 * Pose la scène : les pierres devant (seulement si la route devant est ouverte, sinon le
 * haut du chemin est dans la brume), la pierre du jour, puis chaque jour parcouru, du plus
 * récent au jour 1, les tranches repliées comprises. `ouvertes` : les rangs des tranches
 * que l'on a dépliées.
 */
export function placerChemin(
  r: Route,
  etapes: readonly Etape[],
  auberges: ReadonlyMap<number, Auberge[]>,
  devant: boolean,
  ouvertes: ReadonlySet<number> = new Set()
): Scene {
  const jour: Place = { x: X_JOUR, y: Y_JOUR, r: R_JOUR };
  const places = new Map<number, Place>();
  if (devant) {
    for (const x of r.pierres) if (x.ecart >= 1 && x.ecart <= DEVANT.length) places.set(x.ecart, DEVANT[x.ecart - 1]);
  }
  /* Le chemin parcouru : les étapes avant celle du jour, la plus récente d'abord. */
  const parcourues = r.rang < 0 ? [] : etapes.slice(0, r.rang);
  const replis = tranchesRepliees(parcourues.length).filter((t) => !ouvertes.has(t.de));
  const derriere: (PaveDerriere | Repli)[] = [];
  /* Deux familles ouvertes aujourd'hui : la seconde auberge prend la rangée d'en dessous. */
  let k = Math.max(0, (r.jour === null ? 0 : (auberges.get(r.jour.jour)?.length ?? 0)) - 1);
  for (let i = parcourues.length - 1; i >= 0; i--) {
    const t = replis.find((x) => x.de <= i && i <= x.a);
    if (t !== undefined) {
      k += 1;
      const dedans = parcourues.slice(t.de, t.a + 1);
      derriere.push({
        genre: 'repli',
        rang: t.de,
        de: dedans[0].jour,
        a: dedans[dedans.length - 1].jour,
        place: placeDerriere(k),
        auberges: dedans.reduce((s, e) => s + (auberges.get(e.jour)?.length ?? 0), 0)
      });
      i = t.de;
      continue;
    }
    k += 1;
    const e = parcourues[i];
    const ici = auberges.get(e.jour) ?? [];
    derriere.push({ genre: 'pave', etape: e, place: placeDerriere(k), auberges: ici });
    /* Deux familles ouvertes le même jour : la seconde auberge prend la rangée d'en dessous. */
    k += Math.max(0, ici.length - 1);
  }
  const dernier = { y: placeDerriere(k).y };
  const pierresDevant = [...places.entries()].sort((a, b) => b[0] - a[0]).map(([, q]) => q);
  const routeDevant = lisse([...(devant && !r.bout ? [BRUME] : []), ...pierresDevant, jour]);
  const routeDerriere = lisse([jour, ...derriere.map((x) => x.place)]);
  return {
    largeur: LARGEUR,
    hauteur: Math.max(Y_JOUR + 80, dernier.y + MARGE_BAS),
    devant: places,
    jour,
    derriere,
    routeDevant: pierresDevant.length === 0 && !devant ? lisse([{ x: 186, y: 24 }, { x: 150, y: 180 }, jour]) : routeDevant,
    routeDerriere
  };
}

/** Le pas entre deux pavés d'un sentier d'auberge. */
export const PAS_SENTIER = 30;
export const R_SENTIER = 11;

/**
 * Le sentier d'une auberge, à côté de sa pierre : l'auberge à 60 unités, puis ses pavés à
 * plat, autant que la largeur en tient ; « +N » compte ce qui n'y tient pas et ce qui
 * attend encore. Rien ne sort du dessin.
 */
export function placerSentier(pierre: Place, a: Auberge, decalage = 0): SentierPose {
  const x = pierre.x + 60;
  const y = pierre.y + 2 + decalage;
  const depart = x + 60;
  const places = Math.max(1, Math.floor((LARGEUR - 16 - depart) / PAS_SENTIER) + 1);
  const reste = a.total - 1 - a.membres.length;
  const tiennent = a.membres.length + (reste > 0 ? 1 : 0) <= places ? a.membres.length : places - 1;
  const montres = a.membres.slice(0, Math.max(0, tiennent));
  const n = a.total - 1 - montres.length;
  const membres = montres.map((m, k) => ({ ...m, x: depart + k * PAS_SENTIER, y: y + 2 }));
  const plus = n > 0 ? { n, x: depart + montres.length * PAS_SENTIER, y: y + 2 } : null;
  const bout = plus?.x ?? membres[membres.length - 1]?.x ?? x;
  return {
    x,
    y,
    membres,
    plus,
    d: `M${pierre.x + 18} ${y + 1}Q${x - 22} ${y + 8} ${x} ${y + 4}L${bout} ${y + 2}`
  };
}

/* ---------- le sentier d'une famille ouverte ---------- */

/** Au plus dix caractères sur le sentier d'une famille ; « +N » déplie le reste. */
export const SENTIER_MAX = 10;
export const FAMILLE_L = 361;
export const FAMILLE_PAS = 42;

/** Un caractère posé sur le sentier de la famille, ou sur une bifurcation. */
export type PaveFamille = {
  c: string;
  x: number;
  y: number;
  r: number;
  etat: EtatPave;
  generation: 1 | 2;
  /** Pour une bifurcation : le caractère d'où elle part (« par 是 »). */
  par?: string;
};

export type SentierFamille = {
  largeur: number;
  hauteur: number;
  auberge: { x: number; y: number };
  paves: PaveFamille[];
  /** Le tracé du sentier, de l'auberge au dernier pavé, et celui des bifurcations. */
  d: string;
  bifurcations: string[];
  plus: { n: number; x: number; y: number } | null;
};

/**
 * Le sentier d'une famille : il part de l'auberge, en bas à gauche, et monte en lacets,
 * pavé de ses caractères dans l'ordre de la famille ; une génération de plus bifurque du
 * caractère qu'elle contient. Au-delà de `SENTIER_MAX`, un « +N » (déplié avec `tout`).
 */
export function placerSentierFamille(fam: Noeud, tout = false): SentierFamille {
  const membres = tout ? fam.membres : fam.membres.slice(0, SENTIER_MAX);
  const cache = fam.membres.length - membres.length;
  const n = membres.length + (cache > 0 ? 1 : 0);
  const hauteur = Math.max(300, 110 + n * FAMILLE_PAS);
  const bas = hauteur - 38;
  const auberge = { x: 44, y: hauteur - 14 };
  const pts = Array.from({ length: n }, (_, k) => ({
    x: Math.round(190 + 72 * Math.sin(k * 0.8 - 0.75)),
    y: bas - 36 - k * FAMILLE_PAS
  }));
  const paves: PaveFamille[] = [];
  const bifurcations: string[] = [];
  membres.forEach((m, k) => {
    const q = pts[k];
    paves.push({ c: m.c, x: q.x, y: q.y, r: 16, etat: etatPave(m.avancement), generation: 1 });
    m.membres.forEach((g, j) => {
      const cote = q.x < FAMILLE_L / 2 ? 1 : -1;
      const x = q.x + cote * (62 + j * 36);
      const y = q.y + 24;
      bifurcations.push(`M${q.x} ${q.y}Q${d1((q.x + x) / 2)} ${q.y + 4} ${x} ${y}`);
      paves.push({ c: g.c, x, y, r: 14, etat: etatPave(g.avancement), generation: 2, par: j === 0 ? m.c : undefined });
    });
  });
  const plus = cache > 0 ? { n: cache, x: pts[n - 1].x, y: pts[n - 1].y } : null;
  return {
    largeur: FAMILLE_L,
    hauteur,
    auberge,
    paves,
    d: lisse([{ x: auberge.x + 30, y: bas + 10 }, ...pts]),
    bifurcations,
    plus
  };
}

/** « 5 / 13 » : les caractères lus d'une famille, racine comprise, sur tous. */
export function lusDeLaFamille(fam: Noeud): { lus: number; total: number } {
  const tous: Noeud[] = [];
  const parcourir = (k: Noeud): void => {
    tous.push(k);
    k.membres.forEach(parcourir);
  };
  parcourir(fam);
  return { lus: tous.filter((k) => etat(k.avancement) === 'acquis').length, total: tous.length };
}

/** Le jour du chemin où chaque caractère entre, brique ou composé : « posé au jour 5 ». */
export function joursDesCaracteres(etapes: readonly Etape[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of etapes) for (const c of [e.brique, ...e.ouvre]) if (!out.has(c)) out.set(c, e.jour);
  return out;
}
