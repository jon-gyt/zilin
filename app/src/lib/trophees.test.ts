import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import { VERSION_DONNEES, type Famille, type Index } from './content';
import { caracteresLus } from './foret';
import { CADEAUX, PALIERS } from './serie';
import { emptyProgress, traceAchevee, type Progress } from './session';
import { SEUIL_DEBLOCAGE, newCard, schedule, stability, type ReviewCard } from './srs';
import {
  FAMILLES_TROPHEES,
  FAMILLE_MIN,
  PIEGE_SUITE,
  PINCEAU_BRIQUES,
  SCEAUX_MIN,
  SEUILS_LIRE,
  UNITES,
  famillesDesSceaux,
  ligneEntree,
  meilleureSuite,
  prochain,
  suiteEnCours,
  tableau,
  tropheesContes,
  tropheesLire,
  tropheesObjets,
  tropheesPieges,
  tropheesSerie,
  type ContenuTrophees,
  type Tableau
} from './trophees';

/* ---------- le contenu : l'export versionné, lu sur disque ---------- */

const indexExport = JSON.parse(
  readFileSync(new URL(`../../public/data/${VERSION_DONNEES}/index.json`, import.meta.url), 'utf8')
) as Index;

const famillesExport: Famille[] = indexExport.familles.map(
  (f) =>
    JSON.parse(
      readFileSync(
        new URL(`../../public/data/${VERSION_DONNEES}/${f.fichier}`, import.meta.url),
        'utf8'
      )
    ) as Famille
);

const pairesExport: unknown = JSON.parse(
  readFileSync(
    new URL(`../../public/data/${VERSION_DONNEES}/${indexExport.paires}`, import.meta.url),
    'utf8'
  )
);

const contenuExport: ContenuTrophees = {
  index: indexExport,
  familles: famillesExport,
  paires: pairesExport
};

/* ---------- la progression ---------- */

const JOUR = '2026-03-02';
const TJ = new Date(`${JOUR}T08:00:00Z`);
const JUSTE = { correct: true, tries: 0, seconds: 2 };

/** Une carte sue : la stabilité passe le seuil de déblocage de `srs.ts`. */
const sue = (c: string): ReviewCard => schedule(newCard(c, TJ), JUSTE, TJ).card;
/** Une carte neuve : elle existe, rien n'est acquis. */
const neuve = (c: string): ReviewCard => newCard(c, TJ);

function progression(extra: Partial<Progress> = {}): Progress {
  return { ...emptyProgress(JOUR), parcours: 'lire', ...extra };
}

/** Une carte sue dont l'historique est donné : une lecture par note, une minute d'écart. */
function avecHistorique(c: string, notes: readonly Rating[], depart = 0): ReviewCard {
  const k = sue(c);
  return {
    ...k,
    history: notes.map((rating, i) => ({
      at: new Date(TJ.getTime() + (depart + i) * 60_000),
      rating: rating as ReviewCard['history'][number]['rating'],
      due: TJ
    }))
  };
}

const tous = (t: Tableau) => t.sections.flatMap((s) => s.trophees);

/* ---------- 1. lire ---------- */

describe('les trophées de lecture', () => {
  it('suivent les seuils : 10, 50, 100, puis 255, 505 et 1555 du français', () => {
    expect([...SEUILS_LIRE]).toEqual([10, 50, 100, 255, 505, 1555]);
    const t = tropheesLire(62);
    expect(t.map((x) => x.obtenu)).toEqual([true, true, false, false, false, false]);
    expect(t[2].progres).toBe('62 / 100');
    expect(t[3].nom).toBe('Premier seuil');
    expect(t[3].detail).toMatch(/premier seuil du français/);
  });

  it('comptent les caractères lus comme Ma forêt, avec le même seuil de stabilité', () => {
    const cs = famillesExport.flatMap((f) => [f.racine.c, ...f.fiches.map((x) => x.c)]);
    const lus = [...new Set(cs)].slice(0, 12).map(sue);
    const p = progression({ cartes: [...lus, neuve('朋')] });
    const t = tableau(p, contenuExport);
    const lire = t.sections.find((s) => s.famille === 'lire')!;
    const attendu = caracteresLus(famillesExport, p.cartes);
    expect(attendu).toBe(12);
    expect(lire.trophees[0].actuel).toBe(attendu);
    expect(lire.trophees[0].obtenu).toBe(true);
    expect(lire.trophees[1].obtenu).toBe(false);
    /* Une carte sous le seuil de déblocage n'est pas lue. */
    expect(stability(neuve('朋'))).toBeLessThan(SEUIL_DEBLOCAGE);
  });
});

/* ---------- 2. sceaux de famille ---------- */

describe('les sceaux de famille', () => {
  it('se posent quand toute la famille est lue', () => {
    const yue = famillesExport.find((f) => f.racine.c === '月')!;
    const cs = [...new Set([yue.racine.c, ...yue.fiches.map((x) => x.c)])];
    const presque = progression({ cartes: cs.slice(0, -1).map(sue) });
    const sceau = (p: Progress) =>
      tous(tableau(p, contenuExport)).find((x) => x.id === 'sceau-月')!;
    expect(sceau(presque).obtenu).toBe(false);
    expect(sceau(presque).progres).toBe(`${cs.length - 1} / ${cs.length}`);
    expect(sceau(presque).detail).toContain(cs[cs.length - 1]);
    const complete = progression({ cartes: cs.map(sue) });
    expect(sceau(complete).obtenu).toBe(true);
    expect(sceau(complete).sceau).toBe('月');
  });

  it('montrent les familles commencées et quelques suivantes du parcours, pas toutes', () => {
    const p = progression({ cartes: [sue('月'), neuve('日')] });
    const s = tableau(p, contenuExport).sections.find((x) => x.famille === 'sceaux')!;
    /* L'export compte plus de deux cents familles (239 avec 皿, brique de 温) ; le tableau n'en montre qu'une poignée. */
    expect(indexExport.familles.length).toBeGreaterThan(200);
    expect(s.total).toBeGreaterThanOrEqual(SCEAUX_MIN);
    expect(s.total).toBeLessThan(20);
    expect(s.total % 3).toBe(0);
    /* Les commencées d'abord, dans l'ordre du parcours ; les suivantes après. */
    expect(s.trophees.slice(0, 2).map((x) => x.sceau)).toEqual(['月', '日']);
    expect(s.trophees[2].detail).toMatch(/jour \d+ du parcours/);
  });

  it("ne scellent pas une famille d'un seul caractère : ce serait le compte des lus", () => {
    const seules = famillesExport.filter((f) => new Set([f.racine.c, ...f.fiches.map((x) => x.c)]).size < FAMILLE_MIN);
    expect(seules.length).toBeGreaterThan(0);
    const cartes = seules.map((f) => sue(f.racine.c));
    const montrees = famillesDesSceaux(famillesExport, cartes, new Map());
    expect(montrees.some((f) => seules.includes(f))).toBe(false);
  });

  it('gardent toutes les familles commencées, même nombreuses', () => {
    const premier = new Map<string, number>();
    const cartes = famillesExport
      .filter((f) => f.fiches.some((x) => x.c !== f.racine.c))
      .slice(0, 20)
      .map((f) => neuve(f.racine.c));
    const montrees = famillesDesSceaux(famillesExport, cartes, premier);
    expect(montrees.length).toBeGreaterThanOrEqual(20);
  });
});

/* ---------- 3. pièges déjoués ---------- */

describe('les pièges déjoués', () => {
  const paires = [['天', '夫']];
  const justes = (n: number) => Array.from({ length: n }, () => Rating.Good);

  it('attendent que les deux caractères soient acquis', () => {
    const [t] = tropheesPieges(paires, [sue('天')]);
    expect(t.progres).toBe('pas encore vus');
    expect(t.suivi).toBe(false);
    expect(t.obtenu).toBe(false);
  });

  it('se gagnent après dix lectures de suite sans confusion, les deux caractères mêlés', () => {
    const cartes = [avecHistorique('天', justes(5)), avecHistorique('夫', justes(5), 5)];
    const [t] = tropheesPieges(paires, cartes);
    expect(t.obtenu).toBe(true);
    const [moins] = tropheesPieges(paires, [
      avecHistorique('天', justes(5)),
      avecHistorique('夫', justes(4), 5)
    ]);
    expect(moins.obtenu).toBe(false);
    expect(moins.progres).toBe(`9 / ${PIEGE_SUITE}`);
  });

  it("repartent de zéro après une erreur, mais un piège déjoué le reste", () => {
    expect(suiteEnCours([true, true, false, true])).toBe(1);
    expect(meilleureSuite([true, true, false, true])).toBe(2);
    const erreurApres = [
      avecHistorique('天', [...justes(10), Rating.Again]),
      avecHistorique('夫', [], 20)
    ];
    expect(tropheesPieges(paires, erreurApres)[0].obtenu).toBe(true);
    const erreurAvant = [avecHistorique('天', [...justes(6), Rating.Again, ...justes(3)])];
    const [t] = tropheesPieges(paires, [...erreurAvant, sue('夫')]);
    expect(t.obtenu).toBe(false);
    expect(t.actuel).toBe(3);
  });

  it('viennent de paires.json, trios compris', () => {
    const t = tableau(progression(), contenuExport);
    const s = t.sections.find((x) => x.famille === 'pieges')!;
    const brut = (pairesExport as { paires: string[][] }).paires;
    expect(s.total).toBe(brut.length);
    expect(s.trophees.map((x) => x.sceau)).toEqual(brut.map((g) => g.join('')));
    expect(s.trophees.every((x) => x.progres === 'pas encore vus')).toBe(true);
  });
});

/* ---------- 4. contes ---------- */

describe('les contes', () => {
  it("restent verrouillés avec leur seuil : leur lecture n'est pas encore enregistrée", () => {
    const index: Index = {
      ...indexExport,
      contes: [{ id: 'lievre', titre_fr: 'Le lièvre et la souche', seuils: [405, 255], fichier: 'x' }]
    };
    const t = tropheesContes(index, 300);
    expect(t.map((x) => x.sceau)).toEqual(['255', '405']);
    expect(t.every((x) => !x.obtenu && !x.suivi)).toBe(true);
    expect(t[1].progres).toBe('au seuil 405');
    expect(t[0].progres).toBe('à lire');
  });

  it("font une section vide tant que l'export n'en porte aucun", () => {
    const s = tableau(progression(), contenuExport).sections.find((x) => x.famille === 'contes')!;
    expect(indexExport.contes).toEqual([]);
    expect(s.total).toBe(0);
  });
});

/* ---------- 5. objets de Tao ---------- */

describe('les objets de Tao', () => {
  it('donnent le pinceau à dix briques tracées, chacune comptée une fois', () => {
    const neuf = '人大天日月木水火土'.split('');
    expect(tropheesObjets(neuf)[0].obtenu).toBe(false);
    expect(tropheesObjets([...neuf, '人'])[0].progres).toBe(`9 / ${PINCEAU_BRIQUES}`);
    expect(tropheesObjets([...neuf, '口'])[0].obtenu).toBe(true);
  });

  it('ne comptent au pinceau que les tracés achevés, pas les tracés proposés', () => {
    const dix = '人大天日月木水火土口'.split('');
    const pinceau = (p: Progress) =>
      tous(tableau(p, contenuExport)).find((x) => x.id === 'objet-pinceau')!;
    const proposes = progression({ tracees: dix });
    expect(pinceau(proposes).actuel).toBe(0);
    expect(pinceau(proposes).obtenu).toBe(false);
    let acheves = progression({ tracees: dix });
    for (const c of dix) acheves = traceAchevee(acheves, c);
    expect(pinceau(acheves).obtenu).toBe(true);
  });

  it('verrouillent la lanterne et le bol tant que rien ne les suit', () => {
    const [, lanterne, bol] = tropheesObjets([]);
    expect(lanterne.suivi).toBe(false);
    expect(bol.suivi).toBe(false);
    expect(lanterne.obtenu || bol.obtenu).toBe(false);
  });
});

/* ---------- 6. série ---------- */

describe('la série', () => {
  it('reprend les quatre paliers et les cadeaux de serie.ts', () => {
    const jours = Array.from({ length: 12 }, (_, i) =>
      new Date(Date.parse('2026-02-19T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)
    );
    const t = tropheesSerie(jours, JOUR);
    expect(t.map((x) => x.cible)).toEqual([...PALIERS]);
    expect(t[0].obtenu).toBe(true);
    expect(t[1].progres).toBe('12 / 30');
    expect(t[2].detail).toContain(CADEAUX[100].titre);
  });
});

/* ---------- la règle absolue ---------- */

describe('chaque trophée se gagne en lisant, jamais au temps passé', () => {
  it("n'a aucune unité qui soit une durée", () => {
    const t = tableau(progression(), contenuExport);
    for (const x of tous(t)) expect(UNITES).toContain(x.unite);
    for (const u of UNITES) expect(u).not.toMatch(/minute|seconde|heure|temps|durée|duree/);
  });

  it('ne bouge pas avec le budget, le temps de réponse ou les sessions de plus', () => {
    const cartes = [
      avecHistorique('天', Array.from({ length: 10 }, () => Rating.Good)),
      sue('夫'),
      sue('月'),
      sue('日')
    ];
    const base = progression({
      cartes,
      budget: 5,
      tracees: ['人'],
      joursTravailles: ['2026-02-28', '2026-03-01']
    });
    const long = progression({
      cartes: cartes.map((k) =>
        /* Même réponses, plus rapides : Facile au lieu de Bien. */
        k.id === '天' ? { ...k, history: k.history.map((h) => ({ ...h, rating: Rating.Easy as typeof h.rating })) } : k
      ),
      budget: 20,
      tracees: ['人'],
      /* Trois sessions le même jour : une graine, jamais plus. */
      joursTravailles: ['2026-02-28', '2026-03-01', '2026-03-01', '2026-03-01'],
      revisions: Array.from({ length: 40 }, () => ({ c: '月', correct: true, tries: 0, seconds: 90 }))
    });
    const a = tous(tableau(base, contenuExport)).map((x) => [x.id, x.obtenu, x.actuel]);
    const b = tous(tableau(long, contenuExport)).map((x) => [x.id, x.obtenu, x.actuel]);
    expect(b).toEqual(a);
  });

  it('ne lit ni durée, ni minutes, ni budget, ni horloge dans ses règles', () => {
    const source = readFileSync(new URL('trophees.ts', import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const mot of ['seconds', 'minutes', 'budget', 'Date.now', 'new Date()', 'revisions']) {
      expect(code).not.toContain(mot);
    }
  });

  it("n'a ni points, ni classement, ni doré, ni ombre, ni dégradé à l'écran", () => {
    for (const f of ['Rewards.svelte', 'TropheesEntree.svelte']) {
      const brut = readFileSync(new URL(f, import.meta.url), 'utf8');
      /* Les commentaires disent justement ce qui est interdit : on lit le reste. */
      const s = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
      expect(s).not.toMatch(/gradient|shadow|gold|\bdor[ée]|classement|\bpoints?\b|\bscore/i);
      /* Le cinabre ne marque que l'élément ajouté et la position sur le chemin. */
      expect(s).not.toContain('--zhu');
    }
  });
});

/* ---------- le tableau ---------- */

describe('le tableau', () => {
  it('a six sections, dans l’ordre, et compte ce qui est obtenu', () => {
    const p = progression({ cartes: '月朋有日明人从十早口古'.split('').map(sue) });
    const t = tableau(p, contenuExport);
    expect(t.sections.map((s) => s.famille)).toEqual([...FAMILLES_TROPHEES]);
    expect(t.total).toBe(t.sections.reduce((n, s) => n + s.total, 0));
    expect(t.obtenus).toBe(tous(t).filter((x) => x.obtenu).length);
    expect(t.obtenus).toBeGreaterThanOrEqual(1);
  });

  it('propose le prochain parmi ce que la progression suit, le plus avancé', () => {
    const t = tableau(progression({ cartes: '月朋有日明人'.split('').map(sue) }), contenuExport);
    expect(t.prochain).not.toBeNull();
    expect(t.prochain!.suivi).toBe(true);
    expect(t.prochain!.obtenu).toBe(false);
    const autres = tous(t).filter((x) => x.suivi && !x.obtenu);
    expect(Math.max(...autres.map((x) => x.part))).toBe(t.prochain!.part);
    expect(prochain([])).toBeNull();
  });

  it("se dit en une ligne dans Ma forêt : « N sur M · le prochain … »", () => {
    const t = tableau(progression(), contenuExport);
    expect(ligneEntree(t)).toMatch(/^0 sur \d+ · le prochain/);
    expect(ligneEntree(t)).toBe(`0 sur ${t.total} · le prochain à 10 caractères lus`);
  });

  it('est la porte de Ma forêt, à la place des récompenses', () => {
    const foret = readFileSync(new URL('Forest.svelte', import.meta.url), 'utf8');
    expect(foret).toContain('<TropheesEntree');
    expect(foret).not.toContain('>Récompenses</button>');
  });
});
