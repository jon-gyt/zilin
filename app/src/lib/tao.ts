/**
 * Tao 桃, la graine de pêcher. Elle accompagne toutes les activités dans la posture
 * correspondante, grandit de ce qui est fait, et n'a qu'une humeur, faite de variété.
 *
 * Interdits, tenus par ce module : elle ne meurt jamais, ne tombe jamais malade,
 * ne culpabilise jamais. Rien ici ne décroît, aucune humeur n'est négative, aucun
 * compteur de jours perdus n'existe. Une absence la met en pot ; elle attend.
 *
 * Module pur, comme `session.ts` : aucune fonction ne lit l'horloge ni n'écrit dans
 * un stockage. La journée courante est toujours passée en argument (AAAA-MM-JJ).
 */
import { SEUIL_ABSENCE, joursEntre } from './session';

/* ---------- l'état ---------- */

/** Ce que l'utilisateur peut faire. Une activité, une posture. */
export type TypeActivite =
  | 'lecon'
  | 'revision'
  | 'lecture'
  | 'conte'
  | 'trace'
  | 'jeu'
  | 'cuisine'
  | 'chemin'
  | 'anecdote';

/** Une activité faite, datée à la journée civile. C'est la seule mémoire de Tao. */
export type Activite = { jour: string; type: TypeActivite };

/** L'état de Tao. Sérialisable tel quel, rangé avec la progression. */
export type Tao = {
  /** Somme pondérée de toutes les activités. Ne décroît jamais. */
  croissance: number;
  /** Le journal des activités, les plus récentes à la fin. */
  activites: Activite[];
  /** Ce que les jeux rapportent et qui se voit sur elle. Rien ne s'achète. */
  collection: string[];
};

export function taoVide(): Tao {
  return { croissance: 0, activites: [], collection: [] };
}

/**
 * Poids d'une activité dans la croissance. L'échelle suit le travail demandé, pas
 * le temps passé : apprendre une brique est l'acte de la journée (5), un conte se
 * lit en entier (4), un texte est plus court (3), un jeu, un plat et un tracé sont des
 * exercices courts (2), une carte, l'anecdote et le pas sur le chemin sont l'unité (1).
 * Aux paliers, cela fait environ un mois de sessions de dix minutes pour le jeune
 * pêcher, trois pour les fleurs, un an pour les pêches.
 */
export const POIDS: Record<TypeActivite, number> = {
  lecon: 5,
  conte: 4,
  lecture: 3,
  trace: 2,
  jeu: 2,
  cuisine: 2,
  revision: 1,
  chemin: 1,
  anecdote: 1
};

/**
 * Longueur maximale du journal. Sept jours suffisent à l'humeur et trois activités
 * à l'ennui ; on en garde bien plus pour le journal du soir et les semaines en image,
 * mais pas au point que la progression grossisse sans fin.
 */
export const JOURNAL_MAX = 500;

/** Ajoute une activité : la croissance monte, le journal s'allonge. */
export function ajouter(t: Tao, jour: string, type: TypeActivite): Tao {
  const activites = [...t.activites, { jour, type }];
  return {
    ...t,
    croissance: t.croissance + POIDS[type],
    activites: activites.slice(Math.max(0, activites.length - JOURNAL_MAX))
  };
}

/** La dernière journée où Tao a vu quelque chose. `null` si elle n'a rien vu. */
export function dernierJour(t: Tao): string | null {
  return t.activites.length > 0 ? t.activites[t.activites.length - 1].jour : null;
}

/* ---------- les stades ---------- */

export type Stade = 'graine' | 'pousse' | 'jeune' | 'fleur' | 'peches';

/** Les paliers du brief : 100, 300 (fleurs), 1 000 (pêches). */
export const PALIERS = { jeune: 100, fleur: 300, peches: 1000 } as const;

/** Le stade ne dépend que de la croissance. Il ne redescend donc jamais. */
export function stade(croissance: number): Stade {
  if (croissance >= PALIERS.peches) return 'peches';
  if (croissance >= PALIERS.fleur) return 'fleur';
  if (croissance >= PALIERS.jeune) return 'jeune';
  return croissance > 0 ? 'pousse' : 'graine';
}

/* ---------- les postures ---------- */

/**
 * Une posture par activité. Le pot n'en est pas une : c'est l'absence. En cuisine, Tao
 * goûte (`goute`) : le bol et la cuillère.
 */
export type Posture =
  | 'lecon'
  | 'revision'
  | 'lecture'
  | 'trace'
  | 'jeu'
  | 'goute'
  | 'chemin'
  | 'anecdote';

/** Ce que Tao montre à l'écran : sa posture, ou le pot quand personne n'est là. */
export type PostureVue = Posture | 'pot';

/**
 * Le conte se lit comme un texte : même posture, elle lit par-dessus l'épaule. En
 * cuisine, elle goûte.
 */
export function posture(activite: TypeActivite): Posture {
  if (activite === 'conte') return 'lecture';
  if (activite === 'cuisine') return 'goute';
  return activite;
}

/* ---------- l'humeur ---------- */

/** Aucune humeur n'est négative : c'est de la variété, du calme, ou l'envie d'autre chose. */
export type Humeur = 'joie' | 'calme' | 'ennui';

/** L'humeur se lit sur la semaine glissante, jamais sur l'horloge. */
export const FENETRE_HUMEUR = 7;

/** Trois fois la même activité d'affilée : elle s'ennuie et propose un jeu. */
export const REPETITIONS_ENNUI = 3;

/** Trois types différents dans la semaine : la variété fait la joie. */
export const VARIETE_JOIE = 3;

/** Les activités de la semaine glissante, la journée du jour comprise. */
export function fenetre(activites: readonly Activite[], aujourdhui: string): Activite[] {
  return activites.filter((a) => {
    const d = joursEntre(a.jour, aujourdhui);
    return d >= 0 && d < FENETRE_HUMEUR;
  });
}

function repetee(recentes: readonly Activite[]): boolean {
  if (recentes.length < REPETITIONS_ENNUI) return false;
  const trois = recentes.slice(recentes.length - REPETITIONS_ENNUI);
  return trois.every((a) => a.type === trois[0].type);
}

/**
 * L'humeur vient de la variété des activités, jamais de l'horloge : une journée sans
 * rien ne compte pas, elle n'enlève rien. Une semaine vide laisse Tao calme, jamais
 * triste. Trois fois la même activité d'affilée passe avant tout : c'est le seul cas
 * où elle demande quelque chose, un jeu.
 */
export function humeur(activites: readonly Activite[], aujourdhui: string): Humeur {
  const recentes = fenetre(activites, aujourdhui);
  if (repetee(recentes)) return 'ennui';
  const types = new Set(recentes.map((a) => a.type));
  return types.size >= VARIETE_JOIE ? 'joie' : 'calme';
}

/** L'ennui est une proposition, pas un reproche : elle propose un jeu. */
export function proposeUnJeu(h: Humeur): boolean {
  return h === 'ennui';
}

/* ---------- l'absence ---------- */

/**
 * En pot après une absence, au même seuil que le rattrapage de la session
 * (`SEUIL_ABSENCE`). Une seule réponse, oui ou non : jamais un nombre de jours
 * manqués. Au retour, elle se redresse, sans reproche (deux secondes, côté dessin).
 */
export function absente(dernierJour: string | null, aujourdhui: string): boolean {
  return dernierJour !== null && joursEntre(dernierJour, aujourdhui) >= SEUIL_ABSENCE;
}

/**
 * Ce que Tao montre sur le chemin du jour. `null` : elle n'est pas à l'écran.
 * Au retour d'absence elle sort du pot ; la journée finie elle marche sur le chemin.
 */
export function poseDuJour(
  etat: { rattrapage: boolean; fini: boolean },
  humeurDuJour: Humeur = 'calme'
): { posture: PostureVue; humeur: Humeur } | null {
  if (etat.rattrapage) return { posture: 'pot', humeur: humeurDuJour };
  return etat.fini ? { posture: 'chemin', humeur: 'joie' } : null;
}

/* ---------- le journal du soir ---------- */

/** Ordre de la ligne du soir : ce qui pèse le plus se dit d'abord. */
const ORDRE: TypeActivite[] = [
  'lecon',
  'conte',
  'lecture',
  'trace',
  'jeu',
  'cuisine',
  'revision',
  'anecdote',
  'chemin'
];

const LIBELLES: Record<TypeActivite, [string, string]> = {
  lecon: ['une brique apprise', 'briques apprises'],
  conte: ['un conte lu', 'contes lus'],
  lecture: ['un texte lu', 'textes lus'],
  trace: ['un caractère tracé', 'caractères tracés'],
  jeu: ['un jeu', 'jeux'],
  cuisine: ['un plat cuisiné', 'plats cuisinés'],
  revision: ['une carte révisée', 'cartes révisées'],
  anecdote: ['une anecdote', 'anecdotes'],
  chemin: ['un pas sur le chemin', 'pas sur le chemin']
};

/** Les activités d'une journée, comptées par type. */
export function comptes(activites: readonly Activite[], jour: string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of activites) if (a.jour === jour) c[a.type] = (c[a.type] ?? 0) + 1;
  return c;
}

/**
 * La ligne du soir : un constat, rien d'autre. Elle ne dit que des nombres, jamais
 * « bravo », jamais « tu n'as pas ». Une journée de repos se constate aussi, au calme.
 */
export function journal(activites: readonly Activite[], jour: string): string {
  const c = comptes(activites, jour);
  const morceaux = ORDRE.filter((t) => (c[t] ?? 0) > 0).map((t) => {
    const n = c[t];
    const [un, plusieurs] = LIBELLES[t];
    return n === 1 ? un : `${n} ${plusieurs}`;
  });
  if (morceaux.length === 0) return "Aujourd'hui, rien de noté.";
  return `Aujourd'hui, ${morceaux.join(', ')}.`;
}

/* ---------- sérialisation ---------- */

const TYPES = new Set<string>(Object.keys(POIDS));

function estType(v: unknown): v is TypeActivite {
  return typeof v === 'string' && TYPES.has(v);
}

/**
 * Relit l'état de Tao rangé avec la progression. Une progression sans Tao, exportée
 * avant elle, rend une Tao vide : le champ est rétrocompatible.
 */
export function lireTao(brut: unknown): Tao {
  if (typeof brut !== 'object' || brut === null) return taoVide();
  const o = brut as Record<string, unknown>;
  const activites = Array.isArray(o.activites)
    ? o.activites.flatMap((x) => {
        if (typeof x !== 'object' || x === null) return [];
        const a = x as Record<string, unknown>;
        return typeof a.jour === 'string' && estType(a.type) ? [{ jour: a.jour, type: a.type }] : [];
      })
    : [];
  return {
    croissance: typeof o.croissance === 'number' && o.croissance > 0 ? Math.floor(o.croissance) : 0,
    activites,
    collection: Array.isArray(o.collection) ? o.collection.filter((x): x is string => typeof x === 'string') : []
  };
}
