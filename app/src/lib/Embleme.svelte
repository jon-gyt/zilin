<script lang="ts" module>
  /** Seize festons autour de la rosace, et seize jours découpés entre eux. */
  const FESTONS = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    return { x: (84 + 70 * Math.cos(a)).toFixed(1), y: (84 + 70 * Math.sin(a)).toFixed(1) };
  });
  const JOURS = Array.from({ length: 16 }, (_, i) => {
    const a = ((i + 0.5) * Math.PI) / 8;
    return `translate(${(84 + 74 * Math.cos(a)).toFixed(1)} ${(84 + 74 * Math.sin(a)).toFixed(1)}) rotate(${((i + 0.5) * 22.5 + 90).toFixed(2)})`;
  });
</script>

<script lang="ts">
  /**
   * L'emblème de fête : le fond qui porte le caractère du jour, dessiné depuis ses traits.
   *
   * - 中秋 : la pleine lune, les pointillés du 米字格 tracés sur elle, ses cratères, le
   *   lapin de jade 玉兔 qui saute, deux nuages 祥云 qui passent. Le caractère est posé
   *   dessus à l'encre de nuit, la brique nouvelle en cinabre.
   * - 春节 : une rosace de papier découpé rouge qui tourne lentement, autour d'une fenêtre
   *   ronde couleur papier, avec les pointillés du 米字格. Le caractère à l'encre.
   *
   * Props :
   * - `fete` : `'chunjie'` ou `'zhongqiu'`. Obligatoire.
   * - `c` : le caractère posé au centre. Ses traits viennent de l'export (`traitsDe`) ;
   *   sans traits, le centre reste vide — jamais une police.
   * - `cinabre` : les indices des traits en cinabre (la brique nouvelle). Défaut : aucun.
   * - `size` : le côté de l'emblème, en px. Défaut 160 ; le caractère en fait les deux tiers.
   * - `write` : le caractère s'écrit au pinceau à l'apparition. Défaut `true`.
   * - `pistes` : les familles où chercher les traits (`fetes.pistes`, ou les briques du
   *   parcours), pour éviter de relire toutes les familles.
   * - `children` : un contenu à poser au centre à la place du caractère (snippet).
   *
   * L'emblème porte `data-fete` : ses couleurs sont celles de la fête même hors d'une page
   * en fête. Deux emblèmes peuvent coexister : les id de clipPath sont uniques. Décoratif
   * pour les lecteurs d'écran, sauf le caractère, qui garde son nom. Coupé en mouvement si
   * l'on réduit les animations. Le cramoisi de fête (--fete) ne sert qu'à la rosace.
   */
  import type { Snippet } from 'svelte';
  import { traitsDe, type FeteId } from './content';
  import { glyph, type StrokeData } from './glyph';

  let {
    fete,
    c = '',
    cinabre = [],
    size = 160,
    write = true,
    pistes = [],
    children
  }: {
    fete: FeteId;
    c?: string;
    cinabre?: readonly number[];
    size?: number;
    write?: boolean;
    pistes?: readonly string[];
    children?: Snippet;
  } = $props();

  const uid = $props.id();
  const clip = `${uid}-mizi`;
  const taille = $derived(Math.round(size * 0.675));

  /* undefined : pas encore chargé ; null : pas de traits, le centre reste vide. */
  let data: StrokeData | null | undefined = $state(undefined);

  $effect(() => {
    const car = c;
    const p = pistes;
    if (car === '') {
      data = null;
      return;
    }
    let vivant = true;
    traitsDe(car, p)
      .then((d) => {
        if (vivant) data = d;
      })
      .catch(() => {
        if (vivant) data = null;
      });
    return () => {
      vivant = false;
    };
  });
</script>

<div class="emb {fete}" data-fete={fete} style="width:{size}px;height:{size}px">
  <svg class="fond" viewBox="0 0 168 168" aria-hidden="true">
    {#if fete === 'zhongqiu'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="80" /></clipPath></defs>
      <g class="lune">
        <circle cx="84" cy="84" r="82" fill="var(--moon)" />
        <g clip-path="url(#{clip})" stroke="var(--moon-shade)" stroke-width="1.2" stroke-dasharray="3 4" fill="none">
          <path d="M84 0v168M0 84h168M0 0l168 168M168 0L0 168" />
        </g>
        <g fill="var(--moon-shade)" opacity=".7">
          <circle cx="14" cy="70" r="6" />
          <circle cx="152" cy="96" r="5" />
          <circle cx="92" cy="12" r="4.5" />
          <circle cx="70" cy="10" r="3" />
        </g>
        <g class="lapin" fill="var(--moon-shade)">
          <ellipse cx="90" cy="156" rx="9" ry="6.5" />
          <circle cx="80.5" cy="151" r="4.6" />
          <path d="M78.6 147.6q-2.6-8.6.4-10q1.8 1.8.8 10zM81.8 147.2q1.4-8.4 4.6-8.6q.8 2-2.6 9z" />
        </g>
      </g>
      {#each [{ x: -18, y: 118, k: 1.1, cls: 'nuage1' }, { x: 128, y: 26, k: 0.9, cls: 'nuage2' }] as n (n.cls)}
        <g class={n.cls}>
          <g transform="translate({n.x} {n.y}) scale({n.k})">
            <path
              d="M0 14c0-6 5-9 10-7c1-7 11-9 15-3c3-4 11-3 12 3c5-1 9 3 8 7z"
              fill="var(--paper)"
              stroke="var(--moon-shade)"
              stroke-width="1.6"
            />
            <path
              d="M10 11.5c.6-3 5-3.4 5.6 0M25 10c.8-2.6 4.6-2.8 5 0"
              fill="none"
              stroke="var(--moon-shade)"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </g>
        </g>
      {/each}
    {:else}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="61" /></clipPath></defs>
      <g class="tourne">
        <g fill="var(--fete)">
          {#each FESTONS as f, i (i)}<circle cx={f.x} cy={f.y} r="14" />{/each}
          <circle cx="84" cy="84" r="72" />
        </g>
        {#each JOURS as t, i (i)}<path d="M0-5L3.2 0L0 5L-3.2 0Z" transform={t} fill="var(--paper)" />{/each}
        <circle cx="84" cy="84" r="66" fill="none" stroke="var(--paper)" stroke-width="2" stroke-dasharray="4 5" />
      </g>
      <circle cx="84" cy="84" r="61" fill="var(--card)" />
      <g clip-path="url(#{clip})" stroke="var(--grille)" stroke-width="1.2" stroke-dasharray="3 4" fill="none">
        <path d="M84 0v168M0 84h168M0 0l168 168M168 0L0 168" />
      </g>
    {/if}
  </svg>
  <div class="car">
    {#if children}
      {@render children()}
    {:else if data}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html glyph(c, data, taille, { write, cinabre })}
    {/if}
  </div>
</div>

<style>
  .emb {
    position: relative;
    flex-shrink: 0;
    line-height: 0;
    background: transparent;
  }
  .fond {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .car {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* la lune est claire, la nuit autour ne l'est pas : le caractère à l'encre de nuit, et le
     vrai cinabre, qui se lit sur la lune mieux que le cinabre éclairci de la nuit */
  .zhongqiu .car {
    --zhu: #c8371f;
    color: var(--nuit);
  }
  .zhongqiu .car :global(.g) {
    color: var(--nuit);
  }
  .chunjie .car :global(.g) {
    color: var(--ink);
  }
  .lune {
    transform-origin: 84px 84px;
    animation: lune 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .nuage1 {
    animation: passe 11s ease-in-out infinite alternate;
  }
  .nuage2 {
    animation: passe 14s ease-in-out -5s infinite alternate-reverse;
  }
  .lapin {
    animation: hopla 3.2s ease-in-out 1.8s infinite;
  }
  .tourne {
    transform-origin: 84px 84px;
    animation: rosace 60s linear infinite;
  }
  @keyframes lune {
    from { transform: translateY(40px) scale(0.7); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
  @keyframes passe {
    from { transform: translateX(-26px); }
    to { transform: translateX(22px); }
  }
  @keyframes hopla {
    0%, 80%, 100% { transform: none; }
    86% { transform: translateY(-6px); }
    92% { transform: none; }
  }
  @keyframes rosace {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .fond * {
      animation: none !important;
    }
  }
</style>
