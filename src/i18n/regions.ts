// French display names for the M49 regions and sub-regions used by the region
// filter (Phase 5). The bundled dataset stores region / sub-region names as their
// English M49 labels, so these are keyed by that English string; the English
// display name is the key itself. Anything missing falls back to the raw key, so a
// data change surfaces as an untranslated (English) label rather than a crash.
//
// Kept as a plain lookup (not in the dot-notation message dicts) because the keys
// contain spaces and hyphens. Phase 8 (i18n polish) can revisit/verify these.

export const REGION_NAMES_FR: Readonly<Record<string, string>> = {
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
};

/** Localized display name for a region / sub-region English M49 label. */
export function regionName(name: string, locale: 'en' | 'fr'): string {
  return locale === 'fr' ? (REGION_NAMES_FR[name] ?? name) : name;
}
