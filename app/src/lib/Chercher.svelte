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
   *
   * Le second onglet, « Lire le monde » (rapport comparatif du 28 septembre 2026, §2.5) : on
   * colle ou tape un texte chinois, et l'écran dit combien de ses sinogrammes on lit. Chaque
   * caractère lu passe au jade et se touche pour ouvrir sa fiche ; les autres restent à
   * l'encre, avec, s'ils sont sur le chemin, dans combien de jours du chemin ils viennent.
   * Les mots de deux caractères lus que l'export connaît sont soulignés et listés. La photo
   * passe par le Texte en direct d'iOS, sans code ni réseau. La logique vit dans
   * `lecteur-libre.ts`, les textes dans `ecrans.json` ; le jade pour l'acquis, l'indigo pour
   * l'action et le chemin.
   */
  import Hz from './Hz.svelte';
  import Tao from './Tao.svelte';
  import { dire } from './audio';
  import {
    contenu,
    nomParcours,
    toutesLesFamilles,
    traits as traitsDeFamille,
    type Famille,
    type Noeud
  } from './content';
  import { eclairOnce } from './eclair';
  import { ecransOnce, remplir, SANS_ECRANS, type TextesLireLeMonde } from './ecrans';
  import { joursDuChemin } from './etageres';
  import { noeudDeFamille, racinesDesCaracteres } from './foret';
  import { glyph, nomAccessible } from './glyph';
  import {
    caracteresLus,
    lexique,
    ligneCompte,
    ligneDans,
    lire,
    unites,
    type MotConnu,
    type Signe
  } from './lecteur-libre';
  import { AIDE, LIBELLES_STATUT, chercher, corpus, ligne, statut, type Resultat } from './recherche';
  import { jourParcours, type Progress } from './session';
  import { type StrokeSet } from './strokes';
  import { humeur, stade } from './tao';

  let {
    p,
    q = $bindable(''),
    mode = $bindable('caractere'),
    texte = $bindable(''),
    monde = true,
    onfamille,
    onretour
  }: {
    p: Progress;
    /** La saisie, gardée par l'aiguillage pour le retour depuis l'arbre. */
    q?: string;
    /** L'onglet ouvert : chercher un caractère, ou lire un texte. Gardé pour le retour. */
    mode?: 'caractere' | 'texte';
    /** Le texte à lire, gardé pour le retour depuis l'arbre. */
    texte?: string;
    /**
     * L'aventure (`ouvertures.ts`) : l'onglet « Un texte », Lire le monde, s'ouvre avec sa
     * porte ; avant, Chercher n'a que la recherche d'un caractère, toujours là.
     */
    monde?: boolean;
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
  const ligneAide = $derived(familles === null ? (q.trim() === '' ? AIDE : 'Un instant.') : ligne(q, recherche, entrees));

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

  /* ---------- Lire le monde ---------- */

  let tl = $state<TextesLireLeMonde>(SANS_ECRANS.lire);
  let chemin = $state.raw<Map<string, number>>(new Map());
  let motsEclair = $state.raw<MotConnu[]>([]);

  $effect(() => {
    const choisi = p.parcours;
    let vivant = true;
    void ecransOnce()
      .then((e) => {
        if (vivant) tl = e.lire;
      })
      .catch(() => undefined);
    void contenu()
      .then((i) => {
        if (vivant) chemin = joursDuChemin(i.parcours[nomParcours(i, choisi)]?.jours ?? []);
      })
      .catch(() => undefined);
    void eclairOnce()
      .then((e) => {
        if (vivant) motsEclair = e.mots.map((m) => ({ hanzi: m.mot, pinyin: m.pinyin, fr: m.fr }));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /** Les mots de deux caractères de l'export : ceux des fiches relues, puis ceux de l'éclair. */
  const mots = $derived(
    lexique(
      (familles ?? []).flatMap((f) => f.fiches.flatMap((x) => (x.statut === 'relu' ? x.mots : []))),
      motsEclair
    )
  );
  const lecture = $derived(
    lire(texte, {
      lus: caracteresLus(p.cartes),
      chemin,
      /* le dernier jour du chemin fait, comme l'étagère « Bientôt » de Lire */
      fait: jourParcours(p) - 1,
      mots
    })
  );
  const parCaractere = $derived(new Map(entrees.map((e) => [e.c, e])));
  const racines = $derived(racinesDesCaracteres(familles ?? []));

  /** Le nom d'un caractère lu pour VoiceOver : « 住, zhù, habiter, lu. Ouvrir sa fiche. » */
  function nomLu(c: string): string {
    const e = parCaractere.get(c);
    return remplir(tl.ouvrir, { nom: nomAccessible(c, e?.pinyin ?? '', e?.fr ?? '') });
  }

  /** Un caractère lu, touché : il se dit, et sa fiche s'ouvre dans l'arbre de sa famille. */
  function ouvrirLu(c: string): void {
    void dire(c);
    const r = racines.get(c);
    const f = familles?.find((x) => x.racine.c === r);
    if (f) onfamille(noeudDeFamille(f, p.cartes), c);
  }

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

  {#if monde}
  <div class="onglets" role="tablist" aria-label={tl.onglets}>
    <button
      role="tab"
      aria-selected={mode === 'caractere'}
      class:on={mode === 'caractere'}
      onclick={() => (mode = 'caractere')}>{tl['onglet-caractere']}</button
    >
    <button role="tab" aria-selected={mode === 'texte'} class:on={mode === 'texte'} onclick={() => (mode = 'texte')}
      >{tl['onglet-texte']}</button
    >
  </div>
  {/if}

  <!-- Un signe du texte lu : un caractère lu (jade, il ouvre sa fiche), un autre (à l'encre, et
       « dans N j » s'il est sur le chemin), ou ce qui n'est pas un sinogramme. -->
  {#snippet signe(s: Signe)}
    {#if !s.han}<span class="autre">{s.t}</span
      >{:else if s.etat === 'lu'}<button class="car lu" aria-label={nomLu(s.c)} onclick={() => ouvrirLu(s.c)}
        ><span class="c" lang="zh-Hans">{s.c}</span><span class="sous" aria-hidden="true"></span></button
      >{:else}<span class="car {s.etat}"
        ><span class="c" lang="zh-Hans">{s.c}</span><span class="sous"
          >{s.dans === null ? '' : ligneDans(tl, s.dans)}</span
        ></span
      >{/if}
  {/snippet}

  {#if monde && mode === 'texte'}
    <div class="champ texte">
      <textarea
        rows="3"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        lang="zh-Hans"
        placeholder={tl.invite}
        aria-label={tl.champ}
        bind:value={texte}
      ></textarea>
      {#if texte !== ''}
        <button class="effacer" onclick={() => (texte = '')}>{tl.effacer}</button>
      {/if}
    </div>
    {#if texte.trim() === ''}
      <p class="k aide">{tl['aide-iphone']}</p>
    {:else}
      <p class="constat" aria-live="polite">
        {familles === null ? tl.chargement : ligneCompte(tl, lecture)}
      </p>
      {#if lecture.total > 0}
        <div class="lecture">
          {#each unites(lecture.signes) as u, k (k)}
            {#if u.mot === null}{@render signe(u.signes[0])}{:else}<span class="mot"
                >{#each u.signes as x, j (j)}{@render signe(x)}{/each}</span
              >{/if}
          {/each}
        </div>
        <p class="k legende">{tl.legende}</p>
      {/if}
      {#if lecture.mots.length > 0}
        <h2 class="titre-mots">{tl.mots}</h2>
        <ul class="mots">
          {#each lecture.mots as m (m.hanzi)}
            <li>
              <button class="mot-lu" onclick={() => void dire(m.hanzi)}>
                <span class="hz" lang="zh-Hans">{m.hanzi}</span>
                <span class="pin">{m.pinyin}</span>
                <span class="sens">{m.fr}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {:else}
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
    <p class="k aide" aria-live="polite">{ligneAide}</p>

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
                <span
                  >{#if r.racine === r.c}racine de sa famille{:else}famille <Hz
                      c={r.racine}
                      size={14}
                      pistes={[r.racine]}
                    />{/if}</span
                >
                <span class="st {s}">{LIBELLES_STATUT[s]}</span>
              </span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
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

  /* ---- les deux onglets : un filet, l'indigo de l'action sous l'onglet ouvert ---- */
  .onglets {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .onglets button {
    flex: 1;
    min-height: 44px;
    font-weight: 600;
    color: var(--mist);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .onglets button.on {
    color: var(--indigo);
    border-bottom-color: var(--indigo);
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
  /* ---- Lire le monde : le texte collé ---- */
  .champ.texte {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 0 12px 4px;
  }
  .champ textarea {
    width: 100%;
    min-height: 84px;
    padding: 12px 0 6px;
    border: 0;
    background: transparent;
    font-family: var(--hz);
    font-size: 19px;
    line-height: 1.5;
    color: var(--ink);
    resize: vertical;
    outline: none;
  }
  .champ textarea::placeholder {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--mist);
  }
  .effacer {
    align-self: flex-end;
    min-height: 36px;
    padding: 0 4px;
    font-size: 14px;
    color: var(--indigo);
  }
  .constat {
    margin: 12px 2px 8px;
    font-family: var(--head);
    font-weight: 700;
    font-size: 19px;
    line-height: 1.3;
    color: var(--ink);
  }
  .lecture {
    padding: 10px 8px 8px;
    background: var(--card);
    border-radius: 12px;
    line-height: 1.2;
  }
  .autre {
    white-space: pre-wrap;
    font-family: var(--hz);
    font-size: 24px;
    color: var(--ink2);
    vertical-align: top;
  }
  .car {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: top;
    min-width: 30px;
    padding: 2px 1px 0;
    color: var(--ink);
  }
  .car .c {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 26px;
    line-height: 1.15;
  }
  .car .sous {
    min-height: 13px;
    font-size: 10.5px;
    line-height: 13px;
    white-space: nowrap;
    color: var(--indigo);
  }
  .car.lu {
    color: var(--jade);
    border-radius: 6px;
  }
  .car.lu:active {
    background: var(--jade-soft);
  }
  /* un mot reconnu : ses deux caractères d'un tenant, soulignés d'un seul trait de jade */
  .mot {
    display: inline-flex;
    vertical-align: top;
    white-space: nowrap;
    margin: 0 1px;
  }
  .mot .car {
    padding-left: 0;
    padding-right: 0;
  }
  .mot .c {
    align-self: stretch;
    text-align: center;
    border-bottom: 2px solid var(--jade);
  }
  .legende {
    margin: 8px 2px 0;
    font-size: 13.5px;
    line-height: 1.4;
  }
  .titre-mots {
    margin: 16px 0 4px;
    font-family: var(--head);
    font-size: 17px;
  }
  .mots {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .mot-lu {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 8px 2px;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .mots li:first-child .mot-lu {
    border-top: 0;
  }
  .mot-lu .hz {
    font-size: 22px;
    color: var(--jade);
  }
  .mot-lu .pin {
    color: var(--indigo);
    font-weight: 600;
  }
  .mot-lu .sens {
    color: var(--ink);
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
