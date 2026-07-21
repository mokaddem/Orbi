// Explorer-rank medal art (Direction B — tiered metal medals). Pure, visual-only data: the ladder
// itself (rank names, XP thresholds) lives in `domain/xp.ts`; this table is the UI dressing struck
// over it. Consumed by RankMedal.svelte, which renders the coin, and shared by every rank surface
// (Home chip, Progress panel, Summary card) so the badge is defined in exactly one place.

import type { IconName } from './icons';

/**
 * The metal a rank's medal is struck in. Ranks climb bronze → silver → gold → platinum → crystal,
 * three rungs to a band, so the tier reads at a glance from the material alone, before the glyph.
 * Crystal is the prestige band; its crowned top rung is the Legendary Explorer.
 */
export type RankMetal = 'bronze' | 'silver' | 'gold' | 'platinum' | 'crystal';

/**
 * How much a coin catches the light — a periodic reflection sweep that climbs with the sub-level:
 * `none` (1★, a plain struck coin), `mild` (2★, a faint slow glint), `medium` (3★, a brighter
 * sweep), and `prismatic` (the crowned Crystal apex only — the strongest sweep plus an ambient
 * glow). Purely decorative and collapsed under reduce-motion.
 */
export type RankGlint = 'none' | 'mild' | 'medium' | 'prismatic';

export interface RankMedalSpec {
  /** The "journey" glyph embossed on the coin (icon-registry name; see icons.ts). */
  glyph: IconName;
  metal: RankMetal;
  /** Sub-level pips within the band, 1–3 — struck on the coin's lower rim. */
  stars: number;
  /** The coin's reflection sweep intensity (see {@link RankGlint}). */
  glint: RankGlint;
}

/**
 * Per-rank medal art, indexed by `RANKS[i].index` (Novice = 0 … Legendary Explorer = 14). The glyph
 * set tells one continuous journey: plant a flag → find your bearings → follow the signs → chart a
 * route → navigate → voyage → summit → map it → circle the globe → earn the accolades → be crowned.
 * Glint climbs with the sub-level within each band (1★ none · 2★ mild · 3★ medium); the crystal
 * band shines from the start and its crowned apex is prismatic.
 */
export const RANK_MEDALS: readonly RankMedalSpec[] = [
  { glyph: 'flag', metal: 'bronze', stars: 1, glint: 'none' }, // Novice
  { glyph: 'compass', metal: 'bronze', stars: 2, glint: 'mild' }, // Scout
  { glyph: 'signpost', metal: 'bronze', stars: 3, glint: 'medium' }, // Wanderer
  { glyph: 'route', metal: 'silver', stars: 1, glint: 'none' }, // Pathfinder
  { glyph: 'navigation', metal: 'silver', stars: 2, glint: 'mild' }, // Navigator
  { glyph: 'sailboat', metal: 'silver', stars: 3, glint: 'medium' }, // Voyager
  { glyph: 'mountain', metal: 'gold', stars: 1, glint: 'none' }, // Adventurer
  { glyph: 'map', metal: 'gold', stars: 2, glint: 'mild' }, // Cartographer
  { glyph: 'globe', metal: 'gold', stars: 3, glint: 'medium' }, // Globetrotter
  { glyph: 'award', metal: 'platinum', stars: 1, glint: 'none' }, // Pioneer
  { glyph: 'trophy', metal: 'platinum', stars: 2, glint: 'mild' }, // Trailblazer
  { glyph: 'shield', metal: 'platinum', stars: 3, glint: 'medium' }, // Vanguard
  { glyph: 'gem', metal: 'crystal', stars: 1, glint: 'mild' }, // Luminary
  { glyph: 'sparkles', metal: 'crystal', stars: 2, glint: 'medium' }, // Paragon
  { glyph: 'crown', metal: 'crystal', stars: 3, glint: 'prismatic' }, // Legendary Explorer
];

/** The four stops that shade one metal: coin gradient (hi→lo), rim highlight, disc face (1→2), and
 *  the ink the glyph + stars are struck in. */
export interface MetalPalette {
  hi: string;
  lo: string;
  rim: string;
  disc1: string;
  disc2: string;
  ink: string;
}

// Kept here rather than as app.css tokens: these are self-contained medal art (four shades × five
// materials), used only by RankMedal, not semantic app colours. The crystal band stays in the
// app's cool blue-teal family so the top rungs still read as "us".
export const METAL_PALETTES: Record<RankMetal, MetalPalette> = {
  bronze: {
    hi: '#e0a869',
    lo: '#8a5222',
    rim: '#f2c893',
    disc1: '#f3d3ab',
    disc2: '#cf9a5f',
    ink: '#6e3f16',
  },
  silver: {
    hi: '#eef3f6',
    lo: '#8d9aa2',
    rim: '#ffffff',
    disc1: '#ffffff',
    disc2: '#c3ced4',
    ink: '#5c6a70',
  },
  gold: {
    hi: '#f6cf5c',
    lo: '#a9781a',
    rim: '#fff2c0',
    disc1: '#fdeeb6',
    disc2: '#e2ac35',
    ink: '#7d5808',
  },
  // Platinum: a cool blue-violet white-metal — deliberately given an indigo/lavender cast and more
  // top-to-bottom contrast than silver's neutral bright grey, so the fourth band reads as a
  // distinct, more precious material at a glance rather than "another silver".
  platinum: {
    hi: '#e6ecfa',
    lo: '#6f7ba6',
    rim: '#f6f8ff',
    disc1: '#eef2fe',
    disc2: '#b6c0e4',
    ink: '#414c73',
  },
  crystal: {
    hi: '#bfeeff',
    lo: '#4aa6cf',
    rim: '#eafcff',
    disc1: '#eafaff',
    disc2: '#a9e2f5',
    ink: '#1c6f8f',
  },
};

/** Resolve a rank index to its medal spec, floored and clamped to the ladder. */
export function rankMedal(index: number): RankMedalSpec {
  const i = Math.max(0, Math.min(RANK_MEDALS.length - 1, Math.floor(index || 0)));
  return RANK_MEDALS[i];
}
