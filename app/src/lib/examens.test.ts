/**
 * Les examens 科举 et les 月课 (story 8.2, brief §8) : une règle par test. Quel examen est à
 * passer, dans quel ordre, la pause des briques, la notation à quatre sur cinq (huit sur dix,
 * quatre sur cinq : « 10 et 5 »), la seconde chance, la reprise
 * sur l'autre série une fois les manqués revus à leur échéance, le titre « points ET
 * examen », les nominations, la progression et son export, et rien qui lise une durée.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import {
  bilan,
  briquesEnPause,
  cheminDesExamens,
  commencer,
  corriger,
  etatExamensVide,
  examenOuvert,
  issue,
  lireEtatExamens,
  lireExamensDonnees,
  lusPourExamens,
  migrerRangsAnnonces,
  ouvrirExamen,
  peutPasser,
  questionsPosables,
  rangAccorde,
  avancer,
  dateDuBang,
  decouperLigne,
  essayer,
  examensPassables,
  genresDe,
  manquesDetailles,
  morceaux,
  prochainATitre,
  questionFinie,
  questionsDe,
  rangsPosables,
  titreAvec,
  reprisePermise,
  resteAuRangSuivant,
  reussite,
  serieDeTentative,
  situation,
  terminer,
  texteExamen,
  type EtatExamens,
  type QuestionExamen,
  type ExamensDonnees
} from './examens';
import { lireHerosDonnees } from './heros';
import { caracteresLus } from './foret';
import { grade, newCard, schedule, type ReviewCard } from './srs';
import type { Famille } from './content';

const JOUR = '2026-09-28';
const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Le vrai `examens.json` de l'export versionné. */
const DONNEES: ExamensDonnees = lireExamensDonnees(JSON.parse(source('../../public/data/0.1.0/examens.json')) as unknown);
const LISTE = DONNEES.examens;
/** Les vrais rangs du personnage, leurs seuils de points. */
const RANGS = lireHerosDonnees(JSON.parse(source('../../public/data/0.1.0/heros.json')) as unknown).rangs;
const rang = (hz: string): number => RANGS.findIndex((r) => r.hz === hz);

function reussis(...ids: string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [id, JOUR]));
}

/** Les examens de la liste jusqu'à `id` compris, tous réussis. */
function jusqua(id: string): Record<string, string> {
  const i = LISTE.findIndex((e) => e.id === id);
  return reussis(...LISTE.slice(0, i + 1).map((e) => e.id));
}

function etat(e: Partial<EtatExamens> = {}): EtatExamens {
  return { ...etatExamensVide(), ...e };
}

/** Une question à quatre choix, la bonne au rang 0, portée par `porte`. */
function question(porte: readonly string[], type: QuestionExamen['type'] = 'comprendre'): QuestionExamen {
  const choix = type === 'vrai_faux' ? [] : [{ fr: 'a', en: 'a' }, { fr: 'b', en: 'b' }, { fr: 'c', en: 'c' }, { fr: 'd', en: 'd' }];
  return { type, support: 's1', consigne: { fr: '?', en: '?' }, choix, reponse: type === 'vrai_faux' ? true : 0, porte: [...porte], caracteres: [...porte] };
}

/** Répond à la question `i` du premier coup, juste ou faux, puis passe à la suivante. */
function repondre(s: EtatExamens, i: number, juste: boolean, porte: readonly string[]): EtatExamens {
  return avancer(essayer(s, i, question(porte), juste ? 0 : 1).etat, i);
}

/** Une tentative manquée du 县试, les caractères 门 et 口 manqués, échouée à `echec`. */
function manquee(echec: Date): EtatExamens {
  let s = commencer(etat({ ouvert: 'xianshi' }), LISTE[0], 'lire');
  for (let i = 0; i < 10; i++) s = repondre(s, i, i >= 3, i < 3 ? ['门', '口'] : []);
  return terminer(s, 10, echec, JOUR).etat;
}

/** Une carte révisée : une erreur à l'examen, puis les réponses données. */
function carte(id: string, echec: Date, reponses: { at: Date; juste: boolean }[]): ReviewCard {
  let k = schedule(newCard(id, new Date('2026-09-01T08:00:00Z')), issue(true), new Date('2026-09-01T08:00:00Z')).card;
  k = schedule(k, issue(false), echec).card;
  for (const r of reponses) k = schedule(k, { correct: r.juste, tries: 0, seconds: 3 }, r.at).card;
  return k;
}

describe('le contenu', () => {
  it('lit les trente-sept examens, les nominations et la règle de l’export', () => {
    expect(LISTE).toHaveLength(37);
    expect(LISTE.filter((e) => e.sorte === 'yueke')).toHaveLength(31);
    expect(LISTE.filter((e) => e.sorte === 'titre').map((e) => [e.hz, e.palier])).toEqual([
      ['县试', 50],
      ['府试', 100],
      ['院试', 200],
      ['乡试', 255],
      ['会试', 505],
      ['殿试', 805]
    ]);
    expect(DONNEES.nominations.map((n) => [n.rang, n.palier])).toEqual([
      ['翰林', 1000],
      ['探花', 1200],
      ['榜眼', 1555],
      ['状元', 1800]
    ]);
    expect(DONNEES.regle).toEqual({ justes: 4, sur: 5 });
  });

  it('porte deux séries du 县试 et du 月课 de 75 sur chaque chemin, dix et cinq questions (« 10 et 5 »)', () => {
    for (const chemin of ['lire', 'hsk'] as const) {
      const [xianshi, yueke] = DONNEES.parcours[chemin];
      expect([xianshi.examen, yueke.examen]).toEqual(['xianshi', 'yueke-75']);
      expect(xianshi.series.A?.questions).toHaveLength(10);
      expect(xianshi.series.B?.questions).toHaveLength(10);
      expect(yueke.series.A?.questions).toHaveLength(5);
      expect(yueke.series.B?.questions).toHaveLength(5);
    }
    expect(DONNEES.parcours.lire[0].jour).toBe(25);
    expect(LISTE.map((e) => e.questions).slice(0, 2)).toEqual([10, 5]);
  });

  it('porte les noms inventés du 放榜 des seuls examens à titre, écrits avec l’acquis', () => {
    expect(DONNEES.parcours.lire[0].noms).toEqual(['王大明', '古天生', '王子如', '明心', '山今', '王友生']);
    expect(DONNEES.parcours.hsk[0].noms.length).toBeGreaterThanOrEqual(4);
    expect(DONNEES.parcours.lire[1].noms).toEqual([]);
  });

  it('ne passe que les examens dont les deux séries sont écrites, dans l’ordre', () => {
    expect(examensPassables(DONNEES, 'lire').map((e) => e.id)).toEqual(['xianshi', 'yueke-75']);
    expect(examensPassables(DONNEES, 'hsk').map((e) => e.id)).toEqual(['xianshi', 'yueke-75']);
    const sansB = { ...DONNEES, parcours: { ...DONNEES.parcours, lire: DONNEES.parcours.lire.map((x) => (x.examen === 'xianshi' ? { ...x, series: { A: x.series.A } } : x)) } };
    expect(examensPassables(sansB, 'lire')).toEqual([]);
  });

  it('ne dessine aucun nom sans ses traits : chaque caractère des noms a sa famille', () => {
    for (const c of '县试府院乡会殿月课') expect(DONNEES.racines[c], c).toBeTruthy();
  });

  it('écarte un examen mal formé et arrête la liste à un palier qui ne croît pas', () => {
    const d = lireExamensDonnees({
      examens: [
        { id: 'a', sorte: 'titre', hz: '县试', palier: 50, questions: 10 },
        { id: 'b', sorte: 'autre', hz: '?', palier: 60, questions: 10 },
        { id: 'c', sorte: 'yueke', hz: '月课', palier: 40, questions: 10 },
        { id: 'd', sorte: 'yueke', hz: '月课', palier: 90, questions: 10 }
      ]
    });
    expect(d.examens.map((e) => e.id)).toEqual(['a']);
    expect(lireExamensDonnees(null)).toEqual({ ...lireExamensDonnees({}), regle: { justes: 4, sur: 5 } });
  });

  it('remplit les lignes de l’écran depuis l’export', () => {
    expect(texteExamen(DONNEES, 'constat', { justes: 9, questions: 10 })).toBe('9 sur 10 du premier coup.');
    expect(texteExamen(DONNEES, 'recu', { examen: '县试' })).toBe('Reçu au 县试.');
    expect(texteExamen(DONNEES, 'pas_encore')).toBe('Pas encore.');
    expect(texteExamen(DONNEES, 'attente')).toBe("L'examen se repasse quand les caractères manqués sont revus.");
  });
});

describe('quel examen est à passer', () => {
  it('s’ouvre au palier de caractères lus, pas avant', () => {
    expect(examenOuvert(LISTE, etat(), 49)).toBeNull();
    expect(examenOuvert(LISTE, etat(), 50)?.hz).toBe('县试');
  });

  it('compte les lus comme le trophée Lire, au seuil de stabilité de Ma forêt', () => {
    const familles = [{ racine: { c: '人' }, fiches: [{ c: '大' }, { c: '天' }] }] as unknown as Famille[];
    const stable = (id: string, s: number): ReviewCard => {
      const k = newCard(id, new Date(0));
      return { ...k, card: { ...k.card, stability: s } };
    };
    const cartes = [stable('人', 30), stable('大', 2), stable('天', 7)];
    expect(lusPourExamens(familles, cartes)).toBe(caracteresLus(familles, cartes));
    expect(lusPourExamens(familles, cartes)).toBe(2);
  });

  it('se passe dans l’ordre : le suivant attend le précédent, même si son palier est atteint', () => {
    expect(examenOuvert(LISTE, etat(), 120)?.id).toBe('xianshi');
    expect(examenOuvert(LISTE, etat({ reussis: reussis('xianshi') }), 120)?.id).toBe('yueke-75');
    expect(examenOuvert(LISTE, etat({ reussis: reussis('xianshi') }), 60)).toBeNull();
  });

  it('reste ouvert une fois le palier atteint, même si le compte des lus redescend', () => {
    const e = ouvrirExamen(LISTE, etat(), 50);
    expect(e.ouvert).toBe('xianshi');
    expect(examenOuvert(LISTE, e, 47)?.id).toBe('xianshi');
    expect(ouvrirExamen(LISTE, e, 50)).toBe(e);
  });

  it('met les briques en pause tant qu’un examen est à passer ou manqué, jamais après sa réussite', () => {
    expect(briquesEnPause(LISTE, etat(), 49)).toBe(false);
    expect(briquesEnPause(LISTE, etat(), 50)).toBe(true);
    expect(briquesEnPause(LISTE, manquee(new Date('2026-09-28T18:00:00Z')), 50)).toBe(true);
    expect(briquesEnPause(LISTE, etat({ reussis: reussis('xianshi') }), 60)).toBe(false);
  });

  it('ne s’arrête plus au bout de la liste', () => {
    const tous = reussis(...LISTE.map((e) => e.id));
    expect(examenOuvert(LISTE, etat({ reussis: tous }), 5000)).toBeNull();
  });

  it('suit « Lire » au parcours « Voyager »', () => {
    expect([cheminDesExamens('voyage'), cheminDesExamens('lire'), cheminDesExamens('hsk'), cheminDesExamens(null)]).toEqual([
      'lire',
      'lire',
      'hsk',
      'lire'
    ]);
  });
});

describe('quand on le passe', () => {
  const faite = { journeeFaite: true, rattrapage: false };

  it('hors session, la journée faite, jamais en rattrapage', () => {
    const s = situation(LISTE, etat(), 50, []);
    expect(s.etat).toBe('a_passer');
    expect(peutPasser(s, faite)).toBe(true);
    expect(peutPasser(s, { journeeFaite: false, rattrapage: false })).toBe(false);
    expect(peutPasser(s, { journeeFaite: true, rattrapage: true })).toBe(false);
    expect(peutPasser(situation(LISTE, etat(), 10, []), faite)).toBe(false);
  });

  it('« Quitter » reprend la même tentative à la même question', () => {
    let s = commencer(etat({ ouvert: 'xianshi' }), LISTE[0], 'lire');
    s = repondre(s, 0, true, ['朋']);
    s = repondre(s, 1, false, ['生', '日']);
    const repris = commencer(s, LISTE[0], 'lire');
    expect(repris).toBe(s);
    expect(repris.tentative?.i).toBe(2);
    expect(situation(LISTE, repris, 50, []).etat).toBe('en_cours');
  });

  it('ne note pas deux fois la même question, ni hors d’une tentative', () => {
    let s = commencer(etat(), LISTE[0], 'lire');
    s = repondre(s, 0, false, ['门']);
    expect(essayer(s, 0, question(['门']), 0).nouveau).toBe(false);
    expect(essayer(etat(), 0, question(['门']), 0).etat).toEqual(etat());
    expect(s.tentative?.manques).toEqual(['门']);
  });

  it('une seconde chance : rattrapée, la question donne son point, pas le premier coup', () => {
    const q = question(['门', '口']);
    let s = commencer(etat(), LISTE[0], 'lire');
    const faux = essayer(s, 0, q, 2);
    expect(faux).toMatchObject({ nouveau: true, juste: false, premier: true, rattrapee: false });
    s = faux.etat;
    expect(questionFinie(q, s.tentative!.essais)).toBe(false);
    expect(essayer(s, 0, q, 2).nouveau).toBe(false);
    const juste = essayer(s, 0, q, 0);
    expect(juste).toMatchObject({ nouveau: true, juste: true, premier: false, rattrapee: true });
    s = juste.etat;
    expect(s.tentative).toMatchObject({ reponses: [false], rattrapees: 1, manques: ['门', '口'], essais: [2, 0] });
    expect(questionFinie(q, s.tentative!.essais)).toBe(true);
    expect(essayer(s, 0, q, 1).nouveau).toBe(false);
  });

  it('au vrai ou faux, la réponse se montre sans second essai', () => {
    const q = question(['门'], 'vrai_faux');
    const s = essayer(commencer(etat(), LISTE[0], 'lire'), 0, q, false).etat;
    expect(questionFinie(q, s.tentative!.essais)).toBe(true);
    expect(essayer(s, 0, q, true).nouveau).toBe(false);
  });

  it('« Quitter » entre deux essais reprend à la même question, ses essais compris', () => {
    const q = question(['门']);
    let s = commencer(etat(), LISTE[0], 'lire', [0, 2, 4]);
    s = essayer(s, 0, q, 3).etat;
    const relue = lireEtatExamens(JSON.parse(JSON.stringify(s)));
    expect(relue.tentative).toMatchObject({ i: 0, essais: [3], reponses: [false], poses: [0, 2, 4] });
    expect(avancer(relue, 0).tentative).toMatchObject({ i: 1, essais: [] });
    expect(avancer(commencer(etat(), LISTE[0], 'lire'), 0)).toEqual(commencer(etat(), LISTE[0], 'lire'));
  });

  it('corrige sans auto-évaluation : le rang du choix, ou vrai ou faux', () => {
    const [q] = DONNEES.parcours.lire[0].series.A!.questions.filter((x) => x.type === 'comprendre');
    expect(corriger(q, q.reponse)).toBe(true);
    expect(corriger(q, ((q.reponse as number) + 1) % 4)).toBe(false);
    const vf = DONNEES.parcours.lire[0].series.A!.questions.find((x) => x.type === 'vrai_faux')!;
    expect(corriger(vf, vf.reponse)).toBe(true);
    expect(corriger(vf, !vf.reponse)).toBe(false);
  });

  it('note une bonne réponse Bien et une erreur Oublié, sans chronomètre', () => {
    expect(grade(issue(true))).toBe(Rating.Good);
    expect(grade(issue(false))).toBe(Rating.Again);
  });

  it('ne garde que les questions dont chaque caractère a une carte', () => {
    const serie = DONNEES.parcours.lire[0].series.A!;
    const tous = new Set(serie.questions.flatMap((q) => q.caracteres));
    expect(questionsPosables(serie, tous)).toHaveLength(10);
    tous.delete('古');
    expect(questionsPosables(serie, tous).length).toBeLessThan(10);
    const rangs = rangsPosables(serie, tous);
    const t = commencer(etat(), LISTE[0], 'lire', rangs).tentative!;
    expect(questionsDe(serie, t)).toEqual(questionsPosables(serie, tous));
  });
});

describe('le résultat', () => {
  it('reçoit à quatre réponses sur cinq justes du premier essai : 8 sur 10, 4 sur 5', () => {
    expect([reussite(5), reussite(10)]).toEqual([4, 8]);
    expect(bilan(Array(5).fill(true).fill(false, 0, 1), 5).recu).toBe(true);
    expect(bilan(Array(5).fill(true).fill(false, 0, 2), 5).recu).toBe(false);
    expect(bilan(Array(10).fill(true).fill(false, 0, 2), 10).recu).toBe(true);
    expect(bilan(Array(10).fill(true).fill(false, 0, 3), 10).recu).toBe(false);
  });

  it('reçu : l’examen est noté réussi à sa journée, et la pause se lève', () => {
    let s = commencer(etat({ ouvert: 'xianshi' }), LISTE[0], 'lire');
    for (let i = 0; i < 10; i++) s = repondre(s, i, i !== 0, ['门']);
    const { etat: fin, bilan: b } = terminer(s, 10, new Date('2026-09-28T18:00:00Z'), JOUR);
    expect(b).toEqual({ justes: 9, questions: 10, reussite: 8, recu: true, rattrapees: 0 });
    expect(fin.reussis).toEqual({ xianshi: JOUR });
    expect(fin.ouvert).toBeNull();
    expect(fin.tentative).toBeNull();
    expect(briquesEnPause(LISTE, fin, 60)).toBe(false);
  });

  it('pas encore : l’échec est noté avec les caractères manqués, rien d’autre n’est perdu', () => {
    const s = manquee(new Date('2026-09-28T18:00:00Z'));
    expect(s.tentative?.echec).toBe('2026-09-28T18:00:00.000Z');
    expect(s.tentative?.manques).toEqual(['门', '口']);
    expect(s.reussis).toEqual({});
  });
});

describe('ce que l’écran montre', () => {
  it('nomme chaque caractère manqué avec le support où on l’a croisé', () => {
    const serie = DONNEES.parcours.lire[0].series.A!;
    let s = commencer(etat(), LISTE[0], 'lire');
    s = avancer(essayer(s, 0, serie.questions[0], 3).etat, 0);
    s = avancer(essayer(s, 1, serie.questions[1], ((serie.questions[1].reponse as number) + 1) % 4).etat, 1);
    const m = manquesDetailles(serie, s.tentative!);
    expect(m.map((x) => x.c)).toEqual([...serie.questions[0].porte, ...serie.questions[1].porte]);
    expect(m[0].support).toBeNull();
    expect(m[m.length - 1].support?.id).toBe(serie.questions[1].support);
  });

  it('annonce l’examen à titre suivant, et le titre que le 县试 donne avec le 府试', () => {
    expect(prochainATitre(LISTE, 'xianshi')?.hz).toBe('府试');
    expect(prochainATitre(LISTE, 'yueke-75')?.hz).toBe('府试');
    expect(titreAvec(LISTE, LISTE[0])?.titre).toBe('童生');
    expect(titreAvec(LISTE, LISTE[2])).toBeNull();
  });

  it('découpe une ligne du support pour le repérage : les mots proposés se touchent', () => {
    expect(decouperLigne('明天一早，门口见！', ['门口', '明天', '一早', '生日'])).toEqual([
      { t: '明天', mot: 1 },
      { t: '一早', mot: 2 },
      { t: '，', mot: -1 },
      { t: '门口', mot: 0 },
      { t: '见', mot: -1 },
      { t: '！', mot: -1 }
    ]);
    expect(decouperLigne('星期二', ['星期', '星期二'])).toEqual([{ t: '星期二', mot: 1 }]);
  });

  it('dit les genres des supports, le gras par paires, et la date du 放榜 en chiffres chinois', () => {
    expect(genresDe(DONNEES.parcours.lire[0].series.A!).length).toBeGreaterThanOrEqual(3);
    expect(morceaux('Reçu à **8 justes sur 10** du premier coup.')).toEqual([
      { t: 'Reçu à ', gras: false },
      { t: '8 justes sur 10', gras: true },
      { t: ' du premier coup.', gras: false }
    ]);
    expect([dateDuBang('2026-09-29'), dateDuBang('2026-10-08'), dateDuBang('2026-12-20')]).toEqual(['九月二十九日', '十月八日', '十二月二十日']);
  });
});

describe('la reprise', () => {
  const echec = new Date('2026-09-28T18:00:00Z');

  it('attend que chaque caractère manqué soit revu juste', () => {
    const s = manquee(echec);
    const cartes = [carte('门', echec, []), carte('口', echec, [])];
    expect(reprisePermise(s.tentative!, cartes)).toBe(false);
    expect(situation(LISTE, s, 50, cartes).etat).toBe('attente');
    expect(peutPasser(situation(LISTE, s, 50, cartes), { journeeFaite: true, rattrapage: false })).toBe(false);
  });

  it('une réponse fausse ou revue avant l’échéance ne compte pas', () => {
    const s = manquee(echec);
    const avant = new Date(echec.getTime() + 60_000);
    const cartes = [
      carte('门', echec, [{ at: new Date('2026-09-29T08:00:00Z'), juste: false }]),
      carte('口', echec, [{ at: avant, juste: true }])
    ];
    expect(reprisePermise(s.tentative!, cartes)).toBe(false);
  });

  it('se permet quand chacun a été revu juste à son échéance, et prend l’autre série', () => {
    const s = manquee(echec);
    const lendemain = new Date('2026-09-29T08:00:00Z');
    const cartes = [carte('门', echec, [{ at: lendemain, juste: true }]), carte('口', echec, [{ at: lendemain, juste: true }])];
    expect(reprisePermise(s.tentative!, cartes)).toBe(true);
    expect(situation(LISTE, s, 50, cartes).etat).toBe('a_repasser');
    const reprise = commencer(s, LISTE[0], 'lire');
    expect(reprise.tentative).toMatchObject({ serie: 'B', numero: 1, i: 0, reponses: [], manques: [], echec: null });
    expect([serieDeTentative(0), serieDeTentative(1), serieDeTentative(2)]).toEqual(['A', 'B', 'A']);
  });

  it('un caractère manqué sans carte ne retient pas l’examen', () => {
    const s = manquee(echec);
    const lendemain = new Date('2026-09-29T08:00:00Z');
    expect(reprisePermise(s.tentative!, [carte('门', echec, [{ at: lendemain, juste: true }])])).toBe(true);
  });
});

describe('les rangs : points ET examen', () => {
  const d = DONNEES;

  it('un titre d’examen attend l’examen réussi, quels que soient les points', () => {
    expect(rangAccorde(5000, RANGS, d, {}, 2000)).toBe(rang('学童'));
    expect(rangAccorde(5000, RANGS, d, reussis('xianshi'), 2000)).toBe(rang('学童'));
    expect(rangAccorde(5000, RANGS, d, reussis('xianshi', 'fushi'), 2000)).toBe(rang('童生'));
  });

  it('un examen réussi attend les points', () => {
    expect(rangAccorde(60, RANGS, d, jusqua('dianshi'), 2000)).toBe(rang('童生'));
    expect(resteAuRangSuivant(60, RANGS, d, jusqua('dianshi'), 2000)).toEqual({ attend: 'points', manque: 20 });
  });

  it('dit l’examen qui reste quand les points y sont', () => {
    const r = resteAuRangSuivant(100, RANGS, d, reussis('xianshi', 'fushi'), 150);
    expect(r).toMatchObject({ attend: 'examen', examen: { hz: '院试' } });
  });

  it('les quatre derniers rangs sont des nominations, à leur palier de caractères lus', () => {
    const tous = jusqua('dianshi');
    expect(rangAccorde(5000, RANGS, d, tous, 999)).toBe(rang('进士'));
    expect(rangAccorde(5000, RANGS, d, tous, 1000)).toBe(rang('翰林'));
    expect(rangAccorde(5000, RANGS, d, tous, 1799)).toBe(rang('榜眼'));
    expect(rangAccorde(5000, RANGS, d, tous, 1800)).toBe(rang('状元'));
    expect(resteAuRangSuivant(5000, RANGS, d, tous, 1100)).toEqual({ attend: 'palier', palier: 1200 });
  });

  it('un 月课 ne donne ni ne retient aucun rang', () => {
    const sansYueke = reussis(...LISTE.filter((e) => e.sorte === 'titre').map((e) => e.id));
    expect(rangAccorde(5000, RANGS, d, sansYueke, 1800)).toBe(rang('状元'));
    expect(rangAccorde(10, RANGS, d, jusqua('yueke-75'), 75)).toBe(rang('蒙童'));
  });

  it('les rangs s’accordent dans l’ordre, sans en sauter un', () => {
    const sansFushi = { ...jusqua('dianshi') };
    delete sansFushi.fushi;
    expect(rangAccorde(5000, RANGS, d, sansFushi, 2000)).toBe(rang('学童'));
  });
});

describe('la progression', () => {
  it('un état neuf n’a rien de réussi et rien à reporter ; absent, les rangs sont à reporter', () => {
    expect(etatExamensVide()).toEqual({ reussis: {}, ouvert: null, tentative: null, migre: true });
    expect(lireEtatExamens(undefined)).toEqual({ reussis: {}, ouvert: null, tentative: null, migre: false });
  });

  it('écarte une entrée aberrante', () => {
    expect(
      lireEtatExamens({ reussis: { xianshi: 'hier', fushi: JOUR }, ouvert: 3, tentative: { examen: 'x', chemin: 'mars', serie: 'A' } })
    ).toEqual({ reussis: { fushi: JOUR }, ouvert: null, tentative: null, migre: true });
  });

  it('une progression d’avant les examens garde ses rangs annoncés : les examens en dessous sont reçus', () => {
    const avant = lireEtatExamens(undefined);
    const e = migrerRangsAnnonces(avant, rang('秀才'), RANGS, LISTE, JOUR);
    expect(e.reussis).toEqual(reussis('xianshi', 'yueke-75', 'fushi', 'yueke-150', 'yuanshi'));
    expect(e.migre).toBe(true);
    expect(examenOuvert(LISTE, e, 260)?.hz).toBe('乡试');
    expect(migrerRangsAnnonces(e, rang('状元'), RANGS, LISTE, JOUR)).toBe(e);
    expect(migrerRangsAnnonces(lireEtatExamens(undefined), rang('学童'), RANGS, LISTE, JOUR).reussis).toEqual({});
  });
});

describe('rien ne lit une durée', () => {
  it('le module ne lit ni l’horloge ni le hasard', () => {
    const code = source('./examens.ts');
    expect(code).not.toMatch(/Date\.now|new Date\(\)|Math\.random|performance\.now/);
    expect(code).not.toMatch(/seconds\s*[<>]/);
  });
});
