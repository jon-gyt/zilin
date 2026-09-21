import { describe, it, expect } from 'vitest';
import { Rating } from 'ts-fsrs';
import { grade, unlockable } from './srs';

describe('notation automatique', () => {
  it('juste et rapide : Facile', () => expect(grade({ correct: true, tries: 0, seconds: 3 })).toBe(Rating.Easy));
  it('juste et lent : Bien', () => expect(grade({ correct: true, tries: 0, seconds: 9 })).toBe(Rating.Good));
  it('juste après erreur : Dur', () => expect(grade({ correct: true, tries: 1, seconds: 3 })).toBe(Rating.Hard));
  it('faux : Oublié', () => expect(grade({ correct: false, tries: 2, seconds: 20 })).toBe(Rating.Again));
});
describe('déblocage', () => {
  it('toutes les briques stables', () => expect(unlockable([9, 12])).toBe(true));
  it('une brique fragile', () => expect(unlockable([9, 2])).toBe(false));
});
