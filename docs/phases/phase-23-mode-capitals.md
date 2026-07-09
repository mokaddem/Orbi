# Phase 23 — New game mode: Capitals

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
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
by Phases 22 (languages) and 24 (industries): the `capital → country` direction needs none of it, and
`country → capital` introduces it in the cleanest, most contained way. Build capitals first.

## Scope / Deliverables
- [ ] **Dataset** — extend `build-data.mjs` + the `Country` type to include `capital` (list; localised
      per Open Question). Integrity check: every in-scope country has ≥ 1 capital.
- [ ] **Mode(s)** — add `capital-to-country` (MVP) and, if chosen, `country-to-capital`; register in the
      `GameMode` union and everywhere it's switched.
- [ ] **Engine (shared, only if `country → capital` is included)** — the attribute-question
      generalization so options can be capital strings; pure + unit-tested; SR/history stay keyed
      per-country.
- [ ] **UI** — `Play.svelte` mode card(s) + `ModeIcon` glyph(s); prompt + `modes.*` strings (EN/FR +
      DE); reuse `ChoiceGrid`.
- [ ] **Distractors** — `capital → country` reuses `selectDistractors` as-is; `country → capital` needs
      capital distractors (tier by geography, mirroring the sub-region → region → world tiers).
- [ ] **Multiple-capital handling** — pick a canonical capital and/or accept any valid one; decide and
      document.
- [ ] **Tests** — generation, distractors, multi-capital handling, i18n parity.

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
