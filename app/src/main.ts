import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import './lib/tokens.css';

/*
 * Un seul thème, le papier clair : l'ancien réglage (système, clair ou sombre) n'a plus
 * d'effet. Sa clé est effacée du stockage local ; la progression, dans IndexedDB, n'y
 * est pour rien.
 */
try {
  localStorage.removeItem('zilin-theme');
} catch {
  /* stockage indisponible : rien à effacer */
}

/**
 * Service worker : l'app et son contenu sont précachés, donc utilisables hors ligne.
 *
 * Mise à jour : la version neuve se télécharge en silence et attend (`registerType:
 * 'prompt'`). Elle ne s'applique — rechargement compris — que lorsque l'app passe au
 * second plan : jamais sous les yeux de l'utilisateur, jamais au milieu de l'anecdote
 * ou d'un pas. Retour du propriétaire : l'anecdote « se fermait seule », c'était le
 * rechargement de la mise à jour. La recherche d'une version a lieu au lancement et au
 * retour du second plan ; la progression est écrite dans IndexedDB à chaque tap.
 */
let versionPrete = false;
const appliquer = registerSW({
  immediate: true,
  onNeedRefresh() {
    versionPrete = true;
  },
  onRegisteredSW(_url, sw) {
    if (!sw) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void sw.update();
    });
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && versionPrete) void appliquer(true);
});

export default mount(App, { target: document.getElementById('app')! });
