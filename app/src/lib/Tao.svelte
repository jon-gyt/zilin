<script lang="ts">
  /**
   * Tao 桃, la graine de pêcher. Cinq stades, une posture par activité, trois humeurs.
   * Traits simples, encre et jade, dans l'esprit de la maquette.
   *
   * Aucun cinabre : le rouge reste le sceau de l'app. Le seul rose (#E7A2B4) est celui
   * des fleurs, et seulement au stade « pêcher en fleur ». Ni ombre, ni dégradé, ni doré.
   * Elle ne tombe jamais malade et ne pleure jamais : l'absence la met en pot, rien de plus.
   */
  import type { Humeur, PostureVue, Stade } from './tao';

  let {
    stade = 'graine',
    posture = 'chemin',
    humeur = 'calme',
    size = 110,
    caractere = '住'
  }: {
    stade?: Stade;
    posture?: PostureVue;
    humeur?: Humeur;
    size?: number;
    /** Le caractère de la bulle, en posture « leçon ». */
    caractere?: string;
  } = $props();

  const arbre = $derived(stade === 'jeune' || stade === 'fleur' || stade === 'peches');
  const grand = $derived(stade === 'fleur' || stade === 'peches');
  /** Les yeux se ferment en pot : elle attend, elle ne dort pas de tristesse. */
  const regard = $derived(posture === 'pot' ? 'pot' : humeur);

  /** Fleurs sur le houppier, au stade en fleur seulement. */
  const FLEURS = [
    [74, 62],
    [100, 47],
    [126, 63],
    [86, 89],
    [119, 86]
  ];
  /** Pêches, à l'ocre : le rose est réservé aux fleurs. */
  const PECHES = [
    [77, 73],
    [111, 57],
    [123, 90]
  ];
</script>

<svg
  class="tao {stade} {posture} {humeur}"
  width={size}
  height={size}
  viewBox="0 0 200 200"
  aria-hidden="true"
>
  {#if posture !== 'pot'}
    <path class="sol" d="M60 168q40 12 80 0" stroke="var(--line)" stroke-width="4" fill="none" stroke-linecap="round" />
  {/if}

  <g class="vivant">
    {#if posture === 'chemin'}
      <path class="pieds" d="M88 156v14M112 156v14" stroke="var(--jade)" stroke-width="7" stroke-linecap="round" />
    {:else if posture === 'anecdote'}
      <path
        class="assise"
        d="M76 156q-10 12 4 14h40q14-2 4-14"
        fill="none"
        stroke="var(--jade)"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}

    <g class="plante">
      {#if arbre}
        <g class="houppier">
          {#if grand}
            <ellipse cx="100" cy="74" rx="46" ry="34" fill="var(--jade)" />
          {:else}
            <ellipse cx="100" cy="80" rx="36" ry="26" fill="var(--jade)" />
          {/if}
          {#if stade === 'fleur'}
            {#each FLEURS as [x, y] (x)}
              <circle cx={x} cy={y} r="6.5" fill="var(--fleur)" />
            {/each}
          {:else if stade === 'peches'}
            {#each PECHES as [x, y] (x)}
              <g>
                <circle cx={x} cy={y} r="9" fill="var(--ocre)" />
                <path d={`M${x} ${y - 8}v16`} stroke="var(--paper)" stroke-width="2" opacity=".45" fill="none" />
              </g>
            {/each}
          {/if}
        </g>
        <path
          class="tronc"
          d="M78 158q5-28 1-50h42q-4 22 1 50z"
          fill="var(--card)"
          stroke="var(--ink)"
          stroke-width="5"
          stroke-linejoin="round"
        />
      {:else}
        {#if stade === 'pousse'}
          <g class="feuilles">
            <path d="M100 96q-30-8-34-40q26 4 34 30M100 96q30-8 34-40q-26 4-34 30" fill="var(--jade)" />
            <path d="M100 98v-18" stroke="var(--jade)" stroke-width="7" stroke-linecap="round" />
          </g>
        {/if}
        <!-- le noyau : une amande d'encre, la graine de pêche -->
        <path
          class="noyau"
          d="M100 98q36 6 36 30t-36 30q-36-6-36-30t36-30z"
          fill="var(--card)"
          stroke="var(--ink)"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <path
          class="sillons"
          d="M76 140q7 6 11 12M124 140q-7 6-11 12"
          stroke="var(--ink)"
          stroke-width="3"
          fill="none"
          opacity=".3"
          stroke-linecap="round"
        />
      {/if}

      <g class="visage">
        {#if regard === 'joie'}
          <path
            d="M81 127q7-8 14 0M105 127q7-8 14 0"
            stroke="var(--ink)"
            stroke-width="5"
            fill="none"
            stroke-linecap="round"
          />
          <path d="M91 138q9 10 18 0" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round" />
        {:else if regard === 'ennui'}
          <path d="M82 127h12M106 127h12" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
          <path d="M93 140h14" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
        {:else if regard === 'pot'}
          <path
            d="M81 126q7 6 14 0M105 126q7 6 14 0"
            stroke="var(--ink)"
            stroke-width="5"
            fill="none"
            stroke-linecap="round"
          />
          <path d="M95 140h10" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
        {:else}
          <g class="yeux">
            <circle cx="88" cy="126" r="4.5" fill="var(--ink)" />
            <circle cx="112" cy="126" r="4.5" fill="var(--ink)" />
          </g>
          <path d="M93 139q7 5 14 0" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round" />
        {/if}
      </g>
    </g>
  </g>

  {#if posture === 'pot'}
    <!-- Sans personne, elle se met en pot et attend. Au retour, elle se redresse. -->
    <g class="pot">
      <path
        d="M60 140h80l-12 46H72z"
        fill="var(--card)"
        stroke="var(--ink)"
        stroke-width="5"
        stroke-linejoin="round"
      />
      <path d="M64 154h72" stroke="var(--ink)" stroke-width="3" opacity=".4" />
    </g>
  {:else if posture === 'lecon'}
    <g class="bulle">
      <rect x="132" y="18" width="56" height="46" rx="12" fill="var(--card)" stroke="var(--ink)" stroke-width="4" />
      <path d="M146 64v14l16-14z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <text x="160" y="52" text-anchor="middle" class="hz" font-size="30" fill="var(--ink)">{caractere}</text>
    </g>
  {:else if posture === 'revision'}
    <!-- une carte, une bouchée : le bol -->
    <g class="bol">
      <path d="M26 146h44q-2 22-22 22t-22-22z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M22 146h52" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" />
    </g>
  {:else if posture === 'lecture'}
    <g class="feuille">
      <path d="M22 122h50v42H22z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M32 134h30M32 144h30M32 154h18" stroke="var(--ink)" stroke-width="3" opacity=".45" stroke-linecap="round" />
    </g>
  {:else if posture === 'trace'}
    <g class="pinceau">
      <path d="M150 104l26-26" stroke="var(--ocre)" stroke-width="7" stroke-linecap="round" />
      <path d="M142 112l10-10" stroke="var(--ink)" stroke-width="11" stroke-linecap="round" />
      <path class="trait" d="M28 150h44" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" fill="none" />
    </g>
  {:else if posture === 'jeu'}
    <g class="lanterne">
      <path d="M164 26v12" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="164" cy="56" rx="15" ry="18" fill="var(--card)" stroke="var(--ocre)" stroke-width="4" />
      <path d="M164 38v36" stroke="var(--ocre)" stroke-width="2" opacity=".5" />
      <path d="M164 74v10" stroke="var(--ocre)" stroke-width="3" stroke-linecap="round" />
    </g>
  {/if}
</svg>
