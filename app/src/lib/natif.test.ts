import { describe, it, expect, beforeEach, vi } from 'vitest';

/* Capacitor et le greffon simulés : l'app native ou le web, au choix de chaque test. */
const natif = vi.hoisted(() => ({ plateforme: false, greffon: true }));
const appels = vi.hoisted(() => ({ schedule: 0, cancel: 0, permissions: 0 }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => natif.plateforme,
    isPluginAvailable: (nom: string) => nom === 'LocalNotifications' && natif.greffon
  }
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => {
      appels.permissions += 1;
      return { display: 'prompt' };
    },
    requestPermissions: async () => {
      appels.permissions += 1;
      return { display: 'granted' };
    },
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {
      appels.cancel += 1;
    },
    schedule: async () => {
      appels.schedule += 1;
      return { notifications: [] };
    }
  }
}));

import { dateDe, demanderAutorisation, notificationsDisponibles, remplacer, reprogrammerRappels, type Programmeur } from './natif';
import type { Notification } from './rappels';
import { emptyProgress } from './session';

beforeEach(() => {
  natif.plateforme = true;
  natif.greffon = true;
  appels.schedule = 0;
  appels.cancel = 0;
  appels.permissions = 0;
});

const n = (jour: string): Notification => ({ id: Number(jour.replace(/-/g, '')), jour, heure: '19:00', titre: 't', corps: 'c' });

describe('natif : les notifications', () => {
  it('reprogrammer remplace tout ce qui attendait : rien ne s’accumule', async () => {
    let attente = [20261001, 20261002, 20261003];
    const g: Programmeur = {
      enAttente: async () => attente,
      annuler: async (ids) => {
        attente = attente.filter((id) => !ids.includes(id));
      },
      programmer: async (plan) => {
        attente = [...attente, ...plan.map((x) => x.id)];
      }
    };
    await remplacer([n('2026-10-02'), n('2026-10-03')], g);
    expect(attente).toEqual([20261002, 20261003]);
    await remplacer([], g);
    expect(attente).toEqual([]);
  });

  it('chaque notification part à son heure, à l’heure locale', () => {
    const d = dateDe({ ...n('2026-10-02'), heure: '08:30' });
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 2, 8, 30]);
  });

  it('sur le web, rien : ni greffon, ni demande, ni programme', async () => {
    natif.plateforme = false;
    expect(notificationsDisponibles()).toBe(false);
    expect(await demanderAutorisation()).toBe(false);
    vi.useFakeTimers();
    reprogrammerRappels(emptyProgress('2026-10-01'));
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(appels).toEqual({ schedule: 0, cancel: 0, permissions: 0 });
  });

  it('dans l’app, l’accord se demande quand on le veut, et seulement alors', async () => {
    expect(notificationsDisponibles()).toBe(true);
    expect(await demanderAutorisation()).toBe(true);
    expect(appels.permissions).toBe(2);
  });
});
