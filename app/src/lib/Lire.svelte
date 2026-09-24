<script lang="ts">
  /**
   * Lire, depuis le menu : la bibliothèque des contes de l'export, réécrits à chaque seuil
   * avec les seuls caractères du seuil (brief §7, stories 2c.1 et 2c.2). Chaque conte
   * s'ouvre dans la version la plus riche que l'acquis permet de lire ; sans version
   * lisible, il reste fermé et dit le seuil qu'il attend. Quand une version plus riche
   * qu'avant s'ouvre, l'entrée le dit. Toute la logique est dans `lecture.ts`. En mode
   * relecture (Réglages), les contes à relire s'y ajoutent, marqués « à relire », et un
   * conte fermé s'ouvre quand même, marqué « pas encore dans ton acquis ».
   *
   * Sans conte dans l'export, l'écran le dit simplement, sans rien feindre. Un seul
   * retour, vers le menu ; le lecteur, lui, revient ici. Tao lit par-dessus l'épaule.
   *
   * En tête, au-dessus des contes : l'anecdote du jour, son caractère dessiné depuis ses
   * traits. Vue le matin, elle se relit ici autant qu'on veut ; l'écran d'anecdote
   * ramène à Lire, et rien ne se compte deux fois (`parcours.anecdoteRelue`).
   */
  import ARelire from './ARelire.svelte';
  import Conte from './Conte.svelte';
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import {
    anecdotesOnce,
    contesExport,
    fetesOnce,
    saisonsOnce,
    type Conte as ConteExporte,
    type IndexConte
  } from './content';
  import {
    MENTION_HORS_ACQUIS,
    bibliotheque,
    caracteresAcquis,
    type EntreeConte
  } from './lecture';
  import { anecdoteDeLaJournee, type AnecdoteDeLaJournee } from './saisons';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    onretour,
    onlu,
    onanecdote
  }: {
    p: Progress;
    onretour: () => void;
    /** Une version lue en entier : le conte et son seuil. */
    onlu: (conte: string, seuil: number) => void;
    /** Rouvre l'anecdote du jour, qui ramène ici. */
    onanecdote: () => void;
  } = $props();

  /** L'anecdote de la journée de la session, la même que l'écran Ouvrir. */
  let anecdote = $state.raw<AnecdoteDeLaJournee | null>(null);

  $effect(() => {
    const j = p.day;
    let vivant = true;
    void Promise.all([
      anecdotesOnce().catch(() => null),
      fetesOnce().catch(() => null),
      saisonsOnce().catch(() => null)
    ]).then(([liste, fetes, saisons]) => {
      if (vivant) anecdote = anecdoteDeLaJournee(liste?.anecdotes ?? null, fetes, saisons, j);
    });
    return () => {
      vivant = false;
    };
  });

  let lus = $state.raw<{ index: IndexConte[]; contes: Map<string, ConteExporte> } | null>(null);
  /** Le conte ouvert dans le lecteur, `null` pour la bibliothèque. */
  let ouvert: string | null = $state(null);

  $effect(() => {
    let vivant = true;
    void contesExport()
      .then((x) => {
        if (vivant) lus = x;
      })
      .catch(() => {
        if (vivant) lus = { index: [], contes: new Map() };
      });
    return () => {
      vivant = false;
    };
  });

  const acquis = $derived(caracteresAcquis(p.cartes));
  const entrees = $derived(
    lus === null ? null : bibliotheque(lus.index, lus.contes, acquis, p.contesLus, p.relecture)
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

  /** « encore 12 caractères à lire » ; rien quand on ne sait pas le compter. */
  function reste(e: EntreeConte): string {
    if (e.reste <= 0) return '';
    return e.reste === 1 ? ' · encore un caractère à lire' : ` · encore ${e.reste} caractères à lire`;
  }
</script>

{#if lecture}
  <Conte {p} entree={lecture} onlu={() => fini(lecture)} onretour={fermer} />
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
      <div class="sec">Contes</div>
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
                seuil {e.version.seuil}{e.lue ? ' · lu' : ''}
                <ARelire de={e.version} />
                {#if e.horsAcquis}<span class="mention">{MENTION_HORS_ACQUIS}</span>{/if}
              </span>
              {#if e.plusRiche}
                <span class="riche">Une version plus riche de ce conte est ouverte.</span>
              {/if}
            </span>
            <span class="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
        {:else}
          <div class="entry ferme" data-gratuit={e.gratuit} aria-disabled="true">
            <span class="ico" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <span class="grow">
              {@render titre(e)}
              <span class="d">
                {e.attend === null ? 'Pas encore lisible' : `Au seuil ${e.attend}`}{reste(e)}
              </span>
            </span>
          </div>
        {/if}
      {/each}
    {/if}
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
