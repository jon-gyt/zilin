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
      //
      // Le dictionnaire de Chercher (`dictionnaire.ts`, `data/schema.md`) : son index,
      // `dico/index.json` (≈ 520 Kio, ≈ 150 Kio transférés), est précaché comme tout JSON ;
      // ses lots d'entrées (`dico/caracteres/`, `dico/mots/`, ≈ 2,7 Mio) et de traits
      // (`traits/dico-*.json`, ≈ 7,9 Mio) ne le sont pas : chaque installation paierait
      // ≈ 3,8 Mio transférés pour des fiches qu'elle n'ouvrira peut-être jamais. Ils se
      // mettent en cache à la première lecture (`CacheFirst`) et se relisent ensuite hors
      // ligne. Leur URL porte l'empreinte de l'export (`?v=`, `urlDeLot`) : un nouvel export
      // ne sert jamais un lot d'hier ; les anciens sortent par `maxEntries`.
      //
      // Les gabarits de l'écriture au doigt (`data/<version>/ecriture/`, ~470 Kio) ne sont pas
      // précachés non plus : le pavé ne s'ouvre qu'avec Wenlu complet, jamais sur le web
      // (`droits.ts`), et le shell iOS les porte dans son paquet. Lus une fois, ils restent
      // (`CacheFirst`) : le pavé marche ensuite hors ligne.
      //
      // `trois-lignes.json` porte un texte par jour des deux chemins entiers (~2,9 Mo compact,
      // glossaire commun écrit une fois) : il se lit hors ligne dès le premier jour, d'où la
      // limite du précache portée à 4 Mio (2 Mio par défaut).
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,webmanifest,json,svg,png,woff2,mp3,md,txt,TXT}'],
        globIgnores: [
          '**/node_modules/**/*',
          'data/*/apercu/**',
          'data/*/dico/caracteres/**',
          'data/*/dico/mots/**',
          'data/*/traits/dico-*.json',
          'data/*/ecriture/**',
          ...GLOB_HORS_PRECACHE
        ],
        navigateFallbackDenylist: [motifPagesDuSite(process.env.BASE_PATH)],
        runtimeCaching: [
          {
            urlPattern: /\/data\/[^/]+\/apercu\/.+\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'wenlu-apercu', expiration: { maxEntries: 400 } }
          },
          {
            urlPattern: /\/data\/[^/]+\/ecriture\/.+\.json(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wenlu-ecriture',
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: /\/data\/[^/]+\/(?:dico\/(?:caracteres|mots)\/\d+|traits\/dico-\d+)\.json(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wenlu-dictionnaire',
              expiration: { maxEntries: 400 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2020' }
});
