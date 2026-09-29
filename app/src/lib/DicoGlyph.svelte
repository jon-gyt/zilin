<script module lang="ts">
  import { dictionnaire, traitsDe } from './content';
  import type { StrokeData } from './glyph';

  /** Les tracés déjà demandés, par caractère : une demande chacun pour la vie de l'app. */
  const demandes = new Map<string, Promise<StrokeData | null>>();

  /**
   * Les tracés d'un caractère du dictionnaire : son lot `traits/dico-<n>.json`, par le
   * chargeur du dictionnaire (`ChargeurDico.traits`), qui ne lit que les assets de l'app ;
   * sinon la famille ou la démonstration (`content.traitsDe`).
   */
  export function traitsDuDico(c: string): Promise<StrokeData | null> {
    let p = demandes.get(c);
    if (!p) {
      p = (async () => {
        const d = await dictionnaire().catch(() => null);
        const x = d === null ? null : await d.traits(c).catch(() => null);
        return x ?? (await traitsDe(c).catch(() => null));
      })();
      demandes.set(c, p);
    }
    return p;
  }
</script>

<script lang="ts">
  /**
   * Un caractère du dictionnaire, dessiné depuis ses traits (style 楷), jamais depuis une
   * police tant que les traits existent. `paresseux` : les traits ne se demandent que quand
   * le dessin approche de l'écran (une longue liste de résultats ne charge que ce qu'on
   * voit). `write` : il s'écrit au pinceau à l'apparition (`tokens.css`, `.g.write`), sauf si
   * l'on réduit les animations.
   */
  import { glyph } from './glyph';

  let {
    c,
    size = 44,
    write = false,
    color,
    label,
    paresseux = false
  }: {
    c: string;
    size?: number;
    write?: boolean;
    color?: string;
    /** Le nom pour un lecteur d'écran ; vide, un décor. Par défaut, le caractère. */
    label?: string;
    paresseux?: boolean;
  } = $props();

  /* undefined : pas encore chargé ; null : pas de traits, repli en police. */
  let data: StrokeData | null | undefined = $state(undefined);
  let hote: HTMLSpanElement | undefined = $state();
  let proche = $state(false);

  $effect(() => {
    if (!paresseux || proche || !hote) return;
    if (typeof IntersectionObserver === 'undefined') {
      proche = true;
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) proche = true;
      },
      { rootMargin: '240px 0px' }
    );
    io.observe(hote);
    return () => io.disconnect();
  });

  $effect(() => {
    const x = c;
    if (paresseux && !proche) return;
    let vivant = true;
    data = undefined;
    void traitsDuDico(x).then((d) => {
      if (vivant) data = d;
    });
    return () => {
      vivant = false;
    };
  });

  const nom = $derived(label ?? c);
</script>

<span class="dg" bind:this={hote} style="width:{size}px;height:{size}px">
  {#if data !== undefined}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html glyph(c, data ?? undefined, size, { write, color, label: nom })}
  {:else if nom !== ''}
    <span class="attente" role="img" aria-label={nom}></span>
  {/if}
</span>

<style>
  .dg {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    flex: none;
    vertical-align: middle;
  }
  .attente {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
