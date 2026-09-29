<script lang="ts">
  /**
   * La bulle de Tao : une phrase courte, la pointe tournée vers elle. `cote` dit de quel
   * côté de Tao la bulle se tient ; le parent la place. Ni ombre ni dégradé : un filet
   * d'encre sur la carte. Elle s'ouvre d'un petit rebond, sauf si l'on réduit les
   * animations.
   *
   * Avec `action`, la bulle mène quelque part (une porte qui s'ouvre, brief §6) : elle se
   * touche, son filet et sa flèche passent à l'indigo, l'action.
   *
   * La phrase de Tao s'écrit de gauche à droite, comme au pinceau, une fois la bulle ouverte :
   * un peu plus longue la phrase, un peu plus long le geste, jamais plus de 0,8 s. Le lecteur
   * d'écran a la phrase entière d'emblée. Une annonce (`action`) se lit tout de suite, d'un
   * bloc : elle mène quelque part. Sans animation, la phrase est là d'un coup.
   */
  let {
    texte,
    cote = 'droite',
    style = '',
    action
  }: { texte: string; cote?: 'droite' | 'gauche'; style?: string; action?: () => void } = $props();

  /** La durée du geste : 25 ms par signe, entre 0,25 et 0,8 s. */
  const duree = $derived(Math.min(0.8, Math.max(0.25, [...texte].length * 0.025)));
</script>

{#if action}
  <button class="bulle action {cote}" {style} aria-live="polite" onclick={action}>{texte} <span aria-hidden="true">›</span></button>
{:else}
  <div class="bulle {cote}" {style} role="status" aria-live="polite"><span class="ecrit" style="--duree:{duree}s">{texte}</span></div>
{/if}

<style>
  .bulle {
    position: absolute;
    background: var(--card);
    color: var(--ink);
    border: 1.5px solid var(--ink);
    border-radius: 14px;
    padding: 5px 11px;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
    pointer-events: none;
    animation: bulle 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) 0.4s both;
  }
  .bulle::before {
    content: '';
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    background: var(--card);
    border: 1.5px solid var(--ink);
    transform: translateY(-50%) rotate(45deg);
  }
  /* Une bulle qui mène à une porte : on la touche, l'indigo dit l'action. */
  .action {
    pointer-events: auto;
    /* une annonce longue passe à la ligne plutôt que de sortir de l'écran */
    white-space: normal;
    width: max-content;
    max-width: min(300px, calc(100vw - 104px));
    border-color: var(--indigo);
    color: var(--indigo);
    text-align: left;
  }
  .action::before {
    border-color: var(--indigo);
  }
  /* sa cible de toucher dépasse la bulle, sans la grandir */
  .action::after {
    content: '';
    position: absolute;
    inset: -8px -4px;
  }
  .droite {
    transform-origin: 0 50%;
  }
  .droite::before {
    left: -5.5px;
    border-top: 0;
    border-right: 0;
  }
  .gauche {
    transform-origin: 100% 50%;
  }
  .gauche::before {
    right: -5.5px;
    border-bottom: 0;
    border-left: 0;
  }
  @keyframes bulle {
    from {
      transform: scale(0.5);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  /* la phrase s'écrit, de gauche à droite, une fois la bulle ouverte */
  .ecrit {
    display: inline-block;
    clip-path: inset(0 100% 0 0);
    animation: ecrire var(--duree) linear 0.6s forwards;
  }
  @keyframes ecrire {
    to {
      clip-path: inset(0 0 0 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bulle {
      animation: none;
    }
    .ecrit {
      clip-path: none;
      animation: none;
    }
  }
</style>
