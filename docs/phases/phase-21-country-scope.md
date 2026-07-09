# Phase 21 — Country scope: disclaimer & (optional) switchable definitions

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Be **explicit and honest about what the app counts as "a country."** Today the scope is the
UN-membership definition, applied silently. This phase surfaces that choice to the player — and
investigates whether a **disclaimer is enough**, or whether the player should be able to **switch
between definitions**. Per the owner: **start simple, then expand.**

## In scope
- **Stage A (start simple):** a clear, localised **disclaimer** explaining the definition in use and
  what it excludes. No gameplay change.
- **Stage B (expand — only if the owner opts in):** a **settings toggle** to switch the recognised set,
  propagated everywhere, plus encyclopedia explainers of contested cases.

## Current state (so scope is clear)
- **The scope rule lives in `scripts/build-data.mjs`:** in-scope = `world-countries` entries with
  `unMember: true` **plus** an explicit `OBSERVERS = { 'PS' }` (State of Palestine). Total **195**
  (193 members + Vatican City + Palestine). Everything else — Taiwan, Kosovo, dependent territories,
  partially-recognised states — is filtered out **before** the dataset is written, so the runtime only
  ever sees the 195.
- **The main PRD already frames this:** Non-Goals say "No dependent territories / disputed regions in
  the MVP (UN members + observers only)"; Deferred/Future lists "Dependent territories & configurable
  scope toggle." This phase is where that gets addressed.
- **Downstream coupling to the count of 195** (matters for Stage B): mastery totals & the "master every
  country/region" achievements (Phase 16), world-mastery denominators, region counts, and the
  encyclopedia (Phase 20) all assume the fixed in-scope set.

## Depends on
Phase 1 (data layer / scope definition). **Stage B's dispute explainers depend on Phase 20**
(encyclopedia) as their home. Otherwise independent.

## Scope / Deliverables

### Stage A — disclaimer (the "start simple" deliverable)
- [ ] **Author the disclaimer copy** (EN/FR, + DE with Phase 17): what definition is used (UN members +
      the Palestine/Vatican observers), that it's a pragmatic, widely-recognised baseline — **not** a
      political statement — and examples of what's excluded and why (Taiwan, Kosovo, dependent
      territories).
- [ ] **Surface it** — a "Country scope" / "About the data" section in Settings (and optionally linked
      from the encyclopedia once Phase 20 exists). i18n keys with `messages.test.ts` parity.
- [ ] **Document the rule** so the copy matches the code (reference `unMember` + `OBSERVERS` in
      `build-data.mjs`), and keep it accurate if the dataset scope ever changes.

### Stage B — switchable definitions (only on explicit owner opt-in; may become its own phase)
- [ ] **Data model** — extend the dataset with the additional entities (Taiwan, Kosovo, …) plus a
      `recognition` / `scope` field on every record; **default stays UN**. Requires flags (flag-icons
      has `tw`, `xk`) and geometry availability checks per entity in `build-data.mjs`.
- [ ] **Settings toggle** — choose the recognised set (e.g. UN-only / + widely-recognised / +
      dependencies); persist in `Prefs`.
- [ ] **Propagation** — apply the chosen scope to every country pool: Play setup, training/SR,
      recommendations, Daily, and the encyclopedia. **Resolve the mastery-denominator problem** (below).
- [ ] **Encyclopedia dispute pages** — for each contested entity: who recognises it, why there's
      disagreement, notable positions. Renders via Phase 20.

## Technical notes
- **Stage A is copy + one Settings section** — low risk, no data or gameplay change. This is almost
  certainly what "start simple" means; ship it alone first.
- **Stage B is a genuinely large feature** and geopolitically sensitive:
  - Changing the recognised set changes **denominators**. "Master every country in Europe" and
    world-mastery percentages shift if Kosovo appears/disappears. Decide whether progress math is
    **frozen to the default UN set** (simplest, consistent history) or **recomputed per chosen scope**
    (surprising jumps in "mastered X of Y"). Recommendation: freeze progress math to the default set,
    treat extra entities as playable-but-not-counted, or gate the whole toggle behind a clear warning.
  - Geometry/flags for added entities must exist at the bundled resolution or be handled as exceptions
    (mirror the existing `KNOWN_NO_GEOMETRY` pattern).
- Keep the copy **neutral and sourced**; the owner must approve exact wording before it ships.

## Open Questions — to resolve with the owner
1. **Scope of this phase** — disclaimer-only (Stage A) now, or commit to switchable definitions
   (Stage B)? (Recommend: **Stage A now**; spin Stage B into its own later phase if wanted.)
2. **If switchable** — which definitions to offer, and what's the source for the recognition data
   (so it's defensible and bundled)?
3. **Progress math** — when scope changes, freeze mastery/achievement denominators to the default set,
   or recompute? (This is the crux of Stage B's complexity.)
4. **Placement** — Settings only, or also an About page / encyclopedia note / first-run mention?
5. **Copy** — owner to review and approve the exact, neutral wording (sensitive topic).

## Acceptance criteria
- **Stage A:** a localised disclaimer is visible (Settings, at minimum) that accurately describes the
  UN-members-+-observers rule and what it excludes; **no gameplay/data change**; `messages.test.ts`
  parity holds; fast loop green.
- **Stage B (if built):** the player can switch definitions; the choice persists and consistently
  filters every country pool; the mastery-denominator decision from Q3 is implemented and documented;
  dispute explainers render in the encyclopedia; fast loop green + headless-Chrome check.

## Out of scope
- Any gameplay change in Stage A.
- Stage B entirely, unless the owner explicitly opts in (then treat this file as the Stage-A record and
  branch Stage B into its own phase PRD).
- Taking a political position — the app describes definitions neutrally; it does not endorse one.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list ("disclaimer for what is considered
  a country … start simple then expand"). Structured as Stage A (disclaimer) + optional Stage B
  (switchable definitions). NOT built — awaiting the clarifying round and explicit build approval.**
