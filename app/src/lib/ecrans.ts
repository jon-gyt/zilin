/**
 * Les textes d'interface de « Lire le monde » (Chercher) et du tableau des révisions (Ma
 * forêt), tels que le pipeline les exporte dans `ecrans.json` (`data/sources/ecrans/`,
 * `data/schema.md`).
 *
 * L'app ne rédige aucun de ces textes : elle les lit ici et remplit leurs jetons entre
 * accolades (`remplir`). Un export sans `ecrans.json` rend des textes vides : l'écran se
 * tait plutôt que de dire un texte écrit dans le code. Seul `ecransOnce` lit le réseau
 * local, les assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';

/** Les clés de « Lire le monde », dans l'ordre de la source. */
export const CLES_LIRE_LE_MONDE = [
  'onglets',
  'onglet-caractere',
  'onglet-texte',
  'champ',
  'invite',
  'aide-iphone',
  'chargement',
  'compte',
  'compte-un',
  'sans-chinois',
  'legende',
  'dans',
  'demain',
  'mots',
  'ouvrir',
  'effacer'
] as const;

/** Les clés du tableau des révisions, dans l'ordre de la source. */
export const CLES_REVISIONS = [
  'entree',
  'entree-ligne',
  'entree-vide',
  'retour',
  'titre',
  'venir-titre',
  'venir-ligne',
  'venir-une',
  'venir-rien',
  'aujourdhui',
  'jours',
  'barre',
  'barre-une',
  'retention-titre',
  'retention',
  'retention-peu',
  'retention-mesure',
  'retention-cible',
  'retention-reglage',
  'resistent-titre',
  'resistent-aide',
  'resistent-ligne',
  'resistent-une',
  'resistent-rien'
] as const;

export type CleLireLeMonde = (typeof CLES_LIRE_LE_MONDE)[number];
export type CleRevisions = (typeof CLES_REVISIONS)[number];

export type TextesLireLeMonde = Record<CleLireLeMonde, string>;
export type TextesRevisions = Record<CleRevisions, string>;

export type Ecrans = {
  version: string;
  source: string;
  lire: TextesLireLeMonde;
  revisions: TextesRevisions;
};

function vides<K extends string>(cles: readonly K[]): Record<K, string> {
  return Object.fromEntries(cles.map((c) => [c, ''])) as Record<K, string>;
}

/** Aucun texte : ce que rend un export sans `ecrans.json`. Les écrans se taisent. */
export const SANS_ECRANS: Ecrans = {
  version: '',
  source: '',
  lire: vides(CLES_LIRE_LE_MONDE),
  revisions: vides(CLES_REVISIONS)
};

function objet(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function bloc<K extends string>(v: unknown, cles: readonly K[]): Record<K, string> {
  const o = objet(v);
  const out = vides(cles);
  for (const c of cles) out[c] = texte(o[c]);
  return out;
}

/** Lit `ecrans.json`. Un texte absent ou mal formé reste vide : rien n'est inventé ici. */
export function lireEcrans(brut: unknown): Ecrans {
  const o = objet(brut);
  return {
    version: texte(o.version),
    source: texte(o.source),
    lire: bloc(o['lire-le-monde'], CLES_LIRE_LE_MONDE),
    revisions: bloc(o.revisions, CLES_REVISIONS)
  };
}

/**
 * Remplit les jetons d'un texte : `{lus}` prend `valeurs.lus`. Un jeton sans valeur reste
 * tel quel, pour qu'un oubli se voie au lieu de se taire.
 */
export function remplir(t: string, valeurs: Readonly<Record<string, string | number>>): string {
  return t.replace(/\{([^{}]+)\}/g, (tout, cle: string) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

/** Le fichier des textes d'écran d'une version, tel que l'index le nomme. */
export function fichierEcrans(i: Index): string {
  return !i.ecrans ? '' : `${dossierVersion(i.version)}/${i.ecrans}`;
}

/** Lit et valide `ecrans.json`. `fetchFn` est injecté dans les tests. */
export async function loadEcrans(file: string, fetchFn: typeof fetch = fetch): Promise<Ecrans> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Textes d'écran introuvables : ${file} (${r.status})`);
  return lireEcrans(await r.json());
}

const lesTextes = new Map<string, Promise<Ecrans>>();

/** Les textes de la version courante, lus une fois pour toute la durée de vie de l'app. */
export function ecransOnce(version = VERSION_DONNEES): Promise<Ecrans> {
  let p = lesTextes.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierEcrans(i);
        return file === '' ? SANS_ECRANS : loadEcrans(file);
      })
      .catch((e) => {
        lesTextes.delete(version);
        throw e;
      });
    lesTextes.set(version, p);
  }
  return p;
}
