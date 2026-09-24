import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  REGLAGES_RETENTION,
  basculerJournee,
  effetRetention,
  setRetention,
  srsParams,
  noterJourTravaille,
  CARTES_PAR_BLOC,
  ajouterCartes,
  STEP_ORDER,
  SEUIL_ABSENCE,
  PILE_REDESCENDUE,
  CARTES_PAR_SEANCE,
  allDone,
  assurerCartes,
  carte,
  cartesDues,
  echeance,
  faitPasCourant,
  finApprendre,
  finEchauffer,
  finFixer,
  finUtiliser,
  nombreDues,
  repriseFix,
  repriseRev,
  setFixNotee,
  setRevNotee,
  planifierCarte,
  setRev,
  setRevue,
  budgetNewBricks,
  catchupSteps,
  cartesAOuvrir,
  repartirBlocs,
  currentStep,
  dayLabel,
  emptyProgress,
  fromJSON,
  jourParcours,
  guide,
  learnNext,
  markDone,
  nextIndex,
  openDay,
  resetDay,
  setDue,
  setFix,
  setLearnView,
  setTrace,
  setUseView,
  steps,
  contesLus,
  devinettesResolues,
  noterConteLu,
  noterDevinette,
  noterTrophees,
  traceAchevee,
  traceProposee,
  traceVue,
  title,
  setJourParcours,
  toJSON,
  useNext,
  bilan,
  constat,
  noterActivite,
  noterRevision,
  rendezVous,
  type Progress,
  type Revision
} from './session';
import { journal, taoVide } from './tao';
import {
  RETENTION_DEFAUT,
  RETENTION_MAX,
  RETENTION_MIN,
  RETOUR_MINUTES,
  grade,
  isNew,
  newCard,
  schedule,
  stability
} from './srs';
import { planifier } from './jeux';

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

  it("le bloc ouvert prend exactement le nombre de cartes que le chemin annonce", () => {
    /* 20 cartes : deux blocs de 10. L'écran en posait 15 après en avoir annoncé 10. */
    expect(repartirBlocs(20)).toEqual([10, 10]);
    const p: Progress = { ...neuf(), catchup: true, due: 20 };
    expect(catchupSteps(20)[0].d).toBe(`${cartesAOuvrir(p)} cartes, les plus urgentes`);
    expect(cartesAOuvrir(p)).toBe(10);
  });

  it('hors rattrapage, la séance en prend quatorze, comme annoncé', () => {
    expect(cartesAOuvrir({ ...neuf(), due: 41 })).toBe(CARTES_PAR_SEANCE);
  });
});

describe('la pile due vient des cartes', () => {
  const T0 = new Date('2026-03-06T08:00:00Z');
  /** `n` cartes neuves, toutes dues depuis un moment. */
  const pile = (n: number): Progress => ({
    ...neuf(),
    cartes: Array.from({ length: n }, (_, k) =>
      newCard(`c${k}`, new Date(T0.getTime() - (n - k) * 60_000))
    )
  });

  it('compte toutes les cartes dues, sans le plafond de la séance', () => {
    const p = pile(41);
    expect(cartesDues(p, T0)).toHaveLength(CARTES_PAR_SEANCE);
    expect(nombreDues(p, T0)).toBe(41);
    expect(nombreDues(neuf(), T0)).toBe(0);
  });

  it('ouvre le rattrapage sur la pile réelle après une absence, et pas avant', () => {
    const retour = '2026-03-06';
    let p: Progress = { ...pile(41), lastWorked: '2026-03-02' };
    p = openDay(p, retour);
    /* Sans recompte, la progression relue croit la pile vide : aucun rattrapage. */
    expect(p.catchup).toBe(false);
    p = setDue(p, nombreDues(p, T0), retour);
    expect(p.due).toBe(41);
    expect(p.catchup).toBe(true);
    expect(currentStep(p)?.id).toBe('reviser');
  });

  it('sort du rattrapage dès que la pile est redescendue', () => {
    const retour = '2026-03-06';
    let p = setDue(openDay({ ...pile(41), lastWorked: '2026-03-02' }, retour), 41, retour);
    expect(p.catchup).toBe(true);
    p = markDone(p, 0, retour);
    /* Le bloc fait : les cartes révisées ne sont plus dues, la pile redescend. */
    for (const c of p.cartes.slice(0, 30).map((x) => x.id)) {
      p = planifierCarte(p, c, { correct: true, tries: 0, seconds: 2 }, T0);
    }
    expect(nombreDues(p, T0)).toBe(11);
    p = setDue(p, nombreDues(p, T0), retour);
    expect(p.catchup).toBe(false);
    expect(p.done).toEqual([]);
    expect(steps(p).map((s) => s.id)).toEqual([...STEP_ORDER]);
  });

  it("n'annonce jamais plus de cartes que la séance n'en absorbe", () => {
    const echauffer = (due: number) => steps({ ...neuf(), due })[1].d;
    expect(echauffer(0)).toBe('Les révisions dues');
    expect(echauffer(5)).toBe('5 cartes en questions');
    expect(echauffer(41)).toBe(`${CARTES_PAR_SEANCE} cartes en questions`);
  });

  it("ne promet jamais plus d'un bloc de cinq minutes par bloc", () => {
    const blocs = catchupSteps(90).filter((s) => s.go);
    expect(blocs).toHaveLength(3);
    expect(blocs.map((s) => s.d)).toEqual([
      `${CARTES_PAR_BLOC} cartes, les plus urgentes`,
      `${CARTES_PAR_BLOC} cartes`,
      `${CARTES_PAR_BLOC} cartes`
    ]);
  });

  it('la séance finie, la pile se vide : le bloc suivant tire des cartes fraîches', () => {
    let p = setRev(setRevue(markDone(neuf(), 0, '2026-03-06'), ['c0', 'c1']), 1);
    p = finEchauffer(p, '2026-03-06');
    expect(p.revue).toEqual([]);
    expect(p.rev).toBe(0);
    expect(p.done[1]).toBe(true);
  });

  it('la vérification finie repart à zéro, et rien ne bouge la journée finie', () => {
    let p = neuf();
    [0, 1, 2, 3].forEach((i) => {
      p = markDone(p, i, JOUR);
    });
    p = finFixer(setFix(p, 2), JOUR);
    expect(p.fix).toBe(0);
    expect(currentStep(p)?.id).toBe('clore');
    p = markDone(p, 5, JOUR);
    expect(faitPasCourant(p, JOUR)).toBe(p);
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
  it('se reconnaît, et ne repart de zéro qu’au changement de jour', () => {
    let p = neuf();
    steps(p).forEach((_, i) => {
      p = markDone(p, i, JOUR);
    });
    expect(allDone(p)).toBe(true);
    expect(title(p)).toBe("C'est fait pour aujourd'hui");
    /* Même journée : rien ne la remet à zéro. Le lendemain, `openDay` passe par `resetDay`. */
    expect(openDay(p, JOUR)).toBe(p);
    const demain = openDay(p, '2026-03-03');
    expect(demain).toEqual({ ...resetDay(p), day: '2026-03-03', catchup: false });
    expect(nextIndex(demain)).toBe(0);
    expect(demain.days).toBe(1);
  });
});

describe('les cartes de révision', () => {
  const T0 = new Date('2026-03-02T08:00:00Z');
  const juste = { correct: true, tries: 0, seconds: 2 };
  const faux = { correct: false, tries: 2, seconds: 12 };

  it('la fin du pas Apprendre donne une carte neuve à la brique et au composé', () => {
    const p = assurerCartes(neuf(), ['主', '住'], T0);
    expect(p.cartes.map((c) => c.id)).toEqual(['主', '住']);
    expect(p.cartes.every(isNew)).toBe(true);
    /* Une carte neuve est due tout de suite : elle sera révisée dès la prochaine séance. */
    expect(cartesDues(p, T0).map((c) => c.id)).toEqual(['主', '住']);
  });

  it('ne redonne jamais de carte à un caractère qui en a déjà une', () => {
    const p = assurerCartes(neuf(), ['主'], T0);
    const encore = assurerCartes(p, ['主', '住'], new Date('2026-03-03T08:00:00Z'));
    expect(encore.cartes).toHaveLength(2);
    expect(carte(encore, '主')).toBe(carte(p, '主'));
  });

  it('chaque réponse reprogramme la carte par FSRS', () => {
    let p = assurerCartes(neuf(), ['住'], T0);
    p = planifierCarte(p, '住', juste, T0);
    const c = carte(p, '住');
    expect(c?.history).toHaveLength(1);
    expect(c?.history[0].rating).toBe(grade(juste));
    expect(stability(c!)).toBeGreaterThan(0);
    const quand = echeance(p, '住');
    expect(quand!.getTime()).toBeGreaterThan(T0.getTime());
    /* Replanifiée, la carte n'est plus due : elle sort de la pile du jour. */
    expect(cartesDues(p, T0)).toEqual([]);
  });

  it('faux deux fois : la réponse est montrée, la carte revient dans dix minutes', () => {
    let p = assurerCartes(neuf(), ['住'], T0);
    p = planifierCarte(p, '住', faux, T0);
    expect(echeance(p, '住')?.getTime()).toBe(T0.getTime() + RETOUR_MINUTES * 60_000);
  });

  it('note une réponse même sans carte : elle est créée à la volée', () => {
    const p = planifierCarte(neuf(), '天', juste, T0);
    expect(p.cartes.map((c) => c.id)).toEqual(['天']);
    expect(carte(p, '天')?.history).toHaveLength(1);
  });
});

describe('pas 2, Échauffer', () => {
  const T0 = new Date('2026-03-02T08:00:00Z');
  /** Des cartes dues, de la plus en retard à la plus récente. */
  const pile = (n: number): Progress => ({
    ...neuf(),
    cartes: Array.from({ length: n }, (_, k) =>
      newCard(`c${k}`, new Date(T0.getTime() - (n - k) * 60_000))
    )
  });

  it('ne propose que les cartes dues, la plus en retard devant', () => {
    const p: Progress = {
      ...neuf(),
      cartes: [
        newCard('après-demain', new Date('2026-03-04T08:00:00Z')),
        newCard('hier', new Date('2026-03-01T08:00:00Z')),
        newCard('ce matin', T0)
      ]
    };
    expect(cartesDues(p, T0).map((c) => c.id)).toEqual(['hier', 'ce matin']);
  });

  it("ne dépasse pas les quatorze cartes d'une séance", () => {
    const p = pile(20);
    expect(CARTES_PAR_SEANCE).toBe(14);
    const dues = cartesDues(p, T0);
    expect(dues).toHaveLength(14);
    expect(dues[0].id).toBe('c0');
    expect(dues[13].id).toBe('c13');
  });

  it('fige la pile de la séance et reprend à la question exacte', () => {
    let p = markDone(pile(3), 0, JOUR);
    p = setRevue(
      p,
      cartesDues(p, T0).map((c) => c.id)
    );
    p = planifierCarte(p, 'c0', { correct: true, tries: 0, seconds: 2 }, T0);
    p = setRev(p, 1);
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.rev).toBe(1);
    /* La carte répondue n'est plus due, mais la pile ne bouge pas : même question au retour. */
    expect(relu.revue).toEqual(['c0', 'c1', 'c2']);
    expect(steps(relu)[nextIndex(relu)].id).toBe('echauffer');
  });

  it('repart à zéro à la journée suivante, les cartes restent', () => {
    let p = setRev(setRevue(pile(2), ['c0', 'c1']), 1);
    p = openDay(p, '2026-03-03');
    expect(p.rev).toBe(0);
    expect(p.revue).toEqual([]);
    expect(p.cartes).toHaveLength(2);
  });

  it('une question négative ou décimale retombe sur une question entière', () => {
    expect(setRev(neuf(), -2).rev).toBe(0);
    expect(setRev(neuf(), 2.7).rev).toBe(2);
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

describe('la leçon du jour entre dans le journal de Tao', () => {
  const T0 = new Date('2026-03-02T08:00:00Z');

  it('le pas Apprendre note la brique apprise, et le constat du soir la dit', () => {
    let p = markDone(markDone(neuf(), 0, JOUR), 1, JOUR);
    expect(currentStep(p)?.id).toBe('apprendre');
    p = finApprendre(p, JOUR, T0, ['主', '住']);
    expect(currentStep(p)?.id).toBe('utiliser');
    /* Ce qui vient d'être appris entre en révision : une carte neuve par caractère. */
    expect(p.cartes.map((c) => c.id)).toEqual(['主', '住']);
    expect(p.learn).toBe('brique');
    expect(p.tao.activites).toEqual([{ jour: JOUR, type: 'lecon' }]);
    expect(constat(p, JOUR)).toBe("Aujourd'hui, une brique apprise.");
  });

  it('le pas Utiliser note la lecture, comme avant', () => {
    let p = neuf();
    [0, 1, 2].forEach((i) => {
      p = markDone(p, i, JOUR);
    });
    p = finUtiliser(setUseView(p, 'texte'), JOUR);
    expect(currentStep(p)?.id).toBe('fixer');
    expect(p.use).toBe('mots');
    expect(p.tao.activites).toEqual([{ jour: JOUR, type: 'lecture' }]);
  });
});

describe('pas 4, Utiliser', () => {
  it("s'ouvre sur les mots et la phrase, puis sur les trois lignes à lire", () => {
    let p = neuf();
    expect(p.use).toBe('mots');
    expect(useNext(p)).toBe('texte');
    p = setUseView(p, 'texte');
    expect(useNext(p)).toBeNull();
  });

  it('reprend la vue exacte après un rechargement', () => {
    let p = neuf();
    [0, 1, 2].forEach((i) => {
      p = markDone(p, i, JOUR);
    });
    p = setUseView(p, 'texte');
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.use).toBe('texte');
    expect(steps(relu)[nextIndex(relu)].id).toBe('utiliser');
  });

  it('repart des mots à la journée suivante et à la session suivante', () => {
    const p = setUseView(neuf(), 'texte');
    expect(openDay(p, '2026-03-03').use).toBe('mots');
    expect(resetDay(p).use).toBe('mots');
  });
});

describe('pas 5, Fixer', () => {
  const juste: Revision = { c: '住', correct: true, tries: 0, seconds: 3 };
  const hesite: Revision = { c: '主', correct: true, tries: 1, seconds: 9 };
  const faux: Revision = { c: '住', correct: false, tries: 2, seconds: 12 };

  it('range chaque réponse en événement de révision', () => {
    let p = noterRevision(neuf(), JOUR, juste);
    p = noterRevision(p, JOUR, faux);
    expect(p.revisions).toEqual([juste, faux]);
    expect(fromJSON(toJSON(p), JOUR).revisions).toEqual([juste, faux]);
  });

  it('note une activité de révision pour Tao par événement', () => {
    let p = neuf();
    [juste, hesite, faux].forEach((r) => {
      p = noterRevision(p, JOUR, r);
    });
    expect(p.tao.activites).toEqual([
      { jour: JOUR, type: 'revision' },
      { jour: JOUR, type: 'revision' },
      { jour: JOUR, type: 'revision' }
    ]);
    expect(p.tao.croissance).toBe(3);
  });

  it('compte les questions posées et celles sues du premier coup', () => {
    let p = neuf();
    [juste, hesite, faux].forEach((r) => {
      p = noterRevision(p, JOUR, r);
    });
    expect(bilan(p)).toEqual({ questions: 3, sures: 1 });
  });

  it('reprend à la question exacte après un rechargement', () => {
    let p = neuf();
    [0, 1, 2, 3].forEach((i) => {
      p = markDone(p, i, JOUR);
    });
    p = setFix(noterRevision(p, JOUR, juste), 1);
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.fix).toBe(1);
    expect(steps(relu)[nextIndex(relu)].id).toBe('fixer');
  });

  it('repart de la première question à la journée suivante', () => {
    const p = setFix(noterRevision(neuf(), JOUR, juste), 2);
    const demain = openDay(p, '2026-03-03');
    expect(demain.fix).toBe(0);
    expect(demain.revisions).toEqual([]);
    /* Tao, elle, garde le journal : la croissance ne redescend jamais. */
    expect(demain.tao.activites).toHaveLength(1);
  });
});

describe('pas 6, Clore', () => {
  it('constate la journée avec ses nombres réels, dans la forme du journal', () => {
    let p = noterActivite(neuf(), JOUR, 'anecdote');
    p = noterActivite(p, JOUR, 'lecture');
    [1, 2, 3].forEach(() => {
      p = noterRevision(p, JOUR, { c: '住', correct: true, tries: 0, seconds: 2 });
    });
    expect(constat(p, JOUR)).toBe("Aujourd'hui, un texte lu, 3 cartes révisées, une anecdote.");
    expect(constat(p, JOUR)).toBe(journal(p.tao.activites, JOUR));
  });

  it('ne dit ni bravo ni reproche, même une journée vide', () => {
    const p = neuf();
    expect(constat(p, JOUR)).toBe("Aujourd'hui, rien de noté.");
    expect(constat(p, JOUR)).not.toMatch(/bravo|félicit/i);
  });

  it('donne le rendez-vous de demain, sans heure', () => {
    expect(rendezVous()).toBe('On te le remontre demain.');
    expect(rendezVous()).not.toMatch(/matin|soir|\d/);
  });
});

describe('Utiliser, Fixer, Clore, puis la journée finie', () => {
  it("s'enchaînent dans l'ordre et ferment la journée", () => {
    let p = neuf();
    [0, 1, 2].forEach((i) => {
      p = markDone(p, i, JOUR);
    });

    expect(currentStep(p)?.id).toBe('utiliser');
    expect(currentStep(p)?.go).toBe('use');
    p = setUseView(p, 'texte');
    p = noterActivite(markDone(p, 3, JOUR), JOUR, 'lecture');
    p = setUseView(p, 'mots');

    expect(currentStep(p)?.id).toBe('fixer');
    expect(currentStep(p)?.go).toBe('check');
    p = noterRevision(p, JOUR, { c: '住', correct: true, tries: 0, seconds: 4 });
    p = setFix(markDone(p, 4, JOUR), 0);

    expect(currentStep(p)?.id).toBe('clore');
    expect(currentStep(p)?.go).toBe('close');
    expect(constat(p, JOUR)).toBe("Aujourd'hui, un texte lu, une carte révisée.");

    p = markDone(p, 5, JOUR);
    expect(allDone(p)).toBe(true);
    expect(title(p)).toBe("C'est fait pour aujourd'hui");
    expect(guide(p)).toContain('Rendez-vous demain');
  });
});

describe('une session à cheval sur minuit', () => {
  const VEILLE = '2026-03-02';
  const LENDEMAIN = '2026-03-03';
  /** 23 h 50 la veille, puis 0 h 10 le lendemain : l'horloge passe minuit entre deux pas. */
  const AVANT = new Date('2026-03-02T23:50:00');
  const APRES = new Date('2026-03-03T00:10:00');

  /** Ouvrir, Échauffer et Apprendre faits avant minuit, sur le jour de la session. */
  function commenceeLaVeille(): Progress {
    let p = emptyProgress(VEILLE);
    p = noterActivite(faitPasCourant(p, p.day), p.day, 'anecdote');
    p = finEchauffer(p, p.day);
    p = finApprendre(p, p.day, AVANT, ['主', '住']);
    return p;
  }

  it('reste sur sa journée : la bascule attend la clôture', () => {
    const p = commenceeLaVeille();
    expect(currentStep(p)?.id).toBe('utiliser');
    /* Retour au chemin après minuit, session en cours : rien ne bascule. */
    expect(basculerJournee(p, LENDEMAIN)).toBe(p);
  });

  it('range sur le jour de la session les activités d’une session close après minuit', () => {
    let p = commenceeLaVeille();
    /* Après minuit : Utiliser, Fixer, Clore notent sur `p.day`, jamais sur l'horloge. */
    p = finUtiliser(p, p.day);
    p = noterRevision(p, p.day, { c: '住', correct: true, tries: 0, seconds: 3 });
    p = planifierCarte(p, '住', { correct: true, tries: 0, seconds: 3 }, APRES);
    p = finFixer(p, p.day);
    expect(currentStep(p)?.id).toBe('clore');
    /* L'écran Clore lit `constat(p, p.day)` : la journée de la session, entière. */
    expect(constat(p, p.day)).toBe(
      "Aujourd'hui, une brique apprise, un texte lu, une carte révisée, une anecdote."
    );
    p = noterJourTravaille(faitPasCourant(p, p.day), p.day);

    expect(allDone(p)).toBe(true);
    expect(p.day).toBe(VEILLE);
    expect(p.lastWorked).toBe(VEILLE);
    expect(p.joursTravailles).toEqual([VEILLE]);
    expect(p.tao.activites.every((a) => a.jour === VEILLE)).toBe(true);
    expect(constat(p, LENDEMAIN)).toBe("Aujourd'hui, rien de noté.");
    /* La planification FSRS, elle, suit l'instant réel. */
    expect(echeance(p, '住')!.getTime()).toBeGreaterThan(APRES.getTime());
  });

  it('bascule au retour au chemin, une fois la session close', () => {
    let p = commenceeLaVeille();
    p = finFixer(finUtiliser(p, p.day), p.day);
    p = noterJourTravaille(faitPasCourant(p, p.day), p.day);
    const demain = basculerJournee(p, LENDEMAIN);
    expect(demain.day).toBe(LENDEMAIN);
    expect(demain.done).toEqual([]);
    expect(currentStep(demain)?.id).toBe('ouvrir');
    /* Rien de ce qui a été rangé la veille ne bouge. */
    expect(demain.joursTravailles).toEqual([VEILLE]);
    expect(demain.tao).toEqual(p.tao);
    /* Même journée : rien à faire. Aucune session commencée : la bascule est libre. */
    expect(basculerJournee(demain, LENDEMAIN)).toBe(demain);
    expect(basculerJournee(emptyProgress(VEILLE), LENDEMAIN).day).toBe(LENDEMAIN);
  });

  it("l'aiguillage note sur `p.day` et ne bascule qu'au menu", () => {
    const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
    /* Aucune note ne prend l'horloge pour jour : `today()` ne sert qu'à la bascule. */
    expect(app).not.toMatch(/\(p, today\(\)/);
    expect(app).not.toContain('jour={today()}');
    expect(app).toContain('basculerJournee(p, jour)');
    expect(app).toContain("addEventListener('visibilitychange'");
    /* Un seul retour au menu, `allerAuMenu`, et il bascule. */
    expect(app.match(/ecran = 'menu'/g)).toHaveLength(1);
    expect(app).toMatch(/ecran = 'menu';\s*basculer\(\);/);
  });
});

describe('une question notée ne se repose pas', () => {
  it('la reprise saute la question déjà répondue, à Échauffer comme à Fixer', () => {
    let p = setRevue(neuf(), ['c0', 'c1', 'c2']);
    expect(repriseRev(p)).toBe(0);
    /* Répondu à la question 0, puis quitté avant l'avance automatique : `rev` vaut encore 0. */
    p = setRevNotee(p, 0);
    expect(p.rev).toBe(0);
    expect(repriseRev(p)).toBe(1);
    /* Le repère ne recule jamais : une question notée reste notée. */
    p = setRev(p, 1);
    expect(repriseRev(p)).toBe(1);
    expect(setRevNotee(p, 0).revNotee).toBe(0);

    let q = setFixNotee(neuf(), 1);
    expect(repriseFix(q)).toBe(2);
    q = openDay(q, '2026-03-03');
    expect(q.fixNotee).toBe(-1);
    expect(repriseFix(q)).toBe(0);
    expect(repriseRev(resetDay(setRevNotee(neuf(), 2)))).toBe(0);
  });

  it('la séance et la vérification finies remettent le repère à zéro', () => {
    let p = markDone(neuf(), 0, JOUR);
    p = finEchauffer(setRevNotee(setRevue(p, ['c0']), 0), JOUR);
    expect(p.revNotee).toBe(-1);
    let q = neuf();
    [0, 1, 2, 3].forEach((i) => {
      q = markDone(q, i, JOUR);
    });
    q = finFixer(setFixNotee(q, 2), JOUR);
    expect(q.fixNotee).toBe(-1);
  });

  it("garde le repère à l'aller-retour, et le relit d'un export plus ancien", () => {
    const p = setFixNotee(setRevNotee(neuf(), 1), 0);
    expect(fromJSON(toJSON(p), JOUR)).toEqual(p);
    const ancien = JSON.stringify({ version: 1, day: JOUR, done: [true], budget: 10 });
    expect(fromJSON(ancien, JOUR).revNotee).toBe(-1);
    expect(fromJSON(ancien, JOUR).fixNotee).toBe(-1);
    expect(fromJSON(JSON.stringify({ ...neuf(), revNotee: 'oui' }), JOUR).revNotee).toBe(-1);
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

  it('relit un export plus ancien, sans les champs des pas Utiliser et Fixer', () => {
    const ancien = JSON.stringify({ version: 1, day: JOUR, done: [true], budget: 10, days: 3 });
    const p = fromJSON(ancien, JOUR);
    expect(p.use).toBe('mots');
    expect(p.fix).toBe(0);
    expect(p.revisions).toEqual([]);
  });

  it('écarte une vue, une question ou une révision aberrantes', () => {
    const cassé = JSON.stringify({
      ...neuf(),
      use: 'ailleurs',
      fix: -3,
      revisions: [{ c: '住', correct: true, tries: 1, seconds: 4 }, { tries: 2 }, 'rien']
    });
    const p = fromJSON(cassé, JOUR);
    expect(p.use).toBe('mots');
    expect(p.fix).toBe(0);
    expect(p.revisions).toEqual([{ c: '住', correct: true, tries: 1, seconds: 4 }]);
  });

  it('ignore une vue ou une liste de briques aberrantes', () => {
    const cassé = JSON.stringify({ ...neuf(), learn: 'ailleurs', tracees: [1, '主'] });
    const p = fromJSON(cassé, JOUR);
    expect(p.learn).toBe('brique');
    expect(p.tracees).toEqual(['主']);
  });

  it("garde les cartes et la pile de la séance à l'aller-retour", () => {
    const T0 = new Date('2026-03-02T08:00:00Z');
    let p = assurerCartes(neuf(), ['主', '住'], T0);
    p = planifierCarte(p, '主', { correct: true, tries: 0, seconds: 2 }, T0);
    p = setRev(setRevue(p, ['主', '住']), 1);
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu).toEqual(p);
    expect(echeance(relu, '主')).toEqual(echeance(p, '主'));
  });

  it('relit un export plus ancien, sans cartes ni pile de séance', () => {
    const ancien = JSON.stringify({ version: 1, day: JOUR, done: [true], budget: 10, days: 3 });
    const p = fromJSON(ancien, JOUR);
    expect(p.cartes).toEqual([]);
    expect(p.revue).toEqual([]);
    expect(p.rev).toBe(0);
  });

  it('écarte des cartes illisibles sans casser la session', () => {
    const cassé = JSON.stringify({ ...neuf(), cartes: { version: 9, cards: 'rien' }, revue: [1, '主'] });
    const p = fromJSON(cassé, JOUR);
    expect(p.cartes).toEqual([]);
    expect(p.revue).toEqual(['主']);
  });

  it('relit une progression exportée avant Tao', () => {
    const avant = JSON.stringify({ version: 1, day: JOUR, done: [true], catchup: false, budget: 10, due: 3, days: 4 });
    const p = fromJSON(avant, JOUR);
    expect(p.tao).toEqual(taoVide());
    expect(p.days).toBe(4);
  });

  it("garde les activités de Tao à l'aller-retour", () => {
    const p = noterActivite(neuf(), JOUR, 'anecdote');
    expect(p.tao.activites).toEqual([{ jour: JOUR, type: 'anecdote' }]);
    expect(fromJSON(toJSON(p), JOUR)).toEqual(p);
  });
});

describe('le jour du parcours', () => {
  it("suit les journées travaillées tant que rien n'est rangé", () => {
    const p = neuf();
    expect(jourParcours(p)).toBe(1);
    expect(jourParcours({ ...p, days: 7 })).toBe(7);
  });

  it("prend l'index rangé dans la progression quand il y est", () => {
    const p = setJourParcours({ ...neuf(), days: 7 }, 12);
    expect(p.jourParcours).toBe(12);
    expect(jourParcours(p)).toBe(12);
  });

  it('ne descend jamais sous le premier jour', () => {
    expect(jourParcours(setJourParcours(neuf(), 0))).toBe(1);
    expect(jourParcours({ ...neuf(), days: 0 })).toBe(1);
  });

  it('se relit à l’aller-retour, et se passe d’un export plus ancien', () => {
    const p = setJourParcours({ ...neuf(), days: 3 }, 9);
    expect(fromJSON(toJSON(p), JOUR).jourParcours).toBe(9);
    const avant = JSON.stringify({ version: 1, day: JOUR, days: 5, lastWorked: JOUR });
    const relu = fromJSON(avant, JOUR);
    expect(relu.jourParcours).toBeUndefined();
    expect(jourParcours(relu)).toBe(5);
  });
});

describe('une seule aide pour donner une carte neuve', () => {
  it('`ajouterCartes` et `assurerCartes` sont la même fonction', () => {
    const T0 = new Date('2026-03-02T08:00:00Z');
    expect(ajouterCartes).toBe(assurerCartes);
    const p = ajouterCartes(neuf(), ['人', '', '人'], T0);
    expect(p.cartes.map((c) => c.id)).toEqual(['人']);
    expect(ajouterCartes(p, ['人'], T0)).toBe(p);
  });
});

describe('la rétention cible, réglable (brief §7)', () => {
  const T0 = new Date('2026-03-02T08:00:00Z');
  const BIEN = { correct: true, tries: 0, seconds: 8 };
  const JOUR_MS = 86_400_000;

  /** Une carte vue une fois, puis revue juste à son échéance : l'intervalle suivant compte. */
  function echeanceA(retention: number): Date {
    let p = setRetention(neuf(), retention);
    p = planifierCarte(p, '住', BIEN, T0);
    const revue = echeance(p, '住')!;
    p = planifierCarte(p, '住', BIEN, revue);
    return echeance(p, '住')!;
  }

  it('vaut 0,9 par défaut, et reste dans ses bornes', () => {
    expect(neuf().retention).toBe(RETENTION_DEFAUT);
    expect(RETENTION_DEFAUT).toBe(0.9);
    expect(setRetention(neuf(), 0.5).retention).toBe(RETENTION_MIN);
    expect(setRetention(neuf(), 0.999).retention).toBe(RETENTION_MAX);
    expect(setRetention(neuf(), 0.95).retention).toBe(0.95);
    expect([RETENTION_MIN, RETENTION_MAX]).toEqual([0.8, 0.97]);
  });

  it('est passée à FSRS : une rétention plus haute donne une échéance plus proche', () => {
    const serree = echeanceA(0.95);
    const equilibree = echeanceA(0.9);
    const lache = echeanceA(0.85);
    expect(serree.getTime()).toBeLessThan(equilibree.getTime());
    expect(equilibree.getTime()).toBeLessThan(lache.getTime());
    expect((lache.getTime() - serree.getTime()) / JOUR_MS).toBeGreaterThan(1);
  });

  it('planifie exactement ce que `schedule` rend à cette rétention', () => {
    const p = setRetention(neuf(), 0.95);
    expect(srsParams(p)).toEqual({ retention: 0.95 });
    const attendu = schedule(newCard('住', T0), BIEN, T0, { retention: 0.95 }).due;
    expect(echeance(planifierCarte(p, '住', BIEN, T0), '住')).toEqual(attendu);
    /* Un paramètre explicite passe devant le réglage. */
    const force = planifierCarte(p, '住', BIEN, T0, { retention: 0.85 });
    expect(echeance(force, '住')).toEqual(schedule(newCard('住', T0), BIEN, T0, { retention: 0.85 }).due);
  });

  it('les jeux planifient à la même rétention que les questions', () => {
    const p = setRetention(neuf(), 0.95);
    const r: Revision = { c: '日', ...BIEN };
    const parJeu = planifier(p.cartes, r, T0, srsParams(p));
    expect(parJeu[0].card.due).toEqual(echeance(planifierCarte(p, '日', r, T0), '日'));
    const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
    expect(app).toContain('planifier(p.cartes, r, new Date(), srsParams(p))');
  });

  it("s'exporte, se réimporte, et se relit au défaut d'un export plus ancien", () => {
    const p = setRetention(neuf(), 0.85);
    expect(fromJSON(toJSON(p), JOUR).retention).toBe(0.85);
    const ancien = JSON.stringify({ version: 1, day: JOUR, done: [true], budget: 10, days: 3 });
    expect(fromJSON(ancien, JOUR).retention).toBe(RETENTION_DEFAUT);
    expect(fromJSON(JSON.stringify({ ...p, retention: 0.2 }), JOUR).retention).toBe(RETENTION_MIN);
    expect(fromJSON(JSON.stringify({ ...p, retention: 'haute' }), JOUR).retention).toBe(RETENTION_DEFAUT);
  });

  it('se règle en trois positions nommées sans jargon, avec une ligne qui dit l’effet', () => {
    expect(REGLAGES_RETENTION.map((r) => r.t)).toEqual([
      'Plus de révisions',
      'Équilibré',
      'Moins de révisions'
    ]);
    expect(REGLAGES_RETENTION.map((r) => r.retention)).toEqual([0.95, 0.9, 0.85]);
    for (const r of REGLAGES_RETENTION) {
      expect(setRetention(neuf(), r.retention).retention).toBe(r.retention);
      expect(`${r.t} ${effetRetention(r.retention)}`).not.toMatch(/rétention|FSRS|stabilit|%/i);
    }
    expect(effetRetention(0.95)).toContain('95 chances sur 100');
    const reglages = readFileSync(new URL('Settings.svelte', import.meta.url), 'utf8');
    expect(reglages).toContain('REGLAGES_RETENTION');
    expect(reglages).toContain('effetRetention(p.retention)');
  });
});

/* ---------- le suivi des trophées ---------- */

/**
 * Une progression telle qu'une version plus ancienne l'a rangée : sans aucun des champs
 * du suivi des trophées. Les cartes y sont comme IndexedDB les rend, dates en objets.
 */
function progressionAncienne(): Record<string, unknown> {
  const T0 = new Date('2026-03-02T08:00:00Z');
  let p = assurerCartes({ ...neuf(), premiere: false, lastWorked: JOUR }, ['天', '夫'], T0);
  p = planifierCarte(p, '天', { correct: false, tries: 2, seconds: 5 }, T0);
  p = traceVue(p, '人');
  const o: Record<string, unknown> = { ...p };
  delete o.tracesAchevees;
  delete o.tropheesAcquis;
  delete o.devinettes;
  delete o.contesLus;
  return o;
}

describe('le suivi des trophées dans la progression', () => {
  it('note un tracé achevé, une fois par brique, et pas un tracé seulement proposé', () => {
    let p = traceVue(neuf(), '人');
    expect(p.tracesAchevees).toEqual([]);
    p = traceAchevee(p, '人');
    p = traceAchevee(p, '人');
    p = traceAchevee(p, '大');
    expect(p.tracesAchevees).toEqual(['人', '大']);
    expect(traceAchevee(p, '人')).toBe(p);
    expect(fromJSON(toJSON(p), JOUR).tracesAchevees).toEqual(['人', '大']);
  });

  it('relit une progression plus ancienne sans rien perdre, depuis un export comme depuis IndexedDB', () => {
    const ancien = progressionAncienne();
    const avant = fromJSON(JSON.stringify({ ...ancien, tracesAchevees: [], tropheesAcquis: {}, devinettes: [], contesLus: {} }), JOUR);
    for (const texte of [
      /* L'export JSON : les cartes dans leur enveloppe de `srs.ts`. */
      toJSON(ancien as unknown as Progress),
      /* IndexedDB : l'objet rangé tel quel, relu par `loadProgress`. */
      JSON.stringify(ancien)
    ]) {
      expect(texte).not.toContain('tracesAchevees');
      expect(texte).not.toContain('tropheesAcquis');
      expect(texte).not.toMatch(/devinettes|contesLus/);
      const p = fromJSON(texte, JOUR);
      /* Rien n'est déduit des tracés proposés : le pinceau ne s'estime pas. */
      expect(p.tracees).toEqual(['人']);
      expect(p.tracesAchevees).toEqual([]);
      expect(p.tropheesAcquis).toEqual({});
      expect(p.devinettes).toEqual([]);
      expect(p.contesLus).toEqual({});
      expect(p.cartes).toEqual(avant.cartes);
      expect(p).toEqual(avant);
    }
  });

  it('garde le leurre pris dans l’événement de révision et dans la carte', () => {
    const T0 = new Date('2026-03-02T08:00:00Z');
    const r: Revision = { c: '天', correct: false, tries: 2, seconds: 5, leurres: ['夫'] };
    let p = planifierCarte(assurerCartes(neuf(), ['天'], T0), r.c, r, T0);
    p = noterRevision(p, JOUR, r);
    expect(carte(p, '天')?.history[0].leurres).toEqual(['夫']);
    for (const texte of [toJSON(p), JSON.stringify(p)]) {
      const relu = fromJSON(texte, JOUR);
      expect(relu.revisions).toEqual([r]);
      expect(carte(relu, '天')?.history[0].leurres).toEqual(['夫']);
    }
    /* Un événement d'avant le suivi se relit sans leurre : rien n'est deviné. */
    const ancien = fromJSON(JSON.stringify(progressionAncienne()), JOUR);
    expect(carte(ancien, '天')?.history[0].leurres).toBeUndefined();
    const vieux = fromJSON(JSON.stringify({ ...neuf(), revisions: [{ c: '天', correct: false, tries: 2, seconds: 5 }] }), JOUR);
    expect('leurres' in vieux.revisions[0]).toBe(false);
  });

  it('garde les trophées obtenus et leur date, sans jamais la repousser', () => {
    let p = noterTrophees(neuf(), ['lire-10', 'piege-天夫'], JOUR);
    expect(p.tropheesAcquis).toEqual({ 'lire-10': JOUR, 'piege-天夫': JOUR });
    p = noterTrophees(p, ['lire-10', 'lire-50'], '2026-03-09');
    expect(p.tropheesAcquis).toEqual({ 'lire-10': JOUR, 'piege-天夫': JOUR, 'lire-50': '2026-03-09' });
    expect(noterTrophees(p, ['lire-10'], '2026-04-01')).toBe(p);
    for (const texte of [toJSON(p), JSON.stringify(p)]) {
      expect(fromJSON(texte, JOUR).tropheesAcquis).toEqual(p.tropheesAcquis);
    }
  });

  it('compte les devinettes résolues, chacune une fois', () => {
    let p = noterDevinette(neuf(), 'gao');
    p = noterDevinette(p, 'gao');
    p = noterDevinette(p, 'ming');
    expect(p.devinettes).toEqual(['gao', 'ming']);
    expect(devinettesResolues(p)).toBe(2);
    expect(noterDevinette(p, '')).toBe(p);
    expect(fromJSON(toJSON(p), JOUR).devinettes).toEqual(['gao', 'ming']);
  });

  it('compte les contes lus, une fois par conte et par seuil', () => {
    let p = noterConteLu(neuf(), 'lievre', 405);
    p = noterConteLu(p, 'lievre', 255);
    p = noterConteLu(p, 'lievre', 255);
    p = noterConteLu(p, 'grue', 255);
    expect(p.contesLus).toEqual({ lievre: [255, 405], grue: [255] });
    expect(contesLus(p)).toBe(3);
    expect(noterConteLu(p, 'lievre', 0)).toBe(p);
    expect(noterConteLu(p, '', 255)).toBe(p);
    for (const texte of [toJSON(p), JSON.stringify(p)]) {
      expect(fromJSON(texte, JOUR).contesLus).toEqual(p.contesLus);
    }
  });

  it('écarte des entrées de suivi aberrantes', () => {
    const cassé = JSON.stringify({ ...neuf(), tracesAchevees: ['人', 3, '', '人', null, '大'] });
    expect(fromJSON(cassé, JOUR).tracesAchevees).toEqual(['人', '大']);
    const leurres = JSON.stringify({
      ...neuf(),
      revisions: [{ c: '天', correct: false, tries: 1, seconds: 2, leurres: ['夫', 3, ''] }]
    });
    expect(fromJSON(leurres, JOUR).revisions[0].leurres).toEqual(['夫']);
    const acquis = JSON.stringify({ ...neuf(), tropheesAcquis: { 'lire-10': JOUR, x: 'hier', y: 3, '': JOUR } });
    expect(fromJSON(acquis, JOUR).tropheesAcquis).toEqual({ 'lire-10': JOUR });
    expect(fromJSON(JSON.stringify({ ...neuf(), tropheesAcquis: ['lire-10'] }), JOUR).tropheesAcquis).toEqual({});
    const contes = JSON.stringify({
      ...neuf(),
      devinettes: ['gao', 4, 'gao'],
      contesLus: { lievre: [405, 255, 255, -1, 'x', 2.5], vide: [], rien: 'x' }
    });
    const relu = fromJSON(contes, JOUR);
    expect(relu.devinettes).toEqual(['gao']);
    expect(relu.contesLus).toEqual({ lievre: [255, 405] });
  });
});
