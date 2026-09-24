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
  LIMITE_CHAINE_MS,
  MESSAGE_MAX,
  MESSAGE_MIN,
  MINUTES_MAX,
  MINUTES_MIN,
  PAIRES_PAR_MINUTE,
  PROPOSITIONS_CHAINE,
  TOURS_ASSEMBLAGE,
  TOURS_COQUILLE,
  acquisDeDemo,
  chaine,
  chaines,
  ciblesAssemblage,
  clore,
  constat,
  contient,
  corpusDeJeu,
  disponibles,
  fini,
  jumeau,
  planifier,
  proches,
  prolongements,
  propose,
  repondre,
  ESSAIS_DEVINETTE,
  devinetteAAnnoncer,
  devinetteDe,
  devinetteDuJour,
  devinettesPossibles,
  essayer,
  nomDeBrique,
  signes,
  tour,
  corpusVide,
  type CorpusJeux,
  type Lanternes,
  type Manche
} from './jeux';
import { lirePaires } from './questions';
import { emptyProgress, noterActivite, noterRevision, type Progress } from './session';
import { grade, newCard, RETOUR_MINUTES, SEUIL_DEBLOCAGE, type Outcome } from './srs';
import { POIDS, journal } from './tao';
import {
  VERSION_DONNEES,
  surcoucher,
  type Devinette,
  type Devinettes,
  type Famille,
  type Fiche,
  type Foret,
  type Index,
  type Voisins
} from './content';

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
  traits: TRAITS,
  /* Aucun texte : la coquille n'a pas de message à poser. */
  textes: []
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
    /* Sans mot ni phrase acquis, la coquille se tait ; les trois autres se jouent. */
    expect(disponibles(CORPUS, 'g')).toEqual(['assembler', 'jumeaux', 'chaine']);
  });

  it('dit une ligne neutre pour chaque jeu qui ne peut pas encore se jouer', () => {
    for (const id of IDS) {
      const ligne = JEUX[id].indisponible;
      expect(ligne).not.toBe('');
      expect(ligne).not.toMatch(/!|dommage|hélas|désolé|point|score|vie|classement|coffre/i);
    }
  });

  it('ne met aucune limite de temps qui dépasse trois minutes', () => {
    for (const id of IDS) {
      expect(JEUX[id].limite).toBeGreaterThanOrEqual(0);
      expect(JEUX[id].limite).toBeLessThanOrEqual(MINUTES_MAX * 60_000);
    }
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

  it('rend les deux premiers jeux jouables avec le contenu de démonstration seul', () => {
    expect(corpus.acquis.length).toBeGreaterThanOrEqual(ACQUIS_MIN);
    /* La chaîne et la coquille lisent l'export : ses parts, et ses fiches surcouchées. */
    expect(disponibles(corpus, '2026-09-21')).toEqual(['assembler', 'jumeaux']);
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

/* ---------- jeu 3 : la chaîne ---------- */

/**
 * L'exemple de `docs/jeux.md` : 人 → 大 → 天 → 吞. Les décompositions sont celles de la
 * spécification (chaque caractère nomme le précédent parmi ses parts), et les leurres
 * possibles sont des caractères acquis qui ne contiennent aucun maillon.
 */
const DECOMPOSITIONS_CHAINE: Record<string, string[]> = {
  大: ['一', '人'],
  天: ['一', '大'],
  吞: ['天', '口'],
  夫: ['二', '人'],
  好: ['女', '子'],
  明: ['日', '月'],
  休: ['亻', '木']
};

const CHAINE: CorpusJeux = {
  acquis: ['人', '大', '天', '吞', '夫', '口', '女', '好', '日', '明', '木', '王'],
  decompositions: DECOMPOSITIONS_CHAINE,
  formes: DECOMPOSITIONS_CHAINE,
  gloses: {},
  paires: PAIRES,
  traits: ['人', '大', '天', '吞', '夫', '口', '女', '好', '日', '明', '木', '王', '休'],
  textes: []
};

describe('La chaîne', () => {
  const lachaine = JEUX.chaine;
  const m = lachaine.preparer(CHAINE, 'g');
  if (!m) throw new Error('manche attendue');
  const dernier = (t: NonNullable<ReturnType<typeof tour>>): string => {
    const suite = t.suite ?? [];
    return suite[suite.length - 1];
  };

  it('part d’une brique acquise et suit l’exemple de la spécification', () => {
    expect(chaine(CHAINE, 'g')).toEqual(['人', '大', '天', '吞']);
    expect(chaines(CHAINE, 'g')[0]).toEqual(['人', '大', '天', '吞']);
    expect(m.tours.slice(0, 3).map((t) => t.c)).toEqual(['大', '天', '吞']);
    expect(m.tours[0].suite).toEqual(['人']);
    expect(m.tours[2].suite).toEqual(['人', '大', '天']);
  });

  it('chaque maillon contient le précédent comme composant', () => {
    for (const t of m.tours) expect(contient(t.c, dernier(t), CHAINE)).toBe(true);
  });

  it('lit les parts descendues de l’export : 可 d’un seul tenant dans 哥', () => {
    const plat: CorpusJeux = {
      ...CHAINE,
      acquis: ['口', '可', '哥', '歌'],
      decompositions: {
        可: ['丁', '口'],
        哥: ['丁', '口', '丁', '口'],
        歌: ['丁', '口', '丁', '口', '欠'],
        叮: ['口', '丁']
      },
      traits: ['口', '可', '哥', '歌', '叮']
    };
    expect(contient('哥', '可', plat)).toBe(true);
    expect(contient('歌', '哥', plat)).toBe(true);
    expect(contient('可', '口', plat)).toBe(true);
    /* 叮 porte 口 et 丁, mais pas 可 : l'ordre d'écriture compte. */
    expect(contient('叮', '可', plat)).toBe(false);
    expect(contient('可', '哥', plat)).toBe(false);
    expect(chaine(plat, 'g')).toEqual(['口', '可', '哥', '歌']);
  });

  it('pose quatre propositions, dont une seule contient le dernier caractère', () => {
    for (const t of m.tours) {
      expect(t.choix).toHaveLength(PROPOSITIONS_CHAINE);
      expect(new Set(t.choix).size).toBe(PROPOSITIONS_CHAINE);
      expect(t.reponse).toEqual([t.c]);
      expect(t.choix.filter((x) => contient(x, dernier(t), CHAINE))).toEqual([t.c]);
    }
    /* 夫 contient 人 : il ne peut pas servir de leurre après 人. */
    expect(m.tours[0].choix).not.toContain('夫');
  });

  it('prend ses leurres dans l’acquis, par ressemblance, jamais sans traits', () => {
    for (const t of m.tours) {
      for (const x of t.choix) {
        expect(CHAINE.acquis).toContain(x);
        expect(CHAINE.traits).toContain(x);
      }
    }
    const sansTraits = { ...CHAINE, traits: CHAINE.traits.filter((c) => c !== '吞') };
    expect(chaine(sansTraits, 'g')).toEqual(['人', '大', '天']);
    const t = m.tours[0];
    const leurres = t.choix.filter((x) => x !== t.c);
    const candidats = CHAINE.acquis.filter(
      (x) => !['人', '大', '天', '吞', '夫'].includes(x)
    );
    expect(leurres.sort()).toEqual(
      proches([t.c], candidats, CHAINE, `g/${t.c}`, PROPOSITIONS_CHAINE - 1).sort()
    );
  });

  it('finit sur une impasse : aucun caractère acquis ne prolonge le dernier maillon', () => {
    const suite = chaine(CHAINE, 'g');
    const fin = suite[suite.length - 1];
    expect(prolongements(fin, CHAINE).filter((x) => !suite.includes(x))).toEqual([]);
    /* L'acquis borne la chaîne : sans 吞, elle s'arrête à 天. */
    const moins = { ...CHAINE, acquis: CHAINE.acquis.filter((c) => c !== '吞') };
    expect(chaine(moins, 'g')).toEqual(['人', '大', '天']);
    /* Rien ne contient rien : pas de chaîne, pas de manche. */
    const plat = { ...CHAINE, decompositions: {}, formes: {} };
    expect(chaine(plat, 'g')).toEqual([]);
    expect(lachaine.preparer(plat, 'g')).toBeNull();
  });

  it('s’arrête après trois minutes, où qu’elle en soit', () => {
    expect(lachaine.limite).toBe(LIMITE_CHAINE_MS);
    expect(LIMITE_CHAINE_MS).toBe(3 * 60_000);
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const un = repondre(m, t.reponse, outcome()).manche;
    const close = clore(un);
    expect(fini(close)).toBe(true);
    expect(close.evenements).toHaveLength(1);
    expect(lachaine.constat(close)).toBe('Chaîne de 2, 1 maillon trouvé.');
    expect(lachaine.constat(clore(m))).toBe('Rien de revu cette fois.');
  });

  it('note chaque maillon par grade, sur le caractère du maillon', () => {
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const r = repondre(m, t.c, outcome({ seconds: 4 }));
    expect(r.evenements).toEqual([{ c: t.c, correct: true, tries: 0, seconds: 4, leurres: [] }]);
    expect(r.note).toBe(grade(r.evenement));
    const leurre = t.choix.find((x) => x !== t.c) ?? '';
    const faux = repondre(m, leurre, outcome({ seconds: 4 }));
    /* Le leurre pris accompagne l'événement : les pièges déjoués le lisent. */
    expect(faux.evenement).toEqual({ c: t.c, correct: false, tries: 0, seconds: 4, leurres: [leurre] });
    expect(faux.note).toBe(Rating.Again);
    expect(faux.montre).toBe(true);
  });

  it('a pour constat sa longueur, sans score ni vie : un maillon manqué ne la coupe pas', () => {
    /* Après 人 → 大 → 天 → 吞, l'impasse : deux autres chaînes, 日 → 明 et 女 → 好. */
    expect(chaines(CHAINE, 'g').map((x) => x.length)).toEqual([4, 2, 2]);
    const juste = jouer(m, (t) => t.reponse);
    expect(lachaine.constat(juste)).toBe('3 chaînes, la plus longue de 4, 5 maillons trouvés.');
    let rate = m;
    rate = repondre(rate, '?', outcome()).manche;
    rate = jouer(rate, (t) => t.reponse);
    expect(fini(rate)).toBe(true);
    expect(lachaine.constat(rate)).toBe('3 chaînes, la plus longue de 4, 4 maillons trouvés.');
    expect(lachaine.constat(rate)).not.toMatch(/point|score|vie|record|classement|coffre|bravo/i);
  });
});

/* ---------- jeu 4 : la coquille ---------- */

/** Les mots et la phrase des fiches de démonstration (`data/demo/familles/`). */
const TEXTES_DEMO = ['我住在北京。', '住在', '记住', '天天'];

const COQUILLE: CorpusJeux = {
  acquis: ['我', '住', '在', '北', '京', '天', '夫', '人', '女', '好'],
  decompositions: { 住: ['亻', '主'], 好: ['女', '子'], 夫: ['二', '人'], 天: ['一', '大'] },
  formes: { 住: ['亻', '主'], 好: ['女', '子'] },
  gloses: {},
  paires: PAIRES,
  traits: ['我', '住', '在', '北', '京', '天', '夫', '人', '入', '女', '好', '一', '大', '二', '记'],
  textes: TEXTES_DEMO
};

describe('La coquille', () => {
  const coquille = JEUX.coquille;
  const m = coquille.preparer(COQUILLE, 'g');
  if (!m) throw new Error('manche attendue');
  const intrus = (t: NonNullable<ReturnType<typeof tour>>): number =>
    t.choix.findIndex((x) => x === t.reponse[0]);

  it('compose un message de six à douze caractères, tous acquis hors l’intrus', () => {
    expect(m.tours.length).toBeGreaterThan(0);
    expect(m.tours.length).toBeLessThanOrEqual(TOURS_COQUILLE);
    for (const t of m.tours) {
      expect(t.choix.length).toBeGreaterThanOrEqual(MESSAGE_MIN);
      expect(t.choix.length).toBeLessThanOrEqual(MESSAGE_MAX);
      const k = intrus(t);
      t.choix.forEach((x, i) => {
        if (i !== k) expect(COQUILLE.acquis).toContain(x);
        expect(COQUILLE.traits).toContain(x);
      });
    }
  });

  it('n’écrit rien : le message est fait des mots et phrases du contenu, entiers', () => {
    const permis = TEXTES_DEMO.map((x) => signes(x).join(''));
    for (const t of m.tours) {
      const original = t.choix.map((x, i) => (i === intrus(t) ? t.c : x));
      const coupes = [...(t.coupes ?? []), original.length];
      expect(coupes[0]).toBe(0);
      for (let k = 0; k + 1 < coupes.length; k++) {
        expect(permis).toContain(original.slice(coupes[k], coupes[k + 1]).join(''));
      }
    }
  });

  it('glisse un seul intrus, tiré du groupe à ne pas confondre du caractère remplacé', () => {
    for (const t of m.tours) {
      const [faux] = t.reponse;
      expect(t.choix.filter((x) => x === faux)).toHaveLength(1);
      expect(t.c).not.toBe(faux);
      expect(PAIRES.some((g) => g.includes(t.c) && g.includes(faux))).toBe(true);
      expect(t.paire).toBe(true);
    }
    /* Dans ce corpus, seul 天 a un jumeau : 夫 pour 天, l'exemple de la spécification. */
    expect(m.tours.every((t) => t.c === '天' && t.reponse[0] === '夫')).toBe(true);
  });

  it('se déclare indisponible sans texte, d’une ligne neutre', () => {
    const muet = { ...COQUILLE, textes: [] };
    expect(coquille.preparer(muet, 'g')).toBeNull();
    expect(disponibles(muet, 'g')).not.toContain('coquille');
    /* Un texte dont un caractère n'est pas acquis ne compte pas : 记 ne l'est pas. */
    const nonAcquis = { ...COQUILLE, textes: ['记住'] };
    expect(coquille.preparer(nonAcquis, 'g')).toBeNull();
    expect(coquille.indisponible).toBe(
      'Elle s’ouvre quand les deux caractères d’une paire à ne pas confondre sont acquis.'
    );
  });

  it('n’aligne jamais des caractères sans suite : sans texte, les paires seules ne font pas un message', () => {
    const paires = [['己', '已', '巳'], ['天', '夫'], ['日', '曰'], ['人', '入'], ['土', '士'], ['王', '玉', '主']];
    const seul: CorpusJeux = {
      ...COQUILLE,
      acquis: paires.flat(),
      paires,
      traits: paires.flat(),
      textes: []
    };
    expect(coquille.preparer(seul, 'g')).toBeNull();
  });

  it('ne piège qu’avec un intrus acquis : sans 夫, pas de coquille sur 天', () => {
    const sansFu = { ...COQUILLE, acquis: COQUILLE.acquis.filter((c) => c !== '夫') };
    expect(coquille.preparer(sansFu, 'g')).toBeNull();
  });

  it('corrige par les briques : l’intrus et le caractère remplacé, décomposés', () => {
    const t = m.tours[0];
    expect(t.correction).toEqual([
      { c: '夫', briques: ['二', '人'] },
      { c: '天', briques: ['一', '大'] }
    ]);
    /* Une décomposition qu'on ne sait pas dessiner n'est pas montrée : le caractère seul. */
    const sansBriques = { ...COQUILLE, traits: COQUILLE.traits.filter((c) => c !== '二') };
    const autre = coquille.preparer(sansBriques, 'g');
    expect(autre?.tours[0].correction?.[0]).toEqual({ c: '夫', briques: ['夫'] });
  });

  it('note la manche par grade, sur le caractère remplacé et sur l’intrus', () => {
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    const r = coquille.repondre(m, t.reponse[0], outcome({ seconds: 5 }));
    expect(r.correct).toBe(true);
    expect(r.evenements).toEqual([
      { c: '天', correct: true, tries: 0, seconds: 5, leurres: [] },
      { c: '夫', correct: true, tries: 0, seconds: 5, leurres: [] }
    ]);
    expect(r.note).toBe(grade(r.evenements[0]));
    expect(r.manche.evenements).toEqual(r.evenements);
    const faux = coquille.repondre(m, t.choix.find((x) => x !== t.reponse[0]) ?? '', outcome());
    expect(faux.correct).toBe(false);
    expect(faux.montre).toBe(true);
    expect(faux.evenements.map((e) => [e.c, e.correct])).toEqual([
      ['天', false],
      ['夫', false]
    ]);
    /* L'intrus n'a pas été vu : l'un a été lu pour l'autre, dans les deux sens. */
    expect(faux.evenements.map((e) => e.leurres)).toEqual([['夫'], ['天']]);
    expect(faux.note).toBe(Rating.Again);
  });

  it('constate les caractères revus, une fois chacun, et les coquilles trouvées', () => {
    const finie = jouer(m, (t) => t.reponse);
    expect(coquille.constat(finie)).toBe(
      `2 caractères revus, ${finie.tours.length === 1 ? '1 coquille trouvée' : `${finie.tours.length} coquilles trouvées`}.`
    );
  });
});

/* ---------- les deux nouveaux jeux, joués sur l'export servi avec l'app ---------- */

describe('la chaîne et la coquille sur le contenu servi (export 0.1.0)', () => {
  const lire = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
  const dossier = `../../public/data/${VERSION_DONNEES}`;
  const indexExport = lire(`${dossier}/index.json`) as Index;
  const famillesExport = indexExport.familles.map(
    (f) => lire(`${dossier}/${f.fichier}`) as Famille
  );
  const traitsExport = indexExport.familles.flatMap((f) =>
    Object.keys((lire(`${dossier}/${f.traits}`) as { traits: Record<string, unknown> }).traits)
  );
  const traitsDemo = Object.keys(lire('../../public/strokes-demo.json') as Record<string, unknown>);
  const traits = [...new Set([...traitsExport, ...traitsDemo])];
  const paires = lirePaires(lire(`${dossier}/paires.json`));
  const foret = lire('../../public/data/demo/foret.json') as Foret;
  const voisins = lire('../../public/data/demo/voisins.json') as Voisins;
  /* La surcouche telle que `content.toutesLesFiches` la fait : les familles 人 et 主. */
  const demo = new Map<string, Fiche>();
  for (const f of ['人', '主']) {
    const fam = lire(`../../public/data/demo/familles/${f}.json`) as Famille;
    for (const x of fam.fiches) if (!demo.has(x.c)) demo.set(x.c, x);
  }
  const fiches = famillesExport.flatMap((f) =>
    f.fiches.map((x) => surcoucher(x, demo.get(x.c) ?? null))
  );
  const stables = (cs: string) =>
    [...cs].map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 }));

  it('lit la chaîne dans les parts de l’export : 口 → 可 → 哥 → 歌', () => {
    const corpus = corpusDeJeu({
      fiches,
      voisins,
      foret,
      paires,
      traits,
      cartes: stables('口可哥歌人女好妈日明时是吗叫吃名中')
    });
    expect(chaine(corpus, '2026-09-23')).toEqual(['口', '可', '哥', '歌']);
    const m = JEUX.chaine.preparer(corpus, '2026-09-23');
    if (!m) throw new Error('manche attendue');
    for (const t of m.tours) {
      const suite = t.suite ?? [];
      expect(t.choix.filter((x) => contient(x, suite[suite.length - 1], corpus))).toEqual([t.c]);
      for (const x of t.choix) {
        expect(corpus.acquis).toContain(x);
        expect(traits).toContain(x);
      }
    }
    const finie = jouer(m, (t) => t.reponse);
    expect(finie.evenements.slice(0, 3).map((e) => e.c)).toEqual(['可', '哥', '歌']);
    expect(JEUX.chaine.constat(finie)).toMatch(/^\d+ chaînes, la plus longue de 4, \d+ maillons trouvés\.$/);
  });

  it('pose une coquille avec les mots surcouchés : 夫 pour 天', () => {
    const corpus = corpusDeJeu({
      fiches,
      voisins,
      foret,
      paires,
      traits,
      cartes: stables('我住在北京天夫人女好妈口日明')
    });
    expect(corpus.textes).toEqual(expect.arrayContaining(['我住在北京。', '天天', '住在']));
    const m = JEUX.coquille.preparer(corpus, '2026-09-23');
    if (!m) throw new Error('manche attendue');
    for (const t of m.tours) {
      expect(t.c).toBe('天');
      expect(t.reponse).toEqual(['夫']);
      expect(t.choix.length).toBeGreaterThanOrEqual(MESSAGE_MIN);
      expect(t.choix.length).toBeLessThanOrEqual(MESSAGE_MAX);
      for (const x of t.choix) expect(traits).toContain(x);
      /* 天 et 夫 sont des composants de la norme : la correction les montre entiers. */
      expect(t.correction).toEqual([
        { c: '夫', briques: ['夫'] },
        { c: '天', briques: ['天'] }
      ]);
    }
    const finie = jouer(m, (t) => t.reponse);
    expect(finie.evenements).toHaveLength(2 * m.tours.length);
    for (const e of finie.evenements) expect(grade(e)).not.toBe(Rating.Again);
    expect(JEUX.coquille.constat(finie)).toMatch(/^2 caractères revus, \d coquilles? trouvées?\.$/);
  });

  it('avec le seul acquis de démonstration, joue la chaîne et tait la coquille', () => {
    const corpus = corpusDeJeu({ fiches, voisins, foret, paires, traits, cartes: [] });
    const dispo = disponibles(corpus, '2026-09-23');
    expect(dispo).toContain('chaine');
    /* Aucun mot surcouché n'est fait de l'acquis de démonstration (天 et 住 n'y sont pas). */
    expect(dispo).not.toContain('coquille');
    const m = JEUX.chaine.preparer(corpus, '2026-09-23');
    for (const t of m?.tours ?? []) {
      for (const x of t.choix) expect(corpus.acquis).toContain(x);
    }
  });
});

/* ---------- les devinettes de lanternes (story 4b.5) ---------- */

describe('la devinette du jour', () => {
  const devinette = (c: string, briques: string[], leurres: string[]): Devinette => ({
    id: c,
    c,
    pinyin: '',
    sens: `sens de ${c}`,
    enonce: `énoncé de ${c}`,
    zh: null,
    disposition: 'cote',
    briques,
    leurres
  });
  const MING = devinette('明', ['日', '月'], ['朋', '早', '间']);
  const HAO = devinette('好', ['女', '子'], ['如', '妈', '她']);
  const XIU = devinette('休', ['亻', '木'], ['作', '机', '们']);
  const TOUT = [...'明日月朋早间好女子如妈她休亻木作机们'];
  const lanternes = (o: Partial<Lanternes> = {}): Lanternes => ({
    devinettes: [MING, HAO, XIU],
    noms: { 日: 'le soleil', 月: 'la lune', 女: 'une femme', 子: 'un enfant' },
    connus: [...'明日月好女子'],
    resolues: [],
    posee: null,
    ...o
  });
  const corpus = (o: Partial<Lanternes> = {}, traits: readonly string[] = TOUT): CorpusJeux => ({
    ...corpusVide(),
    traits,
    lanternes: lanternes(o)
  });
  const devinetteJeu = JEUX.devinette;

  it('ne se pose que si la réponse et toutes ses briques sont acquises ou en cours', () => {
    expect(devinettesPossibles(corpus()).map((d) => d.id)).toEqual(['明', '好']);
    /* 月 n'a pas de carte : 明 attend. */
    expect(devinettesPossibles(corpus({ connus: [...'明日好女子'] })).map((d) => d.id)).toEqual([
      '好'
    ]);
    expect(devinetteJeu.preparer(corpus({ connus: [] }), 'g')).toBeNull();
    expect(devinetteJeu.preparer({ ...corpusVide(), traits: TOUT }, 'g')).toBeNull();
  });

  it('prend les cartes en cours comme acquises, et jamais l’acquis de démonstration', () => {
    const avecCartes = corpusDeJeu({
      traits: TOUT,
      devinettes: { version: '', source: '', devinettes: [MING], noms: {}, racines: {} },
      cartes: [...'明日月'].map((c) => ({ c, stabilite: 0.5 }))
    });
    expect(devinettesPossibles(avecCartes).map((d) => d.id)).toEqual(['明']);
    const foret = JSON.parse(
      readFileSync(new URL('../../public/data/demo/foret.json', import.meta.url), 'utf8')
    ) as Foret;
    const demo = corpusDeJeu({
      traits: TOUT,
      foret,
      devinettes: { version: '', source: '', devinettes: [MING, HAO, XIU], noms: {}, racines: {} },
      cartes: []
    });
    expect(demo.acquis.length).toBeGreaterThan(0);
    expect(devinettesPossibles(demo)).toEqual([]);
  });

  it('ne montre rien qu’elle ne sait dessiner', () => {
    const sansTraits = corpus({}, TOUT.filter((c) => c !== '间'));
    expect(devinettesPossibles(sansTraits).map((d) => d.id)).toEqual(['好']);
    const m = devinetteJeu.preparer(corpus(), '2026-09-24/devinette/0');
    for (const t of m?.tours ?? []) for (const x of [t.c, ...t.choix]) expect(TOUT).toContain(x);
  });

  it('est la même toute la journée, et garde celle déjà posée', () => {
    const a = devinetteDuJour(corpus(), '2026-09-24/devinette/0');
    expect(a).not.toBeNull();
    expect(devinetteDuJour(corpus(), '2026-09-24/devinette/0')).toEqual(a);
    /* Posée ce matin, elle reste celle du jour même si l'acquis ne la permettrait plus. */
    const autre = a?.id === '明' ? '好' : '明';
    expect(devinetteDuJour(corpus({ posee: autre, connus: [] }), 'x')?.id).toBe(autre);
  });

  it('préfère une devinette pas encore résolue', () => {
    expect(devinetteDuJour(corpus({ resolues: ['明'] }), 'g')?.id).toBe('好');
    expect(devinetteDuJour(corpus({ resolues: ['好'] }), 'g')?.id).toBe('明');
    /* Toutes résolues : elles reviennent, la lanterne ne les compte qu'une fois. */
    expect(devinetteDuJour(corpus({ resolues: ['明', '好'] }), 'g')).not.toBeNull();
  });

  it('pose quatre choix, la réponse et ses trois leurres, et la correction par les briques', () => {
    const m = devinetteJeu.preparer(corpus({ posee: '明' }), 'g');
    if (!m) throw new Error('manche attendue');
    expect(m.tours).toHaveLength(1);
    const t = m.tours[0];
    expect(t.enonce).toBe(MING.enonce);
    expect([...t.choix].sort()).toEqual([...'明朋早间'].sort());
    expect(t.correction).toEqual([{ c: '明', briques: ['日', '月'] }]);
    expect(devinetteDe(t, corpus())).toEqual(MING);
    expect(nomDeBrique('日', corpus())).toBe('le soleil');
  });

  it('note juste du premier coup comme une question : Facile, ou Bien si lent', () => {
    const m = devinetteJeu.preparer(corpus({ posee: '明' }), 'g') as Manche;
    const vite = essayer(m, '明', [], 3);
    expect(vite.resultat?.note).toBe(Rating.Easy);
    expect(vite.resultat?.evenement).toEqual({
      c: '明',
      correct: true,
      tries: 0,
      seconds: 3,
      leurres: []
    });
    expect(essayer(m, '明', [], 8).resultat?.note).toBe(Rating.Good);
  });

  it('laisse un second essai après une erreur, noté Difficile', () => {
    const m = devinetteJeu.preparer(corpus({ posee: '明' }), 'g') as Manche;
    const premier = essayer(m, '朋', [], 2);
    expect(premier.resultat).toBeNull();
    expect(premier.pris).toEqual(['朋']);
    const second = essayer(m, '明', premier.pris, 5);
    expect(second.resultat?.correct).toBe(true);
    expect(second.resultat?.note).toBe(Rating.Hard);
    expect(second.resultat?.evenement.leurres).toEqual(['朋']);
    expect(second.resultat?.manche.trouves).toBe(1);
  });

  it(`montre la réponse après ${ESSAIS_DEVINETTE} erreurs : la carte revient dans dix minutes`, () => {
    const m = devinetteJeu.preparer(corpus({ posee: '明' }), 'g') as Manche;
    const premier = essayer(m, '朋', [], 2);
    const second = essayer(m, '间', premier.pris, 4);
    if (!second.resultat) throw new Error('résultat attendu');
    expect(second.resultat.montre).toBe(true);
    expect(second.resultat.note).toBe(Rating.Again);
    expect(second.resultat.evenements).toHaveLength(1);
    expect(second.resultat.evenement.leurres).toEqual(['朋', '间']);
    const cartes = planifier([], second.resultat.evenement, MAINTENANT);
    expect(cartes[0].card.due.getTime() - MAINTENANT.getTime()).toBe(RETOUR_MINUTES * 60_000);
  });

  it('finit par un constat, sans score ni chronomètre', () => {
    const m = devinetteJeu.preparer(corpus({ posee: '明' }), 'g') as Manche;
    const resolue = essayer(m, '明', [], 3).resultat?.manche as Manche;
    expect(fini(resolue)).toBe(true);
    expect(devinetteJeu.constat(resolue)).toBe('1 caractère revu, 1 devinette résolue.');
    const montree = essayer(m, '间', ['朋'], 3).resultat?.manche as Manche;
    expect(devinetteJeu.constat(montree)).toBe('1 caractère revu, la réponse montrée.');
    expect(devinetteJeu.chrono).toBe(0);
    expect(devinetteJeu.limite).toBe(0);
  });

  it('s’annonce sur la case Jouer tant qu’elle n’est pas faite aujourd’hui', () => {
    const jour = '2026-09-24';
    const cartes = [...'明日月'].map((c) => newCard(c, MAINTENANT));
    const p: Progress = { ...emptyProgress(jour), cartes };
    expect(devinetteAAnnoncer(p, [MING, HAO])).toBe(true);
    expect(devinetteAAnnoncer({ ...p, cartes: [] }, [MING, HAO])).toBe(false);
    const faite: Progress = { ...p, devinetteDuJour: { jour, id: '明', issue: 'resolue' } };
    expect(devinetteAAnnoncer(faite, [MING, HAO])).toBe(false);
  });
});

describe('les devinettes servies avec l’app (export 0.1.0)', () => {
  const lire = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
  const dossier = `../../public/data/${VERSION_DONNEES}`;
  const indexExport = lire(`${dossier}/index.json`) as Index;
  const devinettes = lire(`${dossier}/devinettes.json`) as Devinettes;
  const racines = new Set(Object.values(devinettes.racines));
  const traits = indexExport.familles
    .filter((f) => racines.has(f.racine))
    .flatMap((f) =>
      Object.keys((lire(`${dossier}/${f.traits}`) as { traits: Record<string, unknown> }).traits)
    );

  it('pose 休 à qui a une carte pour 休, 亻 et 木, avec quatre choix dessinables', () => {
    const corpus = corpusDeJeu({
      traits,
      devinettes,
      cartes: [...'休亻木'].map((c) => ({ c, stabilite: 1 }))
    });
    const m = JEUX.devinette.preparer(corpus, '2026-09-24/devinette/0');
    if (!m) throw new Error('manche attendue');
    const t = m.tours[0];
    expect(t.c).toBe('休');
    expect(t.choix).toHaveLength(4);
    for (const x of [...t.choix, '亻', '木']) expect(traits).toContain(x);
  });

  it('dessine chaque devinette depuis les traits des racines que le fichier nomme', () => {
    const tout = new Set(traits);
    for (const d of devinettes.devinettes) {
      for (const x of [d.c, ...d.briques, ...d.leurres]) expect(tout.has(x)).toBe(true);
    }
  });
});
