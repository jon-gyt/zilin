/**
 * Le personnage (story 4.5, brief §8) : une règle par test. Les rangs et leurs seuils, la
 * taille qui ne décroît jamais, un point seulement par bonne réponse, rien qui dépende du
 * temps, l'export et l'import, le choix au premier lancement, le 放榜, la bulle de Tao.
 * Puis « Points ET examen » (story 8.5) : le titre, les nominations, les 月课, la tenue et
 * la silhouette, le rang tenu, « Mon personnage », le 放榜 et les rangs d'avant les examens.
 * La charte du dessin est dans `heros-charte.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import {
  ARTS,
  ART_DE_QUESTION,
  ECHELLES,
  artDe,
  artsVides,
  avance,
  caracteresDeLAura,
  examensRecus,
  exigenceRemplie,
  lireHeros,
  lireHerosDonnees,
  meriteDe,
  nettoyerNom,
  phraseDeTao,
  phraseDuChoix,
  pointsDerives,
  rangAccorde,
  rangDe,
  rangTenu,
  taille,
  texteFangbang,
  titreAccorde,
  total,
  type Arts,
  type HerosDonnees,
  type Merite
} from './heros';
import { lireEcrans, remplir } from './ecrans';
import {
  lireEtatExamens,
  lireExamensDonnees,
  migrerRangsAnnonces,
  rangAccorde as rangAccordeDesExamens,
  resteAuRangSuivant
} from './examens';
import { personnage } from './Heros.svelte';
import {
  ETAPES_DEPART,
  annoncerRang,
  choisirHeros,
  departNext,
  emptyProgress,
  finDepart,
  fromJSON,
  noterRevision,
  toJSON,
  traceAchevee,
  type Progress,
  type Revision
} from './session';
import { newCard, schedule, type ReviewCard } from './srs';
import { TYPES } from './questions';

const JOUR = '2026-09-25';
const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Le vrai `heros.json` de l'export versionné : les seuils du propriétaire. */
const DONNEES: HerosDonnees = lireHerosDonnees(
  JSON.parse(source('../../public/data/0.1.0/heros.json')) as unknown
);
const RANGS = DONNEES.rangs;
/** Le vrai `examens.json` : la liste des examens, les nominations. */
const EXAMENS = lireExamensDonnees(JSON.parse(source('../../public/data/0.1.0/examens.json')) as unknown);
/** Les lignes de « Mon personnage », du pipeline. */
const TEXTES = lireEcrans(JSON.parse(source('../../public/data/0.1.0/ecrans.json')) as unknown).personnage;
const rang = (hz: string): number => RANGS.findIndex((r) => r.hz === hz);
const nomExamen = (id: string): string => EXAMENS.examens.find((e) => e.id === id)?.hz ?? '';
/** Les examens réussis, à une journée. */
function recus(...ids: string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [id, JOUR]));
}
/** Les six examens à titre, et tous les 月课 jusqu'à un palier. */
const TITRES = ['xianshi', 'fushi', 'yuanshi', 'xiangshi', 'huishi', 'dianshi'];
function merite(points: number, reussis: Record<string, string> = {}, lus = 0, annonce = 0): Merite {
  return { points, reussis, lus, annonce };
}

function arts(a: Partial<Arts>): Arts {
  return { ...artsVides(), ...a };
}

function juste(c: string, o: Partial<Revision> = {}): Revision {
  return { c, correct: true, tries: 0, seconds: 3, ...o };
}

/* ---------- les rangs ---------- */

describe('les douze rangs', () => {
  it('vont du bébé 启蒙 à l’adulte 状元, aux seuils du propriétaire', () => {
    expect(RANGS.map((r) => r.hz)).toEqual([
      '启蒙', '蒙童', '学童', '童生', '秀才', '举人', '贡士', '进士', '翰林', '探花', '榜眼', '状元'
    ]);
    expect(RANGS.map((r) => r.seuil)).toEqual([0, 10, 25, 50, 80, 120, 180, 260, 360, 500, 700, 1000]);
    expect(RANGS[0].age).toBe('bébé');
    expect(RANGS[11].age).toBe('adulte');
    expect(RANGS[4]).toMatchObject({ fr: 'talent éclos', role: "reçu à l'examen du commissaire aux études" });
    expect(ECHELLES).toHaveLength(RANGS.length);
  });

  it('se franchissent au seuil exact, et le dernier reste le dernier', () => {
    expect(rangDe(0, RANGS)).toBe(0);
    expect(rangDe(9, RANGS)).toBe(0);
    expect(rangDe(10, RANGS)).toBe(1);
    expect(rangDe(79, RANGS)).toBe(3);
    expect(rangDe(80, RANGS)).toBe(4);
    expect(rangDe(1000, RANGS)).toBe(11);
    expect(rangDe(50_000, RANGS)).toBe(11);
  });

  it('un seuil qui ne croît pas arrête la lecture des rangs', () => {
    const d = lireHerosDonnees({
      rangs: [
        { hz: '启蒙', seuil: 0 },
        { hz: '蒙童', seuil: 10 },
        { hz: '学童', seuil: 10 },
        { hz: '童生', seuil: 50 }
      ]
    });
    expect(d.rangs.map((r) => r.hz)).toEqual(['启蒙', '蒙童']);
  });

  it('la barre dit ce qui manque avant le rang suivant', () => {
    const tout = recus(...TITRES);
    expect(avance(RANGS, merite(4))).toMatchObject({ rang: 0, manque: 6, part: 0.4 });
    expect(avance(RANGS, merite(10))).toMatchObject({ rang: 1, manque: 15, part: 0 });
    expect(avance(RANGS, merite(1200, tout, 1800))).toMatchObject({ rang: 11, suivant: null, manque: 0, part: 1 });
  });
});

/* ---------- la taille ---------- */

describe('la taille', () => {
  it('grandit à chaque point et ne décroît jamais, de 0 à 3 000 points', () => {
    let avant = -1;
    for (let t = 0; t <= 3000; t += 1) {
      const e = taille(t, RANGS);
      expect(e, `${t} points`).toBeGreaterThanOrEqual(avant);
      avant = e;
    }
    expect(taille(0, RANGS)).toBeCloseTo(0.46);
    expect(taille(9, RANGS)).toBeGreaterThan(taille(0, RANGS));
    expect(taille(3000, RANGS)).toBeLessThanOrEqual(1);
  });

  it('le bébé fait moins de la moitié de l’adulte', () => {
    expect(taille(0, RANGS) * 2).toBeLessThan(taille(1000, RANGS));
  });
});

/* ---------- les points ---------- */

describe('les points des quatre arts', () => {
  it('une bonne réponse donne un point à son art ; une erreur ne coûte rien', () => {
    let p = emptyProgress(JOUR);
    p = noterRevision(p, JOUR, juste('人', { art: 'ting' }));
    expect(p.arts).toEqual(arts({ ting: 1 }));
    const faux = noterRevision(p, JOUR, { c: '人', correct: false, tries: 2, seconds: 3, art: 'ting' });
    expect(faux.arts).toEqual(p.arts);
    /* juste après une erreur : c'est une bonne réponse notée, un point */
    const rattrape = noterRevision(p, JOUR, juste('人', { tries: 1, art: 'du' }));
    expect(rattrape.arts).toEqual(arts({ ting: 1, du: 1 }));
  });

  it('chaque type de question a son art ; un jeu, sans art, est une lecture', () => {
    expect(TYPES.every((t) => ART_DE_QUESTION[t] !== undefined)).toBe(true);
    expect(ART_DE_QUESTION).toEqual({
      sens: 'du',
      caractere: 'du',
      assemblage: 'du',
      trou: 'du',
      oreille: 'ting',
      ton: 'shuo',
      son: 'du',
      trace: 'xie'
    });
    const p = noterRevision(emptyProgress(JOUR), JOUR, juste('大'));
    expect(p.arts).toEqual(arts({ du: 1 }));
    expect(ARTS.map((a) => a.c).join('')).toBe('读写听说');
  });

  it('听 : le caractère reconnu au son ; 说 : son ton trouvé ; l’élément de son se lit, 读', () => {
    expect(artDe('oreille')).toBe('ting');
    expect(artDe('ton')).toBe('shuo');
    expect(artDe('son')).toBe('du');
    let p = noterRevision(emptyProgress(JOUR), JOUR, juste('马', { art: artDe('oreille') }));
    p = noterRevision(p, JOUR, juste('马', { art: artDe('ton') }));
    p = noterRevision(p, JOUR, juste('住', { art: artDe('son') }));
    expect(p.arts).toEqual(arts({ ting: 1, shuo: 1, du: 1 }));
  });

  it('un tracé achevé donne un point d’écriture, une fois par brique', () => {
    let p = traceAchevee(emptyProgress(JOUR), '人');
    expect(p.arts).toEqual(arts({ xie: 1 }));
    p = traceAchevee(p, '人');
    expect(p.arts).toEqual(arts({ xie: 1 }));
  });

  it('les points ne décroissent jamais, quoi qu’on réponde', () => {
    let p = emptyProgress(JOUR);
    let avant = 0;
    for (let i = 0; i < 60; i += 1) {
      p = noterRevision(p, JOUR, { c: '天', correct: i % 3 !== 0, tries: i % 2, seconds: i, art: ARTS[i % 4].id });
      expect(total(p.arts)).toBeGreaterThanOrEqual(avant);
      avant = total(p.arts);
    }
    expect(avant).toBe(40);
  });
});

describe('rien ne dépend du temps', () => {
  it('la vitesse ne change rien aux points : 1 s ou 10 min, un point', () => {
    const vite = noterRevision(emptyProgress(JOUR), JOUR, juste('人', { seconds: 1 }));
    const lent = noterRevision(emptyProgress(JOUR), JOUR, juste('人', { seconds: 600 }));
    expect(vite.arts).toEqual(lent.arts);
  });

  it('la journée ne change rien : les mêmes réponses, un autre jour, les mêmes points', () => {
    const a = noterRevision(emptyProgress('2026-01-01'), '2026-01-01', juste('人'));
    const b = noterRevision(emptyProgress('2031-07-14'), '2031-07-14', juste('人'));
    expect(a.arts).toEqual(b.arts);
  });

  it('le module ne lit ni l’horloge ni le hasard', () => {
    const code = source('heros.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/new Date|Date\.now|performance\.now|Math\.random|setTimeout|setInterval/);
  });

  it('la bulle de Tao ne dépend que des points et des examens', () => {
    const a = arts({ du: 30, xie: 2, ting: 1, shuo: 7 });
    const m = { reussis: {}, lus: 0, annonce: 0 };
    expect(phraseDeTao(DONNEES, a, 'Bao', m, nomExamen)).toBe(phraseDeTao(DONNEES, { ...a }, 'Bao', { ...m }, nomExamen));
    expect(phraseDeTao(DONNEES, a, 'Bao', m, nomExamen)).not.toMatch(/minute|heure|jour|temps|dommage|oubli/i);
  });
});

/* ---------- la bulle de Tao et le 放榜 ---------- */

describe('Tao, celle qui aide', () => {
  const rien = { reussis: {}, lus: 0, annonce: 0 };

  it('propose l’art le moins fourni', () => {
    expect(phraseDeTao(DONNEES, arts({ du: 30, xie: 2, ting: 1, shuo: 7 }), 'Bao', rien, nomExamen)).toBe(
      "Et si on essayait 听, écoute ? Je t'aide."
    );
  });

  it('compte les derniers points avant un rang, et ne dit jamais « 1 points »', () => {
    expect(phraseDeTao(DONNEES, arts({ du: 7 }), 'Bao', rien, nomExamen)).toBe('Plus que 3 points pour 蒙童 !');
    expect(phraseDeTao(DONNEES, arts({ du: 9 }), 'Bao', rien, nomExamen)).toBe("Plus qu'un point pour 蒙童 !");
  });

  it('sans point, propose d’y aller ; au sommet, de continuer', () => {
    expect(phraseDeTao(DONNEES, artsVides(), 'Bao', rien, nomExamen)).toBe('On y va ?');
    const sommet = { reussis: recus(...TITRES), lus: 1800, annonce: 0 };
    expect(phraseDeTao(DONNEES, arts({ du: 1000 }), 'Bao', sommet, nomExamen)).toBe(
      'Bao, premier du concours. On continue de lire ensemble ?'
    );
  });

  it('les points d’un titre atteints, dit l’examen qui reste, ou le palier de la nomination', () => {
    expect(phraseDeTao(DONNEES, arts({ du: 90 }), 'Bao', { ...rien, reussis: recus('xianshi', 'fushi') }, nomExamen)).toBe(
      'Les points de 秀才 y sont. Reste le 院试 : je t’accompagne.'.replace('’', "'")
    );
    const apresDianshi = { reussis: recus(...TITRES), lus: 900, annonce: 0 };
    expect(phraseDeTao(DONNEES, arts({ du: 400 }), 'Bao', apresDianshi, nomExamen)).toBe(
      '翰林 viendra à 1\u202f000 caractères lus. On lit ensemble ?'
    );
  });

  it('se présente, puis salue la bête choisie', () => {
    expect(phraseDuChoix(DONNEES, null)).toBe("Je suis Tao. Je t'aiderai sur le chemin, à chaque pas.");
    expect(phraseDuChoix(DONNEES, DONNEES.betes[1])).toBe(
      '熊猫, le panda ! Lent, têtu, et ne lâche jamais un caractère.'
    );
  });

  it('le 放榜 met le nom sur la liste, avec le rang, sa traduction et son rôle', () => {
    expect(texteFangbang(DONNEES, 4, 'Shi')).toBe(
      "Ton nom est sur la liste, Shi : 秀才, «\u00a0talent éclos\u00a0», reçu à l'examen du commissaire aux études. Tu en prends la tenue. Tao applaudit."
    );
  });
});

describe('le 放榜', () => {
  const h = { bete: 'tu' as const, nom: 'Yuè', rang: 0 };
  const avec = (du: number, reussis: Record<string, string> = {}): Progress => ({
    ...emptyProgress(JOUR),
    heros: h,
    arts: arts({ du }),
    examens: { ...emptyProgress(JOUR).examens, reussis }
  });

  it('ne s’annonce qu’au passage d’un rang, et une seule fois', () => {
    expect(titreAccorde(avec(9), RANGS, 0)).toBeNull();
    expect(titreAccorde(avec(10), RANGS, 0)).toBe(1);
    let p = avec(10);
    p = annoncerRang(p, 1);
    expect(titreAccorde(p, RANGS, 0)).toBeNull();
    expect(annoncerRang(p, 0).heros?.rang).toBe(1);
  });

  it('sans personnage, rien ne s’annonce', () => {
    expect(titreAccorde({ ...avec(500), heros: null }, RANGS, 0)).toBeNull();
  });

  it('plusieurs rangs d’un coup ne font qu’un 放榜, celui du plus haut', () => {
    expect(titreAccorde(avec(130, recus('xianshi', 'fushi', 'yuanshi', 'xiangshi')), RANGS, 0)).toBe(5);
  });
});

/* ---------- le choix ---------- */

describe('le choix du personnage', () => {
  it('se fait au premier lancement, après le rythme, dernier écran de la première session', () => {
    expect(ETAPES_DEPART[ETAPES_DEPART.length - 1]).toBe('personnage');
    /* Après le rythme, ou après l'heure du rappel dans l'app iOS (`rappels.test.ts`). */
    expect(departNext('heure')).toBe('personnage');
    expect(departNext('personnage')).toBeNull();
    const p = emptyProgress(JOUR);
    expect(p.premiere).toBe(true);
    expect(p.heros).toBeNull();
    const choisi = choisirHeros({ ...p, premiereVue: 'personnage' }, 'xiongmao', '  Bao  ', 0);
    expect(choisi.heros).toEqual({ bete: 'xiongmao', nom: 'Bao', rang: 0 });
    /* la première session finie, le personnage reste */
    const fini = finDepart(choisi, JOUR, new Date('2026-09-25T10:00:00Z'), ['人', '大', '天'], 4);
    expect(fini.heros).toEqual(choisi.heros);
    expect(fini.premiere).toBe(false);
  });

  it('se change sans rien perdre : les points et le rang annoncé restent', () => {
    let p: Progress = { ...emptyProgress(JOUR), arts: arts({ du: 90, xie: 3 }) };
    p = { ...p, examens: { ...p.examens, reussis: recus('xianshi', 'fushi', 'yuanshi') } };
    p = choisirHeros(p, 'tu', 'Yuè', rangTenu(RANGS, meriteDe(p, 0)));
    expect(p.heros?.rang).toBe(4);
    const change = choisirHeros(p, 'shi', 'Grelot', 0);
    expect(change.heros).toEqual({ bete: 'shi', nom: 'Grelot', rang: 4 });
    expect(change.arts).toEqual(p.arts);
  });

  it('un nom vide ne se range pas ; un nom trop long est coupé à seize signes', () => {
    const p = emptyProgress(JOUR);
    expect(choisirHeros(p, 'tu', '   ', 0)).toBe(p);
    expect(nettoyerNom('Pomponpomponpomponpompon')).toBe('Pomponpomponpomp');
    expect(nettoyerNom('月月  亮')).toBe('月月 亮');
  });

  it('au choix, aucun 放榜 pour les rangs déjà atteints', () => {
    const avant: Progress = { ...emptyProgress(JOUR), arts: arts({ du: 300 }) };
    const p = choisirHeros(avant, 'tu', 'Yuè', rangTenu(RANGS, meriteDe(avant, 0)));
    expect(p.heros?.rang).toBe(rang('学童'));
    expect(titreAccorde(p, RANGS, 0)).toBeNull();
  });
});

/* ---------- export et import ---------- */

function carteRevisee(id: string, notes: boolean[]): ReviewCard {
  let c = newCard(id, new Date('2026-09-01T08:00:00Z'));
  notes.forEach((j, i) => {
    c = schedule(c, { correct: j, tries: 0, seconds: 3 }, new Date(Date.UTC(2026, 8, 2 + i, 8))).card;
  });
  return c;
}

describe('export et import', () => {
  it('le personnage et ses points passent l’export JSON tels quels', () => {
    let p = emptyProgress(JOUR);
    p = choisirHeros(p, 'shi', '狮狮', 0);
    p = noterRevision(p, JOUR, juste('人', { art: 'shuo' }));
    p = traceAchevee(p, '大');
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.heros).toEqual({ bete: 'shi', nom: '狮狮', rang: 0 });
    expect(relu.arts).toEqual(arts({ shuo: 1, xie: 1 }));
    expect(relu.revisions[0].art).toBe('shuo');
  });

  it('une progression d’avant le personnage recalcule ses points depuis ce qu’elle garde', () => {
    const p: Progress = {
      ...emptyProgress(JOUR),
      cartes: [carteRevisee('人', [true, false, true]), carteRevisee('大', [true])],
      tracesAchevees: ['人', '大']
    };
    const brut = JSON.parse(toJSON(p)) as Record<string, unknown>;
    delete brut.arts;
    delete brut.heros;
    const relu = fromJSON(JSON.stringify(brut), JOUR);
    expect(relu.heros).toBeNull();
    expect(relu.arts).toEqual(arts({ du: 3, xie: 2 }));
    expect(pointsDerives(relu.cartes, relu.tracesAchevees)).toEqual(relu.arts);
  });

  it('les mêmes cartes relues à une autre date donnent les mêmes points', () => {
    const p: Progress = { ...emptyProgress(JOUR), cartes: [carteRevisee('人', [true, true])] };
    const brut = JSON.parse(toJSON(p)) as Record<string, unknown>;
    delete brut.arts;
    expect(fromJSON(JSON.stringify(brut), '2026-01-01').arts).toEqual(
      fromJSON(JSON.stringify(brut), '2030-12-31').arts
    );
  });

  it('un personnage ou des points aberrants ne passent pas', () => {
    expect(lireHeros({ bete: 'dragon', nom: 'X' })).toBeNull();
    expect(lireHeros({ bete: 'tu', nom: '   ' })).toBeNull();
    expect(lireHeros({ bete: 'tu', nom: 'Yuè', rang: -3 })).toEqual({ bete: 'tu', nom: 'Yuè', rang: 0 });
    const brut = JSON.parse(toJSON(emptyProgress(JOUR))) as Record<string, unknown>;
    brut.arts = { du: -4, xie: 1, ting: 0, shuo: 0 };
    brut.heros = { bete: 'qilin', nom: 'Lin' };
    const relu = fromJSON(JSON.stringify(brut), JOUR);
    expect(relu.arts).toEqual(artsVides());
    expect(relu.heros).toBeNull();
  });
});

/* ---------- l'aura ---------- */

describe("l'aura", () => {
  it('fait tourner les caractères déjà lus, dans l’ordre où ils sont entrés en révision', () => {
    const cartes = [
      carteRevisee('人', [true]),
      carteRevisee('大', [false]),
      carteRevisee('亻', [true]),
      carteRevisee('天', [true])
    ];
    expect(caracteresDeLAura(cartes)).toEqual(['人', '亻', '天']);
    expect(caracteresDeLAura(cartes, 2)).toEqual(['人', '亻']);
  });

  it('ne compte pas une réponse fausse comme lue', () => {
    expect(Rating.Again).toBe(1);
    expect(caracteresDeLAura([carteRevisee('大', [false, false])])).toEqual([]);
  });
});

/* ---------- « Points ET examen » (story 8.5) ---------- */

describe('« Points ET examen » : le titre', () => {
  it('s’accorde quand l’examen est réussi et les points atteints, dans l’ordre des rangs', () => {
    /* les points du 秀才, aucun examen : l'écolier 学童 */
    expect(rangAccorde(RANGS, merite(90))).toBe(rang('学童'));
    /* le 童生 demande le 县试 et le 府试 */
    expect(rangAccorde(RANGS, merite(90, recus('xianshi')))).toBe(rang('学童'));
    expect(rangAccorde(RANGS, merite(90, recus('xianshi', 'fushi')))).toBe(rang('童生'));
    expect(rangAccorde(RANGS, merite(90, recus('xianshi', 'fushi', 'yuanshi')))).toBe(rang('秀才'));
    /* l'examen réussi avant les points : le titre attend les points */
    expect(rangAccorde(RANGS, merite(60, recus('xianshi', 'fushi', 'yuanshi')))).toBe(rang('童生'));
    /* un titre attend le précédent : sans le 府试, le 院试 ne donne rien */
    expect(rangAccorde(RANGS, merite(200, recus('xianshi', 'yuanshi', 'xiangshi')))).toBe(rang('学童'));
  });

  it('les quatre nominations viennent à leur palier de caractères lus, après le 进士', () => {
    const tout = recus(...TITRES);
    expect(RANGS.slice(8).map((r) => [r.hz, r.palier])).toEqual([
      ['翰林', 1000],
      ['探花', 1200],
      ['榜眼', 1555],
      ['状元', 1800]
    ]);
    expect(rangAccorde(RANGS, merite(5000, tout, 999))).toBe(rang('进士'));
    expect(rangAccorde(RANGS, merite(5000, tout, 1000))).toBe(rang('翰林'));
    expect(rangAccorde(RANGS, merite(5000, tout, 1200))).toBe(rang('探花'));
    expect(rangAccorde(RANGS, merite(5000, tout, 1555))).toBe(rang('榜眼'));
    expect(rangAccorde(RANGS, merite(5000, tout, 1800))).toBe(rang('状元'));
    /* le palier ne dispense pas des points, ni des examens */
    expect(rangAccorde(RANGS, merite(400, tout, 1800))).toBe(rang('翰林'));
    expect(rangAccorde(RANGS, merite(5000, recus(...TITRES.slice(0, 5)), 1800))).toBe(rang('贡士'));
  });

  it('un 月课 ne donne ni ne retient un rang, même au palier d’une nomination', () => {
    const yueke = EXAMENS.examens.filter((e) => e.sorte === 'yueke').map((e) => e.id);
    expect(yueke).toHaveLength(31);
    /* tous les 月课 réussis, aucun examen à titre : aucun titre d'examen */
    expect(rangAccorde(RANGS, merite(5000, recus(...yueke), 1800))).toBe(rang('学童'));
    /* au palier de 榜眼 et de 状元, le 月课 du même palier pas encore passé ne retient rien */
    expect(EXAMENS.examens.some((e) => e.id === 'yueke-1555')).toBe(true);
    expect(rangAccorde(RANGS, merite(5000, recus(...TITRES), 1555))).toBe(rang('榜眼'));
    expect(rangAccorde(RANGS, merite(5000, recus(...TITRES), 1800))).toBe(rang('状元'));
    expect(RANGS.every((r) => r.examens.every((id) => !yueke.includes(id)))).toBe(true);
    expect(exigenceRemplie(RANGS[rang('榜眼')], { reussis: {}, lus: 1555 })).toBe(true);
  });

  it('la taille et la silhouette suivent les points, la tenue le titre accordé', () => {
    /* un 学童 qui a les points du 秀才 sans le 府试 : la taille et la silhouette d'un ado */
    const seul = merite(90);
    const recu = merite(90, recus('xianshi', 'fushi', 'yuanshi'));
    expect(rangDe(90, RANGS)).toBe(rang('秀才'));
    expect(RANGS[rangDe(90, RANGS)].age).toBe('ado');
    expect(taille(90, RANGS)).toBe(taille(90, RANGS));
    expect(rangAccorde(RANGS, seul)).toBe(rang('学童'));
    expect(rangAccorde(RANGS, recu)).toBe(rang('秀才'));
    /* le dessin : la silhouette change avec les points, la tenue avec le titre */
    const ecolierAdo = personnage('tu', rang('学童'), 1, rang('秀才'));
    expect(ecolierAdo).not.toBe(personnage('tu', rang('学童'), 1, rang('学童')));
    expect(ecolierAdo).not.toBe(personnage('tu', rang('秀才'), 1, rang('秀才')));
    /* le sac à livres 书袋 de l'écolier, sans la bande 襕 du 秀才 */
    expect(ecolierAdo).toContain('stroke="var(--h-ocre)" stroke-width="5"');
    expect(personnage('tu', rang('秀才'), 1, rang('秀才'))).not.toContain('stroke="var(--h-ocre)" stroke-width="5"');
  });

  it('l’en-tête montre le rang tenu : le titre accordé, jamais celui des seuls points', () => {
    expect(rangTenu(RANGS, merite(150))).toBe(rang('学童'));
    expect(rangTenu(RANGS, merite(150, recus('xianshi', 'fushi')))).toBe(rang('童生'));
    /* un titre annoncé ne se reprend pas, même si le compte des lus redescend */
    expect(rangTenu(RANGS, merite(5000, recus(...TITRES), 990, rang('翰林')))).toBe(rang('翰林'));
    expect(rangTenu([], merite(150))).toBe(0);
    /* ni pastille ni compteur dans l'en-tête : le portrait seul, à son rang */
    const menu = source('Menu.svelte');
    const entete = menu.slice(menu.indexOf('class="portrait"') - 200, menu.indexOf('class="portrait"') + 200);
    expect(entete).not.toMatch(/pastille|badge|compteur/i);
  });
});

describe('« Mon personnage » : ce qui reste avant le titre', () => {
  it('points atteints, examen pas encore réussi : la barre pleine, « Reste le 院试 »', () => {
    const av = avance(RANGS, merite(95, recus('xianshi', 'fushi')));
    expect(av).toMatchObject({ rang: rang('童生'), part: 1, manque: 0, reste: { attend: 'examen', examen: 'yuanshi' } });
    expect(remplir(TEXTES.reste, { examen: nomExamen('yuanshi') })).toBe('Reste le 院试');
    /* le 童生 : le premier des deux examens qui manque */
    expect(avance(RANGS, merite(60)).reste).toEqual({ attend: 'examen', examen: 'xianshi' });
  });

  it('l’examen réussi avant les points : « Reçu au 院试 · encore 12 points »', () => {
    const av = avance(RANGS, merite(68, recus('xianshi', 'fushi', 'yuanshi')));
    expect(av.reste).toEqual({ attend: 'recu', examen: 'yuanshi', manque: 12 });
    expect(av.part).toBeLessThan(1);
    expect(remplir(TEXTES.recu, { examen: nomExamen('yuanshi'), n: 12 })).toBe('Reçu au 院试 · encore 12 points');
    expect(avance(RANGS, merite(79, recus('xianshi', 'fushi', 'yuanshi'))).reste).toMatchObject({ attend: 'recu', manque: 1 });
  });

  it('ni l’un ni l’autre : la barre dit les points ; une nomination dit son palier', () => {
    expect(avance(RANGS, merite(60, recus('xianshi', 'fushi'))).reste).toEqual({ attend: 'points', manque: 20 });
    expect(avance(RANGS, merite(400, recus(...TITRES), 900)).reste).toEqual({ attend: 'palier', palier: 1000 });
  });

  it('le 榜 : les examens à titre réussis, chacun avec sa date, sans les 月课', () => {
    const reussis = { xianshi: '2026-10-12', 'yueke-75': '2026-11-20', fushi: '2026-12-18' };
    expect(examensRecus(EXAMENS.examens, reussis).map((r) => [r.examen.hz, r.jour])).toEqual([
      ['县试', '2026-10-12'],
      ['府试', '2026-12-18']
    ]);
  });

  it('suit la règle des examens : le même rang et la même attente que `examens.ts`', () => {
    for (const points of [0, 30, 60, 90, 150, 300, 600, 2000]) {
      for (const k of [0, 1, 2, 3, 4, 5, 6]) {
        for (const lus of [0, 999, 1200, 1800]) {
          const reussis = recus(...TITRES.slice(0, k), 'yueke-75');
          const m = merite(points, reussis, lus);
          const n = rangAccorde(RANGS, m);
          expect(n, `${points} points, ${k} examens, ${lus} lus`).toBe(
            rangAccordeDesExamens(points, RANGS, EXAMENS, reussis, lus)
          );
          const ex = resteAuRangSuivant(points, RANGS, EXAMENS, reussis, lus);
          const av = avance(RANGS, m).reste;
          if (av.attend === 'examen') expect(ex).toMatchObject({ attend: 'examen', examen: { id: av.examen } });
          if (av.attend === 'palier') expect(ex).toEqual({ attend: 'palier', palier: av.palier });
        }
      }
    }
  });
});

describe('les rangs d’une progression d’avant les examens', () => {
  it('gardent leur annonce : les examens en dessous sont comptés reçus, une fois', () => {
    /* une progression d'avant les examens : 秀才 annoncé aux seuls points */
    const avant: Progress = {
      ...emptyProgress(JOUR),
      heros: { bete: 'tu', nom: 'Yuè', rang: rang('秀才') },
      arts: arts({ du: 150 })
    };
    const brut = JSON.parse(toJSON(avant)) as Record<string, unknown>;
    delete brut.examens;
    const relu = fromJSON(JSON.stringify(brut), JOUR);
    expect(relu.examens.migre).toBe(false);
    const examens = migrerRangsAnnonces(relu.examens, relu.heros?.rang ?? 0, RANGS, EXAMENS.examens, JOUR);
    const p: Progress = { ...relu, examens };
    expect(Object.keys(examens.reussis)).toEqual(['xianshi', 'yueke-75', 'fushi', 'yueke-150', 'yuanshi']);
    expect(Object.values(examens.reussis).every((j) => j === JOUR)).toBe(true);
    expect(rangTenu(RANGS, meriteDe(p, 0))).toBe(rang('秀才'));
    /* le 举人 a ses points, pas son examen : aucun 放榜, « Reste le 乡试 » */
    expect(titreAccorde(p, RANGS, 0)).toBeNull();
    expect(avance(RANGS, meriteDe(p, 0)).reste).toEqual({ attend: 'examen', examen: 'xiangshi' });
    /* une seule fois */
    expect(migrerRangsAnnonces(examens, rang('状元'), RANGS, EXAMENS.examens, '2027-01-01')).toBe(examens);
    expect(lireEtatExamens(JSON.parse(toJSON(p)).examens).migre).toBe(true);
  });

  it('une nomination déjà annoncée reste, même sans ses caractères lus', () => {
    const p: Progress = {
      ...emptyProgress(JOUR),
      heros: { bete: 'shi', nom: 'Grelot', rang: rang('翰林') },
      arts: arts({ du: 420 })
    };
    const examens = migrerRangsAnnonces({ ...p.examens, migre: false }, rang('翰林'), RANGS, EXAMENS.examens, JOUR);
    expect(TITRES.every((id) => examens.reussis[id] === JOUR)).toBe(true);
    expect(rangTenu(RANGS, meriteDe({ ...p, examens }, 300))).toBe(rang('翰林'));
  });
});

describe('heros.json suit rangs.tsv', () => {
  it('chaque rang dit son examen ou son palier, comme examens.json', () => {
    expect(RANGS.map((r) => (r.palier !== null ? r.palier : r.examens.join(' ')))).toEqual([
      '', '', '', 'xianshi fushi', 'yuanshi', 'xiangshi', 'huishi', 'dianshi', 1000, 1200, 1555, 1800
    ]);
    for (const e of EXAMENS.examens.filter((x) => x.titre !== null)) {
      const r = RANGS.find((x) => x.hz === e.titre);
      expect(r?.examens[r.examens.length - 1]).toBe(e.id);
    }
    expect(EXAMENS.nominations.map((n) => [n.rang, n.palier])).toEqual(
      RANGS.filter((r) => r.palier !== null).map((r) => [r.hz, r.palier])
    );
  });
});
