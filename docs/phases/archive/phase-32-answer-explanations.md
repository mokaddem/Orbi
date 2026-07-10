# Phase 32 — Answer explanations ("why" fun facts)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.6 learning depth (explain the answer)

> **Shipped (2026-07-10):** industries pilot — a "Did you know?" reveal on wrong industries answers,
> backed by a curated trilingual fact store (224 (country, industry) pairs across the 58 priority
> economies; "Option A"). Wrong-answers-only, durable phrasing, full EN/FR/DE parity, graceful
> silent-omit for the uncovered long tail. Atlas tie-in and other modes deferred as follow-ups.

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Turn a wrong answer from a dead end into a learning moment. When the player answers (at least when
they get it **wrong**), the reveal shows a short, memorable **"why the correct answer is true"** fact
— e.g. on the industries mode, missing *Oil & gas* for the **UAE** reveals *"Oil & gas funds ~30% of
the UAE's GDP and the bulk of government revenue."* The aim is delight + retention, not a stats
dashboard.

## Motivation
Owner request (2026-07-10), raised while approving the Phase 25 industries mode: "When the user makes
a mistake, show a fun fact about **why** the correct answer is true — be creative." Spun into its own
phase because the work is **content-heavy** (a curated, trilingual fact per fact-bearing item) and
**cross-cutting** (the reveal surface is shared across modes), so it dwarfs any single mode.

## In scope
- A reveal-time **explanatory blurb** attached to the correct answer, shown on the answer feedback UI.
- The **curated fact dataset** (the crux — like Phase 25, the content is the effort, not the UI).
- Which modes it covers (see Open Questions) — **industries is the motivating first target.**

## Current state (so scope is clear)
- **Answer reveal already exists** — `Play.svelte` has per-mode feedback/reveal branches (e.g.
  `revealLanguages`, capital reveal) after `checkAnswer`. This phase adds an explanation slot there;
  it does **not** invent the reveal surface.
- **No fact dataset exists.** Nothing in `world-countries` or any dependency carries "why" prose.
  Like industries (Phase 25), a fact source must be **hand-authored and bundled** — and here it must
  be authored in **EN/FR/DE** (the parity test enforces trilingual coverage of any shipped strings).
- **Facts key to items, not just countries.** A country has one flag/shape/capital but *several*
  industries and languages — so a fact keyed only by country is too coarse for the attribute modes;
  the natural key is `(country, attributeValue)` (e.g. `AE + oil-gas`).
- **Volatile figures are a curation trap.** "Exports X% of the global market" ages badly. The
  industries PRD (Phase 25) deliberately keeps economic *statistics* out of the quiz itself; a fun
  fact may cite a memorable figure, but must favour durable phrasing and/or a stated snapshot year.

## Depends on
Phase 2 (engine/reveal) and the modes it enriches. **Phase 25 (industries) is the motivating first
target** and the recommended pilot; naturally extends to 24 (capitals), 23 (languages), and the four
identity modes as coverage grows. Buildable incrementally — land the mechanism + industries facts
first, widen coverage later.

## Scope / Deliverables
- [x] **Fact dataset (the crux)** — `scripts/data/industry-facts.mjs`: a bundled, hand-authored,
      trilingual (EN/FR/DE) fact store keyed by `iso2 → industryKey → { en, fr, de }`. Facts aren't
      copyrightable; authored from general knowledge / public-domain references. Assembled onto each
      `IndustryRef` (optional `fact?`) by `build-data.mjs`. **224 (country, industry) pairs across
      the 58 priority economies ("Option A": full facts for the covered set).**
- [x] **Coverage policy + integrity check** — a *subset by design* (silent-omit for the long tail),
      so — unlike industries — there is **no exhaustiveness gate**. The build instead fails on a fact
      for an out-of-scope country, a fact keyed to an industry the country doesn't carry (stale/typo),
      or a fact missing an en/fr/de string; coverage (`224/446 pairs, 58 countries`) is logged.
      Missing facts degrade gracefully (the reveal simply omits the blurb).
- [x] **Reveal UI** — a "Did you know?" slot in `Play.svelte`'s feedback area, shown **only on wrong
      industries answers**, explaining why the *correct* industry (`correctOptionId`) fits the country.
      A calm turquoise (`--color-accent-weak`) callout with a 💡 glyph, set apart from the red "wrong"
      state; doesn't block auto-advance. Reuses the Phase-18 visual language.
- [x] **i18n** — all shipped facts present in EN/FR/DE (build-enforced completeness); the chrome
      string `play.feedback.didYouKnow` added to all three catalogs (covered by the parity test).
- [x] **Tests** — data tests in `countries.test.ts` (facts attach only to real industries, full
      trilingual completeness, coverage matches meta, long tail stays uncovered); `Play.test.ts`
      component tests (a wrong industries answer shows the fact when curated, omits it otherwise).

## Technical notes
- **Fact key granularity** — for identity/capital modes, `iso2` suffices; for industries/languages,
  key on `(iso2, value)`. A single fact store keyed by a composite string (e.g. `"AE:oil-gas"`,
  `"FR"` for country-level) keeps lookups uniform.
- **Authoring cost is the schedule.** Trilingual facts for even one attribute mode is a large writing
  task; scope coverage explicitly and `log()` what's uncovered (Phase 19 / 25 discipline).
- **Reuse, don't rebuild** — the reveal already knows the correct answer + the answered country; this
  phase looks up a fact for that item and renders it. Keep the fact store pure/bundled and the lookup
  in the domain layer so it's unit-testable.
- **Atlas tie-in (optional)** — per the "Atlas reflects country data" convention, facts could also
  surface on the Atlas country page; decide whether that's in scope here or a follow-up.

## Open Questions — to resolve with the owner
1. **Trigger** — wrong answers only, or also a (different) note on correct answers as reinforcement?
2. **Mode coverage** — industries only for v1, or capitals/languages/identity modes too? (Drives the
   authoring volume the most.)
3. **Figures vs. phrasing** — allow memorable percentages/numbers (with a snapshot year), or keep
   facts qualitative to avoid staleness?
4. **Fallback** — when no fact exists, silently omit, or show a generic reinforcement line?
5. **Tone/length** — one crisp sentence ("Did you know?") vs. two; how playful?
6. **Localisation depth** — full EN/FR/DE for every shipped fact (parity), or English-first with FR/DE
   backfilled (would need a parity-test exception strategy)?
7. **Atlas** — surface the same facts on the Atlas country page, or keep to the quiz reveal for now?

## Acceptance criteria
- A wrong answer in the covered mode(s) reveals a correct, on-topic "why" fact; missing facts degrade
  gracefully (no blank slot, no error).
- The fact dataset is bundled, integrity-checked, and its coverage/source documented; no stale keys.
- Facts render in the active locale with EN/FR/DE parity for shipped strings.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- A statistics/data-viz surface (charts, live figures) — this is a short prose blurb, not analytics.
- Runtime fetching or AI-generated facts — the store is curated and bundled at build time (offline).
- Exhaustive coverage of all modes in the first increment (grow coverage over time).

## Progress log
- **2026-07-10 — PRD drafted from the owner's request (raised while approving Phase 25): on a wrong
  answer, reveal a fun "why the correct answer is true" fact (e.g. UAE → oil & gas share of GDP).
  Spun out of Phase 25 because the trilingual fact content is significant and cross-cutting. NOT
  built — awaiting the clarifying round and explicit build approval.**
- **2026-07-10 — Clarifying round resolved with the owner, then built and shipped.**
  Owner decisions on the open questions:
  - **Q2 coverage** → **Industries only (pilot)**, with **"Option A"**: full facts for the ~58
    most-recognisable economies (every industry each carries), silent-omit for the rest.
  - **Q1 trigger** → **wrong answers only** (keeps the correct-answer flow fast).
  - **Q3 figures** → **durable phrasing; a figure only with a stated year** (avoid staleness).
  - **Q6 localisation** → **full EN/FR/DE parity** for every shipped fact.
  - Defaults accepted for the rest: **Q4** silent-omit when no fact exists; **Q5** one crisp
    "Did you know?" sentence in the playful style; **Q7** quiz-reveal only — **Atlas country-page
    tie-in deferred** to a follow-up (noted against the "Atlas reflects country data" convention).
  Implementation: new `scripts/data/industry-facts.mjs` (224 pairs / 58 countries, EN/FR/DE);
  `IndustryRef.fact?` added to `src/data/types.ts`; `build-data.mjs` attaches facts + adds
  fact-integrity checks and coverage logging (`meta.counts.industryFactPairs` / `withIndustryFacts`);
  `Play.svelte` renders the "Did you know?" callout on wrong industries answers; `didYouKnow` string
  in en/fr/de. **Verified:** `npm run check` / `test` (472 passing incl. new data + component tests)
  / `lint` all green; headless-Chrome capture on :5180 of the reveal in **EN and FR** (label,
  accents, guillemets render; fact matches the correct green option; no overflow). Note: the
  long-running dev server was serving stale pre-fact data (Vite didn't HMR the generated JSON) — it
  was restarted so the live check ran against the regenerated dataset. **Grows later** to
  capitals/languages/identity modes and the Atlas page.**
