<script lang="ts">
  /**
   * Pas 6, Clore : le constat en une ligne, la graine plantée, le rendez-vous de demain.
   * C'est un moment d'émotion : Tao est là, en joie.
   *
   * La graine est une animation sobre, encre et jade (maquette `.seed`) : ni dégradé,
   * ni ombre. Le rendez-vous se donne sans heure tant que le réglage n'existe pas.
   */
  import Tao from './Tao.svelte';
  import { compose, familleOnce, type Famille } from './content';
  import { constat, rendezVous, type Progress } from './session';
  import { stade } from './tao';

  let {
    p,
    onterminer,
    onquitter
  }: { p: Progress; onterminer: () => void; onquitter: () => void } = $props();

  /** Les cinq écrans de la leçon dans la maquette ; Clore est le cinquième. */
  const PAS_LECON = 5;
  const RANG = 4;

  let f = $state(null as Famille | null);

  $effect(() => {
    let vivant = true;
    void familleOnce()
      .then((x) => {
        if (vivant) f = x;
      })
      .catch(() => {
        if (vivant) f = null;
      });
    return () => {
      vivant = false;
    };
  });

  /** Le caractère du jour : le composé de la session. */
  const c = $derived(f ? (compose(f)?.c ?? f.racine.c) : '');
  const taoStade = $derived(stade(p.tao.croissance));
</script>

<main class="screen">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>

  <div class="dots" aria-hidden="true">
    {#each { length: PAS_LECON } as _, i (i)}
      <i class:on={i < RANG} class:cur={i === RANG}></i>
    {/each}
  </div>

  <div class="mood">
    <Tao stade={taoStade} posture="chemin" humeur="joie" size={96} />
  </div>

  <div class="card center clore">
    <div class="seed" aria-hidden="true">
      <svg viewBox="0 0 120 120" width="120" height="120">
        <line x1="10" y1="92" x2="110" y2="92" stroke="var(--line)" stroke-width="3" stroke-linecap="round" />
        <circle class="sd" cx="60" cy="20" r="6" fill="var(--ink)" />
        <path class="st" d="M60 92 V60" stroke="var(--jade)" stroke-width="4" stroke-linecap="round" fill="none" />
        <path
          class="lf"
          d="M60 66 Q46 62 44 50 M60 66 Q74 62 76 50"
          stroke="var(--jade)"
          stroke-width="4"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
    </div>
    {#if c}<h1>{c} entre dans ta forêt.</h1>{/if}
    <p class="guide">{rendezVous()}</p>
    <div class="k">{constat(p, p.day)}</div>
  </div>

  <div class="foot"><button class="btn" onclick={onterminer}>Voir ta série</button></div>
</main>
