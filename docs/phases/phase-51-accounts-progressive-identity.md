# Phase 51 — Accounts (progressive identity)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started — PRD draft
· **Progress:** 0% (planning) · **Track:** v3.0 — Backend & multiplayer (slice 2 of 7)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

> ### 🧭 Track & numbering
> `v3.0 — Backend & multiplayer`, **slice 2 of 7** (see the roadmap in
> [`phase-50`](archive/phase-50-backend-foundation.md) once archived, or `phases/` while in-flight).
> Builds directly on **Phase 50 Foundation** (the client seam, connectivity store, `VITE_PB_URL`
> config, committed migrations, CORS, and the hard offline-optional contract). The v2.x line continues
> for incremental content/UX in parallel.

## Goal
Give every player a **stable identity** the backend can attach data to — and make it **progressive**:
- **Anonymous and frictionless by default.** On first run the app mints a stable device identity (a
  generated `deviceId` + the existing display name) with **no signup, no login screen, no email**. This
  is enough to *be someone* on a friend board and in a duel.
- **Upgradeable, opt-in.** A player who wants **cross-device continuity** and a **verified spot on the
  friend board** can attach a real account (email + password, and/or OAuth) to the *same* identity —
  never orphaning their local progress.

Like Foundation, this phase ships **no social feature a player uses with others** — it delivers the
**identity layer + account-management UI** that the next slices consume (Progress board 52, Friend
invite 53, Duels 54+). And like Foundation, it **preserves offline-first**: identity works entirely
locally with no backend; the server is only where it's *mirrored and claimed* when reachable.

## Philosophy (inherited — load-bearing)
Per the track's locked direction (educational app, gamification on top; **friend-scoped only**;
**anti-cheat is a non-goal**; **thin store, not a referee**):
- **Anonymous is a first-class tier, not a fallback.** Most players should never see an auth screen.
- **Minimal PII.** A display name is the only required identity data; an email exists **only if** the
  player chooses to upgrade. (Owner works in security/privacy — keep the PII surface deliberately small
  and documented.)
- **No global uniqueness / no global namespace.** Names collide freely; disambiguation is friend-scoped
  and happens in later slices. There is no world directory of users.

## Current state (so scope is clear)
- **`playerName` already exists** (`src/data/persistence/types.ts`, Phase 46): an optional, local,
  cosmetic display name (trimmed, clamped to `PLAYER_NAME_MAX_LENGTH = 24`, "Shown to friends you
  challenge"). Phase 51 **elevates this** into the player's profile display name and (optionally) syncs
  it — it does **not** introduce a competing name field.
- **There is no device/account identity today.** The app only generates per-**session** UUIDs
  (`crypto.randomUUID()`); nothing identifies the *player* across sessions or devices. A stable
  `deviceId` is **net-new**.
- **Duels are stateless / URL-based** (Phase 46): the challenger's identity is just a name embedded in a
  shareable `#/duel?c=…` link — there is no server-side "who." Phase 51 provides the durable identity
  those (and the board) will hang off in later slices.
- **Foundation is in place** (Phase 50): the single seam `src/backend/client.ts` (lazy-loaded SDK, sole
  importer), the `backendStatus` connectivity store, `VITE_PB_URL` config, committed `pb_migrations/`,
  CORS, and the **offline-optional guarantee** with its guard tests. Identity extends this seam; it does
  not add a second backend surface.
- **Local persistence stays the source of truth.** IndexedDB `QuizStore` (`persistence.ts`) owns
  progress; `deviceId` + `playerName` live there. The server mirror is best-effort and additive.

## The progressive identity model (the core design)
Three tiers over **one** underlying player record — upgrading only ever *adds* to it:

| Tier | Trigger | Local | Server (when reachable) |
| --- | --- | --- | --- |
| **1 · Anonymous device** | first run, automatic | `deviceId` (UUID) + default name | an **anonymous auth record** (generated credentials), token cached locally |
| **2 · Named** | player edits their display name (already possible) | `playerName` set | profile `displayName` updated |
| **3 · Account** | player opts in to "sync across devices" | — | the *same* record gains a real **email+password / OAuth** login → sign-in elsewhere reclaims identity + a **verified** board spot |

**Invariants:**
- The app is fully usable at **Tier 1** forever; Tiers 2–3 are opt-in.
- Tiers never fork the record: a Tier-3 upgrade claims the existing Tier-1/2 record, so local progress
  and any server-mirrored data carry over.
- **With no backend / offline**, identity is just `deviceId` + `playerName` in IndexedDB — everything
  works; the server steps in to mirror/claim when it's reachable.

## PocketBase mechanics (to teach + decide)
PocketBase has **auth collections** (records that can log in). The likely shape:
- A single **auth collection** (e.g. `users`) whose records ARE the player profiles (or a `users`
  auth collection + a `profiles` base collection it owns — OQ1). Fields: `displayName`, `deviceId`,
  `tier`/`isAnonymous`, timestamps.
- **Anonymous creation (Tier 1):** PocketBase has no first-class "anonymous auth." The common pattern
  is to create a normal auth record with **generated credentials** — e.g. email `⟨deviceId⟩@anon.invalid`
  and a strong random password kept **only client-side** (IndexedDB) — marked `isAnonymous: true`. It's a
  real account with throwaway secrets. (Consequence to teach: those secrets are the *only* way back into
  the anon identity — clear local storage and it's gone. That fragility is precisely *why upgrading to a
  real account matters* for durability. OQ7.)
- **Token handling:** the SDK's `pb.authStore` (browser default = `LocalAuthStore`, localStorage key
  `pocketbase_auth`) holds the token + record; `autoRefresh` keeps it fresh. We route this through the
  **seam** so storage/refresh is in one place (OQ10).
- **Upgrade (Tier 3):** `pb.collection('users').update(id, { email, password })` + email verification,
  and/or `authWithOAuth2({ provider })`. Email verification/reset **requires SMTP** (OQ4).
- **API rules:** a record is **readable/updatable only by its owner** (`@request.auth.id = id`).
  Friend-scoped visibility of *other* players is a later slice's concern.

## In scope
- **Identity data model (committed migration).** The auth collection (+ profile fields) above, with
  owner-only API rules. Versioned in `server/pb_migrations/` alongside the client.
- **Client identity module** — extends the Foundation seam (e.g. `src/backend/identity.ts` + an
  `identity` store): generate/persist `deviceId`, ensure an anonymous auth record when the backend is
  reachable (best-effort, non-blocking), expose the current identity + tier as a reactive store, and
  perform display-name updates and the account upgrade / sign-in / sign-out flows. The seam stays the
  **only** SDK importer.
- **Local-first identity.** `deviceId` + `playerName` in IndexedDB are the source of truth; a
  **data-model version bump** adds `deviceId` (OQ8). Server sync is best-effort and never blocks.
- **Account UI (in Settings).** Show the current identity + tier; edit display name (reuse the existing
  control); an opt-in **"Create an account to sync across devices"** flow (email+password and/or OAuth
  per OQ2); **sign in** on a new device to reclaim; **sign out**. Unobtrusive and clearly optional.
- **Offline-optional guard (inherited contract).** With `VITE_PB_URL` unset **or** backend down, the app
  builds/loads/plays exactly as today; identity silently stays local. Guard test.
- **Security & privacy hygiene.** Owner-only rules; careful token storage; document the (minimal) PII
  surface and the anon-secret fragility. Anti-cheat remains a non-goal.
- **i18n EN/FR/DE** for all identity/account copy; `messages.test.ts` parity green.
- **Tests** — mocked seam (CI never needs a live server): tier transitions, anonymous-ensure,
  name-sync, upgrade/sign-in/sign-out, and the offline guard. A documented manual smoke against a real
  PocketBase.

## Out of scope (deliberately)
- **Syncing gameplay/progress stats to the server and the board UI** — Phase 52.
- **The friend graph (invite/accept) and any friend-scoped visibility** — Phase 53.
- **Duels/rooms** — Phases 54–56.
- **Account recovery beyond what PocketBase provides** (custom flows), advanced session management,
  multi-account-per-device.
- **A world user directory / global name uniqueness** — never (friend-scoped philosophy).

## Depends on
**Phase 50** (the seam, connectivity store, `VITE_PB_URL`, migrations, CORS, offline contract — all
extended here), **Phase 6** (persistence — `deviceId`/`playerName` live in the `QuizStore`; needs a
data-model version bump), **Phase 46** (the existing `playerName` + URL-duel identity this supersedes),
**Phase 8/17** (i18n). **Foundation for** Phases 52–56.

## Deliverables checklist
- [ ] Committed migration(s): the auth collection (+ profile fields: `displayName`, `deviceId`,
      `isAnonymous`/`tier`) with **owner-only** API rules; base seed if useful.
- [ ] Client identity module extending the seam (`src/backend/identity.ts` + `identity` store):
      `deviceId` gen/persist, best-effort anonymous auth, name update, upgrade/sign-in/sign-out; the seam
      remains the only SDK importer.
- [ ] Local-first identity in IndexedDB with a **data-model version bump** for `deviceId`; local wins on
      conflict (OQ6); migration of existing installs (existing `playerName` preserved).
- [ ] Account UI in Settings: current identity + tier, edit display name, opt-in upgrade flow, sign-in,
      sign-out — clearly optional and unobtrusive.
- [ ] **Offline-optional guard**: `VITE_PB_URL` unset **or** backend down → app unchanged; identity stays
      local; no blocking waits, no console errors (guard test).
- [ ] Security/privacy: owner-only rules; safe token storage; documented PII surface + anon-secret
      fragility; anti-cheat still a non-goal.
- [ ] EN/FR/DE for all identity/account strings; `messages.test.ts` parity green.
- [ ] Tests: tier transitions, anonymous-ensure, name-sync, upgrade/sign-in/sign-out, offline guard —
      **mocked** seam (no live server in CI); documented manual smoke.
- [ ] **Deployment**: if OQ3 says go live, a real reachable **HTTPS** backend (named Cloudflare Tunnel +
      owned subdomain) with prod `VITE_PB_URL` baked into the Pages build and CORS updated — and a
      **real cross-device sign-in verified**. If not, an explicit local-only verification + runbook note.
- [ ] Verified: fast loop green (`npm run test` / `check` / `lint`); real anon-create + name-sync +
      upgrade + sign-in round-trip confirmed; the app confirmed unchanged with the backend absent/down.

## Technical notes
- **Reuse the seam.** Identity is one more module behind `src/backend/`; components read the `identity`
  store, never the SDK. Keeps slice 6's possible transport swap contained (as Foundation established).
- **Never block on identity.** Anonymous-ensure and name-sync are background, best-effort, and
  idempotent; a down/absent backend just leaves identity local. Mirror the `probeBackend` pattern.
- **Data-model migration.** Add `deviceId` to the persisted prefs/profile and bump the `QuizStore`
  version (currently v6 per Foundation's notes); preserve any existing `playerName` on upgrade of old
  installs.
- **Auth tokens & HTTPS.** Tokens now cross the wire, so the **HTTPS requirement is real** the moment we
  go live — this is likely the phase that finally stands up the tunnel Foundation deferred (OQ3). Local
  dev stays http↔http on localhost.
- **SMTP is only needed for email verification/reset** (OQ4). Anonymous (generated-email) records and
  OAuth need none; email+password *without* verification can work initially if we accept unverified
  accounts.
- **Migrations committed, data gitignored** — unchanged from Foundation.
- **Test seam.** Mock `src/backend/*` so CI never needs a live server; validate the real auth flows with
  a documented manual smoke.

## Main-PRD impact (owner sign-off)
This is the phase where the deferred Foundation reframes should actually land (still owner-driven, at
merge): the **Non-Goals** "No multi-user accounts, login, or cross-device sync" becomes **in-scope**
(progressive, friend-scoped), and **Pillar 3** ("no server to run") reads as *offline-first with an
optional additive backend*. Coordinate with the Phase-50 merge-time follow-ups (Status-Table rows;
Phase 48/49 relabels) so `main_PRD.md` is edited once, cleanly.

## Open Questions — to resolve with the owner
1. **Collection shape.** One auth collection that *is* the profile, or an auth collection + a separate
   owned `profiles` base collection? (Rec: **single auth collection** with profile fields — simplest;
   split later only if friend-visible fields need different rules than auth fields.)
2. **Upgrade methods.** Email+password, OAuth2 (which providers — Google? GitHub?), or both, and in
   which order? (Rec: **email+password first** — fully self-hostable, no third-party setup; add **one**
   OAuth provider later if there's demand.)
3. **Go live now?** Accounts are the "real reason" Foundation (OQ9) deferred hosting — cross-device
   claim needs a reachable server. Stand up the **named Cloudflare Tunnel + owned subdomain** this
   phase? (Rec: **yes** — this is the trigger; a domain is needed. Confirm Sami has one to point at it.)
4. **SMTP / email verification.** Configure an SMTP provider (which free tier — e.g. a transactional
   sender?) to verify emails + support reset, or **allow unverified accounts** initially and defer
   verification? (Rec: allow unverified to start; add SMTP when verification/reset actually matters,
   documented in the runbook.)
5. **Anonymous mechanism.** Generated-credential auth record (`⟨deviceId⟩@anon.invalid` + random local
   password) vs a rules-guarded non-auth `players` row vs PB OTP. (Rec: **generated-credential auth
   record** — gives a clean, secure upgrade path to Tier 3; document the "clear-storage-loses-anon"
   fragility as the reason to upgrade.)
6. **Source-of-truth / conflict.** Local `deviceId`+`playerName` are authoritative; server mirror is
   best-effort; on divergence **local wins**? (Rec: **yes** for this phase — real multi-device merge
   logic is a board/sync concern for 52+.)
7. **Upgrade / sign-in collisions.** Signing into an existing account on a device that already has a
   *different* anon identity — replace local identity with the signed-in one (and keep local *progress*
   under the new identity)? Merge? (Rec: **replace identity, keep local progress**; warn before
   discarding an un-upgraded anon identity that has server data.)
8. **Persistence schema.** Put `deviceId` in `prefs` or a dedicated identity store, and how to migrate
   existing installs (bump `QuizStore` version, preserve `playerName`). (Rec: a small dedicated identity
   record; version bump with a no-op-preserving upgrade.)
9. **PII / privacy posture.** Confirm the minimal surface (displayName always; email only on upgrade)
   and whether a short privacy note / data-deletion path is wanted now, given the owner's domain. (Rec:
   document the surface + a "delete my account" affordance that removes the server record; keep it
   minimal.)
10. **Token storage & refresh.** SDK default `LocalAuthStore` (localStorage) vs routing through our
    IndexedDB-backed seam; rely on SDK `autoRefresh`? (Rec: **wrap the SDK authStore in the seam** so
    storage + refresh live in one place, consistent with the client-seam principle.)

## Acceptance criteria
- A fresh install is immediately a **Tier-1 anonymous** player (stable `deviceId` + display name) with
  **no login prompt**; the app is fully usable, online or offline.
- With the backend reachable, the anonymous identity is **mirrored** server-side (best-effort,
  non-blocking); with it unset/down, identity stays purely local and **nothing about the app changes**
  (guard test + a manual backend-off run).
- A player can **edit their display name**, **upgrade** to a real account, **sign out**, and **sign in
  on another device** to reclaim the *same* identity — with local progress intact — verified against a
  real PocketBase (locally, and via the deployed backend if OQ3 says go live).
- API rules restrict each profile to its **owner**; the PII surface is minimal and documented;
  anti-cheat remains a non-goal; no secrets committed; backend HTTPS in production.
- Fast loop green (`npm run test` / `check` / `lint`); backend-touching code is mocked in tests; EN/FR/DE
  parity holds; the static Pages deploy still ships a fully functional, backend-optional PWA.

## Progress log
- **2026-07-21 — PRD drafted** immediately after Phase 50 Foundation landed (signed, unmerged). Framed
  as the identity layer over the Foundation seam: **progressive identity** (anonymous device id + the
  existing `playerName` → opt-in account upgrade for cross-device + a verified friend-board spot),
  **friend-scoped, anti-cheat non-goal, minimal PII**, offline-first preserved. Grounded in the current
  app: `playerName` already exists (Phase 46, local/cosmetic) and is elevated here; **no device/account
  identity exists yet** (only per-session UUIDs); duels are stateless/URL-based today. Scoped **out** the
  board/sync (52), friend graph (53), and duels (54+). Recorded 10 open questions — the pivotal one being
  **OQ3: does this phase finally stand up the deployed HTTPS backend** (accounts are the "real reason"
  Foundation deferred hosting). **NOT built — awaiting the clarifying round + explicit build approval.**
