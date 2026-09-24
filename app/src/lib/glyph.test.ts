import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { glyph, horsPolice, type StrokeData } from './glyph';
import { lireTraits, loadStrokes } from './strokes';

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
  it('hors du plan de base ou écrit en IDS, un composant se dessine même en petit', () => {
    expect(horsPolice('𠂒')).toBe(true);
    expect(horsPolice('⿰𠄌丶')).toBe(true);
    expect(horsPolice('䒑')).toBe(false);
    expect(horsPolice('人')).toBe(false);
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

describe('la marque : 文, le point 丶 en cinabre', () => {
  /* Les traits de 文 viennent de l'export versionné, comme ceux de tout grand caractère. */
  const wen = lireTraits(
    JSON.parse(readFileSync(new URL('../../public/data/0.1.0/traits/文.json', import.meta.url), 'utf8'))
  )['文'];

  it('文 est dans l’export, quatre traits, le premier est le point du haut', () => {
    expect(wen.s).toHaveLength(4);
    expect(wen.m).toHaveLength(4);
    /* Repère des données : y vers le haut. Le point est le trait le plus haut. */
    const hauts = wen.m.map((m) => Math.max(...m.map((q) => q[1])));
    expect(Math.max(...hauts)).toBe(hauts[0]);
  });
  it('rendu statique : seul le premier trait porte le cinabre', () => {
    const h = glyph('文', wen, 30, { cinabre: [0], label: 'Wenlu' });
    expect(h).toContain('aria-label="Wenlu"');
    const chemins = all(/<path d="[^"]+"( class="zhu")?\/>/g, h);
    expect(chemins).toHaveLength(4);
    expect(chemins.map((c) => c[1] !== undefined)).toEqual([true, false, false, false]);
  });
  it('rendu écrit : le pinceau et le remplissage du point seuls en cinabre, le point d’abord', () => {
    const h = glyph('文', wen, 160, { write: true, cinabre: [0] });
    expect(all(/class="br zhu"/g, h)).toHaveLength(1);
    expect(all(/class="fill zhu"/g, h)).toHaveLength(1);
    expect(h.indexOf('class="br zhu"')).toBeLessThan(h.indexOf('class="br"'));
  });
  it('sans l’option, aucun trait en cinabre : le rouge reste réservé', () => {
    expect(glyph('文', wen, 30)).not.toContain('zhu');
    expect(glyph('文', wen, 160, { write: true })).not.toContain('zhu');
  });
});
