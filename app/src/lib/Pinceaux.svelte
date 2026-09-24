<script lang="ts" module>
  /**
   * Un coup de pinceau horizontal (横) : tête appuyée, corps qui s'affine, queue relevée.
   * Trois variantes, pour l'irrégularité de la main (prototype validé, `BRUSH`).
   */
  export const BRUSH = [
    'M1 6.2C1 3.4 3.4 2.2 7 2.9C28 4.6 58 4.1 88 3.2C94 3 99 4.4 99 6.8C99 8.9 96.4 9.7 92 9.2C64 8.2 36 8.6 8 9.8C3.6 10 1 8.8 1 6.2Z',
    'M1 5.8C1.2 3.1 3.8 2.4 7.5 3.3C30 5 60 4.6 89 3.8C95 3.6 99 5 99 7.1C98.8 9.2 96 9.8 91 9.1C66 8.4 36 8.9 8.5 9.6C3.8 9.8 .9 8.3 1 5.8Z',
    'M1 6.6C.9 3.8 3.2 2.5 6.6 3.1C29 4.2 57 3.9 87 3.4C93.6 3.3 99 4.7 99 6.9C99 9 96.8 10 92.4 9.5C63 8.5 35 8.3 7.6 9.5C3.4 9.7 1.1 8.9 1 6.6Z'
  ] as const;
</script>

<script lang="ts">
  /**
   * La barre de la session : un coup de pinceau par pas. Les pas faits en jade, le pas en
   * cours à l'encre, les pas à venir en filet. La même sur le menu et en tête des pas.
   * Ni cinabre ni animation : elle dit où l'on en est, rien d'autre.
   */
  import type { Coup } from './parcours';

  let { coups, label = '' }: { coups: readonly Coup[]; label?: string } = $props();
</script>

<div class="pinceaux" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}>
  {#each coups as c, i (i)}
    <svg class={c} viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
      <path d={BRUSH[i % BRUSH.length]} />
    </svg>
  {/each}
</div>

<style>
  .pinceaux {
    display: flex;
    gap: 5px;
  }
  svg {
    flex: 1;
    width: 0;
    min-width: 0;
    height: 11px;
    display: block;
    overflow: visible;
  }
  path {
    fill: var(--line);
  }
  .fait path {
    fill: var(--jade);
  }
  .encours path {
    fill: var(--ink);
  }
</style>
