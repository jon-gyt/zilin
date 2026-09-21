<script lang="ts">
  /** Un grand caractère, dessiné trait par trait depuis les données de tracé (style 楷), jamais depuis une police quand les données existent. */
  import { glyph, type StrokeData } from './glyph';
  import { strokesOnce } from './strokes';

  let {
    char,
    size = 120,
    write = true,
    color
  }: { char: string; size?: number; write?: boolean; color?: string } = $props();

  /* undefined : pas encore chargé ; null : pas de données, repli sur la police. */
  let data: StrokeData | null | undefined = $state(undefined);

  $effect(() => {
    const c = char;
    let vivant = true;
    strokesOnce()
      .then((s) => { if (vivant) data = s[c] ?? null; })
      .catch(() => { if (vivant) data = null; });
    return () => { vivant = false; };
  });
</script>

{#if data === undefined}
  <span class="g" style="width:{size}px;height:{size}px" aria-label={char}></span>
{:else}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html glyph(char, data ?? undefined, size, { write, color })}
{/if}
