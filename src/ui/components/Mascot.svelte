<script module lang="ts">
  // Canonical pose/motion vocabulary lives in the pure domain layer (Phase 33) so the
  // reactive helpers and this component agree on one set of names. Re-exposed here (as local
  // aliases) for the many call-sites and tests that reach for the type through the component;
  // the instance script below reuses these same module-scoped type bindings.
  import type {
    MascotPose as DomainMascotPose,
    MascotMotion as DomainMascotMotion,
  } from '../../domain';
  export type MascotPose = DomainMascotPose;
  export type MascotMotion = DomainMascotMotion;

  // Per-instance counter so each mascot's <clipPath> gets a unique id (multiple mascots can
  // appear on one screen). Client-only SPA, so a simple counter is safe (no SSR hydration).
  let instanceCount = 0;
  function nextClipId(): string {
    instanceCount += 1;
    return `globe-clip-${instanceCount}`;
  }
</script>

<script lang="ts">
  // The globe mascot (Phase 18): one friendly character across a few poses, drawn as inline SVG
  // in the house style (see ModeIcon / the bundled flags — vector, not emoji, crisp on every OS,
  // works offline). Duotone: turquoise land on a sea-tint body, with the line in `currentColor`
  // so it recolours per context. Every fill resolves to a CSS var derived from the app.css
  // palette (Phase 12). Decorative by default (aria-hidden); pass `label` to expose it as a
  // labelled image instead.
  //
  // Phase 33 adds optional motion via `animate` — CSS/SVG transforms only, no library:
  //   idle      gentle breathe + occasional blink (the only looping motion)
  //   bounce-in a one-shot entrance
  //   cheer     a one-shot celebratory bounce + confetti burst (pair with the `cheer` pose)
  //   wiggle    a one-shot proud wiggle (streak/achievement beats)
  // Every animation is disabled under `prefers-reduced-motion` (and the in-app "reduce
  // animation" toggle), falling back to the exact static pose — motion is purely additive.
  let {
    pose = 'wave',
    size = 96,
    label,
    animate = 'none',
  }: {
    pose?: MascotPose;
    size?: number | string;
    label?: string;
    animate?: MascotMotion;
  } = $props();

  const dim = $derived(typeof size === 'number' ? `${size}px` : size);
  const clipId = nextClipId();

  // The idle loop is the only forever-running animation, so pause it while off-screen (per the
  // phase's perf note). One-shot motions don't need observing. `visible` starts true so a
  // mascot painted in-view animates immediately, before the observer's first callback.
  let el = $state<SVGSVGElement | null>(null);
  let visible = $state(true);

  $effect(() => {
    if (animate !== 'idle' || !el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  });
</script>

<svg
  bind:this={el}
  class="mascot"
  class:anim-idle={animate === 'idle'}
  class:anim-bounce-in={animate === 'bounce-in'}
  class:anim-cheer={animate === 'cheer'}
  class:anim-wiggle={animate === 'wiggle'}
  class:paused={animate === 'idle' && !visible}
  viewBox="0 0 120 120"
  fill="none"
  style:width={dim}
  style:height={dim}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <!-- Shared globe base: soft ground shadow, the sphere, then subtle grid + land silhouettes
       clipped to the sphere so nothing spills past the rim. -->
  <ellipse cx="60" cy="99" rx="24" ry="4.5" fill="var(--m-shadow)" />
  <circle cx="60" cy="56" r="32" fill="var(--m-sea)" stroke="currentColor" stroke-width="2.5" />
  <clipPath id={clipId}><circle cx="60" cy="56" r="32" /></clipPath>
  <g clip-path={`url(#${clipId})`}>
    <path
      d="M28 58 Q60 66 92 58"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.12"
      stroke-width="1.4"
    />
    <path
      d="M60 24 Q79 56 60 88"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.1"
      stroke-width="1.4"
    />
    <path
      d="M60 24 Q41 56 60 88"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.1"
      stroke-width="1.4"
    />
    <path
      d="M44 31 C37 32 35 40 41 43 C48 46 57 43 58 37 C59 31 51 30 44 31 Z"
      fill="var(--m-land)"
    />
    <path
      d="M29 52 C25 54 26 62 32 62 C38 62 40 54 36 50 C34 48 31 50 29 52 Z"
      fill="var(--m-land)"
    />
    <path
      d="M84 47 C79 45 75 50 78 55 C81 61 88 58 88 52 C88 48 87 48 84 47 Z"
      fill="var(--m-land)"
    />
    <path d="M52 76 C48 77 48 83 53 83 C58 83 59 77 55 76 Z" fill="var(--m-land)" />
  </g>

  {#if pose === 'wave'}
    <path
      d="M31 66 Q26 71 27 77"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M89 60 Q97 55 96 46"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="96" cy="44" r="3.4" fill="currentColor" />
    <g class="eyes">
      <circle cx="51" cy="54" r="3" fill="currentColor" />
      <circle cx="69" cy="54" r="3" fill="currentColor" />
      <circle cx="52.1" cy="52.9" r="0.9" fill="#fff" />
      <circle cx="70.1" cy="52.9" r="0.9" fill="#fff" />
    </g>
    <path
      d="M52 63 Q60 70 68 63"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'celebrate'}
    <path
      transform="translate(22 30)"
      d="M0 -4 Q0.64 -0.64 4 0 Q0.64 0.64 0 4 Q-0.64 0.64 -4 0 Q-0.64 -0.64 0 -4 Z"
      fill="var(--m-land)"
    />
    <path
      transform="translate(99 36)"
      d="M0 -5 Q0.8 -0.8 5 0 Q0.8 0.8 0 5 Q-0.8 0.8 -5 0 Q-0.8 -0.8 0 -5 Z"
      fill="var(--m-land)"
    />
    <path
      transform="translate(84 15)"
      d="M0 -3.4 Q0.544 -0.544 3.4 0 Q0.544 0.544 0 3.4 Q-0.544 0.544 -3.4 0 Q-0.544 -0.544 0 -3.4 Z"
      fill="var(--m-land)"
    />
    <path
      transform="translate(34 15)"
      d="M0 -3 Q0.48 -0.48 3 0 Q0.48 0.48 0 3 Q-0.48 0.48 -3 0 Q-0.48 -0.48 0 -3 Z"
      fill="var(--m-land)"
    />
    <path
      d="M31 62 Q23 55 25 46"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="25" cy="44" r="3.4" fill="currentColor" />
    <path
      d="M89 62 Q97 55 95 46"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="95" cy="44" r="3.4" fill="currentColor" />
    <g class="eyes">
      <circle cx="51" cy="54" r="3" fill="currentColor" />
      <circle cx="69" cy="54" r="3" fill="currentColor" />
      <circle cx="52.1" cy="52.9" r="0.9" fill="#fff" />
      <circle cx="70.1" cy="52.9" r="0.9" fill="#fff" />
    </g>
    <path d="M51 62 Q60 73 69 62 Q60 66 51 62 Z" fill="currentColor" />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'relaxed'}
    <path
      d="M31 66 Q27 71 29 76"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M89 66 Q93 71 91 76"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M48 54 Q51 51.5 54 54"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M66 54 Q69 51.5 72 54"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M53 63 Q60 68 67 63"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'sleepy'}
    <path
      d="M31 66 Q27 71 29 76"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M89 66 Q93 71 91 76"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M48 54 Q51 51.5 54 54"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M66 54 Q69 51.5 72 54"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M55 64 Q60 67 65 64"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <text x="85" y="31" font-size="10" fill="var(--m-land)" font-weight="700">z</text>
    <text x="93" y="22" font-size="13" fill="var(--m-land)" font-weight="700">Z</text>
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'thinking'}
    <text x="88" y="32" font-size="17" fill="var(--m-land)" font-weight="800">?</text>
    <path
      d="M31 66 Q26 71 27 77"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M89 63 Q94 60 93 54"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="92.5" cy="52" r="3.4" fill="currentColor" />
    <path
      d="M46 47 Q51 44.5 56 47"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <g class="eyes">
      <circle cx="51" cy="54" r="3" fill="currentColor" />
      <circle cx="69" cy="54" r="3" fill="currentColor" />
      <circle cx="52.1" cy="52.9" r="0.9" fill="#fff" />
      <circle cx="70.1" cy="52.9" r="0.9" fill="#fff" />
    </g>
    <circle cx="61" cy="66" r="2.4" fill="none" stroke="currentColor" stroke-width="2" />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'proud'}
    <!-- proud: a little star crowning the head, hands set confidently, a warm broad smile -->
    <path
      transform="translate(60 16)"
      d="M0 -7 Q1.2 -1.2 7 0 Q1.2 1.2 0 7 Q-1.2 1.2 -7 0 Q-1.2 -1.2 0 -7 Z"
      fill="var(--m-land)"
    />
    <path
      d="M31 64 Q25 68 27 74"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="27" cy="74" r="3.2" fill="currentColor" />
    <path
      d="M89 64 Q95 68 93 74"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="93" cy="74" r="3.2" fill="currentColor" />
    <g class="eyes">
      <circle cx="51" cy="54" r="3" fill="currentColor" />
      <circle cx="69" cy="54" r="3" fill="currentColor" />
      <circle cx="52.1" cy="52.9" r="0.9" fill="#fff" />
      <circle cx="70.1" cy="52.9" r="0.9" fill="#fff" />
    </g>
    <path
      d="M51 62 Q60 71 69 62"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
    />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'encouraging'}
    <!-- encouraging: a raised thumbs-up on one side, kind closed-eye smile, warm and never mocking -->
    <path
      d="M31 66 Q27 71 29 76"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M89 63 Q95 57 94 50"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="94.5" cy="48" r="4" fill="currentColor" />
    <path
      d="M92 46 Q91 41 94 40"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
    />
    <path
      d="M48 54 Q51 51.5 54 54"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M66 54 Q69 51.5 72 54"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M52 63 Q60 69 68 63"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
  {:else if pose === 'cheer'}
    <!-- cheer: both arms thrown up, open beaming smile, a burst of confetti (animated on
         `animate="cheer"`, still a finished frame otherwise) -->
    <path
      class="confetti"
      style="animation-delay: 0ms"
      transform="translate(22 28)"
      d="M0 -4 Q0.64 -0.64 4 0 Q0.64 0.64 0 4 Q-0.64 0.64 -4 0 Q-0.64 -0.64 0 -4 Z"
      fill="var(--m-land)"
    />
    <path
      class="confetti"
      style="animation-delay: 60ms"
      transform="translate(99 33)"
      d="M0 -5 Q0.8 -0.8 5 0 Q0.8 0.8 0 5 Q-0.8 0.8 -5 0 Q-0.8 -0.8 0 -5 Z"
      fill="var(--m-blush)"
    />
    <path
      class="confetti"
      style="animation-delay: 120ms"
      transform="translate(84 13)"
      d="M0 -3.4 Q0.544 -0.544 3.4 0 Q0.544 0.544 0 3.4 Q-0.544 0.544 -3.4 0 Q-0.544 -0.544 0 -3.4 Z"
      fill="var(--m-land)"
    />
    <path
      class="confetti"
      style="animation-delay: 90ms"
      transform="translate(34 12)"
      d="M0 -3 Q0.48 -0.48 3 0 Q0.48 0.48 0 3 Q-0.48 0.48 -3 0 Q-0.48 -0.48 0 -3 Z"
      fill="var(--m-blush)"
    />
    <circle
      class="confetti"
      style="animation-delay: 150ms"
      cx="60"
      cy="10"
      r="2.6"
      fill="var(--m-land)"
    />
    <circle
      class="confetti"
      style="animation-delay: 40ms"
      cx="14"
      cy="44"
      r="2.2"
      fill="var(--m-blush)"
    />
    <path
      d="M31 62 Q23 53 26 44"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="26" cy="42" r="3.4" fill="currentColor" />
    <path
      d="M89 62 Q97 53 94 44"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <circle cx="94" cy="42" r="3.4" fill="currentColor" />
    <g class="eyes">
      <circle cx="51" cy="53" r="3.1" fill="currentColor" />
      <circle cx="69" cy="53" r="3.1" fill="currentColor" />
      <circle cx="52.1" cy="51.9" r="0.9" fill="#fff" />
      <circle cx="70.1" cy="51.9" r="0.9" fill="#fff" />
    </g>
    <path d="M50 62 Q60 75 70 62 Q60 67 50 62 Z" fill="currentColor" />
    <circle cx="43" cy="61" r="3.2" fill="var(--m-blush)" opacity="0.9" />
    <circle cx="77" cy="61" r="3.2" fill="var(--m-blush)" opacity="0.9" />
  {:else}
    <!-- daily: holding up a little calendar -->
    <path
      d="M31 66 Q26 71 27 77"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M89 61 Q93 57 91 53"
      fill="none"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <g class="eyes">
      <circle cx="51" cy="54" r="3" fill="currentColor" />
      <circle cx="69" cy="54" r="3" fill="currentColor" />
      <circle cx="52.1" cy="52.9" r="0.9" fill="#fff" />
      <circle cx="70.1" cy="52.9" r="0.9" fill="#fff" />
    </g>
    <path
      d="M52 63 Q60 70 68 63"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <circle cx="44" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <circle cx="76" cy="61" r="3" fill="var(--m-blush)" opacity="0.85" />
    <path d="M91 31 v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <path
      d="M104 31 v4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <rect
      x="85"
      y="34"
      width="25"
      height="21"
      rx="3"
      fill="#fff"
      stroke="currentColor"
      stroke-width="2"
    />
    <path d="M85 41 V37 Q85 34 88 34 H107 Q110 34 110 37 V41 Z" fill="var(--m-land)" />
    <path
      d="M91 47 l3.2 3.2 6 -6"
      fill="none"
      stroke="var(--m-land)"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/if}
</svg>

<style>
  .mascot {
    display: block;
    flex: 0 0 auto;
    /* Mascot palette, derived from the app.css tokens (Phase 12 Playful + turquoise).
       Line colour is inherited `currentColor`, so the mascot tracks its context. */
    --m-sea: var(--color-accent-weak);
    --m-land: var(--color-accent);
    --m-blush: #f2a891;
    --m-shadow: rgb(42 35 32 / 8%);
  }

  /* Motion (Phase 33). transform/opacity only — no layout shift, no per-frame JS. Each pose's
     resting state is the finished frame, so when no animation runs (reduced motion / toggle /
     one-shot completed) the mascot simply renders as the static pose. */
  .anim-idle {
    transform-origin: 50% 90%;
    animation: mascot-breathe 3.8s ease-in-out infinite;
  }

  .anim-idle .eyes {
    transform-box: fill-box;
    transform-origin: center;
    animation: mascot-blink 4.6s ease-in-out infinite;
  }

  /* Off-screen: halt the only looping animation until it scrolls back into view. */
  .anim-idle.paused,
  .anim-idle.paused .eyes {
    animation-play-state: paused;
  }

  .anim-bounce-in {
    animation: mascot-bounce-in 0.45s ease-out both;
  }

  .anim-cheer {
    transform-origin: 50% 90%;
    animation: mascot-cheer 0.7s ease both;
  }

  .anim-cheer .confetti {
    transform-box: fill-box;
    transform-origin: center;
    animation: mascot-confetti 0.7s ease-out both;
  }

  .anim-wiggle {
    transform-origin: 50% 90%;
    animation: mascot-wiggle 0.6s ease both;
  }

  @keyframes mascot-breathe {
    0%,
    100% {
      transform: translateY(0) scale(1);
    }
    50% {
      transform: translateY(-2px) scale(1.015);
    }
  }

  @keyframes mascot-blink {
    0%,
    92%,
    100% {
      transform: scaleY(1);
    }
    96% {
      transform: scaleY(0.1);
    }
  }

  @keyframes mascot-bounce-in {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.9);
    }
    60% {
      opacity: 1;
      transform: translateY(-3px) scale(1.03);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes mascot-cheer {
    0% {
      transform: translateY(0) scale(1);
    }
    25% {
      transform: translateY(-8px) scale(1.05);
    }
    45% {
      transform: translateY(0) scale(0.98);
    }
    65% {
      transform: translateY(-4px) scale(1.02);
    }
    100% {
      transform: translateY(0) scale(1);
    }
  }

  @keyframes mascot-wiggle {
    0%,
    100% {
      transform: rotate(0) scale(1);
    }
    20% {
      transform: rotate(-6deg) scale(1.03);
    }
    50% {
      transform: rotate(5deg) scale(1.05);
    }
    80% {
      transform: rotate(-3deg) scale(1.02);
    }
  }

  @keyframes mascot-confetti {
    0% {
      opacity: 0;
      transform: translateY(6px) scale(0.3);
    }
    35% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: translateY(-4px) scale(1);
    }
  }

  /* Reduced motion is a hard requirement: every mascot animation is dropped and the character
     renders exactly as its static pose (resting states are already the finished frames). The
     in-app "reduce animation" toggle is handled app-wide in app.css. */
  @media (prefers-reduced-motion: reduce) {
    .mascot,
    .mascot .eyes,
    .mascot .confetti {
      animation: none !important;
    }
  }
</style>
