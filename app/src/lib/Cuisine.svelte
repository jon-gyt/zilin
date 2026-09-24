<script lang="ts">
  /**
   * La cuisine de Tao (story 4b.6), dans l'écran hôte des jeux : le choix d'un plat, la
   * recette que Tao lit, l'étal, puis Tao qui goûte.
   *
   * Tout le texte vient de `cuisine.json` (`cuisine.ts`) : le nom du plat, les étapes, ce
   * que Tao demande, le sens des mots de l'étal et ses phrases. Le nom du plat est dessiné
   * depuis les traits ; les étapes et les mots, des mots et des phrases, sont en Noto
   * Serif SC. Une recette ne s'ouvre que lorsque tous ses caractères sont acquis ; les
   * autres disent ce qu'il reste à lire, sans rien vendre.
   *
   * Chaque ingrédient est une question à choix, deux essais, notée par `grade` de
   * `srs.ts` : l'écran ne note rien lui-même. Un ingrédient manqué n'est pas noté
   * (`jeux.evenementsANoter`) : prendre un mot pour un autre sur l'étal ne dit pas
   * qu'on a oublié ses caractères.
   * Pas de chronomètre, pas de vie, pas de point. À la fin, Tao goûte : contente quand chaque ingrédient a été trouvé, une
   * grimace sinon, qui propose d'en refaire un. Jamais de reproche.
   */
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import {
    choisir,
    gout,
    jouable,
    mancheCuisine,
    manquants,
    type Recette
  } from './cuisine';
  import {
    JEUX,
    evenementsANoter,
    fini,
    repondre,
    tour,
    type CorpusJeux,
    type Manche,
    type Resultat
  } from './jeux';
  import { AVANCE_MS, VERDICTS, delai } from './revision';
  import { echeance, type Progress, type Revision } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    corpus,
    retour,
    onrepondu,
    oncuisine,
    onautre,
    onretour
  }: {
    p: Progress;
    corpus: CorpusJeux;
    /** Le libellé du bouton qui ramène d'où l'on vient. */
    retour: string;
    onrepondu: (r: Revision) => void;
    /** Tao a goûté : le plat est-il bon, chaque ingrédient trouvé ? */
    oncuisine: (id: string, bon: boolean) => void;
    /** Revenir au choix des jeux. */
    onautre: () => void;
    onretour: () => void;
  } = $props();

  const donnees = $derived(corpus.cuisine?.donnees ?? null);
  const acquis = $derived(corpus.cuisine?.acquis ?? []);

  /** Où l'on en est : le choix du plat, la recette, l'étal, Tao qui goûte. */
  let etape = $state<'choix' | 'recette' | 'etal' | 'gout'>('choix');
  let recette = $state<Recette | null>(null);
  let m = $state<Manche | null>(null);
  /** Les étapes dont on a demandé la lecture et le sens. */
  let vues = $state<number[]>([]);
  /** Les mots faux déjà pris au tour courant, écartés de l'étal. */
  let pris = $state<string[]>([]);
  let resultat = $state<Resultat | null>(null);
  /** Ce qui est entré dans le plat : le bon mot, ou celui pris à sa place. */
  let panier = $state<{ zh: string; mis: string }[]>([]);
  let depart = 0;
  /** Les manches déjà cuisinées : la graine change, l'étal n'est pas rangé pareil. */
  let n = 0;
  let minuteur: ReturnType<typeof setTimeout> | null = null;

  function arreter(): void {
    if (minuteur !== null) clearTimeout(minuteur);
    minuteur = null;
  }
  $effect(() => arreter);

  const t = $derived(m && !fini(m) ? tour(m) : null);
  const ingredient = $derived(recette && m && t ? recette.ingredients[m.i] : null);
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));
  /** Les familles des caractères du plat : de quoi trouver leurs traits sans tout relire. */
  const pistes = $derived(
    recette && donnees
      ? [...new Set(recette.caracteres.flatMap((c) => donnees.racines[c] ?? []))]
      : []
  );
  const goute = $derived(etape === 'gout' && m !== null ? gout(m) : null);
  const ligne = $derived(goute ? (donnees?.tao[goute] ?? null) : null);

  function ouvrir(r: Recette): void {
    arreter();
    recette = r;
    vues = [];
    etape = 'recette';
  }

  function lireEtape(k: number): void {
    vues = vues.includes(k) ? vues.filter((x) => x !== k) : [...vues, k];
  }

  function ouvrirTour(): void {
    arreter();
    pris = [];
    resultat = null;
    depart = Date.now();
  }

  function allerALEtal(): void {
    if (recette === null) return;
    n += 1;
    m = mancheCuisine(recette, `${p.day}/cuisine/${recette.id}/${n}`);
    panier = [];
    etape = m === null ? 'choix' : 'etal';
    ouvrirTour();
  }

  /**
   * Un mot pris sur l'étal : juste, le tour est noté ; faux au premier essai, le mot est
   * écarté ; faux au second, la réponse est montrée et le mot pris entre dans le plat.
   */
  function prendre(mot: string): void {
    const courante = m;
    if (courante === null || t === null || resultat !== null || pris.includes(mot)) return;
    const seconds = Math.max(0, (Date.now() - depart) / 1000);
    const e = choisir(t, mot, pris, seconds);
    pris = e.pris;
    if (e.outcome === null) return;
    const r = repondre(courante, mot, e.outcome);
    resultat = r;
    panier = [...panier, { zh: t.reponse[0], mis: mot }];
    for (const ev of evenementsANoter('cuisine', r)) onrepondu(ev);
    if (r.correct) minuteur = setTimeout(suivant, AVANCE_MS);
  }

  /** L'ingrédient suivant, ou Tao qui goûte quand le panier est plein. */
  function suivant(): void {
    const r = resultat;
    if (r === null) return;
    arreter();
    m = r.manche;
    if (fini(r.manche)) {
      etape = 'gout';
      resultat = null;
      if (recette !== null) oncuisine(recette.id, gout(r.manche) === 'bon');
    } else ouvrirTour();
  }

  function autrePlat(): void {
    arreter();
    m = null;
    recette = null;
    etape = 'choix';
  }

  /** Le sens d'un mot de l'étal, tel que `cuisine.json` le donne. */
  function sens(zh: string): string {
    return donnees?.etal[zh]?.fr ?? '';
  }
  function lecture(zh: string): string {
    return donnees?.etal[zh]?.pinyin ?? '';
  }
</script>

{#if donnees === null}
  <p class="guide">Un instant.</p>
{:else if etape === 'choix' || recette === null}
  <div class="tete">
    <div class="grow">
      <div class="eyebrow">Jouer</div>
      <h1>La cuisine de Tao</h1>
    </div>
    <Tao stade={taoStade} posture="goute" humeur={taoHumeur} size={72} />
  </div>
  <p class="guide">
    Tao lit une recette en chinois, tu prends les ingrédients sur l'étal, puis elle goûte.
    Un plat s'ouvre quand tous ses caractères sont acquis.
  </p>
  <div class="opt plats">
    {#each donnees.recettes as r (r.id)}
      {@const reste = manquants(r, acquis)}
      {#if jouable(r, acquis)}
        <button onclick={() => ouvrir(r)}>
          <span class="nom hz" lang="zh-Hans">{r.zh}</span>
          <span class="grow">
            <span class="t">{r.pinyin} · {r.fr}</span>
            <span class="d">
              {r.ingredients.length} ingrédients{p.recettes.includes(r.id) ? ' · déjà réussi' : ''}
            </span>
          </span>
        </button>
      {:else}
        <!-- Pas encore : ce qu'il reste à lire, en une ligne neutre. -->
        <button class="indispo" disabled>
          <span class="nom hz" lang="zh-Hans">{r.zh}</span>
          <span class="grow">
            <span class="t">{r.pinyin} · {r.fr}</span>
            <span class="d">
              Encore {reste.length}
              {reste.length === 1 ? 'caractère' : 'caractères'} à acquérir :
              <span class="hz" lang="zh-Hans">{reste.slice(0, 8).join(' ')}{reste.length > 8 ? '…' : ''}</span>
            </span>
          </span>
        </button>
      {/if}
    {/each}
  </div>
  <div class="foot fond">
    <button class="btn ghost" onclick={onautre}>Un autre jeu</button>
  </div>
{:else if etape === 'recette'}
  <!-- Tao lit la recette par-dessus l'épaule : le nom du plat, puis ses étapes. -->
  <div class="tete">
    <div class="grow">
      <div class="eyebrow">La recette</div>
      <div class="plat" aria-label={recette.zh}>
        {#each [...recette.zh] as c, k (c + k)}
          <Glyph char={c} size={44} {pistes} />
        {/each}
      </div>
      <p class="sous"><span class="py">{recette.pinyin}</span> {recette.fr}</p>
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
  </div>
  {#if donnees.tao.lit}
    <p class="dit"><span class="hz" lang="zh-Hans">{donnees.tao.lit.zh}</span> {donnees.tao.lit.fr}</p>
  {/if}
  <ol class="etapes">
    {#each recette.etapes as e, k (k)}
      <li>
        <button onclick={() => lireEtape(k)} aria-expanded={vues.includes(k)}>
          <span class="zh" lang="zh-Hans">{e.zh}</span>
          {#if vues.includes(k)}
            <span class="gl"><span class="py">{e.pinyin}</span> {e.fr}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ol>
  <p class="k aide">Touche une étape pour sa lecture et son sens.</p>
  <div class="foot fond">
    <button class="btn" onclick={allerALEtal}>Aller à l'étal</button>
    <div class="acts">
      <button class="btn ghost" onclick={autrePlat}>Un autre plat</button>
    </div>
  </div>
{:else if etape === 'etal' && m !== null && t !== null && ingredient !== null}
  <div class="verif-tete">
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={64} />
    <div class="grow">
      <div class="eyebrow">À l'étal · <span class="hz" lang="zh-Hans">{recette.zh}</span></div>
      <p class="besoin">Il me faut {ingredient.fr}.</p>
    </div>
  </div>
  <div class="tours k" aria-label="Les ingrédients">
    {#each m.tours as _, k (k)}
      <i class:on={k < m.i} class:cur={k === m.i}></i>
    {/each}
  </div>
  <!-- La recette reste sous les yeux : c'est elle qu'on lit pour trouver le mot. -->
  <ol class="etapes courtes" aria-label="La recette">
    {#each recette.etapes as e, k (k)}
      <li><span class="zh" lang="zh-Hans">{e.zh}</span></li>
    {/each}
  </ol>
  <div class="choices quatre etal">
    {#each t.choix as mot, k (mot + k)}
      <button
        class:ok={resultat !== null && mot === t.reponse[0]}
        class:ko={pris.includes(mot)}
        disabled={resultat !== null || pris.includes(mot)}
        onclick={() => prendre(mot)}
      >
        <span class="mot hz" lang="zh-Hans">{mot}</span>
        {#if resultat !== null || pris.includes(mot)}
          <small>{lecture(mot)} · {sens(mot)}</small>
        {/if}
      </button>
    {/each}
  </div>
  <div class="fb">
    {#if resultat !== null}
      <b>{resultat.montre ? 'On te montre.' : VERDICTS[resultat.note]}</b>
      <span class="hz" lang="zh-Hans">{t.reponse[0]}</span>, {sens(t.reponse[0])}.
      {@const quand = echeance(p, resultat.evenement.c)}
      {#if quand}<span class="next">Prochaine fois : dans {delai(new Date(), quand)}.</span>{/if}
    {:else if pris.length > 0}
      Pas celui-là : <span class="hz" lang="zh-Hans">{pris[pris.length - 1]}</span>, c'est
      {sens(pris[pris.length - 1])}. Relis la recette.
    {:else}
      Quel mot de la recette dit {ingredient.fr} ?
    {/if}
  </div>
  <div class="foot fond">
    <button class="btn" disabled={resultat === null} onclick={suivant}>
      {resultat !== null && fini(resultat.manche) ? 'Tao goûte' : 'Suivant'}
    </button>
  </div>
{:else if etape === 'gout' && m !== null}
  <div class="mood">
    <Tao
      stade={taoStade}
      posture="goute"
      humeur={goute === 'bon' ? 'joie' : 'calme'}
      grimace={goute === 'grimace'}
      size={132}
    />
  </div>
  <div class="card center bilan">
    {#if ligne}
      <p class="dit-grand"><span class="hz" lang="zh-Hans">{ligne.zh}</span></p>
      <p class="sous"><span class="py">{ligne.pinyin}</span> {ligne.fr}</p>
    {/if}
    <p class="plat-fait"><span class="hz" lang="zh-Hans">{recette.zh}</span> · {recette.fr}</p>
    {#if goute === 'grimace'}
      <!-- Ce qui est entré dans le plat à la place : un constat, pas un reproche. -->
      <ul class="echanges">
        {#each panier.filter((x) => x.mis !== x.zh) as x (x.zh)}
          <li>
            <span class="hz" lang="zh-Hans">{x.mis}</span> ({sens(x.mis)}) à la place de
            <span class="hz" lang="zh-Hans">{x.zh}</span> ({sens(x.zh)})
          </li>
        {/each}
      </ul>
    {/if}
    <p class="constat">{JEUX.cuisine.constat(m)}</p>
    <div class="k">Ce qui vient d'être revu repasse dans tes révisions, aux échéances dites.</div>
  </div>
  <div class="foot fond">
    {#if goute === 'grimace'}
      <button class="btn" onclick={() => recette && ouvrir(recette)}>Refaire ce plat</button>
    {:else}
      <button class="btn" onclick={autrePlat}>Un autre plat</button>
    {/if}
    <div class="acts">
      <button class="btn ghost" onclick={onretour}>{retour}</button>
      <button class="btn ghost" onclick={onautre}>Un autre jeu</button>
    </div>
  </div>
{/if}

<style>
  /* La cuisine de Tao, dans l'esprit de la devinette du jour : un en-tête, Tao à droite.
     Aucune animation sur les boutons ; le cinabre n'y marque que la position. */
  /* Le pied reste collé en bas quand la liste défile : il porte le papier, rien ne passe dessous. */
  .fond {
    background: var(--paper);
  }
  .tete {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding-bottom: 12px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--rule);
  }
  .tete h1 {
    margin: 0;
    font-size: 26px;
  }
  .eyebrow {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
    margin-bottom: 6px;
  }
  .eyebrow .hz {
    letter-spacing: 0.04em;
    text-transform: none;
    font-size: 13px;
  }
  .plats {
    margin-bottom: 8px;
  }
  .plats button {
    text-align: left;
  }
  .plats .nom {
    font-size: 24px;
    min-width: 76px;
    color: var(--ink);
  }
  .plats .d .hz {
    font-size: 14px;
    letter-spacing: 0.08em;
  }
  .indispo {
    opacity: 0.55;
  }
  .plat {
    display: flex;
    gap: 2px;
  }
  .sous {
    margin: 4px 0 0;
    font-size: 15px;
    color: var(--ink2);
  }
  .py {
    font-family: var(--head);
    font-weight: 500;
    color: var(--indigo);
    margin-right: 4px;
  }
  .dit {
    margin: 0 0 10px;
    color: var(--ink2);
    font-size: 15px;
  }
  .dit .hz {
    font-size: 19px;
    color: var(--ink);
    margin-right: 6px;
  }
  .etapes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .etapes button {
    width: 100%;
    text-align: left;
    padding: 7px 12px;
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--card);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .etapes .zh {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 20px;
    line-height: 1.35;
    letter-spacing: 0.04em;
    color: var(--ink);
  }
  .etapes .gl {
    font-size: 14px;
    color: var(--ink2);
  }
  .etapes.courtes {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 2px 12px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--card);
  }
  .etapes.courtes .zh {
    font-size: 16px;
    line-height: 1.5;
    color: var(--ink2);
  }
  .aide {
    margin-top: 8px;
  }
  .besoin {
    font-family: var(--head);
    font-weight: 700;
    font-size: 21px;
    line-height: 1.25;
    color: var(--ink);
    margin: 0;
  }
  .etal button {
    min-height: 74px;
  }
  .etal .mot {
    font-size: 28px;
    color: var(--ink);
  }
  .fb .hz {
    font-size: 17px;
  }
  .dit-grand {
    margin: 0;
  }
  .dit-grand .hz {
    font-size: 28px;
    color: var(--ink);
  }
  .plat-fait {
    margin: 12px 0 6px;
    color: var(--ink2);
  }
  .plat-fait .hz {
    font-size: 19px;
    color: var(--ink);
  }
  .echanges {
    list-style: none;
    padding: 0;
    margin: 0 0 10px;
    font-size: 14px;
    color: var(--ink2);
  }
  .echanges .hz {
    font-size: 16px;
    color: var(--ink);
  }
</style>
