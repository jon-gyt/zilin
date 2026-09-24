<script lang="ts" module>
  const f1 = (n: number) => n.toFixed(1);

  /** La danse : huit anneaux du corps, de la queue vers la tête, chacun sur sa perche. */
  const ANNEAUX = Array.from({ length: 8 }, (_, i) => ({ x: 30 + i * 15, w: `-${f1(i * 0.24)}s` }));
  /** La tête suit le dernier anneau dans la vague, la perle la précède. */
  const TETE = `-${f1(8 * 0.24)}s`;
  const PERLE = `-${f1(9 * 0.24)}s`;

  /** Le bateau : six rameurs, un batteur à la proue, les écailles le long de la coque. */
  const RAMEURS = [36, 48, 60, 72, 84, 96].map((x, i) => ({ x, w: `-${f1(i * 0.08)}s` }));
  const ECAILLES = 'M24 33.5' + 'q3.5 3 7 0'.repeat(13);
  /** Deux bateaux qui font la course : un loin, plus petit, et un près. */
  const BATEAUX = [
    { cls: 'loin', style: '--d:64s;--w:-44s' },
    { cls: 'pres', style: '--d:48s;--w:-9s' }
  ];
</script>

<script lang="ts">
  /**
   * Le dragon des deux fêtes qui en ont un, et d'elles seules (CLAUDE.md) : il n'est dessiné
   * que dans les branches `chunjie` et `duanwu` de `FeteDecor`.
   *
   * - `danse` (春节) : la danse du dragon 舞龙. Une tête de papier découpé, huit anneaux et la
   *   queue, chacun sur sa perche, qui ondulent l'un après l'autre en suivant la perle ; la
   *   troupe traverse lentement le pied de l'écran, sous les cases.
   * - `bateau` (端午) : deux bateaux-dragons 龙舟 qui font la course sur l'eau. La proue est
   *   une tête de dragon, la poupe sa queue, des écailles courent sur la coque ; les rameurs
   *   sont des traits d'encre, un batteur bat la cadence à l'avant.
   *
   * Aplats et traits seulement, aux pigments de la fête : ni ombre, ni dégradé, ni doré
   * (l'abricot est un aplat). Le décor entier est coupé si l'on réduit les animations.
   */
  let { sorte }: { sorte: 'danse' | 'bateau' } = $props();
</script>

{#if sorte === 'danse'}
  <div class="danse">
    <svg viewBox="0 -6 216 48">
      {#each ANNEAUX as a, i (i)}
        <g class="onde" style="animation-delay:{a.w}">
          <path d="M{a.x} 22V80" stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round" />
          {#if i === 0}
            <!-- la queue : une flamme vers l'arrière, frangée d'abricot -->
            <path d="M{a.x - 4} 15Q{a.x - 16} 12 {a.x - 26} 3Q{a.x - 21} 10 {a.x - 25} 13Q{a.x - 18} 15 {a.x - 24} 22Q{a.x - 14} 21 {a.x - 4} 26Z" fill="var(--fete)" />
            <path d="M{a.x - 26} 3q-3 3-1 7M{a.x - 25} 13q-4 1-4 5M{a.x - 24} 22q-3 2-2 5" stroke="var(--apricot)" stroke-width="1.4" fill="none" stroke-linecap="round" />
          {/if}
          <path d="M{a.x - 3} 14L{a.x - 7} 7L{a.x + 3} 13.5Z" fill="var(--apricot)" />
          <ellipse cx={a.x} cy="20" rx="10.5" ry="7" fill="var(--fete)" />
          <path d="M{a.x - 9} 22.5Q{a.x} 29.5 {a.x + 9} 22.5Q{a.x} 25.5 {a.x - 9} 22.5Z" fill="var(--fete-ink)" />
          <path d="M{a.x - 6} 19.5q3-3.6 6 0q3-3.6 6 0" stroke="var(--apricot)" stroke-width="1.3" fill="none" stroke-linecap="round" />
        </g>
      {/each}
      <!-- la tête, la gueule ouverte vers la perle -->
      <g class="onde" style="animation-delay:{TETE}">
        <g transform="translate(150 19) scale(.88)">
          <path d="M10 4V80" stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round" />
          <g class="hoche">
            <path d="M2-9Q-8-14-10-4Q-5-6-3-2Q-11 1-8 9Q-3 4 3 6Z" fill="var(--apricot)" />
            <path d="M6-13Q2-21-4-23Q2-18 3-11ZM11-14.5Q10-23 5-27Q9-20 8-13.5Z" fill="var(--apricot)" />
            <path d="M-2-6Q0-15 12-15L22-13Q30-12 33-6Q34-2 30-1L12 0Q4 1-2 4Z" fill="var(--fete)" />
            <path d="M3 3Q14 2 27 3Q30 4 28 6.5Q17 9 7 8.5Q2 7.5 3 3Z" fill="var(--fete)" />
            <path d="M14-.5l2 2.6l2-2.6l2 2.6l2-2.6l2 2.6l2-2.6Z" fill="var(--fete-ink)" />
            <path d="M8-12.5Q14-17 21-13" stroke="var(--apricot)" stroke-width="2.2" fill="none" stroke-linecap="round" />
            <circle cx="15" cy="-8.5" r="3.9" fill="var(--fete-ink)" />
            <circle cx="16.6" cy="-8.3" r="2" fill="var(--ink)" />
            <circle cx="30.5" cy="-7" r=".9" fill="var(--ink)" />
            <path d="M32-3q7 0 8 5t-3 6M31-10q5-6 11-4" stroke="var(--apricot)" stroke-width="1.3" fill="none" stroke-linecap="round" />
            <path d="M7 8.5l1 5l2.5-4l2 5l2.5-4.5l2 4l2-5Z" fill="var(--apricot)" />
          </g>
        </g>
      </g>
      <!-- la perle 珠, que le dragon poursuit -->
      <g class="onde" style="animation-delay:{PERLE}">
        <path d="M206 16V80" stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round" />
        <circle cx="206" cy="11" r="5.5" fill="var(--apricot)" />
        <path d="M203 11a3 3 0 1 1 3 3" stroke="var(--fete)" stroke-width="1.3" fill="none" stroke-linecap="round" />
      </g>
    </svg>
  </div>
{:else}
  {#each BATEAUX as b, i (i)}
    <div class="barque {b.cls}" style={b.style}>
      <svg viewBox="0 -8 156 52">
        <!-- la queue, à la poupe -->
        <path d="M22 30Q9 29 6 18Q5 10 11 5Q9 14 13 20Q16 25 24 26Z" fill="var(--bateau-bande)" />
        <path d="M11 5Q4 3 2 7Q6 7 8 10ZM7 16Q1 16 0 21Q4 20 7 22Z" fill="var(--ficelle)" />
        <!-- les rameurs, des traits d'encre -->
        {#each RAMEURS as r (r.x)}
          <path d="M{r.x} 28L{r.x + 2.4} 20" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" />
          <circle cx={r.x + 3} cy="16.6" r="2.5" fill="var(--ink)" />
        {/each}
        <!-- le batteur, tourné vers eux, et son tambour -->
        <path d="M110 28L108 20" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="107.6" cy="16.6" r="2.5" fill="var(--ink)" />
        <path class="baguette" d="M108.6 21l6-1.4" stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round" />
        <ellipse cx="117" cy="25" rx="4.2" ry="3.4" fill="var(--bateau-bande)" />
        <path d="M113 25h8" stroke="var(--ficelle)" stroke-width="1" />
        <!-- la coque et ses écailles -->
        <path d="M14 28H126Q122 37 110 38H30Q18 37 14 28Z" fill="var(--bateau)" />
        <path d="M18 30.6H123" stroke="var(--bateau-bande)" stroke-width="2" />
        <path d={ECAILLES} stroke="var(--ficelle)" stroke-width="1" fill="none" />
        {#each RAMEURS as r (r.x)}
          <path class="rame" style="animation-delay:{r.w}" d="M{r.x + 3} 22l-8 15" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round" />
        {/each}
        <!-- la proue : le cou et la tête du dragon -->
        <path d="M120 29Q128 27 130 19Q131 13 128 9L135 8Q138 14 136 22Q133 31 122 32Z" fill="var(--bateau-bande)" />
        <path d="M129 5Q121 3 119 10Q123 8 126 12Z" fill="var(--ficelle)" />
        <path d="M130 3Q126-4 120-6Q125-1 127 5Z" fill="var(--ficelle)" />
        <path d="M125 10Q126 2 135 1L142 2Q148 3 149 7Q149 10 146 10L133 11Z" fill="var(--bateau-bande)" />
        <path d="M131 13Q141 12 147 13Q148 15 146 16Q139 18 132 17Z" fill="var(--bateau-bande)" />
        <path d="M136 10.6l1.5 2l1.5-2l1.5 2l1.5-2Z" fill="var(--paper)" />
        <circle cx="137" cy="5" r="2.2" fill="var(--paper)" />
        <circle cx="137.8" cy="5" r="1.1" fill="var(--ink)" />
        <path d="M148 8q5 1 5 5" stroke="var(--ficelle)" stroke-width="1.1" fill="none" stroke-linecap="round" />
      </svg>
    </div>
  {/each}
{/if}

<style>
  /* ---- la danse (春节) : au pied de l'écran, sous les cases ---- */
  .danse {
    position: absolute;
    left: 0;
    bottom: 6px;
    line-height: 0;
    animation: passe 56s linear -20s infinite;
  }
  /* la taille se règle par les dimensions : `transform` appartient à l'animation */
  .danse svg {
    display: block;
    overflow: visible;
    width: 238px;
    height: 53px;
  }
  .onde {
    animation: onde 1.9s ease-in-out infinite alternate;
  }
  .hoche {
    animation: hoche 2.6s ease-in-out infinite alternate;
  }

  /* ---- les bateaux (端午) : sur l'eau, entre ses deux bandes ---- */
  .barque {
    position: absolute;
    left: 0;
    line-height: 0;
    animation: passe var(--d) linear var(--w) infinite;
  }
  .barque svg {
    display: block;
    overflow: visible;
    width: calc(156px * var(--k));
    height: calc(52px * var(--k));
    animation: tangue 2.6s ease-in-out infinite alternate;
  }
  .loin {
    bottom: 37px;
    --k: 0.62;
  }
  .pres {
    bottom: 20px;
    --k: 1;
  }
  .rame {
    transform-box: fill-box;
    transform-origin: 100% 0;
    animation: rame 1.1s ease-in-out infinite alternate;
  }
  .baguette {
    transform-box: fill-box;
    transform-origin: 0 50%;
    animation: bat 0.55s ease-in-out infinite alternate;
  }

  /* un écran court : tout se tasse dans la bande sous les cases */
  @media (max-height: 740px) {
    .danse {
      bottom: 0;
    }
    .danse svg {
      width: 166px;
      height: 37px;
    }
    .loin {
      display: none;
    }
    .pres {
      bottom: 26px;
      --k: 0.74;
    }
  }

  @keyframes passe {
    from { transform: translateX(-240px); }
    to { transform: translateX(calc(100vw + 20px)); }
  }
  @keyframes onde {
    from { transform: translateY(-3px); }
    to { transform: translateY(3px); }
  }
  @keyframes hoche {
    from { transform: rotate(-5deg); }
    to { transform: rotate(4deg); }
  }
  @keyframes tangue {
    from { transform: translateY(0) rotate(-1.2deg); }
    to { transform: translateY(-2px) rotate(1.2deg); }
  }
  @keyframes rame {
    from { transform: rotate(-16deg); }
    to { transform: rotate(14deg); }
  }
  @keyframes bat {
    from { transform: rotate(-18deg); }
    to { transform: rotate(10deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .danse, .barque, .danse svg, .barque svg, .onde, .hoche, .rame, .baguette { animation: none; }
  }
</style>
