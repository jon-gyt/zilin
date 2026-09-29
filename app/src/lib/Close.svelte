<script lang="ts">
  /**
   * Pas 6, Clore : la seule fin de la session. Le constat en une ligne, la pierre du jour
   * posée sur le chemin, la semaine et la série sur le même écran, puis le menu. L'ancien
   * écran de série est fondu ici : il n'y a plus deux fins.
   *
   * La pierre du jour (maquette validée `maquettes/chemin.html`, décision du propriétaire du
   * 29 septembre 2026) se pose à plat sur le chemin, après les trois dernières, cerclée de
   * cinabre, la position : « 儿 rejoint ton chemin. » Elle se voit posée dès l'arrivée ; elle
   * ne se range dans la progression qu'au tap sur « Terminer » (`cloreSession`), une fois
   * par journée. Une session de plus le dit : la pierre du jour est déjà posée, il n'y en a
   * jamais une seconde. Sept pierres font un pavillon.
   *
   * Encre et jade, des aplats et des traits : ni dégradé, ni ombre. Le cinabre ne marque que
   * la pierre du jour, sur le chemin et dans la semaine. Jamais un compteur de jours manqués.
   * Les textes viennent du pipeline (`ecrans.json`, `chemin` ; `rythme.json`).
   */
  import EnTetePas from './EnTetePas.svelte';
  import Que from './Que.svelte';
  import Semaine from './Semaine.svelte';
  import Tao from './Tao.svelte';
  import { caractereDuJour, contenu, contenuTrophees, lecon, nomParcours, traitsDe, type ContenuTropheesLu } from './content';
  import { remplir, SANS_ECRANS, type TextesChemin } from './ecrans';
  import { glyph, type StrokeData } from './glyph';
  import { etapesDuChemin, positionDuJour, rangDuJour } from './route';
  import {
    CADEAUX,
    NOTE_REMISE,
    detailCadeau,
    etatSerie,
    libelleJours,
    messageCadeau,
    messageProchain,
    messageSemaine
  } from './serie';
  import {
    annonceRythmeGratuit,
    cloreSession,
    constat,
    jourLecon,
    rendezVous,
    sansBrique,
    type Progress
  } from './session';
  import { ligne, SANS_RYTHME, type TextesRythme } from './rythme';
  import { stade } from './tao';
  import { sessionClose } from './haptique';
  import { onMount } from 'svelte';
  import { nouveauxAcquis, tableau } from './trophees';

  let {
    p,
    textes = SANS_RYTHME,
    tc = SANS_ECRANS.chemin,
    examen = '',
    onterminer,
    onquitter
  }: {
    p: Progress;
    /**
     * Le palier atteint, l'examen s'ouvre : Clore le dit en une ligne, ce jour-là (story
     * 8.4, « 50 caractères lus : l'examen 县试 s'ouvre. »). Vide, rien à dire.
     */
    examen?: string;
    /**
     * Les lignes du rythme gratuit : le titre d'un jour sans brique nouvelle, et la ligne du
     * jour où le rythme gratuit commence.
     */
    textes?: TextesRythme;
    /** L'image du chemin (`ecrans.json`, `chemin`) : la pierre posée, la semaine en pierres. */
    tc?: TextesChemin;
    /**
     * Terminer : la session se clôt. Les trophées que la journée a fait obtenir remontent,
     * pour être notés avec leur date : un trophée obtenu le reste.
     */
    onterminer: (obtenus: string[]) => void;
    onquitter: () => void;
  } = $props();

  /** Le contenu que lit le tableau des trophées. Absent, la clôture ne note rien de plus. */
  let contenuLu = $state(null as ContenuTropheesLu | null);

  $effect(() => {
    let vivant = true;
    contenuTrophees()
      .then((c) => {
        if (vivant) contenuLu = c;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /** L'arrivée au pas Clore : dans l'app iOS, un signal doux, une fois. */
  onMount(sessionClose);

  /** Les trophées obtenus une fois la session close, pierre du jour comprise. */
  function terminer(): void {
    const close = cloreSession(p, p.day);
    onterminer(contenuLu ? nouveauxAcquis(tableau(close, contenuLu), close.tropheesAcquis) : []);
  }

  /** Le caractère du jour : le composé de la session, la brique quand il n'y en a pas. */
  let caractere = $state('');

  $effect(() => {
    const n = jourLecon(p);
    const choisi = p.parcours;
    let vivant = true;
    void lecon(choisi, n)
      .then((l) => {
        if (vivant) caractere = sansBrique(p)?.c || caractereDuJour(l);
      })
      .catch(() => {
        if (vivant) caractere = '';
      });
    return () => {
      vivant = false;
    };
  });

  /** La pierre du jour est-elle déjà posée ? Oui après une première session close. */
  const dejaPlantee = $derived(p.joursTravailles.includes(p.day));
  /** La série telle qu'elle sera une fois la pierre du jour posée. */
  const s = $derived(etatSerie([...p.joursTravailles, p.day], p.day));
  const taoStade = $derived(stade(p.tao.croissance));
  /** Un jour sans brique nouvelle, rien de neuf ne rejoint le chemin : la brique a été revue. */
  const revue = $derived(sansBrique(p) !== null);
  /** Le jour où le rythme gratuit commence, Clore le dit, en une ligne, ce jour-là seulement. */
  const rythmeGratuit = $derived(annonceRythmeGratuit(p) ? textes.clore_rythme : '');

  /*
   * Le bout de chemin du dessin : les trois dernières pierres, au jade, celle du jour, qui
   * se pose, et la suivante, au trait. Les briques des étapes (`route.ts`), depuis leurs traits.
   */
  let bout = $state.raw<{ avant: string[]; jour: string; apres: string | null }>({ avant: [], jour: '', apres: null });
  let traits = $state.raw<Record<string, StrokeData | null>>({});

  $effect(() => {
    const choisi = p.parcours;
    const pos = positionDuJour(p);
    const revu = sansBrique(p)?.c ?? '';
    let vivant = true;
    void (async () => {
      const i = await contenu();
      const nom = nomParcours(i, choisi);
      const etapes = etapesDuChemin(i.parcours[nom]?.jours ?? []);
      const { i: k } = rangDuJour(etapes, pos);
      if (k < 0) return;
      const b = {
        avant: etapes.slice(Math.max(0, k - 3), k).map((e) => e.brique),
        jour: revu || etapes[k].brique,
        apres: etapes[k + 1]?.brique ?? null
      };
      const cs = [...new Set([...b.avant, b.jour, ...(b.apres ? [b.apres] : [])])];
      const ds = await Promise.all(cs.map((c) => traitsDe(c).catch(() => null)));
      if (!vivant) return;
      const n: Record<string, StrokeData | null> = {};
      cs.forEach((c, j) => (n[c] = ds[j]));
      traits = n;
      bout = b;
    })().catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  function dessin(c: string, taille: number, couleur: string): string {
    const d = traits[c];
    if (!d) {
      return `<text x="${taille / 2}" y="${taille * 0.84}" text-anchor="middle" class="hz" style="font-size:${taille * 0.86}px;fill:${couleur}">${c}</text>`;
    }
    return glyph(c, d, taille, { write: false, color: couleur });
  }

  /** Les places des trois dernières pierres, de la plus proche de celle du jour à la plus loin. */
  const AVANT = [
    { x: 134, y: 111 },
    { x: 84, y: 108 },
    { x: 34, y: 112 }
  ];
</script>

<main class="screen">
  <EnTetePas {p} {onquitter} />

  <div class="card center clore">
    <!-- la pierre du jour se pose à plat sur le chemin, cerclée de cinabre -->
    <svg class="pose-pierre" viewBox="0 0 300 150" role="img" aria-label={tc['clore-dessin']}>
      <path class="bande" d="M-10 118q80-20 160-6t170-8" />
      {#each [...bout.avant].reverse() as c, k (c + k)}
        {@const q = AVANT[k]}
        <ellipse class="pave lu" cx={q.x} cy={q.y} rx="18.2" ry="11.2" />
        <g transform="translate({q.x - 9} {q.y - 9})">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html dessin(c, 18, 'var(--jade)')}
        </g>
      {/each}
      {#if bout.apres}
        <ellipse class="pave devant" cx="254" cy="106" rx="14.3" ry="8.8" />
        <g transform="translate(247 99)">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html dessin(bout.apres, 14, 'var(--ink2)')}
        </g>
      {/if}
      {#if bout.jour !== ''}
        {#if !dejaPlantee}
          <!-- la pierre touche le chemin : deux ondes, comme un pavé posé dans l'eau -->
          <ellipse class="onde" cx="196" cy="112" rx="24" ry="15" />
          <ellipse class="onde deux" cx="196" cy="112" rx="24" ry="15" />
        {/if}
        <g class="pose" class:deja={dejaPlantee}>
          <ellipse class="pave jour" cx="196" cy="112" rx="24" ry="15" />
          <ellipse class="cercle-jour" cx="196" cy="112" rx="24" ry="15" />
          <g transform="translate(184 100)">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html dessin(bout.jour, 24, 'var(--ink)')}
          </g>
        </g>
      {/if}
      <g transform="translate(150 4)"><Tao stade={taoStade} posture="chemin" humeur="joie" size={90} /></g>
    </svg>
    {#if caractere && revue}
      <h1>{ligne(textes, 'clore_revue', { c: caractere })}</h1>
    {:else if caractere}
      <h1>{remplir(tc['clore-titre'], { c: caractere })}</h1>
    {/if}
    <p class="guide">
      {dejaPlantee ? tc['clore-deja'] : rendezVous()}
    </p>
    <div class="k">{constat(p, p.day)}</div>
    {#if rythmeGratuit !== ''}<p class="rythme">{rythmeGratuit}</p>{/if}
    {#if examen !== ''}<p class="rythme examen">{examen}</p>{/if}
  </div>

  <div class="card semaine-serie">
    <div class="row">
      <div class="grow">
        <div class="t">{s.jours} {libelleJours(s)}</div>
        <div class="k">{messageSemaine(s, tc)}</div>
      </div>
    </div>
    <Semaine
      jours={s.semaine.map((g) => ({ jour: g.jour, lettre: g.lettre, fait: g.travaille, aujourdhui: g.aujourdhui }))}
      label={tc['semaine-voix']}
      pose={!dejaPlantee}
    />
    {#if s.palier === null && messageProchain(s) !== ''}
      <div class="k">{messageProchain(s)}</div>
    {/if}
  </div>

  {#if s.palier !== null && !dejaPlantee}
    <div class="giftcard">
      <div class="row">
        <Que size={56} cadeau="ouvert" />
        <div class="grow">
          <b>{messageCadeau(s.palier)}</b>
          <span class="k">
            {detailCadeau(s.palier, tc)}
            {#if CADEAUX[s.palier].remise}{NOTE_REMISE}{/if}
          </span>
        </div>
      </div>
    </div>
  {/if}

  <div class="foot"><button class="btn" onclick={terminer}>Terminer</button></div>
</main>

<style>
  .clore {
    padding: 14px 16px 18px;
  }
  /* La ligne du rythme gratuit : un constat, à l'encre, sous le journal du jour. */
  .rythme {
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink);
  }
  .semaine-serie .t {
    font-family: var(--head);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
  }
  /* le dessin : un bout de chemin au jade pâle, les pavés posés à plat */
  .pose-pierre {
    display: block;
    width: 100%;
    max-width: 300px;
    height: auto;
    margin: 0 auto 4px;
    overflow: visible;
  }
  .bande {
    fill: none;
    stroke: var(--chemin-parcouru);
    stroke-width: 30;
    stroke-linecap: round;
  }
  .pave {
    fill: var(--card);
  }
  .pave.lu {
    stroke: var(--jade);
    stroke-width: 2;
  }
  .pave.devant {
    stroke: var(--mist);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .pave.jour {
    stroke: var(--line);
    stroke-width: 2;
  }
  /* le cinabre : la pierre du jour, la position, cerclée d'un trait qui se referme */
  .cercle-jour {
    fill: none;
    stroke: var(--zhu);
    stroke-width: 3.2;
    stroke-dasharray: 132;
    animation: cercler 0.6s ease-out 1s both;
  }
  .pose {
    animation: poser 0.8s cubic-bezier(0.3, 0.7, 0.3, 1) 0.35s both;
  }
  /* L'onde part quand la pierre touche le chemin (0,35 s + 55 % de 0,8 s), s'élargit et
     s'efface ; à l'encre pâle, jamais au cinabre. */
  .onde {
    fill: none;
    stroke: var(--mist);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
    animation: onde 0.9s ease-out 0.79s forwards;
  }
  .onde.deux {
    animation-delay: 0.97s;
  }
  @keyframes onde {
    from {
      opacity: 0.7;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(2);
    }
  }
  .pose.deja,
  .pose.deja .cercle-jour {
    animation: none;
  }
  /* elle tombe, touche le chemin, rebondit un peu et se pose */
  @keyframes poser {
    0% {
      transform: translateY(-46px);
      opacity: 0;
    }
    55% {
      transform: translateY(2px);
      opacity: 1;
    }
    72% {
      transform: translateY(-6px);
    }
    88% {
      transform: translateY(1px);
    }
    100% {
      transform: none;
      opacity: 1;
    }
  }
  @keyframes cercler {
    from {
      stroke-dashoffset: 132;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pose,
    .cercle-jour {
      animation: none;
    }
    .onde {
      display: none;
    }
  }
</style>
