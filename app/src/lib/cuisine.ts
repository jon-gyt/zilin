/**
 * La cuisine de Tao (story 4b.6) : dix plats de cantine, une recette en chinois, les
 * ingrédients sur l'étal, Tao qui goûte.
 *
 * Ce qu'il fait lire de plus : une recette entière, des phrases courtes écrites avec
 * l'acquis, puis des mots qu'il faut distinguer sur l'étal (牛肉 du bœuf, 牛奶 du lait).
 * Chaque ingrédient est une question à choix, notée par `grade` de `srs.ts` comme une
 * question de révision quand il est trouvé, du premier coup ou au second essai. Manqué,
 * il est montré et rien n'est noté (`jeux.ERREUR_SANS_NOTE`) : prendre 牛奶 pour 牛肉 ne
 * dit pas qu'on a oublié 肉, la carte ne revient pas dans dix minutes. Pas de
 * chronomètre, pas de vie, pas de point. Tao goûte à la fin : contente quand chaque
 * ingrédient a été trouvé, une grimace sinon, qui propose d'en refaire un. Jamais de
 * reproche, jamais malade.
 *
 * Une recette ne se propose que lorsque tous ses caractères sont acquis (`caracteres` :
 * le nom, les étapes, les mots des ingrédients), à la stabilité de `srs.ts`, sans repli
 * de démonstration. Tout le texte vient de `cuisine.json`, rédigé et contrôlé dans le
 * pipeline (`data/sources/cuisine/`) : l'app n'en écrit aucun. Trois plats sont
 * gratuits (`gratuit`) ; il n'y a pas encore d'achat, les dix sont ouverts.
 *
 * Les règles sont pures, comme `jeux.ts` : aucune horloge, aucun stockage, aucun
 * `Math.random`. Seul `cuisineOnce` lit le réseau local, les assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';
import type { Manche, Tour } from './jeux';
import { melange } from './questions';
import type { Outcome } from './srs';

/* ---------- les données ---------- */

/** Un texte chinois, son pinyin et ses traductions. */
export type TexteCuisine = { zh: string; pinyin: string; fr: string; en: string };

/**
 * Un ingrédient : le mot de l'étal qui répond, ce que Tao demande (`fr`, `en`), les
 * leurres écrits dans le pipeline, et les caractères que la question note — ceux de la
 * réponse que le premier leurre n'a pas (牛肉 contre 牛奶 : 肉).
 */
export type IngredientCuisine = TexteCuisine & { leurres: string[]; notes: string[] };

export type Recette = TexteCuisine & {
  id: string;
  /** L'un des trois plats de l'offre gratuite (brief §10). Rien ne se vend encore. */
  gratuit: boolean;
  etapes: TexteCuisine[];
  ingredients: IngredientCuisine[];
  /** Les caractères à avoir acquis pour la cuisiner : le nom, les étapes, les ingrédients. */
  caracteres: string[];
  /** Par parcours, le jour où elle devient possible ; `null` si le parcours n'y mène pas. */
  jours: Record<string, number | null>;
};

/** Un mot de l'étal : sa lecture et son sens, que la correction montre. */
export type MotEtal = { pinyin: string; fr: string; en: string };

/** Ce que Tao dit : elle lit la recette, le plat est bon, ou elle grimace. */
export type RepliquesTao = Partial<Record<'lit' | 'bon' | 'grimace', TexteCuisine>>;

/** `cuisine.json`. */
export type CuisineDonnees = {
  version: string;
  source: string;
  recettes: Recette[];
  etal: Record<string, MotEtal>;
  tao: RepliquesTao;
  racines: Record<string, string>;
};

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function textes(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

function lireTexte(v: unknown): TexteCuisine | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const t = { zh: texte(o.zh), pinyin: texte(o.pinyin), fr: texte(o.fr), en: texte(o.en) };
  return t.zh === '' ? null : t;
}

/** Un ingrédient lisible, ou `null` : sans leurre distinct ou sans caractère noté, pas de question. */
function lireIngredient(v: unknown): IngredientCuisine | null {
  const t = lireTexte(v);
  if (t === null || t.fr === '') return null;
  const o = v as Record<string, unknown>;
  const leurres = [...new Set(textes(o.leurres))].filter((x) => x !== t.zh);
  const notes = textes(o.notes).filter((c) => t.zh.includes(c));
  return leurres.length === 0 || notes.length === 0 ? null : { ...t, leurres, notes };
}

function lireRecette(v: unknown): Recette | null {
  const t = lireTexte(v);
  if (t === null) return null;
  const o = v as Record<string, unknown>;
  const id = texte(o.id);
  const etapes = (Array.isArray(o.etapes) ? o.etapes : []).flatMap((e) => lireTexte(e) ?? []);
  const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : []).flatMap(
    (i) => lireIngredient(i) ?? []
  );
  const caracteres = textes(o.caracteres);
  if (id === '' || etapes.length === 0 || ingredients.length === 0 || caracteres.length === 0) return null;
  const jours: Record<string, number | null> = {};
  if (typeof o.jours === 'object' && o.jours !== null) {
    for (const [nom, j] of Object.entries(o.jours as Record<string, unknown>)) {
      jours[nom] = typeof j === 'number' ? j : null;
    }
  }
  return { ...t, id, gratuit: o.gratuit === true, etapes, ingredients, caracteres, jours };
}

/**
 * Lit `cuisine.json`. Une recette mal formée tombe : mieux vaut un plat de moins
 * qu'une question fausse.
 */
export function lireCuisine(brut: unknown): CuisineDonnees {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const vues = new Set<string>();
  const recettes = (Array.isArray(o.recettes) ? o.recettes : []).flatMap((v) => {
    const r = lireRecette(v);
    if (r === null || vues.has(r.id)) return [];
    vues.add(r.id);
    return [r];
  });
  const etal: Record<string, MotEtal> = {};
  if (typeof o.etal === 'object' && o.etal !== null) {
    for (const [zh, m] of Object.entries(o.etal as Record<string, unknown>)) {
      if (typeof m !== 'object' || m === null) continue;
      const x = m as Record<string, unknown>;
      etal[zh] = { pinyin: texte(x.pinyin), fr: texte(x.fr), en: texte(x.en) };
    }
  }
  const tao: RepliquesTao = {};
  if (typeof o.tao === 'object' && o.tao !== null) {
    for (const cle of ['lit', 'bon', 'grimace'] as const) {
      const t = lireTexte((o.tao as Record<string, unknown>)[cle]);
      if (t !== null) tao[cle] = t;
    }
  }
  const racines: Record<string, string> = {};
  if (typeof o.racines === 'object' && o.racines !== null) {
    for (const [c, r] of Object.entries(o.racines as Record<string, unknown>)) {
      if (typeof r === 'string') racines[c] = r;
    }
  }
  return { version: texte(o.version), source: texte(o.source), recettes, etal, tao, racines };
}

/** Aucun plat : ce que rend un export sans `cuisine.json`. Le jeu se tait. */
export const SANS_CUISINE: CuisineDonnees = {
  version: '',
  source: '',
  recettes: [],
  etal: {},
  tao: {},
  racines: {}
};

/** Le fichier de la cuisine d'une version, tel que l'index le nomme. */
export function fichierCuisine(i: Index): string {
  return i.cuisine === '' ? '' : `${dossierVersion(i.version)}/${i.cuisine}`;
}

/** Lit et valide un fichier de cuisine. `fetchFn` est injecté dans les tests. */
export async function loadCuisine(file: string, fetchFn: typeof fetch = fetch): Promise<CuisineDonnees> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Cuisine introuvable : ${file} (${r.status})`);
  return lireCuisine(await r.json());
}

const lesCuisines = new Map<string, Promise<CuisineDonnees>>();

/** La cuisine de la version courante, lue une fois pour toute la durée de vie de l'app. */
export function cuisineOnce(version = VERSION_DONNEES): Promise<CuisineDonnees> {
  let p = lesCuisines.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierCuisine(i);
        return file === '' ? SANS_CUISINE : loadCuisine(file);
      })
      .catch((e) => {
        lesCuisines.delete(version);
        throw e;
      });
    lesCuisines.set(version, p);
  }
  return p;
}

/* ---------- ce qui se cuisine ---------- */

/** Ce que les jeux lisent de la cuisine : les recettes, l'acquis réel, les plats déjà faits. */
export type Cuisine = {
  donnees: CuisineDonnees;
  /** Les caractères acquis, au seuil de stabilité de `srs.ts`. Jamais l'acquis de démonstration. */
  acquis: readonly string[];
  /** Les plats déjà cuisinés, `Progress.recettes`. */
  cuisinees: readonly string[];
};

/** Les caractères de la recette qui ne sont pas encore acquis, dans l'ordre de la recette. */
export function manquants(r: Recette, acquis: readonly string[]): string[] {
  const a = new Set(acquis);
  return r.caracteres.filter((c) => !a.has(c));
}

/** Une recette ne se cuisine que lorsque tous ses caractères sont acquis. */
export function jouable(r: Recette, acquis: readonly string[]): boolean {
  return r.caracteres.length > 0 && manquants(r, acquis).length === 0;
}

/** Les recettes jouables, dans l'ordre de `cuisine.json`. */
export function recettesJouables(c: Cuisine): Recette[] {
  return c.donnees.recettes.filter((r) => jouable(r, c.acquis));
}

/** La recette que la cuisine propose d'abord : une pas encore cuisinée, à défaut la première. */
export function recetteAProposer(c: Cuisine): Recette | null {
  const possibles = recettesJouables(c);
  const faites = new Set(c.cuisinees);
  return possibles.find((r) => !faites.has(r.id)) ?? possibles[0] ?? null;
}

/**
 * Les tours d'une recette : un par ingrédient, dans l'ordre de la recette. Tao demande
 * l'ingrédient (`enonce`, son `fr`) ; l'étal montre la réponse et ses leurres, mélangés
 * d'après la graine. Le tour note le premier caractère noté (`c`), et les autres avec lui
 * (`aussi`) : c'est là que l'erreur type se lit.
 */
export function toursCuisine(r: Recette, graine: string): Tour[] {
  return r.ingredients.map((i, k) => ({
    c: i.notes[0],
    aussi: i.notes.slice(1),
    enonce: i.fr,
    reponse: [i.zh],
    choix: melange([i.zh, ...i.leurres], `${graine}/${r.id}/${k}`),
    ordre: false,
    paire: false
  }));
}

/** Une manche de cuisine : une recette, ses ingrédients. `null` si elle n'en a aucun. */
export function mancheCuisine(r: Recette, graine: string): Manche | null {
  const tours = toursCuisine(r, graine);
  return tours.length === 0 ? null : { jeu: 'cuisine', graine, tours, i: 0, evenements: [], trouves: 0 };
}

/** La manche que les jeux préparent : la recette à proposer, `null` si aucune ne se cuisine. */
export function preparerCuisine(c: Cuisine | undefined, graine: string): Manche | null {
  if (!c) return null;
  const r = recetteAProposer(c);
  return r === null ? null : mancheCuisine(r, graine);
}

/* ---------- l'étal ---------- */

/** Deux essais par ingrédient, comme toute question : juste, juste après une erreur, ou montré. */
export const ESSAIS_CUISINE = 2;

/**
 * Les caractères qu'un mot faux désignait : ceux qu'il a et que la réponse n'a pas
 * (牛奶 pris pour 牛肉 : 奶). C'est le leurre pris, au sens de `srs.Outcome`.
 */
export function signesPris(pris: readonly string[], reponse: string): string[] {
  const r = new Set([...reponse]);
  return [...new Set(pris.flatMap((mot) => [...mot].filter((c) => !r.has(c))))];
}

/**
 * Un choix sur l'étal. Juste : l'issue est prête pour `repondre`, avec les essais faux
 * d'avant. Faux au premier essai : rien n'est noté, le mot est écarté, on essaie encore.
 * Faux au dernier : l'issue est fausse, la réponse sera montrée. Aucune durée ne compte
 * ailleurs que dans `grade`, comme pour toute question.
 */
export function choisir(
  t: Tour,
  choix: string,
  pris: readonly string[],
  seconds: number
): { pris: string[]; outcome: Outcome | null } {
  const juste = choix === t.reponse[0];
  const faux = juste ? [...pris] : [...pris, choix];
  if (!juste && faux.length < ESSAIS_CUISINE) return { pris: faux, outcome: null };
  return {
    pris: faux,
    outcome: { correct: juste, tries: faux.length, seconds, leurres: signesPris(faux, t.reponse[0]) }
  };
}

/* ---------- Tao goûte ---------- */

/** Ce que Tao trouve en goûtant : le plat est bon, ou elle grimace. Jamais malade. */
export type Gout = 'bon' | 'grimace';

/** Bon quand chaque ingrédient a été trouvé, même au second essai ; une grimace sinon. */
export function gout(m: Manche): Gout {
  return m.tours.length > 0 && m.i >= m.tours.length && m.trouves === m.tours.length ? 'bon' : 'grimace';
}
