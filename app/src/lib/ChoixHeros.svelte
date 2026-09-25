<script lang="ts">
  /**
   * Le choix du personnage (brief §8) : trois bêtes non genrées, dessinées au premier rang,
   * et un nom, choisi parmi trois idées ou libre. Tao se présente, puis salue la bête
   * choisie. Au premier lancement, c'est le dernier écran de la première session ; ensuite,
   * Réglages le rouvre pour changer de bête ou de nom, sans rien perdre.
   *
   * Les noms des bêtes, leurs idées de nom et les phrases de Tao viennent de `heros.json` ;
   * seuls les libellés d'interface sont ici, comme dans la première session.
   */
  import Heros from './Heros.svelte';
  import Tao from './Tao.svelte';
  import { NOM_MAX, nettoyerNom, phraseDuChoix, type Bete, type BeteId, type HerosDonnees } from './heros';
  import type { Stade } from './tao';

  let {
    donnees,
    initial = null,
    surtitre,
    stade = 'pousse',
    garder = false,
    onchoisi
  }: {
    donnees: HerosDonnees;
    /** Le personnage déjà choisi, présélectionné quand on en change. */
    initial?: { bete: BeteId; nom: string } | null;
    surtitre: string;
    stade?: Stade;
    /** Depuis Réglages : le bouton garde le choix au lieu de partir. */
    garder?: boolean;
    onchoisi: (bete: BeteId, nom: string) => void;
  } = $props();

  /* Le choix en cours : présélectionné sur le personnage déjà choisi, puis libre. */
  const init = (() => initial)();
  let choisieId = $state<BeteId | null>(init?.bete ?? null);
  let nom = $state(init?.nom ?? '');
  const choisie = $derived<Bete | null>(donnees.betes.find((b) => b.id === choisieId) ?? null);

  const propre = $derived(nettoyerNom(nom));
  const phrase = $derived(phraseDuChoix(donnees, choisie));
  const libelle = $derived.by(() => {
    if (choisie === null) return "Choisis d'abord un personnage";
    if (garder) return propre ? `Garder ${propre}` : 'Garder ce choix';
    return propre ? `En route, ${propre}` : 'En route';
  });

  function partir(): void {
    if (choisie === null) return;
    onchoisi(choisie.id, propre || choisie.noms[0] || choisie.hz);
  }

  const estHz = (x: string): boolean => /[㐀-鿿]/.test(x);
</script>

<section class="choix">
  <div class="sur">{surtitre}</div>
  <h1>Qui fera la route avec toi ?</h1>
  <p class="sous">Choisis ton personnage : il grandit à chaque rang.</p>

  <div class="bestiaire">
    {#each donnees.betes as b (b.id)}
      <button class="bete" aria-pressed={choisie?.id === b.id} onclick={() => (choisieId = b.id)}>
        <Heros bete={b.id} rang={0} cadre="vignette" largeur={74} />
        <b><span class="hz">{b.hz}</span>{b.fr}</b>
      </button>
    {/each}
  </div>

  <div class="champ">
    <label for="nom-heros">Son nom</label>
    <input
      id="nom-heros"
      maxlength={NOM_MAX}
      autocomplete="off"
      placeholder="Un nom, en lettres ou en caractères"
      bind:value={nom}
    />
    {#if choisie}
      <div class="idees">
        {#each choisie.noms as x (x)}
          <button type="button" class:hz={estHz(x)} class:on={propre === x} onclick={() => (nom = x)}>{x}</button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="tao-dit">
    <Tao {stade} posture="chemin" humeur={choisie ? 'joie' : 'calme'} size={52} />
    <p>{phrase}</p>
  </div>

  <div class="foot">
    <button class="btn" disabled={choisie === null} onclick={partir}>{libelle}</button>
  </div>
</section>

<style>
  .choix {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .sur {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
  }
  h1 {
    font-size: 24px;
    margin: 6px 0 2px;
  }
  .sous {
    color: var(--ink2);
    margin: 0 0 12px;
    font-size: 15.5px;
    line-height: 1.35;
  }
  .bestiaire {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .bete {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--card);
    border: 2px solid transparent;
    border-radius: 18px;
    padding: 6px 4px 9px;
    text-align: center;
  }
  .bete[aria-pressed='true'] {
    border-color: var(--ink);
  }
  .bete b {
    font-family: var(--head);
    font-size: 13.5px;
    line-height: 1.25;
    margin-top: 2px;
  }
  .bete b .hz {
    display: block;
    font-size: 17px;
    font-weight: 500;
  }
  .champ {
    margin-top: 12px;
  }
  .champ label {
    display: block;
    font-size: 13.5px;
    color: var(--ink2);
    margin-bottom: 4px;
  }
  .champ input {
    width: 100%;
    font: inherit;
    font-size: 17px;
    padding: 9px 14px;
    border-radius: 14px;
    border: 1.5px solid var(--line);
    background: var(--card);
    color: var(--ink);
  }
  .idees {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .idees button {
    font-size: 14.5px;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    padding: 3px 12px;
    min-height: 32px;
  }
  .idees button.hz {
    font-family: var(--hz);
  }
  .idees button.on {
    border-color: var(--ink);
  }
  .tao-dit {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .tao-dit p {
    margin: 0;
    font-size: 14.5px;
    line-height: 1.35;
    color: var(--ink2);
  }
  .foot {
    padding-top: 12px;
  }
</style>
