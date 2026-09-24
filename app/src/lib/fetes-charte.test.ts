/**
 * La charte des fêtes, dans les composants : tests de source, une règle par test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FETES, type FeteId } from './content';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Les branches du décor de fête, une par fête : de `{#if fete === 'x'}` à la suivante. */
function branches(decor: string): Map<string, string> {
  const gabarit = decor.slice(decor.indexOf('{#if fete}'), decor.indexOf('{:else if saison}'));
  const morceaux = gabarit.split(/\{(?:#if|:else if) fete === '([a-z]+)'\}/);
  const m = new Map<string, string>();
  for (let i = 1; i < morceaux.length; i += 2) m.set(morceaux[i], morceaux[i + 1]);
  return m;
}

describe('la charte des fêtes', () => {
  const css = source('tokens.css');
  const decor = source('FeteDecor.svelte');
  const embleme = source('Embleme.svelte');
  const voeu = source('Voeu.svelte');
  const tao = source('Tao.svelte');
  const dragon = source('Dragon.svelte');
  const menu = source('Menu.svelte');

  it("le décor est derrière tout, jamais cliquable, coupé si l'on réduit les animations", () => {
    expect(decor).toContain('pointer-events: none');
    expect(decor).toContain('z-index: -1');
    expect(decor).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.deco \{ display: none; \}/);
    expect(decor).toContain('<div class="deco" aria-hidden="true">');
  });

  it('ni ombre, ni dégradé, ni doré dans les fêtes', () => {
    for (const s of [decor, embleme, voeu, dragon]) {
      expect(s).not.toMatch(/gradient|box-shadow|drop-shadow/i);
      expect(s).not.toMatch(/gold/i);
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

  it("toucher le vœu le prononce et rouvre l'anecdote du jour", () => {
    expect(voeu).toContain('onclick={toucher}');
    expect(voeu).toMatch(/function toucher\(\): void \{\s*void dire\(fete\.voeu\.zh\);\s*onouvrir\(\);/);
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

  it("le dragon n'est dessiné qu'au Nouvel An et à 端午 : la danse, puis les bateaux", () => {
    const b = branches(decor);
    expect([...b.keys()].sort()).toEqual([...FETES].sort());
    expect(b.get('chunjie')).toContain('<Dragon sorte="danse" />');
    expect(b.get('duanwu')).toContain('<Dragon sorte="bateau" />');
    expect(decor.match(/<Dragon\b/g)).toHaveLength(2);
    expect(dragon).toContain("let { sorte }: { sorte: 'danse' | 'bateau' } = $props();");
  });

  it('aucune autre fête ne voit de dragon : ni 元宵, ni les pies de 七夕, ni les autres', () => {
    for (const [id, branche] of branches(decor)) {
      if (id === 'chunjie' || id === 'duanwu') continue;
      expect(branche, id).not.toMatch(/dragon|龙/i);
    }
    /* ni dans les tirages du décor, ni dans ses styles : tout le dragon tient dans son composant */
    expect(decor.slice(0, decor.indexOf('</script>')), 'tirages').not.toMatch(/dragon|龙/i);
    expect(decor.slice(decor.indexOf('<style>')), 'styles').not.toMatch(/dragon|龙/i);
  });

  it('hors du décor, jamais de dragon : ni emblème, ni vœu, ni Tao, ni jetons, ni menu', () => {
    for (const [nom, s] of Object.entries({ embleme, voeu, tao, css, menu })) expect(s, nom).not.toMatch(/dragon|龙/i);
  });

  it('le dragon prend les pigments de sa fête, jamais le cinabre', () => {
    expect(dragon).not.toMatch(/--zhu|#C8371F/i);
    const danse = dragon.slice(dragon.indexOf("{#if sorte === 'danse'}"), dragon.indexOf('{:else}'));
    const bateau = dragon.slice(dragon.indexOf('{:else}'), dragon.indexOf('<style>'));
    expect(danse).toContain('var(--fete)');
    expect(danse).toContain('var(--apricot)');
    /* le cramoisi reste au Nouvel An et à 元宵 : le bateau de 端午 s'en passe */
    expect(bateau).not.toContain('var(--fete)');
    expect(bateau).toContain('var(--bateau-bande)');
  });

  it("le dragon s'arrête avec le décor si l'on réduit les animations", () => {
    expect(dragon).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.danse[^}]*\.barque[^}]*animation: none;/);
  });
});
