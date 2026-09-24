/**
 * La série : une graine par jour travaillé, sept graines font un arbre.
 *
 * Le jour de repos protège la série. Il se gagne (une semaine complète de sept jours
 * travaillés en donne un, deux en réserve au plus) et se consomme tout seul pour couvrir
 * une journée sautée. C'est une protection, jamais une punition : rien ici ne compte les
 * jours manqués, aucun libellé ne parle de perte, et quand la réserve est vide la série
 * repart simplement de zéro, sans commentaire.
 *
 * Module pur, comme `session.ts` et `tao.ts` : aucune fonction ne lit l'horloge ni
 * n'écrit dans un stockage. La journée courante est toujours passée en argument
 * (`aujourdhui`, au format AAAA-MM-JJ).
 */
import { joursEntre } from './session';

/* ---------- les constantes du brief ---------- */

/** Sept graines font un arbre. C'est aussi la semaine complète qui donne un jour de repos. */
export const GRAINES_PAR_ARBRE = 7;

/** Deux jours de repos en réserve au plus. Ce qui est gagné au-delà ne s'accumule pas. */
export const RESERVE_MAX = 2;

/** Les quatre paliers du brief, dans l'ordre. */
export const PALIERS = [7, 30, 100, 365] as const;

export type Palier = (typeof PALIERS)[number];

/** Ce que Que remet au palier. Rien d'autre que le brief : aucun cadeau inventé. */
export type Cadeau = {
  /** La forme courte, dans une phrase : « Que t'attend au 7e jour avec … ». */
  court: string;
  /** Le titre de la ligne, dans l'écran Récompenses. */
  titre: string;
  /** Ce que le cadeau ouvre, en une phrase. */
  detail: string;
  /** Vrai pour la seule remise du brief : moins 30 % sur l'achat à vie, code à usage unique. */
  remise: boolean;
};

export const CADEAUX: Record<Palier, Cadeau> = {
  7: {
    court: 'un jour de Wenlu complet',
    titre: 'Un jour de Wenlu complet',
    detail: '24 heures avec tout Wenlu ouvert.',
    remise: false
  },
  30: {
    court: 'une semaine de Wenlu complet',
    titre: 'Une semaine de Wenlu complet',
    detail: 'Sept jours avec tout Wenlu ouvert.',
    remise: false
  },
  100: {
    court: 'moins 30 % sur l’achat à vie',
    titre: 'Wenlu complet à vie, moins 30 %',
    detail: 'Un code à usage unique sur l’achat à vie.',
    remise: true
  },
  365: {
    court: 'Wenlu complet offert',
    titre: 'Wenlu complet à vie, offert',
    detail: 'Un an sans manquer. La forêt est à toi.',
    remise: false
  }
};

/** La seule réserve du brief sur la remise, écrite là où elle se lit. */
export const NOTE_REMISE = 'La remise ne vaut pas pour l’abonnement mensuel.';

/** Les deux façons d'acheter Wenlu. La remise du 100e jour ne vaut que pour l'achat à vie. */
export type Achat = 'vie' | 'mensuel';

/** Pas de remise sur l'abonnement mensuel : la règle est ici, pas dans un écran. */
export function remiseApplicable(palier: Palier, achat: Achat): boolean {
  return CADEAUX[palier].remise && achat === 'vie';
}

/* ---------- les dates ---------- */

const MS_JOUR = 86400000;
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function horodatage(jour: string): number {
  return Date.parse(`${jour}T00:00:00Z`);
}

/** Une journée civile décalée de `n` jours, au format AAAA-MM-JJ. */
export function ajouteJours(jour: string, n: number): string {
  return new Date(horodatage(jour) + n * MS_JOUR).toISOString().slice(0, 10);
}

/** Le rang du jour dans la semaine : 0 lundi, 6 dimanche. La semaine va du lundi au dimanche. */
export function rangDansLaSemaine(jour: string): number {
  return (new Date(horodatage(jour)).getUTCDay() + 6) % 7;
}

/** Les initiales de la semaine, lundi à dimanche, comme dans la maquette. */
export const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/** Le lundi de la semaine d'une journée. */
export function lundi(jour: string): string {
  return ajouteJours(jour, -rangDansLaSemaine(jour));
}

/** Les sept journées de la semaine d'une journée, du lundi au dimanche. */
export function semaine(jour: string): string[] {
  const l = lundi(jour);
  return LETTRES.map((_, i) => ajouteJours(l, i));
}

/** Trie, dédoublonne et écarte ce qui n'est pas une journée civile. */
export function normaliser(jours: readonly string[]): string[] {
  const vus = new Set<string>();
  for (const j of jours) {
    if (typeof j === 'string' && FORMAT_JOUR.test(j) && !Number.isNaN(horodatage(j))) vus.add(j);
  }
  return [...vus].sort();
}

/* ---------- l'état de la série ---------- */

/** Une case de la semaine : une graine plantée, ou la place qu'elle aura. */
export type Graine = {
  jour: string;
  /** L'initiale du jour : L M M J V S D. */
  lettre: string;
  /** La journée a été travaillée : la graine est plantée. */
  travaille: boolean;
  /** C'est aujourd'hui : la seule case que le cinabre marque. */
  aujourdhui: boolean;
  /** La journée n'est pas encore arrivée. */
  futur: boolean;
};

/**
 * Tout ce que les écrans de série et de récompenses ont besoin de savoir.
 * Aucun champ ne compte les jours manqués : c'est la règle, et le test la tient.
 */
export type Serie = {
  /** Jours d'affilée, les jours de repos ayant couvert les trous. */
  jours: number;
  /** La plus longue série atteinte : un cadeau reçu reste reçu. */
  record: number;
  /** Jours de repos en réserve, deux au plus. */
  reserve: number;
  /** Total des journées travaillées : une graine par journée. */
  graines: number;
  /** Sept graines font un arbre. */
  arbres: number;
  /** Les sept cases de la semaine en cours, du lundi au dimanche. */
  semaine: Graine[];
  /** Les graines plantées cette semaine. */
  grainesSemaine: number;
  /** Les paliers déjà atteints, du plus petit au plus grand. */
  atteints: Palier[];
  /** Le palier atteint tout juste : Que remet son cadeau. `null` le reste du temps. */
  palier: Palier | null;
  /** Le palier suivant sur le chemin, `null` après le 365e jour. */
  prochain: Palier | null;
  /** Journées qui restent avant le prochain palier. */
  restant: number;
};

/**
 * L'état de la série, calculé depuis les seules journées travaillées.
 *
 * On avance journée après journée : chaque trou est d'abord couvert par la réserve, et
 * la série ne repart de zéro que si la réserve est vide. Chaque septième journée
 * travaillée referme une semaine complète et donne un jour de repos, plafonné à deux.
 * La journée d'aujourd'hui, pas encore travaillée, n'est pas un trou : rien ne presse.
 */
export function etatSerie(joursTravailles: readonly string[], aujourdhui: string): Serie {
  const jours = normaliser(joursTravailles).filter((j) => joursEntre(j, aujourdhui) >= 0);
  let serie = 0;
  let record = 0;
  let reserve = 0;
  let graines = 0;
  let precedent: string | null = null;

  /** Consomme la réserve pour couvrir les journées sautées ; sinon la série repart de zéro. */
  const passerLeTrou = (sautees: number): void => {
    if (sautees <= 0) return;
    const couvertes = Math.min(sautees, reserve);
    reserve -= couvertes;
    if (sautees > couvertes) serie = 0;
  };

  for (const j of jours) {
    if (precedent !== null) passerLeTrou(joursEntre(precedent, j) - 1);
    serie += 1;
    graines += 1;
    if (graines % GRAINES_PAR_ARBRE === 0) reserve = Math.min(reserve + 1, RESERVE_MAX);
    record = Math.max(record, serie);
    precedent = j;
  }
  /* Ce qui s'est passé depuis la dernière journée travaillée, aujourd'hui non compris. */
  if (precedent !== null) passerLeTrou(joursEntre(precedent, aujourdhui) - 1);

  const set = new Set(jours);
  const cases = semaine(aujourdhui).map((jour, i) => ({
    jour,
    lettre: LETTRES[i],
    travaille: set.has(jour),
    aujourdhui: jour === aujourdhui,
    futur: joursEntre(aujourdhui, jour) > 0
  }));

  const atteints = PALIERS.filter((p) => p <= record);
  const prochain = PALIERS.find((p) => p > serie) ?? null;

  return {
    jours: serie,
    record,
    reserve,
    graines,
    arbres: Math.floor(graines / GRAINES_PAR_ARBRE),
    semaine: cases,
    grainesSemaine: cases.filter((c) => c.travaille).length,
    atteints,
    palier: PALIERS.find((p) => p === serie) ?? null,
    prochain,
    restant: prochain === null ? 0 : prochain - serie
  };
}

/* ---------- les textes ---------- */

function ordinal(n: number): string {
  return n <= 1 ? '1er' : `${n}e`;
}

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/** Le compteur de l'écran : des jours d'affilée, jamais des jours manqués. */
export function libelleJours(s: Serie): string {
  return s.jours > 1 ? "jours d'affilée" : "jour d'affilée";
}

export function libelleReserve(s: Serie): string {
  return s.reserve > 1 ? 'jours de repos en réserve' : 'jour de repos en réserve';
}

/** Ce que le jour de repos fait. Une protection, et on le dit comme telle. */
export const PHRASE_REPOS =
  'Un jour de repos protège ta série si tu sautes une journée. Tu en gagnes un par semaine complète. Jamais plus de deux en réserve.';

/**
 * La phrase sous le chemin : Que attend au palier suivant. Vide quand le cadeau vient
 * d'être remis (la carte du cadeau parle à sa place) ou après le dernier palier.
 */
export function messageProchain(s: Serie): string {
  if (s.palier !== null || s.prochain === null) return '';
  const jours = pluriel(s.restant, 'jour', 'jours');
  return `Que t'attend au ${ordinal(s.prochain)} jour avec ${CADEAUX[s.prochain].court}. Encore ${jours}.`;
}

/** Ce que Que dit en remettant le cadeau. */
export function messageCadeau(palier: Palier): string {
  return `Que t'offre ${CADEAUX[palier].court}.`;
}

/** Les graines de la semaine, et l'arbre qu'elles font une fois les sept plantées. */
export function messageSemaine(s: Serie): string {
  const graines = pluriel(s.grainesSemaine, 'graine plantée', 'graines plantées');
  if (s.grainesSemaine >= GRAINES_PAR_ARBRE) return `${graines} cette semaine : un arbre de plus.`;
  return `${graines} cette semaine. Sept graines font un arbre.`;
}
