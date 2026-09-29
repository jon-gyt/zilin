<script lang="ts">
  /**
   * Un grand caractère, dessiné trait par trait depuis les données de tracé (style 楷),
   * jamais depuis une police quand les données existent.
   *
   * Les tracés viennent de l'export versionné, `traits/<racine>.json` (472 caractères) ;
   * `strokes-demo.json` reste le repli pour ce que l'export ne porte pas encore.
   * `pistes` aide `content.racineDe` à trouver la famille sans tout relire : les écrans
   * de session y passent les briques déjà posées du parcours.
   *
   * Le nom accessible, ce que VoiceOver dit : le caractère, son pinyin et son premier sens,
   * « 住, zhù, habiter » (`glyph.nomAccessible`), lus dans la fiche de l'export avec les
   * tracés, pour que le dessin ne se refasse pas quand le nom arrive. Une question ne souffle
   * pas sa réponse : `seul` ne donne que le caractère (le sens d'un caractère, le ton, les
   * choix d'une question, un jeu). `label` impose un nom ; vide, le dessin est un décor,
   * caché aux lecteurs d'écran.
   */
  import { fiche, traitsDe, type FicheLue } from './content';
  import { glyph, nomAccessible, type StrokeData } from './glyph';

  let {
    char,
    size = 120,
    write = true,
    color,
    pistes = [],
    indigo = [],
    seul = false,
    label
  }: {
    char: string;
    size?: number;
    write?: boolean;
    color?: string;
    pistes?: readonly string[];
    /** Les traits peints en indigo, à la correction d'un jeu (`ecarts.ts`). */
    indigo?: readonly number[];
    /** Le caractère seul pour nom, sans pinyin ni sens : dans une question ou un jeu. */
    seul?: boolean;
    /** Un nom imposé ; vide, un décor caché aux lecteurs d'écran. */
    label?: string;
  } = $props();

  /* undefined : pas encore chargé ; null : pas de données, repli sur la police. */
  let data: StrokeData | null | undefined = $state(undefined);
  /** Le nom tiré de la fiche ; le caractère seul tant qu'on ne sait rien de plus. */
  let nomFiche = $state('');

  /** Le sens qu'on peut dire : celui d'une fiche relue ou de la démonstration, jamais un aperçu. */
  function sensDit(f: FicheLue | null): string {
    return f && (f.source === 'export' || f.source === 'demonstration') ? f.fr : '';
  }

  $effect(() => {
    const c = char;
    const p = pistes;
    const complet = !seul && label === undefined;
    let vivant = true;
    void Promise.all([
      traitsDe(c, p).catch(() => null),
      complet ? fiche(c, p).catch(() => null) : Promise.resolve(null)
    ]).then(([d, f]) => {
      if (!vivant) return;
      nomFiche = f ? nomAccessible(c, f.pinyin, sensDit(f)) : c;
      data = d;
    });
    return () => {
      vivant = false;
    };
  });

  const nom = $derived(label ?? (seul || nomFiche === '' ? char : nomFiche));
</script>

{#if data === undefined}
  {#if nom === ''}
    <span class="g" style="width:{size}px;height:{size}px" aria-hidden="true"></span>
  {:else}
    <span class="g" style="width:{size}px;height:{size}px" role="img" aria-label={nom}></span>
  {/if}
{:else}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html glyph(char, data ?? undefined, size, { write, color, indigo, label: nom })}
{/if}
