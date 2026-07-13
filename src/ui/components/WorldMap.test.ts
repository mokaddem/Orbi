import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import WorldMap from './WorldMap.svelte';

type CountryFeature = Feature<Geometry, GeoJsonProperties>;

/**
 * A square polygon centred on [lon, lat] with the given half-size in degrees. The
 * ring is wound clockwise so d3-geo's spherical winding treats the small square as
 * the interior rather than its (whole-globe) complement.
 */
function square(lon: number, lat: number, half: number): CountryFeature {
  return {
    type: 'Feature',
    id: `${lon}:${lat}`,
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon - half, lat - half],
          [lon - half, lat + half],
          [lon + half, lat + half],
          [lon + half, lat - half],
          [lon - half, lat - half],
        ],
      ],
    },
  };
}

// AA is large, BB moderate, CC a microstate (tiny projected area → gets a hit dot).
const features = new Map<string, CountryFeature>([
  ['AA', square(0, 0, 40)],
  ['BB', square(100, 20, 12)],
  ['CC', square(-100, -20, 0.1)],
]);

const path = (c: HTMLElement, iso2: string) =>
  c.querySelector(`path[data-iso="${iso2}"]`) as SVGPathElement;

describe('WorldMap', () => {
  it('renders one path per country with a resolvable ISO code', () => {
    const { container } = render(WorldMap, { features });
    const paths = container.querySelectorAll('path.country');
    expect(paths.length).toBe(3);
    for (const iso2 of ['AA', 'BB', 'CC']) {
      expect(path(container, iso2)).toBeInTheDocument();
    }
  });

  it('does not report clicks when non-interactive (highlight mode display)', async () => {
    const onpick = vi.fn();
    const { container } = render(WorldMap, { features, onpick });
    await fireEvent.click(path(container, 'AA'));
    expect(onpick).not.toHaveBeenCalled();
  });

  it('reports the clicked ISO when interactive (locate mode)', async () => {
    const onpick = vi.fn();
    const { container } = render(WorldMap, { features, interactive: true, onpick });
    await fireEvent.click(path(container, 'BB'));
    expect(onpick).toHaveBeenCalledTimes(1);
    expect(onpick).toHaveBeenCalledWith('BB');
  });

  it('locks once disabled, even when interactive', async () => {
    const onpick = vi.fn();
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      onpick,
    });
    await fireEvent.click(path(container, 'AA'));
    expect(onpick).not.toHaveBeenCalled();
  });

  it('highlights a large country by fill only — no pointer ring (Phase 40)', () => {
    const { container } = render(WorldMap, { features, highlightIso: 'AA' });
    expect(path(container, 'AA')).toHaveAttribute('data-state', 'highlight');
    expect(path(container, 'BB')).toHaveAttribute('data-state', '');
    // AA is large: its highlight fill is unmistakable, so a ring on top would just clutter it.
    expect(container.querySelector('circle.marker')).not.toBeInTheDocument();
  });

  it('rings a highlighted micro-state so it stays visible (Phase 40)', () => {
    const { container } = render(WorldMap, { features, highlightIso: 'CC' });
    expect(path(container, 'CC')).toHaveAttribute('data-state', 'highlight');
    // CC is a micro-state (tiny fill), so the pointer ring earns its place — matching the
    // reveal-ring convention.
    expect(container.querySelector('circle.marker')).toBeInTheDocument();
  });

  it('reveals correct (green) and marks the picked-wrong country after a miss', () => {
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      revealIso: 'AA',
      pickedIso: 'BB',
    });
    expect(path(container, 'AA')).toHaveAttribute('data-state', 'reveal');
    expect(path(container, 'BB')).toHaveAttribute('data-state', 'picked-wrong');
  });

  it('leads a microstate reveal with a target ring + name label (Phase 22)', () => {
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      revealIso: 'CC', // the microstate target — too small to see from its fill alone
      pickedIso: 'AA', // wrong pick (a large neighbour)
      revealLabel: 'Ccland',
    });
    // A micro-state (one that would have an aim dot) gets the ring, since its green
    // fill is invisible at that size.
    expect(container.querySelector('circle.reveal-ring')).toBeInTheDocument();
    const label = container.querySelector('text.reveal-label');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe('Ccland');
    // The target's own aim dot is replaced by the ring; the wrong pick is still
    // identified (rendered muted via CSS) so it reads as secondary context.
    expect(container.querySelector('circle[data-hit="dot"]')).not.toBeInTheDocument();
    expect(path(container, 'AA')).toHaveAttribute('data-state', 'picked-wrong');
  });

  it('reveals a normal-sized country with fill + label but no ring (owner feedback)', () => {
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      revealIso: 'AA', // large target — legible from its green fill, so no ring
      revealLabel: 'Aaland',
    });
    // The country is coloured (reveal state) and labelled...
    expect(path(container, 'AA')).toHaveAttribute('data-state', 'reveal');
    const label = container.querySelector('text.reveal-label');
    expect(label?.textContent).toBe('Aaland');
    // ...but no circle is drawn on top: the ring is reserved for micro-states.
    expect(container.querySelector('circle.reveal-ring')).not.toBeInTheDocument();
  });

  it('names the wrong pick with a red on-map label (Phase 35)', () => {
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      revealIso: 'AA', // correct target
      pickedIso: 'BB', // moderate-sized wrong pick
      revealLabel: 'Aaland',
      pickedLabel: 'Bbland',
    });
    const label = container.querySelector('text.picked-label');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe('Bbland');
    expect(container.querySelector('line.picked-leader')).toBeInTheDocument();
    // BB isn't a micro-state, so its red fill carries it — no ring on top.
    expect(container.querySelector('circle.picked-ring')).not.toBeInTheDocument();
  });

  it('rings a micro wrong pick so its tiny red fill is findable', () => {
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      revealIso: 'AA',
      pickedIso: 'CC', // microstate wrong pick — too small to see from its fill
      pickedLabel: 'Ccland',
    });
    expect(container.querySelector('circle.picked-ring')).toBeInTheDocument();
    expect(container.querySelector('text.picked-label')?.textContent).toBe('Ccland');
  });

  it('omits the picked label when the pick is the correct target', () => {
    const { container } = render(WorldMap, {
      features,
      interactive: true,
      disabled: true,
      revealIso: 'AA',
      pickedIso: 'AA', // correct → nothing to call out
      pickedLabel: 'Aaland',
    });
    expect(container.querySelector('text.picked-label')).not.toBeInTheDocument();
  });

  it('makes microstate aim dots visible in locate play', () => {
    const { container } = render(WorldMap, { features, interactive: true });
    const dot = container.querySelector('circle[data-hit="dot"]');
    expect(dot).toBeInTheDocument();
    // Visible now (not the old transparent target) — carries the styling class.
    expect(dot).toHaveClass('dot');
  });

  it('never validates a microstate target from a neighbour click', async () => {
    const onpick = vi.fn();
    const { container } = render(WorldMap, { features, interactive: true, onpick });
    // CC is the tiny target; clicking the large neighbour AA must report AA, not CC.
    await fireEvent.click(path(container, 'AA'));
    expect(onpick).toHaveBeenCalledWith('AA');
    expect(onpick).not.toHaveBeenCalledWith('CC');
  });

  it('fits the projection to the focused subset (region zoom)', () => {
    const base = render(WorldMap, { features });
    const dAll = path(base.container, 'BB').getAttribute('d');
    base.unmount();

    const focused = render(WorldMap, { features, focusIsos: ['BB'] });
    // Framing on BB alone reprojects it differently than fitting the whole world.
    expect(path(focused.container, 'BB').getAttribute('d')).not.toBe(dAll);
    // Every country is still drawn, just reframed.
    expect(focused.container.querySelectorAll('path.country').length).toBe(3);
  });

  it('falls back to the whole world when focusIsos match no features', () => {
    const base = render(WorldMap, { features });
    const dAll = path(base.container, 'AA').getAttribute('d');
    base.unmount();

    const focused = render(WorldMap, { features, focusIsos: ['ZZ'] });
    expect(path(focused.container, 'AA').getAttribute('d')).toBe(dAll);
  });

  it('draws with the chosen projection (Phase 28)', () => {
    const base = render(WorldMap, { features }); // default: naturalEarth
    const dDefault = path(base.container, 'BB').getAttribute('d');
    base.unmount();

    const mercator = render(WorldMap, { features, projection: 'mercator' });
    // A different projection reprojects the same geometry to a different path...
    expect(path(mercator.container, 'BB').getAttribute('d')).not.toBe(dDefault);
    // ...while still drawing every country.
    expect(mercator.container.querySelectorAll('path.country').length).toBe(3);
  });

  it('renders zoom controls, with reset hidden until the board is zoomed', () => {
    const { container } = render(WorldMap, { features, interactive: true });
    const buttons = container.querySelectorAll('.map-controls button');
    // Zoom-in and zoom-out are always available; reset only appears once zoomed (k>1).
    expect(buttons.length).toBe(2);
    for (const b of buttons) {
      expect(b.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    }
  });

  it('adds an ocean-hit snap catcher only in interactive (locate) mode', async () => {
    const locate = render(WorldMap, { features, interactive: true });
    // The catcher sits below the countries so a direct hit still wins, and is hidden
    // from assistive tech (pointer-only forgiveness; the country buttons carry a11y).
    const rect = locate.container.querySelector('rect.ocean-hit');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('aria-hidden', 'true');
    locate.unmount();

    const display = render(WorldMap, { features, interactive: false });
    expect(display.container.querySelector('rect.ocean-hit')).not.toBeInTheDocument();
  });

  it('adds a tappable fallback dot for microstates in locate mode only', async () => {
    const onpick = vi.fn();
    const { container, rerender } = render(WorldMap, { features, interactive: true, onpick });

    const dots = container.querySelectorAll('circle[data-hit="dot"]');
    expect(dots.length).toBe(1);
    expect(dots[0]).toHaveAttribute('data-iso', 'CC');

    await fireEvent.click(dots[0]);
    expect(onpick).toHaveBeenCalledWith('CC');

    // No boost targets when the map is a non-interactive display.
    await rerender({ features, interactive: false });
    expect(container.querySelectorAll('circle[data-hit="dot"]').length).toBe(0);
  });
});
