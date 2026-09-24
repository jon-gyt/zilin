/**
 * Les vingt-quatre termes solaires (二十四节气) : quel terme court une journée, et quel
 * thème l'app prend ce jour-là.
 *
 * Module pur. Les dates et les textes viennent de `saisons.json`, écrit par le pipeline
 * (`data/sources/saisons/`) et lu par `content.saisonsOnce` : l'app ne calcule aucun
 * terme et n'écrit aucun texte. Elle choisit le terme dont l'intervalle couvre la journée
 * (du jour de son début inclus au début du suivant exclu).
 *
 * Les fêtes gardent la priorité : un jour de fête, le thème est celui de la fête, l'en-tête
 * montre le vœu et l'anecdote est celle de la fête. Le terme court toujours derrière — 中秋
 * recouvre 秋分, 清明 est lui-même un terme mais garde son thème de fête — et revient le
 * lendemain de la fête.
 *
 * La journée est celle de la session (`p.day`), comme pour les fêtes et l'anecdote.
 */
import { jourDepuisEpoque, type FeteId, type Fetes, type Saisons } from './content';
import { feteDuJour, type FeteDuJour } from './fetes';

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
