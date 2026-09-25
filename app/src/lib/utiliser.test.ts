import { describe, it, expect } from 'vitest';
import {
  ECLAIR_TOUS_LES,
  MESSAGE_TOUS_LES,
  PREMIER_JOUR_MESSAGE,
  SECONDES_PAS,
  choisirJeu,
  graineUtiliser,
  jourDEclair,
  jourDeMessage,
  offreDuCorpus,
  secondesDuPas,
  tient,
  type Offre
} from './utiliser';
import {
  commencerPlus,
  ecarterReplique,
  emptyProgress,
  finUtiliser,
  fromJSON,
  jeuDuJour,
  markDone,
  nextIndex,
  openDay,
  poserJeuUtiliser,
  rangDuJour,
  repliqueJuste,
  repondreEclair,
  sessionSteps,
  setUseView,
  steps,
  toJSON,
  useNext,
  type Budget,
  type Progress
} from './session';
import { lireEclair, noterMotDevine, tourDuMot } from './eclair';
import { corpusDeJeu, evenementsANoter, postureDuJeu, repondre, type Manche } from './jeux';
import { choisirReplique, filDuDialogue, lireWechat, mancheWechat, toursWechat } from './wechat';
import { SEUIL_DEBLOCAGE } from './srs';

const JOUR = '2026-09-25';

/* ---------- un petit contenu, en dur : aucun réseau, aucun fichier ---------- */

const ECLAIR = lireEclair({
  version: '0.9.0',
  source: 'test',
  mots: [
    { id: '火车', mot: '火车', pinyin: 'huǒchē', fr: 'train', en: 'train', leurres: ['火山', '电车', '汽车'] },
    { id: '火山', mot: '火山', pinyin: 'huǒshān', fr: 'volcan', en: 'volcano', leurres: ['火车', '电车', '汽车'] },
    { id: '电车', mot: '电车', pinyin: 'diànchē', fr: 'tramway', en: 'tram', leurres: ['火车', '火山', '汽车'] },
    { id: '汽车', mot: '汽车', pinyin: 'qìchē', fr: 'voiture', en: 'car', leurres: ['火车', '电车', '火山'] }
  ],
  racines: { 火: '火', 车: '车', 山: '山', 电: '电', 汽: '氵' }
});

const t = (zh: string, syllabes: string[], fr = '') => ({ zh, pinyin: '', fr, en: fr, syllabes });
const echange = (ami: string, juste: string, faux: string, notes: string[]) => ({
  ami: t(ami, [...ami].filter((c) => /\p{Script=Han}/u.test(c)).map(() => 'x')),
  repliques: [
    { ...t(juste, []), juste: true },
    { ...t(faux, []), juste: false, erreur: 'hors-sujet' }
  ],
  notes
});

const WECHAT = lireWechat({
  version: '0.9.0',
  source: 'test',
  ami: { zh: '大明', pinyin: 'Dàmíng', fr: 'ton ami', en: 'your friend' },
  dialogues: [
    {
      id: 'long',
      cle: '早',
      famille: '日',
      fr: 'Trois échanges',
      en: '',
      echanges: [
        echange('早！', '早！', '我喝茶。', ['早']),
        echange('喝茶？', '好，喝茶！', '早！', ['好', '喝', '茶']),
        echange('明天见？', '好，明天见！', '我喝茶。', ['明', '天', '见'])
      ],
      fin: t('好！', ['hǎo']),
      caracteres: ['早', '我', '喝', '茶', '好', '明', '天', '见'],
      jours: { lire: 40 }
    },
    {
      id: 'court',
      cle: '茶',
      famille: '艹',
      fr: 'Deux échanges',
      en: '',
      echanges: [echange('喝茶？', '好，喝茶！', '早！', ['好', '喝', '茶']), echange('早！', '早！', '我喝茶。', ['早'])],
      fin: null,
      caracteres: ['早', '我', '喝', '茶', '好'],
      jours: { lire: 30 }
    }
  ],
  racines: {}
});

const stable = (c: string) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 });
const fragile = (c: string) => ({ c, stabilite: 1 });
const TOUS = ['火', '车', '山', '电', '汽', '早', '我', '喝', '茶', '好', '明', '天', '见'];

function corpus(cartes = TOUS.map(stable)) {
  return corpusDeJeu({ eclair: ECLAIR, wechat: WECHAT, cartes, traits: TOUS, parcours: 'lire' });
}

const PLEINE: Offre = offreDuCorpus(corpus(), []);

/** Une progression arrivée au pas Utiliser, au rang de journée voulu. */
function auPasUtiliser(rang: number, budget: Budget = 10): Progress {
  let p: Progress = { ...emptyProgress(JOUR), premiere: false, budget, days: rang - 1, lastWorked: '2026-09-24' };
  [0, 1, 2].forEach((i) => {
    p = markDone(p, i, JOUR);
  });
  return p;
}

/* ---------- la règle d'insertion ---------- */

describe("la règle d'insertion des jeux au pas Utiliser", () => {
  it('pose le message WeChat à partir du 8e jour, un jour sur trois', () => {
    expect(PREMIER_JOUR_MESSAGE).toBe(8);
    expect(MESSAGE_TOUS_LES).toBe(3);
    const jours = Array.from({ length: 20 }, (_, k) => k + 1).filter(jourDeMessage);
    expect(jours).toEqual([8, 11, 14, 17, 20]);
  });

  it("pose l'éclair un jour sur deux", () => {
    expect(ECLAIR_TOUS_LES).toBe(2);
    const jours = Array.from({ length: 10 }, (_, k) => k + 1).filter(jourDEclair);
    expect(jours).toEqual([2, 4, 6, 8, 10]);
  });

  it('est déterministe : mêmes entrées, même jeu, même mot', () => {
    for (let rang = 1; rang <= 40; rang++) {
      const a = choisirJeu(rang, 10, PLEINE, JOUR);
      const b = choisirJeu(rang, 10, { ...PLEINE }, JOUR);
      expect(a).toEqual(b);
    }
    const eclair = choisirJeu(2, 10, PLEINE, JOUR);
    expect(eclair?.jeu).toBe('eclair');
    expect(PLEINE.mots).toContain(eclair?.id);
  });

  it('ne pose jamais le message avant la 2e semaine', () => {
    for (let rang = 1; rang < PREMIER_JOUR_MESSAGE; rang++) {
      expect(choisirJeu(rang, 20, PLEINE, JOUR)?.jeu).not.toBe('message');
    }
    expect(choisirJeu(8, 20, PLEINE, JOUR)?.jeu).toBe('message');
  });

  it('ne pose rien les jours impairs sans message', () => {
    expect(choisirJeu(1, 20, PLEINE, JOUR)).toBeNull();
    expect(choisirJeu(9, 20, PLEINE, JOUR)).toBeNull();
  });

  it("jour de message sans dialogue : l'éclair prend la place s'il est pair", () => {
    const sans = { ...PLEINE, dialogues: [] };
    expect(choisirJeu(8, 20, sans, JOUR)?.jeu).toBe('eclair');
    expect(choisirJeu(11, 20, sans, JOUR)).toBeNull();
  });

  it('ne repose pas un dialogue déjà lu au pas Utiliser', () => {
    expect(choisirJeu(8, 20, PLEINE, JOUR)).toEqual({ jeu: 'message', id: 'long' });
    expect(choisirJeu(8, 20, { ...PLEINE, lus: ['long'] }, JOUR)).toEqual({ jeu: 'message', id: 'court' });
  });
});

describe('jamais plus long que le budget', () => {
  it('prend la durée du pas que le chemin annonce', () => {
    for (const b of [5, 10, 20] as const) {
      const m = sessionSteps({ ...emptyProgress(JOUR), budget: b }).find((s) => s.id === 'utiliser')?.m;
      expect(m).toBe(`${SECONDES_PAS[b] / 60} min`);
    }
  });

  it("à 5 minutes, aucun jeu : les mots et le texte prennent déjà le pas", () => {
    expect(tient(5, secondesDuPas(null))).toBe(false);
    for (let rang = 1; rang <= 30; rang++) expect(choisirJeu(rang, 5, PLEINE, JOUR)).toBeNull();
  });

  it("à 10 minutes, l'éclair ou un dialogue de deux échanges", () => {
    expect(tient(10, secondesDuPas('eclair'))).toBe(true);
    expect(tient(10, secondesDuPas('message', 2))).toBe(true);
    expect(tient(10, secondesDuPas('message', 3))).toBe(false);
    expect(choisirJeu(8, 10, PLEINE, JOUR)).toEqual({ jeu: 'message', id: 'court' });
  });

  it('à 20 minutes, le dialogue le plus récent, même à trois échanges', () => {
    expect(choisirJeu(8, 20, PLEINE, JOUR)).toEqual({ jeu: 'message', id: 'long' });
  });
});

describe("rien sans acquis suffisant", () => {
  it("aucun mot ni dialogue quand les caractères ne sont pas stables", () => {
    const offre = offreDuCorpus(corpus(TOUS.map(fragile)), []);
    expect(offre.mots).toEqual([]);
    expect(offre.dialogues).toEqual([]);
    for (let rang = 1; rang <= 30; rang++) expect(choisirJeu(rang, 20, offre, JOUR)).toBeNull();
  });

  it("un dialogue dont un caractère manque ne s'ouvre pas", () => {
    const offre = offreDuCorpus(corpus(TOUS.filter((c) => c !== '见').map(stable)), []);
    expect(offre.dialogues.map((d) => d.id)).toEqual(['court']);
  });

  it("un mot déjà deviné ne se repose pas", () => {
    const c = corpusDeJeu({ eclair: ECLAIR, cartes: TOUS.map(stable), traits: TOUS, devines: ['火车', '火山', '电车', '汽车'] });
    expect(offreDuCorpus(c, []).mots).toEqual([]);
  });
});

/* ---------- la session : un jeu par journée, la reprise au pas exact ---------- */

describe('pas deux jeux le même jour', () => {
  it('la règle ne rend jamais plus d’un jeu', () => {
    for (let rang = 1; rang <= 60; rang++) {
      const c = choisirJeu(rang, 20, PLEINE, JOUR);
      expect(c === null || c.jeu === 'eclair' || c.jeu === 'message').toBe(true);
    }
  });

  it('le choix de la journée ne bouge plus une fois rangé', () => {
    let p = poserJeuUtiliser(auPasUtiliser(8), { jeu: 'message', id: 'court' });
    const avant = p;
    p = poserJeuUtiliser(p, { jeu: 'eclair', id: '火车' });
    expect(p).toBe(avant);
    p = poserJeuUtiliser(p, null);
    expect(jeuDuJour(p)?.jeu).toBe('message');
  });

  it("la session de plus n'en pose pas un second", () => {
    let p = poserJeuUtiliser(auPasUtiliser(2), { jeu: 'eclair', id: '火车' });
    p = setUseView(p, 'texte');
    expect(useNext(p)).toBe('eclair');
    p = finUtiliser(setUseView(p, 'eclair'), JOUR);
    [4, 5].forEach((i) => {
      p = markDone(p, i, JOUR);
    });
    p = commencerPlus(p);
    expect(p.enPlus).not.toBeNull();
    expect(poserJeuUtiliser(p, { jeu: 'message', id: 'court' })).toBe(p);
    expect(useNext(setUseView(p, 'texte'))).toBeNull();
  });

  it("une journée sans jeu le reste : Utiliser fini, rien ne se pose ensuite", () => {
    let p = finUtiliser(setUseView(auPasUtiliser(3), 'texte'), JOUR);
    expect(jeuDuJour(p)).toMatchObject({ jeu: null, fait: true });
    p = poserJeuUtiliser(p, { jeu: 'eclair', id: '火车' });
    expect(jeuDuJour(p)?.jeu).toBeNull();
  });

  it('se refait le lendemain', () => {
    const p = poserJeuUtiliser(auPasUtiliser(2), { jeu: 'eclair', id: '火车' });
    const demain = openDay(p, '2026-09-26');
    expect(demain.useJeu).toBeNull();
    expect(jeuDuJour({ ...p, day: '2026-09-26' })).toBeNull();
  });

  it('lit le rang de la journée comme le menu', () => {
    expect(rangDuJour(auPasUtiliser(8))).toBe(8);
    expect(rangDuJour({ ...emptyProgress(JOUR), days: 7, lastWorked: '2026-09-24' })).toBe(8);
  });
});

describe('la vue « éclair » du pas Utiliser', () => {
  const mot = ECLAIR.mots[0];
  const graine = graineUtiliser(JOUR);

  it('vient après le texte, puis le pas se termine', () => {
    let p = poserJeuUtiliser(auPasUtiliser(2), { jeu: 'eclair', id: mot.id });
    expect(useNext(p)).toBe('texte');
    p = setUseView(p, 'texte');
    expect(useNext(p)).toBe('eclair');
    p = setUseView(p, 'eclair');
    expect(useNext(p)).toBeNull();
    p = finUtiliser(p, JOUR);
    expect(steps(p)[nextIndex(p)].id).toBe('fixer');
    expect(p.use).toBe('mots');
  });

  it('se repose à la reprise avec le même mot et les mêmes sens', () => {
    expect(tourDuMot(mot, ECLAIR.mots, graine)).toEqual(tourDuMot(mot, ECLAIR.mots, graine));
    let p = setUseView(poserJeuUtiliser(auPasUtiliser(2), { jeu: 'eclair', id: mot.id }), 'eclair');
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.use).toBe('eclair');
    expect(relu.useJeu).toEqual(p.useJeu);
    expect(steps(relu)[nextIndex(relu)].id).toBe('utiliser');
    p = repondreEclair(p, JOUR, 'volcan');
    expect(fromJSON(toJSON(p), JOUR).useJeu).toMatchObject({ i: 1, reponse: 'volcan' });
  });

  it('ne se répond qu’une fois : la reprise ne note rien deux fois', () => {
    const p = repondreEclair(poserJeuUtiliser(auPasUtiliser(2), { jeu: 'eclair', id: mot.id }), JOUR, 'train');
    expect(repondreEclair(p, JOUR, 'volcan')).toBe(p);
    expect(p.tao.activites.filter((a) => a.type === 'jeu')).toHaveLength(1);
  });

  it('note la bonne réponse par grade, rien sur une erreur', () => {
    const tour = tourDuMot(mot, ECLAIR.mots, graine);
    const m: Manche = { jeu: 'eclair', graine, tours: [tour], i: 0, evenements: [], trouves: 0 };
    const juste = repondre(m, ['train'], { correct: true, tries: 0, seconds: 3 });
    expect(evenementsANoter('eclair', juste).map((e) => e.c)).toEqual(['火', '车']);
    const faux = repondre(m, ['volcan'], { correct: true, tries: 0, seconds: 3 });
    expect(evenementsANoter('eclair', faux)).toEqual([]);
    /* Le compteur « mots devinés » : un mot une fois, jamais un score au temps. */
    const p = noterMotDevine(noterMotDevine(emptyProgress(JOUR), mot.id), mot.id);
    expect(p.motsDevines).toEqual([mot.id]);
  });

  it('Tao joue la tête penchée', () => {
    expect(postureDuJeu('eclair')).toBe('jeu');
  });
});

describe('la vue « message » du pas Utiliser', () => {
  const court = WECHAT.dialogues[1];
  const graine = graineUtiliser(JOUR);

  function auMessage(): Progress {
    return setUseView(poserJeuUtiliser(auPasUtiliser(8), { jeu: 'message', id: court.id }), 'message');
  }

  it('reprend à l’échange exact, répliques écartées comprises', () => {
    let p = auMessage();
    const faux = court.echanges[0].repliques.find((r) => !r.juste)!.zh;
    p = ecarterReplique(p, faux);
    let relu = fromJSON(toJSON(p), JOUR);
    expect(relu.use).toBe('message');
    expect(relu.useJeu).toMatchObject({ jeu: 'message', id: 'court', i: 0, ecartees: [faux] });
    p = repliqueJuste(p, JOUR, court.echanges.length);
    relu = fromJSON(toJSON(p), JOUR);
    expect(relu.useJeu).toMatchObject({ i: 1, ecartees: [] });
    /* Le fil remontré : le message de l'ami, la bonne réplique, le message suivant. */
    expect(filDuDialogue(court, relu.useJeu!.i).map((b) => b.cle)).toEqual(['a0', 'm0', 'a1']);
    /* Les répliques reviennent dans le même ordre. */
    expect(toursWechat(court, graine)).toEqual(toursWechat(court, graine));
  });

  it('mené à bout, le dialogue est lu une fois, et Tao note un jeu', () => {
    let p = auMessage();
    p = repliqueJuste(p, JOUR, 2);
    p = repliqueJuste(p, JOUR, 2);
    expect(p.messagesLus).toEqual(['court']);
    expect(p.useJeu?.i).toBe(2);
    expect(repliqueJuste(p, JOUR, 2)).toBe(p);
    expect(p.tao.activites.filter((a) => a.type === 'jeu')).toHaveLength(1);
    expect(filDuDialogue(court, 2).map((b) => b.cle)).toEqual(['a0', 'm0', 'a1', 'm1']);
    expect(fromJSON(toJSON(p), JOUR).messagesLus).toEqual(['court']);
  });

  it('note la bonne réplique du premier coup seulement, rien sur une erreur', () => {
    const m = mancheWechat(court, graine);
    const juste = court.echanges[0].repliques.find((r) => r.juste)!.zh;
    const faux = court.echanges[0].repliques.find((r) => !r.juste)!.zh;
    expect(choisirReplique(m, faux, [], 2).evenements).toEqual([]);
    expect(choisirReplique(m, juste, [], 2).evenements.map((e) => e.c)).toEqual(['好', '喝', '茶']);
    expect(choisirReplique(m, juste, [faux], 2).evenements).toEqual([]);
  });

  it('Tao lit par-dessus l’épaule', () => {
    expect(postureDuJeu('wechat')).toBe('lecture');
  });
});

describe('export et import du jeu du pas Utiliser', () => {
  it("rend le même état à l'aller-retour", () => {
    const p = ecarterReplique(
      poserJeuUtiliser(setUseView(auPasUtiliser(8), 'message'), { jeu: 'message', id: 'court' }),
      '早！'
    );
    expect(fromJSON(toJSON(p), JOUR)).toEqual(p);
  });

  it('relit un export plus ancien, sans ces champs', () => {
    const ancien = JSON.stringify({ version: 1, day: JOUR, done: [true], budget: 10, days: 3, use: 'texte' });
    const p = fromJSON(ancien, JOUR);
    expect(p.useJeu).toBeNull();
    expect(p.messagesLus).toEqual([]);
    expect(p.use).toBe('texte');
  });

  it('une vue de jeu sans son jeu retombe sur le texte', () => {
    const sans = JSON.stringify({ ...emptyProgress(JOUR), use: 'eclair', useJeu: null });
    expect(fromJSON(sans, JOUR).use).toBe('texte');
    const autre = JSON.stringify({
      ...emptyProgress(JOUR),
      use: 'message',
      useJeu: { jour: JOUR, jeu: 'eclair', id: '火车', i: 0, ecartees: [], reponse: null, fait: false }
    });
    expect(fromJSON(autre, JOUR).use).toBe('texte');
  });

  it('écarte un jeu aberrant', () => {
    const casse = JSON.stringify({
      ...emptyProgress(JOUR),
      useJeu: { jour: 'hier', jeu: 'eclair', id: '火车' },
      messagesLus: ['court', 3, 'court']
    });
    const p = fromJSON(casse, JOUR);
    expect(p.useJeu).toBeNull();
    expect(p.messagesLus).toEqual(['court']);
    const sansId = JSON.stringify({ ...emptyProgress(JOUR), useJeu: { jour: JOUR, jeu: 'message', id: '' } });
    expect(fromJSON(sansId, JOUR).useJeu).toBeNull();
  });
});
