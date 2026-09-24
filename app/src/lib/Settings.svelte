<script lang="ts">
  /**
   * Réglages : l'ossature. Le rythme, les révisions (rétention cible FSRS), le tracé,
   * et la progression qui s'exporte et se réimporte en JSON. Un seul thème, le papier
   * clair : il n'y a rien à régler.
   *
   * Ni compte, ni réseau : le fichier est écrit et relu par le navigateur, la
   * progression reste dans IndexedDB.
   */
  import { exportProgress, importProgress } from './db';
  import {
    REGLAGES_RETENTION,
    effetRetention,
    setBudget,
    setRetention,
    setTrace,
    type Budget,
    type Progress
  } from './session';

  let {
    p,
    onprogression
  }: { p: Progress; onprogression: (p: Progress) => void } = $props();

  const BUDGETS: Budget[] = [5, 10, 20];

  let fichier: HTMLInputElement | undefined = $state();
  let mot = $state('');

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
  <h1>Réglages</h1>

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
</main>
