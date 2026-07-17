<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import {
    computeStats,
    computeBlitzBests,
    challengeSlotCount,
    filterCountries,
    GRANDMASTER_TOTAL,
    type BlitzBestEntry,
    type GameMode,
    type FamilyMasteryResult,
    type MasteryFamily,
    type MasteryResult,
    type StatsOverview,
    type WeeklyRecap as WeeklyRecapData,
  } from '../../domain';
  import { getCountries, type SessionRecord } from '../../data';
  import { formatDuration, formatPercent } from '../format';
  import { pendingConfig } from '../stores/game';
  import {
    challenge,
    justCertified,
    lastChallengeSummary,
    pendingChallenge,
  } from '../stores/challenge';
  import {
    loadSessions,
    loadMastery,
    loadRegionFamilyPractice,
    loadLanguageMastery,
    loadIndustryMastery,
    loadWeeklyRecap,
    loadAchievements,
    loadGrandmaster,
    loadRank,
    persistent,
    prefs,
    storageReady,
    type AchievementView,
    type GrandmasterState,
    type RankState,
  } from '../stores/persistence';
  import { sound } from '../sound';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import MascotScene from '../components/MascotScene.svelte';
  import PageHero from '../components/PageHero.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RankPanel from '../components/RankPanel.svelte';
  import FamilyMasteryMeter from '../components/FamilyMasteryMeter.svelte';
  import FamilyRegionBreakdown from '../components/FamilyRegionBreakdown.svelte';
  import GauntletOfferModal from '../components/GauntletOfferModal.svelte';
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
  let grandmaster = $state<GrandmasterState | null>(null);
  let rank = $state<RankState | null>(null);
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

  /**
   * Per-family "practise" shortcut on the world-mastery breakdown (Phase 41 follow-on): drill a
   * region×family's unmastered countries in its weaker direction. Launched like "Time to review"
   * — a region-scoped training run whose scope lives in `answerPoolIso` (so map-locate still
   * frames to the whole region). No-op if the family turns out fully mastered (button hidden then).
   */
  async function practiseRegionFamily(region: string, family: MasteryFamily): Promise<void> {
    const pool = await loadRegionFamilyPractice(region, family);
    if (!pool || pool.iso2s.length === 0) return;
    pendingConfig.set({
      mode: pool.mode,
      type: 'training',
      answerPoolIso: pool.iso2s,
      fixedLength: pool.iso2s.length,
      choices: $prefs.choicesPerQuestion,
    });
    push('/play');
  }

  // Blitz personal bests (Phase 42): the top score per mode × region slot, derived from the same
  // history already loaded here. Shown only once the player has played at least one Blitz run.
  const blitzBests = $derived(computeBlitzBests(sessions));
  const BLITZ_MODE_LABEL: Record<GameMode, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
    'capital-to-country': 'modes.capitalToCountry',
    'country-to-capital': 'modes.countryToCapital',
    'country-to-languages': 'modes.countryToLanguages',
    'country-to-industry': 'modes.mainIndustries',
  };
  // The slot's region label: the sub-region if scoped to one, else the region, else "World".
  const blitzSlotRegion = (b: BlitzBestEntry): string =>
    b.subregion
      ? $localizedRegion(b.subregion)
      : b.region
        ? $localizedRegion(b.region)
        : $t('progress.blitz.world');

  // The main grid excludes extra-topic badges (they have their own panel). The Grandmaster capstones
  // are not badges at all (Phase 45) — they live in the dedicated `grandmaster` store and surface in
  // the World Mastery panel as gilded cells, so they never appear here.
  const countryAchievements = $derived(achievements.filter((a) => !a.topic));
  const extraAchievements = $derived(achievements.filter((a) => a.topic));

  // Grandmaster Run reward (Phase 44/45, design A + C). Certification + the daily cooldown come from
  // the dedicated `grandmaster` store (XP-neutral, decoupled from history): `certifiedSet` gilds each
  // passed family × continent cell and `certifiedCount` feeds the prestige headline; `spentToday`
  // gates a second same-day attempt. The prestige bar only appears once a run is either certified or
  // unlockable, so it never shows a discouraging "0 / 15" to a fresh player.
  const certifiedSet = $derived(grandmaster?.certified ?? new Set<string>());
  const spentToday = $derived(grandmaster?.spentToday ?? new Set<string>());
  const certifiedCount = $derived(certifiedSet.size);
  const hasUnlockableChallenge = $derived(
    !!mastery &&
      mastery.byRegion.some((r) => r.families.some((f) => f.total > 0 && f.mastered === f.total)),
  );
  const showPrestige = $derived(certifiedCount > 0 || hasUnlockableChallenge);
  const prestigePct = $derived(Math.round((certifiedCount / GRANDMASTER_TOTAL) * 100));

  // The Grandmaster Challenge offer (Phase 45 ③): the "prove it" cell no longer launches the run
  // directly — it opens a gated ceremonial modal stating the run's real stakes, and only Accept
  // stages the run + routes into the cinematic arena. When the family × region's daily attempt is
  // already spent (⑤), the modal opens in a cooldown state (Accept disabled + a countdown), so a
  // second same-day run is blocked at the entry point.
  let offer = $state<{
    family: MasteryFamily;
    region: string;
    slots: number;
    spent: boolean;
  } | null>(null);

  // Time until local midnight, captured at load — a coarse "come back later" cue, not a live timer.
  function formatTimeToMidnight(now: number): string {
    const d = new Date(now);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
    const mins = Math.max(0, Math.ceil((midnight - now) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  let cooldownAt = $state(Date.now());
  const cooldownText = $derived(
    $t('challenge.cooldown.next', { time: formatTimeToMidnight(cooldownAt) }),
  );

  /** Open the offer modal for a family × continent's "prove it" cell (with its real slot count). */
  function launchChallenge(region: string, family: MasteryFamily): void {
    const slots = challengeSlotCount(family, filterCountries(getCountries(), { region }));
    offer = { family, region, slots, spent: spentToday.has(`${family}|${region}`) };
  }

  /** Accept the offer: stage the run and enter the arena (the "enter" cue + intro fire there).
   *  Guarded — a spent (cooldown) family × region can't be started until local midnight. */
  function acceptChallenge(): void {
    if (!offer || offer.spent) return;
    const { family, region } = offer;
    offer = null;
    challenge.reset();
    lastChallengeSummary.set(null);
    pendingChallenge.set({ family, region });
    push('/challenge');
  }

  // The unlock banner names each just-earned badge via its `badges.<id>` key (capstones are no longer
  // badges — a freshly-certified run is celebrated by its own `justCertified` toast below).
  const badgeTitle = (a: AchievementView): string =>
    $t(`progress.achievements.badges.${a.id}.title`);

  // The composed capstone title for the "Grandmaster unlocked" toast (family + continent labels).
  const capstoneTitle = (family: MasteryFamily, region: string): string =>
    $t('challenge.badge.title', {
      family: $t(`modes.group.${family}`),
      region: $localizedRegion(region),
    });
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
    // Progress shows the rank/XP bar but is display-only (commit:false) — it never consumes the
    // one-time "rank up!" moment, which is celebrated on Summary/Home (Phase 43).
    cooldownAt = Date.now();
    [mastery, languageMastery, industryMastery, recap, achievements, grandmaster, rank] =
      await Promise.all([
        loadMastery(),
        loadLanguageMastery(),
        loadIndustryMastery(),
        loadWeeklyRecap(),
        loadAchievements(),
        loadGrandmaster(),
        loadRank(Date.now(), { commit: false }),
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
    <!-- One-time "Grandmaster certified!" toast (Phase 45): set by a clean-sweep run as it returned
         from the arena. The in-arena victory bloom is the primary celebration; this is the quieter
         Progress-side acknowledgement, gilded gold. Dismiss clears the session-scoped handoff. -->
    {#if $justCertified}
      <div class="unlock gm-unlock" role="status">
        <span class="unlock-mascot" aria-hidden="true">
          <Mascot pose="proud" animate="wiggle" size={52} />
        </span>
        <span class="unlock-text">
          {$t('challenge.certifiedToast')}
          <strong>{capstoneTitle($justCertified.family, $justCertified.region)}</strong>
        </span>
        <button
          type="button"
          class="unlock-dismiss"
          onclick={() => justCertified.set(null)}
          aria-label={$t('progress.achievements.dismiss')}
        >
          ✕
        </button>
      </div>
    {/if}
    <!-- One-time "unlocked!" celebration for badges earned on this load. -->
    {#if justUnlocked.length > 0 && !unlockDismissed}
      <div class="unlock" role="status">
        <span class="unlock-mascot" aria-hidden="true">
          <Mascot pose="proud" animate="wiggle" size={52} />
        </span>
        <span class="unlock-text">
          {$t('progress.achievements.unlocked')}
          <strong>
            {justUnlocked.map(badgeTitle).join(', ')}
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

    <!-- Explorer rank & XP (Phase 43): the continuous progression headline above the panels. -->
    {#if rank}
      <div class="panel">
        <h2>{$t('rank.title')}</h2>
        <RankPanel xp={rank.xp} progress={rank.progress} />
      </div>
    {/if}

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

          <!-- Grandmaster prestige bar (Phase 44, design C): how many family × continent runs are
               certified, toward all 15. Gilds fully at 15/15 — the reason to chase the last one.
               Hidden until a run is certified or unlockable, so beginners never see "0 / 15". -->
          {#if showPrestige}
            <div class="prestige" class:complete={certifiedCount === GRANDMASTER_TOTAL}>
              <div class="prestige-head">
                <span class="prestige-title">
                  <Icon name="crown" size="1em" />
                  {certifiedCount === GRANDMASTER_TOTAL
                    ? $t('challenge.prestigeComplete')
                    : $t('challenge.prestige')}
                </span>
                <span class="prestige-count">
                  {$t('challenge.prestigeCount', {
                    done: certifiedCount,
                    total: GRANDMASTER_TOTAL,
                  })}
                </span>
              </div>
              <div
                class="prestige-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax={GRANDMASTER_TOTAL}
                aria-valuenow={certifiedCount}
                aria-label={$t('challenge.prestige')}
              >
                <span class="prestige-fill" style="width:{prestigePct}%"></span>
              </div>
            </div>
          {/if}

          <h3 class="subhead">{$t('progress.mastery.regionsTitle')}</h3>
          <FamilyRegionBreakdown
            regions={mastery.byRegion}
            variant="stacked"
            onPractise={practiseRegionFamily}
            onChallenge={launchChallenge}
            certified={certifiedSet}
            spent={spentToday}
            {cooldownText}
          />
        </div>
      {/if}

      <!-- Blitz personal bests (Phase 42): top score per mode × region, best first. -->
      {#if blitzBests.length > 0}
        <div class="panel">
          <h2><Icon name="flame" size="1em" /> {$t('progress.blitz.title')}</h2>
          <p class="panel-sub">{$t('progress.blitz.subtitle')}</p>
          <ul class="blitz-bests">
            {#each blitzBests as b, i (b.mode + '|' + (b.region ?? '') + '|' + (b.subregion ?? ''))}
              <li class="bb-row" class:bb-top={i === 0}>
                <span class="bb-ico" aria-hidden="true"><ModeIcon mode={b.mode} /></span>
                <span class="bb-label">
                  <span class="bb-mode">{$t(BLITZ_MODE_LABEL[b.mode])}</span>
                  <span class="bb-region">{blitzSlotRegion(b)}</span>
                </span>
                <span class="bb-points">
                  {b.points.toLocaleString()}<small>{$t('play.blitz.pts')}</small>
                </span>
              </li>
            {/each}
          </ul>
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
          {#if hasExtras}
            <!-- Visible key for the topic meters below (solid = mastered, lighter fill =
                 learning), so the two-tone bars are legible on touch, where they carry no
                 tooltip. Swatches match WorldMasteryMeter's accent / accent-weak fills. -->
            <div class="extra-key">
              <span class="ek-item"
                ><span class="ek-sw ek-mastered"></span>{$t('progress.mastery.mastered')}</span
              >
              <span class="ek-item"
                ><span class="ek-sw ek-learning"></span>{$t('progress.mastery.learning')}</span
              >
            </div>
          {/if}
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

{#if offer}
  <GauntletOfferModal
    open
    family={offer.family}
    region={offer.region}
    slots={offer.slots}
    spent={offer.spent}
    cooldown={cooldownText}
    onaccept={acceptChallenge}
    oncancel={() => (offer = null)}
  />
{/if}

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

  /* The Grandmaster capstone toast — gilded gold to set it apart from the teal badge banner. */
  .gm-unlock {
    background: var(--color-gold-weak);
    border-color: var(--color-gold);
  }

  .gm-unlock .unlock-mascot {
    color: var(--color-gold-deep);
  }

  .gm-unlock .unlock-text strong {
    color: var(--color-gold-ink);
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

  /* Grandmaster prestige bar (Phase 44, design C): the capstone headline inside the World Mastery
     panel. A soft gold card that gilds fully once all 15 are certified. */
  .prestige {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.65rem 0.75rem;
    border-radius: 14px;
    background: linear-gradient(180deg, var(--color-gold-weak), var(--color-surface));
    border: 1px solid var(--color-gold);
  }

  .prestige.complete {
    background: var(--gold-metal);
    border-color: var(--color-gold-deep);
  }

  .prestige-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .prestige-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 800;
    color: var(--color-gold-ink);
  }

  .prestige-title :global(.icon) {
    color: var(--color-gold-deep);
  }

  .prestige.complete .prestige-title,
  .prestige.complete .prestige-count,
  .prestige.complete .prestige-title :global(.icon) {
    color: var(--color-gold-ink);
  }

  .prestige-count {
    font-weight: 800;
    color: var(--color-gold-deep);
    font-variant-numeric: tabular-nums;
  }

  .prestige-track {
    height: 0.6rem;
    background: var(--color-surface);
    border: 1px solid var(--color-gold);
    border-radius: 999px;
    overflow: hidden;
  }

  .prestige.complete .prestige-track {
    background: rgb(255 255 255 / 55%);
    border-color: var(--color-gold-deep);
  }

  .prestige-fill {
    display: block;
    height: 100%;
    background: var(--gold-metal);
    transition: width 0.35s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .prestige-fill {
      transition: none;
    }
  }

  /* Combined extra-knowledge panel */
  .panel-sub {
    margin: -0.25rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  /* Visible state key for the extra-knowledge topic meters (mobile-friendly). */
  .extra-key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: var(--color-muted);
  }

  .ek-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .ek-sw {
    width: 0.85rem;
    height: 0.62rem;
    border-radius: 3px;
    border: 1px solid var(--color-border);
  }

  .ek-mastered {
    background: var(--color-accent);
  }

  .ek-learning {
    background: var(--color-accent-weak);
  }

  .topics {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Blitz personal-best list (Phase 42): a mode glyph, the slot label, and the score. The top
     row is emphasised (accent tint) so the headline best reads at a glance. */
  .blitz-bests {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .bb-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.7rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
  }

  .bb-top {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
  }

  .bb-ico {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--color-accent);
  }

  .bb-label {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .bb-mode {
    font-weight: 700;
    font-size: 0.92rem;
  }

  .bb-region {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .bb-points {
    flex: 0 0 auto;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent-strong);
  }

  .bb-points small {
    margin-left: 0.15rem;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--color-muted);
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
