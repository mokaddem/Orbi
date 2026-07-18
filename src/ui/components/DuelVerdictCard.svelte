<script lang="ts">
  // Head-to-head duel result (Phase 46) — presentational. Renders the verdict headline, the two
  // scores (viewer always "You" on top), and whichever actions the caller wires up: the challengee's
  // Summary passes `onSendResult` + `onRematch`; the challenger's `#/duel?r=…` return screen passes
  // `onRematch` + `onHome`. `feedback` is a transient i18n key (e.g. a "link copied" line).
  import { t } from '../../i18n';
  import type { DuelScore, DuelType, DuelVerdict } from '../../domain';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';

  let {
    verdict,
    type,
    youScore,
    theirScore,
    theirName,
    onSendResult,
    onRematch,
    onHome,
    feedback = null,
  }: {
    verdict: DuelVerdict;
    type: DuelType;
    youScore: DuelScore;
    theirScore: DuelScore;
    /** The other player's display name; falls back to a generic label when empty. */
    theirName: string;
    onSendResult?: () => void;
    onRematch?: () => void;
    onHome?: () => void;
    feedback?: string | null;
  } = $props();

  const oppLabel = $derived(theirName || $t('duel.opponent'));
  const unit = $derived(type === 'blitz' ? ` ${$t('duel.points')}` : '');
  const headline = $derived(
    verdict === 'win' ? $t('duel.win') : verdict === 'loss' ? $t('duel.loss') : $t('duel.tie'),
  );
  const pose = $derived(verdict === 'win' ? 'cheer' : verdict === 'loss' ? 'encouraging' : 'proud');
</script>

<div class="verdict" class:win={verdict === 'win'} class:loss={verdict === 'loss'}>
  <Mascot {pose} animate="bounce-in" size={84} />
  <p class="headline">{headline}</p>

  <div class="scores">
    <div class="score-row" class:winner={verdict === 'win'}>
      <span class="who">{$t('duel.youLabel')}</span>
      <span class="pts">{youScore.primary.toLocaleString()}{unit}</span>
    </div>
    <div class="score-row" class:winner={verdict === 'loss'}>
      <span class="who">{oppLabel}</span>
      <span class="pts">{theirScore.primary.toLocaleString()}{unit}</span>
    </div>
  </div>

  {#if onSendResult || onRematch || onHome}
    <div class="actions">
      {#if onSendResult}
        <button type="button" class="primary" onclick={onSendResult}>
          <Icon name="share" size="1em" />
          {$t('duel.sendResult')}
        </button>
      {/if}
      {#if onRematch}
        <button type="button" class="secondary" onclick={onRematch}>
          <Icon name="swords" size="1em" />
          {$t('duel.rematch')}
        </button>
      {/if}
      {#if onHome}
        <button type="button" class="ghost" onclick={onHome}>
          <Icon name="home" size="1em" />
          {$t('duel.home')}
        </button>
      {/if}
    </div>
  {/if}

  {#if onRematch}
    <p class="hint">{$t('duel.rematchHint')}</p>
  {/if}

  <p class="feedback" role="status" aria-live="polite">{feedback ? $t(feedback) : ''}</p>
</div>

<style>
  .verdict {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.6rem;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .verdict.win {
    border-color: var(--color-correct);
  }

  .verdict.loss {
    border-color: var(--color-border);
  }

  .headline {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-accent-strong);
  }

  .scores {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    max-width: 22rem;
  }

  .score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0.9rem;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .score-row.winner {
    border-color: var(--color-correct);
    background: var(--color-correct-bg);
  }

  .who {
    font-weight: 600;
  }

  .pts {
    font-weight: 800;
    font-size: 1.2rem;
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 0.3rem;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.3rem;
    border-radius: 999px;
    font-weight: 700;
    border: 2px solid transparent;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    box-shadow: var(--shadow-chunky);
  }

  .primary:hover {
    transform: translateY(-2px);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .secondary {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .secondary:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .hint {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.8rem;
  }

  .feedback {
    margin: 0;
    min-height: 1.2em;
    color: var(--color-correct);
    font-weight: 600;
    font-size: 0.9rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .actions button {
      transition: none;
    }

    .actions .primary:hover,
    .actions .secondary:hover {
      transform: none;
    }
  }
</style>
