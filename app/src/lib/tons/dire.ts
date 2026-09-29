/**
 * « Dis-le » (story 9.1) : la question où l'on prononce un caractère acquis, et l'app
 * reconnaît le ton sur l'appareil (`classifieur.ts`, `pitch.ts`).
 *
 * Les règles, toutes ici et testées (`dire.test.ts`), module pur :
 *
 * - un caractère isolé déjà acquis, dont la lecture principale est connue et porte l'un des
 *   quatre tons (un caractère isolé n'a pas de ton neutre) ; il a un sens à montrer ;
 * - au plus une question « Dis-le » par séance, à la place de la question d'une carte de la
 *   pile, jamais si le réglage est éteint, le micro refusé ou absent, ou le modèle absent ;
 * - le ton reconnu : la carte est notée « Bien » (jamais « Facile » : la reconnaissance n'est
 *   pas encore mesurée sur des voix d'apprenants), et un point 说 ;
 * - un autre ton, une confiance basse, un silence : rien n'est noté, on redemande, trois
 *   fois au plus, puis on passe sans rien noter. La carte reste due ;
 * - l'essai des Réglages ne note jamais rien.
 *
 * Les phrases viennent du pipeline (`ecrans.json`, écran `dire`) : rien n'est rédigé ici,
 * `messageDire` les assemble. La courbe du modèle est la forme canonique du ton attendu
 * (Chao), jamais l'audio de l'app, dont les tons isolés sont peu marqués (étude du 29
 * septembre 2026, §4).
 */
import type { TextesDire } from '../ecrans';
import { remplir } from '../ecrans';
import type { Fiche } from '../content';
import { estAcquis, fiche, hachage, premierSens, syllabesDuTon, tonDe, type Corpus, type Question } from '../questions';
import type { Revision } from '../session';
import type { Contour, Etat, Probleme, Ton, Verdict } from './classifieur';

/** Trois essais au plus, puis on passe, sans rien noter. */
export const ESSAIS_DIRE = 3;

/** Ce qu'il faut pour poser « Dis-le » sur un caractère. */
export type CibleDire = {
  c: string;
  /** Le ton de la lecture principale, 1 à 4. */
  ton: 1 | 2 | 3 | 4;
  /** La lecture principale, accentuée : montrée seulement après la réponse. */
  pinyin: string;
  /** Le premier sens de la fiche. */
  sens: string;
};

/**
 * La cible « Dis-le » d'une fiche, ou `null` : pas de sens, une lecture principale mal
 * connue (un polyphone dont l'export ne dit pas toutes les lectures), une syllabe qui n'est
 * pas simple, ou le ton neutre.
 */
export function cibleDeFiche(f: Fiche): CibleDire | null {
  const sens = premierSens(f.fr);
  const s = syllabesDuTon(f);
  if (sens === '' || s === null) return null;
  const ton = tonDe(s.bonne);
  if (ton < 1 || ton > 4) return null;
  return { c: f.c, ton: ton as 1 | 2 | 3 | 4, pinyin: s.bonne, sens };
}

/** La cible d'un caractère du corpus, s'il est acquis. */
export function cibleDire(c: string, corpus: Corpus): CibleDire | null {
  const f = fiche(c, corpus);
  if (f === null || !estAcquis(c, corpus)) return null;
  return cibleDeFiche(f);
}

/** Ce qui permet la question : le réglage, le micro, le modèle. */
export type PermisDire = { reglage: boolean; micro: boolean; modele: boolean };

/**
 * La question de la séance qui devient « Dis-le » : l'une de celles dont le caractère est
 * une cible, tirée d'après la graine (la même séance, la même question). `null` si rien ne
 * le permet. Une seule par séance.
 */
export function choisirDire(
  questions: readonly Question[],
  corpus: Corpus,
  graine: string,
  permis: PermisDire
): number | null {
  if (!permis.reglage || !permis.micro || !permis.modele) return null;
  const rangs = questions.flatMap((q, i) => (cibleDire(q.c, corpus) === null ? [] : [i]));
  if (rangs.length === 0) return null;
  return rangs[hachage(`${graine}/dire`) % rangs.length];
}

/**
 * L'essai des Réglages : un caractère acquis au hasard (`alea` entre 0 et 1). Faute
 * d'acquis, un caractère rencontré (une carte), puis n'importe quelle fiche : l'essai sert
 * à entendre le micro, et ne note rien.
 */
export function cibleDEssai(corpus: Corpus, cartes: readonly string[], alea: number): CibleDire | null {
  const toutes = corpus.fiches.map(cibleDeFiche).filter((x): x is CibleDire => x !== null);
  const acquises = toutes.filter((x) => estAcquis(x.c, corpus));
  const rencontrees = toutes.filter((x) => cartes.includes(x.c));
  const pool = acquises.length > 0 ? acquises : rencontrees.length > 0 ? rencontrees : toutes;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, alea) * pool.length))];
}

/* ---------- la notation ---------- */

/** Ce que l'app fait d'un essai : noter, redemander, ou passer sans rien noter. */
export type Issue = 'note' | 'redemander' | 'passer';

/**
 * L'issue de l'essai `essai` (1 pour le premier) : le ton reconnu est noté ; un autre ton,
 * une confiance basse ou un enregistrement inanalysable redemandent, jusqu'au troisième
 * essai, puis on passe. Aucun cas ne note faux.
 */
export function issueDire(etat: Etat | null, essai: number): Issue {
  if (etat === 'juste') return 'note';
  return essai >= ESSAIS_DIRE ? 'passer' : 'redemander';
}

/**
 * L'événement noté quand le ton est reconnu : juste du premier coup, jamais plus que
 * « Bien » (`auMieuxBien`), et un point 说, l'art des tons.
 */
export function revisionDire(c: string, seconds: number): Revision {
  return { c, correct: true, tries: 0, seconds, auMieuxBien: true, art: 'shuo' };
}

/* ---------- la courbe ---------- */

/**
 * Les tons en degrés de Chao, point par point (instant de 0 à 1, degré de 1 à 5) : les
 * formes de l'étude (55, 35 avec son petit creux, 214, 51 avec son palier bref).
 */
export const FORMES: Readonly<Record<Ton, readonly (readonly [number, number])[]>> = {
  1: [[0, 5], [1, 5]],
  2: [[0, 3], [0.3, 2.7], [1, 5]],
  3: [[0, 2.5], [0.55, 1], [1, 3.8]],
  4: [[0, 4.7], [0.12, 5], [1, 1.5]],
  5: [[0, 2.8], [1, 2]]
};

/** Demi-tons par degré de Chao, et le degré moyen d'une voix, tons mêlés. */
export const DEMI_TONS_PAR_DEGRE = 2.5;
export const DEGRE_MOYEN = 3.2;

/** La forme canonique d'un ton en `n` points, en demi-tons autour de la moyenne de la voix. */
export function courbeModele(ton: Ton, n = 30): number[] {
  const pts = FORMES[ton];
  return Array.from({ length: n }, (_, i) => {
    const u = n === 1 ? 0 : i / (n - 1);
    let k = 0;
    while (k < pts.length - 2 && u > pts[k + 1][0]) k++;
    const [u0, v0] = pts[k];
    const [u1, v1] = pts[k + 1];
    const v = v0 + ((u - u0) / (u1 - u0)) * (v1 - v0);
    return (v - DEGRE_MOYEN) * DEMI_TONS_PAR_DEGRE;
  });
}

/**
 * Les deux courbes à superposer, en demi-tons : la voix (sa forme, posée à son registre
 * quand la voix de l'apprenant est connue) et le modèle. Sans référence de voix, la hauteur
 * ne se lit pas : les deux courbes sont centrées, on compare leurs formes.
 */
export function courbes(contour: Contour | null, ton: Ton, ref: number | undefined): { voix: number[] | null; modele: number[] } {
  const modele = courbeModele(ton);
  if (ref === undefined || ref <= 0) {
    const m = modele.reduce((s, v) => s + v, 0) / modele.length;
    return { voix: contour ? [...contour.points] : null, modele: modele.map((v) => v - m) };
  }
  const registre = contour ? 12 * Math.log2(contour.moyenne / ref) : 0;
  return { voix: contour ? contour.points.map((v) => v + registre) : null, modele };
}

/* ---------- les phrases ---------- */

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Le nom d'un ton (« ton 3 », « ton neutre »), tel que le pipeline l'écrit. */
export function nomTon(t: TextesDire, ton: Ton): string {
  return t[`nom-${ton}`];
}

/** Le conseil d'un couple (attendu, entendu), vide s'il n'y en a pas. */
export function conseil(t: TextesDire, attendu: Ton, entendu: Ton): string {
  if (attendu === 5 || attendu === entendu) return '';
  return t[`conseil-${attendu}-${entendu}` as keyof TextesDire] ?? '';
}

/**
 * La phrase qui suit l'essai : le ton reconnu nommé par sa forme ; un autre ton sûr, avec
 * un conseil qui dit quoi faire ; sinon, on redemande, avec la raison quand on la sait.
 * Jamais un reproche (`wenlu check` le vérifie sur les textes, `dire.test.ts` sur leur
 * assemblage).
 */
export function messageDire(t: TextesDire, v: Verdict | null, probleme: Probleme | null): string {
  if (probleme !== null) return t[probleme];
  if (v === null || v.etat === 'redemander' || v.entendu === null) return t.redemander;
  if (v.etat === 'juste') {
    return majuscule(remplir(t.juste, { nom: nomTon(t, v.attendu), allure: t[`allure-${v.attendu}`] }));
  }
  const phrase = remplir(t.autre, {
    attendu: nomTon(t, v.attendu),
    allure: t[`allure-${v.entendu}`],
    entendu: nomTon(t, v.entendu)
  });
  return [majuscule(phrase), conseil(t, v.attendu, v.entendu)].filter((x) => x !== '').join(' ');
}
