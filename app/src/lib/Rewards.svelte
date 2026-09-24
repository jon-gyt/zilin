<script lang="ts">
  /**
   * Le tableau des trophées : ce que tu as su lire. On y entre depuis Ma forêt, par
   * « Tes trophées », et le retour y ramène.
   *
   * Tout se calcule dans `trophees.ts`, depuis la progression et le contenu exporté.
   * Chaque trophée se gagne en lisant, jamais au temps passé : pas de points, pas de
   * classement, pas de doré, ni ombre ni dégradé. Un trophée est un sceau carré 印 :
   * gravé en blanc sur l'encre quand il est obtenu, en pointillés quand il est à venir.
   * Le toucher montre son détail dans la carte du résumé, sans fenêtre modale.
   *
   * Les sceaux portent des caractères de moins de 30 px : la police suffit, la règle
   * des traits vaut pour les grands caractères.
   */
  import Que from './Que.svelte';
  import Tao from './Tao.svelte';
  import { contenuTrophees, type ContenuTropheesLu } from './content';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';
  import { SECTION_VIDE, tableau, type Objet, type Trophee } from './trophees';

  let { p, onretour }: { p: Progress; onretour: () => void } = $props();

  let lu = $state<ContenuTropheesLu | null>(null);
  /** Le trophée touché ; à défaut, la carte montre le prochain. */
  let choisi = $state<string | null>(null);

  $effect(() => {
    let vivant = true;
    contenuTrophees()
      .then((c) => {
        if (vivant) lu = c;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const t = $derived(lu ? tableau(p, lu) : null);
  const tous = $derived(t ? t.sections.flatMap((s) => s.trophees) : []);
  const detail: Trophee | null = $derived(
    tous.find((x) => x.id === choisi) ?? t?.prochain ?? tous.find((x) => x.obtenu) ?? null
  );
  const stadeDeTao = $derived(stade(p.tao.croissance));
  const humeurDeTao = $derived(humeur(p.tao.activites, p.day));

  function entete(x: Trophee): string {
    if (x.obtenu) return 'Obtenu';
    if (x.id === t?.prochain?.id) return 'Le prochain';
    return x.suivi ? 'À venir' : 'Verrouillé';
  }

  /** Les pictogrammes au trait des objets de Tao : encre seule, aucun remplissage. */
  const PICTOS: Record<Objet, string> = {
    pinceau:
      '<path d="M19.5 3.5l-8.8 8.8"/><path d="M10.7 12.3c-2.4-.4-4.7 1.2-5 3.7-.2 1.6-.9 2.8-2.2 3.5 3.3 1.2 7.4.4 8.6-2.7.6-1.6.1-3.3-1.4-4.5z"/>',
    lanterne:
      '<path d="M12 2v3M9 5h6M9 19h6M12 19v3"/><path d="M12 5c3.9 0 6.5 3 6.5 7s-2.6 7-6.5 7-6.5-3-6.5-7 2.6-7 6.5-7z"/>',
    bol: '<path d="M3.5 11h17c0 4.7-3.8 8.5-8.5 8.5S3.5 15.7 3.5 11z"/><path d="M8 7.5c0-1.5 1-1.5 1-3M12 7.5c0-1.5 1-1.5 1-3M16 7.5c0-1.5 1-1.5 1-3"/>'
  };
</script>

<main class="screen troph">
  <button class="k quit" onclick={onretour}>‹ Ma forêt</button>
  <header class="tete">
    <div class="grow">
      <div class="k surtitre">Ce que tu as su lire</div>
      <h1>Trophées</h1>
    </div>
    <Tao stade={stadeDeTao} posture="chemin" humeur={humeurDeTao} size={72} />
  </header>

  <div class="card resume">
    <div class="compte">
      <div class="big">{t ? t.obtenus : '·'}</div>
      <div class="grow">
        <div class="fort">
          {t && t.obtenus > 1 ? 'trophées' : 'trophée'} sur {t ? t.total : '·'}
        </div>
        <div class="k">Chacun se gagne en lisant, jamais au temps passé.</div>
      </div>
    </div>
    {#if detail}
      <div class="det" aria-live="polite">
        <div class="fort">{entete(detail)} · {detail.nom}</div>
        <div class="k">{detail.detail}</div>
        {#if !detail.obtenu && detail.suivi}
          <div class="barre" aria-hidden="true"><i style="width:{Math.round(detail.part * 100)}%"></i></div>
          <div class="k chiffre">{detail.progres}</div>
        {/if}
      </div>
    {/if}
  </div>

  {#if t}
    {#each t.sections as s (s.famille)}
      <section class="sec">
        <div class="sec-tete">
          <h2>{s.titre}</h2>
          <span class="k">{s.obtenus} / {s.total}</span>
        </div>
        <p class="sec-h">
          {#if s.famille === 'serie'}<span class="que"><Que size={28} pose="pose" /></span>{/if}
          {s.explication}
        </p>
        {#if s.trophees.length === 0}
          <p class="k vide">{SECTION_VIDE[s.famille] ?? ''}</p>
        {:else}
          <div class="grille" class:g4={s.famille === 'serie'}>
            {#each s.trophees as x (x.id)}
              <button
                class="tro"
                class:off={!x.obtenu}
                class:sel={detail?.id === x.id && choisi !== null}
                aria-label="{x.nom}, {x.obtenu ? 'obtenu' : x.progres}"
                aria-pressed={choisi === x.id}
                onclick={() => (choisi = x.id)}
              >
                <span
                  class="sceau"
                  class:num={x.forme === 'nombre'}
                  class:hz={x.forme === 'caractere' || x.forme === 'paire'}
                  class:deux={x.forme === 'paire' && [...x.sceau].length === 2}
                  class:trois={x.forme === 'paire' && [...x.sceau].length > 2}
                >
                  {#if x.objet}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html PICTOS[x.objet]}
                    </svg>
                  {:else}
                    {x.sceau}
                  {/if}
                </span>
                <span class="n">{x.nom}</span>
                {#if !x.obtenu}<span class="p">{x.progres}</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</main>

<style>
  /* L'écran est long : il défile normalement, comme la page. */
  .troph .quit {
    margin-bottom: 2px;
  }
  .tete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 16px;
  }
  .tete h1 {
    margin: 0;
  }
  .surtitre {
    margin-bottom: 2px;
  }
  .fort {
    font-weight: 600;
    line-height: 1.3;
  }
  .compte {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .compte .big {
    font-size: 44px;
    font-variant-numeric: tabular-nums;
  }
  .det {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .det .k {
    margin-top: 2px;
    font-size: 14px;
    color: var(--ink2);
  }
  .det .chiffre {
    color: var(--mist);
    font-variant-numeric: tabular-nums;
  }
  .barre {
    height: 6px;
    margin-top: 10px;
    border-radius: 3px;
    background: var(--line);
    overflow: hidden;
  }
  .barre i {
    display: block;
    height: 100%;
    background: var(--indigo);
  }

  .sec-tete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    margin: 26px 2px 4px;
  }
  .sec-tete h2 {
    font-family: var(--head);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .sec-tete .k {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sec-h {
    font-size: 14px;
    color: var(--ink2);
    margin: 0 2px 10px;
    line-height: 1.35;
  }
  .que {
    float: right;
    margin: -4px 0 0 8px;
  }
  .vide {
    margin: 0 2px;
  }

  .grille {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .grille.g4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .tro {
    background: var(--card);
    border-radius: 14px;
    padding: 12px 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    text-align: center;
    min-width: 0;
  }
  .tro:active {
    background: var(--indigo-soft);
  }
  .tro.sel {
    outline: 2px solid var(--indigo);
    outline-offset: -2px;
  }

  /* Le sceau 印 : carré, gravé en blanc sur l'encre, un double filet autour. */
  .sceau {
    box-sizing: border-box;
    width: 54px;
    height: 54px;
    border-radius: 5px 4px 6px 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink);
    color: var(--paper);
    outline: 1.5px solid var(--ink);
    outline-offset: 2px;
    font-size: 25px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .sceau.num {
    font-family: var(--head);
    font-weight: 700;
    font-size: 16px;
  }
  .sceau.deux {
    font-size: 19px;
  }
  .sceau.trois {
    font-size: 14px;
  }
  .sceau svg {
    width: 28px;
    height: 28px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* À venir : contour en pointillés, texte en brume, pas de filet. */
  .tro.off .sceau {
    border: 1.5px dashed var(--line);
    background: transparent;
    color: var(--mist);
    outline: 0;
  }
  .tro .n {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ink);
    overflow-wrap: anywhere;
  }
  .tro.off .n {
    color: var(--ink2);
    font-weight: 400;
  }
  .tro .p {
    font-size: 12px;
    color: var(--mist);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    margin-top: -3px;
  }
</style>
