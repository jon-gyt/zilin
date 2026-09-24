/**
 * Le décor du cercle de Ma forêt, le jour d'une fête ou d'un terme solaire : tests de
 * source et de règle, une règle par test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FETES, loadFetes, loadSaisons, type Fetes, type Saisons } from './content';
import { journee } from './saisons';
import { decorDuCercle } from './trouves';

const lire = (f: string): string => readFileSync(new URL(`../../public/data/0.1.0/${f}`, import.meta.url), 'utf8');
const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

function repondre(corps: string): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => JSON.parse(corps) })) as unknown as typeof fetch;
}

const fetes: Fetes = await loadFetes('data/0.1.0/fetes.json', repondre(lire('fetes.json')));
const saisons: Saisons = await loadSaisons('data/0.1.0/saisons.json', repondre(lire('saisons.json')));

describe('le décor du cercle de Ma forêt', () => {
  const decor = source('CercleDecor.svelte');

  it('la fête a priorité sur le terme ; hors fête, l’ambiance du terme ; sinon, aucun décor', () => {
    expect(decorDuCercle(journee(fetes, saisons, '2026-09-25').theme)).toEqual({ fete: 'zhongqiu' });
    expect(decorDuCercle(journee(fetes, saisons, '2026-10-10').theme)).toEqual({ saison: 'feuilles' });
    expect(decorDuCercle({ fete: null, saison: null })).toBeNull();
  });

  it('chaque fête et chaque ambiance a son décor', () => {
    for (const id of FETES) expect(decor, id).toContain(`fete === '${id}'`);
    for (const a of saisons.ambiances) expect(decor, a).toContain(`saison === '${a}'`);
  });

  it("derrière le cercle, jamais touché, et il disparaît si l'on réduit les animations", () => {
    expect(decor).toContain('pointer-events: none');
    expect(decor).toContain('aria-hidden="true"');
    expect(decor).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.cercle-decor \{ display: none; \}/);
    expect(source('Forest.svelte')).toMatch(/<CercleDecor \{decor\} \/>\s*\{#if cercle\}/);
  });

  it('ni ombre, ni dégradé, ni doré, ni dragon, ni cinabre', () => {
    expect(decor).not.toMatch(/gradient|box-shadow|drop-shadow|filter/i);
    expect(decor).not.toMatch(/gold|dor[ée]\b|dragon|龙/i);
    expect(decor).not.toMatch(/--zhu|#c8371f/i);
  });

  it('le cramoisi de fête ne sert qu’au Nouvel An et à 元宵', () => {
    const branches = decor.split(/\{:else if |\{#if /).slice(1);
    for (const b of branches) {
      if (b.startsWith("fete === 'chunjie'") || b.startsWith("fete === 'yuanxiao'")) continue;
      expect(b).not.toContain('var(--fete)');
    }
  });
});
