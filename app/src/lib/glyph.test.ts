import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { glyph, type StrokeData } from './glyph';
import { loadStrokes } from './strokes';

const demo = JSON.parse(readFileSync(new URL('../../public/strokes-demo.json', import.meta.url), 'utf8')) as Record<string, StrokeData>;
const zhu = demo['住'];
const all = (re: RegExp, s: string) => [...s.matchAll(re)];

describe('rendu depuis les traits', () => {
  it('住 existe dans strokes-demo.json avec une médiane par trait', () => {
    expect(zhu.s).toHaveLength(7);
    expect(zhu.m).toHaveLength(7);
  });
  it('un grand caractère est un SVG, un chemin par trait, jamais une police', () => {
    const h = glyph('住', zhu, 120);
    expect(h.startsWith('<svg')).toBe(true);
    expect(h).toContain('aria-label="住"');
    expect(all(/<path d="M /g, h)).toHaveLength(14); // 7 clipPaths + 7 remplissages
    expect(h).not.toContain('class="hz"');
  });
  it('sans données de traits, repli sur la police avec le caractère en clair', () => {
    const h = glyph('龘', undefined, 120);
    expect(h).toContain('class="hz"');
    expect(h).toContain('龘');
    expect(h).not.toContain('<svg');
  });
  it('sous 84 px, rendu statique sans animation', () => {
    const h = glyph('住', zhu, 48);
    expect(h).toContain('class="g"');
    expect(h).not.toContain('write');
    expect(h).not.toContain('<polyline');
    expect(all(/<path /g, h)).toHaveLength(7);
  });
  it("l'option write force ou retire l'animation", () => {
    expect(glyph('住', zhu, 48, { write: true })).toContain('class="g write"');
    expect(glyph('住', zhu, 160, { write: false })).toContain('class="g"');
  });
  it("l'option color est appliquée au SVG", () => {
    expect(glyph('住', zhu, 48, { color: 'var(--zhu)' })).toContain('style="color:var(--zhu)"');
  });
});

describe('animation pinceau', () => {
  const h = glyph('住', zhu, 120);
  const brushes = all(/<polyline points="([^"]+)"[^>]*style="stroke-dasharray:(\d+);stroke-dashoffset:(\d+);animation-duration:([\d.]+)s;animation-delay:([\d.]+)s"/g, h);
  const fills = all(/class="fill" style="animation-delay:([\d.]+)s"/g, h);

  it('une ligne médiane découpée par son trait, pour chacun des 7 traits', () => {
    expect(brushes).toHaveLength(7);
    expect(all(/<clipPath id="k\d+_\d+">/g, h)).toHaveLength(7);
    brushes.forEach((b, i) => expect(h).toContain(`clip-path="url(#k${h.match(/k(\d+)_0/)![1]}_${i})"`));
  });
  it('la médiane suit les points des données', () => {
    expect(brushes[0][1]).toBe(zhu.m[0].map((q) => q.join(',')).join(' '));
  });
  it('le tiret couvre toute la longueur de la médiane, décalé au départ', () => {
    brushes.forEach((b) => expect(b[2]).toBe(b[3]));
  });
  it('la durée suit la longueur (L / 3600 s), avec un plancher de 0,08 s', () => {
    brushes.forEach((b) => expect(+b[4]).toBeCloseTo(Math.max(0.08, +b[2] / 3600), 2));
    const court: StrokeData = { s: ['M 0 0 L 10 0 L 10 10 Z'], m: [[[0, 0], [10, 0]]] };
    expect(glyph('丶', court, 120)).toContain('animation-duration:0.08s');
  });
  it('les traits se suivent dans l’ordre, chacun après le précédent', () => {
    for (let i = 1; i < brushes.length; i++) {
      const prevEnd = +brushes[i - 1][5] + +brushes[i - 1][4];
      expect(+brushes[i][5]).toBeGreaterThan(prevEnd);
    }
  });
  it('le remplissage d’un trait apparaît quand son pinceau a fini', () => {
    expect(fills).toHaveLength(7);
    fills.forEach((f, i) => expect(+f[1]).toBeCloseTo(+brushes[i][5] + +brushes[i][4], 1)); // arrondis séparés au centième
  });
  it('deux rendus ont des identifiants de découpe distincts', () => {
    const a = glyph('住', zhu, 120).match(/k(\d+)_0/)![1];
    const b = glyph('住', zhu, 120).match(/k(\d+)_0/)![1];
    expect(a).not.toBe(b);
  });
});

describe('chargement des traits', () => {
  it('lit le JSON servi avec l’app', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => { calls.push(url); return { ok: true, json: async () => demo }; }) as unknown as typeof fetch;
    const s = await loadStrokes('strokes-demo.json', fake);
    expect(calls).toEqual([`${import.meta.env.BASE_URL}strokes-demo.json`]);
    expect(s['住'].s).toHaveLength(7);
  });
  it('échoue clairement si le fichier manque', async () => {
    const fake = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    await expect(loadStrokes('absent.json', fake)).rejects.toThrow('absent.json');
  });
});
