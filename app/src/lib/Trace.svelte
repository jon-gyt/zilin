<script lang="ts">
  /**
   * Le tracé d'une brique de base, avec Hanzi Writer. Les traits viennent du JSON servi
   * avec l'app (`charDataLoader`) : la bibliothèque ne va jamais les chercher en ligne.
   * Proposé une fois par brique, jamais pour un composé.
   */
  import HanziWriter from 'hanzi-writer';
  import Glyph from './Glyph.svelte';
  import { strokesOnce } from './strokes';

  let { char }: { char: string } = $props();

  /** Côté de la zone de tracé, comme la maquette. */
  const COTE = 280;

  const NOMBRES = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];

  let boite: HTMLDivElement | null = $state(null);
  /** Nombre de traits, lu dans les données : sert la consigne et le décompte. */
  let traits = $state(0);
  /** Vrai quand les traits de ce caractère ne sont pas embarqués : repli sur le glyphe. */
  let sansDonnees = $state(false);
  let retour = $state('');
  let writer: HanziWriter | null = null;

  function couleur(nom: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  }

  $effect(() => {
    const c = char;
    const cible = boite;
    let vivant = true;
    if (!cible) return;
    void strokesOnce()
      .then((s) => {
        const d = s[c];
        if (!vivant) return;
        if (!d) {
          sansDonnees = true;
          return;
        }
        traits = d.s.length;
        writer = HanziWriter.create(cible, c, {
          width: COTE,
          height: COTE,
          padding: 24,
          showOutline: true,
          strokeColor: couleur('--ink'),
          outlineColor: couleur('--line'),
          radicalColor: null,
          highlightColor: couleur('--zhu'),
          drawingColor: couleur('--indigo'),
          drawingWidth: 14,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 220,
          /* Les traits sont déjà chargés : aucune requête ne sort de l'app. */
          charDataLoader: (_c, done) => done({ strokes: d.s, medians: d.m })
        });
      })
      .catch(() => {
        if (vivant) sansDonnees = true;
      });
    return () => {
      vivant = false;
      writer?.cancelQuiz();
      writer = null;
    };
  });

  function montrer(): void {
    retour = '';
    void writer?.animateCharacter();
  }

  function tracer(): void {
    retour = '';
    void writer?.quiz({
      onCorrectStroke: (d) => {
        retour = `Trait ${d.strokeNum + 1} sur ${traits}, c'est bon.`;
      },
      onMistake: (d) => {
        retour =
          d.mistakesOnStroke >= 3
            ? 'On te montre le trait, puis on continue.'
            : 'Pas tout à fait. Regarde la direction du trait.';
      },
      onComplete: () => {
        retour = `${char} tracé en entier. On y reviendra dans quatre jours.`;
      }
    });
  }
</script>

<h1>Tracer {char}</h1>
<p class="guide">
  {traits > 0 ? `${NOMBRES[traits]} traits. ` : ''}Regarde l'ordre une fois, puis trace au doigt. Le
  trait en cours est en cinabre.
</p>

<div class="writer" bind:this={boite}>
  <svg class="grid" viewBox="0 0 280 280" aria-hidden="true">
    <g stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4">
      <line x1="140" y1="0" x2="140" y2="280" />
      <line x1="0" y1="140" x2="280" y2="140" />
      <line x1="0" y1="0" x2="280" y2="280" />
      <line x1="280" y1="0" x2="0" y2="280" />
    </g>
  </svg>
  {#if sansDonnees}
    <div class="repli"><Glyph {char} size={220} /></div>
  {/if}
</div>

<p class="k center retour" aria-live="polite">{retour}</p>

{#if !sansDonnees}
  <div class="acts">
    <button class="btn ghost" onclick={montrer}>Montrer l'ordre</button>
    <button class="btn" onclick={tracer}>Tracer au doigt</button>
  </div>
{/if}
