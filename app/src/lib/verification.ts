/**
 * Pas 5, Fixer : la vérification de ce qui vient d'être vu, en questions à choix.
 *
 * Module pur, comme `session.ts` : aucune horloge, aucun stockage, aucun hasard non
 * maîtrisé. Le mélange est tiré d'une graine passée en argument, pour que la même
 * journée pose la même vérification et que les tests soient reproductibles.
 *
 * Règles produit tenues ici :
 * - les leurres ressemblent à la réponse : ils partagent un composant avec elle ;
 * - la bonne réponse ne figure jamais deux fois dans les choix ;
 * - la correction explique par les briques, avec le texte de la fiche ;
 * - jamais de félicitations, des constats (voir `VERDICTS`).
 * La notation, elle, est dans `srs.ts` (`grade`) : ici on ne fait que poser.
 */
import { Rating, type Grade } from 'ts-fsrs';
import type { Famille, Voisin, Voisins } from './content';

/** Les trois types posés au pas Fixer, parmi les sept du brief. */
export type TypeQuestion = 'sens' | 'char' | 'parts';

export type Question = {
  type: TypeQuestion;
  /** L'intitulé du type, affiché tel quel. */
  label: string;
  /** Le caractère noté par cette question. */
  c: string;
  ask: string;
  /** Les briques à assembler, pour le type `parts`. Vide sinon. */
  parts: string[];
  /** Les choix : des caractères (`caracteres`) ou des sens. */
  opts: string[];
  caracteres: boolean;
  ok: number;
  /** La correction, par les briques : le texte de la fiche. */
  why: string;
};

/** Nombre de choix visé. Moins seulement quand les voisins manquent. */
export const CHOIX = 4;

/** Avance automatique après une bonne réponse. Un tap va plus vite. */
export const AVANCE_MS = 1300;

/** Ce que la notation automatique promet, en clair (brief, section 7). */
export const PROCHAINE_FOIS: Record<Grade, string> = {
  [Rating.Easy]: '12 jours',
  [Rating.Good]: '4 jours',
  [Rating.Hard]: '1 jour',
  [Rating.Again]: '10 minutes'
};

/** Des constats, jamais des félicitations. */
export const VERDICTS: Record<Grade, string> = {
  [Rating.Easy]: 'Oui.',
  [Rating.Good]: 'Oui.',
  [Rating.Hard]: "C'est ça, avec une hésitation.",
  [Rating.Again]: 'Non.'
};

/* ---------- mélange reproductible ---------- */

/** Générateur congruentiel : une graine, une suite. Aucun `Math.random` ici. */
function suite(graine: number): () => number {
  let x = (Math.abs(Math.floor(graine)) % 2147483646) + 1;
  return () => {
    x = (x * 48271) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

/** Mélange une liste à partir d'une graine. La même graine rend le même ordre. */
export function melanger<T>(liste: readonly T[], graine: number): T[] {
  const r = suite(graine);
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/* ---------- les leurres ---------- */

/** Deux caractères se ressemblent quand ils partagent au moins un composant. */
export function partage(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.includes(x));
}

/**
 * Un voisin est proche de la réponse s'ils partagent un composant. Le composant
 * lui-même en est un (主 pour 住), et le caractère qui la contient aussi (住 pour 主).
 */
export function proche(v: Voisin, reponse: Voisin): boolean {
  if (v.c === reponse.c) return false;
  return partage(v.parts, reponse.parts) || reponse.parts.includes(v.c) || v.parts.includes(reponse.c);
}

/**
 * Les leurres d'une question : des caractères qui partagent un composant avec la
 * réponse, jamais la réponse elle-même. À défaut de voisins, on complète avec les
 * caractères de la famille (`secours`), et jamais avec un caractère sans rapport :
 * mieux vaut trois choix qu'un leurre qui n'apprend rien.
 */
export function leurres(
  reponse: Voisin,
  pool: readonly Voisin[],
  combien: number,
  graine: number,
  secours: readonly Voisin[] = []
): Voisin[] {
  const pris = melanger(pool.filter((v) => proche(v, reponse)), graine).slice(0, combien);
  if (pris.length >= combien) return pris;
  const reste = secours.filter((v) => v.c !== reponse.c && !pris.some((x) => x.c === v.c));
  return [...pris, ...melanger(reste, graine + 1).slice(0, combien - pris.length)];
}

/* ---------- les questions ---------- */

function voisin(v: Voisins, c: string): Voisin | null {
  return v.voisins.find((x) => x.c === c) ?? null;
}

/** Place la bonne réponse parmi les leurres, sans jamais la poser deux fois. */
function choix(bonne: string, faux: readonly string[], graine: number): { opts: string[]; ok: number } {
  const distincts = [...new Set(faux.filter((x) => x !== bonne))];
  const opts = melanger([bonne, ...distincts], graine);
  return { opts, ok: opts.indexOf(bonne) };
}

/**
 * La vérification du jour : ce qui vient d'être vu, et rien d'autre. Deux ou trois
 * questions sur la brique et son composé, dans l'ordre sens, caractère, assemblage.
 * Une question est écartée si la liste des voisins ne porte pas son caractère.
 */
export function questions(f: Famille, v: Voisins, graine: number): Question[] {
  const racine = f.fiches.find((x) => x.c === f.racine.c) ?? null;
  const compo = f.fiches.find((x) => x.c !== f.racine.c) ?? null;
  /* Le secours, quand les voisins manquent : les caractères de la famille. */
  const famille = f.fiches.flatMap((x) => {
    const w = voisin(v, x.c);
    return w ? [w] : [];
  });
  const q: Question[] = [];

  /* 1. Le sens du composé : les leurres donnent les autres sens possibles. */
  const cible = compo ? voisin(v, compo.c) : null;
  if (compo && cible) {
    const faux = leurres(cible, v.voisins, CHOIX - 1, graine, famille).map((x) => x.fr);
    const { opts, ok } = choix(cible.fr, faux, graine + 7);
    q.push({
      type: 'sens',
      label: 'Sens',
      c: compo.c,
      ask: 'Que veut dire ce caractère ?',
      parts: [],
      opts,
      caracteres: false,
      ok,
      why: compo.origine_fr
    });
  }

  /* 2. Le caractère à partir du sens, sur la brique de la session. */
  const base = racine ? voisin(v, racine.c) : null;
  if (racine && base) {
    const faux = leurres(base, v.voisins, CHOIX - 1, graine + 2, famille).map((x) => x.c);
    const { opts, ok } = choix(base.c, faux, graine + 11);
    q.push({
      type: 'char',
      label: 'Caractère',
      c: racine.c,
      ask: `Lequel veut dire « ${base.fr} » ?`,
      parts: [],
      opts,
      caracteres: true,
      ok,
      why: racine.origine_fr
    });
  }

  /* 3. L'assemblage des briques du composé. */
  if (compo && cible) {
    const faux = leurres(cible, v.voisins, CHOIX - 1, graine + 3, famille).map((x) => x.c);
    const { opts, ok } = choix(cible.c, faux, graine + 13);
    q.push({
      type: 'parts',
      label: 'Assemblage',
      c: compo.c,
      ask: 'Assemble les briques.',
      parts: compo.parts,
      opts,
      caracteres: true,
      ok,
      why: compo.origine_fr
    });
  }

  return q;
}
