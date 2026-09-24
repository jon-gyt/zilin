import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FICHIER_FAMILLE_DEPART,
  FICHIER_MOT_DEPART,
  LECON,
  PARCOURS,
  QUESTIONS,
  RYTHMES,
  apresSplash,
  briques,
  estOperateur,
  ficheDe,
  fichesDepart,
  ligneRythme,
  loadMot,
  points,
  signes,
  type FicheDepart,
  type MotDepart
} from './premiere';
import { ETIQUETTES, glose, type Famille } from './content';
import {
  ETAPES_DEPART,
  ajouterCartes,
  budgetNewBricks,
  departNext,
  emptyProgress,
  finDepart,
  fromJSON,
  markDone,
  openDay,
  setBudget,
  setDepart,
  setParcours,
  toJSON,
  type EtapeDepart,
  type Progress
} from './session';
import { isNew } from './srs';
import { comptes } from './tao';

const JOUR = '2026-03-02';
const MAINTENANT = new Date('2026-03-02T08:30:00Z');

const famille = JSON.parse(
  readFileSync(new URL('../../public/data/demo/familles/人.json', import.meta.url), 'utf8')
) as Famille;

const mot = JSON.parse(
  readFileSync(new URL('../../public/data/demo/textes/天天.json', import.meta.url), 'utf8')
) as MotDepart;

const traits = JSON.parse(
  readFileSync(new URL('../../public/strokes-demo.json', import.meta.url), 'utf8')
) as Record<string, unknown>;

/** La maquette fait foi. Les balises de mise en gras ne comptent pas dans le texte. */
const maquette = readFileSync(
  new URL('../../../maquettes/zilin-maquette.html', import.meta.url),
  'utf8'
).replace(/<\/?b>/g, '');

/** Les 514 composants de la norme, lus dans la table versionnée du pipeline. */
const composants = new Set(
  readFileSync(new URL('../../../data/sources/gf0014-2009/composants.tsv', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('sequence'))
    .map((l) => l.split('\t')[2])
);

const fiches = fichesDepart(famille);

/* ---------- 1. le premier lancement ---------- */

describe("l'ouverture", () => {
  it('envoie une progression vierge à la première session', () => {
    const p = emptyProgress(JOUR);
    expect(p.premiere).toBe(true);
    expect(p.premiereVue).toBe('f1');
    expect(apresSplash(p)).toBe('premiere');
  });

  it("envoie à Aujourd'hui au deuxième lancement, la première session faite", () => {
    const p = finDepart(emptyProgress(JOUR), JOUR, MAINTENANT, briques(famille));
    expect(p.premiere).toBe(false);
    expect(apresSplash(p)).toBe('home');
  });

  it('tient le drapeau au rechargement, et ne repropose pas la première session', () => {
    const p = finDepart(emptyProgress(JOUR), JOUR, MAINTENANT, briques(famille));
    expect(apresSplash(fromJSON(toJSON(p), JOUR))).toBe('home');
    expect(apresSplash(fromJSON(toJSON(p), '2026-03-09'))).toBe('home');
  });

  it("considère faite la première session d'une progression exportée avant ce drapeau", () => {
    const ancien = JSON.stringify({ version: 1, day: JOUR, days: 3, lastWorked: JOUR, done: [] });
    expect(fromJSON(ancien, JOUR).premiere).toBe(false);
    const jamaisOuvert = JSON.stringify({ version: 1, day: JOUR, done: [] });
    expect(fromJSON(jamaisOuvert, JOUR).premiere).toBe(true);
  });
});

/* ---------- 2. l'enchaînement des écrans ---------- */

describe('la première session', () => {
  it('enchaîne les quatre écrans de la leçon, le bilan, puis les deux questions', () => {
    expect(LECON).toEqual(['f1', 'f2', 'f3', 'f4', 'f5']);
    expect(QUESTIONS).toEqual(['objectif', 'rythme']);
    const vues: EtapeDepart[] = ['f1'];
    for (let v = departNext('f1'); v !== null; v = departNext(v)) vues.push(v);
    expect(vues).toEqual([...ETAPES_DEPART]);
    expect(departNext('rythme')).toBeNull();
  });

  it('montre 人, puis 大, puis 天, puis le mot', () => {
    expect(ficheDe(famille, 'f1')?.c).toBe('人');
    expect(ficheDe(famille, 'f2')?.c).toBe('大');
    expect(ficheDe(famille, 'f3')?.c).toBe('天');
    expect(ficheDe(famille, 'f4')).toBeNull();
    expect(ficheDe(null, 'f1')).toBeNull();
    expect(briques(famille)).toEqual(['人', '大', '天']);
    expect(mot.mot).toBe('天天');
  });

  it('avance d\'un point par écran : cinq pour la leçon, trois pour les questions', () => {
    expect(LECON.map((v) => points(v))).toEqual([
      { total: 5, index: 0 },
      { total: 5, index: 1 },
      { total: 5, index: 2 },
      { total: 5, index: 3 },
      { total: 5, index: 4 }
    ]);
    expect(points('objectif')).toEqual({ total: 3, index: 1 });
    expect(points('rythme')).toEqual({ total: 3, index: 2 });
  });
});

/* ---------- 3. la reprise au pas exact ---------- */

describe('la reprise', () => {
  it("repart à l'écran exact après un « Quitter » au milieu", () => {
    const p = setDepart(emptyProgress(JOUR), 'f3');
    const relu = fromJSON(toJSON(p), JOUR);
    expect(relu.premiere).toBe(true);
    expect(relu.premiereVue).toBe('f3');
    expect(apresSplash(relu)).toBe('premiere');
  });

  it("tient d'une journée à l'autre : la première session ne recommence pas au début", () => {
    const p = openDay(setDepart(emptyProgress(JOUR), 'f4'), '2026-03-05');
    expect(p.premiereVue).toBe('f4');
    expect(p.premiere).toBe(true);
  });

  it('ignore un écran inconnu et reprend au premier', () => {
    const brut = JSON.stringify({ version: 1, day: JOUR, premiereVue: 'f9' });
    expect(fromJSON(brut, JOUR).premiereVue).toBe('f1');
  });
});

/* ---------- 4. les deux questions ---------- */

describe('les deux questions', () => {
  it('enregistre le parcours choisi, et le relit', () => {
    expect(emptyProgress(JOUR).parcours).toBeNull();
    for (const choix of PARCOURS) {
      const p = setParcours(emptyProgress(JOUR), choix.id);
      expect(p.parcours).toBe(choix.id);
      expect(fromJSON(toJSON(p), JOUR).parcours).toBe(choix.id);
    }
    expect(fromJSON(JSON.stringify({ version: 1, parcours: 'rien' }), JOUR).parcours).toBeNull();
  });

  it('enregistre le rythme choisi dans le budget de la session', () => {
    for (const choix of RYTHMES) {
      const p = setBudget(emptyProgress(JOUR), choix.id);
      expect(p.budget).toBe(choix.id);
      expect(fromJSON(toJSON(p), JOUR).budget).toBe(choix.id);
    }
  });

  it('propose les trois objectifs de la maquette, avec ses mots', () => {
    expect(PARCOURS.map((c) => c.id)).toEqual(['lire', 'hsk', 'voyage']);
    for (const c of PARCOURS) {
      expect(maquette).toContain(c.t);
      expect(maquette).toContain(c.d);
    }
    expect(maquette).toContain('Pourquoi le chinois ?');
    expect(maquette).toContain("On adapte l'ordre des familles à ce que tu veux lire en premier.");
  });

  it('propose cinq, dix ou vingt minutes, et dit ce que le budget contient vraiment', () => {
    expect(RYTHMES.map((c) => c.id)).toEqual([5, 10, 20]);
    for (const c of RYTHMES) expect(maquette).toContain(c.t);
    /* Une seule brique nouvelle par session de dix minutes : la règle produit, pas la maquette. */
    expect(ligneRythme(5)).toBe('Révisions seulement');
    expect(ligneRythme(10)).toBe('Révisions et une brique nouvelle');
    expect(ligneRythme(20)).toBe('Révisions et deux briques nouvelles');
    expect(budgetNewBricks(10)).toBe(1);
    expect(maquette).toContain('Combien de temps par jour ?');
  });
});

/* ---------- 5. la fin : les cartes, Tao, le drapeau ---------- */

describe('la fin de la première session', () => {
  const fini = finDepart(emptyProgress(JOUR), JOUR, MAINTENANT, briques(famille));

  it('crée une carte de révision par brique vue, neuve et due tout de suite', () => {
    expect(fini.cartes.map((c) => c.id)).toEqual(['人', '大', '天']);
    for (const c of fini.cartes) {
      expect(isNew(c)).toBe(true);
      expect(c.card.due.getTime()).toBe(MAINTENANT.getTime());
      expect(c.history).toEqual([]);
    }
  });

  it('ne crée jamais deux cartes pour le même caractère', () => {
    const encore = ajouterCartes(fini, ['人', '大', '天', '住'], MAINTENANT);
    expect(encore.cartes.map((c) => c.id)).toEqual(['人', '大', '天', '住']);
    expect(ajouterCartes(fini, ['人'], MAINTENANT)).toBe(fini);
  });

  it('note trois leçons et une lecture pour Tao, et rien de plus', () => {
    expect(comptes(fini.tao.activites, JOUR)).toEqual({ lecon: 3, lecture: 1 });
    expect(fini.tao.croissance).toBe(3 * 5 + 3);
  });

  it('baisse le drapeau, remet la première vue et laisse la journée faite', () => {
    expect(fini.premiere).toBe(false);
    expect(fini.premiereVue).toBe('f1');
    /* Le premier jour arrive au menu en état « fait » : la session complète commence demain. */
    expect(fini.done).toEqual([true, true, true, true, true, true]);
    expect(fini.days).toBe(1);
    expect(fini.lastWorked).toBe(JOUR);
    expect(fini.joursTravailles).toEqual([JOUR]);
    expect(fini.jourParcours).toBe(1);
  });

  it('relit les cartes exportées à la date près', () => {
    const relu = fromJSON(toJSON(fini), JOUR);
    expect(relu.cartes.map((c) => c.id)).toEqual(['人', '大', '天']);
    expect(relu.cartes[0].card.due.getTime()).toBe(MAINTENANT.getTime());
    expect(relu.cartes[0].card.stability).toBe(fini.cartes[0].card.stability);
  });

  it('rend zéro carte pour une progression exportée avant les cartes', () => {
    const p: Progress = markDone(emptyProgress(JOUR), 0, JOUR);
    const sansCartes = JSON.parse(toJSON(p)) as Record<string, unknown>;
    delete sansCartes.cartes;
    expect(fromJSON(JSON.stringify(sansCartes), JOUR).cartes).toEqual([]);
  });
});

/* ---------- 6. le contenu, recopié de la maquette ---------- */

/** Tout ce qui s'affiche d'une fiche, et doit donc venir de la source citée. */
function textes(f: FicheDepart): string[] {
  return [f.pinyin, f.fr, f.origine_fr, f.guide_fr ?? '', ...f.mots.flatMap((m) => [m.hanzi, m.pinyin, m.fr])].filter(
    (t) => t !== ''
  );
}

describe('la famille de la première session', () => {
  it('est versionnée, cite sa source et la norme de décomposition', () => {
    expect(famille.version).not.toBe('');
    expect(famille.source).toBe('maquettes/zilin-maquette.html');
    expect(fiches.map((f) => f.c)).toEqual(['人', '大', '天']);
    expect(famille.racine.c).toBe('人');
  });

  it('ne contient aucun texte écrit hors de sa source', () => {
    for (const f of fiches) for (const t of textes(f)) expect(maquette).toContain(t);
    expect(maquette).toContain(famille.racine.origine);
    expect(maquette).toContain(famille.racine.fr);
    expect(maquette).toContain(famille.racine.pinyin);
  });

  it('étiquette chaque fiche, attesté ou mnémotechnique', () => {
    for (const f of fiches) expect(Object.keys(ETIQUETTES)).toContain(f.etiquette);
    expect(Object.keys(ETIQUETTES)).toContain(famille.racine.etiquette);
  });

  it('ne décompose que sur des composants de la norme GF 0014-2009', () => {
    /* 人, 大 et 天 sont eux-mêmes des composants de la norme : ils ne se décomposent pas. */
    for (const f of fiches) {
      expect(f.parts).toEqual([f.c]);
      expect(f.nouveau).toEqual([]);
      for (const part of f.parts) expect(composants).toContain(part);
    }
  });

  it("garde l'étymologie au-dessus de la décomposition, et n'y met le cinabre que sur l'ajout", () => {
    const [ren, da, tian] = fiches;
    expect(ren.formule).toBeNull();
    expect(da.formule).toEqual({ tokens: ['人', '→', '大'], nouveau: [] });
    expect(tian.formule).toEqual({ tokens: ['一', '+', '大', '=', '天'], nouveau: [0] });
    /* Le seul jeton en cinabre de la formule de 天 est le trait ajouté. */
    expect(tian.formule?.nouveau.map((i) => tian.formule?.tokens[i])).toEqual(['一']);
    for (const f of fiches) {
      for (const [i, jeton] of (f.formule?.tokens ?? []).entries()) {
        if (estOperateur(jeton)) {
          expect(f.formule?.nouveau).not.toContain(i);
        } else {
          expect(maquette).toContain(`data-g="${jeton}"`);
        }
      }
    }
  });

  it('se dessine depuis les données de traits, jamais depuis une police', () => {
    for (const f of fiches) {
      expect(Object.keys(traits)).toContain(f.c);
      expect(f.traits).toEqual([]);
      expect(f.medianes).toEqual([]);
      for (const jeton of f.formule?.tokens ?? []) {
        if (!estOperateur(jeton)) expect(Object.keys(traits)).toContain(jeton);
      }
    }
  });

  it("n'embarque aucun audio : il n'y en a pas encore", () => {
    for (const f of fiches) expect(f.audio).toBeNull();
  });
});

describe('le mot lu', () => {
  it('est versionné et cite sa source', () => {
    expect(mot.version).not.toBe('');
    expect(mot.source).toBe('maquettes/zilin-maquette.html');
  });

  it('est le mot de la maquette, avec sa glose et sa traduction', () => {
    expect(mot.mot).toBe('天天');
    expect(mot.c).toBe('天');
    expect(maquette).toContain('>天天<');
    expect(maquette).toContain(`${mot.mot} ${mot.pinyin}, ${mot.traduction}.`);
    expect(signes(mot).map((s) => s.c).join('')).toBe(mot.mot);
    for (const s of signes(mot)) expect(glose(s)).toBe('tiān, ciel, jour');
  });

  it('pose la question de la maquette, avec ses quatre réponses et sa correction', () => {
    expect(maquette).toContain(mot.question);
    expect(mot.choix).toHaveLength(4);
    for (const c of mot.choix) expect(maquette).toContain(`>${c}</button>`);
    expect(mot.choix[mot.bonne]).toBe('chaque jour');
    expect(maquette).toContain(`data-ok="1">${mot.choix[mot.bonne]}`);
    for (const t of [mot.indice, mot.juste, mot.faux]) {
      expect(t).not.toBe('');
      expect(maquette).toContain(t);
    }
  });

  it('se dessine depuis les données de traits', () => {
    for (const s of signes(mot)) expect(Object.keys(traits)).toContain(s.c);
    expect(mot.audio).toBeNull();
  });
});

/* ---------- 7. le chargeur du mot ---------- */

describe('le chargeur du mot', () => {
  const reponse = (ok: boolean, corps: unknown): Response =>
    ({ ok, status: ok ? 200 : 404, json: async () => corps }) as Response;

  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return reponse(true, mot);
    };
    const lu = await loadMot(FICHIER_MOT_DEPART, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER_MOT_DEPART}`]);
    expect(lu.mot).toBe(mot.mot);
    expect(lu.choix).toEqual(mot.choix);
    expect(FICHIER_FAMILLE_DEPART).toBe('data/demo/familles/人.json');
  });

  it('refuse un fichier absent', async () => {
    const faux: typeof fetch = async () => reponse(false, null);
    await expect(loadMot(FICHIER_MOT_DEPART, faux)).rejects.toThrow('introuvable');
  });

  it('refuse un fichier sans mot ni réponses', async () => {
    const faux: typeof fetch = async () => reponse(true, { version: '1' });
    await expect(loadMot(FICHIER_MOT_DEPART, faux)).rejects.toThrow('illisible');
  });
});
