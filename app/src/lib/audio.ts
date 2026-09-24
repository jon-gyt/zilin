/**
 * L'audio de l'app : une voix neuronale pré-générée, servie avec l'app, et en repli
 * la voix du téléphone.
 *
 * Brief §11 : « voix neuronale pré-générée et embarquée pour tous les caractères et
 * mots ; la voix du téléphone en repli ». Ce module lit d'abord un fichier déjà là,
 * dont le chemin vient du manifeste écrit par `wenlu audio exporter` (voir
 * `data/schema.md`). Un texte sans fichier est dit par la synthèse du téléphone
 * (`speechSynthesis`, voix mandarin) quand elle existe ; sinon il ne dit rien, en
 * silence. Aucune requête à un service.
 *
 * Un seul `HTMLAudioElement` pour toute l'app, réutilisé d'un texte à l'autre : sur
 * iOS, un élément déjà débloqué par un geste continue de jouer, et n'en créer qu'un
 * évite d'empiler des lecteurs à chaque toucher.
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

/** Ce que ce module demande à un lecteur : de quoi jouer un fichier, rien de plus. */
export type Lecteur = Pick<HTMLAudioElement, 'src' | 'currentTime' | 'preload' | 'play' | 'pause'>;

/** Ce que ce module demande à la synthèse du téléphone : ses voix, parler, se taire. */
export type Synthese = Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel'>;

function syntheseParDefaut(): Synthese | null {
  return typeof window === 'undefined' || !('speechSynthesis' in window) ? null : window.speechSynthesis;
}

let synthese: () => Synthese | null = syntheseParDefaut;

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
  options: { lecteur?: () => Lecteur | null; fetchFn?: typeof fetch; synthese?: () => Synthese | null } = {}
): void {
  fabrique = options.lecteur ?? lecteurParDefaut;
  synthese = options.synthese ?? syntheseParDefaut;
  requete = options.fetchFn ?? ((...args) => fetch(...args));
  unique = null;
  cree = false;
  charge = null;
  manifestes.clear();
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

/**
 * La voix mandarin du téléphone, `null` s'il n'en a pas. Le mandarin standard d'abord
 * (`zh-CN`), puis toute voix chinoise sauf le cantonais (`zh-HK`).
 */
export function voixMandarin(): SpeechSynthesisVoice | null {
  const s = synthese();
  if (s === null) return null;
  const voix = s.getVoices().filter((v) => /^zh([-_]|$)/i.test(v.lang) && !/hk/i.test(v.lang));
  return voix.find((v) => /^zh[-_]cn/i.test(v.lang)) ?? voix[0] ?? null;
}

/** Le téléphone peut-il dire du mandarin ? */
export function aVoixTelephone(): boolean {
  return voixMandarin() !== null;
}

/**
 * Ce texte peut-il être dit ? Par un fichier pré-généré, ou à défaut par la voix du
 * téléphone. C'est ce qui décide d'un bouton « Écouter » actif.
 */
export function aAudio(m: Manifeste | null, texte: string): boolean {
  return aFichier(m, texte) || aVoixTelephone();
}

/**
 * Dit un texte. Le fichier pré-généré d'abord ; sinon la voix du téléphone ; sinon
 * rien du tout, en silence. Rend `true` si quelque chose a été dit.
 */
export async function dire(texte: string, file?: string): Promise<boolean> {
  const m = await manifesteOnce(file);
  const c = chemin(m, texte);
  if (c !== null) {
    const l = lecteur();
    if (l !== null) {
      l.src = urlAudio(c);
      l.currentTime = 0;
      try {
        await l.play();
        return true;
      } catch {
        /* lecture refusée : on tente la voix du téléphone */
      }
    }
  }
  return direParLeTelephone(texte);
}

/** La voix du téléphone : une seule phrase à la fois, en mandarin, un peu ralentie. */
export function direParLeTelephone(texte: string): boolean {
  const s = synthese();
  const voix = voixMandarin();
  if (s === null || voix === null) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.voice = voix;
  u.lang = voix.lang;
  u.rate = 0.9;
  s.speak(u);
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
