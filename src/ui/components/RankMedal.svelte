<script module lang="ts">
  // Gradient ids must be unique per instance — several medals can share a page (e.g. a rank chip
  // plus a ladder). A module counter keeps them collision-free without pulling in randomness.
  let uidCounter = 0;
  function nextUid(): string {
    uidCounter += 1;
    return `rm${uidCounter}`;
  }

  // Round-brilliant facet geometry for the crystal apex: an octagon table + kite facets out to the
  // girdle, forming a gem sparkle ring around the crown. Static (identical on every apex medal);
  // coloured by the palette at render time. Polar helper: degrees clockwise from 12 o'clock.
  function facetPt(r: number, deg: number): [number, number] {
    const a = (deg * Math.PI) / 180;
    return [32 + r * Math.sin(a), 32 - r * Math.cos(a)];
  }
  const R_TABLE = 6.5;
  const R_GIRDLE = 15;
  const FACET_TABLE = Array.from({ length: 8 }, (_, k) => facetPt(R_TABLE, k * 45 + 22.5))
    .map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(' ');
  const FACET_LINES = Array.from({ length: 8 }, (_, k) => {
    const g = facetPt(R_GIRDLE, k * 45);
    const a = facetPt(R_TABLE, k * 45 - 22.5);
    const b = facetPt(R_TABLE, k * 45 + 22.5);
    return [
      { x1: g[0], y1: g[1], x2: a[0], y2: a[1] },
      { x1: g[0], y1: g[1], x2: b[0], y2: b[1] },
    ];
  }).flat();
</script>

<script lang="ts">
  import { icons } from './icons';
  import { rankMedal, METAL_PALETTES } from './rankMedal';

  // A single rank's medal (Direction B): a struck metal coin — tier band + rim, the rank's embossed
  // journey glyph, and 1–3 sub-level stars on the face (a radiant prismatic apex for the Legend).
  // Self-contained SVG on a 64×64 canvas, scaled to `size`; decorative by default (the rank name
  // always sits beside it), so pass `title` only when the medal must stand alone.
  let { index, size = 44, title }: { index: number; size?: number; title?: string } = $props();

  const spec = $derived(rankMedal(index));
  const pal = $derived(METAL_PALETTES[spec.metal]);
  const isApex = $derived(spec.metal === 'crystal');
  const glyph = $derived(icons[spec.glyph]);

  const uid = nextUid();

  // A five-point star as a polygon `points` string, centred at (cx,cy) with outer radius r.
  function starPoints(cx: number, cy: number, r: number): string {
    let s = '';
    for (let k = 0; k < 5; k++) {
      const ao = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      const ai = ao + Math.PI / 5;
      s += `${cx + r * Math.cos(ao)},${cy + r * Math.sin(ao)} `;
      s += `${cx + r * 0.42 * Math.cos(ai)},${cy + r * 0.42 * Math.sin(ai)} `;
    }
    return s.trim();
  }

  // Sub-level stars, struck on the coin's lower rim (below the disc), so the glyph sits centred on
  // the disc face. A shallow centred row; filled in the light rim tone to read on the dark metal.
  const stars = $derived.by(() => {
    const n = spec.stars;
    if (n <= 0) return [] as string[];
    const gap = 7.5;
    const startX = 32 - ((n - 1) * gap) / 2;
    return Array.from({ length: n }, (_, k) => starPoints(startX + k * gap, 50.5, 2.1));
  });
</script>

<svg
  class="medal"
  class:apex={isApex}
  viewBox="0 0 64 64"
  style:width="{size}px"
  style:height="{size}px"
  role={title ? 'img' : undefined}
  aria-label={title}
  aria-hidden={title ? undefined : 'true'}
>
  <defs>
    <linearGradient id="{uid}-coin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color={pal.hi} />
      <stop offset="1" stop-color={pal.lo} />
    </linearGradient>
    <radialGradient id="{uid}-disc" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color={pal.disc1} />
      <stop offset="1" stop-color={pal.disc2} />
    </radialGradient>
  </defs>

  <!-- The struck coin: tier-metal ring, then a lighter inner disc with a rim highlight. -->
  <circle cx="32" cy="32" r="22" fill="url(#{uid}-coin)" stroke={pal.lo} stroke-width="1.5" />
  <circle cx="32" cy="32" r="16.5" fill="url(#{uid}-disc)" stroke={pal.rim} stroke-width="1" />

  <!-- Crystal apex: a round-brilliant facet ring (octagon table + kite facets) under the crown,
       so the top rung reads as a cut gem. -->
  {#if isApex}
    <g
      class="facets"
      fill="none"
      stroke={pal.ink}
      stroke-width="0.9"
      opacity="0.3"
      stroke-linecap="round"
    >
      <polygon points={FACET_TABLE} />
      {#each FACET_LINES as l, i (i)}
        <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      {/each}
    </g>
  {/if}

  <!-- The rank's journey glyph, embossed in the metal's ink. Registry markup is build-generated
       from Lucide (static, no user input) — {@html} carries no XSS risk here. -->
  <svg
    x="20"
    y="20"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={pal.ink}
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html glyph}
  </svg>

  {#each stars as pts, i (i)}
    <polygon class="star" points={pts} fill={pal.rim} />
  {/each}
</svg>

<style>
  .medal {
    display: block;
    flex: 0 0 auto;
    /* Lift the coin off the surface a touch — it reads as a struck object, not a flat sticker. */
    filter: drop-shadow(0 1px 1px rgb(18 49 48 / 18%));
  }
</style>
