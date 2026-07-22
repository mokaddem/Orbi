# Phase 53 — Friend invite (friend graph + friends on the board)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟢 Built — friend graph +
widened-read verified against real PocketBase (curl), fast loop green (awaiting owner review + a
two-browser UI walkthrough / merge) · **Progress:** ~100% (local-only scope, OQ9) · **Track:** v3.0 —
Backend & multiplayer (slice 4 of 7)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

> ### 🧭 Track & numbering
> `v3.0 — Backend & multiplayer`, **slice 4 of 7**. Builds on **Phase 51** (the `users` identity a
> friendship connects) and **Phase 52** (the self-only board + the owner-only `stats` snapshot this
> phase makes *readable to friends*). **Foundation for** the duel slices (Phase 54 inbox duels,
> Phase 55 live duels, Phase 56 live rooms), which all target *people you've connected with*. The v2.x
> line continues in parallel.

## Goal
Turn the self-only board into a **friend-scoped** one: let a player **connect with a friend** and see
that friend's headline row (rank, XP, tallies) next to their own. Two halves:
1. **Friend graph.** A small, mutual **friendship** between two `users` records, established by
   **sharing an invite** (link / short code / QR — the Phase-46 pattern) and revocable by unfriending.
2. **Friends on the board.** Widen the Phase-52 `stats` **read** rule so a player can read the snapshot
   rows of their **accepted friends**, and render them on the board (sorted, self highlighted). When you
   have no friends yet, the Phase-52 "friends coming" note becomes an **"invite a friend" CTA**.

Like every slice, this **preserves offline-first**: with no backend the board still shows the self row
from local stats, the friends section degrades to the invite CTA, and nothing throws or blocks. The
friend graph and friends' rows are **additive** — they light up only when a backend is reachable.

## Philosophy (inherited — load-bearing)
- **Friend-scoped only — never a world/global leaderboard.** You see *exactly* the people you
  explicitly connect with, and only after a mutual invite. There is no discovery, no global ranking.
- **Anti-cheat is a non-goal → thin store, not a referee.** Friends read each other's client-reported
  snapshots verbatim. No validation.
- **Minimal data + least privilege.** A friendship is two user ids and a status. Reading a friend's row
  exposes only the Phase-52 board-render fields (already denormalized `displayName` + a handful of
  integers) — no history, no email, no PII beyond the name they chose.
- **Consent both ways.** A row is only readable across an **accepted** friendship, and either side can
  sever it (mutual loss of read). No one you didn't connect with can read your snapshot.

## Current state (so scope is clear)
- **Phase 52 landed a `stats` collection** — one owner-owned snapshot row per `users` record (unique
  `user` relation; denormalized `displayName`/`deviceId`; XP/rank/tallies), with **owner-only** rules.
  This phase widens its **read** rule to friends; create/update stay owner-only. The board already
  renders the **self row** from local stats and best-effort mirrors it to this row.
- **Phase 51 identity** gives every player a `users` record (anonymous or upgraded) with `displayName`
  + `deviceId`, plus the `identity` store + backend seam. A friendship connects two such records.
- **A reusable invite pattern already exists (Phase 46).** Async friend duels + the Grandmaster invite
  ship a **slide-up share sheet** (`ChallengeInviteSheet`: Share / Copy image / Copy link / Show QR), a
  generic QR generator (`src/ui/qr.ts`), a QR modal (`DuelQrModal`), a name prompt (`DuelNamePrompt`),
  and received-invite routes (`#/duel`, `#/challenge-invite`). Those invites are **backend-free, seeded
  share-a-run** payloads; the friend invite is the first invite that establishes a **persistent** link
  via the backend, but it should **reuse the same share surfaces + QR + link/code UX**.
- **The seam + offline contract** (Phase 50) and identity/board orchestration (Phase 51/52) remain in
  force: components read stores, never the SDK; every backend op is best-effort and never throws.

## What the friend graph stores — the `friendships` collection
A single small row per connection (see OQ4 for the exact shape):

| Field | Meaning |
| --- | --- |
| `userA` (relation → `users`) | one endpoint of the friendship |
| `userB` (relation → `users`) | the other endpoint |
| `status` | `accepted` (and possibly `pending` — see OQ3) |

Canonical ordering (`userA` < `userB`) + a **unique index on (`userA`, `userB`)** so each pair has at
most one row (dedup + idempotent add). The board's friend query joins from here to the friends' `stats`
rows. Minimal: no chat, no metadata beyond the endpoints + status.

## In scope
- **Server: a `friendships` collection (committed migration).** Symmetric edge between two `users`
  records, unique per pair; API rules so a row is **created/read/deleted only by one of its two
  endpoints** (`@request.auth.id` ∈ {userA, userB}). Versioned in `pb_migrations/`.
- **Server: widen the `stats` READ rule (committed migration).** `list`/`view` become "own row **or** a
  row whose `user` is an accepted friend of the caller" (back-relation filter against `friendships`).
  `create`/`update` stay owner-only; `delete` stays locked. The **crux** — validated against real PB.
- **Backend seam (`src/backend/friends.ts`).** Thin, never-throwing pb ops over `getClient()`:
  add-friend (from an invite payload), list-friends, remove-friend, and read-friends'-snapshots (the
  widened `stats` query). Seam stays the only SDK importer.
- **Invite flow (reuse Phase 46 surfaces).** A friend-invite payload (the inviter's `users` id + a
  guard token — OQ2) rendered through the existing share sheet (link / code / QR) and a received-invite
  route (e.g. `#/friend-invite`) that, when opened while signed in, establishes the friendship (OQ3).
- **Board: friends rendered.** Extend the Phase-52 board to list self + accepted friends' rows from the
  widened `stats` read (denormalized `displayName` + rank medal + XP + the two secondaries), **sorted XP
  desc, self always shown + highlighted**; empty-friends → an **"invite a friend"** CTA in place of the
  Phase-52 note. Refresh-on-load (realtime is OQ7).
- **Unfriend.** Remove the edge (either side) → mutual loss of the read; a confirm; the row disappears.
- **Offline-optional guard (inherited).** Backend unset/down → board shows the self row from local, the
  friends section shows the invite CTA (disabled/explained), no throws. Guard test.
- **Account-gated friending (OQ1 — owner override).** Friending **requires a real account** (Tier 3),
  so friendships are always durable across devices. The friends surface shows anonymous users a
  **"create an account to add friends" gate** (routes to the Phase-51 upgrade); the self row + own board
  keep working while anonymous (Phase 52 unchanged).
- **Security/privacy.** Least-privilege rules (endpoints only; accepted-only reads); snapshot stays the
  Phase-52 render fields; anti-cheat non-goal restated; no secrets committed.
- **i18n EN/FR/DE** for friend/invite/board strings; `messages.test.ts` parity green.
- **Tests.** Mocked seam (no live server in CI): add/list/remove friend, the widened-read projection,
  invite payload codec, board renders self+friends sorted, offline degrade-to-CTA. A documented
  manual/local smoke against real PocketBase — **including the widened read rule and its isolation**
  (two identities: friends see each other's rows, non-friends see none), plus the two-browser round-trip.

## Out of scope (deliberately)
- **Duels / rooms / any realtime play** — Phases 54–56. This phase is the friend graph + a static
  (refresh-on-load) friends board.
- **Realtime board updates** (PocketBase subscriptions) — OQ7; later if wanted.
- **A dedicated "Friends" nav route** — the board stays a **section in Progress** (Phase 52 OQ4) until
  the social surface is rich enough to earn its own route; revisit when duels land.
- **Friend requests inbox / notifications** — the persistent inbox arrives with **Phase 54**; this phase
  uses the invite link itself as the connection act (OQ3).
- **Blocking, discovery, friend suggestions, chat, avatars** — a world/global leaderboard — **never**.
- **Per-mode/region friend comparisons, history sharing** — the snapshot stays a headline projection.

## Depends on
**Phase 52** (the `stats` snapshot this makes friend-readable; the board shell), **Phase 51** (the
`users` identity a friendship connects; identity store + seam), **Phase 50** (seam, connectivity,
offline contract), **Phase 46** (the reusable invite share sheet + QR + link/code UX + received-invite
routes), **Phase 43** (XP/rank spine the rows render), **Phase 8/17** (i18n). **Foundation for** Phases
54–56 (all target connected friends).

## Deliverables checklist
- [x] Committed migration: a `friendships` collection (symmetric edge, unique per pair); rules so only
      the two endpoints can create/read/delete a row. — `1721580000_friendships_and_widen_stats_read.js`.
- [x] Committed migration: **widen the `stats` read** rule to "own or accepted-friend's" (a
      `@collection.friendships` filter using the **`?=`** operator — see Technical notes); create/update
      owner-only; delete locked. **Verified against real PocketBase 0.39.8.**
- [x] `src/backend/friends.ts` — thin, never-throwing pb ops (add/list/remove friend; `listBoardEntries`
      over the widened read); seam stays the only SDK importer; owner id bound inside the seam.
- [x] Friend-invite payload codec (`domain/friend-invite.ts`) + share sheet (`FriendInviteSheet.svelte`,
      reusing `qr.ts` + the duel share helpers); a received `#/friend-invite` route that establishes the
      friendship instantly (OQ3), best-effort, never throws.
- [x] Board extended: self (local) + accepted friends' rows (rank medal, name, XP, fully-mastered +
      sessions), sorted XP desc, self highlighted; empty-friends → "invite a friend" CTA. Refresh-on-load.
- [x] Unfriend (either side) with a confirm → mutual loss of read; row disappears.
- [x] **Offline-optional guard**: no backend → self row from local + the "friends coming" note, sync
      no-ops, no throws (store test: refresh no-op + add no-backend).
- [x] Friending gated on a real account (Tier 3, OQ1 override); anonymous users see a "create an account
      to add friends" gate (→ Phase-51 upgrade); the self row still works while anonymous.
- [x] Security/privacy: endpoints-only friendship rules; accepted-only stats read (verified isolation);
      render-fields-only; anti-cheat non-goal; no secrets committed.
- [x] EN/FR/DE for friend/invite/board strings; `messages.test.ts` parity green.
- [x] Tests: add/list/remove, `listBoardEntries` mapping, invite codec, board self+friends sorted,
      offline degrade, account gate — **mocked** seam (no live server in CI). Real-PB curl smoke done.
- [x] **Deployment**: local-only (OQ9) — verified with 3 identities against a local PocketBase; standing
      up the Cloudflare Tunnel remains a separate owner decision.
- [x] Verified: fast loop green (`npm run test` 1035 ✓ / `check` 0 errors / `lint` clean / build ok, SDK
      still lazy); real friendship + widened-read + isolation + unfriend round-trip against a local
      PocketBase (curl). **Remaining: a two-browser UI walkthrough (manual) before merge.**

## Technical notes
- **Reuse the seam + identity + invite surfaces.** Friend ops sit behind `src/backend/friends.ts`;
  components read a store, never the SDK. Invites reuse Phase 46's share sheet + QR + link/code so the
  UX is consistent; only the *payload* (a durable friend link, not a seeded run) and the received-route
  behaviour (establish a friendship) are new.
- **The read-rule is the hard part.** PocketBase API rules are filter expressions; the widened `stats`
  read must express "the row's `user` is an accepted friend of `@request.auth.id`" via a back-relation
  filter against `friendships` (both `userA=…&&userB=…` orderings, `status='accepted'`). Prototype and
  **verify this against a real PB early** — get the exact filter syntax right before building UI on it.
- **Symmetric edge, canonical order.** Store one row per pair with `userA < userB` (lexicographic on id)
  so the unique index dedups and add-friend is idempotent; the board query and the read-rule both check
  membership without worrying about direction.
- **Derive, then mirror (unchanged).** Friends' rows are read straight from their `stats` snapshot
  (denormalized `displayName` so the board is one query). Your own row is still local-wins; a friend's
  is whatever they last synced (best-effort; may lag — that's fine).
- **Account-gated friending (owner decision, OQ1).** Friending requires a Tier-3 account, so friends
  are always durable across devices; the friends surface gates anonymous users to the Phase-51 upgrade
  rather than letting a device-bound identity accrue friends it would lose on a device change. The self
  row + own sync remain available while anonymous (Phase 52 unchanged).
- **Migrations committed, data gitignored** — unchanged. New migrations sort after `1721570000`.
- **Test seam.** Mock `src/backend/*`; validate the real pipe (esp. the widened read + isolation) with a
  documented manual smoke + the two-browser round-trip established in Phase 51/52.

## Main-PRD impact (owner sign-off)
This is the slice that makes the reframed **"No online leaderboards or social features"** Non-Goal
concretely **friend-scoped**: real *other people* on the board. Land the `main_PRD.md` copy change (the
Non-Goal reframe to "friend-scoped, opt-in — never global") together with the deferred Phase 50/51/52
Status-Table rows + Pillar-3 reframe, so `main_PRD.md` is edited once at merge with owner sign-off.

## Open Questions — to resolve with the owner
1. **Friend identity unit / anon.** Friend by the `users` record. Do **anonymous** identities (Tier 1/2)
   get to friend, or is a real account (Tier 3) required? (Rec: **anon can friend** — consistent with
   Phase 52 "anon syncs"; nudge upgrade for cross-device durability. Confirm.)
2. **Invite payload + guard.** The invite carries the inviter's `users` id — plus a guard token so a
   leaked/guessed id can't be friended at will? (Rec: id **+ a short random token** the inviter stores
   on their record / a nonce; keeps invites capability-like. Confirm the mechanism.)
3. **Connect model: instant vs request/accept.** With no inbox until Phase 54, is **opening a valid
   invite = an instant mutual friendship** (the shared link *is* the consent), or a **pending request**
   the other side confirms later? (Rec: **instant mutual on opening a fresh invite** — simplest without
   an inbox; revocable by unfriend. Note the trade-off: anyone with the live link can connect. Confirm,
   vs. waiting for Phase 54's inbox to do proper accept.)
4. **`friendships` shape.** Symmetric single row per pair (`userA<userB`, `status`) **vs** directed
   `{from,to,status}` rows. (Rec: **symmetric single row** — simplest dedup + read-rule. Confirm.)
5. **Widened `stats` read rule.** Confirm: `list`/`view` = own **or** accepted-friend's; `create`/
   `update` owner-only; `delete` locked. (Rec: **yes** — least privilege. The exact filter is verified
   against real PB before UI.)
6. **Board placement + empty state.** Keep the board a **section in Progress** (Phase 52 OQ4), with
   empty-friends showing an **"invite a friend" CTA**? Sort **XP desc**, self highlighted? (Rec: **yes**
   to all; promote to its own route only when duels make the surface richer.)
7. **Realtime vs refresh.** Friends' rows update on **load/refresh** only, or **live** via PocketBase
   subscriptions? (Rec: **refresh-on-load** this phase; realtime lands with the duel slices. Confirm.)
8. **Unfriend semantics.** Removing the edge severs the read **both** ways, with a confirm? Any "blocked"
   concept? (Rec: **mutual sever, confirm, no block** — block is out of scope. Confirm.)
9. **Go live now?** Follow 50/51/52 (**local-only**, verified with two local identities / two browsers)
   **or** finally stand up the **Cloudflare Tunnel** (documented in Phase 50) so real friends on separate
   devices can connect? A friend board is only *useful* cross-device — **but** it can still be *built +
   verified* locally. (Rec: **build local-only + verify with two browsers**; treat standing up hosting
   as a **separate owner decision** — flag it. This is the first slice where hosting materially pays off.)
10. **Anonymous durability nudge.** Where/how strongly to nudge anon users to upgrade so friends survive
    a device change — a one-time hint on the friends surface, or persistent? (Rec: **a gentle,
    dismissible hint** on the friends section when anonymous; not a blocker.)
11. **Limits / abuse.** A soft friend cap and/or invite rate-limit (anti-cheat is a non-goal, but spam
    isn't nothing)? (Rec: a **soft cap** (e.g. ~100) + rely on PB's built-in rate limits; not a focus.)

## Acceptance criteria
- With the backend reachable, a player can **share an invite** (link / code / QR, reusing the Phase-46
  surfaces) and, once connected, sees the friend's headline row (rank medal, name, XP, two secondaries)
  on the board alongside their own — **sorted XP desc, self highlighted**. Unfriending (either side)
  removes the row **both** ways.
- A `stats` row is readable **only** by its owner and that owner's **accepted friends**; `create`/
  `update` stay owner-only; a non-friend can read nothing. **Verified against real PocketBase** with two
  identities (friends see each other; strangers see none; the row still can't be forged/written by
  others).
- With the backend unset/down, the board still shows the **self row from local** and the friends section
  shows the **invite CTA**; the app is otherwise exactly as today (guard test + a manual backend-off run).
- Friending requires a real account; anonymous users are shown a create-account gate and can still see
  their own self row.
- Fast loop green (`npm run test` / `check` / `lint`); backend-touching code mocked in tests; EN/FR/DE
  parity holds; the static Pages deploy still ships a fully functional, backend-optional PWA.

## Progress log
- **2026-07-21 — PRD drafted** right after Phase 52 landed (self-only board + owner-only `stats`).
  Scoped slice 4 as **the friend graph + friends on the board**: a small symmetric `friendships`
  collection established by **reusing the Phase-46 invite share sheet / QR / link-code** and a received
  `#/friend-invite` route, plus **widening the Phase-52 `stats` READ rule** to accepted friends so the
  board renders *other people* (create/update stay owner-only). Reaffirmed the track philosophy —
  **friend-scoped only (never global), consent both ways, anti-cheat a non-goal, minimal data** — and
  the **offline-first** guarantee (self row local; friends + invite are additive; degrades to an invite
  CTA offline). Flagged the **widened read rule as the technical crux** (a PocketBase back-relation
  filter, verify against real PB early) and recorded 11 open questions — the load-bearing ones being
  **OQ3 instant-vs-request connect** (no inbox until Phase 54), **OQ9 go-live-or-local-only** (the first
  slice where hosting actually pays off, but still verifiable with two local browsers), and **OQ1 anon
  friending + durability**. **NOT built — awaiting the clarifying round + explicit build approval.**
- **2026-07-21 — Open questions resolved (owner clarifying round).** Owner-decided: **OQ9 = local-only**
  (build + verify with two browsers against localhost; standing up the Cloudflare Tunnel stays a separate
  later decision); **OQ3 = instant mutual friendship on opening a fresh invite** (the shared link is the
  consent — no inbox needed until Phase 54; revocable by unfriend); **OQ1 = REQUIRE A REAL ACCOUNT to
  friend** (owner *override* of the "anon can friend" rec) — friendships are always durable across
  devices, and the friends surface gates anonymous users to the Phase-51 upgrade (this supersedes the
  OQ10 "durability nudge": it's now an account **gate**, not a hint; the self row still works while
  anonymous); **OQ7 = refresh-on-load** (realtime deferred to the duel slices). Recommendations taken for
  the rest: **OQ2** invite = inviter user id + a short guard token; **OQ4** symmetric single-row edge
  (`userA<userB`, unique per pair); **OQ5** widen `stats` read to own-or-accepted-friend, create/update
  owner-only, delete locked; **OQ6** board stays a Progress section, empty→"invite a friend" CTA, sort XP
  desc + self highlighted; **OQ8** unfriend severs the read both ways with a confirm, no block; **OQ11**
  soft friend cap + rely on PB rate limits. Scope updated above to reflect the OQ1 override. **Still NOT
  built — awaiting explicit build approval.**
- **2026-07-22 — BUILT (with explicit owner "go").** Implemented the slice end to end. **Server:**
  `pb_migrations/1721580000_friendships_and_widen_stats_read.js` — a `friendships` base collection
  (canonical `userA`<`userB`, unique index on the pair, both relations cascade-delete, `status` select),
  endpoints-only create/list/view/delete rules; **and** the widened `stats` read. **Crux resolved:** the
  widened read MUST use PocketBase's **`?=`** ("any") operator, not `=`, on the `@collection.friendships`
  references — with `=` the match silently breaks once the table holds >1 row (empirically confirmed on
  0.39.8). `?=` correlates each branch's conditions to the same joined row, so it's correct **and**
  leak-free (adversarial test: P-Q friends + R-S friends → P reads only P,Q). Verified via a superuser
  `filter=` probe, then a full 3-account curl smoke (friends see each other; strangers see none; view +
  write cross-user blocked; unfriend severs both ways). **Client:** `backend/friends.ts` (never-throwing
  add/list/remove + `listBoardEntries` over the widened read; owner id bound from `authStore`), the store
  `ui/stores/friends.ts` (reactive list, self excluded + XP-sorted; `addFriendFromInvite` gated on
  backend + **account tier**; `unfriend`; no import cycle with identity), the pure codec
  `domain/friend-invite.ts`, the UI glue `ui/friend-invite.ts` (link/QR/share, reusing the duel helpers),
  the received `#/friend-invite` route, the `FriendInviteSheet` component, and the extended Progress
  board (self + friends merged/sorted, unfriend affordance, invite CTA, anon account-gate). i18n
  `board.*` + `friends.*` EN/FR/DE. **OQ2 scoped down:** shipped **uid-only** invite links (no guard
  token) — ids aren't exposed anywhere else so possession of the link is the capability, and anti-cheat
  is a non-goal; a rotatable token stays future hardening. **Verified:** 1035 tests green (incl. new
  codec/seam/store/board tests), check 0 errors, lint clean, build ok (SDK still a lazy 37.5 kB chunk).
  **Committed, unmerged. Remaining before merge:** a two-browser UI walkthrough (create two accounts,
  exchange an invite, see each other on the board) + the merge-time `main_PRD.md` reframe.
