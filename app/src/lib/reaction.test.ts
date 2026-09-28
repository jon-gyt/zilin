/**
 * Tao réagit dans les jeux (brief §9 : « une carte, une bouchée ; erreur, grimace ; série
 * juste, bond ») : la règle dans `reaction.ts`, et, dans le code des écrans, l'absence de
 * tout compteur de série et le respect de `prefers-reduced-motion`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRIMACE_MS, SERIE_BOND, reagir, type Reaction } from './reaction';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Les réactions d'une suite de verdicts, depuis une série vide. */
function suite(verdicts: readonly boolean[]): Reaction[] {
  let serie = 0;
  return verdicts.map((v) => {
    const r = reagir(serie, v);
    serie = r.serie;
    return r.reaction;
  });
}

describe('Tao réagit aux verdicts des jeux', () => {
  it('une bonne réponse : une bouchée', () => {
    expect(reagir(0, true)).toEqual({ reaction: 'bouchee', serie: 1 });
  });

  it('une erreur : une grimace brève, et la série repart de zéro sans rien dire', () => {
    expect(reagir(2, false)).toEqual({ reaction: 'grimace', serie: 0 });
    expect(GRIMACE_MS).toBeLessThanOrEqual(2000);
  });

  it('trois justes d’affilée : un bond, puis de nouveau des bouchées', () => {
    expect(SERIE_BOND).toBe(3);
    expect(suite([true, true, true, true, true, true])).toEqual([
      'bouchee',
      'bouchee',
      'bond',
      'bouchee',
      'bouchee',
      'bond'
    ]);
  });

  it('une erreur casse la série : il faut de nouveau trois justes pour bondir', () => {
    expect(suite([true, true, false, true, true, true])).toEqual([
      'bouchee',
      'bouchee',
      'grimace',
      'bouchee',
      'bouchee',
      'bond'
    ]);
  });

  it('les écrans de jeu la font réagir, sans jamais afficher la série', () => {
    for (const f of ['Game.svelte', 'WeChat.svelte']) {
      const s = source(f);
      expect(s, f).toContain('<TaoReagit');
      expect(s, f).toContain('reagirA(');
      /* La série vit dans le script, jamais dans le balisage : aucun compteur. */
      const balisage = s.slice(s.indexOf('</script>'));
      expect(balisage, f).not.toMatch(/\{serie\}|combo|série de/i);
    }
  });

  it('sans animation demandée, Tao ne bouge pas', () => {
    const s = source('TaoReagit.svelte');
    expect(s).toContain('@media (prefers-reduced-motion: reduce)');
    expect(s).toMatch(/\.corps\.bouchee,\s*\.corps\.bond\s*\{\s*animation: none;/);
    /* La grimace est celle de Tao.svelte, qui coupe elle aussi son frisson. */
    expect(s).toContain('grimace={visible === ');
    expect(source('Tao.svelte')).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.tao\.grimace \.plante/);
  });
});
