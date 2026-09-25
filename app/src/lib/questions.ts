/**
 * Les huit types de questions de la révision, et le choix des leurres par ressemblance
 * de composants (et de son, pour la question posée à l'oreille).
 *
 * Tout ce module est pur : aucune requête, aucun accès au stockage, aucune horloge,
 * aucun `Math.random`. Les données (fiches, décompositions, acquis, paires à ne pas
 * confondre) sont injectées dans un `Corpus`, et tout tirage part d'une graine, pour que
 * la même graine rende toujours la même question. Les écrans Échauffer et Fixer se
 * contentent d'afficher ce qui sort d'ici et de renvoyer la réponse à `corriger`.
 *
 * La notation reste dans `srs.ts` : `corriger` rend un `Outcome` prêt pour `grade`,
 * il ne note jamais lui-même.
 */
import { SEUIL_DEBLOCAGE, stability, type Outcome, type ReviewCard } from './srs';
import type { Etiquette, Fiche, Mot, Role } from './content';

/* ---------- les huit types ---------- */

/**
 * - `sens` : le sens d'un caractère ;
 * - `caractere` : le caractère à partir du sens ;
 * - `assemblage` : assembler les briques dans l'ordre d'écriture ;
 * - `trou` : un trou dans un mot ;
 * - `oreille` : reconnaître le caractère entendu, dit par le fichier audio de la fiche ou,
 *   à défaut, par la voix mandarin de l'appareil ;
 * - `ton` : trouver le ton de la lecture principale, le pinyin donné sans ton ;
 * - `son` : « quel élément donne le son ? » ;
 * - `trace` : tracé au doigt, délégué à Hanzi Writer.
 */
export type TypeQuestion =
  | 'sens'
  | 'caractere'
  | 'assemblage'
  | 'trou'
  | 'oreille'
  | 'ton'
  | 'son'
  | 'trace';

/** L'ordre de référence des huit types. */
export const TYPES: readonly TypeQuestion[] = [
  'sens',
  'caractere',
  'assemblage',
  'trou',
  'oreille',
  'ton',
  'son',
  'trace'
];

/** Le nom du type affiché en haut de l'écran de révision. */
export const LABELS: Record<TypeQuestion, string> = {
  sens: 'Sens',
  caractere: 'Caractère',
  assemblage: 'Assemblage',
  trou: 'Dans un mot',
  oreille: 'À l’oreille',
  ton: 'Le ton',
  son: 'Son ou sens',
  trace: 'Tracé'
};

/** Trois leurres par question quand le corpus le permet. */
export const NB_LEURRES = 3;

/** Deux caractères faits du même nombre de composants se ressemblent un peu plus. */
export const BONUS_MEME_NOMBRE = 0.25;

/** Une paire à ne pas confondre passe devant tout le reste. */
export const BONUS_PAIRE = 2;

/**
 * À l'oreille, un caractère de même syllabe à un autre ton (妈 mā pour 马 mǎ) est le
 * leurre le plus proche : il passe devant la seule ressemblance de forme.
 */
export const BONUS_MEME_SYLLABE = 1;

/** Tracé : au-delà de deux erreurs, la réponse est fausse. */
export const ERREURS_TRACE_MAX = 2;

/**
 * Les paires à ne pas confondre sont celles de l'export versionné : `content.pairesExport`
 * les charge (`data/<version>/paires.json`) et `lirePaires` les valide ici. La liste de
 * démonstration reste lisible par `content.pairesOnce`, pour les tests de la maquette.
 */

/* ---------- le corpus injecté ---------- */

/** Un caractère acquis : une carte de `srs.ts`, ou directement sa stabilité. */
export type Acquis = ReviewCard | { c: string; stabilite: number };

/** Groupes de caractères à ne pas confondre (己 已 巳, 未 末, …). */
export type Paires = readonly (readonly string[])[];

/** Tout ce dont le module a besoin. Rien n'est lu ailleurs. */
export type Corpus = {
  /** Les fiches disponibles, une par caractère. */
  fiches: readonly Fiche[];
  /** Décompositions canoniques GF 0014-2009 : `{caractère: composants[]}`. */
  decompositions: Readonly<Record<string, readonly string[]>>;
  /** L'acquis de l'utilisateur, avec la stabilité FSRS de chaque caractère. */
  acquis: readonly Acquis[];
  /** Les paires à ne pas confondre (`data/<version>/paires.json`). */
  paires?: Paires;
  /** Stabilité minimale pour compter comme acquis. Défaut : le seuil de déblocage. */
  seuil?: number;
  /** Tracé activé dans les réglages. Défaut : activé. */
  trace?: boolean;
  /**
   * L'appareil a une voix mandarin (`audio.voixMandarin`) : la question `oreille` peut se
   * poser sans fichier audio. Défaut : non, jamais d'écran muet.
   */
  voix?: boolean;
};

/** Relit le fichier des paires à ne pas confondre. Pur : l'appelant fait la requête. */
export function lirePaires(brut: unknown): Paires {
  const o = brut as { paires?: unknown } | null;
  if (!o || !Array.isArray(o.paires)) return [];
  return (o.paires as unknown[])
    .filter((g): g is string[] => Array.isArray(g) && g.every((x) => typeof x === 'string'))
    .map((g) => [...g]);
}

/* ---------- la question ---------- */

/** La fiche d'explication par les briques, montrée à la correction. */
export type Explication = {
  c: string;
  pinyin: string;
  fr: string;
  /**
   * L'origine est attestée ou mnémotechnique, jamais l'un pour l'autre. Nulle quand
   * la fiche n'a pas encore d'origine : pas d'étiquette sans texte derrière.
   */
  etiquette: Etiquette | null;
  /** Une ligne par brique, dans l'ordre d'écriture. */
  briques: { c: string; fr: string; role: Role | null }[];
  /** Le texte de correction, assemblé à partir des fiches. Rien n'est rédigé ici. */
  texte: string;
};

/**
 * Une question posée. `reponse` est toujours une liste : un seul élément, sauf pour
 * `assemblage` où c'est la suite des briques dans l'ordre d'écriture. `choix` est vide
 * pour `trace`, qui n'est pas un QCM.
 */
export type Question = {
  type: TypeQuestion;
  label: string;
  /** Le caractère révisé : l'identifiant de la carte SRS. */
  c: string;
  enonce: string;
  reponse: string[];
  leurres: string[];
  /**
   * Le caractère derrière chaque leurre, dans le même ordre, quand le leurre ne l'est pas
   * lui-même : pour `sens`, les leurres sont des sens, et chacun vient d'un caractère.
   * Absent quand chaque leurre est son propre caractère.
   */
  sourcesLeurres?: string[];
  /** Les options présentées, mélangées d'après la graine. */
  choix: string[];
  /** Ce qu'il a manqué pour arriver à `NB_LEURRES` leurres. Zéro quand le compte y est. */
  manqueLeurres: number;
  /** La décomposition canonique du caractère, ordre d'écriture. */
  briques: string[];
  explication: Explication;
  /** `trou` : le mot, et les deux moitiés autour du trou. */
  mot?: Mot;
  avant?: string;
  apres?: string;
  /**
   * `oreille` : référence du fichier audio de la fiche, quand elle en a. Sans elle, le
   * caractère est dit par la voix de l'appareil (`audio.dire`).
   */
  audio?: string;
  /** `ton` : le pinyin de la lecture principale, sans son ton (`ma`). */
  sansTon?: string;
  /** `trace` : nombre de traits, quand les données de tracé sont là. */
  traits?: number;
};

/* ---------- tirage déterministe ---------- */

/** Hachage FNV-1a 32 bits. Pas de `Math.random` : à graine égale, tirage égal. */
export function hachage(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mélange déterministe : même liste et même graine, même ordre. */
export function melange<T>(xs: readonly T[], graine: string): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = hachage(`${graine}/${i}`) % (i + 1);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/* ---------- lecture du corpus ---------- */

export function caractereAcquis(a: Acquis): string {
  return 'id' in a ? a.id : a.c;
}

export function stabiliteAcquis(a: Acquis): number {
  return 'id' in a ? stability(a) : a.stabilite;
}

/** Les caractères dont la stabilité FSRS atteint le seuil. */
export function acquis(corpus: Corpus): string[] {
  const seuil = corpus.seuil ?? SEUIL_DEBLOCAGE;
  const vus = new Set<string>();
  const out: string[] = [];
  for (const a of corpus.acquis) {
    const c = caractereAcquis(a);
    if (stabiliteAcquis(a) >= seuil && !vus.has(c)) {
      vus.add(c);
      out.push(c);
    }
  }
  return out;
}

export function estAcquis(c: string, corpus: Corpus): boolean {
  return acquis(corpus).includes(c);
}

export function fiche(c: string, corpus: Corpus): Fiche | null {
  return corpus.fiches.find((f) => f.c === c) ?? null;
}

/**
 * Les composants canoniques d'un caractère. La table des décompositions fait foi ;
 * à défaut la fiche ; à défaut le caractère est sa propre brique (composant de base).
 */
export function composants(c: string, corpus: Corpus): string[] {
  const table = corpus.decompositions[c];
  if (table && table.length > 0) return [...table];
  const f = fiche(c, corpus);
  if (f && f.parts.length > 0) return [...f.parts];
  return [c];
}

/** Deux caractères du même groupe à ne pas confondre. */
export function memePaire(a: string, b: string, corpus: Corpus): boolean {
  return (corpus.paires ?? []).some((g) => g.includes(a) && g.includes(b));
}

/**
 * Ressemblance de deux caractères : Jaccard sur les composants canoniques,
 * bonus si même nombre de composants, bonus fort pour une paire à ne pas confondre.
 */
export function ressemblance(a: string, b: string, corpus: Corpus): number {
  const A = new Set(composants(a, corpus));
  const B = new Set(composants(b, corpus));
  const communs = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  let score = union === 0 ? 0 : communs / union;
  if (A.size === B.size) score += BONUS_MEME_NOMBRE;
  if (memePaire(a, b, corpus)) score += BONUS_PAIRE;
  return score;
}

/* ---------- les leurres ---------- */

type Affichage = (c: string) => string;

/**
 * Trie les candidats par ressemblance décroissante avec les cibles, départage par la
 * graine, et garde les `n` premiers dont l'affichage est nouveau. Jamais la bonne
 * réponse, jamais deux fois la même valeur.
 */
function choisirLeurres(
  cibles: readonly string[],
  candidats: readonly string[],
  corpus: Corpus,
  graine: string,
  n: number,
  exclus: readonly string[],
  valeur: Affichage,
  dejaVus: readonly string[],
  bonus: (c: string) => number = () => 0
): { leurres: string[]; sources: string[]; manque: number } {
  const interdits = new Set(exclus);
  const uniques = [...new Set(candidats)].filter((c) => !interdits.has(c));
  const score = (c: string) =>
    Math.max(...cibles.map((cible) => ressemblance(c, cible, corpus))) + bonus(c);
  const classe = uniques
    .map((c) => ({ c, s: score(c), h: hachage(`${graine}/${c}`) }))
    .sort((x, y) => y.s - x.s || x.h - y.h || (x.c < y.c ? -1 : 1));
  const vus = new Set(dejaVus);
  const out: string[] = [];
  const sources: string[] = [];
  for (const { c } of classe) {
    if (out.length >= n) break;
    const v = valeur(c);
    if (v === '' || vus.has(v)) continue;
    vus.add(v);
    out.push(v);
    sources.push(c);
  }
  return { leurres: out, sources, manque: Math.max(0, n - out.length) };
}

/**
 * Les leurres d'un caractère, pris parmi les candidats fournis, du plus ressemblant au
 * moins ressemblant. Le manque est signalé quand le corpus ne permet pas `n` leurres.
 */
export function leurres(
  cible: string,
  candidats: readonly string[],
  corpus: Corpus,
  graine: string,
  n: number = NB_LEURRES
): { leurres: string[]; manque: number } {
  const { leurres: l, manque } = choisirLeurres([cible], candidats, corpus, graine, n, [cible], (c) => c, [cible]);
  return { leurres: l, manque };
}

/** Les caractères qui peuvent servir de leurre : l'acquis d'abord, le reste ensuite. */
function candidatsCaracteres(c: string, corpus: Corpus, acquisSeulement: boolean): string[] {
  const connus = acquis(corpus).filter((x) => x !== c && fiche(x, corpus) !== null);
  if (acquisSeulement) return connus;
  const reste = corpus.fiches.map((f) => f.c).filter((x) => x !== c && !connus.includes(x));
  return [...connus, ...reste];
}

/**
 * Les briques qui peuvent servir de leurre dans un assemblage : les composants des
 * caractères acquis, et les caractères acquis qui sont eux-mêmes des briques de base.
 * Jamais une brique du caractère demandé, jamais le caractère demandé.
 */
function candidatsBriques(f: Fiche, corpus: Corpus): string[] {
  const exclus = new Set([f.c, ...f.parts]);
  const out: string[] = [];
  for (const c of acquis(corpus)) {
    const g = fiche(c, corpus);
    const briques = g !== null && !estBrique(g) ? composants(c, corpus) : [c, ...composants(c, corpus)];
    for (const b of briques) {
      if (!exclus.has(b) && !out.includes(b)) out.push(b);
    }
  }
  return out;
}

/* ---------- les tons ---------- */

/** Les voyelles qui portent le ton, et leurs quatre marques (1 à 4). */
const MARQUES: Readonly<Record<string, string>> = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ'
};

/** Les diacritiques des quatre tons après décomposition (NFD). Le tréma du ü n'en est pas. */
const DIACRITIQUES_TONS: readonly string[] = ['\u0304', '\u0301', '\u030C', '\u0300'];

/** Une syllabe de pinyin sans ton, en minuscules : `ma`, `lüe`. */
const SYLLABE = /^[a-zü]+$/;

/** Le ton d'une syllabe : 1 à 4, 0 pour le ton neutre (aucune marque). */
export function tonDe(syllabe: string): number {
  const d = syllabe.normalize('NFD');
  let ton = 0;
  DIACRITIQUES_TONS.forEach((m, i) => {
    if (d.includes(m)) ton = i + 1;
  });
  return ton;
}

/** La syllabe sans son ton, le ü gardé : `lǜ` donne `lü`. */
export function sansTon(syllabe: string): string {
  let d = syllabe.normalize('NFD');
  for (const m of DIACRITIQUES_TONS) d = d.split(m).join('');
  return d.normalize('NFC');
}

/**
 * Pose le ton `ton` (1 à 4) sur la voyelle qui le porte : a ou e d'abord, le o de « ou »,
 * sinon la dernière voyelle (`gui` donne `guì`, `liu` donne `liù`). 0 : le ton neutre, la
 * syllabe nue. `null` si la syllabe n'a pas de voyelle où le poser.
 */
export function marquerTon(base: string, ton: number): string | null {
  if (ton === 0) return base;
  const poser = (i: number) => `${base.slice(0, i)}${MARQUES[base[i]][ton - 1]}${base.slice(i + 1)}`;
  for (const v of ['a', 'e']) {
    const i = base.indexOf(v);
    if (i >= 0) return poser(i);
  }
  const ou = base.indexOf('ou');
  if (ou >= 0) return poser(ou);
  for (let i = base.length - 1; i >= 0; i--) if (base[i] in MARQUES) return poser(i);
  return null;
}

/** Les lectures valides d'une fiche, en NFC : celles de l'export, sinon son seul pinyin. */
export function lecturesDe(f: Fiche): string[] {
  const brutes = f.lectures && f.lectures.length > 0 ? f.lectures : [f.pinyin];
  return brutes.map((x) => x.normalize('NFC').trim().toLowerCase()).filter((x) => x !== '');
}

/** La question de ton d'une fiche : la syllabe sans ton, la bonne lecture, les options. */
export type SyllabesDuTon = { base: string; bonne: string; options: string[]; leurres: string[] };

/**
 * La question de ton d'une fiche : la syllabe sans ton, la bonne lecture, et les options
 * dans l'ordre des tons (ā á ǎ à, puis le ton neutre). Seule la lecture principale
 * exportée est acceptée ; le ton neutre n'est proposé que si c'est le sien, et aucune
 * autre lecture valide du caractère (好 hào pour hǎo) n'est jamais un leurre.
 *
 * `null` quand l'export ne dit pas toutes les lectures (`lectures` absent, ou la
 * principale n'y est pas en tête), quand le pinyin n'est pas une syllabe simple, ou
 * quand il ne reste aucun leurre.
 */
export function syllabesDuTon(f: Fiche): SyllabesDuTon | null {
  const principale = f.pinyin.normalize('NFC').trim().toLowerCase();
  if (principale === '' || !f.lectures || f.lectures.length === 0) return null;
  const valides = lecturesDe(f);
  if (valides[0] !== principale) return null;
  const base = sansTon(principale);
  if (!SYLLABE.test(base)) return null;
  const tons = tonDe(principale) === 0 ? [1, 2, 3, 4, 0] : [1, 2, 3, 4];
  const options: string[] = [];
  for (const t of tons) {
    const o = marquerTon(base, t);
    if (o === null) return null;
    if (o === principale || !valides.includes(o)) options.push(o);
  }
  const leurres = options.filter((o) => o !== principale);
  if (!options.includes(principale) || leurres.length === 0) return null;
  return { base, bonne: principale, options, leurres };
}

/**
 * Deux caractères que l'oreille ne départage pas : une lecture valide en commun (是 et
 * 事, shì). Un caractère sans pinyin connu ne se départage pas non plus, par prudence.
 */
export function homophones(a: Fiche, b: Fiche): boolean {
  const la = lecturesDe(a);
  const lb = lecturesDe(b);
  if (la.length === 0 || lb.length === 0) return true;
  return la.some((x) => lb.includes(x));
}

/** Même syllabe, ton mis à part (妈 mā, 马 mǎ) : le leurre le plus proche à l'oreille. */
function memeSyllabe(a: Fiche, b: Fiche): boolean {
  const sa = new Set(lecturesDe(a).map(sansTon));
  return lecturesDe(b).some((x) => sa.has(sansTon(x)));
}

/* ---------- ce que la fiche permet de demander ---------- */

/** Une brique de base : elle ne se décompose pas. */
export function estBrique(f: Fiche): boolean {
  return f.parts.length === 0 || (f.parts.length === 1 && f.parts[0] === f.c);
}

/** L'élément qui donne le son, d'après le rôle de la fiche du composant. */
export function composantSon(f: Fiche, corpus: Corpus): string | null {
  if (f.parts.length < 2) return null;
  return f.parts.find((p) => fiche(p, corpus)?.role === 'son') ?? null;
}

/** Le mot qui porte le caractère, pour le trou. */
export function motDuTrou(f: Fiche): Mot | null {
  return f.mots.find((m) => m.hanzi.includes(f.c)) ?? null;
}

/** La référence audio : celle de la fiche, sinon celle d'un de ses mots. */
export function audioDe(f: Fiche): string | null {
  if (f.audio) return f.audio;
  return f.mots.find((m) => m.audio)?.audio ?? null;
}

/** Le caractère peut-il être dit : son fichier audio, ou la voix mandarin de l'appareil. */
export function peutEtreDit(f: Fiche, corpus: Corpus): boolean {
  return f.pinyin !== '' && (audioDe(f) !== null || corpus.voix === true);
}

/**
 * Les caractères acquis qui peuvent servir de leurre à l'oreille : jamais un homophone
 * de la cible, que l'oreille ne départagerait pas.
 */
function candidatsOreille(f: Fiche, corpus: Corpus): string[] {
  return candidatsCaracteres(f.c, corpus, true).filter((x) => {
    const g = fiche(x, corpus);
    return g !== null && !homophones(f, g);
  });
}

/**
 * Les types que cette fiche permet de poser, dans l'ordre de `TYPES`.
 * `son` demande un composant de rôle son ; `trou` un mot ; `oreille` un pinyin, et un
 * fichier audio ou la voix mandarin de l'appareil (jamais d'écran muet) ; `ton` une
 * lecture principale exportée avec toutes les autres (`syllabesDuTon`) ; `trace` une
 * brique de base et le tracé activé ; les QCM sur caractères demandent au moins un autre
 * caractère acquis à montrer.
 */
export function typesPossibles(f: Fiche, corpus: Corpus): TypeQuestion[] {
  const connus = candidatsCaracteres(f.c, corpus, true).length;
  const out: TypeQuestion[] = [];
  if (f.fr !== '') out.push('sens');
  if (f.fr !== '' && connus > 0) out.push('caractere');
  if (f.parts.length >= 2) out.push('assemblage');
  if (motDuTrou(f) !== null && connus > 0) out.push('trou');
  if (peutEtreDit(f, corpus) && candidatsOreille(f, corpus).length > 0) out.push('oreille');
  if (syllabesDuTon(f) !== null) out.push('ton');
  if (composantSon(f, corpus) !== null) out.push('son');
  if (estBrique(f) && corpus.trace !== false) out.push('trace');
  return out;
}

/* ---------- l'explication par les briques ---------- */

/**
 * La fiche de correction. Le texte n'est pas rédigé ici : il assemble ce que le pipeline
 * `data/` a produit (pinyin, sens, origine) autour de la décomposition canonique.
 */
export function expliquer(f: Fiche, corpus: Corpus): Explication {
  const briques = f.parts.map((p) => {
    const g = fiche(p, corpus);
    return { c: p, fr: g?.fr ?? '', role: g?.role ?? null };
  });
  /* Sans fiche relue, il n'y a ni sens ni origine : l'explication se tait plutôt que
     d'afficher une virgule vide. Elle garde la décomposition, qui, elle, est établie. */
  const tete = f.fr === '' ? `${f.c} ${f.pinyin}.` : `${f.c} ${f.pinyin}, ${f.fr}.`;
  const lignes = briques.map((b) => (b.fr === '' ? b.c : `${b.c} ${b.fr}`));
  const corps = briques.length > 0 ? ` ${f.parts.join(' + ')} : ${lignes.join(', ')}.` : '';
  const origine = f.origine_fr === '' ? '' : ` ${f.origine_fr}`;
  return {
    c: f.c,
    pinyin: f.pinyin,
    fr: f.fr,
    etiquette: f.etiquette,
    briques,
    texte: `${tete}${corps}${origine}`
  };
}

/* ---------- fabrication d'une question ---------- */

function base(f: Fiche, type: TypeQuestion, corpus: Corpus): Question {
  return {
    type,
    label: LABELS[type],
    c: f.c,
    enonce: '',
    reponse: [f.c],
    leurres: [],
    choix: [],
    manqueLeurres: 0,
    briques: [...f.parts],
    explication: expliquer(f, corpus)
  };
}

/** Une question du type demandé. Lève si la fiche ne permet pas ce type. */
export function question(
  f: Fiche,
  type: TypeQuestion,
  corpus: Corpus,
  graine: string
): Question {
  if (!typesPossibles(f, corpus).includes(type)) {
    throw new Error(`Type de question impossible pour ${f.c} : ${type}`);
  }
  const g = `${graine}/${f.c}/${type}`;
  const q = base(f, type, corpus);

  if (type === 'sens') {
    const bonne = f.fr;
    const sens = choisirLeurres(
      [f.c],
      candidatsCaracteres(f.c, corpus, false),
      corpus,
      g,
      NB_LEURRES,
      [f.c],
      (c) => fiche(c, corpus)?.fr ?? '',
      [bonne]
    );
    q.enonce = 'Que veut dire ce caractère ?';
    q.reponse = [bonne];
    q.leurres = sens.leurres;
    q.sourcesLeurres = sens.sources;
    q.manqueLeurres = sens.manque;
    q.choix = melange([bonne, ...sens.leurres], g);
    return q;
  }

  if (type === 'caractere') {
    const tirage = leurres(f.c, candidatsCaracteres(f.c, corpus, true), corpus, g);
    q.enonce = `Lequel se lit ${f.pinyin} et veut dire « ${f.fr} » ?`;
    q.leurres = tirage.leurres;
    q.manqueLeurres = tirage.manque;
    q.choix = melange([f.c, ...tirage.leurres], g);
    return q;
  }

  if (type === 'assemblage') {
    const tirage = choisirLeurres(
      f.parts,
      candidatsBriques(f, corpus),
      corpus,
      g,
      NB_LEURRES,
      f.parts,
      (c) => c,
      f.parts
    );
    /* La cible (sens et pinyin) est affichée en grand par l'écran ; l'énoncé dit le geste. */
    q.enonce = `Touche les ${f.parts.length} briques dans l'ordre d'écriture pour former ce caractère :`;
    q.reponse = [...f.parts];
    q.leurres = tirage.leurres;
    q.manqueLeurres = tirage.manque;
    q.choix = melange([...f.parts, ...tirage.leurres], g);
    return q;
  }

  if (type === 'trou') {
    const mot = motDuTrou(f);
    if (mot === null) throw new Error(`Aucun mot pour le trou : ${f.c}`);
    const i = mot.hanzi.indexOf(f.c);
    const tirage = leurres(f.c, candidatsCaracteres(f.c, corpus, true), corpus, g);
    q.enonce = `Complète : « ${mot.fr} ».`;
    q.mot = mot;
    q.avant = mot.hanzi.slice(0, i);
    q.apres = mot.hanzi.slice(i + f.c.length);
    q.leurres = tirage.leurres;
    q.manqueLeurres = tirage.manque;
    q.choix = melange([f.c, ...tirage.leurres], g);
    return q;
  }

  if (type === 'oreille') {
    /* Les leurres ressemblent par la forme ou par le son (même syllabe, autre ton). */
    const tirage = choisirLeurres(
      [f.c],
      candidatsOreille(f, corpus),
      corpus,
      g,
      NB_LEURRES,
      [f.c],
      (c) => c,
      [f.c],
      (c) => {
        const x = fiche(c, corpus);
        return x !== null && memeSyllabe(f, x) ? BONUS_MEME_SYLLABE : 0;
      }
    );
    const audio = audioDe(f);
    q.enonce = 'Écoute, puis choisis.';
    if (audio !== null) q.audio = audio;
    q.leurres = tirage.leurres;
    q.manqueLeurres = tirage.manque;
    q.choix = melange([f.c, ...tirage.leurres], g);
    return q;
  }

  if (type === 'ton') {
    const t = syllabesDuTon(f);
    if (t === null) throw new Error(`Aucune question de ton : ${f.c}`);
    /* Les syllabes restent dans l'ordre des tons, comme on les récite : mā má mǎ mà. */
    q.enonce = 'Avec quel ton se lit ce caractère ?';
    q.sansTon = t.base;
    q.reponse = [t.bonne];
    q.leurres = t.leurres;
    q.manqueLeurres = Math.max(0, NB_LEURRES - t.leurres.length);
    q.choix = t.options;
    return q;
  }

  if (type === 'son') {
    const bonne = composantSon(f, corpus);
    if (bonne === null) throw new Error(`Aucun composant de son : ${f.c}`);
    const autres = f.parts.filter((p) => p !== bonne);
    const tirage = choisirLeurres([bonne], autres, corpus, g, NB_LEURRES, [bonne], (c) => c, [bonne]);
    q.enonce = `Dans ${f.c}, quel élément donne le son ?`;
    q.reponse = [bonne];
    q.leurres = tirage.leurres;
    q.manqueLeurres = tirage.manque;
    q.choix = melange([bonne, ...tirage.leurres], g);
    return q;
  }

  const traits = f.traits?.length ?? 0;
  q.enonce = traits > 0 ? `Trace ${f.c} au doigt. ${traits} traits.` : `Trace ${f.c} au doigt.`;
  if (traits > 0) q.traits = traits;
  return q;
}

/* ---------- une série de questions ---------- */

/** Une carte due : la carte SRS elle-même, ou simplement le caractère. */
export type Due = ReviewCard | string;

function caractereDu(d: Due): string {
  return typeof d === 'string' ? d : d.id;
}

/**
 * Une carte se pose en question quand le corpus porte sa fiche et que la fiche permet au
 * moins un des huit types. Sinon `serie` la passe, et `horsSerie` la nomme.
 */
export function posable(c: string, corpus: Corpus): boolean {
  const f = fiche(c, corpus);
  return f !== null && typesPossibles(f, corpus).length > 0;
}

/**
 * Les cartes d'une pile que `serie` passe : sans fiche dans le corpus, ou sans type que
 * la fiche permette (une brique sans texte, le tracé désactivé). Chacune une fois, dans
 * l'ordre reçu. On les signale pour qu'aucune ne reste due en silence ; la carte, elle,
 * n'est jamais perdue.
 */
export function horsSerie(dues: readonly Due[], corpus: Corpus): string[] {
  const out: string[] = [];
  for (const d of dues) {
    const c = caractereDu(d);
    if (!out.includes(c) && !posable(c, corpus)) out.push(c);
  }
  return out;
}

/**
 * Les questions d'une pile de cartes dues, dans l'ordre reçu. Le type varie : jamais deux
 * fois le même type d'affilée tant que la fiche permet autre chose. Les cartes sans fiche
 * ou sans type possible sont passées : `horsSerie` les nomme.
 */
export function serie(dues: readonly Due[], corpus: Corpus, graine: string): Question[] {
  const out: Question[] = [];
  let precedent: TypeQuestion | null = null;
  dues.forEach((d, i) => {
    const c = caractereDu(d);
    if (!posable(c, corpus)) return;
    const f = fiche(c, corpus) as Fiche;
    const possibles = typesPossibles(f, corpus);
    const classes = [...possibles].sort(
      (x, y) => hachage(`${graine}/${i}/${c}/${x}`) - hachage(`${graine}/${i}/${c}/${y}`)
    );
    const t = classes.find((x) => x !== precedent) ?? classes[0];
    out.push(question(f, t, corpus, `${graine}/${i}`));
    precedent = t;
  });
  return out;
}

/* ---------- correction ---------- */

/** La réponse de l'utilisateur : une option, une suite de briques, ou le bilan du tracé. */
export type Reponse = string | readonly string[] | { erreurs: number };

/**
 * La ligne affichée après une première erreur : un constat et ce qu'il reste à faire.
 * « Regarde les briques » n'a de sens que pour un caractère fait de plusieurs briques ;
 * un assemblage raté se refait dans l'ordre d'écriture.
 */
export function indiceErreur(q: Question): string {
  if (q.type === 'assemblage') return "Pas cette suite. Recommence, dans l'ordre d'écriture.";
  if (q.type === 'ton') return 'Pas ce ton. Encore un essai.';
  if (q.type === 'oreille') return 'Pas celui-là. Réécoute.';
  if (q.briques.length > 1) return 'Pas celui-là. Regarde les briques.';
  return 'Pas celui-là. Encore un essai.';
}

export type Correction = { correct: boolean; explication: Explication; outcome: Outcome };

/**
 * Les caractères que désigne une réponse fausse : le leurre choisi, ou les leurres posés
 * dans un assemblage. Un sens choisi désigne le caractère dont il est le sens. Une brique
 * juste mal placée, une réponse juste, un ton ou un tracé ne désignent aucun leurre.
 */
export function leurresDe(q: Question, reponse: Reponse): string[] {
  if (typeof reponse === 'object' && !Array.isArray(reponse)) return [];
  /* Un ton pris pour un autre ne désigne aucun caractère. */
  if (q.type === 'ton') return [];
  const donnee = typeof reponse === 'string' ? [reponse] : [...(reponse as readonly string[])];
  const out: string[] = [];
  for (const x of donnee) {
    const i = q.leurres.indexOf(x);
    if (i < 0) continue;
    const c = q.sourcesLeurres?.[i] ?? x;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Le tracé est noté par Hanzi Writer, qui rend le nombre d'erreurs :
 * 0 erreur = juste, 1 ou 2 = juste après erreur, 3 et plus = faux.
 */
export function outcomeDuTrace(erreurs: number, seconds: number): Outcome {
  const correct = erreurs <= ERREURS_TRACE_MAX;
  return { correct, tries: correct && erreurs > 0 ? 1 : erreurs, seconds };
}

function memeSuite(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Corrige une réponse. Pour `assemblage`, l'ordre d'écriture compte. L'`Outcome` rendu est
 * prêt pour `grade` de `srs.ts` : il n'est pas noté ici.
 *
 * `ratees` sont les réponses fausses des essais d'avant. Dès qu'un choix a été faux,
 * l'`Outcome` garde les leurres qu'il désignait (`leurresDe`), ceux des essais d'avant
 * puis celui-ci : c'est ce qui dit, plus tard, si deux caractères proches ont été confondus.
 */
export function corriger(
  q: Question,
  reponse: Reponse,
  outcome: Outcome,
  ratees: readonly Reponse[] = []
): Correction {
  if (typeof reponse === 'object' && !Array.isArray(reponse)) {
    const { erreurs } = reponse as { erreurs: number };
    const o = outcomeDuTrace(erreurs, outcome.seconds);
    return { correct: o.correct, explication: q.explication, outcome: o };
  }
  const donnee = typeof reponse === 'string' ? [reponse] : [...(reponse as readonly string[])];
  const correct =
    memeSuite(donnee, q.reponse) ||
    (donnee.length === 1 && q.reponse.length > 1 && donnee[0] === q.reponse.join(''));
  const o: Outcome = { correct, tries: outcome.tries, seconds: outcome.seconds };
  const fausses = correct ? ratees : [...ratees, reponse];
  if (fausses.length > 0) o.leurres = [...new Set(fausses.flatMap((r) => leurresDe(q, r)))];
  return { correct, explication: q.explication, outcome: o };
}
