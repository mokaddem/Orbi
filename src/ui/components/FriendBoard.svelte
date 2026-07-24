<script lang="ts">
  import { t } from '../../i18n';
  import { computeStats, RANKS, type FamilyMasteryResult, type StatsOverview } from '../../domain';
  import {
    loadSessions,
    loadMastery,
    loadRank,
    prefs,
    storageReady,
    type RankState,
  } from '../stores/persistence';
  import { isBackendConfigured } from '../../backend/client';
  import { identity } from '../stores/identity';
  import { friends, refreshFriends, unfriend, myUserId } from '../stores/friends';
  import { friendInviteLinkFor } from '../friend-invite';
  import RankMedal from './RankMedal.svelte';
  import Icon from './Icon.svelte';
  import FriendInviteSheet from './FriendInviteSheet.svelte';
  import FriendActionsSheet from './FriendActionsSheet.svelte';

  // The friend leaderboard (Phase 52/53), extracted from Progress so it can live on Home (the social
  // hub). Self-contained: it loads its own headline stats from LOCAL persistence (offline-first +
  // instant) and merges accepted friends from the server store. Friending requires an account (OQ1);
  // with no backend the board degrades to the "friends coming" note.
  let stats = $state<StatsOverview | null>(null);
  let mastery = $state<FamilyMasteryResult | null>(null);
  let rank = $state<RankState | null>(null);

  async function load(): Promise<void> {
    // Best-effort, non-blocking refresh of the server-backed friend rows.
    void refreshFriends();
    stats = computeStats(await loadSessions());
    // Display-only rank (commit:false) — the board never consumes the one-time "rank up!" moment,
    // which is celebrated on Summary/Home (Phase 43).
    [mastery, rank] = await Promise.all([loadMastery(), loadRank(Date.now(), { commit: false })]);
  }

  // Load once storage is ready (App opens the store asynchronously at startup).
  $effect(() => {
    if ($storageReady) void load();
  });

  const hasBackend = isBackendConfigured();
  const rankKey = (i: number): string =>
    RANKS[Math.max(0, Math.min(RANKS.length - 1, i))]?.key ?? 'novice';
  const selfName = $derived($prefs.playerName?.trim() || $t('board.you'));
  // Whether the player has a display name — drives the "You" chip on the self row (redundant when the
  // name already falls back to "You").
  const hasPlayerName = $derived(!!$prefs.playerName?.trim());
  interface BoardVMRow {
    userId: string | null;
    name: string;
    rankIndex: number;
    xp: number;
    fullyMastered: number;
    sessionCount: number;
    isSelf: boolean;
  }
  const boardRows = $derived.by((): BoardVMRow[] => {
    if (!rank) return [];
    const self = {
      userId: null as string | null,
      name: selfName,
      rankIndex: rank.progress.rank.index,
      xp: rank.xp.total,
      fullyMastered: mastery?.overall.fullyMastered ?? 0,
      sessionCount: stats?.sessionCount ?? 0,
      isSelf: true,
    };
    const others = $friends.map((f) => ({
      userId: f.userId,
      name: f.displayName?.trim() || $t('board.anon'),
      rankIndex: f.rankIndex,
      xp: f.xp,
      fullyMastered: f.fullyMastered,
      sessionCount: f.sessionCount,
      isSelf: false,
    }));
    return [self, ...others].sort((a, b) => b.xp - a.xp);
  });

  let inviteOpen = $state(false);
  let inviteUrl = $state('');
  async function openInvite(): Promise<void> {
    const uid = await myUserId();
    if (!uid) return;
    inviteUrl = friendInviteLinkFor(uid, $prefs.playerName ?? '');
    inviteOpen = true;
  }
  // Tapping a friend row opens the actions modal (remove now; profile / challenge later). Self isn't
  // actionable yet, so its row is a plain, non-interactive entry.
  let selectedFriend = $state<BoardVMRow | null>(null);
  function openFriend(row: BoardVMRow): void {
    if (row.isSelf || !row.userId) return;
    selectedFriend = row;
  }
  function removeSelectedFriend(): void {
    if (selectedFriend?.userId) void unfriend(selectedFriend.userId);
    selectedFriend = null;
  }
</script>

{#if rank}
  <div class="panel board">
    <h2>{$t('board.title')}</h2>
    <p class="panel-sub">{$t('board.subtitle')}</p>
    {#snippet rowInner(row: BoardVMRow)}
      <span class="br-medal" aria-hidden="true">
        <RankMedal index={row.rankIndex} size={40} />
      </span>
      <span class="br-id">
        <span class="br-name-row">
          <span class="br-name">{row.name}</span>
          {#if row.isSelf && hasPlayerName}
            <span class="you-chip">{$t('board.you')}</span>
          {/if}
        </span>
        <span class="br-tier">{$t(`rank.names.${rankKey(row.rankIndex)}`)}</span>
      </span>
      <span class="br-metrics">
        <span class="br-xp">
          {row.xp.toLocaleString()}<small>{$t('board.xpUnit')}</small>
        </span>
        <span class="br-secondary">
          <span class="br-metric" title={$t('board.metric.fullyMastered')}>
            <Icon name="globe" size="0.85em" />
            {row.fullyMastered}
          </span>
          <span class="br-metric" title={$t('board.metric.sessions')}>
            <Icon name="play" size="0.85em" />
            {row.sessionCount}
          </span>
        </span>
      </span>
    {/snippet}
    <ul class="board-list">
      {#each boardRows as row (row.isSelf ? '__self__' : row.userId)}
        {#if row.isSelf}
          <li class="board-row is-self">{@render rowInner(row)}</li>
        {:else}
          <!-- A friend row opens the actions modal (remove now; profile / challenge later). -->
          <li>
            <button
              type="button"
              class="board-row row-open"
              aria-label={$t('board.friendActions', { name: row.name })}
              onclick={() => openFriend(row)}
            >
              {@render rowInner(row)}
            </button>
          </li>
        {/if}
      {/each}
    </ul>

    {#if !hasBackend}
      <p class="board-empty">
        <Icon name="sparkles" size="0.9em" />
        {$t('board.friendsComing')}
      </p>
    {:else if $identity.tier !== 'account'}
      <div class="board-foot gate">
        <p class="muted">{$t('board.gate.body')}</p>
        <div class="gate-actions">
          <a class="board-btn" href="#/account?account=create">{$t('board.gate.cta')}</a>
          <a class="gate-signin" href="#/account?account=signin">
            {$t('settings.account.signInInstead')}
          </a>
        </div>
      </div>
    {:else}
      <div class="board-foot">
        {#if boardRows.length <= 1}
          <p class="muted">{$t('board.inviteEmpty')}</p>
        {/if}
        <button type="button" class="board-btn" onclick={openInvite}>
          <Icon name="share" size="0.9em" />
          {$t('board.inviteCta')}
        </button>
      </div>
    {/if}
  </div>
{/if}

<!-- Friend-invite share sheet (Phase 53): opens from the board's "invite a friend" button. -->
<FriendInviteSheet open={inviteOpen} url={inviteUrl} onClose={() => (inviteOpen = false)} />

<!-- Friend actions modal: opens when a friend row is tapped (remove now; more actions later). -->
<FriendActionsSheet
  open={!!selectedFriend}
  friend={selectedFriend}
  onRemove={removeSelectedFriend}
  onClose={() => (selectedFriend = null)}
/>

<style>
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

  .panel-sub {
    margin: -0.25rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  /* The friend leaderboard: the self row + accepted friends, merged and sorted by XP, self
     highlighted. With no backend it degrades to the "friends coming" note. */
  .board-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .board-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.55rem 0.7rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
  }

  /* A friend row is a button that opens the actions modal — reset the native button chrome and
     let the shared .board-row styles show through, with a subtle interactive affordance. */
  .row-open {
    width: 100%;
    text-align: left;
    color: inherit;
    cursor: pointer;
    transition: border-color 0.12s ease;
  }

  .row-open:hover {
    border-color: var(--color-accent);
  }

  /* You — highlighted so the friend list reads "which one is me" at a glance (Phase 53). */
  .board-row.is-self {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
  }

  .br-medal {
    flex: 0 0 auto;
    display: inline-flex;
  }

  .br-id {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .br-name-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .br-name {
    font-weight: 800;
    font-size: 0.98rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  /* "You" chip on the self row — an accent pill so your row is instantly findable among friends. */
  .you-chip {
    flex: 0 0 auto;
    padding: 0.05rem 0.4rem;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-accent-contrast);
    background: var(--color-accent);
    border-radius: 999px;
  }

  .br-tier {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .br-metrics {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.15rem;
  }

  .br-xp {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent-strong);
  }

  .br-xp small {
    margin-left: 0.15rem;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  .br-secondary {
    display: inline-flex;
    gap: 0.6rem;
  }

  .br-metric {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
  }

  .br-metric :global(.icon) {
    color: var(--color-accent);
  }

  /* The "friends arrive next" note that shows with no backend — soft, below the self row. */
  .board-empty {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  .board-empty :global(.icon) {
    color: var(--color-accent);
    flex: 0 0 auto;
  }

  /* Board footer: the account gate (anon) or the "invite a friend" action (account). */
  .board-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.25rem;
  }

  .board-foot .muted {
    flex: 1 1 auto;
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  /* Anonymous account gate: message on top, then "Create an account" + a "Sign in" link. */
  .board-foot.gate {
    flex-direction: column;
    align-items: flex-start;
  }

  .gate-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.85rem;
  }

  .gate-signin {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-accent-strong);
    text-decoration: underline;
  }

  .gate-signin:hover {
    color: var(--color-accent);
  }

  .board-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    font-weight: 800;
    font-size: 0.88rem;
    color: var(--color-accent-contrast);
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius);
    box-shadow: var(--shadow-chunky);
    cursor: pointer;
  }

  .board-btn:hover {
    text-decoration: none;
    filter: brightness(1.03);
  }

  .board-btn:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }
</style>
