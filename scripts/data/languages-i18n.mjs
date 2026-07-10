// @ts-check
/**
 * Phase 23 — Curated FR/DE names for the languages spoken in each country.
 *
 * `world-countries` ships language names in **English only** (keyed by ISO-639-3 code, e.g.
 * `nld → "Dutch"`). For the trilingual UI we localise them the same way as capitals: English
 * is always the default (from the source), and this map supplies a French and/or German
 * override **only where the established exonym actually differs** from English. A language not
 * listed here (or a locale key omitted) uses the English name verbatim — so the map stays
 * small, every entry is a real translation, and the build fails on any no-op override.
 *
 * Keyed by ISO 639-3 code. Shape: `{ fr?, de? }` (omit a key when it equals English).
 *
 * ┌─ OWNER REVIEW ─────────────────────────────────────────────────────────────────────┐
 * │ This is a hand-curated translation set of the well-known language exonyms only; the  │
 * │ long tail of smaller languages defaults to its English name (untranslated). Two      │
 * │ deliberate labelling choices to confirm or change:                                    │
 * │  1. French language names are capitalised here (e.g. "Anglais") for tidy option       │
 * │     buttons — strict French orthography would lower-case them ("anglais").            │
 * │  2. German nouns are always capitalised, so every German override is capitalised.     │
 * │ Please skim and correct anything off; add FR/DE for any language still on English.    │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * @type {Record<string, { fr?: string; de?: string }>}
 */
export const LANGUAGE_I18N = {
  // — Most widely spoken across the dataset —
  eng: { fr: 'Anglais', de: 'Englisch' },
  fra: { fr: 'Français', de: 'Französisch' },
  ara: { fr: 'Arabe', de: 'Arabisch' },
  spa: { fr: 'Espagnol', de: 'Spanisch' },
  por: { fr: 'Portugais', de: 'Portugiesisch' },
  rus: { fr: 'Russe', de: 'Russisch' },
  deu: { fr: 'Allemand', de: 'Deutsch' },
  ita: { fr: 'Italien', de: 'Italienisch' },
  nld: { fr: 'Néerlandais', de: 'Niederländisch' },
  zho: { fr: 'Chinois', de: 'Chinesisch' },

  // — Europe —
  sqi: { fr: 'Albanais', de: 'Albanisch' },
  bel: { fr: 'Biélorusse', de: 'Belarussisch' },
  bos: { fr: 'Bosnien', de: 'Bosnisch' },
  bul: { fr: 'Bulgare', de: 'Bulgarisch' },
  cat: { de: 'Katalanisch' }, // fr "Catalan" == English → omit
  hrv: { fr: 'Croate', de: 'Kroatisch' },
  ces: { fr: 'Tchèque', de: 'Tschechisch' },
  dan: { fr: 'Danois', de: 'Dänisch' },
  est: { fr: 'Estonien', de: 'Estnisch' },
  fin: { fr: 'Finnois', de: 'Finnisch' },
  ell: { fr: 'Grec', de: 'Griechisch' },
  hun: { fr: 'Hongrois', de: 'Ungarisch' },
  isl: { fr: 'Islandais', de: 'Isländisch' },
  gle: { fr: 'Irlandais', de: 'Irisch' },
  lav: { fr: 'Letton', de: 'Lettisch' },
  lit: { fr: 'Lituanien', de: 'Litauisch' },
  ltz: { fr: 'Luxembourgeois', de: 'Luxemburgisch' },
  mkd: { fr: 'Macédonien', de: 'Mazedonisch' },
  mlt: { fr: 'Maltais', de: 'Maltesisch' },
  cnr: { fr: 'Monténégrin', de: 'Montenegrinisch' },
  pol: { fr: 'Polonais', de: 'Polnisch' },
  ron: { fr: 'Roumain', de: 'Rumänisch' },
  roh: { fr: 'Romanche', de: 'Rätoromanisch' },
  srp: { fr: 'Serbe', de: 'Serbisch' },
  slk: { fr: 'Slovaque', de: 'Slowakisch' },
  slv: { fr: 'Slovène', de: 'Slowenisch' },
  swe: { fr: 'Suédois', de: 'Schwedisch' },
  gsw: { fr: 'Suisse allemand', de: 'Schweizerdeutsch' },
  tur: { fr: 'Turc', de: 'Türkisch' },
  ukr: { fr: 'Ukrainien', de: 'Ukrainisch' },

  // — Asia & Middle East —
  hye: { fr: 'Arménien', de: 'Armenisch' },
  aze: { fr: 'Azéri', de: 'Aserbaidschanisch' },
  ben: { de: 'Bengalisch' }, // fr "Bengali" == English → omit
  mya: { fr: 'Birman', de: 'Birmanisch' },
  kat: { fr: 'Géorgien', de: 'Georgisch' },
  heb: { fr: 'Hébreu', de: 'Hebräisch' },
  ind: { fr: 'Indonésien', de: 'Indonesisch' },
  jpn: { fr: 'Japonais', de: 'Japanisch' },
  kaz: { de: 'Kasachisch' }, // fr "Kazakh" == English → omit
  kir: { fr: 'Kirghize', de: 'Kirgisisch' },
  kor: { fr: 'Coréen', de: 'Koreanisch' },
  lao: { de: 'Laotisch' }, // fr "Lao" == English → omit
  msa: { fr: 'Malais', de: 'Malaiisch' },
  mon: { fr: 'Mongol', de: 'Mongolisch' },
  nep: { fr: 'Népalais', de: 'Nepalesisch' },
  pus: { fr: 'Pachto', de: 'Paschtu' },
  fas: { fr: 'Persan', de: 'Persisch' },
  sin: { fr: 'Cingalais', de: 'Singhalesisch' },
  tgk: { fr: 'Tadjik', de: 'Tadschikisch' },
  tam: { fr: 'Tamoul' }, // de "Tamil" == English → omit
  tha: { fr: 'Thaï', de: 'Thailändisch' },
  tuk: { fr: 'Turkmène', de: 'Turkmenisch' },
  urd: { fr: 'Ourdou' }, // de "Urdu" == English → omit
  uzb: { fr: 'Ouzbek', de: 'Usbekisch' },
  vie: { fr: 'Vietnamien', de: 'Vietnamesisch' },

  // — Africa —
  amh: { fr: 'Amharique', de: 'Amharisch' },
  ber: { fr: 'Berbère', de: 'Berberisch' },
  mlg: { fr: 'Malgache', de: 'Malagassisch' },
  som: { de: 'Somalisch' }, // fr "Somali" == English → omit
  swa: { de: 'Suaheli' }, // fr "Swahili" == English → omit

  // — Americas —
  hat: { fr: 'Créole haïtien' }, // de left on English ("Haitian Creole") for owner review

  // — Oceania —
  fij: { fr: 'Fidjien', de: 'Fidschianisch' },
  smo: { de: 'Samoanisch' }, // fr "Samoan" == English → omit
  ton: { fr: 'Tongien', de: 'Tongaisch' },
};
