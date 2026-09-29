<script lang="ts">
  /**
   * « Mon personnage » (brief §8), comme la maquette validée : le rang en haut à droite,
   * dessiné depuis ses traits avec son pinyin ; la scène (le personnage à sa taille, son
   * aura) ; Tao et sa bulle ; le nom et trois lignes ; la barre vers le rang suivant ; les
   * quatre arts. S'ouvre par le portrait de l'en-tête du menu ; un seul retour, vers lui.
   *
   * Une progression sans personnage le choisit ici, la première fois. On en change dans
   * Réglages. Tout ce qui se calcule (rang, taille, bulle) vient de `heros.ts`, les textes
   * de `heros.json`.
   *
   * « Points ET examen » (story 8.5) : le rang en haut est le rang tenu, le titre accordé ;
   * la taille, la silhouette et l'âge suivent les points, la tenue le titre. Sous la barre,
   * pleine quand les points y sont : « Reste le 院试 », sa porte de ville 城门 (décision du
   * propriétaire du 29 septembre 2026 : plus de stèle nulle part) et « dans N j » ou
   * « examen ouvert » ; l'examen réussi avant les points : « Reçu au 院试 · encore 12
   * points ». Puis le 榜 : les examens à titre réussis, chacun avec sa date, sans les 月课.
   * Les lignes viennent de `ecrans.json` (`personnage`), les examens de `examens.json`.
   */
  import ChoixHeros from './ChoixHeros.svelte';
  import Glyph from './Glyph.svelte';
  import Porte from './Porte.svelte';
  import Heros from './Heros.svelte';
  import Tao from './Tao.svelte';
  import { contenu, nomParcours, toutesLesFamilles, type Famille } from './content';
  import { ecransOnce, remplir, SANS_ECRANS, type TextesPersonnage, type TextesRoute } from './ecrans';
  import { examenOuvert, examensOnce, SANS_EXAMENS, type ExamensDonnees } from './examens';
  import { caracteresLus } from './foret';
  import {
    ARTS,
    avance,
    beteDe,
    caracteresDeLAura,
    examensRecus,
    meriteDe,
    phraseDeTao,
    pistes,
    rangDe,
    sansArticle,
    taille,
    total,
    type BeteId,
    type HerosDonnees
  } from './heros';
  import { dansCourt, etapesDuChemin, positionDuJour, quandExamen, route, type Etape } from './route';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    donnees,
    onretour,
    onchoisi
  }: {
    p: Progress;
    donnees: HerosDonnees | null;
    onretour: () => void;
    onchoisi: (bete: BeteId, nom: string) => void;
  } = $props();

  /* ---------- ce que l'écran lit : les examens, les familles, le chemin, les lignes ---------- */

  let examens = $state.raw<ExamensDonnees>(SANS_EXAMENS);
  let familles = $state.raw<Famille[]>([]);
  let etapes = $state.raw<Etape[]>([]);
  let tp = $state.raw<TextesPersonnage>(SANS_ECRANS.personnage);
  let tr = $state.raw<TextesRoute>(SANS_ECRANS.route);

  $effect(() => {
    const choisi = p.parcours;
    let vivant = true;
    void Promise.all([
      examensOnce().catch(() => SANS_EXAMENS),
      toutesLesFamilles().catch(() => [] as Famille[]),
      contenu().catch(() => null),
      ecransOnce().catch(() => SANS_ECRANS)
    ]).then(([ex, fams, i, ec]) => {
      if (!vivant) return;
      examens = ex;
      familles = fams;
      etapes = i === null ? [] : etapesDuChemin(i.parcours[nomParcours(i, choisi)]?.jours ?? []);
      tp = ec.personnage;
      tr = ec.route;
    });
    return () => {
      vivant = false;
    };
  });

  /* ---------- le rang tenu, la taille et la silhouette ---------- */

  const points = $derived(total(p.arts));
  const rangs = $derived(donnees?.rangs ?? []);
  /** Les caractères lus, au seuil de stabilité de Mon chemin : le palier des nominations. */
  const lusCompte = $derived(caracteresLus(familles, p.cartes));
  const merite = $derived(meriteDe(p, lusCompte));
  const av = $derived(avance(rangs, merite));
  const rang = $derived(rangs[av.rang] ?? null);
  /** L'étape de vie des seuls points : la silhouette et l'âge. */
  const vie = $derived(rangDe(points, rangs));
  const bete = $derived(donnees && p.heros ? beteDe(donnees, p.heros.bete) : null);
  const echelle = $derived(taille(points, rangs));
  const lus = $derived(caracteresDeLAura(p.cartes));
  const nomExamen = (id: string): string => examens.examens.find((e) => e.id === id)?.hz ?? '';
  const bulle = $derived(donnees && p.heros ? phraseDeTao(donnees, p.arts, p.heros.nom, merite, nomExamen) : '');
  const plusFort = $derived(Math.max(10, ...ARTS.map((a) => p.arts[a.id])));
  const nombre = (n: number): string => n.toLocaleString('fr-FR');

  /* ---------- ce qui reste avant le titre suivant ---------- */

  /** L'examen qui reste, ou celui qu'on a réussi avant les points. */
  const examenReste = $derived(
    av.reste.attend === 'examen' || av.reste.attend === 'recu'
      ? (examens.examens.find((e) => e.id === (av.reste as { examen: string }).examen) ?? null)
      : null
  );
  const ligneReste = $derived.by(() => {
    const r = av.reste;
    if (r.attend === 'examen' && examenReste) return remplir(tp.reste, { examen: examenReste.hz });
    if (r.attend === 'recu' && examenReste) {
      return r.manque === 1
        ? remplir(tp['recu-un'], { examen: examenReste.hz })
        : remplir(tp.recu, { examen: examenReste.hz, n: nombre(r.manque) });
    }
    if (r.attend === 'palier' && av.suivant) {
      return remplir(tp.palier, { rang: av.suivant.hz, palier: nombre(r.palier), lus: nombre(lusCompte) });
    }
    return '';
  });
  /** Sous « Reste le 院试 » : « examen ouvert », ou « dans N j » en jours du chemin. */
  const quandReste = $derived.by(() => {
    if (av.reste.attend !== 'examen' || examenReste === null) return '';
    const ouvert = examenOuvert(examens.examens, p.examens, lusCompte)?.id === examenReste.id;
    const position = positionDuJour(p);
    const q = quandExamen(
      etapes,
      route(etapes, position),
      { id: examenReste.id, hz: examenReste.hz, palier: examenReste.palier, titre: '', ligne: '' },
      ouvert
    );
    if (q === null) return '';
    if (q.etat === 'ouvert') return tp.ouvert;
    if (q.etat === 'lus') return remplir(tr.lus, { lus: nombre(lusCompte), n: nombre(examenReste.palier) });
    return dansCourt(q.ecart, position.sur);
  });

  /** Le 榜 du personnage : les examens à titre réussis, avec leur date, sans les 月课. */
  const bang = $derived(examensRecus(examens.examens, p.examens.reussis));
  const pistesExamen = (c: string): string[] => (examens.racines[c] ? [examens.racines[c]] : []);
  function date(jour: string): string {
    const [a, m, j] = jour.split('-').map(Number);
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
</script>

<main class="screen perso">
  {#if donnees === null}
    <button class="k quit" onclick={onretour}>‹ Retour</button>
  {:else if p.heros === null}
    <button class="k quit" onclick={onretour}>‹ Retour</button>
    <ChoixHeros {donnees} surtitre="Mon personnage" stade={stade(p.tao.croissance)} {onchoisi} />
  {:else}
    <div class="top">
      <button class="k quit" onclick={onretour}>‹ Retour</button>
      {#if rang}
        <div class="rang" aria-label="{rang.hz}, {rang.pinyin}">
          <span class="rhz" aria-hidden="true">
            {#each [...rang.hz] as c, i (c + i)}
              <Glyph char={c} size={26} write={false} color="var(--ink)" pistes={pistes(donnees, c)} />
            {/each}
          </span>
          <span class="rpy">{rang.pinyin}</span>
        </div>
      {/if}
    </div>

    <div class="scene">
      <Heros bete={p.heros.bete} rang={av.rang} silhouette={vie} {echelle} {points} {lus} />
    </div>

    <div class="aide">
      <Tao stade={stade(p.tao.croissance)} posture="chemin" humeur={humeur(p.tao.activites, p.day)} size={50} />
      {#if bulle !== ''}<div class="bulle" role="status">{bulle}</div>{/if}
    </div>

    <div class="nom">
      <b>{p.heros.nom}</b>
      {#if rang}
        <span>«&nbsp;{rang.fr}&nbsp;» · {rang.role}</span>
        <small
          >{bete ? `${bete.hz} ${sansArticle(bete.fr)} · ` : ''}{rangs[vie]?.age ?? rang.age} · rang {av.rang + 1} sur {rangs.length}</small
        >
      {/if}
    </div>

    <div class="xp">
      <div class="row">
        <span>{nombre(points)} point{points > 1 ? 's' : ''}</span>
        <span>{av.suivant ? `${nombre(av.suivant.seuil)} pour ${av.suivant.hz}` : 'rang le plus haut'}</span>
      </div>
      <div class="bar"><i style="width:{Math.round(av.part * 100)}%"></i></div>
      {#if ligneReste !== ''}
        <div class="reste" class:examen={examenReste !== null && av.reste.attend === 'examen'}>
          {#if examenReste && av.reste.attend === 'examen'}
            <!-- la porte de ville de l'examen qui reste, son nom sur le linteau, depuis ses traits -->
            <span class="porte-examen">
              <Porte hz={examenReste.hz} pistes={[...new Set([...examenReste.hz].flatMap(pistesExamen))]} largeur={60} ouverte={quandReste === tp.ouvert} />
            </span>
          {/if}
          <span class="lignes">
            <b>{ligneReste}</b>
            {#if quandReste !== ''}<small>{quandReste}</small>{/if}
          </span>
        </div>
      {/if}
    </div>

    <div class="arts">
      {#each ARTS as a (a.id)}
        <div class="art {a.id}">
          <span class="ahz"><Glyph char={a.c} size={30} write={false} color="var(--art)" /></span>
          <span class="l">{a.t}</span>
          <span class="n">{nombre(p.arts[a.id])}</span>
          <span class="pip"><i style="width:{Math.round((p.arts[a.id] / plusFort) * 100)}%"></i></span>
        </div>
      {/each}
    </div>

    {#if bang.length > 0}
      <section class="bang" aria-label={tp.bang}>
        <h2>{tp.bang}</h2>
        <ul>
          {#each bang as r (r.examen.id)}
            <li>
              <span class="ehz" aria-label="{r.examen.hz}, {r.examen.pinyin}">
                {#each [...r.examen.hz] as c, i (c + i)}
                  <Glyph char={c} size={22} write={false} color="var(--jade)" pistes={pistesExamen(c)} />
                {/each}
              </span>
              <span class="efr">{r.examen.fr}</span>
              <small>{remplir(tp['bang-date'], { date: date(r.jour) })}</small>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</main>

<style>
  .perso {
    padding-bottom: 20px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .rang {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding-top: 4px;
  }
  .rhz {
    display: flex;
    line-height: 0;
  }
  .rpy {
    font-size: 12.5px;
    color: var(--mist);
    font-style: italic;
    margin-top: 2px;
  }
  .scene {
    height: 232px;
    margin-top: -6px;
  }
  .scene :global(.heros-svg) {
    height: 100%;
  }
  .aide {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
  }
  .bulle {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 14px;
    padding: 6px 11px;
    font-size: 14px;
    line-height: 1.3;
    margin-left: 4px;
  }
  .bulle::before {
    content: '';
    position: absolute;
    left: -6.5px;
    top: 50%;
    width: 10px;
    height: 10px;
    background: var(--card);
    border-left: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    transform: translateY(-50%) rotate(45deg);
  }
  .nom {
    text-align: center;
  }
  .nom b {
    display: block;
    font-family: var(--head);
    font-size: 22px;
    line-height: 1.2;
  }
  .nom span {
    display: block;
    color: var(--ink2);
    font-size: 14.5px;
    line-height: 1.35;
  }
  .nom small {
    display: block;
    color: var(--mist);
    font-size: 13px;
    line-height: 1.35;
  }
  .xp {
    margin-top: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    font-size: 13.5px;
    color: var(--ink2);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 12px;
    border-radius: 8px;
    background: var(--paper);
    border: 1.5px solid var(--line);
    overflow: hidden;
    margin-top: 5px;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--indigo);
    border-radius: 8px;
  }
  /* ce qui reste avant le titre : la porte de l'examen, à l'indigo, et sa ligne ; rien qui presse */
  .reste {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 7px;
    font-size: 14px;
    color: var(--ink2);
  }
  .reste .porte-examen {
    line-height: 0;
    flex: none;
  }
  .reste .lignes {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }
  .reste b {
    font-weight: 600;
    color: var(--ink);
  }
  .reste small {
    font-size: 12.5px;
    color: var(--indigo);
  }
  /* le 榜 du personnage : les examens à titre réussis, au jade du reçu */
  .bang {
    margin-top: 14px;
  }
  .bang h2 {
    margin: 0 0 6px;
    font: 600 13px var(--sans);
    color: var(--mist);
  }
  .bang ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .bang li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    background: var(--card);
    border-radius: 12px;
    padding: 6px 12px 6px 8px;
  }
  .ehz {
    display: flex;
    line-height: 0;
  }
  .efr {
    font-size: 13px;
    color: var(--ink2);
    line-height: 1.25;
    min-width: 0;
  }
  .bang small {
    font-size: 12.5px;
    color: var(--jade);
    white-space: nowrap;
  }
  .arts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }
  .art {
    background: var(--card);
    border-radius: 14px;
    padding: 8px 6px 9px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--art);
  }
  /* les pigments de la charte, ceux du thème : lisibles aussi les nuits de fête */
  .art.du {
    --art: var(--t1);
  }
  .art.xie {
    --art: var(--ocre);
  }
  .art.ting {
    --art: var(--jade);
  }
  .art.shuo {
    --art: var(--t3);
  }
  .ahz {
    line-height: 0;
  }
  .l {
    font-size: 12.5px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .n {
    font-family: var(--head);
    font-weight: 700;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }
  .pip {
    align-self: stretch;
    height: 4px;
    border-radius: 3px;
    background: var(--line);
    margin: 5px 8px 0;
    overflow: hidden;
  }
  .pip i {
    display: block;
    height: 100%;
    background: var(--art);
  }
</style>
