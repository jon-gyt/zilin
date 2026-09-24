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
import type { Devinette, Devinettes, Famille, Fiche, Foret, Noeud, Voisins } from './content';
import type { MessageCoquille } from './coquilles';
import { etat } from './foret';
import {
  BONUS_MEME_NOMBRE,
  acquis as acquisDesCartes,
  caractereAcquis,
  type Acquis,
  hachage,
  melange,
  memePaire,
  ressemblance,
  type Corpus as CorpusQuestions,
  type Paires
} from './questions';
import { TOURS_ECLAIR, dictionnaire, toursEclair, type Dictionnaire, type Eclair } from './eclair';
import { devinetteFaite, type Progress, type Revision } from './session';
import { grade, newCard, schedule, type Outcome, type ReviewCard, type SrsParams } from './srs';
import { humeur, proposeUnJeu, type Posture } from './tao';
import type { Grade } from 'ts-fsrs';

/* ---------- les constantes des jeux ---------- */

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

/** La chaîne : quatre propositions, dont une seule contient le dernier caractère. */
export const PROPOSITIONS_CHAINE = 4;

/** La chaîne s'arrête d'elle-même après trois minutes, où qu'elle en soit. */
export const LIMITE_CHAINE_MS = MINUTES_MAX * 60_000;

/** La chaîne ne pose pas plus de maillons que trois minutes n'en laissent lire. */
export const MAILLONS_MAX = 12;

/** La coquille : un message de six à douze caractères. */
export const MESSAGE_MIN = 6;
export const MESSAGE_MAX = 12;

/** La coquille : quatre messages par manche, un intrus dans chacun. */
export const TOURS_COQUILLE = 4;

/**
 * La devinette : deux essais. Juste au premier, juste au second (après une erreur), ou
 * faux deux fois : la réponse est alors montrée. C'est la notation de toute question.
 */
export const ESSAIS_DEVINETTE = 2;

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
  /**
   * Les mots et les phrases des fiches (surcouchées), tels que le contenu les donne :
   * la source des messages de la coquille. Le code n'en écrit aucun.
   */
  textes: readonly string[];
  /** Les devinettes de lanternes et ce qu'il faut pour choisir celle du jour. Absent : pas de devinette. */
  lanternes?: Lanternes;
  /** Le dictionnaire éclair (`eclair.ts`) : ses mots et ce qu'il faut pour les choisir. Absent : pas d'éclair. */
  eclair?: Dictionnaire;
  /**
   * Les messages rédigés pour la coquille (`coquilles.json`), avec leurs pièges. Ils
   * passent avant les mots et les phrases des fiches. Absent : les fiches seules.
   */
  coquilles?: readonly MessageCoquille[];
  /**
   * Les caractères de l'export versionné (fiches et racines des familles). Quand il est
   * donné, la chaîne ne traverse que ceux-là : un caractère de la seule démonstration
   * n'y entre pas. Absent : aucune restriction (données de test).
   */
  exportes?: readonly string[];
};

/**
 * Ce que la devinette du jour lit, en plus du corpus commun. Les devinettes viennent de
 * `devinettes.json` (rédigées et contrôlées dans le pipeline) ; le reste, de la progression.
 */
export type Lanternes = {
  devinettes: readonly Devinette[];
  /** Le nom de chaque brique citée, que la correction montre sous la brique. */
  noms: Readonly<Record<string, string>>;
  /**
   * Les caractères qui ont une carte, acquis ou en cours : une devinette ne se pose que
   * si sa réponse et toutes ses briques en sont. Jamais l'acquis de démonstration.
   */
  connus: readonly string[];
  /** Les devinettes déjà résolues : celles qui ne le sont pas passent devant. */
  resolues: readonly string[];
  /** La devinette déjà posée aujourd'hui : elle reste celle du jour, quoi qu'il arrive. */
  posee: string | null;
};

export function corpusVide(): CorpusJeux {
  return {
    acquis: [],
    decompositions: {},
    formes: {},
    gloses: {},
    paires: [],
    traits: [],
    textes: []
  };
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
  /** Les devinettes de l'export (`devinettes.json`). */
  devinettes?: Devinettes | null;
  /** Les devinettes déjà résolues, `Progress.devinettes`. */
  resolues?: readonly string[];
  /** La devinette déjà posée aujourd'hui, s'il y en a une. */
  posee?: string | null;
  /** Le dictionnaire éclair de l'export (`eclair.json`). */
  eclair?: Eclair | null;
  /** Les mots déjà devinés, `Progress.motsDevines`. */
  devines?: readonly string[];
  /** Les messages de la coquille (`coquilles.json`). */
  coquilles?: readonly MessageCoquille[];
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
  const textes: string[] = [];
  /* Les phrases d'abord, les mots ensuite : c'est le contenu qui parle, jamais le code. */
  const retenirTextes = (x: Fiche): void => {
    for (const t of [x.phrase?.hanzi ?? '', ...(x.mots ?? []).map((m) => m.hanzi)]) {
      if (t !== '' && !textes.includes(t)) textes.push(t);
    }
  };

  for (const v of s.voisins?.voisins ?? []) {
    if (v.parts.length >= 2) decompositions[v.c] = [...v.parts];
    gloses[v.c] = { pinyin: v.pinyin, fr: v.fr };
  }
  for (const x of s.fiches ?? []) {
    if (x.parts.length >= 2) decompositions[x.c] = [...x.parts];
    gloses[x.c] = { pinyin: x.pinyin, fr: x.fr };
    retenirTextes(x);
  }
  for (const f of s.familles ?? []) {
    gloses[f.racine.c] = { pinyin: f.racine.pinyin, fr: f.racine.fr };
    for (const x of f.fiches) {
      if (x.parts.length >= 2) decompositions[x.c] = [...x.parts];
      gloses[x.c] = { pinyin: x.pinyin, fr: x.fr };
      retenirTextes(x);
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

  const corpus: CorpusJeux = {
    acquis,
    decompositions,
    formes,
    gloses,
    paires: s.paires ?? [],
    traits: s.traits ?? [],
    textes
  };
  const exportes = new Set<string>();
  for (const x of s.fiches ?? []) exportes.add(x.c);
  for (const f of s.familles ?? []) {
    exportes.add(f.racine.c);
    for (const x of f.fiches) exportes.add(x.c);
  }
  if (exportes.size > 0) corpus.exportes = [...exportes];
  if (s.coquilles && s.coquilles.length > 0) corpus.coquilles = s.coquilles;
  if (s.devinettes) {
    corpus.lanternes = {
      devinettes: s.devinettes.devinettes,
      noms: s.devinettes.noms,
      connus: [...new Set((s.cartes ?? []).map(caractereAcquis))],
      resolues: s.resolues ?? [],
      posee: s.posee ?? null
    };
  }
  const d = dictionnaire(s);
  if (d !== null) corpus.eclair = d;
  return corpus;
}

/* ---------- le contrat commun ---------- */

export type JeuId = 'devinette' | 'assembler' | 'jumeaux' | 'chaine' | 'coquille' | 'eclair';

/**
 * L'ordre de référence des jeux, celui de l'écran Jouer. La devinette du jour passe en
 * tête : c'est elle que la case Jouer du menu annonce.
 */
export const IDS: readonly JeuId[] = ['devinette', 'assembler', 'jumeaux', 'chaine', 'coquille', 'eclair'];

/** Un caractère et sa décomposition : ce que montre la correction par les briques. */
export type Correction = { c: string; briques: string[] };

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
  /** La chaîne : les caractères déjà enchaînés, du départ au dernier. */
  suite?: string[];
  /** D'autres caractères notés par la même réponse (la coquille : l'intrus). */
  aussi?: string[];
  /** La coquille : l'indice, dans `choix`, où commence chaque mot ou phrase du message. */
  coupes?: number[];
  /** La coquille : la ponctuation qui suit chaque caractère de `choix`, vide s'il n'y en a pas. */
  ponctuation?: string[];
  /** La coquille : la traduction du message rédigé, que la correction montre. */
  traduction?: string;
  /** La correction par les briques, montrée après la réponse. */
  correction?: Correction[];
  /** La devinette : son identifiant, que la progression range une fois résolue. */
  devinette?: string;
  /** Le dictionnaire éclair : le mot à deviner, que la progression range une fois deviné. */
  mot?: string;
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
  /** Les tours réussis : un fait, pas un score. */
  trouves: number;
};

/** La réponse de l'utilisateur : une option, ou une suite de briques. */
export type Reponse = string | readonly string[];

/** Ce qu'un tour rend : un événement de révision, et rien qui ressemble à un score. */
export type Resultat = {
  manche: Manche;
  /** Le premier événement du tour : celui du caractère demandé. */
  evenement: Revision;
  /** Tous les événements du tour (la coquille en rend deux : le substitué et l'intrus). */
  evenements: Revision[];
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
  /** Le temps laissé à la manche entière, en millisecondes. Zéro : pas de limite. */
  limite: number;
  /** La ligne neutre dite quand l'acquis ou le contenu ne permettent pas encore d'y jouer. */
  indisponible: string;
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

/* ---------- jeu 3 : la chaîne ---------- */

/**
 * Ce qu'un caractère apporte comme motif dans un autre : sa décomposition canonique,
 * ou lui-même quand il est une brique (le contenu ne le décompose pas).
 */
function motif(c: string, corpus: CorpusJeux): string[] {
  const d = briques(c, corpus);
  return d.length >= 2 ? d : [c];
}

/**
 * `suivant` contient `precedent` comme composant, d'après les `parts` du contenu.
 *
 * Deux cas, et rien d'autre : `precedent` est l'une des parts de `suivant` (吞 = 天 口) ;
 * ou sa propre décomposition y paraît d'un seul tenant, dans l'ordre d'écriture. Le
 * second cas vient de l'export : ses parts descendent jusqu'aux composants de la norme
 * GF 0014-2009 (哥 = 丁 口 丁 口), si bien qu'un composé n'y est jamais nommé comme
 * part. 可 = 丁 口 paraît d'un seul tenant dans 哥 : 哥 contient 可.
 */
export function contient(suivant: string, precedent: string, corpus: CorpusJeux): boolean {
  if (suivant === precedent) return false;
  const parts = briques(suivant, corpus);
  if (parts.length < 2) return false;
  if (parts.includes(precedent)) return true;
  const m = motif(precedent, corpus);
  if (m.length < 2 || m.length >= parts.length) return false;
  for (let i = 0; i + m.length <= parts.length; i++) {
    if (m.every((x, k) => parts[i + k] === x)) return true;
  }
  return false;
}

/**
 * Plus large que `contient` : tous les éléments du motif de `precedent` se trouvent dans
 * `suivant`, dans n'importe quel ordre. Sert à écarter un leurre : une proposition qui
 * porte les pièces du dernier caractère, même éparses, ne peut pas être un leurre sûr.
 */
function porte(suivant: string, precedent: string, corpus: CorpusJeux): boolean {
  if (suivant === precedent) return true;
  if (contient(suivant, precedent, corpus)) return true;
  const reste = [...briques(suivant, corpus)];
  if (reste.length < 2) return false;
  for (const x of motif(precedent, corpus)) {
    const k = reste.indexOf(x);
    if (k === -1) return false;
    reste.splice(k, 1);
  }
  return true;
}

/**
 * Les caractères qu'une chaîne peut traverser : acquis, montrables, et de l'export quand
 * le corpus le dit. C'est l'acquis qui borne la chaîne, jamais la démonstration.
 */
export function maillonsPossibles(corpus: CorpusJeux): string[] {
  const exportes = corpus.exportes ? new Set(corpus.exportes) : null;
  return corpus.acquis.filter((c) => montrable(c, corpus) && (exportes === null || exportes.has(c)));
}

/** Les caractères acquis qui prolongent la chaîne après `c`. */
export function prolongements(c: string, corpus: CorpusJeux): string[] {
  return maillonsPossibles(corpus).filter((s) => contient(s, c, corpus));
}

/**
 * La chaîne la plus longue que l'acquis permet, à graine égale toujours la même.
 *
 * Le départ est une brique acquise qui ouvre la plus longue chaîne ; à chaque pas, on
 * prend le caractère acquis qui la mène le plus loin ; la graine ne départage que les
 * ex aequo. La chaîne s'arrête quand aucun caractère acquis ne la prolonge : c'est
 * l'acquis qui la borne, jamais le jeu.
 */
export function chaine(corpus: CorpusJeux, graine: string): string[] {
  const possibles = maillonsPossibles(corpus);
  const suites = new Map<string, string[]>(
    possibles.map((c) => [c, possibles.filter((s) => contient(s, c, corpus))])
  );
  const loin = new Map<string, number>();
  const enCours = new Set<string>();
  /* La longueur de la plus longue chaîne qui part de `c`. Un cycle (donnée fautive) est coupé. */
  const portee = (c: string): number => {
    const connue = loin.get(c);
    if (connue !== undefined) return connue;
    if (enCours.has(c)) return 0;
    enCours.add(c);
    let n = 1;
    for (const s of suites.get(c) ?? []) n = Math.max(n, 1 + portee(s));
    enCours.delete(c);
    loin.set(c, n);
    return n;
  };
  const meilleur = (cs: readonly string[], sel: string): string | null => {
    let choix: string | null = null;
    let best = -1;
    let h = 0;
    for (const c of cs) {
      const n = portee(c);
      const hc = hachage(`${graine}/${sel}/${c}`);
      if (n > best || (n === best && hc < h)) {
        choix = c;
        best = n;
        h = hc;
      }
    }
    return choix;
  };

  const departs = possibles.filter((c) => (suites.get(c) ?? []).length > 0);
  const depart = meilleur(departs, 'depart');
  if (depart === null) return [];
  const out = [depart];
  while (out.length <= MAILLONS_MAX) {
    const dernier = out[out.length - 1];
    const libres = (suites.get(dernier) ?? []).filter((s) => !out.includes(s));
    const suivant = meilleur(libres, dernier);
    if (suivant === null) break;
    out.push(suivant);
  }
  return out;
}

/**
 * Les chaînes d'une manche, deux à deux sans caractère commun. La première est la plus
 * longue que l'acquis permet (`chaine`) ; quand elle bute sur une impasse avant que la
 * manche soit pleine, une autre part d'un caractère acquis qui n'a pas encore servi. Les
 * décompositions canoniques sont plates (大, 天, 人 sont des composants de la norme) :
 * au début du parcours, une chaîne a souvent deux maillons, et la manche en enchaîne
 * plusieurs plutôt que de s'arrêter après une question.
 */
export function chaines(corpus: CorpusJeux, graine: string): string[][] {
  const out: string[][] = [];
  const servis = new Set<string>();
  let maillons = 0;
  while (maillons < MAILLONS_MAX) {
    const reste = { ...corpus, acquis: corpus.acquis.filter((c) => !servis.has(c)) };
    const suite = chaine(reste, out.length === 0 ? graine : `${graine}/${out.length}`);
    if (suite.length < 2) break;
    out.push(suite);
    for (const c of suite) servis.add(c);
    maillons += suite.length - 1;
  }
  return out;
}

function toursChaine(corpus: CorpusJeux, graine: string): Tour[] {
  const tours: Tour[] = [];
  for (const suite of chaines(corpus, graine)) {
    for (let k = 1; k < suite.length && tours.length < MAILLONS_MAX; k++) {
      const precedent = suite[k - 1];
      const c = suite[k];
      /* Les leurres : des caractères acquis, pris par ressemblance avec la bonne réponse,
         qui ne portent pas le dernier caractère, même en pièces éparses. */
      const candidats = maillonsPossibles(corpus).filter(
        (x) => !suite.includes(x) && !porte(x, precedent, corpus)
      );
      /* Pas les quatre mêmes cases d'un tour à l'autre, quand l'acquis permet d'en changer. */
      const avant = new Set(tours.length > 0 ? tours[tours.length - 1].choix : []);
      const tirer = (xs: string[]): string[] =>
        proches([c], xs, corpus, `${graine}/${c}`, PROPOSITIONS_CHAINE - 1);
      const varies = tirer(candidats.filter((x) => !avant.has(x)));
      const leurres = varies.length >= PROPOSITIONS_CHAINE - 1 ? varies : tirer(candidats);
      /* Sans trois leurres sûrs, le maillon ne se pose pas : cette chaîne s'arrête là. */
      if (leurres.length < PROPOSITIONS_CHAINE - 1) break;
      tours.push({
        c,
        enonce:
          k === 1 && tours.length > 0
            ? 'Une autre chaîne : lequel contient ce caractère ?'
            : 'Lequel contient ce caractère ?',
        reponse: [c],
        choix: melange([c, ...leurres], `${graine}/${c}/choix`),
        ordre: false,
        paire: false,
        suite: suite.slice(0, k)
      });
    }
  }
  return tours;
}

/* ---------- jeu 4 : la coquille ---------- */

const HAN = /\p{Script=Han}/u;

/** Les caractères chinois d'un texte, sans la ponctuation. */
export function signes(texte: string): string[] {
  return [...texte].filter((x) => HAN.test(x));
}

/**
 * Un message découpé : ses caractères, et la ponctuation qui suit chacun (vide s'il n'y
 * en a pas). La ponctuation se lit, elle ne se touche pas.
 */
export function decouper(message: string): { signes: string[]; ponctuation: string[] } {
  const out: string[] = [];
  const ponctuation: string[] = [];
  for (const x of message) {
    if (HAN.test(x)) {
      out.push(x);
      ponctuation.push('');
    } else if (out.length > 0 && x.trim() !== '') {
      ponctuation[ponctuation.length - 1] += x;
    }
  }
  return { signes: out, ponctuation };
}

/** Un caractère qu'un message peut porter, ou qu'on peut y glisser : acquis, et dessinable. */
function lisible(c: string, corpus: CorpusJeux): boolean {
  return corpus.acquis.includes(c) && montrable(c, corpus);
}

/**
 * Les mots et les phrases des fiches dont un message peut être fait, entiers, quand tous
 * leurs caractères sont acquis et montrables. Rien n'est écrit par le code : sans eux et
 * sans message rédigé, la coquille se tait plutôt que d'aligner des caractères sans suite.
 */
function morceaux(corpus: CorpusJeux): string[][] {
  const vus = new Set<string>();
  const textes: string[][] = [];
  for (const t of corpus.textes) {
    const s = signes(t);
    const cle = s.join('');
    if (s.length === 0 || s.length > MESSAGE_MAX || vus.has(cle)) continue;
    if (!s.every((c) => lisible(c, corpus))) continue;
    vus.add(cle);
    textes.push(s);
  }
  return textes;
}

/**
 * Les intrus possibles à la place d'un caractère : les autres membres de ses groupes de
 * `paires.json`, et rien d'autre. Un intrus est acquis (on ne piège qu'avec deux
 * caractères qu'on sait lire, brief §7) et absent du message : il ne doit y avoir qu'un
 * seul caractère faux.
 */
export function remplacants(c: string, message: readonly string[], corpus: CorpusJeux): string[] {
  const autres = corpus.paires
    .filter((g) => g.includes(c))
    .flat()
    .filter((x) => x !== c && lisible(x, corpus) && !message.includes(x));
  return [...new Set(autres)];
}

/** La correction par les briques : la décomposition quand on sait la dessiner, sinon le caractère seul. */
function corrige(c: string, corpus: CorpusJeux): Correction {
  const d = briques(c, corpus);
  return { c, briques: d.length >= 2 && d.every((b) => montrable(b, corpus)) ? d : [c] };
}

/** Un message : ses caractères, et l'indice où commence chacun de ses morceaux. */
type Message = { signes: string[]; coupes: number[] };

function composer(textes: readonly string[][], graine: string): Message | null {
  const out: string[] = [];
  const coupes: number[] = [];
  for (const t of melange(textes, `${graine}/textes`)) {
    if (out.length >= MESSAGE_MIN) break;
    if (out.length + t.length <= MESSAGE_MAX) {
      coupes.push(out.length);
      out.push(...t);
    }
  }
  return out.length >= MESSAGE_MIN ? { signes: out, coupes } : null;
}

/** Un tour de coquille : le caractère à la place `i` du message cède la place à `intrus`. */
function tourCoquille(
  corpus: CorpusJeux,
  message: readonly string[],
  i: number,
  intrus: string,
  enPlus: Pick<Tour, 'coupes' | 'ponctuation' | 'traduction'>
): Tour {
  const c = message[i];
  return {
    c,
    enonce: 'Un caractère s’est glissé à la place d’un autre. Touche-le.',
    reponse: [intrus],
    choix: message.map((x, k) => (k === i ? intrus : x)),
    ordre: false,
    paire: true,
    aussi: [intrus],
    ...enPlus,
    correction: [corrige(intrus, corpus), corrige(c, corpus)]
  };
}

/**
 * Les messages rédigés pour l'app (`coquilles.json`) qu'on peut poser : tous leurs
 * caractères acquis, et au moins un de leurs pièges avec un intrus possible. Le piège et
 * l'intrus sont tirés d'après la graine.
 */
function toursRediges(corpus: CorpusJeux, graine: string): Tour[] {
  const tours: Tour[] = [];
  for (const q of melange(corpus.coquilles ?? [], `${graine}/rediges`)) {
    if (tours.length >= TOURS_COQUILLE) break;
    const { signes: s, ponctuation } = decouper(q.message);
    if (s.length < MESSAGE_MIN || s.length > MESSAGE_MAX) continue;
    if (!s.every((c) => lisible(c, corpus))) continue;
    const places = s.flatMap((c, i) => {
      if (!q.pieges.includes(c)) return [];
      const r = remplacants(c, s, corpus);
      return r.length === 0 ? [] : [{ i, r }];
    });
    if (places.length === 0) continue;
    const g = `${graine}/${q.id}`;
    const { i, r } = places[hachage(`${g}/place`) % places.length];
    const intrus = r[hachage(`${g}/intrus`) % r.length];
    tours.push(tourCoquille(corpus, s, i, intrus, { ponctuation, traduction: q.fr }));
  }
  return tours;
}

/**
 * Les messages faits des mots et des phrases des fiches, pour compléter la manche quand
 * les messages rédigés ne suffisent pas. Tout caractère d'un groupe à ne pas confondre
 * peut y être piégé.
 */
function toursDesFiches(
  corpus: CorpusJeux,
  graine: string,
  deja: ReadonlySet<string>,
  n: number
): Tour[] {
  const textes = morceaux(corpus);
  const tours: Tour[] = [];
  const vus = new Set(deja);
  /* Quelques essais de plus que de tours : deux arrangements peuvent donner le même message. */
  for (let essai = 0; essai < TOURS_COQUILLE * 3 && tours.length < n; essai++) {
    const g = `${graine}/coquille/${essai}`;
    const message = composer(textes, g);
    if (message === null) break;
    const places = message.signes.flatMap((c, i) => {
      const r = remplacants(c, message.signes, corpus);
      return r.length === 0 ? [] : [{ i, r }];
    });
    if (places.length === 0) continue;
    const { i, r } = places[hachage(`${g}/place`) % places.length];
    const t = tourCoquille(corpus, message.signes, i, r[0], { coupes: message.coupes });
    const cle = t.choix.join('');
    if (vus.has(cle)) continue;
    vus.add(cle);
    tours.push(t);
  }
  return tours;
}

/**
 * La manche de la coquille : les messages rédigés d'abord, ceux des fiches ensuite.
 * Chaque tour ne piège qu'avec un groupe de `paires.json`, et ne montre que de l'acquis.
 */
function toursCoquille(corpus: CorpusJeux, graine: string): Tour[] {
  const rediges = toursRediges(corpus, graine);
  if (rediges.length >= TOURS_COQUILLE) return rediges;
  const vus = new Set(rediges.map((t) => t.choix.join('')));
  return [...rediges, ...toursDesFiches(corpus, graine, vus, TOURS_COQUILLE - rediges.length)];
}

/* ---------- jeu 5 : les devinettes de lanternes ---------- */

/**
 * Les devinettes qui peuvent se poser : la réponse et toutes ses briques ont une carte
 * (acquises ou en cours), et tout ce que l'écran dessine — réponse, briques, leurres —
 * a ses traits. L'ordre est celui de `devinettes.json`.
 */
export function devinettesPossibles(corpus: CorpusJeux): Devinette[] {
  const l = corpus.lanternes;
  if (!l) return [];
  const connus = new Set(l.connus);
  return l.devinettes.filter(
    (d) =>
      connus.has(d.c) &&
      d.briques.every((b) => connus.has(b)) &&
      [d.c, ...d.briques, ...d.leurres].every((x) => montrable(x, corpus))
  );
}

/**
 * La devinette du jour. Celle déjà posée aujourd'hui le reste, tant qu'on sait la
 * dessiner. Sinon, parmi les possibles, une qui n'a pas encore été résolue — à défaut,
 * n'importe laquelle — tirée d'après la graine, qui porte la journée : la même journée
 * donne la même devinette. `null` quand aucune ne peut se poser.
 */
export function devinetteDuJour(corpus: CorpusJeux, graine: string): Devinette | null {
  const l = corpus.lanternes;
  if (!l) return null;
  if (l.posee !== null) {
    const deja = l.devinettes.find((d) => d.id === l.posee);
    if (deja && [deja.c, ...deja.briques, ...deja.leurres].every((x) => montrable(x, corpus))) {
      return deja;
    }
  }
  const possibles = devinettesPossibles(corpus);
  const resolues = new Set(l.resolues);
  const neuves = possibles.filter((d) => !resolues.has(d.id));
  const pool = neuves.length > 0 ? neuves : possibles;
  let choix: Devinette | null = null;
  let h = 0;
  for (const d of pool) {
    const hd = hachage(`${graine}/${d.id}`);
    if (choix === null || hd < h) {
      choix = d;
      h = hd;
    }
  }
  return choix;
}

function toursDevinette(corpus: CorpusJeux, graine: string): Tour[] {
  const d = devinetteDuJour(corpus, graine);
  if (d === null) return [];
  return [
    {
      c: d.c,
      enonce: d.enonce,
      reponse: [d.c],
      choix: melange([d.c, ...d.leurres], `${graine}/${d.c}/choix`),
      ordre: false,
      paire: false,
      correction: [{ c: d.c, briques: [...d.briques] }],
      devinette: d.id
    }
  ];
}

/** La devinette d'un tour, telle que le contenu la donne. */
export function devinetteDe(t: Tour, corpus: CorpusJeux): Devinette | null {
  return corpus.lanternes?.devinettes.find((d) => d.id === t.devinette) ?? null;
}

/** Le nom d'une brique citée, vide quand le contenu ne le donne pas. */
export function nomDeBrique(b: string, corpus: CorpusJeux): string {
  return corpus.lanternes?.noms[b] ?? '';
}

/** Ce qu'un essai rend : les choix faux déjà pris, et le résultat quand le tour est noté. */
export type Essai = { pris: string[]; resultat: Resultat | null };

/**
 * Un essai à la devinette. Juste : le tour est noté, avec les essais faux d'avant (juste
 * du premier coup, ou juste après une erreur). Faux au premier essai : rien n'est noté,
 * le choix est écarté et l'on essaie encore. Faux au dernier : le tour est noté faux, la
 * réponse est montrée. Les leurres pris accompagnent l'événement ; `grade` note.
 */
export function essayer(m: Manche, choix: string, pris: readonly string[], seconds: number): Essai {
  const t = tour(m);
  if (t === null) throw new Error('Manche finie');
  const juste = choix === t.reponse[0];
  const faux = juste ? [...pris] : [...pris, choix];
  if (!juste && faux.length < ESSAIS_DEVINETTE) return { pris: faux, resultat: null };
  const resultat = repondre(m, choix, {
    correct: juste,
    tries: faux.length,
    seconds,
    leurres: faux
  });
  return { pris: faux, resultat };
}

/**
 * La case Jouer annonce la devinette du jour quand une peut se poser et qu'elle n'est pas
 * déjà faite. Le calcul est celui du jeu, sans les traits : l'export les garantit
 * (`wenlu check`), et le menu ne charge pas toutes les familles pour une ligne.
 */
export function devinetteAAnnoncer(p: Progress, devinettes: readonly Devinette[]): boolean {
  if (devinetteFaite(p, p.day)) return false;
  if (p.devinetteDuJour?.jour === p.day) return true;
  const connus = new Set(p.cartes.map((x) => x.id));
  return devinettes.some((d) => connus.has(d.c) && d.briques.every((b) => connus.has(b)));
}

/* ---------- une manche ---------- */

function manche(jeu: JeuId, graine: string, tours: Tour[]): Manche | null {
  return tours.length === 0 ? null : { jeu, graine, tours, i: 0, evenements: [], trouves: 0 };
}

/** Le tour courant, `null` quand la manche est finie. */
export function tour(m: Manche): Tour | null {
  return m.tours[m.i] ?? null;
}

export function fini(m: Manche): boolean {
  return m.i >= m.tours.length;
}

/**
 * Clôt la manche là où elle en est : les tours non joués tombent, rien n'est noté pour
 * eux. C'est ce que fait la limite de temps de la chaîne, sans reproche.
 */
export function clore(m: Manche): Manche {
  return { ...m, tours: m.tours.slice(0, m.i) };
}

/**
 * Les leurres qu'une réponse désigne, pour le caractère `c` du tour, quand l'écran ne
 * les dit pas. Juste : aucun. Un choix unique faux désigne le caractère pris pour la
 * réponse (la chaîne, les jumeaux). La coquille est à part : ne pas voir l'intrus, c'est
 * avoir lu l'un pour l'autre, l'intrus pour le caractère remplacé et inversement. Un
 * assemblage, où l'ordre compte, ne désigne aucun caractère : `undefined`, et les pièges
 * déjoués restent prudents.
 */
function leurresDuTour(
  t: Tour,
  c: string,
  donnee: readonly string[],
  correct: boolean
): string[] | undefined {
  if (t.ordre) return undefined;
  if (correct) return [];
  if (t.aussi !== undefined && t.aussi.length > 0) return c === t.c ? [...t.aussi] : [t.c];
  return donnee.filter((x) => x !== t.reponse[0]);
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
  /* Un événement par caractère noté : le demandé, puis ceux que la même réponse engage
     (la coquille : l'intrus). Même réponse, même outcome, et `grade` pour chacun. */
  const evenements: Revision[] = [t.c, ...(t.aussi ?? [])].map((c) => {
    /* Les leurres pris, que l'écran les dise ou que le tour les connaisse : les pièges
       déjoués les lisent. */
    const leurres = outcome.leurres ?? leurresDuTour(t, c, donnee, correct);
    return {
      c,
      correct,
      tries: outcome.tries,
      seconds: outcome.seconds,
      ...(leurres === undefined ? {} : { leurres: [...leurres] })
    };
  });
  const evenement = evenements[0];
  return {
    manche: {
      ...m,
      i: m.i + 1,
      evenements: [...m.evenements, ...evenements],
      trouves: m.trouves + (correct ? 1 : 0)
    },
    evenement,
    evenements,
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
  devinette: {
    un: 'devinette résolue',
    plusieurs: 'devinettes résolues',
    aucun: 'la réponse montrée'
  },
  assembler: { un: 'assemblé', plusieurs: 'assemblés', aucun: 'aucun assemblé' },
  jumeaux: {
    un: 'paire distinguée',
    plusieurs: 'paires distinguées',
    aucun: 'aucune paire distinguée'
  },
  chaine: { un: 'maillon trouvé', plusieurs: 'maillons trouvés', aucun: 'aucun maillon trouvé' },
  coquille: {
    un: 'coquille trouvée',
    plusieurs: 'coquilles trouvées',
    aucun: 'aucune coquille trouvée'
  },
  eclair: { un: 'mot deviné', plusieurs: 'mots devinés', aucun: 'aucun mot deviné' }
};

/**
 * Le constat d'une manche : une ligne, deux nombres réels, rien d'autre. Ni score, ni
 * temps, ni félicitation. « 5 caractères revus, 1 paire distinguée. » Les caractères
 * revus sont comptés une fois chacun ; la coquille en revoit deux par message.
 *
 * La chaîne dit sa longueur, départ compris, et c'est tout son constat :
 * « Chaîne de 4, 3 maillons trouvés. » Plusieurs chaînes disent leur nombre et la plus
 * longue : « 3 chaînes, la plus longue de 4, 5 maillons trouvés. » Un maillon manqué
 * est montré, la chaîne continue : il n'y a pas de vie à perdre.
 */
export function constat(m: Manche): string {
  if (m.evenements.length === 0) return 'Rien de revu cette fois.';
  const { un, plusieurs, aucun } = COMPTES[m.jeu];
  const second = m.trouves === 0 ? aucun : pluriel(m.trouves, un, plusieurs);
  if (m.jeu === 'chaine') {
    const ls = longueurs(m);
    if (ls.length <= 1) return `Chaîne de ${longueur(m)}, ${second}.`;
    return `${ls.length} chaînes, la plus longue de ${Math.max(...ls)}, ${second}.`;
  }
  const revus = new Set(m.evenements.map((e) => e.c)).size;
  return `${pluriel(revus, 'caractère revu', 'caractères revus')}, ${second}.`;
}

/** La longueur d'une chaîne jouée : le départ, et un maillon par tour joué. */
export function longueur(m: Manche): number {
  return m.i === 0 ? 0 : m.i + 1;
}

/**
 * La longueur de chaque chaîne jouée, départ compris, dans l'ordre. Une chaîne commence
 * au tour dont la suite n'a que son départ ; les tours non joués ne comptent pas.
 */
export function longueurs(m: Manche): number[] {
  const out: number[] = [];
  for (const t of m.tours.slice(0, m.i)) {
    const n = (t.suite ?? []).length + 1;
    if (n === 2 || out.length === 0) out.push(n);
    else out[out.length - 1] = n;
  }
  return out;
}

/* ---------- les jeux ---------- */

export const JEUX: Record<JeuId, Jeu> = {
  devinette: {
    id: 'devinette',
    titre: 'La devinette du jour',
    lit: 'Retrouver un caractère dans une décomposition déguisée.',
    minutes: 1,
    tours: 1,
    chrono: 0,
    limite: 0,
    indisponible:
      'Pas encore de devinette dont la réponse et les briques soient acquises ou en cours.',
    preparer: (corpus, graine) => manche('devinette', graine, toursDevinette(corpus, graine)),
    repondre,
    constat
  },
  assembler: {
    id: 'assembler',
    titre: 'Assembler contre la montre',
    lit: 'Produire un caractère à partir de ses briques, dans l’ordre d’écriture.',
    minutes: 2,
    tours: TOURS_ASSEMBLAGE,
    chrono: CHRONO_ASSEMBLAGE_MS,
    limite: 0,
    indisponible: 'Pas encore de caractère acquis dont on connaisse les briques.',
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
    limite: 0,
    indisponible: 'Pas encore de caractères acquis assez proches pour les opposer.',
    preparer: (corpus, graine) =>
      manche('jumeaux', graine, toursJumeaux(corpus, graine, PAIRES_PAR_MINUTE)),
    repondre,
    constat
  },
  chaine: {
    id: 'chaine',
    titre: 'La chaîne',
    lit: 'Voir un caractère à l’intérieur d’un autre, maillon après maillon.',
    minutes: MINUTES_MAX,
    tours: MAILLONS_MAX,
    chrono: 0,
    limite: LIMITE_CHAINE_MS,
    indisponible: 'Aucun caractère acquis n’en contient encore un autre.',
    preparer: (corpus, graine) => manche('chaine', graine, toursChaine(corpus, graine)),
    repondre,
    constat
  },
  coquille: {
    id: 'coquille',
    titre: 'La coquille',
    lit: 'Trouver le caractère faux dans un message écrit avec l’acquis.',
    minutes: 2,
    tours: TOURS_COQUILLE,
    chrono: 0,
    limite: 0,
    indisponible:
      'Elle s’ouvre quand les deux caractères d’une paire à ne pas confondre sont acquis.',
    preparer: (corpus, graine) => manche('coquille', graine, toursCoquille(corpus, graine)),
    repondre,
    constat
  },
  eclair: {
    id: 'eclair',
    titre: 'Le dictionnaire éclair',
    lit: 'Deviner le sens d’un mot jamais appris, depuis ses deux caractères.',
    minutes: 2,
    tours: TOURS_ECLAIR,
    chrono: 0,
    limite: 0,
    indisponible: 'Pas encore de mot nouveau dont les deux caractères soient acquis.',
    preparer: (corpus, graine) => manche('eclair', graine, toursEclair(corpus, graine)),
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

/**
 * La posture de Tao pendant une manche (brief §9). La coquille se lit comme un texte :
 * elle lit le message par-dessus l'épaule. Les autres jeux la trouvent en posture de
 * jeu, la lanterne à la main, la tête penchée sur ce qu'on cherche.
 */
export function postureDuJeu(id: JeuId | null): Posture {
  return id === 'coquille' ? 'lecture' : 'jeu';
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
