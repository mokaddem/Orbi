/// <reference path="../pb_data/types.d.ts" />

// Phase 54 — keep the account profile name in sync with the board name.
//
// The client updates the DENORMALIZED `stats.displayName` (via the board snapshot,
// `src/backend/board.ts`) whenever the player's name changes, but the canonical
// `users.displayName` was never updated from the UI (the name editor writes only the
// local `playerName` pref; the `renameTo` orchestration that would patch `users` is not
// wired to any control). That left `users.displayName` permanently empty.
//
// This hook closes the gap SERVER-SIDE and independently of which client path set the
// name: whenever a `stats` row is created or updated, mirror its `displayName` onto the
// related `users` record. Runs with elevated privileges, so the owner-only `users` update
// rule doesn't block it. Additive and best-effort — it never disrupts the stats write.
//
// NOTE: each PocketBase JSVM hook handler executes in its OWN isolated scope — it cannot
// reference functions/variables declared elsewhere in this file (doing so throws
// "ReferenceError: <name> is not defined" and fails the triggering request). So the mirror
// logic is inlined in each handler rather than factored into a shared function.

onRecordAfterCreateSuccess((e) => {
  try {
    const userId = e.record.get('user');
    const displayName = e.record.get('displayName') || '';
    if (userId) {
      const user = $app.findRecordById('users', userId);
      if (user.get('displayName') !== displayName) {
        user.set('displayName', displayName);
        $app.save(user);
      }
    }
  } catch (err) {
    $app.logger().warn('[sync-display-name] mirror failed on stats create', 'error', String(err));
  }
  e.next();
}, 'stats');

onRecordAfterUpdateSuccess((e) => {
  try {
    const userId = e.record.get('user');
    const displayName = e.record.get('displayName') || '';
    if (userId) {
      const user = $app.findRecordById('users', userId);
      if (user.get('displayName') !== displayName) {
        user.set('displayName', displayName);
        $app.save(user);
      }
    }
  } catch (err) {
    $app.logger().warn('[sync-display-name] mirror failed on stats update', 'error', String(err));
  }
  e.next();
}, 'stats');
