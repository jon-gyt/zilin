<script lang="ts">
  /**
   * Ma forêt (story 4.1) : le cercle des familles, le zoom et le déplacement au doigt,
   * la semaine des graines, et Tao posée sur la colline — elle est chez elle ici.
   *
   * Les familles sont celles de l'export versionné (238 dans `index.json`) et leur
   * avancement se lit sur les cartes, jamais dans un fichier. Le cercle n'en porte
   * qu'une partie — les ouvertes et les prochaines, voir `famillesDuCercle` — et les
   * autres s'atteignent par la recherche, juste en dessous. Les caractères du cercle
   * sont dessinés depuis les traits (style 楷) ; ceux de la liste, qui n'est qu'un
   * index, restent en Noto Serif SC tant que leur arbre n'est pas ouvert. Le cinabre
   * ne marque que la famille du moment.
   *
   * Le jour d'une fête ou d'un terme solaire, un petit décor se pose dans les coins du
   * cercle (`CercleDecor`). Sous la colline, les caractères trouvés en chemin : celui que
   * l'anecdote d'une fête ou d'un terme a fait découvrir, dessiné depuis ses traits ;
   * touché, il se dit et montre sa fête ou son terme. Ils n'entrent pas en révision.
   */
  import Hz from './Hz.svelte';
  import CercleDecor from './CercleDecor.svelte';
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import TropheesEntree from './TropheesEntree.svelte';
  import { dire } from './audio';
  import {
    contenu,
    fetesOnce,
    lecon,
    nomParcours,
    racineDe,
    saisonsOnce,
    toutesLesFamilles,
    traitsDeFamilles,
    type Famille,
    type Fetes,
    type Foret,
    type Index,
    type Noeud,
    type Saisons
  } from './content';
  import { glyph } from './glyph';
  import {
    acquis,
    caracteresLus,
    construireForet,
    famille,
    famillesOuvertes,
    graines,
    ligneSemaine,
    noeudDeFamille,
    placerCercle,
    semaine,
    type Cercle
  } from './foret';
  import { journee } from './saisons';
  import { jourParcours, type Progress } from './session';
  import { type StrokeSet } from './strokes';
  import { stade } from './tao';
  import { collection, decorDuCercle, ligneTrouve, montrerCollection, type Piece } from './trouves';

  let {
    p,
    jour,
    onfamille,
    onrecompenses,
    onretour
  }: {
    p: Progress;
    jour: string;
    onfamille: (fam: Noeud) => void;
    /** Les récompenses vivent dans Ma forêt : c'est d'ici qu'on y entre. */
    onrecompenses: () => void;
    /** Ma forêt s'ouvre par sa case du menu ; un seul retour, vers le menu. */
    onretour: () => void;
  } = $props();

  let index = $state<Index | null>(null);
  let familles = $state<Famille[]>([]);
  let foret = $state<Foret | null>(null);
  let traits = $state<StrokeSet>({});
  /** Le filtre de la liste des 238 familles : un caractère, un pinyin, un sens. */
  let cherche = $state('');

  /** Les fêtes et les termes solaires : le décor du cercle et les noms des trouvés. */
  let fetes = $state<Fetes | null>(null);
  let saisons = $state<Saisons | null>(null);
  void fetesOnce().then((f) => (fetes = f)).catch(() => undefined);
  void saisonsOnce().then((x) => (saisons = x)).catch(() => undefined);
  const decor = $derived(decorDuCercle(journee(fetes, saisons, jour).theme));
  const pieces = $derived(collection(p.trouves, fetes, saisons));
  /** Le caractère trouvé qu'on a touché : il se dit, sa fête ou son terme s'affiche. */
  let touche = $state<string | null>(null);
  const piece = $derived(pieces.find((x) => x.c === touche) ?? null);

  function toucher(x: Piece): void {
    touche = x.c;
    void dire(x.c);
  }

  $effect(() => {
    const n = jourParcours(p);
    const choisi = p.parcours;
    const cartes = $state.snapshot(p.cartes);
    let vivant = true;
    void (async () => {
      const [i, lues, l] = await Promise.all([contenu(), toutesLesFamilles(), lecon(choisi, n)]);
      if (!vivant) return;
      index = i;
      familles = lues;
      const nom = nomParcours(i, choisi);
      /* La famille du moment : celle de la brique que le parcours pose aujourd'hui. */
      const moment = l.brique === null ? null : await racineDe(l.brique.c, l.pistes);
      if (!vivant) return;
      foret = construireForet({ index: i, familles: lues, cartes, nom, jour: n }, moment);
      /* On ne charge que les tracés des familles posées sur le cercle. */
      const set = await traitsDeFamilles(foret.familles.map((f) => f.c));
      if (vivant) traits = set;
    })().catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const cercle: Cercle | null = $derived(foret ? placerCercle(foret) : null);
  /** Les deux nombres du bas, lus sur les cartes de la progression : voir `foret.ts`. */
  const lus = $derived(caracteresLus(familles, p.cartes));
  const ouvertes = $derived(famillesOuvertes(familles, p.cartes));
  const cases = $derived(semaine(p, jour));
  const n = $derived(graines(p, jour));
  const stadeDeTao = $derived(stade(p.tao.croissance));

  /** Les familles de la liste : toutes celles de l'index, filtrées par la recherche. */
  const listees = $derived(
    (index?.familles ?? []).filter(
      (f) => cherche === '' || f.racine.includes(cherche) || String(f.n).startsWith(cherche)
    )
  );

  /** Ouvre l'arbre d'une famille de la liste : ses membres viennent de l'export. */
  function ouvrirListe(racine: string): void {
    const f = familles.find((x) => x.racine.c === racine);
    if (f) onfamille(noeudDeFamille(f, p.cartes));
  }

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
  <button class="k quit" onclick={onretour}>‹ Retour</button>
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
      <CercleDecor {decor} />
      {#if cercle}
        <svg
          class="cercle"
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

  <div class="card famlist">
    <div class="row">
      <div class="grow" style="font-weight:600">Toutes les familles</div>
      <div class="k">{index?.familles.length ?? 0}</div>
    </div>
    <div class="k">
      Le cercle montre les familles ouvertes et les prochaines. Les autres sont ici.
    </div>
    <input
      class="cherche"
      type="search"
      placeholder="Cherche une famille"
      aria-label="Chercher une famille"
      bind:value={cherche}
    />
    <div class="liste">
      {#each listees as f (f.racine)}
        <button class="famrow" onclick={() => ouvrirListe(f.racine)}>
          <Hz c={f.racine} size={22} pistes={[f.racine]} />
          <span class="grow k">{f.n} caractère{f.n > 1 ? 's' : ''}</span>
        </button>
      {/each}
      {#if listees.length === 0}
        <div class="k">Aucune famille ne porte ce caractère.</div>
      {/if}
    </div>
  </div>

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

  {#if montrerCollection(pieces)}
    <div class="card trouves">
      <div class="row">
        <div class="grow" style="font-weight:600">Trouvés en chemin</div>
        <div class="k">{pieces.length}</div>
      </div>
      <div class="k">Un caractère par fête et par terme solaire. Il ne passe pas en révision.</div>
      <div class="pieces">
        {#each pieces as x (x.c)}
          <button
            class="piece"
            class:sel={x.c === touche}
            aria-label="{x.c}{x.pinyin ? `, ${x.pinyin}` : ''} : {x.nomZh}"
            aria-pressed={x.c === touche}
            onclick={() => toucher(x)}
          >
            <Glyph char={x.c} size={40} write={x.c === touche} pistes={x.pistes} />
          </button>
        {/each}
      </div>
      {#if piece}
        <div class="detail" aria-live="polite">
          <div>
            <span class="hz">{piece.c}</span>
            {[piece.pinyin, piece.sens].filter((x) => x !== '').join(' · ')}
          </div>
          <div class="k">{ligneTrouve(piece)}</div>
        </div>
      {/if}
    </div>
  {/if}

  <TropheesEntree {p} onouvrir={onrecompenses} />

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

<style>
  /* le cercle passe devant son décor */
  .forest > svg.cercle {
    position: relative;
  }

  /* trouvés en chemin : une rangée de petits caractères, dessinés depuis leurs traits */
  .trouves {
    margin-top: 14px;
  }
  .pieces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .piece {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    padding: 0;
    border: 1.5px solid var(--line);
    border-radius: 12px;
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
  }
  .piece.sel {
    border-color: var(--indigo);
    background: var(--indigo-soft);
  }
  .detail {
    margin-top: 12px;
    font-size: 15px;
  }
  .detail .hz {
    font-size: 17px;
    margin-right: 6px;
  }
</style>
