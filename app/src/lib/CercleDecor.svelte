<script lang="ts" module>
  /**
   * Des éléments semés dans les coins du cercle : leur place, leur durée, leur retard.
   * Tout est écrit ici, sans hasard : le décor est le même à chaque ouverture, et d'une
   * capture à l'autre.
   */
  type Semis = { x: number; y: number; d: number; w: number; k?: number; r?: number };

  /** Une fleur à cinq pétales, centrée en 0 0. */
  const CINQ = [0, 72, 144, 216, 288].map((a) => ({
    x: Math.round(Math.cos(((a - 90) * Math.PI) / 180) * 650) / 100,
    y: Math.round(Math.sin(((a - 90) * Math.PI) / 180) * 650) / 100
  }));

  /** Les six bras d'un flocon. */
  const SIX = [0, 60, 120, 180, 240, 300];

  /** Un pétale qui tombe, dans les coins du haut et du bas. */
  const PETALES: Semis[] = [
    { x: 548, y: 18, d: 13, w: 0 },
    { x: 606, y: 40, d: 16, w: 6 },
    { x: 130, y: 560, d: 15, w: 3 },
    { x: 20, y: 470, d: 18, w: 9 }
  ];

  /** La pluie fine : des traits courts, en biais. */
  const PLUIE: Semis[] = [
    { x: 24, y: 470, d: 1.6, w: 0 },
    { x: 56, y: 500, d: 1.9, w: 0.7 },
    { x: 96, y: 540, d: 1.4, w: 0.3 },
    { x: 20, y: 560, d: 1.7, w: 1.1 },
    { x: 140, y: 580, d: 1.5, w: 0.5 },
    { x: 66, y: 590, d: 1.8, w: 0.2 },
    { x: 110, y: 610, d: 1.5, w: 0.9 },
    { x: 40, y: 520, d: 1.7, w: 0.4 },
    { x: 170, y: 616, d: 1.6, w: 1.3 },
    { x: 14, y: 606, d: 1.9, w: 0.6 }
  ];

  /** La pluie fine des termes du printemps, dans les deux coins du haut. */
  const PLUIE_HAUT: Semis[] = [
    { x: 24, y: 30, d: 1.6, w: 0 },
    { x: 60, y: 70, d: 1.9, w: 0.7 },
    { x: 100, y: 24, d: 1.4, w: 0.3 },
    { x: 30, y: 120, d: 1.7, w: 1.1 },
    { x: 140, y: 50, d: 1.5, w: 0.5 },
    { x: 500, y: 30, d: 1.8, w: 0.2 },
    { x: 560, y: 64, d: 1.5, w: 0.9 },
    { x: 610, y: 30, d: 1.7, w: 0.4 },
    { x: 590, y: 120, d: 1.6, w: 1.3 },
    { x: 530, y: 100, d: 1.9, w: 0.6 }
  ];

  /** Des étoiles dans les coins, qui scintillent. */
  const ETOILES: Semis[] = [
    { x: 30, y: 40, d: 3.2, w: 0, r: 1.8 },
    { x: 84, y: 22, d: 4.1, w: 1.2, r: 1.4 },
    { x: 130, y: 54, d: 3.6, w: 2.1, r: 1.6 },
    { x: 52, y: 110, d: 4.6, w: 0.6, r: 1.3 },
    { x: 20, y: 150, d: 3.9, w: 2.8, r: 1.5 },
    { x: 470, y: 24, d: 4.3, w: 1.7, r: 1.6 },
    { x: 520, y: 142, d: 3.4, w: 0.4, r: 1.3 },
    { x: 30, y: 470, d: 4.8, w: 2.4, r: 1.4 },
    { x: 150, y: 612, d: 3.7, w: 1.1, r: 1.5 }
  ];

  /** Des lanternes célestes 孔明灯 qui montent, en bas à gauche. */
  const LAMPIONS: Semis[] = [
    { x: 46, y: 600, d: 22, w: 0, k: 1 },
    { x: 108, y: 626, d: 27, w: 11, k: 0.75 }
  ];

  /** L'osmanthe 桂 qui tombe, en bas à droite. */
  const OSMANTHES: Semis[] = [
    { x: 60, y: 30, d: 12, w: 0 },
    { x: 116, y: 20, d: 15, w: 5 },
    { x: 24, y: 80, d: 13, w: 8 },
    { x: 150, y: 44, d: 17, w: 2 }
  ];

  /** Les flocons, qui descendent doucement dans les coins du haut. */
  const FLOCONS: Semis[] = [
    { x: 30, y: 30, d: 14, w: 0, k: 1 },
    { x: 92, y: 18, d: 17, w: 6, k: 0.7 },
    { x: 58, y: 96, d: 15, w: 11, k: 0.85 },
    { x: 546, y: 26, d: 16, w: 3, k: 0.8 },
    { x: 604, y: 58, d: 13, w: 8, k: 1 },
    { x: 580, y: 118, d: 18, w: 13, k: 0.7 }
  ];

  /** Les lucioles : elles s'allument et s'éteignent, en bas et en haut à droite. */
  const LUCIOLES: Semis[] = [
    { x: 40, y: 520, d: 3.4, w: 0 },
    { x: 104, y: 566, d: 4.2, w: 1.3 },
    { x: 150, y: 604, d: 3.8, w: 2.6 },
    { x: 70, y: 470, d: 4.6, w: 0.8 },
    { x: 180, y: 626, d: 3.6, w: 2.0 },
    { x: 560, y: 50, d: 4.9, w: 1.6 },
    { x: 612, y: 110, d: 4.0, w: 3.1 }
  ];

  /** Le duvet des saules, qui flotte. */
  const DUVET: Semis[] = [
    { x: 40, y: 60, d: 9, w: 0, k: 1 },
    { x: 118, y: 34, d: 11, w: 3, k: 0.8 },
    { x: 586, y: 76, d: 10, w: 5, k: 0.9 },
    { x: 52, y: 580, d: 12, w: 2, k: 0.85 },
    { x: 126, y: 606, d: 9.5, w: 7, k: 1 }
  ];

  /** Les feuilles d'automne, qui tombent en tournant. */
  const FEUILLES: Semis[] = [
    { x: 40, y: 20, d: 14, w: 0, k: 1 },
    { x: 104, y: 44, d: 17, w: 6, k: 0.8 },
    { x: 540, y: 30, d: 15, w: 3, k: 0.9 },
    { x: 600, y: 70, d: 18, w: 10, k: 1 },
    { x: 56, y: 540, d: 16, w: 8, k: 0.75 }
  ];

  const s = (e: Semis): string => `--d:${e.d}s;--w:-${e.w}s`;
</script>

<script lang="ts">
  /**
   * Le décor du cercle de Ma forêt, le jour d'une fête ou d'un terme solaire (story 4b.9).
   *
   * Un petit décor dessiné dans les coins du cercle, là où les familles ne vont pas : la
   * pleine lune et les lanternes célestes à la mi-automne, le saule et le cerf-volant à
   * 清明, la rosée sur l'herbe au terme 白露… Les fêtes gardent la priorité, comme pour le
   * thème de l'app (`trouves.decorDuCercle`). Les couleurs sont celles des jetons de la fête
   * ou de l'ambiance, posés par `[data-fete]` et `[data-saison]` dans `tokens.css`.
   *
   * Discret : des aplats, sans ombre ni dégradé ni reflet de métal. Le cinabre reste à la
   * famille du moment ; le cramoisi de fête ne sert qu'au Nouvel An et à 元宵. Aucune bête
   * fabuleuse au cercle, pas même aux fêtes qui en admettent une ; les bateaux de 端午 n'ont
   * pas de tête. Il se tient dans les coins libres (le bas à droite porte les boutons du
   * zoom), passe derrière le cercle, ne se touche pas, et disparaît si l'on réduit les
   * animations.
   */
  import type { DecorCercle } from './trouves';

  let { decor }: { decor: DecorCercle | null } = $props();

  const fete = $derived(decor?.fete ?? null);
  const saison = $derived(decor?.saison ?? null);
</script>

{#if decor}
  <svg
    class="cercle-decor"
    viewBox="0 0 640 640"
    aria-hidden="true"
    data-decor={fete ?? saison}
  >
    {#if fete === 'chunjie'}
      <!-- le Nouvel An : une branche de prunier en fleur, une rosace de papier découpé -->
      <g class="balance" style="--d:7s">
        <path class="trait" d="M -6 168 C 28 124 58 84 168 14" />
        <path class="trait fin" d="M 60 96 C 70 70 66 48 84 26" />
        {#each [[34, 132], [92, 70], [150, 24], [80, 34]] as [x, y], i (i)}
          <g transform="translate({x} {y})">
            {#each CINQ as p, j (j)}
              <circle cx={p.x} cy={p.y} r="6" fill={i % 2 ? 'var(--prunier-pale)' : 'var(--prunier)'} />
            {/each}
            <circle r="2.8" fill="var(--apricot)" />
          </g>
        {/each}
      </g>
      <g transform="translate(62 578)">
        <circle r="36" fill="var(--fete)" />
        {#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}
          <circle cx={Math.round(Math.cos((a * Math.PI) / 180) * 2400) / 100} cy={Math.round(Math.sin((a * Math.PI) / 180) * 2400) / 100} r="5" fill="var(--card)" />
        {/each}
        <path d="M 0 -12 L 5 0 L 0 12 L -5 0 Z M -12 0 L 0 -5 L 12 0 L 0 5 Z" fill="var(--card)" />
      </g>
      {#each PETALES as e, i (i)}
        <ellipse class="chute" style={s(e)} cx={e.x} cy={e.y} rx="4.5" ry="3" fill={i % 2 ? 'var(--prunier)' : 'var(--prunier-pale)'} />
      {/each}
    {:else if fete === 'yuanxiao'}
      <!-- la fête des Lanternes : deux lanternes pendues, une devinette au fil -->
      {#each [{ x: 72, l: 34, k: 1 }, { x: 574, l: 20, k: 0.8 }] as L, i (i)}
        <g class="balance" style="--d:{4 + i * 0.7}s">
          <line class="fil" x1={L.x} y1="0" x2={L.x} y2={L.l} />
          <g transform="translate({L.x} {L.l}) scale({L.k})">
            <rect x="-13" y="0" width="26" height="7" rx="1.5" fill="var(--apricot)" />
            <ellipse cx="0" cy="30" rx="30" ry="24" fill="var(--fete)" />
            <ellipse cx="0" cy="30" rx="13" ry="24" fill="none" stroke="var(--apricot)" stroke-width="1.6" />
            <rect x="-13" y="52" width="26" height="7" rx="1.5" fill="var(--apricot)" />
            <line x1="0" y1="59" x2="0" y2="84" stroke="var(--apricot)" stroke-width="2" />
            <line x1="-4" y1="64" x2="-5" y2="82" stroke="var(--apricot)" stroke-width="1.4" />
            <line x1="4" y1="64" x2="5" y2="82" stroke="var(--apricot)" stroke-width="1.4" />
          </g>
          {#if i === 1}
            <g transform="translate({L.x + 30} 56)">
              <line x1="0" y1="-18" x2="0" y2="0" class="fil" />
              <rect x="-7" y="0" width="14" height="34" fill="var(--mi)" />
              <line x1="-3" y1="8" x2="-3" y2="28" stroke="var(--mi-ink)" stroke-width="1.2" />
              <line x1="3" y1="8" x2="3" y2="22" stroke="var(--mi-ink)" stroke-width="1.2" />
            </g>
          {/if}
        </g>
      {/each}
    {:else if fete === 'qingming'}
      <!-- 清明 : le saule qui pend, un cerf-volant, la pluie fine -->
      <g class="balance" style="--d:6s">
        {#each [[18, 132], [48, 108], [78, 84], [108, 58]] as [x, l], i (i)}
          <path class="saule" d="M {x} -4 Q {x + 12} {l / 2} {x - 2} {l}" />
          {#each [0.3, 0.55, 0.8, 1] as t, j (j)}
            <ellipse
              cx={x + 6 * Math.sin(t * 3)}
              cy={l * t}
              rx="2.6"
              ry="6"
              transform="rotate({j % 2 ? 24 : -24} {x + 6 * Math.sin(t * 3)} {l * t})"
              fill={(i + j) % 2 ? 'var(--saule)' : 'var(--saule-fonce)'}
            />
          {/each}
        {/each}
      </g>
      <g class="flotte" style="--d:8s">
        <path d="M 570 36 L 596 70 L 570 110 L 544 70 Z" fill="var(--cerf-clair)" stroke="var(--cerf)" stroke-width="2" />
        <path d="M 570 36 L 570 110 M 544 70 L 596 70" stroke="var(--cerf)" stroke-width="1.4" />
        <path class="queue" d="M 570 110 C 580 128 596 126 604 142 S 620 160 630 170" />
        {#each [[584, 126], [604, 144], [622, 162]] as [x, y], i (i)}
          <path d="M {x - 5} {y - 4} L {x + 5} {y + 4} M {x + 5} {y - 4} L {x - 5} {y + 4}" stroke="var(--cerf-queue)" stroke-width="2.4" stroke-linecap="round" />
        {/each}
      </g>
      {#each PLUIE as e, i (i)}
        <line class="goutte" style={s(e)} x1={e.x} y1={e.y} x2={e.x - 4} y2={e.y + 14} stroke="var(--pluie)" />
      {/each}
    {:else if fete === 'duanwu'}
      <!-- 端午 : l'armoise à la porte, les roseaux, l'eau et un bateau sans tête de bête -->
      <g class="balance" style="--d:7s">
        <line class="fil" x1="64" y1="0" x2="64" y2="30" stroke="var(--ficelle)" />
        {#each [-22, 0, 22] as a (a)}
          <g transform="rotate({a} 64 30)">
            <path d="M 64 30 L 64 118" stroke="var(--ai)" stroke-width="2" />
            {#each [48, 70, 92] as y (y)}
              <path d="M 64 {y} q -14 -2 -18 10 q 12 0 18 -10 Z M 64 {y + 8} q 14 -2 18 10 q -12 0 -18 -10 Z" fill="var(--ai)" />
            {/each}
          </g>
        {/each}
        <rect x="58" y="28" width="12" height="6" rx="2" fill="var(--ficelle)" />
      </g>
      {#each [[14, 640, 520], [34, 640, 546], [196, 640, 590]] as [x, y0, y1], i (i)}
        <path d="M {x - 5} {y0} Q {x - 2} {(y0 + y1) / 2} {x + 8} {y1} Q {x + 3} {(y0 + y1) / 2} {x + 5} {y0} Z" fill={i % 2 ? 'var(--roseau-clair)' : 'var(--roseau)'} />
      {/each}
      <g class="tangue" style="--d:4.5s">
        <path d="M 62 588 L 158 588 L 146 604 L 74 604 Z" fill="var(--bateau)" />
        <rect x="74" y="592" width="72" height="4" fill="var(--bateau-bande)" />
        <line x1="102" y1="588" x2="92" y2="572" stroke="var(--bateau)" stroke-width="2" />
        <line x1="126" y1="588" x2="116" y2="572" stroke="var(--bateau)" stroke-width="2" />
      </g>
      <g class="vague" style="--d:6s">
        <path class="eau clair" d="M -20 612 q 15 -8 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0" />
        <path class="eau" d="M -30 628 q 15 -8 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0" />
      </g>
    {:else if fete === 'qixi'}
      <!-- 七夕 : la Voie lactée en aplat, Véga et Altaïr de part et d'autre -->
      <path class="voie" d="M -20 40 C 20 34 44 10 48 -20 L 140 -20 C 132 30 120 60 96 82 C 72 104 40 126 -20 132 Z" />
      <path class="voie" d="M 660 500 C 600 506 560 540 540 580 C 528 604 520 630 520 660 L 610 660 C 612 620 630 600 660 590 Z" />
      {#each ETOILES as e, i (i)}
        <circle class="scintille" style={s(e)} cx={e.x} cy={e.y} r={e.r} fill="var(--etoile)" />
      {/each}
      {#each [[568, 72, 1], [72, 568, 0.85]] as [x, y, k], i (i)}
        <g transform="translate({x} {y}) scale({k})">
          <path
            class="scintille"
            style="--d:{5 + i}s;--w:-{i * 2}s"
            d="M 0 -14 L 3 -3 L 14 0 L 3 3 L 0 14 L -3 3 L -14 0 L -3 -3 Z"
            fill="var(--etoile)"
          />
        </g>
      {/each}
    {:else if fete === 'zhongqiu'}
      <!-- la mi-automne : la pleine lune, les étoiles, l'osmanthe, deux lanternes célestes -->
      <g transform="translate(566 74)">
        <circle r="46" fill="var(--moon)" />
        <circle cx="-14" cy="-10" r="8" fill="var(--moon-shade)" />
        <circle cx="12" cy="14" r="6" fill="var(--moon-shade)" />
        <circle cx="18" cy="-16" r="3.5" fill="var(--moon-shade)" />
      </g>
      {#each ETOILES.slice(0, 5) as e, i (i)}
        <circle class="scintille" style={s(e)} cx={e.x} cy={e.y} r={e.r} fill="var(--moon)" />
      {/each}
      {#each LAMPIONS as e, i (i)}
        <g class="monte" style={s(e)}>
          <g transform="translate({e.x} {e.y}) scale({e.k})">
            <path d="M -9 -24 L 9 -24 L 12 0 L -12 0 Z" fill="var(--lampion)" />
            <rect x="-9" y="-24" width="18" height="5" fill="var(--lampion-clair)" />
            <circle cx="0" cy="-5" r="3" fill="var(--lampion-feu)" />
          </g>
        </g>
      {/each}
      {#each OSMANTHES as e, i (i)}
        <g class="chute" style={s(e)}>
          <path transform="translate({e.x} {e.y})" d="M 0 -4 L 1.4 -1.4 L 4 0 L 1.4 1.4 L 0 4 L -1.4 1.4 L -4 0 L -1.4 -1.4 Z" fill="var(--gui)" />
        </g>
      {/each}
    {:else if fete === 'chongyang'}
      <!-- le double neuf : la montagne, un vol d'oies, un chrysanthème qui tourne -->
      <path d="M -10 640 L -10 560 L 36 520 L 76 566 L 112 548 L 170 640 Z" fill="var(--mont2)" />
      <path d="M -10 640 L -10 600 L 50 566 L 100 602 L 136 590 L 190 640 Z" fill="var(--mont)" />
      <g class="flotte" style="--d:12s">
        {#each [[560, 40], [578, 54], [596, 68], [542, 54], [524, 68]] as [x, y], i (i)}
          <path d="M {x - 7} {y - 4} Q {x - 3} {y - 3} {x} {y} Q {x + 3} {y - 3} {x + 7} {y - 4}" stroke="var(--yan)" stroke-width="1.8" fill="none" stroke-linecap="round" />
        {/each}
      </g>
      <g transform="translate(70 70)">
        <g class="tourne" style="--d:48s">
          {#each Array.from({ length: 14 }, (_, k) => k * (360 / 14)) as a, i (i)}
            <ellipse cx="0" cy="-20" rx="5" ry="15" transform="rotate({a})" fill={i % 2 ? 'var(--ju-clair)' : 'var(--ju)'} />
          {/each}
          <circle r="9" fill="var(--ju-coeur)" />
        </g>
      </g>
    {:else if fete === 'dongzhi'}
      <!-- le solstice d'hiver : des collines sous la neige, la neige légère -->
      <path d="M -10 640 L -10 590 Q 50 548 120 580 Q 160 598 200 640 Z" fill="var(--colline2)" />
      <path d="M -10 640 L -10 616 Q 60 590 140 624 L 150 640 Z" fill="var(--neige-bleu)" opacity=".55" />
      {#each FLOCONS as e, i (i)}
        <circle class="neige" style={s(e)} cx={e.x} cy={e.y} r={4.4 * (e.k ?? 1)} fill="var(--neige-bleu)" />
      {/each}
    {:else if saison === 'pecher'}
      <!-- les fleurs de pêcher -->
      <g class="balance" style="--d:8s">
        <path class="trait" d="M 650 150 C 610 110 580 70 500 20" />
        {#each [[600, 110], [556, 58], [520, 32]] as [x, y], i (i)}
          <g transform="translate({x} {y})">
            {#each CINQ as p, j (j)}
              <circle cx={p.x} cy={p.y} r="6" fill={i === 1 ? 'var(--s-fleur-pale)' : 'var(--s-fleur)'} />
            {/each}
            <circle r="2.6" fill="var(--s-coeur)" />
          </g>
        {/each}
      </g>
      {#each PETALES.slice(2) as e, i (i)}
        <ellipse class="chute" style={s(e)} cx={e.x} cy={e.y} rx="4.5" ry="3" fill="var(--s-fleur)" />
      {/each}
    {:else if saison === 'pluie'}
      <!-- la pluie fine, et les pousses -->
      {#each PLUIE_HAUT as e, i (i)}
        <line class="goutte" style={s(e)} x1={e.x} y1={e.y} x2={e.x - 4} y2={e.y + 14} stroke="var(--s-pluie)" />
      {/each}
      {#each [[40, 620], [86, 628], [130, 634]] as [x, y], i (i)}
        <path d="M {x} {y + 12} L {x} {y}" stroke="var(--s-pousse)" stroke-width="2" />
        <path d="M {x} {y} q -10 -2 -12 -10 q 10 0 12 10 Z M {x} {y} q 10 -4 12 -12 q -10 0 -12 12 Z" fill="var(--s-pousse)" />
      {/each}
    {:else if saison === 'duvet'}
      <!-- le duvet des saules, qui flotte -->
      {#each DUVET as e, i (i)}
        <g class="flotte" style={s(e)}>
          <g transform="translate({e.x} {e.y}) scale({e.k})">
            {#each SIX as a (a)}
              <line x1="0" y1="0" x2="0" y2="-9" transform="rotate({a})" stroke="var(--s-duvet-fil)" stroke-width="1" />
            {/each}
            <circle r="3" fill="var(--s-duvet)" stroke="var(--s-duvet-fil)" stroke-width="1" />
          </g>
        </g>
      {/each}
    {:else if saison === 'lucioles'}
      <!-- les lucioles, sur l'herbe haute -->
      {#each [[6, 80], [26, 104], [48, 88], [72, 70], [132, 56], [152, 44]] as [x, h], i (i)}
        <path d="M {x} 650 Q {x + 4} {650 - h / 2} {x + 14} {650 - h} Q {x + 9} {650 - h / 2} {x + 11} 650 Z" fill="var(--s-herbe)" />
      {/each}
      {#each LUCIOLES as e, i (i)}
        <circle class="luit" style={s(e)} cx={e.x} cy={e.y} r="3.2" fill="var(--s-luciole)" />
      {/each}
    {:else if saison === 'rosee'}
      <!-- la rosée sur l'herbe -->
      {#each [[4, 96], [24, 128], [46, 100], [68, 76], [92, 60], [140, 50], [162, 38]] as [x, h], i (i)}
        <path d="M {x} 650 Q {x + 4} {650 - h / 2} {x + 16} {650 - h} Q {x + 10} {650 - h / 2} {x + 12} 650 Z" fill="var(--s-herbe)" />
        {#if i % 2 === 0}
          <path
            class="luit lent"
            style="--d:{5 + i * 0.4}s;--w:-{i * 0.7}s"
            d="M {x + 16} {650 - h + 5} q -6 8 0 12 q 6 -4 0 -12 Z"
            fill="var(--s-rosee)"
          />
        {/if}
      {/each}
    {:else if saison === 'feuilles'}
      <!-- les feuilles, qui tombent en tournant -->
      {#each FEUILLES as e, i (i)}
        <g class="chute" style={s(e)}>
          <g transform="translate({e.x} {e.y}) scale({e.k}) rotate({i * 40})">
            <path
              d="M 0 -12 C 8 -8 8 6 0 12 C -8 6 -8 -8 0 -12 Z"
              fill={['var(--s-feuille)', 'var(--s-feuille2)', 'var(--s-feuille3)'][i % 3]}
            />
            <path d="M 0 -10 L 0 14" stroke="var(--card)" stroke-width="1" />
          </g>
        </g>
      {/each}
    {:else if saison === 'neige'}
      <!-- la neige : des flocons à six branches -->
      {#each FLOCONS as e, i (i)}
        <g class="neige" style={s(e)}>
          <g transform="translate({e.x} {e.y}) scale({e.k})">
            {#each SIX as a (a)}
              <line x1="0" y1="0" x2="0" y2="-8" transform="rotate({a})" stroke="var(--s-neige-bleu)" stroke-width="1.6" stroke-linecap="round" />
            {/each}
          </g>
        </g>
      {/each}
    {:else if saison === 'prunier'}
      <!-- le prunier en fleur, un peu de neige sur la branche -->
      <g class="balance" style="--d:9s">
        <path d="M -6 170 C 30 130 60 80 170 12" stroke="var(--s-branche)" stroke-width="3.4" fill="none" stroke-linecap="round" />
        <path d="M 64 92 C 74 66 70 44 88 22" stroke="var(--s-branche)" stroke-width="2" fill="none" stroke-linecap="round" />
        <ellipse cx="112" cy="46" rx="10" ry="3" fill="var(--s-neige)" stroke="var(--line)" stroke-width="1" />
        {#each [[36, 134], [96, 66], [146, 28], [84, 30]] as [x, y], i (i)}
          <g transform="translate({x} {y})">
            {#each CINQ as p, j (j)}
              <circle cx={p.x} cy={p.y} r="5.6" fill="var(--s-fleur)" />
            {/each}
            <circle r="2.4" fill="var(--s-coeur)" />
          </g>
        {/each}
      </g>
    {/if}
  </svg>
{/if}

<style>
  /* derrière le cercle, dans sa boîte : il suit le zoom, ne se touche pas */
  .cercle-decor {
    position: absolute;
    inset: 6px;
    width: calc(100% - 12px);
    height: calc(100% - 12px);
    pointer-events: none;
    overflow: hidden;
  }
  /*
   * Seuls les éléments animés tournent autour de leur propre boîte : les autres gardent
   * l'origine de leur attribut `transform`, sans quoi un `rotate()` ou un `scale()` écrit
   * dans le dessin se décalerait.
   */
  .balance,
  .chute,
  .neige,
  .monte,
  .flotte,
  .scintille,
  .tourne,
  .tangue,
  .vague,
  .goutte {
    transform-box: fill-box;
  }
  .trait {
    fill: none;
    stroke: var(--ink2);
    stroke-width: 3;
    stroke-linecap: round;
    opacity: 0.45;
  }
  .trait.fin {
    stroke-width: 2;
  }
  .fil {
    stroke: var(--mist);
    stroke-width: 1.2;
  }
  .saule {
    fill: none;
    stroke: var(--saule-fonce);
    stroke-width: 1.4;
  }
  .queue {
    fill: none;
    stroke: var(--cerf);
    stroke-width: 1.2;
  }
  .goutte {
    stroke-width: 1.8;
    stroke-linecap: round;
    opacity: 0;
    animation: pluie var(--d) linear infinite;
    animation-delay: var(--w);
  }
  .eau {
    fill: none;
    stroke: var(--eau);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .eau.clair {
    stroke: var(--eau-clair);
  }
  .voie {
    fill: var(--voie-clair);
  }

  .balance {
    transform-origin: 50% 0;
    animation: balance var(--d) ease-in-out infinite alternate;
  }
  .chute {
    opacity: 0;
    animation: chute var(--d) linear infinite;
    animation-delay: var(--w);
  }
  .neige {
    opacity: 0;
    animation: neige var(--d) linear infinite;
    animation-delay: var(--w);
  }
  .monte {
    opacity: 0;
    animation: monte var(--d) linear infinite;
    animation-delay: var(--w);
  }
  .flotte {
    animation: flotte var(--d, 9s) ease-in-out infinite alternate;
    animation-delay: var(--w, 0s);
  }
  .scintille {
    transform-origin: 50% 50%;
    animation: scintille var(--d) ease-in-out infinite alternate;
    animation-delay: var(--w);
  }
  .luit {
    animation: luit var(--d) ease-in-out infinite alternate;
    animation-delay: var(--w);
  }
  .luit.lent {
    animation-timing-function: linear;
  }
  .tourne {
    transform-origin: 50% 50%;
    animation: tourne var(--d) linear infinite;
  }
  .tangue {
    transform-origin: 50% 100%;
    animation: tangue var(--d) ease-in-out infinite alternate;
  }
  .vague {
    animation: vague var(--d) ease-in-out infinite alternate;
  }

  @keyframes balance {
    from { transform: rotate(-1.6deg); }
    to { transform: rotate(1.6deg); }
  }
  @keyframes chute {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
    15% { opacity: 0.9; }
    80% { opacity: 0.9; }
    100% { transform: translate(18px, 64px) rotate(160deg); opacity: 0; }
  }
  @keyframes neige {
    0% { transform: translate(0, -10px); opacity: 0; }
    20% { opacity: 0.9; }
    80% { opacity: 0.9; }
    100% { transform: translate(8px, 52px); opacity: 0; }
  }
  @keyframes monte {
    0% { transform: translate(0, 0); opacity: 0; }
    20% { opacity: 1; }
    75% { opacity: 1; }
    100% { transform: translate(10px, -90px); opacity: 0; }
  }
  @keyframes pluie {
    0% { transform: translate(0, -8px); opacity: 0; }
    30% { opacity: 0.75; }
    100% { transform: translate(-6px, 22px); opacity: 0; }
  }
  @keyframes flotte {
    from { transform: translate(-5px, 3px); }
    to { transform: translate(6px, -4px); }
  }
  @keyframes scintille {
    from { opacity: 0.35; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes luit {
    from { opacity: 0.15; }
    to { opacity: 1; }
  }
  @keyframes tourne {
    to { transform: rotate(360deg); }
  }
  @keyframes tangue {
    from { transform: rotate(-2.5deg); }
    to { transform: rotate(2.5deg); }
  }
  @keyframes vague {
    from { transform: translateX(-6px); }
    to { transform: translateX(6px); }
  }

  /* on réduit les animations : le décor disparaît, comme celui des fêtes */
  @media (prefers-reduced-motion: reduce) {
    .cercle-decor { display: none; }
  }
</style>
