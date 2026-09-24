import { describe, it, expect } from 'vitest';
import { fromJSON, noterJourTravaille, emptyProgress, toJSON, type Progress } from './session';
import {
  CADEAUX,
  GRAINES_PAR_ARBRE,
  LETTRES,
  PALIERS,
  PHRASE_REPOS,
  RESERVE_MAX,
  ajouteJours,
  etatSerie,
  libelleJours,
  libelleReserve,
  messageCadeau,
  messageProchain,
  messageSemaine,
  normaliser,
  rangDansLaSemaine,
  remiseApplicable,
  semaine,
  type Palier
} from './serie';

/** Un lundi, pour que la semaine de la maquette se lise du premier coup. */
const LUNDI = '2026-03-09';
const MERCREDI = '2026-03-11';

/** `n` journées travaillées d'affilée à partir de `depart`. */
const suite = (depart: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => ajouteJours(depart, i));

/** Le dernier jour d'une suite de `n` journées. */
const dernier = (depart: string, n: number): string => ajouteJours(depart, n - 1);

describe('la semaine', () => {
  it('va du lundi au dimanche', () => {
    expect(rangDansLaSemaine(LUNDI)).toBe(0);
    expect(rangDansLaSemaine(ajouteJours(LUNDI, 6))).toBe(6);
    expect(semaine(ajouteJours(LUNDI, 4))[0]).toBe(LUNDI);
    expect(semaine(LUNDI)).toHaveLength(LETTRES.length);
  });
});

describe('la série', () => {
  it("compte les jours d'affilée, aujourd'hui compris", () => {
    const s = etatSerie(suite(LUNDI, 5), dernier(LUNDI, 5));
    expect(s.jours).toBe(5);
    expect(s.graines).toBe(5);
    expect(libelleJours(s)).toBe("jours d'affilée");
  });

  it("ne casse pas parce qu'aujourd'hui n'est pas encore travaillé", () => {
    const s = etatSerie(suite(LUNDI, 5), ajouteJours(LUNDI, 5));
    expect(s.jours).toBe(5);
  });

  it('ne compte rien quand rien n’a été travaillé', () => {
    const s = etatSerie([], LUNDI);
    expect(s).toMatchObject({ jours: 0, graines: 0, arbres: 0, reserve: 0, record: 0, palier: null });
    expect(libelleJours(s)).toBe("jour d'affilée");
  });

  it('se moque de l’ordre et des doublons', () => {
    const jours = suite(LUNDI, 4);
    const melange = [jours[2], jours[0], jours[2], jours[3], jours[1]];
    expect(normaliser(melange)).toEqual(jours);
    expect(etatSerie(melange, dernier(LUNDI, 4)).jours).toBe(4);
  });
});

describe('le jour de repos', () => {
  it('couvre une journée sautée et la série continue', () => {
    /* Sept journées font un jour de repos ; il couvre le trou du huitième jour. */
    const jours = [...suite(LUNDI, GRAINES_PAR_ARBRE), ajouteJours(LUNDI, GRAINES_PAR_ARBRE + 1)];
    const s = etatSerie(jours, ajouteJours(LUNDI, GRAINES_PAR_ARBRE + 1));
    expect(s.jours).toBe(GRAINES_PAR_ARBRE + 1);
    expect(s.reserve).toBe(0);
  });

  it('se gagne une fois par semaine complète de sept jours travaillés', () => {
    expect(etatSerie(suite(LUNDI, 6), dernier(LUNDI, 6)).reserve).toBe(0);
    expect(etatSerie(suite(LUNDI, 7), dernier(LUNDI, 7)).reserve).toBe(1);
    expect(etatSerie(suite(LUNDI, 14), dernier(LUNDI, 14)).reserve).toBe(2);
  });

  it('ne dépasse jamais deux en réserve', () => {
    const s = etatSerie(suite(LUNDI, 70), dernier(LUNDI, 70));
    expect(s.reserve).toBe(RESERVE_MAX);
    expect(libelleReserve(s)).toBe('jours de repos en réserve');
  });

  it('se présente comme une protection, jamais comme une punition', () => {
    expect(PHRASE_REPOS).toContain('protège');
    expect(PHRASE_REPOS).toContain('Jamais plus de deux');
  });
});

describe('sans réserve', () => {
  it('la série repart de zéro, puis recompte à partir du jour travaillé', () => {
    /* Trois journées ne donnent pas encore de jour de repos : le trou casse la série. */
    const jours = [...suite(LUNDI, 3), ajouteJours(LUNDI, 4)];
    const s = etatSerie(jours, ajouteJours(LUNDI, 4));
    expect(s.jours).toBe(1);
    expect(s.graines).toBe(4);
    expect(s.record).toBe(3);
  });

  it('ne dit rien de ce qui a été manqué : aucun compteur, aucun message de perte', () => {
    const s = etatSerie([...suite(LUNDI, 3), ajouteJours(LUNDI, 9)], ajouteJours(LUNDI, 9));
    expect(Object.keys(s).sort()).toEqual(
      [
        'arbres',
        'atteints',
        'graines',
        'grainesSemaine',
        'jours',
        'palier',
        'prochain',
        'record',
        'reserve',
        'restant',
        'semaine'
      ].sort()
    );
    const textes = [
      messageProchain(s),
      messageSemaine(s),
      libelleJours(s),
      libelleReserve(s),
      PHRASE_REPOS
    ].join(' ');
    for (const mot of ['perd', 'rat', 'manqu', 'cassé', 'zéro', 'dommage']) {
      expect(textes.toLowerCase()).not.toContain(mot);
    }
  });
});

describe('les graines de la semaine', () => {
  it('sont les journées travaillées du lundi au dimanche', () => {
    const s = etatSerie(suite(LUNDI, 3), MERCREDI);
    expect(s.semaine.map((g) => g.lettre)).toEqual([...LETTRES]);
    expect(s.semaine.map((g) => g.travaille)).toEqual([true, true, true, false, false, false, false]);
    expect(s.semaine.map((g) => g.aujourdhui)).toEqual([false, false, true, false, false, false, false]);
    expect(s.semaine.map((g) => g.futur)).toEqual([false, false, false, true, true, true, true]);
    expect(s.grainesSemaine).toBe(3);
  });

  it('ne comptent pas les graines de la semaine précédente', () => {
    const s = etatSerie(suite(ajouteJours(LUNDI, -7), 10), ajouteJours(LUNDI, 2));
    expect(s.graines).toBe(10);
    expect(s.grainesSemaine).toBe(3);
  });
});

describe("l'arbre", () => {
  it('pousse à la septième graine, et pas avant', () => {
    expect(etatSerie(suite(LUNDI, 6), dernier(LUNDI, 6)).arbres).toBe(0);
    expect(etatSerie(suite(LUNDI, 7), dernier(LUNDI, 7)).arbres).toBe(1);
    expect(etatSerie(suite(LUNDI, 15), dernier(LUNDI, 15)).arbres).toBe(2);
  });

  it('se dit en graines plantées, jamais en points', () => {
    const s = etatSerie(suite(LUNDI, 3), MERCREDI);
    expect(messageSemaine(s)).toBe('3 graines plantées cette semaine. Sept graines font un arbre.');
  });
});

describe('les paliers', () => {
  it('sont ceux du brief : 7, 30, 100 et 365 jours', () => {
    expect([...PALIERS]).toEqual([7, 30, 100, 365]);
  });

  it('se remettent exactement au jour atteint, avec le cadeau du brief', () => {
    const attendus: Record<Palier, string> = {
      7: 'Un jour de Wenlu complet',
      30: 'Une semaine de Wenlu complet',
      100: 'Wenlu complet à vie, moins 30 %',
      365: 'Wenlu complet à vie, offert'
    };
    for (const palier of PALIERS) {
      const s = etatSerie(suite(LUNDI, palier), dernier(LUNDI, palier));
      expect(s.jours).toBe(palier);
      expect(s.palier).toBe(palier);
      expect(s.atteints).toContain(palier);
      expect(CADEAUX[palier].titre).toBe(attendus[palier]);
      expect(messageCadeau(palier)).toContain(CADEAUX[palier].court);
      /* Le palier du jour parle par sa carte : pas de message d'attente en même temps. */
      expect(messageProchain(s)).toBe('');
    }
  });

  it('annoncent le suivant tant qu’il n’est pas atteint', () => {
    const s = etatSerie(suite(LUNDI, 5), dernier(LUNDI, 5));
    expect(s.prochain).toBe(7);
    expect(s.restant).toBe(2);
    expect(messageProchain(s)).toBe(
      "Que t'attend au 7e jour avec un jour de Wenlu complet. Encore 2 jours."
    );
  });

  it('restent acquis même si la série repart', () => {
    const s = etatSerie([...suite(LUNDI, 7), ajouteJours(LUNDI, 20)], ajouteJours(LUNDI, 20));
    expect(s.jours).toBe(1);
    expect(s.atteints).toEqual([7]);
    expect(s.record).toBe(7);
  });

  it('s’arrêtent après le 365e jour', () => {
    const s = etatSerie(suite(LUNDI, 365), dernier(LUNDI, 365));
    expect(s.palier).toBe(365);
    expect(s.prochain).toBeNull();
    expect(s.restant).toBe(0);
  });
});

describe('la remise du 100e jour', () => {
  it("vaut pour l'achat à vie", () => {
    expect(remiseApplicable(100, 'vie')).toBe(true);
  });

  it("ne vaut pas pour l'abonnement mensuel", () => {
    expect(remiseApplicable(100, 'mensuel')).toBe(false);
  });

  it("n'existe à aucun autre palier", () => {
    for (const palier of PALIERS) {
      if (palier !== 100) expect(remiseApplicable(palier, 'vie')).toBe(false);
    }
  });
});

describe('les journées travaillées dans la progression', () => {
  it('se plantent une fois par journée close', () => {
    let p: Progress = emptyProgress(LUNDI);
    p = noterJourTravaille(p, LUNDI);
    p = noterJourTravaille(p, LUNDI);
    p = noterJourTravaille(p, MERCREDI);
    expect(p.joursTravailles).toEqual([LUNDI, MERCREDI]);
    expect(fromJSON(toJSON(p), MERCREDI).joursTravailles).toEqual([LUNDI, MERCREDI]);
  });

  it('se reconstituent d’une progression exportée avant la série', () => {
    const avant = JSON.stringify({
      version: 1,
      day: MERCREDI,
      done: [true],
      budget: 10,
      days: 2,
      lastWorked: MERCREDI,
      tao: { croissance: 2, activites: [{ jour: LUNDI, type: 'lecon' }], collection: [] }
    });
    const p = fromJSON(avant, MERCREDI);
    expect(p.joursTravailles).toEqual([LUNDI, MERCREDI]);
    expect(etatSerie(p.joursTravailles, MERCREDI).graines).toBe(2);
  });

  it('écartent une entrée aberrante', () => {
    const cassé = JSON.stringify({ ...emptyProgress(LUNDI), joursTravailles: [LUNDI, 3, 'hier', LUNDI] });
    expect(fromJSON(cassé, LUNDI).joursTravailles).toEqual([LUNDI]);
  });
});
