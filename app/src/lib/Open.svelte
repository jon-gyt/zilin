<script lang="ts">
  /**
   * Pas 1, Ouvrir : l'anecdote du jour, en estampe. Vingt secondes, sautable.
   * Le texte vient du JSON versionné de `app/public/data/`, jamais du code.
   *
   * Tao écoute l'anecdote assise (brief §9) : petite, dans le coin, sans un mot. Elle
   * est posée hors du flux, la mise en page de l'estampe ne bouge pas.
   *
   * Un jour de fête (`fetes.json`), l'anecdote est celle de la fête : sa rubrique
   * (« L'anecdote de la mi-automne »), et son caractère écrit au pinceau devant l'emblème
   * de la fête — la pleine lune, ou la rosace de papier découpé.
   */
  import Embleme from './Embleme.svelte';
  import Glyph from './Glyph.svelte';
  import Marque from './Marque.svelte';
  import Tao from './Tao.svelte';
  import { anecdoteDuJour, anecdotesOnce, fetesOnce, type Anecdote } from './content';
  import { feteDuJour, pistes, type FeteDuJour } from './fetes';
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
  /** La fête du jour, `null` un jour ordinaire. */
  let fete: FeteDuJour | null = $state(null);
  /** La famille du caractère de la fête : ses traits se lisent sans tout relire. */
  let pistesFete: string[] = $state([]);

  /*
   * L'anecdote du jour et les fêtes sont lues ensemble : un jour de fête, on ne montre
   * pas l'anecdote ordinaire le temps que la fête arrive.
   */
  $effect(() => {
    const j = jour;
    let vivant = true;
    void Promise.all([anecdotesOnce().catch(() => null), fetesOnce().catch(() => null)]).then(
      ([liste, fetes]) => {
        if (!vivant) return;
        const f = fetes ? feteDuJour(fetes, j) : null;
        fete = f;
        pistesFete = f && fetes ? pistes(fetes, f.anecdote.c) : [];
        a = f
          ? { c: f.anecdote.c, titre: f.anecdote.titre, texte: f.anecdote.texte }
          : liste
            ? anecdoteDuJour(liste.anecdotes, j)
            : null;
      }
    );
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
      <div class="water" aria-hidden="true"><Glyph char={a.c} size={420} pistes={pistesFete} /></div>
    {/if}

    <div class="sceau">
      <Marque size={72} />
    </div>
    <div class="nom">Wenlu <span class="cn hz">文路</span></div>

    {#if a && fete}
      <div class="k rubrique">{fete.anecdote.rubrique}</div>
      <div class="grand fete"><Embleme fete={fete.id} c={a.c} size={160} pistes={pistesFete} /></div>
      <h1>{a.titre}</h1>
      <p>{a.texte}</p>
    {:else if a}
      <div class="grand"><Glyph char={a.c} size={120} /></div>
      <h1>{a.titre}</h1>
      <p>{a.texte}</p>
    {/if}
  </div>

  <div class="foot">
    <button class="btn" onclick={oncontinuer}>Commencer la journée</button>
  </div>
</main>

<style>
  /* un jour de fête : la rubrique, puis l'emblème centré, le caractère écrit devant */
  .rubrique {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 6px 0 0;
  }
  .grand.fete {
    display: flex;
    justify-content: center;
    margin: 14px 0 2px;
  }
</style>
