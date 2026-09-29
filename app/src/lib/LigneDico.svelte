<script lang="ts">
  /**
   * Une ligne du dictionnaire : le caractère ou le mot dessiné depuis ses traits, son pinyin,
   * sa glose quand elle est relue, son niveau HSK et son statut de Mon chemin (lu au jade,
   * « dans N j » à l'indigo, hors du chemin en gris). La toucher ouvre sa fiche. Tout le texte
   * est passé tout fait : ce composant ne rédige rien.
   */
  import DicoGlyph from './DicoGlyph.svelte';
  import type { StatutDico } from './dico-ecran';

  let {
    hanzi,
    pinyin,
    glose = '',
    niveau,
    statut,
    libelle,
    onclick
  }: {
    /** Le caractère, ou le mot. */
    hanzi: string;
    pinyin: string;
    /** La glose relue ; vide, rien. */
    glose?: string;
    /** « HSK 1 », « HSK 7-9 ». */
    niveau: string;
    statut: StatutDico;
    /** Le statut en toutes lettres courtes : « lu », « dans 122 j ». */
    libelle: string;
    onclick: () => void;
  } = $props();

  const cs = $derived(Array.from(hanzi));
</script>

<button class="ligne-dico" {onclick}>
  <span class="gl" class:mot={cs.length > 1} lang="zh-Hans">
    {#if cs.length === 1}
      <DicoGlyph c={hanzi} size={44} paresseux />
    {:else}
      {#each cs as c, k (k)}<DicoGlyph {c} size={28} paresseux />{/each}
    {/if}
  </span>
  <span class="txt">
    <span class="l1">
      {#if pinyin !== ''}<span class="pin">{pinyin}</span>{/if}
      {#if glose !== ''}<span class="sens">{glose}</span>{/if}
    </span>
    <span class="l2">
      <span>{niveau}</span>
      <span class="st {statut.k}">{libelle}</span>
    </span>
  </span>
</button>

<style>
  .ligne-dico {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 9px 2px;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .ligne-dico:active {
    background: var(--card);
  }
  .gl {
    width: 48px;
    display: flex;
    justify-content: center;
    flex: none;
    line-height: 0;
    color: var(--ink);
  }
  .gl.mot {
    width: auto;
    min-width: 48px;
    gap: 1px;
  }
  .txt {
    flex: 1;
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
    font-size: 16.5px;
  }
  .sens {
    color: var(--ink);
    font-size: 15.5px;
  }
  .l2 {
    display: flex;
    gap: 10px;
    font-size: 13.5px;
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
    font-weight: 600;
  }
  .st.encours,
  .st.chemin {
    color: var(--indigo);
  }
</style>
