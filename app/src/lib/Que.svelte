<script lang="ts">
  /**
   * Que 雀, le moineau. L'ami de Tao : il attend sur le chemin de la série et remet le
   * cadeau du palier. Il ne fait rien d'autre. Ailleurs, on ne le voit qu'à 七夕 : tout
   * petit, dans le même dessin, il se pose sur le pont de pies (`FeteDecor`, `Embleme`).
   *
   * Traits simples, à l'encre, dans l'esprit de la maquette : le corps est une tache
   * d'encre, la gorge reste claire, le bec est à l'ocre. Aucun cinabre : sur cet écran
   * le rouge ne marque que la position sur le chemin. Ni ombre, ni dégradé, ni doré.
   */
  let {
    size = 96,
    pose = 'vole',
    cadeau = 'aucun'
  }: {
    size?: number;
    /** `vole` bat de l'aile, `pose` attend sans bouger. */
    pose?: 'vole' | 'pose';
    /** Le paquet qu'il apporte : rien, fermé sur le chemin, ouvert quand il le remet. */
    cadeau?: 'aucun' | 'ferme' | 'ouvert';
  } = $props();
</script>

<svg class="que {pose}" width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
  {#if cadeau !== 'aucun'}
    <!-- le paquet : indigo, ruban ocre. Le cinabre reste au chemin. -->
    <g class="paquet" class:ouvert={cadeau === 'ouvert'} transform="translate(-30 60) scale(.62)">
      <rect x="56" y="96" width="88" height="70" rx="6" fill="var(--indigo)" />
      <rect x="94" y="96" width="12" height="70" fill="var(--ocre)" />
      <g class="couvercle">
        <rect x="48" y="80" width="104" height="22" rx="5" fill="var(--indigo)" />
        <rect x="94" y="80" width="12" height="22" fill="var(--ocre)" />
        <path
          d="M100 80q-22-30-6-34q10 2 6 34zM100 80q22-30 6-34q-10 2-6 34z"
          fill="var(--ocre)"
        />
      </g>
    </g>
  {/if}

  <path class="queue" d="M56 112 L22 94 L26 124 Z" fill="var(--ink)" />
  <ellipse cx="96" cy="118" rx="44" ry="36" fill="var(--ink)" />
  <ellipse class="gorge" cx="92" cy="128" rx="26" ry="19" fill="var(--paper)" opacity=".85" />
  <circle cx="134" cy="96" r="25" fill="var(--ink)" />
  <path
    class="aile"
    d="M96 112q-30 4-38 28q26 8 46-12z"
    fill="var(--ink)"
    stroke="var(--paper)"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <circle cx="142" cy="90" r="5" fill="var(--paper)" />
  <circle cx="143" cy="90" r="2.4" fill="var(--ink)" />
  <path class="bec" d="M155 91 L183 99 L155 108 Z" fill="var(--ocre)" />
  <path d="M84 150v18M106 150v18" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" />
</svg>
