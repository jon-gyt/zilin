<script lang="ts">
  /**
   * Xing 杏, le maître (décision du propriétaire du 29 septembre 2026, dessin validé : la
   * variante H). Un noyau d'abricot pâle, de la forme ronde du noyau de Tao, un peu plus petit,
   * sans sillon ; un petit chignon d'encre et son épingle ocre, comme les portraits de
   * Confucius ; les yeux plissés de rire, son regard calme ; les sourcils, la moustache et la
   * barbe blancs, cernés d'encre ; les lamelles de bambou 竹简 à la main droite, les pieds
   * ocre. Son nom vient de l'autel des abricotiers 杏坛, où Confucius enseignait.
   *
   * Tout le dessin est ici, et lui seul : le corps (`corps`) ne dépend de rien, et les
   * accessoires des postures ne lisent que les points d'ancrage (`ANCRES`) : la main droite,
   * le devant, le haut de la tête, le sol et l'assise. Un nouveau dessin remplace `corps` et
   * `ANCRES`, les postures suivent.
   *
   * Même repère que Tao (viewBox 200 × 200) : à la même `size`, il est de sa taille, un peu
   * plus petit sans la pousse. Ses couleurs sont fixes (`--x-*`, `tokens.css`), comme celles
   * du personnage. Ni cinabre, ni ombre, ni dégradé, ni doré, ni emoji.
   *
   * Cinq postures (`xing.ts`) : `examine` derrière sa petite table, les lamelles déroulées ;
   * `explique`, la bulle du caractère ; `raconte`, assis, le rouleau ouvert ; `consulte`, le
   * livre ouvert ; `salue`, les mains jointes 作揖. Deux humeurs : calme, il respire
   * doucement ; content, un petit bond (les yeux rient déjà). Les animations s'arrêtent si
   * l'on réduit les animations.
   */
  import type { HumeurXing, PostureXing } from './xing';

  let {
    posture = 'explique',
    humeur = 'calme',
    size = 110,
    caractere = ''
  }: {
    posture?: PostureXing;
    humeur?: HumeurXing;
    size?: number;
    /** Le caractère de la bulle, en posture `explique` ; vide, pas de bulle. */
    caractere?: string;
  } = $props();

  /**
   * Les points d'ancrage du dessin. Les accessoires s'y accrochent, rien d'autre ne lit le
   * corps : `main`, la main droite où il tient les lamelles ; `devant`, sous la moustache, où
   * se joignent les mains ; `tete`, le haut du chignon ; `sol`, sous les pieds ; `assise`, où
   * il s'assoit pour raconter.
   */
  const ANCRES = {
    main: { x: 134, y: 130 },
    devant: { x: 100, y: 152 },
    tete: { x: 100, y: 86 },
    sol: 170,
    assise: 160
  } as const;

  const assis = $derived(posture === 'raconte');
  const table = $derived(posture === 'examine');
  /** Les lamelles restent à la main, sauf quand les mains sont prises. */
  const lamelles = $derived(posture === 'explique');
</script>

{#snippet corps()}
  <!-- le chignon et son épingle -->
  <circle cx="100" cy="96" r="10" fill="var(--x-encre)" />
  <path d="M85 94h30" stroke="var(--x-ocre)" stroke-width="4" stroke-linecap="round" />
  <!-- le noyau d'abricot -->
  <path
    d="M100 102q36 4 36 28t-36 28q-36-4-36-28t36-28z"
    fill="var(--x-corps)"
    stroke="var(--x-encre)"
    stroke-width="5"
    stroke-linejoin="round"
  />
  <g class="visage">
    <!-- les yeux plissés de rire : son regard calme -->
    <path d="M82 125q6-7 12 0M106 125q6-7 12 0" stroke="var(--x-encre)" stroke-width="4.5" fill="none" stroke-linecap="round" />
    <!-- les sourcils blancs, cernés d'encre -->
    <path d="M78 115q9-7 17-1M105 114q8-6 17 1" stroke="var(--x-encre)" stroke-width="7.5" fill="none" stroke-linecap="round" />
    <path d="M78 115q9-7 17-1M105 114q8-6 17 1" stroke="var(--x-blanc)" stroke-width="4" fill="none" stroke-linecap="round" />
    <!-- la barbe blanche sous le menton -->
    <path
      d="M86 140q14 6 28 0q6 14-2 24q-4 8-12 8q-8 0-12-8q-8-10-2-24z"
      fill="var(--x-blanc)"
      stroke="var(--x-encre)"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <path d="M95 150q1 8 4 14M105 150q-1 8-4 14" stroke="var(--x-poil)" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round" />
    <!-- la moustache -->
    <path
      d="M100 139q-7-5-15 0q7 5 15 1q8 4 15-1q-8-5-15 0z"
      fill="var(--x-blanc)"
      stroke="var(--x-encre)"
      stroke-width="3.5"
      stroke-linejoin="round"
    />
  </g>
{/snippet}

{#snippet jian(x: number, y: number)}
  <!-- 竹简 : les lamelles de bambou, liées de deux cordons -->
  <g transform="translate({x} {y}) rotate(12)">
    <rect x="0" y="0" width="20" height="26" rx="2.5" fill="var(--x-bambou)" stroke="var(--x-encre)" stroke-width="3" />
    <path d="M5 3v20M10 3v20M15 3v20" stroke="var(--x-ocre)" stroke-width="1.6" opacity=".6" />
    <path d="M-2 8h24M-2 19h24" stroke="var(--x-encre)" stroke-width="2" />
  </g>
{/snippet}

<svg
  class="xing {posture} {humeur}"
  width={size}
  height={size}
  viewBox="0 0 200 200"
  aria-hidden="true"
>
  {#if !table}
    <path class="sol" d="M60 {ANCRES.sol}q40 12 80 0" stroke="var(--line)" stroke-width="4" fill="none" stroke-linecap="round" />
  {/if}

  <g class="vivant">
    {#if assis}
      <!-- assis en tailleur pour raconter -->
      <path
        d="M72 {ANCRES.assise}q-10 12 6 12h44q16 0 6-12"
        fill="none"
        stroke="var(--x-ocre)"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {:else}
      <path class="pieds" d="M90 156v14M110 156v14" stroke="var(--x-ocre)" stroke-width="7" stroke-linecap="round" />
    {/if}

    <!-- le corps et ce que tiennent ses mains respirent ensemble -->
    <g class="corps" class:salut={posture === 'salue'}>
      {@render corps()}

    {#if lamelles}
      {@render jian(ANCRES.main.x, ANCRES.main.y)}
    {:else if posture === 'salue'}
      <!-- 作揖 : les mains jointes devant lui, le poing dans la paume -->
      <g class="mains" transform="translate({ANCRES.devant.x} {ANCRES.devant.y})">
        <path d="M-16 3q0-11 16-11t16 11q0 10-16 10t-16-10z" fill="var(--x-corps)" stroke="var(--x-encre)" stroke-width="3.5" stroke-linejoin="round" />
        <path d="M3 -7q-5 10 0 19" stroke="var(--x-encre)" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M-9 -4q3 3 8 2" stroke="var(--x-encre)" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round" />
      </g>
    {:else if posture === 'consulte'}
      <!-- le dictionnaire : un livre ouvert, tenu à la main droite -->
      <g class="livre" transform="translate({ANCRES.main.x - 4} {ANCRES.main.y - 14})">
        <path d="M22 4q-11-6-22-2v30q11-4 22 2z" fill="var(--x-papier)" stroke="var(--x-encre)" stroke-width="3" stroke-linejoin="round" />
        <path d="M22 4q11-6 22-2v30q-11-4-22 2z" fill="var(--x-papier)" stroke="var(--x-encre)" stroke-width="3" stroke-linejoin="round" />
        <path d="M22 4v30" stroke="var(--x-livre)" stroke-width="3" />
        <path d="M6 12h11M6 18h11M6 24h8M28 12h11M28 18h11M28 24h8" stroke="var(--x-encre)" stroke-width="2" opacity=".4" stroke-linecap="round" />
      </g>
    {/if}
    </g>

    {#if assis}
      <!-- 卷轴 : le rouleau ouvert sur les genoux, ses deux baguettes à l'ocre -->
      <g class="rouleau" transform="translate({ANCRES.devant.x} {ANCRES.assise + 4})">
        <rect x="-40" y="0" width="80" height="18" fill="var(--x-papier)" stroke="var(--x-encre)" stroke-width="3" />
        <path d="M-28 4v10M-20 4v10M-12 4v10M-4 4v10M4 4v10M12 4v10M20 4v10M28 4v10" stroke="var(--x-encre)" stroke-width="2" opacity=".35" stroke-linecap="round" />
        <rect x="-47" y="-3" width="8" height="24" rx="3" fill="var(--x-ocre)" stroke="var(--x-encre)" stroke-width="3" />
        <rect x="39" y="-3" width="8" height="24" rx="3" fill="var(--x-ocre)" stroke="var(--x-encre)" stroke-width="3" />
      </g>
    {/if}
  </g>

  {#if table}
    <!-- à l'examen : sa petite table basse, les lamelles 竹简 déroulées dessus -->
    <g class="table">
      <path d="M48 160h104l6 9H42z" fill="var(--x-bois)" stroke="var(--x-encre)" stroke-width="3.5" stroke-linejoin="round" />
      <rect x="42" y="169" width="116" height="9" fill="var(--x-bois)" stroke="var(--x-encre)" stroke-width="3.5" />
      <path d="M52 178v14M148 178v14" stroke="var(--x-encre)" stroke-width="5" stroke-linecap="round" />
      <g class="deroulees">
        <path d="M108 152h44l4 10h-44z" fill="var(--x-bambou)" stroke="var(--x-encre)" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M116 153l3 8M124 153l3 8M132 153l3 8M140 153l3 8" stroke="var(--x-ocre)" stroke-width="1.6" opacity=".7" />
        <path d="M109 156h44" stroke="var(--x-encre)" stroke-width="1.6" />
      </g>
    </g>
  {/if}

  {#if posture === 'explique' && caractere !== ''}
    <!-- la bulle du caractère, comme la posture leçon de Tao -->
    <g class="bulle">
      <rect x="132" y="24" width="56" height="46" rx="12" fill="var(--card)" stroke="var(--ink)" stroke-width="4" />
      <path d="M142 70l-6 14l18-14z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <text x="160" y="58" text-anchor="middle" class="hz" font-size="30" fill="var(--ink)">{caractere}</text>
    </g>
  {/if}
</svg>

<style>
  .xing {
    display: inline-block;
    overflow: visible;
  }
  /* calme : il respire doucement */
  .xing .corps {
    transform-origin: 100px 158px;
    animation: respire-xing 4s ease-in-out infinite;
  }
  /* content : un petit bond, deux fois, puis il respire */
  .xing.content .vivant {
    transform-origin: 100px 170px;
    animation: bond-xing 0.32s cubic-bezier(0.3, 0, 0.3, 1) 0.1s 4 alternate;
  }
  /* au salut, il s'incline un peu, une fois */
  .xing .corps.salut {
    animation:
      salut 1.6s ease-in-out 0.3s 1,
      respire-xing 4s ease-in-out 1.9s infinite;
  }
  .xing .rouleau,
  .xing .livre {
    transform-box: fill-box;
    transform-origin: center;
  }
  @keyframes respire-xing {
    0%,
    100% {
      transform: none;
    }
    50% {
      transform: scale(1.015, 0.985);
    }
  }
  @keyframes bond-xing {
    to {
      transform: translateY(-9px);
    }
  }
  @keyframes salut {
    0%,
    100% {
      transform: none;
    }
    40%,
    60% {
      transform: translateY(3px) rotate(-5deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .xing * {
      animation: none !important;
    }
  }
</style>
