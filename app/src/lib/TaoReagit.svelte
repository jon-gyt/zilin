<script lang="ts">
  /**
   * Tao qui réagit aux verdicts d'un jeu (`reaction.ts`) : une bouchée à chaque bonne
   * réponse, une grimace brève sur une erreur (celle de `Tao.svelte`, la cuisine s'en
   * sert déjà), un bond après trois justes d'affilée. Aucun compteur : la série ne se
   * lit qu'à sa posture.
   *
   * `cle` change à chaque verdict : l'animation repart, même deux bouchées de suite.
   * Sans animation demandée (`prefers-reduced-motion`), elle ne bouge pas ; seule la
   * grimace se lit encore, sur son visage, le temps de `GRIMACE_MS`.
   */
  import Tao from './Tao.svelte';
  import { BOND_MS, GRIMACE_MS, type Reaction } from './reaction';
  import type { Humeur, PostureVue, Stade } from './tao';

  let {
    reaction = null,
    cle = 0,
    stade,
    posture,
    humeur,
    size,
    penchee = false,
    allumee = false
  }: {
    /** La dernière réaction, `null` avant tout verdict. */
    reaction?: Reaction | null;
    /** Le numéro du verdict : chaque nouveau verdict relance l'animation. */
    cle?: number;
    stade?: Stade;
    posture?: PostureVue;
    humeur?: Humeur;
    size?: number;
    penchee?: boolean;
    /** La lanterne des devinettes, allumée (`Tao.svelte`). */
    allumee?: boolean;
  } = $props();

  /** Ce qui se voit encore : la grimace et le bond passent, la bouchée n'a pas de visage. */
  let visible = $state<Reaction | null>(null);

  $effect(() => {
    const r = reaction;
    void cle;
    visible = r;
    if (r !== 'grimace' && r !== 'bond') return;
    const t = setTimeout(() => (visible = null), r === 'grimace' ? GRIMACE_MS : BOND_MS);
    return () => clearTimeout(t);
  });
</script>

<span class="reagit">
  {#key cle}
    <span class="corps {reaction ?? ''}">
      <Tao
        {stade}
        {posture}
        humeur={visible === 'bond' ? 'joie' : humeur}
        {size}
        {penchee}
        {allumee}
        grimace={visible === 'grimace'}
      />
    </span>
  {/key}
</span>

<style>
  .reagit,
  .corps {
    display: inline-flex;
  }
  .corps {
    transform-origin: 50% 85%;
  }
  /* Une bouchée : elle se tasse et se redresse, une fois. */
  .corps.bouchee {
    animation: bouchee 0.42s ease-in-out 1;
  }
  /* Un bond : un saut, et elle se pose. */
  .corps.bond {
    animation: bond 0.7s ease-out 1;
  }
  @keyframes bouchee {
    0%,
    100% {
      transform: none;
    }
    35% {
      transform: scale(1.05, 0.9);
    }
    70% {
      transform: scale(0.98, 1.04);
    }
  }
  @keyframes bond {
    0%,
    100% {
      transform: none;
    }
    15% {
      transform: scale(1.04, 0.94);
    }
    45% {
      transform: translateY(-16%);
    }
    80% {
      transform: scale(1.03, 0.96);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .corps.bouchee,
    .corps.bond {
      animation: none;
    }
  }
</style>
