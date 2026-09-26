/**
 * Les vingt-quatre termes solaires (二十四节气) : quel terme court une journée, et quel
 * thème l'app prend ce jour-là.
 *
 * Module pur. Les dates et les textes viennent de `saisons.json`, écrit par le pipeline
 * (`data/sources/saisons/`) et lu par `content.saisonsOnce` : l'app ne calcule aucun
 * terme et n'écrit aucun texte. Elle choisit le terme dont l'intervalle couvre la journée
 * (du jour de son début inclus au début du suivant exclu).
 *
 * Les fêtes gardent la priorité : un jour de fête, le thème est celui de la fête et l'en-tête
 * montre le vœu, toute la fenêtre durant. L'anecdote de la fête, elle, se montre une fois
 * par occurrence, le premier jour de la fenêtre où l'on ouvre l'app (`anecdoteDeFete`) ;
 * les autres jours ont l'anecdote ordinaire. Le terme court toujours derrière — 中秋
 * recouvre 秋分, 清明 est lui-même un terme mais garde son thème de fête — et revient le
 * lendemain de la fête.
 *
 * La journée est celle de la session (`p.day`), comme pour les fêtes et l'anecdote.
 */
import { choisirAnecdote } from './anecdotes';
import {
  jourDepuisEpoque,
  type Anecdote,
  type FeteId,
  type Fetes,
  type Saisons
} from './content';
import { dansLaFenetre, feteDuJour, pistes as pistesFete, type FeteDuJour } from './fetes';
import type { Progress } from './session';

/** Ce que l'app montre d'un terme, pour une journée. */
export type TermeDuJour = {
  /** L'identifiant, le pinyin sans ton : `bailu`, `qiufen`. */
  id: string;
  nomZh: string;
  pinyin: string;
  /** La traduction : « la rosée blanche ». */
  fr: string;
  /** L'ambiance de saison, que `[data-saison]` repeint et que le décor dessine. */
  ambiance: string;
  /** Une phrase : ce qui se passe dans la nature. */
  ligne: string;
  tao: string[];
  /** Le caractère à lire du terme, dessiné depuis ses traits. */
  caractere: { c: string; pinyin: string; sens: string };
  /** Le jour où le terme a commencé (AAAA-MM-JJ). */
  debut: string;
  /** Le jour où commence le terme suivant (exclu). */
  fin: string;
  /** Jours écoulés depuis le début : 0 le premier jour. */
  depuis: number;
  /** Vrai le jour où le terme commence. */
  commence: boolean;
};

/**
 * Le terme qui court la journée `jour` (AAAA-MM-JJ), ou `null` hors du calendrier. Les
 * intervalles se suivent sans trou ni chevauchement (`wenlu check` le vérifie) ; s'ils se
 * chevauchaient, le premier du calendrier gagnerait.
 */
export function termeDuJour(s: Saisons, jour: string): TermeDuJour | null {
  const j = jourDepuisEpoque(jour);
  if (!Number.isFinite(j)) return null;
  for (const e of s.calendrier) {
    const debut = jourDepuisEpoque(e.debut);
    if (!(debut <= j && j < jourDepuisEpoque(e.fin))) continue;
    const t = s.termes[e.terme];
    if (!t) continue;
    return {
      id: e.terme,
      nomZh: t.nom_zh,
      pinyin: t.pinyin,
      fr: t.fr,
      ambiance: t.ambiance,
      ligne: t.ligne,
      tao: [...t.tao],
      caractere: { ...t.caractere },
      debut: e.debut,
      fin: e.fin,
      depuis: j - debut,
      commence: j === debut
    };
  }
  return null;
}

/** Le thème de la journée : la fête s'il y en a une, sinon l'ambiance du terme. */
export type Theme = { fete: FeteId | null; saison: string | null };

/** La fête a priorité : un jour de fête, aucune ambiance de saison ne se pose. */
export function theme(fete: FeteDuJour | null, terme: TermeDuJour | null): Theme {
  if (fete) return { fete: fete.id, saison: null };
  return { fete: null, saison: terme?.ambiance ?? null };
}

/** Une journée : la fête s'il y en a une, le terme qui court, et le thème qui en résulte. */
export type Journee = { fete: FeteDuJour | null; terme: TermeDuJour | null; theme: Theme };

/** Pour une date : le terme en cours, son jour de début, la fête du jour, et le thème. */
export function journee(fetes: Fetes | null, saisons: Saisons | null, jour: string): Journee {
  const fete = fetes ? feteDuJour(fetes, jour) : null;
  const terme = saisons ? termeDuJour(saisons, jour) : null;
  return { fete, terme, theme: theme(fete, terme) };
}

/**
 * Les phrases de Tao sur le chemin du menu. Un jour de fête, elle commence par la fête ; un
 * jour de terme, par le terme. Puis elle revient à la journée, et ses autres phrases de fête
 * ou de terme viennent après.
 */
export function phrasesDeTao(
  fete: FeteDuJour | null,
  terme: TermeDuJour | null,
  journee: readonly string[]
): string[] {
  const propres = fete ? fete.tao : (terme?.tao ?? []);
  if (propres.length === 0) return [...journee];
  return [propres[0], ...journee, ...propres.slice(1)];
}

/** L'anecdote du jour présente le terme le jour où il commence, sauf un jour de fête. */
export function annonceLeTerme(fete: FeteDuJour | null, terme: TermeDuJour | null): boolean {
  return fete === null && terme !== null && terme.commence;
}

/** La famille du caractère d'un terme, pour lire ses traits sans relire toutes les familles. */
export function pistes(s: Saisons, c: string): string[] {
  const r = s.racines[c];
  return r ? [r] : [];
}

/**
 * L'anecdote de la fête est-elle celle de la journée `jour` ? Une fois par occurrence de
 * la fête : le premier jour de sa fenêtre où l'écran Ouvrir la montre, et toute cette
 * journée-là, pour que Lire et l'en-tête du menu rouvrent la même. Ce jour peut tomber
 * avant, pendant ou après le jour de la fête : qui manque le jour même trouve quand même
 * le caractère bonus (« Trouvés en chemin »). `vues` est le registre de la progression
 * (`Progress.fetesVues`) : la journée où l'anecdote de chaque fête a été montrée. Une
 * journée hors de la fenêtre en cours est celle d'une autre année : la fête est neuve.
 * Retour du propriétaire du 26 septembre 2026 : la même anecdote cinq jours de suite.
 */
export function anecdoteDeFete(
  fete: FeteDuJour | null,
  vues: Readonly<Record<string, string>>,
  jour: string
): boolean {
  if (fete === null) return false;
  const vue = vues[fete.id];
  return vue === undefined || vue === jour || !dansLaFenetre(fete, vue);
}

/** Ce que l'app sait de la progression pour choisir l'anecdote d'une journée. */
export type SuiviAnecdote = {
  /** La journée où l'anecdote de chaque fête a été montrée (`Progress.fetesVues`). */
  fetesVues: Readonly<Record<string, string>>;
  /** La dernière journée où chaque anecdote ordinaire a été montrée (`Progress.anecdotesVues`). */
  anecdotesVues?: Readonly<Record<string, string>>;
  /** Les caractères rencontrés ces derniers jours, le plus récent d'abord (`anecdotes.recents`). */
  recents?: readonly string[];
  /** Les caractères que le parcours pose dans le mois qui vient (`anecdotes.prochains`). */
  prochains?: readonly string[];
};

/**
 * Le suivi que la progression porte : l'écran Ouvrir et Lire le lisent pareil. `parcours`
 * dit, d'après l'index que l'appelant a chargé, les caractères récents et à venir
 * (`anecdotes.recents`, `anecdotes.prochains`).
 */
export function suiviDe(
  p: Pick<Progress, 'fetesVues' | 'anecdotesVues'>,
  parcours: { recents: readonly string[]; prochains: readonly string[] } = { recents: [], prochains: [] }
): SuiviAnecdote {
  return { fetesVues: p.fetesVues, anecdotesVues: p.anecdotesVues, ...parcours };
}

/**
 * L'anecdote d'une journée, telle que l'écran Ouvrir la montre : celle de la fête le jour
 * où elle se montre (`anecdoteDeFete`), celle du terme le jour où il commence, sinon celle
 * du fichier d'anecdotes, choisie par `anecdotes.choisirAnecdote`. `fete` et `terme` disent laquelle ; `pistes`, la famille où lire
 * les traits de son caractère. `null` quand rien ne se lit. Lire et l'en-tête du menu la
 * rouvrent : c'est la même, calculée au même endroit, sur la même progression.
 */
export type AnecdoteDeLaJournee = {
  a: Anecdote;
  fete: FeteDuJour | null;
  terme: TermeDuJour | null;
  pistes: string[];
};

export function anecdoteDeLaJournee(
  anecdotes: Anecdote[] | null,
  fetes: Fetes | null,
  saisons: Saisons | null,
  jour: string,
  suivi: SuiviAnecdote
): AnecdoteDeLaJournee | null {
  const fete = fetes ? feteDuJour(fetes, jour) : null;
  if (fete && fetes && anecdoteDeFete(fete, suivi.fetesVues, jour)) {
    const { c, titre, texte } = fete.anecdote;
    return { a: { c, titre, texte }, fete, terme: null, pistes: pistesFete(fetes, c) };
  }
  const t = saisons ? termeDuJour(saisons, jour) : null;
  if (t && saisons && annonceLeTerme(fete, t)) {
    const a = { c: t.caractere.c, titre: `${t.nomZh} · ${t.fr}`, texte: t.ligne };
    return { a, fete: null, terme: t, pistes: pistes(saisons, t.caractere.c) };
  }
  const a = anecdotes
    ? choisirAnecdote(anecdotes, jour, suivi.recents ?? [], suivi.anecdotesVues ?? {}, suivi.prochains ?? [])
    : null;
  return a ? { a, fete: null, terme: null, pistes: a.racine ? [a.racine] : [] } : null;
}

/**
 * L'anecdote de la journée vient d'être montrée par l'écran Ouvrir : la progression garde
 * la journée où celle d'une fête l'a été, ou celle d'une anecdote ordinaire (pour la
 * relire la même toute la journée, et ne pas la redire avant trente jours). Celle d'un
 * terme ne se note pas : elle ne revient qu'au jour où il commence. Rien de neuf : l'état
 * est rendu tel quel.
 */
export function noterAnecdoteMontree(p: Progress, r: AnecdoteDeLaJournee | null, jour: string): Progress {
  if (r === null || r.terme !== null) return p;
  if (r.fete !== null) {
    if (p.fetesVues[r.fete.id] === jour) return p;
    return { ...p, fetesVues: { ...p.fetesVues, [r.fete.id]: jour } };
  }
  if (p.anecdotesVues[r.a.c] === jour) return p;
  return { ...p, anecdotesVues: { ...p.anecdotesVues, [r.a.c]: jour } };
}
