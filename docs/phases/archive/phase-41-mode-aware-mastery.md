# Phase 41 — Mode-aware (per-family) mastery: Map · Flags · Capitals combined

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v2.5 — Mastery depth (per-mode mastery, combined world/region number)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Make "mastery" reflect *which skills* you've actually proven, not just that you touched a country in
**one** mode. Today a country counts as mastered by the **lenient OR rule** — clearing *any one* of the
four identity modes masters it — so drilling only *locate-on-the-map* for Europe reports Europe as
"mastered" even though flag and capital recall are untested. Replace that with a **per-family, combined**
model:

- Track three **core families** — **Map**, **Flags**, **Capitals** — each covering both of its
  directions.
- A country is **fully mastered** only when **all three families** are mastered.
- The headline World/region number becomes a **blended** progress figure across the three families
  (so it still moves with any activity), backed by a **per-family breakdown** so you can see "Map 100%,
  Flags 0%, Capitals 0%".

No new data, no new quiz modes, and **no change to SR scheduling** — all the per-mode signal already
exists (SR state is keyed `mode:iso2`); this is a **computation + presentation** change only.

## The trigger (owner request — 2026-07-13)
> "In my progress page I see I've mastered Europe, but so far I've only mastered 'locate on the map'.
> Shouldn't we have mastering per game mode as well, and the global world mastery for Europe be a
> combination of map, flag and capital (both ways)?" — owner

The current code even anticipates this: `mastery.ts` comments the lenient rule as *"Numbers climb early
and stay motivating; revisit if it feels loose."* This phase is that revisit.

## Decisions (locked with the owner — 2026-07-13)
- **Model → per-family, combined** (owner picked this over "strict all-modes" and over "keep lenient +
  breakdown"). Region/World mastery is a blend of the three families; a country is *fully mastered*
  only when all three families are.
- **Core scope → Map + Flags + Capitals** (both directions each). **Languages & Industries stay
  separate** "extra knowledge" tallies exactly as today — they're encyclopedic, not universal.

## Current state (so scope is clear)
- **`computeMastery(srItems, countries, { now, modes })`** (`src/domain/mastery.ts`) — pure. Folds
  per-`mode:iso2` SR items to a per-country verdict via the **lenient OR** rule: `mastered` if *any*
  item in `modes` clears `isItemMastered` (≥ `MASTERY_MIN_REPETITIONS = 2` consecutive correct **and**
  not overdue); `learning` if seen but none mastered; `unseen` otherwise. Returns `{ overall, byRegion }`
  (`MasteryRollup` = `{mastered, learning, unseen, total}`), regions least-complete-first.
- **Mode sets** (`src/domain/modes.ts`): `MASTERY_MODES = [flag-to-country, country-to-flag,
  map-highlight, map-locate]` (the current core). `CAPITAL_MODES`, `LANGUAGE_MODES`, `INDUSTRY_MODES`
  each roll up **separately** via the `modes` option.
- **Loaders** (`src/ui/stores/persistence.ts`): `loadMastery()` (core, `MASTERY_MODES`),
  `loadCapitalMastery()` (`CAPITAL_MODES`), `loadLanguageMastery()`, `loadIndustryMastery()`; plus the
  achievements bundle (~L485) that computes all four for `evaluateAchievements`.
- **Presentation:** `Progress.svelte` renders **World mastery** (`WorldMasteryMeter` +
  `RegionMasteryBreakdown` over `mastery.byRegion`) then a separate **"extra knowledge"** section
  (`ExtraMasteryTopic` × capitals/languages/industries). `Home.svelte` shows a compact
  `WorldMasteryMeter` with an expandable `RegionMasteryBreakdown`. i18n: `progress.mastery.{title,
  learned,regionsTitle}`, `progress.capitalMastery.*`, etc. (EN/FR/DE).
- **Achievements** (`src/domain/achievements.ts`): the per-continent "mastered <continent>" badges
  (`byRegion.some(r => r.mastered === r.total)` / per-region) and **`century`** (`overall.mastered >=
  100`) key off the **core** `mastery` rollup. Capitals/languages have their **own** separate ladders.
  **Unlocks are monotonic** — `persistence.ts` L551: "unlocked achievements stay earned; a later drop
  in the underlying state simply re-unlocks" — so redefining core mastery **can't strip earned badges**.
- **Numbers will drop.** Any combined definition makes today's headline % fall for existing players
  (they've mostly played one mode). This is expected and by design; the per-family breakdown explains
  *why*, and the blended meter still rewards partial progress.

## The model (proposed — confirm OQ1/OQ2)
Three core families, each with two direction modes:

| Family | Modes (both directions) |
|---|---|
| **Map** | `map-highlight`, `map-locate` |
| **Flags** | `flag-to-country`, `country-to-flag` |
| **Capitals** | `capital-to-country`, `country-to-capital` |

Per country, per family:
- **mastered** — *both* direction items clear the existing `isItemMastered` bar *(OQ1 default: both;
  the alternative is "either direction")*.
- **learning** — seen in ≥ 1 of the family's modes but not (yet) mastered.
- **unseen** — neither mode seen.

Aggregation:
- **Blended overall / region %** = fraction of *(country × family)* cells mastered = the mean of the
  three family fractions. Europe with only Map drilled → `(100% + 0% + 0%) / 3 = 33%` (the headline
  meter — moves with any activity).
- **Per-family region %** = countries with that family mastered ÷ countries in region (the breakdown
  bars: Map 100 %, Flags 0 %, Capitals 0 %).
- **Fully-mastered country** = all three families mastered → the "learned" milestone count and the
  badge ladder key off this (OQ2).

## In scope
### 1. Domain — per-family mastery (`src/domain/mastery.ts`)
- Add `computeFamilyMastery(srItems, countries, { now, families })` returning, per region and overall:
  each family's `{mastered, learning, unseen, total}`, the **blended fraction**, and the
  **fully-mastered** count. Keep the existing `computeMastery(modes)` untouched for the extra topics
  (languages/industries) and any lenient callers we keep.
- Add a `FAMILIES` constant (Map/Flags/Capitals → their two modes) in `modes.ts`.
- Pure, deterministic (injected `now`), fully unit-tested.

### 2. Plumbing (`src/ui/stores/persistence.ts`)
- `loadMastery()` returns the new family-aware result. Capitals stops being a separate "extra" topic and
  becomes one of the three core families; `loadCapitalMastery()` is removed or repurposed. Languages &
  industries loaders unchanged.
- Achievements bundle: feed the core rollup so continent/`century` badges key off **fully-mastered**
  (OQ2). Extra-topic ladders (capitals-as-extra → now core; languages/industries) reconciled — capitals
  badges fold into the core continent/century ladder rather than a separate collector (OQ2).

### 3. Presentation (`Progress.svelte`, `Home.svelte`, components)
- **World mastery** panel: blended % meter + **"X of N fully mastered"**, plus a **per-family
  breakdown** (Map / Flags / Capitals). Per-region breakdown gains per-family detail (OQ4: three mini
  sub-bars per region **or** a Map/Flags/Capitals toggle that recolours the region list).
- **Home** compact meter: show the blended % (and "X / N fully mastered"); expandable region breakdown
  keeps working.
- **Extra knowledge** section: capitals **moves out** (now core); languages & industries remain.
- New/renamed EN/FR/DE strings (family labels, "fully mastered", blended-meter caption); parity test green.

### 4. Tests
- `mastery.test.ts`: family rollups; both-directions rule; blended = mean of family fractions;
  fully-mastered = all three; lapse demotes a family; region partition sums; least-complete ordering.
- `achievements.test.ts`: continent/`century` now track fully-mastered; **already-earned badges never
  re-lock** (monotonic).
- Component test(s) for the per-family breakdown if exercisable in jsdom; else note the headless drive.

## Out of scope (deliberately)
- **No new SR mechanics / scheduling / data.** The mastery bar (`isItemMastered`, `MIN_REPETITIONS`)
  is unchanged.
- **Languages & Industries stay separate** extra-knowledge tallies (not folded into core).
- **No new quiz modes.**
- Family-aware **"Next up"** targeting (recommend the weakest family×region) is a natural follow-up but
  **not** this phase — mention only. *(Confirm in OQ3 if a light version is wanted.)*

## Depends on
Phase 16 (mastery rollup + Progress surfaces), Phase 24 (capitals mode + capital mastery), Phase 7 (SR
state), Phase 2 (modes). Independent of the map/globe work.

## Deliverables checklist
- [x] `computeFamilyMastery` + `FAMILIES` / `MasteryFamily` (pure, unit-tested); existing
      `computeMastery(modes)` kept unchanged for the extra topics.
- [x] `loadMastery` returns the family result (Map excludes geometry-less countries via `hasGeometry`);
      capitals promoted from "extra" to a core family; achievements bundle retargets continent/century
      to **fully-mastered** via a `FamilyMasteryResult → MasteryResult` adapter; languages/industries
      loaders unchanged.
- [x] Progress: **Option A** — new `FamilyMasteryMeter` (blended % + "X of N fully mastered" +
      per-family bars) + `FamilyRegionBreakdown variant="stacked"` (three mini-bars per region);
      capitals removed from the "extra knowledge" meters (its badges still surface there).
- [x] Home: compact `FamilyMasteryMeter` (blended % + fully count + one-line family legend) +
      `FamilyRegionBreakdown variant="toggle"` (Overall/Map/Flags/Capitals lens); `hasPlayed` updated.
- [x] EN/FR/DE strings (`progress.mastery.fullyMastered` / `overall` / `regionSummary`; family labels
      reuse `modes.group.*`); i18n parity test green.
- [x] Tests green (6 `computeFamilyMastery` cases incl. Tuvalu N/A; persistence family-meter test
      rewritten to both-directions; Home route testids updated). **Suite 585 green.**
- [x] `npm run check` / `npm run lint` clean; headless-Chrome verify of Progress (Option A) + Home
      (Option B, incl. lens recolour) with zero console errors; merged to `main` + archived.

## Technical notes
- **All signal already exists.** SR items are per `mode:iso2`; `computeFamilyMastery` just folds them by
  family instead of one lenient OR. Zero migration, zero new persistence.
- **Blended vs strict headline.** The blended % (mean of family fractions) keeps the meter motivating —
  it rises the moment you clear *any* family for *any* country — while "fully mastered" gives the honest
  all-three milestone. Both are shown; they answer different questions ("how far along" vs "how many
  truly nailed").
- **Achievement safety.** Monotonic unlocks mean tightening the definition can only make *future*
  unlocks harder, never revoke a held badge — verified in `persistence.ts` (re-unlock on load).
- **Expect the meter to fall** for existing players on first load after this ships; that's the point
  (the old number was inflated). The breakdown makes the drop legible rather than alarming.

## Open Questions — resolved with the owner (2026-07-13)
- **OQ1 → both directions.** A family is mastered only when **both** its direction items clear the bar.
- **OQ2 → fully-mastered badges.** Continent + `century` + region/world badges retarget to the
  fully-mastered count (via the persistence adapter). Capitals keeps its **separate** extra-topic badge
  ladder (non-breaking; its collector/scholar badges still reward the capital sub-skill).
- **OQ3 → blended primary + fully count.** Home shows the blended % with a one-line family legend and
  "X of N fully mastered"; family-aware "Next up" **deferred** to a later phase.
- **OQ4 → A on Progress, B on Home.** Stacked mini-bars on the Progress region list; the
  Overall/Map/Flags/Capitals toggle on Home's expandable region list.

## Open Questions — original (see resolutions above)
- **OQ1 — family rule.** A family mastered when **both** directions are cleared (proposed — matches
  "both ways"; strict, 6 items for full mastery) **or** when **either** direction is (looser, faster).
  Biggest difficulty knob.
- **OQ2 — badge ladder.** Point the continent + `century` badges at the new **fully-mastered** count
  (proposed — more meaningful) or keep them on a lenient "any core family" count to stay closest to
  today? And do capitals badges fold into the core ladder or keep a separate capitals collector?
- **OQ3 — Home headline & "Next up".** Show the **blended %** as the primary Home number with a
  secondary "X / N fully mastered" (proposed)? And do we want a light **family-aware "Next up"** now, or
  defer it?
- **OQ4 — per-region breakdown UI.** Three stacked mini-bars (Map/Flags/Capitals) per region, or a
  single Map/Flags/Capitals **toggle** that recolours the existing region list? *(Prototype both for a
  glance-decision per the owner's usual preference.)*

## Acceptance criteria
- Progress + Home show a **blended** World/region mastery %, a **"X of N fully mastered"** count, and a
  **per-family breakdown** (Map / Flags / Capitals); a region drilled only in Map reads e.g. **33 %
  overall · Map 100 % · Flags 0 % · Capitals 0 %**.
- A country is counted **fully mastered** only when all three families meet the bar; capitals is a core
  family (no longer in the "extra knowledge" section); languages & industries remain separate.
- No earned achievement is revoked; continent/`century` badges track the agreed definition (OQ2).
- Fast loop green (`npm run test` / `check` / `lint`); EN/FR/DE parity holds; verified in the real app;
  zero console errors.

## Progress log
- **2026-07-13 — Post-review: "learning" visibility added.** Owner observed that after two ~95%
  Map Grand Tours (one per direction), Progress showed Europe Map at 51%, not ~100%. Diagnosed (not a
  bug): mastery = durable SR (≥ 2 correct reviews per item **and** not overdue), and Phase 41 requires
  **both directions** — so one pass only moves items to `reps: 1` = *learning*, never *mastered*.
  Proved with a throwaway repro against the real `scheduleNext` + `computeFamilyMastery` (one pass each
  → `{mastered: 0, learning: 10}`; a second review each → all mastered). The 51% was cumulative history.
  The real gap: the new meter showed only *mastered*, so a session's effect was invisible (the old
  meter had a learning band). **Fix (owner-approved):** added `inProgress` / `unseen` country buckets
  to `FamilyMasteryRollup`; the meter + region bars show a trailing **"learning" band** and an **"N in
  progress"** count. On owner feedback the band was made a **diagonal-stripe (hatched) pattern in the
  family hue** (the flat weak tint was invisible against the pale track) and a **"Mastered / Learning"
  key** was added to the Progress meter. New `progress.mastery.inProgress` / `mastered` / `learning`
  strings (EN/FR/DE). Follow-up polish: every bar segment carries a hover `title` ("{family} ·
  Mastered/Learning") so the label is on the bar itself (covers Home, which has no key), and the
  striped band is dimmed (`opacity: 0.72`) so it clearly reads below the solid mastered fill. Suite
  585 green; headless re-verify shows "2 of 195 fully mastered · 23 in progress" with clearly-visible
  striped learning bands on both Progress and Home, zero console errors.
- **2026-07-13 — Built & verified.** Owner approved with the proposed defaults (OQ1 both directions,
  OQ2 fully-mastered badges, OQ3 blended primary + defer Next-up) and picked **OQ4: A on Progress, B on
  Home** after reviewing a published prototype (both layouts on realistic data). Implemented:
  - **Domain** — `FAMILIES`/`MasteryFamily` in `modes.ts`; `computeFamilyMastery` in `mastery.ts`
    (both-directions rule, blended fraction = mastered cells / applicable cells, fully-mastered count,
    Map N/A for geometry-less countries via `hasGeometry`). Exported from `domain/index.ts`.
  - **Plumbing** — `loadMastery` now returns the family result; `masteryCountries` carries
    `hasGeometry`; `loadCapitalMastery` removed (capitals is core); achievements bundle adapts the
    family result to the legacy `MasteryResult` with `mastered = fullyMastered` so continent/`century`
    track the honest count (monotonic unlocks ⇒ no earned badge is revoked).
  - **UI** — new `FamilyMasteryMeter` (blended + fully + per-family bars; compact legend) and
    `FamilyRegionBreakdown` (`variant` stacked/toggle). Progress uses Option A; Home uses Option B +
    compact meter. Capitals dropped from the "extra knowledge" meters; its badges still render there.
    New EN/FR/DE strings; family labels reuse `modes.group.*`.
  - **Tests** — `mastery.test.ts` +6 family cases (incl. Tuvalu Map-N/A, blended math, lapse demotion,
    region ordering); `persistence.test.ts` family-meter test rewritten (one direction = learning, both
    = mastered); `Home.test.ts` testids updated. `check`/`lint` clean, **suite 585 green**.
  - **Verified** in the real app (headless Chrome, seeded SR state): Progress shows blended **3% · 2/195
    fully · Map 5% / Flags 2% / Capitals 1%** with stacked per-region mini-bars; Home shows the compact
    meter + working lens toggle (bar + number both track the selected family); **zero console errors**.
  **Merged to `main` + archived.**
- **2026-07-13 — PRD drafted** from the owner's Progress-page observation. Clarifying round run: owner
  chose the **per-family combined** model (Map/Flags/Capitals, both ways) with a **blended headline +
  per-family breakdown**, capitals promoted to core, languages/industries kept separate. Grounded in the
  current `mastery.ts` lenient-OR rule, the per-topic loaders in `persistence.ts`, the Progress/Home
  surfaces, and the monotonic achievement unlocks. OQ1–OQ4 (family rule, badge ladder, Home
  headline/Next-up, breakdown UI) remain. **NOT built — awaiting explicit build approval.**
