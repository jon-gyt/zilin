/**
 * Le classifieur des tons de « Dis-le » (story 9.1), porté du prototype sous Vitest, sur les
 * poids que le pipeline exporte (`public/data/0.1.0/tons.json`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import {
  CLASSES,
  N_ENTREES,
  SEUILS_JUGEMENT,
  analyser,
  caracteristiques,
  contourDe,
  juger,
  predire,
  probabilites,
  regles,
  verifierModele,
  type Modele
} from './classifieur';
import { lireModele } from './modele';
import { segmenter, suivreHauteur } from './pitch';
import { courbesTons, syllabe } from './synthese';

const FICHIER = new URL('../../../public/data/0.1.0/tons.json', import.meta.url);
const modele = lireModele(JSON.parse(readFileSync(FICHIER, 'utf8'))) as Modele;
const REF = 200;
const courbes = courbesTons(REF);

function entrees(t: 1 | 2 | 3 | 4, ref: number | null = REF): number[] {
  const x = syllabe(courbes[t], t === 3 ? 0.45 : 0.35);
  const [seg] = segmenter(suivreHauteur(x), 1);
  return caracteristiques(contourDe(seg), ref ?? undefined);
}

describe('le modèle exporté', () => {
  it('est bien formé, pèse moins de 1 Mo, et ses probabilités somment à 1', () => {
    expect(modele).not.toBeNull();
    verifierModele(modele);
    expect(statSync(FICHIER).size).toBeLessThan(1024 * 1024);
    const p = predire(modele, entrees(1));
    expect(p.length).toBe(CLASSES.length);
    expect(Math.abs(p.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9);
  });

  it('porte l’attribution de ses données d’entraînement (OGDL 1.0)', () => {
    const brut = JSON.parse(readFileSync(FICHIER, 'utf8')) as { attribution?: string };
    expect(brut.attribution).toContain('Open Government Data License');
    expect(brut.attribution).toContain('https://data.gov.tw/license');
  });

  it('un modèle mal formé est refusé : la question ne se pose pas', () => {
    const m = structuredClone(modele);
    m.membres[0].couches[0].poids[0].pop();
    expect(() => verifierModele(m)).toThrow();
    expect(lireModele(m)).toBeNull();
    expect(lireModele({ ...modele, entrees: 12 })).toBeNull();
    expect(lireModele(null)).toBeNull();
  });
});

describe('les caractéristiques', () => {
  it('sans référence de voix, le registre vaut 0 et l’indicateur le dit', () => {
    const x = entrees(1, null);
    expect(x.length).toBe(N_ENTREES);
    expect(x[30]).toBe(0);
    expect(x[31]).toBe(0);
    expect(entrees(1)[31]).toBe(1);
  });
});

describe('les quatre tons synthétiques', () => {
  for (const t of [1, 2, 3, 4] as const) {
    it(`ton ${t} : reconnu par les règles, par le modèle et par la décision hybride`, () => {
      const x = entrees(t);
      expect(regles(x)).toBe(t);
      const p = predire(modele, x);
      expect(CLASSES[p.indexOf(Math.max(...p))]).toBe(t);
      expect(juger(t, probabilites(modele, x)).etat).toBe('juste');
    });
  }
});

describe('le jugement', () => {
  it('le ton attendu en tête et probable : reconnu', () => {
    const v = juger(3, [0.05, 0.1, 0.8, 0.03, 0.02]);
    expect(v.etat).toBe('juste');
    expect(v.entendu).toBe(3);
  });

  it('un autre ton sûr, l’attendu improbable : on nomme le ton entendu', () => {
    const v = juger(2, [0.01, 0.02, 0.95, 0.01, 0.01]);
    expect(v.etat).toBe('autre');
    expect(v.entendu).toBe(3);
  });

  it('entre les deux, on redemande sans rien affirmer', () => {
    for (const p of [[0.3, 0.3, 0.2, 0.1, 0.1], [0.05, 0.25, 0.65, 0.03, 0.02], [0.02, 0.07, 0.88, 0.02, 0.01]]) {
      const v = juger(2, p);
      expect(v.etat).toBe('redemander');
      expect(v.entendu).toBeNull();
    }
    expect(SEUILS_JUGEMENT.autre).toBeGreaterThan(SEUILS_JUGEMENT.juste);
  });
});

describe('de bout en bout', () => {
  it('le silence : on redemande, sans analyser', () => {
    const a = analyser(new Float32Array(16000), 16000, [1], modele, REF);
    expect(a.probleme).toBe('silence');
    expect(a.syllabes.every((s) => s.verdict.etat === 'redemander')).toBe(true);
  });

  it('un son saturé : on redemande', () => {
    const x = syllabe(courbes[4], 0.35, { amplitude: 3 });
    for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, x[i]));
    const a = analyser(x, 16000, [4], modele, REF);
    expect(a.probleme).toBe('sature');
    expect(a.syllabes[0].verdict.etat).toBe('redemander');
  });

  it('un ton 2 attendu dit en ton 3 n’est jamais reconnu', () => {
    const a = analyser(syllabe(courbes[3], 0.45), 16000, [2], modele, REF);
    expect(a.probleme).toBeNull();
    expect(a.syllabes[0].verdict.etat).not.toBe('juste');
  });

  it('un mot de deux syllabes : un verdict par syllabe', () => {
    const x = new Float32Array([...syllabe(courbes[1], 0.3, { marge: 0.1 }), ...syllabe(courbes[4], 0.3, { marge: 0.1 })]);
    const a = analyser(x, 16000, [1, 4], modele, REF);
    expect(a.syllabes.map((s) => s.verdict.entendu)).toEqual([1, 4]);
  });

  it('l’inférence d’une syllabe prend moins d’une milliseconde', () => {
    const x = entrees(2);
    for (let i = 0; i < 200; i++) predire(modele, x);
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) predire(modele, x);
    expect((performance.now() - t0) / 1000).toBeLessThan(1);
  });
});
