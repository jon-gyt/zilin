<script lang="ts">
  /**
   * Un grand caractère, dessiné trait par trait depuis les données de tracé (style 楷),
   * jamais depuis une police quand les données existent.
   *
   * Les tracés viennent de l'export versionné, `traits/<racine>.json` (472 caractères) ;
   * `strokes-demo.json` reste le repli pour ce que l'export ne porte pas encore.
   * `pistes` aide `content.racineDe` à trouver la famille sans tout relire : les écrans
   * de session y passent les briques déjà posées du parcours.
   */
  import { traitsDe } from './content';
  import { glyph, type StrokeData } from './glyph';

  let {
    char,
    size = 120,
    write = true,
    color,
    pistes = []
  }: {
    char: string;
    size?: number;
    write?: boolean;
    color?: string;
    pistes?: readonly string[];
  } = $props();

  /* undefined : pas encore chargé ; null : pas de données, repli sur la police. */
  let data: StrokeData | null | undefined = $state(undefined);

  $effect(() => {
    const c = char;
    const p = pistes;
    let vivant = true;
    traitsDe(c, p)
      .then((d) => { if (vivant) data = d; })
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
