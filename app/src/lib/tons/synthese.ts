/**
 * Syllabes synthétiques pour les tests : un son voisé (somme d'harmoniques à
 * pente spectrale, comme une source glottale grossière) dont la F0 suit une
 * courbe donnée, entouré de silence. Ce n'est pas une voix, c'est un signal
 * dont on connaît la hauteur exacte à chaque instant.
 */

export interface OptionsSynthese {
  sr?: number;
  /** Silence avant et après, en secondes. */
  marge?: number;
  harmoniques?: number;
  /** Amplitude du fondamental relative aux harmoniques (0 : fondamental absent). */
  fondamental?: number;
  /** Écart-type d'un bruit blanc ajouté, en pleine échelle. */
  bruit?: number;
  amplitude?: number;
  graine?: number;
}

export function syllabe(f0: (u: number) => number, duree: number, o: OptionsSynthese = {}): Float32Array {
  const sr = o.sr ?? 16000, marge = o.marge ?? 0.15, H = o.harmoniques ?? 12;
  const nV = Math.round(duree * sr), nM = Math.round(marge * sr);
  const x = new Float32Array(nV + 2 * nM);
  let phase = 0;
  const amp = o.amplitude ?? 0.3;
  for (let i = 0; i < nV; i++) {
    const u = i / nV;
    const f = f0(u);
    phase += (2 * Math.PI * f) / sr;
    let s = 0;
    for (let h = 1; h <= H; h++) {
      if (h * f > sr / 2) break;
      const a = h === 1 ? (o.fondamental ?? 1) : 1 / h;
      s += a * Math.sin(h * phase);
    }
    // enveloppe : attaque et relâchement de 20 ms
    const env = Math.min(1, i / (0.02 * sr), (nV - i) / (0.02 * sr));
    x[nM + i] = amp * env * s / 3;
  }
  if (o.bruit) {
    let g = o.graine ?? 1;
    const u = () => ((g = (g * 1103515245 + 12345) % 2147483648) + 1) / 2147483649;
    for (let i = 0; i < x.length; i++) x[i] += o.bruit * Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  }
  return x;
}

/** Les quatre tons d'une voix dont la moyenne est `ref` Hz, en courbes de F0 (u de 0 à 1). */
export function courbesTons(ref = 200): Record<1 | 2 | 3 | 4, (u: number) => number> {
  const st = (d: number) => ref * Math.pow(2, d / 12);
  return {
    1: () => st(4),
    2: (u) => st(u < 0.3 ? -1 - u : -1.3 + ((u - 0.3) / 0.7) * 7),
    3: (u) => st(u < 0.5 ? -1 - u * 10 : -6 + (u - 0.5) * 10),
    4: (u) => st(u < 0.15 ? 5 + u * 4 : 5.6 - ((u - 0.15) / 0.85) * 10),
  };
}
