/**
 * Suit la hauteur des phrases de FLEURS avec le code de l'app (`pitch.ts`, `suivreHauteur`) et
 * garde les trames, pour l'alignement syllabe par syllabe (`data/sources/tons/aligner.py`).
 * Recette des poids de « Dis-le » (`data/sources/tons/PROVENANCE.md`), hors CI :
 *
 *   cd app && npx vite-node scripts/tons/trames.ts ../data/work/tons [part] [parts]
 *
 * Lit `<travail>/donnees/fleurs-syllabes.json` (écrit par `fleurs.py`), écrit
 * `<travail>/donnees/fleurs-trames-<part>.json` : pour chaque phrase, sa crête, sa durée et ses
 * trames `[t, f0, apériodicité, rms, voisée]`. `part` et `parts` partagent le travail entre
 * plusieurs processus (0 et 1 par défaut : tout).
 *
 * Les réglages sont plus souples que ceux de l'app (`SOUPLE`) : une phrase lue au micro d'un
 * ordinateur, avec son bruit de fond, a une voix moins périodique et plus de dynamique qu'un
 * caractère dit près du téléphone ; avec les réglages de l'app, un tiers de la parole d'une
 * phrase sur deux passe pour non voisé, et les îlots de voix ne suivent plus les syllabes. Ces
 * trames ne servent qu'à l'alignement : les caractéristiques de chaque syllabe sont calculées
 * par `extraire.ts` avec les réglages de l'app, sur l'extrait de la syllabe.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { suivreHauteur, type OptionsHauteur } from '../../src/lib/tons/pitch';
import { lireWav, reechantillonner } from '../../src/lib/tons/wav';

/** Voisée : apériodicité sous 0,5 (0,35 dans l'app), à moins de 35 dB du pic (20 dans l'app). */
export const SOUPLE: OptionsHauteur = { apMax: 0.5, dbSousMax: 35 };

const ICI = resolve(process.argv[2] ?? '../data/work/tons');
const part = Number(process.argv[3] ?? 0);
const parts = Number(process.argv[4] ?? 1);
type Entree = { id: string; fichier: string };
const entrees = (JSON.parse(readFileSync(join(ICI, 'donnees', 'fleurs-syllabes.json'), 'utf8')) as Entree[]).filter(
  (_, k) => k % parts === part
);
const out: Record<string, { crete: number; duree: number; tr: number[][] }> = {};
for (const [k, e] of entrees.entries()) {
  const o = readFileSync(join(ICI, e.fichier));
  const { sr, x: brut } = lireWav(o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer);
  const x = sr === 16000 ? brut : reechantillonner(brut, sr, 16000);
  let crete = 0;
  for (let i = 0; i < x.length; i++) crete = Math.max(crete, Math.abs(x[i]));
  out[e.id] = {
    crete,
    duree: x.length / 16000,
    tr: suivreHauteur(x, { ...SOUPLE, sr: 16000 }).map((t) => [+t.t.toFixed(3), +t.f0.toFixed(2), +t.aperiodicite.toFixed(4), +t.rms.toExponential(4), t.voisee ? 1 : 0])
  };
  if (k % 250 === 0) process.stderr.write(`${k}/${entrees.length}\n`);
}
writeFileSync(join(ICI, 'donnees', `fleurs-trames-${part}.json`), JSON.stringify(out));
console.log(`${entrees.length} phrases`);
