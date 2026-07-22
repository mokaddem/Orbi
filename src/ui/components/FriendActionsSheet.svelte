<script lang="ts">
  // Friend actions modal (Phase 53 follow-up). Opens when a friend's row on the board is tapped. For
  // now it carries a single action — remove friend — but it's the home for the actions we'll add next
  // (view profile, challenge, …). Presentational: the caller owns `open` + the selected friend and
  // reacts to onRemove / onClose. Modal idiom: Escape / backdrop / × dismiss.
  import { t } from '../../i18n';
  import { RANKS } from '../../domain';
  import RankMedal from './RankMedal.svelte';
  import Icon from './Icon.svelte';

  interface FriendView {
    name: string;
    rankIndex: number;
    xp: number;
    fullyMastered: number;
    sessionCount: number;
  }

  let {
    open,
    friend,
    onRemove,
    onClose,
  }: {
    open: boolean;
    friend: FriendView | null;
    onRemove: () => void;
    onClose: () => void;
  } = $props();

  const rankKey = (i: number): string =>
    RANKS[Math.max(0, Math.min(RANKS.length - 1, i))]?.key ?? 'novice';

  // Inline remove confirmation: "Remove friend" swaps the action row into a "Remove {name}?" prompt
  // within this same sheet (no stacked modal). Reset whenever the sheet (re)opens.
  let confirming = $state(false);
  let closeEl = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    if (open) {
      confirming = false;
      queueMicrotask(() => closeEl?.focus());
    }
  });
  function onKeydown(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') onClose();
  }
  function onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open && friend}
  <div class="backdrop" role="presentation" onclick={onBackdrop}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label={friend.name}>
      <button
        bind:this={closeEl}
        type="button"
        class="close"
        aria-label={$t('friends.close')}
        onclick={onClose}
      >
        ×
      </button>

      <div class="head">
        <span class="medal" aria-hidden="true"
          ><RankMedal index={friend.rankIndex} size={56} /></span
        >
        <span class="who">
          <span class="name">{friend.name}</span>
          <span class="tier">{$t(`rank.names.${rankKey(friend.rankIndex)}`)}</span>
        </span>
      </div>

      <div class="stat-line">
        <span class="stat"><strong>{friend.xp.toLocaleString()}</strong> {$t('board.xpUnit')}</span>
        <span class="stat" title={$t('board.metric.fullyMastered')}>
          <Icon name="globe" size="0.85em" />
          {friend.fullyMastered}
        </span>
        <span class="stat" title={$t('board.metric.sessions')}>
          <Icon name="play" size="0.85em" />
          {friend.sessionCount}
        </span>
      </div>

      <!-- Actions. For now just "remove" (with an inline confirm); view-profile / challenge / … next. -->
      <div class="actions">
        {#if confirming}
          <p class="confirm-q">{$t('friends.removeConfirm', { name: friend.name })}</p>
          <div class="confirm-row">
            <button type="button" class="action" onclick={() => (confirming = false)}>
              {$t('common.cancel')}
            </button>
            <button type="button" class="action danger" onclick={onRemove}>
              <Icon name="trash" size="0.95em" />
              {$t('friends.remove')}
            </button>
          </div>
        {:else}
          <button type="button" class="action danger" onclick={() => (confirming = true)}>
            <Icon name="trash" size="0.95em" />
            {$t('board.unfriend')}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgb(18 26 25 / 55%);
    animation: fade 0.14s ease;
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: 22rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1.5rem 1.3rem 1.3rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    animation: pop 0.14s ease;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .medal {
    flex: 0 0 auto;
    display: inline-flex;
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-weight: 800;
    font-size: 1.1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tier {
    font-size: 0.82rem;
    color: var(--color-muted);
  }

  .stat-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    padding: 0.6rem 0.7rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-size: 0.85rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .stat strong {
    color: var(--color-accent-strong);
  }

  .stat :global(.icon) {
    color: var(--color-accent);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .confirm-q {
    margin: 0 0 0.15rem;
    text-align: center;
    font-weight: 700;
  }

  .confirm-row {
    display: flex;
    gap: 0.5rem;
  }

  .confirm-row .action {
    flex: 1 1 0;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-weight: 700;
    font-size: 0.92rem;
    cursor: pointer;
  }

  .action.danger {
    color: var(--color-wrong);
    border-color: color-mix(in oklab, var(--color-wrong), transparent 55%);
  }

  .action.danger:hover {
    background: var(--color-wrong-bg);
    border-color: var(--color-wrong);
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: none;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    background: var(--color-border);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop,
    .sheet {
      animation: none;
    }
  }
</style>
