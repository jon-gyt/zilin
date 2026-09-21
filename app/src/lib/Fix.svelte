<script lang="ts">
  /**
   * Pas 5, Fixer : une vérification sur ce qui vient d'être vu, en questions à choix.
   * Notation automatique (`grade` de `srs.ts`) à partir du temps et des essais, jamais
   * d'auto-évaluation. Avance automatique après une bonne réponse, un tap va plus vite.
   * La correction explique par les briques, avec le texte de la fiche. Des constats.
   *
   * Les questions sont construites par `questions.ts`, à partir du JSON versionné.
   */
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import { familleOnce, jourDepuisEpoque, voisinsOnce, type Famille, type Voisins } from './content';
  import { AVANCE_MS, PROCHAINE_FOIS, VERDICTS, questions, type Question } from './questions';
  import type { Progress, Revision } from './session';
  import { grade } from './srs';
  import { humeur, stade } from './tao';
  import type { Grade } from 'ts-fsrs';

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

  /** Deux erreurs : la réponse est montrée, et la carte revient dans dix minutes. */
  const ESSAIS_MAX = 2;

  let f = $state(null as Famille | null);
  let v = $state(null as Voisins | null);

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

  /** La graine du jour : la même vérification toute la journée, jamais deux fois la même. */
  const liste: Question[] = $derived(f && v ? questions(f, v, jourDepuisEpoque(p.day)) : []);
  const i = $derived(Math.min(p.fix, Math.max(0, liste.length - 1)));
  const q: Question | null = $derived(liste[i] ?? null);

  /* L'état d'une question : les essais, le temps, ce qui est déjà éliminé. */
  let essais = $state(0);
  let depart = $state(0);
  let rates: number[] = $state([]);
  let note: Grade | null = $state(null);
  let montree = $state(false);

  /** Remise à zéro à chaque question : le chronomètre repart, les essais aussi. */
  $effect(() => {
    void i;
    essais = 0;
    rates = [];
    note = null;
    montree = false;
    depart = Date.now();
  });

  /** L'avance automatique, 1,3 s après une bonne réponse. Annulée si on tape avant. */
  let minuteur: ReturnType<typeof setTimeout> | null = null;

  function arreter(): void {
    if (minuteur !== null) clearTimeout(minuteur);
    minuteur = null;
  }

  $effect(() => arreter);

  function avancer(): void {
    arreter();
    if (i + 1 >= liste.length) onfini();
    else onavancer(i + 1);
  }

  /** Note la réponse et la range dans la progression, en événement de révision. */
  function noter(question: Question, correct: boolean): void {
    const seconds = (Date.now() - depart) / 1000;
    note = grade({ correct, tries: essais, seconds });
    onrepondu({ c: question.c, correct, tries: essais, seconds });
    if (correct) minuteur = setTimeout(avancer, AVANCE_MS);
  }

  /** Un choix. Juste : la question est notée. Faux : un essai de plus, et on explique. */
  function repondre(question: Question, k: number): void {
    if (note !== null) return;
    if (k === question.ok) {
      noter(question, true);
      return;
    }
    rates = [...rates, k];
    essais += 1;
    if (essais >= ESSAIS_MAX) {
      montree = true;
      noter(question, false);
    }
  }

  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));
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
      <p class="guide grow">Vérifions. {q.ask}</p>
    </div>

    <div class="q">
      <div class="k">{q.label}</div>
      {#if q.type === 'sens'}
        <div class="stim"><Glyph char={q.c} size={120} /></div>
      {:else if q.type === 'parts'}
        <div class="stim parts">
          {#each q.parts as part, k (part + k)}
            {#if k > 0}<span class="op">+</span>{/if}
            <Glyph char={part} size={56} write={false} color="var(--ocre)" />
          {/each}
          <span class="op">=</span>
          <span class="hz vide">?</span>
        </div>
      {/if}

      <div class="choices">
        {#each q.opts as o, k (o + k)}
          <button
            class:txt={!q.caracteres}
            class:ok={note !== null && k === q.ok}
            class:ko={rates.includes(k)}
            disabled={note !== null || rates.includes(k)}
            onclick={() => repondre(q, k)}
          >
            {#if q.caracteres}
              <Glyph char={o} size={48} write={false} />
            {:else}
              {o}
            {/if}
          </button>
        {/each}
      </div>

      <div class="fb">
        {#if note !== null}
          <b>{montree ? 'On te montre.' : VERDICTS[note]}</b>
          {q.why}
          <span class="next">Prochaine fois : dans {PROCHAINE_FOIS[note]}.</span>
        {:else if essais > 0}
          Pas celui-là. Regarde les briques.
        {/if}
      </div>
    </div>

    <div class="foot">
      <button class="btn" disabled={note === null} onclick={avancer}>
        {i + 1 >= liste.length ? 'Terminer la vérification' : 'Suivant'}
      </button>
    </div>
  {:else}
    <p class="guide">La vérification n'a pas pu être préparée.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au chemin</button></div>
  {/if}
</main>
