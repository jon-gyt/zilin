/**
 * Le tableau des révisions : la transparence du SRS (rapport comparatif du 28 septembre 2026,
 * §2.6). Ce qui revient les sept prochains jours, ce qu'on retient face à la cible FSRS, et
 * les caractères qui résistent.
 *
 * Module pur : il ne lit ni l'horloge, ni un stockage, ni le DOM ; l'instant est toujours
 * passé en argument. Tout se calcule sur ce que la progression garde déjà, les cartes FSRS
 * (`srs.ts`) et leur historique borné (`HISTORIQUE_MAX` lignes par carte) : rien de nouveau
 * n'est noté, le format de la progression ne bouge pas.
 *
 * Rien au temps passé : aucune règle ne lit une durée ni un temps de réponse (la note, que
 * `srs.grade` a déjà tirée de la réponse, suffit). Ni classement, ni percentile, ni
 * comparaison avec d'autres : la seule référence est la cible que l'on a soi-même réglée.
 */
import { Rating } from 'ts-fsrs';
import { remplir, type TextesRevisions } from './ecrans';
import { stability, type ReviewCard } from './srs';

/** Sept jours, aujourd'hui compris. */
export const JOURS_A_VENIR = 7;

/** La fenêtre de la rétention mesurée et des caractères qui résistent, en jours. */
export const FENETRE_JOURS = 30;

/** En dessous, la rétention ne se mesure pas : trop peu de cartes pour dire un nombre. */
export const MIN_MESURE = 10;

/** Au plus cinq caractères qui résistent : ceux qu'on peut revoir d'un regard. */
export const MAX_RESISTENT = 5;

const JOUR_MS = 86_400_000;

/* ---------- les jours, en heure locale ---------- */

/** Minuit, heure locale, du jour de `d` décalé de `n` jours. */
function minuit(d: Date, n = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/* ---------- ce qui revient ---------- */

/** Un jour des sept prochains : son décalage (0 aujourd'hui), son jour de semaine (0 dimanche), ses cartes. */
export type JourAVenir = { decalage: number; semaine: number; n: number };

/**
 * Les cartes qui reviennent chacun des sept prochains jours, en heure locale. Aujourd'hui
 * compte aussi celles déjà dues : c'est la pile que la séance trouvera. Les cartes mises de
 * côté (`enAttente`, sans fiche pour les poser) n'y comptent pas, comme dans la pile due
 * (`session.nombreDues`).
 */
export function aVenir(
  cartes: readonly ReviewCard[],
  maintenant: Date,
  enAttente: readonly string[] = [],
  jours: number = JOURS_A_VENIR
): JourAVenir[] {
  const cote = new Set(enAttente);
  const out: JourAVenir[] = Array.from({ length: jours }, (_, decalage) => ({
    decalage,
    semaine: minuit(maintenant, decalage).getDay(),
    n: 0
  }));
  const fin = (decalage: number): number => minuit(maintenant, decalage + 1).getTime();
  for (const k of cartes) {
    if (cote.has(k.id)) continue;
    const t = k.card.due.getTime();
    const decalage = out.findIndex((j) => t < fin(j.decalage));
    if (decalage >= 0) out[decalage].n++;
  }
  return out;
}

/** Le total des sept jours. */
export function totalAVenir(jours: readonly JourAVenir[]): number {
  return jours.reduce((s, j) => s + j.n, 0);
}

/* ---------- ce qu'on retient ---------- */

export type Retention = {
  /** Les cartes revenues à leur échéance dans la fenêtre. */
  revues: number;
  /** Celles sues, même rattrapées après une erreur : tout sauf « Oublié ». */
  sues: number;
  /** `sues / revues`, `null` sous `MIN_MESURE` : on ne dit pas un nombre sans assez de cartes. */
  mesure: number | null;
};

/**
 * La rétention mesurée, celle que la cible FSRS vise : parmi les cartes revenues à leur
 * échéance dans la fenêtre, la part de celles qu'on savait encore. Une ligne d'historique
 * compte quand la précédente l'avait planifiée à un jour ou plus : la première rencontre
 * n'a rien à retenir, et le retour à dix minutes après une réponse montrée n'est pas une
 * échéance. La première ligne gardée d'une carte, dont on ignore la précédente, ne compte
 * pas.
 */
export function retention(
  cartes: readonly ReviewCard[],
  maintenant: Date,
  fenetre: number = FENETRE_JOURS
): Retention {
  const depuis = maintenant.getTime() - fenetre * JOUR_MS;
  let revues = 0;
  let sues = 0;
  for (const k of cartes) {
    for (let i = 1; i < k.history.length; i++) {
      const h = k.history[i];
      const t = h.at.getTime();
      if (t <= depuis || t > maintenant.getTime()) continue;
      const avant = k.history[i - 1];
      if (avant.due.getTime() - avant.at.getTime() < JOUR_MS) continue;
      revues++;
      if (h.rating !== Rating.Again) sues++;
    }
  }
  return { revues, sues, mesure: revues >= MIN_MESURE ? sues / revues : null };
}

/** Un nombre sur 100, arrondi : 0,884 donne 88. */
export function surCent(x: number): number {
  return Math.round(x * 100);
}

/* ---------- ceux qui résistent ---------- */

export type Resistant = { c: string; manques: number };

/**
 * Les caractères les plus souvent manqués dans la fenêtre (« Oublié », quel que soit le
 * type de question), au plus `max`, le plus manqué d'abord ; à égalité, le plus fragile
 * (la stabilité FSRS la plus basse), puis l'ordre des caractères. Une carte jamais manquée
 * n'y est pas.
 */
export function resistent(
  cartes: readonly ReviewCard[],
  maintenant: Date,
  fenetre: number = FENETRE_JOURS,
  max: number = MAX_RESISTENT
): Resistant[] {
  const depuis = maintenant.getTime() - fenetre * JOUR_MS;
  return cartes
    .map((k) => ({
      k,
      manques: k.history.filter(
        (h) => h.rating === Rating.Again && h.at.getTime() > depuis && h.at.getTime() <= maintenant.getTime()
      ).length
    }))
    .filter((x) => x.manques > 0)
    .sort((a, b) => b.manques - a.manques || stability(a.k) - stability(b.k) || (a.k.id < b.k.id ? -1 : 1))
    .slice(0, Math.max(0, max))
    .map((x) => ({ c: x.k.id, manques: x.manques }));
}

/* ---------- les lignes, par les textes du pipeline ---------- */

/** Le nom court d'un jour sous sa barre : « auj. », puis « mar. », « mer. »… */
export function nomDuJour(t: TextesRevisions, j: Pick<JourAVenir, 'decalage' | 'semaine'>): string {
  if (j.decalage === 0) return t.aujourdhui;
  return t.jours.split(/\s+/)[j.semaine] ?? '';
}

/** Ce qu'une barre dit à un lecteur d'écran : « mar. : 4 cartes ». */
export function ligneBarre(t: TextesRevisions, j: JourAVenir): string {
  const jour = nomDuJour(t, j);
  return j.n === 1 ? remplir(t['barre-une'], { jour }) : remplir(t.barre, { jour, n: j.n });
}

/** « 41 cartes reviennent cette semaine. » */
export function ligneAVenir(t: TextesRevisions, total: number): string {
  if (total === 0) return t['venir-rien'];
  return total === 1 ? t['venir-une'] : remplir(t['venir-ligne'], { n: total });
}

/** L'entrée de Mon chemin : « Demain 8 · cette semaine 41 », ou sa ligne quand rien ne revient. */
export function ligneEntree(t: TextesRevisions, jours: readonly JourAVenir[]): string {
  const semaine = totalAVenir(jours);
  if (semaine === 0) return t['entree-vide'];
  return remplir(t['entree-ligne'], { demain: jours[1]?.n ?? 0, semaine });
}

/** La rétention mesurée face à la cible, ou pourquoi elle ne se mesure pas encore. */
export function ligneRetention(t: TextesRevisions, r: Retention, cible: number): string {
  if (r.mesure === null) return remplir(t['retention-peu'], { jours: FENETRE_JOURS, min: MIN_MESURE });
  return remplir(t.retention, {
    jours: FENETRE_JOURS,
    mesure: surCent(r.mesure),
    n: r.revues,
    cible: surCent(cible)
  });
}

/** « manqué 3 fois » sous un caractère qui résiste. */
export function ligneManques(t: TextesRevisions, n: number): string {
  return n === 1 ? t['resistent-une'] : remplir(t['resistent-ligne'], { n });
}
