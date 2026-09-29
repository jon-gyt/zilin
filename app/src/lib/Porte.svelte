<script lang="ts">
  /**
   * La porte de ville 城门 d'un examen (maquette validée `maquettes/chemin.html`, décision du
   * propriétaire du 29 septembre 2026 : « Borne et stèle font un peu cimetière… ») : un toit
   * relevé, un mur, une porte en arc, et le nom de l'examen sur le linteau, dessiné depuis
   * ses traits. À venir, au pointillé d'indigo ; ouverte (l'examen à passer), au trait plein,
   * le passage au jade pâle. Elle remplace la stèle partout : « Mon personnage » (« Reste le
   * 院试 »), la ligne d'examen du menu, la suite d'un examen.
   *
   * Un décor : caché aux lecteurs d'écran, la ligne qui l'accompagne dit ce qu'il faut.
   */
  import { traitsDe } from './content';
  import { glyph, type StrokeData } from './glyph';

  let {
    hz = '',
    pistes = [],
    largeur = 56,
    ouverte = false
  }: {
    /** Le nom de l'examen, sur le linteau ; vide, une porte sans nom (un picto). */
    hz?: string;
    pistes?: readonly string[];
    largeur?: number;
    ouverte?: boolean;
  } = $props();

  let traits = $state.raw<Record<string, StrokeData | null>>({});

  $effect(() => {
    const cs = [...new Set([...hz])];
    const p = pistes;
    let vivant = true;
    void Promise.all(cs.map((c) => traitsDe(c, p).catch(() => null))).then((ds) => {
      if (!vivant) return;
      const n: Record<string, StrokeData | null> = {};
      cs.forEach((c, k) => (n[c] = ds[k]));
      traits = n;
    });
    return () => {
      vivant = false;
    };
  });

  const noms = $derived([...hz]);
  /** Le linteau : assez large pour le nom, deux caractères côte à côte. */
  const taille = $derived(noms.length <= 2 ? 12 : 9);
</script>

<svg class="porte-ville" class:ouverte width={largeur} height={(largeur * 52) / 80} viewBox="-40 0 80 52" aria-hidden="true">
  <path class="toit" d="M-38 16q13-2 19-14h38q6 12 19 14z" />
  <rect class="mur" x="-31" y="16" width="62" height="34" />
  <path class="arc" d="M-10 50v-11a10 10 0 0 1 20 0v11" />
  {#if noms.length > 0}
    <rect class="linteau" x="-17" y="19" width="34" height="14" rx="1.5" />
    {#each noms as c, i (c + i)}
      {@const x = -((noms.length * taille) / 2) + i * taille}
      <g transform="translate({x} {26 - taille / 2})">
        {#if traits[c]}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html glyph(c, traits[c] ?? undefined, taille, { write: false, color: 'var(--indigo)' })}
        {:else}
          <text x={taille / 2} y={taille * 0.85} text-anchor="middle" class="hz" style="font-size:{taille * 0.86}px;fill:var(--indigo)">{c}</text>
        {/if}
      </g>
    {/each}
  {/if}
</svg>

<style>
  .porte-ville {
    display: block;
    flex: none;
    overflow: visible;
  }
  .toit,
  .mur,
  .arc {
    fill: var(--card);
    stroke: var(--indigo);
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }
  .linteau {
    fill: var(--card);
    stroke: var(--indigo);
    stroke-width: 1.2;
  }
  /* l'examen à passer : la porte s'ouvre, au trait plein, le passage au jade pâle */
  .ouverte .toit,
  .ouverte .mur,
  .ouverte .arc {
    stroke-dasharray: none;
    stroke-width: 2.2;
  }
  .ouverte .arc {
    fill: var(--jade-soft);
  }
</style>
