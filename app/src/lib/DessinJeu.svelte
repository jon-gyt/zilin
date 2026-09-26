<script lang="ts" module>
  import type { JeuId } from './jeux';

  /**
   * Le pigment de chaque jeu, un des quatre de la peinture (`--t1` à `--t4`). Décision du
   * propriétaire du 26 septembre 2026 : les cases de l'écran Jouer gardent toutes le fond
   * de la carte, la couleur n'est que dans les images. Jamais le cinabre, jamais le doré.
   */
  export const PIGMENTS: Record<JeuId, string> = {
    devinette: 'var(--t2)',
    cuisine: 'var(--t3)',
    wechat: 'var(--t4)',
    eclair: 'var(--t1)',
    assembler: 'var(--t3)',
    jumeaux: 'var(--t1)',
    chaine: 'var(--t4)',
    coquille: 'var(--t3)'
  };
</script>

<script lang="ts">
  /**
   * Le petit dessin plat d'un jeu, sur sa carte de l'écran Jouer (maquette approuvée
   * `wenlu-lire-jouer.html`) : aplats du pigment, filets d'encre, fond de la carte. Ni
   * ombre, ni dégradé, ni caractère en police : les deux jumeaux 土 et 士 sont tracés en
   * trois traits. La devinette du jour est une lanterne 灯谜 ; son caractère, quand
   * l'export a ses traits, est posé par-dessus par l'écran.
   */
  let { id, size = 54 }: { id: JeuId; size?: number } = $props();
</script>

{#if id === 'devinette'}
  <svg viewBox="0 0 86 100" width={size} height={Math.round((size * 100) / 86)} aria-hidden="true">
    <path d="M43 2v10" stroke="var(--ink)" stroke-width="2" />
    <rect x="31" y="12" width="24" height="7" rx="2" fill="var(--ink)" />
    <ellipse cx="43" cy="50" rx="33" ry="31" fill="var(--fg)" />
    <path
      d="M43 19q-22 31 0 62M43 19q22 31 0 62M43 19v62M16 38q27 6 54 0M16 62q27-6 54 0"
      fill="none"
      stroke="var(--card)"
      stroke-width="2"
      opacity=".55"
    />
    <rect x="31" y="80" width="24" height="7" rx="2" fill="var(--ink)" />
    <path d="M37 87v11M43 87v13M49 87v11" stroke="var(--fg)" stroke-width="2.2" stroke-linecap="round" />
  </svg>
{:else}
  <svg viewBox="0 0 54 50" width={size} height={Math.round((size * 50) / 54)} aria-hidden="true">
    {#if id === 'cuisine'}
      <path d="M8 30h38q-2 16-19 16t-19-16z" fill="var(--fg)" />
      <path d="M4 30h46" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" />
      <path d="M34 26L50 6M38 28L52 10" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" />
      <path
        d="M18 24q-3-5 0-10M26 24q-3-5 0-10"
        stroke="var(--fg)"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
    {:else if id === 'wechat'}
      <rect x="4" y="8" width="32" height="22" rx="8" fill="var(--fg)" />
      <path d="M12 30l-3 7 9-7z" fill="var(--fg)" />
      <path d="M12 19h16" stroke="var(--card)" stroke-width="2.4" stroke-linecap="round" />
      <rect x="22" y="24" width="28" height="18" rx="7" fill="var(--card)" stroke="var(--fg)" stroke-width="2" />
      <g fill="var(--fg)"><circle cx="30" cy="33" r="1.8" /><circle cx="36" cy="33" r="1.8" /><circle cx="42" cy="33" r="1.8" /></g>
    {:else if id === 'eclair'}
      <path d="M4 12q12-4 23 2v30q-11-6-23-2z" fill="var(--fg)" />
      <path d="M50 12q-12-4-23 2v30q11-6 23-2z" fill="var(--card)" stroke="var(--fg)" stroke-width="2" />
      <path d="M40 16l-6 11h6l-6 11" stroke="var(--fg)" stroke-width="2.4" fill="none" stroke-linejoin="round" />
    {:else if id === 'assembler'}
      <rect x="4" y="10" width="20" height="34" rx="3" fill="var(--fg)" />
      <rect x="28" y="10" width="22" height="16" rx="3" fill="var(--card)" stroke="var(--fg)" stroke-width="2" />
      <rect
        x="28"
        y="30"
        width="22"
        height="14"
        rx="3"
        fill="var(--card)"
        stroke="var(--fg)"
        stroke-width="2"
        stroke-dasharray="3 3"
      />
    {:else if id === 'jumeaux'}
      <rect x="3" y="10" width="22" height="30" rx="3" fill="var(--fg)" />
      <rect x="29" y="10" width="22" height="30" rx="3" fill="var(--card)" stroke="var(--fg)" stroke-width="2" />
      <!-- 土 : le trait du haut court ; 士 : le trait du haut long. -->
      <path d="M9 21h10M14 15v18M6 33h16" stroke="var(--card)" stroke-width="2.4" stroke-linecap="round" />
      <path d="M32 21h16M40 15v18M35 33h10" stroke="var(--fg)" stroke-width="2.4" stroke-linecap="round" />
    {:else if id === 'chaine'}
      <rect x="3" y="18" width="22" height="14" rx="7" fill="none" stroke="var(--fg)" stroke-width="4" />
      <rect x="17" y="18" width="22" height="14" rx="7" fill="none" stroke="var(--ink)" stroke-width="3" />
      <rect x="31" y="18" width="20" height="14" rx="7" fill="none" stroke="var(--fg)" stroke-width="4" />
    {:else if id === 'coquille'}
      <rect x="4" y="8" width="46" height="34" rx="3" fill="var(--card)" stroke="var(--fg)" stroke-width="2" />
      <path d="M10 18h34M10 26h14M34 26h10M10 34h26" stroke="var(--grille)" stroke-width="2.4" />
      <circle cx="29" cy="26" r="6" fill="none" stroke="var(--fg)" stroke-width="2.6" />
    {/if}
  </svg>
{/if}

<style>
  svg {
    display: block;
    flex: none;
  }
</style>
