# Phase 24 — New game mode: Capitals

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
A new quiz mode about **capital cities** — match a country to its capital (and/or the reverse). This is
one of the modes explicitly flagged for "later" in the original spec (main PRD Non-Goals / Deferred).

## In scope
- A new game mode built on per-country capital data, in at least one direction.
- The data pipeline, question generation, distractors, and UI to support it.

## Current state (so scope is clear)
- **Data is available in an existing dependency.** `world-countries` carries a `capital` array per
  country (English names); **every** UN member has one (verified — zero missing). A few have multiple
  (e.g. South Africa 3, Bolivia 2). Not in our generated dataset yet; `build-data.mjs` must add it.
- **The engine is country-centric.** `Question.answer` is a `Country`, options are `Country[]`,
  `selectDistractors` returns countries, `checkAnswer` compares ISO codes, `itemKey = ${mode}:${iso2}`.
  This shapes which direction is cheap:
  - **`capital → country`** (show a capital, pick the country): answer stays a `Country`, options are
    countries, distractors reuse `selectDistractors` **unchanged**. **Zero engine generalization** — a
    great MVP that slots straight into the existing flow.
  - **`country → capital`** (show a country/flag, pick the capital): options are **capital strings**,
    so it needs the "attribute question" generalization (answer/options not restricted to `Country`).
- **Modes are a closed union** (`GameMode`) surfaced in `Play.svelte` mode cards + `ModeIcon` glyphs +
  `modes.*` / `play.prompt.*` i18n. Adding a mode touches all of these.

## Depends on
Phase 2 (quiz engine). **Recommended as the pilot** for the shared "attribute-quiz" generalization used
by Phases 23 (languages) and 25 (industries): the `capital → country` direction needs none of it, and
`country → capital` introduces it in the cleanest, most contained way. Build capitals first.

## Scope / Deliverables
- [x] **Dataset** — extended `build-data.mjs` + the `Country` type with `capital: CountryName`
      (canonical only). Integrity check: every in-scope country has a capital (195/195), plus guards
      that flag stale / no-op entries in the curated i18n map.
- [x] **Mode(s)** — added **both** `capital-to-country` and `country-to-capital`; registered in the
      `GameMode` union and every switch/label site.
- [x] **Engine (shared)** — the attribute-question generalization (`AttributeOption`,
      `Question.attributeOptions` / `correctOptionId`, `buildQuestion` + `checkAnswer` branches, a new
      `domain/modes.ts` registry). Pure + unit-tested; SR/history/itemKey stay keyed per-country.
      Reusable by Phases 23 (languages) & 25 (industries).
- [x] **UI** — `Play.svelte` mode cards (looped) + two `ModeIcon` glyphs (⭐ star / classical building);
      prompt + `modes.*` strings (EN/FR/DE); `ChoiceGrid` normalized to a reusable `ChoiceOption`.
- [x] **Distractors** — `capital → country` reuses `selectDistractors` as-is; `country → capital` reuses
      the same geography-tiered distractor countries, mapped to their capitals.
- [x] **Multiple-capital handling** — canonical = first listed (only South Africa is multi in scope →
      Pretoria), documented in the dataset + i18n source.
- [x] **Tests** — generation (both directions), attribute grading, mastery exclusion, training
      inclusion, ChoiceGrid attribute rendering, Play in-game flow, i18n parity.
- [x] **Follow-up (owner-requested):** capital shown on the Atlas country page; a separate
      **capital-mastery** panel + capital achievements surfaced in History/stats (see the
      2026-07-09 follow-up progress-log entry).

## Technical notes
- **Ship `capital → country` first** — it is nearly free given the existing engine and gives an
  immediate, testable mode. Add `country → capital` as the vehicle for the shared generalization if the
  owner wants both directions.
- **Localised capital names are a data gap.** `world-countries.capital` is English-only; some capitals
  differ by language (Brussels / Bruxelles / Brüssel; Munich / München). Options: English-only (with a
  note), a small hand-curated EN/FR/DE map for the ones that differ, or a bundled source — decide with
  the owner. (`capital → country` sidesteps this if the capital is shown in one language.)
- **Multiple capitals:** default to the first/most-common as canonical; if `country → capital`, ensure
  the correct option and distractors don't collide across multi-capital countries.
- Keep SR/mastery keyed per-country (`${mode}:${iso2}`) so capitals integrate like the existing modes.

## Open Questions — to resolve with the owner
1. **Direction(s)** — `capital → country` only (cheapest), `country → capital` only, or both?
2. **Localised capital names** — English-only, curated EN/FR/DE for the differing ones, or a new
   bundled source?
3. **Multiple capitals** — canonical-only or accept any? Which canonical (constitutional vs seat of
   government)?
4. **Pilot the generalization here?** — confirm capitals is where the shared attribute-quiz engine work
   lands (recommended).
5. **Mastery** — does this mode feed per-country mastery/achievements (Phase 16), or stay separate?

## Acceptance criteria
- At least `capital → country` is playable end-to-end with correct distractors and answers.
- Capital data is in the dataset with an integrity check; core generation is unit-tested (incl.
  multi-capital handling).
- New mode(s) appear in Play with an icon + localised strings; EN/FR(/DE) parity holds.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- Locating capitals **on the map** (a map-capital mode) — could be a later phase; this is name-based.
- Population/founding/other city trivia.
- Localised capital names beyond whatever Open Question 2 decides.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list ("new game mode: capitals"). NOT
  built — awaiting the clarifying round and explicit build approval.**
- **2026-07-09 — Clarifying round resolved with the owner, then built (explicit "Go ahead!").**
  - **Open questions answered:** (1) Direction — **both** `capital→country` + `country→capital`, to land
    the shared attribute-quiz engine here (the pilot's purpose). (2) Localised names — **curated EN/FR/DE
    overrides** (English default + a hand-maintained map for the ~55 capitals that differ), in
    `scripts/data/capitals-i18n.mjs` — flagged for owner translation review. (3) Multiple capitals —
    **canonical-only, first listed** (only South Africa is multi in scope → Pretoria). (4) Pilot the
    generalization here — **yes**. (5) Mastery — **keep separate**: capitals records history and is
    trainable (SR), but is **excluded from the mastery rollup + mastery badges** via a new
    `MASTERY_MODES` set; the 4 identity modes are unchanged.
  - **Engine generalization (reusable by Phases 23/25):** answer stays a `Country` (so itemKey/history/SR
    are untouched); options may be `AttributeOption`s (localized label + owning id) with
    `Question.correctOptionId`. New `domain/modes.ts` (`ALL_MODES` / `MASTERY_MODES` / `ATTRIBUTE_MODES`).
    `ChoiceGrid` normalized to `ChoiceOption { id, label, country? }`.
  - **"Keep separate" boundary:** `parseItemKey` accepts capital modes (→ trainable); `computeMastery`
    filters to `MASTERY_MODES` (→ out of mastery %/badges); capitals left out of the Daily rotation
    (`DAILY_MODES` unchanged). Judgment calls (owner may still veto): generic activity badges
    (first-round/perfect/speedy) fire for capitals sessions; daily stays at the 4 identity modes.
  - **Verification:** fast loop green — `npm run test` (381 pass, incl. new questions/mastery/training/
    ChoiceGrid/Play cases), `npm run check` (0 errors), `npm run lint` clean, `npm run build` OK
    (195/195 capitals integrity pass). Real screenshot confirms both new mode cards + icons on setup;
    in-game flow for both directions verified by Play component tests (interactive headless Chrome is
    blocked in this sandbox — only self-exiting `--screenshot` runs).
- **2026-07-09 — Follow-up increment (owner-requested: "2 things missing"): Atlas capital entry +
  capital mastery/achievements.**
  - **Atlas:** the country reference page (`AtlasCountry.svelte`) now shows a localized **Capital**
    fact (`atlas.capitalLabel`); confirmed by a real `--screenshot` of the Belgium page ("Brussels").
  - **Capital mastery (separate rollup):** `computeMastery` gained an optional `modes` filter (default
    = the 4 identity modes); `CAPITAL_MODES` drives a distinct capital rollup so learning capitals never
    moves the country tally. History gains a **"Capital mastery"** panel (reuses `WorldMasteryMeter`,
    now parametrized with title/label/icon, + `RegionMasteryBreakdown`), shown once any capital has been
    played. Owner choice: capitals get their **own** progress surface — still "kept separate" from
    country mastery.
  - **Achievements:** 8 capital badges via a new `capitalMastery` field on `AchievementContext` — three
    world tiers (collector 25 / scholar 100 / master-all) + one per continent. New `landmark` icon
    (Lucide) themes them. Owner picked "three + per-continent".
  - **Verification:** `npm run test` 387 pass (new mastery/achievements/History/Atlas cases),
    `npm run check` 0 errors, `npm run lint` clean, `npm run build` OK. Atlas capital fact verified by
    screenshot; the capital-mastery panel verified by a History component test that seeds a capital SR
    item and asserts the panel appears (and is absent without capital play).
