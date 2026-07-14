// Streak celebration tiers (Phase 36 / Phase 39) — pure, framework-agnostic so it's unit-testable.
//
// A growing answer streak unlocks progressively grander celebratory jingles. The tier is *sticky*:
// once you reach a milestone, that tier's cue keeps playing for every subsequent correct answer
// until the next milestone upgrades it — you never fall back to the plain `correct` cue mid-streak.
// A wrong answer resets the streak (and therefore the tier) to nothing.

/**
 * Streak lengths that unlock a higher celebratory jingle tier. Cadence tightens early (every few
 * answers) then widens as milestones get rarer and more special, topping out at 50.
 */
export const STREAK_MILESTONES: readonly number[] = [3, 5, 10, 15, 20, 25, 30, 40, 50];

/**
 * Sticky celebration tier for a streak: the index of the highest milestone reached
 * (`0..STREAK_MILESTONES.length - 1`), or `-1` below the first milestone (play the plain `correct`
 * cue). Caps at the top tier for streaks beyond the last milestone.
 */
export function streakTier(streak: number): number {
  let tier = -1;
  for (let i = 0; i < STREAK_MILESTONES.length; i++) {
    if (streak >= STREAK_MILESTONES[i]) tier = i;
  }
  return tier;
}

/**
 * True when this exact streak value just landed on a milestone — the moment the streak indicator
 * plays its celebratory pop. Because the streak increments by one per correct answer, it lands on
 * each milestone value exactly once as it climbs.
 */
export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

// ---- Milestone celebration (Phase 42): the picture-side parallel to `streakVoices` in sound.ts ---
//
// A milestone doesn't just pop — it stages an escalating celebration that grows grander tier by
// tier, in lockstep with the audio. The streak "flame" *heats up*: it warms from the cool teal
// accent through gold to a white-hot coral at the peak, and the burst around it thickens (more
// sparks), deepens (shockwave rings → an aura → a full-screen flash) and brightens — the visual
// analogue of the jingle escalating by density, depth and brightness.

/**
 * Heat ramp, one colour per tier. Anchor stops are app tokens — teal `--color-accent` (`#10a5a0`),
 * gold `--color-sun` (`#ffb020`), coral `--color-coral` (`#ff7a59`); the between-stops are hand-tuned
 * so the ramp stays vivid, with the cyan→amber jump at tier 3 reading as the flame *igniting*.
 */
const STREAK_HEAT: readonly string[] = [
  '#10a5a0', // tier 0 — teal (accent), the base cue
  '#15b0a8', // tier 1
  '#25c2b0', // tier 2 — brightest cool
  '#f6b73c', // tier 3 — ignition to amber
  '#ffb020', // tier 4 — sun gold
  '#ff9838', // tier 5 — deep gold-orange
  '#ff7a59', // tier 6 — coral
  '#ff5c48', // tier 7 — hot coral-red
  '#ff3d5e', // tier 8 — white-hot peak
];

/** Spark count per tier — the burst gets denser as the streak climbs (escalation by density). */
const STREAK_SPARKS: readonly number[] = [0, 5, 9, 13, 16, 20, 26, 32, 44];

/** The visual celebration recipe for one milestone tier. Consumed by `StreakBurst.svelte` (the burst
 * overlay) and by the streak pill's own heat/scale/glow animation in `Play.svelte`. */
export interface StreakBurstSpec {
  /** Clamped tier index (0..STREAK_MILESTONES.length - 1). */
  tier: number;
  /** Flame colour for this tier (the heat ramp). */
  heat: string;
  /** Peak scale of the pill's bump. */
  peakScale: number;
  /** Glow (drop-shadow) blur in px at the peak of the bump. */
  glow: number;
  /** Brightness multiplier at the peak of the bump. */
  bright: number;
  /** Duration of the pill's bump animation, ms — longer for grander tiers. */
  durMs: number;
  /** Number of sparks to radiate. */
  sparks: number;
  /** Shockwave rings (0, 1, or 2). */
  rings: number;
  /** A sustained glow blooms behind the pill. */
  aura: boolean;
  /** A brief full-screen flash + ray burst — the peak payoff. */
  screenFlash: boolean;
}

/**
 * Celebration spec for a milestone tier (0..{@link STREAK_MILESTONES}.length - 1, clamped so it can't
 * index out of range). Every knob escalates with the tier so the picture grows in step with the
 * sound: {@link STREAK_HEAT} (brightness), {@link STREAK_SPARKS} (density), and rings/aura/flash
 * (depth). Kept in lockstep with `streakVoices`/`STREAK_TIER_MAX` via the same milestone count.
 */
export function streakBurstSpec(tier: number): StreakBurstSpec {
  const t = Math.max(0, Math.min(STREAK_MILESTONES.length - 1, Math.round(tier)));
  return {
    tier: t,
    heat: STREAK_HEAT[t],
    peakScale: 1.3 + t * 0.05, // 1.30 → 1.70
    glow: 5 + t * 3, // 5 → 29 px
    bright: 1.35 + t * 0.06,
    durMs: 460 + t * 70,
    sparks: STREAK_SPARKS[t],
    rings: t >= 6 ? 2 : t >= 3 ? 1 : 0,
    aura: t >= 7,
    screenFlash: t >= 8,
  };
}
