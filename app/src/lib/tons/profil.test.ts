/**
 * Le profil de tons d'un mot entier (décision du propriétaire du 4 octobre 2026, « Revoir la
 * méthode des mots ») : un test par règle. Le modèle des mots n'est pas branché dans l'app
 * (mesure du 7 octobre 2026 sous le seuil, `data/sources/tons/PROVENANCE.md`) ; ces règles
 * tiennent pour le jour où il le sera.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyser, type Contour, type Modele, type Ton } from './classifieur';
import { MOTS_DIRE } from './dire';
import { lireModele } from './modele';
import {
  entreesMot,
  jugerMot,
  lireModeleMots,
  marginale,
  N_ENTREES_MOT,
  PROFILS,
  probabilitesMot,
  rangProfil,
  SEUILS_PROFIL,
  type ModeleMots
} from './profil';
import { courbesTons, syllabe } from './synthese';

const caracteres = lireModele(JSON.parse(readFileSync(new URL('../../../public/data/0.1.0/tons.json', import.meta.url), 'utf8'))) as Modele;

/** Un modèle des mots sans avis : toutes ses sorties égales (une couche nulle). */
function neutre(melange = 0.5): ModeleMots {
  return {
    format: 'wenlu-tons-mots',
    version: 'test',
    profils: PROFILS.map((p) => [...p]),
    entrees: N_ENTREES_MOT,
    membres: [
      {
        normalisation: { moyenne: Array(N_ENTREES_MOT).fill(0), ecart: Array(N_ENTREES_MOT).fill(1) },
        couches: [{ poids: PROFILS.map(() => Array(N_ENTREES_MOT).fill(0)), biais: PROFILS.map(() => 0) }]
      }
    ],
    temperature: 1,
    melange
  };
}

/** Des probabilités de profils : `p` sur le profil `[a, b]`, le reste partagé. */
function sur(a: Ton, b: Ton, p: number): number[] {
  const i = rangProfil([a, b]);
  return PROFILS.map((_, k) => (k === i ? p : (1 - p) / (PROFILS.length - 1)));
}

const c = (moyenne: number, duree = 0.2): Contour => ({ points: Array.from({ length: 30 }, (_, i) => (i - 14.5) / 10), moyenne, duree, voisement: 1 });

describe('les profils', () => {
  it('19 profils : 4 × 4 tons pleins, plus le neutre en seconde syllabe ; jamais 3-3, jamais un neutre en tête', () => {
    expect(PROFILS.length).toBe(19);
    expect(rangProfil([3, 3])).toBe(-1);
    expect(rangProfil([5, 1])).toBe(-1);
    expect(rangProfil([2, 3])).toBeGreaterThanOrEqual(0);
    expect(rangProfil([1, 5])).toBeGreaterThanOrEqual(0);
  });

  it('le modèle des mots doit sortir ces profils, dans cet ordre, ou il est refusé', () => {
    expect(lireModeleMots(neutre())).not.toBeNull();
    expect(lireModeleMots({ ...neutre(), profils: [...PROFILS.slice(1), PROFILS[0]].map((p) => [...p]) })).toBeNull();
    expect(lireModeleMots({ ...neutre(), entrees: 34 })).toBeNull();
  });
});

describe('les entrées du mot entier', () => {
  it('la forme, la hauteur et la durée de chaque syllabe, et la hauteur de l’une face à l’autre', () => {
    const x = entreesMot([c(200), c(150)], 180);
    expect(x.length).toBe(N_ENTREES_MOT);
    expect(x[N_ENTREES_MOT - 2]).toBe(1);
    expect(x[N_ENTREES_MOT - 1]).toBeCloseTo(12 * Math.log2(150 / 200), 6);
  });

  it('sans voix connue, la hauteur face à la voix vaut 0, mais l’écart entre les syllabes reste', () => {
    const x = entreesMot([c(200), c(150)]);
    expect(x[15]).toBe(0);
    expect(x[N_ENTREES_MOT - 2]).toBe(0);
    expect(x[N_ENTREES_MOT - 1]).toBeCloseTo(12 * Math.log2(150 / 200), 6);
  });
});

describe('le jugement d’un mot sur son profil', () => {
  it('le profil attendu est reconnu dès que sa probabilité atteint le seuil, même talonné', () => {
    const p = sur(2, 3, SEUILS_PROFIL.juste);
    p[rangProfil([2, 4])] += 0.05;
    expect(jugerMot([2, 3], p).etat).toBe('juste');
    expect(jugerMot([2, 3], p).syllabes.map((v) => v.etat)).toEqual(['juste', 'juste']);
  });

  it('un autre profil n’est affirmé que sûr à 0,98, l’attendu sous 1 % ; sinon on redemande', () => {
    expect(jugerMot([1, 4], sur(1, 3, 0.985)).etat).toBe('autre');
    expect(jugerMot([1, 4], sur(1, 3, 0.95)).etat).toBe('redemander');
  });

  it('un autre profil : seule la syllabe qui diffère est nommée, avec le ton entendu', () => {
    const v = jugerMot([1, 4], sur(1, 3, 0.99));
    expect(v.syllabes.map((s) => s.etat)).toEqual(['juste', 'autre']);
    expect(v.syllabes[1].entendu).toBe(3);
  });

  it('des probabilités illisibles : on redemande, jamais de note au hasard', () => {
    expect(jugerMot([1, 4], PROFILS.map(() => NaN)).etat).toBe('redemander');
  });

  it('la probabilité d’un ton de syllabe est la somme des profils qui le portent', () => {
    const m = marginale(sur(4, 5, 0.5), 1);
    expect(m.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(m[4]).toBeGreaterThan(0.5);
  });

  it('mêlé aux caractères : un modèle des mots sans avis laisse décider les deux syllabes', () => {
    const s1 = [0.05, 0.8, 0.1, 0.05, 0], s2 = [0.1, 0.1, 0.6, 0.1, 0.1];
    const p = probabilitesMot(neutre(), entreesMot([c(200), c(150)], 180), [s1, s2]);
    expect(PROFILS[p.indexOf(Math.max(...p))]).toEqual([2, 3]);
  });
});

describe('la notation des caractères isolés ne change pas', () => {
  const t = courbesTons(200);
  it('un caractère : le même verdict avec ou sans modèle des mots', () => {
    for (const ton of [1, 2, 3, 4] as Ton[]) {
      const x = syllabe(t[ton as 1 | 2 | 3 | 4], 0.35);
      const a = analyser(x, 16000, [ton], caracteres, 200);
      const b = analyser(x, 16000, [ton], caracteres, 200, {}, null, neutre());
      expect(b.etat).toBe(a.etat);
      expect(b.syllabes[0].verdict.probabilites).toEqual(a.syllabes[0].verdict.probabilites);
    }
  });

  it('sans modèle des mots, un mot est jugé syllabe par syllabe, comme le 30 septembre', () => {
    const x = new Float32Array([...syllabe(t[1], 0.3), ...syllabe(t[4], 0.3)]);
    expect(analyser(x, 16000, [1, 4], caracteres, 200).etat).toBe('juste');
  });

  it('avec lui, le même mot est reconnu sur son profil', () => {
    const x = new Float32Array([...syllabe(t[1], 0.3), ...syllabe(t[4], 0.3)]);
    const a = analyser(x, 16000, [1, 4], caracteres, 200, {}, null, neutre());
    expect(a.etat).toBe('juste');
    expect(a.syllabes.map((s) => s.verdict.entendu)).toEqual([1, 4]);
  });

  it('une seconde syllabe brève (le neutre) n’est pas une raison de redemander', () => {
    const x = new Float32Array([...syllabe(t[4], 0.3), ...syllabe((u) => 160 - 10 * u, 0.06)]);
    const a = analyser(x, 16000, [4, 5], caracteres, 200, {}, null, neutre());
    expect(a.probleme).toBeNull();
  });

  it('la question de mot reste éteinte : le modèle des mots n’a pas passé la mesure', () => {
    expect(MOTS_DIRE).toBe(false);
  });
});
