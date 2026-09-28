<script lang="ts">
  /**
   * La première session : 人, 大, 天, lire 天天, puis les deux questions et le choix du
   * personnage (brief §8). Quatre minutes, un mot lu, un seul bouton par écran.
   * « Quitter » sauvegarde. Dans l'app iOS, une troisième question, l'heure du rappel
   * quotidien (`rappels.ts`), avant le personnage ; ses textes viennent de `rappels.json`.
   *
   * Tous les textes de contenu viennent des fichiers servis avec l'app
   * (`familles/人.json`, `textes/天天.json`) : rien n'est écrit ici.
   */
  import ChoixHeros from './ChoixHeros.svelte';
  import Glyph from './Glyph.svelte';
  import { herosOnce, type BeteId, type HerosDonnees } from './heros';
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
  import { notificationsDisponibles } from './natif';
  import {
    HEURE_DEFAUT,
    HEURES_PROPOSEES,
    SANS_TEXTES,
    libelleHeure,
    minutesDe,
    rappelsOnce,
    type TextesRappels
  } from './rappels';

  let {
    p,
    onsuivant,
    onobjectif,
    onrythme,
    onheure,
    onheros,
    onfini,
    onquitter
  }: {
    p: Progress;
    onsuivant: () => void;
    onobjectif: (parcours: Parcours) => void;
    onrythme: (budget: Budget) => void;
    /** L'heure du rappel choisie, et si l'on veut être rappelé : l'app demande alors l'accord de l'iPhone. */
    onheure: (heure: string, rappeler: boolean) => Promise<void>;
    /** Le personnage choisi, au dernier écran : la première session se termine ensuite. */
    onheros: (bete: BeteId, nom: string) => void;
    onfini: () => void;
    onquitter: () => void;
  } = $props();

  /** Tailles du caractère principal, écran par écran : la maquette les donne. */
  const TAILLE: Partial<Record<EtapeDepart, number>> = { f1: 150, f2: 110, f3: 96 };
  const TAILLE_PART = 48;

  let famille: Famille | null = $state(null);
  let mot: MotDepart | null = $state(null);
  /** Le personnage : `undefined` en chargement, `null` si l'export n'en porte pas. */
  let heros: HerosDonnees | null | undefined = $state(undefined);

  /* La question du mot : la réponse tentée, et la glose du caractère touché. */
  let tentees: number[] = $state([]);
  let trouve = $state(false);
  let touche: Signe | null = $state(null);

  const vue = $derived(p.premiereVue);
  const fiche = $derived(ficheDe(famille, vue));
  /* L'heure du rappel : une question de l'app iOS seulement, où la notification existe. */
  const avecHeure = notificationsDisponibles();
  const pas = $derived(points(vue, avecHeure));

  /* La question de l'heure : ses textes, l'heure choisie, l'accord en cours de demande. */
  let textesRappels: TextesRappels = $state(SANS_TEXTES);
  let heureChoisie = $state(HEURE_DEFAUT);
  let enAttente = $state(false);
  const ETIQUETTES_HEURES = ['matin', 'midi', 'soir'] as const;

  $effect(() => {
    if (vue !== 'heure') return;
    /* Arrivé ici sans rappel possible (une progression venue de l'app) : on passe. */
    if (!avecHeure) {
      onsuivant();
      return;
    }
    if (p.rappel.heure !== null) heureChoisie = p.rappel.heure;
    let vivant = true;
    void rappelsOnce()
      .then((t) => {
        if (vivant) textesRappels = t;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  async function choisirHeure(rappeler: boolean): Promise<void> {
    if (enAttente) return;
    enAttente = true;
    try {
      await onheure(heureChoisie, rappeler);
    } finally {
      enAttente = false;
    }
  }

  /** Les aiguilles d'une petite horloge, dessinée à plat : l'heure, puis les minutes. */
  function aiguilles(h: string): { hx: number; hy: number; mx: number; my: number } {
    const m = minutesDe(h);
    const ah = (((m / 60) % 12) / 12) * 2 * Math.PI;
    const am = ((m % 60) / 60) * 2 * Math.PI;
    return { hx: 18 + 7 * Math.sin(ah), hy: 18 - 7 * Math.cos(ah), mx: 18 + 11 * Math.sin(am), my: 18 - 11 * Math.cos(am) };
  }
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
    void herosOnce()
      .then((d) => {
        if (vivant) heros = d.betes.length > 0 ? d : null;
      })
      .catch(() => {
        if (vivant) heros = null;
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
        Quatre minutes. C'est exactement la taille d'une session. On règle {avecHeure ? 'trois' : 'deux'} détails et on te
        laisse tranquille.
      </p>
      {#if mot}
        <div class="k">{mot.mot} {mot.pinyin}, {mot.traduction}.</div>
      {/if}
    </div>
    <div class="foot">
      <button class="btn" onclick={onsuivant}>{avecHeure ? 'Trois' : 'Deux'} questions, puis c'est parti</button>
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
  {:else if vue === 'rythme'}
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
      <button class="btn" onclick={onsuivant}>Suivant</button>
    </div>
  {:else if vue === 'heure' && avecHeure}
    <!-- Troisième question, dans l'app iOS : l'heure du rappel. L'accord se demande au bouton. -->
    <h1>{textesRappels.question}</h1>
    <p class="guide">{textesRappels.question_guide}</p>
    <div class="opt heures">
      {#each HEURES_PROPOSEES as h, i (h)}
        {@const a = aiguilles(h)}
        <button class:on={heureChoisie === h} aria-pressed={heureChoisie === h} onclick={() => (heureChoisie = h)}>
          <span class="vignette">
            <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="2" />
              <line x1="18" y1="18" x2={a.hx} y2={a.hy} stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              <line x1="18" y1="18" x2={a.mx} y2={a.my} stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </span>
          <div>
            <div class="t">{textesRappels[ETIQUETTES_HEURES[i]]}</div>
            <div class="d">{libelleHeure(h)}</div>
          </div>
        </button>
      {/each}
    </div>
    <div class="foot">
      <p class="k accord">{textesRappels.question_accord}</p>
      <button class="btn" disabled={enAttente || textesRappels.accepter === ''} onclick={() => choisirHeure(true)}
        >{textesRappels.accepter}</button
      >
      <!-- Un seul bouton plein : s'en passer est un lien discret, sans insister. -->
      <button class="sans" disabled={enAttente} onclick={() => choisirHeure(false)}>{textesRappels.refuser}</button>
    </div>
  {:else if heros}
    <!-- Le personnage : trois bêtes, un nom ; Tao reste celle qui aide. -->
    <ChoixHeros
      donnees={heros}
      initial={p.heros}
      surtitre="Premier lancement"
      stade={stade(p.tao.croissance)}
      onchoisi={(b, n) => {
        onheros(b, n);
        onfini();
      }}
    />
  {:else if heros === null}
    <!-- Un export sans personnage : on part quand même, il se choisira plus tard. -->
    <div class="foot">
      <button class="btn" onclick={onfini}>C'est parti</button>
    </div>
  {/if}
</main>

<style>
  /* La question de l'heure : l'accord de l'iPhone en une ligne, le second bouton sous le premier. */
  .heures :global(button) {
    min-height: 56px;
    padding: 9px 16px;
  }
  .accord {
    margin: 0 2px 10px;
  }
  .sans {
    display: block;
    width: 100%;
    min-height: 40px;
    margin-top: 4px;
    font-size: 15px;
    text-align: center;
    color: var(--ink2);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
