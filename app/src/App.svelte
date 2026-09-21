<script lang="ts">
  /** L'aiguillage : un état d'écran, la progression partagée, rien d'autre. */
  import Close from './lib/Close.svelte';
  import Fix from './lib/Fix.svelte';
  import Learn from './lib/Learn.svelte';
  import Open from './lib/Open.svelte';
  import Today from './lib/Today.svelte';
  import Use from './lib/Use.svelte';
  import {
    allDone,
    currentStep,
    emptyProgress,
    learnNext,
    markDone,
    nextIndex,
    noterActivite,
    noterRevision,
    openDay,
    resetDay,
    setFix,
    setLearnView,
    setTrace,
    setUseView,
    traceVue,
    useNext,
    type LearnView,
    type Progress,
    type Revision
  } from './lib/session';
  import { loadProgress, saveProgress, today } from './lib/db';

  /** Un écran par pas, au fur et à mesure des stories. Pas de routeur. */
  type Ecran = 'home' | 'anec' | 'learn' | 'use' | 'check' | 'close';

  /** Les pas qui ont leur écran. Les autres se marquent faits au tap, en attendant. */
  const ECRANS = ['anec', 'learn', 'use', 'check', 'close'] as const;

  let p: Progress = $state(emptyProgress(today()));
  let ecran: Ecran = $state('home');

  /** Au démarrage : on relit la progression et on ouvre la journée. */
  void loadProgress().then((stored) => {
    const ouvert = openDay(stored, today());
    p = ouvert;
    if (ouvert !== stored) void saveProgress(ouvert);
  });

  /** Sauvegarde à chaque tap. */
  function enregistrer(): void {
    void saveProgress($state.snapshot(p));
  }

  /** Marque le pas courant fait, s'il en reste un. */
  function fairePasCourant(): void {
    const n = nextIndex(p);
    if (n >= 0) p = markDone(p, n, today());
  }

  /**
   * Un tap, un seul bouton. La journée finie, on recommence ; sinon on ouvre l'écran
   * du pas courant quand il existe, et à défaut on le marque fait, le temps que les
   * écrans suivants arrivent (Échauffer, story 3.2).
   */
  function tap(): void {
    if (allDone(p)) {
      p = resetDay(p);
      enregistrer();
      return;
    }
    const go = currentStep(p)?.go;
    if (go && (ECRANS as readonly string[]).includes(go)) {
      ecran = go as Ecran;
      return;
    }
    fairePasCourant();
    enregistrer();
  }

  /** L'anecdote vue ou passée : le pas Ouvrir est fait, retour au chemin. */
  function ouvrirFait(): void {
    if (currentStep(p)?.go === 'anec') {
      fairePasCourant();
      p = noterActivite(p, today(), 'anecdote');
    }
    ecran = 'home';
    enregistrer();
  }

  /**
   * Pas 3, Apprendre : la brique, son tracé s'il est proposé, puis le composé. Le bouton
   * principal enchaîne les vues ; après la dernière, le pas est fait et on revient au chemin.
   */
  function apprendreSuivant(brique: string): void {
    const vue = learnNext(p, brique);
    if (p.learn === 'trace') p = traceVue(p, brique);
    if (vue) {
      p = setLearnView(p, vue);
    } else {
      fairePasCourant();
      p = setLearnView(p, 'brique');
      ecran = 'home';
    }
    enregistrer();
  }

  /** Retour en arrière dans le pas Apprendre : la vue est reprise telle quelle au rechargement. */
  function apprendreVue(vue: LearnView): void {
    p = setLearnView(p, vue);
    enregistrer();
  }

  /** Réglage « ne plus proposer le tracé », mémorisé dans la progression. */
  function reglerTrace(actif: boolean): void {
    p = setTrace(p, actif);
    enregistrer();
  }

  /**
   * Pas 4, Utiliser : les mots et la phrase, puis les trois lignes à lire. Après la
   * dernière vue, le texte compte comme une lecture pour Tao et le pas est fait.
   */
  function utiliserSuivant(): void {
    const vue = useNext(p);
    if (vue) {
      p = setUseView(p, vue);
    } else {
      fairePasCourant();
      p = noterActivite(p, today(), 'lecture');
      p = setUseView(p, 'mots');
      ecran = 'home';
    }
    enregistrer();
  }

  /** Pas 5, Fixer : chaque réponse notée est rangée dans la progression, tap par tap. */
  function fixerRepondu(r: Revision): void {
    p = noterRevision(p, today(), r);
    enregistrer();
  }

  /** La question suivante de la vérification : la reprise se fait à celle-ci. */
  function fixerAvancer(i: number): void {
    p = setFix(p, i);
    enregistrer();
  }

  /** La vérification finie : le pas est fait, retour au chemin. */
  function fixerFini(): void {
    fairePasCourant();
    p = setFix(p, 0);
    ecran = 'home';
    enregistrer();
  }

  /** Pas 6, Clore : la journée est faite, retour au chemin qui le constate. */
  function clore(): void {
    fairePasCourant();
    ecran = 'home';
    enregistrer();
  }

  /** Quitter : retour au chemin sans question, la progression est sauvegardée. */
  function quitter(): void {
    ecran = 'home';
    enregistrer();
  }
</script>

{#if ecran === 'anec'}
  <Open jour={today()} oncontinuer={ouvrirFait} onquitter={quitter} />
{:else if ecran === 'learn'}
  <Learn
    {p}
    onsuivant={apprendreSuivant}
    onvue={apprendreVue}
    ontrace={reglerTrace}
    onquitter={quitter}
  />
{:else if ecran === 'use'}
  <Use vue={p.use} onsuivant={utiliserSuivant} onquitter={quitter} />
{:else if ecran === 'check'}
  <Fix
    {p}
    onrepondu={fixerRepondu}
    onavancer={fixerAvancer}
    onfini={fixerFini}
    onquitter={quitter}
  />
{:else if ecran === 'close'}
  <Close {p} onterminer={clore} onquitter={quitter} />
{:else}
  <Today {p} ontap={tap} />
{/if}
