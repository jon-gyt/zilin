<script lang="ts">
  /**
   * Réglages : l'ossature. Le personnage (changer de bête ou de nom, sans rien perdre),
   * le rythme, les révisions (rétention cible FSRS), le tracé, le mode relecture, et la
   * progression qui s'exporte et se réimporte en JSON. Un seul thème, le papier clair : il
   * n'y a rien à régler.
   *
   * Ni compte, ni réseau : le fichier est écrit et relu par le navigateur, la
   * progression reste dans IndexedDB.
   */
  import { exportProgress, importProgress } from './db';
  import ChoixHeros from './ChoixHeros.svelte';
  import Heros from './Heros.svelte';
  import { beteDe, herosOnce, rangDe, sansArticle, total, type BeteId, type HerosDonnees } from './heros';
  import { stade } from './tao';
  import { haptiqueDisponible } from './haptique';
  import { autorisationRefusee, demanderAutorisation, instant, notificationsDisponibles } from './natif';
  import { HEURE_DEFAUT, SANS_TEXTES, heureValide, rappelsOnce, reglerRappel, setRappel, type TextesRappels } from './rappels';
  import {
    choisirHeros,
    REGLAGES_RETENTION,
    effetRetention,
    setHaptique,
    setRelecture,
    setBudget,
    setRetention,
    setTrace,
    type Budget,
    type Progress
  } from './session';

  let {
    p,
    onprogression,
    onretour
  }: {
    p: Progress;
    onprogression: (p: Progress) => void;
    /** Réglages s'ouvre par l'icône du menu ; un seul retour, vers le menu. */
    onretour: () => void;
  } = $props();

  const BUDGETS: Budget[] = [5, 10, 20];

  let fichier: HTMLInputElement | undefined = $state();
  let mot = $state('');

  /* ---------- le personnage ---------- */

  let donnees = $state<HerosDonnees | null>(null);
  $effect(() => {
    let vivant = true;
    void herosOnce()
      .then((d) => {
        if (vivant) donnees = d;
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  });
  /** Le choix rouvert : la bête et le nom se changent, les points et le rang restent. */
  let changer = $state(false);
  const rang = $derived(donnees ? rangDe(total(p.arts), donnees.rangs) : 0);
  const bete = $derived(donnees && p.heros ? beteDe(donnees, p.heros.bete) : null);

  function choisir(b: BeteId, nom: string): void {
    onprogression(choisirHeros(p, b, nom, rang));
    changer = false;
  }

  function choisirBudget(b: Budget): void {
    onprogression(setBudget(p, b));
  }

  /** La rétention cible : trois positions nommées, sans jargon. Rangée avec la progression. */
  function choisirRetention(r: number): void {
    onprogression(setRetention(p, r));
  }

  function choisirTrace(): void {
    onprogression(setTrace(p, !p.trace));
  }

  /**
   * Le mode relecture : les fiches et les contes que le pipeline a écrits et que personne n'a
   * encore relus (« à relire »), et les contes que l'acquis n'ouvre pas encore (« pas encore
   * dans ton acquis »). Éteint par défaut ; ce qu'il ouvre ne compte pas comme lu.
   */
  function choisirRelecture(): void {
    onprogression(setRelecture(p, !p.relecture));
  }

  /**
   * Le retour haptique : dans l'app iOS seulement, où il existe. Apple demande qu'on puisse
   * l'éteindre ; allumé par défaut.
   */
  const haptique = haptiqueDisponible();

  function choisirHaptique(): void {
    onprogression(setHaptique(p, !p.haptique));
  }

  /*
   * Le rappel quotidien : dans l'app iOS seulement, où la notification existe. Ses textes
   * viennent de `rappels.json` ; sans eux, la ligne ne s'affiche pas.
   */
  const rappelPossible = notificationsDisponibles();
  let textesRappels: TextesRappels = $state(SANS_TEXTES);
  /** L'iPhone a coupé les notifications de Wenlu : on dit où les rendre, sans insister. */
  let refusee = $state(false);

  $effect(() => {
    let vivant = true;
    void rappelsOnce()
      .then((t) => {
        if (vivant) textesRappels = t;
      })
      .catch(() => undefined);
    if (rappelPossible) {
      void autorisationRefusee().then((r) => {
        if (vivant) refusee = r;
      });
    }
    return () => {
      vivant = false;
    };
  });

  /** Allumer demande l'accord de l'iPhone ; refusé, l'interrupteur reste éteint. */
  async function basculerRappel(): Promise<void> {
    const heure = p.rappel.heure ?? HEURE_DEFAUT;
    const actif = !p.rappel.actif && (await demanderAutorisation());
    refusee = !p.rappel.actif && !actif;
    const { jour, minute } = instant();
    onprogression(setRappel(p, reglerRappel(p.rappel, { actif, heure }, jour, minute)));
  }

  function changerHeure(e: Event): void {
    const heure = (e.target as HTMLInputElement).value;
    if (!heureValide(heure)) return;
    const { jour, minute } = instant();
    onprogression(setRappel(p, reglerRappel(p.rappel, { actif: p.rappel.actif, heure }, jour, minute)));
  }

  /** Export : un fichier JSON, téléchargé depuis le navigateur. */
  async function exporter(): Promise<void> {
    const texte = await exportProgress(p.day);
    const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wenlu-${p.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mot = 'Progression exportée.';
  }

  /** Import : le fichier choisi remplace la progression, telle quelle. */
  async function importer(e: Event): Promise<void> {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const nouvelle = await importProgress(await f.text(), p.day);
      onprogression(nouvelle);
      mot = 'Progression importée.';
    } catch {
      mot = "Ce fichier n'est pas une progression Wenlu.";
    }
    if (fichier) fichier.value = '';
  }
</script>

<main class="screen">
  {#if changer && donnees}
  <button class="k quit" onclick={() => (changer = false)}>‹ Réglages</button>
  <ChoixHeros {donnees} initial={p.heros} surtitre="Changer de personnage" stade={stade(p.tao.croissance)} garder onchoisi={choisir} />
  {:else}
  <button class="k quit" onclick={onretour}>‹ Retour</button>
  <h1>Réglages</h1>

  {#if donnees && donnees.betes.length > 0}
    <div class="card perso">
      {#if p.heros}
        <span class="portrait"><Heros bete={p.heros.bete} {rang} cadre="portrait" largeur={46} /></span>
      {/if}
      <div class="grow">
        <div>{p.heros ? p.heros.nom : 'Personnage'}</div>
        <div class="k">
          {#if p.heros}
            {bete ? `${bete.hz} ${sansArticle(bete.fr)}` : ''}{donnees.rangs[rang] ? ` · ${donnees.rangs[rang].hz}` : ''} ·
            change de bête ou de nom sans rien perdre
          {:else}
            Pas encore choisi : trois bêtes, un nom
          {/if}
        </div>
      </div>
      <button class="btn ghost changer" onclick={() => (changer = true)}>{p.heros ? 'Changer' : 'Choisir'}</button>
    </div>
  {/if}

  <div class="card">
    <div class="tog">
      <div><div>Rythme</div><div class="k">Le budget d'une session</div></div>
      <div class="seg">
        {#each BUDGETS as b (b)}
          <button class:on={p.budget === b} onclick={() => choisirBudget(b)}>{b} min</button>
        {/each}
      </div>
    </div>
    <div class="tog pile">
      <div>
        <div>Révisions</div>
        <div class="k">{effetRetention(p.retention)}</div>
      </div>
      <div class="seg" role="group" aria-label="Révisions">
        {#each REGLAGES_RETENTION as r (r.retention)}
          <button
            class:on={Math.abs(p.retention - r.retention) < 0.001}
            aria-pressed={Math.abs(p.retention - r.retention) < 0.001}
            onclick={() => choisirRetention(r.retention)}>{r.t}</button
          >
        {/each}
      </div>
    </div>
    <div class="tog">
      <div>
        <div>Tracé des briques</div>
        <div class="k">Proposé une fois par brique, jamais pour un composé</div>
      </div>
      <button
        class="sw"
        class:on={p.trace}
        role="switch"
        aria-checked={p.trace}
        aria-label="Tracé des briques"
        onclick={choisirTrace}
      ></button>
    </div>
    <div class="tog">
      <div>
        <div>Mode relecture</div>
        <div class="k">
          Ouvre aussi les textes à relire et les contes pas encore lisibles, chacun signalé. Ce
          qui s'y lit ne compte pas.
        </div>
      </div>
      <button
        class="sw"
        class:on={p.relecture}
        role="switch"
        aria-checked={p.relecture}
        aria-label="Mode relecture"
        onclick={choisirRelecture}
      ></button>
    </div>
    {#if haptique}
      <div class="tog">
        <div>
          <div>Retour haptique</div>
          <div class="k">Un léger tap sur une bonne réponse, jamais sur une erreur</div>
        </div>
        <button
          class="sw"
          class:on={p.haptique}
          role="switch"
          aria-checked={p.haptique}
          aria-label="Retour haptique"
          onclick={choisirHaptique}
        ></button>
      </div>
    {/if}
    {#if rappelPossible && textesRappels.reglage !== ''}
      <div class="tog">
        <div>
          <div>{textesRappels.reglage}</div>
          <div class="k">{textesRappels.reglage_detail}</div>
        </div>
        <button
          class="sw"
          class:on={p.rappel.actif}
          role="switch"
          aria-checked={p.rappel.actif}
          aria-label={textesRappels.reglage}
          onclick={basculerRappel}
        ></button>
      </div>
      {#if p.rappel.actif}
        <div class="tog">
          <label for="heure-rappel">{textesRappels.reglage_heure}</label>
          <input id="heure-rappel" class="heure" type="time" value={p.rappel.heure ?? HEURE_DEFAUT} onchange={changerHeure} />
        </div>
      {:else if refusee}
        <div class="k refus">{textesRappels.reglage_refuse}</div>
      {/if}
    {/if}
  </div>

  <div class="card">
    <div class="k" style="margin-bottom:10px">
      Ta progression reste sur cet appareil. Pas de compte, aucune requête réseau.
    </div>
    <div class="acts">
      <button class="btn ghost" onclick={exporter}>Exporter en JSON</button>
      <button class="btn ghost" onclick={() => fichier?.click()}>Importer un fichier</button>
    </div>
    <input
      class="cache"
      type="file"
      accept="application/json,.json"
      bind:this={fichier}
      onchange={importer}
      aria-label="Fichier de progression"
    />
    {#if mot}<div class="k retour">{mot}</div>{/if}
  </div>
  {/if}
</main>

<style>
  .heure {
    font: inherit;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 6px 10px;
    min-height: 40px;
  }
  .refus {
    margin-top: 6px;
  }
  .perso {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .portrait {
    width: 50px;
    height: 50px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    line-height: 0;
  }
  .changer {
    width: auto;
    min-height: 40px;
    flex-shrink: 0;
  }
</style>
