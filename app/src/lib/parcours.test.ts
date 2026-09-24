/**
 * Le parcours d'une journée : un test par règle produit (menu, enchaînement des pas,
 * une seule fin, session de plus, rattrapage, premier jour).
 */
import { describe, it, expect } from 'vitest';
import {
  anecdoteFaite,
  anecdoteRelue,
  apresSplash,
  caseReviser,
  carteDuMenu,
  coups,
  demarrer,
  ecranSuivant,
  etatMenu,
  finRevisionLibre,
  menu,
  phrasesDeTao,
  traitsDeLAjout,
  versEchauffer
} from './parcours';
import {
  CARTES_PAR_SEANCE,
  allDone,
  cartesAOuvrir,
  cloreSession,
  commencerPlus,
  currentStep,
  emptyProgress,
  finApprendre,
  finDepart,
  finEchauffer,
  finFixer,
  finUtiliser,
  fromJSON,
  jourLecon,
  jourParcours,
  nextIndex,
  openDay,
  peutPlus,
  repriseRev,
  setDue,
  setRev,
  setRevNotee,
  setRevue,
  steps,
  toJSON,
  type Progress
} from './session';

const JOUR = '2026-03-02';
const MAINTENANT = new Date('2026-03-02T08:30:00Z');

/** Une journée ordinaire : la première session est derrière, rien n'est fait aujourd'hui. */
function journee(o: Partial<Progress> = {}): Progress {
  return { ...emptyProgress(JOUR), premiere: false, jourParcours: 4, due: 14, ...o };
}

/** L'ouverture : le logo, puis l'anecdote, qui fait le pas 1. */
function ouverte(o: Partial<Progress> = {}): Progress {
  return anecdoteFaite(journee(o), JOUR);
}

/** La session complète, Échauffer à Clore, par les mêmes transitions que l'app. */
function sessionFaite(p: Progress): Progress {
  let n = finEchauffer(p, JOUR);
  n = finApprendre(n, JOUR, MAINTENANT, ['主', '住']);
  n = finUtiliser(n, JOUR);
  n = finFixer(n, JOUR);
  return cloreSession(n, JOUR);
}

/** Une journée de rattrapage : quatre journées d'absence, 41 cartes dues. */
function rattrapage(): Progress {
  return openDay(journee({ day: '2026-02-20', lastWorked: '2026-02-26', due: 41, days: 11 }), JOUR);
}

describe("l'ouverture : le logo, l'anecdote, puis le menu", () => {
  it("l'anecdote vient après le logo et compte comme le pas 1, Ouvrir", () => {
    const p = journee();
    expect(apresSplash(p)).toBe('anec');
    const vue = anecdoteFaite(p, JOUR);
    expect(vue.done[0]).toBe(true);
    expect(currentStep(vue)?.id).toBe('echauffer');
    /* Rechargée dans la journée, l'app ne remontre pas l'anecdote : elle va au menu. */
    expect(apresSplash(vue)).toBe('menu');
    expect(etatMenu(vue)).toBe('nouvelle');
  });

  it("l'anecdote ne compte qu'une fois dans le journal de Tao", () => {
    const deux = anecdoteFaite(anecdoteFaite(journee(), JOUR), JOUR);
    expect(deux.tao.activites.filter((a) => a.type === 'anecdote')).toHaveLength(1);
  });
});

describe("l'anecdote du jour se relit, depuis Lire ou l'en-tête du menu", () => {
  it('relue après l’ouverture, elle ne change rien à la progression', () => {
    const vue = ouverte();
    expect(anecdoteRelue(vue, JOUR)).toBe(vue);
    /* Même la session avancée ou la journée faite : aucun pas ne bouge, Tao ne note rien. */
    const avancee = finEchauffer(vue, JOUR);
    expect(anecdoteRelue(avancee, JOUR)).toBe(avancee);
    const faite = sessionFaite(vue);
    const relue = anecdoteRelue(anecdoteRelue(faite, JOUR), JOUR);
    expect(relue).toBe(faite);
    expect(relue.tao.activites.filter((a) => a.type === 'anecdote')).toHaveLength(1);
  });

  it("relue en rattrapage, elle ne compte pas pour un bloc", () => {
    const vue = anecdoteFaite(rattrapage(), JOUR);
    expect(anecdoteRelue(vue, JOUR)).toBe(vue);
  });

  it("pas encore vue, elle compte une fois, comme à l'ouverture", () => {
    const p = journee();
    const lue = anecdoteRelue(p, JOUR);
    expect(lue).toEqual(anecdoteFaite(p, JOUR));
    expect(currentStep(lue)?.id).toBe('echauffer');
    expect(anecdoteRelue(lue, JOUR)).toBe(lue);
  });

  it('la première session passe avant tout : rien ne se compte', () => {
    const p = { ...journee(), premiere: true };
    expect(anecdoteRelue(p, JOUR)).toBe(p);
  });
});

describe('les pas s’enchaînent sans repasser par le menu', () => {
  it('chaque fin de pas ouvre le pas suivant, Clore seul ramène au menu', () => {
    let p = ouverte();
    expect(demarrer(p, JOUR).ecran).toBe('rev');
    p = finEchauffer(p, JOUR);
    expect(ecranSuivant(p)).toBe('learn');
    p = finApprendre(p, JOUR, MAINTENANT, ['主', '住']);
    expect(ecranSuivant(p)).toBe('use');
    p = finUtiliser(p, JOUR);
    expect(ecranSuivant(p)).toBe('check');
    p = finFixer(p, JOUR);
    expect(ecranSuivant(p)).toBe('close');
    p = cloreSession(p, JOUR);
    expect(ecranSuivant(p)).toBe('menu');
  });
});

describe('« Quitter » garde le pas exact', () => {
  it('le menu propose de reprendre au pas où l’on a quitté', () => {
    /* Échauffer et Apprendre faits, puis « Quitter » : rien d'autre ne bouge. */
    let p = finEchauffer(ouverte(), JOUR);
    p = finApprendre(p, JOUR, MAINTENANT, ['主', '住']);
    const relue = fromJSON(toJSON(p), JOUR);
    expect(currentStep(relue)?.id).toBe('utiliser');
    expect(etatMenu(relue)).toBe('entamee');
    const m = menu(relue);
    expect(m.bouton).toBe('Reprendre au pas 4');
    expect(m.ligne).toBe('Pas 4 sur 6 · Utiliser');
    expect(m.plein).toBe(true);
    expect(demarrer(relue, JOUR).ecran).toBe('use');
  });

  it('quitté au milieu des questions, Échauffer se reprend à la question notée', () => {
    const p = setRevNotee(setRev(setRevue(ouverte(), ['人', '大', '天']), 1), 0);
    const relue = fromJSON(toJSON(p), JOUR);
    expect(menu(relue).bouton).toBe('Reprendre au pas 2');
    expect(repriseRev(relue)).toBe(1);
    expect(demarrer(relue, JOUR).ecran).toBe('rev');
    const bloc = setRevNotee(setRevue(rattrapage(), ['人']), 0);
    expect(menu(bloc).bouton).toBe('Reprendre le bloc 1');
  });
});

describe('une seule fin', () => {
  it('après Clore, la journée est faite et le menu la montre', () => {
    const p = sessionFaite(ouverte());
    expect(allDone(p)).toBe(true);
    expect(etatMenu(p)).toBe('faite');
    expect(menu(p).coups.every((c) => c === 'fait')).toBe(true);
  });
});

describe('travailler plus : une session de plus', () => {
  it('se propose une fois la journée faite, en contour, avec une brique', () => {
    const p = sessionFaite(ouverte());
    expect(peutPlus(p)).toBe(true);
    const m = menu(p);
    expect(m.bouton).toBe('Une session de plus · une brique');
    expect(m.plein).toBe(false);
    expect(m.ligne).toBe('Graine plantée, une seule par jour');
    expect(peutPlus(ouverte())).toBe(false);
  });

  it('compte quatre pas, Apprendre, Utiliser, Fixer, Clore, et la brique suivante', () => {
    const faite = sessionFaite(ouverte({ due: 0 }));
    expect(jourLecon(faite)).toBe(4);
    const r = demarrer(faite, JOUR);
    expect(steps(r.p).map((s) => s.id)).toEqual(['apprendre', 'utiliser', 'fixer', 'clore']);
    expect(r.ecran).toBe('learn');
    /* La brique nouvelle est la suivante du parcours. */
    expect(jourLecon(r.p)).toBe(5);
    expect(etatMenu(r.p)).toBe('plus');
    expect(menu(r.p).ligne).toBe('Pas 1 sur 4 · Apprendre');
  });

  it("passe par Échauffer s'il reste des cartes dues", () => {
    const faite = setDue(sessionFaite(ouverte()), 6, JOUR);
    const r = demarrer(faite, JOUR);
    expect(steps(r.p).map((s) => s.id)).toEqual(['echauffer', 'apprendre', 'utiliser', 'fixer', 'clore']);
    expect(r.ecran).toBe('rev');
  });

  it('ne plante jamais une seconde graine, et le menu garde le compte', () => {
    let p = sessionFaite(ouverte({ due: 0 }));
    expect(p.joursTravailles).toEqual([JOUR]);
    const jours = p.days;
    for (const n of [1, 2]) {
      p = commencerPlus(p);
      p = finApprendre(p, JOUR, MAINTENANT, ['木', '休']);
      p = finUtiliser(p, JOUR);
      p = finFixer(p, JOUR);
      p = cloreSession(p, JOUR);
      expect(p.plus).toBe(n);
      expect(p.joursTravailles).toEqual([JOUR]);
      expect(p.days).toBe(jours);
      expect(etatMenu(p)).toBe('faite');
    }
    expect(menu(p).ligne).toBe('Graine plantée · 2 sessions de plus');
    expect(menu(p).bouton).toBe('Une session de plus · une brique');
  });

  it('se reprend au pas exact, et ne se recommence pas : la journée suivante repart de zéro', () => {
    let p = commencerPlus(sessionFaite(ouverte({ due: 0 })));
    p = finApprendre(p, JOUR, MAINTENANT, ['木', '休']);
    const relue = fromJSON(toJSON(p), JOUR);
    expect(relue.enPlus).toEqual({ echauffer: false });
    expect(menu(relue).bouton).toBe('Reprendre au pas 2');
    const demain = openDay(sessionFaite(ouverte()), '2026-03-03');
    expect(demain.plus).toBe(0);
    expect(demain.enPlus).toBeNull();
    expect(demain.jourAppris).toBeUndefined();
  });
});

describe('pas de session de plus en rattrapage', () => {
  it("le rattrapage fini ne propose qu'une révision, jamais une brique", () => {
    let p = rattrapage();
    expect(p.catchup).toBe(true);
    expect(peutPlus(p)).toBe(false);
    p = { ...p, done: steps(p).map((s) => s.go !== null) };
    expect(allDone(p)).toBe(true);
    expect(peutPlus(p)).toBe(false);
    expect(commencerPlus(p)).toBe(p);
    const r = demarrer(p, JOUR);
    expect(r.ecran).toBe('libre');
    expect(r.p.enPlus).toBeNull();
    expect(menu(p).bouton).not.toMatch(/session de plus|brique/);
  });
});

describe('réviser avant la session', () => {
  it('la case dit « Dans la session » et ouvre la session au pas Échauffer', () => {
    const p = ouverte();
    expect(caseReviser(p)).toEqual({ info: 'Dans la session', action: 'echauffer' });
    /* Même avant l'anecdote : la session s'ouvre à Échauffer. */
    const avant = versEchauffer(journee(), JOUR);
    expect(currentStep(avant)?.id).toBe('echauffer');
    expect(currentStep(versEchauffer(p, JOUR))?.id).toBe('echauffer');
  });

  it('après la session, elle ouvre une révision en plus, qui ne touche à aucun pas', () => {
    const p = sessionFaite(ouverte());
    expect(caseReviser({ ...p, due: 3 })).toEqual({ info: '3 cartes dues', action: 'libre' });
    expect(caseReviser({ ...p, due: 0 })).toEqual({ info: 'À jour, rien de dû', action: 'libre' });
    const fini = finRevisionLibre(setRevue(p, ['人', '大']));
    expect(fini.revue).toEqual([]);
    expect(fini.done).toEqual(p.done);
  });

  it('en rattrapage, elle ouvre le bloc annoncé', () => {
    expect(caseReviser(rattrapage())).toEqual({ info: '41 cartes dues', action: 'bloc' });
  });
});

describe('le premier jour', () => {
  it('arrive au menu en état « fait », la graine du jour plantée', () => {
    let p = emptyProgress(JOUR);
    expect(apresSplash(p)).toBe('premiere');
    expect(etatMenu(p)).toBe('premiere');
    expect(menu(p).bouton).toBe('Reprendre la première session');
    p = finDepart(p, JOUR, MAINTENANT, ['人', '大', '天']);
    expect(apresSplash(p)).toBe('menu');
    expect(etatMenu(p)).toBe('faite');
    expect(p.joursTravailles).toEqual([JOUR]);
    expect(menu(p).ligne).toBe('Graine plantée, une seule par jour');
    /* La session complète commence le lendemain, au premier jour du parcours. */
    const demain = openDay(p, '2026-03-03');
    expect(apresSplash(demain)).toBe('anec');
    expect(jourParcours(demain)).toBe(1);
    expect(steps(demain)).toHaveLength(6);
  });

  it('la carte du menu montre la brique suivante tant que rien n’est appris aujourd’hui', () => {
    const p = finDepart(emptyProgress(JOUR), JOUR, MAINTENANT, ['人', '大', '天']);
    expect(carteDuMenu(p)).toEqual({ source: 'lecon', jour: 1 });
    expect(menu(p).brique).toBe('la brique suivante');
  });
});

describe('le rattrapage : un bloc à la fois', () => {
  it('le bloc annoncé est celui qui s’ouvre', () => {
    let p = rattrapage();
    let m = menu(p);
    expect(m.ligne).toBe(`Bloc 1 · ${cartesAOuvrir(p)} cartes`);
    expect(m.ligne).toBe('Bloc 1 · 14 cartes');
    expect(m.bouton).toBe('Commencer le premier bloc');
    expect(demarrer(p, JOUR).ecran).toBe('rev');
    /* Le premier bloc fait, la pile a baissé : le menu annonce le bloc qui s'ouvrira. */
    p = setDue(finEchauffer(p, JOUR), 27, JOUR);
    expect(p.catchup).toBe(true);
    m = menu(p);
    expect(m.ligne).toBe(`Bloc 2 · ${cartesAOuvrir(p)} cartes`);
    expect(m.bouton).toBe('Commencer le bloc 2');
    /* Chaque bloc ramène au menu, même quand la pile redescend et ferme le rattrapage. */
    expect(ecranSuivant(p, true)).toBe('menu');
    expect(ecranSuivant(setDue(p, 10, JOUR), true)).toBe('menu');
  });

  it('Tao attend en pot, et le message reste neutre, sans compter les jours manqués', () => {
    const p = rattrapage();
    const m = menu(p);
    expect(m.tao.posture).toBe('pot');
    expect(m.surtitre).toBe('Le retour');
    for (const t of [...phrasesDeTao(p), m.ligne, m.bouton]) expect(t).not.toMatch(/jour|manqu|absen/i);
    /* Le bloc commencé, elle sort du pot. */
    expect(menu(finEchauffer(p, JOUR)).tao.posture).toBe('chemin');
  });

  it('un bloc fait plante la graine du jour, une seule, comme un jour ordinaire', () => {
    let p = rattrapage();
    expect(p.joursTravailles).toEqual([]);
    /* L'anecdote ne fait pas un bloc : pas de graine pour elle seule. */
    p = anecdoteFaite(p, JOUR);
    expect(p.joursTravailles).toEqual([]);
    p = setDue(finEchauffer(p, JOUR), 27, JOUR);
    expect(p.joursTravailles).toEqual([JOUR]);
    /* Le deuxième bloc, puis la pile redescendue et la session normale : jamais deux graines. */
    p = setDue(finEchauffer(p, JOUR), 10, JOUR);
    expect(p.catchup).toBe(false);
    expect(p.joursTravailles).toEqual([JOUR]);
    expect(sessionFaite(p).joursTravailles).toEqual([JOUR]);
  });

  it("l'anecdote s'ouvre aussi au retour, sans compter pour un bloc", () => {
    const p = rattrapage();
    expect(apresSplash(p)).toBe('anec');
    const vue = anecdoteFaite(p, JOUR);
    expect(vue.done).toEqual(p.done);
    expect(apresSplash(vue)).toBe('menu');
  });
});

describe('le menu', () => {
  it('annonce le pas et sa durée, et propose un seul bouton plein', () => {
    const m = menu(ouverte());
    expect(m.ligne).toBe('Pas 2 sur 6 · Échauffer');
    expect(m.duree).toBe('3 min');
    expect(m.bouton).toBe('Commencer la session');
    expect(m.plein).toBe(true);
    expect(m.coups).toEqual(['fait', 'encours', 'avenir', 'avenir', 'avenir', 'avenir']);
    expect(m.position).toBe(1);
  });

  it('Tao a une phrase par état, jamais un reproche', () => {
    const p = ouverte();
    expect(phrasesDeTao(p, '住')).toEqual([
      `${CARTES_PAR_SEANCE} cartes à croquer !`,
      'On y va ?',
      "住, on l'apprend ?"
    ]);
    for (const q of [p, sessionFaite(p), rattrapage(), emptyProgress(JOUR)]) {
      const l = phrasesDeTao(q, '住');
      expect(l.length).toBeGreaterThan(0);
      for (const t of l) expect(t).not.toMatch(/dommage|oubli|retard|manqu/i);
    }
  });
});

describe("la barre des pas", () => {
  it('en rattrapage, un coup par bloc ; le premier jour, rien de commencé', () => {
    expect(coups(rattrapage())).toEqual(['encours', 'avenir', 'avenir']);
    expect(coups(emptyProgress(JOUR)).every((c) => c === 'avenir')).toBe(true);
  });
});

describe("l'élément ajouté, trait par trait", () => {
  it('suit les briques dans l’ordre d’écriture : 住 = 亻 + 主, le 主 en cinabre', () => {
    expect(traitsDeLAjout(['亻', '主'], [1], [2, 5], 7)).toEqual([2, 3, 4, 5, 6]);
    expect(traitsDeLAjout(['日', '月'], [0], [4, 4], 8)).toEqual([0, 1, 2, 3]);
  });

  it('ferme l’enceinte après l’intérieur, écrit 辶 en dernier', () => {
    /* 国 : 丨 𠃌, puis 玉, puis le trait qui ferme. */
    expect(traitsDeLAjout(['囗', '玉'], [1], [3, 5], 8)).toEqual([2, 3, 4, 5, 6]);
    expect(traitsDeLAjout(['囗', '口'], [0], [3, 3], 6)).toEqual([0, 1, 5]);
    /* 过 : 寸 d'abord, 辶 ensuite. */
    expect(traitsDeLAjout(['辶', '寸'], [1], [3, 3], 6)).toEqual([0, 1, 2]);
  });

  it('ne peint rien quand le compte ne tombe pas juste ou que l’ordre n’est pas sûr', () => {
    expect(traitsDeLAjout(['亻', '主'], [1], [2, 5], 8)).toEqual([]);
    expect(traitsDeLAjout(['亻', '主'], [1], [2, null], 7)).toEqual([]);
    expect(traitsDeLAjout(['弋', '工'], [1], [3, 3], 6)).toEqual([]);
    expect(traitsDeLAjout(['月'], [0], [4], 4)).toEqual([]);
  });
});

describe('le jour du parcours', () => {
  it("avance à la fin d'Apprendre ; la suite de la session relit la même leçon", () => {
    let p = finEchauffer(ouverte(), JOUR);
    expect(jourLecon(p)).toBe(4);
    p = finApprendre(p, JOUR, MAINTENANT, ['主', '住'], 6);
    expect(jourLecon(p)).toBe(6);
    expect(jourParcours(p)).toBe(7);
    /* Quitter puis revenir le lendemain : la leçon apprise ne se refait pas. */
    const demain = openDay(p, '2026-03-03');
    expect(jourLecon(demain)).toBe(7);
    expect(nextIndex(demain)).toBe(0);
  });
});
