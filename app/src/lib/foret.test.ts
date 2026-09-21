import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FICHIER_FORET_DEMO,
  caracteres,
  loadForet,
  type Foret,
  type Noeud
} from './content';
import {
  ANNEAUX,
  CX,
  CY,
  LETTRES,
  R_RACINE_MAX,
  R_RACINE_MIN,
  acquis,
  decale,
  etat,
  famille,
  graines,
  joursTravailles,
  jourSemaine,
  ligneSemaine,
  lundi,
  noeud,
  placerArbre,
  placerCercle,
  semaine
} from './foret';
import { emptyProgress, fromJSON, toJSON, markDone, type Progress } from './session';
import { ajouter } from './tao';

const fichier = JSON.parse(
  readFileSync(new URL('../../public/data/demo/foret.json', import.meta.url), 'utf8')
) as Foret;
const maquette = readFileSync(
  new URL('../../../maquettes/zilin-maquette.html', import.meta.url),
  'utf8'
);

/* ---------- la maquette, relue telle quelle ---------- */

/** Le `CF` de la maquette : `[{c, d, k: [[caractère, avancement, [petits]]]}]`. */
type Maquette = { c: string; d: number; k: [string, number, [string, number][]?][] };

function cercleDeLaMaquette(): Maquette[] {
  const bloc = /const CF=\[(.*?)\n\];/s.exec(maquette);
  if (!bloc) throw new Error('la maquette ne porte plus de cercle des familles');
  const json = `[${bloc[1]}]`.replace(/([{,])(c|d|k):/g, '$1"$2":').replace(/([:,[])\./g, '$10.');
  return JSON.parse(json) as Maquette[];
}

/** Le `DICT` de la maquette : pinyin et sens de chaque caractère. */
function dictionnaireDeLaMaquette(): Record<string, [string, string]> {
  const bloc = /const DICT=\{(.*?)\n\};/s.exec(maquette);
  if (!bloc) throw new Error('la maquette ne porte plus de dictionnaire');
  const d: Record<string, [string, string]> = {};
  for (const m of bloc[0].matchAll(/"(.)":\["([^"]*)","([^"]*)","(?:[^"]*)"\]/g)) {
    d[m[1]] = [m[2], m[3]];
  }
  return d;
}

const CF = cercleDeLaMaquette();
const DICT = dictionnaireDeLaMaquette();

describe('le fichier du cercle des familles', () => {
  it('est versionné et cite sa source', () => {
    expect(fichier.version).not.toBe('');
    expect(fichier.source).toBe('maquettes/zilin-maquette.html');
    expect(fichier.norme).toBe('GF 0014-2009');
  });

  it('recopie le cercle de la maquette, racines, enfants et états', () => {
    const attendu = CF.map((f) => ({
      c: f.c,
      avancement: f.d,
      membres: f.k.map((k) => ({
        c: k[0],
        avancement: k[1],
        membres: (k[2] ?? []).map((g) => ({ c: g[0], avancement: g[1], membres: [] }))
      }))
    }));
    const nu = (n: Noeud): unknown => ({
      c: n.c,
      avancement: n.avancement,
      membres: n.membres.map(nu)
    });
    expect(fichier.familles.map(nu)).toEqual(attendu);
  });

  it('reprend le pinyin et le sens de la maquette, sans rien écrire de neuf', () => {
    for (const f of fichier.familles) {
      for (const c of caracteres(f)) {
        const n = noeud(f, c);
        expect(DICT[c]).toBeDefined();
        expect([n?.pinyin, n?.fr]).toEqual(DICT[c]);
      }
    }
  });

  it("ne porte aucune origine : sans étiquette, on n'en montre pas", () => {
    const champs = new Set(fichier.familles.flatMap((f) => Object.keys(f)));
    expect([...champs].sort()).toEqual(['avancement', 'c', 'fr', 'membres', 'pinyin']);
  });

  it('se lit par le chargeur, avec un fetch injecté', async () => {
    const faux = (async () => ({
      ok: true,
      json: async () => JSON.parse(JSON.stringify(fichier)) as unknown
    })) as unknown as typeof fetch;
    const f = await loadForet(FICHIER_FORET_DEMO, faux);
    expect(f.familles).toHaveLength(CF.length);
    expect(f.centre).toBe('字');
  });

  it('refuse un fichier illisible', async () => {
    const faux = (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(loadForet(FICHIER_FORET_DEMO, faux)).rejects.toThrow(/illisible/);
  });
});

/* ---------- les trois états ---------- */

describe("l'état d'un nœud", () => {
  it('se lit sur son avancement, et sur rien d\'autre', () => {
    expect(etat(1)).toBe('acquis');
    expect(etat(0.4)).toBe('encours');
    expect(etat(0)).toBe('avenir');
  });
});

/* ---------- la disposition du cercle ---------- */

describe('la disposition du cercle', () => {
  const cercle = placerCercle(fichier);

  it('est déterministe : deux appels donnent le même dessin', () => {
    expect(placerCercle(fichier)).toEqual(cercle);
  });

  it('pose un secteur par famille et un nœud par caractère', () => {
    expect(cercle.secteurs).toHaveLength(fichier.familles.length);
    const attendus = fichier.familles.flatMap((f) => caracteres(f));
    expect(cercle.noeuds).toHaveLength(attendus.length);
    expect([...cercle.noeuds].map((n) => n.c).sort()).toEqual([...attendus].sort());
  });

  it('pose chaque génération sur son anneau', () => {
    for (const n of cercle.noeuds) {
      const d = Math.hypot(n.x - CX, n.y - CY);
      expect(d).toBeCloseTo(ANNEAUX[n.generation], 0);
    }
  });

  it("donne à chaque nœud l'état de ses données", () => {
    for (const f of fichier.familles) {
      for (const c of caracteres(f)) {
        const pose = cercle.noeuds.find((n) => n.c === c && n.famille === fichier.familles.indexOf(f));
        expect(pose?.etat).toBe(etat(noeud(f, c)!.avancement));
      }
    }
  });

  it('ne met le cinabre que sur la famille en cours', () => {
    const rouges = cercle.noeuds.filter((n) => n.cinabre);
    expect(rouges).toHaveLength(1);
    expect(rouges[0].generation).toBe(0);
    expect(rouges[0].c).toBe('木');
    expect(etat(fichier.familles[rouges[0].famille].avancement)).toBe('encours');
  });

  it('taille la racine selon la taille de la famille', () => {
    const racine = (c: string) => cercle.noeuds.find((n) => n.generation === 0 && n.c === c)!;
    /* 口 mène huit composés, 手 en mène deux. */
    expect(racine('口').r).toBe(R_RACINE_MAX);
    expect(racine('手').r).toBe(R_RACINE_MIN);
    expect(racine('日').r).toBeGreaterThan(racine('水').r);
  });

  it('relie le centre à chaque racine, et chaque racine à ses membres', () => {
    const membres = fichier.familles.reduce(
      (n, f) => n + f.membres.length + f.membres.reduce((m, k) => m + k.membres.length, 0),
      0
    );
    expect(cercle.liens).toHaveLength(fichier.familles.length + membres);
  });
});

/* ---------- l'arbre d'une famille ---------- */

describe("l'arbre d'une famille", () => {
  it('se choisit par son rang dans le cercle', () => {
    expect(famille(fichier, 0)?.c).toBe(CF[0].c);
    expect(famille(fichier, CF.length - 1)?.c).toBe(CF[CF.length - 1].c);
    expect(famille(fichier, CF.length)).toBeNull();
  });

  it('pose la racine en haut, ses générations en dessous', () => {
    const fam = famille(fichier, 0)!;
    const arbre = placerArbre(fam);
    expect(arbre.noeuds[0]).toMatchObject({ c: fam.c, x: 260, y: 60, generation: 0 });
    expect(arbre.noeuds.filter((n) => n.generation === 1).map((n) => n.c)).toEqual(
      fam.membres.map((k) => k.c)
    );
    for (const n of arbre.noeuds) expect(n.x).toBeGreaterThan(0);
    expect(placerArbre(fam)).toEqual(arbre);
  });

  it('compte les composés acquis de la famille', () => {
    const fam = famille(fichier, 0)!;
    expect(acquis(fam)).toBe(fam.membres.filter((k) => k.avancement >= 1).length);
    expect(acquis(famille(fichier, CF.length - 1)!)).toBe(0);
  });

  it('retrouve un nœud par son caractère', () => {
    const fam = famille(fichier, 0)!;
    expect(noeud(fam, '您')?.pinyin).toBe('nín');
    expect(noeud(fam, '水')).toBeNull();
  });
});

/* ---------- la semaine des graines ---------- */

const lundi1 = '2026-03-02';

function progressionAvecJours(jours: string[]): Progress {
  let p = emptyProgress(lundi1);
  for (const j of jours) p = { ...p, tao: ajouter(p.tao, j, 'lecon') };
  return p;
}

describe('la semaine des graines', () => {
  it('compte les jours du lundi au dimanche', () => {
    expect(jourSemaine(lundi1)).toBe(0);
    expect(jourSemaine('2026-03-08')).toBe(6);
    expect(lundi('2026-03-05')).toBe(lundi1);
    expect(lundi(lundi1)).toBe(lundi1);
    expect(decale(lundi1, 6)).toBe('2026-03-08');
  });

  it('tient sept cases, une par initiale', () => {
    const cases = semaine(emptyProgress(lundi1), lundi1);
    expect(cases.map((c) => c.lettre)).toEqual([...LETTRES]);
    expect(cases.filter((c) => c.aujourdhui)).toHaveLength(1);
  });

  it('plante une graine par jour travaillé de la semaine', () => {
    const p = progressionAvecJours([lundi1, '2026-03-03', '2026-03-03', '2026-03-05']);
    expect(graines(p, '2026-03-05')).toBe(3);
    expect(semaine(p, '2026-03-05').map((c) => c.graine)).toEqual([
      true,
      true,
      false,
      true,
      false,
      false,
      false
    ]);
  });

  it('ne compte pas les jours des semaines précédentes', () => {
    const p = progressionAvecJours(['2026-02-25', lundi1]);
    expect(joursTravailles(p)).toEqual(['2026-02-25', lundi1]);
    expect(graines(p, lundi1)).toBe(1);
  });

  it('compte une journée commencée sans activité notée', () => {
    const p = markDone(emptyProgress(lundi1), 0, lundi1);
    expect(graines(p, lundi1)).toBe(1);
  });

  it('ne dit jamais les jours perdus', () => {
    for (const n of [0, 1, 3, 7]) {
      expect(ligneSemaine(n)).not.toMatch(/perdu|manqu|rat/i);
    }
    expect(ligneSemaine(1)).toBe('Une graine cette semaine.');
    expect(ligneSemaine(7)).toMatch(/arbre/);
  });
});

/* ---------- export et import ---------- */

describe('la progression exportée', () => {
  it('se relit telle quelle', () => {
    let p = emptyProgress(lundi1);
    p = markDone(p, 0, lundi1);
    p = { ...p, budget: 20, trace: false, tao: ajouter(p.tao, lundi1, 'lecon') };
    expect(fromJSON(toJSON(p), lundi1)).toEqual(p);
  });

  it("garde les graines de la semaine après l'aller-retour", () => {
    const p = progressionAvecJours([lundi1, '2026-03-04']);
    expect(graines(fromJSON(toJSON(p), lundi1), '2026-03-04')).toBe(graines(p, '2026-03-04'));
  });

  it('refuse un fichier qui n\'est pas une progression', () => {
    expect(() => fromJSON('pas du json', lundi1)).toThrow(/illisible/);
  });
});
