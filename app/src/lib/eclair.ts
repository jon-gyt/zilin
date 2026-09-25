/**
 * Le dictionnaire éclair (story 4b.4) : deviner le sens d'un mot jamais appris.
 *
 * 火车 : 火 le feu, 车 le véhicule ; le train. Un mot n'est proposé que si ses deux
 * caractères sont acquis (stabilité FSRS au seuil de `srs.ts`, jamais l'acquis de
 * démonstration) et qu'aucune fiche apprise ne l'a déjà fait lire : c'est un mot
 * « jamais appris », que l'on devine depuis ses caractères. Quatre sens, un seul juste ;
 * une bonne réponse est notée automatiquement comme une question, une mauvaise ne note
 * rien (`jeux.ERREUR_SANS_NOTE`) : rater 大水 ne veut pas dire qu'on a oublié 大 ou 水.
 * Pas de temps, pas de vie.
 *
 * Les mots, leur pinyin, leur sens et leurs leurres viennent de `eclair.json`, rédigé
 * et contrôlé dans le pipeline (`data/sources/eclair/`) ; ce module n'en écrit aucun.
 * Le compteur « mots devinés » est rangé dans la progression (`Progress.motsDevines`),
 * un mot une fois, et suit l'export et l'import JSON.
 *
 * Module pur, comme `jeux.ts` : aucune horloge, aucun `Math.random`, aucun stockage.
 * Seul `eclairOnce` lit un fichier, celui que l'index nomme.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Famille, type Fiche } from './content';
import type { CorpusJeux, Tour } from './jeux';
import { acquis as acquisDesCartes, caractereAcquis, melange, type Acquis } from './questions';
import type { Progress } from './session';

/* ---------- le contenu ---------- */

/** Un mot à deviner, tel que `eclair.json` le donne. `leurres` : trois autres mots du fichier. */
export type MotEclair = {
  id: string;
  mot: string;
  pinyin: string;
  fr: string;
  en: string;
  leurres: string[];
};

/** `eclair.json` : les mots, et la famille de chacun de leurs caractères (pour les traits). */
export type Eclair = {
  version: string;
  source: string;
  mots: MotEclair[];
  racines: Record<string, string>;
};

/** Aucun mot : ce que rend un export sans `eclair.json`. Le jeu se tait. */
export const SANS_ECLAIR: Eclair = { version: '', source: '', mots: [], racines: {} };

const HAN = /^\p{Script=Han}$/u;

/** Un mot lisible, ou `null` : mieux vaut un mot de moins qu'une question fausse. */
function lireMot(v: unknown): MotEclair | null {
  if (typeof v !== 'object' || v === null) return null;
  const m = v as Record<string, unknown>;
  const mot = typeof m.mot === 'string' ? m.mot : '';
  const signes = [...mot];
  const leurres = Array.isArray(m.leurres)
    ? m.leurres.filter((x): x is string => typeof x === 'string' && x !== '' && x !== mot)
    : [];
  if (
    signes.length !== 2 ||
    !signes.every((c) => HAN.test(c)) ||
    typeof m.fr !== 'string' ||
    m.fr === '' ||
    new Set(leurres).size !== leurres.length
  ) {
    return null;
  }
  return {
    id: typeof m.id === 'string' && m.id !== '' ? m.id : mot,
    mot,
    pinyin: typeof m.pinyin === 'string' ? m.pinyin : '',
    fr: m.fr,
    en: typeof m.en === 'string' ? m.en : '',
    leurres
  };
}

/** Relit un `eclair.json`. Un mot illisible ou en double est écarté. */
export function lireEclair(brut: unknown): Eclair {
  if (typeof brut !== 'object' || brut === null) return SANS_ECLAIR;
  const o = brut as Record<string, unknown>;
  if (!Array.isArray(o.mots)) return SANS_ECLAIR;
  const vus = new Set<string>();
  const mots = o.mots.flatMap((v: unknown) => {
    const m = lireMot(v);
    if (m === null || vus.has(m.id)) return [];
    vus.add(m.id);
    return [m];
  });
  const racines: Record<string, string> = {};
  if (typeof o.racines === 'object' && o.racines !== null) {
    for (const [c, r] of Object.entries(o.racines as Record<string, unknown>)) {
      if (typeof r === 'string') racines[c] = r;
    }
  }
  return {
    version: typeof o.version === 'string' ? o.version : '',
    source: typeof o.source === 'string' ? o.source : '',
    mots,
    racines
  };
}

/** Lit un fichier de l'export. `fetchFn` est injecté dans les tests. */
export async function loadEclair(file: string, fetchFn: typeof fetch = fetch): Promise<Eclair> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Dictionnaire éclair introuvable : ${file} (${r.status})`);
  return lireEclair(await r.json());
}

const lesEclairs = new Map<string, Promise<Eclair>>();

/** Le dictionnaire éclair de la version courante, lu une fois, par le nom que l'index lui donne. */
export function eclairOnce(version = VERSION_DONNEES): Promise<Eclair> {
  let p = lesEclairs.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => (i.eclair === '' ? SANS_ECLAIR : loadEclair(`${dossierVersion(i.version)}/${i.eclair}`)))
      .catch((e) => {
        lesEclairs.delete(version);
        throw e;
      });
    lesEclairs.set(version, p);
  }
  return p;
}

/* ---------- ce que le jeu lit ---------- */

/** Ce que le dictionnaire éclair lit, en plus du corpus commun des jeux. */
export type Dictionnaire = {
  mots: readonly MotEclair[];
  /** L'acquis réel : les cartes au seuil de stabilité. Jamais l'acquis de démonstration. */
  acquis: readonly string[];
  /** Les mots des fiches déjà apprises (le caractère de la fiche a une carte) : déjà lus. */
  appris: readonly string[];
  /** Les mots déjà devinés : ils ne se reposent pas. */
  devines: readonly string[];
};

/** Les sources du dictionnaire : le contenu, les cartes, et les mots déjà devinés. */
export type SourcesEclair = {
  eclair?: Eclair | null;
  fiches?: readonly Fiche[];
  familles?: readonly Famille[];
  cartes?: readonly Acquis[];
  seuil?: number;
  devines?: readonly string[];
};

/**
 * Les mots appris comme mots de fiche : ceux des fiches (surcouchées ou exportées) d'un
 * caractère qui a une carte. La fiche se lit le jour où son caractère est appris ; ses
 * mots sont alors lus, plus à deviner.
 */
export function motsDeFiches(
  fiches: readonly Fiche[],
  familles: readonly Famille[],
  cartes: readonly Acquis[]
): string[] {
  const connus = new Set(cartes.map(caractereAcquis));
  const out = new Set<string>();
  for (const f of [...fiches, ...familles.flatMap((x) => x.fiches)]) {
    if (!connus.has(f.c)) continue;
    for (const m of f.mots ?? []) if (m.hanzi !== '') out.add(m.hanzi);
  }
  return [...out];
}

/** Le dictionnaire du jeu. `null` quand l'export n'en porte pas : le jeu se tait. */
export function dictionnaire(s: SourcesEclair): Dictionnaire | null {
  if (!s.eclair || s.eclair.mots.length === 0) return null;
  const cartes = s.cartes ?? [];
  return {
    mots: s.eclair.mots,
    acquis: acquisDesCartes({ fiches: [], decompositions: {}, acquis: cartes, seuil: s.seuil }),
    appris: motsDeFiches(s.fiches ?? [], s.familles ?? [], cartes),
    devines: s.devines ?? []
  };
}

/* ---------- les tours ---------- */

/** Une manche : cinq mots au plus, une à deux minutes de lecture. */
export const TOURS_ECLAIR = 5;

/** Quatre sens à l'écran : le bon et trois leurres. */
export const SENS_ECLAIR = 4;

/**
 * Les mots qui peuvent se poser : les deux caractères acquis, tous deux montrables
 * (on a leurs traits), jamais appris comme mot de fiche, pas encore devinés, et dont
 * les trois leurres ont un sens à montrer. L'ordre est celui de `eclair.json`.
 */
export function motsPossibles(corpus: CorpusJeux): MotEclair[] {
  const d = corpus.eclair;
  if (!d) return [];
  const acquis = new Set(d.acquis);
  const appris = new Set(d.appris);
  const devines = new Set(d.devines);
  const montrables = new Set(corpus.traits);
  const sens = new Map(d.mots.map((m) => [m.id, m.fr]));
  return d.mots.filter(
    (m) =>
      [...m.mot].every((c) => acquis.has(c) && montrables.has(c)) &&
      !appris.has(m.mot) &&
      !devines.has(m.id) &&
      m.leurres.filter((x) => (sens.get(x) ?? '') !== '').length >= SENS_ECLAIR - 1
  );
}

/** Le mot d'un tour, tel que le contenu le donne. */
export function motDe(t: Tour, corpus: CorpusJeux): MotEclair | null {
  return corpus.eclair?.mots.find((m) => m.id === t.mot) ?? null;
}

/**
 * Les tours d'une manche : des mots possibles tirés d'après la graine, quatre sens
 * chacun, mélangés. La note porte sur les deux caractères du mot : `c` est le premier,
 * `aussi` le second, comme la coquille le fait pour l'intrus.
 */
export function toursEclair(corpus: CorpusJeux, graine: string): Tour[] {
  const d = corpus.eclair;
  if (!d) return [];
  return melange(motsPossibles(corpus), `${graine}/eclair`)
    .slice(0, TOURS_ECLAIR)
    .map((m) => tourDuMot(m, d.mots, graine));
}

/**
 * Le tour d'un mot : quatre sens, le bon et trois leurres, mélangés d'après la graine.
 * Même mot, même graine, même tour : le pas Utiliser le repose tel quel à la reprise.
 */
export function tourDuMot(m: MotEclair, mots: readonly MotEclair[], graine: string): Tour {
  const sens = new Map(mots.map((x) => [x.id, x.fr]));
  const [premier, second] = [...m.mot];
  const leurres = m.leurres.map((x) => sens.get(x) ?? '').filter((x) => x !== '' && x !== m.fr);
  return {
    c: premier,
    enonce: 'Que veut dire ce mot ?',
    reponse: [m.fr],
    choix: melange([m.fr, ...leurres.slice(0, SENS_ECLAIR - 1)], `${graine}/${m.id}/choix`),
    ordre: false,
    paire: false,
    aussi: [second],
    correction: [
      { c: premier, briques: [premier] },
      { c: second, briques: [second] }
    ],
    mot: m.id
  };
}

/* ---------- le compteur « mots devinés » ---------- */

/** Note un mot deviné. Un mot compte une fois, même deviné de nouveau. */
export function noterMotDevine(p: Progress, id: string): Progress {
  if (id === '' || p.motsDevines.includes(id)) return p;
  return { ...p, motsDevines: [...p.motsDevines, id] };
}

/** Le nombre de mots devinés, pour l'écran Jouer. Un nombre réel, pas un score. */
export function motsDevines(p: Progress): number {
  return p.motsDevines.length;
}

/** « 12 mots devinés » : la ligne sobre de l'écran Jouer. */
export function ligneMotsDevines(n: number): string {
  if (n === 0) return 'Aucun mot deviné pour l’instant.';
  return n === 1 ? '1 mot deviné.' : `${n} mots devinés.`;
}

/**
 * La posture de Tao au dictionnaire éclair : elle joue, la tête penchée sur le mot,
 * sans lanterne (la lanterne est celle des devinettes, le bol celui de la cuisine).
 */
export const TAO_ECLAIR = { posture: 'jeu', penchee: true } as const;

