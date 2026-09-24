<script lang="ts">
  /**
   * Une question posée, quel que soit son type : l'énoncé, le stimulus, les choix, la
   * correction. Les deux pas qui posent des questions s'en servent — Échauffer (pas 2) et
   * Fixer (pas 5) — pour que la réponse se donne et se corrige partout de la même façon.
   *
   * Les sept types viennent de `questions.ts`, la note de `grade` (`srs.ts`) : jamais
   * d'auto-évaluation. Deux erreurs et la réponse est montrée. L'échéance annoncée est
   * celle que FSRS a écrite sur la carte, jamais une constante.
   */
  import Glyph from './Glyph.svelte';
  import Trace from './Trace.svelte';
  import { corriger, type Corpus, type Question, type Reponse } from './questions';
  import { VERDICTS, delai, delaiAvance, pinyinDe } from './revision';
  import { fiche, indiceErreur } from './questions';
  import type { Revision } from './session';
  import { grade } from './srs';
  import type { Grade } from 'ts-fsrs';

  let {
    q,
    cle,
    corpus,
    echeanceDe,
    onnote,
    onsuivant,
    dernier = false
  }: {
    q: Question;
    /**
     * Le rang de la question dans la série. C'est lui qui remet la question à zéro, et
     * pas la question elle-même : noter une réponse met la progression à jour, donc la
     * série se recalcule, et la correction disparaîtrait avant d'avoir été lue.
     */
    cle: number;
    corpus: Corpus;
    /** L'échéance de la carte, relue après la note : ce que FSRS a planifié. */
    echeanceDe: (c: string) => Date | null;
    /** La réponse notée : l'appelant replanifie la carte et range l'événement. */
    onnote: (r: Revision) => void;
    /** Question suivante : au tap, ou tout seul après une bonne réponse, le temps de lire la correction. */
    onsuivant: () => void;
    /** Dernière question de la série : le bouton le dit. */
    dernier?: boolean;
  } = $props();

  /** Deux erreurs : la réponse est montrée, et la carte revient dans dix minutes. */
  const ESSAIS_MAX = 2;

  /** Les choix sont des caractères partout, sauf pour le sens. */
  const caracteres = $derived(q.type !== 'sens');
  const bon = $derived(q.choix.indexOf(q.reponse[0]));
  /** Assemblage de plus de trois briques : des cases plus petites, la ligne tient à 393 px. */
  const serre = $derived(q.reponse.length > 3);
  const tailleCase = $derived(serre ? 36 : 56);

  /* L'état de la question : les essais, le chronomètre, les choix éliminés, l'assemblage. */
  let essais = $state(0);
  let depart = $state(0);
  let rates: number[] = $state([]);
  let construit: number[] = $state([]);
  /** Les réponses fausses des essais d'avant : les leurres pris restent dans l'événement. */
  let ratees: Reponse[] = [];
  let note: Grade | null = $state(null);
  let montree = $state(false);
  let prochaine = $state('');
  /** Le tracé sans données embarquées : on passe, sans noter ce qu'on n'a pas vu. */
  let sautable = $state(false);

  /** Remise à zéro à chaque question : le chronomètre repart, les essais aussi. */
  $effect(() => {
    void cle;
    essais = 0;
    rates = [];
    construit = [];
    ratees = [];
    note = null;
    montree = false;
    prochaine = '';
    sautable = false;
    depart = Date.now();
  });

  /** L'avance automatique après une bonne réponse (`delaiAvance`). Annulée si on tape avant. */
  let minuteur: ReturnType<typeof setTimeout> | null = null;

  function arreter(): void {
    if (minuteur !== null) clearTimeout(minuteur);
    minuteur = null;
  }

  $effect(() => arreter);

  function avancer(): void {
    arreter();
    onsuivant();
  }

  /**
   * Note la réponse : `corriger` rend l'`Outcome`, `grade` la note, l'appelant replanifie
   * la carte. Le délai affiché est relu sur la carte, après coup.
   */
  function noter(reponse: string | string[] | { erreurs: number }): void {
    const seconds = (Date.now() - depart) / 1000;
    const c = corriger(q, reponse, { correct: false, tries: essais, seconds }, ratees);
    note = grade(c.outcome);
    onnote({ c: q.c, ...c.outcome });
    const due = echeanceDe(q.c);
    prochaine = due === null ? '' : delai(new Date(), due);
    /* L'avance automatique laisse lire la correction ; trop longue, on avance au tap. */
    const attente = c.correct ? delaiAvance(`${VERDICTS[note]} ${q.explication.texte}`) : null;
    if (attente !== null) minuteur = setTimeout(avancer, attente);
  }

  /** Un choix. Juste : la question est notée. Faux : un essai de plus, et on explique. */
  function repondre(k: number): void {
    if (note !== null) return;
    if (k === bon) {
      noter(q.choix[k]);
      return;
    }
    rates = [...rates, k];
    essais += 1;
    if (essais >= ESSAIS_MAX) {
      montree = true;
      noter(q.choix[k]);
    } else {
      ratees = [...ratees, q.choix[k]];
    }
  }

  /** Assemblage : les briques une à une, dans l'ordre d'écriture. */
  function assembler(k: number): void {
    if (note !== null || construit.includes(k)) return;
    const suite = [...construit, k];
    construit = suite;
    if (suite.length < q.reponse.length) return;
    const donnee = suite.map((x) => q.choix[x]);
    if (donnee.every((x, n) => x === q.reponse[n])) {
      noter(donnee);
      return;
    }
    essais += 1;
    if (essais >= ESSAIS_MAX) {
      montree = true;
      noter(donnee);
      /* La réponse est montrée : la suite juste prend la place de la suite tentée. */
      construit = q.reponse.map((b) => q.choix.indexOf(b));
    } else {
      ratees = [...ratees, donnee];
      construit = [];
    }
  }

  /**
   * Audio au toucher : aucun fichier n'est encore embarqué. Le type « à l'oreille » est
   * d'ailleurs écarté par `typesPossibles` tant qu'aucune fiche ne porte d'audio.
   */
  function ecouter(_reference: string | undefined): void {}
</script>

<div class="q">
  <p class="ask">{q.enonce}</p>

  {#if q.type === 'sens' || q.type === 'son'}
    <div class="stim"><Glyph char={q.c} size={120} /></div>
  {:else if q.type === 'assemblage'}
    {@const f = fiche(q.c, corpus)}
    <!-- La cible en grand : ce qu'on cherche, avant les briques. Le sens s'il existe, le pinyin toujours. -->
    <div class="cible">
      {#if f && f.fr !== ''}<b>« {f.fr} »</b>{/if}
      <span class="py">{pinyinDe(q.c, corpus)}</span>
    </div>
    <!-- Plus de trois briques : la ligne se resserre pour tenir sur 393 px. -->
    <div class="stim parts" class:serre={serre}>
      {#each q.reponse as _, n (n)}
        {#if n > 0}<span class="op">+</span>{/if}
        {#if construit[n] !== undefined}
          <Glyph char={q.choix[construit[n]]} size={tailleCase} write={false} color="var(--ocre)" />
        {:else}
          <span class="case-vide" aria-label="brique à poser"></span>
        {/if}
      {/each}
      <span class="op">=</span>
      {#if note !== null}
        <Glyph char={q.c} size={tailleCase} write={false} />
      {:else}
        <span class="hz vide">?</span>
      {/if}
    </div>
  {:else if q.type === 'trou'}
    <div class="stim">
      <span class="hz">{q.avant}<span class="blank"></span>{q.apres}</span>
    </div>
  {:else if q.type === 'oreille'}
    <div class="stim">
      <button class="btn ghost ecoute" onclick={() => ecouter(q.audio)}>♪ Réécouter</button>
    </div>
  {:else if q.type === 'trace'}
    <div class="stim">
      <Trace
        char={q.c}
        quiz
        onresultat={(erreurs) => noter({ erreurs })}
        onindisponible={() => (sautable = true)}
      />
    </div>
  {/if}

  {#if q.type !== 'trace'}
    <!-- L'assemblage pose ses briques en vrac sur quatre colonnes : le bouton du bas reste visible. -->
    <div class="choices" class:vrac={q.type === 'assemblage'}>
      {#each q.choix as o, k (o + k)}
        <button
          class:txt={!caracteres}
          class:ok={note !== null && (q.type === 'assemblage' ? q.reponse.includes(o) : k === bon)}
          class:ko={rates.includes(k)}
          class:pris={q.type === 'assemblage' && note === null && construit.includes(k)}
          disabled={note !== null || rates.includes(k) || construit.includes(k)}
          onclick={() => (q.type === 'assemblage' ? assembler(k) : repondre(k))}
        >
          {#if caracteres}
            <Glyph char={o} size={48} write={false} />
            <small>{pinyinDe(o, corpus)}</small>
          {:else}
            {o}
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Rien à dire encore : pas de cadre vide sous les choix. -->
  <div class="fb" class:vide={note === null && !sautable && essais === 0}>
    {#if note !== null}
      <b>{montree ? 'On te montre.' : VERDICTS[note]}</b>
      {q.explication.texte}
      {#if prochaine !== ''}
        <span class="next">Prochaine fois : dans {prochaine}.</span>
      {/if}
    {:else if sautable}
      Ce caractère ne se trace pas encore ici. Continue avec le bouton du bas.
    {:else if essais > 0}
      {indiceErreur(q)}
    {/if}
  </div>
</div>

<div class="foot">
  <button class="btn" disabled={note === null && !sautable} onclick={avancer}>
    {dernier ? 'Terminer' : 'Suivant'}
  </button>
</div>
