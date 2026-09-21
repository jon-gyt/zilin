<script lang="ts">
  import Glyph from './lib/Glyph.svelte';
  import Miao from './lib/Miao.svelte';
  import {
    allDone,
    buttonLabel,
    dayLabel,
    emptyProgress,
    guide,
    markDone,
    miaoPose,
    nextIndex,
    openDay,
    resetDay,
    steps,
    title,
    type Progress
  } from './lib/session';
  import { loadProgress, saveProgress, today } from './lib/db';

  /** Le caractère du jour. Démonstration, en attendant le contenu du pipeline `data/`. */
  const CARACTERE_DU_JOUR = '住';

  let p: Progress = $state(emptyProgress(today()));
  const liste = $derived(steps(p));
  const n = $derived(nextIndex(p));
  const pose = $derived(miaoPose(p));

  /** Au démarrage : on relit la progression et on ouvre la journée. */
  void loadProgress().then((stored) => {
    const ouvert = openDay(stored, today());
    p = ouvert;
    if (ouvert !== stored) void saveProgress(ouvert);
  });

  /**
   * Un tap, un seul bouton. La journée finie, on recommence ; sinon on avance
   * d'un pas. Sauvegarde à chaque tap. La navigation vers chaque pas arrive
   * avec les stories 2.3 et suivantes.
   */
  function tap(): void {
    if (allDone(p)) p = resetDay(p);
    else if (n >= 0) p = markDone(p, n, today());
    void saveProgress(p);
  }
</script>

<main class="screen">
  <div class="brand">
    <span class="mark">
      <svg width="30" height="30" viewBox="0 0 200 200" aria-label="Zilin">
        <g fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 84h100L50 160h100" />
        </g>
        <circle cx="100" cy="42" r="13" fill="var(--zhu)" />
      </svg>
    </span>
    <span class="name">Zilin</span>
    <span class="cn hz">字林</span>
    <span class="k day">{dayLabel(p)}</span>
  </div>

  <h1>{title(p)}</h1>
  <p class="guide">{guide(p)}</p>

  {#if pose}
    <div class="mood"><Miao {pose} size={110} /></div>
  {/if}

  <div class="path">
    {#each liste as s, i (s.id + i)}
      <div class="node" class:done={p.done[i]} class:now={i === n} class:lock={!s.go}>
        <div class="grow">
          <div class="t">{s.t}</div>
          {#if i === n || !s.go}<div class="d">{s.d}</div>{/if}
        </div>
        {#if s.m}<span class="k">{s.m}</span>{/if}
      </div>
    {/each}
  </div>

  {#if !pose}
    <div class="today"><Glyph char={CARACTERE_DU_JOUR} size={110} /></div>
  {/if}

  <div class="foot">
    <button class="btn" onclick={tap}>{buttonLabel(p)}</button>
  </div>
</main>
