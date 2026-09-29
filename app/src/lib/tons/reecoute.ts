/**
 * « Réécouter » (retour du propriétaire du 29 septembre 2026 : « Ce serait bien de pouvoir
 * réécouter ce qu'on vient de dire ») : après chaque prise de « Dis-le », l'apprenant rejoue
 * sa voix pour la comparer à la voix de référence.
 *
 * La confidentialité reste vraie : l'enregistrement reste en mémoire le temps de la question,
 * dans un `Blob` dont l'URL est locale à la page (`blob:`), jamais écrit ni envoyé. Une
 * nouvelle prise remplace la précédente ; la question qui change, l'écran qui s'en va ou
 * « Suivant » l'oublient (`oublier` révoque l'URL). Aucune requête, aucun stockage.
 *
 * `extraitVoix` est pur et testé ; `Reecoute` prend ses fonctions de navigateur en injection.
 */
import { jouerSon } from '../audio';
import { ecrireWav } from './wav';

/** Autour de la voix : ce qu'on garde de silence avant et après, en secondes. */
export const MARGES = { avant: 0.12, apres: 0.2 };

/** Le niveau de crête visé (pleine échelle) : sans gain automatique, une prise peut être faible. */
export const CRETE = 0.8;

/** Le gain au plus : un bruit de fond n'est pas monté au niveau d'une voix. */
export const GAIN_MAX = 8;

/**
 * Ce qu'on rejoue d'une prise : la voix et un peu de silence autour, sans les longs silences
 * du début et de l'arrêt sur silence, ramenée à un niveau d'écoute (crête à `CRETE`, gain de
 * `GAIN_MAX` au plus). Une prise sans voix rend le peu qu'elle a, tel quel. Pur.
 */
export function extraitVoix(x: Float32Array, sr: number): Float32Array {
  const fen = Math.max(1, Math.round(0.02 * sr));
  const n = Math.floor(x.length / fen);
  if (n === 0) return new Float32Array(0);
  const rms: number[] = [];
  let pic = 0;
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = k * fen; i < (k + 1) * fen; i++) s += x[i] * x[i];
    rms.push(Math.sqrt(s / fen));
  }
  for (let i = 0; i < x.length; i++) pic = Math.max(pic, Math.abs(x[i]));
  const fort = Math.max(...rms);
  const seuil = Math.max(fort * 0.1, 0.003);
  let a = rms.findIndex((r) => r >= seuil);
  let b = n - 1;
  while (b >= 0 && rms[b] < seuil) b--;
  if (a < 0 || fort < 0.003) {
    a = 0;
    b = n - 1;
  }
  const debut = Math.max(0, a * fen - Math.round(MARGES.avant * sr));
  const fin = Math.min(x.length, (b + 1) * fen + Math.round(MARGES.apres * sr));
  const gain = pic > 0 ? Math.min(GAIN_MAX, CRETE / pic) : 1;
  const y = x.slice(debut, fin);
  for (let i = 0; i < y.length; i++) y[i] *= gain;
  /* 5 ms de fondu aux bords : pas de clic à la coupe */
  const f = Math.min(Math.round(0.005 * sr), y.length >> 1);
  for (let i = 0; i < f; i++) {
    y[i] *= i / f;
    y[y.length - 1 - i] *= i / f;
  }
  return y;
}

/** Ce que `Reecoute` demande au navigateur : faire et défaire une URL locale, jouer. */
export type OutilsReecoute = {
  creer: (b: Blob) => string;
  revoquer: (url: string) => void;
  jouer: (url: string) => Promise<boolean>;
};

const OUTILS: OutilsReecoute = {
  creer: (b) => URL.createObjectURL(b),
  revoquer: (u) => URL.revokeObjectURL(u),
  jouer: jouerSon
};

/** L'enregistrement de la question en cours, prêt à rejouer. Un seul à la fois. */
export class Reecoute {
  private url = '';
  private readonly outils: OutilsReecoute;

  constructor(outils: Partial<OutilsReecoute> = {}) {
    this.outils = { ...OUTILS, ...outils };
  }

  /** Une prise est là, qu'on peut rejouer. */
  get pret(): boolean {
    return this.url !== '';
  }

  /** Garde la dernière prise (le son tel que capté), à la place de la précédente. */
  garder(x: Float32Array, sr: number): void {
    this.oublier();
    const y = extraitVoix(x, sr);
    if (y.length === 0) return;
    this.url = this.outils.creer(new Blob([ecrireWav(y, sr)], { type: 'audio/wav' }));
  }

  /** Rejoue la prise gardée. Rend `true` si elle joue. */
  jouer(): Promise<boolean> {
    return this.url === '' ? Promise.resolve(false) : this.outils.jouer(this.url);
  }

  /** Oublie la prise : l'URL locale est révoquée, le son n'existe plus que pour le ramasse-miettes. */
  oublier(): void {
    if (this.url !== '') this.outils.revoquer(this.url);
    this.url = '';
  }
}
