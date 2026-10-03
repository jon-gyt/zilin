/**
 * Les caractéristiques des voix synthétiques du continent (Kokoro), avec le code même de l'app,
 * pour l'entraînement du classifieur des tons de « Dis-le » (`data/sources/tons/PROVENANCE.md`,
 * « Les voix synthétiques du continent »). Tourne dans le workflow `donnees`, étape `tons-voix`,
 * après `data/sources/tons/kokoro.py generer` :
 *
 *   cd app && npx vite-node scripts/tons/voix.ts ../data/work/tons/voix zf_002 [zm_009 …]
 *
 * Lit `<travail>/<voix>/corpus.json` et ses WAV, écrit
 * `data/sources/tons/voix-kokoro/<voix>.json` (aucun son) : pour chaque syllabe, les entrées du
 * modèle telles que l'app les calcule (`analyserTrames` : `suivreHauteur`, `segmenter` avec les
 * frontières liées d'un mot, `probabilitesSyllabe` avec les réglages des mots), sans référence
 * de voix (`x`), puis le registre face à une référence calibrée sur cinq caractères de la voix
 * tirés au hasard (`rc`) et face à la voix entière (`ro`) : les trois conditions de
 * `extraire.ts`. Pour la voix de l'app (`zf_001`, le test), les trames aussi
 * (`<voix>-mesure.json`), que `mesurer.ts` juge comme un enregistrement.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyserTrames, type Ton } from '../../src/lib/tons/classifieur';
import { suivreHauteur } from '../../src/lib/tons/pitch';
import { lireWav, reechantillonner } from '../../src/lib/tons/wav';

const ICI = resolve(process.argv[2] ?? '../data/work/tons/voix');
const VOIX = process.argv.slice(3);
const SORTIE = resolve('../data/sources/tons/voix-kokoro');
/** La voix de l'app : ses trames sont gardées pour `mesurer.ts`. */
const VOIX_TEST = 'zf_001';

type Entree = { id: string; genre: 'c' | 'm'; texte: string; syl: string[]; tons: number[]; vitesse: number; fin: string; ps: string; fichier: string };
type Corpus = { voix: string; modele: string; revision: string | null; textes: string; role: string; entrees: Entree[] };

/** Les syllabes qui commencent par une voix (m, n, l, r, y, w, voyelle) : `mesurer.ts`, `lieesDe`. */
export function liees(syl: readonly string[]): boolean[] {
  return syl.slice(1).map((x) => /^([mnlrywaoe]|v)/.test(x) && !/^(zh|ch|sh)/.test(x));
}

const med = (v: number[]): number => {
  const s = v.map(Math.log2).sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.pow(2, s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

mkdirSync(SORTIE, { recursive: true });
for (const voix of VOIX) {
  const corpus = JSON.parse(readFileSync(join(ICI, voix, 'corpus.json'), 'utf8')) as Corpus;
  type Ana = { e: Entree; tr: ReturnType<typeof suivreHauteur>; crete: number; duree: number };
  const analyses: Ana[] = corpus.entrees.map((e) => {
    const o = readFileSync(join(ICI, voix, e.fichier));
    const { sr, x: brut } = lireWav(o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer);
    const x = reechantillonner(brut, sr, 16000);
    let crete = 0;
    for (let i = 0; i < x.length; i++) crete = Math.max(crete, Math.abs(x[i]));
    return { e, tr: suivreHauteur(x, { sr: 16000 }), crete, duree: x.length / 16000 };
  });
  const lieesDe = (e: Entree): boolean[] | null => (e.tons.length > 1 ? liees(e.syl) : null);
  // la voix : les moyennes de ses caractères isolés, comme l'app la calibre (`voix.ts`)
  const moyennes: number[] = [];
  for (const a of analyses) {
    if (a.e.tons.length !== 1) continue;
    const s = analyserTrames(a.tr, a.crete, a.e.tons as Ton[]).syllabes;
    if (s.length === 1 && s[0].contour.moyenne > 0) moyennes.push(s[0].contour.moyenne);
  }
  const oracle = med(moyennes);
  let g = 12345;
  const alea = (): number => (g = (g * 1103515245 + 12345) % 2147483648) / 2147483648;
  const lignes: object[] = [];
  let echecs = 0;
  for (const a of analyses) {
    const { e } = a;
    const ref = med(Array.from({ length: 5 }, () => moyennes[Math.floor(alea() * moyennes.length)]));
    const sans = analyserTrames(a.tr, a.crete, e.tons as Ton[], undefined, undefined, lieesDe(e));
    if (sans.syllabes.length !== e.tons.length || !sans.syllabes.every((s) => s.contour.moyenne > 0)) {
      echecs++;
      lignes.push({ id: e.id, g: e.genre, n: e.tons.length, ok: false });
      continue;
    }
    const cal = analyserTrames(a.tr, a.crete, e.tons as Ton[], undefined, ref, lieesDe(e));
    const ora = analyserTrames(a.tr, a.crete, e.tons as Ton[], undefined, oracle, lieesDe(e));
    sans.syllabes.forEach((s, k) =>
      lignes.push({
        id: e.id, g: e.genre, k, n: e.tons.length, t: e.tons[k], v: e.vitesse, f: e.fin, ok: true,
        x: s.entrees.map(r3), rc: r3(cal.syllabes[k].entrees[30]), ro: r3(ora.syllabes[k].entrees[30]),
        probleme: sans.probleme
      })
    );
  }
  const doc = {
    format: 'wenlu-tons-voix', voix, role: corpus.role, modele: corpus.modele, revision: corpus.revision,
    textes: corpus.textes, code: 'app/scripts/tons/voix.ts (analyserTrames, réglages de l’app)',
    voix_hz: r3(oracle), enonces: corpus.entrees.length, echecs, lignes
  };
  writeFileSync(join(SORTIE, `${voix}.json`), JSON.stringify(doc));
  if (voix === VOIX_TEST) {
    const trames: Record<string, { crete: number; duree: number; tr: number[][] }> = {};
    const enonces = analyses.map((a) => {
      trames[a.e.id] = {
        crete: +a.crete.toFixed(4), duree: +a.duree.toFixed(3),
        tr: a.tr.map((t) => [+t.t.toFixed(3), +t.f0.toFixed(2), +t.aperiodicite.toFixed(4), +t.rms.toExponential(4), t.voisee ? 1 : 0])
      };
      return { id: a.e.id, source: a.e.genre === 'c' ? 'kz1' : 'kz2', locuteur: `kokoro-${voix}`, tons: a.e.tons, syl: a.e.syl.map((s) => s.replace(/\d$/, '')) };
    });
    writeFileSync(join(SORTIE, `${voix}-mesure.json`), JSON.stringify({ enonces, trames }));
  }
  console.log(`${voix} : ${corpus.entrees.length} énoncés, ${lignes.length} lignes, ${echecs} sans découpe juste, voix ${oracle.toFixed(1)} Hz`);
}
