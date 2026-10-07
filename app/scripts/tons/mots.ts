/**
 * Les entrées du modèle des mots (`src/lib/tons/profil.ts`, `entreesMot`) pour son entraînement,
 * avec le code même de l'app (`data/sources/tons/PROVENANCE.md`, « Le profil de tons du mot
 * entier »). Hors CI :
 *
 *   cd app && npx vite-node scripts/tons/mots.ts ../data/work/tons [pseudo-mots par voix] [graine]
 *
 * Écrit `<travail>/mots/entrees-mots.json` : pour chaque mot de deux syllabes, sa voix, sa
 * source, son profil de tons (celui que la voix fait : 3-3 lu 2-3, 不 et 一 par le ton dit), et
 * ses entrées dans trois conditions (sans voix connue, voix calibrée sur cinq caractères, voix
 * entière), avec ce que l'app en ferait (`court` : une syllabe trop brève ou trop peu voisée,
 * l'app redemande). Trois provenances :
 *
 * - les voix dont `voix.ts` a déjà calculé les syllabes (`voix-kokoro/`, branche
 *   `donnees/tons-voix` ; `voix-cc/`, branche `donnees/tons-cc`) : chaque syllabe garde sa
 *   forme (`x`), sa hauteur face à la voix (`rc`, `ro`, dont on retire la déclinaison des
 *   réglages des mots), sa durée et son voisement ; le contour est rebâti tel que l'app le
 *   voit, puis `entreesMot` ;
 * - les pseudo-mots des deux voix de Taïwan (OGDL 1.0) : deux syllabes isolées de la même
 *   voix, trames bout à bout, comprimées au débit d'un mot, le ton 3 non final coupé après son
 *   creux (le demi-troisième), le ton 3 final souvent aussi, le neutre bref posé à la hauteur
 *   que lui donne le ton qui précède ; puis `segmenter`, comme la voix de l'apprenant ;
 * - la moitié « dev » des mots de Yue Tan (`donnees/mesure/`), pour les réglages seulement,
 *   jamais l'entraînement ; la moitié « test » n'est pas lue ici (`mesurer.ts`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { contourDe, probabilitesSyllabe, SEUILS_JUGEMENT, type Contour, type Modele } from '../../src/lib/tons/classifieur';
import { moyenneLog, segmenter, type Trame } from '../../src/lib/tons/pitch';
import { entreesMot } from '../../src/lib/tons/profil';
import { licenceDe, motsDeVoix, REF, type DocVoix } from './rebatir';

const ICI = resolve(process.argv[2] ?? '../data/work/tons');
const N_PSEUDO = Number(process.argv[3] ?? '8000');
let g = Number(process.argv[4] ?? '1') * 7919 + 17;
const alea = (): number => (g = (g * 1103515245 + 12345) % 2147483648) / 2147483648;
const normal = (): number => Math.sqrt(-2 * Math.log(alea() + 1e-12)) * Math.cos(2 * Math.PI * alea());
const choisir = <T>(v: readonly T[]): T => v[Math.floor(alea() * v.length)];
const medLog = (v: number[]): number => {
  const s = v.map(Math.log2).sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.pow(2, s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;
const lire = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;
/** Le modèle des caractères, tel quel : ses probabilités par syllabe, réglages des mots compris (`probabilitesSyllabe`). */
const CARACTERES = lire<Modele>(resolve(process.env.MODELE_CARACTERES ?? '../data/sources/tons/modele.json'));

type Mot = {
  voix: string; source: string; licence: string; id: string; tons: number[]; jeu: string;
  court: boolean; probleme: string | null; sans: number[]; cal: number[]; ora: number[];
  /** Les probabilités des tons 1 à 5 de chaque syllabe selon le modèle des caractères, dans les trois conditions. */
  ps_sans: number[]; ps_cal: number[]; ps_ora: number[];
};
const mots: Mot[] = [];
const estCourt = (cs: readonly Contour[]): boolean => cs.some((c) => c.duree < SEUILS_JUGEMENT.dureeMin || c.voisement < SEUILS_JUGEMENT.voisementMin);

const syllabes = (cs: Contour[], ref?: number): number[] => cs.flatMap((c, k) => probabilitesSyllabe(c, k, 2, CARACTERES, ref).probas.map(r4));
function sortir(m: Omit<Mot, 'sans' | 'cal' | 'ora' | 'court' | 'ps_sans' | 'ps_cal' | 'ps_ora'>, cs: Contour[], cal: number, ora: number): void {
  mots.push({
    ...m, court: estCourt(cs),
    sans: entreesMot(cs).map(r4), cal: entreesMot(cs, cal).map(r4), ora: entreesMot(cs, ora).map(r4),
    ps_sans: syllabes(cs), ps_cal: syllabes(cs, cal), ps_ora: syllabes(cs, ora)
  });
}

// --- les voix déjà extraites par voix.ts ---------------------------------------------------
for (const [dossier, source] of [['voix-kokoro', 'kokoro'], ['voix-cc', 'cc']] as const) {
  const d = join(ICI, dossier);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((x) => x.endsWith('.json') && !x.endsWith('-mesure.json')).sort()) {
    const doc = lire<DocVoix>(join(d, f));
    const licence = source === 'kokoro' ? 'synthese' : licenceDe(doc);
    for (const m of motsDeVoix(doc)) {
      if (m.contours.length !== 2) continue;
      sortir({ voix: doc.voix, source, licence, id: m.id, tons: m.tons, jeu: doc.role, probleme: m.probleme }, m.contours, REF, m.oracle);
    }
  }
}

// --- les pseudo-mots de Taïwan -----------------------------------------------------------
const MESURE = join(ICI, 'donnees', 'mesure');
type Tr = { tr: number[][] };
const vers = (t: Tr): Trame[] => t.tr.map(([t0, f0, ap, rms, v]) => ({ t: t0, f0, aperiodicite: ap, rms, voisee: v === 1 }));
/** Une syllabe qui commence par une voix (m, n, l, r, y, w, une voyelle) : `dire.ts`, `commenceVoisee`. */
const voisee = (s: string): boolean => /^([mnlrywaoe]|v)/.test(s) && !/^(zh|ch|sh)/.test(s);
if (existsSync(join(MESURE, 'tw.json'))) {
  const tw = lire<{ id: string; locuteur: string; texte: string; tons: number[] }[]>(join(MESURE, 'tw.json'));
  const trTw = lire<Record<string, Tr>>(join(MESURE, 'trames-tw.json'));
  type Syl = { id: string; texte: string; tr: Trame[]; moyenne: number };
  const parVoix = new Map<string, Map<number, Syl[]>>();
  const moyVoix = new Map<string, number[]>();
  for (const e of tw) {
    if (!trTw[e.id]) continue;
    const tr = vers(trTw[e.id]);
    const segs = segmenter(tr, 1);
    if (segs.length !== 1 || segs[0].duree < 0.08) continue;
    const s = segs[0];
    // la syllabe : jusqu'à 12 trames avant la voix (la consonne), 3 après
    const a = Math.max(0, s.debut - 12), b = Math.min(tr.length, s.fin + 3);
    const moyenne = moyenneLog(s.f0);
    const m = parVoix.get(e.locuteur) ?? parVoix.set(e.locuteur, new Map()).get(e.locuteur)!;
    (m.get(e.tons[0]) ?? m.set(e.tons[0], []).get(e.tons[0])!).push({ id: e.id, texte: e.texte.replace(/\d$/, ''), tr: tr.slice(a, b), moyenne });
    (moyVoix.get(e.locuteur) ?? moyVoix.set(e.locuteur, []).get(e.locuteur)!).push(moyenne);
  }
  const silence = (n: number, rms: number): Trame[] => Array.from({ length: n }, () => ({ t: 0, f0: 0, aperiodicite: 1, rms: rms * (0.5 + alea()), voisee: false }));
  /** Garde une trame sur `1/u` (u < 1 : plus court), sans toucher aux hauteurs. */
  const compresser = (tr: Trame[], u: number): Trame[] => {
    const n = Math.max(3, Math.round(tr.length * u));
    return Array.from({ length: n }, (_, j) => ({ ...tr[Math.min(tr.length - 1, Math.floor(j / u))] }));
  };
  const decaler = (tr: Trame[], st: number, gain: number): Trame[] => {
    const k = Math.pow(2, st / 12);
    return tr.map((x) => ({ ...x, f0: x.voisee ? x.f0 * k : 0, rms: x.rms * gain }));
  };
  /** Le demi-troisième (21) : la remontée coupée peu après le creux. */
  const demiTroisieme = (tr: Trame[]): Trame[] => {
    const v = tr.map((x, i) => [x, i] as const).filter(([x]) => x.voisee);
    if (v.length < 6) return tr;
    const i0 = v[Math.floor(v.length * 0.3)][1];
    let im = i0;
    for (const [x, i] of v) if (x.f0 < tr[im].f0 && i >= i0) im = i;
    return tr.slice(0, Math.min(tr.length, im + 2 + Math.floor(alea() * 3)));
  };
  /** La hauteur du neutre, en demi-tons face à la voix, selon le ton qui précède (Chao : 2, 3, 4, 1). */
  const NEUTRE: Record<number, number> = { 1: -3, 2: -0.5, 3: 2, 4: -5.5 };
  const PAIRES: [number, number][] = [];
  for (const a of [1, 2, 3, 4]) for (const b of [1, 2, 3, 4, 5]) if (!(a === 3 && b === 3)) PAIRES.push([a, b]);
  for (const [loc, m] of parVoix) {
    const ref = medLog(moyVoix.get(loc)!);
    for (let n = 0; n < N_PSEUDO; n++) {
      const [t1, t2] = choisir(PAIRES);
      const s1 = choisir(m.get(t1)!), s2 = choisir(m.get(t2)!);
      let a = s1.tr, b = s2.tr;
      if (t1 === 3 && alea() < 0.75) a = demiTroisieme(a);
      if (t2 === 3 && alea() < 0.5) b = demiTroisieme(b);
      a = compresser(a, 0.5 + 0.4 * alea());
      b = compresser(b, t2 === 5 ? 0.5 + 0.4 * alea() : 0.55 + 0.45 * alea());
      const decl = t2 === 5 ? NEUTRE[t1] - 12 * Math.log2(s2.moyenne / ref) + normal() : -0.6 + 0.8 * normal();
      a = decaler(a, 0.5 * normal(), 1);
      b = decaler(b, decl, t2 === 5 ? 0.3 + 0.5 * alea() : 0.5 + 0.7 * alea());
      const plancher = Math.max(1e-5, a.reduce((s, x) => Math.max(s, x.rms), 0) * 0.003);
      const tr = [...silence(15, plancher), ...a, ...silence(Math.floor(alea() * 4), plancher), ...b, ...silence(15, plancher)];
      tr.forEach((x, i) => (x.t = 0.0125 + i * 0.01));
      const segs = segmenter(tr, 2, 0.12, {}, [voisee(s2.texte)]);
      if (segs.length !== 2) continue;
      const v = moyVoix.get(loc)!;
      const cal = medLog(Array.from({ length: 5 }, () => choisir(v)));
      const id = `${s1.id}+${s2.id}#${n}`;
      sortir({ voix: loc, source: 'taiwan', licence: 'OGDL-Taiwan-1.0', id, tons: [t1, t2], jeu: 'entrainement', probleme: null }, segs.map((s) => contourDe(s)), cal, ref);
    }
  }
}

// --- la moitié « dev » des mots de Yue Tan, pour les réglages ----------------------------
function hache(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
}
if (existsSync(join(MESURE, 'mots-yt.json'))) {
  type E = { id: string; locuteur: string; tons: number[]; source: string };
  const tr = lire<Record<string, Tr & { crete: number }>>(join(MESURE, 'trames-ytm.json'));
  const car = lire<E[]>(join(MESURE, 'car.json')).filter((e) => e.source === 'yt1');
  const trc = lire<Record<string, Tr>>(join(MESURE, 'trames-car.json'));
  const voix: number[] = [];
  for (const e of car) for (const s of segmenter(vers(trc[e.id]), 1)) if (s.f0.length) voix.push(moyenneLog(s.f0));
  const dev = lire<E[]>(join(MESURE, 'mots-yt.json')).filter((e) => e.tons[0] !== 5 && hache(e.id) % 2 === 0 && tr[e.id]);
  for (const e of dev) {
    const syl = e.id.split('/')[1].split('_').map((x) => x.replace(/\d$/, ''));
    const segs = segmenter(vers(tr[e.id]), 2, 0.12, {}, [voisee(syl[1])]);
    if (segs.length !== 2) continue;
    const cal = medLog(Array.from({ length: 5 + Math.floor(alea() * 26) }, () => choisir(voix)));
    const pb = tr[e.id].crete > 0.999 ? 'sature' : null;
    sortir({ voix: 'yt', source: 'ytm', licence: 'CC BY-SA 3.0 US', id: e.id, tons: e.tons, jeu: 'ytm-dev', probleme: pb }, segs.map((s) => contourDe(s)), cal, medLog(voix));
  }
}

mkdirSync(join(ICI, 'mots'), { recursive: true });
writeFileSync(join(ICI, 'mots', 'entrees-mots.json'), JSON.stringify(mots));
const par: Record<string, number> = {};
for (const m of mots) par[`${m.source}/${m.jeu}`] = (par[`${m.source}/${m.jeu}`] ?? 0) + 1;
console.log(par);
