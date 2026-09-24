/**
 * Ce qui branche les questions sur le contenu et sur FSRS, pour les deux écrans qui
 * posent des questions : le pas 2 Échauffer et le pas 5 Fixer.
 *
 * Les sept types et le choix des leurres sont dans `questions.ts`, la notation et la
 * planification dans `srs.ts`, l'état de la session dans `session.ts`. Ici, on assemble
 * seulement le corpus à partir du JSON versionné servi avec l'app, on nomme la graine du
 * jour, et on met en mots ce que FSRS a décidé (le délai, le résumé de fin).
 *
 * Module pur : aucune requête (l'appelant charge les fichiers), aucune horloge (l'instant
 * est passé en argument), aucun `Math.random` (tout part de la graine du jour).
 */
import { Rating, type Grade } from 'ts-fsrs';
import {
  compose,
  ficheDeFamille as ficheDeLaFamille,
  type Famille,
  type Fiche,
  type Role,
  type Voisin,
  type Voisins
} from './content';
import {
  fiche as ficheDuCorpus,
  horsSerie,
  question,
  serie,
  typesPossibles,
  type Corpus,
  type Due,
  type Paires,
  type Question,
  type TypeQuestion
} from './questions';
import type { ReviewCard } from './srs';

/* ---------- des constats, jamais des félicitations ---------- */

/** Ce que dit la correction, selon la note automatique. Aucun compliment. */
export const VERDICTS: Record<Grade, string> = {
  [Rating.Easy]: 'Oui.',
  [Rating.Good]: 'Oui.',
  [Rating.Hard]: "C'est ça, avec une hésitation.",
  [Rating.Again]: 'Non.'
};

/** Avance automatique après une bonne réponse. Un tap va plus vite. */
export const AVANCE_MS = 1300;

/**
 * La vitesse de lecture prêtée à un débutant pour lire une correction : douze signes
 * par seconde, en français mêlé de caractères et de pinyin.
 */
export const SIGNES_PAR_SECONDE = 12;

/** Au-delà de ce temps de lecture, la correction ne part plus toute seule. */
export const LECTURE_MAX_MS = 6000;

/**
 * Le délai d'avance automatique après une bonne réponse, calé sur la correction affichée :
 * jamais moins que `AVANCE_MS`, le temps de la lire sinon. Une correction trop longue
 * pour être lue d'un coup d'œil ne part pas toute seule (`null`) : on avance au tap.
 * Retour du propriétaire : l'écran filait avant la fin de la lecture.
 */
export function delaiAvance(correction: string): number | null {
  const signes = correction.replace(/\s+/g, ' ').trim().length;
  const lecture = Math.round((signes / SIGNES_PAR_SECONDE) * 1000);
  if (lecture > LECTURE_MAX_MS) return null;
  return Math.max(AVANCE_MS, lecture);
}

/** Ce que dit le résumé d'une carte : sue, ou à revoir. */
export const SUR = 'sûr';
export const A_REVOIR = 'à revoir';

/* ---------- la graine du jour ---------- */

/**
 * La graine d'une séance : le pas et la journée. La même journée repose les mêmes
 * questions, et Échauffer ne tire jamais comme Fixer.
 */
export function graineDuJour(pas: string, jour: string): string {
  return `${pas}/${jour}`;
}

/* ---------- le corpus, assemblé à partir du contenu servi avec l'app ---------- */

/** Tout ce que l'appelant a chargé. Rien n'est lu ici, rien n'est inventé ici. */
export type SourcesCorpus = {
  /**
   * Les fiches de l'export versionné, déjà surcouchées par `content.fiche`. C'est la
   * source principale depuis que les écrans lisent `data/0.1.0/`.
   */
  fiches?: readonly Fiche[];
  /** Une famille entière, quand l'appelant n'a chargé que celle-là. */
  famille?: Famille | null;
  voisins: Voisins | null;
  /** L'acquis de l'utilisateur : ses cartes FSRS. */
  cartes: readonly ReviewCard[];
  paires?: Paires;
  /** Réglage « proposer le tracé ». */
  trace?: boolean;
};

/**
 * Le rôle déclaré des éléments ajoutés. Dans le JSON des familles, `role` dit le rôle de
 * l'élément ajouté (`nouveau`) dans le caractère : 住 porte `role: son` pour son 主.
 * `questions.ts`, lui, lit le rôle sur la fiche du composant. On reporte donc le rôle là
 * où il est lu, sans rien ajouter à ce que la source dit.
 */
export function rolesDesElements(fiches: readonly Fiche[]): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const f of fiches) {
    /* `roles` dit le rôle de chaque brique ; il prime quand la fiche relue le porte. */
    for (const [part, role] of Object.entries(f.roles ?? {})) out[part] = role;
    for (const i of f.nouveau) {
      const part = f.parts[i];
      if (part !== undefined && f.role !== null) out[part] = f.role;
    }
  }
  return out;
}

/**
 * La fiche minimale d'un caractère connu seulement par la liste des voisins : de quoi le
 * montrer et le lire, rien de plus. Aucune origine n'est écrite ici : l'étiquette ne
 * prétend donc rien de plus qu'un moyen de reconnaître la forme.
 */
export function ficheDeVoisin(v: Voisin, role: Role = 'forme'): Fiche {
  return {
    c: v.c,
    pinyin: v.pinyin,
    fr: v.fr,
    en: '',
    parts: v.parts.filter((p) => p !== v.c),
    nouveau: [],
    role,
    origine_fr: '',
    origine_en: '',
    etiquette: 'mnemotechnique',
    mots: [],
    niveaux: {},
    traits: [],
    medianes: []
  };
}

/** La fiche d'une brique citée en composant et qu'aucune source ne décrit encore. */
export function ficheMinimale(c: string, role: Role = 'forme'): Fiche {
  return ficheDeVoisin({ c, pinyin: '', fr: '', parts: [] }, role);
}

/**
 * Les fiches du corpus : celles de l'export d'abord, puis la famille chargée seule, les
 * voisins, et enfin les briques citées en composant qu'aucune source ne décrit.
 */
export function fichesDuCorpus(
  famille: Famille | null,
  voisins: Voisins | null,
  base: readonly Fiche[] = []
): Fiche[] {
  const toutes = [...base, ...(famille?.fiches ?? []).filter((f) => !base.some((b) => b.c === f.c))];
  const roles = rolesDesElements(toutes);
  const out: Fiche[] = toutes.map((f) => ({ ...f, role: roles[f.c] ?? f.role }));
  const porte = (c: string) => out.some((x) => x.c === c);
  for (const v of voisins?.voisins ?? []) {
    if (!porte(v.c)) out.push(ficheDeVoisin(v, roles[v.c] ?? 'forme'));
  }
  /* La liste grandit pendant la boucle : les briques n'ont pas de composant, elle finit. */
  for (let i = 0; i < out.length; i++) {
    for (const part of out[i].parts) {
      if (!porte(part)) out.push(ficheMinimale(part, roles[part] ?? 'forme'));
    }
  }
  return out;
}

/** Les décompositions canoniques portées par les fiches du corpus. */
export function decompositionsDe(fiches: readonly Fiche[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of fiches) {
    if (f.parts.length > 0) out[f.c] = [...f.parts];
  }
  return out;
}

/**
 * Le corpus du pas Échauffer : les fiches de la famille et des voisins, les
 * décompositions, l'acquis (les cartes), les paires à ne pas confondre, le réglage tracé.
 */
export function corpusRevision(s: SourcesCorpus): Corpus {
  const fiches = fichesDuCorpus(s.famille ?? null, s.voisins, s.fiches ?? []);
  return {
    fiches,
    decompositions: decompositionsDe(fiches),
    acquis: s.cartes,
    paires: s.paires ?? [],
    trace: s.trace ?? true
  };
}

/**
 * Le corpus du pas Fixer. Il ne vérifie que ce qui vient d'être vu, et ses leurres sont
 * les voisins de forme servis avec la fiche, pas l'acquis FSRS : le seuil tombe à zéro et
 * les voisins comptent comme montrables, le temps de la vérification.
 */
export function corpusFixer(s: SourcesCorpus): Corpus {
  const base = corpusRevision(s);
  const voisins = (s.voisins?.voisins ?? []).map((v) => ({ c: v.c, stabilite: 0 }));
  return { ...base, acquis: [...base.acquis, ...voisins], seuil: 0 };
}

/** Le pinyin d'un caractère, tel que le corpus le porte. Vide s'il ne le porte pas. */
export function pinyinDe(c: string, corpus: Corpus): string {
  return ficheDuCorpus(c, corpus)?.pinyin ?? '';
}

/* ---------- les questions des deux pas ---------- */

/** Les questions d'une séance d'échauffement : une par carte de la pile, dans l'ordre. */
export function questionsRevision(
  pile: readonly Due[],
  corpus: Corpus,
  jour: string
): Question[] {
  return serie(pile, corpus, graineDuJour('rev', jour));
}

/**
 * Les cartes à garder de côté après cette séance : celles de la pile que le corpus ne
 * permet pas de poser, et celles déjà de côté qui ne le permettent toujours pas. Une
 * carte de côté que le contenu sait désormais poser en sort : elle redevient due.
 */
export function cartesEnAttente(
  pile: readonly Due[],
  enAttente: readonly string[],
  corpus: Corpus
): string[] {
  return horsSerie([...pile, ...enAttente], corpus);
}

/**
 * La ligne du résumé pour les cartes passées : un constat neutre, ni excuse ni alerte.
 * Vide quand aucune carte n'a été passée.
 */
export function ligneEnAttente(ids: readonly string[]): string {
  if (ids.length === 0) return '';
  if (ids.length === 1) {
    return `${ids[0]} attend sa fiche : la carte est gardée, elle reviendra quand le contenu la portera.`;
  }
  return `${ids.join(' ')} attendent leur fiche : les cartes sont gardées, elles reviendront quand le contenu les portera.`;
}

/** L'ordre de la vérification : le sens du composé, la brique, puis l'assemblage. */
const PLAN_FIXER: readonly ['racine' | 'compose', TypeQuestion][] = [
  ['compose', 'sens'],
  ['racine', 'caractere'],
  ['compose', 'assemblage']
];

/**
 * La vérification du jour : la brique et le composé de la session, en trois questions
 * prises dans les sept types. Une question que la fiche ne permet pas est écartée — un
 * jour sans composé, ou sans fiche relue, en pose donc moins.
 */
export function questionsFixerDuJour(
  brique: string | null,
  compose: string | null,
  corpus: Corpus,
  jour: string
): Question[] {
  const graine = graineDuJour('fix', jour);
  const out: Question[] = [];
  for (const [qui, type] of PLAN_FIXER) {
    const c = qui === 'racine' ? brique : compose;
    const f = c === null ? null : ficheDuCorpus(c, corpus);
    if (f === null || !typesPossibles(f, corpus).includes(type)) continue;
    out.push(question(f, type, corpus, graine));
  }
  return out;
}

/** La même vérification, quand l'appelant n'a qu'une famille sous la main. */
export function questionsFixer(famille: Famille, corpus: Corpus, jour: string): Question[] {
  const racine = ficheDeLaFamille(famille, famille.racine.c);
  return questionsFixerDuJour(racine?.c ?? null, compose(famille)?.c ?? null, corpus, jour);
}

/* ---------- ce que FSRS a décidé, en clair ---------- */

const MINUTE = 60_000;
const HEURE = 3_600_000;
const JOUR = 86_400_000;

/**
 * Le délai jusqu'à la prochaine fois, tel que FSRS l'a planifié. Jamais une constante :
 * ce qui est annoncé est ce qui est écrit dans la carte.
 */
export function delai(maintenant: Date, echeance: Date): string {
  const ms = Math.max(0, echeance.getTime() - maintenant.getTime());
  if (ms < HEURE) {
    const min = Math.round(ms / MINUTE);
    return min <= 1 ? 'une minute' : `${min} minutes`;
  }
  if (ms < JOUR) {
    const h = Math.round(ms / HEURE);
    return h <= 1 ? 'une heure' : `${h} heures`;
  }
  const j = Math.round(ms / JOUR);
  return j <= 1 ? '1 jour' : `${j} jours`;
}

/** La dernière note portée par une carte, `null` si elle n'a encore rien vu. */
export function derniereNote(carte: ReviewCard | null): { rating: Grade; due: Date } | null {
  if (carte === null || carte.history.length === 0) return null;
  const h = carte.history[carte.history.length - 1];
  return { rating: h.rating, due: h.due };
}

/** Une ligne du résumé de fin : la carte, ce qu'elle a donné, et sa vraie échéance. */
export type LigneResume = {
  c: string;
  label: string;
  /** Sue du premier coup : la note automatique vaut au moins « Bien ». */
  sure: boolean;
  verdict: string;
  /** Le délai FSRS, en clair. Vide si la carte n'a pas été notée. */
  quand: string;
};

/**
 * Le résumé de la séance : une ligne par question, « sûr » ou « à revoir », et la
 * prochaine échéance telle que FSRS l'a calculée.
 */
export function resume(
  questions: readonly Question[],
  cartes: readonly ReviewCard[],
  maintenant: Date
): LigneResume[] {
  return questions.map((q) => {
    const note = derniereNote(cartes.find((x) => x.id === q.c) ?? null);
    const sure = note !== null && note.rating >= Rating.Good;
    return {
      c: q.c,
      label: q.label,
      sure,
      verdict: sure ? SUR : A_REVOIR,
      quand: note === null ? '' : delai(maintenant, note.due)
    };
  });
}

/** Le nombre de cartes sues du premier coup. */
export function sures(lignes: readonly LigneResume[]): number {
  return lignes.filter((l) => l.sure).length;
}
