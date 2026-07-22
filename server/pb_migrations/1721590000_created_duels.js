/// <reference path="../pb_data/types.d.ts" />

// Phase 54 — duels (inbox-based): a small server row per async duel so friends can duel WITHOUT
// passing a link by hand, and so a win/loss history finally accrues.
//
// A `duels` row is the server transport for the Phase-46 async duel: it carries the same encoded
// challenge the `#/duel?c=…` link already carries (scope + seed + dataVersion + the challenger's
// name & score, all inside `challenge`), plus the opponent's score once they play. The duel domain
// (`src/domain/duel.ts`) is REUSED verbatim — the only new thing is WHERE the payload lives (a row
// vs a URL) and HOW the result comes back (a write vs a return link).
//
// Model (endpoints-only, friend-gated create):
//   • `challenger` / `opponent` — the two `users` endpoints (both cascadeDelete: deleting an account
//     is the ONLY way a row hard-deletes; dismissing is a per-side flag, never a delete).
//   • `challenge` — the exact `encodeDuel(payload)` string (the challenger's name + score ride inside).
//   • `challengerPrimary/Tiebreak`, `opponentPrimary/Tiebreak` — the two `DuelScore`s as non-negative
//     int columns (the `stats` clamp pattern). `status` disambiguates "opponent hasn't played" — the
//     opponent columns read 0 until `status = 'complete'`, never a nullable score.
//   • `status` — `pending` (awaiting the opponent) → `complete` (both played).
//   • `opponentName` — denormalized so history renders in one query (mirrors `stats.displayName`); the
//     challenger's name is inside `challenge`.
//   • `challengerDismissed` / `opponentDismissed` — per-side hide flags (OQ6): dismissing hides the duel
//     from YOUR history only; neither side can wipe the other's record.
//
// Access rules:
//   • list / view — endpoints-only (`auth.id ∈ {challenger, opponent}`).
//   • create — you-are-the-challenger AND `opponent` is an ACCEPTED FRIEND (the `@collection.friendships`
//     `?=` join — the crux). This keeps duels friend-scoped at the store layer, not just the UI.
//   • update — endpoints-only (the opponent writes their score + flips `status`; either side flips only
//     its OWN dismiss flag). Anti-cheat is a non-goal, so PocketBase's coarse field-level rules aren't
//     relied on — the honesty note lives in the UI, exactly like the Phase-52 snapshot.
//   • delete — locked (a row clears only via the account-deletion relation cascade).
//
// IMPORTANT — the create rule uses `?=` (NOT `=`) for the `@collection.friendships` references, for the
// same reason the Phase-53 widened `stats` read does: `@collection.X` joins the WHOLE collection, and
// with plain `=` the match silently breaks once the table holds more than one row (verified against
// PocketBase 0.39.8). `?=` ("any/at-least-one") correlates the conditions within each parenthesised
// branch to the SAME joined friendship row, so it stays correct AND leak-free even when unrelated
// friendships exist. Friendships are stored canonical (`userA` < `userB`) while duel roles are not, so
// BOTH orderings are checked.
//
// Committed + auto-applied on start, versioned with the client that reads it; `pb_data/` is gitignored.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // "The caller is the challenger, AND there is an ACCEPTED friendship linking the challenger to the
    // opponent in either canonical ordering." Mirrors the proven Phase-53 `?=` idiom.
    const friendGatedCreate =
      '@request.auth.id = challenger' +
      ' && (' +
      '(@collection.friendships.userA ?= challenger && @collection.friendships.userB ?= opponent && @collection.friendships.status ?= "accepted")' +
      ' || (@collection.friendships.userB ?= challenger && @collection.friendships.userA ?= opponent && @collection.friendships.status ?= "accepted")' +
      ')';

    // Endpoints-only for reads/updates (no collection join → plain `=`).
    const endpoints = '@request.auth.id = challenger || @request.auth.id = opponent';

    const duels = new Collection({
      type: 'base',
      name: 'duels',
      listRule: endpoints,
      viewRule: endpoints,
      createRule: friendGatedCreate,
      updateRule: endpoints, // opponent writes score+status; either side flips only its own dismiss flag
      deleteRule: null, // locked — clears only via account-deletion cascade (dismiss is a per-side flag)
      fields: [
        {
          type: 'relation',
          name: 'challenger',
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true, // deleting an account clears its duels
        },
        {
          type: 'relation',
          name: 'opponent',
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        // The exact Phase-46 `encodeDuel(payload)` string — base64url of a compact JSON. Bounded well
        // above the worst case (long region names + a 24-char name ≈ 340 chars encoded).
        { type: 'text', name: 'challenge', required: true, max: 1000 },
        // The two DuelScores as non-negative int columns (the `stats` clamp). Opponent columns stay 0
        // until `status = 'complete'` — `status`, not a nullable score, marks "not played yet".
        { type: 'number', name: 'challengerPrimary', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'challengerTiebreak', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'opponentPrimary', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'opponentTiebreak', required: false, min: 0, onlyInt: true },
        { type: 'select', name: 'status', required: false, maxSelect: 1, values: ['pending', 'complete'] },
        // Denormalized so the inbox/history render without joining to `stats`/`users`.
        { type: 'text', name: 'opponentName', required: false, max: 24 },
        // Per-side hide flags (OQ6) — dismissing hides the duel from YOUR history only.
        { type: 'bool', name: 'challengerDismissed', required: false },
        { type: 'bool', name: 'opponentDismissed', required: false },
      ],
      // Common access patterns: an endpoint's inbox (opponent + status) and history (either endpoint).
      indexes: [
        'CREATE INDEX `idx_duels_opponent_status` ON `duels` (`opponent`, `status`)',
        'CREATE INDEX `idx_duels_challenger_status` ON `duels` (`challenger`, `status`)',
      ],
    });

    app.save(duels);
  },
  (app) => {
    // --- down: drop the collection (and its rows) ---
    const duels = app.findCollectionByNameOrId('duels');
    if (duels) {
      app.delete(duels);
    }
  },
);
