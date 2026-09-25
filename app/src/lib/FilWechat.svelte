<script lang="ts">
  /**
   * Le fil d'une conversation WeChat : l'ami à gauche, sur la carte ; la réplique choisie à
   * droite, sur l'indigo pâle. Partagé par l'écran du jeu (`WeChat.svelte`) et le pas
   * Utiliser (`Use.svelte`).
   *
   * Les bulles sont des phrases, en Noto Serif SC ; toucher un caractère montre son pinyin
   * (celui de l'export, `syllabes`). La traduction paraît une fois l'échange répondu : on
   * lit d'abord, le sens vient après. Ni photo, ni emoji, ni ombre, ni dégradé, ni cinabre.
   */
  import { grappes, type Ami, type Bulle } from './wechat';

  let {
    fil,
    ami,
    attente = false,
    traduite
  }: {
    fil: readonly Bulle[];
    ami: Ami;
    /** L'ami écrit : trois points à la place de sa bulle qui arrive. */
    attente?: boolean;
    /** La bulle montre-t-elle sa traduction ? */
    traduite: (b: Bulle) => boolean;
  } = $props();

  /** Les caractères dont on a demandé le pinyin, par bulle et par place. */
  let ouverts = $state<string[]>([]);

  function basculer(cle: string): void {
    ouverts = ouverts.includes(cle) ? ouverts.filter((x) => x !== cle) : [...ouverts, cle];
  }

  /** Un caractère ouvert dans une bulle sans pinyin par caractère : on montre la ligne entière. */
  function ligneEntiere(b: Bulle): boolean {
    return b.t.syllabes.length === 0 && ouverts.some((x) => x.startsWith(`${b.cle}/`));
  }
</script>

<div class="fil" aria-label="La conversation" aria-live="polite">
  {#each fil as b (b.cle)}
    <div class="bulle {b.de}">
      <p class="zh" lang="zh-Hans">
        {#each grappes(b.t) as g, k (k)}
          <!-- Un caractère et sa ponctuation ne se séparent pas en fin de ligne. -->
          <span class="grappe">
            {#each g as x, j (j)}
              {#if x.py === null}
                <span class="ponct">{x.c}</span>
              {:else}
                {@const cle = `${b.cle}/${k}`}
                <button
                  class="signe"
                  aria-label="{x.c} : son pinyin"
                  aria-pressed={ouverts.includes(cle)}
                  onclick={() => basculer(cle)}
                >
                  <ruby>{x.c}{#if ouverts.includes(cle) && x.py}<rt>{x.py}</rt>{/if}</ruby>
                </button>
              {/if}
            {/each}
          </span>
        {/each}
      </p>
      {#if ligneEntiere(b)}<p class="py-ligne">{b.t.pinyin}</p>{/if}
      {#if traduite(b)}<p class="tr">{b.t.fr}</p>{/if}
    </div>
  {/each}
  {#if attente}
    <div class="bulle ami ecrit" aria-label="{ami.zh} écrit">…</div>
  {/if}
</div>

<style>
  .fil {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bulle {
    max-width: 84%;
    padding: 8px 12px 9px;
    border-radius: 14px;
    animation: paraitre 0.2s ease-out both;
  }
  .bulle.ami {
    align-self: flex-start;
    background: var(--card);
    border: 1px solid var(--line);
    border-bottom-left-radius: 4px;
  }
  .bulle.moi {
    align-self: flex-end;
    background: var(--indigo-soft);
    border: 1px solid transparent;
    border-bottom-right-radius: 4px;
  }
  .bulle.ecrit {
    color: var(--mist);
    letter-spacing: 0.2em;
    font-weight: 600;
  }
  .bulle .zh {
    margin: 0;
    font-family: var(--hz);
    font-weight: 500;
    font-size: 21px;
    line-height: 1.5;
    color: var(--ink);
  }
  .grappe {
    display: inline-block;
    white-space: nowrap;
  }
  .signe {
    font: inherit;
    color: inherit;
    padding: 0 1px;
    min-height: 32px;
    border-radius: 4px;
  }
  .signe[aria-pressed='true'] {
    background: var(--paper);
  }
  .bulle.moi .signe[aria-pressed='true'] {
    background: var(--card);
  }
  rt {
    font-family: var(--head);
    font-weight: 500;
    font-size: 11px;
    color: var(--indigo);
    letter-spacing: 0;
  }
  .py-ligne {
    margin: 2px 0 0;
    font-family: var(--head);
    font-size: 13px;
    color: var(--indigo);
  }
  .tr {
    margin: 3px 0 0;
    font-size: 14px;
    line-height: 1.35;
    color: var(--ink2);
  }
  @media (prefers-reduced-motion: reduce) {
    .bulle {
      animation: none;
    }
  }
</style>
