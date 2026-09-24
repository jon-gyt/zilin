<script lang="ts">
  /**
   * Chercher, depuis la loupe du menu : un caractère, son pinyin (avec ou sans accents ni
   * tons) ou un mot français. Le périmètre est l'export et lui seul — les caractères des
   * familles exportées, lus par `content` — sans requête réseau ni dictionnaire embarqué.
   * La logique vit dans `recherche.ts` ; ce composant affiche et charge.
   *
   * Chaque résultat : le caractère dessiné depuis ses traits (style 楷), son pinyin, son
   * sens quand la fiche relue en a un, sa famille et son statut lu sur les cartes. Le
   * toucher le prononce et ouvre sa famille dans l'arbre ; le retour de l'arbre ramène
   * ici, la saisie gardée. Un seul retour, vers le menu. Tao lit par-dessus l'épaule.
   * Pas de cinabre ici : rien n'y est ajouté.
   */
  import Tao from './Tao.svelte';
  import { dire } from './audio';
  import { toutesLesFamilles, traits as traitsDeFamille, type Famille, type Noeud } from './content';
  import { noeudDeFamille } from './foret';
  import { glyph } from './glyph';
  import { AIDE, LIBELLES_STATUT, chercher, corpus, ligne, statut, type Resultat } from './recherche';
  import type { Progress } from './session';
  import { type StrokeSet } from './strokes';
  import { humeur, stade } from './tao';

  let {
    p,
    q = $bindable(''),
    onfamille,
    onretour
  }: {
    p: Progress;
    /** La saisie, gardée par l'aiguillage pour le retour depuis l'arbre. */
    q?: string;
    /** Ouvre l'arbre d'une famille, le caractère touché choisi. */
    onfamille: (fam: Noeud, c: string) => void;
    onretour: () => void;
  } = $props();

  /** La taille d'un résultat : assez grand pour se lire, dessiné depuis les traits. */
  const TAILLE = 44;

  let familles = $state<Famille[] | null>(null);
  let traits = $state<StrokeSet>({});
  /** Les familles dont les tracés sont demandés : une requête chacune, une seule fois. */
  const demandees = new Set<string>();

  $effect(() => {
    let vivant = true;
    void toutesLesFamilles()
      .then((l) => {
        if (vivant) familles = l;
      })
      .catch(() => {
        if (vivant) familles = [];
      });
    return () => {
      vivant = false;
    };
  });

  const entrees = $derived(familles ? corpus(familles) : []);
  const recherche = $derived(chercher(q, entrees));
  const texte = $derived(familles === null ? (q.trim() === '' ? AIDE : 'Un instant.') : ligne(q, recherche, entrees));

  /* Les tracés des familles des résultats, et d'elles seules. */
  $effect(() => {
    for (const r of recherche.resultats) {
      if (demandees.has(r.racine)) continue;
      demandees.add(r.racine);
      void traitsDeFamille(r.racine)
        .then((set) => {
          traits = { ...traits, ...set };
        })
        .catch(() => demandees.delete(r.racine));
    }
  });

  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  function toucher(r: Resultat): void {
    void dire(r.c);
    const f = familles?.find((x) => x.racine.c === r.racine);
    if (f) onfamille(noeudDeFamille(f, p.cartes), r.c);
  }
</script>

<main class="screen chercher">
  <button class="k quit" onclick={onretour}>‹ Retour</button>

  <header class="entete">
    <div class="grow">
      <div class="k surtitre">
        {entrees.length > 0 ? `${entrees.length} caractères, ${familles?.length ?? 0} familles` : ' '}
      </div>
      <h1>Chercher</h1>
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
  </header>

  <label class="champ">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
    <input
      type="search"
      inputmode="search"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="好, hao, hǎo ou hao3"
      aria-label="Chercher un caractère"
      bind:value={q}
    />
  </label>
  <p class="k aide" aria-live="polite">{texte}</p>

  {#if recherche.resultats.length > 0}
    <div class="liste">
      {#each recherche.resultats as r (r.c)}
        {@const s = statut(r.c, p.cartes)}
        <button class="resultat" onclick={() => toucher(r)}>
          <span class="gl">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html glyph(r.c, traits[r.c], TAILLE, { write: false })}
          </span>
          <span class="grow txt">
            <span class="l1">
              {#if r.pinyin !== ''}<span class="pin">{r.pinyin}</span>{/if}
              {#if r.fr !== ''}<span class="sens">{r.fr}</span>{/if}
            </span>
            <span class="l2">
              <span>{r.racine === r.c ? 'racine de sa famille' : `famille ${r.racine}`}</span>
              <span class="st {s}">{LIBELLES_STATUT[s]}</span>
            </span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
</main>

<style>
  .entete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 14px;
  }
  .entete h1 {
    margin: 0;
  }
  .surtitre {
    margin-bottom: 2px;
    min-height: 1.3em;
  }

  /* ---- le champ : un filet, la loupe, la saisie ---- */
  .champ {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 0 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--mist);
  }
  .champ:focus-within {
    border-color: var(--indigo);
  }
  .champ svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .champ input {
    flex: 1;
    min-width: 0;
    padding: 12px 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 17px;
    color: var(--ink);
    outline: none;
  }
  .champ input::placeholder {
    color: var(--mist);
  }
  .aide {
    margin: 10px 2px 6px;
    font-size: 14px;
    line-height: 1.4;
  }

  /* ---- les résultats : une ligne chacun, séparées d'un filet ---- */
  .resultat {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 64px;
    padding: 10px 2px;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .resultat:first-child {
    border-top: 0;
  }
  .resultat:active {
    background: var(--card);
  }
  .gl {
    width: 48px;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
    line-height: 0;
    color: var(--ink);
  }
  .txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .l1 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pin {
    color: var(--indigo);
    font-weight: 600;
    font-size: 17px;
  }
  .sens {
    color: var(--ink);
    font-size: 16px;
  }
  .l2 {
    display: flex;
    gap: 10px;
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .st {
    margin-left: auto;
    white-space: nowrap;
    color: var(--mist);
  }
  .st.lu {
    color: var(--jade);
  }
  .st.encours {
    color: var(--indigo);
  }
</style>
