// Localized display names for the M49 regions and sub-regions used by the region
// filter (Phase 5). The bundled dataset stores region / sub-region names as their
// English M49 labels, so these are keyed by that English string; the English display
// name is the key itself (English needs no map). Anything missing falls back to the
// raw key, so a data change surfaces as an untranslated (English) label rather than a
// crash.
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

    // Africa sub-regions
    'Eastern Africa': "Afrique de l'Est",
    'Middle Africa': 'Afrique centrale',
    'Northern Africa': 'Afrique du Nord',
    'Southern Africa': 'Afrique australe',
    'Western Africa': "Afrique de l'Ouest",

    // Americas sub-regions
    Caribbean: 'Caraïbes',
    'Central America': 'Amérique centrale',
    'North America': 'Amérique du Nord',
    'South America': 'Amérique du Sud',

    // Asia sub-regions
    'Central Asia': 'Asie centrale',
    'Eastern Asia': "Asie de l'Est",
    'South-Eastern Asia': 'Asie du Sud-Est',
    'Southern Asia': 'Asie du Sud',
    'Western Asia': "Asie de l'Ouest",

    // Europe sub-regions
    'Central Europe': 'Europe centrale',
    'Eastern Europe': "Europe de l'Est",
    'Northern Europe': 'Europe du Nord',
    'Southeast Europe': 'Europe du Sud-Est',
    'Southern Europe': 'Europe du Sud',
    'Western Europe': "Europe de l'Ouest",

    // Oceania sub-regions
    'Australia and New Zealand': 'Australie et Nouvelle-Zélande',
    Melanesia: 'Mélanésie',
    Micronesia: 'Micronésie',
    Polynesia: 'Polynésie',
  },
  de: {
    // Regions
    Africa: 'Afrika',
    Americas: 'Amerika',
    Asia: 'Asien',
    Europe: 'Europa',
    Oceania: 'Ozeanien',

    // Africa sub-regions
    'Eastern Africa': 'Ostafrika',
    'Middle Africa': 'Zentralafrika',
    'Northern Africa': 'Nordafrika',
    // "Southern Africa" the region, kept distinct from "Südafrika" the country.
    'Southern Africa': 'Südliches Afrika',
    'Western Africa': 'Westafrika',

    // Americas sub-regions
    Caribbean: 'Karibik',
    'Central America': 'Mittelamerika',
    'North America': 'Nordamerika',
    'South America': 'Südamerika',

    // Asia sub-regions
    'Central Asia': 'Zentralasien',
    'Eastern Asia': 'Ostasien',
    'South-Eastern Asia': 'Südostasien',
    'Southern Asia': 'Südasien',
    'Western Asia': 'Westasien',

    // Europe sub-regions
    'Central Europe': 'Mitteleuropa',
    'Eastern Europe': 'Osteuropa',
    'Northern Europe': 'Nordeuropa',
    'Southeast Europe': 'Südosteuropa',
    'Southern Europe': 'Südeuropa',
    'Western Europe': 'Westeuropa',

    // Oceania sub-regions
    'Australia and New Zealand': 'Australien und Neuseeland',
    Melanesia: 'Melanesien',
    Micronesia: 'Mikronesien',
    Polynesia: 'Polynesien',
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
