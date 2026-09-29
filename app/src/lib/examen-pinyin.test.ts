/**
 * Le pinyin sous les caractères aux premiers examens (décision du propriétaire du 29
 * septembre 2026, « Il faudrait un mode avec pinyin sous les caractères sur les premiers
 * examens (jusqu'à HSK 1), ensuite plus de pinyin pour les examens ») : une règle par test.
 * Il s'affiche aux examens de la première étape (le 乡试 sur Lire, le 月课 de 405 sur HSK),
 * disparaît après, et n'apparaît jamais sur l'objet d'un ton, d'un trou, d'un caractère ou
 * d'un sens, ni quand il donnerait la réponse. Le dernier test balaie les séries exportées.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dessinBoutique } from './examen-dessins';
import {
  SANS_PINYIN,
  TYPES_REVUE,
  avecPinyin,
  decouperLigneAvecPinyin,
  grappesDeLigne,
  grappesDePhrase,
  lireExamensDonnees,
  motsDeLigne,
  pinyinDeQuestion,
  pinyinDonneLaReponse,
  syllabesParCaractere,
  textesAvecPinyin,
  type CheminExamen,
  type ExamensDonnees,
  type Phrase,
  type QuestionExamen,
  type SerieExamen,
  type Support
} from './examens';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const BRUT = JSON.parse(source('../../public/data/0.1.0/examens.json')) as { parcours: Record<string, Record<string, unknown>[]> };
/** Le vrai `examens.json` de l'export versionné. */
const DONNEES: ExamensDonnees = lireExamensDonnees(BRUT as unknown);
const ecran = source('Examen.svelte');

const BILLET: Support = {
  id: 's1',
  genre: 'billet',
  contexte: { fr: 'Un billet', en: 'A ticket' },
  lignes: [
    { zh: '火车', pinyin: 'huǒ chē', fr: 'Train', en: 'Train' },
    { zh: '南京 — 中山', pinyin: 'nán jīng zhōng shān', fr: 'Nankin — Zhongshan', en: 'Nanjing — Zhongshan' }
  ]
};
const MESSAGE: Support = {
  id: 's2',
  genre: 'message',
  contexte: { fr: 'Un message', en: 'A message' },
  lignes: [{ zh: '明天中午见面，好不好？', pinyin: 'míng tiān zhōng wǔ jiàn miàn hǎo bu hǎo', fr: 'On se voit demain midi ?', en: '' }]
};
const SERIE: SerieExamen = {
  supports: [BILLET, MESSAGE],
  questions: [],
  glose: { 南京: { pinyin: 'nán jīng', fr: 'Nankin', en: 'Nanjing' }, 中山: { pinyin: 'zhōng shān', fr: 'Zhongshan', en: 'Zhongshan' } }
};
const sens = (fr: string): { fr: string; en: string } => ({ fr, en: fr });
const phrase = (zh: string, pinyin: string, fr: string): Phrase => ({ zh, pinyin, fr, en: fr });
const MEN: Phrase = phrase('门', 'mén', 'porte');

const Q: Record<string, QuestionExamen> = {
  comprendre: {
    type: 'comprendre',
    support: 's2',
    consigne: sens('Quand se voient-ils ?'),
    choix: [sens('Demain midi'), sens('Ce soir'), sens('Lundi'), sens('Jamais')],
    reponse: 0,
    porte: ['明'],
    caracteres: []
  },
  reperer: { type: 'reperer', support: 's1', consigne: sens('Touche la ville de départ.'), choix: ['南京', '中山', '火车', '车'], reponse: 0, porte: ['南'], caracteres: [] },
  vrai_faux: {
    type: 'vrai_faux',
    support: 's2',
    consigne: sens('Vrai ou faux ?'),
    affirmation: phrase('明天见。', 'míng tiān jiàn', 'À demain.'),
    choix: [],
    reponse: true,
    porte: ['明'],
    caracteres: []
  },
  replique: {
    type: 'replique',
    support: 's2',
    consigne: sens('Que réponds-tu ?'),
    choix: [phrase('好。', 'hǎo', 'Oui.'), phrase('不好。', 'bù hǎo', 'Non.'), phrase('大。', 'dà', 'Grand.'), phrase('人。', 'rén', 'Personne.')],
    reponse: 0,
    porte: ['好'],
    caracteres: []
  },
  ton: { type: 'ton', consigne: sens('Quel ton ?'), objet: MEN, choix: ['mēn', 'mén', 'měn', 'mèn'], reponse: 1, porte: ['门'], caracteres: [] },
  trou: { type: 'trou', consigne: sens('Quel caractère manque ?'), objet: phrase('门口', 'mén kǒu', 'entrée'), trou: 1, choix: ['口', '日', '月', '人'], reponse: 0, porte: ['口'], caracteres: [] },
  caractere: { type: 'caractere', consigne: sens('Lequel veut dire ceci ?'), objet: MEN, choix: ['门', '口', '日', '月'], reponse: 0, porte: ['门'], caracteres: [] },
  sens: { type: 'sens', consigne: sens('Que veut dire ce caractère ?'), objet: MEN, choix: [sens('porte'), sens('bouche'), sens('soleil'), sens('lune')], reponse: 0, porte: ['门'], caracteres: [] }
};

const avecLes = (chemin: CheminExamen): string[] => DONNEES.parcours[chemin].filter((x) => x.pinyin).map((x) => x.examen);

describe('le pinyin sous les caractères, aux premiers examens', () => {
  it("s'affiche aux examens de la première étape : jusqu'au 乡试 sur Lire, au 月课 de 405 sur HSK", () => {
    expect(avecLes('lire')).toEqual(['xianshi', 'yueke-75', 'fushi', 'yueke-150', 'yuanshi', 'xiangshi']);
    expect(avecLes('hsk')).toEqual(['xianshi', 'yueke-75', 'fushi', 'yueke-150', 'yuanshi', 'xiangshi', 'yueke-305', 'yueke-355', 'yueke-405']);
    expect(avecPinyin(DONNEES, 'lire', 'xianshi')).toBe(true);
    expect(pinyinDeQuestion(Q.comprendre, SERIE, avecPinyin(DONNEES, 'lire', 'xianshi')).support).toBe(true);
  });

  it('disparaît après la première étape', () => {
    expect(avecPinyin(DONNEES, 'lire', 'yueke-305')).toBe(false);
    expect(avecPinyin(DONNEES, 'lire', 'yueke-355')).toBe(false);
    /* au-delà du chemin, rien ; un export qui ne le dit pas, rien non plus */
    expect(avecPinyin(DONNEES, 'hsk', 'huishi')).toBe(false);
    const sans = lireExamensDonnees({ ...BRUT, parcours: { lire: BRUT.parcours.lire.map(({ pinyin: _, ...x }) => x), hsk: [] } });
    expect(avecPinyin(sans, 'lire', 'xianshi')).toBe(false);
    for (const q of Object.values(Q)) expect(pinyinDeQuestion(q, SERIE, avecPinyin(DONNEES, 'lire', 'yueke-305'))).toEqual(SANS_PINYIN);
  });

  it('se montre sous le support, l’affirmation et les répliques à choisir', () => {
    expect(pinyinDeQuestion(Q.comprendre, SERIE, true)).toEqual({ support: true, affirmation: false, choix: false });
    expect(pinyinDeQuestion(Q.reperer, SERIE, true)).toEqual({ support: true, affirmation: false, choix: false });
    expect(pinyinDeQuestion(Q.vrai_faux, SERIE, true)).toEqual({ support: true, affirmation: true, choix: false });
    expect(pinyinDeQuestion(Q.replique, SERIE, true)).toEqual({ support: true, affirmation: false, choix: true });
  });

  it('jamais sur l’objet d’une question de ton : il donnerait le ton', () => {
    expect(pinyinDeQuestion(Q.ton, SERIE, true)).toEqual(SANS_PINYIN);
    expect(textesAvecPinyin(Q.ton, SERIE, true)).toEqual([]);
  });

  it('jamais sur l’objet ni les choix d’un trou : le son du mot trahirait le caractère manquant', () => {
    expect(pinyinDeQuestion(Q.trou, SERIE, true)).toEqual(SANS_PINYIN);
    expect(textesAvecPinyin(Q.trou, SERIE, true)).toEqual([]);
  });

  it('jamais sur les choix d’une question « caractère », ni sur le caractère d’une question de sens', () => {
    expect(pinyinDeQuestion(Q.caractere, SERIE, true)).toEqual(SANS_PINYIN);
    expect(pinyinDeQuestion(Q.sens, SERIE, true)).toEqual(SANS_PINYIN);
  });

  it('l’écran ne lit jamais le pinyin de l’objet ni des choix de la revue avant la réponse', () => {
    const question = ecran.slice(ecran.indexOf("q.type === 'sens' || q.type === 'caractere'"), ecran.indexOf("q.type === 'comprendre' || q.type === 'replique'"));
    expect(question).not.toMatch(/pinyin|rubis|syllabes/);
    expect(ecran).not.toMatch(/objet\.pinyin/);
    expect(ecran).toContain('pinyin={py.support}');
    expect(ecran).toMatch(/\{#if py\.affirmation\}\{@render rubis\(q\.affirmation\)\}/);
    expect(ecran).toMatch(/\{#if q\.type === 'replique' && py\.choix\}/);
  });

  it('jamais quand le pinyin désignerait seul la bonne réponse', () => {
    const ou: QuestionExamen = {
      type: 'comprendre',
      support: 's1',
      consigne: sens('Où va ce train ?'),
      choix: [sens('À Zhongshan'), sens('À Nankin'), sens('À Pékin'), sens('À Shanghai')],
      reponse: 0,
      porte: ['中', '山'],
      caracteres: []
    };
    expect(pinyinDonneLaReponse(ou, SERIE)).toEqual(['zhongshan']);
    expect(pinyinDeQuestion(ou, SERIE, true)).toEqual(SANS_PINYIN);
    /* un leurre que le pinyin transcrit aussi : il faut lire le billet */
    const lu = { ...ou, choix: [sens('À Zhongshan'), sens('À Nanjing'), sens('À Pékin'), sens('À Shanghai')] };
    expect(pinyinDonneLaReponse(lu, SERIE)).toEqual([]);
    expect(pinyinDeQuestion(lu, SERIE, true).support).toBe(true);
    /* au repérage, une consigne qui transcrit le mot cherché */
    expect(pinyinDonneLaReponse({ ...Q.reperer, consigne: sens('Touche Nan Jing.') }, SERIE)).toEqual(['nanjing']);
  });
});

describe('le pinyin se lit sous chaque caractère', () => {
  it('une syllabe par sinogramme, rien sous la ponctuation', () => {
    expect(syllabesParCaractere(MESSAGE.lignes[0])).toEqual(['míng', 'tiān', 'zhōng', 'wǔ', 'jiàn', 'miàn', null, 'hǎo', 'bu', 'hǎo', null]);
    expect(syllabesParCaractere(BILLET.lignes[1])).toEqual(['nán', 'jīng', null, null, null, 'zhōng', 'shān']);
  });

  it('un pinyin qui ne tombe pas juste ne se montre pas, plutôt que décalé', () => {
    expect(syllabesParCaractere({ zh: '明天见', pinyin: 'míng tiān' })).toEqual([null, null, null]);
  });

  it('les mots d’un repérage gardent leurs syllabes', () => {
    const py = syllabesParCaractere(BILLET.lignes[1]);
    expect(decouperLigneAvecPinyin('南京 — 中山', py, ['南京', '中山']).map((m) => [m.t, m.mot, m.py])).toEqual([
      ['南京', 0, ['nán', 'jīng']],
      [' ', -1, [null]],
      ['—', -1, [null]],
      [' ', -1, [null]],
      ['中山', 1, ['zhōng', 'shān']]
    ]);
    expect(decouperLigneAvecPinyin('南京', null, ['南京'])[0].py).toBeNull();
  });

  it('un mot de la glose ne se coupe pas en fin de ligne, la ponctuation reste avec ce qui la précède', () => {
    expect(motsDeLigne('见王先生。', ['王先生', '先生', '见'])).toEqual([0, 1, 1, 1, 2]);
    const py = syllabesParCaractere({ zh: '见王先生。', pinyin: 'jiàn wáng xiān sheng' });
    expect(grappesDeLigne('见王先生。', py, [], ['王先生', '见']).map((g) => g.map((m) => m.t).join(''))).toEqual(['见', '王先生。']);
    expect(grappesDePhrase(MESSAGE.lignes[0], ['明天', '中午', '见面']).map((g) => g.map((x) => x.c).join(''))).toEqual([
      '明天',
      '中午',
      '见面，',
      '好',
      '不',
      '好？'
    ]);
  });

  it('sur l’enseigne, la syllabe s’écrit sous le caractère, à l’encre claire, jamais au cinabre', () => {
    const traits = new Map();
    const avec = dessinBoutique('古玩店', traits, syllabesParCaractere({ zh: '古玩店', pinyin: 'gǔ wán diàn' }));
    expect(avec).toContain('>gǔ</text>');
    expect(avec).toContain('>diàn</text>');
    expect(avec).toMatch(/fill="var\(--ex-filet\)" style="font:400 11px var\(--sans\)">wán</);
    expect(avec).not.toMatch(/--zhu/);
    expect(dessinBoutique('古玩店', traits)).not.toContain('gǔ');
  });

  it('le pinyin est discret : à la brume, en petit, jamais au cinabre', () => {
    expect(source('SupportExamen.svelte')).toMatch(/\.rt \{[^}]*color: var\(--mist\)/);
    expect(ecran).toMatch(/\.rubi \.rt \{[^}]*font: 400 11px[^}]*color: var\(--mist\)/);
  });
});

describe('le contrôle des fuites balaie les séries exportées', () => {
  const series = (['lire', 'hsk'] as const).flatMap((chemin) =>
    DONNEES.parcours[chemin].flatMap((x) =>
      Object.entries(x.series).map(([lettre, s]) => ({ ou: `${chemin}/${x.examen} ${lettre}`, pinyin: x.pinyin, s: s as SerieExamen }))
    )
  );

  it('il y a des séries exportées avec pinyin à balayer', () => {
    expect(series.filter((x) => x.pinyin).length).toBeGreaterThanOrEqual(4);
  });

  it('aucune question de revue ne montre de pinyin, même forcé', () => {
    for (const { ou, s } of series) {
      for (const [k, q] of s.questions.entries()) {
        if (TYPES_REVUE.includes(q.type)) expect(textesAvecPinyin(q, s, true), `${ou} question ${k + 1}`).toEqual([]);
      }
    }
  });

  it('aucune mise en situation dont le pinyin donnerait la réponse', () => {
    for (const { ou, s } of series) {
      for (const [k, q] of s.questions.entries()) expect(pinyinDonneLaReponse(q, s), `${ou} question ${k + 1}`).toEqual([]);
    }
  });

  it('les répliques à choisir portent toutes leur pinyin, ou aucune', () => {
    for (const { ou, s, pinyin } of series) {
      for (const [k, q] of s.questions.entries()) {
        if (q.type !== 'replique') continue;
        const avec = textesAvecPinyin(q, s, pinyin).filter((p) => q.choix.includes(p));
        expect([0, q.choix.length], `${ou} question ${k + 1}`).toContain(avec.length);
      }
    }
  });

  it('chaque texte montré avec son pinyin a une syllabe sous chaque sinogramme', () => {
    for (const { ou, s, pinyin } of series) {
      if (!pinyin) continue;
      for (const [k, q] of s.questions.entries()) {
        for (const p of textesAvecPinyin(q, s, true)) {
          const syl = syllabesParCaractere(p);
          const hz = [...p.zh].filter((c) => /[㐀-鿿]/.test(c)).length;
          expect(syl.filter((x) => x !== null).length, `${ou} question ${k + 1} : ${p.zh}`).toBe(hz);
        }
      }
    }
  });
});
