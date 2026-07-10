# Phase 25 — New game mode: Main industries

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
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
  spans many countries), so — like languages (Phase 23) — this needs the shared "attribute-quiz"
  generalization (answer/options not restricted to `Country`, possibly multi-select).
- **Modes are a closed union** (`GameMode`) surfaced in `Play.svelte` + `ModeIcon` + `modes.*` /
  `play.prompt.*` i18n. Adding a mode touches all of these.

## Depends on
Phase 2 (quiz engine) **and a new curated dataset (see Deliverables)**. Uses the shared attribute-quiz
generalization from Phase 23/24. **Recommended to build last** in the v1.3 track — it has the least
certain data story.

## Scope / Deliverables
- [x] **Source & curate the industries dataset (the crux)** — hand-authored `scripts/data/industries.mjs`
      (`INDUSTRY_TAXONOMY` + `COUNTRY_INDUSTRIES` + `KNOWN_NO_INDUSTRY`); `build-data.mjs` attaches an
      `industries` field to each record. Sourced from the public-domain CIA World Factbook "Economy —
      industries" field + general knowledge, normalised into our taxonomy. **142/195 covered.**
- [x] **Taxonomy + translations** — 20 owner-approved categories, translated EN/FR/DE in `INDUSTRY_TAXONOMY`.
- [x] **Build-data integrity check** — every in-scope country is in `COUNTRY_INDUSTRIES` (≥1 valid key) xor
      `KNOWN_NO_INDUSTRY`; fails on gaps, contradictions, out-of-scope entries, bad/typo'd keys, and dead
      (unused) taxonomy categories. Mirrors the `KNOWN_NO_GEOMETRY` pattern; counts + exclusions in `meta.json`;
      coverage + per-region split logged.
- [x] **Engine (shared)** — new single-select branch in `buildQuestion` (`isIndustryMode`), plus
      `selectIndustryDistractors` / `pickCorrectIndustry` / `isIndustryQuizEligible`. Pure + unit-tested;
      SR/history keyed per-country (`country-to-industry:${iso2}`).
- [x] **Mode + UI** — `GameMode` `country-to-industry`; `Play.svelte` card + `ModeIcon` factory glyph; prompt +
      `modes.mainIndustries` + reveal strings (EN/FR/DE); renders via the shared attribute `ChoiceGrid`.
      Industries shown on the Atlas country page (standing convention).
- [x] **Question generation & distractors** — one real industry is correct; distractors are taxonomy
      industries the country lacks (geography-tiered), **never one of its real industries**.
- [x] **Tests** — dataset integrity (`countries.test.ts`), generation/distractor/scoring/eligibility
      (`questions.test.ts`), achievements + i18n parity all green (413 tests).

## Technical notes
- **Controlled vocabulary, not free text.** Raw Factbook prose ("food processing, footwear, tourism…")
  must be normalised into the fixed taxonomy so options are clean, comparable, and translatable. This
  curation/normalisation is the bulk of the work and should be reviewed by the owner.
- **"Main" needs a definition** — top exports vs. largest employers vs. GDP share vs. "what the country
  is known for." These disagree; pick one and state it in the copy so the quiz is defensible.
- **Framing mirrors languages** (Phase 23): single-select "which is a main industry of X", multi-select
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
5. **Framing** — single-select, multi-select, or industry→country? (Align with Phase 23's choice.)
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
- **2026-07-10 — Clarifying round resolved with owner; explicit go given. Decisions:**
  - **Q1 Data source** → hand-authored curated `scripts/data/industries.mjs` (facts aren't
    copyrightable; reference public-domain CIA World Factbook "Economy — industries" + general
    knowledge, normalised into our own taxonomy). Offline, redistributable.
  - **Q2 Taxonomy** → **20 approved categories**: agriculture, fishing, mining (ores/minerals),
    oil & gas, metals & steel, chemicals, textiles & apparel, food & beverages, automotive,
    machinery & equipment, electronics, tourism, finance & banking, shipping & logistics,
    construction materials (cement), pharmaceuticals, energy/power generation, IT & software,
    aerospace & defence, timber & paper. Translated EN/FR/DE.
  - **Q3 Coverage** → **~110–120 well-known countries**; smallest/hardest-to-source micro-states
    excluded via a `KNOWN_NO_INDUSTRY` allow-list; log the excluded set + per-region counts.
  - **Q4 "Main"** → **reputation** ("what the country is known for"); stated in on-screen copy.
  - **Q5 Framing** → **single-select** "Which of these is a main industry of X?" (one correct card;
    distractors are taxonomy industries the country is *not* known for — never a real one). Diverges
    from languages' multi-select; mechanically mirrors the capitals attribute mode.
  - **Q6 Localisation** → yes, taxonomy EN/FR/DE.
  - **Q7 Mastery** → add `industries` as the **third "Extra knowledge" topic** (own ladder +
    achievements, folded into the combined progress panel).
  - Owner **waived the data-table review**. New mode value: `country-to-industry`; itemKey
    `country-to-industry:${iso2}`; Atlas country page will show industries (standing convention).
  - **Spun off** the wrong-answer "why" fun-fact idea into its own **Phase 32** (content-heavy /
    cross-cutting) — see `phases/phase-32-answer-explanations.md`.
- **2026-07-10 — Built & verified. ✅ Done.**
  - **Data:** `scripts/data/industries.mjs` (20-category taxonomy EN/FR/DE + per-country map +
    `KNOWN_NO_INDUSTRY`); `build-data.mjs` attaches `industries`, runs the exhaustive/honest integrity
    checks, logs coverage. **142 covered / 53 excluded** (Africa 29, Americas 26, Asia 43, Europe 40,
    Oceania 4). *This runs above the ~110–120 estimate the owner picked, because a defensible
    reputation-industry was sourceable for nearly every non-micro state. **Owner reviewed and accepted
    the 142-country coverage on 2026-07-10 — no trim.** Oceania is a thin pool (4) inherently.*
  - **Engine:** `country-to-industry` single-select attribute mode (mirrors capitals mechanically);
    `selectIndustryDistractors` (never a real industry, geo-tiered), `pickCorrectIndustry`,
    `isIndustryQuizEligible`; registered across `modes.ts` (`INDUSTRY_MODES`, `EXTRA_TOPICS` third topic).
  - **UI/i18n:** Play mode card + factory `ModeIcon`/`icons.ts` glyph, prompt + reveal, `modes.mainIndustries`
    and `progress.industryMastery` + 8 achievements in EN/FR/DE; industry mastery ladder folded into the
    combined "extra knowledge" panel (`History.svelte`); Atlas country page shows industries.
  - **Verification:** `npm run check` clean; **413 Vitest tests pass**; `npm run lint` clean; headless-Chrome
    on :5180 confirmed the mode card, a live question (Armenia → Mining vs. distractors), the wrong-answer
    reveal, and FR taxonomy rendering.
  - **Follow-up:** ready to archive this PRD once committed to `main` (per the archive step).
