<script module lang="ts">
  /** Les trois onglets du brief : Aujourd'hui (le chemin), Ma forêt, Réglages. */
  export type Onglet = 'home' | 'foret' | 'reglages';
</script>

<script lang="ts">
  /**
   * La barre des trois onglets. Elle ne se montre jamais pendant les pas d'une
   * session (App.svelte s'en charge). Icônes reprises de la maquette (`id="tabs"`) :
   * un trait, pas d'emoji.
   */
  let { onglet, onchoisir }: { onglet: Onglet; onchoisir: (o: Onglet) => void } = $props();
</script>

<nav class="tabs" aria-label="Sections">
  <button
    class="tab"
    class:on={onglet === 'home'}
    aria-current={onglet === 'home' ? 'page' : undefined}
    onclick={() => onchoisir('home')}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 20V10M6 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8M18 4v10M18 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8" />
    </svg>
    Aujourd'hui
  </button>
  <button
    class="tab"
    class:on={onglet === 'foret'}
    aria-current={onglet === 'foret' ? 'page' : undefined}
    onclick={() => onchoisir('foret')}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21V11M4 11c0-5 4-8 8-8s8 3 8 8H4z" />
    </svg>
    Ma forêt
  </button>
  <button
    class="tab"
    class:on={onglet === 'reglages'}
    aria-current={onglet === 'reglages' ? 'page' : undefined}
    onclick={() => onchoisir('reglages')}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
      />
    </svg>
    Réglages
  </button>
</nav>
