<script lang="ts">
  /**
   * Ma forêt (story 4.1) : le cercle des familles, le zoom et le déplacement au doigt,
   * la semaine des graines, et Tao posée sur la colline — elle est chez elle ici.
   *
   * Le dessin vient des données (`data/demo/foret.json`) et les caractères des traits
   * (style 楷), jamais d'une police. Le cinabre ne marque que la famille en cours.
   */
  import Tao from './Tao.svelte';
  import { foretOnce, type Foret, type Noeud } from './content';
  import { glyph } from './glyph';
  import {
    acquis,
    famille,
    graines,
    ligneSemaine,
    placerCercle,
    semaine,
    type Cercle
  } from './foret';
  import type { Progress } from './session';
  import { strokesOnce, type StrokeSet } from './strokes';
  import { stade } from './tao';

  let {
    p,
    jour,
    onfamille,
    onjouer
  }: {
    p: Progress;
    jour: string;
    onfamille: (fam: Noeud) => void;
    /** Les jeux (épic 4b) : une ligne, le choix se fait sur l'écran hôte. */
    onjouer: () => void;
  } = $props();

  let foret = $state<Foret | null>(null);
  let traits = $state<StrokeSet>({});

  void foretOnce().then((f) => (foret = f));
  void strokesOnce()
    .then((s) => (traits = s))
    .catch(() => (traits = {}));

  const cercle: Cercle | null = $derived(foret ? placerCercle(foret) : null);
  const lus = $derived(
    foret ? foret.familles.reduce((n, f) => n + acquis(f) + (f.avancement >= 1 ? 1 : 0), 0) : 0
  );
  const ouvertes = $derived(foret ? foret.familles.filter((f) => f.avancement > 0).length : 0);
  const cases = $derived(semaine(p, jour));
  const n = $derived(graines(p, jour));
  const stadeDeTao = $derived(stade(p.tao.croissance));

  /**
   * Le caractère d'un nœud, dessiné trait par trait (style 楷), statique : ni pinceau
   * ni animation dans le cercle. Sans données de tracé, on retombe sur un `<text>`,
   * le seul cas où la police sert.
   */
  function dessin(c: string, r: number): string {
    const d = traits[c];
    if (!d) {
      return `<text x="${r * 0.78}" y="${r * 1.2}" text-anchor="middle" class="hz" style="font-size:${r * 1.25}px;fill:var(--ink)">${c}</text>`;
    }
    return glyph(c, d, r * 1.56, { write: false });
  }

  /* ---------- zoom et déplacement : pointer events, sans dépendance ---------- */

  const ZOOM_MAX = 4;
  let boite = $state<HTMLDivElement | undefined>(undefined);
  let s = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  const doigts = new Map<number, { x: number; y: number }>();
  let depart: { x: number; y: number; zx: number; zy: number; d?: number; s?: number; mx?: number; my?: number } | null = null;
  let bouge = false;
  let dernierTap = 0;

  function cadre(): number {
    return boite?.getBoundingClientRect().width ?? 0;
  }

  /** Le cercle reste dans sa boîte : on ne peut pas le pousser dehors. */
  function borner(): void {
    const w = cadre();
    s = Math.min(ZOOM_MAX, Math.max(1, s));
    tx = Math.min(0, Math.max(w - w * s, tx));
    ty = Math.min(0, Math.max(w - w * s, ty));
  }

  function zoomer(f: number, px: number, py: number): void {
    const ns = Math.min(ZOOM_MAX, Math.max(1, s * f));
    const k = ns / s;
    tx = px - (px - tx) * k;
    ty = py - (py - ty) * k;
    s = ns;
    borner();
  }

  function recentrer(): void {
    s = 1;
    tx = 0;
    ty = 0;
  }

  /**
   * La capture du pointeur n'est prise qu'au premier vrai déplacement : prise au
   * contact, elle retargeterait le clic sur la boîte et un tap n'ouvrirait plus
   * l'arbre d'une famille.
   */
  function capturer(id: number): void {
    try {
      boite?.setPointerCapture(id);
    } catch {
      /* le pointeur a déjà été relâché */
    }
  }

  function prise(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.zoomctl')) return;
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    bouge = false;
    if (doigts.size === 1) depart = { x: e.clientX, y: e.clientY, zx: tx, zy: ty };
    if (doigts.size === 2) {
      capturer(e.pointerId);
      const [a, b] = [...doigts.values()];
      depart = {
        x: a.x,
        y: a.y,
        zx: tx,
        zy: ty,
        d: Math.hypot(a.x - b.x, a.y - b.y),
        s,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2
      };
    }
  }

  function glisse(e: PointerEvent): void {
    if (!doigts.has(e.pointerId) || !depart) return;
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.size === 1 && depart.d === undefined) {
      const dx = e.clientX - depart.x;
      const dy = e.clientY - depart.y;
      if (!bouge && Math.hypot(dx, dy) > 6) {
        bouge = true;
        capturer(e.pointerId);
      }
      if (!bouge) return;
      tx = depart.zx + dx;
      ty = depart.zy + dy;
      borner();
    }
    if (doigts.size === 2 && depart.d && depart.s && boite) {
      const [a, b] = [...doigts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      bouge = true;
      const r = boite.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      const ns = Math.min(ZOOM_MAX, Math.max(1, (depart.s * d) / depart.d));
      const k = ns / depart.s;
      tx = mx - (mx - depart.zx) * k + ((a.x + b.x) / 2 - (depart.mx ?? 0));
      ty = my - (my - depart.zy) * k + ((a.y + b.y) / 2 - (depart.my ?? 0));
      s = ns;
      borner();
    }
  }

  /** Doigt levé : sans déplacement, deux taps rapides recentrent. */
  function lache(e: PointerEvent): void {
    doigts.delete(e.pointerId);
    if (doigts.size === 0) {
      depart = null;
      if (!bouge) {
        const t = Date.now();
        if (t - dernierTap < 320) recentrer();
        dernierTap = t;
      }
    } else if (doigts.size === 1) {
      const [a] = [...doigts.values()];
      depart = { x: a.x, y: a.y, zx: tx, zy: ty };
    }
  }

  function molette(e: WheelEvent): void {
    e.preventDefault();
    const r = boite?.getBoundingClientRect();
    if (!r) return;
    zoomer(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }

  function bouton(f: number): void {
    const w = cadre();
    zoomer(f, w / 2, w / 2);
  }

  /** Un tap sur une famille ouvre son arbre ; un glissement, non. */
  function ouvrir(i: number, tap = true): void {
    if (tap && bouge) return;
    const f = foret ? famille(foret, i) : null;
    if (f) onfamille(f);
  }
</script>

<main class="screen">
  <h1>Ta forêt</h1>
  <p class="guide">
    Au centre, les briques. Chaque anneau est une génération de plus. Touche une brique pour
    ouvrir son arbre.
  </p>

  <div
    class="zoombox"
    role="application"
    aria-label="Le cercle de tes familles : pince pour zoomer, glisse pour te déplacer"
    bind:this={boite}
    onpointerdown={prise}
    onpointermove={glisse}
    onpointerup={lache}
    onpointercancel={lache}
    onwheel={molette}
  >
    <div class="forest" style="transform:translate({tx}px,{ty}px) scale({s})">
      {#if cercle}
        <svg
          viewBox="0 0 {cercle.taille} {cercle.taille}"
          role="img"
          aria-label="Le cercle de tes familles"
        >
          {#each cercle.secteurs as sect (sect.c)}
            <path class="wg {sect.etat}" d={sect.d} />
          {/each}
          {#each cercle.anneaux as r (r)}
            <circle class="ring" cx={cercle.cx} cy={cercle.cy} r={r} />
          {/each}
          {#each cercle.liens as l, i (i)}
            <path class="lk" class:acquis={l.acquis} d={l.d} />
          {/each}
          <g class="centre">
            <circle class="nd acquis" cx={cercle.cx} cy={cercle.cy} r={cercle.rCentre} />
            <g transform="translate({cercle.cx - cercle.rCentre * 0.78} {cercle.cy - cercle.rCentre * 0.78})">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html dessin(cercle.centre, cercle.rCentre)}
            </g>
          </g>
          {#each cercle.noeuds as nd (nd.famille + '-' + nd.generation + '-' + nd.c)}
            {#if nd.generation === 0}
              <g
                class="fam"
                role="button"
                tabindex="0"
                aria-label="Ouvrir l'arbre de {nd.c}"
                transform="translate({nd.x} {nd.y})"
                onclick={() => ouvrir(nd.famille)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    ouvrir(nd.famille, false);
                  }
                }}
              >
                <circle
                  class="nd {nd.etat}"
                  class:cinabre={nd.cinabre}
                  class:verrouille={nd.verrouille}
                  r={nd.r}
                />
                <g transform="translate({-nd.r * 0.78} {-nd.r * 0.78})">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html dessin(nd.c, nd.r)}
                </g>
              </g>
            {:else}
              <g transform="translate({nd.x} {nd.y})">
                <circle class="nd {nd.etat}" class:verrouille={nd.verrouille} r={nd.r} />
                <g transform="translate({-nd.r * 0.78} {-nd.r * 0.78})">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html dessin(nd.c, nd.r)}
                </g>
              </g>
            {/if}
          {/each}
        </svg>
      {/if}
    </div>
    <div class="zoomctl">
      <button aria-label="Agrandir" onclick={() => bouton(1.4)}>+</button>
      <button aria-label="Réduire" onclick={() => bouton(1 / 1.4)}>−</button>
      <button aria-label="Recentrer" onclick={recentrer}>⌂</button>
    </div>
  </div>
  <div class="k legende">
    <span><i class="d1"></i>acquis</span>
    <span><i class="d4"></i>en cours</span>
    <span><i class="d3"></i>à venir</span>
    <span><i class="d2"></i>la famille du moment</span>
  </div>
  <div class="k center">Pince pour zoomer, glisse pour te déplacer, double tape pour recentrer.</div>

  <div class="colline">
    <svg class="sol" viewBox="0 0 320 96" preserveAspectRatio="none" aria-hidden="true">
      <path class="hill2" d="M0 96 Q 74 30 168 58 T 320 46 V96 Z" />
      <path class="hill" d="M0 96 Q 108 44 204 70 T 320 66 V96 Z" />
    </svg>
    <div class="hote"><Tao stade={stadeDeTao} posture="anecdote" humeur="calme" size={112} /></div>
  </div>

  <div class="stat">
    <div class="card"><div class="k">Lus</div><div class="big">{lus}</div></div>
    <div class="card"><div class="k">Familles ouvertes</div><div class="big">{ouvertes}</div></div>
  </div>

  <button class="btn ghost jouer" onclick={onjouer}>Jouer</button>

  <div class="card semaine">
    <div class="row">
      <div class="grow">
        <div style="font-weight:600">Ta semaine</div>
        <div class="k">{ligneSemaine(n)}</div>
      </div>
      <div class="big">{n}</div>
    </div>
    <div class="seeds">
      {#each cases as c (c.jour)}
        <i class:on={c.graine} class:today={c.aujourdhui} title={c.jour}>{c.lettre}</i>
      {/each}
    </div>
    <div class="k">Chaque jour travaillé plante une graine. Sept graines, un arbre.</div>
  </div>
</main>
