<script lang="ts">
  import { steps, nextIndex, type SessionState } from './lib/session';
  import { loadStrokes, type StrokeSet } from './lib/strokes';
  import Glyph from './lib/Glyph.svelte';
  let st: SessionState = $state({ done: [], catchup: false });
  const n = $derived(nextIndex(st));
  /* Caractère du jour, écrit au pinceau à l'ouverture de l'écran. */
  const today = '住';
  let strokes: StrokeSet | undefined = $state();
  loadStrokes().then((s) => (strokes = s)).catch(() => (strokes = {}));
</script>

<main class="screen">
  <h1>Aujourd'hui</h1>
  <p class="guide">Six pas, dix minutes, un seul bouton.</p>
  <div class="today">
    {#if strokes}
      <Glyph c={today} data={strokes[today]} size={120} />
      <span class="k">Le caractère du jour</span>
    {/if}
  </div>
  <ol class="path">
    {#each steps(st) as s, i}
      <li class:done={st.done[i]} class:now={i === n}><span>{s.t}</span><small>{s.m}</small></li>
    {/each}
  </ol>
  <button class="btn" onclick={() => { if (n >= 0) st.done[n] = true; }}>Continuer</button>
</main>
