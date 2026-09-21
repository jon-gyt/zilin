<script lang="ts">
  /** L'aiguillage : un état d'écran, la progression partagée, rien d'autre. */
  import Close from './lib/Close.svelte';
  import FirstSession from './lib/FirstSession.svelte';
  import Fix from './lib/Fix.svelte';
  import Forest from './lib/Forest.svelte';
  import Learn from './lib/Learn.svelte';
  import Open from './lib/Open.svelte';
  import Splash from './lib/Splash.svelte';
  import Settings from './lib/Settings.svelte';
  import Tabs, { type Onglet } from './lib/Tabs.svelte';
  import Today from './lib/Today.svelte';
  import Tree from './lib/Tree.svelte';
  import Use from './lib/Use.svelte';
  import { apresSplash, briques, familleDepart } from './lib/premiere';
  import type { Noeud } from './lib/content';
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
    setDepart,
    departNext,
    finDepart,
    setBudget,
    setParcours,
    setFix,
    setLearnView,
    setTrace,
    setUseView,
    traceVue,
    useNext,
    type Budget,
    type LearnView,
    type Parcours,
    type Progress,
    type Revision
  } from './lib/session';
  import { loadProgress, saveProgress, today } from './lib/db';

  /** Un écran par pas, au fur et à mesure des stories. Pas de routeur. */
  type Ecran = 'splash' | 'premiere' | 'home' | 'anec' | 'learn' | 'use' | 'check' | 'close';

  /** Les pas qui ont leur écran. Les autres se marquent faits au tap, en attendant. */
  const ECRANS = ['anec', 'learn', 'use', 'check', 'close'] as const;

  let p: Progress = $state(emptyProgress(today()));
  /** L'app s'ouvre sur le logo : ce qui vient après dépend de la progression relue. */
  let ecran: Ecran = $state('splash');

  /** L'ouverture attend deux choses : la progression relue et le logo écrit. */
  let chargee = $state(false);
  let logoEcrit = $state(false);

  /** L'onglet courant. La barre ne se montre qu'ici, jamais pendant les pas. */
  let onglet: Onglet = $state('home');
  /** La famille ouverte dans Ma forêt, `null` quand on est sur le cercle. */
  let famille: Noeud | null = $state(null);

  /** Un onglet, un écran. Revenir à Ma forêt rouvre le cercle. */
  function allerOnglet(o: Onglet): void {
    if (o === 'foret') famille = null;
    onglet = o;
  }

  /** Réglages : le budget, le tracé, une progression importée. */
  function remplacer(nouvelle: Progress): void {
    p = nouvelle;
    enregistrer();
  }

  /** Au démarrage : on relit la progression et on ouvre la journée. */
  void loadProgress().then((stored) => {
    const ouvert = openDay(stored, today());
    p = ouvert;
    if (ouvert !== stored) void saveProgress(ouvert);
    chargee = true;
    aiguiller();
  });

  /**
   * Après le logo : la première session au tout premier lancement, le chemin sinon.
   * Tant que la progression n'est pas relue, le logo reste : on ne devine pas.
   */
  function aiguiller(): void {
    if (chargee && logoEcrit && ecran === 'splash') ecran = apresSplash(p);
  }

  function splashFini(): void {
    logoEcrit = true;
    aiguiller();
  }

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

  /* ---------- la première session, avant tout le reste ---------- */

  /** Un écran de plus dans la première session. La reprise se fera à celui-ci. */
  function departSuivant(): void {
    const vue = departNext(p.premiereVue);
    if (vue) p = setDepart(p, vue);
    enregistrer();
  }

  /** Première question : le parcours. */
  function departObjectif(parcours: Parcours): void {
    p = setParcours(p, parcours);
    enregistrer();
  }

  /** Seconde question : le rythme, qui devient le budget de la session. */
  function departRythme(budget: Budget): void {
    p = setBudget(p, budget);
    enregistrer();
  }

  /**
   * La première session est finie : une carte par brique, les activités notées pour Tao,
   * le drapeau tombe, et le chemin du jour s'ouvre.
   */
  function departFini(): void {
    void familleDepart()
      .then((f) => briques(f))
      .catch(() => [])
      .then((cs) => {
        p = finDepart(p, today(), new Date(), cs);
        ecran = 'home';
        enregistrer();
      });
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

{#if ecran === 'splash'}
  <Splash onfini={splashFini} />
{:else if ecran === 'premiere'}
  <FirstSession
    {p}
    onsuivant={departSuivant}
    onobjectif={departObjectif}
    onrythme={departRythme}
    onfini={departFini}
    onquitter={quitter}
  />
{:else if ecran === 'anec'}
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
  <div class="onglets">
    {#if onglet === 'foret'}
      {#if famille}
        <Tree
          fam={famille}
          onretour={() => (famille = null)}
          onlecon={() => {
            famille = null;
            onglet = 'home';
          }}
        />
      {:else}
        <Forest {p} jour={today()} onfamille={(f) => (famille = f)} />
      {/if}
    {:else if onglet === 'reglages'}
      <Settings {p} onprogression={remplacer} />
    {:else}
      <Today {p} ontap={tap} />
    {/if}
    <Tabs {onglet} onchoisir={allerOnglet} />
  </div>
{/if}
