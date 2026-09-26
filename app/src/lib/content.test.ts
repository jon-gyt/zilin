import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ETIQUETTES,
  FICHIER_ANECDOTES,
  FICHIER_FAMILLE_DEMO,
  FICHIER_TEXTE_DEMO,
  FICHIER_VOISINS_DEMO,
  LIGNE_SANS_FICHE,
  PARCOURS_DEFAUT,
  VERSION_DONNEES,
  aDesTextes,
  anecdoteDuJour,
  briquesPosees,
  caractereDuJour,
  contenu,
  famille as chargerFamille,
  fiche,
  fichierPaires,
  fichierDevinettes,
  loadDevinettes,
  type Devinettes,
  jourDuParcours,
  lecon,
  nomParcours,
  pairesExport,
  racineDe,
  surcoucher,
  traits as chargerTraits,
  traitsDe,
  compose,
  ficheDeFamille,
  fichierFamille,
  fichierTraits,
  glosable,
  glose,
  jourDepuisEpoque,
  lignesNues,
  loadAnecdotes,
  loadFamille,
  loadPaires,
  loadIndex,
  loadTexte,
  loadVoisins,
  contesExport,
  fichierConte,
  lireConte,
  lireContesIndex,
  loadConte,
  type Anecdote,
  type Anecdotes,
  type Etiquette,
  type Famille,
  type Fiche,
  type Index,
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
// L'export versionné du pipeline : ce que l'app servira, déjà dans le dépôt.
const index = JSON.parse(
  readFileSync(
    new URL(`../../public/data/${VERSION_DONNEES}/index.json`, import.meta.url),
    'utf8'
  )
) as Index;

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
    expect(ficheDeFamille(famille, '主')?.c).toBe('主');
    expect(compose(famille)?.c).toBe('住');
    expect(ficheDeFamille(famille, '人')).toBeNull();
  });

  it('ne contient aucun texte écrit hors de sa source', () => {
    for (const f of famille.fiches) for (const t of textes(f)) expect(maquette).toContain(t);
    expect(maquette).toContain(famille.racine.fr);
    expect(maquette).toContain(famille.racine.pinyin);
  });

  it('étiquette chaque fiche, attesté ou mnémotechnique', () => {
    for (const f of famille.fiches) {
      expect(f.etiquette).not.toBeNull();
      expect(Object.keys(ETIQUETTES)).toContain(f.etiquette);
      expect(ETIQUETTES[f.etiquette as Etiquette]).not.toBe('');
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

describe('le chargeur de paires à ne pas confondre', () => {
  const FICHIER = 'data/demo/paires.json';
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, { paires: [['天', '夫']] });
    };
    const lu = await loadPaires(FICHIER, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER}`]);
    expect(lu).toEqual({ paires: [['天', '夫']] });
  });

  it('refuse un fichier absent', async () => {
    const faux: typeof fetch = async () => reponse(false, null);
    await expect(loadPaires(FICHIER, faux)).rejects.toThrow('introuvables');
  });
});

describe("l'index de l'export versionné", () => {
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it('lit le fichier de la version demandée, et lui seul', async () => {
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, index);
    };
    const lu = await loadIndex(VERSION_DONNEES, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}data/${VERSION_DONNEES}/index.json`]);
    expect(lu.version).toBe(index.version);
    expect(lu.familles).toHaveLength(index.familles.length);
  });

  it('refuse un index absent', async () => {
    const faux: typeof fetch = async () => reponse(false, null);
    await expect(loadIndex(VERSION_DONNEES, faux)).rejects.toThrow('introuvable');
  });

  it('refuse un index sans familles', async () => {
    const faux: typeof fetch = async () => reponse(true, { version: '0.1.0' });
    await expect(loadIndex(VERSION_DONNEES, faux)).rejects.toThrow('illisible');
  });

  it("donne le chemin des fiches et des tracés d'une famille", () => {
    const racine = index.familles[0].racine;
    expect(fichierFamille(index, racine)).toBe(`data/${index.version}/familles/${racine}.json`);
    expect(fichierTraits(index, racine)).toBe(`data/${index.version}/traits/${racine}.json`);
    expect(fichierFamille(index, '無')).toBeNull();
  });
});

describe("le fichier d'index écrit par le pipeline", () => {
  it('porte sa version, sa date et son empreinte de build', () => {
    expect(index.version).toBe(VERSION_DONNEES);
    expect(index.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(index.empreinte).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(index.norme).toBe('GF 0014-2009');
  });

  it('donne les deux parcours, jour par jour', () => {
    for (const nom of ['lire', 'hsk']) {
      const p = index.parcours[nom];
      expect(p.jours.length).toBeGreaterThan(0);
      expect(p.jours.map((j) => j.jour)).toEqual(p.jours.map((_, i) => i + 1));
      const briques = p.jours.filter((j) => j.brique !== null);
      expect(briques.length).toBe(new Set(briques.map((j) => j.brique)).size);
    }
  });

  it('couvre les caractères des deux listes', () => {
    const poses = new Set(
      Object.values(index.parcours).flatMap((p) =>
        p.jours.flatMap((j) => (j.brique ? [j.brique, ...j.composes] : j.composes))
      )
    );
    for (const liste of Object.values(index.listes)) {
      for (const c of liste) expect(poses.has(c)).toBe(true);
    }
  });

  it('nomme un fichier de fiches et un fichier de tracés par famille', () => {
    for (const f of index.familles) {
      expect(f.fichier.startsWith('familles/')).toBe(true);
      expect(f.traits.startsWith('traits/')).toBe(true);
      expect(f.n).toBeGreaterThan(0);
      expect(f.avancement_possible).toBeGreaterThanOrEqual(0);
      expect(f.avancement_possible).toBeLessThanOrEqual(1);
    }
    expect(index.familles).toHaveLength(new Set(index.familles.map((f) => f.racine)).size);
  });
});

/* ---------- la couche d'accès à l'export versionné ---------- */

/** La famille 亻 de l'export : c'est elle qui porte 住, le composé de la maquette. */
const familleExport = JSON.parse(
  readFileSync(
    new URL(`../../public/data/${VERSION_DONNEES}/familles/亻.json`, import.meta.url),
    'utf8'
  )
) as Famille;

const familleDemoPeuple = JSON.parse(
  readFileSync(new URL('../../public/data/demo/familles/人.json', import.meta.url), 'utf8')
) as Famille;

/**
 * Une fiche de l'export telle que le pipeline l'écrit sans fiche relue : même décomposition,
 * même pinyin, mêmes niveaux, aucun texte (`data/schema.md`). Fabriquée en mémoire, pour que
 * la règle se teste quel que soit l'état de relecture du dépôt.
 */
function sansTexte(f: Fiche): Fiche {
  return {
    ...f,
    fr: '',
    en: '',
    role: null,
    roles: {},
    origine_fr: '',
    origine_en: '',
    etiquette: null,
    memo_fr: null,
    memo_en: null,
    mots: [],
    phrase: null,
    statut: 'sans_fiche'
  };
}

describe('la surcouche de démonstration', () => {
  const servie = ficheDeFamille(familleExport, '住') as Fiche;
  const exportee = sansTexte(servie);
  const demo = ficheDeFamille(famille, '住') as Fiche;

  it("l'export ne donne des textes qu'à une fiche relue, jamais d'étiquette sans origine", () => {
    for (const f of familleExport.fiches) {
      expect(['relu', 'sans_fiche']).toContain(f.statut);
      expect(aDesTextes(f)).toBe(f.statut === 'relu');
      if (f.origine_fr === '') expect(f.etiquette).toBeNull();
    }
    expect(aDesTextes(exportee)).toBe(false);
  });

  it("sur l'export servi, la fiche relue passe devant la démonstration, l'autre non", () => {
    const lue = surcoucher(servie, demo);
    if (servie.statut === 'relu') {
      expect(lue.source).toBe('export');
      expect(lue.origine_fr).toBe(servie.origine_fr);
      expect(lue.origine_fr).not.toBe(demo.origine_fr);
      expect(lue.etiquette).toBe(servie.etiquette);
      expect(lue.mots).toEqual(servie.mots);
    } else {
      expect(lue.source).toBe('demonstration');
    }
  });

  it('prend les textes de la démonstration tant que la fiche exportée est vide', () => {
    const lue = surcoucher(exportee, demo);
    expect(lue.source).toBe('demonstration');
    expect(lue.fr).toBe(demo.fr);
    expect(lue.origine_fr).toBe(demo.origine_fr);
    expect(lue.etiquette).toBe(demo.etiquette);
    expect(lue.mots).toHaveLength(2);
  });

  it("garde de l'export ce qui ne se surcouche pas : décomposition, pinyin, niveaux", () => {
    const lue = surcoucher(exportee, demo);
    expect(lue.parts).toEqual(exportee.parts);
    expect(lue.nouveau).toEqual(exportee.nouveau);
    expect(lue.pinyin).toBe(exportee.pinyin);
    expect(lue.niveaux).toEqual(exportee.niveaux);
    expect(lue.statut).toBe('sans_fiche');
  });

  it("ne reprend pas le rôle quand la démonstration ne découpe pas comme la norme", () => {
    /* 主 est une brique de GF 0014-2009 : l'export ne la décompose pas, la maquette si. */
    const brique = sansTexte(
      ficheDeFamille(
        JSON.parse(
          readFileSync(
            new URL(`../../public/data/${VERSION_DONNEES}/familles/主.json`, import.meta.url),
            'utf8'
          )
        ) as Famille,
        '主'
      ) as Fiche
    );
    const demoBrique = ficheDeFamille(famille, '主') as Fiche;
    expect(demoBrique.parts).not.toEqual(brique.parts);
    const lue = surcoucher(brique, demoBrique);
    expect(lue.parts).toEqual([]);
    expect(lue.role).toBe(brique.role);
    expect(lue.origine_fr).toBe(demoBrique.origine_fr);
  });

  it('laisse passer la fiche relue devant la démonstration', () => {
    const relue: Fiche = {
      ...exportee,
      statut: 'relu',
      fr: 'demeurer',
      origine_fr: 'Trois phrases relues.',
      etiquette: 'atteste'
    };
    const lue = surcoucher(relue, demo);
    expect(lue.source).toBe('export');
    expect(lue.fr).toBe('demeurer');
    expect(lue.origine_fr).toBe('Trois phrases relues.');
  });

  it("ne montre ni texte ni étiquette quand personne n'en a", () => {
    const lue = surcoucher(exportee, null);
    expect(lue.source).toBe('aucune');
    expect(lue.origine_fr).toBe('');
    expect(lue.etiquette).toBeNull();
    expect(LIGNE_SANS_FICHE).not.toBe('');
    /* La ligne se lit par un débutant : aucun mot de l'atelier. */
    expect(LIGNE_SANS_FICHE).not.toMatch(/pipeline|export|donnée/i);
  });

  it("n'étiquette jamais un sens sans origine : les voisins de forme n'ont pas d'étiquette", () => {
    const voisin: Fiche = {
      ...exportee,
      fr: '',
      origine_fr: ''
    };
    const sansOrigine: Fiche = { ...demo, origine_fr: '', etiquette: 'atteste' };
    const lue = surcoucher(voisin, sansOrigine);
    expect(lue.fr).toBe(sansOrigine.fr);
    expect(lue.etiquette).toBeNull();
  });
});

describe('le parcours de l’index', () => {
  it('pose une brique et ses composés au jour demandé', () => {
    const j = jourDuParcours(index, 'lire', 1);
    expect(j).not.toBeNull();
    expect(j?.jour).toBe(1);
    expect(j?.brique).toBe(index.parcours.lire.jours[0].brique);
    expect(j?.composes).toEqual(index.parcours.lire.jours[0].composes);
    expect(j?.sautes).toEqual([]);
  });

  it('suit le parcours choisi, et rabat « voyager » sur « lire »', () => {
    expect(nomParcours(index, 'hsk')).toBe('hsk');
    expect(nomParcours(index, 'voyage')).toBe(PARCOURS_DEFAUT);
    expect(nomParcours(index, null)).toBe(PARCOURS_DEFAUT);
    const hsk = jourDuParcours(index, 'hsk', 2);
    expect(hsk?.brique).toBe(index.parcours.hsk.jours[1].brique);
  });

  it('ne montre que la brique les jours sans composé', () => {
    const jours = index.parcours.lire.jours;
    const seule = jours.find((j) => j.brique !== null && j.composes.length === 0);
    expect(seule).toBeDefined();
    const j = jourDuParcours(index, 'lire', seule?.jour ?? 0);
    expect(j?.brique).toBe(seule?.brique);
    expect(j?.composes).toEqual([]);
  });

  it('saute un jour non réconcilié et en garde la trace', () => {
    const jours = index.parcours.lire.jours;
    const premier = jours.find((j) => j.non_reconcilie);
    expect(premier).toBeDefined();
    const j = jourDuParcours(index, 'lire', premier?.jour ?? 0);
    /* Les jours non réconciliés ferment le parcours : il n'y a plus rien après. */
    expect(j).toBeNull();
    /* Un jour non réconcilié isolé est franchi, et son numéro reste dans la trace. */
    const bricole: Index = {
      ...index,
      parcours: {
        lire: {
          liste: 'seuil-255',
          regle: '',
          jours: [
            { jour: 1, brique: null, composes: ['吃'], non_reconcilie: true },
            { jour: 2, brique: '月', composes: ['朋'], non_reconcilie: false }
          ]
        }
      }
    };
    const saute = jourDuParcours(bricole, 'lire', 1);
    expect(saute?.jour).toBe(2);
    expect(saute?.brique).toBe('月');
    expect(saute?.sautes).toEqual([1]);
  });

  it('rend les briques déjà posées, la plus récente en tête', () => {
    const posees = briquesPosees(index, 'lire', 3);
    expect(posees).toEqual(
      index.parcours.lire.jours
        .slice(0, 3)
        .map((j) => j.brique)
        .reverse()
    );
  });

  it("nomme le fichier des paires de l'export", () => {
    expect(fichierPaires(index)).toBe(`data/${index.version}/paires.json`);
  });
});

describe("le chargement de l'export", () => {
  /** Un export simulé, servi par un `fetch` de test : rien ne sort de l'origine. */
  function servir(version: string, fichiers: Record<string, unknown>): string[] {
    const appels: string[] = [];
    vi.stubGlobal('fetch', (async (u: RequestInfo | URL) => {
      const url = String(u);
      appels.push(url);
      const chemin = url.slice(import.meta.env.BASE_URL.length);
      if (chemin in fichiers) {
        return { ok: true, status: 200, json: async () => fichiers[chemin] } as Response;
      }
      /* Les fichiers de démonstration sont servis depuis le dépôt, tels quels. */
      try {
        const brut = readFileSync(new URL(`../../public/${chemin}`, import.meta.url), 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(brut) as unknown } as Response;
      } catch {
        return { ok: false, status: 404, json: async () => null } as Response;
      }
    }) as typeof fetch);
    return appels;
  }

  const V = 'test-export';
  const indexSimule = {
    version: V,
    date: '2026-09-21T00:00:00Z',
    empreinte: 'sha256:0',
    norme: 'GF 0014-2009',
    perimetre: 'test',
    licences: 'LICENCES.md',
    listes: { 'seuil-255': ['月', '朋'] },
    parcours: {
      lire: {
        liste: 'seuil-255',
        regle: 'une seule brique nouvelle par session de 10 minutes',
        jours: [{ jour: 1, brique: '月', composes: ['朋'], non_reconcilie: false }]
      }
    },
    familles: [
      { racine: '月', fichier: 'familles/月.json', traits: 'traits/月.json', n: 1, avancement_possible: 0 }
    ],
    contes: [],
    paires: 'paires.json'
  };
  const vide = {
    en: '',
    nouveau: [],
    role: null,
    roles: {},
    sources: [],
    origine_fr: '',
    origine_en: '',
    etiquette: null,
    memo_fr: null,
    memo_en: null,
    mots: [],
    phrase: null,
    traits: [],
    medianes: [],
    audio: null,
    statut: 'sans_fiche'
  };
  const familleSimulee = {
    version: V,
    source: 'test',
    norme: 'GF 0014-2009',
    racine: { c: '月', pinyin: 'yuè', fr: '', en: '', origine: '', etiquette: null },
    fiches: [
      { ...vide, c: '月', pinyin: 'yuè', fr: '', parts: [], niveaux: { seuil: 255 } },
      { ...vide, c: '朋', pinyin: 'péng', fr: '', parts: ['月', '月'], niveaux: { seuil: 255 } }
    ]
  };
  const traitsSimules = {
    version: V,
    license: 'Arphic Public License',
    source: 'Make Me a Hanzi — graphics.txt',
    traits: { 月: { s: ['M 0 0'], m: [[[0, 0]]] } }
  };

  const fichiers: Record<string, unknown> = {
    [`data/${V}/index.json`]: indexSimule,
    [`data/${V}/familles/月.json`]: familleSimulee,
    [`data/${V}/traits/月.json`]: traitsSimules,
    [`data/${V}/paires.json`]: { paires: [['日', '曰']] }
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne lit l'index qu'une fois, quel que soit le nombre d'appels", async () => {
    const appels = servir(V, fichiers);
    const a = await contenu(V);
    const b = await contenu(V);
    expect(a.version).toBe(V);
    expect(b).toBe(a);
    expect(appels.filter((u) => u.endsWith('index.json'))).toHaveLength(1);
  });

  it("lit une famille et ses tracés à la demande, une requête par fichier", async () => {
    const appels = servir(V, fichiers);
    const f = await chargerFamille('月', V);
    await chargerFamille('月', V);
    expect(f?.racine.c).toBe('月');
    expect(f?.fiches.map((x) => x.c)).toEqual(['月', '朋']);
    const t = await chargerTraits('月', V);
    await chargerTraits('月', V);
    expect(Object.keys(t)).toEqual(['月']);
    expect(appels.filter((u) => u.includes('familles/月.json'))).toHaveLength(1);
    expect(appels.filter((u) => u.includes('traits/月.json'))).toHaveLength(1);
    expect(await chargerFamille('無', V)).toBeNull();
  });

  it("trouve la famille d'un caractère par l'index, et ne sort jamais de l'origine", async () => {
    const appels = servir(V, fichiers);
    expect(await racineDe('月', [], V)).toBe('月');
    expect(await racineDe('朋', [], V)).toBe('月');
    const f = await fiche('朋', [], V);
    expect(f?.c).toBe('朋');
    expect(f?.parts).toEqual(['月', '月']);
    expect(f?.source).toBe('aucune');
    for (const u of appels) expect(u.startsWith(import.meta.env.BASE_URL)).toBe(true);
  });

  it('surcouche la fiche exportée avec la démonstration quand elle est vide', async () => {
    servir(V, fichiers);
    const lue = await fiche('人', [], V);
    /* 人 n'est pas dans l'export simulé : la démonstration le porte seule. */
    expect(lue?.fr).toBe(ficheDeFamille(familleDemoPeuple, '人')?.fr);
    expect(lue?.source).toBe('demonstration');
  });

  it("prend les tracés de l'export, et retombe sur strokes-demo pour le reste", async () => {
    servir(V, { ...fichiers, 'strokes-demo.json': { 安: { s: ['M 1 1'], m: [[[1, 1]]] } } });
    expect((await traitsDe('月', [], V))?.s).toEqual(['M 0 0']);
    expect((await traitsDe('安', [], V))?.s).toEqual(['M 1 1']);
    expect(await traitsDe('無', [], V)).toBeNull();
  });

  it("lit les paires à ne pas confondre de l'export", async () => {
    servir(V, fichiers);
    expect(await pairesExport(V)).toEqual({ paires: [['日', '曰']] });
  });

  it('assemble la leçon du jour : la brique, ses composés, les briques déjà posées', async () => {
    servir(V, fichiers);
    const l = await lecon(null, 1, V);
    expect(l.nom).toBe('lire');
    expect(l.jour?.jour).toBe(1);
    expect(l.brique?.c).toBe('月');
    expect(l.composes.map((f) => f.c)).toEqual(['朋']);
    expect(l.pistes).toEqual(['月']);
    expect(caractereDuJour(l)).toBe('朋');
  });

  it('ne pose plus rien quand le parcours est fini', async () => {
    servir(V, fichiers);
    const l = await lecon(null, 2, V);
    expect(l.jour).toBeNull();
    expect(l.brique).toBeNull();
    expect(l.composes).toEqual([]);
    expect(caractereDuJour(l)).toBe('');
  });
});

describe("l'écran Ouvrir", () => {
  it("ne passe jamais tout seul : l'anecdote se lit à son rythme, on continue au tap", () => {
    const src = readFileSync(new URL('Open.svelte', import.meta.url), 'utf8');
    expect(src).not.toMatch(/setTimeout|setInterval/);
    expect(src).toContain('onclick={oncontinuer}');
  });
});

/* Les contes : fixtures de test, écrites pour exercer le chargeur. L'app n'en contient aucun. */
describe('le chargeur des contes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const V = 'test-contes';
  const conteSimule = {
    version: V,
    license: 'propriétaire',
    source: 'test',
    source_url: '',
    modified: '',
    conte: 'essai',
    titre_fr: 'Essai',
    versions: {
      '405': {
        titre: '人和兔子',
        phrases: [{ zh: '兔子来了。', pinyin: 'Tùzi lái le.', fr: 'Le lièvre vient.' }],
        glose: { 兔子: 'lièvre', 来: 'venir', 了: '', 1: 7 }
      },
      '255': {
        titre: '人',
        phrases: [{ zh: '人来。', pinyin: 'Rén lái.', fr: "L'homme vient." }, { zh: '' }],
        glose: { 人: 'homme' }
      },
      '505': { titre: 'vide', phrases: [] },
      hsk2: { titre: '人', phrases: [{ zh: '人来了。', pinyin: 'Rén lái le.', fr: "L'homme est venu." }], glose: {} },
      hsk8: { titre: 'x', phrases: [{ zh: '人', pinyin: 'rén', fr: '' }] },
      pas: { titre: 'x', phrases: [{ zh: '人', pinyin: 'rén', fr: '' }] }
    }
  };
  const indexSimule = {
    version: V,
    familles: [],
    contes: [
      { id: 'essai', titre_fr: 'Essai', seuils: ['hsk2', 255, 405], fichier: 'contes/essai.json', gratuit: true },
      { id: 'absent', titre_fr: 'Absent', seuils: [255, 0, 'x'], fichier: 'contes/absent.json' },
      { titre_fr: 'Sans identifiant', seuils: [255], fichier: 'contes/rien.json' }
    ]
  };
  const fichiers: Record<string, unknown> = {
    [`data/${V}/index.json`]: indexSimule,
    [`data/${V}/contes/essai.json`]: conteSimule
  };
  function servir(): string[] {
    const appels: string[] = [];
    vi.stubGlobal('fetch', (async (u: RequestInfo | URL) => {
      const url = String(u);
      appels.push(url);
      const chemin = url.slice(import.meta.env.BASE_URL.length);
      if (chemin in fichiers) {
        return { ok: true, status: 200, json: async () => fichiers[chemin] } as Response;
      }
      return { ok: false, status: 404, json: async () => null } as Response;
    }) as typeof fetch);
    return appels;
  }

  it('relit les versions par niveau, du plus petit au plus grand, et écarte ce qui ne se lit pas', () => {
    const c = lireConte(conteSimule);
    expect(c.id).toBe('essai');
    expect(c.titre_fr).toBe('Essai');
    expect(c.versions.map((v) => v.seuil)).toEqual(['255', '405', 'hsk2']);
    expect(c.versions[0].phrases).toEqual([{ zh: '人来。', pinyin: 'Rén lái.', fr: "L'homme vient." }]);
    expect(c.versions[1].glose).toEqual({ 兔子: 'lièvre', 来: 'venir' });
    expect(() => lireConte({ titre_fr: 'sans id' })).toThrow('illisible');
  });

  it('lit la glose au format du pipeline : un objet {pinyin, fr, en} par clé', () => {
    const c = lireConte({
      conte: 'nan-yuan-bei-zhe',
      titre_fr: 'Rouler vers le nord pour aller au sud',
      versions: {
        '255': {
          titre: '要去南方的人',
          titre_pinyin: 'yào qù nán fāng de rén',
          phrases: [{ zh: '有人问他：「你去哪里？」', pinyin: 'yǒu rén wèn tā nǐ qù nǎ lǐ', fr: 'Quelqu’un lui demanda : « Où vas-tu ? »', en: 'Someone asked him.' }],
          glose: {
            哪里: { pinyin: 'nǎ lǐ', fr: 'où', en: 'where' },
            有人: { pinyin: 'yǒu rén', fr: 'quelqu’un', en: 'someone' },
            空: { pinyin: 'kōng', en: 'empty' }
          }
        }
      }
    });
    expect(c.versions[0].glose).toEqual({ 哪里: 'où', 有人: 'quelqu’un' });
  });

  it("marque les contes gratuits d'après l'index, faux par défaut, et écarte une entrée sans identifiant", () => {
    const lus = lireContesIndex(indexSimule.contes);
    expect(lus.map((x) => [x.id, x.gratuit, x.seuils])).toEqual([
      ['essai', true, ['255', '405', 'hsk2']],
      ['absent', false, ['255']]
    ]);
    expect(lireContesIndex(undefined)).toEqual([]);
  });

  it("lit chaque conte de l'index dans le dossier de la version ; un fichier absent manque, sans erreur", async () => {
    const appels = servir();
    const i = await loadIndex(V);
    expect(fichierConte(i, 'essai')).toBe(`data/${V}/contes/essai.json`);
    expect(fichierConte(i, 'inconnu')).toBeNull();
    const { index: entrees, contes } = await contesExport(V);
    expect(entrees.map((x) => x.id)).toEqual(['essai', 'absent']);
    expect([...contes.keys()]).toEqual(['essai']);
    expect(appels).toContain(`${import.meta.env.BASE_URL}data/${V}/contes/essai.json`);
    await expect(loadConte(`data/${V}/contes/absent.json`)).rejects.toThrow('introuvable');
  });
});

describe('le chargeur de devinettes', () => {
  const FICHIER = `data/${VERSION_DONNEES}/devinettes.json`;
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;
  const servi = JSON.parse(
    readFileSync(new URL(`../../public/${FICHIER}`, import.meta.url), 'utf8')
  ) as Devinettes;
  const juste = {
    id: '休',
    c: '休',
    pinyin: 'xiū',
    sens: 'se reposer',
    enonce: 'Un homme adossé à un arbre',
    zh: null,
    disposition: 'cote',
    briques: ['亻', '木'],
    leurres: ['作', '机', '们']
  };

  it("lit le fichier nommé par l'index, et lui seul", async () => {
    expect(fichierDevinettes(index)).toBe(FICHIER);
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, servi);
    };
    const lu = await loadDevinettes(FICHIER, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER}`]);
    expect(lu.devinettes).toHaveLength(servi.devinettes.length);
  });

  it('écarte une devinette illisible : sans énoncé, une brique seule, la réponse parmi les leurres', async () => {
    const corps = {
      devinettes: [
        juste,
        { ...juste, id: 'a', enonce: '' },
        { ...juste, id: 'b', briques: ['亻'] },
        { ...juste, id: 'c', leurres: ['休', '作', '机'] },
        { ...juste, id: 'd', leurres: ['作', '作', '机'] },
        { ...juste }
      ],
      noms: { 亻: 'un homme', 木: 'un arbre', x: 3 },
      racines: { 休: '亻' }
    };
    const lu = await loadDevinettes(FICHIER, async () => reponse(true, corps));
    expect(lu.devinettes.map((d) => d.id)).toEqual(['休']);
    expect(lu.noms).toEqual({ 亻: 'un homme', 木: 'un arbre' });
  });

  it('refuse un fichier absent ou sans liste', async () => {
    await expect(loadDevinettes(FICHIER, async () => reponse(false, null))).rejects.toThrow(
      'introuvables'
    );
    await expect(loadDevinettes(FICHIER, async () => reponse(true, {}))).rejects.toThrow(
      'illisibles'
    );
  });

  it("vient du pipeline : l'export versionné porte les devinettes, leur en-tête et leurs racines", () => {
    expect(index.devinettes).toBe('devinettes.json');
    const brut = servi as unknown as Record<string, unknown>;
    for (const cle of ['license', 'source', 'source_url', 'modified']) {
      expect(brut[cle]).toBeTruthy();
    }
    expect(servi.devinettes.length).toBeGreaterThanOrEqual(60);
    for (const d of servi.devinettes) {
      expect(d.leurres).toHaveLength(3);
      for (const x of [d.c, ...d.briques, ...d.leurres]) expect(servi.racines[x]).toBeTruthy();
      for (const b of d.briques) expect(servi.noms[b]).toBeTruthy();
    }
  });

  it("n'écrit aucune devinette dans le code de l'app", () => {
    for (const f of ['Game.svelte', 'jeux.ts', '../App.svelte']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      for (const d of servi.devinettes) {
        expect(src).not.toContain(d.enonce);
        if (d.zh) expect(src).not.toContain(d.zh);
      }
    }
  });
});
