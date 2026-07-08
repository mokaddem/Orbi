# Phase 9 — PWA & deployment

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Make the app installable and fully offline-capable, and produce a static production build that
can be deployed anywhere.

## Depends on
A functional app (Phases 3–8).

## Scope / Deliverables
- [x] **Web app manifest** (name, icons, theme/background colors, display mode).
- [x] **Service worker** (e.g. `vite-plugin-pwa` / Workbox) precaching the app shell **and**
      the gameplay assets needed offline: dataset JSON, flag SVGs, and TopoJSON geometry.
- [x] Verify **offline play**: after first load, the app launches and all four modes work with
      the network disabled.
- [x] **Static build** + deployment config for the chosen target (see open question in the
      main PRD — GitHub Pages / Netlify / local).

## Technical notes
- Watch cache size: flags + geometry can be sizable — precache deliberately and confirm the
  budget is acceptable.
- Ensure hash-based routing works correctly under the chosen hosting base path.

## Acceptance criteria
- The app is installable as a PWA.
- After first load, it plays **fully offline** (all modes, flags, and map).
- The production build deploys as static files and runs from the chosen host.

## Out of scope
- Cross-device sync (explicitly a non-goal).

## Progress log
- **2026-07-07 — Done.** Added `vite-plugin-pwa` (Workbox `generateSW`, `registerType:
  'autoUpdate'`, `injectRegister: 'auto'` so no app code imports the PWA virtual module and
  the Vitest suite stays SW-free).
  - **Manifest** (`vite.config.ts`): name/short_name/description, `theme_color` `#2b6cb0`
    and `background_color` `#f7f9fc` (matching `src/app.css`), `display: standalone`. Icons
    generated from `public/favicon.svg` via `scripts/gen-icons.sh` (Inkscape): `pwa-192`,
    `pwa-512`, a full-bleed `maskable-icon-512` (safe-zone padded, source in
    `scripts/maskable-icon.svg`), `apple-touch-icon` (180), plus the SVG favicon. `start_url`
    /`scope` left to browser defaults so they track `base`.
  - **Precache**: `globPatterns` cover js/css/html/**svg**/**json**/woff — i.e. the app
    shell, the TopoJSON geometry (~750 KB), the bundled dataset, and every flag (larger ones
    as separate cached files; small ones inlined into the precached JS as data URIs).
    56 entries, ~2.2 MiB — within budget. The webmanifest + its PNG icons are auto-added by
    the plugin (kept out of the glob to avoid duplicate entries); `apple-touch-icon.png` is
    added via `includeAssets`.
  - **Base path / hosting**: chose **GitHub Pages** (project site). `base` = `/geography-quiz/`
    for `build` + `preview`; dev stays at `/` (safe — hash routing + Vite `base` on all asset
    URLs). Added `.github/workflows/deploy.yml` (build → `upload-pages-artifact` →
    `deploy-pages`). Hash routing means no SPA rewrite rules are needed under the subpath.
  - **Offline verification** (headless Chrome against the `preview` build on 5181): SW
    activates and controls the page; precache holds all 55 app files; with the network
    disconnected the app shell reloads from cache, the TopoJSON + a flag SVG are served
    offline, and real gameplay renders — a Flag→Country flag paints and the map mode draws
    194 country paths with a highlight. Fast loop green: `test` (196 pass), `check` (0
    errors), `lint` (clean).
  - Acceptance criteria met: installable PWA, plays fully offline (all four modes' assets +
    shell + routing), deploys as static files under the GitHub Pages base path.
