/**
 * Les trois lignes du pas Utiliser (brief §6, pas 4) : un court texte par jour du chemin,
 * écrit dans le pipeline avec les seuls caractères que le parcours a posés ce jour-là
 * (`data/sources/trois-lignes/`, exporté dans `trois-lignes.json`).
 *
 * Module pur, sauf le chargeur : aucune horloge, aucun stockage. Aucun texte de contenu
 * n'est écrit ici ; les seuls mots sont les microtextes de l'écran.
 *
 * Règles :
 * - le texte est celui du jour de la leçon, sur le parcours choisi (« Voyager » suit
 *   « Lire », comme partout) ;
 * - le cinabre marque les caractères nouveaux de ce jour que le texte emploie, et rien
 *   d'autre (CLAUDE.md : l'élément ajouté) ; le guide ne parle de cinabre que s'il y en a ;
 * - un jour sans texte écrit relit un texte d'un jour passé, tout à l'encre, choisi par
 *   le rang de la journée (jamais l'horloge), pour ne pas relire chaque jour le même ;
 * - la traduction reste cachée jusqu'au toucher, ligne par ligne ou en entier.
 */
import { dossierVersion, VERSION_DONNEES } from './content';
import { unites, type Unite } from './lecture';

/** Une ligne : le texte, son pinyin syllabe par syllabe, ses traductions. */
export type Ligne = { zh: string; pinyin: string; fr: string; en: string };

/** Ce que le lecteur montre au toucher d'un caractère ou d'un mot. */
export type Glose = { pinyin: string; fr: string; en: string };

/** Le texte d'un jour du chemin, tel que l'export le donne. */
export type TexteDuJour = {
  jour: number;
  /** Les caractères que le parcours pose ce jour-là et que le texte emploie. */
  nouveaux: string[];
  lignes: Ligne[];
  glose: Record<string, Glose>;
};

/** `trois-lignes.json` : les textes relus, par parcours. */
export type TroisLignes = { premierJour: number; parcours: Record<string, TexteDuJour[]> };

/** Le fichier servi avec l'app, à chemin fixe dans la version exportée. */
export const FICHIER_TROIS_LIGNES = `${dossierVersion(VERSION_DONNEES)}/trois-lignes.json`;

/** Le parcours lu quand le choisi n'a pas de textes : « Voyager » suit « Lire ». */
export const PARCOURS_DEFAUT = 'lire';

function chaine(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function lireTexte(x: unknown): TexteDuJour | null {
  if (x === null || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const jour = typeof o.jour === 'number' && Number.isInteger(o.jour) && o.jour > 0 ? o.jour : 0;
  if (jour === 0 || !Array.isArray(o.lignes)) return null;
  const lignes: Ligne[] = [];
  for (const l of o.lignes) {
    if (l === null || typeof l !== 'object') continue;
    const r = l as Record<string, unknown>;
    if (chaine(r.zh) === '') continue;
    lignes.push({ zh: chaine(r.zh), pinyin: chaine(r.pinyin), fr: chaine(r.fr), en: chaine(r.en) });
  }
  if (lignes.length === 0) return null;
  const glose: Record<string, Glose> = {};
  if (o.glose !== null && typeof o.glose === 'object') {
    for (const [k, g] of Object.entries(o.glose as Record<string, unknown>)) {
      if (k === '' || g === null || typeof g !== 'object') continue;
      const r = g as Record<string, unknown>;
      glose[k] = { pinyin: chaine(r.pinyin), fr: chaine(r.fr), en: chaine(r.en) };
    }
  }
  const nouveaux = Array.isArray(o.nouveaux) ? o.nouveaux.filter((c): c is string => typeof c === 'string') : [];
  return { jour, nouveaux, lignes, glose };
}

/** Relit `trois-lignes.json`. Un texte sans jour ni ligne est écarté ; un fichier illisible n'en a aucun. */
export function lireTroisLignes(brut: unknown): TroisLignes {
  const vide: TroisLignes = { premierJour: 1, parcours: {} };
  if (brut === null || typeof brut !== 'object') return vide;
  const o = brut as Record<string, unknown>;
  const premierJour = typeof o.premier_jour === 'number' ? o.premier_jour : 1;
  const parcours: Record<string, TexteDuJour[]> = {};
  if (o.parcours !== null && typeof o.parcours === 'object') {
    for (const [nom, liste] of Object.entries(o.parcours as Record<string, unknown>)) {
      if (!Array.isArray(liste)) continue;
      const textes: TexteDuJour[] = [];
      for (const x of liste) {
        const t = lireTexte(x);
        if (t !== null && !textes.some((y) => y.jour === t.jour)) textes.push(t);
      }
      parcours[nom] = textes.sort((a, b) => a.jour - b.jour);
    }
  }
  return { premierJour, parcours };
}

/** Lit le fichier servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadTroisLignes(
  file = FICHIER_TROIS_LIGNES,
  fetchFn: typeof fetch = fetch
): Promise<TroisLignes> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Trois lignes introuvables : ${file} (${r.status})`);
  return lireTroisLignes(await r.json());
}

let charge: Promise<TroisLignes> | null = null;

/** Même chose, une seule requête pour toute la vie de l'app. */
export function troisLignesOnce(): Promise<TroisLignes> {
  if (charge === null) {
    charge = loadTroisLignes().catch((e) => {
      charge = null;
      throw e;
    });
  }
  return charge;
}

/** Le texte à lire aujourd'hui, et les caractères à mettre en cinabre. */
export type Lecture = { texte: TexteDuJour; cinabre: string[] };

/**
 * Le texte du jour `jour` du parcours choisi, ses caractères nouveaux en cinabre. Sans
 * texte ce jour-là, un texte d'un jour passé, tout à l'encre, pris par le rang de la
 * journée : d'un jour à l'autre, il change. `null` s'il n'y en a aucun.
 */
export function lectureDuJour(
  doc: TroisLignes,
  choisi: string | null,
  jour: number,
  rang: number
): Lecture | null {
  const textes = doc.parcours[choisi ?? ''] ?? doc.parcours[PARCOURS_DEFAUT] ?? [];
  const exact = textes.find((t) => t.jour === jour);
  if (exact) return { texte: exact, cinabre: [...exact.nouveaux] };
  const passes = textes.filter((t) => t.jour < jour);
  if (passes.length === 0) return null;
  const k = ((Math.floor(rang) % passes.length) + passes.length) % passes.length;
  return { texte: passes[k], cinabre: [] };
}

/** Le texte nu d'une lecture, lignes mises bout à bout : ce que « Écouter » dit. */
export function texteNu(t: TexteDuJour): string {
  return t.lignes.map((l) => l.zh).join('');
}

/** Une ligne en unités qui se touchent : un mot du glossaire d'un seul geste, sinon un caractère. */
export function unitesDeLigne(l: Ligne, glose: Readonly<Record<string, Glose>>): Unite[] {
  const sens: Record<string, string> = {};
  for (const [k, g] of Object.entries(glose)) if (g.fr !== '') sens[k] = g.fr;
  return unites({ zh: l.zh, pinyin: l.pinyin, fr: l.fr }, sens);
}

/**
 * Ce que dit Tao en tête des trois lignes. Le cinabre n'est nommé que s'il y en a, et
 * ce sont les caractères appris aujourd'hui qu'il marque.
 */
export function guideLecture(cinabre: readonly string[]): string {
  const debut = 'Trois lignes, uniquement avec tes caractères.';
  const fin = 'Touche un caractère si tu hésites.';
  if (cinabre.length === 0) return `${debut} ${fin}`;
  return `${debut} En cinabre, ${cinabre.join(' ')} : appris aujourd'hui. ${fin}`;
}

/** Le bouton qui montre la traduction d'une ligne, ou de tout le texte. */
export const LIBELLE_TRADUIRE = 'Traduction';
export const LIBELLE_TOUT_TRADUIRE = 'Tout traduire';
