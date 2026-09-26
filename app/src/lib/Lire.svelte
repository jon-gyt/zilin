<script lang="ts">
  /**
   * Lire, depuis le menu : la bibliothèque des contes de l'export, réécrits à chaque niveau
   * avec les seuls caractères du niveau (brief §7, stories 2c.1 et 2c.2) : le seuil 255,
   * puis les niveaux HSK. Chaque conte s'ouvre dans la version la plus riche que l'acquis
   * permet de lire ; sans version lisible, il reste fermé. Quand une version plus riche
   * qu'avant s'ouvre, le livre le dit. Toute la logique est dans `lecture.ts`, le rangement
   * dans `etageres.ts`. En mode relecture (Réglages), les contes à relire s'y ajoutent,
   * marqués « à relire », et un conte fermé s'ouvre quand même, marqué « pas encore dans
   * ton acquis ».
   *
   * Deux parties, chacune sous un filet d'encre (décision du propriétaire du 26 septembre
   * 2026 : l'ancienne liste était « trop classique », les séparations doivent être nettes) :
   *
   * - « Aujourd'hui 今天 » : l'anecdote du jour en fiche, son caractère dessiné depuis ses
   *   traits (vue le matin, elle se relit ici autant qu'on veut ; l'écran d'anecdote ramène
   *   à Lire, et rien ne se compte deux fois, `parcours.anecdoteRelue`) ; puis la lettre de
   *   Que (story 4b.8) en enveloppe où le moineau se pose : la dernière arrivée, « NOUVELLE »
   *   la semaine où elle arrive, les précédentes en petites enveloppes numérotées ; avant la
   *   première, la ligne qui l'annonce. Les lettres se lisent dans le lecteur des contes,
   *   signées de Que ; la règle d'arrivée est dans `lettres.ts`.
   * - « Les contes 故事 » : chaque conte du catalogue en livre cousu 线装书, sur trois
   *   étagères, « À lire maintenant », « Bientôt », « Plus loin » (qui défile de côté).
   *   Couverture au pigment, motif du catalogue, titre vertical ; sous le livre, ses niveaux
   *   en petits sceaux : plein, écrit et ouvert ; au trait, écrit mais pas encore ouvert ; en
   *   pointillés, pas encore écrit ; au jade, déjà lu. Rien n'est estimé : ce qui n'est pas
   *   dans l'export n'est pas écrit, et le jour où un conte s'ouvrira ne se dit pas. Un récit
   *   long se lit chapitre par chapitre et reprend au chapitre noté dans la progression.
   *
   * Les fonds restent ceux du papier et de la carte, tous pareils, sous un filet fin ; la
   * couleur n'est que dans les images (couvertures, motifs, planche, timbre de l'enveloppe).
   * L'indigo marque l'action. Ni cinabre, ni ombre, ni dégradé, ni doré.
   *
   * Sans conte dans l'export, l'écran le dit simplement, sans rien feindre. Un seul
   * retour, vers le menu ; le lecteur, lui, revient ici. Tao lit par-dessus l'épaule.
   */
  import ARelire from './ARelire.svelte';
  import Conte from './Conte.svelte';
  import Glyph from './Glyph.svelte';
  import Motif from './Motif.svelte';
  import Que from './Que.svelte';
  import Tao from './Tao.svelte';
  import { autourDuJour } from './anecdotes';
  import {
    anecdotesOnce,
    contenu,
    contesExport,
    fetesOnce,
    nomParcours,
    saisonsOnce,
    type CatalogueConte,
    type Conte as ConteExporte,
    type IndexConte
  } from './content';
  import {
    etageres,
    etendue,
    joursDuChemin,
    ligneOuverture,
    livresParRangee,
    niveauxLus,
    ouvertures,
    rangees,
    resteALire,
    type Livre
  } from './etageres';
  import {
    MENTION_HORS_ACQUIS,
    bibliotheque,
    caracteresAcquis,
    cleLecture,
    type EntreeConte
  } from './lecture';
  import { auNiveau, libelleNiveau, nomNiveau, type Niveau } from './niveaux';
  import { anecdoteDeLaJournee, suiviDe, type AnecdoteDeLaJournee } from './saisons';
  import {
    LIGNE_AVANT_LETTRE,
    MENTION_PAS_ARRIVEE,
    entreesLettres,
    lettresExport,
    versionDeLettre,
    type EntreeLettre,
    type Lettre
  } from './lettres';
  import { jourParcours, jourRencontre, type Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    onretour,
    onlu,
    onanecdote,
    onlettre = () => undefined,
    onchapitre = () => undefined,
    onreprise = () => undefined
  }: {
    p: Progress;
    onretour: () => void;
    /** Une version lue en entier : le conte et son niveau. */
    onlu: (conte: string, seuil: Niveau) => void;
    /** Rouvre l'anecdote du jour, qui ramène ici. */
    onanecdote: () => void;
    /** Une lettre de Que lue en entier : son rang dans le feuilleton. */
    onlettre?: (n: number) => void;
    /** Un chapitre d'un récit long lu en entier : le conte, son niveau, le chapitre, sur n. */
    onchapitre?: (conte: string, seuil: Niveau, k: number, n: number) => void;
    /** Un chapitre d'un récit long ouvert depuis le sommaire : on y reprendra. */
    onreprise?: (conte: string, seuil: Niveau, k: number) => void;
  } = $props();

  /** L'anecdote de la journée de la session, la même que l'écran Ouvrir. */
  let anecdote = $state.raw<AnecdoteDeLaJournee | null>(null);

  $effect(() => {
    const j = p.day;
    let vivant = true;
    void Promise.all([
      anecdotesOnce().catch(() => null),
      fetesOnce().catch(() => null),
      saisonsOnce().catch(() => null),
      contenu().catch(() => null)
    ]).then(([liste, fetes, saisons, index]) => {
      if (!vivant) return;
      /* Le même suivi que l'écran Ouvrir : fêtes et anecdotes vues, caractères récents. */
      const suivi = suiviDe(p, index ? autourDuJour(index, p.parcours, jourRencontre(p)) : undefined);
      anecdote = anecdoteDeLaJournee(liste?.anecdotes ?? null, fetes, saisons, j, suivi);
    });
    return () => {
      vivant = false;
    };
  });

  let lus = $state.raw<{
    index: IndexConte[];
    contes: Map<string, ConteExporte>;
    catalogue: CatalogueConte[];
  } | null>(null);
  /** Le conte ouvert dans le lecteur, `null` pour la bibliothèque. */
  let ouvert: string | null = $state(null);
  /** Les lettres de Que de l'export (et de l'aperçu en mode relecture), `null` avant lecture. */
  let lettres = $state.raw<Lettre[] | null>(null);
  /** La lettre ouverte dans le lecteur, par son rang. */
  let lettreOuverte: number | null = $state(null);

  $effect(() => {
    let vivant = true;
    void lettresExport()
      .then((l) => {
        if (vivant) lettres = l;
      })
      .catch(() => {
        if (vivant) lettres = [];
      });
    return () => {
      vivant = false;
    };
  });

  const lesLettres = $derived(
    lettres === null ? [] : entreesLettres(lettres, p.lettres, p.day, p.relecture)
  );
  /**
   * La lettre de l'enveloppe : celle de la semaine, sinon la dernière arrivée, sinon (mode
   * relecture, rien d'arrivé) la dernière du feuilleton. Les autres suivent, en petit.
   */
  const lettreDuJour = $derived(
    lesLettres.find((e) => e.nouvelle) ??
      [...lesLettres].reverse().find((e) => !e.horsArrivee) ??
      lesLettres[lesLettres.length - 1] ??
      null
  );
  const autresLettres = $derived(lesLettres.filter((e) => e !== lettreDuJour));
  const lectureLettre = $derived(
    lettreOuverte === null ? null : (lesLettres.find((e) => e.lettre.n === lettreOuverte) ?? null)
  );

  /** Une lettre, habillée pour le lecteur des contes. */
  function entreeDeLettre(e: EntreeLettre): EntreeConte {
    return {
      id: `lettre-${e.lettre.n}`,
      titre_zh: '',
      titre_pinyin: '',
      titre_fr: e.lettre.titre_fr,
      gratuit: false,
      version: versionDeLettre(e.lettre),
      attend: null,
      reste: 0,
      lue: e.lue,
      plusRiche: false,
      horsAcquis: false,
      sansCompte: e.sansCompte,
      niveaux: [],
      ecrit: true
    };
  }

  function ouvrirLettre(e: EntreeLettre): void {
    lettreOuverte = e.lettre.n;
    haut();
  }

  function fermerLettre(): void {
    lettreOuverte = null;
    haut();
  }

  /** Une lettre lue le note ; ce que seul le mode relecture ouvre ne compte pas. */
  function lettreFinie(e: EntreeLettre): void {
    if (!e.sansCompte) onlettre(e.lettre.n);
    fermerLettre();
  }

  /** « Arrivée cette semaine · lue », « Semaine 3 » : où en est une lettre. */
  function etatLettre(e: EntreeLettre): string {
    return `${e.nouvelle ? 'Arrivée cette semaine' : `Semaine ${e.lettre.n}`}${e.lue ? ' · lue' : ''}`;
  }

  $effect(() => {
    let vivant = true;
    void contesExport()
      .then((x) => {
        if (vivant) lus = x;
      })
      .catch(() => {
        if (vivant) lus = { index: [], contes: new Map(), catalogue: [] };
      });
    return () => {
      vivant = false;
    };
  });

  const acquis = $derived(caracteresAcquis(p.cartes));
  const entrees = $derived(
    lus === null
      ? null
      : bibliotheque(lus.index, lus.contes, acquis, p.contesLus, p.relecture, lus.catalogue)
  );
  /** Le chemin de l'apprenant : le jour où chaque caractère y entre. Vide avant lecture. */
  let chemin = $state.raw<Map<string, number>>(new Map());

  $effect(() => {
    const choisi = p.parcours;
    let vivant = true;
    void contenu()
      .then((i) => {
        if (vivant) chemin = joursDuChemin(i.parcours[nomParcours(i, choisi)]?.jours ?? []);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const lesEtageres = $derived(
    entrees === null || lus === null
      ? []
      : etageres(entrees, lus.catalogue, p.contesLus, {
          ouvertures: ouvertures(entrees, lus.contes, acquis, chemin),
          /* le dernier jour du chemin fait : ses caractères sont déjà entrés */
          fait: jourParcours(p) - 1
        })
  );
  const lecture = $derived(
    ouvert === null ? null : (entrees?.find((e) => e.id === ouvert && e.version !== null) ?? null)
  );

  /** La largeur des étagères, pour ranger les livres en rangées, chacune sur sa planche. */
  let largeur = $state(0);
  const parRangee = $derived(livresParRangee(largeur));

  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  function haut(): void {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  function ouvrir(e: EntreeConte): void {
    if (e.version === null) return;
    ouvert = e.id;
    haut();
  }

  function fermer(): void {
    ouvert = null;
    haut();
  }

  /**
   * Ce que le mode relecture a ouvert (une version à relire, ou hors de l'acquis) ne compte
   * pas comme lu : ni les contes lus, ni les trophées, ni Tao ne le notent.
   */
  function fini(e: EntreeConte): void {
    if (e.version !== null && !e.sansCompte) onlu(e.id, e.version.seuil);
    fermer();
  }

  /** Un chapitre lu : noté, sauf ce que seul le mode relecture ouvre. */
  function chapitreLu(e: EntreeConte, k: number, n: number): void {
    if (e.version !== null && !e.sansCompte) onchapitre(e.id, e.version.seuil, k, n);
  }

  function reprendre(e: EntreeConte, k: number): void {
    if (e.version !== null && !e.sansCompte) onreprise(e.id, e.version.seuil, k);
  }

  /** Ce qu'un livre fermé dit, pour qui ne voit pas la couverture. */
  function etatFerme(e: EntreeConte): string {
    if (!e.ecrit) return 'Pas encore écrit';
    const reste = resteALire(e);
    return `${e.attend === null ? 'Pas encore lisible' : capitale(auNiveau(e.attend))}${reste ? ` · ${reste} à lire` : ''}`;
  }

  /** « Au seuil 255 », « Au niveau HSK 3 » : en tête de phrase. */
  function capitale(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Le titre de la couverture, un caractère par ligne : le vrai titre, sinon celui de la version. */
  function titreVertical(e: EntreeConte): string[] {
    return Array.from(e.titre_zh || e.version?.titre || '').slice(0, 7);
  }
</script>

{#snippet signe()}
  <div class="signature">
    <span>Que</span>
    <Que size={44} pose="pose" />
  </div>
{/snippet}

{#snippet enveloppe(petite: boolean)}
  <!-- l'enveloppe au trait d'encre, son timbre à l'ocre ; Que se pose dessus -->
  <span class="enveloppe" class:petite aria-hidden="true">
    <svg viewBox="0 0 70 50">
      <rect x="2" y="4" width="62" height="42" rx="3" fill="var(--card)" stroke="var(--ink)" stroke-width="1.6" />
      <path d="M2 6 L33 30 L64 6" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round" />
      <rect x="44" y="32" width="14" height="10" rx="1.5" fill="var(--ocre)" />
    </svg>
    {#if !petite}<span class="que"><Que size={34} pose="pose" /></span>{/if}
  </span>
{/snippet}

{#snippet couverture(l: Livre)}
  {@const e = l.entree}
  <span class="couv" aria-hidden="true">
    <span class="points"><i></i><i></i><i></i><i></i></span>
    {#if l.chapitres > 1}<span class="chap">{l.chapitres} CHAP.</span>{/if}
    {#if titreVertical(e).length > 0}
      <span class="etiquette" lang="zh-Hans">
        {#each titreVertical(e) as c, i (i)}<span>{c}</span>{/each}
      </span>
    {/if}
    <span class="dessin"><Motif nom={l.motif} /></span>
  </span>
{/snippet}

{#snippet sceaux(l: Livre)}
  {#if l.sceaux.length > 0}
    <span class="sceaux" role="img" aria-label={niveauxLus(l)}>
      {#each l.sceaux as s (s.seuil)}
        <span class="sceau {s.etat}" class:lu={s.lu}>{libelleNiveau(s.seuil)}</span>
      {/each}
    </span>
  {/if}
{/snippet}

{#snippet livre(l: Livre, bientot = false)}
  {@const e = l.entree}
  {#if e.version}
    <button class="livre" style="--c:var(--{l.pigment});--c-bg:var(--{l.pigment}-bg)" data-gratuit={e.gratuit} onclick={() => ouvrir(e)}>
      {@render couverture(l)}
      {#if e.titre_zh}<span class="sr" lang="zh-Hans">{e.titre_zh} {e.titre_pinyin}</span>{/if}
      {@render sceaux(l)}
      <span class="fr">{e.titre_fr}</span>
      <span class="sr">{nomNiveau(e.version.seuil)}{e.lue ? ' · lu' : ''}</span>
      <ARelire de={e.version} />
      {#if e.horsAcquis}<span class="mention">{MENTION_HORS_ACQUIS}</span>{/if}
      {#if e.plusRiche}<span class="riche">Une version plus riche de ce conte est ouverte.</span>{/if}
    </button>
  {:else}
    <div class="livre ferme" class:a-ecrire={!e.ecrit} style="--c:var(--{l.pigment});--c-bg:var(--{l.pigment}-bg)" data-gratuit={e.gratuit} aria-disabled="true">
      {@render couverture(l)}
      {#if e.titre_zh}<span class="sr" lang="zh-Hans">{e.titre_zh} {e.titre_pinyin}</span>{/if}
      {@render sceaux(l)}
      {#if l.dans !== null}
        <span class="reste">{ligneOuverture(l.dans)}<span class="sr"> du chemin</span></span>
      {:else if bientot && resteALire(e)}
        <span class="reste" aria-hidden="true">{resteALire(e)}</span>
      {/if}
      <span class="fr">{e.titre_fr}</span>
      <span class="sr">{etatFerme(e)}</span>
    </div>
  {/if}
{/snippet}

{#if lectureLettre}
  <Conte
    {p}
    entree={entreeDeLettre(lectureLettre)}
    surtitre={`Lettre ${lectureLettre.lettre.n} de Que${lectureLettre.horsArrivee ? ` · ${MENTION_PAS_ARRIVEE}` : ''}`}
    signature={signe}
    onlu={() => lettreFinie(lectureLettre)}
    onretour={fermerLettre}
  />
{:else if lecture}
  <Conte
    {p}
    entree={lecture}
    enCours={lecture.version && !lecture.sansCompte
      ? p.chapitres[cleLecture(lecture.id, lecture.version.seuil)]
      : undefined}
    onlu={() => fini(lecture)}
    onchapitre={(k, n) => chapitreLu(lecture, k, n)}
    onreprise={(k) => reprendre(lecture, k)}
    onretour={fermer}
  />
{:else}
  <main class="screen lire">
    <div class="haut">
      <button class="k quit" onclick={onretour}>‹ Retour</button>
      <span class="k">Seulement ton acquis</span>
    </div>

    <div class="titre">
      <span class="gl" aria-hidden="true"><Glyph char="读" size={46} write={false} color="var(--ink)" /></span>
      <h1>Lire</h1>
      <span class="tao"><Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={64} /></span>
    </div>

    <!-- Aujourd'hui : l'anecdote du jour, puis la lettre de Que -->
    {#if anecdote || (lettres !== null && lettres.length > 0)}
      <h2 class="sec">Aujourd'hui <span class="zh" lang="zh-Hans">今天</span></h2>
      {#if anecdote}
        <button class="fiche anecdote" onclick={onanecdote}>
          <span class="gl" aria-hidden="true">
            <Glyph char={anecdote.a.c} size={54} write={false} color="var(--ink)" pistes={anecdote.pistes} />
          </span>
          <span class="grow">
            <span class="kick">L'anecdote du jour</span>
            <span class="t">{anecdote.a.titre}</span>
          </span>
        </button>
      {/if}

      {#if lettres !== null && lettres.length > 0}
        {#if lettreDuJour === null}
          <div class="fiche lettre ferme">
            {@render enveloppe(false)}
            <span class="grow"><span class="d">{LIGNE_AVANT_LETTRE}</span></span>
          </div>
        {:else}
          {@const e = lettreDuJour}
          <button class="fiche lettre" onclick={() => ouvrirLettre(e)}>
            {@render enveloppe(false)}
            <span class="grow">
              <span class="t">
                Lettre {e.lettre.n} de Que
                {#if e.nouvelle}<span class="nouvelle">NOUVELLE</span>{/if}
              </span>
              <span class="d">
                « {e.lettre.titre_fr} » · {etatLettre(e)}
                <ARelire de={e.lettre} />
                {#if e.horsArrivee}<span class="mention">{MENTION_PAS_ARRIVEE}</span>{/if}
              </span>
            </span>
          </button>
          {#if autresLettres.length > 0}
            <div class="precedentes">
              <span class="k">Ses lettres</span>
              <span class="pile">
                {#each autresLettres as x (x.lettre.n)}
                  <button
                    class="pli"
                    class:hors={x.horsArrivee}
                    aria-label={`Lettre ${x.lettre.n} · ${x.lettre.titre_fr} · ${etatLettre(x)}${x.horsArrivee ? ` · ${MENTION_PAS_ARRIVEE}` : ''}`}
                    title={`${x.lettre.titre_fr}${x.horsArrivee ? ` · ${MENTION_PAS_ARRIVEE}` : ''}`}
                    onclick={() => ouvrirLettre(x)}
                  >
                    {@render enveloppe(true)}
                    <span class="n" class:lue={x.lue}>{x.lettre.n}</span>
                  </button>
                {/each}
              </span>
            </div>
          {/if}
        {/if}
      {/if}
    {/if}

    <!-- Les contes : trois étagères de livres cousus -->
    {#if entrees === null}
      <p class="guide">Un instant.</p>
    {:else if entrees.length === 0}
      <h2 class="sec">Les contes <span class="zh" lang="zh-Hans">故事</span></h2>
      <div class="fiche vide">
        <div style="font-weight:600">Les contes ne sont pas encore écrits.</div>
        <p class="k">
          Ils arriveront ici, chacun réécrit à ton niveau. En attendant, le texte du jour se lit
          dans la session, au pas Utiliser.
        </p>
      </div>
    {:else}
      <h2 class="sec">
        Les contes <span class="zh" lang="zh-Hans">故事</span>
        <small>{entrees.length} conte{entrees.length > 1 ? 's' : ''}</small>
      </h2>
      <div class="etageres" bind:clientWidth={largeur}>
        {#each lesEtageres as et (et.id)}
          {#if et.livres.length > 0 || et.id === 'maintenant'}
            <section class="etagere {et.id}" aria-label={et.nom}>
              <h3 class="nom">
                {et.nom} <b>{et.livres.length}</b>
                {#if et.id === 'loin' && et.livres.length > 0}
                  <em>{etendue(et.livres)}{et.livres.length > parRangee ? ' · fais glisser ›' : ''}</em>
                {:else if et.id === 'bientot'}
                  <em>sur ton chemin</em>
                {/if}
              </h3>
              {#if et.livres.length === 0}
                <p class="k attente">
                  Aucun conte encore dans ton acquis : chacun s'ouvre dès que tu sais lire tous ses
                  caractères.
                </p>
                <div class="planche"></div>
              {:else if et.id === 'loin'}
                <div class="rangee defile">
                  {#each et.livres as l (l.entree.id)}{@render livre(l)}{/each}
                </div>
                <div class="planche"></div>
              {:else}
                {#each rangees(et.livres, parRangee) as r, i (i)}
                  <div class="rangee">
                    {#each r as l (l.entree.id)}{@render livre(l, et.id === 'bientot')}{/each}
                  </div>
                  <div class="planche"></div>
                {/each}
              {/if}
            </section>
          {/if}
        {/each}
      </div>
    {/if}
  </main>
{/if}

<style>
  .lire {
    gap: 14px;
  }
  .haut {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .haut .quit {
    color: var(--indigo);
    font-weight: 600;
    font-size: 15px;
  }
  .titre {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: -6px;
  }
  .titre .gl {
    display: inline-flex;
  }
  .titre h1 {
    margin: 0;
    font-size: 26px;
  }
  .titre .tao {
    margin-left: auto;
  }
  .gl :global(svg) {
    display: block;
  }

  /* les deux parties : un filet d'encre, le titre, son caractère */
  .sec {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 12px 0 0;
    padding-top: 14px;
    border-top: 1.5px solid var(--ink);
    font-family: var(--head);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .sec .zh {
    font-family: var(--hz);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink2);
  }
  .sec small {
    margin-left: auto;
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 400;
    color: var(--mist);
  }

  /* les fiches : toutes au papier de la carte, un filet fin */
  .fiche {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 14px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 16px;
  }
  .fiche .t,
  .fiche .d,
  .fiche .kick {
    display: block;
  }
  .fiche .kick {
    font-family: var(--head);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .fiche .t {
    font-weight: 600;
    font-size: 16.5px;
    line-height: 1.25;
  }
  .fiche .d {
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.35;
    margin-top: 2px;
  }
  .anecdote .gl {
    display: inline-flex;
    width: 64px;
    justify-content: center;
    flex-shrink: 0;
  }
  .anecdote .t {
    margin-top: 2px;
  }
  .fiche.vide {
    display: block;
  }

  /* la lettre de Que : l'enveloppe, le moineau posé dessus */
  .lettre {
    padding: 12px 14px;
  }
  .enveloppe {
    position: relative;
    display: inline-block;
    width: 70px;
    height: 50px;
    margin-top: 10px;
    flex-shrink: 0;
  }
  .enveloppe svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .enveloppe .que {
    position: absolute;
    right: -8px;
    top: -22px;
  }
  .enveloppe.petite {
    width: 34px;
    height: 24px;
    margin: 0;
  }
  .lettre.ferme .d {
    color: var(--ink2);
  }
  .nouvelle {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--indigo);
    color: var(--on);
    font-family: var(--head);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    vertical-align: 2px;
  }
  .precedentes {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: -4px;
    padding: 0 2px;
  }
  .precedentes .k {
    flex-shrink: 0;
  }
  .pile {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px;
  }
  .pile::-webkit-scrollbar {
    display: none;
  }
  .pli {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 44px;
    min-height: 44px;
    padding: 4px 2px;
    flex-shrink: 0;
  }
  .pli .n {
    font-family: var(--head);
    font-size: 11px;
    font-weight: 700;
    color: var(--ink2);
  }
  /* une lettre déjà lue : son numéro au jade, comme le sceau d'un conte lu */
  .pli .n.lue {
    color: var(--jade);
  }
  .pli.hors .enveloppe {
    opacity: 0.5;
  }

  /* les étagères : un nom et son compte, les livres, la planche */
  .etageres {
    display: flex;
    flex-direction: column;
    gap: 22px;
    margin-top: 2px;
  }
  .etagere .nom {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 2px 4px;
    font-family: var(--head);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink2);
  }
  .etagere .nom b {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--line);
    color: var(--ink);
    font-size: 11px;
    letter-spacing: 0;
  }
  .etagere .nom em {
    margin-left: auto;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 400;
    font-style: normal;
    letter-spacing: 0;
    text-transform: none;
    color: var(--mist);
    white-space: nowrap;
  }
  .attente {
    margin: 4px 2px 10px;
  }
  .rangee {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 6px 0 0;
  }
  .rangee + .planche + .rangee {
    margin-top: 16px;
  }
  /* « Plus loin » défile de côté, jusqu'au bord de l'écran */
  .rangee.defile {
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 -22px;
    padding-left: 22px;
    padding-right: 22px;
    scroll-padding-left: 22px;
  }
  .rangee.defile::-webkit-scrollbar {
    display: none;
  }
  .planche {
    height: 9px;
    margin: 0 -2px;
    background: var(--bois);
    border-bottom: 3px solid var(--bois-chant);
    border-radius: 2px;
  }

  /* un livre cousu 线装书 : couverture au pigment, points de couture, titre vertical */
  .livre {
    position: relative;
    flex: none;
    width: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-bottom: 8px;
    text-align: center;
  }
  .couv {
    position: relative;
    display: block;
    width: 92px;
    height: 128px;
    border-radius: 3px 6px 6px 3px;
    background: var(--c-bg);
    border: 1.5px solid var(--c);
    color: var(--c);
  }
  .couv::before {
    content: '';
    position: absolute;
    left: 9px;
    top: 0;
    bottom: 0;
    border-left: 1.5px dashed var(--c);
    opacity: 0.55;
  }
  .points {
    position: absolute;
    left: 3px;
    top: 14px;
    bottom: 14px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .points i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--c);
    opacity: 0.7;
  }
  .etiquette {
    position: absolute;
    right: 10px;
    top: 10px;
    bottom: 10px;
    width: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: var(--card);
    border: 1px solid var(--c);
    font-family: var(--hz);
    font-size: 18px;
    font-weight: 500;
    line-height: 1.1;
    color: var(--ink);
  }
  .dessin {
    position: absolute;
    left: 15px;
    bottom: 10px;
  }
  .chap {
    position: absolute;
    left: 15px;
    top: 9px;
    font-family: var(--head);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  /* un livre fermé : pâle, au pointillé ; le motif garde son pigment */
  .livre.ferme .couv {
    background: var(--card);
    border-style: dashed;
    border-color: var(--grille);
  }
  .livre.ferme .couv::before {
    border-color: var(--grille);
  }
  .livre.ferme .points i {
    background: var(--grille);
  }
  .livre.ferme .etiquette {
    border-color: var(--grille);
    color: var(--ink2);
  }
  .livre.ferme .chap {
    color: var(--mist);
  }
  .livre.a-ecrire .dessin {
    opacity: 0.7;
  }
  .livre .fr {
    font-size: 12.5px;
    line-height: 1.25;
    color: var(--ink2);
  }
  .livre:not(.ferme) .fr {
    color: var(--ink);
  }
  .livre .reste {
    margin-top: -2px;
    font-size: 11px;
    color: var(--mist);
  }
  .livre .riche {
    font-size: 11.5px;
    line-height: 1.25;
    color: var(--indigo);
  }
  .livre :global(.mention) {
    white-space: normal;
    font-size: 11px;
    padding: 1px 6px;
  }

  /* Les niveaux d'un conte : un petit sceau par niveau (« 255 », « HSK 3 »). Plein, à
     l'indigo : écrit et ouvert. Au trait : écrit, pas encore ouvert. En pointillés : pas
     encore écrit. Au jade : déjà lu. Aucun cinabre. */
  .sceaux {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }
  .sceau {
    padding: 3px 4px;
    border: 1.3px solid var(--indigo);
    border-radius: 3px;
    font-family: var(--head);
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--indigo);
  }
  .sceau.ouvert {
    background: var(--indigo);
    color: var(--on);
  }
  .sceau.lu {
    background: var(--jade);
    border-color: var(--jade);
    color: var(--on);
  }
  .sceau.a_ecrire {
    border-style: dotted;
    border-color: var(--grille);
    color: var(--mist);
  }

  .signature {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    margin-top: 8px;
    font-family: var(--head);
    font-weight: 700;
    color: var(--ink2);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
