import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SEUIL_ABSENCE } from './session';
import {
  JOURNAL_MAX,
  PALIERS,
  POIDS,
  absente,
  ajouter,
  dernierJour,
  humeur,
  journal,
  lireTao,
  poseDuJour,
  posture,
  proposeUnJeu,
  stade,
  taoVide,
  type Activite,
  type PostureVue,
  type Tao,
  type TypeActivite
} from './tao';

const JOUR = '2026-03-09';

/** Un journal court, du plus ancien au plus récent. */
const faits = (...l: [string, TypeActivite][]): Activite[] => l.map(([jour, type]) => ({ jour, type }));

const nourrir = (n: number, type: TypeActivite, jour = JOUR): Tao => {
  let t = taoVide();
  for (let i = 0; i < n; i++) t = ajouter(t, jour, type);
  return t;
};

describe('les stades', () => {
  it('partent de la graine et poussent dès la première activité', () => {
    expect(stade(0)).toBe('graine');
    expect(stade(ajouter(taoVide(), JOUR, 'revision').croissance)).toBe('pousse');
  });

  it('suivent les paliers 100, 300 et 1 000', () => {
    expect(stade(PALIERS.jeune - 1)).toBe('pousse');
    expect(stade(PALIERS.jeune)).toBe('jeune');
    expect(stade(PALIERS.fleur - 1)).toBe('jeune');
    expect(stade(PALIERS.fleur)).toBe('fleur');
    expect(stade(PALIERS.peches - 1)).toBe('fleur');
    expect(stade(PALIERS.peches)).toBe('peches');
  });

  it('ne redescendent jamais', () => {
    const t = nourrir(PALIERS.jeune, 'revision');
    expect(stade(t.croissance)).toBe('jeune');
    expect(stade(ajouter(t, '2026-04-01', 'revision').croissance)).toBe('jeune');
  });
});

describe('la croissance', () => {
  it("additionne le poids de chaque activité", () => {
    let t = taoVide();
    t = ajouter(t, JOUR, 'lecon');
    t = ajouter(t, JOUR, 'revision');
    t = ajouter(t, JOUR, 'lecture');
    expect(t.croissance).toBe(POIDS.lecon + POIDS.revision + POIDS.lecture);
    expect(t.croissance).toBe(5 + 1 + 3);
  });

  it('pèse la brique apprise plus que la carte révisée', () => {
    expect(POIDS.lecon).toBeGreaterThan(POIDS.jeu);
    expect(POIDS.jeu).toBeGreaterThan(POIDS.revision);
    expect(Object.values(POIDS).every((p) => p > 0)).toBe(true);
  });

  it("borne le journal sans jamais toucher à la croissance", () => {
    const t = nourrir(JOURNAL_MAX + 10, 'revision');
    expect(t.croissance).toBe(JOURNAL_MAX + 10);
    expect(t.activites).toHaveLength(JOURNAL_MAX);
  });
});

describe('les postures', () => {
  it('suivent l’activité en cours', () => {
    expect(posture('lecon')).toBe('lecon');
    expect(posture('revision')).toBe('revision');
    expect(posture('lecture')).toBe('lecture');
    expect(posture('trace')).toBe('trace');
    expect(posture('jeu')).toBe('jeu');
    expect(posture('chemin')).toBe('chemin');
    expect(posture('anecdote')).toBe('anecdote');
  });

  it('lisent le conte comme un texte', () => {
    expect(posture('conte')).toBe('lecture');
  });

  it('goûtent en cuisine', () => {
    expect(posture('cuisine')).toBe('goute');
  });

  it("montrent le pot au retour d'absence et la marche la journée finie", () => {
    expect(poseDuJour({ rattrapage: false, fini: false })).toBeNull();
    expect(poseDuJour({ rattrapage: false, fini: true })).toEqual({ posture: 'chemin', humeur: 'joie' });
    expect(poseDuJour({ rattrapage: true, fini: false })?.posture).toBe('pot');
  });
});

describe("l'humeur", () => {
  it('vient de la variété : trois types différents font la joie', () => {
    const t = faits([JOUR, 'lecon'], ['2026-03-08', 'revision'], ['2026-03-07', 'jeu']);
    expect(humeur(t, JOUR)).toBe('joie');
  });

  it('reste calme quand un seul type revient', () => {
    const t = faits(['2026-03-05', 'revision'], ['2026-03-07', 'revision'], [JOUR, 'revision']);
    expect(humeur(t, JOUR)).not.toBe('joie');
    const deux = faits(['2026-03-07', 'revision'], [JOUR, 'lecon']);
    expect(humeur(deux, JOUR)).toBe('calme');
  });

  it('ne regarde que les sept derniers jours', () => {
    const vieux = faits(['2026-03-01', 'lecon'], ['2026-03-01', 'jeu'], ['2026-03-01', 'lecture']);
    expect(humeur(vieux, JOUR)).toBe('calme');
  });

  it("s'ennuie après trois activités identiques d'affilée, et propose un jeu", () => {
    const t = faits([JOUR, 'revision'], [JOUR, 'revision'], [JOUR, 'revision']);
    expect(humeur(t, JOUR)).toBe('ennui');
    expect(proposeUnJeu(humeur(t, JOUR))).toBe(true);
    const coupe = faits([JOUR, 'revision'], [JOUR, 'revision'], [JOUR, 'jeu'], [JOUR, 'revision']);
    expect(humeur(coupe, JOUR)).not.toBe('ennui');
  });

  it('tient les jours de repos pour neutres, jamais négatifs', () => {
    const variee = faits(['2026-03-04', 'lecon'], ['2026-03-04', 'jeu'], ['2026-03-04', 'lecture']);
    expect(humeur(variee, '2026-03-04')).toBe('joie');
    // trois jours de repos passent : l'humeur ne descend pas.
    expect(humeur(variee, '2026-03-07')).toBe('joie');
    // une semaine sans rien : calme, jamais triste.
    expect(humeur(variee, '2026-03-20')).toBe('calme');
    expect(humeur([], JOUR)).toBe('calme');
  });
});

describe("l'absence", () => {
  it('met Tao en pot au même seuil que le rattrapage', () => {
    expect(absente('2026-03-08', JOUR)).toBe(false);
    expect(absente('2026-03-07', JOUR)).toBe(false);
    expect(absente('2026-03-06', JOUR)).toBe(true);
    expect(SEUIL_ABSENCE).toBe(3);
  });

  it('ne rend jamais un nombre de jours manqués', () => {
    const loin = absente('2026-01-01', JOUR);
    expect(typeof loin).toBe('boolean');
    expect(loin).toBe(true);
    expect(absente(null, JOUR)).toBe(false);
  });

  it('retrouve la dernière journée vue', () => {
    const t = ajouter(ajouter(taoVide(), '2026-03-02', 'lecon'), '2026-03-06', 'jeu');
    expect(dernierJour(t)).toBe('2026-03-06');
    expect(dernierJour(taoVide())).toBeNull();
  });
});

describe('le journal du soir', () => {
  it('constate des nombres, sans félicitation ni reproche', () => {
    const t = faits(
      [JOUR, 'lecon'],
      [JOUR, 'revision'],
      [JOUR, 'revision'],
      [JOUR, 'jeu'],
      ['2026-03-08', 'lecture']
    );
    const ligne = journal(t, JOUR);
    expect(ligne).toBe("Aujourd'hui, une brique apprise, un jeu, 2 cartes révisées.");
    expect(ligne).not.toMatch(/bravo|félicit|bien jou|parfait|dommage|manqu|perdu|!/i);
  });

  it('constate aussi une journée de repos, sans reproche', () => {
    const ligne = journal([], JOUR);
    expect(ligne).toBe("Aujourd'hui, rien de noté.");
    expect(ligne).not.toMatch(/bravo|félicit|dommage|manqu|perdu|!/i);
  });
});

describe('sérialisation', () => {
  it("fait l'aller-retour JSON", () => {
    let t = ajouter(taoVide(), JOUR, 'lecon');
    t = ajouter(t, JOUR, 'jeu');
    t = { ...t, collection: ['lanterne'] };
    expect(lireTao(JSON.parse(JSON.stringify(t)))).toEqual(t);
  });

  it('relit une progression sans Tao', () => {
    expect(lireTao(undefined)).toEqual(taoVide());
    expect(lireTao(null)).toEqual(taoVide());
    expect(lireTao('pousse')).toEqual(taoVide());
  });

  it('jette les activités aberrantes sans perdre le reste', () => {
    const t = lireTao({
      croissance: 7,
      activites: [{ jour: JOUR, type: 'lecon' }, { jour: 3, type: 'jeu' }, { jour: JOUR, type: 'sieste' }, 'rien'],
      collection: ['bol', 2]
    });
    expect(t.croissance).toBe(7);
    expect(t.activites).toEqual([{ jour: JOUR, type: 'lecon' }]);
    expect(t.collection).toEqual(['bol']);
  });
});

describe('Tao accompagne les activités dans leur posture (brief §9)', () => {
  /** Ce que chaque écran d'activité doit poser, et rien d'autre : une posture, sans un mot. */
  const ECRANS: [string, PostureVue[]][] = [
    ['Open.svelte', ['anecdote']],
    ['Learn.svelte', ['lecon', 'trace']],
    ['Use.svelte', ['lecture']],
    ['Warm.svelte', ['revision']],
    ['Fix.svelte', ['revision']],
    ['Game.svelte', ['jeu']],
    ['Cuisine.svelte', ['goute', 'lecture']],
    ['Close.svelte', ['chemin']]
  ];

  it('est à sa place sur chaque écran, dans la posture de l’activité', () => {
    for (const [fichier, postures] of ECRANS) {
      const source = readFileSync(new URL(fichier, import.meta.url), 'utf8');
      expect(source, fichier).toContain('<Tao');
      for (const pose of postures) expect(source, fichier).toContain(`posture="${pose}"`);
    }
  });

  it('écoute l’anecdote assise : petite, sans un mot, hors du flux de l’estampe', () => {
    const source = readFileSync(new URL('Open.svelte', import.meta.url), 'utf8');
    const balise = source.match(/<Tao [^>]*\/>/)?.[0] ?? '';
    expect(balise).toContain('posture="anecdote"');
    /* Petite : plus petite que l'estampe (72) et que Tao sur les écrans de question (64). */
    const taille = Number(balise.match(/size=\{(\d+)\}/)?.[1]);
    expect(taille).toBeGreaterThan(0);
    expect(taille).toBeLessThanOrEqual(64);
    /* Sans commentaire : ni bulle, ni texte à côté d'elle. */
    expect(balise).not.toContain('caractere');
    expect(source).toMatch(/<div class="tao-assise"><Tao [^>]*\/><\/div>/);
    /* Hors du flux : la mise en page de l'anecdote ne bouge pas. */
    const css = readFileSync(new URL('tokens.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.ouvrir \.tao-assise\{position:absolute/);
  });

  it('ne commente jamais une réponse : elle n’a aucune bulle de texte', () => {
    const source = readFileSync(new URL('Tao.svelte', import.meta.url), 'utf8');
    /* La seule bulle est celle de la leçon, et elle ne porte qu'un caractère. */
    expect(source).toContain('{caractere}');
    expect(source).not.toMatch(/VERDICTS|correct|bravo/i);
  });
});
