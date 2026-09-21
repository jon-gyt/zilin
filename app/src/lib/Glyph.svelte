<script lang="ts">
  /* Un grand caractère, dessiné trait par trait depuis les données de traits, jamais depuis une police quand les données existent. */
  import { glyph, type StrokeData } from './glyph';
  let { c, data, size = 120, write, color }: { c: string; data: StrokeData | undefined; size?: number; write?: boolean; color?: string } = $props();
  const html = $derived(glyph(c, data, size, { write, color }));
</script>

{@html html}
