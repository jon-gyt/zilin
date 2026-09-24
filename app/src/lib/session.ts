/**
 * L'état d'une session : six pas, toujours dans le même ordre, reprise au pas exact,
 * remise à zéro à chaque nouvelle journée, rattrapage après une absence, et la session
 * de plus (quatre pas, une brique, jamais une seconde graine) une fois la journée faite.
 *
 * Tout ce module est pur : aucune fonction ne lit l'horloge ni n'écrit dans un stockage.
 * La journée courante est toujours passée en argument (`aujourdhui`, au format AAAA-MM-JJ)
 * et chaque transition renvoie un nouvel état. La persistance est dans `db.ts`.
 */
import {
  RETENTION_DEFAUT,
  bornerRetention,
  due,
  fromJSON as cartesFromJSON,
  newCard,
  schedule,
  toJSON as cartesToJSON,
  type Outcome,
  type ReviewCard,
  type SrsParams
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

/**
 * Ce qu'une séance d'échauffement absorbe : quatorze cartes, comme la maquette.
 * Au-delà, la pile attend le lendemain ou le rattrapage.
 */
export const CARTES_PAR_SEANCE = 14;

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
 * Une réponse notée au pas Fixer : le caractère, juste ou faux, les essais, le temps, et
 * les leurres pris quand un choix a été faux (`Outcome.leurres` de `srs.ts`). C'est
 * l'événement de révision tel qu'il est rangé dans la progression ; `srs.ts` le note
 * (`grade`) et range les leurres dans l'historique de la carte, ce module ne fait que le
 * garder.
 */
export type Revision = {
  c: string;
  correct: boolean;
  tries: number;
  seconds: number;
  leurres?: string[];
};

/** Où en est la devinette du jour : posée, résolue, ou montrée après deux essais faux. */
export type IssueDevinette = 'posee' | 'resolue' | 'montree';

/** La devinette du jour : la journée, son identifiant, son issue. */
export type DevinetteDuJour = { jour: string; id: string; issue: IssueDevinette };

/**
 * Une session de plus, en cours : Apprendre, Utiliser, Fixer, Clore, et Échauffer devant
 * s'il restait des cartes dues quand elle a commencé. Figé au départ : la liste des pas
 * ne bouge pas sous les doigts quand la pile baisse.
 */
export type SessionPlus = { echauffer: boolean };

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
  /**
   * Briques tracées en entier au doigt, chacune une fois, dans l'ordre. Proposer le tracé
   * (`tracees`) ne suffit pas : seul le tracé achevé compte. C'est ce que lit le pinceau
   * des trophées. Ajouté après coup : une progression sans ce champ n'a rien d'achevé, et
   * rien n'est déduit des tracés proposés.
   */
  tracesAchevees: string[];
  /** Vue en cours du pas Utiliser : la reprise se fait au pas exact, vue comprise. */
  use: UseView;
  /** Question en cours du pas Fixer : la reprise reprend la vérification où elle en est. */
  fix: number;
  /**
   * Rang de la dernière question déjà notée au pas Fixer, `-1` tant qu'aucune ne l'est.
   * Une question notée ne se repose jamais : sans ce repère, quitter entre la réponse et
   * l'avance automatique la reposerait, et la réponse serait comptée deux fois.
   */
  fixNotee: number;
  /**
   * Les cartes FSRS, une par caractère ou brique appris. Sérialisées par `srs.ts` :
   * une progression plus ancienne, sans ce champ, se relit avec aucune carte.
   */
  cartes: ReviewCard[];
  /**
   * La pile du pas Échauffer, figée à l'ouverture du pas : les cartes dues de la séance,
   * dans l'ordre. Elle ne bouge plus de la journée, pour que la reprise tombe sur la
   * question exacte même quand une carte répondue n'est plus due.
   */
  revue: string[];
  /** Question en cours du pas Échauffer : la reprise reprend la séance où elle en est. */
  rev: number;
  /** Rang de la dernière question déjà notée au pas Échauffer, `-1` tant qu'aucune ne l'est. */
  revNotee: number;
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
  /**
   * Le jour du parcours de l'index à poser à la prochaine session. Absent d'une
   * progression plus ancienne : on retombe alors sur le nombre de journées travaillées
   * (`jourParcours`). C'est le seul lien entre la progression et `data/`.
   */
  jourParcours?: number;
  /**
   * Le jour du parcours que la session a appris, posé à la fin du pas Apprendre.
   * Utiliser, Fixer et Clore lisent la même leçon ; le menu la montre une fois la journée
   * faite. Repart à vide chaque journée, et au début d'une session de plus.
   */
  jourAppris?: number;
  /** Les sessions de plus terminées dans la journée. Repart à zéro chaque journée. */
  plus: number;
  /** La session de plus en cours, `null` sinon. La liste des pas est alors la sienne. */
  enPlus: SessionPlus | null;
  /**
   * Rétention cible FSRS, réglable (brief §7) : la chance de savoir encore une carte au
   * moment où elle revient. Entre `RETENTION_MIN` et `RETENTION_MAX` de `srs.ts`, 0,9
   * par défaut. Ajoutée après coup : une progression sans ce champ se relit au défaut.
   */
  retention: number;
  /**
   * Les cartes mises de côté : le contenu servi n'a pas de quoi les poser en question
   * (pas de fiche, ou aucun type que la fiche permette). Elles restent dans `cartes`,
   * intactes, mais ne comptent plus dans la pile due tant qu'elles attendent ; le pas
   * Échauffer réévalue la liste à chaque ouverture et les rend dès que le contenu le
   * permet. Ajoutée après coup : une progression sans ce champ n'a rien de côté.
   */
  enAttente: string[];
  /**
   * Les trophées obtenus, chacun avec la journée où il l'a été (AAAA-MM-JJ), par leur
   * identifiant (`trophees.ts`). Un trophée obtenu le reste : le tableau fusionne ce qui
   * se calcule et ce qui est noté ici, même quand l'historique des cartes, borné, ne le
   * montre plus. Ajouté après coup : une progression sans ce champ n'a rien de noté, et
   * le tableau recalcule ce qu'il peut.
   */
  tropheesAcquis: Record<string, string>;
  /**
   * Les devinettes de lanternes résolues, par identifiant, chacune une fois, dans l'ordre.
   * La lanterne des trophées en compte dix. Le jeu des devinettes les note par
   * `noterDevinette`. Absente d'une progression plus ancienne : vide.
   */
  devinettes: string[];
  /**
   * La devinette du jour : une par jour, posée à l'ouverture du jeu, et son issue. Elle
   * reste celle du jour même si l'acquis change dans la journée ; une fois résolue ou
   * montrée, la suivante attend le lendemain. Absente d'une progression plus ancienne.
   */
  devinetteDuJour: DevinetteDuJour | null;
  /**
   * Les contes lus : pour chaque conte (identifiant de l'index), les seuils dont la version
   * a été lue, triés. Le même conte se relit plus riche à chaque seuil, et chaque version
   * est un trophée. Le lecteur n'existe pas encore : la liste attend son point d'entrée
   * (`noterConteLu`). Absente d'une progression plus ancienne : aucun conte lu.
   */
  contesLus: Record<string, number[]>;
};

/**
 * Le jour du parcours que la session pose : l'index rangé dans la progression s'il y
 * est, sinon le nombre de journées travaillées. Le premier jour vaut 1.
 */
export function jourParcours(p: Progress): number {
  return Math.max(1, Math.floor(p.jourParcours ?? p.days));
}

/**
 * Le jour du parcours que les écrans de la session lisent : celui que la session a
 * appris, dès la fin du pas Apprendre ; le prochain à apprendre, avant. Apprendre,
 * Utiliser, Fixer et Clore voient ainsi la même leçon, même une fois le parcours avancé.
 */
export function jourLecon(p: Progress): number {
  return p.jourAppris ?? jourParcours(p);
}

/** Range le jour du parcours atteint. Le parcours n'avance jamais tout seul. */
export function setJourParcours(p: Progress, jour: number): Progress {
  return { ...p, jourParcours: Math.max(1, Math.floor(jour)) };
}

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
    tracesAchevees: [],
    use: 'mots',
    fix: 0,
    fixNotee: -1,
    cartes: [],
    revue: [],
    rev: 0,
    revNotee: -1,
    revisions: [],
    tao: taoVide(),
    premiere: true,
    premiereVue: 'f1',
    parcours: null,
    plus: 0,
    enPlus: null,
    retention: RETENTION_DEFAUT,
    enAttente: [],
    tropheesAcquis: {},
    devinettes: [],
    devinetteDuJour: null,
    contesLus: {}
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
  return { ...resetDay(p), day: aujourdhui, catchup: rattrapage(p, aujourdhui) };
}

/**
 * La bascule de journée, telle que l'écran Aujourd'hui la fait : au retour au chemin et
 * au retour au premier plan. Le jour de référence est `p.day`, jamais l'horloge : une
 * session commencée reste sur sa journée jusqu'à sa clôture, même close après minuit,
 * et ses activités y sont rangées. La journée ne bascule donc que lorsqu'aucune session
 * n'est en cours — rien de fait, ou tout fait. Au rechargement, `openDay` ouvre la
 * journée quoi qu'il arrive : une session interrompue ne se reprend que le jour même.
 */
export function basculerJournee(p: Progress, aujourdhui: string): Progress {
  if (p.day === aujourdhui) return p;
  if (started(p) && !allDone(p)) return p;
  return openDay(p, aujourdhui);
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

/** Marque fait le pas courant, s'il en reste un. L'aiguillage n'a rien à décider. */
export function faitPasCourant(p: Progress, aujourdhui: string): Progress {
  const i = nextIndex(p);
  return i < 0 ? p : markDone(p, i, aujourdhui);
}

/**
 * Plante la graine du jour : la journée entre dans les journées travaillées. Appelé à la
 * clôture, ou à la fin d'un bloc de rattrapage, une seule fois par journée. Une graine
 * plantée ne se retire jamais.
 */
export function noterJourTravaille(p: Progress, jour: string): Progress {
  if (p.joursTravailles.includes(jour)) return p;
  return { ...p, joursTravailles: [...p.joursTravailles, jour].sort() };
}

/** Note une activité pour Tao : elle grandit de ce qui est fait, et rien d'autre. */
export function noterActivite(p: Progress, jour: string, type: TypeActivite): Progress {
  return { ...p, tao: ajouter(p.tao, jour, type) };
}

/** Les pas repartent de zéro, vues et questions comprises. */
function pasAZero(p: Progress): Progress {
  return {
    ...p,
    done: [],
    learn: 'brique',
    use: 'mots',
    fix: 0,
    fixNotee: -1,
    revue: [],
    rev: 0,
    revNotee: -1
  };
}

/**
 * Remet la journée à zéro : les pas, les réponses, les sessions de plus. Le compteur de
 * jour ne bouge pas. Ne sert qu'au changement de journée (`openDay`) : une journée faite
 * ne se recommence pas, elle se prolonge par une session de plus (`commencerPlus`).
 */
export function resetDay(p: Progress): Progress {
  return { ...pasAZero(p), revisions: [], plus: 0, enPlus: null, jourAppris: undefined };
}

/* ---------- la session de plus ---------- */

/**
 * Une session de plus se propose une fois la journée faite, et jamais en rattrapage :
 * aucune brique nouvelle n'entre tant que la pile n'est pas redescendue.
 */
export function peutPlus(p: Progress): boolean {
  return !p.premiere && !p.catchup && p.enPlus === null && allDone(p);
}

/**
 * Commence une session de plus : quatre pas, une brique nouvelle, la suivante du
 * parcours. Échauffer passe devant s'il reste des cartes dues. Sans effet quand elle
 * n'est pas proposée.
 */
export function commencerPlus(p: Progress): Progress {
  if (!peutPlus(p)) return p;
  return { ...pasAZero(p), enPlus: { echauffer: p.due > 0 }, jourAppris: undefined };
}

/**
 * Clore, la seule fin d'une session : le pas est fait et la graine du jour plantée, une
 * fois par journée (`noterJourTravaille`). Une session de plus close rend la journée
 * faite et compte une session de plus ; elle ne plante jamais une seconde graine.
 */
export function cloreSession(p: Progress, jour: string): Progress {
  const n = noterJourTravaille(faitPasCourant(p, jour), jour);
  if (n.enPlus === null) return n;
  const journee: Progress = { ...n, enPlus: null, plus: n.plus + 1 };
  return { ...journee, done: sessionSteps(journee).map(() => true) };
}

/* ---------- les cartes de révision ---------- */

/** La carte d'un caractère, `null` si la progression n'en porte pas encore. */
export function carte(p: Progress, id: string): ReviewCard | null {
  return p.cartes.find((c) => c.id === id) ?? null;
}

/**
 * Donne une carte neuve à chaque caractère qui n'en a pas. Appelé à la fin du pas
 * Apprendre : la brique et le composé du jour entrent en révision.
 */
export function assurerCartes(p: Progress, ids: readonly string[], maintenant: Date): Progress {
  const cartes = [...p.cartes];
  for (const id of ids) {
    if (id !== '' && !cartes.some((c) => c.id === id)) cartes.push(newCard(id, maintenant));
  }
  return cartes.length === p.cartes.length ? p : { ...p, cartes };
}

/* ---------- la rétention cible ---------- */

/** Change la rétention cible. Ramenée dans les bornes : un réglage ne sort jamais du cadre. */
export function setRetention(p: Progress, retention: number): Progress {
  return { ...p, retention: bornerRetention(retention) };
}

/** Ce que FSRS reçoit de la progression : la rétention cible réglée. */
export function srsParams(p: Progress): SrsParams {
  return { retention: bornerRetention(p.retention) };
}

/** Une position du réglage : un nom sans jargon, et la rétention qu'elle règle. */
export type ReglageRetention = { t: string; retention: number };

/** Les trois positions du réglage, de la plus serrée à la plus lâche. */
export const REGLAGES_RETENTION: readonly ReglageRetention[] = [
  { t: 'Plus de révisions', retention: 0.95 },
  { t: 'Équilibré', retention: RETENTION_DEFAUT },
  { t: 'Moins de révisions', retention: 0.85 }
];

/** L'effet du réglage, en une ligne : ce qu'on sait encore d'une carte quand elle revient. */
export function effetRetention(retention: number): string {
  const n = Math.round(bornerRetention(retention) * 100);
  return `Une carte revient quand tu as encore environ ${n} chances sur 100 de la savoir.`;
}

/**
 * Note une réponse et replanifie la carte avec FSRS (`schedule` de `srs.ts`), à la
 * rétention cible de la progression. Une carte absente est créée à la volée : on ne
 * perd jamais une réponse.
 */
export function planifierCarte(
  p: Progress,
  id: string,
  outcome: Outcome,
  maintenant: Date,
  params: SrsParams = {}
): Progress {
  const avant = carte(p, id) ?? newCard(id, maintenant);
  const { card } = schedule(avant, outcome, maintenant, { ...srsParams(p), ...params });
  const cartes = p.cartes.some((c) => c.id === id)
    ? p.cartes.map((c) => (c.id === id ? card : c))
    : [...p.cartes, card];
  return { ...p, cartes };
}

/** L'échéance FSRS d'une carte : la dernière planifiée. `null` si la carte n'existe pas. */
export function echeance(p: Progress, id: string): Date | null {
  return carte(p, id)?.card.due ?? null;
}

/* ---------- pas 2, Échauffer ---------- */

/** Les cartes dues qui peuvent se poser : celles mises de côté attendent leur fiche. */
function duesPosables(p: Progress, maintenant: Date): ReviewCard[] {
  const cote = new Set(p.enAttente);
  return due(p.cartes, maintenant).filter((c) => !cote.has(c.id));
}

/**
 * Les cartes dues, les plus urgentes d'abord (`due` de `srs.ts`), coupées à ce qu'une
 * séance absorbe. Le reste attend le lendemain. Une carte mise de côté (`enAttente`)
 * n'y entre pas : sans fiche, elle occuperait la tête de la pile tous les jours.
 */
export function cartesDues(
  p: Progress,
  maintenant: Date,
  max: number = CARTES_PAR_SEANCE
): ReviewCard[] {
  return duesPosables(p, maintenant).slice(0, Math.max(0, max));
}

/**
 * Le nombre réel de cartes dues, sans plafond : c'est lui, et non ce qu'une séance
 * absorbe, qui dit si la pile a débordé et si le rattrapage tient (`setDue`). Les
 * cartes mises de côté n'y comptent pas : elles ne tiendraient pas le rattrapage ouvert.
 */
export function nombreDues(p: Progress, maintenant: Date): number {
  return duesPosables(p, maintenant).length;
}

/**
 * Range la liste des cartes mises de côté, telle que le pas Échauffer l'a réévaluée sur
 * le contenu. Seules les cartes que la progression porte y entrent ; aucune n'est
 * retirée de `cartes`. Même liste : l'état est rendu tel quel.
 */
export function setEnAttente(p: Progress, ids: readonly string[]): Progress {
  const connues = new Set(p.cartes.map((c) => c.id));
  const enAttente = [...new Set(ids)].filter((c) => connues.has(c)).sort();
  const meme =
    enAttente.length === p.enAttente.length && enAttente.every((c, i) => c === p.enAttente[i]);
  return meme ? p : { ...p, enAttente };
}

/** Fige la pile de la séance : elle ne bouge plus de la journée. */
export function setRevue(p: Progress, ids: readonly string[]): Progress {
  return { ...p, revue: [...ids] };
}

/** Ouvre une question du pas Échauffer : la reprise reprend la séance où elle en est. */
export function setRev(p: Progress, i: number): Progress {
  return { ...p, rev: Math.max(0, Math.floor(i)) };
}

/** Note que la question `i` du pas Échauffer a été répondue : elle ne se repose plus. */
export function setRevNotee(p: Progress, i: number): Progress {
  const n = Math.floor(i);
  return n <= p.revNotee ? p : { ...p, revNotee: Math.max(-1, n) };
}

/**
 * La question à poser en entrant (ou en revenant) dans le pas Échauffer : celle où la
 * séance en est, jamais une question déjà notée. Se lit une fois, à l'ouverture de
 * l'écran : une réponse ne doit pas chasser sa propre correction.
 */
export function repriseRev(p: Progress): number {
  return Math.max(p.rev, p.revNotee + 1);
}

/**
 * Fin de la séance d'Échauffer : le pas est fait, et la pile se vide pour le bloc suivant.
 *
 * En rattrapage, il n'y a pas de Clore : le bloc fait est la fin de la journée travaillée,
 * et il plante la graine du jour. Une seule par jour, comme partout (`noterJourTravaille`) :
 * les blocs suivants, ou la session normale rouverte quand la pile est redescendue, n'en
 * plantent pas de seconde.
 */
export function finEchauffer(p: Progress, aujourdhui: string): Progress {
  const bloc = p.catchup && currentStep(p)?.id === 'reviser';
  const n: Progress = { ...faitPasCourant(p, aujourdhui), revue: [], rev: 0, revNotee: -1 };
  return bloc ? noterJourTravaille(n, aujourdhui) : n;
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

/**
 * Ajoute une carte neuve par caractère encore inconnu : c'est `assurerCartes`, sous le
 * nom que la première session lui donne. Une carte par caractère, jamais deux.
 */
export const ajouterCartes = assurerCartes;

/**
 * La première session est finie : une carte par brique vue, les activités notées pour
 * Tao (trois leçons, une lecture), et le drapeau tombe. On n'y revient plus.
 *
 * La journée est faite : la première graine est plantée, les six pas sont marqués, et
 * la session complète commence le lendemain, au premier jour du parcours.
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
  n = noterJourTravaille({ ...n, premiere: false, premiereVue: 'f1' }, jour);
  const premier = n.lastWorked !== jour;
  return {
    ...n,
    done: sessionSteps(n).map(() => true),
    days: premier ? n.days + 1 : n.days,
    lastWorked: jour,
    jourParcours: n.jourParcours ?? 1
  };
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

/**
 * Note que la brique a été tracée en entier : le dernier trait posé, pas seulement le
 * tracé ouvert. Une brique compte une fois, même tracée encore.
 */
export function traceAchevee(p: Progress, brique: string): Progress {
  if (brique === '' || p.tracesAchevees.includes(brique)) return p;
  return { ...p, tracesAchevees: [...p.tracesAchevees, brique] };
}

/* ---------- les trophées obtenus ---------- */

/**
 * Note les trophées obtenus, datés du jour. Un trophée déjà noté garde sa date : on ne la
 * repousse jamais. Rien de nouveau : l'état est rendu tel quel, et rien n'est à sauvegarder.
 */
export function noterTrophees(p: Progress, ids: readonly string[], jour: string): Progress {
  const nouveaux = ids.filter((id) => id !== '' && p.tropheesAcquis[id] === undefined);
  if (nouveaux.length === 0) return p;
  const tropheesAcquis = { ...p.tropheesAcquis };
  for (const id of nouveaux) tropheesAcquis[id] = jour;
  return { ...p, tropheesAcquis };
}

/* ---------- les devinettes et les contes ---------- */

/**
 * Note une devinette de lanterne résolue. Une devinette compte une fois, même résolue de
 * nouveau : la lanterne compte ce qui a été lu de plus, pas les essais.
 */
export function noterDevinette(p: Progress, id: string): Progress {
  if (id === '' || p.devinettes.includes(id)) return p;
  return { ...p, devinettes: [...p.devinettes, id] };
}

/**
 * Pose la devinette du jour, à l'ouverture du jeu. Une seule par jour : si une devinette
 * est déjà posée aujourd'hui, rien ne change, même si l'acquis en proposerait une autre.
 */
export function poserDevinette(p: Progress, jour: string, id: string): Progress {
  if (id === '' || p.devinetteDuJour?.jour === jour) return p;
  return { ...p, devinetteDuJour: { jour, id, issue: 'posee' } };
}

/**
 * Conclut la devinette du jour : résolue (du premier coup ou au second essai), elle entre
 * dans les devinettes résolues et la lanterne compte une devinette de plus ; montrée, elle
 * ne compte pas. Une devinette déjà conclue aujourd'hui le reste : rejouer ne la change pas.
 */
export function conclureDevinette(p: Progress, jour: string, id: string, resolue: boolean): Progress {
  const d = p.devinetteDuJour;
  if (id === '' || (d?.jour === jour && d.issue !== 'posee')) return p;
  if (d !== null && d.jour === jour && d.id !== id) return p;
  const conclue: Progress = { ...p, devinetteDuJour: { jour, id, issue: resolue ? 'resolue' : 'montree' } };
  return resolue ? noterDevinette(conclue, id) : conclue;
}

/** La devinette du jour a déjà été résolue ou montrée : la suivante, c'est demain. */
export function devinetteFaite(p: Progress, jour: string): boolean {
  const d = p.devinetteDuJour;
  return d !== null && d.jour === jour && d.issue !== 'posee';
}

/**
 * Note la lecture d'un conte, dans la version d'un seuil. Chaque version compte une fois ;
 * relire le même conte à un autre seuil en est une autre.
 */
export function noterConteLu(p: Progress, conte: string, seuil: number): Progress {
  const s = Math.floor(seuil);
  if (conte === '' || !Number.isFinite(s) || s <= 0) return p;
  const lus = p.contesLus[conte] ?? [];
  if (lus.includes(s)) return p;
  return { ...p, contesLus: { ...p.contesLus, [conte]: [...lus, s].sort((a, b) => a - b) } };
}

/** Le nombre de devinettes résolues. */
export function devinettesResolues(p: Progress): number {
  return p.devinettes.length;
}

/** Le nombre de versions de contes lues, tous seuils comptés. */
export function contesLus(p: Progress): number {
  return Object.values(p.contesLus).reduce((n, seuils) => n + seuils.length, 0);
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

/**
 * Fin du pas Apprendre : le pas est fait, la brique et le composé entrent en révision
 * avec une carte neuve, et la leçon est notée pour Tao — c'est l'acte de la journée, et
 * le constat du soir le dit.
 *
 * Le parcours avance ici : `jour` est le jour du parcours que l'écran a posé, sauts
 * compris. La suite de la session relit ce jour (`jourLecon`) ; la session suivante, de
 * plus ou du lendemain, prend le jour d'après.
 */
export function finApprendre(
  p: Progress,
  aujourdhui: string,
  maintenant: Date,
  appris: readonly string[],
  jour: number = jourLecon(p)
): Progress {
  let n = faitPasCourant(p, aujourdhui);
  n = assurerCartes(n, appris, maintenant);
  n = noterActivite(n, aujourdhui, 'lecon');
  const j = Math.max(1, Math.floor(jour));
  return setLearnView({ ...n, jourAppris: j, jourParcours: j + 1 }, 'brique');
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

/** Fin du pas Utiliser : le pas est fait et le texte compte comme une lecture pour Tao. */
export function finUtiliser(p: Progress, aujourdhui: string): Progress {
  const n = noterActivite(faitPasCourant(p, aujourdhui), aujourdhui, 'lecture');
  return setUseView(n, 'mots');
}

/* ---------- pas 5, Fixer ---------- */

/** Ouvre une question du pas Fixer : la reprise reprend la vérification où elle en est. */
export function setFix(p: Progress, i: number): Progress {
  return { ...p, fix: Math.max(0, Math.floor(i)) };
}

/** Note que la question `i` du pas Fixer a été répondue : elle ne se repose plus. */
export function setFixNotee(p: Progress, i: number): Progress {
  const n = Math.floor(i);
  return n <= p.fixNotee ? p : { ...p, fixNotee: Math.max(-1, n) };
}

/** La question à poser en entrant dans le pas Fixer, les questions notées passées. */
export function repriseFix(p: Progress): number {
  return Math.max(p.fix, p.fixNotee + 1);
}

/** Fin de la vérification : le pas est fait, la vérification repart à zéro. */
export function finFixer(p: Progress, aujourdhui: string): Progress {
  return { ...faitPasCourant(p, aujourdhui), fix: 0, fixNotee: -1 };
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
      /* Ce que la séance absorbe vraiment : le reste de la pile attend le lendemain. */
      d: p.due > 0 ? `${Math.min(p.due, CARTES_PAR_SEANCE)} cartes en questions` : 'Les révisions dues',
      m: m[1],
      go: 'rev'
    },
    { id: 'apprendre', t: 'Apprendre', d: 'Une brique, puis ses composés', m: m[2], go: 'learn' },
    { id: 'utiliser', t: 'Utiliser', d: 'Deux mots, une phrase, trois lignes', m: m[3], go: 'use' },
    { id: 'fixer', t: 'Fixer', d: 'Une vérification', m: m[4], go: 'check' },
    { id: 'clore', t: 'Clore', d: 'Le constat et la graine', m: m[5], go: 'close' }
  ];
}

/**
 * La pile due répartie en blocs de cinq minutes, à parts égales : le nombre de cartes de
 * chaque bloc. C'est ce que le chemin annonce, et ce que le bloc prend à son ouverture.
 */
export function repartirBlocs(due: number): number[] {
  const n = Math.max(1, Math.min(BLOCS_MAX, Math.ceil(due / CARTES_PAR_BLOC)));
  const base = Math.floor(due / n);
  const reste = due % n;
  /* Un bloc, cinq minutes : ce qu'il ne prend pas attend le bloc ou la journée d'après. */
  return Array.from({ length: n }, (_, i) => Math.min(CARTES_PAR_BLOC, base + (i < reste ? 1 : 0)));
}

/**
 * Le nombre de cartes que le pas Échauffer prend à son ouverture : exactement celui que
 * le chemin vient d'annoncer. En rattrapage, c'est le bloc courant ; sinon, une séance.
 */
export function cartesAOuvrir(p: Progress): number {
  if (!p.catchup) return CARTES_PAR_SEANCE;
  return repartirBlocs(p.due)[nextIndex(p)] ?? CARTES_PAR_BLOC;
}

/** Rattrapage : des blocs de cinq minutes, et les nouveaux caractères verrouillés. */
export function catchupSteps(due: number): Step[] {
  const blocs: Step[] = [];
  for (const [i, cartes] of repartirBlocs(due).entries()) {
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

/**
 * La session de plus : Apprendre, Utiliser, Fixer, Clore, dans l'ordre des six pas.
 * Pas d'anecdote ; Échauffer seulement s'il restait des cartes dues au départ.
 */
export function plusSteps(p: Progress): Step[] {
  const echauffer = p.enPlus?.echauffer ?? false;
  return sessionSteps(p)
    .filter((s) => s.id !== 'ouvrir' && (s.id !== 'echauffer' || echauffer))
    .map((s) => {
      if (s.id === 'apprendre') return { ...s, d: 'Une brique nouvelle, la suivante du parcours' };
      if (s.id === 'clore') return { ...s, d: 'Le constat, sans seconde graine' };
      return s;
    });
}

export function steps(p: Progress): Step[] {
  if (p.catchup) return catchupSteps(p.due);
  return p.enPlus === null ? sessionSteps(p) : plusSteps(p);
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

/* ---------- export et import ---------- */

/** Les cartes passent par `srs.ts` : les dates y sont en ISO, et se relisent telles quelles. */
export function toJSON(p: Progress): string {
  /* Les cartes sortent par `toJSON` de `srs.ts` : dates en ISO, version du format. */
  return JSON.stringify({ ...p, cartes: JSON.parse(cartesToJSON(p.cartes)) as unknown }, null, 2);
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

/** Relit la session de plus en cours. Absente ou aberrante : aucune. */
function lirePlus(v: unknown): SessionPlus | null {
  if (typeof v !== 'object' || v === null) return null;
  return { echauffer: (v as Record<string, unknown>).echauffer === true };
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
    const lue: Revision = {
      c: r.c,
      correct: r.correct === true,
      tries: typeof r.tries === 'number' && r.tries >= 0 ? Math.floor(r.tries) : 0,
      seconds: typeof r.seconds === 'number' && r.seconds >= 0 ? r.seconds : 0
    };
    /* Les leurres pris : absents d'un événement plus ancien, on ne les devine pas. */
    if (Array.isArray(r.leurres)) lue.leurres = listeDeCaracteres(r.leurres);
    return [lue];
  });
}

/** Relit une liste de caractères, sans doublon, dans l'ordre. Absente ou aberrante : vide. */
function listeDeCaracteres(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((c): c is string => typeof c === 'string' && c !== ''))];
}

/** Relit les trophées obtenus : un identifiant, une journée. Une entrée aberrante est écartée. */
function lireTropheesAcquis(v: unknown): Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [id, jour] of Object.entries(v as Record<string, unknown>)) {
    if (id !== '' && typeof jour === 'string' && FORMAT_JOUR.test(jour)) out[id] = jour;
  }
  return out;
}

/** Relit les contes lus : un conte, des seuils entiers positifs, sans doublon, triés. */
/** Relit la devinette du jour. Absente ou aberrante : aucune, elle se reposera. */
function lireDevinetteDuJour(v: unknown): DevinetteDuJour | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  if (typeof d.jour !== 'string' || !FORMAT_JOUR.test(d.jour)) return null;
  if (typeof d.id !== 'string' || d.id === '') return null;
  if (d.issue !== 'posee' && d.issue !== 'resolue' && d.issue !== 'montree') return null;
  return { jour: d.jour, id: d.id, issue: d.issue };
}

function lireContesLus(v: unknown): Record<string, number[]> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, number[]> = {};
  for (const [conte, seuils] of Object.entries(v as Record<string, unknown>)) {
    if (conte === '' || !Array.isArray(seuils)) continue;
    const lus = [
      ...new Set(
        seuils.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0)
      )
    ].sort((a, b) => a - b);
    if (lus.length > 0) out[conte] = lus;
  }
  return out;
}

/** Relit un rang de question déjà notée. Absent ou aberrant : aucune question notée. */
function lireNotee(v: unknown): number {
  return typeof v === 'number' && v >= 0 ? Math.floor(v) : -1;
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

/**
 * Relit les cartes d'un export, par `fromJSON` de `srs.ts`. Le champ est accepté sous ses
 * deux formes : l'enveloppe `{version, cards}` de `srs.ts`, ou la simple liste de cartes
 * telle que la rend IndexedDB. Absent ou illisible : aucune carte, et la session continue.
 */
export function lireCartesJSON(brut: unknown): ReviewCard[] {
  if (brut === undefined || brut === null) return [];
  const texte =
    typeof brut === 'string'
      ? brut
      : JSON.stringify(Array.isArray(brut) ? { version: 1, cards: brut } : brut);
  try {
    return cartesFromJSON(texte);
  } catch {
    return [];
  }
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
    /* Les tracés achevés : absents d'un export plus ancien, rien n'est achevé. */
    tracesAchevees: listeDeCaracteres(o.tracesAchevees),
    /* Champs des pas Utiliser et Fixer : absents d'un export plus ancien, ils reprennent leur défaut. */
    use: isUseView(o.use) ? o.use : vide.use,
    fix: typeof o.fix === 'number' && o.fix >= 0 ? Math.floor(o.fix) : 0,
    fixNotee: lireNotee(o.fixNotee),
    /* Cartes et pile d'échauffement : absentes d'un export plus ancien, elles se relisent vides. */
    cartes: lireCartesJSON(o.cartes),
    revue: Array.isArray(o.revue) ? o.revue.filter((c): c is string => typeof c === 'string') : [],
    rev: typeof o.rev === 'number' && o.rev >= 0 ? Math.floor(o.rev) : 0,
    revNotee: lireNotee(o.revNotee),
    revisions: lireRevisions(o.revisions),
    tao,
    /* Champs de la première session et des cartes : absents d'un export plus ancien. */
    premiere: lirePremiere(o),
    premiereVue: isEtapeDepart(o.premiereVue) ? o.premiereVue : vide.premiereVue,
    parcours: isParcours(o.parcours) ? o.parcours : null,
    /* Le jour du parcours : absent d'un export plus ancien, il se déduit des journées. */
    jourParcours:
      typeof o.jourParcours === 'number' && o.jourParcours >= 1
        ? Math.floor(o.jourParcours)
        : undefined,
    /* Le jour appris et la session de plus : absents d'un export plus ancien. */
    jourAppris:
      typeof o.jourAppris === 'number' && o.jourAppris >= 1 ? Math.floor(o.jourAppris) : undefined,
    plus: typeof o.plus === 'number' && o.plus >= 0 ? Math.floor(o.plus) : 0,
    enPlus: lirePlus(o.enPlus),
    /* La rétention cible : absente d'un export plus ancien, elle reprend le défaut. */
    retention: bornerRetention(o.retention),
    /* Les cartes mises de côté : absentes d'un export plus ancien, rien n'est de côté. */
    enAttente: Array.isArray(o.enAttente)
      ? [...new Set(o.enAttente.filter((c): c is string => typeof c === 'string' && c !== ''))].sort()
      : [],
    /* Les trophées obtenus : absents d'un export plus ancien, rien n'est noté. */
    tropheesAcquis: lireTropheesAcquis(o.tropheesAcquis),
    /* Les devinettes et les contes lus : absents d'un export plus ancien, rien n'est lu. */
    devinettes: listeDeCaracteres(o.devinettes),
    devinetteDuJour: lireDevinetteDuJour(o.devinetteDuJour),
    contesLus: lireContesLus(o.contesLus)
  };
}
