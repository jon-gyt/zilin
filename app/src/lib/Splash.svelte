<script lang="ts">
  /**
   * Ouverture : le logo s'écrit en 1,6 s, puis on passe tout seul. Un tap passe avant.
   * Le Z est tracé en un trait, le point cinabre se pose à la fin, le nom vient après.
   * Sous `prefers-reduced-motion`, rien ne bouge : le logo est là, entier, et on passe pareil.
   */
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
    <svg width="160" height="160" viewBox="0 0 200 200" aria-hidden="true">
      <path
        class="zs"
        d="M50 84h100L50 160h100"
        fill="none"
        stroke="var(--ink)"
        stroke-width="18"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle class="zd" cx="100" cy="42" r="13" fill="var(--zhu)" />
    </svg>
    <div class="zt">
      <span class="nom">Zilin</span>
      <span class="cn hz">字林</span>
    </div>
  </button>
</main>
