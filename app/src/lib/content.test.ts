import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FICHIER_ANECDOTES,
  anecdoteDuJour,
  jourDepuisEpoque,
  loadAnecdotes,
  type Anecdote,
  type Anecdotes
} from './content';

const fichier = JSON.parse(
  readFileSync(new URL('../../public/data/demo/anecdotes.json', import.meta.url), 'utf8')
) as Anecdotes;
const maquette = readFileSync(
  new URL('../../../maquettes/zilin-maquette.html', import.meta.url),
  'utf8'
);

const faux = (liste: Anecdote[]): Anecdote[] => liste;
const troisJours = ['2026-03-01', '2026-03-02', '2026-03-03'];

describe("le fichier d'anecdotes", () => {
  it('est versionné et cite sa source', () => {
    expect(fichier.version).not.toBe('');
    expect(fichier.source).toBe('maquettes/zilin-maquette.html');
  });
  it('porte un caractère, un titre et un texte par anecdote', () => {
    expect(fichier.anecdotes.length).toBeGreaterThan(0);
    for (const a of fichier.anecdotes) {
      expect([...a.c]).toHaveLength(1);
      expect(a.titre.length).toBeGreaterThan(0);
      expect(a.texte.length).toBeGreaterThan(0);
    }
  });
  it('ne contient aucun texte écrit hors de sa source', () => {
    for (const a of fichier.anecdotes) {
      expect(maquette).toContain(a.titre);
      expect(maquette).toContain(a.texte);
    }
  });
});

describe("l'anecdote du jour", () => {
  const liste = faux(fichier.anecdotes);

  it('est la même toute la journée', () => {
    for (const j of troisJours) expect(anecdoteDuJour(liste, j)).toBe(anecdoteDuJour(liste, j));
  });

  it('change chaque jour et parcourt toute la liste avant de se répéter', () => {
    const depart = jourDepuisEpoque('2026-03-01');
    const vus = liste.map((_, i) =>
      anecdoteDuJour(liste, new Date((depart + i) * 86400000).toISOString().slice(0, 10))
    );
    expect(new Set(vus).size).toBe(liste.length);
    expect(vus).toEqual(expect.arrayContaining(liste));
  });

  it('reprend la liste dans le même ordre au tour suivant', () => {
    const depart = jourDepuisEpoque('2026-03-01');
    const jour = (i: number) => new Date((depart + i) * 86400000).toISOString().slice(0, 10);
    for (let i = 0; i < liste.length; i++) {
      expect(anecdoteDuJour(liste, jour(i + liste.length))).toBe(anecdoteDuJour(liste, jour(i)));
    }
  });

  it('suit le rang de la journée civile, comme la maquette', () => {
    const j = '2026-03-02';
    const rang = Math.floor(Date.parse(`${j}T00:00:00Z`) / 86400000) % liste.length;
    expect(anecdoteDuJour(liste, j)).toBe(liste[rang]);
  });

  it('tient avant 1970 et sur une liste vide ou une date illisible', () => {
    expect(anecdoteDuJour(liste, '1969-12-30')).toBe(liste[((-2 % liste.length) + liste.length) % liste.length]);
    expect(anecdoteDuJour([], '2026-03-02')).toBeNull();
    expect(anecdoteDuJour(liste, 'pas une date')).toBeNull();
  });
});

describe('le chargeur', () => {
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux2: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, fichier);
    };
    const lu = await loadAnecdotes(FICHIER_ANECDOTES, faux2);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER_ANECDOTES}`]);
    expect(lu.anecdotes).toHaveLength(fichier.anecdotes.length);
    expect(lu.version).toBe(fichier.version);
  });

  it('refuse un fichier absent', async () => {
    const faux2: typeof fetch = async () => reponse(false, null);
    await expect(loadAnecdotes(FICHIER_ANECDOTES, faux2)).rejects.toThrow('introuvables');
  });

  it('refuse un fichier sans liste', async () => {
    const faux2: typeof fetch = async () => reponse(true, { version: '1' });
    await expect(loadAnecdotes(FICHIER_ANECDOTES, faux2)).rejects.toThrow('illisibles');
  });
});
