/**
 * Ce que Tao dit sur l'écran Jouer (brief §9 « L'écran Jouer »), tel que le pipeline
 * l'exporte dans `jouer.json` (`data/sources/jouer/tao.tsv`, `data/schema.md`).
 *
 * L'app ne rédige aucune phrase : elle lit celles-ci, et `jeux.bulleDeTao` choisit
 * laquelle dire. Un export qui ne porte pas `jouer.json` rend des phrases vides : la
 * bulle se tait, plutôt que de dire un texte écrit dans le code. Seul `jouerOnce` lit le
 * réseau local, les assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';

/** Les phrases de la bulle : Tao tend un jeu, le tend en s'ennuyant, montre la devinette, attend l'acquis. */
export const CLES_TAO_JOUER = ['invite', 'changer', 'devinette', 'attendre'] as const;

export type CleTaoJouer = (typeof CLES_TAO_JOUER)[number];

/** Une phrase par clé ; vide quand l'export ne la porte pas. */
export type PhrasesJouer = Record<CleTaoJouer, string>;

export type JouerDonnees = { version: string; source: string; tao: PhrasesJouer };

/** Aucune phrase : ce que rend un export sans `jouer.json`. La bulle se tait. */
export const SANS_JOUER: JouerDonnees = {
  version: '',
  source: '',
  tao: { invite: '', changer: '', devinette: '', attendre: '' }
};

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Lit `jouer.json`. Une phrase absente ou mal formée reste vide : rien n'est inventé ici. */
export function lireJouerDonnees(brut: unknown): JouerDonnees {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const t = (typeof o.tao === 'object' && o.tao !== null ? o.tao : {}) as Record<string, unknown>;
  const tao = { ...SANS_JOUER.tao };
  for (const cle of CLES_TAO_JOUER) tao[cle] = texte(t[cle]);
  return { version: texte(o.version), source: texte(o.source), tao };
}

/** Le fichier de l'écran Jouer d'une version, tel que l'index le nomme. */
export function fichierJouer(i: Index): string {
  return !i.jouer ? '' : `${dossierVersion(i.version)}/${i.jouer}`;
}

/** Lit et valide `jouer.json`. `fetchFn` est injecté dans les tests. */
export async function loadJouer(file: string, fetchFn: typeof fetch = fetch): Promise<JouerDonnees> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Phrases de Jouer introuvables : ${file} (${r.status})`);
  return lireJouerDonnees(await r.json());
}

const lesPhrases = new Map<string, Promise<JouerDonnees>>();

/** Les phrases de la version courante, lues une fois pour toute la durée de vie de l'app. */
export function jouerOnce(version = VERSION_DONNEES): Promise<JouerDonnees> {
  let p = lesPhrases.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierJouer(i);
        return file === '' ? SANS_JOUER : loadJouer(file);
      })
      .catch((e) => {
        lesPhrases.delete(version);
        throw e;
      });
    lesPhrases.set(version, p);
  }
  return p;
}
