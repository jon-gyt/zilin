/**
 * Le moteur des mini-jeux (épic 4b) : un contrat commun, une manche, un constat.
 *
 * Règle produit, tenue ici : un jeu n'existe que s'il fait lire quelque chose de plus.
 * Il n'y a donc ni point au temps passé, ni vie, ni classement, ni coffre. Un jeu ne
 * produit que des événements de révision (`{c, correct, tries, seconds}`), notés par
 * `grade` de `srs.ts` comme une question de révision : un jeu ne contourne jamais
 * l'algorithme. Une manche dure de une à trois minutes et se termine par un constat,
 * une ligne de nombres réels, jamais un score.
 *
 * Module pur, comme `session.ts` et `questions.ts` : aucune requête, aucun stockage,
 * aucune horloge, aucun `Math.random`. Les données sont injectées dans un `CorpusJeux`
 * et tout tirage part d'une graine : la même graine rend toujours la même manche.
 */
import type { Famille, Fiche, Foret, Noeud, Voisins } from './content';
import { etat } from './foret';
import {
  BONUS_MEME_NOMBRE,
  acquis as acquisDesCartes,
  type Acquis,
  hachage,
  melange,
  memePaire,
  ressemblance,
  type Corpus as CorpusQuestions,
  type Paires
} from './questions';
import type { Progress, Revision } from './session';
import { grade, newCard, schedule, type Outcome, type ReviewCard, type SrsParams } from './srs';
import { humeur, proposeUnJeu } from './tao';
import type { Grade } from 'ts-fsrs';

/* ---------- les constantes des deux jeux ---------- */

/** Une manche dure de une à trois minutes, jamais plus. */
export const MINUTES_MIN = 1;
export const MINUTES_MAX = 3;

/** Assembler contre la montre : huit secondes par tour. Le chrono borne, il ne note pas. */
export const CHRONO_ASSEMBLAGE_MS = 8000;

/** Deux leurres, visuellement proches des vraies briques. */
export const LEURRES_ASSEMBLAGE = 2;

/** Ce qu'une manche d'assemblage pose au plus : huit secondes par tour, plus la correction. */
export const TOURS_ASSEMBLAGE = 6;

/** Les jumeaux : le flash dure 700 ms. */
export const FLASH_MS = 700;

/** Les jumeaux : quinze paires par minute au plus. */
export const PAIRES_PAR_MINUTE = 15;

/**
 * Sous ce nombre de caractères acquis, la progression ne suffit pas encore à jouer
 * et le repli de démonstration complète l'acquis (voir `corpusDeJeu`).
 */
export const ACQUIS_MIN = 6;

/* ---------- le corpus injecté ---------- */

/** Le pinyin et le sens d'un caractère : de quoi poser l'énoncé, rien de plus. */
export type Glose = { pinyin: string; fr: string };

/** Tout ce dont les jeux ont besoin. Rien n'est lu ailleurs. */
export type CorpusJeux = {
  /** Les caractères acquis : l'entrée de tous les jeux. */
  acquis: readonly string[];
  /**
   * Décompositions canoniques GF 0014-2009, telles que le contenu les donne
   * (parts des fiches et des voisins). C'est la seule source de l'assemblage.
   */
  decompositions: Readonly<Record<string, readonly string[]>>;
  /**
   * Composants connus, canoniques ou partiels : sert uniquement à juger la ressemblance
   * de deux caractères (les leurres, les jumeaux), jamais à demander un assemblage.
   */
  formes: Readonly<Record<string, readonly string[]>>;
  /** Le pinyin et le sens de chaque caractère connu. */
  gloses: Readonly<Record<string, Glose>>;
  /** Les paires à ne pas confondre (`data/<version>/paires.json`). */
  paires: Paires;
  /** Les caractères dont on a les traits : les seuls qu'un jeu peut montrer. */
  traits: readonly string[];
};

export function corpusVide(): CorpusJeux {
  return { acquis: [], decompositions: {}, formes: {}, gloses: {}, paires: [], traits: [] };
}

/** Le corpus tel que `questions.ts` le lit : la ressemblance et les paires y sont déjà. */
function corpusDeRessemblance(c: CorpusJeux): CorpusQuestions {
  return { fiches: [], decompositions: c.formes, acquis: [], paires: c.paires };
}

/** Un caractère ne se montre que si on a ses traits : jamais de grand caractère en police. */
export function montrable(c: string, corpus: CorpusJeux): boolean {
  return corpus.traits.includes(c);
}

/** La décomposition canonique d'un caractère. Vide quand le contenu ne la donne pas. */
export function briques(c: string, corpus: CorpusJeux): string[] {
  const d = corpus.decompositions[c];
  return d ? [...d] : [];
}

/** La glose d'un caractère, vide quand le contenu ne la donne pas. */
export function glose(c: string, corpus: CorpusJeux): Glose {
  return corpus.gloses[c] ?? { pinyin: '', fr: '' };
}

/* ---------- l'acquis, et son repli de démonstration ---------- */

function noeuds(n: Noeud): Noeud[] {
  return [n, ...n.membres.flatMap(noeuds)];
}

/**
 * Les caractères marqués acquis dans le cercle des familles de démonstration
 * (`foret.json`, avancement plein). C'est le repli, jamais la vérité de la progression.
 */
export function acquisDeDemo(foret: Foret | null): string[] {
  if (!foret) return [];
  const out: string[] = [];
  for (const fam of foret.familles) {
    for (const n of noeuds(fam)) {
      if (etat(n.avancement) === 'acquis' && !out.includes(n.c)) out.push(n.c);
    }
  }
  return out;
}

/** Les sources du contenu, telles que l'écran hôte les charge. */
export type Sources = {
  /** Les fiches de l'export versionné, déjà surcouchées par `content.fiche`. */
  fiches?: readonly Fiche[];
  familles?: readonly Famille[];
  voisins?: Voisins | null;
  foret?: Foret | null;
  paires?: Paires;
  /** Les caractères dont on a les tracés : `traits/<racine>.json`, puis `strokes-demo.json`. */
  traits?: readonly string[];
  /** Les cartes de la progression : l'acquis réel, ou directement leurs stabilités. */
  cartes?: readonly Acquis[];
  /** Stabilité minimale pour compter comme acquis. Défaut : le seuil de `srs.ts`. */
  seuil?: number;
};

/**
 * Assemble le corpus des jeux à partir du contenu servi avec l'app.
 *
 * L'entrée d'un jeu est l'acquis : les cartes dont la stabilité FSRS dépasse le seuil
 * de `srs.ts`. Repli documenté : tant que la progression n'en porte pas assez
 * (`ACQUIS_MIN`), on complète avec les caractères marqués acquis dans les familles de
 * démonstration de `foret.json`. C'est une démonstration, pas une progression : elle
 * s'efface d'elle-même dès que l'utilisateur a vraiment acquis de quoi jouer.
 *
 * Les décompositions viennent des fiches et des voisins, et d'elles seules. La forêt
 * n'y ajoute qu'un fait partiel, et un seul : un membre du premier anneau contient la
 * racine de sa famille. Il est rangé dans `formes`, sert à juger la ressemblance, et
 * jamais à demander un assemblage. Les générations suivantes n'en disent rien : le
 * cercle les range par filiation, pas par composition.
 */
export function corpusDeJeu(s: Sources): CorpusJeux {
  const decompositions: Record<string, string[]> = {};
  const gloses: Record<string, Glose> = {};

  for (const v of s.voisins?.voisins ?? []) {
    if (v.parts.length >= 2) decompositions[v.c] = [...v.parts];
    gloses[v.c] = { pinyin: v.pinyin, fr: v.fr };
  }
  for (const x of s.fiches ?? []) {
    if (x.parts.length >= 2) decompositions[x.c] = [...x.parts];
    gloses[x.c] = { pinyin: x.pinyin, fr: x.fr };
  }
  for (const f of s.familles ?? []) {
    gloses[f.racine.c] = { pinyin: f.racine.pinyin, fr: f.racine.fr };
    for (const x of f.fiches) {
      if (x.parts.length >= 2) decompositions[x.c] = [...x.parts];
      gloses[x.c] = { pinyin: x.pinyin, fr: x.fr };
    }
  }

  const formes: Record<string, readonly string[]> = { ...decompositions };
  for (const fam of s.foret?.familles ?? []) {
    for (const n of noeuds(fam)) {
      /* Le cercle de démonstration ne complète que ce que l'export laisse vide : sans
         fiche relue, une fiche exportée n'a ni sens ni pinyin à donner à un énoncé. */
      const g = gloses[n.c];
      if (!g) gloses[n.c] = { pinyin: n.pinyin, fr: n.fr };
      else if (g.fr === '' && n.fr !== '') gloses[n.c] = { pinyin: g.pinyin || n.pinyin, fr: n.fr };
    }
    for (const membre of fam.membres) {
      if (!formes[membre.c]) formes[membre.c] = [fam.c];
    }
  }

  const stables = acquisDesCartes({
    fiches: [],
    decompositions: {},
    acquis: s.cartes ?? [],
    seuil: s.seuil
  });
  const demo = acquisDeDemo(s.foret ?? null);
  const acquis =
    stables.length >= ACQUIS_MIN ? stables : [...new Set([...stables, ...demo])];

  return {
    acquis,
    decompositions,
    formes,
    gloses,
    paires: s.paires ?? [],
    traits: s.traits ?? []
  };
}

/* ---------- le contrat commun ---------- */

export type JeuId = 'assembler' | 'jumeaux';

/** L'ordre de référence des jeux, celui du choix sur Ma forêt. */
export const IDS: readonly JeuId[] = ['assembler', 'jumeaux'];

/**
 * Un tour : ce qui est demandé, ce qu'il faut rendre, ce qu'on montre.
 * `c` est le caractère noté, l'identifiant de la carte SRS.
 */
export type Tour = {
  c: string;
  enonce: string;
  /** La bonne réponse : une suite de briques, ou un seul caractère. */
  reponse: string[];
  /** Les options montrées, mélangées d'après la graine. */
  choix: string[];
  /** L'ordre d'écriture est exigé : la suite compte, pas seulement les éléments. */
  ordre: boolean;
  /** Le tour oppose deux caractères d'un groupe à ne pas confondre. */
  paire: boolean;
};

/** Une manche : la suite des tours, où l'on en est, et ce qui a été noté. */
export type Manche = {
  jeu: JeuId;
  graine: string;
  tours: Tour[];
  /** Le tour courant. Égal au nombre de tours quand la manche est finie. */
  i: number;
  /** Les événements de révision produits, dans l'ordre des tours. */
  evenements: Revision[];
};

/** La réponse de l'utilisateur : une option, ou une suite de briques. */
export type Reponse = string | readonly string[];

/** Ce qu'un tour rend : un événement de révision, et rien qui ressemble à un score. */
export type Resultat = {
  manche: Manche;
  evenement: Revision;
  correct: boolean;
  /** La note de `grade` : c'est `srs.ts` qui note, jamais le jeu. */
  note: Grade;
  /** Faux : la réponse est montrée, et la carte revient dans dix minutes. */
  montre: boolean;
};

export type Jeu = {
  id: JeuId;
  titre: string;
  /** Ce qu'il fait lire de plus, en une phrase. */
  lit: string;
  /** La durée d'une manche, en minutes : entre `MINUTES_MIN` et `MINUTES_MAX`. */
  minutes: number;
  /** Nombre de tours d'une manche, au plus. */
  tours: number;
  /** Le temps laissé pour un tour, en millisecondes. Zéro : pas de chronomètre. */
  chrono: number;
  /** Prépare une manche. `null` quand l'acquis ne permet pas encore d'y jouer. */
  preparer: (corpus: CorpusJeux, graine: string) => Manche | null;
  /** Note une réponse : un événement de révision, prêt pour `grade`. */
  repondre: (manche: Manche, reponse: Reponse, outcome: Outcome) => Resultat;
  /** Une ligne de constat, des nombres réels, jamais un score. */
  constat: (manche: Manche) => string;
};

/* ---------- les leurres, par ressemblance de composants ---------- */

/**
 * Les leurres d'un assemblage sont des briques, jamais des caractères entiers : on ne
 * prend donc que des composants de décompositions canoniques.
 */
function candidatsBriques(corpus: CorpusJeux): string[] {
  const out: string[] = [];
  for (const parts of Object.values(corpus.decompositions)) {
    for (const b of parts) if (b !== '' && !out.includes(b)) out.push(b);
  }
  return out;
}

/**
 * Les candidats les plus proches des cibles, du plus ressemblant au moins ressemblant.
 * La ressemblance est celle de `questions.ts` : composants partagés, et une paire à ne
 * pas confondre passe devant tout le reste. À graine égale, même tirage.
 */
export function proches(
  cibles: readonly string[],
  candidats: readonly string[],
  corpus: CorpusJeux,
  graine: string,
  n: number,
  exclus: readonly string[] = []
): string[] {
  const q = corpusDeRessemblance(corpus);
  const interdits = new Set(exclus);
  return [...new Set(candidats)]
    .filter((c) => !interdits.has(c) && montrable(c, corpus))
    .map((c) => ({
      c,
      s: Math.max(...cibles.map((cible) => ressemblance(c, cible, q))),
      h: hachage(`${graine}/${c}`)
    }))
    .sort((a, b) => b.s - a.s || a.h - b.h || (a.c < b.c ? -1 : 1))
    .slice(0, Math.max(0, n))
    .map((x) => x.c);
}

/* ---------- jeu 1 : assembler contre la montre ---------- */

/** Les caractères qu'on peut demander d'assembler : acquis, décomposés, montrables. */
export function ciblesAssemblage(corpus: CorpusJeux): string[] {
  return corpus.acquis.filter((c) => {
    const parts = briques(c, corpus);
    return (
      parts.length >= 2 &&
      glose(c, corpus).fr !== '' &&
      montrable(c, corpus) &&
      parts.every((b) => montrable(b, corpus))
    );
  });
}

function toursAssemblage(corpus: CorpusJeux, graine: string): Tour[] {
  const cibles = melange(ciblesAssemblage(corpus), `${graine}/assembler`).slice(0, TOURS_ASSEMBLAGE);
  return cibles.map((c) => {
    const parts = briques(c, corpus);
    const leurres = proches(parts, candidatsBriques(corpus), corpus, `${graine}/${c}`, LEURRES_ASSEMBLAGE, [
      c,
      ...parts
    ]);
    return {
      c,
      enonce: `« ${glose(c, corpus).fr} » : assemble les briques dans l'ordre d'écriture.`,
      reponse: parts,
      choix: melange([...parts, ...leurres], `${graine}/${c}/choix`),
      ordre: true,
      paire: false
    };
  });
}

/* ---------- jeu 2 : les jumeaux ---------- */

/** Les caractères qu'on peut opposer à un jumeau : acquis, montrables, glosés. */
export function ciblesJumeaux(corpus: CorpusJeux): string[] {
  return corpus.acquis.filter((c) => {
    const g = glose(c, corpus);
    return montrable(c, corpus) && (g.fr !== '' || g.pinyin !== '');
  });
}

/**
 * Le jumeau d'un caractère : d'abord son groupe à ne pas confondre, ensuite le plus
 * proche par ressemblance de composants. `null` quand rien n'est assez proche : mieux
 * vaut sauter un tour qu'opposer deux caractères qui n'ont rien à voir.
 */
export function jumeau(c: string, corpus: CorpusJeux, graine: string): string | null {
  const q = corpusDeRessemblance(corpus);
  /* Un jumeau n'a pas à être acquis : c'est une forme à écarter, pas une leçon.
     Tout ce dont on a les traits peut donc servir, et rien d'autre. */
  const [proche] = proches([c], corpus.traits, corpus, graine, 1, [c]);
  if (!proche) return null;
  if (memePaire(proche, c, q)) return proche;
  return ressemblance(proche, c, q) > BONUS_MEME_NOMBRE ? proche : null;
}

function toursJumeaux(corpus: CorpusJeux, graine: string, max: number): Tour[] {
  const q = corpusDeRessemblance(corpus);
  /* Une même paire ne se pose qu'une fois dans la manche, dans un sens ou dans l'autre. */
  const posees = new Set<string>();
  const tours = melange(ciblesJumeaux(corpus), `${graine}/jumeaux`).flatMap((c) => {
    const autre = jumeau(c, corpus, `${graine}/${c}`);
    if (autre === null) return [];
    const cle = [c, autre].sort().join('');
    if (posees.has(cle)) return [];
    posees.add(cle);
    const g = glose(c, corpus);
    const parLeSens = g.fr !== '' && (g.pinyin === '' || hachage(`${graine}/${c}/enonce`) % 2 === 0);
    return [
      {
        c,
        enonce: parLeSens ? `Lequel veut dire « ${g.fr} » ?` : `Lequel se lit ${g.pinyin} ?`,
        reponse: [c],
        choix: melange([c, autre], `${graine}/${c}/choix`),
        ordre: false,
        paire: memePaire(c, autre, q)
      }
    ];
  });
  /* Les paires à ne pas confondre d'abord, la ressemblance ensuite. */
  return [...tours.filter((t) => t.paire), ...tours.filter((t) => !t.paire)].slice(0, max);
}

/* ---------- une manche ---------- */

function manche(jeu: JeuId, graine: string, tours: Tour[]): Manche | null {
  return tours.length === 0 ? null : { jeu, graine, tours, i: 0, evenements: [] };
}

/** Le tour courant, `null` quand la manche est finie. */
export function tour(m: Manche): Tour | null {
  return m.tours[m.i] ?? null;
}

export function fini(m: Manche): boolean {
  return m.i >= m.tours.length;
}

function memeSuite(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Note une réponse. Pour un tour où l'ordre d'écriture est exigé, la suite doit être
 * exacte. L'événement rendu est celui de la révision, prêt pour `grade` de `srs.ts` :
 * le jeu n'ajoute rien, ni bonus de vitesse, ni point, ni vie. Le chronomètre de
 * l'écran ne fait que borner le tour ; quand il expire, l'appelant répond à vide.
 */
export function repondre(m: Manche, reponse: Reponse, outcome: Outcome): Resultat {
  const t = tour(m);
  if (t === null) throw new Error('Manche finie');
  const donnee = typeof reponse === 'string' ? [reponse] : [...reponse];
  const correct = t.ordre
    ? memeSuite(donnee, t.reponse)
    : donnee.length === 1 && donnee[0] === t.reponse[0];
  const evenement: Revision = {
    c: t.c,
    correct,
    tries: outcome.tries,
    seconds: outcome.seconds
  };
  return {
    manche: { ...m, i: m.i + 1, evenements: [...m.evenements, evenement] },
    evenement,
    correct,
    note: grade(evenement),
    montre: !correct
  };
}

/* ---------- le constat ---------- */

function pluriel(n: number, un: string, plusieurs: string): string {
  return n === 1 ? `1 ${un}` : `${n} ${plusieurs}`;
}

/** Ce que chaque jeu compte en plus des caractères revus. Des faits, pas des points. */
const COMPTES: Record<JeuId, { un: string; plusieurs: string; aucun: string }> = {
  assembler: { un: 'assemblé', plusieurs: 'assemblés', aucun: 'aucun assemblé' },
  jumeaux: {
    un: 'paire distinguée',
    plusieurs: 'paires distinguées',
    aucun: 'aucune paire distinguée'
  }
};

/**
 * Le constat d'une manche : une ligne, deux nombres réels, rien d'autre. Ni score, ni
 * temps, ni félicitation. « 5 caractères revus, 1 paire distinguée. »
 */
export function constat(m: Manche): string {
  const n = m.evenements.length;
  if (n === 0) return 'Rien de revu cette fois.';
  const justes = m.evenements.filter((e) => e.correct).length;
  const { un, plusieurs, aucun } = COMPTES[m.jeu];
  const second = justes === 0 ? aucun : pluriel(justes, un, plusieurs);
  return `${pluriel(n, 'caractère revu', 'caractères revus')}, ${second}.`;
}

/* ---------- les deux jeux ---------- */

export const JEUX: Record<JeuId, Jeu> = {
  assembler: {
    id: 'assembler',
    titre: 'Assembler contre la montre',
    lit: 'Produire un caractère à partir de ses briques, dans l’ordre d’écriture.',
    minutes: 2,
    tours: TOURS_ASSEMBLAGE,
    chrono: CHRONO_ASSEMBLAGE_MS,
    preparer: (corpus, graine) => manche('assembler', graine, toursAssemblage(corpus, graine)),
    repondre,
    constat
  },
  jumeaux: {
    id: 'jumeaux',
    titre: 'Les jumeaux',
    lit: 'Distinguer deux caractères proches, vus en un éclair.',
    minutes: 1,
    tours: PAIRES_PAR_MINUTE,
    chrono: 0,
    preparer: (corpus, graine) =>
      manche('jumeaux', graine, toursJumeaux(corpus, graine, PAIRES_PAR_MINUTE)),
    repondre,
    constat
  }
};

export function jeu(id: JeuId): Jeu {
  return JEUX[id];
}

/** Les jeux auxquels l'acquis permet de jouer aujourd'hui, dans l'ordre de `IDS`. */
export function disponibles(corpus: CorpusJeux, graine: string): JeuId[] {
  return IDS.filter((id) => JEUX[id].preparer(corpus, graine) !== null);
}

/* ---------- la proposition de Tao ---------- */

/**
 * Tao propose un jeu quand elle s'ennuie, c'est-à-dire après trois activités
 * identiques d'affilée (`tao.ts`). C'est le seul déclencheur : ni horloge, ni
 * notification. Une proposition, jamais un reproche.
 */
export function propose(p: Progress, jour: string): boolean {
  return proposeUnJeu(humeur(p.tao.activites, jour));
}

/* ---------- ce que la manche rend à la progression ---------- */

/**
 * Applique un événement de révision aux cartes : `schedule` de `srs.ts`, et rien
 * d'autre. Une carte inconnue est créée avant d'être planifiée — un jeu peut faire
 * réviser un caractère que la session n'a pas encore rencontré.
 */
export function planifier(
  cartes: readonly ReviewCard[],
  r: Revision,
  maintenant: Date,
  params: SrsParams = {}
): ReviewCard[] {
  const existante = cartes.find((x) => x.id === r.c) ?? newCard(r.c, maintenant);
  const { card } = schedule(existante, r, maintenant, params);
  const connue = cartes.some((x) => x.id === r.c);
  return connue ? cartes.map((x) => (x.id === r.c ? card : x)) : [...cartes, card];
}
