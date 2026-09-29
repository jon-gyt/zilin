/**
 * Le suivi de hauteur de « Dis-le » (story 9.1), porté du prototype de l'étude sous Vitest :
 * des signaux dont la hauteur est connue à chaque instant (`synthese.ts`).
 */
import { describe, expect, it } from 'vitest';
import { demiTons, moyenneLog, segmenter, suivreHauteur, viterbi, type Trame } from './pitch';
import { courbesTons, syllabe } from './synthese';
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

/**
 * Les fins qui s'éteignent (retour du propriétaire du 29 septembre 2026 : « le ton détecté
 * semble monter d'un coup à la fin ») : la plus forte montée entre deux trames voisines, à
 * trois trames au plus d'écart, sur le dernier quart de la syllabe.
 */
function sautFinal(f0: number[]): number {
  let m = 0;
  for (let i = Math.floor(0.75 * f0.length); i < f0.length; i++) {
    for (let k = 1; k <= 3 && i - k >= 0; k++) m = Math.max(m, demiTons(f0[i], f0[i - k]));
  }
  return m;
}

/** Des trames toutes voisées, d'une hauteur et d'une énergie données, 10 ms d'écart. */
function trames(f0: number[], rms: (i: number) => number = () => 0.1, ap: (i: number) => number = () => 0.02): Trame[] {
  return f0.map((f, i) => ({ t: 0.1 + i * 0.01, f0: f, aperiodicite: ap(i), rms: rms(i), voisee: f > 0 }));
}

describe('la fin de la syllabe', () => {
  it('une fin qui s’éteint est coupée sous 15 dB du pic : la courbe ne garde que la voix', () => {
    // un ton 1 à 200 Hz dont les huit dernières trames tombent de 20 à 34 dB sous le pic, où le
    // suivi lit du bruit à 330 Hz
    const f0 = [...Array(32).fill(200), ...Array(8).fill(330)];
    const x = trames(f0, (i) => (i < 32 ? 0.1 : 0.1 * Math.pow(10, -(20 + 2 * (i - 32)) / 20)));
    const [ancien] = segmenter(x, 1, 0.12, null);
    const [seg] = segmenter(x, 1);
    expect(sautFinal(ancien.f0)).toBeGreaterThan(5);
    expect(seg.fin).toBe(32);
    expect(sautFinal(seg.f0)).toBeLessThan(1);
  });

  it('les trames de la fin trop peu périodiques (la confiance de YIN baisse) sont coupées', () => {
    const f0 = [...Array(30).fill(220), 230, 480, 490, 500];
    const x = trames(f0, () => 0.1, (i) => (i < 31 ? 0.02 : 0.33));
    expect(sautFinal(segmenter(x, 1, 0.12, null)[0].f0)).toBeGreaterThan(5);
    const [seg] = segmenter(x, 1);
    expect(seg.fin).toBe(31);
    expect(sautFinal(seg.f0)).toBeLessThan(1);
  });

  it('un saut d’octave final vers l’aigu, sans retour, est écarté', () => {
    // un ton 4 qui tombe de 280 à 170 Hz, puis ses quatre dernières trames lues à l'octave
    const f0 = Array.from({ length: 36 }, (_, i) => 280 * Math.pow(170 / 280, i / 35));
    for (let i = 32; i < 36; i++) f0[i] *= 2;
    const x = trames(f0);
    expect(sautFinal(segmenter(x, 1, 0.12, null)[0].f0)).toBeGreaterThan(10);
    const [seg] = segmenter(x, 1);
    expect(seg.fin).toBe(32);
    expect(sautFinal(seg.f0)).toBeLessThan(1);
    expect(seg.f0[seg.f0.length - 1]).toBeLessThan(seg.f0[0]);
  });

  it('un aller et retour d’une octave au milieu est ramené à l’octave de ses voisines', () => {
    const f0 = Array(30).fill(200);
    for (let i = 12; i < 16; i++) f0[i] = 400;
    const [seg] = segmenter(trames(f0), 1);
    expect(Math.max(...seg.f0)).toBeLessThan(205);
    expect(seg.voisement).toBe(1);
  });

  it('une vraie montée de ton 2, même rapide, est gardée', () => {
    const f0 = Array.from({ length: 35 }, (_, i) => (i < 10 ? 180 : 180 * Math.pow(2, (0.5 * (i - 10)) / 12)));
    const [seg] = segmenter(trames(f0), 1);
    expect(seg.fin).toBe(35);
    expect(demiTons(seg.f0[seg.f0.length - 1], seg.f0[0])).toBeGreaterThan(11);
  });

  it('une friture vocale en fin de ton 3 et de ton 4 ne fait plus monter la courbe', () => {
    const cas = [
      { ref: 120, ton: 3 as const },
      { ref: 200, ton: 4 as const },
      { ref: 280, ton: 4 as const }
    ];
    for (const { ref, ton } of cas) {
      const x = syllabe(courbesTons(ref)[ton], 0.5, { bruit: 0.001, fin: { type: 'friture', duree: 0.12 } });
      const tr = suivreHauteur(x);
      expect(sautFinal(segmenter(tr, 1, 0.12, null)[0].f0)).toBeGreaterThan(7);
      expect(sautFinal(segmenter(tr, 1)[0].f0)).toBeLessThan(5);
    }
  });

  it('une syllabe propre n’est pas touchée par le nettoyage de la fin', () => {
    const tr = suivreHauteur(syllabe(courbesTons(200)[2], 0.35));
    const [ancien] = segmenter(tr, 1, 0.12, null);
    const [seg] = segmenter(tr, 1);
    expect(seg.fin - seg.debut).toBeGreaterThanOrEqual(ancien.fin - ancien.debut - 2);
    expect(Math.abs(demiTons(seg.f0[seg.f0.length - 1], ancien.f0[seg.f0.length - 1]))).toBeLessThan(0.5);
  });
});

