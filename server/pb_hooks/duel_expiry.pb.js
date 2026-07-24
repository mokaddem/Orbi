/// <reference path="../pb_data/types.d.ts" />

// Duels TTL — the server owns the 7-day invite lifetime.
//
//  1. On create, stamp `expiresAt = now + 7 days` from the SERVER clock (authoritative — the
//     client never sends it). This pairs with the `expiresAt` column (migration
//     1721620000_duels_expires_at) + the opponent inbox filter in src/backend/duels.ts, which
//     drops `expiresAt <= @now` rows so an expired challenge disappears from the inbox.
//  2. A daily cron hard-deletes long-expired PENDING duels so the table doesn't accrue dead
//     invites. The collection's `delete` API rule is locked (null), but a cron runs in-process
//     with full DAO access, so this is allowed here and nowhere else. Completed duels are never
//     touched — they're the win/loss history.
//
// NOTE: each PocketBase JSVM hook handler executes in its OWN isolated scope — it cannot
// reference functions/variables declared elsewhere in this file. So the 7-day constant + the
// filter are inlined in each handler rather than shared (mirrors sync_display_name.pb.js).

// (1) Stamp the lifetime on create, from the server clock.
onRecordCreate((e) => {
  try {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    // PocketBase's canonical datetime layout is space-separated ("2006-01-02 15:04:05.000Z").
    const iso = new Date(Date.now() + SEVEN_DAYS_MS).toISOString().replace('T', ' ');
    e.record.set('expiresAt', iso);
  } catch (err) {
    $app.logger().warn('[duel-expiry] failed to stamp expiresAt', 'error', String(err));
  }
  e.next();
}, 'duels');

// (2) Daily cleanup of expired pending invites (03:00). Completed duels are kept (history).
cronAdd('duel_expiry_cleanup', '0 3 * * *', () => {
  try {
    const expired = $app.findRecordsByFilter(
      'duels',
      'status = "pending" && expiresAt != "" && expiresAt < @now',
      '', // sort (unused)
      500, // cap per run — plenty for a friend-scoped app; the next run catches any remainder
      0,
    );
    for (const rec of expired) {
      $app.delete(rec);
    }
    if (expired.length > 0) {
      $app.logger().info('[duel-expiry] deleted expired pending duels', 'count', expired.length);
    }
  } catch (err) {
    $app.logger().warn('[duel-expiry] cleanup failed', 'error', String(err));
  }
});
