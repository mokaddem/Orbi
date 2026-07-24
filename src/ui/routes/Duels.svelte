<script lang="ts">
  // Duels hub (Phase 54 · redesigned) — the `#/duels` route reached from the Home "duels" card.
  //
  // Layout: an always-visible HERO ("Your turn" — the pending duels friends sent me, the actionable
  // bit) sits at the top and never scrolls away; below it a segmented TRACK zone switches between
  // SENT (my pending outbox, with a "sent Xago" age + a 7-day expiry pill), SCOREBOARD (the per-friend
  // W/L rivalries — the default tab) and HISTORY (completed duels). Only one track pane is mounted at a
  // time, so the page stops growing without bound as history accumulates.
  //
  // Everything is read from the reactive `duels` store, which is gated on a configured backend + a real
  // account and no-ops offline; with no backend / no account it shows a connect-a-friend note (the full
  // Phase-46 link duel is unaffected — it lives on the Summary route).
  //
  // Accepting an inbox duel reuses the EXACT Phase-46 path: decode is already done by the store, so we
  // stage the decoded payload as `pendingDuel` + `duelToRunConfig` as `pendingConfig`, plus the row id
  // as `pendingInboxDuelId`, then launch `/play`. On finish (or a quit), the Summary writes my score
  // straight back to that row — no return link.
  //
  // Expiry is DISPLAY-ONLY: the pill is computed client-side from `created`; the server still accepts a
  // result on an "expired" duel. Server-enforced expiry is a deferred follow-up (see the phase PRD).
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import {
    inbox,
    outbox,
    history,
    refreshDuels,
    dismiss,
    decline,
    pendingInboxDuelId,
    type DuelEntry,
  } from '../stores/duels';
  import { duelToRunConfig } from '../duel';
  import { parseCreated, duelAge, duelExpiry, type DuelExpiry } from '../duelTime';
  import { pendingConfig, pendingDuel } from '../stores/game';
  import { identity } from '../stores/identity';
  import { isBackendConfigured } from '../../backend/client';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';

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

  // `preview` lets the duel gallery render the hub from fixtures, bypassing the gate + live stores +
  // refresh. Dev-only seam; production passes nothing and reads the real `inbox`/`outbox`/`history`.
  let {
    preview,
  }: {
    preview?: { gated?: boolean; inbox: DuelEntry[]; outbox: DuelEntry[]; history: DuelEntry[] };
  } = $props();

  // Inbox + history require a configured backend AND a real account (inherited from Phase 53).
  const gated = $derived(
    preview ? (preview.gated ?? false) : !isBackendConfigured() || $identity.tier !== 'account',
  );
  const inboxItems = $derived(preview ? preview.inbox : $inbox);
  const outboxItems = $derived(preview ? preview.outbox : $outbox);
  const historyItems = $derived(preview ? preview.history : $history);

  type Track = 'sent' | 'scoreboard' | 'history';
  let track = $state<Track>('scoreboard');

  // Refresh on load + focus/online (the App re-probe wiring). No idle polling.
  onMount(() => {
    if (!preview) void refreshDuels();
  });
  function refresh(): void {
    if (!preview) void refreshDuels();
  }

  function scopeRegion(p: DuelEntry['payload']): string {
    return p.subregion
      ? $localizedRegion(p.subregion)
      : p.region
        ? $localizedRegion(p.region)
        : $t('duel.scopeWorld');
  }

  function modeLabel(mode: string): string {
    return $t(MODE_LABEL[mode] ?? mode);
  }

  /** The challenger's score to beat: correct/total for a fixed run, points for a blitz. */
  function beatNumber(e: DuelEntry): string {
    return (e.theirScore?.primary ?? 0).toLocaleString();
  }
  function beatUnit(e: DuelEntry): string {
    return e.payload.type === 'blitz' ? ` ${$t('duels.ptsUnit')}` : `/${e.payload.length}`;
  }

  function verdictKey(v: NonNullable<DuelEntry['verdict']>): string {
    return v === 'win' ? 'duels.won' : v === 'loss' ? 'duels.lost' : 'duels.tied';
  }

  // Avatar: a stable colour picked from the endpoint id + the name's first letter. Purely decorative.
  const AVATAR_COLORS = ['#7b6bd6', '#e0532f', '#10a5a0', '#ff7a59', '#1e9e5a', '#ffb020'];
  function avatarColor(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  // "sent Xago" for an outbox row (display-only; recomputed each render, which is enough since the
  // store refreshes on focus/online). Returns '' if the timestamp is missing/unparseable.
  function sentAgo(e: DuelEntry): string {
    const ms = parseCreated(e.created);
    if (ms === null) return '';
    const age = duelAge(ms, Date.now());
    switch (age.unit) {
      case 'now':
        return $t('duels.sentJustNow');
      case 'min':
        return $t('duels.sentMinutesAgo', { n: age.n });
      case 'hour':
        return $t('duels.sentHoursAgo', { n: age.n });
      case 'day':
        return $t('duels.sentDaysAgo', { n: age.n });
    }
  }

  /** The 7-day display-only expiry state for a pending outbox row, or `null` if the date is missing. */
  function expiryOf(e: DuelEntry): DuelExpiry | null {
    const ms = parseCreated(e.created);
    return ms === null ? null : duelExpiry(ms, Date.now());
  }

  // Accept a received inbox duel → the identical seeded round (the Phase-46 accept path + the row id).
  function play(e: DuelEntry): void {
    pendingDuel.set(e.payload);
    pendingConfig.set(duelToRunConfig(e.payload));
    pendingInboxDuelId.set(e.id);
    push('/play');
  }

  async function remove(id: string): Promise<void> {
    await dismiss(id);
  }

  // Decline a received challenge without playing it (leaves my inbox; the challenger sees it declined).
  async function onDecline(id: string): Promise<void> {
    await decline(id);
  }

  // Per-friend rivalry record, derived client-side from the completed history. Wins/losses drive the
  // W–L numerals + the win-share bar; ties count toward the total duels played but not the win rate.
  interface Rivalry {
    userId: string;
    name: string;
    wins: number;
    losses: number;
    ties: number;
  }
  const records = $derived.by(() => {
    const byId: Record<string, Rivalry> = {};
    for (const e of historyItems) {
      if (!e.verdict) continue;
      const r = (byId[e.otherUserId] ??= {
        userId: e.otherUserId,
        name: e.otherName || $t('board.anon'),
        wins: 0,
        losses: 0,
        ties: 0,
      });
      if (e.verdict === 'win') r.wins += 1;
      else if (e.verdict === 'loss') r.losses += 1;
      else r.ties += 1;
    }
    return Object.values(byId);
  });

  function winPct(r: Rivalry): number {
    const decided = r.wins + r.losses;
    return decided ? Math.round((r.wins / decided) * 100) : 0;
  }
  function playedLabel(r: Rivalry): string {
    const total = r.wins + r.losses + r.ties;
    return total === 1 ? $t('duels.playedOne') : $t('duels.playedMany', { n: total });
  }
</script>

<svelte:window onfocus={refresh} />

<section class="duels">
  <h1>{$t('duels.title')}</h1>

  {#if gated}
    <div class="state">
      <Mascot pose="thinking" size={96} />
      <p class="muted">{$t('duels.gateBody')}</p>
    </div>
  {:else}
    <!-- ZONE 1 — Your turn: challenges waiting for me to play (always visible). -->
    <h2 class="section-title">
      <Icon name="swords" size="1em" />
      {$t('duels.turnTitle')}
      {#if inboxItems.length > 0}<span class="count">{inboxItems.length}</span>{/if}
    </h2>
    {#if inboxItems.length === 0}
      <p class="empty">{$t('duels.inboxEmpty')}</p>
    {:else}
      <ul class="list">
        {#each inboxItems as e (e.id)}
          <li class="duel-card">
            <div class="dc-top">
              <span
                class="avatar"
                style="background:{avatarColor(e.otherUserId)}"
                aria-hidden="true"
              >
                {initial(e.otherName || $t('board.anon'))}
              </span>
              <span class="who">
                <span class="name">{e.otherName || $t('board.anon')}</span>
                <span class="verb">{$t('duels.challengesYouVerb')}</span>
              </span>
              <span class="beat">
                <span class="lbl">{$t('duels.beatShort')}</span>
                <span class="val">{beatNumber(e)}<small>{beatUnit(e)}</small></span>
              </span>
            </div>
            <div class="chips">
              <span class="chip">
                <span class="chip-ico" aria-hidden="true"><ModeIcon mode={e.payload.mode} /></span>
                {modeLabel(e.payload.mode)}
              </span>
              <span class="chip neutral">{scopeRegion(e.payload)}</span>
              {#if e.payload.type === 'blitz'}
                <span class="chip neutral">{$t('duels.blitzTag')}</span>
              {/if}
            </div>
            <div class="dc-actions">
              <button type="button" class="btn btn-decline" onclick={() => onDecline(e.id)}>
                {$t('duels.decline')}
              </button>
              <button type="button" class="btn btn-play" onclick={() => play(e)}>
                <Icon name="swords" size="1em" />
                {$t('duels.play')}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- ZONE 2 — segmented Sent / Scoreboard / History (only the active pane is mounted). -->
    <div class="track-seg" role="tablist" aria-label={$t('duels.title')}>
      <button
        type="button"
        role="tab"
        aria-selected={track === 'sent'}
        onclick={() => (track = 'sent')}
      >
        {$t('duels.tabSent')}
        {#if outboxItems.length > 0}<span class="pip">{outboxItems.length}</span>{/if}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={track === 'scoreboard'}
        onclick={() => (track = 'scoreboard')}
      >
        {$t('duels.tabScoreboard')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={track === 'history'}
        onclick={() => (track = 'history')}
      >
        {$t('duels.tabHistory')}
      </button>
    </div>

    {#if track === 'sent'}
      {#if outboxItems.length === 0}
        <p class="empty">{$t('duels.outboxEmpty')}</p>
      {:else}
        <ul class="list">
          {#each outboxItems as e (e.id)}
            {@const exp = expiryOf(e)}
            {@const isExpired = !e.declined && exp?.state === 'expired'}
            <li class="sent-row" class:declined={e.declined} class:expired={isExpired}>
              <span
                class="avatar sm"
                style="background:{avatarColor(e.otherUserId)}"
                aria-hidden="true"
              >
                {initial(e.otherName || $t('board.anon'))}
              </span>
              <span class="body">
                <span class="name">{e.otherName || $t('board.anon')}</span>
                <span class="meta">
                  <span class="scope-ico" aria-hidden="true"
                    ><ModeIcon mode={e.payload.mode} /></span
                  >
                  <span>{modeLabel(e.payload.mode)}</span>
                  <span class="dot" aria-hidden="true">·</span>
                  <span>{scopeRegion(e.payload)}</span>
                  {#if sentAgo(e)}
                    <span class="dot" aria-hidden="true">·</span>
                    <span>{sentAgo(e)}</span>
                  {/if}
                  {#if e.declined}
                    <span class="status bad">{$t('duels.declinedTag')}</span>
                  {:else if exp?.state === 'expired'}
                    <span class="status bad">{$t('duels.expiredTag')}</span>
                  {:else if exp?.state === 'soon'}
                    <span class="status soon">{$t('duels.expiresInHours', { n: exp.hours })}</span>
                  {:else if exp?.state === 'ok'}
                    <span class="status waiting">{$t('duels.expiresInDays', { n: exp.days })}</span>
                  {/if}
                </span>
              </span>
              {#if e.declined || isExpired}
                <button
                  type="button"
                  class="x"
                  onclick={() => remove(e.id)}
                  aria-label={$t('duels.dismissSent')}
                  title={$t('duels.dismissSent')}
                >
                  <Icon name="close" size="1em" />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if track === 'scoreboard'}
      {#if records.length === 0}
        <p class="empty">{$t('duels.scoreboardEmpty')}</p>
      {:else}
        <p class="board-lead">{$t('duels.rivalries')}</p>
        <div class="scoreboard">
          {#each records as r (r.userId)}
            <div class="rival">
              <div class="rival-top">
                <span
                  class="avatar sm"
                  style="background:{avatarColor(r.userId)}"
                  aria-hidden="true"
                >
                  {initial(r.name)}
                </span>
                <span class="rname">{r.name}</span>
                <span
                  class="rrec"
                  aria-label={$t('duels.recordLabel', { wins: r.wins, losses: r.losses })}
                >
                  <span class="w">{r.wins}</span><span class="sep">–</span><span class="l"
                    >{r.losses}</span
                  >
                </span>
              </div>
              <div class="winbar" class:empty={r.wins + r.losses === 0}>
                <span style="width:{winPct(r)}%"></span>
              </div>
              <div class="rate">{$t('duels.winRate', { pct: winPct(r) })} · {playedLabel(r)}</div>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      {#if historyItems.length === 0}
        <p class="empty">{$t('duels.historyEmpty')}</p>
      {:else}
        <ul class="list">
          {#each historyItems as e (e.id)}
            <li
              class="hist-row"
              class:win={e.verdict === 'win'}
              class:loss={e.verdict === 'loss'}
              class:tie={e.verdict === 'tie'}
            >
              <span class="body">
                <span class="name">{$t('duels.vs', { name: e.otherName || $t('board.anon') })}</span
                >
                <span class="meta">
                  <span class="scope-ico" aria-hidden="true"
                    ><ModeIcon mode={e.payload.mode} /></span
                  >
                  <span>{modeLabel(e.payload.mode)}</span>
                  <span class="dot" aria-hidden="true">·</span>
                  <span>{scopeRegion(e.payload)}</span>
                </span>
              </span>
              {#if e.verdict}
                <span class="verdict {e.verdict}">
                  {#if e.verdict === 'win'}<Icon name="crown" size="1em" />{/if}
                  {$t(verdictKey(e.verdict))}
                </span>
              {/if}
              <span class="tally">
                {(e.myScore?.primary ?? 0).toLocaleString()}–{(
                  e.theirScore?.primary ?? 0
                ).toLocaleString()}
              </span>
              <button
                type="button"
                class="x"
                onclick={() => remove(e.id)}
                aria-label={$t('duels.dismiss')}
                title={$t('duels.dismiss')}
              >
                <Icon name="close" size="1em" />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .duels {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0.35rem 0 0.15rem;
    font-size: 1.05rem;
    color: var(--color-accent-strong);
  }

  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--color-coral);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.7rem;
    padding: 2rem 1rem;
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
  }

  .empty {
    margin: 0;
    color: var(--color-muted);
    padding: 0.5rem 0;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Shared avatar disc (hero + rows + scoreboard). */
  .avatar {
    flex: none;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: #fff;
    font-weight: 800;
    font-size: 1.05rem;
  }

  .avatar.sm {
    width: 2.1rem;
    height: 2.1rem;
    font-size: 0.85rem;
  }

  /* ---- ZONE 1 — hero open-challenge card (rivalry skin) ---- */
  .duel-card {
    position: relative;
    padding: 0.85rem 0.95rem 0.85rem 1.1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  /* Teal→coral edge rail — the two-sided "versus" cue, echoing the Home duels card. */
  .duel-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 6px;
    background: linear-gradient(180deg, var(--color-accent) 0 45%, var(--color-coral) 55% 100%);
  }

  .dc-top {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .who {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .who .name {
    font-weight: 800;
    font-size: 1.02rem;
  }

  .who .verb {
    color: var(--color-muted);
    font-size: 0.82rem;
  }

  .beat {
    flex: none;
    text-align: right;
    line-height: 1.05;
  }

  .beat .lbl {
    display: block;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .beat .val {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-coral-strong);
    font-variant-numeric: tabular-nums;
  }

  .beat .val small {
    font-size: 0.7rem;
    font-weight: 800;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.6rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.22rem 0.55rem;
    border-radius: 999px;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
    font-size: 0.76rem;
    font-weight: 800;
  }

  .chip.neutral {
    background: var(--color-bg);
    color: var(--color-muted);
  }

  .chip-ico,
  .scope-ico {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.05rem;
    height: 1.05rem;
    color: var(--color-accent);
  }

  /* ModeIcon ships at 1.5rem; size it to this box so it sits centred (not overflowing its slot). */
  .chip-ico :global(svg),
  .scope-ico :global(svg) {
    width: 100%;
    height: 100%;
  }

  .dc-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .btn {
    font: inherit;
    cursor: pointer;
    border-radius: 999px;
    font-weight: 800;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }

  .btn-play {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 2px solid transparent;
    /* Rivalry cue: teal fill on a coral chunky drop, matching the "Challenge a friend" CTA. */
    box-shadow: 0 4px 0 var(--color-coral-strong);
  }

  .btn-play:hover {
    transform: translateY(-2px);
  }

  .btn-play:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--color-coral-strong);
  }

  .btn-decline {
    flex: none;
    padding: 0.6rem 1rem;
    background: transparent;
    border: 2px solid var(--color-border);
    color: var(--color-muted);
  }

  .btn-decline:hover {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }

  /* ---- ZONE 2 — segmented track control ---- */
  .track-seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    margin: 0.9rem 0 0.2rem;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: 999px;
  }

  .track-seg button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 0.4rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    font-weight: 800;
    font-size: 0.9rem;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .track-seg button[aria-selected='true'] {
    background: var(--color-surface);
    color: var(--color-accent-strong);
    box-shadow: var(--shadow-card);
  }

  .track-seg .pip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.15rem;
    height: 1.15rem;
    padding: 0 0.32rem;
    border-radius: 999px;
    background: var(--color-coral);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .track-seg button[aria-selected='false'] .pip {
    background: var(--color-muted);
  }

  /* ---- Sent (outbox) rows ---- */
  .sent-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.8rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .sent-row.declined,
  .sent-row.expired {
    opacity: 0.72;
  }

  .sent-row .body {
    min-width: 0;
    flex: 1;
  }

  .sent-row .name {
    font-weight: 800;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.4rem;
    margin-top: 0.15rem;
    color: var(--color-muted);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .dot {
    opacity: 0.55;
  }

  .status {
    display: inline-flex;
    align-items: center;
    padding: 0.14rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .status.waiting {
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
  }

  .status.soon {
    background: var(--color-sun-weak);
    color: #a4700a;
  }

  .status.bad {
    background: var(--color-coral-weak);
    color: var(--color-coral-strong);
  }

  .x {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 999px;
    background: transparent;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
  }

  .x:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  /* ---- Scoreboard (rivalries) ---- */
  .board-lead {
    margin: 0.3rem 0 0.15rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .scoreboard {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .rival {
    padding: 0.6rem 0.75rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .rival-top {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .rname {
    flex: 1;
    min-width: 0;
    font-weight: 800;
  }

  .rrec {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .rrec .w {
    color: var(--color-correct);
  }

  .rrec .l {
    color: var(--color-wrong);
  }

  .rrec .sep {
    color: var(--color-muted);
    margin: 0 0.15rem;
  }

  .winbar {
    position: relative;
    height: 8px;
    margin-top: 0.5rem;
    border-radius: 999px;
    background: var(--color-wrong-bg);
    overflow: hidden;
  }

  /* All-ties (no decided duels) → a neutral track, not a "0% = all losses" red bar. */
  .winbar.empty {
    background: var(--color-bg);
  }

  .winbar > span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    background: linear-gradient(90deg, #34c17a, var(--color-correct));
  }

  .rate {
    margin-top: 0.3rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  /* ---- History rows ---- */
  .hist-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem 0.6rem 1.05rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  /* A verdict-coloured left rail makes wins/losses scannable down the list without reading. */
  .hist-row::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 5px;
    background: var(--color-muted);
  }

  .hist-row.win::before {
    background: var(--color-correct);
  }

  .hist-row.loss::before {
    background: var(--color-wrong);
  }

  .hist-row .body {
    flex: 1;
    min-width: 0;
  }

  .hist-row .name {
    display: block;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The outcome is a solid pill (not just coloured text): green "Won" crowned like the verdict card,
     red "Lost", a quiet neutral "Tied". */
  .verdict {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    padding: 0.26rem 0.62rem;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.8rem;
    background: var(--color-bg);
    color: var(--color-muted);
  }

  .verdict.win {
    background: var(--color-correct);
    color: #fff;
  }

  .verdict.loss {
    background: var(--color-wrong);
    color: #fff;
  }

  .tally {
    flex: none;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .track-seg button {
      transition: none;
    }

    .btn-play:hover,
    .btn-play:active {
      transform: none;
    }
  }
</style>
