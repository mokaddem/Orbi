import { derived, writable } from 'svelte/store';
import { translate, type Dict, type TranslateVars } from './translate';
import type { CountryName } from '../data/types';
import { regionName } from './regions';
import en from './messages/en';
import fr from './messages/fr';

export type Locale = 'en' | 'fr';

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const dictionaries: Record<Locale, Dict> = {
  en: en as Dict,
  fr: fr as Dict,
};

const STORAGE_KEY = 'geo-quiz:locale';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr';
}

function detectInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) {
    return 'fr';
  }
  return 'en';
}

/** Active UI language. Persisted to localStorage and reflected on <html lang>. */
export const locale = writable<Locale>(detectInitialLocale());

locale.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
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
