<script lang="ts">
  /**
   * Le tracé d'une brique de base, avec Hanzi Writer. Les traits viennent du JSON servi
   * avec l'app (`charDataLoader`) : la bibliothèque ne va jamais les chercher en ligne.
   * Proposé une fois par brique, jamais pour un composé.
   *
   * Deux emplois : au pas Apprendre, on montre l'ordre puis on trace ; au pas Échauffer,
   * le tracé est une question (`quiz`), il démarre seul et rend le nombre d'erreurs à
   * l'appelant, qui le convertit en note (`outcomeDuTrace` de `questions.ts`).
   */
  import HanziWriter from 'hanzi-writer';
  import Glyph from './Glyph.svelte';
  import { strokesOnce } from './strokes';

  let {
    char,
    quiz = false,
    onresultat,
    onindisponible
  }: {
    char: string;
    /** Question de tracé : ni titre, ni boutons, le tracé démarre tout seul. */
    quiz?: boolean;
    /** Le caractère est tracé en entier : le nombre d'erreurs, pour la note. */
    onresultat?: (erreurs: number) => void;
    /** Les traits de ce caractère ne sont pas embarqués : rien à noter. */
    onindisponible?: () => void;
  } = $props();

  /** Côté de la zone de tracé, comme la maquette. */
  const COTE = 280;

  const NOMBRES = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];

  let boite: HTMLDivElement | null = $state(null);
  /** Nombre de traits, lu dans les données : sert la consigne et le décompte. */
  let traits = $state(0);
  /** Vrai quand les traits de ce caractère ne sont pas embarqués : repli sur le glyphe. */
  let sansDonnees = $state(false);
  let retour = $state('');
  /** Les erreurs du tracé en cours : c'est ce que la question fait noter. */
  let fautes = 0;
  let writer: HanziWriter | null = null;

  function couleur(nom: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  }

  $effect(() => {
    const c = char;
    const cible = boite;
    let vivant = true;
    /* Le dessin du caractère précédent s'en va : deux questions de tracé d'affilée
       changent `char` sans remonter le composant, et les tracés s'empileraient. */
    let ajoute: Element | null = null;
    traits = 0;
    sansDonnees = false;
    retour = '';
    fautes = 0;
    if (!cible) return;
    void strokesOnce()
      .then((s) => {
        const d = s[c];
        if (!vivant) return;
        if (!d) {
          sansDonnees = true;
          if (quiz) onindisponible?.();
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
        ajoute = cible.lastElementChild;
        /* En question, on ne montre rien d'abord : le doigt part tout de suite. */
        if (quiz) tracer();
      })
      .catch(() => {
        if (vivant) sansDonnees = true;
      });
    return () => {
      vivant = false;
      writer?.cancelQuiz();
      writer = null;
      ajoute?.remove();
      ajoute = null;
    };
  });

  function montrer(): void {
    retour = '';
    void writer?.animateCharacter();
  }

  function tracer(): void {
    retour = '';
    fautes = 0;
    void writer?.quiz({
      onCorrectStroke: (d) => {
        retour = `Trait ${d.strokeNum + 1} sur ${traits}, c'est bon.`;
      },
      onMistake: (d) => {
        fautes += 1;
        retour =
          d.mistakesOnStroke >= 3
            ? 'On te montre le trait, puis on continue.'
            : 'Pas tout à fait. Regarde la direction du trait.';
      },
      onComplete: () => {
        retour = `${char} tracé en entier.`;
        onresultat?.(fautes);
      }
    });
  }
</script>

{#if !quiz}
  <h1>Tracer {char}</h1>
  <p class="guide">
    {traits > 0 ? `${NOMBRES[traits]} traits. ` : ''}Regarde l'ordre une fois, puis trace au doigt.
    Le trait en cours est en cinabre.
  </p>
{/if}

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

{#if !sansDonnees && !quiz}
  <div class="acts">
    <button class="btn ghost" onclick={montrer}>Montrer l'ordre</button>
    <button class="btn" onclick={tracer}>Tracer au doigt</button>
  </div>
{/if}
