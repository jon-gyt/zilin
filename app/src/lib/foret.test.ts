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
  FAMILLES_FOURNIES,
  FENETRE_JOURS,
  JOURS_PROCHES,
  MARGE,
  MEMBRES_NOMMES,
  NOMMES_MAX,
  RANGS,
  R_BRIQUES,
  R_MEMBRE,
  SECTEUR_MIN,
  TAILLE,
  acquis,
  avancement,
  caracteresDe,
  caracteresLus,
  construireForet,
  decale,
  etat,
  famille,
  famillesDuCercle,
  famillesOuvertes,
  noeudDeFamille,
  graines,
  joursTravailles,
  jourSemaine,
  ligneSemaine,
  lundi,
  noeud,
  placerArbre,
  placerCercle,
  prochesDuParcours,
  semaine,
  type Cercle
} from './foret';
import { emptyProgress, fromJSON, toJSON, markDone, type Progress } from './session';
import { SEUIL_DEBLOCAGE, newCard, schedule, stability, type ReviewCard } from './srs';
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

  it('pose un secteur par famille, et chaque caractère est nommé ou compté dans son badge', () => {
    expect(cercle.secteurs).toHaveLength(fichier.familles.length);
    fichier.familles.forEach((f, i) => {
      const nommes = cercle.noeuds.filter((n) => n.famille === i).map((n) => n.c);
      const badge = cercle.badges.find((b) => b.famille === i)?.n ?? 0;
      expect(nommes.length + badge).toBe(caracteres(f).length);
      for (const c of nommes) expect(caracteres(f)).toContain(c);
    });
  });

  it('ne montre que deux niveaux : les briques, puis les caractères qui les contiennent', () => {
    for (const n of cercle.noeuds) {
      const d = Math.hypot(n.x - CX, n.y - CY);
      if (n.generation === 0) {
        expect(R_BRIQUES.some((r) => Math.abs(d - r) < 0.5)).toBe(true);
      } else {
        expect(n.generation).toBe(1);
        expect(RANGS.some((r) => Math.abs(d - r) < 0.5)).toBe(true);
      }
    }
    /* La deuxième génération de la maquette tient dans les badges. */
    const petits = fichier.familles.flatMap((f) => f.membres.flatMap((k) => k.membres));
    expect(petits.length).toBeGreaterThan(0);
    for (const g of petits) expect(cercle.noeuds.some((n) => n.c === g.c)).toBe(false);
  });

  it("donne à chaque nœud posé l'état de ses données", () => {
    for (const pose of cercle.noeuds) {
      const f = fichier.familles[pose.famille];
      expect(pose.etat).toBe(etat(noeud(f, pose.c)!.avancement));
    }
  });

  it('nomme tout ce qui est acquis ou en cours dans une famille de la maquette', () => {
    fichier.familles.forEach((f, i) => {
      const vivants = f.membres.filter((k) => k.avancement > 0).slice(0, MEMBRES_NOMMES);
      for (const k of vivants) {
        expect(cercle.noeuds.some((n) => n.famille === i && n.c === k.c)).toBe(true);
      }
    });
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

  it('relie le centre à chaque racine, et chaque racine à ses caractères et à son badge', () => {
    const membres = cercle.noeuds.filter((n) => n.generation === 1).length;
    expect(cercle.liens).toHaveLength(fichier.familles.length + membres + cercle.badges.length);
    expect(cercle.liens.filter((l) => l.badge)).toHaveLength(cercle.badges.length);
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

  it('plante les mêmes graines que la série : celles de la clôture', () => {
    /* La journée en cours, pas encore close, n'a pas de graine : l'écran de série non plus. */
    let p = progressionAvecJours([lundi1, '2026-03-03']);
    p = { ...p, joursTravailles: [lundi1], tao: ajouter(p.tao, '2026-03-04', 'lecon') };
    expect(joursTravailles(p)).toEqual([lundi1]);
    expect(graines(p, '2026-03-04')).toBe(1);
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

describe('les nombres de Ma forêt, lus sur la progression', () => {
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

  it('Ma forêt affiche ces deux nombres, pas un fichier de démonstration', () => {
    const ecran = readFileSync(new URL('Forest.svelte', import.meta.url), 'utf8');
    expect(ecran).toContain('caracteresLus(familles, p.cartes)');
    expect(ecran).toContain('famillesOuvertes(familles, p.cartes)');
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

/* ---------- un cercle lisible sur un téléphone ---------- */

describe('le cercle se lit à 393 px, sans zoomer', () => {
  const toutes = indexExport.familles.map((x) => familleExport(x.racine));
  const racineDe = new Map<string, string>();
  for (const f of toutes) for (const c of caracteresDe(f)) if (!racineDe.has(c)) racineDe.set(c, f.racine.c);

  /**
   * Une progression réelle : une carte par caractère que le parcours a posé avant `jour`,
   * sue pour ce qui date de plus de dix jours, neuve pour le reste.
   */
  function progression(nom: string, jour: number): ReviewCard[] {
    const vus = new Set<string>();
    const cartes: ReviewCard[] = [];
    for (const j of indexExport.parcours[nom].jours) {
      if (j.jour >= jour) continue;
      for (const c of j.brique === null ? j.composes : [j.brique, ...j.composes]) {
        if (vus.has(c)) continue;
        vus.add(c);
        cartes.push(j.jour < jour - 10 ? sue(c) : neuve(c));
      }
    }
    return cartes;
  }

  function cercleDu(nom: string, jour: number): { cercle: Cercle; proches: Set<string> } {
    const brique = indexExport.parcours[nom].jours.find((j) => j.jour === jour)?.brique ?? null;
    const moment = brique === null ? null : (racineDe.get(brique) ?? null);
    const foret = construireForet(
      { index: indexExport, familles: toutes, cartes: progression(nom, jour), nom, jour },
      moment
    );
    return { cercle: placerCercle(foret), proches: new Set(foret.proches) };
  }

  const dernier = (nom: string) => Math.max(...indexExport.parcours[nom].jours.map((j) => j.jour));
  const etats = (['lire', 'hsk'] as const).flatMap((nom) => [
    { nom, jour: 5, quand: 'début' },
    { nom, jour: 60, quand: 'milieu' },
    { nom, jour: Math.round(dernier(nom) / 2), quand: 'milieu' },
    { nom, jour: 150, quand: 'avancé' },
    { nom, jour: dernier(nom), quand: 'fin' }
  ]);

  /** La taille à l'écran : la boîte fait 349 px de large à 393 px, moins son jeu de 6 px. */
  const ECHELLE = (349 - 12) / TAILLE;

  for (const { nom, jour, quand } of etats) {
    describe(`parcours ${nom}, jour ${jour} (${quand})`, () => {
      const { cercle, proches } = cercleDu(nom, jour);
      const disques = [
        { c: '字', x: CX, y: CY, r: cercle.rCentre },
        ...cercle.noeuds,
        ...cercle.badges.map((b) => ({ ...b, c: `+${b.n}` }))
      ];

      it("n'a aucune paire de nœuds plus proche que leurs rayons et la marge", () => {
        for (let i = 0; i < disques.length; i++) {
          for (let j = i + 1; j < disques.length; j++) {
            const a = disques[i];
            const b = disques[j];
            const jeu = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
            expect(jeu, `${a.c} et ${b.c}`).toBeGreaterThanOrEqual(MARGE);
          }
        }
      });

      it('garde chaque nœud dans le dessin', () => {
        for (const d of disques) {
          expect(Math.hypot(d.x - CX, d.y - CY) + d.r).toBeLessThanOrEqual(TAILLE / 2);
        }
      });

      it('borne ce qu\'il nomme', () => {
        expect(cercle.secteurs.length).toBeLessThanOrEqual(FAMILLES_CERCLE);
        expect(cercle.noeuds.length).toBeLessThanOrEqual(NOMMES_MAX);
        for (let i = 0; i < cercle.secteurs.length; i++) {
          const membres = cercle.noeuds.filter((n) => n.famille === i && n.generation === 1);
          expect(membres.length).toBeLessThanOrEqual(MEMBRES_NOMMES);
          expect(cercle.badges.filter((b) => b.famille === i).length).toBeLessThanOrEqual(1);
        }
      });

      it("ne nomme que l'acquis, l'en-cours et le proche à venir", () => {
        for (const n of cercle.noeuds.filter((x) => x.generation === 1)) {
          expect(n.etat !== 'avenir' || proches.has(n.c), n.c).toBe(true);
        }
      });

      it('dessine chaque caractère à au moins 14 px', () => {
        for (const n of cercle.noeuds) expect(n.r * 1.56 * ECHELLE).toBeGreaterThanOrEqual(14);
      });

      it('met le cinabre sur une seule brique', () => {
        const rouges = cercle.noeuds.filter((n) => n.cinabre);
        expect(rouges.length).toBeLessThanOrEqual(1);
        for (const r of rouges) expect(r.generation).toBe(0);
      });
    });
  }

  it('fait les secteurs à la mesure des familles, jamais plus petits que le minimum', () => {
    const { cercle } = cercleDu('lire', 150);
    const angle = (i: number) => {
      const p = /M ([\d.]+) ([\d.]+) L [\d.]+ [\d.]+ A [\d.]+ [\d.]+ 0 [01] 1 [\d.]+ [\d.]+ L ([\d.]+) ([\d.]+)/.exec(
        cercle.secteurs[i].d
      )!;
      const a0 = Math.atan2(Number(p[2]) - CY, Number(p[1]) - CX);
      const a1 = Math.atan2(Number(p[4]) - CY, Number(p[3]) - CX);
      return (a1 - a0 + 4 * Math.PI) % (2 * Math.PI);
    };
    const poids = cercle.secteurs.map(
      (_, i) =>
        cercle.noeuds.filter((n) => n.famille === i && n.generation === 1).length +
        cercle.badges.filter((b) => b.famille === i).length
    );
    const lourde = poids.indexOf(Math.max(...poids));
    const legere = poids.indexOf(Math.min(...poids));
    expect(angle(lourde)).toBeGreaterThan(angle(legere));
    for (let i = 0; i < cercle.secteurs.length; i++) {
      expect(angle(i)).toBeGreaterThanOrEqual(SECTEUR_MIN - 0.03);
    }
  });

  it('est déterministe sur l\'export réel', () => {
    expect(cercleDu('hsk', 150).cercle).toEqual(cercleDu('hsk', 150).cercle);
  });

  it('garde la famille du moment et les familles les plus fournies', () => {
    const jour = 150;
    const cartes = progression('lire', jour);
    const posees = famillesDuCercle({
      index: indexExport,
      familles: toutes,
      cartes,
      nom: 'lire',
      jour,
      moment: '口'
    });
    expect(posees).toContain('口');
    expect(posees).toHaveLength(FAMILLES_CERCLE);
    const parFamille = new Map<string, number>();
    for (const k of cartes) {
      const r = racineDe.get(k.id);
      if (r !== undefined) parFamille.set(r, (parFamille.get(r) ?? 0) + 1);
    }
    const plusFournie = [...parFamille].sort((a, b) => b[1] - a[1])[0][0];
    expect(posees).toContain(plusFournie);
    expect(FAMILLES_FOURNIES).toBeLessThan(FAMILLES_CERCLE);
  });

  it('appelle proche à venir ce que les sept prochains jours posent', () => {
    const proches = new Set(prochesDuParcours(indexExport, 'lire', 10));
    for (const j of indexExport.parcours.lire.jours) {
      const cs = j.brique === null ? j.composes : [j.brique, ...j.composes];
      if (j.jour >= 10 && j.jour < 10 + JOURS_PROCHES) for (const c of cs) expect(proches.has(c)).toBe(true);
    }
    expect(proches.size).toBeGreaterThan(0);
    expect(prochesDuParcours(indexExport, 'lire', 10000)).toEqual([]);
  });

  it('ouvre l\'arbre de sa famille au toucher d\'une brique, d\'un caractère ou d\'un badge', () => {
    const ecran = readFileSync(new URL('Forest.svelte', import.meta.url), 'utf8');
    expect(ecran.match(/data-famille=\{(nd|b)\.famille\}/g)?.length).toBe(3);
    expect(ecran).toContain("closest('[data-famille]')");
  });

  it('garde assez de place sur l\'anneau pour chaque brique', () => {
    expect(FAMILLES_CERCLE * SECTEUR_MIN).toBeLessThanOrEqual(2 * Math.PI);
    expect(R_MEMBRE * 1.56 * ECHELLE).toBeGreaterThanOrEqual(14);
  });
});
