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
  import { herosOnce, meriteDe, rangTenu, titreAccorde, type BeteId, type HerosDonnees } from './lib/heros';
  import { examensOnce, migrerRangsAnnonces, type ExamensDonnees } from './lib/examens';
  import Close from './lib/Close.svelte';
  import Examen from './lib/Examen.svelte';
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
  import Route from './lib/Route.svelte';
  import Revisions from './lib/Revisions.svelte';
  import Tree from './lib/Tree.svelte';
  import Use from './lib/Use.svelte';
  import Warm from './lib/Warm.svelte';
  import { apresSplash, departApres, suiteDepart } from './lib/premiere';
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
  import type { Choix } from './lib/utiliser';
  import {
    briquesAcquises,
    contenu,
    leconsPosees,
    nomParcours,
    reglerApercu,
    toutesLesFamilles,
    type Index,
    type Noeud
  } from './lib/content';
  import { rythmeOnce, SANS_RYTHME, type TextesRythme } from './lib/rythme';
  import FeteDecor from './lib/FeteDecor.svelte';
  import { fetesOnce, saisonsOnce, type Fetes, type Saisons } from './lib/content';
  import { poserFete } from './lib/fetes';
  import { journee, noterAnecdoteMontree, type AnecdoteDeLaJournee } from './lib/saisons';
  import type { Niveau } from './lib/niveaux';
  import { noterTrouve, rencontreDe, rencontreDuJour } from './lib/trouves';
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
    noterChapitreLu,
    noterConteLu,
    noterReprise,
    noterRevision,
    noterTrophees,
    openDay,
    planifierCarte,
    setDepart,
    finDepart,
    choisirHeros,
    annoncerRang,
    setBudget,
    setDue,
    setEnAttente,
    setFix,
    setLearnView,
    setParcours,
    setRev,
    setRevue,
    setTrace,
    setUseView,
    srsParams,
    traceAchevee,
    traceVue,
    useNext,
    poserJeuUtiliser,
    repondreEclair,
    repondreEchauffer,
    repondreFixer,
    ecarterReplique,
    repliqueJuste,
    conclureDevinette,
    poserDevinette,
    noterRecette,
    jourParcours,
    preparerJournee,
    avancerExamen,
    commencerExamen,
    examenAAnnoncer,
    examenDuMenu,
    ligneDeClore,
    manquesARevoir,
    ouvrirExamenAuPalier,
    pauseDesBriques,
    repondreExamen,
    situationExamen,
    terminerExamen,
    type ContexteExamens,
    type Budget,
    type IssueDevinette,
    type LearnView,
    type Parcours,
    type Progress,
    type Revision
  } from './lib/session';
  import { accesAppareil, loadProgress, saveProgress, today } from './lib/db';
  import {
    SANS_EXAMENS,
    cheminDesExamens,
    examensOnce,
    examensPassables,
    type Bilan,
    type ExamensDonnees,
    type QuestionExamen
  } from './lib/examens';
  import { reglerHaptique } from './lib/haptique';
  import {
    avisDisponible,
    demanderAutorisation,
    demanderAvisNatif,
    instant,
    notificationsDisponibles,
    reprogrammerRappels
  } from './lib/natif';
  import { momentDeClore, momentDeConte, noterAvisDemande, peutDemanderAvis, type Moment } from './lib/avis';
  import { etatMenu } from './lib/parcours';
  import { reglerRappel, setRappel } from './lib/rappels';
  import { caracteresLus } from './lib/foret';
  import type { Famille } from './lib/content';
  import { jourDuChemin } from './lib/session';
  import {
    JEUX_DES_PORTES,
    mesure,
    ouverturesOnce,
    retourAuMenu,
    visible,
    type Calendrier,
    type Porte,
    type PorteId
  } from './lib/ouvertures';

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
    | 'route'
    | 'revisions'
    | 'reglages'
    | 'chercher'
    | 'personnage'
    | 'fangbang'
    | 'examen';

  let p: Progress = $state(emptyProgress(today()));

  /*
   * Les droits (`droits.ts`) : le web ou l'app iOS, et l'achat (StoreKit, story 6.2). La
   * journée se prépare à son ouverture (`preparerJournee`) : son rythme et, sans brique
   * nouvelle, la brique acquise la plus fragile, qu'Apprendre revoit. Les briques acquises
   * se lisent dans l'index de l'export ; les lignes du rythme dans `rythme.json`.
   */
  const acces = accesAppareil();
  let indexDonnees: Index | null = null;
  let textesRythme: TextesRythme = $state(SANS_RYTHME);

  /*
   * Les examens 科举 et les 月课 (`examens.json`, stories 8.3 et 8.4) : ceux qu'on peut passer
   * sur le chemin, et les caractères lus, au seuil de Ma forêt, qui les ouvrent. Tant qu'un
   * examen attend d'être réussi, la journée se prépare sans brique nouvelle, les caractères
   * manqués d'abord (`session.pauseDesBriques`).
   */
  let examensDonnees: ExamensDonnees = $state.raw(SANS_EXAMENS);
  /** Les familles de l'export, comme Ma forêt les compte : les portes et les examens s'y lisent. */
  let famillesLues: Famille[] | null = $state.raw(null);
  const ctxExamens: ContexteExamens = $derived({
    liste: examensPassables(examensDonnees, cheminDesExamens(p.parcours)),
    lus: famillesLues === null ? 0 : caracteresLus(famillesLues, p.cartes)
  });
  /** L'examen vu du menu : le bouton de la journée faite, la ligne sous le chemin, Tao. */
  const examenMenu = $derived(examenDuMenu(p, examensDonnees, ctxExamens));
  /** La ligne de Clore, le jour où le palier est atteint. */
  const ligneExamenClore = $derived.by(() => {
    const e = examenAAnnoncer(p, ctxExamens);
    return e === null ? '' : ligneDeClore(examensDonnees, e);
  });

  /** Prépare la journée de la session, une fois : sans l'index, elle attend. */
  function preparer(): void {
    const i = indexDonnees;
    if (i === null) return;
    const nom = nomParcours(i, p.parcours);
    const pause = pauseDesBriques(p, ctxExamens, leconsPosees(i, nom, jourParcours(p)));
    const n = preparerJournee(p, acces, briquesAcquises(i, nom, jourParcours(p)), pause);
    if (n === p) return;
    p = n;
    enregistrer();
  }

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

  /**
   * 前路, la route devant : ouverte depuis Ma forêt, ou depuis la carte du jour du menu une
   * fois la journée faite. Son seul retour ramène là d'où l'on vient.
   */
  let routeRetour: 'menu' | 'foret' = $state('menu');

  function ouvrirRoute(depuis: 'menu' | 'foret'): void {
    routeRetour = depuis;
    ecran = 'route';
  }

  function fermerRoute(): void {
    if (routeRetour === 'foret') ecran = 'foret';
    else allerAuMenu();
  }

  /** La famille ouverte dans Ma forêt, `null` quand on est sur le cercle. */
  let famille: Noeud | null = $state(null);

  /** Chercher : la saisie, gardée pour le retour depuis l'arbre, et la famille ouverte. */
  let requete = $state('');
  let trouvee: { fam: Noeud; c: string } | null = $state(null);
  /** « Lire le monde », dans Chercher : le mode choisi et le texte collé, gardés au retour de l’arbre. */
  let modeChercher: 'caractere' | 'texte' = $state('caractere');
  let texteLibre = $state('');

  /** La loupe du menu : une recherche neuve. */
  function ouvrirChercher(): void {
    requete = '';
    trouvee = null;
    modeChercher = 'caractere';
    texteLibre = '';
    ecran = 'chercher';
  }

  /*
   * Le personnage (brief §8) : ses rangs, ses bêtes, les phrases de Tao (`heros.json`).
   * Le 放榜 passe au retour au menu quand un titre est accordé (« Points ET examen »,
   * story 8.5), jamais au milieu d'un pas.
   */
  let herosDonnees: HerosDonnees | null = $state(null);
  void herosOnce()
    .then((d) => {
      herosDonnees = d;
      reporterLesRangs();
      if (ecran === 'menu') annoncerUnRang();
    })
    .catch(() => undefined);

  /** Les examens (`examens.json`) : ici, pour reporter les rangs d'une progression d'avant eux. */
  let examensDonnees: ExamensDonnees | null = null;
  void examensOnce()
    .then((d) => {
      examensDonnees = d;
      reporterLesRangs();
    })
    .catch(() => undefined);

  /**
   * Une progression d'avant les examens garde ses rangs annoncés : les examens en dessous,
   * 月课 compris, sont notés reçus à la journée de la mise à jour, une seule fois
   * (`examens.migrerRangsAnnonces`). Le suivant s'ouvre de lui-même si son palier est atteint.
   */
  function reporterLesRangs(): void {
    if (!chargee || herosDonnees === null || examensDonnees === null || p.examens.migre) return;
    const examens = migrerRangsAnnonces(p.examens, p.heros?.rang ?? 0, herosDonnees.rangs, examensDonnees.examens, p.day);
    p = { ...p, examens };
    enregistrer();
  }

  /** Les caractères lus, au seuil de stabilité de Ma forêt : le palier des nominations. */
  function lusDuPersonnage(): number {
    return famillesLues === null ? 0 : caracteresLus(famillesLues, p.cartes);
  }

  /** Le rang à fêter, celui que montre l'écran 放榜. */
  let rangPromu = $state(0);

  /** Un titre accordé depuis le dernier 放榜 : l'écran passe avant le menu. */
  function annoncerUnRang(): void {
    if (herosDonnees === null) return;
    const r = titreAccorde(p, herosDonnees.rangs, lusDuPersonnage());
    if (r === null) return;
    rangPromu = r;
    ecran = 'fangbang';
  }

  /** Le 放榜 vu : le rang est noté, on arrive au menu, où la demande de note peut venir. */
  function fangbangVu(): void {
    p = annoncerRang(p, rangPromu);
    moment = 'fangbang';
    enregistrer();
    allerAuMenu();
  }

  /*
   * La demande de note (`avis.ts`), dans l'app iOS seulement : un moment de fierté (un
   * 放榜, un premier conte lu, un palier de la série) attend le retour au menu. Jamais en
   * session, jamais dans les sept premiers jours, au plus une fois tous les cent vingt
   * jours ; la fenêtre est celle du système.
   */
  let moment: Moment | null = null;

  function demanderAvisAuMenu(): void {
    /* Un 放榜 à l'écran : le moment attend son retour au menu. */
    if (ecran !== 'menu') return;
    const m = moment;
    moment = null;
    if (m === null || !avisDisponible()) return;
    const enSession = etatMenu(p) === 'entamee' || etatMenu(p) === 'plus';
    const jour = today();
    if (!peutDemanderAvis(p, jour, enSession ? 'session' : 'menu', m)) return;
    p = noterAvisDemande(p, jour);
    enregistrer();
    demanderAvisNatif();
  }

  /** Le rang tenu, celui où un personnage choisi commence : rien ne se fête après coup. */
  function rangActuel(): number {
    return rangTenu(herosDonnees?.rangs ?? [], meriteDe(p, lusDuPersonnage()));
  }

  /** Le personnage choisi, sur son écran, pour une progression qui n'en avait pas. */
  function personnageChoisi(bete: BeteId, nom: string): void {
    p = choisirHeros(p, bete, nom, rangActuel());
    enregistrer();
  }

  /** Le jeu ouvert, `null` quand l'écran hôte montre le choix. */
  let jeu: JeuId | null = $state(null);

  /*
   * L'aventure (`ouvertures.ts`, brief §6) : les portes s'ouvrent au fil du chemin, en jours
   * du chemin ou en caractères lus, et Tao en annonce une par retour au menu, après le 放榜
   * s'il y en a un. Le calendrier vient de `ouvertures.json` ; les lus, des familles de
   * l'export, comme Ma forêt les compte.
   */
  let calendrier: Calendrier | null = $state(null);
  void ouverturesOnce()
    .then((c) => (calendrier = c))
    .catch(() => (calendrier = []));
  /** La porte que Tao annonce sur le menu, le temps de ce retour. */
  let annonce: Porte | null = $state(null);

  /** Une porte, ou ce qui n'en est pas une, est-elle visible ? */
  const vois = (id: string): boolean => visible(p.ouvertures, calendrier, id);

  /** Les jeux montrés dans Jouer : ceux dont la porte l'est. */
  const jeuxMontres = $derived(JEUX_DES_PORTES.filter((x) => vois(x.porte)).map((x) => x.jeu));

  /**
   * Le retour au menu : les portes atteintes s'ouvrent, une s'annonce. Sans calendrier encore
   * lu, rien ne bouge. Jamais au milieu d'un pas : on n'est appelé qu'au menu.
   */
  function ouvrirPortes(): void {
    annonce = null;
    const cal = calendrier;
    if (cal === null || !chargee || p.premiere) return;
    const lus = famillesLues === null ? null : caracteresLus(famillesLues, p.cartes);
    const r = retourAuMenu(p.ouvertures, cal, mesure(jourDuChemin(p), lus), p.day);
    annonce = r.annonce;
    if (JSON.stringify(r.etat) === JSON.stringify(p.ouvertures)) return;
    p = { ...p, ouvertures: r.etat };
    enregistrer();
  }

  /** Toucher l'annonce, ou la case qui vient d'apparaître : on découvre la porte. */
  function decouvrir(id: PorteId): void {
    annonce = null;
    if (id === 'reviser' || id === 'jouer' || id === 'lire' || id === 'foret') caseMenu(id);
    else if (id === 'personnage') ecran = 'personnage';
    else if (id === 'route') ouvrirRoute('menu');
    else if (id === 'trophees') ouvrirDetour('rewards', 'menu');
    else if (id === 'revisions') ouvrirDetour('revisions', 'menu');
    else if (id === 'contes') ecran = 'lire';
    else if (id === 'monde') {
      ouvrirChercher();
      modeChercher = 'texte';
    } else if (id === 'retention') ecran = 'reglages';
    else {
      jeu = null;
      ecran = 'game';
    }
  }

  /** Les trophées et le tableau des révisions : ouverts depuis Ma forêt, ou depuis l'annonce. */
  let detourRetour: 'menu' | 'foret' = $state('foret');
  function ouvrirDetour(e: 'rewards' | 'revisions', depuis: 'menu' | 'foret'): void {
    detourRetour = depuis;
    ecran = e;
  }
  function fermerDetour(): void {
    if (detourRetour === 'menu') allerAuMenu();
    else ecran = 'foret';
  }

  /** Réglages : le budget, le tracé, une progression importée. */
  function remplacer(nouvelle: Progress): void {
    /* Le mode relecture règle l'aperçu avant que le menu ne relise le contenu. */
    reglerApercu(nouvelle.relecture);
    reglerHaptique(nouvelle.haptique);
    p = nouvelle;
    majDue();
    preparer();
    enregistrer();
    reporterLesRangs();
  }

  /*
   * Contenu (export versionné) : l'appartenance des 485 caractères à leurs 238 familles
   * se réchauffe dès l'ouverture. `index.json` ne porte pas les membres des familles ;
   * sans ce réchauffage, le premier écran qui cherche la famille d'un composé la
   * reconstruirait au moment où il en a besoin. Les fichiers sont précachés (509 entrées).
   */
  void toutesLesFamilles()
    .then((l) => (famillesLues = l))
    .catch(() => undefined);

  /**
   * Au démarrage : on relit la progression et on ouvre la journée. L'index et les lignes du
   * rythme se lisent avant : la journée se prépare avant que le menu ne s'ouvre.
   */
  void Promise.all([
    loadProgress(),
    contenu().catch(() => null),
    rythmeOnce().catch(() => SANS_RYTHME),
    examensOnce().catch(() => SANS_EXAMENS),
    toutesLesFamilles().catch(() => null)
  ]).then(([stored, i, t, ex, familles]) => {
    indexDonnees = i;
    textesRythme = t;
    examensDonnees = ex;
    if (familles !== null) famillesLues = familles;
    const jour = today();
    /* La pile due est recomptée sur les cartes : c'est elle qui ouvre et ferme le rattrapage. */
    const ouvert = setDue(openDay(stored, jour), nombreDues(stored, new Date()), jour);
    reglerApercu(ouvert.relecture);
    reglerHaptique(ouvert.haptique);
    p = ouvert;
    if (ouvert !== stored) void saveProgress(ouvert);
    /* L'ouverture reprogramme les rappels des sept jours qui viennent (app iOS). */
    reprogrammerRappels(ouvert);
    chargee = true;
    reporterLesRangs();
    preparer();
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
    if (ecran === 'menu') ouvrirPortes();
  }

  function splashFini(): void {
    logoEcrit = true;
    aiguiller();
  }

  /** Sauvegarde à chaque tap ; dans l'app iOS, les rappels des sept jours suivent. */
  function enregistrer(): void {
    const s = $state.snapshot(p);
    void saveProgress(s);
    reprogrammerRappels(s);
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
    preparer();
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
    /* Un 放榜 passe d'abord ; la porte qui s'ouvre vient après lui, au menu. */
    if (ecran === 'menu') ouvrirPortes();
    /* Un 放榜 passe d'abord : la demande attend qu'on soit vraiment au menu. */
    demanderAvisAuMenu();
  }

  /* Au retour au premier plan, sur le menu seulement : un pas ouvert ne bouge pas. */
  $effect(() => {
    const auPremierPlan = (): void => {
      if (document.visibilityState === 'visible' && ecran === 'menu') basculer();
      /* Revenir au premier plan, c'est ouvrir l'app : les rappels repartent pour sept jours. */
      if (document.visibilityState === 'visible' && chargee) reprogrammerRappels($state.snapshot(p));
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
      /* Les caractères manqués à l'examen passent d'abord, s'ils sont dus (story 8.4). */
      p = setRevue(
        p,
        cartesDues(p, new Date(), cartesAOuvrir(p), manquesARevoir(p, ctxExamens)).map((c) => c.id)
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
      cartesDues(p, new Date(), CARTES_PAR_SEANCE, manquesARevoir(p, ctxExamens)).map((c) => c.id)
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
    const r = demarrer(p, p.day, examenMenu?.passer ?? false);
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
    /* L'heure du rappel ne se pose que dans l'app iOS : sur le web, elle est sautée. */
    const vue = departApres(p.premiereVue, notificationsDisponibles());
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
   * Troisième question, dans l'app iOS : l'heure du rappel. L'accord de l'iPhone se
   * demande ici, une fois l'heure choisie, jamais au lancement ; refusé, le rappel reste
   * éteint et l'heure gardée, pour Réglages.
   */
  async function departHeure(heure: string, rappeler: boolean): Promise<void> {
    const accord = rappeler ? await demanderAutorisation() : false;
    const { jour, minute } = instant();
    p = setRappel(p, reglerRappel(p.rappel, { actif: accord, heure }, jour, minute));
    departSuivant();
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
      preparer();
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
    p = noterTrouve(anecdoteFaite(p, p.day), rencontreDuJour(laJournee, p.fetesVues, p.day), p.day);
    enregistrer();
    if (anecOuverture) allerAuMenu();
    else enchainer();
  }

  /**
   * L'anecdote de la journée est à l'écran. Celle d'une fête ne se montre qu'une fois par
   * occurrence : la progression garde la journée où elle l'a été, et son caractère bonus
   * est trouvé dès qu'il se montre, même si l'on quitte l'écran sans continuer.
   */
  function anecdoteMontree(r: AnecdoteDeLaJournee): void {
    const n = noterTrouve(noterAnecdoteMontree(p, r, p.day), rencontreDe(r), p.day);
    if (n === p) return;
    p = n;
    enregistrer();
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
      p = noterTrouve(n, rencontreDuJour(laJournee, n.fetesVues, p.day), p.day);
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
   * l'écran, qui la tient de `questions.ts` et de `grade`. La séance entière compte une
   * révision pour l'humeur de Tao, pas une par carte (`repondreEchauffer`).
   */
  function echaufferRepondu(r: Revision, i: number): void {
    p = planifierCarte(p, r.c, r, new Date());
    /* La question est notée : quitter avant l'avance automatique ne la reposera pas. */
    p = repondreEchauffer(p, p.day, r, i);
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

  /** Le jeu de la journée, choisi à l'entrée du pas (`utiliser.ts`) : rangé une fois. */
  function utiliserPoser(choix: Choix | null): void {
    const n = poserJeuUtiliser(p, choix);
    if (n === p) return;
    p = n;
    enregistrer();
  }

  /**
   * Le dictionnaire éclair du pas : le sens choisi est rangé, la bonne réponse notée par
   * `grade` et le mot compté une fois ; une erreur ne note rien. Répondu déjà (reprise,
   * double tap), rien ne se note deux fois.
   */
  function utiliserEclair(reponse: string, evenements: Revision[], devine: string): void {
    const n = repondreEclair(p, p.day, reponse);
    if (n === p) return;
    p = n;
    for (const r of evenements) noterJeu(r);
    if (devine !== '') p = noterMotDevine(p, devine);
    enregistrer();
  }

  /** Le message WeChat du pas : une réplique fausse est écartée, sans rien noter. */
  function utiliserEcarter(zh: string): void {
    const n = ecarterReplique(p, zh);
    if (n === p) return;
    p = n;
    enregistrer();
  }

  /** La bonne réplique : l'échange suivant s'ouvre, ses caractères notés du premier coup. */
  function utiliserReplique(evenements: Revision[], echanges: number): void {
    const n = repliqueJuste(p, p.day, echanges);
    if (n === p) return;
    p = n;
    for (const r of evenements) noterJeu(r);
    enregistrer();
  }

  /* ---------- pas 5, Fixer ---------- */

  /** Chaque réponse replanifie la carte, comme au pas Échauffer. */
  function fixerRepondu(r: Revision, i: number): void {
    p = planifierCarte(p, r.c, r, new Date());
    /* Comme au pas Échauffer : une question notée ne se repose pas, une séance compte une révision. */
    p = repondreFixer(p, p.day, r, i);
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
    const avant = p;
    p = noterTrophees(cloreSession(p, p.day), obtenus, p.day);
    /* Le palier atteint, l'examen s'ouvre : Clore vient de le dire (story 8.4). */
    p = ouvrirExamenAuPalier(p, ctxExamens);
    moment = momentDeClore(avant, p, p.day) ?? moment;
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
    noterJeu(r);
    enregistrer();
  }

  /**
   * Range un événement de jeu et replanifie sa carte, sans sauvegarder. La carte fait
   * partie de la manche : pour l'humeur de Tao, c'est la manche qui compte (« jeu »).
   */
  function noterJeu(r: Revision): void {
    p = noterRevision(p, p.day, r);
    /* La rétention cible réglée passe à `schedule`, comme au pas Échauffer. */
    p = { ...p, cartes: planifier(p.cartes, r, new Date(), srsParams(p)) };
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
   * « J'ai lu » : la version du niveau entre dans les contes lus (le trophée se remplit),
   * et Tao note un conte lu, qu'elle lit par-dessus l'épaule.
   */
  function conteLu(conte: string, seuil: Niveau): void {
    const avant = p;
    p = noterActivite(noterConteLu(p, conte, seuil), p.day, 'conte');
    moment = momentDeConte(avant, p) ?? moment;
    enregistrer();
  }

  /**
   * Un chapitre d'un récit long lu : noté, la reprise passe au suivant. Tao note une
   * lecture de conte pour chaque chapitre sauf le dernier, que `conteLu` note avec le conte.
   * Le conte n'est lu (trophée) qu'une fois tous ses chapitres lus.
   */
  function chapitreLu(conte: string, seuil: Niveau, k: number, n: number): void {
    p = noterChapitreLu(p, conte, seuil, k, n);
    if (k < n) p = noterActivite(p, p.day, 'conte');
    enregistrer();
  }

  /** Un chapitre ouvert depuis le sommaire : on y reprendra. */
  function chapitreOuvert(conte: string, seuil: Niveau, k: number): void {
    p = noterReprise(p, conte, seuil, k);
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

  /* ---------- l'examen 科举 et le 月课 (stories 8.3 et 8.4) ---------- */

  /** Commence l'examen ouvert, ou le reprend à la même question. */
  function examenCommencer(poses: number[]): void {
    const s = situationExamen(p, ctxExamens);
    if (s.etat === 'aucun') return;
    p = commencerExamen(p, s.examen, cheminDesExamens(p.parcours), poses);
    enregistrer();
  }

  /** Une réponse touchée : notée au premier essai, un point 读 si elle est juste. */
  function examenRepondre(i: number, q: QuestionExamen, donnee: number | boolean): void {
    const n = repondreExamen(p, i, q, donnee, new Date());
    if (n === p) return;
    p = n;
    enregistrer();
  }

  /** La question suivante : « Quitter » reprendra à celle-ci. */
  function examenAvancer(i: number): void {
    p = avancerExamen(p, i);
    enregistrer();
  }

  /** Le constat : reçu, les briques reprennent ; pas encore, les manqués attendent. */
  function examenTerminer(questions: number): Bilan {
    const r = terminerExamen(p, p.day, new Date(), questions, examensDonnees.regle);
    p = r.p;
    majDue();
    enregistrer();
    return r.bilan;
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
    onheure={departHeure}
    onheros={departHeros}
    onfini={departFini}
    onquitter={quitter}
  />
{:else if ecran === 'anec' && anecRetour !== null}
  <Open {p} oncontinuer={anecdoteRefermee} onquitter={anecdoteRefermee} onmontree={anecdoteMontree} />
{:else if ecran === 'anec'}
  <Open {p} oncontinuer={ouvrirFait} onquitter={anecOuverture ? ouvrirFait : quitter} onmontree={anecdoteMontree} />
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
    textes={textesRythme}
    onsuivant={apprendreSuivant}
    onvue={apprendreVue}
    ontrace={reglerTrace}
    ontraceachevee={traceFinie}
    onquitter={quitter}
  />
{:else if ecran === 'use'}
  <Use
    {p}
    vue={p.use}
    onsuivant={utiliserSuivant}
    onquitter={quitter}
    onposer={utiliserPoser}
    oneclair={utiliserEclair}
    onecarter={utiliserEcarter}
    onreplique={utiliserReplique}
  />
{:else if ecran === 'check'}
  <Fix
    {p}
    onrepondu={fixerRepondu}
    onavancer={fixerAvancer}
    onfini={fixerFini}
    onquitter={quitter}
  />
{:else if ecran === 'close'}
  <Close {p} textes={textesRythme} examen={ligneExamenClore} onterminer={clore} onquitter={quitter} />
{:else if ecran === 'examen'}
  <Examen
    {p}
    donnees={examensDonnees}
    heros={herosDonnees}
    lus={ctxExamens.lus}
    oncommencer={examenCommencer}
    onrepondre={examenRepondre}
    onavancer={examenAvancer}
    onterminer={examenTerminer}
    onquitter={quitter}
    onretour={allerAuMenu}
  />
{:else if ecran === 'game'}
  <Game
    {p}
    {jeu}
    montres={jeuxMontres}
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
    contes={vois('contes')}
    onretour={allerAuMenu}
    onlu={conteLu}
    onchapitre={chapitreLu}
    onreprise={chapitreOuvert}
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
      onrecompenses={() => ouvrirDetour('rewards', 'foret')}
      onroute={() => ouvrirRoute('foret')}
      onrevisions={() => ouvrirDetour('revisions', 'foret')}
      {vois}
      onretour={allerAuMenu}
    />
  {/if}
{:else if ecran === 'route'}
  <Route {p} {acces} textes={textesRythme} onretour={fermerRoute} />
{:else if ecran === 'revisions'}
  <Revisions {p} onretour={fermerDetour} />
{:else if ecran === 'rewards'}
  <Rewards {p} onretour={fermerDetour} onacquis={tropheesObtenus} />
{:else if ecran === 'chercher'}
  <!-- Chercher, puis l'arbre de la famille touchée ; son retour ramène à Chercher. -->
  {#if trouvee}
    <Tree fam={trouvee.fam} choix={trouvee.c} retour="Chercher" onretour={() => (trouvee = null)} onlecon={quitter} />
  {:else}
    <Chercher {p} monde={vois('monde')} bind:q={requete} bind:mode={modeChercher} bind:texte={texteLibre} onfamille={(fam, c) => (trouvee = { fam, c })} onretour={allerAuMenu} />
  {/if}
{:else if ecran === 'personnage'}
  <Personnage {p} donnees={herosDonnees} onretour={allerAuMenu} onchoisi={personnageChoisi} />
{:else if ecran === 'fangbang' && herosDonnees && p.heros}
  <Fangbang donnees={herosDonnees} heros={p.heros} rang={rangPromu} oncontinuer={fangbangVu} />
{:else if ecran === 'reglages'}
  <Settings {p} {vois} onprogression={remplacer} onretour={allerAuMenu} />
{:else}
  <Menu {p} {acces} {vois} {annonce} examen={examenMenu} ondecouvrir={decouvrir} textes={textesRythme} fete={feteJour} {fetes} terme={laJournee.terme} {saisons} ondemarrer={boutonMenu} oncase={caseMenu} onanecdote={() => relireAnecdote('menu')} onchercher={ouvrirChercher} onreglages={() => (ecran = 'reglages')} onpersonnage={() => (ecran = 'personnage')} onroute={() => ouvrirRoute('menu')} />
{/if}
