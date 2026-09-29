/**
 * Le micro de « Dis-le » (story 9.1) : le droit décidé depuis ce que dit le navigateur, et
 * l'arrêt de la prise sur le silence qui suit la voix. La voix de l'apprenant (`voix.ts`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { configurerAudio } from '../audio';
import { CONTRAINTES, Detecteur, PRISE, decider, fermer, microPossible, type Constat } from './micro';
import { syllabe } from './synthese';
import { FENETRE_VOIX, ajouterMoyenne, lireVoix, refLocuteur } from './voix';

const BASE: Constat = { capture: true, securise: true, permission: null, entrees: null, refuseIci: false };

describe('le droit au micro', () => {
  it('accordé : la question se pose', () => {
    expect(decider({ ...BASE, permission: 'granted', entrees: 1 })).toBe('accorde');
    expect(microPossible('accorde')).toBe(true);
  });

  it('pas encore demandé (ou le navigateur ne dit rien, comme la WebView iOS) : la question se pose, l’appui le demandera', () => {
    expect(decider(BASE)).toBe('a-demander');
    expect(decider({ ...BASE, permission: 'prompt' })).toBe('a-demander');
    expect(microPossible('a-demander')).toBe(true);
  });

  it('refusé, par le navigateur ou pendant cette ouverture : la question ne se pose pas', () => {
    expect(decider({ ...BASE, permission: 'denied' })).toBe('refuse');
    expect(decider({ ...BASE, permission: 'granted', refuseIci: true })).toBe('refuse');
    expect(microPossible('refuse')).toBe(false);
  });

  it('pas de capture, pas de HTTPS, ou aucune entrée audio : absent, la question ne se pose pas', () => {
    expect(decider({ ...BASE, capture: false })).toBe('absent');
    expect(decider({ ...BASE, securise: false })).toBe('absent');
    expect(decider({ ...BASE, entrees: 0 })).toBe('absent');
    expect(microPossible('absent')).toBe(false);
  });
});

/** Pousse un signal par blocs de 2 048, comme le micro ; rend le temps (s) de l'arrêt, ou null. */
function arret(d: Detecteur, x: Float32Array): number | null {
  for (let i = 0; i < x.length; i += 2048) {
    if (d.pousser(x.subarray(i, i + 2048))) return (i + 2048) / d.sr;
  }
  return null;
}

describe('l’arrêt sur silence', () => {
  const sr = 48000;

  it('après la voix, 600 ms de silence arrêtent la prise', () => {
    const x = syllabe((u) => 200 + 60 * u, 0.45, { sr, marge: 0 });
    const tout = new Float32Array([...new Float32Array(0.3 * sr), ...x, ...new Float32Array(2 * sr)]);
    const d = new Detecteur(sr);
    const t = arret(d, tout);
    expect(d.voix).toBe(true);
    expect(t).not.toBeNull();
    const fin = 0.3 + 0.45;
    expect(t as number).toBeGreaterThan(fin + PRISE.silenceFin - 0.05);
    expect(t as number).toBeLessThan(fin + PRISE.silenceFin + 0.15);
  });

  it('sans voix, la prise s’arrête au plafond', () => {
    const d = new Detecteur(sr);
    const t = arret(d, new Float32Array(6 * sr));
    expect(d.voix).toBe(false);
    expect(t as number).toBeGreaterThanOrEqual(PRISE.max - 0.05);
    expect(t as number).toBeLessThan(PRISE.max + 0.1);
  });

  it('un bref clic ne passe pas pour une voix', () => {
    const x = new Float32Array(sr);
    for (let i = 0; i < 0.02 * sr; i++) x[Math.round(0.4 * sr) + i] = 0.5 * Math.sin(i);
    const d = new Detecteur(sr);
    d.pousser(x);
    expect(d.voix).toBe(false);
  });
});

describe('la voix de l’apprenant', () => {
  it('la référence : rien avant cinq syllabes, puis la médiane', () => {
    expect(refLocuteur([200, 210, 190, 205])).toBeUndefined();
    expect(refLocuteur([200, 210, 190, 205, 400])).toBeCloseTo(205, 9);
  });

  it('seules les trente dernières moyennes restent, arrondies au dixième', () => {
    let v: number[] = [];
    for (let i = 0; i < 40; i++) v = ajouterMoyenne(v, 200 + i + 0.123);
    expect(v.length).toBe(FENETRE_VOIX);
    expect(v[0]).toBe(210.1);
  });

  it('une moyenne qui n’est pas une voix est écartée, à l’ajout comme à l’import', () => {
    expect(ajouterMoyenne([], 12)).toEqual([]);
    expect(ajouterMoyenne([], Number.NaN)).toEqual([]);
    expect(lireVoix([200, 'x', 5000, 180])).toEqual([200, 180]);
    expect(lireVoix(undefined)).toEqual([]);
  });
});

describe('la fin de la prise rend le son à la lecture', () => {
  afterEach(() => configurerAudio());

  it('le micro est demandé sans annulation d’écho, sans débruitage, sans gain automatique', () => {
    expect(CONTRAINTES).toMatchObject({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 });
  });

  it('toutes les pistes s’arrêtent, les nœuds se détachent, le contexte se ferme, la session repasse en lecture', async () => {
    const session = { type: 'play-and-record' };
    configurerAudio({ session: () => session });
    const arretees: string[] = [];
    const detaches: string[] = [];
    let ferme = 0;
    const piste = (id: string) => ({ stop: () => arretees.push(id) }) as unknown as MediaStreamTrack;
    const noeud = (id: string) => ({ disconnect: () => detaches.push(id) }) as unknown as AudioNode;
    fermer(
      { getTracks: () => [piste('micro'), piste('autre')] },
      { close: async () => void (ferme += 1) },
      [noeud('source'), null, noeud('processeur'), noeud('gain')]
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(arretees).toEqual(['micro', 'autre']);
    expect(detaches).toEqual(['source', 'processeur', 'gain']);
    expect(ferme).toBe(1);
    expect(session.type).toBe('playback');
  });

  it('un contexte déjà fermé ou une piste déjà arrêtée ne cassent rien', () => {
    const casse = () => {
      throw new Error('déjà');
    };
    expect(() =>
      fermer({ getTracks: () => [{ stop: casse } as unknown as MediaStreamTrack] }, { close: () => Promise.reject(new Error('fermé')) }, [
        { disconnect: casse } as unknown as AudioNode
      ])
    ).not.toThrow();
  });
});

