<script lang="ts">
  // Received Grandmaster-invite screen (Phase 46b) — the deep-link target for
  // `#/challenge-invite?c=…`. A certified friend dares you to sweep the same continent × family in
  // the one-life arena. Everything rides in the code, so this works on a cold PWA start with no prior
  // state; a missing / corrupt code shows a friendly "broken link" state.
  //
  // Unlike a duel, there's no seed and no score — it's a pass/fail mastery test on the receiver's own
  // board. Crucially, the arena is **gated**: you can only attempt a family × continent you've already
  // fully mastered (`isChallengeUnlocked`). So this screen resolves to one of four states once
  // storage is ready: LOCKED (you haven't mastered it yet — the owner's requirement), COOLDOWN
  // (today's one attempt is spent), or the ACCEPT offer (optionally noting you're already certified).
  // Accepting stages `pendingChallenge` and launches `#/challenge`, exactly like the Home / Progress
  // entries. The return leg is silent by design (OQ7).
  import { push, router } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import {
    challengeSlotCount,
    decodeGmInvite,
    estimateChallengeMinutes,
    filterCountries,
    isChallengeUnlocked,
    type FamilyMasteryResult,
    type GrandmasterInvitePayload,
  } from '../../domain';
  import { getCountries } from '../../data';
  import { readChallengeInviteQuery } from '../challenge-invite';
  import { challenge, lastChallengeSummary, pendingChallenge } from '../stores/challenge';
  import {
    grandmasterKey,
    loadGrandmaster,
    loadMastery,
    storageReady,
    type GrandmasterState,
  } from '../stores/persistence';
  import ChallengerOrbi from '../components/ChallengerOrbi.svelte';

  const query = $derived(readChallengeInviteQuery(router.querystring));
  const decoded = $derived(query ? decodeGmInvite(query.code) : null);
  const payload = $derived(decoded?.ok ? decoded.payload : null);

  // Mastery + Grandmaster state gate which landing the receiver sees. Loaded once storage is ready
  // (mirrors Home); the decode itself needs no storage, so a broken code fails instantly.
  let mastery = $state<FamilyMasteryResult | null>(null);
  let grandmaster = $state<GrandmasterState | null>(null);
  $effect(() => {
    if ($storageReady) {
      void loadMastery().then((m) => (mastery = m));
      void loadGrandmaster().then((g) => (grandmaster = g));
    }
  });

  const ready = $derived(!!mastery && !!grandmaster);
  const key = $derived(payload ? grandmasterKey(payload.family, payload.region) : '');
  const unlocked = $derived(
    !!payload && !!mastery && isChallengeUnlocked(mastery, payload.family, payload.region),
  );
  const certified = $derived(!!grandmaster && grandmaster.certified.has(key));
  const spentToday = $derived(!!grandmaster && grandmaster.spentToday.has(key));
  const slots = $derived(
    payload
      ? challengeSlotCount(
          payload.family,
          filterCountries(getCountries(), { region: payload.region }),
        )
      : 0,
  );
  const minutes = $derived(estimateChallengeMinutes(slots));
  const scope = $derived(
    payload ? `${$t(`modes.group.${payload.family}`)} · ${$localizedRegion(payload.region)}` : '',
  );

  function accept(p: GrandmasterInvitePayload): void {
    // Stage the run and launch the arena — same handoff as the Home / Progress "prove it" entries.
    challenge.reset();
    lastChallengeSummary.set(null);
    pendingChallenge.set({ family: p.family, region: p.region });
    push('/challenge');
  }
  const goProgress = (): void => {
    void push('/progress');
  };
  const goHome = (): void => {
    void push('/');
  };
</script>

<section class="invite">
  {#if !payload}
    <div class="card broken">
      <ChallengerOrbi size={92} />
      <h1>{$t('challenge.friendInvite.brokenTitle')}</h1>
      <p class="muted">{$t('challenge.friendInvite.brokenBody')}</p>
      <button type="button" class="btn ghost" onclick={goHome}>
        {$t('challenge.friendInvite.home')}
      </button>
    </div>
  {:else if !ready}
    <div class="card loading" role="status" aria-live="polite">
      <ChallengerOrbi size={92} />
      <p class="muted">{$t('challenge.friendInvite.loading')}</p>
    </div>
  {:else if payload && !unlocked}
    <!-- LOCKED: the receiver hasn't mastered this family × continent yet, so the arena can't open. -->
    <div class="card locked">
      <div class="hero dim"><ChallengerOrbi size={104} /></div>
      <p class="eyebrow">
        {payload.challengerName
          ? $t('challenge.friendInvite.incomingTitle', { name: payload.challengerName })
          : $t('challenge.friendInvite.incomingTitleAnon')}
      </p>
      <p class="scope">{scope}</p>
      <h1 class="lock-title">{$t('challenge.friendInvite.locked.title')}</h1>
      <p class="body">{$t('challenge.friendInvite.locked.body', { scope })}</p>
      <div class="actions">
        <button type="button" class="btn accept" onclick={goProgress}>
          {$t('challenge.friendInvite.locked.cta')}
        </button>
        <button type="button" class="btn ghost" onclick={goHome}>
          {$t('challenge.friendInvite.home')}
        </button>
      </div>
    </div>
  {:else if payload && spentToday}
    <!-- COOLDOWN: today's one attempt for this capstone is already spent. -->
    <div class="card cooldown">
      <div class="hero"><ChallengerOrbi size={104} /></div>
      <p class="scope">{scope}</p>
      <h1 class="cool-title">{$t('challenge.friendInvite.cooldown.title')}</h1>
      <p class="body">
        {certified
          ? $t('challenge.friendInvite.alreadyCertified', { scope })
          : $t('challenge.friendInvite.cooldown.body', { scope })}
      </p>
      <button type="button" class="btn ghost" onclick={goHome}>
        {$t('challenge.friendInvite.home')}
      </button>
    </div>
  {:else if payload}
    <!-- ACCEPT: unlocked and today's attempt is free — offer the run with its real stakes. -->
    <div class="card offer">
      <div class="hero"><ChallengerOrbi size={104} /></div>
      <p class="eyebrow">
        {payload.challengerName
          ? $t('challenge.friendInvite.incomingTitle', { name: payload.challengerName })
          : $t('challenge.friendInvite.incomingTitleAnon')}
      </p>
      <h1 class="offer-title">{$t('challenge.friendInvite.subtitle')}</h1>
      <p class="scope big">{scope}</p>
      {#if certified}
        <p class="certified">{$t('challenge.friendInvite.alreadyCertified', { scope })}</p>
      {/if}

      <div class="stakes">
        <div class="stake">
          <span class="stake-value questions">{slots}</span>
          <span class="stake-label">{$t('challenge.offer.questionsLabel')}</span>
        </div>
        <div class="stake">
          <span class="stake-value time">~{minutes}</span>
          <span class="stake-label">{$t('challenge.offer.timeLabel')}</span>
        </div>
        <div class="stake">
          <span class="stake-value life">1</span>
          <span class="stake-label">{$t('challenge.offer.lifeLabel')}</span>
        </div>
      </div>

      <p class="warn">{$t('challenge.offer.warning')}</p>

      <div class="actions">
        <button type="button" class="btn ghost" onclick={goHome}>
          {$t('challenge.friendInvite.decline')}
        </button>
        <button type="button" class="btn accept" onclick={() => accept(payload)}>
          {$t('challenge.friendInvite.accept')}
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  /* A ceremonial dark-teal takeover matching the arena / offer modal (the `--g-*` tokens are global).
     Full-viewport so a deep-link lands in the gauntlet's world, not the light app. */
  .invite {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
    background: radial-gradient(150% 100% at 50% 4%, var(--g-bg2), var(--g-bg) 68%);
    color: var(--g-ink);
    overflow-y: auto;
  }

  .card {
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1.8rem 1.4rem;
    text-align: center;
    background: var(--g-entry);
    border: 1px solid var(--g-line);
    border-radius: 18px;
    box-shadow:
      0 24px 60px rgb(0 0 0 / 45%),
      inset 0 1px 0 rgb(255 255 255 / 8%);
  }

  .hero {
    filter: drop-shadow(0 0 22px color-mix(in oklab, var(--g-ember), transparent 55%));
  }

  .hero.dim {
    opacity: 0.55;
    filter: grayscale(0.4);
  }

  h1 {
    margin: 0.2rem 0 0;
    font-family: var(--g-display, inherit);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .offer-title {
    background: var(--gold-metal);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .lock-title,
  .cool-title {
    color: var(--g-ink);
  }

  .eyebrow {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--g-ember);
  }

  .scope {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--g-teal);
  }

  .scope.big {
    font-size: 0.95rem;
  }

  .body {
    margin: 0.2rem 0 0;
    color: var(--g-dim);
    max-width: 22rem;
  }

  .certified {
    margin: 0;
    padding: 0.3rem 0.8rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--g-gold);
    background: color-mix(in oklab, var(--g-gold), transparent 88%);
    border: 1px solid color-mix(in oklab, var(--g-gold), transparent 62%);
    border-radius: 999px;
  }

  .muted {
    margin: 0;
    color: var(--g-dim);
  }

  .stakes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.55rem;
    width: 100%;
    margin: 0.5rem 0 0.2rem;
  }

  .stake {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.7rem 0.5rem;
    background: rgb(0 0 0 / 22%);
    border: 1px solid var(--g-line);
    border-radius: 12px;
  }

  .stake-value {
    font-family: var(--g-mono);
    font-size: 1.7rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .stake-value.questions {
    color: var(--g-gold);
  }

  .stake-value.time {
    color: var(--g-dim);
  }

  .stake-value.life {
    color: var(--g-crimson);
  }

  .stake-label {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--g-dim);
  }

  .warn {
    width: 100%;
    margin: 0.3rem 0 0;
    padding: 0.55rem 0.75rem;
    text-align: left;
    font-weight: 700;
    color: var(--g-ink);
    background: color-mix(in oklab, var(--g-crimson), transparent 88%);
    border-left: 3px solid var(--g-crimson);
    border-radius: 0 8px 8px 0;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 0.7rem;
    width: 100%;
    margin-top: 0.6rem;
  }

  .btn {
    flex: 1 1 0;
    padding: 0.7rem 1rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.95rem;
    border: 1px solid transparent;
  }

  .ghost {
    color: var(--g-dim);
    background: transparent;
    border-color: var(--g-line);
  }

  .ghost:hover {
    color: var(--g-ink);
    border-color: var(--g-teal);
  }

  .accept {
    color: #4a2f00;
    background: var(--g-cta);
    border: none;
    box-shadow: var(--g-cta-shadow);
  }

  .accept:hover {
    filter: brightness(1.04);
  }

  .accept:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #9c7328;
  }
</style>
