import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ETIQUETTES,
  FICHIER_ANECDOTES,
  FICHIER_FAMILLE_DEMO,
  anecdoteDuJour,
  compose,
  fiche,
  jourDepuisEpoque,
  loadAnecdotes,
  loadFamille,
  type Anecdote,
  type Anecdotes,
  type Famille,
  type Fiche
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

const famille = JSON.parse(
  readFileSync(new URL('../../public/data/demo/familles/主.json', import.meta.url), 'utf8')
) as Famille;

/** Tout ce qui s'affiche d'une fiche, et doit donc venir de la source citée. */
function textes(f: Fiche): string[] {
  return [
    f.c,
    f.pinyin,
    f.fr,
    f.origine_fr,
    ...f.parts,
    ...f.mots.flatMap((m) => [m.hanzi, m.pinyin, m.fr]),
    ...(f.phrase ? [f.phrase.hanzi, f.phrase.pinyin, f.phrase.fr] : [])
  ].filter((t) => t !== '');
}

describe('la famille de démonstration', () => {
  it('est versionnée et cite sa source', () => {
    expect(famille.version).not.toBe('');
    expect(famille.source).toBe('maquettes/zilin-maquette.html');
  });

  it('a la brique pour racine, et un composé', () => {
    expect(famille.racine.c).toBe('主');
    expect(famille.fiches.map((f) => f.c)).toEqual(['主', '住']);
    expect(fiche(famille, '主')?.c).toBe('主');
    expect(compose(famille)?.c).toBe('住');
    expect(fiche(famille, '人')).toBeNull();
  });

  it('ne contient aucun texte écrit hors de sa source', () => {
    for (const f of famille.fiches) for (const t of textes(f)) expect(maquette).toContain(t);
    expect(maquette).toContain(famille.racine.fr);
    expect(maquette).toContain(famille.racine.pinyin);
  });

  it('étiquette chaque fiche, attesté ou mnémotechnique', () => {
    for (const f of famille.fiches) {
      expect(Object.keys(ETIQUETTES)).toContain(f.etiquette);
      expect(ETIQUETTES[f.etiquette]).not.toBe('');
    }
    expect(Object.keys(ETIQUETTES)).toContain(famille.racine.etiquette);
  });

  it("désigne l'élément ajouté dans la décomposition, et lui seul", () => {
    for (const f of famille.fiches) {
      expect(f.nouveau.length).toBeGreaterThan(0);
      expect(f.nouveau.length).toBeLessThan(f.parts.length);
      for (const i of f.nouveau) expect(f.parts[i]).toBeDefined();
    }
    /* 住 = 亻 + 主 : le cinabre va sur 主, l'élément ajouté, et sur lui seul. */
    const c = compose(famille);
    expect(c?.parts).toEqual(['亻', '主']);
    expect(c?.nouveau.map((i) => c.parts[i])).toEqual(['主']);
  });

  it('ne duplique pas les traits : ils viennent de strokes-demo.json', () => {
    for (const f of famille.fiches) {
      expect(f.traits).toEqual([]);
      expect(f.medianes).toEqual([]);
    }
  });

  it('porte deux mots et une phrase sur le composé', () => {
    const c = compose(famille);
    expect(c?.mots).toHaveLength(2);
    expect(c?.phrase?.hanzi).not.toBe('');
  });
});

describe('le chargeur de famille', () => {
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux2: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, famille);
    };
    const lu = await loadFamille(FICHIER_FAMILLE_DEMO, faux2);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER_FAMILLE_DEMO}`]);
    expect(lu.racine.c).toBe(famille.racine.c);
    expect(lu.fiches).toHaveLength(famille.fiches.length);
    expect(lu.version).toBe(famille.version);
  });

  it('refuse un fichier absent', async () => {
    const faux2: typeof fetch = async () => reponse(false, null);
    await expect(loadFamille(FICHIER_FAMILLE_DEMO, faux2)).rejects.toThrow('introuvable');
  });

  it('refuse un fichier sans racine ni fiches', async () => {
    const faux2: typeof fetch = async () => reponse(true, { version: '1' });
    await expect(loadFamille(FICHIER_FAMILLE_DEMO, faux2)).rejects.toThrow('illisible');
  });
});
