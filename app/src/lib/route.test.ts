/**
 * 前路 « La route devant » (retour du propriétaire du 26 septembre 2026) : un test par
 * règle. Les jours ci-dessous sont des fixtures ; l'app lit le parcours dans l'export.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { Conte, IndexJour } from './content';
import { joursDuChemin, ouvertures } from './etageres';
import { bibliotheque } from './lecture';
import {
  BORNES_MAX,
  boutDuChemin,
  pierreSuivante,
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
  quandExamen,
  route,
  type ConteAVenir,
  type Etape,
  type ExamenAVenir,
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

  it('une fable du chemin est une borne au jour où entre son dernier caractère, avant les contes du seuil 255', () => {
    /* Décision du propriétaire du 26 septembre 2026 : des fables de première lecture, dès le
       jour 25. Leur jour vient du calcul de l'étagère « Bientôt » ; un mot expliqué n'y
       compte pas. */
    const fable = (id: string, seuil: string, zh: string, explique = ''): Conte => ({
      version: '0.1.0',
      source: 'test',
      id,
      titre_fr: id,
      versions: [
        {
          seuil,
          titre: '',
          phrases: [{ zh, pinyin: '', fr: '' }],
          glose: {},
          ...(explique
            ? { expliques: [{ zh: explique, pinyin: '', fr: '', en: '', explication_fr: '', explication_en: '', caracteres: explique, pistes: [] }] }
            : {})
        }
      ]
    });
    const lesContes = new Map([
      ['xue-yi', fable('xue-yi', 'jour25', '人学弈。', '弈')],
      ['yu-gong', fable('yu-gong', '255', '人的。')]
    ]);
    const entrees = bibliotheque(
      [
        { id: 'yu-gong', titre_fr: 'yu-gong', seuils: ['255'], fichier: '' },
        { id: 'xue-yi', titre_fr: 'xue-yi', seuils: ['jour25'], fichier: '' }
      ],
      lesContes,
      new Set(['人']),
      {},
      false,
      []
    );
    /* sur le chemin : 人 au jour 1, 学 au 25, 的 au 29 */
    const chemin = joursDuChemin(
      Object.entries({ 人: 1, 学: 25, 的: 29 }).map(([c, jour]) => ({ jour, brique: c, composes: [], non_reconcilie: false }))
    );
    const jours = ouvertures(entrees, lesContes, new Set(['人']), chemin);
    expect(jours).toEqual({ 'yu-gong': 29, 'xue-yi': 25 });
    const aVenir: ConteAVenir[] = [
      { id: 'yu-gong', titre: '愚公移山', jour: jours['yu-gong'] },
      { id: 'xue-yi', titre: '学弈', jour: jours['xue-yi'], motif: 'goban' }
    ];
    const r = route(ETAPES, positionDuJour(au(22, true)));
    const b = prochainesBornes(bornesDevant(ETAPES, r, [], aVenir));
    /* le jour 20 n'est pas réconcilié : du 22 au 25, trois étapes */
    expect(b.map((x) => [x.titre, x.ecart, dansCourt(x.ecart), x.genre === 'conte' ? x.motif : null])).toEqual([
      ['学弈', 3, 'dans 3 j', 'goban'],
      ['愚公移山', 7, 'dans 7 j', null]
    ]);
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
    expect(menu).toMatch(/\{#if demain && jourDemain !== null && quandDemain !== ''\}/);
  });

  it('au menu, « Dans 3 j » vient de la règle et du pipeline, jamais écrit en dur', () => {
    const menu = source('Menu.svelte');
    expect(menu).toContain('prochaineBrique(p.droits, acces, p.day, jourParcours(p))');
    expect(menu).toContain('quandMenu(textes, k.dans)');
    expect(menu).not.toMatch(/>Demain : /);
  });

  it('au rythme gratuit, la route dit la prochaine brique et le bout du chemin gratuit par le pipeline', () => {
    expect(ecran).toContain('quandPierre(textes, suivante.dans)');
    expect(ecran).toContain('textes.route_fin');
    expect(ecran).toContain('suiteDuChemin(textes, p.parcours)');
  });
});

describe('au rythme gratuit (story 7.5)', () => {
  /** La journée préparée au rythme gratuit, avec ou sans brique nouvelle. */
  function gratuit(p: Progress, revue: { c: string; lecon: number } | null = null): Progress {
    return {
      ...p,
      journee: {
        jour: p.day,
        rythme: 'gratuit',
        sansBrique: revue === null ? null : { raison: 'rythme', ...revue }
      }
    };
  }

  it('un jour du chemin n’est plus un jour : la suite se dit en étapes', () => {
    expect(positionDuJour(gratuit(au(12, false)))).toEqual({ jour: 12, faite: false, sur: false });
    expect(positionDuJour(gratuit(au(12, true)))).toEqual({ jour: 12, faite: true, sur: false });
    expect(dansCourt(3, positionDuJour(gratuit(au(12, false))).sur)).toBe('dans 3 étapes');
  });

  it('un jour sans brique nouvelle, la pierre du jour est la dernière étape faite', () => {
    const p = gratuit(au(12, false), { c: 'b4', lecon: 4 });
    expect(positionDuJour(p)).toEqual({ jour: 11, faite: true, sur: false });
    const r = route(ETAPES, positionDuJour(p));
    expect(r.jour?.jour).toBe(11);
    expect(r.pierres.find((x) => x.ecart === 1)?.jour).toBe(12);
  });

  it('seule la pierre suivante porte un compte en jours du calendrier, celui de la règle', () => {
    const r = route(ETAPES, positionDuJour(gratuit(au(12, true))));
    expect(pierreSuivante(r, { jour: '2026-10-16', dans: 3 }, true)).toEqual({ jour: 13, dans: 3 });
    /* Au rythme complet, rien : la pierre suivante est demain. */
    expect(pierreSuivante(r, { jour: '2026-10-14', dans: 1 }, false)).toBeNull();
    expect(pierreSuivante(r, null, true)).toBeNull();
  });

  it('au bout du chemin, « fin du chemin gratuit » sans Wenlu complet', () => {
    const fin = route(ETAPES, positionDuJour(au(28, true)));
    expect(boutDuChemin(fin, false)).toBe('gratuit');
    expect(boutDuChemin(fin, true)).toBe('parcours');
    expect(boutDuChemin(route(ETAPES, positionDuJour(au(12, true))), false)).toBeNull();
  });
});

describe('la borne des examens (story 8.6)', () => {
  /* Trois caractères par étape : le 50e entre au jour 17, le 75e plus loin, le 100e hors du chemin. */
  const examens: ExamenAVenir[] = [
    { id: 'xianshi', hz: '县试', palier: 50, titre: '县试 · 50 caractères', ligne: "l'examen du district" },
    { id: 'yueke-75', hz: '月课', palier: 75, titre: '月课 · 75 caractères', ligne: 'la leçon du mois' },
    { id: 'fushi', hz: '府试', palier: 100, titre: '府试 · 100 caractères', ligne: "l'examen de la préfecture" }
  ];
  const trophees = (...n: number[]): SeuilLire[] => n.map((x) => ({ n: x, obtenu: false }));
  const ecran = readFileSync(new URL('Route.svelte', import.meta.url), 'utf8');

  it('l’examen est une borne au jour du chemin où entre son Ne caractère, son nom dessiné sur la stèle', () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const b = bornesDevant(ETAPES, r, [], [], examens);
    expect(b.map((x) => [x.titre, x.jour, x.ecart])).toEqual([
      ['县试 · 50 caractères', 17, 5],
      ['月课 · 75 caractères', jourDuSeuil(ETAPES, 75), 13]
    ]);
    expect(b[0]).toMatchObject({ genre: 'examen', hz: '县试', suivant: true, passe: false });
    /* le nom se dessine depuis ses traits, gravé de haut en bas sur la stèle */
    expect(ecran).toMatch(/\{#each \[\.\.\.b\.hz\] as c, j \(c \+ j\)\}[\s\S]{0,200}dessin\(c, 18, 'var\(--indigo\)'\)/);
    expect(ecran).toContain('remplir(tr.examen, { examen: e.hz, n: nombre(e.palier) })');
  });

  it('l’examen suivant est toujours l’une des deux bornes, à la place de la seconde si deux autres tombent avant lui', () => {
    const r = route(ETAPES, positionDuJour(au(2, true)));
    const contes: ConteAVenir[] = [{ id: 'a', titre: '愚公移山', jour: 14 }];
    const toutes = bornesDevant(ETAPES, r, trophees(10), contes, examens);
    expect(toutes.map((x) => x.titre)).toEqual(['10 caractères', '愚公移山', '县试 · 50 caractères', '月课 · 75 caractères']);
    expect(prochainesBornes(toutes).map((x) => x.titre)).toEqual(['10 caractères', '县试 · 50 caractères']);
    /* sans examen à annoncer, les deux premières */
    expect(prochainesBornes(bornesDevant(ETAPES, r, trophees(10), contes)).map((x) => x.titre)).toEqual([
      '10 caractères',
      '愚公移山'
    ]);
    /* le suivant déjà parmi les deux : rien ne bouge ; jamais plus que demandé */
    const proche = prochainesBornes(bornesDevant(ETAPES, route(ETAPES, positionDuJour(au(12, true))), [], contes, examens));
    expect(proche.map((x) => x.titre)).toEqual(['愚公移山', '县试 · 50 caractères']);
    expect(prochainesBornes(toutes, 1).map((x) => x.titre)).toEqual(['县试 · 50 caractères']);
  });

  it('une seule stèle quand il tombe sur un seuil du trophée Lire', () => {
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const b = bornesDevant(ETAPES, r, trophees(50, 100), [], examens);
    expect(b.filter((x) => x.jour === 17)).toHaveLength(1);
    expect(b.find((x) => x.jour === 17)).toMatchObject({ genre: 'examen', titre: '县试 · 50 caractères', trophee: true });
    expect(b.some((x) => x.genre === 'lire' && x.seuil === 50)).toBe(false);
    /* un trophée déjà obtenu : la stèle est celle de l'examen seul */
    const obtenu = bornesDevant(ETAPES, r, [{ n: 50, obtenu: true }], [], examens);
    expect(obtenu.find((x) => x.jour === 17)).toMatchObject({ genre: 'examen', trophee: false });
  });

  it('le prochain examen, son jour fait sans ses caractères lus, dit le compte des lus, rien d’estimé', () => {
    const r = route(ETAPES, positionDuJour(au(21, true)));
    const b = bornesDevant(ETAPES, r, [], [], examens);
    expect(b[0]).toMatchObject({ id: 'xianshi', passe: true, suivant: true });
    expect(b[0].ecart).toBeLessThan(0);
    /* un examen plus loin dont le jour est fait ne s'annonce pas */
    const plusLoin = bornesDevant(ETAPES, route(ETAPES, positionDuJour(au(28, true))), [], [], examens);
    expect(plusLoin.map((x) => x.titre)).toEqual(['县试 · 50 caractères']);
    expect(ecran).toContain('remplir(tr.lus, { lus: nombre(lus), n: nombre(b.palier) })');
    /* au-delà du parcours, rien ne se calcule, rien ne s'affiche */
    expect(bornesDevant(ETAPES, r, [], [], [examens[2]])).toEqual([]);
  });

  it('l’examen à passer se dresse devant la pierre du jour, « examen ouvert », et la suite n’a pas de compte', () => {
    const apres = "après l'examen";
    expect(quand(3, true, apres)).toBe(apres);
    expect(quand(1, true, apres)).toBe(apres);
    expect(quand(0, true, apres)).toBe("aujourd'hui");
    expect(quand(-1, true, apres)).toBe('déjà lu');
    expect(dansCourt(9, true, apres)).toBe(apres);
    const r = route(ETAPES, positionDuJour(au(12, true)));
    const b = bornesDevant(ETAPES, r, [], [], examens.slice(1));
    const ouvert = { titre: '县试 · 50 caractères', ligne: 'examen ouvert' };
    expect(ligneBorne(1, b, true, ouvert)).toEqual({
      tete: 'Prochaine borne :',
      titre: '县试 · 50 caractères',
      suite: 'examen ouvert.'
    });
    expect(ligneBorne(4, b, true, ouvert)?.titre).toBe('县试 · 50 caractères');
    expect(ligneBorne(-1, b, true, ouvert)).toBeNull();
    expect(quandExamen(ETAPES, r, examens[0], true)).toEqual({ etat: 'ouvert' });
    /* l'écran : la stèle entre la pierre du jour et la suivante, la route sans compte ni prochaine brique */
    expect(ecran).toContain('const b = PLACES_XY[ICI + 1];');
    expect(ecran).toContain('{tr.ouvert}');
    expect(ecran).toContain('quand(x.ecart, sur, apres)');
    expect(ecran).toContain('dansCourt(b.ecart, sur, apres)');
    expect(ecran).toContain('gratuit && ouvert === null');
  });

  it('au rythme gratuit et en rattrapage, la borne d’examen se dit en étapes', () => {
    const r = route(ETAPES, { jour: 12, faite: true, sur: false });
    const b = bornesDevant(ETAPES, r, [], [], examens);
    expect(dansCourt(b[0].ecart, false)).toBe('dans 5 étapes');
    expect(quandExamen(ETAPES, r, examens[0], false)).toEqual({ etat: 'dans', ecart: 5 });
    expect(quandExamen(ETAPES, route(ETAPES, positionDuJour(au(21, true))), examens[0], false)).toEqual({ etat: 'lus' });
    expect(quandExamen(ETAPES, r, examens[2], false)).toBeNull();
  });

  it('pas de sceau aux trophées pour un examen', () => {
    const code = (f: string): string =>
      readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/.*$/gm, '');
    expect(code('trophees.ts')).not.toMatch(/examen|yueke|月课|县试/);
    expect(code('Rewards.svelte')).not.toMatch(/examen|yueke|月课|县试/);
  });
});
