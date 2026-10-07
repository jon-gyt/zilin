/**
 * Les mots de deux syllabes d'une voix dont `voix.ts` a gardé les syllabes (branches
 * `donnees/tons-voix` et `donnees/tons-cc`), rebâtis tels que l'app les voit : pour chaque
 * syllabe, sa forme (`x`, 30 points), sa hauteur face à la voix calibrée sur cinq caractères
 * (`rc`) et face à la voix entière (`ro`), dont on retire la déclinaison des réglages des mots
 * (`REGLAGES_MOTS.declinaison`, comprise dans `rc` et `ro`), sa durée et son voisement. Aucun
 * son : seulement ce que le suivi de hauteur de l'app en a tiré.
 *
 * Sert à `mots.ts` (les entrées du modèle des mots) et à `mesurer.ts` (les voix de Lingua
 * Libre tenues à part).
 */
import type { Contour } from '../../src/lib/tons/classifieur';
import { REGLAGES_MOTS } from '../../src/lib/tons/classifieur';

export type LigneVoix = {
  id: string; k: number; n: number; t: number; ok: boolean; x: number[]; rc: number; ro: number;
  probleme: string | null; e?: string; h?: number | null;
};
export type SourceVoix = { nom?: string; titre?: string; lien?: string; licence?: string; version?: string | null };
export type DocVoix = { voix: string; role: string; source?: SourceVoix; lignes: LigneVoix[] };

/** La voix de référence des contours rebâtis (Hz) : seules les hauteurs relatives comptent. */
export const REF = 100;

/** La licence d'une voix, version comprise (« CC BY-SA 3.0 US », « CC0 1.0 »). */
export function licenceDe(doc: DocVoix): string {
  const s = doc.source ?? {};
  return [s.licence, s.version].filter((x) => x).join(' ').trim();
}

export type MotRebati = {
  id: string;
  tons: number[];
  /** Les contours, la hauteur face à `REF` comme la voix calibrée la voit. */
  contours: Contour[];
  /** La référence de la voix entière, face à la même `REF`. */
  oracle: number;
  /** Ce que `voix.ts` a noté : `court`, `sature` ou `null` (réglages des caractères). */
  probleme: string | null;
  /** Le verdict des poids versionnés par la méthode syllabe par syllabe (`voix.ts --modele`). */
  etat: string | null;
};

/** Le contour d'une syllabe de mot tel que l'app le voit ; sa hauteur face à `REF`. */
export function rebatir(l: LigneVoix, registre: number): Contour {
  return { points: l.x.slice(0, 30), moyenne: REF * Math.pow(2, registre / 12), duree: 0.2 * Math.pow(2, l.x[32]), voisement: l.x[33] };
}

/**
 * Les mots de deux syllabes d'une voix. Un mot dont `voix.ts` n'a pas su couper les deux
 * syllabes est rendu sans contours (`contours` vide) : l'app l'aurait redemandé.
 */
export function motsDeVoix(doc: DocVoix): MotRebati[] {
  const par = new Map<string, LigneVoix[]>();
  const ordre: string[] = [];
  for (const l of doc.lignes) {
    if (l.n !== 2) continue;
    if (!par.has(l.id)) ordre.push(l.id);
    (par.get(l.id) ?? par.set(l.id, []).get(l.id)!).push(l);
  }
  const d = REGLAGES_MOTS.declinaison;
  return ordre.map((id) => {
    const ls = par.get(id)!.filter((l) => l.ok).sort((a, b) => a.k - b.k);
    if (ls.length !== 2) return { id, tons: [], contours: [], oracle: REF, probleme: 'court', etat: 'redemander' };
    const rc = ls.map((l, k) => l.rc - (d[k] ?? 0));
    const ro = ls.map((l, k) => l.ro - (d[k] ?? 0));
    return {
      id,
      tons: ls.map((l) => l.t),
      contours: ls.map((l, k) => rebatir(l, rc[k])),
      oracle: REF * Math.pow(2, (rc[0] - ro[0]) / 12),
      probleme: ls[0].probleme,
      etat: ls[0].e ?? null
    };
  });
}
