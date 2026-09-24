/**
 * Clarté pour un débutant : ce que l'écran attend se lit avant que quoi que ce soit ne
 * parte tout seul, et chaque état dit quoi faire. Tests de source, écran par écran.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Le corps d'une fonction du script d'un composant, jusqu'à l'accolade fermante de rang 2. */
function corps(src: string, nom: string): string {
  const debut = src.indexOf(`function ${nom}(`);
  expect(debut).toBeGreaterThan(-1);
  const fin = src.indexOf('\n  }\n', debut);
  return src.slice(debut, fin);
}

describe('les jumeaux : le flash part au tap, jamais avant la lecture de la question', () => {
  const game = source('Game.svelte');

  it("l'ouverture d'un tour ne lance aucun flash", () => {
    expect(corps(game, 'ouvrirTour')).not.toContain('FLASH_MS');
  });

  it('le flash part de « Montrer », et le temps de réponse aussi', () => {
    const montrer = corps(game, 'montrer');
    expect(montrer).toContain('FLASH_MS');
    expect(montrer).toContain('depart = Date.now()');
    expect(game).toContain('onclick={montrer}>Montrer</button>');
  });
});
