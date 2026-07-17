// Explorer-rank medal art (Direction B — tiered metal medals). Pure, visual-only data: the ladder
// itself (rank names, XP thresholds) lives in `domain/xp.ts`; this table is the UI dressing struck
// over it. Consumed by RankMedal.svelte, which renders the coin, and shared by every rank surface
// (Home chip, Progress panel, Summary card) so the badge is defined in exactly one place.

import type { IconName } from './icons';

/**
 * The metal a rank's medal is struck in. Ranks climb bronze → silver → gold, three rungs to a
 * band, then a one-off faceted crystal apex for the Legendary Explorer — beyond metal entirely, so
 * the tier reads at a glance from the material alone, before the glyph.
 */
export type RankMetal = 'bronze' | 'silver' | 'gold' | 'crystal';

export interface RankMedalSpec {
  /** The "journey" glyph embossed on the coin (icon-registry name; see icons.ts). */
  glyph: IconName;
  metal: RankMetal;
  /** Sub-level pips within the band, 1–3. The crystal apex uses 0 (it shows facets instead). */
  stars: number;
}

/**
 * Per-rank medal art, indexed by `RANKS[i].index` (Novice = 0 … Legendary Explorer = 9). The glyph
 * set tells one continuous journey: plant a flag → find your bearings → follow the signs → chart a
 * route → navigate → voyage → summit → map it → circle the globe → be crowned.
 */
export const RANK_MEDALS: readonly RankMedalSpec[] = [
  { glyph: 'flag', metal: 'bronze', stars: 1 }, // Novice
  { glyph: 'compass', metal: 'bronze', stars: 2 }, // Scout
  { glyph: 'signpost', metal: 'bronze', stars: 3 }, // Wanderer
  { glyph: 'route', metal: 'silver', stars: 1 }, // Pathfinder
  { glyph: 'navigation', metal: 'silver', stars: 2 }, // Navigator
  { glyph: 'sailboat', metal: 'silver', stars: 3 }, // Voyager
  { glyph: 'mountain', metal: 'gold', stars: 1 }, // Adventurer
  { glyph: 'map', metal: 'gold', stars: 2 }, // Cartographer
  { glyph: 'globe', metal: 'gold', stars: 3 }, // Globetrotter
  { glyph: 'crown', metal: 'crystal', stars: 0 }, // Legendary Explorer
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

// Kept here rather than as app.css tokens: these are self-contained medal art (four shades × four
// materials), used only by RankMedal, not semantic app colours. The crystal apex stays in the
// app's cool blue-teal family so the top rung still reads as "us".
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
