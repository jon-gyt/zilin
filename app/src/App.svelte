<script lang="ts">
  /** L'aiguillage : un état d'écran, la progression partagée, rien d'autre. */
  import Open from './lib/Open.svelte';
  import Today from './lib/Today.svelte';
  import {
    allDone,
    currentStep,
    emptyProgress,
    markDone,
    nextIndex,
    openDay,
    resetDay,
    type Progress
  } from './lib/session';
  import { loadProgress, saveProgress, today } from './lib/db';

  /** Un écran par pas, au fur et à mesure des stories. Pas de routeur. */
  type Ecran = 'home' | 'anec';

  let p: Progress = $state(emptyProgress(today()));
  let ecran: Ecran = $state('home');

  /** Au démarrage : on relit la progression et on ouvre la journée. */
  void loadProgress().then((stored) => {
    const ouvert = openDay(stored, today());
    p = ouvert;
    if (ouvert !== stored) void saveProgress(ouvert);
  });

  /** Sauvegarde à chaque tap. */
  function enregistrer(): void {
    void saveProgress($state.snapshot(p));
  }

  /** Marque le pas courant fait, s'il en reste un. */
  function fairePasCourant(): void {
    const n = nextIndex(p);
    if (n >= 0) p = markDone(p, n, today());
  }

  /**
   * Un tap, un seul bouton. La journée finie, on recommence ; sinon on ouvre l'écran
   * du pas courant quand il existe, et à défaut on le marque fait, le temps que les
   * écrans suivants arrivent (stories 2.4 et suivantes).
   */
  function tap(): void {
    if (allDone(p)) {
      p = resetDay(p);
      enregistrer();
      return;
    }
    if (currentStep(p)?.go === 'anec') {
      ecran = 'anec';
      return;
    }
    fairePasCourant();
    enregistrer();
  }

  /** L'anecdote vue ou passée : le pas Ouvrir est fait, retour au chemin. */
  function ouvrirFait(): void {
    if (currentStep(p)?.go === 'anec') fairePasCourant();
    ecran = 'home';
    enregistrer();
  }

  /** Quitter : retour au chemin sans question, la progression est sauvegardée. */
  function quitter(): void {
    ecran = 'home';
    enregistrer();
  }
</script>

{#if ecran === 'anec'}
  <Open jour={today()} oncontinuer={ouvrirFait} onquitter={quitter} />
{:else}
  <Today {p} ontap={tap} />
{/if}
