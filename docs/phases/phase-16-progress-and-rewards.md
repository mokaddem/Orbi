# Phase 16 — Progress & rewards

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
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
- [ ] **"Mastered" definition (pure, unit-tested)** — a rule mapping a country's SR items to a
      mastered/learning/unseen state (thresholds in Open Questions), plus a rollup:
      `{ mastered, learning, unseen, total }` overall and **per region**. Lives in a pure module
      (extend `stats.ts` or a new `mastery.ts`), `now` injected.
- [ ] **World mastery meter** — a progress bar + count on Home (compact) and/or History (full),
      reusing existing card styling.
- [ ] **Per-region mastery breakdown** — a list/grid of regions with mastered/total and a bar each,
      ordered most- or least-complete (Open Questions). Uses `RegionIcon` and localized region names
      (`$localizedRegion`).

### Achievements
- [ ] **Achievements model (pure, unit-tested)** — a declarative catalog of badges, each with an
      `id`, i18n key, and a pure predicate over `{ stats, srState, streak, now }`. Evaluating the
      catalog yields unlocked/locked + (if persisted) unlock timestamps.
- [ ] **Achievements display** — a badges section (History, or its own small view) showing earned vs
      locked, with a short description of how to earn each. Optional one-time "unlocked!" toast if we
      persist unlock state (Open Questions).
- [ ] **Starter badge set** — agree the initial list with the owner (candidates below).

### Weekly recap
- [ ] **Weekly rollup (pure, unit-tested)** — given sessions + a week window (injected "now"),
      compute sessions, accuracy, questions, countries newly mastered this week, and best streak.
- [ ] **Recap display** — a compact recap card (History, or shown once on Home at the start of a new
      week). Placement in Open Questions.

### Cross-cutting
- [ ] **i18n** — EN/FR for mastery labels, every region name already localized, each achievement's
      title + description, and recap labels. Parity enforced by `messages.test.ts`.
- [ ] **Tests** — unit tests for the mastery rollup (per-region + overall, threshold edges), the
      achievements predicates (each badge locks/unlocks correctly), and the weekly window (boundary
      cases); component tests that the meter, breakdown, badges, and recap render from a fixture.

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
