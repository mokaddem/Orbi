# Phase 3 — Flag modes UI

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Deliver the first playable experience: the two flag-based modes wired end-to-end to the quiz
engine, including feedback and a summary screen. Establishes the shared Play/Summary UI that
map modes will reuse.

## Depends on
Phase 2 (core quiz engine).

## Scope / Deliverables
- [x] **Flag display component** rendering the bundled SVG flag.
      (`src/ui/components/Flag.svelte` — decorative by default so the prompt/option flag
      isn't leaked via `alt`.)
- [x] **Multiple-choice component** that can present options as either **country names** or
      **flags**, with selection + disabled/locked states.
      (`src/ui/components/ChoiceGrid.svelte` — `variant: 'name' | 'flag'`, correct/wrong/muted
      reveal, guards against picks once answered.)
- [x] **`flag-to-country`** mode: show a flag → pick the country name.
- [x] **`country-to-flag`** mode: show a country name → pick the correct flag.
- [x] **Play screen** wiring the generator + session engine: renders the current question,
      shows a **lives/progress indicator**, and gives **immediate feedback** (reveal the
      correct answer on a miss).
      (`src/ui/routes/Play.svelte` + `src/ui/stores/game.ts` play controller.)
- [x] **Summary screen**: score, accuracy, time, list of missed items, and shortcuts to
      **Retry** and **Train these** (Train is stubbed — a disabled button — until Phase 7).
      (`src/ui/routes/Summary.svelte`.)
- [x] Works for both `fixed` and `survival` session types.

## Technical notes
- Build the Play and Summary screens generically so Phase 4's map modes plug into the same
  flow (mode supplies the "prompt" and "answer input"; the shell handles progress/feedback).
- Route all user-facing text through the i18n layer from Phase 0.

## Acceptance criteria
- Both flag modes are playable start-to-finish for fixed and survival.
- Feedback correctly reveals answers on miss; the summary reflects real score/time/misses.

## Out of scope
- Map rendering (Phase 4), region filter UI (Phase 5), persistence (Phase 6), SR (Phase 7).

## Progress log
- **2026-07-07 — Phase complete. ✅**
  - **i18n:** added `modes.*`, `sessionType.*`, `play.*` (setup/prompt/progress/feedback),
    and `summary.*` keys to `en.ts` / `fr.ts`; added a reactive `localizedName` derived
    store to `src/i18n/index.ts` for `$localizedName(country)` (locale-aware country names).
  - **Components:** `Flag.svelte` (bundled SVG via `flagUrl`, `alt` empty by default so the
    prompt/option flag doesn't reveal the answer) and `ChoiceGrid.svelte` (name/flag
    variants, selection, locked + correct/wrong/muted reveal states; refuses picks once
    answered). Shared `--color-correct*/--color-wrong*` tokens added to `app.css`.
  - **Play controller:** `src/ui/stores/game.ts` — a `play` store wrapping the pure
    `QuizSession` (`start`/`answer`/`advance`/`summary`/`reset`), plus `lastSummary` and
    `pendingConfig` writables for the Summary handoff and Retry auto-start. It captures the
    per-question feedback the session discards on `submit()`.
  - **Screens:** `Play.svelte` now renders a setup step (mode + fixed/survival) and a
    **generic play shell** (progress bar / hearts, mode-specific prompt + answer surface,
    feedback banner with reveal, Continue/See-results). The shell is mode-agnostic so
    Phase 4's map modes plug into the same flow by adding prompt/answer branches.
    `Summary.svelte` shows score/accuracy/time/best-streak, the missed list (flag + name),
    and Retry / Train (stub) / New game.
  - **Tests (24 new, 101 total passing):** `Flag.test.ts`, `ChoiceGrid.test.ts`,
    `format.test.ts`, `stores/game.test.ts` (full session controller incl. survival end +
    missed tracking), and `routes/Play.test.ts` (renders the real route, plays a fixed
    session end-to-end via button clicks, asserts the summary handoff).
  - **Verification:** `npm run test` (101 pass), `npm run check` (0 errors),
    `npm run lint` (clean), `npm run build` (bundles cleanly). Real headless Chrome
    (`--dump-dom`) confirmed Home + Play-setup render post-JS with i18n resolved.
  - **Notes / deviations:** mode selection lives on the Play route (setup state) rather than
    a separate Home mode-select — Home's "Start playing" links there. Region-filter,
    persistence, and SR remain out of scope (Phases 5–7); the engine's `filter` is threaded
    through `RunConfig` but not yet exposed in the setup UI.
