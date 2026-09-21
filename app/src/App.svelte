<script lang="ts">
  import { markDone, nextIndex, openDay, steps, type Progress, emptyProgress } from './lib/session';
  import { loadProgress, saveProgress, today } from './lib/db';

  let p: Progress = $state(emptyProgress(today()));
  const n = $derived(nextIndex(p));

  loadProgress().then((stored) => {
    p = openDay(stored, today());
  });

  /** Un tap : on marque le pas et on sauvegarde. */
  function tap() {
    if (n < 0) return;
    p = markDone(p, n, today());
    void saveProgress(p);
  }
</script>

<main class="screen">
  <h1>Aujourd'hui</h1>
  <p class="guide">Six pas, dix minutes, un seul bouton.</p>
  <ol class="path">
    {#each steps(p) as s, i (s.id + i)}
      <li class:done={p.done[i]} class:now={i === n}><span>{s.t}</span><small>{s.m}</small></li>
    {/each}
  </ol>
  <button class="btn" onclick={tap}>Continuer</button>
</main>
