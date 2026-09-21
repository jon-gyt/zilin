<script lang="ts">
  /**
   * Récompenses : ce que la série a déjà donné et ce que Que 雀 apporte au palier suivant.
   * L'écran vit dans Ma forêt ; il ne se lance pas de lui-même.
   *
   * Les jours de repos se disent comme une protection, jamais comme une punition, et rien
   * ici ne compte les jours manqués. Les quatre paliers sont ceux du brief, pas un de plus.
   */
  import Que from './Que.svelte';
  import type { Progress } from './session';
  import {
    CADEAUX,
    NOTE_REMISE,
    PALIERS,
    PHRASE_REPOS,
    etatSerie,
    libelleJours,
    libelleReserve,
    messageSemaine
  } from './serie';

  let { p, onretour }: { p: Progress; onretour: () => void } = $props();

  const s = $derived(etatSerie(p.joursTravailles, p.day));
</script>

<main class="screen">
  <button class="k quit" onclick={onretour}>‹ Ma forêt</button>

  <h1>Ta forêt pousse</h1>
  <p class="guide">
    Chaque jour travaillé plante une graine. Sept graines, un arbre. Et un arbre, ça se récompense.
  </p>

  <div class="card">
    <div class="row">
      <div class="grow">
        <div class="big">{s.jours}</div>
        <div class="k">{libelleJours(s)}</div>
      </div>
      <div class="grow">
        <div class="big">{s.reserve}</div>
        <div class="k">{libelleReserve(s)}</div>
      </div>
    </div>
    <div class="seeds" aria-hidden="true">
      {#each s.semaine as g (g.jour)}
        <i class:on={g.travaille} class:today={g.aujourdhui}>{g.lettre}</i>
      {/each}
    </div>
    <div class="k">{messageSemaine(s)}</div>
    <div class="k repos">{PHRASE_REPOS}</div>
  </div>

  <div class="card">
    <div class="k porteur">
      <Que size={34} pose="pose" />
      <span>Les cadeaux sont remis par Que 雀, le moineau, qui attend sur le chemin.</span>
    </div>
    {#each PALIERS as m (m)}
      {@const obtenu = s.atteints.includes(m)}
      <div class="mile" class:got={obtenu}>
        <span class="n">{m} j</span>
        <div class="grow">
          <div class="t">{CADEAUX[m].titre}</div>
          <div class="d">
            {CADEAUX[m].detail}
            {#if CADEAUX[m].remise}{NOTE_REMISE}{/if}
          </div>
        </div>
        {#if obtenu}
          <span class="pill got">reçu</span>
        {:else if m === s.prochain}
          <span class="pill new">dans {s.restant} j</span>
        {/if}
      </div>
    {/each}
  </div>
</main>
