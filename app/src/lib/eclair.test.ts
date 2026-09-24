import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  SANS_ECLAIR,
  SENS_ECLAIR,
  TAO_ECLAIR,
  TOURS_ECLAIR,
  dictionnaire,
  ligneMotsDevines,
  lireEclair,
  motDe,
  motsDeFiches,
  motsDevines,
  motsPossibles,
  noterMotDevine,
  toursEclair,
  type Eclair
} from './eclair';
import { IDS, JEUX, constat, corpusDeJeu, corpusVide, disponibles, tour, type CorpusJeux } from './jeux';
import { emptyProgress, fromJSON, toJSON } from './session';
import { SEUIL_DEBLOCAGE } from './srs';
import { VERSION_DONNEES, type Famille, type Fiche, type Index } from './content';

/* ---------- un petit dictionnaire, en dur : aucun réseau, aucun fichier ---------- */

const ECLAIR: Eclair = lireEclair({
  version: '0.9.0',
  source: 'test',
  mots: [
    { id: '火车', mot: '火车', pinyin: 'huǒchē', fr: 'train', en: 'train', leurres: ['火山', '电车', '汽车'] },
    { id: '火山', mot: '火山', pinyin: 'huǒshān', fr: 'volcan', en: 'volcano', leurres: ['火车', '电车', '汽车'] },
    { id: '电车', mot: '电车', pinyin: 'diànchē', fr: 'tramway', en: 'tram', leurres: ['火车', '火山', '汽车'] },
    { id: '汽车', mot: '汽车', pinyin: 'qìchē', fr: 'voiture', en: 'car', leurres: ['火车', '电车', '火山'] },
    { id: '大人', mot: '大人', pinyin: 'dàren', fr: 'adulte', en: 'adult', leurres: ['火车', '火山', '汽车'] }
  ],
  racines: { 火: '火', 车: '车', 山: '山', 电: '电', 汽: '氵', 大: '大', 人: '人' }
});

const JOUR = '2026-09-24';
const stable = (c: string) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 });
const fragile = (c: string) => ({ c, stabilite: 1 });
const TRAITS = ['火', '车', '山', '电', '汽', '大', '人'];

function corpus(o: { cartes?: { c: string; stabilite: number }[]; devines?: string[]; fiches?: Fiche[]; traits?: string[] } = {}): CorpusJeux {
  return corpusDeJeu({
    eclair: ECLAIR,
    cartes: o.cartes ?? ['火', '车', '山', '大', '人'].map(stable),
    devines: o.devines ?? [],
    fiches: o.fiches ?? [],
    traits: o.traits ?? TRAITS
  });
}

function fiche(c: string, mots: string[]): Fiche {
  return {
    c,
    pinyin: '',
    fr: '',
    en: '',
    parts: [c],
    nouveau: [],
    role: null,
    origine_fr: '',
    origine_en: '',
    etiquette: null,
    mots: mots.map((hanzi) => ({ hanzi, pinyin: '', fr: '', en: '' })),
    niveaux: {},
    traits: [],
    medianes: []
  };
}

/* ---------- le contenu ---------- */

describe('eclair.json, relu par l’app', () => {
  it('écarte un mot illisible, de plus ou de moins de deux caractères, ou en double', () => {
    const lu = lireEclair({
      mots: [
        { id: '火车', mot: '火车', fr: 'train', leurres: [] },
        { id: '火车', mot: '火车', fr: 'convoi', leurres: [] },
        { mot: '火', fr: 'feu', leurres: [] },
        { mot: '火车站', fr: 'gare', leurres: [] },
        { mot: '大人', fr: '', leurres: [] },
        { mot: 'ab', fr: 'x', leurres: [] },
        'n’importe quoi'
      ]
    });
    expect(lu.mots.map((m) => m.id)).toEqual(['火车']);
    expect(lu.mots[0].fr).toBe('train');
  });

  it('rend un dictionnaire vide pour un fichier illisible : le jeu se tait', () => {
    expect(lireEclair(null)).toEqual(SANS_ECLAIR);
    expect(dictionnaire({ eclair: SANS_ECLAIR })).toBeNull();
    expect(JEUX.eclair.preparer(corpusVide(), JOUR)).toBeNull();
  });
});

/* ---------- les mots proposés ---------- */

describe('les mots proposés', () => {
  it('ont leurs deux caractères acquis, et rien d’autre', () => {
    const ids = motsPossibles(corpus()).map((m) => m.id);
    expect(ids).toEqual(['火车', '火山', '大人']);
    expect(ids).not.toContain('电车'); // 电 n'a pas de carte
    expect(ids).not.toContain('汽车');
  });

  it('ne comptent pas un caractère en cours comme acquis', () => {
    const c = corpus({ cartes: [stable('火'), fragile('车'), stable('山')] });
    expect(motsPossibles(c).map((m) => m.id)).toEqual(['火山']);
  });

  it('ne tirent jamais l’acquis de démonstration', () => {
    const c = corpusDeJeu({
      eclair: ECLAIR,
      cartes: [],
      traits: TRAITS,
      foret: {
        version: '',
        source: '',
        familles: [
          { c: '火', pinyin: '', fr: '', avancement: 1, membres: [{ c: '车', pinyin: '', fr: '', avancement: 1, membres: [] }] }
        ]
      } as never
    });
    expect(motsPossibles(c)).toEqual([]);
  });

  it('écartent un mot déjà appris comme mot de la fiche d’un caractère appris', () => {
    const c = corpus({ fiches: [fiche('车', ['火车'])] });
    expect(motsPossibles(c).map((m) => m.id)).not.toContain('火车');
    /* La fiche d'un caractère sans carte n'a pas encore été lue : le mot reste à deviner. */
    const pasLue = corpus({ fiches: [fiche('电', ['火车'])] });
    expect(motsPossibles(pasLue).map((m) => m.id)).toContain('火车');
  });

  it('lisent aussi les mots de fiche des familles exportées', () => {
    const fam = { version: '', source: '', racine: {} as never, fiches: [fiche('人', ['大人'])] } as Famille;
    expect(motsDeFiches([], [fam], [stable('人')])).toEqual(['大人']);
    expect(motsDeFiches([], [fam], [])).toEqual([]);
  });

  it('écartent un mot déjà deviné', () => {
    expect(motsPossibles(corpus({ devines: ['火车'] })).map((m) => m.id)).toEqual(['火山', '大人']);
  });

  it('ne montrent que ce qui se dessine depuis les traits', () => {
    const c = corpus({ traits: ['火', '车', '大', '人'] });
    expect(motsPossibles(c).map((m) => m.id)).toEqual(['火车', '大人']);
  });

  it('rendent le jeu disponible, et indisponible sans mot possible', () => {
    expect(IDS).toContain('eclair');
    expect(disponibles(corpus(), JOUR)).toContain('eclair');
    expect(disponibles(corpus({ cartes: [stable('火')] }), JOUR)).not.toContain('eclair');
  });
});

/* ---------- une manche ---------- */

describe('une manche du dictionnaire éclair', () => {
  it('pose quatre sens, dont le bon, tirés du contenu, et la même manche à graine égale', () => {
    const tours = toursEclair(corpus(), JOUR);
    expect(tours.length).toBe(3);
    expect(tours.length).toBeLessThanOrEqual(TOURS_ECLAIR);
    for (const t of tours) {
      const m = motDe(t, corpus());
      expect(m).not.toBeNull();
      expect(t.choix).toHaveLength(SENS_ECLAIR);
      expect(new Set(t.choix).size).toBe(SENS_ECLAIR);
      expect(t.choix).toContain(m!.fr);
      expect(t.reponse).toEqual([m!.fr]);
      /* Les deux caractères du mot sont notés : le premier, et l'autre avec lui. */
      expect([t.c, ...(t.aussi ?? [])]).toEqual([...m!.mot]);
    }
    expect(toursEclair(corpus(), JOUR)).toEqual(tours);
  });

  it('n’a ni chronomètre, ni limite : pas de temps, pas de vie', () => {
    expect(JEUX.eclair.chrono).toBe(0);
    expect(JEUX.eclair.limite).toBe(0);
    expect(JEUX.eclair.minutes).toBeGreaterThanOrEqual(1);
    expect(JEUX.eclair.minutes).toBeLessThanOrEqual(3);
  });

  it('note les deux caractères par `grade`, juste ou montré, et le constat compte les mots', () => {
    const m = JEUX.eclair.preparer(corpus(), JOUR)!;
    const t = tour(m)!;
    const juste = JEUX.eclair.repondre(m, t.reponse[0], { correct: true, tries: 0, seconds: 3 });
    expect(juste.correct).toBe(true);
    expect(juste.evenements.map((e) => e.c)).toEqual([t.c, ...(t.aussi ?? [])]);
    expect(juste.note).toBe(Rating.Easy);
    const t2 = tour(juste.manche)!;
    const leurre = t2.choix.find((x) => x !== t2.reponse[0])!;
    const faux = JEUX.eclair.repondre(juste.manche, leurre, { correct: true, tries: 0, seconds: 3 });
    expect(faux.correct).toBe(false);
    expect(faux.montre).toBe(true);
    expect(faux.note).toBe(Rating.Again);
    expect(constat(faux.manche)).toBe('4 caractères revus, 1 mot deviné.');
  });
});

/* ---------- le compteur « mots devinés » ---------- */

describe('le compteur « mots devinés »', () => {
  it('compte un mot une seule fois, même deviné de nouveau', () => {
    const p0 = emptyProgress(JOUR);
    expect(motsDevines(p0)).toBe(0);
    const p1 = noterMotDevine(p0, '火车');
    const p2 = noterMotDevine(p1, '火车');
    const p3 = noterMotDevine(p2, '大人');
    expect(p2).toBe(p1);
    expect(motsDevines(p3)).toBe(2);
    expect(p3.motsDevines).toEqual(['火车', '大人']);
    expect(noterMotDevine(p3, '')).toBe(p3);
  });

  it('suit l’export et l’import JSON de la progression', () => {
    const p = noterMotDevine(noterMotDevine(emptyProgress(JOUR), '火车'), '电脑');
    const relue = fromJSON(toJSON(p), JOUR);
    expect(relue.motsDevines).toEqual(['火车', '电脑']);
    expect(motsDevines(relue)).toBe(2);
  });

  it('se relit vide d’un export plus ancien, et sans doublon d’un export abîmé', () => {
    const { motsDevines: _, ...ancien } = emptyProgress(JOUR);
    expect(fromJSON(JSON.stringify(ancien), JOUR).motsDevines).toEqual([]);
    const abime = { ...emptyProgress(JOUR), motsDevines: ['火车', '火车', 3, ''] };
    expect(fromJSON(JSON.stringify(abime), JOUR).motsDevines).toEqual(['火车']);
  });

  it('se dit d’une ligne sobre : un nombre, pas un score', () => {
    expect(ligneMotsDevines(0)).toBe('Aucun mot deviné pour l’instant.');
    expect(ligneMotsDevines(1)).toBe('1 mot deviné.');
    expect(ligneMotsDevines(12)).toBe('12 mots devinés.');
  });
});

/* ---------- Tao ---------- */

describe('Tao au dictionnaire éclair', () => {
  it('joue, la tête penchée sur le mot, sans lanterne', () => {
    expect(TAO_ECLAIR).toEqual({ posture: 'jeu', penchee: true });
  });
});

/* ---------- l'export versionné ---------- */

describe('eclair.json de l’export', () => {
  const dossier = `../../public/data/${VERSION_DONNEES}`;
  const index = JSON.parse(readFileSync(new URL(`${dossier}/index.json`, import.meta.url), 'utf8')) as Index & {
    eclair: string;
  };
  const brut = JSON.parse(readFileSync(new URL(`${dossier}/${index.eclair}`, import.meta.url), 'utf8')) as {
    mots: unknown[];
  };
  const lu = lireEclair(brut);

  it('est nommé par l’index et se relit sans perte', () => {
    expect(index.eclair).toBe('eclair.json');
    expect(lu.mots.length).toBe(brut.mots.length);
    expect(lu.mots.length).toBeGreaterThanOrEqual(150);
    expect(lu.mots.length).toBeLessThanOrEqual(250);
  });

  it('donne à chaque mot trois leurres dont l’app trouve le sens, jamais le sien', () => {
    const sens = new Map(lu.mots.map((m) => [m.id, m.fr]));
    for (const m of lu.mots) {
      expect(m.leurres).toHaveLength(SENS_ECLAIR - 1);
      for (const x of m.leurres) {
        expect(sens.get(x)).toBeTruthy();
        expect(sens.get(x)).not.toBe(m.fr);
      }
      for (const c of m.mot) expect(lu.racines[c]).toBeTruthy();
    }
  });

  it('pose 电脑 dès que 电 et 脑 sont acquis', () => {
    const c = corpusDeJeu({ eclair: lu, cartes: [stable('电'), stable('脑')], traits: ['电', '脑'] });
    expect(motsPossibles(c).map((m) => m.id)).toEqual(['电脑']);
  });
});
