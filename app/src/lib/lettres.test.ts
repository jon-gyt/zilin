/**
 * Les lettres de Que (story 4b.8) : lecture de l'export, règle d'arrivée, progression.
 * Une règle par test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { unites } from './lecture';
import {
  ANNONCE_LETTRE,
  caracteresDeLettre,
  dimancheDe,
  entreesLettres,
  fusionnerLettres,
  lettreAnnoncee,
  lettreQuiArrive,
  lireLettres,
  lireLettresNotees,
  noterLettreLue,
  ouvrirLettreDuJour,
  versionDeLettre,
  type Lettre,
  type LettreNotee
} from './lettres';
import { emptyProgress, fromJSON, toJSON, type Progress } from './session';
import { newCard } from './srs';

/* Les fichiers servis avec l'app, tels que `wenlu export` les écrit. */
const lire = (f: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/data/0.1.0/${f}`, import.meta.url), 'utf8'));

const APERCU = lireLettres(lire('apercu/lettres.json'));
/* Les mêmes lettres, comme si elles étaient relues : c'est la règle d'arrivée qu'on teste. */
const RELUES: Lettre[] = APERCU.map(({ statut: _statut, ...l }) => l);

/** Tous les caractères des lettres 1 à n : ce qu'un parcours aurait posé. */
function posesJusqua(n: number): Set<string> {
  return new Set(RELUES.filter((l) => l.n <= n).flatMap(caracteresDeLettre));
}

/* 2026-09-20 est un dimanche. */
const DIMANCHE = '2026-09-20';
const LUNDI = '2026-09-21';
const MARDI = '2026-09-22';
const DIMANCHE_SUIVANT = '2026-09-27';

function avecCartes(p: Progress, caracteres: Iterable<string>): Progress {
  const now = new Date('2026-09-01T08:00:00Z');
  return { ...p, cartes: [...caracteres].map((c) => newCard(c, now)) };
}

describe("l'export des lettres", () => {
  it('les douze lettres à relire sont dans l\'aperçu, marquées, dans l\'ordre du feuilleton', () => {
    expect(APERCU.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(APERCU.every((l) => l.statut === 'a_relire')).toBe(true);
    expect(APERCU.map((l) => l.jour)).toEqual(APERCU.map((l) => 7 * l.n));
  });

  it("l'export principal ne porte que les lettres relues, aucune aujourd'hui", () => {
    const index = lire('index.json') as { lettres: string };
    expect(index.lettres).toBe('lettres.json');
    expect(lireLettres(lire('lettres.json'))).toEqual([]);
  });

  it('chaque lettre compte 40 à 120 caractères et finit par une question', () => {
    for (const l of APERCU) {
      const n = l.phrases.flatMap((p) => Array.from(p.zh)).filter((c) => /\p{Script=Han}/u.test(c)).length;
      expect(n).toBeGreaterThanOrEqual(40);
      expect(n).toBeLessThanOrEqual(120);
      expect(l.phrases[l.phrases.length - 1].zh.endsWith('？')).toBe(true);
    }
  });

  it('le lecteur touche chaque caractère avec son pinyin et son sens', () => {
    for (const l of APERCU) {
      for (const ph of l.phrases) {
        for (const u of unites(ph, l.glose).filter((x) => x.touchable)) {
          expect(u.pinyin, `${l.n} ${u.texte}`).not.toBeNull();
          expect(u.sens, `${l.n} ${u.texte}`).not.toBeNull();
        }
      }
    }
  });

  it('une lettre se lit comme un conte, sans titre ni seuil, et garde son statut', () => {
    const v = versionDeLettre(APERCU[0]);
    expect(v.titre).toBe('');
    expect(v.statut).toBe('a_relire');
    expect(versionDeLettre(RELUES[0]).statut).toBeUndefined();
  });

  it('une lettre relue passe devant la lettre à relire du même rang', () => {
    const fusion = fusionnerLettres([RELUES[1]], APERCU.slice(0, 3));
    expect(fusion.map((l) => [l.n, l.statut ?? 'relu'])).toEqual([
      [1, 'a_relire'],
      [2, 'relu'],
      [3, 'a_relire']
    ]);
  });
});

describe("la règle d'arrivée : une lettre par semaine, le dimanche", () => {
  it('la semaine commence le dimanche', () => {
    expect(dimancheDe('2026-09-24')).toBe(DIMANCHE);
    expect(dimancheDe(DIMANCHE)).toBe(DIMANCHE);
    expect(dimancheDe('2026-09-26')).toBe(DIMANCHE);
  });

  it('la première lettre arrive le dimanche, tous ses caractères posés', () => {
    expect(lettreQuiArrive(RELUES, [], posesJusqua(1), DIMANCHE, [])?.n).toBe(1);
  });

  it('dimanche manqué : elle arrive à la première session de la semaine, pas à la suivante', () => {
    expect(lettreQuiArrive(RELUES, [], posesJusqua(1), LUNDI, ['2026-09-18'])?.n).toBe(1);
    expect(lettreQuiArrive(RELUES, [], posesJusqua(1), MARDI, [LUNDI])).toBeNull();
  });

  it('un caractère pas encore posé la fait attendre', () => {
    const presque = posesJusqua(1);
    presque.delete(caracteresDeLettre(RELUES[0])[0]);
    expect(lettreQuiArrive(RELUES, [], presque, DIMANCHE, [])).toBeNull();
  });

  it('une seule par semaine, dans l\'ordre du feuilleton', () => {
    const une: LettreNotee[] = [{ n: 1, arrivee: DIMANCHE, lue: null }];
    expect(lettreQuiArrive(RELUES, une, posesJusqua(12), '2026-09-23', [])).toBeNull();
    expect(lettreQuiArrive(RELUES, une, posesJusqua(12), DIMANCHE_SUIVANT, [])?.n).toBe(2);
    /* la lettre 2 n'arrive pas avant la 1, même si ses caractères sont posés */
    expect(lettreQuiArrive(RELUES.slice(1), [], posesJusqua(12), DIMANCHE, [])).toBeNull();
  });

  it('une lettre non lue n\'empêche pas la suivante, et ne se perd pas', () => {
    const une: LettreNotee[] = [{ n: 1, arrivee: DIMANCHE, lue: null }];
    expect(lettreQuiArrive(RELUES, une, posesJusqua(2), DIMANCHE_SUIVANT, [])?.n).toBe(2);
  });

  it('une lettre à relire n\'arrive jamais', () => {
    expect(lettreQuiArrive(APERCU, [], posesJusqua(12), DIMANCHE, [])).toBeNull();
  });

  it("l'arrivée se note dans la progression, une fois", () => {
    const p = avecCartes(emptyProgress(DIMANCHE), posesJusqua(1));
    const q = ouvrirLettreDuJour(p, RELUES, DIMANCHE);
    expect(q.lettres).toEqual([{ n: 1, arrivee: DIMANCHE, lue: null }]);
    expect(ouvrirLettreDuJour(q, RELUES, DIMANCHE)).toBe(q);
  });
});

describe('lire une lettre', () => {
  const arrivee: LettreNotee[] = [{ n: 1, arrivee: DIMANCHE, lue: null }];

  it('la case Lire l\'annonce la semaine où elle arrive, tant qu\'elle n\'est pas lue', () => {
    expect(lettreAnnoncee(arrivee, '2026-09-23')?.n).toBe(1);
    expect(lettreAnnoncee(arrivee, DIMANCHE_SUIVANT)).toBeNull();
    expect(lettreAnnoncee([{ ...arrivee[0], lue: LUNDI }], LUNDI)).toBeNull();
    expect(ANNONCE_LETTRE).toBe('Une lettre de Que');
  });

  it('une lettre lue le note une fois, sans point ; une lettre pas arrivée ne se note pas', () => {
    const p = { ...emptyProgress(LUNDI), lettres: arrivee };
    const q = noterLettreLue(p, 1, LUNDI);
    expect(q.lettres[0].lue).toBe(LUNDI);
    expect(noterLettreLue(q, 1, MARDI)).toBe(q);
    expect(noterLettreLue(p, 2, LUNDI)).toBe(p);
  });

  it('Lire montre les lettres arrivées ; le mode relecture les montre toutes, sans compte', () => {
    const e = entreesLettres(RELUES, arrivee, LUNDI);
    expect(e.map((x) => [x.lettre.n, x.nouvelle, x.sansCompte])).toEqual([[1, true, false]]);
    const toutes = entreesLettres(fusionnerLettres(RELUES.slice(0, 1), APERCU), arrivee, LUNDI, true);
    expect(toutes).toHaveLength(12);
    expect(toutes[1].horsArrivee && toutes[1].sansCompte).toBe(true);
    expect(entreesLettres(APERCU, [], LUNDI)).toEqual([]);
  });

  it("les lettres notées passent par l'export et l'import JSON ; absentes, aucune", () => {
    const p = { ...emptyProgress(LUNDI), lettres: [{ n: 1, arrivee: DIMANCHE, lue: LUNDI }] };
    expect(fromJSON(toJSON(p), LUNDI).lettres).toEqual(p.lettres);
    const ancien = JSON.parse(toJSON(emptyProgress(LUNDI))) as Record<string, unknown>;
    delete ancien.lettres;
    expect(fromJSON(JSON.stringify(ancien), LUNDI).lettres).toEqual([]);
    expect(lireLettresNotees([{ n: 0, arrivee: DIMANCHE }, { n: 2, arrivee: 'hier' }, 'x'])).toEqual([]);
  });
});
