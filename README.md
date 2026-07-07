# Geography Quiz

Bilingual (EN / FR), offline-first web game for learning world geography via **map** and
**flag** quizzes, with spaced-repetition training on the countries you get wrong. Fully
client-side SPA — no backend; gameplay data is bundled statically and progress lives in the
browser (IndexedDB).

See [`docs/main_PRD.md`](docs/main_PRD.md) for the full product spec, architecture, and the
phase-by-phase plan.

## Tech stack

Svelte 5 + Vite + TypeScript · hash-based routing (`svelte-spa-router`) · custom lightweight
i18n store · installable, offline-capable **PWA** (`vite-plugin-pwa` / Workbox) · Vitest
(+ `@testing-library/svelte`) · ESLint + Prettier.

## Getting started

```sh
npm install
npm run dev       # dev server on http://localhost:5180
```

## Scripts

| Script            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Start the Vite dev server (port **5180**, strict).     |
| `npm run build`   | Production build to `dist/`.                            |
| `npm run preview` | Preview the production build (port **5181**, strict).  |
| `npm run test`    | Run the Vitest suite once.                             |
| `npm run test:watch` | Run Vitest in watch mode.                           |
| `npm run check`   | Type-check with `svelte-check`.                         |
| `npm run lint`    | Lint (ESLint) and verify formatting (Prettier).        |
| `npm run format`  | Format the codebase with Prettier.                     |

## Project structure

```
src/
  domain/   Pure, framework-agnostic game logic (generator, scoring, SM-2). [later phases]
  data/     Static dataset + IndexedDB persistence.                          [later phases]
  i18n/     Language store + EN/FR message dictionaries + pure translator.
  ui/       Svelte components: app shell, nav, and routed screens.
  App.svelte, main.ts, app.css
```

Routing is hash-based (`#/`, `#/play`, `#/history`, `#/settings`, ...) so the app works as a
static, offline-capable PWA without server-side route handling.

## PWA / offline

The production build is an installable PWA. A Workbox service worker (via `vite-plugin-pwa`)
precaches the whole app shell plus every gameplay asset needed offline — the bundled dataset,
the TopoJSON map geometry, and all flag SVGs — so after the first load every mode plays with
no network. Updates are applied automatically on the next visit.

- Verify offline locally: `npm run build && npm run preview`, open the preview URL, then in
  DevTools → Network toggle **Offline** and reload — all four modes should still work.
- PNG icons live in `public/` and are generated from `public/favicon.svg` by
  `scripts/gen-icons.sh` (requires Inkscape); re-run it if the favicon design changes.

## Deployment (GitHub Pages)

The app deploys to a GitHub Pages **project site**, so `base` is pinned to `/geography-quiz/`
in `vite.config.ts` (the dev server stays at `/`). Pushing to `main` runs
`.github/workflows/deploy.yml`, which builds and publishes `dist/`. One-time setup: repo
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Hosting elsewhere? Change `base` in `vite.config.ts` — `'/'` for a domain root or Netlify,
`'/<repo>/'` for a differently-named GitHub Pages project — then serve `dist/` as static
files. Routing is hash-based, so no server rewrite rules are required.
