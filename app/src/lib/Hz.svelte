<script lang="ts">
  /**
   * Un caractère dans une ligne de texte : en police (Noto Serif SC) quand elle l'a, sinon
   * dessiné depuis ses traits à la taille du texte. Un composant sans point de code
   * (⿰𠄌丶) ou hors du plan de base (𠂒, 𠃊, 𭃂) serait un carré vide ou une suite
   * d'opérateurs IDS : `horsPolice` le dit, et `Glyph` le trace.
   */
  import Glyph from './Glyph.svelte';
  import { horsPolice } from './glyph';

  let {
    c,
    size = 20,
    pistes = []
  }: {
    c: string;
    /** La taille en pixels, celle de la police autour. */
    size?: number;
    pistes?: readonly string[];
  } = $props();
</script>

{#if horsPolice(c)}<span class="hz-trace"><Glyph char={c} {size} write={false} color="currentColor" {pistes} /></span
  >{:else}<span class="hz">{c}</span>{/if}

<style>
  .hz-trace {
    display: inline-block;
    line-height: 1;
    vertical-align: -0.1em;
  }
</style>
