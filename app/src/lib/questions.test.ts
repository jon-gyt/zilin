import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  TYPES,
  NB_LEURRES,
  acquis,
  composantSon,
  corriger,
  estBrique,
  expliquer,
  indiceErreur,
  leurres,
  lirePaires,
  outcomeDuTrace,
  question,
  ressemblance,
  serie,
  typesPossibles,
  type Corpus,
  type Question,
  type TypeQuestion
} from './questions';
import type { Fiche } from './content';

/* ---------- corpus de test, en dur : aucun réseau, aucun fichier de contenu ---------- */

const f = (
  c: string,
  pinyin: string,
  fr: string,
  parts: string[],
  role: Fiche['role'],
  origine: string,
  extra: Partial<Fiche> = {}
): Fiche => ({
  c,
  pinyin,
  fr,
  en: '',
  parts,
  role,
  origine_fr: origine,
  origine_en: '',
  etiquette: 'atteste',
  mots: [],
  nouveau: [],
  niveaux: {},
  traits: [],
  medianes: [],
  ...extra
});

const FICHES: Fiche[] = [
  f('人', 'rén', 'une personne', [], 'sens', 'Deux jambes qui marchent.', {
    traits: ['M 1 1', 'M 2 2'],
    mots: [{ hanzi: '大人', pinyin: 'dàrén', fr: 'un adulte', en: '' }]
  }),
  f('大', 'dà', 'grand', [], 'sens', 'Un homme bras écartés.'),
  f('天', 'tiān', 'le ciel', ['一', '大'], 'sens', "Ce qui est au-dessus de l'homme."),
  f('夫', 'fū', 'un homme fait', [], 'forme', "L'épingle dans les cheveux de l'adulte."),
  f('主', 'zhǔ', 'le maître', ['丶', '王'], 'son', 'La flamme sur la lampe.'),
  f('住', 'zhù', 'habiter', ['亻', '主'], 'sens', 'La personne et sa flamme.'),
  f('王', 'wáng', 'le roi', [], 'sens', 'Trois plans reliés par un trait.'),
  f('玉', 'yù', 'le jade', [], 'sens', 'Trois disques de jade enfilés.'),
  f('女', 'nǚ', 'une femme', [], 'sens', 'Une femme agenouillée.'),
  f('子', 'zǐ', 'un enfant', [], 'sens', 'Un nourrisson emmailloté.'),
  f('好', 'hǎo', 'bon', ['女', '子'], 'sens', "Une femme et un enfant : ce qui est bien.", {
    audio: 'audio/hao.mp3',
    mots: [{ hanzi: '好人', pinyin: 'hǎorén', fr: 'quelqu’un de bien', en: '' }]
  })
];

const DECOMPOSITIONS: Record<string, string[]> = {
  人: ['人'],
  大: ['大'],
  天: ['一', '大'],
  夫: ['夫'],
  主: ['丶', '王'],
  住: ['亻', '主'],
  王: ['王'],
  玉: ['玉'],
  女: ['女'],
  子: ['子'],
  好: ['女', '子']
};

const PAIRES = [
  ['己', '已', '巳'],
  ['未', '末'],
  ['天', '夫'],
  ['日', '曰'],
  ['人', '入'],
  ['土', '士'],
  ['王', '玉', '主']
];

/** Tout est acquis sauf 玉, resté sous le seuil. */
const ACQUIS = FICHES.map((x) => ({ c: x.c, stabilite: x.c === '玉' ? 2 : 10 }));

const CORPUS: Corpus = {
  fiches: FICHES,
  decompositions: DECOMPOSITIONS,
  acquis: ACQUIS,
  paires: PAIRES
};

const fiche = (c: string): Fiche => {
  const x = FICHES.find((y) => y.c === c);
  if (!x) throw new Error(c);
  return x;
};

/** Une fiche par type, pour couvrir les sept. */
const PORTEUR: Record<TypeQuestion, string> = {
  sens: '好',
  caractere: '好',
  assemblage: '好',
  trou: '好',
  oreille: '好',
  son: '住',
  trace: '人'
};

const poser = (type: TypeQuestion, graine = 'g'): Question =>
  question(fiche(PORTEUR[type]), type, CORPUS, graine);

/* ---------- les sept types ---------- */

describe('les sept types de questions', () => {
  it('le module en produit sept, pas un de plus', () => {
    expect(TYPES).toEqual(['sens', 'caractere', 'assemblage', 'trou', 'oreille', 'son', 'trace']);
  });

  it('chaque type se pose et porte un énoncé, une réponse et une explication', () => {
    for (const t of TYPES) {
      const q = poser(t);
      expect(q.type).toBe(t);
      expect(q.enonce.length).toBeGreaterThan(0);
      expect(q.reponse.length).toBeGreaterThan(0);
      expect(q.explication.texte.length).toBeGreaterThan(0);
    }
  });

  it('assemblage : la réponse est la suite des briques dans l’ordre d’écriture', () => {
    expect(poser('assemblage').reponse).toEqual(['女', '子']);
  });

  it('trou : le mot est coupé autour du caractère', () => {
    const q = poser('trou');
    expect(q.mot?.hanzi).toBe('好人');
    expect(q.avant).toBe('');
    expect(q.apres).toBe('人');
  });

  it('oreille : l’audio est une référence de fichier', () => {
    expect(poser('oreille').audio).toBe('audio/hao.mp3');
  });

  it('son : la bonne réponse est le composant de rôle son', () => {
    const q = poser('son');
    expect(q.reponse).toEqual(['主']);
    expect(composantSon(fiche('住'), CORPUS)).toBe('主');
  });

  it('trace : pas de QCM, le caractère et ses traits', () => {
    const q = poser('trace');
    expect(q.choix).toEqual([]);
    expect(q.reponse).toEqual(['人']);
    expect(q.traits).toBe(2);
  });
});

/* ---------- les leurres ---------- */

describe('leurres par ressemblance de composants', () => {
  it('les premiers leurres partagent des composants avec la cible', () => {
    const { leurres: l } = leurres('好', ['女', '子', '天', '王'], CORPUS, 'g');
    expect(l.slice(0, 2).sort()).toEqual(['女', '子']);
  });

  it('une paire à ne pas confondre passe devant un simple composant partagé', () => {
    const avec = leurres('天', ['大', '夫', '女'], CORPUS, 'g').leurres;
    expect(avec[0]).toBe('夫');
    const sans = leurres('天', ['大', '夫', '女'], { ...CORPUS, paires: [] }, 'g').leurres;
    expect(sans[0]).toBe('大');
    expect(ressemblance('天', '夫', CORPUS)).toBeGreaterThan(ressemblance('天', '大', CORPUS));
  });

  it('jamais la bonne réponse, jamais deux fois le même leurre', () => {
    for (const t of TYPES) {
      const q = poser(t);
      for (const bonne of q.reponse) expect(q.leurres).not.toContain(bonne);
      expect(new Set(q.leurres).size).toBe(q.leurres.length);
      expect(new Set(q.choix).size).toBe(q.choix.length);
    }
  });

  it('les choix contiennent la bonne réponse, sauf pour le tracé', () => {
    for (const t of TYPES) {
      const q = poser(t);
      if (t === 'trace') continue;
      if (t === 'assemblage') for (const b of q.reponse) expect(q.choix).toContain(b);
      else expect(q.choix).toContain(q.reponse[0]);
    }
  });

  it('assemblage : les leurres sont des briques, jamais un composé ni le caractère demandé', () => {
    const q = poser('assemblage');
    expect(q.leurres).not.toContain('好');
    expect(q.leurres).not.toContain('住');
    for (const l of q.leurres) expect(q.reponse).not.toContain(l);
  });

  it('trois leurres quand le corpus le permet', () => {
    const q = poser('caractere');
    expect(q.leurres).toHaveLength(NB_LEURRES);
    expect(q.manqueLeurres).toBe(0);
  });

  it('un corpus trop pauvre rend moins de leurres et signale le manque', () => {
    const pauvre: Corpus = { ...CORPUS, acquis: [{ c: '女', stabilite: 10 }] };
    const q = question(fiche('好'), 'caractere', pauvre, 'g');
    expect(q.leurres).toEqual(['女']);
    expect(q.manqueLeurres).toBe(NB_LEURRES - 1);
  });

  it('un caractère montré est toujours un caractère acquis', () => {
    expect(acquis(CORPUS)).not.toContain('玉');
    for (const t of ['caractere', 'trou', 'oreille'] as TypeQuestion[]) {
      const q = poser(t);
      for (const l of q.leurres) expect(acquis(CORPUS)).toContain(l);
    }
    const roi = question(fiche('王'), 'caractere', CORPUS, 'g');
    expect(roi.leurres).not.toContain('玉');
    expect(roi.leurres[0]).toBe('主');
  });

  it('le sens, lui, peut emprunter à ce qui n’est pas encore acquis', () => {
    const pauvre: Corpus = { ...CORPUS, acquis: [{ c: '女', stabilite: 10 }] };
    const q = question(fiche('好'), 'sens', pauvre, 'g');
    expect(q.leurres).toHaveLength(NB_LEURRES);
    expect(q.manqueLeurres).toBe(0);
  });
});

/* ---------- déterminisme ---------- */

describe('tirage déterministe', () => {
  it('même graine, même question', () => {
    for (const t of TYPES) expect(poser(t, 'graine-1')).toEqual(poser(t, 'graine-1'));
  });

  it('graine différente, tirage différent', () => {
    const ordres = new Set(['a', 'b', 'c', 'd', 'e'].map((g) => poser('caractere', g).choix.join('')));
    expect(ordres.size).toBeGreaterThan(1);
  });

  it('une série entière se rejoue à l’identique', () => {
    const dues = ['好', '人', '住', '天'];
    expect(serie(dues, CORPUS, 's')).toEqual(serie(dues, CORPUS, 's'));
  });
});

/* ---------- types possibles ---------- */

describe('les types que la fiche permet', () => {
  it('son : seulement si un composant donne le son', () => {
    expect(typesPossibles(fiche('住'), CORPUS)).toContain('son');
    expect(typesPossibles(fiche('好'), CORPUS)).not.toContain('son');
  });

  it('trou : seulement s’il y a un mot', () => {
    expect(typesPossibles(fiche('好'), CORPUS)).toContain('trou');
    expect(typesPossibles(fiche('住'), CORPUS)).not.toContain('trou');
  });

  it('oreille : seulement si un audio est référencé', () => {
    expect(typesPossibles(fiche('好'), CORPUS)).toContain('oreille');
    expect(typesPossibles(fiche('天'), CORPUS)).not.toContain('oreille');
  });

  it('assemblage : seulement si le caractère se décompose', () => {
    expect(typesPossibles(fiche('天'), CORPUS)).toContain('assemblage');
    expect(typesPossibles(fiche('人'), CORPUS)).not.toContain('assemblage');
  });

  it('trace : seulement pour une brique de base, et si le tracé est activé', () => {
    expect(estBrique(fiche('人'))).toBe(true);
    expect(typesPossibles(fiche('人'), CORPUS)).toContain('trace');
    expect(typesPossibles(fiche('好'), CORPUS)).not.toContain('trace');
    expect(typesPossibles(fiche('人'), { ...CORPUS, trace: false })).not.toContain('trace');
  });

  it('un type impossible est refusé', () => {
    expect(() => question(fiche('好'), 'son', CORPUS, 'g')).toThrow();
  });
});

/* ---------- la série ---------- */

describe('une série de questions', () => {
  const dues = ['好', '人', '住', '天', '好', '人'];

  it('une question par carte due', () => {
    expect(serie(dues, CORPUS, 's')).toHaveLength(dues.length);
  });

  it('jamais deux fois le même type d’affilée', () => {
    for (const g of ['s', 't', 'u', 'v']) {
      const types = serie(dues, CORPUS, g).map((q) => q.type);
      for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
    }
  });

  it('une carte sans fiche est passée', () => {
    expect(serie(['好', '龍'], CORPUS, 's')).toHaveLength(1);
  });
});

/* ---------- correction ---------- */

describe('correction explicative par les briques', () => {
  const brut = { correct: false, tries: 0, seconds: 3 };

  it('la bonne réponse est juste, et l’outcome est prêt pour grade', () => {
    const q = poser('sens');
    const r = corriger(q, q.reponse[0], { correct: false, tries: 0, seconds: 4 });
    expect(r.correct).toBe(true);
    expect(r.outcome).toEqual({ correct: true, tries: 0, seconds: 4 });
  });

  it('un leurre est faux', () => {
    const q = poser('caractere');
    expect(corriger(q, q.leurres[0], brut).correct).toBe(false);
  });

  it('l’explication nomme les briques et leur rôle', () => {
    const e = expliquer(fiche('住'), CORPUS);
    expect(e.briques.map((b) => b.c)).toEqual(['亻', '主']);
    expect(e.briques[1]).toEqual({ c: '主', fr: 'le maître', role: 'son' });
    expect(e.texte).toContain('亻 + 主');
    expect(e.texte).toContain('le maître');
    expect(e.texte).toContain('La personne et sa flamme.');
    expect(e.etiquette).toBe('atteste');
  });

  it('la correction rend toujours la fiche d’explication', () => {
    const q = poser('caractere');
    expect(corriger(q, q.leurres[0], brut).explication).toEqual(q.explication);
  });

  it('une réponse fausse garde le leurre pris, le caractère derrière un sens compris', () => {
    const q = poser('caractere');
    const leurre = q.leurres[0];
    expect(corriger(q, leurre, brut).outcome.leurres).toEqual([leurre]);
    /* Juste au second essai : le leurre du premier reste dans l'événement. */
    const rattrape = corriger(q, q.reponse[0], { ...brut, tries: 1 }, [leurre]);
    expect(rattrape.correct).toBe(true);
    expect(rattrape.outcome.leurres).toEqual([leurre]);
    /* Juste du premier coup : aucun leurre, le champ est absent. */
    expect('leurres' in corriger(q, q.reponse[0], brut).outcome).toBe(false);
    /* Le sens choisi désigne le caractère dont il est le sens. */
    const s = poser('sens');
    const source = s.sourcesLeurres?.[0] ?? '';
    expect(fiche(source).fr).toBe(s.leurres[0]);
    expect(corriger(s, s.leurres[0], brut).outcome.leurres).toEqual([source]);
  });

  it('un assemblage dans le désordre ne désigne aucun leurre ; un tracé ne le sait pas', () => {
    const q = poser('assemblage');
    expect(corriger(q, ['子', '女'], brut).outcome.leurres).toEqual([]);
    expect(corriger(q, [q.leurres[0], '子'], brut).outcome.leurres).toEqual([q.leurres[0]]);
    const t = poser('trace');
    expect('leurres' in corriger(t, { erreurs: 5 }, brut).outcome).toBe(false);
  });

  it('assemblage : l’ordre d’écriture compte', () => {
    const q = poser('assemblage');
    expect(corriger(q, ['女', '子'], brut).correct).toBe(true);
    expect(corriger(q, ['子', '女'], brut).correct).toBe(false);
    expect(corriger(q, '女子', brut).correct).toBe(true);
  });
});

describe('le tracé, noté par Hanzi Writer', () => {
  it('0 erreur : juste ; 1 ou 2 : juste après erreur ; 3 et plus : faux', () => {
    expect(outcomeDuTrace(0, 5)).toEqual({ correct: true, tries: 0, seconds: 5 });
    expect(outcomeDuTrace(1, 5)).toEqual({ correct: true, tries: 1, seconds: 5 });
    expect(outcomeDuTrace(2, 5)).toEqual({ correct: true, tries: 1, seconds: 5 });
    expect(outcomeDuTrace(3, 5).correct).toBe(false);
  });

  it('la correction d’une question de tracé passe par cette règle', () => {
    const q = poser('trace');
    const r = corriger(q, { erreurs: 2 }, { correct: false, tries: 0, seconds: 8 });
    expect(r.correct).toBe(true);
    expect(r.outcome).toEqual({ correct: true, tries: 1, seconds: 8 });
    expect(corriger(q, { erreurs: 4 }, { correct: false, tries: 0, seconds: 8 }).correct).toBe(false);
  });
});

/* ---------- la liste versionnée des paires ---------- */

describe('les paires à ne pas confondre', () => {
  const brut = JSON.parse(
    readFileSync(new URL('../../public/data/demo/paires.json', import.meta.url), 'utf8')
  ) as { version: string; source: string };
  const doc = readFileSync(new URL('../../../docs/jeux.md', import.meta.url), 'utf8');
  const paires = lirePaires(brut);

  it('est versionnée et cite sa source', () => {
    expect(brut.version).not.toBe('');
    expect(brut.source).toBe('docs/jeux.md');
  });

  it('ne contient que les groupes du brief, et rien d’autre', () => {
    expect(paires).toHaveLength(7);
    for (const g of paires) {
      expect(g.length).toBeGreaterThanOrEqual(2);
      expect(new Set(g).size).toBe(g.length);
      for (const c of g) expect([...c]).toHaveLength(1);
      expect(doc).toContain(g.join(' '));
    }
  });

  it('se relit sans fetch, et un fichier illisible rend une liste vide', () => {
    expect(paires[2]).toEqual(['天', '夫']);
    expect(lirePaires(null)).toEqual([]);
    expect(lirePaires({ paires: 'non' })).toEqual([]);
  });
});

describe("après une erreur : l'indice dit quoi faire, et seulement ce qui a du sens", () => {
  it('un caractère de plusieurs briques renvoie aux briques', () => {
    expect(indiceErreur(poser('sens'))).toBe('Pas celui-là. Regarde les briques.');
  });

  it("une brique seule ne renvoie pas à des briques qu'elle n'a pas", () => {
    const roi = question(fiche('王'), 'caractere', CORPUS, 'g');
    expect(indiceErreur(roi)).not.toContain('briques');
    expect(indiceErreur(roi)).toContain('Encore un essai');
  });

  it("un assemblage raté se refait dans l'ordre d'écriture", () => {
    expect(indiceErreur(poser('assemblage'))).toContain("l'ordre d'écriture");
  });

  it("l'écran de question se sert de l'indice, plus d'une phrase en dur", () => {
    const src = readFileSync(new URL('Ask.svelte', import.meta.url), 'utf8');
    expect(src).toContain('{indiceErreur(q)}');
    expect(src).not.toContain('Pas celui-là. Regarde les briques.');
  });
});
