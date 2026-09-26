import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadIndex, type Index } from './content';
import {
  CLES_TAO_JOUER,
  SANS_JOUER,
  fichierJouer,
  jouerOnce,
  lireJouerDonnees,
  loadJouer
} from './jouer';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Un `fetch` de test : sert les fichiers donnés, 404 pour le reste. Rien ne sort de l'origine. */
function servir(fichiers: Record<string, unknown>): typeof fetch {
  return (async (u: RequestInfo | URL) => {
    const chemin = String(u).slice(import.meta.env.BASE_URL.length);
    return chemin in fichiers
      ? ({ ok: true, status: 200, json: async () => fichiers[chemin] } as Response)
      : ({ ok: false, status: 404, json: async () => null } as Response);
  }) as typeof fetch;
}

const INDEX = { version: 'test-jouer', familles: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('les phrases de Tao à Jouer (`jouer.json`)', () => {
  it('l’export versionné porte les quatre phrases, sans jeton ni emoji', () => {
    const d = lireJouerDonnees(JSON.parse(source('../../public/data/0.1.0/jouer.json')) as unknown);
    expect(d.version).toBe('0.1.0');
    expect(d.source).toMatch(/data\/sources\/jouer\/tao\.tsv/);
    for (const cle of CLES_TAO_JOUER) {
      expect(d.tao[cle], cle).not.toBe('');
      expect(d.tao[cle], cle).not.toMatch(/[{}]|\p{Extended_Pictographic}/u);
    }
  });

  it('une phrase absente ou mal formée reste vide, une clé inconnue ne passe pas', () => {
    const d = lireJouerDonnees({ tao: { invite: 'A', changer: 3, bouder: 'B' } });
    expect(d.tao).toEqual({ invite: 'A', changer: '', devinette: '', attendre: '' });
    expect(lireJouerDonnees(null)).toEqual(SANS_JOUER);
    expect(lireJouerDonnees({ tao: 'rien' })).toEqual(SANS_JOUER);
  });

  it('l’index nomme le fichier ; un export plus ancien ne le nomme pas', async () => {
    const avec = await loadIndex('test-jouer', servir({ 'data/test-jouer/index.json': { ...INDEX, jouer: 'jouer.json' } }));
    expect(fichierJouer(avec)).toBe('data/test-jouer/jouer.json');
    const sans = await loadIndex('test-jouer', servir({ 'data/test-jouer/index.json': INDEX }));
    expect(sans.jouer).toBe('');
    expect(fichierJouer(sans as Index)).toBe('');
  });

  it('un fichier nommé mais introuvable est une erreur, pas un repli', async () => {
    await expect(loadJouer('data/x/jouer.json', servir({}))).rejects.toThrow(/introuvables/);
    const d = await loadJouer('data/x/jouer.json', servir({ 'data/x/jouer.json': { tao: { invite: 'A' } } }));
    expect(d.tao.invite).toBe('A');
  });

  it('sans `jouer.json` dans l’export, Tao se tait ; avec, elle dit les phrases du fichier', async () => {
    vi.stubGlobal('fetch', servir({ 'data/sans-jouer/index.json': { ...INDEX, version: 'sans-jouer' } }));
    expect(await jouerOnce('sans-jouer')).toEqual(SANS_JOUER);
    vi.stubGlobal(
      'fetch',
      servir({
        'data/avec-jouer/index.json': { ...INDEX, version: 'avec-jouer', jouer: 'jouer.json' },
        'data/avec-jouer/jouer.json': { version: 'avec-jouer', source: 's', tao: { invite: 'On joue ?' } }
      })
    );
    const d = await jouerOnce('avec-jouer');
    expect(d.tao.invite).toBe('On joue ?');
    expect(d.tao.attendre).toBe('');
  });
});
