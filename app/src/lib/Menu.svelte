<script lang="ts" module>
  /**
   * Les quatre cases du menu. Leurs caractères sont un choix d'interface (温 réviser,
   * 玩 jouer, 读 lire, 林 la forêt) ; leurs traits et leur pinyin viennent de l'export,
   * comme pour tout caractère. Un caractère absent de l'export laisse son picto au trait.
   */
  export type CaseId = 'reviser' | 'jouer' | 'lire' | 'foret';
  export const CASES: readonly { id: CaseId; c: string; t: string }[] = [
    { id: 'reviser', c: '温', t: 'Réviser' },
    { id: 'jouer', c: '玩', t: 'Jouer' },
    { id: 'lire', c: '读', t: 'Lire' },
    { id: 'foret', c: '林', t: 'Ma forêt' }
  ];
</script>

<script lang="ts">
  /**
   * Le menu : la maison. Il remplace l'écran Aujourd'hui et la barre d'onglets, et tient
   * sur un écran sans défiler. Trois blocs : l'en-tête (la marque, Réglages), la carte du
   * jour (le caractère dans son 米字格, Tao sur le chemin, le seul bouton plein), puis
   * quatre cases identiques. Tout ce qui se décide (état, libellés, phrases de Tao) vient
   * de `parcours.ts` ; ce composant ne fait qu'afficher et charger le contenu.
   *
   * Le cinabre ne marque que la brique nouvelle. Aucune animation à l'appui des cases ni des
   * boutons : l'appui ne change que le fond ; seule la porte qui s'ouvre se pose d'un geste. Le caractère s'écrit au pinceau à l'arrivée
   * et au toucher, Tao saute quand on la touche ; rien ne bouge si l'on réduit les
   * animations.
   *
   * La ligne de fête (le vœu) ou de terme sous la marque se touche : elle rouvre
   * l'anecdote du jour, qui ramène au menu.
   *
   * Le personnage (brief §8) s'ouvre par son portrait, la première des trois icônes de
   * l'en-tête : sa tête à son rang, dans la case d'une icône, sans une ligne de plus, pour
   * que le menu tienne toujours sur un écran. Sans personnage, un visage au trait.
   *
   * L'aventure (brief §6, `ouvertures.ts`) : le premier jour, la carte du jour, le chemin et
   * le bouton, avec Chercher et Réglages ; les cases, le portrait et « Ma route › »
   * apparaissent chacun quand leur porte s'ouvre. La grille garde deux colonnes ; un nombre
   * impair de cases pose la dernière en largeur, pour qu'aucun trou ne reste. La porte qui
   * s'ouvre à ce retour se pose d'une courte animation (coupée si l'on réduit les
   * animations), cerclée d'indigo, et Tao l'annonce dans sa bulle, qui y mène d'un toucher.
   */
  import Bulle from './Bulle.svelte';
  import Embleme from './Embleme.svelte';
  import Voeu from './Voeu.svelte';
  import { pistes as pistesFete, type FeteDuJour } from './fetes';
  import type { Fetes, Saisons } from './content';
  import { phrasesDeTao, pistes as pistesSaison, type TermeDuJour } from './saisons';
  import Glyph from './Glyph.svelte';
  import Marque from './Marque.svelte';
  import Pinceaux from './Pinceaux.svelte';
  import Tao from './Tao.svelte';
  import Heros from './Heros.svelte';
  import { herosOnce, rangDe, total, type Rang } from './heros';
  import { aAudio, dire, manifesteOnce, type Manifeste } from './audio';
  import {
    devinettesOnce,
    fiche,
    lecon,
    nombreDeContes,
    toutesLesFamilles,
    traitsDe,
    type Devinette,
    type Famille
  } from './content';
  import { caracteresLus } from './foret';
  import { glyph, type StrokeData } from './glyph';
  import { MINUTES_MAX, MINUTES_MIN, devinetteAAnnoncer, propose } from './jeux';
  import { ANNONCE_LETTRE, lettreAnnoncee } from './lettres';
  import { caseReviser, carteDuMenu, menu, traitsDeLAjout } from './parcours';
  import { familleDepart, fichesDepart } from './premiere';
  import { jourDeDemain, premierSens } from './route';
  import { cartesDues, jourParcours, type Progress } from './session';
  import { ACCES_WEB, prochaineBrique, type Acces } from './droits';
  import { quandMenu, SANS_RYTHME, type TextesRythme } from './rythme';
  import { stade } from './tao';
  import type { Porte, PorteId } from './ouvertures';

  let {
    p,
    acces = ACCES_WEB,
    textes = SANS_RYTHME,
    fete = null,
    fetes = null,
    terme = null,
    saisons = null,
    ondemarrer,
    oncase,
    onchercher,
    onreglages,
    onpersonnage = () => undefined,
    onanecdote = () => undefined,
    onroute = () => undefined,
    vois = () => true,
    annonce = null,
    ondecouvrir = () => undefined
  }: {
    p: Progress;
    /** Le web ou l'app, et l'achat : ce qui fixe le jour de la prochaine brique (`droits.ts`). */
    acces?: Acces;
    /** Les lignes du rythme gratuit (`rythme.json`) : la journée sans brique, « Dans 3 j ». */
    textes?: TextesRythme;
    /** La fête du jour : le vœu prend la place de la marque, l'emblème porte le caractère. */
    fete?: FeteDuJour | null;
    fetes?: Fetes | null;
    /** Le terme solaire qui court : une ligne sous la marque, jamais un jour de fête. */
    terme?: TermeDuJour | null;
    saisons?: Saisons | null;
    /** Le bouton plein (ou en contour) : ce qu'il ouvre se décide dans `parcours.ts`. */
    ondemarrer: () => void;
    oncase: (id: CaseId) => void;
    /** La loupe : chercher un caractère de l'export. */
    onchercher: () => void;
    onreglages: () => void;
    /** Le portrait de l'en-tête : « Mon personnage ». */
    onpersonnage?: () => void;
    /** La ligne de fête ou de terme de l'en-tête : rouvre l'anecdote du jour. */
    onanecdote?: () => void;
    /** « Ma route › » sous le chemin, la journée faite : 前路, la route devant. */
    onroute?: () => void;
    /** L'aventure : une porte est-elle montrée ? Sans calendrier, tout l'est. */
    vois?: (id: string) => boolean;
    /** La porte qui s'ouvre à ce retour au menu, que Tao annonce. */
    annonce?: Porte | null;
    /** Toucher l'annonce, ou la case qui vient d'apparaître. */
    ondecouvrir?: (id: PorteId) => void;
  } = $props();

  /** Les cases montrées, dans leur ordre ; la porte annoncée se pose en dernier venu. */
  const cases = $derived(CASES.filter((x) => vois(x.id)));
  const neuve = (id: string): boolean => annonce?.id === id;

  /* ---------- la carte du jour ---------- */

  type Carte = {
    c: string;
    pinyin: string;
    fr: string;
    parts: string[];
    /** Les briques ajoutées, les seules en cinabre. Vide en rattrapage. */
    nouveau: number[];
    pistes: string[];
  };

  let carte = $state<Carte | null>(null);
  let traits = $state<StrokeData | null>(null);
  let cinabre = $state<number[]>([]);
  /** Chaque toucher réécrit le caractère : la clé change, le dessin repart. */
  let ecriture = $state(0);

  /** D'où vient le caractère, en une clé : la carte ne se recharge que si elle change. */
  const source = $derived.by(() => {
    const s = carteDuMenu(p);
    if (s.source === 'revision') {
      return `r:${cartesDues(p, new Date(), 1)[0]?.id ?? ''}`;
    }
    if (s.source === 'revue') return `v:${p.parcours ?? ''}:${s.jour}`;
    return s.source === 'lecon' ? `l:${p.parcours ?? ''}:${s.jour}` : 'p';
  });

  async function lire(cle: string): Promise<Carte | null> {
    if (cle === 'p') {
      const f = fichesDepart(await familleDepart())[0];
      return f ? { c: f.c, pinyin: f.pinyin, fr: f.fr, parts: f.parts, nouveau: [], pistes: [] } : null;
    }
    if (cle.startsWith('r:')) {
      const c = cle.slice(2);
      const f = c === '' ? null : await fiche(c);
      return f ? { c: f.c, pinyin: f.pinyin, fr: f.fr, parts: f.parts, nouveau: [], pistes: [] } : null;
    }
    const [genre, choisi, jour] = cle.split(':');
    const l = await lecon(choisi === '' ? null : choisi, Number(jour));
    if (genre === 'v') {
      /* Un jour sans brique nouvelle : la brique revue, sans cinabre, rien n'est ajouté. */
      const b = l.brique ?? l.composes[0];
      return b ? { c: b.c, pinyin: b.pinyin, fr: b.fr, parts: b.parts, nouveau: [], pistes: l.pistes } : null;
    }
    const f = l.composes[0] ?? l.brique;
    if (!f) return null;
    /* Un jour sans composé : la brique elle-même est l'élément ajouté. */
    const nouveau = f.parts.length === 0 ? [] : f.nouveau;
    return { c: f.c, pinyin: f.pinyin, fr: f.fr, parts: f.parts, nouveau, pistes: l.pistes };
  }

  $effect(() => {
    const cle = source;
    let vivant = true;
    void (async () => {
      const c = await lire(cle);
      const d = c === null ? null : await traitsDe(c.c, c.pistes);
      let z: number[] = [];
      if (c !== null && d !== null && c.nouveau.length > 0) {
        const ds = await Promise.all(c.parts.map((x) => traitsDe(x, c.pistes).catch(() => null)));
        z = traitsDeLAjout(c.parts, c.nouveau, ds.map((x) => x?.s.length ?? null), d.s.length);
      }
      if (!vivant) return;
      /* Le cinabre marque un élément ajouté à un tout : si l'ajout couvre tout le caractère
         (朋 = 月 + 月, tout neuf), rien n'est en cinabre. */
      if (d !== null && z.length >= d.s.length) z = [];
      carte = c;
      traits = d;
      cinabre = z;
    })().catch(() => {
      if (vivant) carte = null;
    });
    return () => {
      vivant = false;
    };
  });

  /** Le manifeste audio : il dit si le caractère a une voix. */
  let son = $state<Manifeste | null>(null);
  $effect(() => {
    let vivant = true;
    void manifesteOnce()
      .then((m) => {
        if (vivant) son = m;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  /** Toucher le caractère : il se réécrit au pinceau, et se dit. */
  function toucher(): void {
    if (!carte) return;
    ecriture += 1;
    void dire(carte.c);
  }

  const m = $derived(menu(p, carte?.c ?? '', textes, vois('jouer')));
  /** Un jour sans composé : la décomposition montre la brique seule, en cinabre. */
  const briqueSeule = $derived(carte !== null && carte.parts.length === 0 && m.etat !== 'rattrapage' && m.etat !== 'premiere');
  /* Toutes les parties sont neuves : il n'y a pas d'élément ajouté à distinguer, tout reste à l'encre. */
  const toutNeuf = $derived(carte !== null && carte.parts.length > 0 && carte.parts.every((_, i) => carte?.nouveau.includes(i)));
  const enCinabre = (i: number): boolean => !toutNeuf && (carte?.nouveau.includes(i) ?? false);

  /* ---------- demain, la journée faite ---------- */

  /**
   * « Demain : 子 enfant » : la brique de la prochaine session, la journée faite seulement
   * (`route.jourDeDemain`), en jour du chemin. Au rythme gratuit, quand elle n'est pas pour
   * le lendemain, « Dans 3 j : 子 enfant », en jours du calendrier, ceux que fixe la règle
   * (`droits.prochaineBrique`). Une ligne discrète, pour que le menu tienne toujours sur un
   * écran.
   */
  let demain = $state.raw<{ c: string; sens: string; pistes: string[] } | null>(null);
  const jourDemain = $derived(jourDeDemain(p));
  const quandDemain = $derived.by(() => {
    const k = prochaineBrique(p.droits, acces, p.day, jourParcours(p));
    return k === null ? '' : quandMenu(textes, k.dans);
  });

  $effect(() => {
    const jour = jourDemain;
    const choisi = p.parcours;
    if (jour === null) {
      demain = null;
      return;
    }
    let vivant = true;
    void lecon(choisi, jour)
      .then((l) => {
        const f = l.brique ?? l.composes[0] ?? null;
        if (vivant) demain = f === null ? null : { c: f.c, sens: premierSens(f.fr), pistes: l.pistes };
      })
      .catch(() => {
        if (vivant) demain = null;
      });
    return () => {
      vivant = false;
    };
  });

  /* ---------- Tao sur le chemin ---------- */

  let phrase = $state(0);
  let saute = $state(false);
  const taoStade = $derived(stade(p.tao.croissance));
  const pct = $derived(((m.position + 0.5) / Math.max(1, m.coups.length)) * 100);
  const aDroite = $derived(pct < 55);
  /* Un jour de fête, Tao commence par la fête, un jour de terme par le terme, puis revient à la journée.
     Une porte qui s'ouvre passe avant tout : c'est ce retour-là qu'elle l'annonce. */
  const phrases = $derived(annonce !== null ? [annonce.annonce] : phrasesDeTao(fete, terme, m.phrases));
  const texte = $derived(phrases.length === 0 ? '' : phrases[phrase % phrases.length]);

  function toucherTao(): void {
    phrase += 1;
    saute = false;
    requestAnimationFrame(() => {
      saute = true;
    });
  }

  /* ---------- le portrait du personnage ---------- */

  let rangsHeros = $state<Rang[]>([]);
  $effect(() => {
    let vivant = true;
    void herosOnce()
      .then((d) => {
        if (vivant) rangsHeros = d.rangs;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });
  const rangHeros = $derived(rangDe(total(p.arts), rangsHeros));

  /* ---------- les cases ---------- */

  let casesTraits = $state<Record<string, StrokeData | null>>({});
  let casesPinyin = $state<Record<string, string>>({});
  let familles = $state<Famille[]>([]);
  let contes = $state<number | null>(null);
  /** Les devinettes de l'export : la case Jouer annonce celle du jour. */
  let devinettes = $state<Devinette[]>([]);

  $effect(() => {
    let vivant = true;
    for (const x of CASES) {
      void traitsDe(x.c)
        .then((d) => {
          if (vivant) casesTraits = { ...casesTraits, [x.c]: d };
        })
        .catch(() => undefined);
      void fiche(x.c)
        .then((f) => {
          if (vivant && f && f.pinyin !== '') casesPinyin = { ...casesPinyin, [x.c]: f.pinyin };
        })
        .catch(() => undefined);
    }
    void toutesLesFamilles()
      .then((l) => {
        if (vivant) familles = l;
      })
      .catch(() => undefined);
    /* L'aperçu allumé, les contes à relire comptent : la case dit ce que Lire ouvre. */
    void nombreDeContes()
      .then((n) => {
        if (vivant) contes = n;
      })
      .catch(() => undefined);
    void devinettesOnce()
      .then((d) => {
        if (vivant) devinettes = d.devinettes;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });

  const reviser = $derived(caseReviser(p));
  const lus = $derived(caracteresLus(familles, p.cartes));

  function info(id: CaseId): string {
    if (id === 'reviser') return reviser.info;
    if (id === 'jouer') {
      if (propose(p, p.day)) return 'Tao propose un jeu';
      return vois('jeu-devinette') && devinetteAAnnoncer(p, devinettes)
        ? 'La devinette du jour'
        : `${MINUTES_MIN} à ${MINUTES_MAX} minutes`;
    }
    if (id === 'lire') {
      /* La semaine où une lettre de Que arrive, la case Lire l'annonce, sobrement. */
      if (lettreAnnoncee(p.lettres, p.day)) return ANNONCE_LETTRE;
      /* Avant les contes, Lire garde l'anecdote du jour et les lettres de Que. */
      if (!vois('contes')) return 'L’anecdote du jour';
      if (contes === null) return '';
      return contes > 0 ? `${contes} conte${contes > 1 ? 's' : ''}` : 'Les contes arrivent';
    }
    return `${lus} lu${lus > 1 ? 's' : ''}`;
  }

  /** Les pictos au trait, tous du même dessin : la place d'un caractère que l'export n'a pas. */
  const PICTOS: Record<CaseId, string> = {
    reviser: '<rect x="3.5" y="7.5" width="12" height="13.5" rx="2"/><path d="M8 3.5h10.5a2 2 0 0 1 2 2V17"/>',
    jouer: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="8.5" cy="15.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/></g>',
    lire: '<path d="M3 5.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 5.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
    foret: '<path d="M12 21.5V16"/><path d="M12 2.5l5.5 7.5h-2.8l4.3 6H5l4.3-6H6.5z"/>'
  };
</script>

<main class="menu">
  <header class="mhead">
    {#if fete}
      <div class="marque"><Voeu {fete} pistes={fetes ? pistesFete(fetes, '福') : []} onouvrir={onanecdote} /></div>
    {:else}
      <div class="marque">
        <span class="logo"><Marque size={30} /></span>
        <span class="lignes">
          <span class="rangee"><span class="nom">Wenlu</span><span class="cn hz">文路</span></span>
          {#if terme}
            <!-- le terme solaire qui court, discret : son caractère, son nom, sa traduction -->
            <button class="terme" aria-label="{terme.nomZh}, {terme.fr}. L'anecdote du jour" onclick={onanecdote}>
              <span class="tc" aria-hidden="true"
                ><Glyph char={terme.caractere.c} size={17} write={false} color="var(--ink2)" pistes={saisons ? pistesSaison(saisons, terme.caractere.c) : []}
                /></span
              ><span class="hz" aria-hidden="true">{terme.nomZh}</span><span aria-hidden="true"> · {terme.fr}</span>
            </button>
          {/if}
        </span>
      </div>
    {/if}
    {#if vois('personnage')}
    <button class="icone perso" class:neuve={neuve('personnage')} aria-label={p.heros ? `Mon personnage, ${p.heros.nom}` : 'Mon personnage'} onclick={onpersonnage}>
      {#if p.heros}
        <span class="portrait"><Heros bete={p.heros.bete} rang={rangHeros} cadre="portrait" largeur={34} /></span>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13.5" r="7" /><path d="M7.5 8.5 6.5 4l4 2.6M16.5 8.5l1-4.5-4 2.6" /><path d="M10 15.5q2 1.5 4 0" />
        </svg>
      {/if}
    </button>
    {/if}
    <button class="icone" aria-label="Chercher un caractère" onclick={onchercher}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
    </button>
    <button class="icone" aria-label="Réglages" onclick={onreglages}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>
  </header>

  <section class="jour" class:fete={fete !== null} class:seul={cases.length === 0}>
    <div class="jour-haut">
      <button
        class="mizi"
        aria-label={carte ? `Réécrire et écouter ${carte.c}` : 'Le caractère du jour'}
        onclick={toucher}
      >
        {#if fete}
          <!-- Un jour de fête, l'emblème (la lune, la rosace) devient la case du caractère. -->
          <span class="emb-pos">
            {#key ecriture}
              <Embleme fete={fete.id} c={carte?.c ?? ''} {cinabre} pistes={carte?.pistes ?? []} size={160} />
            {/key}
          </span>
        {:else}
        <!-- Le 米字格 : la grille d'exercice des écoliers, en filets fins. -->
        <svg class="grille" width="100%" height="100%" viewBox="0 0 104 104" aria-hidden="true">
          <rect x=".5" y=".5" width="103" height="103" rx="14" />
          <path d="M52 1v102M1 52h102M1 1l102 102M103 1L1 103" />
        </svg>
        {/if}
        {#if carte && traits && !fete}
          {#key ecriture}
            <span class="trace">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html glyph(carte.c, traits, 108, { write: true, cinabre })}
            </span>
          {/key}
        {/if}
      </button>
      <div class="jour-txt">
        <div class="surtitre">{m.surtitre}</div>
        {#if carte}
          <div class="py">
            {carte.pinyin}
            <button
              class="dire"
              aria-label="Écouter {carte.pinyin}"
              disabled={!aAudio(son, carte.c)}
              onclick={() => carte && void dire(carte.c)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
                <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
              </svg>
            </button>
          </div>
          {#if carte.fr !== ''}<div class="sens">{carte.fr}</div>{/if}
          <div class="dec">
            {#if briqueSeule}
              <span class="part"><Glyph char={carte.c} size={22} write={false} color="var(--ink)" pistes={carte.pistes} /></span>
            {:else}
              {#each carte.parts as part, i (part + i)}
                {#if i > 0}<span class="op">+</span>{/if}
                <span class="part" class:z={enCinabre(i)}>
                  <Glyph
                    char={part}
                    size={22}
                    write={false}
                    color={enCinabre(i) ? 'var(--zhu)' : 'var(--ink)'}
                    pistes={carte.pistes}
                  />
                </span>
              {/each}
            {/if}
            <span class="k">{m.brique}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="chemin">
      <button
        class="marcheur"
        class:saute
        style="left:{pct.toFixed(2)}%"
        aria-label="Tao"
        onclick={toucherTao}
        onanimationend={() => (saute = false)}
      >
        <Tao stade={taoStade} posture={m.tao.posture} humeur={m.tao.humeur} size={56} />
      </button>
      {#if texte !== ''}
        {#key texte}
          <Bulle
            {texte}
            action={annonce !== null ? () => annonce && ondecouvrir(annonce.id) : undefined}
            cote={aDroite ? 'droite' : 'gauche'}
            style={aDroite
              ? `bottom:calc(100% - 45px);left:calc(${pct.toFixed(2)}% + 34px)`
              : `bottom:calc(100% - 45px);right:calc(${(100 - pct).toFixed(2)}% + 34px)`}
          />
        {/key}
      {/if}
      <Pinceaux coups={m.coups} label={m.ligne} />
      <div class="pas">
        <span>{m.ligne}</span>
        {#if m.duree !== ''}<span class="duree">{m.duree}</span>{/if}
      </div>
      {#if demain && jourDemain !== null && quandDemain !== ''}
        <div class="demain">
          <span class="dm"
            >{quandDemain} : <span class="dgl"
              ><Glyph char={demain.c} size={16} write={false} color="var(--ink)" pistes={demain.pistes} /></span
            >{#if demain.sens !== ''}<span class="dsens">{demain.sens}</span>{/if}</span
          >
          {#if vois('route')}
            <button class="vers-route" class:neuve={neuve('route')} aria-label="Ma route : la route devant" onclick={onroute}>Ma route ›</button>
          {/if}
        </div>
      {/if}
    </div>

    <button class="btn pilule" class:ghost={!m.plein} onclick={ondemarrer}>
      {m.bouton}
      {#if m.plein}
        <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      {/if}
    </button>
  </section>

  {#if cases.length > 0}
  <nav class="cases" aria-label="Activités">
    {#each cases as x, i (x.id)}
      <button
        class="case"
        class:large={cases.length % 2 === 1 && i === cases.length - 1}
        class:neuve={neuve(x.id)}
        onclick={() => (neuve(x.id) ? ondecouvrir(x.id) : oncase(x.id))}
      >
        <span class="haut">
          <span class="gl">
            {#if casesTraits[x.c]}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html glyph(x.c, casesTraits[x.c] ?? undefined, 46, { write: false, color: 'var(--tile-fg, var(--indigo))', label: x.t })}
            {:else}
              <span class="picto">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html `<svg viewBox="0 0 24 24" aria-hidden="true">${PICTOS[x.id]}</svg>`}
              </span>
            {/if}
          </span>
          {#if casesPinyin[x.c]}<span class="cpy">{casesPinyin[x.c]}</span>{/if}
        </span>
        <span class="textes">
          <span class="titre">{x.t}</span>
          <span class="info">{info(x.id)}</span>
        </span>
      </button>
    {/each}
  </nav>
  {/if}
</main>

<style>
  /* Le menu tient sur 393 × 660 sans défiler : les cases prennent le bas, le reste suit. */
  .menu {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    padding: calc(env(safe-area-inset-top) + 8px) 20px calc(env(safe-area-inset-bottom) + 18px);
  }
  .menu > * {
    flex-shrink: 0;
  }

  /* ---- un jour de fête : l'emblème déborde de la case, le texte s'écarte ---- */
  .jour.fete {
    padding-top: 14px;
  }
  .jour.fete .jour-haut {
    gap: 26px;
    padding-left: 18px;
  }
  .jour.fete .mizi {
    background: transparent;
    overflow: visible;
  }
  .emb-pos {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    line-height: 0;
    pointer-events: none;
  }

  /* ---- l'en-tête ---- */
  .mhead {
    display: flex;
    align-items: center;
    min-height: 44px;
    margin: 0 -10px 8px 0;
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
  }
  .logo {
    line-height: 0;
    color: var(--ink);
  }
  .lignes {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .rangee {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  /* le terme solaire : une ligne sous la marque, dans la hauteur de l'en-tête */
  .terme {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.1;
    color: var(--ink2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  /* elle rouvre l'anecdote du jour : l'appui ne change que la couleur */
  .terme:active {
    color: var(--ink);
  }
  .terme .tc {
    line-height: 0;
    flex-shrink: 0;
  }
  .nom {
    font-family: var(--head);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: -0.035em;
    line-height: 1;
  }
  .cn {
    color: var(--mist);
    font-size: 16px;
  }
  .icone {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--ink2);
  }
  .icone:active {
    background: var(--card);
  }
  /* le portrait : la tête du personnage dans un rond de papier, à la taille d'une icône */
  .portrait {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--card);
    border: 1.5px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    line-height: 0;
  }
  .icone svg {
    width: 24px;
    height: 24px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---- la carte du jour ---- */
  /* Sur un grand écran, la carte du jour et les cases se centrent : le vide se partage. */
  .jour {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
  }
  /* Le premier jour, sans case : la carte du jour se centre, sans trou au-dessus. */
  .jour.seul {
    margin-bottom: auto;
  }
  .jour-haut {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .mizi {
    position: relative;
    width: 116px;
    height: 116px;
    flex-shrink: 0;
    line-height: 0;
    background: var(--card);
    border-radius: 16px;
  }
  .grille {
    position: absolute;
    inset: 0;
  }
  .grille rect,
  .grille path {
    fill: none;
    stroke: var(--grille, var(--line));
    stroke-width: 1;
  }
  .grille path {
    stroke-dasharray: 3 4;
  }
  .trace {
    position: absolute;
    left: 4px;
    top: 4px;
  }
  .jour-txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .surtitre {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
    line-height: 1.3;
  }
  .py {
    font-family: var(--head);
    font-weight: 700;
    font-size: 36px;
    letter-spacing: -0.04em;
    line-height: 1;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .dire {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--mist);
    border-radius: 50%;
  }
  .dire:active {
    background: var(--line);
    color: var(--ink);
  }
  .dire:disabled {
    opacity: 0.4;
  }
  .dire svg {
    width: 21px;
    height: 21px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sens {
    font-size: 17px;
    color: var(--ink2);
    line-height: 1.2;
  }
  .dec {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 6px;
    margin-top: 8px;
  }
  .dec .op {
    font-family: var(--head);
    font-size: 15px;
    color: var(--mist);
  }
  .dec .part {
    display: inline-flex;
    line-height: 0;
  }
  .dec .k {
    margin-left: 2px;
  }

  /* ---- le chemin : les coups de pinceau, Tao qui marche, sa bulle ---- */
  .chemin {
    position: relative;
    padding-top: 56px;
  }
  .marcheur {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    line-height: 0;
  }
  .marcheur.saute {
    animation: saute 0.5s cubic-bezier(0.2, 1.4, 0.5, 1) 2;
  }
  @keyframes saute {
    0% {
      transform: translateX(-50%) translateY(0);
    }
    50% {
      transform: translateX(-50%) translateY(-18px);
    }
    100% {
      transform: translateX(-50%) translateY(0);
    }
  }
  .pas {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 9px;
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .duree {
    color: var(--mist);
    white-space: nowrap;
  }
  /* « Demain : 子 enfant », la journée faite : une ligne discrète, sans hauteur de plus que
     son texte ; le lien garde une cible de 44 px en débordant sur les marges. */
  .demain {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 3px;
    font-size: 14px;
    line-height: 20px;
    color: var(--ink2);
  }
  .dm {
    display: flex;
    align-items: center;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
  }
  .dgl {
    display: inline-flex;
    line-height: 0;
    margin: 0 5px 0 5px;
  }
  .dsens {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .vers-route {
    position: relative;
    flex-shrink: 0;
    color: var(--indigo);
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
  }
  .vers-route::before {
    content: '';
    position: absolute;
    inset: -12px -10px;
  }

  /* ---- le bouton unique, en pilule ; sans animation, l'appui ne change que le fond ---- */
  .pilule {
    border-radius: 999px;
    min-height: 54px;
    margin-top: 4px;
  }
  .pilule:not(.ghost):active {
    background: var(--ink);
  }
  .pilule.ghost {
    border-width: 1.5px;
    background: var(--paper);
  }
  .pilule.ghost:active {
    background: var(--card);
  }
  .fleche {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---- les quatre cases : identiques, colorées par les variables --tile-* ---- */
  .cases {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    margin-top: 18px;
    margin-bottom: auto;
  }
  .case {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 104px;
    min-width: 0;
    padding: 10px 14px 12px;
    background: var(--tile-bg, var(--card));
    border: 1px solid var(--tile-bd, transparent);
    border-radius: 20px;
    text-align: left;
  }
  .case:active {
    background: var(--line);
  }
  .haut {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
  }
  .gl {
    line-height: 0;
    margin-left: -4px;
    color: var(--tile-fg, var(--indigo));
  }
  .picto {
    display: inline-block;
    margin: 8px 0 8px 6px;
  }
  .picto :global(svg) {
    width: 30px;
    height: 30px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cpy {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--tile-ink2, var(--ink2));
    margin-top: 6px;
  }
  .textes {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin-top: auto;
  }
  .titre {
    font-family: var(--head);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--tile-ink, var(--ink));
  }
  /* Un nombre impair de cases : la dernière prend la largeur, couchée, sans laisser de trou. */
  .case.large {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    min-height: 76px;
    padding: 8px 16px 8px 14px;
  }
  .case.large .haut {
    display: contents;
  }
  .case.large .textes {
    flex: 1;
    margin-top: 0;
    order: 1;
  }
  .case.large .cpy {
    order: 2;
    margin-top: 0;
    align-self: flex-start;
    margin-top: 4px;
  }
  .info {
    font-size: 14px;
    color: var(--tile-ink2, var(--ink2));
    line-height: 1.3;
    margin-top: 2px;
    min-height: 18px;
  }

  @media (prefers-reduced-motion: reduce) {
    .marcheur.saute {
      animation: none;
    }
  }

  /* La porte qui s'ouvre à ce retour : cerclée d'indigo, l'action, et posée d'un geste court. */
  .case.neuve {
    outline: 1.5px solid var(--indigo);
    outline-offset: -1.5px;
    animation: pose 0.45s cubic-bezier(0.2, 0.8, 0.3, 1) 0.2s both;
  }
  .perso.neuve .portrait {
    border-color: var(--indigo);
  }
  .perso.neuve,
  .vers-route.neuve {
    animation: pose 0.45s cubic-bezier(0.2, 0.8, 0.3, 1) 0.2s both;
  }
  @keyframes pose {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .case.neuve,
    .perso.neuve,
    .vers-route.neuve {
      animation: none;
    }
  }
</style>
