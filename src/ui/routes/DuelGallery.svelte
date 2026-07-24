<script lang="ts">
  // Duel UI gallery (#/duel-gallery) — a dev-only living reference, in the spirit of #/ranks and
  // #/review: it mounts the REAL head-to-head duel components in every state with mock fixtures, so it
  // can't drift from the game and doubles as the workbench for redesigning them. Not in the nav.
  //
  // Route/embedded screens read global state (router querystring, the duels stores, the friend graph),
  // so each takes a small backwards-compatible `preview` seam used only here. The overlay components
  // (QR / name prompt / friend sheet / confirm) are `position: fixed`; each is mounted inside a
  // `.stage` whose `transform` makes it the containing block, so the overlay renders inline (contained)
  // instead of covering the page.
  import { onMount, onDestroy } from 'svelte';
  import {
    DUEL_PROTOCOL_VERSION,
    encodeDuel,
    type DuelPayload,
    type DuelScore,
  } from '../../domain';
  import { duelDataVersion, duelLink, renderDuelCard, type DuelCardText } from '../duel';
  import type { DuelEntry } from '../stores/duels';
  import type { FriendRow } from '../stores/friends';

  import Duel from './Duel.svelte';
  import Duels from './Duels.svelte';
  import FriendInvite from './FriendInvite.svelte';
  import DuelVerdictCard from '../components/DuelVerdictCard.svelte';
  import DuelsCard from '../components/DuelsCard.svelte';
  import DuelShareCard from '../components/DuelShareCard.svelte';
  import DuelQrModal from '../components/DuelQrModal.svelte';
  import DuelNamePrompt from '../components/DuelNamePrompt.svelte';
  import FriendInviteSheet from '../components/FriendInviteSheet.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import Toast from '../components/Toast.svelte';
  import { t } from '../../i18n';

  const noop = (): void => {};
  const dv = duelDataVersion();

  function score(primary: number, tiebreak = 74210): DuelScore {
    return { primary, tiebreak };
  }

  /** A duel payload with sensible defaults (fixed / 12Q flags), overridable per specimen. */
  function mk(over: Partial<DuelPayload> = {}): DuelPayload {
    return {
      protocolVersion: DUEL_PROTOCOL_VERSION,
      dataVersion: dv,
      mode: 'flag-to-country',
      type: 'fixed',
      length: 12,
      choices: 4,
      seed: 918273,
      challengerName: 'Sami',
      challengerScore: score(9),
      ...over,
    };
  }

  // --- #/duel screen codes (fed through the `queryOverride` seam) ---
  const incomingQuery = `c=${encodeDuel(mk({ region: 'Europe', challengerScore: score(9) }))}`;
  const mismatchQuery = `c=${encodeDuel(mk({ dataVersion: 'v0-legacy', region: 'Europe', challengerScore: score(10) }))}`;
  const returnQuery = `r=${encodeDuel(
    mk({ challengerScore: score(10), opponentName: 'Amélie', opponentScore: score(8) }),
  )}`;
  const brokenQuery = 'c=not-a-valid-duel-code';

  // --- #/duels hub fixtures ---
  function entry(o: Partial<DuelEntry> & { id: string }): DuelEntry {
    return {
      status: 'complete',
      iAmChallenger: false,
      otherUserId: 'u',
      otherName: 'Friend',
      payload: mk(),
      code: '',
      myScore: null,
      theirScore: null,
      verdict: null,
      declined: false,
      ...o,
    };
  }

  const hubInbox: DuelEntry[] = [
    entry({
      id: 'i1',
      status: 'pending',
      otherUserId: 'u-amelie',
      otherName: 'Amélie',
      payload: mk({ region: 'Europe', challengerScore: score(10) }),
      theirScore: score(10),
    }),
    entry({
      id: 'i2',
      status: 'pending',
      otherUserId: 'u-kenji',
      otherName: 'Kenji',
      payload: mk({ mode: 'map-locate', type: 'blitz', challengerScore: score(1840) }),
      theirScore: score(1840),
    }),
  ];

  const hubOutbox: DuelEntry[] = [
    entry({
      id: 'o1',
      status: 'pending',
      iAmChallenger: true,
      otherUserId: 'u-priya',
      otherName: 'Priya',
      payload: mk({ mode: 'country-to-capital', region: 'Asia' }),
      myScore: score(8),
    }),
    entry({
      id: 'o2',
      status: 'pending',
      iAmChallenger: true,
      otherUserId: 'u-diego',
      otherName: 'Diego',
      payload: mk({ region: 'Americas' }),
      myScore: score(9),
      declined: true,
    }),
  ];

  const hubHistory: DuelEntry[] = [
    entry({
      id: 'h1',
      otherUserId: 'u-amelie',
      otherName: 'Amélie',
      verdict: 'win',
      payload: mk({ region: 'Europe' }),
      myScore: score(11),
      theirScore: score(8),
    }),
    entry({
      id: 'h2',
      otherUserId: 'u-amelie',
      otherName: 'Amélie',
      verdict: 'tie',
      payload: mk({ mode: 'country-to-flag' }),
      myScore: score(9),
      theirScore: score(9),
    }),
    entry({
      id: 'h3',
      otherUserId: 'u-amelie',
      otherName: 'Amélie',
      verdict: 'loss',
      payload: mk({ mode: 'map-locate', region: 'Africa' }),
      myScore: score(7),
      theirScore: score(10),
    }),
    entry({
      id: 'h4',
      otherUserId: 'u-kenji',
      otherName: 'Kenji',
      verdict: 'win',
      payload: mk({ mode: 'capital-to-country', type: 'blitz' }),
      myScore: score(2100),
      theirScore: score(1780),
    }),
  ];

  // --- Share-card fixtures ---
  const galleryFriends: FriendRow[] = [
    {
      userId: 'u-amelie',
      displayName: 'Amélie',
      xp: 5200,
      rankIndex: 4,
      fullyMastered: 12,
      sessionCount: 40,
    },
    {
      userId: 'u-kenji',
      displayName: 'Kenji',
      xp: 3100,
      rankIndex: 3,
      fullyMastered: 7,
      sessionCount: 22,
    },
  ];

  // A longer friend list for the redesign proposal, to show the vertical list scrolling past ~5.
  const manyFriends = [
    'Amélie',
    'Kenji',
    'Priya',
    'Diego',
    'Noor',
    'Lars',
    'Mei',
    'Tomás',
    'Fatima',
    'Olivier',
    'Yuki',
    'Zara',
  ].map((displayName, i): FriendRow => ({
    userId: `u${i}`,
    displayName,
    xp: 4000 - i * 200,
    rankIndex: 3,
    fullyMastered: 5,
    sessionCount: 20,
  }));

  const qrUrl = duelLink(encodeDuel(mk({ region: 'Europe' })), 'c');
  const friendInviteUrl = `${typeof location !== 'undefined' ? location.origin : ''}/#/friend-invite?c=eyJ1aWQiOiJ1LXNhbWkiLCJuYW1lIjoiU2FtaSJ9`;

  // Live scorecard PNG (the real canvas renderer), shown as an <img> like the Summary card does.
  let cardUrl = $state<string | null>(null);
  onMount(() => {
    const text: DuelCardText = {
      eyebrow: 'Sami challenges you',
      scoreValue: '9/12',
      scoreUnit: '',
      scope: 'Flags · Europe',
      cta: 'Can you beat it?',
      brand: 'Orbi',
    };
    let stale = false;
    void renderDuelCard(text).then((blob) => {
      if (!stale && blob) cardUrl = URL.createObjectURL(blob);
    });
    // The mounted overlays focus a control on open, and `.focus()` scrolls the page down to the last
    // one — snap back to the top once, after those microtasks settle, so the gallery opens at the top.
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 0)));
    return () => {
      stale = true;
    };
  });
  onDestroy(() => {
    if (cardUrl) URL.revokeObjectURL(cardUrl);
  });
</script>

{#snippet cap(name: string, state: string, path: string)}
  <div class="cap">
    <span class="cap-name">{name}</span>
    <span class="cap-state">{state}</span>
    <code class="cap-path">{path}</code>
  </div>
{/snippet}

<section class="gallery">
  <header class="intro">
    <h1>Duel UI gallery</h1>
    <p>
      Every head-to-head duel element, in every state, rendered from the real components with mock
      fixtures. A dev-only reference at <code>#/duel-gallery</code> (not in the nav) — the baseline for
      redesigning the visuals, mascots, colour and layout.
    </p>
  </header>

  <!-- ============================ SEND A CHALLENGE ============================ -->
  <h2 class="group">Send a challenge</h2>
  <div class="grid">
    <figure class="specimen">
      {@render cap('DuelShareCard', 'Collapsed (first view)', 'components/DuelShareCard.svelte')}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={true}
          friends={galleryFriends}
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelShareCard', 'Expanded — friend list', 'components/DuelShareCard.svelte')}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={true}
          friends={galleryFriends}
          initialExpanded
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap(
        'DuelShareCard',
        'Expanded — one already sent',
        'components/DuelShareCard.svelte',
      )}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={true}
          friends={galleryFriends}
          sentIds={['u-amelie']}
          initialExpanded
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelShareCard', 'Expanded — many friends', 'components/DuelShareCard.svelte')}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={true}
          friends={manyFriends}
          initialExpanded
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelShareCard', 'Locked — not signed in', 'components/DuelShareCard.svelte')}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={false}
          friends={[]}
          directLocked="account"
          initialExpanded
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
          onUnlock={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelShareCard', 'Locked — no friends yet', 'components/DuelShareCard.svelte')}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={false}
          friends={[]}
          directLocked="friends"
          initialExpanded
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
          onUnlock={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelShareCard', 'Backend-free (link only)', 'components/DuelShareCard.svelte')}
      <div class="frame">
        <DuelShareCard
          previewUrl={cardUrl}
          canInboxSend={false}
          friends={[]}
          initialExpanded
          onShare={noop}
          onCopyImage={noop}
          onCopyLink={noop}
          onShowQr={noop}
          onPickFriend={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('Toast', 'Sent confirmation', 'components/Toast.svelte')}
      <div class="frame stage short" inert>
        <Toast message="Challenge sent to Amélie!" />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('renderDuelCard', 'Shared scorecard PNG', 'ui/duel.ts')}
      <div class="frame center">
        {#if cardUrl}
          <img class="scorecard" src={cardUrl} alt="Duel scorecard" />
        {:else}
          <p class="muted">Rendering…</p>
        {/if}
      </div>
    </figure>

    <figure class="specimen wide">
      {@render cap('DuelQrModal', 'Offline "Show QR"', 'components/DuelQrModal.svelte')}
      <!-- `inert`: the contained overlay must not grab focus (which would scroll the page). -->
      <div class="frame stage tall" inert>
        <DuelQrModal
          open={true}
          url={qrUrl}
          eyebrow="Sami challenges you!"
          context="Flags · Europe · Beat 9/12"
          onClose={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelNamePrompt', 'First share', 'components/DuelNamePrompt.svelte')}
      <div class="frame stage short" inert>
        <DuelNamePrompt open={true} onsave={noop} oncancel={noop} />
      </div>
    </figure>
  </div>

  <!-- ============================ THE DUELS HUB ============================ -->
  <h2 class="group">The Duels hub &mdash; <code>#/duels</code></h2>
  <div class="grid">
    <figure class="specimen">
      {@render cap('DuelsCard (Home)', 'No pending', 'components/DuelsCard.svelte')}
      <div class="frame"><DuelsCard preview={{ pending: 0 }} /></div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelsCard (Home)', 'Pending badge', 'components/DuelsCard.svelte')}
      <div class="frame"><DuelsCard preview={{ pending: 3 }} /></div>
    </figure>

    <figure class="specimen wide">
      {@render cap('Duels', 'Inbox · outbox · history', 'routes/Duels.svelte')}
      <div class="frame">
        <Duels preview={{ inbox: hubInbox, outbox: hubOutbox, history: hubHistory }} />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('Duels', 'Gated (no account)', 'routes/Duels.svelte')}
      <div class="frame">
        <Duels preview={{ gated: true, inbox: [], outbox: [], history: [] }} />
      </div>
    </figure>
  </div>

  <!-- ============================ THE DUEL PAGE ============================ -->
  <h2 class="group">The duel page &mdash; <code>#/duel</code></h2>
  <div class="grid">
    <figure class="specimen">
      {@render cap('Duel', 'Incoming challenge', 'routes/Duel.svelte')}
      <div class="frame"><Duel queryOverride={incomingQuery} /></div>
    </figure>

    <figure class="specimen">
      {@render cap('Duel', 'Incoming + version warning', 'routes/Duel.svelte')}
      <div class="frame"><Duel queryOverride={mismatchQuery} /></div>
    </figure>

    <figure class="specimen">
      {@render cap('Duel', 'Return leg (verdict)', 'routes/Duel.svelte')}
      <div class="frame"><Duel queryOverride={returnQuery} /></div>
    </figure>

    <figure class="specimen">
      {@render cap('Duel', 'Broken link', 'routes/Duel.svelte')}
      <div class="frame"><Duel queryOverride={brokenQuery} /></div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelVerdictCard', 'Win + send result', 'components/DuelVerdictCard.svelte')}
      <div class="frame">
        <DuelVerdictCard
          verdict="win"
          type="fixed"
          youScore={score(11)}
          theirScore={score(8)}
          theirName="Amélie"
          onSendResult={noop}
          onHome={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelVerdictCard', 'Loss (home only)', 'components/DuelVerdictCard.svelte')}
      <div class="frame">
        <DuelVerdictCard
          verdict="loss"
          type="fixed"
          youScore={score(7)}
          theirScore={score(10)}
          theirName="Kenji"
          onHome={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelVerdictCard', 'Tie', 'components/DuelVerdictCard.svelte')}
      <div class="frame">
        <DuelVerdictCard
          verdict="tie"
          type="fixed"
          youScore={score(9)}
          theirScore={score(9)}
          theirName="Priya"
          onHome={noop}
        />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('DuelVerdictCard', 'Blitz win + feedback', 'components/DuelVerdictCard.svelte')}
      <div class="frame">
        <DuelVerdictCard
          verdict="win"
          type="blitz"
          youScore={score(2100)}
          theirScore={score(1780)}
          theirName="Kenji"
          onHome={noop}
          feedback="duel.linkCopied"
        />
      </div>
    </figure>
  </div>

  <!-- ============================ CONNECT A FRIEND ============================ -->
  <h2 class="group">
    Connect a friend <span class="group-note">(the duel-inbox prerequisite)</span>
  </h2>
  <div class="grid">
    <figure class="specimen wide">
      {@render cap('FriendInviteSheet', 'Share my invite', 'components/FriendInviteSheet.svelte')}
      <div class="frame stage tall" inert>
        <FriendInviteSheet open={true} url={friendInviteUrl} onClose={noop} />
      </div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Added', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="added" previewName="Sami" /></div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Needs account', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="no-account" previewName="Sami" /></div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Connecting', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="adding" /></div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Own link', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="self" /></div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Offline', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="no-backend" /></div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Broken link', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="broken" /></div>
    </figure>

    <figure class="specimen">
      {@render cap('FriendInvite', 'Failed', 'routes/FriendInvite.svelte')}
      <div class="frame"><FriendInvite previewStatus="failed" /></div>
    </figure>
  </div>

  <!-- ============================ DIALOG ============================ -->
  <h2 class="group">Dialog</h2>
  <div class="grid">
    <figure class="specimen">
      {@render cap('ConfirmDialog', 'Quit a received duel', 'routes/Play.svelte')}
      <div class="frame stage short" inert>
        <ConfirmDialog
          open={true}
          title={$t('duels.quitTitle')}
          message={$t('duels.quitBody', { name: 'Amélie' })}
          confirmLabel={$t('duels.quitConfirm')}
          cancelLabel={$t('duels.quitCancel')}
          onconfirm={noop}
          oncancel={noop}
        />
      </div>
    </figure>
  </div>
</section>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 1100px;
    margin-inline: auto;
    width: 100%;
  }

  .intro h1 {
    margin: 0 0 0.35rem;
    font-size: 1.6rem;
  }

  .intro p {
    margin: 0;
    max-width: 68ch;
    color: var(--color-muted);
  }

  .intro code,
  .group code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
    padding: 0.05em 0.35em;
    border-radius: 6px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
  }

  .group {
    margin: 1.5rem 0 0;
    padding-bottom: 0.35rem;
    border-bottom: 2px solid var(--color-border);
    font-size: 1.05rem;
    letter-spacing: 0.02em;
    color: var(--color-accent-strong);
  }

  .group-note {
    font-weight: 500;
    font-size: 0.82rem;
    color: var(--color-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
    align-items: start;
  }

  /* A wider tile for the busier screens (hub, QR, sheet). */
  .specimen.wide {
    grid-column: span 2;
  }

  @media (max-width: 720px) {
    .specimen.wide {
      grid-column: auto;
    }
  }

  .specimen {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    min-width: 0;
  }

  .cap {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 0.6rem;
  }

  .cap-name {
    font-weight: 800;
    font-size: 0.95rem;
  }

  .cap-state {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-accent);
  }

  .cap-path {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.72rem;
    color: var(--color-muted);
  }

  /* Each specimen sits in a phone-width frame on a chequered ground, so mobile-first layouts read as
     they would on a device and any transparent surfaces are visible against the backdrop. */
  .frame {
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background:
      linear-gradient(45deg, rgb(128 128 128 / 7%) 25%, transparent 25%),
      linear-gradient(-45deg, rgb(128 128 128 / 7%) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgb(128 128 128 / 7%) 75%),
      linear-gradient(-45deg, transparent 75%, rgb(128 128 128 / 7%) 75%);
    background-size: 20px 20px;
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0;
    overflow: hidden;
  }

  .frame.center {
    display: grid;
    place-items: center;
  }

  /* Full-viewport routes centre their own content; keep the phone width so their mobile layout shows. */
  .frame :global(.duel),
  .frame :global(.duels),
  .frame :global(.invite),
  .frame :global(.summary) {
    max-width: 390px;
    margin-inline: auto;
  }

  /* FriendInvite reserves `min-height: 60vh` to centre itself on a real screen — collapse that inside
     a gallery tile so the card sizes to its content instead of a huge viewport-height block. */
  .frame :global(.invite) {
    min-height: 0;
    padding-block: 0;
  }

  .scorecard {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1 / 1;
    border-radius: 18px;
    box-shadow: var(--shadow-card);
  }

  .muted {
    color: var(--color-muted);
  }

  /* A stage contains an overlay component's `position: fixed` backdrop (the `transform` makes it the
     containing block) so the modal renders inline, clipped to this box, instead of covering the page. */
  .frame.stage {
    position: relative;
    transform: translateZ(0);
    padding: 0;
  }

  .frame.stage.short {
    height: 300px;
  }

  .frame.stage.tall {
    height: 560px;
  }
</style>
