/// <reference path="../pb_data/types.d.ts" />

// Phase 52 — progress board: a per-player `stats` snapshot collection.
//
// One row per `users` record (enforced by a UNIQUE index on the `user` relation),
// holding a compact, CLIENT-REPORTED projection of the player's headline progress
// (XP, rank, a few tallies + a denormalized display name). It is the server mirror
// of what the app already derives locally from append-only history — the board's
// currency, not a new source of truth. Anti-cheat is an explicit non-goal: the
// client writes whatever it computes; the server stores it verbatim.
//
// Access rules are OWNER-ONLY this phase (read/create/update your own row): the
// board renders only *you* until Phase 53 adds the friend graph and widens the
// read rule to friends. `deviceId` is carried for disambiguation/dedup.
//
// Committed + auto-applied on start, versioned with the client that reads it;
// `pb_data/` (the actual data) is gitignored.

migrate(
  (app) => {
    // The relation target — the built-in `users` auth collection (Phase 51).
    const users = app.findCollectionByNameOrId('users');

    const collection = new Collection({
      type: 'base',
      name: 'stats',
      // Owner-only: every rule ties the row to its `user` relation matching the
      // caller. (Phase 53 widens list/view to the friend graph.)
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: 'user = @request.auth.id',
      updateRule: 'user = @request.auth.id',
      // Deletion isn't part of the flow (reset zeroes the row); keep it locked.
      deleteRule: null,
      // One row per player — the upsert relies on this.
      indexes: ['CREATE UNIQUE INDEX `idx_stats_user` ON `stats` (`user`)'],
      fields: [
        {
          type: 'relation',
          name: 'user',
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true, // deleting the account removes its snapshot
        },
        // Denormalized so Phase 53's friend board renders in a single query.
        { type: 'text', name: 'displayName', required: false, max: 24 },
        { type: 'text', name: 'deviceId', required: false, max: 100 },
        // Headline projection — all client-computed, non-negative integers.
        { type: 'number', name: 'xp', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'rankIndex', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'sessionCount', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'totalCorrect', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'totalQuestions', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'longestStreak', required: false, min: 0, onlyInt: true },
        { type: 'number', name: 'fullyMastered', required: false, min: 0, onlyInt: true },
      ],
    });

    app.save(collection);
  },
  (app) => {
    // --- down: drop the collection (and its rows) ---
    const collection = app.findCollectionByNameOrId('stats');
    if (collection) {
      app.delete(collection);
    }
  },
);
