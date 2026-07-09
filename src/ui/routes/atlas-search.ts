// Pure, framework-free helpers for the Atlas reference section: country search and
// A–Z grouping. Kept out of the Svelte components so they can be unit-tested directly.
import type { Country } from '../../data';

// Combining diacritical marks (U+0300–U+036F), stripped after NFD normalization.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Fold case and diacritics so "Cote"/"Côte" and "aland"/"Åland" match alike. */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

/**
 * Whether a country matches an already-normalized query in any supported language
 * name (EN/FR/DE), so search works regardless of the current UI language. An empty
 * query matches everything.
 */
export function countryMatches(country: Country, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const { en, fr, de } = country.name;
  return [en, fr, de].some((name) => normalizeForSearch(name).includes(normalizedQuery));
}

/** Filter a list of countries by a raw query string (matched across EN/FR/DE names). */
export function searchCountries(countries: readonly Country[], query: string): Country[] {
  const q = normalizeForSearch(query);
  if (!q) return countries.slice();
  return countries.filter((c) => countryMatches(c, q));
}

/** A bucket of countries sharing an initial letter, for the A–Z browse list. */
export interface InitialGroup {
  letter: string;
  countries: Country[];
}

/**
 * Group countries by the first letter of a display name (diacritics folded, so "É…"
 * files under "E"), alphabetically by letter and by name within each letter. `nameOf`
 * supplies the localized name so the grouping tracks the current UI language.
 */
export function groupByInitial(
  countries: readonly Country[],
  nameOf: (country: Country) => string,
): InitialGroup[] {
  const buckets = new Map<string, Country[]>();
  for (const country of countries) {
    const name = nameOf(country);
    const letter = (normalizeForSearch(name).charAt(0) || '#').toUpperCase();
    let list = buckets.get(letter);
    if (!list) buckets.set(letter, (list = []));
    list.push(country);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, list]) => ({
      letter,
      countries: list.sort((x, y) => nameOf(x).localeCompare(nameOf(y))),
    }));
}
