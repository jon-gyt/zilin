import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FETES, fichierFetes, loadFetes, type Fetes, type Index } from './content';
import { ecartJours, feteDuJour, pistes, poserFete, quand, remplir } from './fetes';

/* Le fichier servi avec l'app, tel que `wenlu export` l'écrit. */
const brut = readFileSync(new URL('../../public/data/0.1.0/fetes.json', import.meta.url), 'utf8');
const index = JSON.parse(
  readFileSync(new URL('../../public/data/0.1.0/index.json', import.meta.url), 'utf8')
) as Index;

function repondre(corps: string, ok = true): typeof fetch {
  return (async () => ({ ok, status: ok ? 200 : 404, json: async () => JSON.parse(corps) })) as unknown as typeof fetch;
}

const fetes: Fetes = await loadFetes('data/0.1.0/fetes.json', repondre(brut));

describe('le fichier des fêtes vient du pipeline', () => {
  it("l'index le nomme, et son en-tête cite sa source", () => {
    expect(fichierFetes(index)).toBe('data/0.1.0/fetes.json');
    expect(fetes.source).toContain('rédigés pour l\'app');
    expect(fetes.source).toContain('lunar_python');
  });

  it('il couvre 2026 à 2035 pour les huit fêtes, et chacune a ses textes', () => {
    expect(Object.keys(fetes.fetes).sort()).toEqual([...FETES].sort());
    for (const id of FETES) {
      const annees = fetes.calendrier.filter((e) => e.fete === id).map((e) => e.annee);
      for (let a = 2026; a <= 2035; a++) expect(annees).toContain(a);
    }
  });

  it('une entrée illisible ou une fête inconnue est écartée, un fichier absent est une erreur', async () => {
    const f = await loadFetes(
      'x.json',
      repondre(
        JSON.stringify({
          calendrier: [
            { fete: 'dragon', date: '2026-01-01', avant: 1, apres: 1, animal: {} },
            { fete: 'zhongqiu', date: 'demain', avant: 1, apres: 1, animal: {} }
          ],
          fetes: {},
          racines: {}
        })
      )
    );
    expect(f.calendrier).toEqual([]);
    await expect(loadFetes('x.json', repondre('{}', false))).rejects.toThrow('introuvables');
    await expect(loadFetes('x.json', repondre('{}'))).rejects.toThrow('illisibles');
  });
});

describe('la fête du jour', () => {
  it('la veille de la mi-automne 2026 : demain soir, pleine lune', () => {
    const f = feteDuJour(fetes, '2026-09-24');
    expect(f?.id).toBe('zhongqiu');
    expect(f?.ecart).toBe(1);
    expect(f?.quand).toBe('Demain soir');
    expect(f?.voeu).toEqual({ zh: '中秋快乐', pinyin: 'zhōngqiū kuàilè', fr: 'Demain soir, pleine lune' });
    expect(f?.tao[0]).toBe('Demain soir, pleine lune !');
    expect(f?.anecdote.c).toBe('月');
    expect(f?.anecdote.rubrique).toBe("L'anecdote de la mi-automne");
    expect(f?.caractereVoeu).toBeNull();
  });

  it('la mi-automne dure de trois jours avant au lendemain', () => {
    expect(feteDuJour(fetes, '2026-09-21')).toBeNull();
    expect(feteDuJour(fetes, '2026-09-22')?.quand).toBe('Dans 3 jours');
    expect(feteDuJour(fetes, '2026-09-25')?.quand).toBe('Ce soir');
    expect(feteDuJour(fetes, '2026-09-26')?.quand).toBe('Hier soir');
    expect(feteDuJour(fetes, '2026-09-27')).toBeNull();
  });

  it('le Nouvel An va du réveillon au 14e jour, la fête des Lanternes prend le 15e', () => {
    expect(feteDuJour(fetes, '2027-02-04')).toBeNull();
    expect(feteDuJour(fetes, '2027-02-05')?.id).toBe('chunjie');
    expect(feteDuJour(fetes, '2027-02-19')?.id).toBe('chunjie');
    const yuanxiao = feteDuJour(fetes, '2027-02-20');
    expect(yuanxiao?.id).toBe('yuanxiao');
    expect(yuanxiao?.voeu.fr).toBe('Ce soir, fête des Lanternes');
    expect(yuanxiao?.anecdote).toMatchObject({ c: '灯', pinyin: 'dēng', sens: 'la lampe, la lanterne' });
    expect(feteDuJour(fetes, '2027-02-21')).toBeNull();
  });

  it('chaque fête de 2026 tombe à sa date, avec son caractère bonus', () => {
    const jours: [string, string, string][] = [
      ['2026-03-03', 'yuanxiao', '灯'],
      ['2026-04-05', 'qingming', '雨'],
      ['2026-06-19', 'duanwu', '粽'],
      ['2026-08-19', 'qixi', '桥'],
      ['2026-09-25', 'zhongqiu', '月'],
      ['2026-10-18', 'chongyang', '菊'],
      ['2026-12-22', 'dongzhi', '冬']
    ];
    for (const [jour, id, c] of jours) {
      const f = feteDuJour(fetes, jour);
      expect(f?.id, jour).toBe(id);
      expect(f?.ecart, jour).toBe(0);
      expect(f?.anecdote.c, jour).toBe(c);
      expect(f?.anecdote.pinyin, jour).not.toBe('');
      expect(f?.anecdote.sens, jour).not.toBe('');
      expect(f?.tao.length, jour).toBeGreaterThan(0);
    }
  });

  it('les fenêtres des nouvelles fêtes : 清明 −1 à +1, 端午 −2 à +1, 七夕 −2 au soir même', () => {
    expect(feteDuJour(fetes, '2026-04-03')).toBeNull();
    expect(feteDuJour(fetes, '2026-04-04')?.id).toBe('qingming');
    expect(feteDuJour(fetes, '2026-04-06')?.id).toBe('qingming');
    expect(feteDuJour(fetes, '2026-04-07')).toBeNull();
    expect(feteDuJour(fetes, '2026-06-17')?.id).toBe('duanwu');
    expect(feteDuJour(fetes, '2026-06-20')?.id).toBe('duanwu');
    expect(feteDuJour(fetes, '2026-06-21')).toBeNull();
    expect(feteDuJour(fetes, '2026-08-17')?.voeu.fr).toBe('Dans 2 jours, le pont des pies');
    expect(feteDuJour(fetes, '2026-08-20')).toBeNull();
    expect(feteDuJour(fetes, '2026-12-21')?.voeu.fr).toBe('Demain soir, la plus longue nuit');
  });

  it("aucune fête n'est un dragon : 2036, année du Dragon, reste hors du calendrier", () => {
    expect(Math.max(...fetes.calendrier.map((e) => e.annee))).toBe(2035);
    expect(fetes.calendrier.some((e) => e.animal.c === '龙')).toBe(false);
    expect(feteDuJour(fetes, '2036-01-28')).toBeNull();
    for (const t of Object.values(fetes.fetes)) expect(JSON.stringify(t)).not.toMatch(/dragon|龙/i);
  });

  it("l'animal suit l'année lunaire : le Cheval en 2026, la Chèvre en 2027", () => {
    expect(feteDuJour(fetes, '2026-02-17')?.voeu.fr).toBe('Bonne année du Cheval 马');
    const f = feteDuJour(fetes, '2027-02-06');
    expect(f?.voeu).toEqual({ zh: '新年快乐', pinyin: 'xīnnián kuàilè', fr: 'Bonne année de la Chèvre 羊' });
    expect(f?.caractereVoeu).toBe('福');
    expect(f?.anecdote.c).toBe('年');
    expect(f?.tao).toEqual(['新年好 ! Bonne année !', "Un 福 à l'envers : le bonheur arrive."]);
  });

  it("un jour ordinaire, ou une date illisible, n'a pas de fête", () => {
    expect(feteDuJour(fetes, '2026-06-01')).toBeNull();
    expect(feteDuJour(fetes, 'hier')).toBeNull();
  });
});

describe('les outils', () => {
  it("l'écart se compte en journées civiles", () => {
    expect(ecartJours('2026-09-24', '2026-09-25')).toBe(1);
    expect(ecartJours('2027-02-06', '2027-02-05')).toBe(-1);
    expect(ecartJours('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('le délai se dit en toutes lettres', () => {
    expect([2, 1, 0, -1, -5].map(quand)).toEqual([
      'Dans 2 jours',
      'Demain soir',
      'Ce soir',
      'Hier soir',
      'Il y a 5 jours'
    ]);
  });

  it('seuls les jetons connus sont remplis', () => {
    expect(remplir('{quand}, {animal}, {autre}', { animal: 'A', quand: 'Q' })).toBe('Q, A, {autre}');
  });

  it('les caractères dessinés ont leur famille, pour lire leurs traits sans tout relire', () => {
    expect(pistes(fetes, '福')).toEqual(['礻']);
    expect(pistes(fetes, '年')).toEqual(['年']);
    expect(pistes(fetes, '好')).toEqual([]);
  });

  it("l'attribut data-fete est posé, puis retiré", () => {
    const attrs = new Map<string, string>();
    const el = {
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k)
    };
    poserFete(el, 'zhongqiu');
    expect(attrs.get('data-fete')).toBe('zhongqiu');
    poserFete(el, null);
    expect(attrs.has('data-fete')).toBe(false);
  });

  it("la meta theme-color prend le papier de la fête, puis retrouve sa valeur d'origine", () => {
    const meta = new Map<string, string>([['content', '#F4EEE2']]);
    let papier = '';
    const doc = {
      querySelector: (s: string) =>
        s === 'meta[name="theme-color"]'
          ? {
              getAttribute: (k: string) => meta.get(k) ?? null,
              setAttribute: (k: string, v: string) => void meta.set(k, v)
            }
          : null,
      defaultView: { getComputedStyle: () => ({ getPropertyValue: (p: string) => (p === '--paper' ? papier : '') }) }
    };
    const attrs = new Map<string, string>();
    const el = {
      ownerDocument: doc,
      setAttribute: (k: string, v: string) => {
        attrs.set(k, v);
        papier = ' #141B2E';
      },
      removeAttribute: (k: string) => {
        attrs.delete(k);
        papier = '#F4EEE2';
      }
    };
    poserFete(el, 'zhongqiu');
    expect(meta.get('content')).toBe('#141B2E');
    poserFete(el, 'qixi');
    expect(meta.get('content')).toBe('#141B2E');
    poserFete(el, null);
    expect(meta.get('content')).toBe('#F4EEE2');
    /* sans papier lisible, la valeur d'origine reste */
    papier = '';
    poserFete({ ...el, setAttribute: () => undefined }, 'dongzhi');
    expect(meta.get('content')).toBe('#F4EEE2');
  });
});
