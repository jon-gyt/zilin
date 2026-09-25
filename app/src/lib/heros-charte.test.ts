/**
 * La charte du personnage, dans les composants : tests de source, une règle par test.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/* ---------- la charte du dessin ---------- */

describe('la charte du personnage', () => {
  const dessin = source('Heros.svelte');
  const ecran = source('Personnage.svelte');
  const fangbang = source('Fangbang.svelte');
  const choix = source('ChoixHeros.svelte');

  /** Le code seul : les commentaires disent justement ce qui est interdit. */
  const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/.*$/gm, '');

  it('ni ombre, ni dégradé, ni doré, ni cinabre, ni dragon', () => {
    for (const [nom, s] of Object.entries({ dessin, ecran, fangbang, choix }).map(([n, x]) => [n, code(x)])) {
      expect(s, nom).not.toMatch(/gradient|box-shadow|drop-shadow|text-shadow/i);
      expect(s, nom).not.toMatch(/gold|doré/i);
      expect(s, nom).not.toMatch(/--zhu|#C8371F/i);
      expect(s, nom).not.toMatch(/dragon|龙/i);
    }
  });

  it('dessine les trois bêtes et les douze rangs, avec l’aura à partir du troisième', () => {
    expect(dessin).toMatch(/tu: \{/);
    expect(dessin).toMatch(/xiongmao: \{/);
    expect(dessin).toMatch(/shi: \{/);
    expect(dessin).toContain('const ETAPES');
    expect(dessin).toContain('Math.floor(n / 2)');
  });

  it("les animations s'arrêtent si l'on réduit les animations", () => {
    expect(dessin).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.tourne[^}]*animation: none;/);
  });

  it('les titres des rangs se dessinent depuis leurs traits, jamais depuis une police', () => {
    expect(ecran).toContain('<Glyph');
    expect(fangbang).toContain('<Glyph');
  });
});
