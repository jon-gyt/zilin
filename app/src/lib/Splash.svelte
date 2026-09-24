<script lang="ts">
  /**
   * Ouverture : le logo s'écrit en 1,6 s, puis on passe tout seul. Un tap passe avant.
   * 文 s'écrit trait par trait depuis ses données de tracé, le point cinabre d'abord,
   * puis le nom vient.
   * Sous `prefers-reduced-motion`, rien ne bouge : le logo est là, entier, et on passe pareil.
   */
  import Marque from './Marque.svelte';

  let { onfini }: { onfini: () => void } = $props();

  /** 1,6 s : la durée annoncée par le brief, tracé compris. */
  const DUREE_MS = 1600;

  $effect(() => {
    const t = setTimeout(onfini, DUREE_MS);
    return () => clearTimeout(t);
  });
</script>

<main class="screen ouverture">
  <button class="splash" onclick={onfini} aria-label="Passer">
    <Marque size={160} write />
    <div class="zt">
      <span class="nom">Wenlu</span>
      <span class="cn hz">文路</span>
    </div>
  </button>
</main>
