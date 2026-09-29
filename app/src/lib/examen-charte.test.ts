/**
 * L'écran de l'examen (story 8.3, maquette validée le 29 septembre 2026) : la charte, une
 * règle par test. Ni cinabre, ni ombre, ni dégradé, ni doré, ni dragon ; aucune couleur hors
 * des jetons ; pas de chronomètre ; les grands caractères depuis leurs traits ; Tao en
 * écolière, pinceau à la main, sans robe ni col, avec le panier ; les textes de l'écran viennent de `examens.json`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const FICHIERS = ['Examen.svelte', 'SupportExamen.svelte', 'examen-dessins.ts'];
/** Sans les commentaires : ils disent ce qu'on ne fait pas. */
const sansCommentaires = (s: string): string =>
  s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = FICHIERS.map((f) => sansCommentaires(source(f))).join('\n');
const ecran = source('Examen.svelte');

describe("l'écran de l'examen", () => {
  it('ni cinabre, ni ombre, ni dégradé, ni doré, ni dragon', () => {
    expect(code).not.toMatch(/--zhu|box-shadow|drop-shadow|gradient|gold|doré|dragon|龙/i);
  });

  it('aucune couleur hors des jetons de tokens.css', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^<]*<\/)/);
    expect(code).not.toMatch(/rgba?\(/);
  });

  it('pas de chronomètre : rien ne lit l’horloge ni ne décompte', () => {
    expect(code).not.toMatch(/setInterval|Date\.now|performance\.now|requestAnimationFrame/);
  });

  it('une réponse fausse à l’ocre, juste au jade', () => {
    expect(ecran).toMatch(/\.opt\.ko \{\s*border: 2px solid var\(--ocre\)/);
    expect(ecran).toMatch(/\.opt\.ok \{\s*border: 2px solid var\(--jade\)/);
  });

  it('le nom de l’examen et les manqués se dessinent depuis leurs traits', () => {
    expect(ecran).toMatch(/\{#each \[\.\.\.examen\.hz\] as c, k \(k\)\}<Glyph/);
    expect(ecran).toMatch(/\{@render mizi\(m\.c/);
  });

  it('Tao tient le pinceau d’écolière et le panier 考篮 à l’examen, un livre au 月课', () => {
    expect(ecran).toMatch(/<Tao [^>]*ecolier panier/);
    expect(ecran).toMatch(/<Tao [^>]*livre/);
    expect(source('Tao.svelte')).toContain('class="panier"');
  });

  it('Tao ne porte ni robe ni col qui l’élargissent (décision du 29 septembre)', () => {
    expect(source('Tao.svelte')).not.toContain('class="col"');
    expect(source('Tao.svelte')).not.toContain('class="robe"');
  });

  it('les textes de l’écran viennent de examens.json', () => {
    for (const cle of ['quitter', 'constat', 'recu', 'pas_encore', 'tao_attente', 'sur_la_liste', 'info_pause']) {
      expect(ecran).toContain(`'${cle}'`);
    }
  });
});
