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
