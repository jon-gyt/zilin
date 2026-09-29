/**
 * La voix chinoise de l'iPhone dans l'app iOS : AVSpeechSynthesizer, par le greffon
 * `@capacitor-community/text-to-speech` (MIT, version 4 pour Capacitor 6).
 *
 * Pourquoi un greffon : dans la WebView de l'app (WKWebView), `speechSynthesis` ne montre pas
 * de façon sûre les voix « Améliorée » et « Premium » que l'apprenant a téléchargées, ni ne
 * laisse choisir la session audio ; AVSpeechSynthesizer les voit toutes
 * (`AVSpeechSynthesisVoice.speechVoices()`, dont l'identifiant dit la qualité :
 * `com.apple.voice.premium.zh-CN.…`). Le greffon parle sur l'appareil, sans réseau.
 *
 * Les Apple Foundation Models (Apple Intelligence) ne font pas de synthèse vocale : ce sont
 * des modèles de texte. La voix « de l'IA de l'iPhone », ce sont ces voix neuronales du
 * système.
 *
 * Sur le web, et partout hors de Capacitor, rien : `audio.ts` passe par `speechSynthesis`.
 */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import type { SyntheseNative } from './audio';

/** Vrai dans l'app native, où le greffon est installé. */
export function voixNativeDisponible(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TextToSpeech');
}

/** La synthèse native, `null` hors de l'app iOS. */
export function syntheseNative(): SyntheseNative | null {
  if (!voixNativeDisponible()) return null;
  return {
    voix: async () => (await TextToSpeech.getSupportedVoices()).voices,
    /* `voice` : le rang dans la liste de `getSupportedVoices`, qui est celle d'AVSpeechSynthesisVoice. */
    dire: (texte, lang, rang) => TextToSpeech.speak({ text: texte, lang, voice: rang, rate: 1, category: 'playback' }),
    taire: () => TextToSpeech.stop()
  };
}
