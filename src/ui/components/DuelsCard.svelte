<script lang="ts">
  // Home "duels" card (Phase 54) — the glanceable entry into the `#/duels` hub, with a pending-count
  // badge. Self-gating: shown only for a configured backend + a real account (the inbox/history need
  // both); anonymous / no-backend players see nothing here and keep the full Phase-46 link duel on the
  // Summary. It refreshes the duels store on mount (a no-op when gated) so the badge is live on Home.
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { pendingCount, refreshDuels } from '../stores/duels';
  import { identity } from '../stores/identity';
  import { isBackendConfigured } from '../../backend/client';
  import Icon from './Icon.svelte';

  // `preview` lets the duel gallery force the card visible with a chosen pending count, bypassing the
  // backend + account gate (and the live store / refresh). Dev-only seam; production passes nothing.
  let { preview }: { preview?: { pending: number } } = $props();

  const shown = $derived(preview ? true : isBackendConfigured() && $identity.tier === 'account');
  const count = $derived(preview ? preview.pending : $pendingCount);

  onMount(() => {
    if (!preview) void refreshDuels();
  });

  function open(): void {
    push('/duels');
  }
</script>

{#if shown}
  <button type="button" class="duels-card" onclick={open}>
    <span class="ico" aria-hidden="true"><Icon name="swords" size={22} /></span>
    <span class="text">
      <span class="title">{$t('duels.cardTitle')}</span>
      <span class="sub">{$t('duels.cardSubtitle')}</span>
    </span>
    {#if count > 0}
      <span class="badge">{count}</span>
    {/if}
  </button>
{/if}

<style>
  .duels-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    text-align: left;
    padding: 0.9rem 1.05rem 0.9rem 1.2rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease;
  }

  /* Teal→coral edge rail — the two-sided "versus" cue, echoed by the split crest + coral badge. */
  .duels-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 6px;
    background: linear-gradient(180deg, var(--color-accent) 0 45%, var(--color-coral) 55% 100%);
  }

  .duels-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-accent);
  }

  .ico {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.4rem;
    height: 2.4rem;
    flex: none;
    border-radius: 999px;
    color: #fff;
    background: linear-gradient(135deg, var(--color-accent) 0 50%, var(--color-coral) 50% 100%);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
    flex: 1;
  }

  .title {
    font-weight: 800;
    font-size: 1.05rem;
  }

  .sub {
    color: var(--color-muted);
    font-size: 0.85rem;
  }

  .badge {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.6rem;
    height: 1.6rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--color-coral);
    color: #fff;
    font-weight: 800;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 3px 0 var(--color-coral-strong);
  }

  @media (prefers-reduced-motion: reduce) {
    .duels-card {
      transition: none;
    }

    .duels-card:hover {
      transform: none;
    }
  }
</style>
