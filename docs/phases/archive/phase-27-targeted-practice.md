# Phase 27 — Targeted practice (custom country & attribute session builder)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.4 post-play feedback

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Let the player **hand-pick exactly what to practise**: a specific set of countries **and** which
attribute(s) to drill (flag, map location, capital, …), then play a session restricted to just those.
This gives deliberate, focused study ("I keep confusing these ten Balkan flags — drill only those")
that neither region filtering nor SR review currently offer.

## The trigger (owner report)
> "New game mode — targeted practice: select countries and choose what to train on (flag, map, capital,
> …) and only train on those."

## In scope
- A **country picker** to assemble an arbitrary set (not limited to one region/sub-region).
- A choice of **which attribute/mode(s)** to drill on that set.
- Running a session scoped to the chosen countries, reusing the existing engine.

## Current state (so scope is clear)
- **The engine already supports an explicit country set.** `RunConfig.answerPoolIso` (`src/ui/stores/
  game.ts`) restricts a session to specific ISO codes while still drawing distractors from the whole
  world — exactly what "only train on these" needs. It's how training sessions launch today
  (`play.start({ answerPoolIso, ... })`).
- **Setup today is region-based, not country-based.** `Play.svelte` lets you choose one **mode**, a
  session **type** (fixed/survival), and a **region → sub-region** filter — there is no way to pick
  *individual* countries, and no way to combine modes.
- **A session commits to a single mode.** `QuizSession` / `RunConfig.mode` is one `GameMode`
  (`flag-to-country`, `country-to-flag`, `map-highlight`, `map-locate`). "Train flag **and** map in one
  go" is **not** currently expressible — it would need either sequential sessions or a multi-mode
  session (a design decision, see Open Questions).
- **"Capital" is not a mode yet.** It's Phase 24 (not built). Targeted practice should be built so that
  when capital/language/industry modes (23–25) land, they slot into the same attribute picker without a
  rewrite — but it can ship with today's four modes and grow later.
- **Country metadata for a picker exists.** `getCountries()` / `getRegionTree()` provide localized
  names, region/sub-region, and flags; `Flag.svelte` and `localizedName` render them. No new data
  needed for a name/flag-based picker.

## Depends on
Phase 2 (quiz engine) and Phase 5 (region-filter UI patterns to reuse). Uses the `answerPoolIso`
mechanism from the Home/training flow. **Forward-looks to the new modes (23–25):** the "what to train"
picker should be mode-list-driven so new modes appear automatically. Independent of Phase 26.

## Scope / Deliverables
- [x] **Country picker UI** — select an arbitrary set of countries. Free-text **search by name**
      (EN/FR/DE, diacritic-folded, reusing Atlas search), collapsible **region groups** with
      **All/None** per group, a running **count**, and the **chosen set as removable chips** with a
      "Clear all". (Map-lasso selection deferred — baseline only, per the owner's decision.)
- [x] **Attribute/mode picker** — all 8 `GameMode`s in display order, driven off the same
      `MODE_OPTIONS` list the Play setup uses, so new modes appear automatically. **Single mode per
      session** (owner's decision); multi-mode interleaving remains a future extension.
- [x] **Launch** — builds a `RunConfig` via `practiceToConfig` with `answerPoolIso` = the chosen set
      (narrowed to countries the mode can ask about), staged on `pendingConfig` and handed off to the
      existing Play route (like Retry). Fixed length = eligible set size (drill each once); survival
      uses the player's lives. Distractors still tier against the whole world.
- [x] **Entry point** — a **dedicated `#/practice` screen**, reached by a **discreet link on the Play
      setup screen** (below Start). No 6th top-nav entry. (Originally a Home card; the owner moved it to
      the Play page in a follow-up — the builder sits next to the ordinary game setup.)
- [x] **Save a set** — named custom sets persisted in IndexedDB (new `customSets` store, DB v4).
      Save/Update, Play, Edit, Delete (with confirm). **Countries only** — the mode is chosen at play
      time, so one set is reusable across modes. Not wiped by the History/Training progress resets.
- [x] **SR / history integration** — targeted-practice runs are **normal sessions**: they feed SM-2,
      history, mastery, streak, and achievements like any other run (owner's decision).
- [x] **i18n** — `practice.*` picker/labels/prompts + `home.targetedPractice` in EN/FR/DE, parity
      enforced by `messages.test.ts`.
- [x] **Tests** — pure set-math + eligibility split (`practice.test.ts`), `customSets` CRUD +
      isolation + persistence-across-reopen (`store.test.ts`), and an end-to-end headless-Chrome run
      confirming a session asks **only** about the chosen set.

## Technical notes
- **Lean on `answerPoolIso`.** Single-mode targeted practice is essentially the training flow with a
  player-chosen pool instead of an SR-derived one — minimal new engine surface.
- **Multi-mode is the one real design fork.** Options: (a) **single mode per session** (simplest — pick
  one attribute; run more sessions for more attributes); (b) **multi-mode session** — interleave
  question types over the same country set, which needs the engine to vary `mode` per question (a real
  generalization) and a mode-agnostic answer surface. Recommend shipping **(a)** first and treating
  multi-mode as a stretch/Open Question.
- **Reuse, don't reinvent, the region tree.** The picker can present `getRegionTree()` groups with
  member toggles, so "select all of the Balkans then remove two" is a couple of taps.
- **Keep it framework-light and pure where possible** — set math (union/dedupe, count) and config
  building are unit-testable without the DOM.
- **Micro-state selectability** in map modes is Phase 22's problem; targeted practice shouldn't try to
  fix map interaction, just reuse whatever the map modes provide.

## Open Questions — resolved with the owner (2026-07-10)
1. **Multi-mode in one session?** → **Single mode per session.** Multi-mode interleaving is a future
   extension, not built.
2. **Country selection UX** → **Baseline only** (search + region-expand + All/None + count + chosen
   chips). No map-lasso, no quick presets for v1.
3. **Save & reuse sets** → **Save & name sets** (persisted). Countries only (mode chosen at play time).
4. **Session shape** → length = **eligible set size** for fixed (drill each once); **survival** also
   offered (uses the player's configured lives). No repeats mode.
5. **Feeds SR/mastery?** → **Yes — normal sessions** (feed SM-2, history, mastery, streak, achievements).
6. **Entry point** → **Dedicated `#/practice` screen**, entered via a discreet link on the Play setup
   screen. No 6th top-nav entry. (Was a Home card at first; moved to the Play page in a follow-up.)

## Acceptance criteria
- The player can assemble an arbitrary set of countries (across regions), choose an attribute/mode, and
  play a session that asks **only** about that set.
- Set assembly and config building are covered by **pure, unit-tested** logic.
- The new flow appears with an icon + localized strings; EN/FR/DE parity holds; it doesn't regress the
  existing region-based setup.
- Fast loop green (`npm run test` / `check` / `lint`); a manual headless-Chrome check on :5180 building
  a custom set (e.g. 8 hand-picked countries) and playing it end-to-end.

## Out of scope
- Building the capital/language/industry **modes** themselves (23–25) — targeted practice consumes
  whatever modes exist.
- Multi-mode interleaving if the owner picks single-mode-first (then it's a future extension).
- Spaced-repetition changes beyond feeding it normally.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.4 feedback ("targeted practice: pick countries + what
  to train, drill only those"). Grounded in `game.ts` (`answerPoolIso` already restricts a session to an
  explicit country list) and `Play.svelte` (setup is region-based, single-mode). NOT built — awaiting
  the clarifying round and explicit build approval.**
- **2026-07-10 — Clarifying round done; owner approved the build with: single-mode, dedicated
  `#/practice` screen + Home card, baseline picker, and save-&-name sets (countries only). Built and
  shipped:**
  - **Data:** `CustomSet` type + a new IndexedDB `customSets` store (DB_VERSION 3→4, additive upgrade)
    with CRUD on `QuizStore` / `IdbQuizStore` / `MemoryQuizStore`. Saved sets are authored content, not
    wiped by the History/Training resets.
  - **Domain (`practice.ts`, pure + unit-tested):** `togglePractice` / `addToPractice` /
    `removeFromPractice` set math, and `practiceEligibility(mode, countries)` splitting a set into what a
    mode can ask about vs. what it must skip (over the existing `eligibleAnswers`).
  - **UI store:** `practiceToConfig` (RunConfig with `answerPoolIso` = eligible set, fixed length =
    eligible count); `loadCustomSets` / `saveCustomSet` / `deleteCustomSet` (plain-copy the ISO array to
    dodge the `$state`-proxy `DataCloneError`).
  - **UI:** new `Practice.svelte` route (`#/practice`) — search + collapsible region groups (All/None) +
    running count + removable chosen chips; all-8-mode picker with a live coverage note when picks are
    ineligible; fixed/survival; save/update/play/edit/delete for named sets; Start stages `pendingConfig`
    and hands off to the Play route. Entered via a discreet "Targeted practice" link (🎯 `target` icon)
    on the Play setup screen (below Start). New icons (search/plus/trash) added to the generated registry.
  - **i18n:** `practice.*` + `home.targetedPractice` in EN/FR/DE (parity green).
  - **Verification:** `npm run test` (438 pass, incl. new `practice.test.ts` + `customSets` store tests),
    `check`, `lint` all green; headless-Chrome (Puppeteer) end-to-end on :5180 — built a 5-country set,
    saved it (persisted in the list), played it, and confirmed the session asked **only** those 5;
    separately confirmed the coverage note ("1 of 2 can be drilled…") for a mode-ineligible pick.**
- **2026-07-10 (follow-up) — Owner asked to move the entry point off Home onto the Play page, kept
  discreet. Removed the Home card; added a small muted "Targeted practice" link below Start on the Play
  setup screen; relocated the label key `home.targetedPractice` → `play.setup.targetedPractice` in
  EN/FR/DE (parity green).**
</content>
