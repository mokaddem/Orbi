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
  // The Grandmaster Challenge mark (Phase 45): our Orbi globe mascot — face and all — wearing a
  // gold crown. It's the crest on the entry card, the offer modal, the intro, and the victory
  // bloom. Drawn inline in the app's house style (see Mascot.svelte / the bundled flags: vector,
  // not emoji, crisp on every OS, offline).
  //
  // The whole point is that it reads as *Orbi*, not a bare globe: a serene, closed-eye grin (calm
  // "earned mastery", not giddy), the mascot's warm blush, and its graticule + land silhouettes.
  // It carries its *own* mid-teal + metallic-gold palette (it always sits on the dark arena
  // ground), so it is deliberately `currentColor`-independent and purely decorative (`aria-hidden`).
  // Sized via `size` (reused at 52 / 58 / 92 / 118 px), scaling from the 0 0 64 64 viewBox.
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
    <linearGradient id={goldId} x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#ffe79a" />
      <stop offset="42%" stop-color="#f5c542" />
      <stop offset="100%" stop-color="#d8951c" />
    </linearGradient>
    <clipPath id={clipId}><circle cx="32" cy="43.5" r="17.5" /></clipPath>
  </defs>

  <!-- Globe body: a mid-teal sphere with a bright teal rim, a soft top-left sheen, a faint
       graticule and a couple of land silhouettes — all clipped to the sphere so nothing spills
       past the edge. Sits low in the viewBox to leave headroom for the crown. -->
  <circle cx="32" cy="43.5" r="17.5" fill="#17564e" stroke="#58d6c9" stroke-width="2" />
  <g clip-path={`url(#${clipId})`}>
    <circle cx="26" cy="37" r="9" fill="#ffffff" fill-opacity="0.06" />
    <path
      d="M15 43.5 Q32 50.5 49 43.5"
      fill="none"
      stroke="#58d6c9"
      stroke-opacity="0.24"
      stroke-width="1.1"
    />
    <path
      d="M32 26 Q43 43.5 32 61"
      fill="none"
      stroke="#58d6c9"
      stroke-opacity="0.18"
      stroke-width="1.1"
    />
    <path
      d="M32 26 Q21 43.5 32 61"
      fill="none"
      stroke="#58d6c9"
      stroke-opacity="0.18"
      stroke-width="1.1"
    />
    <path
      d="M19.5 51 C15.5 52 15.5 57 20 57 C24.5 57 24.5 51.5 21.5 51 Z"
      fill="#8ff0e6"
      fill-opacity="0.9"
    />
    <path
      d="M42.5 50.5 C39 50 37 54 40 57 C43 59 46 55.5 45 52.5 C44.4 50.8 43.4 50.5 42.5 50.5 Z"
      fill="#8ff0e6"
      fill-opacity="0.9"
    />
  </g>

  <!-- Orbi's face: a serene closed-eye grin (calm mastery) + the mascot's warm blush. -->
  <path
    d="M24.3 43.4 Q26.5 40.7 28.7 43.4"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.8"
    stroke-linecap="round"
  />
  <path
    d="M35.3 43.4 Q37.5 40.7 39.7 43.4"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.8"
    stroke-linecap="round"
  />
  <path
    d="M27.5 48.5 Q32 52 36.5 48.5"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.8"
    stroke-linecap="round"
  />
  <circle cx="22.8" cy="47.5" r="2.1" fill="#f2a891" opacity="0.72" />
  <circle cx="41.2" cy="47.5" r="2.1" fill="#f2a891" opacity="0.72" />

  <!-- Crown: a three-peak metallic-gold crown seated on the globe's head — a band straddling the
       sphere's top edge, jewel-balls at the peaks, a bright band highlight, and a centre gem. -->
  <path
    d="M16 25 L20.5 12.5 L26 20.5 L32 8.5 L38 20.5 L43.5 12.5 L48 25 Z"
    fill={`url(#${goldId})`}
    stroke="#a86e08"
    stroke-width="1.1"
    stroke-linejoin="round"
  />
  <rect
    x="15.5"
    y="24.5"
    width="33"
    height="6.2"
    rx="2.2"
    fill={`url(#${goldId})`}
    stroke="#a86e08"
    stroke-width="1.1"
  />
  <path
    d="M17 26 H47"
    fill="none"
    stroke="#fff6d8"
    stroke-width="0.9"
    stroke-opacity="0.55"
    stroke-linecap="round"
  />
  <circle cx="20.5" cy="12.5" r="1.85" fill="#ffefbf" stroke="#a86e08" stroke-width="0.7" />
  <circle cx="32" cy="8.5" r="2.05" fill="#ffefbf" stroke="#a86e08" stroke-width="0.7" />
  <circle cx="43.5" cy="12.5" r="1.85" fill="#ffefbf" stroke="#a86e08" stroke-width="0.7" />
  <circle cx="32" cy="27.6" r="2.4" fill="#e2564d" stroke="#7e2b26" stroke-width="0.7" />
  <circle cx="31.3" cy="26.9" r="0.7" fill="#ffd2ce" opacity="0.8" />
</svg>

<style>
  .crest {
    display: block;
    flex: 0 0 auto;
  }
</style>
