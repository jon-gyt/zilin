/**
 * La charte des fêtes, dans les composants : tests de source, une règle par test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FETES, type FeteId } from './content';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('la charte des fêtes', () => {
  const css = source('tokens.css');
  const decor = source('FeteDecor.svelte');
  const embleme = source('Embleme.svelte');
  const voeu = source('Voeu.svelte');
  const tao = source('Tao.svelte');

  it("le décor est derrière tout, jamais cliquable, coupé si l'on réduit les animations", () => {
    expect(decor).toContain('pointer-events: none');
    expect(decor).toContain('z-index: -1');
    expect(decor).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.deco \{ display: none; \}/);
    expect(decor).toContain('<div class="deco" aria-hidden="true">');
  });

  it('ni ombre, ni dégradé, ni doré, ni dragon dans les fêtes', () => {
    for (const s of [decor, embleme, voeu]) {
      expect(s).not.toMatch(/gradient|box-shadow|drop-shadow/i);
      expect(s).not.toMatch(/gold|dragon/i);
    }
  });

  it('le cramoisi de fête reste au décor, distinct du cinabre', () => {
    expect(css).toContain('--fete:#9E1F2A');
    expect(css).not.toMatch(/--zhu:#9E1F2A/i);
    /* sur la lune claire, la brique nouvelle garde le vrai cinabre */
    expect(embleme).toContain('--zhu: #c8371f');
  });

  it('les caractères de fête sont dessinés depuis leurs traits, jamais depuis une police', () => {
    expect(embleme).toContain('traitsDe(car, p)');
    expect(embleme).toContain('glyph(c, data, taille, { write, cinabre })');
    expect(voeu).toContain('traitsDe(c, p)');
  });

  it('deux emblèmes peuvent coexister : leurs clipPath ont un id unique', () => {
    expect(embleme).toContain('const uid = $props.id();');
    expect(embleme).toContain('clip-path="url(#{clip})"');
  });

  it('toucher le vœu le prononce', () => {
    expect(voeu).toContain('onclick={() => void dire(fete.voeu.zh)}');
  });

  it("la mi-automne est toujours de nuit : ses couleurs ne dépendent pas de l'heure", () => {
    expect(css).toContain('[data-fete="zhongqiu"]{ color-scheme:dark; --paper:#141B2E');
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('Tao porte le flocon au Nouvel An et le gâteau de lune à la mi-automne, rien les autres jours', () => {
    expect(tao).toContain('class="fete-acc flocon"');
    expect(tao).toContain('class="fete-acc yuebing"');
    expect(css).toContain('.tao .fete-acc{display:none}');
    expect(css).toContain('[data-fete="chunjie"] .tao .flocon,[data-fete="zhongqiu"] .tao .yuebing{display:inline}');
  });

  /** Chaque fête, son accessoire de Tao. */
  const ACCESSOIRES: Record<FeteId, string> = {
    chunjie: 'flocon',
    yuanxiao: 'tangyuan',
    qingming: 'saule',
    duanwu: 'zongzi',
    qixi: 'etoile',
    zhongqiu: 'yuebing',
    chongyang: 'ju',
    dongzhi: 'jiaozi'
  };

  it('chaque fête a sa palette, son décor, son emblème et un accessoire de Tao', () => {
    for (const id of FETES) {
      expect(css, id).toContain(`[data-fete="${id}"]{`);
      expect(tao, id).toContain(`class="fete-acc ${ACCESSOIRES[id]}"`);
      expect(css, id).toContain(`[data-fete="${id}"] .tao .${ACCESSOIRES[id]}`);
      if (id !== 'chunjie') {
        expect(decor, id).toContain(`fete === '${id}'`);
        expect(embleme, id).toContain(`fete === '${id}'`);
      }
    }
  });

  it("le cramoisi de fête ne sert qu'au Nouvel An et à 元宵", () => {
    const blocs = css.split('\n[data-fete="').slice(1).filter((b) => /^[a-z]+"\]\{/.test(b));
    expect(blocs.length).toBe(FETES.length);
    for (const bloc of blocs) {
      const id = bloc.slice(0, bloc.indexOf('"'));
      if (id === 'chunjie' || id === 'yuanxiao') continue;
      expect(bloc.slice(0, bloc.indexOf('}')), id).not.toMatch(/#9E1F2A/i);
    }
    for (const id of ['qingming', 'duanwu', 'qixi', 'chongyang', 'dongzhi']) {
      const branche = embleme.slice(embleme.indexOf(`fete === '${id}'`));
      expect(branche.slice(0, branche.indexOf('{:else')), id).not.toContain('var(--fete)');
    }
  });

  it('七夕 est de nuit, comme la mi-automne, et son disque clair garde le vrai cinabre', () => {
    expect(css).toContain('[data-fete="qixi"]{ color-scheme:dark; --paper:#1B1B35');
    expect(embleme).toMatch(/\.qixi \.car \{\s*--zhu: #c8371f;/);
  });

  it('les bateaux de 端午 et les pies de 七夕 : ni tête de bête, ni le mot', () => {
    for (const s of [decor, embleme, voeu, tao, css]) expect(s).not.toMatch(/dragon|龙/i);
  });
});
