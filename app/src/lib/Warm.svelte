<script lang="ts">
  /**
   * Pas 2, Échauffer : les cartes dues du jour, en questions (maquette `s-rev`).
   *
   * La pile est figée à l'ouverture du pas et rangée dans la progression : la reprise
   * tombe sur la question exacte. Les huit types viennent de `questions.ts`, le corpus de
   * `revision.ts`, la planification de `srs.ts`. Tao est là en posture révision, sans
   * commentaire : on apprend, elle ne parle pas. Elle mange (`TaoMange`) : une bouchée par
   * carte juste, une grimace sur une erreur, un bond après trois justes d'affilée.
   *
   * « Dis-le » (story 9.1, `tons/dire.ts`) : au plus une question de la séance devient une
   * question où l'on prononce le caractère, quand le réglage est allumé, le micro permis et
   * le modèle chargé. Tao écoute alors, la tête penchée. Un micro qui se révèle refusé ou
   * absent rend la question ordinaire de la carte, à la même place : jamais d'écran muet.
   */
  import { untrack } from 'svelte';
  import Ask from './Ask.svelte';
  import Dire from './Dire.svelte';
  import EnTetePas from './EnTetePas.svelte';
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import {
    pairesExport,
    toutesLesFiches,
    voisinsOnce,
    type FicheLue,
    type Voisins
  } from './content';
  import { horsSerie, lirePaires, type Paires, type Question } from './questions';
  import {
    cartesEnAttente,
    corpusRevision,
    graineDuJour,
    ligneEnAttente,
    questionsRevision,
    resume,
    sures
  } from './revision';
  import { echeance, repriseRev, type Progress, type Revision } from './session';
  import { ecransOnce, SANS_ECRANS, type TextesDire, type TextesDireMots } from './ecrans';
  import { choisirDire, cibleDire, motsPossibles } from './tons/dire';
  import { etatMicro, microPossible, type EtatMicro } from './tons/micro';
  import { modeleMotsOnce, modeleOnce } from './tons/modele';
  import type { Modele } from './tons/classifieur';
  import type { ModeleMots } from './tons/profil';
  import { manifesteOnce, voixPretes } from './audio';
  import { humeur, stade } from './tao';
  import { TaoMange } from './reactions.svelte';

  let {
    p,
    onrepondu,
    onavancer,
    onfini,
    onattente,
    onquitter,
    onvoix,
    onmicrorefuse,
    libre = false
  }: {
    p: Progress;
    /**
     * Une révision en plus, ouverte depuis la case Réviser une fois la session faite :
     * ce n'est pas un pas, l'écran n'a ni la barre de la session ni de suite, il ramène
     * au menu.
     */
    libre?: boolean;
    /**
     * La réponse notée, dès qu'une question est jugée : la carte est replanifiée et le
     * rang de la question est marqué répondu, pour qu'elle ne se repose pas.
     */
    onrepondu: (r: Revision, i: number) => void;
    /** La question suivante : la reprise se fait à celle-ci. */
    onavancer: (i: number) => void;
    onfini: () => void;
    /**
     * Les cartes à garder de côté, réévaluées sur le contenu : celles qu'aucune fiche ne
     * permet de poser. Appelé seulement quand la liste change.
     */
    onattente: (ids: string[]) => void;
    onquitter: () => void;
    /** « Dis-le » : la moyenne d'une syllabe analysée, la voix s'apprend. */
    onvoix?: (hz: number) => void;
    /** « Dis-le » : le micro a été refusé, le réglage s'éteint (Réglages le rallume). */
    onmicrorefuse?: () => void;
  } = $props();

  /**
   * Les cartes telles qu'elles étaient à l'ouverture de la séance : les questions d'une
   * même séance sont décidées une fois pour toutes, même si l'acquis grandit en route.
   */
  const cartesDeLaSeance = untrack(() => $state.snapshot(p.cartes));

  /**
   * La question par laquelle la séance reprend, lue une seule fois à l'ouverture : une
   * question déjà notée est passée. Lue à chaque changement, la réponse qu'on vient de
   * donner chasserait sa propre correction avant qu'elle soit lue.
   */
  const debut = untrack(() => repriseRev(p));

  /**
   * Le corpus vient de l'export versionné : toutes les fiches de `data/0.1.0/`, déjà
   * surcouchées par les textes de démonstration là où le pipeline n'a rien relu. Les
   * voisins de forme de la maquette restent en appoint pour les leurres, et les paires
   * à ne pas confondre sont celles de l'export.
   */
  let f = $state([] as FicheLue[]);
  let v = $state(null as Voisins | null);
  let paires = $state([] as Paires);
  let chargee = $state(false);

  $effect(() => {
    let vivant = true;
    void toutesLesFiches()
      .then((x) => {
        if (vivant) f = x;
      })
      .catch(() => {
        if (vivant) f = [];
      })
      .finally(() => {
        if (vivant) chargee = true;
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    let vivant = true;
    void voisinsOnce()
      .then((x) => {
        if (vivant) v = x;
      })
      .catch(() => {
        if (vivant) v = null;
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    let vivant = true;
    void pairesExport()
      .then((x) => {
        if (vivant) paires = lirePaires(x);
      })
      .catch(() => {
        if (vivant) paires = [];
      });
    return () => {
      vivant = false;
    };
  });

  /**
   * La voix mandarin de l'appareil, une fois ses voix annoncées : sans elle, la question à
   * l'oreille ne se pose pas. Attendue avant de tirer la série, pour qu'elle ne change pas
   * en route.
   */
  let voix = $state(null as boolean | null);

  $effect(() => {
    let vivant = true;
    void voixPretes()
      .then((x) => {
        if (vivant) voix = x;
      })
      .catch(() => {
        if (vivant) voix = false;
      });
    return () => {
      vivant = false;
    };
  });

  /**
   * Les fichiers du manifeste audio servi avec l'app : un caractère qui y figure se pose à
   * l'oreille même sans voix de l'appareil. Attendus avant de tirer la série, comme la voix.
   * Un manifeste absent ou illisible est vide (`manifesteOnce` ne rejette pas).
   */
  let manifeste = $state(null as Readonly<Record<string, string>> | null);

  $effect(() => {
    let vivant = true;
    void manifesteOnce()
      .then((m) => {
        if (vivant) manifeste = m.chemins;
      })
      .catch(() => {
        if (vivant) manifeste = {};
      });
    return () => {
      vivant = false;
    };
  });

  /*
   * « Dis-le » : le modèle des tons, l'état du micro et les textes, attendus avant de tirer la
   * série, comme la voix : la question choisie ne change pas en route.
   */
  let modele = $state.raw<Modele | null | undefined>(undefined);
  /** Le modèle des mots (`tons-mots.json`) : sans lui, « Dis-le » ne demande que des caractères. */
  let modeleMots = $state.raw<ModeleMots | null | undefined>(undefined);
  let micro = $state<EtatMicro | null>(null);
  let textesDire = $state<TextesDire | null>(null);
  let textesMots = $state<TextesDireMots>(SANS_ECRANS.direMots);

  $effect(() => {
    let vivant = true;
    void modeleOnce().then((m) => {
      if (vivant) modele = m;
    });
    void modeleMotsOnce().then((m) => {
      if (vivant) modeleMots = m;
    });
    void etatMicro()
      .then((e) => {
        if (vivant) micro = e;
      })
      .catch(() => {
        if (vivant) micro = 'absent';
      });
    void ecransOnce()
      .then((e) => {
        if (vivant) {
          textesDire = e.dire;
          textesMots = e.direMots;
        }
      })
      .catch(() => {
        if (vivant) textesDire = SANS_ECRANS.dire;
      });
    return () => {
      vivant = false;
    };
  });

  /** Le micro s'est révélé refusé ou absent : la carte reprend sa question ordinaire. */
  let repli = $state(false);

  const pret = $derived(
    chargee &&
      v !== null &&
      voix !== null &&
      manifeste !== null &&
      modele !== undefined &&
      modeleMots !== undefined &&
      micro !== null &&
      textesDire !== null
  );

  const corpus = $derived(
    corpusRevision({
      fiches: f,
      voisins: v,
      cartes: cartesDeLaSeance,
      paires,
      trace: p.trace,
      voix: voix === true,
      manifeste: manifeste ?? {}
    })
  );

  /** Une question par carte de la pile, dans l'ordre. La graine du jour fait le reste. */
  const liste: Question[] = $derived(pret ? questionsRevision(p.revue, corpus, p.day) : []);

  /*
   * Une carte de la pile sans fiche est passée par la série : on la nomme dans le résumé,
   * et elle est mise de côté pour ne pas rester due en silence. On ne juge que sur un
   * export effectivement lu : un chargement raté ne met rien de côté.
   */
  const exportLu = $derived(pret && f.length > 0);
  const passees = $derived(exportLu ? horsSerie(p.revue, corpus) : []);

  $effect(() => {
    if (!exportLu) return;
    const attente = cartesEnAttente(p.revue, p.enAttente, corpus);
    const meme =
      attente.length === p.enAttente.length && attente.every((c) => p.enAttente.includes(c));
    if (!meme) onattente(attente);
  });
  /**
   * La question de la séance qui devient « Dis-le », lue une fois la série tirée : l'acquis de
   * l'ouverture, la graine du jour. Le réglage est lu à l'ouverture (`untrack`) : l'éteindre
   * sur un refus ne déplace rien de la séance, le repli s'en charge.
   */
  const direTons = untrack(() => p.direTons);
  const iDire = $derived(
    pret && micro && textesDire
      ? choisirDire(liste, corpus, graineDuJour('rev', p.day), {
          reglage: direTons,
          micro: microPossible(micro),
          modele: modele !== null && modele !== undefined && textesDire.label !== ''
        })
      : null
  );

  /** L'index de la question en cours ; au-delà de la dernière, c'est le résumé. */
  const i = $derived(Math.min(Math.max(p.rev, debut), liste.length));
  const q: Question | null = $derived(liste[i] ?? null);

  /** « Dis-le » est la question en cours : sa cible, ou `null`. */
  const cible = $derived(
    i === iDire && !repli && q
      ? cibleDire(q.c, corpus, graineDuJour('rev', p.day), motsPossibles(modeleMots, textesMots))
      : null
  );

  /**
   * Le résumé lit les cartes : la note et l'échéance sont celles que FSRS a écrites. « Dis-le »
   * y garde son nom ; passé sans ton reconnu, il n'a rien noté aujourd'hui : il le dit.
   */
  const lignes = $derived(
    resume(liste, p.cartes, new Date()).map((l, k) =>
      k !== iDire || repli || !textesDire
        ? l
        : p.revisions.some((r) => r.c === l.c)
          ? { ...l, label: textesDire.label }
          : { ...l, label: textesDire.label, sure: false, verdict: textesDire.resume, quand: '' }
    )
  );
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));
  const avance = $derived(liste.length === 0 ? 100 : Math.round((i / liste.length) * 100));

  /** Ce que Tao fait de chaque réponse : le geste, le temps de le voir. */
  const tao = new TaoMange();
  $effect(() => () => tao.arreter());

  /**
   * Le bouton de fin : le pas suivant s'enchaîne, sans repasser par le menu. Une révision
   * en plus et un bloc de rattrapage, eux, ramènent au menu, qui annonce la suite.
   */
  const fin = $derived(libre || p.catchup ? 'Retour au menu' : 'Continuer');
</script>

<main class="screen">
  {#if libre}
    <button class="k quit" onclick={onquitter}>‹ Retour</button>
  {:else}
    <EnTetePas {p} {onquitter} />
  {/if}

  <div class="rev-tete">
    <div class="grow">
      <h1>Réviser</h1>
      <div class="k">
        {#if q}{i + 1} / {liste.length} · {cible && textesDire ? textesDire.label : q.label}{:else if p.revue.length > 0}terminé{/if}
      </div>
    </div>
    <!-- Chaque verdict rejoue le geste : la clé change, le dessin repart. -->
    {#if cible}
      <!-- « Dis-le » : elle écoute, la tête penchée. -->
      <Tao stade={taoStade} posture="jeu" penchee humeur={taoHumeur} size={64} />
    {:else}
      {#key tao.coup}
        <Tao stade={taoStade} posture="revision" humeur={taoHumeur} size={64} reaction={tao.reaction} />
      {/key}
    {/if}
  </div>

  {#if p.revue.length > 0}
    <div class="prog" aria-hidden="true"><i style="width:{avance}%"></i></div>
  {/if}

  {#if p.revue.length === 0}
    <p class="guide">Aucune carte n'est due aujourd'hui.</p>
    <div class="foot"><button class="btn" onclick={onfini}>{fin}</button></div>
  {:else if !pret}
    <p class="guide">Un instant.</p>
  {:else if q && cible && modele && micro && textesDire}
    <Dire
      {cible}
      cle={i}
      textes={textesDire}
      {textesMots}
      {modele}
      {modeleMots}
      voix={p.voix}
      {micro}
      echeanceDe={(c) => echeance(p, c)}
      onnote={(r) => {
        onrepondu(r, i);
        tao.verdict(true);
      }}
      onvoix={(hz) => onvoix?.(hz)}
      onmicro={(e) => {
        repli = true;
        if (e === 'refuse') onmicrorefuse?.();
      }}
      onsuivant={() => onavancer(i + 1)}
      dernier={i + 1 >= liste.length}
    />
  {:else if q}
    <Ask
      {q}
      cle={i}
      {corpus}
      echeanceDe={(c) => echeance(p, c)}
      onnote={(r) => onrepondu(r, i)}
      onsuivant={() => onavancer(i + 1)}
      onverdict={(juste) => tao.verdict(juste)}
      dernier={i + 1 >= liste.length}
    />
  {:else if liste.length > 0}
    <div class="q">
      <h1 class="bilan">{sures(lignes)} sur {liste.length} du premier coup.</h1>
      <p class="guide">Ce qui a hésité revient plus tôt.</p>
      <div class="res">
        {#each lignes as l, k (l.c + k)}
          <div>
            <Glyph char={l.c} size={30} write={false} />
            <span class="grow">{l.label}</span>
            <span class={l.sure ? 'ok' : 'ko'}>
              {l.verdict}{l.quand === '' ? '' : ` · ${l.quand}`}
            </span>
          </div>
        {/each}
      </div>
      {#if passees.length > 0}<p class="k attente">{ligneEnAttente(passees)}</p>{/if}
    </div>
    <div class="foot"><button class="btn" onclick={onfini}>{fin}</button></div>
  {:else if passees.length > 0}
    <p class="guide">{ligneEnAttente(passees)}</p>
    <div class="foot"><button class="btn" onclick={onfini}>{fin}</button></div>
  {:else}
    <p class="guide">Les questions n'ont pas pu être préparées.</p>
    <div class="foot"><button class="btn" onclick={onfini}>{fin}</button></div>
  {/if}
</main>
