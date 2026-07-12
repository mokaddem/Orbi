// Nearest-country hit resolution for map-locate (Phase 37).
//
// On a large / world board most countries are only a few pixels wide, so a tap rarely
// lands dead-centre. `WorldMap` resolves a *direct* hit on a country's SVG path (or its
// Phase 22 micro-state aim dot) on its own; this helper handles the *fallback*: a tap
// that lands on open water / a gap between countries snaps to the nearest country
// centroid — but only within a capped distance, so a mid-ocean tap on a world board
// can't resolve to a far-away country and make play trivial (Phase 37 OQ5). A tap
// beyond the cap returns `null` (a no-op — the question stays open rather than
// committing a wrong answer for an obvious miss).
//
// Pure and framework-free so it is unit-tested without a DOM. Coordinates are in the
// map's fixed logical surface (the 980×500 viewBox) and the cap is in those same
// logical units, so it behaves identically at every zoom level and viewport size —
// `WorldMap` inverse-transforms the tap through the current zoom transform (via
// `d3-selection`'s `pointer(event, zoomLayer)`) before calling this.

export interface CentroidTarget {
  iso2: string;
  cx: number;
  cy: number;
}

/**
 * Return the ISO alpha-2 of the country whose projected centroid is nearest to
 * `(x, y)` and within `capLogical` logical units, or `null` if none is close enough
 * (or the inputs are degenerate). Ties resolve to the last candidate in `targets`.
 */
export function nearestCountryWithinCap(
  x: number,
  y: number,
  targets: readonly CentroidTarget[],
  capLogical: number,
): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(capLogical > 0)) return null;
  let bestIso: string | null = null;
  let bestD2 = capLogical * capLogical;
  for (const c of targets) {
    if (!Number.isFinite(c.cx) || !Number.isFinite(c.cy)) continue;
    const dx = c.cx - x;
    const dy = c.cy - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      bestIso = c.iso2;
    }
  }
  return bestIso;
}
