import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { GLOB_HORS_PRECACHE, motifPagesDuSite } from './scripts/site/chemins';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // `prompt` : la version neuve attend ; `main.ts` ne l'applique que quand l'app passe
      // au second plan, jamais sous les yeux de l'utilisateur (l'anecdote se fermait seule).
      registerType: 'prompt',
      manifest: false,
      // Le manifest, les icônes, les polices, le contenu JSON et la voix pré-générée :
      // tout ce qui doit répondre hors ligne est précaché. `md` et `txt` y sont
      // pour les textes de licence de l'export (ARPHICPL.TXT, LICENCES.md) :
      // l'écran « Licences » les lit hors ligne (docs/sources-licences.md §8).
      // `TXT` en plus de `txt` : les textes de l'Arphic Public License sont écrits en
      // majuscules à côté des tracés qu'ils couvrent, et le glob est sensible à la casse.
      //
      // Le site public (story 5.2, `scripts/site/`) partage l'artefact Pages et la base :
      // il ne doit ni être précaché, ni recevoir `index.html` de l'app par la route de
      // navigation du service worker, dont la portée couvre toute la base.
      //
      // L'aperçu des textes à relire (`data/<version>/apercu/`) n'est pas précaché : ~440 Kio
      // que seul le propriétaire lit, interrupteur allumé dans les Réglages, et que chaque
      // installation téléchargerait sinon. Il est mis en cache au fil de la lecture
      // (`NetworkFirst`) : ce qui a été ouvert une fois se relit hors ligne, le reste attend
      // le réseau — acceptable pour un aperçu. Ce sont des fichiers de l'app, servis avec
      // elle : aucune requête ne sort de son origine.
      workbox: {
        globPatterns: ['**/*.{js,css,html,webmanifest,json,svg,png,woff2,mp3,md,txt,TXT}'],
        globIgnores: ['**/node_modules/**/*', 'data/*/apercu/**', ...GLOB_HORS_PRECACHE],
        navigateFallbackDenylist: [motifPagesDuSite(process.env.BASE_PATH)],
        runtimeCaching: [
          {
            urlPattern: /\/data\/[^/]+\/apercu\/.+\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'wenlu-apercu', expiration: { maxEntries: 400 } }
          }
        ]
      }
    })
  ],
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2020' }
});
