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
  /**
   * Une fin qui s'éteint, sur les `duree` dernières secondes de la voix (retour du
   * propriétaire du 29 septembre 2026 : « le ton détecté semble monter d'un coup à la fin ») :
   * - `eteinte` : l'amplitude tombe de 40 dB, la hauteur continue ;
   * - `friture` : voix craquée, des impulsions espacées de deux périodes, dont la résonance
   *   (un formant vers 450 Hz) sonne entre deux coups ;
   * - `souffle` : la voix se tait et un souffle (bruit filtré) la prolonge ;
   * - `octave` : les harmoniques impairs s'éteignent, le signal devient périodique à
   *   l'octave au-dessus (ce qu'un suivi lit comme un saut d'octave final).
   */
  fin?: { type: 'eteinte' | 'friture' | 'souffle' | 'octave'; duree: number; niveau?: number };
}

export function syllabe(f0: (u: number) => number, duree: number, o: OptionsSynthese = {}): Float32Array {
  const sr = o.sr ?? 16000, marge = o.marge ?? 0.15, H = o.harmoniques ?? 12;
  const nV = Math.round(duree * sr), nM = Math.round(marge * sr);
  const x = new Float32Array(nV + 2 * nM);
  let phase = 0;
  const amp = o.amplitude ?? 0.3;
  let g = o.graine ?? 1;
  const alea = () => ((g = (g * 1103515245 + 12345) % 2147483648) + 1) / 2147483649;
  const nFin = o.fin ? Math.min(nV, Math.round(o.fin.duree * sr)) : 0;
  const debutFin = nV - nFin;
  const niveauFin = o.fin?.niveau ?? (o.fin?.type === 'souffle' ? 0.25 : 0.5);
  /* La friture : une impulsion glottale amortie toutes les deux périodes, à ±15 % près. */
  let prochaine = debutFin;
  let impulsion = -1;
  let fPulse = 0;
  for (let i = 0; i < nV; i++) {
    const u = i / nV;
    const f = f0(u);
    phase += (2 * Math.PI * f) / sr;
    const impairs = o.fin?.type === 'octave' && i >= debutFin ? Math.max(0, 1 - (i - debutFin) / (0.02 * sr)) : 1;
    let s = 0;
    for (let h = 1; h <= H; h++) {
      if (h * f > sr / 2) break;
      const a = (h === 1 ? (o.fondamental ?? 1) : 1 / h) * (h % 2 === 1 ? impairs : 1);
      s += a * Math.sin(h * phase);
    }
    // enveloppe : attaque et relâchement de 20 ms
    let env = Math.min(1, i / (0.02 * sr), (nV - i) / (0.02 * sr));
    if (o.fin && i >= debutFin) {
      const v = (i - debutFin) / Math.max(1, nFin);
      if (o.fin.type === 'eteinte') env = Math.min(1, i / (0.02 * sr)) * Math.pow(10, (-40 * v) / 20);
      else if (o.fin.type === 'friture') {
        if (i >= prochaine) {
          impulsion = i;
          fPulse = f;
          prochaine = i + Math.round((2 * sr * (0.85 + 0.3 * alea())) / f);
        }
        const k = (i - impulsion) / sr;
        /* un formant vers 450 Hz, amorti en 8 ms, frappé à chaque impulsion */
        s = impulsion < 0 ? 0 : 3 * Math.exp(-k / 0.008) * Math.sin(2 * Math.PI * 450 * k) * (0.6 + 0.4 * Math.cos(Math.PI * fPulse * k));
        env = niveauFin * (1 - 0.5 * v);
      } else {
        /* le souffle : la voix s'éteint en 30 ms, un bruit grave prend sa place */
        env *= Math.max(0, 1 - (i - debutFin) / (0.03 * sr));
      }
    }
    x[nM + i] = amp * env * s / 3;
  }
  if (o.fin?.type === 'souffle') {
    /* bruit blanc passé deux fois dans un passe-bas à un pôle (vers 1 kHz), qui décroît */
    let a = 0, b = 0;
    const k = 1 - Math.exp((-2 * Math.PI * 1000) / sr);
    for (let i = debutFin; i < nV; i++) {
      const v = (i - debutFin) / Math.max(1, nFin);
      a += k * (alea() * 2 - 1 - a);
      b += k * (a - b);
      x[nM + i] += amp * niveauFin * 4 * b * (1 - v);
    }
  }
  if (o.bruit) {
    for (let i = 0; i < x.length; i++) x[i] += o.bruit * Math.sqrt(-2 * Math.log(alea())) * Math.cos(2 * Math.PI * alea());
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
