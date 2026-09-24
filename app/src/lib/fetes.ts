/**
 * Les fêtes : quelle fête couvre une journée, et ce qu'elle dit ce jour-là.
 *
 * Module pur. Les dates et les textes viennent de `fetes.json`, écrit par le pipeline
 * (`data/sources/fetes/`) et lu par `content.fetesOnce` : l'app ne calcule aucune date
 * du calendrier lunaire et n'écrit aucun texte de fête. Elle choisit seulement la fête
 * dont la fenêtre couvre la journée, et remplit deux jetons :
 *
 * - `{animal}` : l'animal de l'année lunaire de l'entrée (« de la Chèvre 羊 ») ;
 * - `{quand}` : le délai jusqu'au soir de la fête (« Demain soir », « Ce soir »).
 *
 * La journée est celle de la session (`p.day`), comme pour l'anecdote : une session
 * commencée la veille de la fête reste la veille jusqu'à sa fin.
 */
import { jourDepuisEpoque, type Animal, type FeteId, type Fetes } from './content';

/** Ce que l'app montre un jour de fête, jetons remplis. */
export type FeteDuJour = {
  id: FeteId;
  /** La date de la fête (AAAA-MM-JJ). */
  date: string;
  /** Jours de la journée à la fête : 1 la veille, 0 le jour même, −1 le lendemain. */
  ecart: number;
  /** Le délai, en toutes lettres : « Demain soir », « Ce soir »… */
  quand: string;
  nom: string;
  nomZh: string;
  animal: Animal;
  voeu: { zh: string; pinyin: string; fr: string };
  /** Le caractère dessiné à côté du vœu (福 au Nouvel An), `null` sinon. */
  caractereVoeu: string | null;
  /** Les phrases de Tao pendant la fête, dans l'ordre. */
  tao: string[];
  anecdote: { rubrique: string; c: string; titre: string; texte: string };
};

/** Jours de `de` à `a`, deux dates AAAA-MM-JJ : positif si `a` est après `de`. */
export function ecartJours(de: string, a: string): number {
  return jourDepuisEpoque(a) - jourDepuisEpoque(de);
}

/** Le délai jusqu'au soir de la fête, dit simplement. */
export function quand(ecart: number): string {
  if (ecart > 1) return `Dans ${ecart} jours`;
  if (ecart === 1) return 'Demain soir';
  if (ecart === 0) return 'Ce soir';
  if (ecart === -1) return 'Hier soir';
  return `Il y a ${-ecart} jours`;
}

/** Remplit les jetons `{animal}` et `{quand}` ; un jeton inconnu reste tel quel. */
export function remplir(texte: string, jetons: { animal: string; quand: string }): string {
  return texte.replace(/\{(animal|quand)\}/g, (_, k: 'animal' | 'quand') => jetons[k]);
}

/**
 * La fête qui couvre la journée `jour` (AAAA-MM-JJ), ou `null`. Une fête couvre les
 * jours de `date − avant` à `date + apres` inclus. Les fenêtres ne se chevauchent pas
 * (`wenlu check` le vérifie) ; si elles le faisaient, la première du calendrier gagne.
 */
export function feteDuJour(f: Fetes, jour: string): FeteDuJour | null {
  if (!Number.isFinite(jourDepuisEpoque(jour))) return null;
  for (const e of f.calendrier) {
    const ecart = ecartJours(jour, e.date);
    if (!Number.isFinite(ecart) || ecart > e.avant || -ecart > e.apres) continue;
    const t = f.fetes[e.fete];
    if (!t) continue;
    const jetons = { animal: `${e.animal.fr} ${e.animal.c}`.trim(), quand: quand(ecart) };
    return {
      id: e.fete,
      date: e.date,
      ecart,
      quand: jetons.quand,
      nom: t.nom,
      nomZh: t.nom_zh,
      animal: e.animal,
      voeu: { zh: t.voeu.zh, pinyin: t.voeu.pinyin, fr: remplir(t.voeu.fr, jetons) },
      caractereVoeu: t.caractere_voeu || null,
      tao: t.tao.map((l) => remplir(l, jetons)),
      anecdote: { ...t.anecdote }
    };
  }
  return null;
}

/**
 * Les pistes pour trouver les traits d'un caractère de fête : sa famille, que
 * `fetes.json` nomme. `traitsDe(c, pistes(f, c))` n'a alors qu'un fichier à lire.
 */
export function pistes(f: Fetes, c: string): string[] {
  const r = f.racines[c];
  return r ? [r] : [];
}

/**
 * Pose la fête sur la racine du document (`data-fete`), ou la retire : `tokens.css`
 * repeint l'app par cet attribut. La seule écriture de ce module, sur l'élément donné.
 */
export function poserFete(racine: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>, id: FeteId | null): void {
  if (id) racine.setAttribute('data-fete', id);
  else racine.removeAttribute('data-fete');
}
