// Daily-streak flame escalation ("Emberfall") — pure, framework-agnostic so it's unit-testable.
//
// The Home daily-streak flame grows with the run: as the consecutive-day streak lengthens it climbs
// a ladder of milestones — 3 days, a week, two weeks, then a monthly cadence (1, 2, 3, 6 months) up
// to a full year — heating from the teal accent through gold to a hot coral, and throwing off an
// ever-denser shower of rising embers. This module is the single source of the ladder and the
// per-tier visual recipe; `StreakIndicator.svelte` consumes the spec and animates it.
//
// Deliberately its own concept, separate from:
//   • the Orbi streak-milestone *reaction* (`domain/mascot.ts` isStreakMilestone), and
//   • the in-play *answer*-streak celebration (`ui/streak.ts` streakBurstSpec).
// Those reward different things; this is purely the habit flame's look.

/** Milestone day thresholds for the flame ladder, ascending. The array index is the tier. */
export const DAILY_STREAK_MILESTONES: readonly number[] = [1, 3, 7, 14, 30, 60, 90, 180, 365];

/**
 * Heat ramp, one colour per tier. Cool teal for the early days, igniting to gold at one month, then
 * on to a hot coral-red at a year. Anchored on the app's accent/sun/coral tokens (teal `#10a5a0`,
 * gold `#ffb020`, coral `#ff7a59`) with hand-tuned in-between stops, mirroring `ui/streak.ts`'s ramp.
 */
const HEAT: readonly string[] = [
  '#12a7a1', // day 1   — teal (accent)
  '#16ada2', // 3 days
  '#1fbaa6', // 1 week
  '#35c6b0', // 2 weeks — brightest cool
  '#ffc247', // 1 month — ignition to gold
  '#ffab1f', // 2 months — sun gold
  '#ff8a3d', // 3 months — orange
  '#ff6a4d', // 6 months — coral
  '#ff3d5e', // 1 year   — hot coral-red peak
];

/** Rising-ember count per tier — the shower thickens as the streak climbs (escalation by density). */
const EMBERS: readonly number[] = [0, 1, 2, 3, 5, 7, 9, 12, 16];

/** Flame glow (drop-shadow blur, px) per tier. */
const GLOW: readonly number[] = [2, 3, 5, 7, 10, 13, 17, 21, 26];

/** Flame resting scale per tier — it swells a little with the run. */
const SCALE: readonly number[] = [1, 1.03, 1.06, 1.09, 1.14, 1.19, 1.25, 1.32, 1.4];

/** Flicker/pulse period (ms) per tier — the flame quickens as it heats up. */
const SPEED_MS: readonly number[] = [2300, 2100, 1850, 1600, 1350, 1150, 1000, 860, 700];

/** The visual recipe for the daily-streak flame at a given run length. */
export interface DailyFlameSpec {
  /** Milestone tier reached (`0..DAILY_STREAK_MILESTONES.length - 1`), or `-1` for no active streak. */
  tier: number;
  /** Whether the streak is active (≥ 1 day) — the flame is "lit". */
  active: boolean;
  /** Flame colour for this tier (the heat ramp). */
  heat: string;
  /** Number of rising embers to radiate. */
  embers: number;
  /** Glow (drop-shadow) blur in px. */
  glow: number;
  /** Flame resting scale. */
  scale: number;
  /** Flicker/pulse period in ms. */
  speedMs: number;
}

/**
 * Highest milestone tier reached by a streak of `days` (`0..8`), or `-1` when there is no active
 * streak (`days <= 0`, non-finite). Caps at the top tier for streaks beyond a year.
 */
export function dailyStreakTier(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return -1;
  let tier = -1;
  for (let i = 0; i < DAILY_STREAK_MILESTONES.length; i++) {
    if (days >= DAILY_STREAK_MILESTONES[i]) tier = i;
  }
  return tier;
}

/**
 * The flame recipe for a streak of `days`. A non-streak returns an inactive spec (unlit, no embers)
 * so the indicator can render its muted resting state; every active knob escalates with the tier.
 */
export function dailyFlameSpec(days: number): DailyFlameSpec {
  const tier = dailyStreakTier(days);
  if (tier < 0) {
    return {
      tier: -1,
      active: false,
      heat: HEAT[0],
      embers: 0,
      glow: 0,
      scale: 1,
      speedMs: SPEED_MS[0],
    };
  }
  return {
    tier,
    active: true,
    heat: HEAT[tier],
    embers: EMBERS[tier],
    glow: GLOW[tier],
    scale: SCALE[tier],
    speedMs: SPEED_MS[tier],
  };
}
