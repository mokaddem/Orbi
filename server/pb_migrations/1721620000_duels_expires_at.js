/// <reference path="../pb_data/types.d.ts" />

// Duels TTL — add an `expiresAt` datetime to `duels` so the 7-day invite lifetime is a real,
// server-owned column instead of a client-only constant computed off `created`.
//
// Why a column (not a rule computing from `created`): PocketBase filters can't do interval
// arithmetic (`@now - 7d`), but they CAN compare a stored `expiresAt > @now`. That single
// comparison is what lets the opponent's inbox query drop expired challenges server-side, and
// what the daily cleanup cron matches on (see pb_hooks/duel_expiry.pb.js). The value itself is
// stamped by the create hook (server clock = created + 7d); this migration only adds the field.
//
// Backfill is intentionally skipped: pre-existing pending rows keep an empty `expiresAt`, which
// the inbox filter (`expiresAt = "" || expiresAt > @now`) treats as "never expires" — so no
// legitimate in-flight challenge is retroactively hidden. New rows always get a value.
//
// Committed + auto-applied on start, versioned with the client that reads it.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('duels');
    if (!c.fields.getByName('expiresAt')) {
      c.fields.add(new DateField({ name: 'expiresAt', required: false }));
    }
    app.save(c);
  },
  (app) => {
    // down: remove the field again.
    const c = app.findCollectionByNameOrId('duels');
    if (c) {
      c.fields.removeByName('expiresAt');
      app.save(c);
    }
  },
);
