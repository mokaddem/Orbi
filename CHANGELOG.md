# Changelog

All notable changes to Orbi are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project loosely follows
[Semantic Versioning](https://semver.org/).

Orbi was built feature-by-feature against a product spec (see [`docs/main_PRD.md`](docs/main_PRD.md));
the entries below summarize that history, newest first. **v2.1 is the first public GitHub release.**

## [2.2.3] — 2026-07-14

### Added

- 📲 **"Add to Home Screen" prompt on phones** — first-time (and every reload until you install)
  mobile visitors get a short, device-aware popup showing exactly how to install Orbi: the Share
  → Add to Home Screen steps on iPhone/iPad, and the ⋮ menu → Install steps on Android (with a
  genuine one-tap **Install** button where the browser offers one). It shows only on phones, only
  once per visit, and never once Orbi is already installed. Fully localized (EN/FR/DE), and the
  same steps are now documented in the README.

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
