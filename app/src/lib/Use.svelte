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
   *
   * Certains jours, un jeu suit le texte (brief §9, règle dans `utiliser.ts`) : le
   * dictionnaire éclair, un mot jamais appris dont les deux caractères sont acquis, un
   * tour ; ou le message WeChat, un dialogue court que l'acquis réel ouvre, dès la 2e
   * semaine. Le choix est fait à l'entrée du pas, rangé dans la progression, et la reprise
   * retombe sur le même mot ou le même échange. Une bonne réponse est notée par `grade`,
   * une erreur ne note rien ; aucun chronomètre, aucun point. Tao joue la tête penchée à
   * l'éclair, lit par-dessus l'épaule au message.
   */
  import { tick, untrack } from 'svelte';
  import EclairTour from './EclairTour.svelte';
  import FilWechat from './FilWechat.svelte';
  import RepliquesWechat from './RepliquesWechat.svelte';
  import { TAO_ECLAIR, ligneMotsDevines, tourDuMot } from './eclair';
  import {
    corpusVide,
    evenementsANoter,
    postureDuJeu,
    repondre,
    type CorpusJeux,
    type Manche
  } from './jeux';
  import { chargerCorpus, choisirJeu, graineUtiliser, offreDuCorpus, type Choix } from './utiliser';
  import {
    LIGNE_ERREUR,
    choisirReplique,
    filDuDialogue,
    mancheWechat,
    replique,
    toursWechat,
    type Bulle
  } from './wechat';
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
  import {
    jeuDuJour,
    jourLecon,
    rangDuJour,
    type Progress,
    type Revision,
    type UseView
  } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    vue,
    onsuivant,
    onquitter,
    onposer = () => undefined,
    oneclair = () => undefined,
    onecarter = () => undefined,
    onreplique = () => undefined
  }: {
    /** La progression : Tao y lit son stade et son humeur, la brique du jour et ses textes. */
    p: Progress;
    vue: UseView;
    /** Enchaîne vers la vue suivante, ou termine le pas après la dernière. */
    onsuivant: () => void;
    onquitter: () => void;
    /** Le jeu de la journée, choisi à l'entrée du pas : un mot, un dialogue, ou aucun. */
    onposer?: (choix: Choix | null) => void;
    /**
     * Le sens choisi à l'éclair, les événements à noter (la bonne réponse seule) et le mot
     * deviné pour le compteur, vide sur une erreur.
     */
    oneclair?: (reponse: string, evenements: Revision[], devine: string) => void;
    /** Une réplique fausse, écartée : rien n'est noté. */
    onecarter?: (zh: string) => void;
    /** La bonne réplique : ses caractères notés (du premier coup), et la longueur du dialogue. */
    onreplique?: (evenements: Revision[], echanges: number) => void;
  } = $props();

  /* ---------- le jeu de la journée ---------- */

  /** Le corpus des deux jeux, lu une fois à l'ouverture du pas. `null` tant qu'il se lit. */
  let corpus = $state<CorpusJeux | null>(null);
  $effect(() => {
    let vivant = true;
    /* Les cartes à l'ouverture du pas suffisent : le choix ne se refait pas en cours de pas. */
    void chargerCorpus(untrack(() => p))
      .catch(() => corpusVide())
      .then((c) => {
        if (vivant) corpus = c;
      });
    return () => {
      vivant = false;
    };
  });

  /* Le choix se fait une fois par journée, dès que le contenu est lu (`utiliser.ts`). */
  $effect(() => {
    if (corpus === null || jeuDuJour(p) !== null) return;
    onposer(choisirJeu(rangDuJour(p), p.budget, offreDuCorpus(corpus, p.messagesLus), p.day));
  });

  const jeuJ = $derived(jeuDuJour(p));
  const graine = $derived(graineUtiliser(p.day));
  /** Le temps de lecture du tour : `grade` le lit, aucun point n'en dépend. */
  let depart = Date.now();

  /* l'éclair : un mot, un tour, reposé tel quel à la reprise */
  const motE = $derived(
    jeuJ?.jeu === 'eclair' ? (corpus?.eclair?.mots.find((m) => m.id === jeuJ.id) ?? null) : null
  );
  const mancheE = $derived.by((): Manche | null => {
    if (motE === null || !corpus?.eclair) return null;
    const t = tourDuMot(motE, corpus.eclair.mots, graine);
    return { jeu: 'eclair', graine, tours: [t], i: 0, evenements: [], trouves: 0 };
  });
  const resultatE = $derived(
    mancheE !== null && jeuJ?.reponse
      ? repondre(mancheE, [jeuJ.reponse], { correct: true, tries: 0, seconds: 0 })
      : null
  );

  function deviner(sens: string): void {
    if (mancheE === null || jeuJ === null || jeuJ.reponse !== null) return;
    const seconds = Math.max(0, (Date.now() - depart) / 1000);
    const r = repondre(mancheE, [sens], { correct: true, tries: 0, seconds });
    /* Une erreur de sens ne note rien (`ERREUR_SANS_NOTE`) ; la bonne réponse, par `grade`. */
    oneclair(sens, evenementsANoter('eclair', r), r.correct ? (mancheE.tours[0].mot ?? '') : '');
  }

  /* le message : un dialogue court, repris à l'échange exact */
  const dlg = $derived(
    jeuJ?.jeu === 'message'
      ? (corpus?.wechat?.donnees.dialogues.find((d) => d.id === jeuJ.id) ?? null)
      : null
  );
  const ami = $derived(corpus?.wechat?.donnees.ami ?? { zh: '', pinyin: '', fr: '', en: '' });
  const nEch = $derived(dlg?.echanges.length ?? 0);
  const iM = $derived(Math.min(jeuJ?.i ?? 0, nEch));
  const toursM = $derived(dlg ? toursWechat(dlg, graine) : []);
  const echangeM = $derived(dlg && iM < nEch ? dlg.echanges[iM] : null);
  /** L'ami écrit : sa bulle arrive. Purement visuel, la progression a déjà avancé. */
  let attente = $state(false);
  /** Les bulles montrées : pendant que l'ami écrit, la sienne attend. */
  const filM = $derived.by((): Bulle[] => {
    if (!dlg) return [];
    const tout = filDuDialogue(dlg, iM);
    return attente && (iM < nEch || dlg.fin) ? tout.slice(0, -1) : tout;
  });
  /** La dernière réplique fausse choisie, et la dernière bonne : la ligne du bas les dit. */
  let fausse = $state<string | null>(null);
  let notee = $state<{ premier: boolean; notes: string[] } | null>(null);
  let bas = $state<HTMLElement | null>(null);
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  $effect(() => () => {
    if (minuteur !== null) clearTimeout(minuteur);
  });
  const reduit =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function defiler(): Promise<void> {
    await tick();
    bas?.scrollIntoView({ block: 'end', behavior: reduit ? 'auto' : 'smooth' });
  }

  function traduite(b: Bulle): boolean {
    return b.de === 'moi' || b.tour < iM || iM >= nEch;
  }

  function repondreMessage(zh: string): void {
    const j = jeuJ;
    if (dlg === null || j === null || attente || iM >= nEch || j.ecartees.includes(zh)) return;
    const manche = { ...mancheWechat(dlg, graine), i: iM };
    const seconds = Math.max(0, (Date.now() - depart) / 1000);
    const r = choisirReplique(manche, zh, j.ecartees, seconds);
    if (!r.juste) {
      fausse = zh;
      notee = null;
      onecarter(zh);
      return;
    }
    fausse = null;
    notee = { premier: j.ecartees.length === 0, notes: r.evenements.map((e) => e.c) };
    onreplique(r.evenements, nEch);
    attente = true;
    void defiler();
    minuteur = setTimeout(
      () => {
        minuteur = null;
        attente = false;
        depart = Date.now();
        void defiler();
      },
      reduit ? 250 : 900
    );
  }

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
  {:else if vue === 'eclair' && corpus !== null && mancheE !== null}
    <div class="verif-tete">
      <Tao
        stade={taoStade}
        posture={postureDuJeu('eclair')}
        humeur={taoHumeur}
        size={72}
        penchee={TAO_ECLAIR.penchee}
      />
      <p class="guide grow">Un mot jamais appris, fait de deux caractères que tu sais lire.</p>
    </div>
    <div class="card eclair">
      <EclairTour
        t={mancheE.tours[0]}
        {corpus}
        resultat={resultatE}
        donnee={jeuJ?.reponse ? [jeuJ.reponse] : []}
        onchoisir={deviner}
      />
      {#if resultatE !== null}
        <div class="fb">
          {#if resultatE.correct}
            <b>Deviné.</b>
            <span class="hz" lang="zh-Hans">{resultatE.evenements.map((e) => e.c).join(' ')}</span> revus.
          {:else}
            <b>Ce n'était pas ça.</b> Rien n'est noté : le sens se devine, il ne s'oublie pas.
          {/if}
          <span class="compte">{ligneMotsDevines(p.motsDevines.length)}</span>
        </div>
      {/if}
    </div>
    {#if resultatE !== null}
      <div class="foot"><button class="btn" onclick={onsuivant}>Continuer</button></div>
    {/if}
  {:else if vue === 'message' && dlg !== null}
    <div class="verif-tete">
      <Tao stade={taoStade} posture={postureDuJeu('wechat')} humeur={taoHumeur} size={56} />
      <div class="grow">
        <div class="eyebrow">{dlg.fr}</div>
        <p class="nom-ami">
          <span class="hz" lang="zh-Hans">{ami.zh}</span>
          <span class="py">{ami.pinyin}</span>
          <span class="qui">{ami.fr}</span>
        </p>
      </div>
    </div>
    <FilWechat fil={filM} {ami} attente={attente && (iM < nEch || dlg.fin !== null)} {traduite} />
    {#if echangeM !== null && !attente && toursM[iM]}
      <RepliquesWechat
        echange={echangeM}
        choix={toursM[iM].choix}
        ecartees={jeuJ?.ecartees ?? []}
        onchoisir={repondreMessage}
      />
      <div class="fb">
        {#if fausse !== null}
          {@const r = replique(echangeM, fausse)}
          <b>Ça ne lui répond pas.</b>
          {r ? LIGNE_ERREUR[r.erreur] : ''} Rien n’est noté.
        {:else if notee !== null && notee.premier && notee.notes.length > 0}
          <b>Du premier coup.</b>
          <span class="hz" lang="zh-Hans">{notee.notes.join(' ')}</span> revus.
        {:else if notee !== null && !notee.premier}
          <b>Trouvée.</b> Après un essai, rien n’est noté.
        {:else}
          Touche un caractère pour son pinyin, puis choisis ta réplique.
        {/if}
      </div>
    {/if}
    {#if iM >= nEch && !attente}
      <div class="card center bilan">
        <p class="constat">Message lu, avec ce que tu sais lire.</p>
        <div class="k">Ce qui vient d’être revu repasse dans tes révisions.</div>
      </div>
      <div class="foot"><button class="btn" onclick={onsuivant}>Continuer</button></div>
    {/if}
    <div class="ancre" bind:this={bas}></div>
  {:else if (vue === 'eclair' || vue === 'message') && corpus === null}
    <p class="guide">Un instant.</p>
  {:else if vue === 'eclair' || vue === 'message'}
    <!-- Le mot ou le dialogue n'est plus dans l'export : le pas se termine sans lui. -->
    <p class="guide">Le jeu du jour n'a pas pu être lu.</p>
    <div class="foot"><button class="btn" onclick={onsuivant}>Continuer</button></div>
  {:else}
    <p class="guide">Le texte du jour n'a pas pu être lu.</p>
    <div class="foot"><button class="btn" onclick={onquitter}>Revenir au menu</button></div>
  {/if}
</main>

<style>
  .eclair {
    padding-top: 14px;
  }
  .fb .hz {
    font-size: 17px;
  }
  .compte {
    display: block;
    margin-top: 4px;
    color: var(--ink2);
  }
  .eyebrow {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .nom-ami {
    margin: 2px 0 0;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 8px;
  }
  .nom-ami .hz {
    font-size: 20px;
    color: var(--ink);
  }
  .nom-ami .py {
    font-family: var(--head);
    font-weight: 500;
    color: var(--indigo);
  }
  .nom-ami .qui {
    font-size: 14px;
    color: var(--ink2);
  }
  .bilan {
    margin-top: 16px;
  }
  .ancre {
    height: 1px;
    scroll-margin-bottom: 16px;
  }
</style>
