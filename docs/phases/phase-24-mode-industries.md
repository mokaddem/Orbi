# Phase 24 — New game mode: Main industries

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
A new quiz mode about the **main industries** of a country — e.g. tourism, oil & gas, agriculture,
automotive, mining, finance. Tests economic/geographic knowledge beyond names and shapes.

## In scope
- A new game mode built on a per-country "main industries" dataset.
- The **sourcing and curation of that dataset** (the hard part) plus generation, distractors, and UI.

## Current state (so scope is clear)
- **There is NO bundled data source for this.** Unlike German names, capitals, and languages (all in
  `world-countries`), industries are **not** present in any current dependency. `world-countries` has
  `currencies`, `area`, `landlocked`, `borders` — but nothing on industry/economy. **A new dataset must
  be created and bundled.** This is the phase's central risk and effort, not the UI.
- **The engine is country-centric and single-answer** (`Question.answer: Country`, one correct option,
  `itemKey = ${mode}:${iso2}`). Industries are **many-to-many** (a country has several; an industry
  spans many countries), so — like languages (Phase 22) — this needs the shared "attribute-quiz"
  generalization (answer/options not restricted to `Country`, possibly multi-select).
- **Modes are a closed union** (`GameMode`) surfaced in `Play.svelte` + `ModeIcon` + `modes.*` /
  `play.prompt.*` i18n. Adding a mode touches all of these.

## Depends on
Phase 2 (quiz engine) **and a new curated dataset (see Deliverables)**. Uses the shared attribute-quiz
generalization from Phase 22/23. **Recommended to build last** in the v1.3 track — it has the least
certain data story.

## Scope / Deliverables
- [ ] **Source & curate the industries dataset (the crux)** — choose a licensing-clean, offline source
      and a **controlled taxonomy** of industry categories (so options are consistent and translatable),
      then map each in-scope country to its main industries. Bundle as JSON in `src/data/generated/`
      (or a hand-maintained source the build step copies). Candidate source: **CIA World Factbook**
      "Economy — industries" field (public domain).
- [ ] **Taxonomy + translations** — a finite set of ~15–30 industry categories (e.g. agriculture,
      tourism, oil & gas, textiles, automotive, mining, electronics, finance, fishing, chemicals),
      translated EN/FR/DE so they can be shown as options in any locale.
- [ ] **Build-data integrity check** — every in-scope country maps to ≥ 1 taxonomy industry, or is on
      an explicit, reviewed exclusion list (mirror the `KNOWN_NO_GEOMETRY` pattern).
- [ ] **Engine (shared)** — the attribute-question generalization (answer/options beyond `Country`,
      multi-select if chosen); pure + unit-tested; SR/history keyed per-country.
- [ ] **Mode + UI** — new `GameMode` value(s); `Play.svelte` card + `ModeIcon` glyph; prompt + `modes.*`
      strings (EN/FR/DE); render via `ChoiceGrid` (multi-select if chosen).
- [ ] **Question generation & distractors** — plausible wrong industries the country is **not** known
      for; never offer one of its real main industries as a distractor.
- [ ] **Tests** — dataset integrity, generation, distractor rules, scoring, i18n parity.

## Technical notes
- **Controlled vocabulary, not free text.** Raw Factbook prose ("food processing, footwear, tourism…")
  must be normalised into the fixed taxonomy so options are clean, comparable, and translatable. This
  curation/normalisation is the bulk of the work and should be reviewed by the owner.
- **"Main" needs a definition** — top exports vs. largest employers vs. GDP share vs. "what the country
  is known for." These disagree; pick one and state it in the copy so the quiz is defensible.
- **Framing mirrors languages** (Phase 22): single-select "which is a main industry of X", multi-select
  "select all main industries of X", or "which country's main industries are …". Reuse whatever the
  languages/capitals phases settle for the attribute-quiz interaction.
- **Coverage vs. effort** — curating all 195 to a good standard is significant. An MVP could cover only
  larger/well-known economies and grow later — but the pool must stay large enough to be a real quiz
  (see Phase 19 on small pools). If scope is reduced, **`log()`/document what's excluded** so it isn't
  silently narrow.

## Open Questions — to resolve with the owner
1. **Data source & licensing** — CIA World Factbook (public domain) vs. another bundled source vs.
   hand-authored. Must be offline and redistributable.
2. **Taxonomy granularity** — how many categories, and how coarse (e.g. "manufacturing" vs. split into
   automotive/electronics/textiles)?
3. **Coverage** — all 195 countries, or a curated subset of major economies for the MVP?
4. **Definition of "main"** — exports, employment, GDP share, or reputation?
5. **Framing** — single-select, multi-select, or industry→country? (Align with Phase 22's choice.)
6. **Localisation** — confirm the taxonomy is translated EN/FR/DE.
7. **Mastery** — feed per-country mastery/achievements, or stay separate?

## Acceptance criteria
- A bundled, curated industries dataset exists with an integrity check; its source and "main"
  definition are documented.
- The mode is playable end-to-end; distractors never include a country's real main industry.
- Core generation/scoring unit-tested; new mode appears in Play with an icon + localised strings
  (incl. the translated taxonomy); EN/FR(/DE) parity holds.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- Economic figures/statistics (GDP numbers, trade balances) — this is category association, not data
  viz.
- Time-series or "how has this changed" content; the dataset is a static snapshot.
- Auto-scraping at runtime — the dataset is curated and bundled at build time (offline-first).

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list ("main industries in countries").
  Flagged as the highest-risk mode (no bundled data source — needs a curated dataset). NOT built —
  awaiting the clarifying round and explicit build approval.**
