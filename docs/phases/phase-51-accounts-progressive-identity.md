# Phase 51 — Accounts (progressive identity)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟢 Built — local pipe + live
browser round-trip verified, fast loop green (awaiting owner review/merge) · **Progress:** ~100%
(local-only scope, OQ3) · **Track:** v3.0 — Backend & multiplayer (slice 2 of 7)

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
- [x] Committed migration (`1721560000_extend_users_profile.js`): **extends the built-in `users` auth
      collection** (its default rules are already owner-only + public-create) with `displayName`,
      `deviceId`, `isAnonymous`. (No new collection — creating one would collide with PB's default
      `users`.)
- [x] Client identity module extending the seam: `src/backend/identity.ts` (thin, never-throwing pb ops;
      **not** the SDK importer — uses Foundation's `getClient()`) + `src/ui/stores/identity.ts` (the
      reactive `identity` store + orchestration: `deviceId` gen/persist, best-effort anon auth, name
      sync, upgrade, sign-in, sign-out, delete). The seam remains the only SDK importer.
- [x] Local-first identity in IndexedDB with a **DB version bump (v6 → v7)** adding an `identity`
      singleton store (`IdentityRecord = { deviceId, anonSecret? }`); additive upgrade preserves all
      existing data (proven by the reopen test); local wins on conflict (OQ6); existing `playerName` is
      untouched.
- [x] Account UI in Settings: current identity + tier, opt-in **Create account** (email+password),
      **sign in**, **sign out**, and **delete account** (confirm dialog) — clearly optional/unobtrusive.
- [x] **Offline-optional guard**: `VITE_PB_URL` unset **or** backend down → app unchanged; identity
      stays local; no blocking waits, no console errors (store test + a live backend-down browser run).
- [x] Security/privacy: owner-only rules (PB defaults); anon secret stored local-only + its fragility
      documented; minimal PII (displayName always, email only on upgrade) + a delete-account affordance;
      anti-cheat still a non-goal.
- [x] EN/FR/DE for all identity/account strings (`settings.account.*`); `messages.test.ts` parity green.
- [x] Tests: tier transitions, anonymous-ensure, name-sync, upgrade/sign-in/sign-out, delete, offline
      guard — **mocked** seam (no live server in CI): `backend/identity.test.ts` +
      `ui/stores/identity.test.ts`; DB-migration test in `store.test.ts`.
- [x] **Deployment**: **local-only (OQ3)** — no hosting stood up. Real cross-device sign-in is deferred
      to when hosting goes live (path in the Foundation runbook); this phase verified every flow against
      a **local** PocketBase (incl. a live browser round-trip).
- [x] Verified: fast loop green (`npm run test` **995**✓ / `check` 0 errors / `lint`+prettier clean);
      real anon-create + name-update + upgrade + sign-in + delete round-trip confirmed against a local
      PocketBase (via `curl` **and** a live headless-browser session that self-registered anon accounts);
      the app confirmed unchanged with the backend absent/down.

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

## Open Questions — RESOLVED with the owner (2026-07-21)
> The clarifying round is done; decisions below. **Resolution ≠ build approval** — the plan still needs
> an explicit "go" before any implementation (see the callout at the top).

1. **Collection shape.** → **RESOLVED (adopted rec): single auth collection that *is* the profile**
   (`displayName`, `deviceId`, `isAnonymous`/`tier`). Split into a separate `profiles` base collection
   later only if friend-visible fields need different rules than auth fields.
2. **Upgrade methods.** → **RESOLVED: email + password first.** Fully self-hostable, no third-party
   setup, works on the laptop today. Add **one** OAuth provider later only if there's demand.
3. **Go live now?** → **RESOLVED: NO — local-only again.** Build & verify entirely against a localhost
   PocketBase; defer real hosting (named tunnel + owned subdomain + prod `VITE_PB_URL` + CORS) to a
   later phase. **Consequence:** true cross-device sign-in can only be **simulated** this phase (two
   `deviceId`s + two SDK authStores against one local server); the real cross-device claim is verified
   when hosting actually goes live. The Foundation runbook already documents that path.
4. **SMTP / email verification.** → **RESOLVED: allow unverified accounts to start** (no SMTP this
   phase). Email+password works without address verification; add a transactional SMTP sender
   (verification + reset) when it matters, documented in the runbook.
5. **Anonymous mechanism.** → **RESOLVED (adopted rec): generated-credential auth record**
   (`⟨deviceId⟩@anon.invalid` + a strong random password stored **only** client-side). Document the
   "clear-storage-loses-anon" fragility as the concrete reason to upgrade to Tier 3.
6. **Source-of-truth / conflict.** → **RESOLVED (adopted rec): local wins.** Local `deviceId` +
   `playerName` are authoritative; the server mirror is best-effort. Real multi-device merge is a
   board/sync concern for 52+.
7. **Upgrade / sign-in collisions.** → **RESOLVED: replace identity, keep local progress.** The
   signed-in account becomes the identity; local gameplay progress carries over under it. **Warn first**
   if the anon identity being discarded already has server-side data.
8. **Persistence schema.** → **RESOLVED (adopted rec): a small dedicated identity record** (not stuffed
   into `prefs`); bump the `QuizStore` version with a no-op-preserving upgrade that **retains existing
   `playerName`** on old installs.
9. **PII / privacy posture.** → **RESOLVED (adopted rec): minimal surface** — `displayName` always,
   `email` only on upgrade — plus a **"delete my account"** affordance that removes the server record.
   Keep it minimal and documented (owner works in privacy/security).
10. **Token storage & refresh.** → **RESOLVED (adopted rec): wrap the SDK authStore in our seam** so
    token storage + refresh live in one place, consistent with the Foundation client-seam principle.

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
- **2026-07-21 — Open questions resolved (owner clarifying round).** **OQ3: NO — local-only again**
  (defer real hosting; cross-device sign-in is **simulated** with two deviceIds/authStores against one
  local PocketBase, real claim verified when hosting later goes live). **OQ2: email + password first**
  (self-hostable, no OAuth this phase). **OQ4: allow unverified accounts** (no SMTP this phase; add
  verification/reset later). **OQ7: sign-in replaces identity, keeps local progress** (warn if the
  discarded anon identity has server data). Adopted recommendations for the rest: **OQ1** single auth
  collection = profile; **OQ5** generated-credential anon record (`⟨deviceId⟩@anon.invalid` + local-only
  random password; document the clear-storage fragility); **OQ6** local wins on conflict; **OQ8**
  dedicated identity record + `QuizStore` version bump preserving existing `playerName`; **OQ9** minimal
  PII (displayName always, email on upgrade) + a "delete my account" affordance; **OQ10** wrap the SDK
  authStore in the seam. Status → *planning, OQs resolved.* **Still NOT built — awaiting the explicit
  build "go."**
- **2026-07-21 — BUILT (with explicit owner "go").** Implemented the full identity layer. **Server:**
  migration `1721560000_extend_users_profile.js` extends PB's built-in `users` auth collection (default
  rules already owner-only + public-create) with `displayName`/`deviceId`/`isAnonymous` — verified a
  fresh PB applies it. **Local:** DB **v6 → v7** adds an `identity` singleton store
  (`IdentityRecord = { deviceId, anonSecret? }`) in `idb-store`/`memory-store`/`types`, with
  round-trip + reopen (migration-preserves-data) tests. **Client:** `src/backend/identity.ts` (thin,
  never-throwing pb ops over Foundation's `getClient()` — anon ensure, sign-in, register/upgrade,
  rename, delete, currentProfile) + `src/ui/stores/identity.ts` (reactive `identity` store +
  orchestration, fired from `App.svelte` after `initPersistence`). **UI:** a Settings → Account section
  (create/sign-in/sign-out/delete + confirm dialog) with EN/FR/DE copy. **Key design fact discovered by
  testing against real PB:** direct email-change is blocked without SMTP, so **upgrade registers a NEW
  real account** (local progress is untouched — it lives in IndexedDB keyed by `deviceId`). **Verified
  for real:** every flow (anon create → auth → rename → upgrade → sign-in → delete) via `curl`, **and a
  live headless-browser session** that self-registered `⟨uuid⟩@anon.invalid` anon accounts against a
  running PB (CORS + seam + identity chain end-to-end); a **backend-down** browser run confirms the app
  is unchanged. Fast loop green: **995 tests**, `check` 0 errors, `lint`/prettier clean. **Local-only
  (OQ3):** no hosting stood up; real cross-device claim deferred to when hosting goes live. Did **not**
  touch `main_PRD.md` (merge-time owner sign-off). Committed on `worktree-phase-50-backend-foundation`;
  **not pushed** (owner ff's/pushes).
