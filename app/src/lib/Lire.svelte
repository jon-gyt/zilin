<script lang="ts">
  /**
   * Lire, depuis le menu : les contes de l'export, réécrits à chaque seuil avec les seuls
   * caractères du seuil (brief §7). L'export n'en porte encore aucun (story 1.7) : l'écran
   * le dit simplement, sans rien feindre. Le texte du jour se lit dans la session, au pas
   * Utiliser. Un seul retour, vers le menu. Tao lit par-dessus l'épaule.
   */
  import Tao from './Tao.svelte';
  import { contenu, type IndexConte } from './content';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let { p, onretour }: { p: Progress; onretour: () => void } = $props();

  let contes = $state<IndexConte[] | null>(null);

  $effect(() => {
    let vivant = true;
    void contenu()
      .then((i) => {
        if (vivant) contes = i.contes;
      })
      .catch(() => {
        if (vivant) contes = [];
      });
    return () => {
      vivant = false;
    };
  });

  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
</script>

<main class="screen">
  <button class="k quit" onclick={onretour}>‹ Retour</button>

  <div class="verif-tete">
    <div class="grow">
      <h1>Lire</h1>
      <p class="guide">Uniquement avec les caractères que tu sais lire.</p>
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
  </div>

  {#if contes === null}
    <p class="guide">Un instant.</p>
  {:else if contes.length === 0}
    <div class="card">
      <div style="font-weight:600">Les contes ne sont pas encore écrits.</div>
      <p class="k">
        Ils arriveront ici, chacun réécrit à ton niveau. En attendant, le texte du jour se lit
        dans la session, au pas Utiliser.
      </p>
    </div>
  {:else}
    <div class="card">
      {#each contes as c (c.id)}
        <div class="conte">
          <div style="font-weight:600">{c.titre_fr}</div>
          <div class="k">Au seuil {c.seuils[0] ?? ''}</div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  .conte {
    padding: 10px 0;
  }
  .conte + .conte {
    border-top: 1px solid var(--line);
  }
</style>
