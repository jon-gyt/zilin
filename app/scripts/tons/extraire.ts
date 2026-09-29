/**
 * Extrait les caractéristiques du corpus d'entraînement des tons avec le code même de l'app
 * (`src/lib/tons/pitch.ts`, `classifieur.ts`), pour que l'entraînement Python et l'inférence
 * TypeScript voient exactement les mêmes entrées. Recette des poids de « Dis-le »
 * (`data/sources/tons/PROVENANCE.md`), hors CI :
 *
 *   cd app && npx vite-node scripts/tons/extraire.ts ../data/work/tons
 *
 * Lit `<travail>/donnees/corpus.json` (écrit par `data/sources/tons/preparer.py`), écrit
 * `<travail>/donnees/caracteristiques.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { caracteristiques, contourDe, type Contour } from '../../src/lib/tons/classifieur';
import { segmenter, suivreHauteur } from '../../src/lib/tons/pitch';
import { lireWav, reechantillonner } from '../../src/lib/tons/wav';

const ICI = resolve(process.argv[2] ?? '../data/work/tons');
type Entree = { id: string; source: string; locuteur: string; role: string; fichier: string; texte: string; tons: number[] };
const corpus: Entree[] = JSON.parse(readFileSync(join(ICI, 'donnees', 'corpus.json'), 'utf8')) as Entree[];

type Ligne = {
  id: string;
  source: string;
  locuteur: string;
  role: string;
  texte: string;
  ton: number;
  pos: number;
  nsyl: number;
  contour: Contour | null;
};
const lignes: Ligne[] = [];
let tAudio = 0;
let tCalcul = 0;
for (const [k, e] of corpus.entries()) {
  const octets = readFileSync(join(ICI, e.fichier));
  const { sr, x: brut } = lireWav(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer);
  const x = reechantillonner(brut, sr, 16000);
  const a = performance.now();
  const trames = suivreHauteur(x, { sr: 16000 });
  const segs = segmenter(trames, e.tons.length);
  const contours = segs.length === e.tons.length ? segs.map((s) => contourDe(s)) : e.tons.map(() => null);
  tCalcul += performance.now() - a;
  tAudio += x.length / 16000;
  e.tons.forEach((ton, pos) =>
    lignes.push({ id: e.id, source: e.source, locuteur: e.locuteur, role: e.role, texte: e.texte, ton, pos, nsyl: e.tons.length, contour: contours[pos] })
  );
  if (k % 1000 === 0) process.stderr.write(`${k}/${corpus.length}\n`);
}

/*
 * La référence de chaque locuteur : médiane (en log) des moyennes de ses syllabes.
 * « oracle » : sur tous ses enregistrements ; « calibree » : sur cinq autres syllabes tirées
 * au hasard, comme l'app l'aurait après cinq questions (`voix.ts`).
 */
const parLoc = new Map<string, number[]>();
for (const l of lignes) {
  if (!l.contour) continue;
  const v = parLoc.get(l.locuteur) ?? [];
  v.push(Math.log2(l.contour.moyenne));
  parLoc.set(l.locuteur, v);
}
const med = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const oracle = new Map([...parLoc].map(([k, v]) => [k, Math.pow(2, med(v))]));
let graine = 12345;
const alea = (): number => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;

const sortie = lignes.map((l) => {
  if (!l.contour) return { ...l, contour: undefined, ok: false };
  const v = parLoc.get(l.locuteur) ?? [];
  const cinq = Array.from({ length: 5 }, () => v[Math.floor(alea() * v.length)]);
  return {
    id: l.id,
    source: l.source,
    locuteur: l.locuteur,
    role: l.role,
    texte: l.texte,
    ton: l.ton,
    pos: l.pos,
    nsyl: l.nsyl,
    ok: true,
    points: l.contour.points.map((p) => +p.toFixed(3)),
    moyenne: +l.contour.moyenne.toFixed(2),
    duree: l.contour.duree,
    voisement: +l.contour.voisement.toFixed(3),
    x_sans: caracteristiques(l.contour).map((p) => +p.toFixed(4)),
    x_oracle: caracteristiques(l.contour, oracle.get(l.locuteur)).map((p) => +p.toFixed(4)),
    x_calibree: caracteristiques(l.contour, Math.pow(2, med(cinq))).map((p) => +p.toFixed(4))
  };
});
writeFileSync(join(ICI, 'donnees', 'caracteristiques.json'), JSON.stringify(sortie));
const echecs = sortie.filter((s) => !s.ok).length;
console.log(`${corpus.length} fichiers, ${lignes.length} syllabes, ${echecs} sans segment voisé`);
console.log(`suivi de hauteur et découpe : ${tCalcul.toFixed(0)} ms pour ${tAudio.toFixed(1)} s d'audio`);
