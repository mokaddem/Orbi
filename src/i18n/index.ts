import { derived, writable } from 'svelte/store';
import { translate, type Dict, type TranslateVars } from './translate';
import type { CountryName } from '../data/types';
import { regionName } from './regions';
import { isLocale, SUPPORTED_LOCALES, type Locale } from './locale';
import en from './messages/en';
import fr from './messages/fr';
import de from './messages/de';

// Re-exported from the side-effect-free primitives module so existing UI imports of
// `Locale` / `SUPPORTED_LOCALES` / `isLocale` from `../i18n` keep working unchanged.
export { isLocale, SUPPORTED_LOCALES, type Locale };

const dictionaries: Record<Locale, Dict> = {
  en: en as Dict,
  fr: fr as Dict,
  de: de as Dict,
};

const STORAGE_KEY = 'geo-quiz:locale';

/**
 * Read the saved locale, tolerating a `localStorage` that is absent *or* throws on
 * access — private-browsing and storage-blocked browsers expose the global but raise
 * a SecurityError when it's touched. Any failure just means "no saved locale".
 */
function readStoredLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Persist the locale, silently tolerating a blocked/full `localStorage`. */
function persistLocale(value: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage disabled or full — language just won't survive a reload.
  }
}

function detectInitialLocale(): Locale {
  const saved = readStoredLocale();
  if (saved) return saved;
  const lang = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() : undefined;
  if (lang?.startsWith('fr')) return 'fr';
  if (lang?.startsWith('de')) return 'de';
  return 'en';
}

/** Active UI language. Persisted to localStorage and reflected on <html lang>. */
export const locale = writable<Locale>(detectInitialLocale());

locale.subscribe((value) => {
  persistLocale(value);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value;
  }
});

export function setLocale(next: Locale): void {
  locale.set(next);
}

/**
 * Reactive translator. Usage in a component: `{$t('home.title')}`.
 * Re-evaluates automatically whenever `locale` changes.
 */
export const t = derived(
  locale,
  ($locale) =>
    (key: string, vars?: TranslateVars): string =>
      translate(dictionaries[$locale], key, vars),
);

/**
 * Reactive localized-name accessor for dataset entities that carry an EN/FR name
 * (e.g. `Country`). Usage: `{$localizedName(country)}`. Re-evaluates on locale change.
 */
export const localizedName = derived(
  locale,
  ($locale) =>
    (entity: { name: CountryName }): string =>
      entity.name[$locale],
);

/**
 * Reactive accessor for any localized `CountryName` value that isn't an entity's `name`
 * — e.g. a capital city or an attribute option's label (Phase 24). Usage:
 * `{$localizedText(country.capital)}`. Re-evaluates on locale change.
 */
export const localizedText = derived(
  locale,
  ($locale) =>
    (text: CountryName): string =>
      text[$locale],
);

/**
 * Reactive localized name for an M49 region / sub-region (stored in the dataset as
 * an English label). Usage: `{$localizedRegion(country.region)}`. Falls back to the
 * raw English label when no translation exists. Re-evaluates on locale change.
 */
export const localizedRegion = derived(
  locale,
  ($locale) =>
    (name: string): string =>
      regionName(name, $locale),
);
