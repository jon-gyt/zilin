/**
 * Le suivi de hauteur de « Dis-le » (story 9.1), porté du prototype de l'étude sous Vitest :
 * des signaux dont la hauteur est connue à chaque instant (`synthese.ts`).
 */
import { describe, expect, it } from 'vitest';
import { demiTons, moyenneLog, segmenter, suivreHauteur, viterbi } from './pitch';
import { syllabe } from './synthese';
import { ecrireWav, lireWav, reechantillonner } from './wav';

const voisees = (x: Float32Array) => suivreHauteur(x).filter((t) => t.voisee);
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1];

describe('le suivi de hauteur', () => {
  it('une sinusoïde de 200 Hz est lue à 1 % près', () => {
    const f = voisees(syllabe(() => 200, 0.5, { harmoniques: 1 })).map((t) => t.f0);
    expect(f.length).toBeGreaterThan(30);
    expect(Math.abs(mediane(f) - 200)).toBeLessThan(2);
  });

  it('une voix grave à fondamental faible reste à son octave (pas de doublement)', () => {
    const f = voisees(syllabe(() => 110, 0.5, { fondamental: 0.2 })).map((t) => t.f0);
    expect(f.filter((v) => Math.abs(v / 110 - 1) >= 0.05)).toEqual([]);
  });

  it('une voix aiguë à 520 Hz (fin d’un ton 2 appuyé) est suivie', () => {
    expect(Math.abs(mediane(voisees(syllabe(() => 520, 0.3)).map((t) => t.f0)) - 520)).toBeLessThan(8);
  });

  it('une chute rapide de ton 4 (300 → 120 Hz en 250 ms) est suivie sans saut d’octave', () => {
    const f0 = (u: number) => 300 * Math.pow(120 / 300, u);
    const [seg] = segmenter(suivreHauteur(syllabe(f0, 0.25)), 1);
    expect(seg).toBeDefined();
    for (let i = 0; i < seg.f0.length; i++) {
      const u = (seg.t[i] - 0.15) / 0.25;
      if (u < 0.1 || u > 0.9) continue;
      expect(Math.abs(demiTons(seg.f0[i], f0(u)))).toBeLessThan(1);
    }
  });

  it('le silence ne donne aucune trame voisée ni segment', () => {
    const x = new Float32Array(16000);
    expect(voisees(x).length).toBe(0);
    expect(segmenter(suivreHauteur(x), 1)).toEqual([]);
  });

  it('un bruit blanc seul ne donne presque rien de voisé', () => {
    expect(voisees(syllabe(() => 200, 0.01, { bruit: 0.05, marge: 0.5 })).length).toBeLessThan(5);
  });

  it('une coupure de 60 ms au creux du ton 3 est comblée : un seul segment', () => {
    const a = syllabe((u) => 200 - 60 * u, 0.2, { marge: 0.1 });
    const b = syllabe((u) => 140 + 60 * u, 0.2, { marge: 0 });
    const trou = new Float32Array(Math.round(0.06 * 16000));
    const x = new Float32Array([...a.slice(0, a.length - 1600), ...trou, ...b, ...new Float32Array(1600)]);
    const segs = segmenter(suivreHauteur(x), 1);
    expect(segs.length).toBe(1);
    expect(segs[0].duree).toBeGreaterThan(0.4);
    expect(segs[0].voisement).toBeLessThan(1);
  });

  it('un mot de deux syllabes est coupé au silence qui les sépare', () => {
    const x = new Float32Array([...syllabe(() => 250, 0.25, { marge: 0.1 }), ...syllabe((u) => 260 - 100 * u, 0.25, { marge: 0.1 })]);
    const segs = segmenter(suivreHauteur(x), 2);
    expect(segs.length).toBe(2);
    expect(Math.abs(mediane(segs[0].f0) - 250)).toBeLessThan(5);
    expect(segs[1].f0[0]).toBeGreaterThan(segs[1].f0[segs[1].f0.length - 1] + 50);
  });

  it('viterbi préfère la continuité à un saut d’octave isolé', () => {
    const c = [[{ f0: 200, ap: 0.05 }], [{ f0: 100, ap: 0.04 }, { f0: 200, ap: 0.1 }], [{ f0: 202, ap: 0.05 }]];
    expect(viterbi(c, 2, 0)).toEqual([200, 200, 202]);
  });

  it('moyenneLog et demiTons : une octave vaut 12 demi-tons', () => {
    expect(Math.round(demiTons(400, 200))).toBe(12);
    expect(Math.abs(moyenneLog([100, 400]) - 200)).toBeLessThan(1e-9);
  });

  it('le micro à 44,1 kHz est ramené à 16 kHz sans changer la hauteur (WAV écrit puis relu)', () => {
    const x = syllabe(() => 200, 0.2, { sr: 44100 });
    const { sr, x: y } = lireWav(ecrireWav(x, 44100));
    expect(sr).toBe(44100);
    expect(Math.abs(y[5000] - x[5000])).toBeLessThan(1e-3);
    const z = reechantillonner(y, sr, 16000);
    expect(Math.abs(z.length - Math.round((x.length * 16000) / 44100))).toBeLessThanOrEqual(1);
    expect(Math.abs(mediane(suivreHauteur(z).filter((t) => t.voisee).map((t) => t.f0)) - 200)).toBeLessThan(3);
  });

  it('le suivi d’une seconde de parole tient en moins de 100 ms', () => {
    const x = syllabe((u) => 180 + 80 * u, 1.0);
    suivreHauteur(x); // chauffe
    const t0 = performance.now();
    suivreHauteur(x);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
