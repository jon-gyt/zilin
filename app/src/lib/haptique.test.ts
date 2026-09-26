import { describe, it, expect, beforeEach, vi } from 'vitest';

/* Capacitor et le greffon simulés : l'app native ou le web, au choix de chaque test. */
const natif = vi.hoisted(() => ({ plateforme: false, greffon: true }));
const appels = vi.hoisted(() => ({ impact: [] as unknown[], notification: [] as unknown[], vibrate: 0 }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => natif.plateforme,
    isPluginAvailable: (nom: string) => nom === 'Haptics' && natif.greffon
  }
}));

vi.mock('@capacitor/haptics', () => ({
  ImpactStyle: { Heavy: 'HEAVY', Medium: 'MEDIUM', Light: 'LIGHT' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
  Haptics: {
    impact: async (o: unknown) => {
      appels.impact.push(o);
    },
    notification: async (o: unknown) => {
      appels.notification.push(o);
    },
    vibrate: async () => {
      appels.vibrate += 1;
    }
  }
}));

import { bonneReponse, haptiqueDisponible, reglerHaptique, sessionClose } from './haptique';
import { emptyProgress, fromJSON, setHaptique, toJSON } from './session';

beforeEach(() => {
  natif.plateforme = true;
  natif.greffon = true;
  appels.impact = [];
  appels.notification = [];
  appels.vibrate = 0;
  reglerHaptique(true);
});

describe('haptique', () => {
  it('une bonne réponse : un tap léger, rien de plus', () => {
    bonneReponse();
    expect(appels.impact).toEqual([{ style: 'LIGHT' }]);
    expect(appels.notification).toEqual([]);
    expect(appels.vibrate).toBe(0);
  });

  it('la session close : le signal doux de réussite', () => {
    sessionClose();
    expect(appels.notification).toEqual([{ type: 'SUCCESS' }]);
    expect(appels.impact).toEqual([]);
  });

  it("une erreur ne coûte rien : le module n'a aucun geste d'erreur", async () => {
    const m = await import('./haptique');
    expect(Object.keys(m).sort()).toEqual(['bonneReponse', 'haptiqueDisponible', 'reglerHaptique', 'sessionClose']);
  });

  it('sur le web, rien : ni greffon, ni vibration du navigateur', () => {
    natif.plateforme = false;
    expect(haptiqueDisponible()).toBe(false);
    bonneReponse();
    sessionClose();
    expect(appels.impact).toEqual([]);
    expect(appels.notification).toEqual([]);
    expect(appels.vibrate).toBe(0);
  });

  it("dans l'app sans le greffon, rien", () => {
    natif.greffon = false;
    expect(haptiqueDisponible()).toBe(false);
    bonneReponse();
    expect(appels.impact).toEqual([]);
  });

  it('le réglage éteint coupe les deux gestes', () => {
    reglerHaptique(false);
    bonneReponse();
    sessionClose();
    expect(appels.impact).toEqual([]);
    expect(appels.notification).toEqual([]);
    reglerHaptique(true);
    bonneReponse();
    expect(appels.impact).toHaveLength(1);
  });
});

describe('réglage « Retour haptique »', () => {
  it('allumé par défaut, et pour une progression plus ancienne', () => {
    expect(emptyProgress('2026-09-26').haptique).toBe(true);
    const ancienne = JSON.parse(toJSON(emptyProgress('2026-09-26'))) as Record<string, unknown>;
    delete ancienne.haptique;
    expect(fromJSON(JSON.stringify(ancienne), '2026-09-26').haptique).toBe(true);
  });

  it("éteint, il survit à l'export et à l'import", () => {
    const p = setHaptique(emptyProgress('2026-09-26'), false);
    expect(fromJSON(toJSON(p), '2026-09-26').haptique).toBe(false);
  });
});
