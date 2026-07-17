# Changelog

All notable changes to Orbi are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project loosely follows
[Semantic Versioning](https://semver.org/).

Orbi was built feature-by-feature against a product spec (see [`docs/main_PRD.md`](docs/main_PRD.md));
the entries below summarize that history, newest first. **v2.1 is the first public GitHub release.**

## [2.4.0] — 2026-07-17 — _Grandmaster Challenge_

### Added

- 👑 **The Grandmaster Challenge** — a capstone "prove-it" run that unlocks only once you've
  mastered a whole **region × family** (e.g. all of Europe's flags). It's a **one-life gauntlet**:
  every country in scope, both directions, and a **single wrong answer ends the run**. A clean sweep
  **certifies** you — a gilded, permanent badge and a climbing **"Grandmaster X / 15"** prestige.
  The run plays in a locked, cinematic **arena** (a dark-teal stage with a tier ladder, drifting
  embers, a heat vignette and a beating "life") with its own **escalating soundtrack** and mascots —
  a fiery **Challenger** who invites you in and a crest that crowns you on victory. An **offer modal**
  spells out the stakes (questions, one life, a rough **~N-minute** estimate) before you commit, and
  a **Home invitation card** surfaces a challenge that's ready today. Runs are **XP-neutral** — they
  never touch your XP, history or streak — and each region × family is attemptable **once a day**
  (resets at local midnight). Leaving the arena mid-run **forfeits** the attempt.
- 🥇 **A medal for every rank** — each of the 10 Explorer ranks now has its own distinct
  struck-metal medal instead of sharing one emblem.
- 🔥 **Streak-milestone XP bonus** — reaching an in-game answer-streak milestone now grants a bonus
  on top of the per-answer XP.
- ⏱️ **Play remembers your last setup** — the Play screen now re-opens on the same mode, direction,
  format and region you last launched, instead of always resetting to the defaults.
- 🎬 **Playful page transitions** — a subtle page-in animation now plays on every route change.
- ⚙️ **App version in Settings** — Settings now shows which version of Orbi you're running.

### Changed

- ⚡ **Blitz combo pressure scales with the multiplier** — the reaction window before the combo
  drops a tier now **shortens the higher your multiplier** (tight at ×5, forgiving at ×2), and the
  reaction meter drains at that tier's pace. Fast recall matters most when the stakes are highest.
  The Blitz card also always shows the "60 s" hint, with your personal best beneath it.
- ✨ **Richer session summary** — the "+N XP" now tallies **line by line** with a gold segment for
  the session's own gain, a **rank-up badge burst** when you climb a tier, a longer hold before the
  numbers land, and a color-coded breakdown.
- 🏆 **Trophy-wall achievements** — the Progress achievements are now a compact **tile grid** rather
  than a stack of cards, so the whole collection reads at a glance.
- 🎖️ **Compact rank chip on Home** — a bigger rank badge, with the "N XP to next" line dropped for a
  cleaner header.
- 🎚️ **Wider gameplay ranges** — survival lives can now be set from **3–10** and answer choices from
  **4–8**.
- 🗺️ **Looser map-highlight framing** — "which country is highlighted?" now zooms out a little more,
  so you keep more surrounding context.

### Fixed

- 🪟 **Modals sit centered again** — the new page-in animation no longer traps fixed-position modals
  inside the content column after a route change.

## [2.3.0] — 2026-07-15 — _Momentum & progression_

### Added

- ⚡ **Blitz mode** — a new timed speed-run format you can play over any mode and region: race the
  clock for points, chain correct answers into a **combo multiplier up to ×5** (with its own rising
  sound and a draining reaction meter), and earn **bonus time** for quick answers. A slow answer
  cools the combo down a tier instead of wiping it, and each run is graded against a **local personal
  best** — the "one more run" pull. History rows show the bonus time a Blitz run earned.
- 🧭 **Explorer rank & XP** — every game now feeds one continuously-climbing **XP** number and a
  **10-tier Explorer ladder** (Novice → Legendary Explorer), derived from the play you've already
  done: correct answers, questions, sessions, streaks and badges. Your rank shows on **Home** and
  **Progress**, the session summary breaks down the **"+N XP"** you just earned with a growing XP
  bar, recent-session rows show their XP gain, and climbing a tier fires a one-time **"Rank up!"**
  celebration.

## [2.2.4] — 2026-07-14

### Changed

- 🌐 **Zoom in closer on the 3D globe** — the globe now dollies right up to the surface (about
  three times nearer than before), so a single country and its borders can fill the board — handy
  for pinning down a small nation. Zoom with the `+` control, scroll or pinch.
- 📱 **Taller phone map board** — the mobile map now sits in the same tall 3/2 frame the globe uses
  (~26% taller) with a slim gutter at the screen edges instead of bleeding edge-to-edge, so there's
  more map to read on a phone. Desktop is unchanged.

### Fixed

- 🗺️ **Taps land on the country you tapped** — in Locate-on-the-map, tapping well inside a country
  next to a micro-state (e.g. Switzerland beside Liechtenstein) no longer snaps to the tiny
  neighbour. The aim-dot magnet now only helps when you tap open water or the micro-state's own dot;
  tiny countries stay selectable via their visible dot or a pinch-zoom.
- 📊 **Visible Mastered / Learning key** — the Progress mastery breakdowns now show a small legend
  (solid = mastered, striped / lighter = learning) instead of relying on hover tooltips that never
  appear on touch devices.
- 🔊 **Quieter celebration jingles** — the finish / perfect / achievement / daily jingles are about
  40% quieter (~-5 dB) so an end-of-session cue never jars.

## [2.2.3] — 2026-07-14

### Added

- 📲 **"Add to Home Screen" prompt on phones** — first-time (and every reload until you install)
  mobile visitors get a short, device-aware popup showing exactly how to install Orbi: the Share
  → Add to Home Screen steps on iPhone/iPad, and the ⋮ menu → Install steps on Android (with a
  genuine one-tap **Install** button where the browser offers one). It shows only on phones, only
  once per visit, and never once Orbi is already installed. Fully localized (EN/FR/DE), and the
  same steps are now documented in the README.
- ▶️ **Tap-to-launch Play button on phones** — on the mobile setup screen the separate "Start"
  button is gone; the bottom-bar Play button itself grows and pulses, and pressing it plays a
  quick launch animation before dropping you straight into a game with your chosen mode, format
  and region. Desktop keeps its regular Start button.

## [2.2.2] — 2026-07-14

### Fixed

- 📌 **Bottom bar stays put on mobile** — the tab bar (and top bar) no longer detach or drift
  while scrolling on iOS. The app now scrolls its content inside a fixed shell instead of scrolling
  the whole page, so the bars are always where you expect them.
- 🗺️ **Easier taps next to tiny neighbours** — tapping a country beside a micro-state (e.g.
  Switzerland next to Liechtenstein) no longer snaps to the micro-state. The aim-dot magnet is
  tighter, so a tap lands on the country under your finger; tap the visible dot to pick the
  micro-state.

## [2.2.1] — 2026-07-14

### Fixed

- 📲 **Installed apps update themselves** — a home-screen (PWA) install now checks for a new
  release whenever you reopen or refocus it (and hourly for long sessions), then quietly swaps to
  it. No more manually force-refreshing to get the latest version. (Takes effect for releases after
  this one is installed.)

## [2.2.0] — 2026-07-13 — _Globe & mastery_

### Added

- 🌐 **Play on a 3D globe** — an optional map projection you can spin, drag and zoom, with the same
  tap-to-locate, micro-state dots and gentle auto-framing as the flat map (Settings → map
  projection).
- 📊 **Honest world mastery** — progress now tracks **Map · Flags · Capitals** combined, each
  counted **both directions**, with a blended headline, per-family bars and a least-complete-first
  per-region breakdown on Home and Progress. (Capitals is now core; languages & industries stay as
  separate "extra knowledge".)
- 🎯 **Per-region practise shortcut** — a button on each family's region bar jumps straight into
  drilling that region's not-yet-mastered countries.
- 🔥 **Escalating streak celebrations** — sticky, building streak jingles and a milestone pop,
  across nine tiers up to a streak of 50.

### Fixed

- 🗺️ Highlighted **micro-states** (Vatican, Monaco…) now show a clear aim-dot in "which country is
  highlighted?", matching the locate mode.
- Tiny countries are easier to hit (a "magnet" snaps to the nearest micro-state), survival rounds
  can be won by clearing the board, and map framing/labels anchor to a country's mainland (France
  no longer drifts out to sea).
- Only Maps, Flags and Capitals are ever proposed for review — never the extra-knowledge topics.
- The Atlas country highlight is clearly visible again.

## [2.1.0] — 2026-07-12 — _Feel & fairness_ · first public release

### Added

- 🔊 **Sound & jingles** — gentle audio cues for correct / wrong / streak, plus celebratory
  jingles for finishing, perfect runs, achievements and the daily challenge. On by default, with
  a Settings toggle, autoplay-safe, and precached for offline.
- 🗺️ **Easy country selection on large maps** — nearest-country ocean-snap with instant grading,
  plus pan/zoom controls (`+` / `−` / fit-reset) and a gentle auto-zoom to the area in question.

## [2.0.0] — _"Orbi Play" visual redesign_

### Changed

- 🎨 Bright, tactile **"Orbi Play"** look across every screen: a cool-white ground, teal accent,
  pill buttons, a responsive **bottom tab bar** on mobile and a **left sidebar rail** on desktop.

### Added

- 🧭 Category-first **Play mode picker** (Map / Flags / Capitals / Extra) and a new uncapped
  **Grand Tour** format that runs a whole region end to end.

## [1.7.0] — _Character & delight_

### Added

- 🌍 More **Orbi the mascot** everywhere, new expressive poses, and subtle, reduced-motion-aware
  animation that reacts to how you're doing.

## [1.6.0] — _Learning depth_

### Added

- 💡 **"Did you know?" explanations** on wrong answers, so a mistake teaches you something.

## [1.5.0] — _Navigation & visual depth_

### Changed

- Split the crowded History/stats page into dedicated **History** and **Progress** pages.

### Added

- More icons, flags and maps woven throughout the UI (a real locator map on country pages, etc.).

## [1.4.0] — _Identity & focused practice_

### Added

- 🎯 **Targeted practice** — build and save custom sessions from any countries and modes.
- 🔁 **Region-scoped review** — a "time to review" list per region.
- 🧭 **Selectable map projection** in Settings (Natural Earth, Equal Earth, Equirectangular, Mercator).
- ✨ The app got its name and face: **Orbi**, with a mascot favicon and per-region mastery on Home.

## [1.3.0] — _Content, languages & new modes_

### Added

- 🇩🇪 **German (DE)** localization — Orbi is now trilingual (EN / FR / DE), UI and country names.
- 🏛️ **Capitals**, 🈯 **National languages** and 🏭 **Main industries** quiz modes.
- 📖 **Atlas** — browse every region and country, no quiz required.
- 🗺️ Better small-country visibility (micro-state dots, target-first reveal) and a playful visual layer.

## [1.2.0] — _Retention & engagement_

### Added

- 🧠 Smart **"Next up"** recommendations for what to play next.
- 🔥 **Daily streak** and a fresh **Daily Challenge**.
- 🏆 **Progress & rewards** — world/region mastery, achievements and a weekly recap.

## [1.1.0] — _Enhancements_

### Changed

- Smoother input & answer flow, and a refreshed turquoise visual polish.

### Added

- ♻️ **Reset progress** in Settings.

## [1.0.0] — _Core release_

### Added

- 🗺️ **Map** and 🚩 **Flag** quiz modes over all 195 countries.
- 🌍 **Region / sub-region** filtering (UN M49 geoscheme).
- 🧠 **Spaced-repetition** training (SM-2) on the countries you get wrong.
- 📊 Play **history** and scores, persisted in **IndexedDB**.
- 🌐 Full **EN / FR** localization.
- 📴 Installable, offline-capable **PWA** with no backend.

[2.1.0]: https://github.com/mokaddem/Orbi/releases/tag/v2.1.0
