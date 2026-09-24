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

describe('apprendre, le tracé : une fois tracé, le bouton du bas ne dit plus « sans tracer »', () => {
  const learn = source('Learn.svelte');
  const trace = source('Trace.svelte');

  it('le tracé complet remonte à l\'écran, qui change le libellé et rend le bouton principal', () => {
    expect(learn).toContain('onresultat={() => (traceFait = true)}');
    expect(learn).toContain("{traceFait ? 'Suivant' : 'Continuer sans tracer'}");
    expect(learn).toContain('class:ghost={!traceFait}');
  });

  it('après le tracé, « Tracer au doigt » s\'efface : un seul bouton principal', () => {
    expect(trace).toContain('class:ghost={entier}');
  });
});

describe("aujourd'hui : le grand caractère du chemin dit ce qu'il fait là", () => {
  it('une ligne le nomme sous le caractère', () => {
    const today = source('Today.svelte');
    const bloc = today.slice(today.indexOf('<div class="today">'));
    expect(bloc.slice(0, bloc.indexOf('</div>\n'))).toContain('Le caractère du jour');
  });
});

describe('la chaîne : la limite de trois minutes ne ferme pas le tour en cours', () => {
  const echoir = corps(source('Game.svelte'), 'echoir');

  it("à l'échéance, la manche est seulement marquée ; elle se clôt au bouton suivant", () => {
    expect(echoir).toContain('echue = true');
    expect(echoir).not.toContain('clore(');
    expect(echoir).not.toContain('onfini(');
  });
});
