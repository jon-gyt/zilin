<script lang="ts">
  /**
   * Le lecteur d'un conte (story 2c.1) : la version que l'acquis ouvre, en texte courant.
   * Le texte est en police, comme les trois lignes du pas Utiliser : la règle des traits
   * vaut pour les grands caractères isolés, pas pour un texte qui se lit d'un trait.
   *
   * Toucher un caractère, ou un mot que la glose de la version connaît, montre son pinyin
   * et son sens dans la bande du bas, et le dit (`audio.dire`, silencieux sans voix). La
   * traduction se replie. « J'ai lu » en fin de conte note la version lue. Tao lit
   * par-dessus l'épaule. Aucun cinabre ici : le conte n'a pas d'élément ajouté.
   *
   * En mode relecture (Réglages), une version de l'aperçu porte la mention « à relire » en
   * tête, une version que l'acquis n'ouvre pas encore « pas encore dans ton acquis » ; leur
   * « J'ai lu » ne note rien (`Lire.fini`) : un texte qu'on essaie n'est pas un conte lu.
   */
  import ARelire from './ARelire.svelte';
  import Tao from './Tao.svelte';
  import { dire } from './audio';
  import { fiche } from './content';
  import {
    MENTION_HORS_ACQUIS,
    grouper,
    ligneGlose,
    traduction,
    unites,
    unitesDuTitre,
    type EntreeConte,
    type Unite
  } from './lecture';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    entree,
    onlu,
    onretour
  }: {
    /** La progression : Tao y lit son stade et son humeur. */
    p: Progress;
    /** Le conte, avec la version ouverte (jamais nulle ici). */
    entree: EntreeConte;
    /** « J'ai lu » : la version est notée lue, puis retour à la bibliothèque. */
    onlu: () => void;
    onretour: () => void;
  } = $props();

  const v = $derived(entree.version);
  /* Le titre, puis le texte courant, groupés pour que la ponctuation ne passe pas seule à la ligne. */
  const titre = $derived(v ? grouper(unitesDuTitre(v)) : []);
  const texte = $derived(v ? grouper(v.phrases.flatMap((ph) => unites(ph, v.glose))) : []);
  const trad = $derived(v ? traduction(v) : '');

  /** L'unité touchée, et son pinyin quand la phrase ne le donne pas (lu dans la fiche). */
  let touchee = $state.raw<Unite | null>(null);
  let pinyinFiche = $state<string | null>(null);
  let tradOuverte = $state(false);

  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  /**
   * Le pinyin d'une unité que la phrase n'aligne pas (le titre, une phrase au pinyin
   * irrégulier) : celui des fiches de l'export, caractère par caractère. Faute de fiche
   * pour l'un d'eux, rien : on ne devine pas une lecture.
   */
  async function pinyinDesFiches(texte: string): Promise<string | null> {
    const lus = await Promise.all(Array.from(texte).map((c) => fiche(c).catch(() => null)));
    if (lus.some((f) => !f || !f.pinyin)) return null;
    return lus.map((f) => f?.pinyin ?? '').join('');
  }

  function toucher(u: Unite): void {
    touchee = u;
    pinyinFiche = null;
    void dire(u.texte);
    if (u.pinyin === null) {
      void pinyinDesFiches(u.texte).then((py) => {
        if (touchee === u) pinyinFiche = py;
      });
    }
  }

  const glose = $derived(
    touchee ? ligneGlose({ pinyin: touchee.pinyin ?? pinyinFiche, sens: touchee.sens }) : ''
  );
</script>

<main class="screen conte">
  <button class="k quit" onclick={onretour}>‹ Lire</button>

  <div class="verif-tete">
    <div class="grow">
      <div class="k">
        Version du seuil {v?.seuil}
        <ARelire de={v} />
        {#if entree.horsAcquis}<span class="mention">{MENTION_HORS_ACQUIS}</span>{/if}
      </div>
      {#if entree.titre_zh}
        <h1 class="vrai" lang="zh-Hans">{entree.titre_zh}</h1>
        <div class="py">{entree.titre_pinyin}</div>
        <div class="fr">{entree.titre_fr}</div>
      {:else}
        <h1>{entree.titre_fr}</h1>
      {/if}
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
  </div>

  {#snippet ligne(groupes: Unite[][])}
    {#each groupes as g, n (n)}
      <span class="groupe">
        {#each g as u, i (i)}
          {#if u.touchable}
            <button class="s" class:touchee={touchee === u} onclick={() => toucher(u)}
              >{u.texte}</button
            >
          {:else}
            <span class="s muet">{u.texte}</span>
          {/if}
        {/each}
      </span>
    {/each}
  {/snippet}

  {#if v}
    <div class="card">
      {#if !entree.titre_zh}
        <div class="read titre" lang="zh-Hans">{@render ligne(titre)}</div>
      {/if}
      <div class="read texte" lang="zh-Hans">{@render ligne(texte)}</div>
    </div>

    {#if trad}
      <div class="card">
        <button
          class="replier"
          aria-expanded={tradOuverte}
          onclick={() => (tradOuverte = !tradOuverte)}
        >
          <span class="k">Traduction</span>
          <span class="k">{tradOuverte ? 'Replier' : 'Afficher'}</span>
        </button>
        {#if tradOuverte}
          <div class="trad-pleine">{trad}</div>
        {/if}
      </div>
    {/if}

    <div class="foot">
      <div class="gloss" aria-live="polite">
        {#if touchee}
          <b class="hz">{touchee.texte}</b>
          {glose}
        {:else}
          Touche un caractère ou un mot.
        {/if}
      </div>
      <button class="btn" onclick={onlu}>J'ai lu</button>
    </div>
  {/if}
</main>

<style>
  /* le titre, puis le texte courant : les unités s'enchaînent et passent à la ligne */
  .titre,
  .texte {
    display: flex;
    flex-wrap: wrap;
  }
  h1.vrai {
    font-family: var(--hz);
    font-weight: 500;
    letter-spacing: 0.06em;
  }
  .verif-tete .py {
    font-style: italic;
    color: var(--ink2);
  }
  .verif-tete .fr {
    color: var(--ink2);
    margin-top: 2px;
  }
  .titre {
    font-size: 24px;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
  }
  .groupe {
    display: inline-flex;
    white-space: nowrap;
  }
  /* l'unité touchée reste soulignée, à l'indigo : on voit ce que dit la bande du bas */
  .read .s.touchee {
    border-color: var(--indigo);
  }
  .conte h1 {
    font-size: 24px;
  }
  .replier {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 44px;
    margin: -12px 0;
  }
  .replier + .trad-pleine {
    margin-top: 16px;
  }
  /* La bande du bas : la glose, puis le bouton, sur le papier, au-dessus du texte qui défile. */
  .conte .foot {
    background: var(--paper);
  }
  .conte .foot .gloss {
    margin: 0 0 10px;
    background: var(--card);
  }
</style>
