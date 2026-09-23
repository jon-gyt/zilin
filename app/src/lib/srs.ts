/**
 * Notation automatique et planification FSRS. Pas d'auto-évaluation.
 * Tout est pur : aucune base, aucun effet de bord, l'instant est toujours passé en paramètre.
 */
import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRSParameters,
  type Grade
} from 'ts-fsrs';

export type Outcome = { correct: boolean; tries: number; seconds: number };

/** Une ligne d'historique : quand, quelle note, pour quelle échéance. Rien de plus. */
export type ReviewLogEntry = { at: Date; rating: Grade; due: Date };

/** Carte de révision d'un caractère ou d'une brique. `id` est l'identifiant du contenu. */
export type ReviewCard = { id: string; card: Card; history: ReviewLogEntry[] };

export type SrsParams = {
  /** Rétention cible passée à FSRS. Plus elle est haute, plus les intervalles sont courts. */
  retention?: number;
  /** Plafond d'intervalle, en jours. */
  maximumInterval?: number;
  /** Délai de retour après une réponse montrée, en minutes. */
  relearnMinutes?: number;
};

export const RETENTION_DEFAUT = 0.9;
/**
 * Bornes de la rétention cible réglable (brief §7). Sous 0,8 on oublie trop pour que la
 * correction par les briques suffise ; au-delà de 0,97 les révisions se multiplient
 * pour presque rien.
 */
export const RETENTION_MIN = 0.8;
export const RETENTION_MAX = 0.97;

/** Une rétention cible lisible : un nombre ramené dans les bornes, le défaut sinon. */
export function bornerRetention(r: unknown): number {
  if (typeof r !== 'number' || !Number.isFinite(r)) return RETENTION_DEFAUT;
  return Math.min(RETENTION_MAX, Math.max(RETENTION_MIN, r));
}
/** Faux deux fois : la réponse est montrée, retour dans 10 minutes. */
export const RETOUR_MINUTES = 10;
/** Stabilité minimale d'une brique pour qu'un caractère se débloque, en jours. */
export const SEUIL_DEBLOCAGE = 7;
/** On ne garde que les dernières révisions : l'export reste petit. */
export const HISTORIQUE_MAX = 20;

const MINUTE = 60_000;

/** juste du premier coup en < 6 s : Facile ; juste : Bien ; juste après erreur : Dur ; faux : Oublié. */
export function grade(o: Outcome): Grade {
  if (!o.correct) return Rating.Again;
  if (o.tries > 0) return Rating.Hard;
  return o.seconds < 6 ? Rating.Easy : Rating.Good;
}

/**
 * Paramètres FSRS de Zilin.
 * `enable_short_term` est désactivé : les paliers en minutes de FSRS remplaceraient les
 * intervalles en jours du brief. Le retour à 10 minutes après une réponse montrée est la
 * seule exception, et c'est nous qui l'appliquons.
 */
export function fsrsParams(params: SrsParams = {}): FSRSParameters {
  return generatorParameters({
    request_retention: params.retention ?? RETENTION_DEFAUT,
    maximum_interval: params.maximumInterval ?? 36500,
    enable_short_term: false,
    enable_fuzz: false
  });
}

/** Carte neuve, jamais révisée, due tout de suite. */
export function newCard(id: string, now: Date): ReviewCard {
  return { id, card: createEmptyCard(now), history: [] };
}

/** Stabilité FSRS de la carte, en jours. Zéro tant qu'elle n'a pas été révisée. */
export function stability(card: ReviewCard): number {
  return card.card.stability;
}

/** La carte n'a encore jamais été notée. */
export function isNew(card: ReviewCard): boolean {
  return card.card.state === State.New;
}

/**
 * Note la réponse puis planifie la carte. Retourne la nouvelle carte et son échéance.
 * Règle produit : sur un échec, l'échéance est `now + relearnMinutes`, quoi que dise FSRS.
 */
export function schedule(
  card: ReviewCard,
  outcome: Outcome,
  now: Date,
  params: SrsParams = {}
): { card: ReviewCard; due: Date } {
  const rating = grade(outcome);
  const { card: planifiee } = fsrs(fsrsParams(params)).next(card.card, now, rating);
  const retour = new Date(now.getTime() + (params.relearnMinutes ?? RETOUR_MINUTES) * MINUTE);
  const suivante: Card =
    rating === Rating.Again ? { ...planifiee, due: retour, scheduled_days: 0 } : planifiee;
  const history = [...card.history, { at: now, rating, due: suivante.due }].slice(-HISTORIQUE_MAX);
  return { card: { id: card.id, card: suivante, history }, due: suivante.due };
}

/**
 * Les cartes à réviser maintenant, les plus urgentes d'abord :
 * la plus en retard passe devant, et à échéance égale la plus fragile.
 */
export function due(cards: readonly ReviewCard[], now: Date): ReviewCard[] {
  return cards
    .filter((c) => c.card.due.getTime() <= now.getTime())
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime() || stability(a) - stability(b));
}

/**
 * Un caractère entre en révision quand toutes ses briques sont stables.
 * Accepte les cartes des briques ou directement leurs stabilités.
 */
export function unlockable(
  briques: readonly (ReviewCard | number)[],
  seuil = SEUIL_DEBLOCAGE
): boolean {
  return (
    briques.length > 0 && briques.every((b) => (typeof b === 'number' ? b : stability(b)) >= seuil)
  );
}

type CardJSON = Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };
type ReviewCardJSON = {
  id: string;
  card: CardJSON;
  history: { at: string; rating: Grade; due: string }[];
};
export type SrsExport = { version: 1; cards: ReviewCardJSON[] };

/** Export : dates en ISO, prêt pour le fichier JSON de sauvegarde. */
export function toJSON(cards: readonly ReviewCard[]): string {
  const payload: SrsExport = {
    version: 1,
    cards: cards.map(({ id, card, history }) => ({
      id,
      card: {
        ...card,
        due: card.due.toISOString(),
        last_review: card.last_review?.toISOString()
      },
      history: history.map((h) => ({
        at: h.at.toISOString(),
        rating: h.rating,
        due: h.due.toISOString()
      }))
    }))
  };
  return JSON.stringify(payload);
}

/** Import : l'inverse exact de `toJSON`. Lève si le format est inconnu. */
export function fromJSON(text: string): ReviewCard[] {
  const parsed = JSON.parse(text) as SrsExport;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.cards)) {
    throw new Error('Export SRS illisible');
  }
  return parsed.cards.map(({ id, card, history }) => ({
    id,
    card: {
      ...card,
      due: new Date(card.due),
      last_review: card.last_review ? new Date(card.last_review) : undefined
    },
    history: history.map((h) => ({ at: new Date(h.at), rating: h.rating, due: new Date(h.due) }))
  }));
}
