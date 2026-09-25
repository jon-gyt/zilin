<script lang="ts">
  /**
   * 放榜, « on affiche la liste » (brief §8) : un rang du personnage vient d'être franchi.
   * Comme la maquette : le tableau des résultats, le titre dessiné depuis ses traits, son
   * pinyin, la ligne de Tao, un bouton. Il passe au retour au menu, avant lui, jamais au
   * milieu d'un pas, une fois par rang (`rangAAnnoncer`).
   *
   * Le tableau est un aplat abricot pâle cerné d'encre : ni doré, ni ombre, ni cinabre.
   */
  import Glyph from './Glyph.svelte';
  import Heros from './Heros.svelte';
  import { pistes, texteFangbang, type HerosDonnees, type Heros as LeHeros } from './heros';

  let {
    donnees,
    heros,
    rang,
    oncontinuer
  }: {
    donnees: HerosDonnees;
    heros: LeHeros;
    /** Le rang atteint, celui qu'on affiche. */
    rang: number;
    oncontinuer: () => void;
  } = $props();

  const r = $derived(donnees.rangs[rang] ?? null);
  const texte = $derived(texteFangbang(donnees, rang, heros.nom));
</script>

<main class="screen fangbang">
  {#if r}
    <div class="bang" role="status" aria-label="{r.hz}, {r.pinyin}">
      <span class="sur"><span class="hz">放榜</span> · les résultats</span>
      <span class="titre" aria-hidden="true">
        {#each [...r.hz] as c, i (c + i)}
          <Glyph char={c} size={64} color="var(--h-encre)" pistes={pistes(donnees, c)} />
        {/each}
      </span>
      <span class="pin">{r.pinyin}</span>
    </div>
    <div class="qui"><Heros bete={heros.bete} {rang} cadre="vignette" largeur={70} /></div>
    <p>{texte}</p>
  {/if}
  <button class="btn cont" onclick={oncontinuer}>Continuer</button>
</main>

<style>
  .fangbang {
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .bang {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 2px solid var(--h-encre);
    border-radius: 6px;
    padding: 14px 24px 16px;
    background: var(--h-abricot-pale);
    color: var(--h-encre);
  }
  .sur {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--h-ocre);
  }
  .sur .hz {
    letter-spacing: 0.05em;
  }
  .titre {
    display: flex;
    line-height: 0;
    margin-top: 8px;
  }
  .pin {
    font-style: italic;
    color: var(--h-encre);
    opacity: 0.75;
    margin-top: 4px;
  }
  .qui {
    margin-top: 14px;
    line-height: 0;
  }
  p {
    max-width: 30ch;
    color: var(--ink2);
    margin: 8px 0 18px;
    font-size: 16.5px;
  }
  .cont {
    width: auto;
    min-width: 160px;
    border-radius: 999px;
  }
</style>
