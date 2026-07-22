/// <reference path="../pb_data/types.d.ts" />

// Phase 53 — friend invite: the friend graph + make a `stats` snapshot readable to friends.
//
// Two coupled changes (one feature — "friends can see each other's board rows"):
//
//   1. A `friendships` collection: a small SYMMETRIC edge between two `users` records. Stored in
//      CANONICAL order (`userA` < `userB` lexicographically) with a UNIQUE index on the pair, so a
//      friendship is one row regardless of who invited whom, and adding is idempotent. Only the two
//      endpoints can create / read / delete their row (either side can unfriend). `status` is a
//      forward-compatible select (`pending`/`accepted`); this slice only ever writes `accepted`
//      (opening a fresh invite is instant mutual consent — the pending path is Phase 54's inbox).
//
//   2. WIDEN the Phase-52 `stats` READ rules from owner-only to "own row OR an accepted friend's".
//      This is the whole point: the board can now render other people. Create/update stay owner-only
//      (you only ever write your own snapshot) and delete stays locked. The read filter references
//      the `friendships` collection for a row linking the caller to the snapshot's owner in either
//      canonical ordering.
//
// Committed + auto-applied on start, versioned with the client that reads it; `pb_data/` is gitignored.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // --- 1. friendships collection ---
    const friendships = new Collection({
      type: 'base',
      name: 'friendships',
      // Endpoints-only: every rule ties the row to one of its two members being the caller.
      listRule: '@request.auth.id = userA || @request.auth.id = userB',
      viewRule: '@request.auth.id = userA || @request.auth.id = userB',
      createRule: '@request.auth.id = userA || @request.auth.id = userB',
      updateRule: null, // status is set at creation; no in-place edits this slice
      deleteRule: '@request.auth.id = userA || @request.auth.id = userB', // either side can unfriend
      // One row per unordered pair (rows are stored canonical, userA < userB).
      indexes: ['CREATE UNIQUE INDEX `idx_friendships_pair` ON `friendships` (`userA`, `userB`)'],
      fields: [
        {
          type: 'relation',
          name: 'userA',
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true, // deleting an account dissolves its friendships
        },
        {
          type: 'relation',
          name: 'userB',
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        { type: 'select', name: 'status', required: false, maxSelect: 1, values: ['pending', 'accepted'] },
      ],
    });
    app.save(friendships);

    // --- 2. widen the stats READ rules to accepted friends ---
    const stats = app.findCollectionByNameOrId('stats');
    // "The row is mine, OR there is an accepted friendship linking me to the row's owner (`user`) in
    // either canonical ordering." Create/update remain owner-only; delete stays locked.
    //
    // IMPORTANT — use the `?=` ("any/at-least-one") operator, NOT `=`, for the `@collection.friendships`
    // references. `@collection.X` joins the WHOLE collection; with plain `=` the match silently fails
    // once the table holds more than one row (verified against PocketBase 0.39.8). `?=` correlates the
    // conditions within each branch to the SAME joined row, so it stays correct AND leak-free even when
    // unrelated friendships exist (verified: P-Q friends + R-S friends → P reads only P,Q).
    const friendReadable =
      'user ?= @request.auth.id' +
      ' || (@collection.friendships.userA ?= @request.auth.id && @collection.friendships.userB ?= user && @collection.friendships.status ?= "accepted")' +
      ' || (@collection.friendships.userB ?= @request.auth.id && @collection.friendships.userA ?= user && @collection.friendships.status ?= "accepted")';
    stats.listRule = friendReadable;
    stats.viewRule = friendReadable;
    app.save(stats);
  },
  (app) => {
    // --- down: revert stats to owner-only, then drop friendships ---
    const stats = app.findCollectionByNameOrId('stats');
    if (stats) {
      stats.listRule = 'user = @request.auth.id';
      stats.viewRule = 'user = @request.auth.id';
      app.save(stats);
    }
    const friendships = app.findCollectionByNameOrId('friendships');
    if (friendships) {
      app.delete(friendships);
    }
  },
);
