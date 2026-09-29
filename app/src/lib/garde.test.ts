import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  dateCourte,
  demanderPersistance,
  estIos,
  inviterEcranAccueil,
  ligneDernierExport,
  lireDernierExport,
  noterExport,
  type Stockage
} from './garde';
import { SANS_TEXTES, lireTextesRappels } from './rappels';
import { emptyProgress, fromJSON, toJSON } from './session';

const textes = lireTextesRappels(
  JSON.parse(readFileSync(new URL('../../public/data/0.1.0/rappels.json', import.meta.url), 'utf8'))
);

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const BUREAU = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

/** Un `navigator.storage` factice, qui compte ce qu'on lui demande. */
function stockage(persistant: boolean, accorde = true): Stockage & { demandes: number } {
  const s = {
    demandes: 0,
    persisted: async () => persistant,
    persist: async () => {
      s.demandes += 1;
      return accorde;
    }
  };
  return s;
}

describe('garde : le stockage persistant', () => {
  it('sur le web, il est demandé au navigateur', async () => {
    const s = stockage(false);
    expect(await demanderPersistance(s, false)).toBe(true);
    expect(s.demandes).toBe(1);
  });

  it('déjà persistant, rien n’est redemandé', async () => {
    const s = stockage(true);
    expect(await demanderPersistance(s, false)).toBe(true);
    expect(s.demandes).toBe(0);
  });

  it('dans l’app iOS, rien : le stockage est celui de l’app', async () => {
    const s = stockage(false);
    expect(await demanderPersistance(s, true)).toBe(false);
    expect(s.demandes).toBe(0);
  });

  it('sans l’API, sur refus ou sur erreur, rien ne casse', async () => {
    expect(await demanderPersistance(undefined, false)).toBe(false);
    expect(await demanderPersistance({}, false)).toBe(false);
    expect(await demanderPersistance(stockage(false, false), false)).toBe(false);
    const panne: Stockage = { persist: () => Promise.reject(new Error('non')) };
    expect(await demanderPersistance(panne, false)).toBe(false);
  });
});

describe('garde : l’écran d’accueil, sur le web iOS', () => {
  it('la ligne sur le web iOS, hors écran d’accueil seulement', () => {
    expect(inviterEcranAccueil({ userAgent: IPHONE }, false, false)).toBe(true);
    expect(inviterEcranAccueil({ userAgent: IPAD, maxTouchPoints: 5 }, false, false)).toBe(true);
    /* Ouverte depuis l'écran d'accueil : elle y est déjà. */
    expect(inviterEcranAccueil({ userAgent: IPHONE, standalone: true }, false, false)).toBe(false);
    expect(inviterEcranAccueil({ userAgent: IPHONE }, true, false)).toBe(false);
    /* Ni dans l'app, ni ailleurs qu'iOS. */
    expect(inviterEcranAccueil({ userAgent: IPHONE }, false, true)).toBe(false);
    expect(inviterEcranAccueil({ userAgent: BUREAU }, false, false)).toBe(false);
    expect(estIos({ userAgent: IPAD, maxTouchPoints: 0 })).toBe(false);
  });

  it('le texte vient du pipeline, sans fenêtre ni reproche', () => {
    expect(textes.accueil).toBe("Ajoute Wenlu à l'écran d'accueil pour garder ta progression.");
    expect(textes.accueil_comment).toMatch(/Partager/);
  });
});

describe('garde : le dernier export', () => {
  it('« Dernier export : 12 septembre », ou « jamais »', () => {
    expect(ligneDernierExport('2026-09-12', '2026-09-28', textes)).toBe('Dernier export : 12 septembre');
    expect(ligneDernierExport('2025-12-01', '2026-09-28', textes)).toBe('Dernier export : 1er décembre 2025');
    expect(ligneDernierExport(null, '2026-09-28', textes)).toBe('Dernier export : jamais');
    expect(ligneDernierExport(null, '2026-09-28', SANS_TEXTES)).toBe('');
    expect(dateCourte('2026-03-01', '2026-09-28')).toBe('1er mars');
  });

  it('noté à l’export, il survit à l’import ; jamais pour une progression plus ancienne', () => {
    const p = noterExport(emptyProgress('2026-09-12'), '2026-09-12');
    expect(fromJSON(toJSON(p), '2026-09-28').dernierExport).toBe('2026-09-12');
    expect(emptyProgress('2026-09-28').dernierExport).toBeNull();
    const ancienne = JSON.parse(toJSON(emptyProgress('2026-09-28'))) as Record<string, unknown>;
    delete ancienne.dernierExport;
    expect(fromJSON(JSON.stringify(ancienne), '2026-09-28').dernierExport).toBeNull();
    expect(lireDernierExport('hier')).toBeNull();
  });
});
