// Shared types for the bundled static dataset (Phase 1).
// Kept framework-agnostic so domain code and tests can import them freely.

/** A country's display name in each supported UI language. */
export interface CountryName {
  en: string;
  fr: string;
  de: string;
}

/**
 * A single in-scope country (UN member or observer state), normalized from the
 * bundled sources by `scripts/build-data.mjs`.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, uppercase (e.g. "BG"). Primary key. */
  iso2: string;
  /** ISO 3166-1 alpha-3, uppercase (e.g. "BGR"). */
  iso3: string;
  /** ISO 3166-1 numeric code (e.g. "100"). The join key into the TopoJSON. */
  numericId: string;
  name: CountryName;
  /** UN M49 region (Africa, Americas, Asia, Europe, Oceania). */
  region: string;
  /** UN M49 sub-region (e.g. "Eastern Europe"). */
  subregion: string;
  /** Path to the bundled flag SVG, relative to `src/data/generated/`. */
  flagAsset: string;
  /** Whether the bundled TopoJSON contains geometry for this country. */
  hasGeometry: boolean;
}

/** A sub-region and the countries it contains. */
export interface SubregionNode {
  subregion: string;
  countries: Country[];
}

/** A region, its sub-regions, and all countries within it. */
export interface RegionNode {
  region: string;
  subregions: SubregionNode[];
  countries: Country[];
}

/** The full `region → sub-region → countries` index. */
export type RegionTree = RegionNode[];
