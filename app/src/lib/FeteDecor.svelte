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

  /** 中秋, 七夕 : des étoiles qui scintillent dans le tiers haut du ciel. */
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

  /*
   * Les six fêtes suivantes tirent leur hasard d'une autre graine : le décor du Nouvel An
   * et de la mi-automne ne bouge pas d'un pixel.
   */
  const s = hasard(2036);

  /** Des éléments qui tombent en tournant, comme les fleurs de prunier. */
  function chute(n: number, d: [number, number], dx: number, o: [number, number]): { style: string }[] {
    return Array.from({ length: n }, () => ({
      style: `left:${f1(s(0, 96))}%;--d:${f1(s(d[0], d[1]))}s;--w:-${f1(s(0, d[1]))}s;--dx:${s(-dx, dx).toFixed(0)}px;opacity:${s(o[0], o[1]).toFixed(2)}`
    }));
  }

  /** 元宵 : des lanternes pendues aux bords de l'écran, chacune avec sa devinette 灯谜. */
  const PENDUES = [
    { cote: 'left:.5%', l: 64, d: 3.2 },
    { cote: 'left:4.5%', l: 200, d: 3.8 },
    { cote: 'right:.5%', l: 150, d: 3.5 },
    { cote: 'right:24%', l: 44, d: 4.1 }
  ].map((p, i) => ({ style: `${p.cote};--l:${p.l}px;--d:${p.d}s;--w:-${f1(i * 0.9)}s` }));
  /** 元宵 : des papiers de devinettes qui descendent en tournoyant. */
  const DEVINETTES = chute(6, [16, 24], 50, [0.55, 0.85]);

  /** 清明 : la pluie fine, en biais, et quelques feuilles de saule. */
  const GOUTTES = Array.from({ length: 22 }, () => ({
    style: `left:${f1(s(0, 124))}%;--d:${f1(s(1.1, 1.9))}s;--w:-${f1(s(0, 2))}s;opacity:${s(0.2, 0.42).toFixed(2)};height:${s(10, 18).toFixed(0)}px`
  }));
  const FEUILLES_SAULE = chute(5, [15, 22], 70, [0.6, 0.9]);

  /** 端午 : deux bateaux qui passent au pied de l'écran, des feuilles de roseau qui tombent. */
  const BATEAUX = [
    { style: 'bottom:34px;--d:46s;--w:-6s;--k:1' },
    { style: 'bottom:12px;--d:62s;--w:-38s;--k:.8' }
  ];
  const ROSEAUX = chute(5, [16, 24], 60, [0.5, 0.8]);

  /** 七夕 : les pies du pont, en vol, ailes bout à bout sur un arc ; Que 雀 au sommet. */
  const VOL = [
    { x: 0, y: 22 },
    { x: 22, y: 12 },
    { x: 44, y: 6 },
    { x: 66, y: 4 },
    { x: 88, y: 6 },
    { x: 110, y: 12 },
    { x: 132, y: 22 }
  ].map((o, i) => ({ ...o, w: `-${f1(i * 0.23)}s` }));

  /** 重阳 : des pétales de chrysanthème qui tombent. */
  const PETALES_JU = chute(9, [14, 22], 50, [0.6, 0.9]);

  /** 冬至 : une neige légère, un flocon sur deux bleuté. */
  const NEIGE = Array.from({ length: 24 }, (_, i) => ({
    style: `left:${f1(s(0, 98))}%;--d:${f1(s(14, 26))}s;--w:-${f1(s(0, 26))}s;--dx:${s(-50, 50).toFixed(0)}px;--t:${s(3, 6).toFixed(1)}px`,
    bleu: i % 2 === 1
  }));
</script>

<script lang="ts">
  /**
   * Le décor de fête : un calque derrière tout l'écran, jamais cliquable, muet pour les
   * lecteurs d'écran, et coupé quand l'utilisateur réduit les animations.
   *
   * - 春节 : des fleurs de prunier qui tombent.
   * - 元宵 : des lanternes pendues aux bords, chacune avec sa devinette 灯谜, et des papiers
   *   de devinettes qui descendent.
   * - 清明 : la pluie fine en biais, un saule dans le coin, un cerf-volant qui flotte.
   * - 端午 : l'eau au pied de l'écran, deux bateaux sans tête qui passent, l'armoise 艾
   *   pendue au coin, des feuilles de roseau.
   * - 七夕 : la Voie lactée en aplat, les étoiles, Véga et Altaïr de chaque côté, et un vol
   *   de pies en arc — le pont —, avec Que 雀, le moineau, au milieu.
   * - 中秋 : les étoiles, les collines et la pagode, les lanternes célestes, l'osmanthe.
   * - 重阳 : la montagne au pied de l'écran, un vol d'oies, des pétales de chrysanthème.
   * - 冬至 : une neige légère, des collines enneigées.
   *
   * Props :
   * - `fete` : l'identifiant de la fête du jour, ou `null` (aucun décor).
   *
   * Aplats seulement : ni ombre, ni dégradé, ni doré, et pas de bête sur les bateaux (CLAUDE.md). Les couleurs viennent
   * des blocs `[data-fete]` de `tokens.css`.
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
    {:else if fete === 'zhongqiu'}
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
    {:else if fete === 'yuanxiao'}
      {#each PENDUES as p, i (i)}
        <em class="pendue" style={p.style}>
          <span class="fil"></span>
          <svg width="20" height="52" viewBox="0 0 20 52">
            <rect x="5" y="0" width="10" height="3" rx="1" fill="var(--apricot)" />
            <ellipse cx="10" cy="12" rx="9.5" ry="9" fill="var(--fete)" />
            <path d="M10 3v18M5 4.5q-4 7.5 0 15M15 4.5q4 7.5 0 15" stroke="var(--apricot)" stroke-width="1" fill="none" opacity=".7" />
            <rect x="5" y="20.5" width="10" height="3" rx="1" fill="var(--apricot)" />
            <path d="M10 23.5v4" stroke="var(--fete)" stroke-width="1.4" />
            <rect x="6" y="27.5" width="8" height="22" rx="1" fill="var(--mi)" />
            <path d="M8.2 32h3.6M8.2 36h3.6M8.2 40h3.6M8.2 44h2" stroke="var(--mi-ink)" stroke-width="1" stroke-linecap="round" />
          </svg>
        </em>
      {/each}
      {#each DEVINETTES as d, i (i)}
        <i style={d.style}>
          <svg width="10" height="20" viewBox="0 0 10 20">
            <rect width="10" height="20" rx="1" fill="var(--mi)" />
            <path d="M3 5h4M3 9h4M3 13h4" stroke="var(--mi-ink)" stroke-width="1" stroke-linecap="round" />
          </svg>
        </i>
      {/each}
    {:else if fete === 'qingming'}
      <!-- le saule du coin : une branche qui sort du bord, des brins qui pendent et bougent -->
      <svg class="saule" width="130" height="230" viewBox="0 0 130 230">
        <path d="M134 6q-50 4-104 28" stroke="var(--saule-fonce)" stroke-width="3" fill="none" stroke-linecap="round" />
        {#each [[40, 30, 130], [62, 22, 180], [84, 15, 150], [106, 10, 210], [124, 7, 120]] as [x, y, h], i (i)}
          <g class="brin" style="transform-origin:{x}px {y}px;animation-delay:-{f1(i * 0.8)}s">
            <path d="M{x} {y}q-8 {h / 2} 2 {h}" stroke="var(--saule)" stroke-width="1.4" fill="none" />
            {#each [0.25, 0.45, 0.65, 0.85] as t, j (j)}
              <ellipse
                cx={x - 3 + t * 2}
                cy={y + t * h}
                rx="2"
                ry="5"
                fill="var(--saule)"
                transform="rotate({j % 2 ? 28 : -28} {x - 3 + t * 2} {y + t * h})"
              />
            {/each}
          </g>
        {/each}
      </svg>
      {#each GOUTTES as g, i (i)}<i class="goutte" style={g.style}></i>{/each}
      {#each FEUILLES_SAULE as f, i (i)}
        <i style={f.style}>
          <svg width="6" height="14" viewBox="0 0 6 14"><ellipse cx="3" cy="7" rx="2.4" ry="6.5" fill="var(--saule)" /></svg>
        </i>
      {/each}
      <!-- le cerf-volant : un losange, une queue de rubans, le fil qui descend -->
      <svg class="cerf" width="46" height="110" viewBox="0 0 46 110">
        <path d="M23 20L2 110" stroke="var(--pluie)" stroke-width=".8" />
        <path d="M23 0L38 18L23 40L8 18z" fill="var(--cerf)" />
        <path d="M23 0L23 40M8 18H38" stroke="var(--cerf-clair)" stroke-width="1.2" />
        <path class="queue" d="M23 40q-6 8 0 16t0 16t0 14" stroke="var(--cerf-queue)" stroke-width="1.6" fill="none" />
        <g fill="var(--cerf-queue)">
          <path d="M23 50l-5-3l1 5zM23 50l5-3l-1 5zM23 66l-5-3l1 5zM23 66l5-3l-1 5z" />
        </g>
      </svg>
    {:else if fete === 'duanwu'}
      <!-- l'armoise 艾, en bouquet, pendue au coin comme à la porte -->
      <svg class="armoise" width="46" height="160" viewBox="0 -40 46 160">
        <path d="M23-40v62" stroke="var(--ficelle)" stroke-width="1.6" />
        <g stroke="var(--ai)" stroke-width="1.8" fill="none" stroke-linecap="round">
          <path d="M23 22q-2 44-10 94M23 22q0 46 0 96M23 22q2 44 10 94" />
        </g>
        <path d="M17 26h12" stroke="var(--ficelle)" stroke-width="3" stroke-linecap="round" />
        <g fill="var(--ai)">
          {#each [40, 56, 72, 88, 102] as y, i (y)}
            <ellipse cx={17 - i * 0.8} cy={y} rx="2.6" ry="7" transform="rotate(-30 {17 - i * 0.8} {y})" />
            <ellipse cx={29 + i * 0.8} cy={y + 6} rx="2.6" ry="7" transform="rotate(30 {29 + i * 0.8} {y + 6})" />
            <ellipse cx="23" cy={y + 12} rx="2.4" ry="6" transform="rotate({i % 2 ? 20 : -20} 23 {y + 12})" />
          {/each}
        </g>
      </svg>
      {#each ROSEAUX as f, i (i)}
        <i style={f.style}>
          <svg width="8" height="20" viewBox="0 0 8 20"><path d="M4 0q5 10 0 20q-5-10 0-20z" fill="var(--roseau-clair)" /></svg>
        </i>
      {/each}
      <svg class="scene" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">
        <path d="M0 104q25-8 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0V150H0z" fill="var(--eau-clair)" />
      </svg>
      <!-- deux bateaux : une coque, un fanion, des rameurs. Ni tête ni queue de bête. -->
      {#each BATEAUX as b, i (i)}
        <s class="bateau" style={b.style}>
          <svg width="96" height="34" viewBox="0 0 96 34">
            <path d="M16 18V2l12 5l-12 5" fill="var(--bateau-bande)" />
            <path d="M2 22h92q-5 10-14 12H16q-9-2-14-12z" fill="var(--bateau)" />
            <path d="M5 25.5h86" stroke="var(--bateau-bande)" stroke-width="2" />
            <g fill="var(--ink)">
              {#each [32, 44, 56, 68, 80] as x (x)}<circle cx={x} cy="16.5" r="3" />{/each}
            </g>
            <g stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round">
              {#each [32, 44, 56, 68, 80] as x (x)}<path class="rame" d="M{x} 19l-8 14" />{/each}
            </g>
          </svg>
        </s>
      {/each}
      <svg class="scene eau" viewBox="0 0 400 60" preserveAspectRatio="xMidYMax slice">
        <path d="M0 30q20-7 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0V60H0z" fill="var(--eau)" />
      </svg>
    {:else if fete === 'qixi'}
      <!-- la Voie lactée 银河, un aplat en biais d'un coin à l'autre -->
      <svg class="ciel" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 64L62 0H92L0 100z" fill="var(--voie)" />
        <path d="M0 80L76 0H84L0 90z" fill="var(--voie-clair)" />
      </svg>
      {#each ETOILES as e, i (i)}<b class="etoile" style={e.style}></b>{/each}
      <!-- Véga, la tisserande 织女, et Altaïr, le bouvier 牛郎, de chaque côté -->
      {#each ['left:10%;top:30%', 'right:12%;top:58%'] as pos, i (i)}
        <svg class="astre" style="{pos};animation-delay:-{i * 1.7}s" width="16" height="16" viewBox="-8 -8 16 16">
          <path d="M0-8q1.2 6.8 8 8q-6.8 1.2-8 8q-1.2-6.8-8-8q6.8-1.2 8-8z" fill="var(--etoile)" />
        </svg>
      {/each}
      <!-- le pont : un vol de pies en arc, Que 雀 au sommet -->
      <s class="vol">
        <svg width="160" height="46" viewBox="-14 -16 160 46">
          {#each VOL as o, i (i)}
            <!-- une pie vue de face, ailes ouvertes, le blanc des épaules -->
            <g transform="translate({o.x} {o.y})">
              <g class="aile" style="animation-delay:{o.w}">
                <path d="M-13 0Q-6.5-8 0-1.4Q6.5-8 13 0Q6.5-3.4 0 2Q-6.5-3.4-13 0z" fill="var(--pie)" />
                <path d="M-6-3.4Q-3.6-5.2-1.6-3M6-3.4Q3.6-5.2 1.6-3" stroke="var(--pie-blanc)" stroke-width="1.3" fill="none" />
              </g>
              <circle cx="0" cy="-1.2" r="2.8" fill="var(--pie)" />
            </g>
          {/each}
          <!-- Que 雀, le moineau, posé au sommet : à l'encre, la gorge claire, le bec à l'ocre -->
          <g transform="translate(66 -6)">
            <path d="M-5 1L-10 4L-9.4-1z" fill="var(--ink)" />
            <ellipse cx="0" cy="0" rx="5.6" ry="4.4" fill="var(--ink)" />
            <ellipse cx=".6" cy="1.6" rx="3" ry="1.9" fill="var(--paper)" />
            <circle cx="4.6" cy="-3.2" r="3" fill="var(--ink)" />
            <path d="M7.2-3.6L10.8-2.6L7.2-1.6z" fill="var(--ocre)" />
          </g>
        </svg>
      </s>
    {:else if fete === 'chongyang'}
      <!-- un vol d'oies sauvages 雁, en V, qui traverse le haut du ciel -->
      <s class="oies">
        <svg width="70" height="30" viewBox="0 0 70 30">
          <g stroke="var(--yan)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
            {#each [[35, 4], [24, 11], [46, 11], [13, 18], [57, 18]] as [x, y], i (i)}
              <path d="M{x - 5} {y + 2}l5-3l5 3" />
            {/each}
          </g>
        </svg>
      </s>
      {#each PETALES_JU as p, i (i)}
        <i style={p.style}>
          <svg width="6" height="13" viewBox="0 0 6 13"><ellipse cx="3" cy="6.5" rx="2.4" ry="6" fill="var(--ju)" /></svg>
        </i>
      {/each}
      <!-- la montagne où l'on monte, 登高, au pied de l'écran -->
      <svg class="scene" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">
        <path d="M0 110L46 70L78 92L130 44L178 90L214 66L262 104L312 58L360 96L400 76V150H0z" fill="var(--mont2)" />
        <path d="M0 128L60 100L104 118L160 94L226 124L280 104L340 126L400 108V150H0z" fill="var(--mont)" />
      </svg>
    {:else if fete === 'dongzhi'}
      <!-- 冬至 : une neige légère sur des collines enneigées -->
      <svg class="scene" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice">
        <path d="M0 100q50-24 110-8t110-10q70-14 180 12V150H0z" fill="var(--colline2)" />
        <path d="M0 122q70-18 140-4t130-8q70-8 130 10V150H0z" fill="var(--colline)" />
      </svg>
      {#each NEIGE as n, i (i)}<i class="neige" class:bleu={n.bleu} style={n.style}></i>{/each}
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

  /* ---- 元宵 ---- */
  .pendue {
    position: absolute;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 0;
    transform-origin: 50% 0;
    animation: balance var(--d) ease-in-out var(--w) infinite alternate;
  }
  .fil {
    display: block;
    width: 1.5px;
    height: var(--l);
    background: var(--apricot);
  }

  /* ---- 清明 ---- */
  .goutte {
    top: -30px;
    width: 1.2px;
    background: var(--pluie);
    transform-origin: 50% 0;
    animation-name: pluie;
  }
  .saule {
    position: absolute;
    top: 0;
    right: 0;
    opacity: 0.8;
  }
  .brin {
    animation: vent 4.6s ease-in-out infinite alternate;
  }
  .cerf {
    position: absolute;
    right: 3%;
    top: 57%;
    transform-origin: 50% 18%;
    animation: flotte 7s ease-in-out infinite alternate;
  }

  /* ---- 端午 ---- */
  .armoise {
    position: absolute;
    top: 0;
    right: -4px;
    transform-origin: 50% 0;
    animation: balance 4.4s ease-in-out infinite alternate;
  }
  .eau {
    height: 60px;
  }
  .bateau {
    position: absolute;
    left: 0;
    line-height: 0;
    text-decoration: none;
    animation: traverse var(--d) linear var(--w) infinite;
  }
  .bateau svg {
    width: calc(96px * var(--k));
    height: calc(34px * var(--k));
    animation: tangue 2.6s ease-in-out infinite alternate;
  }
  .rame {
    transform-box: fill-box;
    transform-origin: 100% 0;
    animation: rame 1.2s ease-in-out infinite alternate;
  }

  /* ---- 七夕 ---- */
  .ciel {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .etoile {
    background: var(--etoile);
  }
  .astre {
    position: absolute;
    animation: scintille 3.4s ease-in-out infinite;
  }
  .vol {
    position: absolute;
    top: 13%;
    left: 0;
    line-height: 0;
    text-decoration: none;
    animation: traverse 52s linear -20s infinite;
  }
  .aile {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: bat 0.9s ease-in-out infinite alternate;
  }

  /* ---- 重阳 ---- */
  .oies {
    position: absolute;
    top: 9%;
    left: 0;
    line-height: 0;
    text-decoration: none;
    animation: traverse 64s linear -30s infinite;
  }

  /* ---- 冬至 ---- */
  .neige {
    width: var(--t);
    height: var(--t);
    border-radius: 50%;
    background: var(--neige);
    opacity: 0.9;
  }
  .neige.bleu {
    background: var(--neige-bleu);
    opacity: 0.7;
  }

  @keyframes tombe {
    from { transform: translate(0, 0); }
    to { transform: translate(var(--dx), calc(100vh + 48px)); }
  }
  @keyframes pluie {
    from { transform: translate(0, 0) rotate(14deg); }
    to { transform: translate(-26vh, calc(100vh + 48px)) rotate(14deg); }
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
  @keyframes balance {
    from { transform: rotate(-4deg); }
    to { transform: rotate(4deg); }
  }
  @keyframes vent {
    from { transform: rotate(-3deg); }
    to { transform: rotate(4deg); }
  }
  @keyframes flotte {
    from { transform: translate(0, 0) rotate(-6deg); }
    to { transform: translate(-14px, -10px) rotate(5deg); }
  }
  @keyframes traverse {
    from { transform: translateX(-180px); }
    to { transform: translateX(calc(100vw + 20px)); }
  }
  @keyframes tangue {
    from { transform: translateY(0) rotate(-1.5deg); }
    to { transform: translateY(-3px) rotate(1.5deg); }
  }
  @keyframes rame {
    from { transform: rotate(-14deg); }
    to { transform: rotate(14deg); }
  }
  @keyframes bat {
    from { transform: scaleY(1); }
    to { transform: scaleY(-0.4); }
  }
  @media (prefers-reduced-motion: reduce) {
    .deco { display: none; }
  }
</style>
