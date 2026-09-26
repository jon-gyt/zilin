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

describe('le cinabre marque un élément ajouté, jamais le caractère entier', () => {
  const m = source('Menu.svelte');
  it('un ajout qui couvre tous les traits ne met rien en cinabre (朋 = 月 + 月)', () => {
    expect(m).toContain('if (d !== null && z.length >= d.s.length) z = [];');
  });
  it('dans la décomposition, des parties toutes neuves restent à l’encre', () => {
    expect(m).toContain('const enCinabre = (i: number): boolean => !toutNeuf');
  });
});

describe("l'anecdote du jour se relit depuis Lire", () => {
  const lire = source('Lire.svelte');
  const app = source('../App.svelte');

  it('Lire porte en tête « L’anecdote du jour », au-dessus des contes, son caractère dessiné', () => {
    const entree = lire.indexOf('<button class="fiche anecdote" onclick={onanecdote}>');
    expect(entree).toBeGreaterThan(0);
    expect(lire.indexOf("L'anecdote du jour", entree)).toBeGreaterThan(entree);
    /* Dans la partie « Aujourd'hui », au-dessus de celle des contes. */
    expect(lire.indexOf('<h2 class="sec">Aujourd\'hui')).toBeLessThan(entree);
    expect(entree).toBeLessThan(lire.lastIndexOf('Les contes <span class="zh"'));
    expect(lire.slice(entree)).toMatch(/^[^]*?<Glyph char=\{anecdote\.a\.c\}/);
    /* La même anecdote que l'écran Ouvrir, calculée au même endroit. */
    expect(lire).toContain('anecdoteDeLaJournee(');
    expect(source('Open.svelte')).toContain('anecdoteDeLaJournee(');
  });

  it("rouverte, elle ramène là d'où l'on vient, sans refaire le pas Ouvrir", () => {
    expect(app).toContain("onanecdote={() => relireAnecdote('lire')}");
    expect(app).toContain('<Open {p} oncontinuer={anecdoteRefermee} onquitter={anecdoteRefermee} onmontree={anecdoteMontree} />');
    const f = app.slice(app.indexOf('function anecdoteRefermee('));
    const corps = f.slice(0, f.indexOf('\n  }\n'));
    expect(corps).toContain('anecdoteRelue(p, p.day)');
    expect(corps).not.toContain('anecdoteFaite(');
    expect(corps).not.toContain('enchainer(');
    expect(corps).toContain("if (retour === 'lire') ecran = 'lire';");
  });
});

describe('Lire, en étagères de livres cousus (décision du 26 septembre 2026)', () => {
  const lire = source('Lire.svelte');
  const motif = source('Motif.svelte');

  it('deux parties sous un filet d’encre : « Aujourd’hui », puis « Les contes »', () => {
    const aujourdhui = lire.indexOf('<h2 class="sec">Aujourd\'hui <span class="zh" lang="zh-Hans">今天</span>');
    const contes = lire.lastIndexOf('Les contes <span class="zh" lang="zh-Hans">故事</span>');
    expect(aujourdhui).toBeGreaterThan(0);
    expect(contes).toBeGreaterThan(aujourdhui);
    expect(lire).toMatch(/\.sec \{[^}]*border-top: 1\.5px solid var\(--ink\)/);
    /* La lettre de Que suit l'anecdote, dans « Aujourd'hui ». */
    const lettre = lire.indexOf('<button class="fiche lettre"');
    expect(lettre).toBeGreaterThan(lire.indexOf('<button class="fiche anecdote"'));
    expect(lettre).toBeLessThan(contes);
  });

  it('le 读 de l’en-tête est dessiné depuis ses traits, avec « Seulement ton acquis »', () => {
    expect(lire).toContain('<Glyph char="读"');
    expect(lire).toContain('Seulement ton acquis');
    expect(lire).toContain('posture="lecture"');
  });

  it('les contes se rangent sur les étagères de `etageres.ts`, « Plus loin » défile de côté', () => {
    expect(lire).toContain('etageres(entrees,');
    expect(lire).toMatch(/\{:else if et\.id === 'loin'\}\s*<div class="rangee defile">/);
    expect(lire).toMatch(/\.rangee\.defile \{[^}]*overflow-x: auto/);
    expect(lire).toContain('<div class="planche"></div>');
  });

  it('un livre ouvert est un bouton ; un livre fermé, pâle et tireté, est désactivé', () => {
    expect(lire).toMatch(/<button class="livre"[^>]*data-gratuit=\{e\.gratuit\} onclick=\{\(\) => ouvrir\(e\)\}>/);
    expect(lire).toMatch(/<div class="livre ferme"[^>]*data-gratuit=\{e\.gratuit\} aria-disabled="true">/);
    expect(lire).toMatch(/\.livre\.ferme \.couv \{[^}]*border-style: dashed/);
    expect(lire).toContain('aria-label={niveauxLus(l)}');
    expect(lire).toContain('{MENTION_HORS_ACQUIS}');
    expect(lire).toContain('Une version plus riche de ce conte est ouverte.');
  });

  it('la lettre de la semaine porte « NOUVELLE » à l’indigo ; toutes les lettres restent', () => {
    expect(lire).toMatch(/\{#if e\.nouvelle\}<span class="nouvelle">NOUVELLE<\/span>\{\/if\}/);
    expect(lire).toMatch(/\.nouvelle \{[^}]*background: var\(--indigo\)/);
    expect(lire).toContain('{LIGNE_AVANT_LETTRE}');
    expect(lire).toContain('{MENTION_PAS_ARRIVEE}');
    expect(lire).toContain('{#each autresLettres as x (x.lettre.n)}');
    expect(lire).toContain('<Que size={34} pose="pose" />');
  });

  it('fonds neutres : ni cinabre, ni ombre, ni dégradé, ni doré ; la couleur est dans les images', () => {
    for (const [nom, s] of [['Lire', lire], ['Motif', motif]] as const) {
      expect(s, nom).not.toContain('--zhu');
      expect(s, nom).not.toMatch(/box-shadow|text-shadow|drop-shadow|gradient|gold|#d4af37/i);
    }
    /* Les fiches ont toutes le fond de la carte et un filet fin. */
    expect(lire).toMatch(/\.fiche \{[^}]*background: var\(--card\);\s*border: 1px solid var\(--line\)/);
  });

  it('aucun conte n’est connu de l’app : pas de table conte → dessin, pas de dragon', () => {
    const catalogue = readFileSync(new URL('../../../data/sources/contes/catalogue.tsv', import.meta.url), 'utf8');
    const ids = catalogue
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('id\t'))
      .map((l) => l.split('\t')[0]);
    expect(ids.length).toBe(13);
    for (const id of ids) {
      expect(lire, id).not.toContain(id);
      expect(motif, id).not.toContain(id);
      expect(source('etageres.ts'), id).not.toContain(id);
    }
    expect(motif).not.toMatch(/'dragon'|龙/);
  });
});
