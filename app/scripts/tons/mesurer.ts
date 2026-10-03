/**
 * Mesure la reconnaissance des tons de « Dis-le » avec le code même de l'app
 * (`classifieur.ts`, `analyserTrames`), sur des voix jamais vues à l'entraînement. Recette des
 * poids (`data/sources/tons/PROVENANCE.md`), hors CI :
 *
 *   cd app && npx vite-node scripts/tons/mesurer.ts ../data/work/tons [modele.json] [etiquette]
 *
 * Le modèle par défaut : `public/data/0.1.0/tons.json`. Les jeux, tous tenus à part :
 *
 * - `cw` : les syllabes isolées de Chen Wang (développement), `yt1` : les caractères de Yue Tan
 *   (test), `kk1`, `kk2` : la voix Kokoro de l'app ; trames dans `donnees/mesure/car.json` et
 *   `trames-car.json` ;
 * - `kz1`, `kz2` : la même voix (`zf_001`), caractères isolés et mots HSK dits en phonèmes par
 *   l'étape `tons-voix` (`voix.ts`), si `donnees/mesure/zf_001-mesure.json` est là ;
 * - `ytm-dev`, `ytm-test` : les mots de deux syllabes de Yue Tan, coupés en deux moitiés par le
 *   hachage FNV-1a du nom (`donnees/mesure/mots-yt.json`, `trames-ytm.json`) ;
 * - `fleurs-dev`, `fleurs-test` : les syllabes sûres des phrases de FLEURS dont les locuteurs ne
 *   sont pas ceux de l'entraînement (`corpus.json`, `aligner.py`), chacune jugée seule, comme un
 *   caractère ; `fleursm-dev`, `fleursm-test` : leurs paires de syllabes qui forment un mot de
 *   deux caractères de la liste HSK, jugées comme un mot.
 *
 * La voix est calibrée comme dans l'app, sur 5 à 30 de ses syllabes tirées au hasard. Pour
 * chaque énoncé : le ton de chaque syllabe en tête, le verdict (reconnu, autre ton affirmé à
 * tort, on redemande), et le verdict quand l'app attend un autre ton sur une syllabe tirée au
 * hasard (« reconnu à tort »). Écrit `<travail>/mesures/resultats-<etiquette>.md` et `.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyserTrames, CLASSES, type Modele, type Ton } from '../../src/lib/tons/classifieur';
import { moyenneLog, segmenter, suivreHauteur, type Trame } from '../../src/lib/tons/pitch';
import { extrait, lireSignal } from './extrait';

const ICI = resolve(process.argv[2] ?? '../data/work/tons');
const fichierModele = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : 'public/data/0.1.0/tons.json';
const etiquette = process.argv[4] ?? 'base';
const modele = JSON.parse(readFileSync(fichierModele, 'utf8')) as Modele;
const MESURE = join(ICI, 'donnees', 'mesure');
const lire = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;

type Tr = { crete: number; duree: number; tr: number[][] };
type Enonce = { id: string; source: string; locuteur: string; tons: number[]; syl?: string[]; jeu?: string; plage?: number[]; phrase?: string };
const trames: Record<string, Tr> = { ...lire<Record<string, Tr>>(join(MESURE, 'trames-ytm.json')), ...lire<Record<string, Tr>>(join(MESURE, 'trames-car.json')) };
const enonces: Enonce[] = [
  ...lire<Enonce[]>(join(MESURE, 'mots-yt.json')).filter((e) => e.tons[0] !== 5),
  ...lire<Enonce[]>(join(MESURE, 'car.json'))
];
/** La voix de l'app dite par l'étape `tons-voix` (`voix.ts`) : `kz1` ses caractères, `kz2` ses mots. */
const KOKORO = join(MESURE, 'zf_001-mesure.json');
if (existsSync(KOKORO)) {
  const k = lire<{ enonces: Enonce[]; trames: Record<string, Tr> }>(KOKORO);
  Object.assign(trames, k.trames);
  enonces.push(...k.enonces);
}

/** Les syllabes et les mots de FLEURS tenus à part, et la voix de chaque phrase. */
const voixFleurs = new Map<string, number[]>();
const fichiersFleurs = new Map<string, string>();
type EntreeFleurs = {
  id: string; source: string; partie: string; fichier: string; tons: number[]; plages: number[][]; moyennes: number[];
  mots: { texte: string; a: number; b: number; tons: number[]; syl: (string | null)[] }[];
};
const fleurs = existsSync(join(ICI, 'donnees', 'corpus.json'))
  ? lire<EntreeFleurs[]>(join(ICI, 'donnees', 'corpus.json')).filter((e) => e.source === 'fleurs' && e.partie !== 'train')
  : [];
for (const e of fleurs) {
  voixFleurs.set(e.id, e.moyennes);
  fichiersFleurs.set(e.id, join(ICI, e.fichier));
  e.plages.forEach((p, k) => enonces.push({ id: `${e.id}#${k}`, source: 'fleurs', locuteur: e.id, tons: [e.tons[k]], jeu: `fleurs-${e.partie}`, plage: p, phrase: e.id }));
  e.mots.forEach((m, k) =>
    enonces.push({ id: `${e.id}@${k}`, source: 'fleurs', locuteur: e.id, tons: m.tons, syl: m.syl.map((s) => s ?? ''), jeu: `fleursm-${e.partie}`, plage: [m.a, m.b], phrase: e.id })
  );
}

function hache(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
}
const jeuDe = (e: Enonce): string => e.jeu ?? (e.source === 'ytm' ? (hache(e.id) % 2 === 0 ? 'ytm-dev' : 'ytm-test') : e.source);
const vers = (tr: number[][]): Trame[] => tr.map(([t, f0, aperiodicite, rms, v]) => ({ t, f0, aperiodicite, rms, voisee: v === 1 }));

/** Le signal de la dernière phrase lue (les énoncés d'une phrase se suivent). */
let phraseLue: { id: string; x: Float32Array } | null = null;
const extraits = new Map<string, { tr: Trame[]; crete: number }>();

/** Les trames d'un énoncé : un enregistrement entier, ou l'extrait d'une phrase, suivi comme
 * l'enregistrement d'un caractère (réglages de l'app). */
function tramesDe(e: Enonce): { tr: Trame[]; crete: number } | null {
  if (e.phrase && e.plage) {
    const deja = extraits.get(e.id);
    if (deja) return deja;
    const f = fichiersFleurs.get(e.phrase);
    if (!f || !existsSync(f)) return null;
    if (phraseLue?.id !== e.phrase) phraseLue = { id: e.phrase, x: lireSignal(f) };
    const x = extrait(phraseLue.x, e.plage[0], e.plage[1]);
    let crete = 0;
    for (let i = 0; i < x.length; i++) crete = Math.max(crete, Math.abs(x[i]));
    const r = { tr: suivreHauteur(x, { sr: 16000 }), crete };
    extraits.set(e.id, r);
    return r;
  }
  const t = trames[e.id];
  return t ? { tr: vers(t.tr), crete: t.crete } : null;
}

/** Les moyennes des syllabes de chaque locuteur, pour la référence calibrée. */
const moyennes = new Map<string, number[]>();
for (const e of enonces) {
  if (e.phrase) continue;
  const t = tramesDe(e);
  if (!t) continue;
  const cle = `${e.locuteur}/${e.tons.length === 1 ? 1 : 'n'}`;
  for (const s of segmenter(t.tr, e.tons.length)) if (s.f0.length) (moyennes.get(cle) ?? moyennes.set(cle, []).get(cle)!).push(moyenneLog(s.f0));
}
let g = 12345;
const alea = (): number => (g = (g * 1103515245 + 12345) % 2147483648) / 2147483648;
const med = (v: number[]): number => {
  const s = v.map(Math.log2).sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.pow(2, s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
function refPour(e: Enonce): number {
  const v = voixFleurs.get(e.locuteur) ?? moyennes.get(`${e.locuteur}/1`) ?? moyennes.get(`${e.locuteur}/n`) ?? [];
  const n = 5 + Math.floor(alea() * 26);
  return med(Array.from({ length: n }, () => v[Math.floor(alea() * v.length)]));
}

/** Les syllabes qui commencent par une voix (m, n, l, r, y, w, voyelle) : pas de silence avant elles. */
function lieesDe(e: Enonce): boolean[] | null {
  const s = e.syl ?? (e.source === 'ytm' ? e.id.split('/')[1].split('_').map((x) => x.replace(/\d$/, '')) : undefined);
  if (!s || s.some((x) => x === '')) return null;
  return s.slice(1).map((x) => /^([mnlrywaoe]|v)/.test(x) && !/^(zh|ch|sh)/.test(x));
}

function analyser(e: Enonce, attendus: number[], ref: number): { tetes: number[]; etat: string } {
  const t = tramesDe(e)!;
  const a = analyserTrames(t.tr, t.crete, attendus as Ton[], modele, ref, lieesDe(e));
  const tetes = a.syllabes.map((s) => {
    const p = s.verdict.probabilites;
    return CLASSES[p.indexOf(Math.max(...p))];
  });
  return { tetes, etat: a.etat };
}

type Compte = {
  n: number; sylN: number; sylBons: number; motBons: number; reconnu: number; autre: number; redemande: number;
  fauxN: number; fauxReconnu: number; parTon: Record<string, [number, number]>; conf: Record<string, number>;
};
const nouveau = (): Compte => ({ n: 0, sylN: 0, sylBons: 0, motBons: 0, reconnu: 0, autre: 0, redemande: 0, fauxN: 0, fauxReconnu: 0, parTon: {}, conf: {} });
const res: Record<string, Compte> = {};

for (const e of enonces) {
  if (!tramesDe(e)) continue;
  const c = (res[jeuDe(e)] ??= nouveau());
  const ref = refPour(e);
  const a = analyser(e, e.tons, ref);
  c.n++;
  let tous = a.tetes.length === e.tons.length;
  e.tons.forEach((ton, k) => {
    const h = a.tetes[k];
    c.sylN++;
    const cle = `${e.tons.length > 1 ? `p${k + 1}/` : ''}${ton}`;
    const pt = (c.parTon[cle] ??= [0, 0]);
    pt[1]++;
    if (h === ton) { c.sylBons++; pt[0]++; } else tous = false;
    c.conf[`${cle}>${h ?? '-'}`] = (c.conf[`${cle}>${h ?? '-'}`] ?? 0) + 1;
  });
  if (tous) c.motBons++;
  if (a.etat === 'juste') c.reconnu++;
  else if (a.etat === 'autre') c.autre++;
  else c.redemande++;
  // un autre ton annoncé sur une syllabe tirée au hasard : « reconnu » à tort ?
  const k = Math.floor(alea() * e.tons.length);
  const choix = [1, 2, 3, 4, 5].filter((x) => x !== e.tons[k] && !(e.tons.length === 1 && x === 5));
  const faux = [...e.tons];
  faux[k] = choix[Math.floor(alea() * choix.length)];
  c.fauxN++;
  if (analyser(e, faux, ref).etat === 'juste') c.fauxReconnu++;
}

const pc = (a: number, b: number): string => (b ? ((100 * a) / b).toFixed(1) : '—');
let md = `### ${etiquette}\n\n| jeu | n | syllabe en tête | énoncé entier en tête | reconnu | autre à tort | redemande | reconnu à tort (autre ton annoncé) |\n|---|---|---|---|---|---|---|---|\n`;
for (const [k, c] of Object.entries(res).sort()) {
  md += `| ${k} | ${c.n} | ${pc(c.sylBons, c.sylN)} | ${pc(c.motBons, c.n)} | ${pc(c.reconnu, c.n)} | ${pc(c.autre, c.n)} | ${pc(c.redemande, c.n)} | ${pc(c.fauxReconnu, c.fauxN)} |\n`;
}
md += '\nPar ton (en tête) :\n\n';
for (const [k, c] of Object.entries(res).sort()) {
  md += `- ${k} : ` + Object.entries(c.parTon).sort().map(([t, [b, n]]) => `${t} ${pc(b, n)} (${n})`).join(', ') + '\n';
}
console.log(md);
mkdirSync(join(ICI, 'mesures'), { recursive: true });
writeFileSync(join(ICI, 'mesures', `resultats-${etiquette}.json`), JSON.stringify(res, null, 1));
writeFileSync(join(ICI, 'mesures', `resultats-${etiquette}.md`), md);
