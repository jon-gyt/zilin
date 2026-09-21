<script lang="ts">
  import { steps, nextIndex, type SessionState } from './lib/session';
  let st: SessionState = $state({ done: [], catchup: false });
  const n = $derived(nextIndex(st));
</script>

<main class="screen">
  <h1>Aujourd'hui</h1>
  <p class="guide">Six pas, dix minutes, un seul bouton.</p>
  <ol class="path">
    {#each steps(st) as s, i}
      <li class:done={st.done[i]} class:now={i === n}><span>{s.t}</span><small>{s.m}</small></li>
    {/each}
  </ol>
  <button class="btn" onclick={() => { if (n >= 0) st.done[n] = true; }}>Continuer</button>
</main>
