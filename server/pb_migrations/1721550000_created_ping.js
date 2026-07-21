/// <reference path="../pb_data/types.d.ts" />

// Base schema for the Geography Quiz backend (Phase 50 — Foundation).
//
// This migration creates a single, PUBLIC, READ-ONLY `ping` collection holding
// one seeded record. It is the "prove a real record round-trip" surface: the
// client can read it over PocketBase's auto-generated REST API to confirm not
// just reachability (that is what GET /api/health is for) but that collections,
// API access rules, and migrations all work end to end.
//
// It is deliberately trivial and carries NO user data. Real collections
// (accounts, friends, scores, duels) arrive in Phases 51+.
//
// PocketBase migrations are plain JS run inside the Go binary (Goja engine).
// `migrate(up, down)` registers the pair; PocketBase applies pending migrations
// automatically on start, in filename order. Commit these files — they version
// the schema alongside the client that consumes it. `pb_data/` (the actual data)
// is gitignored.

migrate(
  (app) => {
    // --- up: create the collection + seed a record ---
    const collection = new Collection({
      type: 'base',
      name: 'ping',
      // API rules = access control, written as filter expressions:
      //   ""   → allowed for everyone, even logged-out (what we want for reads)
      //   null → superuser-only (locked); used here to forbid public writes
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          type: 'text',
          name: 'message',
          required: true,
          max: 200,
        },
      ],
    });

    app.save(collection);

    const record = new Record(collection);
    record.set('message', 'pong');
    app.save(record);
  },
  (app) => {
    // --- down: drop the collection (and its records) ---
    const collection = app.findCollectionByNameOrId('ping');
    if (collection) {
      app.delete(collection);
    }
  },
);
