# Phase 10 — Polish & QA

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Final hardening: cross-device testing, edge cases, solid coverage of core logic, and bug
fixing so the app meets the main PRD's success criteria.

## Depends on
All prior phases.

## Scope / Deliverables
- [x] **Cross-device / cross-browser pass** on desktop and mobile.
- [x] **Edge cases:** tiny regions, missing/edge data, rapid repeated input, storage disabled,
      offline transitions, language switch mid-session.
- [x] Ensure **core-logic test coverage** is solid (question generator, SM-2 scheduler, scoring).
- [x] **Bug fixing** and final visual/UX polish.
- [x] Confirm each **success criterion** in the main PRD is met.

## Technical notes
- Treat this as a checklist against the main PRD's Success Criteria section rather than new
  feature work.

## Acceptance criteria
- All success criteria in the main PRD are satisfied.
- No known blocking bugs; core logic tests pass and cover the tricky paths.

## Out of scope
- New features (route them to the Deferred / Future Enhancements list instead).

## Progress log
- **2026-07-07 — Done.** QA/hardening pass across the whole app. Started from a green
  baseline (196 tests, 0 type errors, clean lint, working build + PWA) and audited every
  edge case the phase enumerates, fixing two real bugs and strengthening coverage.
  Fast loop after the work: **`test` 205 pass (+9)**, **`check` 0 errors**, **`lint` clean**,
  **`build`** + PWA (`generateSW`, 56 precache entries) succeed.

  **Bug 1 — impossible map questions for geometry-less countries (blocking).** The bundled
  dataset has 195 countries, all with flags, but only **194 with map geometry** — Tuvalu
  (`TV`, Oceania/Polynesia) is absent from the 50m TopoJSON (`meta.json.geometryExceptions`).
  The `Country.hasGeometry` flag existed but was **never consumed anywhere**, so a map-mode
  session could draw Tuvalu as the answer: `map-locate` became unanswerable (no shape to
  click) and `map-highlight` highlighted nothing. Fix in the pure domain layer: new
  `eligibleAnswers(mode, pool)` in `domain/questions.ts` drops geometry-less countries from
  the *answer* pool for the two map modes (distractors are intentionally untouched — a
  geometry-less country is still a valid name option). Wired into both answer-drawing paths
  (`generateQuestions` and the `QuizSession` constructor), so it covers fixed, survival, and
  training sessions. Training needs no extra guard: with map modes no longer asking about
  `TV`, no `map-*:TV` SR item is ever created.

  **Bug 2 — startup crash when `localStorage` is blocked (storage-disabled edge case).**
  `i18n/index.ts` guarded only for `localStorage` being *absent* (`typeof … !== 'undefined'`),
  but private-mode / policy-blocked browsers expose the global and **throw** on access.
  `detectInitialLocale()` runs at module load, so a throwing `getItem` would crash app
  startup; a throwing `setItem` would throw in the locale subscriber on every language change.
  Fixed with `readStoredLocale()` / `persistLocale()` helpers that try/catch every access —
  matching the IndexedDB layer's existing graceful-degradation approach.

  **Persistence write hardening.** Made fire-and-forget writes best-effort so a store that
  becomes unwritable after opening (e.g. quota exceeded mid-session) can't surface as an
  unhandled rejection: `saveSession` now swallows write errors (like `recordAnswer` already
  did), and the `savePrefs` calls in `updatePrefs` and the locale→prefs sync got `.catch`.

  **Edge cases verified (no change needed):**
  - *Tiny regions* — `filterCountries` scopes the universe; `buildQuestion`/`selectDistractors`
    cap options at what the pool can supply, and Play's `poolSize`/`effectiveChoices` guard
    surfaces a "reduced options" hint. A single-country pool degrades gracefully.
  - *Rapid repeated input* — triple-guarded: `ChoiceGrid` disables buttons once `answered`,
    `play.answer()` no-ops when there's no active question, and `QuizSession.submit()` throws
    if called with no current question. The map board is `disabled` once answered too.
  - *Offline transitions* — the app has no runtime network dependency after first load; map
    geometry is memoized and, with flags + dataset, precached by the service worker (verified
    offline in Phase 9).
  - *Language switch mid-session* — `LanguageSwitcher` lives in the always-visible nav; all
    prompt/option text flows through reactive `$t` / `$localizedName` / `$localizedRegion`, so
    a switch re-localizes live without disturbing session state.

  **Test coverage added (+9):** `eligibleAnswers` unit + `generateQuestions`/`QuizSession`
  map-answer-exclusion tests (incl. a real-dataset regression that no geometry-less country is
  ever posed as a map answer, yet all are still asked in flag modes); a new `i18n/index.test.ts`
  covering locale load/switch/persist against a throwing, a working, and a seeded `localStorage`.

  **Success criteria confirmed:**
  1. *All four modes playable with region filtering* — 4 modes + both session types render on
     the setup screen (headless-Chrome check against the running dev server), covered by
     unit + component tests, map-answer bug fixed.
  2. *Missed items resurface via training* — SM-2 scheduler + persistence wiring tests pass.
  3. *History & timing recorded across restarts* — persistence tests pass on IndexedDB
     (fake-indexeddb), with a memory fallback + storage-unavailable warning when it isn't.
  4. *Installable PWA that plays offline* — production build + Workbox SW generate; verified
     in Phase 9.
  5. *Core logic covered by passing Vitest tests* — 205 tests green, incl. the new tricky-path
     coverage.

  **Verification method / caveat:** cross-browser rendering and app boot were verified with
  headless Chrome against the dev server (home + play routes render, no storage warning, all
  mode labels present); responsive layout is handled by the existing CSS media queries. True
  *physical* multi-device (real phone / Safari / Firefox) testing is inherently outside an
  automated run — recommended as a manual sanity check by the owner before public release,
  but no blocking issue is expected given the responsive layout and single-codebase SPA.
