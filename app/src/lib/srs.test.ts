import { describe, it, expect } from 'vitest';
import { Rating } from 'ts-fsrs';
import {
  grade,
  unlockable,
  newCard,
  schedule,
  stability,
  due,
  toJSON,
  fromJSON,
  RETOUR_MINUTES,
  type Outcome,
  type ReviewCard
} from './srs';

const T0 = new Date('2026-01-05T09:00:00Z');
const RAPIDE: Outcome = { correct: true, tries: 0, seconds: 3 };
const LENT: Outcome = { correct: true, tries: 0, seconds: 9 };
const APRES_ERREUR: Outcome = { correct: true, tries: 1, seconds: 3 };
const FAUX: Outcome = { correct: false, tries: 2, seconds: 20 };

const jours = (depuis: Date, jusqua: Date) => (jusqua.getTime() - depuis.getTime()) / 86_400_000;
const neuve = () => newCard('人', T0);
const apres = (o: Outcome, now = T0) => schedule(neuve(), o, now);

describe('notation automatique', () => {
  it('juste et rapide : Facile', () => expect(grade(RAPIDE)).toBe(Rating.Easy));
  it('juste et lent : Bien', () => expect(grade(LENT)).toBe(Rating.Good));
  it('juste après erreur : Dur', () => expect(grade(APRES_ERREUR)).toBe(Rating.Hard));
  it('faux : Oublié', () => expect(grade(FAUX)).toBe(Rating.Again));
});

describe("planification d'une carte neuve", () => {
  it('carte neuve : due tout de suite, sans stabilité', () => {
    expect(neuve().card.due).toEqual(T0);
    expect(stability(neuve())).toBe(0);
  });

  it('juste et rapide : le plus long intervalle', () => expect(jours(T0, apres(RAPIDE).due)).toBe(16));

  it('juste et lent : intervalle moyen', () => expect(jours(T0, apres(LENT).due)).toBe(3));

  it('juste après erreur : intervalle court', () => expect(jours(T0, apres(APRES_ERREUR).due)).toBe(2));

  it('faux : retour dans 10 minutes, quoi que dise FSRS', () => {
    const r = apres(FAUX);
    expect(r.due.getTime() - T0.getTime()).toBe(RETOUR_MINUTES * 60_000);
    expect(r.card.card.due).toEqual(r.due);
  });

  it("les intervalles croissent dans l'ordre du brief", () => {
    const d = [FAUX, APRES_ERREUR, LENT, RAPIDE].map((o) => apres(o).due.getTime());
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(new Set(d).size).toBe(4);
  });

  it('une bonne réponse fait monter la stabilité', () => {
    expect(stability(apres(LENT).card)).toBeGreaterThan(stability(apres(APRES_ERREUR).card));
  });

  it("la révision est tracée dans l'historique", () => {
    const r = apres(LENT);
    expect(r.card.history).toEqual([{ at: T0, rating: Rating.Good, due: r.due }]);
  });
});

describe('rétention cible', () => {
  it("une rétention plus haute raccourcit l'intervalle", () => {
    const première = apres(LENT);
    const suivante = (retention: number) =>
      jours(première.due, schedule(première.card, LENT, première.due, { retention }).due);
    expect(suivante(0.97)).toBeLessThan(suivante(0.9));
  });
});

describe('cartes dues', () => {
  const carte = (id: string, dueLe: string, s: number): ReviewCard => ({
    id,
    card: { ...newCard(id, T0).card, due: new Date(dueLe), stability: s },
    history: []
  });

  it("les plus en retard d'abord, les pas encore dues écartées", () => {
    const cartes = [
      carte('天', '2026-01-05T08:00:00Z', 5),
      carte('大', '2026-01-04T09:00:00Z', 5),
      carte('人', '2026-01-06T09:00:00Z', 5)
    ];
    expect(due(cartes, T0).map((c) => c.id)).toEqual(['大', '天']);
  });

  it('à échéance égale, la plus fragile passe devant', () => {
    const cartes = [carte('天', '2026-01-04T09:00:00Z', 9), carte('大', '2026-01-04T09:00:00Z', 2)];
    expect(due(cartes, T0).map((c) => c.id)).toEqual(['大', '天']);
  });
});

describe('déblocage', () => {
  it('toutes les briques stables', () => expect(unlockable([9, 12])).toBe(true));
  it('une brique fragile', () => expect(unlockable([9, 2])).toBe(false));
  it('aucune brique connue', () => expect(unlockable([])).toBe(false));
  it('une brique neuve bloque le caractère', () =>
    expect(unlockable([neuve(), apres(RAPIDE).card])).toBe(false));
});

describe('export et import', () => {
  it('aller-retour JSON sans perte', () => {
    const une = apres(RAPIDE).card;
    const deux = schedule(apres(FAUX).card, LENT, new Date('2026-01-06T09:00:00Z')).card;
    const cartes = [une, deux];
    expect(fromJSON(toJSON(cartes))).toEqual(cartes);
  });

  it('les dates sont écrites en ISO', () => {
    const texte = toJSON([apres(LENT).card]);
    expect(JSON.parse(texte).cards[0].card.due).toBe('2026-01-08T09:00:00.000Z');
  });

  it('un export inconnu est refusé', () =>
    expect(() => fromJSON('{"version":2,"cards":[]}')).toThrow());
});

describe('le leurre pris', () => {
  it("se range dans l'historique, sans changer la note", () => {
    const pris = schedule(neuve(), { ...FAUX, leurres: ['入'] }, T0);
    const sans = apres(FAUX);
    expect(pris.card.history[0].leurres).toEqual(['入']);
    expect(pris.card.history[0].rating).toBe(sans.card.history[0].rating);
    expect(pris.due).toEqual(sans.due);
    /* Une réponse sans leurre connu n'en invente pas. */
    expect('leurres' in sans.card.history[0]).toBe(false);
  });

  it("survit à l'export, et un export d'avant se relit sans", () => {
    const cartes = [schedule(neuve(), { ...APRES_ERREUR, leurres: ['入'] }, T0).card];
    expect(fromJSON(toJSON(cartes))).toEqual(cartes);
    const ancien = toJSON([apres(FAUX).card]);
    expect(ancien).not.toContain('leurres');
    expect(fromJSON(ancien)[0].history[0].leurres).toBeUndefined();
  });
});
