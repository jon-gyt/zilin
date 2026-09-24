<script lang="ts">
  /**
   * Le vœu de fête, pour l'en-tête du menu : pendant la fête, il prend la place de la
   * marque, sur la même hauteur, sans rien pousser vers le bas.
   *
   * - 春节 : un 福 à l'envers sur un losange abricot (« à l'envers », 倒 dào, sonne comme
   *   到 dào, arriver : le bonheur arrive), le vœu 新年快乐 et son pinyin, la ligne
   *   « Bonne année de la Chèvre 羊 », et une lanterne qui se balance.
   * - 元宵 : la lanterne, une devinette 灯谜 pendue à la place du gland.
   * - 清明 : un cerf-volant qui flotte au bout de son fil.
   * - 端午 : un 粽子 ficelé.
   * - 七夕 : une pie en vol.
   * - 中秋 : le vœu 中秋快乐 et la ligne « Demain soir, pleine lune ».
   * - 重阳 : un chrysanthème.
   * - 冬至 : un bol fumant.
   *
   * Les dessins de gauche prennent la place du 福, ceux qui pendent (lanterne, cerf-volant)
   * se balancent à droite : l'en-tête garde sa hauteur.
   *
   * Toucher le vœu le prononce (`audio.dire`, voix embarquée ou voix du téléphone), et
   * rouvre l'anecdote du jour, celle de la fête (`onouvrir`).
   *
   * Props :
   * - `fete` : la fête du jour, telle que `fetes.feteDuJour` la rend (jetons remplis).
   *   Obligatoire ; le composant ne s'affiche que les jours de fête.
   * - `pistes` : les familles où chercher les traits du 福 (`fetes.pistes(f, '福')`), pour
   *   ne pas relire toutes les familles. Défaut : aucune.
   * - `onouvrir` : rouvre l'anecdote du jour au toucher. Défaut : rien.
   *
   * Le 福 est dessiné depuis ses traits, jamais depuis une police. Le cramoisi de fête
   * (--fete) ne sert qu'au 福 et aux lanternes du Nouvel An et de 元宵 ; l'abricot est un
   * aplat, pas un doré. Les autres dessins prennent les couleurs de leur fête (`tokens.css`).
   */
  import { dire } from './audio';
  import { traitsDe } from './content';
  import type { FeteDuJour } from './fetes';
  import { glyph, type StrokeData } from './glyph';

  let {
    fete,
    pistes = [],
    onouvrir = () => undefined
  }: { fete: FeteDuJour; pistes?: readonly string[]; onouvrir?: () => void } = $props();

  /** Le vœu se dit, et l'anecdote de la fête se rouvre. */
  function toucher(): void {
    void dire(fete.voeu.zh);
    onouvrir();
  }

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
  onclick={toucher}
  aria-label="{fete.voeu.zh}, {fete.voeu.pinyin}. {fete.voeu.fr}. Écouter, et relire l'anecdote du jour"
>
  {#if fete.id === 'duanwu'}
    <svg class="picto" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <path d="M4 26L15 4L26 26Z" fill="var(--roseau)" stroke-linejoin="round" />
      <path d="M9.5 15L21 26M15 4L12 26" stroke="var(--roseau-clair)" stroke-width="1.4" />
      <path d="M8 19.5h14" stroke="var(--ficelle)" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  {:else if fete.id === 'qixi'}
    <svg class="picto" width="34" height="30" viewBox="-17 -15 34 30" aria-hidden="true">
      <path class="aile" d="M-3-1L-9-13L5-3z" fill="var(--ink)" />
      <path d="M-5 2L-16 7" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="0" cy="1" rx="8.5" ry="4.6" fill="var(--ink)" />
      <ellipse cx="1.4" cy="2.8" rx="4.4" ry="2" fill="var(--paper)" />
      <circle cx="8.5" cy="-2" r="3.6" fill="var(--ink)" />
      <path d="M11.5-3L15.5-1.6L11.5-.6z" fill="var(--ink)" />
    </svg>
  {:else if fete.id === 'chongyang'}
    <svg class="picto tourne" width="30" height="30" viewBox="-15 -15 30 30" aria-hidden="true">
      <g fill="var(--ju)">
        {#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as a (a)}<ellipse cx="0" cy="-8.5" rx="2.8" ry="6.2" transform="rotate({a})" />{/each}
      </g>
      <g fill="var(--ju-clair)">
        {#each [15, 75, 135, 195, 255, 315] as a (a)}<ellipse cx="0" cy="-5.5" rx="2.2" ry="4" transform="rotate({a})" />{/each}
      </g>
      <circle r="3.4" fill="var(--ju-coeur)" />
    </svg>
  {:else if fete.id === 'dongzhi'}
    <svg class="picto" width="32" height="30" viewBox="0 0 32 30" aria-hidden="true">
      <path class="fumee" d="M11 9q-3-3 0-6M16 8q-3-3 0-6M21 9q-3-3 0-6" stroke="var(--mist)" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <path d="M8 15q4-6 8 0z" fill="var(--raviole)" stroke="var(--bol)" stroke-width="1.2" />
      <circle cx="20" cy="13" r="3" fill="var(--tangyuan)" stroke="var(--bol)" stroke-width="1.2" />
      <path d="M4 15h24q-2 12-12 12t-12-12z" fill="var(--bol)" />
    </svg>
  {/if}
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
  {#if fete.id === 'chunjie' || fete.id === 'yuanxiao'}
    <svg class="lanterne" width="26" height="46" viewBox="0 0 60 106" aria-hidden="true">
      <path d="M30 0v14" stroke="var(--apricot)" stroke-width="3" />
      <path d="M20 15h20" stroke="var(--apricot)" stroke-width="5" stroke-linecap="round" />
      <ellipse cx="30" cy="42" rx="24" ry="25" fill="var(--fete)" stroke="var(--apricot)" stroke-width="3" />
      <path d="M30 17v50M17 22q-8 20 0 40M43 22q8 20 0 40" stroke="var(--apricot)" stroke-width="2" fill="none" opacity=".8" />
      <path d="M20 69h20" stroke="var(--apricot)" stroke-width="5" stroke-linecap="round" />
      {#if fete.id === 'yuanxiao'}
        <!-- la devinette 灯谜 : un papier pendu sous la lanterne -->
        <path d="M30 71v6" stroke="var(--apricot)" stroke-width="2.4" />
        <rect x="21" y="77" width="18" height="28" rx="2" fill="var(--mi)" />
        <path d="M26 84h8M26 90h8M26 96h5" stroke="var(--mi-ink)" stroke-width="2.2" stroke-linecap="round" />
      {:else}
        <path d="M30 71v30M25 78v18M35 78v18" stroke="var(--apricot)" stroke-width="2.4" stroke-linecap="round" />
      {/if}
    </svg>
  {:else if fete.id === 'qingming'}
    <svg class="lanterne cerf" width="28" height="46" viewBox="0 0 28 46" aria-hidden="true">
      <path d="M14 0v8" stroke="var(--pluie)" stroke-width="1" />
      <path d="M14 6L25 18L14 32L3 18z" fill="var(--cerf)" />
      <path d="M14 6V32M3 18H25" stroke="var(--cerf-clair)" stroke-width="1" />
      <path d="M14 32q-4 4 0 7t0 7" stroke="var(--cerf-queue)" stroke-width="1.4" fill="none" />
      <path d="M14 37l-3.5-2l.6 3.6zM14 37l3.5-2l-.6 3.6z" fill="var(--cerf-queue)" />
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
  .cerf {
    margin-top: -12px;
    animation-duration: 3.4s;
  }
  /* un dessin à gauche, à la place du 福 */
  .picto {
    flex-shrink: 0;
    overflow: visible;
  }
  .picto.tourne {
    animation: tourne 40s linear infinite;
  }
  .aile {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: bat 0.9s ease-in-out infinite alternate;
  }
  .fumee {
    animation: fume 2.4s ease-in-out infinite alternate;
  }
  @keyframes tourne {
    to { transform: rotate(360deg); }
  }
  @keyframes bat {
    from { transform: scaleY(1); }
    to { transform: scaleY(-0.4); }
  }
  @keyframes fume {
    from { opacity: 0.25; transform: translateY(1px); }
    to { opacity: 0.8; transform: translateY(-1px); }
  }
  .voeu:active .cn {
    color: var(--ink2);
  }
  @media (prefers-reduced-motion: reduce) {
    .lanterne,
    .picto,
    .aile,
    .fumee {
      animation: none;
    }
  }
</style>
