<script lang="ts">
  /**
   * Pas 4, Utiliser : deux mots, une phrase, puis trois lignes à lire avec uniquement
   * l'acquis. Deux vues successives (maquette s-l3 puis s-read), un seul bouton
   * principal par vue, « Quitter » sauvegarde sans question.
   *
   * Aucun texte de contenu n'est écrit ici : les mots et la phrase viennent de la fiche
   * du caractère que le parcours pose aujourd'hui (export versionné, surcouché par la
   * démonstration) ; sans fiche relue, l'écran le dit au lieu d'emprunter les mots d'un
   * autre caractère. L'aperçu allumé (Réglages), les mots et la phrase d'une fiche à
   * relire portent la mention « à relire ». Les trois lignes à lire, elles, restent celles de la maquette
   * (`data/demo/textes/住.json`) : l'export ne porte encore aucun texte ni conte.
   * Le cinabre ne sert qu'à une chose sur cet écran : le caractère du jour dans le texte.
   */
  import ARelire from './ARelire.svelte';
  import EnTetePas from './EnTetePas.svelte';
  import Glyph from './Glyph.svelte';
  import {
    LIGNE_SANS_FICHE,
    glosable,
    glose,
    lecon,
    lignesNues,
    texteOnce,
    type FicheLue,
    type Signe,
    type Texte
  } from './content';
  import Tao from './Tao.svelte';
  import { aAudio, dire, manifesteOnce, type Manifeste } from './audio';
  import { jourLecon, type Progress, type UseView } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    vue,
    onsuivant,
    onquitter
  }: {
    /** La progression : Tao y lit son stade et son humeur, la brique du jour et ses textes. */
    p: Progress;
    vue: UseView;
    /** Enchaîne vers la vue suivante, ou termine le pas après la dernière. */
    onsuivant: () => void;
    onquitter: () => void;
  } = $props();

  let ficheDuJour = $state(null as FicheLue | null);
  let t = $state(null as Texte | null);
  /** Le manifeste audio : il dit quels textes ont une voix. Absent, l'écran se tait. */
  let son = $state(null as Manifeste | null);
  /** La glose du caractère touché. Rien tant qu'on n'a touché personne. */
  let touche: Signe | null = $state(null);

  $effect(() => {
    const n = jourLecon(p);
    const choisi = p.parcours;
    let vivant = true;
    void lecon(choisi, n)
      .then((l) => {
        if (vivant) ficheDuJour = l.composes[0] ?? l.brique;
      })
      .catch(() => {
        if (vivant) ficheDuJour = null;
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

  $effect(() => {
    let vivant = true;
    void manifesteOnce().then((m) => {
      if (vivant) son = m;
    });
    return () => {
      vivant = false;
    };
  });

  /** Le caractère du jour : le composé du parcours, la brique quand le jour n'en pose pas. */
  const compo: FicheLue | null = $derived(ficheDuJour);
  const mots = $derived(compo?.mots ?? []);
  const phrase = $derived(compo?.phrase ?? null);
  /** Le texte nu : ce qui se dirait à voix haute, quand l'audio sera embarqué. */
  const nu = $derived(t ? lignesNues(t).join('') : '');

  /* Tao lit par-dessus l'épaule. Elle accompagne la lecture, elle ne la commente pas. */
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));

  /**
   * Audio au toucher du caractère : le fichier pré-généré, servi avec l'app. Rien ne se
   * passe si ce texte n'a pas de voix — le téléphone ne synthétise jamais (brief §11).
   */
  function ecouter(texte: string): void {
    void dire(texte);
  }

  /** Ce texte a-t-il une voix ? Sinon le bouton reste là, visible et inactif. */
  function parle(texte: string): boolean {
    return aAudio(son, texte);
  }

  /** Un caractère touché : sa glose s'affiche, et il se dit à voix haute s'il en a une. */
  function toucher(s: Signe): void {
    touche = s;
    ecouter(s.c);
  }
</script>

<main class="screen">
  <EnTetePas {p} {onquitter} />

  {#if vue === 'mots' && compo}
    <div class="verif-tete">
      <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
      <p class="guide grow">Un caractère se lit dans des mots.</p>
    </div>
    <div class="card">
      {#if mots.length === 0 && !phrase}
        <!-- Les mots et la phrase viennent d'une fiche relue : sans elle, on ne feint rien.
             Le caractère, lui, se dessine depuis ses traits comme partout ailleurs. -->
        <div class="center">
          <Glyph char={compo.c} size={96} />
          <div class="py">{compo.pinyin}</div>
          <p class="origine k">{LIGNE_SANS_FICHE}</p>
        </div>
      {/if}
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
          <button
            class="btn ghost"
            disabled={!parle(phrase.hanzi)}
            aria-disabled={!parle(phrase.hanzi)}
            onclick={() => ecouter(phrase.hanzi)}>♪ Écouter</button
          >
        </div>
      {/if}
      {#if mots.length > 0 || phrase}<ARelire de={compo} bloc />{/if}
    </div>
    <div class="foot"><button class="btn" onclick={onsuivant}>Lire trois lignes</button></div>
  {:else if vue === 'texte' && t}
    <h1>Lire</h1>
    <div class="verif-tete">
      <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
      <p class="guide grow">
        Trois lignes, uniquement avec tes caractères. Le cinabre est celui d'aujourd'hui.
        Touche un caractère si tu hésites.
      </p>
    </div>
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
        <button
          class="btn ghost"
          disabled={!parle(nu)}
          aria-disabled={!parle(nu)}
          onclick={() => ecouter(nu)}>♪ Écouter</button
        >
      </div>
    </div>
    <div class="card">
      <div class="k">Traduction</div>
      <div class="trad-pleine">{t.traduction}</div>
    </div>
    <div class="foot"><button class="btn" onclick={onsuivant}>J'ai tout lu</button></div>
  {:else}
    <p class="guide">Le texte du jour n'a pas pu être lu.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au menu</button></div>
  {/if}
</main>
