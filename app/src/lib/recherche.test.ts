import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VERSION_DONNEES, type Famille, type Fiche, type Index } from './content';
import {
  AIDE,
  MAX_RESULTATS,
  RANG,
  caracteresTapes,
  chercher,
  corpus,
  ligne,
  lirePinyin,
  statut,
  type Entree
} from './recherche';
import { newCard, schedule, type ReviewCard } from './srs';

/* ---------- des familles de test, au format de l'export ---------- */

function f(c: string, pinyin: string, fr = '', relu = fr !== ''): Fiche {
  return {
    c,
    pinyin,
    fr,
    en: '',
    parts: [],
    nouveau: [],
    role: null,
    origine_fr: '',
    origine_en: '',
    etiquette: null,
    mots: [],
    niveaux: {},
    traits: [],
    medianes: [],
    statut: relu ? 'relu' : 'sans_fiche'
  };
}

function fam(racine: Fiche, ...autres: Fiche[]): Famille {
  return {
    version: '0.1.0',
    source: 'test',
    racine: { c: racine.c, pinyin: racine.pinyin, fr: racine.fr, en: '', origine: '', etiquette: null },
    fiches: [racine, ...autres]
  };
}

const FAMILLES: Famille[] = [
  fam(f('女', 'nǚ'), f('好', 'hǎo'), f('奶', 'nǎi')),
  fam(f('口', 'kǒu'), f('号', 'hào'), f('喝', 'hē')),
  fam(f('氵', 'shuǐ'), f('汉', 'hàn'), f('海', 'hǎi')),
  fam(f('了', 'le')),
  fam(f('木', 'mù'), f('林', 'lín'))
];
const CORPUS = corpus(FAMILLES);

const cs = (q: string, e: readonly Entree[] = CORPUS): string[] =>
  chercher(q, e).resultats.map((r) => r.c);

/* ---------- le corpus ---------- */

describe('le corpus : les caractères exportés, et eux seuls', () => {
  it('prend chaque caractère une fois, avec la racine de sa famille', () => {
    expect(CORPUS.map((e) => e.c)).toEqual(['女', '好', '奶', '口', '号', '喝', '氵', '汉', '海', '了', '木', '林']);
    expect(CORPUS.find((e) => e.c === '好')?.racine).toBe('女');
    expect(new Set(CORPUS.map((e) => e.c)).size).toBe(CORPUS.length);
  });

  it("ne garde le sens que d'une fiche relue", () => {
    const e = corpus([fam(f('木', 'mù', 'arbre', true), f('林', 'lín', 'forêt', false))]);
    expect(e.find((x) => x.c === '木')?.fr).toBe('arbre');
    expect(e.find((x) => x.c === '林')?.fr).toBe('');
  });
});

/* ---------- la normalisation du pinyin ---------- */

describe('le pinyin, avec ou sans accents ni tons', () => {
  it('lit hao, hǎo, HAO et hao3 sur la même base', () => {
    for (const q of ['hao', 'hǎo', 'HAO', 'hao3', ' hǎo ']) expect(lirePinyin(q).base).toBe('hao');
  });

  it('prend le ton du diacritique ou du chiffre, rien sinon', () => {
    expect(lirePinyin('hǎo').ton).toBe(3);
    expect(lirePinyin('hao3').ton).toBe(3);
    expect(lirePinyin('hāo').ton).toBe(1);
    expect(lirePinyin('háo').ton).toBe(2);
    expect(lirePinyin('hào').ton).toBe(4);
    expect(lirePinyin('hao').ton).toBeNull();
  });

  it('note le ton neutre 5 : chiffre 0 ou 5, ou pinyin exporté sans marque', () => {
    expect(lirePinyin('le5').ton).toBe(5);
    expect(lirePinyin('le0').ton).toBe(5);
    expect(lirePinyin('le', 5).ton).toBe(5);
  });

  it('écrit le ü aussi u, v ou u:', () => {
    for (const q of ['nǚ', 'nü', 'nv3', 'nu:3', 'nu']) expect(lirePinyin(q).base).toBe('nu');
    expect(cs('nv')).toContain('女');
    expect(cs('nü3')).toContain('女');
  });

  it("n'accepte un ton dit que s'il est le bon", () => {
    expect(cs('hao')).toEqual(['好', '号']);
    expect(cs('hao3')).toEqual(['好']);
    expect(cs('hǎo')).toEqual(['好']);
    expect(cs('hào')).toEqual(['号']);
    expect(cs('le5')).toEqual(['了']);
  });
});

/* ---------- le classement ---------- */

describe('le classement', () => {
  it('met le caractère tapé avant tout le reste', () => {
    expect(cs('好')[0]).toBe('好');
    expect(chercher('好', CORPUS).resultats[0].rang).toBe(RANG.caractere);
  });

  it('rend les caractères collés dans leur ordre, sans lettre latine', () => {
    expect(caracteresTapes('木林 hǎo')).toEqual(['木', '林']);
    expect(cs('林木')).toEqual(['林', '木']);
  });

  it('met le pinyin exact avant le préfixe', () => {
    const r = chercher('ha', corpus([fam(f('口', 'kǒu'), f('号', 'hào'), f('哈', 'hā'))])).resultats;
    expect(r.map((x) => x.c)).toEqual(['哈', '号']);
    expect(r.map((x) => x.rang)).toEqual([RANG.pinyin, RANG.prefixe]);
  });

  it('range le préfixe du plus court au plus long, puis par ton', () => {
    const e = corpus([fam(f('口', 'kǒu'), f('行', 'háng'), f('汉', 'hàn'), f('好', 'hǎo'))]);
    expect(cs('ha', e)).toEqual(['好', '汉', '行']);
    expect(cs('ha')).toEqual(['好', '海', '号', '汉']);
  });

  it('range le pinyin exact par ton, puis dans l’ordre de l’export', () => {
    const e = corpus([fam(f('口', 'kǒu'), f('号', 'hào')), fam(f('女', 'nǚ'), f('好', 'hǎo'))]);
    expect(cs('hao', e)).toEqual(['好', '号']);
  });

  it('met le sens après le pinyin, et ne le cherche que dans une fiche relue', () => {
    const e = corpus([
      fam(f('木', 'mù', 'arbre, bois'), f('林', 'lín', 'forêt', false)),
      fam(f('口', 'kǒu', 'bouche'), f('号', 'hào', 'numéro'))
    ]);
    expect(cs('bois', e)).toEqual(['木']);
    expect(cs('arb', e)).toEqual(['木']);
    expect(cs('foret', e)).toEqual([]);
    expect(cs('numero', e)).toEqual(['号']);
    const mu = chercher('mu', corpus([fam(f('木', 'mù'), f('目', 'mù')), fam(f('口', 'kǒu', 'muet'))]));
    expect(mu.resultats.map((x) => [x.c, x.rang])).toEqual([
      ['木', RANG.pinyin],
      ['目', RANG.pinyin],
      ['口', RANG.sens]
    ]);
  });

  it(`s'arrête à ${MAX_RESULTATS} résultats et dit combien répondaient`, () => {
    const beaucoup = corpus([fam(f('口', 'kǒu'), ...Array.from({ length: 30 }, (_, i) => f(String.fromCodePoint(0x4e00 + i), 'yī')))]);
    const r = chercher('yi', beaucoup);
    expect(r.resultats).toHaveLength(MAX_RESULTATS);
    expect(r.total).toBe(30);
  });

  it('ne rend rien pour une saisie vide', () => {
    expect(chercher('  ', CORPUS)).toEqual({ resultats: [], total: 0 });
  });
});

/* ---------- le statut, lu sur les cartes ---------- */

describe('le statut, lu dans p.cartes', () => {
  const TJ = new Date('2026-03-02T08:00:00Z');
  const sue: ReviewCard = schedule(newCard('好', TJ), { correct: true, tries: 0, seconds: 2 }, TJ).card;
  const neuve: ReviewCard = newCard('号', TJ);

  it('dit « lu », « en cours » ou « pas encore », comme Ma forêt', () => {
    expect(statut('好', [sue, neuve])).toBe('lu');
    expect(statut('号', [sue, neuve])).toBe('encours');
    expect(statut('汉', [sue, neuve])).toBe('pasencore');
  });
});

/* ---------- la ligne sous le champ ---------- */

describe('la ligne sous le champ', () => {
  it("donne l'aide quand le champ est vide", () => {
    expect(ligne('', chercher('', CORPUS), CORPUS)).toBe(AIDE);
  });

  it("dit que les sens français manquent quand aucune fiche n'est relue", () => {
    const l = ligne('bon', chercher('bon', CORPUS), CORPUS);
    expect(l).toContain('Rien pour « bon »');
    expect(l).toContain('pas encore écrits');
  });

  it('dit seulement « rien » quand des sens existent', () => {
    const e = corpus([fam(f('木', 'mù', 'arbre'))]);
    expect(ligne('bon', chercher('bon', e), e)).toBe('Rien pour « bon ».');
  });

  it("dit qu'un caractère absent n'est pas encore dans Wenlu", () => {
    expect(ligne('龍', chercher('龍', CORPUS), CORPUS)).toBe("Ce caractère n'est pas encore dans Wenlu.");
  });
});

/* ---------- sur l'export versionné ---------- */

describe("sur l'export versionné", () => {
  const dossier = new URL(`../../public/data/${VERSION_DONNEES}/`, import.meta.url);
  const index = JSON.parse(readFileSync(new URL('index.json', dossier), 'utf8')) as Index;
  const familles = index.familles.map(
    (x) => JSON.parse(readFileSync(new URL(x.fichier, dossier), 'utf8')) as Famille
  );
  const tout = corpus(familles);

  it('cherche dans tous les caractères des familles exportées', () => {
    const n = new Set(familles.flatMap((x) => [x.racine.c, ...x.fiches.map((y) => y.c)])).size;
    expect(tout).toHaveLength(n);
  });

  it('trouve 好 et 号 pour hao, 好 seul pour hao3, 木 en tête pour 木', () => {
    const hao = cs('hao', tout);
    expect(hao.slice(0, 2)).toEqual(['好', '号']);
    expect(cs('hao3', tout)).toEqual(['好']);
    expect(cs('木', tout)[0]).toBe('木');
  });
});
