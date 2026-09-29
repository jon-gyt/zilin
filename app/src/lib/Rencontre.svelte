<script lang="ts">
  /**
   * La rencontre du maître Xing 杏 (décision du propriétaire du 29 septembre 2026) : Tao le
   * rencontre à la porte du premier examen, le 县试. Une porte de l'aventure (`ouvertures.ts`,
   * `xing`), que Tao annonce au retour au menu ; sa bulle mène ici.
   *
   * La scène : la porte de ville 城门 du 县试, ouverte ; Xing salue les mains jointes 作揖,
   * content ; Tao, en écolière avec son pinceau et son panier 考篮, à côté de lui, à la même taille.
   * Sa bulle dit l'accueil. Dessous, son nom dessiné depuis ses traits (杏, l'abricotier), d'où
   * il vient (l'autel des abricotiers 杏坛, où Confucius enseignait) et ce qu'il fait
   * désormais. Un seul bouton, qui ramène au menu.
   *
   * Rien en dur : les textes viennent de `ecrans.json` (`xing`). Ni cinabre, ni ombre, ni
   * dégradé, ni doré, ni emoji ; l'indigo pour l'action.
   */
  import Glyph from './Glyph.svelte';
  import PorteVille from './Porte.svelte';
  import Tao from './Tao.svelte';
  import Xing from './Xing.svelte';
  import type { TextesXing } from './ecrans';
  import type { Progress } from './session';
  import { stade } from './tao';
  import { POSTURE_RENCONTRE, humeurXing } from './xing';

  let {
    p,
    textes,
    examen,
    oncontinuer
  }: {
    p: Progress;
    textes: TextesXing;
    /** Le nom du premier examen, sur le linteau de la porte (`examens.json`). */
    examen: string;
    oncontinuer: () => void;
  } = $props();

  const taoStade = $derived(stade(p.tao.croissance));
  /** Les deux à la même taille : sans pousse, il paraît un peu plus petit qu'elle. */
  const TAILLE = 132;
</script>

<main class="screen rencontre">
  {#if textes.kicker !== ''}<div class="k kicker">{textes.kicker}</div>{/if}

  <div class="scene" role="img" aria-label={textes.voix}>
    <div class="porte"><PorteVille hz={examen} largeur={236} ouverte /></div>
    <div class="duo">
      <span class="xing-pose"><Xing posture={POSTURE_RENCONTRE} humeur={humeurXing('rencontre')} size={TAILLE} /></span>
      <span class="tao-pose"><Tao stade={taoStade} posture="chemin" humeur="joie" ecolier panier size={TAILLE} /></span>
    </div>
  </div>

  {#if textes.accueil !== ''}
    <p class="bulle" aria-live="polite">{textes.accueil}</p>
  {/if}

  <div class="nom">
    {#if textes.caractere !== ''}
      <span class="gl"><Glyph char={textes.caractere} size={64} label="{textes.caractere}, {textes.pinyin}" /></span>
    {/if}
    <div>
      <h1>{textes.nom}</h1>
      <div class="py">{textes.pinyin} <span class="sens">{textes.sens}</span></div>
    </div>
  </div>
  <p class="texte">{textes.presentation}</p>
  <p class="texte">{textes.roles}</p>

  <div class="foot">
    <button class="btn" onclick={oncontinuer}>{textes.bouton}</button>
  </div>
</main>

<style>
  .kicker {
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .scene {
    position: relative;
    height: 212px;
    margin: 4px -22px 0;
  }
  .porte {
    position: absolute;
    left: 50%;
    top: 4px;
    transform: translateX(-50%);
  }
  /* les deux devant la porte, à la même taille, un peu serrés : ils se parlent */
  .duo {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -6px;
    display: flex;
    justify-content: center;
    gap: 0;
    line-height: 0;
  }
  .xing-pose {
    margin-right: -26px;
  }
  .bulle {
    position: relative;
    margin: 10px 0 0;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 16px;
    padding: 9px 14px;
    font-size: 15.5px;
    line-height: 1.35;
    color: var(--ink);
  }
  /* la pointe vers Xing, à gauche */
  .bulle::after {
    content: '';
    position: absolute;
    left: 34%;
    top: -7px;
    width: 12px;
    height: 12px;
    background: var(--card);
    border-left: 1.5px solid var(--ink);
    border-top: 1.5px solid var(--ink);
    transform: rotate(45deg);
  }
  .nom {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 18px 0 6px;
  }
  .gl {
    display: inline-flex;
    line-height: 0;
  }
  h1 {
    font-size: 24px;
    margin: 0;
  }
  .py {
    color: var(--indigo);
    font-weight: 600;
    font-size: 18px;
  }
  .sens {
    color: var(--ink2);
    font-weight: 400;
    font-size: 15px;
    margin-left: 4px;
  }
  .texte {
    margin: 6px 0 0;
    color: var(--ink2);
    font-size: 15.5px;
    line-height: 1.4;
  }
</style>
