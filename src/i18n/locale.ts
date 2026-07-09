// Locale primitives — the supported UI languages and their guards. Deliberately
// side-effect-free and framework-agnostic (no Svelte stores, no localStorage/DOM
// access) so the data / domain layers can validate a persisted locale without pulling
// in the reactive i18n runtime. `index.ts` re-exports these for UI consumers.

export type Locale = 'en' | 'fr' | 'de';

/** Ordered list driving the language switcher. */
export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

/** Type guard for a supported UI locale — also used to validate persisted prefs. */
export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr' || value === 'de';
}
