# Phase 11 — Input & answer-flow UX

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
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
- [ ] **Segmented/button selectors for small option sets.** On the Play setup screen the
      **region** and **sub-region** pickers are `<select>` dropdowns
      (`src/ui/routes/Play.svelte` ~L220–247). Replace them with a button/segmented group when
      the option count is small, and fall back to the dropdown when the list is long (regions
      are 5; sub-regions vary). Mode/type are already `.opt` buttons — keep consistent styling.
- [ ] **Auto-advance after answering.** Replace the feedback **Continue / See results** button
      (`Play.svelte` ~L348–362, `onContinue`) with: show feedback → wait a short delay →
      advance automatically (and route to the summary after the last question). Applies to
      **all modes**, including the map modes.
- [ ] **Timer robustness.** Cancel the pending timer on quit, unmount, and manual advance;
      never double-advance; handle the final-question → summary transition cleanly.
- [ ] **Accessibility preserved** — `aria-pressed` on the new buttons, keyboard operability,
      and a non-visual cue for the auto-advance (e.g. `role="status"` already on feedback).
- [ ] **Tests** — component tests for the new selectors and the auto-advance flow (Vitest fake
      timers), plus the existing Play flows kept green.
- [ ] **i18n** — any new/removed strings mirrored in `en` + `fr`.

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
- _(none yet)_
