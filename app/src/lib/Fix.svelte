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
  import EnTetePas from './EnTetePas.svelte';
  import Tao from './Tao.svelte';
  import {
    LIGNE_SANS_FICHE,
    lecon,
    pairesExport,
    toutesLesFiches,
    voisinsOnce,
    type FicheLue,
    type Voisins
  } from './content';
  import { lirePaires, type Paires, type Question } from './questions';
  import { corpusFixer, questionsFixerDuJour } from './revision';
  import { echeance, jourLecon, repriseFix, type Progress, type Revision } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    onrepondu,
    onavancer,
    onfini,
    onquitter
  }: {
    p: Progress;
    /** L'événement de révision, et le rang de la question notée : elle ne se repose pas. */
    onrepondu: (r: Revision, i: number) => void;
    onavancer: (i: number) => void;
    onfini: () => void;
    onquitter: () => void;
  } = $props();

  /** Les cartes de l'ouverture du pas : la vérification ne change pas en cours de route. */
  const cartesDuPas = untrack(() => $state.snapshot(p.cartes));

  /** La question par laquelle la vérification reprend : les questions notées sont passées. */
  const debut = untrack(() => repriseFix(p));

  /**
   * Le corpus vient de l'export versionné, comme au pas Échauffer ; la vérification, elle,
   * ne porte que sur la brique et le composé que le parcours a posés aujourd'hui.
   */
  let f = $state([] as FicheLue[]);
  let v = $state(null as Voisins | null);
  let paires = $state([] as Paires);
  /** La brique et le composé du jour : les deux seuls caractères vérifiés. */
  let brique = $state(null as string | null);
  let compose = $state(null as string | null);

  $effect(() => {
    let vivant = true;
    void toutesLesFiches()
      .then((x) => {
        if (vivant) f = x;
      })
      .catch(() => {
        if (vivant) f = [];
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    const n = jourLecon(p);
    const choisi = p.parcours;
    let vivant = true;
    void lecon(choisi, n)
      .then((l) => {
        if (!vivant) return;
        brique = l.brique?.c ?? null;
        compose = l.composes[0]?.c ?? null;
      })
      .catch(() => {
        if (vivant) {
          brique = null;
          compose = null;
        }
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
    void pairesExport()
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
    corpusFixer({ fiches: f, voisins: v, cartes: cartesDuPas, paires, trace: p.trace })
  );

  /** La graine du jour : la même vérification toute la journée, jamais deux fois la même. */
  /** Le contenu est-il lu ? Tant qu'il ne l'est pas, on ne dit pas que la vérification a échoué. */
  const pret = $derived(f.length > 0 && v !== null);
  const liste: Question[] = $derived(pret ? questionsFixerDuJour(brique, compose, corpus, p.day) : []);
  const i = $derived(Math.min(Math.max(p.fix, debut), liste.length));
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
  <EnTetePas {p} {onquitter} />

  {#if q}
    <div class="verif-tete">
      <Tao stade={taoStade} posture="revision" humeur={taoHumeur} size={72} caractere={q.c} />
      <p class="guide grow">Vérifions.</p>
    </div>

    <Ask
      {q}
      cle={i}
      {corpus}
      echeanceDe={(c) => echeance(p, c)}
      onnote={(r) => onrepondu(r, i)}
      onsuivant={suivant}
      dernier={i + 1 >= liste.length}
    />
  {:else if !pret}
    <p class="guide">Un instant.</p>
  {:else if liste.length > 0}
    <!-- Toutes les questions ont déjà été notées : la vérification est faite. -->
    <p class="guide">La vérification est faite.</p>
    <div class="foot"><button class="btn" onclick={onfini}>Continuer</button></div>
  {:else}
    <!-- Rien de vérifiable : la fiche du jour n'a pas encore de quoi poser une question. -->
    <p class="guide">Rien à vérifier aujourd'hui. {LIGNE_SANS_FICHE}</p>
    <div class="foot"><button class="btn" onclick={onfini}>Continuer</button></div>
  {/if}
</main>
