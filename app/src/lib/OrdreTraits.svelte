<script lang="ts">
  /**
   * Le grand caractère d'une fiche du dictionnaire, dans son 米字格, dessiné depuis ses traits
   * (style 楷), et l'ordre des traits qui se rejoue : lecture, pause, trait suivant, revoir
   * (maquette `maquettes/dictionnaire.html`, écran 3). À l'ouverture, le caractère s'écrit trait
   * par trait, le pinceau le long des médianes, une courte pause entre deux traits.
   *
   * Si l'on réduit les animations, rien ne bouge seul : le caractère paraît entier, et les
   * boutons l'avancent d'un trait à la fois, sans pinceau qui glisse. `pasEncore` : le 米字格 en
   * pointillés d'un caractère pas encore lu. Les textes viennent de `ecrans.json`.
   */
  import { untrack } from 'svelte';
  import { remplir, type TextesDictionnaire } from './ecrans';
  import type { StrokeData } from './glyph';

  let {
    c,
    d,
    t,
    pasEncore = false,
    size = 224
  }: {
    c: string;
    d: StrokeData;
    t: TextesDictionnaire;
    pasEncore?: boolean;
    size?: number;
  } = $props();

  /** Les clips d'un dessin ne se mêlent pas à ceux d'un autre sur la page. */
  const id = `ot${Math.random().toString(36).slice(2, 9)}`;

  const reduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const n = $derived(d.s.length);
  const longueurs = $derived(
    d.m.map((m) => {
      let L = 0;
      for (let k = 1; k < m.length; k++) L += Math.hypot(m[k][0] - m[k - 1][0], m[k][1] - m[k - 1][1]);
      return Math.ceil(L) + 2;
    })
  );
  const durees = $derived(longueurs.map((L) => Math.max(0.3, L / 1000)));

  /** Les traits entiers ; le trait `i` en cours, à la fraction `f` ; la lecture en cours. */
  let i = $state(0);
  let f = $state(0);
  let enCours = $state(false);
  let attente = 0;
  let dernier: number | null = null;
  let cadre = 0;

  /* Un nouveau caractère : entier si l'on réduit les animations, sinon il s'écrit. */
  $effect(() => {
    const total = d.s.length;
    untrack(() => {
      arreter();
      i = reduit ? total : 0;
      f = 0;
      if (!reduit) lire();
    });
    return arreter;
  });

  function arreter(): void {
    enCours = false;
    if (cadre) cancelAnimationFrame(cadre);
    cadre = 0;
  }

  function boucle(ts: number): void {
    if (!enCours) return;
    const dt = dernier === null ? 0 : Math.min(0.1, (ts - dernier) / 1000);
    dernier = ts;
    if (attente > 0) attente -= dt;
    else {
      f += dt / (durees[i] ?? 0.3);
      if (f >= 1) {
        f = 0;
        i++;
        attente = 0.2;
      }
    }
    if (i >= n) {
      i = n;
      f = 0;
      enCours = false;
      return;
    }
    cadre = requestAnimationFrame(boucle);
  }

  function lire(): void {
    if (reduit) {
      suivant();
      return;
    }
    if (i >= n) {
      i = 0;
      f = 0;
    }
    enCours = true;
    dernier = null;
    attente = 0.15;
    cadre = requestAnimationFrame(boucle);
  }

  function pause(): void {
    arreter();
  }

  function suivant(): void {
    arreter();
    if (i >= n) i = 0;
    f = 0;
    i = Math.min(n, i + 1);
  }

  function revoir(): void {
    arreter();
    i = 0;
    f = 0;
    if (!reduit) lire();
  }

  const compteur = $derived(
    i >= n && !enCours ? remplir(t.traits, { n }) : remplir(t.trait, { k: Math.min(n, i + (f > 0 ? 1 : 0)), n })
  );
</script>

<div class="hero">
  <div class="mizi" class:pasencore={pasEncore} style="width:{size}px;height:{size}px">
    <svg class="grille" viewBox="0 0 100 100" aria-hidden="true"
      ><path d="M0 0L100 100M100 0L0 100M50 0V100M0 50H100" /></svg
    >
    <div class="dessin">
      <svg class="joueur" viewBox="0 0 1024 1024" role="img" aria-label="{c}, {remplir(t.traits, { n })}">
        <defs>
          {#each d.s as p, k (k)}<clipPath id="{id}_{k}"><path d={p} /></clipPath>{/each}
        </defs>
        <g transform="scale(1,-1) translate(0,-900)">
          {#each d.s as p, k (k)}<path class="fantome" d={p} />{/each}
          {#each d.s as p, k (k)}
            <path class="plein" d={p} style:opacity={k < i ? 1 : 0} />
            <polyline
              class="br"
              points={d.m[k].map((q) => q.join(',')).join(' ')}
              clip-path="url(#{id}_{k})"
              style:stroke-dasharray={longueurs[k]}
              style:stroke-dashoffset={(longueurs[k] * (1 - f)).toFixed(1)}
              style:visibility={k === i && f > 0 ? 'visible' : 'hidden'}
            />
          {/each}
        </g>
      </svg>
    </div>
  </div>
  <div class="lecteur">
    {#if enCours}
      <button class="ctl" aria-label={t['pause-voix']} onclick={pause}
        ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" /></svg>{t.pause}</button
      >
    {:else}
      <button class="ctl" aria-label={t['lire-voix']} onclick={lire}
        ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" /></svg>{t.lecture}</button
      >
    {/if}
    <button class="ctl" onclick={suivant}
      ><svg class="trait" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l6 5-6 5M12 3v10" /></svg>{t.suivant}</button
    >
    <button class="ctl rond" aria-label={t.revoir} onclick={revoir}
      ><svg class="trait" viewBox="0 0 16 16" aria-hidden="true"
        ><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" /><path d="M3 2v3h3" /></svg
      ></button
    >
  </div>
  <p class="compteur" aria-live="polite">{compteur}</p>
</div>

<style>
  .hero {
    display: grid;
    justify-items: center;
    gap: 8px;
    margin-top: 2px;
  }
  .mizi {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--grille);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  .mizi.pasencore {
    border-style: dashed;
    border-color: var(--ink2);
  }
  .grille {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .grille path {
    stroke: var(--grille);
    stroke-width: 0.55;
    stroke-dasharray: 2.4 2.4;
    fill: none;
  }
  .dessin {
    position: relative;
    width: 88%;
    height: 88%;
    line-height: 0;
  }
  .joueur {
    width: 100%;
    height: 100%;
    display: block;
  }
  .fantome {
    fill: var(--line);
    opacity: 0.6;
  }
  .plein {
    fill: currentColor;
  }
  .br {
    fill: none;
    stroke: currentColor;
    stroke-width: 200;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .lecteur {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .ctl {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--indigo);
    font-weight: 600;
    font-size: 14.5px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--card);
  }
  .ctl.rond {
    min-width: 44px;
    justify-content: center;
    padding: 0 12px;
  }
  .ctl svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
    stroke: none;
  }
  .ctl svg.trait {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .compteur {
    margin: 0;
    font-size: 13px;
    color: var(--mist);
    font-variant-numeric: tabular-nums;
    min-height: 18px;
  }
</style>
