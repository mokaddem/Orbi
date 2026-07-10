# Phase 23 — New game mode: National / official languages

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
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
- [x] **Dataset** — extended `build-data.mjs` + the `Country` type with `languages: LanguageRef[]`
      (ISO-639-3 code + localised name). Curated FR/DE names in `scripts/data/languages-i18n.mjs`
      (English default + overrides where the exonym differs; owner-review banner). Integrity checks:
      every in-scope country has ≥ 1 language (195/195), plus honesty guards on the curated map
      (no stale codes, no no-op overrides).
- [x] **Engine generalization (shared)** — extended the Phase-24 attribute-question abstraction with a
      **multi-select** shape: `Question.correctOptionIds` + `MULTI_SELECT_MODES`/`isMultiSelectMode`,
      `checkAnswer`/`session.submit` accept a `string[]` and grade **all-or-nothing**. Pure +
      unit-tested; SR/history/itemKey stay per-country (`country-to-languages:${iso2}`).
- [x] **Mode + UI** — new `GameMode` `country-to-languages`; a `Play.svelte` mode card + a `ModeIcon`
      glyph (speech bubble); prompt + `modes.*` / `play.multi.*` / feedback strings (EN/FR/DE); a
      **multi-select `ChoiceGrid`** variant (toggle → Submit) with a distinct reveal.
- [x] **Question generation & distractors** — bespoke `selectLanguageDistractors`: geography-tiered
      languages the country does **not** speak (never a real one). Option count adapts (6–8);
      countries with > 5 languages are excluded as answers (3 dropped: Namibia/South Africa/Zimbabwe).
- [x] **Scoring** — **all-or-nothing** (owner-agreed): the picked set must equal the correct set
      exactly → boolean `QuestionResult.correct`, so SR/history need no special-casing.
- [x] **Progress integration** — kept **separate from country mastery** (like capitals) and folded
      with capitals into one combined **"Extra knowledge"** History panel (compact per-topic meter,
      expandable regions) + a parallel language achievement ladder grouped there via a `topic` tag —
      the owner's "fold both together" design (industries slot in next).
- [x] **Tests** — generation, distractor rules (no real language; tiering), all-or-nothing scoring
      (over/under/empty/order), option-count cap, multi-select `ChoiceGrid`, Play in-game flow,
      mastery/achievement separation, combined-panel appearance, trainability, i18n parity.

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
- **2026-07-10 — Clarifying round resolved with the owner, then built (explicit "All good. Go ahead!").**
  - **Open questions answered:** (1) Framing — **B, multi-select "select all"** (faithful to
    "Belgium has 3"); ships one mode, `country-to-languages`. (2) Language scope — **use the
    `world-countries` set as-is**, worded as "languages spoken in" (not a legal "official" claim).
    (3) Localised names — **curated EN/FR/DE map** (`scripts/data/languages-i18n.mjs`, English default
    + exonym overrides), flagged for owner translation review. (4) Distractors — bespoke
    **geography-tiered "confusable languages"** the country doesn't speak. (5) Scoring/SR —
    **all-or-nothing** (boolean result → SR unchanged). (6) Mastery — **kept separate** from country
    mastery and, per the owner's ask, **folded together with capitals** (and future industries) into
    one combined "Extra knowledge" surface instead of each getting its own panel.
  - **Engine (extends the Phase-24 attribute engine):** `Question.correctOptionIds` (a correct *set*);
    `MULTI_SELECT_MODES` / `isMultiSelectMode`; `checkAnswer` + `session.submit` accept `string[]` and
    grade exact-set equality; `selectLanguageDistractors` (tiered foreign languages, never a spoken
    one); `languageOptionCount` (6–8, ≥ 3 distractors); `isLanguageQuizEligible` / `MAX_QUIZ_LANGUAGES`
    (≤ 5 → drops Namibia/South Africa/Zimbabwe, whose 9/11/15-language lists are unwieldy + fuzziest).
  - **Combined "extra knowledge" surface:** the standalone capital panel became one panel holding a
    compact `WorldMasteryMeter` per active topic (capitals, languages), each expandable to its region
    breakdown (`ExtraMasteryTopic.svelte`); the achievement catalog gained a topic-parametrized ladder
    (`extraTopicBadges`, `topic` field) so capitals keep their ids and languages mirror them, rendered
    grouped inside the panel — the main achievements grid stays country/skill/habit only. Language
    mastery uses the **language-eligible** denominator (192) so 100% is reachable.
  - **Verification:** fast loop green — `npm run test` (**403 pass**, incl. new questions/achievements/
    ChoiceGrid/Play/History/training cases), `npm run check` (0 errors), `npm run lint` clean,
    `npm run build` OK (195/195 languages integrity, 139 distinct). Real `--screenshot` confirms the
    7th "National languages" mode card + glyph on setup; the multi-select in-game flow, all-or-nothing
    grading, and the combined History panel (capitals + languages) are verified by component tests
    (interactive headless Chrome is blocked in this sandbox — only self-exiting `--screenshot` runs).
  - **Owner review pending (non-blocking):** the seeded FR/DE names in `languages-i18n.mjs` — English
    default is used wherever no confident exonym was added; French language labels are capitalised as
    display labels (strict French would lower-case them).
