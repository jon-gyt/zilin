<script lang="ts">
  /**
   * « Dis-le » (story 9.1) : on prononce un caractère acquis, l'app reconnaît le ton sur
   * l'appareil (`tons/`), sans réseau.
   *
   * Le caractère est dessiné depuis ses traits, avec son sens ; ni pinyin accentué ni son
   * avant la réponse, pour ne pas donner le ton. Un bouton micro : on appuie, on dit le
   * caractère, on relâche ; un simple toucher écoute jusqu'au silence. L'app montre la
   * courbe de la voix sur la forme canonique du ton attendu, puis le ton reconnu et un
   * conseil, jamais un reproche.
   *
   * Notation automatique (`tons/dire.ts`) : le ton reconnu note la carte « Bien » et donne un
   * point 说 ; un autre ton, une confiance basse ou un silence ne notent rien et redemandent,
   * trois fois au plus, puis on passe sans rien noter. L'essai des Réglages (`essai`) ne note
   * jamais rien. « Suivant » reste toujours possible : on peut passer sans parler, rien n'est
   * noté. Le son est jeté après l'analyse ; seule la moyenne de la voix remonte (`onvoix`).
   *
   * Les phrases viennent du pipeline (`ecrans.json`, écran `dire`). Charte : l'indigo pour
   * l'action, le jade pour le ton reconnu, l'ocre pour un autre ton ; ni cinabre, ni ombre.
   */
  import CourbeTon from './CourbeTon.svelte';
  import Glyph from './Glyph.svelte';
  import { aAudio, manifesteOnce, prononcer } from './audio';
  import { remplir, type TextesDire } from './ecrans';
  import { contourDuTon, tonDe } from './questions';
  import { delai } from './revision';
  import type { Revision } from './session';
  import { analyser, type Contour, type Probleme, type Verdict } from './tons/classifieur';
  import { courbes, issueDire, messageDire, nomTon, revisionDire, type CibleDire, type Issue } from './tons/dire';
  import { ErreurMicro, ecouter, type EtatMicro, type Prise } from './tons/micro';
  import type { Modele } from './tons/classifieur';
  import { refLocuteur } from './tons/voix';

  let {
    cible,
    cle,
    textes: t,
    modele,
    voix,
    micro,
    essai = false,
    dernier = false,
    echeanceDe = () => null,
    onnote = () => undefined,
    onvoix,
    onmicro,
    onsuivant
  }: {
    cible: CibleDire;
    /** Le rang de la question : il remet l'écran à zéro. */
    cle: number;
    textes: TextesDire;
    modele: Modele;
    /** Les moyennes de la voix de l'apprenant (`Progress.voix`). */
    voix: readonly number[];
    /** L'état du micro à l'ouverture : la ligne de confidentialité précède la première demande. */
    micro: EtatMicro;
    /** L'essai des Réglages : rien n'est noté. */
    essai?: boolean;
    dernier?: boolean;
    echeanceDe?: (c: string) => Date | null;
    /** Le ton reconnu : l'événement à noter (« Bien », un point 说). */
    onnote?: (r: Revision) => void;
    /** La moyenne d'une syllabe analysée : la voix s'apprend. */
    onvoix: (hz: number) => void;
    /** Le micro s'est révélé refusé ou absent : l'appelant pose autre chose. */
    onmicro: (etat: 'refuse' | 'absent') => void;
    onsuivant: () => void;
  } = $props();

  /** Au-dessous, un relâché est un simple toucher : on écoute jusqu'au silence. */
  const TOUCHER_MS = 350;

  type Phase = 'pret' | 'ecoute' | 'fin';
  let phase = $state<Phase>('pret');
  let essais = $state(0);
  let verdict = $state<Verdict | null>(null);
  let probleme = $state<Probleme | null>(null);
  let contour = $state<Contour | null>(null);
  let issue = $state<Issue | null>(null);
  let niveau = $state(0);
  let prochaine = $state('');
  let ecoutable = $state(false);
  let prise: Prise | null = null;
  let appuiA = 0;
  let depart = Date.now();

  /** Remise à zéro à chaque question. */
  $effect(() => {
    void cle;
    phase = 'pret';
    essais = 0;
    verdict = null;
    probleme = null;
    contour = null;
    issue = null;
    niveau = 0;
    prochaine = '';
    depart = Date.now();
  });

  /**
   * L'écran est parti (« Suivant », « Quitter ») : une prise en cours s'arrête, le micro ne
   * reste jamais ouvert, et ce qu'elle rapporte n'est ni jugé ni noté.
   */
  let abandons = 0;
  $effect(() => () => {
    abandons += 1;
    prise?.arreter();
  });

  /** « Écouter » n'existe que si le caractère peut être dit, et seulement après la réponse. */
  $effect(() => {
    const c = cible.c;
    let vivant = true;
    void manifesteOnce().then((m) => {
      if (vivant) ecoutable = aAudio(m, c);
    });
    return () => {
      vivant = false;
    };
  });

  const ref = $derived(refLocuteur(voix));
  const vues = $derived(courbes(contour, cible.ton, ref));
  const message = $derived(essais === 0 ? '' : messageDire(t, verdict, probleme));
  const etat = $derived(essais === 0 || probleme !== null || verdict === null ? null : verdict.etat);

  async function commencer(): Promise<void> {
    if (phase !== 'pret') return;
    appuiA = performance.now();
    phase = 'ecoute';
    niveau = 0;
    const rang = cle;
    const vue = abandons;
    const partie = () => vue !== abandons || rang !== cle;
    let p: Prise;
    try {
      p = await ecouter((n) => (niveau = n));
    } catch (e) {
      phase = 'pret';
      if (!partie()) onmicro(e instanceof ErreurMicro ? e.etat : 'absent');
      return;
    }
    if (partie()) {
      p.arreter();
      return;
    }
    prise = p;
    const enr = await p.fin;
    prise = null;
    if (partie()) return;
    juger(enr.x, enr.sr);
  }

  /** Relâcher arrête la prise ; un toucher bref, avant la voix, la laisse finir sur le silence. */
  function relacher(): void {
    if (prise === null) return;
    if (performance.now() - appuiA < TOUCHER_MS && !prise.detecteur.voix) return;
    prise.arreter();
  }

  function clavier(e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (phase === 'pret') void commencer();
    else relacher();
  }

  function juger(x: Float32Array, sr: number): void {
    const a = analyser(x, sr, [cible.ton], modele, ref);
    const s = a.syllabes[0];
    essais += 1;
    probleme = a.probleme;
    verdict = a.probleme === null && s ? s.verdict : null;
    contour = a.probleme === null && s ? s.contour : null;
    if (contour) onvoix(contour.moyenne);
    issue = issueDire(verdict?.etat ?? null, essais);
    if (issue === 'note' && !essai) {
      onnote(revisionDire(cible.c, (Date.now() - depart) / 1000));
      const due = echeanceDe(cible.c);
      prochaine = due === null ? '' : remplir(t.prochaine, { delai: delai(new Date(), due) });
    }
    phase = issue === 'redemander' ? 'pret' : 'fin';
  }

  function suivant(): void {
    abandons += 1;
    prise?.arreter();
    onsuivant();
  }
</script>

<div class="q dire" class:analyse={essais > 0}>
  <p class="ask">{t.enonce}</p>

  <div class="stim cible">
    <Glyph seul char={cible.c} size={essais === 0 ? 104 : 60} />
    <div class="lecture">
      <p class="sens">« {cible.sens} »</p>
      {#if phase === 'fin'}
        <!-- Après la réponse seulement : la lecture et son ton, et le son. -->
        <div class="syllabe">
          <span class="py">{cible.pinyin}</span>
          <svg class="contour" width="34" height="34" viewBox="0 0 40 40" role="img" aria-label={nomTon(t, cible.ton)}>
            <path class="portee" d="M2 4H38M2 12H38M2 20H38M2 28H38M2 36H38" />
            <path class="trait" d={contourDuTon(tonDe(cible.pinyin))} pathLength="1" />
          </svg>
          {#if ecoutable}
            <button class="btn ghost ecoute" onclick={() => void prononcer(cible.c)}>♪ {t.ecouter}</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if essais > 0}
    <CourbeTon
      voix={vues.voix}
      modele={vues.modele}
      legendeVoix={t['legende-voix']}
      legendeModele={remplir(t['legende-modele'], { nom: nomTon(t, cible.ton) })}
    />
    <div class="fb" aria-live="polite">
      {#if etat}<span class="etat {etat}">{t[`etat-${etat}`]}</span>{/if}
      {message}
      {#if issue === 'passer'}<span class="next">{t.passer}</span>{/if}
      {#if prochaine !== ''}<span class="next">{prochaine}</span>{/if}
      {#if essai && phase === 'fin'}<span class="next">{t.essai}</span>{/if}
    </div>
  {/if}

  {#if phase !== 'fin'}
    <div class="prise">
      <button
        class="micro"
        class:ecoute={phase === 'ecoute'}
        style:--niveau={niveau}
        aria-label={phase === 'ecoute' ? t.ecoute : essais === 0 ? t.appuie : t.redire}
        onpointerdown={(e) => {
          e.preventDefault();
          /* Le doigt qui glisse hors du bouton relâche quand même la prise. */
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          void commencer();
        }}
        onpointerup={relacher}
        onpointercancel={relacher}
        onkeydown={clavier}
        oncontextmenu={(e) => e.preventDefault()}
      >
        <span class="anneau" aria-hidden="true"></span>
        <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
        </svg>
      </button>
      <span class="consigne">{phase === 'ecoute' ? t.ecoute : essais === 0 ? t.appuie : t.redire}</span>
    </div>
    {#if micro === 'a-demander' && essais === 0}<p class="k conf">{t.confidentialite}</p>{/if}
  {/if}
</div>

<div class="foot dire-pied">
  <button class="btn" class:ghost={phase !== 'fin'} onclick={suivant}>{dernier ? t.terminer : t.suivant}</button>
</div>

<style>
  .cible {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  /* Après un essai, le caractère se range à gauche : la courbe et le conseil ont la place. */
  .analyse .cible {
    flex-direction: row;
    justify-content: center;
    gap: 14px;
    margin: 0 0 8px;
  }
  .analyse .ask {
    margin-bottom: 6px;
  }
  .lecture {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .analyse .lecture {
    align-items: flex-start;
  }
  .sens {
    margin: 0;
    font-size: 16px;
    color: var(--ink2);
  }
  .syllabe {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .py {
    font-size: 21px;
    font-weight: 600;
    color: var(--indigo);
  }
  .ecoute {
    width: auto;
    min-height: 40px;
    padding: 0 12px;
    font-size: 15px;
  }
  .fb {
    margin-top: 8px;
    min-height: 0;
    padding: 8px 10px;
  }
  .etat {
    display: inline-block;
    margin-right: 6px;
    padding: 1px 8px;
    border-radius: 99px;
    font: 700 12px var(--head);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    vertical-align: 1px;
  }
  .etat.juste {
    background: var(--jade-soft);
    color: var(--jade);
  }
  .etat.autre {
    background: var(--ocre-soft);
    color: var(--ocre);
  }
  .etat.redemander {
    background: var(--card);
    color: var(--ink2);
    border: 1px solid var(--line);
  }
  .prise {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
  }
  /* Après un essai, le micro se fait plus petit, sa consigne à côté. */
  .analyse .prise {
    flex-direction: row;
    justify-content: center;
    gap: 12px;
    margin-top: 10px;
  }
  .micro {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 0;
    background: var(--act);
    color: var(--act-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .analyse .micro {
    width: 56px;
    height: 56px;
  }
  .micro svg {
    position: relative;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .micro svg rect {
    fill: currentColor;
  }
  /* l'anneau suit le niveau de la voix, à l'indigo pâle, à plat */
  .anneau {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 3px solid var(--indigo-soft);
    transform: scale(calc(1 + var(--niveau, 0) * 0.25));
    opacity: 0;
  }
  .micro.ecoute .anneau {
    opacity: 1;
  }
  @media (prefers-reduced-motion: no-preference) {
    .anneau {
      transition: transform 0.08s linear;
    }
  }
  .consigne {
    font-weight: 600;
    color: var(--indigo);
  }
  .conf {
    margin: 8px auto 0;
    max-width: 32ch;
  }
  /* Le pied reste lisible au-dessus de la carte qui défile : le papier sous le bouton au trait. */
  .dire-pied .btn.ghost {
    background: var(--paper);
  }
</style>
