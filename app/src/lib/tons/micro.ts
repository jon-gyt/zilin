/**
 * Le micro de « Dis-le » (story 9.1) : le droit, la prise de son, l'arrêt sur silence.
 *
 * Un seul chemin pour le web et pour l'app iOS : `getUserMedia` et la Web Audio API. Dans
 * la WebView de Capacitor (WKWebView, iOS 14.3 et plus), Capacitor accorde la capture à la
 * page (`requestMediaCapturePermissionFor` rend `.grant`) ; seul iOS demande l'accord, une
 * fois, avec la phrase de `NSMicrophoneUsageDescription` que la CI pose dans `Info.plist`
 * (`app/ios-template/patch.rb`). Sur le web, `getUserMedia` exige HTTPS (GitHub Pages le
 * donne) et le navigateur pose sa propre question.
 *
 * Rien ne sort de l'appareil : le son capté reste en mémoire le temps de la question, pour
 * l'analyse (`classifieur.analyser`) et pour « Réécouter » (`reecoute.ts`), puis il est jeté ;
 * aucune requête réseau.
 *
 * La session audio (retour du propriétaire du 29 septembre 2026 : « la voix chinoise est
 * coupée, comme s'il y avait un autre son derrière ») : sur iOS, ouvrir le micro fait passer
 * la page en lecture et enregistrement, avec le traitement de la voix des appels ; la lecture
 * qui suit sortait étouffée, hachée ou par l'écouteur. La prise demande `play-and-record`
 * (`navigator.audioSession`, Safari 17 et plus) et, dès sa fin, coupe toutes les pistes du
 * micro, ferme le contexte audio de capture et rend la session à la lecture (`playback`).
 *
 * `decider` et `Detecteur` sont purs et testés ; `etatMicro` et `ecouter` touchent le
 * navigateur.
 */
import { reglerSession } from '../audio';
import { reechantillonner } from './wav';

/** Ce que l'app sait du micro avant de poser la question. */
export type EtatMicro =
  /** L'accord est donné : la question se pose. */
  | 'accorde'
  /** L'accord n'a pas encore été demandé : la question se pose, l'appui le demandera. */
  | 'a-demander'
  /** L'accord est refusé (par l'apprenant ou le système) : la question ne se pose pas. */
  | 'refuse'
  /** Pas de micro, ou pas de capture possible ici : la question ne se pose pas. */
  | 'absent';

/** Le micro permet-il de poser la question ? */
export function microPossible(e: EtatMicro): boolean {
  return e === 'accorde' || e === 'a-demander';
}

/** Ce que le navigateur dit, relevé par `etatMicro`. */
export type Constat = {
  /** `navigator.mediaDevices.getUserMedia` existe. */
  capture: boolean;
  /** Contexte sécurisé (HTTPS, ou l'app iOS) : sans lui, pas de capture. */
  securise: boolean;
  /** `navigator.permissions.query({ name: 'microphone' })`, `null` quand il ne répond pas. */
  permission: 'granted' | 'denied' | 'prompt' | null;
  /**
   * Le nombre d'entrées audio que liste `enumerateDevices`, `null` quand la liste est vide
   * ou muette (Safari ne liste rien avant le premier accord : ce n'est pas une absence).
   */
  entrees: number | null;
  /** L'accord a été refusé pendant cette ouverture de l'app. */
  refuseIci: boolean;
};

/** L'état du micro, depuis ce que le navigateur dit. Pur. */
export function decider(c: Constat): EtatMicro {
  if (!c.capture || !c.securise) return 'absent';
  if (c.refuseIci || c.permission === 'denied') return 'refuse';
  if (c.entrees === 0) return 'absent';
  if (c.permission === 'granted') return 'accorde';
  return 'a-demander';
}

/** Un refus pendant cette ouverture de l'app : la question ne revient pas avant la suivante. */
let refuseIci = false;

/** L'état du micro, lu sans rien demander à l'apprenant. */
export async function etatMicro(): Promise<EtatMicro> {
  if (typeof navigator === 'undefined') return 'absent';
  const md = navigator.mediaDevices;
  const capture = typeof md?.getUserMedia === 'function';
  const securise = typeof window !== 'undefined' && window.isSecureContext !== false;
  let permission: Constat['permission'] = null;
  try {
    const r = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    if (r && (r.state === 'granted' || r.state === 'denied' || r.state === 'prompt')) permission = r.state;
  } catch {
    permission = null;
  }
  let entrees: number | null = null;
  try {
    const liste = capture && typeof md.enumerateDevices === 'function' ? await md.enumerateDevices() : [];
    entrees = liste.length === 0 ? null : liste.filter((d) => d.kind === 'audioinput').length;
  } catch {
    entrees = null;
  }
  return decider({ capture, securise, permission, entrees, refuseIci });
}

/* ---------- l'arrêt sur silence ---------- */

/** Réglages de la prise : l'arrêt sur silence et le plafond. */
export const PRISE = {
  /** Fenêtre de mesure du niveau, en secondes. */
  fenetre: 0.02,
  /** Le bruit de fond se mesure sur le début de la prise. */
  mesureFond: 0.15,
  /** Niveau minimal d'une voix (pleine échelle), quel que soit le fond. */
  voixMin: 0.006,
  /** Une voix dépasse le fond de tant de fois… */
  voixSurFond: 4,
  /** …pendant au moins ce temps, pour ne pas partir sur un clic. */
  voixDuree: 0.06,
  /** Après la voix, tant de silence arrête la prise (l'étude : 600 ms). */
  silenceFin: 0.6,
  /** Une prise ne dure jamais plus. */
  max: 4
};

/**
 * Suit le niveau de la prise, bloc après bloc, et dit quand s'arrêter : après la voix,
 * `silenceFin` de silence ; sans voix, au plafond. Pur : on lui pousse les échantillons.
 */
export class Detecteur {
  readonly sr: number;
  /** La voix a commencé. */
  voix = false;
  /** Le dernier niveau mesuré, de 0 à 1 (pour l'anneau du bouton). */
  niveau = 0;
  private n = 0;
  private somme = 0;
  private dansFenetre = 0;
  private fond = Infinity;
  private pic = 0;
  private tempsVoix = 0;
  private silence = 0;
  private temps = 0;

  constructor(sr: number) {
    this.sr = sr;
  }

  /** Pousse un bloc ; rend `true` quand la prise doit s'arrêter. */
  pousser(x: Float32Array): boolean {
    const taille = Math.max(1, Math.round(PRISE.fenetre * this.sr));
    let stop = false;
    for (let i = 0; i < x.length; i++) {
      this.somme += x[i] * x[i];
      this.dansFenetre++;
      this.n++;
      if (this.dansFenetre < taille) continue;
      stop = this.fenetreFinie(Math.sqrt(this.somme / this.dansFenetre)) || stop;
      this.somme = 0;
      this.dansFenetre = 0;
    }
    return stop;
  }

  private fenetreFinie(rms: number): boolean {
    const d = PRISE.fenetre;
    this.temps += d;
    this.niveau = Math.min(1, rms * 8);
    if (this.temps <= PRISE.mesureFond) this.fond = Math.min(this.fond, rms);
    const fond = Number.isFinite(this.fond) ? Math.max(this.fond, 1e-4) : 1e-4;
    const seuilVoix = Math.max(PRISE.voixMin, fond * PRISE.voixSurFond);
    if (!this.voix) {
      this.tempsVoix = rms > seuilVoix ? this.tempsVoix + d : 0;
      if (this.tempsVoix >= PRISE.voixDuree) this.voix = true;
    }
    if (this.voix) {
      this.pic = Math.max(this.pic, rms);
      const seuilSilence = Math.max(fond * 2.5, this.pic * 0.08);
      this.silence = rms < seuilSilence ? this.silence + d : 0;
      if (this.silence >= PRISE.silenceFin) return true;
    }
    return this.temps >= PRISE.max;
  }
}

/* ---------- la prise de son ---------- */

/**
 * Ce que la prise rend : le son mono à 16 kHz pour l'analyse, et si une voix y a été
 * entendue ; le son tel que capté (`brut`, à `srBrut`), pour « Réécouter ». Rien n'en est
 * gardé au-delà de la question.
 */
export type Enregistrement = { x: Float32Array; sr: number; voix: boolean; brut: Float32Array; srBrut: number };

/** Une prise en cours : `arreter` la clôt (on relâche le bouton), `fin` rend le son. */
export type Prise = { arreter: () => void; fin: Promise<Enregistrement>; detecteur: Detecteur };

/** Le micro n'a pas pu s'ouvrir : refusé, ou absent. */
export class ErreurMicro extends Error {
  readonly etat: 'refuse' | 'absent';
  constructor(etat: 'refuse' | 'absent') {
    super(etat === 'refuse' ? 'micro refusé' : 'micro absent');
    this.etat = etat;
  }
}

/** Le processeur de la prise : il renvoie ses échantillons par blocs de 2 048. */
const PROCESSEUR = `class WenluPrise extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(2048); this.n = 0; }
  process(entrees) {
    const c = entrees[0] && entrees[0][0];
    if (c) for (let i = 0; i < c.length; i++) {
      this.b[this.n++] = c[i];
      if (this.n === this.b.length) { this.port.postMessage(this.b.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('wenlu-prise', WenluPrise);`;

type FenetreAudio = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/**
 * Ouvre le micro et commence la prise. À appeler dans le geste de l'apprenant (l'appui) :
 * iOS n'ouvre le son qu'ainsi. Échec : `ErreurMicro`, refusé ou absent. La prise s'arrête
 * d'elle-même sur le silence qui suit la voix, ou au plafond ; `arreter` la clôt plus tôt.
 * Aucune contrainte de traitement : l'annulation d'écho, le débruitage et le gain
 * automatique abîment le voisement, et sur iOS ils font passer la session audio en mode
 * « appel ».
 */
export async function ecouter(surNiveau: (n: number) => void = () => undefined): Promise<Prise> {
  const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (typeof md?.getUserMedia !== 'function') throw new ErreurMicro('absent');
  const Ctx = globalThis.AudioContext ?? (globalThis as FenetreAudio).webkitAudioContext;
  if (!Ctx) throw new ErreurMicro('absent');
  /* La session en lecture et enregistrement le temps de la prise, avant d'ouvrir le micro. */
  reglerSession('play-and-record');
  /* Le contexte naît dans le geste, avant toute attente : iOS le laisse alors jouer. */
  const ctx = new Ctx();
  let flux: MediaStream;
  try {
    flux = await md.getUserMedia({ audio: CONTRAINTES });
  } catch (e) {
    void ctx.close().catch(() => undefined);
    reglerSession('playback');
    const nom = (e as { name?: string }).name ?? '';
    if (nom === 'NotAllowedError' || nom === 'SecurityError' || nom === 'PermissionDeniedError') {
      refuseIci = true;
      throw new ErreurMicro('refuse');
    }
    throw new ErreurMicro('absent');
  }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);

  const source = ctx.createMediaStreamSource(flux);
  const detecteur = new Detecteur(ctx.sampleRate);
  const blocs: Float32Array[] = [];
  let arrete = false;
  let rendre: (e: Enregistrement) => void = () => undefined;
  const fin = new Promise<Enregistrement>((r) => (rendre = r));
  let noeud: AudioNode | null = null;
  let muet: AudioNode | null = null;
  let url = '';

  const recevoir = (b: Float32Array): void => {
    if (arrete) return;
    blocs.push(b);
    const stop = detecteur.pousser(b);
    surNiveau(detecteur.niveau);
    if (stop) arreter();
  };

  function arreter(): void {
    if (arrete) return;
    arrete = true;
    fermer(flux, ctx, [source, noeud, muet]);
    if (url !== '') URL.revokeObjectURL(url);
    let n = 0;
    for (const b of blocs) n += b.length;
    const x = new Float32Array(n);
    let o = 0;
    for (const b of blocs) {
      x.set(b, o);
      o += b.length;
    }
    blocs.length = 0;
    rendre({ x: reechantillonner(x, ctx.sampleRate, 16000), sr: 16000, voix: detecteur.voix, brut: x, srBrut: ctx.sampleRate });
  }

  if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
    try {
      url = URL.createObjectURL(new Blob([PROCESSEUR], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const n = new AudioWorkletNode(ctx, 'wenlu-prise', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      n.port.onmessage = (e: MessageEvent) => recevoir(e.data as Float32Array);
      noeud = n;
    } catch {
      noeud = null;
    }
  }
  if (noeud === null) {
    /* Repli des navigateurs sans AudioWorklet : l'ancien nœud, toujours là dans Safari. */
    const sp = ctx.createScriptProcessor(2048, 1, 1);
    sp.onaudioprocess = (e) => recevoir(new Float32Array(e.inputBuffer.getChannelData(0)));
    noeud = sp;
  }
  source.connect(noeud);
  /* Un nœud de traitement ne tourne que relié à la sortie : par un gain nul, rien ne s'entend. */
  const gain = ctx.createGain();
  gain.gain.value = 0;
  noeud.connect(gain);
  gain.connect(ctx.destination);
  muet = gain;
  return { arreter, fin, detecteur };
}

/**
 * Ce que la prise demande au micro : le son brut, sans annulation d'écho, sans débruitage,
 * sans gain automatique (meilleur pour le suivi de hauteur, et sur iOS la session ne passe
 * pas en mode « appel »), sur un seul canal.
 */
export const CONTRAINTES: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1
};

/**
 * La fin d'une prise : toutes les pistes du micro s'arrêtent (l'indicateur du micro s'éteint),
 * les nœuds se détachent, le contexte de capture se ferme, et la session revient à la lecture.
 * Rien ne reste ouvert.
 */
export function fermer(
  flux: Pick<MediaStream, 'getTracks'>,
  ctx: Pick<AudioContext, 'close'>,
  noeuds: readonly (Pick<AudioNode, 'disconnect'> | null)[]
): void {
  for (const t of flux.getTracks()) {
    try {
      t.stop();
    } catch {
      /* déjà arrêtée */
    }
  }
  for (const n of noeuds) {
    try {
      n?.disconnect();
    } catch {
      /* déjà détaché */
    }
  }
  void Promise.resolve()
    .then(() => ctx.close())
    .catch(() => undefined);
  reglerSession('playback');
}
