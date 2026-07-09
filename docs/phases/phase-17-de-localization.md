# Phase 17 — German (DE) localization

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Add **German (DE)** as a third UI language alongside EN/FR, switchable at runtime and persisted,
with full coverage: every UI string, all country names, and all region / sub-region labels render in
German. This also **generalizes the i18n layer from a hard-coded 2-locale system to an N-locale one**,
so future languages are cheap to add.

## In scope
- German for the **entire UI** (every message-catalog key), **country names**, and **region /
  sub-region names**.
- Runtime switch (extend the existing `LanguageSwitcher`) and persistence of the choice.
- Auto-detection of a German browser locale on first run.

## Current state (so scope is clear)
The app already has a working, reactive i18n layer built for exactly two locales — adding a third is
mostly *widening unions + one new catalog + one new region map*, not new infrastructure:
- **`src/i18n/index.ts`** — `type Locale = 'en' | 'fr'`; `SUPPORTED_LOCALES` (drives the switcher);
  `dictionaries: Record<Locale, Dict>`; `isLocale()` guard; `detectInitialLocale()` (special-cases
  only `fr` today); the reactive `t`, `localizedName`, and `localizedRegion` stores.
- **Country names** — `CountryName = { en: string; fr: string }` (`src/data/types.ts`), produced by
  `scripts/build-data.mjs` from `c.name.common` (en) and `c.translations.fra?.common` (fr). The source
  (`world-countries`) **already carries `translations.deu.common` for all 195 in-scope countries**
  (verified — zero missing). `localizedName` just indexes `entity.name[$locale]`, so once `de` exists
  in the data it works everywhere with no call-site changes.
- **Region names** — `src/i18n/regions.ts` holds `REGION_NAMES_FR` (keyed by the English M49 label);
  `regionName(name, locale)` returns FR or falls back to the English key. Needs a DE map + a signature
  widened to `Locale`.
- **Catalogs** — `src/i18n/messages/en.ts` and `fr.ts`; `fr` is typed `typeof en`, so any key drift is
  a **compile error**, and `src/i18n/messages.test.ts` enforces identical key sets, no empty strings,
  and matching `{placeholder}` tokens. A `de.ts` typed `typeof en` inherits both guarantees.
- **Prefs** — `Prefs.language` is a `'en' | 'fr'` union (persistence types + `DEFAULT_PREFS` +
  `clampPrefs`); the persistence bridge mirrors `locale` into it. Must widen to include `'de'`.

## Depends on
Phase 8 (i18n polish) — the infra this phase extends. Independent of the other v1.3 phases, but
**recommended early**: every later phase adds new UI strings, and doing DE infra first means those
phases just add a `de` block instead of a retroactive catch-up sweep.

## Scope / Deliverables
- [ ] **Widen the locale system** — `Locale` gains `'de'`; add it to `SUPPORTED_LOCALES` (label
      "Deutsch"); update `isLocale()`; extend `detectInitialLocale()` to return `de` for a German
      `navigator.language`. `LanguageSwitcher` already iterates `SUPPORTED_LOCALES`, so it picks up the
      third option automatically (verify layout with 3 options).
- [ ] **German country names in the dataset** — extend `CountryName` with `de`; update
      `build-data.mjs` to emit `de: c.translations.deu?.common ?? c.name.common`; rerun `data:build`
      and commit the regenerated `countries.json`. Add a build-integrity note if any `deu` is missing
      (none today).
- [ ] **German message catalog** — new `src/i18n/messages/de.ts` typed `typeof en`, registered in
      `dictionaries`. Every key translated.
- [ ] **German region / sub-region names** — add German labels for all 5 regions + all sub-regions.
      Generalize `regions.ts` from a single `REGION_NAMES_FR` to a per-locale structure (e.g.
      `Record<Locale, Record<string,string>>`) and widen `regionName(name, locale: Locale)`; keep the
      English-key fallback so a data change surfaces as an English label, not a crash.
- [ ] **Widen `Prefs.language`** to include `'de'` (persistence types, `DEFAULT_PREFS`, `clampPrefs`
      validation) so the choice persists in IndexedDB.
- [ ] **Locale-aware formatting audit** — check `src/ui/format.ts` (and any `toLocaleString`/date
      formatting) for hard-coded `'en'`/`'fr'`; route through the active locale where it changes output.
- [ ] **Tests** — extend `messages.test.ts` to assert key/placeholder parity across **all three**
      catalogs; extend `regions.test.ts` for DE coverage; a `LanguageSwitcher` test that DE renders and
      switches. `check`/`lint`/`test` green + a headless-Chrome pass switching EN↔FR↔DE at runtime and
      across a reload.

## Technical notes
- The heavy lifting is **translation quality**, not code. Once `de` exists in `Locale`, `CountryName`,
  the catalog map, and the region map, every existing call site (`$t`, `$localizedName`,
  `$localizedRegion`) works unchanged.
- Because `de` is typed `typeof en`, writing `de.ts` is a fill-in-the-blanks exercise the compiler
  guides — missing/extra keys fail `npm run check` before tests even run.
- Keep the region-map refactor backward-compatible: FR behaviour must be byte-identical after the
  restructure (the existing `regions.test.ts` should still pass unchanged apart from added DE cases).

## Open Questions — to resolve with the owner
1. **Translation source & quality bar** — does the owner supply/curate the German UI strings, or should
   they be drafted (machine-assisted) for the owner to review? Native-quality vs. "good enough"?
2. **Country names** — accept `world-countries`' `translations.deu.common` verbatim, or spot-check /
   override any awkward ones? (They're standard German short names; recommend accept + spot-check.)
3. **Region wording** — confirm the German geo terms (e.g. *Subsahara-Afrika* vs literal M49
   sub-region translations) with the owner.
4. **Auto-detect** — default to German when `navigator.language` starts with `de`? (Recommend yes.)
5. **Formatting** — any numbers/dates/times displayed that should follow German conventions, or is it
   purely textual? (Quick audit will confirm; likely minimal.)

## Acceptance criteria
- The entire UI, all country names, and all region/sub-region labels switch EN↔FR↔DE at runtime with
  no reload; the choice persists across a restart.
- `messages.test.ts` proves full key/placeholder parity across en/fr/de; `npm run check` passes
  (catalogs are structurally identical by type).
- No hard-coded user-facing strings or `'en'`/`'fr'`-only formatting remain on the German path.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- Languages beyond EN/FR/DE.
- Right-to-left support or locale-specific typography.
- Translating **game content** that has no bundled translation source (e.g. capital-city names,
  industry labels) — those are owned by their respective mode phases (22–24) and flagged there.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list. NOT built — awaiting the
  clarifying round and explicit build approval.**
