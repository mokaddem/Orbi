# Geography Quiz — Main PRD

**Status:** Draft v1 · **Last updated:** 2026-07-09 · **Owner:** Sami

Geography Quiz is a lightweight, bilingual (EN / FR), offline-first web game for learning
world geography from multiple perspectives — **maps** and **flags** — with adaptive,
spaced-repetition training on the countries you get wrong. It is a fully client-side SPA
with **no backend**: gameplay data is bundled statically and personal progress lives in the
browser (IndexedDB). See the detailed spec in [§Description](#description) below.

---

## How to work on this project

> ## ⚠️ Never start implementing a phase without the owner's explicit approval
> Reading a phase PRD and answering its clarifying questions is **planning, not a green light to
> code.** For every phase: understand it, resolve open questions with the owner, present the plan,
> and **wait for the owner to explicitly say to proceed before writing any implementation.** When in
> doubt, ask. (Phase 12 was implemented twice without a clear go-ahead and reverted both times —
> hence this rule.)

This PRD is split into a **main PRD** (this file) and one **phase PRD** per phase (in
`phases/`). To pick up work in a new session, follow this loop:

1. **Read the [Status Table](#status-table) below.**
2. **Find the next open item** — the top-most row that is not ✅ Done (⬜ Not started or
   🟡 In progress), whose dependencies (see the phase PRD) are already ✅ Done.
3. **Open that phase's PRD** via the link in the table and read it in full: goal, scope,
   deliverables checklist, technical notes, and acceptance criteria.
4. **Resolve open questions with the owner, then get explicit approval to implement** — do not
   begin writing code until the owner says to proceed (see the callout above).
5. **Do the work** described there, checking off deliverables as you complete them.
6. **Update status** when finished (or when pausing):
   - In the phase PRD: update its **Status**/**Progress** header, tick deliverables, and
     add a dated note to its **Progress log**.
   - In this file: update the phase's **Status** and **Progress** cells in the Status Table.
7. Only mark a phase ✅ Done when its **acceptance criteria** are met.
8. **Archive the PRD once the phase is ✅ Done and merged** into the main integration branch:
   move its file from `phases/` into `phases/archive/`, fix its back-link to the main PRD
   (`../main_PRD.md` → `../../main_PRD.md`), and repoint the Status-Table link to
   `phases/archive/…`. Keeping only in-flight PRDs in `phases/` makes the next open phase obvious.

> Phases are ordered by dependency; prefer completing them in order. If a later phase is
> genuinely unblocked and more valuable, it may be started early — note the deviation in
> its Progress log.

---

## Status Table

Status legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 0 | Project scaffolding | [phase-00-scaffolding.md](phases/archive/phase-00-scaffolding.md) | — | ✅ Done | 100% |
| 1 | Data layer | [phase-01-data-layer.md](phases/archive/phase-01-data-layer.md) | 0 | ✅ Done | 100% |
| 2 | Core quiz engine | [phase-02-quiz-engine.md](phases/archive/phase-02-quiz-engine.md) | 1 | ✅ Done | 100% |
| 3 | Flag modes UI | [phase-03-flag-modes.md](phases/archive/phase-03-flag-modes.md) | 2 | ✅ Done | 100% |
| 4 | Map modes UI | [phase-04-map-modes.md](phases/archive/phase-04-map-modes.md) | 2, 3 | ✅ Done | 100% |
| 5 | Region / sub-region filter | [phase-05-region-filter.md](phases/archive/phase-05-region-filter.md) | 2, 3, 4 | ✅ Done | 100% |
| 6 | Persistence & history | [phase-06-persistence-history.md](phases/archive/phase-06-persistence-history.md) | 2, 3 | ✅ Done | 100% |
| 7 | Spaced repetition & training | [phase-07-spaced-repetition.md](phases/archive/phase-07-spaced-repetition.md) | 2, 6 | ✅ Done | 100% |
| 8 | i18n polish (EN/FR) | [phase-08-i18n.md](phases/archive/phase-08-i18n.md) | 0, 3, 4, 5, 6 | ✅ Done | 100% |
| 9 | PWA & deployment | [phase-09-pwa-deployment.md](phases/archive/phase-09-pwa-deployment.md) | 3–8 | ✅ Done | 100% |
| 10 | Polish & QA | [phase-10-polish-qa.md](phases/archive/phase-10-polish-qa.md) | all | ✅ Done | 100% |

**Core v1.0 complete (11 / 11 build phases done).** The app meets the success criteria below.

### v1.1 — Enhancements (post-launch)

Owner-requested improvements tracked as new phases. Each PRD **requires a clarifying-questions
round with the owner before implementation** (see the callout at the top of each file).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 11 | Input & answer-flow UX | [phase-11-input-answer-ux.md](phases/archive/phase-11-input-answer-ux.md) | 10 | ✅ Done | 100% |
| 12 | Visual polish, option imagery & map readability | [phase-12-visual-map-overhaul.md](phases/archive/phase-12-visual-map-overhaul.md) | 10 (11 recommended first) | ✅ Done | 100% (Stage 1 + Stage 2; Playful + turquoise built app-wide, signed off) |
| 13 | Reset progress in Settings | [phase-13-reset-progress.md](phases/archive/phase-13-reset-progress.md) | 6, 7 | ✅ Done | 100% |

### v1.2 — Retention & engagement ("keep playing")

Owner-requested mechanics that give the player reasons to return: a smart "what to play next"
recommendation, daily habit loops, and visible long-term progress. All computed from data already
persisted (SR state + history) — **no backend**. Each PRD **requires a clarifying-questions round
with the owner before implementation** (see the callout at the top of each file). Independent of
each other and buildable in any order; **14 recommended first** (it's the centerpiece the others
reinforce).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 14 | Smart "Next up" recommendations | [phase-14-next-up-recommendations.md](phases/archive/phase-14-next-up-recommendations.md) | 6, 7 | ✅ Done | 100% |
| 15 | Daily streak & Daily Challenge | [phase-15-daily-streak-challenge.md](phases/archive/phase-15-daily-streak-challenge.md) | 2, 6 | ✅ Done | 100% |
| 16 | Progress & rewards (mastery, achievements, recap) | [phase-16-progress-and-rewards.md](phases/archive/phase-16-progress-and-rewards.md) | 6, 7 (15 for streak) | ✅ Done | 100% |

### v1.3 — Content, languages & new modes

Owner-requested expansion after playing v1.2: a third UI language, a richer visual layer, a fix for
lopsided region buckets, browsable reference content, an explicit stance on country scope, and three
new quiz modes. Each PRD **requires a clarifying-questions round with the owner before implementation**
(see the callout at the top of each file) — they were drafted from a feature list to be **discussed one
at a time, right before building each**. Mostly independent; suggested build order is top-to-bottom,
with two sequencing notes: **17 (German) is recommended first** (later phases then just add a German
block), and **19 (region buckets) is foundational** — it precedes the encyclopedia (20), and 14/16
should be re-verified after. The three new modes (23–25) share an "attribute-quiz" engine
generalization — the **first one built lands it** (24/capitals is the suggested pilot).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 17 | German (DE) localization | [phase-17-de-localization.md](phases/archive/phase-17-de-localization.md) | 8 | ✅ Done | 100% |
| 18 | Playful visual layer (icons & imagery) | [phase-18-playful-visuals.md](phases/archive/phase-18-playful-visuals.md) | 12 | ✅ Done | 100% |
| 19 | Region classification & bucketing | [phase-19-region-classification.md](phases/archive/phase-19-region-classification.md) | 1 (before 20; re-verify 14, 16) | ✅ Done | 100% |
| 20 | Encyclopedia (region & country info) | [phase-20-encyclopedia.md](phases/archive/phase-20-encyclopedia.md) | 1, 12 (19 first) | ✅ Done | 100% |
| 21 | Country scope: disclaimer & definitions | [phase-21-country-scope.md](phases/archive/phase-21-country-scope.md) | 1 (20 for Stage B) | ✅ Done | 100% (Stage A; Stage B deferred) |
| 22 | Map zoom & small-country visibility | [phase-22-map-zoom-small-countries.md](phases/archive/phase-22-map-zoom-small-countries.md) | 4, 12 | ✅ Done | 100% (visible micro-state dots + ⭐ target-first reveal; interactive zoom → own future phase if needed) |
| 23 | New mode: National languages | [phase-23-mode-languages.md](phases/archive/phase-23-mode-languages.md) | 2 (shares engine w/ 24, 25) | ✅ Done | 100% (multi-select "select all"; all-or-nothing; curated EN/FR/DE names; capitals+languages folded into one combined "Extra knowledge" panel + achievements) |
| 24 | New mode: Capitals | [phase-24-mode-capitals.md](phases/archive/phase-24-mode-capitals.md) | 2 (engine-generalization pilot) | ✅ Done | 100% (both directions + shared attribute-quiz engine for 23/25; Atlas capital entry + separate capital-mastery panel & achievements) |
| 25 | New mode: Main industries | [phase-25-mode-industries.md](phases/archive/phase-25-mode-industries.md) | 2 + new curated dataset | ✅ Done | 100% (single-select "which is a main industry"; 20-category taxonomy EN/FR/DE; 142/195 curated; own mastery ladder) |

### v1.4 — Post-play feedback (from the owner's play session)

A round of owner feedback after playing a v1.3-era build. As before, each PRD **requires a
clarifying-questions round with the owner before implementation** (see the callout at the top of each
file). The items are independent and buildable in any order.

**Priority:** the owner flagged the **map-locate reveal fix** (show *where the target country is* on a
wrong answer, rather than emphasising the wrong pick) as the top quick win — it was **folded into
Phase 22** as its ⭐ target-first *Legible reveal* deliverable and can ship on its own, ahead of that
phase's zoom work. Of the phases below, **26 (review pollution)** addresses the other active in-play
pain; **27 (targeted practice)** is the biggest new capability; **28/29** are polish.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 26 | Region-scoped review ("time to review" by region) | [phase-26-region-scoped-review.md](phases/archive/phase-26-region-scoped-review.md) | 7, 14 (re-verify after 19) | ✅ Done | 100% (per-region "Time to review" list, top region pre-selected; weak-spot unified into region-scoped SR review) |
| 27 | Targeted practice (custom country & attribute session builder) | [phase-27-targeted-practice.md](phases/archive/phase-27-targeted-practice.md) | 2, 5 (grows with 23–25) | ✅ Done | 100% (dedicated #/practice screen: baseline country picker + all-8-mode picker w/ coverage note; save & name sets; normal sessions) |
| 28 | Selectable map projection (Settings) | [phase-28-map-projection.md](phases/archive/phase-28-map-projection.md) | 4, 12 (coordinate w/ 22) | ✅ Done | 100% (4 planar projections — Natural Earth, Equal Earth, Equirectangular, Mercator — via a Settings "Map" dropdown + live preview; global; no globe) |
| 29 | Identity & Home polish (app name · mascot favicon · region-mastery breakdown) | [phase-29-identity-home-polish.md](phases/archive/phase-29-identity-home-polish.md) | 9, 16, 18 | ✅ Done | 100% (named **Orbi** — mascot = brand; inked-smile globe favicon + regenerated PWA icons + turquoise theme-colour fix; Home mastery bar expands to the per-region breakdown) |

> The map-locate reveal item (show the target country, not the pick) lives in **Phase 22** — see its
> ⭐ *Legible reveal, target-first* deliverable. It is the owner's top-priority v1.4 quick win, and
> **shipped** in Phase 22's first increment (2026-07-09), alongside visible micro-state dots.

### v1.5 — Navigation & visual depth

A further round of owner feedback: give the overloaded History/stats route room to breathe by splitting
it, and spend the existing bundled visual assets (icons, flags, maps) more widely across the app. As
before, each PRD **requires a clarifying-questions round with the owner before implementation** (see the
callout at the top of each file). Independent; **30 recommended before 31** so the visual sweep covers
the final page structure (31 also best follows 29's identity work).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 30 | Split "History & stats" into two pages (History · Progress) | [phase-30-history-stats-split.md](phases/archive/phase-30-history-stats-split.md) | 6, 16, 23/24 | ✅ Done | 100% |
| 31 | Full UI visual sweep (more icons, flags & maps) | [phase-31-ui-visual-sweep.md](phases/archive/phase-31-ui-visual-sweep.md) | 12, 18 (after 29, 30) | ✅ Done | 100% (icons on History rows / Summary / WeeklyRecap / Atlas search; AtlasCountry fact glyphs + real locator map; Play reveal + attribute-prompt flags; filled heart lives; NotFound mascot) |

### v1.6 — Learning depth (explain the answer)

A round of owner feedback while approving the v1.3 industries mode: don't let a wrong answer be a dead
end — reveal a short, memorable **"why the correct answer is true"** fact (e.g. missing *Oil & gas*
for the UAE reveals its share of the country's economy). Content-heavy and cross-cutting (shared
reveal surface, trilingual facts), so tracked as its own phase. As before, the PRD **requires a
clarifying-questions round with the owner before implementation** (see the callout at the top of the
file). **Industries (25) is the motivating first target**; it extends to other modes as coverage grows.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 32 | Answer explanations ("why" fun facts) | [phase-32-answer-explanations.md](phases/archive/phase-32-answer-explanations.md) | 2, 25 (pilot; grows to 23/24 + identity modes) | ✅ Done | 100% (industries pilot: "Did you know?" on wrong answers; curated trilingual fact store — 224 pairs / 58 priority countries; Atlas tie-in & other modes deferred) |

### v1.7 — Character & delight (mascot, motion & illustration)

Owner feedback during the Phase 31 sweep: the app's graphics are still minimal — "use the mascot in more
places, add more pictures, maybe an animated mascot" and "go a step above." Deliberately split out from
the enrichment sweep (which used only existing *static* assets) into its own character-focused pass: a
few new mascot poses, subtle **reduced-motion-aware** animation, a mascot that **reacts to context**, and
small illustrative moments — all in the existing house style, building on the Orbi identity (29) and the
visual system (12 / 18). As before, the PRD **requires a clarifying-questions round with the owner before
implementation** (see the callout at the top of the file). Best sequenced **after 31 and 32** so it
decorates the final structure and reveal surface once.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 33 | Graphic richness & delight (mascot, motion & illustration) | [phase-33-graphic-richness.md](phases/archive/phase-33-graphic-richness.md) | 12, 18, 29 (16/15 for reactive beats; after 31, 32) | ✅ Done | 100% (Expressive motion foundation; 3 new poses — proud/encouraging/cheer; reactive Summary + streak/achievement beats + Home hero; perfect-score flag-fan & MascotScene empty states; in-app "Reduce animation" toggle) |

### v2.0 — "Orbi Play" visual redesign (mobile & desktop)

Owner-driven redesign: after a UI-design exploration that pitched three full directions across every
screen (**A · Orbi Play**, **B · Cartographer**, **C · Explorer HUD**), the owner chose **A · Orbi Play**
— a bright, tactile game-app look — and asked to implement it **app-wide for both mobile and desktop**
(directions B & C retired). It keeps **Orbi** and the **teal** accent but moves off the warm-cream Phase-12
theme onto a cool-white ground, and replaces the wrapping top nav with a **responsive** bottom-tab-bar (+
raised Play) on mobile and a **left sidebar rail** on desktop. **Presentation only — no new features,
data, or domain logic.** As before, the PRD **requires a clarifying-questions round with the owner before
implementation** (see the callout at the top of the file).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 34 | "Orbi Play" visual redesign (mobile & desktop) | [phase-34-orbi-play-redesign.md](phases/archive/phase-34-orbi-play-redesign.md) | 12, 18, 29, 30, 33 | ✅ Done | 100% (recoloured token set, responsive rail/bottom-bar shell, pill CTAs, per-route desktop layouts; merged to main + archived) |
| 35 | Play mode-picker redesign + "Grand Tour" format | [phase-35-play-modes-grand-tour.md](phases/archive/phase-35-play-modes-grand-tour.md) | 5, 23–25, 34 | ✅ Done | 100% (category-first mode picker — Map/Flags/Capitals/Extra families → direction tray; new uncapped `full` "Grand Tour" session over the whole selected region/sub-region; map-locate wrong-pick label + dot hover; violet token + EN/FR/DE; merged to main + archived) |

### v2.1 — Feel & fairness (sound + map selection)

Two owner-requested improvements to how the app *feels* to play: give the playful interface a **voice**
(short sound effects & jingles at the existing feedback moments), and fix the long-standing pain that
selecting the right country on a **large continent / the whole world** is very hard. Both are
presentation/interaction work — no new data or domain modes. As before, each PRD **requires a
clarifying-questions round with the owner before implementation** (see the callout at the top of each
file). Independent of each other; buildable in any order. Phase 37 is the **future phase** Phase 22
deferred its interactive-zoom work to.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 36 | Sound effects & jingles | [phase-36-sound-effects.md](phases/archive/phase-36-sound-effects.md) | 2, 9, 16, 33 | ✅ Done | 100% (hybrid: gentle Web-Audio synth `correct`/`wrong`/`streak` + 4 self-made marimba `.ogg` jingles `finish`/`perfect`/`achievement`/`daily`; `Prefs.sound` on-by-default + Settings "Sound" toggle EN/FR/DE; autoplay-safe unlock; precached offline; verified dev+prod+offline. Merged to main + archived) |
| 37 | Easy, confident country selection on large maps | [phase-37-large-map-selection.md](phases/archive/phase-37-large-map-selection.md) | 4, 12, 22, 28 | ✅ Done | 100% (nearest-country ocean-snap within a capped radius, **instant** grading; `d3-zoom` pan/zoom with + / − / fit-reset controls; `map-highlight` gentle auto-zoom; reduce-motion instant path; crisp non-scaling strokes; `d3-zoom`+`d3-selection` in the lazy MapBoard chunk. Tests 524 green; verified headless at World+Africa, naturalEarth+Mercator, phone+desktop. Merged to main + archived) |

### v2.2 — Dimensional maps (play on a 3D globe)

Owner-requested new map surface: a real, interactive **3D globe** to play on, with the same
functionality as the flat map but smooth to spin/zoom/fly-between-regions and visibly playful. It is the
orthographic "globe" Phase 28 deferred, now built as a proper **WebGL (three.js)** planet rather than a
static projection, and offered as a **5th entry in the existing map-projection dropdown**. As before, the
PRD **requires a clarifying-questions round with the owner before implementation** (see the callout at
the top of the file).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 38 | Play on a 3D globe (WebGL projection) | [phase-38-globe-projection.md](phases/archive/phase-38-globe-projection.md) | 4, 12, 22, 28, 37 | ✅ Done | 100% (lazy/precached three.js `GlobeMap`, both modes, snap picking, auto-rotate, zoom, WebGL→flat fallback; Stage 3 landed all 7 owner-review fixes — robust region framing, no glow ring, earcut hover-pop, antimeridian-split pole fix, crisp GPU vector borders, visible micro-dots, tip-anchored label callouts + pin. Merged to main + archived) |

### v2.3 — Streak celebration

Owner feedback while enjoying the Phase 36 sound: a growing streak should *feel* like it's building.
Make the milestone jingle **sticky and escalating** (once a milestone is reached, keep playing that —
grander — jingle instead of falling back to the plain `correct` cue), with **one** added visual: a
small pop on the streak indicator at each milestone. Fully synthesized — **no new audio files or
dependencies**. As before, the PRD **requires a clarifying-questions round with the owner before
implementation** (see the callout at the top of the file).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 39 | Escalating streak jingles & milestone pop | [phase-39-streak-escalation.md](phases/archive/phase-39-streak-escalation.md) | 36, 33, 2 | ✅ Done | 100% (sticky per-milestone `streak` tiers escalating via layers **+ per-tier transposition**; milestone-only indicator pop; no new deps/audio. Extended post-ship to **9 milestones up to streak 50** (3/4/6/8/12/13/15/17/18 voices). Suite 571 green; headless drive to streak 50 confirms escalation, no `correct` fallback, milestone-only pops, zero errors. Merged to main + archived) |

### v2.4 — Post-play fixes (mobile map, survival, map anchoring)

A round of owner feedback after playing on mobile: four small play-feel fixes bundled into one phase —
a **magnetic** micro-state tap so tiny countries are selectable on a phone, a **"region cleared" win**
so survival ends once a region is mastered, the `map-highlight` **ring only for micro-states** (noise
on big countries), and porting the globe's **mainland (largest-polygon) anchor** to the flat map so
France frames on the mainland, not its centre of mass. Presentation / interaction only — no new data
or modes (the survival end condition is a pure `shouldFinish` addition). As before, the PRD
**requires a clarifying-questions round with the owner before implementation** (see the callout at the
top of the file); the survival model and the phase-PRD framing were **already resolved with the owner
(2026-07-13)**.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 40 | Play-feel fixes (mobile tap-snap · survival clear-win · highlight ring · mainland anchor) | [phase-40-play-feel-fixes.md](phases/archive/phase-40-play-feel-fixes.md) | 4, 22, 37, 38, 2 | ✅ Done | 100% (all four built: `resolvePick` micro-dot magnet `DOT_SNAP_CAP=30`; survival "region cleared" win — distinct-correct Set + `cleared` summary flag + HUD "Mastered X/N" + Summary badge; highlight ring micro-only; flat-map mainland anchor via shared `largestPolygon`. Suite 579 green; headless-CDP drive confirmed near-miss→Vatican, survival "Region cleared!" 3/3, France on the mainland, no large-highlight ring, zero console errors. Merged to main + archived) |

### v2.5 — Mastery depth (per-mode mastery, combined world/region number)

Owner noticed the Progress page reports a region "mastered" after only one game mode (the Phase-16
**lenient OR** rule — any one of the four identity modes masters a country). Redefine mastery to be
**per-family** — **Map**, **Flags**, **Capitals** (both directions each) — with a country **fully
mastered** only when all three families are, and a **blended** World/region % backed by a per-family
breakdown. No new data, no new modes, no SR-scheduling change — all per-mode signal already exists
(`mode:iso2` SR items); this is a computation + presentation change. Owner picked the per-family
combined model with core = Map + Flags + Capitals (languages/industries stay separate "extra
knowledge"). As before, the PRD **requires the clarifying round + explicit build approval** first.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 41 | Mode-aware (per-family) mastery — Map · Flags · Capitals combined | [phase-41-mode-aware-mastery.md](phases/archive/phase-41-mode-aware-mastery.md) | 16, 24, 7, 2 | ✅ Done | 100% (per-family combined mastery: `computeFamilyMastery` + `FAMILIES` — both-directions rule, blended % + fully-mastered + in-progress counts, Map N/A for geometry-less TV; capitals promoted to core; continent/`century` badges retargeted to fully-mastered (monotonic, non-regressing). New `FamilyMasteryMeter` + `FamilyRegionBreakdown` with striped "learning" bands + state key — **Option A stacked** on Progress, **Option B toggle** on Home (owner picks, prototype-driven). Suite 585 green; headless verify of both pages, zero console errors. Merged to main + archived) |

### v2.6 — Momentum & progression (Blitz + Explorer rank)

Owner-picked from an engagement brainstorm (2026-07-14): two complementary levers on top of the
existing depth — a time-pressure **Blitz** session format with a local personal best (the "one more
run" pull), and an **Explorer rank / XP** spine that turns already-tracked play into one
continuously-climbing number with named tiers (the retention line *between* the milestone badges).
Both are **no-backend**: Blitz is a new session *format* over the existing eight modes (like Grand
Tour, Phase 35), and XP is *derived from already-persisted history + mastery* (like the mastery meter
and weekly recap, Phase 16). As before, each PRD **requires a clarifying-questions round with the
owner before implementation** (see the callout at the top of each file). Independent of each other and
buildable in any order; **42 (Blitz) recommended first** so the XP model can score blitz runs from day
one.

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 42 | Blitz mode (timed speed run + personal best) | [phase-42-blitz-mode.md](phases/archive/phase-42-blitz-mode.md) | 2, 35, 6 (36 for cues) | ✅ Done | 100% |
| 43 | Explorer rank & XP (progression spine) | [phase-43-explorer-rank-xp.md](phases/phase-43-explorer-rank-xp.md) | 6, 16, 41 (30 for placement) | ✅ Done | 100% (append-only XP — 10·correct + 3·questions + 25·sessions + 20·streak + 150·badges — into a 10-tier escalating Explorer ladder Novice→Legendary Explorer; `RankPanel` on Progress + `RankChip` on Home + "+N XP" on Summary; one-time "Rank up!" jingle+burst; `progression` store DB v5; trilingual `rank.*`. **Awaiting merge.**) |

### v2.7 — Mastery capstone

Owner idea (2026-07-14): a **gated "prove-it" challenge** that unlocks only once a **family × region**
is already mastered (Phase 41), and that tests it end-to-end in a way a normal 4-choice round can't —
you must identify **every** country in the region, one at a time, with the answer options being the
**whole region** (no 4-choice crutch), clearing the board as you go. It fills a real gap: today mastery
is built (SR), measured (Phase 41 %), and rewarded with monotonic badges, but never tested under a
prove-it constraint. A *format* over the existing modes (like Grand Tour, Phase 35) — **no new game
mode**, no backend. As before, the PRD **requires a clarifying-questions round with the owner before
implementation** (see the callout at the top of the file).

| # | Phase | Detailed PRD | Depends on | Status | Progress |
|---|---|---|---|---|---|
| 44 | Mastery Challenge (capstone / "prove-it" run) | [phase-44-mastery-challenge.md](phases/phase-44-mastery-challenge.md) | 41, 16, 2, 35, 5 | ⬜ Not started | 0% |

Remaining v1.0 follow-up: a manual physical multi-device sanity check before public release
(see Phase 10 progress log).

---

## Description

### Product pillars
1. **Learn from multiple perspectives** — the same knowledge (a country's identity, shape,
   location, and flag) is exercised through several complementary game modes.
2. **Adaptive by default** — the app notices what you get wrong and helps you fix it, rather
   than testing you at random forever.
3. **Lean and self-contained** — minimal dependencies, no server to run, works offline, easy
   to host anywhere as static files.

### Goals
- Teach and test country recognition via **map** and **flag** game modes.
- Let the player **filter by region and sub-region** (UN M49 geoscheme).
- **Track mistakes per item** and surface a **"train my mistakes"** mode powered by spaced
  repetition (SM-2).
- **Record play history**: sessions, scores, and completion time, so progress is visible.
- Full **EN / FR** support (UI strings and country names), switchable at runtime.
- Ship as an **offline-capable static PWA** with **no backend**.

### Non-Goals (for now)
- No multi-user accounts, login, or cross-device sync (single user, single browser).
- No online leaderboards or social features.
- No capital cities, population, or other trivia modes in the MVP (possible later).
- No dependent territories / disputed regions in the MVP (UN members + observers only).
- Full accessibility (a11y) and light/dark theming are **deferred** (see [Future](#deferred--future-enhancements)).

### Target user
A single, self-motivated learner (initially the owner) who wants to steadily improve their
world geography. Technically comfortable, plays on desktop and mobile browsers, sometimes
offline, in EN or FR interchangeably.

---

## Tech Stack & Architecture

| Concern | Decision | Rationale |
|---|---|---|
| App type | SPA, fully client-side | No backend required; simplest to host and run offline. |
| Framework | **Svelte + Vite** | Minimal boilerplate, small bundle, fast — fits "keep requirements low". |
| Language | **TypeScript** | Type safety over a rich data model (countries, regions, SR state, history). |
| Map rendering | **TopoJSON + D3-geo** (SVG) | Full control over highlighting, click hit-detection, region filtering; free offline geometry. |
| Flags | **Bundled SVG flag images** | Consistent rendering everywhere incl. Linux (emoji flags unreliable); crisp and scalable. |
| Country/region data | **Bundled static dataset** | Offline, no runtime API dependency or rate limits. |
| Local persistence | **IndexedDB** (thin wrapper) | Stores history + SR state; larger and more structured than localStorage. |
| Offline / install | **PWA** (service worker + manifest) | Installable, works with no connection. |
| Testing | **Vitest** (core logic only) | Cover the tricky parts: question generator, SR scheduler, scoring. |
| Tooling | **ESLint + Prettier** | Consistency. |
| Hosting | Static files (GitHub Pages / Netlify / local) | No server; deploy anywhere. |

### High-level architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Svelte SPA (browser)                   │
│                                                           │
│  UI layer (routes/components)                             │
│   ├─ Home / mode select / region filter                   │
│   ├─ Flag modes    ├─ Map modes (D3)    ├─ Training       │
│   └─ History / stats                                      │
│                                                           │
│  Domain layer (TS, pure & testable)                       │
│   ├─ Question generator     ├─ Scoring / session engine   │
│   ├─ SR scheduler (SM-2)    └─ Stats aggregation          │
│                                                           │
│  Data layer                                               │
│   ├─ Static dataset (JSON: countries, regions)            │
│   ├─ Assets (SVG flags, TopoJSON geometry)                │
│   └─ Persistence (IndexedDB: history, SR state, prefs)    │
└─────────────────────────────────────────────────────────┘
```

### Candidate open-source data sources (bundled at build time)
- **Country names (EN/FR) + ISO codes:** `i18n-iso-countries`.
- **Regions / sub-regions:** UN M49 geoscheme (region → sub-region → country).
- **Flags:** `flag-icons` (MIT) SVGs, keyed by ISO 3166-1 alpha-2.
- **Map geometry:** `world-atlas` TopoJSON (Natural Earth), joined by ISO code.

A build/prep step assembles these into a single normalized dataset keyed by ISO code.

---

## Data Model (draft — shared reference for all phases)

```ts
// Static (bundled)
interface Country {
  iso2: string;            // "BG"
  iso3: string;            // "BGR"
  name: { en: string; fr: string };
  region: string;          // M49 region, e.g. "Europe"
  subregion: string;       // e.g. "Eastern Europe"
  flagAsset: string;       // path to bundled SVG
  // map geometry joined from TopoJSON by iso code
}

type GameMode =
  | 'flag-to-country'      // see flag → pick country name
  | 'country-to-flag'      // see country name → pick flag
  | 'map-highlight'        // country highlighted → pick name
  | 'map-locate';          // given name → click it on the map

type SessionType = 'fixed' | 'survival' | 'training';

// Persisted (IndexedDB)
interface SessionRecord {
  id: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  mode: GameMode;
  type: SessionType;
  regionFilter?: { region?: string; subregion?: string };
  total: number;
  correct: number;
  questions: QuestionResult[];
}

interface QuestionResult {
  itemKey: string;         // `${mode}:${iso2}`
  countryIso2: string;
  correct: boolean;
  answerMs: number;
}

// Spaced repetition state per item (SM-2)
interface SRItem {
  itemKey: string;         // `${mode}:${iso2}`
  repetitions: number;
  easeFactor: number;      // starts 2.5
  intervalDays: number;
  dueAt: number;           // timestamp
  lapses: number;          // times missed
  lastReviewedAt?: number;
}

interface Prefs {
  language: 'en' | 'fr';
  survivalLives: number;      // default 3
  fixedLength: number;        // default 10
  choicesPerQuestion: number; // default 4
}
```

---

## Testing & Verification Strategy

Testing runs at **two cadences** — a fast loop on every change, and heavier browser-driven
checks only when they add signal (typically at phase boundaries):

**Fast loop — on every code change:**
- **Unit tests (Vitest)** are the primary safety net for the pure domain logic — question
  generator, distractor selection, SM-2 scheduler, scoring, and the session state machine.
  They need no browser and are fast.
- **Component tests (Vitest + `@testing-library/svelte`, jsdom)** cover tricky UI behaviour
  (feedback states, option locking) where a unit test isn't enough.
- **Manual browser check** against the running dev server for any change with visible runtime
  behaviour, to confirm it actually does what's intended.

**Heavy checks — only when warranted, not per change:**
- **End-to-end smoke tests (Playwright)** cover the critical flows — play a fixed and a
  survival session, answer on the map, and confirm history/SR state survive a reload. Run
  them **at the end of a phase, before marking it ✅ Done**, and when a change touches a
  cross-cutting flow (session lifecycle, map hit-detection, persistence). They are **not**
  part of the per-change loop.

**Long-running servers, pinned to fixed ports.** To avoid the churn of starting and stopping
servers per test run, the dev and preview servers are launched **once as background processes
on fixed ports and kept running for the whole session**, then reused:

- Vite **dev** server → fixed port **5180** (`vite --port 5180 --strictPort`).
- Vite **preview** (production build, for PWA / offline checks) → fixed port **5181**.
- Playwright is configured with `webServer.url` pointing at port 5180 and
  **`reuseExistingServer: true`**, so `playwright test` attaches to the already-running dev
  server instead of spawning and killing its own each run.

`--strictPort` makes a port clash fail loudly instead of silently drifting to another port.
Before using the app, a run checks the pinned port is up and only starts the server if it
isn't — so the server is opened at most once and left running.

---

## Success Criteria
- All four game modes playable with region filtering.
- Missed items measurably resurface via training (verified by SR unit tests + manual play).
- History and timing recorded and viewable across sessions and browser restarts.
- Installable PWA that launches and plays offline.
- Core logic (generator, SM-2 scheduler, scoring) covered by passing Vitest tests.

---

## Deferred / Future Enhancements
- Accessibility (keyboard nav, ARIA on map/buttons, contrast, focus states).
- Light / dark theme respecting system preference.
- Timed and endless session formats.
- Additional modes (capitals, country shapes/outlines, borders/neighbors).
- Dependent territories & configurable scope toggle.
- Cross-device sync (would introduce a lightweight backend + DB).
- Export/import of progress (JSON) as a manual backup, given no server sync.

---

## Open Questions (agreed defaults in parentheses)
- Multiple-choice options per question (**4**).
- Survival lives (**3**).
- Fixed quiz length (**10**).
- Hosting target for the static build — **resolved (Phase 9): GitHub Pages** project site at
  `/geography-quiz/`, deployed by `.github/workflows/deploy.yml`. To host elsewhere (Netlify,
  a subdirectory, or the domain root), change `base` in `vite.config.ts` accordingly.
