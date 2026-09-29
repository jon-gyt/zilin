/**
 * « Réécouter » (retour du propriétaire du 29 septembre 2026) : la voix de l'apprenant se
 * rejoue après chaque prise ; elle reste en mémoire le temps de la question, jamais gardée ni
 * envoyée.
 */
import { describe, expect, it } from 'vitest';
import { CRETE, GAIN_MAX, MARGES, Reecoute, extraitVoix } from './reecoute';
import { syllabe } from './synthese';
import { lireWav } from './wav';

const SR = 48000;

/** Une prise comme celles du micro : du silence, la voix, puis l'arrêt sur silence. */
function prise(amplitude = 0.3): Float32Array {
  const voix = syllabe((u) => 200 + 60 * u, 0.4, { sr: SR, marge: 0, amplitude });
  const x = new Float32Array(Math.round(0.8 * SR) + voix.length + Math.round(0.7 * SR));
  x.set(voix, Math.round(0.8 * SR));
  return x;
}

describe('ce qu’on rejoue', () => {
  it('la voix et un peu de silence autour, sans les longs silences de la prise', () => {
    const y = extraitVoix(prise(), SR);
    const attendu = 0.4 + MARGES.avant + MARGES.apres;
    expect(y.length / SR).toBeGreaterThan(attendu - 0.06);
    expect(y.length / SR).toBeLessThan(attendu + 0.06);
  });

  it('une prise faible (sans gain automatique) est remontée, sans dépasser le gain au plus', () => {
    for (const amplitude of [0.3, 0.1, 0.03]) {
      const x = prise(amplitude);
      const avant = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      const pic = extraitVoix(x, SR).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(pic).toBeCloseTo(Math.min(CRETE, avant * GAIN_MAX), 5);
      expect(pic).toBeGreaterThan(avant);
    }
    const bruit = extraitVoix(new Float32Array(SR).map((_, i) => 0.001 * Math.sin(i)), SR);
    expect(bruit.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(0.001 * GAIN_MAX + 1e-6);
  });

  it('sans clic aux bords : le premier et le dernier échantillon sont nuls', () => {
    const y = extraitVoix(prise(), SR);
    expect(y[0]).toBe(0);
    expect(Math.abs(y[y.length - 1])).toBeLessThan(1e-3);
  });
});

/** Des outils de navigateur d'essai : ils notent ce qu'on leur demande. */
function outils() {
  const o = {
    creees: [] as Blob[],
    revoquees: [] as string[],
    jouees: [] as string[],
    creer: (b: Blob) => {
      o.creees.push(b);
      return `blob:wenlu/${o.creees.length}`;
    },
    revoquer: (u: string) => void o.revoquees.push(u),
    jouer: async (u: string) => {
      o.jouees.push(u);
      return true;
    }
  };
  return o;
}

describe('la prise de la question', () => {
  it('après une prise, « Réécouter » rejoue la voix, en WAV, par une URL locale', async () => {
    const o = outils();
    const r = new Reecoute(o);
    expect(r.pret).toBe(false);
    expect(await r.jouer()).toBe(false);
    r.garder(prise(), SR);
    expect(r.pret).toBe(true);
    expect(await r.jouer()).toBe(true);
    expect(o.jouees).toEqual(['blob:wenlu/1']);
    const wav = lireWav(await o.creees[0].arrayBuffer());
    expect(wav.sr).toBe(SR);
    expect(o.creees[0].type).toBe('audio/wav');
  });

  it('une nouvelle prise remplace la précédente, qui est oubliée', () => {
    const o = outils();
    const r = new Reecoute(o);
    r.garder(prise(), SR);
    r.garder(prise(), SR);
    expect(o.revoquees).toEqual(['blob:wenlu/1']);
  });

  it('la question suivante l’oublie : l’URL est révoquée, rien ne reste à rejouer', async () => {
    const o = outils();
    const r = new Reecoute(o);
    r.garder(prise(), SR);
    r.oublier();
    expect(o.revoquees).toEqual(['blob:wenlu/1']);
    expect(r.pret).toBe(false);
    expect(await r.jouer()).toBe(false);
    expect(o.jouees).toEqual([]);
  });
});
