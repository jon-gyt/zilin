<script lang="ts">
  /**
   * Chercher, depuis la loupe du menu. Deux onglets (maquette `maquettes/dictionnaire.html`,
   * story 10.8) : le dictionnaire 字典, et « Lire le monde », à sa porte.
   *
   * Le dictionnaire : le HSK 3.0 de 2021, 3 000 caractères et 11 092 mots, en consultation
   * libre, cherchés par caractère, par pinyin avec ou sans tons, ou en français sur les seules
   * gloses relues (`dictionnaire.ts`, qui classe). L'index vient de l'export, gardé hors ligne ;
   * les lots d'entrées et de traits se chargent par `ChargeurDico`, rien d'autre ne sort. La
   * loupe vide montre les recherches récentes, gardées dans la progression et effaçables, et
   * le caractère du terme solaire qui court. Les résultats : les caractères, puis les mots,
   * chacun dessiné depuis ses traits, avec son pinyin, sa glose relue, son niveau HSK et son
   * statut de Mon chemin ; un mot d'un seul caractère se range sous la fiche du caractère.
   * Une ligne touchée ouvre sa fiche (`FicheCaractere`, `FicheMot`) ; la pile des fiches est
   * gardée par l'aiguillage (`pile`), pour revenir de l'arbre d'une famille. Rien ne s'ajoute
   * aux révisions d'ici. Le pinceau du champ ouvre l'écriture au doigt (`EcrireAuDoigt`) quand
   * le pavé est livré (`Pave`).
   *
   * Tao lit par-dessus l'épaule ; une fois le maître Xing 杏 rencontré (`xing.ts`), c'est lui
   * qui tient Chercher, le livre ouvert, et explique l'origine dans les fiches. Pas de cinabre
   * ici : rien n'y est ajouté. Le jade pour l'acquis, l'indigo pour l'action et le chemin.
   *
   * Le second onglet, « Lire le monde » (rapport comparatif du 28 septembre 2026, §2.5) : on
   * colle ou tape un texte chinois, et l'écran dit combien de ses sinogrammes on lit. Chaque
   * caractère lu passe au jade et se touche pour ouvrir sa fiche ; les autres restent à
   * l'encre, avec, s'ils sont sur le chemin, dans combien de jours du chemin ils viennent.
   * Les mots de deux caractères lus que l'export connaît sont soulignés et listés. La photo
   * passe par le Texte en direct d'iOS, sans code ni réseau. La logique vit dans
   * `lecteur-libre.ts`, les textes dans `ecrans.json`.
   */
  import type { Component } from 'svelte';
  import DicoGlyph from './DicoGlyph.svelte';
  import EcrireAuDoigt from './EcrireAuDoigt.svelte';
  import FicheCaractere from './FicheCaractere.svelte';
  import FicheMot from './FicheMot.svelte';
  import LigneDico from './LigneDico.svelte';
  import Tao from './Tao.svelte';
  import Xing from './Xing.svelte';
  import { POSTURES, POSTURES_TAO } from './xing';
  import { dire } from './audio';
  import { contenu, dictionnaire, nomParcours, toutesLesFamilles, type Famille, type Noeud } from './content';
  import {
    compagnonDuDico,
    filtrerParTon,
    glosesRelues,
    lectureDeLigne,
    libelleStatut,
    ligneDe,
    ligneResultats,
    nombre,
    pastillesDeTon,
    pinyinDe,
    ranger,
    statutCaractere,
    type ContexteStatut,
    type EnvDico,
    type VueDico
  } from './dico-ecran';
  import type { ChargeurDico, IndexDico } from './dictionnaire';
  import { chercherDico } from './dictionnaire';
  import { eclairOnce } from './eclair';
  import { ecransOnce, remplir, SANS_ECRANS, type TextesDictionnaire, type TextesLireLeMonde } from './ecrans';
  import { joursDuChemin } from './etageres';
  import { noeudDeFamille, racinesDesCaracteres } from './foret';
  import { nomAccessible } from './glyph';
  import {
    caracteresLus,
    lexique,
    ligneCompte,
    ligneDans,
    lire,
    unites,
    type MotConnu,
    type Signe
  } from './lecteur-libre';
  import { noterRecente, type Recente } from './recentes';
  import { corpus } from './recherche';
  import type { TermeDuJour } from './saisons';
  import { jourParcours, type Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    q = $bindable(''),
    mode = $bindable('caractere'),
    texte = $bindable(''),
    pile = $bindable([]),
    monde = true,
    xing = false,
    complet = false,
    terme = null,
    Pave = null,
    onfamille,
    onrecentes,
    onretour
  }: {
    p: Progress;
    /** La saisie, gardée par l'aiguillage pour le retour depuis l'arbre. */
    q?: string;
    /** L'onglet ouvert : le dictionnaire, ou lire un texte. Gardé pour le retour. */
    mode?: 'caractere' | 'texte';
    /** Le texte à lire, gardé pour le retour depuis l'arbre. */
    texte?: string;
    /** Les fiches ouvertes par-dessus la loupe, la dernière en haut. Gardées pour le retour. */
    pile?: VueDico[];
    /**
     * L'aventure (`ouvertures.ts`) : l'onglet « Lire le monde » s'ouvre avec sa porte ; avant,
     * Chercher n'a que le dictionnaire, toujours là.
     */
    monde?: boolean;
    /** Le maître Xing est rencontré : il remplace Tao, le livre ouvert. */
    xing?: boolean;
    /** Wenlu complet ce jour-là : l'écriture au doigt (`droits.wenluComplet`). */
    complet?: boolean;
    /** Le terme solaire qui court : son caractère est celui du jour. */
    terme?: TermeDuJour | null;
    /**
     * Le pavé de l'écriture au doigt (`PaveEcriture.svelte`, story 10.10), livré à part. Nul,
     * le pinceau ne se montre pas.
     */
    Pave?: Component<{ onchoisir: (c: string) => void }> | null;
    /** Ouvre l'arbre d'une famille, le caractère touché choisi. */
    onfamille: (fam: Noeud, c: string) => void;
    /** Les recherches récentes ont changé : la progression les garde. */
    onrecentes: (l: Recente[]) => void;
    onretour: () => void;
  } = $props();

  let familles = $state<Famille[] | null>(null);

  $effect(() => {
    let vivant = true;
    void toutesLesFamilles()
      .then((l) => {
        if (vivant) familles = l;
      })
      .catch(() => {
        if (vivant) familles = [];
      });
    return () => {
      vivant = false;
    };
  });

  const entrees = $derived(familles ? corpus(familles) : []);

  /* ---------- les textes, le chemin ---------- */

  let tl = $state<TextesLireLeMonde>(SANS_ECRANS.lire);
  let td = $state<TextesDictionnaire>(SANS_ECRANS.dico);
  let maitreCar = $state('');
  let chemin = $state.raw<Map<string, number>>(new Map());
  let motsEclair = $state.raw<MotConnu[]>([]);

  $effect(() => {
    const choisi = p.parcours;
    let vivant = true;
    void ecransOnce()
      .then((e) => {
        if (!vivant) return;
        tl = e.lire;
        td = e.dico;
        maitreCar = e.xing.caractere;
      })
      .catch(() => undefined);
    void contenu()
      .then((i) => {
        if (vivant) chemin = joursDuChemin(i.parcours[nomParcours(i, choisi)]?.jours ?? []);
      })
      .catch(() => undefined);
    void eclairOnce()
      .then((e) => {
        if (vivant) motsEclair = e.mots.map((m) => ({ hanzi: m.mot, pinyin: m.pinyin, fr: m.fr }));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /* ---------- le dictionnaire ---------- */

  let dico = $state.raw<ChargeurDico | null>(null);
  let index = $state.raw<IndexDico | null>(null);
  let absent = $state(false);

  $effect(() => {
    let vivant = true;
    void dictionnaire()
      .then(async (d) => {
        if (d === null) {
          if (vivant) absent = true;
          return;
        }
        const i = await d.chargerIndex();
        if (!vivant) return;
        dico = d;
        index = i;
      })
      .catch(() => {
        if (vivant) absent = true;
      });
    return () => {
      vivant = false;
    };
  });

  /** Le ton choisi par les pastilles ; 0 : tous. Une nouvelle saisie les remet à tous. */
  let ton = $state(0);

  const lus = $derived(caracteresLus(p.cartes));
  const ctx = $derived<ContexteStatut>({
    lus,
    cartes: new Set(p.cartes.map((k) => k.id)),
    chemin,
    /* le dernier jour du chemin fait, comme l'étagère « Bientôt » de Lire */
    fait: jourParcours(p) - 1
  });
  const relues = $derived(glosesRelues(familles ?? []));
  const env = $derived<EnvDico>({ t: td, ctx, relues });
  /** Le pinyin des caractères et des briques des familles, pour celles hors du dictionnaire. */
  const pinyins = $derived(
    new Map(
      (familles ?? []).flatMap((f) => [
        [f.racine.c, f.racine.pinyin] as [string, string],
        ...f.fiches.map((x) => [x.c, x.pinyin] as [string, string])
      ])
    )
  );
  const comptes = $derived({
    caracteres: index?.entrees.filter((e) => e.genre === 'caractere').length ?? 0,
    mots: index?.entrees.filter((e) => e.genre === 'mot').length ?? 0
  });

  const saisie = $derived(q.trim());
  const recherche = $derived(index && saisie !== '' ? chercherDico(saisie, index) : null);
  const rangement = $derived(recherche && index ? ranger(recherche.resultats, index) : null);
  const pastilles = $derived(rangement && index ? pastillesDeTon(saisie, rangement, index.syllabes) : null);
  const vus = $derived(rangement ? filtrerParTon(rangement, pastilles, ton) : null);

  const compagnon = $derived(compagnonDuDico(xing));
  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  /* ---------- la pile des fiches ---------- */

  const vue = $derived<VueDico | null>(pile.length > 0 ? pile[pile.length - 1] : null);

  function titreDe(v: VueDico): string {
    if (v.t === 'car') return v.c;
    if (v.t === 'mot') return index?.entrees.find((e) => e.genre === 'mot' && e.id === v.id)?.formes[0] ?? '';
    return td['ecrire-titre'];
  }

  const labelRetour = $derived(pile.length > 1 ? titreDe(pile[pile.length - 2]) : td.retour);

  function enHaut(): void {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  /** Note des recherches récentes, d'un coup : la progression les garde. */
  function noter(...rs: Recente[]): void {
    let l = p.recentes;
    for (const r of rs) l = noterRecente(l, r);
    if (JSON.stringify(l) !== JSON.stringify(p.recentes)) onrecentes(l);
  }

  /** Ouvre une fiche par-dessus ce qui est là, et la note parmi les récentes. */
  function ouvrir(v: VueDico, depuisSaisie = false): void {
    const r: Recente[] = [];
    if (depuisSaisie && saisie !== '') r.push({ genre: 'saisie', v: saisie });
    if (v.t === 'car') r.push({ genre: 'caractere', v: v.c });
    if (v.t === 'mot') r.push({ genre: 'mot', v: v.id });
    if (r.length > 0) noter(...r);
    pile = [...pile, v];
    enHaut();
  }

  function retour(): void {
    pile = pile.slice(0, -1);
    enHaut();
  }

  /** L'écriture au doigt a choisi un caractère : il s'écrit dans le champ et sa fiche s'ouvre. */
  let choisi = $state('');
  function choisir(c: string): void {
    choisi = c;
    q = c;
    ouvrir({ t: 'car', c });
  }

  function recente(r: Recente): void {
    if (r.genre === 'saisie') {
      q = r.v;
      ton = 0;
      noter(r);
    } else if (r.genre === 'caractere') ouvrir({ t: 'car', c: r.v });
    else ouvrir({ t: 'mot', id: r.v });
  }

  /** Le caractère, ou le mot, d'une récente, et son pinyin. */
  function puce(r: Recente): { hz: string; py: string } | null {
    if (r.genre === 'saisie') return null;
    const e = index?.entrees.find((x) => x.genre === (r.genre === 'mot' ? 'mot' : 'caractere') && x.id === r.v);
    if (!e) return r.genre === 'caractere' ? { hz: r.v, py: pinyins.get(r.v) ?? '' } : null;
    return { hz: e.formes[0] ?? r.v, py: r.genre === 'caractere' ? pinyinDe(e.lectures[0] ?? []) : '' };
  }

  /* ---------- Lire le monde ---------- */

  /** Les mots de deux caractères de l'export : ceux des fiches relues, puis ceux de l'éclair. */
  const mots = $derived(
    lexique(
      (familles ?? []).flatMap((f) => f.fiches.flatMap((x) => (x.statut === 'relu' ? x.mots : []))),
      motsEclair
    )
  );
  const lecture = $derived(lire(texte, { lus, chemin, fait: jourParcours(p) - 1, mots }));
  const parCaractere = $derived(new Map(entrees.map((e) => [e.c, e])));
  const racines = $derived(racinesDesCaracteres(familles ?? []));

  /** Le nom d'un caractère lu pour VoiceOver : « 住, zhù, habiter, lu. Ouvrir sa fiche. » */
  function nomLu(c: string): string {
    const e = parCaractere.get(c);
    return remplir(tl.ouvrir, { nom: nomAccessible(c, e?.pinyin ?? '', e?.fr ?? '') });
  }

  /** Ouvre l'arbre de la famille d'un caractère, s'il est dans une famille exportée. */
  function ouvrirFamille(c: string): void {
    const r = racines.get(c);
    const f = familles?.find((x) => x.racine.c === r);
    if (f) onfamille(noeudDeFamille(f, p.cartes), c);
  }

  /** Un caractère lu, touché : il se dit, et sa fiche s'ouvre dans l'arbre de sa famille. */
  function ouvrirLu(c: string): void {
    void dire(c);
    ouvrirFamille(c);
  }
</script>

<!-- Le compagnon : Tao avant la rencontre de Xing, Xing après, chacun dans sa posture. -->
{#snippet perso(size: number)}
  {#if compagnon.guide === 'xing'}
    <Xing posture={POSTURES.dictionnaire} {size} />
  {:else}
    <Tao stade={taoStade} posture={POSTURES_TAO.dictionnaire} humeur={taoHumeur} {size} />
  {/if}
{/snippet}

<main class="screen chercher">
  {#if vue !== null}
    <div class="tb">
      <button class="lien" onclick={retour}>‹ {labelRetour}</button>
      <span class="mini">{@render perso(52)}</span>
    </div>
    {#if vue.t === 'ecrire'}
      <header class="entete">
        <div class="grow">
          <div class="k surtitre">{td['ecrire-kicker']}</div>
          <h1>{td['ecrire-titre']}</h1>
        </div>
      </header>
      {#if Pave}
        <EcrireAuDoigt t={td} {complet} {Pave} saisie={choisi} onchoisir={choisir} />
      {/if}
    {:else if index && dico}
      {#if vue.t === 'car'}
        {#key vue.c}
          <FicheCaractere
            c={vue.c}
            {env}
            {index}
            {dico}
            {pinyins}
            xing={compagnon.guide === 'xing'}
            maitre={td.maitre}
            {maitreCar}
            onouvrir={(v) => ouvrir(v)}
            onfamille={racines.has(vue.c) ? ouvrirFamille : null}
          />
        {/key}
      {:else}
        {#key vue.id}
          <FicheMot id={vue.id} {env} {index} {dico} onouvrir={(v) => ouvrir(v)} />
        {/key}
      {/if}
    {:else}
      <p class="k aide">{absent ? td.indisponible : td.chargement}</p>
    {/if}
  {:else}
  <button class="k quit" onclick={onretour}>‹ {td.menu}</button>

  <header class="entete">
    <div class="grow">
      <div class="k surtitre">
        {index ? remplir(td.surtitre, { caracteres: nombre(comptes.caracteres), mots: nombre(comptes.mots) }) : ' '}
      </div>
      <h1>Chercher</h1>
    </div>
    {@render perso(72)}
  </header>

  {#if monde}
  <div class="onglets" role="tablist" aria-label={tl.onglets}>
    <button
      role="tab"
      aria-selected={mode === 'caractere'}
      class:on={mode === 'caractere'}
      onclick={() => (mode = 'caractere')}>{tl['onglet-caractere']}</button
    >
    <button role="tab" aria-selected={mode === 'texte'} class:on={mode === 'texte'} onclick={() => (mode = 'texte')}
      >{tl['onglet-texte']}</button
    >
  </div>
  {/if}

  <!-- Un signe du texte lu : un caractère lu (jade, il ouvre sa fiche), un autre (à l'encre, et
       « dans N j » s'il est sur le chemin), ou ce qui n'est pas un sinogramme. -->
  {#snippet signe(s: Signe)}
    {#if !s.han}<span class="autre">{s.t}</span
      >{:else if s.etat === 'lu'}<button class="car lu" aria-label={nomLu(s.c)} onclick={() => ouvrirLu(s.c)}
        ><span class="c" lang="zh-Hans">{s.c}</span><span class="sous" aria-hidden="true"></span></button
      >{:else}<span class="car {s.etat}"
        ><span class="c" lang="zh-Hans">{s.c}</span><span class="sous"
          >{s.dans === null ? '' : ligneDans(tl, s.dans)}</span
        ></span
      >{/if}
  {/snippet}

  {#if monde && mode === 'texte'}
    <div class="champ texte">
      <textarea
        rows="3"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        lang="zh-Hans"
        placeholder={tl.invite}
        aria-label={tl.champ}
        bind:value={texte}
      ></textarea>
      {#if texte !== ''}
        <button class="effacer" onclick={() => (texte = '')}>{tl.effacer}</button>
      {/if}
    </div>
    {#if texte.trim() === ''}
      <p class="k aide">{tl['aide-iphone']}</p>
    {:else}
      <p class="constat" aria-live="polite">
        {familles === null ? tl.chargement : ligneCompte(tl, lecture)}
      </p>
      {#if lecture.total > 0}
        <div class="lecture">
          {#each unites(lecture.signes) as u, k (k)}
            {#if u.mot === null}{@render signe(u.signes[0])}{:else}<span class="mot"
                >{#each u.signes as x, j (j)}{@render signe(x)}{/each}</span
              >{/if}
          {/each}
        </div>
        <p class="k legende">{tl.legende}</p>
      {/if}
      {#if lecture.mots.length > 0}
        <h2 class="titre-mots">{tl.mots}</h2>
        <ul class="mots">
          {#each lecture.mots as m (m.hanzi)}
            <li>
              <button class="mot-lu" onclick={() => void dire(m.hanzi)}>
                <span class="hz" lang="zh-Hans">{m.hanzi}</span>
                <span class="pin">{m.pinyin}</span>
                <span class="sens">{m.fr}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {:else}
    <div class="champ">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
      <input
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder={td.invite}
        aria-label={td.champ}
        bind:value={q}
        oninput={() => (ton = 0)}
        onchange={() => {
          if (saisie !== '') noter({ genre: 'saisie', v: saisie });
        }}
      />
      {#if q !== ''}
        <button class="ico" aria-label={td['effacer-saisie']} onclick={() => ((q = ''), (ton = 0))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
        </button>
      {/if}
      {#if Pave}
        <span class="sep" aria-hidden="true"></span>
        <button class="ico" aria-label={td.ecrire} onclick={() => ouvrir({ t: 'ecrire' })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path d="M14.5 4.5l5 5L10 19l-5.5.5L5 14z" /><path d="M12.5 6.5l5 5" /></svg
          >
        </button>
      {/if}
    </div>

    {#if saisie === ''}
      <p class="k aide">{absent ? td.indisponible : td.aide}</p>
      <h3 class="sec">
        {td.recentes}
        {#if p.recentes.length > 0}
          <button class="lien petit" aria-label={td['recentes-effacer-voix']} onclick={() => onrecentes([])}
            >{td['recentes-effacer']}</button
          >
        {/if}
      </h3>
      {#if p.recentes.length > 0}
        <div class="puces">
          {#each p.recentes as r (r.genre + r.v)}
            {@const x = puce(r)}
            {#if r.genre === 'saisie'}
              <button class="puce" onclick={() => recente(r)}>{r.v}</button>
            {:else if x}
              <button class="puce" onclick={() => recente(r)}
                ><span class="hz" lang="zh-Hans">{x.hz}</span>{#if x.py !== ''}{x.py}{/if}</button
              >
            {/if}
          {/each}
        </div>
      {:else}
        <p class="k aide">{td['recentes-vide']}</p>
      {/if}

      {#if terme}
        {@const c = terme.caractere.c}
        {@const s = statutCaractere(c, ctx)}
        <h3 class="sec">{td['jour-titre']} <small>{remplir(td['jour-terme'], { nom: terme.nomZh, fr: terme.fr })}</small></h3>
        <button class="mdj" onclick={() => ouvrir({ t: 'car', c })}>
          <DicoGlyph {c} size={60} write />
          <span class="mdj-txt">
            <span class="py">{terme.caractere.pinyin}</span>
            {#if relues.get(c)}<span class="fr">{relues.get(c)}</span>{/if}
            <span class="st {s.k}">{libelleStatut(s, td)}</span>
          </span>
        </button>
      {/if}
    {:else if !index}
      <p class="k aide" aria-live="polite">{absent ? td.indisponible : td.chargement}</p>
    {:else if vus}
      {#if pastilles}
        <div class="pastilles" role="group" aria-label={td.tons}>
          <button aria-pressed={ton === 0} onclick={() => (ton = 0)}>{td.tous}</button>
          {#each pastilles.tons as n (n)}
            <button aria-pressed={ton === n} aria-label={remplir(td.ton, { n })} onclick={() => (ton = n)}
              >{pinyinDe([{ base: pastilles.base, ton: n }])}</button
            >
          {/each}
        </div>
      {/if}
      {#if vus.caracteres.length + vus.mots.length === 0}
        <p class="k aide" aria-live="polite">{remplir(td.rien, { q: saisie })}</p>
      {:else}
        <p class="k aide" aria-live="polite">
          {ligneResultats(td, vus.caracteres.length, vus.mots.length)}
          {#if recherche && recherche.total > recherche.resultats.length}
            {remplir(td.premiers, { n: recherche.resultats.length, total: recherche.total })}
          {/if}
        </p>
        {#if vus.caracteres.length > 0}
          <h3 class="sec">{td['titre-caracteres']} <small>{vus.caracteres.length}</small></h3>
          <div class="liste">
            {#each vus.caracteres as e (e.id)}
              {@const l = ligneDe(e, env, lectureDeLigne(e, pastilles, ton))}
              <LigneDico {...l} onclick={() => ouvrir({ t: 'car', c: e.id }, true)} />
            {/each}
          </div>
        {/if}
        {#if vus.mots.length > 0}
          <h3 class="sec">{td['titre-mots']} <small>{vus.mots.length}</small></h3>
          <div class="liste">
            {#each vus.mots as e (e.id)}
              {@const l = ligneDe(e, env, lectureDeLigne(e, pastilles, ton))}
              <LigneDico {...l} onclick={() => ouvrir({ t: 'mot', id: e.id }, true)} />
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  {/if}
  {/if}
</main>

<style>
  .entete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 14px;
  }
  .entete h1 {
    margin: 0;
  }
  .surtitre {
    margin-bottom: 2px;
    min-height: 1.3em;
  }

  /* ---- les deux onglets : un filet, l'indigo de l'action sous l'onglet ouvert ---- */
  .onglets {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .onglets button {
    flex: 1;
    min-height: 44px;
    font-weight: 600;
    color: var(--mist);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .onglets button.on {
    color: var(--indigo);
    border-bottom-color: var(--indigo);
  }

  /* ---- le champ : un filet, la loupe, la saisie ---- */
  .champ {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 0 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--mist);
  }
  .champ:focus-within {
    border-color: var(--indigo);
  }
  .champ svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .champ input {
    flex: 1;
    min-width: 0;
    padding: 12px 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 17px;
    color: var(--ink);
    outline: none;
  }
  .champ input::placeholder {
    color: var(--mist);
  }
  /* ---- Lire le monde : le texte collé ---- */
  .champ.texte {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 0 12px 4px;
  }
  .champ textarea {
    width: 100%;
    min-height: 84px;
    padding: 12px 0 6px;
    border: 0;
    background: transparent;
    font-family: var(--hz);
    font-size: 19px;
    line-height: 1.5;
    color: var(--ink);
    resize: vertical;
    outline: none;
  }
  .champ textarea::placeholder {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--mist);
  }
  .effacer {
    align-self: flex-end;
    min-height: 36px;
    padding: 0 4px;
    font-size: 14px;
    color: var(--indigo);
  }
  .constat {
    margin: 12px 2px 8px;
    font-family: var(--head);
    font-weight: 700;
    font-size: 19px;
    line-height: 1.3;
    color: var(--ink);
  }
  .lecture {
    padding: 10px 8px 8px;
    background: var(--card);
    border-radius: 12px;
    line-height: 1.2;
  }
  .autre {
    white-space: pre-wrap;
    font-family: var(--hz);
    font-size: 24px;
    color: var(--ink2);
    vertical-align: top;
  }
  .car {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: top;
    min-width: 30px;
    padding: 2px 1px 0;
    color: var(--ink);
  }
  .car .c {
    font-family: var(--hz);
    font-weight: 500;
    font-size: 26px;
    line-height: 1.15;
  }
  .car .sous {
    min-height: 13px;
    font-size: 10.5px;
    line-height: 13px;
    white-space: nowrap;
    color: var(--indigo);
  }
  .car.lu {
    color: var(--jade);
    border-radius: 6px;
  }
  .car.lu:active {
    background: var(--jade-soft);
  }
  /* un mot reconnu : ses deux caractères d'un tenant, soulignés d'un seul trait de jade */
  .mot {
    display: inline-flex;
    vertical-align: top;
    white-space: nowrap;
    margin: 0 1px;
  }
  .mot .car {
    padding-left: 0;
    padding-right: 0;
  }
  .mot .c {
    align-self: stretch;
    text-align: center;
    border-bottom: 2px solid var(--jade);
  }
  .legende {
    margin: 8px 2px 0;
    font-size: 13.5px;
    line-height: 1.4;
  }
  .titre-mots {
    margin: 16px 0 4px;
    font-family: var(--head);
    font-size: 17px;
  }
  .mots {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .mot-lu {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 8px 2px;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .mots li:first-child .mot-lu {
    border-top: 0;
  }
  .mot-lu .hz {
    font-size: 22px;
    color: var(--jade);
  }
  .mot-lu .pin {
    color: var(--indigo);
    font-weight: 600;
  }
  .mot-lu .sens {
    color: var(--ink);
  }

  .aide {
    margin: 10px 2px 6px;
    font-size: 14px;
    line-height: 1.4;
  }

  /* ---- la barre d'une fiche : le retour, le compagnon ---- */
  .tb {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 48px;
    margin: -6px 0 4px;
  }
  .lien {
    color: var(--indigo);
    font: 600 16px/1.2 var(--sans);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .lien.petit {
    font-size: 14px;
    margin-left: auto;
  }
  .mini {
    width: 52px;
    height: 52px;
    flex: none;
    line-height: 0;
  }

  /* ---- le champ : la croix qui vide, le pinceau ---- */
  .ico {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    flex: none;
    border-radius: 10px;
    color: var(--ink2);
  }
  .ico svg {
    stroke-linejoin: round;
  }
  .sep {
    width: 1px;
    height: 26px;
    background: var(--line);
    flex: none;
  }
  input::-webkit-search-cancel-button {
    display: none;
  }

  /* ---- la loupe vide : les récentes, le caractère du jour ---- */
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
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .puce {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    color: var(--ink2);
  }
  .puce .hz {
    font-size: 19px;
    color: var(--ink);
  }
  .mdj {
    display: flex;
    gap: 14px;
    align-items: center;
    width: 100%;
    min-height: 44px;
    background: var(--card);
    border-radius: 16px;
    padding: 14px;
    text-align: left;
    color: var(--ink);
  }
  .mdj-txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mdj .py {
    font: 700 22px/1.1 var(--head);
    color: var(--indigo);
  }
  .mdj .fr {
    font-size: 16px;
    color: var(--ink);
  }
  .mdj .st {
    font-size: 13px;
    color: var(--mist);
  }
  .mdj .st.lu {
    color: var(--jade);
    font-weight: 600;
  }
  .mdj .st.chemin,
  .mdj .st.encours {
    color: var(--indigo);
  }

  /* ---- les résultats ---- */
  .pastilles {
    display: flex;
    gap: 6px;
    margin: 10px 0 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pastilles button {
    min-height: 44px;
    min-width: 52px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-weight: 600;
    font-size: 15px;
    color: var(--ink2);
    text-align: center;
    flex: none;
  }
  .pastilles button[aria-pressed='true'] {
    border-color: var(--indigo);
    color: var(--indigo);
  }
  .liste {
    display: grid;
  }
  .liste > :global(.ligne-dico:first-child) {
    border-top: 0;
  }
</style>
