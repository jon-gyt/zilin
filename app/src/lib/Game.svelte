<script lang="ts">
  /**
   * L'écran hôte des jeux (stories 4b.1 à 4b.3, et 4b.5 pour la devinette du jour) : le
   * choix, une manche, le constat. Tao y est dans la posture « joue », la lanterne à la
   * main, et le retour se fait vers Ma forêt ou le chemin.
   *
   * La devinette du jour passe en tête : une par jour, posée à l'ouverture, deux essais,
   * puis la correction par les briques. Son énoncé, ses leurres et le nom des briques
   * viennent de `devinettes.json` ; l'écran n'en écrit aucun.
   *
   * L'écran ne note rien lui-même : il pose ce que `jeux.ts` prépare et renvoie les
   * événements de révision, notés par `grade` de `srs.ts` comme une question de
   * révision. Le chronomètre borne un tour, il ne donne aucun point ; il n'y a ni vie,
   * ni classement, ni coffre. Les grands caractères viennent des traits (`Glyph`).
   * Chaque manche pose d'abord ce qu'on cherche, lisible d'un coup d'œil, puis les choix.
   *
   * Le dictionnaire éclair (4b.4) est posé par `EclairTour` : un mot jamais appris, ses
   * deux caractères acquis, quatre sens. Deviné, il entre dans le compteur « mots
   * devinés » de la progression, que l'écran de choix montre d'une ligne.
   */
  import EclairTour from './EclairTour.svelte';
  import Glyph from './Glyph.svelte';
  import Tao from './Tao.svelte';
  import {
    devinettesOnce,
    foretOnce,
    pairesExport,
    toutesLesFamilles,
    toutesLesFiches,
    traitsDeFamilles,
    voisinsOnce
  } from './content';
  import { eclairOnce, ligneMotsDevines, TAO_ECLAIR } from './eclair';
  import { racinesDesCaracteres } from './foret';
  import { coquillesOnce } from './coquilles';
  import { lirePaires } from './questions';
  import { strokesOnce } from './strokes';
  import {
    FLASH_MS,
    IDS,
    JEUX,
    clore,
    corpusDeJeu,
    corpusVide,
    devinetteDe,
    devinetteDuJour,
    disponibles,
    essayer,
    fini,
    glose,
    nomDeBrique,
    postureDuJeu,
    signes,
    tour,
    type CorpusJeux,
    type JeuId,
    type Manche,
    type Resultat
  } from './jeux';
  import { devinetteFaite, type IssueDevinette, type Progress, type Revision } from './session';
  import { humeur, stade } from './tao';
  import { AVANCE_MS, VERDICTS, delai } from './revision';
  import { echeance } from './session';

  let {
    p,
    jeu = null,
    retour = 'home',
    onchoisir,
    onrepondu,
    ondevinette = () => undefined,
    onmotdevine = () => undefined,
    onfini,
    onretour
  }: {
    p: Progress;
    /** Le jeu ouvert. `null` : l'écran montre le choix des jeux disponibles. */
    jeu?: JeuId | null;
    /** D'où l'on vient : le bouton de sortie y ramène. */
    retour?: 'home' | 'foret';
    onchoisir: (id: JeuId | null) => void;
    /** Un événement de révision noté, rangé dans la progression. Un tour peut en rendre plusieurs. */
    onrepondu: (r: Revision) => void;
    /** La devinette du jour : posée à l'ouverture, puis résolue ou montrée. */
    ondevinette?: (id: string, issue: IssueDevinette) => void;
    /** Le dictionnaire éclair : un mot deviné, que le compteur range une fois. */
    onmotdevine?: (id: string) => void;
    /** La manche est finie : une activité « jeu » pour Tao. */
    onfini: () => void;
    onretour: () => void;
  } = $props();

  const OU = { home: 'Revenir au menu', foret: 'Revenir à ma forêt' };

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
    const [fiches, familles, voisins, foret, paires, demo, devinettes, eclair] = await Promise.all([
      toutesLesFiches().catch(() => []),
      toutesLesFamilles().catch(() => []),
      voisinsOnce().catch(() => null),
      foretOnce().catch(() => null),
      pairesExport().catch(() => null),
      strokesOnce().catch(() => ({})),
      devinettesOnce().catch(() => null),
      eclairOnce().catch(() => null)
    ]);
    /* Les messages rédigés de la coquille (`coquilles.json`) : l'écran n'en écrit aucun. */
    const coquilles = await coquillesOnce();
    const groupes = lirePaires(paires);
    const racines = racinesDesCaracteres(familles);
    /* La devinette du jour, si elle est déjà posée : elle le reste toute la journée. */
    const lanternes = {
      devinettes,
      resolues: p.devinettes,
      posee: p.devinetteDuJour?.jour === p.day ? p.devinetteDuJour.id : null
    };
    /* Le dictionnaire éclair : ses mots, les mots déjà devinés. */
    const eclairs = { eclair, devines: p.motsDevines };
    /* Un premier corpus sans tracés, juste pour savoir quels caractères sont en jeu. */
    const pressenti = corpusDeJeu({
      fiches,
      voisins,
      foret,
      paires: groupes,
      cartes: p.cartes,
      ...lanternes,
      ...eclairs
    });
    /* Les devinettes qui pourraient se poser : leur réponse, leurs briques, leurs leurres. */
    const connus = new Set(pressenti.lanternes?.connus ?? []);
    const aDessiner = (devinettes?.devinettes ?? [])
      .filter(
        (d) =>
          d.id === lanternes.posee || (connus.has(d.c) && d.briques.every((b) => connus.has(b)))
      )
      .flatMap((d) => [d.c, ...d.briques, ...d.leurres]);
    /* Le dictionnaire éclair ne dessine que des caractères acquis, ceux de ses mots. */
    const acquisReel = new Set(pressenti.eclair?.acquis ?? []);
    const motsADessiner = (eclair?.mots ?? []).flatMap((x) =>
      [...x.mot].every((c) => acquisReel.has(c)) ? [...x.mot] : []
    );
    const voulus = new Set<string>([
      ...pressenti.acquis,
      ...motsADessiner,
      ...groupes.flat(),
      ...Object.values(pressenti.decompositions).flat(),
      ...aDessiner,
      /* Les messages de la coquille que l'acquis permet de lire. */
      ...coquilles.coquilles
        .map((q) => signes(q.message))
        .filter((s) => s.every((c) => pressenti.acquis.includes(c)))
        .flat()
    ]);
    const aLire = [...voulus].flatMap((c) => {
      const r = devinettes?.racines[c] ?? eclair?.racines[c] ?? coquilles.racines[c] ?? racines.get(c);
      return r === undefined ? [] : [r];
    });
    const traits = await traitsDeFamilles([...new Set(aLire)]).catch(() => ({}));
    corpus = corpusDeJeu({
      fiches,
      voisins,
      foret,
      paires: groupes,
      /* Les tracés de l'export d'abord, ceux de la maquette pour le reste. */
      traits: [...new Set([...Object.keys(traits), ...Object.keys(demo)])],
      cartes: p.cartes,
      coquilles: coquilles.coquilles,
      ...lanternes,
      ...eclairs
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
  /** Les jumeaux : la paire a-t-elle été montrée ? Avant, on lit la question, rien ne presse. */
  let montre = $state(true);
  /** Ce qui a été répondu au tour courant : la correction montre où l'on s'est trompé. */
  let donnee = $state<string[]>([]);
  /** La coquille : le rang de la case touchée dans le message. */
  let touche = $state(-1);
  /** La devinette : les choix faux déjà écartés, avant que le tour soit noté. */
  let faux = $state<string[]>([]);
  let resultat = $state<Resultat | null>(null);

  let horloge: ReturnType<typeof setInterval> | null = null;
  let flash: ReturnType<typeof setTimeout> | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  /** La limite de la manche entière (la chaîne : trois minutes). Elle ne note rien. */
  let limite: ReturnType<typeof setTimeout> | null = null;
  /** La limite est passée : la manche se clôt au prochain tour, sans reproche. */
  let echue = $state(false);

  function arreterLimite(): void {
    if (limite !== null) clearTimeout(limite);
    limite = null;
  }

  /**
   * La limite de temps ne ferme jamais un écran sous les yeux : le tour en cours se lit
   * et se répond jusqu'au bout, et la manche se clôt au bouton suivant (« Voir le
   * constat »). Aucun tour n'est ouvert après elle.
   */
  function echoir(): void {
    limite = null;
    echue = true;
  }

  $effect(() => arreterLimite);

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
    touche = -1;
    faux = [];
    resultat = null;
    reste = 1;
    depart = Date.now();
    const id = courante?.jeu ?? null;
    if (id === null || courante === null || fini(courante)) return;
    const chrono = JEUX[id].chrono;
    /* Les jumeaux : la paire reste couverte tant qu'on n'a pas lu la question. Le flash
       ne part qu'au tap sur « Montrer » (`montrer`), jamais tout seul. */
    montre = id !== 'jumeaux';
    cache = id === 'jumeaux';
    if (chrono > 0) {
      horloge = setInterval(() => {
        reste = Math.max(0, 1 - (Date.now() - depart) / chrono);
        if (reste === 0) valider([]);
      }, 100);
    }
  }

  /**
   * Les jumeaux, au tap : la paire paraît 700 ms, puis les caractères se couvrent. Sans
   * animation demandée, ils restent affichés : l'écran est fixe, jamais de flash. Le temps
   * de réponse part d'ici : lire la question ne compte pas.
   */
  function montrer(): void {
    if (montre || resultat !== null) return;
    montre = true;
    cache = false;
    depart = Date.now();
    if (!reduit) flash = setTimeout(() => (cache = true), FLASH_MS);
  }

  /** Prépare la manche dès que le jeu change, et pas deux fois la même. */
  $effect(() => {
    const id = jeu;
    if (!chargee) return;
    if (id === null) {
      preparee = '';
      arreterLimite();
      m = null;
      return;
    }
    /* La devinette ne se rejoue pas : une seule par jour, la même graine toute la journée. */
    const cle = id === 'devinette' ? `${p.day}/devinette/0` : `${p.day}/${id}/${n}`;
    if (preparee === cle) return;
    preparee = cle;
    const manche = JEUX[id].preparer(corpus, cle);
    m = manche;
    const posee = manche?.tours[0]?.devinette;
    if (posee) ondevinette(posee, 'posee');
    arreterLimite();
    echue = false;
    if (manche !== null && JEUX[id].limite > 0) limite = setTimeout(echoir, JEUX[id].limite);
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
    const mot = tour(courante)?.mot ?? '';
    const r = JEUX[courante.jeu].repondre(courante, rep, { correct: true, tries: 0, seconds });
    donnee = rep;
    resultat = r;
    cache = false;
    for (const e of r.evenements) onrepondu(e);
    /* Le dictionnaire éclair : un mot deviné compte une fois, dans la progression. */
    if (r.correct && mot !== '') onmotdevine(mot);
    /* La coquille et l'éclair laissent lire leur correction : on n'avance pas tout seul. */
    if (r.correct && courante.jeu !== 'coquille' && courante.jeu !== 'eclair') {
      minuteur = setTimeout(suivant, AVANCE_MS);
    }
  }

  /** Le tour suivant, ou le constat quand la manche est finie. */
  function suivant(): void {
    const r = resultat;
    if (r === null) return;
    arreter();
    const apres = echue ? clore(r.manche) : r.manche;
    m = apres;
    resultat = null;
    if (fini(apres)) {
      arreterLimite();
      onfini();
    } else ouvrirTour(apres);
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

  /**
   * La devinette, au tap : juste, le tour est noté ; faux au premier essai, le choix est
   * écarté et l'on essaie encore ; faux au second, la réponse est montrée. Pas d'avance
   * automatique : la correction par les briques se lit à son rythme.
   */
  function deviner(c: string): void {
    const courante = m;
    if (courante === null || resultat !== null || fini(courante) || faux.includes(c)) return;
    const id = tour(courante)?.devinette ?? '';
    const seconds = Math.max(0, (Date.now() - depart) / 1000);
    const e = essayer(courante, c, faux, seconds);
    faux = e.pris;
    if (e.resultat === null) return;
    donnee = [c];
    resultat = e.resultat;
    for (const ev of e.resultat.evenements) onrepondu(ev);
    ondevinette(id, e.resultat.correct ? 'resolue' : 'montree');
  }

  /** Un caractère du message touché : on garde sa place, un même caractère peut y paraître deux fois. */
  function toucher(k: number): void {
    if (resultat !== null || t === null) return;
    touche = k;
    valider([t.choix[k]]);
  }

  const taoHumeur = $derived(humeur(p.tao.activites, p.day));
  const taoStade = $derived(stade(p.tao.croissance));
  const jeuCourant = $derived(jeu ? JEUX[jeu] : null);

  /* ---------- la devinette du jour ---------- */

  /** Déjà résolue ou montrée aujourd'hui : la suivante attend demain. */
  const faite = $derived(devinetteFaite(p, p.day));
  /** Celle que l'entrée du choix annonce, sans la poser : on la pose en l'ouvrant. */
  const annoncee = $derived(chargee && !faite ? devinetteDuJour(corpus, `${p.day}/devinette/0`) : null);
  const riddle = $derived(t && jeu === 'devinette' ? devinetteDe(t, corpus) : null);
  /** Le constat de la devinette : la manche porte un événement, juste ou montré. */
  const lanterneAllumee = $derived(
    jeu === 'devinette' && m !== null && fini(m) && m.trouves > 0
  );
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
    {#if chargee}
      {#if dispo.length === 0}
        <p class="guide">
          Il n'y a pas encore assez de caractères acquis pour jouer. Reviens après quelques
          révisions.
        </p>
      {/if}
      <div class="opt">
        {#each IDS as id (id)}
          {#if id === 'devinette' && faite}
            <!-- Une par jour : résolue ou montrée, la suivante attend demain. -->
            <button class="indispo" disabled>
              <span class="grow">
                <span class="t">{JEUX[id].titre}</span>
                <span class="d">
                  {p.devinetteDuJour?.issue === 'resolue' ? 'Résolue aujourd’hui' : 'Lue aujourd’hui'}.
                  La suivante demain.
                </span>
              </span>
            </button>
          {:else if id === 'devinette' && annoncee !== null}
            <button onclick={() => onchoisir(id)}>
              <span class="grow">
                <span class="t">{JEUX[id].titre}</span>
                <span class="d">« {annoncee.enonce} » : quel caractère ?</span>
              </span>
              <span class="k">{JEUX[id].minutes} min</span>
            </button>
          {:else if dispo.includes(id)}
            <button onclick={() => onchoisir(id)}>
              <span class="grow">
                <span class="t">{JEUX[id].titre}</span>
                <span class="d">{JEUX[id].lit}</span>
                {#if id === 'eclair'}<span class="d compte">{ligneMotsDevines(p.motsDevines.length)}</span>{/if}
              </span>
              <span class="k">{JEUX[id].minutes} min</span>
            </button>
          {:else}
            <!-- Un jeu qui ne peut pas encore se jouer le dit d'une ligne neutre. -->
            <button class="indispo" disabled>
              <span class="grow">
                <span class="t">{JEUX[id].titre}</span>
                <span class="d">{JEUX[id].indisponible}</span>
                {#if id === 'eclair' && p.motsDevines.length > 0}
                  <span class="d compte">{ligneMotsDevines(p.motsDevines.length)}</span>
                {/if}
              </span>
            </button>
          {/if}
        {/each}
      </div>
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
    {#if jeu === 'devinette'}
      <!-- Tao porte la lanterne : la devinette du jour, comme au prototype validé. -->
      <div class="devinette-tete">
        <div class="grow">
          <div class="eyebrow">{jeuCourant?.titre}</div>
          <h1>Devine le caractère</h1>
        </div>
        <Tao stade={taoStade} posture="jeu" humeur={taoHumeur} size={72} />
      </div>
    {:else}
      <div class="verif-tete">
        <!-- La coquille se lit comme un texte : Tao lit par-dessus l'épaule. -->
        <Tao
          stade={taoStade}
          posture={postureDuJeu(jeu)}
          humeur={taoHumeur}
          size={72}
          penchee={jeu === 'eclair' && TAO_ECLAIR.penchee}
        />
        <p class="guide grow">{jeuCourant?.titre}</p>
      </div>
    {/if}

    <!-- La chaîne ne dit pas sa longueur d'avance : elle se voit grandir. La devinette n'a qu'un tour. -->
    {#if jeu !== 'chaine' && jeu !== 'devinette'}
      <div class="tours k" aria-label="Avancement de la manche">
        {#each m.tours as _, k (k)}
          <i class:on={k < m.i} class:cur={k === m.i}></i>
        {/each}
      </div>
    {/if}

    <div class="q">
      {#if jeu === 'devinette'}
        <!-- L'énoncé, puis quatre caractères dessinés depuis leurs traits. -->
        <p class="riddle">« {t.enonce} »</p>
        {#if riddle?.zh}<p class="zh" lang="zh-Hans">{riddle.zh}</p>{/if}
        <!-- Répondue, la grille se resserre en une rangée : la correction et le verdict
             tiennent au-dessus du bouton du bas, même sur un petit écran (393 × 660). -->
        <div class="choices quatre devinette" class:repondue={resultat !== null}>
          {#each t.choix as c, k (c + k)}
            <button
              class:ok={resultat !== null && c === t.reponse[0]}
              class:ko={faux.includes(c)}
              disabled={resultat !== null || faux.includes(c)}
              aria-label={c}
              onclick={() => deviner(c)}
            >
              <Glyph char={c} size={resultat !== null ? 38 : 52} write={false} />
            </button>
          {/each}
        </div>
        {#if resultat !== null && riddle}
          <!-- La correction par les briques : la réponse, chaque brique et son nom, le sens. -->
          <div class="correction">
            <div class="ligne decompose">
              <span class="tuile faite"><Glyph char={riddle.c} size={48} write={false} /></span>
              <span class="op">=</span>
              {#each riddle.briques as b, rang (b + rang)}
                {#if rang > 0}<span class="op">+</span>{/if}
                <span class="brique">
                  <Glyph char={b} size={32} write={false} color="var(--ocre)" />
                  {#if nomDeBrique(b, corpus) !== ''}<small>{nomDeBrique(b, corpus)}</small>{/if}
                </span>
              {/each}
            </div>
            <p class="sens">
              {#if riddle.pinyin !== ''}<span class="py">{riddle.pinyin}</span>{/if}
              {riddle.sens}
            </p>
          </div>
        {/if}
      {:else if jeu === 'assembler'}
        {#if jeuCourant && jeuCourant.chrono > 0}
          <div class="chrono" aria-label="Le temps du tour">
            <i style="width:{Math.round(reste * 100)}%"></i>
          </div>
        {/if}
        <!-- La cible en grand : ce qu'on cherche, avant les briques. -->
        {@const g = glose(t.c, corpus)}
        <div class="cible">
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
      {:else if jeu === 'chaine'}
        {@const suite = t.suite ?? []}
        <!-- La chaîne jusque-là ; son dernier caractère, en grand, est ce qu'on cherche. -->
        <div class="chaine" aria-label="La chaîne">
          {#each suite as c, k (c + k)}
            {#if k > 0}<span class="op" aria-hidden="true">→</span>{/if}
            <span class="maillon" class:dernier={k === suite.length - 1}>
              <Glyph char={c} size={k === suite.length - 1 ? 84 : 40} write={false} />
            </span>
          {/each}
          {#if resultat !== null}
            <span class="op" aria-hidden="true">→</span>
            <span class="maillon faite"><Glyph char={t.c} size={56} write={false} /></span>
          {/if}
        </div>
        <p class="consigne">{t.enonce}</p>
        <div class="choices quatre">
          {#each t.choix as c, k (c + k)}
            <button
              class:ok={resultat !== null && c === t.reponse[0]}
              class:ko={resultat !== null && !resultat.correct && donnee[0] === c}
              disabled={resultat !== null}
              aria-label={c}
              onclick={() => valider([c])}
            >
              <Glyph char={c} size={60} write={false} />
            </button>
          {/each}
        </div>
      {:else if jeu === 'eclair'}
        <EclairTour {t} {corpus} {resultat} {donnee} onchoisir={(s) => valider([s])} />
      {:else if jeu === 'coquille'}
        <p class="consigne">{t.enonce}</p>
        <!-- Le message, mot après mot : chaque caractère se touche. -->
        <div class="message" aria-label="Le message">
          {#each t.choix as c, k (c + k)}
            {#if k > 0 && (t.coupes ?? []).includes(k)}<span class="coupe" aria-hidden="true"></span>{/if}
            <button
              class="signe"
              class:ok={resultat !== null && c === t.reponse[0]}
              class:ko={resultat !== null && !resultat.correct && touche === k}
              disabled={resultat !== null}
              aria-label={c}
              onclick={() => toucher(k)}
            >
              <Glyph char={c} size={40} write={false} />
            </button>
            <!-- La ponctuation du message se lit, elle ne se touche pas. -->
            {#if t.ponctuation?.[k]}<span class="ponct" lang="zh-Hans" aria-hidden="true">{t.ponctuation[k]}</span>{/if}
          {/each}
        </div>
        {#if resultat !== null && t.traduction}
          <p class="traduction">« {t.traduction} »</p>
        {/if}
        {#if resultat !== null && t.correction}
          <!-- La correction par les briques : l'intrus, puis le caractère qu'il remplaçait, côte à côte. -->
          <div class="correction cote">
            {#each t.correction as x, k (x.c)}
              {@const gx = glose(x.c, corpus)}
              <div class="ligne">
                <span class="tuile" class:intrus={k === 0} class:faite={k === 1}>
                  <Glyph char={x.c} size={48} write={false} />
                </span>
                {#if x.briques.length > 1}
                  <span class="op">=</span>
                  {#each x.briques as b, rang (b + rang)}
                    {#if rang > 0}<span class="op">+</span>{/if}
                    <Glyph char={b} size={32} write={false} color="var(--ocre)" />
                  {/each}
                {/if}
                <span class="gl">
                  <span class="k">{k === 0 ? 'Glissé' : 'À sa place'}</span>
                  {#if gx.pinyin !== ''}<span class="py">{gx.pinyin}</span>{/if}
                  {#if gx.fr !== ''}<span>{gx.fr}</span>{/if}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <p class="consigne">{t.enonce}</p>
        <div class="choices deux">
          {#each t.choix as c, k (c + k)}
            <button
              class:ok={resultat !== null && c === t.reponse[0]}
              class:ko={resultat !== null && !resultat.correct && donnee[0] === c}
              disabled={resultat !== null || !montre}
              aria-label={montre ? c : 'caractère couvert'}
              onclick={() => valider([c])}
            >
              <span class="flash" class:cache>
                <Glyph char={c} size={72} write={false} />
              </span>
            </button>
          {/each}
        </div>
        {#if !montre}
          <p class="k">Lis la question, puis touche « Montrer » : les deux caractères paraissent un instant.</p>
        {:else if cache && resultat === null}
          <p class="k">Les deux caractères se sont couverts. Lequel était-ce ?</p>
        {/if}
      {/if}

      <div class="fb" class:vide={resultat === null && jeu !== 'devinette'}>
        {#if resultat !== null}
          <b>{resultat.montre ? 'On te montre.' : VERDICTS[resultat.note]}</b>
          {@const quand = echeance(p, resultat.evenement.c)}
          {#if quand}<span class="next">Prochaine fois : dans {delai(new Date(), quand)}.</span>{/if}
        {:else if jeu === 'devinette'}
          {faux.length > 0
            ? 'Pas celui-là. Relis l’énoncé, une brique après l’autre.'
            : 'Chaque devinette cache une décomposition.'}
        {/if}
      </div>
    </div>

    <div class="foot">
      {#if !montre}
        <!-- Les jumeaux : le flash part quand on est prêt, pas avant. -->
        <button class="btn" onclick={montrer}>Montrer</button>
      {:else}
        <button class="btn" disabled={resultat === null} onclick={suivant}>
          {jeu === 'devinette' || (resultat !== null && (fini(resultat.manche) || echue))
            ? 'Voir le constat'
            : 'Suivant'}
        </button>
      {/if}
    </div>
  {:else}
    <div class="mood">
      <Tao
        stade={taoStade}
        posture="jeu"
        humeur={taoHumeur}
        size={96}
        penchee={jeu === 'eclair' && TAO_ECLAIR.penchee}
      />
    </div>
    <div class="card center bilan">
      <h1>{jeuCourant?.titre}</h1>
      <p class="constat">{jeuCourant?.constat(m)}</p>
      {#if jeu === 'devinette'}
        <!-- Un constat, pas un score : la lanterne s'allume pour la journée. -->
        <p class="guide">
          {lanterneAllumee
            ? 'La lanterne de Tao reste allumée aujourd’hui. La suivante demain.'
            : 'La suivante demain.'}
        </p>
      {:else if jeu === 'eclair'}
        <!-- Le compteur, sobre : un nombre réel, pas un score. -->
        <p class="guide">En tout : {ligneMotsDevines(p.motsDevines.length).toLowerCase()}</p>
      {/if}
      <div class="k">Ce qui vient d'être revu repasse dans tes révisions, aux échéances dites.</div>
    </div>
    <div class="foot">
      <button class="btn" onclick={onretour}>{OU[retour]}</button>
      <div class="acts">
        {#if jeu !== 'devinette'}
          <button class="btn ghost" onclick={rejouer}>Une autre manche</button>
        {/if}
        <button class="btn ghost" onclick={() => onchoisir(null)}>Un autre jeu</button>
      </div>
    </div>
  {/if}
</main>

<style>
  /* La devinette du jour, d'après l'écran `s-riddle` du prototype validé. Aucune
     animation sur les boutons ; le cinabre n'y marque rien. */
  .devinette-tete {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding-bottom: 12px;
    margin-bottom: 18px;
    border-bottom: 1px solid var(--rule);
  }
  .devinette-tete h1 {
    margin: 0;
    font-size: 26px;
  }
  .eyebrow {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
    margin-bottom: 6px;
  }
  .riddle {
    font-family: var(--head);
    font-weight: 700;
    font-size: 22px;
    line-height: 1.25;
    color: var(--ink);
    margin: 0 0 6px;
  }
  .choices.devinette button {
    min-height: 72px;
  }
  .choices.devinette.repondue {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .choices.devinette.repondue button {
    min-height: 54px;
  }
  .zh {
    font-family: var(--hz);
    font-size: 17px;
    color: var(--ink2);
    margin: 0 0 6px;
  }
  .decompose {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 4px;
  }
  .brique {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    max-width: 72px;
  }
  .brique small {
    font-size: 12px;
    line-height: 1.2;
    color: var(--ink2);
    text-align: center;
  }
  .sens {
    margin: 0;
    font-size: 15px;
    color: var(--ink2);
  }
  .sens .py {
    font-family: var(--head);
    font-weight: 500;
    color: var(--indigo);
    margin-right: 6px;
  }
  /* Le compteur « mots devinés » : une ligne sobre sous la description du jeu. */
  .compte {
    margin-top: 2px;
    font-size: 13px;
    color: var(--mist);
  }
  /* La coquille : la ponctuation du message rédigé, au pied de la case, et sa traduction. */
  .ponct {
    align-self: flex-end;
    margin: 0 0 2px -2px;
    font-family: var(--hz);
    font-size: 22px;
    line-height: 1;
    color: var(--ink2);
  }
  .traduction {
    margin: 4px 0 0;
    text-align: center;
    font-size: 15px;
    color: var(--ink2);
  }
  /* L'intrus et le caractère remplacé, côte à côte : la correction tient dans l'écran. */
  .correction.cote {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .correction.cote .ligne {
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: center;
    row-gap: 4px;
  }
  .correction.cote .gl {
    flex-basis: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    column-gap: 6px;
    margin-left: 0;
    text-align: center;
  }
</style>
