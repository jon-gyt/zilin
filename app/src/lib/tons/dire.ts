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
 * - l'essai des Réglages ne note jamais rien ;
 * - un mot de deux caractères acquis (un mot de la fiche de la carte), seulement si la mesure
 *   le justifie (`MOTS_DIRE`, éteint aujourd'hui) : la voix est coupée en deux syllabes, le
 *   ton de chacune reconnu ; l'app attend les tons que la voix fait, sandhi appliqué (deux
 *   tons 3 de suite : le premier au ton 2 ; 不 devant un ton 4 : au ton 2), et le dit sans
 *   reproche ; la seconde syllabe peut être au ton neutre. Reconnu : la carte est notée
 *   « Bien », comme pour un caractère.
 *
 * Les phrases viennent du pipeline (`ecrans.json`, écran `dire`) : rien n'est rédigé ici,
 * `messageDire` les assemble. La courbe du modèle est la forme canonique du ton attendu
 * (Chao), jamais l'audio de l'app, dont les tons isolés sont peu marqués (étude du 29
 * septembre 2026, §4).
 */
import type { TextesDire, TextesDireMots } from '../ecrans';
import { CLES_DIRE_MOTS, remplir } from '../ecrans';
import type { Fiche, Mot } from '../content';
import { syllabes as syllabesPinyin } from '../lecture';
import { estAcquis, fiche, hachage, premierSens, syllabesDuTon, tonDe, type Corpus, type Question } from '../questions';
import type { Revision } from '../session';
import type { Contour, Etat, Probleme, Ton, Verdict } from './classifieur';

/** Trois essais au plus, puis on passe, sans rien noter. */
export const ESSAIS_DIRE = 3;

/**
 * Les mots de deux syllabes (30 septembre 2026). La question de mot ne se pose que si la
 * reconnaissance, mesurée sur des mots natifs d'une voix jamais vue à l'entraînement, passe
 * ces seuils : un mot dit juste est reconnu au moins 8 fois sur 10 (les caractères : 88,6 %),
 * l'app n'affirme un autre ton à tort qu'au plus 3 fois sur 100, et elle ne reconnaît un
 * mot que l'on n'a pas dit qu'au plus 3 fois sur 100 (`data/sources/tons/PROVENANCE.md`).
 */
export const SEUILS_MOTS_DIRE = { reconnu: 0.8, autreATort: 0.03, reconnuATort: 0.03 } as const;

/**
 * La mesure du 30 septembre 2026 : 3 061 mots de deux syllabes de Yue Tan (hugolpz/audio-cmn,
 * test, la moitié jamais vue pendant les réglages), voix calibrée sur ses caractères isolés,
 * code de l'app. 67,5 % reconnus, 2,1 % d'autres tons affirmés à tort, 1,7 % reconnus à tort
 * quand un autre ton est attendu ; le ton de chaque syllabe en tête : 85,4 %.
 */
export const MESURE_MOTS_DIRE = { reconnu: 0.675, autreATort: 0.021, reconnuATort: 0.017 } as const;

/** La mesure passe-t-elle les seuils ? */
export function motsJustifies(
  m: { reconnu: number; autreATort: number; reconnuATort: number } = MESURE_MOTS_DIRE,
  s: { reconnu: number; autreATort: number; reconnuATort: number } = SEUILS_MOTS_DIRE
): boolean {
  return m.reconnu >= s.reconnu && m.autreATort <= s.autreATort && m.reconnuATort <= s.reconnuATort;
}

/**
 * La question de mot, allumée seulement si la mesure le justifie : éteinte aujourd'hui
 * (67,5 % reconnus, sous les 80 %). Le code est prêt ; une meilleure mesure l'allume.
 */
export const MOTS_DIRE: boolean = motsJustifies();

/** Ce qui change le ton d'une syllabe dans un mot : deux tons 3 de suite, 不 devant un ton 4. */
export type Sandhi = 'trois-trois' | 'bu' | null;

/** Un mot de deux caractères à dire. */
export type CibleMot = {
  /** La carte de la séance, celle que « Bien » note : le caractère dont la fiche porte le mot. */
  carte: string;
  /** Les syllabes, accentuées comme le dictionnaire les écrit. */
  syllabes: string[];
  /** Les tons du dictionnaire (5 : neutre). */
  dico: Ton[];
  /** Les tons que la voix doit faire, sandhi appliqué : ceux que l'app attend. */
  attendus: Ton[];
  sandhi: Sandhi;
  /** Pour chaque frontière, la syllabe suivante commence-t-elle par une voix (`segmenter`) ? */
  liees: boolean[];
};

/** Ce qu'il faut pour poser « Dis-le » sur un caractère, ou sur un mot (`mot`). */
export type CibleDire = {
  /** Ce qu'on dit : un caractère, ou les deux caractères d'un mot. */
  c: string;
  /** Le ton de la lecture principale, 1 à 4 ; d'un mot, celui de sa première syllabe. */
  ton: 1 | 2 | 3 | 4;
  /** La lecture principale, accentuée : montrée seulement après la réponse. */
  pinyin: string;
  /** Le premier sens de la fiche, ou du mot. */
  sens: string;
  mot?: CibleMot;
};

/** Le ton d'une syllabe de pinyin, le neutre (sans marque) valant 5. */
export function tonSyllabe(s: string): Ton {
  const t = tonDe(s);
  return (t === 0 ? 5 : t) as Ton;
}

/**
 * Les tons que la voix fait dans un mot de deux syllabes : deux tons 3 de suite, le premier
 * se dit au ton 2 (你好 nǐ hǎo se dit ní hǎo) ; 不 devant un ton 4 se dit au ton 2 (不用).
 */
export function tonsDeSurface(hanzi: string, dico: readonly Ton[]): { attendus: Ton[]; sandhi: Sandhi } {
  const [a, b] = dico;
  if ([...hanzi][0] === '不' && a === 4 && b === 4) return { attendus: [2, 4], sandhi: 'bu' };
  if (a === 3 && b === 3) return { attendus: [2, 3], sandhi: 'trois-trois' };
  return { attendus: [...dico], sandhi: null };
}

/** Une syllabe qui commence par une voix : m, n, l, r, y, w ou une voyelle. */
export function commenceVoisee(s: string): boolean {
  const nue = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return /^[mnlrywaoe]/.test(nue);
}

/**
 * La cible d'un mot de fiche : deux caractères, tous deux acquis ; deux syllabes de pinyin
 * lisibles, la première jamais au ton neutre ; un sens. 一 en tête est écarté : son ton dans
 * le mot dépend de son emploi (一月 yīyuè, 一样 yíyàng), que le pinyin du dictionnaire ne dit
 * pas.
 */
export function cibleDeMot(m: Mot, carte: string, corpus: Corpus): CibleDire | null {
  const cs = [...m.hanzi];
  if (cs.length !== 2 || cs[0] === '一' || !cs.every((c) => estAcquis(c, corpus))) return null;
  const s = syllabesPinyin(m.pinyin);
  const sens = premierSens(m.fr);
  if (s === null || s.length !== 2 || s.includes('r') || sens === '') return null;
  const dico = s.map(tonSyllabe);
  if (dico[0] === 5) return null;
  const { attendus, sandhi } = tonsDeSurface(m.hanzi, dico);
  return {
    c: m.hanzi,
    ton: attendus[0] as 1 | 2 | 3 | 4,
    pinyin: s.join(' '),
    sens,
    mot: { carte, syllabes: s, dico, attendus, sandhi, liees: s.slice(1).map(commenceVoisee) }
  };
}

/** Les mots de la fiche de `c` que « Dis-le » peut demander. */
export function motsDire(c: string, corpus: Corpus): CibleDire[] {
  const f = fiche(c, corpus);
  if (f === null) return [];
  return f.mots.map((m) => cibleDeMot(m, c, corpus)).filter((x): x is CibleDire => x !== null);
}

/** Les textes des mots sont tous là (un export d'avant ne les porte pas). */
export function motsLisibles(t: TextesDireMots): boolean {
  return CLES_DIRE_MOTS.every((k) => t[k] !== '');
}

/** Les tons qu'attend une cible : le sien, ou ceux de la voix sur le mot. */
export function attendusDe(c: CibleDire): Ton[] {
  return c.mot ? c.mot.attendus : [c.ton];
}

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

/**
 * La cible d'un caractère du corpus, s'il est acquis. Avec les mots (`mots`, et une graine),
 * une séance sur deux demande plutôt l'un des mots de sa fiche dont les deux caractères sont
 * acquis ; la carte notée reste celle du caractère.
 */
export function cibleDire(c: string, corpus: Corpus, graine?: string, mots = MOTS_DIRE): CibleDire | null {
  const f = fiche(c, corpus);
  if (f === null || !estAcquis(c, corpus)) return null;
  const car = cibleDeFiche(f);
  if (car === null || !mots || graine === undefined || hachage(`${graine}/mot`) % 2 !== 0) return car;
  const ms = motsDire(c, corpus);
  return ms.length === 0 ? car : ms[hachage(`${graine}/mot/${c}`) % ms.length];
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
export function cibleDEssai(corpus: Corpus, cartes: readonly string[], alea: number, mots = MOTS_DIRE): CibleDire | null {
  const toutes = corpus.fiches.map(cibleDeFiche).filter((x): x is CibleDire => x !== null);
  const acquises = [
    ...toutes.filter((x) => estAcquis(x.c, corpus)),
    ...(mots ? corpus.fiches.filter((f) => estAcquis(f.c, corpus)).flatMap((f) => motsDire(f.c, corpus)) : [])
  ];
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

/** `n` points équidistants d'une courbe. */
function reduire(v: readonly number[], n: number): number[] {
  return Array.from({ length: n }, (_, i) => v[Math.round((i * (v.length - 1)) / Math.max(1, n - 1))]);
}

/**
 * Les courbes d'un mot : ses syllabes l'une après l'autre, quinze points chacune. La voix
 * garde la hauteur de chaque syllabe face à celle de l'apprenant (ou, sans elle, face au mot
 * entier : la seconde plus haute ou plus basse que la première se voit) ; le modèle enchaîne
 * les formes des tons attendus, sandhi appliqué.
 */
export function courbesMot(
  contours: readonly Contour[] | null,
  attendus: readonly Ton[],
  ref: number | undefined
): { voix: number[] | null; modele: number[] } {
  const connue = ref !== undefined && ref > 0;
  const brut = attendus.flatMap((t) => courbeModele(t, 15));
  const m = brut.reduce((s, v) => s + v, 0) / brut.length;
  const modele = connue ? brut : brut.map((v) => v - m);
  if (contours === null || contours.length !== attendus.length) return { voix: null, modele };
  const base = connue ? ref : Math.pow(2, contours.reduce((s, c) => s + Math.log2(c.moyenne), 0) / contours.length);
  const voix = contours.flatMap((c) => reduire(c.points, 15).map((v) => v + 12 * Math.log2(c.moyenne / base)));
  return { voix, modele };
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

/* ---------- les phrases d'un mot ---------- */

/** Les tons d'un mot nommés l'un après l'autre : « ton 2 puis ton 3 ». */
export function nomsTons(t: TextesDire, tm: TextesDireMots, tons: readonly Ton[]): string {
  return tons.map((x) => nomTon(t, x)).join(` ${tm.puis} `);
}

/** Le conseil d'une syllabe de mot : celui du caractère, ou celui du ton neutre attendu. */
export function conseilMot(t: TextesDire, tm: TextesDireMots, attendu: Ton, entendu: Ton): string {
  if (attendu === entendu) return '';
  return attendu === 5 ? tm['conseil-5'] : conseil(t, attendu, entendu);
}

/**
 * Ce que le mot a de particulier, dit sans reproche après un essai : le ton que la voix doit
 * faire n'est pas celui du dictionnaire (sandhi), ou la seconde syllabe est au ton neutre.
 */
export function notesMot(tm: TextesDireMots, m: CibleMot): string[] {
  const out: string[] = [];
  if (m.sandhi === 'trois-trois') out.push(tm['sandhi-33']);
  if (m.sandhi === 'bu') out.push(tm['sandhi-bu']);
  if (m.attendus[1] === 5) out.push(tm.neutre);
  return out;
}

/**
 * La phrase qui suit l'essai d'un mot : les deux tons reconnus, nommés ; un autre ton sûr sur
 * une syllabe, nommée par son rang, avec son conseil ; sinon on redemande. Puis, après tout
 * essai analysé, ce que le mot a de particulier (`notesMot`). Jamais un reproche.
 */
export function messageDireMot(
  t: TextesDire,
  tm: TextesDireMots,
  m: CibleMot,
  verdicts: readonly Verdict[] | null,
  etat: Etat | null,
  probleme: Probleme | null
): string {
  if (probleme !== null) return t[probleme];
  const notes = notesMot(tm, m);
  if (verdicts === null || etat === null || etat === 'redemander') return [t.redemander, ...notes].join(' ');
  if (etat === 'juste') return [majuscule(remplir(tm['juste-mot'], { noms: nomsTons(t, tm, m.attendus) })), ...notes].join(' ');
  const k = verdicts.findIndex((v) => v.etat === 'autre' && v.entendu !== null);
  const v = verdicts[k];
  if (k < 0 || v.entendu === null) return [t.redemander, ...notes].join(' ');
  const phrase = remplir(tm['autre-mot'], {
    rang: tm[`rang-${k + 1}` as 'rang-1' | 'rang-2'] ?? '',
    attendu: nomTon(t, v.attendu),
    allure: t[`allure-${v.entendu}`],
    entendu: nomTon(t, v.entendu)
  });
  return [majuscule(phrase), conseilMot(t, tm, v.attendu, v.entendu), ...notes].filter((x) => x !== '').join(' ');
}
