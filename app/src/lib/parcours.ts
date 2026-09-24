/**
 * Le parcours d'une journée : le logo, l'anecdote, le menu, puis les pas enchaînés
 * jusqu'à Clore, et retour au menu. Tout part du menu et tout y revient.
 *
 * Module pur, comme `session.ts` : aucune fonction ne lit l'horloge, n'écrit dans un
 * stockage ni ne lit le contenu. Ce que le menu montre et ce que chaque bouton ouvre se
 * décide ici ; les composants ne font qu'afficher. Les libellés sont des microtextes
 * d'interface, comme ceux des six pas : aucun contenu (caractère, sens, pinyin) n'est
 * écrit ici, il arrive en argument.
 */
import {
  CARTES_PAR_SEANCE,
  allDone,
  cartesAOuvrir,
  commencerPlus,
  currentStep,
  jourLecon,
  markDone,
  nextIndex,
  noterActivite,
  peutPlus,
  steps,
  type Progress,
  type Step,
  type StepId
} from './session';
import { humeur, type Humeur } from './tao';

/* ---------- les écrans ---------- */

/** Les écrans des pas, tels que `Step.go` les nomme. */
export type EcranPas = 'anec' | 'rev' | 'learn' | 'use' | 'check' | 'close';

/** Où mène un bouton du parcours : un pas, la première session, ou le menu. */
export type Destination = EcranPas | 'premiere' | 'menu';

const ECRANS_PAS: readonly string[] = ['anec', 'rev', 'learn', 'use', 'check', 'close'];

/** L'écran d'un pas. Un pas verrouillé n'en a pas : on reste au menu. */
export function ecranDe(s: Step | null): EcranPas | 'menu' {
  return s !== null && s.go !== null && ECRANS_PAS.includes(s.go) ? (s.go as EcranPas) : 'menu';
}

/* ---------- l'ouverture ---------- */

/** L'anecdote du jour a-t-elle été vue, ou passée ? Le journal de Tao le dit. */
export function anecdoteVue(p: Progress): boolean {
  return p.tao.activites.some((a) => a.jour === p.day && a.type === 'anecdote');
}

/**
 * Après le logo : la première session au tout premier lancement ; sinon l'anecdote du
 * jour, une fois, puis le menu. L'anecdote est le pas 1, Ouvrir. En rattrapage elle
 * s'ouvre aussi, sans compter pour un bloc.
 */
export function apresSplash(p: Progress): 'premiere' | 'anec' | 'menu' {
  if (p.premiere) return 'premiere';
  if (anecdoteVue(p)) return 'menu';
  return p.catchup || currentStep(p)?.id === 'ouvrir' ? 'anec' : 'menu';
}

/**
 * L'anecdote quittée, lue ou passée : le pas Ouvrir est fait s'il est le pas courant,
 * et l'anecdote entre une fois dans le journal de Tao.
 */
export function anecdoteFaite(p: Progress, jour: string): Progress {
  let n = p;
  if (currentStep(n)?.id === 'ouvrir') n = markDone(n, nextIndex(n), jour);
  return anecdoteVue(n) ? n : noterActivite(n, jour, 'anecdote');
}

/** D'où l'on rouvre l'anecdote du jour, et où « Continuer » et « Quitter » ramènent. */
export type RetourAnecdote = 'lire' | 'menu';

/**
 * L'anecdote rouverte depuis Lire ou l'en-tête du menu, puis refermée. Déjà vue, elle est
 * relue : rien ne bouge, ni le pas Ouvrir, ni le journal de Tao, ni les trouvés.
 * Pas encore vue (la journée a basculé le menu ouvert), c'est la lecture du jour, comptée
 * une fois comme à l'ouverture. La première session passe avant tout : rien n'y compte.
 */
export function anecdoteRelue(p: Progress, jour: string): Progress {
  return anecdoteVue(p) || p.premiere ? p : anecdoteFaite(p, jour);
}

/* ---------- l'enchaînement des pas ---------- */

/**
 * Où mène la fin d'un pas : droit au pas suivant, sans repasser par le menu. Le menu
 * après Clore, la seule fin ; et après un bloc de rattrapage, car le menu annonce les
 * blocs un à un. `depuisRattrapage` est l'état d'avant la fin du bloc : la pile qui
 * redescend referme le rattrapage, et la journée normale ne s'ouvre pas pour autant.
 */
export function ecranSuivant(p: Progress, depuisRattrapage: boolean = p.catchup): Destination {
  if (depuisRattrapage || p.catchup) return 'menu';
  return ecranDe(currentStep(p));
}

/**
 * Le bouton plein du menu : la première session tant qu'elle n'est pas faite, la
 * session du jour au pas exact, la session de plus une fois la journée faite. L'anecdote
 * déjà vue compte pour le pas Ouvrir. `libre` : le rattrapage du jour est fait, le bouton
 * ouvre une révision en plus, jamais une brique nouvelle.
 */
export function demarrer(p: Progress, jour: string): { p: Progress; ecran: Destination | 'libre' } {
  if (p.premiere) return { p, ecran: 'premiere' };
  let n = p;
  if (peutPlus(n)) n = commencerPlus(n);
  else if (allDone(n)) return { p, ecran: 'libre' };
  if (currentStep(n)?.id === 'ouvrir' && anecdoteVue(n)) n = markDone(n, nextIndex(n), jour);
  return { p: n, ecran: ecranDe(currentStep(n)) };
}

/* ---------- la case Réviser ---------- */

/**
 * Avant la session, la case Réviser mène au pas Échauffer : la pile ne se vide jamais
 * en douce hors de la session. Après, elle ouvre une révision en plus. En rattrapage,
 * elle ouvre le bloc annoncé, comme le bouton plein.
 */
export type CaseReviser = { info: string; action: 'echauffer' | 'bloc' | 'libre' };

function cartes(n: number): string {
  return n > 1 ? `${n} cartes dues` : `${n} carte due`;
}

export function caseReviser(p: Progress): CaseReviser {
  if (p.catchup && !allDone(p)) return { info: cartes(p.due), action: 'bloc' };
  if (!p.premiere && !p.catchup) {
    const i = steps(p).findIndex((s) => s.id === 'echauffer');
    if (i >= 0 && !p.done[i]) return { info: 'Dans la session', action: 'echauffer' };
  }
  return { info: p.due > 0 ? cartes(p.due) : 'À jour, rien de dû', action: 'libre' };
}

/** Ouvre la session au pas Échauffer : l'anecdote, déjà vue à l'ouverture, est faite. */
export function versEchauffer(p: Progress, jour: string): Progress {
  const s = currentStep(p);
  return s !== null && s.id === 'ouvrir' ? markDone(p, nextIndex(p), jour) : p;
}

/** Une révision en plus finie ou quittée : la pile de la séance se vide, aucun pas ne bouge. */
export function finRevisionLibre(p: Progress): Progress {
  return { ...p, revue: [], rev: 0, revNotee: -1 };
}

/* ---------- le menu ---------- */

/** Où en est la journée, vue du menu. */
export type EtatMenu = 'premiere' | 'nouvelle' | 'entamee' | 'faite' | 'plus' | 'rattrapage';

/**
 * La session est entamée au-delà de l'ouverture : un pas fait, ou une question déjà
 * notée au pas Échauffer (ou dans le bloc). L'anecdote vue n'entame rien.
 */
export function entamee(p: Progress): boolean {
  const l = steps(p);
  return p.revNotee >= 0 || l.some((s, i) => p.done[i] === true && s.id !== 'ouvrir');
}

export function etatMenu(p: Progress): EtatMenu {
  if (p.premiere) return 'premiere';
  if (p.catchup) return 'rattrapage';
  if (p.enPlus !== null) return 'plus';
  if (allDone(p)) return 'faite';
  return entamee(p) ? 'entamee' : 'nouvelle';
}

/** Un coup de pinceau de la barre : fait (jade), en cours (encre), à venir (filet). */
export type Coup = 'fait' | 'encours' | 'avenir';

/**
 * Les coups de pinceau de la barre, un par pas ouvrable. C'est la même barre sur le
 * menu et en tête de chaque pas. En rattrapage, un coup par bloc.
 */
export function coups(p: Progress): Coup[] {
  if (p.premiere) return steps(p).map(() => 'avenir');
  const n = nextIndex(p);
  return steps(p)
    .filter((s) => s.go !== null)
    .map((_, i) => (p.done[i] === true ? 'fait' : i === n ? 'encours' : 'avenir'));
}

/** Le caractère de la carte du jour : d'où il vient. Le contenu, lui, vient de l'export. */
export type CarteMenu =
  | { source: 'premiere' }
  | { source: 'lecon'; jour: number }
  | { source: 'revision' };

/**
 * La leçon du jour avant et pendant la session ; celle apprise, la journée faite ; la
 * suivante quand rien n'a encore été appris aujourd'hui (le premier jour). En rattrapage,
 * aucune brique nouvelle : la carte montre la plus urgente des cartes dues.
 */
export function carteDuMenu(p: Progress): CarteMenu {
  if (p.premiere) return { source: 'premiere' };
  if (p.catchup) return { source: 'revision' };
  return { source: 'lecon', jour: jourLecon(p) };
}

/** Ce que Tao dit du pas où l'on reprend. */
const VERBES: Partial<Record<StepId, string>> = {
  echauffer: "on s'échauffe",
  apprendre: 'on apprend',
  utiliser: 'on lit',
  fixer: 'on vérifie',
  clore: 'on plante la graine'
};

/**
 * Ce que dit Tao sur le chemin : jamais un reproche, toujours une invitation. Un tap
 * sur elle, la phrase suivante. Son humeur vient des activités, jamais de l'horloge.
 */
export function phrasesDeTao(p: Progress, caractere = ''): string[] {
  const n = nextIndex(p);
  const s = n < 0 ? null : steps(p)[n];
  const apprendre = caractere === '' ? '' : `${caractere}, on l'apprend ?`;
  let l: string[];
  switch (etatMenu(p)) {
    case 'premiere':
      l = ['On reprend la première session ?', 'Trois briques, un mot lu.'];
      break;
    case 'rattrapage':
      if (allDone(p)) l = ['La pile a bien baissé.', 'On a bien mangé.'];
      else if (entamee(p)) l = ['Encore un bloc, miam.', 'On continue doucement.'];
      else l = ['Te revoilà !', 'On y va doucement ?', `${p.due} cartes, par petits bouts.`];
      break;
    case 'plus':
      l = ['Encore une brique ? Miam.', apprendre];
      break;
    case 'faite':
      l =
        p.plus > 0
          ? ['Quelle journée !', 'Encore une brique ?', 'À demain, sur le chemin.']
          : ['Graine plantée !', 'On joue un peu ?', 'À demain, sur le chemin.'];
      break;
    case 'entamee':
      l = ['On reprend ici !', s ? `Pas ${n + 1}, ${VERBES[s.id] ?? 'on continue'} !` : ''];
      break;
    default:
      l = [
        p.due > 0 ? `${Math.min(p.due, CARTES_PAR_SEANCE)} cartes à croquer !` : '',
        'On y va ?',
        apprendre
      ];
  }
  return l.filter((x) => x !== '');
}

/** Tout ce que le menu affiche, décidé ici. */
export type ModeleMenu = {
  etat: EtatMenu;
  /** Au-dessus du pinyin : « Aujourd'hui », « Appris aujourd'hui », « Le retour »… */
  surtitre: string;
  /** Sous la décomposition : ce qu'est le caractère montré. */
  brique: string;
  coups: Coup[];
  /** Le coup où marche Tao. */
  position: number;
  /** Sous les coups : « Pas 2 sur 6 · Échauffer », « Bloc 1 · 14 cartes »… */
  ligne: string;
  /** La durée du pas ou du bloc, vide la journée faite. */
  duree: string;
  bouton: string;
  /** Le bouton plein, ou en contour pour la session de plus et ce qui vient après. */
  plein: boolean;
  tao: { posture: 'chemin' | 'pot'; humeur: Humeur };
  phrases: string[];
};

function sessionsDePlus(n: number): string {
  return `${n} session${n > 1 ? 's' : ''} de plus`;
}

export function menu(p: Progress, caractere = ''): ModeleMenu {
  const etat = etatMenu(p);
  const l = steps(p).filter((s) => s.go !== null);
  const n = nextIndex(p);
  const s = n < 0 ? null : steps(p)[n];
  const c = coups(p);
  const base = {
    etat,
    coups: c,
    position: n < 0 ? Math.max(0, c.length - 1) : n,
    duree: s?.m ?? '',
    tao: {
      posture: (etat === 'rattrapage' && !entamee(p) ? 'pot' : 'chemin') as 'chemin' | 'pot',
      humeur: (etat === 'faite' ? 'joie' : humeur(p.tao.activites, p.day)) as Humeur
    },
    phrases: phrasesDeTao(p, caractere)
  };
  const pas = s ? `Pas ${n + 1} sur ${l.length} · ${s.t}` : '';
  switch (etat) {
    case 'premiere':
      return {
        ...base,
        position: 0,
        surtitre: 'Pour commencer',
        brique: 'la première brique',
        ligne: 'La première session · trois briques, un mot',
        duree: '4 min',
        bouton: 'Reprendre la première session',
        plein: true
      };
    case 'rattrapage':
      if (s === null) {
        return {
          ...base,
          surtitre: 'Le retour',
          brique: 'à revoir',
          ligne: 'Les blocs du jour sont faits',
          bouton: 'Réviser encore',
          plein: false
        };
      }
      return {
        ...base,
        surtitre: 'Le retour',
        brique: 'à revoir d’abord',
        ligne: `Bloc ${n + 1} · ${cartesAOuvrir(p)} cartes`,
        bouton:
          p.revNotee >= 0
            ? `Reprendre le bloc ${n + 1}`
            : n === 0
              ? 'Commencer le premier bloc'
              : `Commencer le bloc ${n + 1}`,
        plein: true
      };
    case 'plus':
      return {
        ...base,
        surtitre: 'Session de plus',
        brique: 'la brique nouvelle',
        ligne: pas,
        bouton: entamee(p) ? `Reprendre au pas ${n + 1}` : 'Commencer la session de plus',
        plein: true
      };
    case 'faite': {
      const appris = p.jourAppris !== undefined;
      return {
        ...base,
        surtitre: appris ? 'Appris aujourd’hui' : 'La prochaine brique',
        brique: appris ? 'la brique du jour' : 'la brique suivante',
        ligne: p.plus > 0 ? `Graine plantée · ${sessionsDePlus(p.plus)}` : 'Graine plantée, une seule par jour',
        duree: '',
        bouton: 'Une session de plus · une brique',
        plein: false
      };
    }
    case 'entamee':
      return {
        ...base,
        surtitre: 'Aujourd’hui',
        brique: 'la brique nouvelle',
        ligne: pas,
        bouton: `Reprendre au pas ${n + 1}`,
        plein: true
      };
    default:
      return {
        ...base,
        surtitre: 'Aujourd’hui',
        brique: 'la brique nouvelle',
        ligne: pas,
        bouton: 'Commencer la session',
        plein: true
      };
  }
}

/* ---------- l'élément ajouté, trait par trait ---------- */

/** Écrits après ce qu'ils portent, où qu'ils soient dans la décomposition : 这, 建. */
const ECRITS_EN_DERNIER = ['辶', '廴'];

/** Enceintes qui se ferment après l'intérieur : leur dernier trait passe à la fin (国, 区). */
const FERMETURES = ['囗', '匚', '匸'];

/**
 * Briques dont un trait vient après ce qu'elles couvrent (le point de 弋 dans 式, la
 * jambe de 走 dans 起) : placées avant la dernière, l'ordre des traits n'est pas sûr.
 */
const INCERTAINES = ['弋', '戈', '走', '⻌', '气', '凵'];

/**
 * Les traits de l'élément ajouté dans le grand caractère : les seuls que le cinabre
 * peint. Les données de traits ne disent pas quelle brique porte quel trait ; on les
 * retrouve par l'ordre d'écriture, les briques l'une après l'autre, avec les deux
 * exceptions sûres (辶 et 廴 en dernier, l'enceinte fermée à la fin). Quand le compte ne
 * tombe pas juste ou que l'ordre n'est pas sûr, aucun trait : mieux vaut pas de cinabre
 * qu'un cinabre sur le mauvais élément.
 */
export function traitsDeLAjout(
  parts: readonly string[],
  nouveau: readonly number[],
  comptes: readonly (number | null)[],
  total: number
): number[] {
  if (parts.length < 2 || parts.length > 3 || nouveau.length === 0) return [];
  if (comptes.length !== parts.length || comptes.some((k) => k === null || k < 1)) return [];
  const k = comptes as readonly number[];
  if (k.reduce((a, b) => a + b, 0) !== total) return [];
  const dernier = parts.length - 1;
  if (parts.some((c, i) => i < dernier && INCERTAINES.includes(c))) return [];
  /* L'ordre d'écriture : pour chaque trait du caractère, la brique qui le porte. */
  const tete: number[] = [];
  const fin: number[] = [];
  parts.forEach((c, i) => {
    if (ECRITS_EN_DERNIER.includes(c)) {
      for (let t = 0; t < k[i]; t++) fin.push(i);
    } else if (FERMETURES.includes(c) && i < dernier) {
      for (let t = 0; t < k[i] - 1; t++) tete.push(i);
      fin.unshift(i);
    } else {
      for (let t = 0; t < k[i]; t++) tete.push(i);
    }
  });
  const ordre = [...tete, ...fin];
  return ordre.flatMap((brique, trait) => (nouveau.includes(brique) ? [trait] : []));
}
