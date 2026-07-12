// Training-session selection (Phase 7) — pure, framework-agnostic, unit-testable.
//
// Turns the persisted SM-2 state into a prioritised list of items worth re-drilling.
// "Train my mistakes" is the app's core teaching feature: it should surface the items
// the player keeps getting wrong (high lapses) and the items whose review is now due,
// weakest first. This module decides *which* items; the UI resolves them to countries
// and hands them to a `training` `QuizSession` (via its explicit answer pool).

import type { SRItem } from '../data/persistence/types';
import type { GameMode } from './types';
import { ALL_MODES } from './modes';

/** Split an `itemKey` (`mode:iso2`) back into its parts, or `null` if malformed. */
export function parseItemKey(itemKey: string): { mode: GameMode; iso2: string } | null {
  const sep = itemKey.indexOf(':');
  if (sep <= 0) return null;
  const mode = itemKey.slice(0, sep) as GameMode;
  const iso2 = itemKey.slice(sep + 1);
  if (!iso2 || !ALL_MODES.includes(mode)) return null;
  return { mode, iso2 };
}

/** An SR item selected for training, decomposed for convenience. */
export interface TrainingItem {
  itemKey: string;
  mode: GameMode;
  iso2: string;
  srItem: SRItem;
  /** Whether the item's review is currently due (`dueAt <= now`). */
  due: boolean;
}

export interface SelectTrainingOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
  /** Restrict to a single game mode (items are keyed `mode:iso2`). */
  mode?: GameMode;
  /** Cap the number of items returned (after ordering). */
  limit?: number;
  /** If set, include only items that are currently due (ignores not-yet-due lapses). */
  dueOnly?: boolean;
}

/**
 * Consecutive correct answers that retire a previously-missed item from the lapse-based
 * suggestions. `repetitions` resets to 0 on any miss (see `sr.ts`), so this reads as
 * "answered right this many times in a row since the last mistake" — i.e. re-learned.
 * A graduated item still resurfaces normally once it is genuinely due again (SM-2),
 * which is the point of spaced repetition; it just stops being *permanently* suggested.
 */
export const GRADUATE_AFTER = 3;

/**
 * An item is worth training if its review is due, or it has been missed and not yet
 * re-learned (fewer than {@link GRADUATE_AFTER} consecutive correct answers since the last
 * miss). A due item always qualifies regardless of streak. Without the graduation clause a
 * single lapse would keep a country suggested forever, since `lapses` never decrements.
 */
function isTrainable(item: SRItem, now: number, dueOnly: boolean): boolean {
  const due = item.dueAt <= now;
  if (dueOnly) return due;
  return due || (item.lapses > 0 && item.repetitions < GRADUATE_AFTER);
}

/**
 * Order two items weakest-first: due before not-due, then more lapses, then more
 * overdue, then lower ease (harder), then itemKey for a stable total order.
 */
function byWeakness(now: number) {
  return (a: SRItem, b: SRItem): number => {
    const aDue = a.dueAt <= now ? 1 : 0;
    const bDue = b.dueAt <= now ? 1 : 0;
    if (aDue !== bDue) return bDue - aDue;
    if (a.lapses !== b.lapses) return b.lapses - a.lapses;
    const aOver = now - a.dueAt;
    const bOver = now - b.dueAt;
    if (aOver !== bOver) return bOver - aOver;
    if (a.easeFactor !== b.easeFactor) return a.easeFactor - b.easeFactor;
    return a.itemKey.localeCompare(b.itemKey);
  };
}

/**
 * Select and order the items to train from all persisted SR state. Returns due and/or
 * previously-missed-but-not-yet-re-learned items (see {@link GRADUATE_AFTER}), weakest
 * first, optionally narrowed to one `mode` and capped at `limit`. Pure and
 * order-independent given `now`.
 */
export function selectTrainingItems(
  srItems: readonly SRItem[],
  options: SelectTrainingOptions = {},
): TrainingItem[] {
  const now = options.now ?? Date.now();
  const dueOnly = options.dueOnly ?? false;

  const candidates = srItems
    .filter((item) => {
      const parsed = parseItemKey(item.itemKey);
      if (!parsed) return false;
      if (options.mode && parsed.mode !== options.mode) return false;
      return isTrainable(item, now, dueOnly);
    })
    .sort(byWeakness(now));

  const limited =
    options.limit != null ? candidates.slice(0, Math.max(0, options.limit)) : candidates;

  return limited.map((srItem) => {
    // parseItemKey succeeded during filtering, so this is safe.
    const { mode, iso2 } = parseItemKey(srItem.itemKey)!;
    return { itemKey: srItem.itemKey, mode, iso2, srItem, due: srItem.dueAt <= now };
  });
}

/**
 * Pick the game mode with the most trainable items — used when starting a general
 * "train my mistakes" session that must commit to a single mode. Returns `null` when
 * nothing is trainable. Ties break by the fixed mode order for determinism.
 */
export function dominantTrainingMode(
  srItems: readonly SRItem[],
  options: Omit<SelectTrainingOptions, 'mode' | 'limit'> = {},
): GameMode | null {
  const items = selectTrainingItems(srItems, options);
  if (items.length === 0) return null;

  const counts = new Map<GameMode, number>();
  for (const it of items) counts.set(it.mode, (counts.get(it.mode) ?? 0) + 1);

  let best: GameMode | null = null;
  let bestCount = 0;
  for (const mode of ALL_MODES) {
    const count = counts.get(mode) ?? 0;
    if (count > bestCount) {
      best = mode;
      bestCount = count;
    }
  }
  return best;
}
