<script module lang="ts">
  // Gradient ids must be unique per instance — several medals can share a page (e.g. a rank chip
  // plus a ladder). A module counter keeps them collision-free without pulling in randomness.
  let uidCounter = 0;
  function nextUid(): string {
    uidCounter += 1;
    return `rm${uidCounter}`;
  }

  // Sparkle positions (gold band): a few off-beat twinkle points scattered over the coin. Percentages
  // are within the clipped coin window; staggered delays so they never all fire at once.
  const SPARKS = [
    { top: '12%', left: '18%', delay: '0s' },
    { top: '68%', left: '26%', delay: '0.5s' },
    { top: '24%', left: '70%', delay: '1s' },
    { top: '62%', left: '66%', delay: '1.5s' },
  ];
</script>

<script lang="ts">
  import { icons } from './icons';
  import { rankMedal, METAL_PALETTES } from './rankMedal';

  // A single rank's medal (Direction B): a struck metal coin — tier band + rim, the rank's embossed
  // journey glyph, and 1–3 sub-level stars on the face. Higher rungs catch the light through a
  // per-band motion (owner-picked): a plain `sweep` for bronze/silver, `sparkle` for gold, `shimmer`
  // for platinum, and a drifting `aurora` under a sweep for the crystal band — intensity ramping with
  // the sub-level. The struck coin is a self-contained SVG on a 64×64 canvas; the motion rides in
  // HTML overlay layers over it, all clipped to the coin. Decorative by default (the rank name always
  // sits beside it), so pass `title` only when the medal must stand alone.
  let { index, size = 44, title }: { index: number; size?: number; title?: string } = $props();

  const spec = $derived(rankMedal(index));
  const pal = $derived(METAL_PALETTES[spec.metal]);
  const glyph = $derived(icons[spec.glyph]);
  const fx = $derived(new Set(spec.effects));

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

<span
  class="rank-medal i-{spec.intensity}"
  style:width="{size}px"
  style:height="{size}px"
  style:--sz={size}
  role={title ? 'img' : undefined}
  aria-label={title}
  aria-hidden={title ? undefined : 'true'}
>
  <svg class="medal" viewBox="0 0 64 64" aria-hidden="true">
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

  <!-- Motion layers, clipped to the coin. Aurora sits under the sweep; sparkles fall over. -->
  {#if fx.has('aurora')}
    <span class="fx clip"><span class="aurora"></span></span>
  {/if}
  {#if fx.has('sweep')}
    <span class="fx clip"><span class="sweep"></span></span>
  {/if}
  {#if fx.has('shimmer')}
    <span class="fx clip"><span class="shimmer"></span></span>
  {/if}
  {#if fx.has('sparkle')}
    <span class="fx">
      {#each SPARKS as s, i (i)}
        <span class="spk" style="top:{s.top};left:{s.left};animation-delay:{s.delay}"></span>
      {/each}
    </span>
  {/if}
</span>

<style>
  /* Intensity dials, set on the wrapper and read by every effect: how bright, and how often. */
  .rank-medal {
    position: relative;
    display: inline-block;
    flex: 0 0 auto;
    vertical-align: middle;
    line-height: 0;
    --fx-op: 0.85;
    --fx-dur: 3.4s;
  }
  .rank-medal.i-mild {
    --fx-op: 0.5;
    --fx-dur: 4.4s;
  }
  .rank-medal.i-medium {
    --fx-op: 0.85;
    --fx-dur: 3.4s;
  }
  .rank-medal.i-strong {
    --fx-op: 1;
    --fx-dur: 2.5s;
  }

  .medal {
    display: block;
    width: 100%;
    height: 100%;
    /* Lift the coin off the surface a touch — it reads as a struck object, not a flat sticker. */
    filter: drop-shadow(0 1px 1px rgb(18 49 48 / 18%));
  }

  /* Effect windows: centred on the coin (r22 → 68.75% of the box). `.clip` masks to the rim. */
  .fx {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 68.75%;
    height: 68.75%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2;
  }
  .fx.clip {
    border-radius: 50%;
    overflow: hidden;
  }

  /* SWEEP — a soft light-band crosses, fades out, then rests off-frame for the rest of the cycle. */
  .sweep {
    position: absolute;
    inset: 0;
  }
  .sweep::before {
    content: '';
    position: absolute;
    top: -20%;
    left: -30%;
    width: 26%;
    height: 140%;
    background: linear-gradient(90deg, transparent, #fff, transparent);
    transform: translateX(-60%) rotate(8deg);
    animation: rm-sweep var(--fx-dur) linear infinite;
  }
  @keyframes rm-sweep {
    0% {
      transform: translateX(-60%) rotate(8deg);
      opacity: 0;
    }
    8% {
      opacity: var(--fx-op);
    }
    34% {
      transform: translateX(300%) rotate(8deg);
      opacity: 0;
    }
    100% {
      transform: translateX(300%) rotate(8deg);
      opacity: 0;
    }
  }

  /* SHIMMER — a continuous soft sheen drifting across, no idle gap (platinum). */
  .shimmer {
    position: absolute;
    inset: 0;
  }
  .shimmer::before {
    content: '';
    position: absolute;
    top: -20%;
    left: -60%;
    width: 60%;
    height: 140%;
    background: linear-gradient(
      90deg,
      transparent,
      rgb(255 255 255 / calc(var(--fx-op) * 0.85)),
      transparent
    );
    transform: translateX(0) rotate(12deg);
    animation: rm-shimmer calc(var(--fx-dur) * 1.15) linear infinite;
  }
  @keyframes rm-shimmer {
    0% {
      transform: translateX(0) rotate(12deg);
    }
    100% {
      transform: translateX(300%) rotate(12deg);
    }
  }

  /* SPARKLE — four-point stars twinkle off-beat at the coin's edge (gold). */
  .spk {
    position: absolute;
    width: 26%;
    height: 26%;
    background: radial-gradient(closest-side, #fff, rgb(255 255 255 / 50%) 30%, transparent 70%);
    opacity: 0;
    transform: scale(0.2);
    animation: rm-twinkle calc(var(--fx-dur) * 0.72) ease-in-out infinite;
  }
  .spk::before,
  .spk::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 44%, #fff 50%, transparent 56%);
  }
  .spk::after {
    transform: rotate(90deg);
  }
  @keyframes rm-twinkle {
    0%,
    100% {
      opacity: 0;
      transform: scale(0.2);
    }
    50% {
      opacity: var(--fx-op);
      transform: scale(1);
    }
  }

  /* AURORA — cyan/violet/mint light drifts under the surface (crystal), screen-blended over the coin. */
  .aurora {
    position: absolute;
    inset: -25%;
    background:
      radial-gradient(35% 45% at 30% 35%, rgb(127 214 242 / 90%), transparent 60%),
      radial-gradient(40% 50% at 70% 65%, rgb(168 132 255 / 75%), transparent 60%),
      radial-gradient(45% 40% at 55% 50%, rgb(120 255 214 / 60%), transparent 60%);
    filter: blur(calc(var(--sz) * 0.045px));
    mix-blend-mode: screen;
    opacity: calc(var(--fx-op) * 0.8);
    animation: rm-aurora calc(var(--fx-dur) * 1.9) ease-in-out infinite alternate;
  }
  @keyframes rm-aurora {
    0% {
      transform: translate(-6%, -4%) rotate(-8deg) scale(1.05);
    }
    100% {
      transform: translate(6%, 4%) rotate(10deg) scale(1.15);
    }
  }

  /* Respect the OS reduce-motion setting (the in-app pref is handled app-wide in app.css via the
     `:root[data-reduce-motion] *` rule, which already collapses these animations). Freeze the motion
     and hide the moving highlights; the aurora stays as a soft static tint. */
  @media (prefers-reduced-motion: reduce) {
    .sweep::before,
    .shimmer::before,
    .spk {
      animation: none;
      opacity: 0;
    }
    .aurora {
      animation: none;
    }
  }
</style>
