# Contributing to Orbi

Thanks for taking an interest! 🌍 Orbi is a small, dependency-light, fully client-side geography
game, and contributions — bug reports, ideas, docs, or code — are very welcome.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- 🐛 **Report a bug** — open an issue with steps to reproduce (there's a template).
- 💡 **Suggest a feature** — open a feature-request issue and tell us what you'd love to play.
- 🌐 **Improve translations** — spot an awkward EN/FR/DE string? Let us know or send a PR.
- 🧑‍💻 **Send a pull request** — see the workflow below.

## Getting set up

You'll need **Node.js 22+** (the version CI runs on) and npm.

```sh
git clone https://github.com/mokaddem/Orbi.git
cd Orbi
npm install
npm run dev        # dev server on http://localhost:5180
```

The dev server is pinned to port **5180** (strict). Start it once and leave it running.

## Scripts

| Script               | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Vite dev server on port **5180** (strict).                      |
| `npm run build`      | Production build to `dist/` (regenerates the bundled dataset).  |
| `npm run preview`    | Serve the production build on port **5181** for PWA/offline QA. |
| `npm run test`       | Run the Vitest suite once.                                      |
| `npm run test:watch` | Run Vitest in watch mode.                                       |
| `npm run check`      | Type-check with `svelte-check`.                                 |
| `npm run lint`       | ESLint + `prettier --check`.                                    |
| `npm run format`     | Format the codebase with Prettier.                              |

## Project structure

```
src/
  domain/   Pure, framework-agnostic game logic (quiz generator, scoring, SM-2 spaced repetition).
  data/     Static dataset + generated assets (flags, TopoJSON) + IndexedDB persistence.
  i18n/     Language store + EN/FR/DE message dictionaries + pure translator.
  ui/       Svelte 5 components: app shell, responsive nav, and routed screens.
  App.svelte, main.ts, app.css
docs/       Product spec (main_PRD.md), per-phase PRDs, and screenshots.
scripts/    Build-time data generation (build-data.mjs) and icon tooling.
```

Routing is **hash-based** (`#/`, `#/play`, `#/atlas`, …) so the app works as a static, offline
PWA with no server-side route handling. Progress lives entirely in **IndexedDB** — there is no
backend and nothing leaves the browser.

## How this project is built

Orbi is developed **phase by phase** against a product spec. If you're planning a larger change,
skim [`docs/main_PRD.md`](docs/main_PRD.md) — its status table and per-phase PRDs (in `docs/phases/`)
explain the architecture, the shared data model, and the reasoning behind each feature.

## Coding conventions

- **Keep domain logic pure and framework-agnostic** so it stays unit-testable — UI concerns live
  in `src/ui`, game rules live in `src/domain`.
- **Keep dependencies minimal.** New runtime dependencies should earn their place.
- **Trilingual by default** — any user-facing string goes through the i18n store with EN, FR *and*
  DE entries. Any new per-country data point should also surface on the Atlas country page.
- **Match the surrounding style** — Prettier + ESLint are the source of truth; run `npm run format`
  before committing.

## Testing

- **Every change:** run `npm run test`, `npm run check` and `npm run lint`, plus a quick manual
  check in the browser.
- **Offline / PWA changes:** verify against the production build — `npm run build && npm run preview`,
  then toggle **Offline** in DevTools and reload; all modes should still work.

## Pull request workflow

1. Fork the repo and create a branch from `main` (`git checkout -b my-change`).
2. Make your change, with tests where it makes sense.
3. Make sure `npm run lint`, `npm run check` and `npm run test` all pass — CI runs the same checks.
4. Open a PR describing **what** changed and **why**. Screenshots are gold for UI changes.

CI (`.github/workflows/ci.yml`) will lint, type-check, test and build your PR automatically.
Merges to `main` are published to GitHub Pages by `.github/workflows/deploy.yml`.

Thanks again — happy mapping! 🗺️
