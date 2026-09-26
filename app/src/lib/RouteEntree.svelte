<script lang="ts">
  /**
   * L'entrée « La route devant 前路 » de Ma forêt : l'étape qui suit, sa brique dessinée
   * depuis ses traits et son premier sens. La position vient de `route.ts`, en jours du
   * chemin ; la brique, de la leçon de l'export (`content.lecon`, sauts compris).
   */
  import Glyph from './Glyph.svelte';
  import { lecon, type FicheLue } from './content';
  import { positionDuJour, premierSens, quand } from './route';
  import type { Progress } from './session';

  let { p, onouvrir }: { p: Progress; onouvrir: () => void } = $props();

  const position = $derived(positionDuJour(p));
  let suite = $state.raw<{ f: FicheLue; pistes: string[] } | null>(null);

  $effect(() => {
    const jour = position.jour + 1;
    const choisi = p.parcours;
    let vivant = true;
    void lecon(choisi, jour)
      .then((l) => {
        const f = l.brique ?? l.composes[0] ?? null;
        if (vivant) suite = f === null ? null : { f, pistes: l.pistes };
      })
      .catch(() => {
        if (vivant) suite = null;
      });
    return () => {
      vivant = false;
    };
  });

  const quandSuite = $derived(quand(1, position.sur));
</script>

<button class="entree" onclick={onouvrir}>
  <span class="ico" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d="M3 20.5l6-10 3.5 5 2.5-3.5 6 8.5z" />
      <path d="M12 20.5q-2-3 1-5.5t0-6" />
    </svg>
  </span>
  <span class="grow">
    <span class="t">La route devant <span class="zh" lang="zh-Hans">前路</span></span>
    <span class="d">
      {#if suite}
        <span class="cap">{quandSuite}</span> :
        <span class="gl"><Glyph char={suite.f.c} size={17} write={false} color="var(--ink)" pistes={suite.pistes} /></span>
        {premierSens(suite.f.fr)}{suite.f.fr === '' ? suite.f.pinyin : ''}
      {:else}
        Les prochaines étapes du chemin
      {/if}
    </span>
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
  .zh {
    font-family: var(--hz);
    font-weight: 500;
    color: var(--ink2);
    margin-left: 2px;
  }
  .d {
    display: block;
    font-size: 14.5px;
    color: var(--ink2);
    line-height: 1.3;
    margin-top: 1px;
  }
  .cap {
    display: inline-block;
  }
  .cap::first-letter {
    text-transform: uppercase;
  }
  .gl {
    display: inline-flex;
    vertical-align: -3px;
    line-height: 0;
  }
</style>
