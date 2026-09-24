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

describe('une question : pas de cadre de correction vide avant la réponse', () => {
  it('la zone de correction est « vide » tant que rien n\'a été répondu', () => {
    expect(source('Ask.svelte')).toContain(
      '<div class="fb" class:vide={note === null && !sautable && essais === 0}>'
    );
  });
});

describe("l'assemblage de révision tient dans l'écran, bouton du bas compris", () => {
  const ask = source('Ask.svelte');

  it('les briques en vrac se posent sur quatre colonnes', () => {
    expect(ask).toContain("class:vrac={q.type === 'assemblage'}");
  });

  it('au-delà de trois briques, la ligne de cases se resserre', () => {
    expect(ask).toContain('class:serre={serre}');
    expect(ask).toContain('const serre = $derived(q.reponse.length > 3)');
    expect(source('tokens.css')).toContain('.q .parts.serre .case{');
  });
});

describe('le bouton principal reste visible quand le contenu défile', () => {
  const css = source('tokens.css');

  it('en session, le pied de l’écran colle au bas de la fenêtre', () => {
    expect(css).toMatch(/\n\.foot\{position:sticky;bottom:0;/);
  });

  it('sur les onglets, où la barre tient déjà le bas, il reste dans le flux', () => {
    expect(css).toContain('.onglets .foot{position:static;');
  });
});

describe('un libellé de bouton sur deux lignes reste centré', () => {
  it('le bouton annule l’alignement à gauche hérité de `button`', () => {
    expect(source('tokens.css')).toContain('.btn{text-align:center;');
  });

  it('les sélecteurs des réglages aussi (« Plus de révisions »)', () => {
    expect(source('tokens.css')).toContain('.seg button{text-align:center;');
  });
});

describe('des zones de tap d’au moins 44 pt', () => {
  const css = source('tokens.css');

  it('le zoom du cercle et la liste des familles', () => {
    expect(css).toContain('.zoomctl button{width:44px;height:44px}');
    expect(css).toContain('.famrow{min-height:44px}');
  });

  it("chaque nœud d'un arbre a un disque de tap plus large que son dessin", () => {
    const tree = source('Tree.svelte');
    expect(tree).toContain('<circle class="hit" r={Math.max(nd.r, RAYON_TAP)} />');
    expect(tree).toContain('const RAYON_TAP = 34;');
  });
});

describe("un tracé indisponible dit quoi faire, sans mot d'atelier", () => {
  it('la ligne renvoie au bouton du bas et ne parle pas de données « embarquées »', () => {
    const ask = source('Ask.svelte');
    expect(ask).toContain('Ce caractère ne se trace pas encore ici. Continue avec le bouton du bas.');
    expect(ask).not.toContain("n'est pas embarqué. On passe.");
  });
});

describe('un seul thème : le papier clair', () => {
  it("aucune variante sombre, ni par le système ni par un réglage", () => {
    const css = source('tokens.css');
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).not.toContain('data-theme');
    expect(css).toContain('html{background:var(--paper);color-scheme:light}');
  });

  it('le gabarit du tracé a sa propre couleur, que la nuit de la mi-automne change', () => {
    const css = source('tokens.css');
    expect(css).toContain(':root{--guide:#D9D1C2}');
    expect(css).toContain(':root[data-fete="zhongqiu"],[data-fete="zhongqiu"]{--guide:#46527A}');
    expect(source('Trace.svelte')).toContain("outlineColor: couleur('--guide')");
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
