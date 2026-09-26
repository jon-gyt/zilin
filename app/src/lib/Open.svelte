<script lang="ts">
  /**
   * Pas 1, Ouvrir : l'anecdote du jour, en estampe. Vingt secondes, sautable.
   * Le texte vient du JSON versionné de `app/public/data/`, jamais du code.
   *
   * Tao écoute l'anecdote assise (brief §9) : petite, dans le coin, sans un mot. Elle
   * est posée hors du flux, la mise en page de l'estampe ne bouge pas.
   *
   * Le jour où se montre celle d'une fête (`fetes.json`) — une fois par occurrence, le
   * premier jour de sa fenêtre où l'on ouvre l'app (`saisons.anecdoteDeFete`) —, l'anecdote
   * est celle de la fête : sa rubrique (« L'anecdote de la mi-automne »), et son caractère
   * écrit au pinceau devant l'emblème de la fête — la pleine lune, la rosace de papier découpé, la lanterne… C'est le
   * caractère bonus de la fête (灯, 雨, 粽, 桥, 菊, 冬…) : son pinyin et son sens suivent,
   * tels que `fetes.json` les donne, et l'anecdote dit ses briques.
   *
   * Le jour où commence un terme solaire (`saisons.json`), sauf un jour de fête, l'anecdote
   * est celle du terme : sa rubrique, son caractère à lire écrit au pinceau (露, 霜, 雪…) avec
   * son pinyin et son sens, le nom du terme et sa traduction, ce qui se passe dans la nature,
   * et en une phrase ce qu'est un terme solaire. Tout vient de `saisons.json`.
   */
  import Embleme from './Embleme.svelte';
  import Glyph from './Glyph.svelte';
  import Marque from './Marque.svelte';
  import Tao from './Tao.svelte';
  import { autourDuJour } from './anecdotes';
  import { ETIQUETTES, anecdotesOnce, contenu, fetesOnce, saisonsOnce, type Anecdote } from './content';
  import type { FeteDuJour } from './fetes';
  import { untrack } from 'svelte';
  import { anecdoteDeLaJournee, suiviDe, type AnecdoteDeLaJournee, type TermeDuJour } from './saisons';
  import { jourRencontre, type Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    oncontinuer,
    onquitter,
    onmontree = () => undefined
  }: {
    p: Progress;
    oncontinuer: () => void;
    onquitter: () => void;
    /**
     * L'anecdote de la journée est à l'écran : l'app note celle d'une fête, qui ne se
     * montre qu'une fois par occurrence (`saisons.noterAnecdoteMontree`).
     */
    onmontree?: (r: AnecdoteDeLaJournee) => void;
  } = $props();

  /** L'anecdote est celle de la journée de la session, pas celle de l'horloge. */
  const jour = $derived(p.day);
  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  /*
   * Aucune minuterie : l'anecdote se lit à son rythme, et la journée ne s'ouvre qu'au
   * tap. Les « 20 s » du brief sont un ordre de grandeur de lecture, pas un compte à
   * rebours. Retour du propriétaire : on n'avait pas le temps de lire.
   */

  let a: Anecdote | null = $state(null);
  /** La fête du jour, `null` un jour ordinaire. */
  let fete: FeteDuJour | null = $state(null);
  /** La famille du caractère de la fête : ses traits se lisent sans tout relire. */
  let pistesFete: string[] = $state([]);
  /** Le terme solaire qui commence ce jour-là, `null` les autres jours et les jours de fête. */
  let terme: TermeDuJour | null = $state(null);
  let rubriqueTerme = $state('');
  let explicationTerme = $state('');
  let pistesTerme: string[] = $state([]);
  /** La famille du caractère d'une anecdote ordinaire, que `anecdotes.json` nomme. */
  let pistesOrdinaire: string[] = $state([]);

  /*
   * L'anecdote du jour et les fêtes sont lues ensemble : un jour de fête, on ne montre
   * pas l'anecdote ordinaire le temps que la fête arrive.
   */
  $effect(() => {
    const j = jour;
    let vivant = true;
    void Promise.all([
      anecdotesOnce().catch(() => null),
      fetesOnce().catch(() => null),
      saisonsOnce().catch(() => null),
      contenu().catch(() => null)
    ]).then(
      ([liste, fetes, saisons, index]) => {
        if (!vivant) return;
        /*
         * Le suivi est lu une fois, hors de l'effet : noter l'anecdote montrée le change,
         * et l'écran ne doit pas se recalculer pour autant (le calcul donnerait la même).
         * Les caractères récents viennent du parcours : la brique du jour d'abord.
         */
        const suivi = untrack(() =>
          suiviDe(p, index ? autourDuJour(index, p.parcours, jourRencontre(p)) : undefined)
        );
        /* La même anecdote que Lire et l'en-tête du menu rouvrent (`anecdoteDeLaJournee`). */
        const r = anecdoteDeLaJournee(liste?.anecdotes ?? null, fetes, saisons, j, suivi);
        fete = r?.fete ?? null;
        pistesFete = fete ? (r?.pistes ?? []) : [];
        terme = r?.terme ?? null;
        rubriqueTerme = saisons?.rubrique ?? '';
        explicationTerme = saisons?.explication ?? '';
        pistesTerme = terme ? (r?.pistes ?? []) : [];
        pistesOrdinaire = !fete && !terme ? (r?.pistes ?? []) : [];
        a = r?.a ?? null;
        if (r) onmontree(r);
      }
    );
    return () => {
      vivant = false;
    };
  });

</script>

<main class="screen ouvrir">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>
  <div class="tao-assise"><Tao stade={taoStade} posture="anecdote" humeur={taoHumeur} size={56} /></div>

  <div class="anec">
    {#if a}
      <div class="water" aria-hidden="true"><Glyph char={a.c} size={420} pistes={fete ? pistesFete : terme ? pistesTerme : pistesOrdinaire} /></div>
    {/if}

    <div class="sceau">
      <Marque size={72} />
    </div>
    <div class="nom">Wenlu <span class="cn hz">文路</span></div>

    {#if a && fete}
      <div class="k rubrique">{fete.anecdote.rubrique}</div>
      <div class="grand fete"><Embleme fete={fete.id} c={a.c} size={160} pistes={pistesFete} /></div>
      {#if fete.anecdote.pinyin || fete.anecdote.sens}
        <!-- le caractère bonus de la fête : son pinyin et son sens, sous l'emblème -->
        <p class="bonus">
          {#if fete.anecdote.pinyin}<span class="py">{fete.anecdote.pinyin}</span>{/if}{fete.anecdote.pinyin &&
          fete.anecdote.sens
            ? ' · '
            : ''}{fete.anecdote.sens}
        </p>
      {/if}
      <h1>{a.titre}</h1>
      <p>{a.texte}</p>
    {:else if a && terme}
      <!-- le jour où commence un terme solaire : son caractère à lire, puis son nom -->
      {#if rubriqueTerme}<div class="k rubrique">{rubriqueTerme}</div>{/if}
      <div class="grand terme"><Glyph char={a.c} size={120} pistes={pistesTerme} /></div>
      {#if terme.caractere.pinyin || terme.caractere.sens}
        <p class="bonus">
          {#if terme.caractere.pinyin}<span class="py">{terme.caractere.pinyin}</span>{/if}{terme.caractere.pinyin &&
          terme.caractere.sens
            ? ' · '
            : ''}{terme.caractere.sens}
        </p>
      {/if}
      <h1><span class="hz">{terme.nomZh}</span> <span class="py-terme">{terme.pinyin}</span> · {terme.fr}</h1>
      <p>{a.texte}</p>
      {#if explicationTerme}<p class="explication">{explicationTerme}</p>{/if}
    {:else if a}
      <div class="grand"><Glyph char={a.c} size={120} pistes={pistesOrdinaire} /></div>
      <h1>{a.titre}</h1>
      <p>{a.texte}</p>
      <!-- une origine de caractère ou de mot dit si elle est attestée ou mnémotechnique -->
      {#if a.etiquette}<div class="tag">{ETIQUETTES[a.etiquette]}</div>{/if}
    {/if}
  </div>

  <div class="foot">
    <button class="btn" onclick={oncontinuer}>Continuer</button>
  </div>
</main>

<style>
  /* un jour de fête : la rubrique, puis l'emblème centré, le caractère écrit devant */
  .rubrique {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 6px 0 0;
  }
  .grand.fete {
    display: flex;
    justify-content: center;
    margin: 14px 0 2px;
  }
  .bonus {
    margin: 10px auto 4px;
    font-size: 15px;
    color: var(--ink2);
  }
  .bonus .py {
    font-style: italic;
    color: var(--ink);
  }

  /* un terme solaire commence : son pinyin plus léger dans le titre, l'explication en retrait */
  .grand.terme {
    margin-top: 10px;
  }
  .py-terme {
    font-family: var(--sans);
    font-weight: 400;
    font-style: italic;
    color: var(--ink2);
  }
  .explication {
    margin-top: 12px;
    font-size: 14px;
    color: var(--mist);
  }
</style>
