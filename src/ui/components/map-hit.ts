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
 * Enclave / tight-neighbour confusions for map-locate grading: each SMALL "inner" country → the
 * larger country(ies) it sits inside or hugs. The bundled map cuts enclave-shaped holes in the host,
 * so there's no geometric tell that a tap on the inner country is "inside" the host (Vatican inside
 * Italy). This curated table restores that: tapping the inner one when the host was asked still
 * counts (you found the right spot). Only the inner→host direction is listed — the reverse (host
 * asked, you meant the tiny inner) is handled by proximity to the inner's own aim-dot, not this
 * table, so a tap anywhere on a big host can never be mistaken for its enclave.
 */
export const ENCLAVE_HOSTS: Readonly<Record<string, readonly string[]>> = {
  VA: ['IT'], // Vatican City → Italy
  SM: ['IT'], // San Marino → Italy
  MC: ['FR'], // Monaco → France
  LI: ['CH', 'AT'], // Liechtenstein → Switzerland / Austria
  LS: ['ZA'], // Lesotho → South Africa
  AD: ['FR', 'ES'], // Andorra → France / Spain
  SG: ['MY'], // Singapore → Malaysia
  BN: ['MY'], // Brunei → Malaysia
  GM: ['SN'], // The Gambia → Senegal
};

/** Whether `inner` is a curated enclave / tight neighbour of `outer` (see {@link ENCLAVE_HOSTS}). */
export function isEnclaveOf(inner: string, outer: string): boolean {
  return (ENCLAVE_HOSTS[inner] ?? []).includes(outer);
}

/**
 * Apply map-locate answer leniency to a raw pick, returning the ISO to actually grade. Given the raw
 * resolution (`rawPick`), the asked country (`targetIso`), and whether the tap landed within the
 * accept radius of the target's *own* aim-dot (`targetWithinAccept`, computed by the caller in its
 * coordinate space — only meaningful for a micro-state target that has a dot):
 *
 *  1. An exact hit, or no target, passes through unchanged.
 *  2. A tap close enough to the asked micro-state's dot counts as that state — even if it technically
 *     resolved to the surrounding country (you found where the speck is).
 *  3. A tap that resolved to an enclave whose host is the asked country counts as the host (you tapped
 *     inside it, through the map's enclave hole).
 *  4. Otherwise the raw pick stands.
 *
 * Pure and framework-free; both the flat and globe maps route through it so grading stays identical.
 */
export function lenientLocatePick(
  rawPick: string | null,
  targetIso: string | null | undefined,
  targetWithinAccept: boolean,
): string | null {
  if (!targetIso || rawPick === targetIso) return rawPick;
  if (targetWithinAccept) return targetIso;
  if (rawPick && isEnclaveOf(rawPick, targetIso)) return targetIso;
  return rawPick;
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
