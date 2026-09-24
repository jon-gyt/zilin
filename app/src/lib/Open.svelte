<script lang="ts">
  /**
   * Pas 1, Ouvrir : l'anecdote du jour, en estampe. Vingt secondes, sautable.
   * Le texte vient du JSON versionné de `app/public/data/`, jamais du code.
   *
   * Tao écoute l'anecdote assise (brief §9) : petite, dans le coin, sans un mot. Elle
   * est posée hors du flux, la mise en page de l'estampe ne bouge pas.
   */
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import { anecdoteDuJour, anecdotesOnce, type Anecdote } from './content';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    oncontinuer,
    onquitter
  }: { p: Progress; oncontinuer: () => void; onquitter: () => void } = $props();

  /** L'anecdote est celle de la journée de la session, pas celle de l'horloge. */
  const jour = $derived(p.day);
  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  /*
   * Aucune minuterie : l'anecdote se lit à son rythme, et la journée ne s'ouvre qu'au
   * tap. Les « 20 s » du brief sont un ordre de grandeur de lecture, pas un compte à
   * rebours. Retour du propriétaire : on n'avait pas le temps de lire.
   */

  let a: Anecdote | null = $state(null);

  $effect(() => {
    const j = jour;
    let vivant = true;
    void anecdotesOnce()
      .then((f) => {
        if (vivant) a = anecdoteDuJour(f.anecdotes, j);
      })
      .catch(() => {
        if (vivant) a = null;
      });
    return () => {
      vivant = false;
    };
  });

</script>

<main class="screen ouvrir">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>
  <div class="tao-assise"><Tao stade={taoStade} posture="anecdote" humeur={taoHumeur} size={56} /></div>

  <div class="anec">
    {#if a}
      <div class="water" aria-hidden="true"><Glyph char={a.c} size={420} /></div>
    {/if}

    <div class="sceau">
      <svg width="72" height="72" viewBox="0 0 200 200" aria-label="Wenlu">
        <g fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 84h100L50 160h100" />
        </g>
        <circle cx="100" cy="42" r="13" fill="var(--zhu)" />
      </svg>
    </div>
    <div class="nom">Wenlu <span class="cn hz">文路</span></div>

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
