<script lang="ts">
  /**
   * Pas 3, Apprendre : la brique, son tracé (optionnel), puis le composé.
   * Trois vues successives, un seul bouton principal par vue, « Quitter » sauvegarde
   * sans question. Aucun texte de contenu n'est écrit ici : origine, rôle, étiquette,
   * mots et phrase viennent du JSON versionné de `app/public/data/`.
   */
  import Glyph from './Glyph.svelte';
  import Trace from './Trace.svelte';
  import { ETIQUETTES, compose, familleOnce, fiche, type Famille, type Fiche } from './content';
  import { traceProposee, type LearnView, type Progress } from './session';

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

  const vue = $derived(p.learn);

  /**
   * Les cinq écrans de la leçon dans la maquette ; les trois derniers arrivent avec les
   * pas Utiliser, Fixer et Clore. Le cinabre marque la position sur le chemin.
   */
  const PAS_LECON = 5;

  let f = $state(null as Famille | null);

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

  const brique: Fiche | null = $derived(f ? fiche(f, f.racine.c) : null);
  const compo: Fiche | null = $derived(f ? compose(f) : null);
  const mots = $derived(compo?.mots ?? []);
  const phrase = $derived(compo?.phrase ?? null);
  /** Le tracé est-il dans l'enchaînement de cette session ? Une fois par brique, et réglable. */
  const traceOfferte = $derived(brique ? traceProposee(p, brique.c) : false);

  /**
   * Audio au toucher du caractère. Aucun fichier audio n'est encore embarqué : le bouton
   * existe et ne fait que porter l'intention, la voix pré-générée arrive avec le pipeline.
   */
  function ecouter(_texte: string): void {}

  /** L'élément ajouté, et lui seul, porte le cinabre ; les autres briques sont en ocre. */
  function couleur(x: Fiche, i: number): string {
    return x.nouveau.includes(i) ? 'var(--zhu)' : 'var(--ocre)';
  }
</script>

<main class="screen">
  {#if vue === 'brique'}
    <button class="k quit" onclick={onquitter}>✕ Quitter</button>
  {:else}
    <button class="k quit" onclick={() => onvue('brique')}>‹ La brique {f?.racine.c ?? ''}</button>
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
      <button class="say" onclick={() => ecouter(brique.c)} aria-label="écouter">
        <Glyph char={brique.c} size={150} />
      </button>
      <div class="py">{brique.pinyin}</div>
      <div class="sens">{brique.fr}</div>
      <div class="formula">
        {#each brique.parts as part, i (part + i)}
          {#if i > 0}<span class="op">+</span>{/if}
          <span class="p" class:new={brique.nouveau.includes(i)}>
            <Glyph char={part} size={40} write={false} color={couleur(brique, i)} />
          </span>
        {/each}
        <span class="op">=</span>
        <Glyph char={brique.c} size={52} write={false} />
      </div>
      <p class="origine">{brique.origine_fr}</p>
      <div class="tag">{ETIQUETTES[brique.etiquette]}</div>
      {#if !traceOfferte}
        <div class="acts">
          <button class="btn ghost" onclick={() => onvue('trace')}>Tracer {brique.c}</button>
        </div>
      {/if}
    </div>
    <div class="foot">
      <button class="btn" onclick={() => onsuivant(brique.c, compo?.c ?? null)}>J'ai vu {brique.c}, suivant</button>
    </div>
  {:else if vue === 'trace' && brique}
    <Trace char={brique.c} />
    <label class="pref">
      <input type="checkbox" checked={!p.trace} onchange={(e) => ontrace(!e.currentTarget.checked)} />
      Ne plus proposer le tracé
    </label>
    <div class="foot">
      <button class="btn ghost" onclick={() => onsuivant(brique.c, compo?.c ?? null)}>Continuer sans tracer</button>
    </div>
  {:else if vue === 'compose' && compo}
    <p class="guide">Une personne devant, et c'est un autre mot.</p>
    <div class="card center">
      <div class="formula">
        {#each compo.parts as part, i (part + i)}
          {#if i > 0}<span class="op">+</span>{/if}
          <span class="p" class:new={compo.nouveau.includes(i)}>
            <Glyph char={part} size={48} write={false} color={couleur(compo, i)} />
          </span>
        {/each}
        <span class="op">=</span>
        <button class="say" onclick={() => ecouter(compo.c)} aria-label="écouter">
          <Glyph char={compo.c} size={84} />
        </button>
      </div>
      <div class="py">{compo.pinyin}</div>
      <div class="sens">{compo.fr}</div>
      <p class="origine">{compo.origine_fr}</p>
      <div class="tag">{ETIQUETTES[compo.etiquette]}</div>
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
    <div class="foot"><button class="btn" onclick={() => onsuivant(f?.racine.c ?? '', compo?.c ?? null)}>Suivant</button></div>
  {:else}
    <p class="guide">Le contenu de la leçon n'a pas pu être lu.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au chemin</button></div>
  {/if}
</main>
