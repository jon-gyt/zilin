/**
 * La chaîne 链 : une chaîne de mots, chacun commence où l'autre finit (火车 → 车站 → 站长).
 *
 * Décision du propriétaire du 30 septembre 2026 : l'ancienne chaîne, où l'on repérait un
 * caractère caché dans un autre, « ne sert à rien » ; on n'y lisait ni sens ni son, et
 * l'assemblage et les jumeaux le font déjà. La chaîne fait maintenant relire des mots : à
 * chaque maillon, un mot se lit, on choisit son sens parmi quatre, et la correction dit
 * son pinyin et son sens entier. Le mot d'avant reste visible : son dernier caractère est
 * le premier du nouveau.
 *
 * Aucun mot n'est écrit ici. Les mots sont ceux des fiches de l'export (`mots`, tels que le
 * contenu les donne, surcouchés compris) : des mots déjà lus, le jour où la fiche de l'un
 * de leurs caractères a été apprise. Un mot n'entre dans la chaîne que si tous ses
 * caractères sont acquis (stabilité FSRS au seuil de `srs.ts`, jamais l'acquis de
 * démonstration) et dessinables, et s'il a un sens français.
 *
 * La note : une bonne réponse note les caractères du mot, comme l'éclair (`c` le premier,
 * `aussi` les autres). Une mauvaise note, elle aussi, mais seulement le caractère dont la
 * fiche a fait lire le mot (`fautifs`) : un mot déjà lu mal compris est une vraie erreur
 * de lecture, celle de la fiche qui l'a appris ; l'autre caractère, lu ailleurs, n'est
 * pas en cause (rater 大水 ne dit pas qu'on a oublié 水).
 *
 * Module pur, comme `jeux.ts` : aucune horloge, aucun `Math.random`, aucun stockage. Tout
 * tirage part d'une graine : la même graine rend toujours la même manche.
 */
import type { Famille, Fiche } from './content';
import type { CorpusJeux, Tour } from './jeux';
import {
  acquis as acquisDesCartes,
  citeUnCaractere,
  hachage,
  melange,
  sensDuChoix,
  type Acquis
} from './questions';

/* ---------- les constantes ---------- */

/** Quatre sens à l'écran : le bon et trois leurres, comme à l'éclair. */
export const PROPOSITIONS_CHAINE = 4;

/** Le temps de lecture d'un mot, celui d'un mot de l'éclair au pas Utiliser (`utiliser.SECONDES_VUE`). */
export const SECONDES_PAR_MOT = 20;

/** Trois minutes de lecture au plus : neuf mots, le premier compris. */
export const MAILLONS_MAX = (3 * 60) / SECONDES_PAR_MOT;

/** Le budget de la recherche : de quoi explorer l'acquis d'un parcours entier, sans attendre. */
const BUDGET_CHAINE = 4_000;

/** Ce qu'on demande : le sens du mot, comme au dictionnaire éclair. */
export const ENONCE_CHAINE = 'Que veut dire ce mot ?';

/** Quand une chaîne s'arrête avant la fin de la manche, une autre repart, et l'énoncé le dit. */
export const ENONCE_AUTRE_CHAINE = 'Une autre chaîne repart. Que veut dire ce mot ?';

/**
 * Le dragon ne se montre qu'au Nouvel An et à la fête des bateaux-dragons (CLAUDE.md) :
 * ses mots (龙年, 龙舟…) ne se lisent que dans le dictionnaire et dans son conte, jamais
 * dans un jeu.
 */
const HORS_JEU = ['龙'];

/* ---------- le contenu ---------- */

/** Un mot des fiches, et les caractères dont la fiche l'a fait lire (`porteurs`). */
export type MotChaine = {
  hanzi: string;
  pinyin: string;
  fr: string;
  /** Le sens anglais : il aide à juger deux sens trop proches, jamais montré. */
  en: string;
  /** Les caractères du mot dont la fiche porte ce mot : c'est là qu'il a été lu. */
  porteurs: string[];
};

/** Ce que la chaîne lit, en plus du corpus commun des jeux. */
export type MotsDeChaine = {
  mots: readonly MotChaine[];
  /** L'acquis réel : les cartes au seuil de stabilité. Jamais l'acquis de démonstration. */
  acquis: readonly string[];
};

/** Les sources de la chaîne : les fiches (surcouchées d'abord), les familles, les cartes. */
export type SourcesChaine = {
  fiches?: readonly Fiche[];
  familles?: readonly Famille[];
  cartes?: readonly Acquis[];
  seuil?: number;
};

const HAN = /^\p{Script=Han}$/u;

/**
 * Les mots des fiches, une fois chacun : le premier sens rencontré (les fiches surcouchées
 * passent avant les familles brutes), et tous les caractères du mot dont une fiche le porte.
 * Un mot sans sens, ou qui n'est pas fait de caractères, est écarté.
 */
export function motsDesFiches(fiches: readonly Fiche[], familles: readonly Famille[]): MotChaine[] {
  const out = new Map<string, MotChaine>();
  for (const f of [...fiches, ...familles.flatMap((x) => x.fiches)]) {
    for (const m of f.mots ?? []) {
      const signes = [...m.hanzi];
      if (signes.length < 2 || !signes.every((c) => HAN.test(c)) || m.fr.trim() === '') continue;
      const deja = out.get(m.hanzi);
      const porte = signes.includes(f.c);
      if (deja) {
        if (porte && !deja.porteurs.includes(f.c)) deja.porteurs.push(f.c);
      } else {
        out.set(m.hanzi, {
          hanzi: m.hanzi,
          pinyin: m.pinyin,
          fr: m.fr.trim(),
          en: (m.en ?? '').trim(),
          porteurs: porte ? [f.c] : []
        });
      }
    }
  }
  return [...out.values()];
}

/** Les mots de la chaîne. `null` sans aucun mot : le jeu se tait. */
export function motsDeChaine(s: SourcesChaine): MotsDeChaine | null {
  const mots = motsDesFiches(s.fiches ?? [], s.familles ?? []);
  if (mots.length === 0) return null;
  return {
    mots,
    acquis: acquisDesCartes({ fiches: [], decompositions: {}, acquis: s.cartes ?? [], seuil: s.seuil })
  };
}

/* ---------- les mots qui peuvent se lire ---------- */

/** Le premier et le dernier caractère d'un mot : ce qui le relie aux autres. */
export function premier(mot: string): string {
  return [...mot][0] ?? '';
}
export function dernier(mot: string): string {
  const s = [...mot];
  return s[s.length - 1] ?? '';
}

/** Deux mots se suivent quand le dernier caractère de l'un est le premier de l'autre. */
export function seSuivent(a: string, b: string): boolean {
  return a !== b && dernier(a) !== '' && dernier(a) === premier(b);
}

/**
 * Les mots qui peuvent se poser : tous leurs caractères acquis (l'acquis réel) et
 * dessinables, lus dans la fiche de l'un de leurs caractères, jamais un mot du dragon.
 * L'ordre est celui des fiches.
 */
export function motsPossibles(corpus: CorpusJeux): MotChaine[] {
  const d = corpus.chaine;
  if (!d) return [];
  const acquis = new Set(d.acquis);
  const montrables = new Set(corpus.traits);
  return d.mots.filter((m) => {
    const signes = [...m.hanzi];
    return (
      signes.every((c) => acquis.has(c) && montrables.has(c) && !HORS_JEU.includes(c)) &&
      m.porteurs.some((c) => acquis.has(c))
    );
  });
}

/** Le mot d'un tour, tel que le contenu le donne. */
export function motDuTour(t: Tour, corpus: CorpusJeux): MotChaine | null {
  return t.maillon === undefined ? null : motDe(t.maillon, corpus);
}

/** Un mot de la chaîne par son écriture. */
export function motDe(hanzi: string, corpus: CorpusJeux): MotChaine | null {
  return corpus.chaine?.mots.find((m) => m.hanzi === hanzi) ?? null;
}

/* ---------- les sens trop proches ---------- */

/** Un sens tel que les fiches le donnent, en français et en anglais. */
export type Sens = { fr: string; en: string };

/**
 * Les mots vides d'un sens, en français et en anglais : ils ne rapprochent pas deux sens
 * (« faire un tour » et « faire attention », « to be late » et « to be born »).
 */
const VIDES = new Set([
  'les', 'des', 'une', 'par', 'sur', 'qui', 'que', 'est', 'son', 'ses', 'aux', 'pas', 'mes',
  'tes', 'nos', 'vos', 'lui', 'eux', 'avec', 'dans', 'pour', 'sans', 'sous', 'vers', 'chez',
  'entre', 'apres', 'avant', 'plus', 'tres', 'bien', 'tout', 'toute', 'tous', 'toutes',
  'faire', 'etre', 'avoir', 'autre', 'autres', 'comme', 'encore', 'deja', 'aussi', 'leur',
  'leurs', 'cette', 'celui', 'celle', 'quelque', 'quelqu', 'chose', 'choses', 'quand',
  'donc', 'mais', 'dont', 'votre', 'notre', 'the', 'and', 'for', 'with', 'from', 'into',
  'out', 'off', 'one', 'ones', 'someone', 'something', 'somebody', 'that', 'this', 'very',
  'make', 'have', 'take', 'get', 'give', 'put', 'not', 'all', 'its', 'his', 'her', 'their',
  'every', 'each', 'some', 'any', 'other', 'more', 'most', 'much', 'such', 'than', 'then',
  'also', 'only', 'just'
]);

/**
 * Les racines d'un sens : ses mots pleins, sans accent ni pluriel, réduits à leurs cinq
 * premières lettres (« amies » et « ami », « grandement » et « grand »).
 */
const lesRacines = new Map<string, string[]>();

function racines(sens: string): string[] {
  const deja = lesRacines.get(sens);
  if (deja) return deja;
  const r = calculerRacines(sens);
  lesRacines.set(sens, r);
  return r;
}

function calculerRacines(sens: string): string[] {
  return sensDuChoix(sens)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z]+/)
    .filter((x) => x.length >= 3 && !VIDES.has(x))
    .map((x) => {
      const sans = x.length > 3 ? x.replace(/e?s$/, '').replace(/e$/, '') : x;
      return (sans.length >= 3 ? sans : x).slice(0, 5);
    });
}

function partagent(a: string, b: string): boolean {
  const ra = racines(a);
  return racines(b).some((r) => ra.includes(r));
}

/**
 * Deux sens trop proches pour se côtoyer à l'écran : le même, ou un mot plein en commun,
 * à la racine près, en français ou en anglais (« ami » et « ami proche », « to miss » et
 * « to miss someone », « grand » et « grandement »). L'un désignerait l'autre, ou les deux
 * se valent : on ne choisirait plus en lisant le mot.
 */
export function sensProches(a: Sens, b: Sens): boolean {
  if (sensDuChoix(a.fr).toLowerCase() === sensDuChoix(b.fr).toLowerCase()) return true;
  return partagent(a.fr, b.fr) || (a.en !== '' && b.en !== '' && partagent(a.en, b.en));
}

/* ---------- la chaîne la plus longue ---------- */

/**
 * Un mot n'est un maillon que s'il a de quoi poser trois leurres : trois autres mots
 * possibles dont les sens ne sont proches ni du sien, ni entre eux.
 */
function posable(m: MotChaine, pool: readonly MotChaine[]): boolean {
  const pris: Sens[] = [m];
  const nature = citeUnCaractere(sensDuChoix(m.fr));
  for (const x of pool) {
    if (x.hanzi === m.hanzi || citeUnCaractere(sensDuChoix(x.fr)) !== nature) continue;
    if (pris.some((s) => sensProches(s, x))) continue;
    pris.push(x);
    if (pris.length >= PROPOSITIONS_CHAINE) return true;
  }
  return false;
}

/**
 * La chaîne la plus longue que l'acquis permet, à graine égale toujours la même.
 *
 * Un lien : le dernier caractère d'un mot est le premier du suivant. Jamais deux fois le
 * même mot, ni deux mots de même sens, ni un mot de `exclus` (ceux des chaînes déjà posées
 * dans la manche) ou de même sens qu'eux. La
 * recherche essaie les départs dans un ordre fixé par la graine, les suites les plus
 * reliées d'abord (la graine départage), garde la plus longue, et s'arrête à
 * `MAILLONS_MAX` mots ou au bout de son budget. C'est l'acquis qui borne la chaîne.
 */
export function chaineDeMots(
  corpus: CorpusJeux,
  graine: string,
  exclus: ReadonlySet<string> = new Set()
): string[] {
  const tous = motsPossibles(corpus);
  const parMot = new Map(tous.map((m) => [m.hanzi, m]));
  /* Deux mots de même sens ne se suivent pas dans une manche (朋友 puis 友人, « ami » deux
     fois) : le second se répondrait de mémoire, sans le lire. */
  const memeSens = (a: string, b: string): boolean => {
    const x = parMot.get(a);
    const y = parMot.get(b);
    return x !== undefined && y !== undefined && sensProches(x, y);
  };
  const deja = [...exclus];
  const mots = tous
    .filter((m) => !exclus.has(m.hanzi) && !deja.some((w) => memeSens(w, m.hanzi)) && posable(m, tous))
    .map((m) => m.hanzi);
  const parPremier = new Map<string, string[]>();
  for (const w of mots) parPremier.set(premier(w), [...(parPremier.get(premier(w)) ?? []), w]);
  const suites = (w: string): string[] => (parPremier.get(dernier(w)) ?? []).filter((x) => x !== w);
  const degre = new Map(mots.map((w) => [w, suites(w).length]));
  const rang = (sel: string, w: string): number => hachage(`${graine}/${sel}/${w}`);
  const ordre = (sel: string, ws: readonly string[]): string[] =>
    [...ws].sort(
      (x, y) => (degre.get(y) ?? 0) - (degre.get(x) ?? 0) || rang(sel, x) - rang(sel, y) || (x < y ? -1 : 1)
    );

  let meilleur: string[] = [];
  let budget = BUDGET_CHAINE;
  const explorer = (chemin: string[]): void => {
    if (chemin.length > meilleur.length) meilleur = [...chemin];
    if (meilleur.length >= MAILLONS_MAX || budget <= 0) return;
    const fin = chemin[chemin.length - 1];
    const libres = suites(fin).filter((x) => !chemin.includes(x) && !chemin.some((w) => memeSens(w, x)));
    for (const w of ordre(fin, libres)) {
      if (budget <= 0 || meilleur.length >= MAILLONS_MAX) return;
      budget -= 1;
      chemin.push(w);
      explorer(chemin);
      chemin.pop();
    }
  };
  /* Les départs, dans l'ordre de la graine seule : une autre manche part d'ailleurs. */
  const departs = mots
    .filter((w) => (degre.get(w) ?? 0) > 0)
    .sort((x, y) => rang('depart', x) - rang('depart', y) || (x < y ? -1 : 1));
  for (const d of departs) {
    if (budget <= 0 || meilleur.length >= MAILLONS_MAX) break;
    explorer([d]);
  }
  return meilleur.length >= 2 ? meilleur : [];
}

/**
 * Les chaînes d'une manche, sans mot commun. La première est la plus longue que l'acquis
 * permet (`chaineDeMots`) ; quand elle s'arrête avant que la manche soit pleine, une autre
 * repart de mots qui n'ont pas encore servi, tant qu'il reste la place de deux mots.
 */
export function chainesDeMots(corpus: CorpusJeux, graine: string): string[][] {
  const out: string[][] = [];
  const servis = new Set<string>();
  let n = 0;
  while (MAILLONS_MAX - n >= 2) {
    const suite = chaineDeMots(corpus, out.length === 0 ? graine : `${graine}/${out.length}`, servis);
    if (suite.length < 2) break;
    const prise = suite.slice(0, MAILLONS_MAX - n);
    out.push(prise);
    for (const w of prise) servis.add(w);
    n += prise.length;
  }
  return out;
}

/* ---------- les tours ---------- */

/**
 * Les trois leurres d'un mot : des sens d'autres mots de l'acquis, jamais celui d'un mot
 * déjà posé dans la manche, ni proche du bon, ni proches entre eux. D'abord les mots qui
 * partagent un caractère avec lui (on ne répond pas en lisant un seul caractère), puis
 * les autres, dans l'ordre de la graine. Un sens déjà montré en leurre ne revient que
 * faute d'autre, et un mot d'une chaîne de la manche passe après les autres : pas de sens
 * qui se trouve par élimination.
 */
function leurresDuMot(
  m: MotChaine,
  pool: readonly MotChaine[],
  poses: readonly string[],
  chaine: ReadonlySet<string>,
  montres: ReadonlySet<string>,
  graine: string
): string[] {
  const bon = sensDuChoix(m.fr);
  const nature = citeUnCaractere(bon);
  const signes = new Set([...m.hanzi]);
  const interdits = poses.map((w) => pool.find((x) => x.hanzi === w)?.fr ?? '').filter((x) => x !== '');
  const candidats = pool
    .filter(
      (x) =>
        x.hanzi !== m.hanzi &&
        !poses.includes(x.hanzi) &&
        citeUnCaractere(sensDuChoix(x.fr)) === nature &&
        !interdits.some((s) => sensDuChoix(s) === sensDuChoix(x.fr))
    )
    .map((x) => ({
      x,
      sens: sensDuChoix(x.fr),
      palier: (montres.has(sensDuChoix(x.fr)) ? 4 : 0) + (chaine.has(x.hanzi) ? 2 : 0) + ([...x.hanzi].some((c) => signes.has(c)) ? 0 : 1),
      h: hachage(`${graine}/${m.hanzi}/${x.hanzi}`)
    }))
    .sort((a, b) => a.palier - b.palier || a.h - b.h || (a.sens < b.sens ? -1 : 1));
  const pris: MotChaine[] = [];
  for (const { x } of candidats) {
    if (pris.length >= PROPOSITIONS_CHAINE - 1) break;
    if ([m, ...pris].some((s) => sensProches(s, x))) continue;
    pris.push(x);
  }
  return pris.map((x) => sensDuChoix(x.fr));
}

/**
 * Les tours d'une manche : chaque mot de chaque chaîne est un tour, le premier compris,
 * sans maillon d'avant. Le mot d'avant reste visible (`suite`) ; quatre sens, mélangés
 * d'après la graine. La bonne réponse note tous les caractères du mot ; une erreur, ceux
 * dont la fiche l'a fait lire (`fautifs`). Un mot sans trois leurres arrête sa chaîne ;
 * une chaîne réduite à un mot ne se pose pas.
 */
export function toursChaine(corpus: CorpusJeux, graine: string): Tour[] {
  const pool = motsPossibles(corpus);
  const parMot = new Map(pool.map((m) => [m.hanzi, m]));
  const chaines = chainesDeMots(corpus, graine);
  const dansLaManche = new Set(chaines.flat());
  const tours: Tour[] = [];
  const poses: string[] = [];
  const montres = new Set<string>();
  for (const suite of chaines) {
    const ceux: Tour[] = [];
    const vus: string[] = [];
    const vusMontres = new Set(montres);
    for (let k = 0; k < suite.length; k++) {
      const m = parMot.get(suite[k]);
      if (!m) break;
      const leurres = leurresDuMot(m, pool, [...poses, ...vus], dansLaManche, vusMontres, graine);
      if (leurres.length < PROPOSITIONS_CHAINE - 1) break;
      const bon = sensDuChoix(m.fr);
      const [c, ...reste] = [...new Set([...m.hanzi])];
      const t: Tour = {
        c,
        enonce: k === 0 && tours.length > 0 ? ENONCE_AUTRE_CHAINE : ENONCE_CHAINE,
        reponse: [bon],
        choix: melange([bon, ...leurres], `${graine}/${m.hanzi}/choix`),
        ordre: false,
        paire: false,
        suite: suite.slice(0, k),
        maillon: m.hanzi,
        fautifs: [...new Set(m.porteurs)]
      };
      if (reste.length > 0) t.aussi = reste;
      ceux.push(t);
      vus.push(m.hanzi);
      for (const s of t.choix) vusMontres.add(s);
    }
    if (ceux.length < 2) continue;
    tours.push(...ceux);
    poses.push(...vus);
    for (const s of vusMontres) montres.add(s);
  }
  return tours;
}
