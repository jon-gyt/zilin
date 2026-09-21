/**
 * L'état d'une session : six pas, toujours dans le même ordre, reprise au pas exact,
 * remise à zéro à chaque nouvelle journée, rattrapage après une absence.
 *
 * Tout ce module est pur : aucune fonction ne lit l'horloge ni n'écrit dans un stockage.
 * La journée courante est toujours passée en argument (`aujourdhui`, au format AAAA-MM-JJ)
 * et chaque transition renvoie un nouvel état. La persistance est dans `db.ts`.
 */
import {
  newCard,
  fromJSON as cartesFromJSON,
  toJSON as cartesToJSON,
  type ReviewCard
} from './srs';
import { ajouter, journal, lireTao, taoVide, type Tao, type TypeActivite } from './tao';


/** Budget choisi par l'utilisateur, en minutes. */
export type Budget = 5 | 10 | 20;

/**
 * Le parcours choisi à la première session : « Lire » suit les seuils français,
 * « Passer le HSK » suit le référentiel 2026, « Voyager » ordonne le même arbre
 * par ce qui se lit en gare et au restaurant. Même arbre, ordre différent.
 */
export type Parcours = 'lire' | 'hsk' | 'voyage';

/**
 * Les écrans de la première session, dans l'ordre de la maquette : les trois briques
 * (f1 人, f2 大, f3 天), le mot lu (f4 天天), le bilan (f5), puis les deux questions
 * (objectif, rythme). La reprise se fait à l'écran exact.
 */
export type EtapeDepart = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'objectif' | 'rythme';

export const ETAPES_DEPART = ['f1', 'f2', 'f3', 'f4', 'f5', 'objectif', 'rythme'] as const;

export type StepId =
  | 'ouvrir'
  | 'echauffer'
  | 'apprendre'
  | 'utiliser'
  | 'fixer'
  | 'clore'
  | 'reviser'
  | 'nouveaux';

/** `go` nomme le pas à ouvrir ; `null` = pas verrouillé, on ne peut pas y entrer. */
export type Step = { id: StepId; t: string; d: string; m: string; go: string | null };

/** L'ordre des six pas ne change jamais, quel que soit le budget. */
export const STEP_ORDER = ['ouvrir', 'echauffer', 'apprendre', 'utiliser', 'fixer', 'clore'] as const;

/**
 * Seuil d'absence : trois journées civiles sans session font basculer en rattrapage.
 * Une journée sautée est couverte par le jour de repos, deux restent rattrapables dans
 * une session normale ; à partir de trois, la pile due dépasse ce qu'une session de dix
 * minutes absorbe et l'apprentissage s'arrête le temps de la faire redescendre.
 */
export const SEUIL_ABSENCE = 3;

/** Ce qu'un bloc de cinq minutes de révisions absorbe. */
export const CARTES_PAR_BLOC = 15;

/** Nombre maximum de blocs de cinq minutes proposés dans une journée de rattrapage. */
export const BLOCS_MAX = 3;

/**
 * La pile est « redescendue » quand elle repasse sous ce nombre de cartes dues :
 * un seul bloc suffit alors, et les nouveaux caractères reviennent.
 */
export const PILE_REDESCENDUE = CARTES_PAR_BLOC;

/** Les trois vues du pas Apprendre, dans l'ordre : la brique, son tracé, le composé. */
export type LearnView = 'brique' | 'trace' | 'compose';

export const LEARN_VIEWS = ['brique', 'trace', 'compose'] as const;

/** Les deux vues du pas Utiliser, dans l'ordre : les mots et la phrase, puis le texte. */
export type UseView = 'mots' | 'texte';

export const USE_VIEWS = ['mots', 'texte'] as const;

/**
 * Une réponse notée au pas Fixer : le caractère, juste ou faux, les essais, le temps.
 * C'est l'événement de révision tel qu'il est rangé dans la progression ; `srs.ts`
 * le note (`grade`), ce module ne fait que le garder.
 */
export type Revision = { c: string; correct: boolean; tries: number; seconds: number };

/** L'état complet d'une progression. Sérialisable tel quel. */
export type Progress = {
  version: 1;
  /** Journée en cours, AAAA-MM-JJ. */
  day: string;
  /** Un booléen par pas de la liste courante. */
  done: boolean[];
  /** Mode rattrapage : révisions seules, aucun caractère nouveau. */
  catchup: boolean;
  budget: Budget;
  /** Cartes dues, la pile de révisions. */
  due: number;
  /** Journées travaillées, pour le compteur de jour. */
  days: number;
  /** Dernière journée où au moins un pas a été fait. */
  lastWorked: string | null;
  /**
   * Les journées travaillées, une par graine plantée, dans l'ordre. C'est la seule
   * mémoire de la série (`serie.ts`). Ajouté après coup : une progression sans ce champ
   * se relit depuis ce qu'on sait déjà d'elle.
   */
  joursTravailles: string[];
  /** Vue en cours du pas Apprendre : la reprise se fait au pas exact, vue comprise. */
  learn: LearnView;
  /** Réglage : proposer le tracé d'une brique de base. Désactivable depuis l'écran de tracé. */
  trace: boolean;
  /** Briques dont le tracé a déjà été proposé : une seule fois par brique. */
  tracees: string[];
  /** Vue en cours du pas Utiliser : la reprise se fait au pas exact, vue comprise. */
  use: UseView;
  /** Question en cours du pas Fixer : la reprise reprend la vérification où elle en est. */
  fix: number;
  /** Les réponses notées de la journée. Repart à zéro à chaque journée. */
  revisions: Revision[];
  /** L'état de Tao. Ajouté après coup : une progression sans ce champ se relit vide. */
  tao: Tao;
  /** Vrai tant que la première session n'a pas été faite : elle passe avant tout. */
  premiere: boolean;
  /** Écran en cours de la première session : la reprise se fait à celui-ci. */
  premiereVue: EtapeDepart;
  /** Le parcours choisi à la première session. `null` tant que la question n'est pas posée. */
  parcours: Parcours | null;
  /** Les cartes de révision, une par caractère rencontré. Sérialisées par `srs.ts`. */
  cartes: ReviewCard[];
};

export function emptyProgress(aujourdhui: string): Progress {
  return {
    version: 1,
    day: aujourdhui,
    done: [],
    catchup: false,
    budget: 10,
    due: 0,
    days: 0,
    lastWorked: null,
    joursTravailles: [],
    learn: 'brique',
    trace: true,
    tracees: [],
    use: 'mots',
    fix: 0,
    revisions: [],
    tao: taoVide(),
    premiere: true,
    premiereVue: 'f1',
    parcours: null,
    cartes: []
  };
}

/* ---------- dates ---------- */

/** Nombre de journées civiles entre deux dates AAAA-MM-JJ. */
export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Absence : au moins `SEUIL_ABSENCE` journées civiles depuis la dernière session. */
export function estAbsent(lastWorked: string | null, aujourdhui: string): boolean {
  return lastWorked !== null && joursEntre(lastWorked, aujourdhui) >= SEUIL_ABSENCE;
}

/* ---------- transitions ---------- */

/** Le rattrapage tient tant que la pile n'est pas redescendue ; il s'ouvre sur une absence. */
function rattrapage(p: Progress, aujourdhui: string): boolean {
  if (p.due <= PILE_REDESCENDUE) return false;
  return p.catchup || estAbsent(p.lastWorked, aujourdhui);
}

/**
 * Ouvre la journée. Même journée : l'état est rendu tel quel, on reprend au pas exact.
 * Journée différente : les pas repartent de zéro et le mode est réévalué.
 */
export function openDay(p: Progress, aujourdhui: string): Progress {
  if (p.day === aujourdhui) return p;
  return {
    ...p,
    day: aujourdhui,
    done: [],
    learn: 'brique',
    use: 'mots',
    fix: 0,
    revisions: [],
    catchup: rattrapage(p, aujourdhui)
  };
}

/**
 * Met à jour la pile de révisions. Si le mode change, la liste des pas change aussi :
 * les pas faits sont remis à zéro pour que la reprise reste exacte.
 */
export function setDue(p: Progress, due: number, aujourdhui: string): Progress {
  const next = { ...p, due };
  const catchup = rattrapage(next, aujourdhui);
  return catchup === p.catchup ? next : { ...next, catchup, done: [] };
}

export function setBudget(p: Progress, budget: Budget): Progress {
  return { ...p, budget };
}

/** Marque un pas fait. La journée compte comme travaillée dès le premier pas. */
export function markDone(p: Progress, i: number, aujourdhui: string): Progress {
  const done = steps(p).map((_, k) => (k === i ? true : (p.done[k] ?? false)));
  const premier = p.lastWorked !== aujourdhui;
  return { ...p, done, days: premier ? p.days + 1 : p.days, lastWorked: aujourdhui };
}

/**
 * Plante la graine du jour : la journée entre dans les journées travaillées. Appelé à la
 * clôture, une seule fois par journée. Une graine plantée ne se retire jamais.
 */
export function noterJourTravaille(p: Progress, jour: string): Progress {
  if (p.joursTravailles.includes(jour)) return p;
  return { ...p, joursTravailles: [...p.joursTravailles, jour].sort() };
}

/** Note une activité pour Tao : elle grandit de ce qui est fait, et rien d'autre. */
export function noterActivite(p: Progress, jour: string, type: TypeActivite): Progress {
  return { ...p, tao: ajouter(p.tao, jour, type) };
}

/** Recommence la journée : les pas repartent de zéro, le compteur de jour ne bouge pas. */
export function resetDay(p: Progress): Progress {
  return { ...p, done: [], learn: 'brique', use: 'mots', fix: 0, revisions: [] };
}

/* ---------- la première session ---------- */

/** Ouvre un écran de la première session. La progression est sauvegardée à chaque tap. */
export function setDepart(p: Progress, vue: EtapeDepart): Progress {
  return { ...p, premiereVue: vue };
}

/** L'écran suivant de la première session. `null` après le dernier : elle est finie. */
export function departNext(vue: EtapeDepart): EtapeDepart | null {
  const i = ETAPES_DEPART.indexOf(vue);
  return i < 0 || i + 1 >= ETAPES_DEPART.length ? null : ETAPES_DEPART[i + 1];
}

/** Première des deux questions : le parcours. Même arbre, ordre différent. */
export function setParcours(p: Progress, parcours: Parcours): Progress {
  return { ...p, parcours };
}

/** Ajoute une carte neuve par caractère encore inconnu. Une carte par caractère, jamais deux. */
export function ajouterCartes(p: Progress, ids: readonly string[], maintenant: Date): Progress {
  const connues = new Set(p.cartes.map((c) => c.id));
  const neuves = ids.filter((id) => !connues.has(id)).map((id) => newCard(id, maintenant));
  return neuves.length === 0 ? p : { ...p, cartes: [...p.cartes, ...neuves] };
}

/**
 * La première session est finie : une carte par brique vue, les activités notées pour
 * Tao (trois leçons, une lecture), et le drapeau tombe. On n'y revient plus.
 */
export function finDepart(
  p: Progress,
  jour: string,
  maintenant: Date,
  briques: readonly string[]
): Progress {
  let n = ajouterCartes(p, briques, maintenant);
  briques.forEach(() => {
    n = noterActivite(n, jour, 'lecon');
  });
  n = noterActivite(n, jour, 'lecture');
  return { ...n, premiere: false, premiereVue: 'f1' };
}

/* ---------- pas 3, Apprendre ---------- */

/**
 * Le tracé est proposé une fois par brique de base, et seulement si le réglage est actif.
 * Jamais pour un composé : l'appelant ne passe ici que la brique de la session.
 */
export function traceProposee(p: Progress, brique: string): boolean {
  return p.trace && !p.tracees.includes(brique);
}

/** Change le réglage « ne plus proposer le tracé ». */
export function setTrace(p: Progress, actif: boolean): Progress {
  return { ...p, trace: actif };
}

/** Note que le tracé de cette brique a été proposé : on ne le proposera plus. */
export function traceVue(p: Progress, brique: string): Progress {
  return p.tracees.includes(brique) ? p : { ...p, tracees: [...p.tracees, brique] };
}

/** Ouvre une vue du pas Apprendre. La progression est sauvegardée à chaque tap. */
export function setLearnView(p: Progress, vue: LearnView): Progress {
  return { ...p, learn: vue };
}

/**
 * La vue suivante du pas Apprendre : la brique, le tracé quand il est proposé, puis le
 * composé. `null` quand il n'y a plus de vue : le pas est fini.
 */
export function learnNext(p: Progress, brique: string): LearnView | null {
  if (p.learn === 'brique') return traceProposee(p, brique) ? 'trace' : 'compose';
  return p.learn === 'trace' ? 'compose' : null;
}

/* ---------- pas 4, Utiliser ---------- */

/** Ouvre une vue du pas Utiliser. La progression est sauvegardée à chaque tap. */
export function setUseView(p: Progress, vue: UseView): Progress {
  return { ...p, use: vue };
}

/**
 * La vue suivante du pas Utiliser : les mots et la phrase, puis les trois lignes à
 * lire. `null` quand il n'y a plus de vue : le pas est fini.
 */
export function useNext(p: Progress): UseView | null {
  return p.use === 'mots' ? 'texte' : null;
}

/* ---------- pas 5, Fixer ---------- */

/** Ouvre une question du pas Fixer : la reprise reprend la vérification où elle en est. */
export function setFix(p: Progress, i: number): Progress {
  return { ...p, fix: Math.max(0, Math.floor(i)) };
}

/**
 * Note une réponse : l'événement de révision est rangé dans la journée, et une
 * activité « révision » est comptée pour Tao. Une réponse, une bouchée.
 */
export function noterRevision(p: Progress, jour: string, r: Revision): Progress {
  return { ...p, revisions: [...p.revisions, r], tao: ajouter(p.tao, jour, 'revision') };
}

/** Le bilan de la vérification : les questions posées, et celles sues du premier coup. */
export function bilan(p: Progress): { questions: number; sures: number } {
  return {
    questions: p.revisions.length,
    sures: p.revisions.filter((r) => r.correct && r.tries === 0).length
  };
}

/* ---------- pas 6, Clore ---------- */

/**
 * Le constat de clôture : une ligne, des nombres réels, la forme du journal du soir
 * de Tao. Jamais une félicitation, jamais un reproche.
 */
export function constat(p: Progress, jour: string): string {
  return journal(p.tao.activites, jour);
}

/**
 * Le rendez-vous de demain. Sans heure : le réglage de l'heure de notification
 * n'existe pas encore, et on ne promet pas ce qu'on ne tient pas.
 */
export function rendezVous(): string {
  return 'On te le remontre demain.';
}

/* ---------- les pas ---------- */

/** Durées affichées, dérivées du budget. Une session plus longue que le budget est un défaut. */
const DUREES: Record<Budget, string[]> = {
  5: ['20 s', '2 min', '1 min', '1 min', '30 s', '20 s'],
  10: ['20 s', '3 min', '3 min', '2 min', '1 min', '20 s'],
  20: ['20 s', '6 min', '6 min', '4 min', '2 min', '20 s']
};

export function sessionSteps(p: Progress): Step[] {
  const m = DUREES[p.budget];
  return [
    { id: 'ouvrir', t: 'Ouvrir', d: "L'anecdote du jour", m: m[0], go: 'anec' },
    {
      id: 'echauffer',
      t: 'Échauffer',
      d: p.due > 0 ? `${p.due} cartes en questions` : 'Les révisions dues',
      m: m[1],
      go: 'rev'
    },
    { id: 'apprendre', t: 'Apprendre', d: 'Une brique, puis ses composés', m: m[2], go: 'learn' },
    { id: 'utiliser', t: 'Utiliser', d: 'Deux mots, une phrase, trois lignes', m: m[3], go: 'use' },
    { id: 'fixer', t: 'Fixer', d: 'Une vérification', m: m[4], go: 'check' },
    { id: 'clore', t: 'Clore', d: 'Le constat et la graine', m: m[5], go: 'close' }
  ];
}

/** Rattrapage : des blocs de cinq minutes, et les nouveaux caractères verrouillés. */
export function catchupSteps(due: number): Step[] {
  const n = Math.max(1, Math.min(BLOCS_MAX, Math.ceil(due / CARTES_PAR_BLOC)));
  const base = Math.floor(due / n);
  const reste = due % n;
  const blocs: Step[] = [];
  for (let i = 0; i < n; i++) {
    const cartes = base + (i < reste ? 1 : 0);
    blocs.push({
      id: 'reviser',
      t: 'Réviser',
      d: i === 0 ? `${cartes} cartes, les plus urgentes` : `${cartes} cartes`,
      m: '5 min',
      go: 'rev'
    });
  }
  blocs.push({
    id: 'nouveaux',
    t: 'Nouveaux caractères',
    d: 'Reviennent quand la pile est redescendue',
    m: '',
    go: null
  });
  return blocs;
}

export function steps(p: Progress): Step[] {
  return p.catchup ? catchupSteps(p.due) : sessionSteps(p);
}

/** Le pas courant : le premier pas ouvrable qui n'est pas fait. -1 si la journée est finie. */
export function nextIndex(p: Progress): number {
  return steps(p).findIndex((x, i) => !p.done[i] && x.go !== null);
}

export function allDone(p: Progress): boolean {
  return nextIndex(p) < 0;
}

/** Le pas courant lui-même, `null` si la journée est finie. L'écran à ouvrir est dans `go`. */
export function currentStep(p: Progress): Step | null {
  const i = nextIndex(p);
  return i < 0 ? null : steps(p)[i];
}

export function started(p: Progress): boolean {
  return p.done.some(Boolean);
}

/** Une seule brique nouvelle par session de dix minutes. */
export const budgetNewBricks = (minutes: Budget): number => ({ 5: 0, 10: 1, 20: 2 })[minutes];

/* ---------- textes de l'écran ---------- */

function ordinal(n: number): string {
  return n <= 1 ? '1er' : `${n}e`;
}

/**
 * Compteur de jour : les journées travaillées, aujourd'hui compris.
 * Jamais un compteur de jours perdus, même en rattrapage.
 */
export function dayLabel(p: Progress): string {
  return `${ordinal(p.days + (p.lastWorked === p.day ? 0 : 1))} jour`;
}

export function title(p: Progress): string {
  if (p.catchup) return 'Reprenons';
  return allDone(p) ? "C'est fait pour aujourd'hui" : "Aujourd'hui";
}

const EN_TOUTES_LETTRES: Record<Budget, string> = { 5: 'cinq', 10: 'dix', 20: 'vingt' };
const BLOCS_EN_TOUTES_LETTRES = ['', 'Un bloc', 'Deux blocs', 'Trois blocs'];

/** Message neutre en rattrapage : la pile, les blocs, rien sur les jours manqués. */
export function guide(p: Progress): string {
  if (p.catchup) {
    const blocs = catchupSteps(p.due).filter((s) => s.go !== null).length;
    return `${p.due} cartes attendent. ${BLOCS_EN_TOUTES_LETTRES[blocs]} de cinq minutes, pas de nouveau caractère tant que la pile n'est pas redescendue.`;
  }
  const budget = `Six pas, ${EN_TOUTES_LETTRES[p.budget]} minutes.`;
  if (allDone(p)) return `${budget} La graine du jour est plantée. Rendez-vous demain.`;
  if (started(p)) return "On reprend là où on s'est arrêté.";
  return `${budget} Un seul bouton.`;
}

export function buttonLabel(p: Progress): string {
  if (allDone(p)) return 'Recommencer une session';
  return started(p) ? 'Continuer' : 'Commencer';
}

/* ---------- export et import ---------- */

/** Les cartes passent par `srs.ts` : les dates y sont en ISO, et se relisent telles quelles. */
export function toJSON(p: Progress): string {
  return JSON.stringify({ ...p, cartes: JSON.parse(cartesToJSON(p.cartes)) }, null, 2);
}

function isBudget(v: unknown): v is Budget {
  return v === 5 || v === 10 || v === 20;
}

function isLearnView(v: unknown): v is LearnView {
  return LEARN_VIEWS.includes(v as LearnView);
}

function isUseView(v: unknown): v is UseView {
  return USE_VIEWS.includes(v as UseView);
}

function isEtapeDepart(v: unknown): v is EtapeDepart {
  return ETAPES_DEPART.includes(v as EtapeDepart);
}

function isParcours(v: unknown): v is Parcours {
  return v === 'lire' || v === 'hsk' || v === 'voyage';
}

/**
 * Relit les cartes de révision, sérialisées par `srs.ts`. Une progression exportée
 * avant les cartes en rend zéro : le champ est rétrocompatible.
 */
function lireCartes(brut: unknown): ReviewCard[] {
  if (typeof brut !== 'object' || brut === null) return [];
  try {
    return cartesFromJSON(JSON.stringify(brut));
  } catch {
    return [];
  }
}

/**
 * La première session passe avant tout, et une seule fois. Un export d'avant ce
 * drapeau vient forcément d'une progression déjà commencée : elle est donc faite.
 */
function lirePremiere(o: Record<string, unknown>): boolean {
  if (o.premiere !== undefined) return o.premiere === true;
  return o.lastWorked === null || o.lastWorked === undefined;
}

/** Relit les événements de révision d'un export. Une entrée aberrante est écartée. */
function lireRevisions(brut: unknown): Revision[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((x) => {
    if (typeof x !== 'object' || x === null) return [];
    const r = x as Record<string, unknown>;
    if (typeof r.c !== 'string' || r.c === '') return [];
    return [
      {
        c: r.c,
        correct: r.correct === true,
        tries: typeof r.tries === 'number' && r.tries >= 0 ? Math.floor(r.tries) : 0,
        seconds: typeof r.seconds === 'number' && r.seconds >= 0 ? r.seconds : 0
      }
    ];
  });
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Relit les journées travaillées. Le champ est arrivé avec la série : un export plus
 * ancien n'en a pas, et on le reconstitue de ce qu'il sait déjà, le journal de Tao et la
 * dernière journée travaillée. Ni plus ni moins : on ne devine aucune journée.
 */
function lireJoursTravailles(o: Record<string, unknown>, tao: Tao, lastWorked: string | null): string[] {
  const garder = (l: readonly unknown[]): string[] =>
    [...new Set(l.filter((x): x is string => typeof x === 'string' && FORMAT_JOUR.test(x)))].sort();
  if (Array.isArray(o.joursTravailles)) return garder(o.joursTravailles);
  return garder([...tao.activites.map((a) => a.jour), lastWorked]);
}

/** Relit une progression exportée. Les champs absents ou aberrants reprennent leur défaut. */
export function fromJSON(texte: string, aujourdhui: string): Progress {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error('Fichier illisible');
  }
  if (typeof brut !== 'object' || brut === null) throw new Error('Fichier illisible');
  const o = brut as Record<string, unknown>;
  const vide = emptyProgress(aujourdhui);
  const tao = lireTao(o.tao);
  const lastWorked = typeof o.lastWorked === 'string' ? o.lastWorked : null;
  return {
    version: 1,
    day: typeof o.day === 'string' ? o.day : vide.day,
    done: Array.isArray(o.done) ? o.done.map(Boolean) : [],
    catchup: o.catchup === true,
    budget: isBudget(o.budget) ? o.budget : vide.budget,
    due: typeof o.due === 'number' && o.due >= 0 ? Math.floor(o.due) : 0,
    days: typeof o.days === 'number' && o.days >= 0 ? Math.floor(o.days) : 0,
    lastWorked,
    joursTravailles: lireJoursTravailles(o, tao, lastWorked),
    /* Champs du pas Apprendre : absents d'un export plus ancien, ils reprennent leur défaut. */
    learn: isLearnView(o.learn) ? o.learn : vide.learn,
    trace: o.trace === undefined ? vide.trace : o.trace !== false,
    tracees: Array.isArray(o.tracees) ? o.tracees.filter((c): c is string => typeof c === 'string') : [],
    /* Champs des pas Utiliser et Fixer : absents d'un export plus ancien, ils reprennent leur défaut. */
    use: isUseView(o.use) ? o.use : vide.use,
    fix: typeof o.fix === 'number' && o.fix >= 0 ? Math.floor(o.fix) : 0,
    revisions: lireRevisions(o.revisions),
    tao,
    /* Champs de la première session et des cartes : absents d'un export plus ancien. */
    premiere: lirePremiere(o),
    premiereVue: isEtapeDepart(o.premiereVue) ? o.premiereVue : vide.premiereVue,
    parcours: isParcours(o.parcours) ? o.parcours : null,
    cartes: lireCartes(o.cartes)
  };
}
