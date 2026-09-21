<script lang="ts">
  /**
   * Miao 苗, la pousse. Elle n'apparaît qu'aux moments d'émotion :
   * la journée finie (joie) et le retour après absence (sommeil).
   * Port de la fonction `miao` de la maquette.
   */
  export type Pose = 'joy' | 'sleep' | 'calm';

  let { pose = 'calm', size = 110 }: { pose?: Pose; size?: number } = $props();
</script>

<svg class="miao {pose}" width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
  <path
    class="shadow"
    d="M62 156q38 14 76 0"
    stroke="var(--line)"
    stroke-width="4"
    fill="none"
    stroke-linecap="round"
  />
  <g class="body">
    <g class="leaves">
      <path d="M100 66q-30-8-34-40q26 4 34 30M100 66q30-8 34-40q-26 4-34 30" fill="var(--jade)" />
      <path d="M100 68v-18" stroke="var(--jade)" stroke-width="7" stroke-linecap="round" />
    </g>
    <ellipse cx="100" cy="112" rx="42" ry="40" fill="var(--card)" stroke="var(--ink)" stroke-width="5" />
    <circle cx="74" cy="106" r="6" fill="var(--zhu)" opacity=".55" />
    <circle cx="126" cy="106" r="6" fill="var(--zhu)" opacity=".55" />

    {#if pose === 'joy'}
      <path
        d="M78 92q8-9 16 0M106 92q8-9 16 0"
        stroke="var(--ink)"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
      />
      <path d="M90 108q10 12 20 0" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round" />
      <g class="arms">
        <path d="M64 118q-16 2-22-12" stroke="var(--jade)" stroke-width="7" fill="none" stroke-linecap="round" />
        <path d="M136 118q16 2 22-12" stroke="var(--jade)" stroke-width="7" fill="none" stroke-linecap="round" />
      </g>
    {:else if pose === 'sleep'}
      <path d="M78 94h16M106 94h16" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
      <circle cx="100" cy="110" r="4" fill="var(--ink)" />
    {:else}
      <g class="eyes">
        <circle cx="86" cy="92" r="4.5" fill="var(--ink)" />
        <circle cx="114" cy="92" r="4.5" fill="var(--ink)" />
      </g>
      <path d="M92 108q8 7 16 0" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round" />
    {/if}
  </g>

  {#if pose === 'sleep'}
    <g class="zz">
      <text x="134" y="60" font-family="Manrope,sans-serif" font-weight="700" font-size="22" fill="var(--mist)">z</text>
      <text x="146" y="42" font-family="Manrope,sans-serif" font-weight="700" font-size="16" fill="var(--mist)">z</text>
    </g>
  {:else if pose === 'joy'}
    <g class="spark">
      <path
        d="M40 70l-10-10M160 70l10-10M36 96h-12M164 96h12"
        stroke="var(--zhu)"
        stroke-width="4"
        stroke-linecap="round"
      />
    </g>
  {/if}
</svg>
