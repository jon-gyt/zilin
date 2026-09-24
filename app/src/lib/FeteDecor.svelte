<script lang="ts" module>
  /**
   * Un tirage pseudo-aléatoire à graine fixe (mulberry32) : le décor a l'air semé au
   * hasard, mais il est le même à chaque ouverture, et d'une capture à l'autre.
   */
  function hasard(graine: number): (a: number, b: number) => number {
    let x = graine;
    return (a, b) => {
      x = (x + 0x6d2b79f5) | 0;
      let t = Math.imul(x ^ (x >>> 15), 1 | x);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return a + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (b - a);
    };
  }

  const r = hasard(2027);
  const f1 = (n: number) => n.toFixed(1);

  /** 春节 : des fleurs de prunier qui tombent en tournant. Une sur trois plus pâle. */
  const PETALES = Array.from({ length: 11 }, (_, i) => ({
    style: `left:${f1(r(0, 96))}%;--d:${f1(r(11, 19))}s;--w:-${f1(r(0, 18))}s;--dx:${r(-60, 60).toFixed(0)}px;opacity:${r(0.55, 0.9).toFixed(2)}`,
    pale: i % 3 === 0
  }));

  /** 中秋 : des étoiles qui scintillent dans le tiers haut du ciel. */
  const ETOILES = Array.from({ length: 16 }, () => ({
    style: `left:${f1(r(2, 98))}%;top:${f1(r(1, 34))}%;--d:${f1(r(2.5, 5))}s;--w:-${f1(r(0, 5))}s`
  }));

  /** 中秋 : des lanternes célestes 孔明灯 qui montent lentement. */
  const LAMPIONS = Array.from({ length: 4 }, () => ({
    style: `left:${f1(r(4, 92))}%;--d:${f1(r(26, 40))}s;--w:-${f1(r(0, 36))}s;--dx:${r(-50, 50).toFixed(0)}px;--k:${r(0.7, 1.15).toFixed(2)}`
  }));

  /** 中秋 : des fleurs d'osmanthe 桂 qui tombent. */
  const OSMANTHES = Array.from({ length: 9 }, () => ({
    style: `left:${f1(r(0, 96))}%;--d:${f1(r(13, 22))}s;--w:-${f1(r(0, 20))}s;--dx:${r(-40, 40).toFixed(0)}px;opacity:${r(0.6, 0.95).toFixed(2)}`
  }));

  const CINQ = [0, 72, 144, 216, 288];
  const QUATRE = [0, 90, 180, 270];
</script>

<script lang="ts">
  /**
   * Le décor de fête : un calque derrière tout l'écran, jamais cliquable, muet pour les
   * lecteurs d'écran, et coupé quand l'utilisateur réduit les animations.
   *
   * Props :
   * - `fete` : `'chunjie'`, `'zhongqiu'` ou `null` (aucun décor).
   *
   * Aplats seulement : ni ombre, ni dégradé, ni doré. Les couleurs viennent des blocs
   * `[data-fete]` de `tokens.css`.
   */
  import type { FeteId } from './content';

  let { fete }: { fete: FeteId | null } = $props();
</script>

{#if fete}
  <div class="deco" aria-hidden="true">
    {#if fete === 'chunjie'}
      {#each PETALES as p, i (i)}
        <i style={p.style}>
          <svg width="14" height="14" viewBox="-10 -10 20 20">
            <g fill={p.pale ? 'var(--prunier-pale)' : 'var(--prunier)'}>
              {#each CINQ as a (a)}<ellipse cx="0" cy="-5" rx="3.6" ry="5" transform="rotate({a})" />{/each}
            </g>
            <circle r="2" fill="var(--apricot)" />
          </svg>
        </i>
      {/each}
    {:else}
      <!-- les collines et la pagode éclairée, au pied de l'écran -->
      <svg class="scene" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">
        <path d="M0 92q40-30 90-10t100-18q50-20 110 6t100-4V150H0z" fill="var(--hill2)" />
        <path d="M0 118q60-22 120-6t120-10q60-12 160 12V150H0z" fill="var(--hill)" />
        <g fill="var(--hill)">
          <path d="M318 118V78h14v40z" />
          <path d="M306 82h38l-8-8h-22z" />
          <path d="M310 70h30l-7-7h-16z" />
          <path d="M314 59h22l-6-6h-10z" />
          <path d="M323 53v-9h4v9z" />
        </g>
        <g fill="var(--gui)" opacity=".85">
          <rect x="322" y="86" width="6" height="7" rx="1" />
          <rect x="322" y="100" width="6" height="7" rx="1" />
        </g>
      </svg>
      {#each ETOILES as e, i (i)}<b style={e.style}></b>{/each}
      {#each LAMPIONS as l, i (i)}
        <u style={l.style}>
          <svg width="18" height="26" viewBox="0 0 18 26">
            <path d="M3.5 4Q9 .5 14.5 4L16.5 19Q9 21.5 1.5 19Z" fill="var(--lampion)" />
            <path d="M5 17.5Q9 19 13 17.5L13.6 19.6Q9 21 4.4 19.6Z" fill="var(--lampion-clair)" />
            <path d="M9 3v16M5.6 5l-1.4 13M12.4 5l1.4 13" stroke="var(--lampion-fil)" stroke-width=".8" opacity=".6" />
            <circle cx="9" cy="23.4" r="1.6" fill="var(--lampion-feu)" />
          </svg>
        </u>
      {/each}
      {#each OSMANTHES as o, i (i)}
        <i style={o.style}>
          <svg width="9" height="9" viewBox="-5 -5 10 10">
            <g fill="var(--gui)">
              {#each QUATRE as a (a)}<ellipse cx="0" cy="-2.4" rx="1.7" ry="2.4" transform="rotate({a})" />{/each}
            </g>
          </svg>
        </i>
      {/each}
    {/if}
  </div>
{/if}

<style>
  /* derrière tout le contenu de #app, au-dessus du papier ; jamais une cible de tap */
  .deco {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    overflow: hidden;
  }
  .scene {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 150px;
  }
  i {
    position: absolute;
    top: -24px;
    display: block;
    line-height: 0;
    animation: tombe var(--d) linear var(--w) infinite;
  }
  i svg {
    display: block;
    animation: tourne calc(var(--d) / 2) ease-in-out infinite alternate;
  }
  b {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--moon);
    animation: scintille var(--d) ease-in-out var(--w) infinite;
  }
  u {
    position: absolute;
    bottom: -30px;
    line-height: 0;
    text-decoration: none;
    animation: monte var(--d) linear var(--w) infinite;
  }
  /* la taille se règle par les dimensions : `transform` appartient à l'animation */
  u svg {
    width: calc(18px * var(--k));
    height: calc(26px * var(--k));
    animation: tourne 5s ease-in-out infinite alternate;
  }
  @keyframes tombe {
    from { transform: translate(0, 0); }
    to { transform: translate(var(--dx), calc(100vh + 48px)); }
  }
  @keyframes tourne {
    from { transform: rotate(-30deg); }
    to { transform: rotate(40deg); }
  }
  @keyframes monte {
    0% { transform: translate(0, 0); opacity: 0; }
    8% { opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translate(var(--dx), calc(-100vh - 40px)); opacity: 0; }
  }
  @keyframes scintille {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 0.9; }
  }
  @media (prefers-reduced-motion: reduce) {
    .deco { display: none; }
  }
</style>
