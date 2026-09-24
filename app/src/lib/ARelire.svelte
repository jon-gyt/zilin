<script lang="ts">
  /**
   * La mention « à relire » : posée à côté de chaque texte de l'aperçu (fiche ou conte que
   * le pipeline a écrit et que personne n'a encore relu), quand l'interrupteur des
   * Réglages est allumé. Rien ne s'affiche pour un texte relu ou de démonstration.
   * `bloc` la pose sur sa propre ligne, sous le texte qu'elle qualifie.
   */
  import { mention, type SourceTextes } from './content';

  let {
    de,
    bloc = false
  }: { de: { statut?: string; source?: SourceTextes } | null | undefined; bloc?: boolean } =
    $props();

  const texte = $derived(mention(de));
</script>

{#if texte}
  {#if bloc}
    <div class="bloc"><span class="mention" title="Texte pas encore relu">{texte}</span></div>
  {:else}
    <span class="mention" title="Texte pas encore relu">{texte}</span>
  {/if}
{/if}

<style>
  .bloc {
    margin-top: 10px;
  }
</style>
