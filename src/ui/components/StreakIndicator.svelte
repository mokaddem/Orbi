<script lang="ts">
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import type { StreakInfo } from '../../domain';

  // Compact daily-streak strip (Phase 15). Presentational — given the computed StreakInfo
  // it shows a flame + the run length and today's status ("played today ✓" vs a nudge to
  // keep it going). The flame is "lit" only while a streak is active; its idle pulse is
  // dropped under prefers-reduced-motion.
  let { streak }: { streak: StreakInfo } = $props();

  const active = $derived(streak.current > 0);
  const status = $derived(
    streak.playedToday
      ? $t('home.streak.playedToday')
      : active
        ? $t('home.streak.keepGoing')
        : $t('home.streak.start'),
  );
</script>

<div class="streak" class:active data-testid="streak-indicator">
  <span class="flame" class:lit={active} aria-hidden="true"
    ><Icon name="flame" size="1.4rem" /></span
  >
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
    display: inline-flex;
    line-height: 1;
    color: var(--color-muted);
    opacity: 0.6;
  }

  .flame.lit {
    color: var(--color-accent);
    opacity: 1;
    animation: flame-pulse 1.8s ease-in-out infinite;
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

  @keyframes flame-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flame.lit {
      animation: none;
    }
  }
</style>
