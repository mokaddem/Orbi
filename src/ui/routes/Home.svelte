<script lang="ts">
  import { t } from '../../i18n';
  import {
    loadDailyState,
    loadMastery,
    loadRecommendations,
    loadRegionReviews,
    loadStreak,
    loadTrainingPlan,
    storageReady,
    type DailyState,
    type TrainingPlan,
  } from '../stores/persistence';
  import {
    isStreakMilestone,
    pickStreakReaction,
    type MasteryResult,
    type Recommendation,
    type RegionReview,
    type StreakInfo,
  } from '../../domain';
  import Demo from '../components/Demo.svelte';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';
  import ReviewByRegion from '../components/ReviewByRegion.svelte';
  import StreakIndicator from '../components/StreakIndicator.svelte';
  import DailyChallengeCard from '../components/DailyChallengeCard.svelte';
  import WorldMasteryMeter from '../components/WorldMasteryMeter.svelte';
  import RegionMasteryBreakdown from '../components/RegionMasteryBreakdown.svelte';

  // The review hero (Phase 14, region-scoped in Phase 26): reads the player's own state and
  // surfaces what to review. When there are mistakes queued, the "Time to review" list offers
  // them grouped by region (most-urgent first, with a "review everything" escape hatch); when
  // there's nothing to review it falls back to the "Next up" fresh-start card. We recompute on
  // mount (this route remounts on navigation, so it refreshes after each session) and whenever
  // storage finishes initializing.
  let recs = $state<Recommendation[] | null>(null);
  let regionReviews = $state<RegionReview[] | null>(null);
  let plan = $state<TrainingPlan | null>(null);
  let streak = $state<StreakInfo | null>(null);
  let daily = $state<DailyState | null>(null);
  let mastery = $state<MasteryResult | null>(null);

  // "All caught up": the player has made some progress but has nothing queued to review — the
  // positive complement to the review list, shown with the relaxed globe. Gated on mastery so
  // it never shows for a brand-new player.
  const hasPlayed = $derived(!!mastery && mastery.overall.mastered + mastery.overall.learning > 0);
  const hasReviews = $derived(!!regionReviews && regionReviews.length > 0);
  const allCaughtUp = $derived(hasPlayed && !hasReviews);

  // Streak milestone (Phase 33): once today's play lands on a milestone run (3, 7, … days),
  // Orbi pops in a proud reaction — a one-time celebration alongside the streak pill.
  const streakMilestone = $derived(
    !!streak && streak.playedToday && isStreakMilestone(streak.current),
  );

  // Tapping the compact mastery meter reveals the per-region breakdown (Phase 29). Collapsed
  // by default; the data (`mastery.byRegion`) is already loaded, so this is pure disclosure.
  // The reveal is a CSS animation (see .region-breakdown) so it's reduced-motion-friendly and
  // needs no JS transition.
  let regionsOpen = $state(false);

  $effect(() => {
    if ($storageReady) {
      void loadRecommendations().then((r) => (recs = r));
      void loadRegionReviews().then((r) => (regionReviews = r));
      void loadTrainingPlan().then((p) => (plan = p));
      void loadStreak().then((s) => (streak = s));
      void loadDailyState().then((d) => (daily = d));
      void loadMastery().then((m) => (mastery = m));
    }
  });
</script>

<section class="home">
  <header class="home-header">
    <Mascot pose="wave" size={108} animate="idle" />
    <div class="home-heading">
      <h1>{$t('home.title')}</h1>
      <p class="tagline">{$t('home.tagline')}</p>
    </div>
  </header>

  {#if streak}
    <div class="streak-row">
      <StreakIndicator {streak} />
    </div>
  {/if}

  {#if streak && streakMilestone}
    {@const reaction = pickStreakReaction(streak.current)}
    <div class="streak-milestone" role="status">
      <Mascot pose={reaction.pose} animate={reaction.animate} size={64} />
      <div class="milestone-text">
        <strong>{$t('home.streak.milestoneTitle', { count: streak.current })}</strong>
        <span>{$t('home.streak.milestoneBody')}</span>
      </div>
    </div>
  {/if}

  <Demo />

  {#if hasReviews && regionReviews}
    <ReviewByRegion reviews={regionReviews} {plan} />
  {:else if recs && recs.length}
    <NextUpCard rec={recs[0]} />
  {/if}

  <div class="home-grid">
    {#if daily}
      <div class="daily-row">
        <DailyChallengeCard challenge={daily.challenge} done={daily.done} result={daily.result} />
      </div>
    {/if}

    {#if mastery}
      <div class="mastery-row" class:open={regionsOpen}>
        <button
          type="button"
          class="mastery-toggle"
          aria-expanded={regionsOpen}
          aria-controls="home-region-breakdown"
          aria-label={regionsOpen ? $t('home.mastery.hideRegions') : $t('home.mastery.showRegions')}
          onclick={() => (regionsOpen = !regionsOpen)}
        >
          <WorldMasteryMeter {mastery} compact />
          <span class="chev" aria-hidden="true"><Icon name="chevron-right" size={18} /></span>
        </button>
        {#if regionsOpen}
          <div id="home-region-breakdown" class="region-breakdown">
            <RegionMasteryBreakdown regions={mastery.byRegion} />
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if allCaughtUp}
    <div class="caught-up" role="status">
      <Mascot pose="relaxed" size={60} animate="bounce-in" />
      <span>{$t('home.caughtUp')}</span>
    </div>
  {/if}

  <div class="actions">
    <a class="play-link" href="#/play">
      <Icon name="custom" size={16} />
      <span>{$t('home.playCustom')}</span>
    </a>
  </div>
</section>

<style>
  /* Hero header: the globe mascot greets beside the title. It's decorative spot art (the
     mascot is aria-hidden), so the heading text still carries the screen. */
  .home-header {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .home-heading {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .home-header h1 {
    margin: 0;
  }

  .tagline {
    color: var(--color-muted);
    font-size: 1.1rem;
    margin: 0;
  }

  /* A block row so the inline streak pill sits left-aligned with controlled spacing. */
  .streak-row {
    margin: 0.25rem 0 0;
  }

  /* Milestone celebration: proud Orbi beside a short cheer, on a soft accent tint. */
  .streak-milestone {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-accent-weak);
    border: 2px solid var(--color-accent);
    border-radius: var(--radius);
  }

  .milestone-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .milestone-text strong {
    color: var(--color-accent-strong);
    font-size: 1.05rem;
  }

  .milestone-text span {
    color: var(--color-muted);
    font-size: 0.85rem;
  }

  /* Separate the Daily Challenge card from the Next-up card above it. */
  .daily-row {
    margin-top: 1rem;
  }

  /* The compact world-mastery glance sits below the daily card. */
  .mastery-row {
    margin-top: 1rem;
  }

  /* Desktop (Phase 34): the hero + resume banner stay full-width, then the Daily Challenge
     and world-mastery glance sit side by side. On mobile they stack in one column. The grid
     owns the spacing, so the rows drop their own margin-top inside it. */
  .home-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .home-grid .daily-row,
  .home-grid .mastery-row {
    margin-top: 0;
  }

  @media (min-width: 860px) {
    .home-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      align-items: start;
    }
  }

  /* The whole compact meter is the disclosure trigger (Phase 29): a bare button reset so the
     meter card shows through unchanged, with a chevron affordance and keyboard/focus support. */
  .mastery-toggle {
    position: relative;
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    text-align: inherit;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-radius: var(--radius);
  }

  /* Chevron lives in the meter card's empty bottom-right corner (the sub-label is left-
     aligned), so it never collides with the title/percentage row. Rotates a quarter-turn open. */
  .mastery-toggle .chev {
    position: absolute;
    right: 0.9rem;
    bottom: 0.62rem;
    display: inline-flex;
    color: var(--color-muted);
    transition:
      transform 0.18s ease,
      color 0.12s ease;
  }

  .mastery-toggle:hover .chev {
    color: var(--color-accent);
  }

  .mastery-row.open .chev {
    transform: rotate(90deg);
    color: var(--color-accent);
  }

  .mastery-toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .region-breakdown {
    margin-top: 0.75rem;
    padding: 0.9rem 1.1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    animation: region-reveal 0.2s ease;
  }

  @keyframes region-reveal {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mastery-toggle .chev {
      transition: none;
    }

    .region-breakdown {
      animation: none;
    }
  }

  /* "All caught up" status: relaxed globe on a soft accent tint. */
  .caught-up {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 0.6rem 1rem;
    background: var(--color-accent-weak);
    border-radius: var(--radius);
    color: var(--color-accent-strong);
    font-weight: 700;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1.25rem;
    margin-top: 0.25rem;
  }

  .play-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-muted);
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.12s ease;
  }

  .play-link:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }
</style>
