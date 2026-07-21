/// <reference path="../pb_data/types.d.ts" />

// Phase 51 — progressive identity: extend the built-in `users` auth collection with
// the app's profile fields.
//
// PocketBase ships a default `users` auth collection whose API rules are already what
// we want: owner-only list/view/update/delete (`id = @request.auth.id`) and a PUBLIC
// `create` rule (empty) — which the anonymous self-registration flow relies on
// (the client creates its own `⟨deviceId⟩@anon.invalid` account). So this migration
// does NOT create a collection or touch the rules; it only ADDS three profile fields:
//
//   • displayName — the player's shown name (mirrors the local `playerName`; ≤ 24 to
//                   match PLAYER_NAME_MAX_LENGTH).
//   • deviceId    — the stable per-device id the local identity is built around.
//   • isAnonymous — true for an auto-created anonymous account; cleared on upgrade to
//                   a real (email+password) account.
//
// No email verification / SMTP is configured (unverified accounts are allowed this
// phase). Committed + auto-applied on start, versioned with the client that reads it.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('users');

    collection.fields.add(
      new TextField({ name: 'displayName', max: 24, required: false }),
    );
    collection.fields.add(new TextField({ name: 'deviceId', max: 100, required: false }));
    collection.fields.add(new BoolField({ name: 'isAnonymous', required: false }));

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('users');

    collection.fields.removeByName('displayName');
    collection.fields.removeByName('deviceId');
    collection.fields.removeByName('isAnonymous');

    app.save(collection);
  },
);
