<script lang="ts">
  /**
   * Lire, depuis le menu : la bibliothèque des contes de l'export, réécrits à chaque niveau
   * avec les seuls caractères du niveau (brief §7, stories 2c.1 et 2c.2) : le seuil 255,
   * puis les niveaux HSK. Chaque conte s'ouvre dans la version la plus riche que l'acquis
   * permet de lire ; sans version lisible, il reste fermé et dit le niveau qu'il attend. Quand une version plus riche
   * qu'avant s'ouvre, l'entrée le dit. Toute la logique est dans `lecture.ts`. En mode
   * relecture (Réglages), les contes à relire s'y ajoutent, marqués « à relire », et un
   * conte fermé s'ouvre quand même, marqué « pas encore dans ton acquis ».
   *
   * La bibliothèque suit le catalogue de l'export : chaque récit prévu, écrit ou pas, et
   * sous son titre ses niveaux en petits sceaux (« 255 », « HSK 3 »), un par niveau prévu :
   * plein, écrit et ouvert
   * par l'acquis ; au trait, écrit mais pas encore ouvert ; en pointillés, pas encore écrit.
   * Rien n'est estimé : ce qui n'est pas dans l'export n'est pas écrit. Un récit long se lit
   * chapitre par chapitre et reprend au chapitre noté dans la progression.
   *
   * Sans conte dans l'export, l'écran le dit simplement, sans rien feindre. Un seul
   * retour, vers le menu ; le lecteur, lui, revient ici. Tao lit par-dessus l'épaule.
   *
   * En tête, au-dessus des contes : l'anecdote du jour, son caractère dessiné depuis ses
   * traits. Vue le matin, elle se relit ici autant qu'on veut ; l'écran d'anecdote
   * ramène à Lire, et rien ne se compte deux fois (`parcours.anecdoteRelue`).
   *
   * Les lettres de Que (story 4b.8) ont leur section, « Lettres de Que » : celles arrivées,
   * dans l'ordre du feuilleton, lues dans le même lecteur que les contes, signées de Que.
   * La semaine où une lettre arrive, la section passe en tête et Que se pose avec sa
   * lettre. La règle d'arrivée est dans `lettres.ts`.
   */
  import ARelire from './ARelire.svelte';
  import Conte from './Conte.svelte';
  import Glyph from './Glyph.svelte';
  import Que from './Que.svelte';
  import Tao from './Tao.svelte';
  import { autourDuJour } from './anecdotes';
  import {
    anecdotesOnce,
    contenu,
    contesExport,
    fetesOnce,
    saisonsOnce,
    type CatalogueConte,
    type Conte as ConteExporte,
    type IndexConte
  } from './content';
  import {
    ETATS_NIVEAU,
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
  import { jourRencontre, type Progress } from './session';
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
  /** La semaine où une lettre arrive, sa section passe devant les contes. */
  const lettreNouvelle = $derived(lesLettres.some((e) => e.nouvelle));
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
  const lecture = $derived(
    ouvert === null ? null : (entrees?.find((e) => e.id === ouvert && e.version !== null) ?? null)
  );

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

  /** « seuil 255 écrit et ouvert, HSK 5 pas encore écrit » : les sceaux, pour un lecteur d'écran. */
  function niveauxLus(e: EntreeConte): string {
    return 'Niveaux : ' + e.niveaux.map((n) => `${nomNiveau(n.seuil)} ${ETATS_NIVEAU[n.etat]}`).join(', ');
  }

  /** « encore 12 caractères à lire » ; rien quand on ne sait pas le compter. */
  function reste(e: EntreeConte): string {
    if (e.reste <= 0) return '';
    return e.reste === 1 ? ' · encore un caractère à lire' : ` · encore ${e.reste} caractères à lire`;
  }

  /** « Au seuil 255 », « Au niveau HSK 3 » : en tête de ligne. */
  function capitale(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
</script>

{#snippet signe()}
  <div class="signature">
    <span>Que</span>
    <Que size={44} pose="pose" />
  </div>
{/snippet}

{#snippet sectionLettres()}
  {#if lettres !== null && lettres.length > 0}
    <div class="sec" class:suite={!lettreNouvelle}>Lettres de Que</div>
    {#if lesLettres.length === 0}
      <div class="entry ferme">
        <span class="ico que" aria-hidden="true"><Que size={40} pose="pose" /></span>
        <span class="grow"><span class="d">{LIGNE_AVANT_LETTRE}</span></span>
      </div>
    {/if}
    {#each lesLettres as e (e.lettre.n)}
      <button class="entry" class:nouvelle={e.nouvelle} onclick={() => ouvrirLettre(e)}>
        <span class="ico que" aria-hidden="true">
          <Que size={44} pose="pose" cadeau={e.nouvelle ? 'lettre' : 'aucun'} />
        </span>
        <span class="grow">
          <span class="t">Lettre {e.lettre.n} · {e.lettre.titre_fr}</span>
          <span class="d">
            {e.nouvelle ? 'Arrivée cette semaine' : `Semaine ${e.lettre.n}`}{e.lue ? ' · lue' : ''}
            <ARelire de={e.lettre} />
            {#if e.horsArrivee}<span class="mention">{MENTION_PAS_ARRIVEE}</span>{/if}
          </span>
        </span>
        <span class="chev" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </button>
    {/each}
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
  <main class="screen">
    <button class="k quit" onclick={onretour}>‹ Retour</button>

    <div class="verif-tete">
      <div class="grow">
        <div class="k">Seulement ton acquis</div>
        <h1>Lire</h1>
      </div>
      <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
    </div>
    {#if anecdote}
      <button class="entry anecdote" onclick={onanecdote}>
        <span class="ico" aria-hidden="true">
          <Glyph char={anecdote.a.c} size={34} write={false} color="var(--ink)" pistes={anecdote.pistes} />
        </span>
        <span class="grow">
          <span class="t">L'anecdote du jour</span>
          <span class="d">{anecdote.a.titre}</span>
        </span>
        <span class="chev" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </button>
    {/if}

    <p class="guide">
      Uniquement avec les caractères que tu sais lire. Chaque conte s'ouvre dans la version la
      plus riche que tu peux lire.
    </p>

    {#if lettreNouvelle}{@render sectionLettres()}{/if}

    {#if entrees === null}
      <p class="guide">Un instant.</p>
    {:else if entrees.length === 0}
      <div class="card">
        <div style="font-weight:600">Les contes ne sont pas encore écrits.</div>
        <p class="k">
          Ils arriveront ici, chacun réécrit à ton niveau. En attendant, le texte du jour se lit
          dans la session, au pas Utiliser.
        </p>
      </div>
    {:else}
      <div class="sec" class:suite={lettreNouvelle}>Contes</div>
      {#snippet sceaux(e: EntreeConte)}
        {#if e.niveaux.length > 0}
          <span class="sceaux" role="img" aria-label={niveauxLus(e)}>
            {#each e.niveaux as n (n.seuil)}
              <span class="sceau {n.etat}" title={`${nomNiveau(n.seuil)} : ${ETATS_NIVEAU[n.etat]}`}>{libelleNiveau(n.seuil)}</span>
            {/each}
          </span>
        {/if}
      {/snippet}
      {#snippet titre(e: EntreeConte)}
        {#if e.titre_zh}
          <span class="t"><span class="hz" lang="zh-Hans">{e.titre_zh}</span> <span class="py">{e.titre_pinyin}</span></span>
          <span class="fr">{e.titre_fr}</span>
        {:else}
          <span class="t">{e.titre_fr}</span>
        {/if}
      {/snippet}
      {#each entrees as e (e.id)}
        {#if e.version}
          <button class="entry" data-gratuit={e.gratuit} onclick={() => ouvrir(e)}>
            <span class="ico"><span class="hz">{Array.from(e.titre_zh || e.version.titre)[0] ?? ''}</span></span>
            <span class="grow">
              {@render titre(e)}
              <span class="d">
                {nomNiveau(e.version.seuil)}{e.lue ? ' · lu' : ''}
                <ARelire de={e.version} />
                {#if e.horsAcquis}<span class="mention">{MENTION_HORS_ACQUIS}</span>{/if}
              </span>
              {@render sceaux(e)}
              {#if e.plusRiche}
                <span class="riche">Une version plus riche de ce conte est ouverte.</span>
              {/if}
            </span>
            <span class="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
        {:else}
          <div class="entry ferme" class:a-ecrire={!e.ecrit} data-gratuit={e.gratuit} aria-disabled="true">
            <span class="ico" aria-hidden="true">
              {#if e.ecrit}
                <svg viewBox="0 0 24 24">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              {:else}
                <span class="hz">{Array.from(e.titre_zh)[0] ?? ''}</span>
              {/if}
            </span>
            <span class="grow">
              {@render titre(e)}
              <span class="d">
                {#if !e.ecrit}
                  Pas encore écrit
                {:else}
                  {e.attend === null ? 'Pas encore lisible' : capitale(auNiveau(e.attend))}{reste(e)}
                {/if}
              </span>
              {@render sceaux(e)}
            </span>
          </div>
        {/if}
      {/each}
    {/if}

    {#if !lettreNouvelle}{@render sectionLettres()}{/if}
  </main>
{/if}

<style>
  .sec {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
    margin: 0 2px 10px;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 66px;
    padding: 12px 14px;
    background: var(--card);
    border-radius: 12px;
  }
  .entry + .entry {
    margin-top: 8px;
  }
  /* l'anecdote du jour, seule au-dessus des contes */
  .entry.anecdote {
    margin-bottom: 18px;
  }
  .entry .ico {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--rule);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink2);
    flex-shrink: 0;
  }
  .entry .ico .hz {
    font-size: 23px;
    color: var(--ink);
  }
  .entry .t,
  .entry .d,
  .entry .riche {
    display: block;
  }
  .entry .t {
    font-weight: 600;
    line-height: 1.25;
  }
  .entry .d {
    font-size: 14.5px;
    color: var(--ink2);
    line-height: 1.3;
    margin-top: 1px;
  }
  .entry .t .hz {
    font-size: 21px;
    font-weight: 500;
    letter-spacing: 0.04em;
  }
  .entry .t .py {
    font-size: 14px;
    font-weight: 400;
    font-style: italic;
    color: var(--ink2);
  }
  .entry .fr {
    display: block;
    font-size: 15px;
    color: var(--ink);
    line-height: 1.3;
    margin-top: 2px;
  }
  /* les lettres : Que dans la case, sans cadre ; celle de la semaine, un filet indigo */
  .entry .ico.que {
    border: none;
  }
  .entry.nouvelle {
    outline: 1.5px solid var(--indigo);
    outline-offset: -1.5px;
  }
  .sec.suite {
    margin-top: 24px;
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
  .entry .riche {
    font-size: 14.5px;
    color: var(--indigo);
    line-height: 1.3;
    margin-top: 4px;
  }
  .entry.ferme .t,
  .entry.ferme .t .py,
  .entry.ferme .fr,
  .entry.ferme .d {
    color: var(--mist);
  }
  /* Les niveaux d'un conte : un petit sceau par niveau (« 255 », « HSK 3 »), comme ceux des
     trophées. Plein,
     gravé en clair sur l'encre : écrit et ouvert. Au trait : écrit, pas encore ouvert. En
     pointillés : pas encore écrit. Aucun cinabre. */
  .sceaux {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 7px;
  }
  .sceau {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 20px;
    padding: 0 5px;
    border-radius: 3px;
    border: 1px solid var(--ink2);
    font-family: var(--head);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--ink2);
  }
  .sceau.ouvert {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  .sceau.a_ecrire {
    border-style: dashed;
    border-color: var(--rule);
    color: var(--mist);
    font-weight: 500;
  }
  .entry.a-ecrire .ico {
    border-style: dashed;
  }
  .entry.a-ecrire .ico .hz {
    color: var(--mist);
  }
  svg {
    width: 22px;
    height: 22px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    display: block;
  }
  .chev {
    color: var(--mist);
    flex-shrink: 0;
  }
  .chev svg {
    width: 18px;
    height: 18px;
  }
</style>
