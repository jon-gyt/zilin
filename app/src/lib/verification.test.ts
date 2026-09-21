import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  AVANCE_MS,
  CHOIX,
  PROCHAINE_FOIS,
  VERDICTS,
  leurres,
  melanger,
  partage,
  proche,
  questions
} from './verification';
import { jourDepuisEpoque, type Famille, type Voisin, type Voisins } from './content';
import { grade } from './srs';

const famille = JSON.parse(
  readFileSync(new URL('../../public/data/demo/familles/主.json', import.meta.url), 'utf8')
) as Famille;
const voisins = JSON.parse(
  readFileSync(new URL('../../public/data/demo/voisins.json', import.meta.url), 'utf8')
) as Voisins;

const JOUR = '2026-03-02';
const graine = jourDepuisEpoque(JOUR);
const parCaractere = (c: string): Voisin => voisins.voisins.find((v) => v.c === c) as Voisin;

describe('le mélange', () => {
  it('garde tous les éléments et ne dépend que de la graine', () => {
    const l = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...melanger(l, 7)].sort((a, b) => a - b)).toEqual(l);
    expect(melanger(l, 7)).toEqual(melanger(l, 7));
    expect(melanger(l, 7)).not.toEqual(melanger(l, 8));
  });
});

describe('les leurres', () => {
  it('partagent un composant avec la réponse', () => {
    expect(partage(['亻', '主'], ['亻', '木'])).toBe(true);
    expect(partage(['亻', '主'], ['丶', '王'])).toBe(false);
  });

  it('comptent le composant lui-même et le caractère qui le contient', () => {
    /* 主 est une brique de 住 ; 住 est le caractère où 主 se retrouve. */
    expect(proche(parCaractere('主'), parCaractere('住'))).toBe(true);
    expect(proche(parCaractere('住'), parCaractere('主'))).toBe(true);
    expect(proche(parCaractere('住'), parCaractere('住'))).toBe(false);
  });

  it('ne prennent que des caractères qui partagent un composant', () => {
    const cible = parCaractere('住');
    const pris = leurres(cible, voisins.voisins, CHOIX - 1, graine);
    expect(pris).toHaveLength(CHOIX - 1);
    for (const l of pris) {
      expect(l.c).not.toBe(cible.c);
      expect(proche(l, cible)).toBe(true);
    }
  });

  it('ne rendent jamais deux fois le même caractère', () => {
    const pris = leurres(parCaractere('住'), voisins.voisins, CHOIX - 1, graine).map((v) => v.c);
    expect(new Set(pris).size).toBe(pris.length);
  });

  it('à défaut de voisins, complètent avec les caractères de la famille, et rien d’autre', () => {
    const cible = parCaractere('主');
    const seuls = [cible, parCaractere('他')];
    const secours = [parCaractere('住')];
    const pris = leurres(cible, seuls, 3, graine, secours);
    expect(pris.map((v) => v.c)).toEqual(['住']);
  });
});

describe('les questions du pas Fixer', () => {
  const liste = questions(famille, voisins, graine);

  it('portent sur ce qui vient d’être vu : la brique et son composé', () => {
    expect(liste.length).toBeGreaterThanOrEqual(2);
    expect(liste.length).toBeLessThanOrEqual(3);
    for (const q of liste) expect(['主', '住']).toContain(q.c);
  });

  it('posent le sens, le caractère à partir du sens, puis l’assemblage de briques', () => {
    expect(liste.map((q) => q.type)).toEqual(['sens', 'char', 'parts']);
    expect(liste.map((q) => q.label)).toEqual(['Sens', 'Caractère', 'Assemblage']);
    expect(liste[2].parts).toEqual(['亻', '主']);
  });

  it('ne posent jamais la bonne réponse deux fois', () => {
    for (const q of liste) {
      expect(new Set(q.opts).size).toBe(q.opts.length);
      expect(q.opts.filter((o) => o === q.opts[q.ok])).toHaveLength(1);
      expect(q.ok).toBeGreaterThanOrEqual(0);
    }
  });

  it('choisissent des leurres qui partagent un composant avec la réponse', () => {
    const assemblage = liste[2];
    const cible = parCaractere(assemblage.c);
    for (const [i, o] of assemblage.opts.entries()) {
      if (i === assemblage.ok) continue;
      expect(proche(parCaractere(o), cible)).toBe(true);
    }
  });

  it('corrigent par les briques, avec le texte de la fiche', () => {
    const fiches = Object.fromEntries(famille.fiches.map((f) => [f.c, f.origine_fr]));
    for (const q of liste) {
      expect(q.why).toBe(fiches[q.c]);
      expect(q.why).not.toBe('');
    }
  });

  it('posent la même vérification toute la journée, et une autre le lendemain', () => {
    expect(questions(famille, voisins, graine)).toEqual(liste);
    const demain = questions(famille, voisins, jourDepuisEpoque('2026-03-03'));
    expect(demain.map((q) => q.opts)).not.toEqual(liste.map((q) => q.opts));
  });

  it('visent quatre choix, et n’en posent moins que faute de voisins', () => {
    for (const q of liste) {
      expect(q.opts.length).toBeGreaterThanOrEqual(3);
      expect(q.opts.length).toBeLessThanOrEqual(CHOIX);
    }
  });
});

describe('la correction', () => {
  it('note automatiquement, sur le temps et les essais', () => {
    expect(grade({ correct: true, tries: 0, seconds: 3 })).toBe(Rating.Easy);
    expect(grade({ correct: true, tries: 0, seconds: 9 })).toBe(Rating.Good);
    expect(grade({ correct: true, tries: 1, seconds: 9 })).toBe(Rating.Hard);
    expect(grade({ correct: false, tries: 2, seconds: 20 })).toBe(Rating.Again);
  });

  it('dit des constats, jamais des félicitations', () => {
    for (const v of Object.values(VERDICTS)) expect(v).not.toMatch(/bravo|super|génial|félicit/i);
    expect(VERDICTS[Rating.Easy]).toBe('Oui.');
    expect(VERDICTS[Rating.Again]).toBe('Non.');
  });

  it('annonce l’échéance promise par la notation automatique', () => {
    expect(PROCHAINE_FOIS[Rating.Easy]).toBe('12 jours');
    expect(PROCHAINE_FOIS[Rating.Good]).toBe('4 jours');
    expect(PROCHAINE_FOIS[Rating.Hard]).toBe('1 jour');
    expect(PROCHAINE_FOIS[Rating.Again]).toBe('10 minutes');
  });

  it('avance toute seule 1,3 s après une bonne réponse', () => {
    expect(AVANCE_MS).toBe(1300);
  });
});
