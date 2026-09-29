<script lang="ts">
  /**
   * L'essai de « Dis-le », ouvert par « Essayer maintenant » sous le réglage « Dire les tons »
   * (Réglages) : un caractère acquis au hasard, la même question qu'en révision, et rien
   * n'est noté. Ce n'est pas une porte de l'aventure : on n'y entre que depuis Réglages, et
   * l'on y revient. La voix, elle, s'apprend ici comme ailleurs (sa seule moyenne).
   *
   * Jamais d'écran muet : sans micro, sans modèle ou sans caractère, l'écran dit pourquoi, en
   * une ligne, et le retour reste là.
   */
  import Dire from './Dire.svelte';
  import Tao from './Tao.svelte';
  import { toutesLesFiches, type FicheLue } from './content';
  import { ecransOnce, SANS_ECRANS, type TextesDire } from './ecrans';
  import { corpusRevision } from './revision';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';
  import type { Modele } from './tons/classifieur';
  import { cibleDEssai, type CibleDire } from './tons/dire';
  import { etatMicro, microPossible, type EtatMicro } from './tons/micro';
  import { modeleOnce } from './tons/modele';

  let {
    p,
    onvoix,
    onmicrorefuse,
    onretour
  }: {
    p: Progress;
    onvoix: (hz: number) => void;
    onmicrorefuse: () => void;
    onretour: () => void;
  } = $props();

  let t = $state<TextesDire>(SANS_ECRANS.dire);
  let fiches = $state.raw<FicheLue[] | null>(null);
  let modele = $state.raw<Modele | null | undefined>(undefined);
  let micro = $state<EtatMicro | null>(null);
  let cible = $state<CibleDire | null>(null);
  let tour = $state(0);

  $effect(() => {
    let vivant = true;
    void ecransOnce()
      .then((e) => {
        if (vivant) t = e.dire;
      })
      .catch(() => undefined);
    void toutesLesFiches()
      .then((f) => {
        if (vivant) fiches = f;
      })
      .catch(() => {
        if (vivant) fiches = [];
      });
    void modeleOnce().then((m) => {
      if (vivant) modele = m;
    });
    void etatMicro()
      .then((e) => {
        if (vivant) micro = e;
      })
      .catch(() => {
        if (vivant) micro = 'absent';
      });
    return () => {
      vivant = false;
    };
  });

  /** Un caractère acquis au hasard (l'essai ne note rien : le hasard y a sa place). */
  function tirer(): void {
    if (fiches === null) return;
    const corpus = corpusRevision({ fiches, voisins: null, cartes: p.cartes });
    cible = cibleDEssai(corpus, p.cartes.map((c) => c.id), Math.random());
    tour += 1;
  }

  $effect(() => {
    if (fiches !== null && cible === null) tirer();
  });

  const pret = $derived(fiches !== null && modele !== undefined && micro !== null);
  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
</script>

<main class="screen">
  <button class="k quit" onclick={onretour}>‹ {t.retour}</button>
  <div class="rev-tete">
    <div class="grow">
      <h1>{t.label}</h1>
      <div class="k">{t.essai}</div>
    </div>
    <Tao stade={taoStade} posture="jeu" penchee humeur={taoHumeur} size={64} />
  </div>

  {#if !pret}
    <p class="guide">…</p>
  {:else if micro !== null && !microPossible(micro)}
    <p class="guide">{micro === 'refuse' ? t.refuse : t.absent}</p>
  {:else if modele && cible && micro}
    <Dire
      {cible}
      cle={tour}
      textes={t}
      {modele}
      voix={p.voix}
      {micro}
      essai
      {onvoix}
      onmicro={(e) => {
        micro = e;
        if (e === 'refuse') onmicrorefuse();
      }}
      onsuivant={tirer}
    />
  {:else}
    <p class="guide">{t.indisponible}</p>
  {/if}
</main>
