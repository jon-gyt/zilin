<script lang="ts">
  /**
   * La première session : 人, 大, 天, lire 天天, puis les deux questions.
   * Quatre minutes, un mot lu, un seul bouton par écran. « Quitter » sauvegarde.
   *
   * Tous les textes de contenu viennent des fichiers servis avec l'app
   * (`familles/人.json`, `textes/天天.json`) : rien n'est écrit ici.
   */
  import Glyph from './Glyph.svelte';
  import Marque from './Marque.svelte';
  import Tao from './Tao.svelte';
  import {
    PARCOURS,
    RYTHMES,
    briques,
    estOperateur,
    familleDepart,
    ficheDe,
    motOnce,
    points,
    signes,
    type MotDepart
  } from './premiere';
  import { glose, type Famille, type Signe } from './content';
  import { dire } from './audio';
  import type { Budget, EtapeDepart, Parcours, Progress } from './session';
  import { stade } from './tao';

  let {
    p,
    onsuivant,
    onobjectif,
    onrythme,
    onfini,
    onquitter
  }: {
    p: Progress;
    onsuivant: () => void;
    onobjectif: (parcours: Parcours) => void;
    onrythme: (budget: Budget) => void;
    onfini: () => void;
    onquitter: () => void;
  } = $props();

  /** Tailles du caractère principal, écran par écran : la maquette les donne. */
  const TAILLE: Partial<Record<EtapeDepart, number>> = { f1: 150, f2: 110, f3: 96 };
  const TAILLE_PART = 48;

  let famille: Famille | null = $state(null);
  let mot: MotDepart | null = $state(null);

  /* La question du mot : la réponse tentée, et la glose du caractère touché. */
  let tentees: number[] = $state([]);
  let trouve = $state(false);
  let touche: Signe | null = $state(null);

  const vue = $derived(p.premiereVue);
  const fiche = $derived(ficheDe(famille, vue));
  const pas = $derived(points(vue));
  const parcoursChoisi = $derived<Parcours>(p.parcours ?? PARCOURS[0].id);

  $effect(() => {
    let vivant = true;
    void familleDepart()
      .then((f) => {
        if (vivant) famille = f;
      })
      .catch(() => {
        if (vivant) famille = null;
      });
    void motOnce()
      .then((m) => {
        if (vivant) mot = m;
      })
      .catch(() => {
        if (vivant) mot = null;
      });
    return () => {
      vivant = false;
    };
  });

  /** Le dernier jeton d'une formule est le caractère obtenu : c'est lui qui est grand. */
  function taille(i: number, total: number): number {
    return i === total - 1 ? (TAILLE[vue] ?? TAILLE_PART) : TAILLE_PART;
  }

  /**
   * Un caractère touché : sa glose s'affiche, et il se dit à voix haute s'il a une voix.
   * L'audio est un fichier pré-généré, servi avec l'app ; sans lui, rien ne se passe et
   * le caractère se touche quand même, pour la glose (brief §11).
   */
  function toucher(s: Signe): void {
    touche = s;
    void dire(s.c);
  }

  /** Une réponse : juste, la suite s'ouvre ; fausse, elle s'éteint et la correction s'affiche. */
  function repondre(i: number): void {
    if (trouve || tentees.includes(i)) return;
    tentees = [...tentees, i];
    if (mot && i === mot.bonne) trouve = true;
  }

  /** La correction sous la question : le constat, ou l'indice tant que rien n'est tenté. */
  function correction(m: MotDepart | null, essais: number[], gagne: boolean): string {
    if (m === null) return '';
    if (gagne) return m.juste;
    return essais.length > 0 ? m.faux : m.indice;
  }

  const retour = $derived(correction(mot, tentees, trouve));
</script>

<main class="screen depart">
  <button class="k quit" onclick={onquitter}>✕ Quitter</button>

  {#if vue === 'f1'}
    <div class="brand">
      <span class="mark">
        <Marque size={30} />
      </span>
      <span class="name">Wenlu</span>
      <span class="cn hz">文路</span>
    </div>
  {/if}

  <div class="dots">
    {#each { length: pas.total } as _, i (i)}
      <i class:on={i < pas.index} class:cur={i === pas.index}></i>
    {/each}
  </div>

  {#if fiche}
    <!-- f1, f2, f3 : une brique par écran, le sens et l'origine sous le caractère -->
    <p class="guide">{fiche.guide_fr ?? ''}</p>
    <div class="card center">
      {#if fiche.formule}
        <div class="formula">
          {#each fiche.formule.tokens as jeton, i (i)}
            {#if estOperateur(jeton)}
              <span class="op">{jeton}</span>
            {:else if i === fiche.formule.tokens.length - 1}
              <Glyph char={jeton} size={taille(i, fiche.formule.tokens.length)} />
            {:else}
              <span class="p" class:new={fiche.formule.nouveau.includes(i)}>
                <Glyph
                  char={jeton}
                  size={TAILLE_PART}
                  write={false}
                  color={fiche.formule.nouveau.includes(i) ? 'var(--zhu)' : 'var(--ocre)'}
                />
              </span>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="seul"><Glyph char={fiche.c} size={TAILLE[vue] ?? 150} /></div>
      {/if}
      <div class="py">{fiche.pinyin}</div>
      <div class="sens">{fiche.fr}</div>
      <p class="origine">{fiche.origine_fr}</p>
    </div>
    <div class="foot">
      <button class="btn" onclick={onsuivant}>{vue === 'f1' ? 'Vu. Suivant' : 'Suivant'}</button>
    </div>
  {:else if vue === 'f4'}
    <!-- f4 : le premier mot lu, avec sa glose au toucher -->
    <p class="guide">{mot?.question ?? ''}</p>
    <div class="card center">
      <div class="mot">
        {#each mot ? signes(mot) : [] as s, i (i)}
          <button class="s" onclick={() => toucher(s)} aria-label={s.c}>
            <Glyph char={s.c} size={64} write={false} />
          </button>
        {/each}
      </div>
      {#if touche}
        <div class="gloss"><b>{touche.c}</b> {glose(touche)}</div>
      {/if}
      <div class="choices">
        {#each mot?.choix ?? [] as texte, i (i)}
          <button
            class="txt"
            class:ok={trouve && i === mot?.bonne}
            class:ko={tentees.includes(i) && i !== mot?.bonne}
            disabled={trouve || tentees.includes(i)}
            onclick={() => repondre(i)}>{texte}</button
          >
        {/each}
      </div>
      <div class="fb">{retour}</div>
    </div>
    <div class="foot">
      <button class="btn" disabled={!trouve} onclick={onsuivant}>Suivant</button>
    </div>
  {:else if vue === 'f5'}
    <!-- f5 : le bilan des quatre minutes, et Tao qui s'en réjouit -->
    <div class="card center bilan">
      <Tao stade={stade(p.tao.croissance)} posture="chemin" humeur="joie" size={130} />
      <div class="formula">
        {#each briques(famille) as c (c)}
          <Glyph char={c} size={56} write={false} />
        {/each}
      </div>
      <h1>Trois caractères lus, un mot.</h1>
      <p class="guide">
        Quatre minutes. C'est exactement la taille d'une session. On règle deux détails et on te
        laisse tranquille.
      </p>
      {#if mot}
        <div class="k">{mot.mot} {mot.pinyin}, {mot.traduction}.</div>
      {/if}
    </div>
    <div class="foot">
      <button class="btn" onclick={onsuivant}>Deux questions, puis c'est parti</button>
    </div>
  {:else if vue === 'objectif'}
    <!-- Première question : le parcours. Même arbre, ordre différent. -->
    <h1>Pourquoi le chinois ?</h1>
    <p class="guide">On adapte l'ordre des familles à ce que tu veux lire en premier.</p>
    <div class="opt">
      {#each PARCOURS as choix (choix.id)}
        <button class:on={parcoursChoisi === choix.id} onclick={() => onobjectif(choix.id)}>
          <span class="vignette"><Glyph char={choix.c} size={36} write={false} color="var(--indigo)" /></span>
          <div>
            <div class="t">{choix.t}</div>
            <div class="d">{choix.d}</div>
          </div>
        </button>
      {/each}
    </div>
    <div class="foot">
      <button
        class="btn"
        onclick={() => {
          onobjectif(parcoursChoisi);
          onsuivant();
        }}>Suivant</button
      >
    </div>
  {:else}
    <!-- Seconde question : le rythme. Le budget tient la longueur de la session. -->
    <h1>Combien de temps par jour ?</h1>
    <p class="guide">
      Dix minutes tous les jours battent une heure le dimanche. On te proposera exactement ça.
    </p>
    <div class="opt">
      {#each RYTHMES as choix (choix.id)}
        <button class:on={p.budget === choix.id} onclick={() => onrythme(choix.id)}>
          <span class="vignette"><Glyph char={choix.c} size={36} write={false} color="var(--indigo)" /></span>
          <div>
            <div class="t">{choix.t}</div>
            <div class="d">{choix.d}</div>
          </div>
        </button>
      {/each}
    </div>
    <div class="foot">
      <button class="btn" onclick={onfini}>C'est parti</button>
    </div>
  {/if}
</main>
