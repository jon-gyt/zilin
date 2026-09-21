<script lang="ts">
  /**
   * Pas 2, Échauffer : les cartes dues du jour, en questions (maquette `s-rev`).
   *
   * La pile est figée à l'ouverture du pas et rangée dans la progression : la reprise
   * tombe sur la question exacte. Les sept types viennent de `questions.ts`, le corpus de
   * `revision.ts`, la planification de `srs.ts`. Tao est là en posture révision, sans
   * commentaire : on apprend, elle ne parle pas.
   */
  import { untrack } from 'svelte';
  import Ask from './Ask.svelte';
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import {
    pairesExport,
    toutesLesFiches,
    voisinsOnce,
    type FicheLue,
    type Voisins
  } from './content';
  import { lirePaires, type Paires, type Question } from './questions';
  import { corpusRevision, questionsRevision, resume, sures } from './revision';
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
    /** La réponse notée, dès qu'une question est jugée : la carte est replanifiée. */
    onrepondu: (r: Revision) => void;
    /** La question suivante : la reprise se fait à celle-ci. */
    onavancer: (i: number) => void;
    onfini: () => void;
    onquitter: () => void;
  } = $props();

  /**
   * Les cartes telles qu'elles étaient à l'ouverture de la séance : les questions d'une
   * même séance sont décidées une fois pour toutes, même si l'acquis grandit en route.
   */
  const cartesDeLaSeance = untrack(() => $state.snapshot(p.cartes));

  /**
   * Le corpus vient de l'export versionné : toutes les fiches de `data/0.1.0/`, déjà
   * surcouchées par les textes de démonstration là où le pipeline n'a rien relu. Les
   * voisins de forme de la maquette restent en appoint pour les leurres, et les paires
   * à ne pas confondre sont celles de l'export.
   */
  let f = $state([] as FicheLue[]);
  let v = $state(null as Voisins | null);
  let paires = $state([] as Paires);
  let chargee = $state(false);

  $effect(() => {
    let vivant = true;
    void toutesLesFiches()
      .then((x) => {
        if (vivant) f = x;
      })
      .catch(() => {
        if (vivant) f = [];
      })
      .finally(() => {
        if (vivant) chargee = true;
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

  const pret = $derived(chargee && v !== null);

  const corpus = $derived(
    corpusRevision({ fiches: f, voisins: v, cartes: cartesDeLaSeance, paires, trace: p.trace })
  );

  /** Une question par carte de la pile, dans l'ordre. La graine du jour fait le reste. */
  const liste: Question[] = $derived(pret ? questionsRevision(p.revue, corpus, p.day) : []);
  /** L'index de la question en cours ; au-delà de la dernière, c'est le résumé. */
  const i = $derived(Math.min(p.rev, liste.length));
  const q: Question | null = $derived(liste[i] ?? null);

  /** Le résumé lit les cartes : la note et l'échéance sont celles que FSRS a écrites. */
  const lignes = $derived(resume(liste, p.cartes, new Date()));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));
  const avance = $derived(liste.length === 0 ? 100 : Math.round((i / liste.length) * 100));
</script>

<main class="screen">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>

  <div class="rev-tete">
    <div class="grow">
      <h1>Réviser</h1>
      <div class="k">
        {#if q}{i + 1} / {liste.length} · {q.label}{:else if p.revue.length > 0}terminé{/if}
      </div>
    </div>
    <Tao stade={taoStade} posture="revision" humeur={taoHumeur} size={64} />
  </div>

  {#if p.revue.length > 0}
    <div class="prog" aria-hidden="true"><i style="width:{avance}%"></i></div>
  {/if}

  {#if p.revue.length === 0}
    <p class="guide">Aucune carte n'est due aujourd'hui.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Continuer</button></div>
  {:else if !pret}
    <p class="guide">Un instant.</p>
  {:else if q}
    <Ask
      {q}
      cle={i}
      {corpus}
      echeanceDe={(c) => echeance(p, c)}
      onnote={onrepondu}
      onsuivant={() => onavancer(i + 1)}
      dernier={i + 1 >= liste.length}
    />
  {:else if liste.length > 0}
    <div class="q">
      <h1 class="bilan">{sures(lignes)} sur {liste.length} du premier coup.</h1>
      <p class="guide">Ce qui a hésité revient plus tôt. On se revoit demain matin.</p>
      <div class="res">
        {#each lignes as l, k (l.c + k)}
          <div>
            <Glyph char={l.c} size={30} write={false} />
            <span class="grow">{l.label}</span>
            <span class={l.sure ? 'ok' : 'ko'}>
              {l.verdict}{l.quand === '' ? '' : ` · ${l.quand}`}
            </span>
          </div>
        {/each}
      </div>
    </div>
    <div class="foot"><button class="btn" onclick={onfini}>Retour au chemin</button></div>
  {:else}
    <p class="guide">Les questions n'ont pas pu être préparées.</p>
    <div class="foot"><button class="btn" onclick={onfini}>Revenir au chemin</button></div>
  {/if}
</main>
