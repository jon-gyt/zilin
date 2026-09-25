/**
 * Le message WeChat (story 4b.7) : un ami, toujours le même, écrit un court message en
 * chinois ; on choisit la bonne réponse parmi trois ou quatre répliques, toutes écrites
 * avec l'acquis. La réplique choisie s'ajoute à la conversation, l'ami répond, et ainsi
 * de suite, deux à quatre échanges.
 *
 * Ce qu'il fait lire de plus : un message entier, puis trois ou quatre phrases qu'il faut
 * comprendre pour écarter celles qui parlent d'autre chose (hors sujet) ou qui lisent mal
 * le message (contresens : 今天 pour 明天, 茶 pour 菜).
 *
 * Ce qui se note, décision du propriétaire pour les jeux de sens : une mauvaise réplique
 * n'émet aucun événement de révision. Elle est écartée, on en choisit une autre. Une
 * bonne réplique trouvée du premier coup note ses caractères (`notes` de l'export : ceux
 * que le dialogue n'a pas déjà notés) par `grade` de `srs.ts`, comme une question de
 * révision. Trouvée après un essai faux, elle ne note rien non plus : l'erreur d'un jeu de
 * sens ne dit pas quel caractère a été mal lu, et la reprise se fait par élimination.
 * Pas de chronomètre, pas de vie, pas de point.
 *
 * Un dialogue ne se propose que lorsque tous ses caractères sont acquis (`caracteres` :
 * les messages, la bonne réplique et les mauvaises, qu'on lit pour les écarter), à la
 * stabilité de `srs.ts`, sans repli de démonstration. Tout le texte vient de `wechat.json`,
 * rédigé et contrôlé dans le pipeline (`data/sources/wechat/`), avec le pinyin de chaque
 * caractère (`syllabes`) que la bulle montre au toucher : l'app n'en écrit aucun.
 *
 * Les règles sont pures, comme `jeux.ts` : aucune horloge, aucun stockage, aucun
 * `Math.random`. Seul `wechatOnce` lit le réseau local, les assets de l'app.
 *
 * Reste à faire : le brancher au pas Utiliser (brief §9, « dès la 2e semaine »), ce qui
 * demanderait une vue de plus dans `Use.svelte` et la reprise au pas exact de `session.ts`.
 * Il s'ouvre pour l'instant depuis Jouer.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';
import type { Manche, Tour } from './jeux';
import { melange } from './questions';
import type { Revision } from './session';

/* ---------- les données ---------- */

/** Un texte chinois, son pinyin, ses traductions, et le pinyin de chacun de ses caractères. */
export type TexteWechat = { zh: string; pinyin: string; fr: string; en: string; syllabes: string[] };

/** Ce qui cloche dans une mauvaise réplique. */
export type Erreur = 'hors-sujet' | 'contresens';

/** Une réplique : la bonne (`juste`), ou une mauvaise, avec ce qui cloche. */
export type Replique = TexteWechat & { juste: boolean; erreur: Erreur | '' };

/** Un échange : le message de l'ami, ses répliques, les caractères que la bonne note. */
export type Echange = { ami: TexteWechat; repliques: Replique[]; notes: string[] };

export type Dialogue = {
  id: string;
  /** Le caractère clé : il rattache le dialogue à sa famille. */
  cle: string;
  /** La racine de la famille du caractère clé, pour trouver ses traits. */
  famille: string;
  fr: string;
  en: string;
  echanges: Echange[];
  /** Le mot de la fin de l'ami, sans réplique ; `null` s'il n'y en a pas. */
  fin: TexteWechat | null;
  /** Les caractères à avoir acquis pour le lire : tous, les mauvaises répliques comprises. */
  caracteres: string[];
  /** Par parcours, le jour où il devient possible ; `null` si le parcours n'y mène pas. */
  jours: Record<string, number | null>;
};

/** L'ami qui écrit : un nom et une ligne, ni photo ni emoji. */
export type Ami = { zh: string; pinyin: string; fr: string; en: string };

/** `wechat.json`. */
export type WechatDonnees = {
  version: string;
  source: string;
  ami: Ami;
  dialogues: Dialogue[];
  racines: Record<string, string>;
};

const HAN = /\p{Script=Han}/u;

/** Les sinogrammes d'un texte, dans l'ordre, sans la ponctuation. */
export function sinogrammes(texte: string): string[] {
  return [...texte].filter((c) => HAN.test(c));
}

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function textes(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

/** Un texte lisible, ou `null`. Des syllabes qui ne tombent pas juste sont oubliées. */
function lireTexte(v: unknown): TexteWechat | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const zh = texte(o.zh);
  if (zh === '') return null;
  const s = textes(o.syllabes);
  return {
    zh,
    pinyin: texte(o.pinyin),
    fr: texte(o.fr),
    en: texte(o.en),
    syllabes: s.length === sinogrammes(zh).length ? s : []
  };
}

function lireReplique(v: unknown): Replique | null {
  const t = lireTexte(v);
  if (t === null) return null;
  const o = v as Record<string, unknown>;
  const erreur = o.erreur === 'hors-sujet' || o.erreur === 'contresens' ? o.erreur : '';
  return { ...t, juste: o.juste === true, erreur };
}

/** Un échange lisible, ou `null` : une bonne réplique exactement, et au moins une mauvaise. */
function lireEchange(v: unknown): Echange | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const ami = lireTexte(o.ami);
  const vues = new Set<string>();
  const repliques = (Array.isArray(o.repliques) ? o.repliques : []).flatMap((r) => {
    const x = lireReplique(r);
    if (x === null || vues.has(x.zh)) return [];
    vues.add(x.zh);
    return [x];
  });
  const justes = repliques.filter((r) => r.juste);
  if (ami === null || justes.length !== 1 || repliques.length < 2) return null;
  const notes = textes(o.notes).filter((c) => justes[0].zh.includes(c));
  return { ami, repliques, notes };
}

function lireDialogue(v: unknown): Dialogue | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const id = texte(o.id);
  const echanges = (Array.isArray(o.echanges) ? o.echanges : []).map(lireEchange);
  const caracteres = textes(o.caracteres);
  /* Un échange illisible casse le fil : le dialogue tombe entier. */
  if (id === '' || echanges.length === 0 || echanges.some((e) => e === null) || caracteres.length === 0) {
    return null;
  }
  const jours: Record<string, number | null> = {};
  if (typeof o.jours === 'object' && o.jours !== null) {
    for (const [nom, j] of Object.entries(o.jours as Record<string, unknown>)) {
      jours[nom] = typeof j === 'number' ? j : null;
    }
  }
  return {
    id,
    cle: texte(o.cle),
    famille: texte(o.famille),
    fr: texte(o.fr),
    en: texte(o.en),
    echanges: echanges as Echange[],
    fin: lireTexte(o.fin),
    caracteres,
    jours
  };
}

/**
 * Lit `wechat.json`. Un dialogue mal formé tombe : mieux vaut un message de moins qu'une
 * conversation qui ne tient pas.
 */
export function lireWechat(brut: unknown): WechatDonnees {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const vus = new Set<string>();
  const dialogues = (Array.isArray(o.dialogues) ? o.dialogues : []).flatMap((v) => {
    const d = lireDialogue(v);
    if (d === null || vus.has(d.id)) return [];
    vus.add(d.id);
    return [d];
  });
  const a = (typeof o.ami === 'object' && o.ami !== null ? o.ami : {}) as Record<string, unknown>;
  const racines: Record<string, string> = {};
  if (typeof o.racines === 'object' && o.racines !== null) {
    for (const [c, r] of Object.entries(o.racines as Record<string, unknown>)) {
      if (typeof r === 'string') racines[c] = r;
    }
  }
  return {
    version: texte(o.version),
    source: texte(o.source),
    ami: { zh: texte(a.zh), pinyin: texte(a.pinyin), fr: texte(a.fr), en: texte(a.en) },
    dialogues,
    racines
  };
}

/** Aucun dialogue : ce que rend un export sans `wechat.json`. Le jeu se tait. */
export const SANS_WECHAT: WechatDonnees = {
  version: '',
  source: '',
  ami: { zh: '', pinyin: '', fr: '', en: '' },
  dialogues: [],
  racines: {}
};

/** Le fichier du message WeChat d'une version, tel que l'index le nomme. */
export function fichierWechat(i: Index): string {
  return i.wechat ? `${dossierVersion(i.version)}/${i.wechat}` : '';
}

/** Lit et valide un fichier de dialogues. `fetchFn` est injecté dans les tests. */
export async function loadWechat(file: string, fetchFn: typeof fetch = fetch): Promise<WechatDonnees> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Message WeChat introuvable : ${file} (${r.status})`);
  return lireWechat(await r.json());
}

const lesWechat = new Map<string, Promise<WechatDonnees>>();

/** Les dialogues de la version courante, lus une fois pour toute la durée de vie de l'app. */
export function wechatOnce(version = VERSION_DONNEES): Promise<WechatDonnees> {
  let p = lesWechat.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierWechat(i);
        return file === '' ? SANS_WECHAT : loadWechat(file);
      })
      .catch((e) => {
        lesWechat.delete(version);
        throw e;
      });
    lesWechat.set(version, p);
  }
  return p;
}

/* ---------- ce qui se lit ---------- */

/** Ce que les jeux lisent du message WeChat : les dialogues, l'acquis réel, le parcours. */
export type Wechat = {
  donnees: WechatDonnees;
  /** Les caractères acquis, au seuil de stabilité de `srs.ts`. Jamais l'acquis de démonstration. */
  acquis: readonly string[];
  /** Le parcours suivi, qui range les dialogues : le plus récent d'abord. */
  parcours?: string | null;
};

/** Les caractères du dialogue qui ne sont pas encore acquis, dans l'ordre du dialogue. */
export function manquants(d: Dialogue, acquis: readonly string[]): string[] {
  const a = new Set(acquis);
  return d.caracteres.filter((c) => !a.has(c));
}

/** Un dialogue ne se lit que lorsque tous ses caractères sont acquis. */
export function jouable(d: Dialogue, acquis: readonly string[]): boolean {
  return d.caracteres.length > 0 && manquants(d, acquis).length === 0;
}

/** Le jour du parcours où le dialogue devient possible ; à défaut, le plus tôt de tous. */
function jourDe(d: Dialogue, parcours: string | null | undefined): number {
  const j = parcours ? d.jours[parcours] : undefined;
  if (typeof j === 'number') return j;
  const tous = Object.values(d.jours).filter((x): x is number => x !== null);
  return tous.length > 0 ? Math.min(...tous) : Number.MAX_SAFE_INTEGER;
}

/**
 * Les dialogues jouables, le plus récent du parcours d'abord : celui qu'on vient de
 * débloquer fait lire ce qu'on vient d'apprendre. À jour égal, l'ordre de l'export.
 */
export function dialoguesJouables(w: Wechat): Dialogue[] {
  const rang = new Map(w.donnees.dialogues.map((d, k) => [d.id, k]));
  return w.donnees.dialogues
    .filter((d) => jouable(d, w.acquis))
    .sort((a, b) => jourDe(b, w.parcours) - jourDe(a, w.parcours) || rang.get(a.id)! - rang.get(b.id)!);
}

/** Les prochains dialogues, pas encore jouables : ceux à qui il manque le moins, au plus `n`. */
export function prochains(w: Wechat, n = 3): Dialogue[] {
  return w.donnees.dialogues
    .filter((d) => !jouable(d, w.acquis))
    .map((d, k) => ({ d, k, reste: manquants(d, w.acquis).length }))
    .sort((a, b) => a.reste - b.reste || a.k - b.k)
    .slice(0, n)
    .map((x) => x.d);
}

/** Une bulle, caractère par caractère : le signe, et son pinyin pour un sinogramme. */
export type Jeton = { c: string; py: string | null };

/**
 * Découpe un texte en jetons pour la bulle : un sinogramme porte sa syllabe (celle de
 * l'export), la ponctuation n'en porte pas. Sans syllabes, chaque sinogramme a une
 * syllabe vide : la bulle montre alors le pinyin du texte entier.
 */
export function jetons(t: TexteWechat): Jeton[] {
  let k = 0;
  return [...t.zh].map((c) => {
    if (!HAN.test(c)) return { c, py: null };
    const py = t.syllabes[k] ?? '';
    k += 1;
    return { c, py };
  });
}

/** La ponctuation qui ouvre : elle s'attache au caractère qui la suit. */
const OUVRANTE = /[“‘《（(「『]/u;

/**
 * Les jetons groupés pour la mise en ligne : chaque sinogramme avec la ponctuation qui
 * le suit (et celle qui ouvre, devant lui). Une ligne ne se coupe qu'entre deux grappes :
 * un « ？ » ne se retrouve jamais seul en tête de ligne.
 */
export function grappes(t: TexteWechat): Jeton[][] {
  const out: Jeton[][] = [];
  let devant: Jeton[] = [];
  for (const j of jetons(t)) {
    if (j.py !== null) {
      out.push([...devant, j]);
      devant = [];
    } else if (OUVRANTE.test(j.c) || out.length === 0) {
      devant.push(j);
    } else {
      out[out.length - 1].push(j);
    }
  }
  if (devant.length > 0) out.push(devant);
  return out;
}

/* ---------- la conversation ---------- */

/**
 * Les tours d'un dialogue : un par échange. Le message de l'ami est l'énoncé, les
 * répliques sont mélangées d'après la graine. Le tour note le premier caractère de
 * `notes` (`c`) et les autres avec lui (`aussi`) ; `c` est vide quand la bonne réplique
 * n'a rien de neuf à noter.
 */
export function toursWechat(d: Dialogue, graine: string): Tour[] {
  return d.echanges.map((e, k) => {
    const juste = e.repliques.find((r) => r.juste)!;
    return {
      c: e.notes[0] ?? '',
      aussi: e.notes.slice(1),
      enonce: e.ami.zh,
      reponse: [juste.zh],
      choix: melange(
        e.repliques.map((r) => r.zh),
        `${graine}/${d.id}/${k}`
      ),
      ordre: false,
      paire: false
    };
  });
}

/** Une manche : un dialogue, ses échanges. */
export function mancheWechat(d: Dialogue, graine: string): Manche {
  return { jeu: 'wechat', graine, tours: toursWechat(d, graine), i: 0, evenements: [], trouves: 0 };
}

/** La manche que les jeux préparent : le dialogue le plus récent, `null` si aucun ne se lit. */
export function preparerWechat(w: Wechat | undefined, graine: string): Manche | null {
  if (!w) return null;
  const d = dialoguesJouables(w)[0];
  return d === undefined ? null : mancheWechat(d, graine);
}

/**
 * Faut-il noter la bonne réplique trouvée après une erreur ? Non : ni l'erreur ni la
 * reprise n'est notée dans un jeu de sens (voir l'en-tête).
 */
export const NOTER_APRES_ERREUR = false;

/** Ce qu'un choix rend : la manche, les répliques écartées, les événements notés. */
export type Choix = {
  manche: Manche;
  /** Les répliques fausses déjà choisies à ce tour, écartées de la liste. */
  ecartees: string[];
  /** La réplique choisie est la bonne : elle s'ajoute à la conversation. */
  juste: boolean;
  /** Les événements de révision : un par caractère noté, et seulement du premier coup. */
  evenements: Revision[];
};

/**
 * Une réplique choisie. Fausse : elle est écartée, rien n'est noté, le tour reste ouvert.
 * Juste du premier coup : chaque caractère noté du tour rend un événement juste, que
 * `grade` notera ; juste après une erreur : aucun événement. Dans les deux cas, le tour
 * suivant s'ouvre. Aucune durée ne compte ailleurs que dans `grade`.
 */
export function choisirReplique(
  m: Manche,
  zh: string,
  ecartees: readonly string[],
  seconds: number
): Choix {
  const t = m.tours[m.i];
  if (t === undefined || ecartees.includes(zh)) return { manche: m, ecartees: [...ecartees], juste: false, evenements: [] };
  if (zh !== t.reponse[0]) {
    return { manche: m, ecartees: [...ecartees, zh], juste: false, evenements: [] };
  }
  const premier = ecartees.length === 0;
  const notes = t.c === '' ? [] : [t.c, ...(t.aussi ?? [])];
  const evenements: Revision[] =
    premier || NOTER_APRES_ERREUR
      ? notes.map((c) => ({ c, correct: true, tries: ecartees.length, seconds, leurres: [] }))
      : [];
  return {
    manche: {
      ...m,
      i: m.i + 1,
      evenements: [...m.evenements, ...evenements],
      trouves: m.trouves + (premier ? 1 : 0)
    },
    ecartees: [],
    juste: true,
    evenements
  };
}

/** Ce qui cloche dans une réplique écartée, en une ligne, sans reproche. */
export const LIGNE_ERREUR: Record<Erreur | '', string> = {
  'hors-sujet': 'Cette réplique parle d’autre chose.',
  contresens: 'Cette réplique lit mal son message : relis-le, un mot après l’autre.',
  '': ''
};

/** Une bulle du fil : de l'ami, ou la réplique choisie. `cle` la nomme dans le fil. */
export type Bulle = { de: 'ami' | 'moi'; t: TexteWechat; cle: string; tour: number };

/**
 * Le fil d'un dialogue arrivé à l'échange `i` : chaque message de l'ami jusqu'à celui en
 * cours, la bonne réplique de chaque échange répondu, et le mot de la fin une fois le
 * dialogue mené à bout. C'est ce que la reprise au pas exact remontre, sans rien d'autre
 * que `i` : les répliques écartées ne s'affichent pas dans le fil.
 */
export function filDuDialogue(d: Dialogue, i: number): Bulle[] {
  const n = d.echanges.length;
  const k = Math.max(0, Math.min(Math.floor(i), n));
  const out: Bulle[] = [];
  for (let t = 0; t < Math.min(k + 1, n); t++) {
    out.push({ de: 'ami', t: d.echanges[t].ami, cle: `a${t}`, tour: t });
    if (t < k) {
      const juste = d.echanges[t].repliques.find((r) => r.juste);
      if (juste) out.push({ de: 'moi', t: juste, cle: `m${t}`, tour: t });
    }
  }
  if (k === n && d.fin) out.push({ de: 'ami', t: d.fin, cle: 'fin', tour: n });
  return out;
}

/** La réplique d'un échange, par son texte. */
export function replique(e: Echange, zh: string): Replique | null {
  return e.repliques.find((r) => r.zh === zh) ?? null;
}
