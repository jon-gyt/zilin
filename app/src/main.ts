import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { initTheme } from './lib/theme';
import './lib/tokens.css';

/* Le thème choisi (système, clair ou sombre) est posé avant le premier écran. */
initTheme();

/**
 * Service worker : l'app et son contenu sont précachés, donc utilisables hors ligne.
 *
 * Mise à jour, choix retenu : `registerType: 'autoUpdate'` installe la version neuve
 * et recharge la page dès qu'elle est active. Pour que ce rechargement reste discret,
 * on ne cherche jamais de mise à jour pendant que l'app est au premier plan : la
 * recherche a lieu au lancement, puis au retour du second plan. Le rechargement tombe
 * ainsi à l'ouverture ou au retour, jamais au milieu d'un pas, et il n'y a ni fenêtre
 * modale ni bandeau à fermer — la progression est écrite dans IndexedDB à chaque tap.
 */
registerSW({
  immediate: true,
  onRegisteredSW(_url, sw) {
    if (!sw) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void sw.update();
    });
  }
});

export default mount(App, { target: document.getElementById('app')! });
