<script lang="ts">
  import { t } from '../../i18n';
  import { RANKS, type RankProgress, type XpSource, type XpSourceKey } from '../../domain';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  // Post-session Explorer-XP card (Phase 43+): the rank progress bar *growing* from where the player
  // sat before this run to where they sit now, plus an itemized breakdown of the run's "+N XP".
  // Presentational — the caller computes `earned`, `breakdown`, `progress`, and `startFraction`.
  //
  // `progress` is the post-run rank snapshot (null until the async rank load settles — the earned +
  // breakdown still render without it). `startFraction` is the bar's fill *before* this run within
  // the current rank; the bar animates start → `progress.fraction` once on mount so the gained XP
  // visibly pushes it forward. Honours `reduceMotion` (in-app toggle) as well as the OS setting.
  let {
    earned,
    breakdown,
    progress = null,
    startFraction = 0,
    reduceMotion = false,
  }: {
    earned: number;
    breakdown: XpSource[];
    progress?: RankProgress | null;
    startFraction?: number;
    reduceMotion?: boolean;
  } = $props();

  const rankName = $derived(progress ? $t(`rank.names.${progress.rank.key}`) : '');
  const nextName = $derived(progress?.next ? $t(`rank.names.${progress.next.key}`) : '');
  const totalXp = $derived(progress ? progress.rank.minXp + progress.xpIntoRank : 0);
  const targetPct = $derived(progress ? Math.round(progress.fraction * 100) : 0);
  const startPct = $derived(
    progress ? Math.round(Math.max(0, Math.min(progress.fraction, startFraction)) * 100) : 0,
  );

  // The badge escalates with the ladder — shield for the early ranks up to a crown at the top
  // (matches RankChip / RankPanel).
  const RANK_ICONS: readonly IconName[] = [
    'shield',
    'shield',
    'award',
    'award',
    'medal',
    'medal',
    'gem',
    'gem',
    'crown',
    'crown',
  ];
  const rankIcon = $derived(progress ? (RANK_ICONS[progress.rank.index] ?? 'award') : 'award');

  const SOURCE_ICON: Record<XpSourceKey, IconName> = {
    correct: 'check',
    questions: 'target',
    sessions: 'play',
    streak: 'flame',
    badges: 'trophy',
  };
  // Only the sources that actually contributed (a 0-correct run drops the "correct" row).
  const rows = $derived(breakdown.filter((s) => s.xp > 0));

  const GROW_DELAY_MS = 1000;
  let cardEl = $state<HTMLDivElement>();
  let visible = $state(false);
  let grown = $state(false);

  // The bar is two segments of the current rank's span: a static `base` (what was banked before
  // this run, teal) and the `gain` this run added (gold). The gain grows in from the base edge, so
  // the eye sees exactly how much the session contributed.
  const gainPct = $derived(Math.max(0, targetPct - startPct));
  const gainWidth = $derived(grown ? gainPct : 0);

  // Reveal-gated: the hold-then-grow only starts once the card is actually on screen. On a long
  // Summary the card can begin below the fold, and the fill must not have already finished by the
  // time the player scrolls down to it. No IntersectionObserver (jsdom / very old browsers) → treat
  // the card as immediately visible.
  $effect(() => {
    if (visible || !cardEl) return;
    if (typeof IntersectionObserver === 'undefined') {
      visible = true;
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) visible = true;
      },
      { threshold: 0.5 },
    );
    io.observe(cardEl);
    return () => io.disconnect();
  });

  // Once visible (and the async rank load has settled), hold a beat so the eye registers the pre-run
  // fill, then grow the gain in. Reduced motion jumps straight to the target, no delay.
  $effect(() => {
    if (!progress || grown || !visible) return;
    if (reduceMotion) {
      grown = true;
      return;
    }
    const timer = setTimeout(() => (grown = true), GROW_DELAY_MS);
    return () => clearTimeout(timer);
  });
</script>

<div class="xp-card" data-testid="session-xp-card" bind:this={cardEl}>
  {#if progress}
    <div class="rank-head">
      <span class="badge" aria-hidden="true"><Icon name={rankIcon} size={22} /></span>
      <div class="rank-id">
        <span class="rank-name">{rankName}</span>
        <span class="rank-level">
          {$t('rank.level', { n: progress.rank.index + 1, total: RANKS.length })}
        </span>
      </div>
      <span class="rank-xp">{$t('rank.xpTotal', { xp: totalXp.toLocaleString() })}</span>
    </div>

    <div
      class="track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={targetPct}
      aria-label={$t('rank.title')}
    >
      <!-- Banked before this run (teal), then the gold gain this run added, growing in from it. -->
      <div class="seg base" style="width:{startPct}%"></div>
      <div
        class="seg gain"
        class:animate={!reduceMotion}
        style="left:{startPct}%; width:{gainWidth}%"
      ></div>
    </div>
    <span class="to-next">
      {#if progress.next}
        {$t('rank.toNext', { xp: progress.xpToNext.toLocaleString(), rank: nextName })}
      {:else}
        {$t('rank.max')}
      {/if}
    </span>
  {/if}

  <div class="earned-head">
    <span class="earned-label">{$t('rank.runBreakdown')}</span>
    <span class="earned-xp" data-testid="xp-earned">
      <Icon name="sparkles" size="1em" />
      {$t('rank.earned', { xp: earned.toLocaleString() })}
    </span>
  </div>

  {#if rows.length > 0}
    <ul class="sources">
      {#each rows as s (s.key)}
        <li class="src-row">
          <span class="src-ico" aria-hidden="true"
            ><Icon name={SOURCE_ICON[s.key]} size={15} /></span
          >
          <span class="src-label">
            <span class="src-name"
              >{s.key === 'sessions' ? $t('rank.sessionBonus') : $t(`rank.source.${s.key}`)}</span
            >
            {#if s.key !== 'sessions'}
              <span class="src-count">{s.count.toLocaleString()}</span>
            {/if}
          </span>
          <span class="src-xp">{$t('rank.earned', { xp: s.xp.toLocaleString() })}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .xp-card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.9rem 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .rank-head {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .badge {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 999px;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
    border: 2px solid var(--color-accent);
  }

  .rank-id {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .rank-name {
    font-weight: 800;
    font-size: 1.05rem;
    line-height: 1.15;
  }

  .rank-level {
    font-size: 0.78rem;
    color: var(--color-muted);
  }

  .rank-xp {
    flex: 0 0 auto;
    font-weight: 800;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
    font-size: 0.95rem;
  }

  .track {
    position: relative;
    height: 0.7rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .seg {
    position: absolute;
    top: 0;
    height: 100%;
  }

  /* What the player had banked in this rank before the run. */
  .seg.base {
    left: 0;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent-strong));
    border-radius: 999px 0 0 999px;
  }

  /* This session's contribution — a distinct gold segment growing out from the base edge, so the
     XP gained is visible as its own bar. */
  .seg.gain {
    background: linear-gradient(90deg, var(--color-sun), var(--color-coral));
    border-radius: 0 999px 999px 0;
  }

  /* The one-time grow of the gain as the run's XP lands. Longer/eased so it reads as "filling". */
  .seg.gain.animate {
    transition: width 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
  }

  .to-next {
    font-size: 0.8rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .earned-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.15rem;
    padding-top: 0.55rem;
    border-top: 1px solid var(--color-border);
  }

  .earned-label {
    font-size: 0.9rem;
    color: var(--color-muted);
    font-weight: 600;
  }

  .earned-xp {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 800;
    font-size: 1.05rem;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .earned-xp :global(.icon) {
    color: var(--color-accent);
  }

  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .src-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .src-ico {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--color-accent);
  }

  .src-label {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .src-name {
    font-size: 0.88rem;
    font-weight: 600;
  }

  .src-count {
    font-size: 0.76rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .src-xp {
    flex: 0 0 auto;
    font-weight: 700;
    font-size: 0.84rem;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
  }
</style>
