<script lang="ts">
  /**
   * La fiche d'un caractère dans le dictionnaire (story 10.8, maquette
   * `maquettes/dictionnaire.html`, écrans 3 et 6).
   *
   * Le grand caractère depuis ses traits, qui rejoue l'ordre des traits (`OrdreTraits`) ; le
   * pinyin, dit par la voix de l'appareil (`audio.dire`) ; les autres lectures, le niveau HSK,
   * le statut de Mon chemin ; le sens, seulement relu ; les briques GF 0014-2009 de la
   * décomposition réconciliée, qui s'ouvrent au toucher, leur rôle à l'ocre ou à l'indigo
   * quand la fiche relue le dit (aucun cinabre : rien n'est ajouté ici) ; l'origine de la fiche
   * relue, étiquetée attestée ou mnémotechnique, jamais l'une pour l'autre, sinon « origine à
   * venir » ; ses emplois comme mot d'un seul caractère (好 adjectif), rangés ici plutôt qu'en
   * ligne à part ; les mots qui le contiennent ; les exemples relus.
   *
   * Un caractère hors du chemin se lit en entier, rien n'est verrouillé : le 米字格 en
   * pointillés et « Pas encore appris » le disent, avec ce qui manque, dit par les briques.
   * Après la rencontre, Xing explique l'origine dans sa bulle ; avant, le même texte, sans lui.
   * Rien ne s'ajoute aux révisions d'ici. Les textes viennent de `ecrans.json`.
   */
  import DicoGlyph, { traitsDuDico } from './DicoGlyph.svelte';
  import Hz from './Hz.svelte';
  import LigneDico from './LigneDico.svelte';
  import OrdreTraits from './OrdreTraits.svelte';
  import Xing from './Xing.svelte';
  import { dire } from './audio';
  import { ETIQUETTES, famille, fiche, racineDe, type Brique, type FicheLue, type Role } from './content';
  import {
    libelleNiveau,
    libelleStatut,
    ligneDe,
    motsDUnCaractere,
    motsQuiContiennent,
    origineDeFiche,
    pinyinDe,
    rolesDesBriques,
    sensDeFiche,
    statutCaractere,
    type EnvDico,
    type VueDico
  } from './dico-ecran';
  import { acceptionsDEmploi, type ChargeurDico, type EntreeCaractere, type EntreeMot, type Exemple, type IndexDico } from './dictionnaire';
  import { remplir } from './ecrans';
  import { premierSens, type StrokeData } from './glyph';

  let {
    c,
    env,
    index,
    dico,
    pinyins,
    xing = false,
    maitre = '',
    maitreCar = '',
    onouvrir,
    onfamille = null
  }: {
    c: string;
    env: EnvDico;
    index: IndexDico;
    dico: ChargeurDico;
    /** Le pinyin des briques hors du dictionnaire (亻, 亠…), lu dans les familles. */
    pinyins: ReadonlyMap<string, string>;
    /** Xing est rencontré : il explique l'origine dans sa bulle. */
    xing?: boolean;
    /** Le nom du maître, « Xing », et son caractère, 杏 (`ecrans.json`). */
    maitre?: string;
    maitreCar?: string;
    onouvrir: (v: VueDico) => void;
    /** Ouvre l'arbre de sa famille sur Mon chemin ; `null` hors des familles. */
    onfamille?: ((c: string) => void) | null;
  } = $props();

  const t = $derived(env.t);

  /** Au plus autant de mots montrés d'abord ; les autres sur demande. */
  const MOTS_D_ABORD = 12;

  let entree = $state<EntreeCaractere | null | undefined>(undefined);
  let relue = $state<FicheLue | null>(null);
  let racine = $state<Brique | null>(null);
  let traits = $state<StrokeData | null | undefined>(undefined);
  let emplois = $state<EntreeMot[]>([]);
  let tous = $state(false);

  $effect(() => {
    const x = c;
    let vivant = true;
    entree = undefined;
    traits = undefined;
    relue = null;
    racine = null;
    emplois = [];
    tous = false;
    void traitsDuDico(x).then((d) => {
      if (vivant) traits = d;
    });
    void dico
      .caractere(x)
      .catch(() => null)
      .then((e) => {
        if (vivant) entree = e;
      });
    void fiche(x)
      .catch(() => null)
      .then((f) => {
        if (vivant) relue = f;
      });
    void racineDe(x)
      .catch(() => null)
      .then(async (r) => (r === x ? ((await famille(x).catch(() => null))?.racine ?? null) : null))
      .then((b) => {
        if (vivant) racine = b;
      });
    const uns = motsDUnCaractere(x, index);
    void Promise.all(uns.map((m) => dico.mot(m.id).catch(() => null))).then((l) => {
      if (vivant) emplois = l.filter((m): m is EntreeMot => m !== null);
    });
    return () => {
      vivant = false;
    };
  });

  const entreeIndex = $derived(index.entrees.find((e) => e.genre === 'caractere' && e.id === c) ?? null);
  const statut = $derived(statutCaractere(c, env.ctx));
  const pinyin = $derived(
    entree?.pinyin || (entreeIndex ? pinyinDe(entreeIndex.lectures[0] ?? []) : '') || relue?.pinyin || pinyins.get(c) || ''
  );
  const autres = $derived((entree?.lectures ?? []).filter((l) => l !== pinyin));
  const niveau = $derived(entree?.niveau ?? entreeIndex?.niveau ?? 0);
  const sens = $derived(sensDeFiche(entree?.sens ?? null, env.relues.get(c) ?? ''));

  /** La décomposition GF 0014-2009 : celle du dictionnaire, réconciliée ; hors de lui, celle de l'export des familles. */
  const decompose = $derived(
    entree !== undefined && entree !== null
      ? entree.decomposition === null
        ? null
        : entree.decomposition.parts
      : relue !== null && relue.source !== 'apercu'
        ? relue.parts
        : []
  );
  const parts = $derived(decompose ?? []);
  const roles = $derived(rolesDesBriques(relue, parts));
  const lues = $derived(parts.filter((p) => statutCaractere(p, env.ctx).k === 'lu').length);
  const origine = $derived(origineDeFiche(relue, racine));
  const mots = $derived(entree ? motsQuiContiennent(entree.mots, index) : []);
  const montres = $derived(tous ? mots : mots.slice(0, MOTS_D_ABORD));

  /** Les exemples relus du dictionnaire, puis la phrase de la fiche relue des familles. */
  const exemples = $derived.by((): Exemple[] => {
    const out: Exemple[] = [...(entree?.exemples ?? [])];
    const ph = relue && relue.source === 'export' && relue.statut === 'relu' ? relue.phrase : null;
    if (ph && ph.hanzi !== '' && !out.some((x) => x.zh === ph.hanzi)) out.push({ zh: ph.hanzi, pinyin: ph.pinyin, fr: ph.fr });
    return out;
  });

  function couleur(r: Role | undefined): string {
    return r === 'sens' ? 'var(--ocre)' : r === 'son' ? 'var(--indigo)' : 'var(--ink)';
  }

  function pinyinBrique(p: string): string {
    const e = index.entrees.find((x) => x.genre === 'caractere' && x.id === p);
    return e ? pinyinDe(e.lectures[0] ?? []) : (pinyins.get(p) ?? '');
  }

  function categories(m: EntreeMot): string {
    return m.categories
      .map((k) => (t as Record<string, string>)[`cat-${k}`] ?? '')
      .filter((x) => x !== '')
      .join(', ');
  }
</script>

<div class="fiche-dico">
  {#if traits}
    <OrdreTraits {c} d={traits} {t} pasEncore={statut.k !== 'lu'} />
  {:else}
    <div class="hero">
      <div class="mizi" class:pasencore={statut.k !== 'lu'}>
        {#if traits === null}<DicoGlyph {c} size={196} />{/if}
      </div>
    </div>
  {/if}

  <div class="py-row">
    {#if pinyin !== ''}<span class="py">{pinyin}</span>{/if}
    <button class="ecouter" aria-label={remplir(t.ecouter, { t: c })} onclick={() => void dire(c)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></svg
      >
    </button>
  </div>
  {#if autres.length > 0}
    <p class="autres">
      {#each autres as a, k (a)}{@const [avant, apres] = t.aussi.split('{pinyin}')}{k > 0 ? ' ; ' : ''}{avant}<b
          >{a}</b
        >{apres ?? ''}{/each}
    </p>
  {/if}
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
    {#if traits}<span class="pill">{remplir(t.traits, { n: traits.s.length })}</span>{/if}
  </div>

  <p class="statut {statut.k}">
    <i></i><span
      >{#if statut.k === 'lu'}{t['statut-lu']}{:else if statut.k === 'encours'}{t['statut-encours']}{:else if statut.k === 'chemin'}{statut.n === 1
          ? t['statut-chemin-un']
          : remplir(t['statut-chemin'], { n: statut.n })}{:else}{t['statut-hors']}{/if}
      {#if statut.k !== 'hors' && statut.jour !== null}<small>{remplir(t['statut-jour'], { n: statut.jour })}</small>{/if}</span
    >
  </p>

  {#if statut.k === 'hors'}
    <div class="hors-carte">
      <b>{t['pas-appris']}</b>
      <p>
        {niveau > 0
          ? remplir(t['pas-appris-hsk'], { c, n: niveau >= 7 ? '7-9' : niveau })
          : remplir(t['pas-appris-hors-hsk'], { c })}
        {parts.length > 0 ? remplir(t['pas-appris-briques'], { lus: lues, n: parts.length }) : ''}
      </p>
    </div>
  {/if}

  <h3 class="sec">{t.briques} <small>{t.norme}</small></h3>
  {#if entree === undefined && relue === null}
    <p class="note-sec">{t.chargement}</p>
  {:else if decompose === null}
    <p class="note-sec">{t['decomposition-relecture']}</p>
  {:else if parts.length === 0}
    <p class="note-sec">{t['brique-norme']}</p>
  {:else}
    <div class="briques">
      {#each parts as p, k (k)}
        {@const r = roles?.[p]}
        {@const sp = statutCaractere(p, env.ctx)}
        {#if k > 0}<span class="op" aria-hidden="true">+</span>{/if}
        <button class="brique" onclick={() => onouvrir({ t: 'car', c: p })}>
          <DicoGlyph c={p} size={46} color={couleur(r)} />
          <span class="nm">{[pinyinBrique(p), premierSens(env.relues.get(p) ?? '')].filter((x) => x !== '').join(' · ')}</span>
          {#if r}<span class="role {r}">{t[`role-${r}`]}</span>{/if}
          <span class="stb {sp.k}">{libelleStatut(sp, t, true)}</span>
        </button>
      {/each}
    </div>
    {#if roles === null}<p class="note-sec">{t['roles-a-venir']}</p>{/if}
  {/if}
  {#if onfamille}
    <button class="lien" onclick={() => onfamille?.(c)}>{t.famille} ›</button>
  {/if}

  <h3 class="sec">
    {t.origine}
    {#if origine && !xing}<span class="etiquette">{ETIQUETTES[origine.etiquette]}</span>{/if}
  </h3>
  {#if xing}
    <div class="maitre-dit">
      <span class="qui"><Xing posture="explique" size={64} /></span>
      <div class="bulle">
        <div class="qui-nom">
          {maitre}{#if maitreCar !== ''}<Hz c={maitreCar} size={13} />{/if}
          {#if origine}<span class="etiquette">{ETIQUETTES[origine.etiquette]}</span>{/if}
        </div>
        {#if origine}
          <p>{origine.texte}</p>
          <span class="src">{t['origine-source']}</span>
        {:else}
          <p>{remplir(t['origine-a-venir'], { c })}</p>
        {/if}
      </div>
    </div>
  {:else if origine}
    <div class="origine-seule">
      <p>{origine.texte}</p>
      <span class="src">{t['origine-source']}</span>
    </div>
  {:else}
    <div class="vide">{remplir(t['origine-a-venir'], { c })}</div>
  {/if}

  {#if emplois.length > 0}
    <h3 class="sec">{t['comme-mot']}</h3>
    <ul class="emplois">
      {#each emplois as m (m.id)}
        {@const s = sensDeFiche(m.sens, '')}
        {@const acc = acceptionsDEmploi(sens, m, pinyin)}
        <li>
          <span class="pin">{m.pinyin}</span>
          {#if categories(m) !== ''}<span>{categories(m)}</span>{/if}
          <span class="niv">{libelleNiveau(m.niveau, t)}</span>
          {#if s}<span class="fr">{s.glose}</span>{:else if acc.length > 0}<span class="fr">{acc.map((a) => a.fr).join(' ; ')}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if mots.length > 0}
    <h3 class="sec">{t['mots-titre']} <small>{mots.length}</small></h3>
    <div class="liste">
      {#each montres as m (m.id)}
        {@const l = ligneDe(m, env)}
        <LigneDico {...l} onclick={() => onouvrir({ t: 'mot', id: m.id })} />
      {/each}
    </div>
    {#if !tous && mots.length > MOTS_D_ABORD}
      <button class="lien" onclick={() => (tous = true)}>{remplir(t['mots-tous'], { n: mots.length })} ›</button>
    {/if}
  {/if}

  {#if exemples.length > 0}
    <h3 class="sec">{t.exemples}</h3>
    {#each exemples as x (x.zh)}
      <div class="ex">
        <span class="zh" lang="zh-Hans">{x.zh}</span>
        {#if x.pinyin !== ''}<span class="pyx">{x.pinyin}</span>{/if}
        {#if x.fr !== ''}<span class="fr">{x.fr}</span>{/if}
      </div>
    {/each}
  {/if}

  <p class="fin">{remplir(statut.k === 'lu' ? t['fin-lu'] : t.fin, { c })}</p>
</div>

<style>
  .hero {
    display: grid;
    justify-items: center;
  }
  .mizi {
    width: 224px;
    height: 224px;
    background: var(--card);
    border: 1.5px solid var(--grille);
    border-radius: 12px;
    display: grid;
    place-items: center;
  }
  .mizi.pasencore {
    border-style: dashed;
    border-color: var(--ink2);
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
  .autres {
    margin: 4px 0 0;
    font-size: 14.5px;
    color: var(--ink2);
  }
  .autres b {
    color: var(--indigo);
    font-weight: 600;
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
  .statut small {
    display: block;
    color: var(--mist);
    font-size: 13px;
  }
  .hors-carte {
    margin-top: 12px;
    border: 1.5px dashed var(--ink2);
    border-radius: 14px;
    padding: 12px 14px;
    display: grid;
    gap: 4px;
  }
  .hors-carte b {
    font: 700 16px/1.25 var(--head);
    color: var(--ink);
  }
  .hors-carte p {
    margin: 0;
    font-size: 14.5px;
    color: var(--ink2);
  }
  .sec {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 22px 0 8px;
    font: 700 17px/1.2 var(--head);
  }
  .sec small {
    font: 400 13px/1.2 var(--sans);
    color: var(--mist);
  }
  .briques {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 4px;
  }
  .op {
    align-self: center;
    color: var(--mist);
    font-size: 18px;
    width: 9px;
    text-align: center;
  }
  .brique {
    background: var(--card);
    border-radius: 12px;
    padding: 8px 5px 7px;
    min-width: 70px;
    min-height: 44px;
    display: grid;
    justify-items: center;
    gap: 1px;
    text-align: center;
  }
  .nm {
    font-size: 12px;
    color: var(--ink2);
    line-height: 1.25;
    max-width: 78px;
  }
  .role {
    font: 700 10.5px/1.2 var(--sans);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .role.sens {
    color: var(--ocre);
  }
  .role.son {
    color: var(--indigo);
  }
  .role.forme {
    color: var(--mist);
  }
  .stb {
    font-size: 12px;
    color: var(--mist);
  }
  .stb.lu {
    color: var(--jade);
    font-weight: 600;
  }
  .stb.chemin,
  .stb.encours {
    color: var(--indigo);
  }
  .note-sec {
    margin: 8px 2px 0;
    font-size: 13px;
    color: var(--mist);
  }
  .lien {
    color: var(--indigo);
    font: 600 15px/1.2 var(--sans);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    margin-top: 4px;
  }
  .etiquette {
    display: inline-block;
    padding: 1px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font: 400 12px/1.5 var(--sans);
    color: var(--mist);
  }
  .maitre-dit {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    margin-top: 4px;
  }
  .qui {
    width: 64px;
    height: 64px;
    margin-top: 4px;
    line-height: 0;
  }
  .bulle {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 16px;
    padding: 10px 12px 11px;
    font-size: 14.5px;
    line-height: 1.45;
    color: var(--ink2);
  }
  .bulle::before {
    content: '';
    position: absolute;
    left: -7.5px;
    top: 22px;
    width: 12px;
    height: 12px;
    background: var(--card);
    border-left: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    transform: rotate(45deg);
  }
  .bulle p,
  .origine-seule p {
    margin: 0;
  }
  .qui-nom {
    font: 700 13px/1.2 var(--head);
    color: var(--ink);
    margin-bottom: 4px;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .origine-seule {
    background: var(--card);
    border-radius: 14px;
    padding: 12px 14px;
    font-size: 14.5px;
    line-height: 1.45;
    color: var(--ink2);
  }
  .vide {
    border: 1px dashed var(--grille);
    border-radius: 14px;
    padding: 12px 14px;
    color: var(--ink2);
    font-size: 14.5px;
  }
  .src {
    display: block;
    margin-top: 6px;
    font-size: 12.5px;
    color: var(--mist);
  }
  .emplois {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
    font-size: 14.5px;
    color: var(--ink2);
  }
  .emplois li {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: baseline;
  }
  .emplois .pin {
    color: var(--indigo);
    font-weight: 600;
  }
  .emplois .niv {
    color: var(--mist);
    font-size: 13px;
  }
  .emplois .fr {
    color: var(--ink);
  }
  .liste {
    display: grid;
  }
  .liste > :global(.ligne-dico:first-child) {
    border-top: 0;
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
  .fin {
    margin: 22px 2px 0;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 13.5px;
    color: var(--mist);
  }
</style>
