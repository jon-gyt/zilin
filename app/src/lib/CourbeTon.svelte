<script lang="ts">
  /**
   * La courbe de « Dis-le » (story 9.1) : la voix de l'apprenant, à l'encre, posée sur la
   * forme canonique du ton attendu, au filet indigo. En demi-tons autour de la moyenne de sa
   * voix, la syllabe ramenée à la largeur de la case. Pas de cinabre (il reste au chemin),
   * ni ombre, ni dégradé. Un décor pour VoiceOver : la phrase du verdict dit la même chose.
   */
  let {
    voix,
    modele,
    legendeVoix,
    legendeModele
  }: {
    /** La voix, en demi-tons ; `null` tant qu'elle n'a pas été analysée. */
    voix: number[] | null;
    modele: number[];
    legendeVoix: string;
    legendeModele: string;
  } = $props();

  const L = 300;
  const H = 110;
  const MARGE = 10;

  /** L'échelle : au moins ±8 demi-tons, assez pour les deux courbes. */
  const lim = $derived(
    Math.max(8, Math.ceil(Math.max(...[...modele, ...(voix ?? [])].map((v) => Math.abs(v)))) + 1)
  );
  const x = (i: number, n: number) => MARGE + (n <= 1 ? 0 : (i / (n - 1)) * (L - 2 * MARGE));
  const y = (v: number) => MARGE + ((lim - v) / (2 * lim)) * (H - 2 * MARGE);
  const chemin = (pts: readonly number[]) =>
    pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i, pts.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
</script>

<figure class="courbe" aria-hidden="true">
  <svg viewBox="0 0 {L} {H}" preserveAspectRatio="none">
    <line class="axe" x1={MARGE} x2={L - MARGE} y1={y(0)} y2={y(0)} />
    <line class="repere" x1={MARGE} x2={L - MARGE} y1={y(6)} y2={y(6)} />
    <line class="repere" x1={MARGE} x2={L - MARGE} y1={y(-6)} y2={y(-6)} />
    <path class="modele" d={chemin(modele)} />
    {#if voix}<path class="voix" d={chemin(voix)} />{/if}
  </svg>
  <figcaption>
    <span><i class="l-voix"></i>{legendeVoix}</span>
    <span><i class="l-modele"></i>{legendeModele}</span>
  </figcaption>
</figure>

<style>
  .courbe {
    margin: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: 76px;
    background: var(--paper);
    border-radius: 10px;
  }
  .axe,
  .repere {
    stroke: var(--line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .repere {
    stroke-dasharray: 3 4;
  }
  .modele {
    fill: none;
    stroke: var(--indigo);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .voix {
    fill: none;
    stroke: var(--ink);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  figcaption {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 2px;
    font-size: 13px;
    color: var(--ink2);
  }
  figcaption i {
    display: inline-block;
    width: 18px;
    height: 0;
    margin-right: 6px;
    vertical-align: middle;
  }
  .l-voix {
    border-top: 4px solid var(--ink);
    border-radius: 2px;
  }
  .l-modele {
    border-top: 2px solid var(--indigo);
  }
</style>
