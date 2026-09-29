/**
 * Le dictionnaire de Chercher (`dictionnaire.ts`) : un test par règle. D'abord sur un petit
 * index écrit à la main, au format de l'export ; puis sur le vrai `dico/index.json`.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  ChargeurDico,
  MAX_DECOUPAGES,
  RANG,
  accord,
  chercherDico,
  exemplesAffichables,
  lireEntreeCaractere,
  lireEntreeMot,
  lireIndexDico,
  lireSaisie,
  sensAffichable,
  type IndexDico
} from './dictionnaire';

const COLONNES = {
  caracteres: ['c', 'lectures', 'niveau', 'lot', 'glose'],
  mots: ['id', 'formes', 'lectures', 'niveau', 'lot', 'glose']
};

/** Un petit dictionnaire, au format de `dico/index.json`. */
const BRUT = {
  version: 't',
  fichiers: { caracteres: 'dico/caracteres/{lot}.json', mots: 'dico/mots/{lot}.json', traits: 'traits/dico-{lot}.json' },
  colonnes: COLONNES,
  caracteres: [
    ['豪', 'hao2', 7, 0, ''],
    ['好', 'hao3|hao4', 1, 0, 'bon ; bien'],
    ['号', 'hao4', 2, 0, 'numéro'],
    ['你', 'ni3', 1, 1, 'tu, toi'],
    ['女', 'nv3', 1, 1, 'femme, fillette'],
    ['努', 'nu3', 4, 1, ''],
    ['先', 'xian1', 1, 2, 'avant, d’abord'],
    ['西', 'xi1', 1, 2, 'ouest'],
    ['安', 'an1', 2, 2, 'paix, calme'],
    ['吧', 'ba5', 1, 2, ''],
    ['爸', 'ba4', 1, 2, 'papa'],
    ['知', 'zhi1', 2, 3, ''],
    ['道', 'dao4', 2, 3, ''],
    ['年', 'nian2', 1, 3, 'an, année']
  ],
  mots: [
    ['L1-0002', '爱好', 'ai4 hao4', 1, 0, 'passe-temps'],
    ['L1-0004', '爸爸|爸', 'ba4 ba5|ba4', 1, 0, 'papa'],
    ['L1-0138', '好看', 'hao3 kan4', 1, 0, 'joli'],
    ['L2-0215', '好久', 'hao3 jiu3', 2, 0, ''],
    ['L1-0260', '你好', 'ni3 hao3', 1, 0, 'bonjour'],
    ['L4-0900', '西安', 'xi1 an1', 4, 1, 'Xi’an'],
    ['L1-0474', '知道', 'zhi1 dao5|zhi1 dao4', 1, 1, 'savoir'],
    ['L1-0600', '女儿', 'nv3 er2', 1, 1, 'fille'],
    ['L2-0686', '有点儿|有一点儿', 'you3 dian3 r5|you3 yi1 dian3 r5', 2, 1, 'un peu'],
    ['L3-0100', '安静', 'an1 jing4', 3, 1, 'calme, silencieux']
  ],
  traits_hors_liste: { 亠: 4 }
};

const INDEX: IndexDico = lireIndexDico(BRUT);

const ids = (q: string, index = INDEX) => chercherDico(q, index).resultats.map((r) => r.id);
const premier = (q: string, index = INDEX) => chercherDico(q, index).resultats[0]?.id;

describe("l'index", () => {
  it('se lit par le nom des colonnes, pas par leur rang', () => {
    const inverse = lireIndexDico({
      ...BRUT,
      colonnes: { ...COLONNES, caracteres: ['glose', 'lot', 'niveau', 'lectures', 'c'] },
      caracteres: [['bon', 0, 1, 'hao3|hao4', '好']],
      mots: []
    });
    expect(inverse.entrees[0]).toMatchObject({ id: '好', niveau: 1, lot: 0, glose: 'bon' });
    expect(inverse.entrees[0].lectures).toEqual([[{ base: 'hao', ton: 3 }], [{ base: 'hao', ton: 4 }]]);
  });

  it("tire la table des syllabes de l'index lui-même, ü écrit aussi u", () => {
    expect(INDEX.syllabes.has('hao')).toBe(true);
    expect(INDEX.syllabes.has('nv')).toBe(true);
    expect(INDEX.syllabes.has('nu')).toBe(true);
    expect(INDEX.syllabes.has('r')).toBe(true);
  });
});

describe('chercher par caractère', () => {
  it("l'entrée qui s'écrit comme la saisie vient d'abord", () => {
    expect(premier('好')).toBe('好');
    expect(premier('你好')).toBe('L1-0260');
  });

  it('puis les mots qui commencent par le caractère, puis ceux qui le contiennent', () => {
    const r = chercherDico('好', INDEX).resultats;
    expect(r.map((x) => [x.id, x.rang])).toEqual([
      ['好', RANG.exact],
      ['L1-0138', RANG.debut],
      ['L2-0215', RANG.debut],
      ['L1-0002', RANG.contient],
      ['L1-0260', RANG.contient]
    ]);
  });

  it('une variante répond comme la graphie principale', () => {
    expect(ids('爸')).toEqual(['爸', 'L1-0004']);
    expect(chercherDico('有一点儿', INDEX).resultats[0]).toMatchObject({ id: 'L2-0686', rang: RANG.exact });
  });

  it('plusieurs sinogrammes collés : chacun répond, dans l’ordre de la saisie', () => {
    const r = chercherDico('道知', INDEX).resultats;
    expect(r.map((x) => x.id)).toEqual(['道', '知']);
    expect(r.every((x) => x.rang === RANG.caractere)).toBe(true);
  });
});

describe('chercher par pinyin', () => {
  it('sans ton, tous les tons', () => {
    expect(ids('hao').slice(0, 3)).toEqual(['好', '号', '豪']);
  });

  it('avec un chiffre de ton, ce ton seulement', () => {
    expect(ids('hao4')).toEqual(['号', '好']); // 号 hào principale, 好 hào seconde
    expect(ids('hao2')).toEqual(['豪']);
  });

  it('avec les diacritiques, et en majuscules', () => {
    expect(ids('hǎo')).toEqual(['好']);
    expect(premier('NǏHǍO')).toBe('L1-0260');
  });

  it('plusieurs syllabes, collées, espacées ou numérotées', () => {
    for (const q of ['nihao', 'ni hao', 'ni3hao3', 'nǐhǎo', 'ni3 hao', "ni'hao"]) {
      expect(premier(q), q).toBe('L1-0260');
    }
    expect(ids('ni3hao4')).not.toContain('L1-0260');
  });

  it('la dernière syllabe peut n’être qu’un début', () => {
    const r = chercherDico('nih', INDEX).resultats;
    expect(r[0]).toMatchObject({ id: 'L1-0260', rang: RANG.prefixe });
    expect(ids('ha')).toEqual(expect.arrayContaining(['好', '号', '豪']));
    expect(chercherDico('ha', INDEX).resultats.every((x) => x.rang === RANG.prefixe)).toBe(true);
  });

  it('seule la dernière syllabe se tape en partie', () => {
    expect(ids('nhao')).toEqual([]);
  });

  it('le découpage suit la table des syllabes et garde les ambiguïtés : xian, xi’an', () => {
    const d = lireSaisie('xian', INDEX.syllabes).decoupages.map((x) => x.map((s) => s.base).join(' '));
    expect(d).toContain('xian');
    expect(d).toContain('xi an');
    expect(ids('xian')).toEqual(expect.arrayContaining(['先', 'L4-0900']));
    expect(ids("xi'an")).toEqual(['L4-0900']);
  });

  it('ü se tape ü, v, u: ou u', () => {
    const parPinyin = (q: string) =>
      chercherDico(q, INDEX)
        .resultats.filter((r) => r.rang === RANG.pinyin)
        .map((r) => r.id);
    for (const q of ['nü3', 'nv3', 'nu:3', 'nǚ']) expect(parPinyin(q), q).toEqual(['女']);
    expect(parPinyin('nu3')).toEqual(['女', '努']);
  });

  it('la lecture principale avant une lecture seconde', () => {
    const lu = lireIndexDico({ ...BRUT, caracteres: [['见', 'jian4|xian4', 1, 0, ''], ['先', 'xian1', 2, 0, '']], mots: [] });
    expect(ids('xian', lu)).toEqual(['先', '见']);
  });

  it('le ton neutre se tape 5, 0 ou sans chiffre ; un ton plein ne le trouve pas', () => {
    expect(ids('ba5')).toEqual(['吧']);
    expect(ids('ba0')).toEqual(['吧']);
    expect(ids('ba4ba')).toContain('L1-0004');
    expect(ids('ba4ba4')).not.toContain('L1-0004');
  });

  it('la lecture pleine d’une syllabe au ton neutre facultatif est acceptée', () => {
    expect(ids('zhi1dao4')).toEqual(['L1-0474']);
    expect(ids('zhidao')).toEqual(['L1-0474']);
  });

  it("l'érhua se tape avec son r", () => {
    expect(premier('youdianr')).toBe('L2-0686');
  });

  it('le nombre de découpages reste borné', () => {
    expect(lireSaisie('xianxianxianxianxianxian', INDEX.syllabes).decoupages.length).toBeLessThanOrEqual(MAX_DECOUPAGES);
  });

  it('une lecture répond seulement avec autant de syllabes', () => {
    expect(accord([{ base: 'ni', ton: 3 }], [{ base: 'ni', ton: null, prefixe: false }, { base: 'hao', ton: null, prefixe: true }])).toBeNull();
  });
});

describe('chercher en français', () => {
  it('sur la glose relue, sans accents ni majuscules', () => {
    expect(ids('Numero')).toEqual(['号']);
    expect(ids('silencieux')).toEqual(['L3-0100']);
  });

  it('le mot entier avant le début d’un mot, même un mot avant un caractère', () => {
    /* fille : 女儿 « fille » (le mot entier), puis 女 « femme, fillette » (le début d'un mot). */
    expect(ids('fille')).toEqual(['L1-0600', '女']);
  });

  it("une entrée sans glose relue n'est jamais trouvée par le français", () => {
    expect(ids('effort')).toEqual([]);
    const sans = lireIndexDico({ ...BRUT, caracteres: [['努', 'nu3', 4, 1, '']], mots: [] });
    expect(chercherDico('nu', sans).resultats.map((r) => r.rang)).toEqual([RANG.pinyin]);
  });

  it('un sens non relu ne se montre pas, même glissé dans un lot', () => {
    expect(sensAffichable({ statut: 'a_relire', glose: 'bon' })).toBeNull();
    expect(sensAffichable({ statut: 'relu', glose: 'x'.repeat(41) })).toBeNull();
    expect(sensAffichable({ statut: 'relu', glose: 'bon', acceptions: [{ categorie: 'Adj', fr: 'bon' }] })).toEqual({
      statut: 'relu',
      glose: 'bon',
      acceptions: [{ categorie: 'Adj', fr: 'bon' }]
    });
    expect(exemplesAffichables([{ zh: '很好', statut: 'a_relire' }, { zh: '好', fr: 'bien', statut: 'relu' }])).toEqual([
      { zh: '好', pinyin: '', fr: 'bien' }
    ]);
  });
});

describe('le classement', () => {
  it('par rang : caractère, début, contient, pinyin exact, début de pinyin, français', () => {
    expect(RANG.exact < RANG.debut && RANG.debut < RANG.contient && RANG.contient < RANG.caractere).toBe(true);
    expect(RANG.caractere < RANG.pinyin && RANG.pinyin < RANG.prefixe && RANG.prefixe < RANG.francais).toBe(true);
    const r = chercherDico('an', INDEX).resultats;
    const rangs = r.map((x) => x.rang);
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
    expect(r[0]).toMatchObject({ id: '安', rang: RANG.pinyin });
  });

  it('à rang égal : le caractère avant le mot, le niveau croissant, le plus court', () => {
    /* hao : 好 (HSK 1), 号 (HSK 2), 豪 (7-9), tous des caractères. */
    expect(ids('hao')).toEqual(['好', '号', '豪']);
    /* ba4 : le caractère 爸 avant le mot 爸爸|爸, qui répond par sa variante. */
    expect(ids('ba4')).toEqual(['爸', 'L1-0004']);
  });

  it('coupe la liste, et dit combien répondaient', () => {
    const r = chercherDico('ha', INDEX, 2);
    expect(r.resultats).toHaveLength(2);
    expect(r.total).toBeGreaterThan(2);
  });

  it('une saisie vide ou illisible ne répond rien', () => {
    expect(chercherDico('', INDEX).total).toBe(0);
    expect(chercherDico('  ', INDEX).total).toBe(0);
    expect(chercherDico('?', INDEX).total).toBe(0);
  });
});

describe('les entrées des lots', () => {
  it("lisent une entrée de caractère, décomposition nulle tant qu'elle n'est pas réconciliée", () => {
    const e = lireEntreeCaractere({
      c: '豪',
      pinyin: 'háo',
      lectures: ['háo'],
      niveau: 7,
      decomposition: null,
      mots: ['L7-0001'],
      chemin: {},
      sens: { statut: 'a_relire', glose: 'x' },
      exemples: []
    });
    expect(e).toMatchObject({ c: '豪', decomposition: null, sens: null, mots: ['L7-0001'] });
  });

  it('lisent une entrée de mot, ses variantes, sa lecture pleine et son emploi', () => {
    const e = lireEntreeMot({
      id: 'L1-0075',
      hanzi: '第',
      pinyin: 'dì',
      syllabes: ['di4'],
      niveau: 1,
      categories: ['Prefix'],
      officiel: '第（第二）',
      emploi: { hanzi: '第二', pinyin: 'dì-èr', syllabes: ['di4', 'er4'] },
      sens: null,
      exemples: []
    });
    expect(e).toMatchObject({ id: 'L1-0075', emploi: { hanzi: '第二' }, variantes: [], pleines: [] });
  });
});

describe('le chargement paresseux', () => {
  function servir(fichiers: Record<string, unknown>) {
    const appels: string[] = [];
    const fetchFn = (async (u: RequestInfo | URL) => {
      const url = String(u);
      appels.push(url);
      const chemin = url.slice('/base/data/t/'.length);
      if (url.startsWith('/base/data/t/') && chemin in fichiers) {
        return { ok: true, status: 200, json: async () => fichiers[chemin] } as Response;
      }
      return { ok: false, status: 404, json: async () => null } as Response;
    }) as typeof fetch;
    return { appels, fetchFn };
  }
  const lot0 = {
    entrees: {
      好: { c: '好', pinyin: 'hǎo', lectures: ['hǎo', 'hào'], niveau: 1, decomposition: { norme: 'GF 0014-2009', parts: ['女', '子'], sources: [] }, mots: ['L1-0138'], chemin: { lire: 13 }, sens: null, exemples: [] },
      号: { c: '号', pinyin: 'hào', lectures: ['hào'], niveau: 2, decomposition: null, mots: [], chemin: {}, sens: null, exemples: [] }
    }
  };
  const fichiers = {
    'dico/index.json': BRUT,
    'dico/caracteres/0.json': lot0,
    'dico/mots/0.json': { entrees: { 'L1-0138': { id: 'L1-0138', hanzi: '好看', pinyin: 'hǎokàn', syllabes: ['hao3', 'kan4'], niveau: 1, categories: ['Adj'], officiel: '好看', sens: null, exemples: [] } } },
    'traits/dico-0.json': { license: 'Arphic Public License', traits: { 好: { s: ['M 0 0'], m: [[[0, 0]]] } } },
    'traits/dico-4.json': { license: 'Arphic Public License', traits: { 亠: { s: ['M 4 4'], m: [[[4, 4]]] } } }
  };

  it("chercher ne lit que l'index, une seule fois", async () => {
    const { appels, fetchFn } = servir(fichiers);
    const d = new ChargeurDico('/base/data/t/', 'dico/index.json', fetchFn);
    await d.chercher('hao');
    await d.chercher('ni');
    expect(appels).toEqual(['/base/data/t/dico/index.json']);
  });

  it('une fiche charge son lot, une fois pour toutes les entrées du lot', async () => {
    const { appels, fetchFn } = servir(fichiers);
    const d = new ChargeurDico('/base/data/t/', 'dico/index.json', fetchFn);
    expect((await d.caractere('好'))?.chemin).toEqual({ lire: 13 });
    expect((await d.caractere('号'))?.decomposition).toBeNull();
    expect((await d.entree({ genre: 'mot', id: 'L1-0138' }))?.genre).toBe('mot');
    expect(await d.caractere('無')).toBeNull();
    expect(appels.filter((u) => u.endsWith('dico/caracteres/0.json'))).toHaveLength(1);
    expect(d.demandes().sort()).toEqual(['dico/caracteres/0.json', 'dico/index.json', 'dico/mots/0.json']);
  });

  it("les traits d'un caractère viennent du lot de même numéro, ceux d'un composant de traits_hors_liste", async () => {
    const { appels, fetchFn } = servir(fichiers);
    const d = new ChargeurDico('/base/data/t/', 'dico/index.json', fetchFn);
    expect((await d.traits('好'))?.s).toEqual(['M 0 0']);
    expect((await d.traits('亠'))?.s).toEqual(['M 4 4']);
    expect(await d.traits('無')).toBeNull();
    for (const u of appels) expect(u.startsWith('/base/')).toBe(true);
  });

  it("les lots portent l'empreinte de l'export, l'index non (il est précaché)", async () => {
    const appels: string[] = [];
    const { fetchFn } = servir(fichiers);
    const d = new ChargeurDico(
      '/base/data/t/',
      'dico/index.json',
      (async (u: RequestInfo | URL) => {
        appels.push(String(u));
        return fetchFn(String(u).split('?')[0]);
      }) as typeof fetch,
      'sha256:ab'
    );
    await d.caractere('好');
    await d.traits('好');
    expect(appels).toEqual([
      '/base/data/t/dico/index.json',
      '/base/data/t/dico/caracteres/0.json?v=sha256%3Aab',
      '/base/data/t/traits/dico-0.json?v=sha256%3Aab'
    ]);
  });

  it("un échec n'est pas retenu : la demande suivante réessaie", async () => {
    let panne = true;
    const { fetchFn } = servir(fichiers);
    const d = new ChargeurDico('/base/data/t/', 'dico/index.json', (async (u: RequestInfo | URL) => {
      if (panne) return { ok: false, status: 503, json: async () => null } as Response;
      return fetchFn(u);
    }) as typeof fetch);
    await expect(d.chercher('hao')).rejects.toThrow();
    panne = false;
    expect((await d.chercher('hao')).total).toBeGreaterThan(0);
  });
});

/* ---------- le vrai dictionnaire exporté ---------- */

const VRAI = new URL('../../public/data/0.1.0/dico/index.json', import.meta.url);

describe.runIf(existsSync(VRAI))('le dictionnaire exporté', () => {
  const index = lireIndexDico(JSON.parse(readFileSync(VRAI, 'utf8')));

  it('porte les 3 000 caractères et les 11 092 mots du HSK 3.0', () => {
    expect(index.entrees.filter((e) => e.genre === 'caractere')).toHaveLength(3000);
    expect(index.entrees.filter((e) => e.genre === 'mot')).toHaveLength(11092);
  });

  it('trouve par caractère et par pinyin, sous toutes ses formes', () => {
    expect(premier('好', index)).toBe('好');
    expect(chercherDico('hao', index).resultats[0].id).toBe('好');
    for (const q of ['zhongguo', 'zhong1guo2', 'zhōngguó', 'zhong guo', 'zhongg']) {
      expect(chercherDico(q, index).resultats[0].formes[0], q).toBe('中国');
    }
    expect(chercherDico('zhidao', index).resultats[0].formes[0]).toBe('知道');
    expect(chercherDico('xian', index).resultats[0].id).toBe('先');
    expect(chercherDico('lü', index).resultats.map((r) => r.id)).toContain('绿');
    /* 你好 n'est pas un mot de la liste HSK 3.0 : ses deux caractères le sont. */
    expect(chercherDico('nihao', index).total).toBe(0);
    expect(chercherDico('你好', index).resultats.map((r) => r.id)).toEqual(['你', '好']);
  });

  it('cherche vite : moins de 50 ms par saisie sur tout le dictionnaire', () => {
    const t0 = performance.now();
    for (const q of ['hao', 'nihao', 'zhong', 'xian', 'shi', 'a', '好', 'zhongguoren']) chercherDico(q, index);
    expect((performance.now() - t0) / 8).toBeLessThan(50);
  });
});
