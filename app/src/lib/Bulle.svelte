<script lang="ts">
  /**
   * La bulle de Tao : une phrase courte, la pointe tournée vers elle. `cote` dit de quel
   * côté de Tao la bulle se tient ; le parent la place. Ni ombre ni dégradé : un filet
   * d'encre sur la carte. Elle s'ouvre d'un petit rebond, sauf si l'on réduit les
   * animations.
   */
  let {
    texte,
    cote = 'droite',
    style = ''
  }: { texte: string; cote?: 'droite' | 'gauche'; style?: string } = $props();
</script>

<div class="bulle {cote}" {style} role="status" aria-live="polite">{texte}</div>

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
  @media (prefers-reduced-motion: reduce) {
    .bulle {
      animation: none;
    }
  }
</style>
