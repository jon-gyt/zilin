<script lang="ts">
  /**
   * Les répliques d'un échange WeChat, une par ligne, à lire en entier. Une réplique
   * écartée passe en pointillé avec sa traduction, sans couleur d'alerte : on voit ce
   * qu'elle disait, et on en choisit une autre. Partagé par l'écran du jeu et le pas
   * Utiliser.
   */
  import { replique, type Echange } from './wechat';

  let {
    echange,
    choix,
    ecartees,
    onchoisir
  }: {
    echange: Echange;
    /** Les répliques, dans l'ordre mélangé du tour. */
    choix: readonly string[];
    ecartees: readonly string[];
    onchoisir: (zh: string) => void;
  } = $props();
</script>

<div class="repliques" aria-label="Tes répliques">
  {#each choix as zh (zh)}
    {@const r = replique(echange, zh)}
    <button class:ecartee={ecartees.includes(zh)} disabled={ecartees.includes(zh)} onclick={() => onchoisir(zh)}>
      <span class="zh" lang="zh-Hans">{zh}</span>
      {#if ecartees.includes(zh) && r}<small>« {r.fr} »</small>{/if}
    </button>
  {/each}
</div>

<style>
  .repliques {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }
  .repliques button {
    width: 100%;
    min-height: 50px;
    padding: 8px 14px;
    border: 1.5px solid var(--line);
    border-radius: 12px;
    background: var(--card);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .zh {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 19px;
    line-height: 1.4;
    color: var(--ink);
  }
  .repliques button.ecartee {
    border-style: dashed;
    border-color: var(--mist);
    background: transparent;
    opacity: 0.6;
    cursor: default;
  }
  small {
    font-size: 13px;
    color: var(--ink2);
  }
</style>
