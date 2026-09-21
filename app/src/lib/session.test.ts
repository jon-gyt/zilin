import { describe, it, expect } from 'vitest';
import {
  STEP_ORDER,
  SEUIL_ABSENCE,
  PILE_REDESCENDUE,
  allDone,
  budgetNewBricks,
  catchupSteps,
  currentStep,
  dayLabel,
  emptyProgress,
  fromJSON,
  guide,
  learnNext,
  markDone,
  miaoPose,
  nextIndex,
  openDay,
  resetDay,
  setDue,
  setLearnView,
  setTrace,
  steps,
  traceProposee,
  traceVue,
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

describe('pas 1, Ouvrir', () => {
  it("est le premier pas, et son écran est l'anecdote", () => {
    const p = neuf();
    expect(currentStep(p)?.id).toBe('ouvrir');
    expect(currentStep(p)?.go).toBe('anec');
  });

  it("une fois l'anecdote vue, le pas est fait et le chemin avance", () => {
    const p = markDone(neuf(), 0, JOUR);
    expect(p.done[0]).toBe(true);
    expect(currentStep(p)?.id).toBe('echauffer');
    expect(allDone(p)).toBe(false);
  });

  it('le rattrapage ne passe pas par Ouvrir', () => {
    const p: Progress = { ...neuf(), catchup: true, due: 40 };
    expect(currentStep(p)?.id).toBe('reviser');
    expect(currentStep(p)?.go).toBe('rev');
  });

  it('la journée finie, il n’y a plus de pas courant', () => {
    let p = neuf();
    for (let i = 0; i < steps(p).length; i++) p = markDone(p, i, JOUR);
    expect(currentStep(p)).toBeNull();
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

describe('pas 3, Apprendre', () => {
  const BRIQUE = '主';

  it("s'ouvre sur la brique, puis le tracé, puis le composé", () => {
    let p = neuf();
    expect(p.learn).toBe('brique');
    expect(learnNext(p, BRIQUE)).toBe('trace');
    p = setLearnView(p, 'trace');
    expect(learnNext(p, BRIQUE)).toBe('compose');
    p = setLearnView(p, 'compose');
    expect(learnNext(p, BRIQUE)).toBeNull();
  });

  it('reprend la vue exacte après un rechargement', () => {
    let p = markDone(markDone(neuf(), 0, JOUR), 1, JOUR);
    p = setLearnView(p, 'compose');
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.learn).toBe('compose');
    expect(steps(relu)[nextIndex(relu)].id).toBe('apprendre');
  });

  it('propose le tracé une seule fois par brique', () => {
    let p = neuf();
    expect(traceProposee(p, BRIQUE)).toBe(true);
    p = traceVue(p, BRIQUE);
    expect(traceProposee(p, BRIQUE)).toBe(false);
    expect(learnNext(p, BRIQUE)).toBe('compose');
    expect(traceProposee(p, '王')).toBe(true);
    expect(traceVue(p, BRIQUE).tracees).toEqual([BRIQUE]);
  });

  it('se souvient du réglage « ne plus proposer le tracé »', () => {
    const p = setTrace(neuf(), false);
    expect(traceProposee(p, BRIQUE)).toBe(false);
    expect(learnNext(p, BRIQUE)).toBe('compose');
    expect(fromJSON(toJSON(p), JOUR).trace).toBe(false);
    expect(traceProposee(setTrace(p, true), BRIQUE)).toBe(true);
  });

  it('le pas fait, Utiliser devient le pas courant', () => {
    let p = markDone(markDone(neuf(), 0, JOUR), 1, JOUR);
    expect(currentStep(p)?.id).toBe('apprendre');
    expect(currentStep(p)?.go).toBe('learn');
    p = setLearnView(markDone(p, 2, JOUR), 'brique');
    expect(currentStep(p)?.id).toBe('utiliser');
    expect(p.learn).toBe('brique');
  });

  it('repart de la brique à la journée suivante et à la session suivante', () => {
    const p = setLearnView(neuf(), 'compose');
    expect(openDay(p, '2026-03-03').learn).toBe('brique');
    expect(resetDay(p).learn).toBe('brique');
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

  it('relit un export plus ancien, sans les champs du pas Apprendre', () => {
    const ancien = JSON.stringify({ version: 1, day: JOUR, done: [true], budget: 10, days: 3 });
    const p = fromJSON(ancien, JOUR);
    expect(p.learn).toBe('brique');
    expect(p.trace).toBe(true);
    expect(p.tracees).toEqual([]);
  });

  it('ignore une vue ou une liste de briques aberrantes', () => {
    const cassé = JSON.stringify({ ...neuf(), learn: 'ailleurs', tracees: [1, '主'] });
    const p = fromJSON(cassé, JOUR);
    expect(p.learn).toBe('brique');
    expect(p.tracees).toEqual(['主']);
  });
});
