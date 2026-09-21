import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ETIQUETTES,
  FICHIER_ANECDOTES,
  FICHIER_FAMILLE_DEMO,
  FICHIER_TEXTE_DEMO,
  FICHIER_VOISINS_DEMO,
  anecdoteDuJour,
  compose,
  fiche,
  glosable,
  glose,
  jourDepuisEpoque,
  lignesNues,
  loadAnecdotes,
  loadFamille,
  loadTexte,
  loadVoisins,
  type Anecdote,
  type Anecdotes,
  type Famille,
  type Fiche,
  type Texte,
  type Voisins
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

/* ---------- le texte de lecture ---------- */

const texte = JSON.parse(
  readFileSync(new URL('../../public/data/demo/textes/住.json', import.meta.url), 'utf8')
) as Texte;

const traits = JSON.parse(
  readFileSync(new URL('../../public/strokes-demo.json', import.meta.url), 'utf8')
) as Record<string, unknown>;

describe('le texte de trois lignes', () => {
  it('est versionné et cite sa source', () => {
    expect(texte.version).not.toBe('');
    expect(texte.source).toBe('maquettes/zilin-maquette.html');
  });

  it('fait trois lignes, autour du caractère du jour', () => {
    expect(texte.lignes).toHaveLength(3);
    expect(texte.c).toBe('住');
  });

  it('est recopié mot pour mot de sa source, traduction comprise', () => {
    expect(maquette).toContain(lignesNues(texte).join(''));
    for (const l of lignesNues(texte)) expect(maquette).toContain(l);
    expect(maquette).toContain(texte.traduction);
  });

  it("ne glose aucun caractère autrement que la source, et n'en invente aucune", () => {
    for (const s of texte.lignes.flat()) {
      if (!glosable(s)) continue;
      expect(maquette).toContain(`"${s.c}","${s.pinyin}","${s.fr}"`);
      expect(glose(s)).toBe(`${s.pinyin}, ${s.fr}`);
    }
  });

  it('laisse sans glose ce que la source ne glose pas : la ponctuation ne se touche pas', () => {
    const muets = texte.lignes.flat().filter((s) => !glosable(s));
    expect(muets.length).toBeGreaterThan(0);
    for (const s of muets) {
      expect(s.c).toBe('。');
      expect(glose(s)).toBeNull();
    }
  });

  it("marque le caractère du jour, et lui seul : c'est le seul cinabre du texte", () => {
    const marques = texte.lignes.flat().filter((s) => s.nouveau);
    expect(marques).toHaveLength(1);
    expect(marques[0].c).toBe(texte.c);
    expect(maquette).toContain(`["${marques[0].c}","${marques[0].pinyin}","${marques[0].fr}",1]`);
  });

  it("n'embarque aucun audio : il n'y en a pas encore", () => {
    expect(texte.audio).toBeNull();
  });
});

describe('le chargeur de texte', () => {
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, texte);
    };
    const lu = await loadTexte(FICHIER_TEXTE_DEMO, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER_TEXTE_DEMO}`]);
    expect(lignesNues(lu)).toEqual(lignesNues(texte));
    expect(lu.traduction).toBe(texte.traduction);
  });

  it('refuse un fichier absent', async () => {
    const faux: typeof fetch = async () => reponse(false, null);
    await expect(loadTexte(FICHIER_TEXTE_DEMO, faux)).rejects.toThrow('introuvable');
  });

  it('refuse un fichier sans lignes', async () => {
    const faux: typeof fetch = async () => reponse(true, { version: '1', lignes: [] });
    await expect(loadTexte(FICHIER_TEXTE_DEMO, faux)).rejects.toThrow('illisible');
  });
});

/* ---------- les voisins de forme ---------- */

const voisins = JSON.parse(
  readFileSync(new URL('../../public/data/demo/voisins.json', import.meta.url), 'utf8')
) as Voisins;

/** Les 514 composants de la norme, lus dans la table versionnée du pipeline. */
const lignesNorme = readFileSync(
  new URL('../../../data/sources/gf0014-2009/composants.tsv', import.meta.url),
  'utf8'
)
  .split('\n')
  .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('sequence'));
/* Quelques points de code portent deux composants de la norme : les formes sont moins nombreuses. */
const composants = new Set(lignesNorme.map((l) => l.split('\t')[2]));

describe('les voisins de forme', () => {
  it('sont versionnés, citent leur source et la norme de décomposition', () => {
    expect(voisins.version).not.toBe('');
    expect(voisins.source).toBe('maquettes/zilin-maquette.html');
    expect(voisins.norme).toBe('GF 0014-2009');
  });

  it('ne se décomposent que sur des composants de la norme', () => {
    expect(lignesNorme).toHaveLength(514);
    for (const v of voisins.voisins) {
      expect(v.parts.length).toBeGreaterThan(0);
      for (const part of v.parts) expect(composants).toContain(part);
    }
  });

  it('se dessinent tous depuis les données de traits, jamais depuis une police', () => {
    for (const v of voisins.voisins) {
      expect(Object.keys(traits)).toContain(v.c);
      for (const part of v.parts) expect(Object.keys(traits)).toContain(part);
    }
  });

  it('ne portent aucun sens ni pinyin écrit hors de leur source', () => {
    for (const v of voisins.voisins) {
      expect(maquette).toContain(v.fr);
      expect(maquette).toContain(v.pinyin);
    }
  });

  it('portent la brique et le composé de la famille du jour', () => {
    expect(voisins.voisins.map((v) => v.c)).toEqual(expect.arrayContaining(['主', '住']));
  });
});

describe('le chargeur de voisins', () => {
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, voisins);
    };
    const lu = await loadVoisins(FICHIER_VOISINS_DEMO, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER_VOISINS_DEMO}`]);
    expect(lu.voisins).toHaveLength(voisins.voisins.length);
  });

  it('refuse un fichier absent', async () => {
    const faux: typeof fetch = async () => reponse(false, null);
    await expect(loadVoisins(FICHIER_VOISINS_DEMO, faux)).rejects.toThrow('introuvables');
  });

  it('refuse un fichier sans liste', async () => {
    const faux: typeof fetch = async () => reponse(true, { version: '1' });
    await expect(loadVoisins(FICHIER_VOISINS_DEMO, faux)).rejects.toThrow('illisibles');
  });
});
