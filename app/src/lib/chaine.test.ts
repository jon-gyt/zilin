/**
 * La chaîne de mots (décision du propriétaire du 30 septembre 2026) : chaque mot commence
 * où le précédent finit (火车 → 车站), on lit le mot, on choisit son sens parmi quatre.
 *
 * Un test par règle : le lien premier / dernier caractère ; l'acquis réel seul, des mots
 * dessinables et déjà lus en fiche ; pas deux fois le même mot ni le même sens ; quatre
 * sens sans doublon ni sens trop proche ; la même graine, la même manche ; la note (juste :
 * tous les caractères ; faux : ceux dont la fiche a fait lire le mot) ; ni chrono, ni
 * limite, ni score ; et la manche jouée sur l'export servi avec l'app.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  ENONCE_AUTRE_CHAINE,
  ENONCE_CHAINE,
  MAILLONS_MAX,
  PROPOSITIONS_CHAINE,
  SECONDES_PAR_MOT,
  chaineDeMots,
  chainesDeMots,
  dernier,
  motDe,
  motDuTour,
  motsDeChaine,
  motsDesFiches,
  motsPossibles,
  premier,
  sensProches,
  seSuivent,
  toursChaine,
  type MotChaine
} from './chaine';
import {
  ERREUR_SANS_NOTE,
  JEUX,
  MINUTES_MAX,
  corpusDeJeu,
  corpusVide,
  disponibles,
  evenementsANoter,
  fini,
  postureDuJeu,
  repondre,
  tour,
  type CorpusJeux,
  type Manche,
  type Tour
} from './jeux';
import { lirePaires, sensDuChoix } from './questions';
import { grade, SEUIL_DEBLOCAGE, type Outcome } from './srs';
import { SECONDES_VUE } from './utiliser';
import { VERSION_DONNEES, type Famille, type Fiche, type Index } from './content';

/* ---------- un petit corpus, en dur : aucun réseau, aucun fichier ---------- */

const mot = (hanzi: string, fr: string, en: string, porteurs: string[]): MotChaine => ({
  hanzi,
  pinyin: `py-${hanzi}`,
  fr,
  en,
  porteurs
});

/**
 * 站长 → 长大 → 大人 → 人生 → 生日 → 日子 → 子女 → 女人 → 人口 → 口水 : de quoi remplir
 * une manche. 车站 et 站长 ont un sens trop proche (« gare ») ; 水果 a un caractère non
 * acquis ; 火山 n'a été lu dans la fiche d'aucun de ses caractères ; 龙年 est un mot du
 * dragon.
 */
const MOTS: MotChaine[] = [
  mot('火车', 'train', 'train', ['车']),
  mot('车站', 'gare', 'station', ['站']),
  mot('站长', 'chef de gare', 'stationmaster', ['站']),
  mot('长大', 'grandir', 'to grow up', ['长']),
  mot('大人', 'adulte', 'adult', ['大']),
  mot('人生', 'la vie', 'life', ['生']),
  mot('生日', 'anniversaire', 'birthday', ['生']),
  mot('日子', 'date (du calendrier)', 'date', ['子']),
  mot('子女', 'les enfants', 'children', ['子']),
  mot('女人', 'femme', 'woman', ['女']),
  mot('人口', 'population', 'population', ['口']),
  mot('口水', 'salive', 'saliva', ['水']),
  mot('水果', 'fruit', 'fruit', ['果']),
  mot('火山', 'volcan', 'volcano', []),
  mot('山水', 'paysage', 'landscape', ['山']),
  mot('明天', 'demain', 'tomorrow', ['明']),
  mot('天天', 'tous les jours', 'every day', ['天']),
  mot('龙年', 'année du dragon', 'year of the dragon', ['年'])
];

const ACQUIS = [...'火车站长大人生日子女口水山明天龙年'];

function corpus(o: { acquis?: string[]; traits?: string[]; mots?: MotChaine[]; demo?: string[] } = {}): CorpusJeux {
  return {
    ...corpusVide(),
    /* L'acquis de démonstration du corpus commun : la chaîne ne le lit pas. */
    acquis: o.demo ?? [],
    traits: o.traits ?? [...ACQUIS, '果'],
    chaine: { mots: o.mots ?? MOTS, acquis: o.acquis ?? ACQUIS }
  };
}

const C = corpus();
const G = '2026-09-30/chaine/0';
const outcome = (o: Partial<Outcome> = {}): Outcome => ({ correct: true, tries: 0, seconds: 3, ...o });

function jouer(m: Manche, choix: (t: Tour) => string): Manche {
  let courante = m;
  while (!fini(courante)) {
    const t = tour(courante);
    if (t === null) break;
    courante = repondre(courante, choix(t), outcome()).manche;
  }
  return courante;
}

/* ---------- le contenu ---------- */

describe('les mots de la chaîne', () => {
  const fiche = (c: string, mots: [string, string][]): Fiche => ({
    c,
    pinyin: '',
    fr: '',
    en: '',
    parts: [c],
    nouveau: [],
    role: null,
    origine_fr: '',
    origine_en: '',
    etiquette: null,
    mots: mots.map(([hanzi, fr]) => ({ hanzi, pinyin: '', fr, en: '' })),
    niveaux: {},
    traits: [],
    medianes: []
  });

  it('viennent des mots des fiches, une fois chacun, avec les caractères qui les ont fait lire', () => {
    const che = fiche('车', [['火车', 'train'], ['车站', 'gare']]);
    const zhan = fiche('站', [['车站', 'gare (autre fiche)'], ['站长', 'chef de gare']]);
    const kou = fiche('口', [['火山', 'volcan'], ['人口', ''], ['口', 'bouche']]);
    const mots = motsDesFiches([che, zhan], [{ fiches: [kou] } as unknown as Famille]);
    expect(mots.map((m) => m.hanzi)).toEqual(['火车', '车站', '站长', '火山']);
    /* Le premier sens rencontré, et tous les caractères du mot dont la fiche le porte. */
    expect(mots.find((m) => m.hanzi === '车站')).toMatchObject({ fr: 'gare', porteurs: ['车', '站'] });
    /* Lu dans la fiche de 口, qui n'en est pas un caractère : aucun porteur. */
    expect(mots.find((m) => m.hanzi === '火山')?.porteurs).toEqual([]);
    /* Un mot sans sens, un caractère seul : écartés. */
    expect(motsDeChaine({ fiches: [] })).toBeNull();
  });

  it('se lisent avec l’acquis réel, jamais la démonstration', () => {
    const d = motsDeChaine({
      fiches: [fiche('车', [['火车', 'train']])],
      cartes: [
        { c: '车', stabilite: SEUIL_DEBLOCAGE + 1 },
        { c: '火', stabilite: 1 }
      ]
    });
    expect(d?.acquis).toEqual(['车']);
  });
});

describe('les mots qui peuvent se poser', () => {
  const possibles = motsPossibles(C).map((m) => m.hanzi);

  it('ont tous leurs caractères acquis, dans l’acquis réel seulement', () => {
    expect(possibles).not.toContain('水果');
    for (const w of possibles) for (const c of w) expect(ACQUIS).toContain(c);
    /* L'acquis de démonstration du corpus commun n'ouvre aucun mot. */
    const demo = corpus({ acquis: [], demo: ACQUIS });
    expect(motsPossibles(demo)).toEqual([]);
    expect(JEUX.chaine.preparer(demo, G)).toBeNull();
  });

  it('sont dessinables : un caractère sans traits ferme ses mots', () => {
    const sansTraits = corpus({ traits: ACQUIS.filter((c) => c !== '日') });
    for (const m of motsPossibles(sansTraits)) expect(m.hanzi).not.toContain('日');
    for (const t of JEUX.chaine.preparer(sansTraits, G)?.tours ?? []) expect(t.maillon).not.toContain('日');
  });

  it('ont été lus dans la fiche de l’un de leurs caractères', () => {
    expect(possibles).not.toContain('火山');
    expect(possibles).toContain('山水');
  });

  it('ne sont jamais des mots du dragon', () => {
    expect(possibles).not.toContain('龙年');
  });
});

/* ---------- la chaîne ---------- */

describe('la chaîne la plus longue', () => {
  const suite = chaineDeMots(C, G);

  it('relie chaque mot au suivant : le dernier caractère de l’un est le premier de l’autre', () => {
    expect(suite.length).toBeGreaterThanOrEqual(2);
    for (let k = 1; k < suite.length; k++) {
      expect(dernier(suite[k - 1])).toBe(premier(suite[k]));
      expect(seSuivent(suite[k - 1], suite[k])).toBe(true);
    }
    expect(seSuivent('火车', '火车')).toBe(false);
    expect(seSuivent('火车', '大人')).toBe(false);
  });

  it('est la plus longue que l’acquis permet, jusqu’à la manche pleine', () => {
    /* 站长 → … → 口水 fait dix mots : la chaîne s'arrête à MAILLONS_MAX. */
    expect(suite).toHaveLength(MAILLONS_MAX);
    /* Moins d'acquis, chaîne plus courte : c'est l'acquis qui la borne. */
    const moins = corpus({ acquis: ACQUIS.filter((c) => c !== '生') });
    expect(chaineDeMots(moins, G).length).toBeLessThan(MAILLONS_MAX);
    /* Aucun lien, aucune chaîne. */
    const seuls = corpus({ mots: MOTS.filter((m) => ['火车', '大人', '山水', '明天', '女人'].includes(m.hanzi)) });
    expect(chaineDeMots(seuls, G)).toEqual([]);
    expect(JEUX.chaine.preparer(seuls, G)).toBeNull();
  });

  it('ne pose jamais deux fois le même mot, ni deux mots de même sens', () => {
    for (const g of [G, 'a', 'b', 'c', 'd']) {
      const toutes = chainesDeMots(C, g).flat();
      expect(new Set(toutes).size).toBe(toutes.length);
      /* 车站 et 站长 disent tous deux « gare » : jamais ensemble. */
      expect(toutes.includes('车站') && toutes.includes('站长')).toBe(false);
      for (const a of toutes) {
        for (const b of toutes) {
          if (a !== b) expect(sensProches(motDe(a, C) as MotChaine, motDe(b, C) as MotChaine), `${a} ${b}`).toBe(false);
        }
      }
    }
  });

  it('repart d’une autre chaîne quand la première s’arrête, et l’énoncé le dit', () => {
    /* Deux chaînes de deux mots, rien qui les relie ; les autres mots servent de leurres. */
    const deux = corpus({
      mots: MOTS.filter((m) => ['火车', '车站', '明天', '天天', '女人', '山水', '口水', '生日'].includes(m.hanzi))
    });
    const chaines = chainesDeMots(deux, G);
    expect(chaines).toHaveLength(2);
    expect(chaines.map((x) => [...x].sort())).toEqual(expect.arrayContaining([['火车', '车站'], ['天天', '明天']]));
    const tours = toursChaine(deux, G);
    expect(tours.map((t) => t.enonce)).toEqual([ENONCE_CHAINE, ENONCE_CHAINE, ENONCE_AUTRE_CHAINE, ENONCE_CHAINE]);
    expect(tours.map((t) => t.suite?.length)).toEqual([0, 1, 0, 1]);
    expect(JEUX.chaine.constat(jouer(JEUX.chaine.preparer(deux, G) as Manche, (t) => t.reponse[0]))).toBe(
      '2 chaînes, la plus longue de 2 mots, 4 sens trouvés.'
    );
  });

  it('à graine égale, toujours la même manche', () => {
    expect(JEUX.chaine.preparer(C, G)).toEqual(JEUX.chaine.preparer(C, G));
    expect(chainesDeMots(C, 'x')).toEqual(chainesDeMots(C, 'x'));
    /* Une autre graine peut partir d'ailleurs : l'ordre des départs vient d'elle. */
    const departs = new Set(['1', '2', '3', '4', '5', '6', '7', '8'].map((g) => chaineDeMots(C, g)[0]));
    expect(departs.size).toBeGreaterThan(1);
  });
});

/* ---------- les tours ---------- */

describe('un tour de la chaîne', () => {
  const m = JEUX.chaine.preparer(C, G);
  if (!m) throw new Error('manche attendue');

  it('fait lire chaque mot, le premier compris, le mot d’avant restant visible', () => {
    const suite = chaineDeMots(C, G);
    expect(m.tours.map((t) => t.maillon)).toEqual(suite);
    m.tours.forEach((t, k) => {
      expect(t.suite).toEqual(suite.slice(0, k));
      expect(motDuTour(t, C)?.hanzi).toBe(suite[k]);
      if (k > 0) expect(premier(t.maillon ?? '')).toBe(dernier(suite[k - 1]));
    });
    expect(m.tours[0].enonce).toBe(ENONCE_CHAINE);
  });

  it('pose quatre sens, le bon et trois leurres, sans doublon ni sens trop proche', () => {
    for (const t of m.tours) {
      const w = motDuTour(t, C) as MotChaine;
      expect(t.choix).toHaveLength(PROPOSITIONS_CHAINE);
      expect(new Set(t.choix).size).toBe(PROPOSITIONS_CHAINE);
      /* Le bon sens, sans ses parenthèses : il ne se désigne pas par sa forme. */
      expect(t.reponse).toEqual([sensDuChoix(w.fr)]);
      expect(t.choix).toContain(t.reponse[0]);
      const sens = t.choix.map((s) => MOTS.find((x) => sensDuChoix(x.fr) === s) as MotChaine);
      for (const a of sens) expect(a).toBeDefined();
      for (const a of sens) for (const b of sens) if (a !== b) expect(sensProches(a, b), `${a.fr} ${b.fr}`).toBe(false);
    }
    expect(m.tours.some((t) => t.maillon === '日子' && t.reponse[0] === 'date')).toBe(true);
  });

  it('prend ses leurres dans les sens d’autres mots de l’acquis, jamais celui d’un mot déjà lu', () => {
    const possibles = new Set(motsPossibles(C).map((x) => sensDuChoix(x.fr)));
    const lus: string[] = [];
    for (const t of m.tours) {
      for (const s of t.choix) expect(possibles.has(s)).toBe(true);
      for (const s of t.choix.filter((x) => x !== t.reponse[0])) expect(lus).not.toContain(s);
      lus.push(t.reponse[0]);
    }
  });

  it('ne rapproche pas deux sens qui se désignent : « ami » et « ami proche », « to miss » et « to miss someone »', () => {
    const s = (fr: string, en = ''): { fr: string; en: string } => ({ fr, en });
    expect(sensProches(s('ami'), s('ami proche'))).toBe(true);
    expect(sensProches(s('petite amie ; amie'), s('ami'))).toBe(true);
    expect(sensProches(s('grand'), s('grandement, largement'))).toBe(true);
    expect(sensProches(s('regretter l’absence de', 'to miss'), s('penser à quelqu’un qui manque', 'to miss someone'))).toBe(true);
    expect(sensProches(s('demain (registre soutenu)'), s('demain'))).toBe(true);
    /* Les mots vides ne rapprochent rien. */
    expect(sensProches(s('faire un tour', 'to take a walk'), s('faire attention', 'to take care'))).toBe(false);
    expect(sensProches(s('tous les jours', 'every day'), s('tous les mois', 'every month'))).toBe(false);
  });
});

/* ---------- la note ---------- */

describe('la note de la chaîne', () => {
  const m = JEUX.chaine.preparer(C, G);
  if (!m) throw new Error('manche attendue');
  /* Le premier tour dont la fiche n'est pas celle du premier caractère : 站长, 长大… sont lus
     dans la fiche de leur premier caractère ; 日子, 人生 dans celle du second. */
  const k = m.tours.findIndex((t) => t.fautifs !== undefined && !t.fautifs.includes(t.c));
  const avant = { ...m, i: k };
  const t = m.tours[k];

  it('juste : note tous les caractères du mot, par grade, sans leurre inventé', () => {
    expect(k).toBeGreaterThanOrEqual(0);
    const r = repondre(avant, t.reponse[0], outcome({ seconds: 4 }));
    expect(r.evenements.map((e) => e.c)).toEqual([...new Set(t.maillon)]);
    for (const e of r.evenements) {
      expect(e).toEqual({ c: e.c, correct: true, tries: 0, seconds: 4 });
      expect(grade(e)).toBe(r.note);
    }
    expect(evenementsANoter('chaine', r)).toEqual(r.evenements);
  });

  it('faux : note le caractère dont la fiche a fait lire le mot, et lui seul', () => {
    const leurre = t.choix.find((x) => x !== t.reponse[0]) as string;
    const r = repondre(avant, leurre, outcome({ seconds: 4 }));
    expect(r.correct).toBe(false);
    expect(r.montre).toBe(true);
    expect(r.evenements.map((e) => e.c)).toEqual(t.fautifs);
    expect(r.evenements.map((e) => e.c)).not.toContain(t.c);
    expect(r.note).toBe(Rating.Again);
    /* Un sens n'est pas un caractère : pas de fausse confusion dans les cartes. */
    for (const e of r.evenements) expect(e.leurres).toBeUndefined();
    /* Un mot déjà lu mal compris est une vraie erreur de lecture : elle est notée. */
    expect(ERREUR_SANS_NOTE).not.toContain('chaine');
    expect(evenementsANoter('chaine', r)).toEqual(r.evenements);
    /* Un sens manqué ne coupe pas la chaîne : pas de vie à perdre. */
    expect(fini(r.manche)).toBe(false);
  });
});

/* ---------- le contrat du jeu ---------- */

describe('le jeu de la chaîne', () => {
  it('n’a ni chronomètre, ni limite : un jeu de lecture, comme l’éclair', () => {
    expect(JEUX.chaine.chrono).toBe(0);
    expect(JEUX.chaine.limite).toBe(0);
    expect(JEUX.eclair.limite).toBe(0);
  });

  it('pose neuf mots au plus : trois minutes, vingt secondes par mot comme à l’éclair', () => {
    expect(SECONDES_PAR_MOT).toBe(SECONDES_VUE.eclair);
    expect(MAILLONS_MAX).toBe((MINUTES_MAX * 60) / SECONDES_PAR_MOT);
    expect(JEUX.chaine.tours).toBe(MAILLONS_MAX);
    expect(JEUX.chaine.minutes).toBe(MINUTES_MAX);
    expect(JEUX.chaine.preparer(C, G)?.tours.length).toBeLessThanOrEqual(MAILLONS_MAX);
  });

  it('dit ce qu’il fait lire, et une ligne neutre tant qu’il ne se joue pas', () => {
    expect(JEUX.chaine.id).toBe('chaine');
    expect(JEUX.chaine.zh).toBe('链');
    expect(JEUX.chaine.lit).toMatch(/mots/);
    expect(JEUX.chaine.indisponible).toMatch(/mots/);
    expect(disponibles(C, G)).toContain('chaine');
    expect(disponibles(corpusVide(), G)).not.toContain('chaine');
    expect(postureDuJeu('chaine')).toBe('jeu');
  });

  it('a pour constat sa longueur en mots et les sens trouvés, sans score', () => {
    const m = JEUX.chaine.preparer(C, G) as Manche;
    const juste = jouer(m, (t) => t.reponse[0]);
    expect(JEUX.chaine.constat(juste)).toBe(`Chaîne de ${MAILLONS_MAX} mots, ${MAILLONS_MAX} sens trouvés.`);
    const rate = jouer(repondre(m, '?', outcome()).manche, (t) => t.reponse[0]);
    expect(JEUX.chaine.constat(rate)).toBe(`Chaîne de ${MAILLONS_MAX} mots, ${MAILLONS_MAX - 1} sens trouvés.`);
    expect(JEUX.chaine.constat(rate)).not.toMatch(/point|score|vie|record|classement|coffre|bravo/i);
  });

  it('se dessine depuis les traits, sans cinabre, ombre, dégradé ni dragon', () => {
    const tourSource = readFileSync(new URL('ChaineTour.svelte', import.meta.url), 'utf8');
    expect(tourSource).toContain('<Glyph seul char={c}');
    expect(tourSource).not.toMatch(/--zhu|box-shadow|drop-shadow|gradient|gold|doré|dragon|龙/i);
    const game = readFileSync(new URL('Game.svelte', import.meta.url), 'utf8');
    expect(game).toContain('<ChaineTour {t} {corpus} {resultat} {donnee}');
  });
});

/* ---------- sur l'export servi avec l'app ---------- */

describe('la chaîne de mots sur le parcours Lire (export servi)', () => {
  const lire = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
  const dossier = `../../public/data/${VERSION_DONNEES}`;
  const index = lire(`${dossier}/index.json`) as Index;
  const familles = index.familles.map((f) => lire(`${dossier}/${f.fichier}`) as Famille);
  const traits = index.familles.flatMap((f) =>
    Object.keys((lire(`${dossier}/${f.traits}`) as { traits: Record<string, unknown> }).traits)
  );
  const paires = lirePaires(lire(`${dossier}/paires.json`));
  const acquisAuJour = (n: number): string[] => [
    ...new Set(
      index.parcours.lire.jours
        .filter((j) => j.jour <= n)
        .flatMap((j) => [j.brique, ...j.composes])
        .filter((c): c is string => typeof c === 'string' && c !== '')
    )
  ];
  const corpusAuJour = (n: number): CorpusJeux =>
    corpusDeJeu({
      fiches: familles.flatMap((f) => f.fiches),
      familles,
      paires,
      traits,
      cartes: acquisAuJour(n).map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 }))
    });

  it('pose une manche pleine dès l’ouverture de Jouer, et jusqu’au bout du parcours', () => {
    for (const n of [6, 20, 95, 189]) {
      const corpus = corpusAuJour(n);
      const acquis = new Set(acquisAuJour(n));
      const m = JEUX.chaine.preparer(corpus, `2026-09-30/chaine/${n}`);
      if (!m) throw new Error(`manche attendue au jour ${n}`);
      expect(m.tours.length, `jour ${n}`).toBe(MAILLONS_MAX);
      for (const t of m.tours) {
        const w = t.maillon ?? '';
        for (const c of w) {
          expect(acquis.has(c), `${w} au jour ${n}`).toBe(true);
          expect(traits).toContain(c);
        }
        const s = t.suite ?? [];
        if (s.length > 0) expect(premier(w)).toBe(dernier(s[s.length - 1]));
        expect(new Set(t.choix).size).toBe(PROPOSITIONS_CHAINE);
      }
      const lus = m.tours.map((t) => t.maillon);
      expect(new Set(lus).size).toBe(lus.length);
    }
  });

  it('se tait sans acquis réel : la démonstration ne fait lire aucun mot', () => {
    const corpus = corpusDeJeu({ fiches: familles.flatMap((f) => f.fiches), familles, paires, traits, cartes: [] });
    expect(JEUX.chaine.preparer(corpus, G)).toBeNull();
  });
});
