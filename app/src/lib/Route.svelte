<script lang="ts">
  /**
   * 前路 « La route devant » : le bout de chemin proche, en papier découpé. Retour du
   * propriétaire du 26 septembre 2026 : « il manque une visibilité sur ce qui va être appris
   * au fur et à mesure » ; « pas besoin de tout voir, juste le détail de l'étape et une vue
   * partielle proche des prochaines étapes », et « plus joli ». Maquette validée :
   * `wenlu-a-venir.html`.
   *
   * La scène : trois collines en aplats, quelques pins de jade, un soleil pâle, et la route
   * qui monte en lacets vers la montagne. Sur la route, deux pierres lues (jade), la pierre
   * du jour (le seul cinabre, la position), où se tient Tao, et six pierres à venir, au trait.
   * Au bout, dans la brume, les deux prochaines bornes sur leurs stèles, et rien au-delà.
   * Chaque pierre porte sa brique, dessinée depuis ses traits ; la toucher la choisit. La
   * carte de détail dit l'étape choisie, demain par défaut.
   *
   * Tout ce qui se décide est dans `route.ts` : jours du chemin, jamais de date, rien
   * d'estimé. Ce composant lit le contenu et dessine. Ni ombre, ni dégradé, ni doré, ni
   * emoji, ni dragon ; rien ne bouge si l'on réduit les animations (le pinceau de la carte
   * et Tao s'arrêtent avec `tokens.css`).
   */
  import Glyph from './Glyph.svelte';
  import Motif from './Motif.svelte';
  import Tao from './Tao.svelte';
  import {
    briquesPosees,
    contenu,
    contesExport,
    lecon,
    nomParcours,
    toutesLesFamilles,
    traitsDe,
    type Famille,
    type FicheLue
  } from './content';
  import { joursDuChemin, lireMotif, ouvertures } from './etageres';
  import { caracteresLus } from './foret';
  import { glyph, type StrokeData } from './glyph';
  import { bibliotheque, caracteresAcquis } from './lecture';
  import {
    bornesDevant,
    choixParDefaut,
    dansCourt,
    etapesDuChemin,
    ligneBorne,
    ligneLus,
    positionDuJour,
    prochainesBornes,
    quand,
    route,
    verbeOuvre,
    type Borne,
    type ConteAVenir,
    type Etape,
    type Pierre
  } from './route';
  import type { Progress } from './session';
  import { stade } from './tao';
  import { tropheesLire } from './trophees';

  let { p, onretour }: { p: Progress; onretour: () => void } = $props();

  /* ---------- le contenu ---------- */

  let etapes = $state.raw<Etape[]>([]);
  /** Les pistes de chaque étape : les briques posées jusque-là, pour trouver les familles. */
  let pistesDe = $state.raw<Map<number, string[]>>(new Map());
  let hsk1 = $state.raw<string[]>([]);
  let familles = $state.raw<Famille[]>([]);
  let contes = $state.raw<ConteAVenir[]>([]);
  let charge = $state(false);

  const acquis = $derived(caracteresAcquis(p.cartes));

  $effect(() => {
    const choisi = p.parcours;
    const cartes = $state.snapshot(p.cartes);
    const lus = $state.snapshot(p.contesLus);
    const relecture = p.relecture;
    let vivant = true;
    void (async () => {
      const [i, fams, cx] = await Promise.all([
        contenu(),
        toutesLesFamilles().catch(() => [] as Famille[]),
        contesExport().catch(() => null)
      ]);
      if (!vivant) return;
      const nom = nomParcours(i, choisi);
      const jours = i.parcours[nom]?.jours ?? [];
      const es = etapesDuChemin(jours);
      etapes = es;
      pistesDe = new Map(es.map((e) => [e.jour, briquesPosees(i, nom, e.jour)]));
      hsk1 = i.listes['hsk-1'] ?? [];
      familles = fams;
      if (cx !== null) {
        const a = caracteresAcquis(cartes);
        const entrees = bibliotheque(cx.index, cx.contes, a, lus, relecture, cx.catalogue);
        const ouv = ouvertures(entrees, cx.contes, a, joursDuChemin(jours));
        const motifs = new Map(cx.catalogue.map((c) => [c.id, c.motif]));
        contes = entrees
          .filter((e) => ouv[e.id] !== undefined)
          .map((e) => ({
            id: e.id,
            titre: e.titre_zh || e.titre_fr,
            jour: ouv[e.id] ?? null,
            motif: lireMotif(motifs.get(e.id))
          }));
      }
      charge = true;
    })().catch(() => {
      if (vivant) charge = true;
    });
    return () => {
      vivant = false;
    };
  });

  /* ---------- la route ---------- */

  const position = $derived(positionDuJour(p));
  const r = $derived(route(etapes, position));
  const sur = $derived(position.sur);
  const lus = $derived(caracteresLus(familles, p.cartes));
  const ligne = $derived(
    ligneLus(lus, hsk1.length === 0 ? null : { lus: hsk1.filter((c) => acquis.has(c)).length, total: hsk1.length })
  );
  const seuils = $derived(tropheesLire(lus, p.tropheesAcquis).map((t) => ({ n: t.cible, obtenu: t.obtenu })));
  const bornes = $derived(bornesDevant(etapes, r, seuils, contes));
  const loin = $derived(prochainesBornes(bornes));

  /** La pierre choisie ; `null` : celle par défaut, demain. */
  let choisie = $state<number | null>(null);
  const sel = $derived(choisie ?? choixParDefaut(r));
  const pierre = $derived(r.pierres.find((x) => x.jour === sel) ?? null);

  /* ---------- les traits des pierres ---------- */

  let traits = $state.raw<Record<string, StrokeData | null>>({});

  $effect(() => {
    const voulus = [...r.pierres.map((x) => ({ c: x.brique, jour: x.jour })), { c: '读', jour: 0 }];
    const pistes = pistesDe;
    let vivant = true;
    void Promise.all(
      voulus.map((v) => traitsDe(v.c, pistes.get(v.jour) ?? []).catch(() => null))
    ).then((ds) => {
      if (!vivant) return;
      const n: Record<string, StrokeData | null> = {};
      voulus.forEach((v, k) => (n[v.c] = ds[k]));
      traits = n;
    });
    return () => {
      vivant = false;
    };
  });

  /* ---------- la carte de l'étape choisie ---------- */

  let detail = $state.raw<{ jour: number; fiches: FicheLue[]; pistes: string[] } | null>(null);

  $effect(() => {
    const jour = sel;
    const choisi = p.parcours;
    if (jour === null) return;
    let vivant = true;
    void lecon(choisi, jour)
      .then((l) => {
        if (!vivant) return;
        const fiches = [l.brique, ...l.composes].filter((f): f is FicheLue => f !== null);
        detail = { jour, fiches, pistes: l.pistes };
      })
      .catch(() => {
        if (vivant) detail = { jour, fiches: [], pistes: [] };
      });
    return () => {
      vivant = false;
    };
  });

  const carte = $derived(detail !== null && detail.jour === sel ? detail : null);
  const brique = $derived(carte?.fiches[0] ?? null);
  const ouvre = $derived(carte?.fiches.slice(1) ?? []);
  const laBorne = $derived(pierre ? ligneBorne(pierre.ecart, bornes, sur) : null);

  /* ---------- la scène ---------- */

  const W = 348;
  const H = 470;
  /** Neuf places sur la route : deux derrière, celle du jour, six devant. */
  const PLACES = 9;
  const ICI = 2;

  /** La place `i`, du plus proche (en bas) au plus loin : la route monte en lacets et rétrécit. */
  function place(i: number): { x: number; y: number; r: number } {
    const t = i / (PLACES - 1);
    const y = 418 - t * 282 - t * t * 20;
    const amp = 112 * (1 - t * 0.62);
    return { x: W / 2 + amp * Math.sin(i * 1.05 + 0.5), y, r: 23 - t * 9 };
  }

  const PLACES_XY = Array.from({ length: PLACES }, (_, i) => place(i));
  const placeDe = (x: Pierre) => PLACES_XY[x.ecart + ICI];

  /** Le tracé de la route : des courbes douces d'une place à l'autre. */
  function trace(pts: readonly { x: number; y: number }[]): string {
    return pts
      .map((q, i) => {
        if (i === 0) return `M ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
        const a = pts[i - 1];
        const cx = (a.x + q.x) / 2 + (i % 2 ? 18 : -18);
        return `S ${cx.toFixed(1)} ${((a.y + q.y) / 2).toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
      })
      .join(' ');
  }

  const bout = { x: PLACES_XY[PLACES - 1].x + 14, y: PLACES_XY[PLACES - 1].y - 34 };
  const ROUTE = [{ x: PLACES_XY[0].x - 10, y: H + 10 }, ...PLACES_XY, bout];
  /**
   * La route jusqu'où elle va : dans la brume quand le chemin continue au-delà des six
   * pierres ; sinon elle s'arrête à la dernière pierre du parcours, et le dit.
   */
  const derniere = $derived(r.pierres.length === 0 ? null : r.pierres[r.pierres.length - 1]);
  const auBout = $derived(charge && derniere !== null && r.bout);
  const routeEntiere = $derived(auBout && derniere ? trace(ROUTE.slice(0, derniere.ecart + ICI + 2)) : trace(ROUTE));
  const finXY = $derived(PLACES_XY[Math.min(PLACES - 1, (derniere?.ecart ?? 0) + ICI)]);
  /** Le bout parcouru, jusqu'à la pierre du jour : au jade quand quelque chose est lu. */
  const routeFaite = trace(ROUTE.slice(0, ICI + 2));
  const aLu = $derived(r.faite || r.pierres.some((x) => x.etat === 'lue'));

  /** Un pin en aplats : trois étages de jade, un tronc d'ocre. */
  const PINS: readonly [number, number, number][] = [
    [30, 290, 1],
    [48, 300, 0.8],
    [318, 330, 1.1],
    [300, 342, 0.8],
    [26, 430, 1.2],
    [330, 448, 1],
    [94, 212, 0.55],
    [262, 218, 0.5]
  ];

  /** Les stèles des bornes, à gauche puis à droite de la route, dans la brume. */
  const STELES = [
    { x: 62, y: 70 },
    { x: 280, y: 52 }
  ];

  /** Le dessin d'une brique sur sa pierre, depuis ses traits ; sans traits, la police. */
  function dessin(c: string, taille: number, couleur: string): string {
    const d = traits[c];
    if (!d) {
      return `<text x="${taille / 2}" y="${taille * 0.82}" text-anchor="middle" class="hz" style="font-size:${taille * 0.86}px;fill:${couleur}">${c}</text>`;
    }
    return glyph(c, d, taille, { write: false, color: couleur });
  }

  function choisir(x: Pierre): void {
    choisie = x.jour;
  }

  function clavier(e: KeyboardEvent, x: Pierre): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    choisir(x);
  }

  function nomPierre(x: Pierre): string {
    return `Jour ${x.jour}, ${x.brique}, ${quand(x.ecart, sur)}`;
  }

  const borneDe = (x: Pierre): Borne | undefined => loin.find((b) => b.jour === x.jour);
  const taoStade = $derived(stade(p.tao.croissance));
  const ici = $derived(r.pierres.find((x) => x.ecart === 0) ?? null);
</script>

<main class="screen route">
  <div class="barre">
    <button class="k quit" onclick={onretour}>‹ Retour</button>
  </div>
  <h1>La route devant <span class="zh" lang="zh-Hans">前路</span></h1>
  <p class="sub">{charge ? ligne : ' '}</p>

  <div class="scene">
    <svg viewBox="0 0 {W} {H}" role="group" aria-label="Le bout de route proche">
      <!-- le ciel, le soleil pâle, trois collines en aplats -->
      <rect width={W} height={H} class="ciel" />
      <circle cx="206" cy="58" r="20" class="soleil" />
      <path
        class="mont1"
        d="M0 158 L40 118 L70 136 L118 70 L150 104 L176 88 L214 128 L250 96 L292 132 L322 108 L348 124 L348 {H} L0 {H}Z"
      />
      <path class="mont2" d="M0 214 Q40 180 86 196 T170 188 T262 200 T348 184 L348 {H} L0 {H}Z" />
      <path class="mont3" d="M0 262 Q60 236 120 250 T240 246 T348 240 L348 {H} L0 {H}Z" />
      {#each PINS as [x, y, k] (`${x}-${y}`)}
        <g transform="translate({x} {y}) scale({k})">
          <path class="pin" d="M0 -30 L11 -12 L5 -12 L14 2 L-14 2 L-5 -12 L-11 -12Z" />
          <rect class="tronc" x="-2" y="2" width="4" height="7" />
        </g>
      {/each}

      <!-- la route : large en bas, fine en haut ; le bout parcouru au jade -->
      <path class="chaussee" d={routeEntiere} />
      {#if aLu}<path class="parcouru" d={routeFaite} />{/if}
      <path class="axe" d={routeEntiere} />

      <!-- la brume, en bandes de papier, où la route se perd -->
      <rect class="brume" x={bout.x - 70} y={bout.y - 6} width="120" height="13" rx="6.5" />
      <rect class="brume" x={bout.x - 30} y={bout.y + 12} width="110" height="13" rx="6.5" />
      <rect class="brume" x={bout.x - 20} y={bout.y - 26} width="90" height="13" rx="6.5" />

      <!-- au loin, les deux prochaines bornes sur leurs stèles, rien au-delà -->
      {#each loin as b, k (`${b.genre}-${b.jour}-${b.titre}`)}
        {@const s = STELES[k]}
        <g class="stele" class:seconde={k === 1}>
          <rect class="pierre-stele" x={s.x - 18} y={s.y - 2} width="36" height="46" rx="4" />
          {#if b.genre === 'lire'}
            <g transform="translate({s.x - 13} {s.y + 7})">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html dessin('读', 26, 'var(--indigo)')}
            </g>
          {:else}
            <g class="motif" transform="translate({s.x - 12} {s.y + 8})"><Motif nom={lireMotif(b.motif ?? undefined)} size={24} /></g>
          {/if}
          <!-- la stèle posée dans la brume : une bande de papier couvre son pied -->
          <rect class="brume" x={s.x - 38} y={s.y + 38} width="76" height="11" rx="5.5" />
          <text class="titre-stele" x={s.x} y={s.y + 60} text-anchor="middle">{b.titre}</text>
          <text class="dans" x={s.x} y={s.y + 74} text-anchor="middle">{dansCourt(b.ecart, sur)}</text>
        </g>
      {/each}
      {#if auBout}
        <text class="dans" x={finXY.x} y={finXY.y - finXY.r - 10} text-anchor="middle">fin du parcours</text>
      {/if}

      <!-- les pierres, de la plus lointaine à la plus proche -->
      {#each [...r.pierres].reverse() as x (x.jour)}
        {@const q = placeDe(x)}
        {@const taille = q.r * 1.3}
        <g
          class="pierre {x.etat}"
          class:faite={x.etat === 'jour' && r.faite}
          class:choisie={x.jour === sel}
          role="button"
          tabindex="0"
          data-jour={x.jour}
          aria-label={nomPierre(x)}
          aria-pressed={x.jour === sel}
          onclick={() => choisir(x)}
          onkeydown={(e) => clavier(e, x)}
        >
          {#if borneDe(x)}
            <rect class="repere" x={q.x + q.r + 3} y={q.y - q.r} width={q.r * 0.8} height={q.r * 1.1} rx="2" />
          {/if}
          {#if x.jour === sel && x.etat !== 'jour'}
            <circle class="anneau" cx={q.x} cy={q.y} r={q.r + 4} />
          {/if}
          <circle class="disque" cx={q.x} cy={q.y} r={q.r} />
          <g transform="translate({q.x - taille / 2} {q.y - taille / 2})">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html dessin(x.brique, taille, x.etat === 'lue' ? 'var(--jade)' : 'var(--ink)')}
          </g>
        </g>
      {/each}

      <!-- Tao, sur la pierre du jour, et le sceau de la position -->
      {#if ici}
        {@const q = placeDe(ici)}
        {@const gauche = q.x > W / 2}
        <g class="tao" transform="translate({gauche ? q.x - q.r - 50 : q.x + q.r - 4} {q.y - 44})">
          <Tao stade={taoStade} posture="chemin" humeur="calme" size={56} />
        </g>
        <rect class="sceau" x={q.x - 30} y={q.y + q.r + 7} width="60" height="19" rx="4" />
        <text class="sceau-t" x={q.x} y={q.y + q.r + 20.5} text-anchor="middle">jour {ici.jour}</text>
      {/if}
    </svg>
  </div>

  {#if pierre}
    <section class="detail" aria-live="polite">
      <div class="head">
        <div class="mzg">
          <svg class="grille" viewBox="0 0 84 84" aria-hidden="true">
            <rect x=".5" y=".5" width="83" height="83" />
            <path d="M42 1v82M1 42h82M1 1l82 82M83 1L1 83" />
          </svg>
          {#if brique}
            {#key pierre.jour}
              <span class="gl"><Glyph char={brique.c} size={76} pistes={carte?.pistes ?? []} /></span>
            {/key}
          {/if}
        </div>
        <div class="grow">
          <div class="when" class:now={pierre.ecart === 0}>{quand(pierre.ecart, sur)} · jour {pierre.jour}</div>
          {#if brique}
            <div class="py">{brique.pinyin}</div>
            {#if brique.fr !== ''}<div class="sens">{brique.fr}</div>{/if}
          {/if}
        </div>
      </div>
      {#if ouvre.length > 0}
        <div class="lead">{verbeOuvre(pierre.ecart)}</div>
        <div class="opens">
          {#each ouvre as f (f.c)}
            <div class="o">
              <span class="gl" aria-hidden="true"><Glyph char={f.c} size={30} write={false} pistes={carte?.pistes ?? []} /></span>
              <small><b>{f.pinyin}</b>{f.fr}</small>
            </div>
          {/each}
        </div>
      {/if}
      {#if laBorne}
        <div class="borne">{laBorne.tete} <b>{laBorne.titre}</b>, {laBorne.suite}</div>
      {/if}
    </section>
  {/if}
</main>

<style>
  .route {
    gap: 12px;
  }
  .barre {
    display: flex;
    align-items: center;
    margin-bottom: -10px;
  }
  .barre .quit {
    color: var(--indigo);
    font-weight: 600;
    font-size: 15px;
  }
  h1 {
    margin: 0;
    font-size: 24px;
  }
  h1 .zh {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 21px;
    color: var(--ink2);
    margin-left: 4px;
  }
  .sub {
    margin: -6px 0 0;
    font-size: 14px;
    color: var(--ink2);
    font-variant-numeric: tabular-nums;
    min-height: 1.3em;
  }

  /* ---- la scène, en papier découpé : des aplats, rien d'autre ---- */
  .scene {
    background: var(--card);
    border-radius: 18px;
    overflow: hidden;
    line-height: 0;
  }
  .scene svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .ciel {
    fill: var(--card);
  }
  .soleil {
    fill: var(--ocre-soft);
  }
  .mont1 {
    fill: var(--route-mont1);
  }
  .mont2 {
    fill: var(--route-mont2);
  }
  .mont3 {
    fill: var(--route-mont3);
  }
  .pin {
    fill: var(--jade);
  }
  .tronc {
    fill: var(--ocre);
  }
  .chaussee {
    fill: none;
    stroke: var(--line);
    stroke-width: 30;
    stroke-linecap: round;
  }
  .parcouru {
    fill: none;
    stroke: var(--jade-soft);
    stroke-width: 30;
    stroke-linecap: round;
  }
  .axe {
    fill: none;
    stroke: var(--rule);
    stroke-width: 1.5;
    stroke-dasharray: 2 7;
    stroke-linecap: round;
  }
  .brume {
    fill: var(--paper);
  }

  /* les stèles : à venir, donc au pointillé d'indigo */
  .pierre-stele {
    fill: var(--paper);
    stroke: var(--indigo);
    stroke-width: 1.3;
    stroke-dasharray: 3 3;
  }
  .stele.seconde {
    opacity: 0.82;
  }
  .stele .motif {
    color: var(--indigo);
  }
  .titre-stele {
    font: 600 11.5px var(--sans);
    fill: var(--ink2);
  }
  .dans {
    font: 400 11px var(--sans);
    fill: var(--mist);
  }

  /* les pierres : lues au jade, celle du jour cerclée de cinabre, à venir au trait */
  .pierre {
    cursor: pointer;
    outline: none;
  }
  .disque {
    fill: var(--paper);
    stroke: var(--grille);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
  }
  .pierre.lue .disque {
    fill: var(--jade-soft);
    stroke: var(--jade);
    stroke-dasharray: none;
  }
  .pierre.jour .disque {
    stroke: var(--zhu);
    stroke-width: 2.6;
    stroke-dasharray: none;
  }
  .pierre.jour.faite .disque {
    fill: var(--jade-soft);
  }
  .anneau {
    fill: none;
    stroke: var(--indigo);
    stroke-width: 1.6;
  }
  .pierre:focus-visible .disque {
    stroke: var(--indigo);
    stroke-width: 2.5;
  }
  .repere {
    fill: var(--paper);
    stroke: var(--indigo);
    stroke-width: 1.2;
  }
  .sceau {
    fill: var(--zhu);
  }
  .sceau-t {
    font: 600 11.5px var(--sans);
    fill: var(--on);
  }
  .tao {
    pointer-events: none;
  }

  /* ---- la carte de l'étape ---- */
  .detail {
    background: var(--card);
    border-radius: 16px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .head {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .mzg {
    position: relative;
    width: 84px;
    height: 84px;
    flex: none;
    background: var(--paper);
    line-height: 0;
  }
  .grille {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .grille rect,
  .grille path {
    fill: none;
    stroke: var(--grille);
    stroke-width: 1;
  }
  .grille path {
    stroke: var(--line);
    stroke-dasharray: 3 4;
  }
  .mzg .gl {
    position: absolute;
    left: 4px;
    top: 4px;
  }
  .when {
    font: 700 12px var(--head);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .when.now {
    color: var(--zhu);
  }
  .py {
    font: 600 17px var(--sans);
    margin-top: 2px;
  }
  .sens {
    font-size: 15px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .lead {
    font: 600 13px var(--sans);
    color: var(--ink2);
  }
  .opens {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .o {
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--paper);
    border-radius: 10px;
    padding: 6px 10px 6px 8px;
    min-width: 0;
  }
  .o .gl {
    line-height: 0;
    flex: none;
  }
  .o small {
    display: block;
    font-size: 12px;
    color: var(--ink2);
    line-height: 1.25;
  }
  .o small b {
    display: block;
    font-weight: 600;
    color: var(--ink);
    font-size: 13px;
  }
  .borne {
    border-top: 1px solid var(--line);
    padding-top: 10px;
    font-size: 14px;
    color: var(--ink2);
  }
  .borne b {
    color: var(--ink);
  }
</style>
