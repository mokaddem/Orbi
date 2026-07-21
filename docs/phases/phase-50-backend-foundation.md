# Phase 50 — Backend foundation (PocketBase service + client seam)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟢 Built — local pipe verified,
fast loop green (awaiting owner review/merge) · **Progress:** ~100% (runbook-only hosting scope, OQ9)
· **Track:** v3.0 — Backend & multiplayer (foundation)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

> ### 🧭 Numbering & track — resolved 2026-07-21 (with merge-time follow-ups)
> **`v3.0` is reserved for the backend/server era** — introducing the app's first backend (accounts,
> multiplayer, live play) is the one change that merits a **major** version bump. This track,
> **"v3.0 — Backend & multiplayer,"** holds the seven slices as **phases 50–56**. The **v2.x line
> continues for incremental content/UX** work.
>
> Related cleanup — **already handled / pending merge:**
> - **Phase 48 "Review preview"** (implemented + already merged to `main`) has been **relabelled off its
>   erroneous `v3.0` → `v2.10`**, added to the Status Table, and archived — on branch
>   **`worktree-phase-48-cleanup`** (1 commit off main, awaiting the owner's fast-forward).
> - **Phase 49 "Atlas content"** (unmerged, parked) still labels itself `v2.10` on its branch; **bump it
>   to `v2.11` when it merges** so it doesn't collide with Phase 48.
> - **This phase (50)** is **not** in the Status Table yet — it's an unbuilt draft; add its row when the
>   backend work lands. Phase-integer caveat: the bug-fix agent (`tap-to-skip-and-ranks-doc`) hasn't
>   claimed a number; if it grabs 50, arbitrate at merge (the backend block 50–56 shifts trivially).

## Goal
Stand up the app's **first backend** — a self-hosted **PocketBase** service — and prove the pipe
**end-to-end** from the Svelte client, **without shipping any user-facing feature and without
weakening the offline-first pillar.** This phase is pure plumbing: a running server, a single thin
client seam the rest of the app will import, build-time configuration, a documented deploy runbook
(Sami's home laptop, reached over HTTPS via a Cloudflare Tunnel), and — above all — a hard guarantee
that **when the backend is absent or unreachable, the app behaves exactly as it does today.**

This is the deliberate evolution of a founding product pillar ("no backend"). It is **additive**: the
backend is layered *on top of* the existing 100%-client-side app; IndexedDB stays the local source of
truth; GitHub Pages keeps shipping a fully static PWA. Nothing about the app *requires* the server —
it only *gains* capabilities (accounts, a friends' progress board, live play) when it's reachable.

**Foundation deliberately contains no identity, no friend graph, no board, no duels, and no
realtime.** Those are the six slices that build on this one (see the track roadmap below). Foundation
only has to make a trivial round-trip work and lock in the patterns everything else inherits.

## The trigger (owner decision — 2026-07-21)
From a "time to introduce a backend" discussion. Direction **locked with the owner**:
- **Motivation:** multiplayer, a **friend leaderboard**, and **live rooms** — not a world platform.
- **Philosophy (load-bearing for the whole track):** it's an **educational app with gamification on
  top**. Leaderboards are **friend-scoped only — no world leaderboard.** **Anti-cheat is an explicit
  non-goal** — cheating just cheats yourself, and the same holds inside a friend challenge. So the
  backend is a **thin shared store + realtime coordination + progressive identity + push**, **not** a
  server-authoritative referee, and there is **no server-side score validation**. Client-reported
  scores are fine.
- **Hosting:** a **portable, self-hostable server** — run it on Sami's **home laptop** now, reachable
  over HTTPS via a **Cloudflare Tunnel** (outbound-only: no port-forward, works behind CGNAT, hides
  the home IP, gives real TLS for the PWA/service-worker/Web-Push future); **lift-and-shift the same
  code to a ~€4 VPS** later if always-on matters. Budget: **free or < €5/month.**
- **Stack:** **PocketBase** — a single Go binary that is auth + SQLite DB + auto REST + realtime
  subscriptions + admin UI in one, backup = copy a folder. Chosen over Supabase/Appwrite/Parse/Nhost
  (heavier Docker stacks) and over Cloudflare Workers + Durable Objects (zero-ops but proprietary
  lock-in that throws away the laptop asset and the app's MIT self-hostable ethos). Genuinely
  open-source (MIT); source-available options (Directus/SurrealDB BSL, Convex FSL, Firebase) were
  excluded on the "fully open source" requirement.
- **Identity model (for Phase 51, noted here so Foundation doesn't preclude it):** **progressive** —
  anonymous device id + display name, upgradeable to a real account for cross-device + a verified
  friend-board spot.

### Track roadmap (owner's sequence — for context; only slice 1 is this PRD)
1. **Foundation** (Phase 50) ← *this PRD* — service + client seam + config + deploy runbook + offline
   guarantee.
2. **Accounts** (51) — progressive identity (anon device id + name → optional account upgrade).
3. **Progress board** (52) — sync the player's own stats to the server; render the board shell (self
   first).
4. **Friend invite** (53) — the friend graph (invite/accept) that populates the board.
5. **Duels (inbox-based)** (54) — persist the Phase-46 async duel as a server-side inbox + history.
6. **Live duels** (55) — realtime 1v1 (device-to-device, no hotseat).
7. **Live rooms** (56) — group/classroom play.

## Current state (so scope is clear)
- **The app is 100% client-side, offline-first, no backend.** The main PRD's pillars ("Lean and
  self-contained … no server to run, works offline") and Non-Goals ("No multi-user accounts, login, or
  cross-device sync", "No online leaderboards or social features") state this explicitly. **This phase
  begins to change that framing** — see [Main-PRD impact](#main-prd-impact-owner-sign-off).
- **Local persistence is the source of truth.** `src/ui/stores/persistence.ts` owns a singleton
  `QuizStore` (IndexedDB, with an in-memory fallback) and exposes reactive `prefs` / `persistent`;
  sessions, SR state, mastery, XP and the Grandmaster store all live there (DB currently at v6). The
  backend must **not** move or gate any of this — it sits beside it.
- **No build-time configuration exists yet.** There is **no** `import.meta.env` usage anywhere in
  `src/` and **no** `.env` file — so a configurable backend URL is a **new pattern** this phase
  introduces (Vite `VITE_*` vars). Vite already computes a `base` (`/Orbi/` for Pages builds); the app
  is hash-routed so all asset URLs flow through `base`.
- **Deploy is static.** `.github/workflows/deploy.yml` builds the SPA and publishes it to GitHub Pages;
  `ci.yml` runs the checks. The service worker precaches the app for offline use. **None of this
  changes** — the server is separate infrastructure with its own lifecycle; CI does not build or deploy
  it, and the Pages bundle stays fully static and backend-optional.
- **The PWA is served over HTTPS.** That makes **mixed content** a hard constraint: a plain
  `http://laptop:8090` backend would be **blocked** by the browser. The backend must be **HTTPS** —
  which the Cloudflare Tunnel provides for free.
- **No `pocketbase` dependency** is present; the client SDK (`pocketbase` on npm, small) is added here.
- **Precedent for a thin store seam.** `persistence.ts` is the model to mirror: one module owns the
  external system (IndexedDB there, PocketBase here) and the components never touch it directly.

## In scope
- **`server/` scaffolding (committed).** A `server/` directory holding: a **pinned** PocketBase version
  (downloaded by a run script — the **binary is not committed**), committed **`pb_migrations/`** (the
  base schema as versioned JS migrations), a **gitignored `pb_data/`** (the SQLite db + files), and a
  **README runbook** covering (a) local run, (b) the laptop + Cloudflare Tunnel deploy, (c) backups.
  A `docker-compose.yml` **or** a systemd unit (OQ8) provides auto-restart.
- **A single client seam** — `src/backend/client.ts` (one module): wraps the PocketBase JS SDK, reads
  the base URL from **`VITE_PB_URL`** (with a sensible dev default), and is the **only** place the rest
  of the app imports the SDK. Kept thin and swappable (so a future Bun WS companion at slice 6, or a
  move off PocketBase, doesn't ripple).
- **A `backend` connectivity store** — a small Svelte store exposing status
  (`unknown` / `reachable` / `unreachable` / `disabled-no-url`) driven by a lightweight **health check**
  (PocketBase's health endpoint). Non-blocking: it never delays app startup and never throws into the
  UI.
- **The "backend is optional" contract, enforced.** With `VITE_PB_URL` unset, **or** set but
  unreachable, the app builds, loads, and plays **exactly** as today — no errors, no blocking waits, no
  degraded UX. Covered by a guard test.
- **A trivial end-to-end proof** — the client performs one health/version round-trip (and, if useful, a
  read of a tiny seeded `meta`/`ping` record), and reflects reachable/unreachable in a **minimal,
  unobtrusive indicator** (dev-only, or a single Settings line — OQ4). **No user-facing feature.**
- **Config plumbing** — a committed `.env.example` documenting `VITE_PB_URL`; dev vs prod values
  documented; the Pages production build wired to the deployed backend URL (or left backend-less if
  OQ9 says "runbook only, go live later").
- **CORS + HTTPS** — PocketBase configured to allow the **Pages production origin** and
  **`localhost:5180`**; served over HTTPS via the tunnel.
- **Security hygiene** — no credentials committed; PocketBase **admin UI protected** (strong admin
  creds; consider not exposing `/_/` publicly, or IP-limiting it). Real end-user auth is Phase 51; this
  is just not-leaving-the-door-open.
- **i18n EN/FR/DE** for any surfaced status string; `messages.test.ts` parity stays green.
- **Tests** — the offline-optional guard (app works with no/again-down backend), the connectivity
  store's state transitions (with a **mocked** client — CI never needs a live server), and a
  documented **manual/local smoke** against a real running PocketBase.

## Out of scope (deliberately)
- **All six later slices** — identity/accounts, friend graph, progress board, inbox duels, live duels,
  live rooms. Foundation ships **no** feature a player can use.
- **Any change to local gameplay, persistence, SR, mastery, XP, or the static deploy.** IndexedDB stays
  the source of truth; nothing syncs yet.
- **Web Push / notifications** — later (needs VAPID + a real feature to notify about).
- **Cross-device sync of progress** — later; Foundation only proves the pipe.
- **A managed/cloud backend, or the VPS move** — the runbook keeps them cheap and open, but v1 targets
  the laptop + tunnel; the VPS is a documented lift-and-shift, not this phase's work.
- **Editing the main PRD's Status Table / pillars** — flagged for owner sign-off, not done here (see
  the numbering callout + Main-PRD impact).

## Depends on
Phase 9 (PWA & deployment — the static Pages build + service worker the backend must not break, and
the HTTPS/offline behaviour it must respect), Phase 6 (persistence — the IndexedDB `QuizStore` that
stays the local source of truth; the backend is additive beside it), Phase 8/17 (i18n — any status
copy). **Foundation for** Phases 51–56 (Accounts, Progress board, Friend invite, Duels-inbox, Live
duels, Live rooms). Independent of the in-flight incremental phases (47 physical geography, 48 review
preview, 49 Atlas content).

## Deliverables checklist
- [x] `server/`: pinned PocketBase **v0.39.8** + `run.sh` (downloads the binary into gitignored
      `server/bin/`; **binary not committed**), committed `pb_migrations/` (base `ping` schema + seed),
      gitignored `pb_data/`, and a **README runbook** (local run · CORS · backups · upgrades). Per OQ8,
      supervision is a plain `run.sh` now with **both** systemd **and** docker-compose documented in the
      README for later (not shipped as files). A fresh checkout brings the backend up from the README.
- [x] `src/backend/client.ts` — the single PocketBase-SDK seam; URL from `VITE_PB_URL` (dev default
      `http://localhost:8090`); the **only** module importing the SDK (type-only + one dynamic import);
      thin + swappable.
- [x] `backend` connectivity store (`src/backend/status.ts`) — health-checked status
      (`unknown`/`reachable`/`unreachable`/`disabled-no-url`); non-blocking (fired from App `onMount`);
      never throws into the UI.
- [x] **Offline-optional guard**: with `VITE_PB_URL` unset **or** the backend down, the app builds,
      loads, and plays exactly as today (pure `resolveBackendUrl` covers prod-unset→null; seam + store
      guard tests; verified prod build is backend-optional).
- [x] End-to-end proof: `GET /api/health` **and** a real `ping` record read verified via `curl` against
      a running PocketBase; reflected in **one Settings → About line** next to the version (OQ4). No
      player feature.
- [x] Config: committed `.env.example` (`VITE_PB_URL`), documented dev/prod values; `ImportMetaEnv`
      typed; the Pages build stays fully static and backend-optional.
- [x] CORS restricted to the Pages prod origin (`https://mokaddem.github.io`) + `http://localhost:5180`
      (verified via a preflight). **HTTPS/tunnel is runbook-only this phase (OQ9)** — documented, not
      stood up; no mixed-content locally (http↔http on localhost).
- [x] Security: no secrets committed (`pb_data/` + `.env.local` gitignored); admin/superuser setup and
      admin-surface protection documented in the runbook. Real end-user auth is Phase 51.
- [x] `pocketbase` SDK added (`^0.27.0`); bundle-size impact noted — **lazy-loaded into its own chunk
      (~10.5 KB gzip), zero added to the offline entry** beyond the tiny seam.
- [x] EN/FR/DE for the status string (`settings.backend.*`); `messages.test.ts` parity green.
- [x] Tests: offline-optional guard + URL resolution (`client.test.ts`); connectivity-store transitions
      with a **mocked** client, no live server in CI (`status.test.ts`); manual/local smoke documented in
      the README.
- [x] Verified: fast loop green (`npm run test` 969✓ / `check` 0 errors / `lint` clean); a real
      round-trip confirmed **locally**; the app confirmed unchanged with the backend absent/down. _The
      laptop + tunnel round-trip is deferred to when a later phase goes live (OQ9: runbook-only)._

## Technical notes
- **Offline-first is non-negotiable.** Wrap every backend call so failure is silent and non-blocking;
  **never** gate app startup, routing, or a gameplay path on a network call. The connectivity store
  probes in the background; the UI reacts, it doesn't wait.
- **Mixed content forces HTTPS.** The PWA is HTTPS (Pages), so the backend must be HTTPS. The Cloudflare
  Tunnel supplies TLS + a stable hostname without port-forwarding or exposing the home IP — this is the
  single choice that makes the laptop a legitimate host rather than a liability.
- **CORS.** PocketBase allows configuring permitted origins; whitelist the Pages production origin and
  `http://localhost:5180`. Get this right early — it's the classic first-connection failure.
- **New config pattern.** Introduce `VITE_PB_URL` (the app has no `import.meta.env` today). Build-time
  bake for prod; a dev default (e.g. `http://localhost:8090`) for local. An optional hidden Settings
  override may help testing (OQ3) — keep it out of the normal UI.
- **Keep the seam thin.** One module owns the SDK (mirroring how `persistence.ts` owns IndexedDB).
  Everything downstream talks to *our* seam, never the SDK directly, so slice 6's possible Bun WS
  companion — or any backend swap — is contained.
- **Migrations committed, data gitignored.** PocketBase migrations are JS files in `pb_migrations/`;
  version them with the client that consumes them. `pb_data/` (SQLite + uploads) is local state — never
  committed; back it up (PocketBase has scheduled backups; add an offsite copy — OQ6).
- **Don't commit the binary.** Pin a PocketBase version and download it in the run script / via a small
  Docker image, so the repo stays lean and the version is explicit.
- **Server is separate infra.** CI/`deploy.yml` continue to build and ship only the static SPA. The
  server has its own lifecycle (the runbook). This keeps the "host the app anywhere as static files"
  property intact.
- **Test seam.** Mock `src/backend/client.ts` in unit/component tests so CI never needs a live server;
  validate the real pipe with a documented manual smoke (a small script or `curl` + a checklist).
- **Admin surface.** Even pre-auth, protect the PocketBase admin (`/_/`): strong creds, and ideally
  don't expose it on the public tunnel hostname (separate/again-tunnelled, or IP-limited).

## Main-PRD impact (owner sign-off)
Introducing a backend contradicts several statements in the main PRD that should be revised **with the
owner** when the track lands (not in this PRD):
- **Pillar 3** ("Lean and self-contained … no server to run") → reframe as *offline-first with an
  **optional, additive** backend for social/multiplayer; the app still works fully offline and hosts as
  static files.*
- **Non-Goals** "No multi-user accounts, login, or cross-device sync" and "No online leaderboards or
  social features" → these become **in-scope** for the v3.0 track (friend-scoped, per the philosophy
  above), not global.
- The **Deferred/Future** note "Cross-device sync (would introduce a lightweight backend + DB)" is now
  being actioned — move it into the track.

## Open Questions — to resolve with the owner
> Per the owner (2026-07-21): the phase-numbering mess is being sorted first; **these open questions are
> to be tackled after that.** Recommendations are noted so the round is quick.

1. **Repo layout — monorepo vs separate repo for the server.** (Rec: a `server/` dir **in this repo**,
   so migrations version alongside the client that consumes them; the SPA build ignores it. A separate
   repo only if the server grows its own release cadence.)
2. **Public hostname / tunnel.** Named Cloudflare Tunnel on a subdomain Sami controls (stable, needed
   for prod CORS + a bookmarkable URL), or a throwaway `*.trycloudflare.com` quick tunnel for early
   dev? Does Sami have a domain to point at it? (Rec: quick tunnel for dev now; a named tunnel +
   owned subdomain before Phase 51 ships anything real.)
3. **How the client discovers the backend URL.** Build-time `VITE_PB_URL` baked into the Pages build
   (simple, but re-deploy to change), with a **dev default** — plus an optional **hidden Settings
   override** for testing? (Rec: build-time env + dev default; hidden override only if it helps QA.)
4. **Backend status visibility in v1.** A **dev-only** indicator, a single unobtrusive **Settings**
   line, or fully invisible until Phase 51 needs it? (Rec: a small Settings line — enough to *prove*
   the pipe to Sami without implying a feature.)
5. **PocketBase version pinning & upgrade cadence.** Pin an exact version and document the upgrade
   path? (Rec: yes — pin, note upgrades in the runbook.)
6. **Backups.** Cadence + destination for `pb_data` (the SQLite file is the single point of data loss on
   a laptop). (Rec: PocketBase scheduled backups **+** a periodic offsite copy; documented in the
   runbook. This is *the* durability risk of the laptop host.)
7. **CORS origins.** Confirm the exact **Pages production origin** to whitelist (e.g. the
   `mokaddem.github.io` origin serving `/Orbi/`) alongside `localhost:5180`. Any other origins (a
   preview host)?
8. **Process supervision on the laptop.** `docker-compose` (portable, easy restart) or a native
   **systemd** unit (lighter, no Docker)? (Rec: whichever Sami runs already; systemd if the laptop is a
   plain Linux box.)
9. **Go live now, or runbook-only?** Should Foundation actually **stand up** the laptop + tunnel
   deployment, or just deliver the **local-dev pipe + a documented deploy runbook** and go live when
   Phase 51 has a real reason? (Rec: build + verify the local pipe **and** do one real laptop+tunnel
   round-trip to de-risk the runbook, but treat "always-on" as a Phase-51 concern.)
10. **Test strategy for backend-touching code.** Confirm: **mock** the client seam in the fast loop
    (CI never needs a live server), with the real connection covered by a **manual/local** smoke. Any
    appetite for an optional CI job that spins up PocketBase? (Rec: mock-only in CI; manual smoke.)

## Acceptance criteria
- With `VITE_PB_URL` **unset** or the backend **down**, the app builds, loads, and plays **exactly** as
  today — no new blocking behaviour, no console errors. The offline-first pillar is provably preserved
  (guard test + a manual backend-off run).
- With PocketBase running — **locally** and **via the laptop + Cloudflare Tunnel per the runbook** — the
  client reaches it **over HTTPS**, completes a health/version round-trip, and the minimal status
  indicator correctly shows reachable vs unreachable.
- The `server/` scaffolding (pinned version, run script/compose or systemd, committed migrations,
  gitignored data, README runbook incl. backups) lets a fresh checkout bring the backend up by
  following the README.
- The client seam is the **only** importer of the PocketBase SDK; downstream code depends on *our*
  module, not the SDK.
- No secrets/credentials committed; CORS restricted to the known origins; the backend is HTTPS; the
  admin surface is protected.
- Fast loop green (`npm run test` / `check` / `lint`); backend-touching code is mocked in tests; the
  documented manual smoke validates the real connection. EN/FR/DE parity holds (`messages.test.ts`).
- The static GitHub Pages deploy is unchanged and still ships a fully functional, backend-optional PWA.

## Progress log
- **2026-07-21 — PRD drafted** from the "introduce a backend" discussion. Direction **locked with the
  owner**: motivation is **multiplayer + friend leaderboard + live rooms** (not a world platform);
  **friend-scoped only, anti-cheat is a non-goal** (client-reported scores fine → thin store, not a
  referee); hosting is a **portable self-hostable server** on Sami's **home laptop via Cloudflare
  Tunnel** (→ €4 VPS lift-and-shift later), budget **< €5/mo**; stack is **PocketBase** (MIT single
  binary), chosen over heavier Docker BaaS (Supabase/Appwrite/Parse/Nhost) and over Cloudflare
  Workers+Durable Objects (lock-in) on the self-hostable/open-source/laptop-asset grounds;
  **progressive identity** for Phase 51. Scoped Foundation to **pure plumbing** — service + a single
  client seam + `VITE_PB_URL` config + a deploy runbook + a hard **offline-optional guarantee** — with
  **no** user-facing feature and **no** identity/friends/board/duels/realtime (those are the six later
  slices; roadmap recorded). Grounded in the current app: **no** `import.meta.env`/`.env` today (new
  config pattern), IndexedDB `QuizStore` (`persistence.ts`) stays the local source of truth, static
  Pages deploy (`deploy.yml`) unchanged, and the HTTPS PWA forces an **HTTPS backend** (mixed-content)
  — which the tunnel supplies.
- **2026-07-21 — Moved to its own worktree + track set to v3.0 (owner directive).** Relocated this PRD
  from the (already-merged) `phase-46` worktree onto a fresh **`worktree-phase-50-backend-foundation`**
  branched from local `main` (v2.6.0). Owner ruled the backend is a **major version — `v3.0`**, so the
  earlier "stay on v2.x" default is superseded **for this track only**: v3.0 = the backend era (phases
  50–56); the v2.x line continues for incremental content/UX. Recorded the **numbering resolution** and
  its **merge-time follow-ups** (relabel Phase 48 off its erroneous v3.0 → v2.11; add Status-Table rows
  for 48/49/50; confirm the phase-50 integer vs the live bug-fix agent) in the callout above —
  **deliberately not editing the shared `main_PRD.md` in this session** because two agents
  (`atlas-country-content-brief`, `tap-to-skip-and-ranks-doc`) are live and would be clobbered. OQ1–OQ10
  remain; the owner will run the clarifying round **after** the numbering mess is settled. **NOT built —
  awaiting the clarifying round and explicit build approval** (see the callout at the top of the main
  PRD).
- **2026-07-21 — Open questions resolved + Foundation BUILT (with explicit owner "go").** Owner
  decisions: **OQ1** `server/` dir in this repo (monorepo); **OQ2** **no tunnel this phase** (local-only
  verification; named tunnel/domain deferred); **OQ3** build-time `VITE_PB_URL` + dev default; **OQ4**
  **one Settings → About line, next to the version**; **OQ5** pin **v0.39.8**, upgrades documented;
  **OQ6** PocketBase scheduled backups + offsite copy, documented; **OQ7** CORS =
  `https://mokaddem.github.io` + `http://localhost:5180`; **OQ8** plain `run.sh` now, systemd **and**
  docker-compose documented for later; **OQ9** **runbook-only hosting** (build + verify the local pipe;
  laptop+tunnel deferred to when a later phase goes live); **OQ10** mock the seam in CI + a documented
  manual smoke. Built: `server/` (`run.sh` fetching pinned PocketBase, committed `pb_migrations/` with a
  public read-only `ping` collection + seed, gitignored `pb_data/`/`bin/`, README runbook); the single
  seam `src/backend/client.ts` (lazy-loaded SDK, sole importer); the `src/backend/status.ts` connectivity
  store (probed from App `onMount`, non-blocking); the Settings status line + EN/FR/DE copy;
  `.env.example` + `ImportMetaEnv` type. **Verified for real:** downloaded PocketBase v0.39.8, booted it,
  the committed migration auto-applied, and `GET /api/health` + a `ping` record read + a CORS preflight
  all succeeded; fast loop green (**969 tests**, `check` 0 errors, `lint`/prettier clean); prod build
  confirms the SDK is a separate ~10.5 KB-gzip lazy chunk (offline entry unpenalised) and the Pages build
  stays static + backend-optional. Did **not** touch `main_PRD.md` (Status-Table row + pillar/Non-Goal
  reframe remain merge-time owner sign-off; other agents still live on it). Committed on
  `worktree-phase-50-backend-foundation`; **not pushed** (owner ff's/pushes).
