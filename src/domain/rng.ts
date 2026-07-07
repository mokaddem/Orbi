// Injectable pseudo-random source (Phase 2).
//
// The generator and session engine take an `Rng` so tests can seed it and assert
// exact distractor sets and question order. At runtime `Math.random` is fine (the
// default); the seedable `mulberry32` exists purely for deterministic tests.

/** A random source returning a float in [0, 1), same contract as `Math.random`. */
export type Rng = () => number;

/** The default runtime source. Non-deterministic; do not use in assertions. */
export const defaultRng: Rng = Math.random;

/**
 * Seedable PRNG (mulberry32). Fast, tiny, and deterministic for a given seed —
 * good enough for shuffling quiz options, not for cryptography.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [0, n). Returns 0 for n <= 0. */
export function randomInt(rng: Rng, n: number): number {
  return n <= 0 ? 0 : Math.floor(rng() * n);
}

/** Return a shuffled copy of `items` (Fisher–Yates). Never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Take up to `n` distinct items at random from `items` (no repeats). */
export function sample<T>(items: readonly T[], n: number, rng: Rng): T[] {
  if (n >= items.length) return shuffle(items, rng);
  return shuffle(items, rng).slice(0, Math.max(0, n));
}
