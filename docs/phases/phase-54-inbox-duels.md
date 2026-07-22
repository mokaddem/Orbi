# Phase 54 — Duels (inbox-based) (persist the async duel as a server inbox + history)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟠 Planned — open questions
resolved (owner clarifying round 2026-07-22); **NOT built** (awaiting explicit build approval) ·
**Progress:** 0% · **Track:** v3.0 — Backend & multiplayer (slice 5 of 7)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

> ### 🧭 Track & numbering
> `v3.0 — Backend & multiplayer`, **slice 5 of 7**. Builds on **Phase 46** (the async duel this
> persists — its codec, per-format scoring, seeded reproduction, and the received-challenge/verdict
> screens, all **reused verbatim**), **Phase 53** (the friend graph a duel targets + the `?=` friend-read
> idiom), **Phase 52** (the `stats` snapshot + denormalized `displayName` the inbox/history rows render),
> **Phase 51** (the `users` identity the challenger/opponent relations point at), and **Phase 50** (the
> seam, connectivity store, and the hard offline-optional contract). **Foundation for** Phase 55 (live
> duels) and Phase 56 (live rooms). The v2.x line continues for incremental content/UX in parallel.

## Goal
Give the **already-shipped async duel a persistent home on the server** so friends can duel *without
passing a link by hand* and so a **win/loss history** finally accrues. Two halves:
1. **Duel inbox.** Challenge an **accepted friend directly** — a small server `duels` row targeted at
   them, carrying the same encoded challenge (scope + seed + your score) the Phase-46 link already
   carries. It appears in **their inbox** as a pending duel; they play the **identical** seeded round;
   their score is written **back to the same row**; and you see the verdict — **no link round-trip, no
   "send result back" step, no lost challenge.**
2. **Duel history.** The **deferred** (Phase 46) win/loss record: completed duels persist and render as
   a history (and a per-friend W/L tally, derived client-side). This is exactly what the Phase-46
   `playerName` capture was laying groundwork for.

Like every slice, this **preserves offline-first and is purely additive**: with no backend — or for
someone who isn't a backend friend — the **Phase-46 link / QR / short-code duel keeps working exactly as
it does today**, unchanged. The inbox and history simply don't appear. Nothing about the duel *requires*
the server; it only *gains* the inbox and history when the backend is reachable and both players are
connected, account-holding friends.

## Philosophy (inherited — load-bearing)
- **Friend-scoped only — never a world/global leaderboard.** You can only send an inbox duel to a
  person you've explicitly connected with (an **accepted friendship**). No matchmaking, no discovery, no
  global ranking, ever.
- **Anti-cheat is a non-goal → thin store, not a referee.** Both scores are **client-reported** and
  written straight to the row, exactly like the Phase-52 snapshot. No server-side validation, no
  authoritative scoring. Cheating only cheats yourself; the same holds in a friend group. (The UI keeps
  the Phase-46 honesty note.)
- **The link duel is sacred.** Phase 46 shipped a fully backend-free duel; this phase must **not** regress
  it. The inbox is a *second, additive* delivery channel for friends — never a replacement, never a gate
  in front of the existing flow.
- **Minimal data + least privilege.** A duel row holds two user ids, the encoded challenge, and the two
  scores. It's readable/writable **only by its two endpoints**, and **creatable only between accepted
  friends**. No history sharing beyond the two players; no PII beyond the names they chose (already
  denormalized on `stats`).
- **Consent by friendship.** You can only be sent a duel by someone you accepted as a friend; severing
  the friendship (Phase 53 unfriend) removes the ability to send new ones.

## Current state (so scope is clear)
- **The async duel is completely stateless (Phase 46).** A duel exists *only* as a URL-hash code
  (`#/duel?c=…` challenge, `#/duel?r=…` return) passed friend-to-friend via link / QR / short code. The
  challenger learns the result **only** if the opponent sends a return link back **and** the challenger
  opens it. Nothing is persisted — no duel object, no notification, no history. The verdict lives only in
  the codes and the in-memory `pendingDuel` store.
- **Everything the row needs already exists as pure, reusable code.** `src/domain/duel.ts` gives the
  `DuelPayload` (`{ protocolVersion, dataVersion, mode, type, region?, subregion?, length?, lives?,
  choices, seed, challengerName, challengerScore, opponentName?, opponentScore? }`), the compact
  `encodeDuel`/`decodeDuel` codec (base64url via `src/domain/base64url.ts`), the per-format
  `duelScore(type, summary) → { primary, tiebreak }`, `duelVerdict(mine, theirs)`, `DuelType`
  (`fixed|survival|full|blitz`), and `MIN_DUEL_QUESTIONS = 10`. `src/ui/duel.ts` gives
  `buildDuelPayload`, `buildReturnPayload`, and `duelToRunConfig` (payload → the identical seeded
  `RunConfig`). `Duel.svelte` already decodes a challenge, stages `pendingDuel`/`pendingConfig`, and
  launches `/play`; `DuelVerdictCard.svelte` already renders the head-to-head. **The inbox reuses all of
  this — only the transport changes from "a link" to "a server row."**
- **The backend seam + friend graph are in place (Phases 50–53).** A strict two-layer stack: `src/backend/*`
  = pure, **never-throwing** PocketBase I/O (only `client.ts` imports the SDK, lazily); `src/ui/stores/*`
  = reactive orchestration that gates on `isBackendConfigured()` + `identity.tier` and coalesces syncs.
  `friendships` (canonical `userA < userB`, unique per pair, `status: accepted`) already connects two
  `users`; `friends.ts` exposes `currentUserId()`, `canonicalPair()`, `filterQuote()`, and
  `listBoardEntries()`; the `stats` read was widened to accepted friends using the **`?=`** collection-join
  operator (the Phase-53 crux). `board.ts` exposes `snapshotFromRecord` + the denormalized `displayName`.
- **Gaps this phase fills:** no `duels` collection; no way to send a duel that survives without the
  recipient opening a link in time; no persisted outcome; no history/W-L; no pending-duel surface.

## What the inbox stores — the `duels` collection
A single small row per duel (exact shape in OQ3):

| Field | Meaning |
| --- | --- |
| `challenger` (relation → `users`) | who created the duel |
| `opponent` (relation → `users`) | the accepted friend being challenged |
| `challenge` (text/json) | the encoded Phase-46 duel payload — scope + `seed` + `dataVersion` + the challenger's name (reused codec) |
| `challengerScore` (json / two ints) | the challenger's `DuelScore` `{ primary, tiebreak }` (already played) |
| `opponentScore` (json / two ints, nullable) | the opponent's `DuelScore`, written when they finish |
| `status` | `pending` (awaiting the opponent) → `complete` (both played) |
| `opponentName` (text, denormalized) | so the challenger's history renders in one query (mirrors the `stats.displayName` pattern) |
| `challengerDismissed` / `opponentDismissed` (bool) | **per-side** hide flags (OQ6 resolved) — dismissing hides the duel from *your* history only; neither can wipe the other's record |

Reads/writes are **endpoints-only** (`@request.auth.id ∈ {challenger, opponent}`); **create** additionally
requires the opponent to be an **accepted friend** (a `@collection.friendships` `?=` join — the crux,
below). Non-negative-int score fields (`min:0, onlyInt`) mirror the `stats` clamps. Minimal: no chat, no
metadata beyond the endpoints + challenge + scores + status + the two dismiss flags.

## In scope
- **Server: a `duels` collection (committed migration).** `challenger`/`opponent` relations (both
  `cascadeDelete`), the encoded `challenge`, the two scores, `status`, denormalized `opponentName`, and
  the per-side `challengerDismissed`/`opponentDismissed` bool flags (OQ6). Rules:
  **list/view = endpoints-only**; **create = you-are-the-challenger AND the opponent is an accepted
  friend** (`@collection.friendships` `?=` join); **update = endpoints-only** (the opponent writes
  `opponentScore` + flips `status`; either endpoint sets *its own* dismiss flag — anti-cheat is a
  non-goal, so PB's coarse field-level rules aren't relied on); **delete = locked** (no hard delete; a
  row clears only via account-deletion relation cascade — dismissing is a per-side flag, not a delete).
  Versioned in `server/pb_migrations/` (new `1721590000_created_duels.js`), paired `up`/`down`. **The
  friend-scoped create rule is the crux — validated against real PocketBase early**, reusing the `?=`
  idiom.
- **Backend seam (`src/backend/duels.ts`).** Thin, **never-throwing** pb ops over `getClient()`, owner id
  bound from `pb.authStore.record?.id` (never the caller): `sendDuel(opponentId, challenge,
  challengerScore)`, `listInbox()` (pending, `opponent = me`), `listOutbox()`/pending-I-sent,
  `submitResult(duelId, opponentScore)` (opponent writes their score + `status='complete'`),
  `listHistory()` (completed, either endpoint, filtered to rows the caller hasn't dismissed),
  `dismissDuel(duelId)` (sets the **caller's own** per-side dismiss flag — never a hard delete, OQ6).
  Seam stays the only SDK importer; maps rows via a `snapshotFromRecord`-style projection.
- **Orchestration store (`src/ui/stores/duels.ts`).** Reactive `inbox` (pending duels for me) + `history`
  (completed) + a `pendingCount`; `refreshDuels()`; `send`, `submit`, `dismiss` returning stable string
  codes (`'ok' | 'no-backend' | 'no-account' | 'not-friends' | 'failed'`) for i18n. Gated on
  `isBackendConfigured()` + `identity.tier === 'account'`; coalesced (`inFlight`+`pending`, no timers);
  **no-ops offline**. Refresh on load + focus/visibility/online (reuse the App.svelte re-probe wiring);
  realtime is OQ7.
- **Send flow (reuse Phase-46 creation).** On the Summary "Duel a friend" card (unchanged gate: seeded,
  duel-able format, `≥ MIN_DUEL_QUESTIONS`, not Daily/pool-scoped), **add** a "Challenge a friend"
  option — pick from your accepted friends → `sendDuel(...)` writes the row. The existing **link / copy /
  QR / share** options stay exactly as they are (the backend-free path). No change to `buildDuelPayload`
  or the encoded challenge.
- **Receive flow (reuse Phase-46 accept).** The inbox lists pending duels ("{name} challenges you ·
  {scope} · beat {score}"); tapping one decodes the stored `challenge`, stages `pendingDuel` /
  `duelToRunConfig` → `pendingConfig` (the **existing** path), and launches the identical seeded round.
  On finish, instead of minting a return link, `submitResult(...)` writes the opponent's score to the row
  and the verdict renders via the existing `DuelVerdictCard`.
- **History.** A list of completed duels (both directions, minus the ones you dismissed) with the
  verdict + a per-friend **W/L tally** derived client-side; renders name (denormalized) + scope +
  outcome; a per-row **dismiss** (sets your own flag). Placement below (OQ8 resolved).
- **Surface & placement (OQ8 resolved → Home hub).** A **Home "duels" card with a pending-count badge**
  → a **dedicated `#/duels` route** holding the inbox (pending) + history. This dovetails with the
  owner's parallel request to **move the friend board onto Home** (see the 2026-07-22 log entry): Home
  becomes the social hub (board + a duels card), and the duel detail lives on its own route. `#/duels`
  is reached from the Home card (not a new bottom-tab — keep the tab bar stable).
- **Rematch through the inbox.** Rematch of a completed inbox duel creates a **new** `duels` row (fresh
  seed, roles swapped) targeted at the same friend (OQ10). The Phase-46 link-rematch stays for link duels.
- **Offline-optional guard (inherited).** Backend unset/down, no account, or not-friends → the Summary
  card offers **only** the Phase-46 link/QR/code path (exactly as today); the inbox/history surface is
  hidden or shows a "connect a friend to duel here" note; every op no-ops; **nothing throws**. Guard test.
- **Account-/friend-gated (inherited from Phase 53).** Sending/receiving inbox duels requires a **real
  account** (Tier 3) **and an accepted friendship** — so the inbox is durable across devices and truly
  friend-scoped. Anonymous / no-backend users keep the full link duel. (Consistent with the Phase-53 gate.)
- **Security/privacy.** Endpoints-only row rules; friend-gated create; scores clamped to non-negative
  ints; the challenge payload carries only what Phase 46 already shares (no history, no email, no PII
  beyond the chosen name); anti-cheat non-goal restated; no secrets committed.
- **i18n EN/FR/DE** for the inbox/history/send strings (extend the `duel.*` namespace or a new
  `duels.*` — OQ, minor); `messages.test.ts` parity green.
- **Tests.** Mocked seam (no live server in CI): send / list inbox / submit result / history / dismiss;
  the verdict projection from a completed row; the Summary "challenge a friend" gate; the inbox accept →
  `duelToRunConfig` launch; **offline degrade** (link duel still works, inbox no-ops); the account/friend
  gate. A documented manual/local smoke against real PocketBase — **including the friend-gated create rule
  and its isolation** (a non-friend can't send; a stranger can't read), plus the two-browser round-trip
  (A challenges B → B plays → A sees the verdict without a link).

## Out of scope (deliberately)
- **Realtime / live head-to-head** — Phase 55 (device-to-device, no hotseat) and Phase 56 (rooms). This
  slice is still **asynchronous**: the inbox is polled/refreshed, not a live connection.
- **Realtime inbox updates** (PocketBase subscriptions / a pushed badge) — OQ7; refresh-on-load/focus this
  slice. **Push notifications** (Web Push / email) — no SMTP is configured and PWA push is a separate
  effort; the inbox is **pull-only**.
- **Retiring or changing the Phase-46 link/QR/code duel** — it stays verbatim as the backend-free path.
- **The Grandmaster "become a grandmaster too" invite (Phase 46b)** — it's a pass/fail invite, not a
  score duel; leave it link-only (OQ11).
- **Any server-side scoring / anti-cheat / verified results** — non-goal, restated.
- **Global / world anything, matchmaking, discovery, dueling strangers** — **never**. Friend-scoped only.
- **Per-mode/region duel analytics, streak-of-duels mechanics** — the history is a flat record + a simple
  per-friend W/L tally.

## Depends on
**Phase 46** (the async duel — codec `duel.ts`/`base64url.ts`, `duelScore`/`duelVerdict`,
`buildDuelPayload`/`duelToRunConfig`, `Duel.svelte`/`DuelVerdictCard.svelte`, the seeded-run linchpin —
all reused), **Phase 53** (the `friendships` graph a duel targets + the `?=` friend-read idiom + the
account gate), **Phase 52** (the `stats` snapshot + denormalized `displayName` the rows render),
**Phase 51** (the `users` identity + `identity` store/tier), **Phase 50** (seam, connectivity, offline
contract), **Phase 8/17** (i18n). **Foundation for** Phase 55 (live duels) & Phase 56 (live rooms).

## Deliverables checklist
- [ ] Committed migration `server/pb_migrations/1721590000_created_duels.js` — a `duels` collection
      (`challenger`/`opponent` relations, `challenge`, `challengerScore`/`opponentScore`, `status`,
      denormalized `opponentName`, per-side `challengerDismissed`/`opponentDismissed` bools; non-neg-int
      score fields); endpoints-only list/view; **create gated on you-are-challenger + accepted
      friendship** (`@collection.friendships` `?=` join); update endpoints-only; delete locked. Paired
      `down`. **Verified against real PocketBase 0.39.8.**
- [ ] `src/backend/duels.ts` — thin, never-throwing pb ops (`sendDuel`, `listInbox`, `listOutbox`,
      `submitResult`, `listHistory`, `dismissDuel`); owner id bound inside the seam; seam stays the only
      SDK importer; row→view projection.
- [ ] `src/ui/stores/duels.ts` — reactive `inbox`/`history`/`pendingCount`; `refreshDuels`; `send`/
      `submit`/`dismiss` returning stable string codes; gated on backend + account tier; coalesced;
      no-ops offline; refresh on load/focus.
- [ ] Summary: **add** "Challenge a friend" (pick an accepted friend → `sendDuel`) alongside the
      unchanged link/QR/code options; same duel-ability gate.
- [ ] Inbox surface: lists pending duels; accept → decode `challenge` → existing `duelToRunConfig`
      launch; on finish `submitResult` → verdict via `DuelVerdictCard`.
- [ ] History surface: completed duels (both directions, minus dismissed) + per-friend W/L tally +
      per-row dismiss (own flag).
- [ ] Placement (OQ8): a **Home "duels" card with a pending-count badge** → a dedicated **`#/duels`
      route** (inbox + history), coordinated with moving the friend board onto Home.
- [ ] Rematch through the inbox → a new row (fresh seed, roles swapped), same friend (OQ10).
- [ ] **Offline-optional guard**: no backend / no account / not-friends → only the Phase-46 link path;
      inbox/history hidden or noted; ops no-op; no throws (store test).
- [ ] Account-/friend-gated send + receive (Tier 3 + accepted friendship); anonymous / link users
      unaffected.
- [ ] Security/privacy: endpoints-only + friend-gated-create rules (verified isolation); scores clamped;
      minimal payload; anti-cheat non-goal; no secrets committed.
- [ ] EN/FR/DE for inbox/history/send strings; `messages.test.ts` parity green.
- [ ] Tests: send/list/submit/history/dismiss, verdict projection, Summary gate, inbox accept→launch,
      offline degrade, account/friend gate — **mocked** seam (no live server in CI). Real-PB curl smoke
      (friend-gated create + isolation) done.
- [ ] **Deployment**: local-only (OQ12) — verified with two/three identities against a local PocketBase;
      standing up the Cloudflare Tunnel remains a separate owner decision.
- [ ] Verified: fast loop green (`npm run test` / `check` 0 errors / `lint` clean / build ok, SDK still a
      lazy chunk); a full A→B→A inbox round-trip against a local PocketBase (curl + two browsers).

## Technical notes
- **Reuse the codec + scoring + accept path verbatim.** The `challenge` column stores exactly the
  Phase-46 `encodeDuel(payload)` string; the seam decodes it with `decodeDuel`; the inbox accept reuses
  `duelToRunConfig` → `pendingDuel`/`pendingConfig` → `/play`; the verdict reuses `duelScore`/
  `duelVerdict` + `DuelVerdictCard`. **Do not fork the duel domain** — the only new thing is *where the
  payload lives* (a row vs a URL) and *how the result comes back* (a write vs a return link).
- **The friend-gated create rule is the crux.** It must express "the caller is the `challenger` **and**
  `opponent` is an **accepted friend** of the caller." Like the Phase-53 widened `stats` read, this needs
  a `@collection.friendships` back-relation filter using **`?=`** (NOT `=` — with `=` the join silently
  breaks once the table holds >1 row, confirmed on 0.39.8). **Prototype + verify this against real PB
  early**, before building any UI on it, exactly as Phase 53 did for the widened read.
- **Endpoints-only, opponent-writes-the-result.** list/view/delete check `@request.auth.id ∈
  {challenger, opponent}`. Update is **opponent-only** (they fill in `opponentScore` + set
  `status='complete'`); the challenger is create-only (a rematch is a new row, never an edit). This is
  least-privilege and sidesteps PocketBase's coarse field-level rules — but confirm the model in OQ4
  (the anti-cheat non-goal means a laxer "either endpoint may update" is also defensible).
- **Best-effort, never blocks, local-first for your own play.** Sending a duel and submitting a result
  are best-effort background writes (coalesced, no timers, no-op offline) — your run still finishes and
  records locally regardless. The inbox/history reads are refresh-on-load. Nothing about the server
  round-trip gates gameplay.
- **Denormalize names for one-query rendering.** Store `opponentName` (and rely on the challenge's
  `challengerName`) so the inbox/history render without joining to `stats`/`users` — mirrors the
  `stats.displayName` pattern.
- **Dismiss semantics need a decision (OQ6).** If delete is mutual, one side dismissing wipes the other's
  history record. If each side should keep their own history, prefer per-side `challengerDismissed` /
  `opponentDismissed` flags over a hard delete. Decide before the migration lands.
- **Version/data mismatch — reuse Phase-46 warn-and-allow.** The stored challenge carries `dataVersion`;
  on decode/launch the existing mismatch handling applies unchanged (rare — the PWA auto-updates).
- **Migrations committed, `pb_data/` gitignored** — unchanged. The new migration sorts after
  `1721580000`. Owner/endpoint rules by default; widen deliberately; `?=` for `@collection.*` joins;
  `min:0, onlyInt` + client clamp for scores.
- **Test seam.** Mock `src/backend/*` (`vi.hoisted` fake `pb` + `vi.mock('./client')`); pure projections
  unit-tested in isolation; a `__resetForTests()` seam. Validate the real pipe — **especially the
  friend-gated create + isolation** — with a documented manual smoke + the two-browser round-trip
  established in Phases 51–53.

## Main-PRD impact (owner sign-off)
This slice makes the **deferred Phase-46 "duel history"** real and turns the async duel from a
link-you-might-lose into a durable, friend-scoped inbox. It's consistent with the reframed **friend-scoped,
opt-in, never-global** social direction (landed with Phase 53) — no new Non-Goal reversal is needed.
Fold the Status-Table row for Phase 54 into the single merge-time `main_PRD.md` edit the backend track is
accumulating (Phases 50–53 rows + the Pillar-3 / Non-Goal reframe), with owner sign-off. (The root
`CLAUDE.md` "no backend" copy is also part of that deferred backend-track doc update, not this PRD.)

## Open Questions — to resolve with the owner
1. **Inbox is additive, link duel unchanged?** Confirm the Phase-46 link / QR / short-code duel stays
   **exactly as shipped** (the backend-free path, and the path for dueling non-friends), and the inbox is
   a **second** delivery channel layered on for accepted friends with an account. (Rec: **yes** —
   additive; never a gate in front of the existing flow.)
2. **Account + friend gating.** Sending/receiving an *inbox* duel requires a **real account AND an
   accepted friendship** (consistent with Phase 53's account-gated friending). Anonymous / no-backend
   users keep the full link duel. (Rec: **yes** — durable + genuinely friend-scoped. Confirm.)
3. **`duels` row shape.** Store the whole `encodeDuel(...)` **string** in one `challenge` column (reuse
   the Phase-46 codec verbatim) + denormalized `opponentName` + the two `DuelScore`s, vs exploding scope
   fields (mode/type/region/seed…) into columns. (Rec: **one encoded `challenge` string** + names +
   `challengerScore`/`opponentScore` + `status` — minimal, and keeps the domain single-sourced. Confirm.)
4. **Update rule / who writes what.** **Opponent-only** update (writes `opponentScore` + flips
   `status='complete'`; challenger is create-only, rematch = new row) — least privilege; **vs** "either
   endpoint may update" (simpler, and the anti-cheat non-goal makes it defensible). (Rec: **opponent-only
   update**. Confirm.) **→ Resolved: endpoints-only update** — forced by OQ6's per-side dismiss flags
   (the challenger must set its own flag); the opponent still writes the score + status, each side writes
   only its own dismiss flag (anti-cheat non-goal, so no field-level enforcement relied on).
5. **Friend-gated create (the crux).** create = `@request.auth.id = challenger` **AND** `opponent` is an
   accepted friend (a `@collection.friendships` `?=` join), verified against real PB before UI. (Rec:
   **yes** — this is what keeps duels friend-scoped at the store layer, not just the UI.)
6. **Dismiss / history retention.** Can either endpoint **delete** a duel (mutual removal — one side
   dismissing wipes the other's history too), or should each side keep its own history via per-side
   **dismissed flags**? Do completed duels persist indefinitely as history until dismissed? (Rec: **per-
   side dismissed flags** so neither loses their record; completed duels persist; no hard delete except
   via unfriend cascade. This is a genuine fork — please pick.) **→ Resolved: per-side dismissed flags**
   — rows persist; dismissing hides only your own view; no hard delete (clears only via account-deletion
   cascade).
7. **Freshness: refresh-on-load vs realtime.** Pending-duel count/inbox updates on **load + focus/online**
   (reusing the App.svelte re-probe wiring) or **live** via PocketBase subscriptions? (Rec: **refresh-on-
   load/focus** this slice; realtime lands with the live-duel slice 55. Confirm. Push notifications are
   out either way — no SMTP/PWA-push infra.)
8. **Surface & placement.** Where do the **inbox + history** live? (a) A **section in Progress** next to
   the friend board (the Phase-52/53 pattern); (b) a **Home "duels" card + a dedicated route** with a
   pending-count badge; (c) fold into the existing `#/duel` route. Phase 53 said "promote to its own route
   when duels land." (Rec: **a Home card with a pending-count badge → a small dedicated route** — the
   inbox needs a visible, glanceable entry the board doesn't. Confirm, or keep it a Progress section for
   now.) **→ Resolved: Home card + pending badge → a dedicated `#/duels` route** (not a Progress section,
   not a bottom-tab); coordinated with moving the friend board onto Home so Home is the social hub.
9. **History depth + tally.** Show **all** completed duels or a **cap** (e.g. last N, or last N per
   friend)? Surface an aggregate **per-friend W/L** tally? (Rec: **flat recent history (soft cap) + a
   per-friend W/L tally derived client-side**; PB handles storage. Confirm.)
10. **Rematch through the inbox.** A rematch from a completed inbox duel creates a **new** `duels` row
    (fresh seed, roles swapped, same friend); the Phase-46 link-rematch stays for link duels. (Rec:
    **yes** — new row for inbox rematches. Confirm.)
11. **Grandmaster invite (46b).** Leave the "become a grandmaster too" invite **link-only** (out of
    scope — it's pass/fail, not a score duel), or also give it an inbox entry? (Rec: **link-only /
    out of scope** this slice; revisit if wanted later.)
12. **Go live now, or local-only?** Follow 50–53 (**local-only**, verified with two/three local
    identities / two browsers) or finally stand up the **Cloudflare Tunnel** (Phase-50 runbook) so real
    friends on separate devices can duel? An inbox is only *useful* cross-device — but it can still be
    *built + verified* locally. (Rec: **build local-only + verify with two browsers**; treat hosting as a
    **separate owner decision** — same call as Phase 53 OQ9.) **→ Resolved: local-only + two-browser
    verify** (Cloudflare Tunnel stays a separate later decision).
13. **Score trust / clamp.** Restate the anti-cheat non-goal: scores are client-written, no validation
    beyond a **non-negative-int clamp** (`min:0, onlyInt` + client `nat()`, like `stats`). (Rec: **yes** —
    minimal clamp, no validation. Confirm.)

## Acceptance criteria
- With the backend reachable and two account-holding **friends**, player A can **challenge B directly**
  from a qualifying Summary; the duel appears in **B's inbox**; B plays the **identical** seeded round
  (same order + options, independent of B's prefs/SR/history); B's result is written **back to the same
  row**; and A sees the **verdict** (per `duelScore`/`duelVerdict`) **without opening any link**. A
  completed duel appears in **both players' history** with the correct outcome, and a **per-friend W/L
  tally** is shown.
- A `duels` row is **creatable only** by its challenger **to an accepted friend**, and **readable/writable
  only** by its two endpoints. **Verified against real PocketBase** with three identities: a non-friend
  cannot send; a stranger cannot read or write another pair's duel. The opponent's score can be written
  only by the opponent (per OQ4).
- With the backend unset/down (or the player anonymous / not-friends), the **Phase-46 link / QR / code
  duel works exactly as today**; the inbox/history surface is hidden or shows a connect-a-friend note; no
  op throws or blocks (guard test + a manual backend-off run). The static Pages deploy still ships a fully
  functional, backend-optional PWA.
- Fast loop green (`npm run test` / `check` / `lint`); backend-touching code mocked in tests; EN/FR/DE
  parity holds; the duel domain (`duel.ts`) is **unchanged** (reused, not forked).

## Progress log
- **2026-07-22 — PRD drafted** right after Phases 50–53 landed (seam + identity + self/friend board +
  friend graph, all built & fast-loop-green, unmerged). Scoped slice 5 as **persisting the Phase-46 async
  duel as a server-side inbox + history**: a small endpoints-only `duels` collection whose **create is
  gated on an accepted friendship** (the `?=` join, the technical crux — verify against real PB early,
  like the Phase-53 widened read), a thin never-throwing `src/backend/duels.ts` seam + a `duels`
  orchestration store, a **"challenge a friend" addition** to the unchanged Phase-46 Summary card, an
  **inbox** that reuses the existing decode → `duelToRunConfig` → play → `DuelVerdictCard` path (result
  written **back to the row** instead of a return link), and the **deferred duel history + per-friend
  W/L**. Reaffirmed the track philosophy — **friend-scoped only (never global), anti-cheat a non-goal,
  the link duel stays sacred/backend-free, minimal data, least privilege, consent by friendship** — and
  the **offline-first** guarantee (no backend / no account / not-friends → the Phase-46 link duel is
  exactly as today; inbox + history are additive). Flagged the load-bearing open questions: **OQ5
  friend-gated create** (the crux), **OQ6 dismiss/history-retention** (mutual delete vs per-side flags —
  a real fork), **OQ8 surface/placement** (a badged route vs a Progress section), **OQ2 account+friend
  gate**, and **OQ12 go-live-vs-local-only**. **NOT built — awaiting the clarifying round + explicit
  build approval** (see the callout at the top of the main PRD).
- **2026-07-22 — Open questions resolved (owner clarifying round).** Owner-decided: **OQ6 = per-side
  dismissed flags** (`challengerDismissed`/`opponentDismissed` bools; dismissing hides a duel from *your*
  history only, neither side can wipe the other's record; rows persist, clearing only via account-
  deletion relation cascade — no hard delete). This drives **OQ4 = endpoints-only update** (the
  challenger must be able to set *its own* dismiss flag, so update can't be opponent-only; anti-cheat is
  a non-goal, so PB's coarse field-level rules aren't relied on — the opponent still writes the score +
  status, either endpoint writes only its own flag). **OQ8 = Home hub** — a **Home "duels" card with a
  pending-count badge → a dedicated `#/duels` route** (inbox + history), *not* a Progress section and
  *not* a new bottom-tab; this dovetails with the owner's parallel request to **move the friend board
  onto Home** (tracked separately as a Phase-52/53 UX change), making Home the social hub. **OQ12 =
  local-only** (build + verify with two/three identities against localhost; standing up the Cloudflare
  Tunnel stays a separate later decision — same call as Phases 50–53). Recommendations taken for the
  rest: **OQ1** inbox additive / link duel unchanged; **OQ2** account + accepted-friendship gate (link
  duel stays for anon/no-backend); **OQ3** store the whole `encodeDuel(...)` string in one `challenge`
  column + denormalized `opponentName` + the two `DuelScore`s; **OQ5** friend-gated create via the `?=`
  join (the crux — verify against real PB before UI); **OQ7** refresh-on-load/focus (realtime + push
  deferred); **OQ9** flat recent history (soft cap) + per-friend W/L tally; **OQ10** inbox rematch = a
  new row (fresh seed, roles swapped); **OQ11** Grandmaster 46b invite stays link-only (out of scope);
  **OQ13** non-negative-int score clamp only, no validation. Scope/schema/deliverables above updated to
  reflect these. **Still NOT built — awaiting explicit build approval.**
