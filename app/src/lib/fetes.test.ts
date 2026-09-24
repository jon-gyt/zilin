import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fichierFetes, loadFetes, type Fetes, type Index } from './content';
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

  it('il couvre 2026 à 2035 pour les deux fêtes', () => {
    for (const id of ['chunjie', 'zhongqiu'] as const) {
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

  it('le Nouvel An va du réveillon à la fête des Lanternes', () => {
    expect(feteDuJour(fetes, '2027-02-04')).toBeNull();
    expect(feteDuJour(fetes, '2027-02-05')?.id).toBe('chunjie');
    expect(feteDuJour(fetes, '2027-02-20')?.id).toBe('chunjie');
    expect(feteDuJour(fetes, '2027-02-21')).toBeNull();
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
});
