import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  ACQUIS_MIN,
  CHRONO_ASSEMBLAGE_MS,
  FLASH_MS,
  IDS,
  JEUX,
  LEURRES_ASSEMBLAGE,
  MINUTES_MAX,
  MINUTES_MIN,
  PAIRES_PAR_MINUTE,
  TOURS_ASSEMBLAGE,
  acquisDeDemo,
  ciblesAssemblage,
  constat,
  corpusDeJeu,
  disponibles,
  fini,
  jumeau,
  planifier,
  proches,
  propose,
  repondre,
  tour,
  type CorpusJeux,
  type Manche
} from './jeux';
import { lirePaires } from './questions';
import { emptyProgress, noterActivite, noterRevision, type Progress } from './session';
import { grade, newCard, RETOUR_MINUTES, SEUIL_DEBLOCAGE, type Outcome } from './srs';
import { POIDS, journal } from './tao';
import { VERSION_DONNEES, type Famille, type Fiche, type Foret, type Index, type Voisins } from './content';

/* ---------- corpus de test, en dur : aucun réseau, aucun fichier de contenu ---------- */

const GLOSES: Record<string, [string, string]> = {
  人: ['rén', 'personne'],
  入: ['rù', 'entrer'],
  天: ['tiān', 'ciel'],
  夫: ['fū', 'homme fait'],
  女: ['nǚ', 'femme'],
  子: ['zǐ', 'enfant'],
  好: ['hǎo', 'bon'],
  妈: ['mā', 'maman'],
  马: ['mǎ', 'cheval'],
  亻: ['rén', 'personne (à gauche)'],
  主: ['zhǔ', 'maître'],
  住: ['zhù', 'habiter'],
  王: ['wáng', 'roi'],
  丶: ['zhǔ', 'le point'],
  木: ['mù', 'arbre'],
  休: ['xiū', 'se reposer']
};

const DECOMPOSITIONS: Record<string, string[]> = {
  好: ['女', '子'],
  妈: ['女', '马'],
  住: ['亻', '主'],
  主: ['丶', '王'],
  休: ['亻', '木']
};

const PAIRES = [
  ['天', '夫'],
  ['人', '入'],
  ['王', '玉', '主']
];

const TRAITS = Object.keys(GLOSES);

const CORPUS: CorpusJeux = {
  acquis: ['好', '住', '妈', '天', '人', '女'],
  decompositions: DECOMPOSITIONS,
  formes: DECOMPOSITIONS,
  gloses: Object.fromEntries(Object.entries(GLOSES).map(([c, [pinyin, fr]]) => [c, { pinyin, fr }])),
  paires: PAIRES,
  traits: TRAITS
};

const MAINTENANT = new Date('2026-09-21T09:00:00Z');
const outcome = (o: Partial<Outcome> = {}): Outcome => ({
  correct: true,
  tries: 0,
  seconds: 3,
  ...o
});

/** Joue une manche en entier, une réponse par tour. */
function jouer(m: Manche, reponse: (t: NonNullable<ReturnType<typeof tour>>) => string[]): Manche {
  let courante = m;
  while (!fini(courante)) {
    const t = tour(courante);
    if (t === null) break;
    courante = repondre(courante, reponse(t), outcome()).manche;
  }
  return courante;
}

const assembler = JEUX.assembler;
const jumeaux = JEUX.jumeaux;

/* ---------- le contrat commun ---------- */

describe('le contrat commun d’un jeu', () => {
  it('donne un titre, ce qu’il fait lire en une phrase, et une durée de 1 à 3 minutes', () => {
    for (const id of IDS) {
      const j = JEUX[id];
      expect(j.id).toBe(id);
      expect(j.titre).not.toBe('');
      expect(j.lit).not.toBe('');
      expect(j.minutes).toBeGreaterThanOrEqual(MINUTES_MIN);
      expect(j.minutes).toBeLessThanOrEqual(MINUTES_MAX);
    }
  });

  it('prépare une manche reproductible : même graine, même manche', () => {
    const a = assembler.preparer(CORPUS, 'g');
    const b = assembler.preparer(CORPUS, 'g');
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  });

  it('ne prépare rien quand l’acquis ne permet pas d’y jouer', () => {
    const vide = { ...CORPUS, acquis: [] };
    expect(assembler.preparer(vide, 'g')).toBeNull();
    expect(jumeaux.preparer(vide, 'g')).toBeNull();
    expect(disponibles(vide, 'g')).toEqual([]);
    expect(disponibles(CORPUS, 'g')).toEqual([...IDS]);
  });

  it('rend des événements de révision notés par grade, et rien d’autre', () => {
    const m = assembler.preparer(CORPUS, 'g');
    if (!m) throw new Error('manche attendue');
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const r = assembler.repondre(m, t.reponse, outcome({ seconds: 2 }));
    expect(Object.keys(r.evenement).sort()).toEqual(['c', 'correct', 'seconds', 'tries']);
    expect(r.evenement).toEqual({ c: t.c, correct: true, tries: 0, seconds: 2 });
    expect(r.note).toBe(grade(r.evenement));
    expect(r.manche.evenements).toEqual([r.evenement]);
  });

  it('avance d’un tour à chaque réponse, et se termine', () => {
    const m = assembler.preparer(CORPUS, 'g');
    if (!m) throw new Error('manche attendue');
    const finie = jouer(m, (t) => t.reponse);
    expect(finie.i).toBe(m.tours.length);
    expect(fini(finie)).toBe(true);
    expect(tour(finie)).toBeNull();
    expect(() => repondre(finie, 'x', outcome())).toThrow();
  });

  it('finit par un constat sans score : des nombres réels, rien de plus', () => {
    const m = assembler.preparer(CORPUS, 'g');
    if (!m) throw new Error('manche attendue');
    const finie = jouer(m, (t) => t.reponse);
    const ligne = assembler.constat(finie);
    expect(ligne).toBe(`${finie.tours.length} caractères revus, ${finie.tours.length} assemblés.`);
    expect(ligne).not.toMatch(/point|score|niveau|record|classement|coffre|seconde|minute|bravo/i);
  });

  it('constate aussi une manche ratée, sans reproche', () => {
    const m = jumeaux.preparer(CORPUS, 'g');
    if (!m) throw new Error('manche attendue');
    const finie = jouer(m, () => ['?']);
    expect(jumeaux.constat(finie)).toBe(
      `${finie.tours.length} caractères revus, aucune paire distinguée.`
    );
    expect(constat({ ...m, tours: [], evenements: [] })).toBe('Rien de revu cette fois.');
  });
});

/* ---------- l'acquis : les cartes d'abord, la démonstration à défaut ---------- */

describe('l’entrée d’un jeu : l’acquis', () => {
  const voisins: Voisins = {
    version: 'test',
    source: 'test',
    norme: 'GF 0014-2009',
    voisins: [
      { c: '住', pinyin: 'zhù', fr: 'habiter', parts: ['亻', '主'] },
      { c: '主', pinyin: 'zhǔ', fr: 'maître', parts: ['丶', '王'] }
    ]
  };
  const foret: Foret = {
    version: 'test',
    source: 'test',
    norme: 'GF 0014-2009',
    centre: '字',
    familles: [
      {
        c: '女',
        pinyin: 'nǚ',
        fr: 'femme',
        avancement: 1,
        membres: [
          { c: '好', pinyin: 'hǎo', fr: 'bon', avancement: 1, membres: [] },
          { c: '妈', pinyin: 'mā', fr: 'maman', avancement: 0.5, membres: [] }
        ]
      }
    ]
  };

  it('ne garde que les cartes dont la stabilité dépasse le seuil', () => {
    const cartes = [
      { c: '住', stabilite: SEUIL_DEBLOCAGE },
      { c: '主', stabilite: SEUIL_DEBLOCAGE - 1 },
      { c: '好', stabilite: 40 },
      { c: '女', stabilite: 12 },
      { c: '人', stabilite: 9 },
      { c: '天', stabilite: 8 },
      { c: '大', stabilite: 0 }
    ];
    const c = corpusDeJeu({ voisins, cartes, traits: TRAITS });
    expect(c.acquis).toEqual(['住', '好', '女', '人', '天']);
    expect(c.acquis).not.toContain('主');
    expect(c.acquis).not.toContain('大');
  });

  it('suit le seuil qu’on lui donne', () => {
    const cartes = [
      { c: '住', stabilite: 3 },
      { c: '好', stabilite: 3 }
    ];
    expect(corpusDeJeu({ cartes, seuil: 2 }).acquis).toEqual(['住', '好']);
    expect(corpusDeJeu({ cartes, seuil: 4, foret: null }).acquis).toEqual([]);
  });

  it('se replie sur les caractères acquis de la forêt de démonstration', () => {
    const c = corpusDeJeu({ voisins, foret, cartes: [], traits: TRAITS });
    /* Repli documenté : la progression ne porte pas encore ACQUIS_MIN cartes stables. */
    expect(c.acquis).toEqual(['女', '好']);
    expect(acquisDeDemo(foret)).toEqual(['女', '好']);
    expect(acquisDeDemo(null)).toEqual([]);
  });

  it('abandonne le repli dès que la progression suffit', () => {
    const cartes = Array.from({ length: ACQUIS_MIN }, (_, i) => ({
      c: `c${i}`,
      stabilite: SEUIL_DEBLOCAGE + 1
    }));
    const c = corpusDeJeu({ foret, cartes });
    expect(c.acquis).toHaveLength(ACQUIS_MIN);
    expect(c.acquis).not.toContain('女');
  });

  it('ne garde en décomposition que ce que le contenu donne, la forêt ne sert qu’à la ressemblance', () => {
    const c = corpusDeJeu({ voisins, foret, traits: TRAITS });
    expect(c.decompositions['住']).toEqual(['亻', '主']);
    expect(c.decompositions['好']).toBeUndefined();
    expect(c.formes['好']).toEqual(['女']);
  });
});

/* ---------- jeu 1 : assembler contre la montre ---------- */

describe('Assembler contre la montre', () => {
  const m = assembler.preparer(CORPUS, 'g');
  if (!m) throw new Error('manche attendue');

  it('borne le tour à huit secondes, et ne pose pas plus que la manche', () => {
    expect(assembler.chrono).toBe(CHRONO_ASSEMBLAGE_MS);
    expect(m.tours.length).toBeLessThanOrEqual(TOURS_ASSEMBLAGE);
    expect(m.tours.length).toBeGreaterThan(0);
  });

  it('donne le sens et met les briques en vrac, les vraies plus deux leurres', () => {
    for (const t of m.tours) {
      const parts = DECOMPOSITIONS[t.c];
      expect(t.enonce).toContain(`« ${GLOSES[t.c][1]} »`);
      expect(t.reponse).toEqual(parts);
      expect(t.choix).toHaveLength(parts.length + LEURRES_ASSEMBLAGE);
      expect([...t.choix].sort()).toEqual([...new Set(t.choix)].sort());
      for (const p of parts) expect(t.choix).toContain(p);
    }
  });

  it('choisit des leurres visuellement proches des vraies briques', () => {
    const t = m.tours.find((x) => x.c === '住');
    if (!t) throw new Error('tour 住 attendu');
    const leurres = t.choix.filter((x) => !t.reponse.includes(x));
    /* 王 est du groupe à ne pas confondre de 主, 丶 est l’autre brique de 主. */
    expect(leurres).toEqual(['王', '丶']);
    expect(proches(['亻', '主'], Object.keys(GLOSES), CORPUS, 'g', 2, ['住', '亻', '主'])).toEqual([
      '王',
      '丶'
    ]);
  });

  it('ne met en vrac que des briques, jamais des caractères entiers', () => {
    const briques = new Set(Object.values(DECOMPOSITIONS).flat());
    for (const t of m.tours) {
      for (const choix of t.choix) expect(briques.has(choix)).toBe(true);
    }
  });

  it('ne propose que des caractères dont on a les traits', () => {
    const sansTraits = { ...CORPUS, traits: TRAITS.filter((c) => c !== '马') };
    expect(ciblesAssemblage(CORPUS)).toContain('妈');
    expect(ciblesAssemblage(sansTraits)).not.toContain('妈');
    const autre = assembler.preparer(sansTraits, 'g');
    for (const t of autre?.tours ?? []) {
      for (const c of [t.c, ...t.choix]) expect(sansTraits.traits).toContain(c);
    }
  });

  it('exige l’ordre d’écriture', () => {
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    expect(t.ordre).toBe(true);
    expect(repondre(m, t.reponse, outcome()).correct).toBe(true);
    expect(repondre(m, [...t.reponse].reverse(), outcome()).correct).toBe(false);
    expect(repondre(m, t.reponse.slice(0, 1), outcome()).correct).toBe(false);
  });

  it('erreur : la réponse est montrée, et la carte revient dans dix minutes', () => {
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const r = repondre(m, [...t.reponse].reverse(), outcome({ tries: 1, seconds: 8 }));
    expect(r.correct).toBe(false);
    expect(r.evenement.correct).toBe(false);
    expect(r.montre).toBe(true);
    expect(r.note).toBe(Rating.Again);
    const cartes = planifier([newCard(t.c, MAINTENANT)], r.evenement, MAINTENANT);
    const due = cartes[0].card.due.getTime() - MAINTENANT.getTime();
    expect(due).toBe(RETOUR_MINUTES * 60_000);
  });

  it('chronomètre écoulé : la réponse est vide, donc fausse', () => {
    const r = repondre(m, [], outcome({ correct: false, seconds: 8 }));
    expect(r.correct).toBe(false);
    expect(r.note).toBe(Rating.Again);
  });

  it('le chronomètre borne le tour, il ne note pas : la note ne vient que de grade', () => {
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const vite = repondre(m, t.reponse, outcome({ seconds: 2 }));
    const lent = repondre(m, t.reponse, outcome({ seconds: 7 }));
    expect(vite.note).toBe(grade({ correct: true, tries: 0, seconds: 2 }));
    expect(lent.note).toBe(grade({ correct: true, tries: 0, seconds: 7 }));
    /* Rien d’autre que l’outcome ne passe dans l’événement : aucun bonus de vitesse. */
    expect(vite.evenement).toEqual({ c: t.c, correct: true, tries: 0, seconds: 2 });
    expect(lent.evenement).toEqual({ c: t.c, correct: true, tries: 0, seconds: 7 });
    expect(assembler.constat(vite.manche)).toBe(assembler.constat(lent.manche));
  });
});

/* ---------- jeu 2 : les jumeaux ---------- */

describe('Les jumeaux', () => {
  const m = jumeaux.preparer(CORPUS, 'g');
  if (!m) throw new Error('manche attendue');

  it('flashe 700 ms et n’a pas de chronomètre de réponse', () => {
    expect(FLASH_MS).toBe(700);
    expect(jumeaux.chrono).toBe(0);
  });

  it('oppose deux caractères proches, et demande le sens ou le pinyin', () => {
    for (const t of m.tours) {
      expect(t.choix).toHaveLength(2);
      expect(t.choix).toContain(t.c);
      expect(t.ordre).toBe(false);
      const [pinyin, fr] = GLOSES[t.c];
      expect(t.enonce === `Lequel veut dire « ${fr} » ?` || t.enonce === `Lequel se lit ${pinyin} ?`).toBe(
        true
      );
      for (const c of t.choix) expect(CORPUS.traits).toContain(c);
    }
  });

  it('passe les paires à ne pas confondre d’abord, la ressemblance ensuite', () => {
    const paires = m.tours.filter((t) => t.paire);
    expect(paires.length).toBeGreaterThan(0);
    const rang = m.tours.map((t) => t.paire);
    expect(rang.indexOf(false) === -1 || rang.lastIndexOf(true) < rang.indexOf(false)).toBe(true);
    expect(jumeau('天', CORPUS, 'g')).toBe('夫');
    expect(jumeau('人', CORPUS, 'g')).toBe('入');
  });

  it('prend le plus proche par composants quand il n’y a pas de paire', () => {
    expect(jumeau('住', CORPUS, 'g')).toBe('休');
    expect(jumeau('好', CORPUS, 'g')).toBe('妈');
  });

  it('ne pose rien quand rien n’est assez proche', () => {
    const isole: CorpusJeux = {
      ...CORPUS,
      acquis: ['木'],
      decompositions: {},
      formes: {},
      paires: []
    };
    expect(jumeau('木', isole, 'g')).toBeNull();
    expect(jumeaux.preparer(isole, 'g')).toBeNull();
  });

  it('ne pose pas deux fois la même paire', () => {
    const vues = m.tours.map((t) => [t.c, ...t.choix.filter((x) => x !== t.c)].sort().join(''));
    expect(new Set(vues).size).toBe(vues.length);
  });

  it('pose quinze paires par minute au plus', () => {
    const gros: CorpusJeux = {
      ...CORPUS,
      acquis: Array.from({ length: 40 }, (_, i) => `x${i}`),
      decompositions: {},
      formes: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`x${i}`, ['女']])),
      gloses: Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [`x${i}`, { pinyin: `p${i}`, fr: `sens ${i}` }])
      ),
      traits: Array.from({ length: 40 }, (_, i) => `x${i}`)
    };
    const grosse = jumeaux.preparer(gros, 'g');
    expect(grosse?.tours.length).toBe(PAIRES_PAR_MINUTE);
    expect(grosse?.tours.length).toBeLessThanOrEqual(jumeaux.minutes * PAIRES_PAR_MINUTE);
  });
});

/* ---------- ce que la manche rend à la progression ---------- */

describe('ce qu’un jeu rend à la progression', () => {
  it('range l’événement en révision et le note sur la carte', () => {
    const jour = '2026-09-21';
    let p: Progress = emptyProgress(jour);
    const m = assembler.preparer(CORPUS, 'g');
    if (!m) throw new Error('manche attendue');
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const r = repondre(m, t.reponse, outcome({ seconds: 2 }));
    p = noterRevision(p, jour, r.evenement);
    p = { ...p, cartes: planifier(p.cartes, r.evenement, MAINTENANT) };
    expect(p.revisions).toEqual([r.evenement]);
    expect(p.cartes.map((c) => c.id)).toEqual([t.c]);
    expect(p.cartes[0].card.due.getTime()).toBeGreaterThan(MAINTENANT.getTime());
    expect(p.cartes[0].history).toHaveLength(1);
    expect(p.cartes[0].history[0].rating).toBe(r.note);
  });

  it('replanifie une carte déjà connue sans en créer une seconde', () => {
    const cartes = planifier([newCard('好', MAINTENANT)], { c: '好', correct: true, tries: 0, seconds: 2 }, MAINTENANT);
    expect(cartes).toHaveLength(1);
    const suite = planifier(cartes, { c: '住', correct: true, tries: 0, seconds: 2 }, MAINTENANT);
    expect(suite.map((c) => c.id)).toEqual(['好', '住']);
  });

  it('compte une activité « jeu » pour Tao, jamais une activité inventée', () => {
    const jour = '2026-09-21';
    const p = noterActivite(emptyProgress(jour), jour, 'jeu');
    expect(p.tao.activites).toEqual([{ jour, type: 'jeu' }]);
    expect(p.tao.croissance).toBe(POIDS.jeu);
    expect(journal(p.tao.activites, jour)).toBe("Aujourd'hui, un jeu.");
  });

  it('Tao propose un jeu après trois activités identiques d’affilée', () => {
    const jour = '2026-09-21';
    let p = emptyProgress(jour);
    expect(propose(p, jour)).toBe(false);
    p = noterActivite(p, jour, 'revision');
    p = noterActivite(p, jour, 'revision');
    expect(propose(p, jour)).toBe(false);
    p = noterActivite(p, jour, 'revision');
    expect(propose(p, jour)).toBe(true);
    /* Le jeu joué change l’activité : elle ne réclame plus. */
    p = noterActivite(p, jour, 'jeu');
    expect(propose(p, jour)).toBe(false);
  });
});

/* ---------- le contenu réellement servi avec l'app ---------- */

describe('le corpus des données de démonstration', () => {
  const lire = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
  const voisins = lire('../../public/data/demo/voisins.json') as Voisins;
  const foret = lire('../../public/data/demo/foret.json') as Foret;
  const paires = lirePaires(lire('../../public/data/demo/paires.json'));
  const traits = Object.keys(lire('../../public/strokes-demo.json') as Record<string, unknown>);
  const familles = [
    lire('../../public/data/demo/familles/人.json') as Famille,
    lire('../../public/data/demo/familles/主.json') as Famille
  ];
  const corpus = corpusDeJeu({ familles, voisins, foret, paires, traits, cartes: [] });

  it('rend les deux jeux jouables avec le contenu servi', () => {
    expect(corpus.acquis.length).toBeGreaterThanOrEqual(ACQUIS_MIN);
    expect(disponibles(corpus, '2026-09-21')).toEqual([...IDS]);
  });

  it('ne propose aucun caractère dont on n’a pas les traits', () => {
    for (const id of IDS) {
      const m = JEUX[id].preparer(corpus, '2026-09-21');
      for (const t of m?.tours ?? []) {
        for (const c of [t.c, ...t.choix, ...t.reponse]) expect(traits).toContain(c);
      }
    }
  });

  it('n’assemble que des décompositions canoniques du contenu', () => {
    const m = assembler.preparer(corpus, '2026-09-21');
    for (const t of m?.tours ?? []) {
      const source =
        (familles.flatMap((f) => f.fiches) as Fiche[]).find((x) => x.c === t.c)?.parts ??
        voisins.voisins.find((x) => x.c === t.c)?.parts;
      expect(t.reponse).toEqual(source);
    }
  });
});

/* ---------- les paires de l'export, jouables dès que les tracés sont là ---------- */

describe("les paires à ne pas confondre de l'export", () => {
  const dossier = `../../public/data/${VERSION_DONNEES}`;
  const indexExport = JSON.parse(
    readFileSync(new URL(`${dossier}/index.json`, import.meta.url), 'utf8')
  ) as Index;
  const pairesExport = lirePaires(
    JSON.parse(readFileSync(new URL(`${dossier}/paires.json`, import.meta.url), 'utf8'))
  );
  /** Les fiches et les tracés des familles qui portent les caractères des paires. */
  const caracteresDesPaires = [...new Set(pairesExport.flat())];
  const famillesLues = indexExport.familles.flatMap((f) => {
    const fam = JSON.parse(
      readFileSync(new URL(`${dossier}/${f.fichier}`, import.meta.url), 'utf8')
    ) as Famille;
    return fam.fiches.some((x) => caracteresDesPaires.includes(x.c)) ? [{ f, fam }] : [];
  });
  const fichesLues = famillesLues.flatMap(({ fam }) => fam.fiches);
  const traitsLus = famillesLues.flatMap(({ f }) =>
    Object.keys(
      (
        JSON.parse(readFileSync(new URL(`${dossier}/${f.traits}`, import.meta.url), 'utf8')) as {
          traits: Record<string, unknown>;
        }
      ).traits
    )
  );

  it('porte des groupes, tous dessinables depuis les tracés de leur famille', () => {
    expect(pairesExport.length).toBeGreaterThan(0);
    for (const groupe of pairesExport) {
      expect(groupe.length).toBeGreaterThanOrEqual(2);
      for (const c of groupe) expect(traitsLus).toContain(c);
    }
  });

  it('devient jouable aux jumeaux dès que les caractères ont leurs traits', () => {
    const corpusExport = corpusDeJeu({
      fiches: fichesLues,
      paires: pairesExport,
      traits: traitsLus,
      /* L'acquis : les caractères des paires, déjà stables. */
      cartes: caracteresDesPaires.map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 }))
    });
    const manche = JEUX.jumeaux.preparer(corpusExport, '2026-03-02');
    expect(manche).not.toBeNull();
    const opposees = (manche as Manche).tours.filter((t) => t.paire);
    expect(opposees.length).toBeGreaterThan(0);
    /* Une paire opposée ne tire que dans son groupe : jamais deux inconnus. */
    for (const t of opposees) {
      const groupe = pairesExport.find((g) => g.includes(t.c));
      expect(groupe).toBeDefined();
      for (const choix of t.choix) expect(groupe).toContain(choix);
    }
    /* Les paires passent devant : elles ouvrent la manche. */
    expect((manche as Manche).tours[0].paire).toBe(true);
  });

  it('ne montre jamais un caractère dont on n’a pas les traits', () => {
    const sansTraits = corpusDeJeu({
      fiches: fichesLues,
      paires: pairesExport,
      traits: [],
      cartes: caracteresDesPaires.map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 }))
    });
    expect(JEUX.jumeaux.preparer(sansTraits, '2026-03-02')).toBeNull();
  });
});
