# Changelog

All notable changes to Orbi are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project loosely follows
[Semantic Versioning](https://semver.org/).

Orbi was built feature-by-feature against a product spec (see [`docs/main_PRD.md`](docs/main_PRD.md));
the entries below summarize that history, newest first. **v2.1 is the first public GitHub release.**

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

[2.1.0]: https://github.com/mokaddem/geography-quiz/releases/tag/v2.1.0
