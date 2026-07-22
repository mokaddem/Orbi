<script lang="ts">
  // Duels hub (Phase 54) — the `#/duels` route reached from the Home "duels" card. Holds the INBOX
  // (pending duels friends sent me) and the HISTORY (completed duels, minus the ones I dismissed) with
  // a per-friend W/L tally. Everything is read from the reactive `duels` store, which is gated on a
  // configured backend + a real account and no-ops offline; with no backend / no account it shows a
  // connect-a-friend note (the full Phase-46 link duel is unaffected — it lives on the Summary route).
  //
  // Accepting an inbox duel reuses the EXACT Phase-46 path: decode is already done by the store, so we
  // stage the decoded payload as `pendingDuel` + `duelToRunConfig` as `pendingConfig`, plus the row id
  // as `pendingInboxDuelId`, then launch `/play`. On finish (or a quit), the Summary writes my score
  // straight back to that row — no return link.
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import {
    inbox,
    history,
    refreshDuels,
    dismiss,
    pendingInboxDuelId,
    type DuelEntry,
  } from '../stores/duels';
  import { duelToRunConfig } from '../duel';
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

  // Inbox + history require a configured backend AND a real account (inherited from Phase 53).
  const gated = $derived(!isBackendConfigured() || $identity.tier !== 'account');

  // Refresh on load + focus/online (the App re-probe wiring). No idle polling.
  onMount(() => void refreshDuels());
  function refresh(): void {
    void refreshDuels();
  }

  function scopeRegion(p: DuelEntry['payload']): string {
    return p.subregion
      ? $localizedRegion(p.subregion)
      : p.region
        ? $localizedRegion(p.region)
        : $t('duel.scopeWorld');
  }

  /** The challenger's score to beat, formatted per format (their score sits in `theirScore`). */
  function beatLabel(e: DuelEntry): string {
    const score = (e.theirScore?.primary ?? 0).toLocaleString();
    return e.payload.type === 'blitz'
      ? $t('duels.beatPoints', { score })
      : $t('duels.beat', { score });
  }

  function verdictKey(v: NonNullable<DuelEntry['verdict']>): string {
    return v === 'win' ? 'duels.won' : v === 'loss' ? 'duels.lost' : 'duels.tied';
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

  // Per-friend W/L tally, derived client-side from the completed history (ties omitted from the count).
  const records = $derived.by(() => {
    const byId: Record<string, { name: string; wins: number; losses: number }> = {};
    for (const e of $history) {
      if (!e.verdict) continue;
      const r = (byId[e.otherUserId] ??= {
        name: e.otherName || $t('board.anon'),
        wins: 0,
        losses: 0,
      });
      if (e.verdict === 'win') r.wins += 1;
      else if (e.verdict === 'loss') r.losses += 1;
    }
    return Object.values(byId);
  });
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
    <!-- Inbox: challenges waiting for me to play. -->
    <h2 class="section-title">
      <Icon name="swords" size="1em" />
      {$t('duels.inboxTitle')}
    </h2>
    {#if $inbox.length === 0}
      <p class="empty">{$t('duels.inboxEmpty')}</p>
    {:else}
      <ul class="list">
        {#each $inbox as e (e.id)}
          <li class="row">
            <div class="row-main">
              <p class="who">
                {e.otherName
                  ? $t('duels.challengesYou', { name: e.otherName })
                  : $t('duels.challengesYouAnon')}
              </p>
              <p class="scope">
                <span class="scope-ico" aria-hidden="true"><ModeIcon mode={e.payload.mode} /></span>
                <span>{$t(MODE_LABEL[e.payload.mode] ?? e.payload.mode)}</span>
                <span class="dot" aria-hidden="true">·</span>
                <span>{scopeRegion(e.payload)}</span>
                <span class="dot" aria-hidden="true">·</span>
                <span class="beat">{beatLabel(e)}</span>
              </p>
            </div>
            <button type="button" class="play" onclick={() => play(e)}>
              <Icon name="swords" size="1em" />
              {$t('duels.play')}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- History: completed duels + a per-friend W/L tally. -->
    <h2 class="section-title">
      <Icon name="history" size="1em" />
      {$t('duels.historyTitle')}
    </h2>
    {#if records.length}
      <div class="records">
        {#each records as r (r.name)}
          <span class="record">
            {r.name} · {$t('duels.recordLabel', { wins: r.wins, losses: r.losses })}
          </span>
        {/each}
      </div>
    {/if}
    {#if $history.length === 0}
      <p class="empty">{$t('duels.historyEmpty')}</p>
    {:else}
      <ul class="list">
        {#each $history as e (e.id)}
          <li class="row" class:win={e.verdict === 'win'} class:loss={e.verdict === 'loss'}>
            <div class="row-main">
              <p class="who">{$t('duels.vs', { name: e.otherName || $t('board.anon') })}</p>
              <p class="scope">
                <span class="scope-ico" aria-hidden="true"><ModeIcon mode={e.payload.mode} /></span>
                <span>{$t(MODE_LABEL[e.payload.mode] ?? e.payload.mode)}</span>
                <span class="dot" aria-hidden="true">·</span>
                <span>{scopeRegion(e.payload)}</span>
              </p>
            </div>
            <div class="row-end">
              {#if e.verdict}
                <span
                  class="verdict"
                  class:win={e.verdict === 'win'}
                  class:loss={e.verdict === 'loss'}
                >
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
                class="dismiss"
                onclick={() => remove(e.id)}
                aria-label={$t('duels.dismiss')}
                title={$t('duels.dismiss')}
              >
                <Icon name="close" size="1em" />
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .duels {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    margin: 0.75rem 0 0;
    font-size: 1.05rem;
    color: var(--color-accent-strong);
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

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .row.win {
    border-color: var(--color-correct);
  }

  .row-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .who {
    margin: 0;
    font-weight: 700;
  }

  .scope {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .scope-ico {
    display: inline-flex;
    width: 1.05rem;
    height: 1.05rem;
    color: var(--color-accent);
  }

  .dot {
    opacity: 0.6;
  }

  .beat {
    color: var(--color-accent-strong);
    font-weight: 800;
  }

  .play {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.1rem;
    border-radius: 999px;
    font-weight: 700;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 2px solid transparent;
    box-shadow: var(--shadow-chunky);
    transition: transform 0.12s ease;
  }

  .play:hover {
    transform: translateY(-2px);
  }

  .play:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .row-end {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .verdict {
    font-weight: 800;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  .verdict.win {
    color: var(--color-correct);
  }

  .verdict.loss {
    color: var(--color-wrong);
  }

  .tally {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 999px;
    background: transparent;
    border: none;
    color: var(--color-muted);
  }

  .dismiss:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .records {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .record {
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    font-size: 0.8rem;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .play {
      transition: none;
    }

    .play:hover {
      transform: none;
    }
  }
</style>
