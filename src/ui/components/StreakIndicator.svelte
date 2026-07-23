<script lang="ts">
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import { dailyFlameSpec } from '../dailyStreak';
  import type { StreakInfo } from '../../domain';

  // Compact daily-streak strip (Phase 15). Presentational — given the computed StreakInfo it shows
  // a flame + the run length and today's status ("played today ✓" vs a nudge to keep it going).
  //
  // The flame *grows with the run* ("Emberfall"): `dailyFlameSpec` maps the streak length onto a
  // milestone ladder (3d, 1wk, 2wk, then 1/2/3/6 months, then a year), heating the flame up the
  // teal→gold→coral ramp and thickening a shower of rising embers as the streak climbs. The flame is
  // only "lit" while a streak is active; its idle pulse and the embers are dropped under
  // prefers-reduced-motion (the static heat/scale/glow still convey the escalation).
  let { streak }: { streak: StreakInfo } = $props();

  const active = $derived(streak.current > 0);
  const spec = $derived(dailyFlameSpec(streak.current));
  const status = $derived(
    streak.playedToday
      ? $t('home.streak.playedToday')
      : active
        ? $t('home.streak.keepGoing')
        : $t('home.streak.start'),
  );

  // Rising embers, one per `spec.embers`, with jitter and a slight upward bias (fire rises) — the
  // same recipe idiom as StreakBurst. Regenerated when the tier's ember count changes; each ember
  // loops its own staggered CSS animation. A higher tier widens the spread and lifts the reach.
  type Ember = { tx: number; ty: number; sz: number; dur: number; delay: number };
  const embers: Ember[] = $derived.by(() => {
    const n = spec.embers;
    const tier = spec.tier;
    return Array.from({ length: n }, (_, i) => ({
      tx: Math.round((Math.random() * 2 - 1) * (5 + tier)),
      ty: -(16 + tier * 2 + Math.round(Math.random() * 10)),
      sz: 2 + Math.round(Math.random() * 2) + (tier >= 6 ? 1 : 0),
      dur: Math.max(900, 1300 + Math.round(Math.random() * 700) - tier * 40),
      delay: Math.round((i / Math.max(1, n)) * 1400 + Math.random() * 220),
    }));
  });
</script>

<div class="streak" class:active data-testid="streak-indicator">
  <span
    class="flame"
    class:lit={active}
    aria-hidden="true"
    style={active
      ? `--heat:${spec.heat}; --glow:${spec.glow}px; --scale:${spec.scale}; --speed:${spec.speedMs}ms`
      : undefined}
  >
    <span class="glyph"><Icon name="flame" size="1.4rem" /></span>
    {#if active && embers.length > 0}
      <span class="embers" aria-hidden="true">
        {#each embers as e, i (i)}
          <i
            class="ember"
            style="--tx:{e.tx}px; --ty:{e.ty}px; --sz:{e.sz}px; --dur:{e.dur}ms; --delay:{e.delay}ms"
          ></i>
        {/each}
      </span>
    {/if}
  </span>
  <div class="text">
    {#if active}
      <span class="count">{$t('home.streak.days', { count: streak.current })}</span>
    {/if}
    <span class="status" class:only={!active}>{status}</span>
  </div>
</div>

<style>
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.85rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: 999px;
    box-shadow: var(--shadow-card);
  }

  .streak.active {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
  }

  .flame {
    position: relative;
    display: inline-flex;
    line-height: 1;
    color: var(--color-muted);
    opacity: 0.6;
  }

  /* The lit flame heats up with the run: colour, glow, swell and pulse cadence all come from
     dailyFlameSpec's per-tier ramp (Phase 15 → Emberfall). It's a decorative, aria-hidden glyph,
     so the warm colour never carries text contrast. */
  .flame.lit {
    color: var(--heat, var(--color-sun));
    opacity: 1;
  }

  .glyph {
    display: inline-flex;
    transform-origin: 50% 62%;
  }

  .flame.lit .glyph {
    filter: drop-shadow(0 0 var(--glow, 0) var(--heat, var(--color-sun)));
    animation: flame-pulse var(--speed, 1800ms) ease-in-out infinite;
  }

  @keyframes flame-pulse {
    0%,
    100% {
      transform: scale(var(--scale, 1));
    }
    50% {
      transform: scale(calc(var(--scale, 1) * 1.12));
    }
  }

  /* Ember layer: a zero-size anchor at the flame's base; each ember rises and fades on its own loop.
     Sits over the glyph but is purely decorative and doesn't affect the pill's layout. */
  .embers {
    position: absolute;
    left: 50%;
    bottom: 18%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .ember {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--sz, 3px);
    height: var(--sz, 3px);
    border-radius: 999px;
    background: var(--heat, var(--color-sun));
    box-shadow: 0 0 4px var(--heat, var(--color-sun));
    opacity: 0;
    will-change: transform, opacity;
    animation: ember-rise var(--dur, 1500ms) ease-in var(--delay, 0ms) infinite;
  }

  @keyframes ember-rise {
    0% {
      transform: translate(-50%, 0) scale(0.3);
      opacity: 0;
    }
    15% {
      opacity: 1;
    }
    70% {
      opacity: 0.8;
    }
    100% {
      transform: translate(calc(-50% + var(--tx, 0)), var(--ty, -24px)) scale(1);
      opacity: 0;
    }
  }

  .text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  .count {
    font-weight: 800;
    font-size: 0.95rem;
  }

  .status {
    font-size: 0.78rem;
    color: var(--color-muted);
  }

  /* When there is no active streak, the single line reads as the primary label. */
  .status.only {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text);
  }

  /* Reduced motion: drop the idle pulse and hide the embers (both are ambient loops). The static
     heat colour, swell and glow remain, so the escalation still reads without any motion. */
  @media (prefers-reduced-motion: reduce) {
    .flame.lit .glyph {
      animation: none;
    }
    .embers {
      display: none;
    }
  }
</style>
