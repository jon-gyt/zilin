/**
 * Le retour de Tao entre deux essais (signalement du propriétaire du 29 septembre 2026,
 * « tu donnes les réponses dans les intitulés ») : une règle par test. Après une réponse
 * fausse, tant qu'un autre essai reste permis, rien ne donne la bonne réponse, ni
 * directement ni par une glose ; la question close, l'explication complète reste.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  explication,
  lireExamensDonnees,
  retourQuestion,
  retourSecondEssai,
  texteExamen,
  type Dire,
  type ExamensDonnees,
  type Phrase,
  type QuestionExamen,
  type SerieExamen,
  type Support
} from './examens';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
/** Le vrai `examens.json` de l'export versionné, pour ses lignes d'écran et ses séries relues. */
const DONNEES: ExamensDonnees = lireExamensDonnees(JSON.parse(source('../../public/data/0.1.0/examens.json')) as unknown);
const dire: Dire = (cle, v = {}) => texteExamen(DONNEES, cle, v);

/** Le billet du signalement : « Où va ce train ? », « À Zhongshan ». */
const BILLET: Support = {
  id: 's1',
  genre: 'billet',
  contexte: { fr: 'Un billet', en: 'A ticket' },
  lignes: [
    { zh: '火车', pinyin: 'huǒ chē', fr: 'Train', en: 'Train' },
    { zh: '南京 — 中山', pinyin: 'nán jīng zhōng shān', fr: 'Nankin — Zhongshan', en: 'Nanjing — Zhongshan' },
    { zh: '七月十五日上午', pinyin: 'qī yuè shí wǔ rì shàng wǔ', fr: '15 juillet, le matin', en: 'July 15, morning' }
  ]
};
const MESSAGE: Support = {
  id: 's2',
  genre: 'message',
  contexte: { fr: 'Un message', en: 'A message' },
  lignes: [{ zh: '明天中午见面，好不好？', pinyin: 'míng tiān zhōng wǔ jiàn miàn hǎo bu hǎo', fr: 'On se voit demain midi ?', en: 'Meet tomorrow at noon?' }]
};
const g = (pinyin: string, fr: string): { pinyin: string; fr: string; en: string } => ({ pinyin, fr, en: fr });
const SERIE: SerieExamen = {
  supports: [BILLET, MESSAGE],
  questions: [],
  glose: {
    火车: g('huǒ chē', 'train'),
    南京: g('nán jīng', 'Nankin'),
    中山: g('zhōng shān', 'Zhongshan'),
    中山门: g('zhōng shān mén', 'porte Zhongshan'),
    上午: g('shàng wǔ', 'matin'),
    中: g('zhōng', 'milieu'),
    口: g('kǒu', 'bouche'),
    明天: g('míng tiān', 'demain'),
    中午: g('zhōng wǔ', 'midi')
  }
};

const OU_VA: QuestionExamen = {
  type: 'comprendre',
  support: 's1',
  consigne: { fr: 'Où va ce train ?', en: 'Where is this train going?' },
  choix: [
    { fr: 'À Nankin', en: 'To Nanjing' },
    { fr: 'À Pékin', en: 'To Beijing' },
    { fr: 'À Shanghai', en: 'To Shanghai' },
    { fr: 'À Zhongshan', en: 'To Zhongshan' }
  ],
  reponse: 3,
  porte: ['中', '山'],
  caracteres: []
};
const REPERER: QuestionExamen = {
  type: 'reperer',
  support: 's1',
  consigne: { fr: 'Touche la ville d’arrivée.', en: 'Tap the destination.' },
  choix: ['火车', '南京', '中山', '上午'],
  reponse: 2,
  porte: ['中', '山'],
  caracteres: []
};
const CARACTERE: QuestionExamen = {
  type: 'caractere',
  consigne: { fr: 'Quel caractère a ce sens ?', en: 'Which character has this meaning?' },
  objet: { zh: '中', pinyin: 'zhōng', fr: 'milieu', en: 'middle' },
  choix: ['口', '中', '山', '上'],
  reponse: 1,
  porte: ['中'],
  caracteres: []
};
const TROU: QuestionExamen = {
  type: 'trou',
  consigne: { fr: 'Quel caractère manque dans ce mot ?', en: 'Which character is missing?' },
  objet: { zh: '中午', pinyin: 'zhōng wǔ', fr: 'midi', en: 'noon' },
  trou: 0,
  choix: ['口', '中', '上', '山'],
  reponse: 1,
  porte: ['中'],
  caracteres: []
};
const REPLIQUE: QuestionExamen = {
  type: 'replique',
  support: 's2',
  consigne: { fr: 'Que réponds-tu ?', en: 'What do you reply?' },
  choix: [
    { zh: '我是大学生。', pinyin: 'wǒ shì dà xué sheng', fr: 'Je suis étudiant.', en: 'I am a student.' },
    { zh: '好，明天中午见！', pinyin: 'hǎo míng tiān zhōng wǔ jiàn', fr: 'D’accord, à demain midi !', en: 'OK, see you tomorrow at noon!' },
    { zh: '今天是星期三。', pinyin: 'jīn tiān shì xīng qī sān', fr: 'Aujourd’hui, c’est mercredi.', en: 'Today is Wednesday.' },
    { zh: '七月十五日。', pinyin: 'qī yuè shí wǔ rì', fr: 'Le 15 juillet.', en: 'July 15.' }
  ],
  reponse: 1,
  porte: ['中', '午'],
  caracteres: []
};
const TON: QuestionExamen = {
  type: 'ton',
  consigne: { fr: 'Quel est le ton de ce caractère ?', en: 'What is the tone of this character?' },
  objet: { zh: '中', pinyin: 'zhōng', fr: 'milieu', en: 'middle' },
  choix: ['zhōng', 'zhóng', 'zhǒng', 'zhòng'],
  reponse: 0,
  porte: ['中'],
  caracteres: []
};
const SENS: QuestionExamen = {
  type: 'sens',
  consigne: { fr: 'Que veut dire ce caractère ?', en: 'What does this character mean?' },
  objet: { zh: '中', pinyin: 'zhōng', fr: 'milieu', en: 'middle' },
  choix: [
    { fr: 'bouche', en: 'mouth' },
    { fr: 'milieu', en: 'middle' },
    { fr: 'montagne', en: 'mountain' },
    { fr: 'haut', en: 'up' }
  ],
  reponse: 1,
  porte: ['中'],
  caracteres: []
};
const VRAI_FAUX: QuestionExamen = {
  type: 'vrai_faux',
  support: 's1',
  consigne: { fr: 'Vrai ou faux ?', en: 'True or false?' },
  affirmation: { zh: '火车去南京。', pinyin: 'huǒ chē qù nán jīng', fr: 'Le train va à Nankin.', en: 'The train goes to Nanjing.' },
  choix: [],
  reponse: false,
  porte: ['南', '京'],
  caracteres: []
};

const supportDe = (q: QuestionExamen): Support | null => SERIE.supports.find((s) => s.id === q.support) ?? null;
/** Tout ce que Tao dit après un premier essai faux, titre et suite compris. */
function apresUnFaux(q: QuestionExamen, faux: number | boolean): string {
  const r = retourQuestion(q, [faux], SERIE, supportDe(q), dire);
  return r === null ? '' : `${r.titre} ${r.texte} ${r.suite}`;
}

describe('entre deux essais, le retour ne donne jamais la bonne réponse', () => {
  it('comprendre : une invitation à relire, jamais la glose des caractères qui portent la réponse', () => {
    for (const faux of [0, 1, 2]) {
      const r = retourQuestion(OU_VA, [faux], SERIE, BILLET, dire);
      expect(r).toEqual({ ok: false, titre: dire('pas_celle'), texte: dire('ko_comprendre'), suite: dire('encore') });
      expect(apresUnFaux(OU_VA, faux)).not.toMatch(/中山|zhōng shān|Zhongshan/);
    }
    expect(dire('ko_comprendre')).not.toBe('');
  });

  it('repérer : la glose du mot touché, jamais celle du mot cherché', () => {
    expect(retourSecondEssai(REPERER, 1, SERIE, dire)).toBe('南京 nán jīng : Nankin');
    expect(apresUnFaux(REPERER, 3)).toContain('上午 shàng wǔ : matin');
    for (const faux of [0, 1, 3]) expect(apresUnFaux(REPERER, faux)).not.toMatch(/中山|Zhongshan/);
  });

  it('une glose qui porterait la bonne réponse se tait', () => {
    const avecLeurre: QuestionExamen = { ...REPERER, choix: ['火车', '中山门', '中山', '上午'] };
    expect(retourSecondEssai(avecLeurre, 1, SERIE, dire)).toBe('');
  });

  it('caractère et trou : la glose du caractère touché, jamais celle du caractère cherché', () => {
    expect(retourSecondEssai(CARACTERE, 0, SERIE, dire)).toBe('口 kǒu : bouche');
    expect(retourSecondEssai(TROU, 0, SERIE, dire)).toBe('口 kǒu : bouche');
    for (const q of [CARACTERE, TROU]) for (const faux of [0, 2, 3]) expect(apresUnFaux(q, faux)).not.toMatch(/中|zhōng|milieu|midi/);
  });

  it('réplique : ce que dit la réplique touchée, jamais la bonne', () => {
    expect(retourSecondEssai(REPLIQUE, 0, SERIE, dire)).toBe(dire('ko_replique', { fr: 'Je suis étudiant.' }));
    for (const faux of [0, 2, 3]) expect(apresUnFaux(REPLIQUE, faux)).not.toMatch(/demain midi|明天中午见/);
  });

  it('ton : la syllabe touchée n’est pas la bonne, sans dire laquelle l’est', () => {
    expect(retourSecondEssai(TON, 3, SERIE, dire)).toBe(dire('ko_ton', { syllabe: 'zhòng' }));
    for (const faux of [1, 2, 3]) expect(apresUnFaux(TON, faux)).not.toContain('zhōng');
  });

  it('sens : rien, le choix touché se lit déjà en français', () => {
    expect(retourSecondEssai(SENS, 0, SERIE, dire)).toBe('');
    for (const faux of [0, 2, 3]) expect(apresUnFaux(SENS, faux)).not.toContain('milieu');
  });

  it('au vrai ou faux, pas de second essai : la réponse se montre tout de suite', () => {
    const r = retourQuestion(VRAI_FAUX, [true], SERIE, BILLET, dire);
    expect(r).toEqual({ ok: false, titre: dire('pas_celle'), texte: dire('vf_faux', { fr: 'Le train va à Nankin.' }), suite: '' });
  });

  it('aucune série exportée ne donne sa réponse entre deux essais, quel que soit le choix faux', () => {
    let vus = 0;
    for (const lignes of Object.values(DONNEES.parcours)) {
      for (const ligne of lignes) {
        for (const serie of Object.values(ligne.series)) {
          for (const q of serie.questions) {
            if (q.type === 'vrai_faux') continue;
            const bonne = q.choix[q.reponse as number];
            const zh = typeof bonne === 'string' ? bonne : (bonne as Partial<Phrase>).zh;
            const indices: string[] = typeof bonne === 'string' ? [bonne] : [bonne.fr, ...(zh === undefined ? [] : [zh])];
            if (q.objet !== undefined && q.type !== 'sens') indices.push(q.objet.zh);
            q.choix.forEach((_, k) => {
              if (k === q.reponse) return;
              const texte = retourSecondEssai(q, k, serie, dire);
              for (const x of indices) expect(texte, `${ligne.examen} ${q.consigne.fr} ${k}`).not.toContain(x);
              vus += 1;
            });
          }
        }
      }
    }
    expect(vus).toBeGreaterThan(50);
  });
});

describe('la question close, l’explication complète reste', () => {
  it('comprendre : juste du premier coup, la glose des caractères qui portent la réponse', () => {
    const r = retourQuestion(OU_VA, [3], SERIE, BILLET, dire);
    expect(r).toEqual({ ok: true, titre: dire('juste'), texte: '中山 zhōng shān : Zhongshan', suite: '' });
  });

  it('rattrapée au second essai : la même explication, et le premier coup reste manqué', () => {
    const r = retourQuestion(OU_VA, [0, 3], SERIE, BILLET, dire);
    expect(r).toEqual({ ok: true, titre: dire('rattrapee'), texte: '中山 zhōng shān : Zhongshan', suite: dire('rattrapee_suite') });
  });

  it('chaque type garde son explication : l’objet, la réplique, le mot du support', () => {
    expect(explication(CARACTERE, SERIE, null, dire)).toBe('中 zhōng : milieu');
    expect(explication(TROU, SERIE, null, dire)).toBe('中午 zhōng wǔ : midi');
    expect(explication(REPLIQUE, SERIE, MESSAGE, dire)).toBe('« D’accord, à demain midi ! »');
    expect(explication(REPERER, SERIE, BILLET, dire)).toBe('中山 zhōng shān : Zhongshan');
  });

  it('avant toute réponse, rien', () => {
    expect(retourQuestion(OU_VA, [], SERIE, BILLET, dire)).toBeNull();
  });
});
