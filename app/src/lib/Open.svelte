<script lang="ts">
  /**
   * Pas 1, Ouvrir : l'anecdote du jour, en estampe. Vingt secondes, sautable.
   * Le texte vient du JSON versionné de `app/public/data/`, jamais du code.
   */
  import Glyph from './Glyph.svelte';
  import { anecdoteDuJour, anecdotesOnce, type Anecdote } from './content';
  import { loadEstampe } from './estampe';

  let {
    jour,
    oncontinuer,
    onquitter
  }: { jour: string; oncontinuer: () => void; onquitter: () => void } = $props();

  /** Vingt secondes, puis la journée s'ouvre d'elle-même. Le bouton passe avant. */
  const DUREE_MS = 20000;

  let a: Anecdote | null = $state(null);
  /** Le SVG de l'estampe, posé en ligne pour que l'encre suive `currentColor`. */
  let estampe: string | null = $state(null);

  $effect(() => {
    const j = jour;
    let vivant = true;
    estampe = null;
    void anecdotesOnce()
      .then(async (f) => {
        if (!vivant) return;
        const choisie = anecdoteDuJour(f.anecdotes, j);
        a = choisie;
        if (!choisie?.estampe) return;
        const svg = await loadEstampe(choisie.estampe).catch(() => null);
        if (vivant) estampe = svg;
      })
      .catch(() => {
        if (vivant) a = null;
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    const t = setTimeout(oncontinuer, DUREE_MS);
    return () => clearTimeout(t);
  });
</script>

<main class="screen">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>

  <div class="anec">
    {#if a}
      <div class="water" aria-hidden="true"><Glyph char={a.c} size={420} /></div>
    {/if}

    <div class="sceau">
      <svg width="72" height="72" viewBox="0 0 200 200" aria-label="Zilin">
        <g fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 84h100L50 160h100" />
        </g>
        <circle cx="100" cy="42" r="13" fill="var(--zhu)" />
      </svg>
    </div>
    <div class="nom">Zilin <span class="cn hz">字林</span></div>

    {#if estampe}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="estampe" aria-hidden="true">{@html estampe}</div>
    {/if}

    {#if a}
      <div class="grand"><Glyph char={a.c} size={120} /></div>
      <h1>{a.titre}</h1>
      <p>{a.texte}</p>
    {/if}
  </div>

  <div class="foot">
    <button class="btn" onclick={oncontinuer}>Commencer la journée</button>
  </div>
</main>
