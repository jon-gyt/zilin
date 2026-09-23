<script lang="ts">
  /**
   * L'écran hôte des jeux (stories 4b.1 et 4b.2) : le choix, une manche, le constat.
   * Tao y est dans la posture « joue », et le retour se fait vers Ma forêt ou le chemin.
   *
   * L'écran ne note rien lui-même : il pose ce que `jeux.ts` prépare et renvoie les
   * événements de révision, notés par `grade` de `srs.ts` comme une question de
   * révision. Le chronomètre borne un tour, il ne donne aucun point ; il n'y a ni vie,
   * ni classement, ni coffre. Les grands caractères viennent des traits (`Glyph`).
   * Chaque manche pose d'abord ce qu'on cherche, lisible d'un coup d'œil, puis les choix.
   */
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import {
    foretOnce,
    pairesExport,
    toutesLesFamilles,
    toutesLesFiches,
    traitsDeFamilles,
    voisinsOnce
  } from './content';
  import { racinesDesCaracteres } from './foret';
  import { lirePaires } from './questions';
  import { strokesOnce } from './strokes';
  import {
    FLASH_MS,
    JEUX,
    corpusDeJeu,
    corpusVide,
    disponibles,
    fini,
    glose,
    tour,
    type CorpusJeux,
    type JeuId,
    type Manche,
    type Resultat
  } from './jeux';
  import type { Progress, Revision } from './session';
  import { humeur, stade } from './tao';
  import { AVANCE_MS, VERDICTS, delai } from './revision';
  import { echeance } from './session';

  let {
    p,
    jeu = null,
    retour = 'home',
    onchoisir,
    onrepondu,
    onfini,
    onretour
  }: {
    p: Progress;
    /** Le jeu ouvert. `null` : l'écran montre le choix des jeux disponibles. */
    jeu?: JeuId | null;
    /** D'où l'on vient : le bouton de sortie y ramène. */
    retour?: 'home' | 'foret';
    onchoisir: (id: JeuId | null) => void;
    /** Un tour noté : l'événement de révision, rangé dans la progression. */
    onrepondu: (r: Revision) => void;
    /** La manche est finie : une activité « jeu » pour Tao. */
    onfini: () => void;
    onretour: () => void;
  } = $props();

  const OU = { home: "Revenir au chemin", foret: 'Revenir à ma forêt' };

  /** Pas de flash pour qui ne veut pas d'animation : les caractères restent affichés. */
  const reduit =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- le contenu servi avec l'app ---------- */

  let corpus = $state<CorpusJeux>(corpusVide());
  let chargee = $state(false);

  /**
   * Le corpus des jeux vient de l'export versionné : les fiches de `data/0.1.0/` (sens,
   * pinyin et décompositions canoniques), les paires à ne pas confondre de l'export, et
   * les tracés des familles concernées — un jeu ne montre que ce qu'il sait dessiner,
   * jamais un caractère en police. Le cercle de démonstration ne sert plus qu'à deux
   * choses, documentées dans `jeux.corpusDeJeu` : compléter un sens que le pipeline n'a
   * pas encore relu, et fournir un acquis de repli tant que la progression n'en a pas
   * assez pour jouer.
   */
  void (async () => {
    const [fiches, familles, voisins, foret, paires, demo] = await Promise.all([
      toutesLesFiches().catch(() => []),
      toutesLesFamilles().catch(() => []),
      voisinsOnce().catch(() => null),
      foretOnce().catch(() => null),
      pairesExport().catch(() => null),
      strokesOnce().catch(() => ({}))
    ]);
    const groupes = lirePaires(paires);
    const racines = racinesDesCaracteres(familles);
    /* Un premier corpus sans tracés, juste pour savoir quels caractères sont en jeu. */
    const pressenti = corpusDeJeu({ fiches, voisins, foret, paires: groupes, cartes: p.cartes });
    const voulus = new Set<string>([
      ...pressenti.acquis,
      ...groupes.flat(),
      ...Object.values(pressenti.decompositions).flat()
    ]);
    const aLire = [...voulus].flatMap((c) => {
      const r = racines.get(c);
      return r === undefined ? [] : [r];
    });
    const traits = await traitsDeFamilles(aLire).catch(() => ({}));
    corpus = corpusDeJeu({
      fiches,
      voisins,
      foret,
      paires: groupes,
      /* Les tracés de l'export d'abord, ceux de la maquette pour le reste. */
      traits: [...new Set([...Object.keys(traits), ...Object.keys(demo)])],
      cartes: p.cartes
    });
    chargee = true;
  })().catch(() => {
    chargee = true;
  });

  const dispo = $derived(chargee ? disponibles(corpus, p.day) : []);

  /* ---------- la manche ---------- */

  /** Les manches déjà jouées : la graine change, la manche suivante n'est pas la même. */
  let n = $state(0);
  /* Non réactif : c'est un garde-fou de préparation, pas un état de l'écran. */
  let preparee = '';
  let m = $state<Manche | null>(null);

  /* l'état d'un tour : ce qui est pris, le chrono, le flash, la correction */
  let pris = $state<number[]>([]);
  let depart = $state(0);
  let reste = $state(1);
  let cache = $state(false);
  /** Ce qui a été répondu au tour courant : la correction montre où l'on s'est trompé. */
  let donnee = $state<string[]>([]);
  let resultat = $state<Resultat | null>(null);

  let horloge: ReturnType<typeof setInterval> | null = null;
  let flash: ReturnType<typeof setTimeout> | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;

  function arreterChrono(): void {
    if (horloge !== null) clearInterval(horloge);
    horloge = null;
  }

  function arreter(): void {
    arreterChrono();
    if (flash !== null) clearTimeout(flash);
    if (minuteur !== null) clearTimeout(minuteur);
    flash = null;
    minuteur = null;
  }

  $effect(() => arreter);

  const t = $derived(m && !fini(m) ? tour(m) : null);
  const choisies = $derived(t ? pris.map((k) => t.choix[k]) : []);

  /** Ouvre un tour : le chronomètre repart, le flash montre la paire un instant. */
  function ouvrirTour(courante: Manche | null): void {
    arreter();
    pris = [];
    donnee = [];
    resultat = null;
    reste = 1;
    depart = Date.now();
    const id = courante?.jeu ?? null;
    if (id === null || courante === null || fini(courante)) return;
    const chrono = JEUX[id].chrono;
    /* Le flash : la paire paraît 700 ms, puis les caractères se couvrent. Sans
       animation demandée, ils restent affichés : l'écran est fixe, jamais de flash. */
    cache = false;
    if (id === 'jumeaux' && !reduit) flash = setTimeout(() => (cache = true), FLASH_MS);
    if (chrono > 0) {
      horloge = setInterval(() => {
        reste = Math.max(0, 1 - (Date.now() - depart) / chrono);
        if (reste === 0) valider([]);
      }, 100);
    }
  }

  /** Prépare la manche dès que le jeu change, et pas deux fois la même. */
  $effect(() => {
    const id = jeu;
    if (!chargee) return;
    if (id === null) {
      preparee = '';
      m = null;
      return;
    }
    const cle = `${p.day}/${id}/${n}`;
    if (preparee === cle) return;
    preparee = cle;
    const manche = JEUX[id].preparer(corpus, cle);
    m = manche;
    ouvrirTour(manche);
  });

  /**
   * Note la réponse. Le temps passé et les essais forment l'`Outcome` ; c'est `grade`
   * qui note. Une réponse vide, c'est le chronomètre écoulé : elle est fausse.
   */
  function valider(rep: string[]): void {
    const courante = m;
    if (courante === null || resultat !== null || fini(courante)) return;
    arreterChrono();
    const seconds = Math.max(0, (Date.now() - depart) / 1000);
    const r = JEUX[courante.jeu].repondre(courante, rep, { correct: true, tries: 0, seconds });
    donnee = rep;
    resultat = r;
    cache = false;
    onrepondu(r.evenement);
    if (r.correct) minuteur = setTimeout(suivant, AVANCE_MS);
  }

  /** Le tour suivant, ou le constat quand la manche est finie. */
  function suivant(): void {
    const r = resultat;
    if (r === null) return;
    arreter();
    m = r.manche;
    resultat = null;
    if (fini(r.manche)) onfini();
    else ouvrirTour(r.manche);
  }

  /** Une brique prise : quand le compte y est, la réponse part telle quelle. */
  function prendre(k: number): void {
    if (resultat !== null || t === null || pris.includes(k)) return;
    pris = [...pris, k];
    if (pris.length >= t.reponse.length) valider(pris.map((i) => t.choix[i]));
  }

  /** Une brique reposée, tant que la réponse n'est pas partie. */
  function reposer(rang: number): void {
    if (resultat !== null) return;
    pris = pris.filter((_, i) => i !== rang);
  }

  /** Une autre manche du même jeu : une nouvelle graine, pas la même suite. */
  function rejouer(): void {
    n += 1;
  }

  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));
  const jeuCourant = $derived(jeu ? JEUX[jeu] : null);
</script>

<main class="screen jeu">
  <button class="k quit" onclick={onretour}>✕ Quitter</button>

  {#if jeu === null}
    <h1>Jouer</h1>
    <p class="guide">
      Un jeu ne compte pas les points : il fait lire quelque chose de plus. Une à trois minutes,
      puis un constat.
    </p>
    <div class="mood">
      <Tao stade={taoStade} posture="jeu" humeur={taoHumeur} size={120} />
    </div>
    {#if dispo.length > 0}
      <div class="opt">
        {#each dispo as id (id)}
          <button onclick={() => onchoisir(id)}>
            <span class="grow">
              <span class="t">{JEUX[id].titre}</span>
              <span class="d">{JEUX[id].lit}</span>
            </span>
            <span class="k">{JEUX[id].minutes} min</span>
          </button>
        {/each}
      </div>
    {:else if chargee}
      <p class="guide">
        Il n'y a pas encore assez de caractères acquis pour jouer. Reviens après quelques
        révisions.
      </p>
    {/if}
    <div class="foot"><button class="btn ghost" onclick={onretour}>{OU[retour]}</button></div>
  {:else if m === null}
    <p class="guide">
      {chargee ? "Ce jeu n'a pas pu être préparé." : 'Un instant.'}
    </p>
    <div class="foot">
      <button class="btn" onclick={() => onchoisir(null)}>Choisir un autre jeu</button>
    </div>
  {:else if t !== null}
    <div class="verif-tete">
      <Tao stade={taoStade} posture="jeu" humeur={taoHumeur} size={72} />
      <p class="guide grow">{jeuCourant?.titre}</p>
    </div>

    <div class="tours k" aria-label="Avancement de la manche">
      {#each m.tours as _, k (k)}
        <i class:on={k < m.i} class:cur={k === m.i}></i>
      {/each}
    </div>

    <div class="q">
      {#if jeu === 'assembler'}
        {#if jeuCourant && jeuCourant.chrono > 0}
          <div class="chrono" aria-label="Le temps du tour">
            <i style="width:{Math.round(reste * 100)}%"></i>
          </div>
        {/if}
        <!-- La cible en grand : ce qu'on cherche, avant les briques. -->
        {@const g = glose(t.c, corpus)}
        <div class="jeu-cible">
          {#if g.fr !== ''}<b>« {g.fr} »</b>{/if}
          {#if g.pinyin !== ''}<span class="py">{g.pinyin}</span>{/if}
        </div>
        <p class="consigne">
          Touche les {t.reponse.length} briques dans l'ordre d'écriture pour former ce caractère :
        </p>
        <div class="assemblee">
          {#if resultat !== null}
            <!-- La réponse : les briques dans l'ordre d'écriture, et ce qu'elles font. -->
            {#each t.reponse as b, rang (b + rang)}
              {#if rang > 0}<span class="op">+</span>{/if}
              <span class="tuile"><Glyph char={b} size={48} write={false} color="var(--ocre)" /></span>
            {/each}
            <span class="op">=</span>
            <span class="tuile faite"><Glyph char={t.c} size={48} write={false} /></span>
          {:else}
            {#each choisies as b, rang (b + rang)}
              {#if rang > 0}<span class="op">+</span>{/if}
              <button class="tuile prise" aria-label="Reposer {b}" onclick={() => reposer(rang)}>
                <Glyph char={b} size={48} write={false} color="var(--ocre)" />
              </button>
            {/each}
            {#each { length: Math.max(0, t.reponse.length - choisies.length) } as _, k (k)}
              {#if choisies.length + k > 0}<span class="op">+</span>{/if}
              <span class="tuile vide" aria-label="brique à poser"></span>
            {/each}
            <span class="op">=</span>
            <span class="tuile vide inconnu" aria-hidden="true">?</span>
          {/if}
        </div>
        <div class="choices vrac">
          {#each t.choix as b, k (b + k)}
            <button
              class:pris={resultat === null && pris.includes(k)}
              class:ok={resultat !== null && t.reponse.includes(b)}
              disabled={resultat !== null || pris.includes(k)}
              aria-label={b}
              onclick={() => prendre(k)}
            >
              <Glyph char={b} size={44} write={false} />
            </button>
          {/each}
        </div>
      {:else}
        <p class="consigne">{t.enonce}</p>
        <div class="choices deux">
          {#each t.choix as c, k (c + k)}
            <button
              class:ok={resultat !== null && c === t.reponse[0]}
              class:ko={resultat !== null && !resultat.correct && donnee[0] === c}
              disabled={resultat !== null}
              aria-label={c}
              onclick={() => valider([c])}
            >
              <span class="flash" class:cache>
                <Glyph char={c} size={72} write={false} />
              </span>
            </button>
          {/each}
        </div>
        {#if cache && resultat === null}
          <p class="k">Les deux caractères se sont couverts. Lequel était-ce ?</p>
        {/if}
      {/if}

      <div class="fb" class:vide={resultat === null}>
        {#if resultat !== null}
          <b>{resultat.montre ? 'On te montre.' : VERDICTS[resultat.note]}</b>
          {@const quand = echeance(p, resultat.evenement.c)}
          {#if quand}<span class="next">Prochaine fois : dans {delai(new Date(), quand)}.</span>{/if}
        {/if}
      </div>
    </div>

    <div class="foot">
      <button class="btn" disabled={resultat === null} onclick={suivant}>
        {resultat !== null && fini(resultat.manche) ? 'Voir le constat' : 'Suivant'}
      </button>
    </div>
  {:else}
    <div class="mood">
      <Tao stade={taoStade} posture="jeu" humeur={taoHumeur} size={96} />
    </div>
    <div class="card center bilan">
      <h1>{jeuCourant?.titre}</h1>
      <p class="constat">{jeuCourant?.constat(m)}</p>
      <div class="k">Ce qui vient d'être revu repasse dans tes révisions, aux échéances dites.</div>
    </div>
    <div class="foot">
      <button class="btn" onclick={onretour}>{OU[retour]}</button>
      <div class="acts">
        <button class="btn ghost" onclick={rejouer}>Une autre manche</button>
        <button class="btn ghost" onclick={() => onchoisir(null)}>Un autre jeu</button>
      </div>
    </div>
  {/if}
</main>
