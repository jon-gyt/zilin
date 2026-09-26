<script lang="ts">
  /**
   * Le petit motif d'une couverture de conte, dans Lire : un aplat au pigment de la
   * couverture (`currentColor`), le creux au pâle du même pigment (`--c-bg`). Le nom vient
   * du catalogue (`motif`, un nom de `etageres.MOTIFS`) ; l'app ne connaît aucun conte, elle
   * ne sait que dessiner ces treize motifs. Un nom inconnu ne dessine rien.
   *
   * Charte : ni ombre, ni dégradé, ni doré, ni cinabre. Pas de dragon : le conte de M. Ye a
   * le rouleau peint (`rouleau`), jamais la bête.
   */
  import type { Motif } from './etageres';

  let { nom, size = 34 }: { nom: Motif | null; size?: number } = $props();
</script>

{#if nom}
  <svg
    class="motif"
    viewBox="0 0 34 34"
    width={size}
    height={size}
    aria-hidden="true"
    fill="currentColor"
    stroke="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {#if nom === 'montagne'}
      <!-- les deux montagnes -->
      <path d="M1 32 L11 14 L17 22 L24 9 L33 32Z" />
    {:else if nom === 'pousse'}
      <!-- une pousse et ses deux feuilles -->
      <path d="M17 32 V15" fill="none" stroke="currentColor" stroke-width="2.4" />
      <path d="M17 22 q-9 -2 -10 -10 q8 1 10 8Z M17 19 q9 -2 10 -10 q-8 1 -10 8Z" />
    {:else if nom === 'roues'}
      <!-- le char, deux roues et le timon -->
      <path d="M3 18 H31" fill="none" stroke="currentColor" stroke-width="2.4" />
      <circle cx="9" cy="25" r="6" fill="none" stroke="currentColor" stroke-width="2.4" />
      <circle cx="25" cy="25" r="6" fill="none" stroke="currentColor" stroke-width="2.4" />
    {:else if nom === 'puits'}
      <!-- la margelle, et la grenouille au fond -->
      <rect x="4" y="6" width="26" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="2.4" />
      <circle cx="17" cy="22" r="5" />
    {:else if nom === 'souche'}
      <!-- la souche, et l'oreille du lièvre qui s'y heurte -->
      <rect x="5" y="20" width="16" height="12" />
      <ellipse cx="13" cy="20" rx="8" ry="3" fill="var(--c-bg, var(--card))" stroke="currentColor" stroke-width="2" />
      <path d="M26 32 V20 L29 12 M26 20 L23 12" fill="none" stroke="currentColor" stroke-width="2.4" />
    {:else if nom === 'serpent'}
      <!-- le serpent, et les pattes de trop -->
      <path d="M3 24 q6 -12 12 0 t12 0" fill="none" stroke="currentColor" stroke-width="3" />
      <circle cx="29" cy="23" r="2.4" />
      <path d="M9 27 v5 M21 27 v5" fill="none" stroke="currentColor" stroke-width="2" />
    {:else if nom === 'tigre'}
      <!-- la tête du tigre, ses oreilles et ses rayures -->
      <circle cx="8" cy="10" r="4.5" />
      <circle cx="26" cy="10" r="4.5" />
      <circle cx="17" cy="20" r="12" />
      <path d="M17 10 v5 M12 11.5 l1.6 4 M22 11.5 l-1.6 4" fill="none" stroke="var(--c-bg, var(--card))" stroke-width="2" />
      <circle cx="12.5" cy="20" r="1.8" fill="var(--c-bg, var(--card))" />
      <circle cx="21.5" cy="20" r="1.8" fill="var(--c-bg, var(--card))" />
    {:else if nom === 'cheval'}
      <!-- le cheval, de profil -->
      <path d="M6 32 V16 l6 -9 h6 l2 6 h9 v19" fill="none" stroke="currentColor" stroke-width="2.6" />
      <path d="M12 7 l-2 -4 M16 7 l0 -4" fill="none" stroke="currentColor" stroke-width="2" />
    {:else if nom === 'elephant'}
      <!-- l'éléphant et sa trompe -->
      <ellipse cx="19" cy="17" rx="13" ry="10" />
      <path d="M8 21 q-5 6 -1 11" fill="none" stroke="currentColor" stroke-width="3" />
      <path d="M13 26 v6 M25 26 v6" fill="none" stroke="currentColor" stroke-width="3.4" />
    {:else if nom === 'rouleau'}
      <!-- un rouleau peint, suspendu : un dessin sur un dessin, jamais la bête -->
      <path d="M4 4 H30 M4 32 H30" fill="none" stroke="currentColor" stroke-width="3" />
      <rect x="7" y="5" width="20" height="26" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M11 12 h12 M11 18 h12 M11 24 h8" fill="none" stroke="currentColor" stroke-width="2" />
    {:else if nom === 'enclos'}
      <!-- l'enclos -->
      <path d="M4 32 V12 M12 32 V12 M20 32 V12 M28 32 V12 M1 17 H31 M1 26 H31" fill="none" stroke="currentColor" stroke-width="2.4" />
    {:else if nom === 'lance'}
      <!-- la lance et sa pointe -->
      <path d="M7 32 L25 7" fill="none" stroke="currentColor" stroke-width="3" />
      <path d="M22 3 l9 0 -2 9z" />
      <path d="M17 17 l5 3" fill="none" stroke="currentColor" stroke-width="2" />
    {:else if nom === 'singe'}
      <!-- la tête du singe, ses oreilles rondes et le visage clair -->
      <circle cx="5.5" cy="18" r="4.5" />
      <circle cx="28.5" cy="18" r="4.5" />
      <circle cx="17" cy="17" r="12" />
      <path d="M17 13 q-3 -4 -6 -1 q-3 4 0 9 q3 5 6 5 q3 0 6 -5 q3 -5 0 -9 q-3 -3 -6 1Z" fill="var(--c-bg, var(--card))" />
      <circle cx="13.5" cy="17" r="1.6" />
      <circle cx="20.5" cy="17" r="1.6" />
    {/if}
  </svg>
{/if}

<style>
  .motif {
    display: block;
  }
</style>
