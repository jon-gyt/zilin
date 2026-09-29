<script lang="ts">
  /**
   * Le pavé « Écrire au doigt » du dictionnaire (maquette `maquettes/dictionnaire.html`,
   * écran 5) : on trace un caractère à l'encre, au doigt ou à la souris ; après chaque trait,
   * les candidats s'affinent (le moteur tourne sur l'appareil, dans un Web Worker :
   * `ecriture/`). « Annuler le trait » retire le dernier, « Effacer » vide le pavé. Toucher un
   * candidat l'émet (`onchoisir`) : l'écran qui accueille le pavé l'écrit dans son champ et
   * ouvre sa fiche.
   *
   * Les candidats sont dessinés depuis leurs traits (style 楷), par le composant de glyphe de
   * l'app, jamais depuis une police : un candidat dont on n'a pas les traits n'est pas montré.
   * `traitsDe` dit où les lire (par défaut l'export, `content.traitsDe` ; le dictionnaire y
   * passera ses lots) et `pinyinDe`, s'il est donné, le pinyin écrit dessous.
   *
   * L'écriture au doigt vient avec Wenlu complet : `ouvert` le dit, calculé par l'écran hôte
   * (`droits.wenluComplet`, jamais vrai sur le web). Fermé, la même place le dit en une ligne,
   * avec un lien (`ondecouvrir`) : pas de cadenas, rien de grisé ailleurs, et aucun gabarit
   * n'est lu.
   *
   * Charte : l'encre pour le tracé, l'indigo pour l'action et le premier candidat ; pas de
   * cinabre (rien n'est ajouté ici), ni ombre, ni dégradé, ni doré. Rien ne s'anime : le
   * tracé suit le doigt, c'est tout. Des cibles de 44 px au moins. Les textes viennent du
   * pipeline (`ecrans.json`, écran `ecrire`).
   */
  import Glyph from './Glyph.svelte';
  import { traitsDe as traitsDeLExport } from './content';
  import { ecransOnce, remplir, SANS_ECRANS, type TextesEcrire } from './ecrans';
  import { adresseGabarits, creerReconnaisseur, type Reconnaisseur } from './ecriture/reconnaisseur';
  import { CANDIDATS, type Point } from './ecriture/reconnaissance';
  import { nomAccessible, type StrokeData } from './glyph';

  let {
    ouvert,
    onchoisir,
    ondecouvrir,
    traitsDe = (c: string) => traitsDeLExport(c),
    pinyinDe,
    reconnaisseur,
    textes
  }: {
    /** Wenlu complet : le pavé s'ouvre. Sinon, une ligne et un lien à sa place. */
    ouvert: boolean;
    /** Le caractère touché parmi les candidats. */
    onchoisir: (c: string) => void;
    /** « Découvrir Wenlu complet », quand le pavé est fermé. */
    ondecouvrir?: () => void;
    /** Les traits d'un candidat, pour le dessiner ; `null` : il n'est pas montré. */
    traitsDe?: (c: string) => Promise<StrokeData | null>;
    /** Le pinyin écrit sous un candidat ; vide ou absent, rien dessous. */
    pinyinDe?: (c: string) => string | Promise<string>;
    /** Un reconnaisseur déjà ouvert (démonstration, tests) ; sinon le pavé ouvre le sien. */
    reconnaisseur?: Reconnaisseur;
    /** Les textes, s'ils sont déjà lus ; sinon ceux de `ecrans.json`. */
    textes?: TextesEcrire;
  } = $props();

  /** Le repère du pavé : 300 unités de côté, quelle que soit sa taille à l'écran. */
  const COTE = 300;

  type Montre = { c: string; donnees: StrokeData; pinyin: string };

  let lus = $state<TextesEcrire>(SANS_ECRANS.ecrire);
  const t = $derived(textes ?? lus);

  /* Le tracé : des tableaux simples, redessinés quand `dessin` change. */
  let traits: Point[][] = [];
  let courant: Point[] | null = null;
  let doigt: number | null = null;
  let dessin = $state(0);
  let nTraits = $state(0);

  let moteur = $state<Reconnaisseur | null>(null);
  let etat = $state<'chargement' | 'pret' | 'indisponible'>('chargement');
  let candidats = $state<Montre[]>([]);
  let demande = 0;

  let hote: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (textes) return;
    let vivant = true;
    void ecransOnce()
      .then((e) => {
        if (vivant) lus = e.ecrire;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /* Le moteur ne s'ouvre qu'avec le pavé : fermé, aucun gabarit n'est lu. */
  $effect(() => {
    if (!ouvert) return;
    let vivant = true;
    let propre: Reconnaisseur | null = null;
    etat = 'chargement';
    const pret = reconnaisseur
      ? Promise.resolve(reconnaisseur)
      : adresseGabarits().then((url) => {
          if (url === '') throw new Error('Export sans gabarits');
          propre = creerReconnaisseur(url);
          return propre;
        });
    void pret
      .then(async (r) => {
        await r.pret;
        if (!vivant) return;
        moteur = r;
        etat = 'pret';
        void mettreAJour();
      })
      .catch(() => {
        if (vivant) etat = 'indisponible';
      });
    return () => {
      vivant = false;
      moteur = null;
      (propre as Reconnaisseur | null)?.fermer();
    };
  });

  function point(e: PointerEvent): Point {
    const r = hote!.getBoundingClientRect();
    return [((e.clientX - r.left) * COTE) / r.width, ((e.clientY - r.top) * COTE) / r.height];
  }

  function poser(e: PointerEvent): void {
    if (doigt !== null || (e.pointerType === 'mouse' && e.button > 0)) return;
    e.preventDefault();
    hote!.setPointerCapture?.(e.pointerId);
    doigt = e.pointerId;
    courant = [point(e)];
    traits.push(courant);
    dessin++;
  }

  function glisser(e: PointerEvent): void {
    if (e.pointerId !== doigt || !courant) return;
    const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const x of evs.length ? evs : [e]) courant.push(point(x));
    dessin++;
  }

  function lever(e: PointerEvent): void {
    if (e.pointerId !== doigt) return;
    doigt = null;
    courant = null;
    nTraits = traits.length;
    dessin++;
    void mettreAJour();
  }

  function annuler(): void {
    if (doigt !== null) return;
    traits.pop();
    nTraits = traits.length;
    dessin++;
    void mettreAJour();
  }

  function effacer(): void {
    if (doigt !== null) return;
    traits = [];
    nTraits = 0;
    dessin++;
    void mettreAJour();
  }

  /** Les candidats du tracé tel qu'il est ; seule la dernière demande s'affiche. */
  async function mettreAJour(): Promise<void> {
    const ici = ++demande;
    if (traits.length === 0 || !moteur) {
      candidats = [];
      return;
    }
    const trouves = await moteur.reconnaitre(traits, CANDIDATS);
    if (trouves === null || ici !== demande) return;
    const montres = await Promise.all(
      trouves.map(async ({ c }) => {
        const [donnees, pinyin] = await Promise.all([
          traitsDe(c).catch(() => null),
          Promise.resolve(pinyinDe?.(c) ?? '').catch(() => '')
        ]);
        return donnees ? { c, donnees, pinyin } : null;
      })
    );
    if (ici !== demande) return;
    candidats = montres.filter((m): m is Montre => m !== null);
  }

  /** Un trait en chemin lissé : des quadratiques par les milieux, comme une encre. */
  function chemin(tr: Point[]): string {
    const f = (v: number) => v.toFixed(1);
    let d = `M${f(tr[0][0])} ${f(tr[0][1])}`;
    for (let k = 1; k < tr.length - 1; k++) {
      const mx = (tr[k][0] + tr[k + 1][0]) / 2;
      const my = (tr[k][1] + tr[k + 1][1]) / 2;
      d += `Q${f(tr[k][0])} ${f(tr[k][1])} ${f(mx)} ${f(my)}`;
    }
    const z = tr[tr.length - 1];
    return `${d}L${f(z[0])} ${f(z[1])}`;
  }

  const encre = $derived.by(() => {
    void dessin;
    return traits.map((tr) => (tr.length === 1 ? { point: tr[0], d: '' } : { point: null, d: chemin(tr) }));
  });

  const compte = $derived(
    nTraits === 0
      ? ''
      : nTraits === 1
        ? remplir(t['compte-un'], { c: candidats.length })
        : remplir(t.compte, { n: nTraits, c: candidats.length })
  );
</script>

{#if !ouvert}
  <div class="complet">
    <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
      <path d="M14.5 4.5l5 5L10 19l-5.5.5L5 14z" />
      <path d="M12.5 6.5l5 5" />
    </svg>
    <b>{t.complet}</b>
    <p>{t['complet-texte']}</p>
    {#if ondecouvrir}
      <button type="button" class="lien" onclick={ondecouvrir}>{t['complet-lien']}</button>
    {/if}
  </div>
{:else}
  <div class="cands" role="group" aria-label={t.candidats} aria-live="polite">
    {#if etat === 'indisponible'}
      <span class="vide-c">{t.indisponible}</span>
    {:else if etat === 'chargement'}
      <span class="vide-c">{t.chargement}</span>
    {:else if nTraits === 0}
      <span class="vide-c">{t.vide}</span>
    {:else}
      {#each candidats as m (m.c)}
        <button type="button" class="cand" onclick={() => onchoisir(m.c)}>
          <Glyph char={m.c} donnees={m.donnees} size={38} write={false} label={nomAccessible(m.c, m.pinyin)} />
          {#if m.pinyin}<small aria-hidden="true">{m.pinyin}</small>{/if}
        </button>
      {/each}
    {/if}
  </div>

  <div
    class="pave"
    role="application"
    aria-label={t.pave}
    bind:this={hote}
    onpointerdown={poser}
    onpointermove={glisser}
    onpointerup={lever}
    onpointercancel={lever}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <svg class="grille" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M0 0L100 100M100 0L0 100M50 0V100M0 50H100" />
    </svg>
    <svg class="encre" viewBox="0 0 {COTE} {COTE}" aria-hidden="true">
      {#each encre as e, i (i)}
        {#if e.point}
          <circle cx={e.point[0]} cy={e.point[1]} r="5" />
        {:else}
          <path d={e.d} />
        {/if}
      {/each}
    </svg>
  </div>
  <p class="pave-compte" aria-live="polite">{compte}</p>
  <div class="pave-actions">
    <button type="button" class="ctl" onclick={annuler} disabled={nTraits === 0}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.5 5H10a3.5 3.5 0 0 1 0 7H6" />
        <path d="M7.5 2.5L5 5l2.5 2.5" />
      </svg>
      {t.annuler}
    </button>
    <button type="button" class="ctl" onclick={effacer} disabled={nTraits === 0}>{t.effacer}</button>
  </div>
  <p class="aide">{t.aide}</p>
{/if}

<style>
  .cands {
    display: flex;
    gap: 6px;
    margin: 12px 0 10px;
    min-height: 70px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .cand {
    flex: none;
    width: 58px;
    min-height: 68px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--card);
    color: var(--ink);
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 2px;
    text-align: center;
    line-height: 0;
  }
  .cand:first-child {
    border-color: var(--indigo);
  }
  .cand:active {
    background: var(--indigo-soft);
  }
  .cand small {
    font-size: 11.5px;
    line-height: 1.2;
    color: var(--ink2);
  }
  .vide-c {
    align-self: center;
    font-size: 14px;
    color: var(--mist);
    padding: 0 2px;
  }
  .pave {
    position: relative;
    width: 100%;
    max-width: 340px;
    aspect-ratio: 1;
    margin: 0 auto;
    background: var(--card);
    border: 1.5px solid var(--grille);
    border-radius: 14px;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: crosshair;
  }
  .pave svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .grille path {
    fill: none;
    stroke: var(--grille);
    stroke-width: 0.55;
    stroke-dasharray: 2.4 2.4;
  }
  .encre path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .encre circle {
    fill: var(--ink);
  }
  .pave-compte {
    text-align: center;
    margin: 6px 0 0;
    min-height: 18px;
    font-size: 13px;
    color: var(--mist);
    font-variant-numeric: tabular-nums;
  }
  .pave-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 10px;
  }
  .ctl {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--indigo);
    background: var(--card);
    font-weight: 600;
    font-size: 14.5px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ctl:disabled {
    color: var(--mist);
  }
  .ctl svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .aide {
    margin: 10px 2px 6px;
    font-size: 14px;
    line-height: 1.4;
    color: var(--mist);
  }
  .complet {
    margin-top: 12px;
    background: var(--card);
    border-radius: 16px;
    padding: 16px;
    display: grid;
    gap: 8px;
  }
  .complet svg {
    width: 36px;
    height: 36px;
    stroke: var(--ink2);
    fill: none;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .complet b {
    font: 700 17px/1.3 var(--head);
    color: var(--ink);
  }
  .complet p {
    margin: 0;
    color: var(--ink2);
    font-size: 14.5px;
  }
  .lien {
    justify-self: start;
    color: var(--indigo);
    font: 600 16px/1.2 var(--sans);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    background: none;
    border: 0;
    padding: 0;
  }
</style>
