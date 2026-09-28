import { describe, expect, it } from 'vitest';
import {
  ACCES_WEB,
  JOURS_COMPLETS,
  annonceDuRythme,
  briqueDuJour,
  briqueGratuiteLibre,
  droitsVides,
  lireDroits,
  lundiDe,
  noterAnnonce,
  noterBascule,
  noterBriqueGratuite,
  prochaineBrique,
  recevoirCadeau,
  rythme,
  sessionDePlus,
  wenluComplet,
  type Acces,
  type Cadeau,
  type EtatDroits
} from './droits';

/** L'app iOS, sans achat ; puis avec. */
const IOS: Acces = { web: false, achat: false };
const ACHAT: Acces = { web: false, achat: true };

/* 2026-10-05 est un lundi. */
const LUNDI = '2026-10-05';
const MARDI = '2026-10-06';
const MERCREDI = '2026-10-07';
const JEUDI = '2026-10-08';
const VENDREDI = '2026-10-09';
const SAMEDI = '2026-10-10';
const DIMANCHE = '2026-10-11';
const LUNDI_SUIVANT = '2026-10-12';

/** Au-delà des trente premiers jours du chemin. */
const APRES = JOURS_COMPLETS + 10;

function avec(briques: string[], plus: Partial<EtatDroits> = {}): EtatDroits {
  return { ...droitsVides(), briques, ...plus };
}

const semaineOfferte = (recu: string, debut: string | null = null): Cadeau => ({
  palier: 30,
  duree: 'semaine',
  recu,
  debut
});

describe('Wenlu complet', () => {
  it("vient d'un achat, sur l'appareil", () => {
    expect(wenluComplet(droitsVides(), ACHAT, LUNDI)).toBe(true);
    expect(wenluComplet(droitsVides(), IOS, LUNDI)).toBe(false);
  });

  it("sur le web, jamais : ni par achat, ni par cadeau", () => {
    const e = recevoirCadeau(droitsVides(), { palier: 365, duree: 'toujours', recu: LUNDI, debut: LUNDI });
    expect(wenluComplet(e, { web: true, achat: true }, LUNDI)).toBe(false);
    expect(wenluComplet(e, ACCES_WEB, MARDI)).toBe(false);
    expect(rythme(e, ACCES_WEB, MARDI, APRES)).toBe('gratuit');
  });

  it('un jour offert couvre sa seule journée', () => {
    const e = recevoirCadeau(droitsVides(), { palier: 7, duree: 'jour', recu: LUNDI, debut: MARDI });
    expect(wenluComplet(e, IOS, LUNDI)).toBe(false);
    expect(wenluComplet(e, IOS, MARDI)).toBe(true);
    expect(wenluComplet(e, IOS, MERCREDI)).toBe(false);
  });

  it('une semaine offerte couvre sept jours du calendrier à partir de son début', () => {
    const e = recevoirCadeau(droitsVides(), semaineOfferte(LUNDI, MARDI));
    expect(wenluComplet(e, IOS, LUNDI)).toBe(false);
    expect(wenluComplet(e, IOS, MARDI)).toBe(true);
    expect(wenluComplet(e, IOS, LUNDI_SUIVANT)).toBe(true);
    expect(wenluComplet(e, IOS, '2026-10-13')).toBe(false);
  });

  it('une semaine reçue dans les trente jours commence au premier jour du rythme gratuit', () => {
    const recue = recevoirCadeau(droitsVides(), semaineOfferte('2026-09-20'));
    expect(wenluComplet(recue, IOS, '2026-09-21')).toBe(false);
    const e = noterBascule(recue, JOURS_COMPLETS + 1, MERCREDI);
    expect(wenluComplet(e, IOS, MARDI)).toBe(false);
    expect(wenluComplet(e, IOS, MERCREDI)).toBe(true);
    expect(wenluComplet(e, IOS, '2026-10-13')).toBe(true);
    expect(wenluComplet(e, IOS, '2026-10-14')).toBe(false);
  });

  it('le palier de 365 jours offre Wenlu complet pour toujours', () => {
    const e = recevoirCadeau(droitsVides(), { palier: 365, duree: 'toujours', recu: LUNDI, debut: null });
    expect(wenluComplet(e, IOS, LUNDI)).toBe(true);
    expect(wenluComplet(e, IOS, '2031-01-01')).toBe(true);
    expect(wenluComplet(e, IOS, '2026-10-04')).toBe(false);
  });

  it("un palier ne s'offre qu'une fois, et le cadeau garde sa date", () => {
    const e = recevoirCadeau(droitsVides(), semaineOfferte(LUNDI, LUNDI));
    expect(recevoirCadeau(e, semaineOfferte(JEUDI, JEUDI))).toBe(e);
  });
});

describe('le rythme', () => {
  it('complet les trente premiers jours du chemin, sessions de plus comprises', () => {
    expect(rythme(droitsVides(), ACCES_WEB, LUNDI, 1)).toBe('trente');
    expect(rythme(droitsVides(), ACCES_WEB, LUNDI, JOURS_COMPLETS)).toBe('trente');
    expect(briqueDuJour(droitsVides(), ACCES_WEB, LUNDI, JOURS_COMPLETS)).toBe(true);
    expect(sessionDePlus(droitsVides(), ACCES_WEB, LUNDI, JOURS_COMPLETS)).toBe(true);
    /* La session de plus qui poserait le 31e jour du chemin n'est plus du rythme complet. */
    expect(sessionDePlus(droitsVides(), ACCES_WEB, LUNDI, JOURS_COMPLETS + 1)).toBe(false);
  });

  it('gratuit ensuite, sans Wenlu complet', () => {
    expect(rythme(droitsVides(), ACCES_WEB, LUNDI, JOURS_COMPLETS + 1)).toBe('gratuit');
    expect(rythme(droitsVides(), IOS, LUNDI, APRES)).toBe('gratuit');
  });

  it('avec Wenlu complet, une brique chaque jour et la session de plus', () => {
    const e = avec([LUNDI, JEUDI]);
    expect(rythme(e, ACHAT, VENDREDI, APRES)).toBe('complet');
    expect(briqueDuJour(e, ACHAT, VENDREDI, APRES)).toBe(true);
    expect(sessionDePlus(e, ACHAT, VENDREDI, APRES)).toBe(true);
  });
});

describe('le rythme gratuit : deux briques par semaine, trois jours au moins entre deux', () => {
  it('une semaine vide laisse entrer une brique', () => {
    expect(briqueDuJour(droitsVides(), ACCES_WEB, MERCREDI, APRES)).toBe(true);
  });

  it('trois jours au moins entre deux briques', () => {
    const e = avec([LUNDI]);
    expect(briqueDuJour(e, ACCES_WEB, MARDI, APRES)).toBe(false);
    expect(briqueDuJour(e, ACCES_WEB, MERCREDI, APRES)).toBe(false);
    expect(briqueDuJour(e, ACCES_WEB, JEUDI, APRES)).toBe(true);
  });

  it('deux briques au plus du lundi au dimanche', () => {
    const e = avec([LUNDI, JEUDI]);
    expect(briqueDuJour(e, ACCES_WEB, DIMANCHE, APRES)).toBe(false);
    expect(briqueDuJour(e, ACCES_WEB, LUNDI_SUIVANT, APRES)).toBe(true);
  });

  it("l'écart vaut aussi d'une semaine à l'autre", () => {
    const e = avec([SAMEDI]);
    expect(briqueDuJour(e, ACCES_WEB, LUNDI_SUIVANT, APRES)).toBe(false);
    expect(briqueDuJour(e, ACCES_WEB, '2026-10-13', APRES)).toBe(true);
  });

  it("rien ne s'accumule : une semaine sans brique n'en donne pas plus à la suivante", () => {
    const e = avec(['2026-09-21']);
    expect(briqueGratuiteLibre(e.briques, LUNDI)).toBe(true);
    const deux = noterBriqueGratuite(noterBriqueGratuite(e, LUNDI), JEUDI);
    expect(briqueGratuiteLibre(deux.briques, DIMANCHE)).toBe(false);
  });

  it('la brique du jour déjà prise : la journée reste une journée avec brique', () => {
    expect(briqueDuJour(avec([LUNDI]), ACCES_WEB, LUNDI, APRES)).toBe(true);
  });

  it('la semaine va du lundi au dimanche', () => {
    expect(lundiDe(DIMANCHE)).toBe(LUNDI);
    expect(lundiDe(LUNDI)).toBe(LUNDI);
    expect(lundiDe(LUNDI_SUIVANT)).toBe(LUNDI_SUIVANT);
  });
});

describe('la prochaine brique, en jours du calendrier', () => {
  it('demain, dans les trente premiers jours du chemin', () => {
    expect(prochaineBrique(droitsVides(), ACCES_WEB, LUNDI, 12)).toEqual({ jour: MARDI, dans: 1 });
  });

  it('demain, avec Wenlu complet', () => {
    expect(prochaineBrique(avec([LUNDI]), ACHAT, LUNDI, APRES)).toEqual({ jour: MARDI, dans: 1 });
  });

  it('dans 3 j après la brique du lundi', () => {
    expect(prochaineBrique(avec([LUNDI]), ACCES_WEB, LUNDI, APRES)).toEqual({ jour: JEUDI, dans: 3 });
  });

  it('la brique du jour pas encore prise compte comme prise', () => {
    expect(prochaineBrique(droitsVides(), ACCES_WEB, LUNDI, APRES)).toEqual({ jour: JEUDI, dans: 3 });
  });

  it('un jour sans brique : la prochaine que la règle laisse entrer', () => {
    const e = avec([LUNDI]);
    expect(prochaineBrique(e, ACCES_WEB, MARDI, APRES)).toEqual({ jour: JEUDI, dans: 2 });
  });

  it('après la seconde de la semaine : le lundi suivant', () => {
    expect(prochaineBrique(avec([LUNDI, JEUDI]), ACCES_WEB, JEUDI, APRES)).toEqual({
      jour: LUNDI_SUIVANT,
      dans: 4
    });
  });

  it("une semaine offerte à venir avance la prochaine brique", () => {
    const e = { ...avec([LUNDI]), cadeaux: [semaineOfferte(LUNDI, MARDI)] };
    expect(prochaineBrique(e, ACCES_WEB, LUNDI, APRES)).toEqual({ jour: JEUDI, dans: 3 });
    expect(prochaineBrique(e, IOS, LUNDI, APRES)).toEqual({ jour: MARDI, dans: 1 });
  });
});

describe('ce que la progression garde', () => {
  it('le premier jour du rythme gratuit se note une fois, au-delà des trente jours', () => {
    expect(noterBascule(droitsVides(), JOURS_COMPLETS, LUNDI).gratuitDepuis).toBeNull();
    const e = noterBascule(droitsVides(), JOURS_COMPLETS + 1, LUNDI);
    expect(e.gratuitDepuis).toBe(LUNDI);
    expect(noterBascule(e, JOURS_COMPLETS + 2, MARDI)).toBe(e);
  });

  it('les jours des briques gratuites, une fois chacun, triés', () => {
    const e = noterBriqueGratuite(noterBriqueGratuite(droitsVides(), JEUDI), LUNDI);
    expect(e.briques).toEqual([LUNDI, JEUDI]);
    expect(noterBriqueGratuite(e, LUNDI)).toBe(e);
  });

  it("Clore dit le rythme gratuit le jour où il commence, et ce jour-là seulement", () => {
    expect(annonceDuRythme(droitsVides(), 'trente', LUNDI)).toBe(false);
    expect(annonceDuRythme(droitsVides(), 'complet', LUNDI)).toBe(false);
    expect(annonceDuRythme(droitsVides(), 'gratuit', LUNDI)).toBe(true);
    const e = noterAnnonce(droitsVides(), LUNDI);
    expect(annonceDuRythme(e, 'gratuit', LUNDI)).toBe(true);
    expect(annonceDuRythme(e, 'gratuit', JEUDI)).toBe(false);
    expect(noterAnnonce(e, JEUDI)).toBe(e);
  });

  it("l'export se relit tel quel, cadeaux et dates compris", () => {
    const e: EtatDroits = {
      cadeaux: [
        { palier: 7, duree: 'jour', recu: '2026-09-01', debut: '2026-09-02' },
        semaineOfferte('2026-09-24')
      ],
      gratuitDepuis: LUNDI,
      briques: [LUNDI, JEUDI],
      annonce: LUNDI
    };
    expect(lireDroits(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it("une progression d'avant les droits se relit sans rien, et une entrée aberrante est écartée", () => {
    expect(lireDroits(undefined)).toEqual(droitsVides());
    const lu = lireDroits({
      cadeaux: [{ palier: 7, duree: 'mois', recu: LUNDI }, { palier: 30, duree: 'semaine', recu: 'hier' }],
      gratuitDepuis: 'demain',
      briques: [JEUDI, 'x', LUNDI, JEUDI],
      annonce: 3
    });
    expect(lu).toEqual({ cadeaux: [], gratuitDepuis: null, briques: [LUNDI, JEUDI], annonce: null });
  });
});
