<script lang="ts">
  /**
   * Un tour du dictionnaire éclair (story 4b.4), posé par l'écran hôte des jeux.
   *
   * D'abord le mot, ses deux caractères dessinés depuis leurs traits : c'est ce qu'on
   * lit. Puis quatre sens, un seul juste, tous tirés de `eclair.json`. La réponse
   * donnée, le mot se réécrit au pinceau, avec son pinyin et son sens, et chacun de ses
   * deux caractères dit ce qu'il apporte : on voit pourquoi 火 et 车 font le train.
   * Pas de chronomètre, pas de vie ; le cinabre ne marque rien ici.
   */
  import Glyph from './Glyph.svelte';
  import { glose, type CorpusJeux, type Resultat, type Tour } from './jeux';
  import { motDe } from './eclair';

  let {
    t,
    corpus,
    resultat,
    donnee,
    onchoisir
  }: {
    t: Tour;
    corpus: CorpusJeux;
    /** Le tour noté, `null` tant qu'on n'a pas répondu. */
    resultat: Resultat | null;
    /** Ce qui a été répondu : la correction montre où l'on s'est trompé. */
    donnee: readonly string[];
    onchoisir: (sens: string) => void;
  } = $props();

  const mot = $derived(motDe(t, corpus));
  const signes = $derived(mot ? [...mot.mot] : []);
</script>

<div class="mot" aria-label={mot?.mot ?? ''}>
  {#each signes as c, k (c + k + (resultat === null ? '' : '/ecrit'))}
    <span class="signe">
      <Glyph char={c} size={84} write={resultat !== null} />
      {#if resultat !== null}
        {@const g = glose(c, corpus)}
        <small>
          {#if g.pinyin !== ''}<span class="py">{g.pinyin}</span>{/if}
          {#if g.fr !== ''}{g.fr}{/if}
        </small>
      {/if}
    </span>
  {/each}
</div>

{#if resultat !== null && mot}
  <p class="sens">
    {#if mot.pinyin !== ''}<span class="py">{mot.pinyin}</span>{/if}
    <b>{mot.fr}</b>
  </p>
{:else}
  <p class="consigne">{t.enonce}</p>
{/if}

<div class="choices">
  {#each t.choix as s, k (s + k)}
    <button
      class="txt"
      class:ok={resultat !== null && s === t.reponse[0]}
      class:ko={resultat !== null && !resultat.correct && donnee[0] === s}
      disabled={resultat !== null}
      onclick={() => onchoisir(s)}
    >
      {s}
    </button>
  {/each}
</div>

<style>
  .mot {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin: 4px 0 6px;
  }
  .signe {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    max-width: 120px;
  }
  .signe small {
    font-size: 13px;
    line-height: 1.25;
    color: var(--ink2);
    text-align: center;
  }
  .signe small .py {
    font-size: 13px;
    margin-right: 4px;
  }
  .sens {
    margin: 0;
    text-align: center;
    font-size: 17px;
  }
  .sens .py {
    font-family: var(--head);
    font-weight: 500;
    font-size: 17px;
    margin-right: 8px;
  }
  .consigne {
    text-align: center;
  }
</style>
