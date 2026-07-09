// Localized display names for the five M49 regions and the regrouped "play-region"
// sub-regions used by the region filter (Phase 5; buckets rebalanced in Phase 19). The
// bundled dataset stores region / sub-region names as their English labels, so these are
// keyed by that English string; the English display name is the key itself (English needs
// no map). Anything missing falls back to the raw key, so a data change surfaces as an
// untranslated (English) label rather than a crash. Oceania has no sub-buckets, so its
// single "Oceania" bucket resolves through the region entry of the same name.
//
// Kept as a plain lookup (not in the dot-notation message dicts) because the keys
// contain spaces and hyphens. Phase 17 generalized this from a single French map to a
// per-locale structure so a new language is just one more block.

import type { Locale } from './locale';

/** Non-English locales that carry a translated region map (English is the key itself). */
type TranslatedLocale = Exclude<Locale, 'en'>;

const REGION_NAMES: Readonly<Record<TranslatedLocale, Readonly<Record<string, string>>>> = {
  fr: {
    // Regions
    Africa: 'Afrique',
    Americas: 'Amériques',
    Asia: 'Asie',
    Europe: 'Europe',
    Oceania: 'Océanie',

    // Africa sub-regions (Phase 19 play-regions)
    'Northern & Central Africa': 'Afrique du Nord et centrale',
    'Eastern & Southern Africa': "Afrique de l'Est et australe",
    'Western Africa': "Afrique de l'Ouest",

    // Americas sub-regions
    'North & Central America': 'Amérique du Nord et centrale',
    Caribbean: 'Caraïbes',
    'South America': 'Amérique du Sud',

    // Asia sub-regions
    'Central & Eastern Asia': "Asie centrale et de l'Est",
    'South-Eastern Asia': 'Asie du Sud-Est',
    'Southern Asia': 'Asie du Sud',
    'Western Asia': "Asie de l'Ouest",

    // Europe sub-regions (classic UN M49 four)
    'Eastern Europe': "Europe de l'Est",
    'Northern Europe': 'Europe du Nord',
    'Southern Europe': 'Europe du Sud',
    'Western Europe': "Europe de l'Ouest",

    // Oceania has no sub-buckets — the single "Oceania" bucket reuses the region label above.
  },
  de: {
    // Regions
    Africa: 'Afrika',
    Americas: 'Amerika',
    Asia: 'Asien',
    Europe: 'Europa',
    Oceania: 'Ozeanien',

    // Africa sub-regions (Phase 19 play-regions)
    'Northern & Central Africa': 'Nord- und Zentralafrika',
    // "südliches" stays lowercase (adjective) to read distinct from "Südafrika", the country.
    'Eastern & Southern Africa': 'Ost- und südliches Afrika',
    'Western Africa': 'Westafrika',

    // Americas sub-regions
    'North & Central America': 'Nord- und Mittelamerika',
    Caribbean: 'Karibik',
    'South America': 'Südamerika',

    // Asia sub-regions
    'Central & Eastern Asia': 'Zentral- und Ostasien',
    'South-Eastern Asia': 'Südostasien',
    'Southern Asia': 'Südasien',
    'Western Asia': 'Westasien',

    // Europe sub-regions (classic UN M49 four)
    'Eastern Europe': 'Osteuropa',
    'Northern Europe': 'Nordeuropa',
    'Southern Europe': 'Südeuropa',
    'Western Europe': 'Westeuropa',

    // Oceania has no sub-buckets — the single "Oceania" bucket reuses the region label above.
  },
};

/** French region/sub-region names, keyed by English M49 label. Kept as a named export
 *  for the existing region-coverage test; the German map lives in {@link REGION_NAMES}. */
export const REGION_NAMES_FR = REGION_NAMES.fr;

/** All non-English region maps, keyed by locale. Iterated by the coverage test. */
export const REGION_NAMES_BY_LOCALE = REGION_NAMES;

/** Localized display name for a region / sub-region English M49 label. */
export function regionName(name: string, locale: Locale): string {
  if (locale === 'en') return name;
  return REGION_NAMES[locale][name] ?? name;
}
