/**
 * L'extrait d'une syllabe de phrase (FLEURS), pour la recette des poids de « Dis-le » : la plage
 * `[a, b)` que `data/sources/tons/aligner.py` donne en trames de 10 ms devient un morceau du
 * signal, que `extraire.ts` et `mesurer.ts` traitent comme l'enregistrement d'un caractère
 * (`suivreHauteur` puis `segmenter`, réglages de l'app).
 */
import { readFileSync } from 'node:fs';
import { lireWav, reechantillonner } from '../../src/lib/tons/wav';

/** Le pas des trames (10 ms à 16 kHz). */
const PAS = 160;
/** Ce qu'il faut après le début de la dernière trame : sa fenêtre (25 ms) et le plus long retard de YIN (60 Hz). */
const MARGE = 400 + 267;

/** Le signal d'un WAV, mono, à 16 kHz. */
export function lireSignal(chemin: string): Float32Array {
  const o = readFileSync(chemin);
  const { sr, x } = lireWav(o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer);
  return sr === 16000 ? x : reechantillonner(x, sr, 16000);
}

/** Les échantillons des trames `[a, b)`. */
export function extrait(x: Float32Array, a: number, b: number): Float32Array {
  return x.subarray(Math.max(0, a * PAS), Math.min(x.length, b * PAS + MARGE));
}
