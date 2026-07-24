<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { get } from 'svelte/store';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import { formatDuration, formatPercent } from '../format';
  import {
    play,
    lastSummary,
    lastBlitzResult,
    lastRunConfig,
    pendingConfig,
    pendingDuel,
    practiceToConfig,
  } from '../stores/game';
  import {
    loadRank,
    loadRecommendations,
    prefs,
    storageReady,
    updatePrefs,
    type RankState,
  } from '../stores/persistence';
  import {
    pickSummaryReaction,
    rankForXp,
    sessionXp,
    sessionXpBreakdown,
    encodeDuel,
    isDuelType,
    duelScore,
    duelVerdict,
    MIN_DUEL_QUESTIONS,
    type MascotPose,
    type Recommendation,
  } from '../../domain';
  import {
    buildDuelPayload,
    buildReturnPayload,
    duelLink,
    shareDuel,
    shareDuelSmart,
    renderDuelCard,
    copyToClipboard,
    copyImageToClipboard,
  } from '../duel';
  import { getCountry, type Country } from '../../data';
  import { isBackendConfigured } from '../../backend/client';
  import { identity } from '../stores/identity';
  import { friends, type FriendRow } from '../stores/friends';
  import {
    send as sendInboxDuel,
    submit as submitInboxDuel,
    pendingInboxDuelId,
    outbox,
  } from '../stores/duels';
  import { sound } from '../sound';
  import DuelNamePrompt from '../components/DuelNamePrompt.svelte';
  import DuelQrModal from '../components/DuelQrModal.svelte';
  import DuelVerdictCard from '../components/DuelVerdictCard.svelte';
  import DuelShareCard from '../components/DuelShareCard.svelte';
  import Toast from '../components/Toast.svelte';
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

  // The full rank snapshot *before* this run (total XP minus the run's "+N XP"). When the run pushed
  // the player over a rank threshold this is a lower rank than `rank.progress`, so the card can open
  // on the rank they were at and animate the roll-over into the one they reached (level-up) rather
  // than jumping straight to the new rank with an empty bar.
  const startProgress = $derived(rank ? rankForXp(Math.max(0, rank.xp.total - xpEarned)) : null);

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

  // "Rank up!" celebration (Phase 43+): Summary is the primary post-session moment. The achievement
  // jingle fires once when this load crossed a rank threshold (the jingle obeys the sound toggle
  // inside `sound.play`). The *visual* — a confetti burst off the new-rank badge — is rendered by
  // SessionXpCard via its `rankedUp` prop, so it's anchored on the badge itself.
  let rankUpFired = false;

  $effect(() => {
    if (!rank?.justRankedUp || rankUpFired) return;
    rankUpFired = true;
    sound.play('achievement');
  });

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
    // A targeted-practice run (fixed / survival / blitz over a picked set) carries an explicit
    // `answerPool` and no region filter — re-run that same custom set, not the whole world. Preserve
    // the format, and re-thread the saved-set id (from the still-live run config) so a Blitz best
    // keeps tracking against the set it was played from.
    if (s.answerPool && s.answerPool.length) {
      const setId = get(play).config?.setId;
      pendingConfig.set(practiceToConfig(s.mode, s.type, s.answerPool, p, setId));
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
    // A training run is never a duel — drop any staged duel context so the next Summary shows a
    // normal result, not a stale verdict (the staged id no longer self-clears on submit).
    pendingDuel.set(null);
    pendingInboxDuelId.set(null);
    push('/play');
  }

  function newGame(): void {
    play.reset();
    pendingConfig.set(null);
    pendingDuel.set(null);
    pendingInboxDuelId.set(null); // a fresh run is never a pending inbox duel (Phase 54)
    push('/play');
  }

  // --- Duel a friend (Phase 46) ---------------------------------------------------------------
  // Offer a duel only from a reproducible, prefs-independent run: a duel-able format (fixed /
  // survival / full / blitz), seeded, with enough questions — and *not* the Daily (its own flow) or
  // an explicit-pool run (training / targeted practice, whose pool is player/SR-derived and wouldn't
  // reproduce on the friend's device). The last two are read from the run's config, which the
  // SessionSummary alone can't distinguish from an ordinary region/world run.
  const duelable = $derived.by(() => {
    const s = $lastSummary;
    if (!s || s.seed === undefined || !isDuelType(s.type) || s.total < MIN_DUEL_QUESTIONS) {
      return false;
    }
    const cfg = $lastRunConfig;
    if (cfg?.dailyDate) return false;
    if (cfg?.answerPoolIso?.length || cfg?.answerSlots?.length) return false;
    return true;
  });

  // A finished *received* duel: the run's seed matches the challenge the player accepted (set by the
  // #/duel route). While it holds, show the head-to-head verdict + "send result back" / "rematch"
  // instead of the generic "Duel a friend" affordance.
  const duelResponse = $derived.by(() => {
    const s = $lastSummary;
    const challenge = $pendingDuel;
    if (!s || !challenge || s.seed !== challenge.seed || !isDuelType(s.type)) return null;
    const myScore = duelScore(challenge.type, s);
    return { challenge, myScore, verdict: duelVerdict(myScore, challenge.challengerScore) };
  });

  // --- Inbox duel (Phase 54) -------------------------------------------------------------------
  // ADDITIVE to the Phase-46 link flow. When the finished run is a received *inbox* duel (an id was
  // staged by the #/duels accept), auto-write MY score back to the server row — no "send result back"
  // link, no lost challenge. `wasInboxResponse` picks the verdict variant (no return-leg / rematch);
  // the challenger sees the outcome in their own history.
  // Deterministic: a received *inbox* duel is one where a server row id is staged AND this run is the
  // matching duel response. Derived (not a post-render flag) so the verdict renders in its inbox
  // variant from the first paint — no "send result" leg flashes, because the result is written
  // straight back to the row. The staged id is cleared when the player leaves Summary (newGame /
  // train), so it stays set while this screen is shown; a stale id can't misfire because
  // `duelResponse` also has to match this run's seed.
  const wasInboxResponse = $derived(duelResponse !== null && $pendingInboxDuelId !== null);
  let inboxSubmitted = $state(false);
  $effect(() => {
    const r = duelResponse;
    const id = $pendingInboxDuelId;
    if (!r || !id || inboxSubmitted) return;
    inboxSubmitted = true;
    // Best-effort auto-write of MY score to the server row; the challenger sees it in their history.
    // Idempotent — writing the same score again on a re-mount is harmless.
    void submitInboxDuel(id, r.myScore);
  });

  // "Challenge a friend directly" — the additive send channel (backend + real account + ≥1 friend).
  // The Phase-46 link / QR / code options are always present regardless (the backend-free path).
  const canInboxSend = $derived(
    isBackendConfigured() && $identity.tier === 'account' && $friends.length > 0,
  );

  // When direct send isn't available but the backend exists, show the "Send directly" section as a
  // greyed teaser that nudges the missing step — an account (anonymous) or a friend (no friends yet).
  // With no backend at all there's nothing to unlock, so it stays hidden (the link path is enough).
  const directLocked = $derived<'account' | 'friends' | null>(
    canInboxSend
      ? null
      : !isBackendConfigured()
        ? null
        : $identity.tier !== 'account'
          ? 'account'
          : 'friends',
  );
  function unlockDirect(): void {
    push(directLocked === 'account' ? '/settings' : '/');
  }
  let duelSendMsg = $state<string | null>(null);
  let sendMsgTimer: ReturnType<typeof setTimeout> | null = null;

  // Friends already challenged with THIS run, so we never send them the same duel twice (a friend
  // getting spammed with the identical challenge). Two sources: an immediate in-session record (closes
  // the async-send window), and the server outbox scoped to this run's seed (survives a reload). Both
  // are seed-scoped so a different run starts fresh.
  let sentThisRun = $state<{ seed: number; id: string }[]>([]);
  const challengedIds = $derived.by(() => {
    const s = $lastSummary;
    if (!s || s.seed === undefined) return [];
    const ids: string[] = [];
    const add = (id: string): void => {
      if (!ids.includes(id)) ids.push(id);
    };
    for (const e of sentThisRun) if (e.seed === s.seed) add(e.id);
    for (const e of $outbox) if (e.payload.seed === s.seed) add(e.otherUserId);
    return ids;
  });

  async function sendToFriend(friend: FriendRow): Promise<void> {
    const s = $lastSummary;
    if (!s || s.seed === undefined) return;
    if (challengedIds.includes(friend.userId)) return; // already sent this run — don't duplicate
    const name = $prefs.playerName ?? '';
    const payload = buildDuelPayload(s, name);
    if (!payload) return;
    const result = await sendInboxDuel(
      friend.userId,
      encodeDuel(payload),
      payload.challengerScore,
      name,
    );
    const who = friend.displayName || $t('board.anon');
    if (result === 'ok') sentThisRun = [...sentThisRun, { seed: s.seed, id: friend.userId }];
    duelSendMsg =
      result === 'ok'
        ? $t('duels.sent', { name: who })
        : result === 'not-friends'
          ? $t('duels.notFriends')
          : $t('duels.sendFailed');
    if (sendMsgTimer) clearTimeout(sendMsgTimer);
    sendMsgTimer = setTimeout(() => (duelSendMsg = null), 2600);
  }

  // One primary "Challenge a friend" tap (`share`) does the right thing per device (image + link on
  // mobile, link on desktop); `image` copies the scorecard to the clipboard (desktop paste); `link` /
  // `code` are the quiet fallbacks; `return` sends a result back.
  type DuelShareAction = 'share' | 'image' | 'link' | 'qr' | 'return';
  let namePromptOpen = $state(false);
  let pendingAction = $state<DuelShareAction | null>(null);
  let duelFeedback = $state<string | null>(null);
  // "Show QR" opens a full-screen, scannable card for offline share (no chat app / network).
  let qrOpen = $state(false);
  let qrView = $state<{ url: string; eyebrow: string; context: string } | null>(null);
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  function flashFeedback(key: string): void {
    duelFeedback = key;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => (duelFeedback = null), 2600);
  }

  /** Build the localised scorecard text + share strings for the current run. */
  function duelCardText(payloadPrimary: number, name: string) {
    const s = $lastSummary!;
    const regionKey = s.regionFilter?.subregion ?? s.regionFilter?.region;
    const isBlitz = s.type === 'blitz';
    return {
      eyebrow: name ? $t('duel.incomingTitle', { name }) : $t('duel.incomingTitleAnon'),
      scoreValue: isBlitz
        ? payloadPrimary.toLocaleString()
        : s.type === 'survival'
          ? s.total.toLocaleString()
          : `${s.correct}/${s.total}`,
      scoreUnit: isBlitz ? $t('duel.points') : '',
      scope: `${$t(MODE_LABEL[s.mode] ?? s.mode)} · ${
        regionKey ? $localizedRegion(regionKey) : $t('duel.scopeWorld')
      }`,
      cta: $t('duel.cardCta'),
      brand: $t('app.title'),
    };
  }

  async function runDuelAction(action: DuelShareAction, name: string): Promise<void> {
    const s = $lastSummary;
    if (!s) return;
    // "Send result back": a #/duel?r=… link the original challenger opens to see who won.
    if (action === 'return') {
      const challenge = $pendingDuel;
      if (!challenge) return;
      const url = duelLink(encodeDuel(buildReturnPayload(challenge, name, s)), 'r');
      const text = name ? $t('duel.resultShareText', { name }) : $t('duel.resultShareTextAnon');
      if ((await shareDuel(url, { title: $t('duel.shareTitle'), text })) === 'copied') {
        flashFeedback('duel.linkCopied');
      }
      return;
    }
    const payload = buildDuelPayload(s, name);
    if (!payload) return;
    const code = encodeDuel(payload);
    const url = duelLink(code, 'c');
    // "Show QR": a scannable full-screen card — the friend's camera opens the challenge, fully offline.
    if (action === 'qr') {
      const card = duelCardText(payload.challengerScore.primary, name);
      const beat =
        s.type === 'blitz'
          ? $t('duel.targetPoints', { score: card.scoreValue })
          : $t('duel.targetScore', { score: card.scoreValue });
      qrView = { url, eyebrow: card.eyebrow, context: `${card.scope} · ${beat}` };
      qrOpen = true;
      return;
    }
    if (action === 'link') {
      if (await copyToClipboard(url)) flashFeedback('duel.linkCopied');
      return;
    }
    // "Copy image": put the scorecard PNG on the clipboard so it can be pasted into a chat (desktop).
    if (action === 'image') {
      const blob = await renderDuelCard(duelCardText(payload.challengerScore.primary, name));
      flashFeedback(
        blob && (await copyImageToClipboard(blob)) ? 'duel.imageCopied' : 'duel.imageFailed',
      );
      return;
    }
    // Primary: image + link caption where the device can share files, else the link.
    const text = name ? $t('duel.shareText', { name }) : $t('duel.shareTextAnon');
    const card = duelCardText(payload.challengerScore.primary, name);
    const outcome = await shareDuelSmart(card, { title: $t('duel.shareTitle'), text, url });
    if (outcome === 'copied') flashFeedback('duel.linkCopied');
    else if (outcome === 'failed') flashFeedback('duel.imageFailed');
  }

  // A duel embeds the player's name; capture it once (first duel) before the first share, then reuse.
  function onDuelAction(action: DuelShareAction): void {
    const name = $prefs.playerName ?? '';
    if (!name) {
      pendingAction = action;
      namePromptOpen = true;
      return;
    }
    void runDuelAction(action, name);
  }

  function onDuelNameSave(name: string): void {
    updatePrefs({ playerName: name });
    namePromptOpen = false;
    const action = pendingAction;
    pendingAction = null;
    if (action) void runDuelAction(action, name);
  }

  function onDuelNameCancel(): void {
    namePromptOpen = false;
    pendingAction = null;
  }

  // Live scorecard preview shown in the duel card: it confirms what gets sent and is directly
  // copy/paste-able on desktop (alongside the "Copy image" button). Re-renders when the run or the
  // player's name changes; stays null when there's nothing to preview or canvas is unavailable.
  let duelPreviewUrl = $state<string | null>(null);
  $effect(() => {
    const s = $lastSummary;
    const name = $prefs.playerName ?? '';
    if (!duelable || !s) {
      duelPreviewUrl = null;
      return;
    }
    const payload = buildDuelPayload(s, name);
    if (!payload) return;
    let stale = false;
    void renderDuelCard(duelCardText(payload.challengerScore.primary, name)).then((blob) => {
      if (stale || !blob) return;
      if (duelPreviewUrl) URL.revokeObjectURL(duelPreviewUrl);
      duelPreviewUrl = URL.createObjectURL(blob);
    });
    return () => {
      stale = true;
    };
  });
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

    <!-- Duel verdict (Phase 46/54): for a finished *received* duel the head-to-head result IS the
         headline, so it sits at the very top. A server (inbox) duel auto-wrote the result → verdict
         only; a link/QR duel keeps its "send result back" leg. Rematch was removed (duel from the
         Session History instead). -->
    {#if duelResponse}
      <DuelVerdictCard
        verdict={duelResponse.verdict}
        type={duelResponse.challenge.type}
        youScore={duelResponse.myScore}
        theirScore={duelResponse.challenge.challengerScore}
        theirName={duelResponse.challenge.challengerName}
        onSendResult={wasInboxResponse ? undefined : () => onDuelAction('return')}
        feedback={wasInboxResponse ? null : duelFeedback}
      />
    {/if}

    <p class="meta">
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
    </p>

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
        {:else if br.best !== null}
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
      {startProgress}
      {startFraction}
      reduceMotion={$prefs.reduceMotion}
      rankedUp={rank?.justRankedUp ?? false}
    />

    <!-- One-time "Rank up!" (Phase 43): shown when this run crossed a rank threshold. -->
    {#if rank?.justRankedUp}
      <div class="rank-up" role="status">
        <Mascot pose="cheer" animate="bounce-in" size={64} />
        <strong>{$t('rank.rankUp')}</strong>
      </div>
    {/if}

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

    {#if recs && recs.length}
      <NextUpCard rec={recs[0]} />
    {/if}

    <div class="actions">
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
    </div>

    <!-- Duel a friend — the "start a fresh challenge" offer, shown only for a reproducible run that
         isn't itself a received-duel response (that verdict renders at the top). Link / QR / code is
         the backend-free path; a connected account with friends also gets a direct inbox send. The
         name is captured once on first use. -->
    {#if duelable && !duelResponse}
      <DuelShareCard
        previewUrl={duelPreviewUrl}
        {canInboxSend}
        friends={$friends}
        sentIds={challengedIds}
        {directLocked}
        onShare={() => onDuelAction('share')}
        onCopyImage={() => onDuelAction('image')}
        onCopyLink={() => onDuelAction('link')}
        onShowQr={() => onDuelAction('qr')}
        onPickFriend={sendToFriend}
        onUnlock={unlockDirect}
      />
    {/if}

    <DuelNamePrompt
      open={namePromptOpen}
      initial={$prefs.playerName ?? ''}
      onsave={onDuelNameSave}
      oncancel={onDuelNameCancel}
    />

    <DuelQrModal
      open={qrOpen}
      url={qrView?.url ?? ''}
      eyebrow={qrView?.eyebrow ?? ''}
      context={qrView?.context ?? ''}
      onClose={() => (qrOpen = false)}
    />

    <!-- Duel share / send status, moved out of the card into a transient toast (fixed-position). -->
    <Toast message={duelSendMsg ?? (duelFeedback ? $t(duelFeedback) : '')} />

    <!-- New-best burst overlay (Phase 42): fixed-position, so its place in the tree is immaterial;
         `{#key}` mounts a fresh instance so the one-shot animation plays once. -->
    {#if burstTier >= 0}
      {#key burstKey}
        <StreakBurst tier={burstTier} x={burstX} y={burstY} />
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

  /* Rank-up celebration: cheering Orbi beside a compact "Rank up!", on the accent tint. The rank
     itself isn't spelled out here — the badge + rank name on the XP card above already show it. */
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

  .rank-up strong {
    color: var(--color-accent-strong);
    font-size: 1.05rem;
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
