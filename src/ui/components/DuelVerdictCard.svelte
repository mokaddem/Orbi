<script lang="ts">
  // Head-to-head duel result (Phase 46; restyled with the duel "rivalry" skin). Presentational.
  // The verdict lands as a rivalry BAND: the two players face off — teal is you, coral is the
  // rival — scores called out big, the winner scaled + crowned and the loser dimmed. Because the
  // band already names both players, the caller no longer needs a separate "{name} took your
  // challenge" title. Below the band: the result headline and whichever actions the caller wires
  // up — the challengee's Summary passes `onSendResult` (link/QR duels only); the challenger's
  // `#/duel?r=…` return screen passes `onHome`. `feedback` is a transient i18n key (e.g. a "link
  // copied" line). (Rematch was removed app-wide — a duel is started from the Session History.)
  import { t } from '../../i18n';
  import type { DuelScore, DuelType, DuelVerdict } from '../../domain';
  import Icon from './Icon.svelte';

  let {
    verdict,
    type,
    youScore,
    theirScore,
    theirName,
    onSendResult,
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
    onHome?: () => void;
    feedback?: string | null;
  } = $props();

  const oppLabel = $derived(theirName || $t('duel.opponent'));
  const unit = $derived(type === 'blitz' ? $t('duel.points') : '');
  const headline = $derived(
    verdict === 'win' ? $t('duel.win') : verdict === 'loss' ? $t('duel.loss') : $t('duel.tie'),
  );
  // First letter of the rival's name for their token; a neutral mark when anonymous.
  const rivalInitial = $derived(theirName.trim()[0]?.toUpperCase() ?? '?');
  const youWon = $derived(verdict === 'win');
  const theyWon = $derived(verdict === 'loss');
</script>

<div class="verdict" class:win={youWon} class:loss={theyWon}>
  <!-- The rivalry band: you (teal) vs them (coral), scores big, winner crowned. -->
  <div class="band">
    <div class="side you" class:winner={youWon} class:loser={theyWon}>
      <span class="crown" aria-hidden="true">
        {#if youWon}<Icon name="crown" size={18} />{/if}
      </span>
      <span class="token you" aria-hidden="true"><Icon name="globe" size={22} /></span>
      <span class="score"
        >{youScore.primary.toLocaleString()}{#if unit}<span class="unit">{unit}</span>{/if}</span
      >
      <span class="who">{$t('duel.youLabel')}</span>
    </div>

    <span class="vs" aria-hidden="true">{$t('duel.vs')}</span>

    <div class="side rival" class:winner={theyWon} class:loser={youWon}>
      <span class="crown" aria-hidden="true">
        {#if theyWon}<Icon name="crown" size={18} />{/if}
      </span>
      <span class="token rival" aria-hidden="true">{rivalInitial}</span>
      <span class="score"
        >{theirScore.primary.toLocaleString()}{#if unit}<span class="unit">{unit}</span>{/if}</span
      >
      <span class="who">{oppLabel}</span>
    </div>
  </div>

  <div class="body">
    <p class="headline">{headline}</p>

    {#if onSendResult || onHome}
      <div class="actions">
        {#if onSendResult}
          <button type="button" class="primary" onclick={onSendResult}>
            <Icon name="share" size="1em" />
            {$t('duel.sendResult')}
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

    <p class="feedback" role="status" aria-live="polite">{feedback ? $t(feedback) : ''}</p>
  </div>
</div>

<style>
  .verdict {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  /* The outcome tints the whole card's rim toward the winner's side. */
  .verdict.win {
    border-color: var(--color-accent);
  }
  .verdict.loss {
    border-color: var(--color-coral);
  }

  /* ---- Rivalry band: two facing sides split by a VS token, on a teal→coral wash. ---- */
  .band {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0.9rem;
    padding: 1.1rem 1rem;
    background: linear-gradient(
      120deg,
      var(--color-accent-weak) 0%,
      var(--color-surface) 50%,
      var(--color-coral-weak) 100%
    );
    border-bottom: 2px solid var(--color-border);
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 4.5rem;
    max-width: 8rem;
  }

  /* Reserve the crown row on both sides so the tokens stay vertically aligned. */
  .crown {
    display: inline-flex;
    height: 1.1rem;
    color: var(--color-gold);
  }

  .token {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 999px;
    color: #fff;
    font-weight: 800;
    font-size: 1.05rem;
    border: 2px solid rgb(255 255 255 / 70%);
    box-shadow: 0 2px 6px -2px rgb(18 49 48 / 35%);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }
  .token.you {
    background: linear-gradient(140deg, var(--color-accent), var(--color-accent-strong));
  }
  .token.rival {
    background: linear-gradient(140deg, var(--color-coral), var(--color-coral-strong));
  }

  /* The winner pops: a little bigger, ringed with a coloured glow. */
  .side.you.winner .token {
    transform: scale(1.08);
    box-shadow:
      0 0 0 3px var(--color-surface),
      0 0 16px rgb(16 165 160 / 55%);
  }
  .side.rival.winner .token {
    transform: scale(1.08);
    box-shadow:
      0 0 0 3px var(--color-surface),
      0 0 16px rgb(224 83 47 / 50%);
  }
  /* The loser recedes. */
  .side.loser {
    opacity: 0.62;
  }

  .score {
    font-weight: 800;
    font-size: 1.55rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }
  .side.you .score {
    color: var(--color-accent-strong);
  }
  .side.rival .score {
    color: var(--color-coral-strong);
  }
  .unit {
    font-size: 0.7rem;
    font-weight: 700;
  }

  .who {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-text);
    text-align: center;
    word-break: break-word;
  }

  .vs {
    flex: none;
    margin-top: 1.55rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 999px;
    background: var(--color-text);
    color: var(--color-surface);
    font-weight: 800;
    font-size: 0.72rem;
    letter-spacing: 0.03em;
  }

  /* ---- Below the band: headline + actions. ---- */
  .body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.6rem;
    padding: 1.05rem 1.2rem 1.25rem;
  }

  .headline {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-accent-strong);
  }
  .verdict.loss .headline {
    color: var(--color-coral-strong);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 0.1rem;
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

  .ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .feedback {
    margin: 0;
    min-height: 1.2em;
    color: var(--color-correct);
    font-weight: 600;
    font-size: 0.9rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .token,
    .actions button {
      transition: none;
    }

    .actions .primary:hover {
      transform: none;
    }
  }
</style>
