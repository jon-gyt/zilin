/**
 * Les étagères de Lire (décision du propriétaire du 26 septembre 2026) : un test par règle.
 * Les contes ci-dessous sont des fixtures de test ; l'app n'en contient aucun, tout conte
 * vient de l'export, son motif du catalogue.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  lireCatalogueContes,
  type CatalogueConte,
  type Conte,
  type Index,
  type IndexConte,
  type IndexJour,
  type VersionConte
} from './content';
import {
  MOTIFS,
  PIGMENTS,
  dansCombien,
  etagereDe,
  etageres,
  etendue,
  jourDOuverture,
  joursDuChemin,
  ligneOuverture,
  lireMotif,
  livresParRangee,
  niveauxLus,
  ouvertures,
  rangees,
  resteALire
} from './etageres';
import { bibliotheque } from './lecture';

const version = (seuil: string, zh: string): VersionConte => ({
  seuil,
  titre: '',
  phrases: [{ zh, pinyin: '', fr: '' }],
  glose: {}
});

const conte = (id: string, ...versions: VersionConte[]): Conte => ({
  version: '0.1.0',
  source: 'test',
  id,
  titre_fr: id,
  versions
});

const index = (id: string, seuils: string[]): IndexConte => ({
  id,
  titre_fr: id,
  seuils,
  fichier: `contes/${id}.json`
});

const prevu = (id: string, niveaux: string[], motif?: string, chapitres = 1): CatalogueConte => ({
  id,
  titre_zh: '山水',
  titre_pinyin: 'shān shuǐ',
  titre_fr: id,
  niveaux,
  chapitres,
  ...(motif ? { motif } : {})
});

/* Quatre contes : un ouvert par l'acquis, un écrit mais fermé, deux pas encore écrits. */
const CATALOGUE = [
  prevu('loin', ['hsk4', 'hsk6', 'hsk7-9'], 'lance', 4),
  prevu('ouvert', ['255', 'hsk3'], 'montagne'),
  prevu('ferme', ['255', 'hsk3'], 'roues'),
  prevu('inconnu', ['hsk3', 'hsk5'], 'dragon')
];
const INDEX = [index('ouvert', ['255']), index('ferme', ['255']), index('hors', ['hsk5'])];
const CONTES = new Map([
  ['ouvert', conte('ouvert', version('255', '人山。'))],
  ['ferme', conte('ferme', version('255', '人水火。'))],
  /* écrit, mais 龟 n'est pas sur le chemin : on ne sait pas quand il s'ouvre */
  ['hors', conte('hors', version('hsk5', '人水龟。'))]
]);
const ACQUIS = new Set(['人', '山']);

/* Le chemin : 人 au jour 1, 山 au 2, 水 au 5 et 火 en composé au 7 ; le jour 8 n'est pas
   réconcilié, son 龟 n'entre pas. */
const JOURS: IndexJour[] = [
  { jour: 1, brique: '人', composes: [], non_reconcilie: false },
  { jour: 2, brique: '山', composes: [], non_reconcilie: false },
  { jour: 5, brique: '水', composes: [], non_reconcilie: false },
  { jour: 7, brique: '丶', composes: ['火'], non_reconcilie: false },
  { jour: 8, brique: '龟', composes: [], non_reconcilie: true }
];
const CHEMIN = joursDuChemin(JOURS);

const lesEtageres = (lus: Record<string, string[]> = {}, relecture = false, fait = 2) => {
  const b = bibliotheque(INDEX, CONTES, ACQUIS, lus, relecture, CATALOGUE);
  return etageres(b, CATALOGUE, lus, { ouvertures: ouvertures(b, CONTES, ACQUIS, CHEMIN), fait });
};

describe('trois étagères, dans l’ordre du brief', () => {
  it('« À lire maintenant », « Bientôt », « Plus loin », toujours dans cet ordre', () => {
    expect(lesEtageres().map((e) => [e.id, e.nom])).toEqual([
      ['maintenant', 'À lire maintenant'],
      ['bientot', 'Bientôt'],
      ['loin', 'Plus loin']
    ]);
  });

  it('ouvert par l’acquis ; écrit et sur le chemin ; le reste plus loin', () => {
    const [maintenant, bientot, loin] = lesEtageres();
    expect(maintenant.livres.map((l) => l.entree.id)).toEqual(['ouvert']);
    expect(bientot.livres.map((l) => l.entree.id)).toEqual(['ferme']);
    /* Les écrits hors du chemin d'abord, puis les pas encore écrits, dans l'ordre du catalogue. */
    expect(loin.livres.map((l) => l.entree.id)).toEqual(['hors', 'loin', 'inconnu']);
  });

  it('l’étagère suit la bibliothèque et le chemin, sans rien estimer', () => {
    const b = bibliotheque(INDEX, CONTES, ACQUIS, {}, false, CATALOGUE);
    const o = ouvertures(b, CONTES, ACQUIS, CHEMIN);
    expect(o).toEqual({ ferme: 7, hors: null });
    expect(b.map((e) => etagereDe(e, o[e.id] ?? null))).toEqual(['maintenant', 'bientot', 'loin', 'loin', 'loin']);
    /* Sans chemin (index illisible), rien ne va sur « Bientôt ». */
    expect(etageres(b, CATALOGUE)[1].livres).toEqual([]);
  });

  it('le jour où s’ouvre un conte : celui où entre le dernier caractère qui lui manque', () => {
    expect(CHEMIN.get('火')).toBe(7);
    expect(CHEMIN.has('龟')).toBe(false);
    expect(jourDOuverture(['水', '火'], CHEMIN)).toBe(7);
    expect(jourDOuverture(['水', '龟'], CHEMIN)).toBeNull();
    expect(jourDOuverture([], CHEMIN)).toBeNull();
  });

  it('« s’ouvre dans N j », en jours du chemin ; rien quand le jour est passé', () => {
    const [, bientot] = lesEtageres({}, false, 2);
    expect(bientot.livres[0].dans).toBe(5);
    expect(ligneOuverture(bientot.livres[0].dans)).toBe("s'ouvre dans 5 j");
    /* Jour 7 fait : 火 est entré, pas encore acquis ; le conte reste « Bientôt », sans date. */
    const [, apres] = lesEtageres({}, false, 7);
    expect(apres.livres.map((l) => [l.entree.id, l.dans])).toEqual([['ferme', null]]);
    expect(ligneOuverture(null)).toBe('');
    expect(dansCombien(7, 6)).toBe(1);
    expect(dansCombien(null, 0)).toBeNull();
  });

  it('en mode relecture, un conte écrit s’ouvre et passe sur « À lire maintenant », marqué', () => {
    const [maintenant, bientot] = lesEtageres({}, true);
    expect(maintenant.livres.map((l) => l.entree.id)).toEqual(['ouvert', 'ferme', 'hors']);
    expect(maintenant.livres[1].entree.horsAcquis).toBe(true);
    expect(bientot.livres).toEqual([]);
  });

  it('sous un livre fermé, ce qu’il reste à lire, compté', () => {
    const [, bientot, loin] = lesEtageres();
    expect(resteALire(bientot.livres[0].entree)).toBe('encore 2 caractères');
    expect(resteALire({ reste: 1 })).toBe('encore un caractère');
    /* Pas écrit : on ne sait pas le compter, on ne dit rien. */
    expect(resteALire(loin.livres[1].entree)).toBe('');
  });

  it('un conte que le catalogue ne connaît pas (export plus ancien) trouve quand même sa place', () => {
    const e = etageres(bibliotheque(INDEX, CONTES, ACQUIS));
    expect(e[0].livres.map((l) => l.entree.id)).toEqual(['ouvert']);
    expect(e[0].livres[0].motif).toBeNull();
  });
});

describe('les livres cousus', () => {
  it('le motif vient du catalogue ; un nom hors du jeu ne dessine rien', () => {
    const livres = lesEtageres().flatMap((e) => e.livres);
    const motif = Object.fromEntries(livres.map((l) => [l.entree.id, l.motif]));
    expect(motif).toEqual({ ouvert: 'montagne', ferme: 'roues', hors: null, loin: 'lance', inconnu: null });
    expect(lireMotif('dragon')).toBeNull();
    expect(lireMotif(undefined)).toBeNull();
  });

  it('treize motifs, jamais de dragon, les mêmes que le pipeline', () => {
    expect(MOTIFS).toHaveLength(13);
    expect(MOTIFS).not.toContain('dragon' as never);
    const contes = readFileSync(new URL('../../../data/src/wenlu_data/contes.py', import.meta.url), 'utf8');
    const bloc = contes.slice(contes.indexOf('MOTIFS = ('), contes.indexOf(')', contes.indexOf('MOTIFS = (')));
    expect([...bloc.matchAll(/"([a-z]+)"/g)].map((m) => m[1])).toEqual([...MOTIFS]);
  });

  it('chaque conte de l’export a son motif, que l’app sait dessiner', () => {
    const i = JSON.parse(readFileSync('public/data/0.1.0/index.json', 'utf-8')) as Index;
    const catalogue = lireCatalogueContes(i.catalogue);
    expect(catalogue.length).toBeGreaterThan(0);
    for (const c of catalogue) expect(lireMotif(c.motif), c.id).not.toBeNull();
  });

  it('un livre garde son pigment en changeant d’étagère : le rang du catalogue le fixe', () => {
    const avant = lesEtageres().flatMap((e) => e.livres);
    const apres = lesEtageres({}, true).flatMap((e) => e.livres);
    const pig = (ls: typeof avant) => Object.fromEntries(ls.map((l) => [l.entree.id, l.pigment]));
    expect(pig(avant)).toEqual(pig(apres));
    expect(pig(avant)).toEqual({ loin: PIGMENTS[0], ouvert: PIGMENTS[1], ferme: PIGMENTS[2], inconnu: PIGMENTS[3], hors: PIGMENTS[0] });
  });

  it('un récit long annonce ses chapitres sur la couverture', () => {
    const livres = lesEtageres().flatMap((e) => e.livres);
    expect(livres.find((l) => l.entree.id === 'loin')?.chapitres).toBe(4);
    expect(livres.find((l) => l.entree.id === 'ouvert')?.chapitres).toBe(1);
  });

  it('les sceaux gardent l’état de chaque niveau, et le jade marque un niveau déjà lu', () => {
    const [maintenant] = lesEtageres({ ouvert: ['255'] });
    const l = maintenant.livres[0];
    expect(l.sceaux).toEqual([
      { seuil: '255', etat: 'ouvert', lu: true },
      { seuil: 'hsk3', etat: 'a_ecrire', lu: false }
    ]);
    expect(niveauxLus(l)).toBe('Niveaux : seuil 255 écrit et ouvert, déjà lu, HSK 3 pas encore écrit');
  });
});

describe('les rangées et la planche', () => {
  it('trois livres par rangée sur un téléphone, un au moins, trois avant la mesure', () => {
    expect(livresParRangee(349)).toBe(3);
    expect(livresParRangee(600)).toBe(5);
    expect(livresParRangee(80)).toBe(1);
    expect(livresParRangee(0)).toBe(3);
  });

  it('les livres se rangent en rangées, chacune sur sa planche', () => {
    expect(rangees([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(rangees([], 3)).toEqual([]);
    expect(rangees([1, 2], 0)).toEqual([[1], [2]]);
  });

  it('« Plus loin » dit l’étendue de ses niveaux', () => {
    const [, bientot, loin] = lesEtageres();
    expect(etendue(loin.livres)).toBe('HSK 3 à 7-9');
    expect(etendue(bientot.livres)).toBe('255 à HSK 3');
    expect(etendue([])).toBe('');
  });
});
