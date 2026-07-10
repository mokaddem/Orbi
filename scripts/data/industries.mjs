// @ts-check
/**
 * Phase 25 — Curated "main industries" dataset (national-industries quiz mode).
 *
 * Unlike capitals (Phase 24) and languages (Phase 23) — which localise data that already
 * ships in `world-countries` — there is **no bundled source for industries**. This file IS
 * the source: a hand-authored map of each in-scope country to a small set of keys from a
 * fixed, owner-approved taxonomy, assembled into the dataset by `scripts/build-data.mjs`.
 *
 * ┌─ SOURCING & DEFINITIONS ────────────────────────────────────────────────────────────┐
 * │ • "Main" = **reputation**: what the country is broadly *known for* economically, not a │
 * │   GDP-share / employment / export ranking (those disagree and are services-heavy       │
 * │   everywhere). Stated in the on-screen quiz copy so the quiz is defensible.            │
 * │ • Facts are not copyrightable. Authored from public-domain references — chiefly the     │
 * │   CIA World Factbook "Economy — industries" field — plus general knowledge, normalised │
 * │   into the taxonomy below. Offline and redistributable.                                │
 * │ • Coverage is the well-known economies (owner choice: "~110–120, skip the smallest /    │
 * │   hardest-to-source micro-states"). Micro-states and a few conflict / data-poor         │
 * │   economies are on the explicit {@link KNOWN_NO_INDUSTRY} exclusion list instead. The   │
 * │   build fails if any in-scope country is in neither this map nor that set, so the split │
 * │   stays exhaustive and honest.                                                          │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Taxonomy keys are kebab-case and stable (they are the quiz option ids + SR-independent
 * labels). Translations are concise for option buttons: French capitalises the first word,
 * German capitalises nouns.
 *
 * @type {Record<string, { en: string; fr: string; de: string }>}
 */
export const INDUSTRY_TAXONOMY = {
  agriculture: { en: 'Agriculture', fr: 'Agriculture', de: 'Landwirtschaft' },
  fishing: { en: 'Fishing', fr: 'Pêche', de: 'Fischerei' },
  mining: { en: 'Mining', fr: 'Exploitation minière', de: 'Bergbau' },
  'oil-gas': { en: 'Oil & gas', fr: 'Pétrole et gaz', de: 'Öl und Gas' },
  'metals-steel': { en: 'Metals & steel', fr: 'Métaux et acier', de: 'Metall und Stahl' },
  chemicals: { en: 'Chemicals', fr: 'Chimie', de: 'Chemie' },
  textiles: { en: 'Textiles & apparel', fr: 'Textile et habillement', de: 'Textil und Bekleidung' },
  'food-beverages': {
    en: 'Food & beverages',
    fr: 'Agroalimentaire',
    de: 'Lebensmittel und Getränke',
  },
  automotive: { en: 'Automotive', fr: 'Automobile', de: 'Automobilindustrie' },
  machinery: { en: 'Machinery & equipment', fr: 'Machines et équipements', de: 'Maschinenbau' },
  electronics: { en: 'Electronics', fr: 'Électronique', de: 'Elektronik' },
  tourism: { en: 'Tourism', fr: 'Tourisme', de: 'Tourismus' },
  finance: { en: 'Finance & banking', fr: 'Finance et banque', de: 'Finanzen und Banken' },
  shipping: {
    en: 'Shipping & logistics',
    fr: 'Transport maritime et logistique',
    de: 'Schifffahrt und Logistik',
  },
  'construction-materials': {
    en: 'Construction materials',
    fr: 'Matériaux de construction',
    de: 'Baustoffe',
  },
  pharmaceuticals: {
    en: 'Pharmaceuticals',
    fr: 'Industrie pharmaceutique',
    de: 'Pharmaindustrie',
  },
  energy: { en: 'Energy & power', fr: 'Énergie', de: 'Energie' },
  'it-software': { en: 'IT & software', fr: 'Informatique et logiciels', de: 'IT und Software' },
  'aerospace-defence': {
    en: 'Aerospace & defence',
    fr: 'Aéronautique et défense',
    de: 'Luftfahrt und Verteidigung',
  },
  'timber-paper': { en: 'Timber & paper', fr: 'Bois et papier', de: 'Holz und Papier' },
};

/**
 * iso2 → main industries (taxonomy keys), roughly most-prominent first. Every key must exist
 * in {@link INDUSTRY_TAXONOMY} and every listed country must be in scope, or the build fails.
 *
 * @type {Record<string, string[]>}
 */
export const COUNTRY_INDUSTRIES = {
  // ── Europe ──────────────────────────────────────────────────────────────────────────
  AL: ['mining', 'agriculture', 'tourism'],
  AT: ['machinery', 'automotive', 'tourism', 'metals-steel'],
  BY: ['machinery', 'agriculture', 'chemicals'],
  BE: ['chemicals', 'pharmaceuticals', 'shipping', 'food-beverages'],
  BA: ['metals-steel', 'agriculture', 'timber-paper'],
  BG: ['agriculture', 'tourism', 'textiles'],
  HR: ['tourism', 'shipping', 'food-beverages'],
  CY: ['tourism', 'finance', 'shipping'],
  CZ: ['automotive', 'machinery', 'electronics'],
  DK: ['pharmaceuticals', 'shipping', 'food-beverages', 'energy'],
  EE: ['it-software', 'electronics', 'timber-paper'],
  FI: ['timber-paper', 'electronics', 'machinery'],
  FR: ['aerospace-defence', 'automotive', 'tourism', 'food-beverages', 'pharmaceuticals'],
  DE: ['automotive', 'machinery', 'chemicals', 'electronics', 'pharmaceuticals'],
  GR: ['shipping', 'tourism', 'agriculture'],
  HU: ['automotive', 'electronics', 'pharmaceuticals'],
  IS: ['fishing', 'tourism', 'energy'],
  IE: ['pharmaceuticals', 'it-software', 'finance', 'food-beverages'],
  IT: ['automotive', 'machinery', 'textiles', 'tourism', 'food-beverages'],
  LV: ['timber-paper', 'agriculture', 'shipping'],
  LT: ['agriculture', 'chemicals', 'timber-paper'],
  LU: ['finance', 'metals-steel'],
  MT: ['tourism', 'finance', 'shipping'],
  MD: ['agriculture', 'food-beverages'],
  ME: ['tourism', 'metals-steel'],
  NL: ['chemicals', 'agriculture', 'shipping', 'electronics', 'finance'],
  MK: ['agriculture', 'textiles', 'metals-steel'],
  NO: ['oil-gas', 'fishing', 'shipping', 'energy'],
  PL: ['automotive', 'machinery', 'agriculture', 'food-beverages'],
  PT: ['tourism', 'textiles', 'agriculture', 'food-beverages'],
  RO: ['automotive', 'oil-gas', 'agriculture'],
  RU: ['oil-gas', 'mining', 'metals-steel', 'aerospace-defence'],
  RS: ['agriculture', 'automotive', 'mining'],
  SK: ['automotive', 'machinery', 'metals-steel'],
  SI: ['automotive', 'machinery', 'pharmaceuticals'],
  ES: ['tourism', 'automotive', 'agriculture', 'food-beverages'],
  SE: ['automotive', 'machinery', 'timber-paper', 'aerospace-defence'],
  CH: ['finance', 'pharmaceuticals', 'machinery', 'food-beverages'],
  UA: ['agriculture', 'metals-steel', 'mining'],
  GB: ['finance', 'aerospace-defence', 'pharmaceuticals', 'automotive'],

  // ── Africa ──────────────────────────────────────────────────────────────────────────
  DZ: ['oil-gas', 'mining'],
  AO: ['oil-gas', 'mining'],
  BW: ['mining', 'tourism'],
  CM: ['agriculture', 'oil-gas', 'timber-paper'],
  CD: ['mining', 'agriculture'],
  EG: ['tourism', 'textiles', 'agriculture', 'oil-gas', 'chemicals'],
  ET: ['agriculture', 'textiles', 'food-beverages'],
  GA: ['oil-gas', 'timber-paper', 'mining'],
  GH: ['mining', 'oil-gas', 'agriculture'],
  CI: ['agriculture', 'food-beverages', 'oil-gas'],
  KE: ['agriculture', 'tourism', 'food-beverages'],
  LY: ['oil-gas'],
  MG: ['agriculture', 'mining', 'tourism'],
  ML: ['mining', 'agriculture'],
  MR: ['mining', 'fishing'],
  MU: ['tourism', 'textiles', 'finance'],
  MA: ['tourism', 'agriculture', 'textiles', 'mining', 'automotive'],
  MZ: ['mining', 'agriculture', 'oil-gas'],
  NA: ['mining', 'fishing', 'tourism'],
  NG: ['oil-gas', 'agriculture', 'finance'],
  RW: ['agriculture', 'tourism'],
  SN: ['agriculture', 'fishing', 'tourism'],
  ZA: ['mining', 'automotive', 'finance', 'metals-steel', 'chemicals'],
  SD: ['agriculture', 'oil-gas'],
  TZ: ['agriculture', 'mining', 'tourism'],
  TN: ['tourism', 'textiles', 'agriculture'],
  UG: ['agriculture', 'food-beverages'],
  ZM: ['mining', 'agriculture'],
  ZW: ['mining', 'agriculture'],

  // ── Americas ────────────────────────────────────────────────────────────────────────
  AR: ['agriculture', 'automotive', 'food-beverages', 'oil-gas'],
  BO: ['mining', 'oil-gas', 'agriculture'],
  BR: ['agriculture', 'automotive', 'mining', 'aerospace-defence', 'oil-gas'],
  CA: ['oil-gas', 'mining', 'timber-paper', 'agriculture', 'automotive'],
  CL: ['mining', 'agriculture', 'fishing'],
  CO: ['oil-gas', 'agriculture', 'mining'],
  CR: ['tourism', 'agriculture', 'electronics'],
  CU: ['tourism', 'agriculture', 'pharmaceuticals'],
  DO: ['tourism', 'agriculture', 'textiles'],
  EC: ['oil-gas', 'agriculture', 'fishing'],
  SV: ['agriculture', 'textiles'],
  GT: ['agriculture', 'textiles', 'food-beverages'],
  GY: ['oil-gas', 'mining', 'agriculture'],
  HT: ['agriculture', 'textiles'],
  HN: ['agriculture', 'textiles'],
  JM: ['tourism', 'mining', 'agriculture'],
  MX: ['automotive', 'electronics', 'oil-gas', 'agriculture', 'tourism'],
  NI: ['agriculture', 'textiles'],
  PA: ['shipping', 'finance', 'tourism'],
  PY: ['agriculture', 'energy'],
  PE: ['mining', 'fishing', 'agriculture'],
  SR: ['mining', 'oil-gas'],
  TT: ['oil-gas', 'chemicals'],
  US: ['it-software', 'aerospace-defence', 'finance', 'automotive', 'pharmaceuticals'],
  UY: ['agriculture', 'food-beverages'],
  VE: ['oil-gas', 'mining'],

  // ── Asia ────────────────────────────────────────────────────────────────────────────
  AM: ['mining', 'it-software', 'agriculture'],
  AZ: ['oil-gas', 'agriculture'],
  BH: ['oil-gas', 'finance', 'metals-steel'],
  BD: ['textiles', 'agriculture', 'pharmaceuticals'],
  BT: ['energy', 'tourism', 'agriculture'],
  BN: ['oil-gas'],
  KH: ['textiles', 'tourism', 'agriculture'],
  CN: ['electronics', 'machinery', 'textiles', 'metals-steel', 'automotive', 'chemicals'],
  GE: ['agriculture', 'tourism', 'mining'],
  IN: ['it-software', 'textiles', 'pharmaceuticals', 'agriculture', 'automotive'],
  ID: ['oil-gas', 'mining', 'agriculture', 'textiles'],
  IR: ['oil-gas', 'agriculture', 'automotive'],
  IQ: ['oil-gas'],
  IL: ['it-software', 'aerospace-defence', 'electronics', 'pharmaceuticals'],
  JP: ['automotive', 'electronics', 'machinery', 'metals-steel'],
  JO: ['mining', 'tourism', 'pharmaceuticals'],
  KZ: ['oil-gas', 'mining', 'agriculture'],
  KW: ['oil-gas'],
  KG: ['mining', 'agriculture', 'textiles'],
  LA: ['energy', 'mining', 'agriculture'],
  LB: ['finance', 'tourism', 'agriculture'],
  MY: ['electronics', 'oil-gas', 'agriculture', 'tourism'],
  MV: ['tourism', 'fishing'],
  MN: ['mining', 'agriculture'],
  MM: ['agriculture', 'oil-gas', 'mining', 'textiles'],
  NP: ['tourism', 'agriculture', 'textiles'],
  KP: ['mining', 'metals-steel', 'aerospace-defence'],
  OM: ['oil-gas', 'tourism'],
  PK: ['textiles', 'agriculture', 'pharmaceuticals'],
  PH: ['electronics', 'it-software', 'agriculture', 'shipping'],
  QA: ['oil-gas', 'finance', 'construction-materials'],
  SA: ['oil-gas', 'chemicals', 'construction-materials'],
  SG: ['finance', 'electronics', 'shipping', 'chemicals', 'pharmaceuticals'],
  KR: ['electronics', 'automotive', 'shipping', 'metals-steel', 'chemicals'],
  LK: ['textiles', 'agriculture', 'tourism'],
  TJ: ['metals-steel', 'agriculture', 'energy'],
  TH: ['automotive', 'electronics', 'tourism', 'agriculture'],
  TR: ['automotive', 'textiles', 'tourism', 'machinery', 'construction-materials'],
  TL: ['oil-gas', 'agriculture'],
  TM: ['oil-gas', 'textiles'],
  AE: ['oil-gas', 'finance', 'tourism', 'construction-materials'],
  UZ: ['agriculture', 'mining', 'textiles'],
  VN: ['electronics', 'textiles', 'agriculture', 'food-beverages'],

  // ── Oceania ─────────────────────────────────────────────────────────────────────────
  AU: ['mining', 'agriculture', 'oil-gas', 'finance', 'tourism'],
  NZ: ['agriculture', 'food-beverages', 'tourism'],
  PG: ['mining', 'oil-gas', 'agriculture'],
  FJ: ['tourism', 'agriculture', 'fishing'],
};

/**
 * In-scope countries deliberately WITHOUT a curated industries entry — micro-states and a few
 * conflict / data-poor economies where a defensible "what it's known for" is too thin. Mirrors
 * the `KNOWN_NO_GEOMETRY` allow-list: the build fails if a country is missing from BOTH this set
 * and {@link COUNTRY_INDUSTRIES} (unexpected gap) or is in both (contradiction), and fails if an
 * entry here is out of scope or has since gained a curated entry (stale).
 *
 * @type {Set<string>}
 */
export const KNOWN_NO_INDUSTRY = new Set([
  // Europe — micro-states
  'AD',
  'LI',
  'MC',
  'SM',
  'VA',
  // Africa — micro-states, island micro-economies, conflict / data-poor
  'BI',
  'KM',
  'DJ',
  'ER',
  'SZ',
  'LS',
  'MW',
  'SC',
  'SO',
  'CF',
  'TD',
  'GQ',
  'CG',
  'SS',
  'ST',
  'BF',
  'GN',
  'GW',
  'LR',
  'NE',
  'SL',
  'BJ',
  'CV',
  'GM',
  'TG',
  // Americas — small Caribbean / island micro-states
  'AG',
  'BS',
  'BB',
  'DM',
  'GD',
  'KN',
  'LC',
  'VC',
  'BZ',
  // Asia — conflict / limited-recognition
  'PS',
  'AF',
  'YE',
  'SY',
  // Oceania — Pacific micro-states
  'KI',
  'MH',
  'FM',
  'NR',
  'PW',
  'WS',
  'SB',
  'TO',
  'TV',
  'VU',
]);
