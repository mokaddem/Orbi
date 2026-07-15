<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import { formatDuration, formatPercent } from '../format';
  import { play, lastSummary, lastBlitzResult, pendingConfig } from '../stores/game';
  import { challenge, lastChallengeSummary, pendingChallenge } from '../stores/challenge';
  import {
    loadRank,
    loadRecommendations,
    prefs,
    storageReady,
    type RankState,
  } from '../stores/persistence';
  import {
    masteryFamilyOf,
    pickSummaryReaction,
    sessionXp,
    sessionXpBreakdown,
    type MascotPose,
    type Recommendation,
  } from '../../domain';
  import { getCountry, type Country } from '../../data';
  import { sound } from '../sound';
  import Flag from '../components/Flag.svelte';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import MascotScene from '../components/MascotScene.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';
  import SessionXpCard from '../components/SessionXpCard.svelte';
  import StreakBurst from '../components/StreakBurst.svelte';

  // A forward-looking "Next up" suggestion, computed from the player's overall state
  // (distinct from the session-specific Retry / Train-these actions below). Refreshed on
  // mount; the just-finished session's SR writes may still be settling, so it's a soft
  // nudge that becomes exact on the next Home visit.
  let recs = $state<Recommendation[] | null>(null);

  // Explorer XP (Phase 43): the "+N XP" for this run is the play-derived portion, computed straight
  // from the just-finished results (exact regardless of when the history write settles). The rank
  // snapshot drives the one-time "rank up!" — committed here, the primary post-session moment.
  const xpEarned = $derived($lastSummary ? sessionXp($lastSummary.results) : 0);
  const xpBreakdown = $derived($lastSummary ? sessionXpBreakdown($lastSummary.results) : []);
  let rank = $state<RankState | null>(null);

  // Grandmaster Run summary (Phase 44): a challenge finishes as an ordinary `type: 'challenge'`
  // SessionSummary (so XP / rank still apply), with the richer pass/fail detail carried alongside in
  // `lastChallengeSummary`. Fall back to the standard summary if that handoff was lost (e.g. reload):
  // a pass is the clean sweep (`correct === total`), and the family/region are recoverable from it.
  const isChallenge = $derived($lastSummary?.type === 'challenge');
  const gm = $derived(isChallenge ? $lastChallengeSummary : null);
  const gmFamily = $derived(
    gm?.family ?? ($lastSummary ? masteryFamilyOf($lastSummary.mode) : null),
  );
  const gmRegion = $derived(gm?.region ?? $lastSummary?.regionFilter?.region ?? null);
  const gmPassed = $derived(
    gm
      ? gm.passed
      : !!$lastSummary && $lastSummary.total > 0 && $lastSummary.correct === $lastSummary.total,
  );
  const gmMissed: Country | null = $derived(gm?.missed ?? $lastSummary?.missed[0] ?? null);

  // The rank bar's fill *before* this run, within the current rank, so the card can animate it
  // growing forward by exactly the "+N XP" earned. Reconstruct the pre-run total (current total −
  // the play-derived run XP) and clamp into [0, current fraction] — a run that crossed a rank
  // threshold lands below the new rank's floor, so the bar simply fills the fresh rank from empty.
  const startFraction = $derived.by(() => {
    if (!rank) return 0;
    const p = rank.progress;
    if (!p.next || p.rankSpan <= 0) return p.fraction; // top rank — already full
    const beforeIntoRank = rank.xp.total - xpEarned - p.rank.minXp;
    return Math.max(0, Math.min(p.fraction, beforeIntoRank / p.rankSpan));
  });

  $effect(() => {
    if ($storageReady) {
      void loadRecommendations().then((r) => (recs = r));
      void loadRank(Date.now(), { commit: true }).then((r) => (rank = r));
    }
  });

  // New-personal-best celebration (Phase 42): a Blitz run that beat its best fires the escalating
  // StreakBurst once, anchored on the "New personal best!" banner. Gated on reduced motion (OS or
  // the in-app toggle), like Play's milestone burst; the celebratory jingle already played on the
  // Play route as the run ended.
  const reducedMotionQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  let bestBannerEl = $state<HTMLElement>();
  let burstTier = $state(-1);
  let burstX = $state(0);
  let burstY = $state(0);
  let burstKey = $state(0);
  let burstFired = false;

  $effect(() => {
    const br = $lastBlitzResult;
    if (!br?.isNewBest || burstFired || !bestBannerEl) return;
    if ($prefs.reduceMotion || reducedMotionQuery?.matches) return;
    burstFired = true;
    requestAnimationFrame(() => {
      const el = bestBannerEl;
      if (!el) return;
      const r = el.getBoundingClientRect();
      burstX = r.left + r.width / 2;
      burstY = r.top + r.height / 2;
      burstTier = 6; // a big, coral-hot burst — a "peak" feel without the tier-8 screen flash
      burstKey += 1;
    });
  });

  // "Rank up!" celebration (Phase 43): Summary is the primary post-session moment. Its own burst
  // + the achievement jingle fire once when this load crossed a rank threshold; the burst obeys
  // reduced motion, the jingle the sound toggle (inside `sound.play`). A separate anchor/guard from
  // the Blitz best above, so a run that is both a new best *and* a rank-up shows each cleanly.
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
      rankBurstTier = 6;
      rankBurstKey += 1;
    });
  });

  // "Grandmaster!" celebration (Phase 44): a passed run fires the escalating burst once, anchored on
  // the crown. The `perfect` jingle already played as the run ended (on the Challenge route), so this
  // is visual only. Obeys reduced motion, like the Blitz / rank-up bursts; its own anchor + guard.
  let gmCrownEl = $state<HTMLElement>();
  let gmBurstTier = $state(-1);
  let gmBurstX = $state(0);
  let gmBurstY = $state(0);
  let gmBurstKey = $state(0);
  let gmBurstFired = false;

  $effect(() => {
    if (!isChallenge || !gmPassed || gmBurstFired || !gmCrownEl) return;
    gmBurstFired = true;
    if ($prefs.reduceMotion || reducedMotionQuery?.matches) return;
    requestAnimationFrame(() => {
      const el = gmCrownEl;
      if (!el) return;
      const r = el.getBoundingClientRect();
      gmBurstX = r.left + r.width / 2;
      gmBurstY = r.top + r.height / 2;
      gmBurstTier = 6; // a big, warm burst — a "peak" without the tier-8 screen flash
      gmBurstKey += 1;
    });
  });

  // Re-stage the just-played Grandmaster Run (same family × continent) and relaunch it.
  function retryChallenge(): void {
    if (!gmFamily || !gmRegion) return;
    challenge.reset();
    lastChallengeSummary.set(null);
    pendingChallenge.set({ family: gmFamily, region: gmRegion });
    push('/challenge');
  }

  // Orbi's reaction to the result (Phase 33): the pose/motion come from a pure helper; the
  // matching headline is looked up here. Only the four finished-session poses appear.
  const REACTION_HEADLINE: Partial<Record<MascotPose, string>> = {
    cheer: 'summary.reaction.perfect',
    proud: 'summary.reaction.strong',
    celebrate: 'summary.reaction.good',
    encouraging: 'summary.reaction.tryAgain',
  };

  // A small fan of flags from the just-played countries — the illustrative flourish on a
  // flawless run. Distinct, in play order, capped so it stays a garnish, not a list.
  function sessionFlags(results: { countryIso2: string }[], limit = 5): Country[] {
    const flags: Country[] = [];
    for (const r of results) {
      if (flags.length >= limit) break;
      if (flags.some((c) => c.iso2 === r.countryIso2)) continue;
      const c = getCountry(r.countryIso2);
      if (c) flags.push(c);
    }
    return flags;
  }

  const MODE_LABEL: Record<string, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
    'capital-to-country': 'modes.capitalToCountry',
    'country-to-capital': 'modes.countryToCapital',
    'country-to-languages': 'modes.countryToLanguages',
    'country-to-industry': 'modes.mainIndustries',
  };

  function retry(): void {
    const s = $lastSummary;
    if (!s) return;
    const p = $prefs;
    // A training session has no region filter; reuse the same drilled countries
    // (every distinct country asked) so "Retry" re-runs the same set.
    if (s.type === 'training') {
      const iso2s = [...new Set(s.results.map((r) => r.countryIso2))];
      pendingConfig.set({
        mode: s.mode,
        type: 'training',
        answerPoolIso: iso2s,
        fixedLength: iso2s.length,
        choices: p.choicesPerQuestion,
      });
      push('/play');
      return;
    }
    pendingConfig.set({
      mode: s.mode,
      type: s.type,
      filter: s.regionFilter,
      fixedLength: p.fixedLength,
      lives: p.survivalLives,
      choices: p.choicesPerQuestion,
    });
    push('/play');
  }

  function trainMissed(): void {
    const s = $lastSummary;
    if (!s || s.missed.length === 0) return;
    const p = $prefs;
    // Re-drill exactly the countries just missed, in the same mode. Distractors are
    // drawn from the whole world (see the session's answer-pool handling), and each
    // missed country is asked once (fixedLength = pool size).
    pendingConfig.set({
      mode: s.mode,
      type: 'training',
      answerPoolIso: s.missed.map((c) => c.iso2),
      fixedLength: s.missed.length,
      choices: p.choicesPerQuestion,
    });
    push('/play');
  }

  function newGame(): void {
    play.reset();
    pendingConfig.set(null);
    push('/play');
  }
</script>

<section class="summary">
  <h1>{$t('summary.title')}</h1>

  {#if !$lastSummary}
    <div class="empty-state">
      <MascotScene pose="thinking" size={116} />
      <p class="empty">{$t('summary.empty')}</p>
      <a class="cta" href="#/play">{$t('summary.playNow')}</a>
    </div>
  {:else}
    {@const s = $lastSummary}
    {@const regionKey = s.regionFilter?.subregion ?? s.regionFilter?.region ?? null}
    {@const reaction = pickSummaryReaction({ accuracy: s.accuracy, total: s.total })}
    <p class="meta">
      {#if isChallenge}
        <!-- A Grandmaster Run interleaves both directions, so name the run + its continent
             rather than a single mode. -->
        <span class="meta-ico" aria-hidden="true"><Icon name="crown" size="1.15em" /></span>
        <span>{$t('challenge.name')}</span>
        {#if gmRegion}
          <span class="dot" aria-hidden="true">·</span>
          <span class="meta-region">
            <span class="meta-region-ico" aria-hidden="true"><RegionIcon region={gmRegion} /></span>
            {$localizedRegion(gmRegion)}
          </span>
        {/if}
      {:else}
        <span class="meta-ico" aria-hidden="true"><ModeIcon mode={s.mode} /></span>
        <span>{$t(MODE_LABEL[s.mode] ?? s.mode)}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span>{$t(`sessionType.${s.type}`)}</span>
        {#if regionKey}
          <span class="dot" aria-hidden="true">·</span>
          <span class="meta-region">
            <span class="meta-region-ico" aria-hidden="true"
              ><RegionIcon region={s.regionFilter?.region ?? ''} /></span
            >
            {$localizedRegion(regionKey)}
          </span>
        {/if}
      {/if}
    </p>

    {#if isChallenge}
      <!-- Grandmaster Run result (Phase 44): a crowned "certified" hero on a clean sweep, or an
           encouraging "run ended — you missed X" on the fatal miss. All-or-nothing, so this
           replaces the accuracy-graded pose reaction. -->
      <div class="gm-result" class:passed={gmPassed} class:failed={!gmPassed}>
        {#if gmPassed}
          <span class="gm-crown" bind:this={gmCrownEl} aria-hidden="true">
            <Icon name="crown" size={56} />
          </span>
          <p class="gm-title">{$t('challenge.summary.passTitle')}</p>
          <p class="gm-body">
            {$t('challenge.summary.passBody', {
              family: gmFamily ? $t(`modes.group.${gmFamily}`) : '',
              region: gmRegion ? $localizedRegion(gmRegion) : '',
            })}
          </p>
          {@const flags = sessionFlags(s.results)}
          {#if flags.length > 1}
            <div class="flag-fan" aria-hidden="true">
              {#each flags as country, i (country.iso2)}
                <span class="fan-flag" style="--i: {i - (flags.length - 1) / 2}">
                  <Flag {country} />
                </span>
              {/each}
            </div>
          {/if}
        {:else}
          <Mascot pose="encouraging" animate="wiggle" size={96} />
          <p class="gm-title fail">{$t('challenge.summary.failTitle')}</p>
          <p class="gm-body">
            {$t('challenge.summary.failBody', {
              cleared: gm?.cleared ?? s.correct,
              total: gm?.total ?? s.total,
              country: gmMissed ? $localizedName(gmMissed) : '',
            })}
          </p>
          {#if gmMissed}
            <span class="gm-missed">
              <span class="gm-missed-flag"><Flag country={gmMissed} /></span>
              {$localizedName(gmMissed)}
            </span>
          {/if}
        {/if}
      </div>
    {:else}
      <!-- Reactive Orbi (Phase 33): pose + motion chosen from how the run went. Decorative —
           the headline carries the meaning for assistive tech. -->
      <div class="result-hero">
        <Mascot pose={reaction.pose} animate={reaction.animate} size={104} />
        {#if REACTION_HEADLINE[reaction.pose]}
          <p class="result-headline">{$t(REACTION_HEADLINE[reaction.pose] as string)}</p>
        {/if}
        <!-- Survival "region cleared" win (Phase 40): a small badge marking that every country
             in the pool was answered correctly, distinct from the pose-driven score reaction. -->
        {#if s.cleared}
          <p class="cleared-badge">
            <Icon name="trophy" size="0.95em" />
            {$t('summary.regionCleared')}
          </p>
        {/if}
      </div>
    {/if}

    <!-- Blitz result (Phase 42): points are the headline, with the personal best beneath — or a
         celebratory "new best!" banner (which the burst above anchors to) when it was beaten. -->
    {#if s.type === 'blitz' && $lastBlitzResult}
      {@const br = $lastBlitzResult}
      <div class="blitz-result" class:is-new-best={br.isNewBest}>
        <p class="blitz-score">
          {br.points.toLocaleString()}<span class="blitz-unit">{$t('summary.points')}</span>
        </p>
        {#if br.isNewBest}
          <p class="blitz-best-banner" bind:this={bestBannerEl}>
            <Icon name="trophy" size="1em" />
            {$t('summary.newBest')}
          </p>
        {:else}
          <p class="blitz-best">
            {$t('summary.personalBest', { points: br.best.toLocaleString() })}
          </p>
        {/if}
      </div>
    {/if}

    <div class="stats">
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="trophy" size={18} /></span>
        <span class="value">{s.correct}/{s.total}</span>
        <span class="label">{$t('summary.score')}</span>
      </div>
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="target" size={18} /></span>
        <span class="value">{formatPercent(s.accuracy)}</span>
        <span class="label">{$t('summary.accuracy')}</span>
      </div>
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="clock" size={18} /></span>
        <span class="value">{formatDuration(s.durationMs)}</span>
        <span class="label">{$t('summary.time')}</span>
      </div>
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="flame" size={18} /></span>
        <span class="value">{s.bestStreak}</span>
        <span class="label">{$t('summary.bestStreak')}</span>
      </div>
    </div>

    <!-- Explorer XP earned this run (Phase 43): the play-derived "+N XP" itemized by source, above
         the rank bar animating from its pre-run fill to now (once the async rank load settles). -->
    <SessionXpCard
      earned={xpEarned}
      breakdown={xpBreakdown}
      progress={rank?.progress ?? null}
      {startFraction}
      reduceMotion={$prefs.reduceMotion}
    />

    <!-- One-time "Rank up!" (Phase 43): shown when this run crossed a rank threshold. -->
    {#if rank?.justRankedUp}
      <div class="rank-up" role="status" bind:this={rankUpEl}>
        <Mascot pose="cheer" animate="bounce-in" size={64} />
        <div class="rank-up-text">
          <strong>{$t('rank.rankUp')}</strong>
          <span>{$t('rank.rankUpBody', { rank: $t(`rank.names.${rank.progress.rank.key}`) })}</span>
        </div>
      </div>
    {/if}

    {#if !isChallenge}
      <div class="missed">
        {#if s.missed.length === 0}
          {@const flags = sessionFlags(s.results)}
          <div class="perfect-state">
            <p class="perfect">{$t('summary.noneMissed')}</p>
            {#if flags.length > 1}
              <div class="flag-fan" aria-hidden="true">
                {#each flags as country, i (country.iso2)}
                  <span class="fan-flag" style="--i: {i - (flags.length - 1) / 2}">
                    <Flag {country} />
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <h2>{$t('summary.missedTitle', { count: s.missed.length })}</h2>
          <ul class="missed-list">
            {#each s.missed as country (country.iso2)}
              <li>
                <span class="missed-flag"><Flag {country} alt={$localizedName(country)} /></span>
                <span class="missed-name">{$localizedName(country)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    {#if recs && recs.length}
      <NextUpCard rec={recs[0]} />
    {/if}

    <div class="actions">
      {#if isChallenge}
        <!-- A Grandmaster Run is a test, not a drill: retry the same run; no "train these". -->
        <button type="button" class="primary" onclick={retryChallenge}>
          <Icon name="crown" size="1em" />
          {$t('challenge.summary.tryAgain')}
        </button>
        <button type="button" class="ghost" onclick={newGame}>
          <Icon name="play" size="1em" />
          {$t('summary.newGame')}
        </button>
      {:else}
        <button type="button" class="primary" onclick={retry}>
          <Icon name="repeat" size="1em" />
          {$t('summary.retry')}
        </button>
        <button
          type="button"
          class="secondary"
          onclick={trainMissed}
          disabled={s.missed.length === 0}
          title={s.missed.length === 0 ? $t('summary.trainNone') : $t('summary.trainThese')}
        >
          <Icon name="train" size="1em" />
          {$t('summary.train')}
        </button>
        <button type="button" class="ghost" onclick={newGame}>
          <Icon name="play" size="1em" />
          {$t('summary.newGame')}
        </button>
      {/if}
    </div>

    <!-- New-best burst overlay (Phase 42): fixed-position, so its place in the tree is immaterial;
         `{#key}` mounts a fresh instance so the one-shot animation plays once. -->
    {#if burstTier >= 0}
      {#key burstKey}
        <StreakBurst tier={burstTier} x={burstX} y={burstY} />
      {/key}
    {/if}

    <!-- Rank-up burst overlay (Phase 43): its own instance/key so it plays once, independently
         of the Blitz new-best burst above. -->
    {#if rankBurstTier >= 0}
      {#key rankBurstKey}
        <StreakBurst tier={rankBurstTier} x={rankBurstX} y={rankBurstY} />
      {/key}
    {/if}

    <!-- Grandmaster "certified!" burst overlay (Phase 44): fires once on a passed run. -->
    {#if gmBurstTier >= 0}
      {#key gmBurstKey}
        <StreakBurst tier={gmBurstTier} x={gmBurstX} y={gmBurstY} />
      {/key}
    {/if}
  {/if}
</section>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    /* Focused results card — a centred column on desktop, never stretched (Phase 34). */
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  .empty {
    color: var(--color-muted);
  }

  /* No-result / perfect states: centre the mascot above its message. */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.7rem;
    padding: 1.5rem 1rem 0.5rem;
  }

  .empty-state .cta {
    align-self: center;
  }

  .cta {
    align-self: flex-start;
    padding: 0.65rem 1.5rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-radius: 999px;
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }

  .cta:hover {
    text-decoration: none;
    transform: translateY(-2px);
  }

  .cta:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .meta {
    margin: -0.5rem 0 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: var(--color-muted);
    font-weight: 600;
  }

  .meta-ico {
    display: inline-flex;
    width: 1.15rem;
    height: 1.15rem;
    color: var(--color-accent);
  }

  .meta-region {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .meta-region-ico {
    display: inline-flex;
    width: 1.35rem;
    height: 1.35rem;
    color: var(--color-accent);
  }

  .dot {
    opacity: 0.6;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 1rem 0.5rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .stat-ico {
    display: inline-flex;
    color: var(--color-accent);
  }

  .stat .value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat .label {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  /* Reactive result hero: Orbi above a one-line reaction to the score. */
  .result-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.35rem;
    margin-top: -0.25rem;
  }

  .result-headline {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--color-accent-strong);
  }

  .cleared-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    background: var(--color-correct-bg);
    color: var(--color-correct);
    font-weight: 800;
    font-size: 0.9rem;
  }

  /* Grandmaster Run result hero (Phase 44). */
  .gm-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    margin-top: -0.25rem;
  }

  /* Certified: a metallic gold crown disc, echoing the gilded World Mastery cells. */
  .gm-crown {
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    border-radius: 999px;
    background: var(--gold-metal);
    border: 2px solid var(--color-gold-deep);
    color: var(--color-gold-ink);
    box-shadow: 0 6px 16px -4px rgb(168 110 8 / 55%);
    animation: gm-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  @keyframes gm-pop {
    0% {
      transform: scale(0.6) rotate(-8deg);
      opacity: 0;
    }
    60% {
      transform: scale(1.12) rotate(2deg);
    }
    100% {
      transform: scale(1) rotate(0);
      opacity: 1;
    }
  }

  .gm-title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 800;
  }

  .gm-result.passed .gm-title {
    color: var(--color-gold-deep);
  }

  .gm-title.fail {
    color: var(--color-text);
  }

  .gm-body {
    margin: 0;
    color: var(--color-muted);
    font-weight: 600;
  }

  .gm-result.passed .gm-body {
    color: var(--color-gold-deep);
  }

  /* The country the fatal miss died on — its flag + name, tinted "wrong". */
  .gm-missed {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.1rem;
    padding: 0.3rem 0.7rem 0.3rem 0.4rem;
    border-radius: 999px;
    background: var(--color-wrong-bg);
    color: var(--color-wrong);
    font-weight: 700;
  }

  .gm-missed-flag {
    width: 34px;
    flex: 0 0 auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .gm-crown {
      animation: none;
    }
  }

  /* Rank-up celebration: cheering Orbi beside the "you reached X" line, on the accent tint. */
  .rank-up {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    align-self: stretch;
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

  /* Blitz result (Phase 42): the points score as the hero, with the personal best beneath. */
  .blitz-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.3rem;
    margin-top: -0.25rem;
  }

  .blitz-score {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    margin: 0;
    font-size: 2.6rem;
    font-weight: 800;
    line-height: 1;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
  }

  .blitz-unit {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  .blitz-best {
    margin: 0;
    color: var(--color-muted);
    font-weight: 600;
  }

  .blitz-best-banner {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    padding: 0.3rem 0.9rem;
    border-radius: 999px;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    font-weight: 800;
    box-shadow: var(--shadow-card);
    animation: new-best-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  @keyframes new-best-pop {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    60% {
      transform: scale(1.12);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .perfect-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.6rem;
    padding: 0.5rem 0;
  }

  .perfect {
    color: var(--color-correct);
    font-weight: 600;
  }

  /* A gently-fanned row of flags from the just-played countries — a flourish on a flawless
     run, composed from bundled assets (no new artwork). Each flag tilts by its offset `--i`
     from centre; the fan flattens under reduced motion (see below). */
  .flag-fan {
    display: flex;
    justify-content: center;
    padding: 0.35rem 0 0.2rem;
  }

  .fan-flag {
    width: 46px;
    margin: 0 -5px;
    transform: rotate(calc(var(--i) * 8deg));
    transform-origin: bottom center;
    filter: drop-shadow(0 2px 2px rgb(42 35 32 / 12%));
  }

  .fan-flag :global(.flag) {
    border-radius: 4px;
  }

  .missed-list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem;
  }

  .missed-list li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.6rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .missed-flag {
    flex: 0 0 auto;
    width: 40px;
  }

  .missed-name {
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 1.4rem;
    border-radius: 999px;
    font-weight: 700;
    border: 2px solid transparent;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    box-shadow: var(--shadow-chunky);
  }

  .primary:hover {
    transform: translateY(-2px);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .secondary {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .secondary:hover:not(:disabled) {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .secondary:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
  }

  .ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .cta,
    .actions button {
      transition: none;
    }

    .cta:hover,
    .primary:hover,
    .secondary:hover:not(:disabled) {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
