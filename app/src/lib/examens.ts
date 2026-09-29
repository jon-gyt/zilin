/**
 * Les examens 科举 et les 月课 (épic 8, story 8.2 ; brief §8, « Les examens 科举 » et
 * « Le personnage ») : quel examen est à passer, la notation, la pause des briques, la
 * reprise, et le titre « points ET examen ».
 *
 * La liste des examens, leurs paliers, leur sorte, les nominations et les séries viennent
 * de `examens.json`, que le pipeline tire de `data/sources/examens/` : rien n'est écrit ici.
 *
 * Module pur, sauf le chargeur : aucune fonction ne lit l'horloge ni ne tire au hasard,
 * aucune règle ne lit une durée. L'instant et la journée sont toujours passés en argument.
 *
 * Règles :
 * - un examen s'ouvre quand son palier de caractères lus est atteint, lus au seuil de
 *   stabilité de Mon chemin (le compte du trophée Lire, `foret.caracteresLus`) ; les examens
 *   se passent dans l'ordre, et un examen ouvert le reste jusqu'à sa réussite ;
 * - tant qu'un examen est ouvert, à passer ou manqué, aucune brique nouvelle n'entre
 *   (`briquesEnPause`) ; il se passe hors session, la journée faite, jamais en rattrapage ;
 * - reçu à quatre réponses sur cinq justes du premier essai (huit sur dix à un examen à
 *   titre, quatre sur cinq à un 月课 : « 10 et 5 », 29 septembre 2026) ; une bonne réponse
 *   note ses caractères par `grade` (Bien : l'examen ne chronomètre pas) et donne un point
 *   读, une erreur les note faux ;
 * - une seconde chance par question (maquette validée le 29 septembre 2026) : rattrapée,
 *   la réponse donne son point 读 mais ne compte pas pour le premier coup, et ne note rien
 *   de plus ; au vrai ou faux, la réponse se montre, sans second essai ;
 * - « Quitter » reprend à la même question, ses essais compris ;
 * - la reprise est permise quand chaque caractère manqué a été revu juste à son échéance,
 *   et prend l'autre série ;
 * - un titre d'examen ne s'accorde qu'examen réussi et points atteints ; les quatre derniers
 *   rangs, des nominations, demandent leur palier de caractères lus ; un 月课 ne donne ni ne
 *   retient aucun rang.
 */
import { Rating } from 'ts-fsrs';
import { contenu, dossierVersion, VERSION_DONNEES, type Famille, type Index } from './content';
import { caracteresLus } from './foret';
import { remplir } from './heros';
import { SECONDES_RAPIDE, SEUIL_DEBLOCAGE, type Outcome, type ReviewCard } from './srs';

/* ---------- le contenu : examens.json ---------- */

export type SorteExamen = 'titre' | 'yueke';

/** Un examen de la liste : à titre (les six du 科举) ou 月课, à son palier de caractères lus. */
export type Examen = {
  id: string;
  sorte: SorteExamen;
  hz: string;
  pinyin: string;
  fr: string;
  en: string;
  palier: number;
  /** Le rang du personnage qu'il accorde, avec les points ; `null` pour le 县试 et les 月课. */
  titre: string | null;
  questions: number;
};

/** Un rang sans examen, accordé à un palier de caractères lus. */
export type Nomination = { rang: string; palier: number };

export type Sens = { fr: string; en: string };
export type Phrase = { zh: string; pinyin: string; fr: string; en: string };
export type Glose = { pinyin: string; fr: string; en: string };

/** Ce que l'écran dessine à plat (8.3). */
export type GenreSupport =
  | 'enseigne'
  | 'pancarte'
  | 'menu'
  | 'etal'
  | 'billet'
  | 'message'
  | 'note'
  | 'lettre'
  | 'calendrier'
  | 'affiche';

/** Une mise en situation jamais vue. */
export type Support = { id: string; genre: GenreSupport; contexte: Sens; lignes: Phrase[] };

export type TypeQuestionExamen =
  | 'comprendre'
  | 'reperer'
  | 'vrai_faux'
  | 'replique'
  | 'sens'
  | 'caractere'
  | 'trou'
  | 'ton';

export const TYPES_SITUATION: readonly TypeQuestionExamen[] = ['comprendre', 'reperer', 'vrai_faux', 'replique'];
export const TYPES_REVUE: readonly TypeQuestionExamen[] = ['sens', 'caractere', 'trou', 'ton'];

/**
 * Une question. `choix` : des sens {fr, en} (`comprendre`, `sens`), des phrases
 * (`replique`), des caractères ou des mots (`reperer`, `caractere`, `trou`), des syllabes
 * (`ton`) ; aucun au `vrai_faux`, dont la réponse est vrai ou faux. `porte` : les
 * caractères qui portent la réponse, notés en révision ; `caracteres` : tout ce qu'elle
 * montre.
 */
export type QuestionExamen = {
  type: TypeQuestionExamen;
  support?: string;
  consigne: Sens;
  objet?: Phrase;
  trou?: number;
  affirmation?: Phrase;
  choix: (Sens | Phrase | string)[];
  reponse: number | boolean;
  porte: string[];
  caracteres: string[];
};

export type SerieExamen = { supports: Support[]; questions: QuestionExamen[]; glose: Record<string, Glose> };

export type LettreSerie = 'A' | 'B';
export const SERIES: readonly LettreSerie[] = ['A', 'B'];

/**
 * Un examen sur un chemin : le jour du palier, le tronçon, les séries relues, les noms
 * inventés du 放榜 (examen à titre seulement), écrits avec l'acquis du palier, et `pinyin` :
 * vrai aux examens de la première étape du chemin, dont les textes portent leur pinyin sous
 * chaque caractère (décision du propriétaire du 29 septembre 2026, « jusqu'à HSK 1 »).
 */
export type ExamenDuChemin = {
  examen: string;
  jour: number;
  troncon: string[];
  series: Partial<Record<LettreSerie, SerieExamen>>;
  noms: string[];
  pinyin: boolean;
};

/** Les deux chemins qui ont leurs séries. « Voyager » suit « Lire », comme partout. */
export type CheminExamen = 'lire' | 'hsk';

export type ExamensDonnees = {
  /** Reçu à `justes` sur `sur` : quatre sur cinq. */
  regle: { justes: number; sur: number };
  examens: Examen[];
  nominations: Nomination[];
  /** Les lignes de l'écran et les phrases de Tao, par clé, avec leurs jetons. */
  textes: Record<string, string>;
  parcours: Record<CheminExamen, ExamenDuChemin[]>;
  /** La famille de chaque caractère des noms, pour trouver ses traits. */
  racines: Record<string, string>;
};

/** La règle du brief, quand l'export ne la dit pas : quatre sur cinq. */
/** La règle de réussite : `justes` sur `sur` du premier essai. */
export type Regle = { readonly justes: number; readonly sur: number };

export const REGLE_DEFAUT: Regle = { justes: 4, sur: 5 };

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function entier(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function lireSens(v: unknown): Sens | null {
  const o = objet(v);
  return o && texte(o.fr) !== '' ? { fr: texte(o.fr), en: texte(o.en) } : null;
}

function lirePhrase(v: unknown): Phrase | null {
  const o = objet(v);
  if (!o || texte(o.zh) === '') return null;
  return { zh: texte(o.zh), pinyin: texte(o.pinyin), fr: texte(o.fr), en: texte(o.en) };
}

function chaines(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

const GENRES: readonly GenreSupport[] = [
  'enseigne',
  'pancarte',
  'menu',
  'etal',
  'billet',
  'message',
  'note',
  'lettre',
  'calendrier',
  'affiche'
];
const TYPES: readonly TypeQuestionExamen[] = [...TYPES_SITUATION, ...TYPES_REVUE];

function lireQuestion(v: unknown, supports: readonly Support[]): QuestionExamen | null {
  const o = objet(v);
  if (!o || !TYPES.includes(o.type as TypeQuestionExamen)) return null;
  const type = o.type as TypeQuestionExamen;
  const consigne = lireSens(o.consigne);
  if (consigne === null) return null;
  const q: QuestionExamen = {
    type,
    consigne,
    choix: [],
    reponse: -1,
    porte: chaines(o.porte),
    caracteres: chaines(o.caracteres)
  };
  if (q.porte.length === 0) return null;
  if (TYPES_SITUATION.includes(type)) {
    const s = texte(o.support);
    if (!supports.some((x) => x.id === s)) return null;
    q.support = s;
  }
  if (o.objet !== undefined) {
    const p = lirePhrase(o.objet);
    if (p === null) return null;
    q.objet = p;
  }
  if (TYPES_REVUE.includes(type) && q.objet === undefined) return null;
  if (type === 'vrai_faux') {
    const a = lirePhrase(o.affirmation);
    if (a === null || typeof o.reponse !== 'boolean') return null;
    q.affirmation = a;
    q.reponse = o.reponse;
    return q;
  }
  const brut = Array.isArray(o.choix) ? o.choix : [];
  const choix: (Sens | Phrase | string)[] = [];
  for (const c of brut) {
    const lu =
      type === 'comprendre' || type === 'sens'
        ? lireSens(c)
        : type === 'replique'
          ? lirePhrase(c)
          : typeof c === 'string' && c !== ''
            ? c
            : null;
    if (lu === null) return null;
    choix.push(lu);
  }
  const r = entier(o.reponse);
  if (r === null || r >= choix.length) return null;
  if (type === 'trou') {
    const t = entier(o.trou);
    if (t === null) return null;
    q.trou = t;
  }
  q.choix = choix;
  q.reponse = r;
  return q;
}

function lireSerie(v: unknown): SerieExamen | null {
  const o = objet(v);
  if (!o) return null;
  const supports: Support[] = [];
  for (const s of Array.isArray(o.supports) ? o.supports : []) {
    const x = objet(s);
    const contexte = x ? lireSens(x.contexte) : null;
    if (!x || contexte === null || !GENRES.includes(x.genre as GenreSupport) || texte(x.id) === '') continue;
    const lignes = (Array.isArray(x.lignes) ? x.lignes : []).map(lirePhrase).filter((p): p is Phrase => p !== null);
    if (lignes.length > 0) supports.push({ id: texte(x.id), genre: x.genre as GenreSupport, contexte, lignes });
  }
  const questions = (Array.isArray(o.questions) ? o.questions : [])
    .map((q) => lireQuestion(q, supports))
    .filter((q): q is QuestionExamen => q !== null);
  const glose: Record<string, Glose> = {};
  const g = objet(o.glose);
  if (g) {
    for (const [zh, e] of Object.entries(g)) {
      const x = objet(e);
      if (x) glose[zh] = { pinyin: texte(x.pinyin), fr: texte(x.fr), en: texte(x.en) };
    }
  }
  return questions.length > 0 ? { supports, questions, glose } : null;
}

/**
 * Lit `examens.json`. Un examen mal formé tombe, et un palier qui ne croît pas arrête la
 * liste : mieux vaut un examen de moins qu'un ordre faux. Une série illisible tombe.
 */
export function lireExamensDonnees(brut: unknown): ExamensDonnees {
  const o = objet(brut) ?? {};
  const examens: Examen[] = [];
  for (const v of Array.isArray(o.examens) ? o.examens : []) {
    const e = objet(v);
    const palier = e ? entier(e.palier) : null;
    const questions = e ? entier(e.questions) : null;
    if (!e || palier === null || questions === null || questions === 0 || texte(e.id) === '') continue;
    if (e.sorte !== 'titre' && e.sorte !== 'yueke') continue;
    const avant = examens[examens.length - 1];
    if (avant !== undefined && palier <= avant.palier) break;
    examens.push({
      id: texte(e.id),
      sorte: e.sorte,
      hz: texte(e.hz),
      pinyin: texte(e.pinyin),
      fr: texte(e.fr),
      en: texte(e.en),
      palier,
      titre: e.sorte === 'titre' && texte(e.titre) !== '' ? texte(e.titre) : null,
      questions
    });
  }
  const nominations: Nomination[] = [];
  for (const v of Array.isArray(o.nominations) ? o.nominations : []) {
    const n = objet(v);
    const palier = n ? entier(n.palier) : null;
    if (n && palier !== null && texte(n.rang) !== '') nominations.push({ rang: texte(n.rang), palier });
  }
  const r = objet(o.reussite);
  const justes = r ? entier(r.justes) : null;
  const sur = r ? entier(r.sur) : null;
  const regle = justes !== null && sur !== null && sur > 0 && justes <= sur ? { justes, sur } : { ...REGLE_DEFAUT };
  const textes: Record<string, string> = {};
  for (const [cle, v] of Object.entries(objet(o.textes) ?? {})) if (typeof v === 'string') textes[cle] = v;
  const parcours: Record<CheminExamen, ExamenDuChemin[]> = { lire: [], hsk: [] };
  const p = objet(o.parcours) ?? {};
  for (const chemin of ['lire', 'hsk'] as const) {
    for (const v of Array.isArray(p[chemin]) ? (p[chemin] as unknown[]) : []) {
      const x = objet(v);
      const jour = x ? entier(x.jour) : null;
      if (!x || jour === null || !examens.some((e) => e.id === x.examen)) continue;
      const series: Partial<Record<LettreSerie, SerieExamen>> = {};
      const s = objet(x.series) ?? {};
      for (const lettre of SERIES) {
        const lue = lireSerie(s[lettre]);
        if (lue !== null) series[lettre] = lue;
      }
      parcours[chemin].push({
        examen: texte(x.examen),
        jour,
        troncon: chaines(x.troncon),
        series,
        noms: chaines(x.noms),
        pinyin: x.pinyin === true
      });
    }
  }
  const racines: Record<string, string> = {};
  for (const [c, v] of Object.entries(objet(o.racines) ?? {})) if (typeof v === 'string') racines[c] = v;
  return { regle, examens, nominations, textes, parcours, racines };
}

/** Aucun examen : ce que rend un export sans `examens.json`. Rien ne se met en pause. */
export const SANS_EXAMENS: ExamensDonnees = {
  regle: { ...REGLE_DEFAUT },
  examens: [],
  nominations: [],
  textes: {},
  parcours: { lire: [], hsk: [] },
  racines: {}
};

/** Le fichier des examens d'une version, tel que l'index le nomme. */
export function fichierExamens(i: Index): string {
  return !i.examens ? '' : `${dossierVersion(i.version)}/${i.examens}`;
}

/** Lit et valide `examens.json`. `fetchFn` est injecté dans les tests. */
export async function loadExamens(file: string, fetchFn: typeof fetch = fetch): Promise<ExamensDonnees> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Examens introuvables : ${file} (${r.status})`);
  return lireExamensDonnees(await r.json());
}

const lesExamens = new Map<string, Promise<ExamensDonnees>>();

/** Les examens de la version courante, lus une fois pour toute la durée de vie de l'app. */
export function examensOnce(version = VERSION_DONNEES): Promise<ExamensDonnees> {
  let p = lesExamens.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierExamens(i);
        return file === '' ? SANS_EXAMENS : loadExamens(file);
      })
      .catch((e) => {
        lesExamens.delete(version);
        throw e;
      });
    lesExamens.set(version, p);
  }
  return p;
}

/**
 * Une ligne de l'écran ou une phrase de Tao, jetons remplis (`{examen}`, `{lus}`,
 * `{justes}`, `{questions}`, `{reussite}`). Une clé absente de l'export : rien.
 */
export function texteExamen(d: ExamensDonnees, cle: string, valeurs: Readonly<Record<string, string | number>> = {}): string {
  return remplir(d.textes[cle] ?? '', valeurs);
}

/* ---------- le pinyin sous les caractères ---------- */

/*
 * Décision du propriétaire du 29 septembre 2026 : « Il faudrait un mode avec pinyin sous les
 * caractères sur les premiers examens (jusqu'à HSK 1), ensuite plus de pinyin pour les
 * examens. » Quels examens le portent, c'est l'export qui le dit (`ExamenDuChemin.pinyin`,
 * tiré de `examens.tsv`) : sur le chemin Lire jusqu'au 乡试, le seuil 255 ; sur le chemin
 * HSK jusqu'au 月课 de 405, la fin du HSK 1. Jamais le pinyin quand il donnerait la réponse :
 *
 * | Où                                               | Pinyin |
 * |--------------------------------------------------|--------|
 * | les textes des supports (message, menu, billet…) | oui    |
 * | l'affirmation d'un vrai ou faux                  | oui    |
 * | les répliques à choisir (phrases en chinois)     | oui    |
 * | les mots d'un repérage (déjà dans le support)    | oui    |
 * | l'objet d'une question de ton                    | non    |
 * | l'objet et les choix d'un trou                   | non    |
 * | les choix d'une question « caractère »           | non    |
 * | le caractère d'une question de sens              | non    |
 *
 * Les questions de revue n'en montrent aucun, ni sur l'objet ni sur les choix. Une mise en
 * situation dont le pinyin désignerait seul la bonne réponse (`pinyinDonneLaReponse`) n'en
 * montre pas non plus : le pipeline la refuse, et l'écran se tait si elle passait quand même.
 */

/** L'examen `id` porte-t-il le pinyin sous les caractères sur ce chemin ? */
export function avecPinyin(d: ExamensDonnees, chemin: CheminExamen, id: string): boolean {
  return examenDuChemin(d, chemin, id)?.pinyin === true;
}

/** Où une question montre le pinyin sous les caractères. */
export type PinyinDeQuestion = {
  /** Les lignes du support, les mots d'un repérage et la réplique trouvée compris. */
  support: boolean;
  /** L'affirmation d'un vrai ou faux. */
  affirmation: boolean;
  /** Les répliques à choisir. */
  choix: boolean;
};

export const SANS_PINYIN: PinyinDeQuestion = { support: false, affirmation: false, choix: false };

/** Un sinogramme (les blocs CJC unifiés du plan de base et leurs compatibilités). */
const HZ = /[㐀-鿿豈-﫿]/;

/**
 * Le pinyin d'un texte, syllabe par caractère : une syllabe sous chaque sinogramme, rien sous
 * la ponctuation. Le pipeline écrit une syllabe par sinogramme ; si le compte ne tombe pas
 * juste, aucune : mieux vaut pas de pinyin qu'un pinyin décalé.
 */
export function syllabesParCaractere(p: { zh: string; pinyin: string }): (string | null)[] {
  const signes = [...p.zh];
  const syllabes = p.pinyin.split(/\s+/).filter((x) => x !== '');
  if (syllabes.length !== signes.filter((c) => HZ.test(c)).length) return signes.map(() => null);
  let k = 0;
  return signes.map((c) => (HZ.test(c) ? (syllabes[k++] ?? null) : null));
}

/**
 * `decouperLigne`, chaque morceau avec ses syllabes (`py`, alignées sur ses caractères), ou
 * `null` sans pinyin.
 */
export function decouperLigneAvecPinyin(
  zh: string,
  py: readonly (string | null)[] | null,
  mots: readonly string[]
): { t: string; mot: number; py: (string | null)[] | null }[] {
  let k = 0;
  return decouperLigne(zh, mots).map((m) => {
    const n = [...m.t].length;
    const out = { ...m, py: py === null ? null : py.slice(k, k + n) };
    k += n;
    return out;
  });
}

/** Un morceau fait de ponctuation ou d'espace seulement, sans sinogramme. */
export function sansSinogramme(t: string): boolean {
  return ![...t].some((c) => HZ.test(c));
}

/**
 * Des grappes insécables : ce qui `colle` (la ponctuation) reste avec ce qui le précède, pour
 * qu'un caractère et sa ponctuation ne se séparent pas en fin de ligne quand chacun porte sa
 * syllabe dessous.
 */
export function grappes<T>(elements: readonly T[], colle: (x: T) => boolean): T[][] {
  const out: T[][] = [];
  for (const x of elements) {
    const derniere = out[out.length - 1];
    if (derniere !== undefined && colle(x)) derniere.push(x);
    else out.push([x]);
  }
  return out;
}

/**
 * Le mot de chaque caractère d'une ligne, tel que la glose de la série la découpe (l'entrée
 * la plus longue d'abord, comme le pipeline) : un rang par caractère, le même pour les
 * caractères d'un même mot. Un caractère sans entrée, ou la ponctuation, fait un mot à lui.
 */
export function motsDeLigne(zh: string, entrees: readonly string[]): number[] {
  const signes = [...zh];
  const parLongueur = entrees.filter((e) => e !== '').sort((a, b) => [...b].length - [...a].length);
  const out: number[] = [];
  let i = 0;
  let n = 0;
  while (i < signes.length) {
    const reste = signes.slice(i).join('');
    const e = HZ.test(signes[i]) ? parLongueur.find((x) => reste.startsWith(x)) : undefined;
    const l = e === undefined ? 1 : [...e].length;
    for (let k = 0; k < l; k++) out.push(n);
    n += 1;
    i += l;
  }
  return out;
}

/**
 * Une ligne découpée (`decouperLigneAvecPinyin`), en grappes insécables : un mot de la glose
 * ne se coupe pas en fin de ligne, et la ponctuation reste avec ce qui la précède.
 */
export function grappesDeLigne(
  zh: string,
  py: readonly (string | null)[] | null,
  mots: readonly string[],
  entrees: readonly string[]
): { t: string; mot: number; py: (string | null)[] | null }[][] {
  const rangs = motsDeLigne(zh, entrees);
  let k = 0;
  const morceaux = decouperLigneAvecPinyin(zh, py, mots).map((m) => {
    const debut = k;
    k += [...m.t].length;
    return { m, debut };
  });
  return grappes(morceaux, (x) => (x.m.mot < 0 && sansSinogramme(x.m.t)) || (x.debut > 0 && rangs[x.debut] === rangs[x.debut - 1])).map(
    (g) => g.map((x) => x.m)
  );
}

/** Une phrase, signe par signe avec sa syllabe, en grappes insécables (`grappesDeLigne`). */
export function grappesDePhrase(p: { zh: string; pinyin: string }, entrees: readonly string[] = []): { c: string; py: string | null }[][] {
  const syllabes = syllabesParCaractere(p);
  const rangs = motsDeLigne(p.zh, entrees);
  return grappes(
    [...p.zh].map((c, k) => ({ c, py: syllabes[k], k })),
    (x) => sansSinogramme(x.c) || (x.k > 0 && rangs[x.k] === rangs[x.k - 1])
  ).map((g) => g.map(({ c, py }) => ({ c, py })));
}

/** Sans accents ni casse : « zhōng shān » → « zhong shan ». */
function plat(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ce que le pinyin montré transcrit : chaque suite d'une à quatre syllabes d'une ligne. */
function transcriptions(pinyins: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const p of pinyins) {
    const s = p.split(/\s+/).map((x) => plat(x).replace(/[^a-z]/g, ''));
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j <= Math.min(i + 4, s.length); j++) out.add(s.slice(i, j).join(''));
  }
  out.delete('');
  return out;
}

/** Un mot français plus court ne compte pas comme une transcription : « de », « le » sont aussi des syllabes. */
const TRANSCRIPTION_MIN = 3;

/** Les mots d'un texte français que le pinyin montré transcrit (« À Zhongshan »). */
function motsTranscrits(texte: string, transcrits: ReadonlySet<string>): string[] {
  return [...new Set(plat(texte).match(/[a-z]+/g) ?? [])].filter((m) => m.length >= TRANSCRIPTION_MIN && transcrits.has(m));
}

/** Le pinyin qu'une mise en situation montrerait : son support, son affirmation, ses répliques. */
function pinyinsDeSituation(q: QuestionExamen, serie: SerieExamen): string[] {
  const s = q.support === undefined ? undefined : serie.supports.find((x) => x.id === q.support);
  const out = s?.lignes.map((l) => l.pinyin) ?? [];
  if (q.affirmation !== undefined) out.push(q.affirmation.pinyin);
  if (q.type === 'replique') for (const c of q.choix) if (typeof c === 'object' && 'zh' in c) out.push(c.pinyin);
  return out;
}

/**
 * Le pinyin donnerait-il la réponse ? Au sens d'une mise en situation, la bonne réponse
 * serait le seul choix à porter un mot que le pinyin transcrit (« À Zhongshan » sous « nán
 * jīng zhōng shān », parmi « À Nankin », « À Pékin ») ; au repérage, la consigne transcrirait
 * le mot cherché. Rend les mots en cause, vide sinon. Le même contrôle est bloquant dans
 * `wenlu check` : ici, c'est la garde de l'écran.
 */
export function pinyinDonneLaReponse(q: QuestionExamen, serie: SerieExamen): string[] {
  if (typeof q.reponse !== 'number') return [];
  const bonne = q.choix[q.reponse];
  const transcrits = transcriptions(pinyinsDeSituation(q, serie));
  if (bonne === undefined || transcrits.size === 0) return [];
  if (q.type === 'comprendre') {
    const avec = q.choix.map((c) => motsTranscrits(typeof c === 'object' ? c.fr : c, transcrits));
    return avec.every((m, k) => (k === q.reponse ? m.length > 0 : m.length === 0)) ? avec[q.reponse] : [];
  }
  if (q.type === 'reperer' && typeof bonne === 'string') {
    const g = serie.glose[bonne];
    if (g === undefined) return [];
    const mot = plat(g.pinyin).replace(/[^a-z]/g, '');
    const mots = plat(q.consigne.fr).match(/[a-z]+/g) ?? [];
    for (let i = 0; i < mots.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 4, mots.length); j++) {
        if (mot.length >= TRANSCRIPTION_MIN && mots.slice(i, j).join('') === mot) return [mot];
      }
    }
  }
  return [];
}

/**
 * Où la question montre le pinyin, à un examen qui le porte (`avec`) : le support,
 * l'affirmation d'un vrai ou faux, les répliques à choisir. Jamais une question de revue
 * (sens, caractère, trou, ton), ni sur l'objet ni sur les choix ; jamais une mise en
 * situation dont le pinyin donnerait la réponse.
 */
export function pinyinDeQuestion(q: QuestionExamen, serie: SerieExamen, avec: boolean): PinyinDeQuestion {
  if (!avec || !TYPES_SITUATION.includes(q.type)) return SANS_PINYIN;
  if (pinyinDonneLaReponse(q, serie).length > 0) return SANS_PINYIN;
  return { support: q.support !== undefined, affirmation: q.type === 'vrai_faux', choix: q.type === 'replique' };
}

/**
 * Tout ce qu'une question montre avec son pinyin, pour le contrôle des fuites : les lignes
 * du support, l'affirmation, les répliques à choisir. Vide sans pinyin.
 */
export function textesAvecPinyin(q: QuestionExamen, serie: SerieExamen, avec: boolean): Phrase[] {
  const py = pinyinDeQuestion(q, serie, avec);
  const out: Phrase[] = [];
  if (py.support) out.push(...(serie.supports.find((x) => x.id === q.support)?.lignes ?? []));
  if (py.affirmation && q.affirmation !== undefined) out.push(q.affirmation);
  if (py.choix) for (const c of q.choix) if (typeof c === 'object' && 'zh' in c) out.push(c);
  return out;
}

/* ---------- la progression ---------- */

/** Une tentative : en cours tant que `echec` est nul, manquée sinon. */
export type Tentative = {
  examen: string;
  chemin: CheminExamen;
  serie: LettreSerie;
  /** Les tentatives déjà manquées de cet examen avant celle-ci : la série en découle. */
  numero: number;
  /**
   * Les questions posées, par leur rang dans la série, figées au départ : celles dont chaque
   * caractère a une carte (`questionsPosables`). Vide : toute la série.
   */
  poses: number[];
  /** La question en cours, rang dans `poses` : « Quitter » reprend à celle-ci. */
  i: number;
  /** Les réponses déjà touchées à la question en cours : la reprise les remontre. */
  essais: (number | boolean)[];
  /** Juste du premier essai, question par question, dans l'ordre posé. */
  reponses: boolean[];
  /** Les questions rattrapées au second essai : chacune a donné son point 读. */
  rattrapees: number;
  /** Les caractères manqués, sans doublon, dans l'ordre. */
  manques: string[];
  /** L'instant de l'échec, en ISO ; `null` tant que la tentative est en cours. */
  echec: string | null;
};

/**
 * Ce que la progression garde des examens (export et import compris) :
 * - `reussis` : chaque examen réussi, 月课 compris, avec sa journée (AAAA-MM-JJ) ;
 * - `ouvert` : l'examen dont le palier a été atteint et qui attend d'être réussi ; il le
 *   reste même si le compte des lus redescend ;
 * - `tentative` : la tentative en cours, ou la dernière manquée ;
 * - `migre` : faux pour une progression d'avant les examens, tant que ses rangs déjà
 *   annoncés n'ont pas été reportés en examens reçus (`migrerRangsAnnonces`).
 */
export type EtatExamens = {
  reussis: Record<string, string>;
  ouvert: string | null;
  tentative: Tentative | null;
  migre: boolean;
};

export function etatExamensVide(): EtatExamens {
  return { reussis: {}, ouvert: null, tentative: null, migre: true };
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function lireTentative(v: unknown): Tentative | null {
  const o = objet(v);
  if (!o || texte(o.examen) === '') return null;
  if (o.chemin !== 'lire' && o.chemin !== 'hsk') return null;
  if (o.serie !== 'A' && o.serie !== 'B') return null;
  const reponses = Array.isArray(o.reponses) ? o.reponses.map((x) => x === true) : [];
  /* La question en cours : répondue et pas encore quittée (la dernière notée), ou la suivante. */
  const lu = entier(o.i);
  const i = lu === reponses.length - 1 || lu === reponses.length ? lu : reponses.length;
  const essais =
    i < reponses.length && Array.isArray(o.essais)
      ? o.essais.filter((x): x is number | boolean => typeof x === 'boolean' || entier(x) !== null)
      : [];
  const poses = Array.isArray(o.poses) ? o.poses.map(entier).filter((x): x is number => x !== null) : [];
  const echec = typeof o.echec === 'string' && !Number.isNaN(Date.parse(o.echec)) ? o.echec : null;
  return {
    examen: texte(o.examen),
    chemin: o.chemin,
    serie: o.serie,
    numero: entier(o.numero) ?? 0,
    poses: [...new Set(poses)],
    i,
    essais,
    reponses,
    rattrapees: Math.min(entier(o.rattrapees) ?? 0, reponses.filter((x) => !x).length),
    manques: [...new Set(chaines(o.manques))],
    echec
  };
}

/**
 * Relit l'état des examens d'un export. Absent : une progression d'avant les examens, à
 * reporter (`migre` faux). Une entrée aberrante est écartée.
 */
export function lireEtatExamens(v: unknown): EtatExamens {
  const o = objet(v);
  if (!o) return { ...etatExamensVide(), migre: false };
  const reussis: Record<string, string> = {};
  for (const [id, jour] of Object.entries(objet(o.reussis) ?? {})) {
    if (id !== '' && typeof jour === 'string' && FORMAT_JOUR.test(jour)) reussis[id] = jour;
  }
  const ouvert = typeof o.ouvert === 'string' && o.ouvert !== '' && reussis[o.ouvert] === undefined ? o.ouvert : null;
  const tentative = lireTentative(o.tentative);
  return {
    reussis,
    ouvert,
    tentative: tentative !== null && reussis[tentative.examen] === undefined ? tentative : null,
    migre: o.migre !== false
  };
}

/* ---------- quel examen, et la pause des briques ---------- */

/** Le chemin dont on lit les séries : « Voyager » suit « Lire ». */
export function cheminDesExamens(parcours: string | null): CheminExamen {
  return parcours === 'hsk' ? 'hsk' : 'lire';
}

/** Les caractères lus : ceux de Mon chemin, au seuil de stabilité, le compte du trophée Lire. */
export function lusPourExamens(
  familles: readonly Famille[],
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): number {
  return caracteresLus(familles, cartes, seuil);
}

/** Un examen sur un chemin : son jour, son tronçon, ses séries, ses noms. `null` au-delà. */
export function examenDuChemin(d: ExamensDonnees, chemin: CheminExamen, id: string): ExamenDuChemin | null {
  return d.parcours[chemin].find((x) => x.examen === id) ?? null;
}

/**
 * Les examens qu'on peut passer sur ce chemin, dans l'ordre : ceux dont les deux séries sont
 * écrites et relues, jusqu'au premier qui ne l'est pas encore (exclu). Un examen sans ses
 * séries ne s'ouvre pas : il ne mettrait pas les briques en pause sans rien à lire. Il
 * s'ouvrira avec l'export qui les porte, avant ceux qui le suivent, puisqu'ils se passent
 * dans l'ordre.
 */
export function examensPassables(d: ExamensDonnees, chemin: CheminExamen): Examen[] {
  const out: Examen[] = [];
  for (const e of d.examens) {
    const x = examenDuChemin(d, chemin, e.id);
    if (x === null || SERIES.some((s) => x.series[s] === undefined)) break;
    out.push(e);
  }
  return out;
}

/** Le premier examen de la liste pas encore réussi : ils se passent dans l'ordre. */
export function examenSuivant(liste: readonly Examen[], etat: EtatExamens): Examen | null {
  return liste.find((e) => etat.reussis[e.id] === undefined) ?? null;
}

/**
 * L'examen à passer : celui qui est ouvert, ou le suivant dont le palier est atteint.
 * `null` quand aucun n'attend : les briques avancent.
 */
export function examenOuvert(liste: readonly Examen[], etat: EtatExamens, lus: number): Examen | null {
  const suivant = examenSuivant(liste, etat);
  if (suivant === null) return null;
  if (etat.ouvert === suivant.id) return suivant;
  return lus >= suivant.palier ? suivant : null;
}

/** Note l'examen ouvert dans la progression, pour qu'il le reste. Rien à noter : le même état. */
export function ouvrirExamen(liste: readonly Examen[], etat: EtatExamens, lus: number): EtatExamens {
  const e = examenOuvert(liste, etat, lus);
  return e === null || etat.ouvert === e.id ? etat : { ...etat, ouvert: e.id };
}

/**
 * Aucune brique nouvelle tant qu'un examen attend d'être réussi, à passer ou manqué (brief
 * §6, « Journée sans brique nouvelle »). La session s'y branche par `session.pauseDesBriques`.
 */
export function briquesEnPause(liste: readonly Examen[], etat: EtatExamens, lus: number): boolean {
  return examenOuvert(liste, etat, lus) !== null;
}

/* ---------- la reprise ---------- */

/**
 * La reprise est permise quand chaque caractère manqué a été revu juste à son échéance
 * depuis l'échec : une réponse juste, notée quand la carte était due (jamais une révision
 * en avance). Un caractère sans carte ne se revoit pas : il ne retient pas l'examen.
 * Aucune durée n'est lue : seulement l'ordre des révisions et leurs échéances.
 */
export function reprisePermise(t: Tentative, cartes: readonly ReviewCard[]): boolean {
  if (t.echec === null) return false;
  const echec = Date.parse(t.echec);
  return t.manques.every((c) => {
    const carte = cartes.find((k) => k.id === c);
    if (carte === undefined) return true;
    return carte.history.some((h, k) => {
      if (h.at.getTime() <= echec || h.rating === Rating.Again) return false;
      const avant = carte.history[k - 1];
      return avant === undefined || h.at.getTime() >= avant.due.getTime();
    });
  });
}

/** Où en est l'examen, pour le menu et la route. */
export type Situation =
  /** Aucun examen n'attend. */
  | { etat: 'aucun' }
  /** Palier atteint, jamais commencé : « Passer l'examen 县试 ». */
  | { etat: 'a_passer'; examen: Examen }
  /** Commencé : on reprend à la même question. */
  | { etat: 'en_cours'; examen: Examen; tentative: Tentative }
  /** Manqué, les caractères manqués pas encore revus : « L'examen se repasse quand… ». */
  | { etat: 'attente'; examen: Examen; tentative: Tentative }
  /** Manqué, et chaque caractère revu : il se repasse, sur l'autre série. */
  | { etat: 'a_repasser'; examen: Examen; tentative: Tentative };

export function situation(
  liste: readonly Examen[],
  etat: EtatExamens,
  lus: number,
  cartes: readonly ReviewCard[]
): Situation {
  const examen = examenOuvert(liste, etat, lus);
  if (examen === null) return { etat: 'aucun' };
  const t = etat.tentative;
  if (t === null || t.examen !== examen.id) return { etat: 'a_passer', examen };
  if (t.echec === null) return { etat: 'en_cours', examen, tentative: t };
  return reprisePermise(t, cartes)
    ? { etat: 'a_repasser', examen, tentative: t }
    : { etat: 'attente', examen, tentative: t };
}

/**
 * On passe l'examen maintenant ? Hors session, la journée faite ; jamais en rattrapage, la
 * pile redescend d'abord ; manqué, seulement quand la reprise est permise.
 */
export function peutPasser(
  s: Situation,
  moment: { journeeFaite: boolean; rattrapage: boolean }
): boolean {
  if (!moment.journeeFaite || moment.rattrapage) return false;
  return s.etat === 'a_passer' || s.etat === 'en_cours' || s.etat === 'a_repasser';
}

/* ---------- passer l'examen ---------- */

/** La série d'une tentative : A d'abord, puis l'autre à chaque reprise. */
export function serieDeTentative(numero: number): LettreSerie {
  return SERIES[numero % SERIES.length];
}

/**
 * Commence l'examen ouvert, ou reprend la tentative en cours à la même question. Après un
 * échec, la nouvelle tentative prend l'autre série. `poses` : les rangs des questions qu'on
 * posera (`questionsPosables`), figés pour toute la tentative ; vide, toute la série.
 */
export function commencer(
  etat: EtatExamens,
  examen: Examen,
  chemin: CheminExamen,
  poses: readonly number[] = []
): EtatExamens {
  const t = etat.tentative;
  if (t !== null && t.examen === examen.id && t.echec === null) return etat;
  const numero = t !== null && t.examen === examen.id ? t.numero + 1 : 0;
  return {
    ...etat,
    ouvert: examen.id,
    tentative: {
      examen: examen.id,
      chemin,
      serie: serieDeTentative(numero),
      numero,
      poses: [...poses],
      i: 0,
      essais: [],
      reponses: [],
      rattrapees: 0,
      manques: [],
      echec: null
    }
  };
}

/** La série de la tentative, telle que l'export la porte ; `null` si elle manque. */
export function serieDe(d: ExamensDonnees, t: Tentative): SerieExamen | null {
  return examenDuChemin(d, t.chemin, t.examen)?.series[t.serie] ?? null;
}

/** Les questions de la tentative, dans l'ordre où on les pose. */
export function questionsDe(serie: SerieExamen, t: Tentative): QuestionExamen[] {
  if (t.poses.length === 0) return serie.questions;
  return t.poses.map((k) => serie.questions[k]).filter((q): q is QuestionExamen => q !== undefined);
}

/**
 * Les rangs des questions posables d'une série, pour `commencer` : celles dont chaque
 * caractère a une carte, comme un dialogue WeChat.
 */
export function rangsPosables(serie: SerieExamen, avecCarte: ReadonlySet<string>): number[] {
  return serie.questions.flatMap((q, k) => (q.caracteres.every((c) => avecCarte.has(c)) ? [k] : []));
}

/** La réponse est-elle juste ? Le rang du choix, ou vrai ou faux. */
export function corriger(q: QuestionExamen, donnee: number | boolean): boolean {
  return donnee === q.reponse;
}

/**
 * La question en cours est-elle close ? La bonne réponse touchée, au premier essai ou au
 * second ; au vrai ou faux, dès la première réponse : il n'y a que deux choix, et le second
 * ne ferait rien lire de plus.
 */
export function questionFinie(q: QuestionExamen, essais: readonly (number | boolean)[]): boolean {
  if (essais.length === 0) return false;
  return q.type === 'vrai_faux' || essais.some((x) => corriger(q, x));
}

/* ---------- ce que Tao dit après une réponse ---------- */

/** Une ligne de l'écran, jetons remplis (`texteExamen` sur les données de l'examen). */
export type Dire = (cle: string, valeurs?: Readonly<Record<string, string | number>>) => string;

/** Le retour d'une réponse : juste, rattrapée ou pas celle-là, ce qu'on lit, et la suite. */
export type Retour = { ok: boolean; titre: string; texte: string; suite: string };

/** La glose de la série : ce que Tao dit d'un mot, « 古玩 gǔ wán : antiquités ». */
export function gloseDe(serie: SerieExamen, zh: string): string {
  const g = serie.glose[zh];
  return g ? `${zh} ${g.pinyin} : ${g.fr}` : '';
}

/**
 * Les mots du support qui portent la réponse, glosés (au plus trois, dans l'ordre du
 * texte) : l'explication d'une mise en situation, une fois la question close.
 */
export function gloseDesPortes(serie: SerieExamen, support: Support | null, q: QuestionExamen): string {
  const porte = new Set(q.porte);
  const texte = support?.lignes.map((l) => l.zh).join('') ?? '';
  return Object.keys(serie.glose)
    .filter((zh) => [...zh].some((c) => porte.has(c)) && [...zh].every((c) => porte.has(c)) && texte.includes(zh))
    .sort((a, b) => b.length - a.length)
    .filter((zh, k, l) => !l.slice(0, k).some((plus) => plus.includes(zh)))
    .sort((a, b) => texte.indexOf(a) - texte.indexOf(b))
    .slice(0, 3)
    .map((zh) => gloseDe(serie, zh))
    .filter((g) => g !== '')
    .join(' · ');
}

/** L'explication complète, ce que la bonne réponse fait lire : seulement la question close. */
export function explication(q: QuestionExamen, serie: SerieExamen, support: Support | null, dire: Dire): string {
  if (q.objet !== undefined && (q.type === 'sens' || q.type === 'caractere' || q.type === 'trou' || q.type === 'ton')) {
    return `${q.objet.zh} ${q.objet.pinyin} : ${q.objet.fr}`;
  }
  if (q.type === 'vrai_faux' && q.affirmation !== undefined) {
    return dire(q.reponse === true ? 'vf_vrai' : 'vf_faux', { fr: q.affirmation.fr });
  }
  const bonne = q.choix[q.reponse as number];
  if (q.type === 'replique' && bonne !== undefined && typeof bonne === 'object' && 'zh' in bonne) return `« ${bonne.fr} »`;
  return gloseDesPortes(serie, support, q);
}

/**
 * Ce qui, lu dans un retour, donnerait la bonne réponse : son texte chinois (le caractère, le
 * mot, la réplique, le mot entier du trou), son français, sa syllabe.
 */
function indicesDeLaReponse(q: QuestionExamen): string[] {
  const bonne = typeof q.reponse === 'number' ? q.choix[q.reponse] : undefined;
  const out: string[] = [];
  if (typeof bonne === 'string') out.push(bonne);
  else if (bonne !== undefined) {
    out.push(bonne.fr);
    const zh = (bonne as Partial<Phrase>).zh;
    if (typeof zh === 'string') out.push(zh);
  }
  if (q.objet !== undefined && q.type !== 'sens') out.push(q.objet.zh);
  if (q.objet !== undefined && q.type === 'sens') out.push(q.objet.fr);
  return out.filter((x) => x.trim() !== '');
}

/**
 * Ce que dit une réponse fausse quand un autre essai reste permis (signalement du
 * propriétaire du 29 septembre 2026) : jamais la bonne réponse, ni directement ni par une
 * glose. Au plus ce que veut dire le choix touché, pour relire avant le second essai :
 *
 * - `comprendre` : une invitation à relire le support (`ko_comprendre`), jamais la glose des
 *   caractères qui portent la réponse ; ses choix sont en français, ils n'ont pas de glose ;
 * - `reperer`, `caractere`, `trou` : la glose du mot ou du caractère touché ;
 * - `replique` : ce que dit la réplique touchée (`ko_replique`) ;
 * - `ton` : la syllabe touchée n'est pas la bonne (`ko_ton`) ;
 * - `sens` : rien, le choix touché se lit déjà en français ;
 * - `vrai_faux` n'a pas de second essai : la réponse se montre (`explication`).
 *
 * Un texte qui contiendrait quand même la bonne réponse (la glose d'un leurre qui la
 * porte) se tait.
 */
export function retourSecondEssai(q: QuestionExamen, donnee: number | boolean, serie: SerieExamen, dire: Dire): string {
  const touche = typeof donnee === 'number' ? q.choix[donnee] : undefined;
  let texte = '';
  if (q.type === 'comprendre') texte = dire('ko_comprendre');
  else if (q.type === 'reperer' || q.type === 'caractere' || q.type === 'trou') texte = gloseDe(serie, String(touche ?? ''));
  else if (q.type === 'replique' && touche !== undefined && typeof touche === 'object') texte = dire('ko_replique', { fr: touche.fr });
  else if (q.type === 'ton') texte = dire('ko_ton', { syllabe: String(touche ?? '') });
  return indicesDeLaReponse(q).some((x) => texte.includes(x)) ? '' : texte;
}

/**
 * Le retour après le dernier essai d'une question : `null` avant toute réponse. Juste ou
 * rattrapée, l'explication complète ; au vrai ou faux, la réponse se montre, sans second
 * essai ; faux avec un essai qui reste, `retourSecondEssai` et « Encore un essai ? ».
 */
export function retourQuestion(
  q: QuestionExamen,
  essais: readonly (number | boolean)[],
  serie: SerieExamen,
  support: Support | null,
  dire: Dire
): Retour | null {
  const dernier = essais[essais.length - 1];
  if (dernier === undefined) return null;
  if (corriger(q, dernier)) {
    const premier = essais.length === 1;
    return {
      ok: true,
      titre: dire(premier ? 'juste' : 'rattrapee'),
      texte: explication(q, serie, support, dire),
      suite: premier ? '' : dire('rattrapee_suite')
    };
  }
  if (questionFinie(q, essais)) return { ok: false, titre: dire('pas_celle'), texte: explication(q, serie, support, dire), suite: '' };
  return { ok: false, titre: dire('pas_celle'), texte: retourSecondEssai(q, dernier, serie, dire), suite: dire('encore') };
}

/** Ce qu'une réponse touchée a fait : rien (déjà touchée, question close), ou un essai. */
export type Essai = {
  etat: EtatExamens;
  /** L'essai compte : la réponse n'avait pas été touchée, la question n'était pas close. */
  nouveau: boolean;
  juste: boolean;
  /** Le premier essai de la question : c'est lui qui compte, et qui note en révision. */
  premier: boolean;
  /** Juste au second essai (ou plus) : le point 读, sans le premier coup. */
  rattrapee: boolean;
};

/**
 * Touche une réponse à la question `i` (`q`), une seconde chance comprise. Le premier essai
 * est noté, juste ou non ; une erreur ajoute les caractères qui portent la réponse aux
 * manqués. Après une erreur, une autre réponse peut encore être touchée : juste, elle est
 * rattrapée. Rien ne se note deux fois (la même réponse, une question close, quitter et
 * revenir), ni hors de la tentative en cours.
 */
export function essayer(etat: EtatExamens, i: number, q: QuestionExamen, donnee: number | boolean): Essai {
  const rien: Essai = { etat, nouveau: false, juste: false, premier: false, rattrapee: false };
  const t = etat.tentative;
  if (t === null || t.echec !== null || i !== t.i) return rien;
  if (questionFinie(q, t.essais) || t.essais.includes(donnee)) return rien;
  const juste = corriger(q, donnee);
  const premier = t.reponses.length === i;
  const rattrapee = !premier && juste;
  const manques = premier && !juste ? [...new Set([...t.manques, ...q.porte])] : t.manques;
  return {
    etat: {
      ...etat,
      tentative: {
        ...t,
        essais: [...t.essais, donnee],
        reponses: premier ? [...t.reponses, juste] : t.reponses,
        rattrapees: t.rattrapees + (rattrapee ? 1 : 0),
        manques
      }
    },
    nouveau: true,
    juste,
    premier,
    rattrapee
  };
}

/** Passe à la question suivante, une fois la question `i` répondue au moins une fois. */
export function avancer(etat: EtatExamens, i: number): EtatExamens {
  const t = etat.tentative;
  if (t === null || t.echec !== null || i !== t.i || t.reponses.length <= i) return etat;
  return { ...etat, tentative: { ...t, i: i + 1, essais: [] } };
}

/** Ce que la révision reçoit d'une réponse d'examen : juste, Bien (sans chronomètre) ; faux, Oublié. */
export function issue(juste: boolean): Outcome {
  return juste ? { correct: true, tries: 0, seconds: SECONDES_RAPIDE } : { correct: false, tries: 1, seconds: SECONDES_RAPIDE };
}

/** Les réponses justes qu'il faut : quatre sur cinq, arrondi au-dessus. */
export function reussite(questions: number, regle: Regle = REGLE_DEFAUT): number {
  return Math.ceil((questions * regle.justes) / regle.sur);
}

/**
 * Le constat : les justes du premier essai sur les questions posées, et les rattrapées, qui
 * donnent leur point 读 sans compter pour la réussite.
 */
export type Bilan = { justes: number; questions: number; reussite: number; recu: boolean; rattrapees: number };

export function bilan(reponses: readonly boolean[], questions: number, regle: Regle = REGLE_DEFAUT, rattrapees = 0): Bilan {
  const justes = reponses.filter(Boolean).length;
  const seuil = reussite(questions, regle);
  return { justes, questions, reussite: seuil, recu: questions > 0 && justes >= seuil, rattrapees };
}

/**
 * Termine la tentative, toutes les questions posées. Reçu : l'examen est noté réussi à la
 * journée `jour`, et le suivant s'ouvrira si son palier est atteint. Pas encore : l'échec
 * est noté à l'instant `maintenant`, les manqués attendent d'être revus.
 */
export function terminer(
  etat: EtatExamens,
  questions: number,
  maintenant: Date,
  jour: string,
  regle: Regle = REGLE_DEFAUT
): { etat: EtatExamens; bilan: Bilan } {
  const t = etat.tentative;
  if (t === null || t.echec !== null) return { etat, bilan: bilan([], 0, regle) };
  const b = bilan(t.reponses, questions, regle, t.rattrapees);
  if (b.recu) {
    return {
      etat: { ...etat, reussis: { ...etat.reussis, [t.examen]: jour }, ouvert: null, tentative: null },
      bilan: b
    };
  }
  return { etat: { ...etat, tentative: { ...t, echec: maintenant.toISOString() } }, bilan: b };
}

/**
 * Les questions que l'app garde d'une série : celles dont chaque caractère montré a une
 * carte, comme un dialogue WeChat. La règle de réussite se lit sur celles-là.
 */
export function questionsPosables(serie: SerieExamen, avecCarte: ReadonlySet<string>): QuestionExamen[] {
  return serie.questions.filter((q) => q.caracteres.every((c) => avecCarte.has(c)));
}

/* ---------- ce que l'écran montre (8.3) ---------- */

/**
 * Un caractère manqué, et où on l'a croisé : le support de la première question manquée qui
 * le porte (son contexte, « Une enseigne dans une vieille rue »), ou `null` pour la revue de
 * l'acquis.
 */
export type Manque = { c: string; support: Support | null };

export function manquesDetailles(serie: SerieExamen, t: Tentative): Manque[] {
  const qs = questionsDe(serie, t);
  const out: Manque[] = [];
  t.reponses.forEach((juste, k) => {
    const q = qs[k];
    if (juste || q === undefined) return;
    const support = q.support === undefined ? null : (serie.supports.find((s) => s.id === q.support) ?? null);
    for (const c of q.porte) if (!out.some((m) => m.c === c)) out.push({ c, support });
  });
  return out;
}

/** Le prochain examen à titre après `id` : la borne que le résultat et le 放榜 annoncent. */
export function prochainATitre(liste: readonly Examen[], id: string): Examen | null {
  const i = liste.findIndex((e) => e.id === id);
  return i < 0 ? null : (liste.slice(i + 1).find((e) => e.sorte === 'titre') ?? null);
}

/**
 * L'examen à titre qui donne le titre avec celui-ci : le 县试 n'en donne pas, le 府试 qui le
 * suit donne 童生 « avec le 县试 ». `null` si l'examen donne lui-même son titre, ou un 月课.
 */
export function titreAvec(liste: readonly Examen[], e: Examen): Examen | null {
  if (e.sorte !== 'titre' || e.titre !== null) return null;
  const suivant = prochainATitre(liste, e.id);
  return suivant !== null && suivant.titre !== null ? suivant : null;
}

/** Les genres des supports d'une série, dans l'ordre, sans doublon : « une enseigne, un billet ». */
export function genresDe(serie: SerieExamen): GenreSupport[] {
  return [...new Set(serie.supports.map((s) => s.genre))];
}

/**
 * Découpe une ligne de l'écran en morceaux : `**…**` en gras, par paires, comme le pipeline
 * le contrôle. Le reste tel quel.
 */
export function morceaux(texte: string): { t: string; gras: boolean }[] {
  return texte
    .split('**')
    .map((t, k) => ({ t, gras: k % 2 === 1 }))
    .filter((m) => m.t !== '');
}

/**
 * Une ligne d'un support découpée pour le repérage : les mots proposés (`mots`, le plus long
 * d'abord là où deux commencent au même endroit) deviennent des morceaux à toucher, avec
 * leur rang ; le reste, caractère par caractère, `mot` à -1.
 */
export function decouperLigne(zh: string, mots: readonly string[]): { t: string; mot: number }[] {
  const out: { t: string; mot: number }[] = [];
  const ordre = mots.map((m, k) => ({ m, k })).sort((a, b) => b.m.length - a.m.length);
  let i = 0;
  while (i < zh.length) {
    const trouve = ordre.find(({ m }) => m !== '' && zh.startsWith(m, i));
    if (trouve) {
      out.push({ t: trouve.m, mot: trouve.k });
      i += trouve.m.length;
    } else {
      out.push({ t: zh[i], mot: -1 });
      i += 1;
    }
  }
  return out;
}

/** Les chiffres chinois d'un nombre de 1 à 99 : 十二, 二十九. */
function chiffres(n: number): string {
  const C = '〇一二三四五六七八九';
  if (n < 10) return C[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return `${d === 1 ? '' : C[d]}十${u === 0 ? '' : C[u]}`;
}

/** La date du 放榜, en chiffres chinois, depuis la journée (AAAA-MM-JJ) : 九月二十九日. */
export function dateDuBang(jour: string): string {
  const [, m, j] = jour.split('-').map(Number);
  if (!m || !j) return '';
  return `${chiffres(m)}月${chiffres(j)}日`;
}

/* ---------- les rangs : points ET examen ---------- */

/** Un rang tel que `heros.json` le donne : son titre, son seuil de points. */
export type RangSeuil = { hz: string; seuil: number };

/**
 * Le rang accordé (décision du 26 septembre 2026, « Points ET examen ») : dans l'ordre, sans
 * en sauter un, chaque rang demande ses points ; un titre d'examen demande aussi l'examen
 * réussi, et les examens à titre avant lui (童生 : le 县试 et le 府试) ; une nomination, son
 * palier de caractères lus. Un 月课 n'entre dans aucun rang.
 */
export function rangAccorde(
  points: number,
  rangs: readonly RangSeuil[],
  donnees: Pick<ExamensDonnees, 'examens' | 'nominations'>,
  reussis: Readonly<Record<string, string>>,
  lus: number
): number {
  let n = 0;
  for (let k = 1; k < rangs.length; k++) {
    const r = rangs[k];
    if (points < r.seuil) break;
    const i = donnees.examens.findIndex((e) => e.titre === r.hz);
    if (i >= 0) {
      const requis = donnees.examens.slice(0, i + 1).filter((e) => e.sorte === 'titre');
      if (!requis.every((e) => reussis[e.id] !== undefined)) break;
    }
    const nomination = donnees.nominations.find((x) => x.rang === r.hz);
    if (nomination !== undefined && lus < nomination.palier) break;
    n = k;
  }
  return n;
}

/** Ce qui retient le rang suivant, pour « Mon personnage » : les points, l'examen, le palier. */
export type Reste =
  | { attend: 'rien' }
  | { attend: 'points'; manque: number }
  | { attend: 'examen'; examen: Examen }
  | { attend: 'palier'; palier: number };

export function resteAuRangSuivant(
  points: number,
  rangs: readonly RangSeuil[],
  donnees: Pick<ExamensDonnees, 'examens' | 'nominations'>,
  reussis: Readonly<Record<string, string>>,
  lus: number
): Reste {
  const n = rangAccorde(points, rangs, donnees, reussis, lus);
  const suivant = rangs[n + 1];
  if (suivant === undefined) return { attend: 'rien' };
  const i = donnees.examens.findIndex((e) => e.titre === suivant.hz);
  if (i >= 0) {
    const manquant = donnees.examens.slice(0, i + 1).find((e) => e.sorte === 'titre' && reussis[e.id] === undefined);
    if (manquant !== undefined) return { attend: 'examen', examen: manquant };
  }
  const nomination = donnees.nominations.find((x) => x.rang === suivant.hz);
  if (nomination !== undefined && lus < nomination.palier) return { attend: 'palier', palier: nomination.palier };
  return { attend: 'points', manque: Math.max(0, suivant.seuil - points) };
}

/**
 * Une progression d'avant les examens garde ses rangs déjà annoncés : les examens en
 * dessous, 月课 compris, sont notés reçus à la journée de la mise à jour. Le suivant
 * s'ouvrira de lui-même si son palier est atteint. Une seule fois (`migre`).
 */
export function migrerRangsAnnonces(
  etat: EtatExamens,
  rangAnnonce: number,
  rangs: readonly RangSeuil[],
  liste: readonly Examen[],
  jour: string
): EtatExamens {
  if (etat.migre) return etat;
  let dernier = -1;
  liste.forEach((e, i) => {
    if (e.titre === null) return;
    const k = rangs.findIndex((r) => r.hz === e.titre);
    if (k >= 0 && k <= rangAnnonce) dernier = i;
  });
  const reussis = { ...etat.reussis };
  for (const e of liste.slice(0, dernier + 1)) reussis[e.id] ??= jour;
  const ouvert = etat.ouvert !== null && reussis[etat.ouvert] !== undefined ? null : etat.ouvert;
  const tentative = etat.tentative !== null && reussis[etat.tentative.examen] !== undefined ? null : etat.tentative;
  return { reussis, ouvert, tentative, migre: true };
}
