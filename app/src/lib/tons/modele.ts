/**
 * Les poids du classifieur des tons, tels que le pipeline les exporte dans `tons.json`
 * (`data/sources/tons/`, `data/schema.md`), nommé par l'index (clé `tons`) ; et ceux du modèle
 * des mots, dans `tons-mots.json` (clé `tonsMots`), adopté par la décision du propriétaire du
 * 7 octobre 2026 (« Brancher à 77,6 % »).
 *
 * Un export sans `tons.json`, ou des poids mal formés : pas de modèle, et « Dis-le » ne se
 * pose pas. Sans `tons-mots.json`, ou des poids des mots mal formés : « Dis-le » ne demande
 * que des caractères. Jamais de jugement au hasard. Seuls `modeleOnce` et `modeleMotsOnce`
 * lisent le réseau local, les assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from '../content';
import { verifierModele, type Modele } from './classifieur';
import { lireModeleMots, type ModeleMots } from './profil';

/** Le fichier des poids d'une version, tel que l'index le nomme. Vide sans. */
export function fichierTons(i: Index): string {
  return !i.tons ? '' : `${dossierVersion(i.version)}/${i.tons}`;
}

/** Le fichier des poids du modèle des mots, tel que l'index le nomme. Vide sans. */
export function fichierTonsMots(i: Index): string {
  return !i.tonsMots ? '' : `${dossierVersion(i.version)}/${i.tonsMots}`;
}

/** Relit les poids : le modèle, ou `null` s'ils sont absents ou mal formés. */
export function lireModele(brut: unknown): Modele | null {
  try {
    const m = brut as Modele;
    verifierModele(m);
    return m;
  } catch {
    return null;
  }
}

/** Lit une fois, pour toute la durée de vie de l'app, le fichier que `fichier` tire de l'index. */
function lecteur<T>(fichier: (i: Index) => string, lire: (brut: unknown) => T | null) {
  const lus = new Map<string, Promise<T | null>>();
  return (version = VERSION_DONNEES, fetchFn: typeof fetch = fetch): Promise<T | null> => {
    let p = lus.get(version);
    if (!p) {
      p = contenu(version)
        .then(async (i) => {
          const file = fichier(i);
          if (file === '') return null;
          const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
          return r.ok ? lire(await r.json()) : null;
        })
        .catch(() => {
          lus.delete(version);
          return null;
        });
      lus.set(version, p);
    }
    return p;
  };
}

/** Le modèle de la version courante, lu une fois pour toute la durée de vie de l'app. */
export const modeleOnce = lecteur<Modele>(fichierTons, lireModele);

/**
 * Le modèle des mots de la version courante, lu une fois : le profil de tons d'un mot de deux
 * syllabes (`profil.ts`), ou `null` s'il manque ou est mal formé.
 */
export const modeleMotsOnce = lecteur<ModeleMots>(fichierTonsMots, lireModeleMots);
