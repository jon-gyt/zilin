<script lang="ts">
  /**
   * Le lecteur d'un conte (story 2c.1) : la version que l'acquis ouvre, en texte courant.
   * Le texte est en police, comme les trois lignes du pas Utiliser : la règle des traits
   * vaut pour les grands caractères isolés, pas pour un texte qui se lit d'un trait.
   *
   * Toucher un caractère, ou un mot que la glose de la version connaît, montre son pinyin
   * et son sens dans la bande du bas, et le dit (`audio.dire`, silencieux sans voix). La
   * traduction se replie. « J'ai lu » en fin de conte note la version lue. Tao lit
   * par-dessus l'épaule. Aucun cinabre ici : le conte n'a pas d'élément ajouté.
   *
   * En mode relecture (Réglages), une version de l'aperçu porte la mention « à relire » en
   * tête, une version que l'acquis n'ouvre pas encore « pas encore dans ton acquis » ; leur
   * « J'ai lu » ne note rien (`Lire.fini`) : un texte qu'on essaie n'est pas un conte lu.
   *
   * Les lettres de Que (story 4b.8) passent par le même lecteur : `surtitre` remplace la
   * ligne du seuil, la lettre n'a pas de titre chinois, et `signature` se pose sous le
   * texte (Que, qui l'a écrite).
   *
   * Un récit long se lit chapitre par chapitre : un chapitre à la fois, son titre en tête
   * du texte, sa traduction ; le sommaire, replié, ouvre n'importe quel chapitre. On
   * reprend au chapitre noté dans la progression (`enCours`). « Chapitre suivant » note le
   * chapitre lu (`onchapitre`) et ouvre le suivant ; au dernier, « J'ai lu » note le conte
   * lu (`onlu`) si tous les chapitres le sont, sinon ouvre le premier qui reste, et le dit :
   * un chapitre non lu ne compte pas.
   */
  import { untrack, type Snippet } from 'svelte';
  import ARelire from './ARelire.svelte';
  import Tao from './Tao.svelte';
  import { dire } from './audio';
  import { fiche } from './content';
  import {
    MENTION_HORS_ACQUIS,
    chapitreDeReprise,
    chapitresDe,
    estLongue,
    grouper,
    ligneGlose,
    tousLus,
    traductionDe,
    unites,
    unitesDuChapitre,
    unitesDuTitre,
    type EntreeConte,
    type LectureChapitres,
    type Unite
  } from './lecture';
  import type { Progress } from './session';
  import { humeur, stade } from './tao';

  let {
    p,
    entree,
    onlu,
    onretour,
    surtitre,
    signature,
    enCours,
    onchapitre = () => undefined,
    onreprise = () => undefined
  }: {
    /** La progression : Tao y lit son stade et son humeur. */
    p: Progress;
    /** Le conte, avec la version ouverte (jamais nulle ici). */
    entree: EntreeConte;
    /** « J'ai lu » : la version est notée lue, puis retour à la bibliothèque. */
    onlu: () => void;
    onretour: () => void;
    /** La ligne au-dessus du titre ; par défaut, le seuil de la version. */
    surtitre?: string;
    /** Sous le texte, dans la même carte : la signature d'une lettre. */
    signature?: Snippet;
    /** Un récit long : ses chapitres lus et celui où reprendre, lus dans la progression. */
    enCours?: LectureChapitres;
    /** Un chapitre d'un récit long lu en entier : son rang, sur `n`. */
    onchapitre?: (k: number, n: number) => void;
    /** Un chapitre ouvert depuis le sommaire : on y reprendra. */
    onreprise?: (k: number) => void;
  } = $props();

  const v = $derived(entree.version);
  const long = $derived(v ? estLongue(v) : false);
  const chapitres = $derived(v ? chapitresDe(v) : []);
  const n = $derived(chapitres.length);
  /** Le chapitre ouvert, de 1 à n ; une fable n'en a qu'un. */
  let k = $state(untrack(() => chapitreDeReprise(enCours, n)));
  /** Les chapitres lus, ceux de la progression puis ceux de cette lecture. */
  let lus = $state<number[]>(untrack(() => [...(enCours?.lus ?? [])]));
  /** Au dernier chapitre, quand d'autres restent : le premier qui reste, dit à l'écran. */
  let reste = $state<number | null>(null);
  let sommaireOuvert = $state(false);
  /** Les chapitres qui restent à lire. */
  const restants = $derived(Array.from({ length: n }, (_, j) => j + 1).filter((j) => !lus.includes(j)));

  const chapitre = $derived(chapitres[Math.min(Math.max(k, 1), n) - 1] ?? null);
  /* Le titre, puis le texte courant, groupés pour que la ponctuation ne passe pas seule à la ligne. */
  const titre = $derived(v ? grouper(unitesDuTitre(v)) : []);
  const titreChapitre = $derived(
    v && chapitre && long ? grouper(unitesDuChapitre(chapitre, v.glose)) : []
  );
  const texte = $derived(
    v && chapitre ? grouper(chapitre.phrases.flatMap((ph) => unites(ph, v.glose))) : []
  );
  const trad = $derived(chapitre ? traductionDe(chapitre.phrases) : '');
  const ligneSeuil = $derived(
    long ? `Version du seuil ${v?.seuil} · chapitre ${k} sur ${n}` : `Version du seuil ${v?.seuil}`
  );

  /** L'unité touchée, et son pinyin quand la phrase ne le donne pas (lu dans la fiche). */
  let touchee = $state.raw<Unite | null>(null);
  let pinyinFiche = $state<string | null>(null);
  let tradOuverte = $state(false);

  const taoStade = $derived(stade(p.tao.croissance));
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));

  /**
   * Le pinyin d'une unité que la phrase n'aligne pas (le titre, une phrase au pinyin
   * irrégulier) : celui des fiches de l'export, caractère par caractère. Faute de fiche
   * pour l'un d'eux, rien : on ne devine pas une lecture.
   */
  async function pinyinDesFiches(texte: string): Promise<string | null> {
    const lus = await Promise.all(Array.from(texte).map((c) => fiche(c).catch(() => null)));
    if (lus.some((f) => !f || !f.pinyin)) return null;
    return lus.map((f) => f?.pinyin ?? '').join('');
  }

  function toucher(u: Unite): void {
    touchee = u;
    pinyinFiche = null;
    void dire(u.texte);
    if (u.pinyin === null) {
      void pinyinDesFiches(u.texte).then((py) => {
        if (touchee === u) pinyinFiche = py;
      });
    }
  }

  const glose = $derived(
    touchee ? ligneGlose({ pinyin: touchee.pinyin ?? pinyinFiche, sens: touchee.sens }) : ''
  );

  function haut(): void {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  /** Ouvre un chapitre : la glose et la traduction repartent de zéro. */
  function ouvrirChapitre(j: number): void {
    k = j;
    touchee = null;
    pinyinFiche = null;
    tradOuverte = false;
    haut();
  }

  /** Depuis le sommaire : on y reprendra. */
  function choisir(j: number): void {
    sommaireOuvert = false;
    reste = null;
    ouvrirChapitre(j);
    onreprise(j);
  }

  /**
   * Fin d'un chapitre. Une fable est lue d'un coup ; un récit long note le chapitre, ouvre
   * le suivant, et n'est lu qu'une fois tous ses chapitres lus.
   */
  function fini(): void {
    if (!long) {
      onlu();
      return;
    }
    const courant = k;
    lus = [...new Set([...lus, courant])].sort((a, b) => a - b);
    onchapitre(courant, n);
    if (courant < n) {
      reste = null;
      ouvrirChapitre(courant + 1);
      return;
    }
    if (tousLus(lus, n)) {
      onlu();
      return;
    }
    const premier = Array.from({ length: n }, (_, j) => j + 1).find((j) => !lus.includes(j)) ?? 1;
    reste = premier;
    ouvrirChapitre(premier);
  }
</script>

<main class="screen conte">
  <button class="k quit" onclick={onretour}>‹ Lire</button>

  <div class="verif-tete">
    <div class="grow">
      <div class="k">
        {surtitre ?? ligneSeuil}
        <ARelire de={v} />
        {#if entree.horsAcquis}<span class="mention">{MENTION_HORS_ACQUIS}</span>{/if}
      </div>
      {#if entree.titre_zh}
        <h1 class="vrai" lang="zh-Hans">{entree.titre_zh}</h1>
        <div class="py">{entree.titre_pinyin}</div>
        <div class="fr">{entree.titre_fr}</div>
      {:else}
        <h1>{entree.titre_fr}</h1>
      {/if}
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
  </div>

  {#snippet ligne(groupes: Unite[][])}
    {#each groupes as g, n (n)}
      <span class="groupe">
        {#each g as u, i (i)}
          {#if u.touchable}
            <button class="s" class:touchee={touchee === u} onclick={() => toucher(u)}
              >{u.texte}</button
            >
          {:else}
            <span class="s muet">{u.texte}</span>
          {/if}
        {/each}
      </span>
    {/each}
  {/snippet}

  {#if v}
    {#if long}
      <div class="card sommaire">
        <button
          class="replier"
          aria-expanded={sommaireOuvert}
          onclick={() => (sommaireOuvert = !sommaireOuvert)}
        >
          <span class="k">Sommaire · {lus.length} lu{lus.length > 1 ? 's' : ''} sur {n}</span>
          <span class="k">{sommaireOuvert ? 'Replier' : 'Afficher'}</span>
        </button>
        {#if sommaireOuvert}
          <ol class="chapitres">
            {#each chapitres as c, j (j)}
              <li>
                <button class="chap" class:ici={j + 1 === k} onclick={() => choisir(j + 1)}>
                  <span class="num">{j + 1}</span>
                  <span class="grow">
                    {#if c.titre}<span class="hz" lang="zh-Hans">{c.titre}</span>{/if}
                    <span class="fr">{c.titre_fr}</span>
                  </span>
                  <span class="etat">{j + 1 === k ? 'ici' : lus.includes(j + 1) ? 'lu' : ''}</span>
                </button>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    {/if}

    {#if reste !== null}
      <p class="reste">
        {restants.length > 1
          ? `Il reste ${restants.length} chapitres à lire, à commencer par le ${reste}`
          : `Il reste le chapitre ${reste} à lire`} : le conte sera lu une fois tous ses chapitres lus.
      </p>
    {/if}

    <div class="card">
      {#if !entree.titre_zh && v.titre}
        <div class="read titre" lang="zh-Hans">{@render ligne(titre)}</div>
      {/if}
      {#if long && chapitre}
        <div class="read titre" lang="zh-Hans">{@render ligne(titreChapitre)}</div>
        {#if chapitre.titre_fr}<div class="chap-fr">{chapitre.titre_fr}</div>{/if}
      {/if}
      <div class="read texte" lang="zh-Hans">{@render ligne(texte)}</div>
      {#if signature}{@render signature()}{/if}
    </div>

    {#if trad}
      <div class="card">
        <button
          class="replier"
          aria-expanded={tradOuverte}
          onclick={() => (tradOuverte = !tradOuverte)}
        >
          <span class="k">Traduction</span>
          <span class="k">{tradOuverte ? 'Replier' : 'Afficher'}</span>
        </button>
        {#if tradOuverte}
          <div class="trad-pleine">{trad}</div>
        {/if}
      </div>
    {/if}

    <div class="foot">
      <div class="gloss" aria-live="polite">
        {#if touchee}
          <b class="hz">{touchee.texte}</b>
          {glose}
        {:else}
          Touche un caractère ou un mot.
        {/if}
      </div>
      <button class="btn" onclick={fini}>{long && k < n ? 'Chapitre suivant' : "J'ai lu"}</button>
    </div>
  {/if}
</main>

<style>
  /* le titre, puis le texte courant : les unités s'enchaînent et passent à la ligne */
  .titre,
  .texte {
    display: flex;
    flex-wrap: wrap;
  }
  h1.vrai {
    font-family: var(--hz);
    font-weight: 500;
    letter-spacing: 0.06em;
  }
  .verif-tete .py {
    font-style: italic;
    color: var(--ink2);
  }
  .verif-tete .fr {
    color: var(--ink2);
    margin-top: 2px;
  }
  .titre {
    font-size: 24px;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
  }
  .groupe {
    display: inline-flex;
    white-space: nowrap;
  }
  /* l'unité touchée reste soulignée, à l'indigo : on voit ce que dit la bande du bas */
  .read .s.touchee {
    border-color: var(--indigo);
  }
  .conte h1 {
    font-size: 24px;
  }
  .replier {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 44px;
    margin: -12px 0;
  }
  .replier + .trad-pleine {
    margin-top: 16px;
  }
  /* La bande du bas : la glose, puis le bouton, sur le papier, au-dessus du texte qui défile. */
  .conte .foot {
    background: var(--paper);
  }
  .conte .foot .gloss {
    margin: 0 0 10px;
    background: var(--card);
  }
  /* le titre français du chapitre, sous son titre chinois */
  .chap-fr {
    color: var(--ink2);
    margin: -2px 0 8px;
  }
  /* le sommaire d'un récit long : replié, une ligne ; ouvert, un chapitre par ligne */
  .chapitres {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
  }
  .chap {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 6px 0;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .chap .num {
    width: 24px;
    color: var(--mist);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .chap .hz {
    font-family: var(--hz);
    font-size: 18px;
    margin-right: 8px;
  }
  .chap .fr {
    color: var(--ink2);
  }
  .chap .etat {
    font-size: 13px;
    color: var(--mist);
    flex-shrink: 0;
  }
  /* le chapitre ouvert : un filet indigo, comme l'unité touchée */
  .chap.ici .num,
  .chap.ici .etat {
    color: var(--indigo);
    font-weight: 600;
  }
  .reste {
    color: var(--ink2);
    margin: 0 0 12px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
</style>
