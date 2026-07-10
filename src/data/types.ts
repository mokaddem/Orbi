// Shared types for the bundled static dataset (Phase 1).
// Kept framework-agnostic so domain code and tests can import them freely.

/** A country's display name in each supported UI language. */
export interface CountryName {
  en: string;
  fr: string;
  de: string;
}

/**
 * One language associated with a country (Phase 23, national-languages mode). The source
 * (`world-countries`) conflates official / national / widely-spoken to varying degrees, so
 * this is treated as "a language spoken in / associated with the country", not a legal claim.
 */
export interface LanguageRef {
  /** ISO 639-3 code, lowercase (e.g. "nld"). Stable option id in the languages quiz. */
  code: string;
  /** The language name, localized. English from the source; FR/DE from the curated override. */
  name: CountryName;
}

/**
 * One main industry associated with a country (Phase 25, industries mode). Sourced from the
 * hand-authored `industries.mjs` taxonomy — "main" means *reputation* (what the country is
 * broadly known for economically), not a GDP/employment/export ranking.
 */
export interface IndustryRef {
  /** Stable taxonomy key, kebab-case (e.g. "oil-gas"). The option id in the industries quiz. */
  key: string;
  /** The industry name, localized (from the curated taxonomy). */
  name: CountryName;
  /**
   * Optional "why" fun fact (Phase 32) — a short, localized sentence explaining why this is a
   * main industry of the country, shown on a wrong industries answer. Curated and bundled
   * (`industry-facts.mjs`); present only for the covered (country, industry) pairs, absent
   * otherwise (the reveal simply omits the blurb).
   */
  fact?: CountryName;
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
  /**
   * Capital city, localized. Canonical only — for the one in-scope multi-capital country
   * (South Africa) the first listed is used (Pretoria). Sourced English from
   * `world-countries`; FR/DE come from the curated `capitals-i18n` override map,
   * defaulting to English where no exonym differs. Added in Phase 24 (capitals modes).
   */
  capital: CountryName;
  /**
   * Languages spoken in / associated with the country, in the source's order (Phase 23).
   * Every in-scope country has ≥ 1. Localized names via the curated `languages-i18n` map,
   * defaulting to English where no exonym differs. Not a legal "official languages" claim.
   */
  languages: LanguageRef[];
  /**
   * Main industries the country is known for (Phase 25). Curated ("main" = reputation), not from
   * any bundled source. Empty for the ~50 micro / data-poor states on the build's
   * `KNOWN_NO_INDUSTRY` allow-list — those are excluded as answers in the industries mode.
   */
  industries: IndustryRef[];
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
