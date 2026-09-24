<script lang="ts">
  /**
   * L'entrée « Tes trophées » de Ma forêt : combien sur combien, et le prochain. Le
   * calcul est celui du tableau (`trophees.ts`), sur le même contenu : les deux écrans
   * disent toujours la même chose.
   */
  import { contenuTrophees, type ContenuTropheesLu } from './content';
  import type { Progress } from './session';
  import { ligneEntree, tableau } from './trophees';

  let { p, onouvrir }: { p: Progress; onouvrir: () => void } = $props();

  let lu = $state<ContenuTropheesLu | null>(null);

  $effect(() => {
    let vivant = true;
    contenuTrophees()
      .then((c) => {
        if (vivant) lu = c;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const ligne = $derived(lu ? ligneEntree(tableau(p, lu)) : 'Ce que tu as su lire');
</script>

<button class="entree" onclick={onouvrir}>
  <span class="ico" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="M8.5 10L6 3h4l2 5M15.5 10L18 3h-4l-2 5" />
    </svg>
  </span>
  <span class="grow">
    <span class="t">Tes trophées</span>
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
