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
  ANNEAUX,
  ARBRE_H,
  ARBRE_PAR_RANG,
  ARBRE_Y1,
  AVANCEMENT_ENCOURS,
  CENTRE,
  CX,
  CY,
  LETTRES,
  R_RACINE_MAX,
  R_RACINE_MIN,
  FAMILLES_CERCLE,
  FENETRE_JOURS,
  acquis,
  avancement,
  construireForet,
  decale,
  etat,
  famille,
  famillesDuCercle,
  noeudDeFamille,
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
import { newCard, schedule, type ReviewCard } from './srs';
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

/* ---------- le cercle construit depuis l'index et les cartes ---------- */

const indexExport = JSON.parse(
  readFileSync(
    new URL(`../../public/data/${VERSION_DONNEES}/index.json`, import.meta.url),
    'utf8'
  )
) as Index;

/** Les familles de l'export, lues sur disque : aucune requête dans un test. */
function familleExport(racine: string): Famille {
  return JSON.parse(
    readFileSync(
      new URL(`../../public/data/${VERSION_DONNEES}/familles/${racine}.json`, import.meta.url),
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
    /* L'index annonce ce que le pipeline permet d'enseigner, pas ce qui est acquis. */
    expect(indexExport.familles.find((x) => x.racine === '月')?.avancement_possible).toBe(0);
    const n = noeudDeFamille(f, [sue('月'), neuve('朋')]);
    expect(n.c).toBe('月');
    expect(n.avancement).toBe(1);
    expect(n.membres.map((m) => m.c)).toEqual(f.fiches.filter((x) => x.c !== '月').map((x) => x.c));
    expect(n.membres.find((m) => m.c === '朋')?.avancement).toBe(AVANCEMENT_ENCOURS);
    expect(n.membres.find((m) => m.c === '有')?.avancement).toBe(0);
    expect(acquis(n)).toBe(0);
  });
});

describe('les familles posées sur le cercle', () => {
  const nom = 'lire';
  const premiers = indexExport.parcours[nom].jours.slice(0, 40);
  const racines = premiers
    .map((j) => j.brique)
    .filter((b): b is string => b !== null)
    .slice(0, 12);
  const familles = racines.map(familleExport);

  it('prend les prochaines familles du parcours, dans son ordre', () => {
    const posees = famillesDuCercle({
      index: indexExport,
      familles,
      cartes: [],
      nom,
      jour: 1,
      fenetre: 5
    });
    expect(posees.length).toBeGreaterThan(0);
    /* Les cinq premiers jours : la famille de la brique de chaque jour, dans l'ordre. */
    expect(posees.slice(0, 5)).toEqual(racines.slice(0, 5));
  });

  it('garde les familles ouvertes, même loin derrière dans le parcours', () => {
    const tardive = familles[10];
    const posees = famillesDuCercle({
      index: indexExport,
      familles,
      cartes: [sue(tardive.racine.c)],
      nom,
      jour: 1,
      fenetre: 2
    });
    expect(posees).toContain(tardive.racine.c);
  });

  it("borne le cercle pour qu'il reste lisible, et laisse le reste à la recherche", () => {
    const posees = famillesDuCercle({
      index: indexExport,
      familles,
      cartes: [],
      nom,
      jour: 1,
      fenetre: FENETRE_JOURS,
      max: 4
    });
    expect(posees).toHaveLength(4);
    expect(FAMILLES_CERCLE).toBeLessThan(indexExport.familles.length);
  });

  it('met le cinabre sur la famille du moment, et sur elle seule', () => {
    const moment = racines[2];
    const foret = construireForet(
      { index: indexExport, familles, cartes: [neuve(racines[0])], nom, jour: 1, fenetre: 5 },
      moment
    );
    expect(foret.centre).toBe(CENTRE);
    expect(foret.moment).toBe(moment);
    const cercle = placerCercle(foret);
    const marques = cercle.noeuds.filter((n) => n.cinabre);
    expect(marques).toHaveLength(1);
    expect(marques[0].c).toBe(moment);
    expect(marques[0].generation).toBe(0);
  });
});

describe("l'arbre d'une grande famille", () => {
  /** La famille 口 de l'export : dix-sept caractères, plus que ne tient un rang. */
  const grande: Noeud = {
    c: '口',
    pinyin: 'kǒu',
    fr: '',
    avancement: 0,
    membres: [...'别只叫右号吃吗吧听呢哪唱跑路加否'].map((c) => ({
      c,
      pinyin: '',
      fr: '',
      avancement: 0,
      membres: []
    }))
  };

  it('passe à la ligne plutôt que de faire se chevaucher les caractères', () => {
    const arbre = placerArbre(grande);
    const membres = arbre.noeuds.filter((n) => n.generation === 1);
    expect(membres).toHaveLength(grande.membres.length);
    const rangs = [...new Set(membres.map((n) => n.y))];
    expect(rangs.length).toBeGreaterThan(1);
    for (const y of rangs) {
      const rang = membres.filter((n) => n.y === y).sort((a, b) => a.x - b.x);
      expect(rang.length).toBeLessThanOrEqual(ARBRE_PAR_RANG);
      /* Deux voisins d'un même rang ne se recouvrent jamais. */
      for (let i = 1; i < rang.length; i++) {
        expect(rang[i].x - rang[i - 1].x).toBeGreaterThanOrEqual(2 * rang[i].r);
      }
    }
    /* Le dessin s'agrandit d'autant : aucun nœud ne sort de la boîte. */
    for (const n of arbre.noeuds) expect(n.y + n.r).toBeLessThanOrEqual(arbre.hauteur);
  });

  it("garde le dessin d'une petite famille tel quel", () => {
    const petite: Noeud = { ...grande, membres: grande.membres.slice(0, 4) };
    const arbre = placerArbre(petite);
    const membres = arbre.noeuds.filter((n) => n.generation === 1);
    expect(new Set(membres.map((n) => n.y))).toEqual(new Set([ARBRE_Y1]));
    expect(arbre.hauteur).toBe(ARBRE_H);
  });
});

describe('les écrans de Ma forêt', () => {
  it("mène aux récompenses : l'écran existait sans porte d'entrée", () => {
    const foret = readFileSync(new URL('Forest.svelte', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
    expect(foret).toContain('onrecompenses');
    expect(app).toContain("onrecompenses={() => (ecran = 'rewards')}");
  });
});
