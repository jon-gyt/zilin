<script lang="ts">
  /** Aujourd'hui : le chemin des six pas, un seul bouton en bas. */
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import { propose } from './jeux';
  import { allDone, buttonLabel, dayLabel, guide, nextIndex, steps, title, type Progress } from './session';
  import { humeur, poseDuJour, stade } from './tao';

  let {
    p,
    ontap,
    onjouer
  }: {
    p: Progress;
    ontap: () => void;
    /** Tao s'ennuie : elle propose un jeu. Une proposition, jamais un reproche. */
    onjouer: () => void;
  } = $props();

  /** Le caractère du jour. Démonstration, en attendant le contenu du pipeline `data/`. */
  const CARACTERE_DU_JOUR = '住';

  const liste = $derived(steps(p));
  const n = $derived(nextIndex(p));
  const pose = $derived(poseDuJour({ rattrapage: p.catchup, fini: allDone(p) }, humeur(p.tao.activites, p.day)));
  const stadeDeTao = $derived(stade(p.tao.croissance));
  const jeuPropose = $derived(propose(p, p.day));
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
    <div class="mood">
      <Tao stade={stadeDeTao} posture={pose.posture} humeur={pose.humeur} size={120} />
    </div>
  {/if}

  {#if jeuPropose}
    <button class="propose" onclick={onjouer}>
      <span class="grow">Tao propose un jeu.</span>
      <span class="k">Jouer</span>
    </button>
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
    <button class="btn" onclick={ontap}>{buttonLabel(p)}</button>
  </div>
</main>
