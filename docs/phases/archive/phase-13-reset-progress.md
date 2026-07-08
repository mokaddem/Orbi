# Phase 13 — Reset progress in Settings

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.1 enhancements (post-launch)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> The exact scope of "reset progress" (what gets wiped) is a product decision. **The implementer
> MUST ask the owner (Sami) as many clarifying questions as necessary — and get answers — before
> and during implementation, rather than guessing.** Do not begin coding until the
> [Open Questions](#open-questions--to-resolve-with-the-owner) are resolved. Record answers in
> the Progress log.

## Goal
Add a way to **reset progress** from **Settings** (the owner noted it may not exist there —
confirmed: it does not).

## Current state (so scope is clear)
- **Settings** (`src/ui/routes/Settings.svelte`) has language + numeric gameplay prefs, but **no
  reset action**.
- **History** (`src/ui/routes/History.svelte`) has a **"Clear history"** button that calls
  `clearHistory()` → wipes **session records only**.
- The storage port `QuizStore` (`src/data/persistence/types.ts`) exposes `clearSessions()` but
  has **no** way to clear **SR / spaced-repetition state** (`srItems`) or reset prefs, and no
  "clear everything". So a full reset needs **new store methods** on the interface and both
  adapters (`IdbQuizStore`, `MemoryQuizStore`).

## Depends on
Persistence layer (Phase 6) + SR state (Phase 7). Independent of Phases 11–12.

## Scope / Deliverables
- [x] **Reset action in Settings** — two clearly-destructive, separately-confirmed controls in a
      new "Data" section: **Clear history** (`sessions`) and **Reset training** (`srItems`). Each
      gates on an in-app `ConfirmDialog` and disables once its store is empty.
- [x] **Store API** — added `clearSRItems()` to the `QuizStore` interface and to **both** the
      IndexedDB (`db.clear('srItems')`) and in-memory (`srItems.clear()`) implementations.
      (`clearSessions()` already existed.)
- [x] **Live-state refresh** — Settings tracks per-store presence (`historyPresent` /
      `trainingPresent`) via `hasSessions()` / `hasTrainingData()`, recomputed on mount (the route
      remounts on navigation) so the cleared state shows immediately with no manual reload. Prefs
      and language are out of scope, so no prefs/locale refresh is needed.
- [x] **i18n** — new EN/FR strings for the Data section (labels, hints, dialog titles/messages)
      plus a shared `common.cancel`. Parity enforced by `messages.test.ts`.
- [x] **Tests** — `clearSRItems()` contract test on both adapters (asserts history survives a
      training reset); a Settings component test covering confirm, cancel, disabled-when-empty, and
      the Settings "Clear history" path leaving training intact.
- [x] **Reconcile with History's "Clear history"** — kept as a second entry point to the identical
      sessions-clear action (per locked decision), now joined by the Settings control.

## Technical notes
- "Progress" plausibly spans three stores: **history** (`sessions`), **SR/training state**
  (`srItems`), and **preferences** (`prefs`, incl. language). The owner decides which of these
  a "reset" clears — see Open Questions.
- Resetting prefs should also reset the live `prefs` writable (and `locale`/`setLocale`) so the
  UI reflects defaults immediately.
- Keep the destructive action safe: confirmation, and no accidental trigger.

## Open Questions — to resolve with the owner
Ask these (and more as needed) before implementing:
1. **Scope of "reset progress":** history only? history + SR/training state? also reset gameplay
   prefs to defaults? also reset language? (Recommendation: at least history + SR state, since
   both are "progress".)
2. **Granularity:** a single "Reset everything" button, or separate toggles/actions (e.g. "clear
   history" vs "reset training" vs "reset settings")?
3. **Confirmation style:** native `confirm()` (as History uses today), or an in-app modal with a
   typed/explicit confirm for safety?
4. **History's existing "Clear history":** keep it, remove it in favour of the Settings reset, or
   relabel/cross-link?
5. **Backup first:** offer an export/download of progress before wiping? (Export/import is
   currently in the main PRD's Deferred list — flag if this pulls it in.)
6. **Post-reset feedback:** toast/inline confirmation? Navigate anywhere?

## Acceptance criteria
- Settings offers a reset action, gated by confirmation, that clears exactly the data scope
  agreed with the owner.
- New store clear method(s) work on both IndexedDB and the in-memory fallback, covered by tests.
- The UI reflects the cleared state immediately (History empty, training availability updated,
  prefs/language reset if in scope).
- All owner questions above are answered and reflected in the implementation.
- Fast loop green (test / check / lint).

## Out of scope
- Full export/import of progress unless the owner opts to include a pre-reset backup (otherwise
  it stays in Deferred).

## Progress log
- **2026-07-08 — Clarifying round done; decisions locked (owner). NOT built — awaiting explicit
  build approval.** Answers to the Open Questions above:
  1. **Scope:** a reset clears **history (`sessions`) + training (`srItems`)**. Gameplay prefs and
     language are **not** cleared.
  2. **Granularity:** **separate scoped controls**, not one combined "reset everything" button.
  3. **Placement:** **both** controls live in **Settings** — "Clear history" (clears `sessions`) and
     "Reset training" (clears `srItems`). History's existing "Clear history" button **stays** as a
     second entry point to the identical sessions-clear action.
  4. **Confirmation:** an **in-app modal** with button confirm/cancel — not native `confirm()`, not a
     typed confirm.
  5. **Backup:** **none** — export/import stays in the main PRD's Deferred list.
  6. **Feedback:** **no explicit success message**; rely on visibly-cleared state — the reset buttons
     **disable** once their store is empty (immediate on-screen signal), plus the emptied History view
     and the disabled Home "Train my mistakes" button on next visit.
  - **Derived design (to build once approved):** add `clearSRItems()` to the `QuizStore` interface
    (`src/data/persistence/types.ts`) and both adapters (`idb-store.ts` → `db.clear('srItems')`,
    `memory-store.ts` → `srItems.clear()`); a `clearTraining()` UI wrapper + a `hasTrainingData()`
    availability helper in `src/ui/stores/persistence.ts`; a new reusable `ConfirmDialog` component
    (none exists today); Settings "Data" section wiring; and matched EN/FR strings (parity enforced by
    `src/i18n/messages.test.ts`). Live refresh needs no new reactive store — `svelte-spa-router`
    remounts routes on navigation and History/Home fetch imperatively on mount.
- **2026-07-08 — Built and verified (owner-approved). Phase ✅ Done.** Implemented the derived design
  above:
  - **Store:** `clearSRItems()` on the `QuizStore` port + both adapters. UI store gained
    `clearTraining()`, `hasTrainingData()`, and (for symmetry with the history control)
    `hasSessions()` in `src/ui/stores/persistence.ts`.
  - **UI:** new reusable `src/ui/components/ConfirmDialog.svelte` — a div-based in-app modal (not
    native `<dialog>`, so it renders in jsdom for component tests) with confirm/cancel buttons,
    Escape + backdrop dismissal (both non-destructive → cancel), Cancel-focused on open, and
    `prefers-reduced-motion`-gated fade/pop. Settings gained a "Data" section with **Clear history**
    and **Reset training** controls, each disabling once its store is empty (the agreed no-toast
    on-screen signal).
  - **i18n:** `settings.data.*` (EN/FR) + shared `common.cancel`.
  - **Tests:** `clearSRItems()` contract test (both adapters; asserts sessions survive); new
    `Settings.test.ts` (confirm / cancel / disabled-when-empty / history-clear-leaves-training).
  - **Verification (fast loop green):** `npm run test` → 27 files / 217 tests pass;
    `npm run check` → 0 errors / 0 warnings (ConfirmDialog backdrop is a11y-clean); `npm run lint`
    clean; `npm run build` compiles and regenerates the PWA precache. Playwright is **not** actually
    configured in this repo (only a transitive lockfile entry), so there was no heavy E2E loop to
    run; the component tests exercise the flow end-to-end through the real IndexedDB adapter.
  - **Note:** `history.clearConfirm` (the older native-`confirm()` string used by History's button)
    is now unused by Settings but retained — History still uses `confirm()` for its own button, which
    was explicitly kept as a second entry point.
