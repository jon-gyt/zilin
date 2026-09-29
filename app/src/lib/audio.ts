/**
 * L'audio de l'app : la voix chinoise de l'appareil, et les fichiers d'une voix neuronale
 * pré-générée, servis avec l'app.
 *
 * Brief §7 (décision du propriétaire du 29 septembre 2026, « Tu ne peux pas utiliser l'IA de
 * l'iPhone pour générer ? ») : la voix de référence est celle de l'appareil quand il a une
 * voix du mandarin du continent (`zh-CN`) : les voix d'Apple, « Premium » et « Améliorée »
 * quand l'apprenant les a téléchargées, compactes sinon, marquent les tons et marchent hors
 * ligne. Dans l'app iOS, elles passent par AVSpeechSynthesizer (greffon
 * `@capacitor-community/text-to-speech`, `voix-native.ts`), qui les voit toutes ; sur le web, par
 * `speechSynthesis`. Le réglage « Voix » (`reglerVoix`) choisit entre elle et les fichiers
 * (« Voix enregistrée »), lus d'après le manifeste écrit par `wenlu audio exporter` (voir
 * `data/schema.md`). Chacune est le repli de l'autre ; sans aucune, l'app se tait. Une voix
 * qui passe par un service (`localService` faux, les voix « en ligne » de Chrome ou d'Edge)
 * n'est jamais prise : aucune requête à un service.
 *
 * Un seul son à la fois : chaque demande fait taire la précédente, fichier comme voix de
 * l'appareil, et une demande dépassée par une plus récente ne joue plus rien (`tour`). Deux
 * « Écouter » rapprochés faisaient parler l'appareil par-dessus le fichier.
 *
 * Un seul `HTMLAudioElement` pour toute l'app, réutilisé d'un texte à l'autre : sur
 * iOS, un élément déjà débloqué par un geste continue de jouer, et n'en créer qu'un
 * évite d'empiler des lecteurs à chaque toucher.
 *
 * Hors ligne : le service worker précache le manifeste et tous les mp3 à l'installation
 * (`vite.config.ts`, `globPatterns` avec `mp3`), rien n'est mis en cache à la demande. Une
 * app installée dit donc ses fichiers sans réseau. Un fichier qui ne se charge pas (service
 * worker pas encore installé ou cache vidé par le système, et pas de réseau) fait rejeter
 * `play()` : on retombe sur la voix du téléphone, et sans elle `prononcer` le dit (`muet`).
 */
import { VERSION_DONNEES, dossierVersion } from './content';

/** Le manifeste audio exporté : texte → chemin du fichier servi avec l'app. */
export type Manifeste = {
  version: string;
  fournisseur: string;
  format: string;
  /** Texte (caractère ou mot) → chemin relatif à `app/public/`. */
  chemins: Record<string, string>;
};

/**
 * Le manifeste servi avec l'app : celui de l'export versionné, que `wenlu audio
 * exporter` écrit dans `app/public/data/<version>/audio/manifeste.json`, pour la
 * version que lit `content.ts`.
 */
export const FICHIER_AUDIO = `${dossierVersion(VERSION_DONNEES)}/audio/manifeste.json`;

/** Le repli : le manifeste du dossier de démonstration, lu quand l'export n'a pas d'audio. */
export const FICHIER_AUDIO_DEMO = 'data/demo/audio/manifeste.json';

/** Les manifestes essayés dans l'ordre quand aucun n'est nommé : l'export, puis la démonstration. */
export const FICHIERS_AUDIO: readonly string[] = [FICHIER_AUDIO, FICHIER_AUDIO_DEMO];

/** Ce que ce module demande à un lecteur : de quoi jouer un fichier, et s'il est à l'arrêt. */
export type Lecteur = Pick<HTMLAudioElement, 'src' | 'currentTime' | 'preload' | 'play' | 'pause'> &
  Partial<Pick<HTMLAudioElement, 'paused' | 'addEventListener'>>;

/** Ce que ce module demande à la synthèse du téléphone : ses voix, parler, se taire, si elle parle. */
export type Synthese = Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel'> &
  Partial<Pick<SpeechSynthesis, 'speaking' | 'pending'>>;

/** Une voix de l'appareil, telle que `speechSynthesis` ou le greffon natif la décrivent. */
export type VoixAppareil = Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'voiceURI' | 'localService' | 'default'>;

/**
 * La synthèse native de l'app iOS (AVSpeechSynthesizer, par le greffon
 * `@capacitor-community/text-to-speech`) : ses voix, dire avec l'une d'elles (son rang dans la
 * liste), se taire. `null` sur le web.
 */
export type SyntheseNative = {
  voix(): Promise<VoixAppareil[]>;
  dire(texte: string, lang: string, rang: number): Promise<void>;
  taire(): Promise<void>;
};

/** La session audio de Safari 17 et plus (`navigator.audioSession`), `null` ailleurs. */
export type SessionAudio = { type: string };

function syntheseParDefaut(): Synthese | null {
  return typeof window === 'undefined' || !('speechSynthesis' in window) ? null : window.speechSynthesis;
}

function sessionParDefaut(): SessionAudio | null {
  if (typeof navigator === 'undefined') return null;
  const s = (navigator as Navigator & { audioSession?: SessionAudio }).audioSession;
  return s && typeof s === 'object' && 'type' in s ? s : null;
}

/** La synthèse native que le shell iOS pose au démarrage (`poserSyntheseNative`). */
let natifPose: () => SyntheseNative | null = () => null;
let synthese: () => Synthese | null = syntheseParDefaut;
let natif: () => SyntheseNative | null = () => natifPose();
let session: () => SessionAudio | null = sessionParDefaut;
/** Les voix de la synthèse native, relues par `voixPretes` ; vide tant qu'elles ne le sont pas. */
let voixNatives: VoixAppareil[] = [];
/** Le réglage « Voix » : `null`, la voix par défaut (`voixParDefaut`). */
let preference: ChoixVoix | null = null;
/** Le rang de la dernière demande de son : une demande dépassée ne joue plus rien. */
let tour = 0;

/** Un manifeste vide : ce que rend un fichier absent. L'app se tait, sans erreur. */
const VIDE: Manifeste = { version: '', fournisseur: '', format: '', chemins: {} };

function lecteurParDefaut(): Lecteur | null {
  return typeof Audio === 'undefined' ? null : new Audio();
}

let fabrique: () => Lecteur | null = lecteurParDefaut;
let requete: typeof fetch = (...args) => fetch(...args);
let unique: Lecteur | null = null;
let cree = false;
const manifestes = new Map<string, Promise<Manifeste>>();
let charge: Manifeste | null = null;

/**
 * Le point d'injection : le lecteur et le `fetch` du manifeste. Remet à zéro le
 * lecteur unique et le manifeste déjà chargé. Les tests s'en servent ; le shell iOS
 * pourra y poser son propre lecteur sans toucher au reste.
 */
export function configurerAudio(
  options: {
    lecteur?: () => Lecteur | null;
    fetchFn?: typeof fetch;
    synthese?: () => Synthese | null;
    natif?: () => SyntheseNative | null;
    session?: () => SessionAudio | null;
  } = {}
): void {
  fabrique = options.lecteur ?? lecteurParDefaut;
  synthese = options.synthese ?? syntheseParDefaut;
  natif = options.natif ?? (() => natifPose());
  session = options.session ?? sessionParDefaut;
  requete = options.fetchFn ?? ((...args) => fetch(...args));
  unique = null;
  cree = false;
  charge = null;
  voixAttendues = null;
  voixNatives = [];
  enonceEnCours = null;
  dernierArret = Number.NEGATIVE_INFINITY;
  natifEnCours = 0;
  derniere = null;
  sonEnCours = null;
  preference = null;
  tour = 0;
  manifestes.clear();
}

/**
 * La synthèse native, posée par le shell iOS au démarrage (`voix-native.ts`) : sans elle, la voix
 * de l'appareil passe par `speechSynthesis`. Les voix seront relues par `voixPretes`.
 */
export function poserSyntheseNative(f: () => SyntheseNative | null): void {
  natifPose = f;
  voixAttendues = null;
}

/**
 * La session audio de la page, quand le navigateur la laisse régler (Safari 17 et plus) :
 * `play-and-record` le temps d'une prise au micro, `playback` ensuite. Sur iOS, ouvrir le
 * micro fait passer la session en lecture et enregistrement, avec le traitement de la voix
 * des appels ; laissée ainsi, la lecture qui suit sort étouffée, hachée ou par l'écouteur.
 * Une session déjà du bon type n'est pas touchée : la régler de nouveau au moment où une voix
 * part peut reconfigurer la sortie de l'iPhone sous elle. Rend `true` si la session est du
 * type demandé.
 */
export function reglerSession(type: 'play-and-record' | 'playback'): boolean {
  const s = session();
  if (s === null) return false;
  try {
    if (s.type !== type) s.type = type;
    return true;
  } catch {
    return false;
  }
}

/** Le lecteur de l'app : le même à chaque appel, créé à la première lecture. */
export function lecteur(): Lecteur | null {
  if (!cree) {
    unique = fabrique();
    cree = true;
  }
  return unique;
}

/** L'URL d'un fichier du manifeste, sous la base de l'app (sous-dossier, PWA, iOS). */
export function urlAudio(chemin: string): string {
  return `${import.meta.env.BASE_URL}${chemin}`;
}

/** Lit le manifeste servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadManifeste(
  file = FICHIER_AUDIO,
  fetchFn: typeof fetch = requete
): Promise<Manifeste> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Manifeste audio introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Manifeste>;
  if (!brut.chemins || typeof brut.chemins !== 'object') {
    throw new Error(`Manifeste audio illisible : ${file}`);
  }
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    fournisseur: typeof brut.fournisseur === 'string' ? brut.fournisseur : '',
    format: typeof brut.format === 'string' ? brut.format : '',
    chemins: brut.chemins
  };
}

/**
 * Le premier manifeste lisible d'une liste, dans l'ordre. Un fichier absent ou
 * illisible passe au suivant ; aucun lisible, c'est le manifeste vide.
 */
async function premierLisible(files: readonly string[]): Promise<Manifeste> {
  for (const f of files) {
    try {
      return await loadManifeste(f);
    } catch {
      /* absent ou illisible : le suivant */
    }
  }
  return VIDE;
}

/**
 * Le manifeste, chargé une seule fois pour toute la durée de vie de l'app. Sans
 * fichier nommé, celui de l'export versionné, et à défaut celui de la démonstration.
 * Aucun fichier lisible donne un manifeste vide : l'app se tait.
 */
export function manifesteOnce(file?: string): Promise<Manifeste> {
  const cle = file ?? FICHIERS_AUDIO.join('|');
  let p = manifestes.get(cle);
  if (!p) {
    p = premierLisible(file === undefined ? FICHIERS_AUDIO : [file])
      .then((m) => {
        charge = m;
        return m;
      });
    manifestes.set(cle, p);
  }
  return p;
}

/** Le manifeste déjà chargé, `null` tant qu'il ne l'est pas. Lecture synchrone. */
export function manifesteCharge(): Manifeste | null {
  return charge;
}

/** Le chemin d'un texte dans un manifeste, `null` s'il n'a pas de voix. */
export function chemin(m: Manifeste | null, texte: string): string | null {
  return m?.chemins[texte] ?? null;
}

/** Ce texte a-t-il un fichier pré-généré ? */
export function aFichier(m: Manifeste | null, texte: string): boolean {
  return chemin(m, texte) !== null;
}

/* ---------- les voix de l'appareil ---------- */

/** Le réglage « Voix » : la voix de l'appareil, ou les fichiers (« Voix enregistrée »). */
export type ChoixVoix = 'appareil' | 'enregistree';

/**
 * Une voix du mandarin : `zh` ou `cmn`, sans le cantonais (`zh-HK`, `yue`), qui n'a pas les
 * tons du mandarin.
 */
export function estMandarin(v: Pick<VoixAppareil, 'lang'>): boolean {
  const l = v.lang.replace('_', '-');
  return /^(zh|cmn)(-|$)/i.test(l) && !/-(hk|mo)\b|yue/i.test(l);
}

/** Une voix du mandarin du continent (`zh-CN`, `zh-Hans`, ou `zh` seul). */
export function estContinent(v: Pick<VoixAppareil, 'lang'>): boolean {
  const l = v.lang.replace('_', '-');
  return estMandarin(v) && !/-(tw|hant)\b/i.test(l) && (/-(cn|hans)\b/i.test(l) || /^(zh|cmn)$/i.test(l));
}

/**
 * La qualité d'une voix, d'après son identifiant et son nom : les voix d'Apple le disent
 * (`com.apple.voice.premium.zh-CN.…`, `….enhanced.…`, `….compact.…`), comme les voix
 * neuronales ailleurs. 3 Premium, 2 améliorée ou neuronale, 0 compacte, 1 sinon.
 */
export function qualiteVoix(v: Pick<VoixAppareil, 'name' | 'voiceURI'>): number {
  const id = `${v.voiceURI} ${v.name}`;
  if (/premium/i.test(id)) return 3;
  if (/enhanced|am[ée]lior[ée]e?|neural|natural|siri/i.test(id)) return 2;
  if (/compact/i.test(id)) return 0;
  return 1;
}

/**
 * Les voix du mandarin de l'appareil, de la plus sûre à la moins sûre : celles du continent
 * avant celles de Taïwan, puis par qualité, puis la voix par défaut. Jamais une voix qui passe
 * par un service (`localService` faux) : aucune requête réseau à l'exécution.
 */
export function classerVoix(voix: readonly VoixAppareil[]): VoixAppareil[] {
  return voix
    .filter((v) => estMandarin(v) && v.localService !== false)
    .map((v, i) => ({ v, i }))
    .sort(
      (a, b) =>
        Number(estContinent(b.v)) - Number(estContinent(a.v)) ||
        qualiteVoix(b.v) - qualiteVoix(a.v) ||
        Number(b.v.default) - Number(a.v.default) ||
        a.i - b.i
    )
    .map((x) => x.v);
}

/** Les voix connues de l'appareil : celles de la synthèse native si elle est là, sinon du web. */
function voixConnues(): VoixAppareil[] {
  if (natif() !== null && voixNatives.length > 0) return voixNatives;
  const s = synthese();
  return s === null ? [] : s.getVoices();
}

/** La voix mandarin de l'appareil que l'app prend, `null` s'il n'en a pas. */
export function voixMandarin(): VoixAppareil | null {
  return classerVoix(voixConnues())[0] ?? null;
}

/** Le téléphone peut-il dire du mandarin ? */
export function aVoixTelephone(): boolean {
  return voixMandarin() !== null;
}

/** La voix par défaut : celle de l'appareil s'il a une voix du continent, sinon les fichiers. */
export function voixParDefaut(v: VoixAppareil | null = voixMandarin()): ChoixVoix {
  return v !== null && estContinent(v) ? 'appareil' : 'enregistree';
}

/** Recopie le réglage « Voix » de la progression (`null` : la voix par défaut). */
export function reglerVoix(c: ChoixVoix | null): void {
  preference = c;
}

/** La voix que l'app prend d'abord, réglage et appareil compris. */
export function voixChoisie(): ChoixVoix {
  if (preference === 'appareil' && !aVoixTelephone()) return 'enregistree';
  return preference ?? voixParDefaut();
}

/**
 * La vitesse de la voix du web : un peu lente pour un caractère isolé, qu'on écoute pour son
 * ton, presque normale pour un mot. La voix native garde son débit : le greffon iOS ne sait
 * ralentir qu'en sautant de 0,5 à 0,25 (sa conversion vers AVSpeechUtterance), trop lent.
 */
export function vitesse(texte: string): number {
  return [...texte].length <= 1 ? 0.75 : 0.9;
}

/**
 * La ponctuation finale d'un énoncé : 。！？ (ou leurs formes latines, ou des points de
 * suspension), suivie au plus de guillemets ou de parenthèses fermants.
 */
const FIN_DE_PHRASE = /[。！？!?．.…][」』”’"')）]*$/u;

/** Une pause en fin de texte (virgule, deux-points) : le point final la remplace. */
const PAUSE_FINALE = /[，、；：,;:\s]+$/u;

/** Le point final ajouté à un texte qui n'en a pas. */
export const POINT_FINAL = '。';

/**
 * Ce que la voix de l'appareil reçoit pour dire un texte : le texte, terminé par un point
 * final (retour du propriétaire du 29 septembre 2026 : « quand je veux lire un seul
 * caractère par la voix, le son est coupé trop vite »). Sans ponctuation, la synthèse d'Apple
 * (AVSpeechSynthesizer, derrière `speechSynthesis` dans WebKit comme derrière le greffon), et
 * bien d'autres, traitent un caractère seul comme un fragment : la syllabe s'arrête net, sans
 * sa chute, et le ton perd sa fin (le 3e et le 4e surtout). Le point final donne la chute
 * d'une phrase dite ; il ne se prononce pas. Un texte qui finit déjà sur 。！？ reste tel
 * quel ; une virgule finale devient un point.
 *
 * Rien devant : c'est la fin qui est rognée, pas le début (le greffon ouvre la session audio
 * dès son démarrage), et un signe placé devant ne fait pas de silence chez Apple. Aucun mot
 * n'est ajouté : les caractères dits sont ceux du texte. Pur.
 */
export function enonce(texte: string): string {
  const t = texte.trim();
  if (t === '' || FIN_DE_PHRASE.test(t)) return t;
  const nu = t.replace(PAUSE_FINALE, '');
  return nu === '' ? t : `${nu}${POINT_FINAL}`;
}

/** Le temps laissé au navigateur pour annoncer ses voix. */
export const ATTENTE_VOIX_MS = 1000;

let voixAttendues: Promise<boolean> | null = null;

/**
 * Le téléphone peut-il dire du mandarin, une fois ses voix connues ? Chrome, et parfois
 * Safari, rendent une liste vide au premier appel et annoncent leurs voix ensuite
 * (`voiceschanged`) : on attend l'annonce, `delai` millisecondes au plus. Une seule attente
 * pour toute la vie de l'app, pour qu'une série de questions décidée sur cette réponse ne
 * change pas en route.
 */
export function voixPretes(delai = ATTENTE_VOIX_MS): Promise<boolean> {
  if (voixAttendues !== null) return voixAttendues;
  const n = natif();
  if (n !== null) {
    voixAttendues = n
      .voix()
      .then((v) => {
        voixNatives = v;
        return aVoixTelephone();
      })
      .catch(() => aVoixTelephone());
    return voixAttendues;
  }
  voixAttendues = new Promise<boolean>((resolve) => {
    const s = synthese();
    if (s === null) {
      resolve(false);
      return;
    }
    if (s.getVoices().length > 0) {
      resolve(aVoixTelephone());
      return;
    }
    const cible = s as Partial<Pick<EventTarget, 'addEventListener' | 'removeEventListener'>>;
    let minuteur: ReturnType<typeof setTimeout> | null = null;
    const finir = () => {
      if (minuteur !== null) clearTimeout(minuteur);
      cible.removeEventListener?.('voiceschanged', finir);
      resolve(aVoixTelephone());
    };
    minuteur = setTimeout(finir, delai);
    cible.addEventListener?.('voiceschanged', finir);
  });
  return voixAttendues;
}

/**
 * Relit les voix de l'appareil (Réglages) : une voix chinoise téléchargée pendant que l'app
 * était ouverte est prise sans la relancer.
 */
export function relireVoix(delai = ATTENTE_VOIX_MS): Promise<boolean> {
  voixAttendues = null;
  return voixPretes(delai);
}

/**
 * Ce texte peut-il être dit ? Par un fichier pré-généré, ou à défaut par la voix du
 * téléphone. C'est ce qui décide d'un bouton « Écouter » actif.
 */
export function aAudio(m: Manifeste | null, texte: string): boolean {
  return aFichier(m, texte) || aVoixTelephone();
}

/**
 * Ce qu'a donné une demande de dire un texte :
 * - `fichier` : le fichier pré-généré joue ;
 * - `telephone` : la voix du téléphone le dit (pas de fichier, ou fichier qui ne s'est pas
 *   chargé, ou lecture refusée) ;
 * - `bloque` : le fichier est là mais le navigateur a refusé de le jouer (`NotAllowedError`,
 *   geste requis, ou `AbortError`, lecture interrompue par une autre), et le téléphone n'a
 *   pas de voix : un toucher sur « Écouter » le jouera ; ou une demande plus récente a pris
 *   la place de celle-ci ;
 * - `muet` : rien à dire, ni fichier lisible ni voix du téléphone.
 */
export type Dit = 'fichier' | 'telephone' | 'bloque' | 'muet';

/**
 * Un refus de `play()` qui ne dit rien du fichier : le navigateur attend un geste, ou une
 * autre lecture a pris la place. Tout autre rejet (`NotSupportedError` quand la ressource
 * ne se charge pas, hors ligne et pas en cache) compte comme un fichier absent.
 */
function refusSansEchec(e: unknown): boolean {
  const nom = (e as { name?: unknown } | null)?.name;
  return nom === 'NotAllowedError' || nom === 'AbortError';
}

/**
 * L'énoncé que dit la voix du web, retenu jusqu'à sa fin (`end` ou `error`). Bug connu de
 * WebKit et de Chromium : un `SpeechSynthesisUtterance` que plus rien ne référence peut être
 * ramassé en pleine lecture, qui s'interrompt, ou dont `end` ne vient jamais.
 */
let enonceEnCours: SpeechSynthesisUtterance | null = null;

/** L'énoncé que la voix du web dit en ce moment, retenu par ce module ; `null` sinon. */
export function enonceRetenu(): SpeechSynthesisUtterance | null {
  return enonceEnCours;
}

/** Retient un énoncé jusqu'à sa fin ; le suivant prend sa place. `fini` : sa fin, pour `finDuSon`. */
function retenir(u: SpeechSynthesisUtterance, fini: () => void = () => undefined): void {
  enonceEnCours = u;
  const lacher = (): void => {
    if (enonceEnCours === u) enonceEnCours = null;
    fini();
  };
  u.onend = lacher;
  u.onerror = lacher;
}

/* ---------- la fin du son en cours ---------- */

/** Le plafond de l'attente de `finDuSon` : une voix qui ne dit jamais sa fin ne bloque rien. */
export const FIN_DU_SON_MAX_MS = 3000;

/** Le son en cours (fichier, voix du web, voix native) : sa fin, et de quoi la marquer. */
let sonEnCours: { fin: Promise<void>; finir: () => void } | null = null;

/** Un son commence : le précédent est fini. Rend de quoi marquer la fin de celui-ci. */
function commencerSon(): () => void {
  sonEnCours?.finir();
  let resoudre: () => void = () => undefined;
  const fin = new Promise<void>((r) => (resoudre = r));
  const son = {
    fin,
    finir: (): void => {
      if (sonEnCours === son) sonEnCours = null;
      resoudre();
    }
  };
  sonEnCours = son;
  return son.finir;
}

/** Quelque chose se dit-il en ce moment (ou va se dire, après le repos) ? */
export function sonJoue(): boolean {
  return sonEnCours !== null;
}

/**
 * Attend la fin de ce qui se dit, `plafond` millisecondes au plus ; tout de suite si rien ne
 * se dit. C'est ce qu'attend l'avance automatique après une bonne réponse (`Ask.svelte`) :
 * l'écran suivant, qui peut parler à son tour, ne coupe jamais la voix en cours.
 */
export function finDuSon(plafond = FIN_DU_SON_MAX_MS): Promise<void> {
  const son = sonEnCours;
  if (son === null) return Promise.resolve();
  return new Promise<void>((r) => {
    const minuteur = setTimeout(r, plafond);
    void son.fin.then(() => {
      clearTimeout(minuteur);
      r();
    });
  });
}

/**
 * Suit un fichier jusqu'à sa vraie fin (`ended`), ou son arrêt (`pause`, `error`). Rien ne met
 * en pause un fichier qui finit : c'est le navigateur qui le dit fini.
 */
function suivreFichier(l: Lecteur, fini: () => void): void {
  if (typeof l.addEventListener !== 'function') {
    fini();
    return;
  }
  const fin = new AbortController();
  const finir = (): void => {
    fin.abort();
    fini();
  };
  for (const e of ['ended', 'pause', 'error'] as const) l.addEventListener(e, finir, { signal: fin.signal });
}

/**
 * Le repos entre l'arrêt d'une voix et la suivante. WebKit (sur iOS, `cancel()` part vers
 * AVSpeechSynthesizer, qui s'arrête de son côté), Chromium et le greffon natif traitent l'arrêt
 * à part : un `speak` qui le suit de trop près peut être pris dans l'arrêt, et la voix neuve
 * est coupée net ou ne dit rien. On ne laisse ce repos qu'après un vrai arrêt : quand rien ne
 * jouait, la voix part tout de suite, dans le geste de l'apprenant.
 */
export const REPOS_APRES_ARRET_MS = 150;

/** L'instant du dernier arrêt effectif d'un son (`taireTout`), pour le repos qui le suit. */
let dernierArret = Number.NEGATIVE_INFINITY;

/** Le nombre de phrases confiées au greffon natif qu'il n'a pas encore finies ni arrêtées. */
let natifEnCours = 0;

/**
 * Fait taire ce qui joue : le fichier, la voix du web, la voix native. Seulement ce qui joue :
 * un `cancel()` ou un `stop()` lancé sans raison juste avant un `speak` rognait la voix
 * suivante (la règle « un seul son à la fois » en lançait un à chaque « Écouter », deux fois).
 * `tout` : sans regarder ce qui joue (`taire`, l'écran qui s'en va, le micro qui s'ouvre).
 * Rend `true` si quelque chose a été arrêté.
 */
function taireTout(tout = false): boolean {
  let arrete = false;
  try {
    if (cree && unique !== null && (tout || unique.paused !== true)) {
      unique.pause();
      arrete = true;
    }
  } catch {
    /* un lecteur déjà arrêté */
  }
  try {
    const s = synthese();
    if (s !== null && (tout || s.speaking === true || s.pending === true)) {
      s.cancel();
      enonceEnCours = null;
      arrete = true;
    }
  } catch {
    /* rien à faire taire */
  }
  const n = natif();
  if (n !== null && (tout || natifEnCours > 0)) {
    void n.taire().catch(() => undefined);
    arrete = true;
  }
  if (arrete) dernierArret = maintenant();
  /* ce qui se disait est fini, arrêté ou pas encore parti */
  sonEnCours?.finir();
  return arrete;
}

/** L'horloge du repos ; `Date.now`, que les minuteurs d'essai de Vitest savent avancer. */
function maintenant(): number {
  return Date.now();
}

/**
 * Lance `parler` tout de suite, ou après le repos qui suit un arrêt (`REPOS_APRES_ARRET_MS`),
 * si la demande `moi` n'a pas été dépassée entre-temps.
 */
function apresRepos(moi: number, parler: () => void): void {
  const reste = dernierArret + REPOS_APRES_ARRET_MS - maintenant();
  if (reste <= 0) {
    parler();
    return;
  }
  setTimeout(() => {
    if (moi === tour) parler();
  }, reste);
}

/** Deux demandes du même texte plus rapprochées que ça n'en font qu'une (`prononcer`). */
export const DOUBLON_MS = 400;

/** La dernière demande de `prononcer`, pour reconnaître son doublon. */
let derniere: {
  texte: string;
  file: string | undefined;
  a: number;
  tour: number;
  dit: Promise<Dit>;
  rendu: Dit | null;
} | null = null;

/**
 * Dit un texte, par la voix que règle « Voix » (`voixChoisie`) : la voix de l'appareil, ou le
 * fichier pré-généré ; chacune est le repli de l'autre ; sans aucune, rien, en silence. Ce
 * qui jouait se tait d'abord. Rend ce qui s'est passé (`Dit`). Une demande dépassée par une
 * plus récente, le temps de lire le manifeste ou de charger le fichier, ne joue plus rien et
 * rend `bloque` : rien ne s'est dit pour elle, et rien ne parle par-dessus la suivante.
 *
 * Le même texte redemandé moins de `DOUBLON_MS` après, sans rien entre les deux (un double
 * toucher, un effet qui se relance, un double rendu), ne coupe pas ce qui commence à se dire
 * pour le redire : il rend la même demande. Sauf si elle n'a rien dit (`bloque`, `muet`) : le
 * second toucher est alors le geste qu'attendait le navigateur.
 */
export function prononcer(texte: string, file?: string): Promise<Dit> {
  const d = derniere;
  if (
    d !== null &&
    d.texte === texte &&
    d.file === file &&
    d.tour === tour &&
    maintenant() - d.a < DOUBLON_MS &&
    (d.rendu === null || d.rendu === 'fichier' || d.rendu === 'telephone')
  ) {
    return d.dit;
  }
  const dit = prononcerSansDoublon(texte, file);
  /* `prononcerSansDoublon` a déjà pris son rang : `tour` est le sien. */
  const cette = { texte, file, a: maintenant(), tour, dit, rendu: null as Dit | null };
  derniere = cette;
  void dit.then((r) => (cette.rendu = r));
  return dit;
}

async function prononcerSansDoublon(texte: string, file?: string): Promise<Dit> {
  const moi = ++tour;
  taireTout();
  const m = await manifesteOnce(file);
  if (moi !== tour) return 'bloque';
  const appareilDabord = voixChoisie() === 'appareil';
  if (appareilDabord && direParLeTelephone(texte, moi)) return 'telephone';
  const c = chemin(m, texte);
  let refuse = false;
  if (c !== null) {
    const l = lecteur();
    if (l !== null) {
      l.src = urlAudio(c);
      l.currentTime = 0;
      const fini = commencerSon();
      suivreFichier(l, fini);
      try {
        await l.play();
        return moi === tour ? 'fichier' : 'bloque';
      } catch (e) {
        fini();
        /* dépassée : une autre demande a pris le lecteur ; ne rien dire par-dessus */
        if (moi !== tour) return 'bloque';
        /* lecture refusée ou fichier introuvable : on tente la voix du téléphone */
        refuse = refusSansEchec(e);
      }
    }
  }
  if (!appareilDabord && direParLeTelephone(texte, moi)) return 'telephone';
  return refuse ? 'bloque' : 'muet';
}

/**
 * Joue un son déjà en mémoire (l'enregistrement de l'apprenant, « Réécouter »), par l'URL
 * locale d'un `Blob`, sur le même lecteur : ce qui jouait se tait. Rend `true` s'il joue.
 */
export async function jouerSon(url: string): Promise<boolean> {
  const moi = ++tour;
  taireTout();
  const l = lecteur();
  if (l === null) return false;
  l.src = url;
  l.currentTime = 0;
  const fini = commencerSon();
  suivreFichier(l, fini);
  try {
    await l.play();
    return moi === tour;
  } catch {
    fini();
    return false;
  }
}

/** Fait taire l'app : l'écran qui disait quelque chose s'en va, le micro s'ouvre. */
export function taire(): void {
  tour += 1;
  taireTout(true);
}

/** Dit un texte, comme `prononcer`. Rend `true` si quelque chose a été dit. */
export async function dire(texte: string, file?: string): Promise<boolean> {
  const d = await prononcer(texte, file);
  return d === 'fichier' || d === 'telephone';
}

/**
 * La voix du téléphone : une seule phrase à la fois, en mandarin, par la voix classée en
 * tête (`classerVoix`), terminée par un point final (`enonce`). Dans l'app iOS, par la
 * synthèse native ; ailleurs, `speechSynthesis`, un peu ralentie (`vitesse`). Ce qui jouait
 * se tait, et la voix ne part qu'après le repos qui suit cet arrêt (`apresRepos`). `moi` : le
 * rang de la demande (`prononcer`) ; un appel direct en prend un nouveau.
 */
export function direParLeTelephone(texte: string, moi = ++tour): boolean {
  const voix = voixMandarin();
  if (voix === null || moi !== tour) return false;
  const n = natif();
  const rang = n === null ? -1 : voixNatives.indexOf(voix);
  if (n !== null && rang >= 0) {
    taireTout();
    reglerSession('playback');
    const son = commencerSon();
    apresRepos(moi, () => {
      natifEnCours += 1;
      const fini = (): void => {
        natifEnCours = Math.max(0, natifEnCours - 1);
        son();
      };
      /* Le greffon rend la main à la fin de la phrase (ou à son arrêt). */
      void n.dire(enonce(texte), voix.lang, rang).then(fini, fini);
    });
    return true;
  }
  const s = synthese();
  if (s === null) return false;
  const web = s.getVoices().find((v) => v.voiceURI === voix.voiceURI && v.lang === voix.lang);
  if (!web) return false;
  taireTout();
  let u: SpeechSynthesisUtterance;
  try {
    /* Le point final donne sa chute à la syllabe (`enonce`) ; la vitesse se lit sur le texte. */
    u = new SpeechSynthesisUtterance(enonce(texte));
    u.voice = web;
    u.lang = web.lang;
    u.rate = vitesse(texte);
  } catch {
    /* une voix que le navigateur refuse : rien n'est dit */
    return false;
  }
  const son = commencerSon();
  const parler = (): boolean => {
    retenir(u, son);
    try {
      s.speak(u);
      return true;
    } catch {
      /* une voix que le navigateur refuse : rien n'est dit */
      enonceEnCours = null;
      son();
      return false;
    }
  };
  /* Sans arrêt juste avant, la voix part tout de suite, dans le geste : iOS l'exige la première fois. */
  if (dernierArret + REPOS_APRES_ARRET_MS <= maintenant()) return parler();
  apresRepos(moi, () => void parler());
  return true;
}

/**
 * Préchargement facultatif : va chercher les fichiers d'une liste de textes pour que
 * le premier toucher ne tourne pas dans le vide. Sans effet sur ce qui n'a pas de voix,
 * et silencieux en cas d'échec — le service worker précache déjà ces fichiers.
 */
export async function precharger(textes: string[], file?: string): Promise<number> {
  const m = await manifesteOnce(file);
  const chemins = textes.map((t) => chemin(m, t)).filter((c): c is string => c !== null);
  await Promise.all(
    chemins.map((c) => requete(urlAudio(c)).catch(() => undefined))
  );
  return chemins.length;
}
