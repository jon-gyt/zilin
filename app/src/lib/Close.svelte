<script lang="ts">
  /**
   * Pas 6, Clore : la seule fin de la session. Le constat en une ligne, la graine qui
   * pousse, la semaine et la série sur le même écran, puis le menu. L'ancien écran de
   * série est fondu ici : il n'y a plus deux fins.
   *
   * La graine du jour se voit plantée dès l'arrivée ; elle ne se range dans la progression
   * qu'au tap sur « Terminer » (`cloreSession`), une fois par journée. Une session de plus
   * le dit : la graine du jour est déjà plantée, il n'y en a jamais une seconde.
   *
   * Encre et jade, des aplats et des traits : ni dégradé, ni ombre. Le cinabre ne marque
   * que la case du jour dans la semaine. Jamais un compteur de jours manqués.
   */
  import EnTetePas from './EnTetePas.svelte';
  import Que from './Que.svelte';
  import Tao from './Tao.svelte';
  import { caractereDuJour, contenuTrophees, lecon, type ContenuTropheesLu } from './content';
  import {
    CADEAUX,
    NOTE_REMISE,
    etatSerie,
    libelleJours,
    messageCadeau,
    messageProchain,
    messageSemaine
  } from './serie';
  import { cloreSession, constat, jourLecon, rendezVous, type Progress } from './session';
  import { stade } from './tao';
  import { nouveauxAcquis, tableau } from './trophees';

  let {
    p,
    onterminer,
    onquitter
  }: {
    p: Progress;
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

  /** Les trophées obtenus une fois la session close, graine du jour comprise. */
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
        if (vivant) caractere = caractereDuJour(l);
      })
      .catch(() => {
        if (vivant) caractere = '';
      });
    return () => {
      vivant = false;
    };
  });

  /** La graine du jour est-elle déjà plantée ? Oui après une première session close. */
  const dejaPlantee = $derived(p.joursTravailles.includes(p.day));
  /** La série telle qu'elle sera une fois la graine du jour plantée. */
  const s = $derived(etatSerie([...p.joursTravailles, p.day], p.day));
  const taoStade = $derived(stade(p.tao.croissance));
</script>

<main class="screen">
  <EnTetePas {p} {onquitter} />

  <div class="card center clore">
    <div class="tao-joie"><Tao stade={taoStade} posture="chemin" humeur="joie" size={72} /></div>
    <div class="seed" aria-hidden="true">
      <svg viewBox="0 0 120 120" width="104" height="104">
        <line x1="10" y1="92" x2="110" y2="92" stroke="var(--line)" stroke-width="3" stroke-linecap="round" />
        <circle class="sd" cx="60" cy="20" r="6" fill="var(--ink)" />
        <path class="st" d="M60 92 V60" stroke="var(--jade)" stroke-width="4" stroke-linecap="round" fill="none" />
        <path
          class="lf"
          d="M60 66 Q46 62 44 50 M60 66 Q74 62 76 50"
          stroke="var(--jade)"
          stroke-width="4"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
    </div>
    {#if caractere}<h1>{caractere} entre dans ta forêt.</h1>{/if}
    <p class="guide">
      {dejaPlantee ? 'La graine du jour est déjà plantée : une par jour, jamais deux.' : rendezVous()}
    </p>
    <div class="k">{constat(p, p.day)}</div>
  </div>

  <div class="card semaine-serie">
    <div class="row">
      <div class="grow">
        <div class="t">{s.jours} {libelleJours(s)}</div>
        <div class="k">{messageSemaine(s)}</div>
      </div>
    </div>
    <div class="seeds" aria-label="Les graines de la semaine">
      {#each s.semaine as g, i (g.jour)}
        <i
          class:on={g.travaille}
          class:today={g.aujourdhui}
          class:pop={g.aujourdhui && g.travaille && !dejaPlantee}
          style="animation-delay:{(1.4 + 0.05 * i).toFixed(2)}s">{g.lettre}</i
        >
      {/each}
    </div>
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
            {CADEAUX[s.palier].detail}
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
  .tao-joie {
    display: flex;
    justify-content: center;
    margin-bottom: -8px;
  }
  .semaine-serie .t {
    font-family: var(--head);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
  }
  /* la graine du jour apparaît une fois la graine tombée dans la carte du dessus */
  .seeds i.pop {
    animation: pop 0.55s cubic-bezier(0.2, 1.5, 0.4, 1) both;
  }
  @keyframes pop {
    0% {
      transform: scale(0.4);
    }
    60% {
      transform: scale(1.2);
    }
    100% {
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .seeds i.pop {
      animation: none;
    }
  }
</style>
