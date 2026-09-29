<script lang="ts">
  /**
   * Une famille ouverte : son auberge 客栈 et son sentier (maquette validée
   * `maquettes/chemin.html`, décisions du propriétaire du 29 septembre 2026). Le sentier part
   * de l'auberge, en bas, là où la brique a été posée, et monte, pavé des caractères de la
   * famille : les lus au jade, ceux en cours à l'indigo, ceux qui attendent au pointillé ;
   * une génération de plus bifurque du caractère qu'elle contient ; au-delà de dix, « +N »
   * déplie le reste. Le fanion attend le sceau de la famille, qui s'y pose quand elle est lue
   * en entier. La fiche courte au toucher, et la prochaine leçon qui ramène au menu.
   *
   * La famille et ses tracés viennent de l'export versionné : un fichier de fiches et un
   * fichier de traits, ceux de cette famille et d'elle seule. La fiche courte affiche
   * l'origine et son étiquette quand une fiche relue (ou la surcouche de démonstration)
   * en porte une ; sinon elle le dit, et n'étiquette rien. L'aperçu allumé (Réglages),
   * une fiche à relire porte la mention « à relire ». Le nom de fichier garde son nom
   * d'origine ; les textes viennent de `ecrans.json` (`chemin`).
   */
  import { untrack } from 'svelte';
  import {
    ETIQUETTES,
    LIGNE_SANS_FICHE,
    contenu,
    fiche,
    nomParcours,
    traits as traitsDeFamille,
    type FicheLue,
    type Noeud
  } from './content';
  import ARelire from './ARelire.svelte';
  import Tao from './Tao.svelte';
  import Xing from './Xing.svelte';
  import { POSTURES } from './xing';
  import { etatPave, joursDesCaracteres, lusDeLaFamille, placerSentierFamille } from './chemin';
  import { remplir, SANS_ECRANS, type TextesChemin } from './ecrans';
  import { noeud } from './foret';
  import Hz from './Hz.svelte';
  import { glyph, nomAccessible } from './glyph';
  import { etapesDuChemin } from './route';
  import { stade } from './tao';
  import { type StrokeSet } from './strokes';

  let {
    fam,
    choix = '',
    retour = '',
    parcours = null,
    croissance = 0,
    tc = SANS_ECRANS.chemin,
    xing = false,
    onretour,
    onlecon
  }: {
    fam: Noeud;
    /** Le caractère dont la fiche s'ouvre d'abord (depuis Chercher) ; vide, la racine. */
    choix?: string;
    /** Où ramène le retour : Mon chemin, ou Chercher ; vide, Mon chemin. */
    retour?: string;
    /** Le parcours choisi : le jour du chemin où chaque caractère a été posé. */
    parcours?: string | null;
    /** La croissance de Tao, qui se tient au bord du sentier. */
    croissance?: number;
    /** L'image du chemin (`ecrans.json`, `chemin`). */
    tc?: TextesChemin;
    /** Le maître Xing 杏 est rencontré (`xing.ts`) : c'est lui qui explique l'origine, dans la fiche. */
    xing?: boolean;
    onretour: () => void;
    onlecon: () => void;
  } = $props();

  let traits = $state<StrokeSet>({});
  let lue = $state<FicheLue | null>(null);
  /** Le caractère dont la fiche est ouverte ; vide, c'est la racine de la famille. */
  let selection = $state(untrack(() => choix));
  /** « +N » touché : tout le sentier se montre. */
  let tout = $state(false);
  let jours = $state.raw<Map<string, number>>(new Map());

  $effect(() => {
    const racine = fam.c;
    let vivant = true;
    void traitsDeFamille(racine)
      .then((t) => {
        if (vivant) traits = t;
      })
      .catch(() => {
        if (vivant) traits = {};
      });
    return () => {
      vivant = false;
    };
  });

  $effect(() => {
    const choisi = parcours;
    let vivant = true;
    void contenu()
      .then((i) => {
        const nom = nomParcours(i, choisi);
        if (vivant) jours = joursDesCaracteres(etapesDuChemin(i.parcours[nom]?.jours ?? []));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const sentier = $derived(placerSentierFamille(fam, tout));
  const compte = $derived(lusDeLaFamille(fam));
  const sceau = $derived(compte.total >= 2 && compte.lus === compte.total);
  const choisi = $derived(selection === '' ? fam.c : selection);
  const courant = $derived(noeud(fam, choisi) ?? fam);
  const jourRacine = $derived(jours.get(fam.c) ?? null);
  const jourCourant = $derived(jours.get(courant.c) ?? null);

  $effect(() => {
    const c = choisi;
    const racine = fam.c;
    let vivant = true;
    void fiche(c, [racine])
      .then((f) => {
        if (vivant) lue = f;
      })
      .catch(() => {
        if (vivant) lue = null;
      });
    return () => {
      vivant = false;
    };
  });

  /** La fiche du caractère choisi, telle que `content` la sert. */
  const pleine: FicheLue | null = $derived(lue !== null && lue.c === choisi ? lue : null);

  /** Le nom d'un caractère du sentier pour VoiceOver : « 住, zhù, habiter ». */
  function nomDuNoeud(c: string): string {
    const n = noeud(fam, c);
    return n ? nomAccessible(c, n.pinyin, n.fr) : c;
  }

  function dessin(c: string, taille: number, couleur = 'var(--ink)'): string {
    const d = traits[c];
    if (!d) {
      return `<text x="${taille / 2}" y="${taille * 0.84}" text-anchor="middle" class="hz" style="font-size:${taille * 0.86}px;fill:${couleur}">${c}</text>`;
    }
    return glyph(c, d, taille, { write: false, color: couleur });
  }

  function clavier(e: KeyboardEvent, f: () => void): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    f();
  }

  /** L'état de la fiche : lu, en cours, à venir, et le jour du chemin où il a été posé. */
  const statut = $derived.by(() => {
    const e = etatPave(courant.avancement);
    const mot = e === 'lu' ? tc['fiche-lu'] : e === 'encours' ? tc['fiche-encours'] : tc['fiche-avenir'];
    const pose = e !== 'avenir' && jourCourant !== null ? remplir(tc['fiche-pose'], { n: jourCourant }) : '';
    return [mot, pose].filter((x) => x !== '').join(' · ');
  });
  const taoStade = $derived(stade(croissance));
</script>

<main class="screen famille">
  <button class="k quit" onclick={onretour}>‹ {retour || tc.retour}</button>

  <div class="row tete">
    <div class="tete-g">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html glyph(fam.c, traits[fam.c], 54, { write: false })}
    </div>
    <div class="grow">
      <h1>{fam.fr}</h1>
      <div class="py-ligne"><span class="py">{fam.pinyin}</span>{#if jourRacine !== null}<span class="k"> · {remplir(tc['famille-auberge'], { n: jourRacine })}</span>{/if}</div>
    </div>
    <span class="k">{compte.lus} / {compte.total}</span>
  </div>

  <div class="scene">
    <svg viewBox="0 0 {sentier.largeur} {sentier.hauteur}" role="group" aria-label={remplir(tc['famille-voix'], { c: fam.c })}>
      <path class="mont1" d="M0 120 L50 70 L90 96 L150 30 L200 74 L250 44 L300 86 L361 50 V{sentier.hauteur} H0Z" />
      <path class="mont2" d="M0 {sentier.hauteur - 160} Q80 {sentier.hauteur - 196} 170 {sentier.hauteur - 176} T361 {sentier.hauteur - 188} V{sentier.hauteur} H0Z" />
      <path class="mont3" d="M0 {sentier.hauteur - 80} Q100 {sentier.hauteur - 110} 200 {sentier.hauteur - 94} T361 {sentier.hauteur - 104} V{sentier.hauteur} H0Z" />
      {#each [[40, sentier.hauteur - 170, 0.8], [322, sentier.hauteur - 210, 0.7], [302, sentier.hauteur - 184, 0.55], [28, sentier.hauteur - 128, 0.6]] as [x, y, k] (`${x}-${y}`)}
        <g transform="translate({x} {y}) scale({k})">
          <path class="pin" d="M0 -30 L11 -12 L5 -12 L14 2 L-14 2 L-5 -12 L-11 -12Z" />
          <rect class="tronc" x="-2" y="2" width="4" height="7" />
        </g>
      {/each}
      <path class="sentier" d={sentier.d} />
      {#each sentier.bifurcations as d, i (i)}<path class="sentier bifurque" {d} />{/each}
      <rect class="brume" x="220" y="24" width="110" height="12" rx="6" />
      <rect class="brume" x="250" y="46" width="100" height="12" rx="6" />

      <!-- l'auberge de la famille : le fanion porte sa racine, et son sceau quand elle est lue en entier -->
      <g
        class="auberge"
        role="button"
        tabindex="0"
        aria-label="Fiche de {nomDuNoeud(fam.c)}"
        onclick={() => (selection = fam.c)}
        onkeydown={(e) => clavier(e, () => (selection = fam.c))}
      >
        <g transform="translate({sentier.auberge.x} {sentier.auberge.y}) scale(1.35)">
          <rect class="mur" x="-16" y="-24" width="32" height="22" />
          <rect class="porte-auberge" x="-5" y="-16" width="10" height="14" rx="1" />
          <path class="toit" d="M-23 -23q7-2 11-10h24q4 8 11 10z" />
          <path class="mat" d="M21 -1V-54" />
          <!-- le fanion flotte au vent : sa brique et son sceau avec lui -->
          <g class="flotte">
          <path class="fanion" class:sel={choisi === fam.c} d="M21 -52h21v27l-5.25 4-5.25-4-5.25 4-5.25-4z" />
          <g transform="translate(24.5 -45)">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html dessin(fam.c, 14)}
          </g>
          {#if sceau}
            <g class="sceau-famille" transform="translate(41 -20)">
              <rect x="-8" y="-8" width="16" height="16" rx="2" />
              <rect class="filet" x="-6" y="-6" width="12" height="12" rx="1.5" />
              <g transform="translate(-5 -5)">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html dessin(fam.c, 10, 'var(--card)')}
              </g>
            </g>
          {/if}
          </g>
        </g>
      </g>

      {#each sentier.paves as q, i (q.generation + '-' + q.c)}
        <g
          class="pierre"
          class:sel={q.c === choisi}
          role="button"
          tabindex="0"
          aria-label="Fiche de {nomDuNoeud(q.c)}"
          onclick={() => (selection = q.c)}
          onkeydown={(e) => clavier(e, () => (selection = q.c))}
        >
          <!-- la zone de tap : 44 pt de large à la largeur d'un iPhone -->
          <ellipse class="hit" cx={q.x} cy={q.y} rx="26" ry="22" />
          {#if q.c === choisi}<ellipse class="anneau" cx={q.x} cy={q.y} rx={q.r * 1.3 + 5} ry={q.r * 0.8 + 4.5} />{/if}
          <ellipse class="pave {q.etat}" cx={q.x} cy={q.y} rx={q.r * 1.3} ry={q.r * 0.8} />
          <g transform="translate({q.x - q.r * 0.62} {q.y - q.r * 0.66})">
            <!-- un caractère lu s'imprime en jade sur son pavé, l'un après l'autre en montant le sentier -->
            <g class:imprime={q.etat === 'lu'} style={q.etat === 'lu' ? `animation-delay:${(0.15 + i * 0.06).toFixed(2)}s` : undefined}>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html dessin(q.c, q.r * 1.24, q.etat === 'lu' ? 'var(--jade)' : q.etat === 'avenir' ? 'var(--mist)' : 'var(--ink)')}
            </g>
          </g>
          {#if q.par}<text class="par" x={q.x} y={q.y + 28} text-anchor="middle">{remplir(tc['famille-par'], { c: q.par })}</text>{/if}
        </g>
      {/each}
      {#if sentier.plus}
        <g
          class="pierre"
          role="button"
          tabindex="0"
          aria-label={remplir(tc['famille-plus-voix'], { n: sentier.plus.n })}
          onclick={() => (tout = true)}
          onkeydown={(e) => clavier(e, () => (tout = true))}
        >
          <ellipse class="pave avenir" cx={sentier.plus.x} cy={sentier.plus.y} rx="17" ry="10.5" />
          <text class="compte" x={sentier.plus.x} y={sentier.plus.y + 4} text-anchor="middle">+{sentier.plus.n}</text>
        </g>
      {/if}

      <rect class="pilule" x="128" y={sentier.hauteur - 46} width="112" height="22" rx="11" />
      <text class="pilule-t" x="184" y={sentier.hauteur - 31} text-anchor="middle"
        >{sceau ? tc['famille-sceau-pose'] : remplir(tc['famille-sceau'], { lus: compte.lus, n: compte.total })}</text
      >
      <g class="tao" transform="translate(262 {sentier.hauteur - 56})"><Tao stade={taoStade} posture="chemin" humeur="calme" size={50} /></g>
    </svg>
  </div>

  <div class="card fiche">
    <div class="row">
      <div class="tete-g">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html glyph(courant.c, traits[courant.c], 56, { write: false })}
      </div>
      <div class="grow">
        <div class="sens">
          {pleine && pleine.fr !== '' ? pleine.fr : courant.fr}
          <span class="py">{pleine && pleine.pinyin !== '' ? pleine.pinyin : courant.pinyin}</span>
        </div>
        <div class="k">{statut}</div>
      </div>
    </div>
    {#if pleine && pleine.origine_fr !== ''}
      {#if xing}
        <!-- le maître explique d'où vient le caractère, l'étiquette sous sa parole -->
        <div class="explique">
          <Xing posture={POSTURES.etymologie} size={52} />
          <p class="origine">{pleine.origine_fr}</p>
        </div>
      {:else}
        <p class="origine">{pleine.origine_fr}</p>
      {/if}
      {#if pleine.etiquette}<span class="tag">{ETIQUETTES[pleine.etiquette]}</span>{/if}
      <ARelire de={pleine} />
    {:else}
      <p class="origine k">{LIGNE_SANS_FICHE}</p>
    {/if}
    {#if pleine && pleine.parts.length > 0}
      <div class="k">
        {#each pleine.parts as part, i (part + i)}{#if i > 0}{' + '}{/if}<Hz
            c={part}
            size={14}
            pistes={[part, fam.c]}
          />{/each} = <Hz c={pleine.c} size={14} pistes={[fam.c]} />
      </div>
    {/if}
  </div>

  <div class="foot">
    <button class="btn" onclick={onlecon}>Prochaine leçon</button>
  </div>
</main>

<style>
  /* dans la fiche, le maître à côté de l'origine qu'il explique */
  .explique {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .explique :global(.xing) {
    flex: none;
    margin-left: -6px;
  }
  .tete {
    margin: 4px 0 10px;
  }
  .tete h1 {
    margin: 0;
    font-size: 22px;
  }
  .py-ligne .py {
    color: var(--indigo);
    font-weight: 600;
  }
  .scene {
    background: var(--card);
    border-radius: 16px;
    overflow: hidden;
    line-height: 0;
  }
  .scene svg {
    display: block;
    width: 100%;
    height: auto;
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
  .brume {
    fill: var(--card);
    opacity: 0.92;
  }
  .sentier {
    fill: none;
    stroke: var(--chemin-parcouru);
    stroke-width: 26;
    stroke-linecap: round;
  }
  .sentier.bifurque {
    stroke: var(--chemin-chaussee);
    stroke-width: 16;
  }
  .auberge,
  .pierre {
    cursor: pointer;
    outline: none;
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
  .auberge .fanion.sel,
  .auberge:focus-visible .fanion {
    stroke: var(--indigo);
    stroke-width: 2.2;
  }
  .sceau-famille rect {
    fill: var(--ink);
  }
  .sceau-famille .filet {
    fill: none;
    stroke: var(--card);
    stroke-width: 0.8;
  }
  .hit {
    fill: transparent;
  }
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
  .anneau {
    fill: none;
    stroke: var(--indigo);
    stroke-width: 2;
  }
  .pierre:focus-visible .pave {
    stroke: var(--indigo);
    stroke-width: 2.6;
  }
  .compte {
    font: 600 12px var(--sans);
    fill: var(--ink2);
  }
  .par {
    font: 400 11.5px var(--sans);
    fill: var(--mist);
  }
  .pilule {
    fill: var(--card);
    stroke: var(--line);
  }
  .pilule-t {
    font: 400 11.5px var(--sans);
    fill: var(--mist);
  }
  .tao {
    pointer-events: none;
  }
  /* Les caractères lus s'impriment en jade sur leur pavé, comme un sceau qu'on presse : un peu
     plus grands, puis posés. L'un après l'autre, en montant ; rien n'attend la fin pour toucher. */
  .imprime {
    transform-box: fill-box;
    transform-origin: center;
    animation: imprimer 0.42s cubic-bezier(0.2, 0.8, 0.3, 1) both;
  }
  @keyframes imprimer {
    0% {
      opacity: 0;
      transform: scale(1.4);
    }
    60% {
      opacity: 1;
      transform: scale(0.94);
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .imprime {
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
