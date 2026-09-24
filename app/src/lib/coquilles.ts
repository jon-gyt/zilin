/**
 * Les messages de « La coquille » (story 4b.3), tels que le pipeline les exporte dans
 * `coquilles.json` (`data/sources/coquilles/`, `data/schema.md`).
 *
 * L'app ne rédige aucun message : elle lit ceux-ci, courts, écrits avec les caractères
 * du seuil 255, chacun avec les caractères qu'on peut y piéger. L'intrus n'est pas
 * écrit : `jeux.ts` le prend dans `paires.json`, parmi les caractères acquis.
 */
import { VERSION_DONNEES, dossierVersion } from './content';

/** Un message rédigé pour l'app : sa ponctuation, ses pièges, sa traduction. */
export type MessageCoquille = {
  /** Les caractères du message, sans la ponctuation. */
  id: string;
  /** Le message tel qu'il s'écrit, ponctuation comprise. */
  message: string;
  /** Les caractères du message qu'on peut remplacer par un autre de leur groupe. */
  pieges: string[];
  fr: string;
  en: string;
};

export type Coquilles = {
  version: string;
  source: string;
  coquilles: MessageCoquille[];
  /** La famille de chaque caractère dessiné, pour trouver ses traits. */
  racines: Record<string, string>;
};

/** Le fichier des messages : son nom est fixe dans chaque version exportée. */
export const FICHIER_COQUILLES = 'coquilles.json';

const HAN = /\p{Script=Han}/u;

function textes(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '')
    ? (v as string[])
    : null;
}

/** Un message lisible, ou `null` : mieux vaut un message de moins qu'un piège faux. */
export function lireMessage(v: unknown): MessageCoquille | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const pieges = textes(d.pieges);
  if (typeof d.message !== 'string' || !pieges || pieges.length === 0) return null;
  const signes = [...d.message].filter((x) => HAN.test(x));
  /* Un piège qui n'est pas dans le message ne se pose pas. */
  const dedans = pieges.filter((p) => signes.includes(p));
  if (signes.length === 0 || dedans.length === 0) return null;
  return {
    id: signes.join(''),
    message: d.message,
    pieges: dedans,
    fr: typeof d.fr === 'string' ? d.fr : '',
    en: typeof d.en === 'string' ? d.en : ''
  };
}

/** Lit et valide un fichier de messages. `fetchFn` est injecté dans les tests. */
export async function loadCoquilles(file: string, fetchFn: typeof fetch = fetch): Promise<Coquilles> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Coquilles introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Record<string, unknown>;
  if (!Array.isArray(brut.coquilles)) throw new Error(`Coquilles illisibles : ${file}`);
  const vus = new Set<string>();
  const coquilles = brut.coquilles.flatMap((v: unknown) => {
    const q = lireMessage(v);
    if (q === null || vus.has(q.id)) return [];
    vus.add(q.id);
    return [q];
  });
  const racines: Record<string, string> = {};
  if (typeof brut.racines === 'object' && brut.racines !== null) {
    for (const [k, x] of Object.entries(brut.racines as Record<string, unknown>)) {
      if (typeof x === 'string') racines[k] = x;
    }
  }
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    coquilles,
    racines
  };
}

const lesCoquilles = new Map<string, Promise<Coquilles>>();

/**
 * Les messages de la version courante, lus une fois pour toute la vie de l'app. Un
 * export qui n'en porte pas rend une liste vide : la coquille se rabat sur les mots et
 * les phrases des fiches, ou se tait.
 */
export function coquillesOnce(version = VERSION_DONNEES): Promise<Coquilles> {
  let p = lesCoquilles.get(version);
  if (!p) {
    p = loadCoquilles(`${dossierVersion(version)}/${FICHIER_COQUILLES}`).catch(() => {
      lesCoquilles.delete(version);
      return { version: '', source: '', coquilles: [], racines: {} };
    });
    lesCoquilles.set(version, p);
  }
  return p;
}
