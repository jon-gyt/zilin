import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Capacitor et le greffon simulés : l'app iOS ou le web, au choix de chaque test. */
const natif = vi.hoisted(() => ({ plateforme: 'web', greffon: true }));
const appels = vi.hoisted(() => ({ note: 0 }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => natif.plateforme !== 'web',
    getPlatform: () => natif.plateforme,
    isPluginAvailable: (nom: string) => natif.greffon && (nom === 'AppReview' || nom === 'LocalNotifications')
  }
}));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));

vi.mock('@capawesome/capacitor-app-review', () => ({
  AppReview: {
    requestReview: async () => {
      appels.note += 1;
    }
  }
}));

import {
  JOURS_AVANT_AVIS,
  JOURS_ENTRE_AVIS,
  lireAvisDemande,
  momentDeClore,
  momentDeConte,
  noterAvisDemande,
  peutDemanderAvis
} from './avis';
import { avisDisponible, demanderAvisNatif } from './natif';
import { jourPlus } from './rappels';
import { cloreSession, emptyProgress, fromJSON, noterConteLu, toJSON, type Progress } from './session';

const PREMIER = '2026-09-01';

/** Une progression dont la première graine est le 1er septembre, sans demande encore. */
function progression(x: Partial<Progress> = {}): Progress {
  return { ...emptyProgress(PREMIER), premiere: false, joursTravailles: [PREMIER], ...x };
}

beforeEach(() => {
  natif.plateforme = 'ios';
  natif.greffon = true;
  appels.note = 0;
});

describe('avis : les règles', () => {
  it('au retour au menu, après un 放榜, un premier conte lu ou un palier', () => {
    const jour = jourPlus(PREMIER, 10);
    expect(peutDemanderAvis(progression(), jour, 'menu', 'fangbang')).toBe(true);
    expect(peutDemanderAvis(progression(), jour, 'menu', 'conte')).toBe(true);
    expect(peutDemanderAvis(progression(), jour, 'menu', 'palier')).toBe(true);
    /* Sans moment de fierté, rien. */
    expect(peutDemanderAvis(progression(), jour, 'menu', null)).toBe(false);
  });

  it('jamais en session', () => {
    expect(peutDemanderAvis(progression(), jourPlus(PREMIER, 10), 'session', 'fangbang')).toBe(false);
  });

  it('jamais dans les sept premiers jours', () => {
    expect(JOURS_AVANT_AVIS).toBe(7);
    expect(peutDemanderAvis(progression(), jourPlus(PREMIER, 6), 'menu', 'palier')).toBe(false);
    expect(peutDemanderAvis(progression(), jourPlus(PREMIER, 7), 'menu', 'palier')).toBe(true);
    /* Avant la première graine, rien à compter : rien. */
    expect(peutDemanderAvis(progression({ joursTravailles: [] }), PREMIER, 'menu', 'conte')).toBe(false);
  });

  it('au plus une fois tous les cent vingt jours', () => {
    expect(JOURS_ENTRE_AVIS).toBe(120);
    const demande = noterAvisDemande(progression(), '2026-09-20');
    expect(peutDemanderAvis(demande, jourPlus('2026-09-20', 119), 'menu', 'fangbang')).toBe(false);
    expect(peutDemanderAvis(demande, jourPlus('2026-09-20', 120), 'menu', 'fangbang')).toBe(true);
  });
});

describe('avis : les moments', () => {
  it('le palier : la graine du jour plantée à 7, 30, 100 ou 365 jours d’affilée', () => {
    const jours = Array.from({ length: 6 }, (_, k) => jourPlus(PREMIER, k));
    const jour = jourPlus(PREMIER, 6);
    const avant = progression({ joursTravailles: jours, day: jour });
    expect(momentDeClore(avant, cloreSession(avant, jour), jour)).toBe('palier');
    /* Le sixième jour n'est pas un palier ; une session de plus ne replante rien. */
    const sixieme = progression({ joursTravailles: jours.slice(0, 5), day: jours[5] });
    expect(momentDeClore(sixieme, cloreSession(sixieme, jours[5]), jours[5])).toBeNull();
    const deja = cloreSession(avant, jour);
    expect(momentDeClore(deja, cloreSession(deja, jour), jour)).toBeNull();
  });

  it('le premier conte lu, pas le suivant', () => {
    const p = progression();
    const un = noterConteLu(p, 'shouzhu', '255');
    expect(momentDeConte(p, un)).toBe('conte');
    expect(momentDeConte(un, noterConteLu(un, 'huashe', '255'))).toBeNull();
  });
});

describe('avis : la progression et le système', () => {
  it('la dernière demande survit à l’export et à l’import ; aucune pour une progression plus ancienne', () => {
    const p = noterAvisDemande(progression(), '2026-09-20');
    expect(fromJSON(toJSON(p), '2026-09-28').avisDemande).toBe('2026-09-20');
    const ancienne = JSON.parse(toJSON(emptyProgress('2026-09-28'))) as Record<string, unknown>;
    delete ancienne.avisDemande;
    expect(fromJSON(JSON.stringify(ancienne), '2026-09-28').avisDemande).toBeNull();
    expect(lireAvisDemande(12)).toBeNull();
  });

  it('dans l’app iOS, la fenêtre du système ; sur le web, rien', () => {
    expect(avisDisponible()).toBe(true);
    demanderAvisNatif();
    expect(appels.note).toBe(1);
    natif.plateforme = 'web';
    expect(avisDisponible()).toBe(false);
    demanderAvisNatif();
    natif.plateforme = 'android';
    expect(avisDisponible()).toBe(false);
    expect(appels.note).toBe(1);
  });
});
