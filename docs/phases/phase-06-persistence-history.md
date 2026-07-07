# Phase 6 — Persistence & history

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Persist play history, preferences, and (structurally) SR state in IndexedDB, and surface
progress in stats views. Ensures data survives reloads and browser restarts.

## Depends on
Phases 2 (engine) and 3 (a playable mode to record).

## Scope / Deliverables
- [x] **IndexedDB wrapper** (thin, e.g. `idb`) with object stores: `sessions`, `srItems`,
      `prefs`.
- [x] Persist a **`SessionRecord`** at each session end (including `durationMs` and the
      per-question `QuestionResult[]`).
- [x] Persist **`Prefs`** (language, survival lives, fixed length, choices per question) and
      load them at startup; wire a basic Settings screen to edit them.
- [x] **Stats views:** sessions over time, overall accuracy, average time per question, and
      most-missed countries.
- [x] **Graceful fallback** when IndexedDB is unavailable (in-memory store + a visible warning
      that progress won't persist).

## Technical notes
- Define the `srItems` store now even though the SM-2 logic lands in Phase 7 — this avoids a
  schema migration later.
- Keep persistence behind a small interface so the domain layer stays storage-agnostic and
  testable.

## Acceptance criteria
- Sessions persist across page reloads and browser restarts; stats compute correctly from
  stored records.
- Prefs persist and are applied on startup.
- With IndexedDB disabled, the app still runs and clearly warns that progress won't be saved.

## Out of scope
- SM-2 scheduling and training selection (Phase 7).

## Progress log
- **2026-07-07** — Phase completed.
  - **Persistence layer** (`src/data/persistence/`): a storage-agnostic `QuizStore` port
    with two implementations — `IdbQuizStore` (via the thin `idb` wrapper; object stores
    `sessions` [indexed by `startedAt`], `srItems` [indexed by `dueAt`, reserved for
    Phase 7], and a singleton `prefs` row) and `MemoryQuizStore` (in-session fallback +
    unit-test double). `openStore()` picks IndexedDB and degrades to memory on any failure.
  - **Stats aggregation** (`src/domain/stats.ts`, pure): `computeStats(records)` →
    totals, accuracy, avg answer time, total play time, per-UTC-day timeline, and
    most-missed countries ranked by misses → attempts → iso2.
  - **UI wiring** (`src/ui/stores/persistence.ts`): opens the store at startup, loads &
    applies `Prefs` (language bridged one-way from the i18n `locale` store), exposes a
    `persistent` flag, saves a `SessionRecord` at each natural session end, and serves the
    History stats. Added `startedAt`/`finishedAt` to `SessionSummary` so records map 1:1.
  - **Screens**: Settings now edits gameplay prefs (questions, lives, choices) with
    clamped bounds; Play consumes them; History renders overview tiles, a single-series
    "sessions per day" bar chart, most-missed countries, and a recent-sessions list, with
    a "clear history" action. Storage-unavailable warnings on the app shell, Settings, and
    History. New i18n strings (EN/FR).
  - **Tests** (all green, 151 total): pure `computeStats`; `QuizStore` contract run against
    both stores incl. an IndexedDB reopen ("restart") case and `openStore` fallback (via
    `fake-indexeddb`); the `summaryToRecord` mapper + init/save/load round-trip + locale
    bridge; and a History component render test. `npm run check`, `npm run lint`, and
    `npm run build` all pass.
  - **Deps**: added `idb` (dep) and `fake-indexeddb` (dev).
