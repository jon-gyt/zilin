/**
 * Mon chemin 路 (décisions du propriétaire du 29 septembre 2026, maquette validée
 * `maquettes/chemin.html`) : un test par règle.
 *
 * - un pavé par jour parcouru, du plus récent au jour 1, sous la pierre du jour ;
 * - avant la porte de la route devant, le haut du chemin est dans la brume ;
 * - au-delà de cent jours, le chemin parcouru se replie par tranches de trente ;
 * - chaque famille ouverte tient son auberge, à la première étape qui la touche, son
 *   sentier pavé de ses caractères commencés, « +N » pour le reste ; son sceau quand elle
 *   est lue en entier ;
 * - rien ne sort du dessin ;
 * - le sentier d'une famille ouverte : ses caractères, une bifurcation par génération,
 *   « +N » au-delà de dix, qui se déplie.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Famille, Noeud } from './content';
import {
  LARGEUR,
  PAS_DERRIERE,
  REPLI_DES,
  SENTIER_MAX,
  TRANCHE,
  Y_JOUR,
  aubergesDuChemin,
  joursDesCaracteres,
  lusDeLaFamille,
  placerChemin,
  placerSentier,
  placerSentierFamille,
  tranchesRepliees,
  type Auberge
} from './chemin';
import { positionDuJour, route, type Etape } from './route';
import { emptyProgress } from './session';
import { newCard, schedule, type ReviewCard } from './srs';

const TJ = new Date('2026-03-02T08:00:00Z');
const neuve = (c: string): ReviewCard => newCard(c, TJ);
const sue = (c: string): ReviewCard => schedule(newCard(c, TJ), { correct: true, tries: 0, seconds: 2 }, TJ).card;

/** `n` étapes : la brique `bJ`, et un composé `cJ`, jour J. */
const etapes = (n: number): Etape[] => Array.from({ length: n }, (_, i) => ({ jour: i + 1, brique: `b${i + 1}`, ouvre: [`c${i + 1}`] }));

/** La position d'une progression au jour `jour` du chemin, sa leçon apprise. */
function au(jour: number) {
  return positionDuJour({ ...emptyProgress('2026-03-02'), premiere: false, jourParcours: jour, jourAppris: jour });
}

const fiche = (c: string) => ({ c, pinyin: '', fr: c, en: '', origine: '', etiquette: null, parts: [], nouveau: [] });
/** Une famille : sa racine et ses fiches, la racine comprise, comme l'export. */
const famille = (racine: string, membres: string[]): Famille =>
  ({ version: '', source: '', racine: fiche(racine), fiches: [fiche(racine), ...membres.map(fiche)] }) as unknown as Famille;

describe('le chemin parcouru', () => {
  it('pose un pavé par jour parcouru, du plus récent au jour 1, sous la pierre du jour', () => {
    const es = etapes(15);
    const r = route(es, au(15));
    const s = placerChemin(r, es, new Map(), true);
    expect(s.derriere.map((x) => (x.genre === 'pave' ? x.etape.jour : -1))).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(s.jour.y).toBe(Y_JOUR);
    const ys = s.derriere.map((x) => x.place.y);
    for (let k = 1; k < ys.length; k++) expect(ys[k] - ys[k - 1]).toBe(PAS_DERRIERE);
    expect(s.hauteur).toBeGreaterThan(ys[ys.length - 1]);
  });

  it('montre six pierres devant, et aucune avant la porte de la route devant', () => {
    const es = etapes(30);
    const r = route(es, au(15));
    expect([...placerChemin(r, es, new Map(), true).devant.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(placerChemin(r, es, new Map(), false).devant.size).toBe(0);
  });

  it('se replie par tranches de trente jours au-delà de cent, jamais plus de cent pavés dépliés', () => {
    expect(tranchesRepliees(REPLI_DES)).toEqual([]);
    expect(tranchesRepliees(101)).toEqual([{ de: 0, a: TRANCHE - 1 }]);
    expect(tranchesRepliees(130)).toHaveLength(1);
    expect(tranchesRepliees(131)).toEqual([
      { de: 0, a: 29 },
      { de: 30, a: 59 }
    ]);
    const es = etapes(141);
    const r = route(es, au(141));
    const s = placerChemin(r, es, new Map(), true);
    const replis = s.derriere.filter((x) => x.genre === 'repli');
    expect(replis.map((x) => (x.genre === 'repli' ? [x.de, x.a] : []))).toEqual([
      [31, 60],
      [1, 30]
    ]);
    expect(s.derriere.filter((x) => x.genre === 'pave').length).toBeLessThanOrEqual(REPLI_DES);
    /* une tranche touchée se déplie */
    const dep = placerChemin(r, es, new Map(), true, new Set([0]));
    expect(dep.derriere.filter((x) => x.genre === 'repli')).toHaveLength(1);
    expect(dep.derriere.filter((x) => x.genre === 'pave')).toHaveLength(140 - 30);
  });
});

describe('les auberges des familles', () => {
  const es: Etape[] = [
    { jour: 1, brique: '人', ouvre: ['从'] },
    { jour: 2, brique: '日', ouvre: ['明'] },
    { jour: 3, brique: '月', ouvre: ['朋'] }
  ];
  const familles = [famille('人', ['从', '以', '众']), famille('日', ['明', '是', '早']), famille('月', ['朋'])];

  it('une famille tient son auberge à la première étape qui la touche, dès qu’un caractère en plus de sa brique est commencé', () => {
    expect([...aubergesDuChemin(es, familles, [sue('人'), sue('日')]).keys()]).toEqual([]);
    const a = aubergesDuChemin(es, familles, [sue('人'), sue('从'), neuve('明')]);
    expect([...a.keys()]).toEqual([1, 2]);
    expect(a.get(1)?.[0]).toMatchObject({ racine: '人', jour: 1, lus: 2, total: 4 });
    /* en cours d'abord, puis les lus : ce qui y est commencé */
    expect(a.get(2)?.[0].membres).toEqual([{ c: '明', etat: 'encours' }]);
  });

  it('le sceau se pose sur le fanion quand la famille est lue en entier', () => {
    const a = aubergesDuChemin(es, familles, [sue('月'), sue('朋'), sue('人'), sue('从')]);
    expect(a.get(3)?.[0].sceau).toBe(true);
    expect(a.get(1)?.[0].sceau).toBe(false);
  });

  it('son sentier ne sort jamais du dessin : « +N » compte ce qui n’y tient pas', () => {
    const grande: Auberge = {
      racine: '口',
      pinyin: 'kǒu',
      fr: 'bouche',
      jour: 8,
      membres: Array.from({ length: 12 }, (_, i) => ({ c: `m${i}`, etat: 'lu' as const })),
      total: 20,
      lus: 12,
      sceau: false
    };
    for (const x of [78, 100, 122, 180]) {
      const s = placerSentier({ x, y: 400, r: 15 }, grande);
      const bout = s.plus?.x ?? s.membres[s.membres.length - 1].x;
      expect(bout + 11 * 1.3).toBeLessThanOrEqual(LARGEUR);
      expect(s.membres.length + (s.plus?.n ?? 0)).toBe(19);
    }
  });
});

describe("le sentier d'une famille ouverte", () => {
  const noeud = (c: string, membres: Noeud[] = [], avancement = 0): Noeud => ({ c, pinyin: '', fr: '', avancement, membres });

  it('pave ses caractères en montant, dans l’ordre de la famille, et bifurque pour une génération de plus', () => {
    const fam = noeud('日', [noeud('明', [], 1), noeud('是', [noeud('题')], 1), noeud('早')]);
    const s = placerSentierFamille(fam);
    const un = s.paves.filter((x) => x.generation === 1);
    expect(un.map((x) => x.c)).toEqual(['明', '是', '早']);
    for (let k = 1; k < un.length; k++) expect(un[k].y).toBeLessThan(un[k - 1].y);
    expect(un.map((x) => x.etat)).toEqual(['lu', 'lu', 'avenir']);
    expect(s.paves.find((x) => x.c === '题')).toMatchObject({ generation: 2, par: '是' });
    expect(s.bifurcations).toHaveLength(1);
    for (const x of s.paves) expect(x.x + x.r * 1.3).toBeLessThanOrEqual(s.largeur);
  });

  it('montre dix caractères, puis « +N », qui déplie le reste', () => {
    const fam = noeud('口', Array.from({ length: 17 }, (_, i) => noeud(`k${i}`)));
    const court = placerSentierFamille(fam);
    expect(court.paves).toHaveLength(SENTIER_MAX);
    expect(court.plus?.n).toBe(7);
    const tout = placerSentierFamille(fam, true);
    expect(tout.paves).toHaveLength(17);
    expect(tout.plus).toBeNull();
    expect(tout.hauteur).toBeGreaterThan(court.hauteur);
  });

  it('compte ses lus, racine comprise, et le jour où chaque caractère a été posé', () => {
    const fam = noeud('日', [noeud('明', [], 1), noeud('是', [], 0.5)], 1);
    expect(lusDeLaFamille(fam)).toEqual({ lus: 2, total: 3 });
    const jours = joursDesCaracteres([
      { jour: 5, brique: '日', ouvre: ['明'] },
      { jour: 9, brique: '门', ouvre: ['明', '问'] }
    ]);
    expect(jours.get('明')).toBe(5);
    expect(jours.get('问')).toBe(9);
  });
});

describe('Mon chemin, dans les écrans', () => {
  const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

  it('ouvre une famille sur son auberge, le fanion à sa racine, sans arbre ni cercle', () => {
    const chemin = source('Chemin.svelte');
    expect(chemin).toContain('onclick={() => ouvrirAuberge(a)}');
    expect(chemin).toContain('class="fanion"');
    expect(chemin).not.toMatch(/placerCercle|zoombox|RouteEntree/);
    const tree = source('Tree.svelte');
    expect(tree).toContain('placerSentierFamille(fam, tout)');
    expect(tree).not.toContain('placerArbre');
  });

  it('les pavés sont posés à plat, vus en légère plongée : des ellipses, jamais une stèle debout', () => {
    for (const f of ['Chemin.svelte', 'Tree.svelte', 'Close.svelte', 'Semaine.svelte']) {
      expect(source(f), f).toMatch(/<ellipse/);
      expect(source(f), f).not.toMatch(/class="(stele|borne|pierre-stele|repere)"/);
    }
  });
});
