/**
 * Une mauvaise réponse se montre à l'ocre, jamais au cinabre : le cinabre marque
 * l'élément ajouté et la position sur le chemin, rien d'autre (décision du
 * propriétaire du 28 septembre 2026, « Ocre pour l'erreur »).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Les règles CSS dont le sélecteur porte la classe `.ko` (la mauvaise réponse). */
function reglesKo(css: string): string[] {
  return [...css.matchAll(/([^{}]*\.ko[^{}]*)\{([^}]*)\}/g)].map((m) => `${m[1].trim()}{${m[2]}}`);
}

describe("l'erreur à l'ocre", () => {
  it('les tokens ont des règles de mauvaise réponse', () => {
    expect(reglesKo(source('./tokens.css')).length).toBeGreaterThan(0);
  });

  it('aucune règle de mauvaise réponse ne prend le cinabre', () => {
    for (const r of reglesKo(source('./tokens.css'))) expect(r, r).not.toMatch(/--zhu/);
  });

  it("les règles de mauvaise réponse prennent l'ocre", () => {
    for (const r of reglesKo(source('./tokens.css'))) expect(r, r).toMatch(/--ocre/);
  });
});
