/**
 * Le personnage (story 4.5, brief §8) : une règle par test. Les rangs et leurs seuils, la
 * taille qui ne décroît jamais, un point seulement par bonne réponse, rien qui dépende du
 * temps, l'export et l'import, le choix au premier lancement, le 放榜, la bulle de Tao.
 * La charte du dessin est dans `heros-charte.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import {
  ARTS,
  ART_DE_QUESTION,
  ECHELLES,
  artsVides,
  avance,
  caracteresDeLAura,
  lireHeros,
  lireHerosDonnees,
  nettoyerNom,
  phraseDeTao,
  phraseDuChoix,
  pointsDerives,
  rangAAnnoncer,
  rangDe,
  taille,
  texteFangbang,
  total,
  type Arts,
  type HerosDonnees
} from './heros';
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
    expect(RANGS[4]).toMatchObject({ fr: 'talent éclos', role: "reçu à l'examen du district" });
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
    expect(avance(4, RANGS)).toMatchObject({ rang: 0, manque: 6, part: 0.4 });
    expect(avance(10, RANGS)).toMatchObject({ rang: 1, manque: 15, part: 0 });
    expect(avance(1200, RANGS)).toMatchObject({ rang: 11, suivant: null, manque: 0, part: 1 });
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
      son: 'shuo',
      trace: 'xie'
    });
    const p = noterRevision(emptyProgress(JOUR), JOUR, juste('大'));
    expect(p.arts).toEqual(arts({ du: 1 }));
    expect(ARTS.map((a) => a.c).join('')).toBe('读写听说');
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

  it('la bulle de Tao ne dépend que des points', () => {
    const a = arts({ du: 30, xie: 2, ting: 1, shuo: 7 });
    expect(phraseDeTao(DONNEES, a, 'Bao')).toBe(phraseDeTao(DONNEES, { ...a }, 'Bao'));
    expect(phraseDeTao(DONNEES, a, 'Bao')).not.toMatch(/minute|heure|jour|temps|dommage|oubli/i);
  });
});

/* ---------- la bulle de Tao et le 放榜 ---------- */

describe('Tao, celle qui aide', () => {
  it('propose l’art le moins fourni', () => {
    expect(phraseDeTao(DONNEES, arts({ du: 30, xie: 2, ting: 1, shuo: 7 }), 'Bao')).toBe(
      "Et si on essayait 听, écoute ? Je t'aide."
    );
  });

  it('compte les derniers points avant un rang, et ne dit jamais « 1 points »', () => {
    expect(phraseDeTao(DONNEES, arts({ du: 7 }), 'Bao')).toBe('Plus que 3 points pour 蒙童 !');
    expect(phraseDeTao(DONNEES, arts({ du: 9 }), 'Bao')).toBe("Plus qu'un point pour 蒙童 !");
  });

  it('sans point, propose d’y aller ; au sommet, de continuer', () => {
    expect(phraseDeTao(DONNEES, artsVides(), 'Bao')).toBe('On y va ?');
    expect(phraseDeTao(DONNEES, arts({ du: 1000 }), 'Bao')).toBe(
      'Bao, premier du concours. On continue de lire ensemble ?'
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
      "Ton nom est sur la liste, Shi : 秀才, «\u00a0talent éclos\u00a0», reçu à l'examen du district. Tu grandis d'un cran. Tao applaudit."
    );
  });
});

describe('le 放榜', () => {
  const h = { bete: 'tu' as const, nom: 'Yuè', rang: 0 };

  it('ne s’annonce qu’au passage d’un rang, et une seule fois', () => {
    expect(rangAAnnoncer(h, arts({ du: 9 }), RANGS)).toBeNull();
    expect(rangAAnnoncer(h, arts({ du: 10 }), RANGS)).toBe(1);
    let p: Progress = { ...emptyProgress(JOUR), heros: h, arts: arts({ du: 10 }) };
    p = annoncerRang(p, 1);
    expect(rangAAnnoncer(p.heros, p.arts, RANGS)).toBeNull();
    expect(annoncerRang(p, 0).heros?.rang).toBe(1);
  });

  it('sans personnage, rien ne s’annonce', () => {
    expect(rangAAnnoncer(null, arts({ du: 500 }), RANGS)).toBeNull();
  });

  it('plusieurs rangs d’un coup ne font qu’un 放榜, celui du plus haut', () => {
    expect(rangAAnnoncer(h, arts({ du: 130 }), RANGS)).toBe(5);
  });
});

/* ---------- le choix ---------- */

describe('le choix du personnage', () => {
  it('se fait au premier lancement, après le rythme, dernier écran de la première session', () => {
    expect(ETAPES_DEPART[ETAPES_DEPART.length - 1]).toBe('personnage');
    expect(departNext('rythme')).toBe('personnage');
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
    p = choisirHeros(p, 'tu', 'Yuè', rangDe(total(p.arts), RANGS));
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
    const p = choisirHeros({ ...emptyProgress(JOUR), arts: arts({ du: 300 }) }, 'tu', 'Yuè', rangDe(300, RANGS));
    expect(rangAAnnoncer(p.heros, p.arts, RANGS)).toBeNull();
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
