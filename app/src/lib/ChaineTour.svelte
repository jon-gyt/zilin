<script lang="ts">
  /**
   * Un tour de la chaîne de mots (décision du propriétaire du 30 septembre 2026), posé par
   * l'écran hôte des jeux.
   *
   * Le mot d'avant reste visible, petit, avec son pinyin et son sens : c'est le maillon. Son
   * dernier caractère et le premier du mot nouveau sont cerclés d'un filet d'encre : c'est
   * le même, là où l'un finit et l'autre commence. Ce caractère n'est pas un élément
   * ajouté : il est déjà lu. Le cinabre ne marque donc rien ici, comme sur tout l'écran
   * Jouer. Puis le mot nouveau, en grand, dessiné depuis ses traits, et quatre sens. La
   * réponse donnée, le mot se réécrit au pinceau (fixe si l'on réduit les animations), avec
   * son pinyin et son sens entier. Pas de chronomètre, pas de vie.
   */
  import Glyph from './Glyph.svelte';
  import { motDe, motDuTour } from './chaine';
  import type { CorpusJeux, Resultat, Tour } from './jeux';

  let {
    t,
    corpus,
    resultat,
    donnee,
    onchoisir
  }: {
    t: Tour;
    corpus: CorpusJeux;
    /** Le tour noté, `null` tant qu'on n'a pas répondu. */
    resultat: Resultat | null;
    /** Ce qui a été répondu : la correction montre où l'on s'est trompé. */
    donnee: readonly string[];
    onchoisir: (sens: string) => void;
  } = $props();

  const mot = $derived(motDuTour(t, corpus));
  const signes = $derived(mot ? [...mot.hanzi] : []);
  const suite = $derived(t.suite ?? []);
  const avant = $derived(suite.length > 0 ? motDe(suite[suite.length - 1], corpus) : null);
  const signesAvant = $derived(avant ? [...avant.hanzi] : []);
</script>

<div class="lien" aria-label={avant ? `${avant.hanzi}, puis ${mot?.hanzi ?? ''}` : (mot?.hanzi ?? '')}>
  {#if avant}
    <div class="avant">
      <span class="signes">
        {#each signesAvant as c, k (c + k)}
          <span class="signe" class:joint={k === signesAvant.length - 1}>
            <Glyph seul char={c} size={38} write={false} />
          </span>
        {/each}
      </span>
      <small>
        {#if avant.pinyin !== ''}<span class="py">{avant.pinyin}</span>{/if}
        {avant.fr}
      </small>
    </div>
    <span class="fleche" aria-hidden="true">→</span>
  {/if}
  <div class="mot">
    {#each signes as c, k (c + k + (resultat === null ? '' : '/ecrit'))}
      <span class="signe" class:joint={avant !== null && k === 0}>
        <Glyph seul char={c} size={72} write={resultat !== null} />
      </span>
    {/each}
  </div>
</div>

{#if resultat !== null && mot}
  <p class="sens">
    {#if mot.pinyin !== ''}<span class="py">{mot.pinyin}</span>{/if}
    <b>{mot.fr}</b>
  </p>
{:else}
  <p class="consigne">{t.enonce}</p>
{/if}

<div class="choices">
  {#each t.choix as s, k (s + k)}
    <button
      class="txt"
      class:ok={resultat !== null && s === t.reponse[0]}
      class:ko={resultat !== null && !resultat.correct && donnee[0] === s}
      disabled={resultat !== null}
      onclick={() => onchoisir(s)}
    >
      {s}
    </button>
  {/each}
</div>

<style>
  .lien {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 2px 0 8px;
  }
  .avant {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 132px;
  }
  .avant small {
    font-size: 12.5px;
    line-height: 1.25;
    color: var(--ink2);
    text-align: center;
  }
  .avant .py {
    margin-right: 4px;
    font-size: 13px;
    color: var(--indigo);
  }
  .signes,
  .mot {
    display: inline-flex;
    gap: 2px;
  }
  .signe {
    display: inline-flex;
    border: 1.5px solid transparent;
    border-radius: 10px;
  }
  /* Le caractère qui relie les deux mots : un filet d'encre, jamais le cinabre. */
  .signe.joint {
    border-color: var(--ink2);
  }
  .fleche {
    color: var(--mist);
    font-size: 20px;
  }
  .sens {
    margin: 0;
    text-align: center;
    font-size: 17px;
  }
  .sens .py {
    font-family: var(--head);
    font-weight: 500;
    font-size: 17px;
    margin-right: 8px;
    color: var(--indigo);
  }
  .consigne {
    text-align: center;
  }
</style>
