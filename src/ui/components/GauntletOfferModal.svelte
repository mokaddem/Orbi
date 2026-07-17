<script lang="ts">
  // The Grandmaster Challenge offer modal (Phase 45 ③). A gated, ceremonial dark-teal dialog that
  // states a run's real stakes before it begins — opened from the Progress "prove it" cell instead
  // of launching the run directly. Reuses ConfirmDialog's modal plumbing (role=dialog + aria-modal,
  // initial focus, Escape / backdrop dismiss), restyled for the arena with the `--g-*` tokens.
  //
  // Purely presentational: the caller owns `open`, computes the real `slots` count for the chosen
  // family × continent, and reacts to `onaccept` / `oncancel`. Rendered only while open, so it never
  // traps focus or intercepts keys when closed. When `spent` (the once-a-day-per-family×region
  // attempt is already used — Phase 45 ⑤), the modal opens in a cooldown state: Accept is disabled
  // and the informational line becomes the `cooldown` countdown, blocking a second same-day run.
  import { t, localizedRegion } from '../../i18n';
  import { estimateChallengeMinutes, type MasteryFamily } from '../../domain';
  import ChallengerOrbi from './ChallengerOrbi.svelte';

  let {
    open,
    family,
    region,
    slots,
    spent = false,
    cooldown,
    onaccept,
    oncancel,
  }: {
    open: boolean;
    family: MasteryFamily;
    region: string;
    /** The run's real question-slot count (`challengeSlotCount`) — the "N Questions" stake. */
    slots: number;
    /** `true` once today's attempt for this family × region is spent — gates Accept + shows the countdown. */
    spent?: boolean;
    /** The "next attempt in …" phrase shown while `spent`. */
    cooldown?: string;
    onaccept: () => void;
    oncancel: () => void;
  } = $props();

  // A rough "how long will this take" estimate from the real slot count — a secondary stake beside
  // the question count and the single life, always shown with a "~".
  const minutes = $derived(estimateChallengeMinutes(slots));

  let acceptBtn = $state<HTMLButtonElement | null>(null);
  let declineBtn = $state<HTMLButtonElement | null>(null);

  // Land focus on the primary safe control when the offer opens: Accept normally (the player clicked
  // "prove it" to get here, so Enter confirms), or Not-yet when the run is on cooldown (Accept is
  // disabled then). Escape / backdrop / Not-yet all back out.
  $effect(() => {
    if (open) (spent ? declineBtn : acceptBtn)?.focus();
  });

  function onKeydown(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') oncancel();
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncancel();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="g-backdrop" role="presentation" onclick={onBackdropClick}>
    <div
      class="g-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gm-offer-title"
      aria-describedby="gm-offer-warn"
    >
      <ChallengerOrbi size={58} />
      <h2 id="gm-offer-title" class="g-title">{$t('challenge.offer.title')}</h2>
      <p class="g-sub">{$t(`modes.group.${family}`)} · {$localizedRegion(region)}</p>

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

      <p id="gm-offer-warn" class="warn">{$t('challenge.offer.warning')}</p>
      {#if spent}
        <p class="cooldown spent">{cooldown ?? $t('challenge.offer.cooldown')}</p>
      {:else}
        <p class="cooldown">{$t('challenge.offer.cooldown')}</p>
      {/if}

      <div class="actions">
        <button type="button" class="btn decline" bind:this={declineBtn} onclick={oncancel}>
          {spent ? $t('challenge.offer.close') : $t('challenge.offer.decline')}
        </button>
        {#if !spent}
          <button type="button" class="btn accept" bind:this={acceptBtn} onclick={onaccept}>
            {$t('challenge.offer.accept')}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* A near-black scrim so the ceremonial dialog reads as a departure from the light app. Above the
     app shell (tab bar / rail), matching the arena takeover it leads into. */
  .g-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgb(6 20 18 / 62%);
    animation: g-fade 0.16s ease;
  }

  .g-dialog {
    width: 100%;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1.6rem 1.4rem 1.4rem;
    text-align: center;
    color: var(--g-ink);
    background: var(--g-entry);
    border: 1px solid var(--g-line);
    border-radius: 18px;
    box-shadow:
      0 24px 60px rgb(0 0 0 / 45%),
      inset 0 1px 0 rgb(255 255 255 / 8%);
    animation: g-scalein 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  /* Gold gradient-clip ceremonial title in the reserved serif display face. */
  .g-title {
    margin: 0.3rem 0 0;
    font-family: var(--g-display);
    font-size: 1.55rem;
    font-weight: 700;
    line-height: 1.15;
    background: var(--gold-metal);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .g-sub {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--g-teal);
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

  /* The estimate is secondary to the two real stakes (gold questions / crimson life) — kept muted so
     it reads as a practical heads-up, not another number to fear. */
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

  /* The crimson-ruled warning — the emotional core of the stakes. */
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

  .cooldown {
    margin: 0.1rem 0 0.2rem;
    font-size: 0.82rem;
    color: var(--g-faint);
  }

  /* On cooldown the line is the live countdown — promote it from a faint footnote to a legible,
     gold-tinted status so it reads as "why you can't start", not fine print. */
  .cooldown.spent {
    padding: 0.4rem 0.75rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--g-gold);
    background: color-mix(in oklab, var(--g-gold), transparent 90%);
    border: 1px solid color-mix(in oklab, var(--g-gold), transparent 65%);
    border-radius: 999px;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 0.7rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .btn {
    flex: 1 1 0;
    padding: 0.7rem 1rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.95rem;
  }

  .decline {
    color: var(--g-dim);
    background: transparent;
    border: 1px solid var(--g-line);
  }

  .decline:hover {
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

  @keyframes g-fade {
    from {
      opacity: 0;
    }
  }

  @keyframes g-scalein {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
  }

  /* OS reduce-motion: the in-app pref is collapsed app-wide via `:root[data-reduce-motion]`, but the
     modal sits outside the arena's own guard, so mirror ConfirmDialog and neutralize here too. */
  @media (prefers-reduced-motion: reduce) {
    .g-backdrop,
    .g-dialog {
      animation: none;
    }
  }
</style>
