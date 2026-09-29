/**
 * L'état d'une session : six pas, toujours dans le même ordre, reprise au pas exact,
 * remise à zéro à chaque nouvelle journée, rattrapage après une absence, et la session
 * de plus (quatre pas, une brique, jamais une seconde pierre) une fois la journée faite.
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
import { lireTrouves, type Trouve } from './trouves';
import {
  avancer,
  commencer,
  essayer,
  etatExamensVide,
  examenOuvert,
  issue as issueExamen,
  lireEtatExamens,
  ouvrirExamen,
  peutPasser,
  situation,
  terminer,
  texteExamen,
  type Bilan as BilanExamen,
  type CheminExamen,
  type EtatExamens,
  type Examen,
  type ExamensDonnees,
  type QuestionExamen,
  type Situation
} from './examens';
import {
  annonceDuRythme,
  briqueDuJour,
  dansLesTrente,
  droitsVides,
  lireDroits,
  noterAnnonce,
  noterBascule,
  noterBriqueGratuite,
  rythme,
  type Acces,
  type EtatDroits,
  type Rythme
} from './droits';
import { lireLettresNotees, type LettreNotee } from './lettres';
import { cleLecture, lireChapitre, type LectureChapitres } from './lecture';
import { lireNiveau, lireNiveaux, trierNiveaux, type Niveau } from './niveaux';
import {
  ajouterPoint,
  artsVides,
  lireArt,
  lireArts,
  lireHeros,
  nettoyerNom,
  pointsDerives,
  type Art,
  type Arts,
  type BeteId,
  type Heros
} from './heros';
import { SANS_RAPPEL, lireRappel, type Rappel } from './rappels';
import { ajouterMoyenne, lireVoix } from './tons/voix';
import type { ChoixVoix } from './audio';
import { lireDernierExport } from './garde';
import { lireAvisDemande } from './avis';
import { etatNeuf, lireEtatOuvertures, type EtatOuvertures } from './ouvertures';


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
 * (f1 人, f2 大, f3 天), le mot lu (f4 天天), le bilan (f5), les deux questions
 * (objectif, rythme), l'heure du rappel, puis le choix du personnage (brief §8). La reprise se fait à
 * l'écran exact.
 */
export type EtapeDepart = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'objectif' | 'rythme' | 'heure' | 'personnage';

/**
 * `heure` : l'heure du rappel quotidien, dans l'app iOS seulement ; sur le web,
 * `premiere.departApres` la saute.
 */
export const ETAPES_DEPART = ['f1', 'f2', 'f3', 'f4', 'f5', 'objectif', 'rythme', 'heure', 'personnage'] as const;

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

/**
 * Les vues du pas Utiliser, dans l'ordre : les mots et la phrase, puis le texte, puis,
 * certains jours, un jeu (`utiliser.ts` dit lesquels) : le dictionnaire éclair ou le
 * message WeChat, jamais les deux.
 */
export type UseView = 'mots' | 'texte' | JeuUtiliser;

export const USE_VIEWS = ['mots', 'texte', 'eclair', 'message'] as const;

/** Les deux jeux que le pas Utiliser peut poser après le texte (brief §9). */
export type JeuUtiliser = 'eclair' | 'message';

/**
 * Le jeu du pas Utiliser, choisi une fois par journée, à l'entrée du pas, et figé : la
 * reprise au pas exact retombe sur le même mot ou le même dialogue, au même échange,
 * avec les mêmes répliques écartées. `jeu` vaut `null` quand la journée n'en pose pas ;
 * le choix est gardé quand même, pour que la session de plus n'en pose pas un autre.
 */
export type UseJeu = {
  /** La journée du choix, AAAA-MM-JJ. Un autre jour, il se refait. */
  jour: string;
  jeu: JeuUtiliser | null;
  /** Le mot (`eclair.json`) ou le dialogue (`wechat.json`) posé ; vide sans jeu. */
  id: string;
  /**
   * Où l'on en est. Message : l'échange en cours, égal au nombre d'échanges une fois le
   * dialogue mené à bout. Éclair : 0, puis 1 une fois le sens choisi.
   */
  i: number;
  /** Message : les répliques fausses déjà écartées à l'échange en cours. */
  ecartees: string[];
  /** Éclair : le sens choisi, `null` tant qu'on n'a pas répondu. */
  reponse: string | null;
  /** Le pas Utiliser qui l'a posé est fini : la journée n'en pose plus d'autre. */
  fait: boolean;
};

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
  /** `false` : la réponse ne se juge pas au temps, comme le tracé (`Outcome.chrono`). */
  chrono?: false;
  /** `true` : jamais plus que « Bien », comme un ton reconnu à « Dis-le » (`Outcome.auMieuxBien`). */
  auMieuxBien?: true;
  /**
   * L'art du personnage que la réponse exerce (`heros.ts`) : la question le dit d'après
   * son type. Absent (un jeu, un événement d'avant ce champ) : la lecture.
   */
  art?: Art;
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

/**
 * Pourquoi une journée ne pose pas de brique nouvelle : le rythme gratuit, entre deux
 * briques (story 7.2), ou un examen à passer (story 8.4, « Pause jusqu'à réussite »).
 */
export type RaisonSansBrique = 'rythme' | 'examen';

/** Une brique acquise : son caractère, et le jour du chemin dont elle est la leçon. */
export type BriqueAcquise = { c: string; jour: number };

/**
 * La journée sans brique nouvelle : sa raison, et la brique acquise sur laquelle le pas
 * Apprendre revient (`c`), avec le jour du chemin qui l'a posée (`lecon`) : sa fiche, un
 * composé qu'elle a ouvert, le tracé s'il est activé. `c` vide : aucune brique acquise n'a
 * de carte, Apprendre relit la dernière leçon.
 */
export type SansBrique = { raison: RaisonSansBrique; c: string; lecon: number };

/**
 * La journée telle que la session l'a ouverte (`preparerJournee`) : son rythme
 * (`droits.rythme`), et, les jours sans brique nouvelle, ce qu'Apprendre revoit.
 */
export type Journee = { jour: string; rythme: Rythme; sansBrique: SansBrique | null };

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
   * Les journées travaillées, une par pierre posée, dans l'ordre. C'est la seule
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
  /**
   * Le jeu du pas Utiliser de la journée, et où il en est (`UseJeu`). `null` tant que le
   * pas ne l'a pas choisi. Absent d'une progression plus ancienne : aucun.
   */
  useJeu: UseJeu | null;
  /**
   * Les dialogues du message WeChat menés à bout au pas Utiliser, par identifiant, chacun
   * une fois, dans l'ordre : le pas n'en repose pas un déjà lu. Absents d'une progression
   * plus ancienne : aucun.
   */
  messagesLus: string[];
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
   * Les contes lus : pour chaque conte (identifiant de l'index), les niveaux dont la version
   * a été lue (« 255 », « hsk3 »), du plus petit au plus grand. Le même conte se relit plus
   * riche à chaque niveau, et chaque version est un trophée. Le lecteur les note par
   * `noterConteLu` ; un récit long n'y entre qu'une fois tous ses chapitres lus. Absente
   * d'une progression plus ancienne : aucun conte lu ; un seuil noté en nombre (255) s'y
   * relit en « 255 ».
   */
  contesLus: Record<string, Niveau[]>;
  /**
   * Les récits longs en cours, par version (`<niveau>/<conte>`) : les chapitres lus et celui
   * où reprendre (`noterChapitreLu`, `noterReprise`). Un chapitre lu ne fait pas un conte
   * lu : `contesLus` attend le dernier. Absente d'une progression plus ancienne : aucune.
   */
  chapitres: Record<string, LectureChapitres>;
  /**
   * Réglage : le mode relecture. Allumé, l'app charge l'aperçu de l'export (`apercu/`), les
   * fiches et les contes que le pipeline a écrits mais que personne n'a encore relus, chacun
   * marqué « à relire » ; et un conte que l'acquis ne permet pas encore de lire s'ouvre quand
   * même, marqué « pas encore dans ton acquis ». Ce qu'il ouvre ainsi ne compte pas comme
   * lu. Décision du propriétaire, pour essayer les textes avant de les valider. Éteint par
   * défaut ; absent d'une progression plus ancienne : éteint.
   */
  relecture: boolean;
  /**
   * Réglage : le retour haptique de l'app iOS (`haptique.ts`), un léger tap sur une bonne
   * réponse et un signal doux à la fin de la session, jamais rien sur une erreur. Allumé par
   * défaut, comme le veut Apple (on doit pouvoir l'éteindre) ; sans effet sur le web.
   * Absent d'une progression plus ancienne : allumé.
   */
  haptique: boolean;
  /**
   * Réglage : le rappel quotidien de l'app iOS (`rappels.ts`), une notification par jour à
   * l'heure choisie, avec le début de l'anecdote. L'heure se choisit à la première session,
   * après l'objectif et le rythme, ou dans Réglages ; sans effet sur le web. Absent d'une
   * progression plus ancienne : éteint, sans heure.
   */
  rappel: Rappel;
  /**
   * Réglage : « Dire les tons » (story 9.1), la question « Dis-le » de la révision, où l'on
   * prononce un caractère acquis et l'app reconnaît le ton sur l'appareil. Allumé par
   * défaut ; un micro refusé l'éteint, Réglages le rallume. Absent d'une progression plus
   * ancienne : allumé.
   */
  direTons: boolean;
  /**
   * Réglage : « Voix » (décision du propriétaire du 29 septembre 2026, brief §7), la voix qui
   * dit les caractères et les mots : celle de l'appareil (`appareil`) ou les fichiers
   * enregistrés (`enregistree`). `null` : la voix par défaut, celle de l'appareil s'il a une
   * voix du mandarin du continent, sinon les fichiers (`audio.voixParDefaut`). Absent d'une
   * progression plus ancienne : la voix par défaut.
   */
  voixReference: ChoixVoix | null;
  /**
   * La voix de l'apprenant pour « Dis-le » (`tons/voix.ts`) : la moyenne, en hertz, de
   * chacune des trente dernières syllabes analysées, rien d'autre. Jamais le son. Absente
   * d'une progression plus ancienne : aucune, la voix s'apprend en cinq syllabes.
   */
  voix: number[];
  /**
   * Le jour du dernier export de la progression (AAAA-MM-JJ), que Réglages montre
   * (`garde.ts`) ; `null` : jamais. L'export l'emporte avec lui. Absent d'une progression
   * plus ancienne : jamais.
   */
  dernierExport: string | null;
  /**
   * La journée de la dernière demande de note de l'app iOS (`avis.ts`) ; `null` : aucune.
   * La suivante attend cent vingt jours. Absente d'une progression plus ancienne : aucune.
   */
  avisDemande: string | null;
  /**
   * Les mots devinés au dictionnaire éclair, par identifiant, chacun une fois, dans
   * l'ordre : le compteur « mots devinés » (`eclair.ts`, `noterMotDevine`). Absent d'une
   * progression plus ancienne : aucun mot deviné.
   */
  motsDevines: string[];
  /**
   * Les caractères trouvés en chemin : celui que l'anecdote d'une fête ou d'un terme
   * solaire fait découvrir, une entrée par caractère, avec sa journée et sa source
   * (`trouves.ts`). Ce ne sont pas des briques du parcours : aucune carte, aucune
   * révision. Absents d'une progression plus ancienne : aucun.
   */
  trouves: Trouve[];
  /**
   * Les fêtes dont l'anecdote a été montrée : pour chaque fête (`zhongqiu`), la journée
   * où l'écran Ouvrir l'a montrée (AAAA-MM-JJ). Cette journée dit aussi de quelle année
   * il s'agit : elle tombe dans la fenêtre d'une seule occurrence de la fête. L'anecdote
   * d'une fête se montre une fois par occurrence, le premier jour de la fenêtre où l'on
   * ouvre l'app, et toute cette journée-là ; les autres jours de la fenêtre ont l'anecdote
   * ordinaire (`saisons.anecdoteDeFete`). Retour du propriétaire du 26 septembre 2026.
   * Absentes d'une progression plus ancienne : aucune fête vue.
   */
  fetesVues: Record<string, string>;
  /**
   * Les anecdotes ordinaires montrées : pour chaque caractère d'anecdote, la dernière
   * journée où l'écran Ouvrir l'a montrée. Elle fixe l'anecdote de la journée (la même
   * toute la journée, où qu'on la relise) et écarte toute redite en trente jours
   * (`anecdotes.choisirAnecdote`). Absentes d'une progression plus ancienne : aucune.
   */
  anecdotesVues: Record<string, string>;
  /**
   * Les plats de la cuisine de Tao réussis, par identifiant, chacun une fois, dans l'ordre :
   * chaque ingrédient trouvé, Tao contente. Le bol des trophées se gagne au premier. Le
   * jeu les note par `noterRecette`. Absente d'une progression plus ancienne : vide.
   */
  recettes: string[];
  /**
   * Les lettres de Que arrivées, dans l'ordre du feuilleton, avec leur journée d'arrivée
   * et celle où elles ont été lues (`lettres.ts` : une par semaine au plus, le dimanche
   * ou à la première session de la semaine). Absentes d'une progression plus ancienne :
   * aucune.
   */
  lettres: LettreNotee[];
  /**
   * Le personnage choisi (brief §8, `heros.ts`) : sa bête, son nom, le dernier rang
   * annoncé au 放榜. `null` tant qu'il n'est pas choisi : à la fin de la première session,
   * ou, pour une progression d'avant lui, la première fois qu'on ouvre son écran.
   */
  heros: Heros | null;
  /**
   * Les points des quatre arts : un par bonne réponse notée (`noterRevision`), un par
   * tracé achevé (`traceAchevee`). Jamais pour le temps passé, jamais retirés. Absents
   * d'une progression d'avant le personnage : recalculés depuis ce qu'elle garde
   * (`pointsDerives`).
   */
  arts: Arts;
  /**
   * Les examens 科举 et les 月课 (`examens.ts`) : les réussis avec leur journée, l'examen
   * ouvert, la tentative en cours ou manquée (série, question en cours, réponses, manqués,
   * instant de l'échec). Absents d'une progression d'avant les examens : rien de réussi,
   * et `migre` faux, pour que ses rangs déjà annoncés deviennent des examens reçus.
   */
  examens: EtatExamens;
  /**
   * Les droits (`droits.ts`, story 7.1) : les cadeaux des paliers et leurs dates, le premier
   * jour du rythme gratuit, les jours des briques gratuites, le jour où Clore l'a dit.
   * L'achat, lui, n'est pas gardé : l'appareil le dit (`Acces`). Absents d'une progression
   * d'avant eux : rien de reçu, rien de noté.
   */
  droits: EtatDroits;
  /**
   * La journée préparée (`preparerJournee`) : son rythme et, sans brique nouvelle, la brique
   * revue. Figée pour la journée : la reprise au pas exact retombe sur la même brique. Celle
   * d'une autre journée ne compte pas (`journeeDuJour`). Absente d'une progression plus
   * ancienne : elle se prépare à l'ouverture.
   */
  journee: Journee | null;
  /**
   * L'aventure (`ouvertures.ts`) : les portes ouvertes, avec leur journée, et celles que Tao
   * a déjà annoncées. Une porte ouverte le reste. `null` : une progression d'avant l'aventure,
   * ou importée sans ce suivi ; au premier retour au menu, ce qu'elle a atteint s'ouvre en
   * silence, sans rafale d'annonces.
   */
  ouvertures: EtatOuvertures | null;
};

/**
 * Le jour du parcours que la session pose : l'index rangé dans la progression s'il y
 * est, sinon le nombre de journées travaillées. Le premier jour vaut 1.
 */
export function jourParcours(p: Progress): number {
  return Math.max(1, Math.floor(p.jourParcours ?? p.days));
}

/**
 * Le jour du chemin atteint, celui de l'aventure (`ouvertures.ts`) : la dernière leçon du
 * parcours apprise. 0 pendant la première session, 3 après elle (人, 大, 天) ; il avance avec
 * chaque brique apprise, jamais avec l'horloge ni l'achat.
 */
export function jourDuChemin(p: Progress): number {
  return p.premiere ? 0 : jourParcours(p) - 1;
}

/**
 * Le jour du parcours que les écrans de la session lisent : celui que la session a
 * appris, dès la fin du pas Apprendre ; le prochain à apprendre, avant. Apprendre,
 * Utiliser, Fixer et Clore voient ainsi la même leçon, même une fois le parcours avancé.
 */
export function jourLecon(p: Progress): number {
  return sansBrique(p)?.lecon ?? p.jourAppris ?? jourParcours(p);
}

/**
 * Le dernier jour du parcours que l'apprenant a rencontré : la leçon apprise aujourd'hui,
 * sinon celle qu'il va apprendre ; en rattrapage, où rien de neuf n'entre, la veille de
 * celle-ci. `0` tant que la première session n'est pas faite. L'anecdote du jour préfère
 * un caractère de ce jour-là ou des précédents (`anecdotes.recents`).
 */
export function jourRencontre(p: Progress): number {
  if (p.premiere) return 0;
  if (p.jourAppris !== undefined) return p.jourAppris;
  /* En rattrapage ou un jour sans brique, rien de neuf n'entre : la veille de la leçon à poser. */
  return p.catchup || sansBrique(p) !== null ? jourParcours(p) - 1 : jourParcours(p);
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
    useJeu: null,
    messagesLus: [],
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
    contesLus: {},
    chapitres: {},
    relecture: false,
    haptique: true,
    rappel: SANS_RAPPEL,
    direTons: true,
    voixReference: null,
    voix: [],
    dernierExport: null,
    avisDemande: null,
    motsDevines: [],
    trouves: [],
    fetesVues: {},
    anecdotesVues: {},
    recettes: [],
    lettres: [],
    heros: null,
    arts: artsVides(),
    examens: etatExamensVide(),
    droits: droitsVides(),
    journee: null,
    ouvertures: etatNeuf()
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
 * Pose la pierre du jour : la journée entre dans les journées travaillées. Appelé à la
 * clôture, ou à la fin d'un bloc de rattrapage, une seule fois par journée. Une pierre
 * posée ne se retire jamais.
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
  return {
    ...pasAZero(p),
    revisions: [],
    plus: 0,
    enPlus: null,
    jourAppris: undefined,
    useJeu: null
  };
}

/* ---------- la journée sans brique nouvelle ---------- */

/** La journée préparée, si c'est bien celle de la session ; `null` sinon. */
export function journeeDuJour(p: Progress): Journee | null {
  return p.journee !== null && p.journee.jour === p.day ? p.journee : null;
}

/**
 * La journée ne pose pas de brique nouvelle : ce qu'Apprendre revoit à la place. `null` un
 * jour avec brique, en session de plus, ou tant que la journée n'est pas préparée.
 */
export function sansBrique(p: Progress): SansBrique | null {
  return p.enPlus === null ? (journeeDuJour(p)?.sansBrique ?? null) : null;
}

/**
 * La brique acquise la plus fragile : la plus basse stabilité FSRS parmi celles qui ont une
 * carte, la première des candidates à égalité. Les prioritaires passent d'abord (story 8.4 :
 * les caractères manqués à l'examen) ; aucune n'a de carte, on revient aux candidates.
 */
export function briqueLaPlusFragile(
  p: Progress,
  candidates: readonly BriqueAcquise[],
  prioritaires: readonly BriqueAcquise[] = []
): BriqueAcquise | null {
  const choisir = (l: readonly BriqueAcquise[]): BriqueAcquise | null => {
    let mieux: BriqueAcquise | null = null;
    let plusBasse = Infinity;
    for (const b of l) {
      const k = carte(p, b.c);
      if (k === null || k.card.stability >= plusBasse) continue;
      mieux = b;
      plusBasse = k.card.stability;
    }
    return mieux;
  };
  return choisir(prioritaires) ?? choisir(candidates);
}

/**
 * Une pause des briques décidée hors d'ici : l'examen à passer (story 8.4), avec les
 * caractères manqués qu'Apprendre prend d'abord.
 */
export type PauseDesBriques = { raison: 'examen'; prioritaires: readonly BriqueAcquise[] };

/**
 * Prépare la journée, une fois, à son ouverture : son rythme (`droits.rythme`), le premier
 * jour du rythme gratuit s'il tombe aujourd'hui, et, si elle ne pose pas de brique
 * nouvelle, la brique acquise sur laquelle Apprendre revient, la plus fragile.
 *
 * Sans brique nouvelle, la session garde ses six pas, dans le même ordre, sur l'acquis
 * (brief §6) : au rythme gratuit entre deux briques (`droits.briqueDuJour`), ou quand une
 * pause est passée. La story 8.4 s'y branche ainsi : l'examen à passer
 * (`examens.briquesEnPause`) devient `pause`, ses caractères manqués (avec le jour de leur
 * leçon) ses prioritaires ; rien d'autre ne change ici.
 *
 * `candidates` : les briques des leçons déjà posées (`content.briquesAcquises`). Une
 * journée déjà préparée ne bouge plus : la reprise au pas exact retombe sur la même brique.
 */
export function preparerJournee(
  p: Progress,
  acces: Acces,
  candidates: readonly BriqueAcquise[],
  pause: PauseDesBriques | null = null
): Progress {
  if (p.premiere || journeeDuJour(p) !== null) return p;
  const chemin = jourParcours(p);
  const droits = noterBascule(p.droits, chemin, p.day);
  const raison: RaisonSansBrique | null =
    pause !== null ? pause.raison : briqueDuJour(droits, acces, p.day, chemin) ? null : 'rythme';
  let revue: SansBrique | null = null;
  if (raison !== null) {
    const b = briqueLaPlusFragile(p, candidates, pause?.prioritaires ?? []);
    revue = { raison, c: b?.c ?? '', lecon: b?.jour ?? Math.max(1, chemin - 1) };
  }
  return { ...p, droits, journee: { jour: p.day, rythme: rythme(droits, acces, p.day, chemin), sansBrique: revue } };
}

/**
 * Clore dit-il aujourd'hui que le rythme gratuit commence ? Le premier jour où la journée
 * est au rythme gratuit, ce jour-là seulement (`droits.annonceDuRythme`).
 */
export function annonceRythmeGratuit(p: Progress): boolean {
  const j = journeeDuJour(p);
  return j !== null && annonceDuRythme(p.droits, j.rythme, p.day);
}

/* ---------- la session de plus ---------- */

/**
 * La session de plus est-elle du rythme de la journée ? Avec Wenlu complet, ou tant que la
 * leçon qu'elle poserait est dans les trente premiers jours du chemin (`droits.sessionDePlus`) ;
 * jamais un jour sans brique nouvelle. Sinon, le menu propose « Réviser encore ».
 */
export function plusPermise(p: Progress): boolean {
  const j = journeeDuJour(p);
  if (j?.sansBrique) return false;
  /* Un examen ouvert, à passer ou manqué : aucune brique nouvelle, pas de session de plus. */
  if (p.examens.ouvert !== null) return false;
  return j?.rythme === 'complet' || dansLesTrente(jourParcours(p));
}

/**
 * Une session de plus se propose une fois la journée faite, et jamais en rattrapage :
 * aucune brique nouvelle n'entre tant que la pile n'est pas redescendue. Au rythme
 * gratuit, elle ne se propose pas (`plusPermise`).
 */
export function peutPlus(p: Progress): boolean {
  return !p.premiere && !p.catchup && p.enPlus === null && allDone(p) && plusPermise(p);
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
 * Clore, la seule fin d'une session : le pas est fait et la pierre du jour posée, une
 * fois par journée (`noterJourTravaille`). Une session de plus close rend la journée
 * faite et compte une session de plus ; elle ne pose jamais une seconde pierre.
 */
export function cloreSession(p: Progress, jour: string): Progress {
  const f = faitPasCourant(p, jour);
  /* Le premier jour du rythme gratuit, Clore l'a dit : il ne le redira pas. */
  const dit = annonceRythmeGratuit(f) ? { ...f, droits: noterAnnonce(f.droits, jour) } : f;
  const n = noterJourTravaille(dit, jour);
  if (n.enPlus === null) return n;
  const journee: Progress = { ...n, enPlus: null, plus: n.plus + 1 };
  return { ...journee, done: sessionSteps(journee).map(() => true) };
}

/* ---------- les examens : les briques en pause (story 8.4) ---------- */

/**
 * Ce que la session sait des examens pour décider : la liste qu'on peut passer sur le chemin
 * (`examens.examensPassables`), et les caractères lus, au seuil de Mon chemin
 * (`examens.lusPourExamens`). Rien d'autre : ni l'horloge, ni une durée.
 */
export type ContexteExamens = { liste: readonly Examen[]; lus: number };

/** Où en est l'examen (`examens.situation`) : à passer, en cours, en attente, à repasser. */
export function situationExamen(p: Progress, ctx: ContexteExamens): Situation {
  return situation(ctx.liste, p.examens, ctx.lus, p.cartes);
}

/** Les caractères manqués à la dernière tentative, tant que l'examen attend d'être repassé. */
export function manquesARevoir(p: Progress, ctx: ContexteExamens): string[] {
  const s = situationExamen(p, ctx);
  return s.etat === 'attente' || s.etat === 'a_repasser' ? [...s.tentative.manques] : [];
}

/**
 * La pause des briques pour `preparerJournee` : un examen ouvert, à passer ou manqué, et
 * aucune brique nouvelle n'entre avant qu'il soit réussi. Les caractères manqués, avec le jour
 * de leur leçon (`content.leconsPosees`), sont ses prioritaires : Apprendre revient d'abord
 * sur eux. `null` : aucun examen n'attend, les briques avancent.
 */
export function pauseDesBriques(
  p: Progress,
  ctx: ContexteExamens,
  lecons: readonly BriqueAcquise[]
): PauseDesBriques | null {
  if (situationExamen(p, ctx).etat === 'aucun') return null;
  const prioritaires = manquesARevoir(p, ctx).flatMap((c) => lecons.filter((l) => l.c === c).slice(0, 1));
  return { raison: 'examen', prioritaires };
}

/**
 * Le palier atteint, l'examen s'ouvre et le reste, même si le compte des lus redescend
 * (`examens.ouvrirExamen`). Clore l'appelle ; rien à ouvrir : le même état.
 */
export function ouvrirExamenAuPalier(p: Progress, ctx: ContexteExamens): Progress {
  const e = ouvrirExamen(ctx.liste, p.examens, ctx.lus);
  return e === p.examens ? p : { ...p, examens: e };
}

/**
 * L'examen que Clore annonce : celui dont le palier est atteint et qui ne s'était pas encore
 * ouvert. Clore le dit en une ligne, une fois, puis l'ouvre. `null` : rien à dire.
 */
export function examenAAnnoncer(p: Progress, ctx: ContexteExamens): Examen | null {
  const e = examenOuvert(ctx.liste, p.examens, ctx.lus);
  return e !== null && p.examens.ouvert !== e.id ? e : null;
}

/** La ligne de Clore, le palier atteint : « 50 caractères lus : l'examen 县试 s'ouvre. » */
export function ligneDeClore(d: ExamensDonnees, e: Examen): string {
  return e.sorte === 'yueke'
    ? texteExamen(d, 'ouvert_yueke', { lus: e.palier })
    : texteExamen(d, 'ouvert', { lus: e.palier, examen: e.hz });
}

/**
 * L'examen, vu du menu : l'état, le bouton de la journée faite, la ligne sous le chemin et la
 * phrase de Tao. Le bouton ne passe l'examen que la journée faite, hors session de plus,
 * jamais en rattrapage, et, manqué, seulement quand la reprise est permise ; tant qu'elle
 * attend, le bouton reste « Réviser encore » et la ligne le dit, sans compte à rebours.
 * Le jour où un examen est reçu, Tao le constate. `null` : aucun examen à dire.
 */
export type ExamenDuMenu = {
  etat: Situation['etat'] | 'recu';
  examen: Examen;
  /** Le bouton plein passe l'examen. */
  passer: boolean;
  bouton: string;
  /** La ligne sous le chemin, en gras la première phrase ; vide le jour de la réussite. */
  ligne: string;
  suite: string;
  tao: string;
};

export function examenDuMenu(p: Progress, d: ExamensDonnees, ctx: ContexteExamens): ExamenDuMenu | null {
  const s = situationExamen(p, ctx);
  if (s.etat === 'aucun') {
    const recu = ctx.liste.find((e) => p.examens.reussis[e.id] === p.day);
    if (recu === undefined) return null;
    return { etat: 'recu', examen: recu, passer: false, bouton: '', ligne: '', suite: '', tao: texteExamen(d, 'tao_menu_recu', { examen: recu.hz }) };
  }
  const e = s.examen;
  const passer = peutPasser(s, { journeeFaite: allDone(p) && p.enPlus === null, rattrapage: p.catchup });
  const bouton = e.sorte === 'yueke' ? texteExamen(d, 'bouton_yueke') : texteExamen(d, 'bouton', { examen: e.hz });
  if (s.etat === 'attente') {
    return { etat: s.etat, examen: e, passer, bouton, ligne: texteExamen(d, 'attente'), suite: '', tao: texteExamen(d, 'tao_menu_attente') };
  }
  const ligne =
    s.etat === 'a_repasser'
      ? texteExamen(d, 'menu_repasser', { examen: e.hz })
      : texteExamen(d, 'menu_ouvert', { palier: e.palier, examen: e.hz });
  return {
    etat: s.etat,
    examen: e,
    passer,
    bouton,
    ligne,
    suite: texteExamen(d, 'menu_pause'),
    tao: texteExamen(d, 'tao_menu', { examen: e.hz })
  };
}

/**
 * Commence l'examen, ou le reprend à la même question (`examens.commencer`). `poses` : les
 * questions posables de la série, figées au départ.
 */
export function commencerExamen(p: Progress, e: Examen, chemin: CheminExamen, poses: readonly number[] = []): Progress {
  const n = commencer(p.examens, e, chemin, poses);
  return n === p.examens ? p : { ...p, examens: n };
}

/**
 * Une réponse touchée à la question `i` de l'examen. Le premier essai note les caractères qui
 * portent la réponse par `grade` (juste : Bien, sans chronomètre ; faux : Oublié), qu'ils
 * reviennent en révision, reçu ou non. Chaque bonne réponse donne son point 读, au premier
 * essai comme rattrapée ; une rattrapée ne note rien de plus. Une erreur ne coûte rien.
 */
export function repondreExamen(
  p: Progress,
  i: number,
  q: QuestionExamen,
  donnee: number | boolean,
  maintenant: Date
): Progress {
  const r = essayer(p.examens, i, q, donnee);
  if (!r.nouveau) return p;
  let n: Progress = { ...p, examens: r.etat };
  if (r.premier) for (const c of q.porte) n = planifierCarte(n, c, issueExamen(r.juste), maintenant);
  if (r.juste) n = { ...n, arts: ajouterPoint(n.arts, 'du') };
  return n;
}

/** La question suivante : « Quitter » reprendra à celle-ci. */
export function avancerExamen(p: Progress, i: number): Progress {
  const e = avancer(p.examens, i);
  return e === p.examens ? p : { ...p, examens: e };
}

/**
 * La dernière question répondue : le constat. Reçu, l'examen est noté réussi à sa journée et
 * les briques reprennent ; pas encore, l'échec est noté, les manqués attendent d'être revus.
 * L'examen fait lire : Tao le compte comme une lecture, une fois.
 */
export function terminerExamen(
  p: Progress,
  jour: string,
  maintenant: Date,
  questions: number,
  regle: { justes: number; sur: number }
): { p: Progress; bilan: BilanExamen } {
  const r = terminer(p.examens, questions, maintenant, jour, regle);
  if (r.etat === p.examens) return { p, bilan: r.bilan };
  return { p: noterActivite({ ...p, examens: r.etat }, jour, 'lecture'), bilan: r.bilan };
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
  max: number = CARTES_PAR_SEANCE,
  prioritaires: readonly string[] = []
): ReviewCard[] {
  const dues = duesPosables(p, maintenant);
  /* Les caractères manqués à l'examen passent d'abord (story 8.4), s'ils sont dus : une
     révision en avance ne compterait pas pour la reprise. Le reste garde son ordre. */
  const d = prioritaires.length === 0 ? dues : [...dues.filter((c) => prioritaires.includes(c.id)), ...dues.filter((c) => !prioritaires.includes(c.id))];
  return d.slice(0, Math.max(0, max));
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
 * et il pose la pierre du jour. Une seule par jour, comme partout (`noterJourTravaille`) :
 * les blocs suivants, ou la session normale rouverte quand la pile est redescendue, n'en
 * posent pas de seconde.
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
 * La journée est faite : la première pierre est posée, les six pas sont marqués, et
 * la session complète commence le lendemain, au jour `jourSuivant` du parcours. La
 * première session enseigne d'un coup les premiers jours du parcours choisi, « Lire »
 * comme « Passer le HSK » (人, 大, 天) : l'appelant donne le jour qui les suit (`jourApresDepart` de `premiere.ts`), pour
 * que rien ne soit enseigné deux fois. Par défaut, le premier jour.
 */
export function finDepart(
  p: Progress,
  jour: string,
  maintenant: Date,
  briques: readonly string[],
  jourSuivant = 1
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
    jourParcours: Math.max(n.jourParcours ?? 1, Math.floor(jourSuivant), 1)
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

/** Allume ou éteint le mode relecture (Réglages). */
export function setRelecture(p: Progress, allume: boolean): Progress {
  return { ...p, relecture: allume };
}

/** Allume ou éteint le retour haptique de l'app iOS (Réglages). */
export function setHaptique(p: Progress, allume: boolean): Progress {
  return { ...p, haptique: allume };
}

/** Allume ou éteint « Dire les tons », la question « Dis-le » (Réglages, story 9.1). */
export function setDireTons(p: Progress, allume: boolean): Progress {
  return { ...p, direTons: allume };
}

/** Choisit la voix de l'app (Réglages, « Voix ») : celle de l'appareil ou les fichiers. */
export function setVoixReference(p: Progress, voix: ChoixVoix): Progress {
  return { ...p, voixReference: voix };
}

/** Relit le réglage « Voix » d'un export : une valeur inconnue rend la voix par défaut. */
export function lireVoixReference(v: unknown): ChoixVoix | null {
  return v === 'appareil' || v === 'enregistree' ? v : null;
}

/**
 * Range la moyenne d'une syllabe analysée à « Dis-le » : la voix de l'apprenant s'apprend
 * ainsi, un nombre à la fois (`tons/voix.ts`). Le son, lui, n'est jamais gardé.
 */
export function noterVoix(p: Progress, hz: number): Progress {
  const voix = ajouterMoyenne(p.voix, hz);
  return voix.length === p.voix.length && voix.every((v, i) => v === p.voix[i]) ? p : { ...p, voix };
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
  /* Un tracé achevé est une bonne réponse d'écriture : un point de 写. */
  return { ...p, tracesAchevees: [...p.tracesAchevees, brique], arts: ajouterPoint(p.arts, 'xie') };
}

/* ---------- le personnage ---------- */

/**
 * Choisit le personnage, ou en change. Au premier choix, `rang` est celui que les points
 * donnent déjà : rien ne se fête après coup. Changer de bête ou de nom garde le rang
 * annoncé et les points : rien ne se perd. Un nom vide ne se range pas.
 */
export function choisirHeros(p: Progress, bete: BeteId, nom: string, rang: number): Progress {
  const propre = nettoyerNom(nom);
  if (propre === '') return p;
  const annonce = p.heros?.rang ?? Math.max(0, Math.floor(rang));
  return { ...p, heros: { bete, nom: propre, rang: annonce } };
}

/** Le 放榜 vu : le rang est annoncé, il ne le sera plus. Jamais en arrière. */
export function annoncerRang(p: Progress, rang: number): Progress {
  if (p.heros === null || rang <= p.heros.rang) return p;
  return { ...p, heros: { ...p.heros, rang: Math.floor(rang) } };
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
 * Note la lecture d'un conte, dans la version d'un niveau. Chaque version compte une fois ;
 * relire le même conte à un autre niveau en est une autre.
 */
export function noterConteLu(p: Progress, conte: string, seuil: Niveau): Progress {
  const s = lireNiveau(seuil);
  if (conte === '' || s === null) return p;
  const lus = p.contesLus[conte] ?? [];
  if (lus.includes(s)) return p;
  return { ...p, contesLus: { ...p.contesLus, [conte]: trierNiveaux([...lus, s]) } };
}

/**
 * Note un chapitre lu d'un récit long, dans la version d'un niveau (`n` chapitres) : il
 * rejoint les chapitres lus, et la reprise passe au suivant qui reste à lire. Le conte
 * lui-même n'est pas noté ici : `noterConteLu`, une fois tous les chapitres lus.
 */
export function noterChapitreLu(
  p: Progress,
  conte: string,
  seuil: Niveau,
  k: number,
  n: number
): Progress {
  const s = lireNiveau(seuil);
  if (conte === '' || s === null || !Number.isInteger(k) || !Number.isInteger(n) || k < 1 || k > n) return p;
  const cle = cleLecture(conte, s);
  return { ...p, chapitres: { ...p.chapitres, [cle]: lireChapitre(p.chapitres[cle], k, n) } };
}

/** Note le chapitre ouvert d'un récit long (depuis le sommaire) : on y reprendra. */
export function noterReprise(p: Progress, conte: string, seuil: Niveau, k: number): Progress {
  const s = lireNiveau(seuil);
  if (conte === '' || s === null || !Number.isInteger(k) || k < 1) return p;
  const cle = cleLecture(conte, s);
  const l = p.chapitres[cle];
  if (l?.reprise === k) return p;
  return { ...p, chapitres: { ...p.chapitres, [cle]: { lus: l?.lus ?? [], reprise: k } } };
}

/**
 * Note un plat de la cuisine de Tao réussi. Un plat compte une fois, même refait : le bol
 * compte ce qui a été lu de plus, pas les essais. Un plat grimacé ne compte pas.
 */
export function noterRecette(p: Progress, id: string): Progress {
  if (id === '' || p.recettes.includes(id)) return p;
  return { ...p, recettes: [...p.recettes, id] };
}

/** Le nombre de devinettes résolues. */
export function devinettesResolues(p: Progress): number {
  return p.devinettes.length;
}

/** Le nombre de versions de contes lues, tous niveaux comptés. */
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
  /* Un jour sans brique nouvelle, le tracé de la brique revue suit le seul réglage. */
  const trace = sansBrique(p) !== null ? p.trace : traceProposee(p, brique);
  if (p.learn === 'brique') return trace ? 'trace' : 'compose';
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
  /*
   * Un jour sans brique nouvelle, Apprendre a revu une brique acquise : aucun caractère
   * n'entre en révision qui n'y était déjà, le chemin n'avance pas, et rien n'est appris.
   */
  if (sansBrique(p) !== null) return setLearnView(faitPasCourant(p, aujourdhui), 'brique');
  let n = faitPasCourant(p, aujourdhui);
  n = assurerCartes(n, appris, maintenant);
  n = noterActivite(n, aujourdhui, 'lecon');
  /* Au rythme gratuit, la brique du jour est une des deux de la semaine : elle se note. */
  if (n.enPlus === null && journeeDuJour(n)?.rythme === 'gratuit') {
    n = { ...n, droits: noterBriqueGratuite(n.droits, aujourdhui) };
  }
  const j = Math.max(1, Math.floor(jour));
  return setLearnView({ ...n, jourAppris: j, jourParcours: j + 1 }, 'brique');
}

/* ---------- pas 4, Utiliser ---------- */

/** Ouvre une vue du pas Utiliser. La progression est sauvegardée à chaque tap. */
export function setUseView(p: Progress, vue: UseView): Progress {
  return { ...p, use: vue };
}

/**
 * Le rang de la journée, celui que le menu annonce (« 8e jour ») : les journées
 * travaillées, celle-ci comprise. C'est lui, jamais l'horloge, qui dit quel jeu le pas
 * Utiliser pose (`utiliser.ts`).
 */
export function rangDuJour(p: Progress): number {
  return p.days + (p.lastWorked === p.day ? 0 : 1);
}

/** Le jeu du pas Utiliser choisi pour la journée de la session, `null` s'il ne l'est pas encore. */
export function jeuDuJour(p: Progress): UseJeu | null {
  return p.useJeu !== null && p.useJeu.jour === p.day ? p.useJeu : null;
}

/**
 * Range le jeu choisi pour la journée : un mot, un dialogue, ou aucun (`null`). Le choix
 * se fait une fois par journée : déjà fait, il ne bouge plus, même si l'acquis change.
 */
export function poserJeuUtiliser(
  p: Progress,
  choix: { jeu: JeuUtiliser; id: string } | null
): Progress {
  if (jeuDuJour(p) !== null) return p;
  const jeu = choix === null || choix.id === '' ? null : choix.jeu;
  return {
    ...p,
    useJeu: {
      jour: p.day,
      jeu,
      id: jeu === null ? '' : (choix?.id ?? ''),
      i: 0,
      ecartees: [],
      reponse: null,
      fait: false
    }
  };
}

/**
 * La vue suivante du pas Utiliser : les mots et la phrase, puis les trois lignes à
 * lire, puis le jeu de la journée s'il y en a un et que le pas ne l'a pas encore posé.
 * `null` quand il n'y a plus de vue : le pas est fini.
 */
export function useNext(p: Progress): UseView | null {
  if (p.use === 'mots') return 'texte';
  if (p.use !== 'texte') return null;
  const j = jeuDuJour(p);
  return j !== null && j.jeu !== null && !j.fait ? j.jeu : null;
}

/**
 * Le dictionnaire éclair du pas Utiliser : le sens choisi est rangé, une fois. Les
 * événements de révision (la bonne réponse, notée par `grade` ; l'erreur, rien) et le
 * compteur « mots devinés » sont rangés par l'appelant, comme au jeu. Une activité « jeu »
 * pour Tao.
 */
export function repondreEclair(p: Progress, jour: string, reponse: string): Progress {
  const j = jeuDuJour(p);
  if (j === null || j.jeu !== 'eclair' || j.reponse !== null || reponse === '') return p;
  return noterActivite({ ...p, useJeu: { ...j, i: 1, reponse } }, jour, 'jeu');
}

/** Le message WeChat du pas Utiliser : une réplique fausse est écartée, rien n'est noté. */
export function ecarterReplique(p: Progress, zh: string): Progress {
  const j = jeuDuJour(p);
  if (j === null || j.jeu !== 'message' || zh === '' || j.ecartees.includes(zh)) return p;
  return { ...p, useJeu: { ...j, ecartees: [...j.ecartees, zh] } };
}

/**
 * Le message WeChat du pas Utiliser : la bonne réplique ouvre l'échange suivant. Après le
 * dernier des `echanges`, le dialogue est lu : il entre dans `messagesLus`, et Tao note
 * une activité « jeu ». Les caractères notés (du premier coup seulement) le sont par
 * l'appelant, comme au jeu.
 */
export function repliqueJuste(p: Progress, jour: string, echanges: number): Progress {
  const j = jeuDuJour(p);
  if (j === null || j.jeu !== 'message' || j.i >= echanges) return p;
  const i = j.i + 1;
  const n = { ...p, useJeu: { ...j, i, ecartees: [] } };
  if (i < echanges) return n;
  const lus = n.messagesLus.includes(j.id) ? n.messagesLus : [...n.messagesLus, j.id];
  return noterActivite({ ...n, messagesLus: lus }, jour, 'jeu');
}

/**
 * Fin du pas Utiliser : le pas est fait et le texte compte comme une lecture pour Tao. Le
 * jeu de la journée est fait ; aucun n'était choisi, la journée n'en pose plus.
 */
export function finUtiliser(p: Progress, aujourdhui: string): Progress {
  const posee = poserJeuUtiliser(p, null);
  const j = jeuDuJour(posee);
  const fait = j === null ? posee : { ...posee, useJeu: { ...j, fait: true } };
  const n = noterActivite(faitPasCourant(fait, aujourdhui), aujourdhui, 'lecture');
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
 * Note une réponse : l'événement de révision est rangé dans la journée, et une carte
 * « révision » est comptée pour Tao. Une réponse, une bouchée : elle fait grandir Tao et
 * se dit le soir. Pour l'humeur, seule compte l'occurrence (`tao.occurrences`) : `ouvre`,
 * la réponse ouvre une séance de révision ; sinon, elle fait partie d'une occurrence
 * comptée ailleurs, la séance déjà ouverte ou la manche de jeu, qui compte par son
 * entrée « jeu ».
 */
export function noterRevision(p: Progress, jour: string, r: Revision, ouvre = false): Progress {
  /* Une bonne réponse, un point dans son art ; une erreur ne coûte rien. La vitesse n'y est pour rien. */
  const arts = r.correct ? ajouterPoint(p.arts, r.art ?? 'du') : p.arts;
  return { ...p, revisions: [...p.revisions, r], tao: ajouter(p.tao, jour, 'revision', !ouvre), arts };
}

/**
 * Une réponse du pas Échauffer, ou de la révision en plus, à la question `i` : notée,
 * et la question ne se repose plus. La première réponse notée de la séance l'ouvre :
 * une séance, une révision pour l'humeur de Tao, quel que soit le nombre de cartes.
 */
export function repondreEchauffer(p: Progress, jour: string, r: Revision, i: number): Progress {
  return setRevNotee(noterRevision(p, jour, r, p.revNotee < 0), i);
}

/** Une réponse du pas Fixer, à la question `i` : comme au pas Échauffer, une séance. */
export function repondreFixer(p: Progress, jour: string, r: Revision, i: number): Progress {
  return setFixNotee(noterRevision(p, jour, r, p.fixNotee < 0), i);
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
    { id: 'clore', t: 'Clore', d: 'Le constat et la pierre du jour', m: m[5], go: 'close' }
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
      if (s.id === 'clore') return { ...s, d: 'Le constat, sans seconde pierre' };
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
  if (allDone(p)) return `${budget} La pierre du jour est posée. Rendez-vous demain.`;
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

/** Relit le jeu du pas Utiliser. Absent ou aberrant : aucun, il se choisira de nouveau. */
function lireUseJeu(v: unknown): UseJeu | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.jour !== 'string' || !FORMAT_JOUR.test(o.jour)) return null;
  const jeu = o.jeu === 'eclair' || o.jeu === 'message' ? o.jeu : null;
  const id = typeof o.id === 'string' ? o.id : '';
  if (jeu !== null && id === '') return null;
  return {
    jour: o.jour,
    jeu,
    id: jeu === null ? '' : id,
    i: typeof o.i === 'number' && o.i >= 0 ? Math.floor(o.i) : 0,
    ecartees: jeu === 'message' ? listeDeCaracteres(o.ecartees) : [],
    reponse:
      jeu === 'eclair' && typeof o.reponse === 'string' && o.reponse !== '' ? o.reponse : null,
    fait: o.fait === true
  };
}

/**
 * La vue du pas Utiliser relue avec son jeu : une vue de jeu sans le jeu de la journée
 * qui la porte (export tronqué, autre journée) retombe sur le texte.
 */
function lireUse(o: Record<string, unknown>, jeu: UseJeu | null): UseView {
  if (!isUseView(o.use)) return 'mots';
  if (o.use !== 'eclair' && o.use !== 'message') return o.use;
  return jeu !== null && jeu.jeu === o.use && jeu.jour === o.day ? o.use : 'texte';
}

function isEtapeDepart(v: unknown): v is EtapeDepart {
  return ETAPES_DEPART.includes(v as EtapeDepart);
}

function isParcours(v: unknown): v is Parcours {
  return v === 'lire' || v === 'hsk' || v === 'voyage';
}

/** Relit la journée préparée. Absente ou aberrante : aucune, elle se prépare de nouveau. */
function lireJournee(v: unknown): Journee | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.jour !== 'string' || !FORMAT_JOUR.test(o.jour)) return null;
  if (o.rythme !== 'complet' && o.rythme !== 'trente' && o.rythme !== 'gratuit') return null;
  let sb: SansBrique | null = null;
  if (typeof o.sansBrique === 'object' && o.sansBrique !== null) {
    const x = o.sansBrique as Record<string, unknown>;
    if (x.raison !== 'rythme' && x.raison !== 'examen') return null;
    if (typeof x.c !== 'string' || typeof x.lecon !== 'number' || x.lecon < 1) return null;
    sb = { raison: x.raison, c: x.c, lecon: Math.floor(x.lecon) };
  }
  return { jour: o.jour, rythme: o.rythme, sansBrique: sb };
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
    if (r.auMieuxBien === true) lue.auMieuxBien = true;
    const art = lireArt(r.art);
    if (art !== undefined) lue.art = art;
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
  return lireJournees(v);
}

/**
 * Relit un registre `{clé: journée}` (trophées, fêtes et anecdotes vues) : une clé non
 * vide, une journée AAAA-MM-JJ. Une entrée aberrante est écartée ; absent ou illisible :
 * vide.
 */
function lireJournees(v: unknown): Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [cle, jour] of Object.entries(v as Record<string, unknown>)) {
    if (cle !== '' && typeof jour === 'string' && FORMAT_JOUR.test(jour)) out[cle] = jour;
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

function lireContesLus(v: unknown): Record<string, Niveau[]> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, Niveau[]> = {};
  for (const [conte, seuils] of Object.entries(v as Record<string, unknown>)) {
    if (conte === '' || !Array.isArray(seuils)) continue;
    /* Un seuil noté en nombre, avant les niveaux HSK, se relit en chaîne : 255 → « 255 ». */
    const lus = lireNiveaux(seuils);
    if (lus.length > 0) out[conte] = lus;
  }
  return out;
}

/** Relit les récits longs en cours. Absents ou aberrants : aucun. */
function lireLecturesChapitres(v: unknown): Record<string, LectureChapitres> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, LectureChapitres> = {};
  for (const [cle, x] of Object.entries(v as Record<string, unknown>)) {
    const niveau = cle.slice(0, Math.max(0, cle.indexOf('/')));
    if (lireNiveau(niveau) !== niveau || cle.length <= niveau.length + 1) continue;
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    const lus = Array.isArray(o.lus)
      ? [...new Set(o.lus.filter((k): k is number => Number.isInteger(k) && (k as number) >= 1))].sort(
          (a, b) => a - b
        )
      : [];
    const reprise = Number.isInteger(o.reprise) && (o.reprise as number) >= 1 ? (o.reprise as number) : 1;
    out[cle] = { lus, reprise };
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
  const cartes = lireCartesJSON(o.cartes);
  const tracesAchevees = listeDeCaracteres(o.tracesAchevees);
  const useJeu = lireUseJeu(o.useJeu);
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
    tracesAchevees,
    /* Champs des pas Utiliser et Fixer : absents d'un export plus ancien, ils reprennent leur défaut. */
    use: lireUse(o, useJeu),
    /* Le jeu du pas Utiliser et les dialogues lus : absents d'un export plus ancien, aucun. */
    useJeu,
    messagesLus: listeDeCaracteres(o.messagesLus),
    fix: typeof o.fix === 'number' && o.fix >= 0 ? Math.floor(o.fix) : 0,
    fixNotee: lireNotee(o.fixNotee),
    /* Cartes et pile d'échauffement : absentes d'un export plus ancien, elles se relisent vides. */
    cartes,
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
    contesLus: lireContesLus(o.contesLus),
    /* Les récits longs en cours : absents d'un export plus ancien, aucun. */
    chapitres: lireLecturesChapitres(o.chapitres),
    /* Le mode relecture : absent d'un export plus ancien, éteint. */
    relecture: o.relecture === true,
    /* Le retour haptique : absent d'un export plus ancien, allumé. */
    haptique: o.haptique !== false,
    /* Le rappel quotidien : absent d'un export plus ancien, éteint. */
    rappel: lireRappel(o.rappel),
    /* « Dire les tons » : absent d'un export plus ancien, allumé. */
    direTons: o.direTons !== false,
    /* La voix de l'app : absente d'un export plus ancien, la voix par défaut. */
    voixReference: lireVoixReference(o.voixReference),
    /* La voix de « Dis-le » : absente d'un export plus ancien, aucune. */
    voix: lireVoix(o.voix),
    /* Le dernier export : absent d'un export plus ancien, jamais. */
    dernierExport: lireDernierExport(o.dernierExport),
    /* La dernière demande de note : absente d'un export plus ancien, aucune. */
    avisDemande: lireAvisDemande(o.avisDemande),
    /* Les mots devinés : absents d'un export plus ancien, aucun n'est deviné. */
    motsDevines: listeDeCaracteres(o.motsDevines),
    /* Les caractères trouvés en chemin : absents d'un export plus ancien, aucun. */
    trouves: lireTrouves(o.trouves),
    /* Les fêtes dont l'anecdote a été montrée : absentes d'un export plus ancien, aucune. */
    fetesVues: lireJournees(o.fetesVues),
    /* Les anecdotes montrées : absentes d'un export plus ancien, aucune. */
    anecdotesVues: lireJournees(o.anecdotesVues),
    /* Les plats cuisinés : absents d'un export plus ancien, aucun n'est fait. */
    recettes: listeDeCaracteres(o.recettes),
    /* Les lettres de Que : absentes d'un export plus ancien, aucune n'est arrivée. */
    lettres: lireLettresNotees(o.lettres),
    /* Le personnage : absent d'un export plus ancien, il se choisira. */
    heros: lireHeros(o.heros),
    /* Les points : absents d'un export plus ancien, ils se recalculent de ce qu'il garde. */
    arts: lireArts(o.arts) ?? pointsDerives(cartes, tracesAchevees),
    /* Les examens : absents d'un export plus ancien, rien de réussi, rangs à reporter. */
    examens: lireEtatExamens(o.examens),
    /* Les droits : absents d'un export plus ancien, rien de reçu, rien de noté. */
    droits: lireDroits(o.droits),
    /* La journée préparée : absente d'un export plus ancien, elle se prépare à l'ouverture. */
    journee: lireJournee(o.journee),
    /* L'aventure : absente d'un export plus ancien, ce qu'il a atteint s'ouvrira en silence. */
    ouvertures: lireEtatOuvertures(o.ouvertures)
  };
}
