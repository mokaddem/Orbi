// Targeted practice — pure set-assembly + eligibility helpers (Phase 27).
//
// The player hand-picks a set of countries and a mode, then plays a session restricted to
// just those. The engine already restricts a run to an explicit ISO list via
// `RunConfig.answerPoolIso` (see `game.ts`), so the only genuinely new logic is assembling
// the set and working out which of the picked countries can actually be *asked about* in the
// chosen mode (map modes need geometry; attribute modes need the attribute). This module is
// pure and framework-free so it can be unit-tested without the DOM.

import type { Country } from '../data/types';
import { eligibleAnswers } from './questions';
import type { GameMode } from './types';

/**
 * Toggle `iso2` in a practice set: add it (appended, so selection order is preserved) if
 * absent, remove it if present. Returns a new array — never mutates the input.
 */
export function togglePractice(set: readonly string[], iso2: string): string[] {
  return set.includes(iso2) ? set.filter((c) => c !== iso2) : [...set, iso2];
}

/**
 * Merge `additions` into `set`, de-duplicating and preserving order (existing members keep
 * their position; genuinely-new codes are appended in the order given). Used by
 * "select all in this group".
 */
export function addToPractice(set: readonly string[], additions: readonly string[]): string[] {
  const seen = new Set(set);
  const merged = [...set];
  for (const iso of additions) {
    if (!seen.has(iso)) {
      seen.add(iso);
      merged.push(iso);
    }
  }
  return merged;
}

/** Remove every code in `removals` from `set`. Used by "clear all in this group". */
export function removeFromPractice(set: readonly string[], removals: readonly string[]): string[] {
  const drop = new Set(removals);
  return set.filter((iso) => !drop.has(iso));
}

/** The split of a chosen set into what can be asked about in `mode` and what cannot. */
export interface PracticeEligibility {
  /** Countries that can be the *answer* in `mode` (drives the session + its length). */
  eligible: Country[];
  /** Countries dropped because `mode` can't ask about them (no geometry / no attribute). */
  skipped: Country[];
}

/**
 * Split `countries` (already resolved from the chosen ISO set, in selection order) into
 * those that can be asked about in `mode` and those that can't. Mirrors what the engine does
 * internally with the answer pool ({@link eligibleAnswers}), surfaced up-front so the UI can
 * warn "12 of 20 have industry data — the rest are skipped" instead of silently shrinking.
 */
export function practiceEligibility(
  mode: GameMode,
  countries: readonly Country[],
): PracticeEligibility {
  const eligible = eligibleAnswers(mode, countries);
  const keep = new Set(eligible.map((c) => c.iso2));
  const skipped = countries.filter((c) => !keep.has(c.iso2));
  return { eligible, skipped };
}
