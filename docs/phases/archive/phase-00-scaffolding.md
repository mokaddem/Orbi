# Phase 0 — Project scaffolding

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Stand up the project skeleton so all later phases have a working build, test, lint, routing,
and internationalization foundation to build on. No game logic yet — just the shell.

## Depends on
Nothing (this is the entry point).

## Scope / Deliverables
- [x] Initialize a **Vite + Svelte + TypeScript** project.
- [x] Configure **ESLint + Prettier** (with Svelte + TS plugins) and matching editor config.
- [x] Set up **Vitest** with one trivial passing test to prove the harness works.
- [x] Establish the **directory structure** reflecting the layered architecture, e.g.
      `src/domain/`, `src/data/`, `src/ui/`, `src/i18n/`.
- [x] Add lightweight **client-side routing** (hash-based, PWA-friendly) with placeholder
      routes: Home / mode-select, Play, Summary, History/Stats, Settings.
- [x] Set up **i18n infrastructure** (a language store + message dictionaries) so no UI
      string is hardcoded. Include a demo string rendered in both EN and FR.
- [x] App shell layout (header/nav + router outlet) and a skeleton Home screen.
- [x] npm scripts: `dev`, `build`, `preview`, `test`, `lint`, `format`.

## Technical notes
- Prefer a tiny router (e.g. hash-based `svelte-spa-router`) over anything requiring a server.
- i18n can be a small custom Svelte store or a light lib (e.g. `svelte-i18n`); keep deps low.
- Keep domain logic framework-agnostic and pure so it can be unit-tested without a DOM.

## Acceptance criteria
- `npm run dev` serves the app; navigating between placeholder routes works.
- `npm run test`, `npm run lint`, and `npm run build` all pass.
- Toggling the language switches the demo string between EN and FR at runtime.

## Out of scope
- Real datasets, game modes, persistence — later phases.

## Progress log
- **2026-07-06** — Scaffolded the project and completed all deliverables.
  - **Stack (resolved latest):** Vite 8 · Svelte 5 (runes) · TypeScript 6 · `svelte-check` ·
    Vitest 4 (+ `@testing-library/svelte`, jsdom) · ESLint 9 flat config
    (`typescript-eslint` + `eslint-plugin-svelte` 3) · Prettier (+ `prettier-plugin-svelte`).
  - **Structure:** layered `src/{domain,data,i18n,ui}/`. `domain/` and `data/` hold documented
    placeholders (populated in Phases 1–2); `ui/` has the app shell, `components/`, and routed
    `routes/` screens.
  - **Routing:** hash-based via `svelte-spa-router` (v5). Routes: `#/` Home, `#/play`,
    `#/summary`, `#/history`, `#/settings`, and a `*` NotFound. Nav highlights the active route
    from the library's runes-based `router.location` (note: v5 dropped the old `location` store).
  - **i18n:** a custom lightweight solution to keep deps low — a pure `translate(dict, key, vars)`
    function (dot-path lookup + `{name}` interpolation, key-as-fallback for misses), plus a
    `locale` writable store and a derived reactive `t` store. FR dictionary is typed as
    `typeof en`, so the compiler enforces both languages stay in sync. Locale is auto-detected
    (localStorage → `navigator.language` → `en`), persisted, and mirrored to `<html lang>`.
    Demo string on Home switches EN↔FR live via the header/Settings language switcher.
  - **Ports:** `dev` pinned to **5180**, `preview` to **5181** (both `--strictPort`), matching
    the main-PRD testing strategy.
  - **Tests:** `translate.test.ts` (pure unit) + `Demo.test.ts` (component test proving runtime
    EN↔FR reactivity in jsdom). `npm run test` → 7 passing.
  - **Verification:** `test`, `check` (0 errors, 177 files), `lint` (ESLint + Prettier), and
    `build` all pass. Ran a real-browser smoke with headless Chrome against the dev server:
    `#/`, `#/play`, `#/settings`, and an unknown route each render the correct screen, and the
    French dictionary renders end-to-end under a `fr-FR` browser locale.
  - **Deferred:** Playwright E2E infra is not set up yet — there are no gameplay flows to smoke
    yet, and the jsdom component test + headless-Chrome render already cover Phase 0 behaviour.
    It will be added at the first phase that introduces real session flows.
  - **Also:** populated the **Commands** section of `CLAUDE.md` with the real npm scripts.
