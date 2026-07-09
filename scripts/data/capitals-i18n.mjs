// @ts-check
/**
 * Phase 24 — Curated FR/DE names for capital cities.
 *
 * `world-countries` ships capital names in **English only**. For the trilingual UI we
 * localise them: English is always the default (from the source), and this map supplies
 * a French and/or German override **only where the exonym actually differs** from English.
 * A capital not listed here (or a locale key omitted) uses the English name verbatim —
 * so the map stays small and every entry is a real, deliberate translation.
 *
 * Keyed by ISO 3166-1 alpha-2. Shape: `{ fr?, de? }` (omit a key when it equals English).
 *
 * ┌─ OWNER REVIEW ────────────────────────────────────────────────────────────────────┐
 * │ This is a hand-curated translation set (well-established exonyms only). Please skim  │
 * │ it — especially the "City" compounds (Guatemala/Kuwait/Mexico/Panama) and the few   │
 * │ transliteration choices (Ulan Bator, Tbilisi/Tiflis) — and correct anything off.    │
 * └────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Canonical capital: for the one in-scope multi-capital country (South Africa →
 * Pretoria / Bloemfontein / Cape Town) the build takes the first listed (Pretoria).
 *
 * @type {Record<string, { fr?: string; de?: string }>}
 */
export const CAPITAL_I18N = {
  // — Europe —
  AD: { fr: 'Andorre-la-Vieille' },
  AT: { fr: 'Vienne', de: 'Wien' },
  BE: { fr: 'Bruxelles', de: 'Brüssel' },
  BG: {}, // Sofia — same in all three (kept as a no-op example; harmless)
  CH: { fr: 'Berne' },
  CY: { fr: 'Nicosie', de: 'Nikosia' },
  CZ: { de: 'Prag' },
  DK: { fr: 'Copenhague', de: 'Kopenhagen' },
  GB: { fr: 'Londres' },
  GR: { fr: 'Athènes', de: 'Athen' },
  IT: { de: 'Rom' },
  LU: { de: 'Luxemburg' },
  MT: { fr: 'La Valette' },
  PL: { fr: 'Varsovie', de: 'Warschau' },
  PT: { fr: 'Lisbonne', de: 'Lissabon' },
  RO: { fr: 'Bucarest', de: 'Bukarest' },
  RS: { de: 'Belgrad' },
  RU: { fr: 'Moscou', de: 'Moskau' },
  VA: { fr: 'Cité du Vatican', de: 'Vatikanstadt' },

  // — Africa —
  DZ: { fr: 'Alger', de: 'Algier' },
  DJ: { de: 'Dschibuti' },
  EG: { fr: 'Le Caire', de: 'Kairo' },
  ET: { fr: 'Addis-Abeba', de: 'Addis Abeba' },
  LY: { de: 'Tripolis' },
  SD: { de: 'Khartum' },
  SO: { fr: 'Mogadiscio', de: 'Mogadischu' },

  // — Asia & Middle East —
  AE: { fr: 'Abou Dabi' },
  AF: { fr: 'Kaboul' },
  AM: { fr: 'Erevan', de: 'Eriwan' },
  AZ: { fr: 'Bakou' },
  CN: { fr: 'Pékin', de: 'Peking' },
  GE: { fr: 'Tbilissi', de: 'Tiflis' },
  IL: { fr: 'Jérusalem' },
  IN: { de: 'Neu-Delhi' },
  IQ: { fr: 'Bagdad', de: 'Bagdad' },
  IR: { fr: 'Téhéran', de: 'Teheran' },
  JP: { de: 'Tokio' },
  KG: { fr: 'Bichkek', de: 'Bischkek' },
  KP: { de: 'Pjöngjang' },
  KR: { fr: 'Séoul' },
  KW: { fr: 'Koweït', de: 'Kuwait-Stadt' },
  LB: { fr: 'Beyrouth' },
  MN: { fr: 'Oulan-Bator', de: 'Ulan-Bator' },
  NP: { fr: 'Katmandou' },
  OM: { fr: 'Mascate', de: 'Maskat' },
  PH: { fr: 'Manille' },
  SA: { fr: 'Riyad', de: 'Riad' },
  SG: { fr: 'Singapour', de: 'Singapur' },
  SY: { fr: 'Damas', de: 'Damaskus' },
  TJ: { fr: 'Douchanbé', de: 'Duschanbe' },
  TM: { fr: 'Achgabat', de: 'Aschgabat' },
  UZ: { fr: 'Tachkent', de: 'Taschkent' },
  VN: { fr: 'Hanoï' },

  // — Americas —
  CU: { fr: 'La Havane', de: 'Havanna' },
  DO: { fr: 'Saint-Domingue' },
  GT: { fr: 'Guatemala', de: 'Guatemala-Stadt' },
  MX: { fr: 'Mexico', de: 'Mexiko-Stadt' },
  PA: { fr: 'Panama', de: 'Panama-Stadt' },
  TT: { fr: "Port-d'Espagne" },
};
