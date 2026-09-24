/**
 * Le menu et le parcours, vus dans le code des écrans : pas de barre d'onglets, une
 * seule porte par activité, les pas qui s'enchaînent, une seule fin. Tests de source,
 * comme `clarte.test.ts` ; la logique elle-même est testée dans `parcours.test.ts`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('le menu et le parcours, dans les écrans', () => {
  it("l'app enchaîne à la fin de chaque pas, et ne va au menu qu'après Clore", () => {
    const app = source('../App.svelte');
    for (const f of ['echaufferFini', 'apprendreSuivant', 'utiliserSuivant', 'fixerFini']) {
      const debut = app.indexOf(`function ${f}(`);
      const corps = app.slice(debut, app.indexOf('\n  }\n', debut));
      expect(corps, f).toContain('enchainer(');
      expect(corps, f).not.toContain('allerAuMenu(');
    }
    const clore = app.slice(app.indexOf('function clore('));
    expect(clore.slice(0, clore.indexOf('\n  }\n'))).toContain('allerAuMenu()');
  });

  it("chaque pas porte « Quitter » et la barre de la session, qui renvoient au menu", () => {
    const tete = source('EnTetePas.svelte');
    expect(tete).toContain('✕ Quitter');
    expect(tete).toContain('<Pinceaux');
    for (const f of ['Warm.svelte', 'Learn.svelte', 'Use.svelte', 'Fix.svelte', 'Close.svelte']) {
      expect(source(f), f).toContain('<EnTetePas');
    }
    const app = source('../App.svelte');
    const quitter = app.slice(app.indexOf('function quitter('));
    expect(quitter.slice(0, quitter.indexOf('\n  }\n'))).toContain('allerAuMenu()');
  });

  it("Clore montre le constat, la graine et la semaine ; l'écran de série n'existe plus", () => {
    expect(existsSync(new URL('Streak.svelte', import.meta.url))).toBe(false);
    const close = source('Close.svelte');
    expect(close).toContain('class="seed"');
    expect(close).toContain('s.semaine');
    expect(close).toContain('constat(p, p.day)');
    const app = source('../App.svelte');
    expect(app).not.toContain('Streak');
    expect(app).not.toContain("'streak'");
  });

  it("« Recommencer une session » a disparu : l'app ne remet plus la journée à zéro au tap", () => {
    const app = source('../App.svelte');
    expect(app).not.toContain('resetDay');
    expect(source('session.ts')).not.toContain('Recommencer une session');
  });

  it("n'a pas de barre d'onglets : Réglages par l'icône, Ma forêt par sa case", () => {
    expect(existsSync(new URL('Tabs.svelte', import.meta.url))).toBe(false);
    expect(existsSync(new URL('Today.svelte', import.meta.url))).toBe(false);
    const app = source('../App.svelte');
    expect(app).not.toMatch(/Tabs|onglet/);
    const m = source('Menu.svelte');
    expect(m).not.toContain('class="tabs"');
    expect(m).toContain('aria-label="Réglages"');
    expect(m).toMatch(/\{ id: 'foret', c: '林', t: 'Ma forêt' \}/);
  });

  it('les jeux n’ont qu’une porte, la case Jouer', () => {
    expect(source('Forest.svelte')).not.toContain('onjouer');
    expect(source('../App.svelte')).not.toContain('retourJeu');
  });

  it('les cases prennent leurs couleurs des variables --tile-*, sans animation', () => {
    const m = source('Menu.svelte');
    for (const v of ['--tile-bg', '--tile-fg', '--tile-ink', '--tile-ink2', '--tile-bd']) {
      expect(m).toMatch(new RegExp(`var\\(${v}, `));
    }
    const css = m.slice(m.indexOf('<style>'));
    const cases = css.slice(css.indexOf('.cases {'), css.indexOf('@media'));
    expect(cases).not.toMatch(/animation|transition|transform/);
    expect(css).not.toMatch(/box-shadow|gradient/);
  });

  it('dessine le caractère du jour depuis ses traits, jamais depuis une police', () => {
    const m = source('Menu.svelte');
    expect(m).toContain('glyph(carte.c, traits, 108, { write: true, cinabre })');
    expect(m).not.toMatch(/class="hz"[^>]*>\{carte\.c\}/);
  });
});
