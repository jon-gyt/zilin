/**
 * La première session : 人, 大, 天, puis lire 天天, et les deux questions.
 * Elle passe avant tout au tout premier lancement, quatre minutes, un mot lu.
 *
 * Module pur, comme `session.ts` : les textes des fiches, du mot et de sa question
 * viennent du JSON versionné de `app/public/data/`, jamais du code. Ne restent ici
 * que les libellés d'interface des deux questions, comme les six pas dans `session.ts`.
 */
import {
  contenu,
  familleOnce,
  nomParcours,
  type Famille,
  type Fiche,
  type Index,
  type Signe
} from './content';
import { budgetNewBricks, type Budget, type EtapeDepart, type Parcours } from './session';

export const FICHIER_FAMILLE_DEPART = 'data/demo/familles/人.json';
export const FICHIER_MOT_DEPART = 'data/demo/textes/天天.json';

/* ---------- l'aiguillage d'après le logo ---------- */

/**
 * Après le logo : la première session au tout premier lancement ; ensuite l'anecdote du
 * jour, puis le menu. L'aiguillage vit avec le reste du parcours, dans `parcours.ts`.
 */
export { apresSplash } from './parcours';

/* ---------- la famille de départ ---------- */

/**
 * La formule d'un caractère : l'étymologie, une couche par-dessus la décomposition
 * canonique. Les jetons sont les éléments et les opérateurs, dans l'ordre de lecture ;
 * `nouveau` désigne les seuls jetons qui portent le cinabre.
 */
export type Formule = { tokens: string[]; nouveau: number[] };

/** Les opérateurs d'une formule : tout le reste est un caractère à dessiner. */
export const OPERATEURS = ['+', '=', '→'] as const;

export function estOperateur(jeton: string): boolean {
  return (OPERATEURS as readonly string[]).includes(jeton);
}

/**
 * Une fiche de la première session : la fiche du format Famille, plus la ligne du
 * guide de l'écran et la formule étymologique, que la maquette donne toutes deux.
 */
export type FicheDepart = Fiche & { guide_fr?: string | null; formule?: Formule | null };

/** Les fiches de la famille de départ, dans l'ordre des écrans : 人, 大, 天. */
export function fichesDepart(f: Famille): FicheDepart[] {
  return f.fiches as FicheDepart[];
}

/** La famille de départ, servie avec l'app. Une seule requête pour toute la durée de vie. */
export function familleDepart(): Promise<Famille> {
  return familleOnce(FICHIER_FAMILLE_DEPART);
}

/* ---------- le mot lu ---------- */

/**
 * Le mot de la première session : le mot lui-même, la glose de chaque caractère,
 * sa traduction, et la question posée avec ses réponses. Tout vient du fichier.
 */
export type MotDepart = {
  version: string;
  source: string;
  /** Le caractère du jour, celui autour duquel le mot est écrit. */
  c: string;
  mot: string;
  pinyin: string;
  lignes: Signe[][];
  traduction: string;
  /** La question posée sur le mot, et les réponses proposées. */
  question: string;
  choix: string[];
  bonne: number;
  indice: string;
  juste: string;
  faux: string;
  audio?: string | null;
};

/** Lit le mot servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadMot(
  file = FICHIER_MOT_DEPART,
  fetchFn: typeof fetch = fetch
): Promise<MotDepart> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Mot introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<MotDepart>;
  if (typeof brut.mot !== 'string' || !Array.isArray(brut.choix) || brut.choix.length === 0) {
    throw new Error(`Mot illisible : ${file}`);
  }
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    c: typeof brut.c === 'string' ? brut.c : '',
    mot: brut.mot,
    pinyin: typeof brut.pinyin === 'string' ? brut.pinyin : '',
    lignes: Array.isArray(brut.lignes) ? brut.lignes : [],
    traduction: typeof brut.traduction === 'string' ? brut.traduction : '',
    question: typeof brut.question === 'string' ? brut.question : '',
    choix: brut.choix,
    bonne: typeof brut.bonne === 'number' ? brut.bonne : 0,
    indice: typeof brut.indice === 'string' ? brut.indice : '',
    juste: typeof brut.juste === 'string' ? brut.juste : '',
    faux: typeof brut.faux === 'string' ? brut.faux : '',
    audio: brut.audio ?? null
  };
}

const mots = new Map<string, Promise<MotDepart>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function motOnce(file = FICHIER_MOT_DEPART): Promise<MotDepart> {
  let p = mots.get(file);
  if (!p) {
    p = loadMot(file).catch((e) => {
      mots.delete(file);
      throw e;
    });
    mots.set(file, p);
  }
  return p;
}

/** Les signes du mot, à gloser au toucher. */
export function signes(m: MotDepart): Signe[] {
  return m.lignes.flat();
}

/* ---------- les écrans ---------- */

/** Les trois premiers écrans montrent une fiche chacun, dans l'ordre de la famille. */
const FICHE_PAR_ECRAN: Partial<Record<EtapeDepart, number>> = { f1: 0, f2: 1, f3: 2 };

/** La fiche montrée à cet écran, `null` pour les écrans qui n'en montrent pas. */
export function ficheDe(f: Famille | null, vue: EtapeDepart): FicheDepart | null {
  const i = FICHE_PAR_ECRAN[vue];
  if (f === null || i === undefined) return null;
  return fichesDepart(f)[i] ?? null;
}

/** Les caractères appris pendant la première session, dans l'ordre : 人, 大, 天. */
export function briques(f: Famille | null): string[] {
  const vues: EtapeDepart[] = ['f1', 'f2', 'f3'];
  return vues.map((v) => ficheDe(f, v)?.c).filter((c): c is string => typeof c === 'string');
}

/* ---------- la suite : le parcours reprend après ce que la première session a posé ---------- */

/**
 * Le jour du parcours où la session complète reprend après la première session. Le
 * pipeline ouvre le parcours « Lire » par ce qu'elle enseigne, un jour par brique (人, 大,
 * 天 : `DEPART` de `data/src/wenlu_data/graphe.py`) ; ces jours, déjà faits, sont passés,
 * pour que rien ne soit enseigné deux fois. Le premier jour qui pose autre chose est celui
 * de la prochaine session. Un parcours qui ne commence pas par eux reprend au jour 1.
 */
export function jourApresDepart(i: Index, nom: string, appris: readonly string[]): number {
  const jours = i.parcours[nom]?.jours ?? [];
  const vus = new Set(appris);
  for (const j of jours) {
    const poses = [...(j.brique === null ? [] : [j.brique]), ...j.composes];
    if (poses.length === 0 || !poses.every((c) => vus.has(c))) return j.jour;
  }
  return (jours[jours.length - 1]?.jour ?? 0) + 1;
}

/**
 * Ce que la première session a posé, et le jour du parcours choisi où la session complète
 * reprendra. Sans index lisible, le premier jour : mieux vaut revoir une brique que d'en
 * sauter une.
 */
export async function suiteDepart(
  choisi: string | null
): Promise<{ appris: string[]; jour: number }> {
  const appris = await familleDepart()
    .then((f) => briques(f))
    .catch(() => [] as string[]);
  const jour = await contenu()
    .then((i) => jourApresDepart(i, nomParcours(i, choisi), appris))
    .catch(() => 1);
  return { appris, jour };
}

/** Les écrans de la leçon, avant les deux questions. */
export const LECON = ['f1', 'f2', 'f3', 'f4', 'f5'] as const;

/** Les deux questions, après la leçon. */
export const QUESTIONS = ['objectif', 'rythme'] as const;

/** La barre de progression : cinq points pendant la leçon, trois pour les questions. */
export function points(vue: EtapeDepart): { total: number; index: number } {
  const i = (LECON as readonly string[]).indexOf(vue);
  if (i >= 0) return { total: LECON.length, index: i };
  /* Les questions reprennent les trois points de la maquette : la leçon compte pour le premier. */
  return { total: 3, index: (QUESTIONS as readonly string[]).indexOf(vue) + 1 };
}

/* ---------- les deux questions ---------- */

/** Un choix de question : un caractère en vignette, un titre, une ligne d'explication. */
export type Choix<T> = { id: T; c: string; t: string; d: string };

/** Le parcours : même arbre, ordre différent. Libellés de la maquette (écran ob2). */
export const PARCOURS: Choix<Parcours>[] = [
  { id: 'lire', c: '书', t: 'Lire, tout simplement', d: 'Panneaux, menus, messages, puis des textes' },
  { id: 'hsk', c: '考', t: 'Passer le HSK', d: 'Ordre officiel des niveaux 1 à 6' },
  { id: 'voyage', c: '行', t: 'Voyager', d: "Gares, cartes, prix, directions d'abord" }
];

/** Les caractères en vignette des trois rythmes (écran ob3 de la maquette). */
const VIGNETTE_RYTHME: Record<Budget, string> = { 5: '五', 10: '十', 20: '廿' };

const NOUVEAUX = ['', 'une brique nouvelle', 'deux briques nouvelles'];

/**
 * Ce qu'un rythme contient. La ligne se déduit du budget, jamais recopiée : la maquette
 * annonce « 2 à 3 caractères nouveaux » à dix minutes, là où la règle produit n'en veut
 * qu'une seule par session de dix minutes (`budgetNewBricks`). C'est la règle qui gagne.
 */
export function ligneRythme(b: Budget): string {
  const n = budgetNewBricks(b);
  return n === 0 ? 'Révisions seulement' : `Révisions et ${NOUVEAUX[n]}`;
}

export const RYTHMES: Choix<Budget>[] = [5, 10, 20].map((b) => ({
  id: b as Budget,
  c: VIGNETTE_RYTHME[b as Budget],
  t: `${b} minutes`,
  d: ligneRythme(b as Budget)
}));
