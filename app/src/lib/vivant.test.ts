/**
 * Les petits détails qui rendent l'app vivante (demande du propriétaire du 29 septembre 2026,
 * « un petit coup de beauté »). Un test par détail : la classe d'animation est posée, et elle
 * s'arrête si l'on réduit les animations (`prefers-reduced-motion`). Aucun ne prend la
 * couleur du cinabre, aucun n'a d'ombre ni de dégradé.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { glyph, type StrokeData } from './glyph';
import { decompte } from './parcours';

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

describe("les caractères lus s'impriment en jade dans le sentier d'une auberge", () => {
  const x = source('Tree.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it("les lus seuls, l'un après l'autre en montant, sans rien faire attendre", () => {
    expect(x).toContain("class:imprime={q.etat === 'lu'}");
    expect(x).toContain('animation-delay:${(0.15 + i * 0.06).toFixed(2)}s');
    expect(css).toMatch(/\.imprime \{[^}]*animation: imprimer 0\.42s/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.imprime \{\s*animation: none;/);
  });
});

describe("d'un écran à l'autre, la feuille glisse en place", () => {
  it('chaque écran a un <main> pour racine, qui entre en un quart de seconde, sans jamais partir de rien', () => {
    expect(tokens).toContain('#app > main{animation:feuille .24s ease-out}');
    /* jamais invisible : on lit et on touche dès la première image */
    expect(tokens).toMatch(/@keyframes feuille\{from\{opacity:\.2;/);
    for (const f of ['Menu', 'Warm', 'Learn', 'Use', 'Fix', 'Close', 'Chemin', 'Lire', 'Game', 'Examen', 'Personnage', 'Settings']) {
      expect(source(`${f}.svelte`)).toMatch(/^\s*<main class="/m);
    }
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(tokens)).toContain('#app > main{animation:none}');
  });
});

describe("au menu, les pas s'encrent un à un", () => {
  const x = source('Pinceaux.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it('les faits et celui en cours, de gauche à droite ; au menu seulement', () => {
    expect(css).toMatch(/\.encrer \.fait,\s*\.encrer \.encours \{\s*animation: encrer 0\.3s ease-out both;\s*animation-delay: calc\(0\.12s \+ var\(--i\) \* 0\.07s\);/);
    expect(source('Menu.svelte')).toContain('<Pinceaux coups={m.coups} label={m.ligne} encrer />');
    expect(source('EnTetePas.svelte')).not.toMatch(/<Pinceaux[^>]*encrer/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.encrer \.fait,\s*\.encrer \.encours \{\s*animation: none;/);
  });
});

describe("Lire : l'enveloppe d'une lettre neuve de Que s'entrouvre", () => {
  const x = source('Lire.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it('la lettre de la semaine, pas encore lue : le rabat se lève, la feuille pointe', () => {
    expect(x).toContain('{@render enveloppe(false, e.nouvelle && !e.lue)}');
    expect(css).toMatch(/\.entrouverte \.rabat-leve \{[^}]*animation: rabat /);
    expect(css).toMatch(/\.entrouverte \.billet \{\s*animation: billet /);
    /* le timbre reste à l'ocre : ni cinabre, ni doré */
    expect(x.slice(x.indexOf('{#snippet enveloppe'), x.indexOf('{/snippet}', x.indexOf('{#snippet enveloppe')))).not.toContain('--zhu');
  });
  it("reste fermée si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.entrouverte \.rabat,\s*\.entrouverte \.rabat-leve,\s*\.entrouverte \.billet \{\s*animation: none;/);
    /* sans animation, le rabat levé reste replié à plat, invisible derrière l'enveloppe */
    expect(css).toMatch(/\.entrouverte \.rabat-leve \{[^}]*transform: scaleY\(0\);/);
  });
});

describe("l'appui s'enfonce à peine, la relâche revient", () => {
  it('le bouton, les choix et les options ; jamais les cases du menu', () => {
    expect(tokens).toContain('.btn,.choices button,.opt button{transition:transform .12s ease-out}');
    expect(tokens).toContain('.btn:active:not(:disabled){transform:scale(.98)}');
    expect(tokens).toContain('.choices button:active:not(:disabled){transform:scale(.97)}');
    const menu = source('Menu.svelte');
    const css = menu.slice(menu.indexOf('<style>'));
    expect(css.slice(css.indexOf('.case {'), css.indexOf('.haut {'))).not.toMatch(/transform|transition/);
  });
  it("rien ne bouge si l'on réduit les animations", () => {
    const r = reduits(tokens);
    expect(r).toContain('.btn,.choices button,.opt button{transition:none}');
    expect(r).toMatch(/\.btn:active:not\(:disabled\),\.choices button:active:not\(:disabled\),\.opt button:active:not\(:disabled\)\{transform:none\}/);
  });
});

describe('Jouer : la lanterne de la devinette se balance', () => {
  const x = source('Game.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it('pendue par le haut, sauf celle qui attend son jour', () => {
    expect(css).toMatch(/\.lampion:not\(\.indispo\) \.lampion-dessin \{\s*transform-origin: 50% 0;\s*animation: lampion 3\.6s/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.lampion:not\(\.indispo\) \.lampion-dessin[,\s\w.:()-]*\{\s*animation: none;/);
  });
});

describe('le retour haptique, accordé aux petits moments', () => {
  it('une bonne réponse dans un jeu donne le même tap léger qu’en révision, une erreur rien', () => {
    expect(source('Game.svelte')).toMatch(/function reagirA\(correct: boolean\): void \{[\s\S]*?if \(correct\) bonneReponse\(\);/);
    expect(source('WeChat.svelte')).toMatch(/function reagirA\(juste: boolean\): void \{\s*if \(juste\) bonneReponse\(\);/);
    expect(source('Use.svelte')).toContain('if (r.correct) bonneReponse();');
    expect(source('Cuisine.svelte')).toMatch(/if \(r\.correct\) \{\s*bonneReponse\(\);/);
  });
});

/* ---------- deuxième passe (« Rajoute encore des petits détails ») ---------- */

describe("la bulle de Tao s'écrit au lieu d'apparaître d'un bloc", () => {
  const x = source('Bulle.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it("de gauche à droite, une fois ouverte, jamais plus de 0,8 s ; l'annonce se lit d'un bloc", () => {
    expect(x).toContain('Math.min(0.8, Math.max(0.25, [...texte].length * 0.025))');
    expect(x).toMatch(/role="status" aria-live="polite"><span class="ecrit" style="--duree:\{duree\}s">\{texte\}<\/span>/);
    expect(x).not.toMatch(/<button class="bulle action[^>]*>\s*<span class="ecrit"/);
    expect(css).toMatch(/\.ecrit \{[^}]*clip-path: inset\(0 100% 0 0\);[^}]*animation: ecrire var\(--duree\) linear 0\.6s forwards;/);
  });
  it("la phrase est là d'un coup si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.ecrit \{\s*clip-path: none;\s*animation: none;/);
  });
});

describe('au menu, le compte de la case Réviser se décompte quand la pile baisse', () => {
  it("de l'ancien compte au nouveau, huit pas au plus, jamais en montant", () => {
    expect(decompte(5, 2)).toEqual([5, 4, 3, 2]);
    expect(decompte(33, 5)).toHaveLength(9);
    expect(decompte(33, 5)[0]).toBe(33);
    expect(decompte(33, 5)[8]).toBe(5);
    expect(decompte(3, 0)).toEqual([3, 2, 1, 0]);
    expect(decompte(2, 7)).toEqual([]);
    expect(decompte(4, 4)).toEqual([]);
  });
  it('part du dernier passage au menu, sans rien faire attendre, et pas pendant la session', () => {
    const menu = source('Menu.svelte');
    expect(menu).toContain('let dusAuMenu: number | null = null;');
    expect(menu).toContain("decompteDu !== null && reviser.action !== 'echauffer' ? caseReviser({ ...p, due: decompteDu }).info : reviser.info");
    expect(menu).toContain("if (id === 'reviser') return infoReviser;");
  });
  it("rien ne bouge si l'on réduit les animations", () => {
    expect(source('Menu.svelte')).toMatch(/const pas = avant === null \|\| immobile \? \[\] : decompte\(avant, n\);/);
    expect(source('Menu.svelte')).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches");
  });
});

describe("le jour où un terme commence, une feuille traverse l'en-tête", () => {
  const menu = source('Menu.svelte');
  const css = menu.slice(menu.indexOf('<style>'));
  it("une fois, le premier jour du terme, jamais un jour de fête, à la couleur du décor de l'ambiance", () => {
    expect(menu).toContain("const feuilleDuTerme = $derived(terme !== null && terme.commence && fete === null && termePasse !== terme.id);");
    expect(menu).toMatch(/\{#if feuilleDuTerme\}\s*<!--[^>]*-->\s*<span class="passe-terme" aria-hidden="true">/);
    expect(css).toMatch(/\.passe-terme \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.passe-terme svg \{[^}]*animation: passe-terme 3\.4s ease-in-out 0\.9s forwards;/);
    expect(css).toContain('fill: var(--s-feuille, var(--s-fleur,');
    expect(css.slice(css.indexOf('.passe-terme {'))).not.toContain('--zhu');
  });
  it("disparaît si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.passe-terme \{\s*display: none;/);
  });
});

describe("en révision, chaque question arrive comme une carte qu'on retourne", () => {
  it('un quart de tour à chaque question, jamais de tranche : lisible dès la première image', () => {
    const ask = source('Ask.svelte');
    expect(ask).toMatch(/\{#key cle\}\s*<div class="q carte">/);
    expect(tokens).toContain('.q.carte{animation:carte .32s cubic-bezier(.2,.8,.3,1)}');
    /* partie à 35 degrés et à moitié visible, jamais à 90 : la question se lit tout de suite */
    expect(tokens).toMatch(/@keyframes carte\{from\{opacity:\.45;transform:perspective\(900px\) rotateY\(-35deg\)/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(tokens)).toContain('.q.carte{animation:none}');
  });
});

describe("la devinette trouvée, la lanterne s'allume d'un scintillement bref", () => {
  const game = source('Game.svelte');
  const css = game.slice(game.indexOf('<style>'));
  it('une fois, pâle, sans halo : dans Jouer et dans la main de Tao', () => {
    expect(css).toMatch(/\.lampion\.faite \.lampion-dessin:not\(\.eteinte\) \{\s*animation:\s*lampion 3\.6s ease-in-out infinite alternate,\s*scintille 0\.9s ease-out 0\.3s 1;/);
    expect(tokens).toContain('.tao .lanterne.allumee{animation:balance 3s ease-in-out infinite alternate,scintille .9s ease-out .15s 1}');
    const k = tokens.match(/@keyframes scintille\{[^@]*?\}\}/)?.[0] ?? '';
    expect(k).toContain('opacity');
    expect(k).not.toMatch(/shadow|filter|gradient|blur/);
  });
  it("s'arrête si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.lampion:not\(\.indispo\) \.lampion-dessin,\s*\.lampion\.faite \.lampion-dessin:not\(\.eteinte\) \{\s*animation: none;/);
    expect(reduits(tokens)).toMatch(/\.tao \*\{animation:none!important\}/);
  });
});

describe("le message WeChat : les trois points de l'ami qui écrit", () => {
  const x = source('FilWechat.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it("s'allument l'un après l'autre, sans rien faire attendre de plus", () => {
    expect(x).toContain('<div class="bulle ami ecrit" role="status" aria-label="{ami.zh} écrit"><i></i><i></i><i></i></div>');
    expect(css).toMatch(/\.bulle\.ecrit i \{[^}]*animation: tape 1\.1s ease-in-out infinite;/);
    expect(css).toMatch(/\.bulle\.ecrit i:nth-child\(3\) \{\s*animation-delay: 0\.3s;/);
    expect(css).not.toContain('--zhu');
  });
  it("s'arrêtent si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.bulle,\s*\.bulle\.ecrit i \{\s*animation: none;/);
  });
});

describe('Mon chemin : de loin en loin, un vol d’oiseaux passe dans le ciel', () => {
  const x = source('Chemin.svelte');
  const css = x.slice(x.indexOf('<style>'));
  it('trois oiseaux au trait pâle, dix secondes de passage toutes les quarante, jamais un jour de fête', () => {
    expect(x.match(/<g class="oiseaux">([\s\S]*?)<\/g>/)?.[1].match(/<path /g)?.length).toBe(3);
    expect(css).toMatch(/\.oiseaux \{[^}]*stroke: var\(--ink2\);[^}]*animation: vol 40s linear 3s infinite;/);
    expect(css).toMatch(/@keyframes vol \{[\s\S]*?25% \{[\s\S]*?100% \{/);
    expect(css).toMatch(/:global\(html\[data-fete\]\) \.oiseaux \{\s*display: none;/);
    /* ni dragon, ni cinabre */
    expect(css.slice(css.indexOf('.oiseaux {'), css.indexOf('@keyframes vol'))).not.toMatch(/--zhu|dragon/);
  });
  it("disparaît si l'on réduit les animations", () => {
    expect(reduits(css)).toMatch(/\.oiseaux \{\s*display: none;/);
  });
});
