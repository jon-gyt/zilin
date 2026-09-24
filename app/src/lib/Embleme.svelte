<script lang="ts" module>
  const f1 = (n: number) => n.toFixed(1);

  /** Seize festons autour de la rosace, et seize jours découpés entre eux. */
  const FESTONS = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    return { x: f1(84 + 70 * Math.cos(a)), y: f1(84 + 70 * Math.sin(a)) };
  });
  const JOURS = Array.from({ length: 16 }, (_, i) => {
    const a = ((i + 0.5) * Math.PI) / 8;
    return `translate(${f1(84 + 74 * Math.cos(a))} ${f1(84 + 74 * Math.sin(a))}) rotate(${((i + 0.5) * 22.5 + 90).toFixed(2)})`;
  });

  /** 重阳 : deux couronnes de vingt-quatre pétales, la seconde entre les premiers. */
  const PETALES_JU = Array.from({ length: 24 }, (_, i) => i * 15);

  /** 清明 : des traits de pluie en biais, qui glissent le long d'eux-mêmes. */
  const PLUIE = Array.from({ length: 11 }, (_, i) => ({
    d: `M${-10 + i * 19} -8L${-44 + i * 19} 176`,
    style: `animation-delay:-${((i * 0.37) % 1.3).toFixed(2)}s`
  }));

  /** 清明 : les brins du saule, qui pendent de la branche. */
  const BRINS = [
    { d: 'M14 14q-6 24 2 50', f: [[12, 30], [11, 44], [14, 57]] },
    { d: 'M30 6q-4 22 4 44', f: [[29, 20], [30, 34], [33, 45]] },
    { d: 'M48 2q-2 16 5 30', f: [[48, 14], [51, 26]] }
  ];

  /** 冬至 : des flocons qui tombent sur la fenêtre. */
  const FLOCONS = Array.from({ length: 10 }, (_, i) => ({
    cx: f1(14 + ((i * 53) % 140)),
    r: f1(1.6 + ((i * 7) % 3) * 0.5),
    style: `animation-duration:${(7 + ((i * 3) % 5)).toFixed(1)}s;animation-delay:-${((i * 1.7) % 9).toFixed(1)}s`
  }));

  /**
   * 七夕 : les pies du pont, ailes ouvertes bout à bout sur un arc sous le caractère ; Que 雀,
   * le moineau, posé au sommet.
   */
  const PIES = [
    { x: 50, y: 152 },
    { x: 67, y: 148 },
    { x: 84, y: 146.5 },
    { x: 101, y: 148 },
    { x: 118, y: 152 }
  ];
</script>

<script lang="ts">
  /**
   * L'emblème de fête : le fond qui porte le caractère du jour, dessiné depuis ses traits.
   * Un par fête, tous sur le même gabarit (168 × 168, le caractère aux deux tiers, les
   * pointillés du 米字格 derrière lui) :
   *
   * - 春节 : une rosace de papier découpé rouge qui tourne lentement, autour d'une fenêtre
   *   ronde couleur papier. Le caractère à l'encre.
   * - 元宵 : une grande lanterne rouge, sa fenêtre de papier, son gland et une devinette 灯谜
   *   qui se balancent.
   * - 清明 : un disque vert de pluie, la pluie fine qui tombe, les brins d'un saule.
   * - 端午 : un disque vert de roseau, l'eau qui ondule, un bateau sans tête qui va et vient.
   * - 七夕 : un disque clair traversé par la Voie lactée en aplat, deux étoiles, et le pont
   *   de pies 鹊桥, ailes bout à bout, où Que 雀, le moineau, s'est posé.
   * - 中秋 : la pleine lune, ses cratères, le lapin de jade 玉兔 qui saute, deux nuages 祥云.
   *   Le caractère à l'encre de nuit, la brique nouvelle en cinabre.
   * - 重阳 : un chrysanthème de deux couronnes qui tourne lentement, la montagne au fond de
   *   la fenêtre.
   * - 冬至 : une fenêtre d'hiver où tombe la neige, un bol de 饺子 et de 汤圆.
   *
   * Props :
   * - `fete` : l'identifiant de la fête (`FeteId`). Obligatoire.
   * - `c` : le caractère posé au centre. Ses traits viennent de l'export (`traitsDe`) ;
   *   sans traits, le centre reste vide — jamais une police.
   * - `cinabre` : les indices des traits en cinabre (la brique nouvelle). Défaut : aucun.
   * - `size` : le côté de l'emblème, en px. Défaut 160 ; le caractère en fait les deux tiers.
   * - `write` : le caractère s'écrit au pinceau à l'apparition. Défaut `true`.
   * - `pistes` : les familles où chercher les traits (`fetes.pistes`, ou les briques du
   *   parcours), pour éviter de relire toutes les familles.
   * - `children` : un contenu à poser au centre à la place du caractère (snippet).
   *
   * L'emblème porte `data-fete` : ses couleurs sont celles de la fête même hors d'une page
   * en fête. Deux emblèmes peuvent coexister : les id de clipPath sont uniques. Décoratif
   * pour les lecteurs d'écran, sauf le caractère, qui garde son nom. Coupé en mouvement si
   * l'on réduit les animations. Aplats seulement : ni ombre, ni dégradé, ni doré, et pas de
   * bête sur le bateau (CLAUDE.md). Le cramoisi de fête (--fete) ne sert qu'à la rosace et à la
   * lanterne ; le cinabre ne marque que la brique nouvelle.
   */
  import type { Snippet } from 'svelte';
  import { traitsDe, type FeteId } from './content';
  import { glyph, type StrokeData } from './glyph';

  let {
    fete,
    c = '',
    cinabre = [],
    size = 160,
    write = true,
    pistes = [],
    children
  }: {
    fete: FeteId;
    c?: string;
    cinabre?: readonly number[];
    size?: number;
    write?: boolean;
    pistes?: readonly string[];
    children?: Snippet;
  } = $props();

  const uid = $props.id();
  const clip = `${uid}-mizi`;
  const taille = $derived(Math.round(size * 0.675));

  /** Les pointillés du 米字格, les mêmes sur chaque fond. */
  const MIZI = 'M84 0v168M0 84h168M0 0l168 168M168 0L0 168';

  /* undefined : pas encore chargé ; null : pas de traits, le centre reste vide. */
  let data: StrokeData | null | undefined = $state(undefined);

  $effect(() => {
    const car = c;
    const p = pistes;
    if (car === '') {
      data = null;
      return;
    }
    let vivant = true;
    traitsDe(car, p)
      .then((d) => {
        if (vivant) data = d;
      })
      .catch(() => {
        if (vivant) data = null;
      });
    return () => {
      vivant = false;
    };
  });
</script>

<div class="emb {fete}" data-fete={fete} style="width:{size}px;height:{size}px">
  <svg class="fond" viewBox="0 0 168 168" aria-hidden="true">
    {#if fete === 'zhongqiu'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="80" /></clipPath></defs>
      <g class="lune">
        <circle cx="84" cy="84" r="82" fill="var(--moon)" />
        <g clip-path="url(#{clip})" stroke="var(--moon-shade)" stroke-width="1.2" stroke-dasharray="3 4" fill="none">
          <path d={MIZI} />
        </g>
        <g fill="var(--moon-shade)" opacity=".7">
          <circle cx="14" cy="70" r="6" />
          <circle cx="152" cy="96" r="5" />
          <circle cx="92" cy="12" r="4.5" />
          <circle cx="70" cy="10" r="3" />
        </g>
        <g class="lapin" fill="var(--moon-shade)">
          <ellipse cx="90" cy="156" rx="9" ry="6.5" />
          <circle cx="80.5" cy="151" r="4.6" />
          <path d="M78.6 147.6q-2.6-8.6.4-10q1.8 1.8.8 10zM81.8 147.2q1.4-8.4 4.6-8.6q.8 2-2.6 9z" />
        </g>
      </g>
      {#each [{ x: -18, y: 118, k: 1.1, cls: 'nuage1' }, { x: 128, y: 26, k: 0.9, cls: 'nuage2' }] as n (n.cls)}
        <g class={n.cls}>
          <g transform="translate({n.x} {n.y}) scale({n.k})">
            <path
              d="M0 14c0-6 5-9 10-7c1-7 11-9 15-3c3-4 11-3 12 3c5-1 9 3 8 7z"
              fill="var(--paper)"
              stroke="var(--moon-shade)"
              stroke-width="1.6"
            />
            <path
              d="M10 11.5c.6-3 5-3.4 5.6 0M25 10c.8-2.6 4.6-2.8 5 0"
              fill="none"
              stroke="var(--moon-shade)"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </g>
        </g>
      {/each}
    {:else if fete === 'yuanxiao'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="60" /></clipPath></defs>
      <!-- la lanterne ne bouge pas, pour que la fenêtre reste sous le caractère ; son gland
           et la devinette accrochée à son flanc se balancent -->
      <path d="M84 -8v12" stroke="var(--apricot)" stroke-width="3" />
      <ellipse cx="84" cy="84" rx="82" ry="73" fill="var(--fete)" />
      <g fill="none" stroke="var(--apricot)" stroke-width="2" opacity=".6">
        <ellipse cx="84" cy="84" rx="34" ry="73" />
        <ellipse cx="84" cy="84" rx="62" ry="73" />
      </g>
      <rect x="54" y="3" width="60" height="11" rx="3" fill="var(--apricot)" />
      <rect x="54" y="154" width="60" height="11" rx="3" fill="var(--apricot)" />
      <circle cx="84" cy="84" r="64" fill="none" stroke="var(--apricot)" stroke-width="2.5" />
      <circle cx="84" cy="84" r="60" fill="var(--card)" />
      <g clip-path="url(#{clip})" stroke="var(--grille)" stroke-width="1.2" stroke-dasharray="3 4" fill="none">
        <path d={MIZI} />
      </g>
      <g class="gland">
        <circle cx="84" cy="169" r="3.5" fill="var(--apricot)" />
        <path d="M78 172v16M84 172v19M90 172v16" stroke="var(--fete)" stroke-width="3" stroke-linecap="round" />
      </g>
      <g class="mi">
        <path d="M152 104v10" stroke="var(--apricot)" stroke-width="2" />
        <rect x="144" y="113" width="16" height="36" rx="1.5" fill="var(--mi)" />
        <path d="M148 121h8M148 127h8M148 133h8M148 139h5" stroke="var(--mi-ink)" stroke-width="1.6" stroke-linecap="round" />
      </g>
    {:else if fete === 'qingming'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="80" /></clipPath></defs>
      <circle cx="84" cy="84" r="82" fill="var(--qm-disque)" />
      <g clip-path="url(#{clip})">
        <g stroke="var(--qm-ombre)" stroke-width="1.2" stroke-dasharray="3 4" fill="none"><path d={MIZI} /></g>
        <g class="pluie" stroke="var(--pluie)" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="7 15" fill="none">
          {#each PLUIE as p, i (i)}<path d={p.d} style={p.style} />{/each}
        </g>
      </g>
      <!-- le saule : une branche en haut à gauche, trois brins qui pendent et bougent au vent -->
      <path d="M-8 22q30-24 72-24" stroke="var(--saule-fonce)" stroke-width="3" fill="none" stroke-linecap="round" />
      {#each BRINS as b, i (i)}
        <g class="brin" style="animation-delay:-{i * 1.1}s">
          <path d={b.d} stroke="var(--saule)" stroke-width="1.6" fill="none" stroke-linecap="round" />
          {#each b.f as [x, y], j (j)}
            <ellipse cx={x} cy={y} rx="2.2" ry="5" fill="var(--saule)" transform="rotate({j % 2 ? 24 : -24} {x} {y})" />
          {/each}
        </g>
      {/each}
    {:else if fete === 'duanwu'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="80" /></clipPath></defs>
      <circle cx="84" cy="84" r="82" fill="var(--dw-disque)" />
      <g clip-path="url(#{clip})">
        <g stroke="var(--dw-ombre)" stroke-width="1.2" stroke-dasharray="3 4" fill="none"><path d={MIZI} /></g>
        <g class="vague">
          <path d="M-56 146q14-5 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0V170H-56z" fill="var(--eau-clair)" />
        </g>
        <!-- le bateau : une coque longue, des rameurs, un fanion. Ni tête ni queue de bête. -->
        <g class="barque">
          <path d="M62 140v-12l10 4l-10 4" fill="var(--bateau-bande)" />
          <path d="M56 144h56q-3 7-9 8H65q-6-1-9-8z" fill="var(--bateau)" />
          <path d="M58 146.5h52" stroke="var(--bateau-bande)" stroke-width="1.6" />
          <g fill="var(--ink)">
            {#each [74, 83, 92, 101] as x (x)}<circle cx={x} cy="140.5" r="2.3" />{/each}
          </g>
          <g stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round">
            {#each [74, 83, 92, 101] as x (x)}<path d="M{x} 142l-6 10" />{/each}
          </g>
        </g>
        <g class="vague vague2">
          <path d="M-56 152q14-4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0V170H-56z" fill="var(--eau)" />
        </g>
      </g>
    {:else if fete === 'qixi'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="80" /></clipPath></defs>
      <circle cx="84" cy="84" r="82" fill="var(--qx-disque)" />
      <g clip-path="url(#{clip})">
        <!-- la Voie lactée 银河, en aplat, en biais -->
        <path d="M0 116L116 0H172L0 172z" fill="var(--qx-voie)" />
        <g fill="var(--qx-ombre)">
          <circle cx="40" cy="104" r="1.3" /><circle cx="70" cy="80" r="1.1" /><circle cx="98" cy="46" r="1.3" />
          <circle cx="124" cy="26" r="1.1" /><circle cx="58" cy="100" r="1" /><circle cx="112" cy="50" r="1" />
        </g>
        <g stroke="var(--qx-ombre)" stroke-width="1.2" stroke-dasharray="3 4" fill="none"><path d={MIZI} /></g>
      </g>
      <!-- Véga, la tisserande, et Altaïr, le bouvier, de chaque côté -->
      <g class="astre" fill="var(--qx-etoile)">
        <path d="M34 30q1.4 7.6 9 9q-7.6 1.4-9 9q-1.4-7.6-9-9q7.6-1.4 9-9z" />
      </g>
      <g class="astre astre2" fill="var(--qx-etoile)">
        <path d="M140 104q1.2 6.4 7.6 7.6q-6.4 1.2-7.6 7.6q-1.2-6.4-7.6-7.6q6.4-1.2 7.6-7.6z" />
      </g>
      <!-- le pont de pies 鹊桥 -->
      <g class="pont">
        {#each PIES as p (p.x)}
          <!-- une pie vue de face, ailes ouvertes : le bout de ses ailes touche la voisine -->
          <g transform="translate({p.x} {p.y})">
            <path d="M-10 0Q-5-6 0-1Q5-6 10 0Q5-2.6 0 1.6Q-5-2.6-10 0z" fill="var(--qx-nuit)" />
            <path d="M-4.4-2.6Q-2.6-4 -1.2-2.2M4.4-2.6Q2.6-4 1.2-2.2" stroke="var(--qx-disque)" stroke-width="1" fill="none" />
            <circle cx="0" cy="-1" r="2.2" fill="var(--qx-nuit)" />
          </g>
        {/each}
        <!-- Que 雀, le moineau, posé au sommet du pont : plus rond, la gorge claire, le bec à l'ocre -->
        <g transform="translate(84 139.5)">
          <path d="M-4.4 1L-9 3.6L-8.4-.8z" fill="var(--qx-nuit)" />
          <ellipse cx="0" cy="0" rx="5" ry="4" fill="var(--qx-nuit)" />
          <ellipse cx=".6" cy="1.4" rx="2.8" ry="1.8" fill="var(--qx-disque)" />
          <circle cx="4.2" cy="-3" r="2.8" fill="var(--qx-nuit)" />
          <path d="M6.6-3.4L9.8-2.5L6.6-1.6z" fill="var(--ocre)" />
        </g>
      </g>
    {:else if fete === 'chongyang'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="60" /></clipPath></defs>
      <g class="tourne lent">
        <g fill="var(--ju)">
          {#each PETALES_JU as a (a)}<ellipse cx="84" cy="15" rx="6.4" ry="15" transform="rotate({a} 84 84)" />{/each}
        </g>
        <g fill="var(--ju-clair)">
          {#each PETALES_JU as a (a)}<ellipse cx="84" cy="22" rx="5" ry="10" transform="rotate({a + 7.5} 84 84)" />{/each}
        </g>
      </g>
      <circle cx="84" cy="84" r="60" fill="var(--card)" />
      <g clip-path="url(#{clip})">
        <!-- la montagne où l'on monte, 登高, au fond de la fenêtre -->
        <path d="M18 150L48 128L62 136L90 118L118 140L132 132L156 150V170H18z" fill="var(--mont2)" />
        <g stroke="var(--grille)" stroke-width="1.2" stroke-dasharray="3 4" fill="none"><path d={MIZI} /></g>
      </g>
    {:else if fete === 'dongzhi'}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="80" /></clipPath></defs>
      <circle cx="84" cy="84" r="82" fill="var(--dz-disque)" />
      <g clip-path="url(#{clip})">
        <g stroke="var(--dz-ombre)" stroke-width="1.2" stroke-dasharray="3 4" fill="none"><path d={MIZI} /></g>
        <g fill="var(--neige)">
          {#each FLOCONS as f, i (i)}<circle class="flocon" cx={f.cx} cy="-6" r={f.r} style={f.style} />{/each}
        </g>
      </g>
      <!-- le bol : deux 饺子 du nord, un 汤圆 du sud -->
      <g stroke="var(--bol)" stroke-width="1.4" stroke-linejoin="round">
        <path d="M62 152q8-12 16 0z" fill="var(--raviole)" />
        <path d="M90 152q8-12 16 0z" fill="var(--raviole)" />
        <circle cx="84" cy="148" r="4.8" fill="var(--tangyuan)" />
      </g>
      <path d="M56 152h56q-3 16-28 16t-28-16z" fill="var(--bol)" />
      <path d="M52 152h64" stroke="var(--bol)" stroke-width="3.6" stroke-linecap="round" />
    {:else}
      <defs><clipPath id={clip}><circle cx="84" cy="84" r="61" /></clipPath></defs>
      <g class="tourne">
        <g fill="var(--fete)">
          {#each FESTONS as f, i (i)}<circle cx={f.x} cy={f.y} r="14" />{/each}
          <circle cx="84" cy="84" r="72" />
        </g>
        {#each JOURS as t, i (i)}<path d="M0-5L3.2 0L0 5L-3.2 0Z" transform={t} fill="var(--paper)" />{/each}
        <circle cx="84" cy="84" r="66" fill="none" stroke="var(--paper)" stroke-width="2" stroke-dasharray="4 5" />
      </g>
      <circle cx="84" cy="84" r="61" fill="var(--card)" />
      <g clip-path="url(#{clip})" stroke="var(--grille)" stroke-width="1.2" stroke-dasharray="3 4" fill="none">
        <path d={MIZI} />
      </g>
    {/if}
  </svg>
  <div class="car">
    {#if children}
      {@render children()}
    {:else if data}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html glyph(c, data, taille, { write, cinabre })}
    {/if}
  </div>
</div>

<style>
  .emb {
    position: relative;
    flex-shrink: 0;
    line-height: 0;
    background: transparent;
  }
  .fond {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .car {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* la lune est claire, la nuit autour ne l'est pas : le caractère à l'encre de nuit, et le
     vrai cinabre, qui se lit sur la lune mieux que le cinabre éclairci de la nuit. Même chose
     sur le disque clair de 七夕. */
  .zhongqiu .car {
    --zhu: #c8371f;
    color: var(--nuit);
  }
  .zhongqiu .car :global(.g) {
    color: var(--nuit);
  }
  .qixi .car {
    --zhu: #c8371f;
    color: var(--qx-nuit);
  }
  .qixi .car :global(.g) {
    color: var(--qx-nuit);
  }
  .car :global(.g) {
    color: var(--ink);
  }
  .lune {
    transform-origin: 84px 84px;
    animation: lune 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .nuage1 {
    animation: passe 11s ease-in-out infinite alternate;
  }
  .nuage2 {
    animation: passe 14s ease-in-out -5s infinite alternate-reverse;
  }
  .lapin {
    animation: hopla 3.2s ease-in-out 1.8s infinite;
  }
  .tourne {
    transform-origin: 84px 84px;
    animation: rosace 60s linear infinite;
  }
  .tourne.lent {
    animation-duration: 120s;
  }
  .gland {
    transform-origin: 84px 166px;
    animation: balance 2.8s ease-in-out infinite alternate;
  }
  .mi {
    transform-origin: 152px 104px;
    animation: balance 3.4s ease-in-out -1.2s infinite alternate;
  }
  .pluie path {
    animation: pluie 1.3s linear infinite;
  }
  .brin {
    transform-origin: 30px 6px;
    animation: vent 4.2s ease-in-out infinite alternate;
  }
  .vague {
    animation: vague 6s linear infinite;
  }
  .vague2 {
    animation-duration: 4.4s;
    animation-direction: reverse;
  }
  .barque {
    animation: rame 9s ease-in-out infinite alternate;
  }
  .astre {
    animation: scintille 3.6s ease-in-out infinite;
  }
  .astre2 {
    animation-delay: -1.8s;
  }
  .pont {
    animation: bat 3s ease-in-out infinite alternate;
  }
  .flocon {
    animation-name: neige;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  @keyframes lune {
    from { transform: translateY(40px) scale(0.7); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
  @keyframes passe {
    from { transform: translateX(-26px); }
    to { transform: translateX(22px); }
  }
  @keyframes hopla {
    0%, 80%, 100% { transform: none; }
    86% { transform: translateY(-6px); }
    92% { transform: none; }
  }
  @keyframes rosace {
    to { transform: rotate(360deg); }
  }
  @keyframes balance {
    from { transform: rotate(-5deg); }
    to { transform: rotate(5deg); }
  }
  @keyframes pluie {
    to { stroke-dashoffset: -44; }
  }
  @keyframes vent {
    from { transform: rotate(-3deg); }
    to { transform: rotate(4deg); }
  }
  @keyframes vague {
    to { transform: translateX(56px); }
  }
  @keyframes rame {
    from { transform: translateX(-14px); }
    to { transform: translateX(12px); }
  }
  @keyframes scintille {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  @keyframes bat {
    from { transform: translateY(0); }
    to { transform: translateY(-3px); }
  }
  @keyframes neige {
    to { transform: translate(-10px, 180px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .fond * {
      animation: none !important;
    }
  }
</style>
