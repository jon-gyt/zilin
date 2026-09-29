/**
 * Lecture et écriture d'un WAV PCM (8, 16, 24, 32 bits entiers ou 32 bits flottants), et
 * rééchantillonnage vers 16 kHz. Sans dépendance. Le rééchantillonnage sert au micro
 * (`micro.ts` : l'appareil capte à 44,1 ou 48 kHz) ; la lecture et l'écriture servent aux
 * tests, à l'extraction des caractéristiques du corpus d'entraînement
 * (`app/scripts/tons/extraire.ts`) et aux syllabes synthétiques du faux micro de Playwright.
 */

export interface Audio {
  sr: number;
  x: Float32Array;
}

export function lireWav(buf: ArrayBuffer): Audio {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Pas un fichier WAV');
  let o = 12;
  let fmt = 0, canaux = 1, sr = 16000, bits = 16;
  let donnees = -1, taille = 0;
  while (o + 8 <= v.byteLength) {
    const id = tag(o), n = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      fmt = v.getUint16(o + 8, true);
      canaux = v.getUint16(o + 10, true);
      sr = v.getUint32(o + 12, true);
      bits = v.getUint16(o + 22, true);
      if (fmt === 0xfffe) fmt = v.getUint16(o + 32, true); // WAVE_FORMAT_EXTENSIBLE
    } else if (id === 'data') {
      donnees = o + 8;
      taille = Math.min(n, v.byteLength - donnees);
      break;
    }
    o += 8 + n + (n & 1);
  }
  if (donnees < 0) throw new Error('WAV sans bloc data');
  const oct = bits / 8;
  const n = Math.floor(taille / (oct * canaux));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < canaux; c++) {
      const p = donnees + (i * canaux + c) * oct;
      if (fmt === 3 && bits === 32) s += v.getFloat32(p, true);
      else if (bits === 16) s += v.getInt16(p, true) / 32768;
      else if (bits === 8) s += (v.getUint8(p) - 128) / 128;
      else if (bits === 24) s += ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) / 8388608);
      else if (bits === 32) s += v.getInt32(p, true) / 2147483648;
      else throw new Error(`WAV ${bits} bits non pris en charge`);
    }
    x[i] = s / canaux;
  }
  return { sr, x };
}

/**
 * Rééchantillonnage linéaire, précédé d'une moyenne glissante quand on
 * descend en fréquence (anti-repliement suffisant pour la F0, qui est sous 500 Hz).
 */
export function reechantillonner(x: Float32Array, srIn: number, srOut = 16000): Float32Array {
  if (srIn === srOut) return x;
  let src = x;
  const r = srIn / srOut;
  if (r > 1) {
    const k = Math.max(1, Math.round(r));
    src = new Float32Array(x.length);
    let s = 0;
    for (let i = 0; i < x.length; i++) {
      s += x[i];
      if (i >= k) s -= x[i - k];
      src[i] = s / Math.min(i + 1, k);
    }
  }
  const n = Math.floor(x.length / r);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * r, a = Math.floor(p), f = p - a;
    y[i] = a + 1 < src.length ? src[a] * (1 - f) + src[a + 1] * f : src[a];
  }
  return y;
}

/** Écrit un WAV PCM 16 bits mono (tests et fixtures synthétiques). */
export function ecrireWav(x: Float32Array, sr: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const s = (o: number, t: string) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); s(8, 'WAVE');
  s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  s(36, 'data'); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  return buf;
}
