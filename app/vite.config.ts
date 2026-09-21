import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      // Le manifest, les icônes, les polices et le contenu JSON servi avec l'app :
      // tout ce qui doit répondre hors ligne est précaché.
      workbox: { globPatterns: ['**/*.{js,css,html,webmanifest,json,svg,png,woff2}'] }
    })
  ],
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2020' }
});
