/**
 * Ce que les traits d'un caractère ont de plus qu'un autre (`ecarts.ts`), lu sur les
 * traits de l'export servi avec l'app : le point de 主, le point de 玉, le caractère
 * contenu dans un maillon de la chaîne. Et la règle de couleur : l'indigo, jamais le
 * cinabre, qui marque l'élément ajouté et la position sur le chemin, rien d'autre.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { traitsContenus, traitsQuiDistinguent, reechantillonner } from './ecarts';
import { glyph, type StrokeData } from './glyph';
import { VERSION_DONNEES } from './content';

const dossier = new URL(`../../public/data/${VERSION_DONNEES}/traits/`, import.meta.url);
const T: Record<string, StrokeData> = {};
for (const f of readdirSync(dossier)) {
  if (f.endsWith('.json')) Object.assign(T, JSON.parse(readFileSync(new URL(f, dossier), 'utf8')).traits);
}
const tr = (c: string): StrokeData => {
  const d = T[c];
  if (!d) throw new Error(`traits de ${c} absents`);
  return d;
};

describe('les traits qui distinguent deux jumeaux', () => {
  it('主 a un point de plus que 王 : son premier trait', () => {
    expect(traitsQuiDistinguent(tr('主'), tr('王'))).toEqual([0]);
    /* 王 n'a rien de plus que 主 : c'est 主 qui porte la différence. */
    expect(traitsQuiDistinguent(tr('王'), tr('主'))).toEqual([]);
  });

  it('玉 a un point de plus que 王 : son dernier trait', () => {
    expect(traitsQuiDistinguent(tr('玉'), tr('王'))).toEqual([4]);
  });

  it('太 a un point de plus que 大', () => {
    expect(traitsQuiDistinguent(tr('太'), tr('大'))).toEqual([3]);
  });

  it('même compte de traits : les traits qui s’écartent (土 et 士, 天 et 夫)', () => {
    /* Le trait du haut et celui du bas : l'un long, l'autre court. */
    expect(traitsQuiDistinguent(tr('土'), tr('士'))).toEqual([0, 2]);
    expect(traitsQuiDistinguent(tr('士'), tr('土'))).toEqual([0, 2]);
    /* Le premier trait et le jeté, qui dépasse chez 夫. */
    expect(traitsQuiDistinguent(tr('天'), tr('夫'))).toEqual([0, 2]);
  });

  it('un caractère identique à lui-même n’a rien à distinguer', () => {
    expect(traitsQuiDistinguent(tr('天'), tr('天'))).toEqual([]);
    expect(traitsQuiDistinguent({ s: [], m: [] }, tr('天'))).toEqual([]);
  });
});

describe('les traits du caractère contenu, pour la chaîne', () => {
  it('trouve 见 dans 觉, 可 dans 哥, 口 dans 可, 大 dans 天, 人 dans 大', () => {
    expect(traitsContenus(tr('觉'), tr('见'))).toEqual([5, 6, 7, 8]);
    expect(traitsContenus(tr('哥'), tr('可'))).toEqual([5, 6, 7, 8, 9]);
    expect(traitsContenus(tr('可'), tr('口'))).toEqual([1, 2, 3]);
    expect(traitsContenus(tr('天'), tr('大'))).toEqual([1, 2, 3]);
    expect(traitsContenus(tr('大'), tr('人'))).toEqual([1, 2]);
  });

  it('trouve une brique en clé de gauche, même resserrée : 女 dans 姓, 又 dans 对, 木 dans 杯', () => {
    expect(traitsContenus(tr('姓'), tr('女'))).toEqual([0, 1, 2]);
    expect(traitsContenus(tr('对'), tr('又'))).toEqual([0, 1]);
    expect(traitsContenus(tr('杯'), tr('木'))).toEqual([0, 1, 2, 3]);
  });

  it('trouve la bonne moitié : 女 à gauche de 好, 子 à droite ; 门 autour de 问', () => {
    expect(traitsContenus(tr('好'), tr('女'))).toEqual([0, 1, 2]);
    expect(traitsContenus(tr('好'), tr('子'))).toEqual([3, 4, 5]);
    expect(traitsContenus(tr('问'), tr('门'))).toEqual([0, 1, 2]);
    expect(traitsContenus(tr('问'), tr('口'))).toEqual([3, 4, 5]);
  });

  it('ne rend rien quand le petit a plus de traits que le grand', () => {
    expect(traitsContenus(tr('人'), tr('大'))).toEqual([]);
  });
});

describe('le rendu', () => {
  it('rééchantillonne une médiane en huit points, du début à la fin', () => {
    const r = reechantillonner([
      [0, 0],
      [70, 0]
    ]);
    expect(r).toHaveLength(8);
    expect(r[0]).toEqual([0, 0]);
    expect(r[7][0]).toBeCloseTo(70);
  });

  it('peint les traits en indigo (classe `lan`), jamais en cinabre', () => {
    const h = glyph('主', tr('主'), 72, { write: false, indigo: [0] });
    expect(h.match(/class="lan"/g)).toHaveLength(1);
    expect(h).not.toContain('zhu');
    const w = glyph('主', tr('主'), 72, { write: true, indigo: [0] });
    expect(w).toContain('class="br lan"');
    expect(w).toContain('class="fill lan"');
    /* À la correction de la chaîne, le petit se peint dans le grand ; des jumeaux, le trait qui les distingue. */
    const game = readFileSync(new URL('Game.svelte', import.meta.url), 'utf8');
    expect(game).toContain('traitsContenus(dg, dp)');
    expect(game).toContain('indigo={dansLeMaillon(t.c)}');
    const css = readFileSync(new URL('tokens.css', import.meta.url), 'utf8');
    expect(css).toContain('.g .lan{color:var(--indigo)}');
  });
});
