# Phase 11 — Input & answer-flow UX

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.1 enhancements (post-launch)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This change is about *feel*, and the right values (thresholds, timings, whether to keep a
> manual control) are subjective. **The implementer MUST ask the owner (Sami) as many
> clarifying questions as necessary — and get answers — before and during implementation,
> rather than guessing.** Do not start coding until the [Open Questions](#open-questions--to-resolve-with-the-owner)
> below are resolved. Record the answers (and any new questions) in the Progress log.

## Goal
Make answering faster and lighter-weight, with two concrete changes requested by the owner:
1. **Buttons instead of dropdowns when there are few options** — nicer, more tactile UX than
   a `<select>` for a short list.
2. **Remove the "Continue" confirm after answering** — show brief feedback, then **auto-advance
   to the next question after a short timer** instead of requiring a click.

## Depends on
Functional app (Phases 2–10). Recommended to land **before** the visual makeover in
[Phase 12](phase-12-visual-map-overhaul.md) so the makeover styles the final interaction model.

## Scope / Deliverables
- [x] **Segmented/button selectors for small option sets.** New `SegmentedControl.svelte`
      renders a pill-button group when options ≤ `threshold` (8), else falls back to a
      `<select>`. Wired into the Play setup's **region** and **sub-region** pickers
      (`src/ui/routes/Play.svelte`); in practice both are always buttons (≤ ~7 entries).
- [x] **Auto-advance after answering.** The feedback **Continue / See results** button is gone;
      an `$effect` shows feedback then auto-advances (route to the summary after the last
      question). Applies to **all modes**, including map modes and the survival death → summary.
- [x] **Timer robustness.** The effect's cleanup cancels the pending timer whenever the view
      leaves the answered state (next question, quit, unmount), so it can't double-advance.
- [x] **Accessibility preserved** — `aria-pressed` on the selector buttons, `role="group"` +
      `aria-label`; feedback keeps `role="status"`; the countdown bar is `aria-hidden`.
- [x] **Tests** — `SegmentedControl.test.ts` (buttons vs dropdown, threshold, change events) and
      updated `Play.test.ts` (button selectors + fake-timer auto-advance incl. the correct-vs-
      wrong dwell). Full suite 211 pass.
- [x] **i18n** — removed the now-unused `play.feedback.continue` / `seeResults` from `en` + `fr`.

## Technical notes
- The feedback → next transition is driven by `onContinue()` calling `play.advance()`; the
  timer should call the same path so session/SR wiring is unchanged.
- Consider that **wrong** answers need enough time to read the reveal (correct country) — the
  delay may need to differ by outcome, or wrong answers may warrant a manual acknowledge. This
  is an open question, not a decided design.
- Keep domain logic untouched — this is a UI-layer change.

## Open Questions — to resolve with the owner
Ask these (and any others that come up) before implementing; this list is a starting point,
not a limit:
1. **Buttons-vs-dropdown threshold:** how many options is "few"? (e.g. buttons ≤ 6, dropdown
   otherwise?) Should sub-regions always be buttons, or dropdown when there are many?
2. **Auto-advance delay:** how long to show feedback before advancing? Same for correct and
   wrong, or longer/hold-for-tap on wrong so the correct answer can be read?
3. **Manual control:** keep an optional "Next"/"Skip" affordance to advance immediately, or
   remove it entirely?
4. **Countdown affordance:** show a visual countdown (e.g. a shrinking bar) so the auto-advance
   is predictable, or advance silently?
5. **Last question:** auto-advance straight into the summary, or pause on the final feedback?
6. **Configurability:** should the delay (or "auto-advance on/off") be a setting, or hard-coded?
7. **Survival mode:** any different behaviour when a wrong answer ends the game?

## Acceptance criteria
- Small option sets are chosen via buttons; long ones still use a usable control.
- After answering, the game advances on its own after the agreed delay, with no required click,
  across all modes; the timer is cancel-safe.
- All owner questions above are answered and reflected in the implementation.
- Fast loop green (test / check / lint); Play flows covered by tests.

## Out of scope
- The broader visual restyle, option imagery, and map changes (see Phase 12).
- New game modes or session types.

## Progress log
- **2026-07-07 — Clarifying round done; decisions locked (owner).**
  1. **Buttons-vs-dropdown:** threshold-based — button group when ≤ 8 options, `<select>` above.
     Applies to both region and sub-region selectors.
  2. **Auto-advance delay:** ~1.5s on a correct answer.
  3. **Wrong answers:** hands-free, longer ~3s delay so the reveal can be read (no tap required).
  4. **Advance cue:** a subtle countdown bar; **no** manual Next/Skip button.
  5. **Final question:** auto-advance straight into the summary (consistent with all questions).
  6. **Survival fatal wrong answer:** same ~3s auto-advance to the summary.
  7. **Configurability:** timings are fixed/hard-coded (not a Settings option) for now.
  - Constants to use: `CORRECT_MS = 1500`, `WRONG_MS = 3000`, `BUTTONS_MAX = 8`.
  - Reduced motion: the countdown bar animation is disabled under `prefers-reduced-motion`
    (the JS auto-advance timer still fires).
- **2026-07-07 — Implemented & done.** Added `src/ui/components/SegmentedControl.svelte`
  (button group ≤ 8 options, else `<select>`) and wired it into the region/sub-region pickers;
  replaced the feedback Continue button with a cancel-safe auto-advance `$effect`
  (`CORRECT_MS`/`WRONG_MS`) plus a subtle `.countdown` bar (animation disabled under
  `prefers-reduced-motion`); removed the dead `willFinish` label and the unused
  `feedback.continue`/`seeResults` strings. Verified: fast loop green — **211 tests pass**
  (+6: 5 SegmentedControl, net +1 Play), **`check` 0 errors**, **`lint` clean**; headless-Chrome
  smoke confirms the region selector renders as buttons (no dropdown) in the running app.
  All owner decisions from the clarifying round are reflected.
