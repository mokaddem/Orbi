/// <reference path="../pb_data/types.d.ts" />

// Phase 54 fix — add `created` / `updated` timestamps to the backend collections.
//
// PocketBase 0.23+ no longer auto-adds `created`/`updated` system fields: a collection
// built programmatically via `new Collection({ fields: [...] })` only gets them if you
// declare `autodate` fields. The Phase 52/53/54 migrations (`stats`, `duels`,
// `friendships`) never did — so the client's `sort: '-created'` list queries (the duel
// inbox + history, `src/backend/duels.ts`) referenced a non-existent column and failed
// with HTTP 400, leaving the inbox/history permanently empty.
//
// This forward migration backfills the two autodate fields on all three collections. It
// is idempotent (skips a field that already exists), so it is a no-op on a FRESH install
// too: it simply runs right after the `created_*` migrations in the same startup batch,
// before the server serves a single request. `-created` is the correct sort — PocketBase
// record ids are random, not chronological, so sorting by id would order rows arbitrarily.
//
// Committed + auto-applied on start, versioned with the client that reads it.

const TARGETS = ['stats', 'duels', 'friendships'];

migrate(
  (app) => {
    for (const name of TARGETS) {
      const c = app.findCollectionByNameOrId(name);
      if (!c) continue; // defensive — all three exist by this point
      if (!c.fields.getByName('created')) {
        c.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }));
      }
      if (!c.fields.getByName('updated')) {
        c.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
      }
      app.save(c);
    }
  },
  (app) => {
    // down: remove the fields again.
    for (const name of TARGETS) {
      const c = app.findCollectionByNameOrId(name);
      if (!c) continue;
      c.fields.removeByName('created');
      c.fields.removeByName('updated');
      app.save(c);
    }
  },
);
