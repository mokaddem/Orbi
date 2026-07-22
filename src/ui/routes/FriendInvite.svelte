<script lang="ts">
  // Received friend-invite screen (Phase 53) — the deep-link target for `#/friend-invite?c=…`.
  // Opening a fresh invite while signed into an account establishes an INSTANT MUTUAL friendship
  // (OQ3: the shared link is the consent). Friending requires a real account (OQ1), so an anonymous
  // visitor is shown a "create an account to add friends" gate that routes to Settings. Everything
  // rides in the code, so this works on a cold PWA start; a missing / corrupt code shows a friendly
  // "broken link" state, and with no backend it explains that a connection is needed.
  import { push, router } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { decodeFriendInvite } from '../../domain';
  import { readFriendInviteQuery } from '../friend-invite';
  import { isBackendConfigured } from '../../backend/client';
  import { identity } from '../stores/identity';
  import { addFriendFromInvite } from '../stores/friends';
  import { storageReady } from '../stores/persistence';
  import MascotScene from '../components/MascotScene.svelte';

  const query = $derived(readFriendInviteQuery(router.querystring));
  const decoded = $derived(query ? decodeFriendInvite(query.code) : null);
  const payload = $derived(decoded?.ok ? decoded.payload : null);

  // The identity mirror settles asynchronously at startup (anon-ensure / cached-token adopt). Wait for
  // a device id AND a non-'syncing' state before deciding account-vs-anon, so a deep-link doesn't
  // mis-gate an account holder as anonymous during the initial probe.
  const settled = $derived($identity.deviceId !== null && $identity.sync !== 'syncing');

  type Status = 'idle' | 'adding' | 'added' | 'failed' | 'self' | 'no-account' | 'no-backend';
  let status = $state<Status>('idle');
  let acted = false;

  $effect(() => {
    if (!payload || !$storageReady || !settled || acted) return;
    acted = true;
    if (!isBackendConfigured()) {
      status = 'no-backend';
      return;
    }
    if ($identity.tier !== 'account') {
      status = 'no-account';
      return;
    }
    status = 'adding';
    void addFriendFromInvite(payload.uid).then((r) => {
      status =
        r === 'ok'
          ? 'added'
          : r === 'self'
            ? 'self'
            : r === 'no-account'
              ? 'no-account'
              : r === 'no-backend'
                ? 'no-backend'
                : 'failed';
    });
  });

  const inviterName = $derived(payload?.name?.trim() ?? '');
  const goBoard = (): void => void push('/progress');
  const goHome = (): void => void push('/');
  const goSettings = (): void => void push('/settings');
</script>

<section class="invite">
  {#if !payload}
    <div class="card">
      <MascotScene pose="sleepy" size={104} />
      <h1>{$t('friends.invite.brokenTitle')}</h1>
      <p class="muted">{$t('friends.invite.brokenBody')}</p>
      <button type="button" class="btn ghost" onclick={goHome}>{$t('friends.invite.home')}</button>
    </div>
  {:else if status === 'idle' || status === 'adding'}
    <div class="card" role="status" aria-live="polite">
      <MascotScene pose="wave" size={104} />
      <p class="muted">{$t('friends.invite.connecting')}</p>
    </div>
  {:else if status === 'added'}
    <div class="card">
      <MascotScene pose="proud" size={104} />
      <p class="eyebrow">{$t('friends.invite.eyebrow')}</p>
      <h1>
        {inviterName
          ? $t('friends.invite.addedTitle', { name: inviterName })
          : $t('friends.invite.addedTitleAnon')}
      </h1>
      <p class="muted">{$t('friends.invite.addedBody')}</p>
      <button type="button" class="btn primary" onclick={goBoard}>
        {$t('friends.invite.viewBoard')}
      </button>
    </div>
  {:else if status === 'self'}
    <div class="card">
      <MascotScene pose="wave" size={104} />
      <h1>{$t('friends.invite.selfTitle')}</h1>
      <p class="muted">{$t('friends.invite.selfBody')}</p>
      <button type="button" class="btn primary" onclick={goBoard}>
        {$t('friends.invite.viewBoard')}
      </button>
    </div>
  {:else if status === 'no-account'}
    <div class="card">
      <MascotScene pose="wave" size={104} />
      <p class="eyebrow">
        {inviterName
          ? $t('friends.invite.eyebrowFrom', { name: inviterName })
          : $t('friends.invite.eyebrow')}
      </p>
      <h1>{$t('friends.invite.needAccountTitle')}</h1>
      <p class="muted">{$t('friends.invite.needAccountBody')}</p>
      <div class="actions">
        <button type="button" class="btn ghost" onclick={goHome}>
          {$t('friends.invite.later')}
        </button>
        <button type="button" class="btn primary" onclick={goSettings}>
          {$t('friends.invite.createAccount')}
        </button>
      </div>
    </div>
  {:else if status === 'no-backend'}
    <div class="card">
      <MascotScene pose="sleepy" size={104} />
      <h1>{$t('friends.invite.offlineTitle')}</h1>
      <p class="muted">{$t('friends.invite.offlineBody')}</p>
      <button type="button" class="btn ghost" onclick={goHome}>{$t('friends.invite.home')}</button>
    </div>
  {:else}
    <div class="card">
      <MascotScene pose="sleepy" size={104} />
      <h1>{$t('friends.invite.failedTitle')}</h1>
      <p class="muted">{$t('friends.invite.failedBody')}</p>
      <button type="button" class="btn ghost" onclick={goHome}>{$t('friends.invite.home')}</button>
    </div>
  {/if}
</section>

<style>
  .invite {
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem;
  }

  .card {
    width: 100%;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.6rem;
    padding: 1.8rem 1.4rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  h1 {
    margin: 0.2rem 0 0;
    font-size: 1.35rem;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    width: 100%;
    margin-top: 0.4rem;
  }

  .btn {
    flex: 1 1 0;
    padding: 0.65rem 1.1rem;
    border-radius: var(--radius);
    font-weight: 800;
    font-size: 0.95rem;
    border: 2px solid transparent;
    cursor: pointer;
  }

  .primary {
    color: var(--color-accent-contrast);
    background: var(--color-accent);
    box-shadow: var(--shadow-chunky);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .ghost {
    color: var(--color-muted);
    background: transparent;
    border-color: var(--color-border);
  }

  .ghost:hover {
    color: var(--color-text);
    border-color: var(--color-accent);
  }
</style>
