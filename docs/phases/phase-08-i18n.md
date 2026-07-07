# Phase 8 — i18n polish (EN/FR)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Complete full English/French coverage across the whole UI and confirm country names follow
the selected language, with a runtime language switch and a persisted preference.

## Depends on
Phase 0 (i18n infra) and, ideally, most UI phases (3, 4, 5, 6) so all strings exist to translate.

## Scope / Deliverables
- [x] **Complete EN and FR message catalogs** for every UI string added across all screens.
- [x] Ensure **country names** render in the active language (data is already bilingual from
      Phase 1) everywhere they appear (options, prompts, summaries, stats).
- [x] **Language switcher** UI; persist the choice via the `Prefs` store (Phase 6).
- [x] **Audit** that no hardcoded strings remain (lint rule or manual sweep).

## Technical notes
- If earlier phases routed all text through the i18n layer as required, this phase is mostly
  filling catalogs and auditing rather than refactoring.
- Also localize number/time formatting if any is displayed.

## Acceptance criteria
- The entire UI **and** country names switch between EN and FR at runtime with no reload.
- The language preference persists across restarts.
- No hardcoded user-facing strings remain.

## Out of scope
- Additional languages beyond EN/FR.

## Progress log
- **2026-07-07** — Completed the phase. Most of the i18n infra was already in place from
  earlier phases (reactive `t` / `localizedName` / `localizedRegion` stores, per-locale
  catalogs, `LanguageSwitcher`, and the persistence bridge that mirrors `locale` into the
  `Prefs` store in IndexedDB with a localStorage fast-cache). Remaining work this phase:
  - **Audit sweep** for hardcoded user-facing strings. Found and localized three literal
    `aria-label`s: the language-switcher group (now `settings.language`), the primary
    `<nav>` (new `nav.primary`), and the world-map SVG (new `play.map.label`). The
    per-country `aria-label={iso2}` on map paths are data-derived technical identifiers,
    not display copy, so left as-is (full a11y is deferred per the main PRD).
  - **Localized the browser tab title** — `document.title` now tracks `$t('app.title')`
    reactively in `App.svelte`, so the tab switches EN/FR with the language toggle.
  - **Added catalog-parity tests** (`src/i18n/messages.test.ts`): EN/FR have identical key
    sets, no empty strings, and matching `{placeholder}` tokens per key. Also added a
    `LanguageSwitcher` component test (renders both locales, switches on click, localized
    group label). Note: `fr` is typed `typeof en`, so key drift is already a compile error.
  - **Verification:** `npm run test` (196 passing), `npm run check` (0 errors),
    `npm run lint` (clean). Browser-driven check against the live 5180 dev server (headless
    Chromium over CDP): 17/17 — the whole UI + tab title switch EN↔FR at runtime with no
    reload, and the choice persists across a reload.
  - No Playwright harness exists in the repo yet (the main PRD describes it but it was never
    scaffolded); standing up that E2E suite is deferred to Phase 9/10 rather than scoped
    into this polish phase.
