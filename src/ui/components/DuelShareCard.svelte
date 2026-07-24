<script lang="ts">
  // "Challenge a friend" share card (Phase 46 / 54, redesigned) — presentational. The first view is
  // decluttered to a single primary button; tapping it reveals the options: direct-challenge friends
  // as a scrollable LIST (a friend already challenged with this run shows "Sent" and is disabled, so
  // they can't be spammed), then the share-a-link fallbacks. Status feedback ("Challenge sent…") is
  // owned by the caller as a Toast, not shown here. The caller builds the scorecard `previewUrl`,
  // decides `canInboxSend`, supplies the `friends` + already-sent `sentIds`, and reacts to the actions.
  import { t } from '../../i18n';
  import type { FriendRow } from '../stores/friends';
  import Icon from './Icon.svelte';

  let {
    previewUrl,
    canInboxSend,
    friends,
    sentIds = [],
    directLocked = null,
    onShare,
    onCopyImage,
    onCopyLink,
    onShowQr,
    onPickFriend,
    onUnlock,
    initialExpanded = false,
  }: {
    /** The rendered scorecard PNG (object URL), or `null` while it renders / when unavailable. */
    previewUrl: string | null;
    /** Whether the "send straight to a friend" inbox channel is offered (backend + account + friends). */
    canInboxSend: boolean;
    /** Accepted friends to offer in the list. */
    friends: FriendRow[];
    /** `userId`s already challenged with THIS run — shown as "Sent" + disabled (no duplicate sends). */
    sentIds?: string[];
    /**
     * When set (and `canInboxSend` is false), show the "Send directly" section as a greyed teaser
     * that nudges the missing step — `'account'` (create an account) or `'friends'` (add a friend).
     */
    directLocked?: 'account' | 'friends' | null;
    onShare: () => void;
    onCopyImage: () => void;
    onCopyLink: () => void;
    onShowQr: () => void;
    onPickFriend: (friend: FriendRow) => void;
    /** CTA for the locked teaser (go to account creation / friend invite). */
    onUnlock?: () => void;
    /** Start expanded (the duel gallery uses this to show that state). */
    initialExpanded?: boolean;
  } = $props();

  // `null` until the user acts, so it starts from `initialExpanded` (the gallery) then follows them.
  let toggled = $state<boolean | null>(null);
  const expanded = $derived(toggled ?? initialExpanded);

  const hasDirect = $derived(canInboxSend && friends.length > 0);
  // Show the "Send directly" section either populated (hasDirect) or as a locked teaser.
  const showDirect = $derived(hasDirect || directLocked !== null);
  const isSent = (id: string): boolean => sentIds.includes(id);

  function pick(friend: FriendRow): void {
    if (isSent(friend.userId)) return; // already challenged this run — don't re-send
    onPickFriend(friend);
  }
</script>

<div class="duel-card">
  <div class="duel-head">
    <span class="duel-ico" aria-hidden="true"><Icon name="swords" size={19} /></span>
    <h2>{$t('duel.title')}</h2>
    <span class="duel-vs" aria-hidden="true">{$t('duel.vs')}</span>
  </div>

  {#if !expanded}
    <p class="duel-sub">{$t('duel.subtitle')}</p>
  {/if}

  {#if previewUrl}
    <img class="duel-preview" class:small={expanded} src={previewUrl} alt={$t('duel.title')} />
  {/if}

  {#if !expanded}
    <button type="button" class="duel-primary" onclick={() => (toggled = true)}>
      <Icon name="swords" size="1.15em" />
      {$t('duel.title')}
    </button>
  {:else}
    <div class="duel-options">
      {#if showDirect}
        <p class="duel-section">{$t('duel.sendDirectly')}</p>
        {#if hasDirect}
          <ul class="duel-friends">
            {#each friends as f (f.userId)}
              <li>
                {#if isSent(f.userId)}
                  <div class="duel-friend done">
                    <span class="friend-name">{f.displayName || $t('board.anon')}</span>
                    <span class="friend-sent"
                      ><Icon name="check" size="1em" /> {$t('duel.friendSent')}</span
                    >
                  </div>
                {:else}
                  <button type="button" class="duel-friend" onclick={() => pick(f)}>
                    <span class="friend-name">{f.displayName || $t('board.anon')}</span>
                    <span class="friend-go" aria-hidden="true"
                      ><Icon name="swords" size="1em" /></span
                    >
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <!-- Locked teaser: the feature is visible but greyed, nudging the missing step. -->
          <button type="button" class="duel-locked" onclick={onUnlock} disabled={!onUnlock}>
            <span class="lock-ico" aria-hidden="true"><Icon name="lock" size="1.05em" /></span>
            <span class="lock-line">
              {directLocked === 'friends' ? $t('duel.lockedFriends') : $t('duel.lockedAccount')}
            </span>
            <span class="lock-cta">
              {directLocked === 'friends'
                ? $t('duel.lockedFriendsCta')
                : $t('duel.lockedAccountCta')}
            </span>
          </button>
        {/if}
        <div class="duel-divider" role="separator"></div>
        <p class="duel-section">{$t('duel.shareALink')}</p>
      {/if}

      <button type="button" class="duel-primary" onclick={onShare}>
        <Icon name="share" size="1.15em" />
        {$t('duel.share')}
      </button>
      <div class="duel-fallback">
        <button type="button" class="linkish" onclick={onCopyLink}>{$t('duel.copyLink')}</button>
        {#if previewUrl}
          <span aria-hidden="true">·</span>
          <button type="button" class="linkish" onclick={onCopyImage}>{$t('duel.copyImage')}</button
          >
        {/if}
        <span aria-hidden="true">·</span>
        <button type="button" class="linkish" onclick={onShowQr}>{$t('duel.showQr')}</button>
      </div>

      <button type="button" class="duel-collapse" onclick={() => (toggled = false)}>
        {$t('duel.fewerOptions')}
      </button>
    </div>
  {/if}
</div>

<style>
  /* The rivalry skin: a teal→coral top edge marks this as the head-to-head "duel" surface. */
  .duel-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1.1rem 1.25rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .duel-card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 5px;
    background: linear-gradient(90deg, var(--color-accent), var(--color-coral));
  }

  .duel-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.15rem;
  }

  .duel-head h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  /* Split teal/coral swords crest — the two-sided "versus" mark. */
  .duel-ico {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    flex: none;
    border-radius: 999px;
    color: #fff;
    background: linear-gradient(135deg, var(--color-accent) 0 50%, var(--color-coral) 50% 100%);
  }

  /* "VS" chip sits at the end of the head, reinforcing the head-to-head framing. */
  .duel-vs {
    margin-left: auto;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    color: #fff;
    font-weight: 800;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    background: linear-gradient(90deg, var(--color-accent), var(--color-coral));
  }

  .duel-sub {
    margin: 0;
    color: var(--color-muted);
  }

  /* Scorecard preview — the thing that gets shared; shrinks once expanded so the options lead. */
  .duel-preview {
    align-self: center;
    width: 100%;
    max-width: 280px;
    aspect-ratio: 1 / 1;
    border-radius: 18px;
    border: 2px solid var(--color-border);
    box-shadow: var(--shadow-card);
    transition: max-width 0.18s ease;
  }

  .duel-preview.small {
    max-width: 148px;
  }

  /* One prominent primary action. Collapsed: opens the options. Expanded: the universal Share. */
  .duel-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.2rem;
    padding: 0.8rem 1.4rem;
    border-radius: 999px;
    font-weight: 800;
    font-size: 1.05rem;
    border: 2px solid transparent;
    /* Rivalry cue: trusted teal fill, but the chunky drop is coral (echoes the card's coral edge). */
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    box-shadow: 0 4px 0 var(--color-coral-strong);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }

  .duel-primary:hover {
    transform: translateY(-2px);
  }

  .duel-primary:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--color-coral-strong);
  }

  .duel-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .duel-section {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  /* A vertical, scrollable list — scales past ~5 friends without getting messy. The small block
     padding keeps the first row's hover-lift from being clipped by the scroll container's top edge. */
  .duel-friends {
    list-style: none;
    margin: 0;
    padding: 3px 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 13rem;
    overflow-y: auto;
  }

  .duel-friend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    padding: 0.6rem 0.9rem;
    border-radius: var(--radius);
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    color: var(--color-text);
    font-weight: 700;
    transition:
      border-color 0.12s ease,
      transform 0.12s ease;
  }

  button.duel-friend:hover {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }

  .friend-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .friend-go {
    display: inline-flex;
    color: var(--color-accent);
  }

  /* A friend already challenged this run: muted, non-interactive, with a "Sent" check. */
  .duel-friend.done {
    opacity: 0.6;
    color: var(--color-muted);
  }

  .friend-sent {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex: none;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-correct);
  }

  /* Locked "Send directly" teaser: greyed + dashed to read as "not yet", with an accent CTA that
     draws the eye toward unlocking it (create an account / add a friend). */
  .duel-locked {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    text-align: left;
    padding: 0.7rem 0.9rem;
    border-radius: var(--radius);
    background: var(--color-bg);
    border: 2px dashed var(--color-border);
    color: var(--color-muted);
    cursor: pointer;
    transition: border-color 0.12s ease;
  }

  .duel-locked:hover:not(:disabled) {
    border-color: var(--color-accent);
  }

  .duel-locked:disabled {
    cursor: default;
  }

  .lock-ico {
    display: inline-flex;
    flex: none;
    color: var(--color-muted);
  }

  .lock-line {
    flex: 1;
    min-width: 0;
    font-weight: 700;
    color: var(--color-text);
    font-size: 0.9rem;
  }

  .lock-cta {
    flex: none;
    align-self: center;
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.85rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .duel-divider {
    height: 1px;
    background: var(--color-border);
    margin: 0.35rem 0;
  }

  .duel-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    color: var(--color-muted);
    font-size: 0.9rem;
  }

  .linkish {
    background: none;
    border: none;
    padding: 0.2rem 0.1rem;
    color: var(--color-muted);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .linkish:hover {
    color: var(--color-accent-strong);
  }

  .duel-collapse {
    align-self: center;
    margin-top: 0.2rem;
    background: none;
    border: none;
    color: var(--color-muted);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .duel-collapse:hover {
    color: var(--color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .duel-primary,
    .duel-friend,
    .duel-preview {
      transition: none;
    }

    .duel-primary:hover,
    button.duel-friend:hover {
      transform: none;
    }
  }
</style>
