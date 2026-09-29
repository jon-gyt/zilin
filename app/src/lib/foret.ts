/**
 * Les familles lues sur les cartes (l'avancement, les deux nombres de Mon chemin, les
 * familles ouvertes) et la semaine des pierres posées. La scène de Mon chemin et le sentier
 * d'une famille sont dans `chemin.ts` (décisions du propriétaire du 29 septembre 2026,
 * maquette validée `maquettes/chemin.html`) : le cercle des familles et son zoom, l'arbre
 * d'une famille, d'avant Mon chemin, n'existent plus. Le module et ses identifiants
 * (`foret`, `graine`) gardent leur nom d'origine : aucune migration.
 *
 * Tout ce module est pur : aucune fonction ne lit l'horloge, n'écrit dans un stockage
 * ni ne touche au DOM. La journée courante est toujours passée en argument (AAAA-MM-JJ).
 */
import type { Famille, Foret, Index, Noeud } from './content';
import type { Progress } from './session';
import { SEUIL_DEBLOCAGE, stability, type ReviewCard } from './srs';
import { remplir, type TextesChemin } from './ecrans';

/* ---------- les états ---------- */

/** Trois états, et trois seulement : acquis, en cours, à venir. */
export type Etat = 'acquis' | 'encours' | 'avenir';

/** L'état d'un nœud se lit sur son avancement, rien d'autre. */
export function etat(avancement: number): Etat {
  if (avancement >= 1) return 'acquis';
  return avancement > 0 ? 'encours' : 'avenir';
}

/** La famille d'index `i` d'une liste de familles, `null` hors de la liste. */
export function famille(f: Foret, i: number): Noeud | null {
  return f.familles[i] ?? null;
}

/** Un nœud d'une famille par son caractère, racines et membres confondus. */
export function noeud(fam: Noeud, c: string): Noeud | null {
  if (fam.c === c) return fam;
  for (const k of fam.membres) {
    const trouve = noeud(k, c);
    if (trouve) return trouve;
  }
  return null;
}

/** Ce qu'une famille compte de composés acquis, racine à part. */
export function acquis(fam: Noeud): number {
  return fam.membres.filter((k) => etat(k.avancement) === 'acquis').length;
}

/* ---------- la semaine des pierres ---------- */

/** Une pierre par jour travaillé, sept pierres font un pavillon 亭 : un jour de repos. */
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
 * Les journées travaillées de la progression : les pierres posées à la clôture
 * (`joursTravailles` de `session.ts`), qui sont la seule mémoire de la série. Mon chemin
 * et Clore montrent ainsi les mêmes pierres, aux mêmes journées.
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

/** Une case de la semaine : sa journée, son initiale, sa pierre (`graine`, l'identifiant d'origine). */
export type Case = { jour: string; lettre: string; graine: boolean; aujourdhui: boolean };

/**
 * La semaine en cours, du lundi au dimanche. Une pierre par journée travaillée.
 * Jamais de compteur de jours perdus : une journée sans pierre ne dit rien de plus.
 */
export function semaine(p: Progress, aujourdhui: string): Case[] {
  const debut = lundi(aujourdhui);
  const travailles = new Set(joursTravailles(p));
  return LETTRES.map((lettre, i) => {
    const jour = decale(debut, i);
    return { jour, lettre, graine: travailles.has(jour), aujourdhui: jour === aujourdhui };
  });
}

/** Le compteur : les pierres posées cette semaine. */
export function graines(p: Progress, aujourdhui: string): number {
  return semaine(p, aujourdhui).filter((c) => c.graine).length;
}

/** Ce que la semaine dit, en une ligne (`ecrans.json`, `chemin`). Un constat, jamais un reproche. */
export function ligneSemaine(n: number, t: TextesChemin): string {
  if (n === 0) return t['semaine-aucune'];
  if (n >= JOURS_SEMAINE) return t['semaine-pleine'];
  return n === 1 ? t['semaine-une'] : remplir(t['semaine-n'], { n });
}

/* ---------- l'avancement, lu sur les cartes ---------- */

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
 * Une famille de l'export en nœud : la racine, puis ses membres. L'export range une
 * famille à plat (une racine, ses caractères) : la deuxième génération (une bifurcation
 * du sentier) reste donc vide tant que le pipeline n'écrit pas la filiation.
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

/* ---------- les deux nombres de Mon chemin, lus sur la progression ---------- */

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

/* ---------- les familles et le parcours ---------- */

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
