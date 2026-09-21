<script lang="ts">
  /**
   * L'arbre d'une famille (story 4.2) : la racine et ses générations, la fiche courte
   * au tap, et la prochaine leçon qui ramène à Aujourd'hui.
   *
   * La famille et ses tracés viennent de l'export versionné : un fichier de fiches et un
   * fichier de traits, ceux de cette famille et d'elle seule. La fiche courte affiche
   * l'origine et son étiquette quand une fiche relue (ou la surcouche de démonstration)
   * en porte une ; sinon elle le dit, et n'étiquette rien.
   */
  import {
    ETIQUETTES,
    LIGNE_SANS_FICHE,
    fiche,
    traits as traitsDeFamille,
    type FicheLue,
    type Noeud
  } from './content';
  import { acquis, etat, noeud, placerArbre } from './foret';
  import { glyph } from './glyph';
  import { type StrokeSet } from './strokes';

  let {
    fam,
    onretour,
    onlecon
  }: { fam: Noeud; onretour: () => void; onlecon: () => void } = $props();

  let traits = $state<StrokeSet>({});
  let lue = $state<FicheLue | null>(null);
  /** Le caractère dont la fiche est ouverte ; vide, c'est la racine de la famille. */
  let selection = $state('');

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

  const arbre = $derived(placerArbre(fam));
  const choisi = $derived(selection === '' ? fam.c : selection);
  const courant = $derived(noeud(fam, choisi) ?? fam);

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

  function dessin(c: string, r: number): string {
    const d = traits[c];
    if (!d) {
      return `<text x="${r * 0.78}" y="${r * 1.2}" text-anchor="middle" class="hz" style="font-size:${r * 1.25}px;fill:var(--ink)">${c}</text>`;
    }
    return glyph(c, d, r * 1.56, { write: false });
  }
</script>

<main class="screen">
  <button class="k quit" onclick={onretour}>‹ Ma forêt</button>

  <div class="row tete">
    <div class="tete-g">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html glyph(fam.c, traits[fam.c], 64, { write: false })}
    </div>
    <div class="grow">
      <h1>{fam.fr}</h1>
      <div class="py">{fam.pinyin}</div>
    </div>
    <span class="k">{acquis(fam)} / {fam.membres.length}</span>
  </div>

  <div class="forest">
    <svg
      viewBox="0 0 {arbre.largeur} {arbre.hauteur}"
      role="img"
      aria-label="L'arbre de la famille {fam.c}"
    >
      {#each arbre.liens as l, i (i)}
        <path class="lk" class:acquis={l.acquis} d={l.d} />
      {/each}
      {#each arbre.noeuds as nd (nd.generation + '-' + nd.c)}
        <g
          class="tn"
          class:sel={nd.c === choisi}
          role="button"
          tabindex="0"
          aria-label="Fiche de {nd.c}"
          transform="translate({nd.x} {nd.y})"
          onclick={() => (selection = nd.c)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selection = nd.c;
            }
          }}
        >
          <circle class="nd {nd.etat}" class:verrouille={nd.verrouille} r={nd.r} />
          <g transform="translate({-nd.r * 0.78} {-nd.r * 0.78})">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html dessin(nd.c, nd.r)}
          </g>
        </g>
      {/each}
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
        <div class="k">
          {etat(courant.avancement) === 'acquis'
            ? 'Acquis'
            : etat(courant.avancement) === 'encours'
              ? 'En cours'
              : 'À venir'}
        </div>
      </div>
    </div>
    {#if pleine && pleine.origine_fr !== ''}
      <p class="origine">{pleine.origine_fr}</p>
      {#if pleine.etiquette}<span class="tag">{ETIQUETTES[pleine.etiquette]}</span>{/if}
    {:else}
      <p class="origine k">{LIGNE_SANS_FICHE}</p>
    {/if}
    {#if pleine && pleine.parts.length > 0}
      <div class="k">{pleine.parts.join(' + ')} = {pleine.c}</div>
    {/if}
  </div>

  <div class="foot">
    <button class="btn" onclick={onlecon}>Prochaine leçon</button>
  </div>
</main>
