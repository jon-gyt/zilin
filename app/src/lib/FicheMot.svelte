<script lang="ts">
  /**
   * La fiche d'un mot dans le dictionnaire (story 10.8, maquette `maquettes/dictionnaire.html`,
   * écran 4) : ses caractères, écrits au pinceau à l'ouverture, chacun dans son 米字格 avec son
   * propre statut, et qui ouvre sa fiche au toucher ; le pinyin, dit par la voix de l'appareil ;
   * le niveau et la catégorie ; le sens, seulement relu ; les exemples relus ; les mots proches.
   * Rien ne s'ajoute aux révisions d'ici. Les textes viennent de `ecrans.json`.
   */
  import DicoGlyph from './DicoGlyph.svelte';
  import LigneDico from './LigneDico.svelte';
  import { dire } from './audio';
  import {
    libelleNiveau,
    libelleStatut,
    ligneDe,
    motsProches,
    pinyinDe,
    sensDeFiche,
    statutCaractere,
    statutMot,
    syllabeAccentuee,
    type EnvDico,
    type VueDico
  } from './dico-ecran';
  import type { ChargeurDico, EntreeMot, IndexDico } from './dictionnaire';
  import { remplir } from './ecrans';

  let {
    id,
    env,
    index,
    dico,
    onouvrir
  }: {
    /** L'identifiant du mot dans la liste HSK 3.0 (`L1-0140`). */
    id: string;
    env: EnvDico;
    index: IndexDico;
    dico: ChargeurDico;
    onouvrir: (v: VueDico) => void;
  } = $props();

  const t = $derived(env.t);

  let entree = $state<EntreeMot | null | undefined>(undefined);

  $effect(() => {
    const x = id;
    let vivant = true;
    entree = undefined;
    void dico
      .mot(x)
      .catch(() => null)
      .then((e) => {
        if (vivant) entree = e;
      });
    return () => {
      vivant = false;
    };
  });

  const ligne = $derived(index.entrees.find((e) => e.genre === 'mot' && e.id === id) ?? null);
  const hanzi = $derived(entree?.hanzi || ligne?.formes[0] || '');
  const lecture = $derived(ligne?.lectures[0] ?? []);
  const cs = $derived(Array.from(hanzi));
  const pinyin = $derived(entree?.pinyin || pinyinDe(lecture));
  const niveau = $derived(entree?.niveau ?? ligne?.niveau ?? 0);
  const sens = $derived(sensDeFiche(entree?.sens ?? null, env.relues.get(hanzi) ?? ''));
  const statut = $derived(statutMot(hanzi, env.ctx));
  const categories = $derived(
    (entree?.categories ?? []).map((k) => (t as Record<string, string>)[`cat-${k}`] ?? '').filter((x) => x !== '')
  );
  const proches = $derived(ligne ? motsProches(ligne, index) : []);
  /** Un caractère d'un grand mot se dessine un peu plus petit : trois tiennent sur la largeur. */
  const taille = $derived(cs.length > 2 ? 96 : 132);

  function statutLong(): string {
    if (statut.k === 'lu') return remplir(t['mot-lu'], { w: hanzi });
    if (statut.k === 'chemin') return statut.n === 1 ? t['statut-chemin-un'] : remplir(t['statut-chemin'], { n: statut.n });
    if (statut.k === 'encours') return t['statut-encours'];
    return t['statut-hors'];
  }
</script>

<div class="fiche-dico">
  <h3 class="sec premier">{t['mot-caracteres']} <small>{t['mot-toucher']}</small></h3>
  <div class="mot-cars">
    {#each cs as c, k (k)}
      {@const sc = statutCaractere(c, env.ctx)}
      {@const p = lecture[k] ? syllabeAccentuee(lecture[k]) : ''}
      <button class="mot-car" aria-label={remplir(t['mot-ouvrir'], { c, pinyin: p })} onclick={() => onouvrir({ t: 'car', c })}>
        <span class="mizi" class:pasencore={sc.k !== 'lu'} style="width:{taille}px;height:{taille}px">
          <svg class="grille" viewBox="0 0 100 100" aria-hidden="true"
            ><path d="M0 0L100 100M100 0L0 100M50 0V100M0 50H100" /></svg
          >
          <span class="dessin"><DicoGlyph {c} size={Math.round(taille * 0.88)} write label="" /></span>
        </span>
        {#if p !== ''}<span class="p">{p}</span>{/if}
        <span class="s {sc.k}">{libelleStatut(sc, t)}</span>
      </button>
    {/each}
  </div>

  <div class="py-row">
    {#if pinyin !== ''}<span class="py">{pinyin}</span>{/if}
    <button class="ecouter" aria-label={remplir(t.ecouter, { t: hanzi })} onclick={() => void dire(hanzi)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></svg
      >
    </button>
  </div>
  {#if sens}
    {#if sens.acceptions.length > 0}
      <ul class="acceptions">
        {#each sens.acceptions as a, k (k)}<li
            ><span class="cat">{(t as Record<string, string>)[`cat-${a.categorie}`] ?? ''}</span> {a.fr}</li
          >{/each}
      </ul>
    {:else}
      <p class="sens-f">{sens.glose}</p>
    {/if}
  {:else if entree !== undefined}
    <p class="relecture">{t['sens-relecture']}</p>
  {/if}
  <div class="meta">
    <span class="pill">{libelleNiveau(niveau, t)}</span>
    {#each categories as x (x)}<span class="pill">{x}</span>{/each}
    {#if cs.length > 1}<span class="pill">{remplir(t['mot-long'], { n: cs.length })}</span>{/if}
  </div>
  <p class="statut {statut.k}"><i></i><span>{statutLong()}</span></p>

  {#if entree && entree.exemples.length > 0}
    <h3 class="sec">{t.exemples}</h3>
    {#each entree.exemples as x (x.zh)}
      <div class="ex">
        <span class="zh" lang="zh-Hans">{x.zh}</span>
        {#if x.pinyin !== ''}<span class="pyx">{x.pinyin}</span>{/if}
        {#if x.fr !== ''}<span class="fr">{x.fr}</span>{/if}
      </div>
    {/each}
  {/if}

  {#if proches.length > 0}
    <h3 class="sec">{t.proches}</h3>
    <div class="liste">
      {#each proches as m (m.id)}
        {@const l = ligneDe(m, env)}
        <LigneDico {...l} onclick={() => onouvrir({ t: 'mot', id: m.id })} />
      {/each}
    </div>
  {/if}

  <p class="fin">{t['fin-mot']}</p>
</div>

<style>
  .sec {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 22px 0 8px;
    font: 700 17px/1.2 var(--head);
  }
  .sec.premier {
    margin-top: 4px;
  }
  .sec small {
    font: 400 13px/1.2 var(--sans);
    color: var(--mist);
  }
  .mot-cars {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .mot-car {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-width: 44px;
  }
  .mizi {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--grille);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  .mizi.pasencore {
    border-style: dashed;
    border-color: var(--ink2);
  }
  .grille {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .grille path {
    stroke: var(--grille);
    stroke-width: 0.55;
    stroke-dasharray: 2.4 2.4;
    fill: none;
  }
  .dessin {
    position: relative;
    line-height: 0;
  }
  .p {
    font: 700 17px/1.1 var(--head);
    color: var(--indigo);
  }
  .s {
    font-size: 12.5px;
    color: var(--mist);
  }
  .s.lu {
    color: var(--jade);
    font-weight: 600;
  }
  .s.chemin,
  .s.encours {
    color: var(--indigo);
  }
  .py-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }
  .py {
    font: 700 34px/1.05 var(--head);
    color: var(--indigo);
    letter-spacing: -0.01em;
  }
  .ecouter {
    width: 44px;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: var(--ink2);
    background: var(--card);
  }
  .ecouter svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sens-f {
    margin: 6px 0 0;
    font-size: 19px;
    line-height: 1.3;
    color: var(--ink);
  }
  .acceptions {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    font-size: 17px;
    line-height: 1.35;
  }
  .acceptions .cat {
    font-size: 13px;
    color: var(--mist);
  }
  .relecture {
    margin: 6px 0 0;
    font-size: 15px;
    color: var(--mist);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 13px;
    color: var(--ink2);
  }
  .statut {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 10px 0 0;
    font-size: 15px;
    line-height: 1.35;
  }
  .statut i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    margin-top: 5px;
    border: 2px solid currentColor;
  }
  .statut.lu {
    color: var(--jade);
  }
  .statut.lu i {
    background: currentColor;
  }
  .statut.chemin,
  .statut.encours {
    color: var(--indigo);
  }
  .statut.hors {
    color: var(--ink2);
  }
  .statut.hors i {
    border-style: dashed;
  }
  .ex {
    display: grid;
    gap: 2px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .zh {
    font: 500 20px/1.45 var(--hz);
    color: var(--ink);
    letter-spacing: 0.03em;
  }
  .pyx {
    font-size: 13.5px;
    color: var(--mist);
  }
  .ex .fr {
    font-size: 15px;
    color: var(--ink2);
  }
  .liste {
    display: grid;
  }
  .liste > :global(.ligne-dico:first-child) {
    border-top: 0;
  }
  .fin {
    margin: 22px 2px 0;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 13.5px;
    color: var(--mist);
  }
</style>
