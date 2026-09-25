<script lang="ts">
  /**
   * « Mon personnage » (brief §8), comme la maquette validée : le rang en haut à droite,
   * dessiné depuis ses traits avec son pinyin ; la scène (le personnage à sa taille, son
   * aura) ; Tao et sa bulle ; le nom et trois lignes ; la barre vers le rang suivant ; les
   * quatre arts. S'ouvre par le portrait de l'en-tête du menu ; un seul retour, vers lui.
   *
   * Une progression sans personnage le choisit ici, la première fois. On en change dans
   * Réglages. Tout ce qui se calcule (rang, taille, bulle) vient de `heros.ts`, les textes
   * de `heros.json`.
   */
  import ChoixHeros from './ChoixHeros.svelte';
  import Glyph from './Glyph.svelte';
  import Heros from './Heros.svelte';
  import Tao from './Tao.svelte';
  import {
    ARTS,
    avance,
    beteDe,
    caracteresDeLAura,
    phraseDeTao,
    pistes,
    sansArticle,
    taille,
    total,
    type BeteId,
    type HerosDonnees
  } from './heros';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    donnees,
    onretour,
    onchoisi
  }: {
    p: Progress;
    donnees: HerosDonnees | null;
    onretour: () => void;
    onchoisi: (bete: BeteId, nom: string) => void;
  } = $props();

  const points = $derived(total(p.arts));
  const rangs = $derived(donnees?.rangs ?? []);
  const av = $derived(avance(points, rangs));
  const rang = $derived(rangs[av.rang] ?? null);
  const bete = $derived(donnees && p.heros ? beteDe(donnees, p.heros.bete) : null);
  const echelle = $derived(taille(points, rangs));
  const lus = $derived(caracteresDeLAura(p.cartes));
  const bulle = $derived(donnees && p.heros ? phraseDeTao(donnees, p.arts, p.heros.nom) : '');
  const plusFort = $derived(Math.max(10, ...ARTS.map((a) => p.arts[a.id])));
  const nombre = (n: number): string => n.toLocaleString('fr-FR');
</script>

<main class="screen perso">
  {#if donnees === null}
    <button class="k quit" onclick={onretour}>‹ Retour</button>
  {:else if p.heros === null}
    <button class="k quit" onclick={onretour}>‹ Retour</button>
    <ChoixHeros {donnees} surtitre="Mon personnage" stade={stade(p.tao.croissance)} {onchoisi} />
  {:else}
    <div class="top">
      <button class="k quit" onclick={onretour}>‹ Retour</button>
      {#if rang}
        <div class="rang" aria-label="{rang.hz}, {rang.pinyin}">
          <span class="rhz" aria-hidden="true">
            {#each [...rang.hz] as c, i (c + i)}
              <Glyph char={c} size={26} write={false} color="var(--ink)" pistes={pistes(donnees, c)} />
            {/each}
          </span>
          <span class="rpy">{rang.pinyin}</span>
        </div>
      {/if}
    </div>

    <div class="scene">
      <Heros bete={p.heros.bete} rang={av.rang} {echelle} {points} {lus} />
    </div>

    <div class="aide">
      <Tao stade={stade(p.tao.croissance)} posture="chemin" humeur={humeur(p.tao.activites, p.day)} size={50} />
      {#if bulle !== ''}<div class="bulle" role="status">{bulle}</div>{/if}
    </div>

    <div class="nom">
      <b>{p.heros.nom}</b>
      {#if rang}
        <span>«&nbsp;{rang.fr}&nbsp;» · {rang.role}</span>
        <small
          >{bete ? `${bete.hz} ${sansArticle(bete.fr)} · ` : ''}{rang.age} · rang {av.rang + 1} sur {rangs.length}</small
        >
      {/if}
    </div>

    <div class="xp">
      <div class="row">
        <span>{nombre(points)} point{points > 1 ? 's' : ''}</span>
        <span>{av.suivant ? `${nombre(av.suivant.seuil)} pour ${av.suivant.hz}` : 'rang le plus haut'}</span>
      </div>
      <div class="bar"><i style="width:{Math.round(av.part * 100)}%"></i></div>
    </div>

    <div class="arts">
      {#each ARTS as a (a.id)}
        <div class="art {a.id}">
          <span class="ahz"><Glyph char={a.c} size={30} write={false} color="var(--art)" /></span>
          <span class="l">{a.t}</span>
          <span class="n">{nombre(p.arts[a.id])}</span>
          <span class="pip"><i style="width:{Math.round((p.arts[a.id] / plusFort) * 100)}%"></i></span>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  .perso {
    padding-bottom: 20px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .rang {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding-top: 4px;
  }
  .rhz {
    display: flex;
    line-height: 0;
  }
  .rpy {
    font-size: 12.5px;
    color: var(--mist);
    font-style: italic;
    margin-top: 2px;
  }
  .scene {
    height: 232px;
    margin-top: -6px;
  }
  .scene :global(.heros-svg) {
    height: 100%;
  }
  .aide {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
  }
  .bulle {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 14px;
    padding: 6px 11px;
    font-size: 14px;
    line-height: 1.3;
    margin-left: 4px;
  }
  .bulle::before {
    content: '';
    position: absolute;
    left: -6.5px;
    top: 50%;
    width: 10px;
    height: 10px;
    background: var(--card);
    border-left: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    transform: translateY(-50%) rotate(45deg);
  }
  .nom {
    text-align: center;
  }
  .nom b {
    display: block;
    font-family: var(--head);
    font-size: 22px;
    line-height: 1.2;
  }
  .nom span {
    display: block;
    color: var(--ink2);
    font-size: 14.5px;
    line-height: 1.35;
  }
  .nom small {
    display: block;
    color: var(--mist);
    font-size: 13px;
    line-height: 1.35;
  }
  .xp {
    margin-top: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    font-size: 13.5px;
    color: var(--ink2);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 12px;
    border-radius: 8px;
    background: var(--paper);
    border: 1.5px solid var(--line);
    overflow: hidden;
    margin-top: 5px;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--indigo);
    border-radius: 8px;
  }
  .arts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }
  .art {
    background: var(--card);
    border-radius: 14px;
    padding: 8px 6px 9px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--art);
  }
  /* les pigments de la charte, ceux du thème : lisibles aussi les nuits de fête */
  .art.du {
    --art: var(--t1);
  }
  .art.xie {
    --art: var(--ocre);
  }
  .art.ting {
    --art: var(--jade);
  }
  .art.shuo {
    --art: var(--t3);
  }
  .ahz {
    line-height: 0;
  }
  .l {
    font-size: 12.5px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .n {
    font-family: var(--head);
    font-weight: 700;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }
  .pip {
    align-self: stretch;
    height: 4px;
    border-radius: 3px;
    background: var(--line);
    margin: 5px 8px 0;
    overflow: hidden;
  }
  .pip i {
    display: block;
    height: 100%;
    background: var(--art);
  }
</style>
