<script lang="ts" module>
  /**
   * Les quatre cases du menu. Leurs caractères sont un choix d'interface (温 réviser,
   * 玩 jouer, 读 lire, 林 la forêt) ; leurs traits et leur pinyin viennent de l'export,
   * comme pour tout caractère. Un caractère absent de l'export laisse son picto au trait.
   */
  export type CaseId = 'reviser' | 'jouer' | 'lire' | 'foret';
  export const CASES: readonly { id: CaseId; c: string; t: string }[] = [
    { id: 'reviser', c: '温', t: 'Réviser' },
    { id: 'jouer', c: '玩', t: 'Jouer' },
    { id: 'lire', c: '读', t: 'Lire' },
    { id: 'foret', c: '林', t: 'Ma forêt' }
  ];
</script>

<script lang="ts">
  /**
   * Le menu : la maison. Il remplace l'écran Aujourd'hui et la barre d'onglets, et tient
   * sur un écran sans défiler. Trois blocs : l'en-tête (la marque, Réglages), la carte du
   * jour (le caractère dans son 米字格, Tao sur le chemin, le seul bouton plein), puis
   * quatre cases identiques. Tout ce qui se décide (état, libellés, phrases de Tao) vient
   * de `parcours.ts` ; ce composant ne fait qu'afficher et charger le contenu.
   *
   * Le cinabre ne marque que la brique nouvelle. Aucune animation sur les cases ni sur les
   * boutons : l'appui ne change que le fond. Le caractère s'écrit au pinceau à l'arrivée
   * et au toucher, Tao saute quand on la touche ; rien ne bouge si l'on réduit les
   * animations.
   */
  import Bulle from './Bulle.svelte';
  import Embleme from './Embleme.svelte';
  import Voeu from './Voeu.svelte';
  import { pistes as pistesFete, type FeteDuJour } from './fetes';
  import type { Fetes } from './content';
  import Glyph from './Glyph.svelte';
  import Marque from './Marque.svelte';
  import Pinceaux from './Pinceaux.svelte';
  import Tao from './Tao.svelte';
  import { aAudio, dire, manifesteOnce, type Manifeste } from './audio';
  import { contenu, fiche, lecon, toutesLesFamilles, traitsDe, type Famille } from './content';
  import { caracteresLus } from './foret';
  import { glyph, type StrokeData } from './glyph';
  import { MINUTES_MAX, MINUTES_MIN, propose } from './jeux';
  import { caseReviser, carteDuMenu, menu, traitsDeLAjout } from './parcours';
  import { familleDepart, fichesDepart } from './premiere';
  import { cartesDues, type Progress } from './session';
  import { stade } from './tao';

  let {
    p,
    fete = null,
    fetes = null,
    ondemarrer,
    oncase,
    onreglages
  }: {
    p: Progress;
    /** La fête du jour : le vœu prend la place de la marque, l'emblème porte le caractère. */
    fete?: FeteDuJour | null;
    fetes?: Fetes | null;
    /** Le bouton plein (ou en contour) : ce qu'il ouvre se décide dans `parcours.ts`. */
    ondemarrer: () => void;
    oncase: (id: CaseId) => void;
    onreglages: () => void;
  } = $props();

  /* ---------- la carte du jour ---------- */

  type Carte = {
    c: string;
    pinyin: string;
    fr: string;
    parts: string[];
    /** Les briques ajoutées, les seules en cinabre. Vide en rattrapage. */
    nouveau: number[];
    pistes: string[];
  };

  let carte = $state<Carte | null>(null);
  let traits = $state<StrokeData | null>(null);
  let cinabre = $state<number[]>([]);
  /** Chaque toucher réécrit le caractère : la clé change, le dessin repart. */
  let ecriture = $state(0);

  /** D'où vient le caractère, en une clé : la carte ne se recharge que si elle change. */
  const source = $derived.by(() => {
    const s = carteDuMenu(p);
    if (s.source === 'revision') {
      return `r:${cartesDues(p, new Date(), 1)[0]?.id ?? ''}`;
    }
    return s.source === 'lecon' ? `l:${p.parcours ?? ''}:${s.jour}` : 'p';
  });

  async function lire(cle: string): Promise<Carte | null> {
    if (cle === 'p') {
      const f = fichesDepart(await familleDepart())[0];
      return f ? { c: f.c, pinyin: f.pinyin, fr: f.fr, parts: f.parts, nouveau: [], pistes: [] } : null;
    }
    if (cle.startsWith('r:')) {
      const c = cle.slice(2);
      const f = c === '' ? null : await fiche(c);
      return f ? { c: f.c, pinyin: f.pinyin, fr: f.fr, parts: f.parts, nouveau: [], pistes: [] } : null;
    }
    const [, choisi, jour] = cle.split(':');
    const l = await lecon(choisi === '' ? null : choisi, Number(jour));
    const f = l.composes[0] ?? l.brique;
    if (!f) return null;
    /* Un jour sans composé : la brique elle-même est l'élément ajouté. */
    const nouveau = f.parts.length === 0 ? [] : f.nouveau;
    return { c: f.c, pinyin: f.pinyin, fr: f.fr, parts: f.parts, nouveau, pistes: l.pistes };
  }

  $effect(() => {
    const cle = source;
    let vivant = true;
    void (async () => {
      const c = await lire(cle);
      const d = c === null ? null : await traitsDe(c.c, c.pistes);
      let z: number[] = [];
      if (c !== null && d !== null && c.nouveau.length > 0) {
        const ds = await Promise.all(c.parts.map((x) => traitsDe(x, c.pistes).catch(() => null)));
        z = traitsDeLAjout(c.parts, c.nouveau, ds.map((x) => x?.s.length ?? null), d.s.length);
      }
      if (!vivant) return;
      carte = c;
      traits = d;
      cinabre = z;
    })().catch(() => {
      if (vivant) carte = null;
    });
    return () => {
      vivant = false;
    };
  });

  /** Le manifeste audio : il dit si le caractère a une voix. */
  let son = $state<Manifeste | null>(null);
  $effect(() => {
    let vivant = true;
    void manifesteOnce()
      .then((m) => {
        if (vivant) son = m;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /** Toucher le caractère : il se réécrit au pinceau, et se dit. */
  function toucher(): void {
    if (!carte) return;
    ecriture += 1;
    void dire(carte.c);
  }

  const m = $derived(menu(p, carte?.c ?? ''));
  /** Un jour sans composé : la décomposition montre la brique seule, en cinabre. */
  const briqueSeule = $derived(carte !== null && carte.parts.length === 0 && m.etat !== 'rattrapage' && m.etat !== 'premiere');

  /* ---------- Tao sur le chemin ---------- */

  let phrase = $state(0);
  let saute = $state(false);
  const taoStade = $derived(stade(p.tao.croissance));
  const pct = $derived(((m.position + 0.5) / Math.max(1, m.coups.length)) * 100);
  const aDroite = $derived(pct < 55);
  /* Un jour de fête, Tao commence par la fête, puis revient à la journée. */
  const phrases = $derived(fete && fete.tao.length > 0 ? [fete.tao[0], ...m.phrases, ...fete.tao.slice(1)] : m.phrases);
  const texte = $derived(phrases.length === 0 ? '' : phrases[phrase % phrases.length]);

  function toucherTao(): void {
    phrase += 1;
    saute = false;
    requestAnimationFrame(() => {
      saute = true;
    });
  }

  /* ---------- les cases ---------- */

  let casesTraits = $state<Record<string, StrokeData | null>>({});
  let casesPinyin = $state<Record<string, string>>({});
  let familles = $state<Famille[]>([]);
  let contes = $state<number | null>(null);

  $effect(() => {
    let vivant = true;
    for (const x of CASES) {
      void traitsDe(x.c)
        .then((d) => {
          if (vivant) casesTraits = { ...casesTraits, [x.c]: d };
        })
        .catch(() => undefined);
      void fiche(x.c)
        .then((f) => {
          if (vivant && f && f.pinyin !== '') casesPinyin = { ...casesPinyin, [x.c]: f.pinyin };
        })
        .catch(() => undefined);
    }
    void toutesLesFamilles()
      .then((l) => {
        if (vivant) familles = l;
      })
      .catch(() => undefined);
    void contenu()
      .then((i) => {
        if (vivant) contes = i.contes.length;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const reviser = $derived(caseReviser(p));
  const lus = $derived(caracteresLus(familles, p.cartes));

  function info(id: CaseId): string {
    if (id === 'reviser') return reviser.info;
    if (id === 'jouer') return propose(p, p.day) ? 'Tao propose un jeu' : `${MINUTES_MIN} à ${MINUTES_MAX} minutes`;
    if (id === 'lire') {
      if (contes === null) return '';
      return contes > 0 ? `${contes} conte${contes > 1 ? 's' : ''}` : 'Les contes arrivent';
    }
    return `${lus} lu${lus > 1 ? 's' : ''}`;
  }

  /** Les pictos au trait, tous du même dessin : la place d'un caractère que l'export n'a pas. */
  const PICTOS: Record<CaseId, string> = {
    reviser: '<rect x="3.5" y="7.5" width="12" height="13.5" rx="2"/><path d="M8 3.5h10.5a2 2 0 0 1 2 2V17"/>',
    jouer: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="8.5" cy="15.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/></g>',
    lire: '<path d="M3 5.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 5.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
    foret: '<path d="M12 21.5V16"/><path d="M12 2.5l5.5 7.5h-2.8l4.3 6H5l4.3-6H6.5z"/>'
  };
</script>

<main class="menu">
  <header class="mhead">
    {#if fete}
      <div class="marque"><Voeu {fete} pistes={fetes ? pistesFete(fetes, '福') : []} /></div>
    {:else}
      <div class="marque">
        <span class="logo"><Marque size={30} /></span>
        <span class="nom">Wenlu</span>
        <span class="cn hz">文路</span>
      </div>
    {/if}
    <button class="icone" aria-label="Réglages" onclick={onreglages}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>
  </header>

  <section class="jour" class:fete={fete !== null}>
    <div class="jour-haut">
      <button
        class="mizi"
        aria-label={carte ? `Réécrire et écouter ${carte.c}` : 'Le caractère du jour'}
        onclick={toucher}
      >
        {#if fete}
          <!-- Un jour de fête, l'emblème (la lune, la rosace) devient la case du caractère. -->
          <span class="emb-pos">
            {#key ecriture}
              <Embleme fete={fete.id} c={carte?.c ?? ''} {cinabre} pistes={carte?.pistes ?? []} size={160} />
            {/key}
          </span>
        {:else}
        <!-- Le 米字格 : la grille d'exercice des écoliers, en filets fins. -->
        <svg class="grille" width="100%" height="100%" viewBox="0 0 104 104" aria-hidden="true">
          <rect x=".5" y=".5" width="103" height="103" rx="14" />
          <path d="M52 1v102M1 52h102M1 1l102 102M103 1L1 103" />
        </svg>
        {/if}
        {#if carte && traits && !fete}
          {#key ecriture}
            <span class="trace">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html glyph(carte.c, traits, 108, { write: true, cinabre })}
            </span>
          {/key}
        {/if}
      </button>
      <div class="jour-txt">
        <div class="surtitre">{m.surtitre}</div>
        {#if carte}
          <div class="py">
            {carte.pinyin}
            <button
              class="dire"
              aria-label="Écouter {carte.pinyin}"
              disabled={!aAudio(son, carte.c)}
              onclick={() => carte && void dire(carte.c)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
                <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
              </svg>
            </button>
          </div>
          {#if carte.fr !== ''}<div class="sens">{carte.fr}</div>{/if}
          <div class="dec">
            {#if briqueSeule}
              <span class="part z"><Glyph char={carte.c} size={22} write={false} color="var(--zhu)" pistes={carte.pistes} /></span>
            {:else}
              {#each carte.parts as part, i (part + i)}
                {#if i > 0}<span class="op">+</span>{/if}
                <span class="part" class:z={carte.nouveau.includes(i)}>
                  <Glyph
                    char={part}
                    size={22}
                    write={false}
                    color={carte.nouveau.includes(i) ? 'var(--zhu)' : 'var(--ink)'}
                    pistes={carte.pistes}
                  />
                </span>
              {/each}
            {/if}
            <span class="k">{m.brique}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="chemin">
      <button
        class="marcheur"
        class:saute
        style="left:{pct.toFixed(2)}%"
        aria-label="Tao"
        onclick={toucherTao}
        onanimationend={() => (saute = false)}
      >
        <Tao stade={taoStade} posture={m.tao.posture} humeur={m.tao.humeur} size={56} />
      </button>
      {#if texte !== ''}
        {#key texte}
          <Bulle
            {texte}
            cote={aDroite ? 'droite' : 'gauche'}
            style={aDroite
              ? `top:13px;left:calc(${pct.toFixed(2)}% + 34px)`
              : `top:13px;right:calc(${(100 - pct).toFixed(2)}% + 34px)`}
          />
        {/key}
      {/if}
      <Pinceaux coups={m.coups} label={m.ligne} />
      <div class="pas">
        <span>{m.ligne}</span>
        {#if m.duree !== ''}<span class="duree">{m.duree}</span>{/if}
      </div>
    </div>

    <button class="btn pilule" class:ghost={!m.plein} onclick={ondemarrer}>
      {m.bouton}
      {#if m.plein}
        <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      {/if}
    </button>
  </section>

  <nav class="cases" aria-label="Activités">
    {#each CASES as x (x.id)}
      <button class="case" onclick={() => oncase(x.id)}>
        <span class="haut">
          <span class="gl">
            {#if casesTraits[x.c]}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html glyph(x.c, casesTraits[x.c] ?? undefined, 46, { write: false, color: 'var(--tile-fg, var(--indigo))', label: x.t })}
            {:else}
              <span class="picto">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html `<svg viewBox="0 0 24 24" aria-hidden="true">${PICTOS[x.id]}</svg>`}
              </span>
            {/if}
          </span>
          {#if casesPinyin[x.c]}<span class="cpy">{casesPinyin[x.c]}</span>{/if}
        </span>
        <span class="titre">{x.t}</span>
        <span class="info">{info(x.id)}</span>
      </button>
    {/each}
  </nav>
</main>

<style>
  /* Le menu tient sur 393 × 660 sans défiler : les cases prennent le bas, le reste suit. */
  .menu {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    padding: calc(env(safe-area-inset-top) + 8px) 20px calc(env(safe-area-inset-bottom) + 18px);
  }
  .menu > * {
    flex-shrink: 0;
  }

  /* ---- un jour de fête : l'emblème déborde de la case, le texte s'écarte ---- */
  .jour.fete {
    margin-top: 14px;
  }
  .jour.fete .jour-haut {
    gap: 28px;
  }
  .jour.fete .mizi {
    background: transparent;
    overflow: visible;
  }
  .emb-pos {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    line-height: 0;
    pointer-events: none;
  }

  /* ---- l'en-tête ---- */
  .mhead {
    display: flex;
    align-items: center;
    min-height: 44px;
    margin: 0 -10px 8px 0;
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
  }
  .logo {
    line-height: 0;
    color: var(--ink);
  }
  .nom {
    font-family: var(--head);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: -0.035em;
    line-height: 1;
  }
  .cn {
    color: var(--mist);
    font-size: 16px;
  }
  .icone {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--ink2);
  }
  .icone:active {
    background: var(--card);
  }
  .icone svg {
    width: 24px;
    height: 24px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---- la carte du jour ---- */
  .jour {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .jour-haut {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .mizi {
    position: relative;
    width: 116px;
    height: 116px;
    flex-shrink: 0;
    line-height: 0;
    background: var(--card);
    border-radius: 16px;
  }
  .grille {
    position: absolute;
    inset: 0;
  }
  .grille rect,
  .grille path {
    fill: none;
    stroke: var(--grille, var(--line));
    stroke-width: 1;
  }
  .grille path {
    stroke-dasharray: 3 4;
  }
  .trace {
    position: absolute;
    left: 4px;
    top: 4px;
  }
  .jour-txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .surtitre {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
    line-height: 1.3;
  }
  .py {
    font-family: var(--head);
    font-weight: 700;
    font-size: 36px;
    letter-spacing: -0.04em;
    line-height: 1;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .dire {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--mist);
    border-radius: 50%;
  }
  .dire:active {
    background: var(--line);
    color: var(--ink);
  }
  .dire:disabled {
    opacity: 0.4;
  }
  .dire svg {
    width: 21px;
    height: 21px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sens {
    font-size: 17px;
    color: var(--ink2);
    line-height: 1.2;
  }
  .dec {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 6px;
    margin-top: 8px;
  }
  .dec .op {
    font-family: var(--head);
    font-size: 15px;
    color: var(--mist);
  }
  .dec .part {
    display: inline-flex;
    line-height: 0;
  }
  .dec .k {
    margin-left: 2px;
  }

  /* ---- le chemin : les coups de pinceau, Tao qui marche, sa bulle ---- */
  .chemin {
    position: relative;
    padding-top: 56px;
  }
  .marcheur {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    line-height: 0;
  }
  .marcheur.saute {
    animation: saute 0.5s cubic-bezier(0.2, 1.4, 0.5, 1) 2;
  }
  @keyframes saute {
    0% {
      transform: translateX(-50%) translateY(0);
    }
    50% {
      transform: translateX(-50%) translateY(-18px);
    }
    100% {
      transform: translateX(-50%) translateY(0);
    }
  }
  .pas {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 9px;
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .duree {
    color: var(--mist);
    white-space: nowrap;
  }

  /* ---- le bouton unique, en pilule ; sans animation, l'appui ne change que le fond ---- */
  .pilule {
    border-radius: 999px;
    min-height: 54px;
    margin-top: 4px;
  }
  .pilule:not(.ghost):active {
    background: var(--ink);
  }
  .pilule.ghost {
    border-width: 1.5px;
  }
  .pilule.ghost:active {
    background: var(--card);
  }
  .fleche {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---- les quatre cases : identiques, colorées par les variables --tile-* ---- */
  .cases {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    margin-top: auto;
    padding-top: 14px;
  }
  .case {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 104px;
    min-width: 0;
    padding: 10px 14px 12px;
    background: var(--tile-bg, var(--card));
    border: 1px solid var(--tile-bd, transparent);
    border-radius: 20px;
    text-align: left;
  }
  .case:active {
    background: var(--line);
  }
  .haut {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
  }
  .gl {
    line-height: 0;
    margin-left: -4px;
    color: var(--tile-fg, var(--indigo));
  }
  .picto {
    display: inline-block;
    margin: 8px 0 8px 6px;
  }
  .picto :global(svg) {
    width: 30px;
    height: 30px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cpy {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--tile-ink2, var(--ink2));
    margin-top: 6px;
  }
  .titre {
    font-family: var(--head);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin-top: auto;
    color: var(--tile-ink, var(--ink));
  }
  .info {
    font-size: 14px;
    color: var(--tile-ink2, var(--ink2));
    line-height: 1.3;
    margin-top: 2px;
    min-height: 18px;
  }

  @media (prefers-reduced-motion: reduce) {
    .marcheur.saute {
      animation: none;
    }
  }
</style>
