<script module lang="ts">
  // Gradient ids must be unique per instance — several medals can share a page (e.g. a rank chip
  // plus a ladder). A module counter keeps them collision-free without pulling in randomness.
  let uidCounter = 0;
  function nextUid(): string {
    uidCounter += 1;
    return `rm${uidCounter}`;
  }
</script>

<script lang="ts">
  import { icons } from './icons';
  import { rankMedal, METAL_PALETTES } from './rankMedal';

  // A single rank's medal (Direction B): a struck metal coin — tier band + rim, the rank's embossed
  // journey glyph, and 1–3 sub-level stars on the face. Higher rungs catch the light: a periodic
  // reflection sweep whose intensity climbs with the sub-level (`spec.glint`), and an ambient glow
  // on the crowned crystal apex. Self-contained SVG on a 64×64 canvas, scaled to `size`; decorative
  // by default (the rank name always sits beside it), so pass `title` only when it must stand alone.
  let { index, size = 44, title }: { index: number; size?: number; title?: string } = $props();

  const spec = $derived(rankMedal(index));
  const pal = $derived(METAL_PALETTES[spec.metal]);
  // The crowned top rung — the only coin with the prismatic sweep + ambient glow.
  const isApex = $derived(spec.glint === 'prismatic');
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
    {#if spec.glint !== 'none'}
      <!-- Clip the reflection sweep to the coin so it never spills past the rim. -->
      <clipPath id="{uid}-clip"><circle cx="32" cy="32" r="22" /></clipPath>
      <!-- A soft white light-band, feathered at both edges, that sweeps across the coin. -->
      <linearGradient id="{uid}-sheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0" />
        <stop offset="0.5" stop-color="#fff" stop-opacity="0.9" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
    {/if}
  </defs>

  <!-- The struck coin: tier-metal ring, then a lighter inner disc with a rim highlight. -->
  <circle cx="32" cy="32" r="22" fill="url(#{uid}-coin)" stroke={pal.lo} stroke-width="1.5" />
  <circle cx="32" cy="32" r="16.5" fill="url(#{uid}-disc)" stroke={pal.rim} stroke-width="1" />

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

  <!-- Reflection sweep: a light-band clipped to the coin, sweeping across on a loop with a long
       idle between passes. Intensity climbs with the sub-level via the `sheen-*` class. -->
  {#if spec.glint !== 'none'}
    <g class="sheen sheen-{spec.glint}" clip-path="url(#{uid}-clip)">
      <rect class="sheen-bar" x="0" y="6" width="13" height="52" fill="url(#{uid}-sheen)" />
    </g>
  {/if}
</svg>

<style>
  .medal {
    display: block;
    flex: 0 0 auto;
    /* Lift the coin off the surface a touch — it reads as a struck object, not a flat sticker. */
    filter: drop-shadow(0 1px 1px rgb(18 49 48 / 18%));
  }

  /* Reflection sweep. The bar starts left-of-coin and slides across, fading in and back out, then
     rests off-frame for the rest of the cycle — a periodic glint, not a constant shimmer. Higher
     sub-levels use a shorter cycle (glints more often) and a stronger group opacity. */
  .sheen {
    opacity: 0;
  }

  .sheen-bar {
    transform: translateX(-16px);
    animation: rm-sweep 6s linear infinite;
  }

  .sheen-mild {
    opacity: 0.5;
  }

  .sheen-medium {
    opacity: 0.85;
  }
  .sheen-medium .sheen-bar {
    animation-duration: 4.6s;
  }

  /* The crowned crystal apex: the brightest, most frequent sweep, plus an ambient glow that breathes
     around the rim (see .medal.apex below). */
  .sheen-prismatic {
    opacity: 1;
  }
  .sheen-prismatic .sheen-bar {
    animation-duration: 3.4s;
  }

  @keyframes rm-sweep {
    0% {
      transform: translateX(-16px);
      opacity: 0;
    }
    5% {
      opacity: 1;
    }
    22% {
      transform: translateX(62px);
      opacity: 0;
    }
    100% {
      transform: translateX(62px);
      opacity: 0;
    }
  }

  /* Prismatic apex: a soft cyan halo that breathes, layered over the base lift shadow. */
  .medal.apex {
    animation: rm-aura 3.4s ease-in-out infinite;
  }

  @keyframes rm-aura {
    0%,
    100% {
      filter: drop-shadow(0 1px 1px rgb(18 49 48 / 18%)) drop-shadow(0 0 1px rgb(120 220 255 / 0%));
    }
    50% {
      filter: drop-shadow(0 1px 1px rgb(18 49 48 / 18%)) drop-shadow(0 0 6px rgb(120 220 255 / 75%));
    }
  }

  /* Respect the OS reduce-motion setting (the in-app pref is handled app-wide in app.css via the
     `:root[data-reduce-motion] *` rule, which already collapses these animations). */
  @media (prefers-reduced-motion: reduce) {
    .sheen-bar,
    .medal.apex {
      animation: none;
    }
    /* Keep a static hint of shine on the coins that glint, so the prestige still reads at rest. */
    .sheen {
      opacity: 0;
    }
  }
</style>
