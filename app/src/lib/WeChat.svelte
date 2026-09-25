<script lang="ts">
  /**
   * Le message WeChat (story 4b.7), dans l'écran hôte des jeux : le choix d'un message,
   * puis la conversation avec l'ami, puis le constat.
   *
   * Tout le texte vient de `wechat.json` (`wechat.ts`) : l'ami, ses messages, les
   * répliques, leurs traductions et le pinyin de chaque caractère. Les bulles sont des
   * phrases, en Noto Serif SC ; seul le caractère clé de chaque message, dans la liste,
   * est dessiné depuis ses traits. Toucher un caractère d'une bulle montre son pinyin.
   *
   * L'ami écrit à gauche, sur la carte ; la réplique choisie s'ajoute à droite, sur
   * l'indigo pâle. Ni photo, ni emoji, ni ombre, ni dégradé ; pas de cinabre : une
   * réplique écartée passe en pointillé, sans couleur d'alerte. Tao lit par-dessus
   * l'épaule (`lecture`).
   *
   * L'écran ne note rien lui-même : `choisirReplique` dit ce qui se note. Une mauvaise
   * réplique n'émet aucun événement ; une bonne, du premier coup, note ses caractères par
   * `grade`. Pas de chronomètre, pas de vie, pas de point.
   */
  import { tick } from 'svelte';
  import FilWechat from './FilWechat.svelte';
  import Glyph from './Glyph.svelte';
  import RepliquesWechat from './RepliquesWechat.svelte';
  import Tao from './Tao.svelte';
  import { JEUX, fini, type CorpusJeux, type Manche } from './jeux';
  import { delai } from './revision';
  import { echeance, type Progress, type Revision } from './session';
  import { humeur, stade } from './tao';
  import {
    LIGNE_ERREUR,
    choisirReplique,
    dialoguesJouables,
    mancheWechat,
    manquants,
    prochains,
    replique,
    type Bulle,
    type Dialogue
  } from './wechat';

  let {
    p,
    corpus,
    retour,
    onrepondu,
    onfini,
    onautre,
    onretour
  }: {
    p: Progress;
    corpus: CorpusJeux;
    /** Le libellé du bouton qui ramène d'où l'on vient. */
    retour: string;
    onrepondu: (r: Revision) => void;
    /** Le dialogue est mené à bout : une activité « jeu » pour Tao. */
    onfini: () => void;
    /** Revenir au choix des jeux. */
    onautre: () => void;
    onretour: () => void;
  } = $props();

  /** Sans animation demandée, l'ami répond presque aussitôt et le fil ne glisse pas. */
  const reduit =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Le temps que l'ami met à répondre : de quoi voir sa propre réplique partir. */
  const REPONSE_MS = reduit ? 250 : 900;

  const w = $derived(corpus.wechat ?? null);
  const ami = $derived(w?.donnees.ami ?? { zh: '', pinyin: '', fr: '', en: '' });
  const jouables = $derived(w ? dialoguesJouables(w) : []);
  const bientot = $derived(w ? prochains(w, 3) : []);
  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));

  let dialogue = $state<Dialogue | null>(null);
  let m = $state<Manche | null>(null);
  let fil = $state<Bulle[]>([]);
  /** Les répliques fausses déjà choisies au tour courant, écartées. */
  let ecartees = $state<string[]>([]);
  /** La dernière réplique fausse choisie : la ligne du bas dit ce qui cloche. */
  let fausse = $state<string | null>(null);
  /** La dernière bonne réplique : du premier coup ou non, et ce qu'elle a noté. */
  let notee = $state<{ premier: boolean; notes: string[] } | null>(null);
  /** L'ami écrit : sa bulle arrive. */
  let attente = $state(false);
  let bas = $state<HTMLElement | null>(null);
  let depart = 0;
  let n = $state(0);
  let minuteur: ReturnType<typeof setTimeout> | null = null;

  function arreter(): void {
    if (minuteur !== null) clearTimeout(minuteur);
    minuteur = null;
  }
  $effect(() => arreter);

  const echange = $derived(dialogue && m && !fini(m) ? dialogue.echanges[m.i] : null);
  const choix = $derived(m && !fini(m) ? m.tours[m.i].choix : []);
  const termine = $derived(m !== null && fini(m) && !attente);

  /** Le fil descend jusqu'à ce qui vient d'arriver. */
  async function defiler(): Promise<void> {
    await tick();
    bas?.scrollIntoView({ block: 'end', behavior: reduit ? 'auto' : 'smooth' });
  }

  function ouvrir(d: Dialogue): void {
    arreter();
    n += 1;
    dialogue = d;
    m = mancheWechat(d, `${p.day}/wechat/${d.id}/${n}`);
    fil = [{ de: 'ami', t: d.echanges[0].ami, cle: 'a0', tour: 0 }];
    ecartees = [];
    fausse = null;
    notee = null;
    attente = false;
    depart = Date.now();
    void defiler();
  }

  function liste(): void {
    arreter();
    dialogue = null;
    m = null;
    fil = [];
  }

  /**
   * Une réplique touchée. Fausse : écartée, rien n'est noté. Juste : elle part dans le
   * fil, ses caractères sont notés si elle a été trouvée du premier coup, et l'ami répond.
   */
  function choisir(zh: string): void {
    const courante = m;
    const e = echange;
    const d = dialogue;
    if (courante === null || e === null || d === null || attente || ecartees.includes(zh)) return;
    const seconds = Math.max(0, (Date.now() - depart) / 1000);
    const r = choisirReplique(courante, zh, ecartees, seconds);
    if (!r.juste) {
      ecartees = r.ecartees;
      fausse = zh;
      return;
    }
    for (const ev of r.evenements) onrepondu(ev);
    notee = { premier: ecartees.length === 0, notes: r.evenements.map((ev) => ev.c) };
    const t = replique(e, zh);
    if (t) fil = [...fil, { de: 'moi', t, cle: `m${courante.i}`, tour: courante.i }];
    ecartees = [];
    fausse = null;
    m = r.manche;
    attente = true;
    void defiler();
    minuteur = setTimeout(() => {
      minuteur = null;
      attente = false;
      const suite = r.manche;
      if (fini(suite)) {
        if (d.fin) fil = [...fil, { de: 'ami', t: d.fin, cle: 'fin', tour: suite.i }];
        onfini();
      } else {
        fil = [...fil, { de: 'ami', t: d.echanges[suite.i].ami, cle: `a${suite.i}`, tour: suite.i }];
        depart = Date.now();
      }
      void defiler();
    }, REPONSE_MS);
  }

  /** Une bulle se traduit une fois l'échange répondu : on lit d'abord, le sens vient après. */
  function traduite(b: Bulle): boolean {
    return b.de === 'moi' || m === null || b.tour < m.i || fini(m);
  }

  const quand = $derived.by(() => {
    const c = notee?.notes[0];
    const q = c ? echeance(p, c) : null;
    return q ? delai(new Date(), q) : '';
  });
</script>

{#if w === null}
  <p class="guide">Un instant.</p>
{:else if dialogue === null}
  <div class="tete">
    <div class="grow">
      <div class="eyebrow">Jouer</div>
      <h1>Le message WeChat</h1>
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={72} />
  </div>
  <p class="guide">
    <span class="hz" lang="zh-Hans">{ami.zh}</span>, {ami.fr}, t’écrit en chinois. Choisis la
    réplique qui lui répond. Un message s’ouvre quand tous ses caractères sont acquis.
  </p>
  <div class="opt messages">
    {#each jouables as d (d.id)}
      <button onclick={() => ouvrir(d)}>
        <span class="vignette"><Glyph char={d.cle} size={34} write={false} pistes={[d.famille]} /></span>
        <span class="grow">
          <span class="t">{d.fr}</span>
          <span class="d apercu hz" lang="zh-Hans">{d.echanges[0].ami.zh}</span>
        </span>
      </button>
    {/each}
    {#each bientot as d (d.id)}
      {@const reste = manquants(d, w.acquis)}
      <!-- Pas encore : ce qu'il reste à lire, en une ligne neutre. -->
      <button class="indispo" disabled>
        <span class="vignette"><Glyph char={d.cle} size={34} write={false} pistes={[d.famille]} /></span>
        <span class="grow">
          <span class="t">{d.fr}</span>
          <span class="d">
            Encore {reste.length}
            {reste.length === 1 ? 'caractère' : 'caractères'} à acquérir :
            <span class="hz" lang="zh-Hans">{reste.slice(0, 6).join(' ')}{reste.length > 6 ? '…' : ''}</span>
          </span>
        </span>
      </button>
    {/each}
  </div>
  <div class="foot fond">
    <button class="btn ghost" onclick={onautre}>Un autre jeu</button>
  </div>
{:else}
  <div class="tete fil-tete">
    <div class="grow">
      <div class="eyebrow">{dialogue.fr}</div>
      <p class="nom-ami">
        <span class="hz" lang="zh-Hans">{ami.zh}</span>
        <span class="py">{ami.pinyin}</span>
        <span class="qui">{ami.fr}</span>
      </p>
    </div>
    <Tao stade={taoStade} posture="lecture" humeur={taoHumeur} size={56} />
  </div>

  <!-- La conversation : l'ami à gauche, la réplique choisie à droite. Une conversation
       neuve repart sans pinyin ouvert. -->
  {#key dialogue.id + '/' + n}
    <FilWechat
      {fil}
      {ami}
      attente={attente && m !== null && !(fini(m) && !dialogue.fin)}
      {traduite}
    />
  {/key}

  {#if echange !== null && !attente}
    <RepliquesWechat {echange} {choix} {ecartees} onchoisir={choisir} />
    <div class="fb">
      {#if fausse !== null}
        {@const r = replique(echange, fausse)}
        <b>Ça ne lui répond pas.</b>
        {r ? LIGNE_ERREUR[r.erreur] : ''} Rien n’est noté.
      {:else if notee !== null}
        {#if notee.premier && notee.notes.length > 0}
          <b>Du premier coup.</b>
          <span class="hz" lang="zh-Hans">{notee.notes.join(' ')}</span> revus.
          {#if quand}<span class="next">Prochaine fois : dans {quand}.</span>{/if}
        {:else if notee.premier}
          <b>Du premier coup.</b> Rien de neuf à noter dans cette réplique.
        {:else}
          <b>Trouvée.</b> Après un essai, rien n’est noté.
        {/if}
      {:else}
        Touche un caractère pour son pinyin, puis choisis ta réplique.
      {/if}
    </div>
  {/if}

  {#if termine && m !== null}
    <div class="card center bilan">
      <p class="constat">{JEUX.wechat.constat(m)}</p>
      <div class="k">Ce qui vient d’être revu repasse dans tes révisions, aux échéances dites.</div>
    </div>
    <div class="foot fond">
      <button class="btn" onclick={liste}>Un autre message</button>
      <div class="acts">
        <button class="btn ghost" onclick={onretour}>{retour}</button>
        <button class="btn ghost" onclick={onautre}>Un autre jeu</button>
      </div>
    </div>
  {/if}
  <div class="ancre" bind:this={bas}></div>
{/if}

<style>
  /* Le message WeChat, dans l'esprit de la cuisine : un en-tête, Tao à droite. Aucune
     ombre, aucun dégradé, aucun cinabre : l'indigo pâle marque ce qu'on a répondu. */
  .fond {
    background: var(--paper);
  }
  .tete {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding-bottom: 12px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--rule);
  }
  .tete h1 {
    margin: 0;
    font-size: 26px;
  }
  .fil-tete {
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .eyebrow {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
    margin-bottom: 4px;
  }
  .nom-ami {
    margin: 0;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 8px;
  }
  .nom-ami .hz {
    font-size: 22px;
    color: var(--ink);
  }
  .nom-ami .py {
    font-family: var(--head);
    font-weight: 500;
    color: var(--indigo);
  }
  .nom-ami .qui {
    font-size: 14px;
    color: var(--ink2);
  }
  .guide .hz {
    font-size: 18px;
    color: var(--ink);
  }
  .messages button {
    text-align: left;
  }
  .messages .apercu {
    font-size: 16px;
    color: var(--ink2);
    line-height: 1.4;
  }
  .messages .d .hz {
    font-size: 14px;
    letter-spacing: 0.08em;
  }
  .indispo {
    opacity: 0.55;
  }

  .fb .hz {
    font-size: 17px;
  }
  .bilan {
    margin-top: 16px;
  }
  .ancre {
    height: 1px;
    scroll-margin-bottom: 16px;
  }
</style>
