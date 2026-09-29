/**
 * Les poids du classifieur des tons, tels que le pipeline les exporte dans `tons.json`
 * (`data/sources/tons/`, `data/schema.md`), nommé par l'index (clé `tons`).
 *
 * Un export sans `tons.json`, ou des poids mal formés : pas de modèle, et « Dis-le » ne se
 * pose pas. Jamais de jugement au hasard. Seul `modeleOnce` lit le réseau local, les
 * assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from '../content';
import { verifierModele, type Modele } from './classifieur';

/** Le fichier des poids d'une version, tel que l'index le nomme. Vide sans. */
export function fichierTons(i: Index): string {
  return !i.tons ? '' : `${dossierVersion(i.version)}/${i.tons}`;
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

const lesModeles = new Map<string, Promise<Modele | null>>();

/** Le modèle de la version courante, lu une fois pour toute la durée de vie de l'app. */
export function modeleOnce(version = VERSION_DONNEES, fetchFn: typeof fetch = fetch): Promise<Modele | null> {
  let p = lesModeles.get(version);
  if (!p) {
    p = contenu(version)
      .then(async (i) => {
        const file = fichierTons(i);
        if (file === '') return null;
        const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
        return r.ok ? lireModele(await r.json()) : null;
      })
      .catch(() => {
        lesModeles.delete(version);
        return null;
      });
    lesModeles.set(version, p);
  }
  return p;
}
