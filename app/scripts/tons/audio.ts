/**
 * Mesure les fichiers audio que l'app joue (caractères et mots), ou les essais de porteurs de
 * l'étape `audio-porteurs` du workflow `donnees`, avec le code même de l'app : `suivreHauteur`,
 * `analyserTrames` et les poids versionnés (`public/data/0.1.0/tons.json`). Décision du
 * propriétaire du 3 octobre 2026, « vérifier puis corriger » (`docs/sources-licences.md`, audio).
 *
 *   cd app && npx vite-node scripts/tons/audio.ts <liste.json> <sortie.json> [modele.json]
 *
 * `<liste.json>` : `{ entrees: [{ id, groupe, texte, tons, syl?, fichier }] }`, `fichier` un WAV
 * relatif au dossier de la liste. Chaque `groupe` (les fichiers de l'app, ou un porteur) est
 * mesuré à part : sa voix est la médiane des moyennes de ses caractères (un mot prend celle des
 * caractères du même groupe, ou à défaut de tout le fichier), comme une voix calibrée.
 *
 * Pour chaque groupe et chaque ton : le ton en tête du modèle, le verdict de l'app (reconnu), le
 * contour moyen en cinq points (demi-tons autour de la syllabe), le registre (demi-tons face à la
 * voix) et, pour le ton 3, la part des syllabes qui font un vrai creux (la règle du ton 3 de
 * `regles` : descendre puis remonter d'au moins 1 demi-ton, le creux à l'intérieur). Écrit
 * `<sortie.json>` (les chiffres et le détail de chaque énoncé) et imprime un tableau Markdown.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { analyserTrames, CLASSES, mesures, N_POINTS, SEUILS_REGLES, type Modele, type Ton } from '../../src/lib/tons/classifieur';
import { suivreHauteur, type Trame } from '../../src/lib/tons/pitch';
import { lireWav, reechantillonner } from '../../src/lib/tons/wav';

type Entree = { id: string; groupe: string; texte: string; tons: number[]; syl?: string[]; fichier: string };

/** Les syllabes qui commencent par une voix (m, n, l, r, y, w, voyelle) : `voix.ts`, `liees`. */
function liees(syl: readonly string[] | undefined): boolean[] | null {
  if (!syl || syl.length < 2) return null;
  return syl.slice(1).map((x) => /^([mnlrywaoe]|v)/.test(x) && !/^(zh|ch|sh)/.test(x));
}

const med = (v: number[]): number => {
  if (!v.length) return 0;
  const s = v.map(Math.log2).sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.pow(2, s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const r2 = (v: number): number => Math.round(v * 100) / 100;
const pc = (a: number, b: number): number => (b ? Math.round((1000 * a) / b) / 10 : 0);

/** Les cinq points (0, 25, 50, 75, 100 %) d'un contour de 30 points. */
const cinq = (p: number[]): number[] => [0, 7, 15, 22, N_POINTS - 1].map((i) => p[i]);

/** Le vrai creux du ton 3 : la règle de `regles` (descente, remontée, creux intérieur). */
function creuxT3(x: number[]): { creux: boolean; profondeur: number } {
  const m = mesures(x);
  const creux = m.debut - m.min >= SEUILS_REGLES.descenteT3 && m.fin - m.min >= SEUILS_REGLES.remonteeT3 && m.posMin > 0.2 && m.posMin < 0.8;
  return { creux, profondeur: Math.min(m.debut, m.fin) - m.min };
}

function main(): void {
  const liste = resolve(process.argv[2] ?? '');
  const sortie = resolve(process.argv[3] ?? 'mesure-audio.json');
  const modele = JSON.parse(readFileSync(process.argv[4] ?? 'public/data/0.1.0/tons.json', 'utf8')) as Modele;
  const base = dirname(liste);
  const entrees = (JSON.parse(readFileSync(liste, 'utf8')) as { entrees: Entree[] }).entrees;

  type Ana = { e: Entree; tr: Trame[]; crete: number; duree: number };
  const analyses: Ana[] = [];
  for (const e of entrees) {
    let o: Buffer;
    try {
      o = readFileSync(join(base, e.fichier));
    } catch {
      continue;
    }
    const { sr, x: brut } = lireWav(o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer);
    const x = sr === 16000 ? brut : reechantillonner(brut, sr, 16000);
    let crete = 0;
    for (let i = 0; i < x.length; i++) crete = Math.max(crete, Math.abs(x[i]));
    analyses.push({ e, tr: suivreHauteur(x, { sr: 16000 }), crete, duree: x.length / 16000 });
  }

  // la voix de chaque groupe : la médiane des moyennes de ses caractères
  const moyennes = new Map<string, number[]>();
  const toutes: number[] = [];
  for (const a of analyses) {
    if (a.e.tons.length !== 1) continue;
    const s = analyserTrames(a.tr, a.crete, a.e.tons as Ton[]).syllabes;
    if (s.length === 1 && s[0].contour.moyenne > 0) {
      (moyennes.get(a.e.groupe) ?? moyennes.set(a.e.groupe, []).get(a.e.groupe)!).push(s[0].contour.moyenne);
      toutes.push(s[0].contour.moyenne);
    }
  }
  const refDe = (g: string): number => med(moyennes.get(g) ?? toutes);

  type ParTon = { n: number; tete: number; reconnu: number; points: number[]; registre: number; creux: number; profondeur: number; conf: Record<string, number> };
  type Groupe = { n: number; ok: number; syllabes: number; tete: number; reconnu: number; voix_hz: number; duree: number; parTon: Record<string, ParTon> };
  const groupes: Record<string, Groupe> = {};
  const detail: object[] = [];
  for (const a of analyses) {
    const { e } = a;
    const ref = refDe(e.groupe);
    const g = (groupes[e.groupe] ??= { n: 0, ok: 0, syllabes: 0, tete: 0, reconnu: 0, voix_hz: r2(ref), duree: 0, parTon: {} });
    g.n++;
    g.duree += a.duree;
    const ana = analyserTrames(a.tr, a.crete, e.tons as Ton[], modele, ref, liees(e.syl));
    if (ana.etat === 'juste') g.reconnu++;
    const ok = ana.syllabes.length === e.tons.length && ana.syllabes.every((s) => s.contour.moyenne > 0);
    if (ok) g.ok++;
    const tetes: number[] = [];
    e.tons.forEach((ton, k) => {
      const cle = e.tons.length > 1 ? `p${k + 1}/${ton}` : String(ton);
      const pt = (g.parTon[cle] ??= { n: 0, tete: 0, reconnu: 0, points: [0, 0, 0, 0, 0], registre: 0, creux: 0, profondeur: 0, conf: {} });
      pt.n++;
      g.syllabes++;
      const s = ok ? ana.syllabes[k] : undefined;
      if (!s) {
        pt.conf['-'] = (pt.conf['-'] ?? 0) + 1;
        tetes.push(0);
        return;
      }
      const p = s.verdict.probabilites;
      const tete = (modele.classes ?? CLASSES)[p.indexOf(Math.max(...p))];
      tetes.push(tete);
      pt.conf[String(tete)] = (pt.conf[String(tete)] ?? 0) + 1;
      if (tete === ton) { pt.tete++; g.tete++; }
      if (s.verdict.etat === 'juste') pt.reconnu++;
      cinq(s.contour.points).forEach((v, i) => (pt.points[i] += v));
      pt.registre += s.entrees[N_POINTS];
      const c = creuxT3(s.entrees);
      if (c.creux) pt.creux++;
      pt.profondeur += c.profondeur;
    });
    detail.push({
      id: e.id, groupe: e.groupe, texte: e.texte, tons: e.tons, tetes, etat: ana.etat, probleme: ana.probleme,
      duree: r2(a.duree),
      syllabes: ana.syllabes.map((s) => ({
        points: cinq(s.contour.points).map(r2), registre: r2(s.entrees[N_POINTS]), duree: r2(s.contour.duree),
        hz: r2(s.contour.moyenne), probas: s.verdict.probabilites.map(r2), creux: creuxT3(s.entrees).creux
      }))
    });
  }

  const resume: Record<string, object> = {};
  let md = '| groupe | énoncés | découpe juste | syllabe en tête | reconnu | voix (Hz) | ' +
    [1, 2, 3, 4].map((t) => `ton ${t} en tête`).join(' | ') + ' | ton 3 en creux |\n|' + '---|'.repeat(11) + '\n';
  for (const [nom, g] of Object.entries(groupes).sort()) {
    const parTon: Record<string, object> = {};
    for (const [t, p] of Object.entries(g.parTon).sort()) {
      const v = p.n - (p.conf['-'] ?? 0);
      parTon[t] = {
        n: p.n, en_tete: pc(p.tete, p.n), reconnu: pc(p.reconnu, p.n),
        contour: p.points.map((x) => r2(v ? x / v : 0)), registre: r2(v ? p.registre / v : 0),
        creux: pc(p.creux, p.n), profondeur: r2(v ? p.profondeur / v : 0), confusion: p.conf
      };
    }
    resume[nom] = {
      enonces: g.n, decoupe_juste: pc(g.ok, g.n), en_tete: pc(g.tete, g.syllabes), reconnu: pc(g.reconnu, g.n),
      voix_hz: g.voix_hz, duree_moyenne: r2(g.n ? g.duree / g.n : 0), par_ton: parTon
    };
    const t = (k: string): string => (g.parTon[k] ? `${pc(g.parTon[k].tete, g.parTon[k].n)} (${g.parTon[k].n})` : '—');
    const t3 = g.parTon['3'];
    md += `| ${nom} | ${g.n} | ${pc(g.ok, g.n)} | ${pc(g.tete, g.syllabes)} | ${pc(g.reconnu, g.n)} | ${g.voix_hz} | ` +
      ['1', '2', '3', '4'].map(t).join(' | ') + ` | ${t3 ? pc(t3.creux, t3.n) : '—'} |\n`;
  }
  writeFileSync(sortie, JSON.stringify({ format: 'wenlu-mesure-audio', code: 'app/scripts/tons/audio.ts', modele: modele.version, groupes: resume, detail }));
  console.log(md);
}

main();
