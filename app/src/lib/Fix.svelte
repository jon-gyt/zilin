<script lang="ts">
  /**
   * Pas 5, Fixer : une vérification sur ce qui vient d'être vu, en questions à choix.
   * Notation automatique (`grade` de `srs.ts`) à partir du temps et des essais, jamais
   * d'auto-évaluation. Avance automatique après une bonne réponse, un tap va plus vite.
   * La correction explique par les briques, avec le texte de la fiche. Des constats.
   *
   * Les questions sont les mêmes que celles de la révision (`questions.ts`), assemblées
   * par `revision.ts` à partir du JSON versionné : sens, caractère, assemblage, sur la
   * brique et le composé du jour, avec la graine du jour.
   */
  import { untrack } from 'svelte';
  import Ask from './Ask.svelte';
  import Tao from './Tao.svelte';
  import { familleOnce, pairesOnce, voisinsOnce, type Famille, type Voisins } from './content';
  import { FICHIER_PAIRES, lirePaires, type Paires, type Question } from './questions';
  import { corpusFixer, questionsFixer } from './revision';
  import { echeance, type Progress, type Revision } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    onrepondu,
    onavancer,
    onfini,
    onquitter
  }: {
    p: Progress;
    /** L'événement de révision, dès qu'une question est notée. */
    onrepondu: (r: Revision) => void;
    onavancer: (i: number) => void;
    onfini: () => void;
    onquitter: () => void;
  } = $props();

  /** Les cinq écrans de la leçon dans la maquette ; Fixer est le quatrième. */
  const PAS_LECON = 5;
  const RANG = 3;

  /** Les cartes de l'ouverture du pas : la vérification ne change pas en cours de route. */
  const cartesDuPas = untrack(() => $state.snapshot(p.cartes));

  let f = $state(null as Famille | null);
  let v = $state(null as Voisins | null);
  let paires = $state([] as Paires);

  $effect(() => {
    let vivant = true;
    void familleOnce()
      .then((x) => {
        if (vivant) f = x;
      })
      .catch(() => {
        if (vivant) f = null;
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    let vivant = true;
    void voisinsOnce()
      .then((x) => {
        if (vivant) v = x;
      })
      .catch(() => {
        if (vivant) v = null;
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    let vivant = true;
    void pairesOnce(FICHIER_PAIRES)
      .then((x) => {
        if (vivant) paires = lirePaires(x);
      })
      .catch(() => {
        if (vivant) paires = [];
      });
    return () => {
      vivant = false;
    };
  });

  const corpus = $derived(
    corpusFixer({ famille: f, voisins: v, cartes: cartesDuPas, paires, trace: p.trace })
  );

  /** La graine du jour : la même vérification toute la journée, jamais deux fois la même. */
  const liste: Question[] = $derived(f && v ? questionsFixer(f, corpus, p.day) : []);
  const i = $derived(Math.min(p.fix, Math.max(0, liste.length - 1)));
  const q: Question | null = $derived(liste[i] ?? null);

  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));

  /** La question suivante, ou la fin de la vérification. */
  function suivant(): void {
    if (i + 1 >= liste.length) onfini();
    else onavancer(i + 1);
  }
</script>

<main class="screen">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>

  <div class="dots" aria-hidden="true">
    {#each { length: PAS_LECON } as _, k (k)}
      <i class:on={k < RANG} class:cur={k === RANG}></i>
    {/each}
  </div>

  {#if q}
    <div class="verif-tete">
      <Tao stade={taoStade} posture="revision" humeur={taoHumeur} size={72} caractere={q.c} />
      <p class="guide grow">Vérifions.</p>
    </div>

    <Ask
      {q}
      {corpus}
      echeanceDe={(c) => echeance(p, c)}
      onnote={onrepondu}
      onsuivant={suivant}
      dernier={i + 1 >= liste.length}
    />
  {:else}
    <p class="guide">La vérification n'a pas pu être préparée.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au chemin</button></div>
  {/if}
</main>
