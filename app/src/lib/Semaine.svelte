<script lang="ts">
  /**
   * La semaine en pierres (maquette validée `maquettes/chemin.html`) : sept pavés posés à
   * plat, du lundi au dimanche, au jade quand la journée a été travaillée, et le pavillon 亭
   * au bout, au pointillé tant que la semaine n'est pas complète : sept pierres, un pavillon,
   * un jour de repos en réserve. Le cinabre ne marque que la pierre d'aujourd'hui, la
   * position. Jamais un compteur de jours manqués : une journée sans pierre ne dit rien.
   *
   * `pose` : la pierre d'aujourd'hui vient d'être posée (Clore) ; elle se pose d'un geste
   * bref, coupé si l'on réduit les animations.
   */
  type Jour = { jour: string; lettre: string; fait: boolean; aujourdhui: boolean };

  let { jours, label, pose = false }: { jours: readonly Jour[]; label: string; pose?: boolean } = $props();

  const faits = $derived(jours.filter((j) => j.fait).length);
  const complete = $derived(faits >= 7);
</script>

<svg class="semaine-pierres" viewBox="0 0 330 46" role="img" aria-label="{label} : {faits} sur 7">
  {#each jours as j, i (j.jour)}
    {@const x = 20 + i * 38}
    <g class="pierre" class:fait={j.fait} class:auj={j.aujourdhui} class:pose={pose && j.aujourdhui && j.fait}>
      <ellipse cx={x} cy="25" rx="17" ry="12" />
      <text x={x} y="29.5" text-anchor="middle">{j.lettre}</text>
    </g>
  {/each}
  <!-- le pavillon 亭 : sept pierres, un jour de repos en réserve -->
  <g class="pavillon" class:plein={complete} transform="translate(296 5)">
    <path d="M-2 14q16-2 18-14q2 12 18 14z" />
    <path class="bois" d="M4 15v20M28 15v20M1 36h30" />
  </g>
</svg>

<style>
  .semaine-pierres {
    display: block;
    width: 100%;
    height: auto;
    margin: 10px 0 6px;
  }
  .pierre ellipse {
    fill: var(--card);
    stroke: var(--line);
    stroke-width: 1.5;
  }
  .pierre text {
    font: 600 12.5px var(--sans);
    fill: var(--mist);
  }
  .pierre.fait ellipse {
    fill: var(--jade);
    stroke: var(--jade);
  }
  .pierre.fait text {
    fill: var(--card);
  }
  /* le cinabre ne marque qu'une chose ici : où l'on en est */
  .pierre.auj ellipse {
    stroke: var(--zhu);
    stroke-width: 2.4;
  }
  .pierre.auj:not(.fait) text {
    fill: var(--zhu);
  }
  .pavillon path {
    fill: var(--card);
    stroke: var(--mist);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
  }
  .pavillon .bois {
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .pavillon.plein path {
    fill: var(--chemin-toit);
    stroke: var(--chemin-toit);
    stroke-dasharray: none;
  }
  .pavillon.plein .bois {
    fill: none;
    stroke: var(--chemin-bois);
  }
  /* la pierre du jour se pose : un geste bref, une fois */
  .pierre.pose {
    transform-box: fill-box;
    transform-origin: center;
    animation: poser 0.55s cubic-bezier(0.2, 1.5, 0.4, 1) 1.2s both;
  }
  @keyframes poser {
    0% {
      transform: translateY(-10px) scale(0.6);
      opacity: 0;
    }
    100% {
      transform: none;
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pierre.pose {
      animation: none;
    }
  }
</style>
