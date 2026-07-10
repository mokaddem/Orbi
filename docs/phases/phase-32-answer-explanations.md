# Phase 32 — Answer explanations ("why" fun facts)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.6 learning depth (explain the answer)

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
- [ ] **Fact dataset (the crux)** — a bundled, hand-authored, trilingual (EN/FR/DE) fact store keyed
      by item (`iso2` and, for attribute modes, the attribute value/key). Licensing-clean (facts
      aren't copyrightable; reference public-domain/general-knowledge sources). Lives alongside the
      other curated sources in `scripts/data/` and is assembled by `build-data.mjs`.
- [ ] **Coverage policy + integrity check** — decide which items must have a fact vs. an explicit
      "no fact yet" fallback; mirror the `KNOWN_NO_GEOMETRY` allow-list pattern so gaps are explicit,
      not silent. Missing a fact must degrade gracefully (reveal simply omits the blurb).
- [ ] **Reveal UI** — an explanation slot in `Play.svelte`'s feedback area, shown on wrong answers
      (and optionally on correct — see Open Questions). Unobtrusive, dismissible, doesn't block the
      "next question" flow. Reuse the playful visual language (Phase 18).
- [ ] **i18n** — all shipped fact strings present in EN/FR/DE with placeholder parity; any UI chrome
      strings ("Did you know?") localised too.
- [ ] **Tests** — dataset integrity (fact keys resolve to real items; no stale keys), reveal renders
      the right fact for the answered item, graceful fallback when absent, i18n parity.

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
