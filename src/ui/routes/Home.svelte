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
  import type { MasteryResult, Recommendation, RegionReview, StreakInfo } from '../../domain';
  import Demo from '../components/Demo.svelte';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';
  import ReviewByRegion from '../components/ReviewByRegion.svelte';
  import StreakIndicator from '../components/StreakIndicator.svelte';
  import DailyChallengeCard from '../components/DailyChallengeCard.svelte';
  import WorldMasteryMeter from '../components/WorldMasteryMeter.svelte';

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
    <Mascot pose="wave" size={84} />
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

  <Demo />

  {#if hasReviews && regionReviews}
    <ReviewByRegion reviews={regionReviews} {plan} />
  {:else if recs && recs.length}
    <NextUpCard rec={recs[0]} />
  {/if}

  {#if daily}
    <div class="daily-row">
      <DailyChallengeCard challenge={daily.challenge} done={daily.done} result={daily.result} />
    </div>
  {/if}

  {#if mastery}
    <div class="mastery-row">
      <WorldMasteryMeter {mastery} compact />
    </div>
  {/if}

  {#if allCaughtUp}
    <div class="caught-up" role="status">
      <Mascot pose="relaxed" size={60} />
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

  /* Separate the Daily Challenge card from the Next-up card above it. */
  .daily-row {
    margin-top: 1rem;
  }

  /* The compact world-mastery glance sits below the daily card. */
  .mastery-row {
    margin-top: 1rem;
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
