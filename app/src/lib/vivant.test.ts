/**
 * Les petits détails qui rendent l'app vivante (demande du propriétaire du 29 septembre 2026,
 * « un petit coup de beauté »). Un test par détail : la classe d'animation est posée, et elle
 * s'arrête si l'on réduit les animations (`prefers-reduced-motion`). Aucun ne prend la
 * couleur du cinabre, aucun n'a d'ombre ni de dégradé.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (f: string): string => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');

/** Le contenu de tous les blocs `@media (prefers-reduced-motion: reduce)` d'une feuille. */
function reduits(css: string): string {
  const out: string[] = [];
  const re = /@media \(prefers-reduced-motion: ?reduce\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    let niveau = 1;
    let k = m.index + m[0].length;
    const debut = k;
    while (k < css.length && niveau > 0) {
      if (css[k] === '{') niveau++;
      else if (css[k] === '}') niveau--;
      k++;
    }
    out.push(css.slice(debut, k - 1));
  }
  return out.join('\n');
}

/** Le bloc de règles d'un sélecteur exact, hors des blocs `@media`. */
function regle(css: string, selecteur: string): string {
  const i = css.indexOf(`${selecteur}{`) >= 0 ? css.indexOf(`${selecteur}{`) : css.indexOf(`${selecteur} {`);
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i) + 1);
}

const tokens = source('tokens.css');

describe('Tao, vivante au repos', () => {
  it('cligne à intervalles irréguliers : un battement, deux de suite, puis un long moment', () => {
    expect(regle(tokens, '.tao .yeux')).toMatch(/animation:cligne 7\.7s infinite/);
    const k = tokens.match(/@keyframes cligne\{([^@]*?)\}\}/)?.[1] ?? '';
    /* trois battements par cycle, à des écarts inégaux */
    expect(k.match(/scaleY\(\.1\)/g)?.length ?? 0).toBe(1);
    expect(k).toContain('29.7%,61.5%,66%{transform:scaleY(.1)');
  });

  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(tokens)).toMatch(/\.tao \*\{animation:none!important\}/);
  });
});
