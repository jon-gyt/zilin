<script lang="ts">
  /**
   * L'écran de série, après Clore : le chemin qui monte vers l'horizon, Tao qui avance
   * d'une case, la forêt déjà plantée derrière elle, Que 雀 qui attend au palier suivant
   * et remet le cadeau quand il est atteint.
   *
   * Encre et jade, des aplats et des traits : ni dégradé, ni ombre. Le cinabre ne marque
   * que deux choses, la position du jour sur le chemin et les bornes des paliers.
   * Jamais un compteur de jours manqués : le chemin n'a pas de trou, il continue.
   */
  import Que from './Que.svelte';
  import Tao from './Tao.svelte';
  import type { Progress } from './session';
  import {
    CADEAUX,
    NOTE_REMISE,
    PALIERS,
    etatSerie,
    libelleJours,
    messageCadeau,
    messageProchain,
    messageSemaine,
    type Palier
  } from './serie';
  import { stade } from './tao';

  let { p, onretour }: { p: Progress; onretour: () => void } = $props();

  const s = $derived(etatSerie(p.joursTravailles, p.day));
  const taoStade = $derived(stade(p.tao.croissance));

  /* ---------- la perspective ---------- */

  /** Le cadre du dessin et la ligne d'horizon. */
  const W = 520;
  const H = 520;
  const HZ = 96;
  /** La profondeur du chemin, du pied de l'écran à l'horizon. */
  const PROF = 400;
  /** Les cases visibles : quatre derrière, six devant. */
  const DERRIERE = 4;
  const DEVANT = 6;

  type Point = { x: number; y: number; e: number };

  /** La case `k` : 0 est celle du jour, les négatives sont derrière. Plus c'est loin, plus c'est petit. */
  function point(k: number): Point {
    const y = HZ + PROF / (1 + 0.42 * (k + DERRIERE));
    return {
      x: 260 + 34 * Math.sin(((y - HZ) / PROF) * Math.PI * 1.2),
      y,
      e: 0.3 + (0.7 * (y - HZ)) / PROF
    };
  }

  /** La demi-largeur du chemin à cette hauteur : il s'évase en venant vers nous. */
  function demi(y: number): number {
    return 16 + (170 * (y - HZ)) / PROF;
  }

  /** Les deux bords du chemin, du lointain jusqu'au bas de l'écran. */
  const route = (() => {
    const g: string[] = [];
    const d: string[] = [];
    for (let y = HZ + 6; y <= H; y += 8) {
      const x = 260 + 34 * Math.sin(((y - HZ) / PROF) * Math.PI * 1.2);
      g.push(`${(x - demi(y)).toFixed(1)} ${y}`);
      d.unshift(`${(x + demi(y)).toFixed(1)} ${y}`);
    }
    return `M ${g.join(' L ')} L ${d.join(' L ')} Z`;
  })();

  /** Un tirage stable : le même jour plante toujours le même arbre au même endroit. */
  function tirage(graine: number): () => number {
    let x = (graine * 9301 + 49297) % 233280;
    return () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
  }

  type Case = { k: number; i: number; pt: Point; palier: Palier | null; fait: boolean };
  type Arbre = { x: number; y: number; e: number; jeune: boolean };

  /** Les cases du chemin autour du jour : la série en cours, un jour par case. */
  const cases = $derived.by(() => {
    const l: Case[] = [];
    for (let k = DEVANT; k >= -DERRIERE; k--) {
      const i = s.jours + k;
      if (i < 1) continue;
      l.push({
        k,
        i,
        pt: point(k),
        palier: PALIERS.find((m) => m === i) ?? null,
        fait: k < 0
      });
    }
    return l;
  });

  /** La forêt : un bosquet par jour derrière, une pousse au bord des jours devant. */
  const arbres = $derived.by(() => {
    const l: Arbre[] = [];
    for (const c of cases) {
      const r = tirage(c.i * 7);
      if (c.k < 0) {
        const n = Math.min(4, 1 + Math.floor(-c.k / 2));
        for (let t = 0; t < n; t++) {
          const cote = t % 2 ? 1 : -1;
          l.push({
            x: c.pt.x + cote * (demi(c.pt.y) + 14 + r() * 60 * c.pt.e),
            y: c.pt.y + r() * 10,
            e: c.pt.e * (0.9 + r() * 0.5),
            jeune: false
          });
        }
      } else if (c.k > 0 && c.k < 4) {
        const cote = c.k % 2 ? 1 : -1;
        l.push({ x: c.pt.x + cote * (demi(c.pt.y) + 16), y: c.pt.y + 4, e: c.pt.e * 0.7, jeune: true });
      }
    }
    return l;
  });

  /** Le pas du jour : Tao part de la case d'hier et arrive sur celle d'aujourd'hui. */
  const pas = $derived.by(() => {
    const a = point(-1);
    const b = point(0);
    return { x: b.x, y: b.y, e: b.e, dx: a.x - b.x, dy: a.y - b.y };
  });

  const TAILLE_TAO = 170;
  const TAILLE_QUE = 110;

  /* ---------- le compteur ---------- */

  /** Le nombre monte d'un cran pendant que Tao avance. Au repos du mouvement, il est déjà là. */
  let affiche = $state(0);

  $effect(() => {
    const total = s.jours;
    const sobre =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (sobre || total < 1) {
      affiche = total;
      return;
    }
    affiche = total - 1;
    const t = setTimeout(() => {
      affiche = total;
    }, 1300);
    return () => clearTimeout(t);
  });
</script>

<main class="screen streak">
  <div class="serie">
    <div class="k">{libelleJours(s)}</div>
    <div class="n">{affiche}</div>

    <div class="road">
      <svg viewBox="0 0 {W} {H}" role="img" aria-label="Le chemin de ta série">
        <path class="ciel" d="M0 0h{W}v{HZ + 30}H0z" />
        <path
          class="loin"
          d="M0 {HZ + 30} Q90 {HZ - 16} 180 {HZ + 22} T380 {HZ + 18} T{W} {HZ + 26} V300 H0z"
        />
        <path class="pre" d="M0 {HZ + 20}h{W}v{PROF}H0z" />
        <circle class="soleil" cx="418" cy="52" r="16" />
        <path class="voie" d={route} />

        {#each arbres as a, i (i)}
          <g
            class="arbre"
            class:jeune={a.jeune}
            transform="translate({a.x.toFixed(1)} {a.y.toFixed(1)}) scale({a.e.toFixed(2)})"
          >
            <path d="M0 0V-46M-18 -30H18M0 -20L-14 -2M0 -20L14 -2" />
          </g>
        {/each}

        {#each cases as c (c.i)}
          {#if c.palier}
            <circle
              class="borne"
              class:ici={c.k === 0}
              cx={c.pt.x.toFixed(1)}
              cy={c.pt.y.toFixed(1)}
              r={((c.k === 0 ? 12 : 9) * c.pt.e + 3).toFixed(1)}
            />
            <text
              class="borne-l"
              x={(c.pt.x - demi(c.pt.y) - 8).toFixed(1)}
              y={(c.pt.y + 4).toFixed(1)}
              text-anchor="end"
              font-size={(11 + 6 * c.pt.e).toFixed(0)}>{c.i} j</text
            >
            {#if c.i >= s.jours}
              {@const q = TAILLE_QUE * c.pt.e}
              <g
                transform="translate({(c.pt.x + demi(c.pt.y) + 10 * c.pt.e).toFixed(1)} {(
                  c.pt.y -
                  q * 0.86
                ).toFixed(1)})"
              >
                <Que
                  size={q}
                  pose={c.i > s.jours ? 'pose' : 'vole'}
                  cadeau={c.i > s.jours ? 'ferme' : 'ouvert'}
                />
              </g>
            {/if}
          {:else}
            <circle
              class="case"
              class:on={c.fait}
              class:ici={c.k === 0}
              cx={c.pt.x.toFixed(1)}
              cy={c.pt.y.toFixed(1)}
              r={((c.k === 0 ? 11 : 6) * c.pt.e + 2).toFixed(1)}
            />
          {/if}
        {/each}

        {#if s.jours > 0}
          {@const m = TAILLE_TAO * pas.e}
          <g class="marche" style="--dx:{pas.dx.toFixed(1)}px;--dy:{pas.dy.toFixed(1)}px">
            <g transform="translate({(pas.x - m / 2).toFixed(1)} {(pas.y - m * 0.82).toFixed(1)})">
              <Tao stade={taoStade} posture="chemin" humeur="joie" size={m} />
            </g>
          </g>
        {/if}
      </svg>
    </div>

    <p class="guide">{messageProchain(s)}</p>

    <div class="seeds" aria-hidden="true">
      {#each s.semaine as g, i (g.jour)}
        <i
          class:on={g.travaille}
          class:today={g.aujourdhui}
          class:pop={g.aujourdhui && g.travaille}
          style="animation-delay:{(0.1 * i).toFixed(2)}s">{g.lettre}</i
        >
      {/each}
    </div>
    <p class="k semaine">{messageSemaine(s)}</p>

    {#if s.palier !== null}
      <div class="giftcard">
        <div class="row">
          <Que size={64} cadeau="ouvert" />
          <div class="grow">
            <b>{messageCadeau(s.palier)}</b>
            <span class="k">
              {CADEAUX[s.palier].detail}
              {#if CADEAUX[s.palier].remise}{NOTE_REMISE}{/if}
            </span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="foot"><button class="btn" onclick={onretour}>Retour au chemin</button></div>
</main>
