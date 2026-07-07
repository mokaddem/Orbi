// Small presentation helpers for the UI layer. Pure and framework-agnostic.

/** Format a duration in ms as `12.3s` under a minute, else `m:ss`. */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, ms) / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  let m = Math.floor(totalSec / 60);
  let s = Math.round(totalSec % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a fraction in [0, 1] as a whole-number percentage, e.g. `0.8 → "80%"`. */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
