<script lang="ts">
  /**
   * L'en-tête de chaque pas : « Quitter », qui sauvegarde et ramène au menu sans
   * question, puis la barre des coups de pinceau, la même que sur le menu. Les pas
   * s'enchaînent sans repasser par le menu ; cette barre dit où l'on en est.
   * `lien` : un retour à l'intérieur du pas (la brique, depuis le composé).
   */
  import Pinceaux from './Pinceaux.svelte';
  import { coups } from './parcours';
  import { nextIndex, steps, type Progress } from './session';

  let {
    p,
    onquitter,
    lien = null
  }: {
    p: Progress;
    onquitter: () => void;
    lien?: { texte: string; action: () => void } | null;
  } = $props();

  const barre = $derived(coups(p));
  const label = $derived.by(() => {
    const n = nextIndex(p);
    const s = n < 0 ? null : steps(p)[n];
    if (s === null) return '';
    return p.catchup ? `Bloc ${n + 1}` : `Pas ${n + 1} sur ${barre.length} · ${s.t}`;
  });
</script>

<header class="entete-pas">
  <div class="ligne">
    <button class="k quit" onclick={onquitter}>✕ Quitter</button>
    {#if lien}
      <button class="k quit" onclick={lien.action}>{lien.texte}</button>
    {/if}
  </div>
  <Pinceaux coups={barre} {label} />
</header>

<style>
  .entete-pas {
    margin: -6px 0 16px;
  }
  .ligne {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
</style>
