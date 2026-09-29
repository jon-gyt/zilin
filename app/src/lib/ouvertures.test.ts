import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PORTES,
  TOUJOURS,
  aAnnoncer,
  atteinte,
  etatNeuf,
  lireCalendrier,
  lireEtatOuvertures,
  mesure,
  noter,
  retourAuMenu,
  visible,
  type Calendrier,
  type EtatOuvertures,
  type PorteId
} from './ouvertures';
import { emptyProgress, fromJSON, jourDuChemin, toJSON, type Progress } from './session';
import { menu } from './parcours';
import { recevoirCadeau } from './droits';

/**
 * L'aventure (brief §6, « Les portes qui s'ouvrent ») : un test par règle. Le calendrier
 * est celui de l'export versionné, que le pipeline écrit et contrôle.
 */
const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const CAL: Calendrier = lireCalendrier(JSON.parse(source('../../public/data/0.1.0/ouvertures.json')) as unknown);

const JOUR = '2026-09-29';

/** Les portes montrées après une suite de retours au menu à une même mesure. */
function retours(etat: EtatOuvertures | null, jour: number, lus: number | null, n: number): { etat: EtatOuvertures; annonces: string[] } {
  let e = etat;
  const annonces: string[] = [];
  for (let k = 0; k < n; k++) {
    const r = retourAuMenu(e, CAL, mesure(jour, lus), JOUR);
    e = r.etat;
    if (r.annonce) annonces.push(r.annonce.id);
  }
  return { etat: e ?? etatNeuf(), annonces };
}

/** Une progression au jour du chemin donné, la première session faite. */
function auJour(jour: number): Progress {
  return { ...emptyProgress(JOUR), premiere: false, jourParcours: jour + 1, days: jour };
}

describe("le calendrier vient du pipeline", () => {
  it("l'export porte chaque porte que l'app connaît, une fois, et rien d'autre", () => {
    expect(CAL.map((p) => p.id).sort()).toEqual([...PORTES].sort());
  });

  it('une porte inconnue ou mal formée est écartée, rien ne s’invente', () => {
    const cal = lireCalendrier({
      portes: [
        { id: 'boutique', unite: 'jour', seuil: 1, parent: null, annonce: 'x' },
        { id: 'jouer', unite: 'date', seuil: 1, parent: null, annonce: 'x' },
        { id: 'lire', unite: 'jour', seuil: 'sept', parent: null, annonce: 'x' },
        { id: 'foret', unite: 'jour', seuil: 6, parent: 'boutique', annonce: 'Une porte' }
      ]
    });
    expect(cal).toEqual([{ id: 'foret', unite: 'jour', seuil: 6, parent: null, annonce: 'Une porte' }]);
    expect(lireCalendrier(null)).toEqual([]);
  });
});

describe('quelles portes sont ouvertes selon la progression', () => {
  it('une porte s’ouvre à son seuil, en jours du chemin ou en caractères lus', () => {
    const reviser = CAL.find((p) => p.id === 'reviser')!;
    const jouer = CAL.find((p) => p.id === 'jouer')!;
    expect(atteinte(reviser, mesure(reviser.seuil - 1, 0))).toBe(false);
    expect(atteinte(reviser, mesure(reviser.seuil, 0))).toBe(true);
    expect(atteinte(jouer, mesure(99, jouer.seuil - 1))).toBe(false);
    expect(atteinte(jouer, mesure(0, jouer.seuil))).toBe(true);
    /* Les lus pas encore comptés n'ouvrent rien. */
    expect(atteinte(jouer, mesure(99, null))).toBe(false);
  });

  it('le jour du chemin est la dernière leçon apprise : 0 pendant la première session, 3 après', () => {
    expect(jourDuChemin(emptyProgress(JOUR))).toBe(0);
    expect(jourDuChemin(auJour(3))).toBe(3);
  });

  it('le premier jour, le menu est simple : aucune porte, mais la session reste là', () => {
    const { etat, annonces } = retours(etatNeuf(), 3, 3, 3);
    expect(annonces).toEqual([]);
    for (const id of ['reviser', 'jouer', 'lire', 'foret', 'personnage', 'route'] as PorteId[]) {
      expect(visible(etat, CAL, id)).toBe(false);
    }
    /* Rien ne bloque la pédagogie : le bouton de session est toujours là. */
    const m = menu({ ...auJour(3), ouvertures: etat });
    expect(m.bouton).not.toBe('');
  });

  it('Réglages, Chercher un caractère et la session ne sont jamais des portes', () => {
    for (const id of TOUJOURS) {
      expect((PORTES as readonly string[]).includes(id)).toBe(false);
      expect(visible(etatNeuf(), CAL, id)).toBe(true);
    }
  });

  it('sans calendrier (un export plus ancien), tout est visible', () => {
    expect(visible(etatNeuf(), [], 'jouer')).toBe(true);
  });

  it("l'achat ouvre le rythme, pas les portes : la mesure ne lit ni les droits ni la date", () => {
    const sans = auJour(10);
    const avec: Progress = { ...sans, day: '2027-01-01', droits: recevoirCadeau(sans.droits, { palier: 365, duree: 'toujours', recu: JOUR, debut: JOUR }) };
    expect(jourDuChemin(avec)).toBe(jourDuChemin(sans));
    const a = noter(etatNeuf(), CAL, mesure(jourDuChemin(sans), 8), JOUR);
    const b = noter(etatNeuf(), CAL, mesure(jourDuChemin(avec), 8), JOUR);
    expect(Object.keys(b.ouvertes)).toEqual(Object.keys(a.ouvertes));
  });
});

describe('quelle ouverture annoncer au retour au menu', () => {
  it('une seule par retour, dans l’ordre du calendrier ; la suivante au retour suivant', () => {
    /* Jour 7, 8 lus : Réviser, le personnage, Ma forêt, Lire et Jouer sont atteints ensemble. */
    const { annonces } = retours(etatNeuf(), 7, 8, 7);
    expect(annonces).toEqual(['reviser', 'personnage', 'foret', 'lire', 'jouer']);
  });

  it('une porte ouverte mais pas encore annoncée ne se montre pas', () => {
    const r = retourAuMenu(etatNeuf(), CAL, mesure(7, 8), JOUR);
    expect(r.annonce?.id).toBe('reviser');
    expect(Object.keys(r.etat.ouvertes)).toContain('jouer');
    expect(visible(r.etat, CAL, 'reviser')).toBe(true);
    expect(visible(r.etat, CAL, 'jouer')).toBe(false);
  });

  it('Tao dit une phrase qui nomme la porte', () => {
    const r = retourAuMenu(etatNeuf(), CAL, mesure(4, 0), JOUR);
    expect(r.annonce?.annonce).toContain('温');
  });

  it('une porte silencieuse vient avec celle qui la contient', () => {
    const jouer = CAL.find((p) => p.id === 'jouer')!;
    const { etat } = retours(etatNeuf(), 7, jouer.seuil, 6);
    expect(visible(etat, CAL, 'jouer')).toBe(true);
    expect(visible(etat, CAL, 'jeu-chaine')).toBe(true);
    expect(visible(etat, CAL, 'jeu-assembler')).toBe(true);
    expect(visible(etat, CAL, 'jeu-cuisine')).toBe(false);
  });

  it('une porte attend celle qui la contient : les trophées après Ma forêt', () => {
    /* Jour 5, 12 lus : les trophées sont atteints, Ma forêt pas encore. */
    const { etat, annonces } = retours(etatNeuf(), 5, 12, 6);
    expect(Object.keys(etat.ouvertes)).toContain('trophees');
    expect(annonces).not.toContain('trophees');
    const suite = retours(etat, 6, 12, 3);
    expect(suite.annonces.indexOf('foret')).toBeLessThan(suite.annonces.indexOf('trophees'));
  });
});

describe('une porte ouverte le reste', () => {
  it('même quand le compte des lus redescend', () => {
    const { etat } = retours(etatNeuf(), 7, 12, 8);
    expect(visible(etat, CAL, 'jouer')).toBe(true);
    const apres = noter(etat, CAL, mesure(7, 2), '2026-10-01');
    expect(visible(apres, CAL, 'jouer')).toBe(true);
    expect(apres.ouvertes.jouer).toBe(JOUR);
  });

  it('la progression garde ses portes, export et import compris', () => {
    const { etat } = retours(etatNeuf(), 7, 8, 2);
    const p: Progress = { ...auJour(7), ouvertures: etat };
    const relue = fromJSON(toJSON(p), JOUR);
    expect(relue.ouvertures).toEqual(etat);
    /* La suivante s'annonce au retour suivant, pas de nouveau les précédentes. */
    const r = retourAuMenu(relue.ouvertures, CAL, mesure(7, 8), JOUR);
    expect(r.annonce?.id).toBe('foret');
  });
});

describe('une progression importée', () => {
  it("d'un utilisateur avancé a tout ouvert, sans rafale d'annonces", () => {
    /* Un export d'avant l'aventure : pas de champ `ouvertures`. */
    const brut = JSON.parse(toJSON(auJour(80))) as Record<string, unknown>;
    delete brut.ouvertures;
    const p = fromJSON(JSON.stringify(brut), JOUR);
    expect(p.ouvertures).toBeNull();
    const { etat, annonces } = retours(p.ouvertures, jourDuChemin(p), 120, 5);
    expect(annonces).toEqual([]);
    for (const id of ['reviser', 'jouer', 'lire', 'foret', 'contes', 'revisions', 'jeu-coquille', 'monde']) {
      expect(visible(etat, CAL, id)).toBe(true);
    }
    /* On n'annonce que ce qui arrive ensuite, au moment où ça arrive. */
    const cuisine = CAL.find((x) => x.id === 'jeu-cuisine')!;
    expect(aAnnoncer(etat, CAL)).toBeNull();
    expect(retourAuMenu(etat, CAL, mesure(jourDuChemin(p), cuisine.seuil), JOUR).annonce?.id).toBe('jeu-cuisine');
  });

  it('un état mal formé se relit comme absent', () => {
    expect(lireEtatOuvertures('tout')).toBeNull();
    expect(lireEtatOuvertures({ ouvertes: { boutique: JOUR, jouer: JOUR }, montrees: ['jouer', 'jouer', 3] })).toEqual({
      ouvertes: { jouer: JOUR },
      montrees: ['jouer']
    });
  });

  it('une progression neuve suit l’aventure dès le premier jour', () => {
    expect(emptyProgress(JOUR).ouvertures).toEqual(etatNeuf());
  });
});
