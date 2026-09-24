<script lang="ts" module>
  /** La marque de Wenlu : 文, l'écrit. */
  export const MARQUE = '文';
  /** Le trait en cinabre : le premier, le point 丶 (indice 0 dans les données de traits). */
  export const TRAITS_CINABRE: readonly number[] = [0];
</script>

<script lang="ts">
  /**
   * La marque : 文 tracé depuis les données de traits de l'export (style 楷), comme tout
   * grand caractère, le point 丶 en cinabre. Jamais depuis une police : tant que les
   * traits ne sont pas lus, ou s'ils manquent, la place reste vide à la bonne taille.
   * `write` la fait s'écrire trait par trait, le point d'abord (ouverture).
   */
  import { traitsDe } from './content';
  import { glyph, type StrokeData } from './glyph';

  let { size = 30, write = false }: { size?: number; write?: boolean } = $props();

  /* undefined : pas encore chargé ; null : pas de données, la place reste vide. */
  let data: StrokeData | null | undefined = $state(undefined);

  $effect(() => {
    let vivant = true;
    traitsDe(MARQUE)
      .then((d) => { if (vivant) data = d; })
      .catch(() => { if (vivant) data = null; });
    return () => { vivant = false; };
  });
</script>

{#if data}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html glyph(MARQUE, data, size, { write, cinabre: TRAITS_CINABRE, label: 'Wenlu' })}
{:else}
  <span class="g" style="width:{size}px;height:{size}px" role="img" aria-label="Wenlu"></span>
{/if}
