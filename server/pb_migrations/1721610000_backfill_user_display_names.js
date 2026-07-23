/// <reference path="../pb_data/types.d.ts" />

// Phase 54 — one-time backfill for the `users.displayName` sync (see the
// `pb_hooks/sync_display_name.pb.js` hook). The hook keeps `users.displayName` in step
// with `stats.displayName` going forward, but existing `users` records were left with an
// empty profile name (the UI only ever wrote the board name). Copy the board name onto the
// profile for any user whose `stats` row already has one and whose `users.displayName` is
// still empty (never clobber a profile name that's already set).

migrate(
  (app) => {
    const rows = app.findAllRecords('stats');
    for (const s of rows) {
      if (!s) continue;
      const name = s.get('displayName') || '';
      if (!name) continue;
      const userId = s.get('user');
      if (!userId) continue;
      try {
        const u = app.findRecordById('users', userId);
        if (u.get('displayName')) continue; // don't overwrite an existing profile name
        u.set('displayName', name);
        app.save(u);
      } catch (_) {
        // the related user record is gone — skip
      }
    }
  },
  (_app) => {
    // no-op: a name backfill has no safe inverse
  },
);
