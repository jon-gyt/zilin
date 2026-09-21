<script lang="ts">
  /**
   * Pas 4, Utiliser : deux mots, une phrase, puis trois lignes à lire avec uniquement
   * l'acquis. Deux vues successives (maquette s-l3 puis s-read), un seul bouton
   * principal par vue, « Quitter » sauvegarde sans question.
   *
   * Aucun texte de contenu n'est écrit ici : les mots et la phrase viennent de la fiche
   * du composé, le texte et ses gloses du JSON versionné de `app/public/data/`.
   * Le cinabre ne sert qu'à une chose sur cet écran : le caractère du jour dans le texte.
   */
  import {
    compose,
    familleOnce,
    glosable,
    glose,
    lignesNues,
    texteOnce,
    type Famille,
    type Fiche,
    type Signe,
    type Texte
  } from './content';
  import type { UseView } from './session';

  let {
    vue,
    onsuivant,
    onquitter
  }: {
    vue: UseView;
    /** Enchaîne vers la vue suivante, ou termine le pas après la dernière. */
    onsuivant: () => void;
    onquitter: () => void;
  } = $props();

  /** Les cinq écrans de la leçon dans la maquette ; Utiliser est le troisième. */
  const PAS_LECON = 5;
  const RANG = 2;

  let f = $state(null as Famille | null);
  let t = $state(null as Texte | null);
  /** La glose du caractère touché. Rien tant qu'on n'a touché personne. */
  let touche: Signe | null = $state(null);

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
    void texteOnce()
      .then((x) => {
        if (vivant) t = x;
      })
      .catch(() => {
        if (vivant) t = null;
      });
    return () => {
      vivant = false;
    };
  });

  const compo: Fiche | null = $derived(f ? compose(f) : null);
  const mots = $derived(compo?.mots ?? []);
  const phrase = $derived(compo?.phrase ?? null);
  /** Le texte nu : ce qui se dirait à voix haute, quand l'audio sera embarqué. */
  const nu = $derived(t ? lignesNues(t).join('') : '');

  /**
   * Audio au toucher du caractère. Aucun fichier audio n'est encore embarqué : le bouton
   * existe et ne fait que porter l'intention, la voix pré-générée arrive avec le pipeline.
   */
  function ecouter(_texte: string): void {}

  /** Un caractère touché : sa glose s'affiche, et il se dirait à voix haute. */
  function toucher(s: Signe): void {
    touche = s;
    ecouter(s.c);
  }
</script>

<main class="screen">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>

  {#if vue === 'mots'}
    <div class="dots" aria-hidden="true">
      {#each { length: PAS_LECON } as _, i (i)}
        <i class:on={i < RANG} class:cur={i === RANG}></i>
      {/each}
    </div>
  {/if}

  {#if vue === 'mots' && compo}
    <p class="guide">Un caractère se lit dans des mots.</p>
    <div class="card">
      <div class="words">
        {#each mots as m (m.hanzi)}
          <span><span class="hz">{m.hanzi}</span>{m.fr}</span>
        {/each}
      </div>
      {#if phrase}
        <div class="k label">Une phrase avec ce que tu sais lire</div>
        <div class="hz phrase">{phrase.hanzi}</div>
        <div class="trad">{phrase.pinyin} {phrase.fr}</div>
        <div class="acts">
          <button class="btn ghost" onclick={() => ecouter(phrase.hanzi)}>♪ Écouter</button>
        </div>
      {/if}
    </div>
    <div class="foot"><button class="btn" onclick={onsuivant}>Lire trois lignes</button></div>
  {:else if vue === 'texte' && t}
    <h1>Lire</h1>
    <p class="guide">
      Trois lignes, uniquement avec tes caractères. Le cinabre est celui d'aujourd'hui.
      Touche un caractère si tu hésites.
    </p>
    <div class="card">
      <div class="read">
        {#each t.lignes as ligne, l (l)}
          <div class="ligne">
            {#each ligne as s, i (s.c + i)}
              {#if glosable(s)}
                <button class="s" class:new={s.nouveau} onclick={() => toucher(s)}>{s.c}</button>
              {:else}
                <span class="s muet">{s.c}</span>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
      <div class="gloss">
        {#if touche}
          <b class="hz">{touche.c}</b>
          {glose(touche)}
        {:else}
          Touche un caractère.
        {/if}
      </div>
      <div class="acts">
        <button class="btn ghost" onclick={() => ecouter(nu)}>♪ Écouter</button>
      </div>
    </div>
    <div class="card">
      <div class="k">Traduction</div>
      <div class="trad-pleine">{t.traduction}</div>
    </div>
    <div class="foot"><button class="btn" onclick={onsuivant}>J'ai tout lu</button></div>
  {:else}
    <p class="guide">Le texte du jour n'a pas pu être lu.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au chemin</button></div>
  {/if}
</main>
