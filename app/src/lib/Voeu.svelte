<script lang="ts">
  /**
   * Le vœu de fête, pour l'en-tête du menu : pendant la fête, il prend la place de la
   * marque, sur la même hauteur, sans rien pousser vers le bas.
   *
   * - 春节 : un 福 à l'envers sur un losange abricot (« à l'envers », 倒 dào, sonne comme
   *   到 dào, arriver : le bonheur arrive), le vœu 新年快乐 et son pinyin, la ligne
   *   « Bonne année de la Chèvre 羊 », et une lanterne qui se balance.
   * - 中秋 : le vœu 中秋快乐 et la ligne « Demain soir, pleine lune ».
   *
   * Toucher le vœu le prononce (`audio.dire`, voix embarquée ou voix du téléphone).
   *
   * Props :
   * - `fete` : la fête du jour, telle que `fetes.feteDuJour` la rend (jetons remplis).
   *   Obligatoire ; le composant ne s'affiche que les jours de fête.
   * - `pistes` : les familles où chercher les traits du 福 (`fetes.pistes(f, '福')`), pour
   *   ne pas relire toutes les familles. Défaut : aucune.
   *
   * Le 福 est dessiné depuis ses traits, jamais depuis une police. Le cramoisi de fête
   * (--fete) ne sert qu'au 福 et à la lanterne ; l'abricot est un aplat, pas un doré.
   */
  import { dire } from './audio';
  import { traitsDe } from './content';
  import type { FeteDuJour } from './fetes';
  import { glyph, type StrokeData } from './glyph';

  let { fete, pistes = [] }: { fete: FeteDuJour; pistes?: readonly string[] } = $props();

  const fu = $derived(fete.id === 'chunjie' ? fete.caractereVoeu : null);

  let data: StrokeData | null = $state(null);

  $effect(() => {
    const c = fu;
    const p = pistes;
    data = null;
    if (!c) return;
    let vivant = true;
    traitsDe(c, p)
      .then((d) => {
        if (vivant) data = d;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /** La ligne française, les caractères chinois à part pour leur police. */
  const morceaux = $derived(
    fete.voeu.fr
      .split(/([㐀-鿿]+)/)
      .filter((t) => t !== '')
      .map((t) => ({ t, hz: /[㐀-鿿]/.test(t) }))
  );
</script>

<button
  class="voeu {fete.id}"
  data-fete={fete.id}
  onclick={() => void dire(fete.voeu.zh)}
  aria-label="{fete.voeu.zh}, {fete.voeu.pinyin}. {fete.voeu.fr}. Écouter"
>
  {#if fu}
    <span class="fu" aria-hidden="true">
      {#if data}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html glyph(fu, data, 26, { write: false, color: 'var(--fete)', label: '' })}
      {/if}
    </span>
  {/if}
  <span class="t" aria-hidden="true">
    <span class="cn">{fete.voeu.zh}<span class="py">{fete.voeu.pinyin}</span></span>
    <span class="fr"
      >{#each morceaux as m, i (i)}{#if m.hz}<span class="hz">{m.t}</span>{:else}{m.t}{/if}{/each}</span
    >
  </span>
  {#if fete.id === 'chunjie'}
    <svg class="lanterne" width="26" height="46" viewBox="0 0 60 106" aria-hidden="true">
      <path d="M30 0v14" stroke="var(--apricot)" stroke-width="3" />
      <path d="M20 15h20" stroke="var(--apricot)" stroke-width="5" stroke-linecap="round" />
      <ellipse cx="30" cy="42" rx="24" ry="25" fill="var(--fete)" stroke="var(--apricot)" stroke-width="3" />
      <path d="M30 17v50M17 22q-8 20 0 40M43 22q8 20 0 40" stroke="var(--apricot)" stroke-width="2" fill="none" opacity=".8" />
      <path d="M20 69h20" stroke="var(--apricot)" stroke-width="5" stroke-linecap="round" />
      <path d="M30 71v30M25 78v18M35 78v18" stroke="var(--apricot)" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  {/if}
</button>

<style>
  .voeu {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 44px;
    background: none;
    color: var(--ink);
    text-align: left;
  }
  .t {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .cn {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 19px;
    line-height: 1.15;
    letter-spacing: 0.04em;
    color: var(--ink);
    white-space: nowrap;
  }
  .py {
    font-family: var(--sans);
    font-size: 12px;
    font-style: italic;
    letter-spacing: 0;
    color: var(--mist);
    margin-left: 6px;
  }
  .fr {
    font-size: 12.5px;
    color: var(--ink2);
    line-height: 1.2;
    white-space: nowrap;
  }
  .fr .hz {
    font-size: 13px;
    color: var(--ink);
  }
  /* le 福 à l'envers : un losange abricot plat (45°), le caractère retourné (45° + 135°) */
  .fu {
    width: 30px;
    height: 30px;
    margin: 0 3px;
    flex-shrink: 0;
    background: var(--apricot);
    transform: rotate(45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    line-height: 0;
  }
  .fu :global(.g) {
    transform: rotate(135deg);
  }
  /* la lanterne pend depuis le haut de l'en-tête et se balance */
  .lanterne {
    flex-shrink: 0;
    align-self: flex-start;
    margin: -14px 0 0 6px;
    transform-origin: 50% 0;
    animation: balance 2.6s ease-in-out infinite alternate;
  }
  @keyframes balance {
    from { transform: rotate(-4deg); }
    to { transform: rotate(4deg); }
  }
  .voeu:active .cn {
    color: var(--ink2);
  }
  @media (prefers-reduced-motion: reduce) {
    .lanterne {
      animation: none;
    }
  }
</style>
