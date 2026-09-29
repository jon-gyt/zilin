import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FICHIER_FORET_DEMO,
  VERSION_DONNEES,
  caracteres,
  loadForet,
  type Famille,
  type Foret,
  type Index,
  type Noeud
} from './content';
import {
  AVANCEMENT_ENCOURS,
  LETTRES,
  acquis,
  avancement,
  caracteresLus,
  decale,
  etat,
  famille,
  famillesOuvertes,
  noeudDeFamille,
  graines,
  joursTravailles,
  jourSemaine,
  ligneSemaine,
  lundi,
  noeud,
  semaine
} from './foret';
import { lireEcrans } from './ecrans';
import { emptyProgress, fromJSON, toJSON, markDone, type Progress } from './session';
import { SEUIL_DEBLOCAGE, newCard, schedule, stability, type ReviewCard } from './srs';
import { ajouter } from './tao';

/** L'image du chemin, telle que le pipeline l'exporte (`ecrans.json`). */
const CHEMIN = lireEcrans(
  JSON.parse(readFileSync(new URL('../../public/data/0.1.0/ecrans.json', import.meta.url), 'utf8')) as unknown
).chemin;

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

/* ---------- une famille ---------- */

describe('une famille', () => {
  it('se choisit par son rang dans la liste', () => {
    expect(famille(fichier, 0)?.c).toBe(CF[0].c);
    expect(famille(fichier, CF.length - 1)?.c).toBe(CF[CF.length - 1].c);
    expect(famille(fichier, CF.length)).toBeNull();
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

/* ---------- la semaine des pierres ---------- */

const lundi1 = '2026-03-02';

function progressionAvecJours(jours: string[]): Progress {
  let p = emptyProgress(lundi1);
  for (const j of jours) p = { ...p, tao: ajouter(p.tao, j, 'lecon') };
  return p;
}

describe('la semaine des pierres', () => {
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

  it('pose une pierre par jour travaillé de la semaine', () => {
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

  it('pose les mêmes pierres que la série : celles de la clôture', () => {
    /* La journée en cours, pas encore close, n'a pas de pierre : Clore non plus. */
    let p = progressionAvecJours([lundi1, '2026-03-03']);
    p = { ...p, joursTravailles: [lundi1], tao: ajouter(p.tao, '2026-03-04', 'lecon') };
    expect(joursTravailles(p)).toEqual([lundi1]);
    expect(graines(p, '2026-03-04')).toBe(1);
  });

  it('compte une journée commencée sans activité notée', () => {
    const p = markDone(emptyProgress(lundi1), 0, lundi1);
    expect(graines(p, lundi1)).toBe(1);
  });

  it('ne dit jamais les jours perdus, et compte en pierres, sept pour un pavillon', () => {
    for (const n of [0, 1, 3, 7]) {
      expect(ligneSemaine(n, CHEMIN)).not.toMatch(/perdu|manqu|rat/i);
    }
    expect(ligneSemaine(0, CHEMIN)).toBe('Aucune pierre cette semaine. Sept pierres font un pavillon.');
    expect(ligneSemaine(1, CHEMIN)).toBe('Une pierre cette semaine.');
    expect(ligneSemaine(3, CHEMIN)).toBe('3 pierres cette semaine.');
    expect(ligneSemaine(7, CHEMIN)).toBe('Sept pierres : la semaine fait un pavillon.');
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

  it("garde les pierres de la semaine après l'aller-retour", () => {
    const p = progressionAvecJours([lundi1, '2026-03-04']);
    expect(graines(fromJSON(toJSON(p), lundi1), '2026-03-04')).toBe(graines(p, '2026-03-04'));
  });

  it('refuse un fichier qui n\'est pas une progression', () => {
    expect(() => fromJSON('pas du json', lundi1)).toThrow(/illisible/);
  });
});

/* ---------- les familles, lues sur l'export et les cartes ---------- */

const indexExport = JSON.parse(
  readFileSync(
    new URL(`../../public/data/${VERSION_DONNEES}/index.json`, import.meta.url),
    'utf8'
  )
) as Index;

/**
 * Les familles de l'export, lues sur disque : aucune requête dans un test. Le fichier est
 * celui que l'index nomme : une racine écrite en IDS (⿰丿丨) a un nom en `U+XXXX`.
 */
function familleExport(racine: string): Famille {
  const fichier =
    indexExport.familles.find((x) => x.racine === racine)?.fichier ?? `familles/${racine}.json`;
  return JSON.parse(
    readFileSync(
      new URL(`../../public/data/${VERSION_DONNEES}/${fichier}`, import.meta.url),
      'utf8'
    )
  ) as Famille;
}

const TJ = new Date('2026-03-02T08:00:00Z');
const JUSTE = { correct: true, tries: 0, seconds: 2 };

/** Une carte neuve : elle existe, donc la famille est ouverte, mais rien n'est acquis. */
const neuve = (c: string): ReviewCard => newCard(c, TJ);
/** Une carte sue : la stabilité passe le seuil de déblocage de `srs.ts`. */
const sue = (c: string): ReviewCard => schedule(newCard(c, TJ), JUSTE, TJ).card;

describe("l'avancement d'une famille, lu sur les cartes", () => {
  it('a trois états, et trois seulement', () => {
    const cartes = [sue('月'), neuve('朋')];
    expect(avancement('月', cartes)).toBe(1);
    expect(avancement('朋', cartes)).toBe(AVANCEMENT_ENCOURS);
    expect(avancement('有', cartes)).toBe(0);
    expect(etat(avancement('月', cartes))).toBe('acquis');
    expect(etat(avancement('朋', cartes))).toBe('encours');
    expect(etat(avancement('有', cartes))).toBe('avenir');
  });

  it("ne lit l'avancement nulle part ailleurs que dans les cartes", () => {
    const f = familleExport('月');
    /*
     * L'index annonce ce que le pipeline permet d'enseigner (la part des fiches relues),
     * pas ce qui est acquis : quel que soit ce plafond, sans carte rien n'avance.
     */
    const possible = indexExport.familles.find((x) => x.racine === '月')?.avancement_possible;
    expect(possible).toBeGreaterThanOrEqual(0);
    expect(possible).toBeLessThanOrEqual(1);
    const vide = noeudDeFamille(f, []);
    expect(vide.avancement).toBe(0);
    expect(vide.membres.every((m) => m.avancement === 0)).toBe(true);
    expect(acquis(vide)).toBe(0);
    const n = noeudDeFamille(f, [sue('月'), neuve('朋')]);
    expect(n.c).toBe('月');
    expect(n.avancement).toBe(1);
    expect(n.membres.map((m) => m.c)).toEqual(f.fiches.filter((x) => x.c !== '月').map((x) => x.c));
    expect(n.membres.find((m) => m.c === '朋')?.avancement).toBe(AVANCEMENT_ENCOURS);
    expect(n.membres.find((m) => m.c === '有')?.avancement).toBe(0);
    expect(acquis(n)).toBe(0);
  });
});

describe('les nombres de Mon chemin, lus sur la progression', () => {
  const familles = ['月', '口', '亻'].map(familleExport);
  const membre = (r: string) => familleExport(r).fiches.find((x) => x.c !== r)!.c;

  it('ne lit rien sans carte', () => {
    expect(caracteresLus(familles, [])).toBe(0);
    expect(famillesOuvertes(familles, [])).toBe(0);
  });

  it("« Lus » compte les caractères dont la carte passe le seuil de srs.ts, et eux seuls", () => {
    const cartes = [sue('月'), sue(membre('口')), neuve('朋'), neuve('亻')];
    expect(stability(cartes[0])).toBeGreaterThanOrEqual(SEUIL_DEBLOCAGE);
    expect(stability(cartes[2])).toBeLessThan(SEUIL_DEBLOCAGE);
    expect(caracteresLus(familles, cartes)).toBe(2);
    /* Le seuil est celui de `srs.ts` : le relever au-dessus de la stabilité, plus rien n'est lu. */
    expect(caracteresLus(familles, cartes, stability(cartes[0]) + 1)).toBe(0);
  });

  it("« Lus » ne compte ni une carte hors de l'export ni deux fois le même caractère", () => {
    expect(caracteresLus(familles, [sue('月'), sue('龘')])).toBe(1);
    expect(caracteresLus([...familles, familleExport('月')], [sue('月')])).toBe(1);
  });

  it('« Familles ouvertes » compte les familles qui ont au moins une carte, sue ou non', () => {
    expect(famillesOuvertes(familles, [neuve(membre('口'))])).toBe(1);
    expect(famillesOuvertes(familles, [neuve('亻'), sue('月'), sue('朋')])).toBe(2);
    expect(famillesOuvertes(familles, [neuve('龘')])).toBe(0);
  });

  it("sur l'export entier : une carte par caractère de la première famille ouvre une famille", () => {
    const toutes = indexExport.familles.map((x) => familleExport(x.racine));
    const f = toutes[0];
    const cartes = [f.racine.c, ...f.fiches.map((x) => x.c)].map(sue);
    expect(famillesOuvertes(toutes, cartes)).toBe(1);
    expect(caracteresLus(toutes, cartes)).toBe(new Set(cartes.map((k) => k.id)).size);
  });

  it('Mon chemin affiche ces deux nombres, pas un fichier de démonstration', () => {
    const ecran = readFileSync(new URL('Chemin.svelte', import.meta.url), 'utf8');
    expect(ecran).toContain('caracteresLus(familles, p.cartes)');
    expect(ecran).toContain('famillesOuvertes(familles, p.cartes)');
  });
});

describe('les écrans de Mon chemin', () => {
  it("mène aux récompenses : l'écran existait sans porte d'entrée", () => {
    const foret = readFileSync(new URL('Chemin.svelte', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
    expect(foret).toContain('onrecompenses');
    expect(app).toContain("onrecompenses={() => ouvrirDetour('rewards', 'foret')}");
  });
});
