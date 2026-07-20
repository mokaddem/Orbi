/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// Deployed to GitHub Pages under a project subpath, so the production build (and the
// preview server that mimics it) are served from `/Orbi/`. The dev server stays
// at root `/` to keep the pinned http://localhost:5180 workflow friction-free — safe
// because routing is hash-based and all asset URLs go through Vite's `base`.
const BASE = '/Orbi/';

// Single source of truth for the app version is package.json. Read it here and inject it
// as a compile-time constant (see `define` below) so it can be shown in the UI (Settings →
// About) without any client module importing package.json (which would trip TS rootDir).
const APP_VERSION: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
).version;

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? BASE : '/',
  // Compile-time textual replacement, so it applies to the client build and the Vitest
  // transform alike (Settings.svelte reads `__APP_VERSION__` directly).
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    svelte(),
    svelteTesting(),
    VitePWA({
      // Ship updates silently: a new deploy's service worker takes over and reloads on the
      // next visit, no update prompt to build/maintain for a single-user offline app.
      registerType: 'autoUpdate',
      // Inject the registration script into index.html so no app code imports the PWA
      // virtual module (keeps the Vitest/jsdom suite free of SW mocking).
      injectRegister: 'auto',
      // The Apple touch icon is only referenced from index.html (not the web manifest), so
      // add it to the precache explicitly. PNG is intentionally not in globPatterns below
      // (the manifest's own PNG icons are auto-precached by the plugin), so this adds no
      // duplicate entry.
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Orbi',
        short_name: 'Orbi',
        description:
          'Orbi — an offline-first game for learning world geography through maps, flags, capitals and more.',
        lang: 'en',
        // Matches --color-accent / --color-bg in src/app.css ("Orbi Play" theme, Phase 34):
        // teal accent retained, cool mint-white ground for the splash background.
        theme_color: '#10a5a0',
        background_color: '#eafaf8',
        display: 'standalone',
        orientation: 'any',
        // Prefer opening in-scope links (e.g. a shared `…/Orbi/#/duel?c=…` challenge) in the
        // installed app rather than a browser tab, and navigate an already-open instance to the
        // link instead of spawning a new window. Chromium (Android/desktop) honours these; iOS and
        // in-app chat browsers ignore them and still open a tab (platform limitation).
        handle_links: 'preferred',
        launch_handler: { client_mode: 'navigate-existing' },
        // start_url and scope intentionally omitted: browsers derive them from the
        // manifest's location (served from BASE), so this stays base-path-agnostic.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Precache the whole app shell plus every gameplay asset needed offline:
        // JS/CSS/HTML, the dataset + TopoJSON geometry (json), all flag SVGs, and the
        // bundled sound jingles (ogg — Phase 36) so audio works with no connection.
        // (The web manifest and its PNG icons are auto-added by vite-plugin-pwa, so they
        // are deliberately left out of the glob to avoid duplicate precache entries.)
        globPatterns: ['**/*.{js,css,html,svg,json,woff,woff2,ogg}'],
        // The bundled TopoJSON (~750 KB) is the largest single asset; keep headroom.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      // Enable the service worker under `vite preview` (port 5181) so offline behaviour can
      // be verified against the production build; the dev server stays SW-free.
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
}));
