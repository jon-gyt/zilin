/**
 * Mesure la précision de l'écriture au doigt (`src/lib/ecriture/`) sur des tracés déformés
 * de façon réaliste, tirés des médianes d'origine de Make Me a Hanzi (pleine précision, pas
 * des gabarits arrondis), avec le code même de l'app. Hors CI :
 *
 *   cd app && npx vite-node scripts/ecriture/mesurer.ts [graphies.json] [gabarits.json] [nombre]
 *
 * Par défaut : `../data/work/ingest/graphies.json` (écrit par `wenlu ingest`), les gabarits
 * de l'export courant, et les 3 000 caractères par scénario. Tirage déterministe (graine fixe).
 *
 * Chaque tracé imite une main d'apprenant sur un pavé de 300 px : taille, place et
 * proportions libres, inclinaison, rotation, décalage de chaque trait, tremblement, points
 * irréguliers. Les scénarios ajoutent un écart à la fois — deux traits voisins dans l'ordre
 * inverse, deux traits liés d'un seul geste (avec le trajet de l'un à l'autre), un trait en
 * moins, un trait à rebours — puis tous mêlés.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lireGabarits } from '../../src/lib/ecriture/gabarits';
import { classer, preparer, REGLAGES, type Reglages } from '../../src/lib/ecriture/reconnaissance';
import { graine, main, type Ecart } from './main';

const GRAPHIES = resolve(process.argv[2] ?? '../data/work/ingest/graphies.json');
const GABARITS = resolve(process.argv[3] ?? 'public/data/0.1.0/ecriture/gabarits.json');
const NOMBRE = Number(process.argv[4] ?? 3000);
/** Pour régler : `REGLAGES='{"manque":0.1}'` remplace des réglages, `SCENARIOS=0,5` n'en joue que certains. */
const R: Reglages = { ...REGLAGES, ...(JSON.parse(process.env.REGLAGES ?? '{}') as Partial<Reglages>) };
const VOULUS = process.env.SCENARIOS?.split(',').map(Number);
const CONFUSIONS = Number(process.env.CONFUSIONS ?? 0);

/* ---------- la mesure ---------- */

type Graphie = { c: string; medians: number[][][] };
const graphies = new Map<string, number[][][]>(
  (JSON.parse(readFileSync(GRAPHIES, 'utf8')) as Graphie[]).map((g) => [g.c, g.medians])
);
const g = lireGabarits(JSON.parse(readFileSync(GABARITS, 'utf8')));

const TRANCHES: [string, number, number][] = [
  ['1–3', 1, 3],
  ['4–6', 4, 6],
  ['7–9', 7, 9],
  ['10–12', 10, 12],
  ['13–15', 13, 15],
  ['16+', 16, 99]
];

const SCENARIOS: [string, Ecart[]][] = [
  ['déformé (échelle, inclinaison, bruit)', []],
  ['+ deux traits dans l’ordre inverse', ['ordre']],
  ['+ deux traits liés', ['lies']],
  ['+ un trait en moins', ['manque']],
  ['+ un trait à rebours', ['rebours']]
];

const h0 = graine(20260929);
const tous = [...g.caracteres];
for (let i = tous.length - 1; i > 0; i--) {
  const j = Math.floor(h0() * (i + 1));
  [tous[i], tous[j]] = [tous[j], tous[i]];
}
const echantillon = tous.slice(0, NOMBRE);

function mixte(h: () => number): Ecart[] {
  const e: Ecart[] = [];
  if (h() < 0.3) e.push('ordre');
  if (h() < 0.15) e.push('lies');
  if (h() < 0.1) e.push('manque');
  if (h() < 0.05) e.push('rebours');
  return e;
}

const confusions: string[] = [];
const temps: number[] = [];
function mesurer(
  nom: string,
  ecarts: ((h: () => number) => Ecart[]) | Ecart[],
  graineScenario: number,
  debut = false
): void {
  const h = graine(graineScenario);
  const par = new Map<string, { n: number; t1: number; t5: number; t10: number }>();
  const total = { n: 0, t1: 0, t5: 0, t10: 0 };
  for (const c of echantillon) {
    const m = graphies.get(c);
    if (!m || (debut && m.length < 4)) continue;
    const e = typeof ecarts === 'function' ? ecarts(h) : ecarts;
    /* en cours de tracé : la première moitié des traits seulement */
    const traces = debut ? main(m, h, e).slice(0, Math.ceil(m.length / 2)) : main(m, h, e);
    const a = performance.now();
    const cands = classer(g, preparer(traces, R.aspect), 10, R).map((x) => x.c);
    temps.push(performance.now() - a);
    const rang = cands.indexOf(c);
    if (rang !== 0 && confusions.length < CONFUSIONS)
      confusions.push(
        `${c}(${m.length}${e.join('+') ? ' ' + e.join('+') : ''}) → ${cands.slice(0, 3).join('')} rang ${rang}`
      );
    const tranche = TRANCHES.find(([, lo, hi]) => m.length >= lo && m.length <= hi)![0];
    const s = par.get(tranche) ?? { n: 0, t1: 0, t5: 0, t10: 0 };
    for (const x of [s, total]) {
      x.n++;
      if (rang === 0) x.t1++;
      if (rang >= 0 && rang < 5) x.t5++;
      if (rang >= 0) x.t10++;
    }
    par.set(tranche, s);
  }
  if (confusions.length) console.log(confusions.splice(0).join('\n'));
  const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1).padStart(5) : '   —');
  const lignes: string[] = [];
  lignes.push(`\n## ${nom} — ${total.n} caractères`);
  lignes.push(`| traits | n | 1er | 5 premiers | 10 premiers |`);
  lignes.push(`|---|---|---|---|---|`);
  for (const [t] of TRANCHES) {
    const s = par.get(t);
    if (s) lignes.push(`| ${t} | ${s.n} | ${pc(s.t1, s.n)} | ${pc(s.t5, s.n)} | ${pc(s.t10, s.n)} |`);
  }
  lignes.push(
    `| **tous** | ${total.n} | ${pc(total.t1, total.n)} | ${pc(total.t5, total.n)} | ${pc(total.t10, total.n)} |`
  );
  console.log(lignes.join('\n'));
}

SCENARIOS.forEach(([nom, e], k) => {
  if (!VOULUS || VOULUS.includes(k)) mesurer(nom, e, 1000 + k);
});
if (!VOULUS || VOULUS.includes(SCENARIOS.length))
  mesurer('mixte (30 % ordre, 15 % liés, 10 % manque, 5 % rebours)', mixte, 2000);
if (!VOULUS || VOULUS.includes(SCENARIOS.length + 1))
  mesurer(
    'en cours de tracé : la première moitié des traits (caractères de 4 traits et plus)',
    [],
    3000,
    true
  );

/* La latence du pavé : une reconnaissance après chaque trait, du premier au dernier. */
if (!VOULUS || VOULUS.includes(SCENARIOS.length + 2)) {
  const h = graine(4000);
  const parN = new Map<number, number[]>();
  for (const c of echantillon.slice(0, 500)) {
    const traces = main(graphies.get(c)!, h, []);
    for (let k = 1; k <= traces.length; k++) {
      const a = performance.now();
      classer(g, preparer(traces.slice(0, k), R.aspect), 10, R);
      const d = performance.now() - a;
      const cle = Math.min(k, 16);
      parN.set(cle, [...(parN.get(cle) ?? []), d]);
    }
  }
  console.log('\n## Latence par mise à jour, trait après trait (500 caractères)');
  console.log('| traits tracés | mises à jour | médiane | 90 % | max |');
  console.log('|---|---|---|---|---|');
  const tout: number[] = [];
  for (const [k, l] of [...parN].sort((a, b) => a[0] - b[0])) {
    l.sort((a, b) => a - b);
    tout.push(...l);
    const f = (p: number) => l[Math.min(l.length - 1, Math.floor(p * l.length))].toFixed(1);
    console.log(`| ${k === 16 ? '16+' : k} | ${l.length} | ${f(0.5)} ms | ${f(0.9)} ms | ${f(1)} ms |`);
  }
  tout.sort((a, b) => a - b);
  const f = (p: number) => tout[Math.min(tout.length - 1, Math.floor(p * tout.length))].toFixed(1);
  console.log(
    `| **toutes** | ${tout.length} | ${f(0.5)} ms | ${f(0.9)} ms | ${f(1)} ms (99 % : ${f(0.99)} ms) |`
  );
}

temps.sort((a, b) => a - b);
const q = (p: number) => temps[Math.min(temps.length - 1, Math.floor(p * temps.length))].toFixed(1);
console.log(
  `\nTemps par reconnaissance (Node, cette machine) : médiane ${q(0.5)} ms, 90 % ${q(0.9)} ms, 99 % ${q(0.99)} ms, max ${q(1)} ms`
);
