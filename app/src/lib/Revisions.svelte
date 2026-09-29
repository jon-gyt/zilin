<script lang="ts">
  /**
   * Le tableau des révisions, dans Ma forêt : la transparence du SRS (rapport comparatif du
   * 28 septembre 2026, §2.6). Trois parties, sous un filet chacune :
   *
   * - les sept prochains jours, en petites barres dessinées à plat : les cartes qui
   *   reviennent chaque jour, aujourd'hui compris ;
   * - ce qu'on retient : la rétention mesurée sur trente jours, face à la cible FSRS réglée
   *   dans Réglages ;
   * - « Ceux qui te résistent » : les caractères les plus souvent manqués, dessinés depuis
   *   leurs traits, avec leur pinyin et leur sens ; les toucher les dit.
   *
   * Tout se calcule dans `stats.ts`, sur les cartes et leur historique ; les textes viennent
   * du pipeline (`ecrans.json`). Rien au temps passé, aucune comparaison : la seule
   * référence est la cible qu'on a soi-même réglée. L'indigo pour ce qui revient, le jade
   * pour ce qu'on sait ; ni ombre, ni dégradé. Tao mange ses cartes, posture de révision.
   */
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import { dire } from './audio';
  import { fiches, type FicheLue } from './content';
  import { ecransOnce, remplir, SANS_ECRANS, type TextesRevisions } from './ecrans';
  import { nomAccessible, premierSens } from './glyph';
  import type { Progress } from './session';
  import {
    aVenir,
    FENETRE_JOURS,
    ligneAVenir,
    ligneBarre,
    ligneManques,
    ligneRetention,
    nomDuJour,
    resistent,
    retention,
    surCent,
    totalAVenir
  } from './stats';
  import { humeur, stade } from './tao';

  let { p, onretour }: { p: Progress; onretour: () => void } = $props();

  let t = $state<TextesRevisions>(SANS_ECRANS.revisions);
  $effect(() => {
    let vivant = true;
    ecransOnce()
      .then((e) => {
        if (vivant) t = e.revisions;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /* L'écran s'ouvre en haut, pas à la hauteur où Ma forêt était défilée. */
  $effect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  });

  /** L'instant de l'ouverture : le tableau dit l'état du moment, il ne suit pas l'horloge. */
  const maintenant = new Date();

  const jours = $derived(aVenir(p.cartes, maintenant, p.enAttente));
  const total = $derived(totalAVenir(jours));
  const plus = $derived(Math.max(1, ...jours.map((j) => j.n)));
  const r = $derived(retention(p.cartes, maintenant));
  const cible = $derived(p.retention);
  const durs = $derived(resistent(p.cartes, maintenant));

  /** Le pinyin et le sens des caractères qui résistent, lus dans l'export. */
  let lues = $state.raw<Map<string, FicheLue>>(new Map());
  $effect(() => {
    const cs = durs.map((x) => x.c);
    let vivant = true;
    void fiches(cs)
      .then((l) => {
        if (vivant) lues = new Map(l.map((f) => [f.c, f]));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  let touche = $state<string | null>(null);
  function toucher(c: string): void {
    touche = c;
    void dire(c);
  }

  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
</script>

<main class="screen revisions">
  <button class="k quit" onclick={onretour}>‹ {t.retour}</button>
  <header class="tete">
    <div class="grow">
      <h1>{t.titre}</h1>
    </div>
    <Tao stade={taoStade} posture="revision" humeur={taoHumeur} size={72} />
  </header>

  <section class="partie">
    <h2>{t['venir-titre']}</h2>
    <p class="ligne">{ligneAVenir(t, total)}</p>
    <ol class="barres">
      {#each jours as j (j.decalage)}
        <li class:auj={j.decalage === 0}>
          <span class="sr">{ligneBarre(t, j)}</span>
          <span class="n" aria-hidden="true">{j.n}</span>
          <span class="piste" aria-hidden="true">
            <i style="height:{j.n === 0 ? 0 : Math.max(6, Math.round((j.n / plus) * 100))}%"></i>
          </span>
          <span class="jour" aria-hidden="true">{nomDuJour(t, j)}</span>
        </li>
      {/each}
    </ol>
  </section>

  <section class="partie">
    <h2>{t['retention-titre']}</h2>
    <p class="ligne">{ligneRetention(t, r, cible)}</p>
    {#if r.mesure !== null}
      <div class="jauge" aria-hidden="true">
        <i class="mesure" style="width:{surCent(r.mesure)}%"></i>
        <b class="cible" style="left:{surCent(cible)}%"></b>
      </div>
      <div class="reperes" aria-hidden="true">
        <span class="m">{remplir(t['retention-mesure'], { mesure: surCent(r.mesure) })}</span>
        <span>{remplir(t['retention-cible'], { cible: surCent(cible) })}</span>
      </div>
    {/if}
    <p class="k">{t['retention-reglage']}</p>
  </section>

  <section class="partie">
    <h2>{t['resistent-titre']}</h2>
    {#if durs.length === 0}
      <p class="ligne">{remplir(t['resistent-rien'], { jours: FENETRE_JOURS })}</p>
    {:else}
      <p class="ligne">{remplir(t['resistent-aide'], { jours: FENETRE_JOURS })}</p>
      <ul class="durs">
        {#each durs as x (x.c)}
          {@const f = lues.get(x.c)}
          {@const sens = f && f.source !== 'aucune' && f.source !== 'apercu' ? premierSens(f.fr) : ''}
          <li>
            <button
              class="dur"
              class:sel={touche === x.c}
              aria-label="{nomAccessible(x.c, f?.pinyin ?? '', sens)} : {ligneManques(t, x.manques)}"
              onclick={() => toucher(x.c)}
            >
              <span class="gl"><Glyph char={x.c} size={48} write={touche === x.c} color="var(--ink)" /></span>
              <span class="grow txt">
                <span class="l1">
                  {#if f && f.pinyin !== ''}<span class="pin">{f.pinyin}</span>{/if}
                  {#if sens !== ''}<span class="sens">{sens}</span>{/if}
                </span>
                <span class="k">{ligneManques(t, x.manques)}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  .revisions .quit {
    margin-bottom: 2px;
  }
  .tete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 8px;
  }
  .tete h1 {
    margin: 0;
  }
  .partie {
    padding-top: 14px;
    margin-top: 14px;
    border-top: 1px solid var(--ink);
  }
  h2 {
    margin: 0;
    font-family: var(--head);
    font-size: 18px;
    font-weight: 700;
  }
  .ligne {
    margin: 4px 0 12px;
    font-size: 15px;
    line-height: 1.4;
    color: var(--ink2);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* ---- les sept jours : des barres à plat, l'indigo de ce qui revient ---- */
  .barres {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .barres li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .n {
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: var(--ink2);
  }
  .piste {
    position: relative;
    width: 100%;
    max-width: 30px;
    height: 72px;
    border-bottom: 1px solid var(--line);
  }
  .piste i {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--indigo-soft);
    border: 1px solid var(--indigo);
    border-bottom: 0;
    border-radius: 3px 3px 0 0;
  }
  .auj .piste i {
    background: var(--indigo);
  }
  .jour {
    font-size: 12.5px;
    color: var(--mist);
  }
  .auj .jour,
  .auj .n {
    color: var(--indigo);
    font-weight: 600;
  }

  /* ---- ce qu'on retient : une jauge à plat, le jade de l'acquis, la cible au filet d'encre ---- */
  .jauge {
    position: relative;
    height: 12px;
    border-radius: 6px;
    background: var(--jade-soft);
  }
  .mesure {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 6px;
    background: var(--jade);
  }
  .cible {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    background: var(--ink);
  }
  .reperes {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 13px;
    color: var(--ink2);
  }
  .reperes .m {
    color: var(--jade);
    font-weight: 600;
  }

  /* ---- ceux qui résistent : dessinés depuis leurs traits ---- */
  .durs {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .dur {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 64px;
    padding: 8px 2px;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .durs li:first-child .dur {
    border-top: 0;
  }
  .dur:active,
  .dur.sel {
    background: var(--card);
  }
  .gl {
    width: 52px;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
    line-height: 0;
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .l1 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pin {
    color: var(--indigo);
    font-weight: 600;
    font-size: 17px;
  }
  .sens {
    color: var(--ink);
    font-size: 16px;
  }
</style>
