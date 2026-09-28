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
 *   stabilité de Ma forêt (le compte du trophée Lire, `foret.caracteresLus`) ; les examens
 *   se passent dans l'ordre, et un examen ouvert le reste jusqu'à sa réussite ;
 * - tant qu'un examen est ouvert, à passer ou manqué, aucune brique nouvelle n'entre
 *   (`briquesEnPause`) ; il se passe hors session, la journée faite, jamais en rattrapage ;
 * - reçu à quatre réponses sur cinq justes du premier essai (douze sur quinze, huit sur
 *   dix) ; une bonne réponse note ses caractères par `grade` (Bien : l'examen ne chronomètre
 *   pas) et donne un point 读, une erreur les note faux ;
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

/** Un examen sur un chemin : le jour du palier, le tronçon, les séries relues. */
export type ExamenDuChemin = {
  examen: string;
  jour: number;
  troncon: string[];
  series: Partial<Record<LettreSerie, SerieExamen>>;
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
export const REGLE_DEFAUT = { justes: 4, sur: 5 } as const;

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
      parcours[chemin].push({ examen: texte(x.examen), jour, troncon: chaines(x.troncon), series });
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

/* ---------- la progression ---------- */

/** Une tentative : en cours tant que `echec` est nul, manquée sinon. */
export type Tentative = {
  examen: string;
  chemin: CheminExamen;
  serie: LettreSerie;
  /** Les tentatives déjà manquées de cet examen avant celle-ci : la série en découle. */
  numero: number;
  /** La question en cours : « Quitter » reprend à celle-ci. */
  i: number;
  /** Juste du premier essai, question par question, dans l'ordre posé. */
  reponses: boolean[];
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
  const i = entier(o.i) ?? reponses.length;
  const echec = typeof o.echec === 'string' && !Number.isNaN(Date.parse(o.echec)) ? o.echec : null;
  return {
    examen: texte(o.examen),
    chemin: o.chemin,
    serie: o.serie,
    numero: entier(o.numero) ?? 0,
    i: Math.max(i, reponses.length),
    reponses,
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

/** Les caractères lus : ceux de Ma forêt, au seuil de stabilité, le compte du trophée Lire. */
export function lusPourExamens(
  familles: readonly Famille[],
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): number {
  return caracteresLus(familles, cartes, seuil);
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
 * §6, « Journée sans brique nouvelle »). La session l'appellera ; rien ne l'y branche encore.
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
 * échec, la nouvelle tentative prend l'autre série.
 */
export function commencer(etat: EtatExamens, examen: Examen, chemin: CheminExamen): EtatExamens {
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
      i: 0,
      reponses: [],
      manques: [],
      echec: null
    }
  };
}

/** La réponse est-elle juste ? Le rang du choix, ou vrai ou faux. */
export function corriger(q: QuestionExamen, donnee: number | boolean): boolean {
  return donnee === q.reponse;
}

/**
 * Note la réponse à la question `i`, juste ou non du premier essai. Une question déjà
 * notée ne se note pas deux fois (quitter entre la réponse et la suivante), et rien ne se
 * note hors d'une tentative en cours. Une erreur ajoute les caractères qui portent la
 * réponse aux manqués.
 */
export function repondre(etat: EtatExamens, i: number, juste: boolean, porte: readonly string[]): EtatExamens {
  const t = etat.tentative;
  if (t === null || t.echec !== null || i !== t.reponses.length) return etat;
  const manques = juste ? t.manques : [...new Set([...t.manques, ...porte])];
  return { ...etat, tentative: { ...t, i: i + 1, reponses: [...t.reponses, juste], manques } };
}

/** Ce que la révision reçoit d'une réponse d'examen : juste, Bien (sans chronomètre) ; faux, Oublié. */
export function issue(juste: boolean): Outcome {
  return juste ? { correct: true, tries: 0, seconds: SECONDES_RAPIDE } : { correct: false, tries: 1, seconds: SECONDES_RAPIDE };
}

/** Les réponses justes qu'il faut : quatre sur cinq, arrondi au-dessus. */
export function reussite(questions: number, regle: { justes: number; sur: number } = REGLE_DEFAUT): number {
  return Math.ceil((questions * regle.justes) / regle.sur);
}

export type Bilan = { justes: number; questions: number; reussite: number; recu: boolean };

/** Le constat : les justes du premier essai sur les questions posées. */
export function bilan(reponses: readonly boolean[], questions: number, regle = REGLE_DEFAUT): Bilan {
  const justes = reponses.filter(Boolean).length;
  const seuil = reussite(questions, regle);
  return { justes, questions, reussite: seuil, recu: questions > 0 && justes >= seuil };
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
  regle = REGLE_DEFAUT
): { etat: EtatExamens; bilan: Bilan } {
  const t = etat.tentative;
  if (t === null || t.echec !== null) return { etat, bilan: bilan([], 0, regle) };
  const b = bilan(t.reponses, questions, regle);
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
