<script lang="ts">
  /**
   * Une mise en situation de l'examen, dessinée à plat (story 8.3, maquette validée le
   * 29 septembre 2026) : l'enseigne d'une boutique, le mot scotché sur une porte, la carte
   * d'un menu ou d'un étal, un billet, la bulle d'un message, la feuille d'une note, d'une
   * lettre, d'une affiche, d'un calendrier, d'un panneau. Le texte vient de `examens.json` ;
   * à partir de 24 px, chaque caractère se dessine depuis ses traits, plus petit il s'écrit
   * en police, comme un texte courant.
   *
   * Au repérage, les mots proposés se touchent sur le support : juste au jade, faux à
   * l'ocre, jamais au cinabre.
   *
   * Aux premiers examens (`pinyin`, décision du propriétaire du 29 septembre 2026, « jusqu'à
   * HSK 1 »), chaque caractère porte sa syllabe dessous, à la manière d'un ruby : petite, à
   * la brume, jamais au cinabre ; la ponctuation n'en a pas. Sur l'enseigne, la syllabe
   * s'écrit sous le caractère, sur la plaque. Les couleurs sont des jetons fixes (`--ex-*`) : le support est
   * un objet posé sur la page, à plat, sans ombre ni dégradé.
   */
  import Glyph from './Glyph.svelte';
  import { dessinBoutique, dessinPorte, type Traits } from './examen-dessins';
  import { decouperLigneAvecPinyin, grappesDeLigne, syllabesParCaractere, type Phrase, type Support } from './examens';

  let {
    support,
    traits,
    mots = [],
    etats = {},
    ontoucher,
    fini = false,
    reponse = null,
    placeholder = '',
    pinyin = false,
    entrees = []
  }: {
    support: Support;
    /** Les traits des caractères du support, pour l'enseigne dessinée en SVG. */
    traits: Traits;
    /** Au repérage : les mots proposés, à toucher sur le support. */
    mots?: readonly string[];
    /** L'état de chaque mot touché : juste ou faux. */
    etats?: Readonly<Record<number, 'ok' | 'ko'>>;
    ontoucher?: (k: number) => void;
    /** La question est close : plus rien ne se touche. */
    fini?: boolean;
    /** À la réplique, la réponse trouvée, qui s'écrit dans le fil ; `null` avant. */
    reponse?: Phrase | null;
    /** À la réplique, la place de la réponse, avant qu'elle soit trouvée. */
    placeholder?: string;
    /** Le pinyin sous chaque caractère, aux premiers examens (`pinyinDeQuestion`). */
    pinyin?: boolean;
    /** Les mots de la glose de la série : avec le pinyin, un mot ne se coupe pas en fin de ligne. */
    entrees?: readonly string[];
  } = $props();

  const genre = $derived(support.genre);
  const lignes = $derived(support.lignes.map((l) => l.zh));
  /** Les syllabes de chaque ligne, caractère par caractère ; `null` sans pinyin. */
  const syllabes = $derived(support.lignes.map((l) => (pinyin ? syllabesParCaractere(l) : null)));
  /** Les syllabes d'une moitié de ligne, du caractère `debut` au caractère `fin`. */
  const tranche = (py: readonly (string | null)[] | null, debut: number, fin?: number): (string | null)[] | null =>
    py === null ? null : py.slice(debut, fin);
  /**
   * Les lignes à deux colonnes : ce qu'on vend ou ce qu'on paie, et son prix ; puis le rang
   * du deux-points, en caractères, pour partager les syllabes.
   */
  const colonnes = (zh: string): [string, string, number] | null => {
    const k = zh.indexOf('：');
    return k > 0 && k < zh.length - 1 ? [zh.slice(0, k), zh.slice(k + 1), [...zh.slice(0, k)].length] : null;
  };
  const plusLongue = $derived(Math.max(1, ...lignes.map((l) => [...l].length)));
  /** La taille des caractères d'un support : qu'ils tiennent, dessinés, dans sa largeur. */
  function taille(max: number, largeur: number): number {
    return Math.max(16, Math.min(max, Math.floor(largeur / plusLongue)));
  }
  const estHz = (c: string): boolean => /[㐀-鿿]/.test(c);
</script>

{#snippet texte(zh: string, py: readonly (string | null)[] | null, size: number, couleur: string)}
  {#if py === null}
    {#each decouperLigneAvecPinyin(zh, null, mots) as m, i (i)}{@render morceau(m, size, couleur)}{/each}
  {:else}
    <!-- avec le pinyin, un caractère et sa ponctuation ne se séparent pas en fin de ligne -->
    {#each grappesDeLigne(zh, py, mots, entrees) as g, j (j)}
      <span class="grappe">{#each g as m, i (i)}{@render morceau(m, size, couleur)}{/each}</span>
    {/each}
  {/if}
{/snippet}

{#snippet morceau(m: { t: string; mot: number; py: (string | null)[] | null }, size: number, couleur: string)}
  {#if m.mot >= 0}
    <button
      class="mot"
      class:ok={etats[m.mot] === 'ok'}
      class:ko={etats[m.mot] === 'ko'}
      disabled={fini}
      aria-label={m.t}
      onclick={() => ontoucher?.(m.mot)}
    >
      {@render mot(m.t, m.py, size, couleur)}
    </button>
  {:else}
    {@render mot(m.t, m.py, size, couleur)}
  {/if}
{/snippet}

{#snippet mot(t: string, py: readonly (string | null)[] | null, size: number, couleur: string)}
  {#each [...t] as c, k (k)}
    {#if py !== null}
      <!-- le caractère, sa syllabe dessous ; sous la ponctuation, la place vide garde l'alignement -->
      <span class="rubi"
        >{@render signe(c, size, couleur)}<span class="rt" aria-hidden="true" style="font-size:{Math.max(9.5, Math.round(size * 0.5))}px"
          >{py[k] ?? ''}</span
        ></span
      >
    {:else}
      {@render signe(c, size, couleur)}
    {/if}
  {/each}
{/snippet}

{#snippet signe(c: string, size: number, couleur: string)}
  {#if estHz(c) && size >= 24}
    <Glyph char={c} {size} write={false} color={couleur} seul />
  {:else if estHz(c)}
    <span class="hz" style="font-size:{size}px;color:{couleur}">{c}</span>
  {:else}
    <span class="ponct" style="font-size:{Math.round(size * 0.8)}px;color:{couleur}">{c}</span>
  {/if}
{/snippet}

<div class="support {genre}">
  {#if genre === 'enseigne'}
    <!-- une boutique, son enseigne dessinée depuis ses traits -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <svg class="dessin" viewBox="0 0 357 196" role="img" aria-label={lignes.join('')}>{@html dessinBoutique(lignes[0] ?? '', traits, syllabes[0] ?? null)}</svg>
    {#if mots.length > 0 || lignes.length > 1}
      <div class="sous-enseigne">
        {#each lignes as l, i (i)}<div class="ligne">{@render texte(l, syllabes[i], 22, 'var(--ex-encre)')}</div>{/each}
      </div>
    {/if}
  {:else if genre === 'note'}
    <!-- une porte fermée, un mot scotché dessus -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <svg class="fond" viewBox="0 0 357 250" preserveAspectRatio="xMidYMin slice" aria-hidden="true">{@html dessinPorte()}</svg>
    <div class="papier">
      {#each lignes as l, i (i)}
        <div class="ligne">{@render texte(l, syllabes[i], taille(30, 280), 'var(--ex-encre)')}</div>
      {/each}
    </div>
  {:else if genre === 'message' || genre === 'lettre'}
    <div class="fil" class:lettre={genre === 'lettre'}>
      <div class="qui">
        <span class="av" aria-hidden="true"></span>
        <div class="msg">
          {#each lignes as l, i (i)}<div class="ligne flux">{@render texte(l, syllabes[i], 21, 'var(--ex-encre)')}</div>{/each}
        </div>
      </div>
      {#if reponse !== null}
        <div class="moi rep apparait">{@render mot(reponse.zh, pinyin ? syllabesParCaractere(reponse) : null, 21, 'var(--ex-encre)')}</div>
      {:else if placeholder !== ''}
        <div class="moi">{placeholder}</div>
      {/if}
    </div>
  {:else if genre === 'menu' || genre === 'etal' || genre === 'affiche'}
    <!-- la carte d'un menu, d'un étal ou d'une affiche : l'article, puis son prix -->
    {#if genre === 'etal'}
      <svg class="auvent" viewBox="0 0 360 26" preserveAspectRatio="none" aria-hidden="true">
        {#each Array.from({ length: 8 }, (_, k) => k) as k (k)}
          <path d="M{k * 45} 0h22.5v18q-11.25 8-22.5 0z" fill="var(--ex-azur)" />
          <path d="M{k * 45 + 22.5} 0h22.5v18q-11.25 8-22.5 0z" fill="var(--ex-papier)" />
        {/each}
        <path d="M0 1H360" stroke="var(--ex-encre)" stroke-width="2" />
      </svg>
    {/if}
    <div class="carte">
      {#each lignes as l, i (i)}
        {@const c = colonnes(l)}
        {#if c}
          <div class="rangee">
            <span class="art">{@render texte(c[0], tranche(syllabes[i], 0, c[2]), 22, 'var(--ex-encre)')}</span>
            <span class="points" aria-hidden="true"></span>
            <span class="prix">{@render texte(c[1], tranche(syllabes[i], c[2] + 1), 22, 'var(--ex-encre)')}</span>
          </div>
        {:else}
          <div class="ligne centre">{@render texte(l, syllabes[i], 24, 'var(--ex-encre)')}</div>
        {/if}
      {/each}
    </div>
  {:else if genre === 'billet'}
    <!-- un billet de train : le talon au pigment, les lignes, les encoches -->
    <div class="billet-corps">
      <div class="talon" aria-hidden="true"></div>
      <div class="billet-lignes">
        {#each lignes as l, i (i)}
          <div class="ligne" class:grande={i === 0}>{@render texte(l, syllabes[i], i === 0 ? 26 : 21, 'var(--ex-encre)')}</div>
        {/each}
      </div>
    </div>
  {:else if genre === 'calendrier'}
    <!-- une page de calendrier : ses anneaux, le jour en grand -->
    <div class="page">
      <div class="anneaux" aria-hidden="true"><i></i><i></i></div>
      {#each lignes as l, i (i)}
        <div class="ligne centre" class:grande={i === 0}>{@render texte(l, syllabes[i], i === 0 ? taille(40, 240) : 22, 'var(--ex-encre)')}</div>
      {/each}
    </div>
  {:else}
    <!-- un panneau de bois sur ses deux poteaux -->
    <div class="panneau">
      {#each lignes as l, i (i)}
        <div class="ligne centre">{@render texte(l, syllabes[i], taille(30, 260), 'var(--ex-papier)')}</div>
      {/each}
    </div>
    <div class="poteaux" aria-hidden="true"><i></i><i></i></div>
  {/if}
</div>

<style>
  .support {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--ex-papier);
  }
  .dessin {
    display: block;
    width: 100%;
    height: auto;
  }
  .ligne {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1px;
    line-height: 1.2;
  }
  .centre {
    justify-content: center;
  }
  .ponct {
    font-family: var(--hz);
    font-weight: 500;
  }
  .hz {
    font-weight: 500;
  }
  /* le pinyin sous le caractère, à la manière d'un ruby : petit, à la brume */
  .rubi {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: top;
    line-height: 1.2;
    padding: 0 1px;
  }
  .grappe {
    display: inline-flex;
    align-items: center;
    vertical-align: top;
    white-space: nowrap;
  }
  .rt {
    display: block;
    min-height: 1.25em;
    line-height: 1.25;
    font-family: var(--sans);
    font-weight: 400;
    color: var(--mist);
    white-space: nowrap;
  }
  /* sur le panneau de bois, l'encre claire du panneau */
  .pancarte .rt {
    color: var(--ex-filet);
  }
  /* un mot à toucher : la zone se voit au toucher, juste au jade, faux à l'ocre */
  .mot {
    border-radius: 8px;
    padding: 3px 2px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    border: 2px solid transparent;
    transition: border-color 0.15s;
  }
  .mot:disabled {
    cursor: default;
  }
  .mot.ok {
    border-color: var(--jade);
  }
  .mot.ko {
    border-color: var(--ocre);
  }

  /* l'enseigne : ce qui se touche passe dessous, sur une plaque */
  .sous-enseigne {
    padding: 8px 12px 10px;
    border-top: 1px solid var(--ex-filet);
    display: grid;
    gap: 4px;
    justify-items: center;
  }

  /* le mot sur la porte */
  .support.note {
    background: var(--ex-fond);
    min-height: 200px;
    padding: 22px 0 64px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  .fond {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .papier {
    position: relative;
    width: max-content;
    max-width: calc(100% - 40px);
    transform: rotate(-2.5deg);
    background: var(--ex-papier);
    border: 1.5px solid var(--ex-encre);
    border-radius: 3px;
    padding: 14px 10px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .papier::before {
    content: '';
    position: absolute;
    top: -9px;
    left: 50%;
    width: 56px;
    height: 16px;
    margin-left: -28px;
    background: var(--ex-scotch);
    border: 1px solid var(--grille);
    transform: rotate(3deg);
  }

  /* le message : la bulle de celui qui écrit, la place de la réponse */
  .fil {
    padding: 14px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .qui {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    width: 100%;
    gap: 8px;
  }
  /* une ligne de message se lit comme un texte : la ponctuation reste à son mot */
  .ligne.flux {
    display: block;
    line-height: 1.55;
  }
  .ligne.flux .mot {
    vertical-align: middle;
    min-height: 40px;
  }
  .av {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1.5px solid var(--ex-encre);
    background: var(--ex-abricot-pale);
    flex: none;
  }
  .msg {
    align-self: flex-start;
    max-width: 90%;
    background: var(--paper);
    border: 1.5px solid var(--line);
    border-radius: 4px 16px 16px 16px;
    padding: 8px 12px;
    display: grid;
    gap: 2px;
  }
  .lettre .msg {
    border-radius: 4px;
    max-width: 100%;
  }
  .lettre .av {
    display: none;
  }
  .lettre .msg .ligne {
    border-bottom: 1px solid var(--ex-filet);
  }
  .moi {
    align-self: flex-end;
    min-width: 90px;
    min-height: 42px;
    border: 1.5px dashed var(--grille);
    border-radius: 16px 4px 16px 16px;
    display: grid;
    place-items: center;
    color: var(--ex-gris);
    font-size: 13px;
    padding: 6px 12px;
  }
  .moi.rep {
    border: 1.5px solid var(--jade);
    display: flex;
  }

  /* la carte d'un menu, d'un étal, d'une affiche */
  .auvent {
    display: block;
    width: 100%;
    height: 26px;
  }
  .carte {
    margin: 12px;
    border: 3px double var(--ex-encre);
    border-radius: 6px;
    padding: 10px 12px;
    display: grid;
    gap: 2px;
  }
  .affiche .carte {
    border: 0;
    border-top: 10px solid var(--ex-peche);
    border-radius: 0;
  }
  .rangee {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .points {
    flex: 1;
    border-bottom: 2px dotted var(--ex-gris);
    align-self: center;
    min-width: 12px;
  }
  .art,
  .prix {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
  }

  /* le billet : le talon au pigment, deux encoches */
  .support.billet {
    background: var(--ex-fond);
    padding: 16px;
  }
  .billet-corps {
    position: relative;
    display: flex;
    background: var(--ex-papier);
    border: 1.5px solid var(--ex-encre);
    border-radius: 10px;
    overflow: hidden;
  }
  .billet-corps::before,
  .billet-corps::after {
    content: '';
    position: absolute;
    left: 38px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--ex-fond);
    border: 1.5px solid var(--ex-encre);
  }
  .billet-corps::before {
    top: -10px;
  }
  .billet-corps::after {
    bottom: -10px;
  }
  .talon {
    width: 46px;
    flex: none;
    background: var(--ex-azur);
    border-right: 1.5px dashed var(--ex-encre);
  }
  .billet-lignes {
    padding: 10px 14px;
    display: grid;
    gap: 2px;
  }

  /* la page de calendrier */
  .support.calendrier {
    background: var(--ex-fond);
    padding: 14px 40px;
  }
  .page {
    position: relative;
    background: var(--ex-papier);
    border: 1.5px solid var(--ex-encre);
    border-top: 18px solid var(--ex-azur);
    border-radius: 6px;
    padding: 12px 10px 14px;
    display: grid;
    gap: 4px;
  }
  .anneaux {
    position: absolute;
    top: -26px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
  }
  .anneaux i {
    width: 10px;
    height: 18px;
    border: 2px solid var(--ex-encre);
    border-radius: 5px;
    background: var(--ex-papier);
  }

  /* le panneau de bois */
  .support.pancarte {
    background: var(--ex-fond);
    padding: 16px 20px 0;
  }
  .panneau {
    position: relative;
    z-index: 1;
    background: var(--ex-bois);
    border: 2px solid var(--ex-encre);
    border-radius: 6px;
    padding: 12px 10px;
    display: grid;
    gap: 4px;
  }
  .poteaux {
    display: flex;
    justify-content: space-around;
    height: 30px;
  }
  .poteaux i {
    width: 12px;
    background: var(--ex-bois-fonce);
    border: 2px solid var(--ex-encre);
    border-top: 0;
  }
  .apparait {
    animation: apparait 0.5s ease both;
  }
  @keyframes apparait {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .apparait {
      animation: none;
    }
  }
</style>
