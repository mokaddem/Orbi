# Phase 27 — Targeted practice (custom country & attribute session builder)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
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
- [ ] **Country picker UI** — select an arbitrary set of countries. Support at least: seed-from-region
      (expand a region and toggle members), free-text **search by name**, and clear/select-all within a
      group. Show a running count and the chosen set. (Map-based lasso selection is a possible extra —
      see Open Questions.)
- [ ] **Attribute/mode picker** — choose which mode(s) to drill on the set. Driven off the `GameMode`
      list (+ future modes) so it stays current. If multi-mode is chosen (Open Question), define how a
      mixed session is composed and graded.
- [ ] **Launch** — build a `RunConfig` with `answerPoolIso` = the chosen countries and run via the
      existing `play.start` flow; session length defaults sensibly to the set size (like training) or a
      chosen fixed length.
- [ ] **Entry point** — where targeted practice lives (a mode card on the Play setup, a distinct
      "Custom / Targeted" screen, or an extension of the existing "Custom play" link). Decide with owner.
- [ ] **(Optional) Save a set** — persist named custom sets for reuse (IndexedDB prefs/collection).
      Only if the owner wants it; otherwise sets are one-shot.
- [ ] **SR / history integration** — decide whether targeted-practice answers feed SM-2 + mastery like
      any session (recommended: yes, they're normal sessions) or stay excluded.
- [ ] **i18n** — picker/labels/prompts in EN/FR/DE with parity.
- [ ] **Tests** — set assembly (search/toggle/select-all), config building, that a session asks only
      about the chosen set, and multi-mode composition if included.

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

## Open Questions — to resolve with the owner
1. **Multi-mode in one session?** Single-mode targeted practice (simplest), or interleave several
   attributes over the same set in one round? (Recommendation: single-mode first; multi-mode later.)
2. **Country selection UX** — region-expand + search + select-all is the baseline. Add map lasso /
   tap-to-add on the world map? Add quick presets ("my current mistakes", "a region", "countries I've
   never seen")?
3. **Save & reuse sets** — persist named custom sets, or one-shot only for v1?
4. **Session shape** — length = set size (drill each once), a fixed length with repeats, or offer
   both/survival too?
5. **Feeds SR/mastery?** — treat as a normal session (recommended) or a separate practice space?
6. **Entry point** — new mode card, a dedicated screen, or fold into the existing "Custom play"?

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
</content>
