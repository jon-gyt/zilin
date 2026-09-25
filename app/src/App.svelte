<script lang="ts">
  /**
   * L'aiguillage : un état d'écran, la progression partagée, rien d'autre.
   *
   * Tout part du menu et tout y revient. L'ouverture : le logo, l'anecdote (le pas 1),
   * puis le menu. Les pas s'enchaînent sans repasser par le menu, jusqu'à Clore, la seule
   * fin. « Quitter » sauvegarde et ramène au menu, qui propose de reprendre au pas exact.
   * Ce qui s'ouvre après quoi se décide dans `parcours.ts`, pas ici.
   */
  import Chercher from './lib/Chercher.svelte';
  import Fangbang from './lib/Fangbang.svelte';
  import Personnage from './lib/Personnage.svelte';
  import { herosOnce, rangAAnnoncer, rangDe, total, type BeteId, type HerosDonnees } from './lib/heros';
  import Close from './lib/Close.svelte';
  import FirstSession from './lib/FirstSession.svelte';
  import Fix from './lib/Fix.svelte';
  import Forest from './lib/Forest.svelte';
  import Game from './lib/Game.svelte';
  import Learn from './lib/Learn.svelte';
  import Lire from './lib/Lire.svelte';
  import Menu, { type CaseId } from './lib/Menu.svelte';
  import Open from './lib/Open.svelte';
  import Splash from './lib/Splash.svelte';
  import Settings from './lib/Settings.svelte';
  import Rewards from './lib/Rewards.svelte';
  import Tree from './lib/Tree.svelte';
  import Use from './lib/Use.svelte';
  import Warm from './lib/Warm.svelte';
  import { apresSplash, suiteDepart } from './lib/premiere';
  import {
    anecdoteFaite,
    anecdoteRelue,
    caseReviser,
    demarrer,
    ecranSuivant,
    finRevisionLibre,
    versEchauffer,
    type Destination,
    type RetourAnecdote
  } from './lib/parcours';
  import { planifier, type JeuId } from './lib/jeux';
  import { noterMotDevine } from './lib/eclair';
  import { reglerApercu, toutesLesFamilles, type Noeud } from './lib/content';
  import FeteDecor from './lib/FeteDecor.svelte';
  import { fetesOnce, saisonsOnce, type Fetes, type Saisons } from './lib/content';
  import { poserFete } from './lib/fetes';
  import { journee } from './lib/saisons';
  import { noterTrouve, rencontreDuJour } from './lib/trouves';
  import { lettresRelues, noterLettreLue, ouvrirLettreDuJour, type Lettre } from './lib/lettres';
  import {
    CARTES_PAR_SEANCE,
    cartesAOuvrir,
    basculerJournee,
    cartesDues,
    cloreSession,
    emptyProgress,
    finApprendre,
    finEchauffer,
    finFixer,
    finUtiliser,
    learnNext,
    nombreDues,
    noterActivite,
    noterConteLu,
    noterRevision,
    noterTrophees,
    openDay,
    planifierCarte,
    setDepart,
    departNext,
    finDepart,
    choisirHeros,
    annoncerRang,
    setBudget,
    setDue,
    setEnAttente,
    setFix,
    setFixNotee,
    setLearnView,
    setParcours,
    setRev,
    setRevNotee,
    setRevue,
    setTrace,
    setUseView,
    srsParams,
    traceAchevee,
    traceVue,
    useNext,
    conclureDevinette,
    poserDevinette,
    noterRecette,
    type Budget,
    type IssueDevinette,
    type LearnView,
    type Parcours,
    type Progress,
    type Revision
  } from './lib/session';
  import { loadProgress, saveProgress, today } from './lib/db';

  /**
   * Un écran à la fois, pas de routeur. `menu` est la maison ; `rev` est le pas
   * Échauffer, `reviser` une révision en plus, hors session.
   */
  type Ecran =
    | 'splash'
    | 'premiere'
    | 'menu'
    | 'anec'
    | 'rev'
    | 'reviser'
    | 'learn'
    | 'use'
    | 'check'
    | 'close'
    | 'game'
    | 'lire'
    | 'foret'
    | 'rewards'
    | 'reglages'
    | 'chercher'
    | 'personnage'
    | 'fangbang';

  let p: Progress = $state(emptyProgress(today()));

  /*
   * Les fêtes (fetes.json) et les termes solaires (saisons.json) : la journée de la session
   * décide. `data-fete` sur <html> repeint l'app (tokens.css) ; un jour sans fête,
   * `data-saison` pose l'ambiance plus légère du terme. Le décor passe derrière tout. Rien
   * d'autre ne change ici.
   */
  let fetes: Fetes | null = $state(null);
  let saisons: Saisons | null = $state(null);
  void fetesOnce().then((f) => (fetes = f)).catch(() => undefined);
  void saisonsOnce().then((s) => (saisons = s)).catch(() => undefined);
  const laJournee = $derived(journee(fetes, saisons, p.day));
  const feteJour = $derived(laJournee.fete);
  const fete = $derived(laJournee.theme.fete);
  const saison = $derived(laJournee.theme.saison);
  $effect(() => poserFete(document.documentElement, fete, saison));
  /** L'app s'ouvre sur le logo : ce qui vient après dépend de la progression relue. */
  let ecran: Ecran = $state('splash');

  /** L'ouverture attend deux choses : la progression relue et le logo écrit. */
  let chargee = $state(false);
  let logoEcrit = $state(false);

  /** L'anecdote vue à l'ouverture ramène au menu ; ouverte en session, elle enchaîne. */
  let anecOuverture = $state(true);

  /**
   * L'anecdote rouverte depuis Lire ou l'en-tête du menu : on la relit, et « Continuer »
   * comme « Quitter » ramènent là d'où l'on vient. `null` : l'ouverture ou la session.
   */
  let anecRetour: RetourAnecdote | null = $state(null);

  /** La famille ouverte dans Ma forêt, `null` quand on est sur le cercle. */
  let famille: Noeud | null = $state(null);

  /** Chercher : la saisie, gardée pour le retour depuis l'arbre, et la famille ouverte. */
  let requete = $state('');
  let trouvee: { fam: Noeud; c: string } | null = $state(null);

  /** La loupe du menu : une recherche neuve. */
  function ouvrirChercher(): void {
    requete = '';
    trouvee = null;
    ecran = 'chercher';
  }

  /*
   * Le personnage (brief §8) : ses rangs, ses bêtes, les phrases de Tao (`heros.json`).
   * Le 放榜 passe au retour au menu quand un rang est franchi, jamais au milieu d'un pas.
   */
  let herosDonnees: HerosDonnees | null = $state(null);
  void herosOnce()
    .then((d) => {
      herosDonnees = d;
      if (ecran === 'menu') annoncerUnRang();
    })
    .catch(() => undefined);

  /** Le rang à fêter, celui que montre l'écran 放榜. */
  let rangPromu = $state(0);

  /** Un rang franchi depuis le dernier 放榜 : l'écran passe avant le menu. */
  function annoncerUnRang(): void {
    if (herosDonnees === null) return;
    const r = rangAAnnoncer(p.heros, p.arts, herosDonnees.rangs);
    if (r === null) return;
    rangPromu = r;
    ecran = 'fangbang';
  }

  /** Le 放榜 vu : le rang est noté, on arrive au menu. */
  function fangbangVu(): void {
    p = annoncerRang(p, rangPromu);
    enregistrer();
    allerAuMenu();
  }

  /** Le rang que les points donnent, celui où un personnage choisi commence. */
  function rangActuel(): number {
    return rangDe(total(p.arts), herosDonnees?.rangs ?? []);
  }

  /** Le personnage choisi, sur son écran, pour une progression qui n'en avait pas. */
  function personnageChoisi(bete: BeteId, nom: string): void {
    p = choisirHeros(p, bete, nom, rangActuel());
    enregistrer();
  }

  /** Le jeu ouvert, `null` quand l'écran hôte montre le choix. */
  let jeu: JeuId | null = $state(null);

  /** Réglages : le budget, le tracé, une progression importée. */
  function remplacer(nouvelle: Progress): void {
    /* Le mode relecture règle l'aperçu avant que le menu ne relise le contenu. */
    reglerApercu(nouvelle.relecture);
    p = nouvelle;
    majDue();
    enregistrer();
  }

  /*
   * Contenu (export versionné) : l'appartenance des 485 caractères à leurs 238 familles
   * se réchauffe dès l'ouverture. `index.json` ne porte pas les membres des familles ;
   * sans ce réchauffage, le premier écran qui cherche la famille d'un composé la
   * reconstruirait au moment où il en a besoin. Les fichiers sont précachés (509 entrées).
   */
  void toutesLesFamilles().catch(() => undefined);

  /** Au démarrage : on relit la progression et on ouvre la journée. */
  void loadProgress().then((stored) => {
    const jour = today();
    /* La pile due est recomptée sur les cartes : c'est elle qui ouvre et ferme le rattrapage. */
    const ouvert = setDue(openDay(stored, jour), nombreDues(stored, new Date()), jour);
    reglerApercu(ouvert.relecture);
    p = ouvert;
    if (ouvert !== stored) void saveProgress(ouvert);
    chargee = true;
    aiguiller();
    /* Les lettres de Que relues : celle de la semaine arrive dès qu'elles sont lues. */
    void lettresRelues()
      .then((l) => {
        lettres = l;
        lettreDuJour();
      })
      .catch(() => undefined);
  });

  /*
   * Les lettres de Que (story 4b.8) : la règle d'arrivée est dans `lettres.ts` (une par
   * semaine, le dimanche ou à la première session de la semaine). Elle est relue à
   * l'ouverture, au retour au menu (après la session aussi) et quand la journée bascule ;
   * une lettre arrivée est notée dans la progression, et la case Lire l'annonce.
   */
  let lettres: Lettre[] | null = null;

  function lettreDuJour(): void {
    if (!chargee || lettres === null) return;
    const n = ouvrirLettreDuJour(p, lettres, p.day);
    if (n === p) return;
    p = n;
    enregistrer();
  }

  /**
   * Après le logo : la première session au tout premier lancement ; sinon l'anecdote du
   * jour, une fois, puis le menu. Tant que la progression n'est pas relue, le logo reste.
   */
  function aiguiller(): void {
    if (!chargee || !logoEcrit || ecran !== 'splash') return;
    anecOuverture = true;
    anecRetour = null;
    ecran = apresSplash(p);
    if (ecran === 'menu') annoncerUnRang();
  }

  function splashFini(): void {
    logoEcrit = true;
    aiguiller();
  }

  /** Sauvegarde à chaque tap. */
  function enregistrer(): void {
    void saveProgress($state.snapshot(p));
  }

  /*
   * Le jour de référence est `p.day`, jamais l'horloge : tout ce qu'une session note
   * (pas faits, activités de Tao, graine) est rangé sur la journée où elle a commencé,
   * même quand elle se clôt après minuit. `today()` ne sert qu'à voir que la journée a
   * changé, et la bascule ne se fait qu'au menu (`basculer`).
   */

  /**
   * Bascule la journée si l'horloge a passé minuit et qu'aucune session n'est en cours
   * (`basculerJournee`). Appelé au retour au menu, au retour au premier plan et au tap
   * sur le bouton du menu ; jamais au milieu d'un pas. Avant la relecture, rien ne
   * bascule : on n'écrase pas la progression stockée par un état vide.
   */
  function basculer(): void {
    if (!chargee) return;
    const jour = today();
    const ouvert = basculerJournee(p, jour);
    if (ouvert === p) return;
    p = setDue(ouvert, nombreDues(ouvert, new Date()), jour);
    enregistrer();
    lettreDuJour();
  }

  /**
   * Retour au menu : c'est là, et seulement là, que la journée peut basculer, et qu'un
   * rang franchi passe au 放榜.
   */
  function allerAuMenu(): void {
    ecran = 'menu';
    basculer();
    lettreDuJour();
    annoncerUnRang();
  }

  /* Au retour au premier plan, sur le menu seulement : un pas ouvert ne bouge pas. */
  $effect(() => {
    const auPremierPlan = (): void => {
      if (document.visibilityState === 'visible' && ecran === 'menu') basculer();
    };
    document.addEventListener('visibilitychange', auPremierPlan);
    return () => document.removeEventListener('visibilitychange', auPremierPlan);
  });

  /**
   * Recompte la pile due sur les cartes. C'est la seule entrée du rattrapage : il
   * s'ouvre quand la pile a débordé après une absence, et se referme dès qu'elle est
   * redescendue. Appelé aux moments où les cartes changent, jamais au milieu d'une
   * question : la liste des pas ne doit pas bouger sous les doigts.
   */
  function majDue(): void {
    p = setDue(p, nombreDues(p, new Date()), p.day);
  }

  /** Ouvre l'écran d'une destination du parcours. Le pas Échauffer fige d'abord sa pile. */
  function ouvrir(d: Destination | 'libre'): void {
    if (d === 'menu') allerAuMenu();
    else if (d === 'rev') ouvrirRevision();
    else if (d === 'libre') ouvrirRevisionLibre();
    else {
      if (d === 'anec') {
        anecOuverture = false;
        anecRetour = null;
      }
      ecran = d;
    }
  }

  /**
   * La fin d'un pas : droit au pas suivant, sans repasser par le menu (`ecranSuivant`).
   * Après Clore, ou après un bloc de rattrapage, le menu.
   */
  function enchainer(depuisRattrapage: boolean = p.catchup): void {
    ouvrir(ecranSuivant(p, depuisRattrapage));
  }

  /**
   * Ouvre le pas Échauffer : la pile de la séance est figée à l'entrée, les cartes dues
   * les plus urgentes d'abord, autant que le menu vient d'en annoncer. Aucune carte due :
   * l'écran le dit, et son bouton fait le pas.
   */
  function ouvrirRevision(): void {
    if (p.revue.length === 0) {
      p = setRevue(
        p,
        cartesDues(p, new Date(), cartesAOuvrir(p)).map((c) => c.id)
      );
    }
    ecran = 'rev';
    enregistrer();
  }

  /** Une révision en plus, hors session : une séance de cartes dues, puis le menu. */
  function ouvrirRevisionLibre(): void {
    majDue();
    p = setRevue(
      finRevisionLibre(p),
      cartesDues(p, new Date(), CARTES_PAR_SEANCE).map((c) => c.id)
    );
    ecran = 'reviser';
    enregistrer();
  }

  /**
   * Le bouton du menu : la session du jour au pas exact, la session de plus une fois la
   * journée faite, la première session tant qu'elle n'est pas faite (`demarrer`).
   */
  function boutonMenu(): void {
    /* Le menu resté ouvert passé minuit : la nouvelle journée s'ouvre avant le pas. */
    basculer();
    majDue();
    const r = demarrer(p, p.day);
    p = r.p;
    enregistrer();
    ouvrir(r.ecran);
  }

  /** Une case du menu. Réviser suit `caseReviser` : avant la session, c'est Échauffer. */
  function caseMenu(id: CaseId): void {
    if (id === 'reviser') {
      const c = caseReviser(p);
      if (c.action === 'bloc') boutonMenu();
      else if (c.action === 'libre') ouvrirRevisionLibre();
      else {
        p = versEchauffer(p, p.day);
        ouvrirRevision();
      }
    } else if (id === 'jouer') {
      jeu = null;
      ecran = 'game';
    } else if (id === 'lire') {
      ecran = 'lire';
    } else {
      famille = null;
      ecran = 'foret';
    }
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

  /** Le dernier écran : le personnage, sa bête et son nom. La première session se clôt ensuite. */
  function departHeros(bete: BeteId, nom: string): void {
    p = choisirHeros(p, bete, nom, rangActuel());
    enregistrer();
  }

  /**
   * La première session est finie : une carte par brique, les activités notées pour Tao,
   * le drapeau tombe, la première graine est plantée. Le menu s'ouvre sur la journée
   * faite : la session complète commence demain, au jour du parcours qui suit ce que la
   * première session a enseigné.
   */
  function departFini(): void {
    void suiteDepart(p.parcours).then(({ appris, jour }) => {
      p = finDepart(p, p.day, new Date(), appris, jour);
      majDue();
      enregistrer();
      allerAuMenu();
    });
  }

  /* ---------- pas 1, Ouvrir ---------- */

  /**
   * L'anecdote lue ou passée : le pas Ouvrir est fait. À l'ouverture, le menu suit ;
   * ouverte depuis le menu, la session enchaîne sur le pas suivant.
   */
  function ouvrirFait(): void {
    /* L'anecdote d'une fête ou d'un terme fait trouver un caractère : Ma forêt le garde. */
    p = noterTrouve(anecdoteFaite(p, p.day), rencontreDuJour(laJournee), p.day);
    enregistrer();
    if (anecOuverture) allerAuMenu();
    else enchainer();
  }

  /** Rouvre l'anecdote du jour, depuis Lire ou l'en-tête du menu, pour la relire. */
  function relireAnecdote(depuis: RetourAnecdote): void {
    anecRetour = depuis;
    ecran = 'anec';
  }

  /**
   * L'anecdote relue, refermée : retour là d'où l'on venait. Déjà vue, rien ne se compte
   * deux fois (`anecdoteRelue`) ; pas encore vue, elle compte comme à l'ouverture.
   */
  function anecdoteRefermee(): void {
    const n = anecdoteRelue(p, p.day);
    if (n !== p) {
      p = noterTrouve(n, rencontreDuJour(laJournee), p.day);
      enregistrer();
    }
    const retour = anecRetour;
    anecRetour = null;
    if (retour === 'lire') ecran = 'lire';
    else allerAuMenu();
  }

  /* ---------- pas 2, Échauffer, et la révision en plus ---------- */

  /**
   * Chaque réponse replanifie la carte avec FSRS et alimente Tao. La notation vient de
   * l'écran, qui la tient de `questions.ts` et de `grade`.
   */
  function echaufferRepondu(r: Revision, i: number): void {
    p = planifierCarte(p, r.c, r, new Date());
    p = noterRevision(p, p.day, r);
    /* La question est notée : quitter avant l'avance automatique ne la reposera pas. */
    p = setRevNotee(p, i);
    enregistrer();
  }

  /** La question suivante de la séance : la reprise se fait à celle-ci. */
  function echaufferAvancer(i: number): void {
    p = setRev(p, i);
    enregistrer();
  }

  /**
   * Les cartes sans fiche, mises de côté par le pas Échauffer : gardées dans la
   * progression, hors de la pile due. La pile n'est recomptée qu'à la fin du pas.
   */
  function echaufferAttente(ids: string[]): void {
    p = setEnAttente(p, ids);
    enregistrer();
  }

  /**
   * La séance finie : le pas est fait, la pile se vide, et le pas suivant s'ouvre. Un
   * bloc de rattrapage ramène au menu, qui annonce le bloc suivant.
   */
  function echaufferFini(): void {
    const bloc = p.catchup;
    p = finEchauffer(p, p.day);
    /* La pile a baissé : le rattrapage se referme quand elle est redescendue. */
    majDue();
    enregistrer();
    enchainer(bloc);
  }

  /** La révision en plus finie ou quittée : la pile de la séance se vide, retour au menu. */
  function reviserFini(): void {
    p = finRevisionLibre(p);
    majDue();
    enregistrer();
    allerAuMenu();
  }

  /* ---------- pas 3, Apprendre ---------- */

  /**
   * La brique, son tracé s'il est proposé, puis le composé. Le bouton principal enchaîne
   * les vues ; après la dernière, le pas est fait, le parcours avance, et Utiliser s'ouvre.
   */
  function apprendreSuivant(brique: string, compose: string | null, jour: number): void {
    let vue = learnNext(p, brique);
    /* Un jour du parcours sans composé s'arrête après la brique : pas de vue « composé ». */
    if (vue === 'compose' && compose === null) vue = null;
    if (p.learn === 'trace') p = traceVue(p, brique);
    if (vue) {
      p = setLearnView(p, vue);
      enregistrer();
      return;
    }
    /* Le pas fait, la brique apprise entre en révision et dans le journal de Tao. */
    p = finApprendre(p, p.day, new Date(), [brique, ...(compose === null ? [] : [compose])], jour);
    majDue();
    enregistrer();
    enchainer();
  }

  /** Retour en arrière dans le pas Apprendre : la vue est reprise telle quelle au rechargement. */
  function apprendreVue(vue: LearnView): void {
    p = setLearnView(p, vue);
    enregistrer();
  }

  /** La brique tracée en entier : le pinceau des trophées la compte. */
  function traceFinie(brique: string): void {
    p = traceAchevee(p, brique);
    enregistrer();
  }

  /** Réglage « ne plus proposer le tracé », mémorisé dans la progression. */
  function reglerTrace(actif: boolean): void {
    p = setTrace(p, actif);
    enregistrer();
  }

  /* ---------- pas 4, Utiliser ---------- */

  /** Les mots et la phrase, puis les trois lignes. Après la dernière vue, Fixer s'ouvre. */
  function utiliserSuivant(): void {
    const vue = useNext(p);
    if (vue) {
      p = setUseView(p, vue);
      enregistrer();
      return;
    }
    p = finUtiliser(p, p.day);
    enregistrer();
    enchainer();
  }

  /* ---------- pas 5, Fixer ---------- */

  /** Chaque réponse replanifie la carte, comme au pas Échauffer. */
  function fixerRepondu(r: Revision, i: number): void {
    p = planifierCarte(p, r.c, r, new Date());
    p = noterRevision(p, p.day, r);
    /* Comme au pas Échauffer : une question notée ne se repose pas. */
    p = setFixNotee(p, i);
    enregistrer();
  }

  /** La question suivante de la vérification : la reprise se fait à celle-ci. */
  function fixerAvancer(i: number): void {
    p = setFix(p, i);
    enregistrer();
  }

  /** La vérification finie : le pas est fait, Clore s'ouvre. */
  function fixerFini(): void {
    p = finFixer(p, p.day);
    majDue();
    enregistrer();
    enchainer();
  }

  /* ---------- pas 6, Clore : la seule fin ---------- */

  /**
   * Le constat, la graine et la semaine sont sur l'écran Clore. La graine du jour est
   * plantée une fois par journée ; une session de plus n'en plante pas de seconde.
   */
  function clore(obtenus: string[] = []): void {
    p = noterTrophees(cloreSession(p, p.day), obtenus, p.day);
    enregistrer();
    allerAuMenu();
  }

  /** Des trophées obtenus, pas encore notés : ils le sont, datés du jour, et le restent. */
  function tropheesObtenus(ids: string[]): void {
    const n = noterTrophees(p, ids, p.day);
    if (n === p) return;
    p = n;
    enregistrer();
  }

  /* ---------- les jeux (épic 4b), par la seule case Jouer ---------- */

  /**
   * Un tour de jeu noté : l'événement de révision est rangé dans la progression,
   * comme une question, et la carte du caractère est replanifiée par `schedule`.
   */
  function jeuRepondu(r: Revision): void {
    p = noterRevision(p, p.day, r);
    /* La rétention cible réglée passe à `schedule`, comme au pas Échauffer. */
    p = { ...p, cartes: planifier(p.cartes, r, new Date(), srsParams(p)) };
    enregistrer();
  }

  /**
   * La devinette du jour : posée à l'ouverture, une seule par jour ; résolue, elle entre
   * dans la lanterne des trophées (`noterDevinette`) ; montrée, elle ne compte pas.
   */
  function devinetteJouee(id: string, issue: IssueDevinette): void {
    p =
      issue === 'posee'
        ? poserDevinette(p, p.day, id)
        : conclureDevinette(p, p.day, id, issue === 'resolue');
    enregistrer();
  }

  /** Le dictionnaire éclair : un mot deviné entre une fois dans le compteur « mots devinés ». */
  function motDevine(id: string): void {
    const n = noterMotDevine(p, id);
    if (n === p) return;
    p = n;
    enregistrer();
  }

  /** La manche finie : une activité « jeu » pour Tao, une seule par manche. */
  function jeuFini(): void {
    p = noterActivite(p, p.day, 'jeu');
    majDue();
    enregistrer();
  }

  /**
   * La cuisine de Tao : Tao a goûté. Le plat compte une activité « cuisine » ; réussi,
   * chaque ingrédient trouvé, il entre dans les plats cuisinés (le bol des trophées).
   */
  function recetteGoutee(id: string, bon: boolean): void {
    p = noterActivite(p, p.day, 'cuisine');
    if (bon) p = noterRecette(p, id);
    majDue();
    enregistrer();
  }

  /* ---------- les contes (épic 2c), par la case Lire ---------- */

  /**
   * « J'ai lu » : la version du seuil entre dans les contes lus (le trophée se remplit),
   * et Tao note un conte lu, qu'elle lit par-dessus l'épaule.
   */
  function conteLu(conte: string, seuil: number): void {
    p = noterActivite(noterConteLu(p, conte, seuil), p.day, 'conte');
    enregistrer();
  }

  /**
   * Une lettre de Que lue : notée une fois dans la progression, et Tao note une lecture,
   * qu'elle lit par-dessus l'épaule. Pas de point.
   */
  function lettreLue(n: number): void {
    p = noterActivite(noterLettreLue(p, n, p.day), p.day, 'lecture');
    enregistrer();
  }

  /** Quitter : retour au menu sans question, la progression est sauvegardée. */
  function quitter(): void {
    enregistrer();
    allerAuMenu();
  }
</script>

<FeteDecor {fete} {saison} />

{#if ecran === 'splash'}
  <Splash onfini={splashFini} />
{:else if ecran === 'premiere'}
  <FirstSession
    {p}
    onsuivant={departSuivant}
    onobjectif={departObjectif}
    onrythme={departRythme}
    onheros={departHeros}
    onfini={departFini}
    onquitter={quitter}
  />
{:else if ecran === 'anec' && anecRetour !== null}
  <Open {p} oncontinuer={anecdoteRefermee} onquitter={anecdoteRefermee} />
{:else if ecran === 'anec'}
  <Open {p} oncontinuer={ouvrirFait} onquitter={anecOuverture ? ouvrirFait : quitter} />
{:else if ecran === 'rev'}
  <Warm
    {p}
    onrepondu={echaufferRepondu}
    onavancer={echaufferAvancer}
    onfini={echaufferFini}
    onattente={echaufferAttente}
    onquitter={quitter}
  />
{:else if ecran === 'reviser'}
  <Warm
    {p}
    libre
    onrepondu={echaufferRepondu}
    onavancer={echaufferAvancer}
    onfini={reviserFini}
    onattente={echaufferAttente}
    onquitter={reviserFini}
  />
{:else if ecran === 'learn'}
  <Learn
    {p}
    onsuivant={apprendreSuivant}
    onvue={apprendreVue}
    ontrace={reglerTrace}
    ontraceachevee={traceFinie}
    onquitter={quitter}
  />
{:else if ecran === 'use'}
  <Use {p} vue={p.use} onsuivant={utiliserSuivant} onquitter={quitter} />
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
{:else if ecran === 'game'}
  <Game
    {p}
    {jeu}
    onchoisir={(id) => (jeu = id)}
    onrepondu={jeuRepondu}
    ondevinette={devinetteJouee}
    onmotdevine={motDevine}
    oncuisine={recetteGoutee}
    onfini={jeuFini}
    onretour={quitter}
  />
{:else if ecran === 'lire'}
  <Lire
    {p}
    onretour={allerAuMenu}
    onlu={conteLu}
    onanecdote={() => relireAnecdote('lire')}
    onlettre={lettreLue}
  />
{:else if ecran === 'foret'}
  <!-- Ma forêt, deux niveaux au plus : le cercle, puis une famille ou les récompenses. -->
  {#if famille}
    <Tree fam={famille} onretour={() => (famille = null)} onlecon={quitter} />
  {:else}
    <Forest
      {p}
      jour={p.day}
      onfamille={(f) => (famille = f)}
      onrecompenses={() => (ecran = 'rewards')}
      onretour={allerAuMenu}
    />
  {/if}
{:else if ecran === 'rewards'}
  <Rewards {p} onretour={() => (ecran = 'foret')} onacquis={tropheesObtenus} />
{:else if ecran === 'chercher'}
  <!-- Chercher, puis l'arbre de la famille touchée ; son retour ramène à Chercher. -->
  {#if trouvee}
    <Tree fam={trouvee.fam} choix={trouvee.c} retour="Chercher" onretour={() => (trouvee = null)} onlecon={quitter} />
  {:else}
    <Chercher {p} bind:q={requete} onfamille={(fam, c) => (trouvee = { fam, c })} onretour={allerAuMenu} />
  {/if}
{:else if ecran === 'personnage'}
  <Personnage {p} donnees={herosDonnees} onretour={allerAuMenu} onchoisi={personnageChoisi} />
{:else if ecran === 'fangbang' && herosDonnees && p.heros}
  <Fangbang donnees={herosDonnees} heros={p.heros} rang={rangPromu} oncontinuer={fangbangVu} />
{:else if ecran === 'reglages'}
  <Settings {p} onprogression={remplacer} onretour={allerAuMenu} />
{:else}
  <Menu {p} fete={feteJour} {fetes} terme={laJournee.terme} {saisons} ondemarrer={boutonMenu} oncase={caseMenu} onanecdote={() => relireAnecdote('menu')} onchercher={ouvrirChercher} onreglages={() => (ecran = 'reglages')} onpersonnage={() => (ecran = 'personnage')} />
{/if}
