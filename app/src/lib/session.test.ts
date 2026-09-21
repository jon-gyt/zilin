import { describe, it, expect } from 'vitest';
import {
  STEP_ORDER,
  SEUIL_ABSENCE,
  PILE_REDESCENDUE,
  allDone,
  budgetNewBricks,
  catchupSteps,
  dayLabel,
  emptyProgress,
  fromJSON,
  guide,
  markDone,
  miaoPose,
  nextIndex,
  openDay,
  resetDay,
  setDue,
  steps,
  title,
  toJSON,
  type Progress
} from './session';

const JOUR = '2026-03-02';
const neuf = (): Progress => emptyProgress(JOUR);

describe('les six pas', () => {
  it('sont toujours dans le même ordre', () => {
    const p = neuf();
    expect(steps(p).map((s) => s.id)).toEqual([...STEP_ORDER]);
    expect(steps({ ...p, budget: 20, due: 30 }).map((s) => s.id)).toEqual([...STEP_ORDER]);
  });
});

describe('reprise', () => {
  it('reprend au pas exact', () => {
    let p = neuf();
    p = markDone(p, 0, JOUR);
    p = markDone(p, 1, JOUR);
    expect(nextIndex(p)).toBe(2);
    expect(steps(p)[nextIndex(p)].id).toBe('apprendre');
  });
});

describe('nouvelle journée', () => {
  it('remet les pas à zéro', () => {
    let p = markDone(neuf(), 0, JOUR);
    expect(nextIndex(p)).toBe(1);
    p = openDay(p, '2026-03-03');
    expect(p.done).toEqual([]);
    expect(nextIndex(p)).toBe(0);
  });

  it("garde l'état tant que la journée ne change pas", () => {
    const p = markDone(neuf(), 0, JOUR);
    expect(openDay(p, JOUR)).toBe(p);
  });
});

describe('rattrapage après absence', () => {
  it("s'ouvre après le seuil d'absence et ne propose aucun caractère nouveau", () => {
    const veille = '2026-03-02';
    const retour = '2026-03-06'; // quatre journées, au-delà du seuil
    let p: Progress = { ...neuf(), due: 41, lastWorked: veille, days: 11 };
    p = openDay(p, retour);
    expect(p.catchup).toBe(true);
    const l = steps(p);
    expect(l.filter((s) => s.go !== null).every((s) => s.id === 'reviser')).toBe(true);
    expect(l.every((s) => s.id !== 'apprendre')).toBe(true);
    expect(l[l.length - 1]).toMatchObject({ id: 'nouveaux', go: null });
    expect(l.filter((s) => s.go !== null).map((s) => s.m)).toEqual(['5 min', '5 min', '5 min']);
  });

  it("ne s'ouvre pas en deçà du seuil d'absence", () => {
    const p = openDay({ ...neuf(), due: 41, lastWorked: '2026-03-02' }, '2026-03-04');
    expect(SEUIL_ABSENCE).toBe(3);
    expect(p.catchup).toBe(false);
  });

  it('ne compte jamais les jours perdus', () => {
    const p = openDay({ ...neuf(), due: 41, lastWorked: '2026-03-02', days: 11 }, '2026-03-09');
    expect(p.catchup).toBe(true);
    expect(title(p)).toBe('Reprenons');
    expect(guide(p)).not.toMatch(/jour/);
    expect(dayLabel(p)).toBe('12e jour');
    expect(miaoPose(p)).toBe('sleep');
  });

  it('se referme quand la pile est redescendue', () => {
    let p = openDay({ ...neuf(), due: 41, lastWorked: '2026-03-02' }, '2026-03-06');
    expect(p.catchup).toBe(true);
    p = setDue(p, PILE_REDESCENDUE, '2026-03-06');
    expect(p.catchup).toBe(false);
    expect(steps(p).map((s) => s.id)).toEqual([...STEP_ORDER]);
  });
});

describe('blocs de rattrapage', () => {
  it('découpe la pile en blocs de cinq minutes', () => {
    expect(catchupSteps(41).filter((s) => s.go).map((s) => s.d)).toEqual([
      '14 cartes, les plus urgentes',
      '14 cartes',
      '13 cartes'
    ]);
  });
});

describe('budget', () => {
  it('une seule brique nouvelle par session de dix minutes', () => {
    expect(budgetNewBricks(5)).toBe(0);
    expect(budgetNewBricks(10)).toBe(1);
    expect(budgetNewBricks(20)).toBe(2);
  });
});

describe('journée finie', () => {
  it('se reconnaît et se recommence', () => {
    let p = neuf();
    steps(p).forEach((_, i) => {
      p = markDone(p, i, JOUR);
    });
    expect(allDone(p)).toBe(true);
    expect(title(p)).toBe("C'est fait pour aujourd'hui");
    expect(miaoPose(p)).toBe('joy');
    p = resetDay(p);
    expect(nextIndex(p)).toBe(0);
    expect(p.days).toBe(1);
  });
});

describe('export et import', () => {
  it("rend le même état à l'aller-retour", () => {
    let p: Progress = { ...neuf(), due: 22, days: 11, budget: 20 };
    p = markDone(p, 0, JOUR);
    expect(fromJSON(toJSON(p), JOUR)).toEqual(p);
  });

  it('refuse un fichier illisible', () => {
    expect(() => fromJSON('pas du json', JOUR)).toThrow();
  });
});
