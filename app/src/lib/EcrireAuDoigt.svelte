<script lang="ts">
  /**
   * La place de l'écriture au doigt dans le dictionnaire (story 10.8, maquette
   * `maquettes/dictionnaire.html`, écran 5), ouverte par le pinceau du champ.
   *
   * Le pavé et sa reconnaissance sur l'appareil (story 10.10) se construisent à part, dans
   * `PaveEcriture.svelte` : ce panneau le reçoit par `Pave` et lui passe `onchoisir`, qui écrit
   * le caractère choisi dans le champ et ouvre sa fiche. `App.svelte` le passe ; nul (un test,
   * une autre porte), Chercher ne montre pas le pinceau.
   *
   * L'écriture au doigt est dans Wenlu complet, l'abonnement comme l'achat à vie (brief §10).
   * Sans lui, la même place le dit en une ligne, sans cadenas, sans fenêtre, rien de grisé
   * ailleurs : la recherche reste entière. Les textes viennent de `ecrans.json`.
   */
  import type { Component } from 'svelte';
  import type { TextesDictionnaire } from './ecrans';

  let {
    t,
    complet,
    Pave,
    saisie = '',
    onchoisir
  }: {
    t: TextesDictionnaire;
    /** Wenlu complet ce jour-là (`droits.wenluComplet`). */
    complet: boolean;
    /** Le pavé d'écriture et sa reconnaissance, livrés à part. */
    Pave: Component<{ onchoisir: (c: string) => void }>;
    /** Le dernier caractère choisi. */
    saisie?: string;
    onchoisir: (c: string) => void;
  } = $props();
</script>

<div class="champ lecture-seule">
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
  <span class="saisie" lang="zh-Hans" aria-live="polite">{#if saisie !== ''}{saisie}{:else}<span class="vide">{t['ecrire-saisie']}</span>{/if}</span>
</div>

{#if complet}
  <Pave {onchoisir} />
{:else}
  <div class="complet">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5l5 5L10 19l-5.5.5L5 14z" /><path d="M12.5 6.5l5 5" /></svg>
    <b>{t['complet-titre']}</b>
    <p>{t['complet-texte']}</p>
  </div>
{/if}

<style>
  .champ {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--mist);
  }
  .champ > svg {
    width: 22px;
    height: 22px;
    flex: none;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .saisie {
    flex: 1;
    min-width: 0;
    font: 500 22px/1 var(--hz);
    color: var(--ink);
  }
  .saisie .vide {
    font: 400 16px/1 var(--sans);
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
  }
  .complet p {
    margin: 0;
    color: var(--ink2);
    font-size: 14.5px;
  }
</style>
