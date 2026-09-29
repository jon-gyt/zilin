<script lang="ts">
  /**
   * Mon chemin 路 (décisions du propriétaire du 29 septembre 2026 ; maquette validée
   * `maquettes/chemin.html`, variante A). « Ma forêt » devient « Mon chemin », et toute
   * l'image suit : une pierre posée à plat chaque jour, un pavillon 亭 toutes les sept
   * pierres, une auberge 客栈 par famille au bord du chemin ; plus de graine, d'arbre, de
   * forêt, de borne ni de stèle.
   *
   * Un seul dessin vertical, en papier découpé. En haut, la route devant 前路 (`route.ts`,
   * inchangée dans ses règles) : six pierres au trait, et au loin, dans la brume, les deux
   * prochains rendez-vous, au pointillé d'indigo : un examen, la porte de ville 城门 au nom
   * de l'examen sur le linteau ; un seuil du trophée Lire, une lanterne 灯笼 au nombre ; un
   * conte qui s'ouvre, un étal de livres à son motif. L'examen à passer ouvre la porte du
   * 贡院 sur la route, devant la pierre du jour, au trait plein ; la toucher mène à l'examen.
   * Avant la porte de l'aventure « route devant » (jour 9), le haut du chemin est dans la
   * brume, et la carte de l'étape ne se montre pas. Au milieu, la pierre du jour, le seul
   * cinabre, où se tient Tao, avec son sceau « jour 15 ». En descendant, le chemin parcouru,
   * un pavé par jour du chemin jusqu'au jour 1 ; chaque famille ouverte y tient son auberge,
   * le fanion à sa racine, son sentier pavé de ses caractères (`chemin.ts`). Au-delà de cent
   * jours, il se replie par tranches de trente, qui se déplient au toucher.
   *
   * La carte de l'étape choisie (demain par défaut) passe en tête : « Prochain rendez-vous :
   * 县试 · 50 caractères, dans 10 jours ». Puis la semaine en pierres, les trophées, les
   * révisions, les deux nombres, les trouvés en chemin et la liste des familles.
   *
   * Les textes viennent du pipeline (`ecrans.json` : `chemin`, `route` ; `rythme.json`) ; les
   * caractères se dessinent depuis leurs traits. Ni ombre, ni dégradé, ni doré, ni emoji, ni
   * dragon ; rien ne bouge si l'on réduit les animations.
   */
  import CercleDecor from './CercleDecor.svelte';
  import Glyph from './Glyph.svelte';
  import Hz from './Hz.svelte';
  import Motif from './Motif.svelte';
  import RevisionsEntree from './RevisionsEntree.svelte';
  import Semaine from './Semaine.svelte';
  import Tao from './Tao.svelte';
  import TropheesEntree from './TropheesEntree.svelte';
  import { dire } from './audio';
  import {
    aubergesDuChemin,
    BRUME,
    LARGEUR,
    placeDerriere,
    placerChemin,
    placerSentier,
    PORTE_OUVERTE,
    RENDEZ_VOUS,
    type Auberge,
    type Place
  } from './chemin';
  import {
    contenu,
    contesExport,
    fetesOnce,
    lecon,
    nomParcours,
    saisonsOnce,
    toutesLesFamilles,
    traitsDe,
    traitsDeFamilles,
    type Famille,
    type FicheLue,
    type Fetes,
    type Index,
    type Noeud,
    type Saisons
  } from './content';
  import { ACCES_WEB, prochaineBrique, wenluComplet, type Acces } from './droits';
  import { ecransOnce, remplir, SANS_ECRANS, type TextesChemin, type TextesRoute } from './ecrans';
  import { joursDuChemin, lireMotif, ouvertures } from './etageres';
  import { examenOuvert, examensOnce, SANS_EXAMENS, type ExamensDonnees } from './examens';
  import {
    caracteresLus,
    famillesOuvertes,
    graines,
    ligneSemaine,
    noeudDeFamille,
    racinesDesCaracteres,
    semaine
  } from './foret';
  import { glyph, nomAccessible, type StrokeData } from './glyph';
  import type { StrokeSet } from './strokes';
  import { bibliotheque, caracteresAcquis } from './lecture';
  import {
    boutDuChemin,
    bornesDevant,
    choixParDefaut,
    dansCourt,
    etapesDuChemin,
    ligneBorne,
    pierreSuivante,
    positionDuJour,
    premierSens,
    prochainesBornes,
    quand,
    route,
    verbeOuvre,
    type Borne,
    type ConteAVenir,
    type Etape,
    type ExamenAVenir,
    type Pierre
  } from './route';
  import { quandCarte, quandPierre, SANS_RYTHME, suiteDuChemin, type TextesRythme } from './rythme';
  import { journee } from './saisons';
  import { journeeDuJour, jourParcours, type Progress } from './session';
  import { stade } from './tao';
  import { tropheesLire } from './trophees';
  import { collection, decorDuCercle, ligneTrouve, montrerCollection, type Piece } from './trouves';

  let {
    p,
    jour,
    acces = ACCES_WEB,
    textes = SANS_RYTHME,
    tc = SANS_ECRANS.chemin,
    vois = () => true,
    onfamille,
    onrecompenses,
    onrevisions = () => undefined,
    onexamen,
    onretour
  }: {
    p: Progress;
    /** La journée, AAAA-MM-JJ : la semaine et le décor de fête. */
    jour: string;
    /** Le web ou l'app, et l'achat : ce qui fixe le jour de la prochaine brique. */
    acces?: Acces;
    /** Les lignes du rythme gratuit (`rythme.json`). */
    textes?: TextesRythme;
    /** L'image du chemin (`ecrans.json`, `chemin`). */
    tc?: TextesChemin;
    /** L'aventure (`ouvertures.ts`) : la route devant, les trophées, les révisions. */
    vois?: (id: string) => boolean;
    /** Une auberge touchée : sa famille s'ouvre, sur son sentier. */
    onfamille: (fam: Noeud) => void;
    onrecompenses: () => void;
    onrevisions?: () => void;
    /** Passer l'examen ouvert depuis sa porte ; absent, la porte ne fait que se montrer. */
    onexamen?: () => void;
    /** Mon chemin s'ouvre par sa case ou par « Devant › » ; un seul retour, vers le menu. */
    onretour: () => void;
  } = $props();

  /* ---------- le contenu ---------- */

  let index = $state.raw<Index | null>(null);
  let etapes = $state.raw<Etape[]>([]);
  /** Les pistes de chaque étape : les briques posées jusque-là, pour trouver les familles. */
  let pistesDe = $state.raw<Map<number, string[]>>(new Map());
  let familles = $state.raw<Famille[]>([]);
  let contes = $state.raw<ConteAVenir[]>([]);
  let examens = $state.raw<ExamensDonnees>(SANS_EXAMENS);
  let tr = $state.raw<TextesRoute>(SANS_ECRANS.route);
  let charge = $state(false);
  /** Le filtre de la liste des familles : un caractère, un pinyin, un sens. */
  let cherche = $state('');

  $effect(() => {
    const choisi = p.parcours;
    const cartes = $state.snapshot(p.cartes);
    const lus = $state.snapshot(p.contesLus);
    const relecture = p.relecture;
    let vivant = true;
    void (async () => {
      const [i, fams, cx, ex, ec] = await Promise.all([
        contenu(),
        toutesLesFamilles().catch(() => [] as Famille[]),
        contesExport().catch(() => null),
        examensOnce().catch(() => SANS_EXAMENS),
        ecransOnce().catch(() => SANS_ECRANS)
      ]);
      if (!vivant) return;
      index = i;
      examens = ex;
      tr = ec.route;
      const nom = nomParcours(i, choisi);
      const jours = i.parcours[nom]?.jours ?? [];
      const es = etapesDuChemin(jours);
      etapes = es;
      pistesDe = new Map(es.map((e) => [e.jour, i.parcours[nom]?.jours.filter((j) => j.jour <= e.jour && j.brique !== null).map((j) => j.brique as string).reverse() ?? []]));
      familles = fams;
      if (cx !== null) {
        const a = caracteresAcquis(cartes);
        const entrees = bibliotheque(cx.index, cx.contes, a, lus, relecture, cx.catalogue);
        const ouv = ouvertures(entrees, cx.contes, a, joursDuChemin(jours));
        const motifs = new Map(cx.catalogue.map((c) => [c.id, c.motif]));
        contes = entrees
          .filter((e) => ouv[e.id] !== undefined)
          .map((e) => ({ id: e.id, titre: e.titre_zh || e.titre_fr, jour: ouv[e.id] ?? null, motif: lireMotif(motifs.get(e.id)) }));
      }
      charge = true;
    })().catch(() => {
      if (vivant) charge = true;
    });
    return () => {
      vivant = false;
    };
  });

  /* ---------- les fêtes : le décor, et les trouvés en chemin ---------- */

  let fetes = $state<Fetes | null>(null);
  let saisons = $state<Saisons | null>(null);
  void fetesOnce().then((f) => (fetes = f)).catch(() => undefined);
  void saisonsOnce().then((x) => (saisons = x)).catch(() => undefined);
  const decor = $derived(decorDuCercle(journee(fetes, saisons, jour).theme));
  const pieces = $derived(collection(p.trouves, fetes, saisons));
  let touche = $state<string | null>(null);
  const piece = $derived(pieces.find((x) => x.c === touche) ?? null);

  function toucher(x: Piece): void {
    touche = x.c;
    void dire(x.c);
  }

  /* ---------- la route devant ---------- */

  /** Avant sa porte (jour 9), le haut du chemin est dans la brume. */
  const devantOuvert = $derived(vois('route'));
  const position = $derived(positionDuJour(p));
  const r = $derived(route(etapes, position));
  const sur = $derived(position.sur);
  const lus = $derived(caracteresLus(familles, p.cartes));
  const nbOuvertes = $derived(famillesOuvertes(familles, p.cartes));
  const seuils = $derived(tropheesLire(lus, p.tropheesAcquis).map((t) => ({ n: t.cible, obtenu: t.obtenu })));

  const nombre = (n: number): string => n.toLocaleString('fr-FR');
  const aVenir = $derived<ExamenAVenir[]>(
    examens.examens
      .filter((e) => p.examens.reussis[e.id] === undefined)
      .map((e) => ({ id: e.id, hz: e.hz, palier: e.palier, titre: remplir(tr.examen, { examen: e.hz, n: nombre(e.palier) }), ligne: e.fr }))
  );
  /** L'examen à passer : sa porte s'ouvre sur la route, il ne se compte plus. */
  const ouvert = $derived.by(() => {
    const e = examenOuvert(examens.examens, p.examens, lus);
    return e === null ? null : (aVenir.find((x) => x.id === e.id) ?? null);
  });
  const apres = $derived(ouvert === null ? null : tr.apres);
  const bornes = $derived(
    bornesDevant(etapes, r, seuils, contes, ouvert === null ? aVenir : aVenir.filter((e) => e.id !== ouvert.id))
  );
  const loin = $derived(prochainesBornes(bornes));

  const gratuit = $derived(journeeDuJour(p)?.rythme === 'gratuit');
  const suivante = $derived(
    pierreSuivante(r, prochaineBrique(p.droits, acces, p.day, jourParcours(p)), gratuit && ouvert === null)
  );
  const finDuChemin = $derived(boutDuChemin(r, wenluComplet(p.droits, acces, p.day)));

  /** La pierre choisie ; `null` : celle par défaut, demain. */
  let choisie = $state<number | null>(null);
  const sel = $derived(choisie ?? choixParDefaut(r));
  const pierre = $derived(r.pierres.find((x) => x.jour === sel) ?? null);

  /* ---------- le chemin parcouru et ses auberges ---------- */

  const auberges = $derived(aubergesDuChemin(etapes, familles, p.cartes));
  /** Les tranches dépliées, par leur premier rang. */
  let deplies = $state.raw<Set<number>>(new Set());
  const scene = $derived(placerChemin(r, etapes, auberges, devantOuvert, deplies));
  const ici = $derived(r.pierres.find((x) => x.ecart === 0) ?? null);
  const aubergesDuJour = $derived(ici === null ? [] : (auberges.get(ici.jour) ?? []));
  const premiere = $derived(etapes[0]?.jour ?? null);
  const parRacine = $derived(new Map(familles.map((f) => [f.racine.c, f])));

  function deplier(de: number): void {
    deplies = new Set([...deplies, de]);
  }

  function ouvrirAuberge(a: Auberge): void {
    const f = parRacine.get(a.racine);
    if (f) onfamille(noeudDeFamille(f, p.cartes));
  }

  /* ---------- les traits ---------- */

  let traits = $state.raw<Record<string, StrokeData | null>>({});

  $effect(() => {
    const racines = racinesDesCaracteres(familles);
    const vus = new Set<string>(['读']);
    for (const x of r.pierres) vus.add(x.brique);
    for (const x of scene.derriere) {
      if (x.genre !== 'pave') continue;
      vus.add(x.etape.brique);
      for (const a of x.auberges) {
        vus.add(a.racine);
        for (const m of a.membres) vus.add(m.c);
      }
    }
    for (const a of aubergesDuJour) {
      vus.add(a.racine);
      for (const m of a.membres) vus.add(m.c);
    }
    const noms = [...(ouvert ? [ouvert.hz] : []), ...loin.map((b) => (b.genre === 'examen' ? b.hz : ''))].join('');
    const exRacines = examens.racines;
    const pistes = pistesDe;
    let vivant = true;
    void (async () => {
      const set: StrokeSet = await traitsDeFamilles([...new Set([...vus].map((c) => racines.get(c) ?? c))]).catch(() => ({}));
      const n: Record<string, StrokeData | null> = {};
      for (const c of vus) n[c] = set[c] ?? null;
      /* les caractères que les familles ne portent pas : les noms des examens, une brique découpée */
      const manquent = [...new Set([...vus].filter((c) => n[c] === null)), ...[...new Set(noms)]];
      const ds = await Promise.all(
        manquent.map((c) =>
          traitsDe(c, exRacines[c] ? [exRacines[c]] : (pistes.get(r.jour?.jour ?? 0) ?? [])).catch(() => null)
        )
      );
      manquent.forEach((c, k) => (n[c] = ds[k]));
      if (vivant) traits = n;
    })();
    return () => {
      vivant = false;
    };
  });

  /** Un caractère sur sa pierre, depuis ses traits ; sans traits, la police. */
  function dessin(c: string, taille: number, couleur: string): string {
    const d = traits[c];
    if (!d) {
      return `<text x="${taille / 2}" y="${taille * 0.84}" text-anchor="middle" class="hz" style="font-size:${taille * 0.86}px;fill:${couleur}">${c}</text>`;
    }
    return glyph(c, d, taille, { write: false, color: couleur });
  }

  /* ---------- la carte de l'étape choisie ---------- */

  let detail = $state.raw<{ jour: number; fiches: FicheLue[]; pistes: string[] } | null>(null);

  $effect(() => {
    const j = sel;
    const choisi = p.parcours;
    if (j === null) return;
    let vivant = true;
    void lecon(choisi, j)
      .then((l) => {
        if (!vivant) return;
        const fiches = [l.brique, ...l.composes].filter((f): f is FicheLue => f !== null);
        detail = { jour: j, fiches, pistes: l.pistes };
      })
      .catch(() => {
        if (vivant) detail = { jour: j, fiches: [], pistes: [] };
      });
    return () => {
      vivant = false;
    };
  });

  const carte = $derived(detail !== null && detail.jour === sel ? detail : null);
  const brique = $derived(carte?.fiches[0] ?? null);
  const ouvre = $derived(carte?.fiches.slice(1) ?? []);
  const leRdv = $derived(
    pierre ? ligneBorne(pierre.ecart, bornes, sur, ouvert ? { titre: ouvert.titre, ligne: tr.ouvert } : null) : null
  );

  function quandDe(x: Pierre): string {
    return suivante !== null && x.jour === suivante.jour ? quandCarte(textes, suivante.dans) : quand(x.ecart, sur, apres);
  }

  /** Sous un rendez-vous : le compte en jours du chemin, sinon les caractères lus du prochain examen. */
  function sousRdv(b: Borne): string {
    if (b.genre === 'examen' && b.passe) return remplir(tr.lus, { lus: nombre(lus), n: nombre(b.palier) });
    return dansCourt(b.ecart, sur, apres);
  }

  /** Une ligne sous un rendez-vous reste dans la scène : une largeur estimée, 6,4 unités le signe. */
  function dansLaScene(x: number, t: string): number {
    const demi = ([...t].length * 6.4) / 2 + 4;
    return Math.max(demi, Math.min(LARGEUR - demi, x));
  }

  function choisir(x: Pierre): void {
    choisie = x.jour;
  }

  function clavier(e: KeyboardEvent, f: () => void): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    f();
  }

  const taoStade = $derived(stade(p.tao.croissance));
  const placeDevant = (x: Pierre): Place | undefined => scene.devant.get(x.ecart);
  const rdvDe = (x: Pierre): Borne | undefined => loin.find((b) => b.jour === x.jour);

  /* ---------- l'en-tête, la semaine, la liste ---------- */

  const ligneHaut = $derived(
    [
      lus === 1 ? tc['lus-un'] : remplir(tc.lus, { n: nombre(lus) }),
      nbOuvertes === 1 ? tc['familles-une'] : remplir(tc.familles, { n: nombre(nbOuvertes) }),
      ici ? remplir(tc.jour, { n: ici.jour }) : ''
    ]
      .filter((x) => x !== '')
      .join(' · ')
  );
  const cases = $derived(semaine(p, jour));
  const n = $derived(graines(p, jour));
  const listees = $derived(
    (index?.familles ?? []).filter((f) => cherche === '' || f.racine.includes(cherche) || String(f.n).startsWith(cherche))
  );

  function ouvrirListe(racine: string): void {
    const f = familles.find((x) => x.racine.c === racine);
    if (f) onfamille(noeudDeFamille(f, p.cartes));
  }

  /** Le pavé d'une pierre : lu (jade), du jour (cinabre), devant (au trait). */
  const RAPPORT = { rx: 1.3, ry: 0.8 };
</script>

{#snippet pave(x: number, y: number, rayon: number, c: string, etat: string, choisi: boolean)}
  {#if choisi}
    <ellipse class="anneau" cx={x} cy={y} rx={rayon * RAPPORT.rx + 5} ry={rayon * RAPPORT.ry + 4.5} />
  {/if}
  <ellipse class="pave {etat}" cx={x} cy={y} rx={rayon * RAPPORT.rx} ry={rayon * RAPPORT.ry} />
  <g transform="translate({x - rayon * 0.62} {y - rayon * 0.66})">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html dessin(c, rayon * 1.24, etat === 'lu' ? 'var(--jade)' : etat === 'devant' ? 'var(--ink2)' : etat === 'avenir' ? 'var(--mist)' : 'var(--ink)')}
  </g>
{/snippet}

{#snippet auberge(a: Auberge, place: Place, decalage: number)}
  {@const s = placerSentier(place, a, decalage)}
  <path class="sentier" d={s.d} />
  <g
    class="auberge"
    role="button"
    tabindex="0"
    aria-label={remplir(tc['auberge-voix'], { nom: nomAccessible(a.racine, a.pinyin, a.fr) })}
    onclick={() => ouvrirAuberge(a)}
    onkeydown={(e) => clavier(e, () => ouvrirAuberge(a))}
  >
    <g transform="translate({s.x} {s.y}) scale(0.92)">
      <rect class="mur" x="-16" y="-24" width="32" height="22" />
      <rect class="porte-auberge" x="-5" y="-16" width="10" height="14" rx="1" />
      <path class="toit" d="M-23 -23q7-2 11-10h24q4 8 11 10z" />
      <path class="mat" d="M21 -1V-54" />
      <!-- le fanion flotte au vent, chacun à son temps : sa brique et son sceau avec lui -->
      <g class="flotte" style="animation-delay:{-((Math.abs(s.x * 7 + s.y * 3) % 13) * 0.21).toFixed(2)}s">
      <path class="fanion" d="M21 -52h21v27l-5.25 4-5.25-4-5.25 4-5.25-4z" />
      <g transform="translate(24.5 -45)">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html dessin(a.racine, 14, 'var(--ink)')}
      </g>
      {#if a.sceau}
        <!-- la famille lue en entier : son sceau se pose sur le fanion -->
        <g class="sceau-famille" transform="translate(41 -20)">
          <rect x="-8" y="-8" width="16" height="16" rx="2" />
          <rect class="filet" x="-6" y="-6" width="12" height="12" rx="1.5" />
          <g transform="translate(-5 -5)">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html dessin(a.racine, 10, 'var(--card)')}
          </g>
        </g>
      {/if}
      </g>
    </g>
    {#each s.membres as m (m.c)}
      {@render pave(m.x, m.y, 11, m.c, m.etat, false)}
    {/each}
  </g>
  {#if s.plus}
    <g
      class="plus"
      role="button"
      tabindex="0"
      aria-label={s.plus.n === 1
        ? remplir(tc['plus-voix-un'], { c: a.racine })
        : remplir(tc['plus-voix'], { c: a.racine, n: s.plus.n })}
      onclick={() => ouvrirAuberge(a)}
      onkeydown={(e) => clavier(e, () => ouvrirAuberge(a))}
    >
      <ellipse class="pave avenir" cx={s.plus.x} cy={s.plus.y} rx={11 * RAPPORT.rx} ry={11 * RAPPORT.ry} />
      <text class="compte" x={s.plus.x} y={s.plus.y + 3.5} text-anchor="middle">+{s.plus.n}</text>
    </g>
  {/if}
{/snippet}

{#snippet porteVille(x: number, y: number, hz: string, lanterne: string, ouverte: boolean)}
  <g class="porte-scene" class:ouverte>
    <path d="M{x - 38} {y + 16}q13-2 19-14h38q6 12 19 14z" />
    <rect x={x - 31} y={y + 16} width="62" height="34" />
    <path class="arc" d="M{x - 10} {y + 50}v-11a10 10 0 0 1 20 0v11" />
    <rect class="linteau" x={x - 15} y={y + 19} width="30" height="12" rx="1.5" />
    {#each [...hz] as c, j (c + j)}
      <g transform="translate({x - ([...hz].length * 10) / 2 + j * 10} {y + 20})">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html dessin(c, 10, 'var(--indigo)')}
      </g>
    {/each}
    {#if lanterne !== ''}
      <!-- un seuil du trophée Lire au même palier : la lanterne pendue à l'angle de la porte, qui se balance -->
      <g class="balance">
        <path class="fil" d="M{x + 27} {y + 16}v7" />
        <ellipse class="lanterne" cx={x + 27} cy={y + 32} rx="8" ry="9.5" />
        <text class="nombre" x={x + 27} y={y + 35} text-anchor="middle">{lanterne}</text>
      </g>
    {/if}
  </g>
{/snippet}

<main class="screen chemin">
  <button class="k quit" onclick={onretour}>‹ Retour</button>
  <h1>{tc.titre}<span class="zh" lang="zh-Hans">路</span></h1>
  <p class="sub">{charge ? ligneHaut : ' '}</p>

  {#if devantOuvert && pierre}
    <!-- la carte de l'étape choisie, demain par défaut : la route devant, en tête -->
    <section class="etape" aria-live="polite">
      <div class="mz">
        <svg class="grille" viewBox="0 0 58 58" aria-hidden="true">
          <rect x=".5" y=".5" width="57" height="57" rx="8" />
          <path d="M29 1v56M1 29h56M1 1l56 56M57 1L1 57" />
        </svg>
        {#if brique}
          {#key pierre.jour}
            <span class="gl"><Glyph char={brique.c} size={50} pistes={carte?.pistes ?? []} /></span>
          {/key}
        {/if}
      </div>
      <div class="grow">
        <div class="st" class:now={pierre.ecart === 0}>{quandDe(pierre)} · jour {pierre.jour}</div>
        {#if brique}
          <div class="l1">
            <b>{brique.pinyin}</b>{premierSens(brique.fr)}{#if ouvre.length > 0}{' · '}{verbeOuvre(pierre.ecart)}{#each ouvre as f, k (f.c)}{k > 0 ? ',' : ''}
                <span class="o"><Glyph char={f.c} size={15} write={false} color="var(--ink)" pistes={carte?.pistes ?? []} /></span>{premierSens(f.fr)}{/each}{/if}
          </div>
        {/if}
        {#if leRdv}
          <div class="l2">{leRdv.tete === 'prochain' ? tc['rdv-prochain'] : tc['rdv-ce-jour']} <b>{leRdv.titre}</b>, {leRdv.suite}</div>
        {/if}
      </div>
    </section>
  {/if}

  <div class="scene">
    <div class="decor-haut"><CercleDecor {decor} /></div>
    <svg viewBox="0 0 {scene.largeur} {scene.hauteur}" role="group" aria-label={tc['scene-voix']}>
      <!-- le haut : le soleil pâle, trois collines en aplats, quelques pins de jade -->
      <circle class="soleil" cx="268" cy="40" r="17" />
      <path class="mont1" d="M0 160 L38 118 L70 136 L116 66 L150 104 L178 86 L214 128 L252 96 L290 132 L322 104 L361 128 V380 H0Z" />
      <path class="mont2" d="M0 238 Q50 206 104 222 T214 212 T361 206 V380 H0Z" />
      <path class="mont3" d="M0 382 Q90 352 180 366 T361 358 V386 H0Z" />
      {#each [[34, 232, 0.8], [56, 244, 0.6], [328, 262, 0.8], [304, 282, 0.6], [28, 322, 0.7]] as [x, y, k] (`${x}-${y}`)}
        <g transform="translate({x} {y}) scale({k})">
          <path class="pin" d="M0 -30 L11 -12 L5 -12 L14 2 L-14 2 L-5 -12 L-11 -12Z" />
          <rect class="tronc" x="-2" y="2" width="4" height="7" />
        </g>
      {/each}
      {#if devantOuvert}<text class="etiquette" x="14" y="20">{tc['devant-titre']}</text>{/if}

      <!-- la route devant, au trait de la chaussée ; le chemin parcouru, au jade pâle -->
      <path class="chaussee" d={scene.routeDevant} />
      <path class="parcouru" d={scene.routeDerriere} />

      <!-- la brume, en bandes de papier, où la route se perd -->
      <rect class="brume" x={BRUME.x - 36} y={BRUME.y - 6} width="110" height="12" rx="6" />
      <rect class="brume" x={BRUME.x + 10} y={BRUME.y + 12} width="92" height="12" rx="6" />
      <rect class="brume" x={BRUME.x - 50} y={BRUME.y - 22} width="80" height="12" rx="6" />
      {#if !devantOuvert}
        <!-- avant la porte de la route devant, le haut du chemin reste dans la brume -->
        {#each [[40, 90, 150], [150, 140, 170], [30, 200, 120], [170, 236, 150], [70, 280, 130]] as [x, y, w] (`${x}-${y}`)}
          <rect class="brume" x={x} y={y} width={w} height="13" rx="6.5" />
        {/each}
      {/if}

      {#if devantOuvert}
        <!-- au loin, les deux prochains rendez-vous, au pointillé d'indigo, dans la brume -->
        {#each loin as b, k (`${b.genre}-${b.jour}-${b.titre}`)}
          {@const q = RENDEZ_VOUS[k]}
          {@const ly = q.y + (b.genre === 'conte' ? 60 : 72)}
          <g class="rdv" role="img" aria-label="{b.titre}, {sousRdv(b)}">
            {#if b.genre === 'examen'}
              {@render porteVille(q.x, q.y, b.hz, b.trophee ? String(b.palier) : '', false)}
              <rect class="brume" x={q.x - 42} y={q.y + 46} width="84" height="12" rx="6" />
            {:else if b.genre === 'lire'}
              <!-- un seuil du trophée Lire : la lanterne 灯笼, son nombre -->
              <path class="potence" d="M{q.x - 14} {q.y + 50}V{q.y}h14" />
              <!-- elle se balance doucement au bout de sa potence -->
              <g class="balance" style="animation-delay:{-k * 1.3}s">
                <path class="fil" d="M{q.x} {q.y}v6" />
                <ellipse class="lanterne" cx={q.x} cy={q.y + 18} rx="10" ry="12" />
                <path class="fil" d="M{q.x - 5} {q.y + 6.5}h10M{q.x - 5} {q.y + 29.5}h10" />
                <text class="nombre" x={q.x} y={q.y + 21.5} text-anchor="middle">{b.seuil}</text>
              </g>
              <rect class="brume" x={q.x - 36} y={q.y + 44} width="72" height="12" rx="6" />
            {:else}
              <!-- un conte qui s'ouvre : l'étal de livres, son motif sur la couverture -->
              <g class="etal">
                <path d="M{q.x - 26} {q.y + 16}l6-12h40l6 12z" />
                <path class="pointille" d="M{q.x - 21} {q.y + 16}v32M{q.x + 21} {q.y + 16}v32" />
                <rect x={q.x - 26} y={q.y + 34} width="52" height="6" />
                <rect class="livre" x={q.x - 19} y={q.y + 28} width="16" height="6" />
                <rect class="livre" x={q.x - 17} y={q.y + 23} width="14" height="5" />
                <rect class="livre" x={q.x + 1} y={q.y + 17} width="18" height="17" rx="1" />
                <g class="motif" transform="translate({q.x + 3} {q.y + 19})"><Motif nom={lireMotif(b.motif ?? undefined)} size={14} /></g>
              </g>
              <rect class="brume" x={q.x - 32} y={q.y + 38} width="64" height="12" rx="6" />
            {/if}
            <text class="titre-rdv" x={dansLaScene(q.x, b.titre)} y={ly}>{b.titre}</text>
            <text class="dans" x={dansLaScene(q.x, sousRdv(b))} y={ly + 14}>{sousRdv(b)}</text>
          </g>
        {/each}
      {/if}

      <!-- les auberges et leurs sentiers, avant les pavés du chemin -->
      {#each aubergesDuJour as a, k (a.racine)}
        {@render auberge(a, scene.jour, k * 64)}
      {/each}
      {#each scene.derriere as x (x.genre === 'pave' ? `p${x.etape.jour}` : `r${x.rang}`)}
        {#if x.genre === 'pave'}
          {#each x.auberges as a, k (a.racine)}
            {@render auberge(a, x.place, k * 64)}
          {/each}
        {/if}
      {/each}

      <!-- les pavés : devant au trait, celui du jour cerclé de cinabre, derrière au jade -->
      {#if devantOuvert}
        {#each [...r.pierres].filter((x) => x.ecart > 0).reverse() as x (x.jour)}
          {@const q = placeDevant(x)}
          {#if q}
            <g
              class="pierre"
              role="button"
              tabindex="0"
              data-jour={x.jour}
              aria-label="Jour {x.jour}, {x.brique}, {quandDe(x)}"
              aria-pressed={x.jour === sel}
              onclick={() => choisir(x)}
              onkeydown={(e) => clavier(e, () => choisir(x))}
            >
              {#if rdvDe(x)}
                <!-- le fanion du rendez-vous qui tombe ce jour-là -->
                <path class="fanion-rdv" d="M{q.x + q.r * 1.3 + 3} {q.y}v-18" />
                <path class="fanion-rdv plein" d="M{q.x + q.r * 1.3 + 3} {q.y - 18}h10l-3 4 3 4h-10z" />
              {/if}
              {@render pave(q.x, q.y, q.r, x.brique, 'devant', x.jour === sel)}
            </g>
          {/if}
        {/each}
      {/if}
      {#each scene.derriere as x (x.genre === 'pave' ? `p${x.etape.jour}` : `r${x.rang}`)}
        {#if x.genre === 'pave'}
          <g class="pierre-lue" role="img" aria-label="Jour {x.etape.jour}, {x.etape.brique}, {quand(-1)}">
            {@render pave(x.place.x, x.place.y, x.place.r, x.etape.brique, 'lu', false)}
          </g>
        {:else}
          <!-- trente jours repliés : trois pavés en pile, qui se déplient au toucher -->
          <g
            class="repli"
            role="button"
            tabindex="0"
            aria-label={remplir(tc['repli-voix'], { de: x.de, a: x.a })}
            onclick={() => deplier(x.rang)}
            onkeydown={(e) => clavier(e, () => deplier(x.rang))}
          >
            {#each [8, 4, 0] as d (d)}
              <ellipse class="pave lu" cx={x.place.x} cy={x.place.y - d} rx={x.place.r * RAPPORT.rx} ry={x.place.r * RAPPORT.ry} />
            {/each}
            <text class="repli-t" x={x.place.x + 30} y={x.place.y + 4}>{remplir(tc.repli, { de: x.de, a: x.a })}</text>
          </g>
        {/if}
      {/each}

      {#if ici}
        {@const q = scene.jour}
        <g
          class="pierre"
          role="button"
          tabindex="0"
          data-jour={ici.jour}
          aria-label="Jour {ici.jour}, {ici.brique}, {quandDe(ici)}"
          aria-pressed={ici.jour === sel}
          onclick={() => choisir(ici)}
          onkeydown={(e) => clavier(e, () => choisir(ici))}
        >
          {@render pave(q.x, q.y, q.r, ici.brique, 'jour', false)}
        </g>
      {/if}

      <!-- au rythme gratuit, la pierre suivante porte la prochaine brique, en jours du calendrier -->
      {#if devantOuvert && suivante}
        {@const x = r.pierres.find((q) => q.jour === suivante.jour)}
        {@const q = x ? placeDevant(x) : undefined}
        {#if q}
          <text class="dans prochaine" x={q.x + q.r * 1.3 + 6} y={q.y + 4}>{quandPierre(textes, suivante.dans)}</text>
        {/if}
      {/if}
      {#if devantOuvert && finDuChemin && charge}
        {@const derniere = r.pierres[r.pierres.length - 1]}
        {@const q = derniere.ecart > 0 ? placeDevant(derniere) : scene.jour}
        {#if q}
          <text class="dans fin" x={q.x} y={q.y - q.r - 10} text-anchor="middle"
            >{finDuChemin === 'gratuit' ? textes.route_fin : 'fin du parcours'}</text
          >
        {/if}
      {/if}

      <!-- l'examen à passer : la porte du 贡院 s'ouvre sur la route, devant la pierre du jour -->
      {#if ouvert && ici}
        {@const q = PORTE_OUVERTE}
        {#if onexamen}
          <g
            class="action"
            role="button"
            tabindex="0"
            aria-label="{ouvert.titre}, {tr.ouvert}"
            onclick={() => onexamen()}
            onkeydown={(e) => clavier(e, () => onexamen())}
          >
            {@render porteVille(q.x, q.y, ouvert.hz, '', true)}
          </g>
        {:else}
          <g role="img" aria-label="{ouvert.titre}, {tr.ouvert}">{@render porteVille(q.x, q.y, ouvert.hz, '', true)}</g>
        {/if}
        <text class="dans ouvert" x={q.x} y={q.y - 4} text-anchor="middle">{tr.ouvert}</text>
      {/if}

      <!-- Tao, sur la pierre du jour, et le sceau de la position -->
      {#if ici}
        {@const q = scene.jour}
        <g class="tao" transform="translate({q.x - 48 - 28} {q.y + 10 - 56 * 0.85})">
          <Tao stade={taoStade} posture="chemin" humeur="calme" size={56} />
        </g>
        <rect class="sceau" x={q.x - 30} y={q.y + q.r * 0.8 + 7} width="60" height="19" rx="4" />
        <text class="sceau-t" x={q.x} y={q.y + q.r * 0.8 + 20.5} text-anchor="middle">{remplir(tc['sceau-jour'], { n: ici.jour })}</text>
      {/if}

      {#if scene.derriere.length > 0}
        <text class="etiquette" x="14" y={placeDerriere(1).y + 36}>{tc['derriere-titre']}</text>
      {/if}
      {#if premiere !== null && scene.derriere.length > 0}
        {@const bas = scene.derriere[scene.derriere.length - 1]}
        {#if bas.genre === 'pave' && bas.etape.jour === premiere}
          <text class="dans" x={bas.place.x} y={bas.place.y + 32} text-anchor="middle">{tc['premier-jour']}</text>
        {/if}
      {/if}
    </svg>
  </div>

  {#if devantOuvert && finDuChemin === 'gratuit'}
    <p class="suite">{suiteDuChemin(textes, p.parcours)}</p>
  {/if}

  <div class="k legende">
    <span><i class="lu"></i>{tc['legende-lu']}</span>
    <span><i class="encours"></i>{tc['legende-encours']}</span>
    <span><i class="avenir"></i>{tc['legende-avenir']}</span>
    <span><i class="jour"></i>{tc['legende-jour']}</span>
  </div>
  <p class="k aide">{tc.aide}</p>

  <div class="card bloc">
    <div class="row">
      <div class="grow">
        <div class="t">{tc['semaine-titre']}</div>
        <div class="k">{ligneSemaine(n, tc)}</div>
      </div>
      <div class="big">{n}</div>
    </div>
    <Semaine jours={cases.map((c) => ({ jour: c.jour, lettre: c.lettre, fait: c.graine, aujourdhui: c.aujourdhui }))} label={tc['semaine-voix']} />
    <div class="k">{tc['semaine-note']}</div>
  </div>

  {#if vois('trophees')}<TropheesEntree {p} onouvrir={onrecompenses} />{/if}
  {#if vois('revisions')}<RevisionsEntree {p} onouvrir={onrevisions} />{/if}

  <div class="stat">
    <div class="card"><div class="k">Lus</div><div class="big">{lus}</div></div>
    <div class="card"><div class="k">Familles ouvertes</div><div class="big">{nbOuvertes}</div></div>
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
        <div class="detail-trouve" aria-live="polite">
          <div>
            <span class="hz">{piece.c}</span>
            {[piece.pinyin, piece.sens].filter((x) => x !== '').join(' · ')}
          </div>
          <div class="k">{ligneTrouve(piece)}</div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="card famlist">
    <div class="row">
      <div class="grow" style="font-weight:600">Toutes les familles</div>
      <div class="k">{index?.familles.length ?? 0}</div>
    </div>
    <div class="k">{tc.liste}</div>
    <input class="cherche" type="search" placeholder="Cherche une famille" aria-label="Chercher une famille" bind:value={cherche} />
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
</main>

<style>
  .chemin {
    gap: 0;
  }
  h1 {
    margin: 6px 0 2px;
    font-size: 27px;
  }
  h1 .zh {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 24px;
    color: var(--ink2);
    margin-left: 6px;
  }
  .sub {
    margin: 0 0 10px;
    font-size: 14.5px;
    color: var(--ink2);
    font-variant-numeric: tabular-nums;
    min-height: 1.3em;
  }
  .suite {
    margin: 8px 2px 0;
    font-size: 14px;
    color: var(--ink2);
  }

  /* ---- la carte de l'étape ---- */
  .etape {
    display: flex;
    gap: 12px;
    align-items: center;
    background: var(--card);
    border-radius: 16px;
    padding: 12px 14px;
    margin-bottom: 12px;
  }
  .mz {
    position: relative;
    width: 58px;
    height: 58px;
    flex: none;
    line-height: 0;
  }
  .grille {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .grille rect {
    fill: none;
    stroke: var(--grille);
    stroke-width: 1.2;
  }
  .grille path {
    fill: none;
    stroke: var(--line);
    stroke-dasharray: 3 3;
  }
  .mz .gl {
    position: absolute;
    left: 4px;
    top: 4px;
  }
  .st {
    font: 600 11px/1.2 var(--sans);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .st.now {
    color: var(--zhu);
  }
  .l1 {
    font-size: 15px;
    line-height: 1.35;
  }
  .l1 b {
    font-family: var(--head);
    color: var(--indigo);
    margin-right: 4px;
  }
  .l1 .o {
    display: inline-flex;
    vertical-align: -2px;
    line-height: 0;
    margin: 0 3px;
  }
  .l2 {
    font-size: 13.5px;
    color: var(--ink2);
    line-height: 1.35;
  }
  .l2 b {
    color: var(--ink);
    font-weight: 600;
  }

  /* ---- la scène, en papier découpé : des aplats, rien d'autre ---- */
  .scene {
    position: relative;
    background: var(--card);
    border-radius: 16px;
    overflow: hidden;
    line-height: 0;
  }
  .decor-haut {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    aspect-ratio: 1;
    pointer-events: none;
  }
  .scene > svg {
    position: relative;
    display: block;
    width: 100%;
    height: auto;
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
    fill: var(--card);
  }
  .pin {
    fill: var(--jade);
  }
  .tronc {
    fill: var(--chemin-bois);
  }
  .etiquette {
    font: 700 11px var(--sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    fill: var(--mist);
  }
  .chaussee {
    fill: none;
    stroke: var(--chemin-chaussee);
    stroke-width: 26;
    stroke-linecap: round;
  }
  .parcouru {
    fill: none;
    stroke: var(--chemin-parcouru);
    stroke-width: 34;
    stroke-linecap: round;
  }
  .brume {
    fill: var(--card);
    opacity: 0.92;
  }

  /* les pavés, posés à plat, vus en légère plongée */
  .pave {
    fill: var(--card);
    stroke: var(--mist);
    stroke-width: 1.3;
    stroke-dasharray: 2.5 3;
  }
  .pave.lu {
    stroke: var(--jade);
    stroke-width: 2;
    stroke-dasharray: none;
  }
  .pave.encours {
    stroke: var(--indigo);
    stroke-width: 2.2;
    stroke-dasharray: none;
  }
  .pave.devant {
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  /* le seul cinabre de l'écran : la pierre du jour, la position */
  .pave.jour {
    stroke: var(--zhu);
    stroke-width: 3.2;
    stroke-dasharray: none;
  }
  .anneau {
    fill: none;
    stroke: var(--indigo);
    stroke-width: 2;
  }
  .pierre,
  .auberge,
  .plus,
  .repli,
  .action {
    cursor: pointer;
    outline: none;
  }
  .pierre:focus-visible .pave,
  .repli:focus-visible .pave,
  .plus:focus-visible .pave {
    stroke: var(--indigo);
    stroke-width: 2.6;
  }
  .auberge:focus-visible .fanion {
    stroke: var(--indigo);
    stroke-width: 2.4;
  }
  .compte {
    font: 600 10px var(--sans);
    fill: var(--ink2);
  }
  .repli-t {
    font: 600 12px var(--sans);
    fill: var(--ink2);
  }

  /* l'auberge 客栈 : un toit de malachite, le bois de gomme-gutte, le fanion 幌子 */
  .sentier {
    fill: none;
    stroke: var(--chemin-chaussee);
    stroke-width: 12;
    stroke-linecap: round;
  }
  .auberge .mur {
    fill: var(--card);
    stroke: var(--chemin-bois);
    stroke-width: 1.5;
  }
  .auberge .porte-auberge {
    fill: var(--chemin-bois);
  }
  .auberge .toit {
    fill: var(--chemin-toit);
  }
  .auberge .mat {
    stroke: var(--chemin-bois);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .auberge .fanion {
    fill: var(--card);
    stroke: var(--chemin-fanion);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
  .sceau-famille rect {
    fill: var(--ink);
  }
  .sceau-famille .filet {
    fill: none;
    stroke: var(--card);
    stroke-width: 0.8;
  }

  /* les rendez-vous : à venir, au pointillé d'indigo */
  .porte-scene path,
  .porte-scene rect,
  .etal path,
  .etal rect,
  .potence {
    fill: var(--card);
    stroke: var(--indigo);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .potence,
  .etal .pointille {
    fill: none;
  }
  .porte-scene .linteau,
  .etal .livre {
    stroke-dasharray: none;
    stroke-width: 1.1;
  }
  .porte-scene.ouverte path,
  .porte-scene.ouverte rect {
    stroke-dasharray: none;
    stroke-width: 1.8;
  }
  .porte-scene.ouverte .arc {
    fill: var(--jade-soft);
  }
  .action:focus-visible .porte-scene rect {
    stroke-width: 2.6;
  }
  .lanterne {
    fill: var(--card);
    stroke: var(--indigo);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .fil {
    fill: none;
    stroke: var(--indigo);
    stroke-width: 1.3;
  }
  .nombre {
    font: 700 8.5px var(--sans);
    fill: var(--indigo);
  }
  .etal .motif {
    color: var(--indigo);
  }
  .fanion-rdv {
    fill: none;
    stroke: var(--indigo);
    stroke-width: 1.5;
  }
  .fanion-rdv.plein {
    fill: var(--indigo);
    stroke: none;
  }
  .titre-rdv {
    font: 600 12px var(--sans);
    fill: var(--ink2);
    text-anchor: middle;
  }
  .dans {
    font: 400 11px var(--sans);
    fill: var(--mist);
    text-anchor: middle;
  }
  .dans.prochaine {
    fill: var(--ink2);
    text-anchor: start;
  }
  .dans.ouvert {
    font-weight: 600;
    fill: var(--indigo);
  }
  /* un liseré du papier de la carte, pour se lire sur la route : un aplat, pas une ombre */
  .dans.prochaine,
  .dans.fin,
  .dans.ouvert {
    stroke: var(--card);
    stroke-width: 3px;
    paint-order: stroke;
  }
  .sceau {
    fill: var(--zhu);
  }
  .sceau-t {
    font: 700 12px var(--sans);
    fill: var(--on);
  }
  .tao {
    pointer-events: none;
  }

  /* ---- la légende, la semaine, les nombres ---- */
  .legende {
    justify-content: flex-start;
    font-size: 12.5px;
    margin: 8px 2px 4px;
  }
  .legende i {
    width: 11px;
    height: 11px;
    border: 1.8px solid;
    background: var(--card);
  }
  .legende .lu {
    border-color: var(--jade);
  }
  .legende .encours {
    border-color: var(--indigo);
  }
  .legende .avenir {
    border-color: var(--mist);
    border-style: dashed;
  }
  .legende .jour {
    border-color: var(--zhu);
  }
  .aide {
    margin: 2px 2px 0;
    font-size: 13px;
    line-height: 1.35;
  }
  .bloc {
    margin-top: 12px;
    padding: 12px 14px;
  }
  .bloc .t {
    font-family: var(--head);
    font-weight: 700;
    font-size: 16px;
  }
  .bloc .k {
    font-size: 13.5px;
  }
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
  .detail-trouve {
    margin-top: 12px;
    font-size: 15px;
  }
  .detail-trouve .hz {
    font-size: 17px;
    margin-right: 6px;
  }

  /* Les lanternes de la route devant se balancent doucement, pendues à leur fil : le haut
     du groupe, le crochet, ne bouge pas. Une rotation de trois degrés, rien de plus. */
  .balance {
    transform-box: fill-box;
    transform-origin: 50% 0;
    animation: balancer 3.4s ease-in-out infinite alternate;
  }
  @keyframes balancer {
    from {
      transform: rotate(-3deg);
    }
    to {
      transform: rotate(3deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .balance {
      animation: none;
    }
  }
  /* Le fanion 幌子 flotte au vent, tenu au mât : sa brique et son sceau suivent le tissu.
     Un léger cisaillement, jamais plus de quelques degrés. */
  .flotte {
    transform-box: fill-box;
    transform-origin: 0 0;
    animation: flotter 2.8s ease-in-out infinite alternate;
  }
  @keyframes flotter {
    0% {
      transform: skewY(0deg) scaleX(1);
    }
    50% {
      transform: skewY(-5deg) scaleX(0.95);
    }
    100% {
      transform: skewY(3deg) scaleX(0.98);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flotte {
      animation: none;
    }
  }
</style>
