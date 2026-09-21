<script lang="ts">
  /**
   * Pas 3, Apprendre : la brique du jour, son tracé (optionnel), puis son composé.
   * Trois vues successives, un seul bouton principal par vue, « Quitter » sauvegarde
   * sans question.
   *
   * La brique et les composés sont ceux du parcours de l'index (`parcours.lire` ou
   * `parcours.hsk`, selon le parcours choisi), au jour de la progression. Un jour sans
   * composé ne montre que la brique ; un jour non réconcilié est sauté, et la trace part
   * dans la console. Aucun texte de contenu n'est écrit ici : origine, rôle, étiquette,
   * mots et phrase viennent du JSON versionné de `app/public/data/`, et la ligne neutre
   * `LIGNE_SANS_FICHE` tient lieu d'origine tant que la fiche n'est pas écrite.
   */
  import Glyph from './Glyph.svelte';
  import Trace from './Trace.svelte';
  import { ETIQUETTES, LIGNE_SANS_FICHE, lecon, type FicheLue } from './content';
  import { aAudio, dire, manifesteOnce, type Manifeste } from './audio';
  import { jourParcours, traceProposee, type LearnView, type Progress } from './session';

  let {
    p,
    onsuivant,
    onvue,
    ontrace,
    onquitter
  }: {
    p: Progress;
    /**
     * Enchaîne vers la vue suivante. La brique et le composé de la session remontent :
     * à la fin du pas, ils reçoivent chacun une carte de révision.
     */
    onsuivant: (brique: string, compose: string | null) => void;
    onvue: (v: LearnView) => void;
    ontrace: (actif: boolean) => void;
    onquitter: () => void;
  } = $props();

  /**
   * Les cinq écrans de la leçon dans la maquette ; les trois derniers arrivent avec les
   * pas Utiliser, Fixer et Clore. Le cinabre marque la position sur le chemin.
   */
  const PAS_LECON = 5;

  let briqueDuJour = $state(null as FicheLue | null);
  let composeDuJour = $state(null as FicheLue | null);
  /* Des constantes dérivées : le rétrécissement de type tient jusque dans les gestionnaires. */
  const brique: FicheLue | null = $derived(briqueDuJour);
  const compo: FicheLue | null = $derived(composeDuJour);
  /** Les briques déjà posées : elles disent à `content` où chercher les familles. */
  let pistes = $state([] as string[]);
  let chargee = $state(false);
  /** Le manifeste audio : il dit quels caractères ont une voix. Absent, l'écran se tait. */
  let son = $state(null as Manifeste | null);

  $effect(() => {
    let vivant = true;
    void manifesteOnce().then((m) => {
      if (vivant) son = m;
    });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    const n = jourParcours(p);
    const choisi = p.parcours;
    let vivant = true;
    void lecon(choisi, n)
      .then((l) => {
        if (!vivant) return;
        if (l.jour && l.jour.sautes.length > 0) {
          /* La trace d'un jour sauté : sa décomposition n'est pas réconciliée avec la norme. */
          console.warn(
            `Zilin : parcours ${l.nom}, jours non réconciliés sautés : ${l.jour.sautes.join(', ')}`
          );
        }
        pistes = l.pistes;
        briqueDuJour = l.brique;
        composeDuJour = l.composes[0] ?? null;
        chargee = true;
      })
      .catch(() => {
        if (vivant) chargee = true;
      });
    return () => {
      vivant = false;
    };
  });

  /** Un jour sans composé s'arrête après la brique : la vue « composé » n'existe pas. */
  const vue = $derived(p.learn === 'compose' && compo === null ? 'brique' : p.learn);
  const mots = $derived(compo?.mots ?? []);
  const phrase = $derived(compo?.phrase ?? null);
  /** Le tracé est-il dans l'enchaînement de cette session ? Une fois par brique, et réglable. */
  const traceOfferte = $derived(brique ? traceProposee(p, brique.c) : false);

  /**
   * Audio au toucher du caractère : le fichier pré-généré, servi avec l'app. Rien ne se
   * passe si ce caractère n'a pas de voix — le téléphone ne synthétise jamais (brief §11).
   */
  function ecouter(texte: string): void {
    void dire(texte);
  }

  /** Ce caractère a-t-il une voix ? Sinon il se touche encore, mais ne dit rien. */
  function parle(texte: string): boolean {
    return aAudio(son, texte);
  }

  /** L'élément ajouté, et lui seul, porte le cinabre ; les autres briques sont en ocre. */
  function couleur(x: FicheLue, i: number): string {
    return x.nouveau.includes(i) ? 'var(--zhu)' : 'var(--ocre)';
  }

  /** Le composé à apprendre avec la brique, quand le jour en pose un. */
  const suivantDuJour = $derived(compo?.c ?? null);
</script>

<main class="screen">
  {#if vue === 'brique'}
    <button class="k quit" onclick={onquitter}>✕ Quitter</button>
  {:else}
    <button class="k quit" onclick={() => onvue('brique')}>‹ La brique {brique?.c ?? ''}</button>
  {/if}

  {#if vue !== 'trace'}
    <div class="dots" aria-hidden="true">
      {#each { length: PAS_LECON } as _, i (i)}
        <i class:on={i < (vue === 'compose' ? 1 : 0)} class:cur={i === (vue === 'compose' ? 1 : 0)}
        ></i>
      {/each}
    </div>
  {/if}

  {#if vue === 'brique' && brique}
    <p class="guide">D'abord la brique.</p>
    <div class="card center">
      <button
        class="say"
        disabled={!parle(brique.c)}
        aria-disabled={!parle(brique.c)}
        onclick={() => ecouter(brique.c)}
        aria-label="écouter"
      >
        <Glyph char={brique.c} size={150} {pistes} />
      </button>
      <div class="py">{brique.pinyin}</div>
      {#if brique.fr !== ''}<div class="sens">{brique.fr}</div>{/if}
      {#if brique.parts.length > 0}
        <div class="formula">
          {#each brique.parts as part, i (part + i)}
            {#if i > 0}<span class="op">+</span>{/if}
            <span class="p" class:new={brique.nouveau.includes(i)}>
              <Glyph char={part} size={40} write={false} color={couleur(brique, i)} {pistes} />
            </span>
          {/each}
          <span class="op">=</span>
          <Glyph char={brique.c} size={52} write={false} {pistes} />
        </div>
      {/if}
      {#if brique.origine_fr !== ''}
        <p class="origine">{brique.origine_fr}</p>
        {#if brique.etiquette}<div class="tag">{ETIQUETTES[brique.etiquette]}</div>{/if}
      {:else}
        <p class="origine k">{LIGNE_SANS_FICHE}</p>
      {/if}
      {#if !traceOfferte}
        <div class="acts">
          <button class="btn ghost" onclick={() => onvue('trace')}>Tracer {brique.c}</button>
        </div>
      {/if}
    </div>
    <div class="foot">
      <button class="btn" onclick={() => onsuivant(brique.c, suivantDuJour)}
        >J'ai vu {brique.c}, suivant</button
      >
    </div>
  {:else if vue === 'trace' && brique}
    <Trace char={brique.c} />
    <label class="pref">
      <input type="checkbox" checked={!p.trace} onchange={(e) => ontrace(!e.currentTarget.checked)} />
      Ne plus proposer le tracé
    </label>
    <div class="foot">
      <button class="btn ghost" onclick={() => onsuivant(brique.c, suivantDuJour)}
        >Continuer sans tracer</button
      >
    </div>
  {:else if vue === 'compose' && compo}
    <p class="guide">La brique est posée : voici ce qu'elle donne.</p>
    <div class="card center">
      <div class="formula">
        {#each compo.parts as part, i (part + i)}
          {#if i > 0}<span class="op">+</span>{/if}
          <span class="p" class:new={compo.nouveau.includes(i)}>
            <Glyph char={part} size={48} write={false} color={couleur(compo, i)} {pistes} />
          </span>
        {/each}
        <span class="op">=</span>
        <button
          class="say"
          disabled={!parle(compo.c)}
          aria-disabled={!parle(compo.c)}
          onclick={() => ecouter(compo.c)}
          aria-label="écouter"
        >
          <Glyph char={compo.c} size={84} {pistes} />
        </button>
      </div>
      <div class="py">{compo.pinyin}</div>
      {#if compo.fr !== ''}<div class="sens">{compo.fr}</div>{/if}
      {#if compo.origine_fr !== ''}
        <p class="origine">{compo.origine_fr}</p>
        {#if compo.etiquette}<div class="tag">{ETIQUETTES[compo.etiquette]}</div>{/if}
      {:else}
        <p class="origine k">{LIGNE_SANS_FICHE}</p>
      {/if}
    </div>
    {#if mots.length > 0 || phrase}
      <div class="card">
        {#if mots.length > 0}
          <div class="words">
            {#each mots as m (m.hanzi)}
              <span><span class="hz">{m.hanzi}</span>{m.fr}</span>
            {/each}
          </div>
        {/if}
        {#if phrase}
          <div class="k label">Une phrase avec ce que tu sais lire</div>
          <div class="hz phrase">{phrase.hanzi}</div>
          <div class="trad">{phrase.pinyin} {phrase.fr}</div>
        {/if}
      </div>
    {/if}
    <div class="foot">
      <button class="btn" onclick={() => onsuivant(brique?.c ?? '', compo.c)}>Suivant</button>
    </div>
  {:else if !chargee}
    <p class="guide">Un instant.</p>
  {:else}
    <p class="guide">Le contenu de la leçon n'a pas pu être lu.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au chemin</button></div>
  {/if}
</main>
