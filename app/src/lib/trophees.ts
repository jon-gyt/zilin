/**
 * Le tableau des trophées : ce que l'utilisateur a su lire, rien d'autre.
 *
 * Six familles de trophées : lire (des seuils de caractères), les sceaux de famille,
 * les pièges déjoués, les contes, les objets de Tao, la série. Chacun se gagne en lisant,
 * jamais au temps passé : aucune règle ne lit une durée, un nombre de minutes, le budget
 * de session ou le temps de réponse. Pas de points, pas de classement.
 *
 * Module pur, comme `foret.ts` et `serie.ts` : aucune fonction ne lit l'horloge,
 * n'écrit dans un stockage ni ne touche au DOM. Tout se calcule depuis la progression
 * et le contenu exporté, passés en arguments. Ce que la progression ne suit pas encore
 * (la lecture des contes, les devinettes, les recettes) est rendu verrouillé, avec
 * `suivi: false` : on n'affiche jamais un chiffre inventé.
 */
import { Rating } from 'ts-fsrs';
import { nomParcours, type Famille, type Index } from './content';
import {
  avancement,
  caracteresDe,
  caracteresLus,
  joursDesFamilles,
  racinesDesCaracteres
} from './foret';
import { lirePaires, type Paires } from './questions';
import { CADEAUX, NOTE_REMISE, PALIERS, etatSerie } from './serie';
import type { Progress } from './session';
import { SEUIL_DEBLOCAGE, type ReviewCard } from './srs';

/* ---------- les formes ---------- */

/** Les six familles de trophées, dans l'ordre de l'écran. */
export const FAMILLES_TROPHEES = ['lire', 'sceaux', 'pieges', 'contes', 'objets', 'serie'] as const;

export type FamilleTrophee = (typeof FAMILLES_TROPHEES)[number];

/**
 * Ce qu'une règle compte. La liste est fermée, et c'est elle que le test tient :
 * aucune unité n'est une durée. La série compte des journées travaillées (une graine
 * par journée, jamais plus), pas du temps passé.
 */
export const UNITES = [
  'caractere lu',
  'caractere de la famille lu',
  'lecture sans confusion',
  'conte lu',
  'brique tracee',
  'devinette resolue',
  'recette cuisinee',
  'journee travaillee'
] as const;

export type Unite = (typeof UNITES)[number];

/** Ce que porte le sceau : un nombre, un caractère, une paire, ou un pictogramme au trait. */
export type Forme = 'nombre' | 'caractere' | 'paire' | 'objet';

/** Les trois objets de Tao que le tableau connaît (brief §9). */
export type Objet = 'pinceau' | 'lanterne' | 'bol';

export type Trophee = {
  /** Stable d'un calcul à l'autre : `lire-100`, `sceau-人`, `piege-天夫`, `serie-30`. */
  id: string;
  famille: FamilleTrophee;
  forme: Forme;
  /** Ce qui s'écrit dans le sceau : « 100 », « 人 », « 天夫 », « 7 j ». Vide pour un objet. */
  sceau: string;
  objet?: Objet;
  /** Le nom, sous le sceau. */
  nom: string;
  /** Une phrase, montrée dans la carte du résumé quand on touche le trophée. */
  detail: string;
  unite: Unite;
  /** Où l'on en est, dans l'unité de la règle. */
  actuel: number;
  /** Ce qu'il faut atteindre. */
  cible: number;
  obtenu: boolean;
  /** Faux quand la progression ne trace pas encore ce que la règle compte : verrouillé. */
  suivi: boolean;
  /** La progression en petit : « 62 / 100 », « pas encore vus », « au seuil 255 ». */
  progres: string;
  /** Entre 0 et 1, pour la barre. */
  part: number;
};

export type Section = {
  famille: FamilleTrophee;
  titre: string;
  /** Une phrase d'explication sous le titre. */
  explication: string;
  trophees: Trophee[];
  obtenus: number;
  total: number;
};

export type Tableau = {
  sections: Section[];
  obtenus: number;
  total: number;
  /** Le trophée le plus proche parmi ceux que la progression suit, `null` s'il n'en reste pas. */
  prochain: Trophee | null;
};

/** Ce que le tableau lit du contenu exporté. */
export type ContenuTrophees = {
  index: Index;
  familles: readonly Famille[];
  /** Le fichier `paires.json` de l'export, brut ou déjà relu par `lirePaires`. */
  paires: unknown;
  /** Le sens d'un caractère quand le contenu en donne un (surcouche comprise). */
  sens?: ReadonlyMap<string, string>;
};

/* ---------- les constantes ---------- */

/**
 * Les seuils de lecture. 255, 505 et 1555 sont les seuils sinographiques de l'Éducation
 * nationale (brief §2) ; 10, 50 et 100 sont les premiers pas avant eux.
 */
export const SEUILS_LIRE = [10, 50, 100, 255, 505, 1555] as const;

/** Les seuils français nommés comme tels sur le tableau. */
const SEUILS_FRANCAIS: readonly number[] = [255, 405, 505, 805, 1555];

/** Un piège est déjoué après dix lectures de suite sans confusion. */
export const PIEGE_SUITE = 10;

/** Le pinceau : dix briques tracées. */
export const PINCEAU_BRIQUES = 10;

/** La lanterne : dix devinettes résolues. */
export const LANTERNE_DEVINETTES = 10;

/** Le bol : la première recette. */
export const BOL_RECETTES = 1;

/** Au moins six sceaux de famille à l'écran : deux rangées de la grille. */
export const SCEAUX_MIN = 6;

/**
 * Un sceau se pose sur une famille d'au moins deux caractères. Les familles d'un seul
 * caractère (150 sur 238 dans l'export) redoubleraient le compte des caractères lus.
 */
export const FAMILLE_MIN = 2;

/** Les familles pas encore commencées qu'on montre après les commencées. */
export const SCEAUX_SUIVANTS = 3;

/** Les colonnes de la grille : trois, quatre pour la série. */
export const COLONNES = 3;

/* ---------- les petites fonctions ---------- */

function part(actuel: number, cible: number): number {
  if (cible <= 0) return 0;
  return Math.max(0, Math.min(1, actuel / cible));
}

function fraction(actuel: number, cible: number): string {
  return `${Math.min(actuel, cible)} / ${cible}`;
}

function majuscule(s: string): string {
  return s === '' ? s : s[0].toLocaleUpperCase('fr') + s.slice(1);
}

/** « 他, 们, 做, 体 », et des points de suite au-delà de `max`. */
function liste(cs: readonly string[], max: number): string {
  const vus = cs.slice(0, max).join(', ');
  return cs.length > max ? `${vus}…` : vus;
}

function nombre(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/** Les caractères d'une famille, sans doublon : la racine peut paraître dans ses fiches. */
function membres(f: Famille): string[] {
  return [...new Set(caracteresDe(f))];
}

/** Le pinyin d'un caractère, d'après les fiches de l'export. */
function pinyins(familles: readonly Famille[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of familles) {
    if (f.racine.pinyin && !out.has(f.racine.c)) out.set(f.racine.c, f.racine.pinyin);
    for (const x of f.fiches) if (x.pinyin && !out.has(x.c)) out.set(x.c, x.pinyin);
  }
  return out;
}

/* ---------- 1. lire ---------- */

export function tropheesLire(lus: number): Trophee[] {
  return SEUILS_LIRE.map((n) => {
    const obtenu = lus >= n;
    const premier = n === SEUILS_FRANCAIS[0];
    const nom = premier ? 'Premier seuil' : SEUILS_FRANCAIS.includes(n) ? `Seuil ${n}` : `${n} caractères`;
    const reste = n - lus;
    const detail = obtenu
      ? `${n} caractères que tu sais lire.`
      : premier
        ? `Le premier seuil du français. Encore ${nombre(reste, 'caractère', 'caractères')}.`
        : `Encore ${nombre(reste, 'caractère', 'caractères')}.`;
    return {
      id: `lire-${n}`,
      famille: 'lire',
      forme: 'nombre',
      sceau: String(n),
      nom,
      detail,
      unite: 'caractere lu',
      actuel: lus,
      cible: n,
      obtenu,
      suivi: true,
      progres: fraction(lus, n),
      part: part(lus, n)
    };
  });
}

/* ---------- 2. sceaux de famille ---------- */

/**
 * Les familles montrées : toutes les commencées (une carte au moins), puis quelques
 * suivantes dans l'ordre du parcours, pas les 238. Seules comptent les familles d'au
 * moins `FAMILLE_MIN` caractères. Le compte est arrondi à une rangée
 * pleine de la grille.
 */
export function famillesDesSceaux(
  familles: readonly Famille[],
  cartes: readonly ReviewCard[],
  premierJour: ReadonlyMap<string, number>
): Famille[] {
  const loin = Number.MAX_SAFE_INTEGER;
  const avecCarte = new Set(cartes.map((k) => k.id));
  const ordre = (a: Famille, b: Famille): number =>
    (premierJour.get(a.racine.c) ?? loin) - (premierJour.get(b.racine.c) ?? loin) ||
    (a.racine.c < b.racine.c ? -1 : a.racine.c > b.racine.c ? 1 : 0);
  const scellables = familles.filter((f) => membres(f).length >= FAMILLE_MIN);
  const commencees = scellables.filter((f) => membres(f).some((c) => avecCarte.has(c))).sort(ordre);
  const suivantes = scellables
    .filter((f) => premierJour.has(f.racine.c) && !commencees.includes(f))
    .sort(ordre);
  const voulu = Math.max(SCEAUX_MIN, commencees.length + SCEAUX_SUIVANTS);
  const arrondi = Math.ceil(voulu / COLONNES) * COLONNES;
  return [...commencees, ...suivantes.slice(0, Math.max(0, arrondi - commencees.length))];
}

export function tropheesSceaux(
  familles: readonly Famille[],
  cartes: readonly ReviewCard[],
  premierJour: ReadonlyMap<string, number>,
  sens: ReadonlyMap<string, string> = new Map(),
  seuil: number = SEUIL_DEBLOCAGE
): Trophee[] {
  return famillesDesSceaux(familles, cartes, premierJour).map((f) => {
    const cs = membres(f);
    const lus = cs.filter((c) => avancement(c, cartes, seuil) >= 1);
    const restants = cs.filter((c) => !lus.includes(c));
    const commencee = cs.some((c) => cartes.some((k) => k.id === c));
    const obtenu = restants.length === 0;
    const r = f.racine.c;
    const glose = f.racine.fr || sens.get(r) || '';
    const jour = premierJour.get(r);
    const detail = obtenu
      ? `${liste(cs, 5)} : la famille est lue en entier.`
      : commencee
        ? `Il reste ${liste(restants, 4)}.`
        : jour !== undefined
          ? `Elle s'ouvre au jour ${jour} du parcours.`
          : `Elle n'est pas encore sur ton parcours.`;
    return {
      id: `sceau-${r}`,
      famille: 'sceaux',
      forme: 'caractere',
      sceau: r,
      nom: glose !== '' ? majuscule(glose) : f.racine.pinyin || `Famille ${r}`,
      detail,
      unite: 'caractere de la famille lu',
      actuel: lus.length,
      cible: cs.length,
      obtenu,
      suivi: true,
      progres: fraction(lus.length, cs.length),
      part: part(lus.length, cs.length)
    };
  });
}

/* ---------- 3. pièges déjoués ---------- */

/**
 * Une lecture d'un caractère du groupe l'a-t-elle confondu avec un autre du groupe ?
 *
 * Quand la révision a gardé les leurres pris (`leurres` de l'historique), la confusion
 * est exacte : un leurre qui est un autre caractère du groupe, même rattrapé au second
 * essai. Une erreur venue d'ailleurs (un autre leurre, des briques dans le désordre) ne
 * compte pas. Quand la révision ne les a pas gardés (un événement d'avant ce suivi, un
 * tracé, un jeu), on reste prudent : une lecture ratée est une confusion.
 */
export function confondu(
  h: Pick<ReviewCard['history'][number], 'rating' | 'leurres'>,
  c: string,
  groupe: readonly string[]
): boolean {
  if (h.leurres !== undefined) return h.leurres.some((x) => x !== c && groupe.includes(x));
  return h.rating === Rating.Again;
}

/**
 * Les lectures d'un groupe de caractères proches, dans l'ordre : les révisions notées
 * de chacun, mises bout à bout. Une lecture est « sans confusion » quand elle ne prend pas
 * un caractère du groupe pour un autre (`confondu`) ; la vitesse de la réponse n'y change
 * rien (Facile, Bien et Dur comptent pareil).
 */
export function lecturesDuGroupe(
  groupe: readonly string[],
  cartes: readonly ReviewCard[]
): boolean[] {
  return cartes
    .filter((k) => groupe.includes(k.id))
    .flatMap((k) =>
      k.history.map((h) => ({ t: new Date(h.at).getTime(), juste: !confondu(h, k.id, groupe) }))
    )
    .sort((a, b) => a.t - b.t)
    .map((x) => x.juste);
}

/** La suite en cours : les lectures justes depuis la dernière erreur. */
export function suiteEnCours(lectures: readonly boolean[]): number {
  let n = 0;
  for (let i = lectures.length - 1; i >= 0 && lectures[i]; i--) n++;
  return n;
}

/** La plus longue suite : un piège déjoué le reste, même après une erreur. */
export function meilleureSuite(lectures: readonly boolean[]): number {
  let max = 0;
  let n = 0;
  for (const juste of lectures) {
    n = juste ? n + 1 : 0;
    max = Math.max(max, n);
  }
  return max;
}

export function tropheesPieges(
  paires: Paires,
  cartes: readonly ReviewCard[],
  pinyin: ReadonlyMap<string, string> = new Map(),
  sens: ReadonlyMap<string, string> = new Map(),
  seuil: number = SEUIL_DEBLOCAGE
): Trophee[] {
  return paires
    .filter((g) => g.length >= 2)
    .map((g) => {
      const vus = g.every((c) => avancement(c, cartes, seuil) >= 1);
      const lectures = vus ? lecturesDuGroupe(g, cartes) : [];
      const obtenu = vus && meilleureSuite(lectures) >= PIEGE_SUITE;
      const actuel = obtenu ? PIEGE_SUITE : suiteEnCours(lectures);
      const nom = g.length === 2 ? `${g[0]} et ${g[1]}` : `${g.slice(0, -1).join(', ')} et ${g[g.length - 1]}`;
      const gloses = g
        .map((c) => [pinyin.get(c), sens.get(c)].filter(Boolean).join(', '))
        .filter((x) => x !== '');
      const tous = g.length === 2 ? 'les deux' : `les ${g.length}`;
      const detail = !vus
        ? `Ils arrivent quand ${tous} sont acquis.`
        : gloses.length === g.length
          ? `${gloses.join(' ; ')}.`
          : `Encore ${nombre(PIEGE_SUITE - actuel, 'lecture', 'lectures')} de suite sans les confondre.`;
      return {
        id: `piege-${g.join('')}`,
        famille: 'pieges',
        forme: 'paire',
        sceau: g.join(''),
        nom,
        detail,
        unite: 'lecture sans confusion',
        actuel,
        cible: PIEGE_SUITE,
        obtenu,
        suivi: vus,
        progres: vus ? fraction(actuel, PIEGE_SUITE) : 'pas encore vus',
        part: part(actuel, PIEGE_SUITE)
      };
    });
}

/* ---------- 4. contes ---------- */

/**
 * Un trophée par conte et par seuil : le même conte, relu plus riche. La progression
 * n'enregistre pas encore la lecture d'un conte : ils restent verrouillés, avec leur seuil.
 */
export function tropheesContes(index: Index, lus: number): Trophee[] {
  return index.contes.flatMap((conte) =>
    [...conte.seuils]
      .sort((a, b) => a - b)
      .map((s): Trophee => {
        const ouvert = lus >= s;
        return {
          id: `conte-${conte.id}-${s}`,
          famille: 'contes',
          forme: 'nombre',
          sceau: String(s),
          nom: conte.titre_fr,
          detail: ouvert
            ? `La version du seuil ${s} t'est ouverte.`
            : `La version du seuil ${s}, quand tu liras ${s} caractères.`,
          unite: 'conte lu',
          actuel: 0,
          cible: 1,
          obtenu: false,
          suivi: false,
          progres: ouvert ? 'à lire' : `au seuil ${s}`,
          part: 0
        };
      })
  );
}

/* ---------- 5. objets de Tao ---------- */

/**
 * Le pinceau se lit sur `tracesAchevees` : les briques tracées en entier au doigt
 * (`session.traceAchevee`), pas celles dont le tracé a seulement été proposé. La lanterne
 * et le bol attendent leurs jeux : la progression ne suit encore ni les devinettes ni les
 * recettes, ils restent verrouillés.
 */
export function tropheesObjets(tracesAchevees: readonly string[]): Trophee[] {
  const n = new Set(tracesAchevees).size;
  const pinceau = n >= PINCEAU_BRIQUES;
  return [
    {
      id: 'objet-pinceau',
      famille: 'objets',
      forme: 'objet',
      objet: 'pinceau',
      sceau: '',
      nom: 'Pinceau',
      detail: pinceau
        ? 'Dix briques tracées au doigt. Tao le tient au tracé.'
        : `Encore ${nombre(PINCEAU_BRIQUES - n, 'brique', 'briques')} à tracer.`,
      unite: 'brique tracee',
      actuel: n,
      cible: PINCEAU_BRIQUES,
      obtenu: pinceau,
      suivi: true,
      progres: fraction(n, PINCEAU_BRIQUES),
      part: part(n, PINCEAU_BRIQUES)
    },
    {
      id: 'objet-lanterne',
      famille: 'objets',
      forme: 'objet',
      objet: 'lanterne',
      sceau: '',
      nom: 'Lanterne',
      detail: 'Dix devinettes de lanternes résolues. Le jeu n’est pas encore ouvert.',
      unite: 'devinette resolue',
      actuel: 0,
      cible: LANTERNE_DEVINETTES,
      obtenu: false,
      suivi: false,
      progres: `${LANTERNE_DEVINETTES} devinettes`,
      part: 0
    },
    {
      id: 'objet-bol',
      famille: 'objets',
      forme: 'objet',
      objet: 'bol',
      sceau: '',
      nom: 'Bol',
      detail: 'La première recette de la cuisine de Tao. Le jeu n’est pas encore ouvert.',
      unite: 'recette cuisinee',
      actuel: 0,
      cible: BOL_RECETTES,
      obtenu: false,
      suivi: false,
      progres: 'première recette',
      part: 0
    }
  ];
}

/* ---------- 6. série ---------- */

/** Les quatre paliers de `serie.ts`, leurs cadeaux remis par Que, sans rien y changer. */
export function tropheesSerie(joursTravailles: readonly string[], aujourdhui: string): Trophee[] {
  const s = etatSerie(joursTravailles, aujourdhui);
  return PALIERS.map((m) => {
    const obtenu = s.atteints.includes(m);
    const cadeau = CADEAUX[m];
    return {
      id: `serie-${m}`,
      famille: 'serie',
      forme: 'nombre',
      sceau: `${m} j`,
      nom: `${m} jours`,
      detail: `${cadeau.titre}. ${cadeau.detail}${cadeau.remise ? ` ${NOTE_REMISE}` : ''}`,
      unite: 'journee travaillee',
      actuel: obtenu ? m : s.jours,
      cible: m,
      obtenu,
      suivi: true,
      progres: fraction(s.jours, m),
      part: obtenu ? 1 : part(s.jours, m)
    };
  });
}

/* ---------- le tableau ---------- */

const TITRES: Record<FamilleTrophee, { titre: string; explication: string }> = {
  lire: {
    titre: 'Lire',
    explication: "Des caractères que tu sais lire. 255, c'est le premier seuil du français."
  },
  sceaux: {
    titre: 'Sceaux de famille',
    explication: 'Une famille entière lue. Le sceau se pose sur le pot de Tao.'
  },
  pieges: {
    titre: 'Pièges déjoués',
    explication: 'Deux caractères proches, lus dix fois de suite sans les confondre.'
  },
  contes: {
    titre: 'Contes',
    explication: 'Le même conte, relu plus riche à chaque seuil.'
  },
  objets: {
    titre: 'Objets de Tao',
    explication: "Ce que les jeux rapportent, Tao le porte. Rien ne s'achète."
  },
  serie: {
    titre: 'Série',
    explication:
      'Les cadeaux de Que 雀. Un jour travaillé, une graine, jamais plus : une session de plus ne compte pas double.'
  }
};

/** La phrase d'une section sans trophée : les contes, tant que l'export n'en porte aucun. */
export const SECTION_VIDE: Partial<Record<FamilleTrophee, string>> = {
  contes: "Aucun conte n'est encore publié dans le contenu."
};

function section(famille: FamilleTrophee, trophees: Trophee[]): Section {
  return {
    famille,
    ...TITRES[famille],
    trophees,
    obtenus: trophees.filter((t) => t.obtenu).length,
    total: trophees.length
  };
}

/**
 * Le prochain trophée : parmi ceux que la progression suit et qui ne sont pas obtenus,
 * le plus avancé ; à égalité, le premier dans l'ordre de l'écran.
 */
export function prochain(trophees: readonly Trophee[]): Trophee | null {
  let mieux: Trophee | null = null;
  for (const t of trophees) {
    if (t.obtenu || !t.suivi) continue;
    if (mieux === null || t.part > mieux.part) mieux = t;
  }
  return mieux;
}

/** Le tableau complet, calculé depuis la progression et le contenu exporté. */
export function tableau(
  p: Progress,
  c: ContenuTrophees,
  seuil: number = SEUIL_DEBLOCAGE
): Tableau {
  const lus = caracteresLus(c.familles, p.cartes, seuil);
  const nom = nomParcours(c.index, p.parcours);
  const premierJour = joursDesFamilles(c.index, nom, racinesDesCaracteres(c.familles));
  const sens = c.sens ?? new Map<string, string>();
  const paires = lirePaires(c.paires);
  const sections = [
    section('lire', tropheesLire(lus)),
    section('sceaux', tropheesSceaux(c.familles, p.cartes, premierJour, sens, seuil)),
    section('pieges', tropheesPieges(paires, p.cartes, pinyins(c.familles), sens, seuil)),
    section('contes', tropheesContes(c.index, lus)),
    section('objets', tropheesObjets(p.tracesAchevees)),
    section('serie', tropheesSerie(p.joursTravailles, p.day))
  ];
  const tous = sections.flatMap((s) => s.trophees);
  return {
    sections,
    obtenus: tous.filter((t) => t.obtenu).length,
    total: tous.length,
    prochain: prochain(tous)
  };
}

/* ---------- les phrases ---------- */

/** « 7 trophées sur 28 », pour le résumé. */
export function ligneCompte(t: Tableau): string {
  return `${t.obtenus} ${t.obtenus > 1 ? 'trophées' : 'trophée'} sur ${t.total}`;
}

/** Le prochain, en quelques mots, pour l'entrée de Ma forêt. */
export function ligneProchain(t: Trophee | null): string {
  if (t === null) return 'tous obtenus';
  switch (t.famille) {
    case 'lire':
      return `le prochain à ${t.cible} caractères lus`;
    case 'sceaux':
      return `le prochain : la famille ${t.sceau}`;
    case 'serie':
      return `le prochain au ${t.cible}e jour`;
    case 'objets':
      return `le prochain : le ${t.nom.toLocaleLowerCase('fr')}`;
    default:
      return `le prochain : ${t.nom}`;
  }
}

/** La ligne de l'entrée « Tes trophées » : « 7 sur 28 · le prochain à 100 caractères lus ». */
export function ligneEntree(t: Tableau): string {
  return `${t.obtenus} sur ${t.total} · ${ligneProchain(t.prochain)}`;
}
