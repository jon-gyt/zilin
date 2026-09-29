/**
 * Les petits détails qui rendent l'app vivante (demande du propriétaire du 29 septembre 2026,
 * « un petit coup de beauté »). Un test par détail : la classe d'animation est posée, et elle
 * s'arrête si l'on réduit les animations (`prefers-reduced-motion`). Aucun ne prend la
 * couleur du cinabre, aucun n'a d'ombre ni de dégradé.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { glyph, type StrokeData } from './glyph';

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

describe("le caractère du jour écrit, une goutte d'encre se pose", () => {
  const d: StrokeData = {
    s: ['M 0 0 L 100 0 L 100 10 Z', 'M 0 0 L 10 0 L 10 100 Z'],
    m: [
      [
        [0, 5],
        [100, 5]
      ],
      [
        [5, 0],
        [5, 100]
      ]
    ]
  };
  it('au bout du dernier trait, quand le pinceau a fini, puis une onde', () => {
    const h = glyph('二', d, 120, { write: true, goutte: true });
    const fin = [...h.matchAll(/class="fill" style="animation-delay:([\d.]+)s"/g)].map((x) => +x[1]);
    const g = h.match(/<circle class="goutte" cx="5" cy="100" r="24" style="animation-delay:([\d.]+)s"\/>/);
    expect(g).not.toBeNull();
    expect(+(g?.[1] ?? 0)).toBeGreaterThanOrEqual(Math.max(...fin));
    expect(h).toMatch(/<circle class="onde-encre" cx="5" cy="100"/);
  });
  it("prend l'encre de son trait, et seulement si on la demande", () => {
    expect(glyph('二', d, 120, { write: true, goutte: true, cinabre: [1] })).toContain('class="goutte zhu"');
    expect(glyph('二', d, 120, { write: true })).not.toContain('goutte');
    expect(glyph('二', d, 48, { goutte: true })).not.toContain('goutte');
    expect(source('Menu.svelte')).toContain('{ write: true, cinabre, goutte: true }');
  });
  it("s'efface sans rien laisser, et disparaît si l'on réduit les animations", () => {
    expect(regle(tokens, '.g.write .goutte')).toMatch(/opacity:0;.*animation:goutte [.\d]+s ease-out forwards/);
    expect(tokens).toMatch(/@keyframes goutte\{.*100%\{opacity:0;/);
    expect(tokens).toMatch(/@keyframes onde-encre\{.*100%\{opacity:0;/);
    expect(reduits(tokens)).toContain('.g.write .goutte,.g.write .onde-encre{display:none}');
  });
});

describe('Clore : la pierre du jour se pose avec un rebond et une onde', () => {
  const close = source('Close.svelte');
  const css = close.slice(close.indexOf('<style>'));
  it('elle touche le chemin, rebondit et se pose ; deux ondes partent à ce moment-là', () => {
    expect(css).toMatch(/@keyframes poser \{[\s\S]*72% \{\s*transform: translateY\(-6px\);/);
    expect(close).toContain('<ellipse class="onde" cx="196" cy="112"');
    expect(close).toContain('<ellipse class="onde deux"');
    expect(css).toMatch(/\.onde \{[^}]*stroke: var\(--mist\);[^}]*animation: onde 0\.9s ease-out 0\.79s forwards;/);
    /* l'onde n'est jamais au cinabre, et une pierre déjà posée ne retombe pas */
    expect(css.slice(css.indexOf('.onde {'), css.indexOf('@keyframes onde'))).not.toContain('--zhu');
    expect(close).toMatch(/\{#if !dejaPlantee\}\s*<!--[^>]*-->\s*<ellipse class="onde"/);
  });
  it('le signal haptique tombe quand la pierre touche le chemin, sans rien faire attendre', () => {
    expect(close).toContain('const POSE_MS = 790;');
    expect(close).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches");
    /* quitter l'écran avant le donne aussitôt */
    expect(close).toMatch(/return \(\) => \{\s*clearTimeout\(t\);\s*signal\(\);/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    const r = reduits(css);
    expect(r).toMatch(/\.pose,\s*\.cercle-jour \{\s*animation: none;/);
    expect(r).toMatch(/\.onde \{\s*display: none;/);
  });
});

describe('au menu, Tao lève les yeux vers le caractère du jour', () => {
  const menu = source('Menu.svelte');
  const css = menu.slice(menu.indexOf('<style>'));
  it('de temps en temps, par `translate`, sans toucher au clignement ni au dessin', () => {
    expect(css).toMatch(/\.marcheur :global\(\.tao \.yeux\) \{\s*animation:\s*cligne 7\.7s infinite,\s*regarde 9\.4s/);
    expect(css).toMatch(/@keyframes regarde \{[\s\S]*translate: -7px -5px;/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.marcheur :global\(\.tao \.yeux\) \{\s*animation: none;/);
  });
});

describe('Mon chemin : les lanternes de la route devant se balancent', () => {
  const chemin = source('Chemin.svelte');
  const css = chemin.slice(chemin.indexOf('<style>'));
  it('pendues à leur fil, celle du seuil comme celle de la porte de ville', () => {
    expect(chemin.match(/<g class="balance"/g)?.length ?? 0).toBe(2);
    expect(chemin).toMatch(/<g class="balance"[^>]*>\s*<path class="fil"[^>]*\/>\s*<ellipse class="lanterne"/);
    expect(css).toMatch(/\.balance \{[^}]*transform-origin: 50% 0;[^}]*animation: balancer/);
  });
  it("s'arrêtent si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.balance \{\s*animation: none;/);
  });
});

describe("le fanion d'une auberge flotte au vent", () => {
  for (const f of ['Chemin.svelte', 'Tree.svelte']) {
    const x = source(f);
    const css = x.slice(x.indexOf('<style>'));
    it(`${f} : tenu au mât, sa brique avec lui ; arrêté si l'on réduit les animations`, () => {
      expect(x).toMatch(/<g class="flotte"[^>]*>\s*<path class="fanion"/);
      expect(css).toMatch(/\.flotte \{[^}]*transform-origin: 0 0;[^}]*animation: flotter/);
      expect(reduits(css)).toMatch(/\.flotte \{\s*animation: none;/);
    });
  }
});

describe('le retour haptique, accordé aux petits moments', () => {
  it('une bonne réponse dans un jeu donne le même tap léger qu’en révision, une erreur rien', () => {
    expect(source('Game.svelte')).toMatch(/function reagirA\(correct: boolean\): void \{[\s\S]*?if \(correct\) bonneReponse\(\);/);
    expect(source('WeChat.svelte')).toMatch(/function reagirA\(juste: boolean\): void \{\s*if \(juste\) bonneReponse\(\);/);
    expect(source('Use.svelte')).toContain('if (r.correct) bonneReponse();');
    expect(source('Cuisine.svelte')).toMatch(/if \(r\.correct\) \{\s*bonneReponse\(\);/);
  });
});
