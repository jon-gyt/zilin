<script lang="ts">
  /**
   * L'entrée « Tes révisions » de Ma forêt : combien de cartes reviennent demain et sur les
   * sept jours. Le calcul est celui du tableau (`stats.ts`), sur les mêmes cartes : les deux
   * écrans disent toujours la même chose. Les textes viennent du pipeline (`ecrans.json`).
   */
  import { ecransOnce, SANS_ECRANS, type TextesRevisions } from './ecrans';
  import type { Progress } from './session';
  import { aVenir, ligneEntree } from './stats';

  let { p, onouvrir }: { p: Progress; onouvrir: () => void } = $props();

  let t = $state<TextesRevisions>(SANS_ECRANS.revisions);
  $effect(() => {
    let vivant = true;
    ecransOnce()
      .then((e) => {
        if (vivant) t = e.revisions;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const ligne = $derived(ligneEntree(t, aVenir(p.cartes, new Date(), p.enAttente)));
</script>

<button class="entree" onclick={onouvrir}>
  <span class="ico" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d="M4 20h16" />
      <path d="M6.5 20v-6M10.5 20V9M14.5 20v-4M18.5 20V6" />
    </svg>
  </span>
  <span class="grow">
    <span class="t">{t.entree}</span>
    <span class="d">{ligne}</span>
  </span>
  <span class="chev" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
  </span>
</button>

<style>
  .entree {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 66px;
    margin-top: 14px;
    padding: 12px 14px;
    background: var(--card);
    border-radius: 12px;
    text-align: left;
  }
  .entree:active {
    background: var(--indigo-soft);
  }
  .ico {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink2);
    flex-shrink: 0;
  }
  svg {
    display: block;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ico svg {
    width: 24px;
    height: 24px;
  }
  .chev {
    color: var(--mist);
    flex-shrink: 0;
  }
  .chev svg {
    width: 18px;
    height: 18px;
  }
  .t {
    display: block;
    font-weight: 600;
    line-height: 1.25;
  }
  .d {
    display: block;
    font-size: 14.5px;
    color: var(--ink2);
    line-height: 1.3;
    margin-top: 1px;
  }
</style>
