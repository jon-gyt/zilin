import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { GLOB_HORS_PRECACHE, motifPagesDuSite } from './scripts/site/chemins';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,webmanifest,json,svg,png,woff2,mp3,md,txt,TXT}'],
        globIgnores: ['**/node_modules/**/*', ...GLOB_HORS_PRECACHE],
        navigateFallbackDenylist: [motifPagesDuSite(process.env.BASE_PATH)]
      }
    })
  ],
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2020' }
});
