# Phase 30 — Split "History & stats" into two pages (History · Progress)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.5 navigation & visual depth

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
The single `/history` route has grown into an overloaded "History & stats" page that mixes two
different questions: **"what have I played?"** (a session log) and **"how am I doing / what have I
learned?"** (progress, mastery, achievements). Split it into **two focused pages**, each reachable
from the primary nav, so neither buries the other and each has room to grow (the combined
"Extra knowledge" panel from Phases 23/24, more achievements, etc.).

## The trigger (owner request)
> "Split history and stats page into 2 distinct pages."

## In scope
- A second route + primary-nav entry, and moving each existing panel onto the page it belongs to.
- Page titles / nav labels (EN/FR/DE) and per-page empty states.
- Re-pointing any in-app links that currently deep-link to `/history`.

## Current state (so scope is clear)
- **One route does it all.** `/history` → `History.svelte` (`routes.ts`), titled `history.title`
  ("History & stats"), reached from the single `nav.history` entry (icon `history`). Nav order today:
  Home · Play · Atlas · History · Settings (`navLinks` in `routes.ts`).
- **Eight panels live on that one page** (current top-to-bottom order):
  1. **Overview tiles** — sessions / accuracy / avg-per-question / time played (`history.stats.*`).
  2. **This week** — weekly recap (`progress.recap.*`).
  3. **World mastery** — meter + per-region breakdown (`progress.mastery.*`).
  4. **Achievements** — country/skill/habit badges (`progress.achievements.*`).
  5. **Extra knowledge** — combined capitals + languages meters + their badges (Phases 23/24).
  6. **Sessions per day** — timeline bar chart (`history.timeline.*`).
  7. **Most-missed countries** (`history.missed.*`).
  8. **Recent sessions** (`history.recent.*`).
- **Data loading is centralized** in `History.svelte`'s `refresh()` (sessions, mastery, capital &
  language mastery, recap, achievements) via the persistence store. A split means each page loads only
  what it shows (or a shared loader is factored out).
- **Inbound links to `/history`** exist (e.g. nav, and any "view progress"/post-session pointers) — these
  must land on the right one of the two pages after the split.

## Depends on
Phase 6 (history/sessions), Phase 16 (mastery/achievements/recap surfaces), Phases 23/24 (the combined
"Extra knowledge" panel that will live on the progress page). Independent of, but should **coordinate
with, Phase 29** (Home mastery breakdown) and **Phase 31** (visual sweep) so the new pages are styled
consistently. No data-model change.

## Scope / Deliverables
- [x] **Decide the split** (Open Question 1) — confirmed the working proposal as written:
      - **Progress page (`#/progress`):** overview tiles · This week · World mastery · Achievements ·
        Extra knowledge.
      - **History page (`#/history`):** Sessions per day · Most-missed · Recent sessions.
- [x] **New route + page component** — added `'/progress'` to `routes.ts` and a new
      `routes/Progress.svelte`; `History.svelte` slimmed to the three activity panels. Each page has a
      narrow `refresh()` loading only what it renders (History → sessions; Progress → sessions for the
      tiles + the mastery/recap/achievement rollups).
- [x] **Navigation** — added a sixth primary-nav entry (Progress, `trophy` icon); order is
      Home · Play · Atlas · History · Progress · Settings. The header already `flex-wrap`s, so six entries
      fit on one row at desktop width and wrap gracefully when narrower — no extra responsive treatment
      needed.
- [x] **i18n (EN/FR/DE)** — added `nav.progress` (Progress / Progrès / Fortschritt) and
      `progress.title` / `progress.loading` / `progress.empty` / `progress.play`; retitled `history.title`
      from "History & stats" → "History" (Historique / Verlauf). Kept the existing `history.stats.*`
      keys as-is (now referenced from Progress) to minimise churn.
- [x] **Per-page empty states** — each page has its own sleepy-mascot empty state with distinct copy
      ("No sessions yet…" vs. "No progress yet…").
- [x] **Re-point inbound links** — audited: the *only* inbound link to `#/history` was the nav entry
      itself (Summary CTA → `#/play`; Home shows mastery inline). Nothing else to re-point.
- [x] **Tests** — split `History.test.ts` (asserts timeline/most-missed/recent + its empty state, and
      that learning panels never appear here); added `Progress.test.ts` (tiles + World mastery +
      empty state + the capitals/languages Extra-knowledge reveal). 456 tests green.

## Technical notes
- **Factor the loaders, don't fork them.** `refresh()` currently loads everything; give each page a
  narrower load (History → sessions; Progress → mastery/recap/achievements) or a small shared module, so
  neither page pays for data it doesn't render.
- **Naming matters** (Open Question 2): "Progress" vs "Stats" vs "Achievements" for the learning page;
  "History" vs "Activity" for the log page. Pick names that read well as nav labels in all three locales.
- **Most-missed is a hybrid** — it's a learning signal but reads like activity; where it lands is a
  judgement call (Open Question 3).
- Keep it a **pure IA/navigation change** — reuse every existing panel component and the mastery/recap
  computations unchanged; no new stats.

## Open Questions — to resolve with the owner
1. **The split** — confirm the working proposal above, or move specific panels (esp. overview tiles and
   most-missed).
2. **Names** — what are the two pages/nav entries called (EN/FR/DE), and their icons?
3. **Most-missed placement** — History (activity) or Progress (learning)?
4. **Nav growth** — six primary entries acceptable, or should History/Progress be grouped/secondary?
5. **Landing** — after finishing a session, which page (if any) do "view progress"-style links point to?

## Acceptance criteria
- Two distinct routes exist, each in the primary nav, each showing only its own panels with its own
  empty state; no panel is duplicated and none is lost.
- The combined "Extra knowledge" panel and achievements sit on the progress page; the session log sits
  on the history page (per the agreed split).
- EN/FR/DE parity for the new labels/titles; inbound links land on the correct page.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180 of both
  pages (populated and empty).

## Out of scope
- New stats, charts, or mastery definitions (Phase 16 owns those).
- The visual enrichment pass (Phase 31) and identity/Home items (Phase 29) — coordinate, but separate.
- Restructuring Atlas or Settings.

## Progress log
- **2026-07-10 — PRD drafted from the owner's request to "split history and stats page into 2 distinct
  pages." Grounded in the single `/history` route + `History.svelte` carrying eight panels across two
  concerns (activity log vs. learning/progress). NOT built — awaiting the clarifying round and explicit
  build approval.**
- **2026-07-10 — Clarifying round resolved with the owner (all recommended defaults):**
  1. **Split** — working proposal *as written*: Progress = overview tiles · This week · World mastery ·
     Achievements · Extra knowledge; History = Sessions per day · Most-missed · Recent sessions.
  2. **Names/icons** — learning page = **Progress** (`trophy` icon), FR *Progrès* / DE *Fortschritt*;
     History keeps its name and icon.
  3. **Most-missed** — stays on **History** (pairs with the session log).
  4. **Nav growth** — **six** top-level entries accepted (header flex-wraps; no icon-only breakpoint).
  5. **Landing** — **no** new Summary link; kept a pure IA split (Summary owned by Phase 16).
- **2026-07-10 — Built & verified. ✅ Done.** Added `routes/Progress.svelte` + `'/progress'` route and
  a sixth nav entry; slimmed `History.svelte` to the three activity panels. i18n added across EN/FR/DE
  (`nav.progress`, `progress.title/loading/empty/play`; `history.title` retitled). Split
  `History.test.ts` and added `Progress.test.ts`. Fast loop green: **456 tests pass**, `check` 0
  errors, `lint` clean. Manual headless-Chrome check on :5180 of both pages, populated and empty
  (seeded IndexedDB via CDP) — correct panel split, six-entry nav on one row, distinct per-page empty
  states, **no console/page errors**.
