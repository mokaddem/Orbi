<script module lang="ts">
  // Per-instance counter so each crest's <linearGradient> / <clipPath> get unique ids (the crest
  // can appear more than once on a screen — entry card, modal, victory bloom). Client-only SPA,
  // so a plain counter is safe (no SSR hydration). Mirrors Mascot.svelte's `nextClipId`.
  let instanceCount = 0;
  function nextId(): string {
    instanceCount += 1;
    return `gm-crest-${instanceCount}`;
  }
</script>

<script lang="ts">
  // The Grandmaster Challenge mark (Phase 45): a teal Orbi globe wearing a gold crown — the crest
  // on the entry card, the offer modal, and the victory bloom. Drawn inline in the app's house
  // style (see Mascot.svelte / the bundled flags: vector, not emoji, crisp on every OS, offline).
  //
  // It carries its *own* dark-teal + metallic-gold palette (it always sits on the dark arena
  // ground), so it is deliberately `currentColor`-independent and purely decorative (`aria-hidden`).
  // Sized via `size` (reused at 46 / 58 / 118 px), scaling from the 0 0 64 64 viewBox.
  let { size = 58 }: { size?: number | string } = $props();

  const dim = $derived(typeof size === 'number' ? `${size}px` : size);
  const uid = nextId();
  const goldId = `${uid}-gold`;
  const clipId = `${uid}-clip`;
</script>

<svg
  class="crest"
  viewBox="0 0 64 64"
  fill="none"
  style:width={dim}
  style:height={dim}
  aria-hidden="true"
>
  <defs>
    <!-- Metallic gold for the crown: sheen top-left → deep bottom-right, matching --gold-metal. -->
    <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffe083" />
      <stop offset="45%" stop-color="#f5c542" />
      <stop offset="100%" stop-color="#d99a1f" />
    </linearGradient>
    <clipPath id={clipId}><circle cx="32" cy="42" r="17.5" /></clipPath>
  </defs>

  <!-- Globe: dark-teal sphere with a bright teal rim, faint graticule + a few land silhouettes,
       all clipped to the sphere so nothing spills past the edge. -->
  <circle cx="32" cy="42" r="17.5" fill="#123f39" stroke="#45c9bd" stroke-width="2" />
  <g clip-path={`url(#${clipId})`}>
    <path
      d="M15 42 Q32 49 49 42"
      fill="none"
      stroke="#45c9bd"
      stroke-opacity="0.28"
      stroke-width="1.2"
    />
    <path
      d="M32 24 Q43 42 32 60"
      fill="none"
      stroke="#45c9bd"
      stroke-opacity="0.22"
      stroke-width="1.2"
    />
    <path
      d="M32 24 Q21 42 32 60"
      fill="none"
      stroke="#45c9bd"
      stroke-opacity="0.22"
      stroke-width="1.2"
    />
    <path
      d="M22 34 C17 35 16 41 21 43 C27 45 33 42 32 37 C31 33 27 33 22 34 Z"
      fill="#45c9bd"
      fill-opacity="0.9"
    />
    <path
      d="M41 44 C37 43 34 47 37 51 C40 55 45 52 45 48 C45 45 43 44 41 44 Z"
      fill="#45c9bd"
      fill-opacity="0.9"
    />
    <path d="M27 52 C24 53 25 57 29 56 C33 55 32 51 27 52 Z" fill="#45c9bd" fill-opacity="0.75" />
  </g>

  <!-- Crown: a three-peak metallic-gold crown resting on the globe's crown, with jewel-balls at
       the peaks and a centre gem on the band. -->
  <path
    d="M16 25 L19 11 L26 19 L32 8 L38 19 L45 11 L48 25 Z"
    fill={`url(#${goldId})`}
    stroke="#a86e08"
    stroke-width="1.1"
    stroke-linejoin="round"
  />
  <rect
    x="15"
    y="24"
    width="34"
    height="6.5"
    rx="2.2"
    fill={`url(#${goldId})`}
    stroke="#a86e08"
    stroke-width="1.1"
  />
  <circle cx="19" cy="11" r="1.9" fill="#ffe9ad" stroke="#a86e08" stroke-width="0.8" />
  <circle cx="32" cy="8" r="2.1" fill="#ffe9ad" stroke="#a86e08" stroke-width="0.8" />
  <circle cx="45" cy="11" r="1.9" fill="#ffe9ad" stroke="#a86e08" stroke-width="0.8" />
  <circle cx="32" cy="27.4" r="2.3" fill="#de6a62" stroke="#7e2b26" stroke-width="0.7" />
</svg>

<style>
  .crest {
    display: block;
    flex: 0 0 auto;
  }
</style>
