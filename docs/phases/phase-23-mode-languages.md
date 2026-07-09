# Phase 23 — New game mode: National / official languages

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
A new quiz mode about the **languages a country speaks** — e.g. Belgium has **three** (Dutch, French,
German). Tests the association between a country and its official/national language(s).

## In scope
- A new game mode (or a small pair of directions) built on per-country language data.
- The data pipeline, question generation, distractors, scoring, and UI to support it.

## Current state (so scope is clear)
- **Data is available in an existing dependency.** `world-countries` carries a `languages` object per
  country (ISO-639-3 code → English language name), present for **all 195** in-scope countries — e.g.
  Belgium `{ deu:"German", fra:"French", nld:"Dutch" }`, Switzerland `{ fra, gsw, ita, roh }`. There
  are **~141 distinct language values** across UN members. It is **not** in our generated dataset yet;
  `build-data.mjs` must add it.
- **The engine is country-centric — this is the key architectural constraint.** `Question.answer` is
  always a `Country`; `itemKey = ${mode}:${iso2}`; `QuestionResult.countryIso2`; distractors
  (`selectDistractors`) return **countries**; single-select `checkAnswer` compares ISO codes. Languages
  are **many-to-many** (a country has several languages; a language spans many countries), so at least
  one framing needs a generalization of the question model beyond "answer is a Country" and "one
  correct option."
- **Modes are a closed union** (`GameMode`) surfaced in `Play.svelte` mode cards + `ModeIcon` glyphs +
  `modes.*` / `play.prompt.*` i18n. Adding a mode touches all of these.

## Depends on
Phase 2 (quiz engine). **Shares an "attribute-quiz" engine generalization with Phases 24 (capitals) and
25 (industries)** — whichever of the three is built first should land that shared work (see Technical
notes). Recommended order: capitals first (simplest), then languages, then industries.

## Scope / Deliverables
- [ ] **Dataset** — extend `build-data.mjs` + the `Country` type to include `languages` (code +
      English name; localised names per Open Question). Add an integrity check that every in-scope
      country has ≥ 1 language.
- [ ] **Engine generalization (shared)** — introduce an "attribute question" abstraction so the answer
      and options aren't restricted to `Country` (needed unless we pick only the `language→country`
      framing). Keep it pure and unit-tested; SR/history keys stay per-country (`${mode}:${iso2}`).
- [ ] **Mode + UI** — new `GameMode` value(s); a `Play.svelte` mode card + a `ModeIcon` glyph; prompt
      and `modes.*` strings (EN/FR + DE); render via `ChoiceGrid` (extend for multi-select if chosen).
- [ ] **Question generation & distractors** — plausible wrong languages (e.g. from neighbouring
      countries / same region) that the country does **not** actually speak; never offer a real
      language of the country as a distractor.
- [ ] **Scoring** — define correctness for the chosen framing (esp. multi-select: all-or-nothing vs.
      partial credit) and how it records a `QuestionResult`.
- [ ] **Progress integration** — decide how this mode feeds mastery/achievements (Phase 16), which
      currently assume the four country-identification modes.
- [ ] **Tests** — generation, distractor rules, scoring (incl. multi-select edge cases), i18n parity.

## Technical notes
- **Framing is the crux** (Open Question 1):
  - **(A) Single-select** — "Which of these is an official language of Belgium?" one correct language
    among distractor languages. Needs the attribute generalization (answer = a language).
  - **(B) Multi-select** — "Select all official languages of Belgium." Most faithful to the "Belgium
    has 3" framing, but needs a **new multi-select interaction** + scoring, the biggest UI lift.
  - **(C) Language → country** — "Which country has Dutch, French & German as official languages?"
    answer stays a `Country` (fits the engine as-is), options are countries. Cheapest, but listing the
    exact set can give the answer away.
- **"Official/national" is itself fuzzy.** `world-countries.languages` is a reasonable, bundled,
  offline source but conflates official/national/widely-spoken to varying degrees. Bound the claim
  carefully in copy, and treat the data as "languages associated with the country," not a legal claim.
- **Localised language names are a data gap.** The source names are English strings; French/German
  language-name translations aren't in it. Options: show English names, hardcode a small translation
  map for the common ones, or add a lightweight bundled source — decide with the owner.

## Open Questions — to resolve with the owner
1. **Framing** — A (single-select), B (multi-select, matches "Belgium has 3"), or C (language→country)?
   Ship one, or more than one direction?
2. **Language scope** — official only, or official + de-facto/regional? How to keep it defensible given
   the source's fuzziness?
3. **Localised language names** — English-only, a small hand-curated EN/FR/DE map, or a new bundled
   source?
4. **Distractor selection** — geography-tiered like `selectDistractors`, or "confusable languages"?
5. **Multi-select scoring & SR** (if framing B) — all-or-nothing vs. partial; what counts as a "miss"
   for spaced repetition?
6. **Mastery** — does this mode contribute to per-country mastery/achievements, or stay separate?

## Acceptance criteria
- The mode is playable end-to-end with the chosen framing; questions and distractors are correct
  (never a real language of the country as a wrong option).
- Language data is in the dataset with an integrity check; core generation/scoring is unit-tested,
  including multi-select edge cases if applicable.
- New mode appears in Play with an icon + localised strings; EN/FR(/DE) parity holds.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- Language *families*, scripts, phonetics, or "which language is this text?" — country↔language only.
- Per-region language statistics/visualisations.
- Localised language names beyond whatever Open Question 3 decides.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list ("national languages for each
  country, e.g. Belgium has 3"). NOT built — awaiting the clarifying round and explicit build
  approval.**
