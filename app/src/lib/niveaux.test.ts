/**
 * Les niveaux des contes : le seuil 255 et les niveaux HSK 3.0, lus en chaîne, rangés par
 * leur nombre de caractères, et ce que disent leurs sceaux. Un test par règle.
 */
import { describe, expect, it } from 'vitest';
import {
  auNiveau,
  comparerNiveaux,
  duNiveau,
  estHsk,
  libelleNiveau,
  lireNiveau,
  lireNiveaux,
  nomNiveau,
  plusHaut,
  rangNiveau
} from './niveaux';

describe('les niveaux des contes', () => {
  it('se lisent de l’export : un seuil en nombre, un niveau HSK en chaîne', () => {
    expect(lireNiveau(255)).toBe('255');
    expect(lireNiveau('255')).toBe('255');
    expect(lireNiveau('hsk3')).toBe('hsk3');
    expect(lireNiveau(' HSK7-9 ')).toBe('hsk7-9');
    for (const faux of [0, -1, 2.5, 'x', 'hsk0', 'hsk7', 'hsk10', '', null, undefined, true]) {
      expect(lireNiveau(faux), String(faux)).toBeNull();
    }
  });

  it('se rangent par leur nombre de caractères, cumul compris : 255 avant HSK 1', () => {
    expect(lireNiveaux(['hsk7-9', 'hsk1', 255, '1555', 'hsk6', 'hsk2', 'hsk2'])).toEqual([
      '255',
      'hsk1',
      'hsk2',
      '1555',
      'hsk6',
      'hsk7-9'
    ]);
    expect(rangNiveau('hsk3')).toBe(900);
    expect(comparerNiveaux('255', 'hsk1')).toBeLessThan(0);
    expect(plusHaut('hsk3', '255')).toBe('hsk3');
    expect(estHsk('hsk3') && !estHsk('255')).toBe(true);
  });

  it('disent « HSK 3 » sur leur sceau et dans une phrase', () => {
    expect(libelleNiveau('hsk3')).toBe('HSK 3');
    expect(libelleNiveau('hsk7-9')).toBe('HSK 7-9');
    expect(libelleNiveau('255')).toBe('255');
    expect(nomNiveau('255')).toBe('seuil 255');
    expect(nomNiveau('hsk5')).toBe('HSK 5');
    expect(auNiveau('hsk5')).toBe('au niveau HSK 5');
    expect(auNiveau('255')).toBe('au seuil 255');
    expect(duNiveau('hsk5')).toBe('du niveau HSK 5');
  });
});
