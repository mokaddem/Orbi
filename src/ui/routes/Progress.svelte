<script lang="ts">
  import { t } from '../../i18n';
  import {
    computeStats,
    type FamilyMasteryResult,
    type MasteryResult,
    type StatsOverview,
    type WeeklyRecap as WeeklyRecapData,
  } from '../../domain';
  import type { SessionRecord } from '../../data';
  import { formatDuration, formatPercent } from '../format';
  import {
    loadSessions,
    loadMastery,
    loadLanguageMastery,
    loadIndustryMastery,
    loadWeeklyRecap,
    loadAchievements,
    persistent,
    storageReady,
    type AchievementView,
  } from '../stores/persistence';
  import { sound } from '../sound';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import MascotScene from '../components/MascotScene.svelte';
  import PageHero from '../components/PageHero.svelte';
  import FamilyMasteryMeter from '../components/FamilyMasteryMeter.svelte';
  import FamilyRegionBreakdown from '../components/FamilyRegionBreakdown.svelte';
  import ExtraMasteryTopic from '../components/ExtraMasteryTopic.svelte';
  import AchievementsGrid from '../components/AchievementsGrid.svelte';
  import WeeklyRecap from '../components/WeeklyRecap.svelte';

  let sessions = $state<SessionRecord[]>([]);
  let stats = $state<StatsOverview | null>(null);
  let mastery = $state<FamilyMasteryResult | null>(null);
  let languageMastery = $state<MasteryResult | null>(null);
  let industryMastery = $state<MasteryResult | null>(null);
  let recap = $state<WeeklyRecapData | null>(null);
  let achievements = $state<AchievementView[]>([]);
  let loading = $state(true);

  // Combined "extra knowledge" surface (Phase 23): capitals + languages (+ industries later)
  // each get a compact meter, but only once that topic has been played, so they never clutter
  // the page for a player who sticks to country identification. A topic is "active" once any
  // of its items is in learning or mastered.
  const hasActivity = (m: MasteryResult | null): boolean =>
    !!m && m.overall.mastered + m.overall.learning > 0;
  const hasLanguageActivity = $derived(hasActivity(languageMastery));
  const hasIndustryActivity = $derived(hasActivity(industryMastery));
  const hasExtras = $derived(hasLanguageActivity || hasIndustryActivity);

  // Country badges stay in the main grid; extra-topic badges (capitals/languages) move into
  // the combined panel so the main grid doesn't grow with every new mode.
  // Header Orbi (Phase 33): proud once the player has mastered something, else a friendly wave.
  const heroPose = $derived(mastery && mastery.overall.fullyMastered > 0 ? 'proud' : 'wave');

  const countryAchievements = $derived(achievements.filter((a) => !a.topic));
  const extraAchievements = $derived(achievements.filter((a) => a.topic));
  // Badges that unlocked on this load — celebrated once via a dismissible banner.
  let unlockDismissed = $state(false);
  const justUnlocked = $derived(achievements.filter((a) => a.justUnlocked));

  // Badge-unlock chime (Phase 36): play the sparkle once when a first-time unlock surfaces on
  // this load, pairing the jingle with the celebration banner. Guarded to fire a single time.
  let unlockCuePlayed = false;
  $effect(() => {
    if (justUnlocked.length > 0 && !unlockCuePlayed) {
      unlockCuePlayed = true;
      sound.play('achievement');
    }
  });

  async function refresh(): Promise<void> {
    loading = true;
    sessions = await loadSessions();
    stats = computeStats(sessions);
    // Progress surfaces (Phase 16): mastery + recap + achievements, computed from the same
    // persisted state. loadAchievements also persists any first-time unlocks.
    [mastery, languageMastery, industryMastery, recap, achievements] = await Promise.all([
      loadMastery(),
      loadLanguageMastery(),
      loadIndustryMastery(),
      loadWeeklyRecap(),
      loadAchievements(),
    ]);
    loading = false;
  }

  // Load once storage is ready (App opens the store asynchronously at startup).
  $effect(() => {
    if ($storageReady) void refresh();
  });
</script>

<section class="progress">
  <div class="head">
    <PageHero title={$t('progress.title')} pose={heroPose} />
  </div>

  {#if $storageReady && !$persistent}
    <p class="warning" role="alert">{$t('settings.notPersisted')}</p>
  {/if}

  {#if loading}
    <p class="muted">{$t('progress.loading')}</p>
  {:else if !stats || sessions.length === 0}
    <div class="empty-state">
      <MascotScene pose="sleepy" size={116} />
      <p class="muted">{$t('progress.empty')}</p>
      <a class="cta" href="#/play">{$t('progress.play')}</a>
    </div>
  {:else}
    {@const s = stats}
    <!-- One-time "unlocked!" celebration for badges earned on this load. -->
    {#if justUnlocked.length > 0 && !unlockDismissed}
      <div class="unlock" role="status">
        <span class="unlock-mascot" aria-hidden="true">
          <Mascot pose="proud" animate="wiggle" size={52} />
        </span>
        <span class="unlock-text">
          {$t('progress.achievements.unlocked')}
          <strong>
            {justUnlocked.map((a) => $t(`progress.achievements.badges.${a.id}.title`)).join(', ')}
          </strong>
        </span>
        <button
          type="button"
          class="unlock-dismiss"
          onclick={() => (unlockDismissed = true)}
          aria-label={$t('progress.achievements.dismiss')}
        >
          ✕
        </button>
      </div>
    {/if}

    <!-- Overview tiles -->
    <div class="tiles">
      <div class="tile">
        <span class="value">{s.sessionCount}</span>
        <span class="label"><Icon name="play" size="0.9em" /> {$t('history.stats.sessions')}</span>
      </div>
      <div class="tile">
        <span class="value">{formatPercent(s.accuracy)}</span>
        <span class="label"><Icon name="target" size="0.9em" /> {$t('history.stats.accuracy')}</span
        >
      </div>
      <div class="tile">
        <span class="value">{formatDuration(s.avgAnswerMs)}</span>
        <span class="label"><Icon name="bolt" size="0.9em" /> {$t('history.stats.avgTime')}</span>
      </div>
      <div class="tile">
        <span class="value">{formatDuration(s.totalPlayMs)}</span>
        <span class="label"><Icon name="clock" size="0.9em" /> {$t('history.stats.playTime')}</span>
      </div>
    </div>

    <!-- This week's recap -->
    {#if recap}
      <div class="panel">
        <h2>{$t('progress.recap.title')}</h2>
        <WeeklyRecap {recap} />
      </div>
    {/if}

    <div class="p-grid">
      <!-- World mastery: blended meter + per-family breakdown, then per-region (stacked, Phase 41) -->
      {#if mastery}
        <div class="panel">
          <h2>{$t('progress.mastery.title')}</h2>
          <FamilyMasteryMeter {mastery} />
          <h3 class="subhead">{$t('progress.mastery.regionsTitle')}</h3>
          <FamilyRegionBreakdown regions={mastery.byRegion} variant="stacked" />
        </div>
      {/if}

      <!-- Achievements (country / skill / habit — extra-topic badges live in the panel below) -->
      {#if countryAchievements.length > 0}
        <div class="panel">
          <h2>{$t('progress.achievements.title')}</h2>
          <AchievementsGrid achievements={countryAchievements} />
        </div>
      {/if}

      <!-- Combined "extra knowledge" panel (Phase 23/24): capitals + languages (+ industries
         later) folded into one surface, each shown only once played. Kept separate from and
         smaller than the primary country-mastery panel above. -->
      {#if hasExtras || extraAchievements.length > 0}
        <div class="panel">
          <h2>{$t('progress.extras.title')}</h2>
          <p class="panel-sub">{$t('progress.extras.subtitle')}</p>
          <div class="topics">
            {#if languageMastery && hasLanguageActivity}
              <ExtraMasteryTopic
                mastery={languageMastery}
                titleKey="progress.languageMastery.title"
                learnedKey="progress.languageMastery.learned"
                regionsTitleKey="progress.languageMastery.regionsTitle"
                icon="languages"
              />
            {/if}
            {#if industryMastery && hasIndustryActivity}
              <ExtraMasteryTopic
                mastery={industryMastery}
                titleKey="progress.industryMastery.title"
                learnedKey="progress.industryMastery.learned"
                regionsTitleKey="progress.industryMastery.regionsTitle"
                icon="factory"
              />
            {/if}
          </div>
          {#if extraAchievements.length > 0}
            <h3 class="subhead">{$t('progress.extras.badgesTitle')}</h3>
            <AchievementsGrid achievements={extraAchievements} />
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .progress {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .muted {
    color: var(--color-muted);
  }

  /* Empty Progress: the sleepy globe stands in for the blank meters, above the message + CTA. */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.7rem;
    padding: 2rem 1rem 1rem;
  }

  .empty-state .cta {
    align-self: center;
  }

  .cta {
    align-self: flex-start;
    padding: 0.6rem 1.2rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-radius: var(--radius);
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

  .warning {
    margin: 0;
    padding: 0.6rem 0.8rem;
    color: var(--color-wrong);
    background: var(--color-wrong-bg);
    border: 1px solid var(--color-wrong);
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* One-time achievement-unlock banner */
  .unlock {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 0.9rem;
    background: var(--color-accent-weak);
    border: 2px solid var(--color-accent);
    border-radius: var(--radius);
  }

  .unlock-mascot {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--color-accent);
  }

  .unlock-text {
    flex: 1 1 auto;
    font-size: 0.92rem;
  }

  .unlock-dismiss {
    flex: 0 0 auto;
    padding: 0.15rem 0.4rem;
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }

  .unlock-dismiss:hover {
    color: var(--color-text);
  }

  .subhead {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  /* Combined extra-knowledge panel */
  .panel-sub {
    margin: -0.25rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  .topics {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Overview tiles */
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .tile {
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

  .tile .value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .tile .label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--color-muted);
    text-align: center;
  }

  .tile .label :global(.icon) {
    color: var(--color-accent);
  }

  /* Panels */
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    min-width: 0;
  }

  .panel h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  /* Desktop (Phase 34): the stat row + recap stay full-width above; the mastery, achievements
     and extra-knowledge panels flow into a multi-column dashboard rather than one tall column.
     Auto-fit keeps a single panel full-width and never drops below a readable ~420px. */
  .p-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  @media (min-width: 860px) {
    .p-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      align-items: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cta {
      transition: none;
    }

    .cta:hover {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .tiles {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
