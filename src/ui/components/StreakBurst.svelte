<script lang="ts">
  // Milestone celebration burst (Phase 42) — the particle half of the escalating streak reward.
  // Given a milestone `tier` and the viewport-space centre of the streak flame (`x`, `y`), it
  // radiates sparks and shockwave rings, blooms an aura and (at the peak) flashes the whole screen,
  // every knob scaled by `streakBurstSpec(tier)` so the picture grows in step with the jingle.
  //
  // Rendered `position: fixed` and anchored to the measured flame centre so the burst can spill past
  // the play view's scroll container (which clips both axes) without being cut off. It's mounted
  // inside a `{#key}` block in Play.svelte, so a fresh instance is created on every milestone and the
  // one-shot CSS animations replay from the top; nothing loops. Purely decorative (aria-hidden), and
  // it's simply not mounted under reduced motion — the caller gates on the same preference the rest
  // of the app honours, so there are no idle animations to suppress here.
  import { streakBurstSpec } from '../streak';

  let { tier, x, y }: { tier: number; x: number; y: number } = $props();

  // The tier is fixed for this instance — Play.svelte remounts the component (via `{#key}`) on each
  // milestone rather than mutating props — so the spec and the randomised particle sets are derived
  // once per mount and stay put for its lifetime.
  const spec = $derived(streakBurstSpec(tier));

  // Sparks: an even fan with jitter and a slight upward bias (fire rises). Distance and count both
  // grow with the tier, so higher milestones throw a denser, wider burst.
  type Spark = { dx: number; dy: number; sz: number; dur: number; delay: number; hot: boolean };
  const sparks: Spark[] = $derived.by(() =>
    Array.from({ length: spec.sparks }, (_, i) => {
      const n = spec.sparks;
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const dist = 40 + spec.tier * 12 + Math.random() * (30 + spec.tier * 8);
      return {
        dx: Math.round(Math.cos(ang) * dist),
        dy: Math.round(Math.sin(ang) * dist - 10),
        sz: 4 + Math.round(Math.random() * (3 + spec.tier)),
        dur: Math.round(560 + Math.random() * (300 + spec.tier * 40)),
        delay: Math.round(Math.random() * 60),
        // From the coral tiers up, seed a few white-hot sparks for that "hottest of the flame" read.
        hot: spec.tier >= 6 && i % 3 === 0,
      };
    }),
  );

  // Shockwave rings — a bigger reach and a fatter stroke at higher tiers; the second ring (tier 6+)
  // chases the first.
  type Ring = { end: number; delay: number; bw: number; dur: number };
  const rings: Ring[] = $derived(
    Array.from({ length: spec.rings }, (_, i) => ({
      end: 2.2 + spec.tier * 0.32,
      delay: i * 130,
      bw: 2 + Math.min(3, spec.tier - 1),
      dur: 640 + spec.tier * 30,
    })),
  );

  const auraSize = $derived(120 + spec.tier * 14);

  // Peak only (tier 8): a fan of rays fired out with the full-screen flash.
  type Ray = { ang: number; len: number };
  const RAY_COUNT = 14;
  const rays: Ray[] = $derived(
    spec.screenFlash
      ? Array.from({ length: RAY_COUNT }, (_, i) => ({
          ang: Math.round((360 / RAY_COUNT) * i + Math.random() * 10),
          len: Math.round(90 + Math.random() * 70),
        }))
      : [],
  );
</script>

<!-- The peak's full-screen flash needs full-viewport size, so it sits outside the 0×0 anchor box. -->
{#if spec.screenFlash}
  <div
    class="screenflash"
    style="--px:{x}px; --py:{y}px; --heat:{spec.heat}"
    aria-hidden="true"
  ></div>
{/if}

<!-- A zero-size anchor pinned to the flame centre; every particle radiates from its origin. -->
<div class="burst" style="--x:{x}px; --y:{y}px; --heat:{spec.heat}" aria-hidden="true">
  {#each sparks as s, i (i)}
    <i
      class="spark"
      style="--dx:{s.dx}px; --dy:{s.dy}px; --sz:{s.sz}px; --dur:{s.dur}ms; --delay:{s.delay}ms; background:{s.hot
        ? '#fff6ec'
        : spec.heat}"
    ></i>
  {/each}

  {#each rings as r, i (i)}
    <i
      class="ring"
      style="--end:{r.end}; --bw:{r.bw}px; --dur:{r.dur}ms; animation-delay:{r.delay}ms"
    ></i>
  {/each}

  {#if spec.aura}
    <i class="aura" style="--r:{auraSize}px"></i>
  {/if}

  {#each rays as r, i (i)}
    <i class="ray" style="--ang:{r.ang}deg; --len:{r.len}px"></i>
  {/each}
</div>

<style>
  .burst {
    position: fixed;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    transform: translate(var(--x), var(--y));
    color: var(--heat);
    pointer-events: none;
    z-index: 60;
  }

  .spark,
  .ring,
  .aura,
  .ray {
    position: absolute;
    left: 0;
    top: 0;
    will-change: transform, opacity;
  }

  .spark {
    width: var(--sz);
    height: var(--sz);
    border-radius: 999px;
    animation: spark-fly var(--dur) cubic-bezier(0.15, 0.7, 0.25, 1) var(--delay) both;
  }
  @keyframes spark-fly {
    from {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    to {
      transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2);
      opacity: 0;
    }
  }

  .ring {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: var(--bw) solid currentColor;
    animation: ring-expand var(--dur) cubic-bezier(0.15, 0.6, 0.25, 1) both;
  }
  @keyframes ring-expand {
    from {
      transform: translate(-50%, -50%) scale(0.4);
      opacity: 0.85;
    }
    to {
      transform: translate(-50%, -50%) scale(var(--end));
      opacity: 0;
    }
  }

  .aura {
    width: var(--r);
    height: var(--r);
    border-radius: 999px;
    background: radial-gradient(circle, var(--heat) 0%, transparent 68%);
    animation: aura-bloom 820ms ease-out both;
  }
  @keyframes aura-bloom {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }
    35% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.55;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.15);
      opacity: 0;
    }
  }

  .ray {
    height: 3px;
    width: var(--len);
    transform-origin: 0 50%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--heat), transparent);
    animation: ray-shoot 620ms cubic-bezier(0.1, 0.8, 0.2, 1) both;
  }
  @keyframes ray-shoot {
    from {
      transform: rotate(var(--ang)) scaleX(0.1);
      opacity: 0.95;
    }
    to {
      transform: rotate(var(--ang)) scaleX(1.4);
      opacity: 0;
    }
  }

  .screenflash {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 55;
    background: radial-gradient(circle at var(--px) var(--py), transparent 35%, var(--heat) 100%);
    animation: screen-flash 640ms ease-out both;
  }
  @keyframes screen-flash {
    0% {
      opacity: 0;
    }
    18% {
      opacity: 0.28;
    }
    100% {
      opacity: 0;
    }
  }

  /* Reduced motion: the burst isn't mounted at all in that case (Play.svelte gates it), but guard
     here too so the component is safe to render regardless of how it's used. */
  @media (prefers-reduced-motion: reduce) {
    .spark,
    .ring,
    .aura,
    .ray,
    .screenflash {
      animation: none;
      opacity: 0;
    }
  }
</style>
