<script lang="ts">
  // Account page (#/account) — the identity/profile surface, split out of Settings so managing the
  // account is its own destination (rail on desktop, top-bar person icon on mobile). It holds the
  // display name + the progressive-identity controls: when anonymous, create an account or sign in;
  // when signed in, sign out or delete. Everything is a thin, best-effort wrapper over the identity
  // store (calls never throw; feedback is localised). App preferences stay in Settings.
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { router } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { PLAYER_NAME_MAX_LENGTH } from '../../data';
  import { prefs, updatePrefs } from '../stores/persistence';
  import {
    identity,
    renameTo,
    upgrade,
    signIn,
    signOut,
    deleteAccount,
    type AccountActionResult,
  } from '../stores/identity';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';

  // A compact form over the progressive-identity store. When anonymous, the player can create an
  // account or sign in; when signed in, sign out or delete. All calls are best-effort and localised.
  let accountForm = $state<'none' | 'create' | 'signin'>('none');
  let accountEmail = $state('');
  let accountPassword = $state('');
  let accountBusy = $state(false);
  let accountFeedback = $state<{ kind: 'ok' | 'error'; key: string } | null>(null);
  let accountDeleteDialogOpen = $state(false);
  let signOutDialogOpen = $state(false);

  onMount(() => {
    // Deep-link from the board's account gate (#/account?account=create|signin): open that form.
    const account = new URLSearchParams(router.querystring ?? '').get('account');
    if ((account === 'create' || account === 'signin') && get(identity).tier !== 'account') {
      accountForm = account;
    }
  });

  function resetAccountForm(): void {
    accountForm = 'none';
    accountEmail = '';
    accountPassword = '';
    accountFeedback = null;
  }

  function feedbackFor(result: AccountActionResult): void {
    accountFeedback = result.ok
      ? null
      : {
          kind: 'error',
          key: result.error === 'no-backend' ? 'errorNoBackend' : 'errorFailed',
        };
  }

  async function submitAccount(): Promise<void> {
    if (accountBusy) return;
    accountBusy = true;
    accountFeedback = null;
    const action = accountForm === 'create' ? upgrade : signIn;
    const result = await action(accountEmail, accountPassword);
    accountBusy = false;
    if (result.ok) {
      // No success toast — the signed-in email appears next to the Account label right away.
      accountFeedback = null;
      accountForm = 'none';
      accountEmail = '';
      accountPassword = '';
    } else {
      feedbackFor(result);
    }
  }

  function confirmSignOut(): void {
    signOutDialogOpen = false;
    void signOut();
  }

  async function confirmDeleteAccount(): Promise<void> {
    accountDeleteDialogOpen = false;
    accountBusy = true;
    const result = await deleteAccount();
    accountBusy = false;
    if (!result.ok) feedbackFor(result);
  }

  // Account form modal (open when accountForm !== 'none'): focus the email field on open, and let
  // Escape / a backdrop click dismiss it (resetAccountForm also clears the fields + feedback).
  let accountEmailEl = $state<HTMLInputElement | null>(null);
  $effect(() => {
    if (accountForm !== 'none') queueMicrotask(() => accountEmailEl?.focus());
  });
  function onAccountModalKeydown(e: KeyboardEvent): void {
    if (accountForm !== 'none' && e.key === 'Escape') resetAccountForm();
  }
  function onAccountBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) resetAccountForm();
  }
</script>

<section class="account">
  <h1>{$t('settings.account.title')}</h1>

  {#if $identity.tier === 'account'}
    <div class="row">
      <span class="label">{$t('settings.account.statusLabel')}</span>
      <span class="account-status" data-signed-in="true">
        {$identity.email || $t('settings.account.signedIn')}
      </span>
    </div>
    <div class="account-actions">
      <button
        type="button"
        class="ghost"
        onclick={() => (signOutDialogOpen = true)}
        disabled={accountBusy}
      >
        {$t('settings.account.signOut')}
      </button>
      <button
        type="button"
        class="danger"
        onclick={() => (accountDeleteDialogOpen = true)}
        disabled={accountBusy}
      >
        {$t('settings.account.delete')}
      </button>
    </div>
  {:else}
    <div class="row row-top">
      <span class="label">{$t('settings.account.statusLabel')}</span>
      <span class="account-anon">
        <span class="account-status">{$t('settings.account.statusAnon')}</span>
        {#if $identity.deviceId}
          <!-- The device's anonymous id, shown faintly for reference/support (selectable). -->
          <span class="device-id" title={$t('settings.account.deviceIdLabel')}
            >{$identity.deviceId}</span
          >
        {/if}
      </span>
    </div>
    <p class="hint">{$t('settings.account.anonNote')}</p>

    <div class="account-actions">
      <button
        type="button"
        class="primary"
        onclick={() => ((accountForm = 'create'), (accountFeedback = null))}
      >
        {$t('settings.account.create')}
      </button>
      <button
        type="button"
        class="link"
        onclick={() => ((accountForm = 'signin'), (accountFeedback = null))}
      >
        {$t('settings.account.signInInstead')}
      </button>
    </div>
  {/if}

  {#if accountFeedback && accountForm === 'none'}
    <p class="account-feedback" data-kind={accountFeedback.kind} role="status">
      {$t(`settings.account.${accountFeedback.key}`)}
    </p>
  {/if}

  <h2>{$t('settings.account.displayName')}</h2>

  <div class="row">
    <label class="label" for="display-name">{$t('duel.settingsLabel')}</label>
    <input
      id="display-name"
      type="text"
      autocomplete="nickname"
      maxlength={PLAYER_NAME_MAX_LENGTH}
      placeholder={$t('duel.namePlaceholder')}
      value={$prefs.playerName ?? ''}
      oninput={(e) => updatePrefs({ playerName: e.currentTarget.value })}
      onchange={(e) => void renameTo(e.currentTarget.value)}
    />
  </div>

  <p class="hint">{$t('duel.settingsHelp')}</p>
</section>

<ConfirmDialog
  open={signOutDialogOpen}
  title={$t('settings.account.signOutTitle')}
  message={$t('settings.account.signOutMessage')}
  confirmLabel={$t('settings.account.signOut')}
  onconfirm={confirmSignOut}
  oncancel={() => (signOutDialogOpen = false)}
/>

<ConfirmDialog
  open={accountDeleteDialogOpen}
  title={$t('settings.account.deleteTitle')}
  message={$t('settings.account.deleteMessage')}
  confirmLabel={$t('settings.account.delete')}
  onconfirm={confirmDeleteAccount}
  oncancel={() => (accountDeleteDialogOpen = false)}
/>

<!-- Account create / sign-in form, in a modal (Escape / backdrop / Cancel dismiss). -->
<svelte:window onkeydown={onAccountModalKeydown} />
{#if accountForm !== 'none'}
  <div class="backdrop" role="presentation" onclick={onAccountBackdrop}>
    <div
      class="account-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <h2 id="account-modal-title">
        {$t(accountForm === 'create' ? 'settings.account.create' : 'settings.account.signIn')}
      </h2>
      <form
        class="account-form"
        onsubmit={(e) => {
          e.preventDefault();
          void submitAccount();
        }}
      >
        <label class="label" for="account-email">{$t('settings.account.emailLabel')}</label>
        <input
          bind:this={accountEmailEl}
          id="account-email"
          type="email"
          autocomplete="email"
          bind:value={accountEmail}
          required
        />
        <label class="label" for="account-password">{$t('settings.account.passwordLabel')}</label>
        <input
          id="account-password"
          type="password"
          autocomplete={accountForm === 'create' ? 'new-password' : 'current-password'}
          minlength="8"
          bind:value={accountPassword}
          required
        />
        {#if accountForm === 'create'}
          <p class="hint">{$t('settings.account.passwordHint')}</p>
        {/if}
        {#if accountFeedback && accountFeedback.kind === 'error'}
          <p class="account-feedback" data-kind="error" role="alert">
            {$t(`settings.account.${accountFeedback.key}`)}
          </p>
        {/if}
        <div class="account-actions end">
          <button type="button" class="link" onclick={resetAccountForm} disabled={accountBusy}>
            {$t('common.cancel')}
          </button>
          <button type="submit" class="primary" disabled={accountBusy}>
            {$t(accountForm === 'create' ? 'settings.account.create' : 'settings.account.signIn')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .account {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  h2 {
    margin: 0.75rem 0 0;
    font-size: 1.05rem;
    color: var(--color-muted);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 26rem;
  }

  .label {
    font-weight: 600;
  }

  input[type='text'],
  input[type='email'],
  input[type='password'] {
    width: 12rem;
    padding: 0.4rem 0.55rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
  }

  input[type='text']:focus,
  input[type='email']:focus,
  input[type='password']:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .hint {
    margin: 0.25rem 0 0;
    color: var(--color-muted);
    font-size: 0.85rem;
  }

  /* Account status + actions */
  .account-status {
    color: var(--color-muted);
    font-weight: 600;
  }
  .account-status[data-signed-in='true'] {
    color: var(--color-correct);
  }
  .account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  /* Primary account CTA (Create account / form submit) — the app's chunky accent button. */
  .primary {
    padding: 0.55rem 1.1rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: none;
    border-radius: var(--radius);
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
  }
  .primary:hover:not(:disabled) {
    filter: brightness(1.03);
  }
  .primary:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* Secondary action (Sign out) — a neutral bordered button, matching the danger delete beside it. */
  .ghost {
    padding: 0.4rem 0.9rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 600;
  }
  .ghost:hover:not(:disabled) {
    border-color: var(--color-accent);
  }
  .ghost:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .danger {
    flex: 0 0 auto;
    padding: 0.4rem 0.9rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
    font-weight: 600;
  }
  .danger:hover:not(:disabled) {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }
  .danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* Anonymous status + its device id, stacked and right-aligned against the label. */
  .row-top {
    align-items: flex-start;
  }
  .account-anon {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.375rem;
    min-width: 0;
  }
  /* The device's anonymous id — deliberately faint + tiny; selectable for support/reference. */
  .device-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.02em;
    line-height: 1.2;
    text-align: right;
    color: var(--color-muted);
    opacity: 0.4;
    word-break: break-all;
    user-select: all;
  }
  .account-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-width: 26rem;
  }
  .account-form input {
    width: 100%;
  }
  button.link {
    background: none;
    border: none;
    box-shadow: none;
    padding: 0.4rem 0.2rem;
    color: var(--color-accent-strong);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .account-feedback {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .account-feedback[data-kind='error'] {
    color: var(--color-wrong);
  }

  /* Account form modal (create / sign in) — same idiom as the app's other dialogs. */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgb(26 36 51 / 45%);
    animation: fade 0.12s ease;
  }
  .account-dialog {
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 10px 30px rgb(26 36 51 / 25%);
    animation: pop 0.12s ease;
  }
  .account-dialog h2 {
    margin: 0;
    font-size: 1.15rem;
    color: var(--color-text);
  }
  .account-dialog input {
    padding: 0.6rem 0.75rem;
    border-radius: var(--radius);
    border: 2px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 1rem;
  }
  .account-dialog input:focus-visible {
    outline: none;
    border-color: var(--color-accent);
  }
  .account-actions.end {
    justify-content: flex-end;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .backdrop,
    .account-dialog {
      animation: none;
    }
  }
</style>
