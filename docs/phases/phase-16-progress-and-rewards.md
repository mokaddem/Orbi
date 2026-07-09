# Phase 16 — Progress & rewards

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.2 retention & engagement

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Make progress **visible and rewarding** so the player has long-term goals to chase. Four related
surfaces, all computed from data already persisted (no backend):

1. **World mastery meter** — "You've learned N / <total> countries." A progress bar toward mastering
   the whole world.
2. **Per-region mastery** — a breakdown (Europe 90%, Africa 40%, Oceania 12%) that doubles as a
   to-do list.
3. **Achievements / badges** — collectible local milestones (perfect run, mastered a region, N-day
   streak, sub-time round, 100 countries learned…).
4. **Weekly recap** — "This week: 5 sessions · 84% accuracy · +12 mastered · best streak 4 days."

## Current state (so scope is clear)
- **`countryCount()`** and `getRegions()` / `getRegionTree()` / `getCountriesByRegion()`
  (`src/data/countries.ts`) give the denominators for mastery (total countries; countries per region).
- **SR state** (`SRItem`: `repetitions`, `easeFactor`, `intervalDays`, `dueAt`, `lapses`,
  `lastReviewedAt`) is the natural signal for **"mastered"** — but mastery is **per item** = `mode:iso2`
  (four modes per country), while the meter counts **countries**. How to roll the four modes into one
  "country mastered" verdict is a design decision (see Open Questions).
- **`computeStats()`** (`src/domain/stats.ts`) already yields totals, accuracy, `mostMissed`, and
  `byDay` — the raw material for the weekly recap and for any accuracy-based mastery variant.
- **Gaps:** no notion of "mastered", no per-region mastery rollup, no achievements model, no weekly
  windowing. There is also no place these are shown — likely an extension of the **History** route
  (`src/ui/routes/History.svelte`) and/or a compact summary on **Home**.
- **Persistence:** achievements could be **derived statelessly** each load, or **persisted** with an
  unlock date (needed if we want a one-time "unlocked!" celebration). No store for this exists today.

## Depends on
Persistence + history (Phase 6) and SR/training (Phase 7). Shares the streak concept with Phase 15
(the "N-day streak" badge and the recap's "best streak" reuse it) — if both ship, **build Phase 15's
streak helper first** or factor it into a shared module. Otherwise independent (any order).

## Scope / Deliverables
### Mastery
- [x] **"Mastered" definition (pure, unit-tested)** — `src/domain/mastery.ts`: `isItemMastered`
      (`repetitions ≥ 2` **and** `dueAt` in the future) + lenient country rule (any mode) + rollup
      `{ mastered, learning, unseen, total }` overall and **per region**. `now` + country list injected.
- [x] **World mastery meter** — `WorldMasteryMeter.svelte`, compact on Home + full on History,
      segmented bar (mastered / learning), reusing existing card styling.
- [x] **Per-region mastery breakdown** — `RegionMasteryBreakdown.svelte`: one row per region with
      `RegionIcon`, localized name (`$localizedRegion`), `mastered/total`, and a bar; least-complete
      first.

### Achievements
- [x] **Achievements model (pure, unit-tested)** — `src/domain/achievements.ts`: a 14-badge
      declarative catalog, each an `id` + pure predicate over `{ stats, mastery, streak, sessions, now }`.
      `evaluateAchievements` yields unlocked/locked; the wiring layer stamps unlock dates.
- [x] **Achievements display** — `AchievementsGrid.svelte` showing earned vs locked with how-to-earn
      text; one-time "unlocked!" banner on History (unlock dates persisted in a new IDB store).
- [x] **Starter badge set** — owner confirmed the full candidate list (14 badges).

### Weekly recap
- [x] **Weekly rollup (pure, unit-tested)** — `src/domain/recap.ts`: `computeWeeklyRecap` over a
      local **Monday** week window (injected `now`) → sessions, questions, accuracy, newly-mastered
      (approx via `lastReviewedAt`), current + longest streak.
- [x] **Recap display** — `WeeklyRecap.svelte`, a compact chip card on History (always visible).

### Cross-cutting
- [x] **i18n** — EN/FR under `progress.*` for mastery labels, all 14 badge titles + descriptions,
      and recap labels; region names already localized. Parity green (`messages.test.ts`).
- [x] **Tests** — unit tests for the mastery rollup (per-region + overall, threshold edges), the
      achievements predicates (each badge at its boundary), and the weekly window (Monday/Sunday
      boundaries); component tests for meter, breakdown, badges, and recap; wiring tests for the
      once-only unlock + persistence. 321 tests green.

## Technical notes
- **Country vs item mastery:** the meter counts countries but SR is per `mode:iso2`. Options: a country
  is "mastered" when **any** mode reaches the bar (lenient), when a **majority/all** modes do (strict),
  or track mastery **per-mode** and average. This materially changes the numbers — decide with the
  owner. A pure `mastery.ts` keeps the rule swappable and tested.
- **"Mastered" threshold** likely combines SR fields, e.g. `repetitions >= R` **and** not currently
  lapsed/overdue (`dueAt` in the future, `lapses` low). Exact bar is an Open Question.
- **Achievements should be pure predicates** over already-computed rollups so they're trivially
  testable and cheap to evaluate on load. Persisting unlock dates is only needed for celebration/"new"
  badges; a stateless derive-on-load is simpler and fully offline — pick per Open Questions. If
  persisted, it needs a new store (or reuse of the prefs-style singleton pattern).
- **Weekly window** must inject "now" and be explicit about week start (local, and Monday vs Sunday) —
  consistent with Phase 15's timezone decision if that ships.
- Reuse Phase 15's streak helper for streak-based badges and the recap's "best streak" rather than
  reimplementing.

## Open Questions — to resolve with the owner
1. **Mastery denominator** — count against **all** countries (`countryCount()`) or only those in
   regions the player has engaged with? (Recommendation: all countries — "learn the world" is the
   goal.)
2. **Country-mastery rule across the four modes** — lenient (any mode), strict (all modes), or track &
   display **per-mode**? (Recommendation: start lenient — any mode — and revisit.)
3. **"Mastered" SR threshold** — e.g. `repetitions >= 2` and not lapsed and `dueAt` in the future?
   Should a fresh lapse demote a country back to "learning"? (Recommendation: yes, demote on lapse.)
4. **Achievement persistence** — stateless derive-on-load, or persist unlock dates to enable a
   one-time "unlocked!" celebration and a "new" marker? (Recommendation: persist — the reward moment
   is most of the motivation.)
5. **Starter badge list** — confirm the initial set. Candidates: *First round*, *Perfect fixed round*,
   *Flawless survival run*, *Mastered a whole region*, *Mastered Europe/Africa/Asia/Americas/Oceania*
   (5), *100 countries learned*, *Whole world mastered*, *7-day streak*, *30-day streak*, *Speedy
   round (avg < Xs)*.
6. **Where each surface lives** — Home (compact) vs History (full) vs a new "Progress" view? (Rec:
   full breakdown + badges + recap on History; a compact mastery meter on Home.)
7. **Per-region ordering** — least-complete first (to-do list) or most-complete first (celebrate)?
8. **Weekly recap timing** — always visible on History, and/or shown once when a new week starts?
   Week starts Monday or Sunday, local time?

## Acceptance criteria
- A world mastery meter and a per-region breakdown render from real SR state and update after play.
- Achievements evaluate correctly (each badge locks/unlocks per its predicate), display earned vs
  locked, and — if persisted — celebrate a first unlock exactly once.
- A weekly recap summarizes the current week from real history.
- Mastery, achievements, and weekly rollups are **pure** and covered by unit tests (thresholds, per-mode
  rule, badge predicates, week boundaries).
- EN/FR parity holds (`messages.test.ts` green).
- All owner questions above are answered and reflected in the implementation.
- Fast loop green (`npm run test` / `npm run check` / `npm run lint`); manual browser check on 5180.

## Out of scope
- Online/shareable achievements or leaderboards (Non-Goal: no social/online features).
- XP/levels or any economy beyond the badges/streak agreed here.
- Notifications reminding the player about progress (not in this track).

## Progress log
- **2026-07-08 — PRD drafted from the retention brainstorm (owner picked all of Option C: mastery
  meter + per-region mastery + achievements + weekly recap). NOT built — awaiting the clarifying round
  and explicit build approval.**
- **2026-07-09 — Clarifying round resolved with owner; explicit go-ahead given; built and completed.**
  - **Decisions (Open Questions):**
    1. **Denominator** — all countries (`countryCount()` = 195). "Learn the world."
    2. **Country-mastery rule** — **lenient**: a country is mastered if *any* of its four modes is.
    3. **Item bar** — `repetitions ≥ 2` **and** `dueAt` in the future (not overdue). A lapse resets
       `repetitions → 0`, so it demotes back to "learning" automatically.
    4. **Achievement persistence** — **persist unlock dates** (new `achievements` IDB store, DB v3) to
       drive a one-time "unlocked!" banner. Earned badges are **sticky** (a badge stays earned even if
       its live rollup later dips below the bar). Both Settings resets (`clearHistory`/`clearTraining`)
       also clear the badge store; still-qualifying badges re-unlock on next load.
    5. **Starter badges** — full list, **14** total: first-round, perfect-fixed, flawless-survival,
       speedy (avg < 3 s over ≥ 5 Q), streak-7, streak-30, region-mastered, mastered-{europe, africa,
       asia, americas, oceania}, century (100), world-mastered.
    6. **Placement** — full breakdown + badges + recap on **History**; compact meter on **Home**.
    7. **Region ordering** — least-complete first (to-do list).
    8. **Weekly recap** — always visible on History; week starts **Monday, local time** (consistent
       with Phase 15's local-day streak). "Newly mastered this week" is an accepted approximation
       (mastered-now countries whose qualifying item's `lastReviewedAt` falls in the window).
  - **New pure modules:** `domain/mastery.ts`, `domain/achievements.ts`, `domain/recap.ts`
    (+ tests). **Persistence:** `achievements` store on both `IdbQuizStore` (v3, additive upgrade) and
    `MemoryQuizStore`; wiring `loadMastery` / `loadWeeklyRecap` / `loadAchievements` in
    `ui/stores/persistence.ts`. **UI:** `WorldMasteryMeter`, `RegionMasteryBreakdown`,
    `AchievementsGrid`, `WeeklyRecap` + History/Home integration and a one-time unlock banner.
  - **Verified:** 321 Vitest tests · `npm run check` 0 errors · `npm run lint` clean · manual
    headless-Chrome check on 5180 (Home compact meter + History surfaces render from a seeded profile,
    EN/FR, no console errors).
  - **Note:** Playwright is not in this repo (per prior phases); the heavy-loop check was a headless
    google-chrome-stable CDP drive that seeds IndexedDB and screenshots Home + History.
