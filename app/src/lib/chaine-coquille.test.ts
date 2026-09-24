/**
 * Story 4b.3 : la chaîne et la coquille, jouées sur l'export servi avec l'app.
 *
 * Un test par règle : chaque maillon contient le précédent ; tout caractère proposé
 * est acquis (et de l'export, pour la chaîne) ; la coquille ne piège qu'avec un groupe
 * de `paires.json` et ne pose que des messages rédigés dans le pipeline ; la notation
 * est celle de `srs.grade`, jamais une auto-évaluation ; Tao lit la coquille par-dessus
 * l'épaule.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  JEUX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  TOURS_COQUILLE,
  chaine,
  chaines,
  contient,
  corpusDeJeu,
  decouper,
  disponibles,
  fini,
  maillonsPossibles,
  postureDuJeu,
  remplacants,
  repondre,
  signes,
  tour,
  type CorpusJeux,
  type Manche,
  type Tour
} from './jeux';
import { lireMessage, loadCoquilles, type MessageCoquille } from './coquilles';
import { lirePaires, memePaire } from './questions';
import { grade, SEUIL_DEBLOCAGE, type Outcome } from './srs';
import { VERSION_DONNEES, type Famille, type Index } from './content';

const lire = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const dossier = `../../public/data/${VERSION_DONNEES}`;
const index = lire(`${dossier}/index.json`) as Index;
const familles = index.familles.map((f) => lire(`${dossier}/${f.fichier}`) as Famille);
const traits = index.familles.flatMap((f) =>
  Object.keys((lire(`${dossier}/${f.traits}`) as { traits: Record<string, unknown> }).traits)
);
const paires = lirePaires(lire(`${dossier}/paires.json`));
const brut = lire(`${dossier}/coquilles.json`) as { coquilles: unknown[] };
const coquilles = brut.coquilles.flatMap((v) => {
  const q = lireMessage(v);
  return q === null ? [] : [q];
});

/** Les caractères que le parcours Lire a posés jusqu'au jour `n` compris. */
function acquisAuJour(n: number): string[] {
  return index.parcours.lire.jours
    .filter((j) => j.jour <= n)
    .flatMap((j) => [j.brique, ...j.composes])
    .filter((c): c is string => typeof c === 'string' && c !== '');
}

function corpusAuJour(n: number, en_plus = ''): CorpusJeux {
  const cs = [...new Set([...acquisAuJour(n), ...en_plus])];
  return corpusDeJeu({
    fiches: familles.flatMap((f) => f.fiches),
    familles,
    paires,
    traits,
    coquilles,
    cartes: cs.map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE + 1 }))
  });
}

const outcome = (o: Partial<Outcome> = {}): Outcome => ({ correct: true, tries: 0, seconds: 3, ...o });

function jouer(m: Manche, choix: (t: Tour) => string): Manche {
  let courante = m;
  while (!fini(courante)) {
    const t = tour(courante);
    if (t === null) break;
    courante = repondre(courante, choix(t), outcome()).manche;
  }
  return courante;
}

/* ---------- les messages de coquilles.json ---------- */

describe('les messages de la coquille servis avec l’app', () => {
  it('sont rédigés dans le pipeline, de six à douze caractères, chacun avec ses pièges', () => {
    expect(coquilles.length).toBeGreaterThanOrEqual(40);
    expect(coquilles.length).toBeLessThanOrEqual(60);
    for (const q of coquilles) {
      const s = signes(q.message);
      expect(s.length).toBeGreaterThanOrEqual(MESSAGE_MIN);
      expect(s.length).toBeLessThanOrEqual(MESSAGE_MAX);
      expect(q.fr).not.toBe('');
      for (const p of q.pieges) {
        expect(s).toContain(p);
        expect(paires.some((g) => g.includes(p))).toBe(true);
      }
    }
  });

  it('se lisent prudemment : un piège absent du message tombe, un message sans piège aussi', () => {
    expect(lireMessage({ message: '今天天气很好。', pieges: ['天', '日'], fr: 'x' })?.pieges).toEqual(['天']);
    expect(lireMessage({ message: '今天天气很好。', pieges: ['日'] })).toBeNull();
    expect(lireMessage({ message: '今天天气很好。', pieges: [] })).toBeNull();
    expect(lireMessage(null)).toBeNull();
  });

  it('se chargent depuis l’export, sans doublon', async () => {
    const texte = readFileSync(new URL(`${dossier}/coquilles.json`, import.meta.url), 'utf8');
    const fetchFn = (async () => new Response(texte)) as typeof fetch;
    const lu = await loadCoquilles('x.json', fetchFn);
    expect(lu.coquilles).toEqual(coquilles);
    expect(new Set(lu.coquilles.map((q) => q.id)).size).toBe(lu.coquilles.length);
    expect(lu.racines['天']).toBeTruthy();
  });

  it('gardent leur ponctuation, qui se lit et ne se touche pas', () => {
    expect(decouper('今天有雨，明天也有雨。')).toEqual({
      signes: [...'今天有雨明天也有雨'],
      ponctuation: ['', '', '', '，', '', '', '', '', '。']
    });
  });
});

/* ---------- la coquille ---------- */

describe('la coquille, sur le parcours Lire', () => {
  it('se tait tant que 夫 n’est pas acquis : on ne piège qu’avec deux caractères lus', () => {
    const avant = corpusAuJour(53);
    expect(avant.acquis).toContain('天');
    expect(avant.acquis).not.toContain('夫');
    expect(JEUX.coquille.preparer(avant, 'g')).toBeNull();
    expect(disponibles(avant, 'g')).not.toContain('coquille');
  });

  const corpus = corpusAuJour(60);
  const m = JEUX.coquille.preparer(corpus, '2026-09-24/coquille/0');
  if (!m) throw new Error('manche attendue');

  it('s’ouvre avec 夫 et pose des messages rédigés, entiers, avec leur traduction', () => {
    expect(m.tours).toHaveLength(TOURS_COQUILLE);
    const ids = new Set(coquilles.map((q) => q.id));
    for (const t of m.tours) {
      const original = t.choix.map((x, i) => (x === t.reponse[0] ? t.c : x)).join('');
      expect(ids.has(original)).toBe(true);
      const q = coquilles.find((x) => x.id === original) as MessageCoquille;
      expect(t.traduction).toBe(q.fr);
      expect(t.ponctuation).toHaveLength(t.choix.length);
      expect(q.pieges).toContain(t.c);
    }
  });

  it('ne montre que de l’acquis, l’intrus compris', () => {
    for (const t of m.tours) {
      for (const x of t.choix) {
        expect(corpus.acquis).toContain(x);
        expect(traits).toContain(x);
      }
    }
  });

  it('ne piège qu’avec une paire de paires.json, un seul caractère faux par message', () => {
    const q = { fiches: [], decompositions: {}, acquis: [], paires };
    for (const t of m.tours) {
      const [intrus] = t.reponse;
      expect(memePaire(t.c, intrus, q)).toBe(true);
      expect(t.choix.filter((x) => x === intrus)).toHaveLength(1);
      expect(t.aussi).toEqual([intrus]);
    }
    /* Hors des paires, aucun intrus : 我 n'a pas de jumeau. */
    expect(remplacants('我', ['我'], corpus)).toEqual([]);
    /* Sans paires, pas de coquille du tout. */
    expect(JEUX.coquille.preparer({ ...corpus, paires: [] }, 'g')).toBeNull();
  });

  it('ne pose un message que si tous ses caractères sont acquis', () => {
    /* Au jour 60, 很 (jour 138) n'est pas acquis : aucun message qui le porte. */
    for (const t of m.tours) expect(t.choix).not.toContain('很');
    const plus = corpusAuJour(60, '很');
    const toutes = [0, 1, 2, 3, 4, 5, 6, 7].flatMap(
      (k) => JEUX.coquille.preparer(plus, `g/${k}`)?.tours ?? []
    );
    expect(toutes.some((t) => t.choix.includes('很'))).toBe(true);
  });

  it('note automatiquement, par grade : l’intrus touché, ou la réponse montrée', () => {
    const t = tour(m) as Tour;
    const juste = repondre(m, t.reponse[0], outcome({ seconds: 4 }));
    expect(juste.correct).toBe(true);
    expect(juste.evenements.map((e) => e.c)).toEqual([t.c, t.reponse[0]]);
    expect(juste.note).toBe(grade(juste.evenement));
    expect(juste.note).toBe(Rating.Easy);
    const autre = t.choix.find((x) => x !== t.reponse[0]) as string;
    const faux = repondre(m, autre, outcome({ seconds: 4 }));
    expect(faux.montre).toBe(true);
    expect(faux.note).toBe(Rating.Again);
    /* Ni vie, ni point : la manche continue, le constat compte des faits. */
    const finie = jouer(faux.manche, (x) => x.reponse[0]);
    expect(JEUX.coquille.constat(finie)).not.toMatch(/point|score|vie|record|classement|coffre/i);
  });

  it('met Tao en posture de lecture : elle lit le message par-dessus l’épaule', () => {
    expect(postureDuJeu('coquille')).toBe('lecture');
    expect(postureDuJeu('chaine')).toBe('jeu');
    expect(postureDuJeu('devinette')).toBe('jeu');
  });
});

/* ---------- la chaîne ---------- */

describe('la chaîne, sur le parcours Lire', () => {
  const corpus = corpusAuJour(40);
  const m = JEUX.chaine.preparer(corpus, '2026-09-24/chaine/0');
  if (!m) throw new Error('manche attendue');

  it('est valide : chaque maillon contient le précédent', () => {
    const toutes = chaines(corpus, '2026-09-24/chaine/0');
    for (const suite of toutes) {
      expect(suite.length).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < suite.length; k++) expect(contient(suite[k], suite[k - 1], corpus)).toBe(true);
    }
    for (const t of m.tours) {
      const s = t.suite ?? [];
      expect(contient(t.c, s[s.length - 1], corpus)).toBe(true);
    }
    /* Au jour 90, 母 → 每 → 海 : trois maillons, la plus longue d'abord. */
    const plus = corpusAuJour(90);
    expect(chaine(plus, 'g')).toEqual(['母', '每', '海']);
  });

  it('enchaîne plusieurs chaînes sans caractère commun quand la première bute', () => {
    const toutes = chaines(corpus, '2026-09-24/chaine/0');
    expect(toutes.length).toBeGreaterThan(1);
    const vus = toutes.flat();
    expect(new Set(vus).size).toBe(vus.length);
    /* Au jour 40, les décompositions plates ne donnent que des chaînes de deux : la
       manche en pose plusieurs, pas une seule question. */
    expect(m.tours.length).toBeGreaterThan(1);
    expect(m.tours.length).toBeLessThanOrEqual(JEUX.chaine.tours);
  });

  it('ne propose que de l’acquis, et une seule proposition prolonge la chaîne', () => {
    for (const t of m.tours) {
      const s = t.suite ?? [];
      expect(t.choix.filter((x) => contient(x, s[s.length - 1], corpus))).toEqual([t.c]);
      for (const x of [...t.choix, ...s]) expect(corpus.acquis).toContain(x);
    }
  });

  it('ne traverse que l’export : un caractère acquis hors de l’export n’y entre pas', () => {
    expect(corpus.exportes?.length).toBeGreaterThan(0);
    const avecIntrus: CorpusJeux = {
      ...corpus,
      acquis: [...corpus.acquis, '吞'],
      decompositions: { ...corpus.decompositions, 吞: ['天', '口'] },
      traits: [...corpus.traits, '吞']
    };
    expect(maillonsPossibles(avecIntrus)).not.toContain('吞');
    for (const t of JEUX.chaine.preparer(avecIntrus, 'g')?.tours ?? []) expect(t.choix).not.toContain('吞');
  });

  it('note chaque choix comme une question, par grade, et dit le leurre pris', () => {
    const t = tour(m) as Tour;
    const juste = repondre(m, t.c, outcome({ seconds: 2 }));
    expect(juste.note).toBe(grade(juste.evenement));
    const leurre = t.choix.find((x) => x !== t.c) as string;
    const faux = repondre(m, leurre, outcome({ seconds: 2 }));
    expect(faux.evenement.leurres).toEqual([leurre]);
    expect(faux.note).toBe(Rating.Again);
    /* Un maillon manqué ne coupe pas la chaîne : pas de vie à perdre. */
    expect(fini(faux.manche)).toBe(m.tours.length === 1);
  });
});
