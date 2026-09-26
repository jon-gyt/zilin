/**
 * 前路 « La route devant » (retour du propriétaire du 26 septembre 2026) : un test par
 * règle. Les jours ci-dessous sont des fixtures ; l'app lit le parcours dans l'export.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { IndexJour } from './content';
import {
  BORNES_MAX,
  DERRIERE,
  DEVANT,
  bornesDevant,
  choixParDefaut,
  dansCourt,
  etapesDuChemin,
  jourDeDemain,
  jourDuSeuil,
  ligneBorne,
  ligneLus,
  positionDuJour,
  premierSens,
  prochainesBornes,
  quand,
  route,
  type ConteAVenir,
  type Etape,
  type SeuilLire
} from './route';
import {
  allDone,
  cloreSession,
  commencerPlus,
  emptyProgress,
  finApprendre,
  finDepart,
  sessionSteps,
  type Progress
} from './session';

/** Un parcours de 30 jours : chaque jour une brique et deux composés, le 20e non réconcilié. */
const JOURS: IndexJour[] = Array.from({ length: 30 }, (_, k) => ({
  jour: k + 1,
  brique: `b${k + 1}`,
  composes: [`c${k + 1}a`, `c${k + 1}b`],
  non_reconcilie: k + 1 === 20
}));
const ETAPES = etapesDuChemin(JOURS);

/** Une progression au jour `n` du chemin : leçon apprise (`faite`) ou à apprendre. */
function au(n: number, faite: boolean, jour = '2026-10-13'): Progress {
  const p: Progress = { ...emptyProgress(jour), premiere: false, parcours: 'lire', days: n, jourParcours: n };
  if (!faite) return p;
  return { ...p, done: sessionSteps(p).map(() => true), jourAppris: n, jourParcours: n + 1 };
}

describe('les étapes du chemin', () => {
  it("un jour non réconcilié n'est pas une étape : la session le saute, il ne compte pas", () => {
    expect(ETAPES).toHaveLength(29);
    expect(ETAPES.map((e) => e.jour)).not.toContain(20);
  });

  it('un jour sans brique nouvelle prend son premier composé pour pierre', () => {
    const e = etapesDuChemin([{ jour: 1, brique: null, composes: ['兴', '举'], non_reconcilie: false }]);
    expect(e).toEqual([{ jour: 1, brique: '兴', ouvre: ['举'] }]);
  });
});

describe('la position : jours du chemin, jamais le calendrier', () => {
  it('avant la session, la pierre du jour est la leçon à poser, pas encore lue', () => {
    expect(positionDuJour(au(12, false))).toEqual({ jour: 12, faite: false, sur: true });
  });

  it('la journée faite, la pierre du jour est la leçon apprise', () => {
    const p = cloreSession(finApprendre(au(12, false), '2026-10-13', new Date(0), ['b12'], 12), '2026-10-13');
    expect(positionDuJour(p)).toEqual({ jour: 12, faite: true, sur: true });
  });

  it('le jour de la première session, la pierre du jour est la dernière brique vue', () => {
    const p = finDepart({ ...emptyProgress('2026-10-13'), parcours: 'lire' }, '2026-10-13', new Date(0), ['人', '大', '天'], 4);
    expect(positionDuJour(p)).toEqual({ jour: 3, faite: true, sur: true });
  });

  it("en rattrapage, aucune brique n'entre : la suite n'est pas « demain »", () => {
    const p = { ...au(12, false), catchup: true };
    expect(positionDuJour(p)).toMatchObject({ jour: 11, sur: false });
    expect(quand(1, false)).toBe("l'étape suivante");
    expect(dansCourt(3, false)).toBe('dans 3 étapes');
  });

  it("une journée sautée ne compte pas : la position ne suit que le parcours", () => {
    /* Trois semaines sans ouvrir l'app : la même progression, une autre journée. */
    const avant = au(12, false, '2026-10-13');
    const apres = { ...avant, day: '2026-11-03', lastWorked: '2026-10-12' };
    expect(positionDuJour(apres)).toEqual(positionDuJour(avant));
    expect(route(ETAPES, positionDuJour(apres))).toEqual(route(ETAPES, positionDuJour(avant)));
  });

  it("aucune fonction ne lit l'horloge", () => {
    const src = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/new Date|Date\.now|today\(|\.day\b/);
  });
});

describe('les pierres : deux derrière, celle du jour, six devant', () => {
  it('au milieu du chemin : 2 lues, la pierre du jour, 6 à venir', () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    expect(r.pierres.map((x) => x.jour)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(r.pierres.map((x) => x.etat)).toEqual(['lue', 'lue', 'jour', ...Array(6).fill('avenir')]);
    expect(r.pierres.filter((x) => x.ecart < 0)).toHaveLength(DERRIERE);
    expect(r.pierres.filter((x) => x.ecart > 0)).toHaveLength(DEVANT);
    expect(r.faite).toBe(true);
  });

  it('au premier jour : aucune pierre derrière', () => {
    const r = route(ETAPES, positionDuJour(au(1, false)));
    expect(r.pierres[0]).toMatchObject({ jour: 1, etat: 'jour', ecart: 0 });
    expect(r.pierres.filter((x) => x.etat === 'lue')).toHaveLength(0);
    expect(r.pierres).toHaveLength(1 + DEVANT);
    expect(r.faite).toBe(false);
  });

  it('les écarts comptent les étapes : le jour non réconcilié est franchi sans compter', () => {
    const r = route(ETAPES, positionDuJour(au(17, true)));
    expect(r.pierres.map((x) => x.jour)).toEqual([15, 16, 17, 18, 19, 21, 22, 23, 24]);
    expect(r.pierres.find((x) => x.jour === 21)?.ecart).toBe(3);
  });

  it('à la fin du parcours : moins de pierres devant, puis aucune', () => {
    const presque = route(ETAPES, positionDuJour(au(28, true)));
    expect(presque.pierres.map((x) => x.jour)).toEqual([26, 27, 28, 29, 30]);
    expect(presque).toMatchObject({ fin: false, bout: true });
    expect(route(ETAPES, positionDuJour(au(12, true))).bout).toBe(false);
    const bout = route(ETAPES, positionDuJour(au(30, true)));
    expect(bout.pierres.filter((x) => x.ecart > 0)).toHaveLength(0);
    expect(bout.fin).toBe(true);
    /* Le lendemain du dernier jour, plus rien à poser : la dernière pierre est lue. */
    const apres = route(ETAPES, positionDuJour(au(31, false)));
    expect(apres).toMatchObject({ fin: true, faite: true, jour: { jour: 30 } });
  });

  it('sans parcours, aucune pierre', () => {
    expect(route([], positionDuJour(au(3, false))).pierres).toEqual([]);
  });
});

describe('la sélection par défaut : demain', () => {
  it('la pierre qui suit celle du jour', () => {
    expect(choixParDefaut(route(ETAPES, positionDuJour(au(12, true))))).toBe(13);
    expect(choixParDefaut(route(ETAPES, positionDuJour(au(12, false))))).toBe(13);
    expect(choixParDefaut(route(ETAPES, positionDuJour(au(19, true))))).toBe(21);
  });

  it('au bout du parcours, la pierre du jour', () => {
    expect(choixParDefaut(route(ETAPES, positionDuJour(au(30, true))))).toBe(30);
  });
});

describe('les bornes : les deux prochaines, seulement les vraies', () => {
  /* Trois caractères par étape : le 10e entre au jour 4, le 50e au jour 17, le 100e plus loin. */
  const seuils = (lus = 0): SeuilLire[] => [10, 50, 100, 255].map((n) => ({ n, obtenu: lus >= n }));
  const contes: ConteAVenir[] = [
    { id: 'a', titre: '愚公移山', jour: 14, motif: 'montagne' },
    { id: 'b', titre: '拔苗助长', jour: 25 },
    { id: 'c', titre: '南辕北辙', jour: null },
    { id: 'd', titre: '守株待兔', jour: 999 }
  ];

  it('le jour du Ne caractère se lit sur le chemin, sinon rien', () => {
    expect(jourDuSeuil(ETAPES, 10)).toBe(4);
    expect(jourDuSeuil(ETAPES, 50)).toBe(17);
    expect(jourDuSeuil(ETAPES, 100)).toBeNull();
  });

  it("dans l'ordre du chemin, avec leur écart en étapes", () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const b = bornesDevant(ETAPES, r, seuils(30), contes);
    expect(b.map((x) => [x.titre, x.ecart])).toEqual([
      ['愚公移山', 2],
      ['50 caractères', 5],
      ['拔苗助长', 12]
    ]);
  });

  it('jamais plus de deux', () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const deux = prochainesBornes(bornesDevant(ETAPES, r, seuils(30), contes));
    expect(deux).toHaveLength(BORNES_MAX);
    expect(deux.map((x) => x.titre)).toEqual(['愚公移山', '50 caractères']);
  });

  it("un trophée obtenu, un conte sans jour ou hors du chemin, un seuil trop loin : rien", () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const titres = bornesDevant(ETAPES, r, seuils(60), contes).map((x) => x.titre);
    expect(titres).not.toContain('50 caractères');
    expect(titres).not.toContain('100 caractères');
    expect(titres).not.toContain('南辕北辙');
    expect(titres).not.toContain('守株待兔');
  });

  it("un seuil déjà rencontré mais pas encore lu ne s'estime pas", () => {
    /* Au jour 20, le 50e caractère est entré le 17 ; il n'est pas encore lu. */
    const r = route(ETAPES, positionDuJour(au(21, true)));
    expect(bornesDevant(ETAPES, r, seuils(40), []).map((x) => x.titre)).toEqual([]);
  });

  it("avant la session, une borne sur la pierre du jour est encore devant : « aujourd'hui »", () => {
    const r = route(ETAPES, positionDuJour(au(14, false)));
    const b = bornesDevant(ETAPES, r, [], contes);
    expect(b[0]).toMatchObject({ titre: '愚公移山', ecart: 0 });
    expect(dansCourt(b[0].ecart)).toBe("aujourd'hui");
    const apres = route(ETAPES, positionDuJour(au(14, true)));
    expect(bornesDevant(ETAPES, apres, [], contes).map((x) => x.titre)).toEqual(['拔苗助长']);
  });

  it("la carte : la borne de l'étape, et demain la prochaine", () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const b = bornesDevant(ETAPES, r, seuils(30), contes);
    expect(ligneBorne(1, b)).toEqual({ tete: 'Prochaine borne :', titre: '愚公移山', suite: 'dans 2 jours.' });
    expect(ligneBorne(2, b)).toEqual({ tete: 'Borne ce jour-là :', titre: '愚公移山', suite: "un conte s'ouvre." });
    expect(ligneBorne(3, b)).toBeNull();
  });
});

describe('« Demain » au menu : seulement la journée faite', () => {
  it('avant la session, pendant, en session de plus : rien', () => {
    expect(jourDeDemain(au(12, false))).toBeNull();
    const plus = commencerPlus(au(12, true));
    expect(plus.enPlus).not.toBeNull();
    expect(jourDeDemain(plus)).toBeNull();
    expect(jourDeDemain({ ...au(12, false), premiere: true })).toBeNull();
    expect(jourDeDemain({ ...au(12, true), catchup: true })).toBeNull();
  });

  it('la session faite : le jour du chemin qui suit', () => {
    const p = au(12, true);
    expect(allDone(p)).toBe(true);
    expect(jourDeDemain(p)).toBe(13);
  });
});

describe('les mots de la route', () => {
  it('jours du chemin, sans date', () => {
    expect(quand(-2)).toBe('déjà lu');
    expect(quand(0)).toBe("aujourd'hui");
    expect(quand(1)).toBe('demain');
    expect(quand(6)).toBe('dans 6 jours');
    expect(dansCourt(13)).toBe('dans 13 j');
  });

  it("l'en-tête : les caractères lus, et le HSK 1", () => {
    expect(ligneLus(25, { lus: 20, total: 300 })).toBe('25 caractères lus · 20 / 300 du HSK 1');
    expect(ligneLus(1, null)).toBe('1 caractère lu');
  });

  it('le premier sens de la fiche', () => {
    expect(premierSens('enfant, fils, suffixe de nom')).toBe('enfant');
    expect(premierSens('')).toBe('');
  });

  it('les étapes gardent leur brique et ce qu’elles ouvrent', () => {
    const e: Etape | undefined = ETAPES.find((x) => x.jour === 13);
    expect(e).toEqual({ jour: 13, brique: 'b13', ouvre: ['c13a', 'c13b'] });
  });
});

describe('la charte de la route, dans les écrans', () => {
  const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
  /** Le code seul : les commentaires disent justement ce qui est interdit. */
  const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/.*$/gm, '');
  const ecran = code(source('Route.svelte'));

  it('ni ombre, ni dégradé, ni doré, ni dragon, ni couleur hors des jetons', () => {
    for (const [nom, s] of [
      ['Route', ecran],
      ['RouteEntree', code(source('RouteEntree.svelte'))]
    ]) {
      expect(s, nom).not.toMatch(/gradient|box-shadow|drop-shadow|text-shadow/i);
      expect(s, nom).not.toMatch(/gold|doré/i);
      expect(s, nom).not.toMatch(/dragon|龙/i);
      expect(s, nom).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });

  it('le cinabre ne marque que la position : la pierre du jour, son sceau, son « aujourd’hui »', () => {
    const regles = [...ecran.matchAll(/([^{}]+)\{[^}]*var\(--zhu\)[^}]*\}/g)].map((m) => m[1].trim());
    expect(regles.sort()).toEqual(['.pierre.jour .disque', '.sceau', '.when.now']);
    expect(ecran.match(/--zhu/g)).toHaveLength(3);
  });

  it('les briques se dessinent depuis leurs traits ; Tao marche sur la route', () => {
    expect(ecran).toContain('glyph(');
    expect(ecran).toContain('<Glyph');
    expect(ecran).toMatch(/<Tao [^>]*posture="chemin"/);
  });

  it('au menu, « Ma route » ne paraît que la journée faite', () => {
    const menu = source('Menu.svelte');
    expect(menu).toContain('jourDeDemain(p)');
    expect(menu).toMatch(/\{#if demain && jourDemain !== null\}/);
  });
});
