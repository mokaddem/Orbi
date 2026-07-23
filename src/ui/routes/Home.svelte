<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import {
    loadDailyState,
    loadGrandmaster,
    loadMastery,
    loadRank,
    loadRecommendations,
    loadRegionReviews,
    loadStreak,
    loadTrainingPlan,
    prefs,
    storageReady,
    type DailyState,
    type GrandmasterState,
    type RankState,
    type TrainingPlan,
  } from '../stores/persistence';
  import {
    availableChallenges,
    challengeSlotCount,
    filterCountries,
    isStreakMilestone,
    pickStreakReaction,
    type FamilyMasteryResult,
    type MasteryFamily,
    type Recommendation,
    type RegionReview,
    type StreakInfo,
  } from '../../domain';
  import { getCountries } from '../../data';
  import {
    challenge,
    focusMastery,
    lastChallengeSummary,
    pendingChallenge,
  } from '../stores/challenge';
  import { sound } from '../sound';
  import Demo from '../components/Demo.svelte';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';
  import ReviewByRegion from '../components/ReviewByRegion.svelte';
  import StreakIndicator from '../components/StreakIndicator.svelte';
  import StreakBurst from '../components/StreakBurst.svelte';
  import DailyChallengeCard from '../components/DailyChallengeCard.svelte';
  import GrandmasterInviteCard from '../components/GrandmasterInviteCard.svelte';
  import GauntletOfferModal from '../components/GauntletOfferModal.svelte';
  import RankChip from '../components/RankChip.svelte';

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
  let mastery = $state<FamilyMasteryResult | null>(null);
  let grandmaster = $state<GrandmasterState | null>(null);
  let rank = $state<RankState | null>(null);

  // "All caught up": the player has made some progress but has nothing queued to review — the
  // positive complement to the review list, shown with the relaxed globe. Gated on mastery so
  // it never shows for a brand-new player.
  const hasPlayed = $derived(
    !!mastery && mastery.overall.families.some((f) => f.mastered + f.learning > 0),
  );
  const hasReviews = $derived(!!regionReviews && regionReviews.length > 0);
  const allCaughtUp = $derived(hasPlayed && !hasReviews);

  // Streak milestone (Phase 33): once today's play lands on a milestone run (3, 7, … days),
  // Orbi pops in a proud reaction — a one-time celebration alongside the streak pill.
  const streakMilestone = $derived(
    !!streak && streak.playedToday && isStreakMilestone(streak.current),
  );

  // Grandmaster invitation card (Phase 45 ⑥): a discovery surface, shown only when the player has
  // ≥ 1 family × continent they can attempt *today* — fully mastered, not yet certified, and not
  // already spent today. The card is a duplicate entry point (Progress keeps its per-cell "prove it"
  // crowns); it just makes sure the ceremonial challenge isn't missed. Recomputes as the two async
  // reads land.
  const available = $derived(
    mastery && grandmaster
      ? availableChallenges(mastery, grandmaster.certified, grandmaster.spentToday)
      : [],
  );

  // Tapping the card routes by how many runs are attemptable: exactly one → open its offer modal
  // right here (Accept then stages the run + enters the arena, reusing Progress's accept path);
  // more than one → hand off to Progress (via `focusMastery`), which scrolls its World Mastery panel
  // into view so the player picks a specific run there.
  let offer = $state<{ family: MasteryFamily; region: string; slots: number } | null>(null);

  function enterGauntlet(): void {
    if (available.length === 0) return;
    if (available.length === 1) {
      const { family, region } = available[0];
      const slots = challengeSlotCount(family, filterCountries(getCountries(), { region }));
      offer = { family, region, slots };
    } else {
      focusMastery.set(true);
      push('/progress');
    }
  }

  // Accept the sole offer: stage the run and enter the cinematic arena (the "enter" cue + intro fire
  // there). Mirrors Progress's `acceptChallenge`. The card only surfaces attemptable runs, so this
  // path is never on cooldown.
  function acceptChallenge(): void {
    if (!offer) return;
    const { family, region } = offer;
    offer = null;
    challenge.reset();
    lastChallengeSummary.set(null);
    pendingChallenge.set({ family, region });
    push('/challenge');
  }

  $effect(() => {
    if ($storageReady) {
      void loadRecommendations().then((r) => (recs = r));
      void loadRegionReviews().then((r) => (regionReviews = r));
      void loadTrainingPlan().then((p) => (plan = p));
      void loadStreak().then((s) => (streak = s));
      void loadDailyState().then((d) => (daily = d));
      void loadMastery().then((m) => (mastery = m));
      void loadGrandmaster().then((g) => (grandmaster = g));
      // Home commits the rank read (like Summary): it's the backstop that fires the one-time
      // "rank up!" for a crossing not already celebrated on the Summary screen (Phase 43).
      void loadRank(Date.now(), { commit: true }).then((r) => (rank = r));
    }
  });

  // "Rank up!" celebration (Phase 43): the sticky achievement jingle plus the escalating burst,
  // anchored on the rank-up banner — mirroring Summary's new-best moment. Fired once; the jingle
  // obeys the sound toggle inside `sound.play`, and the burst is gated on reduced motion (OS or
  // the in-app toggle) exactly like the streak/blitz bursts.
  const reducedMotionQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  let rankUpEl = $state<HTMLElement>();
  let rankBurstTier = $state(-1);
  let rankBurstX = $state(0);
  let rankBurstY = $state(0);
  let rankBurstKey = $state(0);
  let rankUpFired = false;

  $effect(() => {
    if (!rank?.justRankedUp || rankUpFired) return;
    rankUpFired = true;
    sound.play('achievement');
    if ($prefs.reduceMotion || reducedMotionQuery?.matches) return;
    requestAnimationFrame(() => {
      const el = rankUpEl;
      if (!el) return;
      const r = el.getBoundingClientRect();
      rankBurstX = r.left + r.width / 2;
      rankBurstY = r.top + r.height / 2;
      rankBurstTier = 6; // a warm, celebratory burst matching the achievement moment
      rankBurstKey += 1;
    });
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

  {#if streak || rank}
    <div class="top-stats">
      {#if streak}
        <div class="streak-cell">
          <StreakIndicator {streak} />
        </div>
      {/if}
      {#if rank}
        <div class="rank-cell">
          <a class="rank-link" href="#/progress?focus=rank" title={$t('rank.openDetails')}>
            <RankChip xp={rank.xp} progress={rank.progress} />
          </a>
        </div>
      {/if}
    </div>
  {/if}

  {#if rank?.justRankedUp}
    <div class="rank-up" role="status" bind:this={rankUpEl}>
      <Mascot pose="cheer" animate="bounce-in" size={64} />
      <div class="rank-up-text">
        <strong>{$t('rank.rankUp')}</strong>
        <span>{$t('rank.rankUpBody', { rank: $t(`rank.names.${rank.progress.rank.key}`) })}</span>
      </div>
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
  </div>

  {#if available.length > 0}
    <div class="invite-row">
      <GrandmasterInviteCard onenter={enterGauntlet} />
    </div>
  {/if}

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

  <!-- Rank-up burst overlay (Phase 43): fixed-position, so its place in the tree is immaterial;
       `{#key}` mounts a fresh instance so the one-shot animation plays exactly once. -->
  {#if rankBurstTier >= 0}
    {#key rankBurstKey}
      <StreakBurst tier={rankBurstTier} x={rankBurstX} y={rankBurstY} />
    {/key}
  {/if}
</section>

<!-- The offer modal for the single-available case (Phase 45 ⑥). Rendered above the shell, like the
     Progress entry — a run surfaced by the card is always attemptable (never spent), so no cooldown. -->
{#if offer}
  <GauntletOfferModal
    open
    family={offer.family}
    region={offer.region}
    slots={offer.slots}
    onaccept={acceptChallenge}
    oncancel={() => (offer = null)}
  />
{/if}

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

  /* Streak pill + rank chip share one row: the pill keeps its natural width and the rank chip
     fills the rest. Stays side-by-side down to ~narrow-phone width, then wraps to a stacked
     layout (chip on its own line) only on very small screens. */
  .top-stats {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 0.25rem 0 0;
  }

  .top-stats .streak-cell {
    flex: 0 0 auto;
  }

  .top-stats .rank-cell {
    /* Grow to fill the streak's row when there's room, but keep the chip's natural minimum (medal +
       rank name on one line) as the shrink floor — basis 0 makes the wrap decision hinge on that
       min-content, not the chip's preferred width. A short rank (Novice, Scout, …) sits beside the
       streak; a long one (e.g. "Legendary Explorer") no longer fits, so the whole chip wraps onto
       its own full-width row rather than overflowing off-screen. No `min-width: 0` (the old cause):
       that let the chip shrink to nothing and the nowrap name spill off-screen. No breakpoint. */
    flex: 1 1 0;
  }

  /* The whole chip is a link into Progress → Explorer rank. Pointer + a hover ring + a focus
     outline signal it's clickable; no motion, so it's reduced-motion-safe. */
  .top-stats .rank-cell .rank-link {
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: var(--radius);
  }

  .top-stats .rank-cell .rank-link:hover {
    box-shadow: 0 0 0 3px var(--color-accent-weak);
  }

  .top-stats .rank-cell .rank-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  /* Rank-up celebration: cheering Orbi beside the "you reached X" line, on the accent tint —
     the inline sibling to the burst overlay, mirroring the streak-milestone block. */
  .rank-up {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-accent-weak);
    border: 2px solid var(--color-accent);
    border-radius: var(--radius);
  }

  .rank-up-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .rank-up-text strong {
    color: var(--color-accent-strong);
    font-size: 1.05rem;
  }

  .rank-up-text span {
    color: var(--color-muted);
    font-size: 0.85rem;
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

  /* The Daily Challenge card sits in its own row below the hero/review area. The grid owns the
     spacing, so the row drops its own margin-top inside it. */
  .home-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .home-grid .daily-row {
    margin-top: 0;
  }

  /* The ceremonial Grandmaster invitation sits below the daily card, as its own row. */
  .invite-row {
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
