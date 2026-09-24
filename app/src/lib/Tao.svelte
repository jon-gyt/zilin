<script lang="ts">
  /**
   * Tao 桃, la graine de pêcher. Cinq stades, une posture par activité, trois humeurs.
   * Traits simples, encre et jade, dans l'esprit de la maquette.
   *
   * Aucun cinabre : le rouge reste le sceau de l'app. Le seul rose (#E7A2B4) est celui
   * des fleurs, et seulement au stade « pêcher en fleur ». Ni ombre, ni dégradé, ni doré.
   * Elle ne tombe jamais malade et ne pleure jamais : l'absence la met en pot, rien de plus.
   *
   * Les jours de fête, elle porte l'accessoire de la fête (brief §9). Au-dessus de la tête :
   * un flocon au Nouvel An 春节, un brin de saule à 清明, une étoile à 七夕, un chrysanthème
   * au double neuf 重阳. À côté d'elle : un bol de 汤圆 à la fête des Lanternes 元宵, un
   * 粽子 à la fête des bateaux 端午, un gâteau de lune 月饼 à la mi-automne 中秋, un 饺子 au
   * solstice d'hiver 冬至. Tous sont toujours dessinés et cachés ; `data-fete` sur <html>
   * montre le bon (`tokens.css`), sans que chaque écran ait à passer la fête. Pas
   * d'accessoire là où la place est déjà prise : ceux de la tête cèdent la place à la bulle
   * et à la lanterne, ceux d'à côté au bol, à la feuille et au pot.
   */
  import type { Humeur, PostureVue, Stade } from './tao';

  let {
    stade = 'graine',
    posture = 'chemin',
    humeur = 'calme',
    size = 110,
    caractere = '住',
    penchee = false
  }: {
    stade?: Stade;
    posture?: PostureVue;
    humeur?: Humeur;
    size?: number;
    /** Le caractère de la bulle, en posture « leçon ». */
    caractere?: string;
    /** En posture « jeu », la tête penchée sur un mot, sans lanterne (le dictionnaire éclair). */
    penchee?: boolean;
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
  class:penchee
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

    <!-- en pot, elle se tient plus haut que le bord : son visage reste entier -->
    <g class="enterree" transform={posture === 'pot' ? 'translate(0,-22)' : ''}>
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
                <!-- deux lobes : la silhouette de la pêche, sans rose ni dégradé -->
                <g>
                  <circle cx={x - 4} cy={y} r="8.5" fill="var(--ocre)" />
                  <circle cx={x + 4} cy={y} r="8.5" fill="var(--ocre)" />
                  <path d={`M${x} ${y - 9}v5`} stroke="var(--jade)" stroke-width="3" stroke-linecap="round" />
                </g>
              {/each}
            {/if}
          </g>
          <path
            class="tronc"
            d="M74 158q5-28 1-50h50q-4 22 1 50z"
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
      <path class="trait" d="M136 126h40" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" fill="none" />
    </g>
  {:else if posture === 'jeu' && !penchee}
    <g class="lanterne">
      <path d="M164 26v12" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="164" cy="56" rx="17" ry="18" fill="var(--card)" stroke="var(--ocre)" stroke-width="4" />
      <path d="M152 40h24M152 72h24" stroke="var(--ocre)" stroke-width="4" stroke-linecap="round" />
      <path d="M164 38v36" stroke="var(--ocre)" stroke-width="2" opacity=".5" />
      <path d="M164 74v10" stroke="var(--ocre)" stroke-width="3" stroke-linecap="round" />
    </g>
  {/if}

  <!-- au-dessus de la tête, là où la bulle et la lanterne ne sont pas -->
  {#if posture !== 'lecon' && posture !== 'jeu'}
    <g class="fete-acc flocon" transform="translate(140 62)" stroke="var(--t1)" stroke-width="4" stroke-linecap="round">
      <path d="M0-13v26M-11.3-6.5l22.6 13M-11.3 6.5l22.6-13" />
    </g>
    <!-- 清明 : un brin de saule, qu'on porte ce jour-là -->
    <g class="fete-acc saule" transform="translate(140 62)">
      <path d="M-14 18q4-18 20-30" stroke="var(--saule-fonce)" stroke-width="3.5" fill="none" stroke-linecap="round" />
      <g fill="var(--saule)">
        <ellipse cx="-9" cy="6" rx="3" ry="7" transform="rotate(-35 -9 6)" />
        <ellipse cx="-2" cy="-3" rx="3" ry="7" transform="rotate(-50 -2 -3)" />
        <ellipse cx="4" cy="-9" rx="3" ry="7" transform="rotate(-65 4 -9)" />
        <ellipse cx="-4" cy="12" rx="3" ry="6.5" transform="rotate(40 -4 12)" />
        <ellipse cx="3" cy="2" rx="3" ry="6.5" transform="rotate(25 3 2)" />
      </g>
    </g>
    <!-- 七夕 : une étoile, Véga ou Altaïr -->
    <g class="fete-acc etoile" transform="translate(140 62)">
      <path d="M0-15q2.4 12.6 15 15q-12.6 2.4-15 15q-2.4-12.6-15-15q12.6-2.4 15-15z" fill="var(--etoile)" />
    </g>
    <!-- 重阳 : un chrysanthème -->
    <g class="fete-acc ju" transform="translate(140 62)">
      <g fill="var(--ju)">
        {#each [0, 36, 72, 108, 144, 180, 216, 252, 288, 324] as a (a)}<ellipse cx="0" cy="-8" rx="3.2" ry="7" transform="rotate({a})" />{/each}
      </g>
      <circle r="4.5" fill="var(--ju-coeur)" />
    </g>
  {/if}
  <!-- à côté d'elle, là où le bol, la feuille et le pot ne sont pas -->
  {#if posture !== 'pot' && posture !== 'revision' && posture !== 'lecture'}
    <g class="fete-acc yuebing">
      <circle cx="46" cy="148" r="19" fill="var(--t2)" stroke="var(--ink)" stroke-width="4" />
      <circle cx="46" cy="148" r="10" fill="none" stroke="var(--ink)" stroke-width="3" opacity=".55" />
      <path d="M46 138v20M36 148h20" stroke="var(--ink)" stroke-width="3" opacity=".55" />
    </g>
    <!-- 元宵 : un bol de 汤圆 -->
    <g class="fete-acc tangyuan">
      <circle cx="36" cy="146" r="7" fill="var(--tangyuan)" stroke="var(--ink)" stroke-width="3" />
      <circle cx="52" cy="144" r="7" fill="var(--tangyuan)" stroke="var(--ink)" stroke-width="3" />
      <circle cx="44" cy="139" r="6" fill="var(--tangyuan)" stroke="var(--ink)" stroke-width="3" />
      <path d="M22 150h48q-2 18-24 18t-24-18z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
    </g>
    <!-- 端午 : un 粽子 ficelé -->
    <g class="fete-acc zongzi">
      <path d="M26 164L46 128L66 164Z" fill="var(--roseau)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M36 146L56 164M46 128L41 164" stroke="var(--roseau-clair)" stroke-width="2.5" opacity=".8" />
      <path d="M33 152h26" stroke="var(--ficelle)" stroke-width="4" stroke-linecap="round" />
    </g>
    <!-- 冬至 : un 饺子 -->
    <g class="fete-acc jiaozi">
      <path d="M22 158q24-34 48 0q-24 9-48 0z" fill="var(--raviole)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M36 146q3 5 1 9M46 141v10M56 146q-3 5-1 9" stroke="var(--ink)" stroke-width="3" opacity=".45" fill="none" stroke-linecap="round" />
    </g>
  {/if}
</svg>

<style>
  /* Le dictionnaire éclair : la tête penchée sur le mot, immobile, comme on réfléchit. */
  .penchee .vivant {
    transform-origin: 100px 168px;
    transform: rotate(-9deg);
  }
</style>
