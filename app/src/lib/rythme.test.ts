import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CLES_RYTHME,
  SANS_RYTHME,
  fichierRythme,
  ligne,
  lireRythme,
  loadRythme,
  quandCarte,
  quandMenu,
  quandPierre,
  suiteDuChemin
} from './rythme';
import type { Index } from './content';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const EXPORT = lireRythme(JSON.parse(source('../../public/data/0.1.0/rythme.json')) as unknown);

describe('les lignes du rythme gratuit (`rythme.json`)', () => {
  it('l’export versionné porte chaque ligne, sans emoji', () => {
    for (const cle of CLES_RYTHME) {
      expect(EXPORT[cle], cle).not.toBe('');
      expect(EXPORT[cle], cle).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('aucune ligne ne parle d’achat, ni ne presse', () => {
    for (const cle of CLES_RYTHME) {
      expect(EXPORT[cle], cle).not.toMatch(/achat|achet|payant|prix|€|abonnement|Wenlu complet|plus que|!/i);
    }
  });

  it('au menu, « Demain », puis « Dans 3 j », en jours du calendrier', () => {
    expect(quandMenu(EXPORT, 1)).toBe('Demain');
    expect(quandMenu(EXPORT, 3)).toBe('Dans 3 j');
  });

  it('sur la route, la pierre suivante et la carte de l’étape', () => {
    expect(quandPierre(EXPORT, 3)).toBe('prochaine brique dans 3 j');
    expect(quandPierre(EXPORT, 1)).toBe('prochaine brique demain');
    expect(quandCarte(EXPORT, 4)).toBe('Prochaine brique dans 4 jours');
    expect(quandCarte(EXPORT, 1)).toBe('Prochaine brique demain');
  });

  it('les jetons se remplissent', () => {
    expect(ligne(EXPORT, 'tao_revoir', { c: '口' })).toBe('口, on le revoit ?');
    expect(ligne(EXPORT, 'clore_revue', { c: '口' })).toBe("口, revu aujourd'hui.");
  });

  it('la suite du chemin selon le parcours', () => {
    expect(suiteDuChemin(EXPORT, 'hsk')).toMatch(/HSK 2/);
    /* Décision du propriétaire du 30 septembre 2026 : après le seuil 255, le HSK 3.0. */
    expect(suiteDuChemin(EXPORT, 'lire')).toMatch(/HSK 1, puis le HSK 2/);
    expect(suiteDuChemin(EXPORT, null)).toMatch(/HSK 1, puis le HSK 2/);
  });

  it('un export sans `rythme.json` se tait : rien n’est écrit dans le code', () => {
    expect(lireRythme(null)).toEqual(SANS_RYTHME);
    expect(lireRythme({ textes: { menu_dans: 3 } }).menu_dans).toBe('');
    expect(quandMenu(SANS_RYTHME, 3)).toBe('');
    expect(fichierRythme({ version: '0.1.0' } as Index)).toBe('');
    expect(fichierRythme({ version: '0.1.0', rythme: 'rythme.json' } as Index)).toBe('data/0.1.0/rythme.json');
  });

  it('se charge par le fetch injecté', async () => {
    const f = (async () => ({ ok: true, status: 200, json: async () => ({ textes: { menu_demain: 'Demain' } }) })) as unknown as typeof fetch;
    expect((await loadRythme('data/x/rythme.json', f)).menu_demain).toBe('Demain');
    const absent = (async () => ({ ok: false, status: 404, json: async () => null })) as unknown as typeof fetch;
    await expect(loadRythme('data/x/rythme.json', absent)).rejects.toThrow(/introuvables/);
  });
});
